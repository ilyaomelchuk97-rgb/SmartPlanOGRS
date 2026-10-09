/* ============================================================
   SmartPlan — прокси к единому роутеру BRouter (car-eco)
   ------------------------------------------------------------
   Сборка 22.09-234: расчёт маршрута идёт через НАШ сервер, а не
   напрямую с устройства на brouter.de. Так надёжнее: нет CORS,
   нет блокировок brouter.de сетью/провайдером устройства —
   устройству нужен доступ только к самому сайту.

   GET /api/route/brouter?lonlats=lng,lat|lng,lat|...&profile=car-eco
     → отдаёт geojson BRouter как есть (Content-Type: application/json)
     → ошибки апстрима: 502 { ok:false, err }

   Защита: строгая проверка координат, белый список профилей,
   не больше 60 точек, таймаут 25 сек, лимит ответа 6 МБ.
   ============================================================ */
'use strict';

module.exports = function () {
  const router = require('express').Router();

  // Профили, которые разрешено проксировать (сейчас сайт использует car-eco)
  const ALLOWED_PROFILES = { 'car-eco': 1, 'car-fast': 1, 'trekking': 1, 'vm-forum-velomobil-schnell': 1 };
  const MAX_POINTS = 60;
  const MAX_BYTES = 6 * 1024 * 1024;
  const TIMEOUT_MS = 25000;

  router.get('/brouter', async (req, res) => {
    try {
      const lonlats = String(req.query.lonlats || '');
      const profile = String(req.query.profile || 'car-eco');
      const parts = lonlats.split('|');
      const PAIR = /^-?\d{1,3}(\.\d{1,7})?,-?\d{1,3}(\.\d{1,7})?$/;
      if (parts.length < 2 || parts.length > MAX_POINTS || !parts.every((p) => PAIR.test(p))) {
        return res.status(400).json({ ok: false, err: 'bad lonlats' });
      }
      if (!ALLOWED_PROFILES[profile]) {
        return res.status(400).json({ ok: false, err: 'bad profile' });
      }
      const url = 'https://brouter.de/brouter?lonlats=' + encodeURIComponent(lonlats) +
        '&profile=' + encodeURIComponent(profile) + '&alternativeidx=0&format=geojson';

      const ctrl = new AbortController();
      const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, TIMEOUT_MS);
      let upstream;
      try {
        upstream = await fetch(url, { signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!upstream.ok) {
        const t = await upstream.text().catch(() => '');
        return res.status(502).json({ ok: false, err: 'brouter HTTP ' + upstream.status + (t ? ' — ' + t.slice(0, 120) : '') });
      }
      const text = await upstream.text();
      if (text.length > MAX_BYTES) {
        return res.status(502).json({ ok: false, err: 'brouter: слишком большой ответ' });
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(text);
    } catch (e) {
      res.status(502).json({ ok: false, err: 'brouter upstream: ' + ((e && e.message) || e) });
    }
  });

  return router;
};
