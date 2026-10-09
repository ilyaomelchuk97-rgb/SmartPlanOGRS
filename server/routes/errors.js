/* ============================================================
   SmartPlan — общий лог ошибок клиентов (со всех устройств)
   ------------------------------------------------------------
   Сборка 22.09-232: каждое устройство, где запущен сайт,
   отправляет свои ошибки сюда — в ОБЩИЙ список. В записи видно
   пользователя, устройство (браузер/ОС) и версию сборки.

   POST   /api/errors            — добавить пачку записей (до 100)
   GET    /api/errors?limit=&since=  — список (новые сверху)
   DELETE /api/errors            — очистить общий лог (только admin)

   Примечание: "where" — зарезервированное слово SQL, поэтому
   колонка в двойных кавычках.
   ============================================================ */
'use strict';

module.exports = function (pool) {
  const router = require('express').Router();

  function cut(v, n) { return v == null ? null : String(v).substring(0, n); }

  // POST /api/errors — body: { entries: [ {ts, level, where, msg, stack, extra, device, build} ] }
  router.post('/', async (req, res) => {
    try {
      const raw = req.body && req.body.entries;
      const entries = Array.isArray(raw) ? raw.slice(0, 100) : [];
      if (!entries.length) return res.json({ ok: true, inserted: 0 });

      const u = req.user || {};
      const values = [];
      const params = [];
      let p = 0;
      for (const e of entries) {
        if (!e || typeof e !== 'object') continue;
        values.push(`($${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p})`);
        params.push(
          Number(e.ts) || Date.now(),           // client_ts — время на устройстве (мс)
          cut(u.id, 60),
          cut(u.login, 60),
          cut(u.full_name, 200),
          cut(e.device, 200),
          cut(e.build, 40),
          cut(e.level, 10) || 'error',
          cut(e.where, 200),
          cut(e.msg, 600),
          cut(e.stack, 3000),
          e.extra == null ? null : cut(typeof e.extra === 'string' ? e.extra : JSON.stringify(e.extra), 1000)
        );
      }
      if (!values.length) return res.json({ ok: true, inserted: 0 });

      const r = await pool.query(
        `INSERT INTO error_log (client_ts, user_id, user_login, user_name, device, build, level, "where", msg, stack, extra)
         VALUES ${values.join(', ')}`,
        params
      );

      // Держим не больше 5000 последних записей — хвост обрезаем молча,
      // чтобы таблица не разрасталась (free tier PostgreSQL).
      pool.query(
        `DELETE FROM error_log
          WHERE id < (
            SELECT COALESCE((SELECT id FROM error_log ORDER BY id DESC LIMIT 1 OFFSET 5000), 0)
          )`
      ).catch(() => {});

      res.json({ ok: true, inserted: r.rowCount });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // GET /api/errors?limit=500&since=0 — список (новые сверху)
  router.get('/', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '500', 10), 1000);
      const since = parseInt(req.query.since || '0', 10);
      const r = await pool.query(
        `SELECT id, ts, client_ts, user_login, user_name, device, build, level, "where", msg, stack, extra
           FROM error_log
          WHERE ($1::bigint = 0 OR ts > to_timestamp($1::double precision / 1000.0))
          ORDER BY id DESC
          LIMIT $2`,
        [since, limit]
      );
      res.json({
        ok: true,
        records: r.rows.map((row) => ({
          id: row.id,
          ts: Number(row.client_ts) || new Date(row.ts).getTime(),
          user_login: row.user_login,
          user_name: row.user_name,
          device: row.device,
          build: row.build,
          level: row.level,
          where: row.where,
          msg: row.msg,
          stack: row.stack,
          extra: row.extra
        }))
      });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // DELETE /api/errors — очистить общий лог (только admin)
  router.delete('/', async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ ok: false, err: 'только для администратора' });
      }
      const r = await pool.query('DELETE FROM error_log');
      res.json({ ok: true, deleted: r.rowCount });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};
