/* ============================================================
   SmartPlan — главный сервер (Express + PostgreSQL)
   ------------------------------------------------------------
   Сборка 22.09-25: миграция на Render.com + PostgreSQL.
   Эндпоинты:
   · POST /api/auth/login        — вход (login/password), выдаёт sessionToken
   · POST /api/auth/logout       — выход
   · GET  /api/me                — текущий пользователь (по токену)
   · GET  /api/<section>         — список всех записей раздела
   · GET  /api/<section>/:id     — одна запись
   · POST /api/<section>         — создать
   · PUT  /api/<section>/:id     — обновить (с проверкой updated_at)
   · DELETE /api/<section>/:id   — удалить
   · GET  /api/sync?since=<ts>   — изменения всех разделов после <ts>
   · GET  /api/audit             — журнал действий (с пагинацией)
   · GET  /healthz               — health-check для Render
   ============================================================ */
'use strict';

// dotenv — опционально (на Render переменные окружения задаются через UI)
try { require('dotenv').config(); } catch (e) { /* не установлен — не критично */ }

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');

const { initSchema } = require('./migrations/init');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const auditRoutes = require('./routes/audit');
const sectionRoutes = require('./routes/section');
const { requireAuth } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не задан. Установите переменную окружения.');
  if (!process.env.RENDER) process.exit(1);
}

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.RENDER
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('⚠ Ошибка пула соединений:', err.message);
});

// Express
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('tiny'));

// Health-check (для Render)
app.get('/healthz', (req, res) => {
  pool.query('SELECT 1')
    .then(() => res.json({ ok: true, ts: Date.now() }))
    .catch((e) => res.status(503).json({ ok: false, err: e.message }));
});

// Инициализация схемы БД (создаёт таблицы, если их нет).
// При ошибке соединения — НЕ убиваем процесс: ретраим каждые 10 сек.
function initWithRetry() {
  initSchema(pool)
    .then(() => console.log('✅ БД готова'))
    .catch((e) => {
      console.error('❌ Ошибка инициализации БД (ретрай через 10 сек):', e.message);
      setTimeout(initWithRetry, 10000);
    });
}
initWithRetry();

// Роуты
app.use('/api/auth', authRoutes(pool));
app.use('/api/sync', requireAuth, syncRoutes(pool));
app.use('/api/audit', requireAuth, auditRoutes(pool));
// Универсальный роутинг для разделов
const SECTIONS = ['objects', 'tasks', 'users', 'areas', 'workers', 'work_catalog', 'graphs'];
SECTIONS.forEach((s) => {
  app.use(`/api/${s}`, requireAuth, sectionRoutes(pool, s));
});

// SPA fallback: всё, что не /api, отдаём index.html
const FRONTEND_DIR = process.env.NODE_ENV === 'production' ? '/app' : require('path').join(__dirname, '..');
app.use(express.static(FRONTEND_DIR, { maxAge: '1h' }));
app.get(/^\/(?!api|healthz).*/, (req, res) => {
  res.sendFile(require('path').join(FRONTEND_DIR, 'index.html'));
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('UNHANDLED', err);
  res.status(500).json({ ok: false, err: err.message || 'server error' });
});

app.listen(PORT, () => {
  console.log(`✅ SmartPlan сервер запущен на порту ${PORT}`);
});