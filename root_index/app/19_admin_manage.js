  /* ── часть 19 · app/19_admin_manage.js — Администрирование → «Управление администрированием»: объявления работникам (22.09-264) ── */
/* ============================================================
   22.09-264: страница «Управление администрированием»
   (Администрирование → первая). Сейчас на ней — блок
   «Объявления и сообщения»: администратор отправляет сообщение
   одному работнику или всем сразу; работник видит объявление
   всплывающим окном и нажимает «ОК»; администратор
   видит, сколько человек ознакомилось.
   Страница сделана «с запасом»: ниже по разметке будут
   добавляться другие функции управления (текущий блок занимает
   только свою карточку).
   Хранение: раздел `messages` на сервере (добавлен и в базу
   Cloudflare, и в базу Render) — объявления приходят на все
   устройства. Каждый «Ознакомлен» — отдельная запись kind:'ack'
   (у неё свой id, поэтому записи разных людей не конфликтуют).
   ============================================================ */
  // Список записей-сообщений из localStorage (пишет синхронизация)
  function annLsKey() {
    try { return (window.SP_SYNC_POLL && SP_SYNC_POLL.LS_KEYS && SP_SYNC_POLL.LS_KEYS.messages) || 'smartplan_messages'; } catch (e) { return 'smartplan_messages'; }
  }
  function annList() {
    try { var a = JSON.parse(localStorage.getItem(annLsKey()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function annAnnouncements() {
    return annList().filter(function (m) { return m && m.id && m.kind !== 'ack'; });
  }
  // «Ознакомились»: ref (id объявления) → массив имён
  function annAcksMap() {
    var map = {};
    annList().forEach(function (m) {
      if (m && m.kind === 'ack' && m.ref) { (map[m.ref] = map[m.ref] || []).push(m.name || m.by || '—'); }
    });
    return map;
  }
  function annFmtTs(ts) {
    try { return ts ? new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; } catch (e) { return ''; }
  }
  // «Локально прочитано» (чтобы окно не появлялось повторно на этом устройстве,
  // даже если связь пропала и подтверждение не ушло на сервер)
  function annSeenLoad() {
    try { var o = JSON.parse(localStorage.getItem('smartplan_msg_seen_v1') || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; }
  }
  function annSeenSave(map) {
    try {
      var keys = Object.keys(map);
      if (keys.length > 500) { var cut = keys.sort(function (a, b) { return map[a] - map[b]; }).slice(0, keys.length - 500); cut.forEach(function (k) { delete map[k]; }); }
      localStorage.setItem('smartplan_msg_seen_v1', JSON.stringify(map));
    } catch (e) {}
  }
  // Объявление — адресовано мне? (мне лично или всем; свои не показываем)
  function annForMe(m) {
    if (!m || !S.user || !S.user.id) return false;
    if (m.from_id && String(m.from_id) === String(S.user.id)) return false;
    return (m.to === 'all') || (String(m.to) === String(S.user.id));
  }
  // Мне адресовано (для пометки в списке у админа) — без учёта «своих»
  function annToMe(m) { return !!m && !!S.user && ((m.to === 'all') || (String(m.to) === String(S.user.id))); }

  // ===== Показ новых объявлений работнику =====
  var _annQueue = [], _annShowing = false;
  function annCheck() {
    try {
      if (!S.user || !S.user.id) return;
      var seen = annSeenLoad();
      var fresh = annAnnouncements().filter(function (m) { return annForMe(m) && !seen[m.id]; })
        .sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      fresh.forEach(function (m) { if (!_annQueue.some(function (x) { return x.id === m.id; })) _annQueue.push(m); });
      annShowNext();
    } catch (e) {}
  }
  function annShowNext() {
    if (_annShowing || !_annQueue.length) return;
    _annShowing = true;
    var m = _annQueue[0];
    var meta = (m.from ? 'От: ' + m.from : 'Администратор') + (m.ts ? ' · ' + annFmtTs(m.ts) : '') + (m.to === 'all' ? ' · всем работникам' : '');
    var high = (m.prio === 'high');
    spDialog('', {
      title: high ? 'ВАЖНОЕ объявление' : 'Объявление от администратора',
      icon: high ? '⚠️' : '📢',
      danger: high,
      cancel: false,
      html: '<div style="font-size:12px;color:#64748b;margin-bottom:8px">' + esc(meta) + '</div>' +
        '<div style="font-size:' + (high ? '16.5' : '15') + 'px;font-weight:' + (high ? '700' : '400') + ';line-height:1.55;white-space:pre-wrap">' + esc(m.text || '') + '</div>' +
        (high ? '<div style="margin-top:10px;font-size:12px;color:#b91c1c">Прочитайте внимательно и нажмите «ОК» — автор увидит, что вы ознакомились.</div>' : ''),
      choices: [{ label: 'ОК', value: true, cls: 'primary' }] // 22.09-265: работник просто нажимает «ОК»
    }, function () {
      _annQueue.shift();
      _annShowing = false;
      annAck(m);
      setTimeout(annShowNext, 300);
    }, function () {
      // окно закрыто без подтверждения (Esc) — объявление останется и появится снова
      _annShowing = false;
    });
  }
  // Подтверждение «Ознакомлен»: локально + отдельная запись на сервер (кто ознакомился)
  function annAck(m) {
    try { var seen = annSeenLoad(); seen[m.id] = Date.now(); annSeenSave(seen); } catch (e) {}
    try {
      if (window.SP_API && SP_API.syncPush && S.user && S.user.id) {
        SP_API.syncPush('messages', {
          id: 'mack_' + m.id + '_' + S.user.id, kind: 'ack', ref: m.id,
          by: S.user.id, name: S.user.full_name || '', ts: Date.now()
        });
      }
    } catch (e) {}
  }

  // ===== Страница «Управление администрированием» =====
  function annActiveUsers() {
    var list = [];
    try { list = (window.SP_USERS_DB ? SP_USERS_DB.getUsers() : DB.getUsers()) || []; } catch (e) { list = []; }
    return list.filter(function (u) { return u && u.id && u.active !== false && u.fired !== true; })
      .sort(function (a, b) { return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru'); });
  }
  var _annListSig = '';
  function annRenderList() {
    var box = document.getElementById('ann-list');
    if (!box) return;
    try {
      var msgs = annAnnouncements().slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      var acks = annAcksMap();
      // 22.09-264: обновляем список только когда данные реально изменились (не мешаем читать/выделять)
      var _sig = msgs.length + ':' + msgs.reduce(function (mx, m) { return Math.max(mx, m.ts || 0); }, 0) + ':' +
        Object.keys(acks).reduce(function (t, k) { return t + acks[k].length; }, 0);
      if (_sig === _annListSig && box.innerHTML) return;
      _annListSig = _sig;
      var myId = (S.user && S.user.id) ? String(S.user.id) : '';
      if (!msgs.length) {
        box.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:6px 2px">Объявлений пока нет. Отправьте первое — оно тут же появится у получателя на экране.</div>';
        return;
      }
      var h = '<table class="dt"><thead><tr><th style="width:130px">Когда</th><th style="width:220px">Кому</th><th>Сообщение</th><th style="width:150px">Ознакомились</th><th style="width:90px"></th></tr></thead><tbody>';
      msgs.forEach(function (m) {
        var names = acks[m.id] || [];
        var nTo = (m.to === 'all') ? (parseInt(m.n_to, 10) || 0) : 1;
        var ackTxt = names.length
          ? '<span style="color:var(--green);font-weight:700">' + names.length + (nTo ? ' из ' + nTo : '') + '</span>'
          : '<span style="color:var(--muted)">0' + (nTo ? ' из ' + nTo : '') + '</span>';
        var mineMark = annToMe(m) ? ' <span class="chip" style="background:var(--blue);color:#fff" title="Это объявление адресовано и вам">вам</span>' : '';
        var prioMark = (m.prio === 'high') ? ' <span class="chip" style="background:var(--red);color:#fff" title="Важное объявление">важное</span>' : '';
        h += '<tr>' +
          '<td style="color:var(--muted);font-size:12px">' + esc(annFmtTs(m.ts)) + '</td>' +
          '<td>' + (m.to === 'all' ? '<b>📢 Всем работникам</b>' : ('<b>' + esc(m.to_name || m.to) + '</b>')) + prioMark + mineMark + '</td>' +
          '<td style="white-space:pre-wrap;max-width:520px">' + esc(m.text || '') + '</td>' +
          '<td title="' + esc(names.length ? names.join(', ') : 'пока никто') + '">' + ackTxt + '</td>' +
          '<td style="text-align:right;white-space:nowrap">' +
            (names.length < nTo ? '<button class="btn sm" data-action="ann-remind" data-mid="' + esc(m.id) + '" title="Отправить напоминание тем, кто ещё не нажал «ОК»">🔔 Напомнить</button> ' : '') +
            '<button class="btn sm" data-action="ann-del" data-mid="' + esc(m.id) + '" style="color:var(--red)" title="Удалить объявление (у всех)">Удалить</button>' +
          '</td>' +
          '</tr>';
      });
      h += '</tbody></table>';
      box.innerHTML = h;
    } catch (e) {
      box.innerHTML = '<div style="color:var(--red);font-size:13px">Не удалось показать список: ' + esc(String(e && e.message || e)) + '</div>';
    }
  }
  // Обновление открытой страницы: построить при первом входе, дальше — только список
  function annPageRefresh() {
    try {
      var view = document.getElementById('view');
      if (!view) return;
      if (!document.getElementById('ann-list')) renderAdminCtl();
      else annRenderList();
    } catch (e) {}
  }
  function renderAdminCtl() {
    try {
      var view = document.getElementById('view');
      if (!view) return;
      var users = annActiveUsers();
      var options = '<option value="all">📢 Всем работникам (' + users.length + ')</option>' +
        users.map(function (u) {
          return '<option value="' + esc(u.id) + '">' + esc(u.full_name || u.login) + (u.area ? ' · ' + esc(u.area) : '') + '</option>';
        }).join('');
      var inputCss = 'padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit;color:var(--txt);background:var(--card)';
      var html =
        // 22.09-274: «Состояние системы» перенесено на страницу «Бэкапы БД»
        '<div class="card">' +
        '<div class="card-h"><h2>📢 Объявления и сообщения</h2><span class="sub">Сообщение одному работнику или всем сразу · получатель видит его на экране и нажимает «ОК»</span></div>' +
        '<div class="card-b">' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;margin-bottom:6px">' +
            '<select id="ann-to" title="Кому отправить объявление" style="' + inputCss + ';min-width:250px">' + options + '</select>' +
            '<select id="ann-tpl" title="Готовый текст" style="' + inputCss + ';max-width:220px">' +
              '<option value="">— шаблон текста —</option>' +
              '<option value="Планёрка в 15:00 у диспетчера. Явка обязательна.">Планёрка 15:00</option>' +
              '<option value="Завтра субботник: приходить к 9:00, инвентарь на складе.">Субботник</option>' +
              '<option value="Внимание: отключение воды (газа) на участке с 10:00 до 14:00. Работы не начинать.">Отключение</option>' +
              '<option value="Пройдите инструктаж по охране труда до конца недели (кабинет 12).">Инструктаж</option>' +
              '<option value="Сдать отчёты по выполненным работам за неделю до пятницы.">Отчёты за неделю</option>' +
            '</select>' +
            '<textarea id="ann-text" rows="3" maxlength="500" placeholder="Текст объявления (до 500 символов)" style="' + inputCss + ';flex:1;min-width:260px;resize:vertical"></textarea>' +
            '<button class="btn primary" data-action="ann-send" title="Отправить объявление">Отправить</button>' +
            '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);padding:8px 2px" title="Важное объявление: показывается крупнее, с пометкой «ВАЖНОЕ»">' +
              '<input type="checkbox" id="ann-high"> важное</label>' +
          '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin:2px 0 14px">Получатель увидит объявление сразу (в течение нескольких секунд), даже если сейчас находится на другой странице сайта.</div>' +
          '<div id="ann-list"></div>' +
        '</div>' +
      '</div>' +
      // 22.09-264: страница — с запасом под будущие функции управления (ниже появятся другие карточки)
      '<div class="card" style="margin-top:14px;border-style:dashed"><div class="card-b" style="color:var(--muted);font-size:13px">Этот раздел будет пополняться: здесь появятся другие функции управления.</div></div>';
      view.innerHTML = html;
      annRenderList();
      try { var _tpl = document.getElementById('ann-tpl'); if (_tpl) _tpl.addEventListener('change', annApplyTemplate); } catch (eTpl) {}
      try { permRenderMatrix(); } catch (ePerm) {}   // 22.09-268: общая таблица прав
      try { stCard(); } catch (eSt) {}                  // 22.09-276: «Проверить систему»
    } catch (e) {
      try { toast('err', 'Ошибка страницы «Управление администрированием»: ' + String(e && e.message || e)); } catch (e2) {}
    }
  }
  // Выбор шаблона — подставить текст в поле
  function annApplyTemplate() {
    try {
      var sel = document.getElementById('ann-tpl');
      var ta = document.getElementById('ann-text');
      if (!sel || !ta) return;
      if (!sel.value) return;
      ta.value = sel.value;
      sel.value = '';
      ta.focus();
    } catch (e) {}
  }
  function annSend() {
    try {
      if (!S.user || !canSendAnn()) { toast('err', 'Отправлять объявления может только администратор (или роли, которым это разрешено)'); return; }
      var sel = document.getElementById('ann-to');
      var ta = document.getElementById('ann-text');
      var to = sel ? String(sel.value || 'all') : 'all';
      var text = String(ta ? ta.value : '').replace(/\s+$/, '').replace(/^\s+/, '');
      if (!text) { toast('warn', 'Введите текст объявления'); if (ta) ta.focus(); return; }
      if (text.length > 500) text = text.slice(0, 500);
      var users = annActiveUsers();
      var toName = 'Всем работникам', nTo = users.length;
      if (to !== 'all') {
        var u = users.filter(function (x) { return x.id === to; })[0];
        if (!u) { toast('err', 'Получатель не найден — обновите страницу (Ctrl+Shift+R)'); return; }
        toName = u.full_name || u.login || to; nTo = 1;
      }
      var highEl = document.getElementById('ann-high');
      var rec = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        kind: 'ann', to: to, to_name: toName, n_to: nTo, text: text,
        prio: (highEl && highEl.checked) ? 'high' : '', // 22.09-267: важное объявление
        from: S.user.full_name || '', from_id: S.user.id, ts: Date.now()
      };
      var after = function () {
        toast('ok', '✓ ' + (rec.prio === 'high' ? 'Важное объявление' : 'Объявление') + ' отправлено: ' + toName);
        if (ta) ta.value = '';
        if (highEl) highEl.checked = false;
        try { if (window.SP_SYNC_POLL && SP_SYNC_POLL.applyRemote) SP_SYNC_POLL.applyRemote('messages', [rec]); } catch (eA) {}
        _annListSig = '';
        annRenderList();
      };
      if (window.SP_API && SP_API.syncPush) {
        SP_API.syncPush('messages', rec).then(function (r) {
          if (r && r.ok) { logAction('Объявление ' + toName, text.slice(0, 120)); after(); }
          else if (r && r.stale_client) toast('err', 'Обновите страницу (Ctrl+Shift+R) и повторите');
          else if (r && r.conflict) toast('err', 'Объявление уже отправлено другим устройством');
          else toast('err', 'Не удалось отправить: ' + ((r && r.err) || 'нет связи с сервером'));
        })['catch'](function () { toast('err', 'Не удалось отправить — нет связи с сервером'); });
      } else {
        toast('err', 'Нет связи с сервером — объявление не отправлено');
      }
    } catch (e) { try { toast('err', 'Ошибка отправки: ' + String(e && e.message || e)); } catch (e2) {} }
  }
  // 22.09-268: права — из ОБЩЕЙ таблицы «действие × роль» (раздел settings на сервере)
  function annPerms() { try { return (typeof permLoad === 'function') ? permLoad() : {}; } catch (e) { return {}; } }
  function canSendAnn() { try { return (typeof permCan === 'function') ? permCan('sendAnn') : (S.role === 'admin'); } catch (e) { return S.role === 'admin'; } }
  // Напоминание тем, кто ещё НЕ нажал «ОК» — отдельное объявление каждому
  function annRemind(id) {
    if (!S.user || !canSendAnn()) { toast('err', 'Нет прав на отправку объявлений'); return; }
    var m = annAnnouncements().filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var acks = annAcksMap()[id] || [];
    var users = annActiveUsers();
    var targets;
    if (m.to === 'all') {
      targets = users.filter(function (u) { return acks.indexOf(u.full_name) < 0 && String(u.id) !== String(m.from_id || ''); });
    } else {
      var u = users.filter(function (x) { return String(x.id) === String(m.to); })[0];
      targets = (u && acks.indexOf(u.full_name) < 0) ? [u] : [];
    }
    if (!targets.length) { toast('ok', 'Все уже ознакомились — напоминать некому'); return; }
    spConfirm('Отправить напоминание ' + targets.length + ' чел., кто ещё не нажал «ОК»?', { title: 'Напоминание об объявлении', ok: 'Отправить' }, function () {
      var done = 0, chain = Promise.resolve();
      targets.forEach(function (u) {
        chain = chain.then(function () {
          var rec = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + u.id.slice(-3),
            kind: 'ann', to: u.id, to_name: u.full_name, n_to: 1,
            prio: m.prio || '', remind_of: m.id,
            text: 'Напоминание: ' + String(m.text || ''),
            from: S.user.full_name || '', from_id: S.user.id, ts: Date.now()
          };
          return SP_API.syncPush('messages', rec).then(function (r) {
            if (r && r.ok) { done++; try { SP_SYNC_POLL.applyRemote('messages', [rec]); } catch (eA) {} }
          })['catch'](function () {});
        });
      });
      chain.then(function () {
        logAction('Напоминание об объявлении', done + ' чел.');
        toast(done ? 'ok' : 'err', (done ? '✓ Напоминание отправлено: ' : 'Не удалось отправить: ') + done + ' чел.');
        _annListSig = ''; annRenderList();
      });
    });
  }

  function annDel(id) {
    if (!id) return;
    if (!S.user || S.role !== 'admin') { toast('err', 'Удалять объявления может только администратор'); return; }
    var m = annAnnouncements().filter(function (x) { return x.id === id; })[0];
    var what = m ? ('Объявление «' + String(m.text || '').slice(0, 60) + (String(m.text || '').length > 60 ? '…' : '') + '» ' + (m.to === 'all' ? 'для всех работников' : ('для ' + (m.to_name || m.to)))) : 'Объявление';
    spConfirm(what + ' — удалить у всех?', { title: 'Удаление объявления', ok: 'Удалить', danger: true }, function () {
      var done = function () { toast('ok', 'Объявление удалено'); _annListSig = ''; annRenderList(); };
      if (window.SP_API && SP_API.del) {
        SP_API.del('messages', id).then(function (r) {
          if (r && r.ok) { try { if (SP_SYNC_POLL && SP_SYNC_POLL.applyRemote) SP_SYNC_POLL.applyRemote('messages', [{ id: id, _deleted: true }]); } catch (eA) {} done(); }
          else toast('err', 'Не удалось удалить: ' + ((r && r.err) || 'нет связи с сервером'));
        })['catch'](function () { toast('err', 'Не удалось удалить — нет связи с сервером'); });
      } else toast('err', 'Нет связи с сервером — объявление не удалено');
    });
  }
  // 22.09-264: у приложения нет автоматической перерисовки экрана при синхронизации,
  // поэтому новые объявления проверяем своим циклом (раз в 20 секунд) + при каждом
  // изменении данных (см. sync_polling) + сразу после входа.
  var _annLoop = null;
  function annStart() {
    try { annCheck(); } catch (e) {}
    if (_annLoop) return;
    _annLoop = setInterval(function () { try { annCheck(); } catch (e) {} }, 20000);
  }
  function annStopLoop() { if (_annLoop) { clearInterval(_annLoop); _annLoop = null; } }
  // Единая точка «данные синхронизировались»: всплывающие объявления + список у админа
  function annAfterSync() {
    if (!S.user || !S.user.id) return;
    try { annCheck(); } catch (e) {}
    try { if (S.screen === 'adminctl') annRenderList(); } catch (e2) {}
  }
  window.SP_ANN = {
    check: annCheck, remind: annRemind, canSend: canSendAnn, perms: annPerms, render: renderAdminCtl, pageRefresh: annPageRefresh, list: annAnnouncements,
    send: annSend, reshow: annShowNext, seen: annSeenLoad, start: annStart, stopLoop: annStopLoop, afterSync: annAfterSync
  };
