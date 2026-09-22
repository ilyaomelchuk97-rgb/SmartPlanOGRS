/* ============================================================
   SmartPlan — middleware проверки токена
   ------------------------------------------------------------
   Токен берётся из заголовка `Authorization: Bearer <token>`
   или из cookie `token`. Сверяется с таблицей sessions.
   ============================================================ */
'use strict';

async function requireAuth(req, res, next) {
  try {
    let token = null;
    const auth = req.headers.authorization || '';
    if (auth.indexOf('Bearer ') === 0) token = auth.slice(7).trim();
    if (!token && req.headers.cookie) {
      const m = req.headers.cookie.match(/(?:^|; )token=([^;]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }
    if (!token) return res.status(401).json({ ok: false, err: 'нет токена' });

    const pool = req.app.locals.pool;
    if (!pool) {
      // Получаем pool из require cache (через singleton)
      const { getPool } = require('../lib/db');
      req.app.locals.pool = getPool();
    }
    const p = req.app.locals.pool;

    const r = await p.query(
      `SELECT s.token, s.expires_at, u.id, u.login, u.full_name, u.role, u.prof, u.active
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    if (r.rows.length === 0) return res.status(401).json({ ok: false, err: 'токен недействителен' });

    const row = r.rows[0];
    if (!row.active) return res.status(403).json({ ok: false, err: 'пользователь отключён' });

    req.user = {
      id: row.id, login: row.login, full_name: row.full_name, role: row.role, prof: row.prof
    };
    req.token = token;

    // Обновить last_seen (не блокируем ответ)
    p.query(`UPDATE sessions SET last_seen = NOW() WHERE token = $1`, [token]).catch(() => {});

    next();
  } catch (e) {
    console.error('requireAuth', e);
    res.status(500).json({ ok: false, err: e.message });
  }
}

module.exports = { requireAuth };