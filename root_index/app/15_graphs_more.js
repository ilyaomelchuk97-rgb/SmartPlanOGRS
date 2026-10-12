  /* ── часть 15 · app/15_graphs_more.js — график работ: трудоёмкость, сезоны, копии графика, печать, Excel ── */
  /* =====================================================================
     22.09-196: ТРУДОЁМКОСТЬ ПО ОБЪЕКТАМ
     Кнопка «📍 По объектам» в «Трудоёмкости графика» открывает
     отдельное окно (второй слой, поверх): выбор года и показа — весь год /
     один месяц / произвольный период месяцев. Список объектов графика с
     проведениями и часами за выбранный период; нажатие на объект — его
     карточка: трудоёмкость по каждой работе и даты проведений периода.
     ===================================================================== */
  function gloDefaults(g) {
    if (S.gloYear == null) S.gloYear = +g.year;
    if (!S.gloMode) S.gloMode = 'year';
    if (S.gloMonth == null) S.gloMonth = TODAY.getMonth() + 1;
    if (S.gloMFrom == null) S.gloMFrom = 1;
    if (S.gloMTo == null) S.gloMTo = 12;
    if (S.gloRi == null) S.gloRi = -1;
  }
  // Годы, которые реально встречаются в проведениях графика (+ год графика)
  function gloYears(g) {
    var ys = {}; ys[String(g.year)] = 1;
    (g.objs || []).forEach(function (ob) {
      gwObjWorks(ob).forEach(function (wrk) {
        (wrk.occs || []).forEach(function (oc) {
          var d = String(oc && oc.date || '');
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) ys[d.slice(0, 4)] = 1;
        });
      });
    });
    return Object.keys(ys).map(function (x) { return parseInt(x, 10); }).sort(function (a, b) { return a - b; });
  }
  // Диапазон месяцев по режиму показа
  function gloRange() {
    if (S.gloMode === 'month') return { from: S.gloMonth, to: S.gloMonth };
    if (S.gloMode === 'period') return { from: Math.min(S.gloMFrom, S.gloMTo), to: Math.max(S.gloMFrom, S.gloMTo) };
    return { from: 1, to: 12 };
  }
  function gloPeriodLabel() {
    var rg = gloRange();
    if (S.gloMode === 'month') return MONTHS_RU[S.gloMonth - 1] + ' ' + S.gloYear;
    if (S.gloMode === 'period') return MONTHS_RU[rg.from - 1] + ' — ' + MONTHS_RU[rg.to - 1] + ' ' + S.gloYear;
    return 'Весь ' + S.gloYear + ' год';
  }
  // Даты проведений одной серии (работы объекта) внутри периода
  function gloOccDates(wrk, y, mFrom, mTo) {
    var dates = [];
    (wrk.occs || []).forEach(function (oc) {
      var d = String(oc && oc.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (parseInt(d.slice(0, 4), 10) !== y) return;
      var mi = parseInt(d.slice(5, 7), 10);
      if (mi < mFrom || mi > mTo) return;
      dates.push(d);
    });
    dates.sort();
    return dates;
  }
  function gloWorkNorm(area, wid) {
    var w = null;
    try { w = wid ? WORK.getWork(area, wid) : null; } catch (eW) {}
    return { name: w ? w.name : (wid || '?'), norm: (w && isFinite(+w.norm) && +w.norm > 0) ? +w.norm : 0 };
  }
  // Работы объекта с проведениями в периоде: [{name, norm, dates}]
  function gloObjStats(ob, area, y, mFrom, mTo) {
    var rows = [];
    gwObjWorks(ob).forEach(function (wrk) {
      var wn = gloWorkNorm(area, wrk.wid);
      var dates = gloOccDates(wrk, y, mFrom, mTo);
      if (dates.length) rows.push({ name: wn.name, norm: wn.norm, dates: dates });
    });
    return rows;
  }

  function openGraphLaborObjsModal() {
    var g = graphsFind(GS.cur);
    if (!g) { toast('err', 'Сначала создайте или выберите график'); return; }
    S.gloYear = null; S.gloMode = null; S.gloMonth = null; S.gloMFrom = null; S.gloMTo = null; S.gloRi = -1; // каждый вход — настройки по умолчанию
    gloRender();
  }

  function gloRender() {
    var overlay2 = document.getElementById('overlay2'), modal2 = document.getElementById('modal2');
    if (!overlay2 || !modal2) return;
    var g = graphsFind(GS.cur);
    if (!g) { overlay2.classList.remove('show'); return; }
    gloDefaults(g);
    var area = graphAreaDefault(g);
    var years = gloYears(g);
    if (years.indexOf(S.gloYear) === -1) S.gloYear = +g.year;
    var rng = gloRange();
    var selCss = 'padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;font-family:inherit;background:var(--card);color:var(--ink)';

    var h = '<div class="modal-h"><h3>📍 Трудоёмкость по объектам · ' + esc(g.name || 'Без названия') + '</h3><button class="x" data-action="close-modal2">×</button></div>';
    h += '<div class="modal-b">';
    // ---- Панель выбора периода ----
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:12px">';
    h += '<label style="font-size:12px;font-weight:700;color:var(--muted)">Год:</label><select id="glo-year" style="' + selCss + '">';
    years.forEach(function (y) { h += '<option value="' + y + '"' + (y === S.gloYear ? ' selected' : '') + '>' + y + '</option>'; });
    h += '</select>';
    h += '<label style="font-size:12px;font-weight:700;color:var(--muted)">Показ:</label><select id="glo-mode" style="' + selCss + '">' +
      '<option value="year"' + (S.gloMode === 'year' ? ' selected' : '') + '>Весь год</option>' +
      '<option value="month"' + (S.gloMode === 'month' ? ' selected' : '') + '>Месяц</option>' +
      '<option value="period"' + (S.gloMode === 'period' ? ' selected' : '') + '>Период месяцев</option></select>';
    if (S.gloMode === 'month') {
      h += '<select id="glo-month" style="' + selCss + '">';
      MONTHS_RU.forEach(function (mn, i) { h += '<option value="' + (i + 1) + '"' + ((i + 1) === S.gloMonth ? ' selected' : '') + '>' + mn + '</option>'; });
      h += '</select>';
    }
    if (S.gloMode === 'period') {
      h += '<span style="font-size:12px;font-weight:700;color:var(--muted)">с</span><select id="glo-mfrom" style="' + selCss + '">';
      MONTHS_RU.forEach(function (mn, i) { h += '<option value="' + (i + 1) + '"' + ((i + 1) === S.gloMFrom ? ' selected' : '') + '>' + mn + '</option>'; });
      h += '</select><span style="font-size:12px;font-weight:700;color:var(--muted)">по</span><select id="glo-mto" style="' + selCss + '">';
      MONTHS_RU.forEach(function (mn, i) { h += '<option value="' + (i + 1) + '"' + ((i + 1) === S.gloMTo ? ' selected' : '') + '>' + mn + '</option>'; });
      h += '</select>';
    }
    h += '<span style="font-size:12px;color:#166534;font-weight:800">📅 ' + esc(gloPeriodLabel()) + '</span>';
    h += '</div>';

    // ---- Содержимое: список объектов ИЛИ карточка одного объекта ----
    if (S.gloRi == null || S.gloRi < 0 || S.gloRi >= (g.objs || []).length) {
      var totOcc = 0, totH = 0, rowsHtml = '';
      (g.objs || []).forEach(function (ob, ri) {
        var stats = gloObjStats(ob, area, S.gloYear, rng.from, rng.to);
        var oh = 0, oocc = 0;
        stats.forEach(function (r) { oocc += r.dates.length; oh += r.norm * r.dates.length; });
        totOcc += oocc; totH += oh;
        rowsHtml += '<tr data-action="graphs-labor-obj" data-ri="' + ri + '" style="cursor:pointer">' +
          '<td style="' + graphsLaborCellCss(false) + 'text-align:left;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Нажмите — карточка объекта: трудоёмкость по работам за период «' + esc(gloPeriodLabel()) + '»"><span class="chip ' + esc(ob.type) + '" style="margin-right:6px">' + esc(ob.type) + '</span>' + esc(ob.name || '') + ' <span style="color:var(--muted);font-weight:600;font-size:12px">→</span></td>' +
          '<td style="' + graphsLaborCellCss(false) + '">' + stats.length + '</td>' +
          '<td style="' + graphsLaborCellCss(false) + '">' + oocc + '</td>' +
          '<td style="' + graphsLaborCellCss(false) + '"><b>' + fmtH3(oh) + '</b></td></tr>';
      });
      h += '<table style="' + graphsLaborTableCss() + '"><tr>' +
        '<th style="' + graphsLaborCellCss(true) + '">Объект (нажмите — его карточка)</th>' +
        '<th style="' + graphsLaborCellCss(true) + 'text-align:right">Видов работ</th>' +
        '<th style="' + graphsLaborCellCss(true) + 'text-align:right">Проведений</th>' +
        '<th style="' + graphsLaborCellCss(true) + 'text-align:right">Трудоёмкость, чел/ч</th></tr>' +
        rowsHtml +
        '<tr style="font-weight:800;background:#f0fdf4"><td style="' + graphsLaborCellCss(false) + 'text-align:left">ИТОГО · ' + esc(gloPeriodLabel()) + '</td>' +
          '<td style="' + graphsLaborCellCss(false) + '"></td>' +
          '<td style="' + graphsLaborCellCss(false) + '">' + totOcc + '</td>' +
          '<td style="' + graphsLaborCellCss(false) + '">' + fmtH3(totH) + '</td></tr></table>';
      h += '<div style="font-size:12.5px;color:var(--muted);margin-top:8px;line-height:1.5">Проведения берутся из треугольников графика (и плановые, и отмеченные выполненными); часы одного проведения = норма работы из справочника «Виды работ».</div>';
    } else {
      var ob = g.objs[S.gloRi];
      var stats2 = gloObjStats(ob, area, S.gloYear, rng.from, rng.to);
      h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
        '<button type="button" class="btn sm" data-action="graphs-labor-back">← Назад к объектам</button>' +
        '<span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span>' +
        '<span style="font-weight:800;font-size:14px" title="' + esc(ob.name || '') + '">' + esc(ob.name || '') + '</span>' +
        '<span style="font-size:12px;color:var(--muted);font-weight:700">📅 ' + esc(gloPeriodLabel()) + '</span></div>';
      var dh = 0, docc = 0;
      stats2.forEach(function (r) { docc += r.dates.length; dh += r.norm * r.dates.length; });
      if (!stats2.length) {
        h += '<div class="empty" style="padding:16px;font-size:13px">За период «' + esc(gloPeriodLabel()) + '» у этого объекта проведений нет — смените год, месяц или период выше.</div>';
      } else {
        h += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:9px 12px;font-size:13px;display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">' +
          '<span>видов работ: <b>' + stats2.length + '</b></span><span>проведений: <b>' + docc + '</b></span><span>трудоёмкость: <b style="color:#15803d;font-size:15px">' + fmtH3(dh) + ' чел/ч</b></span></div>';
        h += '<table style="' + graphsLaborTableCss() + '"><tr>' +
          '<th style="' + graphsLaborCellCss(true) + '">Вид работ</th>' +
          '<th style="' + graphsLaborCellCss(true) + 'text-align:right">ч/ед</th>' +
          '<th style="' + graphsLaborCellCss(true) + 'text-align:right">Проведений</th>' +
          '<th style="' + graphsLaborCellCss(true) + 'text-align:left">Даты проведения</th>' +
          '<th style="' + graphsLaborCellCss(true) + 'text-align:right">Чел/ч</th></tr>';
        stats2.forEach(function (r) {
          var dts = r.dates.map(fmtDmyIso).join(', ');
          h += '<tr><td style="' + graphsLaborCellCss(false) + 'text-align:left;max-width:420px">' + esc(r.name) + (r.norm ? '' : ' <span style="color:#b45309;font-size:12px" title="Норма не задана в справочнике — часы не учтены">⚠ без нормы</span>') + '</td>' +
            '<td style="' + graphsLaborCellCss(false) + '">' + (r.norm ? fmtH3(r.norm) : '—') + '</td>' +
            '<td style="' + graphsLaborCellCss(false) + '">' + r.dates.length + '</td>' +
            '<td style="' + graphsLaborCellCss(false) + 'text-align:left;font-size:12.5px;color:var(--muted)">' + esc(dts) + '</td>' +
            '<td style="' + graphsLaborCellCss(false) + '"><b>' + fmtH3(r.norm * r.dates.length) + '</b></td></tr>';
        });
        h += '</table>';
      }
    }
    h += '</div>';
    h += '<div class="modal-f"><button type="button" class="btn" data-action="close-modal2">Закрыть</button></div>';
    modal2.innerHTML = h;
    modal2.style.width = '86%'; modal2.style.maxWidth = '86%';
    overlay2.classList.add('show');
    // Слушатели выбора периода: смена — перерисовка окна (с возвратом из карточки к списку)
    function gloOn(id, fn) { var s = document.getElementById(id); if (s) s.addEventListener('change', function () { fn(s.value); S.gloRi = -1; gloRender(); }); }
    gloOn('glo-year', function (v) { S.gloYear = parseInt(v, 10) || S.gloYear; });
    gloOn('glo-mode', function (v) { S.gloMode = v || 'year'; });
    gloOn('glo-month', function (v) { S.gloMonth = parseInt(v, 10) || 1; });
    gloOn('glo-mfrom', function (v) { S.gloMFrom = parseInt(v, 10) || 1; });
    gloOn('glo-mto', function (v) { S.gloMTo = parseInt(v, 10) || 12; });
  }

  function openGraphFilterModal() {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x) { if (x.id === GS.cur) g = x; });
    if (!g || !g.objs || !g.objs.length) { toast('err', 'Добавьте объекты в график'); return; }
    var state = g.objs.map(function (ob) { return !ob.hide; });
    var typeOpts = '<option value="">Все типы</option>';
    OBJ_GAS_TYPES.forEach(function (t) { typeOpts += '<option value="' + t + '">' + t + '</option>'; });
    var h = '<div class="modal-h"><h3>Фильтр графика</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    h += '<div class="fld"><label>Тип объекта</label><select id="gf-type">' + typeOpts + '</select></div>';
    h += '<div class="fld"><label>Наименование / номер</label><input id="gf-q" placeholder="Поиск по объектам…"></div>';
    h += '</div>';
    h += '<div style="display:flex;gap:8px;margin-bottom:6px"><button type="button" class="btn sm" id="gf-all">Включить все</button><button type="button" class="btn sm" id="gf-none">Отключить найденные</button></div>';
    h += '<div id="gf-list" style="display:flex;flex-direction:column;gap:5px;max-height:46vh;overflow-y:auto;padding:2px"></div>';
    h += '<div class="calc" style="font-size:12px">Фильтр скрывает объекты в таблицах графика. Запланированные работы и задачи в планировании не затрагиваются.</div>';
    h += '</div>';
    h += '<div class="modal-f"><button type="button" class="btn ok" data-action="graphs-filter-save">Сохранить</button><button type="button" class="btn danger" data-action="close-modal">Отмена</button></div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '560px';
    overlay.classList.add('show');
    function listFilter() {
      var t = (document.getElementById('gf-type') || {}).value || '';
      var q = ((document.getElementById('gf-q') || {}).value || '').toLowerCase().trim();
      return function (ob) {
        if (t && ob.type !== t) return false;
        if (q && (ob.name || '').toLowerCase().indexOf(q) === -1) return false;
        return true;
      };
    }
    function draw() {
      var box = document.getElementById('gf-list');
      if (!box) return;
      var f = listFilter();
      var h2 = '';
      var shown = 0;
      g.objs.forEach(function (ob, ri) {
        if (!f(ob)) return;
        shown++;
        h2 += '<label class="gao-row">' +
          '<input type="checkbox" data-gf="' + ri + '"' + (state[ri] ? ' checked' : '') + ' style="accent-color:#16a34a;width:15px;height:15px;cursor:pointer;flex:0 0 auto;margin:0">' +
          '<span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span>' +
          '<span style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(ob.name) + '">' + esc(ob.name) + '</span>' +
          '</label>';
      });
      box.innerHTML = shown ? h2 : '<div class="empty" style="padding:20px 12px;font-size:12.5px">Нет объектов по фильтру</div>';
      var inputs = box.querySelectorAll('input[data-gf]');
      for (var i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('change', function (e) { state[parseInt(e.target.getAttribute('data-gf'), 10)] = e.target.checked; });
      }
    }
    draw();
    var tSel = document.getElementById('gf-type');
    if (tSel) tSel.addEventListener('change', draw);
    var qInp = document.getElementById('gf-q');
    if (qInp) qInp.addEventListener('input', draw);
    var allBtn = document.getElementById('gf-all');
    if (allBtn) allBtn.addEventListener('click', function () { for (var i = 0; i < state.length; i++) state[i] = true; draw(); });
    var noneBtn = document.getElementById('gf-none');
    if (noneBtn) noneBtn.addEventListener('click', function () {
      var f = listFilter();
      g.objs.forEach(function (ob, ri) { if (f(ob)) state[ri] = false; });
      draw();
    });
    GS.filterState = state;
  }
  function graphsFilterSave() {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x) { if (x.id === GS.cur) g = x; });
    if (!g || !g.objs) { overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
    var state = GS.filterState;
    if (!state || state.length !== g.objs.length) state = g.objs.map(function () { return true; });
    g.objs.forEach(function (ob, ri) { ob.hide = !state[ri]; });
    graphsSaveList(list);
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    var hidden = g.objs.filter(function (o) { return o.hide; }).length;
    toast('ok', 'Фильтр применён: скрыто объектов ' + hidden + ' из ' + g.objs.length + ' — работы не затронуты');
    if (S.screen === 'graphs') renderGraphs();
  }

  /* ===== НАСТРОЙКА ПЕРИОДОВ графика (22.09-121): зимний период «с даты по
     дату». Хранится в графике как g.winter = { from:'MM-DD', to:'MM-DD' } —
     год не важен, период ежегодный, можно через Новый год (с 15.10 по 15.04).
     Зимние дни подсвечиваются голубым в таблицах графика. */
  function openGraphWinterModal() {
    var g = graphsFind(GS.cur);
    if (!g) { toast('err', 'Сначала создайте или выберите график'); return; }
    var y = g.year || new Date().getFullYear();
    var wf = g.winter && g.winter.from ? y + '-' + g.winter.from : '';
    var wt = g.winter && g.winter.to ? y + '-' + g.winter.to : '';
    var h = '<div class="modal-h"><h3>Сезоны</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div style="font-size:13.5px;font-weight:800;color:#0369a1;margin-bottom:10px">❄️ Зимний период</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    h += '<div class="fld"><label>Дата с</label><input type="date" id="gw-winter-from"' + (wf ? ' value="' + wf + '"' : '') + '></div>';
    h += '<div class="fld"><label>Дата по</label><input type="date" id="gw-winter-to"' + (wt ? ' value="' + wt + '"' : '') + '></div>';
    h += '</div>';
    h += '<label class="cb" style="font-size:12.5px;color:#0369a1;margin-top:4px;align-items:flex-start"><input type="checkbox" id="gw-season-sync" checked style="margin-top:2px"> Привести сезон работ графика к периоду: на зимние даты — зимние версии работ (то же название и сезон «Зима» в справочнике), на остальные даты — обычные версии. Уже выполненные работы не затрагиваются.</label>';
    h += '<div class="calc" style="font-size:12px;align-items:flex-start">Учитываются только день и месяц — период повторяется каждый год. Допускается переход через Новый год: например, с 15.10 по 15.04 — это 15.10–31.12 и 01.01–15.04. Дни периода подсвечиваются голубым в таблице графика и в таблице по дням месяца. Зимние работы (сезон «Зима» в карточке работы) в автоподбор не попадают — их можно назначить вручную кнопкой «+ работа».</div>';
    h += '</div>';
    h += '<div class="modal-f"><button type="button" class="btn ok" data-action="graphs-winter-save">Сохранить</button><button type="button" class="btn" data-action="graphs-winter-clear">Очистить период</button><button type="button" class="btn danger" data-action="close-modal">Отмена</button></div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '560px';
    overlay.classList.add('show');
  }
  function graphsWinterSave() {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x) { if (x.id === GS.cur) g = x; });
    if (!g) { overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
    var fi = document.getElementById('gw-winter-from');
    var ti = document.getElementById('gw-winter-to');
    var fv = fi && fi.value ? fi.value : '';
    var tv = ti && ti.value ? ti.value : '';
    if (!fv || !tv) { toast('err', 'Укажите обе даты — или нажмите «Очистить период»'); return; }
    g.winter = { from: fv.slice(5), to: tv.slice(5) };
    // 22.09-122: сезонные версии одинаковых работ — зимние даты = зимние версии
    var seasonMsg = '';
    var syncEl = document.getElementById('gw-season-sync');
    if (!syncEl || syncEl.checked) {
      var syncRes = null;
      try { syncRes = gwSeasonSync(g, g.area || graphAreaDefault(g)); } catch (eSync) {}
      if (syncRes && (syncRes.toWinter || syncRes.toSummer)) {
        seasonMsg = ' · сезон: на зимние версии — ' + syncRes.toWinter + ', на обычные — ' + syncRes.toSummer + (syncRes.tasks ? ' (задач в планировании обновлено: ' + syncRes.tasks + ')' : '');
      }
    }
    graphsSaveList(list);
    if (TASKS_DB) S.tasks = TASKS_DB.getTasks();
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    logAction('Настройка периодов графика', (g.name || '') + ': зима с ' + gwMdRu(g.winter.from) + ' по ' + gwMdRu(g.winter.to) + seasonMsg);
    toast('ok', '❄️ Зимний период: с ' + gwMdRu(g.winter.from) + ' по ' + gwMdRu(g.winter.to) + ' — зимние дни подсвечены голубым' + seasonMsg);
    if (S.screen === 'graphs') renderGraphs();
  }
  function graphsWinterClear() {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x) { if (x.id === GS.cur) g = x; });
    if (!g) { overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
    delete g.winter;
    graphsSaveList(list);
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    logAction('Настройка периодов графика', (g.name || '') + ': зимний период очищен');
    toast('ok', 'Зимний период очищен');
    if (S.screen === 'graphs') renderGraphs();
  }

  /* ===== УДАЛЕНИЕ ВСЕХ ЗАПЛАНИРОВАННЫХ РАБОТ ГРАФИКА ===== */
  function openGraphDelWorksModal() {
    var g = graphsFind(GS.cur);
    if (!g) return;
    var h = '<div class="modal-h"><h3>Удалить работы?</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b"><div style="font-size:13px;color:var(--ink);line-height:1.6">Вы точно хотите удалить все запланированные работы по данному графику?</div></div>';
    h += '<div class="modal-f"><button type="button" class="btn" data-action="close-modal">Отмена</button><button type="button" class="btn danger" data-action="graphs-delworks-confirm">Удалить</button></div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '460px';
    overlay.classList.add('show');
  }
  function graphsDeleteAllWorks() {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x) { if (x.id === GS.cur) g = x; });
    if (!g || !g.objs) { overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
    var removed = 0;
    g.objs.forEach(function (ob) {
      gwObjWorks(ob).forEach(function (wrk) {
        (wrk.occs || []).forEach(function (oc) { if (oc.tid && TASKS_DB) { TASKS_DB.hardDeleteTask(oc.tid); removed++; } });
      });
      ob.works = [];
      // 22.09-138: общий набор работ объекта тоже очищаем — работы сняты с
      // объекта. Другие графики сохраняют уже рассчитанные даты до их
      // пересохранения (их строки тут не трогаем).
      try { graphObjWorksCfgSave(ob.oid, []); } catch (e) {}
    });
    graphsSaveList(list);
    if (TASKS_DB) S.tasks = TASKS_DB.getTasks();
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    logAction('Удалены работы графика', g.name + ': задач ' + removed);
    toast('ok', 'Все запланированные работы графика удалены (задач: ' + removed + '). Объекты сохранены в графике.');
    if (S.screen === 'graphs') renderGraphs();
    else if (S.screen === 'calendar') drawCalendarGrid();
  }

  /* ===== ПЕЧАТЬ ГРАФИКА: окно свойств печати ===== */
  /* Треугольники (выполненные — квадраты с крестиком), наименования работ
     и даты проведения — включаются/выключаются. Сверху над месяцами — год. */
  /* 22.09-226: КОПИИ ГРАФИКА ПРИ ПЕЧАТИ.
     Каждое открытие печати («Печать графика» на панели или «Распечатать» в окнах
     объекта/месяца) сохраняет ПОЛНУЮ копию графика локально (до 20 последних на
     график). Кнопка «Копии» (справа от «Обозначения работ») — список сохранений,
     просмотр копии и кнопка «Применить» (восстановить текущий график из копии;
     задачи в планировании при этом НЕ пересоздаются). */
  var GRAPH_SNAPS_KEY = 'smartplan_graph_snaps_v1';
  // 22.09-239: последний выданный номер итерации по каждому графику — при удалении копий НЕ уменьшается,
  // поэтому номер удалённой копии повторно не выдаётся («Четвёртая итерация» после удалённой «Третьей»)
  var GRAPH_SNAPS_ITER_KEY = 'smartplan_graph_snaps_iter_v1';
  function graphSnapsIssuedGet(id) {
    try { var m = JSON.parse(localStorage.getItem(GRAPH_SNAPS_ITER_KEY) || '{}'); return +m[id] || 0; } catch (e) { return 0; }
  }
  function graphSnapsIssuedSet(id, n) {
    try {
      var m = JSON.parse(localStorage.getItem(GRAPH_SNAPS_ITER_KEY) || '{}');
      if (!(+m[id] >= n)) { m[id] = n; localStorage.setItem(GRAPH_SNAPS_ITER_KEY, JSON.stringify(m)); }
    } catch (e) {}
  }
  /* 22.09-239: удалять копии графика могут старший мастер, начальник участка и администратор */
  function canDeleteGraphSnaps() { return S.role === 'admin' || S.role === 'nach' || S.role === 'smaster'; }
  /* 22.09-236: подпись копии по порядку сохранения — «Первая итерация», «Вторая итерация», …,
     «Двадцать первая итерация», … «Сто двадцать третья итерация» (женский род; после 999 — «N-я итерация»). */
  function snapIterLabel(n) {
    n = Math.floor(+n || 0);
    if (n < 1) return 'Итерация';
    var U = ['', 'первая', 'вторая', 'третья', 'четвёртая', 'пятая', 'шестая', 'седьмая', 'восьмая', 'девятая'];
    var T1 = ['десятая', 'одиннадцатая', 'двенадцатая', 'тринадцатая', 'четырнадцатая', 'пятнадцатая', 'шестнадцатая', 'семнадцатая', 'восемнадцатая', 'девятнадцатая'];
    var TO = ['', '', 'двадцатая', 'тридцатая', 'сороковая', 'пятидесятая', 'шестидесятая', 'семидесятая', 'восьмидесятая', 'девяностая'];
    var TC = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    var HO = ['', 'сотая', 'двухсотая', 'трёхсотая', 'четырёхсотая', 'пятисотая', 'шестисотая', 'семисотая', 'восьмисотая', 'девятисотая'];
    var HC = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
    var w;
    if (n > 999) w = n + '-я';
    else {
      var h = Math.floor(n / 100), r = n % 100, t = Math.floor(r / 10), u = r % 10;
      if (!r) w = HO[h];
      else {
        var pre = h ? HC[h] + ' ' : '';
        if (r < 10) w = pre + U[r];
        else if (r < 20) w = pre + T1[r - 10];
        else w = pre + (u ? TC[t] + ' ' + U[u] : TO[t]);
      }
    }
    return w.charAt(0).toUpperCase() + w.slice(1) + ' итерация';
  }
  /* 22.09-236: наибольший номер итерации среди копий графика */
  function graphSnapsMaxIter(arr) {
    var mx = 0;
    (arr || []).forEach(function (sn) { if (sn && +sn.iter > mx) mx = +sn.iter; });
    return mx;
  }
  /* 22.09-236: копиям без номера (сохранены до сборки 236) — номера по времени сохранения:
     самая ранняя — «Первая итерация». Уже пронумерованные копии не меняются. */
  function graphSnapsNumber(arr) {
    var next = graphSnapsMaxIter(arr);
    (arr || []).filter(function (sn) { return sn && !(+sn.iter > 0); })
      .sort(function (x, y) { return (+x.ts || 0) - (+y.ts || 0); })
      .forEach(function (sn) { sn.iter = ++next; });
    return arr;
  }
  function graphSnapsLoad(id) {
    try {
      var all = JSON.parse(localStorage.getItem(GRAPH_SNAPS_KEY) || '{}');
      var a = all[id];
      if (!Array.isArray(a)) return [];
      // 22.09-236: старые копии без номера — пронумеровать один раз и сохранить (номера больше не меняются)
      if (a.some(function (sn) { return sn && !(+sn.iter > 0); })) {
        graphSnapsNumber(a);
        all[id] = a;
        try { localStorage.setItem(GRAPH_SNAPS_KEY, JSON.stringify(all)); } catch (eW) {}
      }
      return a;
    } catch (e) { return []; }
  }
  function graphSnapsSaveList(id, arr) {
    try { var all = JSON.parse(localStorage.getItem(GRAPH_SNAPS_KEY) || '{}'); all[id] = arr; localStorage.setItem(GRAPH_SNAPS_KEY, JSON.stringify(all)); } catch (e) {}
  }
  function _snapDT(ts) { try { var d = new Date(ts); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { return '—'; } }
  function graphSnapSave(g, via) {
    if (!g || !g.id) return null;
    try {
      var arr = graphSnapsLoad(g.id);
      var objs = g.objs || [];
      var worksCnt = 0;
      objs.forEach(function (ob) { worksCnt += (gwObjWorks(ob) || []).length; });
      var snap = {
        id: 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
        ts: Date.now(), via: via || 'печать',
        iter: Math.max(graphSnapsMaxIter(arr), graphSnapsIssuedGet(g.id)) + 1, // 22.09-236/239: порядковый номер копии — «Первая итерация», «Вторая итерация», … (номера удалённых копий не повторяются)
        name: g.name, year: g.year, respName: g.respName || '',
        objsCount: objs.length, worksCount: worksCnt,
        graph: JSON.parse(JSON.stringify(g))
      };
      arr.unshift(snap);
      if (arr.length > 20) arr.length = 20;
      graphSnapsSaveList(g.id, arr);
      graphSnapsIssuedSet(g.id, snap.iter); // 22.09-239
      try { graphSnapsPush(); } catch (eP) {} // 22.09-242: сразу на сервер (без связи — позже, автоматически)
      return snap;
    } catch (e) { return null; }
  }
  function graphSnapById(sid) {
    var g = graphsFind(GS.cur); if (!g) return null;
    var arr = graphSnapsLoad(g.id);
    for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === sid) return arr[i];
    return null;
  }
  /* ===== 22.09-242: КОПИИ ГРАФИКОВ НА СЕРВЕРЕ (общие для всех устройств) =====
     В браузере — только список копий (подписи); сам график копии после отправки на сервер
     в браузере НЕ хранится (лимит памяти браузера ~5 МБ) — подгружается при открытии.
     Копии без пометки remote (новые или сохранённые до сборки 242) отправляются на сервер
     автоматически; номер итерации выдаёт сервер — общий для всех устройств. */
  var GRAPH_SNAP_MEM = {};   // id копии → её график, загруженный с сервера (на время сеанса)
  var _snapPushP = null; // идущая отправка (повторный вызов ждёт её и досылает новое)
  function snapApiOk() { return !!(window.SP_API && SP_API.getToken && SP_API.getToken() && SP_API.snapPut); }
  function graphSnapsAllIds() {
    try { return Object.keys(JSON.parse(localStorage.getItem(GRAPH_SNAPS_KEY) || '{}')); } catch (e) { return []; }
  }
  /* отправить на сервер все неотправленные копии (всех графиков), по порядку — старые раньше */
  function graphSnapsPush() {
    if (!snapApiOk()) return Promise.resolve(0);
    if (_snapPushP) return _snapPushP.then(function () { return graphSnapsPush(); }); // дождаться идущей и дослать новые
    var jobs = [];
    graphSnapsAllIds().forEach(function (gid) {
      graphSnapsLoad(gid).forEach(function (sn) { if (sn && !sn.remote && sn.graph) jobs.push({ gid: gid, sn: sn }); });
    });
    if (!jobs.length) return Promise.resolve(0);
    jobs.sort(function (a, b) { return (+a.sn.ts || 0) - (+b.sn.ts || 0); });
    var sent = 0, chain = Promise.resolve();
    jobs.forEach(function (j) {
      chain = chain.then(function () {
        var sn = j.sn;
        return SP_API.snapPut({
          id: sn.id, gid: j.gid, iter: sn.iter, ts: sn.ts, via: sn.via,
          meta: { name: sn.name, year: sn.year, respName: sn.respName, objsCount: sn.objsCount, worksCount: sn.worksCount },
          graph: sn.graph
        }).then(function (r) {
          if (!r || !r.ok) return;
          var arr = graphSnapsLoad(j.gid); // список мог измениться, пока шла отправка
          arr.forEach(function (x) {
            if (x && x.id === sn.id) {
              if (+r.iter > 0) x.iter = +r.iter; // номер, выданный сервером
              x.remote = true;
              if (x.graph) GRAPH_SNAP_MEM[x.id] = x.graph; // в этом сеансе — без повторной загрузки
              delete x.graph;                               // в браузере — только подпись копии
            }
          });
          graphSnapsSaveList(j.gid, arr);
          if (+r.iter > 0) graphSnapsIssuedSet(j.gid, +r.iter);
          sent++;
        });
      });
    });
    _snapPushP = chain.then(function () { _snapPushP = null; return sent; }, function () { _snapPushP = null; return sent; });
    return _snapPushP;
  }
  /* подтянуть с сервера список копий графика: копии с других устройств, номера, удалённые */
  function graphSnapsSync(gid) {
    if (!gid || !snapApiOk() || !SP_API.snapsList) return Promise.resolve(false);
    return graphSnapsPush().then(function () { return SP_API.snapsList(gid); }).then(function (r) {
      if (!r || !r.ok || !Array.isArray(r.records)) return false;
      var local = graphSnapsLoad(gid);
      var byId = {};
      local.forEach(function (x) { if (x && x.id) byId[x.id] = x; });
      var onSrv = {}, out = [];
      r.records.forEach(function (mt) {
        onSrv[mt.id] = 1;
        var x = byId[mt.id] || {};
        if (x.graph) GRAPH_SNAP_MEM[mt.id] = x.graph;
        out.push({ id: mt.id, ts: +mt.ts || x.ts, via: mt.via || x.via || '', iter: +mt.iter || x.iter,
          name: mt.name, year: mt.year, respName: mt.respName, objsCount: mt.objsCount, worksCount: mt.worksCount, remote: true });
      });
      // ещё не отправленные — остаются; отправленные, но удалённые на сервере (или вытесненные) — убираем
      local.forEach(function (x) { if (x && !x.remote && !onSrv[x.id]) out.push(x); });
      out.sort(function (a, b) { return (+b.ts || 0) - (+a.ts || 0); });
      graphSnapsSaveList(gid, out);
      if (+r.last_iter > 0) graphSnapsIssuedSet(gid, +r.last_iter);
      return true;
    }, function () { return false; });
  }
  /* копия целиком (с графиком): из браузера, из памяти сеанса или с сервера */
  function graphSnapFetch(sid, cb) {
    var sn = graphSnapById(sid);
    if (!sn) { toast('err', 'Копия не найдена'); return; }
    if (sn.graph) { cb(sn); return; }
    if (GRAPH_SNAP_MEM[sid]) { cb(Object.assign({}, sn, { graph: JSON.parse(JSON.stringify(GRAPH_SNAP_MEM[sid])) })); return; }
    if (!snapApiOk() || !SP_API.snapGet) { toast('err', 'Копия хранится на сервере — сейчас нет связи с сервером'); return; }
    toast('ok', '⏳ Загружаю копию с сервера…');
    SP_API.snapGet(sid).then(function (r) {
      if (!r || !r.ok || !r.record || !r.record.graph) { toast('err', 'Не удалось загрузить копию с сервера' + (r && r.err ? ': ' + r.err : '')); return; }
      GRAPH_SNAP_MEM[sid] = r.record.graph;
      cb(Object.assign({}, sn, { graph: JSON.parse(JSON.stringify(r.record.graph)) }));
    });
  }
  function openGraphSnapsModal(noSync) {
    var g = graphsFind(GS.cur);
    if (!g) return;
    var arr = graphSnapsLoad(g.id);
    var h = '<div class="modal-h" data-snaps-gid="' + esc(g.id) + '"><h3>♻ Копии графика «' + esc(g.name) + '»</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    // 22.09-242: копии хранятся на сервере — общие для всех устройств
    var _pend = arr.filter(function (x) { return x && !x.remote; }).length;
    h += '<div style="font-size:12.5px;margin-bottom:10px;padding:7px 10px;border-radius:8px;background:' + (_pend ? '#fffbeb;border:1px solid #fde68a;color:#92400e' : '#f0fdf4;border:1px solid #bbf7d0;color:#166534') + '">' +
      (_pend ? '⏳ Копий ещё не на сервере: ' + _pend + ' — ' + (snapApiOk() ? 'отправляются…' : 'отправятся автоматически, когда появится связь с сервером') : '☁ Копии хранятся на сервере — их видно на всех компьютерах') + '</div>';
    if (!arr.length) {
      h += '<div class="empty" style="padding:26px;text-align:center">Копий пока нет — они создаются автоматически при каждой печати графика (кнопка «Печать графика» на панели инструментов).</div>';
    } else {
      h += '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">Каждая печать графика сохраняет его полную копию. Копии подписаны по порядку сохранения: самая первая — «Первая итерация», следующая — «Вторая итерация» и так далее. Выберите копию: можно <b>предосмотреть</b> и <b>применить</b> её к текущему графику (задания в планировании при этом выстраиваются заново по датам восстановленного графика: невыполненные пересоздаются, выполненные остаются в истории, дубли не создаются; действие можно отменить кнопкой «⟲ Отмена» в календаре). Удалять копии (кнопка 🗑) могут старший мастер, начальник участка и администратор.</div>';
      var canDel = canDeleteGraphSnaps(); // 22.09-239
      arr.forEach(function (sn) {
        h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;background:var(--panel-2)">' +
          '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:12.5px;color:var(--ink)">' + esc(snapIterLabel(sn.iter)) + ' <span style="font-weight:600;color:var(--muted)">· ' + esc(_snapDT(sn.ts)) + '</span></div>' +
          '<div style="font-size:12px;color:var(--muted)">' + (sn.objsCount || 0) + ' объектов · ' + (sn.worksCount || 0) + ' видов работ · ' + esc(String(sn.year || '')) + ' год' + (sn.respName ? ' · ' + esc(sn.respName) : '') + '</div></div>' +
          '<button class="btn sm" data-action="graph-snap-preview" data-sid="' + esc(sn.id) + '" title="Открыть эту копию в виде графика (только просмотр)">👁 Просмотр</button>' +
          '<button class="btn sm primary" data-action="graph-snap-apply" data-sid="' + esc(sn.id) + '" title="Заменить текущий график этой копией (объекты, работы, периодичность, даты вхождений)">⤺ Применить</button>' +
          (canDel ? '<button class="btn sm" data-action="graph-snap-del" data-sid="' + esc(sn.id) + '" style="color:var(--red)" title="Удалить эту копию графика (безвозвратно). Сам график и задания в планировании не изменятся">🗑</button>' : '') + // 22.09-239
          '</div>';
      });
    }
    h += '</div>';
    modal.style.maxWidth = '660px'; modal.innerHTML = h; overlay.classList.add('show');
    // 22.09-242: подтянуть список с сервера (копии с других компьютеров) и перерисовать, если окно ещё открыто
    if (!noSync) {
      var _gid = g.id;
      graphSnapsSync(_gid).then(function (changed) {
        if (!changed) return;
        if (overlay.classList.contains('show') && modal.querySelector('[data-snaps-gid="' + _gid + '"]')) openGraphSnapsModal(true);
      });
    }
  }
  /* 22.09-235: обозначения работ для окна просмотра копии — только группы (и работы
     без группы), которые есть в видимых объектах копии, в цветах этой копии */
  function gwSnapLegendHtml(g) {
    var area = ''; try { area = graphAreaDefault(g); } catch (e) {}
    var seen = {}, items = [];
    (g.objs || []).forEach(function (ob) {
      if (!ob || ob.hide) return;
      gwObjWorks(ob).forEach(function (wrk) {
        var wids = [wrk.wid];
        (wrk.occs || []).forEach(function (oc) { if (oc && oc.wid) wids.push(oc.wid); });
        wids.forEach(function (wid) {
          if (!wid) return;
          var w = null; try { w = area ? WORK.getWork(area, wid) : null; } catch (e) {}
          var gp = gwWorkGroup(w);
          var k = gp ? 'grp:' + gp : 'w:' + wid;
          if (seen[k]) return;
          seen[k] = 1;
          items.push({ label: gp || (w && w.name) || wid, color: gwColorOf(g, wid) });
        });
      });
    });
    if (!items.length) return '';
    items.sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'ru'); });
    var h = '<div style="margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2)">' +
      '<div style="font-size:12.5px;font-weight:800;color:var(--ink);margin-bottom:7px">Обозначения работ</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:7px 18px;align-items:center">';
    items.forEach(function (it) {
      h += '<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#4b5563;font-weight:600">' + gwTriangle(it.color, 13) + esc(it.label) + '</span>';
    });
    h += '<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);font-weight:600">' + gwDoneMark(14) + 'выполнено</span>';
    h += '</div></div>';
    return h;
  }

  /* 22.09-235: просмотр сохранённой копии — окно ПОВЕРХ страницы, внутри — сам график:
     та же шапка (год, ответственный, наименование) и та же таблица «объекты × месяцы»
     с треугольниками, что на странице «График работ», только для просмотра
     (подсказки при наведении работают); внизу — обозначения и «⤺ Применить эту копию». */
  function openGraphSnapPreviewModal(sid) { graphSnapFetch(sid, openGraphSnapPreviewModalRender); } // 22.09-242: копия может лежать на сервере
  function openGraphSnapPreviewModalRender(sn) {
    var g = sn.graph || {};
    var overlay2 = document.getElementById('overlay2'), modal2 = document.getElementById('modal2');
    if (!overlay2 || !modal2) return;
    var objs = g.objs || [];
    var hidden = objs.filter(function (ob) { return ob && ob.hide; }).length;
    var h = '<div class="modal-h"><h3>👁 ' + esc(snapIterLabel(sn.iter)) + ' — копия графика от ' + esc(_snapDT(sn.ts)) + '</h3><button class="x" data-action="close-modal2">×</button></div>';
    // шапка — как посередине панели графика: год, ответственный, под ними наименование
    h += '<div class="gtb" style="justify-content:center"><div class="gt-mid">' +
      '<div class="gt-mid-top">' +
      '<span class="chip" style="background:#eff6ff;color:#1d4ed8">' + esc(String(g.year || '')) + '</span>' +
      (g.respName ? '<span class="chip" style="background:#f0fdf4;color:#15803d">' + esc(g.respName) + '</span>' : '') +
      '</div>' +
      '<span class="gt-name" style="max-width:none" title="' + esc(g.name || '') + '">' + esc(g.name || '—') + '</span>' +
      '</div></div>';
    h += '<div class="modal-b">';
    h += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.5">📄 Сохранённая копия (' + esc(sn.via || 'печать') + ') — <b>только просмотр</b>: так график выглядел на момент копии. Наведите на треугольник — подсказка с работами и датами. Вернуть эту копию в график — кнопка «⤺ Применить эту копию» внизу.' +
      (hidden ? ' <b>Объектов скрыто фильтром графика: ' + hidden + '</b> — в копии они есть и вернутся при применении.' : '') +
      '</div>';
    if (!objs.length) h += '<div class="empty" style="padding:30px 20px">В этой копии нет объектов.</div>';
    else h += gwYearGridHtml(g, true);
    h += gwSnapLegendHtml(g);
    h += '</div>';
    h += '<div class="modal-f" style="flex-wrap:wrap">' + // 22.09-240: на узком экране кнопки переносятся
      '<button type="button" class="btn" data-action="graph-snap-period" data-sid="' + esc(sn.id) + '" title="Открыть периодичность работ по объектам этой копии — только просмотр">🔁 Просмотр периодичности</button>' + // 22.09-238
      '<button type="button" class="btn" data-action="graph-snap-print" data-sid="' + esc(sn.id) + '" style="margin-right:auto" title="Распечатать эту копию графика (или выгрузить в Excel) — новая копия при этом не создаётся">🖨 Печать копии</button>' + // 22.09-240
      '<button type="button" class="btn primary" data-action="graph-snap-apply" data-sid="' + esc(sn.id) + '" title="Заменить текущий график этой копией (объекты, работы, периодичность, даты)">⤺ Применить эту копию</button>' +
      '<button type="button" class="btn" data-action="close-modal2">Закрыть</button>' +
      '</div>';
    modal2.innerHTML = h;
    modal2.style.width = 'min(1500px,96vw)'; modal2.style.maxWidth = '96vw'; // график — широкое окно
    overlay2.classList.add('show');
  }
  /* 22.09-238: «🔁 Просмотр периодичности» из окна копии графика — окно ПОВЕРХ (третий слой):
     периодичность этой копии по объектам, как в окне «Настроить периодичность» (объект → строки
     работ: вид работы, периодичность, отклонение, дата первого проведения) + число проведений
     в году графика. ТОЛЬКО ПРОСМОТР: полей ввода, списков и кнопок изменения нет. */
  function openGraphSnapPeriodModal(sid) { graphSnapFetch(sid, openGraphSnapPeriodModalRender); } // 22.09-242: копия может лежать на сервере
  function openGraphSnapPeriodModalRender(sn) {
    var g = sn.graph || {};
    var ov3 = document.getElementById('overlay3'), m3 = document.getElementById('modal3');
    if (!ov3 || !m3) return;
    var area = ''; try { area = graphAreaDefault(g); } catch (e) {}
    var objs = g.objs || [];
    var yr = String(g.year || '');
    var h = '<div class="modal-h"><h3>🔁 Периодичность — ' + esc(snapIterLabel(sn.iter)) + '</h3><button class="x" data-action="close-modal3">×</button></div>';
    h += '<div class="gtb" style="justify-content:center"><div class="gt-mid">' +
      '<div class="gt-mid-top">' +
      '<span class="chip" style="background:#eff6ff;color:#1d4ed8">' + esc(yr) + '</span>' +
      (g.respName ? '<span class="chip" style="background:#f0fdf4;color:#15803d">' + esc(g.respName) + '</span>' : '') +
      '</div>' +
      '<span class="gt-name" style="max-width:none" title="' + esc(g.name || '') + '">' + esc(g.name || '—') + '</span>' +
      '</div></div>';
    h += '<div class="modal-b">';
    h += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.5">📄 Копия графика от ' + esc(_snapDT(sn.ts)) + ' — <b>только просмотр</b>: так периодичность работ была настроена по объектам в этой копии. Участок (виды работ из справочника): <b>' + esc(area || '—') + '</b>. Шаг серии = периодичность МИНУС отклонение. Изменить периодичность можно в самом графике — кнопка «Настроить периодичность».</div>';
    if (!objs.length) {
      h += '<div class="empty" style="padding:26px 20px">В этой копии нет объектов.</div>';
    } else {
      h += '<div style="overflow-x:auto"><div style="min-width:660px">';
      h += '<div class="gpr-ro-cols"><span>Вид работы</span><span>Период., мес</span><span>Откл., дн</span><span>Дата первого проведения</span><span>Проведений в ' + esc(yr) + ' г.</span></div>';
      h += '<div style="display:flex;flex-direction:column;gap:10px;padding:2px">';
      objs.forEach(function (ob) {
        if (!ob) return;
        var rows = gwObjWorks(ob).filter(function (wr) { return wr && wr.wid; });
        h += '<div class="gpr-obj"><div class="gpr-obj-h">' +
          '<span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span>' +
          '<span class="gpr-obj-nm" title="' + esc(ob.name) + '">' + esc(ob.name) + '</span>' +
          (ob.pastTasks ? '<span class="gpr-past" style="cursor:default" title="В копии у объекта было включено «Добавлять задачи на прошедшие дни»">⏮ задачи и на прошедшие дни</span>' : '') +
          (ob.hide ? '<span class="gpr-past" style="cursor:default;color:#b45309" title="Объект был скрыт фильтром графика — в копии он есть">скрыт фильтром графика</span>' : '') +
          '<span class="gpr-past" style="cursor:default">работ: ' + rows.length + '</span>' +
          '</div><div class="gpr-works">';
        if (!rows.length) h += '<div class="gpr-empty">Работ не назначено</div>';
        rows.forEach(function (wrk) {
          var w = null; try { w = area ? WORK.getWork(area, wrk.wid) : null; } catch (e) {}
          var gp = gwWorkGroup(w);
          var title = gp || (w && w.name) || ('вид работы ' + wrk.wid);
          var sub = (gp && w && w.name && w.name !== gp) ? w.name : '';
          var occN = (wrk.occs || []).filter(function (oc) { return oc && String(oc.date || '').slice(0, 4) === yr; }).length;
          h += '<div class="gpr-ro-row">' +
            '<div class="gpr-inp gpr-ro" style="display:flex;align-items:center;gap:7px" title="' + esc((w && w.name) || title) + '">' + gwTriangle(gwColorOf(g, wrk.wid), 11) +
            '<div style="min-width:0"><div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(title) + '</div>' +
            (sub ? '<div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(sub) + '</div>' : '') +
            (!w ? '<div style="font-size:12px;color:#b45309">⚠ этого вида работы уже нет в справочнике участка</div>' : '') +
            '</div></div>' +
            '<div class="gpr-inp gpr-ro" style="text-align:center">' + (+wrk.period ? esc(String(wrk.period).replace('.', ',')) : '—') + '</div>' +
            '<div class="gpr-inp gpr-ro" style="text-align:center">' + (+wrk.dev ? esc(String(+wrk.dev)) : '—') + '</div>' +
            '<div class="gpr-inp gpr-ro" style="text-align:center">' + (wrk.first ? esc(fmtDmyIso(wrk.first)) : '—') + '</div>' +
            '<div class="gpr-inp gpr-ro" style="text-align:center">' + occN + '</div>' +
            '</div>';
        });
        h += '</div></div>';
      });
      h += '</div></div></div>';
    }
    h += '</div>';
    h += '<div class="modal-f"><button type="button" class="btn" data-action="close-modal3">Закрыть</button></div>';
    m3.innerHTML = h;
    m3.style.width = 'min(1000px,94vw)'; m3.style.maxWidth = '94vw';
    ov3.classList.add('show');
  }
  /* 22.09-239: удаление копии графика — старший мастер, начальник участка, администратор.
     Удаляется только копия: сам график и задания в планировании не меняются; номера
     остальных копий сохраняются, номер удалённой повторно не выдаётся. */
  function graphSnapDelete(sid) {
    if (!canDeleteGraphSnaps()) { toast('err', 'Удалять копии графика могут старший мастер, начальник участка и администратор'); return; }
    var g = graphsFind(GS.cur); if (!g) return;
    var arr = graphSnapsLoad(g.id);
    var sn = null;
    arr.forEach(function (x) { if (x && x.id === sid) sn = x; });
    if (!sn) { toast('err', 'Копия не найдена'); return; }
    var lbl = snapIterLabel(sn.iter);
    return spConfirm('Удалить копию графика «' + lbl + '» от ' + _snapDT(sn.ts) + '?\n\nКопия удалится безвозвратно. Сам график и задания в планировании не изменятся, номера остальных копий сохранятся.', { title: 'Удаление копии графика', ok: 'Удалить', danger: true }, function () { // 22.09-244: оформленное окно
    graphSnapsIssuedSet(g.id, graphSnapsMaxIter(arr)); // номер удалённой копии повторно не выдаётся
    if (sn.remote) { // 22.09-242: копия на сервере — удаляем там (у всех устройств сразу)
      if (!snapApiOk() || !SP_API.snapDel) { toast('err', 'Нет связи с сервером — копию удалить нельзя, попробуйте позже'); return; }
      return SP_API.snapDel(sid).then(function (r) {
        if (!r || !r.ok) { toast('err', 'Не удалось удалить копию на сервере' + (r && r.err ? ': ' + r.err : '')); return; }
        graphSnapsSaveList(g.id, graphSnapsLoad(g.id).filter(function (x) { return x && x.id !== sid; }));
        delete GRAPH_SNAP_MEM[sid];
        graphSnapDeleteDone(g, sn, lbl);
      });
    }
    graphSnapsSaveList(g.id, arr.filter(function (x) { return x && x.id !== sid; }));
    graphSnapDeleteDone(g, sn, lbl);
    });
  }
  function graphSnapDeleteDone(g, sn, lbl) {
    var ovP = document.getElementById('overlay3'); if (ovP) ovP.classList.remove('show'); // окно периодичности копии (если открыто)
    var ovV = document.getElementById('overlay2'); if (ovV) ovV.classList.remove('show'); // окно просмотра копии (если открыто)
    try { logAction('График: удаление копии', g.name + ' · ' + lbl + ' · копия от ' + _snapDT(sn.ts)); } catch (e3) {}
    toast('ok', '🗑 Копия «' + lbl + '» удалена');
    openGraphSnapsModal();
  }
  /* 22.09-240: печать сохранённой копии графика — те же настройки, что у «Печать графика»
     (треугольники, наименования, даты; печать или Excel), но НОВАЯ копия при этом НЕ создаётся:
     печатается сама копия, в шапке и внизу листа — «копия «N-я итерация» от …». Окно — поверх окна копии. */
  function openGraphSnapPrintModal(sid) { graphSnapFetch(sid, openGraphSnapPrintModalRender); } // 22.09-242: копия может лежать на сервере
  function openGraphSnapPrintModalRender(sn) {
    var g = sn.graph || {};
    if (!g.objs || !g.objs.length) { toast('err', 'В этой копии нет объектов — печатать нечего'); return; }
    var ov3 = document.getElementById('overlay3'), m3 = document.getElementById('modal3');
    if (!ov3 || !m3) return;
    var h = '<div class="modal-h"><h3>🖨 Печать копии — ' + esc(snapIterLabel(sn.iter)) + '</h3><button class="x" data-action="close-modal3">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5">График «<b style="color:var(--ink)">' + esc(g.name || '—') + '</b>» · ' + esc(String(g.year || '')) + ' год · копия от ' + esc(_snapDT(sn.ts)) + '. Печатается сама эта копия — <b>новая копия при печати не создаётся</b>.</div>';
    h += '<label class="gpr-past" style="margin-bottom:10px;font-size:12.5px"><input type="checkbox" id="gp-tris" checked> Треугольники (выполненные — квадраты с крестиком)</label>';
    h += '<label class="gpr-past" style="margin-bottom:10px;font-size:12.5px"><input type="checkbox" id="gp-names" checked> Наименования работ</label>';
    h += '<label class="gpr-past" style="margin-bottom:10px;font-size:12.5px"><input type="checkbox" id="gp-dates" checked> Даты проведения работ</label>';
    h += '<div class="calc" style="font-size:12px;align-items:flex-start">Сверху над месяцами печатается год графика (' + esc(String(g.year || '')) + '). Скрытые фильтром объекты не печатаются. В шапке и внизу листа указано, что это копия «' + esc(snapIterLabel(sn.iter)) + '». В Excel: работы построчно, треугольники — цветом работ, второй лист «Обозначения».</div>';
    h += '</div>';
    h += '<div class="modal-f">' +
      '<button type="button" class="btn" data-action="graph-snap-excel-go" data-sid="' + esc(sn.id) + '" title="Выгрузить эту копию графика в Excel с теми же настройками">📥 Excel</button>' +
      '<button type="button" class="btn ok" data-action="graph-snap-print-go" data-sid="' + esc(sn.id) + '">🖨 Печать</button>' +
      '<button type="button" class="btn danger" data-action="close-modal3">Отменить</button>' +
      '</div>';
    m3.innerHTML = h;
    m3.style.width = ''; m3.style.maxWidth = '480px';
    ov3.classList.add('show');
  }
  function graphSnapApply(sid) { graphSnapFetch(sid, graphSnapApplyRun); } // 22.09-242
  function graphSnapApplyRun(sn) {
    var g = graphsFind(GS.cur); if (!g) return;
    return spConfirm('Применить копию «' + snapIterLabel(sn.iter) + '» от ' + _snapDT(sn.ts) + ' к графику «' + g.name + '»?\n\nТекущие объекты, работы, периодичность и даты вхождений будут заменены содержимым копии, и задания в планировании будут выстроены заново по датам этого графика (выполненные останутся в истории). Отменить действие можно кнопкой «⟲ Отмена» в календаре.', { title: 'Применение копии графика', ok: 'Применить' }, function () { // 22.09-244: оформленное окно
    var list = graphsLoad();
    var restored = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === g.id) {
        var clone = JSON.parse(JSON.stringify(sn.graph));
        clone.id = g.id;
        clone.restored_at = Date.now(); clone.restored_from = sn.ts;
        list[i] = clone;
        restored = clone;
        break;
      }
    }
    graphsSaveList(list);
    // 22.09-230: задания в планировании выстраиваются обратно согласно графику —
    // пересчёт серий восстановленного графика: невыполненные пересоздаются по
    // датам копии, выполненные остаются в истории, дубли не создаются (22.09-227)
    var rs = null;
    try {
      planUndoPush('♻ восстановление графика «' + g.name + '» из копии'); // 22.09-225: всё действие откатывается одним снимком
      if (restored) rs = graphYearResync(restored, 'all');
      if (TASKS_DB) S.tasks = TASKS_DB.getTasks();
    } catch (eR) {}
    try { overlay.classList.remove('show'); } catch (e) {}
    try { document.getElementById('overlay2').classList.remove('show'); } catch (e2) {}
    try { logAction('График: восстановление из копии', g.name + ' · ' + snapIterLabel(sn.iter) + ' · копия от ' + _snapDT(sn.ts) + (rs ? ' · заданий создано: ' + (rs.created || 0) + ', убрано прежних: ' + (rs.removed || 0) : '')); } catch (e3) {}
    toast('ok', '♻ График «' + g.name + '» восстановлен из копии «' + snapIterLabel(sn.iter) + '».');
    if (rs) toast('ok', '📅 Задания в планировании выстроены по графику: создано ' + (rs.created || 0) + ', убрано прежних ' + (rs.removed || 0) + ', сохранено выполненных ' + (rs.kept || 0) + (rs.dup ? ', уже существовали (без дублей): ' + rs.dup : '') + '. Отменить всё: «⟲ Отмена» в календаре.');
    if (S.screen === 'calendar') { try { refresh(); } catch (eC) {} }
    renderGraphs();
    });
  }

  function openGraphPrintModal() {
    var g = graphsFind(GS.cur);
    if (!g || !g.objs || !g.objs.length) { toast('err', 'Добавьте объекты в график'); return; }
    graphSnapSave(g, 'печать графика'); // 22.09-226: каждая печать — полная копия графика
    var h = '<div class="modal-h"><h3>Печать графика</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<label class="gpr-past" style="margin-bottom:10px;font-size:12.5px"><input type="checkbox" id="gp-tris" checked> Треугольники (выполненные — квадраты с крестиком)</label>';
    h += '<label class="gpr-past" style="margin-bottom:10px;font-size:12.5px"><input type="checkbox" id="gp-names" checked> Наименования работ</label>';
    h += '<label class="gpr-past" style="margin-bottom:10px;font-size:12.5px"><input type="checkbox" id="gp-dates" checked> Даты проведения работ</label>';
    h += '<div class="calc" style="font-size:12px;align-items:flex-start">Сверху над месяцами печатается год графика (' + esc(String(g.year)) + '). Скрытые фильтром объекты не печатаются. В Excel: работы построчно, треугольники — цветом работ, второй лист «Обозначения».</div>';
    h += '</div>';
    h += '<div class="modal-f">' +
      '<button type="button" class="btn" data-action="graphs-excel-go" title="Выгрузить график в Excel с теми же настройками">📥 Excel</button>' +
      '<button type="button" class="btn ok" data-action="graphs-print-go">🖨 Печать</button>' +
      '<button type="button" class="btn danger" data-action="close-modal">Отменить</button>' +
      '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '480px';
    overlay.classList.add('show');
  }
  function graphPrintOpts(root) { // 22.09-240: root — окно, из которого читать галочки (печать копии — третье окно)
    function chk(id) { var el = (root && root.querySelector) ? root.querySelector('#' + id) : document.getElementById(id); return el ? el.checked : true; }
    return { tris: chk('gp-tris'), names: chk('gp-names'), dates: chk('gp-dates') };
  }

  /* Печатная версия графика (окно печати, А4 альбомная): слева объекты,
     сверху год над месяцами, в ячейках — треугольники/квадраты, наименования
     и даты — по выбранным свойствам печати */
  function graphsPrintGo(gArg, snap) {
    // 22.09-240: gArg/snap — печать сохранённой КОПИИ графика (новая копия при этом НЕ создаётся)
    var g = gArg || null;
    if (!g) graphsLoad().forEach(function (x) { if (x.id === GS.cur) g = x; });
    if (!g || !g.objs || !g.objs.length) { if (gArg) toast('err', 'В копии нет объектов — печатать нечего'); else overlay.classList.remove('show'); return; }
    var snapTxt = snap ? 'копия «' + snapIterLabel(snap.iter) + '» от ' + _snapDT(snap.ts) : '';
    var o = graphPrintOpts(gArg ? document.getElementById('modal3') : null);
    var area = g.area || graphAreaDefault(g);
    var rows = [];
    g.objs.forEach(function (ob) {
      if (ob.hide) return;
      var nm = String(ob.name || '');
      var comma = nm.indexOf(',');
      var name = comma !== -1 ? nm.slice(0, comma) : nm;
      var addr = comma !== -1 ? nm.slice(comma + 1).trim() : '';
      var cells = [];
      for (var mi = 0; mi < 12; mi++) {
        var lines = [];
        gwObjWorks(ob).forEach(function (wrk) {
          var w = null;
          try { w = WORK.getWork(area, wrk.wid); } catch (e) {}
          var occs = [];
          (wrk.occs || []).forEach(function (oc) {
            var d = gwFromISO(oc.date);
            if (d.getFullYear() === g.year && d.getMonth() === mi) occs.push({ ds: String(d.getDate()).padStart(2, '0') + '.' + String(mi + 1).padStart(2, '0'), done: gwOccDone(oc), color: gwColorOf(g, oc.wid || wrk.wid) });
          });
          if (!occs.length) return;
          var marks = '';
          occs.forEach(function (x) { marks += (x.done ? gwDoneMark(9, x.color) : gwTriangle(x.color, 9)) + ' '; });
          var txt = (o.names ? esc(w ? w.name : 'Работа') + ' ' : '') + (o.dates ? '(' + occs.map(function (x) { return x.ds; }).join(', ') + ')' : '');
          lines.push('<div class="pw">' + (o.tris ? marks : '') + txt + '</div>');
        });
        cells.push(lines.join(''));
      }
      rows.push('<tr><td class="obj"><b>' + esc(name) + '</b>' + (addr ? '<span class="addr">' + esc(addr) + '</span>' : '') + '</td>' + cells.map(function (c) { return '<td class="mc">' + c + '</td>'; }).join('') + '</tr>');
    });
    if (!rows.length) { toast('err', 'Все объекты скрыты фильтром'); return; }
    var monthHeads = '';
    for (var m = 0; m < 12; m++) monthHeads += '<th class="mh">' + MONTHS_RU[m] + '</th>';
    var w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { toast('err', 'Разрешите всплывающие окна для печати'); return; }
    w.document.write(
      '<html><head><meta charset="UTF-8"><title>График ' + esc(g.name) + ' ' + g.year + (snap ? ' — ' + esc(snapIterLabel(snap.iter)) : '') + '</title>' +
      '<style>' +
      '@page{size:A4 landscape;margin:1cm}' +
      'body{font-family:"Segoe UI",Arial,sans-serif;font-size:9pt;color:#000;margin:0}' +
      '.hdr{text-align:center;margin-bottom:8pt;border-bottom:2pt solid #000;padding-bottom:5pt}' +
      '.hdr .org{font-size:9pt;color:#444}' +
      '.hdr h1{font-size:13pt;margin:3pt 0 1pt;text-transform:uppercase}' +
      '.hdr .sub{font-size:8.5pt;color:#555}' +
      'table{width:100%;border-collapse:collapse;table-layout:fixed}' +
      'th,td{border:1pt solid #555;padding:3pt 3pt;vertical-align:top}' +
      'th{background:#eee;font-size:8pt;font-weight:700}' +
      'th.obj{width:110pt}' +
      'th.year{font-size:11pt;letter-spacing:2pt;text-align:center;padding:4pt}' +
      'th.mh{font-size:7.5pt}' +
      'td.obj b{font-size:8.5pt}' +
      'td.obj .addr{display:block;font-size:7pt;color:#444;font-weight:400}' +
      'td.mc{font-size:7pt;line-height:1.35}' +
      '.pw{margin-bottom:2pt;white-space:nowrap}' +
      '.pw svg{vertical-align:-1pt}' +
      '.footer{margin-top:8pt;font-size:7.5pt;color:#888;text-align:center;border-top:.5pt solid #aaa;padding-top:4pt}' +
      '@media print{.noprint{display:none}}' +
      '</style></head><body>' +
      '<div class="hdr"><div class="org">УП «МИНГАЗ» · УБиРОГС</div><h1>График «' + esc(g.name) + '»</h1><div class="sub">Ответственный: ' + esc(g.respName || '—') + ' · объектов: ' + rows.length + (snapTxt ? ' · ' + esc(snapTxt) : '') + '</div></div>' +
      '<table><thead><tr><th class="obj" rowspan="2">Объект</th><th class="year" colspan="12">' + g.year + ' год</th></tr>' +
      '<tr>' + monthHeads + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
      '<div class="footer">SmartPlan · график «' + esc(g.name) + '» · ' + g.year + (snapTxt ? ' · ' + esc(snapTxt) : '') + ' · сформирован ' + fmt(TODAY) + '</div>' +
      '<div class="noprint" style="text-align:center;margin-top:10pt"><button onclick="window.print()" style="padding:7pt 22pt;font-size:10.5pt;cursor:pointer;background:#ca8a04;color:#fff;border:none;border-radius:6pt">🖨 Печать</button></div>' +
      '</body></html>');
    w.document.close();
    if (snap) { try { logAction('Печать копии графика', g.name + ' · ' + snapTxt); } catch (eL) {} } // 22.09-240
    setTimeout(function () { w.focus(); w.print(); }, 400);
  }

  /* ===== ПЕЧАТЬ ГРАФИКА В EXCEL ===== */
  /* Лист «График»: строки = объекты × работы (несколько работ у объекта —
     несколько строк, ячейки объекта/адреса объединены), столбцы: объект,
     адрес, работа, 12 месяцев. Треугольники ▲ и выполненные ☒ ОКРАШЕНЫ
     цветом работы из «Обозначений работ» графика — как на экране.
     Лист «Обозначения» — легенда цветов. Если стилевая библиотека не
     загрузилась — выгрузка всё равно проходит, но без цветов. */
  function graphsExportExcel(opts, gArg, snap) { // 22.09-240: gArg/snap — выгрузка сохранённой КОПИИ (без новой копии)
    opts = opts || { tris: true, names: true, dates: true };
    ensureXlsxStyle().then(function (okStyle) {
      var XL = okStyle ? window.XLSX_STYLE : window.XLSX;
      if (!XL) { ensureXlsxRetry(function () { graphsExportExcel(opts, gArg, snap); }); return; }
      var g = gArg || null;
      if (!g) graphsLoad().forEach(function (x) { if (x.id === GS.cur) g = x; });
      if (!g || !g.objs || !g.objs.length) { toast('err', gArg ? 'В копии нет объектов — выгружать нечего' : 'Добавьте объекты в график'); return; }
      var area = g.area || graphAreaDefault(g);
      var BN = 'FFB9C4CE';
      function bd() { return { top: { style: 'thin', color: { rgb: BN } }, bottom: { style: 'thin', color: { rgb: BN } }, left: { style: 'thin', color: { rgb: BN } }, right: { style: 'thin', color: { rgb: BN } } }; }
      function xrgb(hex) { return ('FF' + String(hex || '').replace('#', '')).toUpperCase(); }
      var sHead = { font: { bold: true, sz: 10, color: { rgb: 'FF0F2740' } }, fill: { fgColor: { rgb: 'FFE8EEF3' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bd() };
      var sObj = { font: { bold: true, sz: 10 }, alignment: { vertical: 'center', wrapText: true }, border: bd() };
      var sAddr = { font: { sz: 9, color: { rgb: 'FF475569' } }, alignment: { vertical: 'center', wrapText: true }, border: bd() };
      var sWork = { font: { sz: 9 }, alignment: { vertical: 'center', wrapText: true }, border: bd() };
      function sEmpty() { return { font: { sz: 9 }, alignment: { vertical: 'center', wrapText: true }, border: bd() }; }
      function sMonth(hex) { return { font: { bold: true, sz: 9, color: { rgb: xrgb(hex) } }, alignment: { vertical: 'center', wrapText: true }, border: bd() }; }
      var head = ['Наименование объекта', 'Адрес объекта', 'Работа'];
      for (var m = 0; m < 12; m++) head.push(MONTHS_RU[m] + ' ' + g.year);
      var data = [head];
      var stl = [head.map(function () { return sHead; })]; // стили ячеек параллельно data
      var merges = [];
      var usedWids = []; // порядок работ для легенды
      var rows = 0;
      g.objs.forEach(function (ob) {
        if (ob.hide) return; // фильтр графика применяется и к печати
        var nm = String(ob.name || '');
        var comma = nm.indexOf(',');
        var name = comma !== -1 ? nm.slice(0, comma) : nm;
        var addr = comma !== -1 ? nm.slice(comma + 1).trim() : '';
        var works = gwObjWorks(ob);
        var r0 = data.length; // первая строка группы объекта
        works.forEach(function (wrk) {
          var w = null;
          try { w = WORK.getWork(area, wrk.wid); } catch (e) {}
          var color = gwColorOf(g, wrk.wid);
          if (usedWids.indexOf(wrk.wid) === -1) usedWids.push(wrk.wid);
          var row = ['', '', opts.names ? (w ? w.name : 'Работа') : ''];
          var sr = [sObj, sAddr, sWork];
          for (var mi = 0; mi < 12; mi++) {
            var occs = [];
            (wrk.occs || []).forEach(function (oc) {
              var d = gwFromISO(oc.date);
              if (d.getFullYear() === g.year && d.getMonth() === mi) occs.push({ ds: String(d.getDate()).padStart(2, '0') + '.' + String(mi + 1).padStart(2, '0'), done: gwOccDone(oc) });
            });
            var parts = occs.map(function (x) {
              var mark = opts.tris ? (x.done ? '☒' : '▲') : '';
              return (mark ? mark + ' ' : '') + (opts.dates ? x.ds : '');
            }).filter(function (s) { return s; });
            row.push(parts.join(', '));
            sr.push(parts.length ? sMonth(color) : sEmpty());
          }
          data.push(row);
          stl.push(sr);
        });
        if (!works.length) { // объект без работ — одна пустая строка
          var rowE = ['', '', ''];
          var srE = [sObj, sAddr, sWork];
          for (var miE = 0; miE < 12; miE++) { rowE.push(''); srE.push(sEmpty()); }
          data.push(rowE);
          stl.push(srE);
        }
        data[r0][0] = name; // имя/адрес — в первой строке группы
        data[r0][1] = addr;
        if (data.length - r0 > 1) {
          merges.push({ s: { r: r0, c: 0 }, e: { r: data.length - 1, c: 0 } });
          merges.push({ s: { r: r0, c: 1 }, e: { r: data.length - 1, c: 1 } });
        }
        rows++;
      });
      if (!rows) { toast('err', 'Все объекты скрыты фильтром — выгружать нечего'); return; }
      // лист «Обозначения»: ▲ цветом работы + наименование
      var lg = [['Обозначение', 'Работа']];
      var lgS = [[sHead, sHead]];
      usedWids.forEach(function (wid) {
        var w = null;
        try { w = WORK.getWork(area, wid); } catch (e) {}
        lg.push(['▲', w ? w.name : 'Работа']);
        lgS.push([sMonth(gwColorOf(g, wid)), sWork]);
      });
      lg.push(['☒', 'выполненная работа (задача закрыта в планировании)']);
      lgS.push([sMonth('#0f2740'), sWork]);
      var wb = XL.utils.book_new();
      var ws = XL.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 26 }];
      for (var c = 0; c < 12; c++) ws['!cols'].push({ wch: 15 });
      if (merges.length) ws['!merges'] = merges;
      if (okStyle) applySheetStyles(XL, ws, data, stl);
      var wsL = XL.utils.aoa_to_sheet(lg);
      wsL['!cols'] = [{ wch: 14 }, { wch: 56 }];
      if (okStyle) applySheetStyles(XL, wsL, lg, lgS);
      try {
        XL.utils.book_append_sheet(wb, ws, 'График ' + g.year);
        XL.utils.book_append_sheet(wb, wsL, 'Обозначения');
        var fn = 'График_' + g.name.replace(/[\\/:*?"<>|]/g, '_') + '_' + g.year + (snap ? '_' + snapIterLabel(snap.iter).replace(/\s+/g, '_') : '') + '.xlsx'; // 22.09-240: копия — с номером итерации
        // скачивание вручную (стилевой бандл не проставляет имя файла в a.download)
        var out = XL.write(wb, { bookType: 'xlsx', type: 'array' });
        var blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fn;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 4000);
        logAction(snap ? 'Печать копии графика в Excel' : 'Печать графика в Excel', g.name + (snap ? ' · копия «' + snapIterLabel(snap.iter) + '» от ' + _snapDT(snap.ts) : '') + ' (' + rows + ' объектов, ' + (okStyle ? 'цветные обозначения' : 'без цветов') + ')');
        toast('ok', '📥 График выгружен в Excel: ' + fn + ' · треугольники цветом работ' + (okStyle ? '' : ' · библиотека цветов не загрузилась, выгружено без цветов'));
      } catch (err) {
        console.error('Ошибка выгрузки Excel:', err);
        toast('err', 'Ошибка выгрузки графика в Excel');
      }
    });
  }
  /* применить матрицу стилей stl к ячейкам листа (создаёт пустые ячейки,
     чтобы границы/выравнивание были и у незаполненных месяцев) */
  function applySheetStyles(XL, ws, data, stl) {
    for (var r = 0; r < data.length; r++) {
      for (var c = 0; c < data[r].length; c++) {
        var addr = XL.utils.encode_cell({ r: r, c: c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        ws[addr].s = (stl[r] && stl[r][c]) || { font: { sz: 9 } };
      }
    }
  }
  /* Задача серии выполнена в планировании? */
  function gwOccDone(oc) {
    if (!oc || !oc.tid) return false;
    var t = findTask(oc.tid);
    return !!(t && isDone(t));
  }
  /* Квадрат с чёрным крестиком — работа выполнена (задача закрыта в планировании).
     Внутри квадрат залит ЦВЕТОМ РАБОТЫ (как был треугольник), крест чёрный
     с белой окантовкой — виден на любом фоне. */
  function gwDoneMark(size, color) {
    size = size || 17;
    color = color || '#94a3b8';
    return '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" style="flex:0 0 auto;display:block"><rect x="1.5" y="1.5" width="17" height="17" rx="2.5" fill="' + color + '" stroke="#000" stroke-width="2"/><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="#000" stroke-width="2.2" stroke-linecap="round"/></svg>';
  }

  /* Информация о работе для всплывающей подсказки при наведении на треугольник.
     22.09-146: заголовок — ГРУППА работ (коротко); полный вид работ — строкой ниже
     светлее. У работ без группы заголовок — название, как раньше.
     22.09-202: строка с видом работ убрана; трудоёмкость всегда, факт — у выполненных. */
  function gwWorkTipHtml(g, ob, wrk, oc) {
    var area = (g && g.area) || graphAreaDefault(g);
    var w = null;
    try { w = WORK.getWork(area, oc.wid || wrk.wid); } catch (e) {}
    var d = gwFromISO(oc.date);
    var _gp = gwWorkGroup(w);
    // 22.09-202: вид работ в подсказке НЕ показываем — только наименование ГРУППЫ работ
    // (у работ без группы заголовок — название работы, как раньше). Для каждой работы —
    // трудоёмкость (норма из справочника); для выполненных — ещё и фактическая (время на объекте из задачи).
    var _norm = (w && isFinite(+w.norm) && +w.norm > 0) ? +w.norm : 0;
    var _dn = gwOccDone(oc);
    var _fact = null;
    if (_dn && oc.tid) { try { _fact = taskFactHours(findTask(oc.tid)); } catch (eF) {} }
    return '<b>' + esc(_gp || (w ? w.name : 'Работа графика')) + '</b>' +
      '<br>Объект: ' + esc(ob.name || '—') +
      '<br>Дата: ' + d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + ' ' + d.getFullYear() +
      (_norm > 0 ? '<br>Трудоёмкость: ' + fmtH3(_norm) + ' чел/ч' : '') +
      (_dn ? '<br>✔ Выполнена' + (_fact != null ? ' · факт: ' + fmtH3(_fact) + ' чел/ч' : '') : '') +
      (wrk.period ? '<br>Периодичность: ' + fmtH3(wrk.period) + ' мес' + (wrk.dev ? ' − ' + wrk.dev + ' дн' : '') : '') +
      (g && g.respName ? '<br>Мастер: ' + esc(g.respName) : '');
  }

  /* Подсказка для общего (разделённого по цветам) треугольника дня:
     блок по каждой работе, разделённые горизонтальной чертой. */
  function gwDayTipHtml(g, ob, items) {
    return items.map(function (p) { return gwWorkTipHtml(g, ob, p.wrk, p.oc); })
      .join('<hr style="border:none;border-top:1px solid rgba(255,255,255,.25);margin:6px 0">');
  }

  /* Треугольники всех работ объекта в ячейке объект×месяц годовой таблицы.
     22.09-120: на один день — ОДИН треугольник, разделённый на цвета всех
     работ этого дня (выполненные работы остаются отдельными квадратами). */
  function gwMonthTriangles(g, ob, mi) {
    var byDate = {}, order = [];
    gwObjWorks(ob).forEach(function (wrk) {
      (wrk.occs || []).forEach(function (oc) {
        var d = gwFromISO(oc.date);
        if (d.getFullYear() !== g.year || d.getMonth() !== mi) return;
        if (!byDate[oc.date]) { byDate[oc.date] = { pend: [], done: [] }; order.push(oc.date); }
        (gwOccDone(oc) ? byDate[oc.date].done : byDate[oc.date].pend).push({ wrk: wrk, oc: oc });
      });
    });
    order.sort();
    var out = '';
    order.forEach(function (dt) {
      var grp = byDate[dt];
      if (grp.pend.length) {
        var colors = grp.pend.map(function (p) { return gwColorOf(g, p.oc.wid || p.wrk.wid); });
        out += '<span class="gw-tri-w" data-gw-tip="' + esc(gwDayTipHtml(g, ob, grp.pend)) + '">' + gwMultiTriangle(colors, 15) + '</span>';
      }
      grp.done.forEach(function (p) {
        out += '<span class="gw-tri-w" data-gw-tip="' + esc(gwWorkTipHtml(g, ob, p.wrk, p.oc)) + '">' + gwDoneMark(17, gwColorOf(g, p.oc.wid || p.wrk.wid)) + '</span>';
      });
    });
    return out ? '<div class="gw-tris">' + out + '</div>' : '';
  }

  /* 22.09-121: зимний период графика. Хранится как g.winter={from:'MM-DD',to:'MM-DD'},
     год не важен — период повторяется ежегодно; допускается переход через
     Новый год (например, с 15.10 по 15.04). */
  function gwIsWinter(g, iso) {
    if (!g || !g.winter || !g.winter.from || !g.winter.to) return false;
    function md(x) { var q = String(x).split('-'); return (+q[0]) * 100 + (+q[1]); }
    var cur = md(String(iso).slice(5, 10)), from = md(g.winter.from), to = md(g.winter.to);
    return from <= to ? (cur >= from && cur <= to) : (cur >= from || cur <= to);
  }
  /* 'MM-DD' -> 'DD.MM' для подписей */
  function gwMdRu(md) {
    var p = String(md || '').split('-');
    return p.length === 2 ? p[1] + '.' + p[0] : String(md || '');
  }
  /* Флаги по 12 месяцам года графика: есть ли в месяце зимние дни */
  function gwWinterMonths(g) {
    var out = [], mi, d, days;
    for (mi = 0; mi < 12; mi++) out.push(false);
    if (!g || !g.winter || !g.winter.from || !g.winter.to) return out;
    var y = g.year || new Date().getFullYear();
    for (mi = 0; mi < 12; mi++) {
      days = new Date(y, mi + 1, 0).getDate();
      for (d = 1; d <= days; d++) {
        if (gwIsWinter(g, y + '-' + String(mi + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'))) { out[mi] = true; break; }
      }
    }
    return out;
  }

  /* 22.09-122: сезонная замена работ по датам графика. У одинаковых по
     названию работ в справочнике бывают сезонные версии («Зима»/«Лето»/
     «Круглый год» — например, техосмотр летом и зимой). После задания
     зимнего периода каждое вхождение в графике переводится на нужную версию:
     зимняя дата — зимняя версия, остальные — обычная; выполненные вхождения
     не трогаем. У связанной задачи планирования меняется вид работы (w). */
  function gwSeasonSync(g, area) {
    var res = { toWinter: 0, toSummer: 0, tasks: 0 };
    if (!g || !g.objs || !area) return res;
    if (!g.winter || !g.winter.from || !g.winter.to) return res;
    var works = [];
    try { works = WORK.getWorks(area) || []; } catch (e) {}
    function nrm(n) { return String(n || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    function isWinterW(w) { return String(w && w.season || '').toLowerCase() === 'зима'; }
    var byName = {};
    works.forEach(function (w) {
      if (!w || !w.id) return;
      var k = nrm(w.name);
      (byName[k] = byName[k] || []).push(w);
    });
    function getW(id) { var x = null; try { x = WORK.getWork(area, id); } catch (e) {} return x; }
    function winterTwin(w) {
      var arr = byName[nrm(w.name)] || [];
      for (var i = 0; i < arr.length; i++) if (arr[i].id !== w.id && isWinterW(arr[i])) return arr[i];
      return null;
    }
    function usualTwin(w) {
      var arr = byName[nrm(w.name)] || [];
      var best = null;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === w.id || isWinterW(arr[i])) continue;
        if (String(arr[i].season || '') === 'Лето') return arr[i];
        if (!best) best = arr[i];
      }
      return best;
    }
    g.objs.forEach(function (ob) {
      gwObjWorks(ob).forEach(function (wrk) {
        var baseW = getW(wrk.wid);
        if (!baseW) return;
        (wrk.occs || []).forEach(function (oc) {
          var curId = oc.wid || wrk.wid;
          var curW = (curId === wrk.wid) ? baseW : (getW(curId) || baseW);
          var curWinter = isWinterW(curW);
          var target = null;
          if (gwIsWinter(g, oc.date)) { if (!curWinter) target = winterTwin(curW); }
          else if (curWinter) target = usualTwin(curW);
          if (!target || target.id === curId) return;
          if (oc.tid && typeof TASKS_DB !== 'undefined' && TASKS_DB) {
            var tk = null;
            try { tk = TASKS_DB.getTask(oc.tid); } catch (e) {}
            if (tk && typeof isDone === 'function' && isDone(tk)) return; // выполненные не трогаем — история
            if (tk) { try { TASKS_DB.updateTask(tk.id, { w: target.id }); res.tasks++; } catch (e) {} }
          }
          oc.wid = target.id;
          if (curWinter) res.toSummer++; else res.toWinter++;
        });
      });
    });
    return res;
  }

  /* Дни недели для таблицы дней месяца */
  var WEEKDAYS_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

  /* Таблица дней месяца: слева объект(ы), сверху каждый день месяца —
     число + день недели (Понедельник, Вторедельник и т.д.). Ячейки пока
     пустые — содержимое по следующим постановкам. */
  function graphDaysTableHtml(g, rows, mi) {
    var year = g.year;
    var days = new Date(year, mi + 1, 0).getDate();
    // 22.09-82: состояние каждого дня месяца для мастера графика по его графику
    // смен («Работники»): зелёные ячейки — дни, когда он на работе; так видно,
    // в какие дни реально можно ставить треугольники работ.
    var dayStates = {}, workCnt = 0;
    if (g.respId) {
      for (var di = 1; di <= days; di++) {
        var isoD = year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(di).padStart(2, '0');
        try { dayStates[di] = wkDayState(g.respId, isoD); } catch (e) { dayStates[di] = ''; }
        if (dayStates[di] === 'work') workCnt++;
      }
    }
    // 22.09-121: зимний период — столбцы зимних дней чуть голубее
    var winD = {};
    if (g.winter && g.winter.from && g.winter.to) {
      for (var wdi = 1; wdi <= days; wdi++) {
        winD[wdi] = gwIsWinter(g, year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(wdi).padStart(2, '0'));
      }
    }
    var h = '<div class="gw-scroll"><div class="gw-grid" style="grid-template-columns:minmax(210px,1.3fr) repeat(' + days + ',minmax(54px,1fr))">';
    h += '<div class="gw-h gw-corner">Объект<span>' + MONTHS_RU[mi] + ' ' + year + '</span></div>';
    for (var d = 1; d <= days; d++) {
      var bgH = dayStates[d] === 'work' ? (winD[d] ? '#d6f0e7' : '#dcfce7') : (winD[d] ? '#e0f0fb' : '');
      h += '<div class="gw-h gd-h"' + (bgH ? ' style="background:' + bgH + '"' : '') + '><b>' + d + '</b><span>' + WEEKDAYS_RU[new Date(year, mi, d).getDay()] + '</span></div>';
    }
    rows.forEach(function (ob) {
      h += '<div class="gw-obj"><span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span><span class="gw-obj-nm" title="' + esc(ob.title || ob.label) + '">' + esc(ob.label) + '</span></div>';
      for (var c = 1; c <= days; c++) {
        var iso = year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(c).padStart(2, '0');
        var tri = '';
        if (ob.src) {
          // 22.09-120: все работы дня — ОДИН треугольник, разделённый на цвета
          var pend = [], dn = [];
          gwObjWorks(ob.src).forEach(function (wrk) {
            (wrk.occs || []).forEach(function (oc) {
              if (oc.date === iso) (gwOccDone(oc) ? dn : pend).push({ wrk: wrk, oc: oc });
            });
          });
          if (pend.length) tri += '<span class="gw-tri-w" data-gw-tip="' + esc(gwDayTipHtml(g, ob.src, pend)) + '">' + gwMultiTriangle(pend.map(function (p) { return gwColorOf(g, p.oc.wid || p.wrk.wid); }), 14) + '</span>';
          dn.forEach(function (p) {
            tri += '<span class="gw-tri-w" data-gw-tip="' + esc(gwWorkTipHtml(g, ob.src, p.wrk, p.oc)) + '">' + gwDoneMark(16, gwColorOf(g, p.oc.wid || p.wrk.wid)) + '</span>';
          });
        }
        var bgC = dayStates[c] === 'work' ? (winD[c] ? '#d6f0e7' : '#dcfce7') : (winD[c] ? '#e0f0fb' : '');
        h += '<div class="gd-c"' + (bgC ? ' style="background:' + bgC + '"' : '') + '>' + (tri ? '<div class="gw-tris">' + tri + '</div>' : '') + '</div>';
      }
    });
    h += '</div></div>';
    // Легенда подсветки: чей график смен и сколько рабочих дней в месяце
    if (g.respId) {
      var mName = g.respName || '';
      h += '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12.5px;color:var(--muted);font-weight:700;flex-wrap:wrap">' +
        '<span style="width:14px;height:14px;border-radius:3px;background:#dcfce7;border:1px solid #16a34a;flex:0 0 auto"></span>' +
        'мастер ' + (mName ? '«' + esc(mName) + '» ' : '') + 'на работе (график смен, вкладка «Работники») — ' + workCnt + ' дн. в этом месяце' +
        '</div>';
    }
    // 22.09-121: легенда зимнего периода
    if (g.winter && g.winter.from && g.winter.to) {
      h += '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12.5px;color:var(--muted);font-weight:700;flex-wrap:wrap">' +
        '<span style="width:14px;height:14px;border-radius:3px;background:#e0f0fb;border:1px solid #0284c7;flex:0 0 auto"></span>' +
        '❄️ Зимний период: с ' + gwMdRu(g.winter.from) + ' по ' + gwMdRu(g.winter.to) + ' (ежегодно)' +
        '</div>';
    }
    return h;
  }

  /* Клик по ячейке объект×месяц: график объекта — слева номер объекта,
     сверху каждый день выбранного месяца */
  function openGraphObjMonthModal(ri, mi) {
    var g = graphsFind(GS.cur);
    if (!g || !g.objs || !g.objs[ri]) return;
    var ob = g.objs[ri];
    var num = String(ob.name || '').split(',')[0]; // номер объекта: «ГРП-12»
    GS.printView = { mode: 'obj', ri: ri, mi: mi };
    var h = '<div class="modal-h"><h3>График объекта — ' + esc(num) + ' · ' + MONTHS_RU[mi] + ' ' + g.year + '</h3><div style="flex:1"></div>' +
      '<button type="button" class="btn sm" data-action="graphs-print-view" style="background:#ca8a04;border-color:#ca8a04;color:#fff;margin-right:10px" title="Распечатать график объекта">' + GT_ICONS.printer + ' Печать графика</button>' +
      '<button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">' + graphDaysTableHtml(g, [{ type: ob.type, label: num, title: ob.name, src: ob }], mi) + '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '1060px';
    overlay.classList.add('show');
  }

  /* Печать месячного графика: отдельное окно (А4 альбомная), слева объект(ы),
     сверху дни месяца — число + день недели (кратко) */
  function graphsPrintView() {
    var g = graphsFind(GS.cur);
    var pv = GS.printView;
    if (!g || !pv) return;
    graphSnapSave(g, 'печать из окна просмотра'); // 22.09-226
    var rows, title;
    if (pv.mode === 'obj') {
      var ob = g.objs && g.objs[pv.ri];
      if (!ob) return;
      var num = String(ob.name || '').split(',')[0];
      title = 'График объекта — ' + num + ' · ' + MONTHS_RU[pv.mi] + ' ' + g.year;
      rows = [{ label: num, type: ob.type }];
    } else {
      title = 'График на ' + MONTHS_RU[pv.mi] + ' ' + g.year + ' — все объекты';
      rows = (g.objs || []).map(function (o) { return { label: o.name, type: o.type }; });
    }
    if (!rows.length) { toast('err', 'В графике нет объектов'); return; }
    var WD_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    var days = new Date(g.year, pv.mi + 1, 0).getDate();
    var th = '<table class="pt"><thead><tr><th class="obj">Объект</th>';
    for (var d = 1; d <= days; d++) {
      th += '<th><b>' + d + '</b><br><span>' + WD_SHORT[new Date(g.year, pv.mi, d).getDay()] + '</span></th>';
    }
    th += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      th += '<tr><td class="obj">' + esc(r.label) + '</td>';
      for (var c = 1; c <= days; c++) th += '<td></td>';
      th += '</tr>';
    });
    th += '</tbody></table>';
    var w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { toast('err', 'Разрешите всплывающие окна для печати'); return; }
    w.document.write(
      '<html><head><meta charset="UTF-8"><title>' + esc(title) + '</title>' +
      '<style>' +
      '@page{size:A4 landscape;margin:1cm}' +
      'body{font-family:"Segoe UI",Arial,sans-serif;font-size:10pt;color:#000}' +
      '.hdr{text-align:center;margin-bottom:10pt;border-bottom:2px solid #000;padding-bottom:6pt}' +
      '.hdr .org{font-size:10pt;color:#444}' +
      '.hdr h1{font-size:13pt;margin:4pt 0 2pt}' +
      '.hdr .g{font-size:10pt;color:#555}' +
      'table.pt{width:100%;border-collapse:collapse;table-layout:fixed}' +
      'table.pt th,table.pt td{border:1px solid #000;padding:3pt 2pt;text-align:center;vertical-align:middle}' +
      'table.pt th{background:#f0f0f0;font-size:8pt;line-height:1.2}' +
      'table.pt th span{font-size:7pt;color:#555}' +
      'table.pt td{height:26pt}' +
      'table.pt th.obj,table.pt td.obj{text-align:left;font-size:8.5pt;padding:3pt 4pt;overflow:hidden}' +
      'th.obj{width:130pt}' +
      '.footer{margin-top:10pt;font-size:8pt;color:#888;text-align:center}' +
      '@media print{.noprint{display:none}}' +
      '</style></head><body>' +
      '<div class="hdr"><div class="org">УП «МИНГАЗ» · УБиРОГС</div><h1>' + esc(title) + '</h1><div class="g">График: ' + esc(g.name) + ' · ' + g.year + ' год</div></div>' +
      th +
      '<div class="footer">SmartPlan · ' + key(TODAY) + '</div>' +
      '<div class="noprint" style="text-align:center;margin-top:12pt"><button onclick="window.print()" style="padding:8pt 24pt;font-size:11pt;cursor:pointer;background:#ca8a04;color:#fff;border:none;border-radius:6pt">🖨 Печать</button></div>' +
      '</body></html>'
    );
    w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 400);
  }

  /* Клик по названию месяца: та же таблица по дням, слева — все объекты графика */
  function openGraphMonthModal(mi) {
    var g = graphsFind(GS.cur);
    if (!g) return;
    var rows = (g.objs || []).filter(function (ob) { return !ob.hide; }).map(function (ob) {
      return { type: ob.type, label: ob.name, title: ob.name, src: ob };
    });
    GS.printView = { mode: 'month', mi: mi };
    var h = '<div class="modal-h"><h3>График на ' + MONTHS_RU[mi] + ' ' + g.year + ' — все объекты</h3><div style="flex:1"></div>' +
      '<button type="button" class="btn sm" data-action="graphs-print-view" style="background:#ca8a04;border-color:#ca8a04;color:#fff;margin-right:10px" title="Распечатать график на месяц">' + GT_ICONS.printer + ' Печать графика</button>' +
      '<button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">' + (rows.length ? graphDaysTableHtml(g, rows, mi) : '<div class="empty">В графике пока нет объектов</div>') + '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '1060px';
    overlay.classList.add('show');
  }

  /* Добавление отмеченных объектов в текущий график (снимок: тип, имя, ответственный) */
  function graphsAddObjs() {
    var g = graphsFind(GS.cur);
    if (!g) { overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
    if (!g.objs) g.objs = [];
    var inputs = document.querySelectorAll('#gao-list input[type=checkbox]:checked');
    var added = 0;
    var newIdx = []; // 22.09-138: индексы добавленных объектов в g.objs
    for (var i = 0; i < inputs.length; i++) {
      var o = OBJ_MAP[inputs[i].getAttribute('data-gao')];
      if (!o) continue;
      newIdx.push(g.objs.length);
      g.objs.push({ oid: o.id, type: o.type || 'ГРП', name: objFullAddr(o), respId: o.respId || '', respName: o.respName || '' });
      added++;
    }
    if (!added) { toast('err', 'Отметьте объекты для добавления'); return; }
    // 22.09-138: у добавленного объекта мог уже быть ОБЩИЙ набор работ (задан
    // в другом графике) — подтягиваем его и сразу считаем даты от якоря
    // (серия продолжается от даты первого проведения, без перезапуска по годам)
    var areaAdd = graphAreaDefault(g), impRows = 0, impTasks = 0;
    newIdx.forEach(function (ri) {
      var ent = g.objs[ri];
      var cfg = graphObjWorksCfg(ent.oid);
      if (!cfg.length) return;
      impRows += cfg.length;
      ent.works = cfg.map(function (r) { return { sid: gwNewSid(), wid: r.wid, period: r.period, dev: r.dev, first: r.first, occs: [] }; });
      ent.works.forEach(function (w) { var s2 = gwGenObjSeries(g, ri, areaAdd, ent, w, false); impTasks += s2.created; });
    });
    var list = graphsLoad();
    list.forEach(function (x) { if (x.id === g.id) x.objs = g.objs; });
    graphsSaveList(list);
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    logAction('Объекты добавлены в график', g.name + ': ' + added + ' шт.');
    toast('ok', 'Добавлено объектов в график: ' + added + (impRows ? '. Подтянуты их общие наборы работ: ' + impRows + ' строк' + (impTasks ? ' (создано задач: ' + impTasks + ')' : '') : ''));
    if (S.screen === 'graphs') renderGraphs(); else setScreen('graphs');
  }

  /* Окно «Список графиков»: выбор сохранённого графика */
  function openGraphsListModal() {
    var list = graphsLoad();
    var h = '<div class="modal-h"><h3>Список графиков</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    if (!list.length) {
      h += '<div class="empty" style="padding:44px 20px;font-size:12.5px">Нет сохранённых графиков.<br>' +
        '<span style="color:var(--muted);font-size:12px">Создайте график кнопкой «Новый график».</span></div>';
    } else {
      h += '<div style="display:flex;flex-direction:column;gap:8px">';
      list.slice().sort(function (a, b) { return (b.created || 0) - (a.created || 0); }).forEach(function (g) {
        h += '<div class="gl-row' + (GS.cur === g.id ? ' cur' : '') + '" data-action="graphs-pick" data-gid="' + esc(g.id) + '">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="flex:0 0 18px;color:var(--blue)"><path d="M3 21h18"/><path d="M7 17v-6"/><path d="M12 17V6"/><path d="M17 17v-10"/></svg>' +
          '<div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(g.name) + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted)">' + esc(String(g.year)) + (g.respName ? ' · ' + esc(g.respName) : '') + '</div></div>' +
          (GS.cur === g.id ? '<span class="chip" style="background:#dbeafe;color:#1d4ed8">выбран</span>' : '') +
          '<button type="button" class="gt-btn gt-blue" data-action="graphs-edit" data-gid="' + esc(g.id) + '" data-tip="Редактировать график">' + GT_ICONS.pencil + '</button>' +
          '<button type="button" class="gt-btn gt-green" data-action="graphs-copy" data-gid="' + esc(g.id) + '" data-tip="Копировать график">' + GT_ICONS.copy + '</button>' +
          '<button type="button" class="gt-btn gt-red" data-action="graphs-del" data-gid="' + esc(g.id) + '" data-tip="Удалить график">' + GT_ICONS.trash + '</button>' +
          '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '480px';
    overlay.classList.add('show');
  }

  /* Выбор графика из списка */
  function graphsPick(gid) {
    var g = graphsFind(gid);
    if (!g) return;
    graphsCurSave(gid);
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    toast('ok', 'Выбран график «' + g.name + '»');
    if (S.screen === 'graphs') renderGraphs(); else setScreen('graphs');
  }

  /* «Создать» — сохраняет график (наименование, год, ответственный) и
     открывает его: под шапкой страницы появляется панель инструментов.
     Наполнение графика работами и отрисовка — следующими постановками. */
  function graphsCreate() {
    var ni = document.getElementById('gn-name');
    var yi = document.getElementById('gn-year');
    var ri = document.getElementById('gn-resp');
    var name = ni ? ni.value.trim() : '';
    if (!name) { toast('err', 'Укажите наименование графика'); if (ni) ni.focus(); return; }
    var year = parseInt(yi && yi.value, 10);
    if (!year || isNaN(year)) year = new Date().getFullYear();
    var respId = ri ? ri.value : '';
    var respName = '';
    (DB.getUsers() || []).forEach(function (u) { if (u && u.id === respId) respName = u.full_name || ''; });
    var g = {
      id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name, year: year, respId: respId, respName: respName,
      created: Date.now(), works: [], objs: []
    };
    var list = graphsLoad();
    list.push(g);
    graphsSaveList(list);
    graphsCurSave(g.id);
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    logAction('Создан график', name + ' (' + year + ')');
    toast('ok', 'График «' + name + '» создан — ' + year + ' год');
    if (S.screen === 'graphs') renderGraphs(); else setScreen('graphs');
  }

