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
      '<div class="sp-dlg-b">' + (o.html != null ? String(o.html) : esc(String(message == null ? '' : message)).replace(/\n/g, '<br>')) + '</div>' + // 22.09-252: o.html — готовая разметка
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
        // 22.09-268: роли с правом viewLogs видят журналы (даже не будучи админом)
        if (!isAdmin && typeof permCan === 'function' && permCan('viewLogs')) {
          g.style.display = '';
          ['logs', 'errlogs'].forEach(function (sc) {
            var a = document.querySelector('#nav a[data-screen="' + sc + '"]');
            if (a) a.style.display = '';
          });
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

  /* 22.09-254: выполнить fn, когда сайт получил актуальные данные с сервера (первая синхронизация
     после входа/открытия). Без связи с сервером (локальный режим) — сразу; если синхронизация
     так и не пришла (~30 с) — в этот раз не выполнять (автоматические правки по устаревшей копии
     данных недопустимы: они затирали свежие данные на сервере). */
  function whenSyncReady(fn, tries) {
    tries = tries || 0;
    var ready = false, online = false;
    try { ready = !!(window.SP_SYNC_POLL && SP_SYNC_POLL.isReady && SP_SYNC_POLL.isReady()); } catch (e) {}
    try { online = !!(window.SP_API && SP_API.getToken && SP_API.getToken()); } catch (e) {}
    if (ready || !online) { fn(); return; }
    if (tries >= 100) return;
    setTimeout(function () { whenSyncReady(fn, tries + 1); }, 300);
  }
  function enterApp(u) {
    S.user = u; S.role = u.role; S.curMaster = u.id;
    S.dashArea = null; // фильтр участка не должен «протекать» между пользователями
    S.dashMaster = null; // 22.09-193: и выбор мастера в «КПД мастеров» — тоже
    // 22.09-189: автоочистка «битых» задач (дата дальше 3 лет — след опечатки в якоре серии графика)
    // 22.09-254: автоочистка — только по актуальным данным с сервера (не по устаревшей копии браузера)
    whenSyncReady(function () {
      var _purged = 0;
      try { _purged = purgeFarFutureTasks(); } catch (ePu) { try { console.error('purgeFarFutureTasks:', ePu); } catch (_e) {} }
      if (_purged) setTimeout(function () { toast('warn', '🧹 Автоочистка базы: удалено «битых» задач с ошибочной датой далеко в будущем: ' + _purged + '. Они остались от опечатки в дате графика — теперь такие даты блокируются автоматически.'); }, 1800);
      if (_purged) { try { refresh(); } catch (eRf) {} }
    });
    // 22.09-224: привязка дат задач к календарю (новый день — одно перебазирование).
    // 22.09-257: при живой связи с сервером — только после получения данных (rebaseAllowed),
    // иначе локальный якорь затёр бы серверный ДО синхронизации
    try { if (rebaseAllowed()) rebaseTaskDaysToToday(); } catch (eRb) { try { console.error('rebaseTaskDaysToToday:', eRb); } catch (_e) {} }
    document.body.classList.add('logged-in');
    var bs = document.getElementById('base-select'); if (bs) bs.value = S.baseId;
    applyUser();
    setScreen(S.role === 'slesar' ? 'myday' : 'dashboard'); // 22.09-266: слесарь сразу видит свои задания
    // Дропдаун онлайн-пользователей (после входа — знаем роль и ID юзера)
    try { setupSyncDropdown(); } catch (e) { console.error('setupSyncDropdown:', e); }
    // 22.09-136: миграция видов телеметрии (идемпотентная): сразу после входа
    // и повторно через 3 с — когда завершится первая фоновая синхронизация
    // 22.09-254: только после получения актуальных данных с сервера — раньше по устаревшему
    // списку браузера при КАЖДОМ входе создавались «недостающие» виды телеметрии с новыми id,
    // а прежние удалялись как дубли
    whenSyncReady(function () { try { telemetryMigrateTypes(); } catch (e) { console.error('telemetryMigrateTypes:', e); } });
    // 22.09-264: объявления администратора — после получения данных с сервера показать новые
    whenSyncReady(function () { setTimeout(function () { try { if (window.SP_ANN && SP_ANN.start) SP_ANN.start(); } catch (eAn) {} }, 1200); });
    // 22.09-255: в браузере сохранилась копия видов работ, отличающаяся от сервера — предложить вернуть настройки
    if (u.role === 'admin') whenSyncReady(function () { setTimeout(function () { try { workRecoveryNotify(); } catch (e) {} }, 1500); });
    setTimeout(function () {
      var info = ROLE_INFO[u.role] || { label: u.role };
      logAction('Вход в систему', '');
      toast('ok', 'Добро пожаловать, ' + u.full_name + '! Роль: ' + info.label + (u.role === 'admin' ? ' — доступ ко всем участкам.' : ' · участок ' + u.area + '.'));
      // Хранилище браузера заблокировано (Edge/file://, «Блокировать все cookie»):
      // работает замена в памяти — данные живут только до перезагрузки страницы
      if (storageNotSaved()) { // 22.09-252: точная причина и где снять запрет
        toast('warn', '⚠ Браузер запрещает сайту сохранять данные — после закрытия вкладки придётся снова войти. Как снять запрет — ссылка «🍪 Cookie» внизу меню.');
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
     22.09-252: ХРАНИЛИЩЕ БРАУЗЕРА ЗАПРЕЩЕНО / ПЕРЕПОЛНЕНО. Проверку делает первый
     скрипт index.html → window.SP_STORAGE_DIAG: ls/ss.state — 'ok' | 'freed'
     (было переполнено, место освобождено) | 'blocked' (браузер запрещает) |
     'full' (переполнено, освободить не удалось); cookies — пишутся ли cookie;
     frame — сайт внутри чужой страницы. Кнопка «Разрешить» в окне cookie запрет
     браузера снять не может — поэтому экран входа и окно cookie объясняют, где
     его снимают (пошаговая инструкция под браузер), а причина уходит в «Логи ошибок».
     ===================================================================== */
  function storageDiag() { try { return window.SP_STORAGE_DIAG || null; } catch (e) { return null; } }
  function storageNotSaved() { var d = storageDiag(); return !!(d && d.ls && (d.ls.state === 'blocked' || d.ls.state === 'full')); }
  function storageBrowser() {
    var ua = ''; try { ua = String(navigator.userAgent || ''); } catch (e) {}
    if (/Edg\//.test(ua)) return { key: 'edge', name: 'Microsoft Edge', inName: 'в Microsoft Edge' };
    if (/YaBrowser/.test(ua)) return { key: 'yandex', name: 'Яндекс.Браузер', inName: 'в Яндекс.Браузере' };
    if (/OPR\//.test(ua)) return { key: 'opera', name: 'Opera', inName: 'в Opera' };
    if (/Firefox\//.test(ua)) return { key: 'firefox', name: 'Firefox', inName: 'в Firefox' };
    if (/Chrome\//.test(ua)) return { key: 'chrome', name: 'Google Chrome', inName: 'в Google Chrome' };
    return { key: 'other', name: 'браузер', inName: 'в браузере' };
  }
  function spCopyText(t, cb) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand && document.execCommand('copy');
        ta.parentNode.removeChild(ta);
        cb(ok === true);
      } catch (e) { cb(false); }
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(function () { cb(true); }, fallback); return; } } catch (e) {}
    fallback();
  }
  function storageHelpHtml() {
    var d = storageDiag() || {};
    var b = storageBrowser();
    var site = ''; try { site = String(location.origin || ''); } catch (e) {}
    if (!/^https?:\/\//.test(site)) site = 'https://smartplanogrs1.onrender.com';
    var host = site.replace(/^https?:\/\//, '');
    function code(t) { return '<span class="sh-code">' + esc(t) + '</span><button type="button" class="sh-copy" data-copy="' + esc(t) + '">📋 Копировать</button>'; }
    var full = !!(d.ls && d.ls.state === 'full');
    var h = '';
    if (d.proto === 'file:') h += '<div class="sh-note">📁 Сайт открыт как файл с диска — так браузер не даёт сохранять данные. Откройте сайт по адресу <b>https://smartplanogrs1.onrender.com</b>.</div>';
    if (d.frame) h += '<div class="sh-note">🪟 Сайт открыт внутри другой страницы — в таком режиме браузер часто запрещает сохранять данные. Откройте сайт напрямую, в отдельной вкладке: <a href="' + esc(site) + '" target="_blank" rel="noopener">' + esc(site) + '</a>.</div>';
    if (full) {
      h += '<p>Хранилище браузера для этого сайта <b>переполнено</b>, и освободить место автоматически не удалось. Удалите сохранённые данные сайта — рабочие данные хранятся на сервере и загрузятся заново после входа:</p>' +
        '<ol class="sh-ol"><li>Нажмите значок слева от адреса сайта (🔒) → «Файлы cookie и данные сайта» → «Управление…».</li>' +
        '<li>Удалите данные сайта <b>' + esc(host) + '</b>.</li>' +
        '<li>Обновите страницу (<b>Ctrl+Shift+R</b>) и войдите снова.</li></ol>';
    } else {
      h += '<p>Сейчас браузер <b>запрещает этому сайту сохранять данные</b> (файлы cookie и хранилище). Кнопка «Разрешить» в окне сайта этот запрет снять не может — он задаётся в настройках браузера. ' +
        'Пока запрет действует, после закрытия вкладки придётся снова входить и разрешать cookie.</p>';
      if (b.key === 'edge') {
        h += '<div class="sh-h">Способ 1 — быстрый</div><ol class="sh-ol">' +
          '<li>В адресной строке справа нажмите значок файлов cookie с крестиком («Файлы cookie заблокированы»).</li>' +
          '<li>Выберите «Разрешить сайту сохранять файлы cookie» и нажмите «Готово».</li>' +
          '<li>Обновите страницу: <b>Ctrl+Shift+R</b>.</li></ol>' +
          '<div class="sh-h">Способ 2 — через настройки Edge</div><ol class="sh-ol">' +
          '<li>Скопируйте адрес ' + code('edge://settings/content/cookies') + ', вставьте его в адресную строку Edge и нажмите Enter.</li>' +
          '<li>Включите переключатель «Разрешить сайтам сохранять и читать данные файлов cookie (рекомендуется)».</li>' +
          '<li>Если ниже, в списке «Блокировать», есть <b>' + esc(host) + '</b> или <b>onrender.com</b> — удалите их (⋯ → «Удалить»).</li>' +
          '<li>В списке «Разрешить» нажмите «Добавить», вставьте адрес сайта ' + code(site) + ' и нажмите «Добавить».</li>' +
          '<li>Вернитесь на сайт и нажмите <b>Ctrl+Shift+R</b>.</li></ol>';
      } else if (b.key === 'chrome') {
        h += '<ol class="sh-ol">' +
          '<li>Скопируйте адрес ' + code('chrome://settings/content/siteData') + ', вставьте его в адресную строку Chrome и нажмите Enter (это «Настройки сайтов» → «Данные сайтов, сохраненные на устройстве»).</li>' +
          '<li>Выберите «Разрешить сайтам сохранять данные на устройстве» — или ниже, в списке разрешённых сайтов, нажмите «Добавить» и вставьте адрес ' + code(site) + '.</li>' +
          '<li>Вернитесь на сайт и нажмите <b>Ctrl+Shift+R</b>.</li></ol>';
      } else if (b.key === 'yandex') {
        h += '<ol class="sh-ol">' +
          '<li>Скопируйте адрес ' + code('browser://settings/content') + ', вставьте его в адресную строку и нажмите Enter.</li>' +
          '<li>В блоке «Cookie-файлы» выберите «Разрешены» (или добавьте сайт ' + code(site) + ' в исключения как разрешённый).</li>' +
          '<li>Вернитесь на сайт и нажмите <b>Ctrl+Shift+R</b>.</li></ol>';
      } else if (b.key === 'firefox') {
        h += '<ol class="sh-ol">' +
          '<li>Откройте «Настройки» → «Приватность и защита» → «Куки и данные сайтов» → «Управление исключениями…».</li>' +
          '<li>Вставьте адрес сайта ' + code(site) + ', нажмите «Разрешить», затем «Сохранить изменения».</li>' +
          '<li>Вернитесь на сайт и нажмите <b>Ctrl+Shift+R</b>.</li></ol>';
      } else {
        h += '<ol class="sh-ol">' +
          '<li>Откройте настройки браузера → раздел «Файлы cookie» или «Данные сайтов».</li>' +
          '<li>Разрешите сайтам сохранять данные — или добавьте адрес ' + code(site) + ' в список разрешённых.</li>' +
          '<li>Вернитесь на сайт и нажмите <b>Ctrl+Shift+R</b>.</li></ol>';
      }
      h += '<div class="sh-note">🏢 Если переключатель серый и рядом написано «Управляется вашей организацией», настройки браузера на этом компьютере задаёт IT-отдел. ' +
        'Попросите разрешить файлы cookie для сайта ' + code(site) + ' — или откройте сайт в другом браузере.</div>';
    }
    var tech = [];
    if (d.ls && d.ls.state && d.ls.state !== 'ok') tech.push('хранилище: ' + (d.ls.err || d.ls.state));
    tech.push('файлы cookie: ' + (d.cookies ? 'записываются' : 'заблокированы'));
    h += '<div class="sh-diag">Техническая причина — ' + esc(tech.join('; ')) + '</div>';
    return h;
  }
  function openStorageHelp() {
    var d = storageDiag() || {};
    var full = !!(d.ls && d.ls.state === 'full');
    spDialog('', {
      title: full ? 'Хранилище браузера переполнено' : 'Как разрешить сайту сохранять данные ' + storageBrowser().inName,
      icon: full ? '🗄' : '🛡', html: storageHelpHtml(), cancel: false,
      choices: [{ label: 'Понятно', value: true, cls: 'primary' }]
    });
    var ov = document.getElementById('sp-dlg');
    if (!ov || !ov.querySelector) return;
    ov.style.zIndex = '100002'; // поверх окна cookie (z-index 100001)
    var box = ov.querySelector('.sp-dlg-box'); if (box) box.style.width = 'min(620px,100%)';
    ov.addEventListener('click', function (e) {
      var c = e.target && e.target.closest ? e.target.closest('[data-copy]') : null;
      if (!c) return;
      e.stopPropagation();
      spCopyText(c.getAttribute('data-copy') || '', function (ok) {
        c.textContent = ok ? '✓ Скопировано' : 'Выделите и скопируйте вручную';
        setTimeout(function () { c.textContent = '📋 Копировать'; }, 1800);
      });
    });
  }
  /* причина — в общий «Логи ошибок» (после входа запись уйдёт на сервер) */
  function storageDiagReport() {
    var d = storageDiag();
    if (!d || !window.SP_ERRORS || !SP_ERRORS.log) return false;
    var badList = [d.ls, d.ss].filter(function (x) { return x && x.state && x.state !== 'ok'; });
    if (!badList.length) return false;
    var parts = badList.map(function (x) {
      return x.name + ' — ' + (x.state === 'freed' ? 'было переполнено, освобождено место (' + (x.freed || []).join(', ') + ')'
        : x.state === 'full' ? 'переполнено, работа без сохранения' : 'заблокировано браузером, работа без сохранения') + (x.err ? ' [' + x.err + ']' : '');
    });
    var onlyFreed = badList.every(function (x) { return x.state === 'freed'; });
    var ua = ''; try { ua = String(navigator.userAgent || '').slice(0, 300); } catch (e) {}
    SP_ERRORS.log(onlyFreed ? 'info' : 'warn', 'storage', 'Хранилище браузера: ' + parts.join('; ') + '; cookie: ' + (d.cookies ? 'записываются' : 'заблокированы') + (d.frame ? '; сайт открыт внутри другой страницы' : ''),
      { ls: d.ls, ss: d.ss, cookies: d.cookies, frame: d.frame, proto: d.proto, ua: ua });
    return true;
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
    try { if (typeof S !== 'undefined') S.wrAsked = false; } catch (eW) {} // 22.09-257: при повторном входе снова предложить восстановление видов работ
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
    if (b2) b2.onclick = function () { consentSet('accept'); consentApplyLoginState(); toast(storageNotSaved() ? 'warn' : 'ok', storageNotSaved() ? '🍪 Разрешено до закрытия вкладки (браузер запрещает сайту сохранять данные) — можно входить' : '🍪 Cookie разрешены — можно входить'); };
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
      (storageNotSaved() ? '<p class="sp-consent-warn">⚠ <b>Сейчас браузер запрещает сайту сохранять данные</b> — выбор будет действовать только до закрытия вкладки, ' +
        'и при следующем открытии это окно появится снова. Это настройка браузера, а не сайта: ' +
        '<a href="#" data-storage-help="1">как снять запрет ' + esc(storageBrowser().inName) + '</a>.</p>' : '') + // 22.09-252
      (cur ? '<p class="sp-consent-cur">Сейчас: ' + (cur === 'accept' ? '✅ разрешено' : '⛔ отказано') + '</p>' : '') +
      '</div>' +
      '<div class="sp-consent-f">' +
      '<button type="button" class="btn" data-consent="decline">Отказаться</button>' +
      '<button type="button" class="btn primary" data-consent="accept">✅ Разрешить</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var hl = e.target && e.target.closest ? e.target.closest('[data-storage-help]') : null; // 22.09-252: «как снять запрет»
      if (hl) { if (e.preventDefault) e.preventDefault(); e.stopPropagation(); openStorageHelp(); return; }
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
      if (ch === 'accept') {
        // 22.09-252: браузер запрещает хранилище — честно: разрешение действует только до закрытия вкладки
        if (storageNotSaved()) toast('warn', '🍪 Разрешено — но только до закрытия вкладки: браузер запрещает сайту сохранять данные. Как снять запрет — ссылка «Как разрешить» под формой входа.');
        else toast('ok', '🍪 Спасибо! Cookie разрешены.');
      }
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
    // 22.09-268: «Журнал действий» и «Логи ошибок» — можно разрешить другим ролям (таблица прав)
    if ((name === 'logs' || name === 'errlogs') && S.role !== 'admin' && (typeof permCan !== 'function' || !permCan('viewLogs'))) {
      toast('err', 'Доступ к журналам закрыт (настраивается в «Правах доступа»)');
      return;
    }
    if ((name === 'users' || name === 'changelog' || name === 'adminctl') && S.role !== 'admin') { // 22.09-264: + «Управление администрированием»
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
    // 22.09-271: кнопка «Настроить панель» — в шапке, только на панели мониторинга
    try { if (typeof dashSetupBtnSync === 'function') dashSetupBtnSync(); } catch (eDsb) {}
    // 22.09-219: в шапке — только номер текущей сборки; описания изменений больше НЕ
    // пишутся в шапку — они в Администрировании → «Журнал изменений» (SP_CHANGELOG, data.js).
    var _crEl = document.getElementById('screen-crumb');
    _crEl.textContent = 'Сборка ' + SP_BUILD;
    _crEl.title = 'История изменений системы: Администрирование → Журнал изменений';
    document.getElementById('sidebar').classList.remove('open');
    refresh();
  }
