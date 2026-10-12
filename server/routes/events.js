/* ============================================================
   SmartPlan — GET /api/events?token=…&cid=… (22.09-243)
   ------------------------------------------------------------
   Постоянное соединение для мгновенных уведомлений (SSE).
   Токен — в адресе (браузерный EventSource не умеет заголовки).
   Каждые 25 сек — «пинг»: соединение не обрывается прокси
   (Cloudflare рвёт молчащие >100 сек), а пользователь остаётся
   «онлайн» (обновляется last_seen сессии).
   ============================================================ */
'use strict';

const hub = require('../lib/events');

module.exports = function (pool) {
  const router = require('express').Router();

  router.get('/', async (req, res) => {
    try {
      const token = String(req.query.token || '');
      if (!token) return res.status(401).json({ ok: false, err: 'нет токена' });
      const r = await pool.query(
        `SELECT u.id, u.active FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token = $1 AND s.expires_at > NOW()`,
        [token]
      );
      if (!r.rows.length) return res.status(401).json({ ok: false, err: 'токен недействителен' });
      if (!r.rows[0].active) return res.status(403).json({ ok: false, err: 'пользователь отключён' });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write('retry: 5000\n\n');
      res.write('event: hello\ndata: {"ok":true}\n\n');

      const client = { res, user: r.rows[0].id, cid: String(req.query.cid || '').slice(0, 40) };
      hub.add(client);
      const touch = () => pool.query(`UPDATE sessions SET last_seen = NOW() WHERE token = $1`, [token]).catch(() => {});
      touch();
      const hb = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (e) {}
        touch();
      }, 25000);
      req.on('close', () => { clearInterval(hb); hub.remove(client); });
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};
