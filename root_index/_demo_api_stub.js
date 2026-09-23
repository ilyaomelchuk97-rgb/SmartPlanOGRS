/* ============================================================
   SmartPlan ДЕМО — заглушка SP_API для локального режима
   ------------------------------------------------------------
   В демо сервера НЕТ. Все методы SP_API возвращают «не в сети»
   или «успех» — в зависимости от того, чего ожидает код.

   - getToken() → null  (sync_polling сам проверит и не запустится)
   - login()    → идёт через локальную SP_USERS_DB.authenticate
   - sync()     → { ok:false, sections:{} }
   - get/upsert/update/del/sync → «офлайн» (код ловит и идёт в localStorage)
   ============================================================ */
(function () {
  'use strict';

  function getToken() { return null; }
  function setToken() { /* no-op */ }
  function getUser() {
    try { var raw = localStorage.getItem('smartplan_api_user'); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function setUser(u) {
    try { if (u) localStorage.setItem('smartplan_api_user', JSON.stringify(u)); else localStorage.removeItem('smartplan_api_user'); }
    catch (e) {}
  }

  function noServer(method, path) {
    return Promise.resolve({ ok: false, err: 'Демо: сервер Render не используется (' + method + ' ' + (path||'') + ')', _demo: true });
  }

  function baseUrl() { return ''; }

  // Логин в демо — проверяем локальную базу через SP_USERS_DB.authenticate
  function login(loginStr, password) {
    return new Promise(function (resolve) {
      if (!window.SP_USERS_DB || !SP_USERS_DB.authenticate) {
        return resolve({ ok: false, err: 'модуль users_db не загружен' });
      }
      try {
        SP_USERS_DB.authenticate(loginStr, password).then(function (user) {
          if (!user) return resolve({ ok: false, err: 'Неверный логин или пароль' });
          var fakeToken = 'demo_' + user.id + '_' + Date.now();
          setUser(user);
          try { localStorage.setItem('smartplan_api_token', fakeToken); } catch (e) {}
          resolve({ ok: true, token: fakeToken, user: user, _demo: true });
        });
      } catch (e) {
        resolve({ ok: false, err: 'Ошибка входа: ' + (e && e.message ? e.message : e) });
      }
    });
  }

  function logout() { setToken(null); setUser(null); return Promise.resolve({ ok: true, _demo: true }); }
  function me() { return Promise.resolve({ ok: true, user: getUser(), _demo: true }); }
  function get()    { return noServer('GET', arguments[0]); }
  function upsert() { return noServer('POST', arguments[0]); }
  function update() { return noServer('PUT', arguments[0]); }
  function del()    { return noServer('DELETE', arguments[0]); }
  function sync()   { return Promise.resolve({ ok: false, err: 'демо', sections: {} }); }
  function audit()  { return Promise.resolve({ ok: true, records: [] }); }
  function health() { return Promise.resolve({ ok: false, err: 'демо' }); }

  window.SP_API = {
    baseUrl: baseUrl,
    health: health,
    login: login,
    logout: logout,
    me: me,
    get: get,
    upsert: upsert,
    update: update,
    del: del,
    sync: sync,
    audit: audit,
    getToken: getToken,
    setToken: setToken,
    getUser: getUser,
    setUser: setUser,
    _demo: true
  };

  // Скрываем индикатор синхронизации в топбаре
  function updateSyncIndicator() {
    var dot = document.getElementById('sync-dot');
    var txt = document.getElementById('sync-text');
    var box = document.getElementById('sync-indicator');
    if (dot) dot.style.background = '#94a3b8';
    if (txt) { txt.textContent = 'Демо: офлайн'; txt.style.color = '#475569'; }
    if (box) box.title = 'Демо-режим — данные хранятся только в этом браузере';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSyncIndicator);
  } else {
    updateSyncIndicator();
  }

  console.info(
    '%c SmartPlan ДЕМО-РЕЖИМ ',
    'background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-weight:700;padding:6px 12px;border-radius:6px',
    '\nДанные хранятся только в этом браузере (localStorage). Сервер Render не используется.'
  );
})();
