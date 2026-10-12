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

  // 22.09-258: табельный номер уникален — занять номер другого работника нельзя
  // (даже если тот уволен: по номеру в будущем отслеживаются действия, дубли сломали бы учёт).
  // Возвращает null, если номер свободен; иначе — текстовую ошибку.
  async function tableNumberConflict(id, tnum) {
    if (!tnum) return null;
    const r = await pool.query(`SELECT full_name, deleted FROM users WHERE data->>'table_number' = $1 AND id <> $2 LIMIT 1`, [tnum, id]);
    if (!r.rows.length) return null;
    const row = r.rows[0];
    return 'табельный номер ' + tnum + ' уже занят: ' + row.full_name + (row.deleted ? ' (уволен)' : '');
  }

  // POST /api/users — создать/обновить пользователя
  router.post('/', async (req, res) => {
    try {
      const tnum = String((req.body && (req.body.data || req.body)).table_number != null ? (req.body && (req.body.data || req.body)).table_number : '').replace(/\D/g, '');
      if (tnum) {
        const tconf = await tableNumberConflict(String((req.body && (req.body.data || req.body)).id || ''), tnum);
        if (tconf) return res.status(409).json({ ok: false, conflict: true, err: tconf });
      }
      const body = req.body || {};
      const data = body.data || body;
      const id = data.id || body.id;
      if (!id) return res.status(400).json({ ok: false, err: 'нет id' });
      // 22.09-241: пароль может задать только администратор (или сам пользователь — себе)
      if (data.plain_password && !(req.user && (req.user.role === 'admin' || req.user.id === id))) {
        return res.status(403).json({ ok: false, err: 'менять пароль может только администратор' });
      }

      const login = (data.login || '').trim();
      const full_name = (data.full_name || '').trim();
      const role = (data.role || 'master').trim();
      const prof = data.prof || null;
      const area = data.area || null;
      const color = data.color || null;
      const active = data.active !== false;

      if (!login) return res.status(400).json({ ok: false, err: 'нет login' });
      if (!full_name) return res.status(400).json({ ok: false, err: 'нет full_name' });

      // 22.09-254: защита от затирания свежих данных старой копией (как у остальных разделов):
      // base — updated_at версии, на которой основано изменение. Смена пароля проходит всегда.
      const base = (typeof body.base === 'number' && isFinite(body.base) && body.base >= 0) ? body.base : null;
      if (base !== null && !data.plain_password) {
        const cur = await pool.query(
          `SELECT id, login, full_name, role, prof, active, deleted, updated_at, (data = $2::jsonb) AS same_data FROM users WHERE id = $1`,
          [id, JSON.stringify(stripUnsafeData(data))]
        );
        const row = cur.rows[0];
        if (row && new Date(row.updated_at).getTime() > base + 1) {
          const same = !row.deleted && row.same_data && row.login === login && row.full_name === full_name && row.role === role &&
            (row.prof || null) === (prof || null) && row.active === active;
          const rec = { id: row.id, login: row.login, full_name: row.full_name, role: row.role, prof: row.prof, active: row.active,
            _deleted: !!row.deleted, _updated_at: new Date(row.updated_at).getTime() };
          if (same) { res.locals.spUnchanged = true; return res.json({ ok: true, unchanged: true, record: rec }); }
          await log(pool, { user: req.user, section: 'users', action: 'conflict', objectId: id, details: 'не перезаписано: на сервере новее — ' + full_name });
          return res.status(409).json({ ok: false, conflict: true, err: 'пользователь изменён на другом устройстве — не перезаписан', record: rec });
        }
      }

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
        // 22.09-241: запись уже есть, пароль не меняется — обычный UPDATE. Раньше здесь был
        // INSERT … ON CONFLICT без password_hash: PostgreSQL проверяет NOT NULL ещё до конфликта,
        // и ЛЮБАЯ правка пользователя без смены пароля (ФИО, роль, участок, фото, увольнение)
        // отклонялась с ошибкой «null value in column password_hash» и до сервера не доходила.
        r = await pool.query(
          `UPDATE users SET
             login = $2,
             full_name = $3,
             role = $4,
             prof = $5,
             active = $6,
             data = $7,
             deleted = FALSE,
             updated_at = NOW()
           WHERE id = $1
           RETURNING id, login, full_name, role, prof, active, updated_at`,
          [id, login, full_name, role, prof, active, stripUnsafeData(data)]
        );
        if (!r.rows.length) return res.status(404).json({ ok: false, err: 'не найдено' });
      }

      await log(pool, { user: req.user, section: 'users', action: 'upsert', objectId: id, details: full_name + ' (' + login + ')' });
      const row = r.rows[0];
      res.json({
        ok: true,
        record: {
          id: row.id, login: row.login, full_name: row.full_name, role: row.role,
          prof: row.prof, active: row.active,
          _deleted: false, _updated_at: row.updated_at ? new Date(row.updated_at).getTime() : Date.now() // 22.09-254: настоящая версия
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
      const tnum2 = String((req.body && (req.body.data || req.body)).table_number != null ? (req.body && (req.body.data || req.body)).table_number : '').replace(/\D/g, '');
      if (tnum2) {
        const tconf2 = await tableNumberConflict(req.params.id, tnum2);
        if (tconf2) return res.status(409).json({ ok: false, conflict: true, err: tconf2 });
      }
      const id = req.params.id;
      const body = req.body || {};
      const data = body.data || body;
      // 22.09-241: пароль может задать только администратор (или сам пользователь — себе)
      if (data.plain_password && !(req.user && (req.user.role === 'admin' || req.user.id === id))) {
        return res.status(403).json({ ok: false, err: 'менять пароль может только администратор' });
      }
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