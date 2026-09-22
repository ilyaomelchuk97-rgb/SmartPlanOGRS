/* ============================================================
   SmartPlan — ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ СИСТЕМЫ (config.js)
   ------------------------------------------------------------
   Сборка 22.09-25: миграция с локального файла на Render.com
   + PostgreSQL. Синхронизация — через polling /api/sync
   каждую секунду (см. api_client.js + sync_polling.js).

   Деплой:
   - Backend: render.yaml → web-service + PostgreSQL (free plan)
   - Frontend: тот же сервис (Express раздаёт / + /api)
   - URL после деплоя: https://<имя>.onrender.com

   Локальная разработка:
   - cd server && node server.js → http://localhost:3000
   ============================================================ */
window.SP_CONFIG = (function () {
  'use strict';

  // Базовый URL API. Если открыто на Render (или любом другом домене
  // с Express), API находится на same-origin /api.
  var API_BASE = (function () {
    if (window.SP_CONFIG_OVERRIDE) return window.SP_CONFIG_OVERRIDE;
    return window.location.origin + '/api';
  })();

  return {
    // Базовый URL API (используется SP_API.baseUrl)
    apiBase: API_BASE,

    // Совместимость со старым кодом — старый serverUrl
    serverUrl: API_BASE.replace(/\/api$/, ''),

    // Режим сервера (true — данные на сервере, polling каждую секунду)
    useServerApi: true,

    // (Удалено в 22.09-25) syncFolder — больше не используется

    // Ключ Яндекс.Карт (бесплатный: developer.tech.yandex.ru)
    yandexApiKey: '',

    // Ключи для routing API
    graphhopperApiKey: '57ef5c01-ff24-49f4-8131-b32511a787ed',
    orsApiKey: '11b38c9c9b090561281cb083210e428eevIh0hgxdCE',

    // Stadia Maps (Valhalla)
    stadiaApiKey: '',
    valhallaApiUrl: 'https://api.stadiamaps.com',

    // MapTiler OMT
    maptilerApiKey: 'W7EjXYGEA3hzkGvx81JM',

    // Геокодеры
    twogisKey: '',
    opencageKey: '',

    // Координаты для погоды
    weatherLat: 53.9023,
    weatherLng: 27.5619,

    // Нормативы рабочего времени
    workHoursPerDay: 8.0,

    // Эндпоинты REST API
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
