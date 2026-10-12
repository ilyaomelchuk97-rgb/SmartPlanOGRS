/* ============================================================
   SmartPlan — копии графиков на сервере (общие для всех устройств)
   ------------------------------------------------------------
   Сборка 22.09-242. Раньше копии лежали в памяти браузера одного
   компьютера (лимит ~5 МБ, на других устройствах их не видно).

   GET    /api/graph_snaps?gid=<id графика> — список копий графика
          (без самих графиков — только подписи), новые сверху + last_iter
   GET    /api/graph_snaps/:id              — одна копия целиком (с графиком)
   POST   /api/graph_snaps                  — сохранить копию:
          { id, gid, iter (желаемый номер), ts, via, meta:{...}, graph }
          · номер итерации выдаёт СЕРВЕР: желаемый, если он больше всех
            уже выданных, иначе — следующий свободный (номера не повторяются,
            в т.ч. номера удалённых копий);
          · повторная отправка той же копии (тот же id) — без дубля;
          · у графика хранится не больше 20 последних копий.
   DELETE /api/graph_snaps/:id              — удалить копию (старший мастер,
          начальник участка, администратор); номер остаётся «занятым».
   ============================================================ */
'use strict';

const MAX_PER_GRAPH = 20;
const CAN_DELETE = { admin: 1, nach: 1, smaster: 1 };

module.exports = function (pool) {
  const router = require('express').Router();

  function metaOf(row) {
    const m = row.meta || {};
    return {
      id: row.id,
      gid: row.gid,
      iter: row.iter,
      ts: Number(row.ts),
      via: row.via || '',
      name: m.name || '',
      year: m.year || '',
      respName: m.respName || '',
      objsCount: m.objsCount || 0,
      worksCount: m.worksCount || 0,
      created_by: row.created_by || ''
    };
  }

  // Список копий графика (без графиков)
  router.get('/', async (req, res) => {
    try {
      const gid = String(req.query.gid || '');
      if (!gid) return res.status(400).json({ ok: false, err: 'нет gid' });
      const r = await pool.query(
        `SELECT id, gid, iter, ts, via, meta, created_by FROM graph_snaps WHERE gid = $1 ORDER BY ts DESC LIMIT $2`,
        [gid, MAX_PER_GRAPH]
      );
      const c = await pool.query(`SELECT last_iter FROM graph_snap_counters WHERE gid = $1`, [gid]);
      res.json({ ok: true, records: r.rows.map(metaOf), last_iter: c.rows.length ? c.rows[0].last_iter : 0 });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // Одна копия целиком
  router.get('/:id', async (req, res) => {
    try {
      const r = await pool.query(`SELECT id, gid, iter, ts, via, meta, graph, created_by FROM graph_snaps WHERE id = $1`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, err: 'копия не найдена' });
      const rec = metaOf(r.rows[0]);
      rec.graph = r.rows[0].graph;
      res.json({ ok: true, record: rec });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  // Сохранить копию: номер итерации выдаёт сервер
  router.post('/', async (req, res) => {
    const b = req.body || {};
    const id = String(b.id || '').slice(0, 80);
    const gid = String(b.gid || '').slice(0, 80);
    const graph = b.graph;
    if (!id || !gid || !graph || typeof graph !== 'object') return res.status(400).json({ ok: false, err: 'нет id/gid/graph' });
    const want = Math.max(1, parseInt(b.iter, 10) || 1);
    const ts = Number(b.ts) || Date.now();
    const m = b.meta || {};
    const meta = {
      name: String(m.name || '').slice(0, 300), year: m.year || '', respName: String(m.respName || '').slice(0, 200),
      objsCount: parseInt(m.objsCount, 10) || 0, worksCount: parseInt(m.worksCount, 10) || 0
    };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // повторная отправка той же копии — вернуть уже выданный номер
      const ex = await client.query(`SELECT iter FROM graph_snaps WHERE id = $1`, [id]);
      if (ex.rows.length) {
        await client.query('COMMIT');
        return res.json({ ok: true, iter: ex.rows[0].iter, existed: true });
      }
      await client.query(`INSERT INTO graph_snap_counters (gid, last_iter) VALUES ($1, 0) ON CONFLICT (gid) DO NOTHING`, [gid]);
      const c = await client.query(`SELECT last_iter FROM graph_snap_counters WHERE gid = $1 FOR UPDATE`, [gid]);
      const mx = await client.query(`SELECT COALESCE(MAX(iter), 0) AS m FROM graph_snaps WHERE gid = $1`, [gid]);
      const top = Math.max(c.rows[0].last_iter || 0, Number(mx.rows[0].m) || 0);
      const iter = want > top ? want : top + 1;
      await client.query(
        `INSERT INTO graph_snaps (id, gid, iter, ts, via, meta, graph, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, gid, iter, ts, String(b.via || '').slice(0, 100), meta, graph, (req.user && req.user.login) || '']
      );
      await client.query(`UPDATE graph_snap_counters SET last_iter = GREATEST(last_iter, $2) WHERE gid = $1`, [gid, iter]);
      // не больше 20 последних копий у графика
      await client.query(
        `DELETE FROM graph_snaps WHERE gid = $1 AND id NOT IN (SELECT id FROM graph_snaps WHERE gid = $1 ORDER BY ts DESC LIMIT $2)`,
        [gid, MAX_PER_GRAPH]
      );
      await client.query('COMMIT');
      res.json({ ok: true, iter });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (e2) {}
      res.status(500).json({ ok: false, err: e.message });
    } finally {
      client.release();
    }
  });

  // Удалить копию — старший мастер, начальник участка, администратор
  router.delete('/:id', async (req, res) => {
    try {
      if (!req.user || !CAN_DELETE[req.user.role]) {
        return res.status(403).json({ ok: false, err: 'удалять копии графика могут старший мастер, начальник участка и администратор' });
      }
      const r = await pool.query(`SELECT gid, iter FROM graph_snaps WHERE id = $1`, [req.params.id]);
      if (!r.rows.length) return res.json({ ok: true, deleted: 0 }); // уже удалена — не ошибка
      const { gid, iter } = r.rows[0];
      // номер удалённой копии остаётся «занятым» — повторно не выдаётся
      await pool.query(`INSERT INTO graph_snap_counters (gid, last_iter) VALUES ($1, $2) ON CONFLICT (gid) DO UPDATE SET last_iter = GREATEST(graph_snap_counters.last_iter, EXCLUDED.last_iter)`, [gid, iter]);
      const d = await pool.query(`DELETE FROM graph_snaps WHERE id = $1`, [req.params.id]);
      res.json({ ok: true, deleted: d.rowCount });
    } catch (e) {
      res.status(500).json({ ok: false, err: e.message });
    }
  });

  return router;
};
