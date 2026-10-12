  /* ── часть 16 · app/16_test_polygon.js — полигон «Тест» (тест проезда) ── */
  /* =====================================================================
     СТРАНИЦА «ТЕСТ» — полигон (полная копия «Карта маршрутов»)
     =====================================================================
     Изолированная копия для экспериментов:
       · собственное состояние TS (день/мастер/провайдер/выбор заданий);
       · собственное состояние карты tState (не трогает ymState рабочих карт);
       · собственные элементы DOM (t-*);
       · собственное хранилище закрытых дорог (smartplan_test_closures);
       · НЕ записывает в рабочие данные: задачи (координаты, время в пути),
         время маршрутов (saveRouteTime), кэш планирования — tFindTask
         всегда возвращает null, поэтому блоки записи не срабатывают.
     Рабочие страницы («Карта маршрутов» и остальные) работают как раньше. */
  var TS = { off: 0, master: null, provider: 'yandex', sel: {}, traffic: false, router: 'osrm', mapEngine: 'yandex', mapKind: 'yandex' }; // 22.09-126: роутеры теста проезда — только автомобильные // mapEngine: 'yandex' | 'osm' — движок // 22.09-167: mapKind: 'yandex' | 'ghyb' | 'gsat' — подложка (Яндекс-схема / спутник Google)
  // Восстанавливаем выбор роутера из localStorage, чтобы между сессиями работал.
  try {
    var _savedRouter = localStorage.getItem('smartplan_test_router');
    if (_savedRouter && /^(osrm|brouter-car|valhalla|google)$/.test(_savedRouter)) { // 22.09-175
      TS.router = _savedRouter;
    }
    var _savedMap = localStorage.getItem('smartplan_test_map_engine');
    if (_savedMap && /^(yandex|osm)$/.test(_savedMap)) {
      TS.mapEngine = _savedMap;
    }
    // 22.09-167: подложка тестовой карты (Яндекс-схема / спутник Google Earth)
    var _savedKind = localStorage.getItem('smartplan_test_mapkind');
    if (_savedKind && /^(yandex|gsat|ghyb|g3d)$/.test(_savedKind)) {
      TS.mapKind = _savedKind;
    }
  } catch (e) {}
  /* КАЛИБРОВКА ВРЕМЕНИ ПО ЯНДЕКС.КАРТАМ: свободное время роутера Яндекса
     стабильно длиннее дорожного времени OSRM (медиана 1,385 по 12 контрольным
     маршрутам по Минску — Ботаническая↔центр, ВС↔ЮЗ, запад↔восток и т.д.,
     данные из SSR виджета Яндекс.Карт). Умножаем время OSRM на этот
     коэффициент — цифры совпадают с Яндекс.Картами с точностью ~±15%.
     Пробки учитываются отдельно — живыми тайлами Яндекс.Пробок (см. tJamsAdjust). */
  var T_YANDEX_K = 1.39;
  /* Коэффициент пробок по часу суток (Минск, типичные будни).
     Усреднённые значения: пик 7–10 и 17–20 — ×1.35–1.5, день — ×1.15, ночь — ×1.0.
     Это ПРИБЛИЖЁННАЯ эвристика (точный расчёт требует Яндекс.Карт API с ключом
     + живые тайлы пробок). Используется, чтобы OSRM-время × 1.39 ближе к Яндексу. */
  function jamFactorByHour(h) {
    var f = [1.00, 1.00, 1.00, 1.00, 1.00, 1.05, 1.20, 1.40,  // 0..7
             1.45, 1.40, 1.30, 1.20, 1.15, 1.15, 1.15, 1.20,  // 8..15
             1.30, 1.45, 1.50, 1.45, 1.30, 1.15, 1.05, 1.00]; // 16..23
    return f[((h | 0) % 24 + 24) % 24];
  }
  /* Сейчас выбранный час дня (для калибровки времени маршрута пробками) */
  function currentHourForJam() {
    try {
      // Берём час из активной даты на тестовой карте (TS.off) если есть, иначе — сейчас
      var off = (window.TS && TS.off != null) ? TS.off : 0;
      var d = offToDate(off);
      if (off !== 0) return 10; // не сегодня — условно дневное время (10:00)
      return new Date().getHours();
    } catch (e) { return new Date().getHours(); }
  }
  var tState = { token: 0, loaded: false, loading: false, waiting: [], ymap: null, pts: [], route: null, manualOrder: false, leafletMap: null, leafletRouteLayer: null, leafletArrows: [], leafletMarkers: [], roadClosures: [], closureLayers: [], manualClosures: [], drawingClosure: false, drawPoints: [] };
  var TEST_CLOSURES_KEY = 'smartplan_test_closures';
  function tFindTask() { return null; } /* ТЕСТ: реальными задачами не оперируем — записи отключены */

  function reorderTestCard(fromId, toId) {
    var pts = tState.pts;
    if (!pts || !pts.length) return;
    var fromIdx = -1, toIdx = -1;
    pts.forEach(function (p, i) {
      if (p.id === fromId) fromIdx = i;
      if (p.id === toId) toIdx = i;
    });
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    var moved = pts.splice(fromIdx, 1)[0];
    pts.splice(toIdx, 0, moved);
    tState.manualOrder = true;
    refreshTestCards(pts);
    drawTestMap(pts);
    toast('ok', 'Порядок изменён');
  }

  function renderTestMap() {
    try {
      var off = TS.off;
      var masters = visibleMasters() || [];
    if (!TS.master) TS.master = 'all';
    if (S.role === 'master' && S.user) TS.master = S.user.id;
    if (TS.master !== 'all') {
      var foundM = false;
      for (var i = 0; i < masters.length; i++) if (masters[i].id === TS.master) { foundM = true; break; }
      if (!foundM) TS.master = 'all';
    }

    var list = visibleTasks().filter(function (t) {
      if (t.d !== off || isDone(t)) return false;
      if (TS.master && TS.master !== 'all') return t.m === TS.master;
      return true;
    });
    var base = currentBase();
    var prevObj = base;
    var pts = list.map(function (t) {
      var o = OBJ_MAP[t.o] || null, m = masterById(t.m), w = workOf(t);
      // Координаты: если задача привязана к объекту справочника (ГРП/ШРП) и у него заданы
      // координаты — они ГЛАВНЫЕ (указанные в справочнике), геокодер/старые t.lat не важны
      var lat = (o && o.lat != null) ? o.lat : ((t.lat != null) ? t.lat : null);
      var lng = (o && o.lng != null) ? o.lng : ((t.lng != null) ? t.lng : null);
      var travelMin = t.travelMin != null ? t.travelMin : null;
      var travelKm = t.travelKm != null ? t.travelKm : null;
      var travelKmText = t.travelKmText != null ? t.travelKmText : (travelKm != null ? travelKm.toFixed(1).replace('.', ',') + ' км' : null);
      var travelText = t.travelText != null ? t.travelText : (travelMin != null ? fmtDuration(travelMin) : null);
      if (lat != null && lng != null) prevObj = { lat: lat, lng: lng };
      // 22.09-223: hours — ДЛИТЕЛЬНОСТЬ (стоянка на точке), norm — ОБЩАЯ норма из справочника
      return { id: t.id, lat: lat, lng: lng, addr: addrOf(t), addr_be: t.addr_be || addrOf(t), type: o ? o.type : '—', work: w ? w.name : '?', master: m ? m.name : '?', mcol: m ? m.color : '#94a3b8', hours: taskDurHours(t), norm: w ? w.norm : 0, travelMin: travelMin, travelText: travelText, travelKm: travelKm, travelKmText: travelKmText };
    });

    // 22.09-167: выбор подложки карты — схема Яндекс или спутник Google Earth
    var provSelHTML = '<div style="display:flex;align-items:center;gap:6px;margin-left:auto;"><span style="font-size:12px;color:var(--ink);font-weight:700;">Карта:</span>' +
      '<select id="t-map-kind-sel" title="Подложка карты: схема Яндекс.Карт или спутниковый снимок Google (Google Earth)" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--card);color:var(--ink);font-weight:700;cursor:pointer;height:32px;max-width:210px">' +
        '<option value="yandex" ' + (TS.mapKind !== 'gsat' && TS.mapKind !== 'ghyb' ? 'selected' : '') + '>Яндекс (схема)</option>' +
        '<option value="ghyb" ' + (TS.mapKind === 'ghyb' ? 'selected' : '') + '>🌍 Google спутник + названия</option>' +
        '<option value="gsat" ' + (TS.mapKind === 'gsat' ? 'selected' : '') + '>🌍 Google Earth (спутник)</option>' +
        '<option value="g3d" ' + (TS.mapKind === 'g3d' ? 'selected' : '') + '>🌍 Google Earth — планета 3D (дороги, дома)</option>' + // 22.09-174
      '</select></div>';

    var html = '<div class="cal-head"><div class="seg">' +
      '<button class="' + (off === -1 ? 'on' : '') + '" data-action="t-map-off" data-off="-1">Вчера</button>' +
      '<button class="' + (off === 0 ? 'on' : '') + '" data-action="t-map-off" data-off="0">Сегодня</button>' +
      '<button class="' + (off === 1 ? 'on' : '') + '" data-action="t-map-off" data-off="1">Завтра</button></div>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:12.5px;color:var(--muted);font-weight:600;">Выбрать дату:</span>' +
        '<input type="date" id="t-date-sel" value="' + key(offToDate(off)) + '" style="padding:5px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit;background:var(--card);color:var(--ink);font-weight:600;cursor:pointer;" title="Выбрать любую дату для просмотра маршрута">' +
      '</div>' +

      '<button class="btn sm" id="t-btn-traffic" title="Слой Яндекс.Пробок: загруженность дорог и события (аварии, ремонт) на карте">🚦 Пробки</button>' +
      '<button class="btn sm" id="t-btn-yandex" style="display:none;background:#c8102e;border-color:#c8102e;color:#fff" title="Открыть построенный маршрут в Яндекс.Картах (новая вкладка)">↗ Яндекс.Карты</button>' +
      '<button class="btn sm" id="t-btn-google" style="display:none;background:#1a73e8;border-color:#1a73e8;color:#fff" title="Открыть построенный маршрут в Google Maps (новая вкладка) — реальное время в пути от Google">🌐 Google Maps</button>' +
      '<button class="btn sm" id="t-btn-gearth" style="display:none;background:#0b8043;border-color:#0b8043;color:#fff" title="Скачать построенный маршрут файлом .kml — открывается в Google Earth (компьютер или телефон): база, пронумерованные точки объезда и линия маршрута на спутниковом глобусе">🌍 Google Earth</button>' +
      (S.role === 'viewer' ? '<span style="font-size:12px;color:var(--muted);font-weight:600;">👁 Режим просмотра</span>' :
        '<select id="t-route-router-sel" title="Роутер для построения основного маршрута" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--card);color:var(--ink);font-weight:700;cursor:pointer;height:32px">' +
          '<option value="osrm" ' + (TS.router === 'osrm' ? 'selected' : '') + '>🚗 OSRM</option>' +
          '<option value="brouter-car" ' + (TS.router === 'brouter-car' ? 'selected' : '') + '>🚗 BRouter car-fast</option>' +
          '<option value="valhalla" ' + (TS.router === 'valhalla' ? 'selected' : '') + '>🟧 Valhalla</option>' +
          '<option value="google" ' + (TS.router === 'google' ? 'selected' : '') + '>🌐 Google (маршрут строит сам Google)</option>' + // 22.09-175
        '</select>' +
        '<button class="btn primary" id="t-btn-build-route" data-action="t-build-route" disabled style="opacity:.5;cursor:not-allowed;">' + IC.route + ' Оптимизация маршрутов</button>' + '<button class="btn sm" id="t-btn-compare" data-action="t-build-compare" style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;font-weight:700" title="Сравнить автомобильные роутеры (OSRM demo / FOSSGIS car / Valhalla public / osm.ch / BRouter car / Прямая линия ×1.4)">🔀 Сравнить</button>') +
      '<div class="spacer"></div>' +
      provSelHTML +
      '</div>';

    var masterSelHTML = '<select id="t-master-sel" style="padding:4px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px;background:var(--card);color:var(--ink);max-width:200px;font-weight:600;">';
    if (masters.length > 1) {
      masterSelHTML += '<option value="all"' + (TS.master === 'all' ? ' selected' : '') + '>Все мастера (' + masters.length + ')</option>';
    }
    masters.forEach(function (m) {
      masterSelHTML += '<option value="' + m.id + '"' + (TS.master === m.id ? ' selected' : '') + '>' + esc(m.name) + ' (' + esc(m.area) + ')</option>';
    });
    masterSelHTML += '</select>';

    var curD = offToDate(off);
    var shortDateStr = curD.getDate() + ' ' + MON[curD.getMonth()].slice(0, 3) + '. ' + String(curD.getFullYear()).slice(-2);
    html += '<div class="map-wrap"><div><div class="card"><div class="card-h"><div style="display:flex;flex-direction:column;line-height:1.15;gap:2px;"><span style="font-size:13px;font-weight:700;color:var(--ink);">Задания на</span><span style="font-size:12px;font-weight:700;color:var(--blue);">' + shortDateStr + '</span></div><div class="spacer"></div>' + masterSelHTML + '</div><div class="card-b mlist" id="t-mlist">';
    if (!pts.length) html += '<div class="empty">На этот день заданий нет</div>';
    pts.forEach(function (p, i) {
      html += '<div class="mtask sel" data-mid="' + p.id + '" draggable="true"><div class="mtask-grip">' + IC.grip + '</div><div class="pin" style="background:' + p.mcol + '">' + (i + 1) + '</div><div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--ink);font-size:12.5px;margin-bottom:3px">📍 ' + esc(p.addr) + '</div><div style="font-size:12.5px;color:var(--txt);margin-bottom:2px">🔧 ' + esc(p.work) + '</div><div style="font-size:12.5px;color:var(--muted);">⏱ Норма времени: <b>' + fmtH(p.norm) + ' ч</b></div></div></div>';
    });
    // Блок базы — как задание, в конце списка
    var existRT = getRouteTime(TS.master !== 'all' ? TS.master : null, off);
    html += '<div class="mtask base-card" id="t-base-card" style="background:linear-gradient(135deg,#0f2740,#1a3a5c);color:#fff;border-color:transparent;cursor:default;">' +
      '<div class="mtask-grip" style="color:rgba(255,255,255,.35);cursor:default;">' + IC.grip + '</div>' +
      '<div class="pin" style="background:var(--card);color:var(--navy);font-size:14px;">🏁</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:700;font-size:12.5px;margin-bottom:3px;color:#fff">📍 ' + esc(base.name) + '</div>' +
        '<div style="font-size:12.5px;color:#93c5fd;margin-bottom:2px">🏠 База · точка возврата</div>' +
        '<div style="font-size:12.5px;color:#cbd5e1;" id="t-base-return-info">' + (existRT && existRT.lastLegMin ? '🛣 От последнего задания: <b style="color:#fff">' + fmtDuration(existRT.lastLegMin) + '</b> · ' + (existRT.lastLegKm || 0).toFixed(1).replace('.', ',') + ' км' : 'Маршрут до базы рассчитается при оптимизации') + '</div>' +
      '</div></div>';
    html += '</div></div></div>';

    html += '<div><div class="map-box" id="t-mapbox"><div class="t-map-stats" id="t-map-stats" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><span>Объектов: <b>' + pts.length + '</b></span><span style="display:flex;align-items:center;gap:6px;border-left:1px solid var(--line);padding-left:12px;margin-left:4px;"><span style="color:var(--txt);font-weight:600;">Общее время и километраж:</span> <span id="t-route-info" style="color:var(--muted);font-weight:700;">нажмите «Оптимизировать маршрут» для расчета</span></span><span style="margin-left:auto;color:var(--muted)">🚩 ' + esc(currentBase().name) + '</span></div><div id="t-canvas" style="width:100%;height:calc(100vh - 210px);min-height:400px"></div><div class="t-note" id="t-note"></div></div></div></div>';

    view.innerHTML = html;
    TS.sel = {}; pts.forEach(function (p) { TS.sel[p.id] = true; });
    if (tState.returnTrip) pts.returnTrip = tState.returnTrip;
    tState.manualOrder = false;
    refreshTestCards(pts);

    var dtSel = document.getElementById('t-date-sel');
    if (dtSel) dtSel.addEventListener('change', function(e) {
      if (e.target.value) {
        var picked = new Date(e.target.value + 'T00:00:00');
        if (!isNaN(picked.getTime())) {
          TS.off = dateToOff(picked);
          renderTestMap();
        }
      }
    });

    var tYaBtn = document.getElementById('t-btn-yandex');
    if (tYaBtn) tYaBtn.addEventListener('click', function () {
      var items = tState.routeItems;
      if (!items || items.length < 2) { toast('warn', 'Сначала постройте маршрут'); return; }
      window.open(buildYandexDirUrl(items, false), '_blank', 'noopener');
    });
    var tGBtn = document.getElementById('t-btn-google');
    if (tGBtn) tGBtn.addEventListener('click', function () {
      var items = tState.routeItems;
      if (!items || items.length < 2) { toast('warn', 'Сначала постройте маршрут'); return; }
      // Без API-ключа открываем страницу Google Maps с маршрутом и временем в пути.
      // Google сам посчитает время с пробками и покажет его на странице.
      var url = buildGoogleDirUrl(items);
      window.open(url, '_blank', 'noopener');
    });
    // 22.09-163: «Google Earth» — скачать маршрут файлом .kml
    var tGEBtn = document.getElementById('t-btn-gearth');
    if (tGEBtn) tGEBtn.addEventListener('click', function () { exportTestRouteToKml(); });

    var tTrBtn = document.getElementById('t-btn-traffic');
    if (tTrBtn) tTrBtn.title = 'Слой Яндекс.Пробок: включается по вашему выбору (по умолчанию выключен)';
    if (tTrBtn) tTrBtn.addEventListener('click', function () {
      TS.traffic = !TS.traffic;
      try {
        if (tState.traffic) tState.traffic.setMap(TS.traffic ? tState.ymap : null);
      } catch (e) {}
      tSyncTrafficBtn();
      toast('ok', TS.traffic ? '🚦 Слой пробок включён (цвета дорог + аварии)' : 'Слой пробок выключен');
    });

    var mlist = document.getElementById('t-mlist');

    // Клик — вкл/выкл задания
    mlist.addEventListener('click', function (e) {
      var el = e.target.closest('.mtask'); if (!el) return;
      var id = el.dataset.mid;
      if (!id) return; // карточка базы (нет data-mid) — не обрабатываем
      TS.sel[id] = !TS.sel[id];
      el.classList.toggle('sel', TS.sel[id]);
    drawTestMap(pts);
    });

    // === DRAG-AND-DROP: смена порядка заданий ===
    var mapDragId = null;
    mlist.addEventListener('dragstart', function (e) {
      var card = e.target.closest('.mtask');
      if (!card) return;
      mapDragId = card.dataset.mid;
      card.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', mapDragId); } catch (err) {}
    });
    mlist.addEventListener('dragend', function () {
      mlist.querySelectorAll('.mtask').forEach(function (c) {
        c.style.opacity = ''; c.classList.remove('drop-above');
      });
      mapDragId = null;
    });
    mlist.addEventListener('dragover', function (e) {
      if (!mapDragId) return;
      var card = e.target.closest('.mtask');
      if (!card || card.dataset.mid === mapDragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      mlist.querySelectorAll('.mtask.drop-above').forEach(function (c) { c.classList.remove('drop-above'); });
      card.classList.add('drop-above');
    });
    mlist.addEventListener('drop', function (e) {
      if (!mapDragId) return;
      var card = e.target.closest('.mtask');
      if (!card || card.dataset.mid === mapDragId) return;
      e.preventDefault();
      e.stopPropagation();
      reorderTestCard(mapDragId, card.dataset.mid);
    });

    // === HOVER/CLICK подсветка карточка ↔ маркер ===
    // Наводимся на карточку — подсвечиваем её маркер на карте.
    // Клик по карточке — центрируем карту + ставим «выбранную» подсветку.
    var mlistHL = document.getElementById('t-mlist');
    if (mlistHL && !mlistHL.__hoverWired) {
      mlistHL.__hoverWired = true;
      mlistHL.addEventListener('mouseover', function (e) {
        var card = e.target.closest && e.target.closest('.mtask');
        if (!card) return;
        var id = card.dataset.mid;
        if (!id) return;
        if (!tState._activeHL) tState._activeHL = {};
        tState._activeHL[id] = true;
        // Подсвечиваем парный маркер
        var mk = (tState.leafletMarkers || []).find(function (m) { return m._taskId === id; });
        if (mk) {
          try { mk.options.set('iconImageHref', lmSvgIcon(mk._label, mk._bg, mk._size + 8, true)); } catch (er) {}
        }
      });
      mlistHL.addEventListener('mouseout', function (e) {
        var card = e.target.closest && e.target.closest('.mtask');
        if (!card) return;
        var id = card.dataset.mid;
        if (!id) return;
        // На мышь может быть переход на тот же card — проверим relatedTarget
        var to = e.relatedTarget;
        if (to && card.contains(to)) return;
        if (tState._activeHL) delete tState._activeHL[id];
        var mk = (tState.leafletMarkers || []).find(function (m) { return m._taskId === id; });
        if (mk) {
          try { mk.options.set('iconImageHref', lmSvgIcon(mk._label, mk._bg, mk._size, false)); } catch (er) {}
        }
      });
      // Клик по карточке (но НЕ по зоне перетаскивания) — центрируем карту
      mlistHL.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;
        var grip = e.target.closest('.mtask-grip');
        if (grip) return; // клик по зоне drag — пусть обрабатывает старый код
        var pin = e.target.closest('.pin');
        // клик по пину/тексту — центрируем и подсвечиваем
        var card = e.target.closest('.mtask');
        if (!card) return;
        var id = card.dataset.mid;
        if (!id) return;
        // Стандартный обработчик (вкл/выкл) тоже сработает — это ок.
        // Мы только добавляем центрирование и переключаем .t-picked.
        tUnmarkAllPicked();
        var mk = (tState.leafletMarkers || []).find(function (m) { return m._taskId === id; });
        if (mk && tState.ymap) {
          try {
            tState.ymap.setCenter([mk.geometry.getCoordinates()[0], mk.geometry.getCoordinates()[1]], Math.max(tState.ymap.getZoom(), 14), { duration: 250 });
            mk.options.set('iconImageHref', lmSvgIcon(mk._label, '#7c3aed', mk._size + 8, true));
          } catch (er) {}
          card.classList.add('t-picked');
        }
      });
      // Клик по подвалу — закрываем «выбрано»
      mlistHL.addEventListener('mouseleave', function () {
        // не сбрасываем t-picked, чтобы не терять выбор при случайных выходах
      });
    }

// Привязка кнопки ручной разметки закрытых дорог
    var drawBtn = document.getElementById('t-btn-draw-closure');
    if (drawBtn) drawBtn.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (tState.leafletMap) {
        if (tState.drawingClosure) {
          tFinishDrawingClosure(tState.leafletMap);
        } else {
          tStartDrawingClosure(tState.leafletMap);
        }
      } else {
        toast('warn', 'Карта ещё загружается...');
      }
    };
    var delClosureBtn = document.getElementById('t-btn-delete-closure');
    if (delClosureBtn) delClosureBtn.onclick = function(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (tState.leafletMap) tDeleteSelectedClosure(tState.leafletMap);
      else toast('warn', 'Карта ещё загружается...');
    };
    drawTestMap(pts);
    var mSel = document.getElementById('t-master-sel');
    if (mSel) mSel.addEventListener('change', function (e) { TS.master = e.target.value; renderTestMap(); });
    // Выбор роутера для основного маршрута — только автомобильные (OSRM / BRouter car / Valhalla)
    var rSel = document.getElementById('t-route-router-sel');
    if (rSel && !rSel.__wired) {
      rSel.__wired = true;
      rSel.addEventListener('change', function (e) {
        TS.router = e.target.value;
        // Сохраняем выбор в localStorage, чтобы работал между сессиями
        try { localStorage.setItem('smartplan_test_router', TS.router); } catch (er) {}
        // Подсветить подсказку
        var labels = {
          'osrm': 'OSRM (автомобильный, дорожная сеть OSM)',
          'brouter-car': 'BRouter car-fast (авто, энергоэффективный)',
          'valhalla': 'Valhalla public (авто, с проверкой закрытий)',
          'google': 'Google — маршрут откроется в новой вкладке, строит сам Google' // 22.09-175
        };
        try { toast('info', '🚦 Роутер: ' + (labels[TS.router] || TS.router)); } catch (er) {}
      });
    }
    // 22.09-167: выбор подложки карты (Яндекс-схема / спутник Google Earth)
    var kindSel = document.getElementById('t-map-kind-sel');
    if (kindSel) {
      kindSel.addEventListener('change', function (e) {
        var v = /^(yandex|gsat|ghyb|g3d)$/.test(e.target.value) ? e.target.value : 'yandex';
        var _prevKind = TS.mapKind;
        TS.mapKind = v;
        try { localStorage.setItem('smartplan_test_mapkind', v); } catch (er) {}
        // 22.09-173: в/из «Google Earth 3D» — другая технология (MapLibre), перерисовываем карту целиком
        if (v === 'g3d' || _prevKind === 'g3d') { try { drawTestMap(tState.allPts || []); } catch (er) {} }
        else tApplyMapKind();
        try { toast('ok', v === 'yandex' ? '🗺 Подложка: Яндекс (схема)' : (v === 'ghyb' ? '🌍 Подложка: спутник Google с названиями улиц' : (v === 'g3d' ? '🌍 Режим: Google Earth — планета 3D. При отдалении — глобус со схемой дорог, вблизи — объёмные дома. Вращайте правой кнопкой мыши' : '🌍 Подложка: Google Earth (спутник)'))); } catch (er) {}
      });
    }
    } catch (err) {
      console.error('renderTestMap error:', err);
      var viewEl = document.getElementById('view');
      if (viewEl) viewEl.innerHTML = '<div class="card"><div class="card-b" style="color:var(--red);padding:20px;font-weight:600;">Ошибка отображения Карты маршрутов: ' + esc(err.message) + '</div></div>';
    }
  }


  // Азимут (угол направления от точки A к точке B), в градусах 0..360


  // === Ручная разметка закрытых дорог на карте ===
  // Пользователь кликает по карте, создавая точки. Двойной клик — завершить.
  // Закрытый участок сохраняется и используется для объезда маршрута.

  function tGetManualClosures() {
    try { var raw = localStorage.getItem(TEST_CLOSURES_KEY); if (raw) return JSON.parse(raw); } catch(e) {}
    return [];
  }

  function tSaveManualClosures(closures) {
    try { localStorage.setItem(TEST_CLOSURES_KEY, JSON.stringify(closures)); } catch(e) {}
  }

  function tStartDrawingClosure(map) {
    if (tState.drawingClosure) { tFinishDrawingClosure(map); return; }
    tState.drawingClosure = true;
    var btn = document.getElementById('t-btn-draw-closure');
    if (btn) { btn.textContent = '✓ Завершить'; btn.style.background = '#16a34a'; }
    tState.drawPoints = [];
    tState._tempMarkers = [];
    tState._lastClosureLL = null;
    toast('info', '🚧 Кликайте по карте, расставляя точки закрытого участка. Готово — нажмите «✓ Завершить» (нужно ≥ 2 точек).');
    map._closureClickHandler = function(e) {
      var ll = [e.latlng.lat, e.latlng.lng];
      // Защита от случайного двойного клика: пропускаем клик в ту же точку подряд
      if (tState._lastClosureLL) {
        var dx = tState._lastClosureLL[0] - ll[0], dy = tState._lastClosureLL[1] - ll[1];
        if (dx * dx + dy * dy < 1e-12) return;
      }
      tState._lastClosureLL = ll;
      tState.drawPoints.push(ll);
      if (tState._tempLine) { try { tState._tempLine.remove(); } catch (ex) {} }
      if (tState.drawPoints.length >= 2) {
        tState._tempLine = window.L.polyline(tState.drawPoints, { color: '#dc2626', weight: 5, opacity: 0.8, dashArray: '6,4' }).addTo(map);
      }
      var cm = window.L.circleMarker(e.latlng, { radius: 5, color: '#dc2626', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
      tState._tempMarkers.push(cm);
    };
    map.on('click', map._closureClickHandler);
    map.doubleClickZoom.disable();
  }

  function tFinishDrawingClosure(map) {
    if (!tState.drawingClosure) return;
    tState.drawingClosure = false;
    var btn = document.getElementById('t-btn-draw-closure');
    if (btn) { btn.textContent = '🚧 Закрытие'; btn.style.background = '#dc2626'; }
    map.off('click', map._closureClickHandler);
    map.doubleClickZoom.enable();
    if (tState._tempLine) { try { tState._tempLine.remove(); } catch (e) {} tState._tempLine = null; }
    if (tState._tempMarkers) { tState._tempMarkers.forEach(function (m) { try { m.remove(); } catch (e) {} }); tState._tempMarkers = []; }
    if (tState.drawPoints.length >= 2) {
      var mc = tGetManualClosures();
      var name = 'Закрытие №' + (mc.length + 1);
      var closure = { latlngs: tState.drawPoints.slice(), name: name, type: 'manual', manual: true };
      tState.roadClosures.push(closure);
      mc.push(closure);
      tSaveManualClosures(mc);
      tShowRoadClosures(map);
      toast('ok', '✓ Закрытый участок добавлен (' + tState.drawPoints.length + ' точек). Маршрут будет строиться в объезд.');
      logAction('Добавление закрытия дороги', name);
    } else {
      toast('warn', 'Нужно минимум 2 точки — участок не сохранён.');
    }
    tState.drawPoints = [];
    tState._lastClosureLL = null;
  }



  // === Загрузка закрытых/ремонтируемых дорог из OpenStreetMap (Overpass API) ===

  function tLoadRoadClosures(callback) {
    if (closuresLoaded) { callback(tState.roadClosures); return; }
    if (closuresLoading) { setTimeout(function() { tLoadRoadClosures(callback); }, 2000); return; }
    closuresLoading = true;
    var query = '[out:json][timeout:25];(' +
      'way["construction"](53.7,27.3,54.1,27.9);' +
      'way["highway"="construction"](53.7,27.3,54.1,27.9);' +
      'way["highway"]["access"="no"](53.7,27.3,54.1,27.9);' +
      'way["highway"]["motor_vehicle"="no"](53.7,27.3,54.1,27.9);' +
      'way["highway"]["motorcar"="no"](53.7,27.3,54.1,27.9);' +
      'way["highway"]["disused:highway"](53.7,27.3,54.1,27.9);' +
      'way["highway"]["note"~"закрыт|перекрыт|ремонт|перекрытие",i](53.7,27.3,54.1,27.9);' +
      ');out geom;';
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query)
    }).then(function(r) { return r.json(); }).then(function(data) {
      var roadTypes = ['residential','primary','secondary','tertiary','service','trunk','unclassified','yes','motorway','motorway_link'];
      var closures = [];
      (data.elements || []).forEach(function(e) {
        var tags = e.tags || {};
        var con = tags.construction || '';
        if (roadTypes.indexOf(con) !== -1 || tags.highway === 'construction') {
          var geom = e.geometry || [];
          if (geom.length >= 2) {
            var latlngs = geom.map(function(g) { return [g.lat, g.lon]; });
            closures.push({ latlngs: latlngs, name: tags.name || 'без названия', type: con || 'construction' });
          }
        }
      });
      tState.roadClosures = closures;
      closuresLoaded = true; closuresLoading = false;
      console.log('🚧 Загружено закрытых дорог из OSM:', closures.length);
      callback(closures);
    }).catch(function(e) {
      closuresLoading = false;
      console.warn('Overpass API недоступен:', e);
      callback([]);
    });
  }

  function tShowRoadClosures(map) {
    if (tState.closureLayers) { tState.closureLayers.forEach(function(l) { try { l.remove(); } catch(e) {} }); }
    tState.closureLayers = [];
    tState.roadClosures.forEach(function(c) {
      var isSelected = tState.selectedClosure === c;
      var style;
      if (c.manual && isSelected) {
        style = { color: '#16a34a', weight: 9, opacity: 1 };             // ВЫБРАНО — зелёный, сплошной
      } else if (c.manual) {
        style = { color: '#dc2626', weight: 6, opacity: 0.8, dashArray: '6,4' };
      } else {
        style = { color: '#dc2626', weight: 4, opacity: 0.5, dashArray: '6,4' };
      }
      var line = window.L.polyline(c.latlngs, style).addTo(map);
      var tip = '🚧 ' + c.name + (c.manual ? (isSelected ? ' (выбрано — нажмите «🗑 Удалить выбранное»)' : ' — нажмите, чтобы выбрать') : ' (из OSM)');
      line.bindTooltip(tip, { sticky: true });
      if (c.manual) {
        line.on('click', function() {
          // клик по заметке = ВЫБОР (не удаление); повторный клик — снятие выбора
          tState.selectedClosure = (tState.selectedClosure === c) ? null : c;
          tShowRoadClosures(map);
          tUpdateClosureDeleteBtn();
        });
      }
      tState.closureLayers.push(line);
    });
  }

  // Показывает/прячет кнопку удаления выбранного закрытия

  function tUpdateClosureDeleteBtn() {
    var btn = document.getElementById('t-btn-delete-closure');
    if (!btn) return;
    if (tState.selectedClosure) {
      btn.style.display = '';
      btn.textContent = '🗑 Удалить «' + (tState.selectedClosure.name || 'закрытие') + '»';
    } else {
      btn.style.display = 'none';
    }
  }

  // Удаляет выбранное закрытие (вызывается кнопкой «🗑 Удалить выбранное»)

  function tDeleteSelectedClosure(map) {
    if (!tState.selectedClosure) { toast('warn', 'Сначала выберите закрытый участок — кликните по нему.'); return; }
    var c = tState.selectedClosure;
    tState.roadClosures = tState.roadClosures.filter(function(r) { return r !== c; });
    if (c.manual) {
      var mc = tGetManualClosures();
      mc = mc.filter(function(r) { return r.name !== c.name || JSON.stringify(r.latlngs) !== JSON.stringify(c.latlngs); });
      tSaveManualClosures(mc);
    }
    tState.selectedClosure = null;
    tShowRoadClosures(map);
    tUpdateClosureDeleteBtn();
    toast('ok', '✓ Закрытый участок удалён');
    logAction('Удаление закрытия дороги', c.name || '');
  }

  // === Рендер Leaflet карты для OSRM / GraphHopper / OpenRouteService ===


  // Добавляет слой MapTiler OMT с подписями ТОЛЬКО на русском языке.
  // map — уже созданный объект Leaflet.



  // === ТЕСТ ЗАВИСИМОСТИ: одна задача + вид работы + трудоёмкость ===
  // Полигон для отладки формул расчёта по параметрам объекта.
  // Поля вводятся вручную (наименования, атрибуты), здесь только хранение и отображение.
  function renderTestDep() {
    var KEY = 'smartplan_test_dep';
    function load() {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; }
    }
    function save(data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }
    var data = load();
    var works = (window.SP_WORK && SP_WORK.getWorkTree) ? SP_WORK.getWorkTree() : [];

    var html = '<div style="max-width:1080px;margin:0 auto;padding:18px">';
    html += '<div style="display:grid;grid-template-columns:1fr 380px;gap:14px;align-items:start">';
    // Левая колонка — форма
    html += '<div class="card" style="padding:18px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 2px 10px rgba(15,39,64,.04)">';
    html += '<div style="font-size:14px;font-weight:800;color:var(--ink);margin-bottom:4px">Тест зависимости трудоёмкости</div>';
    html += '<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Полигон для отладки формулы расчёта по параметрам объекта. Откройте форму задачи — как в планировании — заполните, добавьте. Задача появится в планировании, а ниже покажутся её поля для формулы.</div>';

    // Блок 1: открытие формы задачи
    html += '<div style="margin-bottom:14px;padding:14px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px">';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="font-size:13px;font-weight:800;color:var(--ink)">📋 Задача</div><span style="font-size:12px;color:var(--muted)">— полная форма как в планировании</span></div>';
    html += '<button type="button" id="td-open-form" class="btn primary" style="background:#2563eb;color:#fff;border:none;padding:9px 18px;font-weight:700;display:inline-flex;align-items:center;gap:6px">＋ Открыть форму задачи</button>';
    html += '</div>';

    // Блок 2: выбранная задача (если есть)
    if (data.taskId) {
      var t = null;
      try { t = (window.SP_TASKS && SP_TASKS.getTasks) ? SP_TASKS.getTasks().find(function (x) { return x.id === data.taskId; }) : (S.tasks || []).find(function (x) { return x.id === data.taskId; }); } catch (e) {}
      if (t) {
        html += '<div style="margin-bottom:14px;padding:14px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #7dd3fc;border-radius:10px">';
        html += '<div style="font-size:12px;font-weight:800;color:#0c4a6e;margin-bottom:6px">✅ Текущая тестовая задача</div>';
        var wIds = t.works && t.works.length ? t.works : (t.w ? [t.w] : []);
        var ws = wIds.map(function (wid) {
          for (var i = 0; i < works.length; i++) if (works[i].id === wid) return works[i];
          return { id: wid, name: wid, norm: 0 };
        });
        html += '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px">📍 ' + esc(t.addr || '—') + '</div>';
        html += '<div style="font-size:12px;color:var(--txt);margin-bottom:4px">🔧 ' + ws.map(function (x) { return esc(x.name) + ' (' + (x.norm || 0) + ' ч)'; }).join(', ') + '</div>';
        var mObj = masterById(t.m);
        html += '<div style="font-size:12px;color:var(--muted)">👤 ' + (mObj ? esc(mObj.name) + ' · ' + esc(mObj.area) : '—') + ' · 📅 ' + (t.d != null ? offToDate(t.d).toLocaleDateString('ru-RU') : '—') + ' · 📦 объём ' + (t.volume || 1) + '</div>';
        // Кнопка очистки
        html += '<button type="button" id="td-clear-task" class="btn sm" style="margin-top:8px;background:#fff;color:var(--red);border:1px solid var(--red);padding:6px 12px">✕ Отвязать задачу</button>';
        html += '</div>';
      }
    }

    // Блок 3: список последних 10 задач (быстрый выбор)
    var recentTasks = (S.tasks || []).slice().sort(function (a, b) {
      return (b.id || '').localeCompare(a.id || '');
    }).slice(0, 10);
    if (recentTasks.length) {
      html += '<div style="margin-bottom:14px">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:6px">или выберите существующую задачу:</div>';
      html += '<select id="td-task" style="width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px;background:var(--bg);color:var(--ink)">';
      html += '<option value="">— из списка —</option>';
      recentTasks.forEach(function (t) {
        var sel = (data.taskId === t.id) ? ' selected' : '';
        var m = masterById(t.m);
        var dt = t.d != null ? offToDate(t.d).toLocaleDateString('ru-RU') : '—';
        var label = '📍 ' + esc(t.addr || '—') + ' · 👤 ' + (m ? esc(m.name) : '—') + ' · 📅 ' + dt;
        html += '<option value="' + esc(t.id) + '"' + sel + '>' + label + '</option>';
      });
      html += '</select>';
      html += '</div>';
    }

    // Блок 4: трудоёмкость (берётся из задачи автоматически, можно править руками)
    html += '<div style="margin-bottom:14px">';
    html += '<label style="display:block;font-size:12px;font-weight:700;color:var(--ink);margin-bottom:4px">Трудоёмкость (из задачи, чел·ч)</label>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<input type="number" id="td-hours" step="0.1" min="0" placeholder="2.5" value="' + (data.hours != null ? data.hours : '') + '" style="width:200px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;background:var(--bg);color:var(--ink)">';
    html += '<span style="font-size:12px;color:var(--muted)">чел·ч</span>';
    html += '</div>';
    html += '<div style="font-size:12px;color:var(--muted);margin-top:4px">Рассчитывается автоматически из выбранной задачи (norm × объём). Можно править руками для проверки формулы.</div>';
    html += '</div>';

    // Кнопки
    html += '<div style="display:flex;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">';
    html += '<button type="button" id="td-save" class="btn" style="background:#0f2740;color:#fff;border:none;padding:9px 18px;font-weight:700">💾 Сохранить</button>';
    html += '<button type="button" id="td-clear" class="btn" style="background:var(--bg);color:var(--ink);padding:9px 18px">Очистить</button>';
    html += '<button type="button" id="td-from-task" class="btn" style="background:#2563eb;color:#fff;border:none;padding:9px 18px;font-weight:700" title="Пересчитать трудоёмкость из выбранной задачи (norm × объём по всем видам работ)">⟲ Из задачи</button>';
    html += '</div>';

    html += '</div>'; // /left card

    // === Правая колонка: боковая панель «Итого» ===
    var selectedTask = null;
    if (data.taskId) {
      try {
        var _tasks = (window.SP_TASKS && SP_TASKS.getTasks) ? SP_TASKS.getTasks() : (S.tasks || []);
        selectedTask = _tasks.find(function (x) { return x.id === data.taskId; }) || null;
      } catch (e) {}
    }
    // Координаты объекта (выбираются из выбранной задачи; workId больше не используется,
    // потому что вид работы берётся из самой задачи)
    // Координаты объекта (из выбранной задачи или из справочника)
    var objCoords = null;
    if (selectedTask) {
      if (selectedTask.o && window.SP_OBJECTS) {
        try {
          var obj = (typeof SP_OBJECTS.getObjectById === 'function') ? SP_OBJECTS.getObjectById(selectedTask.o) : (OBJ_MAP[selectedTask.o] || null);
          if (obj && obj.lat != null && obj.lng != null) objCoords = { lat: obj.lat, lng: obj.lng };
        } catch (e) {}
      }
      if (!objCoords && selectedTask.lat != null && selectedTask.lng != null) {
        objCoords = { lat: selectedTask.lat, lng: selectedTask.lng };
      }
    }
    var base = null;
    try { base = (typeof currentBase === 'function') ? currentBase() : null; } catch (e) {}
    // Расстояние × 1.4 (извилистость), время без пробок / с пробками
    var roadKm = 0, freeMin = 0, jamMin = 0;
    if (objCoords && base) {
      roadKm = distKm(base, objCoords) * 1.4;
      freeMin = calculateYandexMinskTime(roadKm, false);
      jamMin = calculateYandexMinskTime(roadKm, true);
    }
    // workHours будет перезаписан в карточке «Трудоёмкость работы» (по всем работам задачи)
    var workHours = 0;
    var totalHours = 0;
    html += '<div style="display:flex;flex-direction:column;gap:12px;position:sticky;top:12px">';

    // Карточка «Трудоёмкость работы» — список всех работ из выбранной задачи
    // Берём работы из задачи (selectedTask.works), а не из отдельного select.
    var taskWorksList = [];
    var taskWorksTotal = 0;
    if (selectedTask && selectedTask.works && selectedTask.works.length) {
      var _m = masterById(selectedTask.m);
      var _area = _m ? _m.area : null;
      selectedTask.works.forEach(function (wid, i) {
        var _w = null;
        // сначала ищем в work_db по участку
        if (_area && typeof WORK !== 'undefined' && WORK.getWork) {
          _w = WORK.getWork(_area, wid);
        }
        // fallback — getWorkById
        if (!_w && typeof WORK !== 'undefined' && WORK.getWorkById) _w = WORK.getWorkById(wid);
        if (!_w) {
          // fallback — ищем в works (getWorkTree)
          _w = works.find(function (x) { return x.id === wid; });
        }
        if (!_w) _w = { id: wid, name: wid, norm: 0 };
        var _vol = 1;
        if (selectedTask.volumes && selectedTask.volumes[i] != null) _vol = parseFloat(selectedTask.volumes[i]) || 1;
        else _vol = parseFloat(selectedTask.volume) || 1;
        var _h = (_w.norm || 0) * _vol;
        taskWorksTotal += _h;
        taskWorksList.push({ w: _w, vol: _vol, h: _h });
      });
    }
    workHours = taskWorksTotal; // перезаписываем — теперь трудоёмкость из задачи

    html += '<div class="card" style="padding:14px 16px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:12px">';
    html += '<div style="font-size:12px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">🔧 Трудоёмкость работы</div>';
    if (taskWorksList.length) {
      taskWorksList.forEach(function (it, i) {
        html += '<div style="border-bottom:' + (i < taskWorksList.length - 1 ? '1px dashed #86efac' : 'none') + ';padding:6px 0">';
        html += '<div style="font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:2px">' + esc(it.w.name) + '</div>';
        if (it.w.group) html += '<div style="font-size:12px;color:var(--muted);margin-bottom:3px">📂 ' + esc(it.w.group) + '</div>';
        html += '<div style="font-size:12px;color:var(--txt);display:flex;justify-content:space-between;align-items:baseline"><span>норма ' + (it.w.norm || 0) + ' × объём ' + it.vol + '</span><b style="color:#15803d">' + (it.h ? it.h.toFixed(2).replace('.', ',') + ' ч' : '—') + '</b></div>';
        html += '</div>';
      });
      html += '<div style="border-top:2px solid #86efac;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;align-items:baseline">';
      html += '<span style="font-size:12px;font-weight:800;color:#166534">ВСЕГО</span>';
      html += '<b style="font-size:18px;font-weight:900;color:#15803d">' + (taskWorksTotal ? taskWorksTotal.toFixed(2).replace('.', ',') + ' ч' : '—') + '</b>';
      html += '</div>';
      html += '<div style="font-size:12px;color:var(--muted);margin-top:6px">из выбранной задачи</div>';
    } else if (selectedTask) {
      html += '<div style="font-size:12px;color:var(--muted);padding:14px 0;text-align:center">У задачи не указан вид работ</div>';
    } else {
      html += '<div style="font-size:12px;color:var(--muted);padding:14px 0;text-align:center">Выберите или создайте задачу</div>';
    }
    html += '</div>';

    // Карточка «Дорога от базы»
    html += '<div class="card" style="padding:14px 16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #93c5fd;border-radius:12px">';
    html += '<div style="font-size:12px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">🚗 От базы до объекта</div>';
    if (objCoords && base) {
      html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">🏠 База: <b style="color:var(--ink)">' + esc(base.name) + '</b></div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><span style="font-size:12px;color:var(--muted)">Расстояние</span><b style="font-size:14px;color:var(--ink)">' + (roadKm > 0 ? roadKm.toFixed(1).replace('.', ',') + ' км' : '—') + '</b></div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><span style="font-size:12px;color:var(--muted)">Без пробок</span><b style="font-size:13px;color:#16a34a">' + (freeMin ? fmtDuration(freeMin) : '—') + '</b></div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12px;color:var(--muted)">С пробками</span><b style="font-size:13px;color:#dc2626">' + (jamMin ? fmtDuration(jamMin) : '—') + '</b></div>';
      html += '<div style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.4">📏 по прямой × 1.4 (извилистость)<br>🚦 средняя Минск ~30 / ~22 км/ч</div>';
    } else {
      html += '<div style="font-size:12px;color:var(--muted);padding:14px 0;text-align:center">' + (selectedTask ? 'У объекта нет координат' : 'Выберите или создайте задачу') + '</div>';
    }
    html += '</div>';

    // Карточка «Итого»
    html += '<div class="card" style="padding:14px 16px;background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;border-radius:12px;box-shadow:0 4px 14px rgba(37,99,235,.25)">';
    html += '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;opacity:.85">📊 ИТОГО</div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-size:12.5px;opacity:.85">🔧 Работа</span><b style="font-size:14px">' + (workHours ? fmtH(workHours).replace(' ч','') + ' ч' : '—') + '</b></div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-size:12.5px;opacity:.85">🚗 Дорога (с пробками)</span><b style="font-size:14px">' + (jamMin ? fmtDuration(jamMin) : '—') + '</b></div>';
    html += '<div style="border-top:1px solid rgba(255,255,255,.2);margin:8px 0 6px"></div>';
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:12px;font-weight:700">⏱ Всё вместе</span><b style="font-size:20px;font-weight:900">' + (totalHours > 0 ? fmtH(totalHours).replace(' ч','') + ' ч' : '—') + '</b></div>';
    html += '<div style="font-size:11.5px;opacity:.75;margin-top:4px">' + (jamMin ? '(работа ' + workHours + ' ч + дорога ' + (jamMin/60).toFixed(2) + ' ч)' : 'для расчёта нужна работа + задача') + '</div>';
    html += '</div>';

    html += '</div>'; // /right column
    html += '</div>'; // /grid

    // Подсказка
    html += '<div class="card" style="margin-top:14px;padding:14px 18px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;font-size:12.5px;color:var(--txt);line-height:1.5">';
    html += '<div style="font-weight:800;color:var(--ink);margin-bottom:6px">Что дальше</div>';
    html += 'Когда задача выбрана — пришлите логику расчёта (параметры объекта ГРП/ШРП). Я встрою формулу прямо в этот экран — в реальном времени по мере изменения параметров. Вид работы уже хранится в самой задаче.';
    html += '</div>';

    html += '</div>';

    var viewEl = document.getElementById('view');
    if (viewEl) viewEl.innerHTML = html;
    else {
      var main = document.getElementById('main') || document.getElementById('screen');
      if (main) main.innerHTML = html;
      else document.body.innerHTML += html;
    }

    // Открытие полной формы задачи (как в планировании)
    var openFormBtn = document.getElementById('td-open-form');
    if (openFormBtn) openFormBtn.addEventListener('click', function () {
      try {
        if (typeof openTaskModal === 'function') {
          // Запоминаем, что мы на testdep — после закрытия модалки вернёмся сюда
          openTaskModal('new');
          // Когда модалка закроется — подхватим самую свежую задачу
          var overlayEl = document.getElementById('overlay');
          if (overlayEl) {
            var checkClose = setInterval(function () {
              if (!overlayEl.classList.contains('show')) {
                clearInterval(checkClose);
                // Подхватить последнюю задачу и перерисовать
                var tasks = (S.tasks || []).slice().sort(function (a, b) {
                  return (b.id || '').localeCompare(a.id || '');
                });
                var latest = tasks[0];
                if (latest) {
                  var d = load();
                  d.taskId = latest.id;
                  // Автозаполнение трудоёмкости из новой задачи
                  var _h = (typeof taskHours === 'function') ? taskHours(latest) : 0;
                  if (_h > 0) d.hours = +_h.toFixed(2);
                  save(d);
                  // Обновим экран testdep
                  renderTestDep();
                  toast('ok', '✓ Задача создана и подключена к тесту (' + (_h ? _h.toFixed(2) + ' ч' : 'без нормы') + ')');
                }
              }
            }, 300);
          }
        } else {
          toast('err', 'openTaskModal не найдена');
        }
      } catch (e) {
        console.error(e);
        toast('err', 'Ошибка открытия формы: ' + (e.message || ''));
      }
    });

    // Выбор существующей задачи из select
    var taskEl = document.getElementById('td-task');
    if (taskEl) taskEl.addEventListener('change', function () {
      var d = load();
      d.taskId = this.value || null;
      // Автозаполнение трудоёмкости из задачи (если поле пустое)
      if (d.taskId) {
        var _t = null;
        try {
          var _tasks = (window.SP_TASKS && SP_TASKS.getTasks) ? SP_TASKS.getTasks() : (S.tasks || []);
          _t = _tasks.find(function (x) { return x.id === d.taskId; }) || null;
        } catch (e) {}
        if (_t) {
          var _h = (typeof taskHours === 'function') ? taskHours(_t) : 0;
          if (_h > 0) d.hours = +_h.toFixed(2);
        }
      }
      save(d);
      renderTestDep();
    });

    // Отвязать задачу
    var clearTaskBtn = document.getElementById('td-clear-task');
    if (clearTaskBtn) clearTaskBtn.addEventListener('click', function () {
      var d = load();
      d.taskId = null;
      save(d);
      renderTestDep();
      toast('ok', 'Задача отвязана');
    });

    function readForm() {
      // workId больше не нужен в форме — берётся из выбранной задачи
      return {
        taskId: data.taskId || null,
        hours: parseFloat(document.getElementById('td-hours').value) || 0
      };
    }
    var saveBtn = document.getElementById('td-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var d = readForm();
      if (!d.hours || d.hours <= 0) { toast('warn', 'Укажите трудоёмкость > 0'); return; }
      save(d);
      toast('ok', '✓ Сохранено в localStorage (smartplan_test_dep)');
    });
    var clrBtn = document.getElementById('td-clear');
    if (clrBtn) clrBtn.addEventListener('click', function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      renderTestDep();
      toast('ok', 'Очищено');
    });
    var fromTaskBtn = document.getElementById('td-from-task');
    if (fromTaskBtn) fromTaskBtn.addEventListener('click', function () {
      // Берём трудоёмкость из выбранной задачи (taskHours считает сумму по всем работам × объём)
      var _t = null;
      if (data.taskId) {
        try {
          var _tasks = (window.SP_TASKS && SP_TASKS.getTasks) ? SP_TASKS.getTasks() : (S.tasks || []);
          _t = _tasks.find(function (x) { return x.id === data.taskId; }) || null;
        } catch (e) {}
      }
      if (!_t) { toast('warn', 'Сначала выберите задачу'); return; }
      var h = (typeof taskHours === 'function') ? taskHours(_t) : 0;
      if (!h || h <= 0) { toast('warn', 'У задачи не указан вид работ или норма = 0'); return; }
      var inp = document.getElementById('td-hours');
      inp.value = h.toFixed(2);
      toast('ok', 'Пересчитано из задачи: ' + h.toFixed(2) + ' ч');
    });
  }

  // === Запрос маршрута с геометрией для OSM-движков ===
  // Кэш геокодирования в localStorage — координаты сохраняются навсегда


  // Словарь сокращений минских адресов для Nominatim (OSM не понимает аббревиатуры)


  function updateTestDayCards(orderedTasks) {
    var pts = tState.pts;
    if (pts) {
      pts.length = 0;
      orderedTasks.forEach(function (p) { pts.push(p); });
      if (orderedTasks.returnTrip) pts.returnTrip = orderedTasks.returnTrip;
    }
    refreshTestCards(orderedTasks);
  }

  function refreshTestCards(pts) {
    var mlist = document.getElementById("t-mlist");
    if (!mlist) return;
    // Неактивные (выключенные кликом) задания остаются в списке серыми
    var inactive = (tState.inactivePts && tState.inactivePts.length) ? tState.inactivePts : [];
    if ((!pts || !pts.length) && !inactive.length) {
      mlist.innerHTML = "<div class='empty'>На этот день заданий нет</div>";
      return;
    }
    var html = "";
    if (pts && pts.length) {
      pts.forEach(function (p, i) {
        var fromLabel = (i === 0) ? "от базы до задания 1" : ("от задания " + i + " до задания " + (i + 1));
        var distStr = p.travelKmText ? "<b>" + p.travelKmText + "</b>" : (p.travelKm != null ? "<b>" + p.travelKm.toFixed(1).replace(".", ",") + " км</b>" : "");
        var timeStr = p.travelText ? "<b>" + p.travelText + "</b>" : (p.travelMin != null ? "<b>" + fmtDuration(p.travelMin) + "</b>" : "");
        var routeInfoStr = "";
        if (distStr && timeStr) {
          routeInfoStr = "🚗 " + fromLabel + ": " + distStr + " · время: " + timeStr;
        } else if (timeStr) {
          routeInfoStr = "🚗 " + fromLabel + " · время: " + timeStr;
        } else {
          routeInfoStr = "🚗 " + fromLabel + ": рассчитается при маршруте";
        }
        html += "<div class='mtask" + (TS.sel[p.id] ? " sel" : "") + "' data-mid='" + p.id + "' draggable='true'><div class='mtask-grip'>" + IC.grip + "</div>" +
          "<div class='pin' style='background:" + p.mcol + "'>" + (i + 1) + "</div>" +
          "<div style='flex:1;min-width:0'>" +
            "<div style='font-weight:700;color:var(--ink);font-size:12.5px;margin-bottom:3px'>📍 " + esc(p.addr) + "</div>" +
            "<div style='font-size:12.5px;color:var(--txt);margin-bottom:2px'>🔧 " + esc(p.work) + "</div>" +
            "<div style='font-size:12.5px;color:var(--muted);margin-bottom:2px'>⏱ Норма: <b>" + fmtH(p.norm) + " ч</b></div>" +
            "<div style='font-size:12.5px;color:var(--muted);margin-top:2px;'>" + routeInfoStr + "</div>" +
          "</div></div>";
      });
    }
    // ТЕСТ-фикс: карточка базы в конце списка сохраняется при перерисовке
    // (в оригинале refreshMapCards её затирал — и строка возврата на базу пропадала)
    var _baseCard = document.getElementById('t-base-card');
    var _baseHtml = _baseCard ? _baseCard.outerHTML : null;
    mlist.innerHTML = html + (_baseHtml || '');
    return;
    // Неактивные задания — серые, без номера и маршрута; клик включает обратно
    inactive.forEach(function (p) {
      html += "<div class='mtask' data-mid='" + p.id + "' draggable='true' style='opacity:.5;'>" +
        "<div class='mtask-grip' style='opacity:.5'>" + IC.grip + "</div>" +
        "<div class='pin' style='background:#94a3b8;color:#fff'>○</div>" +
        "<div style='flex:1;min-width:0'>" +
          "<div style='font-weight:700;color:var(--muted);font-size:12.5px;margin-bottom:3px'>📍 " + esc(p.addr) + "</div>" +
          "<div style='font-size:12.5px;color:var(--muted);margin-bottom:2px'>🔧 " + esc(p.work) + "</div>" +
          "<div style='font-size:12.5px;color:var(--muted);'>⏸ Не в маршруте — нажмите, чтобы включить</div>" +
        "</div></div>";
    });
    mlist.innerHTML = html;
  }

  // Извлечение данных об общем километраже и времени пути напрямую из элемента map-widget-content-view__frame / div[role="dialog"] Яндекс.Карт

  function setTestRouteInfo(info) {
    var el = document.getElementById("t-route-info"); if (!el) return;
    if (!info) {
      el.innerHTML = "нажмите «Оптимизировать маршрут» для расчета";
      el.style.color = "var(--muted)";
    } else if (info.building) {
      el.innerHTML = "⏳ идёт запрос к серверам...";
      el.style.color = "var(--blue)";
    } else if (info.error) {
      el.innerHTML = "⚠ маршрут не построен";
      el.style.color = "var(--red)";
    } else if (info.google) { // 22.09-175: движок «Google» — считает сам Google в новой вкладке
      el.innerHTML = "🌐 маршрут на " + (info.count || 0) + " точек открыт в Google — время и пробки покажет сам Google в новой вкладке";
      el.style.color = "#1a73e8";
    } else if (info.km != null) {
      /* ТЕСТ: данные маршрута — из нашего расчёта (OSRM Trip × калибровка + пробки).
         Если jamsMin === freeMin — это была «честная» Яндекс-калибровка без пробок;
         иначе уже учтены живые тайлы пробок (tJamsAdjust).
         В любом случае рядом показываем честную оценку с пробками по часу суток. */
      var kmStr = info.km.toFixed(1).replace(".", ",") + " км";
      var freeMin = info.freeMin || info.jamsMin || 0;
      var liveJamsMin = info.jamsMin;
      var jamK = jamFactorByHour(currentHourForJam());
      var estJamsMin = Math.max(1, Math.round(freeMin * jamK));
      var str = "";
      if (info.jamsMin && info.freeMin && info.jamsMin !== info.freeMin) {
        // Уже есть живые пробки — показываем их + нашу оценку для сравнения
        str = '<b style="color:var(--ink);font-size:13.5px;">' + kmStr + '</b> · общее время: '
          + '<b style="color:#dc2626;">' + fmtDuration(info.jamsMin) + ' (с пробками)</b> '
          + '<span style="color:var(--muted);font-weight:600;">/</span> '
          + '<b style="color:#16a34a;">' + fmtDuration(info.freeMin) + ' (без пробок)</b>'
          + (Math.abs(info.jamsMin - estJamsMin) > 5
             ? ' <span style="color:#94a3b8;font-size:12px;font-weight:600;" title="Оценка по часу суток ' + currentHourForJam() + ':00 — коэффициент ×' + jamK.toFixed(2) + '">· оценка Яндекс ~' + fmtDuration(estJamsMin) + '</span>'
             : '');
      } else if (info.jamsMin || info.freeMin) {
        // Пробок нет (роутер без OSRM Trip) — показываем честную калибровку
        str = '<b style="color:var(--ink);font-size:13.5px;">' + kmStr + '</b> · общее время: '
          + '<b style="color:#2563eb;">' + fmtDuration(freeMin) + ' (без пробок)</b>'
          + ' <span style="color:var(--muted);font-weight:600;">/</span> '
          + '<b style="color:#dc2626;" title="Оценка по часу суток ' + currentHourForJam() + ':00 (Минск, будни)">~' + fmtDuration(estJamsMin) + ' (с пробками)</b>'
          + ' <span style="color:#94a3b8;font-size:12px;font-weight:600;">· OSRM × 1.39, часовой ×' + jamK.toFixed(2) + '</span>';
      } else {
        str = '<b style="color:var(--ink);font-size:13.5px;">' + kmStr + '</b> (напрямую из карты)';
      }
      el.innerHTML = str;
      el.style.color = "var(--ink)";
    }
  }



  // ЯНДЕКС-КАРТА ТЕСТ-СТРАНИЦЫ: настоящая карта (тайлы Яндекса), маркеры базы
  // и объектов, линия маршрута. Все гео-объекты прозрачны для событий, без
  // балунов — паттерн анти-зависания.
  // 22.09-167: подложки тестовой карты - Яндекс (web_mercator-рендерер) и
  // спутник Google Earth. Карта создаётся в сферической проекции (та же сетка,
  // что у тайлов Google), поэтому и Яндекс-подложка рисуется официальным
  // рендерером тайлов с параметром projection=web_mercator - как на странице
  // карты объектов (omEnsureBasemapTypes).
  function tEnsureMapKindTypes() {
    if (!window.ymaps || !ymaps.mapType || !ymaps.mapType.storage) return;
    try {
      if (!ymaps.mapType.storage.get('sp#yandex')) {
        var yaFactory = function () {
          var layer = new ymaps.Layer('https://core-renderer-tiles.maps.yandex.net/tiles?l=map&lang=ru_RU&projection=web_mercator&x=%x&y=%y&z=%z&scale=1', { tileTransparent: false });
          layer.getZoomRange = function () { return Promise.resolve([0, 21]); };
          return layer;
        };
        ymaps.mapType.storage.add('sp#yandex', new ymaps.MapType('Яндекс', [yaFactory]));
      }
    } catch (e) { console.error('Яндекс-подложка (тест-карта):', e); }
    try {
      if (!ymaps.mapType.storage.get('sp#gsat')) {
        var gsFactory = function () {
          var layer = new ymaps.Layer('https://mt1.google.com/vt/lyrs=s&x=%x&y=%y&z=%z', { tileTransparent: false });
          layer.getZoomRange = function () { return Promise.resolve([0, 20]); };
          return layer;
        };
        ymaps.mapType.storage.add('sp#gsat', new ymaps.MapType('Google спутник', [gsFactory]));
      }
      if (!ymaps.mapType.storage.get('sp#ghyb')) {
        var ghFactory = function () {
          var layer = new ymaps.Layer('https://mt1.google.com/vt/lyrs=y&x=%x&y=%y&z=%z', { tileTransparent: false });
          layer.getZoomRange = function () { return Promise.resolve([0, 20]); };
          return layer;
        };
        ymaps.mapType.storage.add('sp#ghyb', new ymaps.MapType('Google спутник + названия', [ghFactory]));
      }
    } catch (e) { console.error('Google Earth-подложка (тест-карта):', e); }
  }
  function tMapKindTypeKey() {
    return TS.mapKind === 'gsat' ? 'sp#gsat' : (TS.mapKind === 'ghyb' ? 'sp#ghyb' : 'sp#yandex');
  }
  function tIsG3D() { return TS.mapKind === 'g3d'; } // 22.09-173: режим «Google Earth 3D» (объёмные дома, MapLibre)
  function tApplyMapKind() {
    try {
      if (tIsG3D()) return; // в 3D-режиме Яндекс-карты нет
      var map = tState.ymap;
      if (!map || !tState._mkOk) return;
      tEnsureMapKindTypes();
      map.setType(tMapKindTypeKey());
    } catch (e) { console.error('Подложка тест-карты не переключилась:', e); }
  }

