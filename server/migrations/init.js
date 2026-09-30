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
  { name: 'graphs',       schema: 1, label: 'графики' },
  { name: 'professions',  schema: 1, label: 'профессии' },
  { name: 'holidays',     schema: 1, label: 'праздники' }
];

// Нерабочие праздничные дни Республики Беларусь (22.09-109).
// Источник: производственный календарь Минтруда РБ на 2026 г. (Указ № 157):
// 1–2.01 Новый год; 7.01 прав. Рождество; 8.03 День женщин; 21.04.2026 Радуница;
// 1.05 Праздник труда; 9.05 День Победы; 3.07 День Независимости; 7.11 День
// Октябрьской революции; 25.12 кат. Рождество.
// Радуница переходящая: 2026 → 21 апреля, 2027 → 11 мая (Пасха 02.05.2027 + 9 дней).
const BY_HOLIDAYS = [
  ['2026-01-01', 'Новый год'], ['2026-01-02', 'Новый год'],
  ['2026-01-07', 'Рождество Христово (православное)'],
  ['2026-03-08', 'День женщин'],
  ['2026-04-21', 'Радуница'],
  ['2026-05-01', 'Праздник труда'],
  ['2026-05-09', 'День Победы'],
  ['2026-07-03', 'День Независимости Республики Беларусь'],
  ['2026-11-07', 'День Октябрьской революции'],
  ['2026-12-25', 'Рождество Христово (католическое)'],
  ['2027-01-01', 'Новый год'], ['2027-01-02', 'Новый год'],
  ['2027-01-07', 'Рождество Христово (православное)'],
  ['2027-03-08', 'День женщин'],
  ['2027-05-01', 'Праздник труда'],
  ['2027-05-09', 'День Победы'],
  ['2027-05-11', 'Радуница'],
  ['2027-07-03', 'День Независимости Республики Беларусь'],
  ['2027-11-07', 'День Октябрьской революции'],
  ['2027-12-25', 'Рождество Христово (католическое)']
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
        deleted     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Миграция: если таблица users уже создана без колонки deleted — добавляем
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'deleted'
        ) THEN
          ALTER TABLE users ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
          CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted, updated_at);
        END IF;
      END$$;
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

    // 2.1. Праздники РБ — сидим один раз, только если таблица пуста (22.09-109).
    // Удалённые пользователем записи (deleted=true) считаются → повторно не засеиваем.
    try {
      const ch = await client.query(`SELECT COUNT(*)::int AS c FROM holidays`);
      if (ch.rows[0].c === 0) {
        for (const [date, name] of BY_HOLIDAYS) {
          await client.query(
            `INSERT INTO holidays (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
            ['h_' + date, JSON.stringify({ id: 'h_' + date, date, name })]
          );
        }
        console.log(`✅ Праздники РБ: засеяно ${BY_HOLIDAYS.length} дат (2026–2027)`);
      }
    } catch (e) {
      console.error('Сид праздников пропущен:', e.message);
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

module.exports = { initSchema, SECTIONS, BY_HOLIDAYS };