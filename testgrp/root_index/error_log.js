/* ============================================================
   SmartPlan — лог ошибок (error_log.js)
   ------------------------------------------------------------
   Сборка 22.09-232: лог ошибок стал ОБЩИМ для всех устройств.

   · Локально хранится как и раньше в localStorage (до 500
     записей) — это резерв на случай, когда нет связи с сервером.
   · Каждая запись дополнительно содержит:
       device — короткое имя устройства (браузер / ОС / код),
       build  — версия сборки сайта на этом устройстве.
   · Новые записи автоматически отправляются на сервер
     (SP_API.errorsPush) в ОБЩИЙ список: так все ошибки со всех
     устройств собираются в одном месте. Отправка идёт пачками
     (до 50), при отсутствии связи/токена — повтор позже.
   · Страница «Логи ошибок» показывает общий серверный список
     (см. renderErrLogs в app.js); локальный лог — только резерв.

   Публичный API:
   · SP_ERRORS.log(level, where, msg, extra) — добавить запись
   · SP_ERRORS.getAll()  — получить все локальные записи (новые сверху)
   · SP_ERRORS.clear()   — очистить ЛОКАЛЬНЫЙ лог
   · SP_ERRORS.push()    — отправить неотправленное на сервер (принудительно)
   · SP_ERRORS.init()    — подписаться на window.onerror / Promise errors
   ============================================================ */
window.SP_ERRORS = (function () {
  'use strict';

  var LS_KEY = 'smartplan_error_log';
  var LS_DEV_KEY = 'smartplan_error_device_id';
  var MAX_ENTRIES = 500;      // размер локального резерва
  var MAX_PUSH = 50;          // не больше 50 записей за один запрос
  var PUSH_DEBOUNCE = 3000;   // пауза перед отправкой после записи
  var PUSH_RETRY = 30000;     // пауза повтора при неудаче / периодический слив

  var _pushTimer = null;
  var _pushing = false;

  function read() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function write(arr) {
    try {
      // Ограничиваем размер — оставляем последние MAX
      if (arr.length > MAX_ENTRIES) arr = arr.slice(-MAX_ENTRIES);
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  // Уникальный идентификатор устройства: генерируется один раз
  // и хранится в localStorage — чтобы различать рабочие места.
  function deviceId() {
    try {
      var id = localStorage.getItem(LS_DEV_KEY);
      if (id) return id;
      id = 'dev' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(LS_DEV_KEY, id);
      return id;
    } catch (e) { return 'dev-unknown'; }
  }

  // Короткое имя устройства: «Chrome / Windows · ab12cd»
  function deviceName() {
    var ua = '';
    try { ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''; } catch (e) {}
    var br = /Edg\//.test(ua) ? 'Edge'
      : /YaBrowser/.test(ua) ? 'Яндекс.Браузер'
      : /OPR\//.test(ua) ? 'Opera'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) ? 'Safari' : 'Браузер';
    var os = /Windows/.test(ua) ? 'Windows'
      : /Android/.test(ua) ? 'Android'
      : /iPhone|iPad/.test(ua) ? 'iOS'
      : /Mac OS/.test(ua) ? 'macOS'
      : /Linux/.test(ua) ? 'Linux' : 'ОС?';
    return br + ' / ' + os + ' · ' + deviceId().substring(3, 9);
  }

  // Версия сборки сайта на этом устройстве (app.js выставляет window.SP_BUILD)
  function buildVer() {
    try {
      return (typeof window !== 'undefined' && window.SP_BUILD) ? String(window.SP_BUILD) : '';
    } catch (e) { return ''; }
  }

  // Универсальная запись
  function log(level, where, msg, extra) {
    try {
      var entry = {
        ts: Date.now(),
        level: level || 'error',     // 'error' | 'warn' | 'info'
        where: where || '(unknown)',
        msg: String(msg && msg.message ? msg.message : (msg || '')).substring(0, 500),
        stack: '',
        extra: extra || null,
        device: deviceName(),
        build: buildVer(),
        synced: false                // true — уже ушла на сервер в общий список
      };
      // Попытка достать stack из Error
      if (msg && msg.stack) entry.stack = String(msg.stack).substring(0, 1500);
      var arr = read();
      arr.push(entry);
      write(arr);
      schedulePush();
    } catch (e) {}
  }

  // Отправка несинхронизированных записей на сервер (общий список).
  // Тихая: без токена/сети просто откладывается на потом.
  function push() {
    if (_pushing) return;
    try {
      if (!(window.SP_API && SP_API.errorsPush && SP_API.getToken && SP_API.getToken())) return;
      var arr = read();
      var batch = [];
      var dirty = false;
      for (var i = 0; i < arr.length && batch.length < MAX_PUSH; i++) {
        if (!arr[i].synced) {
          // Записи, сохранённые ещё до этой сборки, — дозаполняем устройство/сборку
          if (!arr[i].device) { arr[i].device = deviceName(); dirty = true; }
          if (!arr[i].build && buildVer()) { arr[i].build = buildVer(); dirty = true; }
          batch.push(arr[i]);
        }
      }
      if (dirty) write(arr);
      if (!batch.length) return;
      _pushing = true;
      var sent = batch.length;
      SP_API.errorsPush(batch).then(function (r) {
        _pushing = false;
        if (r && r.ok) {
          try {
            // Помечаем первые `sent` неотправленных (самые старые) как отправленные
            var a2 = read();
            var left = sent;
            for (var i = 0; i < a2.length && left > 0; i++) {
              if (!a2[i].synced) { a2[i].synced = true; left--; }
            }
            write(a2);
            // Если остались неотправленные — дослать следующей пачкой
            for (var j = 0; j < a2.length; j++) {
              if (!a2[j].synced) { schedulePush(50); break; }
            }
          } catch (e) {}
        } else {
          schedulePush(PUSH_RETRY);
        }
      })['catch'](function () {
        _pushing = false;
        schedulePush(PUSH_RETRY);
      });
    } catch (e) { _pushing = false; }
  }

  function schedulePush(delay) {
    if (_pushTimer) return;
    try {
      _pushTimer = setTimeout(function () {
        _pushTimer = null;
        push();
      }, typeof delay === 'number' ? delay : PUSH_DEBOUNCE);
      // В Node (тесты) таймер не должен держать процесс
      if (_pushTimer && _pushTimer.unref) { try { _pushTimer.unref(); } catch (e) {} }
    } catch (e) { _pushTimer = null; }
  }

  function getAll() {
    var arr = read();
    // новые сверху
    return arr.slice().reverse();
  }

  function clear() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  function fmtTs(ts) {
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    return pad(d.getDate()) + ' ' + ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][d.getMonth()] +
      ' ' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function init() {
    // Ловим глобальные ошибки JS
    window.addEventListener('error', function (e) {
      log('error', e.filename || 'window.error', e.message || 'unknown', {
        line: e.lineno, col: e.colno, stack: e.error && e.error.stack
      });
    });

    // Ловим необработанные Promise rejection
    window.addEventListener('unhandledrejection', function (e) {
      var reason = e.reason;
      var msg = (reason && reason.message) || String(reason);
      var stack = (reason && reason.stack) || '';
      log('error', 'unhandledrejection', msg, { stack: stack });
    });

    // Перехватываем console.error
    var origError = console.error;
    console.error = function () {
      try {
        var args = Array.prototype.slice.call(arguments);
        var msg = args.map(function (a) {
          if (a instanceof Error) return a.message + ' @ ' + (a.stack || '').split('\n')[0];
          if (typeof a === 'object') {
            try { return JSON.stringify(a).substring(0, 300); } catch (e) { return String(a); }
          }
          return String(a);
        }).join(' ');
        log('error', 'console.error', msg.substring(0, 500));
      } catch (e) {}
      origError.apply(console, arguments);
    };

    // 22.09-232: слив накопленного в ОБЩИЙ список — при появлении сети,
    // периодически и при старте (после входа токен появится — уйдёт само)
    try { window.addEventListener('online', function () { schedulePush(500); }); } catch (e) {}
    try {
      var it = setInterval(function () { push(); }, PUSH_RETRY);
      if (it && it.unref) { try { it.unref(); } catch (e) {} }
    } catch (e) {}
    schedulePush(2000);
  }

  return {
    init: init,
    log: log,
    getAll: getAll,
    clear: clear,
    fmtTs: fmtTs,
    push: push
  };
})();
