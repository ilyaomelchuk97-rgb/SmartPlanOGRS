/* ============================================================
   SmartPlan — локальный лог ошибок (error_log.js)
   ------------------------------------------------------------
   Сборка 22.09-26: централизованный сбор ошибок клиента для
   отображения в админ-разделе «Логи ошибок».

   · Логи хранятся в localStorage (до 500 записей)
   · Каждая запись: {ts, level, where, msg, stack, extra}
   · Синхронизация с сервером НЕ нужна — это чисто клиентский лог

   Публичный API:
   · SP_ERRORS.log(level, where, msg, extra) — добавить запись
   · SP_ERRORS.getAll()  — получить все записи (новые сверху)
   · SP_ERRORS.clear()   — очистить лог
   · SP_ERRORS.init()    — подписаться на window.onerror / Promise errors
   ============================================================ */
window.SP_ERRORS = (function () {
  'use strict';

  var LS_KEY = 'smartplan_error_log';
  var MAX_ENTRIES = 500;

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

  // Универсальная запись
  function log(level, where, msg, extra) {
    try {
      var entry = {
        ts: Date.now(),
        level: level || 'error',     // 'error' | 'warn' | 'info'
        where: where || '(unknown)',
        msg: String(msg || '').substring(0, 500),
        stack: '',
        extra: extra || null
      };
      // Попытка достать stack из Error
      if (msg && msg.stack) entry.stack = msg.stack;
      var arr = read();
      arr.push(entry);
      write(arr);
    } catch (e) {}
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
  }

  return {
    init: init,
    log: log,
    getAll: getAll,
    clear: clear,
    fmtTs: fmtTs
  };
})();