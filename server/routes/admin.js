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
      // ВАЖНО: ON CONFLICT (login) DO UPDATE не сбрасывает deleted=TRUE.
      // Поэтому сначала «оживляем» возможно soft-deleted записи
      // (UPDATE сбрасывает deleted в FALSE), а потом делаем INSERT.
      // Если конфликта нет — INSERT создаст новую запись.
      const results = [];
      for (const u of DEFAULT_USERS) {
        const hash = await bcrypt.hash(u.password, 10);
        // Шаг 1: если есть запись с таким login (даже soft-deleted) — обновить
        //         пароль и сбросить deleted
        const upd = await pool.query(
          `UPDATE users
              SET id = $1,
                  full_name = $3,
                  role = $4,
                  prof = $5,
                  password_hash = $6,
                  deleted = FALSE,
                  updated_at = NOW()
            WHERE login = $2
            RETURNING id, login`,
          [u.id, u.login, u.full_name, u.role, u.prof, hash]
        );
        if (upd.rows.length > 0) {
          results.push({ id: upd.rows[0].id, login: upd.rows[0].login, restored: true });
          continue;
        }
        // Шаг 2: если нет — вставить
        try {
          const r = await pool.query(
            `INSERT INTO users (id, login, full_name, role, prof, password_hash)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, login`,
            [u.id, u.login, u.full_name, u.role, u.prof, hash]
          );
          results.push({ id: r.rows[0].id, login: r.rows[0].login, created: true });
        } catch (e) {
          // Может возникнуть конфликт по PRIMARY KEY (id), если раньше у master
          // был другой login. В этом случае — UPDATE по id.
          if (e.code === '23505') {
            const upd2 = await pool.query(
              `UPDATE users
                  SET login = $2,
                      full_name = $3,
                      role = $4,
                      prof = $5,
                      password_hash = $6,
                      deleted = FALSE,
                      updated_at = NOW()
                WHERE id = $1
                RETURNING id, login`,
              [u.id, u.login, u.full_name, u.role, u.prof, hash]
            );
            results.push({ id: upd2.rows[0].id, login: upd2.rows[0].login, fixed: true });
          } else {
            throw e;
          }
        }
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

  // POST /api/admin/migrate — применить миграции (добавление недостающих колонок)
  router.post('/migrate', async (req, res) => {
    try {
      const migrations = [];
      // 1. Добавляем колонку deleted в users если её нет
      const checkR = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'deleted'
      `);
      if (checkR.rows.length === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted, updated_at)`);
        migrations.push('ALTER TABLE users ADD COLUMN deleted');
      }
      // 2. Перезапускаем initSchema — он пересоздаст недостающие индексы
      await initSchema(pool);
      migrations.push('initSchema re-run (idempotent)');

      res.json({ ok: true, message: '✅ Миграция применена', migrations });
    } catch (e) {
      console.error('migrate error', e);
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};