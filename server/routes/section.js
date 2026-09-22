/* ============================================================
   SmartPlan — универсальный CRUD роутинг для разделов
   ------------------------------------------------------------
   GET    /api/<section>           — все записи
   GET    /api/<section>/:id       — одна запись
   POST   /api/<section>           — создать
   PUT    /api/<section>/:id       — обновить (с проверкой updated_at)
   DELETE /api/<section>/:id       — soft-delete (deleted=true)
   ============================================================ */
'use strict';

module.exports = function (pool, section) {
  const router = require('express').Router();
  const { log } = require('../lib/audit');

  // GET /api/<section> — список (включая soft-deleted для полной реплики)
  router.get('/', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, data, deleted, updated_at FROM ${section} ORDER BY updated_at DESC LIMIT 5000`
      );
      res.json({
        ok: true,
        records: r.rows.map(rowToRecord)
      });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // GET /api/<section>/:id
  router.get('/:id', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, data, deleted, updated_at FROM ${section} WHERE id = $1`,
        [req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ ok: false, err: 'не найдено' });
      res.json({ ok: true, record: rowToRecord(r.rows[0]) });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // POST /api/<section> — создать (id из тела)
  router.post('/', async (req, res) => {
    try {
      const body = req.body || {};
      const id = body.id;
      if (!id) return res.status(400).json({ ok: false, err: 'нет id' });
      const data = body.data || body;     // поддержка обоих форматов

      const r = await pool.query(
        `INSERT INTO ${section} (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, deleted = FALSE, updated_at = NOW()
         RETURNING id, data, deleted, updated_at`,
        [id, data]
      );
      await log(pool, { user: req.user, section, action: 'upsert', objectId: id, details: data.name || data.full_name || id });
      res.json({ ok: true, record: rowToRecord(r.rows[0]) });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // PUT /api/<section>/:id — обновить (с проверкой updated_at для защиты от race)
  router.put('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body || {};
      const data = body.data || body;
      const expectedUpdatedAt = body.expected_updated_at; // миллисекунды ISO или null

      // Если передан expected_updated_at — проверяем
      if (expectedUpdatedAt) {
        const cur = await pool.query(`SELECT updated_at FROM ${section} WHERE id = $1`, [id]);
        if (cur.rows.length === 0) return res.status(404).json({ ok: false, err: 'не найдено' });
        const curTs = new Date(cur.rows[0].updated_at).getTime();
        if (Math.abs(curTs - expectedUpdatedAt) > 1000) {
          return res.status(409).json({
            ok: false, err: 'конфликт: запись была обновлена другим пользователем',
            current_updated_at: curTs
          });
        }
      }

      const r = await pool.query(
        `UPDATE ${section} SET data = $1, deleted = FALSE, updated_at = NOW()
          WHERE id = $2
         RETURNING id, data, deleted, updated_at`,
        [data, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ ok: false, err: 'не найдено' });
      await log(pool, { user: req.user, section, action: 'update', objectId: id, details: data.name || data.full_name || id });
      res.json({ ok: true, record: rowToRecord(r.rows[0]) });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // DELETE /api/<section>/:id — soft-delete
  router.delete('/:id', async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE ${section} SET deleted = TRUE, updated_at = NOW() WHERE id = $1
         RETURNING id, data, deleted, updated_at`,
        [req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ ok: false, err: 'не найдено' });
      await log(pool, { user: req.user, section, action: 'delete', objectId: req.params.id });
      res.json({ ok: true, record: rowToRecord(r.rows[0]) });
    } catch (e) {
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