/* ============================================================
   SmartPlan — auth роуты
   ============================================================ */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

function rndToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = function (pool) {
  const router = require('express').Router();
  const { log } = require('../lib/audit');

  // POST /api/auth/login { login, password }
  router.post('/login', async (req, res) => {
    try {
      const { login, password } = req.body || {};
      if (!login || !password) return res.status(400).json({ ok: false, err: 'нет логина или пароля' });

      const r = await pool.query(`SELECT * FROM users WHERE login = $1 LIMIT 1`, [login]);
      if (r.rows.length === 0) return res.status(401).json({ ok: false, err: 'неверный логин или пароль' });
      const u = r.rows[0];
      if (!u.active) return res.status(403).json({ ok: false, err: 'пользователь отключён' });

      const ok = await bcrypt.compare(password, u.password_hash || '');
      if (!ok) {
        await log(pool, { user: { id: u.id, login: u.login, full_name: u.full_name }, section: 'auth', action: 'login_fail', details: 'неверный пароль' });
        return res.status(401).json({ ok: false, err: 'неверный логин или пароль' });
      }

      const token = rndToken();
      await pool.query(`INSERT INTO sessions (token, user_id) VALUES ($1, $2)`, [token, u.id]);
      await log(pool, { user: { id: u.id, login: u.login, full_name: u.full_name }, section: 'auth', action: 'login_ok' });

      res.json({
        ok: true,
        token,
        user: {
          id: u.id, login: u.login, full_name: u.full_name, role: u.role, prof: u.prof, active: u.active
        }
      });
    } catch (e) {
      console.error('login error', e);
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req, res) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : null;
      if (token) await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // GET /api/auth/me
  router.get('/me', async (req, res) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : null;
      if (!token) return res.status(401).json({ ok: false, err: 'нет токена' });
      const r = await pool.query(
        `SELECT u.id, u.login, u.full_name, u.role, u.prof, u.active
           FROM sessions s JOIN users u ON u.id=s.user_id
          WHERE s.token = $1 AND s.expires_at > NOW()`,
        [token]
      );
      if (r.rows.length === 0) return res.status(401).json({ ok: false, err: 'токен недействителен' });
      res.json({ ok: true, user: r.rows[0] });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};