const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

/** Простая подгрузка .env без пакета dotenv (не коммитьте .env с секретами). */
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

// Ensure `username` column exists (migration for existing DBs)
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

/**
 * Создаёт пользователя в Supabase Auth через Admin API (секретный ключ — только на сервере).
 * Обходит клиентский rate limit на /auth/v1/signup.
 */
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

app.post('/api/register', async (req, res) => {
  const body = req.body || {};
  console.log('[/api/register] payload received:', body);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.full_name || '').trim();
  // Accept either `username` or `login` from client payload
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
    // If username not provided, generate one from email prefix and ensure uniqueness
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
    });
  } catch (e) {
    // If unique constraint error, try to handle gracefully: if the email exists but has no username
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      try {
        const errDetail = String(e.message || '');
        const failedOnUsername = /clients\.username/i.test(errDetail);

        if (failedOnUsername) {
          return res.status(409).json({ ok: false, error: 'Этот логин уже занят. Укажите другой логин.' });
        }

        const existing = db.prepare('SELECT id, username FROM clients WHERE email = ?').get(email);
        if (existing) {
          // If existing record has no username and client provided one, update it
          if ((!existing.username || String(existing.username).trim() === '') && username) {
            try {
              db.prepare('UPDATE clients SET username = ? WHERE id = ?').run(username, existing.id);
              return res.status(200).json({ ok: true, message: 'Существующая запись обновлена: логин сохранён.' });
            } catch (ue) {
              if (ue && ue.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(409).json({ ok: false, error: 'Этот логин уже занят.' });
              }
              console.error('Username update failed', ue);
              return res.status(500).json({ ok: false, error: 'Ошибка сервера при обновлении логина.' });
            }
          }
          return res.status(409).json({ ok: false, error: 'Этот email уже зарегистрирован.' });
        }

        if (attemptedUsername) {
          const rowByLogin = db.prepare('SELECT email FROM clients WHERE username = ? COLLATE NOCASE').get(attemptedUsername);
          if (rowByLogin) {
            return res.status(409).json({ ok: false, error: 'Этот логин уже занят. Укажите другой логин.' });
          }
        }
        return res.status(409).json({ ok: false, error: 'Такой email или логин уже используется.' });
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

// Login via username (not email) — verifies password against stored hash
app.post('/api/login', (req, res) => {
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

    // Successful login — return minimal user info (no password)
    const user = {
      id: row.id,
      email: row.email,
      username: row.username,
      full_name: row.full_name,
      company: row.company,
      phone: row.phone,
      created_at: row.created_at,
    };
    return res.json({ ok: true, user });
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
