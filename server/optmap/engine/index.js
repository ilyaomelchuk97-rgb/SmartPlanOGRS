// === OptMap (github.com/ilyaomelchuk97-rgb/OptMap), порт под CommonJS для SmartPlan.
// === Облегчённый фасад движка: граф + пробки + привязка точек + маршрутизация.
// Отличия от исходного server/engine/index.js:
//   • без генерации синтетического демо-города (если граф не загружен — честная ошибка);
//   • без внешних адаптеров (OSRM/Яндекс/Nominatim) — только локальный граф OSM;
'use strict';

const { Graph } = require('./graph');
const { TrafficModel } = require('./traffic');
const { SnapIndex } = require('./snap');
const { Router } = require('./router');
const { haversineM } = require('../util/geo');

class Engine {
  constructor(graph, traffic, snap, router, config) {
    this.graph = graph;
    this.traffic = traffic;
    this.snap = snap;
    this.router = router;
    this.config = config;
    this.startedAt = new Date().toISOString();
  }

  static async create(config) {
    const graph = await Graph.loadGzip(config.graphPath);
    const traffic = new TrafficModel();
    const snap = new SnapIndex(graph).build();
    const router = new Router(graph, traffic);
    console.log(
      `[optmap] граф: ${graph.nodeCount} узлов, ${graph.edgeCount} рёбер | источник: ${graph.meta.sourceName} (${graph.meta.source})`
    );
    return new Engine(graph, traffic, snap, router, { ...config, loadedFrom: config.graphPath });
  }

  get isDemo() {
    return this.graph.meta.source === 'synthetic';
  }

  health() {
    const g = this.graph;
    return {
      status: 'ok',
      engine: {
        source: g.meta.source,
        sourceName: g.meta.sourceName,
        builtAt: g.meta.builtAt,
        loadedFrom: this.config.loadedFrom,
        demo: this.isDemo,
        nodes: g.nodeCount,
        edges: g.edgeCount,
        bbox: g.bbox, // [minLat, minLon, maxLat, maxLon]
        maxKmh: g.maxKmh,
      },
      traffic: this.traffic.describe(),
      limits: {
        maxPoints: this.config.maxPoints,
        snapRadiusM: this.config.snapRadiusM,
      },
      startedAt: this.startedAt,
    };
  }

  /** Привязка точки к дороге; бросает ошибку с понятным сообщением. */
  snapPoint(lat, lon, label = '') {
    const s = this.snap.snap(lat, lon, this.config.snapRadiusM);
    if (!s) {
      const where = label ? `«${label}»` : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      const err = new Error(
        `Точка ${where} слишком далеко от дорог (более ${this.config.snapRadiusM} м). Переместите точку ближе к дорожной сети.`
      );
      err.status = 400;
      err.code = 'SNAP_FAILED';
      throw err;
    }
    return s;
  }

  /** Путь между двумя точками. */
  route(from, to, opts = {}) {
    const sa = this.snapPoint(from.lat, from.lon, from.name);
    const sb = this.snapPoint(to.lat, to.lon, to.name);
    return this.router.route(sa, sb, opts);
  }

  /** Матрица времени/дистанций между точками. */
  matrix(points, opts = {}) {
    const snaps = points.map((p) => this.snapPoint(p.lat, p.lon, p.name));
    const mx = this.router.matrix(snaps, opts);
    mx.snaps = snaps;
    return mx;
  }

  /** Прямое расстояние между точками (для сравнения с маршрутом). */
  directM(a, b) {
    return haversineM(a.lat, a.lon, b.lat, b.lon);
  }
}

module.exports = { Engine };
