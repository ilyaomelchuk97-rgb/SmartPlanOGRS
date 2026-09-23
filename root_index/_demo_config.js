/* ============================================================
   SmartPlan ДЕМО — конфиг без сервера (config.js)
   ------------------------------------------------------------
   Полностью локальный режим: данные хранятся ТОЛЬКО в
   localStorage этого браузера. Никакого polling, никакого
   fetch к API. Используется в index_demo.html.
   ============================================================ */
window.SP_CONFIG = (function () {
  'use strict';
  return {
    // Демо-режим: сервер выключен, всё работает локально
    apiBase: '',
    serverUrl: '',
    useServerApi: false,

    // Ключ Яндекс.Карт
    yandexApiKey: '',

    // Ключи для routing API (в демо не используются, но совместимость)
    graphhopperApiKey: '',
    orsApiKey: '',

    // Stadia Maps (Valhalla)
    stadiaApiKey: '',
    valhallaApiUrl: '',

    // MapTiler OMT
    maptilerApiKey: '',

    // Геокодеры
    twogisKey: '',
    opencageKey: '',

    // Координаты для погоды
    weatherLat: 53.9023,
    weatherLng: 27.5619,

    // Нормативы рабочего времени
    workHoursPerDay: 8.0,

    // Эндпоинты REST API — пустые/моки (не используются)
    endpoints: {
      objects: '/api/objects',
      tasks:   '/api/tasks',
      users:   '/api/users',
      areas:   '/api/areas',
      workers: '/api/workers',
      works:   '/api/work_catalog',
      graphs:  '/api/graphs',
      sync:    '/api/sync',
      audit:   '/api/audit',
      auth:    '/api/auth',
      health:  '/healthz'
    }
  };
})();
