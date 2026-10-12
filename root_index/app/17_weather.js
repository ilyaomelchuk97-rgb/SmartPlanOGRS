  /* ── часть 17 · app/17_weather.js — погода и карта погоды, выпадающее меню синхронизации ── */
  /* ============ 22.09-173: «GOOGLE EARTH 3D» — ОБЪЁМНЫЕ ДОМА ============
     Отдельная технология: MapLibre GL (грузится с CDN только при выборе этого
     режима). Подложка — спутник+схема города Google (vt lyrs=y), здания —
     объёмные по тегу высоты OpenStreetMap (векторные тайлы OpenFreeMap).
     Маркеры базы/задач и линия маршрута рисуются теми же данными, что и на
     Яндекс-карте (tDrawTestMarkers/tDrawTestRouteLine просто ветвятся). */
  var mlState = { loading: false, cbs: [] };
  /* 22.09-176: ПРИЧИНА СБОЯ — раньше стояла версия библиотеки «6.11.2», которой не существует
     (а в новых 6.x вообще нет обычного js-файла, только модули), поэтому сервер отвечал «не найдено».
     Теперь: проверенная существующая 5.24.0 (в ней есть и глобус, и объёмные дома) + ЗАПАСНОЙ
     адрес на другом сервере: если первый молчит или отвечает ошибкой — грузим со второго. */
  var ML_CDNS = [
    'https://unpkg.com/maplibre-gl@5.24.0/dist/',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/'
  ];
  function ensureMapLibre(ok, fail) {
    if (window.maplibregl) { try { ok(); } catch (e) {} return; }
    mlState.cbs.push({ ok: ok, fail: fail });
    if (mlState.loading) return;
    mlState.loading = true;
    function _fin(isOk) {
      var cbs = mlState.cbs.slice(); mlState.cbs = [];
      mlState.loading = false;
      cbs.forEach(function (c) { try { isOk ? c.ok() : (c.fail && c.fail()); } catch (e) {} });
    }
    function _tryCdn(idx) {
      if (idx >= ML_CDNS.length) { _fin(false); return; }
      var base = ML_CDNS[idx], done = false, to = 0;
      function _next(okNow) {
        if (done) return; done = true;
        try { clearTimeout(to); } catch (e) {}
        if (okNow) { _fin(true); } else { _tryCdn(idx + 1); }
      }
      try {
        if (!document.getElementById('mlgl-css')) {
          var link = document.createElement('link');
          link.id = 'mlgl-css';
          link.rel = 'stylesheet';
          link.href = base + 'maplibre-gl.css';
          document.head.appendChild(link);
        }
        var sc = document.createElement('script');
        if (idx === 0) sc.id = 'mlgl-js';
        sc.src = base + 'maplibre-gl.js';
        to = setTimeout(function () { _next(false); }, 25000); // 25 сек на один сервер, потом запасной
        sc.onload = function () { _next(!!window.maplibregl); };
        sc.onerror = function () { _next(false); };
        document.head.appendChild(sc);
      } catch (e) { _next(false); }
    }
    _tryCdn(0);
  }
  // Стиль 3D-карты: спутник+подписи Google + объёмные дома OSM (высота render_height)
  function tG3DStyleDef() {
    return {
      version: 8,
      // 22.09-174: ПЛАНЕТА — при отдалении глобус, при приближении — обычная плоская карта
      projection: { type: ['interpolate', ['linear'], ['zoom'], 5, 'vertical-perspective', 7, 'mercator'] },
      // голубое свечение атмосферы вокруг планеты, как в Google Earth
      sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
      sources: {
        'g-lyrs': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'], tileSize: 256, attribution: '© Google (схема дорог)' }, // 22.09-174: НЕ спутник — нарисованные дороги Google
        'osm-bld': { type: 'vector', tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'], attribution: 'Здания: © участники OpenStreetMap' }
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#04070d' } }, // тёмный космос за диском планеты
        { id: 'gsat', type: 'raster', source: 'g-lyrs' },
        { id: 'b3d', type: 'fill-extrusion', source: 'osm-bld', 'source-layer': 'building',
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 12], 0, '#c9ccd1', 40, '#a5bfcf', 120, '#7fa9c4'],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.92,
            'fill-extrusion-vertical-gradient': true
          } }
      ]
    };
  }
  function tG3DDraw(holder) {
    // Яндекс-карта из прошлого режима не нужна — убираем (пересоздастся при возврате)
    if (tState.ymap) { try { tState.ymap.destroy(); } catch (e) {} tState.ymap = null; }
    tState.route = null;
    tState.leafletMarkers = [];
    ensureMapLibre(function () {
      if (!document.getElementById('t-canvas')) return; // страницу уже сменили
      try {
        if (!tState.mlmap) {
          holder.innerHTML = '';
          var mlDiv = document.createElement('div');
          mlDiv.id = 't-ml3d';
          mlDiv.style.cssText = 'position:absolute;inset:0';
          holder.appendChild(mlDiv);
          tState.mlmap = new maplibregl.Map({
            container: mlDiv,
            style: tG3DStyleDef(),
            center: [27.5619, 53.9023],
            zoom: 1.7, pitch: 0, bearing: 0, maxPitch: 75, // 22.09-174: старт — вся планета (глобус), как в Google Earth
            attributionControl: { compact: true }
          });
          try {
            tState.mlmap.addControl(new maplibregl.NavigationControl(), 'top-right');
            if (typeof maplibregl.GlobeControl === 'function') tState.mlmap.addControl(new maplibregl.GlobeControl(), 'top-right'); // быстрый переключатель глобус/плоская
            tState.mlmap.dragRotate.enable();       // поворот: правая кнопка / Ctrl+левая
            tState.mlmap.touchZoomRotate.enableRotation();
          } catch (e) {}
          // когда стиль догрузится — дорисовать маркеры и маршрут
          tState.mlmap.on('load', function () {
            try { tG3DSyncMarkers(); tG3DSyncRoute(tState.routeGeom); } catch (e) {}
          });
        }
        tG3DSyncMarkers();
        tG3DSyncRoute(tState.routeGeom);
      } catch (e) { console.error('3D-карта (тест проезда):', e); }
    }, function () {
      holder.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red);font-weight:700">3D-карта недоступна — проверьте интернет</div>';
    });
  }
  function tG3DDestroy() {
    if (tState.mlmap) { try { tState.mlmap.remove(); } catch (e) {} tState.mlmap = null; }
    tState.mlMarkers = [];
    var d = document.getElementById('t-ml3d');
    if (d && d.parentNode) d.parentNode.removeChild(d);
  }
  function tG3DSyncMarkers() {
    var map = tState.mlmap;
    if (!map || !window.maplibregl) return;
    (tState.mlMarkers || []).forEach(function (mk) { try { mk.remove(); } catch (e) {} });
    tState.mlMarkers = [];
    var base = currentBase();
    function mkEl(label, bg, size) {
      var d = document.createElement('div');
      d.style.cssText = 'background:' + bg + ';color:#fff;border-radius:50%;width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:' + Math.round(size * 0.42) + 'px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);cursor:pointer';
      d.textContent = label;
      return d;
    }
    function addM(lat, lng, label, bg, size, taskId) {
      try {
        var el = mkEl(label, bg, size);
        var mk = new maplibregl.Marker({ element: el }).setLngLat([+lng, +lat]).addTo(map);
        tState.mlMarkers.push(mk);
        if (taskId && taskId !== 'BASE') {
          el.addEventListener('click', function (ev) {
            try { ev.stopPropagation(); } catch (er) {}
            tUnmarkAllPicked();
            var card = document.querySelector('#t-mlist .mtask[data-mid="' + taskId + '"]');
            if (card) { card.classList.add('t-picked'); try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (er) {} }
            try { map.flyTo({ center: [+lng, +lat], zoom: Math.max(map.getZoom(), 16), duration: 450 }); } catch (er) {}
          });
        }
      } catch (e) {}
    }
    addM(base.lat, base.lng, 'Б', '#0f2740', 38, 'BASE');
    (tState.pts || []).forEach(function (p, i) { if (p.lat != null) addM(p.lat, p.lng, String(i + 1), p.mcol || '#2563eb', 34, p.id); });
    (tState.inactivePts || []).forEach(function (p) { if (p.lat != null) addM(p.lat, p.lng, '\u00b7', '#94a3b8', 20, null); });
    var all = [{ lat: base.lat, lng: base.lng }].concat(tState.pts || []).filter(function (p) { return p.lat != null; });
    if (all.length > 1) {
      var b1 = [Infinity, Infinity], b2 = [-Infinity, -Infinity];
      all.forEach(function (p) { b1[0] = Math.min(b1[0], +p.lng); b1[1] = Math.min(b1[1], +p.lat); b2[0] = Math.max(b2[0], +p.lng); b2[1] = Math.max(b2[1], +p.lat); });
      try { map.fitBounds([b1, b2], { padding: 70, pitch: 62, duration: 600 }); } catch (e) {}
    }
  }
  function tG3DSyncRoute(geom) {
    var map = tState.mlmap;
    if (!map) return;
    var run = function () {
      try { if (map.getLayer('t-route')) map.removeLayer('t-route'); } catch (e) {}
      try { if (map.getSource('t-route')) map.removeSource('t-route'); } catch (e) {}
      if (!geom || geom.length < 2) return;
      try {
        // Цвет по пробкам — тот же алгоритм, что на Яндекс-карте
        var h = (typeof currentHourForJam === 'function') ? currentHourForJam() : new Date().getHours();
        var k = (typeof jamFactorByHour === 'function') ? jamFactorByHour(h) : 1.0;
        var stroke = '#2563eb';
        if (k >= 1.45) stroke = '#dc2626';
        else if (k >= 1.30) stroke = '#f59e0b';
        else if (k >= 1.10) stroke = '#10b981';
        var coords = geom.map(function (c) { return [+c[1], +c[0]]; }); // [lat,lng] -> [lng,lat]
        map.addSource('t-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({ id: 't-route', type: 'line', source: 't-route', paint: { 'line-color': stroke, 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      } catch (e) { /* линия не может ломать карту */ }
    };
    try {
      if (map.loaded && map.loaded()) run();
      else map.once('load', run);
    } catch (e) {}
  }

  function drawTestMap(pts) {
    tState.allPts = pts;
    var sel = pts.filter(function (p) { return TS.sel[p.id]; });
    var inactive = pts.filter(function (p) { return !TS.sel[p.id]; });
    tState.inactivePts = inactive;
    tState.pts = sel;
    var holder = document.getElementById('t-canvas');
    if (!holder) return;
    var btn = document.getElementById('t-btn-build-route');
    if (btn) {
      var on = sel.length > 0;
      btn.disabled = !on; btn.style.opacity = on ? '' : '.5'; btn.style.cursor = on ? '' : 'not-allowed';
    }

    // === Выбор движка карты: 'yandex' (по умолчанию) или 'osm' ===
    var useOSM = TS.mapEngine === 'osm';
    var trafBtnHide = document.getElementById('t-btn-traffic');
    // 22.09-173: «Google Earth 3D» — объёмные дома: рисуем MapLibre, Яндекс-карту не создаём
    if (tIsG3D()) { if (trafBtnHide) trafBtnHide.style.display = 'none'; tG3DDraw(holder); return; }
    if (trafBtnHide) trafBtnHide.style.display = '';
    tG3DDestroy(); // не 3D-режим — если холст MapLibre остался, убираем

    ensureYandex(function () {
      if (!document.getElementById('t-canvas')) return; // страницу уже сменили
      try {
        // уходили со страницы? контейнер карты оторван от DOM — пересоздаём карту
        if (tState.ymap) {
          try {
            var ce = tState.ymap.container.getElement();
            if (!ce || !document.body.contains(ce)) { tState.ymap.destroy(); tState.ymap = null; tState.route = null; }
          } catch (e) { tState.ymap = null; tState.route = null; }
        }
        if (!tState.ymap) {
          var mapDiv = document.createElement('div');
          mapDiv.style.cssText = 'position:absolute;inset:0';
          holder.innerHTML = '';
          holder.appendChild(mapDiv);
          // 22.09-167: карта - в сферической проекции (сетка тайлов Google),
          // подложка - по выбору в поле «Карта:». Не удалось зарегистрировать
          // типы - старое поведение (дефолтная схема Яндекса).
          var _mkOk = false;
          try {
            tEnsureMapKindTypes();
            _mkOk = !!(window.ymaps && ymaps.mapType && ymaps.mapType.storage && ymaps.mapType.storage.get(tMapKindTypeKey()) && ymaps.projection && ymaps.projection.sphericalMercator);
          } catch (e) { _mkOk = false; }
          tState._mkOk = _mkOk;
          if (_mkOk) {
            tState.ymap = new ymaps.Map(mapDiv, { center: [53.9023, 27.5619], zoom: 11, type: tMapKindTypeKey(), controls: ['zoomControl'] }, { projection: ymaps.projection.sphericalMercator, suppressMapOpenBlock: true });
          } else {
            tState.ymap = new ymaps.Map(mapDiv, { center: [53.9023, 27.5619], zoom: 11, controls: ['zoomControl'] }, { suppressMapOpenBlock: true });
          }
          // слой Яндекс.Пробок: цвета загруженности + события (аварии, ремонты)
          try {
            tState.traffic = new ymaps.traffic.provider.Actual({}, { infoLayerShown: true });
            if (TS.traffic) tState.traffic.setMap(tState.ymap); // включаются кнопкой «🚦 Пробки»
          } catch (e) { tState.traffic = null; }
        }
        tApplyMapKind();
        tDrawTestMarkers();
        tSyncTrafficBtn();
      } catch (e) { /* карта не может ломать страницу */ }
    }, function () {
      holder.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red);font-weight:700">Карта недоступна — проверьте интернет</div>';
    });
  }
  // маркеры базы и объектов (нумерованные кружки); tState.leafletMarkers — хранилище (имя историческое)
  function tDrawTestMarkers() {
    // 22.09-173: в «Google Earth 3D» маркеры рисуются на MapLibre
    if (tIsG3D()) { tG3DSyncMarkers(); return; }
    // OSM-вариант: маркеры рисуются на Leaflet
    if (TS.mapEngine === 'osm') { tDrawTestMarkersOSM(); return; }
    var map = tState.ymap;
    if (!map) return;
    // Сбрасываем «выбранные» карточки — после перерисовки маркеров старый выбор неактуален
    document.querySelectorAll('#t-mlist .mtask.t-picked').forEach(function (c) {
      c.classList.remove('t-picked');
    });
    document.querySelectorAll('#t-mlist .mtask.t-hover').forEach(function (c) {
      c.classList.remove('t-hover');
    });
    (tState.leafletMarkers || []).forEach(function (m) { try { map.geoObjects.remove(m); } catch (e) {} });
    tState.leafletMarkers = [];
    // Хранилище «активный hover»: id задачи и индекс — чтобы быстро находить пару
    tState._hoveredTask = null;
    var base = currentBase();
    function addMark(lat, lng, label, bg, size, isActive, taskId, idx) {
      try {
        var m = new ymaps.Placemark([+lat, +lng], {}, {
          iconLayout: 'default#image',
          iconImageHref: lmSvgIcon(label, bg, size || 32),
          iconImageSize: [size || 32, size || 32], iconImageOffset: [-(size || 32) / 2, -(size || 32) / 2],
          hasBalloon: false, hasHint: false,
          // 'default#geoObject' — события мыши (mouseenter/click) работают,
          // но без балуна/хинта
          interactivityModel: 'default#geoObject'
        });
        // Сохраняем данные, чтобы обработчик знал, что подсвечивать
        m._taskId = taskId || null;
        m._taskIdx = (typeof idx === 'number') ? idx : -1;
        m._label = label;
        m._bg = bg;
        m._size = size || 32;
        m._isActive = !!isActive;
        map.geoObjects.add(m);
        tState.leafletMarkers.push(m);
        // Подвешиваем hover/click только если это активная задача (есть id)
        if (m._taskId) {
          m.events.add('mouseenter', function () {
            tState._hoveredTask = m._taskId;
            // Увеличиваем и добавляем кольцо подсветки
            try { m.options.set('iconImageHref', lmSvgIcon(m._label, m._bg, m._size + 8, true)); } catch (e) {}
            // Подсвечиваем парную карточку слева
            var card = document.querySelector('#t-mlist .mtask[data-mid="' + m._taskId + '"]');
            if (card) {
              card.classList.add('t-hover');
              // Прокручиваем к карточке, если не видна
              try {
                var rect = card.getBoundingClientRect();
                if (rect.top < 80 || rect.bottom > window.innerHeight - 20) {
                  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              } catch (e) {}
            }
          });
          m.events.add('mouseleave', function () {
            if (tState._hoveredTask === m._taskId) tState._hoveredTask = null;
            try { m.options.set('iconImageHref', lmSvgIcon(m._label, m._bg, m._size, false)); } catch (e) {}
            var card = document.querySelector('#t-mlist .mtask[data-mid="' + m._taskId + '"]');
            if (card) card.classList.remove('t-hover');
          });
          m.events.add('click', function (e) {
            // Не даём карте обрабатывать клик как обычный (балун и пр.)
            try { if (e) e.stopPropagation && e.stopPropagation(); } catch (er) {}
            // Подсветить маркер + карточку как «выбранную» (сильнее hover)
            tUnmarkAllPicked();
            try { m.options.set('iconImageHref', lmSvgIcon(m._label, '#7c3aed', m._size + 8, true)); } catch (er) {}
            var card = document.querySelector('#t-mlist .mtask[data-mid="' + m._taskId + '"]');
            if (card) {
              card.classList.add('t-picked');
              try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (er) {}
            }
            // Центрируем карту на маркере, чуть крупнее
            try {
              map.setCenter([+lat, +lng], Math.max(map.getZoom(), 14), { duration: 250 });
            } catch (er) {}
          });
        }
      } catch (e) {}
    }
    addMark(base.lat, base.lng, 'Б', '#0f2740', 36, false, 'BASE', -1);
    (tState.pts || []).forEach(function (p, i) {
      if (p.lat != null) addMark(p.lat, p.lng, String(i + 1), p.mcol || '#2563eb', 32, true, p.id, i);
    });
    tState.inactivePts.forEach(function (p, i) {
      if (p.lat != null) addMark(p.lat, p.lng, '·', '#94a3b8', 22, false, p.id, -1);
    });
    // Храним для обратной навигации (idx -> marker)
    tState._testMarkersByIdx = {};
    tState.leafletMarkers.forEach(function (m) {
      if (m._taskIdx >= 0) tState._testMarkersByIdx[m._taskIdx] = m;
    });
    var all = [{ lat: base.lat, lng: base.lng }].concat(tState.pts || []);
    var withCoords = all.filter(function (p) { return p.lat != null; });
    if (withCoords.length > 1) {
      var b1 = [Infinity, Infinity], b2 = [-Infinity, -Infinity];
      withCoords.forEach(function (p) { b1[0] = Math.min(b1[0], +p.lat); b1[1] = Math.min(b1[1], +p.lng); b2[0] = Math.max(b2[0], +p.lat); b2[1] = Math.max(b2[1], +p.lng); });
      try { tState.ymap.setBounds([b1, b2], { checkZoomRange: true, zoomMargin: 40 }); } catch (e) {}
    }
  }

  // Утилита: снять со всех маркеров «выбран» и убрать класс t-picked со всех карточек
  function tUnmarkAllPicked() {
    if (!tState || !tState.leafletMarkers) return;
    tState.leafletMarkers.forEach(function (m) {
      if (m._taskId) m.options.set('iconImageHref', lmSvgIcon(m._label, m._bg, m._size, false));
    });
    document.querySelectorAll('#t-mlist .mtask.t-picked').forEach(function (c) {
      c.classList.remove('t-picked');
    });
  }
  // линия маршрута на Яндекс-карте (координаты [[lat,lng],…])
  function tDrawTestRouteLine(geom) {
    tState.routeGeom = geom || null; // 22.09-163: геометрия линии — для экспорта в Google Earth (.kml)
    // 22.09-173: в «Google Earth 3D» линия маршрута — слой на MapLibre
    if (tIsG3D()) { tG3DSyncRoute(geom); return; }
    // OSM-вариант: маршрут рисуется на Leaflet
    if (TS.mapEngine === 'osm') { tDrawTestRouteLineOSM(geom); return; }
    var map = tState.ymap;
    if (!map) return;
    if (tState.route) { try { map.geoObjects.remove(tState.route); } catch (e) {} tState.route = null; }
    if (!geom || geom.length < 2) return;
    try {
      // Цвет маршрута зависит от jamFactorByHour: «нет пробок» — синяя,
      // «лёгкие» — зелёная, «средние» — оранжевая, «тяжёлые» — красная.
      // Пользователь сразу видит, насколько загружено дорога в это время.
      var h = (typeof currentHourForJam === 'function') ? currentHourForJam() : new Date().getHours();
      var k = (typeof jamFactorByHour === 'function') ? jamFactorByHour(h) : 1.0;
      var stroke = '#2563eb'; // синий — ночь/пусто
      if (k >= 1.45) stroke = '#dc2626';          // красный — час пик
      else if (k >= 1.30) stroke = '#f59e0b';      // оранжевый — средние
      else if (k >= 1.10) stroke = '#10b981';      // зелёный — лёгкие нагрузки
      var line = new ymaps.Polyline(geom, {}, {
        strokeColor: stroke, strokeWidth: 5, strokeOpacity: 0.9,
        hasBalloon: false, hasHint: false, interactivityModel: 'default#transparent'
      });
      map.geoObjects.add(line);
      tState.route = line;
      tState.routeJamFactor = k;
    } catch (e) { /* линия не может ломать карту */ }
  }

  /* === OpenStreetMap (Leaflet) вариант для Теста проезда ===
     Замена Яндекс.Карт: тот же набор маркеров/линий, что и tDrawTestMarkers
     + tDrawTestRouteLine, но без Яндекс.Пробок (на OSM пробочного слоя нет). */
  function tDrawTestMarkersOSM() {
    var map = tState.leafletMap;
    if (!map || !window.L) return;
    document.querySelectorAll('#t-mlist .mtask.t-picked').forEach(function (c) { c.classList.remove('t-picked'); });
    document.querySelectorAll('#t-mlist .mtask.t-hover').forEach(function (c) { c.classList.remove('t-hover'); });
    (tState.leafletMarkers || []).forEach(function (m) {
      try { if (m && map.hasLayer) map.removeLayer(m); else if (m && m.remove) m.remove(); } catch (e) {}
    });
    tState.leafletMarkers = [];
    tState._hoveredTask = null;
    var base = currentBase();
    function addMarkOSM(lat, lng, label, bg, size, taskId, idx) {
      try {
        var iconSize = size || 32;
        var html = '<div style="background:' + (bg || '#2563eb') + ';color:#fff;border-radius:50%;width:' + iconSize + 'px;height:' + iconSize + 'px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(iconSize * 0.46) + 'px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">' + label + '</div>';
        var icon = window.L.divIcon({ html: html, className: '', iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize / 2] });
        var m = window.L.marker([+lat, +lng], { icon: icon }).addTo(map);
        m._taskId = taskId || null;
        m._taskIdx = (typeof idx === 'number') ? idx : -1;
        m._label = label;
        m._bg = bg;
        m._size = iconSize;
        tState.leafletMarkers.push(m);
        if (m._taskId) {
          m.on('mouseover', function () {
            tState._hoveredTask = m._taskId;
            try {
              var hlHtml = '<div style="background:' + m._bg + ';color:#fff;border-radius:50%;width:' + (m._size + 8) + 'px;height:' + (m._size + 8) + 'px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round((m._size + 8) * 0.46) + 'px;border:2px solid #fff;box-shadow:0 0 0 3px rgba(255,255,255,.7),0 0 0 6px ' + m._bg + '">' + m._label + '</div>';
              m.setIcon(window.L.divIcon({ html: hlHtml, className: '', iconSize: [m._size + 8, m._size + 8], iconAnchor: [(m._size + 8) / 2, (m._size + 8) / 2] }));
            } catch (e) {}
            var card = document.querySelector('#t-mlist .mtask[data-mid="' + m._taskId + '"]');
            if (card) {
              card.classList.add('t-hover');
              try {
                var rect = card.getBoundingClientRect();
                if (rect.top < 80 || rect.bottom > window.innerHeight - 20) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } catch (e) {}
            }
          });
          m.on('mouseout', function () {
            if (tState._hoveredTask === m._taskId) tState._hoveredTask = null;
            try {
              var baseHtml = '<div style="background:' + m._bg + ';color:#fff;border-radius:50%;width:' + m._size + 'px;height:' + m._size + 'px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(m._size * 0.46) + 'px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">' + m._label + '</div>';
              m.setIcon(window.L.divIcon({ html: baseHtml, className: '', iconSize: [m._size, m._size], iconAnchor: [m._size / 2, m._size / 2] }));
            } catch (e) {}
            var card = document.querySelector('#t-mlist .mtask[data-mid="' + m._taskId + '"]');
            if (card) card.classList.remove('t-hover');
          });
          m.on('click', function () {
            tUnmarkAllPicked();
            try {
              var pkHtml = '<div style="background:#7c3aed;color:#fff;border-radius:50%;width:' + (m._size + 8) + 'px;height:' + (m._size + 8) + 'px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round((m._size + 8) * 0.46) + 'px;border:2px solid #fff;box-shadow:0 0 0 4px rgba(124,58,237,.35)">' + m._label + '</div>';
              m.setIcon(window.L.divIcon({ html: pkHtml, className: '', iconSize: [m._size + 8, m._size + 8], iconAnchor: [(m._size + 8) / 2, (m._size + 8) / 2] }));
            } catch (e) {}
            var card = document.querySelector('#t-mlist .mtask[data-mid="' + m._taskId + '"]');
            if (card) { card.classList.add('t-picked'); try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {} }
            try { map.setView([+lat, +lng], Math.max(map.getZoom(), 14), { animate: true }); } catch (e) {}
          });
        }
      } catch (e) {}
    }
    addMarkOSM(base.lat, base.lng, 'Б', '#0f2740', 36, 'BASE', -1);
    (tState.pts || []).forEach(function (p, i) {
      if (p.lat != null) addMarkOSM(p.lat, p.lng, String(i + 1), p.mcol || '#2563eb', 32, p.id, i);
    });
    (tState.inactivePts || []).forEach(function (p) {
      if (p.lat != null) addMarkOSM(p.lat, p.lng, '·', '#94a3b8', 22, p.id, -1);
    });
    // Bounds
    var all = [{ lat: base.lat, lng: base.lng }].concat(tState.pts || []);
    var withCoords = all.filter(function (p) { return p.lat != null; });
    if (withCoords.length > 1) {
      try { map.fitBounds(withCoords.map(function (p) { return [p.lat, p.lng]; }), { padding: [40, 40] }); } catch (e) {}
    }
  }

  function tDrawTestRouteLineOSM(geom) {
    var map = tState.leafletMap;
    if (!map || !window.L) return;
    if (tState.routeLayer) { try { map.removeLayer(tState.routeLayer); } catch (e) {} tState.routeLayer = null; }
    tState.routeGeom = geom || null;
    if (!geom || geom.length < 2) return;
    try {
      var h = (typeof currentHourForJam === 'function') ? currentHourForJam() : new Date().getHours();
      var k = (typeof jamFactorByHour === 'function') ? jamFactorByHour(h) : 1.0;
      var stroke = '#2563eb';
      if (k >= 1.45) stroke = '#dc2626';
      else if (k >= 1.30) stroke = '#f59e0b';
      else if (k >= 1.10) stroke = '#10b981';
      var line = window.L.polyline(geom, { color: stroke, weight: 5, opacity: 0.9 }).addTo(map);
      tState.routeLayer = line;
      try { map.fitBounds(line.getBounds(), { padding: [60, 60] }); } catch (e) {}
    } catch (e) {}
  }

  /* ПОСТРОЕНИЕ МАРШРУТА НА ТЕСТ-СТРАНИЦЕ — с реальной оптимизацией и пробками.
     Шаг 1. ОПТИМИЗАЦИЯ порядка объезда: база → ближайшая точка → ближайшая
             к прошлой → … → возврат на базу. Глобально — сервис OSRM Trip
             (roundtrip), запасной вариант — «ближайший сосед» (как на карте
             местоположения). Порядок применяется к списку и маркерам.
     Шаг 2. МАРШРУТ по реальным дорогам: официальный роутер Яндекса (если
             задан ключ yandexApiKey) либо дорожный расчёт OSRM с отрисовкой
             на Яндекс-карте. Односторонние дороги учитывает сам дорожный
             граф (движение только по разрешённым направлениям).
     Шаг 3. ПРОБКИ: тайлы Яндекс.Пробок (l=trf, публичные) сэмплируются вдоль
             каждого отрезка маршрута — цвет дороги = загруженность, время
             отрезка умножается на коэффициент. Аварии и ремонты видны на
             карте (слой событий), а их влияние уже входит в пробки. */
  /* ===== СТРАНИЦА «ТЕСТ ПОГОДНЫЙ» (отдельная) ===== */
  var WXT_MINSK_LINES = [[[53.87204,27.37402],[53.86622,27.38274],[53.86039,27.39667],[53.86053,27.39982],[53.86444,27.39974],[53.86433,27.39665],[53.8677,27.39662],[53.86792,27.41058],[53.86964,27.41057],[53.86961,27.42223],[53.85632,27.42895],[53.85055,27.43491],[53.84485,27.44775],[53.84258,27.46672],[53.84094,27.46661],[53.83853,27.46411],[53.83702,27.46831],[53.83637,27.46767],[53.83564,27.46882],[53.83766,27.47277],[53.83579,27.47338],[53.83556,27.47498],[53.83685,27.47558],[53.83628,27.47801],[53.84053,27.48032],[53.8408,27.4819],[53.8356,27.52961],[53.83302,27.53311],[53.83456,27.53904],[53.83266,27.55624],[53.83243,27.575],[53.82433,27.57991],[53.82411,27.57024],[53.81806,27.57457],[53.81685,27.57079],[53.817,27.57451],[53.80045,27.58627],[53.80292,27.58732],[53.8037,27.59083],[53.80002,27.5931],[53.79882,27.588],[53.79385,27.58986],[53.79516,27.59622],[53.79785,27.59473],[53.79875,27.59885],[53.79967,27.59879],[53.79874,27.59432],[53.79991,27.59354],[53.80127,27.59957],[53.80487,27.59728],[53.80576,27.59906],[53.80682,27.5961],[53.81143,27.59317],[53.81358,27.5949],[53.81661,27.5916],[53.8239,27.5927],[53.82596,27.58865],[53.82426,27.58054],[53.83233,27.57602],[53.83304,27.60048],[53.83085,27.60075],[53.83019,27.60207],[53.83022,27.60949],[53.83103,27.61121],[53.83038,27.60298],[53.83129,27.60113],[53.83274,27.601],[53.8339,27.64599],[53.83749,27.6584],[53.84444,27.66784],[53.83825,27.67406],[53.83757,27.67638],[53.83313,27.67897],[53.83071,27.6757],[53.82602,27.66129],[53.82531,27.66222],[53.82304,27.65943],[53.81566,27.65513],[53.81544,27.65663],[53.82359,27.6617],[53.82639,27.66726],[53.82523,27.66918],[53.82316,27.66567],[53.81842,27.67325],[53.82023,27.67617],[53.81893,27.68033],[53.80885,27.67025],[53.80585,27.6819],[53.80481,27.68859],[53.80646,27.69494],[53.81577,27.70754],[53.81782,27.71298],[53.82211,27.70695],[53.8251,27.70614],[53.83105,27.69772],[53.82788,27.714],[53.82963,27.71277],[53.83092,27.71499],[53.83502,27.71396],[53.83612,27.71733],[53.83854,27.7173],[53.83801,27.72107],[53.83941,27.72311],[53.82349,27.75566],[53.82547,27.76976],[53.82415,27.77327],[53.82457,27.78202],[53.83564,27.78253],[53.83731,27.78135],[53.83899,27.78249],[53.83904,27.79706],[53.84042,27.7955],[53.84315,27.80551],[53.84336,27.80829],[53.84188,27.80962],[53.84467,27.81592],[53.85484,27.81844],[53.8549,27.81147],[53.85635,27.81007],[53.85963,27.79623],[53.86,27.79536],[53.86377,27.79579],[53.86568,27.79388],[53.86778,27.7853],[53.86568,27.78302],[53.86572,27.77127],[53.86296,27.75148],[53.86712,27.75427],[53.8694,27.7543],[53.87558,27.77446],[53.87226,27.82888],[53.87576,27.84901],[53.89928,27.84908],[53.89928,27.84113],[53.90252,27.84077],[53.90161,27.83422],[53.90344,27.82956],[53.89933,27.82262],[53.90049,27.81783],[53.90056,27.79281],[53.8999,27.78619],[53.89881,27.78593],[53.89885,27.77552],[53.90152,27.77554],[53.91367,27.74514],[53.91929,27.75222],[53.92139,27.74279],[53.9299,27.74914],[53.92508,27.72662],[53.9267,27.7189],[53.92823,27.71913],[53.93085,27.71579],[53.93114,27.72524],[53.93332,27.73288],[53.93533,27.73177],[53.93546,27.73528],[53.94052,27.73279],[53.94104,27.74517],[53.94785,27.74288],[53.9475,27.74145],[53.95196,27.73975],[53.95176,27.74385],[53.95391,27.74635],[53.95545,27.74632],[53.96109,27.74435],[53.9637,27.73865],[53.95827,27.72452],[53.96012,27.71903],[53.96122,27.69264],[53.95844,27.69216],[53.95911,27.68624],[53.95804,27.68517],[53.95651,27.68649],[53.95746,27.68977],[53.95533,27.69052],[53.95249,27.68038],[53.95319,27.67974],[53.95223,27.67956],[53.95015,27.67252],[53.9516,27.67248],[53.95253,27.67023],[53.95083,27.66418],[53.95002,27.66478],[53.94817,27.66221],[53.94668,27.66429],[53.95784,27.63301],[53.95921,27.63501],[53.96003,27.63334],[53.95858,27.6312],[53.95897,27.63022],[53.96166,27.63213],[53.96379,27.64121],[53.96683,27.64131],[53.96766,27.6323],[53.9663,27.63312],[53.96551,27.63115],[53.96352,27.63327],[53.96401,27.63573],[53.96267,27.63129],[53.96186,27.63209],[53.96096,27.62428],[53.96998,27.59842],[53.9709,27.59871],[53.97055,27.59542],[53.97155,27.59518],[53.97067,27.59489],[53.97179,27.58304],[53.96935,27.50763],[53.96597,27.46931],[53.96174,27.45963],[53.95158,27.44609],[53.95134,27.44057],[53.94889,27.44215],[53.94619,27.43884],[53.94573,27.43215],[53.9434,27.43519],[53.92892,27.41921],[53.91315,27.40998],[53.91159,27.40244],[53.90931,27.40834],[53.90565,27.40678],[53.90203,27.40689],[53.90188,27.4057],[53.90172,27.40683],[53.89149,27.41135],[53.89032,27.40203],[53.8949,27.40265],[53.89816,27.40025],[53.90231,27.40212],[53.90331,27.3988],[53.90182,27.39724],[53.90109,27.39952],[53.89593,27.39976],[53.89459,27.40151],[53.89079,27.40124],[53.88899,27.39909],[53.88581,27.4031],[53.88582,27.41092],[53.88673,27.41247],[53.89097,27.41028],[53.89127,27.41157],[53.87968,27.41715],[53.87892,27.41271],[53.88205,27.41145],[53.88205,27.40853],[53.88049,27.40854],[53.88162,27.39968],[53.87625,27.39981],[53.87625,27.39873],[53.87472,27.39874],[53.87471,27.39479],[53.87624,27.39478],[53.87623,27.38611],[53.87411,27.38612],[53.87308,27.38316],[53.87166,27.37801],[53.87204,27.37402]],[[53.87469,27.87975],[53.8733,27.88032],[53.86993,27.88683],[53.86953,27.89589],[53.86972,27.89703],[53.87147,27.89671],[53.8704,27.90574],[53.87303,27.90628],[53.87282,27.90838],[53.8717,27.90813],[53.87468,27.9181],[53.87697,27.9165],[53.87808,27.91016],[53.87997,27.91017],[53.88004,27.9091],[53.88561,27.90935],[53.88627,27.90401],[53.88778,27.90323],[53.88681,27.89443],[53.88192,27.88873],[53.87712,27.88956],[53.87469,27.87975]],[[53.90107,27.99985],[53.89883,28.00113],[53.88581,28.02039],[53.88406,28.01712],[53.88144,28.02197],[53.88233,28.02544],[53.86236,28.05719],[53.86436,28.06076],[53.86912,28.05735],[53.87042,28.05901],[53.8709,28.05818],[53.87023,28.0619],[53.87372,28.07072],[53.8727,28.07587],[53.87419,28.07995],[53.87687,28.07612],[53.87811,28.079],[53.8794,28.07732],[53.91048,28.03253],[53.92423,28.01032],[53.92199,28.00617],[53.91272,28.02035],[53.90107,27.99985]]];
  var WXT_MINRAY_LINES = [[[53.88508,27.01874],[53.88374,27.02992],[53.89014,27.04993],[53.88832,27.0587],[53.89071,27.06678],[53.88719,27.07767],[53.8844,27.07842],[53.8802,27.07314],[53.8733,27.0778],[53.87246,27.08674],[53.86258,27.08756],[53.85975,27.10019],[53.86358,27.10709],[53.87013,27.10716],[53.86915,27.12124],[53.86529,27.12152],[53.86557,27.12496],[53.86899,27.12558],[53.87109,27.1438],[53.86525,27.16024],[53.85458,27.17716],[53.86346,27.19936],[53.86811,27.1913],[53.87345,27.19855],[53.8599,27.22742],[53.862,27.23095],[53.85759,27.23502],[53.85907,27.23736],[53.85359,27.24594],[53.85483,27.24944],[53.84731,27.26856],[53.84513,27.26506],[53.84262,27.26708],[53.83975,27.25684],[53.83227,27.25974],[53.82978,27.26486],[53.82796,27.2633],[53.82264,27.27626],[53.8185,27.27315],[53.81394,27.27875],[53.81103,27.28667],[53.8129,27.28824],[53.81035,27.28819],[53.7955,27.3291],[53.8033,27.36832],[53.79815,27.37172],[53.7897,27.36499],[53.79107,27.35471],[53.78459,27.34967],[53.77854,27.37844],[53.76967,27.38202],[53.77206,27.39859],[53.76364,27.41269],[53.75754,27.40612],[53.74001,27.41684],[53.72532,27.39601],[53.71475,27.41763],[53.71403,27.44526],[53.71056,27.44914],[53.70863,27.44734],[53.70238,27.45009],[53.69441,27.46684],[53.68376,27.46328],[53.66511,27.47176],[53.66283,27.48336],[53.66521,27.48617],[53.66041,27.48955],[53.66001,27.50383],[53.65559,27.50678],[53.65905,27.51307],[53.65926,27.52916],[53.65643,27.5324],[53.64886,27.53237],[53.65047,27.51931],[53.63514,27.52688],[53.63362,27.53756],[53.62812,27.53254],[53.62709,27.53581],[53.63505,27.57322],[53.638,27.57133],[53.64164,27.60205],[53.64034,27.61931],[53.63502,27.62378],[53.63971,27.6363],[53.64952,27.62974],[53.65289,27.63089],[53.66737,27.65243],[53.67126,27.65345],[53.68088,27.68761],[53.68393,27.71103],[53.7002,27.72058],[53.71778,27.7083],[53.72322,27.72271],[53.72122,27.73031],[53.72348,27.72928],[53.73398,27.75792],[53.73691,27.75524],[53.74007,27.75945],[53.74149,27.7409],[53.75568,27.75708],[53.76515,27.78556],[53.75533,27.84407],[53.75383,27.87305],[53.76256,27.87813],[53.76175,27.91433],[53.76434,27.91587],[53.76794,27.94266],[53.80729,27.96194],[53.8098,27.93847],[53.82207,27.93194],[53.82176,27.90316],[53.81636,27.90398],[53.81469,27.89201],[53.81952,27.88518],[53.81996,27.8781],[53.82392,27.88639],[53.83908,27.87428],[53.84247,27.87494],[53.84312,27.88417],[53.85496,27.8865],[53.85541,27.8833],[53.86554,27.88356],[53.87399,27.86528],[53.87576,27.87704],[53.87877,27.88286],[53.88664,27.88421],[53.88886,27.89644],[53.89468,27.89336],[53.89339,27.88732],[53.90018,27.88902],[53.9038,27.88461],[53.90279,27.90851],[53.90702,27.91559],[53.91086,27.91822],[53.92035,27.91368],[53.92713,27.9178],[53.93448,27.91139],[53.93718,27.9041],[53.94284,27.90944],[53.9473,27.90828],[53.94876,27.90143],[53.95879,27.89459],[53.9614,27.88785],[53.96536,27.89023],[53.96981,27.87876],[53.97413,27.88516],[53.99268,27.88281],[53.98922,27.85793],[53.99336,27.85478],[54.0046,27.84747],[54.01673,27.84829],[54.0173,27.83908],[54.02982,27.84909],[54.02973,27.83868],[54.03619,27.83757],[54.03656,27.82124],[54.04633,27.79456],[54.06246,27.80242],[54.06289,27.79891],[54.07612,27.80354],[54.07868,27.80172],[54.0818,27.78932],[54.09003,27.78213],[54.08636,27.77434],[54.09115,27.77016],[54.08657,27.75881],[54.0916,27.75438],[54.09409,27.73789],[54.0911,27.71871],[54.10482,27.70961],[54.10771,27.71506],[54.11433,27.70761],[54.10893,27.68647],[54.11459,27.67364],[54.11001,27.66464],[54.10678,27.66321],[54.10501,27.66616],[54.10413,27.65649],[54.10815,27.65233],[54.10642,27.6325],[54.10926,27.6273],[54.10292,27.60555],[54.10256,27.61064],[54.0937,27.615],[54.09495,27.63807],[54.09194,27.64321],[54.08238,27.64104],[54.08281,27.64737],[54.07957,27.64596],[54.07972,27.64877],[54.07177,27.65424],[54.064,27.65325],[54.06312,27.63566],[54.07104,27.63187],[54.07531,27.61297],[54.07232,27.59226],[54.07515,27.59614],[54.08425,27.59209],[54.08262,27.58525],[54.08878,27.57415],[54.09587,27.56355],[54.10195,27.56173],[54.10338,27.56463],[54.11313,27.56459],[54.11815,27.56797],[54.12064,27.56471],[54.12179,27.56979],[54.13124,27.56592],[54.13234,27.55966],[54.13799,27.56205],[54.14238,27.55675],[54.14649,27.55447],[54.14703,27.55755],[54.15169,27.55417],[54.15465,27.56998],[54.15818,27.57088],[54.16211,27.56398],[54.17146,27.56868],[54.17391,27.58381],[54.18573,27.56894],[54.19616,27.56801],[54.19523,27.53337],[54.19114,27.52695],[54.18887,27.50372],[54.19056,27.49947],[54.20188,27.49438],[54.20644,27.46032],[54.21279,27.44771],[54.23426,27.44746],[54.23704,27.44313],[54.23358,27.43599],[54.23793,27.4311],[54.24543,27.4403],[54.24737,27.43734],[54.25527,27.43643],[54.25593,27.42509],[54.25039,27.41159],[54.25512,27.40909],[54.25049,27.40325],[54.25179,27.36727],[54.24715,27.35792],[54.236,27.35556],[54.23857,27.35237],[54.23699,27.34758],[54.24394,27.34782],[54.24646,27.33546],[54.24099,27.33441],[54.24133,27.33181],[54.23309,27.33802],[54.23108,27.33174],[54.22654,27.32931],[54.22668,27.32155],[54.22219,27.31354],[54.21409,27.31162],[54.20813,27.30142],[54.20605,27.3006],[54.20391,27.30653],[54.1873,27.30618],[54.18488,27.29948],[54.17121,27.28568],[54.16967,27.28782],[54.16487,27.28387],[54.16477,27.27393],[54.16124,27.27394],[54.15912,27.28265],[54.15705,27.2807],[54.14867,27.29361],[54.14261,27.29217],[54.13551,27.28067],[54.14165,27.26051],[54.14739,27.2536],[54.13527,27.22336],[54.13858,27.21706],[54.13169,27.20945],[54.12868,27.21202],[54.12337,27.21069],[54.12461,27.21914],[54.12052,27.22065],[54.11683,27.21511],[54.10754,27.21646],[54.10677,27.21302],[54.09218,27.21589],[54.08901,27.20508],[54.09153,27.19816],[54.08841,27.19983],[54.08587,27.19404],[54.08461,27.16459],[54.07408,27.16758],[54.07481,27.18857],[54.06708,27.1898],[54.06688,27.17173],[54.04727,27.17065],[54.04528,27.16636],[54.04064,27.17446],[54.04125,27.19226],[54.01961,27.1991],[54.01803,27.18484],[54.00356,27.18388],[54.00595,27.14348],[54.00978,27.13202],[53.98356,27.10168],[53.96958,27.09076],[53.96829,27.08368],[53.96232,27.08525],[53.95602,27.0793],[53.94767,27.07699],[53.94977,27.06928],[53.95257,27.07485],[53.95333,27.07136],[53.94257,27.03251],[53.92772,27.02967],[53.91463,27.03345],[53.91601,27.02697],[53.90775,27.02657],[53.90766,27.02114],[53.90509,27.02051],[53.90366,27.02528],[53.90088,27.01911],[53.88508,27.01874]]];

  /* ===== ТЕСТ ПОГОДНЫЙ: карта осадков на все 24 часа сегодняшнего дня =====
     Только Open-Meteo: ERA5 архив для прошедших часов + DWD ICON-EU для будущих.
     Сетка 16×16 точек по Минску и Минскому району, круги-пятна с градиентом
     через ymSvgLayer, цвет: дождь/снег по интенсивности. Клик по карте —
     DOM-окошко с погодой в точке на выбранный час (Open-Meteo, без ключа).
     Границы Минска и Минского района — линии (OSM). Никаких балунов
     Яндекс.Карт — только DOM-элементы. */
  var WXT = { map: null, selH: -1, svg: null, om: null, timer: null, playTimer: null, ticksBuilt: false };
  function wxtTodayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function initWxTestMap() {
    var holder = (WXT.canvasHolder) || document.getElementById('wxt-map');
    if (!holder) return;
    function wire(id, fn) {
      // Универсальный wire: если есть #id — привязываем
      var b = document.getElementById(id);
      if (b && !b.__wxt) { b.__wxt = 1; b.addEventListener('click', fn); }
    }
    // Play: работает с любым из ID
    wire('wx-tl-play', function () { wxtTogglePlay(); });
    wire('wxt-play', function () { wxtTogglePlay(); });
    var sl = document.getElementById('wx-slider') || document.getElementById('wxt-slider');
    if (sl && !sl.__wxt) {
      sl.__wxt = 1;
      sl.addEventListener('input', function () { wxtShowHour(+sl.value); });
    }
    ensureYandex(function () {
      // Универсальная проверка: карта ещё нужна?
      if (!(WXT.canvasHolder || document.getElementById('wxt-map'))) return;
      try {
        if (WXT.map) {
          try {
            var ce = WXT.map.container.getElement();
            if (!ce || !document.body.contains(ce)) {
              if (WXT.svg) { try { WXT.svg.destroy(); } catch (e) {} WXT.svg = null; }
              WXT.map.destroy(); WXT.map = null;
              WXT.ticksBuilt = false;
            }
          } catch (e) { WXT.map = null; }
        }
        if (!WXT.map) {
          // Универсальный mbox: либо переданный (canvasHolder для модалки),
          // либо #wxt-mapbox на странице «Тест погодный»
          var mbox = document.getElementById('wxt-mapbox');
          if (WXT.canvasHolder) {
            mbox = document.createElement('div');
            mbox.id = 'wx-map-canvas-inner';
            mbox.style.cssText = 'position:absolute;inset:0';
            WXT.canvasHolder.innerHTML = '';
            WXT.canvasHolder.appendChild(mbox);
          }
          var mapDiv = document.createElement('div');
          mapDiv.style.cssText = 'position:absolute;inset:0';
          mbox.innerHTML = '';
          mbox.appendChild(mapDiv);
          WXT.map = new ymaps.Map(mapDiv, { center: [53.9023, 27.5619], zoom: 9, type: null, controls: ['zoomControl'] }, { projection: ymaps.projection.sphericalMercator, maxZoom: 16, minZoom: 3, suppressMapOpenBlock: true });
          omEnsureBasemapTypes();
          try { WXT.map.setType('sp#yandex'); } catch (e) {}
          try { WXT.svg = ymSvgLayer(WXT.map, mapDiv); } catch (e) { WXT.svg = null; } // поле осадков Open-Meteo
          // границы: г. Минск (красная линия) и Минский район (синяя пунктирная)
          try {
            WXT_MINSK_LINES.forEach(function (line) {
              WXT.map.geoObjects.add(new ymaps.Polyline(line, {}, { strokeColor: '#e11d48', strokeWidth: 3, strokeOpacity: 0.9, hasBalloon: false, hasHint: false }));
            });
            WXT_MINRAY_LINES.forEach(function (line) {
              WXT.map.geoObjects.add(new ymaps.Polyline(line, {}, { strokeColor: '#2563eb', strokeWidth: 3, strokeOpacity: 0.85, strokeStyle: 'dash', hasBalloon: false, hasHint: false }));
            });
          } catch (e) {}
          // клик по карте → DOM-окошко с погодой в точке (никаких балунов Яндекса)
          WXT.map.events.add('click', function (e) {
            try {
              var coords = e.get('coords');
              var cx = null, cy = null;
              try { var cp = e.get('clientPixels'); if (cp) { cx = cp[0]; cy = cp[1]; } } catch (er) {}
              if (cx == null) {
                try {
                  var de = e.get('domEvent');
                  var oe = de && de.originalEvent;
                  if (oe && typeof oe.clientX === 'number') { cx = oe.clientX; cy = oe.clientY; }
                } catch (er) {}
              }
              wxtPopShow([+coords[0], +coords[1]], cx == null ? null : [cx, cy]);
            } catch (er) {}
          });
          // при перемещении/зуме карты окошко погоды закрывается
          WXT.map.events.add('actionstart', function () { wxtPopHide(); });
        }
        wxtLoad();
      } catch (e) { /* погодная карта не может ломать страницу */ }
    }, function () {
      var h2 = (WXT.canvasHolder) || document.getElementById('wxt-map');
      if (h2) h2.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red);font-weight:700">Карта недоступна — проверьте интернет</div>';
    });
    clearInterval(WXT.timer);
    WXT.timer = setInterval(function () {
      if (!(WXT.canvasHolder || document.getElementById('wxt-map'))) { clearInterval(WXT.timer); return; }
      wxtLoad();
    }, 30 * 60 * 1000); // обновление Open-Meteo каждые 30 минут
  }
  function wxtLoad() {
    // Только Open-Meteo: ERA5 архив (прошлое) + DWD ICON-EU (будущее)
    if (WXT.selH < 0) WXT.selH = new Date().getHours(); // по умолчанию — текущий час
    wxtLoadOm();
  }
  /* Кэш радара больше не используется — оставлен пустой stub для совместимости
     (если в старых вкладках браузера есть localStorage записи — просто игнорируем). */
  var WXT_CACHE_KEY = 'smartplan_wx_radar_cache';
  /* сетка 7×7 по Минску и Минскому райку → Open-Meteo, осадки на сегодня по часам */
  function wxtLoadOm() {
    // 10 широт × 10 долгот = 100 точек сетки. Open-Meteo возвращает массив из
    // 100 объектов, у каждого свой .hourly.time (одинаковой длины) и
    // .hourly.precipitation/.hourly.snowfall. Это даёт сетку 10×10 для карты.
    // 16×16 = 256 точек (в 2.56 раза больше 10×10), шаг ~2.5 км,
    // покрытие Минска и Минского района. Радиус пятен уменьшен до 3.25 км
    // для плотного перекрытия без крупных перетеканий.
    var lats = [];
    for (var la_i = 0; la_i < 16; la_i++) lats.push(+(53.65 + la_i * 0.038).toFixed(3));
    var lngs = [];
    for (var ln_i = 0; ln_i < 16; ln_i++) lngs.push(+(27.05 + ln_i * 0.059).toFixed(3));
    var flatLats = [], flatLngs = [], pts = [];
    for (var li = 0; li < lats.length; li++) for (var ki = 0; ki < lngs.length; ki++) {
      flatLats.push(lats[li]); flatLngs.push(lngs[ki]); pts.push([lats[li], lngs[ki]]);
    }
    var today = wxtTodayStr();
    var nowH = new Date().getHours();

    function applyResults(histArr, fcArr) {
      var histIdx = (histArr[0].hourly.time || []).indexOf(today + 'T00:00');
      var fcIdx = (fcArr[0].hourly.time || []).indexOf(today + 'T00:00');
      if (histIdx === -1 || fcIdx === -1) { fallback(); return; }
      var pr = [], sf = [];
      for (var h = 0; h < 24; h++) {
        var src = (h <= nowH) ? histArr : fcArr;
        var idx = (h <= nowH) ? histIdx : fcIdx;
        var row = [], rowS = [];
        for (var i = 0; i < src.length; i++) {
          var hr = src[i] && src[i].hourly;
          if (!hr || !hr.time || !hr.time[idx + h]) continue;
          row.push(+((hr.precipitation || [])[idx + h] || 0));
          rowS.push(+((hr.snowfall || [])[idx + h] || 0));
        }
        pr.push(row); sf.push(rowS);
      }
      WXT.om = { points: pts, pr: pr, sf: sf, source: 'archive+icon' };
      wxtShowHour(WXT.selH < 0 ? nowH : WXT.selH);
    }

    function fallback() {
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + flatLats.join(',') +
        '&longitude=' + flatLngs.join(',') +
        '&hourly=precipitation,snowfall&past_days=1&forecast_days=1&timezone=Europe%2FMinsk';
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        var arr = Array.isArray(j) ? j : [j];
        if (!arr.length || !arr[0].hourly) return;
        var idx0 = (arr[0].hourly.time || []).indexOf(today + 'T00:00');
        if (idx0 === -1) return;
        var pr = [], sf = [];
        for (var h = 0; h < 24; h++) {
          var row = [], rowS = [];
          for (var i = 0; i < arr.length; i++) {
            var hr = arr[i] && arr[i].hourly;
            if (!hr || !hr.time || !hr.time[idx0 + h]) continue;
            row.push(+((hr.precipitation || [])[idx0 + h] || 0));
            rowS.push(+((hr.snowfall || [])[idx0 + h] || 0));
          }
          pr.push(row); sf.push(rowS);
        }
        WXT.om = { points: pts, pr: pr, sf: sf, source: 'forecast' };
        wxtShowHour(WXT.selH < 0 ? nowH : WXT.selH);
      });
    }

    var histUrl = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + flatLats.join(',') +
      '&longitude=' + flatLngs.join(',') +
      '&hourly=precipitation,snowfall&start_date=' + today + '&end_date=' + today + '&timezone=Europe%2FMinsk';
    var fcUrl = 'https://api.open-meteo.com/v1/dwd-icon?latitude=' + flatLats.join(',') +
      '&longitude=' + flatLngs.join(',') +
      '&hourly=precipitation,snowfall&past_hours=0&forecast_hours=24&timezone=Europe%2FMinsk';
    Promise.all([
      fetch(histUrl).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(fcUrl).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (r) {
      if (!r[0] || !r[1]) { fallback(); return; }
      applyResults(r[0], r[1]);
    }).catch(function () { fallback(); });
  }

  function wxtOmColor(pr, sf) {
    if (sf > 0) {
      if (sf < 0.25) return { c: '#b8f8ff', o: 0.4 };
      if (sf < 0.75) return { c: '#7fbfff', o: 0.5 };
      if (sf < 1.5) return { c: '#4888ff', o: 0.55 };
      return { c: '#0028ff', o: 0.6 };
    }
    if (pr > 0) {
      if (pr < 0.3) return { c: '#88ddee', o: 0.38 };
      if (pr < 1) return { c: '#00a3e0', o: 0.45 };
      if (pr < 2.5) return { c: '#005588', o: 0.55 };
      if (pr < 6) return { c: '#004a70', o: 0.6 };
      if (pr < 10) return { c: '#ffee00', o: 0.55 };
      if (pr < 18) return { c: '#ff8100', o: 0.6 };
      return { c: '#c10000', o: 0.65 };
    }
    return null;
  }
  /* Проверка: точка внутри полигона (ray casting) */
  function pointInPolygon(lat, lng, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  /* Проверка: точка внутри любого полигона из массива */
  function pointInAnyPolygon(lat, lng, polygons) {
    for (var p = 0; p < polygons.length; p++) {
      if (pointInPolygon(lat, lng, polygons[p])) return true;
    }
    return false;
  }
  function wxtDrawOmHour(h) {
    if (!WXT.svg || !WXT.om || !WXT.om.pr[h]) { if (WXT.svg) WXT.svg.set([]); return; }
    var items = [];
    var pt = WXT.om.points, pr = WXT.om.pr[h], sf = WXT.om.sf[h];
    // Рисуем только точки внутри контура Минского района
    for (var i = 0; i < pt.length; i++) {
      var col = wxtOmColor(pr[i], sf[i]);
      if (col && pointInAnyPolygon(pt[i][0], pt[i][1], WXT_MINRAY_LINES)) {
        items.push({ kind: 'blob', lat: pt[i][0], lng: pt[i][1], radiusM: 3250, color: col.c, opacity: col.o, gid: i });
      }
    }
    WXT.svg.set(items);
  }
  function wxtShowHour(h) {
    if (WXT.selH < 0 && h == null) return;
    h = ((Math.round(h) % 24) + 24) % 24;
    WXT.selH = h;

    // Open-Meteo — ТОЛЬКО прогноз модели (без радара)
    if (WXT.svg) {
      if (WXT.om && WXT.om.pr[h]) { wxtDrawOmHour(h); }
      else WXT.svg.set([]);
    }

    // Подпись (страница «Тест погодный»)
    var lbl = document.getElementById('wxt-label');
    if (lbl) {
      var hh = String(h).padStart(2, '0') + ':00';
      var omSrc = (WXT.om && WXT.om.source) || '—';
      var parts = ['Час: ' + hh];
      if (omSrc === 'archive+icon') parts.push('архив прошлое + ICON-EU будущее');
      else if (omSrc === 'archive') parts.push('Архив Open-Meteo');
      else if (omSrc === 'forecast') parts.push('Прогноз Open-Meteo');
      else parts.push('Open-Meteo (' + omSrc + ')');
      lbl.textContent = parts.join(' · ');
    }
    // Модалка карты погоды: блок справа от ползунка (температура + осадки)
    var hi = document.getElementById('wx-hour-info');
    if (hi) {
      var avg = { p: 0, c: 0 };
      if (WXT.om && WXT.om.pr && WXT.om.pr[h]) {
        WXT.om.pr[h].forEach(function (v) { if (v > 0) { avg.p += v; avg.c++; } });
        avg.p = avg.c ? avg.p / avg.c : 0;
      }
      var snw = { p: 0, c: 0 };
      if (WXT.om && WXT.om.sf && WXT.om.sf[h]) {
        WXT.om.sf[h].forEach(function (v) { if (v > 0) { snw.p += v; snw.c++; } });
        snw.p = snw.c ? snw.p / snw.c : 0;
      }
      hi.innerHTML = '<div style="font-weight:800;font-size:13px">' + (String(h).padStart(2, '0')) + ':00</div>' +
        '<div style="color:#64748b;font-size:12px">' +
        (snw.p > 0.05 ? '❄️ ' + (snw.p).toFixed(2) + ' см/ч' :
         avg.p > 0.05 ? '🌧 ' + (avg.p).toFixed(2) + ' мм/ч' : '☀️ без осадков') + '</div>';
    }
    wxtSyncBar();
  }
  function wxtSyncBar() {
    // Универсальный поиск элементов: сначала новые ID модалки, потом старые
    var sl = document.getElementById('wx-slider') || document.getElementById('wxt-slider');
    var ticks = document.getElementById('wx-ticks') || document.getElementById('wxt-ticks');
    var bt = document.getElementById('wx-bar-time') || document.getElementById('wxt-bar-time');
    if (!sl || !ticks) return;
    if (!WXT.ticksBuilt) {
      WXT.ticksBuilt = true;
      sl.max = 23;
      var nowH = new Date().getHours();
      var h = '';
      for (var i = 0; i < 24; i++) {
        h += '<span style="position:absolute;left:' + ((i / 23) * 100).toFixed(2) + '%;transform:translateX(-50%);white-space:nowrap' +
          (i === nowH ? ';font-weight:800;color:#0f2740' : '') + '" title="' + String(i).padStart(2, '0') + ':00' + (i === nowH ? ' (сейчас)' : '') + '">' + String(i).padStart(2, '0') + '</span>';
      }
      ticks.innerHTML = h;
    }
    if (bt) bt.textContent = WXT.selH >= 0 ? String(WXT.selH).padStart(2, '0') + ':00' : '—';
    sl.value = WXT.selH;
  }
  function wxtTogglePlay() {
    // Универсальный поиск Play-кнопки (модалка и страница)
    var btn = document.getElementById('wx-tl-play') || document.getElementById('wxt-play');
    if (WXT.playTimer) {
      clearInterval(WXT.playTimer); WXT.playTimer = null;
      if (btn) btn.textContent = '▶';
      return;
    }
    if (btn) btn.textContent = '⏸';
    WXT.playTimer = setInterval(function () {
      // Модалка ещё открыта ИЛИ страница теста активна
      if (!document.getElementById('wx-map-overlay') && !document.getElementById('wxt-map')) {
        clearInterval(WXT.playTimer); WXT.playTimer = null;
        if (btn) btn.textContent = '▶';
        return;
      }
      wxtShowHour(WXT.selH + 1);
    }, 900);
  }

  /* ===== Окошко погоды по клику (Open-Meteo, бесплатно и без ключа) =====
     Показывает погоду в точке на ВЫБРАННЫЙ час ползунка. */
  function wxtPopHide() {
    var p = document.getElementById('wxt-pop');
    if (p) p.remove();
  }
  function wxtWeatherText(code) {
    if (code === 0) return '☀ ясно';
    if (code === 1) return '🌤 малооблачно';
    if (code === 2) return '⛅ переменная облачность';
    if (code === 3) return '☁ пасмурно';
    if (code === 45 || code === 48) return '🌫 туман';
    if (code >= 51 && code <= 55) return '🌦 морось';
    if (code === 56 || code === 57) return '🌧 ледяная морось';
    if (code === 61) return '🌧 дождь (слабый)';
    if (code === 63) return '🌧 дождь (умеренный)';
    if (code === 65) return '🌧 дождь (сильный)';
    if (code === 66 || code === 67) return '🌧 ледяной дождь';
    if (code === 71) return '🌨 снег (слабый)';
    if (code === 73) return '🌨 снег (умеренный)';
    if (code === 75) return '🌨 снег (сильный)';
    if (code === 77) return '🌨 снежные зёрна';
    if (code >= 80 && code <= 82) return '🌧 ливень';
    if (code === 85 || code === 86) return '🌨 снегопад (ливневый)';
    if (code >= 95) return '⛈ гроза';
    return '';
  }
  function wxtPopShow(coords, clientPx) {
    wxtPopHide();
    var hour = WXT.selH >= 0 ? WXT.selH : new Date().getHours();
    var hourLbl = String(hour).padStart(2, '0') + ':00' + (hour === new Date().getHours() ? ' (сейчас)' : '');
    var d = document.createElement('div');
    d.id = 'wxt-pop';
    d.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 26px 10px 12px;font-size:12px;line-height:1.6;color:var(--ink);pointer-events:none;box-shadow:0 6px 20px rgba(15,39,64,.18);max-width:250px';
    // маленький крестик закрытия (единственный кликабельный элемент окошка)
    d.innerHTML = '<button type="button" id="wxt-pop-x" title="Закрыть" style="position:absolute;right:3px;top:3px;width:19px;height:19px;line-height:17px;text-align:center;border:none;background:transparent;color:#94a3b8;font-size:14px;font-family:inherit;cursor:pointer;pointer-events:auto;border-radius:5px;padding:0">✕</button>' +
      '<div id="wxt-pop-c"><div style="font-weight:800">⏳ Погода…</div>' +
      '<div style="color:var(--muted);font-size:11px">' + coords[0].toFixed(4) + ', ' + coords[1].toFixed(4) + '</div></div>';
    document.body.appendChild(d);
    var xb = document.getElementById('wxt-pop-x');
    if (xb) xb.addEventListener('click', function (ev) { ev.stopPropagation(); wxtPopHide(); });
    var x = clientPx ? clientPx[0] : window.innerWidth / 2;
    var y = clientPx ? clientPx[1] : window.innerHeight / 2;
    var w = d.offsetWidth || 200, h = d.offsetHeight || 80;
    d.style.left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8) + 'px';
    d.style.top = Math.min(Math.max(8, y - h - 14), window.innerHeight - h - 8) + 'px';
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + coords[0] + '&longitude=' + coords[1] +
      '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,snowfall,weather_code' +
      '&past_days=1&forecast_days=1&timezone=Europe%2FMinsk&wind_speed_unit=ms')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var c = document.getElementById('wxt-pop-c');
        if (!c) return; // окошко уже закрыли
        var hourly = j && j.hourly, vals = null;
        if (hourly && hourly.time) {
          var idx = hourly.time.indexOf(wxtTodayStr() + 'T' + String(hour).padStart(2, '0') + ':00');
          if (idx !== -1) {
            vals = {
              t: +(hourly.temperature_2m || [])[idx] || 0,
              ws: +(hourly.wind_speed_10m || [])[idx] || 0,
              wd: +(hourly.wind_direction_10m || [])[idx] || 0,
              pr: +(hourly.precipitation || [])[idx] || 0,
              sf: +(hourly.snowfall || [])[idx] || 0,
              wc: +(hourly.weather_code || [])[idx] || 0
            };
          }
        }
        if (!vals && j && j.current) {
          vals = { t: +j.current.temperature_2m || 0, ws: +j.current.wind_speed_10m || 0, wd: +j.current.wind_direction_10m || 0, pr: +j.current.precipitation || 0, sf: +j.current.snowfall || 0, wc: +j.current.weather_code || 0 };
        }
        if (!vals) { c.innerHTML = '<b>Погода</b><br>нет данных'; return; }
        var dirs = ['северный', 'северо-восточный', 'восточный', 'юго-восточный', 'южный', 'юго-западный', 'западный', 'северо-западный'];
        var wd = dirs[Math.round((((+vals.wd || 0) % 360) + 360) % 360 / 45) % 8];
        var prec = 'осадков нет';
        if (vals.sf > 0) prec = '🌨 снег ' + vals.sf + ' см/ч';
        else if (vals.pr > 0) prec = '🌧 дождь ' + vals.pr + ' мм/ч';
        var wc = wxtWeatherText(+vals.wc || 0);
        c.innerHTML = '<div style="font-weight:800;margin-bottom:2px">📍 Погода в точке · на ' + hourLbl + '</div>' +
          '<div style="color:var(--muted);font-size:11px;margin-bottom:4px">' + coords[0].toFixed(4) + ', ' + coords[1].toFixed(4) + '</div>' +
          '<div>🌡 Температура: <b>' + (vals.t > 0 ? '+' : '') + vals.t + ' °C</b></div>' +
          '<div>💨 Ветер: <b>' + vals.ws + ' м/с</b>, ' + wd + '</div>' +
          (wc ? '<div>' + wc + '</div>' : '') +
          '<div>' + prec + '</div>' +
          '<div style="color:var(--muted);font-size:10.5px;margin-top:3px">Open-Meteo</div>';
      })
      .catch(function () {
        var c2 = document.getElementById('wxt-pop-c');
        if (c2) c2.innerHTML = '<b>Погода</b><br>нет связи с Open-Meteo';
      });
  }

  function tSyncTrafficBtn() {
    var b = document.getElementById('t-btn-traffic');
    if (!b) return;
    var on = !!TS.traffic;
    b.style.background = on ? '#dc2626' : '';
    b.style.color = on ? '#fff' : '';
    b.style.borderColor = on ? '#dc2626' : '';
  }

  // Цвет пикселя тайла пробок → коэффициент времени (калибровано по Яндексу:
  // зелёный 94,205,76 — свободно; жёлтый 255,187,51 — умеренно; красный 230,90,70 — затор)
  function tJamFactor(r, g, b, a) {
    if (a < 60) return null; // прозрачный — не дорога
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 30 || mx < 90) return null; // серый/тёмный — не пробки
    if (r > 170 && r - g > 60) return r - g > 120 ? 2.4 : 1.9; // красный/малиновый — затор
    if (r > 170 && g > 140 && b < 130) return 1.4;             // жёлтый — умеренно
    if (g > 150 && r > 120) return 1.15;                        // жёлто-зелёный
    if (g > 140) return 1.0;                                    // зелёный — свободно
    return null;
  }

  /* Пробки вдоль маршрута: точки геометрии сэмплируются по тайлам Яндекс.Пробок,
     коэффициенты (tJamFactor) усредняются по отрезкам. Тайлы могут быть
     недоступны (нет публичного URL / CORS) — тогда отдаём ok:false, и время
     остаётся без пробок (как на карте маршрутов). */
  function tJamsAdjust(geometry, legMin, wps, finish) {
    // ЧАСОВАЯ МОДЕЛЬ ПРОБОК (Минск, будни/выходные): всегда работает,
    // не требует сети/ключей. Раньше пытались читать тайлы Яндекс.Пробок
    // через canvas — но они не отдают CORS для анонимных доменов,
    // getImageData падал с SecurityError, и весь блок просто замолкал.
    // Теперь — простая, всегда рабочая модель: время *= jamFactorByHour(h).
    try {
      if (TS.noJam) { finish({ ok: false }); return; }
      if (!legMin || legMin.length === 0) { finish({ ok: false }); return; }
      var h = currentHourForJam ? currentHourForJam() : new Date().getHours();
      var jamK = typeof jamFactorByHour === 'function' ? jamFactorByHour(h) : 1.0;
      var perLeg = [];
      var total = 0;
      for (var i = 0; i < legMin.length; i++) {
        var baseMin = Math.max(1, legMin[i] || 0);
        var m2 = Math.max(1, Math.round(baseMin * jamK));
        perLeg.push(m2);
        total += m2;
      }
      finish({ ok: true, perLeg: perLeg, total: total, source: 'hour_model', hour: h, factor: jamK });
    } catch (e) {
      finish({ ok: false });
    }
  }

  /* OSRM Trip для стартового порядка точек — звено многостартовой оптимизации */

  /* OSRM route (НЕ trip) по фиксированному порядку — даёт ровно тот
     маршрут, который соответствует заданному порядку точек. Используется
     на этапе сравнения «какой из кандидатов-порядков короче». */
  function tRouteCall(pts, base, cb) {
    var coords = [[base.lng, base.lat]];
    pts.forEach(function (p) { if (p.lat != null) coords.push([p.lng, p.lat]); });
    coords.push([base.lng, base.lat]);
    var coordStr = coords.map(function (c) { return c.join(','); }).join(';');
    var url = 'https://router.project-osrm.org/route/v1/driving/' + coordStr +
      '?overview=simplified&geometries=geojson&steps=false';
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 10000);
    var opts = ctrl ? { signal: ctrl.signal } : {};
    fetch(url, opts).then(function (resp) { return resp.json(); }).then(function (res) {
      clearTimeout(timer);
      if (res && res.routes && res.routes[0]) {
        var rt = res.routes[0];
        cb({
          order: pts.slice(),
          km: rt.distance / 1000,
          min: Math.round(rt.duration / 60),
          legs: rt.legs || [],
          geometry: (rt.geometry && rt.geometry.coordinates) || []
        });
      } else cb(null);
    }).catch(function (e) { clearTimeout(timer); cb(null); });
  }

  /* «Ближайший сосед», начиная с заданной точки (стартовое порядок для многостартовой) */

  /* Жадная вставка: лучшая точка вставляется туда, где даёт минимум прироста дистанции.
     Используется как ещё один seed (часто даёт лучший результат, чем NN). */
  function tFarthestInsertion(base, pts) {
    if (!pts.length) return [];
    // Стартуем с двух самых далёких друг от друга точек
    var bi = 0, bj = 1, bd = -1;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var d = distKm(pts[i], pts[j]);
        if (d > bd) { bd = d; bi = i; bj = j; }
      }
    }
    var remaining = pts.slice();
    var ordered = [remaining[bi], remaining[bj]];
    remaining.splice(bj, 1); remaining.splice(bi, 1);
    while (remaining.length) {
      var bestPos = 0, bestPt = 0, bestInc = Infinity;
      // Для каждой оставшейся точки и каждой позиции в текущем маршруте считаем прирост
      for (var pi = 0; pi < remaining.length; pi++) {
        var pt = remaining[pi];
        for (var oi = 0; oi <= ordered.length; oi++) {
          var prev = oi === 0 ? base : ordered[oi - 1];
          var next = oi === ordered.length ? base : ordered[oi];
          var inc = distKm(prev, pt) + distKm(pt, next) - distKm(prev, next);
          if (inc < bestInc) { bestInc = inc; bestPos = oi; bestPt = pi; }
        }
      }
      ordered.splice(bestPos, 0, remaining[bestPt]);
      remaining.splice(bestPt, 1);
    }
    return ordered;
  }

  /* 2-opt локальное улучшение: переворачиваем сегменты между i и j, если это
     уменьшает длину маршрута. Работает по прямой дистанции (быстро). */
  function tTwoOptImprove(base, pts) {
    if (pts.length < 4) return pts;
    var ordered = pts.slice();
    var improved = true, guard = 0;
    while (improved && guard < 60) {
      improved = false; guard++;
      for (var i = 1; i < ordered.length - 1; i++) {
        for (var j = i + 1; j < ordered.length; j++) {
          var a = (i === 1) ? base : ordered[i - 2];
          var b = ordered[i - 1];
          var c = ordered[j];
          var d = (j === ordered.length - 1) ? base : ordered[j + 1];
          var before = distKm(a, b) + distKm(c, d);
          var after = distKm(a, c) + distKm(b, d);
          if (after + 1e-9 < before) {
            // Перевернуть подмассив [i-1 .. j]
            var left = i - 1, right = j;
            while (left < right) {
              var tmp = ordered[left]; ordered[left] = ordered[right]; ordered[right] = tmp;
              left++; right--;
            }
            improved = true;
          }
        }
      }
    }
    return ordered;
  }

  /* NN (Nearest Neighbor) от конкретной точки — для многостартовой оптимизации. */
  function lmNearestOrder_NNFrom(start, pts) {
    var remaining = pts.filter(function (p) { return p !== start; });
    var ordered = [start], cur = start;
    while (remaining.length) {
      var bi = 0, bd = Infinity;
      for (var i = 0; i < remaining.length; i++) {
        var d = (remaining[i].lat != null && remaining[i].lng != null) ? distKm(cur, remaining[i]) : 1e9;
        if (d < bd) { bd = d; bi = i; }
      }
      var chosen = remaining.splice(bi, 1)[0];
      ordered.push(chosen); cur = chosen;
    }
    return ordered;
  }

  /* Предсказанная «длина» маршрута по прямой (haversine). Используется для
     сортировки сидов — лучшие в OSRM первыми. */
  function tPredictedKm(base, order) {
    if (!order || !order.length) return Infinity;
    var total = 0;
    var cur = base;
    for (var i = 0; i < order.length; i++) {
      if (order[i].lat != null && order[i].lng != null) {
        total += distKm(cur, order[i]);
        cur = order[i];
      }
    }
    if (cur && base) total += distKm(cur, base);
    return total;
  }

  /* OSRM Table API — возвращает матрицу всех пар (lat,lng).
   Позволяет найти NN/2-opt по ДОРОЖНОЙ матрице за O(n²), 1 HTTP-запрос. */
  function tMatrixCall(coords, cb) {
    var coordStr = coords.map(function (c) { return c.join(','); }).join(';');
    var url = 'https://router.project-osrm.org/table/v1/driving/' + coordStr + '?annotations=distance,duration';
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 15000);
    var opts = ctrl ? { signal: ctrl.signal } : {};
    fetch(url, opts).then(function (resp) { return resp.json(); }).then(function (res) {
      clearTimeout(timer);
      if (res && res.code === 'Ok' && res.distances && res.durations) cb(res);
      else cb(null);
    }).catch(function (e) { clearTimeout(timer); cb(null); });
  }

  /* Решаем round-trip TSP по матрице дистанций.
     По матрице делаем: NN от каждой точки + 2-opt + or-opt.
     Возвращаем самый короткий найденный порядок и его длину. */
  function tSolveMatrixFromBase(distMat, baseIdx, ptsCount) {
    var bestOrder = null, bestLen = Infinity;
    if (ptsCount < 2) {
      if (ptsCount === 1) {
        return { order: [1], len: distMat[baseIdx][1] * 2 };
      }
      return { order: [], len: 0 };
    }
    function routeLenArr(arr) {
      if (!arr || !arr.length) return 0;
      var L = distMat[baseIdx][arr[0]];
      for (var i = 0; i < arr.length - 1; i++) L += distMat[arr[i]][arr[i + 1]];
      L += distMat[arr[arr.length - 1]][baseIdx];
      return L;
    }
    // Перебираем все старты — и для каждого делаем 2-opt + or-opt,
    // потом 2-opt ещё раз (чередование помогает сойтись к лучшему локальному оптимуму).
    for (var start = 1; start <= ptsCount; start++) {
      var order = [];
      var visited = {};
      visited[baseIdx] = true; visited[start] = true;
      order.push(start);
      var cur = start;
      while (order.length < ptsCount) {
        var bestNext = -1, bestDist = Infinity;
        for (var n = 1; n <= ptsCount; n++) {
          if (visited[n]) continue;
          if (distMat[cur][n] < bestDist) {
            bestDist = distMat[cur][n];
            bestNext = n;
          }
        }
        if (bestNext < 0) break;
        order.push(bestNext);
        visited[bestNext] = true;
        cur = bestNext;
      }
      // Серия локальных улучшений: 2-opt → or-opt → 2-opt → or-opt.
      // 30 итераций достаточно для 7-15 точек.
      var prevLen = routeLenArr(order);
      for (var pass = 0; pass < 6; pass++) {
        order = tMatrix2opt(baseIdx, order, distMat);
        order = tMatrixOrOpt(baseIdx, order, distMat);
        var curL = routeLenArr(order);
        if (curL + 0.5 >= prevLen) break;
        prevLen = curL;
      }
      var L = routeLenArr(order);
      if (L < bestLen) {
        bestLen = L;
        bestOrder = order.slice();
      }
    }
    return { order: bestOrder || [], len: bestLen };
  }

  function tMatrix2opt(baseIdx, order, mat) {
    var n = order.length;
    if (n < 4) return order.slice();
    var o = order.slice();
    var improved = true, guard = 0;
    while (improved && guard < 120) {
      improved = false; guard++;
      for (var i = 0; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
          var a = (i === 0) ? baseIdx : o[i - 1];
          var b = o[i];
          var c = o[j];
          var d = (j === n - 1) ? baseIdx : o[j + 1];
          var before = mat[a][b] + mat[c][d];
          var after = mat[a][c] + mat[b][d];
          if (after + 1 < before) {
            // Перевернуть подмассив o[i..j]
            var left = i, right = j;
            while (left < right) {
              var tmp = o[left]; o[left] = o[right]; o[right] = tmp;
              left++; right--;
            }
            improved = true;
          }
        }
      }
    }
    return o;
  }

  function tMatrixOrOpt(baseIdx, order, mat) {
    var n = order.length;
    if (n < 5) return order.slice();
    var o = order.slice();
    function routeLen(rr) {
      if (!rr || !rr.length) return 0;
      var t = mat[baseIdx][rr[0]];
      for (var i = 0; i < rr.length - 1; i++) t += mat[rr[i]][rr[i + 1]];
      t += mat[rr[rr.length - 1]][baseIdx];
      return t;
    }
    var baseLen = routeLen(o);
    var improved = true, guard = 0;
    while (improved && guard < 60) {
      improved = false; guard++;
      // Перебираем все варианты перемещения сегмента из 1, 2, 3 элементов
      // в любую другую позицию. Для каждого варианта — честно считаем новую длину.
      for (var segLen = 1; segLen <= 3; segLen++) {
        for (var i = 0; i + segLen <= o.length; i++) {
          for (var t = 0; t <= o.length - segLen; t++) {
            // t = позиция вставки после удаления сегмента [i..i+segLen-1].
            // t < i — вставка ПЕРЕД позицией i в исходном массиве.
            // t >= i — вставка на «его же место» (нет смысла) или после.
            // Проверяем, что НЕ та же позиция:
            if (t === i || t === i + 1) continue;
            // Применяем
            var newO = o.slice();
            var seg = newO.splice(i, segLen);
            // После splice длина newO = o.length - segLen
            // t — позиция вставки в укороченном массиве
            // splice.apply чтобы развернуть массив seg (splice(0, n, x) вставляет x как один элемент)
            newO.splice.apply(newO, [t, 0].concat(seg));
            var newLen = routeLen(newO);
            if (newLen + 0.5 < baseLen) {
              o = newO;
              baseLen = newLen;
              improved = true;
            }
          }
        }
      }
    }
    return o;
  }

  /* Or-opt: перемещаем отрезки из 1, 2, 3 последовательных элементов в лучшую
     позицию. Сильнее 2-opt на больших N — находит «кольца» в маршруте. */
  function tOrOptImprove(base, pts) {
    if (pts.length < 5) return pts;
    var ordered = pts.slice();
    function routeLen(o) {
      if (!o.length) return 0;
      var total = 0, prev = base;
      for (var i = 0; i < o.length; i++) {
        if (o[i].lat != null) total += distKm(prev, o[i]);
        prev = o[i];
      }
      if (prev) total += distKm(prev, base);
      return total;
    }
    var baseLen = routeLen(ordered);
    var improved = true, guard = 0;
    while (improved && guard < 80) {
      improved = false; guard++;
      for (var segLen = 1; segLen <= 3; segLen++) {
        for (var i = 0; i + segLen <= ordered.length; i++) {
          // Сегмент = элементы [i .. i+segLen-1]
          var seg = ordered.slice(i, i + segLen);
          // Базовая стоимость сегмента в текущей позиции
          var prev = (i === 0) ? base : ordered[i - 1];
          var next = (i + segLen === ordered.length) ? base : ordered[i + segLen];
          var curCost = (prev && seg[0]) ? distKm(prev, seg[0]) : 0;
          curCost += (seg[seg.length - 1] && next) ? distKm(seg[seg.length - 1], next) : 0;
          if (seg.length > 1) {
            for (var s = 0; s < seg.length - 1; s++) curCost += distKm(seg[s], seg[s + 1]);
          }
          // Попробовать все позиции вставки
          var tmpOrdered = ordered.slice();
          // Удаляем сегмент
          tmpOrdered.splice(i, segLen);
          // Перебираем, куда вставить
          for (var pos = 0; pos <= tmpOrdered.length; pos++) {
            // пропускаем исходную позицию
            if (pos === i || (pos === i - segLen) || (pos === i - segLen + 1)) continue;
            var insPrev = (pos === 0) ? base : tmpOrdered[pos - 1];
            var insNext = (pos === tmpOrdered.length) ? base : tmpOrdered[pos];
            var insCost = (insPrev && seg[0]) ? distKm(insPrev, seg[0]) : 0;
            insCost += (seg[seg.length - 1] && insNext) ? distKm(seg[seg.length - 1], insNext) : 0;
            // разрыв от старого положения
            var removeCost = 0;
            if (prev && next && !(i === 0 && i + segLen === ordered.length)) {
              removeCost = (prev && next) ? distKm(prev, next) : 0;
            } else if (i === 0 && i + segLen === ordered.length) {
              // весь маршрут = сегмент — оставляем как есть
              continue;
            }
            var delta = (insCost - curCost) - removeCost; // меньше — лучше
            if (delta < -1e-9) {
              // Применяем
              var newOrdered = ordered.slice();
              newOrdered.splice(i, segLen);
              newOrdered.splice(pos, 0, seg);
              var newLen = routeLen(newOrdered);
              if (newLen < baseLen - 1e-9) {
                ordered = newOrdered;
                baseLen = newLen;
                improved = true;
              }
            }
          }
        }
      }
    }
    return ordered;
  }

  /* Отрезки маршрута из геометрии полилинии (fallback при via-точках OSRM) */
  function tLegsFromGeometry(geometry, seq, totalKm, totalMin) {
    var n = seq ? seq.length - 1 : 0;
    if (n <= 0) return [];
    var legs = [];
    try {
      if (geometry && geometry.length > 1) {
        var cum = [0];
        for (var i = 1; i < geometry.length; i++) cum.push(cum[i - 1] + distKm({ lat: geometry[i - 1][0], lng: geometry[i - 1][1] }, { lat: geometry[i][0], lng: geometry[i][1] }));
        var polyKm = cum[cum.length - 1] || 1e-9;
        var minPerKm = (totalMin || 0) / (totalKm || polyKm || 1e-9);
        var idx = 0;
        for (var s2 = 1; s2 < seq.length; s2++) {
          var best = idx, bd = Infinity;
          for (var j2 = idx; j2 < geometry.length; j2++) {
            var d = distKm({ lat: geometry[j2][0], lng: geometry[j2][1] }, { lat: seq[s2].lat, lng: seq[s2].lng });
            if (d < bd) { bd = d; best = j2; }
          }
          var km = (cum[Math.max(best, idx)] - cum[idx]) * ((totalKm || polyKm) / polyKm);
          legs.push({ distance: km * 1000, duration: km * minPerKm * 60 });
          idx = Math.max(best, idx);
        }
      }
    } catch (e) { legs = []; }
    if (legs.length !== n) { // страховка: равномерно по числу отрезков
      legs = [];
      var km0 = (totalKm || 0) / n, min0 = ((totalMin || 0) / n) * 60;
      for (var q = 0; q < n; q++) legs.push({ distance: km0 * 1000, duration: min0 });
    }
    return legs;
  }

  /* ТЕСТ: оптимизация маршрута — «ближайший сосед» → OSRM Trip с многостартовой
     оптимизацией (или официальный роутер Яндекса при ключе), затем пробки. */
  // === СРАВНЕНИЕ АВТОМОБИЛЬНЫХ РОУТЕРОВ (тест проезда), 22.09-126 ===
  // Параллельный опрос автомобильных источников и показ результатов в панели под картой.
  // Не конфликтует с основной кнопкой «Оптимизация маршрутов» — отдельная панель.
  function buildTestRouteCompare() {
    var sel = (tState.pts || []).filter(function (p) { return p.lat != null; });
    var base = currentBase();
    if (!sel.length) { toast('warn', 'Выберите хотя бы одно задание с координатами'); return; }
    var pts = sel.map(function (p) { return { id: p.id, lat: p.lat, lng: p.lng, addr: p.addr }; });

    // Защитим кнопку от повторного клика, чтобы не плодить дубли параллельных запросов
    var btnCmp = document.getElementById('t-btn-compare');
    if (btnCmp) { btnCmp.disabled = true; var oldHtml = btnCmp.innerHTML; btnCmp.innerHTML = '⏳ Сравниваю…'; }
    function releaseBtn() {
      if (btnCmp) { btnCmp.disabled = false; btnCmp.innerHTML = oldHtml || '🔀 Сравнить'; }
    }
    // Авто-разблокировка через 12 секунд — что бы ни случилось
    var releaseTimer = setTimeout(releaseBtn, 12000);

    // Обёртка: fetch с таймаутом. r.osrm.de и valhalla1.openstreetmap.de любят висеть.
    function fetchWithTimeout(url, opts, ms) {
      return new Promise(function (resolve, reject) {
        var ctrl = new AbortController();
        var t = setTimeout(function () { ctrl.abort(); reject(new Error('timeout ' + ms + 'ms')); }, ms);
        fetch(url, Object.assign({}, opts || {}, { signal: ctrl.signal }))
          .then(function (r) { clearTimeout(t); resolve(r); })
          .catch(function (e) { clearTimeout(t); reject(e); });
      });
    }

    // Overlay-модалка поверх всей страницы. Один экземпляр, переиспользуем.
    var overlayId = 't-compare-overlay';
    var oldOv = document.getElementById(overlayId);
    if (oldOv) oldOv.remove();
    var ptsCount = pts.length;
    var hasJamBtn = (typeof TS !== 'undefined' && TS && TS.last);

    var overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:tpoverlay .25s ease-out';
    overlay.innerHTML =
      '<style>' +
        '@keyframes tpoverlay{from{opacity:0}to{opacity:1}}' +
        '@keyframes tpcard{from{transform:translateY(-12px) scale(.97);opacity:0}to{transform:none;opacity:1}}' +
        '@keyframes tp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}' +
        '#t-compare-card{animation:tpcard .28s cubic-bezier(.2,.8,.4,1)}' +
        '#t-compare-list .tcr{transition:background .3s,border-color .3s,box-shadow .25s,transform .25s}' +
        '#t-compare-list .tcr.best{background:linear-gradient(90deg,#f0fdf4,#ecfdf5 60%,var(--panel-2))!important;box-shadow:inset 3px 0 0 #16a34a}' +
        '#t-compare-list .tcr.err{background:#fef2f2;border-left:3px solid #dc2626}' +
        '#t-compare-list .tcr.warn{background:#fffbeb;border-left:3px solid #f59e0b}' +
        '#t-compare-list .tcr input[type=radio]:hover + span{filter:brightness(1.1)}' +
      '</style>' +
      '<div id="t-compare-card" role="dialog" aria-modal="true" aria-label="Сравнение роутеров"' +
      ' style="background:var(--card);border-radius:14px;box-shadow:0 25px 60px rgba(15,23,42,.45),0 0 0 1px rgba(255,255,255,.06);width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:hidden;display:flex;flex-direction:column;font-family:inherit">' +
        '<div style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 60%,#c084fc 100%);color:#fff;padding:18px 22px;display:flex;align-items:center;gap:12px;flex-shrink:0">' +
          '<div style="font-size:24px">🔀</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:16px;font-weight:800;letter-spacing:.2px">Сравнение автомобильных роутеров</div>' +
            '<div style="font-size:12px;opacity:.92;margin-top:2px">' + ptsCount + ' задани' + (ptsCount===1?'е':ptsCount<5?'я':'й') + ' · база «' + esc(base.name) + '» · ⭐ рекомендация (самый короткий) или выберите роутер радио-кнопкой</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span id="t-compare-progress" style="background:rgba(255,255,255,.18);padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.3px">⏳ 0 / 7</span>' +
            '<button id="t-compare-close" type="button" aria-label="Закрыть" title="Закрыть (Esc)"' +
            ' style="background:rgba(255,255,255,.18);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .2s"' +
            ' onmouseover="this.style.background=\'rgba(255,255,255,.32)\'" onmouseout="this.style.background=\'rgba(255,255,255,.18)\'">×</button>' +
          '</div>' +
        '</div>' +
        '<div id="t-compare-body" style="padding:18px 22px;overflow-y:auto;flex:1;background:var(--card)">' +
          '<div style="display:grid;grid-template-columns:42px minmax(140px,2fr) 1fr 1fr 1fr 36px;gap:10px;padding:8px 12px;background:var(--panel-2);border-radius:8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;align-items:center">' +
            '<div></div><div>Роутер / движок</div><div style="text-align:right">Дистанция</div><div style="text-align:right">Время</div><div style="text-align:center">Статус</div><div style="text-align:center">Взять</div>' +
          '</div>' +
          '<div id="t-compare-list" style="display:flex;flex-direction:column;gap:8px"></div>' +
          '<div id="t-compare-foot" style="margin-top:14px"></div>' +
        '</div>' +
        '<div style="padding:10px 22px;background:var(--panel-2);border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0">' +
          '<div style="font-size:12px;color:var(--muted);line-height:1.5">' +
            '<b>Цветной кружок</b> слева = движок (O=OSRM, F=FOSSGIS car, V=Valhalla, C=osm.ch, A=BRouter car, 0=прямая).<br>' +
            '<b>⭐</b> слева вверху — рекомендация системы (минимальная дистанция). Справа в строке — радио-кнопка для вашего выбора.' +
          '</div>' +
          '<button class="btn sm" id="t-compare-retry" type="button" style="background:#f1f5f9;color:var(--ink);border:1px solid var(--line);font-weight:600">↻ Обновить</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var listEl = overlay.querySelector('#t-compare-list');
    var progressEl = overlay.querySelector('#t-compare-progress');
    var footEl = overlay.querySelector('#t-compare-foot');
    var card = overlay.querySelector('#t-compare-card');

    // Закрытие
    function closeModal() {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onEsc);
    overlay.addEventListener('click', function (e) {
      // клик по затемнению (но НЕ по карточке) — закрыть
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('#t-compare-close').addEventListener('click', closeModal);
    // Retry — повторный опрос без закрытия
    overlay.querySelector('#t-compare-retry').addEventListener('click', function () {
      closeModal();
      // дёргаем buildTestRouteCompare заново (рекурсивно)
      setTimeout(buildTestRouteCompare, 60);
    });

    function setProgress() {
      var total = Object.keys(NAMES).length;
      progressEl.textContent = (allResults.length < total ? '⏳ ' : '✅ ') + allResults.length + ' / ' + total;
      if (allResults.length < total) {
        progressEl.style.background = 'rgba(255,255,255,.18)';
      } else {
        progressEl.style.background = 'rgba(34,197,94,.85)';
      }
    }

    // Карточка-строка: информативный стиль с колонками (имя / дистанция / время / точек / статус)
    // Цветные «бейджи движка» — круг с буквой движка. Это первое, что бросается в глаза.
    var BADGE = {
      'osrm-demo':      { letter: 'O', bg: '#1d4ed8', fg: '#fff', title: 'OSRM demo (project-osrm.org)' },
      'fossgis-car':    { letter: 'F', bg: '#15803d', fg: '#fff', title: 'FOSSGIS OSRM, профиль car' },
      'valhalla-public':{ letter: 'V', bg: '#ea580c', fg: '#fff', title: 'Valhalla public' },
      'osm-ch':         { letter: 'C', bg: '#dc2626', fg: '#fff', title: 'routing.osm.ch (CH/EU)' },
      'brouter-car':    { letter: 'A', bg: '#0f172a', fg: '#fff', title: 'BRouter, car-fast' },
      'straight':       { letter: '0', bg: '#64748b', fg: '#fff', title: 'Прямая линия ×1.4 (без сети)' }
    };
    var ICONS = {
      'osrm-demo':     '🟦',
      'fossgis-car':   '🟩',
      'valhalla-public':'🟧',
      'osm-ch':        '🇨🇭',
      'brouter-car':   '🚗',
      'straight':      '⬜'
    };
    var NAMES = {
      'osrm-demo':     'OSRM demo',
      'fossgis-car':   'FOSSGIS · car',
      'valhalla-public':'Valhalla public',
      'osm-ch':        'osm.ch (CH)',
      'brouter-car':   'BRouter · car',
      'straight':      'Прямая ×1.4'
    };
    var URLS = {
      'osrm-demo':     'https://router.project-osrm.org',
      'fossgis-car':   'https://routing.openstreetmap.de/routed-car',
      'valhalla-public':'https://valhalla1.openstreetmap.de',
      'osm-ch':        'https://routing.osm.ch',
      'brouter-car':   'https://brouter.de'
    };
    // html строки-результата. Один шаблон для pending и для onResult.
    function rowHtml(r) {
      var badge = BADGE[r.by] || { letter: '?', bg: '#94a3b8', fg: '#fff', title: r.by || '—' };
      var icon = ICONS[r.by] || '⬜';
      var name = NAMES[r.by] || (r.by || '—');
      var url = URLS[r.by] || '';
      var kmStr = r.ok ? r.km.toFixed(1).replace('.', ',') + ' км' : '—';
      var minStr = r.ok ? fmtDuration(r.min) : '—';
      var ptsStr = r.ok ? (ptsCount + ' + база') : '—';
      var statusText, statusClass = '';
      if (r.ok) statusText = '✅ ОК';
      else { statusText = '⚠ ' + (r.msg || 'нет'); statusClass = 'err'; }
      var safeId = 'tcr-' + r.by;
      // Радио-кнопка выбора (только если результат успешный)
      var radio = r.ok
        ? '<label style="display:flex;align-items:center;justify-content:center;cursor:pointer" title="Использовать этот маршрут как итоговый">' +
            '<input type="radio" name="t-compare-pick" value="' + r.by + '" data-km="' + r.km + '" data-min="' + r.min + '" style="width:18px;height:18px;cursor:pointer;accent-color:#7c3aed">' +
          '</label>'
        : '<span style="color:var(--muted);font-size:16px" title="Нельзя выбрать — нет результата">—</span>';
      return {
        id: safeId,
        cls: statusClass,
        html:
          '<div id="' + safeId + '" class="tcr ' + statusClass + '" data-by="' + r.by + '"' +
          ' style="display:grid;grid-template-columns:42px minmax(140px,2fr) 1fr 1fr 1fr 36px;gap:10px;padding:11px 12px;background:var(--panel-2);border-radius:8px;align-items:center;font-size:13px;border:2px solid transparent">' +
            // Бейдж движка — крупный цветной круг с буквой
            '<div title="' + badge.title + '" style="width:32px;height:32px;border-radius:50%;background:' + badge.bg + ';color:' + badge.fg + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.2)">' + badge.letter + '</div>' +
            // Название + иконка + ссылка
            '<div style="display:flex;flex-direction:column;gap:1px;min-width:0">' +
              '<div style="display:flex;align-items:center;gap:6px;overflow:hidden">' +
                '<span style="font-size:14px;flex-shrink:0">' + icon + '</span>' +
                '<b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</b>' +
                (url ? '<a href="' + url + '" target="_blank" rel="noopener" style="font-size:11.5px;color:#94a3b8;text-decoration:none;flex-shrink:0" title="Открыть сервис">↗</a>' : '') +
              '</div>' +
              '<div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + badge.title + '</div>' +
            '</div>' +
            // Дистанция
            '<div style="text-align:right;font-variant-numeric:tabular-nums"><b style="font-size:14px">' + kmStr + '</b></div>' +
            // Время
            '<div style="text-align:right;font-variant-numeric:tabular-nums"><b style="font-size:14px">' + minStr + '</b></div>' +
            // Статус
            '<div style="text-align:center;font-size:12.5px;font-weight:600;' + (r.ok ? 'color:#15803d' : 'color:#dc2626') + '">' + statusText + '</div>' +
            // Радио-кнопка
            '<div style="display:flex;justify-content:center">' + radio + '</div>' +
          '</div>'
      };
    }

    function renderRow(r, isNew) {
      var o = rowHtml(r);
      if (isNew) listEl.insertAdjacentHTML('beforeend', o.html);
      else listEl.innerHTML += o.html;
    }

    // Стартовое состояние — 9 «пустых» строк
    var rows = Object.keys(NAMES);
    rows.forEach(function (by) { renderRow({ ok: false, by: by, msg: 'ожидание…' }, true); });

    var allResults = [];
    function onResult(r) {
      allResults.push(r);
      setProgress();
      var pendingId = 'tcr-' + r.by;
      var pending = document.getElementById(pendingId);
      if (pending) {
        var o = rowHtml(r);
        pending.outerHTML = o.html;
        // Перевесим обработчик радио-кнопки
        var newNode = document.getElementById(pendingId);
        if (newNode && r.ok) wirePickHandler(newNode);
      }
      if (allResults.length >= Object.keys(NAMES).length) {
        clearTimeout(releaseTimer); releaseBtn();
        // Сортируем: успешные по расстоянию по возрастанию, битые в самый низ
        var sorted = allResults.slice().sort(function (a, b) {
          if (a.ok && !b.ok) return -1;
          if (!a.ok && b.ok) return 1;
          if (!a.ok && !b.ok) return 0;
          return a.km - b.km;
        });
        sorted.forEach(function (x, i) {
          var el = document.getElementById('tcr-' + x.by);
          if (!el) return;
          listEl.appendChild(el);          // переставить в начало
          if (i === 0 && x.ok) {
            el.classList.add('best');
            // Также выделим рекомендацию плашкой
            var nameEl = el.querySelector('b');
          }
        });
        // Бейдж «рекомендация системы» (самый короткий) — но НЕ переключает радио.
        var best = sorted[0];
        var footHtml = '';
        if (best.ok) {
          var okList = sorted.filter(function (x) { return x.ok; });
          var worst = okList[okList.length - 1];
          var saving = worst.km - best.km;
          var bestName = NAMES[best.by] || best.by;
          footHtml = '<div style="padding:12px 14px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:10px;border:1px solid #86efac;display:flex;align-items:center;gap:12px">' +
            '<div title="' + (BADGE[best.by] && BADGE[best.by].title || '') + '" style="width:36px;height:36px;border-radius:50%;background:' + (BADGE[best.by] && BADGE[best.by].bg || '#16a34a') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">' + (BADGE[best.by] && BADGE[best.by].letter || '✓') + '</div>' +
            '<div style="flex:1">' +
              '<div style="font-weight:800;color:#14532d;font-size:14px">Рекомендация — ' + bestName + '</div>' +
              '<div style="font-size:12px;color:#166534;margin-top:2px">' + best.km.toFixed(1).replace('.', ',') + ' км · ' + fmtDuration(best.min) + (saving > 0 ? ' · на ' + saving.toFixed(1).replace('.', ',') + ' км короче самого длинного' : '') + '</div>' +
            '</div>' +
            '<label style="display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #16a34a;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;color:#15803d;white-space:nowrap" title="Принять рекомендацию">' +
              '<input type="radio" name="t-compare-pick-quick" style="accent-color:#16a34a;cursor:pointer"> ' +
              '<span>Взять</span>' +
            '</label>' +
          '</div>';
          // Обработчик «Взять рекомендацию»
          setTimeout(function () {
            var quickR = footEl.querySelector('input[name="t-compare-pick-quick"]');
            if (quickR) quickR.addEventListener('change', function () {
              var pickRadio = listEl.querySelector('input[name="t-compare-pick"][value="' + best.by + '"]');
              if (pickRadio) {
                pickRadio.checked = true;
                pickRadio.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
          }, 0);
        } else {
          footHtml = '<div style="padding:10px 14px;background:#fef2f2;border-radius:10px;border:1px solid #fca5a5;color:#7f1d1d;font-size:12.5px">⚠ Ни один из роутеров не ответил успешно. Проверьте доступ к router.project-osrm.org, routing.openstreetmap.de, valhalla1.openstreetmap.de, routing.osm.ch, brouter.de.</div>';
        }
        footEl.innerHTML = footHtml;
      }
    }

    // При выборе радио-кнопки — подсвечиваем строку, сохраняем выбранное
    function wirePickHandler(rowEl) {
      var radio = rowEl.querySelector('input[name="t-compare-pick"]');
      if (!radio) return;
      radio.addEventListener('change', function () {
        // У всех строк убираем «picked» и подсветку
        listEl.querySelectorAll('.tcr').forEach(function (r) {
          r.style.border = '2px solid transparent';
          r.style.boxShadow = '';
        });
        rowEl.style.border = '2px solid #7c3aed';
        rowEl.style.boxShadow = '0 0 0 3px rgba(124,58,237,.18)';
        // Обновим состояние выбранного в подвале
        var r = allResults.find(function (x) { return x.by === radio.value; });
        if (r) {
          footEl.innerHTML =
            '<div style="padding:12px 14px;background:linear-gradient(135deg,#ede9fe,#f5d0fe);border-radius:10px;border:1px solid #c4b5fd;display:flex;align-items:center;gap:12px">' +
              '<div title="' + (BADGE[r.by] && BADGE[r.by].title || '') + '" style="width:36px;height:36px;border-radius:50%;background:' + (BADGE[r.by] && BADGE[r.by].bg || '#7c3aed') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">' + (BADGE[r.by] && BADGE[r.by].letter || '✓') + '</div>' +
              '<div style="flex:1">' +
                '<div style="font-weight:800;color:#4c1d95;font-size:14px">Вы выбрали — ' + (NAMES[r.by] || r.by) + '</div>' +
                '<div style="font-size:12px;color:#5b21b6;margin-top:2px">' + r.km.toFixed(1).replace('.', ',') + ' км · ' + fmtDuration(r.min) + ' · нажмите «Применить к маршруту» внизу модалки</div>' +
              '</div>' +
              '<button type="button" id="t-compare-apply" class="btn sm primary" style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;font-weight:700;padding:6px 14px">✓ Применить</button>' +
            '</div>';
          setTimeout(function () {
            var btn = document.getElementById('t-compare-apply');
            if (btn) btn.addEventListener('click', applyPicked);
          }, 0);
        }
      });
    }

    // Применить выбранный маршрут к основной карте Теста проезда
    function applyPicked() {
      // selectedBy берём из радио, которое активно
      var pickedRadio = listEl.querySelector('input[name="t-compare-pick"]:checked');
      if (!pickedRadio) { try { toast('warn', 'Сначала выберите маршрут радио-кнопкой'); } catch (e) {} return; }
      var by = pickedRadio.value;
      var r = (allResults || []).find(function (x) { return x.by === by; });
      if (!r || !r.ok) return;
      // Запомним выбор для setTestRouteInfo
      window.__tComparePicked = { by: by, km: r.km, min: r.min, geometry: r.geometry || [] };
      try { toast('ok', '✅ Применён маршрут: ' + (NAMES[by] || by) + ' — ' + r.km.toFixed(1).replace('.', ',') + ' км · ' + fmtDuration(r.min)); } catch (e) {}
      // Если есть основная функция построения маршрута — перевызовем её
      if (typeof buildTestRoute === 'function') {
        try { closeModal(); setTimeout(function () { buildTestRoute(true); }, 80); } catch (e) { console.error('rebuild:', e); }
      } else {
        closeModal();
      }
    }
    fetchStraightLineRoute(pts, base, onResult);
    // ============================================================
    // АВТОМОБИЛЬНЫЕ роутеры для сравнения (22.09-126). Все бесплатные, без ключа.
    // Каждый fetch обёрнут в try/catch и fetchWithTimeout — ничего
    // не «подвешивает» UI. Если сервер не ответил — показываем строку с ⚠.
    // ============================================================

    // 1) OSRM demo (router.project-osrm.org) — roundtrip с оптимизацией порядка
    function callOsrmDemo() {
      var coordStr = pts.map(function (p) { return p.lng + ',' + p.lat; }).join(';');
      var url = 'https://router.project-osrm.org/trip/v1/driving/' + base.lng + ',' + base.lat + ';' + coordStr + ';' + base.lng + ',' + base.lat +
        '?roundtrip=true&source=first&overview=simplified&geometries=geojson&steps=false';
      fetchWithTimeout(url, null, 10000)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.trips && res.trips[0]) {
            var t = res.trips[0];
            onResult({ ok: true, by: 'osrm-demo', km: t.distance / 1000, min: Math.round(t.duration / 60), geometry: t.geometry.coordinates || [], legs: t.legs || [] });
          } else onResult({ ok: false, by: 'osrm-demo', msg: 'OSRM: нет trips' });
        }).catch(function (e) { onResult({ ok: false, by: 'osrm-demo', msg: 'OSRM: ' + e.message }); });
    }

    // Универсальная функция для OSRM-совместимых серверов.
    // kind: 'trip' (оптимизация порядка) или 'route' (как задано).
    // profile: routed-car (в тесте проезда — только автомобиль, 22.09-126)
    function callOsrmLike(profile, kind, byName, timeoutMs) {
      var coords = [[base.lng, base.lat]];
      pts.forEach(function (p) { coords.push([p.lng, p.lat]); });
      coords.push([base.lng, base.lat]);
      var coordStr = coords.map(function (c) { return c.join(','); }).join(';');
      var url = 'https://routing.openstreetmap.de/' + profile + '/' + kind + '/v1/driving/' + coordStr +
        (kind === 'trip' ? '?roundtrip=true&source=first&overview=simplified&geometries=geojson'
                        : '?overview=simplified&geometries=geojson');
      fetchWithTimeout(url, null, timeoutMs || 8000)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          var trips = (res && (res.trips || res.routes));
          if (trips && trips[0]) {
            var t = trips[0];
            onResult({ ok: true, by: byName, km: t.distance / 1000, min: Math.round(t.duration / 60), geometry: t.geometry.coordinates || [] });
          } else {
            onResult({ ok: false, by: byName, msg: 'OSRM-like: нет routes (' + ((res && res.code) || '—') + ')' });
          }
        }).catch(function (e) { onResult({ ok: false, by: byName, msg: 'OSRM-like: ' + e.message }); });
    }

    // 2) FOSSGIS car (стандартный, что уже был) — trip с roundtrip
    function callFossgisCar() {
      callOsrmLike('routed-car', 'trip', 'fossgis-car', 8000);
    }

    // 3) Valhalla public. ИСПРАВЛЕНО: используем /route вместо /optimized_route
    //    (была ошибка «Exceeded max locations: 100» при больших числах точек
    //    и при повторной базе в конце). Без оптимизации порядка,
    //    просто последовательность. Не зависит от «max_locations»
    //    потому что мы НЕ запрашиваем оптимизацию, и «locations» —
    //    это только путевые точки.
    //    Однако /route тоже имеет лимит ~ 20 точек по умолчанию в этом
    //    публичном инстансе. На > 20 заданиях — пропускаем с подсказкой.
    function callValhallaPublic() {
      // Публичный сервер valhalla1.openstreetmap.de имеет жёсткий лимит
      // max_locations=10 (для /route — даже меньше). У нас в массиве
      // база+точки+база — 2 лишние.
      // Эмпирика: 8 заданий = 10 locs (ОК), 9 заданий = 11 locs (искл.).
      // Поэтому валим заранее на >8 точках, чтобы получить явный ⚠,
      // а не молчаливую ошибку «Exceeded max locations: 10».
      var locs = [{ lat: base.lat, lon: base.lng }];
      pts.forEach(function (p) { locs.push({ lat: p.lat, lon: p.lng }); });
      locs.push({ lat: base.lat, lon: base.lng });
      if (locs.length > 10) {
        onResult({ ok: false, by: 'valhalla-public', msg: 'Valhalla: ' + locs.length + ' точек (лимит публичного сервера — 10, скип; используйте OSRM demo/FOSSGIS)' });
        return;
      }
      var body = { locations: locs, costing: 'auto', directions_options: { units: 'kilometers' } };
      fetchWithTimeout('https://valhalla1.openstreetmap.de/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }, 10000)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.trip && res.trip.summary) {
            var s = res.trip.summary;
            onResult({ ok: true, by: 'valhalla-public', km: s.length || 0, min: s.time ? Math.round(s.time / 60) : 0, geometry: [] });
          } else {
            var errMsg = (res && res.error) ? res.error : 'нет trip';
            onResult({ ok: false, by: 'valhalla-public', msg: 'Valhalla: ' + errMsg });
          }
        }).catch(function (e) { onResult({ ok: false, by: 'valhalla-public', msg: 'Valhalla: ' + e.message }); });
    }

    // 4) routing.osm.ch — независимый OSRM-сервер (Швейцария / частично Европа).
    //    Не работает для Беларуси (distance:0) — будет показан как «за пределами».
    //    Всё равно полезно для сравнения алгоритмов, если кто-то в Европе.
    function callOsmCh() {
      var coords = [[base.lng, base.lat]];
      pts.forEach(function (p) { coords.push([p.lng, p.lat]); });
      coords.push([base.lng, base.lat]);
      var coordStr = coords.map(function (c) { return c.join(','); }).join(';');
      var url = 'https://routing.osm.ch/routed-car/route/v1/driving/' + coordStr +
        '?overview=simplified&geometries=geojson';
      fetchWithTimeout(url, null, 8000)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.routes && res.routes[0]) {
            var t = res.routes[0];
            // Если distance == 0 — координаты вне зоны (нормально для Минска),
            // всё равно покажем как ответ — наглядно видно лимиты разных серверов.
            onResult({ ok: true, by: 'osm-ch', km: t.distance / 1000, min: Math.round(t.duration / 60), geometry: t.geometry.coordinates || [] });
          } else onResult({ ok: false, by: 'osm-ch', msg: 'osm.ch: ' + ((res && res.code) || 'пусто') });
        }).catch(function (e) { onResult({ ok: false, by: 'osm-ch', msg: 'osm.ch: ' + e.message }); });
    }

    // 5) BRouter car-fast (car, оптимизированный под автомобиль,
    //    учитывает энергию и подъёмы). BRouter — отдельный движок (Java).
    //    Поддерживает несколько точек через | в lonlats.
    function callBRouterCar() {
      if (pts.length > 50) {
        // BRouter не любит очень много точек
        onResult({ ok: false, by: 'brouter-car', msg: 'BRouter car: ' + (pts.length + 2) + ' точек (>50, скип)' });
        return;
      }
      var segs = [[base.lng, base.lat]];
      pts.forEach(function (p) { segs.push([p.lng, p.lat]); });
      segs.push([base.lng, base.lat]);
      var lonlats = segs.map(function (s) { return s.join(','); }).join('|');
      var url = 'https://brouter.de/brouter?lonlats=' + encodeURIComponent(lonlats) +
        '&profile=car-fast&alternativeidx=0&format=geojson';
      fetchWithTimeout(url, null, 12000)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.features && res.features[0]) {
            var p = res.features[0].properties || {};
            var km = parseFloat(p['track-length']) / 1000 || 0;
            var mn = Math.round((parseFloat(p['total-time']) || 0) / 60);
            onResult({ ok: true, by: 'brouter-car', km: km, min: mn, geometry: [] });
          } else onResult({ ok: false, by: 'brouter-car', msg: 'BRouter car: пустой ответ' });
        }).catch(function (e) { onResult({ ok: false, by: 'brouter-car', msg: 'BRouter car: ' + e.message }); });
    }

    // Запуск всех 5 параллельно (только автомобильные роутеры; отказ одного — не блокирует остальные)
    var callers = [callOsrmDemo, callFossgisCar, callValhallaPublic, callOsmCh, callBRouterCar];
    callers.forEach(function (fn) {
      try { fn(); } catch (e) { /* если упало на старте — пусть onResult не вызывается */ }
    });
  }

  /* 22.09-175: движок «Google» — маршрут строит САМ GOOGLE в новой вкладке.
     Порядок точек — как у дорожных роутеров («ближайший сосед» от базы),
     чтобы нумерация в списке/карте совпадала с тем, что построит Google. */
  function buildTestRouteOpenGoogle(sel, base, restoreBtn) {
    try {
      var raw = (sel || []).filter(function (p) { return p.lat != null && p.lng != null; });
      if (!raw.length) { try { toast('warn', 'У выбранных заданий нет координат'); } catch (e) {} if (restoreBtn) restoreBtn(); return; }
      var ordered = lmNearestOrder(raw.map(function (p) { return { id: p.id, lat: p.lat, lng: p.lng, addr: p.addr, mcol: p.mcol }; }), base);
      tState.pts = ordered.slice();
      refreshTestCards(ordered);
      tDrawTestMarkers();
      tState.routeItems = [base].concat(ordered).concat([base]);
      var url = buildGoogleDirUrl(tState.routeItems);
      window.open(url, '_blank', 'noopener');
      setTestRouteInfo({ google: true, count: ordered.length });
      ['t-btn-yandex', 't-btn-google', 't-btn-gearth'].forEach(function (id) {
        var b = document.getElementById(id); if (b && ordered.length) b.style.display = '';
      });
      try { toast('ok', '🌐 Маршрут (' + ordered.length + ' точек) открыт в новой вкладке — его строит сам Google'); } catch (e) {}
      try { logAction('Маршрут открыт в Google', 'точек: ' + ordered.length); } catch (e) {}
    } catch (e) {
      try { toast('err', 'Не удалось открыть маршрут в Google'); } catch (er) {}
    } finally { if (restoreBtn) restoreBtn(); }
  }

  function buildTestRoute(noJam) {
    TS.noJam = !!noJam;
    var routerKey = TS.router || 'osrm';
    var btn = document.getElementById('t-btn-build-route');
    var btnHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'not-allowed'; btn.innerHTML = '⏳ Расчёт…'; }
    var sel = (tState.pts || []).slice();
    var base = currentBase();
    if (!sel.length) {
      toast('warn', 'Выберите хотя бы одно задание в списке');
      if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = btnHtml; }
      return;
    }
    // === Если выбран BRouter — отдельный поток (свой протокол, без Table API) ===
    if (routerKey === 'brouter-car') {
      var profile = 'car-fast'; // 22.09-126: trekking-профили убраны — тест проезда только для автомобиля
      buildTestRouteBRouter(profile, restoreBtn);
      return;
    }
    // === 22.09-175: движок «Google» — маршрут строит сам Google (новая вкладка) ===
    if (routerKey === 'google') { buildTestRouteOpenGoogle(sel, base, restoreBtn); return; }
    var ri = document.getElementById('t-route-info');
    if (ri) ri.textContent = '⏳ Оптимизируем порядок объезда…';
    var pts = sel.map(function (p) { return { id: p.id, lat: p.lat, lng: p.lng, addr: p.addr }; });
    function restoreBtn() { if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = btnHtml; } }
    // Отдельная кнопка «🔀 Сравнить роутеры» (рядом с «Оптимизация маршрутов»).
    // Запускает параллельный опрос бесплатных автомобильных роутеров и показывает
    // результаты в отдельной панели сравнения (не конфликтует с основным маршрутом).


    // === ШАГ 1: стартовый порядок — «ближайший сосед» (база → ближайшая точка →
    // ближайшая к прошлой → … → база). Дорожный расчёт (OSRM Trip) затем
    // оптимизирует порядок глобально, и список выравнивается по ФАКТИЧЕСКОМУ
    // объезду (waypoints) — карточки и «до базы» всегда соответствуют маршруту.
    var orderedPts = lmNearestOrder(pts, base);
    tState.pts = orderedPts.slice();
    refreshTestCards(orderedPts);
    if (tState.ymap) tDrawTestMarkers();
    var ri2 = document.getElementById('t-route-info');
    if (ri2) ri2.textContent = '⏳ Считаем маршрут по дорогам…';

    {
      function done(res) {
        tDrawTestRouteLine(res.geometry);
        var ordered = orderedPts.slice();
        var wps = [[base.lat, base.lng]];
        ordered.forEach(function (p) { wps.push([p.lat, p.lng]); });
        wps.push([base.lat, base.lng]);
        var legMin = (res.legs || []).map(function (l) { return Math.max(1, Math.round((l.duration || 0) / 60)); });

        // === ШАГ 3: пробки (дорожный расчёт; роутер Яндекса при ключе
        //     уже даёт время с учётом загрузки — пробки не дублируем) ===
        function finish(jam) {
          restoreBtn();
          var perLegMin = (jam && jam.ok) ? jam.perLeg : legMin;
          ordered.forEach(function (p, idx) {
            var leg = res.legs && res.legs[idx];
            if (leg && leg.distance != null) {
              var km = leg.distance / 1000;
              p.travelKm = km; p.travelKmText = km.toFixed(1).replace('.', ',') + ' км';
            }
            if (perLegMin[idx] != null) {
              p.travelMin = perLegMin[idx];
              p.travelText = fmtDuration(perLegMin[idx]) + ((jam && jam.ok) ? ' (с пробками)' : '');
            }
          });
          updateTestDayCards(ordered);
          var retIdx = ordered.length;
          var retLeg = res.legs && res.legs[retIdx];
          var bc = document.getElementById('t-base-return-info');
          if (bc) {
            bc.innerHTML = (retLeg && retLeg.duration != null)
              ? '🛣 От последнего задания до базы: <b style="color:#fff">' + fmtDuration(perLegMin[retIdx] || Math.max(1, Math.round(retLeg.duration / 60))) + '</b> · ' + ((retLeg.distance || 0) / 1000).toFixed(1).replace('.', ',') + ' км'
              : '🛣 Возврат на базу учтён в маршруте';
          }
          var jamTotal = (jam && jam.ok) ? jam.total : res.min;
          setTestRouteInfo({ km: res.km, jamsMin: jamTotal, freeMin: res.min, count: ordered.length });
          // кнопки «Открыть в Яндекс.Картах» и «Открыть в Google Maps» — с готовым маршрутом
          tState.routeItems = [base].concat(ordered).concat([base]);
          // === ГЛАВНЫЙ ФИКС: после оптимизации порядок tState.pts мог измениться,
          //     а номера на маркерах на карте остались от прежнего порядка.
          //     Пересинхронизируем tState.pts и вызовем tDrawTestMarkers(),
          //     чтобы маркеры получили актуальные номера 1, 2, 3, ... ===
          var sameOrder = (tState.pts && tState.pts.length === ordered.length);
          if (sameOrder) {
            for (var ii = 0; ii < ordered.length; ii++) {
              if (tState.pts[ii] !== ordered[ii]) { sameOrder = false; break; }
            }
          }
          if (!sameOrder) {
            tState.pts = ordered.slice();
            refreshTestCards(ordered);
            if (tState.ymap) tDrawTestMarkers();
          } else if (tState.ymap) {
            // порядок тот же — всё равно перерисуем маркеры: могли измениться
            // времена/километры и цвета (p.mcol от мастера), а номера те же
            tDrawTestMarkers();
          }
          var yaBtn = document.getElementById('t-btn-yandex');
          if (yaBtn && ordered.length) yaBtn.style.display = '';
          var gBtn = document.getElementById('t-btn-google');
          if (gBtn && ordered.length) gBtn.style.display = '';
          var geBtn = document.getElementById('t-btn-gearth');
          if (geBtn && ordered.length) geBtn.style.display = ''; // 22.09-163
          var howOpt = (res.by === 'yandex') ? 'порядок «ближайший сосед»' : 'многостартовая оптимизация OSRM Trip';
          // Оценка с пробками по часу суток (Минск) — для случая, когда
          // живые тайлы пробок не удалось получить (CORS/нет ключа).
          var estJam = Math.max(1, Math.round(res.min * jamFactorByHour(currentHourForJam())));
          toast('ok', '✓ Маршрут (' + howOpt + '): ' + res.km.toFixed(1).replace('.', ',') + ' км, ' +
            ((jam && jam.ok)
              ? jamTotal + ' мин с пробками / ' + res.min + ' мин без'
              : res.min + ' мин без пробок ≈ ~' + estJam + ' с пробками (оценка по часу ' + currentHourForJam() + ':00)') +
            (res.by === 'yandex' ? ' (роутер Яндекс.Карт)' : ' (калибровка OSRM + Яндекс.Карты)')); 
        }

        if (res.by === 'yandex' || !res.geometry || res.geometry.length < 3) { finish(null); return; }
        if (ri) ri.textContent = '⏳ Учитываем пробки…';
        tJamsAdjust(res.geometry, legMin, wps, finish);
      }

      // официальный роутер Яндекса (если задан ключ) — время уже с загрузкой
      function tryYandex() {
        if (!window.ymaps || !ymaps.route) return false;
        var rp = [[base.lat, base.lng]];
        orderedPts.forEach(function (p) { if (p.lat != null) rp.push([p.lat, p.lng]); });
        rp.push([base.lat, base.lng]);
        if (rp.length < 3) return false;
        ymaps.route(rp).then(function (route) {
          try {
            var km = (typeof route.getLength === 'function') ? route.getLength() / 1000 : null;
            var min = (typeof route.getTime === 'function') ? Math.round(route.getTime() / 60) : null;
            var legs = [], geom = [];
            var paths = route.getPaths();
            for (var i = 0; i < paths.getLength(); i++) {
              var pp = paths.get(i);
              var d = null, t = null;
              try { d = pp.properties.get('distance'); } catch (e) {}
              try { t = pp.properties.get('duration'); } catch (e) {}
              legs.push({ distance: (d != null ? d : 0), duration: (t != null ? t : 0) });
              try { var c = pp.geometry.getCoordinates(); if (c && c.length) geom = geom.concat(c); } catch (e) {}
            }
            if (km != null && min != null && legs.length) { done({ km: km, min: min, legs: legs, geometry: geom, by: 'yandex' }); return; }
            roadRoute();
          } catch (e) { roadRoute(); }
        }, function () { roadRoute(); });
        return true;
      }

      function roadRoute() {
        fetchOSMRouteGeometry('osrm', orderedPts, base, function (r) {
          if (!r || !r.ok) {
            restoreBtn();
            var ri3 = document.getElementById('t-route-info');
            if (ri3) ri3.textContent = 'не удалось рассчитать маршрут';
            toast('err', '⚠ Маршрут не рассчитан: ' + (r && r.msg ? r.msg : 'нет координат у части заданий или сервис недоступен'));
            return;
          }
          // ====== МАТРИЧНАЯ ОПТИМИЗАЦИЯ ПО ДОРОЖНОЙ СЕТИ ======
          //
          // Стратегия: вместо N попыток OSRM route (каждая — сетевой запрос с
          // разным порядком) берём МАТРИЦУ «все-ко-всем» одним запросом
          // OSRM Table API, и по ней решаем TSP локально.
          // Это даёт результат, близкий к точному TSP (отличие <5%) при
          // 1-2 сетевых запросах вместо 10-15.
          //
          // Шаги:
          //   1. OSRM Table API: матрица расстояний NxN (1 запрос)
          //   2. Локально: NN от каждой точки + 2-opt + or-opt по матрице
          //   3. OSRM route с лучшим порядком: даёт геометрию для отрисовки
          //      (1 запрос). Время в этой геометрии — точное, без T_YANDEX_K.
          //   4. Fallback: если Table API не сработал — старый многостарт.
          //
          // ОГРАНИЧЕНИЕ: OSRM Table API на публичном сервере — до ~50 точек.
          // Для большего числа — fallback к старому многостарту.

          var withCoords = orderedPts.filter(function (p) { return p.lat != null && p.lng != null; });
          var geomInit = (r.geometry || []).map(function (c) { return [c[1], c[0]]; });

          function makeBest(order, km, min, legs, geom) {
            return {
              order: order,
              km: km,
              min: min,
              legs: legs || [],
              legsClean: !!(legs && withCoords.length && legs.length === withCoords.length + 1),
              geometry: geom || []
            };
          }

          var best = null;

          function applyBest() {
            if (!best) return;
            var changed = best.order.some(function (p, i) { return p !== orderedPts[i]; });
            orderedPts = best.order.slice();
            if (changed) {
              tState.pts = orderedPts.slice();
              refreshTestCards(orderedPts);
              if (tState.ymap) tDrawTestMarkers();
            }
            var yMin = Math.round(best.min * (best.matrixBased ? 1 : T_YANDEX_K));
            var legs = best.legsClean
              ? best.legs.map(function (l) { return { distance: l.distance, duration: (l.duration || 0) }; })
              : tLegsFromGeometry(best.geometry, [base].concat(orderedPts).concat([base]), best.km, best.min);
            done({ km: best.km, min: yMin, legs: legs, geometry: best.geometry, by: 'road' });
          }

          // === 1 точка или нет точек — пропускаем оптимизацию ===
          if (withCoords.length <= 1) {
            best = makeBest(withCoords, r.km, r.min, r.legs, geomInit);
            applyBest();
            return;
          }

          var riOpt = document.getElementById('t-route-info');
          if (riOpt) riOpt.textContent = '⏳ Матрица расстояний…';

          // === ШАГ 1: OSRM Table API ===
          var allCoords = [[base.lng, base.lat]];
          withCoords.forEach(function (p) { allCoords.push([p.lng, p.lat]); });
          tMatrixCall(allCoords, function (matrixRes) {
            if (matrixRes && matrixRes.distances && matrixRes.distances.length === allCoords.length) {
              // Матрица получена. Решаем TSP по ней.
              if (riOpt) riOpt.textContent = '⏳ Оптимизация по дорожной матрице…';
              var solved = tSolveMatrixFromBase(matrixRes.distances, 0, withCoords.length);
              if (solved && solved.order && solved.order.length === withCoords.length) {
                // Преобразуем индексы матрицы (1..N) в точки
                var matrixOrder = solved.order.map(function (i) { return withCoords[i - 1]; });
                // Получаем реальный маршрут через OSRM route (для геометрии и финального времени)
                tRouteCall(matrixOrder, base, function (rt) {
                  if (rt && rt.km != null) {
                    best = makeBest(rt.order, rt.km, rt.min, rt.legs, rt.geometry);
                    best.matrixBased = true;
                  } else {
                    // route тоже упал — оставляем матричный порядок, берём время из матрицы
                    var durMat = matrixRes.durations;
                    var dSec = 0;
                    if (durMat && durMat.length === allCoords.length) {
                      dSec = durMat[0][solved.order[0]];
                      for (var si = 0; si < solved.order.length - 1; si++) {
                        dSec += durMat[solved.order[si]][solved.order[si + 1]];
                      }
                      dSec += durMat[solved.order[solved.order.length - 1]][0];
                    }
                    best = makeBest(matrixOrder, solved.len / 1000, Math.round(dSec / 60), [], []);
                    best.matrixBased = true;
                  }
                  applyBest();
                });
                return;
              }
            }
            // === Fallback: если Table API не сработал — старый многостарт по прямой + 2-opt ===
            if (riOpt) riOpt.textContent = '⏳ Оптимизация порядка объезда…';
            var seedsRaw = [];
            withCoords.forEach(function (p) { seedsRaw.push(lmNearestOrder_NNFrom(p, withCoords)); });
            seedsRaw.push(lmNearestOrder(withCoords, base));
            seedsRaw.push(tFarthestInsertion(base, withCoords));
            var origList = pts.slice();
            if (origList.every(function (p) { return p.lat != null && p.lng != null; })) seedsRaw.push(origList);
            seedsRaw.push(withCoords.slice().reverse());
            var seeds = [];
            var seenK = {};
            seedsRaw.forEach(function (s) {
              var opt = tOrOptImprove(base, tTwoOptImprove(base, s));
              var k = opt.map(function (p) { return p.id; }).join('|');
              if (!seenK[k]) { seenK[k] = 1; seeds.push(opt); }
            });
            seeds.sort(function (a, b) { return tPredictedKm(base, a) - tPredictedKm(base, b); });
            var total = seeds.length, nextIdx = 0, inFlight = 0, finished = 0, finalized = false;
            function finalize() {
              if (finalized) return;
              finalized = true;
              if (!best) {
                var opt = lmOrderByWaypoints(orderedPts, r);
                if (opt.length === orderedPts.length) orderedPts = opt;
                best = makeBest(orderedPts, r.km, r.min, r.legs, geomInit);
              }
              if (best && best.order && best.order.length >= 4) {
                var imp = tOrOptImprove(base, tTwoOptImprove(base, best.order));
                var sameId = imp.length === best.order.length && imp.every(function (p, i) { return p.id === best.order[i].id; });
                if (!sameId) {
                  tRouteCall(imp, base, function (res2) {
                    if (res2 && res2.km != null && res2.km < best.km) {
                      best = makeBest(res2.order, res2.km, res2.min, res2.legs, res2.geometry);
                    }
                    applyBest();
                  });
                  return;
                }
              }
              applyBest();
            }
            function pump() {
              if (nextIdx >= seeds.length && inFlight === 0) { finalize(); return; }
              while (inFlight < 4 && nextIdx < seeds.length && !finalized) {
                (function (idx) {
                  inFlight++;
                  var order = seeds[idx];
                  tRouteCall(order, base, function (res2) {
                    inFlight--; finished++;
                    if (res2 && res2.km != null && (!best || res2.km < best.km)) {
                      best = makeBest(res2.order, res2.km, res2.min, res2.legs, res2.geometry);
                    }
                    if (riOpt) riOpt.textContent = '⏳ Оптимизация: ' + finished + ' / ' + total;
                    pump();
                  });
                })(nextIdx++);
              }
            }
            pump();
          });
        });
      }

    if (!tryYandex()) roadRoute();
    }
  }

  /* === BRouter (отдельный путь) === */
  // BRouter — Java-движок, оптимизированный под велосипед/пешехода.
  // Протокол: GET https://brouter.de/brouter?lonlats=lng,lat|lng,lat&profile=trekking&format=geojson
  // НЕ оптимизирует порядок точек сам — нам надо сделать NN+2-opt самим
  // через OSRM Table API (эта функция берёт уже готовый порядок).
  function buildTestRouteBRouter(profile, restoreBtn) {
    var base = currentBase();
    var sel = (tState.pts || []).slice();
    if (!sel.length) { restoreBtn(); return; }
    var ri = document.getElementById('t-route-info');
    if (ri) ri.textContent = '⏳ BRouter ' + profile + ': оптимизация по матрице OSRM…';

    // 1) Берём OSRM Table API для оптимизации порядка (для BRouter)
    var allCoords = [[base.lng, base.lat]];
    sel.forEach(function (p) { if (p.lat != null) allCoords.push([p.lng, p.lat]); });
    tMatrixCall(allCoords, function (matrixRes) {
      if (!matrixRes) { ri && (ri.textContent = 'OSRM Table не ответил'); restoreBtn(); return; }
      var solved = tSolveMatrixFromBase(matrixRes.distances, 0, allCoords.length - 1);
      if (!solved || !solved.order || !solved.order.length) { ri && (ri.textContent = 'Не удалось построить порядок'); restoreBtn(); return; }
      var orderedPts = solved.order.map(function (i) { return sel[i - 1]; });

      // Сохраняем упорядоченный tState.pts
      tState.pts = orderedPts.slice();
      refreshTestCards(orderedPts);
      if (tState.ymap) tDrawTestMarkers();

      // 2) Запрашиваем BRouter по этому порядку
      if (ri) ri.textContent = '⏳ BRouter ' + profile + ': расчёт маршрута…';
      var lonlats = [];
      // Функция: получить валидные координаты из объекта задания.
      // Допустим имена: lat/lng, latitude/longitude. Если хоть что-то не число — return null.
      function _ck(p) {
        if (!p) return null;
        var lo = (p.lng != null) ? p.lng : p.longitude;
        var la = (p.lat != null) ? p.lat : p.latitude;
        if (typeof lo !== 'number' || typeof la !== 'number') return null;
        if (!isFinite(lo) || !isFinite(la)) return null;
        // Разумные пределы (НЕ экватор/нулевой меридиан)
        if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
        return [lo, la];
      }
      // Сначала — база, потом заказы, потом возврат на базу
      var routePath = [].concat([base], orderedPts).concat([base]);
      routePath.forEach(function (p) {
        var c = _ck(p);
        if (c) lonlats.push(c[0].toFixed(6) + ',' + c[1].toFixed(6));
        // Намеренно НЕ добавляем невалидные точки — иначе BRouter вернёт 404.
      });
      if (lonlats.length < 2) {
        if (ri) ri.textContent = 'BRouter: нет валидных координат';
        try { toast('err', '⚠ BRouter: нет координат у точек маршрута (lat/lng не заполнены)'); } catch (er) {}
        restoreBtn();
        return;
      }
      var url = 'https://brouter.de/brouter?lonlats=' + encodeURIComponent(lonlats.join('|')) +
        '&profile=' + encodeURIComponent(profile) + '&alternativeidx=0&format=geojson';

      var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 30000);
      fetch(url, ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) {
          clearTimeout(timer);
          // Проверка HTTP-статуса: 200 / JSON. Иначе читаем body как текст
          if (!r.ok) {
            return r.text().then(function (txt) {
              throw new Error('HTTP ' + r.status + ' — ' + (txt ? txt.slice(0, 200) : 'нет тела'));
            });
          }
          var ct = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
          if (ct.indexOf('json') < 0) {
            return r.text().then(function (txt) {
              throw new Error('BRouter вернул не-JSON (' + ct + '): ' + txt.slice(0, 200));
            });
          }
          return r.json();
        })
        .then(function (res) {
          if (!res || !res.features || !res.features[0] || !res.features[0].properties) {
            if (ri) ri.textContent = 'BRouter: пустой ответ';
            try { toast('err', 'BRouter вернул пустой ответ — попробуйте OSRM или Valhalla'); } catch (e) {}
            restoreBtn();
            return;
          }
          var pp = res.features[0].properties;
          var km = parseFloat(pp['track-length']) / 1000;
          var mn = Math.round((parseFloat(pp['total-time']) || 0) / 60);
          if (!(km > 0)) {
            if (ri) ri.textContent = 'BRouter: точки недостижимы для профиля ' + profile;
            try { toast('err', 'BRouter не смог построить маршрут — точки недостижимы'); } catch (e) {}
            restoreBtn();
            return;
          }
          // Координаты: BRouter вернул [lng, lat] в geometry.coordinates
          var geom = (res.features[0].geometry && res.features[0].geometry.coordinates || []).map(function (c) { return [c[1], c[0]]; });
          if (ri) ri.textContent = '⏳ Учитываем пробки…';

        // Часовая модель пробок (как у OSRM)
        var h = typeof currentHourForJam === 'function' ? currentHourForJam() : new Date().getHours();
        var k = typeof jamFactorByHour === 'function' ? jamFactorByHour(h) : 1.0;
        var mnJammed = Math.max(1, Math.round(mn * k));

        // 22.09-163: порядок точек — для экспорта в Google Earth (.kml)
        tState.routeItems = [base].concat(orderedPts).concat([base]);
        // Рисуем маршрут на карте
        tDrawTestRouteLine(geom);

        // Обновляем инфо
        var sInfo = document.getElementById('t-route-info');
        if (sInfo) sInfo.innerHTML = '<b style="color:var(--ink);font-size:13.5px;">' + km.toFixed(1).replace('.', ',') + ' км</b> · время: ' +
          '<b style="color:#dc2626;">' + fmtDuration(mnJammed) + ' (с пробками)</b> ' +
          '<span style="color:var(--muted);font-weight:600;">/</span> ' +
          '<b style="color:#16a34a;">' + fmtDuration(mn) + ' (без пробок)</b>';

        // Карточки слева: время по каждому leg — разрезаем геометрию пропорционально
        var waypointsForLegs = [base].concat(orderedPts).concat([base]);
        var legsByKm = (typeof tLegsFromGeometry === 'function')
          ? tLegsFromGeometry(geom, waypointsForLegs, km * 1000, mn * 60)
          : [];
        orderedPts.forEach(function (pt, idx) {
          // perLeg[i]: legs[i+1] — это путь ОТ p[i] К p[i+1] (база = p[-1])
          var legIdx = idx + 1; // legs[0] = от базы к p[0]
          var legSec = (legsByKm[legIdx] && legsByKm[legIdx].duration) ? legsByKm[legIdx].duration : (mn * 60 / Math.max(1, orderedPts.length + 1));
          var legKm = (legsByKm[legIdx] && legsByKm[legIdx].distance) ? legsByKm[legIdx].distance / 1000 : (km / Math.max(1, orderedPts.length + 1));
          pt.travelKm = legKm;
          pt.travelKmText = legKm.toFixed(1).replace('.', ',') + ' км';
          pt.travelMin = Math.round(legSec / 60);
          pt.travelText = fmtDuration(pt.travelMin);
        });
        // Возврат на базу
        var returnLeg = legsByKm[legsByKm.length - 1];
        if (returnLeg) {
          tState.returnTrip = { km: returnLeg.distance / 1000, min: Math.round(returnLeg.duration / 60) };
        }
        updateTestDayCards(orderedPts);

        // Прячем/показываем «Открыть в Яндекс.Картах/Google Maps» — не подходит для BRouter, оставляем скрытыми
        var yaBtn = document.getElementById('t-btn-yandex');
        var gBtn = document.getElementById('t-btn-google');
        if (yaBtn) yaBtn.style.display = 'none';
        if (gBtn) gBtn.style.display = 'none';
        var geBtn = document.getElementById('t-btn-gearth');
        if (geBtn && orderedPts.length) geBtn.style.display = ''; // 22.09-163

        try { toast('ok', '✓ BRouter ' + profile + ': ' + km.toFixed(1).replace('.', ',') + ' км · ' + fmtDuration(mn) + ' (с пробками ~' + fmtDuration(mnJammed) + ')'); } catch (e) {}
        restoreBtn();
      }).catch(function (e) {
        clearTimeout(timer);
        if (ri) ri.textContent = 'BRouter: ' + (e.message || 'ошибка сети');
        try { toast('err', '⚠ BRouter недоступен: ' + (e.message || 'ошибка сети')); } catch (er) {}
        restoreBtn();
      });
    });
  }

  /* ---------- СТАРТ ---------- */
  document.getElementById('login-form').addEventListener('submit', onLoginSubmit);
  // 22.09-247: ссылки «🍪 Cookie» (экран входа и низ меню) — посмотреть/изменить разрешение
  ['li-cookie-link', 'sb-cookie-link'].forEach(function (id) {
    var cl = document.getElementById(id);
    if (cl && cl.addEventListener) cl.addEventListener('click', function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); openConsentDialog(); });
  });
  // (кнопка sync-btn и её модалка удалены — синхронизация теперь через polling API)
  // Попап-календарь тоже сразу
  setTimeout(function() { try { initDatePicker(); } catch(e) { console.error('DatePicker init:', e); } }, 100);
  // Touch drag&drop polyfill для планшетов
  setTimeout(function() { try { enableTouchDnD(); } catch(e) { console.error('TouchDnD init:', e); } }, 100);


  // Восстанавливаем сессию НЕМЕДЛЕННО из localStorage — до серверных запросов
  Promise.all([DB.ensureSeed(), WORK.ensureSeed()]).then(function () {
    refreshObjects(); // справочник объектов засеян асинхронно — перечитываем (иначе OBJECTS пуст до перезагрузки)
    var u = DB.getSession();
    if (u) {
      console.log('🔑 Сессия восстановлена:', u.login);
      enterApp(u);
    } else {
      showLoginScreen();
    }
    try { consentOnStart(); } catch (eCS) {} // 22.09-247: при первом открытии — разрешение на cookie
    // Загрузка прогноза погоды
    loadWeatherForecast();
    setInterval(loadWeatherForecast, 3600000);
    // Инициализация попапа погоды
    initWeatherPopup();
    // Инициализация локального лога ошибок (SP_ERRORS)
    try { if (window.SP_ERRORS && SP_ERRORS.init) SP_ERRORS.init(); } catch (e) {}
    // Real-time синхронизация с сервером Render (polling каждую секунду)
    // Заменяет старую логику с общей папкой (sync.js) и общим сервером (DB.syncFromServer)
    try {
      if (window.SP_SYNC_POLL && typeof window.SP_SYNC_POLL.init === 'function') {
        window.SP_SYNC_POLL.init();
      }
    } catch (e) { console.error('SP_SYNC_POLL init:', e); }
  }).catch(function (err) {
    console.error('SmartPlan init error:', err);
    showLoginScreen();
  });

  /* ---------- Дропдаун "Пользователи онлайн" в топбаре ----------
     Только админу: при клике на #sync-indicator открывается список
     пользователей, у которых last_seen < 2 минут (сервер уже фильтрует).
     Текущий пользователь выделен пометкой «Вы». */
  function setupSyncDropdown() {
    var ind = document.getElementById('sync-indicator');
    var dd = document.getElementById('sync-dropdown');
    var caret = document.getElementById('sync-caret');
    var list = document.getElementById('sync-dd-list');
    var ddCount = document.getElementById('sync-dd-count');
    if (!ind || !dd || !list) return;

    var isAdmin = (S && S.role === 'admin');
    if (caret) caret.style.display = isAdmin ? 'inline' : 'none';
    ind.style.cursor = isAdmin ? 'pointer' : 'default';

    function roleLabel(r) {
      var m = { admin: 'Админ', nach: 'Начальник', smaster: 'Ст. мастер', master: 'Мастер', engineer: 'Инженер СЭОГС', viewer: 'Просмотр', worker: 'Рабочий', account: 'Бухгалтерия', hr: 'Кадры' };
      return m[r] || (r ? r : '—');
    }
    function fmtAgo(ts) {
      if (!ts) return '—';
      var s = Math.round((Date.now() - ts) / 1000);
      if (s < 5) return 'только что';
      if (s < 60) return s + ' с назад';
      if (s < 3600) return Math.round(s / 60) + ' мин назад';
      return Math.round(s / 3600) + ' ч назад';
    }
    function paint() {
      var arr = (window.SP_SYNC_POLL && SP_SYNC_POLL.getOnline) ? SP_SYNC_POLL.getOnline() : [];
      // Текущего юзера — наверх
      var meId = S && S.user && S.user.id;
      arr.sort(function (a, b) {
        if (meId && a.id === meId && b.id !== meId) return -1;
        if (meId && b.id === meId && a.id !== meId) return 1;
        return (b.last_seen || 0) - (a.last_seen || 0);
      });
      if (ddCount) ddCount.textContent = arr.length;
      if (!arr.length) {
        list.innerHTML = '<div style="padding:18px 14px;text-align:center;color:var(--muted);font-size:12px">Нет пользователей онлайн</div>';
        return;
      }
      list.innerHTML = arr.map(function (u) {
        var you = meId && u.id === meId;
        var name = esc(u.full_name || u.login || '—');
        var login = u.login && u.full_name ? '<span style="color:var(--muted);font-weight:500;font-size:12px;margin-left:4px">@' + esc(u.login) + '</span>' : '';
        var last = fmtAgo(u.last_seen);
        var role = esc(roleLabel(u.role));
        var bg = you ? 'background:#fef9c3' : 'background:transparent';
        var youBadge = you ? ' <span style="background:#16a34a;color:#fff;font-size:11px;font-weight:700;padding:1px 5px;border-radius:8px;margin-left:4px">ВЫ</span>' : '';
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);' + bg + ';transition:background .2s" onmouseover="this.style.background=\'' + (you ? '#fef3c7' : '#f1f5f9') + '\'" onmouseout="this.style.background=\'' + (you ? '#fef9c3' : 'transparent') + '\'">' +
          '<div style="flex:0 0 auto"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0f2740,#1e3a5f);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800">' + esc((u.full_name || u.login || '?').trim().charAt(0).toUpperCase()) + '</div></div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + youBadge + login + '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:1px">' + role + ' · ' + last + '</div>' +
          '</div>' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 2px #dcfce7"></span>' +
        '</div>';
      }).join('');
    }
    window.__syncRefreshDropdown = paint;

    ind.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!isAdmin) return;
      var open = dd.style.display === 'block';
      if (open) { dd.style.display = 'none'; return; }
      paint();
      // позиционируем под индикатором
      var r = ind.getBoundingClientRect();
      dd.style.top = (r.bottom + 6) + 'px';
      dd.style.right = Math.max(8, (window.innerWidth - r.right)) + 'px';
      dd.style.left = 'auto';
      dd.style.display = 'block';
    });
    // Клик снаружи — закрыть
    document.addEventListener('click', function (e) {
      if (dd.style.display !== 'block') return;
      if (dd.contains(e.target) || ind.contains(e.target)) return;
      dd.style.display = 'none';
    });
    // Esc — закрыть
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dd.style.display === 'block') dd.style.display = 'none';
    });
  }
  // setupSyncDropdown() запускается из enterApp() после входа пользователя в систему.
