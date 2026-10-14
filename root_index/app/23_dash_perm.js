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
  function dwLoad() {
    try {
      var a = JSON.parse(localStorage.getItem(DW_KEY) || '[]');
      if (!Array.isArray(a)) a = [];
      var out = [];
      // сначала сохранённый порядок (только известные виджеты), затем новые — в конец
      a.forEach(function (k) { if (typeof k === 'string' && DW_LIST.some(function (w) { return w.key === k; }) && out.indexOf(k) < 0) out.push(k); });
      DW_LIST.forEach(function (w) { if (out.indexOf(w.key) < 0) out.push(w.key); });
      return out;
    } catch (e) { return DW_LIST.map(function (w) { return w.key; }); }
  }
  function dwHidden() {
    try { var h = JSON.parse(localStorage.getItem(DW_KEY + '_hidden') || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; }
  }
  function dwSave(order, hidden) {
    try { localStorage.setItem(DW_KEY, JSON.stringify(order)); localStorage.setItem(DW_KEY + '_hidden', JSON.stringify(hidden)); } catch (e) {}
  }
  // Собрать блоки панели: ключ → узел (учитываем блоки внутри .dash-grid)
  function dwCollect() {
    var view = document.getElementById('view');
    if (!view) return {};
    var map = {};
    Array.prototype.forEach.call(view.children, function (n) {
      if (!(n.className && String(n.className).indexOf('dash-widgets-bar') >= 0)) {
        try {
          if (n.querySelector && n.querySelector('#dash-area')) { map.filter = n; return; }
          if (n.classList && n.classList.contains('kpi-row')) { map.kpi = n; return; }
          if (n.classList && (n.classList.contains('permit-warn') || n.classList.contains('weather-warn'))) { map.warn = n; return; }
          if (n.getAttribute && n.getAttribute('data-action') === 'open-weather') { map.weather = n; if (n.nextElementSibling && n.nextElementSibling.id === 'weather-dropdown') map.weather_dd = n.nextElementSibling; return; }
          if (n.classList && n.classList.contains('dash-grid')) {
            Array.prototype.forEach.call(n.children, function (c) {
              var t = String(c.textContent || '');
              if (t.indexOf('КПД мастеров') >= 0) map.charts = c; else map.today = c;
            });
          }
        } catch (e) {}
      }
    });
    return map;
  }
  function dwApply() {
    try {
      if (S.screen !== 'dashboard') return;
      var map = dwCollect();
      if (!Object.keys(map).length) return;
      var order = dwLoad(), hidden = dwHidden();
      // прячем/показываем
      DW_LIST.forEach(function (w) {
        var n = map[w.key];
        if (n) n.style.display = (hidden.indexOf(w.key) >= 0) ? 'none' : '';
      });
      if (map.weather_dd) map.weather_dd.style.display = (hidden.indexOf('weather') >= 0) ? 'none' : '';
      // порядок верхних блоков
      var view = document.getElementById('view');
      var bar = document.getElementById('dash-widgets-bar');
      order.forEach(function (k) {
        var n = map[k];
        if (!n || !view) return;
        if (n.parentNode === view) view.appendChild(n); // в конец — итоговый порядок задаётся порядком массива
      });
      if (bar && view) view.insertBefore(bar, view.firstChild);
      // порядок внутри .dash-grid (Сегодня / графики)
      var grid = null;
      var g = map.today && map.today.parentNode;
      if (g && g.classList && g.classList.contains('dash-grid')) grid = g;
      if (grid) {
        [map.today, map.charts].forEach(function (n) { if (n && n.parentNode === grid) grid.appendChild(n); });
      }
    } catch (e) {}
  }
  function dwBarEnsure() {
    try {
      if (S.screen !== 'dashboard') return;
      var view = document.getElementById('view');
      if (!view || document.getElementById('dash-widgets-bar')) return;
      var bar = document.createElement('div');
      bar.id = 'dash-widgets-bar';
      bar.className = 'dash-widgets-bar no-print';
      bar.style.cssText = 'display:flex;justify-content:flex-end;margin:-4px 0 10px';
      bar.innerHTML = '<button class="btn sm" data-action="dash-setup" title="Какие блоки показывать на панели и в каком порядке">⚙ Настроить панель</button>';
      view.insertBefore(bar, view.firstChild);
    } catch (e) {}
  }
  function dashboardDecorate() {
    try {
      if (S.screen !== 'dashboard') return;
      dwBarEnsure();
      dwApply();
    } catch (e) {}
  }
  var _dwTmpHidden = null; // состояние галочек в открытом окне (не сбрасывать при перестановке)
  function openDashSetup() {
    var hidden = _dwTmpHidden || dwHidden(), order = dwLoad();
    var rows = order.map(function (k) {
      var w = DW_LIST.filter(function (x) { return x.key === k; })[0] || { key: k, label: k };
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 2px;border-bottom:1px solid var(--line)">' +
        '<label style="display:inline-flex;align-items:center;gap:8px;flex:1;font-size:13.5px"><input type="checkbox" data-dw-on="' + w.key + '"' + (hidden.indexOf(w.key) < 0 ? ' checked' : '') + '> ' + esc(w.label) + '</label>' +
        '<button class="btn sm" data-action="dw-up" data-dw="' + w.key + '" title="Выше">↑</button>' +
        '<button class="btn sm" data-action="dw-down" data-dw="' + w.key + '" title="Ниже">↓</button>' +
        '</div>';
    }).join('');
    var modal = document.getElementById('modal');
    overlay.classList.add('show');
    modal.style.maxWidth = '560px';
    modal.innerHTML = '<div class="modal-h"><h3>⚙ Настройка панели мониторинга</h3><button class="x" data-action="close-modal">×</button></div>' +
      '<div class="modal-b"><div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">Отметьте, какие блоки показывать, и расставьте порядок стрелками. Настройка — для этого браузера.</div>' + rows + '</div>' +
      '<div class="modal-f"><button class="btn" data-action="dash-setup-reset">Вернуть как было</button><button class="btn primary" data-action="dash-setup-save">Сохранить</button></div>';
  }
  function dwMove(key, dir) {
    try {
      var order = dwLoad();
      var i = order.indexOf(key);
      if (i < 0) return;
      if (dir < 0 && i > 0) { order[i] = order[i - 1]; order[i - 1] = key; }
      if (dir > 0 && i < order.length - 1) { order[i] = order[i + 1]; order[i + 1] = key; }
      // 22.09-268: не потерять отмеченные галочки при перестановке
      var cur = [];
      document.querySelectorAll('[data-dw-on]').forEach(function (c) { if (!c.checked) cur.push(c.getAttribute('data-dw-on')); });
      _dwTmpHidden = cur;
      dwSave(order, dwHidden());
      openDashSetup();               // перерисовать список (с учётом отмеченного)
      dwApply();
    } catch (e) {}
  }
  function dashSetupSave() {
    try {
      var hidden = [];
      document.querySelectorAll('[data-dw-on]').forEach(function (c) { if (!c.checked) hidden.push(c.getAttribute('data-dw-on')); });
      dwSave(dwLoad(), hidden);
      _dwTmpHidden = null;
      try { document.getElementById('overlay').classList.remove('show'); } catch (e) {}
      toast('ok', '✓ Панель настроена');
      dwApply();
    } catch (e) {}
  }
  function dashSetupReset() {
    try { localStorage.removeItem(DW_KEY); localStorage.removeItem(DW_KEY + '_hidden'); _dwTmpHidden = null; } catch (e) {}
    try { document.getElementById('overlay').classList.remove('show'); } catch (e) {}
    toast('ok', 'Панель — как было');
    if (typeof renderDashboard === 'function') { renderDashboard(); dashboardDecorate(); }
  }

  // Карточка «Права доступа» — таблица «действие × роль»
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
    decorate: dashboardDecorate, apply: dwApply, setup: openDashSetup, move: dwMove,
    save: dashSetupSave, reset: dashSetupReset,
    permLoad: permLoad, permCan: permCan, permMatrix: permRenderMatrix, permSaveMatrix: permSaveMatrix
  };
