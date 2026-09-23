/* ============================================================
   SmartPlan — DEBUG endpoint (временный, для диагностики users)
   ============================================================ */
'use strict';

module.exports = function (pool) {
  const router = require('express').Router();

  // GET /api/_debug/users — все строки таблицы users (включая deleted=TRUE)
  router.get('/users', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, login, full_name, role, prof, active, deleted, password_hash IS NOT NULL as has_pwd, updated_at
           FROM users ORDER BY login`
      );
      res.json({ ok: true, count: r.rows.length, rows: r.rows });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};