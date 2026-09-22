/* ============================================================
   SmartPlan — первоначальный seed БД
   ------------------------------------------------------------
   Запуск: `node migrations/run.js [--with-defaults]`
   Создаёт 4 стандартных пользователей (admin/master/slesar/seogs)
   если их нет. Все остальные данные загружаются из localStorage
   браузера (см. /api/admin/import-from-storage в API).
   ============================================================ */
'use strict';

const bcrypt = require('bcrypt');
const { getPool } = require('../lib/db');
const { initSchema } = require('./init');

const DEFAULT_USERS = [
  { id: 'u_admin', login: 'admin',  full_name: 'Администратор',  role: 'admin',  prof: 'Администратор',  password: 'admin123' },
  { id: 'u_seogs', login: 'seogs',  full_name: 'Начальник СЭОГС', role: 'seogs', prof: 'СЭОГС — просмотр', password: 'seogs123' },
  { id: 'u_master', login: 'master', full_name: 'Иванов Сергей Петрович', role: 'master', prof: 'Мастер', password: 'master123' },
  { id: 'u_slesar', login: 'slesar', full_name: 'Петров Алексей Николаевич', role: 'slesar', prof: 'Слесарь', password: 'slesar123' }
];

async function main() {
  const pool = getPool();
  await initSchema(pool);
  console.log('✅ Схема БД готова');

  for (const u of DEFAULT_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const r = await pool.query(
      `INSERT INTO users (id, login, full_name, role, prof, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (login) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, prof = EXCLUDED.prof, password_hash = EXCLUDED.password_hash
       RETURNING id, login`,
      [u.id, u.login, u.full_name, u.role, u.prof, hash]
    );
    console.log('  👤', r.rows[0].login);
  }

  console.log('✅ Стандартные пользователи созданы/обновлены');
  console.log('');
  console.log('Логины и пароли:');
  DEFAULT_USERS.forEach((u) => console.log(`  ${u.login} / ${u.password}`));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });