  /* ── часть 04 · app/04_route_map.js — карта маршрутов: Яндекс.Карты, оптимизация маршрутов, картографические сервисы ── */
  /* =====================================================================
     РЕНДЕР: КАРТА МАРШРУТОВ
     ===================================================================== */
  var ymState = { token: 0, loaded: false, loading: false, waiting: [], ymap: null, pts: [], route: null, manualOrder: false, leafletMap: null, leafletRouteLayer: null, leafletArrows: [], leafletMarkers: [], roadClosures: [], closureLayers: [], manualClosures: [], drawingClosure: false, drawPoints: [] };
  function renderMap() {
    try {
      var off = S.mapOff;
      var masters = visibleMasters() || [];
    if (!S.mapMaster) S.mapMaster = 'all';
    if (S.role === 'master' && S.user) S.mapMaster = S.user.id;
    if (S.mapMaster !== 'all') {
      var foundM = false;
      for (var i = 0; i < masters.length; i++) if (masters[i].id === S.mapMaster) { foundM = true; break; }
      if (!foundM) S.mapMaster = 'all';
    }

    var list = visibleTasks().filter(function (t) {
      if (t.d !== off || isDone(t)) return false;
      if (S.mapMaster && S.mapMaster !== 'all') return t.m === S.mapMaster;
      return true;
    }).sort(dayTaskSort); // 22.09-197: задания на день — в сохранённом после оптимизации порядке
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

    var prov = (S.mapProvider = 'brouter-car-eco'); // 22.09-179: роутер один — BRouter car (economic)
    var provSelHTML = '<div style="display:flex;align-items:center;gap:6px;margin-left:auto;">' +
      '<span style="font-size:12px;color:var(--ink);font-weight:700;">Роутер:</span>' +
      '<span title="Маршрут строит BRouter — профиль car-eco (экономичный автомобильный). Единственный роутер с 22.09-179" style="padding:5px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--card);color:var(--ink);font-weight:700;">🚗 BRouter car (economic)</span>' +
      '<button class="btn sm" id="btn-traffic-main" title="Слой Яндекс.Пробок: цвета загруженности и события (аварии, ремонт) на карте" style="background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;border-color:#16a34a;font-weight:700">🚦 Пробки</button>' +
    '</div>';

    var html = '<div class="cal-head"><div class="seg">' +
      '<button class="' + (off === -1 ? 'on' : '') + '" data-action="map-off" data-off="-1">Вчера</button>' +
      '<button class="' + (off === 0 ? 'on' : '') + '" data-action="map-off" data-off="0">Сегодня</button>' +
      '<button class="' + (off === 1 ? 'on' : '') + '" data-action="map-off" data-off="1">Завтра</button></div>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:12.5px;color:var(--muted);font-weight:600;">Выбрать дату:</span>' +
        '<input type="date" id="map-date-sel" value="' + key(offToDate(off)) + '" style="padding:5px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit;background:var(--card);color:var(--ink);font-weight:600;cursor:pointer;" title="Выбрать любую дату для просмотра маршрута">' +
      '</div>' +
      '' +  // Кнопки «🚧 Закрытие» и «🗑 Удалить выбранное» удалены — функционал закрытий убран
      (S.role === 'viewer' ? '<span style="font-size:12px;color:var(--muted);font-weight:600;">👁 Режим просмотра</span>' : '<button class="btn primary" id="btn-build-route" data-action="build-route" disabled style="opacity:.5;cursor:not-allowed;">' + IC.route + ' Оптимизация маршрутов</button>') +
      '<div class="spacer"></div>' +
      provSelHTML +
      '</div>';

    var masterSelHTML = '<select id="map-master-sel" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card);color:var(--ink);font-weight:600;width:100%;max-width:none;margin-top:8px;">';
    if (masters.length > 1) {
      masterSelHTML += '<option value="all"' + (S.mapMaster === 'all' ? ' selected' : '') + '>Все мастера (' + masters.length + ')</option>';
    }
    masters.forEach(function (m) {
      masterSelHTML += '<option value="' + m.id + '"' + (S.mapMaster === m.id ? ' selected' : '') + '>' + esc(m.name) + ' (' + esc(m.area) + ')</option>';
    });
    masterSelHTML += '</select>';

    var curD = offToDate(off);
    var shortDateStr = curD.getDate() + ' ' + MON[curD.getMonth()].slice(0, 3) + '. ' + String(curD.getFullYear()).slice(-2);
    html += '<div class="map-wrap"><div><div class="card"><div class="card-h" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center"><div style="display:flex;align-items:baseline;justify-content:center;gap:8px;width:100%"><span style="font-size:13px;font-weight:700;color:var(--ink);">Задания на</span><span style="font-size:12px;font-weight:700;color:var(--blue);">' + shortDateStr + '</span></div><div style="width:100%">' + masterSelHTML + '</div></div><div class="card-b mlist" id="mlist">';
    if (!pts.length) html += '<div class="empty">На этот день заданий нет</div>';
    pts.forEach(function (p, i) {
      html += '<div class="mtask sel" data-mid="' + p.id + '" draggable="true"><div class="mtask-grip">' + IC.grip + '</div><div class="pin" style="background:' + p.mcol + '">' + (i + 1) + '</div><div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--ink);font-size:12.5px;margin-bottom:3px">📍 ' + esc(p.addr) + '</div><div style="font-size:12.5px;color:var(--txt);margin-bottom:2px">🔧 ' + esc(p.work) + '</div><div style="font-size:12.5px;color:var(--muted);">⏱ Норма времени: <b>' + fmtH(p.norm) + ' ч</b></div></div></div>';
    });
    // 22.09-179: карточка 🏁 базы в конце списка — через общий генератор mapBaseCardHtml()
    // (ГЛАВНЫЙ ФИКС БАГА: refreshMapCards пересобирала список БЕЗ этой карточки,
    //  поэтому она «мигала» при отрисовке и пропадала — теперь вставляется всегда)
    html += mapBaseCardHtml();
    html += '</div></div></div>';

    html += '<div><div class="map-box" id="mapbox"><div class="map-stats" id="map-stats" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><span>Объектов: <b>' + pts.length + '</b></span><span style="display:flex;align-items:center;gap:6px;border-left:1px solid var(--line);padding-left:12px;margin-left:4px;"><span style="color:var(--txt);font-weight:600;">Общее время и километраж:</span> <span id="route-info" style="color:var(--muted);font-weight:700;">нажмите «Оптимизировать маршрут» для расчета</span></span><span style="margin-left:auto;color:var(--muted)">🚩 ' + esc(currentBase().name) + '</span><button class="btn sm" id="btn-open-route-yandex" data-action="open-route-yandex" title="Открыть маршрут в Яндекс.Картах (новая вкладка): с базы → все включённые задания списка в их текущем порядке → обратно на базу" style="background:#fc3f1d;border-color:#fc3f1d;color:#fff;font-weight:700;white-space:nowrap">↗ Открыть в Яндекс карте</button></div><div id="map-canvas" style="width:100%;height:calc(100vh - 210px);min-height:400px"></div></div></div></div>';

    view.innerHTML = html;
    rmFitLayout(); // 22.09-256: список и карта — до низа окна (карта создаётся уже под этот размер)
    S.mapSel = {}; pts.forEach(function (p) { S.mapSel[p.id] = true; });
    if (ymState.returnTrip) pts.returnTrip = ymState.returnTrip;
    ymState.manualOrder = false;
    refreshMapCards(pts);

    var dtSel = document.getElementById('map-date-sel');
    if (dtSel) dtSel.addEventListener('change', function(e) {
      if (e.target.value) {
        var picked = new Date(e.target.value + 'T00:00:00');
        if (!isNaN(picked.getTime())) {
          S.mapOff = dateToOff(picked);
          renderMap();
        }
      }
    });

    // 22.09-179: выбор роутера и настройки ⚙ удалены — роутер фиксирован: «🚗 BRouter car (economic)»

    var mlist = document.getElementById('mlist');

    // Клик — вкл/выкл задания
    mlist.addEventListener('click', function (e) {
      var el = e.target.closest('.mtask'); if (!el) return;
      var id = el.dataset.mid;
      if (!id) return; // карточка базы (нет data-mid) — не обрабатываем
      S.mapSel[id] = !S.mapSel[id];
      el.classList.toggle('sel', S.mapSel[id]);
    drawMap(pts);
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
      if (!card || !card.dataset.mid || card.dataset.mid === mapDragId) return; // 22.09-179: на карточку базы не сбрасываем
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      mlist.querySelectorAll('.mtask.drop-above').forEach(function (c) { c.classList.remove('drop-above'); });
      card.classList.add('drop-above');
    });
    mlist.addEventListener('drop', function (e) {
      if (!mapDragId) return;
      var card = e.target.closest('.mtask');
      if (!card || !card.dataset.mid || card.dataset.mid === mapDragId) return; // 22.09-179: на карточку базы не сбрасываем
      e.preventDefault();
      e.stopPropagation();
      reorderMapCard(mapDragId, card.dataset.mid);
    });

// Привязка кнопок ручной разметки закрытых дорог удалена — функционал закрытий убран
    drawMap(pts);
    var mSel = document.getElementById('map-master-sel');
    if (mSel) mSel.addEventListener('change', function (e) { S.mapMaster = e.target.value; renderMap(); });
    // 🚦 Пробки: переключаем слой Яндекс.Пробок на основной карте маршрутов
    // 22.09-127: «🚦 Пробки» переключает слой Яндекс.Пробок на подложке Яндекс.Карты
    var trafBtn = document.getElementById('btn-traffic-main');
    if (trafBtn && !trafBtn.__wired) {
      trafBtn.__wired = true;
      // Сохраняем в S и восстанавливаем при загрузке
      try {
        var _savedTr = localStorage.getItem('smartplan_map_traffic');
        if (_savedTr === '1') S.mapTraffic = true;
      } catch (e) {}
      ymSyncTrafficBtn();
      trafBtn.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        S.mapTraffic = !S.mapTraffic;
        try { localStorage.setItem('smartplan_map_traffic', S.mapTraffic ? '1' : '0'); } catch (er) {}
        ymSetRoutesTraffic(S.mapTraffic);
        ymSyncTrafficBtn();
        try { toast('ok', S.mapTraffic ? '🚦 Слой пробок включён (Яндекс.Карта)' : '🚦 Слой пробок выключен'); } catch (er) {}
      };
    }
    } catch (err) {
      console.error('renderMap error:', err);
      var viewEl = document.getElementById('view');
      if (viewEl) viewEl.innerHTML = '<div class="card"><div class="card-b" style="color:var(--red);padding:20px;font-weight:600;">Ошибка отображения Карты маршрутов: ' + esc(err.message) + '</div></div>';
    }
  }
  /* ====== УТИЛИТЫ КАРТЫ ====== */
  function ensureYandex(then, fail) {
    if (ymState.loaded && window.ymaps) { window.ymaps.ready(function () { then(); }); return; }
    if (ymState.loading) { ymState.waiting.push({ then: then, fail: fail }); return; }
    ymState.loading = true; ymState.waiting = [{ then: then, fail: fail }];
    var s = document.createElement('script');
    s.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
    s.onload = function () {
      if (window.ymaps) window.ymaps.ready(function () {
        ymState.loaded = true; ymState.loading = false;
        ymState.waiting.forEach(function (w) { w.then(); }); ymState.waiting = [];
      });
    };
    s.onerror = function () { ymState.loading = false; ymState.waiting.forEach(function (w) { w.fail(); }); ymState.waiting = []; };
    document.head.appendChild(s);
    setTimeout(function () { if (!ymState.loaded) { ymState.waiting.forEach(function (w) { w.fail(); }); ymState.waiting = []; } }, 10000);
  }
  function geocodeAddr(addr) {
    return new Promise(function (resolve) {
      if (!window.ymaps || !window.ymaps.geocode) { resolve(null); return; }
      var q = addr.indexOf('Минск') !== -1 ? addr : 'Минск, ' + addr;
      window.ymaps.geocode(q, { results: 1 }).then(function (res) {
        var g = res.geoObjects.get(0); resolve(g ? g.geometry.getCoordinates() : null);
      }, function () { resolve(null); });
    });
  }
  // Обратное геокодирование: координаты → адрес («клик по любой точке карты»
  // в выборе объекта). Сначала точность до дома, затем без kind; всё в try/catch,
  // при любой ошибке/таймауте — null (облачко предложит сохранить точку как есть)
  function reverseGeocodeAddr(lat, lng) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      if (!window.ymaps || !window.ymaps.geocode) { finish(null); return; }
      function extractName(res) {
        try {
          var g = (res && res.geoObjects) ? res.geoObjects.get(0) : null;
          if (!g || !g.properties) return null;
          return g.properties.get('name') || g.properties.get('text') || null;
        } catch (e) { return null; }
      }
      try {
        window.ymaps.geocode([lat, lng], { results: 1, kind: 'house' }).then(function (res) {
          var n = extractName(res);
          if (n) { finish(n); return; }
          window.ymaps.geocode([lat, lng], { results: 1 }).then(function (res2) { finish(extractName(res2)); }, function () { finish(null); });
        }, function () { finish(null); });
      } catch (e) { finish(null); }
      setTimeout(function () { finish(null); }, 6000); // защита от зависания геокодера
    });
  }

  // ===== Ленивая загрузка SheetJS (xlsx.full.min.js, ~880 КБ) =====
  // Библиотека нужна только для Excel-импорта/экспорта — грузим при первом
  // обращении (кнопка/файл), а не при каждом входе в систему.
  var xlsxState = { loading: null };
  function ensureXlsx() {
    if (window.XLSX) return Promise.resolve(true);
    if (!xlsxState.loading) {
      xlsxState.loading = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = 'root_index/xlsx.full.min.js';
        s.onload = function () { resolve(!!window.XLSX); };
        s.onerror = function () { xlsxState.loading = null; resolve(false); };
        document.head.appendChild(s);
      });
      toast('ok', '⏳ Загружаю библиотеку Excel…');
    }
    return xlsxState.loading;
  }
  // Обёртка для обработчиков Excel: библиотеки нет → загрузить и повторить действие
  function ensureXlsxRetry(fn) {
    ensureXlsx().then(function (ok) {
      if (ok) { try { fn(); } catch (e) { console.error(e); toast('err', 'Ошибка обработки Excel'); } }
      else toast('err', 'Библиотека Excel не загрузилась — проверьте интернет');
    });
  }
  // ===== Стилевой форк SheetJS (xlsx-js-style, файл xlsx.style.js) =====
  // Умеет красить шрифт/заливку/границы ячеек — нужен ТОЛЬКО для выгрузки
  // графика работ с ЦВЕТНЫМИ треугольниками. Держим его отдельно в
  // window.XLSX_STYLE: обычный window.XLSX (справочники, объекты, база)
  // не подменяется, чтобы остальные экспорты вели себя как раньше.
  var xlsxStyleState = { loading: null };
  function ensureXlsxStyle() {
    if (window.XLSX_STYLE) return Promise.resolve(true);
    if (!xlsxStyleState.loading) {
      xlsxStyleState.loading = new Promise(function (resolve) {
        var prev = window.XLSX || null; // не дать затереть уже загруженную основную библиотеку
        var s = document.createElement('script');
        s.src = 'root_index/xlsx.style.js';
        s.onload = function () {
          window.XLSX_STYLE = window.XLSX || null;
          if (prev) window.XLSX = prev;
          else { try { delete window.XLSX; } catch (e) { window.XLSX = undefined; } }
          resolve(!!window.XLSX_STYLE);
        };
        s.onerror = function () { xlsxStyleState.loading = null; resolve(false); };
        document.head.appendChild(s);
      });
      toast('ok', '⏳ Загружаю библиотеку Excel с цветами…');
    }
    return xlsxStyleState.loading;
  }
  /* =====================================================================
     МОДУЛЬ ЯНДЕКС.КАРТ И ОПТИМИЗАЦИИ МАРШРУТОВ 
     ===================================================================== */

  function fmtDuration(min) {
    min = Math.max(1, Math.round(min || 0));
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h > 0 && m > 0) return h + ' ч ' + m + ' мин';
    if (h > 0 && m === 0) return h + ' ч';
    return m + ' мин';
  }

  // 1. Построение ссылки для встраивания виджета Яндекс.Карт по текстовым адресам / координатам
  // Путевая точка для провайдеров: КООРДИНАТЫ ГЛАВНЕЕ адреса —
  // точка встанет ровно по координатам справочника ГРП/ШРП, а не по догадке геокодера
  function routeWpText(item) {
    return (item && item.lat != null && item.lng != null) ? item.lat + ',' + item.lng : null;
  }

  function buildYandexDirUrl(items, noJam) {
    if (!items || !items.length) return 'https://yandex.ru/maps/';
    var parts = [];
    items.forEach(function (item) {
      var wp = routeWpText(item);
      if (wp) { parts.push(wp); return; } // координаты объекта — приоритет
      var a = item.addr || item.name || '';
      if (a && a !== '?') {
        a = a.trim();
        if (a.indexOf('Минск') === -1) a = 'Минск, ' + a;
        parts.push(a);
      }
    });
    var url = 'https://yandex.ru/maps/?rtext=' + parts.join('~') + '&rtt=auto';
    // Включаем слой трафика для просмотра закрытых участков
    url += '&l=map';
    return url;
  }

  /* 22.09-177: кнопка «↗ Открыть в Яндекс карте» (карта маршрутов) — открывает полные
     Яндекс.Карты в новой вкладке: с базы → включённые задания в порядке списка слева
     (как видит диспетчер, с учётом ручного перетаскивания и оптимизации) → обратно на базу. */
  function openMapRouteInYandex() {
    var base = currentBase();
    var all = (ymState && (ymState.allPts || ymState.pts)) || [];
    if (!all.length) { toast('warn', 'Список заданий пуст — нечего открывать'); return; }
    var byId = {}; all.forEach(function (p) { byId[p.id] = p; });
    var order = [];
    try {
      var cards = document.querySelectorAll('#mlist .mtask[data-mid]');
      for (var i = 0; i < cards.length; i++) { var p0 = byId[cards[i].dataset.mid]; if (p0) order.push(p0); }
    } catch (e) {}
    if (!order.length) order = all.slice();
    var sel = order.filter(function (p) { return S.mapSel[p.id]; });
    if (!sel.length) { toast('warn', 'Все задания выключены — включите хотя бы одно задание в списке'); return; }
    var items = [base].concat(sel).concat([base]);
    var url = buildYandexDirUrl(items, false);
    try { logAction('Карта маршрутов: маршрут открыт в Яндекс.Картах (база → ' + sel.length + ' точек → база)'); } catch (e) {}
    window.open(url, '_blank', 'noopener');
    toast('ok', '↗ Открываю Яндекс.Карты: база → ' + sel.length + ' точек → база');
  }

  // 2. Отображение начальной карты при заходе на страницу (БЕЗ изменения порядка заданий!)
  /* 22.09-180: первичная статистика маршрута дня (ДО кнопки «Оптимизация») —
     тем же единым роутером BRouter car (economic), порядок — как в списке заданий;
     время в карточках заданий и в шапке — С ПРОБКАМИ (как после «Оптимизации»).
     Задания без координат в расчёт не попадают. Повторный вызов с тем же набором
     точек запроса не делает (подпись). */
  function mapPrimaryRouteStats(sel, base) {
    if (!sel || !sel.length) return;
    var geoSel = sel.filter(function (p) { return p.lat != null && p.lng != null; });
    if (!geoSel.length) return;
    var sig = geoSel.map(function (p) { return p.id + ':' + (+p.lat).toFixed(5) + ',' + (+p.lng).toFixed(5); }).join('|');
    if (ymState.statsSig === sig) return; // уже считали для этих точек
    brouterCarDayRoute(geoSel, base, function(result) {
      if (!result || !result.ok || !result.geometry || !result.geometry.length) return;
      if (ymState.pts !== sel) return; // день/список уже сменился — устаревший ответ игнорируем
      ymState.statsSig = sig;
      setRouteInfo({ km: result.km, jamsMin: result.jamMin, freeMin: result.min, count: sel.length });
      geoSel.forEach(function (p, idx) {
        if (idx < result.legs.length) {
          var leg = result.legs[idx];
          var legKm = (leg.distance || 0) / 1000;
          p.travelKm = legKm; p.travelKmText = legKm.toFixed(1).replace('.', ',') + ' км';
          p.travelMin = Math.max(1, Math.round((leg.duration || 0) / 60)); p.travelText = fmtDuration(p.travelMin);
        }
      });
      refreshMapCards(sel);
    });
  }

  function drawMap(pts) {
    // Храним ВСЕ задания (вкл и выкл)
    ymState.allPts = pts;
    // Активные — для маршрута
    var sel = pts.filter(function (p) { return S.mapSel[p.id]; });
    // Неактивные — остаются на карте (серые)
    var inactive = pts.filter(function (p) { return !S.mapSel[p.id]; });
    ymState.inactivePts = inactive;
    var canvas = document.getElementById("map-canvas");
    if (!canvas) return;
    if (pts.returnTrip) sel.returnTrip = pts.returnTrip;
    ymState.pts = sel;
    setRouteInfo(null);

    var base = currentBase();
    var prov = S.mapProvider || "osrm";

    // 22.09-127: подложка — ВСЕГДА Яндекс.Карта; конопка оптимизации активна сразу
    var brBtn = document.getElementById('btn-build-route');
    if (brBtn) { brBtn.disabled = false; brBtn.style.opacity = ''; brBtn.style.cursor = ''; }

    if (sel.length >= 1) {
      ymState.statsSig = null; // 22.09-180: новый набор точек — статистику считать заново
      // Яндекс.Карта + оверлей-маркеры; недостающие координаты доопределяет Яндекс
      ymRoutesMapEnsure(canvas, function () {
        geocodePointsViaYandex(sel.concat(inactive || [])).then(function () {
          if (!ymState.ymap) return;
          ymDrawRouteMarkers(sel);
          // 22.09-180: адреса доопределены — пересчитать статистику со ВСЕМИ точками
          mapPrimaryRouteStats(sel, base);
        });
      });
      // 22.09-180: первичная статистика маршрута (не ждём геокодер — по точкам с координатами)
      mapPrimaryRouteStats(sel, base);
    } else {
      // Только база — тоже на карте Яндекс
      ymRoutesMapEnsure(canvas, function () { ymDrawRouteMarkers([]); });
    }

  }

  /* 22.09-256: «Карта маршрутов» — список заданий и карта по высоте ровно до низа окна при любом
     экране и масштабе. Раньше высоты были заданы «на глаз» (calc(100vh − 210/260px)): на одних
     экранах блоки не доставали до низа, на других (где строка кнопок или строка «Объектов…» в две
     строки) уходили за край; а карта, созданная при одном размере окна, после изменения размера
     не заполняла свой блок. Теперь высота считается от фактического места на странице, карта
     подгоняется под блок. В одну колонку (телефон/планшет) — как раньше. */
  function rmFitLayout() {
    try { rmFitLayoutRun(); } catch (e) { /* подгонка высоты не может ломать страницу */ }
  }
  function rmFitLayoutRun() {
    if (S.screen !== 'map' || typeof window.getComputedStyle !== 'function') return;
    var v = document.getElementById('view');
    var wrap = v && v.querySelector('.map-wrap');
    if (!wrap) return;
    var cols = String(window.getComputedStyle(wrap).gridTemplateColumns || '').trim().split(/\s+/).filter(Boolean).length;
    if (cols < 2) { wrap.classList.remove('rm-fit'); wrap.style.height = ''; v.style.paddingBottom = ''; ymFitMap(); return; }
    v.style.paddingBottom = '12px'; // снизу — небольшой отступ, блоки почти до края окна (на других страницах — как было)
    // где начинается блок внутри страницы — по раскладке (offsetTop), а не по экрану: в момент
    // отрисовки идёт анимация появления (сдвиг вниз), и экранные координаты занижали высоту
    function absTop(el) { var y = 0; while (el) { y += el.offsetTop || 0; el = el.offsetParent; } return y; }
    var topIn = absTop(wrap) - absTop(v);
    var pb = parseFloat(window.getComputedStyle(v).paddingBottom) || 0; // нижний отступ страницы
    var h = Math.floor(v.clientHeight - topIn - pb);
    wrap.classList.add('rm-fit');
    wrap.style.height = Math.max(420, h) + 'px';                     // очень низкое окно — не меньше 420 px (тогда прокрутка)
    ymFitMap();
  }
  function ymFitMap() {
    try { if (ymState.ymap && ymState.ymap.container && ymState.ymap.container.fitToViewport) ymState.ymap.container.fitToViewport(); } catch (e) {}
  }
  (function () {
    var raf = 0;
    try {
      window.addEventListener('resize', function () {
        if (S.screen !== 'map') return;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { raf = 0; rmFitLayout(); });
      });
    } catch (e) {}
  })();

  // 3. Главная функция оптимизации при клике на кнопку «Оптимизация маршрутов» (для всех 4 карт: Яндекс, Google, OSM, 2ГИС)
  // === Загрузка Leaflet ===
  // 22.09-182: Leaflet-подложка и её загрузчик удалены (вызовов не осталось)
  function ymRoutesMapEnsure(canvas, done) {
    ensureYandex(function () {
      if (!document.getElementById('map-canvas')) return; // страницу уже сменили
      try {
        // контейнер оторвался от DOM (переход по страницам) — карту пересоздаём
        if (ymState.ymap) {
          var ce = null;
          try { ce = ymState.ymap.container.getElement(); } catch (e) {}
          if (!ce || !document.body.contains(ce)) {
            try { ymState.ymap.destroy(); } catch (e2) {}
            ymState.ymap = null; ymState.route = null; ymState.ymMarkers = null;
          }
        }
        if (!ymState.ymap) {
          canvas.style.position = 'relative';
          canvas.innerHTML = '';
          var mapDiv = document.createElement('div');
          mapDiv.style.cssText = 'position:absolute;inset:0';
          canvas.appendChild(mapDiv);
          // подложка всегда Яндекс (стандартная схема)
          // 22.09-256: autoFitToViewport — карта всегда по размеру своего блока (окно развернули/свернули, меню, масштаб)
          ymState.ymap = new ymaps.Map(mapDiv, { center: [53.9023, 27.5619], zoom: 11, controls: ['zoomControl'] }, { suppressMapOpenBlock: true, autoFitToViewport: 'always' });
          // слой Яндекс.Пробок (включается кнопкой «🚦 Пробки»)
          try {
            ymState.traffic = new ymaps.traffic.provider.Actual({}, { infoLayerShown: true });
            if (S.mapTraffic) ymState.traffic.setMap(ymState.ymap);
          } catch (eTr) { ymState.traffic = null; }
        }
        ymSyncTrafficBtn();
        if (done) done(ymState.ymap);
      } catch (e) { /* карта не может ломать страницу */ }
    }, function () {
      canvas.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red);font-weight:700">Карта недоступна — проверьте интернет</div>';
    });
  }
  function ymSetRoutesTraffic(on) {
    try {
      if (!ymState.ymap) return;
      if (!ymState.traffic) ymState.traffic = new ymaps.traffic.provider.Actual({}, { infoLayerShown: true });
      ymState.traffic.setMap(on ? ymState.ymap : null);
    } catch (e) {}
  }
  function ymSyncTrafficBtn() {
    var b = document.getElementById('btn-traffic-main');
    if (!b) return;
    b.style.background = S.mapTraffic ? 'linear-gradient(135deg,#0f7d36,#16a34a)' : 'linear-gradient(135deg,#16a34a,#22c55e)';
  }
  /* Точки маршрута — нумерованные кружки ПОВЕРХ подложки Яндекса: база «Б»,
     активные с номерами в цвет мастера, выключенные — серые. ordered —
     порядок объезда (после оптимизации номера переназначаются). */
  function ymDrawRouteMarkers(ordered) {
    var map = ymState.ymap;
    if (!map) return;
    (ymState.ymMarkers || []).forEach(function (m) { try { map.geoObjects.remove(m); } catch (e) {} });
    ymState.ymMarkers = [];
    var base = currentBase();
    var colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed', '#0891b2', '#db2777'];
    function addDot(lat, lng, label, bg, size, hint) {
      try {
        var pm = new ymaps.Placemark([+lat, +lng], { hintContent: hint || '' }, {
          iconLayout: 'default#image',
          iconImageHref: lmSvgIcon(label, bg, size || 30),
          iconImageSize: [size || 30, size || 30], iconImageOffset: [-((size || 30) / 2), -((size || 30) / 2)],
          hasBalloon: false, hasHint: !!hint
        });
        map.geoObjects.add(pm);
        ymState.ymMarkers.push(pm);
      } catch (e) {}
    }
    if (base && base.lat != null && base.lng != null) addDot(base.lat, base.lng, 'Б', '#0f2740', 30, 'База — ' + (base.name || ''));
    (ordered || []).forEach(function (p, i) {
      if (p.lat == null || p.lng == null) return;
      addDot(p.lat, p.lng, String(i + 1), p.mcol || colors[i % colors.length], 30, (p.addr || '?') + (p.work ? ' · ' + p.work : ''));
    });
    (ymState.inactivePts || []).forEach(function (p) {
      if (p.lat == null || p.lng == null) return;
      addDot(p.lat, p.lng, '○', '#94a3b8', 22, (p.addr || '') + ' (выключено)');
    });
    try {
      if (ymState.ymMarkers.length) {
        var coll = new ymaps.GeoObjectCollection(ymState.ymMarkers);
        map.setBounds(coll.getBounds(), { checkZoomRange: true, zoomMargin: 44 });
      }
    } catch (e) {}
  }
  /* Линия маршрута поверх подложки Яндекса. latlngs — [ [lat,lng], … ];
     dashed=true — приблизительный вариант (роутер не ответил), пунктир. */
  function ymDrawRouteLine(latlngs, dashed) {
    var map = ymState.ymap;
    if (!map || !latlngs || latlngs.length < 2) return;
    try {
      if (ymState.route) { try { map.geoObjects.remove(ymState.route); } catch (e) {} ymState.route = null; }
      var line = new ymaps.Polyline(latlngs, {}, {
        strokeColor: dashed ? '#94a3b8' : '#2563eb',
        strokeWidth: dashed ? 4 : 5,
        strokeOpacity: dashed ? 0.75 : 0.9,
        strokeStyle: dashed ? 'dash' : 'solid',
        hasBalloon: false, hasHint: false,
        interactivityModel: 'default#transparent'
      });
      map.geoObjects.add(line);
      ymState.route = line;
      try { map.setBounds(line.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 40 }); } catch (eb) {}
    } catch (e) {}
  }
  /* Прямая ломаная «база → точки → база» — когда роутер недоступен */
  function ymDrawFallbackLine(items) {
    var pts = [];
    (items || []).forEach(function (p) { if (p && p.lat != null && p.lng != null) pts.push([p.lat, p.lng]); });
    if (pts.length >= 2) { ymDrawRouteLine(pts, true); return; }
    try {
      if (ymState.ymap && ymState.route) { ymState.ymap.geoObjects.remove(ymState.route); }
    } catch (e) {}
    ymState.route = null;
  }

  function getGeocodeStore() {
    try { var raw = localStorage.getItem('smartplan_geocode'); if (raw) return JSON.parse(raw); } catch(e) {}
    return {};
  }
  function getTaskCoords(addr) {
    if (!addr) return null;
    var store = getGeocodeStore();
    return store[addr] || null;
  }
  function saveTaskCoords(addr, lat, lng) {
    if (!addr) return;
    var store = getGeocodeStore();
    store[addr] = { lat: lat, lng: lng };
    try { localStorage.setItem('smartplan_geocode', JSON.stringify(store)); } catch(e) {}
  }

  // === Хранилище времени маршрута (привязка мастер + день) ===
  // Заполняется при оптимизации маршрута на OpenStreetMap, отображается в календаре планирования.
  var ROUTE_TIME_KEY = 'smartplan_route_time';
  // Кэш фоновых расчётов маршрутов (для календаря): { 'masterId_off': {minutes, km, status} }
  var autoRouteCache = {};
  var autoRouteQueue = [];
  var autoRouteRunning = false;

  // Фоновый расчёт маршрута для мастера+дня (без UI, тихо)
  function autoCalcRoute(masterId, off, tasks) {
    var cacheKey = masterId + '_' + off;
    if (autoRouteCache[cacheKey]) return;
    if (!tasks || tasks.length === 0) return;
    autoRouteCache[cacheKey] = { status: 'loading' };
    autoRouteQueue.push({ masterId: masterId, off: off, tasks: tasks });
    processAutoRouteQueue();
  }

  // Сброс кэша фонового маршрута для ячейки — чтобы пересчитался после изменения задач
  function invalidateRouteCache(masterId, off) {
    if (!masterId || off == null) return;
    var key = masterId + '_' + off;
    delete autoRouteCache[key];
    // Чистим и сохранённые данные, иначе ячейка покажет устаревшие цифры до пересчёта
    var store = getRouteTimeStore();
    if (store[key]) {
      delete store[key];
      try { localStorage.setItem(ROUTE_TIME_KEY, JSON.stringify(store)); } catch(e) {}
    }
  }

  function processAutoRouteQueue() {
    if (autoRouteRunning || autoRouteQueue.length === 0) return;
    autoRouteRunning = true;
    var job = autoRouteQueue.shift();
    var cacheKey = job.masterId + '_' + job.off;
    var base = currentBase();
    // Берём только задачи с координатами: задача -> объект -> кэш геокодирования
    var routeTasks = [];
    job.tasks.forEach(function(t) {
      var lat = t.lat, lng = t.lng;
      if ((lat == null || lng == null) && t.o) {
        var o = OBJ_MAP[t.o];
        if (o && o.lat && o.lng) { lat = o.lat; lng = o.lng; }
      }
      if ((lat == null || lng == null) && t.addr) {
        var cached = getTaskCoords(t.addr);
        if (cached) { lat = cached.lat; lng = cached.lng; }
      }
      if (lat != null && lng != null) routeTasks.push({ t: t, lat: lat, lng: lng });
    });
    if (routeTasks.length === 0) {
      autoRouteCache[cacheKey] = { status: 'done', minutes: 0, km: 0, legs: {} };
      autoRouteRunning = false;
      processAutoRouteQueue();
      return;
    }
    // 22.09-180: расчёт — единым роутером BRouter car (economic) (brouterCarDayRoute):
    // те же цифры, что на карте маршрутов; время С ПРОБКАМИ — как в шапке карты.
    // Порядок объезда — ближайший сосед от базы (как на карте местоположения и Гант-шкале).
    var nnPts = lmNearestOrder(routeTasks.map(function(r) { return { _t: r.t, lat: r.lat, lng: r.lng }; }), base);
    brouterCarDayRoute(nnPts, base, function(res) {
      if (res && res.ok && res.legs && res.legs.length) {
        // Пер-задача: километры и время С ПРОБКАМИ до этой задачи (от предыдущей точки)
        var taskLegs = {};
        nnPts.forEach(function(pt, idx) {
          var leg = res.legs[idx];
          if (!leg || !(leg.distance > 0)) return;
          taskLegs[pt._t.id] = {
            min: Math.max(1, Math.round((leg.duration || 0) / 60)),
            km: leg.distance / 1000
          };
        });
        var retLeg = res.legs[res.legs.length - 1];
        var retMin = retLeg ? Math.max(1, Math.round((retLeg.duration || 0) / 60)) : 0;
        var retKm = retLeg ? retLeg.distance / 1000 : 0;
        autoRouteCache[cacheKey] = { status: 'done', minutes: res.jamMin, km: res.km, legs: taskLegs };
        saveRouteTime(job.masterId, job.off, res.jamMin, res.km, retMin, retKm, taskLegs);
        // Обновляем «🚗 до объекта» внутри плашек задач (без перерисовки)
        updateTaskLegBadges(job.masterId, job.off, taskLegs);
      } else {
        autoRouteCache[cacheKey] = { status: 'error' };
      }
      autoRouteRunning = false;
      setTimeout(processAutoRouteQueue, 500);
    });
  }


  // Обновляет строку "🚗 мин · км" под каждой задачей в ячейке (без перерисовки сетки)
  function updateTaskLegBadges(masterId, off, legs) {
    var cells = document.querySelectorAll('.cell[data-master="' + masterId + '"][data-off="' + off + '"]');
    cells.forEach(function(cell) {
      cell.querySelectorAll('.tile[data-tid]').forEach(function(tile) {
        var tid = tile.getAttribute('data-tid');
        var leg = legs ? legs[tid] : null;
        if (!leg) return;
        var txt = '🚗 ' + fmtDuration(leg.min) + ' · ' + (leg.km || 0).toFixed(1).replace('.', ',') + ' км';
        var span = tile.querySelector('.tile-leg');
        if (span) {
          span.textContent = txt;
        } else {
          span = document.createElement('span');
          span.className = 'tile-leg';
          span.setAttribute('style', 'display:block;font-size:11.5px;color:#2563eb;font-weight:600;margin-top:2px;white-space:nowrap;');
          span.textContent = txt;
          var chk = tile.querySelector('.tile-chk');
          if (chk) tile.insertBefore(span, chk); else tile.appendChild(span);
        }
      });
    });
  }

  function getRouteTimeStore() {
    try { var raw = localStorage.getItem(ROUTE_TIME_KEY); if (raw) return JSON.parse(raw); } catch(e) {}
    return {};
  }
  function saveRouteTime(masterId, dayOff, minutes, km, lastLegMin, lastLegKm, legs) {
    if (!masterId || masterId === 'all') return false;
    var store = getRouteTimeStore();
    var k = masterId + '_' + dayOff;
    var prev = store[k] || {};
    store[k] = {
      minutes: minutes, km: km, lastLegMin: lastLegMin, lastLegKm: lastLegKm,
      legs: (legs !== undefined && legs !== null) ? legs : prev.legs,
      updatedAt: Date.now()
    };
    try { localStorage.setItem(ROUTE_TIME_KEY, JSON.stringify(store)); } catch(e) {}
    return true;
  }
  function getRouteTime(masterId, dayOff) {
    if (!masterId || masterId === 'all') return null;
    var store = getRouteTimeStore();
    return store[masterId + '_' + dayOff] || null;
  }

  // Геокодирование через официальный Nominatim OpenStreetMap.
  // Ищет адрес ПРЯМО на русском. Перебирает варианты запроса, т.к. Nominatim
  // плохо находит улицу без типа (надо «улица Ленина», а не «Ленина»).
  // Универсальный геокодер: сначала Яндекс (лучше находит адреса Минска на русском),
  // при неудаче/недоступности — Nominatim (OSM). Координаты затем использует OSRM для маршрута.
  // === Геокодеры: 2GIS, OpenCage, geocode.xyz (каскад до Nominatim) ===
  function geocode2GIS(addr) {
    var key = (window.SP_CONFIG && SP_CONFIG.twogisKey) || "";
    if (!key) return Promise.resolve(null);
    var q = addr; if (q.indexOf("Минск") === -1) q = "Минск, " + q;
    return fetch("https://catalog.api.2gis.com/3.0/items/geocode?q=" + encodeURIComponent(q) + "&fields=items.point&key=" + key)
      .then(function(r){return r.json();}).then(function(d){
        if (d&&d.result&&d.result.items&&d.result.items[0]&&d.result.items[0].point) return {lat:d.result.items[0].point.lat,lng:d.result.items[0].point.lon};
        return null;}).catch(function(){return null;});
  }
  function geocodeOpenCage(addr) {
    var key = (window.SP_CONFIG && SP_CONFIG.opencageKey) || "";
    if (!key) return Promise.resolve(null);
    return fetch("https://api.opencagedata.com/geocode/v1/json?q=" + encodeURIComponent(addr) + "&key=" + key + "&language=ru&countrycode=by&limit=1")
      .then(function(r){return r.json();}).then(function(d){
        if (d&&d.results&&d.results[0]&&d.results[0].geometry) return {lat:d.results[0].geometry.lat,lng:d.results[0].geometry.lng};
        return null;}).catch(function(){return null;});
  }
  function geocodeXYZ(addr) {
    var q = addr.replace(/^г\.?\s*[Мм]инск[,]\s*/, "").trim();
    if (q.indexOf("Минск") === -1) q = q + ", Минск";
    return fetch("https://geocode.xyz/?json=1&locate=" + encodeURIComponent(q))
      .then(function(r){return r.json();}).then(function(d){
        if (d && !d.error && d.standard && d.standard.latt && d.standard.longt) {
          var la = parseFloat(d.standard.latt), ln = parseFloat(d.standard.longt);
          if (!isNaN(la) && !isNaN(ln)) return {lat: la, lng: ln};
        } return null;}).catch(function(){return null;});
  }
  // Каскад: 2GIS → OpenCage → geocode.xyz → Nominatim (с раскрытием сокращений)
  function geocodeCascading(addr) {
    if (!addr || addr === "?") return Promise.resolve(null);
    var stored = getTaskCoords(addr); if (stored) return Promise.resolve(stored);
    return new Promise(function(resolve){
      var k2=(window.SP_CONFIG&&SP_CONFIG.twogisKey)||"", kOC=(window.SP_CONFIG&&SP_CONFIG.opencageKey)||"";
      var steps=[];
      if(k2) steps.push(function(){return geocode2GIS(addr);});
      if(kOC) steps.push(function(){return geocodeOpenCage(addr);});
      steps.push(function(){return geocodeXYZ(addr);});
      steps.push(function(){return geocodeAddressNominatim(addr);});
      function tryNext(i){
        if(i>=steps.length){resolve(null);return;}
        steps[i]().then(function(c){
          if(c&&!isNaN(parseFloat(c.lat))&&!isNaN(parseFloat(c.lng))){saveTaskCoords(addr,c.lat,c.lng);resolve(c);}
          else tryNext(i+1);
        }).catch(function(){tryNext(i+1);});
      }
      tryNext(0);
    });
  }
  function geocodeAddressUnified(addr) {
    return new Promise(function (resolve) {
      var settled = false;
      function fallback() { geocodeCascading(addr).then(function (c) { if (!settled) { settled = true; resolve(c); } }); }
      function tryYandex() {
        geocodeAddr(addr).then(function (c) {
          if (settled) return;
          if (c && c[0] != null) { settled = true; resolve({ lat: c[0], lng: c[1] }); }
          else fallback();
        });
      }
      if (window.ymaps && window.ymaps.geocode) tryYandex();
      else ensureYandex(tryYandex, fallback);
      setTimeout(function () { if (!settled) { settled = true; fallback(); } }, 4000); // защита от зависания Яндекса
    });
  }

  // Фоновое геокодирование адресов заданий через Яндекс.Карты:
  // находит координаты по адресам (in-place записывает их в точки) и
  // передаёт эти точки в OpenStreetMap (OSRM) для построения маршрута.
  function geocodePointsViaYandex(points) {
    return new Promise(function (resolve) {
      if (!points || !points.length) { resolve(points || []); return; }
      ensureYandex(function () {
        var idx = 0;
        function next() {
          if (idx >= points.length) { resolve(points); return; }
          var p = points[idx]; idx++;
          var addr = (p.addr || '').trim();
          if (!addr || addr === '?') { setTimeout(next, 20); return; }
          // Точка привязана к объекту справочника (ГРП/ШРП) с координатами —
          // ставим её по справочным координатам, геокодер НЕ перезаписывает их
          var stObj = findTask(p.id);
          if (stObj && stObj.o && OBJ_MAP[stObj.o] && OBJ_MAP[stObj.o].lat != null && OBJ_MAP[stObj.o].lng != null) {
            p.lat = OBJ_MAP[stObj.o].lat; p.lng = OBJ_MAP[stObj.o].lng;
            if (stObj.lat !== p.lat || stObj.lng !== p.lng) {
              stObj.lat = p.lat; stObj.lng = p.lng;
              if (TASKS_DB) TASKS_DB.updateTask(stObj.id, { lat: p.lat, lng: p.lng, coord_src: 'object' });
            }
            setTimeout(next, 20); return;
          }
          geocodeAddr(addr).then(function (c) {
            // Яндекс вернул координаты [lat, lng] → перезаписываем точку
            if (c && c[0] != null && !isNaN(parseFloat(c[0])) && !isNaN(parseFloat(c[1]))) {
              p.lat = parseFloat(c[0]); p.lng = parseFloat(c[1]);
              var st = findTask(p.id);
              if (st) { st.lat = p.lat; st.lng = p.lng; if (TASKS_DB) TASKS_DB.updateTask(st.id, st); }
            }
            setTimeout(next, 250); // мягкая пауза между запросами к геокодеру Яндекса
          });
        }
        next();
      }, function () {
        // Яндекс недоступен — точки остаются как есть; fetchOSMRouteGeometry сделает fallback на Nominatim
        resolve(points);
      });
    });
  }

  // Словарь сокращений минских адресов для Nominatim (OSM не понимает аббревиатуры)
  var STREET_ABBR = {
    "к.либкнехта":"Карла Либкнехта","к.маркса":"Карла Маркса","к.цеткин":"Клары Цеткин",
    "в.хоружей":"Веры Хоружей","я.коласа":"Янки Коласа","я.купалы":"Янки Купалы",
    "ф.скорины":"Франциска Скорины","м.богдановича":"Максима Богдановича",
    "п.бровки":"Петруся Бровки","п.глебки":"Петруся Глебки","р.люксембург":"Розы Люксембург",
    "с.ковалевской":"Софьи Ковалевской","а.герцена":"Александра Герцена",
    "н.кедышки":"Николая Кедышки","и.павлова":"Ивана Павлова","д.сердича":"Дмитрия Сердича",
    "в.горбачевой":"Веры Горбачевой","а.невского":"Александра Невского",
    "в.короткевича":"Василия Короткевича","н.гоголя":"Николая Гоголя",
    "л.толстого":"Льва Толстого","а.чехова":"Антона Чехова","м.горького":"Максима Горького",
    "в.маяковского":"Владимира Маяковского","с.есенина":"Сергея Есенина",
    "а.пушкина":"Александра Пушкина","п.мстиславца":"Петра Мстиславца",
    "в.ливенцева":"Вениамина Ливенцева","г.ширмы":"Григория Ширмы",
    "е.полотило":"Ефима Полотило","а.сахарова":"Андрея Сахарова","м.танка":"Максима Танка"
  };
  // Раскрывает сокращения: «К.Либкнехта 118» → «Карла Либкнехта 118», «пр.Независимости» → «проспект Независимости»
  function expandAbbr(addr) {
    if (!addr) return addr;
    var norm = addr.replace(/([\u0410-\u042F\u0401A-Z])\.\s+/g, "$1.").replace(/\s+/g, " ").trim();
    var low = norm.toLowerCase();
    for (var k in STREET_ABBR) {
      var pos = low.indexOf(k);
      if (pos !== -1 && (pos === 0 || /[\s.]/.test(low.charAt(pos - 1)))) {
        norm = norm.substring(0, pos) + STREET_ABBR[k] + norm.substring(pos + k.length);
        break;
      }
    }
    norm = norm.replace(/^пр-т[\.\s]+/i, "проспект ").replace(/^пр\.\s*/i, "проспект ")
      .replace(/^ул\.\s*/i, "улица ").replace(/^пер\.\s*/i, "переулок ")
      .replace(/^пл\.\s*/i, "площадь ").replace(/^бул\.\s*/i, "бульвар ")
      .replace(/^ш\.\s*/i, "шоссе ").replace(/^наб\.\s*/i, "набережная ")
      .replace(/^(мкр-н|мкр)\.\s*/i, "микрорайон ");
    return norm;
  }
  function geocodeAddressNominatim(addr) {
    if (!addr || addr === '?') return Promise.resolve(null);
    var stored = getTaskCoords(addr);
    if (stored) return Promise.resolve(stored);

    // Нормализуем: убираем «г. Минск» в начале, добавляем «, Минск» если города нет
    var cleanAddr = addr.replace(/^г\.?\s*[Мм]инск[,\s]*/, '').trim();
    if (cleanAddr.indexOf('Минск') === -1 && cleanAddr.indexOf('Мінск') === -1) cleanAddr = cleanAddr + ', Минск';
    cleanAddr = expandAbbr(cleanAddr); // раскрыть К.→Карла, пр.→проспект и т.д.

    // Паттерны типов улиц (сокращения и полные формы)
    var streetTypes = /^(улица|ул|пр-т|проспект|пр|переулок|пер|площадь|пл|бульвар|бул|шоссе|ш|набережная|наб|тупик|аллея|проезд|микрорайон|мкр|мкр-н|поселок|пос)\b/i;

    // Генерируем варианты запроса от наиболее вероятного к менее вероятному
    var variants = [cleanAddr];
    if (!streetTypes.test(cleanAddr)) {
      // Нет типа улицы → добавляем варианты с типом
      variants.push('улица ' + cleanAddr);                          // «улица Ленина, 5, Минск»
      variants.push('ул. ' + cleanAddr);                            // «ул. Ленина, 5, Минск»
    }

    // Перебираем варианты последовательно до первого успешного (с паузой 1.1с — лимит Nominatim)
    function tryVariant(idx) {
      if (idx >= variants.length) return Promise.resolve(null);
      var q = variants[idx];
      var params = 'q=' + encodeURIComponent(q) +
        '&format=json&limit=3&accept-language=ru&countrycodes=by&addressdetails=1' +
        '&viewbox=27.30,54.10,27.90,53.75&bounded=1';
      return fetch('https://nominatim.openstreetmap.org/search?' + params)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data && data.length) {
            var lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
            if (!isNaN(lat) && !isNaN(lng)) {
              var result = { lat: lat, lng: lng };
              saveTaskCoords(addr, result.lat, result.lng); // кэшируем (требование политики)
              return result;
            }
          }
          return null; // этот вариант не нашёл
        })
        .catch(function() { return null; })
        .then(function(found) {
          if (found) return found;
          return new Promise(function(resolve) { setTimeout(function() { resolve(tryVariant(idx + 1)); }, 1100); });
        });
    }

    return tryVariant(0);
  }

  // Серийное геокодирование списка адресов с паузой 1.1с между запросами.
  // Nominatim требует максимум 1 запрос/сек. Адреса без координат геокодируются по очереди.
  function geocodeBatchSerial(addresses, onEach) {
    return new Promise(function (resolve) {
      var results = [];
      var i = 0;
      function next() {
        if (i >= addresses.length) { resolve(results); return; }
        var addrItem = addresses[i];
        geocodeCascading(addrItem.addr || '').then(function (c) {
          results.push({ src: addrItem, coords: c });
          if (onEach) onEach(addrItem, c);
          i++;
          setTimeout(next, 1100); // 1.1с пауза — политика Nominatim
        });
      }
      next();
    });
  }

  // Создание полигонов-обходов вокруг закрытых дорог (для ORS avoid_polygons)
  function buildAvoidPolygons() {
    var bufferDeg = 0.001; // ~100 метров буфер вокруг закрытия
    var polygons = [];
    // Используем ТОЛЬКО ручные разметки
    var manualOnly = ymState.roadClosures.filter(function(c) { return c.manual; });
    manualOnly.forEach(function(c) {
      // Создаём ОДИН bounding-box полигон на всё закрытие
      var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      c.latlngs.forEach(function(p) {
        if (p[0] < minLat) minLat = p[0];
        if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1];
        if (p[1] > maxLng) maxLng = p[1];
      });
      // Расширяем на буфер
      minLat -= bufferDeg; maxLat += bufferDeg;
      minLng -= bufferDeg; maxLng += bufferDeg;
      // GeoJSON [lng, lat]
      polygons.push([[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]);
    });
    return polygons;
  }

  // Полигоны закрытий для Valhalla exclude_polygons (ВСЕ источники: OSM + ручные).
  function buildExcludePolygons() {
    var bufferDeg = 0.0009;
    var polygons = [];
    ymState.roadClosures.forEach(function(c) {
      if (!c.latlngs || c.latlngs.length < 1) return;
      var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      c.latlngs.forEach(function(p) {
        if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
      });
      if (minLat === maxLat) { minLat -= 0.0003; maxLat += 0.0003; }
      if (minLng === maxLng) { minLng -= 0.0003; maxLng += 0.0003; }
      minLat -= bufferDeg; maxLat += bufferDeg; minLng -= bufferDeg; maxLng += bufferDeg;
      polygons.push([[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]);
    });
    return polygons;
  }

  function fetchOSMRouteGeometry(provider, points, base, callback) {
    // Шаг 1: убеждаемся что у всех точек есть координаты
    // Шаг 1: убеждаемся что у всех точек есть координаты
    // Точки с координатами или из справочника — сразу; остальные — серийно через Nominatim (1.1с пауза)
    var needGeocodePts = [];
    var instantResolved = [];
    points.forEach(function(p) {
      if (p.lat != null && p.lng != null) { instantResolved.push(p); return; }
      if (p.o) {
        var obj = OBJ_MAP[p.o];
        if (obj && obj.lat && obj.lng) { p.lat = obj.lat; p.lng = obj.lng; instantResolved.push(p); return; }
      }
      needGeocodePts.push(p);
    });

    function proceedWithCoords(resolvedPoints) {
      // Шаг 2: фильтруем точки без координат, но используем центр Минска для них
      resolvedPoints.forEach(function(p) {
        if (p.lat == null || p.lng == null) {
          // Если геокодирование не удалось — ставим в центре Минска с малым смещением
          p.lat = 53.9023 + (Math.random() - 0.5) * 0.02;
          p.lng = 27.5619 + (Math.random() - 0.5) * 0.02;
          console.warn('Геокодирование не удалось для: ' + p.addr + ' — используется центр Минска');
        }
      });

      var validPoints = resolvedPoints;

      // Шаг 3: строим массив координат [lng,lat] — база → точки → база
      var coords = [[base.lng, base.lat]];
      validPoints.forEach(function(p) { coords.push([p.lng, p.lat]); });
      coords.push([base.lng, base.lat]);

      if (provider === 'valhalla') {
        var stadiaKey = (window.SP_CONFIG && SP_CONFIG.stadiaApiKey) || '';
        if (!stadiaKey) {
          console.warn('Stadia API ключ не задан (config.stadiaApiKey) — используется OSRM');
          fetchOSMRouteGeometry('osrm', resolvedPoints, base, callback);
          return;
        }
        var vApiUrl = (window.SP_CONFIG && SP_CONFIG.valhallaApiUrl) || 'https://api.stadiamaps.com';
        var vLocs = [{ lon: base.lng, lat: base.lat, type: 'break' }];
        validPoints.forEach(function(p) { vLocs.push({ lon: p.lng, lat: p.lat, type: 'break' }); });
        vLocs.push({ lon: base.lng, lat: base.lat, type: 'break' });
        var vBody = { costing: 'auto', shape_format: 'geojson', units: 'kilometers', locations: vLocs };
        var excludePolys = buildExcludePolygons();
        if (excludePolys.length) vBody.exclude_polygons = excludePolys;
        var vEndpoint = validPoints.length > 1 ? '/optimized_route/v1' : '/route/v1';
        fetch(vApiUrl + vEndpoint + '?api_key=' + stadiaKey, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vBody)
        }).then(function(r) {
          if (!r.ok) throw new Error('Stadia HTTP ' + r.status);
          return r.json();
        }).then(function(res) {
          if (!res || !res.trip) { callback({ ok: false, msg: 'Valhalla: нет trip' }); return; }
          var trip = res.trip;
          var totalKm = (trip.summary && trip.summary.length) ? trip.summary.length : 0;
          var totalMin = Math.round(((trip.summary && trip.summary.time) ? trip.summary.time : 0) / 60);
          var geom = [];
          (trip.legs || []).forEach(function(leg, li) {
            if (leg.shape && leg.shape.length) {
              leg.shape.forEach(function(c, ci) { if (li === 0 || ci > 0) geom.push(c); });
            }
          });
          var waypoints = [];
          if (res.trip.locations && res.trip.locations.length) {
            var outPos = {};
            res.trip.locations.forEach(function(loc, outIdx) { if (loc.original_index != null) outPos[loc.original_index] = outIdx; });
            for (var wi = 0; wi <= validPoints.length + 1; wi++) {
              waypoints.push({ waypoint_index: (outPos[wi] != null ? outPos[wi] : wi) });
            }
          }
          callback({ ok: true, geometry: geom, km: totalKm, min: totalMin, legs: trip.legs || [], waypoints: waypoints, engine: 'valhalla' });
        }).catch(function(e) { callback({ ok: false, msg: 'Stadia: ' + e.message }); });

      } else if (provider === 'osrm') {
        var manualClosures = ymState.roadClosures.filter(function(c) { return c.manual; });

        var tripCoords = coords.slice(0, -1);
        var coordStr = tripCoords.map(function(c) { return c.join(','); }).join(';');
        fetch('https://router.project-osrm.org/trip/v1/driving/' + coordStr +
          '?roundtrip=true&source=first&overview=full&geometries=geojson&steps=true')
          .then(function(r) { return r.json(); })
          .then(function(res) {
            if (!res || !res.trips || !res.trips[0]) { callback({ ok: false, msg: 'OSRM error' }); return; }
            var trip = res.trips[0];

            if (manualClosures.length === 0) {
              callback({ ok: true, geometry: trip.geometry.coordinates || [], km: trip.distance / 1000, min: Math.round(trip.duration / 60), legs: trip.legs || [], waypoints: res.waypoints || [] });
              return;
            }

            // Парсим оптимальный порядок
            var orderedPts = [];
            for (var wi = 1; wi < (res.waypoints || []).length; wi++) {
              var wp = res.waypoints[wi];
              if (wp && wp.waypoint_index != null && wp.waypoint_index > 0) orderedPts[wp.waypoint_index - 1] = validPoints[wi - 1];
            }
            orderedPts = orderedPts.filter(function(p) { return p; });
            if (orderedPts.length !== validPoints.length) orderedPts = validPoints.slice();

            // Проверяем проходит ли маршрут через закрытия
            var routeGeom = trip.geometry.coordinates || [];
            var viaPoints = [];
            // Центроид маршрута — чтобы выбрать СТОРОНУ объезда (наружу от маршрута)
            var rcLat = 0, rcLng = 0;
            for (var rg = 0; rg < routeGeom.length; rg++) { rcLat += routeGeom[rg][1]; rcLng += routeGeom[rg][0]; }
            var rcN = routeGeom.length || 1; rcLat /= rcN; rcLng /= rcN;

            manualClosures.forEach(function(cl) {
              var mnLat = Infinity, mxLat = -Infinity, mnLng = Infinity, mxLng = -Infinity;
              cl.latlngs.forEach(function(p) {
                if (p[0] < mnLat) mnLat = p[0]; if (p[0] > mxLat) mxLat = p[0];
                if (p[1] < mnLng) mnLng = p[1]; if (p[1] > mxLng) mxLng = p[1];
              });
              var buf = 0.0015; // ~150 м — шире обнаружение попадания
              mnLat -= buf; mxLat += buf; mnLng -= buf; mxLng += buf;
              var hit = false;
              for (var ri = 0; ri < routeGeom.length; ri++) {
                if (routeGeom[ri][1] >= mnLat && routeGeom[ri][1] <= mxLat && routeGeom[ri][0] >= mnLng && routeGeom[ri][0] <= mxLng) { hit = true; break; }
              }
              if (hit) {
                var mLat = 0, mLng = 0;
                cl.latlngs.forEach(function(p) { mLat += p[0]; mLng += p[1]; });
                mLat /= cl.latlngs.length; mLng /= cl.latlngs.length;
                var f = cl.latlngs[0], l = cl.latlngs[cl.latlngs.length - 1];
                var dx = l[0] - f[0], dy = l[1] - f[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
                var off = 0.009; // ~1 км перпендикулярно закрытию — OSRM вынужден объехать
                var pLng = -dy / len, pLat = dx / len; // перпендикуляр
                var candA = [mLng + pLng * off, mLat + pLat * off];
                var candB = [mLng - pLng * off, mLat - pLat * off];
                // выбираем сторону ДАЛЬШЕ от центроида маршрута (объезд наружу)
                var dA = (candA[0]-rcLng)*(candA[0]-rcLng) + (candA[1]-rcLat)*(candA[1]-rcLat);
                var dB = (candB[0]-rcLng)*(candB[0]-rcLng) + (candB[1]-rcLat)*(candB[1]-rcLat);
                viaPoints.push(dA > dB ? candA : candB);
              }
            });

            if (viaPoints.length === 0) {
              callback({ ok: true, geometry: trip.geometry.coordinates || [], km: trip.distance / 1000, min: Math.round(trip.duration / 60), legs: trip.legs || [], waypoints: res.waypoints || [] });
              return;
            }

            // Снапим via-points к дорогам и вставляем каждый рядом со своим закрытием
            Promise.all(viaPoints.map(function(vp) {
              return fetch('https://router.project-osrm.org/nearest/v1/driving/' + vp[0] + ',' + vp[1] + '?number=1')
                .then(function(r) { return r.json(); })
                .then(function(d) { return (d.waypoints && d.waypoints[0]) ? d.waypoints[0].location : vp; })
                .catch(function() { return vp; });
            })).then(function(snapped) {
              // Цепочка точек маршрута: база → p0 → ... → pN → база
              var chain = [[base.lng, base.lat]];
              orderedPts.forEach(function(p) { chain.push([p.lng, p.lat]); });
              chain.push([base.lng, base.lat]);
              // Для каждой объездной точки — ближайший сегмент цепочки
              var detours = snapped.map(function(vp) {
                var bestAfter = 0, bestDist = Infinity;
                for (var seg = 0; seg < chain.length - 1; seg++) {
                  var mx = (chain[seg][0] + chain[seg+1][0]) / 2;
                  var my = (chain[seg][1] + chain[seg+1][1]) / 2;
                  var dd = (mx - vp[0])*(mx - vp[0]) + (my - vp[1])*(my - vp[1]);
                  if (dd < bestDist) { bestDist = dd; bestAfter = seg; }
                }
                return { vp: vp, after: bestAfter };
              });
              // Собираем координаты, вставляя via-точки в нужные сегменты
              var routeCoords = [];
              for (var ci = 0; ci < chain.length; ci++) {
                routeCoords.push(chain[ci]);
                detours.forEach(function(d) { if (d.after === ci) routeCoords.push(d.vp); });
              }
              // Убираем подряд идущие дубликаты координат (иначе OSRM может ошибиться)
              var dedup = [];
              routeCoords.forEach(function(c) {
                var prev = dedup[dedup.length - 1];
                if (!prev || prev[0] !== c[0] || prev[1] !== c[1]) dedup.push(c);
              });
              var rcStr = dedup.map(function(c) { return c.join(','); }).join(';');
              return fetch('https://router.project-osrm.org/route/v1/driving/' + rcStr + '?overview=full&geometries=geojson&steps=true');
            }).then(function(r) { return r.json(); }).then(function(res2) {
              if (res2 && res2.routes && res2.routes[0]) {
                var rt = res2.routes[0];
                var newGeom = rt.geometry.coordinates || [];
                // Проверяем: новый маршрут всё ещё через закрытие?
                var stillHit = false;
                manualClosures.forEach(function(cl) {
                  if (stillHit) return;
                  var cMn = Infinity, cMx = -Infinity, cMn2 = Infinity, cMx2 = -Infinity;
                  cl.latlngs.forEach(function(p) { if(p[0]<cMn)cMn=p[0]; if(p[0]>cMx)cMx=p[0]; if(p[1]<cMn2)cMn2=p[1]; if(p[1]>cMx2)cMx2=p[1]; });
                  cMn-=0.0015; cMx+=0.0015; cMn2-=0.0015; cMx2+=0.0015;
                  for (var gi = 0; gi < newGeom.length; gi++) {
                    if (newGeom[gi][1]>=cMn && newGeom[gi][1]<=cMx && newGeom[gi][0]>=cMn2 && newGeom[gi][0]<=cMx2) { stillHit = true; break; }
                  }
                });
                if (stillHit) {
                  // reroute не помог — возвращаем исходный (лучше короткий, чем крюк через закрытие)
                  callback({ ok: true, geometry: trip.geometry.coordinates || [], km: trip.distance / 1000, min: Math.round(trip.duration / 60), legs: trip.legs || [], waypoints: res.waypoints || [] });
                } else {
                  // reroute успешен — маршрут обходит закрытие
                  callback({ ok: true, geometry: newGeom, km: rt.distance / 1000, min: Math.round(rt.duration / 60), legs: rt.legs || [], waypoints: res.waypoints || [] });
                }
              } else {
                callback({ ok: true, geometry: trip.geometry.coordinates || [], km: trip.distance / 1000, min: Math.round(trip.duration / 60), legs: trip.legs || [], waypoints: res.waypoints || [] });
              }
            }).catch(function() {
              callback({ ok: true, geometry: trip.geometry.coordinates || [], km: trip.distance / 1000, min: Math.round(trip.duration / 60), legs: trip.legs || [], waypoints: res.waypoints || [] });
            });
          }).catch(function(e) { callback({ ok: false, msg: e.message }); });

      } else if (provider === 'graphhopper') {
        var ghKey = (window.SP_CONFIG && SP_CONFIG.graphhopperApiKey) || '';
        var ghPoints = coords.map(function(c) { return c[1] + ',' + c[0]; }); // lat,lng
        var ghUrl = 'https://graphhopper.com/api/1/route?' +
          ghPoints.map(function(p) { return 'point=' + encodeURIComponent(p); }).join('&') +
          '&profile=car&locale=ru&points_encoded=false&ch.disable=true&key=' + ghKey;
        fetch(ghUrl).then(function(r) { return r.json(); }).then(function(res) {
          if (res && res.paths && res.paths[0]) {
            var path = res.paths[0];
            callback({ ok: true, geometry: path.points.coordinates || [], km: path.distance / 1000, min: Math.round(path.time / 60000), legs: path.instructions || [] });
          } else callback({ ok: false, msg: res && res.message ? res.message : 'GH error' });
        }).catch(function(e) { callback({ ok: false, msg: e.message }); });

      } else if (provider === 'ors') {
        var orsKey = (window.SP_CONFIG && SP_CONFIG.orsApiKey) || '';
        var ap = buildAvoidPolygons();
        var orsBody = { coordinates: coords };
        if (ap.length) orsBody.options = { avoid_polygons: { type: 'MultiPolygon', coordinates: ap.map(function(r){ return [r]; }) } };
        fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
          method: 'POST',
          headers: { 'Authorization': orsKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(orsBody)
        }).then(function(r) { return r.json(); }).then(function(res) {
          if (res && res.features && res.features[0]) {
            var feat = res.features[0];
            var summary = feat.properties && feat.properties.summary ? feat.properties.summary : {};
            callback({ ok: true, geometry: feat.geometry.coordinates || [], km: (summary.distance || 0) / 1000, min: Math.round((summary.duration || 0) / 60), legs: feat.properties.segments || [] });
          } else callback({ ok: false, msg: res && res.error ? res.error.message : 'ORS error' });
        }).catch(function(e) { callback({ ok: false, msg: e.message }); });

      } else callback({ ok: false });
    }

    // Запуск: если есть точки без координат — геокодируем серийно (1.1с пауза), иначе сразу
    if (needGeocodePts.length > 0) {
      geocodeBatchSerial(needGeocodePts, function (p, c) {
        if (c) { p.lat = c.lat; p.lng = c.lng; }
      }).then(function () {
        proceedWithCoords(instantResolved.concat(needGeocodePts));
      });
    } else {
      proceedWithCoords(instantResolved);
    }
  }

  /* === БЕСПЛАТНЫЕ АЛЬТЕРНАТИВНЫЕ РОУТЕРЫ (без API-ключа) ===
     Дополнительные источники километража/времени по дорогам, кроме OSRM demo.
     Каждый провайдер возвращает {ok, km, min, geometry, by, legs}.
     Геометрия в формате [[lng,lat], ...] (как у OSRM). */

  // FOSSGIS OSRM (Германия) — публичный OSRM-сервер, поддерживает alternatives.
  // Аналогичен router.project-osrm.org, иногда даёт более точные результаты для Европы.

  // Valhalla публичный (без ключа) — openstreetmap.de даёт 1 запрос/сек без авторизации.
  // Отличается от OSRM алгоритмом, иногда даёт более «человечные» маршруты (меньше поворотов).

  // Маршрут по прямой с поправкой на дороги — самый быстрый fallback без сети.
  // Координаты соединяются прямой линией (для визуализации), километраж = distKm * 1.4,
  // время = по средней скорости Минска (30 км/ч без пробок).
  function fetchStraightLineRoute(points, base, callback) {
    var km = 0;
    var geom = [[base.lng, base.lat]];
    var prev = base;
    points.forEach(function (p) {
      if (p.lat != null) {
        km += distKm(prev, { lat: p.lat, lng: p.lng });
        geom.push([p.lng, p.lat]);
        prev = { lat: p.lat, lng: p.lng };
      }
    });
    km += distKm(prev, base);
    geom.push([base.lng, base.lat]);
    km = km * 1.4; // поправка на извилистость дорог
    var min = Math.max(1, Math.round((km / 30) * 60));
    callback({ ok: true, by: 'straight', km: km, min: min, geometry: geom, legs: [] });
  }

  /* Сравнение всех бесплатных роутеров по одним и тем же точкам. */

  /* 22.09-197: после оптимизации маршрута порядок заданий на день ЗАПОМИНАЕТСЯ —
     в том же порядке работы показываются и в «Планировании» на этот день.
     Поле t.seq — номер позиции в маршруте дня; у задач без него (не участвовали
     в оптимизации) порядок прежний — они показываются после пронумерованных. */
  function dayTaskSort(a, b) {
    var sa = (a.seq != null && isFinite(a.seq)) ? a.seq : 1e9;
    var sb = (b.seq != null && isFinite(b.seq)) ? b.seq : 1e9;
    return sa - sb; // при равных — прежний (стабильный) порядок массива
  }
  function saveDayRouteOrder(orderedPts) {
    try {
      if (!orderedPts || !orderedPts.length || !TASKS_DB) return;
      var byId = {};
      S.tasks.forEach(function (t) { byId[String(t.id)] = t; });
      var changed = 0;
      orderedPts.forEach(function (p, i) {
        var t = byId[String(p.id)];
        if (t && t.seq !== i + 1) { t.seq = i + 1; TASKS_DB.updateTask(t.id, t); changed++; }
      });
      if (changed) { try { logAction('Карта маршрутов: порядок заданий дня после оптимизации сохранён для «Планирования» (' + changed + ' шт)'); } catch (e2) {} }
    } catch (e) { console.warn('saveDayRouteOrder:', e); }
  }

  function buildRoute(noJam) {
    var pts = ymState.pts;
    var canvas = document.getElementById("map-canvas");
    if (!canvas) return;
    if (!pts || pts.length < 1) { toast("warn", "Нет заданий на выбранный день."); return; }
    var base = currentBase();
    ymState.manualOrder = false;

    var tasks = pts.filter(function (p) { return p.addr && p.addr.trim() && p.addr !== "?"; });
    if (!tasks.length) { toast("warn", "В заданиях не указаны адреса."); return; }

    var prov = S.mapProvider || "brouter-car-eco";
    if (prov !== 'brouter-car-eco') prov = 'brouter-car-eco'; // 22.09-179: единственный роутер
    var provName = "BRouter car (economic)"; // 22.09-179

    setRouteInfo({ km: 0, count: tasks.length, building: true });
    toast("ok", "⏳ Оптимизирую маршрут для сервиса " + provName + "…");

    var remaining = tasks.slice();
    var ordered = [];
    var cur = base;

    while (remaining.length) {
      var bestIdx = 0, bestDist = Infinity;
      for (var i = 0; i < remaining.length; i++) {
        var d = distKm(cur, remaining[i]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      var chosen = remaining.splice(bestIdx, 1)[0];
      ordered.push(chosen);
      cur = chosen;
    }

    updateDayListCards(ordered);

    var routeItems = [base];
    ordered.forEach(function (p) { routeItems.push(p); });
    routeItems.push(base);

    var fallbackTimeoutId = setTimeout(function() {
      updateFallbackRouteInfo(ordered);
    }, 2800);

    if (prov === 'brouter-trek' || prov === 'brouter-car' || prov === 'brouter-car-eco' || prov === 'brouter-velomobile') {
      // === BRouter trekking / car-fast / car(eco) / velomobile для основной карты маршрутов ===
      // 22.09-177: velomobile — рабочее серверное имя профиля «vm-forum-velomobil-schnell» (из списка brouter-web)
      var brLabel = prov === 'brouter-car' ? 'BRouter car-fast' : prov === 'brouter-car-eco' ? 'BRouter car (economic)' : prov === 'brouter-velomobile' ? 'BRouter velomobile' : 'BRouter trekking';
      setRouteInfo({ km: 0, count: tasks.length, building: true });
      toast('ok', '⏳ ' + brLabel + ': оптимизация по матрице OSRM…');
      clearTimeout(fallbackTimeoutId);
      var allCoords = [[base.lng, base.lat]];
      ordered.forEach(function (p) { if (p.lat != null) allCoords.push([p.lng, p.lat]); });
      tMatrixCall(allCoords, function (matrixRes) {
        if (!matrixRes) {
          toast('err', '⚠ OSRM Table не ответил — пробую обычную оптимизацию');
          updateFallbackRouteInfo(ordered);
          ymDrawFallbackLine([base].concat(ordered).concat([base])); // 22.09-127: роутер не ответил — прямая пунктирная ломаная поверх Яндекс.Карты
          return;
        }
        var solved = tSolveMatrixFromBase(matrixRes.distances, 0, allCoords.length - 1);
        if (!solved || !solved.order || !solved.order.length) {
          toast('err', '⚠ Не удалось построить оптимальный порядок');
          updateFallbackRouteInfo(ordered);
          ymDrawFallbackLine([base].concat(ordered).concat([base])); // 22.09-127: роутер не ответил — прямая пунктирная ломаная поверх Яндекс.Карты
          return;
        }
        var brOrdered = solved.order.map(function (i) { return ordered[i - 1]; });
        saveDayRouteOrder(brOrdered); // 22.09-197: порядок сохранить — в таком же виде его покажет «Планирование»
        // Обновим карточки слева — новые номера
        updateDayListCards(brOrdered);
        refreshMapCards(brOrdered);
        // 22.09-180: расчёт — единым модулем brouterCarDayRoute (BRouter car economic):
        // время в шапке, в карточках заданий и в карточке базы — С ПРОБКАМИ и согласовано между собой.
        brouterCarDayRoute(brOrdered, base, function (res) {
          if (!res || !res.ok || !res.geometry || res.geometry.length < 2) {
            toast('err', '⚠ ' + brLabel + ': ' + ((res && res.msg) || 'маршрут не построен'));
            updateFallbackRouteInfo(ordered);
            ymDrawFallbackLine([base].concat(brOrdered).concat([base])); // 22.09-127
            return;
          }
          var brKm = res.km, brMin = res.min, mnJammed = res.jamMin;
          var brGeom = res.geometry;
          var legs = res.legs || [];
          // Карточки заданий: километры и время С ПРОБКАМИ до этого задания (от предыдущей точки маршрута)
          var legsMap = {};
          brOrdered.forEach(function (pt, idx) {
            var leg = legs[idx];
            if (!leg || !(leg.distance > 0)) return;
            var lKm = leg.distance / 1000;
            var lMin = Math.max(1, Math.round((leg.duration || 0) / 60));
            pt.travelKm = lKm; pt.travelKmText = lKm.toFixed(1).replace('.', ',') + ' км';
            pt.travelMin = lMin; pt.travelText = fmtDuration(lMin);
            legsMap[pt.id] = { min: lMin, km: lKm };
          });
          updateDayListCards(brOrdered);
          refreshMapCards(brOrdered);
          setRouteInfo({ km: brKm, jamsMin: mnJammed, freeMin: brMin, count: brOrdered.length });
          // Карточка 🏁 базы — обратное плечо (последнее задание → база), время тоже С ПРОБКАМИ
          (function () {
            try {
              var ret = legs[legs.length - 1];
              if (!ret || !(ret.distance > 0)) return;
              var retKm = ret.distance / 1000;
              var retMin = Math.max(1, Math.round((ret.duration || 0) / 60));
              var bcEl = document.getElementById('base-return-info');
              if (bcEl) {
                var lastAddr = (brOrdered[brOrdered.length - 1] && brOrdered[brOrdered.length - 1].addr) || '?';
                if (lastAddr.length > 28) lastAddr = lastAddr.substring(0, 28) + '…';
                bcEl.innerHTML = '🛣 От «' + esc(lastAddr) + '» до базы: <b style="color:#fff">' + fmtDuration(retMin) + '</b> · ' + retKm.toFixed(1).replace('.', ',') + ' км';
              }
              saveRouteTime(S.mapMaster, S.mapOff, mnJammed, brKm, retMin, retKm, legsMap); // запоминаем для планирования
            } catch (e) { console.warn('return-leg:', e); }
          })();
          // Прячем «Открыть в Яндекс.Картах» / «Google Maps» — не подходит для BRouter
          var yaBtnD = document.getElementById('btn-route-yandex');
          var gBtnD = document.getElementById('btn-route-google');
          if (yaBtnD) yaBtnD.style.display = 'none';
          if (gBtnD) gBtnD.style.display = 'none';
          // 22.09-127: линия BRouter — слоем поверх подложки Яндекс.Карты, точки — нумерованные кружки
          if (brGeom && brGeom.length >= 2) {
            ymDrawRouteLine(brGeom.map(function (c) { return [c[1], c[0]]; }));
          } else {
            ymDrawFallbackLine([base].concat(brOrdered).concat([base]));
          }
          ymDrawRouteMarkers(brOrdered);
          toast('ok', '✓ ' + brLabel + ': ' + brKm.toFixed(1).replace('.', ',') + ' км · ' + fmtDuration(mnJammed));
        });
      });
    } else {
      // 22.09-182: роутер один («🚗 BRouter car (economic)») с 22.09-179 — ветки других роутеров недостижимы, удалены при чистке кода
      toast('err', '⚠ Неизвестный роутер');
    }
  }

  function buildYandexRoute(n) { buildRoute(n); }


  /* 22.09-179: карточка 🏁 базы (точка возврата) — ВСЕГДА последняя в списке заданий.
     Раньше рисовалась только в первичной разметке renderMap, а refreshMapCards (клик по
     карточке, обновление статистики, перетаскивание) пересобирал список БЕЗ неё —
     карточка пропадала. Теперь единый генератор для всех мест. */
  function mapBaseCardHtml() {
    var base = currentBase();
    var existRT = getRouteTime(S.mapMaster !== 'all' ? S.mapMaster : null, S.mapOff);
    return '<div class="mtask base-card" id="map-base-card" style="background:linear-gradient(135deg,#0f2740,#1a3a5c);color:#fff;border-color:transparent;cursor:default;">' +
      '<div class="mtask-grip" style="color:rgba(255,255,255,.35);cursor:default;">' + IC.grip + '</div>' +
      '<div class="pin" style="background:var(--card);color:var(--navy);font-size:14px;">🏁</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:700;font-size:12.5px;margin-bottom:3px;color:#fff">📍 ' + esc(base.name) + '</div>' +
        '<div style="font-size:12.5px;color:#93c5fd;margin-bottom:2px">🏠 База · точка возврата</div>' +
        '<div style="font-size:12.5px;color:#cbd5e1;" id="base-return-info">' + (existRT && existRT.lastLegMin ? '🛣 От последнего задания: <b style="color:#fff">' + fmtDuration(existRT.lastLegMin) + '</b> · ' + (existRT.lastLegKm || 0).toFixed(1).replace('.', ',') + ' км' : 'Маршрут до базы рассчитается при оптимизации') + '</div>' +
      '</div></div>';
  }

  /* 22.09-179: обратное плечо (последнее задание → база) по геометрии трека [[lng,lat],...]:
     ближайшая к заданию вершина трека → сумма длин сегментов от неё до конца (до базы). */
  function jamHourForOff(off) {
    try { if (off === 0 || off == null) return new Date().getHours(); } catch (e) {}
    return 10;
  }
  // Коэффициент пробок для выбранного дня (1.0 — если таблица пробок недоступна)
  function jamKForOff(off) {
    var h = jamHourForOff(off);
    return (typeof jamFactorByHour === 'function') ? jamFactorByHour(h) : 1.0;
  }

  /* Длины отрезков маршрута по геометрии трека [[lng,lat],…]: для каждой точки
     маршрута (база → задания → база, порядок wps) ищется ближайшая вершина трека
     (монотонно по ходу пути); длина отрезка — сумма длин сегментов между вершинами.
     Возврат: массив длин отрезков в МЕТРАХ, длина = wps.length-1. */
  function trackLegMeters(geom, wps) {
    if (!geom || geom.length < 2 || !wps || wps.length < 2) return null;
    var cum = [0], i, w;
    for (i = 1; i < geom.length; i++) {
      cum.push(cum[i - 1] + distKm({ lat: geom[i - 1][1], lng: geom[i - 1][0] }, { lat: geom[i][1], lng: geom[i][0] }) * 1000);
    }
    var prev = 0, idx = [];
    for (w = 0; w < wps.length; w++) {
      var cosLat = Math.cos(wps[w][1] * Math.PI / 180), bd = Infinity, bi = prev;
      for (i = prev; i < geom.length; i++) {
        var dLat = geom[i][1] - wps[w][1], dLng = (geom[i][0] - wps[w][0]) * cosLat;
        var dd = dLat * dLat + dLng * dLng;
        if (dd < bd) { bd = dd; bi = i; }
      }
      idx.push(bi); prev = bi;
    }
    var out = [];
    for (w = 1; w < idx.length; w++) out.push(Math.max(0, cum[idx[w]] - cum[idx[w - 1]]));
    return out;
  }

  /* Запрос к единому роутеру BRouter car (economic): база → pts (в переданном порядке) → база.
     22.09-234: сперва через наш сервер /api/route/brouter, запасной путь — напрямую на brouter.de.
     Колбэк получает объект формы, совместимой с fetchOSMRouteGeometry:
       { ok:true, by:'brouter-car-eco', km, min, jamMin, geometry:[[lng,lat]…], legs:[{distance,duration}…] }
     km — километры по дорогам; min — «чистое» время BRouter (мин);
     jamMin — время С ПРОБКАМИ (то, что показывается пользователю);
     legs[i] — отрезок до i-й точки (0-based), legs[pts.length] — возврат на базу;
     duration в legs УЖЕ с пробками (секунды). */
  function brouterCarDayRoute(pts, base, cb, dayOff) {
    var wps = [[base.lng, base.lat]];
    (pts || []).forEach(function (p) { if (p && p.lat != null && p.lng != null) wps.push([p.lng, p.lat]); });
    wps.push([base.lng, base.lat]);
    if (wps.length < 3) { cb({ ok: false, msg: 'BRouter: нет точек с координатами' }); return; }
    // 22.09-234: расчёт идёт СПЕРВА через НАШ сервер (тот же сайт) — надёжнее:
    // без CORS и блокировок brouter.de на самом устройстве (ошибка «failed to fetch»);
    // при любом сбое прокси — автоматический запасной прямой вызов (как раньше).
    var qs = 'lonlats=' + encodeURIComponent(
      wps.map(function (c) { return c[0].toFixed(6) + ',' + c[1].toFixed(6); }).join('|')
    ) + '&profile=car-eco&alternativeidx=0&format=geojson';
    var viaProxy = '/api/route/brouter?' + qs;
    var direct = 'https://brouter.de/brouter?' + qs;
    function getJson(url, withAuth, done) {
      var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} }, 30000);
      var opts = ctrl ? { signal: ctrl.signal } : {};
      if (withAuth && window.SP_API && SP_API.getToken && SP_API.getToken()) {
        opts.headers = { 'Authorization': 'Bearer ' + SP_API.getToken() };
      }
      fetch(url, opts)
        .then(function (r) {
          clearTimeout(timer);
          if (!r.ok) return r.text().then(function (txt) { throw new Error('HTTP ' + r.status + (txt ? ' — ' + txt.slice(0, 120) : '')); });
          return r.json();
        })
        .then(function (j) { done(null, j); })
        .catch(function (e) { clearTimeout(timer); done(e); });
    }
    function handle(res) {
      var f = res && res.features && res.features[0];
      var pp = f && f.properties;
      var km = pp ? (parseFloat(pp['track-length']) || 0) / 1000 : 0;
      var min = pp ? Math.round((parseFloat(pp['total-time']) || 0) / 60) : 0;
      var geom = (f && f.geometry && f.geometry.coordinates) || [];
      if (!(km > 0) || geom.length < 2) { cb({ ok: false, msg: 'BRouter: пустой или неполный ответ' }); return; }
      var jamK = jamKForOff(dayOff);
      var jamMin = Math.max(1, Math.round(min * jamK));
      // Доли отрезков по треку → legs в формате OSRM (distance — метры, duration — секунды С ПРОБКАМИ)
      var legsM = trackLegMeters(geom, wps) || [];
      var sumM = 0; legsM.forEach(function (v) { sumM += v; });
      var legs = [];
      for (var i = 0; i < wps.length - 1; i++) {
        var share = (sumM > 0 && legsM[i] != null) ? (legsM[i] / sumM) : (1 / (wps.length - 1));
        var lm = (legsM[i] != null) ? legsM[i] : (km * 1000 * share);
        legs.push({ distance: lm, duration: Math.max(30, min * 60 * share * jamK) });
      }
      cb({ ok: true, by: 'brouter-car-eco', km: km, min: min, jamMin: jamMin, geometry: geom, legs: legs });
    }
    getJson(viaProxy, true, function (e1, res1) {
      if (e1) {
        getJson(direct, false, function (e2, res2) {
          if (e2) { cb({ ok: false, msg: 'BRouter: ' + ((e2 && e2.message) ? e2.message : 'ошибка сети') }); return; }
          handle(res2);
        });
        return;
      }
      handle(res1);
    });
  }

  function updateDayListCards(orderedTasks) {
    var pts = ymState.pts;
    if (pts) {
      pts.length = 0;
      orderedTasks.forEach(function (p) { pts.push(p); });
      if (orderedTasks.returnTrip) pts.returnTrip = orderedTasks.returnTrip;
    }
    refreshMapCards(orderedTasks);
  }

  function refreshMapCards(pts) {
    var mlist = document.getElementById("mlist");
    if (!mlist) return;
    // Неактивные (выключенные кликом) задания остаются в списке серыми
    var inactive = (ymState.inactivePts && ymState.inactivePts.length) ? ymState.inactivePts : [];
    if ((!pts || !pts.length) && !inactive.length) {
      mlist.innerHTML = "<div class='empty'>На этот день заданий нет</div>" + mapBaseCardHtml(); // 22.09-179
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
        html += "<div class='mtask" + (S.mapSel[p.id] ? " sel" : "") + "' data-mid='" + p.id + "' draggable='true'><div class='mtask-grip'>" + IC.grip + "</div>" +
          "<div class='pin' style='background:" + p.mcol + "'>" + (i + 1) + "</div>" +
          "<div style='flex:1;min-width:0'>" +
            "<div style='font-weight:700;color:var(--ink);font-size:12.5px;margin-bottom:3px'>📍 " + esc(p.addr) + "</div>" +
            "<div style='font-size:12.5px;color:var(--txt);margin-bottom:2px'>🔧 " + esc(p.work) + "</div>" +
            "<div style='font-size:12.5px;color:var(--muted);margin-bottom:2px'>⏱ Норма: <b>" + fmtH(p.norm) + " ч</b></div>" +
            "<div style='font-size:12.5px;color:var(--muted);margin-top:2px;'>" + routeInfoStr + "</div>" +
          "</div></div>";
      });
    }
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
    mlist.innerHTML = html + mapBaseCardHtml(); // 22.09-179: карточка базы — всегда в конце списка
  }

  // 22.09-180: чтение цифр из виджета Яндекс.Карт удалено — шапка карты показывает ТОЛЬКО данные единого роутера (BRouter car economic), сторонние числа её больше не перезаписывают


  function setRouteInfo(info) {
    var el = document.getElementById("route-info"); if (!el) return;
    if (!info) {
      el.innerHTML = "нажмите «Оптимизировать маршрут» для расчета";
      el.style.color = "var(--muted)";
    } else if (info.building) {
      el.innerHTML = "⏳ идёт запрос к серверам...";
      el.style.color = "var(--blue)";
    } else if (info.error) {
      el.innerHTML = "⚠ маршрут не построен";
      el.style.color = "var(--red)";
    } else if (info.km != null) {
      if (info.km <= 0) {
        info.km = Math.max(5.0, (info.count || 3) * 4.5);
        if (!info.jamsMin || info.jamsMin <= 1) info.jamsMin = calculateYandexMinskTime(info.km, true);
        if (!info.freeMin || info.freeMin <= 1) info.freeMin = calculateYandexMinskTime(info.km, false);
      }
      var kmStr = info.km.toFixed(1).replace(".", ",") + " км";
      // 22.09-180: километраж + ОДНО общее время — с учётом пробок (без подписи «с пробками»)
      var tMin = (info.jamsMin != null && info.jamsMin > 0) ? info.jamsMin : info.freeMin;
      var str = "";
      if (tMin != null && tMin > 0) {
        str = '<b style="color:var(--ink);font-size:13.5px;">' + kmStr + '</b> · общее время: <b style="color:#2563eb;">' + fmtDuration(tMin) + '</b>';
      } else {
        str = '<b style="color:var(--ink);font-size:13.5px;">' + kmStr + '</b>';
      }
      el.innerHTML = str;
      el.style.color = "var(--ink)";
    }
  }
  function updateFallbackRouteInfo(orderedTasks) {
    if (!orderedTasks || !orderedTasks.length) return;
    var finalItems = [currentBase()];
    orderedTasks.forEach(function(p) { finalItems.push(p); });
    finalItems.push(currentBase());

    var sumKm = 0;
    orderedTasks.forEach(function(p) {
      if (p.travelKm != null && p.travelKm > 0) sumKm += p.travelKm;
    });
    var ret = orderedTasks.returnTrip || ymState.returnTrip;
    if (ret && ret.km > 0) sumKm += ret.km;

    if (sumKm > 0) {
      var jMin = Math.max(1, Math.round((sumKm / 27.0) * 60));
      var fMin = Math.max(1, Math.round((sumKm / 27.5) * 60));
      setRouteInfo({ km: sumKm, jamsMin: jMin, freeMin: fMin, count: orderedTasks.length });
      return;
    }

    var coords = [];
    finalItems.forEach(function(it) {
      if (it.lat != null && it.lng != null) coords.push(it.lng + "," + it.lat);
    });

    if (coords.length >= 2) {
      fetch("https://router.project-osrm.org/route/v1/driving/" + coords.join(";") + "?overview=false")
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (res && res.routes && res.routes[0]) {
            var distKm = (res.routes[0].distance / 1000) * 1.14; // Калибровка под Яндекс в Минске
            if (distKm > 0) {
              var jamsMin = Math.max(1, Math.round((distKm / 27.0) * 60));
              var freeMin = Math.max(1, Math.round((distKm / 27.5) * 60));
              setRouteInfo({ km: distKm, jamsMin: jamsMin, freeMin: freeMin, count: orderedTasks.length });
            }
          }
        }).catch(function() {});
    }

    var totalKm = routeDistKm(finalItems) * 1.65; // Калибровка городского проезда с учетом мостов и развязок
    if (totalKm <= 0) totalKm = Math.max(5.0, orderedTasks.length * 4.5);
    var jamsMin = Math.max(1, Math.round((totalKm / 27.0) * 60));
    var freeMin = Math.max(1, Math.round((totalKm / 27.5) * 60));
    setRouteInfo({ km: totalKm, jamsMin: jamsMin, freeMin: freeMin, count: orderedTasks.length });
  }
  function distKm(a, b) {
    if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 2.5;
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function routeDistKm(order) { var t = 0; for (var i = 1; i < order.length; i++) t += distKm(order[i - 1], order[i]); return t; }
  function currentBase() { for (var i = 0; i < BASES.length; i++) if (BASES[i].id === S.baseId) return BASES[i]; return BASES[0]; }
  // Расчёт времени в пути по дистанции для Минска (средняя скорость ~27 км/ч)
  function calculateYandexMinskTime(km, withJams) {
    var speed = withJams ? 22 : 30; // км/ч: с пробками / без
    return Math.max(1, Math.round((km / speed) * 60));
  }

  /* =====================================================================
     ПОДДДЕРЖКА КАРТОГРАФИЧЕСКИХ СЕРВИСОВ (OSM и др.) — 22.09-182: мёртвые
     построители виджетов Google/2ГИС/OSM-статистики удалены при чистке кода
     ===================================================================== */
  function buildGoogleDirUrl(items) {
    if (!items || !items.length) return "https://www.google.com/maps";
    var pts = [];
    items.forEach(function(it) {
      var wp = routeWpText(it);
      if (wp) { pts.push(wp); return; } // координаты объекта — приоритет
      var s = it.addr || it.name || "";
      if (s && s !== "?") {
        if (s.indexOf("Минск") === -1) s = "Минск, " + s;
        pts.push(s);
      } else if (it.lat != null && it.lng != null) {
        pts.push(it.lat + "," + it.lng);
      }
    });
    return "https://www.google.com/maps/dir/" + pts.map(encodeURIComponent).join("/");
  }

  /* 22.09-163: ЭКСПОРТ МАРШРУТА «ТЕСТА ПРОЕЗДА» В GOOGLE EARTH (.kml).
     Сам Google Earth маршруты не считает (у него нет такого сервиса для сайтов),
     поэтому маршрут строится как обычно (OSRM / Valhalla / BRouter), а скачанный
     файл .kml открывается в Google Earth на компьютере или телефоне:
     база (флажок), пронумерованные точки объезда и линия маршрута на глобусе. */
  function kmlEscape(s2) {
    return String(s2 == null ? '' : s2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function buildTestRouteKml(items, geom) {
    var dateIso = key(offToDate(TS.off));
    // точки без возможного повторного вхождения базы в конце
    var baseIt = items[0];
    // база в конце — совпадает с первой точкой (по ссылке или по координатам)
    var _last = items[items.length - 1];
    var backBase = items.length >= 2 && baseIt && _last && (_last === baseIt ||
      (+_last.lat) === (+baseIt.lat) && (+_last.lng) === (+baseIt.lng));
    var mid = backBase ? items.slice(1, items.length - 1) : items.slice(1);
    mid = mid.filter(function (it) { return it && it.lat != null && it.lng != null; });
    var x = '';
    x += '<?xml version="1.0" encoding="UTF-8"?>\n';
    x += '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n';
    x += '<name>SmartPlan — маршрут на ' + kmlEscape(dateIso) + '</name>\n';
    x += '<description>Маршрут объезда заданий из SmartPlan: база → точки в оптимизированном порядке → база.</description>\n';
    // стили: база — зелёный флажок; точки — пронумерованные пины (1..10), дальше — точка; линия — синяя
    x += '<Style id="ge-base"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-flag.png</href></Icon></IconStyle></Style>\n';
    for (var si = 1; si <= Math.min(10, mid.length); si++) {
      x += '<Style id="ge-p' + si + '"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/' + si + '.png</href></Icon></IconStyle></Style>\n';
    }
    x += '<Style id="ge-pt"><IconStyle><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon></IconStyle></Style>\n';
    x += '<Style id="ge-line"><LineStyle><color>ffff8c1a</color><width>4</width></LineStyle></Style>\n';
    function ptPm(it, name, styleId, descr) {
      return '<Placemark><name>' + kmlEscape(name) + '</name>' +
        (descr ? '<description>' + kmlEscape(descr) + '</description>' : '') +
        '<styleUrl>#' + styleId + '</styleUrl><Point><coordinates>' + (+it.lng).toFixed(6) + ',' + (+it.lat).toFixed(6) + ',0</coordinates></Point></Placemark>\n';
    }
    if (baseIt && baseIt.lat != null && baseIt.lng != null) x += ptPm(baseIt, 'База — ' + (baseIt.name || baseIt.addr || 'база'), 'ge-base', baseIt.addr || '');
    mid.forEach(function (it, i) {
      var st = (i < 10) ? 'ge-p' + (i + 1) : 'ge-pt';
      var descr = (it.work ? it.work + (it.addr ? ' · ' : '') : '') + (it.addr || '');
      x += ptPm(it, (i + 1) + '. ' + (it.addr || it.name || ('Точка ' + (i + 1))), st, descr);
    });
    // линия: реальная геометрия роутера, иначе — прямые между точками (база → точки → база)
    var linePts = [baseIt].concat(mid).concat(backBase && baseIt ? [baseIt] : []);
    var line = (geom && geom.length >= 2) ? geom
      : linePts.filter(function (it) { return it && it.lat != null && it.lng != null; }).map(function (it) { return [it.lat, it.lng]; });
    if (line && line.length >= 2) {
      var coords = line.map(function (c) { return (+c[1]).toFixed(6) + ',' + (+c[0]).toFixed(6) + ',0'; }).join(' ');
      x += '<Placemark><name>Маршрут объезда</name><styleUrl>#ge-line</styleUrl><LineString><tessellate>1</tessellate><coordinates>' + coords + '</coordinates></LineString></Placemark>\n';
    }
    x += '</Document></kml>\n';
    return x;
  }
  function exportTestRouteToKml() {
    var items = tState.routeItems;
    if (!items || items.length < 2) { toast('warn', 'Сначала постройте маршрут (кнопка «Оптимизация маршрутов»)'); return; }
    try {
      var dateIso = key(offToDate(TS.off));
      var kml = buildTestRouteKml(items, tState.routeGeom);
      var fname = 'Маршрут_SmartPlan_' + dateIso + '.kml';
      var blob = new Blob(['\ufeff' + kml], { type: 'application/vnd.google-earth.kml+xml' });
      var url = URL.createObjectURL(blob);
      var aEl = document.createElement('a');
      aEl.href = url; aEl.download = fname;
      document.body.appendChild(aEl); aEl.click(); aEl.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('ok', '🌍 Скачан ' + fname + ' — откройте его в Google Earth на компьютере или телефоне');
      logAction('Экспорт маршрута в Google Earth', fname + ' · точек: ' + Math.max(0, items.length - 2));
    } catch (e) { toast('err', 'Не удалось создать .kml'); }
  }

  function ymSvgLayer(map, holder) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var panes = holder.querySelector('[class*="inner-panes"]') || holder;
    svg.setAttribute('style', 'position:absolute;left:0;top:0;pointer-events:none;z-index:700'); // над тайлами (601), под слоями событий (3000)
    panes.appendChild(svg);
    var proj = null;
    try { proj = map.options.get('projection'); } catch (e) {}
    if (!proj && window.ymaps && ymaps.projection) proj = ymaps.projection.wgs84Mercator;
    var st = { dead: false, svg: svg, items: [], lastKey: null, rafId: null, lastDraw: 0, lastActive: 0, pollTimer: null, onResize: null, domKick: null };

    // Живое состояние карты: во время цепочки зумов boundschange приходит
    // ТОЛЬКО в самом конце (карта анимируется), поэтому промежуточные
    // значения зума/центра берём из action state — слой следует за
    // анимацией покадрово, как родные объекты Яндекс.Карт.
    function liveState() {
      try {
        if (map.action && map.action.getCurrentState) {
          var s = map.action.getCurrentState();
          if (s && s.zoom != null && s.globalPixelCenter) return { z: s.zoom, c: s.globalPixelCenter, ticking: !!s.isTicking };
        }
      } catch (e) {}
      try { return { z: map.getZoom(), c: map.getGlobalPixelCenter(), ticking: false }; } catch (e) { return null; }
    }
    function stateKey() {
      var s = liveState();
      if (!s) return null;
      return { key: (+s.z).toFixed(4) + '|' + s.c[0].toFixed(1) + '|' + s.c[1].toFixed(1), z: s.z, c: s.c, ticking: s.ticking };
    }
    function redrawCore(zoom, gpc) {
      if (st.dead || !proj) return;
      try {
        var W = 0, H = 0;
        try { var s = map.container.getSize(); if (s && s[0]) { W = s[0]; H = s[1]; } } catch (e) {}
        if (!W) { W = holder.clientWidth || 0; H = holder.clientHeight || 0; }
        if (!W || !H) return;
        svg.setAttribute('width', W);
        svg.setAttribute('height', H);
        var dx = gpc[0] - W / 2, dy = gpc[1] - H / 2; // экран = глобальные − (центр − размер/2)
        var out = [], defs = [];
        for (var k = 0; k < st.items.length; k++) {
          var it = st.items[k];
          try {
            if (it.kind === 'poly') {
              // полигон области: заливка + контур (толщина в экранных пикселях).
              // Видимость — по ПЕРЕСЕЧЕНИЮ рамки полигона с экраном: при сильном
              // приближении все вершины уходят за экран, а полигон покрывает его целиком
              var ptsStr = '', minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
              for (var i = 0; i < it.pts.length; i++) {
                var gp = proj.toGlobalPixels([+it.pts[i][0], +it.pts[i][1]], zoom);
                var x = gp[0] - dx, y = gp[1] - dy;
                ptsStr += (i ? ' ' : '') + x.toFixed(1) + ',' + y.toFixed(1);
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
              }
              if (maxX < -50 || minX > W + 50 || maxY < -50 || minY > H + 50) continue; // рамка мимо экрана
              out.push('<polygon points="' + ptsStr + '" fill="' + it.color + '" fill-opacity="' + (it.fillOp != null ? it.fillOp : 0.18) + '" stroke="' + it.color + '" stroke-opacity="' + (it.strokeOp != null ? it.strokeOp : 0.9) + '" stroke-width="' + (it.strokeW != null ? it.strokeW : 2) + '" stroke-linejoin="round"/>');
            } else if (it.kind === 'blob') {
              // пятно осадков (модель Open-Meteo): мягкий радиальный градиент,
              // радиус задан в МЕТРАХ и пересчитывается в пиксели по зуму
              var gpb = proj.toGlobalPixels([+it.lat, +it.lng], zoom);
              var bx = gpb[0] - dx, by = gpb[1] - dy;
              var mpp = 156543.03392 * Math.cos((+it.lat) * Math.PI / 180) / Math.pow(2, zoom); // м/пкс, сферический меркатор
              var br = (+it.radiusM || 6000) / mpp;
              if (bx < -br - 60 || bx > W + br + 60 || by < -br - 60 || by > H + br + 60) continue;
              var bop = it.opacity != null ? it.opacity : 0.5;
              var gid = 'wxtg' + (it.gid != null ? it.gid : k);
              defs.push('<radialGradient id="' + gid + '"><stop offset="0" stop-color="' + it.color + '" stop-opacity="' + bop + '"/><stop offset="0.6" stop-color="' + it.color + '" stop-opacity="' + (bop * 0.55).toFixed(2) + '"/><stop offset="1" stop-color="' + it.color + '" stop-opacity="0"/></radialGradient>');
              out.push('<circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="' + br.toFixed(1) + '" fill="url(#' + gid + ')"/>');
            } else if (it.kind === 'dot') {
              // точка-объект: цветной кружок с номером (как прежние метки)
              var gpd = proj.toGlobalPixels([+it.lat, +it.lng], zoom);
              var px = gpd[0] - dx, py = gpd[1] - dy;
              if (px < -40 || px > W + 40 || py < -40 || py > H + 40) continue;
              var r = it.r || 15;
              out.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r + '" fill="' + it.color + '" stroke="#ffffff" stroke-width="3"/>' +
                '<text x="' + px.toFixed(1) + '" y="' + (py + r * 0.34).toFixed(1) + '" text-anchor="middle" font-family="Arial,sans-serif" font-size="' + Math.round(r * 0.9) + '" font-weight="bold" fill="#ffffff">' + (it.label || '·') + '</text>');
            }
          } catch (e) { /* один объект не может ломать слой */ }
        }
        svg.innerHTML = (defs.length ? '<defs>' + defs.join('') + '</defs>' : '') + out.join('');
      } catch (e) { /* перерисовка не может ломать страницу */ }
    }
    // rAF-цикл: перерисовываем слой, пока меняется состояние (не чаще ~30 раз/с).
    // Цикл живёт ещё ~0.7с после последней активности: между шагами цепочки
    // зумов бывают паузы (isTicking=false, событий нет) — за это время придёт
    // следующий шаг, и слой продолжит следовать за анимацией без «заморозки».
    function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function frame() {
      if (st.dead) { st.rafId = null; return; }
      var k = stateKey();
      if (!k) { st.rafId = null; return; }
      var now = nowMs();
      if (k.key !== st.lastKey) {
        st.lastActive = now;
        if (now - st.lastDraw >= 33) {
          st.lastDraw = now; st.lastKey = k.key;
          redrawCore(k.z, k.c);
        }
      }
      if (k.ticking) st.lastActive = now;
      if (now - st.lastActive < 700) st.rafId = requestAnimationFrame(frame);
      else st.rafId = null; // 0.7с тишины — паркуем цикл (события его разбудят)
    }
    function kick() { // событие карты: разбудить и продлить жизнь циклу
      if (st.dead) return;
      st.lastActive = nowMs();
      if (st.rafId == null) st.rafId = requestAnimationFrame(frame);
    }
    function poke() { // страховка-опрос: только разбудить, жизнь не продлеваем
      if (st.dead || st.rafId != null) return;
      st.rafId = requestAnimationFrame(frame);
    }
    map.events.add('boundschange', kick);
    try { map.events.add('actiontick', kick); map.events.add('actionbegin', kick); } catch (e) {}
    // колесо/перетаскивание/тач по карте — тоже будят цикл (события action приходят не всегда)
    st.domKick = function () { kick(); };
    try {
      holder.addEventListener('wheel', st.domKick, { passive: true });
      holder.addEventListener('mousedown', st.domKick, { passive: true });
      holder.addEventListener('touchstart', st.domKick, { passive: true });
    } catch (e) {}
    st.onResize = kick;
    window.addEventListener('resize', st.onResize);
    st.pollTimer = setInterval(poke, 500); // страховка: любое изменение состояния подхватится
    return {
      set: function (items) {
        st.items = items || [];
        var k = stateKey();
        if (k) { st.lastKey = k.key; redrawCore(k.z, k.c); }
      },
      redraw: kick,
      destroy: function () {
        st.dead = true;
        if (st.rafId != null) { cancelAnimationFrame(st.rafId); st.rafId = null; }
        if (st.pollTimer) { clearInterval(st.pollTimer); st.pollTimer = null; }
        try { map.events.remove('boundschange', kick); } catch (e) {}
        try { map.events.remove('actiontick', kick); map.events.remove('actionbegin', kick); } catch (e) {}
        try { window.removeEventListener('resize', st.onResize); } catch (e) {}
        if (st.domKick) {
          try { holder.removeEventListener('wheel', st.domKick); } catch (e) {}
          try { holder.removeEventListener('mousedown', st.domKick); } catch (e) {}
          try { holder.removeEventListener('touchstart', st.domKick); } catch (e) {}
        }
        try { svg.remove(); } catch (e) {}
      }
    };
  }

  // Фильтр «Карта объектов»: какие слои показывать (ГРП / ШРП / Прочие / Области).
  // Сохраняется в localStorage. Скрывает и отрисовку, и клики (скрытое не открывает облачко).
  // 22.09-184: HOTFIX — объявление затёрто чисткой 22.09-182, без него падал refresh() (сайт не открывал страницы)
  var omState = { map: null, tipTimer: null, svg: null, vc: [], vp: [] }; // vc/vp — видимые с учётом фильтра
  var omFilter = { grp: true, shrp: true, grs: true, pgrp: true, other: true, zones: true };
  try {
    var _omf = JSON.parse(localStorage.getItem('smartplan_objmap_filter') || 'null');
    if (_omf) omFilter = { grp: _omf.grp !== false, shrp: _omf.shrp !== false, grs: _omf.grs !== false, pgrp: _omf.pgrp !== false, other: _omf.other !== false, zones: _omf.zones !== false };
  } catch (e) {}
  function omPtCat(o) { return o.type === 'ГРП' ? 'grp' : (o.type === 'ШРП' ? 'shrp' : (o.type === 'ГРС' ? 'grs' : (o.type === 'ПГРП' ? 'pgrp' : (o.type === 'Область' ? 'zones' : 'other')))); }
  // Цвет точки на карте по типу объекта (ГРП синий, ШРП фиолетовый, ГРС бирюзовый, ПГРП оранжевый, прочие серые)
  function omTypeColor(t) { return t === 'ГРП' ? '#2563eb' : (t === 'ШРП' ? '#7c3aed' : (t === 'ГРС' ? '#0891b2' : (t === 'ПГРП' ? '#d97706' : '#64748b'))); }
  // применить фильтр: пересобрать видимые объекты (omState.vc / omState.vp) и перерисовать слой
  function omApplyFilter(allCoords, allPoly, layer) {
    var inputs = document.querySelectorAll('#om-filter input[type=checkbox]');
    for (var i = 0; i < inputs.length; i++) omFilter[inputs[i].getAttribute('data-f')] = inputs[i].checked;
    try { localStorage.setItem('smartplan_objmap_filter', JSON.stringify(omFilter)); } catch (e) {}
    omState.vc = allCoords.filter(function (o) { return omFilter[omPtCat(o)]; });
    // полигоны — по типу: тип «Область» — чекбокс «Области»,
    // трассы/просеки с контуром — чекбокс «Прочие»
    omState.vp = allPoly.filter(function (o) { return omFilter[omPtCat(o)]; });
    var items = [];
    omState.vp.forEach(function (o) {
      try {
        var ring = o.poly.map(function (p) { return [+p[0], +p[1]]; });
        items.push({ kind: 'poly', pts: ring, color: zoneColorOf(o), fillOp: 0.18, strokeOp: 0.9, strokeW: 2 });
      } catch (e) {}
    });
    omState.vc.forEach(function (o) {
      items.push({ kind: 'dot', lat: +o.lat, lng: +o.lng, color: omTypeColor(o.type), label: objNumOf(o) || '·', r: 15 });
    });
    layer.set(items);
  }
  // панель фильтра справа поверх карты (в контейнере #om-map; карта — во вложенном div)
  function omAddFilterPanel(holder, allCoords, allPoly, layer) {
    var cnt = { grp: 0, shrp: 0, grs: 0, pgrp: 0, other: 0, zones: 0 };
    var seen = {};
    allCoords.concat(allPoly).forEach(function (o) {
      if (!o || seen[o.id]) return;
      seen[o.id] = 1;
      cnt[omPtCat(o)]++;
    });
    var rows = [
      { k: 'grp', label: 'ГРП', color: '#2563eb', n: cnt.grp },
      { k: 'shrp', label: 'ШРП', color: '#7c3aed', n: cnt.shrp },
      { k: 'grs', label: 'ГРС', color: '#0891b2', n: cnt.grs },
      { k: 'pgrp', label: 'ПГРП', color: '#d97706', n: cnt.pgrp },
      { k: 'other', label: 'Прочие', color: '#64748b', n: cnt.other },
      { k: 'zones', label: 'Области', color: '#0d9488', n: cnt.zones }
    ];
    var p = document.createElement('div');
    p.id = 'om-filter';
    // выбор слоя: в один ряд (flex-direction: row), левый верхний угол карты
    p.style.cssText = 'position:absolute;left:12px;top:12px;z-index:1000;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 6px 20px rgba(15,39,64,.18);padding:8px 12px;font-size:12px;display:flex;flex-direction:row;align-items:center;gap:12px;flex-wrap:wrap;max-width:calc(100% - 24px)';
    var h = '<span style="font-weight:800;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;flex:0 0 auto">Слои:</span>';
    rows.forEach(function (r) {
      h += '<label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none">' +
        '<input type="checkbox" data-f="' + r.k + '"' + (omFilter[r.k] ? ' checked' : '') + ' style="accent-color:#2563eb;width:14px;height:14px;cursor:pointer;margin:0;flex:0 0 auto">' +
        '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + r.color + ';flex:0 0 auto"></span>' +
        '<span style="color:var(--ink)">' + r.label + ' <span style="color:var(--muted);font-weight:700">(' + r.n + ')</span></span></label>';
    });
    p.innerHTML = h;
    holder.appendChild(p);
    var inputs = p.querySelectorAll('input[type=checkbox]');
    for (var j = 0; j < inputs.length; j++) {
      inputs[j].addEventListener('change', function () { omApplyFilter(allCoords, allPoly, layer); });
    }
    omApplyFilter(allCoords, allPoly, layer); // первичное применение (учитывает сохранённый фильтр)
  }

  function renderObjMap() {
    var v = document.getElementById('view');
    lmStopTicker && null; // (не используется здесь — просто карта)
    // уничтожить прошлую карту и слой (уход/повторный вход)
    if (omState.svg) { try { omState.svg.destroy(); } catch (e) {} omState.svg = null; }
    try { if (omState.map) { omState.map.destroy(); } } catch (e) {}
    omState.map = null;
    var tipEl = document.getElementById('om-hint-tip'); if (tipEl) tipEl.remove();

    refreshObjects();
    var withCoords = OBJECTS.filter(function (o) { return o && o.lat != null && o.lng != null; });
    var withPoly = OBJECTS.filter(function (o) { return o && o.poly && o.poly.length >= 3; });
    var onlyPoly = withPoly.filter(function (o) { return !(o.lat != null && o.lng != null); });

    var html = '<div style="height:calc(100vh - 62px);display:flex;flex-direction:column;background:#e8eef3;position:relative;z-index:0">';
    html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--card);border-bottom:1px solid var(--line);flex-wrap:wrap;flex:0 0 auto">';
    html += '<div><div style="font-size:14px;font-weight:800;color:var(--ink)">Карта объектов</div>';
    html += '<div class="sub" style="font-size:12.5px">Точки: ' + withCoords.length + ' · Области: ' + withPoly.length + (onlyPoly.length ? ' (только область: ' + onlyPoly.length + ')' : '') + ' · нажмите на точку или область · сборка 21.09-21</div></div>';
    html += '<div style="margin-left:auto;display:flex;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap">';
    html += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2563eb;margin-right:4px"></span>ГРП</span>';
    html += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7c3aed;margin-right:4px"></span>ШРП</span>';
    html += '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#64748b;margin-right:4px"></span>Прочие</span>';
    html += '<span><span style="display:inline-block;width:10px;height:10px;border:1px dashed #64748b;margin-right:4px;background:rgba(100,116,139,.25)"></span>Область</span>';
    html += '</div></div>';
    html += '<div id="om-map" style="flex:1;min-height:0;position:relative">';
    html += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px">';
    html += '<div class="skel" style="width:70%;height:26px"></div><div class="skel" style="width:50%;height:26px"></div><div class="skel" style="width:80%;height:26px"></div>';
    html += '<div style="font-size:12.5px;font-weight:700;color:var(--muted)">⏳ Загружаем карту объектов…</div></div>';
    html += '</div></div>';
    v.innerHTML = html;

    ensureYandex(function () {
      var holder = document.getElementById('om-map');
      if (!holder || S.screen !== 'objmap') return;
      holder.innerHTML = '';
      try {
        // карта — во вложенном div: панель фильтра справа остаётся поверх
        var mapDiv = document.createElement('div');
        mapDiv.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0';
        holder.appendChild(mapDiv);
        var map = new ymaps.Map(mapDiv, {
          center: [53.9023, 27.5619], zoom: 11, type: null,
          controls: ['zoomControl', 'fullscreenControl']
        }, { projection: ymaps.projection.sphericalMercator, suppressMapOpenBlock: true });
        omState.map = map;

        // зум-кнопки — вправо (левый верхний угол занимает панель «Слои»)
        try {
          var zc = map.controls.get('zoomControl');
          if (zc && zc.options) zc.options.set({ position: { top: 50, right: 10 } });
        } catch (e) {}

        // --- Области и точки рисуем СВОИМ SVG-слоем (над тайлами, под
        //     кнопками; векторный рендер Яндекс.Карт не используется — на
        //     части машин он не отрисовывается). Клики — как раньше, через
        //     единый обработчик карты (слой pointer-events:none). ---
        var layer = ymSvgLayer(map, mapDiv);
        omState.svg = layer;
        // границы всех объектов — только для начального масштаба карты
        var b1 = null, b2 = null;
        withPoly.forEach(function (o) {
          try {
            var ring = o.poly.map(function (p) { return [+p[0], +p[1]]; });
            for (var i = 0; i < ring.length; i++) {
              if (b1 == null || ring[i][0] < b1[0]) { if (b1 == null) b1 = [ring[i][0], ring[i][1]]; else b1[0] = ring[i][0]; }
              if (b2 == null || ring[i][0] > b2[0]) { if (b2 == null) b2 = [ring[i][0], ring[i][1]]; else b2[0] = ring[i][0]; }
              if (ring[i][1] < b1[1]) b1[1] = ring[i][1];
              if (ring[i][1] > b2[1]) b2[1] = ring[i][1];
            }
          } catch (e) {}
        });
        var pb1 = null, pb2 = null;
        withCoords.forEach(function (o) {
          var la = +o.lat, ln = +o.lng;
          if (pb1 == null || la < pb1[0]) { if (pb1 == null) pb1 = [la, ln]; else pb1[0] = la; }
          if (pb2 == null || la > pb2[0]) { if (pb2 == null) pb2 = [la, ln]; else pb2[0] = la; }
          if (ln < pb1[1]) pb1[1] = ln;
          if (ln > pb2[1]) pb2[1] = ln;
        });
        // панель фильтра (ГРП/ШРП/Прочие/Области) + первичная отрисовка слоя
        omAddFilterPanel(holder, withCoords, withPoly, layer);
        // подложки карты: OpenStreetMap / Яндекс / 2ГИС
        var bmPanel = document.createElement('div');
        bmPanel.id = 'om-basemap';
        bmPanel.style.cssText = 'position:absolute;right:65px;top:12px;z-index:1000;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 6px 20px rgba(15,39,64,.18);padding:7px 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:calc(100% - 24px)';
        holder.appendChild(bmPanel);
        omDrawBasemapPanel();
        bmPanel.addEventListener('click', function (e) {
          var b = e.target.closest('[data-om-bm]');
          if (b) omSetBasemap(b.getAttribute('data-om-bm'));
        });
        omSetBasemap(omBasemapCur()); // применить сохранённую подложку (Яндекс = web_mercator-рендерер)

        // масштаб: по всем точкам и полигонам
        var all1 = null, all2 = null;
        if (withCoords.length && withPoly.length) { all1 = [Math.min(pb1[0], b1[0]), Math.min(pb1[1], b1[1])]; all2 = [Math.max(pb2[0], b2[0]), Math.max(pb2[1], b2[1])]; }
        else if (withCoords.length) { all1 = pb1; all2 = pb2; }
        else if (withPoly.length) { all1 = b1; all2 = b2; }
        if (all1 && (withCoords.length + withPoly.length) > 1) {
          try { map.setBounds([all1, all2], { checkZoomRange: true, zoomMargin: 40 }); } catch (e) {}
        } else if (all1 && withPoly.length === 1) {
          // единственная область и нет точек — показать её целиком (иначе карта
          // оставалась на дефолтном центре Минска, и область была за экраном)
          try { map.setBounds([b1, b2], { checkZoomRange: true, zoomMargin: 60 }); } catch (e) {}
        } else if (withCoords.length === 1) {
          map.setCenter([+withCoords[0].lat, +withCoords[0].lng], 14);
        }

        // --- ЕДИНСТВЕННЫЙ обработчик кликов: точка (~20px) → область → ничего ---
        map.events.add('click', function (e) {
          try {
            omHideTip();
            var c = (e && e.get) ? e.get('coords') : null;
            if (!c || !isFinite(c[0]) || !isFinite(c[1])) return;
            var lat = c[0], lng = c[1];
            var zoom = map.getZoom();
            var mPerPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
            var R = 20 * mPerPx / 111320;
            var vcs = omState.vc || [];
            var best = null, bestD2 = R * R;
            for (var i = 0; i < vcs.length; i++) {
              var o = vcs[i];
              var dy = +o.lat - lat, dx = +o.lng - lng, d2 = dy * dy + dx * dx;
              if (d2 < bestD2) { bestD2 = d2; best = o; }
            }
            if (best) { omShowTip('🏭 ' + (best.type || 'Объект') + (objNumOf(best) ? ' №' + objNumOf(best) : ''),
              esc(best.addr || 'адрес не указан') +
              ((best.lat != null && best.lng != null) ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">📍 ' + (+best.lat).toFixed(5) + ', ' + (+best.lng).toFixed(5) + '</div>' : ''), e);
              return;
            }
            // точка внутри полигона? (алгоритм луча) → облачко: наименование + описание
            var vps = omState.vp || [];
            for (var p = 0; p < vps.length; p++) {
              var po = vps[p];
              if (omPointInPoly(lat, lng, po.poly)) {
                var zname = po.addr || ((po.type || 'Область') + (objNumOf(po) ? ' №' + objNumOf(po) : '')) || 'Область';
                var zbody = '';
                if (po.descr) zbody += '<div style="margin-bottom:3px">' + esc(po.descr) + '</div>';
                if (po.addr && po.addr !== zname) zbody += '<div style="font-size:12.5px;color:#334155;margin-bottom:3px">📍 ' + esc(po.addr) + '</div>';
                zbody += '<div style="font-size:12px;color:var(--muted);margin-top:2px">◻ область, ' + po.poly.length + ' точек</div>';
                omShowTip('🗺 ' + esc(zname), zbody, e);
                return;
              }
            }
          } catch (err) { /* клик не может ломать страницу */ }
        });
        // курсор «рука» при наведении на точку или область (тот же хит-тест)
        var omCurLast = 0;
        map.events.add('mousemove', function (e) {
          try {
            var now = Date.now();
            if (now - omCurLast < 60) return; // не чаще ~16 раз/с
            omCurLast = now;
            var c = (e && e.get) ? e.get('coords') : null;
            if (!c || !isFinite(c[0]) || !isFinite(c[1])) return;
            var zoom2 = map.getZoom();
            var mPerPx2 = 156543.03392 * Math.cos(c[0] * Math.PI / 180) / Math.pow(2, zoom2);
            var R2 = 20 * mPerPx2 / 111320;
            var hit = false;
            var vc2 = omState.vc || [];
            for (var i2 = 0; i2 < vc2.length; i2++) {
              var dy2 = +vc2[i2].lat - c[0], dx2 = +vc2[i2].lng - c[1];
              if (dy2 * dy2 + dx2 * dx2 < R2 * R2) { hit = true; break; }
            }
            if (!hit) {
              var vp2 = omState.vp || [];
              for (var p2 = 0; p2 < vp2.length && !hit; p2++) if (omPointInPoly(c[0], c[1], vp2[p2].poly)) hit = true;
            }
            var cel = null;
            try { cel = map.container.getElement(); } catch (er) {}
            if (cel) cel.style.cursor = hit ? 'pointer' : '';
          } catch (err2) { /* наведение не может ломать страницу */ }
        });
      } catch (e) {
        holder.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red);font-weight:700">Не удалось загрузить карту — проверьте интернет и обновите страницу</div>';
      }
    }, function () {
      var holder = document.getElementById('om-map');
      if (holder) holder.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red);font-weight:700">Карта недоступна — проверьте интернет</div>';
    });
  }

  /* ===== ПОДЛОЖКИ КАРТЫ ОБЪЕКТОВ ===== */
  var OM_BASEMAPS = [
    { k: 'osm', label: 'OSM', title: 'OpenStreetMap' },
    { k: 'yandex', label: 'Яндекс', title: 'Яндекс.Карта' },
    { k: '2gis', label: '2ГИС', title: '2ГИС' }
  ];
  function omBasemapCur() {
    var v = null;
    try { v = localStorage.getItem('smartplan_objmap_basemap'); } catch (e) {}
    for (var i = 0; i < OM_BASEMAPS.length; i++) if (OM_BASEMAPS[i].k === v) return v;
    return 'yandex';
  }
  function omEnsureBasemapTypes() {
    // Карта объектов создаётся В СФЕРИЧЕСКОЙ проекции (web_mercator, как OSM/2ГИС) —
    // поэтому подложки OSM и 2ГИС стоят ровно (на эллипсоидной проекции Яндекса
    // они смещены на ~450px в Минске). Яндекс-подложка — официальный рендерер
    // с projection=web_mercator (та же сетка).
    // ВАЖНО: ymaps.MapType принимает ФАБРИЧНЫЕ ФУНКЦИИ слоёв (не экземпляры).
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
    } catch (e) { console.error('Яндекс-тип карты (web_mercator):', e); }
    try {
      if (!ymaps.mapType.storage.get('sp#osm')) {
        var osmFactory = function () {
          // основной сервер tile.openstreetmap.org блокирует запросы («access blocked»),
          // поэтому используем рабочее зеркало того же стиля
          var layer = new ymaps.Layer('https://tile.openstreetmap.de/%z/%x/%y.png', { tileTransparent: false });
          layer.getZoomRange = function () { return Promise.resolve([0, 19]); };
          return layer;
        };
        ymaps.mapType.storage.add('sp#osm', new ymaps.MapType('OSM', [osmFactory]));
      }
    } catch (e) { console.error('OSM-тип карты:', e); }
    try {
      if (!ymaps.mapType.storage.get('sp#2gis')) {
        var gisFactory = function () {
          var layer = new ymaps.Layer('https://tile1.maps.2gis.com/tiles?x=%x&y=%y&z=%z', { tileTransparent: false });
          layer.getZoomRange = function () { return Promise.resolve([0, 19]); };
          return layer;
        };
        ymaps.mapType.storage.add('sp#2gis', new ymaps.MapType('2GIS', [gisFactory]));
      }
    } catch (e) { console.error('2ГИС-тип карты:', e); }
  }
  function omSetBasemap(kind) {
    try { localStorage.setItem('smartplan_objmap_basemap', kind); } catch (e) {}
    var map = omState.map;
    if (map && window.ymaps) {
      try {
        omEnsureBasemapTypes();
        if (kind === 'osm') map.setType('sp#osm');
        else if (kind === '2gis') map.setType('sp#2gis');
        else map.setType('sp#yandex');
      } catch (e) { console.error('Подложка карты не переключилась:', e); }
    }
    omDrawBasemapPanel();
  }
  function omDrawBasemapPanel() {
    var p = document.getElementById('om-basemap');
    if (!p) return;
    var cur = omBasemapCur();
    var h = '<span style="font-weight:800;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;flex:0 0 auto">Карта:</span>';
    OM_BASEMAPS.forEach(function (b) {
      var on = b.k === cur;
      h += '<button type="button" data-om-bm="' + b.k + '" title="' + b.title + '" style="padding:5px 10px;border:1px solid ' + (on ? '#2563eb' : 'var(--line)') + ';border-radius:7px;background:' + (on ? '#2563eb' : 'var(--card)') + ';color:' + (on ? '#fff' : 'var(--ink)') + ';font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">' + b.label + '</button>';
    });
    p.innerHTML = h;
  }

  // Точка внутри полигона (ray casting)
  function omPointInPoly(lat, lng, poly) {
    try {
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = +poly[i][0], yi = +poly[i][1], xj = +poly[j][0], yj = +poly[j][1];
        if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    } catch (e) { return false; }
  }

  // DOM-облачко страницы «Карта объектов» (как lmShowHintTip)
  function omHideTip() {
    var t = document.getElementById('om-hint-tip'); if (t) t.remove();
  }
  function omShowTip(header, bodyHtml, evt) {
    omHideTip();
    var tip = document.createElement('div');
    tip.id = 'om-hint-tip';
    tip.style.cssText = 'position:fixed;z-index:1200;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 8px 28px rgba(15,39,64,.3);padding:11px 30px 11px 13px;font-family:inherit;font-size:12.5px;color:#1f2937;max-width:280px;line-height:1.45';
    tip.innerHTML = '<div style="font-weight:800;font-size:12px;color:#0f2740;margin-bottom:3px">' + header + '</div>' + bodyHtml +
      '<button type="button" title="Закрыть" style="position:absolute;top:4px;right:7px;border:none;background:none;cursor:pointer;font-size:15px;color:#64748b;font-family:inherit;line-height:1">×</button>';
    document.body.appendChild(tip);
    var x = null, y = null;
    try {
      var pos = (evt && evt.get) ? evt.get('position') : null;
      if (pos && isFinite(pos[0]) && isFinite(pos[1])) { x = pos[0]; y = pos[1]; }
    } catch (e) {}
    var mapEl = document.getElementById('om-map');
    if (x == null && mapEl) {
      var r = mapEl.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.bottom - 90;
    }
    if (x == null) { x = window.innerWidth / 2; y = window.innerHeight - 120; }
    var w = tip.offsetWidth || 240, h = tip.offsetHeight || 70;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2));
    y = Math.max(8, y - h - 16);
    if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
    tip.querySelector('button').addEventListener('click', function (e) { e.stopPropagation(); omHideTip(); });
    setTimeout(function () { // клик в другом месте закрывает
      function closer(ev) { if (ev && ev.target && tip.contains(ev.target)) return; omHideTip(); document.removeEventListener('click', closer, true); }
      document.addEventListener('click', closer, true);
    }, 60);
    if (omState.tipTimer) clearTimeout(omState.tipTimer);
    omState.tipTimer = setTimeout(omHideTip, 15000); // автоскрытие
  }

