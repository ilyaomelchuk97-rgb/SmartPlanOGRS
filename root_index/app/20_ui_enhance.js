  /* ── часть 20 · app/20_ui_enhance.js — улучшения интерфейса: поиск и сортировка таблиц, липкие шапки, пустые состояния, скелетон загрузки, печать (22.09-266) ── */
/* ============================================================
   22.09-266: улучшения интерфейса
   · Поиск и сортировка — во ВСЕХ таблицах страниц (клик по
     заголовку сортирует, над длинной таблицей появляется поиск).
   · Липкие заголовки таблиц (не уезжают при прокрутке) — CSS.
   · Пустые состояния: вместо «нет данных» — понятная подсказка.
   · Скелетон: пока после входа идут данные с сервера, вместо
     пустой панели показываются серые блоки-заготовки.
   · Печать (кнопка 🖨 в шапке): чистый документ с шапкой
     «SmartPlan · УП «МИНГАЗ» · дата · сборка».
   ============================================================ */

  // ---------- Поиск и сортировка таблиц ----------
  function uiSortRows(table, idx, dir) {
    var tb = table.tBodies[0];
    if (!tb) return;
    var rows = Array.prototype.slice.call(tb.rows).filter(function (r) { return r.cells && r.cells.length > idx; });
    var valOf = function (r) {
      var c = r.cells[idx];
      if (!c) return { t: '', n: null };
      var v = String(c.getAttribute('data-sort') || c.textContent || '').trim();
      var n = parseFloat(v.replace(/\s+/g, '').replace(',', '.'));
      return { t: v.toLowerCase(), n: (v !== '' && isFinite(n) && /\d/.test(v)) ? n : null };
    };
    rows.sort(function (a, b) {
      var va = valOf(a), vb = valOf(b);
      var r;
      if (va.n !== null && vb.n !== null) r = va.n - vb.n;
      else r = va.t.localeCompare(vb.t, 'ru');
      return dir === 'asc' ? r : -r;
    });
    rows.forEach(function (r) { tb.appendChild(r); });
  }
  function uiSortHeader(th) {
    if (th.dataset.nosort === '1') return;
    var table = th.closest('table');
    if (!table) return;
    var heads = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    var idx = heads.indexOf(th);
    if (idx < 0) return;
    var dir = (th.dataset.sortDir === 'asc') ? 'desc' : 'asc';
    heads.forEach(function (h) {
      delete h.dataset.sortDir;
      h.classList.remove('ui-sorted');
      var a = h.querySelector('.ui-ar'); if (a) a.parentNode.removeChild(a);
    });
    th.dataset.sortDir = dir;
    th.classList.add('ui-sorted');
    var ar = document.createElement('span');
    ar.className = 'ui-ar';
    ar.textContent = dir === 'asc' ? ' ▲' : ' ▼';
    th.appendChild(ar);
    uiSortRows(table, idx, dir);
  }
  function uiSearchAdd(table) {
    if (table.dataset.uiSearch === '1') return;
    var tb = table.tBodies[0];
    if (!tb || tb.rows.length < 8) return; // короткие таблицы не засоряем
    table.dataset.uiSearch = '1';
    var box = document.createElement('div');
    box.className = 'ui-search no-print';
    box.innerHTML = '<input type="search" placeholder="Поиск по таблице…" aria-label="Поиск по таблице"><span class="ui-search-n"></span>';
    table.parentNode.insertBefore(box, table);
    var inp = box.querySelector('input'), cnt = box.querySelector('.ui-search-n');
    inp.addEventListener('input', function () {
      var words = String(inp.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
      var shown = 0, total = 0;
      Array.prototype.forEach.call(table.tBodies[0].rows, function (r) {
        total++;
        var txt = String(r.textContent || '').toLowerCase();
        var ok = words.every(function (w) { return txt.indexOf(w) >= 0; });
        r.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      cnt.textContent = words.length ? ('показано ' + shown + ' из ' + total) : '';
    });
  }
  function uiEnhance() {
    try {
      var view = document.getElementById('view');
      if (!view) return;
      Array.prototype.forEach.call(view.querySelectorAll('table.dt'), function (table) {
        if (table.dataset.uiPrep !== '1') {
          table.dataset.uiPrep = '1';
          Array.prototype.forEach.call(table.querySelectorAll('thead th'), function (th) {
            th.classList.add('ui-th');
            th.title = (th.title ? th.title + ' · ' : '') + 'клик — сортировка';
            th.addEventListener('click', function (e) {
              if (e && e.target && e.target.tagName === 'INPUT') return;
              uiSortHeader(th);
            });
          });
        }
        uiSearchAdd(table);
      });
    } catch (e) {}
  }
  // Наблюдаем за содержимым страницы: таблица появилась/перерисовалась — дооснащаем
  var _uiObs = null, _uiObsT = null;
  function uiObserve() {
    try {
      var view = document.getElementById('view');
      if (!view || _uiObs) return;
      _uiObs = new MutationObserver(function () {
        if (_uiObsT) clearTimeout(_uiObsT);
        _uiObsT = setTimeout(uiEnhance, 120);
      });
      _uiObs.observe(view, { childList: true, subtree: true });
    } catch (e) {}
  }

  // ---------- Пустые состояния ----------
  function uiEmpty(icon, title, hint, actionLabel, action) {
    return '<div class="ui-empty">' +
      '<div class="ui-empty-ic">' + icon + '</div>' +
      '<div class="ui-empty-t">' + esc(title) + '</div>' +
      (hint ? '<div class="ui-empty-h">' + esc(hint) + '</div>' : '') +
      (actionLabel ? '<button class="btn primary" data-action="' + esc(action || '') + '">' + esc(actionLabel) + '</button>' : '') +
      '</div>';
  }

  // ---------- Скелетон при первой загрузке ----------
  function uiDataReady() {
    try {
      if (!(window.SP_API && SP_API.getToken && SP_API.getToken())) return true;  // локальный режим — данные уже есть
      if (!(window.SP_SYNC_POLL && SP_SYNC_POLL.isReady)) return true;
      return !!SP_SYNC_POLL.isReady();
    } catch (e) { return true; }
  }
  function uiSkeletonMaybe() {
    try {
      if (uiDataReady()) return false;
      var view = document.getElementById('view');
      if (!view) return false;
      var card = '<div class="sk-card"><div class="sk sk-t"></div><div class="sk sk-l"></div><div class="sk sk-l"></div><div class="sk sk-l sk-short"></div></div>';
      view.innerHTML = '<div class="sk-wrap">' +
        '<div class="sk-note">Загружаем данные с сервера…</div>' +
        '<div class="sk-cards">' + card + card + card + card + '</div>' +
        '<div class="sk-card"><div class="sk sk-t"></div><div class="sk sk-r"></div><div class="sk sk-r"></div><div class="sk sk-r"></div><div class="sk sk-r"></div></div>' +
        '</div>';
      return true;
    } catch (e) { return false; }
  }

  // ---------- Печать ----------
  function uiPrintFill() {
    try {
      var h = document.getElementById('print-head');
      if (!h) return;
      var who = (S.user && S.user.full_name) ? (' · ' + S.user.full_name) : '';
      var scr = (document.getElementById('screen-title') || {}).textContent || '';
      h.innerHTML = '<div class="ph-t">SmartPlan · УП «МИНГАЗ»</div>' +
        '<div class="ph-s">' + esc(scr) + who + ' · ' + new Date().toLocaleString('ru-RU') + ' · сборка ' + SP_BUILD + '</div>';
    } catch (e) {}
  }
  function uiPrint() {
    try { uiPrintFill(); } catch (e) {}
    setTimeout(function () { try { window.print(); } catch (e) {} }, 60);
  }
  window.addEventListener('beforeprint', uiPrintFill);
  // доступ из других частей и автотестов
  window.SP_UI = { enhance: uiEnhance, print: uiPrint, printFill: uiPrintFill, skeleton: uiSkeletonMaybe, empty: uiEmpty, ready: uiDataReady };
