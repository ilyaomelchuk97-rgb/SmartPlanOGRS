  /* ── часть 25 · app/25_selftest.js — «Проверить систему» на странице «Параметры»: самопроверка сайта по кнопке (22.09-276) ── */
/* ============================================================
   22.09-276: кнопка «Проверить систему» в «Параметрах».
   Прогоняет набор проверок прямо в браузере и показывает отчёт:
   версия сайта и сервера совпадает, сервер отвечает, данные
   загружены, служебные модули на месте, уведомления работают,
   хранилище браузера доступно, свежесть резервной копии,
   кто на старой версии, нет ли застрявшей очереди отправки.
   ============================================================ */
  function stCard() {
    var view = document.getElementById('view');
    if (!view || !document.getElementById('ann-list')) return;      // только на странице «Параметры»
    if (document.getElementById('selftest-box')) return;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'selftest-box';
    card.style.marginTop = '14px';
    card.innerHTML = '<div class="card-h"><h2>🩺 Проверить систему</h2><span class="sub">Быстрая самопроверка: версия, сервер, данные, уведомления, бэкап</span></div>' +
      '<div class="card-b"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
        '<button class="btn primary" data-action="selftest-run">▶ Запустить проверку</button>' +
        '<span style="font-size:12.5px;color:var(--muted)">Занимает пару секунд, ничего не меняет</span>' +
      '</div><div id="selftest-res"></div></div>';
    view.appendChild(card);
  }
  function stRow(ok, title, detail) {
    var ic = ok === true ? '<span style="color:var(--green);font-weight:800">✓</span>' : (ok === 'warn' ? '<span style="color:var(--yellow);font-weight:800">⚠</span>' : '<span style="color:var(--red);font-weight:800">✗</span>');
    return '<div style="display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed var(--line)">' +
      '<div style="flex:0 0 16px;text-align:center">' + ic + '</div>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--txt)">' + esc(title) + '</div>' +
      (detail ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + esc(detail) + '</div>' : '') + '</div></div>';
  }
  function stRun() {
    var res = document.getElementById('selftest-res');
    if (!res) return;
    res.innerHTML = '<div style="color:var(--muted);font-size:13px">Проверяю…</div>';
    var rows = [], pending = 2, finished = false;   // ждём 2 ответа: версия сайта и состояние системы
    function add(ok, title, detail) { rows.push(stRow(ok, title, detail)); }
    if (!(S.role === 'admin' && SP_API.status)) pending = 1;   // не админ — ждём только версию
    function tick() { if (--pending <= 0) finish(); }
    function finish() {
      if (finished) return;
      finished = true;
      var bad = rows.filter(function (r) { return r.indexOf('color:var(--red)') >= 0; }).length;
      var warn = rows.filter(function (r) { return r.indexOf('color:var(--yellow)') >= 0; }).length;
      var head = bad
        ? '<div style="background:var(--red-l);border:1px solid #fca5a5;border-radius:9px;padding:10px 12px;margin-bottom:10px;font-size:13px;font-weight:700;color:#7f1d1d">Есть проблемы: ' + bad + ' (проверьте пункты ниже)</div>'
        : (warn
          ? '<div style="background:var(--yellow-l);border:1px solid #fde68a;border-radius:9px;padding:10px 12px;margin-bottom:10px;font-size:13px;font-weight:700;color:#78350f">Всё работает, есть замечания: ' + warn + '</div>'
          : '<div style="background:var(--green-l);border:1px solid #bbf7d0;border-radius:9px;padding:10px 12px;margin-bottom:10px;font-size:13px;font-weight:700;color:#166534">Всё в порядке — система работает нормально</div>');
      res.innerHTML = head + rows.join('') + '<div style="font-size:11.5px;color:var(--muted);margin-top:8px">Проверено ' + new Date().toLocaleTimeString('ru-RU') + '</div>';
    }
    // 1) версия сайта и сервера
    fetch('root_index/version.txt?st=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        var srv = String(txt || '').trim();
        add(srv && srv === String(window.SP_BUILD), 'Версия сайта совпадает с сервером',
          'на странице: ' + window.SP_BUILD + ', на сервере: ' + (srv || 'не найдено') + (srv !== String(window.SP_BUILD) ? ' — обновите страницу (Ctrl+Shift+R)' : ''));
      })['catch'](function () { add(false, 'Версия сайта совпадает с сервером', 'не удалось прочитать version.txt'); })
      .then(function () { tick(); });
    // 2) сервер и синхронизация
    var st = {};
    try { st = SP_SYNC_POLL.status(); } catch (e) {}
    add(st.mode === 'connected', 'Сервер отвечает, данные синхронизируются',
      'последний опрос: ' + (st.lastPoll ? Math.round((Date.now() - st.lastPoll) / 1000) + ' с назад' : 'нет данных') + (st.errors ? ' · неудачных попыток: ' + st.errors : ''));
    // 3) уведомления (SSE)
    add(st.live === true || st.live === false, 'Мгновенные уведомления между устройствами',
      st.live ? 'работают (соединение открыто)' : 'соединение восстанавливается — опрос идёт раз в секунду');
    if (st.live !== true) rows[rows.length - 1] = stRow('warn', 'Мгновенные уведомления между устройствами', 'соединение восстанавливается — опрос идёт раз в секунду');
    // 4) данные загружены
    var cnt = { objects: 0, tasks: 0, users: 0, works: 0, graphs: 0 };
    try {
      cnt.objects = (SP_OBJECTS.getObjects() || []).length;
      cnt.tasks = (SP_TASKS.getTasks() || []).filter(function (t) { return t.id !== 't_day_anchor'; }).length;
      cnt.users = (SP_USERS_DB.getUsers() || []).length;
      cnt.works = SP_WORK.getAreas().reduce(function (a, ar) { return a + SP_WORK.getWorks(ar).length; }, 0);
      cnt.graphs = (window.graphsLoad ? graphsLoad() : []).length;
    } catch (e) {}
    var dataOk = cnt.objects > 0 && cnt.users > 0 && cnt.works > 0;
    add(dataOk, 'Данные загружены', 'объектов: ' + cnt.objects + ' · задач: ' + cnt.tasks + ' · видов работ: ' + cnt.works + ' · пользователей: ' + cnt.users + ' · графиков: ' + cnt.graphs);
    // 5) служебные модули
    var need = ['SP_API', 'SP_SYNC_POLL', 'SP_WORK', 'SP_TASKS', 'SP_OBJECTS', 'SP_USERS_DB', 'SP_AREAS', 'SP_PROFS', 'SP_WORKERS'];
    var miss = need.filter(function (k) { return !window[k]; });
    add(miss.length === 0, 'Все служебные модули загружены', miss.length ? 'не загружены: ' + miss.join(', ') + ' — обновите страницу' : 'проверено модулей: ' + need.length);
    // 6) хранилище браузера
    var lsOk = false;
    try { localStorage.setItem('smartplan_st_test', '1'); lsOk = localStorage.getItem('smartplan_st_test') === '1'; localStorage.removeItem('smartplan_st_test'); } catch (e) {}
    add(lsOk, 'Хранилище браузера доступно', lsOk ? 'данные сохраняются' : 'браузер запрещает сохранение — смотрите «🍪 Cookie» внизу меню');
    // 7) очередь отправки (если что-то застряло)
    var ob = 0;
    try { ob = JSON.parse(localStorage.getItem('smartplan_outbox_v1') || '[]').length; } catch (e) {}
    add(ob === 0, 'Нет застрявших отправок', ob === 0 ? 'все изменения отправлены на сервер' : 'в очереди: ' + ob + ' (уйдут при восстановлении связи)');
    if (ob !== 0) rows[rows.length - 1] = stRow('warn', 'Есть очередь отправки', 'в очереди: ' + ob + ' записей — уйдут при восстановлении связи');
    // 8) состояние системы (бэкап, кто на старой версии) — только для админа
    if (S.role === 'admin' && SP_API.status) {
      SP_API.status().then(function (r) {
        if (r && r.ok) {
          var lb = r.last_backup;
          var ageH = lb ? Math.round((Date.now() - lb.ts) / 3600000) : null;
          add(!!lb && ageH <= 26, 'Свежая резервная копия на Google Диске',
            lb ? ('последняя: ' + new Date(lb.ts).toLocaleString('ru-RU') + ' (' + (ageH <= 1 ? 'только что' : ageH + ' ч назад') + ')') : 'копий пока нет — проверьте cron-триггер и скрипт Google');
          if (!lb || ageH > 26) rows[rows.length - 1] = stRow('warn', 'Резервная копия на Google Диске', lb ? ('последняя: ' + new Date(lb.ts).toLocaleString('ru-RU') + ' (' + ageH + ' ч назад)') : 'копий пока нет');
          var outd = r.outdated || [];
          if (outd.length) {
            add('warn', 'Есть сотрудники на старой версии сайта', outd.map(function (x) { return x.name + ' (' + x.build + ')'; }).join(', ') + ' — попросите обновить страницу (F5)');
          }
          tick();
        } else { add('warn', 'Состояние системы', 'сервер не ответил — проверьте позже'); tick(); }
      })['catch'](function () { add('warn', 'Состояние системы', 'нет связи с сервером'); tick(); });
    }
    setTimeout(finish, 7000);   // страховка: отчёт появится в любом случае
  }
  // Доступ из других частей и автотестов
  window.SP_SELFTEST = { card: stCard, run: stRun };
