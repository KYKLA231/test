const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

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

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.post('/api/register', (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.full_name || '').trim();
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

  try {
    const stmt = db.prepare(
      `INSERT INTO clients (email, password_hash, full_name, company, phone)
       VALUES (@email, @password_hash, @full_name, @company, @phone)`
    );
    stmt.run({
      email,
      password_hash: passwordHash,
      full_name: fullName,
      company,
      phone,
    });
    return res.status(201).json({
      ok: true,
      message: 'Регистрация прошла успешно. Мы свяжемся с вами по email.',
    });
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ ok: false, error: 'Этот email уже зарегистрирован.' });
    }
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Ошибка сервера. Попробуйте позже.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sklad-pro-clients' });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Клиентский сайт: http://localhost:${PORT}/index.html`);
  console.log(`Панель склада:    http://localhost:${PORT}/admin.html`);
  console.log(`БД клиентов:      ${DB_PATH}`);
});
