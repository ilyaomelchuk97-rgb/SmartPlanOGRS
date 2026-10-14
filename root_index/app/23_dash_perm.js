  /* ── часть 23 · app/23_dash_perm.js — настройка панели мониторинга (виджеты) и права доступа (общие, на сервере) (22.09-268) ── */
/* ============================================================
   22.09-268
   1) НАСТРОЙКА ПАНЕЛИ (виджеты): кнопка «⚙ Настроить» на панели
      мониторинга — какие блоки показывать и в каком порядке
      (списком со стрелками ↑/↓). Настройка личная (в этом браузере).
   2) ПРАВА ДОСТУПА (общие для всех устройств): таблица
      «действие × роль» хранится на сервере (раздел settings,
      запись id='perm'). Что реально управляется:
        · sendAnn   — рассылать объявления работникам
        · viewLogs  — видеть «Журнал действий» и «Логи ошибок»
        · delTasks  — удалять задачи и чистить корзину
        · exportData— выгружать данные (бэкап базы, Excel пользователей)
      Администратор может всё всегда.
   ============================================================ */

  // ================= 1. Настройка панели =================
  var DW_KEY = 'smartplan_dash_widgets_v1';
  var DW_LIST = [
    { key: 'filter',  label: 'Фильтр по участку' },
    { key: 'kpi',     label: 'Показатели (плитки КPI)' },
    { key: 'warn',    label: 'Предупреждения (ордера, погода)' },
    { key: 'weather', label: 'Погода' },
    { key: 'today',   label: 'Сегодня (работы и шкала дня)' },
    { key: 'charts',  label: 'КПД мастеров и выполнение по дням' }
  ];
  function dwStandardOrder() { return DW_LIST.map(function (w) { return w.key; }); }
  // Порядок блоков. Если пользователь ничего не настраивал — стандартный (как раньше).
  function dwLoad() {
    try {
      var raw = localStorage.getItem(DW_KEY);
      if (raw === null) return dwStandardOrder();          // 22.09-270: без настройки — как было
      var a = JSON.parse(raw || '[]');
      if (!Array.isArray(a) || !a.length) return dwStandardOrder();
      var out = [];
      a.forEach(function (k) { if (typeof k === 'string' && DW_LIST.some(function (w) { return w.key === k; }) && out.indexOf(k) < 0) out.push(k); });
      DW_LIST.forEach(function (w) { if (out.indexOf(w.key) < 0) out.push(w.key); });
      return out;
    } catch (e) { return dwStandardOrder(); }
  }
  // Настраивал ли пользователь панель (порядок или видимость)
  function dwIsCustom() {
    try { return localStorage.getItem(DW_KEY) !== null || localStorage.getItem(DW_KEY + '_hidden') !== null; } catch (e) { return false; }
  }
  function dwHidden() {
    try { var h = JSON.parse(localStorage.getItem(DW_KEY + '_hidden') || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; }
  }
  function dwSave(order, hidden) {
    try { localStorage.setItem(DW_KEY, JSON.stringify(order)); localStorage.setItem(DW_KEY + '_hidden', JSON.stringify(hidden)); } catch (e) {}
  }
  // Собрать блоки панели по меткам data-dw (надёжно, без «угадывания»)
  function dwCollect() {
    var view = document.getElementById('view');
    var map = { filter: [], kpi: [], warn: [], weather: [], today: [], charts: [] };
    if (!view) return { map: map, grid: null };
    Array.prototype.forEach.call(view.querySelectorAll('[data-dw]'), function (n) {
      var k = n.getAttribute('data-dw');
      if (k === 'grid') return;
      if (!map[k]) map[k] = [];
      map[k].push(n);
    });
    return { map: map, grid: view.querySelector('[data-dw="grid"]') };
  }
  // Применить порядок и видимость блоков к панели
  function dwApply() {
    try {
      if (S.screen !== 'dashboard') return;
      var col = dwCollect();
      var map = col.map, grid = col.grid;
      if (!map.filter.length && !map.kpi.length && !map.today.length) return;   // панель ещё не отрисована
      var order = dwLoad(), hidden = dwHidden();
      // 22.09-270: пока панель не настроена — оставляем её ровно как раньше (только кнопка настройки)
      if (!dwIsCustom()) return;   // 22.09-270: пока панель не настроена — стандартный вид

      // 1) видимость: скрыть/показать все узлы каждого виджета
      DW_LIST.forEach(function (w) {
        (map[w.key] || []).forEach(function (n) {
          n.style.display = (hidden.indexOf(w.key) >= 0) ? 'none' : '';
        });
      });
      // 2) порядок карточек ВНУТРИ «Сегодня + графики» (по относительному порядку)
      var chartsFirst = order.indexOf('charts') < order.indexOf('today');
      var seqIn = chartsFirst ? [map.charts[0], map.today[0]] : [map.today[0], map.charts[0]];
      if (grid) seqIn.forEach(function (n) { if (n && n.parentNode) n.parentNode.appendChild(n); });

      // 3) порядок блоков на странице: собираем по списку, «сетка» встаёт
      //    на месте первого из «Сегодня»/«графиков»
      var seq = [], gridPlaced = false;
      order.forEach(function (k) {
        if (k === 'today' || k === 'charts') {
          if (!gridPlaced && grid) { seq.push(grid); gridPlaced = true; }
          return;
        }
        (map[k] || []).forEach(function (n) { seq.push(n); });
      });
      var view = document.getElementById('view');
      seq.forEach(function (n) { if (n && n.parentNode) view.appendChild(n); });   // порядок = порядок в seq
    } catch (e) {}
  }
  function dashboardDecorate() {
    try {
      if (S.screen !== 'dashboard') { try { dashSetupBtnSync(); } catch (e0) {} return; }
      try { dashSetupBtnSync(); } catch (e1) {}   // 22.09-271: кнопка настройки — в шапке, только на панели
      dwApply();
    } catch (e) {}
  }
  var _dwTmpHidden = null; // состояние галочек в открытом окне (не сбрасывать при перестановке)
  // ===== Окно настройки: строки перетаскиваются МЫШКОЙ (без стрелок) =====
  // Строка всегда остаётся внутри списка (не может «улететь» за окно).
  var _dwDragRow = null;
  function openDashSetup() {
    var hidden = _dwTmpHidden || dwHidden(), order = dwLoad();
    var rows = order.map(function (k) {
      var w = DW_LIST.filter(function (x) { return x.key === k; })[0] || { key: k, label: k };
      return '<div class="dw-row" data-dw-key="' + esc(w.key) + '">' +
        '<span class="dw-grip" title="Потяните мышкой, чтобы изменить порядок">⠿</span>' +
        '<label class="dw-lab"><input type="checkbox" data-dw-on="' + w.key + '"' + (hidden.indexOf(w.key) < 0 ? ' checked' : '') + '> ' + esc(w.label) + '</label>' +
        '</div>';
    }).join('');
    var modal = document.getElementById('modal');
    overlay.classList.add('show');
    modal.style.maxWidth = '560px';
    modal.innerHTML = '<div class="modal-h"><h3>⚙ Настройка панели мониторинга</h3><button class="x" data-action="close-modal">×</button></div>' +
      '<div class="modal-b">' +
        '<div class="dw-hint">Потяните блок мышкой за значок ⠿ — он встанет на новое место. Галочкой можно скрыть ненужный блок. Изменения видны на панели сразу.</div>' +
        '<div id="dw-list">' + rows + '</div>' +
      '</div>' +
      '<div class="modal-f"><button class="btn" data-action="dash-setup-reset">Вернуть как было</button><button class="btn primary" data-action="dash-setup-save">Готово</button></div>';
    dwWireDrag();
  }
  // Перетаскивание строк внутри списка (pointer events; строка физически не покидает список):
  // события — на документе, а перетаскиваемая строка исключена из «поиска под курсором»,
  // поэтому она не мешает сама себе и не выходит за пределы окна настройки.
  function dwWireDrag() {
    try {
      Array.prototype.forEach.call(document.querySelectorAll('#dw-list .dw-row'), function (row) {
        row.addEventListener('pointerdown', function (e) {
          if (e.target && (e.target.tagName === 'INPUT' || (e.target.closest && e.target.closest('label')))) return;
          if (_dwDragRow) return;
          _dwDragRow = row;
          row.classList.add('dw-dragging');
          row.style.pointerEvents = 'none';   // курсор «видит» строки под ней, а не саму перетаскиваемую
          e.preventDefault();
          document.addEventListener('pointermove', dwDragMove);
          document.addEventListener('pointerup', dwDragEnd);
          document.addEventListener('pointercancel', dwDragEnd);
        });
      });
      Array.prototype.forEach.call(document.querySelectorAll('#dw-list input[data-dw-on]'), function (c) {
        c.addEventListener('change', function () { dwSaveFromModal(); });
      });
    } catch (e) {}
  }
  function dwDragMove(e) {
    try {
      var row = _dwDragRow;
      var list = document.getElementById('dw-list');
      if (!row || !list) return;
      var box = list.getBoundingClientRect();
      // курсор держим в пределах списка — строка не может уйти за окно настройки
      var y = Math.min(Math.max(e.clientY, box.top + 2), box.bottom - 2);
      var el = document.elementFromPoint(e.clientX, y);
      var target = el && el.closest ? el.closest('.dw-row') : null;
      if (target && target !== row && target.parentNode === list) {
        var r = target.getBoundingClientRect();
        var after = (y - r.top) > r.height / 2;
        list.insertBefore(row, after ? target.nextSibling : target);
      }
    } catch (e2) {}
  }
  function dwDragEnd(e) {
    try {
      var row = _dwDragRow;
      document.removeEventListener('pointermove', dwDragMove);
      document.removeEventListener('pointerup', dwDragEnd);
      document.removeEventListener('pointercancel', dwDragEnd);
      if (row) {
        row.classList.remove('dw-dragging');
        row.style.pointerEvents = '';
      }
      _dwDragRow = null;
      dwSaveFromModal();   // сохранить и применить сразу
    } catch (e) {}
  }
  // Собрать порядок и видимость из окна, сохранить, применить к панели
  function dwSaveFromModal() {
    try {
      var order = [];
      Array.prototype.forEach.call(document.querySelectorAll('#dw-list .dw-row'), function (r) { order.push(r.getAttribute('data-dw-key')); });
      if (!order.length) return;
      DW_LIST.forEach(function (w) { if (order.indexOf(w.key) < 0) order.push(w.key); });
      var hidden = [];
      Array.prototype.forEach.call(document.querySelectorAll('#dw-list input[data-dw-on]'), function (c) { if (!c.checked) hidden.push(c.getAttribute('data-dw-on')); });
      _dwTmpHidden = hidden;
      dwSave(order, hidden);
      dwApply();
    } catch (e) {}
  }
  // Программная перестановка (для автотестов и других частей)
  function dwMoveTo(key, index) {
    try {
      var order = dwLoad();
      var i = order.indexOf(key);
      if (i < 0) return;
      order.splice(i, 1);
      index = Math.max(0, Math.min(index, order.length));
      order.splice(index, 0, key);
      dwSave(order, dwHidden());
      dwApply();
    } catch (e) {}
  }
  function dashSetupSave() {
    try {
      dwSaveFromModal();
      _dwTmpHidden = null;
      try { document.getElementById('overlay').classList.remove('show'); } catch (e) {}
      try { document.getElementById('modal').style.maxWidth = ''; } catch (e2) {}
      toast('ok', '✓ Панель настроена');
    } catch (e) {}
  }
  function dashSetupReset() {
    try { localStorage.removeItem(DW_KEY); localStorage.removeItem(DW_KEY + '_hidden'); _dwTmpHidden = null; } catch (e) {}
    try { document.getElementById('overlay').classList.remove('show'); } catch (e) {}
    toast('ok', 'Панель — как было (стандартный порядок)');
    if (typeof renderDashboard === 'function') { renderDashboard(); dashboardDecorate(); }
  }

  // Карточка «Права доступа» — таблица «действие × роль» (общая, на сервере)
  function permRenderMatrix() {
    var view = document.getElementById('view');
    if (!view) return;
    var box = document.getElementById('perm-matrix');
    if (!box) {
      box = document.createElement('div');
      box.id = 'perm-matrix';
      box.className = 'card';
      box.style.marginTop = '14px';
      view.appendChild(box);
    }
    var p = permLoad();
    var h = '<div class="card-h"><h2>🔐 Права доступа</h2><span class="sub">Общие для всех устройств · администратор может всё всегда</span></div><div class="card-b">';
    h += '<table class="dt"><thead><tr><th>Действие</th>';
    PERM_ROLES.forEach(function (r) { h += '<th style="text-align:center">' + esc(r.label) + '</th>'; });
    h += '</tr></thead><tbody>';
    PERM_ACTIONS.forEach(function (a) {
      h += '<tr><td>' + esc(a.label) + '</td>';
      PERM_ROLES.forEach(function (r) {
        var on = !!(p[a.key] && p[a.key][r.key]);
        h += '<td style="text-align:center"><input type="checkbox" data-perm="' + a.key + '" data-role="' + r.key + '"' + (on ? ' checked' : '') + '></td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';
    h += '<div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<button class="btn primary" data-action="perm-save-matrix">Сохранить права</button>' +
      '<span style="font-size:12.5px;color:var(--muted)">Изменения применяются у всех, кто откроет сайт заново или обновит страницу.</span></div>';
    h += '</div>';
    box.innerHTML = h;
  }
  function permSaveMatrix() {
    if (S.role !== 'admin') { toast('err', 'Менять права может только администратор'); return; }
    var perms = {};
    document.querySelectorAll('[data-perm]').forEach(function (c) {
      var a = c.getAttribute('data-perm'), r = c.getAttribute('data-role');
      if (!perms[a]) perms[a] = {};
      perms[a][r] = !!c.checked;
    });
    var summary = PERM_ACTIONS.map(function (a) {
      var roles = PERM_ROLES.filter(function (r) { return perms[a.key] && perms[a.key][r.key]; }).map(function (r) { return r.label; });
      return a.label + ': ' + (roles.length ? roles.join(', ') : 'только админ');
    }).join(' · ');
    permSaveAll(perms);
    logAction('Изменение прав доступа', summary.slice(0, 300));
  }

  // ================= 2. Права доступа (общие) =================
  var PERM_ACTIONS = [
    { key: 'sendAnn',    label: 'Рассылать объявления работникам' },
    { key: 'viewLogs',   label: 'Видеть «Журнал действий» и «Логи ошибок»' },
    { key: 'delTasks',   label: 'Удалять задачи и чистить корзину' },
    { key: 'exportData', label: 'Выгружать данные (бэкап базы, Excel)' }
  ];
  var PERM_ROLES = [
    { key: 'nach', label: 'Начальник участка' },
    { key: 'smaster', label: 'Ст. мастер' },
    { key: 'engineer', label: 'Инженер' },
    { key: 'master', label: 'Мастер' }
  ];
  // Чтение: сначала общие настройки с сервера (раздел settings, запись 'perm'),
  // затем — прежняя локальная настройка (22.09-267), чтобы ничего не потерялось
  function permLoad() {
    var out = {};
    try {
      var lsKey = (window.SP_SYNC_POLL && SP_SYNC_POLL.LS_KEYS && SP_SYNC_POLL.LS_KEYS.settings) || 'smartplan_settings';
      var arr = JSON.parse(localStorage.getItem(lsKey) || '[]');
      if (Array.isArray(arr)) {
        var rec = arr.filter(function (x) { return x && x.id === 'perm'; })[0];
        if (rec && rec.perms && typeof rec.perms === 'object') out = rec.perms;
      }
    } catch (e) {}
    try {
      var legacy = JSON.parse(localStorage.getItem('smartplan_perm_ann') || '{}');
      if (!out.sendAnn && (legacy.sendNach || legacy.sendSmaster)) {
        out.sendAnn = { nach: !!legacy.sendNach, smaster: !!legacy.sendSmaster, engineer: false, master: false };
      }
    } catch (e2) {}
    return out;
  }
  function permCan(action) {
    if (!S.user) return false;
    if (S.role === 'admin') return true;
    try { var p = permLoad(); var a = p && p[action]; return !!(a && a[S.role]); } catch (e) { return false; }
  }
  function permSaveAll(perms) {
    if (S.role !== 'admin') { toast('err', 'Менять права может только администратор'); return; }
    var rec = { id: 'perm', perms: perms, updated_at: Date.now() };
    var done = function (src) {
      try { if (window.SP_SYNC_POLL && SP_SYNC_POLL.applyRemote) SP_SYNC_POLL.applyRemote('settings', [rec]); } catch (e) {}
      logAction('Изменение прав доступа', src || 'сохранено');
      toast('ok', '✓ Права сохранены — действуют на всех устройствах');
      try { applyUser(); } catch (e2) {}   // пересчитать видимость меню
      annPageRefresh();
    };
    if (window.SP_API && SP_API.syncPush) {
      SP_API.syncPush('settings', rec).then(function (r) {
        if (r && r.ok) done();
        else if (r && (r.conflict || r.stale_client)) toast('err', 'Обновите страницу (Ctrl+Shift+R) и повторите');
        else toast('err', 'Не удалось сохранить права: ' + ((r && r.err) || 'нет связи'));
      })['catch'](function () { toast('err', 'Не удалось сохранить — нет связи с сервером'); });
    } else done('локально');
  }

  window.SP_DASHPERM = {
    decorate: dashboardDecorate, apply: dwApply, setup: openDashSetup, moveTo: dwMoveTo,
    saveFromModal: dwSaveFromModal, save: dashSetupSave, reset: dashSetupReset, standardOrder: dwStandardOrder, isCustom: dwIsCustom,
    permLoad: permLoad, permCan: permCan, permMatrix: permRenderMatrix, permSaveMatrix: permSaveMatrix
  };
