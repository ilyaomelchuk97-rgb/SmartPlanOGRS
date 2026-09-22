/* ============================================================
   SmartPlan — журнал действий (audit log)
   ------------------------------------------------------------
   GET /api/audit?limit=50&since=<timestamp>
   ============================================================ */
'use strict';

module.exports = function (pool) {
  const router = require('express').Router();

  router.get('/', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
      const since = parseInt(req.query.since || '0', 10);

      const r = await pool.query(
        `SELECT id, ts, user_id, user_login, user_name, section, action, object_id, details
           FROM audit_log
          WHERE ($1::bigint = 0 OR ts > to_timestamp($1::double precision / 1000.0))
          ORDER BY ts DESC
          LIMIT $2`,
        [since, limit]
      );
      res.json({
        ok: true,
        records: r.rows.map((row) => ({
          id: row.id,
          ts: new Date(row.ts).getTime(),
          user_id: row.user_id,
          user_login: row.user_login,
          user_name: row.user_name,
          section: row.section,
          action: row.action,
          object_id: row.object_id,
          details: row.details
        }))
      });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};