  /* ── часть 09 · app/09_admin.js — администрирование: пользователи, бэкапы, журнал действий, логи ошибок ── */
  /* =====================================================================
     РЕНДЕР: ПОЛЬЗОВАТЕЛИ (только администратор)
     ===================================================================== */
  // 💾 Скачать полную резервную копию базы (JSON) — страховка данных
  /* ===== ЛОКАЛЬНАЯ БАЗА: бэкап/восстановление/автоснимок/демо-данные ===== */
  /* Все данные SmartPlan живут в localStorage браузера (привязка — к адресу
     страницы, НЕ к файлам): замена app.js/index.html данные НЕ стирает.
     Опасны только: смена схемы БД при обновлении (теперь данные переносятся,
     а прежнее состояние сохраняется в smartplan_prev_*), чистка браузера и
     сброс хранилища. Полная страховка — файл бэкапа (JSON). */
  function backupCollectKeys() {
    var keys = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^smartplan_/.test(k) && k !== 'smartplan_session' && k !== 'smartplan_logged_in' && k !== 'smartplan_autobackup') keys[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return keys;
  }
  function downloadBackup() {
    try {
      var keys = backupCollectKeys();
      var data = { app: 'SmartPlan', v: 1, ts: Date.now(), keys: keys };
      var dt = new Date();
      var p2 = function (n) { return String(n).padStart(2, '0'); };
      var name = 'smartplan-backup-' + dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()) + '-' + p2(dt.getHours()) + p2(dt.getMinutes()) + '.json';
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var aEl = document.createElement('a');
      aEl.href = url; aEl.download = name;
      document.body.appendChild(aEl); aEl.click(); aEl.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('ok', '💾 Локальный бэкап скачан: ' + name + ' (' + Object.keys(keys).length + ' разделов)');
      logAction('Скачивание локального бэкапа', name + ' (' + Object.keys(keys).length + ' разделов)');
    } catch (e) { toast('err', 'Не удалось создать бэкап'); }
  }
  /* Автоснимок всей базы (страховка от чистки/сброса; живёт в smartplan_autobackup) */
  function snapshotAuto() {
    // 22.09-252: автоснимок — копия ВСЕЙ базы в том же хранилище браузера (удваивает объём).
    // Большая база (> 1,5 млн знаков) — снимок не делаем, а не поместился — убираем устаревший,
    // чтобы не переполнить хранилище (данные и так на сервере; полная страховка — файл бэкапа).
    try {
      var json = JSON.stringify({ ts: Date.now(), keys: backupCollectKeys() });
      if (json.length > 1500000) { localStorage.removeItem('smartplan_autobackup'); return; }
      localStorage.setItem('smartplan_autobackup', json);
    } catch (e) { try { localStorage.removeItem('smartplan_autobackup'); } catch (e2) {} }
  }
  /* Восстановление из файла бэкапа (JSON) */
  var RESTORE_PENDING = null;
  function restoreBackupFile(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var j = null;
      try { j = JSON.parse(fr.result); } catch (e) {}
      if (!j || !j.keys || typeof j.keys !== 'object') { toast('err', 'Файл не похож на бэкап SmartPlan (нет разделов)'); return; }
      var cnt = 0;
      for (var k in j.keys) if (/^smartplan_/.test(k)) cnt++;
      if (!cnt) { toast('err', 'В файле нет данных SmartPlan'); return; }
      RESTORE_PENDING = j.keys;
      var dt = j.ts ? new Date(j.ts) : null;
      var dtStr = dt ? dt.toLocaleString('ru-RU') : 'дата неизвестна';
      var modal = document.getElementById('modal');
      var overlay = document.getElementById('overlay');
      if (!modal || !overlay) { toast('err', 'Окно недоступно'); return; }
      modal.innerHTML = '<div class="modal-h"><h3>Восстановить базу из бэкапа?</h3><button class="x" data-action="close-modal">×</button></div>' +
        '<div class="modal-b">' +
        '<div class="calc" style="font-size:12.5px;line-height:1.6;align-items:flex-start">Файл: <b>' + esc(file.name) + '</b><br>Снимок: <b>' + esc(dtStr) + '</b><br>Разделов базы: <b>' + cnt + '</b><br><br>Текущие данные будут <b style="color:var(--red)">заменены</b> содержимым бэкапа. Страница перезагрузится.</div>' +
        '</div>' +
        '<div class="modal-f">' +
        '<button type="button" class="btn ok" data-action="restore-backup-go">♻ Восстановить</button>' +
        '<button type="button" class="btn danger" data-action="close-modal">Отменить</button>' +
        '</div>';
      modal.style.maxWidth = '440px';
      overlay.classList.add('show');
    };
    fr.readAsText(file);
  }
  /* Демо-данные: преднаполненная локальная база для тестов (идемпотентно —
     повторный запуск только дополняет недостающее и освежает демо-задачи) */
  function seedDemoData() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var res = { objs: 0, users: 0, brigade: 0, tasks: 0, graph: false };
    var users = DB.getUsers() || [];
    var master = null;
    users.forEach(function (u) { if (u.id === 'u_master_demo') master = u; });
    if (!master) { toast('err', 'Стандартные пользователи ещё не созданы — перезагрузите страницу'); return; }
    // 1) демо-слесари (без дублей по логину); DB.addUser асинхронный (хэш пароля)
    var haveLogin = {};
    users.forEach(function (u) { haveLogin[u.login] = 1; });
    var demoSlesari = [
      { login: 'slesar2', pw: 'slesar2123', name: 'Сидоров Павел Викторович' },
      { login: 'slesar3', pw: 'slesar3123', name: 'Кузнецов Игорь Леонидович' },
      { login: 'slesar4', pw: 'slesar4123', name: 'Гончарук Олег Михайлович' }
    ];
    var proms = [];
    demoSlesari.forEach(function (d) {
      if (haveLogin[d.login]) return;
      try {
        proms.push(DB.addUser({ full_name: d.name, login: d.login, password: d.pw, role: 'slesar', area: 'УБиРОГС', active: true, prof: 'Слесарь УБиРОГС' }).then(function () { res.users++; }).catch(function () {}));
      } catch (e) {}
    });
    Promise.all(proms).then(function () { seedDemoPart2(res); }).catch(function () { seedDemoPart2(res); });
  }
  function seedDemoPart2(res) {
    // id слесарей — по логинам (DB.addUser уже завершился)
    var slesarIds = [];
    (DB.getUsers() || []).forEach(function (u) {
      if (u.role === 'slesar' && (u.id === 'u_slesar_demo' || /^slesar\d$/.test(u.login))) slesarIds.push(u.id);
    });
    // бригада мастера
    slesarIds.forEach(function (uid) {
      try { if (window.SP_WORKERS) SP_WORKERS.setWorker(uid, { brigade: 'u_master_demo' }); res.brigade++; } catch (e) {}
    });
    // 2) объекты (ГРП/ШРП по Минску) — без дублей по тип+номер+адрес
    var demoObjs = [
      { t: 'ГРП', n: '1', a: 'ул. Ленина, 1', lat: 53.9023, lng: 27.5619 },
      { t: 'ГРП', n: '2', a: 'ул. Кальварийская, 17', lat: 53.9186, lng: 27.5355 },
      { t: 'ГРП', n: '3', a: 'пр. Независимости, 65', lat: 53.9313, lng: 27.6461 },
      { t: 'ГРП', n: '4', a: 'ул. Одоевского, 131', lat: 53.8647, lng: 27.4868 },
      { t: 'ГРП', n: '5', a: 'ул. Платонова, 20', lat: 53.9365, lng: 27.5871 },
      { t: 'ГРП', n: '6', a: 'ул. Голубева, 2', lat: 53.9087, lng: 27.4847 },
      { t: 'ГРП', n: '7', a: 'ул. Тимирязева, 66', lat: 53.9237, lng: 27.4966 },
      { t: 'ГРП', n: '8', a: 'ул. Якуба Коласа, 14', lat: 53.9265, lng: 27.5862 },
      { t: 'ШРП', n: '1', a: 'ул. Кошевого, 6', lat: 53.8771, lng: 27.5216 },
      { t: 'ШРП', n: '2', a: 'ул. Щорса, 11', lat: 53.9155, lng: 27.5731 },
      { t: 'ШРП', n: '3', a: 'ул. Нарочанская, 8', lat: 53.9165, lng: 27.5547 },
      { t: 'ШРП', n: '4', a: 'пер. Сестринский, 4', lat: 53.9001, lng: 27.5392 }
    ];
    var haveObj = {};
    (window.SP_OBJECTS ? SP_OBJECTS.getObjects() : []).forEach(function (o) { haveObj[o.type + '|' + o.num + '|' + o.addr] = 1; });
    demoObjs.forEach(function (d) {
      var key = d.t + '|' + d.n + '|' + d.a;
      if (haveObj[key]) return;
      try { SP_OBJECTS.addObject({ type: d.t, num: d.n, addr: d.a, lat: d.lat, lng: d.lng, respId: 'u_master_demo', respName: 'Иванов Сергей Петрович' }); res.objs++; } catch (e) {}
    });
    var objsNow = (window.SP_OBJECTS ? SP_OBJECTS.getObjects() : []).filter(function (o) {
      return demoObjs.some(function (d) { return d.t === o.type && d.n === String(o.num) && d.a === o.addr; });
    });
    // 3) демо-задачи: прежние демо удаляем, создаём свежие на сегодня/завтра
    try {
      TASKS_DB.getTasks().slice().forEach(function (t) { if (t.demo) TASKS_DB.deleteTask(t.id); });
    } catch (e) {}
    function addDemoTask(ob, off, wid) {
      try {
        TASKS_DB.addTask({ m: 'u_master_demo', d: off, o: ob.id, w: wid, garea: 'УБиРОГС', s: 'plan', status: 'plan', volume: 1, slesari: slesarIds.slice(), demo: true });
        res.tasks++;
      } catch (e) {}
    }
    objsNow.slice(0, 6).forEach(function (ob, i) { addDemoTask(ob, 0, i % 3 === 2 ? 'w7' : 'w1'); });
    objsNow.slice(6, 9).forEach(function (ob) { addDemoTask(ob, 1, 'w1'); });
    // 4) демо-график работ
    try {
      var list = graphsLoad();
      var haveG = false;
      list.forEach(function (g) { if (g.name === 'Демо-график') haveG = true; });
      if (!haveG && objsNow.length >= 4) {
        var yr = new Date().getFullYear();
        var p2 = function (n) { return String(n).padStart(2, '0'); };
        function iso(mon, day) { return yr + '-' + p2(mon) + '-' + p2(day); }
        var gObjs = objsNow.slice(0, 4).map(function (ob, i) {
          return {
            oid: ob.id, type: ob.type, name: ob.type + '-' + ob.num + ', ' + ob.addr,
            works: [
              { sid: 'demo_s' + i + '_a', wid: 'w1', period: 1, dev: 0, first: iso(1, 10), occs: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (m) { return { date: iso(m, 10), wid: 'w1' }; }) },
              { sid: 'demo_s' + i + '_b', wid: 'w7', period: 2, dev: 2, first: iso(1, 20), occs: [1, 3, 5, 7, 9].map(function (m) { return { date: iso(m, m === 1 ? 20 : 18), wid: 'w7' }; }) }
            ]
          };
        });
        list.push({ id: 'g_demo_' + Date.now(), name: 'Демо-график', year: yr, respId: 'u_master_demo', respName: 'Иванов Сергей Петрович', created: iso(9, 21), works: [], area: 'УБиРОГС', workColors: { w1: '#338dff', w7: '#ffff00' }, objs: gObjs });
        graphsSaveList(list);
        res.graph = true;
      }
    } catch (e) {}
    snapshotAuto();
    logAction('Демо-данные', 'объекты: ' + res.objs + ', слесари: ' + res.users + ', задачи: ' + res.tasks + (res.graph ? ', график' : ''));
    toast('ok', '🧪 Демо-данные: объектов +' + res.objs + ' (всего ' + objsNow.length + '), слесари +' + res.users + ', бригада: ' + res.brigade + ', задач: ' + res.tasks + (res.graph ? ', график «Демо-график»' : '') + '. Данные в localStorage — обновление файлов их не стирает.');
    try { refreshObjects(); } catch (e) {}
    refresh();
  }

  function renderUsers() {
    try {
      var allUsers = DB.getUsers() || [];
      // 22.09-161: уволенные — отдельным блоком внизу (без логина/пароля)
      var firedUsers = allUsers.filter(function (u) { return u && u.fired === true; });
      var users = allUsers.filter(function (u) { return u && u.fired !== true; });
      var html = '<div class="card"><div class="card-h"><h2>Пользователи системы</h2><span class="sub">' + users.length + ' учётных записей</span><div class="spacer"></div>' + (S.role === 'admin' ? '<button class="btn sm" data-action="demo-seed" title="Заполнить локальную базу демо-данными для тестов: объекты ГРП/ШРП Минска, бригада слесарей, задачи на сегодня/завтра, график работ. Данные живут в localStorage и НЕ теряются при замене файлов сайта">🧪 Демо-данные</button>' : '') + (S.role === 'admin' ? '<button class="btn sm" data-action="download-backup" title="Скачать полную резервную копию локальной базы (JSON) — работает без сервера">' + IC.download + ' 💾 Бэкап базы</button>' : '') + (S.role === 'admin' ? '<button class="btn sm" data-action="restore-backup" title="Восстановить базу из файла бэкапа (JSON)">♻ Восстановить</button>' : '') + '<button class="btn sm" data-action="export-db" title="Сохранить базу в Excel">' + IC.download + ' Экспорт в Excel</button>' + (S.role === 'admin' ? '<button class="btn sm" data-action="import-db" title="Загрузить базу из Excel">' + IC.upload + ' Импорт из Excel</button>' : '') + '<input type="file" id="import-file" accept=".xlsx,.xls,.csv" style="display:none"><input type="file" id="restore-file" accept=".json,application/json" style="display:none">';
      if (S.role === 'admin') {
        html += '<button class="btn primary" data-action="new-user">' + IC.plus + ' Добавить пользователя</button>';
      }
      html += '</div><div class="card-b">';
      if (users.length <= 1) {
        html += '<div style="margin-bottom:14px;background:var(--yellow-l);border:1px solid #fde68a;border-left:4px solid var(--yellow);border-radius:10px;padding:13px 15px;display:flex;gap:12px;align-items:flex-start">' + IC.info + '<div style="flex:1;font-size:12.5px;color:#78350f;line-height:1.6"><b>Новый браузер или компьютер?</b><br>Каждый браузер хранит свою базу пользователей отдельно (в Chrome их не видно из Edge и наоборот). Если пользователи уже заведены в другом браузере — перенесите их файлом:<div style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm primary" data-action="import-db">' + IC.upload + ' Импорт из файла</button><a href="#" style="font-size:12px;color:var(--blue);align-self:center" data-action="how-transfer">Как это сделать?</a></div></div></div>';
      }
      html += '<table class="dt"><thead><tr><th>ФИО</th><th>Логин</th><th>Таб. №</th><th>Пароль</th><th>Роль</th><th>Участок</th><th>Статус</th><th style="text-align:right">Действия</th></tr></thead><tbody>';
      users.forEach(function (u) {
        if (!u) return;
        var me = (S.user && u.id === S.user.id) ? ' <span style="color:var(--green);font-size:12px">(вы)</span>' : '';
        var delBtn = (u.id === 'u_seogs') ? '' : (u.role === 'admin' && DB.countAdmins() <= 1 ? '' : '<button class="btn sm" data-action="del-user" data-uid="' + u.id + '" style="color:var(--red)">Удалить</button>');
        var fireBtn = (u.id === 'u_seogs' || (u.role === 'admin' && DB.countAdmins() <= 1) || (S.user && u.id === S.user.id)) ? '' : '<button class="btn sm" data-action="fire-user" data-uid="' + u.id + '" style="color:#b45309" title="Уволить: вход закрывается, логин и пароль убираются, со страницы «Работники» исчезает; в выполненных задачах и истории ФИО сохраняется">Уволить</button> ';
        // 22.09-241: пароль НЕ показываем (раньше — открытым текстом, а если неизвестен — ошибочно «admin123»);
        // администратор задаёт новый кнопкой «🔑 Сменить пароль» — пароль уходит на сервер и действует для входа
        var passLabel = '<span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-family:monospace;background:var(--panel-3);padding:2px 7px;border-radius:4px;color:var(--muted);font-weight:700;letter-spacing:1px" title="Пароль скрыт — он хранится на сервере в зашифрованном виде">🔒 ••••••</span>' +
          (S.role === 'admin' ? '<button class="btn sm" data-action="pwd-user" data-uid="' + esc(u.id) + '" title="Задать пользователю новый пароль для входа">🔑 Сменить пароль</button>' : '') + '</span>';
        var actionsHtml = (S.role === 'admin') ? '<button class="btn sm" data-action="edit-user" data-uid="' + u.id + '">Изменить</button> ' + fireBtn + delBtn : '<span style="color:#94a3b8;font-size:12.5px;">Доступно админу</span>';
        html += '<tr><td><div style="display:flex;align-items:center;gap:8px">' + avaHtml(u, 28, 10.5) + '<b>' + esc(u.full_name) + '</b>' + me + '</div></td><td style="font-family:monospace;font-weight:700;color:var(--blue);">' + esc(u.login) + '</td><td>' + (u.table_number ? '<span style="font-family:monospace;font-weight:700;">' + esc(u.table_number) + '</span>' : '<span style="color:#cbd5e1">—</span>') + '</td><td>' + passLabel + '</td><td>' + roleChip(u.role) + (u.prof ? '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + esc(u.prof) + '</div>' : '') + '</td><td>' + esc(u.area || '—') + '</td><td>' + (u.active ? '<span class="chip" style="background:#dcfce7;color:#15803d">активен</span>' : '<span class="chip" style="background:#fee2e2;color:#b91c1c">отключён</span>') + '</td><td style="white-space:nowrap;text-align:right">' + actionsHtml + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
      // 22.09-161: уволенные — без логина/пароля, с восстановлением (для истории задач запись остаётся)
      if (firedUsers.length) {
        html += '<div class="card" style="margin-top:14px"><div class="card-h"><h2>👤 Уволенные</h2><span class="sub">' + firedUsers.length + ' чел. · вход закрыт, логин/пароль убраны · в истории задач ФИО сохраняются</span></div><div class="card-b">';
        html += '<table class="dt"><thead><tr><th>ФИО</th><th>Таб. №</th><th>Дата увольнения</th><th>Роль</th><th>Участок</th>' + (S.role === 'admin' ? '<th style="text-align:right">Действия</th>' : '') + '</tr></thead><tbody>';
        firedUsers.forEach(function (u) {
          html += '<tr style="opacity:.78"><td><b>' + esc(u.full_name) + '</b></td><td>' + (u.table_number ? '<span style="font-family:monospace;font-weight:700;">' + esc(u.table_number) + '</span>' : '<span style="color:#cbd5e1">—</span>') + '</td><td>' + esc(fmtDmyIso(u.fired_date)) + '</td><td>' + roleChip(u.role) + '</td><td>' + esc(u.area || '—') + '</td>' + (S.role === 'admin' ? '<td style="white-space:nowrap;text-align:right"><button class="btn sm" data-action="restore-user" data-uid="' + u.id + '" title="Вернуть в штат: задаются новые логин и пароль">↩ Восстановить</button></td>' : '') + '</tr>';
        });
        html += '</tbody></table></div></div>';
      }
      var view = document.getElementById('view');
      if (view) view.innerHTML = html;
      var finput = document.getElementById('import-file');
      if (finput) {
        finput.onchange = function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          importDbFile(f);
          e.target.value = '';
        };
      }
      var rinput = document.getElementById('restore-file');
      if (rinput) {
        rinput.onchange = function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          restoreBackupFile(f);
          e.target.value = '';
        };
      }
    } catch (err) {
      console.error('renderUsers error:', err);
      var viewEl = document.getElementById('view');
      if (viewEl) viewEl.innerHTML = '<div class="card"><div class="card-b" style="color:var(--red);padding:20px;font-weight:600;">Ошибка отображения списка пользователей: ' + esc(err.message) + '</div></div>';
    }
  }

  /* ---------- 22.09-219: ЖУРНАЛ ИЗМЕНЕНИЙ (админ) ---------- */
  // История версий системы: дата · сборка · описание. Данные — SP_CHANGELOG (data.js).
  // ОТСЮДА И ДАЛЕЕ все новости сборок пишутся в SP_CHANGELOG, а не в шапку сайта.
  function renderChangelog() {
    var rows = (window.SP_CHANGELOG || []).slice().sort(function (a, b) { return (b.n - a.n); });
    var html = '<div class="card"><div class="card-h"><h2>Журнал изменений</h2><span class="sub">' + rows.length + ' сборок · новые сверху</span></div><div class="card-b">';
    html += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px;line-height:1.5">История версий системы SmartPlan: дата, номер сборки и что изменилось. Текущая сборка — в шапке любой страницы и на экране входа.</div>';
    html += '<table class="dt"><thead><tr><th style="white-space:nowrap">Дата</th><th>Сборка</th><th>Что изменилось</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      if (!r) return;
      var cur = ('22.09-' + r.n) === SP_BUILD;
      html += '<tr' + (cur ? ' style="background:#eff6ff"' : '') + '><td style="white-space:nowrap;color:var(--muted);font-size:12px">' + esc(r.d ? fmtDmyIso(r.d) : '—') + '</td>' +
        '<td style="white-space:nowrap;vertical-align:top"><b style="color:var(--blue)">22.09-' + r.n + '</b>' + (cur ? ' <span class="chip" style="background:#dcfce7;color:#15803d">текущая</span>' : '') + '</td>' +
        '<td style="font-size:12.5px;color:var(--ink);line-height:1.5">' + esc(r.t) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    var vw = document.getElementById('view');
    if (vw) vw.innerHTML = html;
  }

  // Запись действия в журнал (хранится на сервере; просмотр — «Журнал» у админа)
  function logAction(action, details) {
    // Сборка 22.09-25: используем SP_API.audit вместо старого /api/logs
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) return;
    var u = S.user || {};
    try {
      window.SP_API.audit(0, 0).then(function() {
        // Просто проверяем что endpoint доступен; реальная запись делается
        // на стороне сервера при каждом POST/PUT/DELETE через middleware/auth
      }).catch(function() {});
      // Запись в локальный буфер (для случая когда сервер недоступен)
      try {
        var buf = JSON.parse(localStorage.getItem('smartplan_local_logs') || '[]');
        buf.push({ ts: Date.now(), user: u.full_name || '', action: action, details: details || '' });
        if (buf.length > 200) buf = buf.slice(-200);
        localStorage.setItem('smartplan_local_logs', JSON.stringify(buf));
      } catch (e) {}
    } catch (e) {}
  }

  /* =====================================================================
     22.09-139: БЭКАПЫ БАЗ ДАННЫХ (Администрирование → Бэкапы БД)
     Каждая база — отдельный JSON-файл; при выборе 2+ — единый ZIP-архив
     (STORE; чтение .zip поддерживает и deflate). Восстановление из .json
     и/или .zip без потерь: локальная база заменяется содержимым файла,
     модуль перечитывается (reloadFromCloud), записи отправляются на сервер;
     записи, которых нет в файле, удаляются и с сервера.
     ===================================================================== */
  var DB_REGISTRY = [
    { key: 'users', ls: 'smartplan_users_db', sec: 'users', mod: 'SP_USERS_DB', icon: '👤', title: 'Пользователи (учётные записи)',
      valid: function (d) { return !!(d && Array.isArray(d.users)); },
      recs: function (d) { return (d && d.users) || []; } },
    { key: 'workers', ls: 'smartplan_workers_db', sec: 'workers', mod: 'SP_WORKERS', icon: '👷', title: 'Работники (графики смен, бригады)',
      valid: function (d) { return !!(d && d.workers && typeof d.workers === 'object'); },
      recs: function (d) {
        var w = (d && d.workers) || {}, out = [];
        Object.keys(w).forEach(function (k) { out.push(Object.assign({ id: k }, w[k])); });
        return out;
      } },
    { key: 'areas', ls: 'smartplan_areas_db', sec: 'areas', mod: 'SP_AREAS', icon: '🗂', title: 'Участки',
      valid: function (d) { return !!(d && Array.isArray(d.areas)); },
      recs: function (d) { return (d && d.areas) || []; } },
    { key: 'professions', ls: 'smartplan_professions_db', sec: 'professions', mod: 'SP_PROFS', icon: '🧰', title: 'Профессии',
      valid: function (d) { return !!(d && (Array.isArray(d.professions) || Array.isArray(d.profNames))); },
      recs: function (d) { return ((d && d.professions) || []).concat((d && d.profNames) || []); } },
    { key: 'works', ls: 'smartplan_work_catalog', sec: 'work_catalog', mod: 'SP_WORK', icon: '🛠', title: 'Виды работ (справочник)',
      valid: function (d) { return !!(d && d.areas && typeof d.areas === 'object'); },
      recs: function (d) {
        var out = [], a = (d && d.areas) || {};
        Object.keys(a).forEach(function (ar) { (a[ar] || []).forEach(function (w) { if (w) out.push(Object.assign({ area: ar }, w)); }); });
        return out;
      } },
    { key: 'objects', ls: 'smartplan_objects_db', sec: 'objects', mod: 'SP_OBJECTS', icon: '🏭', title: 'Объекты (ГРП/ШРП/ГРС/ПГРП)',
      valid: function (d) { return !!(d && Array.isArray(d.objects)); },
      recs: function (d) { return (d && d.objects) || []; } },
    { key: 'tasks', ls: 'smartplan_tasks_db', sec: 'tasks', mod: 'SP_TASKS', icon: '✅', title: 'Задачи (планирование)',
      valid: function (d) { return !!(d && Array.isArray(d.tasks)); },
      recs: function (d) { return (d && d.tasks) || []; } },
    { key: 'graphs', ls: 'smartplan_graphs', sec: 'graphs', mod: null, icon: '📊', title: 'Графики работ',
      valid: function (d) { return Array.isArray(d); },
      recs: function (d) { return Array.isArray(d) ? d.filter(function (g) { return g && g.id; }) : []; } },
    { key: 'holidays', ls: 'smartplan_holidays', sec: 'holidays', mod: null, icon: '🎉', title: 'Праздники',
      valid: function (d) { return Array.isArray(d); },
      recs: function (d) { return Array.isArray(d) ? d.filter(function (x) { return x && x.id; }) : []; } },
    { key: 'telemetry', ls: 'smartplan_telemetry', sec: 'telemetry', mod: null, icon: '📡', title: 'Виды телеметрии',
      valid: function (d) { return Array.isArray(d); },
      recs: function (d) { return Array.isArray(d) ? d.filter(function (x) { return x && x.id; }) : []; } },
    { key: 'logs', ls: 'smartplan_local_logs', sec: null, mod: null, icon: '📜', title: 'Журнал действий (локальный буфер)',
      valid: function (d) { return Array.isArray(d); },
      recs: function (d) { return Array.isArray(d) ? d : []; } },
    { key: 'errlogs', ls: 'smartplan_errors', sec: null, mod: null, icon: '🐞', title: 'Логи ошибок',
      valid: function (d) { return Array.isArray(d); },
      recs: function (d) { return Array.isArray(d) ? d : []; } }
  ];
  function dbRegByKey(key) { for (var i = 0; i < DB_REGISTRY.length; i++) if (DB_REGISTRY[i].key === key) return DB_REGISTRY[i]; return null; }
  function dbReadLS(entry) { try { var r = localStorage.getItem(entry.ls); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function dbFmtSize(chars) {
    if (chars < 1024) return chars + ' Б';
    if (chars < 1024 * 1024) return (chars / 1024).toFixed(1) + ' КБ';
    return (chars / 1048576).toFixed(2) + ' МБ';
  }
  function backupFileName(entry) { return 'smartplan_' + entry.key + '.json'; }
  /* Собрать файлы бэкапа по выбранным ключам (каждая база — свой файл с
     служебным заголовком: тип базы, дата выгрузки, число записей). */
  function backupCollectFiles(keys) {
    var files = [];
    DB_REGISTRY.forEach(function (entry) {
      if (keys && keys.indexOf(entry.key) === -1) return;
      var data = dbReadLS(entry);
      if (data == null) return; // база отсутствует — пропускаем
      var wrapper = { app: 'SmartPlan', type: 'db-backup', v: 2, dbKey: entry.key, title: entry.title,
        exportedAt: new Date().toISOString(), count: entry.recs(data).length, data: data };
      files.push({ name: backupFileName(entry), bytes: window.SP_ZIP.strToBytes(JSON.stringify(wrapper, null, 1)) });
    });
    return files;
  }
  function backupYmd() {
    var d = new Date();
    function p2(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '' + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes());
  }
  function downloadBlob(name, bytes, type) {
    try {
      if (!window.URL || !window.URL.createObjectURL || typeof Blob === 'undefined') { toast('err', 'Скачивание файлов не поддерживается браузером'); return; }
      var blob = new Blob([bytes], { type: type || 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 900);
    } catch (e) { toast('err', 'Не удалось скачать файл: ' + ((e && e.message) || e)); }
  }
  /* Скачать бэкап: 1 база — файл .json; 2 и больше — ZIP-архив. */
  function backupDownload(keys) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var files = backupCollectFiles(keys);
    if (!files.length) { toast('warn', 'Нечего выгружать — выбранные базы пусты'); return; }
    var ymd = backupYmd();
    if (files.length === 1) {
      downloadBlob(files[0].name.replace(/\.json$/, '_' + ymd + '.json'), files[0].bytes, 'application/json');
      toast('ok', '💾 База выгружена одним файлом: ' + files[0].name);
    } else {
      var zip = window.SP_ZIP.zipBuildStore(files);
      downloadBlob('smartplan_backup_' + ymd + '.zip', zip, 'application/zip');
      toast('ok', '💾 Бэкап готов: ' + files.length + ' баз упаковано в ZIP-архив');
    }
    try { logAction('Бэкап БД', files.map(function (f) { return f.name; }).join(', ')); } catch (e) {}
  }

  /* ---------- Восстановление ---------- */
  function backupParseText(fname, text, into, errors) {
    var obj = null;
    try { obj = JSON.parse(text); } catch (e) { errors.push(fname + ': не JSON-файл'); return; }
    if (!obj || obj.app !== 'SmartPlan' || obj.type !== 'db-backup' || !obj.dbKey) { errors.push(fname + ': не файл бэкапа SmartPlan'); return; }
    var entry = dbRegByKey(obj.dbKey);
    if (!entry) { errors.push(fname + ': неизвестная база «' + obj.dbKey + '»'); return; }
    if (!entry.valid(obj.data)) { errors.push(fname + ': структура данных базы «' + entry.title + '» не подошла'); return; }
    into[entry.key] = { entry: entry, name: fname, count: entry.recs(obj.data).length, data: obj.data, exportedAt: obj.exportedAt || '' };
  }
  function backupScanFiles(fileList) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var into = {}, errors = [];
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () {
        return new Promise(function (resolve) {
          var isZip = /\.zip$/i.test(f.name);
          var fr = new FileReader();
          fr.onload = function () {
            try {
              if (isZip) {
                var arr = window.SP_ZIP.zipReadStore(new Uint8Array(fr.result));
                var found = 0;
                arr.forEach(function (z) {
                  if (/\.json$/i.test(z.name)) { found++; backupParseText(f.name + ' → ' + z.name, window.SP_ZIP.bytesToStr(z.bytes), into, errors); }
                });
                if (!found) errors.push(f.name + ': в архиве нет файлов .json');
              } else {
                backupParseText(f.name, String(fr.result), into, errors);
              }
            } catch (e) { errors.push(f.name + ': ' + ((e && e.message) || e)); }
            resolve();
          };
          fr.onerror = function () { errors.push(f.name + ': не удалось прочитать файл'); resolve(); };
          if (isZip) fr.readAsArrayBuffer(f); else fr.readAsText(f, 'utf-8');
        });
      });
    });
    chain.then(function () { openBackupRestoreModal(into, errors); });
  }
  var BACKUP_PENDING = null;
  function openBackupRestoreModal(into, errors) {
    var keys = Object.keys(into);
    var h = '<div class="modal-h"><h3>📥 Восстановление из бэкапа</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    if (errors && errors.length) {
      h += '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:12px;color:#991b1b;margin-bottom:10px">⚠ ' + errors.map(esc).join('<br>⚠ ') + '</div>';
    }
    if (!keys.length) {
      h += '<div class="empty" style="padding:24px 10px">Подходящих баз SmartPlan в выбранных файлах не найдено.</div></div>' +
        '<div class="modal-f"><button class="btn" data-action="close-modal">Закрыть</button></div>';
      modal.innerHTML = h; overlay.classList.add('show'); return;
    }
    h += '<table class="dt" style="margin-bottom:10px"><thead><tr><th>База данных</th><th style="text-align:right">в файле</th><th style="text-align:right">сейчас</th><th>выгружена</th></tr></thead><tbody>';
    keys.forEach(function (k) {
      var p = into[k];
      var cur = dbReadLS(p.entry);
      var curCnt = cur == null ? 0 : p.entry.recs(cur).length;
      var dt = p.exportedAt ? String(p.exportedAt).replace('T', ' ').slice(0, 16) : '—';
      h += '<tr><td>' + p.entry.icon + ' <b>' + esc(p.entry.title) + '</b><div style="font-size:12px;color:var(--muted)">' + esc(p.name) + '</div></td>' +
        '<td style="text-align:right">' + p.count + '</td><td style="text-align:right">' + curCnt + '</td><td style="font-size:12px;color:var(--muted)">' + esc(dt) + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;font-size:12px;color:#92400e;line-height:1.5">⚠ <b>Восстановление без потерь:</b> данные этих баз будут полностью заменены содержимым файлов — на устройстве и на сервере. Записей, которых нет в файлах, после восстановления не останется. Действие необратимо.</div>';
    h += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn danger" data-action="backup-restore-go">Восстановить: ' + keys.length + ' ' + (keys.length === 1 ? 'базу' : keys.length < 5 ? 'базы' : 'баз') + '</button></div>';
    BACKUP_PENDING = into;
    modal.innerHTML = h; overlay.classList.add('show');
  }
  /* Применить восстановление (без DOM): локальная замена + перечитка модулей
     + сервер (upsert всех записей файла; удаление записей, которых в файле нет). */
  var BACKUP_RESTORE_ORDER = ['users', 'workers', 'areas', 'professions', 'works', 'objects', 'telemetry', 'holidays', 'graphs', 'tasks', 'logs', 'errlogs'];
  function backupApplyAll(pending) {
    var res = { dbs: 0, ups: 0, dels: 0, fails: 0, offline: false };
    var byKey = {};
    Object.keys(pending || {}).forEach(function (k) { byKey[k] = pending[k]; });
    function runOne(pack) {
      var entry = pack.entry, data = pack.data;
      try {
        var oldData = dbReadLS(entry);
        try { localStorage.setItem(entry.ls, JSON.stringify(data)); } catch (eLS) { res.fails++; return; }
        try {
          var mod = entry.mod && window[entry.mod];
          if (mod && typeof mod.reloadFromCloud === 'function') mod.reloadFromCloud(data);
        } catch (eR) {}
        if (entry.key === 'telemetry') { try { telemetrySyncSelects(); } catch (eT) {} }
        res.dbs++;
        if (!entry.sec || !(window.SP_API && SP_API.getToken && SP_API.getToken())) { res.offline = true; return; }
        var newIds = {};
        entry.recs(data).forEach(function (r) {
          if (!r || r.id == null) return;
          newIds[r.id] = 1; res.ups++;
          try { Promise.resolve(SP_API.upsert(entry.sec, r)).catch(function () { res.fails++; }); } catch (eU) { res.fails++; }
        });
        entry.recs(oldData).forEach(function (r) {
          if (!r || r.id == null || newIds[r.id]) return;
          res.dels++;
          try { Promise.resolve(SP_API.del(entry.sec, r.id)).catch(function () { res.fails++; }); } catch (eD) { res.fails++; }
        });
      } catch (e) { res.fails++; }
    }
    BACKUP_RESTORE_ORDER.forEach(function (k) { if (byKey[k]) { runOne(byKey[k]); delete byKey[k]; } });
    Object.keys(byKey).forEach(function (k) { runOne(byKey[k]); });
    return res;
  }
  function backupRestoreGo() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    if (!BACKUP_PENDING) return;
    var pending = BACKUP_PENDING; BACKUP_PENDING = null;
    overlay.classList.remove('show');
    var res = backupApplyAll(pending);
    try { logAction('Восстановление БД из бэкапа', 'баз: ' + res.dbs + ', отправлено записей: ' + res.ups + ', удалено: ' + res.dels); } catch (e) {}
    toast(res.fails ? 'warn' : 'ok', '📥 Восстановлено баз: ' + res.dbs + ' · записей на сервер: ' + res.ups + (res.dels ? ' · удалено с сервера: ' + res.dels : '') + (res.offline ? ' · сервер недоступен — данные восстановлены локально' : '') + (res.fails ? ' · ошибок: ' + res.fails : ''));
    if (S.screen === 'backup') renderBackup();
  }

  /* ---------- СТРАНИЦА ---------- */
  function renderBackup() {
    if (S.role !== 'admin') { view.innerHTML = '<div class="card"><div class="card-b"><div class="empty">Страница доступна только администратору.</div></div></div>'; return; }
    var html = '<div class="card"><div class="card-h"><h2>💾 Бэкапы баз данных</h2><span class="sub">Каждая база — отдельный файл · выбрано 2 и больше — единый ZIP-архив</span><div class="spacer"></div></div><div class="card-b">';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">' +
      '<button type="button" class="btn primary" data-action="backup-dl-sel">💾 Скачать выбранные</button>' +
      '<button type="button" class="btn" data-action="backup-dl-all">📦 Скачать ВСЕ базы (ZIP)</button>' +
      '<span style="width:1px;height:20px;background:var(--line);margin:0 4px"></span>' +
      '<button type="button" class="btn" data-action="backup-restore" style="background:#166534;color:#fff;border-color:#15803d">📥 Восстановить из файлов…</button>' +
      '<button type="button" class="btn sm ghost" data-action="backup-check-all">выбрать все</button>' +
      '<button type="button" class="btn sm ghost" data-action="backup-check-none">снять выбор</button>' +
      '</div>';
    // 22.09-255: восстановление видов работ из копии этого браузера
    var _wrc = wrLoad();
    if (_wrc) {
      var _wrn = wrCount(wrDiffs());
      html += '<div class="calc wr-card" style="margin-bottom:14px;align-items:center;gap:10px;flex-wrap:wrap;line-height:1.5">♻ <b>Восстановление видов работ из копии этого браузера</b>' +
        '<span style="color:var(--muted)">(копия сохранена ' + esc(wrFmtTs(_wrc.taken)) + ')</span>' +
        (_wrn ? '<span>отличий от сервера: <b>' + _wrn + '</b></span><button type="button" class="btn sm primary" data-action="wr-open">👀 Посмотреть и восстановить</button>'
          : '<span style="color:#166534">совпадает с сервером</span>') +
        '<button type="button" class="btn sm ghost" data-action="wr-drop">🗑 Удалить копию</button></div>';
    }
    html += '<table class="dt"><thead><tr><th style="width:34px"></th><th>База данных</th><th>Ключ хранения</th><th style="text-align:right">Записей</th><th style="text-align:right">Объём</th></tr></thead><tbody>';
    DB_REGISTRY.forEach(function (entry) {
      var d = dbReadLS(entry);
      var cnt = d == null ? 0 : entry.recs(d).length;
      var sz = 0; try { sz = (localStorage.getItem(entry.ls) || '').length; } catch (e) {}
      html += '<tr>' +
        '<td><label class="cb" style="margin:0"><input type="checkbox" data-bk="' + entry.key + '"' + (d != null ? ' checked' : '') + '></label></td>' +
        '<td>' + entry.icon + ' <b>' + esc(entry.title) + '</b></td>' +
        '<td style="color:var(--muted);font-size:12px">' + esc(entry.ls) + '</td>' +
        '<td style="text-align:right">' + (d == null ? '—' : cnt) + '</td>' +
        '<td style="text-align:right;color:var(--muted);font-size:12.5px">' + (d == null ? 'пусто' : dbFmtSize(sz)) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    html += '<input type="file" id="backup-file" multiple accept=".json,.zip,application/json,application/zip" style="display:none">';
    html += '<div class="calc" style="margin-top:12px;font-size:12.5px;align-items:flex-start;line-height:1.55">Как это работает: каждая база выгружается отдельным JSON-файлом (внутри — служебный заголовок с типом базы, датой выгрузки и числом записей). Если баз 2 и больше — файлы упаковываются в один ZIP-архив, открывающийся любым архиватором. <b>Восстановление</b> принимает файлы .json, .zip или сразу несколько файлов: данные баз заменяются содержимым файлов на устройстве и на сервере — перенос происходит без потерь (при повреждённом архиве контрольная сумма не сойдётся и восстановление не выполнится).</div>';
    html += '</div></div>';
    view.innerHTML = html;
    var inp = document.getElementById('backup-file');
    if (inp) inp.addEventListener('change', function () { backupScanFiles(inp.files); try { inp.value = ''; } catch (e) {} });
  }

  /* =====================================================================
     22.09-255: ВОССТАНОВЛЕНИЕ ВИДОВ РАБОТ ИЗ КОПИИ ЭТОГО БРАУЗЕРА.
     До 22.09-254 браузер со старой копией затирал на сервере свежие настройки видов работ и
     норм времени. Новая версия при первом запуске сохраняет копию каталога этого браузера ДО
     синхронизации (work_db.js → smartplan_work_recovery). Здесь её сравнивают с сервером и
     возвращают выбранные виды работ (сразу у всех). Окно появляется у администратора после
     входа, пока копия отличается от сервера; доступно и на странице «Бэкапы баз данных».
     ===================================================================== */
  var WR_KEY = 'smartplan_work_recovery';
  var WR_FIELDS = [
    ['name', 'название'], ['group', 'группа'], ['norm', 'норма времени, чел.-ч'], ['unit', 'единица'], ['crew', 'состав бригады'],
    ['crew_size', 'исполнителей'], ['min_workers', 'мин. исполнителей'], ['opt_workers', 'опт. исполнителей'], ['season', 'сезон'],
    ['min_temp', 'мин. t°C'], ['needs_permit', 'ордер-допуск'], ['depends_on_snow', 'зависит от снега'], ['equipment', 'техника'],
    ['object_categories', 'категории объектов'], ['lines_count', 'линий редуцирования'], ['periodicity_value', 'периодичность'],
    ['periodicity_unit', 'единица периодичности'], ['periodicity_dev', 'отклонение, дн.'], ['periodicity_basis', 'отсчёт периодичности'],
    ['periodicity_depends_on', 'зависит от работ'], ['joint_with', 'проводится совместно'], ['telemetry_req', 'телеметрия'],
    ['telemetry_type', 'тип телеметрии'], ['heating_req', 'отопление'], ['diag_equipment', 'приборная диагностика'],
    ['group_flags', 'свойства группы'], ['operations', 'операции'], ['indicators', 'показатели'], ['departments', 'подразделения'],
    ['print_forms', 'печатные формы'], ['op_journal', 'оперативный журнал'], ['passport_entry', 'эксплуатационный паспорт'], ['scan_attach', 'сканы']
  ];
  // значение для сравнения: пустые ([], '', null, 0, false) равны; порядок полей не важен
  function wrNormVal(v) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '';
    if (typeof v === 'number') return v === 0 ? '' : String(v);
    if (typeof v === 'boolean') return v ? '1' : '';
    if (Array.isArray(v)) return v.map(function (x) { return (x && typeof x === 'object') ? Object.keys(x).sort().map(function (k) { return k + ':' + JSON.stringify(x[k]); }).join(',') : JSON.stringify(x); }).sort().join('|');
    if (typeof v === 'object') return (window.SP_API && SP_API.canon) ? SP_API.canon(v) : JSON.stringify(v);
    return String(v);
  }
  function wrShowVal(f, v) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return '—';
    if (f === 'crew' && Array.isArray(v)) return v.map(function (c) { return c ? (c.count || 1) + '× ' + (c.prof || '?') + (c.grade ? ' (' + c.grade + ' р.)' : '') : ''; }).join(' + ');
    if (typeof v === 'boolean') return v ? 'да' : 'нет';
    if (Array.isArray(v)) return v.map(function (x) { return typeof x === 'object' ? JSON.stringify(x) : String(x); }).join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }
  function wrLoad() { try { var r = JSON.parse(localStorage.getItem(WR_KEY) || 'null'); return r && Array.isArray(r.copies) ? r : null; } catch (e) { return null; } }
  function wrFmtTs(ts) { try { return ts ? new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; } catch (e) { return ''; } }
  // отличия копий от текущего (после синхронизации — серверного) каталога
  function wrDiffs() {
    var rc = wrLoad(); if (!rc) return null;
    var cur = {};
    try { WORK.getAreas().forEach(function (a) { WORK.getWorks(a).forEach(function (w) { if (w && w.id) cur[w.id] = { area: a, w: w }; }); }); } catch (e) { return null; }
    var FACT = {}; try { FACT = (WORK.factoryWorks && WORK.factoryWorks()) || {}; } catch (eF) {}
    function isFactory(cw) { // в копии — заводской вариант работы (не настройки пользователя): не предлагаем
      var fw = FACT[cw.id];
      return !!fw && WR_FIELDS.every(function (fd) { return cw[fd[0]] === undefined || wrNormVal(cw[fd[0]]) === wrNormVal(fw[fd[0]]); });
    }
    var out = [];
    rc.copies.forEach(function (c, ci) {
      var items = [];
      Object.keys(c.areas || {}).forEach(function (area) {
        (Array.isArray(c.areas[area]) ? c.areas[area] : []).forEach(function (cw) {
          if (!cw || !cw.id || isFactory(cw)) return;
          var sv = cur[cw.id];
          if (!sv) { items.push({ id: cw.id, area: area, name: cw.name || cw.id, missing: true, rec: cw, fields: [] }); return; }
          var fields = [];
          WR_FIELDS.forEach(function (fd) {
            if (wrNormVal(cw[fd[0]]) !== wrNormVal(sv.w[fd[0]])) fields.push({ f: fd[0], label: fd[1], srv: sv.w[fd[0]], copy: cw[fd[0]] });
          });
          if (fields.length) items.push({ id: cw.id, area: sv.area, name: cw.name || sv.w.name || cw.id, missing: false, rec: cw, fields: fields });
        });
      });
      if (items.length) out.push({ ci: ci, src: c.src, ts: c.ts, taken: rc.taken, items: items });
    });
    return out;
  }
  function wrCount(list) { return (list || []).reduce(function (a, c) { return a + c.items.length; }, 0); }
  function wrDrop() {
    spConfirm('Удалить сохранённую в этом браузере копию видов работ?\nВернуть её будет нельзя (данные на сервере не изменятся).', { title: 'Удалить копию', ok: 'Удалить', danger: true }, function () {
      try { localStorage.removeItem(WR_KEY); } catch (e) {}
      toast('ok', '🗑 Копия видов работ удалена');
      try { if (S.screen === 'backup') renderBackup(); } catch (e) {}
    });
  }
  function wrRestore(picked) {
    if (!picked.length) { toast('warn', 'Ничего не отмечено'); return; }
    if (!(window.SP_API && SP_API.getToken && SP_API.getToken() && SP_API.upsert)) { toast('err', 'Нет связи с сервером — восстановить сейчас нельзя'); return; }
    var okN = 0, failN = 0, got = [];
    Promise.all(picked.map(function (it) {
      var rec = Object.assign({}, it.rec, { area: it.area });
      return Promise.resolve(SP_API.upsert('work_catalog', rec)).then(function (res) {
        if (res && res.ok) { okN++; if (res.record) got.push(res.record); } else failN++;
      }, function () { failN++; });
    })).then(function () {
      try { if (got.length && window.SP_SYNC_POLL && SP_SYNC_POLL.applyRemote) SP_SYNC_POLL.applyRemote('work_catalog', got); } catch (e) {}
      try { logAction('Восстановление видов работ из копии браузера', 'восстановлено: ' + okN + (failN ? ', не удалось: ' + failN : '')); } catch (e) {}
      toast(failN ? 'warn' : 'ok', '♻ Восстановлено видов работ: ' + okN + (failN ? ' · не удалось: ' + failN + ' — повторите' : ' — они уже у всех пользователей'));
      try { refresh(); } catch (e) {}
    });
  }
  function openWorkRecovery(ci) {
    var all = wrDiffs() || [];
    if (!all.length) { toast('ok', 'Копия видов работ в этом браузере совпадает с сервером — восстанавливать нечего'); return; }
    var c = all[0];
    if (ci != null) all.forEach(function (x) { if (x.ci === ci) c = x; });
    var SRC = { local: 'данные этого браузера', autobackup: 'автоснимок при входе', prev: 'снимок перед обновлением сайта' };
    var sel = c.items.map(function (it) { return !it.missing; });
    var h = '<p>В этом браузере сохранилась другая версия видов работ и норм времени (' + esc(SRC[c.src] || c.src) +
      (c.ts ? ', последнее обновление — ' + esc(wrFmtTs(c.ts)) : '') + '). Отличий от сервера: <b>' + c.items.length + '</b>.</p>' +
      '<p class="wr-hint">Зачёркнуто — как сейчас на сервере, жирным — как в копии. Отметьте виды работ, которые нужно вернуть: они сразу обновятся у всех пользователей.</p>';
    if (all.length > 1) h += '<div class="wr-tools">' + all.map(function (x) { return '<button type="button" class="btn sm' + (x === c ? ' primary' : '') + '" data-wr-copy="' + x.ci + '">' + esc(SRC[x.src] || x.src) + ' (' + x.items.length + ')</button>'; }).join('') + '</div>';
    h += '<div class="wr-tools"><button type="button" class="btn sm" data-wr-all="1">отметить все</button><button type="button" class="btn sm" data-wr-none="1">снять отметки</button></div>';
    h += '<div class="wr-list">' + c.items.map(function (it, i) {
      return '<label class="wr-item"><input type="checkbox" data-wr-i="' + i + '"' + (sel[i] ? ' checked' : '') + '><div><b>' + esc(it.name) + '</b> <span class="wr-area">· ' + esc(it.area) + '</span>' +
        (it.missing ? '<div class="wr-f">на сервере нет (удалён) — будет создан заново</div>'
          : it.fields.map(function (fd) { return '<div class="wr-f">' + esc(fd.label) + ': <s>' + esc(wrShowVal(fd.f, fd.srv)) + '</s> → <b>' + esc(wrShowVal(fd.f, fd.copy)) + '</b></div>'; }).join('')) +
        '</div></label>';
    }).join('') + '</div>';
    spDialog('', {
      title: 'Восстановление видов работ', icon: '♻', html: h, cancel: 'Закрыть',
      choices: [{ label: '♻ Восстановить отмеченные', value: 'restore', cls: 'primary' }, { label: '🗑 Удалить копию', value: 'drop', cls: 'danger' }]
    }, function (v) {
      if (v === 'restore') wrRestore(c.items.filter(function (it, i) { return sel[i]; }));
      else if (v === 'drop') wrDrop();
    });
    var ov = document.getElementById('sp-dlg');
    if (!ov || !ov.querySelector) return;
    var box = ov.querySelector('.sp-dlg-box'); if (box) box.style.width = 'min(820px,100%)';
    ov.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.getAttribute) return;
      var i = t.getAttribute('data-wr-i'); if (i != null) sel[+i] = t.checked === true;
    });
    ov.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-wr-all],[data-wr-none],[data-wr-copy]') : null;
      if (!t) return;
      e.stopPropagation();
      if (t.hasAttribute('data-wr-copy')) { openWorkRecovery(+t.getAttribute('data-wr-copy')); return; }
      var on = t.hasAttribute('data-wr-all');
      Array.prototype.forEach.call(ov.querySelectorAll('[data-wr-i]'), function (cb) { cb.checked = on; sel[+cb.getAttribute('data-wr-i')] = on; });
    });
  }
  // после входа администратора (когда получены данные с сервера): копия отличается — предложить
  function workRecoveryNotify() {
    if (S.role !== 'admin' || S.wrAsked) return;
    var all = wrDiffs(); var n = wrCount(all);
    if (!n) return;
    S.wrAsked = true;
    spChoice('В этом браузере сохранилась другая версия видов работ и норм времени — ' + n + ' отличий от сервера.\n' +
      'Если ваши настройки видов работ пропали, их можно вернуть отсюда: посмотрите отличия и отметьте, что восстановить.',
      { title: 'Найдена копия видов работ', icon: '♻', choices: [{ label: '👀 Посмотреть', value: 'open', cls: 'primary' }], cancel: 'Позже' },
      function (v) { if (v === 'open') openWorkRecovery(); });
  }

  /* =====================================================================
     РЕНДЕР: ЖУРНАЛ ДЕЙСТВИЙ (только администратор)
     ===================================================================== */
  function renderLogs() {
    view.innerHTML = '<div class="card"><div class="card-b"><div class="empty">Загрузка журнала...</div></div></div>';
    // Сборка 22.09-25: проверяем токен SP_API вместо старого isServerOnline
    var hasToken = !!(window.SP_API && window.SP_API.getToken && window.SP_API.getToken());
    if (!hasToken) {
      view.innerHTML = '<div class="card"><div class="card-b"><div class="empty">⚠ Войдите на сайт — журнал действий хранится на сервере Render.<br><br><span style="font-size:12px">Статус сервера: нет авторизации</span></div></div></div>';
      return;
    }
    window.SP_API.audit(500, 0).then(function(r) {
      if (!r || !r.ok) throw new Error((r && r.err) || 'HTTP error');
      renderLogsContent((r && r.records) || []);
    })['catch'](function(err) {
      view.innerHTML = '<div class="card"><div class="card-b"><div style="padding:20px;color:var(--red);font-size:13px">' +
        '<b>⚠ Ошибка загрузки журнала</b><br><br>' +
        'Причина: ' + esc(err.message || 'неизвестна') + '<br><br>' +
        '<span style="color:var(--muted);font-size:12px">Возможно, сервер нужно обновить (redeploy) или таблица audit_log ещё не создана в базе данных.</span>' +
        '</div></div></div>';
    });
  }

  /* =====================================================================
     РЕНДЕР: ЛОГИ ОШИБОК — ОБЩИЙ список со всех устройств (сервер),
     локальный лог устройства — только резерв при недоступном сервере.
     ===================================================================== */
  function renderErrLogs() {
    var hasApi = !!(window.SP_API && SP_API.getToken && SP_API.getToken() && SP_API.errorsGet);
    if (!hasApi) {
      renderErrLogsTable((window.SP_ERRORS && SP_ERRORS.getAll) ? SP_ERRORS.getAll() : [], {
        sub: 'записей на ЭТОМ устройстве: ',
        shared: false,
        note: '⚠ Нет связи с сервером — показан локальный лог ЭТОГО устройства. ' +
          'Он сам уйдёт в общий список, как только появится связь и вход на сайт.'
      });
      return;
    }
    view.innerHTML = '<div class="card"><div class="card-h"><h2>🐞 Логи ошибок</h2></div>' +
      '<div class="card-b"><div class="empty">⏳ Загружаю общий лог ошибок со всех устройств…</div></div></div>';
    SP_API.errorsGet(500, 0).then(function (r) {
      if (r && r.ok) {
        renderErrLogsTable(r.records || [], { sub: 'записей со всех устройств: ', shared: true, note: '' });
      } else {
        renderErrLogsTable((window.SP_ERRORS && SP_ERRORS.getAll) ? SP_ERRORS.getAll() : [], {
          sub: 'записей на ЭТОМ устройстве: ',
          shared: false,
          note: '⚠ Не удалось загрузить общий лог с сервера (' + esc((r && r.err) || 'ошибка') + ') — ' +
            'показан локальный лог ЭТОГО устройства.'
        });
      }
    })['catch'](function (e) {
      renderErrLogsTable((window.SP_ERRORS && SP_ERRORS.getAll) ? SP_ERRORS.getAll() : [], {
        sub: 'записей на ЭТОМ устройстве: ',
        shared: false,
        note: '⚠ Не удалось загрузить общий лог с сервера (' + esc(e && e.message || e) + ') — ' +
          'показан локальный лог ЭТОГО устройства.'
      });
    });
  }

  function renderErrLogsTable(logs, opts) {
    var html = '<div class="card"><div class="card-h"><h2>🐞 Логи ошибок</h2>' +
      '<span class="sub">' + esc(opts.sub) + logs.length + '</span>' +
      '<div class="spacer"></div>' +
      '<button class="btn sm" data-action="clear-errlogs" style="color:var(--red)">🗑 ' + (opts.shared ? 'Очистить общий лог' : 'Очистить') + '</button>' +
      '<button class="btn sm" data-action="test-errlog">+ Тестовая ошибка</button>' +
      '</div><div class="card-b">';
    if (opts.note) {
      html += '<div style="margin-bottom:12px;padding:10px 12px;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;font-size:12.5px;color:#92400e">' + esc(opts.note) + '</div>';
    }
    if (!logs.length) {
      html += '<div class="empty">✅ Ошибок нет. Все чисто.</div>';
    } else {
      // Фильтры по уровню
      html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">';
      html += '<select id="err-filter-level" style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card)">';
      html += '<option value="">Все уровни</option>';
      html += '<option value="error">Только ошибки</option>';
      html += '<option value="warn">Предупреждения</option>';
      html += '<option value="info">Информация</option>';
      html += '</select>';
      html += '<input type="text" id="err-search" placeholder="Поиск по сообщению, месту, пользователю или устройству..." style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;flex:1;min-width:180px">';
      html += '</div>';
      // Таблица
      html += '<table class="dt"><thead><tr><th style="width:150px">Время</th>';
      if (opts.shared) html += '<th style="width:210px">Устройство</th>';
      html += '<th style="width:80px">Уровень</th><th>Где</th><th>Сообщение</th></tr></thead><tbody>';
      logs.forEach(function (l) {
        var lvl = l.level || 'error';
        var lvlColor = lvl === 'error' ? '#dc2626' : (lvl === 'warn' ? '#f59e0b' : '#16a34a');
        var ts = (window.SP_ERRORS && SP_ERRORS.fmtTs) ? SP_ERRORS.fmtTs(l.ts) : new Date(l.ts).toISOString();
        var extra = l.extra ? ('<div style="font-size:12px;color:var(--muted);margin-top:3px;font-family:monospace">' +
          esc((typeof l.extra === 'string' ? l.extra : JSON.stringify(l.extra)).substring(0, 200)) + '</div>') : '';
        var stack = l.stack ? ('<details style="margin-top:5px"><summary style="cursor:pointer;color:var(--blue);font-size:12px">stack</summary>' +
          '<pre style="font-size:12px;background:var(--panel-3);padding:6px 8px;border-radius:6px;overflow-x:auto;margin-top:5px;color:var(--muted)">' +
          esc((l.stack || '').substring(0, 1500)) + '</pre></details>') : '';
        var who = '';
        if (opts.shared) {
          var whoName = l.user_name || l.user_login || 'это устройство';
          who = '<td style="font-size:12.5px;line-height:1.35"><div style="font-weight:600">' + esc(whoName) + '</div>' +
            '<div style="color:var(--muted);font-size:12px">' + esc(l.device || 'устройство не указано') + '</div>' +
            (l.build ? '<div style="color:var(--muted);font-size:11.5px;font-family:monospace">💻 ' + esc(l.build) + '</div>' : '') +
            '</td>';
        }
        html += '<tr class="err-row" data-level="' + esc(lvl) + '" data-search="' +
          esc(((l.where || '') + ' ' + (l.msg || '') + ' ' + (l.user_name || '') + ' ' + (l.user_login || '') + ' ' + (l.device || '')).toLowerCase()) + '">';
        html += '<td style="white-space:nowrap;font-size:12.5px;color:var(--muted);font-family:monospace">' + esc(ts) + '</td>';
        html += who;
        html += '<td><span style="display:inline-block;padding:1px 7px;background:' + lvlColor + ';color:#fff;border-radius:3px;font-size:11.5px;font-weight:700">' + esc(lvl.toUpperCase()) + '</span></td>';
        html += '<td style="font-size:12px;font-family:monospace;word-break:break-all">' + esc(l.where || '?') + '</td>';
        html += '<td style="font-size:12.5px"><div>' + esc(l.msg || '') + '</div>' + extra + stack + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div></div>';
    view.innerHTML = html;
    // Привязка фильтров
    var fLevel = document.getElementById('err-filter-level');
    var fSearch = document.getElementById('err-search');
    function applyFilter() {
      var lv = fLevel && typeof fLevel.value === 'string' ? fLevel.value : '';
      var sv = fSearch && typeof fSearch.value === 'string' ? fSearch.value.toLowerCase() : '';
      view.querySelectorAll('.err-row').forEach(function (row) {
        var okLevel = !lv || row.dataset.level === lv;
        var okSearch = !sv || row.dataset.search.indexOf(sv) !== -1;
        row.style.display = (okLevel && okSearch) ? '' : 'none';
      });
    }
    if (fLevel && fLevel.addEventListener) fLevel.addEventListener('change', applyFilter);
    if (fSearch && fSearch.addEventListener) fSearch.addEventListener('input', applyFilter);
    // Кнопка очистки
    var btnClear = view.querySelector('[data-action="clear-errlogs"]');
    if (btnClear) btnClear.addEventListener('click', function () {
      if (opts.shared) {
        return spConfirm('Очистить ОБЩИЙ лог ошибок на сервере? Он удалится у ВСЕХ устройств сразу.', { title: 'Общий лог ошибок', ok: 'Очистить', danger: true }, function () { // 22.09-244: оформленное окно
        Promise.resolve(SP_API.errorsClear()).then(function () {
          if (window.SP_ERRORS && SP_ERRORS.clear) SP_ERRORS.clear(); // и локальный резерв
          toast('ok', 'Общий лог ошибок очищен');
          renderErrLogs();
        });
        });
      } else {
        return spConfirm('Очистить весь локальный лог ошибок этого устройства?', { title: 'Лог ошибок', ok: 'Очистить', danger: true }, function () { // 22.09-244: оформленное окно
        if (window.SP_ERRORS && SP_ERRORS.clear) SP_ERRORS.clear();
        toast('ok', 'Лог ошибок очищен');
        renderErrLogs();
        });
      }
    });
    // Кнопка тестовой ошибки
    var btnTest = view.querySelector('[data-action="test-errlog"]');
    if (btnTest) btnTest.addEventListener('click', function () {
      try {
        throw new Error('Тестовая ошибка из UI ' + new Date().toLocaleTimeString('ru-RU'));
      } catch (e) {
        if (window.SP_ERRORS && SP_ERRORS.log) {
          SP_ERRORS.log('error', 'ui.test', e.message, { stack: e.stack });
          if (SP_ERRORS.push) SP_ERRORS.push(); // сразу уходит в общий список
        }
        if (typeof setTimeout === 'function') setTimeout(function () { renderErrLogs(); }, 600);
      }
    });
  }

  // Надёжный разбор даты журнала: created_at из PostgreSQL BIGINT приходит СТРОКОЙ
  function parseLogDate(v) {
    if (v == null) return null;
    if (typeof v === 'number') { var dn = new Date(v); return isNaN(dn.getTime()) ? null : dn; }
    var str = String(v);
    if (/^\d+$/.test(str)) { var dn2 = new Date(parseInt(str, 10)); return isNaN(dn2.getTime()) ? null : dn2; }
    var d = new Date(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str) ? str.replace(' ', 'T') : str);
    return isNaN(d.getTime()) ? null : d;
  }

  function renderLogsContent(logs) {
    var users = {}, actions = {};
    logs.forEach(function(l) {
      if (l.user_name) users[l.user_name] = 1;
      if (l.action) actions[l.action] = 1;
    });
    var userList = Object.keys(users).sort();
    var actionList = Object.keys(actions).sort();

    var html = '<div class="card"><div class="card-h"><h2>\uD83D\uDCCB Журнал действий</h2><span class="sub">' + logs.length + ' записей</span><div class="spacer"></div>' + (S.role === 'admin' ? '<button class="btn sm" id="btn-clear-logs" style="color:var(--red)">Очистить журнал</button>' : '') + '</div>';
    html += '<div class="card-b">';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">';
    html += '<select id="log-filter-user" style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card)"><option value="">Все пользователи</option>';
    userList.forEach(function(u) { html += '<option value="' + esc(u) + '">' + esc(u) + '</option>'; });
    html += '</select>';
    html += '<select id="log-filter-action" style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card)"><option value="">Все действия</option>';
    actionList.forEach(function(a) { html += '<option value="' + esc(a) + '">' + esc(a) + '</option>'; });
    html += '</select>';
    html += '<input type="text" id="log-search" placeholder="Поиск..." style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;flex:1;min-width:150px">';
    html += '</div>';
    html += '<table class="dt"><thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Детали</th></tr></thead><tbody>';
    logs.forEach(function(l) {
      var d = parseLogDate(l.ts || l.created_at);
      var dStr = d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ' ' + d.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : '\u2014';
      html += '<tr class="log-row" data-user="' + esc(l.user_name || '') + '" data-action="' + esc(l.action || '') + '" data-details="' + esc(l.details || '') + '">';
      html += '<td style="white-space:nowrap;font-size:12px;color:var(--muted)">' + dStr + '</td>';
      html += '<td style="font-weight:600">' + esc(l.user_name || '\u2014') + '</td>';
      html += '<td>' + esc(l.action || '\u2014') + '</td>';
      html += '<td style="font-size:12px;color:var(--muted)">' + esc(l.details || '') + '</td>';
      html += '</tr>';
    });
    if (!logs.length) html += '<tr><td colspan="4" class="empty">Записей нет</td></tr>';
    html += '</tbody></table>';
    html += '</div></div>';
    view.innerHTML = html;

    var fu = document.getElementById('log-filter-user');
    var fa = document.getElementById('log-filter-action');
    var fs = document.getElementById('log-search');
    function applyFilter() {
      var uv = fu ? fu.value.toLowerCase() : '';
      var av = fa ? fa.value.toLowerCase() : '';
      var sv = fs ? fs.value.toLowerCase() : '';
      document.querySelectorAll('.log-row').forEach(function(row) {
        var match = (!uv || (row.dataset.user || '').toLowerCase().indexOf(uv) !== -1) &&
                    (!av || (row.dataset.action || '').toLowerCase().indexOf(av) !== -1) &&
                    (!sv || (row.dataset.user + ' ' + row.dataset.action + ' ' + row.dataset.details).toLowerCase().indexOf(sv) !== -1);
        row.style.display = match ? '' : 'none';
      });
    }
    if (fu) fu.addEventListener('change', applyFilter);
    if (fa) fa.addEventListener('change', applyFilter);
    if (fs) fs.addEventListener('input', applyFilter);
    var clearBtn = document.getElementById('btn-clear-logs');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      return spConfirm('Очистить весь журнал действий?', { title: 'Журнал действий', ok: 'Очистить', danger: true }, function () { // 22.09-244: оформленное окно
      // Сборка 22.09-25: через SP_API
      if (window.SP_API && window.SP_API._request) {
        window.SP_API._request('DELETE', '/audit').then(function() { toast('ok', 'Журнал очищен'); renderLogs(); });
      }
      });
    });
  }

  function openUserModal(mode, uid) {
    S.userModalMode = mode; S.userModalUid = uid;
    var u = mode !== 'new' ? DB.getUser(uid) : null;
    var title = mode === 'new' ? 'Новый пользователь' : mode === 'pwd' ? 'Смена пароля' : 'Редактирование пользователя';
    var h = '<div class="modal-h"><h3>' + title + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    if (mode === 'pwd') {
      h += '<div class="fld"><label>Пользователь</label><input value="' + esc(u.full_name) + ' (' + esc(u.login) + ')" disabled></div>';
      h += '<div class="fld"><label>Новый пароль</label><input id="um-pass" type="password" placeholder="••••••"></div>';
      h += '<div class="fld"><label>Повторите пароль</label><input id="um-pass2" type="password" placeholder="••••••"></div>';
    } else {
      h += '<div class="fld"><label>ФИО</label><input id="um-name" value="' + (u ? esc(u.full_name) : '') + '" placeholder="Иванов И.И."></div>';
      h += '<div class="fld"><label>Логин</label><input id="um-login" value="' + (u ? esc(u.login) : '') + '" placeholder="ivanov"></div>';
      // 22.09-258: табельный номер работника — задаёт администратор вручную; только цифры; уникален
      h += '<div class="fld"><label>Табельный номер <span style="font-weight:400;color:#64748b;font-size:12px;">(только цифры; по нему в будущем отслеживаются действия работника)</span></label><input id="um-tabel" inputmode="numeric" pattern="[0-9]*" value="' + (u && u.table_number ? esc(u.table_number) : '') + '" placeholder="12345" autocomplete="off"><div id="um-tabel-err" style="display:none;font-size:12px;color:var(--red);margin-top:4px"></div></div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="fld"><label>Роль <span style="font-weight:400;color:#64748b;font-size:12px;">(должность из штатного списка)</span></label><select id="um-role">';
      // базовые роли системы + профессии штатного списка (без повторов)
      // старое название (до переименования) → новое
      var _uprof = (u && u.prof === 'Заместитель начальника службы') ? 'Заместитель начальника СЭОГС' : (u && u.prof);
      var _hasExtra = _uprof && ROLE_EXTRA.some(function (x) { return x.label === _uprof; });
      Object.keys(ROLE_INFO).forEach(function (r) {
        var sel = _hasExtra ? false : (u ? u.role === r : r === 'master');
        h += '<option value="' + r + '"' + (sel ? ' selected' : '') + '>' + ROLE_INFO[r].label + '</option>';
      });
      h += '<option value="" disabled>— профессии (штатный список) —</option>';
      ROLE_EXTRA.forEach(function (x) {
        h += '<option value="' + esc(x.label) + '"' + (_hasExtra && _uprof === x.label ? ' selected' : '') + ' title="Права: ' + esc(ROLE_INFO[x.key].label) + '">' + esc(x.label) + '</option>';
      });
      h += '</select></div><div class="fld"><label>Участок</label><select id="um-area">';
      var _uAreas = areasList();
      // участок пользователя может отсутствовать в справочнике (старые данные) — добавляем его в список
      if (u && u.area && _uAreas.indexOf(u.area) === -1) _uAreas.push(u.area);
      _uAreas.forEach(function (a) { h += '<option value="' + esc(a) + '"' + (u && u.area === a ? ' selected' : '') + '>' + esc(a) + '</option>'; });
      h += '</select></div></div>';
      if (mode === 'new') {
        h += '<div class="fld"><label>Пароль (обязательно)</label><input id="um-pass" type="password" placeholder="••••••"></div>';
      } else {
        h += '<div class="fld"><label>Новый пароль <span style="font-weight:400;color:#64748b;font-size:12px;">(оставьте пустым, если не меняется)</span></label><input id="um-pass" type="text" placeholder="Введите новый пароль"></div>';
      }
      h += '<div class="fld"><label class="cb"><input type="checkbox" id="um-active" ' + (u ? (u.active ? 'checked' : '') : 'checked') + '> Учётная запись активна</label></div>';
      // 22.09-219: фото-аватар работника (загрузка админом; применяется сразу, без «Сохранить»)
      if (mode === 'edit' && u) {
        h += '<div class="fld" style="margin-top:6px"><label>Фото работника <span style="font-weight:400;color:#64748b;font-size:12px">(кружок-аватар по всей системе)</span></label>' +
          '<div style="display:flex;align-items:center;gap:12px">' +
          '<span id="um-ava-preview" style="width:64px;height:64px;border-radius:50%;background:' + ((u && u.color) || '#94a3b8') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;flex:0 0 auto;overflow:hidden">' + (u.avatar ? '<img src="' + u.avatar + '" style="width:100%;height:100%;object-fit:cover;display:block">' : esc(initials(u.full_name))) + '</span>' +
          '<div id="um-ava-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn sm" data-action="um-ava-upload" title="Выбрать файл с фото (jpg/png); автоматически уменьшится до 128×128">📷 ' + (u.avatar ? 'Заменить фото' : 'Загрузить фото') + '</button>' +
          (u.avatar ? '<button class="btn sm" data-action="um-ava-remove" style="color:var(--red);border-color:var(--red)" title="Убрать фото — кружок снова покажет инициалы">Удалить фото</button>' : '') +
          '</div></div>' +
          '<input type="file" id="um-ava-file" accept="image/*" style="display:none">' +
          '<div style="font-size:12px;color:var(--muted)">Фото уменьшится автоматически и сохранится сразу (кнопку «Сохранить» нажимать не нужно) — появится в карточках «Графиков смен», «Работников» и в шапке справа вверху.</div></div>';
      }
    }
    h += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-user">Сохранить</button></div>';
    modal.style.maxWidth = ''; // сброс автоширины карточки задачи
    modal.innerHTML = h; overlay.classList.add('show');
    // 22.09-258: в табельном номере — только цифры (лишние символы не вставляются)
    var _umTabel = document.getElementById('um-tabel');
    if (_umTabel) _umTabel.addEventListener('input', function () {
      var v = _umTabel.value.replace(/\D/g, '');
      if (v !== _umTabel.value) _umTabel.value = v;
    });
    var _umAvaFile = document.getElementById('um-ava-file'); // 22.09-219
    if (_umAvaFile) _umAvaFile.onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) avaAttachFromFile(S.userModalUid, f);
    };
  }
  function saveUser() {
    var mode = S.userModalMode, uid = S.userModalUid;
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    if (mode === 'pwd') {
      var p = val('um-pass'), p2 = val('um-pass2');
      if (!p) { toast('err', 'Введите новый пароль'); return; }
      if (p !== p2) { toast('err', 'Пароли не совпадают'); return; }
      DB.updateUser(uid, { password: p }).then(function () { overlay.classList.remove('show'); toast('ok', 'Пароль изменён'); refresh(); }, function (e) { toast('err', e.message); });
      return;
    }
    var full_name = val('um-name'), login = val('um-login'), area = val('um-area');
    // 22.09-258: табельный номер — только цифры; у двух работников один номер быть не может
    var tabel = (function () { var el = document.getElementById('um-tabel'); return el ? el.value.replace(/\D/g, '') : ''; })();
    var _tErr = document.getElementById('um-tabel-err');
    if (_tErr) _tErr.style.display = 'none';
    if (tabel) {
      var dup = null;
      (DB.getUsers() || []).forEach(function (x) { if (x && x.id !== uid && x.table_number && String(x.table_number) === tabel) dup = x; });
      if (dup) {
        if (_tErr) { _tErr.textContent = 'Этот номер уже у работника: ' + dup.full_name + (dup.fired ? ' (уволен)' : ''); _tErr.style.display = ''; }
        toast('err', 'Табельный номер «' + tabel + '» уже занят: ' + dup.full_name);
        return;
      }
    }
    var _roleSel = val('um-role') === 'Заместитель начальника службы' ? 'Заместитель начальника СЭОГС' : val('um-role'); // старое название → новое
    var role = roleKeyOfSel(_roleSel);   // базовая роль или роль профессии
    var profTitle = roleProfOfSel(_roleSel); // название профессии (для базовых ролей — пусто)
    var active = document.getElementById('um-active') ? document.getElementById('um-active').checked : true;
    if (!full_name || !login) { toast('err', 'Заполните ФИО и логин'); return; }
    var op;
    if (mode === 'new') {
      var pw = val('um-pass');
      if (!pw) { toast('err', 'Укажите пароль'); return; }
      op = DB.addUser({ full_name: full_name, login: login, password: pw, role: role, area: area, active: active, prof: profTitle, table_number: tabel });
    } else {
      var updateData = { full_name: full_name, login: login, role: role, area: area, active: active, prof: profTitle, table_number: tabel };
      var newPw = val('um-pass');
      if (newPw) {
        updateData.password = newPw;
      }
      op = DB.updateUser(uid, updateData);
    }
    op.then(function () {
      overlay.classList.remove('show');
      logAction(mode === 'new' ? 'Добавление пользователя' : 'Изменение пользователя', full_name);
      toast('ok', mode === 'new' ? 'Пользователь добавлен' : (val('um-pass') ? '✓ Пользователь и пароль изменены' : '✓ Пользователь обновлён'));
      if (uid === S.user.id) { S.user = DB.getUser(uid); applyUser(); }
      refresh();
    }, function (e) { toast('err', e.message); });
  }
  // 22.09-219: файл фото → уменьшение до 128×128 (квадрат по центру) → сохранение в учётку
  function avaAttachFromFile(uid, file) {
    if (S.role !== 'admin') { toast('err', 'Фото загружает только администратор'); return; }
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('err', 'Файл слишком большой (больше 15 МБ)'); return; }
    try {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var sz = 128;
            var cv = document.createElement('canvas');
            cv.width = sz; cv.height = sz;
            var cx = cv.getContext('2d');
            if (!cx) throw new Error('холст недоступен');
            var s = Math.min(img.width, img.height);
            cx.drawImage(img, Math.round((img.width - s) / 2), Math.round((img.height - s) / 2), s, s, 0, 0, sz, sz);
            saveUserAvatar(uid, cv.toDataURL('image/jpeg', 0.85));
          } catch (e) { toast('err', 'Не удалось обработать фото: ' + (e && e.message)); }
        };
        img.onerror = function () { toast('err', 'Это не файл изображения'); };
        img.src = fr.result;
      };
      fr.onerror = function () { toast('err', 'Не удалось прочитать файл'); };
      fr.readAsDataURL(file);
    } catch (e) { toast('err', 'Фото не загружено: ' + (e && e.message)); }
  }
  function saveUserAvatar(uid, dataUrl) {
    var u = DB.getUser(uid); if (!u) { toast('err', 'Пользователь не найден'); return; }
    DB.updateUser(uid, { avatar: dataUrl || null }).then(function () {
      try { // стандартных (seed) пользователей модуль на сервер не отправляет — фото отправляем сами
        if (window.SP_API && SP_API.getToken && SP_API.getToken() && SP_API.upsert) {
          var su = Object.assign({}, DB.getUser(uid) || {}, { password: undefined, plain_password: undefined });
          SP_API.upsert('users', su).catch(function () {});
        }
      } catch (e) {}
      try { logAction('Пользователи: фото', u.full_name + (dataUrl ? ' — установлено' : ' — удалено')); } catch (e) {}
      if (S.user && S.user.id === uid) { try { S.user = DB.getUser(uid); applyUser(); } catch (e) {} }
      umAvaPreviewRefresh(uid);
      toast('ok', dataUrl ? '✓ Фото сохранено — показывается в кружках работника' : '✓ Фото удалено');
      if (S.screen === 'users') renderUsers(); else refresh();
    }, function (e) { toast('err', (e && e.message) || 'Ошибка сохранения фото'); });
  }
  function umAvaPreviewRefresh(uid) {
    var u = DB.getUser(uid); if (!u) return;
    var pv = document.getElementById('um-ava-preview');
    if (pv) pv.innerHTML = u.avatar ? '<img src="' + u.avatar + '" style="width:100%;height:100%;object-fit:cover;display:block">' : esc(initials(u.full_name));
    var ac = document.getElementById('um-ava-actions');
    if (ac) ac.innerHTML = '<button class="btn sm" data-action="um-ava-upload" title="Выбрать файл с фото (jpg/png); автоматически уменьшится до 128×128">📷 ' + (u.avatar ? 'Заменить фото' : 'Загрузить фото') + '</button>' +
      (u.avatar ? '<button class="btn sm" data-action="um-ava-remove" style="color:var(--red);border-color:var(--red)" title="Убрать фото — кружок снова покажет инициалы">Удалить фото</button>' : '');
  }
  function delUser(uid) {
    var u = DB.getUser(uid); if (!u) return;
    return spConfirm('Удалить пользователя «' + u.full_name + '»?', { title: 'Удаление пользователя', ok: 'Удалить', danger: true }, function () { // 22.09-244: оформленное окно
    try { DB.deleteUser(uid); toast('ok', 'Пользователь удалён'); refresh(); }
    catch (e) { toast('err', e.message); }
    });
  }

  /* ---------- 22.09-161: УВОЛЬНЕНИЕ / ВОССТАНОВЛЕНИЕ ---------- */
  function openFireUserModal(uid) {
    var u = DB.getUser(uid); if (!u) return;
    S.fireModalUid = uid;
    var roleLbl = (ROLE_INFO[u.role] || { label: u.role }).label;
    var todayIso = key(new Date());
    // объекты, за которые он сейчас ответственный (снимется с них в дату увольнения)
    var respObjs = [];
    try { if (window.SP_OBJECTS && SP_OBJECTS.getObjects) respObjs = SP_OBJECTS.getObjects().filter(function (o) { return o && o.respId === uid; }); } catch (e) {}
    var h = '<div class="modal-h"><h3>Увольнение работника</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    h += '<div class="fld"><label>Работник</label><input value="' + esc(u.full_name + ' · ' + (u.prof || roleLbl)) + '" disabled></div>';
    h += '<div class="fld"><label>Дата увольнения</label><input id="fu-date" type="date" value="' + todayIso + '"></div>';
    h += '<div style="background:var(--panel-3);border:1px solid var(--line);border-radius:10px;padding:11px 13px;font-size:12.5px;color:#475569;line-height:1.55">' +
      'После увольнения:<br>• вход в систему закрывается, логин и пароль убираются;<br>• работник исчезает со страницы «Работники» и не предлагается в новые задачи и графики;<br>• в выполненных задачах и в истории ответственных его ФИО сохраняется;<br>• внизу списка пользователей появится блок «Уволенные» — оттуда работника можно восстановить.</div>';
    if (respObjs.length) {
      var names = respObjs.slice(0, 5).map(function (o) { return String(o.type || '') + (o.num ? '-' + o.num : ''); }).join(', ');
      h += '<div style="margin-top:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:11px 13px;font-size:12.5px;color:#92400e;line-height:1.55">⚠ <b>' + esc(u.full_name) + '</b> — ответственный за объектов: <b>' + respObjs.length + '</b>' + (names ? ' (' + esc(names) + (respObjs.length > 5 ? ' и др.' : '') + ')' : '') + '.<br>До даты увольнения включительно он остаётся ответственным (либо пока вы не назначите другого в карточке объекта), затем снимается автоматически — объект остаётся без ответственного до назначения нового.</div>';
    }
    h += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="confirm-fire-user" style="background:#dc2626;border-color:#dc2626">Уволить</button></div>';
    modal.style.maxWidth = '';
    modal.innerHTML = h; overlay.classList.add('show');
  }
  function confirmFireUser() {
    var uid = S.fireModalUid, u = uid ? DB.getUser(uid) : null;
    if (!u) { overlay.classList.remove('show'); return; }
    var el = document.getElementById('fu-date');
    var d = el ? el.value : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast('err', 'Укажите дату увольнения'); return; }
    try { DB.fireUser(uid, d); }
    catch (e) { toast('err', e.message); return; }
    S.fireModalUid = null;
    overlay.classList.remove('show');
    var removed = reconcileFiredResponsibles();
    logAction('Увольнение работника', u.full_name + ' · дата ' + fmtDmyIso(d));
    toast('ok', '✓ ' + u.full_name + ' уволен с ' + fmtDmyIso(d) + (removed ? ' · снят с объектов: ' + removed : ''));
    refresh();
  }
  function openRestoreUserModal(uid) {
    var u = DB.getUser(uid); if (!u) return;
    S.restoreModalUid = uid;
    var roleLbl = (ROLE_INFO[u.role] || { label: u.role }).label;
    var h = '<div class="modal-h"><h3>Восстановление работника</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    h += '<div class="fld"><label>Работник</label><input value="' + esc(u.full_name + ' · ' + (u.prof || roleLbl)) + '" disabled></div>';
    h += '<div class="fld"><label>Новый логин</label><input id="ru-login" placeholder="например, ivanov"></div>';
    h += '<div class="fld"><label>Новый пароль</label><input id="ru-pass" type="text" placeholder="например, ivanov123"></div>';
    h += '<div style="font-size:12px;color:var(--muted);line-height:1.5">После восстановления работник снова появится на странице «Работники», сможет входить в систему и выбираться в задачи. Роль, участок и профессия сохранены прежними.</div>';
    h += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="confirm-restore-user">Восстановить</button></div>';
    modal.style.maxWidth = '';
    modal.innerHTML = h; overlay.classList.add('show');
  }
  function confirmRestoreUser() {
    var uid = S.restoreModalUid, u = uid ? DB.getUser(uid) : null;
    if (!u) { overlay.classList.remove('show'); return; }
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    var login = val('ru-login'), pw = val('ru-pass');
    if (!login || !pw) { toast('err', 'Заполните логин и пароль'); return; }
    DB.restoreUser(uid, login, pw).then(function () {
      S.restoreModalUid = null;
      overlay.classList.remove('show');
      logAction('Восстановление работника', u.full_name + ' · логин «' + login + '»');
      toast('ok', '✓ ' + u.full_name + ' восстановлен (логин «' + login + '»)');
      refresh();
    }, function (e) { toast('err', (e && e.message) || String(e)); });
  }
  // 22.09-161: снятие уволенных мастеров с объектов ПО ДАТЕ увольнения —
  // до даты (или ручной замены) остаются ответственными, в дату снимаются,
  // запись в истории закрывается датой увольнения. Вызывается при обновлении экрана.
  function reconcileFiredResponsibles() {
    var changed = 0;
    try {
      if (!window.SP_OBJECTS || !SP_OBJECTS.getObjects || !SP_OBJECTS.updateObject) return 0;
      var todayIso = key(new Date());
      SP_OBJECTS.getObjects().forEach(function (o) {
        if (!o || !o.respId) return;
        var u = DB.getUser(o.respId);
        if (!u || u.fired !== true || !u.fired_date || u.fired_date > todayIso) return;
        var hist = (Array.isArray(o.respHistory) ? o.respHistory : []).map(function (x) { return Object.assign({}, x); });
        // закрыть открытую запись этого работника датой увольнения
        hist.forEach(function (x) { if (x.to == null && x.uid === o.respId) x.to = u.fired_date; });
        // updateObject сам обновит плоские respId/respName: текущим станет
        // другая открытая запись (если есть) или «не назначен»
        SP_OBJECTS.updateObject(o.id, { respHistory: hist });
        changed++;
      });
    } catch (e) {}
    return changed;
  }

  /* ---------- ЭКСПОРТ / ИМПОРТ БАЗЫ УЧЁТОК (Excel) ---------- */
  function exportDb() {
    if (!window.XLSX) { ensureXlsxRetry(exportDb); return; } // ленивая загрузка xlsx
    var users = DB.getUsers() || [];
    var data = [];
    // 22.09-241: пароли не выгружаются — столбец пустой; заполните его, только если при загрузке нужно задать новый пароль
    // 22.09-258: колонка «Табельный номер» — при загрузке файла номер обновится
    data.push(['ФИО', 'Логин', 'Табельный номер', 'Новый пароль (заполнить только для смены)', 'Роль', 'Участок', 'Статус', 'Действия']);
    users.forEach(function (u) {
      if (!u) return;
      var roleName = (ROLE_INFO[u.role] || { label: u.role }).label;
      var status = u.active ? 'активен' : 'отключён';
      data.push([u.full_name || '', u.login || '', u.table_number || '', '', roleName, u.area || '—', status, '']);
    });
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Пользователи');
    var fileName = 'База_пользователей_' + key(TODAY) + '.xlsx';
    try {
      XLSX.writeFile(wb, fileName);
      toast('ok', '📥 Скачан файл: ' + fileName + ' (' + users.length + ' записей)');
    } catch (err) {
      console.error('Ошибка Excel:', err);
      toast('err', 'Ошибка: ' + err.message);
    }
  }

  function importDbFile(file) {
    if (!window.XLSX) { ensureXlsxRetry(function () { importDbFile(file); }); return; } // ленивая загрузка xlsx
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length < 2) { toast('warn', 'Файл пуст'); return; }

        // Поиск столбцов по заголовкам
        var headers = rows[0].map(function (h) { return String(h || '').toLowerCase().trim(); });
        var idxName = -1, idxLogin = -1, idxTabel = -1, idxPass = -1, idxRole = -1, idxArea = -1, idxStatus = -1;
        headers.forEach(function (h, i) {
          if (h.indexOf('фио') !== -1 || h.indexOf('имя') !== -1) idxName = i;
          else if (h.indexOf('логин') !== -1) idxLogin = i;
          else if (h.indexOf('табел') !== -1) idxTabel = i; // 22.09-258
          else if (h.indexOf('пароль') !== -1) idxPass = i;
          else if (h.indexOf('роль') !== -1) idxRole = i;
          else if (h.indexOf('участ') !== -1) idxArea = i;
          else if (h.indexOf('статус') !== -1) idxStatus = i;
        });
        if (idxLogin === -1) { toast('err', 'Не найден столбец «Логин»'); return; }
        if (idxName === -1) idxName = 0;
        if (idxPass === -1) idxPass = 2;
        if (idxRole === -1) idxRole = 3;
        if (idxArea === -1) idxArea = 4;
        if (idxStatus === -1) idxStatus = 5;

        // Обратный словарь ролей
        var roleMap = {};
        Object.keys(ROLE_INFO).forEach(function (r) { roleMap[ROLE_INFO[r].label.toLowerCase()] = r; });

        // 22.09-244: вопрос — оформленным окном с понятными кнопками (раньше «ОК / Отмена» с пояснением в тексте)
        spChoice('Как загрузить пользователей из Excel?\n\n• «Обновить и добавить» — изменить существующих и добавить новых\n• «Только добавить новых» — существующих не трогать', {
          title: 'Импорт пользователей из Excel', icon: '📥',
          choices: [{ label: 'Обновить и добавить', value: true, cls: 'primary' }, { label: 'Только добавить новых', value: false, cls: 'ok' }]
        }, function (replace) {
        try {

        var existingUsers = DB.getUsers();
        var added = 0, updated = 0, failed = 0; // 22.09-258: failed — строки, которые сервер отклонил (например, чужой табельный номер)
        var pending = 0;
        var noPass = []; // 22.09-241: новые без пароля — не созданы

        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          if (!row || !row.length) continue;
          var fullName = String(row[idxName] != null ? row[idxName] : '').trim();
          var login = String(row[idxLogin] != null ? row[idxLogin] : '').trim();
          if (!login) continue;

          // 22.09-241: пустой пароль — у существующих пароль НЕ меняется (раньше затирался на «admin123»),
          // новый пользователь без пароля не создаётся (будет в отчёте)
          var password = String(row[idxPass] != null ? row[idxPass] : '').trim();
          var roleName = String(row[idxRole] != null ? row[idxRole] : '').trim().toLowerCase();
          var role = roleMap[roleName] || 'master';
          var area = String(row[idxArea] != null ? row[idxArea] : '').trim();
          if (area === '—' || area === '') area = '';
          var statusStr = String(row[idxStatus] != null ? row[idxStatus] : '').trim().toLowerCase();
          var active = statusStr.indexOf('актив') !== -1 || statusStr === '';
          // 22.09-258: табельный номер (только цифры; пустая ячейка в новом формате — снять номер)
          var tabel = idxTabel >= 0 ? String(row[idxTabel] != null ? row[idxTabel] : '').replace(/\D/g, '') : undefined;

          // Поиск существующего
          var existing = null;
          for (var j = 0; j < existingUsers.length; j++) {
            if (existingUsers[j].login.toLowerCase() === login.toLowerCase()) { existing = existingUsers[j]; break; }
          }

          if (existing && replace) {
            pending++;
            var _upd = { full_name: fullName || existing.full_name, login: login, role: role, area: area, active: active };
            if (password) _upd.password = password;
            if (tabel !== undefined) _upd.table_number = tabel;
            DB.updateUser(existing.id, _upd).then(function () { updated++; }).catch(function () { failed++; });
          } else if (!existing) {
            if (!password) { noPass.push(login); continue; } // 22.09-241
            pending++;
            var _newData = { full_name: fullName || login, login: login, password: password, role: role, area: area, active: active };
            if (tabel !== undefined) _newData.table_number = tabel;
            DB.addUser(_newData).then(function () { added++; }).catch(function () { failed++; });
          }
        }

        toast('ok', '✓ Импорт запущен: добавляется ' + (pending) + ' записей');
        if (noPass.length) toast('warn', '⚠ Не добавлены (не указан пароль в столбце «Новый пароль»): ' + noPass.slice(0, 8).join(', ') + (noPass.length > 8 ? ' и ещё ' + (noPass.length - 8) : ''));
        setTimeout(function() {
          if (failed) toast('warn', 'Готово: добавлено ' + added + ', обновлено ' + updated + ' · не удалось: ' + failed + ' (проверьте, что табельные номера не заняты другими работниками)');
          else toast('ok', 'Готово: добавлено ' + added + ', обновлено ' + updated);
          refresh();
        }, 1500);
        } catch (err2) {
          console.error('Ошибка импорта Excel:', err2);
          toast('err', 'Ошибка импорта: ' + err2.message);
        }
        });
      } catch (err) {
        console.error('Ошибка импорта Excel:', err);
        toast('err', 'Ошибка чтения Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

