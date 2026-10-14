  /* ── часть 24 · app/24_topbar.js — кнопки шапки: «Настроить панель» и индикатор сервера с мигающим кружком и мини-окошком при наведении (22.09-271) ── */
/* ============================================================
   22.09-271
   · «⚙ Настроить панель» — красивая кнопка с подписью в шапке,
     показывается ТОЛЬКО на панели мониторинга, слева от индикатора сервера.
   · «Сервер: …» — теперь тоже кнопка: внутри мигающий кружок
     (зелёный — в сети, оранжевый — подключение/сбои, красный — нет связи).
   · При наведении на любую из этих кнопок появляется мини-окошко
     с подписью (у настройки) или подробностями (у сервера).
   ============================================================ */
  var _tipEl = null, _tipAnchor = null;

  function spTipEl() {
    if (!_tipEl) _tipEl = document.getElementById('sp-mini-tip');
    return _tipEl;
  }
  function spTipShow(anchor, html) {
    try {
      var tip = spTipEl();
      if (!tip || !anchor) return;
      tip.innerHTML = html;
      tip.style.display = 'block';
      _tipAnchor = anchor;
      var r = anchor.getBoundingClientRect();
      var tr = tip.getBoundingClientRect();
      var left = Math.round(r.right - tr.width);
      left = Math.max(8, Math.min(left, (window.innerWidth || 1200) - tr.width - 8));
      var top = Math.round(r.bottom + 8);
      if (top + tr.height > (window.innerHeight || 800) - 8) top = Math.max(8, Math.round(r.top - tr.height - 8));
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    } catch (e) {}
  }
  function spTipHide() {
    try { var tip = spTipEl(); if (tip) tip.style.display = 'none'; _tipAnchor = null; } catch (e) {}
  }
  function spTipShownFor(el) { return !!(_tipAnchor && el && _tipAnchor === el); }

  // ===== Подпись кнопки «Настроить панель» =====
  function dashSetupTipHtml() {
    return '<div class="mt-h">⚙ Настройка панели</div>' +
      '<div class="mt-r">Какие блоки показывать на панели мониторинга и в каком порядке. Блоки перетаскиваются мышкой за значок ⠿.</div>' +
      '<div class="mt-hint">Настройка — для этого браузера</div>';
  }
  // ===== Подробности о сервере =====
  function spAgo(ts) {
    if (!ts) return '—';
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 2) return 'только что';
    if (s < 60) return s + ' с назад';
    if (s < 3600) return Math.round(s / 60) + ' мин назад';
    return Math.round(s / 3600) + ' ч назад';
  }
  function serverTipHtml() {
    var st = {};
    try { st = (window.SP_SYNC_POLL && SP_SYNC_POLL.status) ? SP_SYNC_POLL.status() : {}; } catch (e) {}
    var mode = st.mode || 'connecting';
    var col = mode === 'connected' ? '#16a34a' : (mode === 'error' || mode === 'offline') ? '#dc2626' : '#f59e0b';
    var label = mode === 'connected' ? 'Сервер: в сети'
      : mode === 'error' ? 'Сервер недоступен'
      : mode === 'offline' ? 'Сервер: не в сети'
      : mode === 'warn' ? 'Проблемы со связью' : 'Подключение к серверу…';
    var online = (st.online || []);
    var names = online.slice(0, 3).map(function (o) { return esc(o.full_name || o.login || ''); }).join(', ');
    var h = '<div class="mt-h"><span class="sp-dot" style="background:' + col + '"></span>' + esc(label) + '</div>';
    h += '<div class="mt-r">Последний опрос: <b>' + esc(spAgo(st.lastPoll)) + '</b></div>';
    h += '<div class="mt-r">Онлайн сейчас: <b>' + online.length + ' чел.</b>' + (names ? ' <span style="color:var(--muted)">(' + names + (online.length > 3 ? '…' : '') + ')</span>' : '') + '</div>';
    if (st.errors > 0) h += '<div class="mt-r" style="color:#b45309">Неудачных попыток подряд: <b>' + st.errors + '</b></div>';
    h += '<div class="mt-r">Сборка сайта: <b>' + esc(String(window.SP_BUILD || '')) + '</b> · обновление ' + (st.live ? 'мгновенное (соединение открыто)' : 'каждую секунду') + '</div>';
    var isAdmin = (S && S.role === 'admin');
    h += '<div class="mt-hint">' + (isAdmin ? 'Нажмите — список пользователей онлайн' : 'Данные синхронизируются с сервером автоматически') + '</div>';
    return h;
  }
  // Обновление открытого мини-окошка (вызывается из синхронизации)
  function spTipRefreshServer() {
    try {
      var ind = document.getElementById('sync-indicator');
      if (ind && spTipShownFor(ind)) spTipShow(ind, serverTipHtml());
    } catch (e) {}
  }
  window.spTipRefreshServer = spTipRefreshServer;

  // ===== Показ кнопки «Настроить панель» только на панели мониторинга =====
  function dashSetupBtnSync() {
    try {
      var b = document.getElementById('dash-setup-btn');
      if (!b) return;
      b.style.display = (S.screen === 'dashboard') ? '' : 'none';
      if (S.screen !== 'dashboard') spTipHide();
    } catch (e) {}
  }
  window.dashSetupBtnSync = dashSetupBtnSync;

  // ===== Наведение на кнопки шапки =====
  function topbarTipsWire() {
    try {
      var setup = document.getElementById('dash-setup-btn');
      var ind = document.getElementById('sync-indicator');
      if (setup) {
        setup.addEventListener('mouseenter', function () { spTipShow(setup, dashSetupTipHtml()); });
        setup.addEventListener('mouseleave', spTipHide);
        setup.addEventListener('focus', function () { spTipShow(setup, dashSetupTipHtml()); });
        setup.addEventListener('blur', spTipHide);
      }
      if (ind) {
        ind.addEventListener('mouseenter', function () { spTipShow(ind, serverTipHtml()); });
        ind.addEventListener('mouseleave', spTipHide);
        ind.addEventListener('focus', function () { spTipShow(ind, serverTipHtml()); });
        ind.addEventListener('blur', spTipHide);
      }
      // при изменении размеров/прокрутке — прятать, чтобы окно не «висело» не там
      window.addEventListener('resize', spTipHide);
      window.addEventListener('scroll', spTipHide, true);
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', topbarTipsWire);
  else topbarTipsWire();

  window.SP_TOPBAR = { setupSync: dashSetupBtnSync, tipShow: spTipShow, tipHide: spTipHide, serverTip: serverTipHtml };
