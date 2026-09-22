/* ============================================================
   SmartPlan — admin-роуты (без авторизации, для первоначальной настройки)
   ------------------------------------------------------------
   Эти эндпоинты доступны БЕЗ токена — они нужны ТОЛЬКО для
   первоначальной инициализации БД через обычный браузер или curl.

   · POST /api/admin/init-db — создать таблицы + 4 стандартных пользователя
   · GET  /api/admin/status   — состояние БД (можно ли войти)
   · POST /api/admin/reset-users — пересоздать пользователей (если забыли пароль)

   ⚠️ На production-сервере желательно отключить или защитить секретом.
   Сейчас оставлено открытым для простоты первоначального деплоя.
   ============================================================ */
'use strict';

const bcrypt = require('bcrypt');

const DEFAULT_USERS = [
  { id: 'u_admin',  login: 'admin',  full_name: 'Администратор',         role: 'admin',  prof: 'Администратор',         password: 'admin123' },
  { id: 'u_seogs',  login: 'seogs',  full_name: 'Начальник СЭОГС',       role: 'seogs',  prof: 'СЭОГС — просмотр',     password: 'seogs123' },
  { id: 'u_master', login: 'master', full_name: 'Иванов Сергей Петрович', role: 'master', prof: 'Мастер',                password: 'master123' },
  { id: 'u_slesar', login: 'slesar', full_name: 'Петров Алексей Николаевич', role: 'slesar', prof: 'Слесарь',         password: 'slesar123' }
];

module.exports = function (pool, initSchema) {
  const router = require('express').Router();
  const { log } = require('../lib/audit');

  // GET /api/admin/status — без токена, можно дёрнуть из браузера
  router.get('/status', async (req, res) => {
    try {
      const r = await pool.query('SELECT COUNT(*) as cnt FROM users');
      const cnt = parseInt(r.rows[0].cnt, 10);
      res.json({
        ok: true,
        users: cnt,
        ready: cnt >= 4,
        logins: DEFAULT_USERS.map(u => u.login)
      });
    } catch (e) {
      res.status(503).json({ ok: false, err: e.message });
    }
  });

  // POST /api/admin/init-db — создать таблицы + пользователей (без токена!)
  router.post('/init-db', async (req, res) => {
    try {
      // 1) Создать таблицы (если ещё нет)
      await initSchema(pool);

      // 2) Создать пользователей
      const results = [];
      for (const u of DEFAULT_USERS) {
        const hash = await bcrypt.hash(u.password, 10);
        const r = await pool.query(
          `INSERT INTO users (id, login, full_name, role, prof, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (login) DO UPDATE SET
             full_name = EXCLUDED.full_name,
             role = EXCLUDED.role,
             prof = EXCLUDED.prof,
             password_hash = EXCLUDED.password_hash
           RETURNING id, login`,
          [u.id, u.login, u.full_name, u.role, u.prof, hash]
        );
        results.push({ id: r.rows[0].id, login: r.rows[0].login });
      }

      // 3) Audit
      await log(pool, { user: { login: 'admin-setup' }, section: 'admin', action: 'init_db', details: 'initial seed' });

      res.json({
        ok: true,
        message: '✅ БД инициализирована',
        users_created: results,
        logins: DEFAULT_USERS.map(u => ({ login: u.login, password: u.password }))
      });
    } catch (e) {
      console.error('init-db error', e);
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};