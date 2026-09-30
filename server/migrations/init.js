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
  { name: 'holidays',     schema: 1, label: 'праздники' },
  { name: 'telemetry',    schema: 1, label: 'виды телеметрии' }
];

// Нерабочие праздничные дни Республики Беларусь (БЕЗ ГОДА — месяц-день, 22.09-110):
// праздник ежегодный, год не хранится. Источник — календарь Минтруда РБ (Указ № 157).
// Радуница — переходящая (нет фиксированной даты): храним 21.04 (верно для 2026),
// на следующие годы её переносят вручную по постановлению Минтруда.
const BY_HOLIDAYS = [
  ['01-01', 'Новый год'], ['01-02', 'Новый год'],
  ['01-07', 'Рождество Христово (православное)'],
  ['03-08', 'День женщин'],
  ['04-21', 'Радуница'],
  ['05-01', 'Праздник труда'],
  ['05-09', 'День Победы'],
  ['07-03', 'День Независимости Республики Беларусь'],
  ['11-07', 'День Октябрьской революции'],
  ['12-25', 'Рождество Христово (католическое)']
];

// Канонизация записей праздников к виду «ММ-ДД» (без года) с дедупликацией.
// rows — записи из таблицы [{id, data:{date,name}, deleted}] любого старого формата.
// Живая запись для даты важнее удалённой (пользовательское удаление сохраняется).
function canonicalHolidays(rows) {
  const byMd = new Map();
  for (const r of rows) {
    const d = (r.data && r.data.date) || '';
    const md = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(5) : (/^\d{2}-\d{2}$/.test(d) ? d : null);
    if (!md) continue; // мусор не переносим
    const name = (r.data && r.data.name) || 'Праздник';
    const cur = byMd.get(md);
    if (!cur) byMd.set(md, { date: md, name, deleted: !!r.deleted });
    else if (cur.deleted && !r.deleted) byMd.set(md, { date: md, name, deleted: false });
  }
  // Радуница: «11.05» был только про 2027-й — убираем, остаётся «21.04»
  const r511 = byMd.get('05-11');
  if (r511 && /Радуниц/i.test(r511.name) && byMd.get('04-21')) byMd.delete('05-11');
  return [...byMd.values()].map((x) => ({ id: 'h_' + x.date, date: x.date, name: x.name, deleted: x.deleted }));
}

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

    // 2.1. Праздники РБ — нормализация к «ММ-ДД» + дедупликация + досид (22.09-110).
    // Полная перезапись ставит всем updated_at=NOW() → клиенты подтянут свежий список.
    // Удалённые пользователем даты (deleted=true) НЕ воскрешаем.
    try {
      const all = await client.query(`SELECT id, data, deleted FROM holidays`);
      if (all.rows.length) {
        const canon = canonicalHolidays(all.rows);
        await client.query(`DELETE FROM holidays`);
        for (const rec of canon) {
          await client.query(
            `INSERT INTO holidays (id, data, deleted) VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, deleted = EXCLUDED.deleted`,
            [rec.id, JSON.stringify({ id: rec.id, date: rec.date, name: rec.name }), rec.deleted]
          );
        }
        console.log(`✅ Праздники нормализованы к «ММ-ДД»: ${canon.length} дат`);
      }
      const have = new Set((await client.query(`SELECT id FROM holidays`)).rows.map((r) => r.id));
      let added = 0;
      for (const [md, name] of BY_HOLIDAYS) {
        if (have.has('h_' + md)) continue;
        await client.query(
          `INSERT INTO holidays (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          ['h_' + md, JSON.stringify({ id: 'h_' + md, date: md, name })]
        );
        added++;
      }
      if (added) console.log(`✅ Праздники РБ: досеяно ${added} дат`);
    } catch (e) {
      console.error('Миграция праздников пропущена:', e.message);
    }

    // 2.2. Виды телеметрии — сид первого вида «Индел», если таблица пуста (22.09-111)
    try {
      const ct = await client.query(`SELECT COUNT(*)::int AS c FROM telemetry`);
      if (ct.rows[0].c === 0) {
        await client.query(`INSERT INTO telemetry (id, data) VALUES ('tt_indel', $1) ON CONFLICT (id) DO NOTHING`,
          [JSON.stringify({ id: 'tt_indel', name: 'Индел' })]);
        console.log('✅ Телеметрия: засеян вид «Индел»');
      }
    } catch (e) {
      console.error('Сид телеметрии пропущен:', e.message);
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

module.exports = { initSchema, SECTIONS, BY_HOLIDAYS, canonicalHolidays };