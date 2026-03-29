const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (/^\s*#/.test(line) || !line.trim()) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch (e) {
    console.warn('.env load:', e.message);
  }
}
loadDotEnv();

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'clients.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
`);

try {
  const info = db.prepare("PRAGMA table_info(clients)").all();
  const hasUsername = info.some(col => col.name === 'username');
  if (!hasUsername) {
    db.exec("ALTER TABLE clients ADD COLUMN username TEXT;");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_username ON clients(username);");
    console.log('Migrated: added username column and index to clients table');
  }
} catch (e) {
  console.warn('Migration check for username column failed', e);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  const p = String(req.path || '').toLowerCase();
  if (p === '/' || p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

async function syncUserToSupabase({ email, password, fullName, company, phone, username }) {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const secret = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !secret) {
    return { created: false, skipped: true };
  }
  try {
    const resp = await fetch(`${baseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
        apikey: secret,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          company: company || null,
          phone: phone || null,
          username: username || null,
          role: 'admin',
        },
      }),
    });
    const body = await resp.json().catch(() => ({}));
    if (resp.ok) {
      return { created: true };
    }
    const msg = [body.msg, body.message, body.error_description, body.error].filter(Boolean).join(' ');
    if (/already been registered|already exists|duplicate|users_email_key/i.test(String(msg))) {
      return { created: false, duplicate: true };
    }
    console.warn('[Supabase admin] create user:', resp.status, body);
    return { created: false, error: msg || String(resp.status) };
  } catch (e) {
    console.warn('[Supabase admin] request error:', e.message);
    return { created: false, error: e.message };
  }
}

function supabaseAdminConfig() {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const secret = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { baseUrl, secret, enabled: !!(baseUrl && secret) };
}

async function supabaseTableRequest(pathAndQuery, method = 'GET', payload = null) {
  const cfg = supabaseAdminConfig();
  if (!cfg.enabled) {
    return { ok: false, status: 500, data: null, error: 'Supabase Admin не настроен на сервере.' };
  }
  const headers = {
    'Content-Type': 'application/json',
    apikey: cfg.secret,
    Authorization: `Bearer ${cfg.secret}`,
  };
  if (method !== 'GET') headers.Prefer = 'return=representation';
  try {
    const resp = await fetch(`${cfg.baseUrl}/rest/v1/${pathAndQuery}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const msg = (data && (data.message || data.error || data.hint)) || String(resp.status);
      return { ok: false, status: resp.status, data, error: msg };
    }
    return { ok: true, status: resp.status, data, error: null };
  } catch (e) {
    return { ok: false, status: 500, data: null, error: e.message };
  }
}

async function requireSupabaseAdmin(req, res, next) {
  const cfg = supabaseAdminConfig();
  if (!cfg.enabled) return res.status(500).json({ ok: false, error: 'Supabase Admin не настроен на сервере.' });

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Требуется Supabase сессия (Bearer token).' });

  try {
    const uResp = await fetch(`${cfg.baseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: { apikey: cfg.secret, Authorization: `Bearer ${token}` }
    });
    const u = await uResp.json().catch(() => null);
    if (!uResp.ok || !u || !u.id) return res.status(401).json({ ok: false, error: 'Неверная Supabase сессия.' });

    const p = await supabaseTableRequest(`profiles?select=role&id=eq.${u.id}`, 'GET');
    const role = (p.ok && Array.isArray(p.data) && p.data[0] && p.data[0].role) ? String(p.data[0].role).toLowerCase() : '';
    if (role !== 'admin') return res.status(403).json({ ok: false, error: 'Только администратор.' });

    req._sbUser = u;
    next();
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

app.post('/api/register', async (req, res) => {
  const body = req.body || {};
  console.log('[/api/register] payload received:', body);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.full_name || '').trim();
  const username = String(body.username || body.login || '').trim() || null;
  const company = String(body.company || '').trim() || null;
  const phone = String(body.phone || '').trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Укажите корректный email.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Пароль не короче 8 символов.' });
  }
  if (fullName.length < 2) {
    return res.status(400).json({ ok: false, error: 'Укажите имя или контактное лицо.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  let attemptedUsername = null;
  try {
    let finalUsername = username;
    if (!finalUsername) {
      const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9_\-\.]/g, '').toLowerCase() || 'user';
      let candidate = prefix;
      let suffix = 0;
      while (true) {
        const exists = db.prepare('SELECT 1 FROM clients WHERE username = ? COLLATE NOCASE').get(candidate);
        if (!exists) { finalUsername = candidate; break; }
        suffix += 1;
        candidate = prefix + suffix;
      }
    }
    finalUsername = String(finalUsername || '').trim();
    if (!finalUsername) {
      return res.status(400).json({ ok: false, error: 'Укажите логин или корректный email.' });
    }
    attemptedUsername = finalUsername;

    const stmt = db.prepare(`INSERT INTO clients (email, password_hash, full_name, company, phone, username)
       VALUES (@email, @password_hash, @full_name, @company, @phone, @username)`);
    const info = stmt.run({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      company,
      phone,
      username: finalUsername,
    });
    const sb = await syncUserToSupabase({
      email,
      password,
      fullName,
      company,
      phone,
      username: finalUsername,
    });
    return res.status(201).json({
      ok: true,
      message: 'Регистрация прошла успешно. Мы свяжемся с вами по email.',
      username: finalUsername,
      id: info.lastInsertRowid,
      supabase_user: sb.created === true,
      supabase_env_missing: sb.skipped === true,
      supabase_duplicate: sb.duplicate === true,
    });
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      try {
        const errDetail = String(e.message || '');
        console.warn('[/api/register] UNIQUE:', errDetail);

        const existingByEmail = db.prepare('SELECT id, username, email FROM clients WHERE lower(email) = ?').get(email.toLowerCase());
        if (existingByEmail) {
          if (username && (!existingByEmail.username || String(existingByEmail.username).trim() === '')) {
            try {
              db.prepare('UPDATE clients SET username = ? WHERE id = ?').run(String(username).trim(), existingByEmail.id);
              return res.status(200).json({ ok: true, message: 'Существующая запись обновлена: логин сохранён.', username: String(username).trim(), id: existingByEmail.id });
            } catch (ue) {
              if (ue && ue.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(409).json({ ok: false, error: 'Этот логин уже занят. Укажите другой логин.', code: 'USERNAME_TAKEN' });
              }
              console.error('Username update failed', ue);
              return res.status(500).json({ ok: false, error: 'Ошибка сервера при обновлении логина.' });
            }
          }
          return res.status(409).json({
            ok: false,
            error: 'Этот email уже зарегистрирован. Войдите или укажите другой email.',
            code: 'EMAIL_EXISTS',
          });
        }

        const failedOnUsername =
          /clients\.username|idx_clients_username/i.test(errDetail) ||
          (/UNIQUE constraint failed/i.test(errDetail) && /username/i.test(errDetail) && !/email/i.test(errDetail));

        if (failedOnUsername && attemptedUsername) {
          return res.status(409).json({ ok: false, error: 'Этот логин уже занят. Укажите другой логин.', code: 'USERNAME_TAKEN' });
        }

        if (attemptedUsername) {
          const rowByLogin = db.prepare('SELECT id, email FROM clients WHERE username = ? COLLATE NOCASE').get(attemptedUsername);
          if (rowByLogin && String(rowByLogin.email || '').toLowerCase() !== email.toLowerCase()) {
            return res.status(409).json({ ok: false, error: 'Этот логин уже занят. Укажите другой логин.', code: 'USERNAME_TAKEN' });
          }
        }

        return res.status(409).json({ ok: false, error: 'Такой email или логин уже используется.', code: 'DUPLICATE' });
      } catch (he) {
        console.error('Constraint handling failed', he);
        return res.status(500).json({ ok: false, error: 'Ошибка сервера.' });
      }
    }
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Ошибка сервера. Попробуйте позже.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sklad-pro-clients' });
});

app.get('/api/products', async (_req, res) => {
  const q = 'products?select=id,sku,name,cat_id,supplier_id,qty,min_qty,price,unit,location,supplier,description,created_at,updated_at&order=id.asc';
  const r = await supabaseTableRequest(q, 'GET');
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true, items: Array.isArray(r.data) ? r.data : [] });
});

app.post('/api/products', async (req, res) => {
  const b = req.body || {};
  const payload = {
    sku: String(b.sku || '').trim() || null,
    name: String(b.name || '').trim(),
    cat_id: Number(b.cat_id || 0) || null,
    supplier_id: Number(b.supplier_id || 0) || null,
    qty: Number(b.qty || 0),
    min_qty: Number(b.min_qty || 0),
    price: Number(b.price || 0),
    unit: String(b.unit || 'шт').trim() || 'шт',
    location: String(b.location || '').trim() || null,
    supplier: String(b.supplier || '').trim() || null,
    description: String(b.description || '').trim() || null,
  };
  if (!payload.name) return res.status(400).json({ ok: false, error: 'Укажите название товара.' });
  const r = await supabaseTableRequest('products', 'POST', payload);
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.status(201).json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
});

app.patch('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: 'Некорректный id.' });
  const b = req.body || {};
  const payload = {};
  if (b.sku !== undefined) payload.sku = String(b.sku || '').trim() || null;
  if (b.name !== undefined) payload.name = String(b.name || '').trim();
  if (b.qty !== undefined) payload.qty = Number(b.qty || 0);
  if (b.cat_id !== undefined) payload.cat_id = Number(b.cat_id || 0) || null;
  if (b.supplier_id !== undefined) payload.supplier_id = Number(b.supplier_id || 0) || null;
  if (b.min_qty !== undefined) payload.min_qty = Number(b.min_qty || 0);
  if (b.price !== undefined) payload.price = Number(b.price || 0);
  if (b.unit !== undefined) payload.unit = String(b.unit || 'шт').trim() || 'шт';
  if (b.location !== undefined) payload.location = String(b.location || '').trim() || null;
  if (b.supplier !== undefined) payload.supplier = String(b.supplier || '').trim() || null;
  if (b.description !== undefined) payload.description = String(b.description || '').trim() || null;
  if (payload.name !== undefined && !payload.name) return res.status(400).json({ ok: false, error: 'Укажите название товара.' });
  const r = await supabaseTableRequest(`products?id=eq.${id}`, 'PATCH', payload);
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
});

app.delete('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: 'Некорректный id.' });
  const r = await supabaseTableRequest(`products?id=eq.${id}`, 'DELETE');
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true });
});

app.get('/api/categories', async (_req, res) => {
  const r = await supabaseTableRequest('categories?select=id,name,icon,color,created_at&order=id.asc', 'GET');
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true, items: Array.isArray(r.data) ? r.data : [] });
});

app.post('/api/categories', async (req, res) => {
  const b = req.body || {};
  const payload = {
    name: String(b.name || '').trim(),
    icon: String(b.icon || '').trim() || null,
    color: String(b.color || '').trim() || null,
  };
  if (!payload.name) return res.status(400).json({ ok: false, error: 'Укажите название категории.' });
  const r = await supabaseTableRequest('categories', 'POST', payload);
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.status(201).json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
});

app.delete('/api/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: 'Некорректный id.' });
  const r = await supabaseTableRequest(`categories?id=eq.${id}`, 'DELETE');
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true });
});

app.get('/api/suppliers', async (_req, res) => {
  const r = await supabaseTableRequest('suppliers?select=id,name,contact,phone,created_at&order=id.asc', 'GET');
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true, items: Array.isArray(r.data) ? r.data : [] });
});

app.post('/api/suppliers', async (req, res) => {
  const b = req.body || {};
  const payload = {
    name: String(b.name || '').trim(),
    contact: String(b.contact || '').trim() || null,
    phone: String(b.phone || '').trim() || null,
  };
  if (!payload.name) return res.status(400).json({ ok: false, error: 'Укажите название поставщика.' });
  const r = await supabaseTableRequest('suppliers', 'POST', payload);
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.status(201).json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
});

app.get('/api/orders', async (_req, res) => {
  const q = 'orders?select=id,client,product_id,qty,status,priority,address,note,created_at&order=id.asc';
  const r = await supabaseTableRequest(q, 'GET');
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true, items: Array.isArray(r.data) ? r.data : [] });
});

app.post('/api/orders', async (req, res) => {
  const b = req.body || {};
  const payload = {
    client: String(b.client || '').trim(),
    product_id: Number(b.product_id || 0),
    qty: Number(b.qty || 1),
    status: String(b.status || 'new').trim() || 'new',
    priority: String(b.priority || 'normal').trim() || 'normal',
    address: String(b.address || '').trim() || null,
    note: String(b.note || '').trim() || null,
  };
  if (!payload.client) return res.status(400).json({ ok: false, error: 'Укажите клиента.' });
  if (!Number.isFinite(payload.product_id) || payload.product_id <= 0) return res.status(400).json({ ok: false, error: 'Укажите товар.' });
  const r = await supabaseTableRequest('orders', 'POST', payload);
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.status(201).json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
});

app.patch('/api/orders/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: 'Некорректный id.' });
  const b = req.body || {};
  const payload = {};
  if (b.status !== undefined) payload.status = String(b.status || '').trim();
  if (b.priority !== undefined) payload.priority = String(b.priority || '').trim();
  if (b.address !== undefined) payload.address = String(b.address || '').trim() || null;
  if (b.note !== undefined) payload.note = String(b.note || '').trim() || null;
  if (b.qty !== undefined) payload.qty = Number(b.qty || 1);
  const r = await supabaseTableRequest(`orders?id=eq.${id}`, 'PATCH', payload);
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  return res.json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
});

app.get('/api/admin/staff', requireSupabaseAdmin, async (_req, res) => {
  const q = 'staff?select=user_id,role,active,created_at,profiles(email,full_name,username,phone,company)&order=created_at.desc';
  const r = await supabaseTableRequest(q, 'GET');
  if (!r.ok) return res.status(r.status || 500).json({ ok: false, error: r.error });
  const items = (Array.isArray(r.data) ? r.data : []).map(row => {
    const p = row.profiles || {};
    return {
      id: row.user_id,
      role: row.role,
      active: row.active,
      created_at: row.created_at,
      email: p.email,
      full_name: p.full_name,
      username: p.username,
      phone: p.phone,
      company: p.company,
    };
  });
  return res.json({ ok: true, items });
});

app.post('/api/admin/staff', requireSupabaseAdmin, async (req, res) => {
  const cfg = supabaseAdminConfig();
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const fullName = String(b.full_name || '').trim();
  const username = String(b.username || '').trim() || null;
  const phone = String(b.phone || '').trim() || null;
  const company = String(b.company || '').trim() || null;
  const roleRaw = String(b.role || 'worker').trim().toLowerCase();
  const role = (roleRaw === 'admin' || roleRaw === 'manager' || roleRaw === 'worker') ? roleRaw : 'worker';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Укажите корректный email.' });
  if (password.length < 8) return res.status(400).json({ ok: false, error: 'Пароль не короче 8 символов.' });
  if (fullName.length < 2) return res.status(400).json({ ok: false, error: 'Укажите имя.' });

  try {
    const resp = await fetch(`${cfg.baseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.secret, Authorization: `Bearer ${cfg.secret}` },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone, company, username, role }
      })
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = [body.msg, body.message, body.error_description, body.error].filter(Boolean).join(' ') || String(resp.status);
      return res.status(resp.status).json({ ok: false, error: msg });
    }
    const userId = body && body.id ? String(body.id) : null;
    if (!userId) return res.status(500).json({ ok: false, error: 'Не удалось получить id пользователя.' });
    const ins = await supabaseTableRequest('staff', 'POST', {
      user_id: userId,
      role,
      active: true,
      created_by: req._sbUser && req._sbUser.id ? req._sbUser.id : null,
    });
    if (!ins.ok) return res.status(ins.status || 500).json({ ok: false, error: ins.error });
    return res.status(201).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/admin/staff/:id/password', requireSupabaseAdmin, async (req, res) => {
  const cfg = supabaseAdminConfig();
  const userId = String(req.params.id || '').trim();
  const b = req.body || {};
  const password = String(b.password || '');
  if (password.length < 8) return res.status(400).json({ ok: false, error: 'Пароль не короче 8 символов.' });
  try {
    const resp = await fetch(`${cfg.baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: cfg.secret, Authorization: `Bearer ${cfg.secret}` },
      body: JSON.stringify({ password })
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = [body.msg, body.message, body.error_description, body.error].filter(Boolean).join(' ') || String(resp.status);
      return res.status(resp.status).json({ ok: false, error: msg });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  const body = req.body || {};
  const login = String(body.login || body.username || '').trim();
  const password = String(body.password || '');

  if (!login) return res.status(400).json({ ok: false, error: 'Укажите логин.' });
  if (!password) return res.status(400).json({ ok: false, error: 'Укажите пароль.' });

  try {
    let row = db.prepare("SELECT id, email, username, password_hash, full_name, company, phone, created_at FROM clients WHERE username = ? COLLATE NOCASE").get(login);
    if (!row) {
      const byEmail = String(login).trim().toLowerCase();
      if (byEmail.includes('@')) {
        row = db.prepare("SELECT id, email, username, password_hash, full_name, company, phone, created_at FROM clients WHERE lower(email) = ?").get(byEmail);
      }
    }
    if (!row) {
      return res.status(401).json({ ok: false, error: 'Пользователь не найден.' });
    }
    const valid = bcrypt.compareSync(password, row.password_hash);
    if (!valid) return res.status(401).json({ ok: false, error: 'Неверный пароль.' });

    let sb = { created: false, skipped: true };
    try {
      sb = await syncUserToSupabase({
        email: row.email,
        password,
        fullName: row.full_name,
        company: row.company,
        phone: row.phone,
        username: row.username,
      });
    } catch (e) {}

    const user = {
      id: row.id,
      email: row.email,
      username: row.username,
      full_name: row.full_name,
      company: row.company,
      phone: row.phone,
      created_at: row.created_at,
    };
    return res.json({
      ok: true,
      user,
      supabase_user: sb.created === true,
      supabase_env_missing: sb.skipped === true,
      supabase_duplicate: sb.duplicate === true,
    });
  } catch (e) {
    console.error('Login error', e);
    return res.status(500).json({ ok: false, error: 'Ошибка сервера при входе.' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Клиентский сайт: http://localhost:${PORT}/index.html`);
  console.log(`Панель склада:    http://localhost:${PORT}/admin.html`);
  console.log(`БД клиентов:      ${DB_PATH}`);
  const hasSb = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  console.log(hasSb ? 'Supabase Admin: включён (регистрация дублируется в Auth из сервера).' : 'Supabase Admin: выключен (в .env задайте SUPABASE_URL и SUPABASE_SECRET_KEY).');
});
