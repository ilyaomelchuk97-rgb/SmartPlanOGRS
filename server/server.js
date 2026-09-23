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
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');
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
// После успешной инициализации схемы — сразу создаём стандартных
// пользователей (если их ещё нет). Это бесплатная альтернатива Shell.
function initWithRetry() {
  initSchema(pool)
    .then(async () => {
      console.log('✅ БД готова');
      // Автосидинг пользователей — бесплатно, без Shell
      try {
        const bcrypt = require('bcrypt');
        const DEFAULT_USERS = [
          { id: 'u_admin',  login: 'admin',  full_name: 'Администратор',             role: 'admin',  prof: 'Администратор',     password: 'admin123' },
          { id: 'u_seogs',  login: 'seogs',  full_name: 'Начальник СЭОГС',          role: 'seogs',  prof: 'СЭОГС — просмотр', password: 'seogs123' },
          { id: 'u_master', login: 'master', full_name: 'Иванов Сергей Петрович',  role: 'master', prof: 'Мастер',            password: 'master123' },
          { id: 'u_slesar', login: 'slesar', full_name: 'Петров Алексей Николаевич',role: 'slesar', prof: 'Слесарь',           password: 'slesar123' }
        ];
        const r = await pool.query('SELECT COUNT(*) as cnt FROM users');
        const haveUsers = parseInt(r.rows[0].cnt, 10) > 0;
        if (!haveUsers) {
          for (const u of DEFAULT_USERS) {
            const hash = await bcrypt.hash(u.password, 10);
            await pool.query(
              `INSERT INTO users (id, login, full_name, role, prof, password_hash)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (login) DO NOTHING`,
              [u.id, u.login, u.full_name, u.role, u.prof, hash]
            );
          }
          console.log('✅ Стандартные пользователи созданы: admin, seogs, master, slesar');
        } else {
          console.log(`ℹ️ Пользователей уже ${r.rows[0].cnt} — пропускаем seed`);
        }
      } catch (e) {
        console.error('⚠ Ошибка автоseed пользователей:', e.message);
      }
    })
    .catch((e) => {
      console.error('❌ Ошибка инициализации БД (ретрай через 10 сек):', e.message);
      setTimeout(initWithRetry, 10000);
    });
}
initWithRetry();

// Роуты
app.use('/api/auth', authRoutes(pool));
app.use('/api/admin', adminRoutes(pool, initSchema));  // без авторизации — для первоначальной настройки
app.use('/api/sync', requireAuth, syncRoutes(pool));
app.use('/api/audit', requireAuth, auditRoutes(pool));
// Специальный роут для users (специальная таблица с фиксированными колонками)
app.use('/api/users', requireAuth, usersRoutes(pool));
// Универсальный роутинг для остальных разделов
const SECTIONS = ['objects', 'tasks', 'areas', 'workers', 'work_catalog', 'graphs'];
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