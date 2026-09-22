/* ============================================================
   SmartPlan — инициализация схемы PostgreSQL
   ------------------------------------------------------------
   Все таблицы создаются с IF NOT EXISTS — безопасно для повторных
   вызовов. Колонка `data JSONB` хранит полный объект записи
   (как в текущем localStorage). Колонка `updated_at TIMESTAMPTZ`
   используется для real-time синхронизации (polling /api/sync).
   ============================================================ */
'use strict';

const SECTIONS = [
  { name: 'objects',      schema: 3, label: 'объекты' },
  { name: 'tasks',        schema: 3, label: 'задачи' },
  { name: 'users',        schema: 3, label: 'пользователи' },
  { name: 'areas',        schema: 1, label: 'участки' },
  { name: 'workers',      schema: 1, label: 'работники' },
  { name: 'work_catalog', schema: 5, label: 'виды работ' },
  { name: 'graphs',       schema: 1, label: 'графики' }
];

async function initSchema(pool) {
  const client = await pool.connect();
  try {
    // 1. Users — отдельная таблица с фиксированными колонками для безопасности
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        login       TEXT UNIQUE NOT NULL,
        full_name   TEXT NOT NULL,
        role        TEXT NOT NULL,
        prof        TEXT,
        active      BOOLEAN DEFAULT TRUE,
        password_hash TEXT NOT NULL,
        data        JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_updated ON users(updated_at)`);

    // 2. Универсальные таблицы для остальных разделов
    for (const s of SECTIONS) {
      if (s.name === 'users') continue;
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${s.name} (
          id          TEXT PRIMARY KEY,
          data        JSONB NOT NULL,
          deleted     BOOLEAN NOT NULL DEFAULT FALSE,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${s.name}_updated ON ${s.name}(updated_at) WHERE NOT deleted`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${s.name}_deleted ON ${s.name}(deleted, updated_at)`);
    }

    // 3. Audit log — журнал действий
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          BIGSERIAL PRIMARY KEY,
        ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id     TEXT,
        user_login  TEXT,
        user_name   TEXT,
        section     TEXT NOT NULL,
        action      TEXT NOT NULL,
        object_id   TEXT,
        details     TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC)`);

    // 4. Sessions — простая таблица токенов (без JWT, чтобы не возиться)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token       TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);

    console.log(`✅ Схема БД: создано ${SECTIONS.length + 3} таблиц`);
  } finally {
    client.release();
  }
}

module.exports = { initSchema, SECTIONS };