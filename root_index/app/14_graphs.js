  /* ── часть 14 · app/14_graphs.js — график работ: страница, объекты, периодичность, автоподбор ── */
  /* =====================================================================
     СТРАНИЦА «ГРАФИКИ» (Планирование / Графики)
     =====================================================================
     Пункт меню «Графики» выезжает под «Планирование / Календарь» при
     наведении (.nav-acc в index.html). На странице — две кнопки:
       · «Новый график» — окно над страницей: период (год из списка),
         наименование, ответственный, внизу «Создать» (зелёная) и
         «Отменить» (красная);
       · «Список графиков» — окно над страницей со списком сохранённых
         графиков, клик по строке выбирает график; справа в каждой строке
         иконки редактирования (синяя), копирования (зелёная) и удаления
         (красная) — стиль как у кнопок панели, подпись при наведении.
     «Создать» сохраняет график и открывает его: под шапкой страницы
     появляется панель инструментов (.gtb): слева — «Добавить объект»,
     «Настроить периодичность», «Обозначения работ», «Фильтр»; справа —
     «Построить график», «Добавить новый объект», «Печать графика»,
     «Удалить работы». Кнопки — только цветной полузакруглённый контур
     без фона, иконка в цвет контура, подпись — всплывающим окошком
     при наведении (#gt-tip).
     Сохранённые графики: localStorage 'smartplan_graphs', выбранный —
     'smartplan_graphs_cur'. Действия кнопок панели (построение,
     добавление объектов, периодичность, печать, удаление) — следующими
     постановками. */
  var GRAPHS_KEY = 'smartplan_graphs';
  var GRAPHS_CUR_KEY = 'smartplan_graphs_cur';
  var GS = { cur: null, edit: null, del: null };
  function graphsLoad() {
    try { var l = JSON.parse(localStorage.getItem(GRAPHS_KEY) || '[]'); return Array.isArray(l) ? l : []; }
    catch (e) { return []; }
  }
  function graphsSaveList(list) {
    try { localStorage.setItem(GRAPHS_KEY, JSON.stringify(list || [])); } catch (e) {}
    // Сборка 22.09-25: синхронизация графиков с сервером Render
    if (window.SP_API && window.SP_API.getToken && window.SP_API.getToken()) {
      var arr = list || [];
      arr.forEach(function (g) {
        if (!g || !g.id) return;
        window.SP_API.upsert('graphs', g).catch(function (e) {
          console.warn('graphs sync failed for', g.id, e && e.err || e);
        });
      });
    }
  }
  function graphsCurSave(id) {
    GS.cur = id || null;
    try { if (id) localStorage.setItem(GRAPHS_CUR_KEY, id); else localStorage.removeItem(GRAPHS_CUR_KEY); } catch (e) {}
  }
  function graphsFind(id) {
    if (!id) return null;
    var found = null;
    graphsLoad().forEach(function (x) { if (x.id === id) found = x; });
    return found;
  }

  /* 22.09-227: объект встречается в нескольких графиках ОДНОГО года —
     предупреждение справа внизу страницы «График работ»: название графика,
     год и ФИО мастера. Задачи в планировании при этом не дублируются
     (см. gwFindPlanTask), но объект лучше держать в одном графике года. */
  function graphsDupWarnHtml() {
    if (S.graphDupWarnHidden) return '';
    var byObj = {};
    graphsLoad().forEach(function (g) {
      if (!g || !g.objs) return;
      g.objs.forEach(function (ob) {
        if (!ob || !ob.oid) return;
        var k = String(g.year) + '|' + ob.oid;
        if (!byObj[k]) byObj[k] = { year: g.year, name: ob.name || ob.oid, graphs: [], ids: {} };
        var e = byObj[k];
        if (!e.ids[g.id]) { e.ids[g.id] = 1; e.graphs.push(g); }
      });
    });
    var rows = '';
    Object.keys(byObj).sort().forEach(function (k) {
      var e = byObj[k];
      if (e.graphs.length < 2) return;
      var rest = e.graphs.filter(function (g) { return g.id !== GS.cur; });
      if (!rest.length) rest = e.graphs;
      var parts = rest.map(function (g) {
        var fio = g.respName || '';
        if (!fio) { try { (DB.getUsers() || []).forEach(function (u) { if (u && u.id === g.respId) fio = u.full_name || ''; }); } catch (eU) {} }
        return '«' + esc(g.name || '?') + '» (' + esc(String(g.year)) + ', мастер: ' + esc(fio || '—') + ')';
      }).join('; ');
      rows += '<div style="margin-top:4px">⚠ Объект <b>«' + esc(e.name) + '»</b> есть ещё в графике: ' + parts + '</div>';
    });
    if (!rows) return '';
    return '<div id="graph-dup-warn" style="position:fixed;right:12px;bottom:12px;z-index:90;max-width:360px;max-height:40vh;overflow:auto;background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.18);padding:8px 10px;font-size:12px;line-height:1.45;color:#78350f">' +
      '<div style="display:flex;align-items:center;gap:6px;font-weight:700">' +
      '<span>⚠ Объекты в нескольких графиках</span><span style="flex:1"></span>' +
      '<button type="button" data-action="graph-dup-hide" title="Скрыть предупреждение до перезахода на страницу" style="border:0;background:none;color:#b45309;cursor:pointer;font-size:14px;line-height:1;padding:0 2px">✕</button>' +
      '</div>' +
      '<div style="color:#92400e">Задачи в планировании за это не дублируются, но объект лучше держать в одном графике года.</div>' +
      rows + '</div>';
  }

  function renderGraphs() {
    if (!GS.cur) { try { GS.cur = localStorage.getItem(GRAPHS_CUR_KEY) || null; } catch (e) {} }
    var g = graphsFind(GS.cur);
    var html = '<div class="card">' +
      '<div class="card-h"><h2>График работ</h2><div class="spacer"></div>' +
      '<button type="button" class="btn ok" data-action="graphs-new">' + IC.plus + ' Новый график</button>' +
      '<button type="button" class="btn" data-action="graphs-list"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg> Список графиков</button>' +
      '</div>';
    // Панель инструментов — только когда график создан/выбран
    if (g) html += graphsToolbarHtml(g);
    html += '<div class="card-b" id="graphs-body"></div>' +
      '</div>';
    html += graphsDupWarnHtml(); // 22.09-227: предупреждение «объект в нескольких графиках года» — справа внизу
    view.innerHTML = html;
    drawGraphsBody();
    try { graphSnapsPush(); } catch (eSP) {} // 22.09-242: неотправленные копии (в т.ч. сохранённые до 242) — на сервер
  }

  /* Панель инструментов графика: слева служебные кнопки, справа — действия.
     Кнопка = полузакруглённый цветной контур без фона + иконка в цвет
     контура; подпись — всплывающее окошко (data-tip → #gt-tip). */
  var GT_ICONS = {
    bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M7 17v-6"/><path d="M12 17V6"/><path d="M17 17v-10"/></svg>',
    circleplus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>',
    pinplus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><path d="M12 7.5v5M9.5 10h5"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 01-4 4H3"/></svg>',
    legend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="6" r="1.6" fill="currentColor" stroke="none"/><path d="M10 6h11"/><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M10 12h11"/><circle cx="5" cy="18" r="1.6" fill="currentColor" stroke="none"/><path d="M10 18h11"/></svg>',
    funnel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 010 5"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
  };
  function graphsToolbarHtml(g) {
    // 22.09-124: «Сезоны» (бывш. «Настройка периодов») — после «Настроить периодичность».
    // 22.09-164: «Трудоёмкость графика» — слева от «Фильтра»; «Праздничные дни»
    // перенесены на страницу «Графики смен» (слева от выбора месяца).
    var left = [
      { tool: 'newobj', tip: 'Добавить объекты в график', cls: 'gt-green', icon: 'plus' },
      { tool: 'period', tip: 'Настроить периодичность', cls: 'gt-violet', icon: 'repeat' },
      { tool: 'winter', tip: 'Сезоны', cls: 'gt-sky', icon: 'snow' },
      { tool: 'legend', tip: 'Обозначения работ', cls: 'gt-rose', icon: 'legend' },
      { tool: 'snaps', tip: '22.09-226: Копии графика (автоматически сохраняются при каждой печати) — список, просмотр, восстановление выбранной копии', cls: 'gt-slate', icon: 'copy' }
    ];
    var right = [
      { tool: 'labor', tip: 'Трудоёмкость графика (за год, по месяцам, по объектам)', cls: 'gt-green', icon: 'bars' },
      { tool: 'filter', tip: 'Фильтр', cls: 'gt-slate', icon: 'funnel' },
      { tool: 'print', tip: 'Печать графика (в Excel)', cls: 'gt-amber', icon: 'printer' },
      { tool: 'delworks', tip: 'Удалить работы', cls: 'gt-red', icon: 'trash' }
    ];
    function btns(arr) {
      return arr.map(function (b) {
        return '<button type="button" class="gt-btn ' + b.cls + '" data-action="graphs-tool" data-tool="' + b.tool + '" data-tip="' + esc(b.tip) + '">' + GT_ICONS[b.icon] + '</button>';
      }).join('');
    }
    /* Посередине между левой и правой группами: сверху год и ответственный,
       под ними — наименование графика */
    var mid = '';
    if (g) {
      mid = '<div class="gt-mid">' +
        '<div class="gt-mid-top">' +
        '<span class="chip" style="background:#eff6ff;color:#1d4ed8">' + esc(String(g.year)) + '</span>' +
        (g.respName ? '<span class="chip" style="background:#f0fdf4;color:#15803d">' + esc(g.respName) + '</span>' : '') +
        '</div>' +
        '<span class="gt-name" title="' + esc(g.name) + '">' + esc(g.name) + '</span>' +
        '</div>';
    }
    return '<div class="gtb">' + btns(left) + '<div class="spacer"></div>' + mid + '<div class="spacer"></div>' + btns(right) + '</div>';
  }

  /* Всплывающие подписи кнопок панели графика (#gt-tip из index.html) */
  (function () {
    function tipEl() {
      var el = document.getElementById('gt-tip');
      if (!el) { el = document.createElement('div'); el.id = 'gt-tip'; document.body.appendChild(el); }
      return el;
    }
    document.addEventListener('mouseover', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.gt-btn[data-tip]') : null;
      var el = tipEl();
      if (!b) { el.classList.remove('show'); return; }
      el.textContent = b.getAttribute('data-tip');
      var r = b.getBoundingClientRect();
      el.classList.add('show');
      var w = el.offsetWidth, h = el.offsetHeight;
      var x = Math.round(r.left + r.width / 2 - w / 2);
      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      el.style.left = x + 'px';
      el.style.top = (r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8) + 'px';
    });
    window.addEventListener('scroll', function () { var el = document.getElementById('gt-tip'); if (el) el.classList.remove('show'); }, true);
  })();

  /* Всплывающее окно с информацией о работе при наведении на треугольник (#gw-tip) */
  (function () {
    function tipEl() {
      var el = document.getElementById('gw-tip');
      if (!el) { el = document.createElement('div'); el.id = 'gw-tip'; document.body.appendChild(el); }
      return el;
    }
    document.addEventListener('mouseover', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-gw-tip]') : null;
      var el = tipEl();
      if (!t) { el.classList.remove('show'); return; }
      el.innerHTML = t.getAttribute('data-gw-tip');
      var r = t.getBoundingClientRect();
      el.classList.add('show');
      var w = el.offsetWidth, hh = el.offsetHeight;
      var x = Math.round(r.left + r.width / 2 - w / 2);
      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      el.style.left = x + 'px';
      el.style.top = (r.top - hh - 8 >= 8 ? r.top - hh - 8 : r.bottom + 8) + 'px';
    });
    window.addEventListener('scroll', function () { var el = document.getElementById('gw-tip'); if (el) el.classList.remove('show'); }, true);
  })();

  // 22.09-201: в окне «Настроить периодичность» год в «Дате первого проведения» — не длиннее 4 цифр.
  // Поле type=date в части браузеров позволяет набрать год из 5–6 цифр — обрезаем до 4 при вводе и при изменении.
  (function () {
    function clampGprYear(e) {
      var t = e && e.target;
      if (!t || !t.getAttribute || !t.hasAttribute('data-gpr-f')) return;
      var v = String(t.value || '');
      var m = v.match(/^(\d{5,})(-.*)$/);
      if (m) t.value = m[1].slice(0, 4) + m[2];
    }
    document.addEventListener('input', clampGprYear);
    document.addEventListener('change', clampGprYear);
  })();

  /* 22.09-235: таблица графика на год (объекты × месяцы с треугольниками) — ОБЩАЯ
     для страницы «График работ» и окна просмотра сохранённой копии графика.
     ro = true — только просмотр: ячейки и месяцы не нажимаются (без data-action). */
  function gwYearGridHtml(g, ro) {
    var h = '<div class="gw-scroll' + (ro ? ' gw-ro' : '') + '"><div class="gw-grid">';
    h += '<div class="gw-h gw-corner">Объект<span>' + esc(String(g.year)) + ' год</span></div>';
    var winterM = gwWinterMonths(g); // 22.09-121: столбцы месяцев с зимними днями — голубее
    for (var mi = 0; mi < 12; mi++) {
      h += '<div class="gw-h gw-m"' + (winterM[mi] ? ' style="background:#e0f0fb"' : '') +
        (ro ? '' : ' data-action="graphs-month-view" data-mi="' + mi + '" title="Открыть график всех объектов на ' + MONTHS_RU[mi] + '"') +
        '>' + MONTHS_RU[mi] + '</div>';
    }
    (g.objs || []).forEach(function (ob, ri) {
      if (!ob || ob.hide) return; // фильтр графика: скрытые объекты не показываются
      h += '<div class="gw-obj"><span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span><span class="gw-obj-nm" title="' + esc(ob.name) + '">' + esc(ob.name) + '</span></div>';
      for (var ci = 0; ci < 12; ci++) {
        h += '<div class="gw-c"' + (winterM[ci] ? ' style="background:#e0f0fb"' : '') +
          (ro ? '' : ' data-action="graphs-obj-month" data-ri="' + ri + '" data-mi="' + ci + '" title="График объекта · ' + MONTHS_RU[ci] + '"') +
          '>' + gwMonthTriangles(g, ob, ci) + '</div>';
      }
    });
    h += '</div></div>';
    return h;
  }

  function drawGraphsBody() {
    var body = document.getElementById('graphs-body');
    if (!body) return;
    var g = graphsFind(GS.cur);
    if (!g) {
      GS.cur = null;
      body.innerHTML = '<div class="empty" style="padding:52px 20px">' +
        '<div style="font-size:40px;margin-bottom:12px">📈</div>' +
        '<div style="color:var(--ink);font-size:15px;font-weight:700">График не выбран</div>' +
        '<div style="margin-top:8px;font-size:12.5px;max-width:480px;margin-left:auto;margin-right:auto">Нажмите «Новый график», чтобы создать график, или «Список графиков», чтобы открыть сохранённый график.</div>' +
        '</div>';
      return;
    }
    // Таблица графика: слева — объекты (строки), сверху — месяцы января→декабря
    // года графика, в ячейках — треугольники работ (общий построитель gwYearGridHtml, 22.09-235).
    if (g.objs && g.objs.length) {
      // ни у одного объекта нет работ — заметная подсказка вместо «пустых» ячеек
      var anyWork = g.objs.some(function (ob) { return !ob.hide && gwObjWorks(ob).some(function (w) { return w.wid; }); });
      var h = (anyWork ? '' : '<div class="calc" style="margin-bottom:10px;align-items:flex-start;border-left:4px solid var(--yellow)">⚠ Работы не заданы ни у одного объекта — треугольников нет. Нажмите «Настроить периодичность» на панели слева, выберите вид работы, периодичность и дату первого проведения.</div>') +
        gwYearGridHtml(g, false);
      body.innerHTML = h;
      return;
    }
    body.innerHTML = '<div class="empty" style="padding:34px 20px">' +
      '<div style="font-size:34px;margin-bottom:10px">📋</div>' +
      '<div style="color:var(--ink);font-size:14px;font-weight:700">Работы в графике пока не добавлены</div>' +
      '<div style="margin-top:8px;font-size:12.5px;max-width:520px;margin-left:auto;margin-right:auto">Нажмите «Добавить объекты в график» на панели слева и выберите объекты ГРП/ШРП/ГРС/ПГРП из справочника — они появятся в таблице. Подписи кнопок панели появляются при наведении.</div>' +
      '</div>';
  }

  /* Окно «Новый график»: период (год), наименование, ответственный */
  function openGraphsNewModal() {
    GS.edit = null; // это создание, не правка
    var Y = new Date().getFullYear();
    var years = '';
    for (var y = Y - 1; y <= Y + 3; y++) years += '<option value="' + y + '"' + (y === Y ? ' selected' : '') + '>' + y + ' год</option>';
    // Ответственный — только мастера (это строки планирования): иначе работы
    // графика не будут отображаться в календаре
    var masters = getMasters().map(function (m) { return { id: m.id, name: m.name, role: m.role }; });
    masters.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'ru'); });
    var resp = '';
    if (!masters.length) resp = '<option value="">— нет мастеров —</option>';
    else {
      var defId = masters[0].id;
      masters.forEach(function (m) { if (S.user && String(m.id) === String(S.user.id)) defId = m.id; }); // 22.09-188
      masters.forEach(function (m) {
        var lbl = ROLE_INFO[m.role] ? ROLE_INFO[m.role].label : m.role;
        resp += '<option value="' + esc(m.id) + '"' + (m.id === defId ? ' selected' : '') + '>' + esc(m.name) + ' · ' + esc(lbl) + '</option>';
      });
    }
    var h = '<div class="modal-h"><h3>Новый график</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div class="fld"><label>Период</label><select id="gn-year">' + years + '</select></div>';
    h += '<div class="fld"><label>Наименование</label><input id="gn-name" type="text" maxlength="120" placeholder="Например: График обслуживания ГРП на год"></div>';
    h += '<div class="fld" style="margin-bottom:0"><label>Ответственный</label><select id="gn-resp">' + resp + '</select></div>';
    h += '</div>';
    h += '<div class="modal-f">' +
      '<button type="button" class="btn ok" data-action="graphs-create">Создать</button>' +
      '<button type="button" class="btn danger" data-action="close-modal">Отменить</button>' +
      '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '480px';
    overlay.classList.add('show');
    var ni = document.getElementById('gn-name');
    if (ni) {
      ni.focus();
      ni.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); graphsCreate(); }
      });
    }
  }

  /* Окно «Редактировать график»: те же поля, что при создании, но с текущими
     значениями графика; внизу «Сохранить» (зелёная) и «Отменить» (красная) */
  function openGraphsEditModal(gid) {
    var g = graphsFind(gid);
    if (!g) return;
    GS.edit = gid;
    var Y = new Date().getFullYear();
    var years = '';
    for (var y = Math.min(Y - 1, g.year); y <= Math.max(Y + 3, g.year); y++) {
      years += '<option value="' + y + '"' + (y === g.year ? ' selected' : '') + '>' + y + ' год</option>';
    }
    // Ответственный — мастера (строки планирования); текущий не-мастер
    // сохраняется в списке, чтобы ничего не менялось молча
    var masters = getMasters().map(function (m) { return { id: m.id, name: m.name, role: m.role }; });
    masters.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'ru'); });
    var resp = '';
    if (!masters.length) resp = '<option value="">— нет мастеров —</option>';
    else masters.forEach(function (m) {
      var lbl = ROLE_INFO[m.role] ? ROLE_INFO[m.role].label : m.role;
      resp += '<option value="' + esc(m.id) + '"' + (m.id === g.respId ? ' selected' : '') + '>' + esc(m.name) + ' · ' + esc(lbl) + '</option>';
    });
    var curIsMaster = masters.some(function (m) { return m.id === g.respId; });
    if (g.respId && !curIsMaster) {
      var cu = null;
      (DB.getUsers() || []).forEach(function (u) { if (u && u.id === g.respId) cu = u; });
      resp = '<option value="' + esc(g.respId) + '" selected>' + esc(cu ? cu.full_name : g.respId) + ' · не мастер</option>' + resp;
    }
    var h = '<div class="modal-h"><h3>Редактировать график</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div class="fld"><label>Период</label><select id="gn-year">' + years + '</select></div>';
    h += '<div class="fld"><label>Наименование</label><input id="gn-name" type="text" maxlength="120" value="' + esc(g.name) + '"></div>';
    h += '<div class="fld" style="margin-bottom:0"><label>Ответственный</label><select id="gn-resp">' + resp + '</select></div>';
    h += '</div>';
    h += '<div class="modal-f">' +
      '<button type="button" class="btn ok" data-action="graphs-save">Сохранить</button>' +
      '<button type="button" class="btn danger" data-action="close-modal">Отменить</button>' +
      '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '480px';
    overlay.classList.add('show');
    var ni = document.getElementById('gn-name');
    if (ni) {
      ni.focus();
      ni.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); graphsSave(); }
      });
    }
  }

  /* «Сохранить» в окне правки: обновляет наименование, год, ответственного */
  function graphsSave() {
    var gid = GS.edit;
    var g = graphsFind(gid);
    if (!g) { GS.edit = null; overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
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
    var oldYear = g.year || year;
    var list = graphsLoad();
    var gg = null;
    list.forEach(function (x) {
      if (x.id === gid) { x.name = name; x.year = year; x.respId = respId; x.respName = respName; gg = x; }
    });
    // 22.09-140: год изменился — серии пересчитываем на новый год (от тех же
    // дат первого проведения, без перезапуска). Режим 'auto' — самолечение:
    // год меняли раньше без пересчёта (даты серии остались старого года).
    var rs = gg ? graphYearResync(gg, oldYear !== year ? 'all' : 'auto') : null;
    graphsSaveList(list);
    GS.edit = null;
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    logAction('Изменён график', name + ' (' + year + ')');
    toast('ok', 'График «' + name + '» обновлён');
    if (rs && rs.series) {
      if (TASKS_DB) S.tasks = TASKS_DB.getTasks();
      toast('ok', '📅 Работы пересчитаны на ' + year + ' год — серии продолжаются от дат первого проведения: серий ' + rs.series + ', задач создано ' + rs.created + (rs.removed ? ', убрано прежних ' + rs.removed : '') + (rs.kept ? ', сохранено выполненных ' + rs.kept : '') + (rs.dup ? ', уже были в планировании (без дублей): ' + rs.dup : ''));
      if (rs.yaw) toast('warn', '⚠ У ' + rs.yaw + ' работ дата первого проведения позже ' + year + ' года — они не попадут в график.');
      if (rs.shifted) toast('ok', '⏮ По графику смен мастера: ' + rs.shifted + ' вхождений перенесено на ближайший предыдущий рабочий день.');
      if (rs.fail) toast('warn', '⚠ Не удалось создать задач: ' + rs.fail + ' (возможно, память браузера переполнена). Треугольники выставлены.');
    }
    if (S.screen === 'graphs' && GS.cur === gid) renderGraphs(); // шапка в панели обновится
    openGraphsListModal(); // возвращаемся к списку — изменения видны сразу
  }

  /* Копирование: дубликат графика с теми же параметрами («… (копия)») */
  function graphsCopy(gid) {
    var g = graphsFind(gid);
    if (!g) return;
    var copy;
    try { copy = JSON.parse(JSON.stringify(g)); } catch (e) { return; }
    copy.id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    copy.name = g.name + ' (копия)';
    copy.created = Date.now();
    var list = graphsLoad();
    list.push(copy);
    graphsSaveList(list);
    logAction('Скопирован график', g.name + ' → ' + copy.name);
    toast('ok', 'Создана копия: «' + copy.name + '»');
    openGraphsListModal(); // обновлённый список
  }

  /* Окно подтверждения удаления графика */
  function openGraphsDelModal(gid) {
    var g = graphsFind(gid);
    if (!g) return;
    GS.del = gid;
    var h = '<div class="modal-h"><h3>Удалить график?</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b"><div style="font-size:13px;color:var(--ink);line-height:1.6">График <b>«' + esc(g.name) + '»</b> (' + esc(String(g.year)) + ') будет удалён безвозвратно.</div></div>';
    h += '<div class="modal-f">' +
      '<button type="button" class="btn" data-action="graphs-del-cancel">Отмена</button>' +
      '<button type="button" class="btn danger" data-action="graphs-del-confirm">Удалить</button>' +
      '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '440px';
    overlay.classList.add('show');
  }

  /* Удаление графика (после подтверждения) */
  function graphsDelete() {
    var gid = GS.del;
    if (!gid) { overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
    var g = graphsFind(gid);
    var list = graphsLoad().filter(function (x) { return x.id !== gid; });
    graphsSaveList(list);
    // Сборка 22.09-25: удалить график с сервера
    if (window.SP_API && window.SP_API.getToken && window.SP_API.getToken()) {
      window.SP_API.del('graphs', gid).catch(function (e) {
        console.warn('graphs delete sync failed:', e && e.err || e);
      });
    }
    GS.del = null;
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    if (GS.cur === gid) {
      graphsCurSave(null);
      if (S.screen === 'graphs') renderGraphs(); // панель уйдёт — график не выбран
    }
    logAction('Удалён график', g ? g.name + ' (' + g.year + ')' : gid);
    toast('ok', 'График удалён');
    openGraphsListModal(); // возвращаемся к обновлённому списку
  }

  /* Месяцы для таблицы графика (строки — объекты, столбцы — месяцы года) */
  var MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  /* Окно «Добавить объекты в график»: справочник ГРП/ШРП/ГРС/ПГРП с
     мультивыбором (чекбоксы) и ОТДЕЛЬНЫМИ фильтрами — тип объекта и
     ответственный. Уже добавленные в график объекты в списке НЕ ПОКАЗЫВАЮТСЯ.
     allowDup=true (кнопка «Добавить новый объект») — показывает все объекты,
     включая добавленные: объект можно внести в график повторно (например,
     несколько обслуживаний за год). */
  function openGraphAddObjsModal(allowDup) {
    var g = graphsFind(GS.cur);
    if (!g) { toast('err', 'Сначала создайте или выберите график'); return; }
    GS.gaoDup = !!allowDup;
    GS.gaoMode = 'add'; // 22.09-143: «Добавить» / «Удалить» — два режима одного окна
    // 22.09-82: в фильтре «Ответственный» — только мастера (ст. мастера, нач. участка),
    // как в окне создания графика. Слесарей и прочие роли здесь быть не должно.
    var users = getMasters().slice();
    users.sort(function (a, b) { return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru'); });
    var respOpts = '<option value="">Все ответственные</option>';
    users.forEach(function (u) {
      var lbl = u.prof || (ROLE_INFO[u.role] ? ROLE_INFO[u.role].label : u.role);
      respOpts += '<option value="' + esc(u.id) + '">' + esc(u.full_name) + ' · ' + esc(lbl) + '</option>';
    });
    var typeOpts = '<option value="">Все типы</option>';
    OBJ_GAS_TYPES.forEach(function (t) { typeOpts += '<option value="' + t + '">' + t + '</option>'; });
    var h = '<div class="modal-h"><h3 style="font-size:13.5px;line-height:1.35">' +
      '<span id="gao-tab-add" data-action="gao-mode" data-m="add" style="cursor:pointer">Добавить объекты в график</span>' +
      '<span style="color:var(--line);font-weight:400;user-select:none;padding:0 7px">|</span>' +
      '<span id="gao-tab-del" data-action="gao-mode" data-m="del" style="cursor:pointer;opacity:.45">Удалить объекты из графика</span>' +
      '</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    h += '<div class="fld"><label>Тип объекта</label><select id="gao-type">' + typeOpts + '</select></div>';
    h += '<div class="fld"><label>Ответственный</label><select id="gao-resp">' + respOpts + '</select></div>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:2px">' +
      '<button type="button" class="btn sm" id="gao-all" style="font-weight:700">Выбрать все</button>' +
      '<span id="gao-count" style="font-size:12.5px;color:var(--muted);font-weight:700"></span>' +
      '</div>';
    h += '<div id="gao-list" style="display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow-y:auto;padding:2px"></div>';
    h += '</div>';
    h += '<div class="modal-f">' +
      '<button type="button" class="btn ok" data-action="graphs-add-objs" id="gao-add" disabled>Добавить в график</button>' +
      '<button type="button" class="btn danger" data-action="graphs-del-objs" id="gao-del" style="display:none" disabled>Удалить из графика</button>' +
      '<button type="button" class="btn danger" data-action="close-modal">Отменить</button>' +
      '</div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '560px';
    overlay.classList.add('show');
    graphsGaoRender();
    var allBtn = document.getElementById('gao-all');
    if (allBtn) allBtn.addEventListener('click', graphsGaoToggleAll);
    var tSel = document.getElementById('gao-type');
    if (tSel) tSel.addEventListener('change', graphsGaoRender);
    var sel = document.getElementById('gao-resp');
    if (sel) sel.addEventListener('change', graphsGaoRender);
  }

  /* Список объектов для окна добавления: только ГРП/ШРП/ГРС/ПГРП,
     фильтры по типу и ответственному. В обычном режиме («Добавить
     объект») уже добавленные в график объекты скрыты из списка;
     режим «Добавить новый объект» (GS.gaoDup) показывает все. */
  function graphsGaoRender() {
    var box = document.getElementById('gao-list');
    var g = graphsFind(GS.cur);
    if (!box || !g) return;
    if (!g.objs) g.objs = [];
    var inGraph = {};
    if (!GS.gaoDup) g.objs.forEach(function (x) { inGraph[x.oid] = 1; });
    var typeSel = document.getElementById('gao-type');
    var fType = typeSel ? typeSel.value : '';
    var respSel = document.getElementById('gao-resp');
    var respId = respSel ? respSel.value : '';
    // 22.09-143, режим «Удалить объекты из графика»: список — только то, что
    // УЖЕ есть в графике; все строки отмечены, СНЯТАЯ галочка = убрать из
    // графика. Строка привязана к позиции в g.objs (объект может повторяться).
    if (GS.gaoMode === 'del') {
      var rows = [];
      g.objs.forEach(function (ob, ri) {
        if (!ob) return;
        var ref = null;
        try { ref = (typeof OBJ_MAP !== 'undefined' && OBJ_MAP[ob.oid]) || null; } catch (e) {}
        var type = (ref && ref.type) || ob.type || '';
        var addr = ref ? objFullAddr(ref) : (ob.name || ob.oid || '?');
        var resp = ref ? (ref.respId || '') : (ob.respId || '');
        var respName = (ref && ref.respName) || ob.respName || '';
        if (fType && type !== fType) return;
        if (respId && resp !== respId) return;
        rows.push({ ri: ri, type: type, addr: addr, respName: respName });
      });
      rows.sort(function (x, y) {
        var ti = OBJ_GAS_TYPES.indexOf(x.type) - OBJ_GAS_TYPES.indexOf(y.type);
        if (ti) return ti;
        return String(x.addr).localeCompare(String(y.addr), 'ru');
      });
      if (!rows.length) {
        box.innerHTML = '<div class="empty" style="padding:26px 14px;font-size:12.5px">' +
          ((fType || respId) ? 'Нет объектов графика по выбранным фильтрам (тип объекта / ответственный).' : 'В этом графике пока нет объектов — сначала добавьте их на вкладке «Добавить объекты в график» выше.') + '</div>';
      } else {
        var hd = '<div style="font-size:12.5px;color:var(--muted);padding:0 2px 2px">Снимите галочки у объектов, которые нужно убрать из графика:</div>';
        rows.forEach(function (r) {
          hd += '<label class="gao-row">' +
            '<input type="checkbox" data-gao-ri="' + r.ri + '" checked style="accent-color:#dc2626;width:15px;height:15px;cursor:pointer;flex:0 0 auto;margin:0">' +
            '<span class="chip ' + esc(r.type) + '">' + esc(r.type) + '</span>' +
            '<span style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r.addr) + '">' + esc(r.addr) + '</span>' +
            (r.respName ? '<span style="font-size:12px;color:var(--muted);flex:0 0 auto">' + esc(r.respName) + '</span>' : '') +
            '</label>';
        });
        box.innerHTML = hd;
      }
      var inD = box.querySelectorAll('input[type=checkbox]');
      for (var di = 0; di < inD.length; di++) inD[di].addEventListener('change', graphsGaoSyncBtn);
      graphsGaoSyncBtn();
      return;
    }
    var gasTotal = 0;
    var objs = OBJECTS.filter(function (o) {
      if (!o || !isGasType(o.type)) return false; // только ГРП/ШРП/ГРС/ПГРП
      gasTotal++;
      if (fType && o.type !== fType) return false;
      if (respId && (o.respId || '') !== respId) return false;
      if (inGraph[o.id]) return false; // добавленные в график не показываем
      return true;
    });
    objs.sort(function (a, b) {
      var ti = OBJ_GAS_TYPES.indexOf(a.type) - OBJ_GAS_TYPES.indexOf(b.type);
      if (ti) return ti;
      return String(objFullAddr(a)).localeCompare(String(objFullAddr(b)), 'ru');
    });
    if (!objs.length) {
      box.innerHTML = '<div class="empty" style="padding:26px 14px;font-size:12.5px">' +
        ((fType || respId) ? 'Нет объектов по выбранным фильтрам (тип объекта / ответственный).' : (gasTotal ? 'Все объекты справочника уже добавлены в график.' : 'Нет объектов ГРП/ШРП/ГРС/ПГРП в справочнике.')) + '</div>';
    } else {
      var h = '';
      objs.forEach(function (o) {
        h += '<label class="gao-row">' +
          '<input type="checkbox" data-gao="' + esc(o.id) + '" style="accent-color:#16a34a;width:15px;height:15px;cursor:pointer;flex:0 0 auto;margin:0">' +
          '<span class="chip ' + esc(o.type) + '">' + esc(o.type) + '</span>' +
          '<span style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(objFullAddr(o)) + '">' + esc(objFullAddr(o)) + '</span>' +
          (o.respName ? '<span style="font-size:12px;color:var(--muted);flex:0 0 auto">' + esc(o.respName) + '</span>' : '') +
          '</label>';
      });
      box.innerHTML = h;
    }
    var inputs = box.querySelectorAll('input[type=checkbox]');
    for (var i = 0; i < inputs.length; i++) inputs[i].addEventListener('change', graphsGaoSyncBtn);
    graphsGaoSyncBtn();
  }

  /* 22.09-143: переключатель режимов окна — «Добавить» / «Удалить».
     Активная фраза яркая, вторая полупрозрачная; клик по полупрозрачной
     переключает список и кнопку подвала. */
  function gaoSetMode(m) {
    GS.gaoMode = m === 'del' ? 'del' : 'add';
    var ta = document.getElementById('gao-tab-add'), td = document.getElementById('gao-tab-del');
    if (ta) ta.style.opacity = GS.gaoMode === 'add' ? '1' : '.45';
    if (td) td.style.opacity = GS.gaoMode === 'del' ? '1' : '.45';
    var ba = document.getElementById('gao-add'), bd = document.getElementById('gao-del');
    if (ba) ba.style.display = GS.gaoMode === 'add' ? '' : 'none';
    if (bd) bd.style.display = GS.gaoMode === 'del' ? '' : 'none';
    graphsGaoRender();
  }

  /* «Выбрать все»: отмечает все доступные объекты (повторное нажатие — снимает) */
  function graphsGaoToggleAll() {
    var inputs = document.querySelectorAll('#gao-list input[type=checkbox]');
    var enabled = [];
    for (var i = 0; i < inputs.length; i++) if (!inputs[i].disabled) enabled.push(inputs[i]);
    var anyUnchecked = false;
    for (var j = 0; j < enabled.length; j++) if (!enabled[j].checked) anyUnchecked = true;
    for (var k = 0; k < enabled.length; k++) enabled[k].checked = anyUnchecked;
    graphsGaoSyncBtn();
  }

  /* Кнопка действия окна — активна, когда есть что применить.
     Режим «Добавить»: ОТМЕЧЕННЫЕ попадут в график; режим «Удалить»
     (22.09-143): СНЯТЫЕ галочки будут убраны из графика. */
  function graphsGaoSyncBtn() {
    var delMode = GS.gaoMode === 'del';
    var btn = document.getElementById(delMode ? 'gao-del' : 'gao-add');
    if (!btn) return;
    var inputs = document.querySelectorAll('#gao-list input[type=checkbox]');
    var total = 0, checked = 0;
    for (var i = 0; i < inputs.length; i++) {
      if (!inputs[i].disabled) { total++; if (inputs[i].checked) checked++; }
    }
    var cnt = document.getElementById('gao-count');
    if (delMode) {
      var off = total - checked;
      btn.disabled = !off;
      btn.textContent = off ? 'Удалить из графика (' + off + ')' : 'Удалить из графика';
      if (cnt) cnt.textContent = total ? ('Убрать из графика: ' + off + ' из ' + total) : '';
    } else {
      btn.disabled = !checked;
      btn.textContent = checked ? 'Добавить в график (' + checked + ')' : 'Добавить в график';
      if (cnt) cnt.textContent = total ? ('Выбрано: ' + checked + ' из ' + total) : '';
    }
    var ab = document.getElementById('gao-all');
    if (ab) {
      ab.textContent = (total > 0 && checked === total) ? 'Снять выделение' : 'Выбрать все';
      ab.style.display = total ? '' : 'none';
    }
  }

  /* 22.09-143: «Удалить из графика» — убирает из графика объекты со СНЯТОЙ
     галочкой. Задачи их серий: невыполненные удаляются, выполненные —
     отвязываются от серии и остаются в истории (как при уборке работы из
     общего набора, 22.09-138). */
  function graphsDelObjs() {
    var g = graphsFind(GS.cur);
    if (!g) { overlay.classList.remove('show'); modal.style.maxWidth = ''; return; }
    if (!g.objs || !g.objs.length) { toast('warn', 'В графике нет объектов'); return; }
    var inputs = document.querySelectorAll('#gao-list input[type=checkbox]');
    var ris = [];
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].getAttribute('data-gao-ri') != null && !inputs[i].checked) {
        var ri0 = parseInt(inputs[i].getAttribute('data-gao-ri'), 10);
        if (!isNaN(ri0)) ris.push(ri0);
      }
    }
    if (!ris.length) { toast('warn', 'Снимите галочки у объектов, которые нужно убрать из графика'); return; }
    var removedObjs = 0, killTasks = 0, keptTasks = 0;
    ris.sort(function (a, b) { return b - a; }); // с конца — splice не ломает индексы
    ris.forEach(function (ri) {
      var ob = g.objs[ri];
      if (!ob) return;
      gwObjWorks(ob).forEach(function (w) {
        (w.occs || []).forEach(function (oc) {
          if (!oc || !oc.tid || !TASKS_DB) return;
          var tk = null; try { tk = TASKS_DB.getTask(oc.tid); } catch (e) {}
          if (!tk) return;
          if (isDone(tk)) { // выполненная — отвязать, но сохранить историю
            try { TASKS_DB.updateTask(tk.id, { graphId: '', graphRi: null, graphSid: '' }); } catch (e2) {}
            keptTasks++;
          } else {
            try { TASKS_DB.hardDeleteTask(tk.id); } catch (e3) {}
            killTasks++;
          }
        });
      });
      g.objs.splice(ri, 1);
      removedObjs++;
    });
    var list = graphsLoad();
    for (var j = 0; j < list.length; j++) if (list[j].id === g.id) list[j].objs = g.objs;
    graphsSaveList(list);
    if (TASKS_DB) S.tasks = TASKS_DB.getTasks();
    logAction('Объекты убраны из графика', g.name + ': ' + removedObjs + ' шт.');
    toast('ok', 'Убрано объектов из графика: ' + removedObjs + (killTasks ? '; удалено запланированных задач: ' + killTasks : '') + (keptTasks ? '; выполненные сохранены в истории: ' + keptTasks : ''));
    if (S.screen === 'graphs') renderGraphs();
    graphsGaoRender(); // список в окне обновился
  }

  /* Обозначения работ графика: работы ВЫБРАННОГО УЧАСТКА (справочник видов
     работ) + выбор цвета треугольника для каждой работы. Цвета хранятся
     в графике (workColors) и используются в ячейках таблиц объект×месяц
     и в таблицах по дням. */
  var GW_COLOR_PALETTE = ['#ff6347', '#338dff', '#5bff33', '#ffff00', '#000000', '#aa8f7a', '#ffa500', '#964b00', '#9333ea', '#0d9488', '#e11d48', '#4f46e5', '#84cc16', '#be123c', '#065f46', '#4338ca'];
  function gwTriangle(color, size) {
    size = size || 16;
    return '<svg viewBox="0 0 20 24" width="' + size + '" height="' + Math.round(size * 1.2) + '" style="flex:0 0 auto;display:block"><polygon points="20,0 20,24 0,24" fill="' + color + '"/></svg>';
  }
  /* ОДИН треугольник, разделённый на N цветных сегментов: сектора из вершины
     прямого угла (20,24) к точкам, делящим гипотенузу (20,0)→(0,24) на n равных
     частей. Используется, когда на один день попадает несколько работ. */
  function gwMultiTriangle(colors, size) {
    size = size || 16;
    if (!colors || !colors.length) return '';
    if (colors.length === 1) return gwTriangle(colors[0], size);
    function r2(x) { return Math.round(x * 100) / 100; }
    var n = colors.length, parts = [];
    for (var i = 0; i < n; i++) {
      parts.push('<path d="M20 24 L' + r2(20 - 20 * i / n) + ' ' + r2(24 * i / n) + ' L' + r2(20 - 20 * (i + 1) / n) + ' ' + r2(24 * (i + 1) / n) + ' Z" fill="' + colors[i] + '"/>');
    }
    return '<svg viewBox="0 0 20 24" width="' + size + '" height="' + Math.round(size * 1.2) + '" style="flex:0 0 auto;display:block">' + parts.join('') + '</svg>';
  }
  /* Путь группы работы (нормализованный): 22.09-145 — цвета и обозначения по группам */
  function gwWorkGroup(w) { return w ? String(w.group || '').replace(/\s+/g, ' ').trim() : ''; }
  /* Цвет работы: 22.09-145 — у всех работ ОДНОЙ группы один цвет.
     Приоритет: цвет, назначенный группе в «Обозначениях работ» (ключ 'grp:путь')
     → старый индивидуальный цвет работы → палитра по индексу ПЕРВОЙ работы
     группы (по умолчанию работы группы тоже совпадают по цвету). */
  function gwColorOf(g, wid) {
    var works = [];
    try { works = WORK.getWorks(graphAreaDefault(g)) || []; } catch (e) {}
    var idx = -1;
    for (var i = 0; i < works.length; i++) if (works[i].id === wid) { idx = i; break; }
    var w = idx >= 0 ? works[idx] : null;
    var gp = gwWorkGroup(w);
    if (gp && g && g.workColors && g.workColors['grp:' + gp]) return g.workColors['grp:' + gp];
    if (g && g.workColors && g.workColors[wid]) return g.workColors[wid];
    if (idx < 0) idx = 0;
    if (gp) { for (var j = 0; j < works.length; j++) { if (gwWorkGroup(works[j]) === gp) { idx = j; break; } } }
    return GW_COLOR_PALETTE[idx % GW_COLOR_PALETTE.length];
  }
  /* Участок графика: выбранный → участок ответственного → первый из справочника */
  function graphAreaDefault(g) {
    var list = areasList();
    if (!list.length) return '';
    if (g && g.area && list.indexOf(g.area) !== -1) return g.area;
    if (g && g.respId) {
      var u = null;
      (DB.getUsers() || []).forEach(function (x) { if (x && x.id === g.respId) u = x; });
      if (u && u.area && list.indexOf(u.area) !== -1) return u.area;
    }
    return list[0];
  }
  /* ISO-даты для серий работ */
  function gwToISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function gwFromISO(sv) { var p = String(sv || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function gwAddMonthsISO(iso, n) {
    var d = gwFromISO(iso);
    var day = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < day) d.setDate(0); // 31 января + 1 мес → конец февраля
    return gwToISO(d);
  }
  function openGraphLegendModal() {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x) { if (x.id === GS.cur) g = x; });
    if (!g) { toast('err', 'Сначала создайте или выберите график'); return; }
    if (!g.workColors) g.workColors = {};
    var area = graphAreaDefault(g);
    var areas = areasList();
    var areaOpts = '';
    areas.forEach(function (a) { areaOpts += '<option value="' + esc(a) + '"' + (a === area ? ' selected' : '') + '>' + esc(a) + '</option>'; });
    var h = '<div class="modal-h"><h3>Обозначения работ</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div class="fld" style="max-width:320px"><label>Участок</label><select id="gl-area">' + areaOpts + '</select></div>';
    h += '<div id="gl-rows"></div>';
    h += '</div>';
    h += '<div class="modal-f"><button type="button" class="btn ok" data-action="close-modal">Готово</button></div>';
    modal.innerHTML = h;
    modal.style.maxWidth = '520px';
    overlay.classList.add('show');
    function drawRows() {
      var box = document.getElementById('gl-rows');
      if (!box) return;
      var works = [];
      try { works = WORK.getWorks(area) || []; } catch (e) {}
      if (!works.length) {
        box.innerHTML = '<div class="empty" style="padding:24px 14px;font-size:12.5px">Нет видов работ на участке «' + esc(area) + '».</div>';
        return;
      }
      // 22.09-145: строки обозначений = ГРУППЫ работ (один цвет на всю группу).
      // На виду — название группы; виды работ группы — во всплывающей подсказке
      // (наведите на строку). Работы без группы — отдельными строками, как раньше.
      var groupOrder = [], groupMap = {}, singleW = [];
      works.forEach(function (w) {
        var gp = gwWorkGroup(w);
        if (!gp) { singleW.push(w); return; }
        if (!groupMap[gp]) { groupMap[gp] = []; groupOrder.push(gp); }
        groupMap[gp].push(w);
      });
      var rh = '';
      groupOrder.forEach(function (gp) {
        var ws = groupMap[gp];
        var col = gwColorOf(g, ws[0].id);
        var tip = 'Работы группы:';
        ws.forEach(function (x) { tip += '\n• ' + x.name; });
        rh += '<div class="gw-leg-row">' +
          '<span class="gl-tri" data-tri="' + esc('grp:' + gp) + '">' + gwTriangle(col, 18) + '</span>' +
          '<span class="gw-leg-txt" title="' + esc(tip) + '">' + esc(gp) + (ws.length > 1 ? ' <span style="color:var(--muted);font-weight:600">×' + ws.length + '</span>' : '') + '</span>' +
          '<input type="color" data-gl-color="' + esc('grp:' + gp) + '" value="' + col + '" title="Цвет треугольника — единый для всех работ группы">' +
          '</div>';
      });
      singleW.forEach(function (w) {
        var col = gwColorOf(g, w.id);
        rh += '<div class="gw-leg-row">' +
          '<span class="gl-tri" data-tri="' + esc(w.id) + '">' + gwTriangle(col, 18) + '</span>' +
          '<span class="gw-leg-txt" title="' + esc(w.name) + '">' + esc(w.name) + '</span>' +
          '<input type="color" data-gl-color="' + esc(w.id) + '" value="' + col + '" title="Цвет треугольника работы">' +
          '</div>';
      });
      box.innerHTML = rh;
      var cols = box.querySelectorAll('input[data-gl-color]');
      for (var i = 0; i < cols.length; i++) {
        cols[i].addEventListener('input', function (e) {
          // 22.09-145: ключ может быть группой 'grp:…' — в названиях групп бывают
          // кавычки, поэтому треугольник строки ищем перебором, без CSS-селектора
          var key = e.target.getAttribute('data-gl-color');
          g.workColors[key] = e.target.value;
          graphsSaveList(list);
          var tris = box.querySelectorAll('[data-tri]');
          for (var ti = 0; ti < tris.length; ti++) { if (tris[ti].getAttribute('data-tri') === key) { tris[ti].innerHTML = gwTriangle(e.target.value, 18); } }
          if (S.screen === 'graphs') renderGraphs(); // перекрасить таблицы за окном
        });
      }
    }
    drawRows();
    var areaSel = document.getElementById('gl-area');
    if (areaSel) areaSel.addEventListener('change', function () {
      area = areaSel.value;
      g.area = area;
      graphsSaveList(list);
      drawRows();
      if (S.screen === 'graphs') renderGraphs();
    });
  }

  /* ===== ПЕРИОДИЧНОСТЬ РАБОТ ГРАФИКА ===== */
  /* Опции видов работ участка (справочник видов работ по участкам) */
  /* 22.09-145: в строках работ окна «Настроить периодичность» на виду —
     название ГРУППЫ (коротко), полный вид работ — во всплывающей подсказке
     (title у опции и у самого списка). У работ без группы — название, как раньше.
     Значение опции — по-прежнему id работы: выбор/сохранение не меняются. */
  /* 22.09-152: автовыбор работы ВНУТРИ ГРУППЫ для строки объекта ri текущего
     графика — те же правила, что у «⚡ Автоподбора»: тип объекта, линии
     редуцирования, телеметрия, вид обслуживания, отопление (чекбоксы окна;
     по умолчанию все включены). Исключённые названия («автоподбор НИКОГДА»)
     и сезон «Зима» автоматически не подставляются — их выбирают вручную через
     🎯. Без объекта — первая подходящая работа группы. */
  function gprGroupAutopick(area, gp, ri) {
    if (!gp) return null;
    var works = [];
    try { works = WORK.getWorks(area) || []; } catch (e) {}
    var ob = null, attrs = {}, objType = '';
    try {
      var g = graphsFind(GS.cur);
      ob = (g && g.objs) ? g.objs[ri] : null;
      if (ob) {
        objType = ob.type || '';
        var rec = (window.SP_OBJECTS && ob.oid) ? SP_OBJECTS.getObject(ob.oid) : null;
        if (rec && window.SP_OBJ_ATTRS) attrs = SP_OBJ_ATTRS.getAttrs(rec) || {};
      }
    } catch (e2) {}
    var rules;
    if (ob) {
      try { rules = gprAutofillRules(); } catch (e3) { rules = null; }
      if (!rules) rules = { type: true, lines: true, telemetry: true, service: true, heating: true };
    } else {
      rules = { type: false, lines: false, telemetry: false, service: false, heating: false };
    }
    var firstOk = null, firstNoWin = null, firstAny = null;
    for (var i = 0; i < works.length; i++) {
      var w = works[i];
      if (!w || gwWorkGroup(w) !== gp) continue;
      if (!firstAny) firstAny = w;
      if (autopickExcludedName(w.name)) continue;
      var winter = String(w.season || '').toLowerCase() === 'зима';
      if (!winter && !firstNoWin) firstNoWin = w;
      if (winter) continue; // как «⚡ Автоподбор»: зимние работы — вручную через 🎯
      if (ob && workMatchesObjectParams(w, attrs, objType, rules)) return w;
      if (!firstOk) firstOk = w;
    }
    return firstOk || firstNoWin || firstAny;
  }
  /* 22.09-157: подпись группы в списках выбора работ. Закрытый список —
     просто название группы; РАСКРЫТЫЙ — «Группа (число работ)». Текст опций
     с data-grp подменяется при открытии/закрытии/выборе списка. */
  function grpSelExpandText(sel) {
    if (!sel || !sel.options) return;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (o.dataset && o.dataset.grp) o.textContent = o.dataset.grp + (o.dataset.cnt ? ' (' + o.dataset.cnt + ')' : '');
    }
  }
  function grpSelCollapseText(sel) {
    if (!sel || !sel.options) return;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (o.dataset && o.dataset.grp) o.textContent = o.dataset.grp;
    }
  }

  /* 22.09-152: опции периодичности — ОДНА строка на ГРУППУ (не на работу!).
     Конкретная работа внутри группы подбирается под объект этой строки
     автоматически (теми же правилами, что «⚡»); ручной точный выбор в группе —
     кнопкой 🎯 справа. Работы без группы — поимённо, как раньше. Значение
     опции — id работы (сохранение серии не меняется). sel — id уже выбранной
     работы: она сохраняется, если входит в группу. */
  function gprWorkOptions(area, sel, ri) {
    var works = [];
    try { works = WORK.getWorks(area) || []; } catch (e) {}
    var h = '<option value="">— не задана —</option>';
    var order = [], gmap = {};
    works.forEach(function (w) {
      var gp = gwWorkGroup(w);
      if (!gp) return;
      if (!gmap[gp]) { gmap[gp] = []; order.push(gp); }
      gmap[gp].push(w);
    });
    order.forEach(function (gp) {
      var ws = gmap[gp];
      var chosen = null;
      ws.forEach(function (w) { if (w.id === sel) chosen = w; }); // выбранную ранее — сохраняем
      var w0 = chosen || gprGroupAutopick(area, gp, ri) || ws[0];
      // 22.09-157: закрытый список — название группы; раскрытый — «Группа (N)»
      h += '<option value="' + esc(w0.id) + '"' + (chosen ? ' selected' : '') + ' title="' + esc(w0.name) + '" data-grp="' + esc(gp) + '"' + (ws.length > 1 ? ' data-cnt="' + ws.length + '"' : '') + '>' + esc(gp) + '</option>';
    });
    works.forEach(function (w) {
      if (gwWorkGroup(w)) return; // работы с группой — выше, одна строка на группу
      h += '<option value="' + esc(w.id) + '"' + (w.id === sel ? ' selected' : '') + ' title="' + esc(w.name) + '">' + esc(w.name) + '</option>';
    });
    return h;
  }
  function gwAddDaysISO(iso, n) { var d = gwFromISO(iso); d.setDate(d.getDate() + n); return gwToISO(d); }
  /* ===== ГРАФИК СМЕН МАСТЕРА В ГРАФИКЕ РАБОТ (22.09-80) =====
     «Рабочий день» мастера = wkDayState === 'work' (график смен «Работники»):
     выходные 5/2 (сб/вс) и 2/2 (цикл бригады), отсутствия. ТА ЖЕ ЛОГИКА, что и
     в таблицах «Графиков смен» и в цветных метках календаря — пользователь видит
     одну и ту же картину везде. (masterCapacity не подходит: она не знает про
     сб/вс у 5/2 и по-особому трактует одиночного мастера 2/2.) Без мастера — нет ограничений. */
  function gwIsWorkDay(masterId, iso) {
    if (!masterId) return true;
    try { return wkDayState(masterId, iso) === 'work'; } catch (e) { return true; }
  }
  // Дата выполнения: якорь серии, сдвинутый НАЗАД до ближайшего рабочего дня
  // (суббота → пятница). Максимум 31 день назад — страховка от вечного цикла
  // (например, месячный отпуск мастера — тогда оставляем исходную дату).
  function gwBackToWorkDay(masterId, iso) {
    if (gwIsWorkDay(masterId, iso)) return iso;
    var d = gwFromISO(iso);
    for (var i = 0; i < 31; i++) {
      d.setDate(d.getDate() - 1);
      var t = gwToISO(d);
      if (gwIsWorkDay(masterId, t)) return t;
    }
    return iso;
  }
  // Дата вхождения серии: сдвиг назад до рабочего дня, но НЕ уходя за левую
  // границу года графика (треугольник в прошлом году этому графику не нужен).
  function gwOccDate(masterId, anchorIso, gYear) {
    var shifted = gwBackToWorkDay(masterId, anchorIso);
    if (shifted < String(gYear) + '-01-01') shifted = anchorIso;
    return shifted;
  }
  // Текст предупреждения для ручного планирования: мастер в этот день не работает
  // (выходной по графику смен / отсутствие). '' — день рабочий, предупреждать нечего.
  // НЕ блокируем (аварийные работы бывают).
  function wkOffDayWarn(masterId, off) {
    if (!masterId) return '';
    var ds = gwToISO(offToDate(off));
    var st;
    try { st = wkDayState(masterId, ds); } catch (e) { return ''; }
    if (st === 'work') return '';
    var m = masterById(masterId);
    var wd = wkData(masterId);
    var reason = st === 'abs' ? ('отсутствие' + (wd.abs[ds] ? ': ' + wd.abs[ds] : '')) : 'выходной по графику смен';
    return '⚠ ' + (m ? m.name : 'Мастер') + ' · ' + fmt(offToDate(off)) + ' — ' + reason + '. Задача поставлена на нерабочий день мастера.';
  }
  /* Шаг серии: периодичность в месяцах МИНУС отклонение в днях.
     Пример: периодичность 1 мес + отклонение 2 дн → работа 18 числа,
     следующая — 16 число следующего месяца. */
  function gwNextISO(iso, period, dev) {
    // 22.09-210: периодичность может быть ДРОБНОЙ (0,5 и т.п., один знак после запятой).
    // Целые месяцы считаем по календарю, дробную часть — днями (0,5 мес ≈ 15 дней).
    var per = +period || 0;
    var whole = Math.floor(per);
    var frac = Math.round((per - whole) * 10) / 10;
    var d = iso;
    if (whole > 0) d = gwAddMonthsISO(d, whole);
    if (frac > 0) d = gwAddDaysISO(d, Math.round(frac * 30.4375));
    if (dev > 0) d = gwAddDaysISO(d, -dev);
    return d;
  }
  /* Работы объекта: У КАЖДОГО ОБЪЕКТА ИХ МОЖЕТ БЫТЬ НЕСКОЛЬКО —
     ob.works = [{ sid, wid, period, dev, first, occs }].
     Нормализация старых графиков (одна работа в полях объекта) — при первом обращении. */
  function gwObjWorks(ob) {
    if (!ob) return [];
    if (!ob.works) {
      ob.works = [];
      if (ob.workId || (ob.occs && ob.occs.length) || ob.period || ob.first) {
        ob.works.push({ sid: 's_legacy_' + (ob.oid || 'x'), wid: ob.workId || '', period: ob.period || 0, dev: ob.dev || 0, first: ob.first || '', occs: ob.occs || [] });
      }
    }
    return ob.works;
  }
  function gwNewSid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ===== 22.09-138: ОБЩИЙ НАБОР РАБОТ ОБЪЕКТА (для всех графиков) =====
     Набор работ объекта (вид, периодичность, отклонение, дата первого
     проведения) хранится НА ОБЪЕКТЕ (o.plan_works) и един для всех графиков:
     объект, добавленный в другой график, приходит со своими работами; правка
     набора в одном графике отражается во всех. При этом УЖЕ РАССЧИТАННЫЕ
     даты каждого графика НЕ меняются — пересчёт выполняется только в том
     графике, который сохраняет пользователь. Серии всегда продолжаются от
     даты отсчёта сквозь года (без перезапуска в новом году). */
  function gowRowCfg(w) { return { wid: w.wid, period: w.period || 0, dev: w.dev || 0, first: w.first || '' }; }
  /* Общий набор работ объекта: 1) o.plan_works; 2) запасной вариант — строки
     из самого свежего (старший год) графика, где объект уже настроен. */
  function graphObjWorksCfg(oid) {
    if (!oid) return [];
    try {
      var rec = (window.SP_OBJECTS && SP_OBJECTS.getObject) ? SP_OBJECTS.getObject(oid) : null;
      if (rec && Array.isArray(rec.plan_works) && rec.plan_works.length) {
        return rec.plan_works.filter(function (r) { return r && r.wid; }).map(gowRowCfg);
      }
    } catch (e) {}
    var found = [];
    try {
      graphsLoad().slice().sort(function (a, b) { return (b.year || 0) - (a.year || 0); }).some(function (g2) {
        var ob = null;
        (g2.objs || []).forEach(function (x) { if (!ob && x && x.oid === oid) ob = x; });
        if (!ob) return false;
        var rows = gwObjWorks(ob).filter(function (w) { return w && w.wid; });
        if (!rows.length) return false;
        found = rows.map(gowRowCfg);
        return true;
      });
    } catch (e2) {}
    return found;
  }
  function graphObjWorksCfgSame(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      var x = a[i], y = b[i];
      if (!x || !y || x.wid !== y.wid || (x.period || 0) !== (y.period || 0) || (x.dev || 0) !== (y.dev || 0) || (x.first || '') !== (y.first || '')) return false;
    }
    return true;
  }
  /* Записать общий набор на объект (только при изменении). */
  function graphObjWorksCfgSave(oid, rows) {
    if (!oid || !window.SP_OBJECTS || !SP_OBJECTS.updateObject) return false;
    var rec = null;
    try { rec = SP_OBJECTS.getObject(oid); } catch (e) {}
    if (!rec) return false;
    rows = (rows || []).filter(function (r) { return r && r.wid; }).map(gowRowCfg);
    var cur = Array.isArray(rec.plan_works) ? rec.plan_works.filter(function (r) { return r && r.wid; }).map(gowRowCfg) : [];
    if (graphObjWorksCfgSame(cur, rows)) return false;
    try { SP_OBJECTS.updateObject(oid, { plan_works: rows }); return true; } catch (e2) { return false; }
  }
  /* Распространить набор работ объекта на ДРУГИЕ графики (list — уже
     загруженный массив графиков; hisId — график-источник, не трогаем).
     Имеющиеся строки (по виду работы) обновляются по параметрам, их даты
     (occs + задачи) не трогаются; новые работы добавляются строками БЕЗ дат;
     убранные работы удаляются: невыполненные задачи стираются, выполненные
     остаются в планировании, но отвязываются от серии. */
  function graphObjWorksPropagate(list, oid, rows, hisId) {
    var st = { updated: 0, added: 0, removed: 0 };
    if (!oid || !Array.isArray(list)) return st;
    list.forEach(function (g2) {
      if (!g2 || g2.id === hisId || !g2.objs) return;
      g2.objs.forEach(function (ob2) {
        if (!ob2 || ob2.oid !== oid) return;
        var ws = gwObjWorks(ob2);
        if (!ws.length && !rows.length) return;
        var kept = [];
        rows.forEach(function (r) {
          var w = null;
          for (var i = 0; i < ws.length; i++) {
            if (ws[i] && ws[i].wid === r.wid && kept.indexOf(ws[i]) === -1) { w = ws[i]; break; }
          }
          if (w) {
            if ((w.period || 0) !== (r.period || 0) || (w.dev || 0) !== (r.dev || 0) || (w.first || '') !== (r.first || '')) st.updated++;
            w.period = r.period || 0; w.dev = r.dev || 0; w.first = r.first || '';
            kept.push(w);
          } else {
            kept.push({ sid: gwNewSid(), wid: r.wid, period: r.period || 0, dev: r.dev || 0, first: r.first || '', occs: [] });
            st.added++;
          }
        });
        ws.forEach(function (w) {
          if (!w || kept.indexOf(w) !== -1) return;
          (w.occs || []).forEach(function (oc) {
            if (!oc.tid || !TASKS_DB) return;
            var tk = null; try { tk = TASKS_DB.getTask(oc.tid); } catch (e) {}
            if (tk && isDone(tk)) { // выполненные — отвязываем от серии, но сохраняем историю
              try { TASKS_DB.updateTask(tk.id, { graphId: '', graphRi: null, graphSid: '' }); } catch (e2) {}
            } else {
              try { TASKS_DB.hardDeleteTask(oc.tid); } catch (e3) {}
            }
          });
          st.removed++;
        });
        ob2.works = kept;
        delete ob2.workId; delete ob2.workName; delete ob2.period; delete ob2.dev; delete ob2.first; delete ob2.occs;
      });
    });
    return st;
  }
  /* Найти объект и серию работ графика для задачи (по sid серии, затем по работе, затем первая) */
  function graphSeriesFind(g, t) {
    if (!g || !g.objs) return null;
    var ob = g.objs[t.graphRi];
    if (!ob || (t.o && ob.oid !== t.o)) {
      ob = null;
      for (var i = 0; i < g.objs.length; i++) if (g.objs[i].oid === (t.o || '@@')) { ob = g.objs[i]; break; }
    }
    if (!ob) return null;
    var works = gwObjWorks(ob);
    var wrk = null;
    if (t.graphSid) { for (var j = 0; j < works.length; j++) if (works[j].sid === t.graphSid) { wrk = works[j]; break; } }
    if (!wrk && t.w) { for (var k = 0; k < works.length; k++) if (works[k].wid === t.w) { wrk = works[k]; break; } }
    if (!wrk) { for (var m = 0; m < works.length; m++) if (works[m].period > 0) { wrk = works[m]; break; } }
    if (!wrk) return null;
    return { ob: ob, wrk: wrk };
  }

  /* 22.09-138: рассчитать вхождения серии работы объекта в графике (от якоря
     first с шагом = периодичность − отклонение, до конца года графика) и
     создать задачи планирования. Та же логика, что при «Сохранить» в окне
     «Настроить периодичность». */
  /* 22.09-227: один объект в двух графиках одного года — задачи в планировании
     не дублируются. Перед созданием задачи серии ищем УЖЕ существующую: тот же
     объект (o), тот же вид работ (w) и та же дата выполнения. Дата в задаче
     хранится смещением от сегодняшнего дня (t.d) — сравниваем через
     key(offToDate(t.d)); где есть поле t.date — используем его.
     Нашли — вторую задачу не создаём, а привязываем вхождение серии к ней.
     Задача остаётся «родной» для своего графика (graphId): чужие серии её
     не пересчитывают и не удаляют (см. проверки в graphYearResync,
     killSeries и чистке просроченных в graphsPeriodSave). */
  function gwFindPlanTask(oid, wid, occIso) {
    if (!oid || !wid || !occIso || !TASKS_DB) return null;
    var found = null;
    try {
      var list = TASKS_DB.getTasks();
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (!t || t.o !== oid || t.w !== wid) continue;
        var tiso = t.date || (typeof t.d === 'number' ? key(offToDate(t.d)) : '');
        if (tiso === occIso) { found = t; break; }
      }
    } catch (e) {}
    return found;
  }

  function gwGenObjSeries(g, ri, area, ob, wrk, pastOn) {
    var st = { created: 0, shifted: 0, fail: 0, dup: 0 }; // 22.09-227: dup — вхождения, привязанные к уже существующим задачам (не дублируем)
    wrk.occs = [];
    if (!(g && wrk && wrk.wid && wrk.first && wrk.period > 0)) return st;
    // 22.09-189: якорь серии обязан быть валидной датой не позже года графика
    // (опечатка вида «20039-08-01» строковым сравнением «проходила»: '20039' < '2026' —
    // и цикл наставлял сотни задач на десятки тысяч лет вперёд)
    var anchorYear = gwFromISO(wrk.first).getFullYear();
    if (isNaN(anchorYear) || anchorYear > g.year || anchorYear < 2000) {
      // 22.09-209: для работ от «окончания срока службы» будущая дата якоря — НОРМА:
      // в этом году проведений нет; серия начнётся в году даты (и дальше по периоду).
      if (anchorYear >= 2000 && !isNaN(anchorYear)) {
        var _bs = '';
        try { var _ww = WORK.getWork(area, wrk.wid); _bs = (_ww && _ww.periodicity_basis) || ''; } catch (eB) {}
        if (_bs === 'service_life_end') return st;
      }
      st.fail++; return st;
    }
    var endISO = g.year + '-12-31';
    var iso = wrk.first, guard = 0;
    var brigIds = [];
    try { brigIds = wkBrigadeOf(g.respId).map(function (u) { return u.id; }); } catch (e) {}
    while (iso <= endISO && gwFromISO(iso).getFullYear() <= g.year && guard < 400) { // 22.09-189: стоп по году числом
      var occIso = gwOccDate(g.respId, iso, g.year);
      if (occIso !== iso) st.shifted++;
      var isPast = gwFromISO(occIso) < TODAY;
      var tk = null;
      if (!isPast || pastOn) {
        var dlIso = gwAddDaysISO(occIso, wrk.dev || 0);
        // 22.09-227: такой же объект+работа+дата уже в планировании (другой
        // график) — вторую задачу НЕ создаём, серия привязывается к имеющейся
        var dupT = gwFindPlanTask(ob.oid, wrk.wid, occIso);
        if (dupT) { tk = dupT; st.dup++; }
        else try {
          tk = TASKS_DB.addTask({
            m: g.respId, d: dateToOff(gwFromISO(occIso)), o: ob.oid, w: wrk.wid, garea: area,
            s: 'plan', status: 'plan', volume: 1,
            slesari: brigIds,
            dl_date: dlIso, dl: dateToOff(gwFromISO(dlIso)),
            graphId: g.id, graphRi: ri, graphSid: wrk.sid
          });
          st.created++;
        } catch (eTask) { tk = null; st.fail++; }
      }
      wrk.occs.push({ date: occIso, tid: tk ? tk.id : null, wid: wrk.wid });
      iso = gwNextISO(iso, wrk.period, wrk.dev);
      guard++;
    }
    return st;
  }

  /* 22.09-140: пересчёт серий графика при смене ГОДА (окно «Редактировать
     график»). Даты нового года считаются от того же якоря (first) с тем же
     шагом (периодичность − отклонение) — серия продолжается сквозь года без
     перезапуска. Невыполненные задачи прежней раскладки убираются,
     выполненные — отвязываются от серии и остаются в истории.
     mode 'all' — все серии (год только что изменили);
     mode 'auto' — только «битые» серии: рассчитаны, но текущего года в них
     нет, хотя по якорю даты быть должны (год меняли раньше без пересчёта). */
  function graphYearResync(g, mode) {
    var st = { series: 0, created: 0, removed: 0, kept: 0, shifted: 0, fail: 0, yaw: 0 };
    if (!g || !g.objs || !g.objs.length || !TASKS_DB) return st;
    var area = graphAreaDefault(g);
    var pfx = String(g.year) + '-';
    var endISO = g.year + '-12-31';
    g.objs.forEach(function (ob, ri) {
      var pastOn = !!ob.pastTasks;
      gwObjWorks(ob).forEach(function (wrk) {
        if (!wrk || !wrk.wid) return;
        var occs = wrk.occs || [];
        var anchorY2 = gwFromISO(wrk.first).getFullYear(); // 22.09-189: год числом, не строкой — опечатка «20039» иначе «меньше» «2026»
        var canHave = !!(wrk.first && (wrk.period || 0) > 0 && !isNaN(anchorY2) && anchorY2 <= g.year && anchorY2 >= 2000);
        if (mode !== 'all') {
          if (!occs.length || !canHave) return;
          var hasYear = false;
          for (var i = 0; i < occs.length; i++) {
            var d0 = occs[i] && String(occs[i].date || '');
            if (d0.indexOf(pfx) === 0) { hasYear = true; break; }
          }
          if (hasYear) return; // серия уже на текущем году — не трогаем
        }
        (occs || []).forEach(function (oc) {
          if (!oc || !oc.tid) return;
          var tk = null; try { tk = TASKS_DB.getTask(oc.tid); } catch (e) {}
          if (!tk) return;
          // 22.09-227: задача принадлежит ДРУГОМУ графику (привязана при
          // защите от дублей) — не удаляем и не отвязываем от его серии,
          // только снимаем привязку в ЭТОМ графике
          if (tk.graphId && tk.graphId !== g.id) { oc.tid = null; st.kept++; return; }
          if (isDone(tk)) { // выполненная — отвязать от серии, сохранить историю
            try { TASKS_DB.updateTask(tk.id, { graphId: '', graphRi: null, graphSid: '' }); st.kept++; } catch (e2) {}
          } else {
            try { TASKS_DB.hardDeleteTask(tk.id); st.removed++; } catch (e3) { st.fail++; }
          }
        });
        if (wrk.first && !canHave) st.yaw++;
        var s2 = gwGenObjSeries(g, ri, area, ob, wrk, pastOn);
        st.series++; st.created += s2.created; st.shifted += s2.shifted; st.fail += s2.fail; st.dup = (st.dup || 0) + s2.dup; // 22.09-227
      });
      // 22.09-159: после перегенерации года совместные работы снова в один день
      try { st.joint = (st.joint || 0) + gwJointAlign(ob.works || [], area); } catch (eJ) {}
    });
    return st;
  }

  /* Окно «Настроить периодичность»: слева объекты данного графика, у каждого
     объекта — СВОЙ СПИСОК РАБОТ (сколько нужно, «+ работа»), для каждой работы:
     вид (справочник по участку), периодичность в месяцах, отклонение в днях
     (шаг = периодичность − отклонение) и дата первого проведения */
  /* ===== 22.09-114: АВТОПОДБОР РАБОТ ПО ПАРАМЕТРАМ ОБЪЕКТА ===== */
  /* Подходит ли работа объекту по включённым критериям:
     type  — тип объекта (ГРП/ШРП/ПГРП) должен входить в «Категорию объекта
             обслуживания» работы (пустые категории = работа подходит всем);
     lines — «Кол-во линий редуцирования» у работы (если задано) должно
             совпадать с параметром объекта (attrs.reduceLines, запасной —
             attrs.linesCount). Если у объекта параметр не заполнен — работа
             с ограничением по линиям не подбирается. */
  /* 22.09-137/144: свойства ГРУППЫ работы (хранятся в group_flags каждой работы;
     задаются кнопкой 🏷 у группы в справочнике «Виды работ», участок «ГРП»).
     «Работы с ТМ» (старое имя «Телеметрия») — работа только объектам с ТМ;
     «Без телеметрии» — только объектам без ТМ. Прочие — метки для наглядности. */
  function workGroupHasFlag(w, flag) {
    var fl = w && w.group_flags;
    if (!Array.isArray(fl)) return false;
    var f = String(flag || '').trim().toLowerCase();
    for (var i = 0; i < fl.length; i++) if (String(fl[i] || '').trim().toLowerCase() === f) return true;
    return false;
  }
  /* 22.09-144: групповые метки телеметрии; «Телеметрия» переименована в
     «Работы с ТМ» — распознаются оба написания (старые записи работают). */
  function workGroupHasTmFlag(w) { return workGroupHasFlag(w, 'Работы с ТМ') || workGroupHasFlag(w, 'Телеметрия'); }
  function workGroupHasNoTmFlag(w) { return workGroupHasFlag(w, 'Без телеметрии'); }
  /* 22.09-137: работы, которые автоподбор НЕ назначает НИКОГДА (ни в одном
     режиме). Совпадение — по подстроке названия (нижний регистр, пробелы слиты). */
  var AUTOPICK_NEVER = [
    'текущий ремонт оборудования шкафных газорегуляторных пунктов без опрессовки'
  ];
  function autopickExcludedName(name) {
    var n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!n) return false;
    for (var i = 0; i < AUTOPICK_NEVER.length; i++) if (n.indexOf(AUTOPICK_NEVER[i]) !== -1) return true;
    return false;
  }
  /* 22.09-117: Эффективные связи работы с оборудованием объекта.
     Приоритет — явные поля карточки (telemetry_req/telemetry_type/diag_equipment/
     heating_req); если они пустые — распознаём по названию работы и её группе:
     «ИНДЕЛ» → ТМ типа «Индел»; «не оборудованных системой телеметр…» → без ТМ;
     «оборудованных системой телеметр…» → с ТМ; «оборудования ТМ и АСУТП» → с ТМ;
     «приборного диагностического оборудования» → диагностика (Region-gas);
     «отопительн…» → ТО отопительного (только ГРП с отоплением). */
  function workEffAttrs(w) {
    var tReq = w.telemetry_req || '', tType = w.telemetry_type || '';
    var diag = !!w.diag_equipment, heat = !!w.heating_req;
    var txt = (String(w.name || '') + ' § ' + String(w.group || '')).toLowerCase();
    if (!tType && !tReq) {
      if (txt.indexOf('индел') !== -1) { tReq = 'equipped'; tType = 'ПТК "Индел"'; } // 22.09-136: тип переименован
      else if (txt.indexOf('не оборудованных системой телеметр') !== -1) tReq = 'not_equipped';
      else if (txt.indexOf('оборудованных системой телеметр') !== -1) tReq = 'equipped';
      else if (txt.indexOf('тм и асутп') !== -1) tReq = 'equipped';
    }
    // 22.09-137/144: ни поля карточки, ни название не определили — смотрим
    // групповые метки: «Работы с ТМ» (старое «Телеметрия») — только объектам
    // с ТМ; «Без телеметрии» — только объектам без ТМ.
    if (!tType && !tReq && workGroupHasTmFlag(w)) tReq = 'equipped';
    if (!tType && !tReq && workGroupHasNoTmFlag(w)) tReq = 'not_equipped';
    if (!diag && txt.indexOf('приборного диагностического оборудования') !== -1) diag = true;
    if (!heat && txt.indexOf('отопительн') !== -1) heat = true;
    return { telemetry_req: tReq, telemetry_type: tType, diag_equipment: diag, heating_req: heat };
  }
  function workMatchesObjectParams(w, attrs, objType, rules) {
    rules = rules || {};
    // 22.09-144: пометка группы «ГРП» УПРАЗДНЕНА — это название участка
    // справочника, а не фильтр по типу объекта. Ограничение по типу объекта —
    // только через «Категорию объекта обслуживания» в карточке работы.
    if (rules.type !== false) {
      var cats = w.object_categories || [];
      if (cats.length && objType && cats.indexOf(objType) === -1) return false;
    }
    if (rules.lines !== false) {
      var need = parseInt(w.lines_count, 10) || 0;
      if (need > 0) {
        var have = parseInt(attrs && (attrs.reduceLines || attrs.linesCount), 10) || 0;
        if (have !== need) return false;
      }
    }
    // 22.09-115/117: телеметрия. Тип у работы — совпадение и по типу, и по
    // наличию ТМ; «оборудован ТМ» — только объектам с ТМ (нет ТМ → нет работ ТМ);
    // «без ТМ» — только объектам без телеметрии. Если в карточке не задано —
    // распознаём по названию работы/группы (workEffAttrs).
    var eff = w._effAuto || (w._effAuto = workEffAttrs(w));
    if (rules.telemetry !== false) {
      var objTel = String(attrs && attrs.telemetry || '').trim();
      if (eff.telemetry_type) {
        if (objTel.toLowerCase() !== eff.telemetry_type.toLowerCase()) return false;
      } else if (eff.telemetry_req === 'equipped' && !objTel) return false;
      else if (eff.telemetry_req === 'not_equipped' && objTel) return false;
    }
    // 22.09-115: приборное диагностическое оборудование — только вид обслуживания Region-gas
    if (rules.service !== false) {
      if (eff.diag_equipment) {
        var sk = String(attrs && attrs.serviceKind || '').trim().toLowerCase();
        if (sk !== 'region-gaz' && sk !== 'region-gas') return false;
      }
    }
    // 22.09-115: ТО отопительного оборудования — только объектам с отоплением (у ШРП его нет → только ГРП)
    if (rules.heating !== false) {
      if (eff.heating_req && !String(attrs && attrs.heating || '').trim()) return false;
    }
    return true;
  }
  // Дата первого проведения из «Даты ввода в эксплуатацию»: переносится в год графика
  function gprFirstFromCommission(attrs, year) {
    var cd = attrs && attrs.commissionDate;
    if (!cd || !/^\d{4}-\d{2}-\d{2}$/.test(cd)) return '';
    var mm = cd.slice(5, 7), dd = cd.slice(8, 10);
    var maxDay = new Date(+year, +mm, 0).getDate(); // последний день месяца (29.02 в невисокосный → 28)
    return year + '-' + mm + '-' + String(Math.min(+dd, maxDay)).padStart(2, '0');
  }
  /* 22.09-209: якорь от даты окончания срока службы оборудования (поле объекта
     «Дата окончания срока службы»). В отличие от даты ввода в эксплуатацию —
     АБСОЛЮТНАЯ дата: работа проводится разово к этой дате (в её год), а далее —
     по периодичности от этого якоря (например, +5 лет). */
  function gprFirstFromServiceLife(attrs) {
    var sd = attrs && attrs.serviceLifeEnd;
    if (!sd || !/^\d{4}-\d{2}-\d{2}$/.test(sd)) return '';
    return sd;
  }
  function gprAutofillRules() {
    function on(id) { var x = document.getElementById(id); return x ? !!x.checked : true; }
    // 22.09-115: + телеметрия, вид обслуживания (диагностика), отопление
    return { type: on('gpr-crit-type'), lines: on('gpr-crit-lines'), telemetry: on('gpr-crit-telemetry'),
      service: on('gpr-crit-service'), heating: on('gpr-crit-heating') };
  }
  /* Автоподбор работ объекту графика ri (участок area, график g).
     Дубли уже назначенных работ не добавляются; пустые строки-заглушки убираются.
     Периодичность/отклонение — из карточки работы; дата первой — из даты ввода
     в эксплуатацию объекта (если у работы реквизит отсчёта «Дата ввода...»).
     Возвращает число добавленных строк. В график попадает по кнопке «Сохранить». */
  function gprAutofill(area, ri, g, mode) {
    if (!g || !g.objs || !g.objs[ri]) return 0;
    var ob = g.objs[ri];
    var attrs = {};
    try {
      var rec = (window.SP_OBJECTS && ob.oid) ? SP_OBJECTS.getObject(ob.oid) : null;
      if (rec && window.SP_OBJ_ATTRS) attrs = SP_OBJ_ATTRS.getAttrs(rec);
    } catch (e) {}
    var rules = gprAutofillRules();
    var box = document.querySelector('.gpr-works[data-wl="' + ri + '"]');
    if (!box) return 0;
    var empty = box.querySelector('.gpr-empty');
    if (empty) empty.parentNode.removeChild(empty);
    var have = {};
    box.querySelectorAll('select[data-gpr-w]').forEach(function (s) { if (s.value) have[s.value] = 1; });
    var works = [];
    try { works = WORK.getWorks(area) || []; } catch (e) {}
    var added = 0;
    works.forEach(function (w) {
      if (!w || !w.id || have[w.id]) return;
      // 22.09-137: исключённые названия не подбираются НИКОГДА (все режимы)
      if (autopickExcludedName(w.name)) return;
      // 22.09-121: зимние работы (сезон «Зима» в карточке работы) автоподбором не добавляются
      if (String(w.season || '').toLowerCase() === 'зима') return;
      // 22.09-118: режимы подбора — 'tm' только работы с телеметрией, 'notm' только без ТМ
      if (mode === 'tm' || mode === 'notm') {
        var ef = workEffAttrs(w);
        var isTm = ef.telemetry_req === 'equipped' || !!ef.telemetry_type;
        if (mode === 'tm' && !isTm) return;
        if (mode === 'notm' && isTm) return;
      }
      if (!workMatchesObjectParams(w, attrs, ob.type, rules)) return;
      if (!added) { // первая добавленная — убираем пустые строки-заглушки
        box.querySelectorAll('.gpr-wrow').forEach(function (row) {
          var sel = row.querySelector('select[data-gpr-w]');
          if (sel && !sel.value && !row.getAttribute('data-sid')) row.parentNode.removeChild(row);
        });
      }
      var per = (w.periodicity_unit === 'дней') ? 0 : (parseInt(w.periodicity_value, 10) || 0);
      var dev = parseInt(w.periodicity_dev, 10) || 0;
      var first = (w.periodicity_basis === 'commissioning_date') ? gprFirstFromCommission(attrs, g.year)
        : (w.periodicity_basis === 'service_life_end') ? gprFirstFromServiceLife(attrs) : ''; // 22.09-209
      var wi = box.querySelectorAll('.gpr-wrow').length;
      var div = document.createElement('div');
      div.innerHTML = gprRowHtml(area, ri, wi, { sid: '', wid: w.id, period: per, dev: dev, first: first }, true);
      box.appendChild(div.firstChild);
      have[w.id] = 1; added++;
    });
    return added;
  }

  function openGraphPeriodModal() {
    var g = graphsFind(GS.cur);
    if (!g) { toast('err', 'Сначала создайте или выберите график'); return; }
    if (!g.objs || !g.objs.length) { toast('err', 'Добавьте объекты в график'); return; }
    var area = graphAreaDefault(g);
    var areas = areasList();
    var areaOpts = '';
    areas.forEach(function (a) { areaOpts += '<option value="' + esc(a) + '"' + (a === area ? ' selected' : '') + '>' + esc(a) + '</option>'; });
    var h = '<div class="modal-h"><h3>Настроить периодичность</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div class="fld" style="max-width:320px"><label>Участок (виды работ из справочника)</label><select id="gpr-area">' + areaOpts + '</select></div>';
    // 22.09-114: панель автоподбора работ по параметрам объектов
    h += '<div style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-bottom:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px">' +
      '<span style="font-size:12px;font-weight:700;color:#166534">⚡ Автоподбор работ:</span>' +
      '<label class="cb" style="font-size:12px;color:#166534"><input type="checkbox" id="gpr-crit-type" checked> по типу объекта ► «Категория объекта» в карточке работы</label>' +
      '<label class="cb" style="font-size:12px;color:#166534"><input type="checkbox" id="gpr-crit-lines" checked> по линиям редуцирования ► «Линий редуцирования» у работы = параметру объекта</label>' +
      '<label class="cb" style="font-size:12px;color:#166534"><input type="checkbox" id="gpr-crit-telemetry" checked> по телеметрии ► наличие/тип ТМ объекта и работы</label>' +
      '<label class="cb" style="font-size:12px;color:#166534"><input type="checkbox" id="gpr-crit-service" checked> по виду обслуживания ► приборная диагностика только при Region-gas</label>' +
      '<label class="cb" style="font-size:12px;color:#166534"><input type="checkbox" id="gpr-crit-heating" checked> по отоплению ► ТО отопит. оборудования только ГРП с отоплением</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" class="btn sm" id="gpr-auto-all" style="background:#16a34a;color:#fff;border-color:#15803d;font-weight:700">⚡ Подобрать всем объектам</button>' +
      '<button type="button" class="btn sm" id="gpr-auto-tm" title="Добавляются только работы, связанные с телеметрией («с ТМ» по полю карточки или названию), и только объектам с телеметрией" style="background:#0369a1;color:#fff;border-color:#075985;font-weight:700">📡 Только работы с ТМ</button>' +
      '<button type="button" class="btn sm" id="gpr-auto-notm" title="Добавляются все работы, НЕ связанные с телеметрией (включая «объекты без ТМ»)" style="background:#475569;color:#fff;border-color:#334155;font-weight:700">🚫📡 Только без ТМ</button>' +
      '</div>' +
      '</div>';
    h += '<div class="gpr-cols"><span>Вид работы</span><span></span><span>Период., мес</span><span>Откл., дн</span><span>Дата первого проведения</span><span></span></div>';
    h += '<div id="gpr-list" style="display:flex;flex-direction:column;gap:10px;padding:2px"></div>';
    h += '<div class="calc" style="align-items:flex-start;font-size:12.5px;line-height:1.5"><b>В списке каждой строки — ОДНА строка на ГРУППУ работ (раскройте список — в скобках число видов работ в группе): конкретный вид работ внутри группы подбирается под объект автоматически по тем же правилам, что «⚡», ручной точный выбор — кнопкой 🎯; какой вид работ выбран — видно при наведении на строку.</b> Шаг серии = периодичность МИНУС отклонение (1 мес и отклонение 2 дн: работа 18 числа → следующая 16 числа следующего месяца). У каждого объекта может быть несколько работ — «+ работа». Работы появляются в «Планировании»; перемещение задачи там переносит её и последующие по шагу серии. <b>Даты, попавшие на день, когда мастер графика не работает (выходные 5/2 и 2/2, отсутствия — график смен на вкладке «Работники»), автоматически переносятся на ближайший предыдущий рабочий день; шаг серии считается от своих исходных дат.</b> <b>⚡ Автоподбор (кнопка сверху или «⚡» у объекта) добавляет объектам работы из справочника по их параметрам: тип объекта ↔ «Категория объекта обслуживания», линии редуцирования объекта ↔ «Кол-во линий редуцирования» в карточке работы. Периодичность и отклонение подставляются из справочника; дата первого проведения — из «Даты ввода в эксплуатацию» объекта, если у работы выбран реквизит отсчёта «Дата ввода в эксплуатацию». Критерии оборудования: телеметрия (работы «с ТМ» не попадут на объект без ТМ; выбран тип — совпадение по типу и наличию), приборная диагностика только при виде обслуживания «Region-gas», ТО отопительного оборудования только ГРП с отоплением. Если поля в карточке работы не заполнены, связь распознаётся по названию работы/группы («ИНДЕЛ», «оборудованных/не оборудованных системой телеметрии», «приборного диагностического оборудования», «отопительного»). Режимы: «📡 Только работы с ТМ» — одни телеметрические работы, «🚫📡 Только без ТМ» — одни работы без привязки к телеметрии. Зимние работы (сезон «Зима» в карточке работы) автоподбором не добавляются — назначьте их вручную кнопкой «+ работа». Пометки групп (кнопка 🏷 у группы в справочнике «Виды работ», участок ГРП): «Работы с ТМ» — только объектам с телеметрией; «Без телеметрии» — только объектам без телеметрии; остальные пометки — просто метки. Работа «Текущий ремонт оборудования шкафных газорегуляторных пунктов без опрессовки» автоподбором НЕ назначается. <b>Набор работ объекта — ОБЩИЙ для всех графиков: добавленный в другой график объект приходит со своими работами; правки набора видны во всех графиках. Уже рассчитанные даты других графиков при этом НЕ меняются — пересчёт только в сохраняемом графике; серии всегда продолжаются от даты первого проведения (без перезапуска в новом году).</b></b></div>';
    h += '</div>';
    h += '<div class="modal-f"><button type="button" class="btn ok" data-action="graphs-period-save">Сохранить</button><button type="button" class="btn danger" data-action="close-modal">Отменить</button></div>';
    modal.innerHTML = h;
    modal.style.width = '80%'; modal.style.maxWidth = '80%'; // 22.09-105: настройка периодичности — 80% ширины, по центру (сброс: close-modal и graphsPeriodSave)
    overlay.classList.add('show');
    // 22.09-138: если у объекта в ЭТОМ графике ещё нет работ — показываем его
    // ОБЩИЙ набор (тот, что задан на объекте/в других графиках); даты
    // проставятся после «Сохранить» (в этом окне это просто строки без occs).
    var gowPrefill = 0;
    (g.objs || []).forEach(function (ob) {
      if (gwObjWorks(ob).length) return;
      var cfg = graphObjWorksCfg(ob.oid);
      if (!cfg.length) return;
      ob.works = cfg.map(function (r) { return { sid: gwNewSid(), wid: r.wid, period: r.period, dev: r.dev, first: r.first, occs: [] }; });
      gowPrefill += cfg.length;
    });
    if (gowPrefill) toast('ok', '🔗 Подтянуты общие наборы работ объектов: ' + gowPrefill + ' строк — даты появятся после «Сохранить»');
    gprDrawList(g, area);
    var listEl = document.getElementById('gpr-list');
    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var auto1 = e.target.closest('[data-gpr-auto]'); // 22.09-114: автоподбор одному объекту
        if (auto1) {
          var nA = gprAutofill(area, parseInt(auto1.getAttribute('data-gpr-auto'), 10), g);
          if (nA) toast('ok', '⚡ Подобрано работ: ' + nA + ' — проверьте и нажмите «Сохранить»');
          else toast('warn', '⚡ Новых работ не подобрано: всё уже назначено или нет совпадений по параметрам объекта');
          return;
        }
        var add = e.target.closest('[data-gpr-add]');
        if (add) { gprAddRow(area, parseInt(add.getAttribute('data-gpr-add'), 10)); return; }
        var pick = e.target.closest('[data-gpr-pick]'); // 22.09-148: 🎯 точный выбор в группе
        if (pick) {
          var pRow = pick.closest('.gpr-wrow');
          var pSel = pRow ? pRow.querySelector('select[data-gpr-w]') : null;
          var pBox = pick.closest('.gpr-works'); // 22.09-152: объект этой строки
          var pRi = pBox ? parseInt(pBox.getAttribute('data-wl'), 10) : -1;
          var pw = null; try { pw = (pSel && pSel.value) ? WORK.getWork(area, pSel.value) : null; } catch (errP) {}
          openExactWorkPickModal(area, gwWorkGroup(pw), pSel ? pSel.value : '', function (newWid) {
            if (!pSel) return;
            /* 22.09-152: опция в списке одна на группу — перестраиваем её под
               выбранную вручную работу (иначе option со старым id не совпадёт) */
            pSel.innerHTML = gprWorkOptions(area, newWid, isNaN(pRi) ? -1 : pRi);
            pSel.value = newWid;
            try { var wN = WORK.getWork(area, newWid); pSel.title = wN ? wN.name : ''; } catch (errN) {}
            try { pSel.dispatchEvent(new Event('change', { bubbles: true })); } catch (errD) {} // подтянуть периодичность из карточки
          });
          return;
        }
        var del = e.target.closest('[data-gpr-del]');
        if (del) {
          var row = del.closest('.gpr-wrow');
          var box = del.closest('.gpr-works');
          if (row) row.parentNode.removeChild(row);
          if (box && !box.querySelectorAll('.gpr-wrow').length) {
            var d = document.createElement('div');
            d.className = 'gpr-empty';
            d.textContent = 'Работ нет — нажмите «+ работа»';
            box.appendChild(d);
          }
        }
      });
    }
    // 22.09-105: выбрали работу в строке — подставляем периодичность (мес) и
    // отклонение (дн) из её атрибутов в справочнике (карточка ГРП), если заданы.
    listEl.addEventListener('change', function (e) {
      var sel = e.target && e.target.closest ? e.target.closest('select[data-gpr-w]') : null;
      if (!sel || !sel.value) return;
      var w = null;
      try { w = WORK.getWork(area, sel.value); } catch (err) {}
      if (!w) return;
      sel.title = w.name || ''; // 22.09-145: подсказка строки — полный вид работ
      var id = sel.getAttribute('data-idx');
      // В графике шаг задаётся в месяцах: значение «в днях» не конвертируем
      var per = (w.periodicity_unit === 'дней') ? 0 : (parseInt(w.periodicity_value, 10) || 0);
      var dev = parseInt(w.periodicity_dev, 10) || 0;
      if (per > 0) { var pInp = listEl.querySelector('[data-gpr-p="' + id + '"]'); if (pInp) pInp.value = per; }
      if (dev > 0) { var dInp = listEl.querySelector('[data-gpr-d="' + id + '"]'); if (dInp) dInp.value = dev; }
    });
    /* 22.09-157: раскрытый список работ — «Группа (N видов)», закрытый —
     просто название группы. Делегировано: строки добавляются динамически. */
    listEl.addEventListener('mousedown', function (e) {
      var s0 = e.target && e.target.closest ? e.target.closest('select[data-gpr-w]') : null;
      if (s0) grpSelExpandText(s0);
    });
    listEl.addEventListener('keydown', function (e) {
      var s1 = e.target && e.target.closest ? e.target.closest('select[data-gpr-w]') : null;
      if (!s1) return;
      if (e.key === 'Escape') grpSelCollapseText(s1); else grpSelExpandText(s1);
    });
    listEl.addEventListener('change', function (e) {
      var s2 = e.target && e.target.closest ? e.target.closest('select[data-gpr-w]') : null;
      if (s2) grpSelCollapseText(s2);
    });
    listEl.addEventListener('focusout', function (e) {
      var s3 = e.target && e.target.closest ? e.target.closest('select[data-gpr-w]') : null;
      if (s3) grpSelCollapseText(s3);
    });
    var areaSel = document.getElementById('gpr-area');
    if (areaSel) areaSel.addEventListener('change', function () {
      area = areaSel.value;
      // обновляем опции селектов работ, не трогая остальные поля строк
      var sels = document.querySelectorAll('#gpr-list select[data-gpr-w]');
      for (var i = 0; i < sels.length; i++) {
        var v = sels[i].value;
        // 22.09-152: автоподбор внутри группы — под объект ЭТОЙ строки
        var wlBox = sels[i].closest ? sels[i].closest('.gpr-works') : null;
        var wlRi = wlBox ? parseInt(wlBox.getAttribute('data-wl'), 10) : -1;
        sels[i].innerHTML = gprWorkOptions(area, v, isNaN(wlRi) ? -1 : wlRi);
        // значение сохраняем, если такая работа есть на новом участке
        for (var j = 0; j < sels[i].options.length; j++) if (sels[i].options[j].value === v) { sels[i].value = v; break; }
        var _sw = null; try { _sw = WORK.getWork(area, sels[i].value); } catch (e3) {} // 22.09-145: подсказка
        sels[i].title = _sw ? _sw.name : '';
      }
    });
    // 22.09-114: кнопки автоподбора — всем / 22.09-118: только с ТМ / только без ТМ
    function gprAutoAllRun(mode) {
      var tot = 0, objs = 0;
      g.objs.forEach(function (ob, ri) { var n = gprAutofill(area, ri, g, mode); if (n > 0) objs++; tot += n; });
      var what = mode === 'tm' ? 'работ с ТМ' : (mode === 'notm' ? 'работ без ТМ' : 'работ');
      if (tot) toast('ok', '⚡ Подобрано ' + what + ': ' + tot + ' (объектов затронуто: ' + objs + ') — проверьте и нажмите «Сохранить»');
      else toast('warn', '⚡ Новых ' + what + ' не подобрано: либо всё уже назначено, либо работы не совпадают с параметрами объектов (проверьте тип, линии, телеметрию, вид обслуживания и отопление)');
    }
    var autoAll = document.getElementById('gpr-auto-all');
    if (autoAll) autoAll.addEventListener('click', function () { gprAutoAllRun(null); });
    var autoTm = document.getElementById('gpr-auto-tm');
    if (autoTm) autoTm.addEventListener('click', function () { gprAutoAllRun('tm'); });
    var autoNotm = document.getElementById('gpr-auto-notm');
    if (autoNotm) autoNotm.addEventListener('click', function () { gprAutoAllRun('notm'); });
    // 22.09-195: автоподбор ПРИ ОТКРЫТИИ окна УБРАН — работы на объект добавляются только вручную
    // (кнопки «⚡ Подобрать всем объектам», «⚡» у объекта и «+ работа» — по нажатию пользователя)
  }
  function gprDrawList(g, area) {
    var box = document.getElementById('gpr-list');
    if (!box) return;
    var h = '';
    g.objs.forEach(function (ob, ri) {
      var works = gwObjWorks(ob);
      h += '<div class="gpr-obj" data-obj="' + ri + '">' +
        '<div class="gpr-obj-h"><span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span>' +
        '<span class="gpr-obj-nm" title="' + esc(ob.name) + '">' + esc(ob.name) + '</span>' +
        '<label class="gpr-past" title="Включено: задачи создаются и на прошедшие даты года (январь, февраль и т.д.). Выключено: только с сегодняшнего дня и дальше"><input type="checkbox" data-gpr-past="' + ri + '"' + (ob.pastTasks ? ' checked' : '') + '> Добавлять задачи на прошедшие дни</label>' +
        '<button type="button" class="btn sm" data-gpr-auto="' + ri + '" title="⚡ Подобрать работы автоматически по параметрам объекта (тип, линии редуцирования)" style="flex:0 0 auto;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-weight:700">⚡</button>' +
        '<button type="button" class="btn sm" data-gpr-add="' + ri + '" style="flex:0 0 auto">+ работа</button></div>';
      h += '<div class="gpr-works" data-wl="' + ri + '">';
      if (!works.length) h += gprRowHtml(area, ri, 0, { sid: '', wid: '', period: 0, dev: 0, first: '' }); // сразу одна пустая строка
      else works.forEach(function (wrk, wi) { h += gprRowHtml(area, ri, wi, wrk); });
      h += '</div></div>';
    });
    box.innerHTML = h;
  }
  function gprRowHtml(area, ri, wi, wrk, auto) {
    var id = ri + '-' + wi;
    var _selW = null; // 22.09-145: подсказка списка — полный вид работ
    if (wrk.wid) { try { _selW = WORK.getWork(area, wrk.wid); } catch (eW) {} }
    return '<div class="gpr-wrow" data-sid="' + esc(wrk.sid || '') + '"' + (auto ? ' style="background:#f0fdf4;outline:1px solid #bbf7d0;outline-offset:-1px;border-radius:6px" title="⚡ Работа подобрана автоматически по параметрам объекта"' : '') + '>' +
      '<select class="gpr-inp" data-gpr-w="' + id + '" data-idx="' + id + '" title="' + esc(_selW ? _selW.name : '') + '">' + gprWorkOptions(area, wrk.wid, ri) + '</select>' +
      '<button type="button" class="gpr-del" data-gpr-pick="' + id + '" title="Точный выбор работы в этой группе: весь список работ группы с полными названиями" style="color:var(--blue)">🎯</button>' +
      '<input class="gpr-inp" type="text" inputmode="decimal" placeholder="—" value="' + (wrk.period ? String(wrk.period).replace('.', ',') : '') + '" data-gpr-p="' + id + '" title="Периодичность, месяцев — целое или дробное с одним знаком (например 0,5)">' +
      '<input class="gpr-inp" type="number" min="0" step="1" placeholder="—" value="' + (wrk.dev || '') + '" data-gpr-d="' + id + '" title="Отклонение, дней (шаг = периодичность − отклонение)">' +
      '<input class="gpr-inp" type="date" value="' + esc(wrk.first || '') + '" data-gpr-f="' + id + '">' +
      '<button type="button" class="gpr-del" data-gpr-del="' + id + '" title="Убрать эту работу у объекта">×</button>' +
      '</div>';
  }
  function gprAddRow(area, ri) {
    var box = document.querySelector('.gpr-works[data-wl="' + ri + '"]');
    if (!box) return;
    var empty = box.querySelector('.gpr-empty');
    if (empty) empty.parentNode.removeChild(empty);
    var wi = box.querySelectorAll('.gpr-wrow').length;
    var div = document.createElement('div');
    div.innerHTML = gprRowHtml(area, ri, wi, { sid: '', wid: '', period: 0, dev: 0, first: '' });
    var row = div.firstChild;
    box.appendChild(row);
    // строка сразу на виду: прокручиваем к ней тело модалки
    try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }

  /* Сохранение периодичности: по каждой строке-работе генерируется своя серия.
     Не изменившиеся серии (тот же sid и настройки) сохраняют перенесённые
     вручную задачи; изменившиеся и удалённые строки — их задачи удаляются. */
  function graphsPeriodSave() {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x, i) { if (x.id === GS.cur) g = x; });
    if (!g || !g.objs || !g.objs.length) { overlay.classList.remove('show'); modal.style.maxWidth = ''; modal.style.width = ''; return; }
    var areaSel = document.getElementById('gpr-area');
    var area = areaSel ? areaSel.value : graphAreaDefault(g);
    var created = 0, removed = 0, yearWarn = 0, taskFail = 0, shiftedCnt = 0, dupCnt = 0; // 22.09-227: dupCnt — привязанные к существующим (не дубли)
    var jointMoved = 0; // 22.09-159: перенесённые совместные проведения
    var propStat = { updated: 0, added: 0, removed: 0 }; // 22.09-138: распространение на другие графики
    g.objs.forEach(function (ob, ri) {
      // «Добавлять задачи на прошедшие дни» — чекбокс объекта
      var pastEl = document.querySelector('[data-gpr-past="' + ri + '"]');
      var pastOn = !!(pastEl && pastEl.checked);
      var oldPast = !!ob.pastTasks;
      ob.pastTasks = pastOn;
      var oldWorks = gwObjWorks(ob).slice();
      var rowEls = document.querySelectorAll('.gpr-obj[data-obj="' + ri + '"] .gpr-wrow');
      var newRows = [];
      Array.prototype.forEach.call(rowEls, function (row) {
        var wSel = row.querySelector('select[data-gpr-w]');
        var pInp = row.querySelector('input[data-gpr-p]');
        var dInp = row.querySelector('input[data-gpr-d]');
        var fInp = row.querySelector('input[data-gpr-f]');
        var _devParsed = parseInt(dInp && dInp.value, 10) || 0;
        // 22.09-101: отклонение не введено — подставляем из атрибутов работы (карточка ГРП)
        if (!_devParsed) {
          try { var _wDev = WORK.getWork(area, wSel ? wSel.value : '');
            if (_wDev && _wDev.periodicity_dev > 0) _devParsed = _wDev.periodicity_dev; } catch (e) {}
        }
        // 22.09-210: периодичность — целое или дробное с одним знаком (0,5); запятая тоже принимается
        var _perRaw = String(pInp && pInp.value != null ? pInp.value : '').trim().replace(',', '.');
        var _perV = parseFloat(_perRaw);
        var _perParsed = (isFinite(_perV) && _perV > 0) ? Math.round(_perV * 10) / 10 : 0;
        newRows.push({
          sid: row.getAttribute('data-sid') || '',
          wid: wSel ? wSel.value : '',
          period: _perParsed,
          dev: _devParsed,
          first: fInp ? fInp.value : ''
        });
      });
      var newWorks = [];
      var usedSids = {};
      function killSeries(w) {
        (w.occs || []).forEach(function (oc) {
          if (!(oc.tid && TASKS_DB)) return;
          // 22.09-227: задача «родная» для ДРУГОГО графика (к ней привязались
          // при защите от дублей) — не удаляем, только снимаем привязку
          var _kt = null; try { _kt = TASKS_DB.getTask(oc.tid); } catch (eK) {}
          if (_kt && _kt.graphId && _kt.graphId !== g.id) { oc.tid = null; return; }
          TASKS_DB.hardDeleteTask(oc.tid); removed++;
        });
      }
      newRows.forEach(function (r) {
        var old = null;
        if (r.sid) { for (var i = 0; i < oldWorks.length; i++) if (oldWorks[i].sid === r.sid) { old = oldWorks[i]; break; } }
        var unchanged = old && old.wid === r.wid && (old.period || 0) === r.period && (old.dev || 0) === r.dev && (old.first || '') === r.first && oldPast === pastOn && old.occs && old.occs.length;
        if (unchanged) {
          usedSids[r.sid] = 1;
          // 22.09-81: серия не изменилась — её даты НЕ трогаем (в т.ч. ручные переносы
          // и уже расставленные задачи). Правило «только рабочие дни мастера»
          // применяется только к новым и изменённым сериям ниже.
          // незакрытые задачи серии с прошедшей датой — убираем (они «горят
          // красным» как просрочка), НО только если прошедшие дни не добавляются
          if (!pastOn) {
            (old.occs || []).forEach(function (oc) {
              var tk = oc.tid ? TASKS_DB.getTask(oc.tid) : null; // из БД: S.tasks может быть устаревшим
              if (tk && !isDone(tk) && tk.d < 0 && (!tk.graphId || tk.graphId === g.id)) { TASKS_DB.hardDeleteTask(tk.id); oc.tid = null; removed++; } // 22.09-227: чужую (привязанную из другого графика) не удаляем
            });
          }
          newWorks.push(old); return;
        }
        if (old) killSeries(old); // серия изменилась — старые задачи убираем
        var w = { sid: r.sid || gwNewSid(), wid: r.wid, period: r.period, dev: r.dev, first: r.first, occs: [] };
        if (r.wid && r.first && r.period > 0) {
          var firstYear = gwFromISO(r.first).getFullYear();
          // 22.09-189: якорь вне года графика (опечатка вида «20039-08-01») — серию
          // НЕ рассчитываем: раньше строковое сравнение ('20039' < '2026') пускало
          // такой якорь в цикл, и он наставлял сотни задач на тысячи лет вперёд
          if (isNaN(firstYear) || firstYear > g.year || firstYear < 2000) {
            yearWarn++;
          } else {
          var endISO = g.year + '-12-31';
          var iso = r.first, guard = 0;
          // слесаря бригады мастера (вкладка «Работники») — исполнители задачи
          var brigIds = wkBrigadeOf(g.respId).map(function (u) { return u.id; });
          while (iso <= endISO && gwFromISO(iso).getFullYear() <= g.year && guard < 400) { // 22.09-189: стоп по году числом
            // Дата выполнения = якорь серии, сдвинутый НАЗАД до рабочего дня
            // мастера графика (график смен «Работники»). Шаг серии при этом
            // считается ОТ ЯКОРЯ — периодичность (минус отклонение) не плывёт.
            var occIso = gwOccDate(g.respId, iso, g.year);
            if (occIso !== iso) shiftedCnt++;
            // ПРОШЕДШИЕ даты: в графике остаются треугольниками. Задачи в
            // планировании создаются, только если у объекта включено
            // «Добавлять задачи на прошедшие дни»
            var isPast = gwFromISO(occIso) < TODAY;
            var tk = null;
            if (!isPast || pastOn) {
              // дедлайн = (сдвинутая) дата выполнения + дни из отклонения
              var dlIso = gwAddDaysISO(occIso, r.dev || 0);
              // 22.09-227: объект+работа+дата уже есть в планировании (другой
              // график) — задачу не дублируем, серия привязывается к имеющейся
              var dupT2 = gwFindPlanTask(ob.oid, r.wid, occIso);
              if (dupT2) { tk = dupT2; dupCnt++; }
              else try {
                tk = TASKS_DB.addTask({
                  m: g.respId, d: dateToOff(gwFromISO(occIso)), o: ob.oid, w: r.wid, garea: area,
                  s: 'plan', status: 'plan', volume: 1,
                  slesari: brigIds, // слесаря, указанные у мастера во вкладке «Работники»
                  dl_date: dlIso, dl: dateToOff(gwFromISO(dlIso)),
                  graphId: g.id, graphRi: ri, graphSid: w.sid
                });
                created++;
              } catch (eTask) {
                // задача не создалась (например, хранилище переполнено) —
                // треугольник в графике всё равно ставим
                tk = null;
                taskFail++;
              }
            }
            w.occs.push({ date: occIso, tid: tk ? tk.id : null, wid: r.wid });
            iso = gwNextISO(iso, r.period, r.dev); // шаг = периодичность − отклонение
            guard++;
          }
          }
        }
        if (r.sid) usedSids[r.sid] = 1;
        newWorks.push(w);
      });
      // строки, удалённые из окна: задачи их серий убираем
      oldWorks.forEach(function (ow) { if (ow.sid && !usedSids[ow.sid]) killSeries(ow); });
      // 22.09-159: совместные работы ЭТОГО объекта — проведения в одном месяце → в один день
      jointMoved += gwJointAlign(newWorks, area);
      ob.works = newWorks;
      delete ob.workId; delete ob.workName; delete ob.period; delete ob.dev; delete ob.first; delete ob.occs;
      // 22.09-138: набор работ объекта — ОБЩИЙ: пишем на объект и разносим по
      // другим графикам с этим объектом (их рассчитанные даты НЕ трогаем).
      try {
        var cfgRows = newWorks.filter(function (w) { return w && w.wid; }).map(gowRowCfg);
        graphObjWorksCfgSave(ob.oid, cfgRows);
        var pr = graphObjWorksPropagate(list, ob.oid, cfgRows, g.id);
        propStat.updated += pr.updated; propStat.added += pr.added; propStat.removed += pr.removed;
      } catch (eProp) { try { console.error('gow propagate:', eProp); } catch (_e) {} }
    });
    g.area = area;
    graphsSaveList(list);
    if (TASKS_DB) S.tasks = TASKS_DB.getTasks();
    overlay.classList.remove('show');
    modal.style.maxWidth = '';
    modal.style.width = '';
    logAction('Периодичность графика', g.name + ' (' + area + '): создано работ ' + created + ', удалено старых ' + removed);
    if (propStat.updated || propStat.added || propStat.removed) toast('ok', '🔗 Общий набор работ объекта синхронизирован с другими графиками (обновлено строк: ' + propStat.updated + ', добавлено: ' + propStat.added + ', убрано: ' + propStat.removed + ') — их уже рассчитанные даты не менялись');
    var respIsMaster = getMasters().some(function (m) { return m.id === g.respId; });
    if (!respIsMaster) toast('warn', '⚠ Ответственный графика — не мастер: работы СОЗДАЮТСЯ, но не отображаются в планировании. Измените ответственного на мастера («Список графиков» → правка).');
    if (yearWarn) toast('warn', '⚠ У ' + yearWarn + ' работ дата первого проведения позже ' + g.year + ' года — они не попадут в график.');
    if (created || removed || dupCnt) toast('ok', 'Работы в планировании: создано ' + created + (removed ? ', удалено старых ' + removed : '') + (dupCnt ? ', уже были в планировании (привязаны из другого графика, не дублируются): ' + dupCnt : '') + '. Треугольники выставлены в графике.');
    if (shiftedCnt) toast('ok', '⏮ По графику смен мастера: ' + shiftedCnt + ' вхождений перенесено на ближайший предыдущий рабочий день.');
    if (jointMoved) toast('ok', '🤝 Совместные работы: ' + jointMoved + ' проведений совмещены в один день с более ранней совместной работой того же месяца');
    if (taskFail) toast('warn', '⚠ Не удалось создать задач: ' + taskFail + ' (возможно, память браузера переполнена). Треугольники в графике выставлены.');
    else if (!yearWarn) toast('ok', 'Периодичность сохранена');
    if (S.screen === 'graphs') renderGraphs();
    else if (S.screen === 'calendar') drawCalendarGrid();
  }

  /* 22.09-159: ВЫРАВНИВАНИЕ СОВМЕСТНЫХ РАБОТ (joint_with) ОДНОГО объекта.
     Если у двух совместных серий есть проведения в ОДНОМ месяце — более
     позднее (первое в месяце) переносится на день более раннего (тот же день;
     рабочий день уже обеспечен у исходной даты). Даты задач этих проведений
     переносятся тоже (выполненные не трогаем — это история). Отмечать
     совместность достаточно у одной из пары. Возвращает число переносов.
     22.09-206: совместность теперь по ГРУППАМ работ (joint_with = пути групп);
     поддержаны и старые записи с id видов работ. */
  function gwJointAlign(newWorks, area) {
    var ws = (newWorks || []).filter(function (x) { return x && x.wid && x.occs && x.occs.length; });
    if (ws.length < 2) return 0;
    var moved = 0;
    function jointsOf(wid2) {
      try {
        var w = WORK.getWork(area, wid2);
        var j = w && w.joint_with;
        return Array.isArray(j) ? j : (j ? [j] : []);
      } catch (e) { return []; }
    }
    function groupOf(wid2) {
      try { var w = WORK.getWork(area, wid2); return (w && w.group) ? String(w.group).trim() : ''; } catch (e) { return ''; }
    }
    // 22.09-206: пара совместная, если id или группа есть в списке совместных друг друга
    function isJointPair(wa, wb) {
      var ja = jointsOf(wa), jb = jointsOf(wb);
      if (ja.indexOf(wb) >= 0 || jb.indexOf(wa) >= 0) return true; // старый формат — по id видов работ
      var ga = groupOf(wa), gb = groupOf(wb);
      return (gb && ja.indexOf(gb) >= 0) || (ga && jb.indexOf(ga) >= 0); // по группам работ
    }
    function monthOf(iso) { return +String(iso).slice(5, 7) - 1; }
    function firstOccOf(wrk, mi) {
      var o = null;
      (wrk.occs || []).forEach(function (oc) { if (!o && monthOf(oc.date) === mi) o = oc; });
      return o;
    }
    function moveOcc(wrk, oc, newIso) {
      if (!oc || oc.date === newIso) return;
      oc.date = newIso; moved++;
      if (!oc.tid || !TASKS_DB) return;
      var t = null; try { t = TASKS_DB.getTask(oc.tid); } catch (eT) {}
      if (!t) return;
      try { if (isDone(t)) return; } catch (eD) {} // выполненные — история, не двигаем
      try {
        try { invalidateRouteCache(t.m, t.d); } catch (eR) {}
        t.d = dateToOff(gwFromISO(newIso));
        t.dl_date = gwAddDaysISO(newIso, wrk.dev || 0);
        t.dl = dateToOff(gwFromISO(t.dl_date));
        TASKS_DB.updateTask(t.id, t);
        try { invalidateRouteCache(t.m, t.d); } catch (eR2) {}
      } catch (eU) {}
    }
    for (var a = 0; a < ws.length; a++) {
      for (var b = 0; b < ws.length; b++) {
        if (a === b || !isJointPair(ws[a].wid, ws[b].wid)) continue; // b — совместная с a
        for (var mi = 0; mi < 12; mi++) {
          var oa = firstOccOf(ws[a], mi), obb = firstOccOf(ws[b], mi);
          if (oa && obb) {
            // в одном месяце — позднее проведение на день более раннего (любая из пары)
            if (obb.date > oa.date) moveOcc(ws[b], obb, oa.date);
            else if (oa.date > obb.date) moveOcc(ws[a], oa, obb.date);
          }
        }
      }
    }
    return moved;
  }

  /* Созданная в планировании задача попадает в график: в серию работы
     (по виду работы задачи) объекта графика; последующие вхождения
     строятся дальше с шагом = периодичность − отклонение */
  function graphSeriesOnCreate(t) {
    if (!t || !t.o) return;
    var list = graphsLoad();
    var g = null, ri = -1;
    for (var i = 0; i < list.length && !g; i++) {
      var objs = list[i].objs || [];
      for (var j = 0; j < objs.length; j++) {
        if (objs[j].oid !== t.o) continue; // только объект, к которому относится задача
        var ws = gwObjWorks(objs[j]);
        for (var q = 0; q < ws.length; q++) if (ws[q].period > 0) { g = list[i]; ri = j; break; }
        if (g) break;
      }
    }
    if (!g) return; // объект не в графике с периодичностью
    var f = graphSeriesFind(g, { graphRi: ri, o: t.o, w: t.w, graphSid: null });
    if (!f) return;
    var wrk = f.wrk;
    wrk.occs = wrk.occs || [];
    var iso = gwToISO(offToDate(t.d));
    t.graphId = g.id; t.graphRi = ri; t.graphSid = wrk.sid; t.garea = g.area || '';
    if (TASKS_DB) TASKS_DB.updateTask(t.id, { graphId: t.graphId, graphRi: t.graphRi, graphSid: t.graphSid, garea: t.garea });
    var idx = 0;
    while (idx < wrk.occs.length && wrk.occs[idx].date <= iso) idx++;
    wrk.occs.splice(idx, 0, { date: iso, tid: t.id, wid: (t.w || wrk.wid || '') });
    var prevA = iso; // якорь — дата включённой задачи
    for (var k = idx + 1; k < wrk.occs.length; k++) {
      prevA = gwNextISO(prevA, wrk.period, wrk.dev || 0);
      var occIso3 = gwOccDate(g.respId, prevA, g.year); // 22.09-80: пред. рабочий день
      wrk.occs[k].date = occIso3;
      var tk = wrk.occs[k].tid ? TASKS_DB.getTask(wrk.occs[k].tid) : null; // из БД
      if (tk) {
        tk.d = dateToOff(gwFromISO(occIso3));
        // 22.09-101: дедлайн = дата выполнения + «Отклонение, дней» из графика работ
        var dlIso3 = gwAddDaysISO(occIso3, wrk.dev || 0);
        if (TASKS_DB) TASKS_DB.updateTask(tk.id, { d: tk.d, dl: dateToOff(gwFromISO(dlIso3)), dl_date: dlIso3 });
      }
    }
    graphsSaveList(list);
    if (S.screen === 'graphs') renderGraphs();
    toast('ok', 'Задача включена в график «' + g.name + '» — серия продолжена по периодичности');
  }

  /* Перемещение задачи из графика в планировании: обновляем дату вхождения
     и все ПОСЛЕДУЮЩИЕ — от новой даты с шагом = периодичность − отклонение */
  function graphSeriesOnMove(t) {
    var list = graphsLoad();
    var g = null;
    list.forEach(function (x) { if (x.id === t.graphId) g = x; });
    var f = graphSeriesFind(g, t);
    if (!f) return;
    var wrk = f.wrk;
    if (!wrk.occs || !wrk.period) return;
    var idx = -1;
    for (var i = 0; i < wrk.occs.length; i++) if (wrk.occs[i].tid === t.id) { idx = i; break; }
    if (idx === -1) return;
    wrk.occs[idx].date = gwToISO(offToDate(t.d));
    // Последующие: якорь = шаг от поставленной вручную даты, а дата выполнения —
    // якорь, сдвинутый назад до рабочего дня мастера графика (22.09-80).
    var prevA = wrk.occs[idx].date;
    for (var k = idx + 1; k < wrk.occs.length; k++) {
      prevA = gwNextISO(prevA, wrk.period, wrk.dev || 0);
      var occIso3 = gwOccDate(g.respId, prevA, g.year);
      wrk.occs[k].date = occIso3;
      var tk = wrk.occs[k].tid ? TASKS_DB.getTask(wrk.occs[k].tid) : null; // из БД
      if (tk) {
        tk.d = dateToOff(gwFromISO(occIso3));
        // 22.09-101: дедлайн = дата выполнения + «Отклонение, дней» из графика работ
        var dlIso3 = gwAddDaysISO(occIso3, wrk.dev || 0);
        if (TASKS_DB) TASKS_DB.updateTask(tk.id, { d: tk.d, dl: dateToOff(gwFromISO(dlIso3)), dl_date: dlIso3 });
      }
    }
    graphsSaveList(list);
    if (S.screen === 'graphs') renderGraphs();
  }

  /* ===== ФИЛЬТР ГРАФИКА ===== */
  /* Окно фильтра: объекты в столбик с чекбоксами (вкл/выкл видимости),
     поиск по типу, наименованию и номеру. Применяется к отображению
     таблиц графика, НЕ затрагивая запланированные работы и задачи. */
  /* ===== 22.09-158: ТРУДОЁМКОСТЬ ГРАФИКА =====
     Часы одного проведения = норма работы (у задач графика объём всегда 1 —
     см. создание задач в graphsPeriodSave). Считаем по датам треугольников
     (occs): итог за год, по месяцам и по объектам. */
  function graphsLaborStats(g, area) {
    var months = [];
    for (var i = 0; i < 12; i++) months.push({ h: 0, occ: 0 });
    var objs = [];
    var yearH = 0, occTotal = 0, series = 0, noNorm = 0;
    (g.objs || []).forEach(function (ob) {
      var row = { name: ob.name || '', type: ob.type || '', h: 0, occ: 0, works: 0 };
      gwObjWorks(ob).forEach(function (wrk) {
        series++; row.works++;
        var w = null;
        try { w = wrk.wid ? WORK.getWork(area, wrk.wid) : null; } catch (eW) {}
        var h1 = (w && isFinite(+w.norm) && +w.norm > 0) ? +w.norm : 0;
        if (!w || !h1) noNorm++;
        (wrk.occs || []).forEach(function (oc) {
          var d = String(oc && oc.date || '');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
          if (parseInt(d.slice(0, 4), 10) !== (+g.year)) return; // только год графика
          var mi = parseInt(d.slice(5, 7), 10) - 1;
          if (mi < 0 || mi > 11) return;
          row.h += h1; row.occ++;
          months[mi].h += h1; months[mi].occ++;
          yearH += h1; occTotal++;
        });
      });
      objs.push(row);
    });
    return { yearH: yearH, occTotal: occTotal, months: months, objs: objs, series: series, noNorm: noNorm };
  }
  // 22.09-200: в окнах «Трудоёмкость графика» часы — до 3 знаков после запятой (лишние нули не выводятся: 12,3 · 0,15 · 4,167)
  function fmtH3(h) { var v = Math.round((+h || 0) * 1000) / 1000; return String(v).replace('.', ','); }
  function graphsLaborTableCss() { return 'width:100%;border-collapse:collapse;font-size:12.5px'; }
  function graphsLaborCellCss(head) { return 'border:1px solid var(--line);padding:6px 9px;text-align:' + (head ? 'left' : 'right') + ';' + (head ? 'font-weight:800;background:var(--panel-2)' : ''); }
  function openGraphLaborModal() {
    var g = graphsFind(GS.cur);
    if (!g) { toast('err', 'Сначала создайте или выберите график'); return; }
    var area = graphAreaDefault(g);
    var st = graphsLaborStats(g, area);
    var h = '<div class="modal-h"><h3>📊 Трудоёмкость графика «' + esc(g.name || 'Без названия') + '» · ' + esc(String(g.year)) + ' г.</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    if (!st.series) {
      h += '<div class="empty" style="padding:18px;font-size:13px">В графике пока нет работ — сначала настройте периодичность (кнопка 🔁 на панели), потом сохраните.</div>';
    } else {
      h += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 12px;font-size:13.5px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">' +
        '<span>Итого за год: <b style="font-size:16px;color:#15803d">' + fmtH3(st.yearH) + ' чел/ч</b></span>' +
        '<span style="color:var(--muted)">проведений за год: <b>' + st.occTotal + '</b></span>' +
        '<span style="color:var(--muted)">объектов: <b>' + st.objs.length + '</b></span>' +
        '<span style="color:var(--muted)">видов работ: <b>' + st.series + '</b></span>' +
        '<span style="color:var(--muted)">в среднем в месяц: <b>' + fmtH3(st.yearH / 12) + ' чел/ч</b></span>' +
        '</div>';
      h += '<div style="font-weight:800;margin:14px 0 6px;font-size:13px">📅 По месяцам</div>';
      h += '<table style="' + graphsLaborTableCss() + '"><tr>' +
        '<th style="' + graphsLaborCellCss(true) + '">Месяц</th>' +
        '<th style="' + graphsLaborCellCss(true) + 'text-align:right">Проведений</th>' +
        '<th style="' + graphsLaborCellCss(true) + 'text-align:right">Трудоёмкость, чел/ч</th>' +
        '<th style="' + graphsLaborCellCss(true) + 'text-align:right">% года</th></tr>';
      st.months.forEach(function (mo, mi) {
        if (!mo.occ && !mo.h) return;
        var pct = st.yearH > 0 ? Math.round(mo.h / st.yearH * 1000) / 10 : 0;
        h += '<tr><td style="' + graphsLaborCellCss(false) + 'text-align:left">' + esc(MONTHS_RU[mi]) + '</td>' +
          '<td style="' + graphsLaborCellCss(false) + '">' + mo.occ + '</td>' +
          '<td style="' + graphsLaborCellCss(false) + '"><b>' + fmtH3(mo.h) + '</b></td>' +
          '<td style="' + graphsLaborCellCss(false) + 'color:var(--muted)">' + String(pct).replace('.', ',') + '%</td></tr>';
      });
      h += '<tr style="font-weight:800;background:#f0fdf4"><td style="' + graphsLaborCellCss(false) + 'text-align:left">ИТОГО за год</td>' +
        '<td style="' + graphsLaborCellCss(false) + '">' + st.occTotal + '</td>' +
        '<td style="' + graphsLaborCellCss(false) + '">' + fmtH3(st.yearH) + '</td>' +
        '<td style="' + graphsLaborCellCss(false) + 'color:var(--muted)">100%</td></tr>';
      h += '</table>';
      // 22.09-200: таблица «По объектам» внизу убрана — осталась только кнопка «📍 По объектам» внизу окна (отдельное окно, 22.09-196)
      h += '</table>';
      if (st.noNorm) h += '<div style="font-size:12.5px;color:#92400e;margin-top:8px">⚠ У ' + st.noNorm + ' видов работ не задана норма (ч/ед.) в справочнике — они не учтены в часах (проведения посчитаны).</div>';
      h += '<div style="font-size:12.5px;color:var(--muted);margin-top:8px;line-height:1.5">Часы одного проведения = норма работы из справочника «Виды работ» (у задач графика объём — 1). Даты берутся из треугольников графика; проведения других лет не учитываются.</div>';
    }
    h += '</div>';
    h += '<div class="modal-f" style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn primary" data-action="graphs-labor-objs" title="Новое окно: трудоёмкость по каждому объекту за выбранный год, месяц или произвольный период; нажатие на объект — его карточка с работами, датами и часами за выбранный период">📍 По объектам</button><button type="button" class="btn" data-action="close-modal">Закрыть</button></div>';
    modal.innerHTML = h;
    modal.style.width = '60%'; modal.style.maxWidth = '60%'; // сброс — в close-modal
    overlay.classList.add('show');
  }

