/* ============================================================
   SmartPlan — утилита для записи в audit_log
   ============================================================ */
'use strict';

async function log(pool, { user, section, action, objectId, details }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, user_login, user_name, section, action, object_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user?.id || null,
        user?.login || null,
        user?.full_name || null,
        section,
        action,
        objectId || null,
        details || null
      ]
    );
  } catch (e) {
    console.error('audit log error', e.message);
  }
}

module.exports = { log };