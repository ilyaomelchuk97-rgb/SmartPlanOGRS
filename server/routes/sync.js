/* ============================================================
   SmartPlan — синхронизация (polling каждую секунду)
   ------------------------------------------------------------
   GET /api/sync?since=<timestamp>
   Возвращает все записи, изменённые ПОСЛЕ указанного timestamp
   (по всем разделам). Клиент мержит их с локальным кэшем.

   Ответ:
   {
     ok: true,
     now: <timestamp сервера>,
     sections: {
       objects: [ { id, ...data, _updated_at, _deleted } ],
       tasks:   [ ... ],
       users:   [ ... ],
       ...
     },
     online: [ { id, full_name, role, last_seen } ]   // кто сейчас онлайн
   }
   ============================================================ */
'use strict';

const { SECTIONS } = require('../migrations/init');

module.exports = function (pool) {
  const router = require('express').Router();

  router.get('/', async (req, res) => {
    try {
      const since = parseInt(req.query.since || '0', 10);
      const now = Date.now();

      // Запросить все разделы параллельно. Для users — особый запрос (фиксированные колонки + JSONB)
      const queries = SECTIONS.map(async (s) => {
        if (s.name === 'users') {
          const r = await pool.query(
            `SELECT id, login, full_name, role, prof, active, data, updated_at
               FROM users
              WHERE deleted = FALSE AND updated_at > to_timestamp($1::double precision / 1000.0)
              ORDER BY updated_at ASC LIMIT 5000`,
            [since]
          );
          return [s.name, r.rows.map((row) => ({
            id: row.id,
            login: row.login,
            full_name: row.full_name,
            role: row.role,
            prof: row.prof,
            active: row.active,
            ...row.data,
            _deleted: false,
            _updated_at: new Date(row.updated_at).getTime()
          }))];
        }
        const r = await pool.query(
          `SELECT id, data, deleted, updated_at FROM ${s.name}
            WHERE updated_at > to_timestamp($1::double precision / 1000.0)
            ORDER BY updated_at ASC LIMIT 5000`,
          [since]
        );
        return [s.name, r.rows.map(rowToRecord)];
      });
      const pairs = await Promise.all(queries);

      // Кто онлайн (last_seen < 2 минуты назад)
      const onlineR = await pool.query(
        `SELECT u.id, u.full_name, u.role, u.login, s.last_seen
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.last_seen > NOW() - INTERVAL '2 minutes'
          ORDER BY s.last_seen DESC LIMIT 30`
      );

      const sections = {};
      for (const [name, records] of pairs) sections[name] = records;

      res.json({
        ok: true,
        now,
        sections,
        online: onlineR.rows.map((r) => ({
          id: r.id, full_name: r.full_name, role: r.role, login: r.login,
          last_seen: new Date(r.last_seen).getTime()
        }))
      });
    } catch (e) {
      console.error('sync error', e);
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  function rowToRecord(row) {
    return {
      id: row.id,
      ...row.data,
      _deleted: row.deleted,
      _updated_at: new Date(row.updated_at).getTime()
    };
  }

  return router;
};