/* ============================================================
   SmartPlan — роут для пользователей (специальная таблица с
   фиксированными колонками login/full_name/role/password_hash)
   ------------------------------------------------------------
   В отличие от универсального роута, здесь мы разбираем JSON
   на отдельные колонки таблицы.

   POST   /api/users         — создать/обновить пользователя
   PUT    /api/users/:id     — обновить (с паролем или без)
   DELETE /api/users/:id     — soft-delete
   GET    /api/users         — список
   GET    /api/users/:id     — один
   ============================================================ */
'use strict';

module.exports = function (pool) {
  const router = require('express').Router();
  const { log } = require('../lib/audit');
  const bcrypt = require('bcrypt');

  // GET /api/users
  router.get('/', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, login, full_name, role, prof, active, data, password_hash IS NOT NULL as has_password, updated_at
           FROM users
          WHERE deleted = FALSE
          ORDER BY login`
      );
      res.json({
        ok: true,
        records: r.rows.map((row) => ({
          id: row.id,
          login: row.login,
          full_name: row.full_name,
          role: row.role,
          prof: row.prof,
          active: row.active,
          has_password: row.has_password,
          ...row.data,
          _deleted: false,
          _updated_at: new Date(row.updated_at).getTime()
        }))
      });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // GET /api/users/:id
  router.get('/:id', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, login, full_name, role, prof, active, data, password_hash IS NOT NULL as has_password, updated_at
           FROM users WHERE id = $1 AND deleted = FALSE`,
        [req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ ok: false, err: 'не найдено' });
      const row = r.rows[0];
      res.json({
        ok: true,
        record: {
          id: row.id, login: row.login, full_name: row.full_name, role: row.role,
          prof: row.prof, active: row.active, has_password: row.has_password,
          ...row.data, _deleted: false, _updated_at: new Date(row.updated_at).getTime()
        }
      });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // POST /api/users — создать/обновить пользователя
  router.post('/', async (req, res) => {
    try {
      const body = req.body || {};
      const data = body.data || body;
      const id = data.id || body.id;
      if (!id) return res.status(400).json({ ok: false, err: 'нет id' });

      const login = (data.login || '').trim();
      const full_name = (data.full_name || '').trim();
      const role = (data.role || 'master').trim();
      const prof = data.prof || null;
      const area = data.area || null;
      const color = data.color || null;
      const active = data.active !== false;

      if (!login) return res.status(400).json({ ok: false, err: 'нет login' });
      if (!full_name) return res.status(400).json({ ok: false, err: 'нет full_name' });

      // Если передан plain_password — хэшируем bcrypt.
      // Если ничего не передано — генерируем дефолтный пароль 'changeme'
      // (чтобы не падать с NOT NULL на password_hash).
      let password_hash;
      if (data.plain_password) {
        password_hash = await bcrypt.hash(String(data.plain_password), 10);
      } else if (data.password_hash) {
        password_hash = data.password_hash;
      } else {
        // Проверяем — может это UPDATE (запись уже есть)?
        const cur = await pool.query('SELECT 1 FROM users WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          password_hash = await bcrypt.hash('changeme', 10);
        }
        // Иначе оставим password_hash undefined → UPDATE не тронет password_hash
      }

      let r;
      if (password_hash) {
        r = await pool.query(
          `INSERT INTO users (id, login, full_name, role, prof, active, password_hash, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             login = EXCLUDED.login,
             full_name = EXCLUDED.full_name,
             role = EXCLUDED.role,
             prof = EXCLUDED.prof,
             active = EXCLUDED.active,
             password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
             data = EXCLUDED.data,
             deleted = FALSE,
             updated_at = NOW()
           RETURNING id, login, full_name, role, prof, active, updated_at`,
          [id, login, full_name, role, prof, active, password_hash, stripUnsafeData(data)]
        );
      } else {
        r = await pool.query(
          `INSERT INTO users (id, login, full_name, role, prof, active, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             login = EXCLUDED.login,
             full_name = EXCLUDED.full_name,
             role = EXCLUDED.role,
             prof = EXCLUDED.prof,
             active = EXCLUDED.active,
             data = EXCLUDED.data,
             deleted = FALSE,
             updated_at = NOW()
           RETURNING id, login, full_name, role, prof, active, updated_at`,
          [id, login, full_name, role, prof, active, stripUnsafeData(data)]
        );
      }

      await log(pool, { user: req.user, section: 'users', action: 'upsert', objectId: id, details: full_name + ' (' + login + ')' });
      const row = r.rows[0];
      res.json({
        ok: true,
        record: {
          id: row.id, login: row.login, full_name: row.full_name, role: row.role,
          prof: row.prof, active: row.active,
          _deleted: false, _updated_at: Date.now()
        }
      });
    } catch (e) {
      console.error('POST /api/users error:', e.message);
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // PUT /api/users/:id — обновить (опционально с новым паролем)
  router.put('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body || {};
      const data = body.data || body;
      let r;
      if (data.plain_password) {
        const password_hash = await bcrypt.hash(String(data.plain_password), 10);
        r = await pool.query(
          `UPDATE users SET
             login = COALESCE($2, login),
             full_name = COALESCE($3, full_name),
             role = COALESCE($4, role),
             prof = $5,
             active = COALESCE($6, active),
             password_hash = $7,
             data = $8,
             deleted = FALSE,
             updated_at = NOW()
           WHERE id = $1
           RETURNING id, login, full_name, role, prof, active, updated_at`,
          [id, data.login, data.full_name, data.role, data.prof, data.active, password_hash, stripUnsafeData(data)]
        );
      } else {
        r = await pool.query(
          `UPDATE users SET
             login = COALESCE($2, login),
             full_name = COALESCE($3, full_name),
             role = COALESCE($4, role),
             prof = $5,
             active = COALESCE($6, active),
             data = $7,
             deleted = FALSE,
             updated_at = NOW()
           WHERE id = $1
           RETURNING id, login, full_name, role, prof, active, updated_at`,
          [id, data.login, data.full_name, data.role, data.prof, data.active, stripUnsafeData(data)]
        );
      }
      if (r.rows.length === 0) return res.status(404).json({ ok: false, err: 'не найдено' });
      await log(pool, { user: req.user, section: 'users', action: 'update', objectId: id, details: data.full_name || id });
      res.json({ ok: true, record: r.rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // DELETE /api/users/:id — soft-delete
  router.delete('/:id', async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE users SET deleted = TRUE, updated_at = NOW() WHERE id = $1
         RETURNING id, login, full_name`,
        [req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ ok: false, err: 'не найдено' });
      await log(pool, { user: req.user, section: 'users', action: 'delete', objectId: req.params.id, details: r.rows[0].full_name });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // Удалить из data чувствительные/избыточные поля, которые хранятся
  // в отдельных колонках (login, full_name, role, prof, active).
  function stripUnsafeData(d) {
    var out = {};
    for (var k in d) {
      if (!d.hasOwnProperty(k)) continue;
      if (['id','login','full_name','role','prof','active','password','plain_password','password_hash'].indexOf(k) >= 0) continue;
      out[k] = d[k];
    }
    return out;
  }

  return router;
};