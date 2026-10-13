  /* ── часть 18 · app/18_version_banner.js — уведомление «вышла новая версия сайта» (плашка сверху) ── */
/* ============================================================
   22.09-263: уведомление «вышла новая версия сайта»
   ------------------------------------------------------------
   Открытая (ещё старая) страница раз в 60 секунд проверяет
   версию сборки на сервере (root_index/version.txt — файл
   пишет сборка, на сервере без кэша). Если на сервере новая
   версия — сверху посередине появляется плашка с кнопкой
   «Обновить». Плашка показывается один раз (её можно скрыть).
   Ошибки сети (Render «спит», обрыв) — молча пропускаются.
   ============================================================ */
(function () {
  'use strict';
  var MY_BUILD = String(window.SP_BUILD || '');
  var m = /^22\.09-(\d+)$/.exec(MY_BUILD);
  if (!m) return;
  var myNum = parseInt(m[1], 10);
  var shown = false;
  var timer = null;

  function parseVer(t) {
    var r = /22\.09-(\d+)/.exec(String(t || ''));
    return r ? parseInt(r[1], 10) : 0;
  }

  function showBanner(verStr) {
    if (shown) return;
    shown = true;
    try {
      if (timer) { clearInterval(timer); timer = null; }
      var d = document.createElement('div');
      d.id = 'sp-new-version';
      d.innerHTML =
        '<span id="sp-nv-text"></span>' +
        '<button type="button" id="sp-nv-btn"></button>' +
        '<a href="javascript:void(0)" id="sp-nv-x" title="Скрыть"></a>';
      d.style.cssText =
        'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;' +
        'display:flex;align-items:center;gap:12px;background:#0f172a;color:#f8fafc;' +
        'border:1px solid #38507a;border-radius:12px;padding:10px 16px;font-size:14px;' +
        'box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:94vw;';
      document.body.appendChild(d);
      var t = document.getElementById('sp-nv-text');
      if (t) t.textContent = '🆕 Вышла новая версия сайта (' + verStr + ') — обновите страницу';
      var b = document.getElementById('sp-nv-btn');
      if (b) {
        b.textContent = 'Обновить';
        b.style.cssText = 'background:#2563eb;color:#fff;border:0;border-radius:8px;padding:7px 16px;font-size:14px;cursor:pointer;white-space:nowrap;';
        b.onclick = function () { location.reload(); };
      }
      var x = document.getElementById('sp-nv-x');
      if (x) {
        x.textContent = '×';
        x.style.cssText = 'color:#94a3b8;font-size:20px;line-height:1;text-decoration:none;padding:0 2px;';
        x.onclick = function () { try { d.remove(); } catch (e2) {} };
      }
    } catch (e) {}
  }

  function check() {
    if (shown) return;
    try {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      fetch('root_index/version.txt?spcheck=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return (r && r.ok) ? r.text() : null; })
        .then(function (txt) {
          if (!txt) return;
          var n = parseVer(txt);
          if (n > myNum) showBanner(String(txt).trim());
        })
        .catch(function () {});
    } catch (e) {}
  }

  function start() {
    setTimeout(check, 20000); // первый взгляд — через 20 с после открытия
    timer = setInterval(check, 60000);
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', check);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
