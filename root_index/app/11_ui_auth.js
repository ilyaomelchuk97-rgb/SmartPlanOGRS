  /* ── часть 11 · app/11_ui_auth.js — окна подтверждения, сообщения, вход в систему, запуск, переключение страниц ── */
  /* =====================================================================
     22.09-244: ОФОРМЛЕННЫЕ ОКНА ПОДТВЕРЖДЕНИЯ — вместо стандартных браузерных «ОК / Отмена».
     spConfirm(текст, { title, ok, cancel, danger }, приДа, приНет)
     spChoice(текст, { title, icon, choices: [{ label, value, cls }], cancel }, приВыборе(value), приОтмене)
     Окно — поверх всех окон; Enter — основная кнопка, Esc или щелчок мимо окна — «Отмена».
     ===================================================================== */
  function spConfirm(message, opts, onYes, onNo) {
    opts = opts || {};
    return spDialog(message, {
      title: opts.title || 'Подтверждение',
      icon: opts.icon || (opts.danger ? '⚠️' : '❓'),
      choices: [{ label: opts.ok || 'Да', value: true, cls: opts.danger ? 'danger' : 'primary' }],
      cancel: opts.cancel || 'Отмена',
      danger: !!opts.danger
    }, function () { return onYes ? onYes() : undefined; }, onNo);
  }
  function spChoice(message, opts, onPick, onNo) { return spDialog(message, opts || {}, onPick, onNo); }
  function spDialog(message, o, onPick, onNo) {
    var choices = (o.choices && o.choices.length) ? o.choices : [{ label: 'Да', value: true, cls: 'primary' }];
    // только для автотестов: ответ без окна (true — основная кнопка, false — «Отмена»)
    if (window.__spConfirmAuto === true) return onPick ? onPick(choices[0].value) : undefined;
    if (window.__spConfirmAuto === false) return onNo ? onNo() : undefined;
    var prev = document.getElementById('sp-dlg');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var ov = document.createElement('div');
    ov.id = 'sp-dlg';
    ov.className = 'sp-dlg';
    ov.innerHTML = '<div class="sp-dlg-box' + (o.danger ? ' danger' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="sp-dlg-h"><span class="sp-dlg-ic">' + esc(o.icon || '❓') + '</span><span>' + esc(o.title || 'Подтверждение') + '</span></div>' +
      '<div class="sp-dlg-b">' + esc(String(message == null ? '' : message)).replace(/\n/g, '<br>') + '</div>' +
      '<div class="sp-dlg-f">' +
      (o.cancel === false ? '' : '<button type="button" class="btn" data-dlg="cancel">' + esc(o.cancel || 'Отмена') + '</button>') +
      choices.map(function (c, i) { return '<button type="button" class="btn ' + esc(c.cls || 'primary') + '" data-dlg="' + i + '">' + esc(c.label) + '</button>'; }).join('') +
      '</div></div>';
    document.body.appendChild(ov);
    var done = false;
    function close() { done = true; document.removeEventListener('keydown', onKey, true); if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function pick(i) { if (done) return; close(); if (onPick) onPick(choices[i].value); }
    function cancel() { if (done) return; close(); if (onNo) onNo(); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
      else if (e.key === 'Enter') {
        var ae = document.activeElement;
        if (ae && ov.contains(ae) && ae.getAttribute('data-dlg') != null) return; // Enter на кнопке — сработает она сама
        e.preventDefault(); e.stopPropagation(); pick(0);
      }
    }
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-dlg]') : null;
      if (b) { e.stopPropagation(); var v = b.getAttribute('data-dlg'); if (v === 'cancel') cancel(); else pick(+v); return; }
      if (e.target === ov) cancel(); // щелчок мимо окна — «Отмена»
    });
    setTimeout(function () { var f = ov.querySelector('[data-dlg="0"]'); if (f && f.focus) f.focus(); }, 30);
  }

  function toast(type, msg) {
    var box = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = msg;
    box.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(function () { el.remove(); }, 300); }, 4200);
  }
  window.SP_toast = toast; // доступно для db.js (предупреждения о конфликтах синхронизации)

  /* ---------- РОЛИ ---------- */
  function roleLabel() { return (ROLE_INFO[S.role] || { label: S.role }).label; }
  function roleChip(role) { var i = ROLE_INFO[role] || { label: role, cls: '' }; return '<span class="chip ' + i.cls + '">' + i.label + '</span>'; }

  function applyUser() {
    var u = S.user; if (!u) return;
    snapshotAuto(); // автоснимок базы при входе (страховка от сбросов)
    // Real-time синхронизация запускается отдельно через SP_SYNC_POLL.init()
    var info = ROLE_INFO[u.role] || { label: u.role };
    var _avEl = document.getElementById('av'); // 22.09-219: фото-аватар в шапке, если загружен
    if (u.avatar) { _avEl.textContent = ''; _avEl.style.backgroundImage = 'url(' + u.avatar + ')'; _avEl.style.backgroundSize = 'cover'; _avEl.style.backgroundPosition = 'center'; }
    else { _avEl.style.backgroundImage = ''; _avEl.textContent = initials(u.full_name); }
    document.getElementById('un').textContent = u.full_name;
    document.getElementById('ur').textContent = (u.prof || info.label) + (u.role === 'admin' || !u.area ? '' : ' · ' + u.area); // 22.09-94: без «· undefined»
    // 22.09-106: сенсорное устройство — показываем стрелочку ▾ для меню пользователя (выход)
    try { if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) document.body.classList.add('usr-touch'); } catch (e) {}
    // Сегодняшняя дата в topbar
    var dateEl = document.getElementById('topbar-date');
    if (dateEl) dateEl.textContent = 'Сегодня ' + fmt(TODAY);
    var isAdmin = S.role === 'admin';
    // Раздел «Администрирование» и все его страницы — только админу
    var adminGroup = document.querySelectorAll('#nav .grp');
    adminGroup.forEach(function(g) {
      if (g.textContent.indexOf('Администрирование') !== -1) {
        g.style.display = isAdmin ? '' : 'none';
        var next = g.nextElementSibling;
        while (next && next.tagName === 'A') {
          next.style.display = isAdmin ? '' : 'none';
          next = next.nextElementSibling;
        }
      }
    });
    // Слесарь: в меню — только Карта маршрутов, Карта местоположения, Карта объектов
    document.querySelectorAll('#nav a[data-screen]').forEach(function (a) {
      if (S.role === 'slesar') {
        if (SLESAR_SCREENS[a.dataset.screen]) { a.classList.remove('slesar-hide'); a.style.display = ''; }
        else { a.classList.add('slesar-hide'); a.style.display = 'none'; }
      } else if (a.classList.contains('slesar-hide')) {
        a.classList.remove('slesar-hide'); a.style.display = ''; // вернули меню после слесаря
      }
    });
    // Обёртка «Планирование» с подменю «Графики»: слесарю скрыта целиком
    document.querySelectorAll('#nav .nav-acc').forEach(function (w) {
      var mainLink = w.querySelector('a[data-screen="calendar"]');
      w.style.display = (S.role === 'slesar' && mainLink && mainLink.classList.contains('slesar-hide')) ? 'none' : '';
    });
    // «Работники»: админ, нач. участка, ст. мастер (управление), мастер (своя бригада),
    // СЭОГС — начальник и заместитель (просмотр всех бригад). Слесарю скрыто.
    var wkNav = document.querySelector('#nav a[data-screen="workers"]');
    if (wkNav) wkNav.style.display = (S.role === 'slesar') ? 'none' : '';
    var schNav = document.querySelector('#nav a[data-screen="schedules"]');
    if (schNav) schNav.style.display = (S.role === 'slesar') ? 'none' : '';
    var ob = document.querySelector('button[data-action="optimize"]');
    if (ob) ob.style.display = (canPlan() ? 'inline-flex' : 'none');
    // Индикатор синхронизации управляется модулем sync_polling.js (22.09-25)
  }

  // Индикатор статуса синхронизации — управляется модулем sync_polling.js
  // (старая логика DB.isServerOnline удалена в 22.09-25 — сервер сменился на Render)

  /* ---------- ВХОД / СЕССИЯ ---------- */
  function onLoginSubmit(e) {
    e.preventDefault();
    if (!consentOk()) { openConsentDialog(); return; } // 22.09-247: без разрешения на cookie вход невозможен
    var login = document.getElementById('li-login').value.trim();
    var pass = document.getElementById('li-pass').value.trim();
    var err = document.getElementById('li-err');
    var btn = document.getElementById('li-btn');
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Вход…';
    // Сборка 22.09-25: вход через сервер Render (SP_API.login).
    // Если сервер недоступен — fallback на локальную DB.authenticate().
    function tryLocal() {
      DB.authenticate(login, pass).then(function (u) {
        btn.disabled = false; btn.textContent = 'Войти';
        if (u) { DB.setSession(u.id); enterApp(u); }
        else { err.textContent = 'Неверный логин или пароль'; }
      }).catch(function (error) {
        btn.disabled = false; btn.textContent = 'Войти';
        console.error('Auth error:', error);
        err.textContent = 'Ошибка входа — проверьте логин и пароль'; // 22.09-241: без подсказки чужого пароля
      });
    }
    if (window.SP_API && typeof window.SP_API.login === 'function') {
      window.SP_API.login(login, pass).then(function (r) {
        btn.disabled = false; btn.textContent = 'Войти';
        if (r && r.ok && r.user) {
          DB.setSession(r.user.id);
          // Подтянуть с сервера все разделы в localStorage
          if (typeof window.SP_SYNC_POLL !== 'undefined') {
            // Принудительный sync сейчас (lastTs=0 → загрузится всё)
            try { window.SP_SYNC_POLL.stop(); window.SP_SYNC_POLL.init(); } catch (e) {}
          }
          enterApp(r.user);
        } else {
          err.textContent = (r && r.err) || 'Неверный логин или пароль';
        }
      })['catch'](function () {
        // Сеть упала — пробуем локальную БД
        tryLocal();
      });
    } else {
      tryLocal();
    }
  }
  /* 22.09-189: САМОЛЕЧЕНИЕ ДАННЫХ — задачи с ошибочной датой далеко в будущем.
     Появлялись из-за якоря серии с опечаткой в годе («20039-08-01» вместо
     «2026-08-01»): генератор графика, не проверяя год, наставил сотни задач на
     десятки тысячи лет вперёд — реальные работы мастера тонули в мусоре.
     Годовые графики дальше ~3 лет не планируют никогда, поэтому всё за этим
     горизонтом — гарантированный мусор: убираем автоматически при входе. */
  function purgeFarFutureTasks() {
    if (!TASKS_DB) return 0;
    var arr = [];
    try { arr = TASKS_DB.getTasks() || []; } catch (e) { return 0; }
    var maxOff = 1100; // ~3 года — с запасом за пределами любого годового графика
    var maxYear = TODAY.getFullYear() + 3;
    var badIds = [], keep = [];
    arr.forEach(function (t) {
      var bad = false;
      if (t && !isDone(t)) {
        if (typeof t.d === 'number' && isFinite(t.d) && t.d > maxOff) bad = true;
        else { var md = /^(\d{4,})-/.exec(String(t.dl_date || '')); if (md && +md[1] > maxYear) bad = true; }
      }
      if (bad) badIds.push(t.id); else keep.push(t);
    });
    if (!badIds.length) return 0;
    // ОДНО пересохранение всей базы (не сотни одиночных — каждое из них
    // толкнуло бы на сервер всю базу по записи за раз)
    try { TASKS_DB.reloadFromCloud({ schema: 3, tasks: keep }); } catch (e) {}
    // на сервере — мягкое удаление мусорных записей фоном, небольшими порциями
    badIds.forEach(function (id, i) {
      setTimeout(function () {
        try { if (window.SP_API && SP_API.getToken && SP_API.getToken()) SP_API.del('tasks', id).catch(function () {}); } catch (e) {}
      }, 120 * (i % 25));
    });
    try { S.tasks = TASKS_DB.getTasks(); } catch (e) {}
    try { if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'repair', 'auto-purge: удалено задач с ошибочной датой (дальше 3 лет вперёд): ' + badIds.length, {}); } catch (e) {}
    return badIds.length;
  }

  function enterApp(u) {
    S.user = u; S.role = u.role; S.curMaster = u.id;
    S.dashArea = null; // фильтр участка не должен «протекать» между пользователями
    S.dashMaster = null; // 22.09-193: и выбор мастера в «КПД мастеров» — тоже
    // 22.09-189: автоочистка «битых» задач (дата дальше 3 лет — след опечатки в якоре серии графика)
    var _purged = 0;
    try { _purged = purgeFarFutureTasks(); } catch (ePu) { try { console.error('purgeFarFutureTasks:', ePu); } catch (_e) {} }
    if (_purged) setTimeout(function () { toast('warn', '🧹 Автоочистка базы: удалено «битых» задач с ошибочной датой далеко в будущем: ' + _purged + '. Они остались от опечатки в дате графика — теперь такие даты блокируются автоматически.'); }, 1800);
    // 22.09-224: привязка дат задач к календарю (новый день — одно перебазирование)
    try { rebaseTaskDaysToToday(); } catch (eRb) { try { console.error('rebaseTaskDaysToToday:', eRb); } catch (_e) {} }
    document.body.classList.add('logged-in');
    var bs = document.getElementById('base-select'); if (bs) bs.value = S.baseId;
    applyUser();
    setScreen(S.role === 'slesar' ? 'map' : 'dashboard');
    // Дропдаун онлайн-пользователей (после входа — знаем роль и ID юзера)
    try { setupSyncDropdown(); } catch (e) { console.error('setupSyncDropdown:', e); }
    // 22.09-136: миграция видов телеметрии (идемпотентная): сразу после входа
    // и повторно через 3 с — когда завершится первая фоновая синхронизация
    try { telemetryMigrateTypes(); } catch (e) { console.error('telemetryMigrateTypes:', e); }
    setTimeout(function () { try { telemetryMigrateTypes(); } catch (e) { console.error('telemetryMigrateTypes:', e); } }, 3000);
    setTimeout(function () {
      var info = ROLE_INFO[u.role] || { label: u.role };
      logAction('Вход в систему', '');
      toast('ok', 'Добро пожаловать, ' + u.full_name + '! Роль: ' + info.label + (u.role === 'admin' ? ' — доступ ко всем участкам.' : ' · участок ' + u.area + '.'));
      // Хранилище браузера заблокировано (Edge/file://, «Блокировать все cookie»):
      // работает замена в памяти — данные живут только до перезагрузки страницы
      if (window.SP_STORAGE_FALLBACK) {
        toast('warn', '⚠ Хранилище браузера недоступно (Edge/настройки cookie) — все данные сохранятся только до перезагрузки страницы. Для сохранения между сессиями разрешите файлы cookie или используйте Chrome.');
      }
    }, 400);
  }
  function showLoginScreen() {
    document.body.classList.remove('logged-in');
    var _udd = document.getElementById('usr-dd'); if (_udd) _udd.classList.remove('show'); // 22.09-106
    var f = document.getElementById('login-form'); if (f) f.reset();
    var err = document.getElementById('li-err'); if (err) err.textContent = '';
  }
  /* =====================================================================
     22.09-247: РАЗРЕШЕНИЕ НА COOKIE. При первом открытии сайт спрашивает разрешение
     на cookie и хранилище браузера (без них не работают вход и данные). Выбор хранится
     в этом браузере (localStorage + cookie sp_consent, на год); изменить — ссылка
     «🍪 Cookie» на экране входа и внизу меню. Отказ: вход закрыт (если уже вошли — выход).
     ===================================================================== */
  var CONSENT_KEY = 'smartplan_cookie_consent';
  function consentGet() {
    try { var o = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); if (o && (o.choice === 'accept' || o.choice === 'decline')) return o.choice; } catch (e) {}
    try { var mm = String(document.cookie || '').match(/(?:^|;\s*)sp_consent=(accept|decline)/); if (mm) return mm[1]; } catch (e2) {}
    return '';
  }
  function consentOk() { return consentGet() === 'accept'; }
  function consentSet(choice) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: choice, ts: Date.now(), v: 1 })); } catch (e) {}
    try { document.cookie = 'sp_consent=' + choice + '; max-age=31536000; path=/; SameSite=Lax'; } catch (e2) {}
  }
  function isLoggedIn() { try { return document.body.classList.contains('logged-in') === true; } catch (e) { return false; } }
  /* общий выход из системы — кнопка «Выйти» и отказ от cookie */
  function doLogout() {
    try { if (window.SP_SYNC_POLL && SP_SYNC_POLL.stop) SP_SYNC_POLL.stop(); } catch (e) {}
    try { if (window.SP_API && SP_API.logout) SP_API.logout(); } catch (e) {}
    DB.clearSession();
    showLoginScreen();
  }
  /* экран входа: без разрешения — кнопка «Войти» недоступна, над формой — пояснение и «Разрешить» */
  function consentApplyLoginState() {
    var ok = consentOk();
    var btn = document.getElementById('li-btn');
    if (btn) { btn.disabled = !ok; btn.title = ok ? '' : 'Вход возможен после разрешения на cookie'; }
    var box = document.getElementById('li-consent');
    if (ok) { if (box && box.parentNode) box.parentNode.removeChild(box); return; }
    if (!box) {
      var form = document.getElementById('login-form');
      if (!form || !form.parentNode) return;
      box = document.createElement('div');
      box.id = 'li-consent';
      box.className = 'li-consent';
      form.parentNode.insertBefore(box, form);
    }
    box.innerHTML = '<span>🍪 ' + (consentGet() === 'decline'
      ? 'Вы отказались от cookie. Без них вход невозможен — данные входа и рабочие данные хранятся в браузере.'
      : 'Чтобы войти, разрешите использование cookie.') + '</span>' +
      '<button type="button" class="btn sm primary" id="li-consent-ok">Разрешить</button>';
    var b2 = document.getElementById('li-consent-ok');
    if (b2) b2.onclick = function () { consentSet('accept'); consentApplyLoginState(); toast('ok', '🍪 Cookie разрешены — можно входить'); };
  }
  /* окно разрешения: закрывается только выбором (щелчок мимо и Esc не закрывают) */
  function openConsentDialog() {
    var prev = document.getElementById('sp-consent');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var ov = document.createElement('div');
    ov.id = 'sp-consent';
    ov.className = 'sp-consent';
    var cur = consentGet();
    ov.innerHTML = '<div class="sp-consent-box" role="dialog" aria-modal="true" aria-labelledby="sp-consent-t">' +
      '<div class="sp-consent-h"><span class="sp-consent-ic">🍪</span><span id="sp-consent-t">Разрешение на использование cookie</span></div>' +
      '<div class="sp-consent-b">' +
      '<p>Сайт SmartPlan использует <b>cookie и хранилище браузера</b>, чтобы вы могли войти в систему и работать: в браузере хранятся данные входа, ваши настройки и рабочие данные (в том числе для работы без связи с сервером). Подключаемые карты (Яндекс.Карты, OpenStreetMap и др.) могут устанавливать свои cookie.</p>' +
      '<p>Без разрешения вход в систему невозможен. Выбор сохраняется в этом браузере; изменить его можно в любой момент — ссылка «🍪 Cookie» на экране входа и внизу меню.</p>' +
      (cur ? '<p class="sp-consent-cur">Сейчас: ' + (cur === 'accept' ? '✅ разрешено' : '⛔ отказано') + '</p>' : '') +
      '</div>' +
      '<div class="sp-consent-f">' +
      '<button type="button" class="btn" data-consent="decline">Отказаться</button>' +
      '<button type="button" class="btn primary" data-consent="accept">✅ Разрешить</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-consent]') : null;
      if (!b) return; // щелчок мимо окна — нужен выбор
      e.stopPropagation();
      var ch = b.getAttribute('data-consent');
      consentSet(ch);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (ch === 'decline' && isLoggedIn()) {
        doLogout();
        toast('warn', '🍪 Вы отказались от cookie — без них работа на сайте невозможна, выполнен выход. Разрешить можно на экране входа.');
      }
      consentApplyLoginState();
      if (ch === 'accept') toast('ok', '🍪 Спасибо! Cookie разрешены.');
    });
    setTimeout(function () { var f = ov.querySelector('[data-consent="accept"]'); if (f && f.focus) f.focus(); }, 30);
  }
  /* при запуске: решение ещё не принято — спросить; был отказ — вход закрыт (если вход был — выход) */
  function consentOnStart() {
    var c = consentGet();
    if (c === 'decline' && isLoggedIn()) doLogout();
    consentApplyLoginState();
    if (!c) openConsentDialog();
  }

  // 22.09-101: polling потерял токен (истёк/сброшен сервером) — не «висим» без
  // синхронизации, а просим войти заново; после входа токен новый, всё подтянется.
  window.SP_FORCE_RELOGIN = function () {
    if (!S.user) return;
    try { if (window.SP_SYNC_POLL && SP_SYNC_POLL.stop) SP_SYNC_POLL.stop(); } catch (e) {}
    try { DB.clearSession(); } catch (e) {}
    try { if (window.SP_API && SP_API.setToken) SP_API.setToken(null); } catch (e) {}
    showLoginScreen();
    toast('warn', '🔌 Связь с сервером потеряна (сессия устарела). Войдите ещё раз — данные подтянутся автоматически.');
  };

  /* ---------- НАВИГАЦИЯ ---------- */
  function setScreen(name) {
    // «Тест проезда» — полигон только для администратора
    if (name === 'testmap' && S.role !== 'admin') { toast('err', 'Страница «Тест проезда» — только для администратора'); return; }
    if (name === 'wxtest' && S.role !== 'admin') { toast('err', 'Страница «Тест погодный» — только для администратора'); return; }
    if (name === 'testdep' && S.role !== 'admin') { toast('err', 'Страница «Тест зависимости» — только для администратора'); return; }
    // Защита: страницы администрирования — только админу
    if ((name === 'users' || name === 'logs' || name === 'changelog') && S.role !== 'admin') {
      toast('err', 'Доступ только для администратора');
      return;
    }
    // «Работники»: слесарю недоступна (остальные роли — со своими правами)
    if (name === 'workers' && S.role === 'slesar') {
      toast('err', 'Вкладка «Работники» недоступна');
      return;
    }
    // «Графики смен»: слесарю недоступна (управление графиками — для руководства)
    if (name === 'schedules' && S.role === 'slesar') {
      toast('err', 'Вкладка «Графики смен» недоступна');
      return;
    }
    // Слесарь: только карты (маршрутов / местоположения / объектов)
    if (S.role === 'slesar' && !SLESAR_SCREENS[name]) {
      toast('err', 'Слесарю доступны только карты: маршрутов, местоположения и объектов');
      name = 'map';
    }
    // Окошко погоды в карте (модалка) и на странице теста — закрывается при уходе
    try { wxtPopHide(); } catch (e) {}
    try { closeHourlyWeather(); } catch (e) {}
    S.screen = name;
    if (name === 'refs') S.refsOpen = {}; // 22.09-96: вход в «Справочники» — группы работ свёрнуты
    document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.screen === name); });
    // Подменю «Графики»: держать раскрытым, пока активна его страница
    document.querySelectorAll('#nav .nav-acc').forEach(function (w) {
      var sub = w.querySelector('.nav-sub a[data-screen]');
      w.classList.toggle('open', !!(sub && sub.dataset.screen === name));
    });
    document.getElementById('screen-title').textContent = (TITLES[name] || '');
    // 22.09-219: в шапке — только номер текущей сборки; описания изменений больше НЕ
    // пишутся в шапку — они в Администрировании → «Журнал изменений» (SP_CHANGELOG, data.js).
    var _crEl = document.getElementById('screen-crumb');
    _crEl.textContent = 'Сборка ' + SP_BUILD;
    _crEl.title = 'История изменений системы: Администрирование → Журнал изменений';
    document.getElementById('sidebar').classList.remove('open');
    refresh();
  }
