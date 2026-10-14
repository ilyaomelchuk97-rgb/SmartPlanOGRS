  /* ── часть 22 · app/22_admin_tools.js — админ-инструменты: «Состояние системы», бэкап по кнопке + список копий, история по задаче, массовые операции с пользователями (22.09-267) ── */
/* ============================================================
   22.09-267: инструменты администратора
   · «Состояние системы» — бэкапы (когда был последний и список
     последних копий), ошибки за сутки, кто сейчас онлайн и —
     главное — кто из сотрудников работает на СТАРОЙ версии сайта.
   · Кнопка «Сделать бэкап сейчас» — резервная копия на Google Диск
     по требованию (не дожидаясь расписания).
   · История по задаче — кто и когда её менял (из журнала действий).
   · Массовые операции в «Пользователях»: отметить несколько
     галочками и разом отключить/включить или задать общий пароль.
   ============================================================ */

  // ---------- «Состояние системы» ----------
  var _sysState = { loading: false, data: null, err: '' };
  function sysStatusLoad(force) {
    if (_sysState.loading) return;
    if (_sysState.data && !force) return;
    _sysState.loading = true;
    var box = document.getElementById('sys-status-box');
    if (box) box.innerHTML = '<div style="color:var(--muted);font-size:13px">Запрашиваю состояние системы…</div>';
    if (window.SP_API && SP_API.status) {
      SP_API.status().then(function (r) {
        _sysState.loading = false;
        if (r && r.ok) { _sysState.data = r; _sysState.err = ''; }
        else { _sysState.err = (r && r.err) || 'нет связи с сервером'; }
        sysStatusRender();
      })['catch'](function (e) {
        _sysState.loading = false;
        _sysState.err = String((e && e.message) || e);
        sysStatusRender();
      });
    } else { _sysState.loading = false; _sysState.err = 'нет связи с сервером'; sysStatusRender(); }
  }
  function sysFmtAgo(ts) {
    if (!ts) return '—';
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 90) return 'только что';
    var m = Math.round(s / 60); if (m < 90) return m + ' мин назад';
    var h = Math.round(m / 60); if (h < 36) return h + ' ч назад';
    return Math.round(h / 24) + ' дн назад';
  }
  function sysStatusRender() {
    var box = document.getElementById('sys-status-box');
    if (!box) return;
    if (_sysState.err) { box.innerHTML = '<div style="color:var(--red);font-size:13px">Не удалось получить состояние: ' + esc(_sysState.err) + ' <button class="btn sm" data-action="sys-refresh">Повторить</button></div>'; return; }
    var d = _sysState.data;
    if (!d) { box.innerHTML = '<div style="color:var(--muted);font-size:13px">Нет данных.</div>'; return; }
    var lb = d.last_backup;
    var bkLine = lb
      ? ('<b>' + esc(sysFmtAgo(lb.ts)) + '</b> (' + esc(new Date(lb.ts).toLocaleString('ru-RU')) + ') · файл ' + esc(lb.file) + ' · ' + lb.size_kb + ' КБ')
      : '<span style="color:var(--yellow)">пока не было — проверьте cron-триггер и скрипт Google</span>';
    var errCol = (d.errors_24h > 0) ? 'var(--yellow)' : 'var(--green)';
    var onl = (d.online || []).map(function (o) { return esc(o.name) + (o.build ? ' <span style="color:var(--muted);font-size:11px">' + esc(o.build) + '</span>' : ''); }).join(' · ');
    var outdated = d.outdated || [];
    var outdatedHtml = outdated.length
      ? '<div style="background:var(--yellow-l);border:1px solid #fde68a;border-left:4px solid var(--yellow);border-radius:9px;padding:10px 12px;font-size:12.5px;color:#78350f;margin-top:10px">' +
          '<b>⚠ Работают на старой версии сайта (' + outdated.length + '):</b> ' +
          outdated.map(function (x) { return esc(x.name) + ' <span style="opacity:.8">(' + esc(x.build) + ')</span>'; }).join(', ') +
          '<div style="margin-top:5px">Попросите их обновить страницу (F5) — на старой версии часть кнопок может работать иначе.</div></div>'
      : '<div style="color:var(--green);font-size:12.5px;margin-top:10px">✅ Все открытые сессии — на свежей версии сайта (' + esc(d.newest_build || '—') + ')</div>';
    var bks = (d.backups || []).filter(function (b) { return !b.skipped && b.file; });
    var bkRows = bks.map(function (b) {
      return '<tr><td style="white-space:nowrap">' + esc(new Date(b.ts).toLocaleString('ru-RU')) + '</td><td style="font-family:monospace;font-size:12px">' + esc(b.file) + '</td><td style="text-align:right">' + b.size_kb + ' КБ</td><td style="text-align:right">' + b.records + '</td></tr>';
    }).join('');
    box.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">' +
        '<div class="sys-tile"><div class="sys-t">Последняя копия на Диске</div><div class="sys-v">' + bkLine + '</div></div>' +
        '<div class="sys-tile"><div class="sys-t">Ошибки (за сутки / всего)</div><div class="sys-v" style="color:' + errCol + '">' + d.errors_24h + ' / ' + d.errors_all + '</div></div>' +
        '<div class="sys-tile"><div class="sys-t">Сейчас на сайте</div><div class="sys-v">' + ((d.online || []).length ? ((d.online || []).length + ' чел.') : 'никого') + (onl ? '<div style="font-size:11.5px;color:var(--muted);margin-top:3px">' + onl + '</div>' : '') + '</div></div>' +
        '<div class="sys-tile"><div class="sys-t">Активных сотрудников</div><div class="sys-v">' + d.active_users + '</div></div>' +
      '</div>' + outdatedHtml +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 10px">' +
        '<button class="btn primary" data-action="sys-backup">💾 Сделать бэкап сейчас</button>' +
        '<button class="btn" data-action="sys-refresh">↻ Обновить состояние</button>' +
        '<a class="btn" href="https://drive.google.com/drive/search?q=SmartPlan%20backups" target="_blank" rel="noopener">Открыть папку на Диске</a>' +
      '</div>' +
      (bkRows ? ('<div style="font-size:12.5px;color:var(--muted);margin-bottom:4px">Последние копии (журнал):</div>' +
        '<table class="dt" data-nosort="0" data-nosticky="1"><thead><tr><th>Когда</th><th>Файл</th><th style="text-align:right">Размер</th><th style="text-align:right">Записей</th></tr></thead><tbody>' + bkRows + '</tbody></table>')
        : '<div style="font-size:12.5px;color:var(--muted)">Копий пока нет.</div>');
  }
  function sysBackupNow() {
    if (!S.user || S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    toast('ok', '💾 Делаю резервную копию на Google Диск…');
    SP_API.backupNow().then(function (r) {
      if (r && r.ok && !r.skipped) { toast('ok', '✓ Копия создана: ' + r.file + ' (' + r.size_kb + ' КБ)'); logAction('Ручной бэкап на Google Диск', r.file || ''); }
      else if (r && r.ok) toast('ok', 'Копия уже актуальна (ничего не менялось)');
      else toast('err', 'Не удалось: ' + ((r && r.err) || 'нет связи'));
      _sysState.data = null; sysStatusLoad(true);
    })['catch'](function (e) { toast('err', 'Не удалось: ' + String((e && e.message) || e)); });
  }

  // ---------- История по задаче ----------
  function taskHistoryShow(taskId, taskName) {
    if (!taskId) return;
    try {
      var modal = document.getElementById('modal');
      overlay.classList.add('show');
      modal.style.maxWidth = '900px';
      modal.innerHTML = '<div class="modal-h"><h3>🕓 История по задаче</h3><button class="x" data-action="close-modal">×</button></div>' +
        '<div class="modal-b" id="hist-body"><div style="color:var(--muted);font-size:13px">Загружаю…</div></div>' +
        '<div class="modal-f"><button class="btn" data-action="close-modal">Закрыть</button></div>';
    } catch (e) {}
    if (!SP_API.auditByObject) { toast('err', 'Сервер не поддерживает историю'); return; }
    SP_API.auditByObject(taskId, 50).then(function (r) {
      var body = document.getElementById('hist-body');
      if (!body) return;
      var recs = (r && r.records) || [];
      if (!r || !r.ok) { body.innerHTML = '<div style="color:var(--red);font-size:13px">Ошибка: ' + esc((r && r.err) || 'нет связи') + '</div>'; return; }
      if (!recs.length) { body.innerHTML = '<div style="color:var(--muted);font-size:13px">Изменений по этой задаче в журнале нет.</div>'; return; }
      var h = '<div style="font-size:12.5px;color:var(--muted);margin-bottom:8px">' + esc(taskName || taskId) + '</div>';
      h += '<table class="dt"><thead><tr><th style="width:150px">Когда</th><th style="width:170px">Кто</th><th style="width:110px">Действие</th><th>Подробности</th></tr></thead><tbody>';
      recs.forEach(function (x) {
        var act = ({ upsert: 'изменение', update: 'изменение', delete: 'удаление', conflict: 'конфликт', 'restore': 'восстановление' })[x.action] || x.action || '';
        h += '<tr><td style="white-space:nowrap">' + esc(sysFmtAgo(x.ts)) + '<div style="font-size:11px;color:var(--muted)">' + esc(new Date(x.ts).toLocaleString('ru-RU')) + '</div></td>' +
          '<td>' + esc(x.user_name || x.user_login || '—') + '</td><td>' + esc(act) + '</td><td style="font-size:12px;color:var(--muted)">' + esc(x.details || '') + '</td></tr>';
      });
      h += '</tbody></table>';
      body.innerHTML = h;
    })['catch'](function (e) {
      var body = document.getElementById('hist-body');
      if (body) body.innerHTML = '<div style="color:var(--red);font-size:13px">Ошибка: ' + esc(String((e && e.message) || e)) + '</div>';
    });
  }
  function taskHistoryAction(el) {
    var id = el && el.dataset ? el.dataset.tid : '';
    if (!id) return;
    var t = (window.SP_TASKS ? SP_TASKS.getTasks() : []).filter(function (x) { return x.id === id; })[0];
    var nm = '';
    try { nm = t ? (myDayWorkName(t) + ' · ' + (myDayObject(t) ? objFullAddr(myDayObject(t)) : t.o)) : id; } catch (e) { nm = id; }
    taskHistoryShow(id, nm);
  }

  // ---------- Массовые операции с пользователями ----------
  function bulkSelected() {
    var ids = [];
    document.querySelectorAll('#view [data-bulk-user]').forEach(function (c) { if (c.checked) ids.push(c.getAttribute('data-bulk-user')); });
    return ids;
  }
  function bulkToggleAll(on) {
    document.querySelectorAll('#view [data-bulk-user]').forEach(function (c) { c.checked = !!on; });
    bulkPanelSync();
  }
  function bulkPanelSync() {
    var n = bulkSelected().length;
    var bar = document.getElementById('bulk-bar');
    if (bar) bar.style.display = n ? 'flex' : 'none';
    var cnt = document.getElementById('bulk-count');
    if (cnt) cnt.textContent = 'Выбрано: ' + n;
  }
  function bulkSetActive(on) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var ids = bulkSelected();
    if (!ids.length) { toast('warn', 'Отметьте сотрудников галочками'); return; }
    var what = on ? 'включить' : 'отключить';
    spConfirm('Выбранных (' + ids.length + ') ' + what + '? ' + (on ? '' : 'Отключённый не сможет войти (удобно на время отпуска) — данные и история сохраняются.'), { title: 'Массовая операция', ok: on ? 'Включить' : 'Отключить', danger: !on }, function () {
      var done = 0, chain = Promise.resolve();
      ids.forEach(function (id) {
        chain = chain.then(function () {
          var u = DB.getUser(id); if (!u) return;
          return SP_API.update('users', id, Object.assign({}, u, { active: !!on })).then(function (r) {
            if (r && r.ok) {
              var loc = DB.getUser(id); if (loc) { loc.active = !!on; }
              done++;
            }
          })['catch'](function () {});
        });
      });
      chain.then(function () {
        logAction(on ? 'Массовое включение пользователей' : 'Массовое отключение пользователей', done + ' чел.');
        toast(done === ids.length ? 'ok' : 'warn', (on ? 'Включено: ' : 'Отключено: ') + done + ' из ' + ids.length);
        try { if (SP_SYNC_POLL && SP_SYNC_POLL.kick) SP_SYNC_POLL.kick(); } catch (e) {}
        renderUsers();
        bulkPanelSync();
      });
    });
  }
  function bulkSetPassword() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var ids = bulkSelected();
    if (!ids.length) { toast('warn', 'Отметьте сотрудников галочками'); return; }
    // поля пароля — прямо в панели массовых операций (просто и надёжно)
    var bar = document.getElementById('bulk-bar');
    if (!bar) return;
    var pan = document.getElementById('bulk-pass-panel');
    if (pan) { pan.style.display = (pan.style.display === 'none') ? 'block' : 'none'; return; }
    pan = document.createElement('div');
    pan.id = 'bulk-pass-panel';
    pan.style.cssText = 'margin-top:8px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--panel-2)';
    pan.innerHTML = '<div style="font-size:12.5px;color:var(--muted);margin-bottom:6px">Один новый пароль для выбранных (' +
      '<span id="bulk-pass-n"></span>). Передайте его каждому лично — в журнал пароль не пишется.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<input id="bulk-pass" type="text" placeholder="Новый пароль" style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt)">' +
      '<input id="bulk-pass2" type="text" placeholder="Повторите" style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card);color:var(--txt)">' +
      '<button class="btn primary" data-action="bulk-pass-go">Задать пароль</button></div>';
    bar.appendChild(pan);
  }
  function bulkSetPasswordGo() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var ids = bulkSelected();
    if (!ids.length) { toast('warn', 'Отметьте сотрудников галочками'); return; }
    var p1 = (document.getElementById('bulk-pass') || {}).value || '';
    var p2 = (document.getElementById('bulk-pass2') || {}).value || '';
    if (String(p1).length < 4) { toast('err', 'Пароль слишком короткий (минимум 4 символа)'); return; }
    if (p1 !== p2) { toast('err', 'Пароли не совпадают'); return; }
    var done = 0, chain = Promise.resolve();
    ids.forEach(function (id) {
      chain = chain.then(function () {
        return SP_API.update('users', id, { plain_password: p1 }).then(function (r) { if (r && r.ok) done++; })['catch'](function () {});
      });
    });
    chain.then(function () {
      logAction('Массовая смена пароля', done + ' чел. (пароль в журнал не пишется)');
      toast(done === ids.length ? 'ok' : 'warn', 'Пароль задан: ' + done + ' из ' + ids.length + '. Передайте его сотрудникам лично.');
      var pan = document.getElementById('bulk-pass-panel'); if (pan) pan.parentNode.removeChild(pan);
      bulkToggleAll(false);
    });
  }
  // счётчик выбранных в панели пароля
  function bulkPassCount() {
    var n = document.getElementById('bulk-pass-n');
    if (n) n.textContent = bulkSelected().length + ' чел.';
  }
  window.SP_ADMINX = { status: sysStatusLoad, backupNow: sysBackupNow, history: taskHistoryShow, bulkToggleAll: bulkToggleAll, bulkPanelSync: bulkPanelSync, bulkPassCount: bulkPassCount };
