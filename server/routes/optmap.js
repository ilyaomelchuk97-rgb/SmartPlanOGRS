/* ============================================================
   SmartPlan — /api/optmap (22.09-128)
   ------------------------------------------------------------
   Свой оптимизатор маршрутов OptMap (github.com/ilyaomelchuk97-rgb/OptMap),
   портированный в server/optmap/ и работающий на нашем же сервере:
   граф дорог Минска из OpenStreetMap + модель пробок по часу выезда.
   Эндпоинты (только для роли admin — страница «Тест проезда»):
     · GET  /api/optmap/health   — статус движка (граф, узлы/рёбра, bbox)
     · POST /api/optmap/optimize — оптимальный порядок точек + маршруты
     · POST /api/optmap/route    — маршрут между двумя точками
   ============================================================ */
'use strict';

const express = require('express');
const path = require('path');
const { Engine } = require('../optmap/engine');
const { optimizeOrder } = require('../optmap/optimizer');

const WEEKEND_DAYS = [0, 6];

/* Движок — синглтон: граф грузится в фоне ПОСЛЕ старта сервера (чтобы
   проблема движка никогда не роняла сам сайт — до готовности запросы
   получают честный 503). Бинарный формат графа читается почти без пика
   памяти (22.09-130; сайт падал 502 из-за OOM на JSON-версии). */
let engine = null;
let engineErr = null;
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'optmap', 'data');
const graphPath =
  process.env.OPTMAP_GRAPH ||
  (fs.existsSync(path.join(dataDir, 'graph.bin.gz'))
    ? path.join(dataDir, 'graph.bin.gz')
    : path.join(dataDir, 'graph.json.gz'));

function loadEngine() {
  Engine.create({
    graphPath,
    snapRadiusM: parseInt(process.env.OPTMAP_SNAP_M || '400', 10) || 400,
    maxPoints: parseInt(process.env.OPTMAP_MAX_POINTS || '50', 10) || 50,
    allowSynthetic: false,
  })
    .then((e) => {
      engine = e;
      console.log('✅ [optmap] движок готов (локальный граф OSM, Минск)');
    })
    .catch((err) => {
      engineErr = err;
      console.error('⚠ [optmap] граф дорог не загружен (сайт работает без OptMap):', err.message);
    });
}
// Отступ 2 сек: сначала HTTP-сервер и health-check, потом движок
setTimeout(loadEngine, 2000);

function minskNow() {
  // Час и день недели по Минску (сервер на Render работает в UTC)
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Minsk',
      hour: 'numeric', hour12: false, weekday: 'short',
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    const hour = parseInt(get('hour'), 10);
    const wd = get('weekday');
    return { hour: Number.isFinite(hour) ? hour % 24 : new Date().getHours(), weekend: wd === 'Sat' || wd === 'Sun' };
  } catch (e) {
    return { hour: new Date().getHours(), weekend: WEEKEND_DAYS.includes(new Date().getDay()) };
  }
}

module.exports = function createOptmapRoutes() {
  const api = express.Router();

  // Доступ только у администратора (страница «Тест проезда» — admin-only)
  api.use((req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, err: 'OptMap доступен только администратору' });
    }
    next();
  });

  const haveEngine = (res) => {
    if (engine) return true;
    const msg = engineErr
      ? 'граф дорог не загружен: ' + engineErr.message
      : 'граф дорог ещё загружается, попробуйте через пару секунд';
    res.status(503).json({ ok: false, err: msg });
    return false;
  };

  const fail = (res, status, message, code) =>
    res.status(status).json({ ok: false, err: message, code: code || null });

  const pointName = (p, i) => p.name || ('Точка ' + (i + 1));

  const avgKmh = (distanceM, durationS) =>
    durationS > 0 ? Math.round(((distanceM / 1000) / (durationS / 3600)) * 10) / 10 : 0;

  function parseOpts(body = {}) {
    const o = body.options || {};
    const mode = o.mode === 'distance' ? 'distance' : 'time';
    let departHour = null;
    if (o.departHour !== undefined && o.departHour !== null) {
      departHour = Number(o.departHour);
      if (!Number.isInteger(departHour) || departHour < 0 || departHour > 23) {
        const err = new Error('options.departHour должен быть целым числом 0–23 или null');
        err.status = 400;
        throw err;
      }
    }
    const now = minskNow();
    return {
      mode,
      departHour: departHour === null ? now.hour : departHour,
      trafficOn: o.traffic !== false && mode === 'time',
      roundTrip: o.roundTrip !== false,
      endLocked: o.endLocked === true,
      returnGeometry: o.returnGeometry !== false,
      isWeekend: o.isWeekend !== undefined ? o.isWeekend === true : now.weekend,
    };
  }

  const engineOpts = (po) => ({
    mode: po.mode, departHour: po.departHour, trafficOn: po.trafficOn, isWeekend: po.isWeekend,
  });

  function parsePoints(body) {
    const pts = body && body.points;
    if (!Array.isArray(pts)) {
      const err = new Error('Ожидается массив points: [{lat, lon, name?}, …]');
      err.status = 400;
      throw err;
    }
    if (pts.length < 2) {
      const err = new Error('Нужно минимум 2 точки');
      err.status = 400;
      throw err;
    }
    if (pts.length > 50) {
      const err = new Error('Максимум 50 точек в одном запросе');
      err.status = 400;
      throw err;
    }
    return pts.map((p, i) => {
      // принимаем и lon, и lng (наши карточки хранят lng)
      const lat = Number(p.lat);
      const lon = Number(p.lon !== undefined ? p.lon : p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        const err = new Error('points[' + i + ']: некорректные координаты {lat, lon}');
        err.status = 400;
        throw err;
      }
      return {
        lat, lon,
        name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 120) : ('Точка ' + (i + 1)),
      };
    });
  }

  /* ---------- Health ---------- */
  api.get('/health', (_req, res) => {
    if (!haveEngine(res)) return;
    res.json(Object.assign({ ok: true }, engine.health()));
  });

  /* ---------- Оптимизация порядка точек + маршрут ---------- */
  api.post('/optimize', (req, res) => {
    if (!haveEngine(res)) return;
    const t0 = Date.now();
    let po, points;
    try {
      po = parseOpts(req.body);
      points = parsePoints(req.body);
    } catch (e) {
      return fail(res, e.status || 400, e.message);
    }
    const warnings = [];
    try {
      const tMatrix = Date.now();
      const mx = engine.matrix(points, engineOpts(po));
      const matrixMs = Date.now() - tMatrix;

      if (mx.unreachable.length > 0) {
        const [i, j] = mx.unreachable[0];
        return fail(res, 422,
          'Между точками «' + pointName(points[i], i) + '» и «' + pointName(points[j], j) +
          '» нет дорожной связи (нет пути по графу)', 'NO_PATH');
      }
      (mx.snaps || []).forEach((s, i) => {
        if (s && s.distM > 50) {
          warnings.push('Точка «' + pointName(points[i], i) + '» привязана к дороге с точностью ~' + Math.round(s.distM) + ' м');
        }
      });

      const costMx = po.mode === 'time' ? mx.times.map((r) => [...r]) : mx.lens.map((r) => [...r]);
      const opt = optimizeOrder(costMx, { roundTrip: po.roundTrip, endLocked: po.endLocked });
      const order = opt.order;

      const seq = order.slice();
      if (po.roundTrip && order.length > 2) seq.push(order[0]);
      const legs = [];
      let legsMs = 0;
      for (let s = 0; s + 1 < seq.length; s++) {
        const a = seq[s], b = seq[s + 1];
        const tL = Date.now();
        const leg = engine.route(points[a], points[b], engineOpts(po));
        legsMs += Date.now() - tL;
        if (!leg) {
          return fail(res, 422, 'Нет пути между «' + pointName(points[a], a) + '» и «' + pointName(points[b], b) + '»', 'NO_PATH');
        }
        legs.push({
          from: a, to: b,
          fromName: pointName(points[a], a), toName: pointName(points[b], b),
          distanceM: leg.distanceM,
          durationS: leg.durationS,
          avgSpeedKmh: avgKmh(leg.distanceM, leg.durationS),
          coords: po.returnGeometry ? leg.coords : undefined,
        });
      }

      const totals = {
        distanceM: Math.round(legs.reduce((s, l) => s + l.distanceM, 0)),
        durationS: Math.round(legs.reduce((s, l) => s + l.durationS, 0)),
      };
      totals.avgSpeedKmh = avgKmh(totals.distanceM, totals.durationS);
      let directM = 0;
      for (let s = 0; s + 1 < seq.length; s++) directM += engine.directM(points[seq[s]], points[seq[s + 1]]);
      totals.directDistanceM = Math.round(directM);
      totals.detourFactor = directM > 0 ? Math.round((totals.distanceM / directM) * 100) / 100 : null;

      // SmartPlan: время без пробок для того же порядка (сравнение «с пробками / без»)
      if (po.trafficOn && po.mode === 'time') {
        try {
          const freeOpts = { mode: po.mode, departHour: po.departHour, trafficOn: false, isWeekend: po.isWeekend };
          let freeS = 0;
          for (let s = 0; s + 1 < seq.length; s++) {
            const leg = engine.route(points[seq[s]], points[seq[s + 1]], freeOpts);
            if (leg) freeS += leg.durationS;
          }
          totals.freeFlowDurationS = Math.round(freeS);
        } catch (e) { /* не критично */ }
      }

      res.json({
        ok: true,
        order,
        legs,
        totals,
        optimizer: {
          method: opt.method,
          points: points.length,
          matrixMs,
          optimizeMs: opt.elapsedMs != null ? opt.elapsedMs : null,
          legsMs,
          totalMs: Date.now() - t0,
        },
        engine: { name: 'local', graph: { source: 'osm', demo: false } },
        options: {
          mode: po.mode, roundTrip: po.roundTrip, endLocked: po.endLocked,
          traffic: po.trafficOn, departHour: po.departHour, isWeekend: po.isWeekend,
        },
        warnings,
      });
    } catch (e) {
      return fail(res, e.status || 500, e.message, e.code);
    }
  });

  /* ---------- Маршрут между двумя точками ---------- */
  api.post('/route', (req, res) => {
    if (!haveEngine(res)) return;
    try {
      const po = parseOpts(req.body);
      const from = (req.body || {}).from || {};
      const to = (req.body || {}).to || {};
      for (const [nm, p] of [['from', from], ['to', to]]) {
        const lat = Number(p.lat), lon = Number(p.lon !== undefined ? p.lon : p.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return fail(res, 400, nm + ': ожидаются координаты {lat, lon}');
        }
        p.lat = lat; p.lon = lon;
      }
      const r = engine.route(from, to, engineOpts(po));
      if (!r) return fail(res, 422, 'Нет пути между точками', 'NO_PATH');
      res.json({
        ok: true,
        distanceM: r.distanceM,
        durationS: r.durationS,
        avgSpeedKmh: avgKmh(r.distanceM, r.durationS),
        coords: po.returnGeometry ? r.coords : undefined,
        engine: { name: 'local' },
      });
    } catch (e) {
      return fail(res, e.status || 500, e.message, e.code);
    }
  });

  return api;
};
