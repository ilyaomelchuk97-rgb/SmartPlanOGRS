  /* ── часть 06 · app/06_workers.js — разрешения, работники, бригады, графики смен и их редактор ── */
  /* =====================================================================
     РЕНДЕР: РАЗРЕШЕНИЯ (встраиваемая страница на весь экран)
     ===================================================================== */
  /* =====================================================================
     СТРАНИЦА «РАБОТНИКИ» (v2)
     ------------------------------------------------------------
     Карточка в списке — компактный квадрат (ФИО + профессия); клик
     открывает ПОЛНУЮ карточку в модалке (время 8/12 ч, график 5/2-2/2,
     бригада, календарь отсутствий, комментарий). Карточки слесарей
     ПЕРЕТАСКИВАЮТСЯ в бригады мастеров (HTML5 drag&drop + тач).
     Меняют настройки: администратор (все), начальник участка и старший
     мастер — только свой участок. Данные: workers_db.js (SP_WORKERS).
     ===================================================================== */
  function wkRoleLabel(r) {
    // 22.09-106: неизвестная рабочая роль — берём подпись из ROLE_INFO (admin → Администратор,
    // engineer → Инженер, viewer → Начальник СЭОГС); «Слесарь» — только как последний фолбэк.
    return r === 'nach' ? 'Начальник участка' : r === 'smaster' ? 'Старший мастер' : r === 'master' ? 'Мастер' : (ROLE_INFO[r] ? ROLE_INFO[r].label : 'Слесарь');
  }
  // Работники, видимые на странице:
  //  · админ и СЭОГС (нач. СЭОГС / зам) — ВСЕ участки (с фильтром дашборда);
  //  · нач. участка / ст. мастер — свой участок (или выбранный на дашборде — только просмотр);
  //  · мастер — ТОЛЬКО своя бригада (он + его слесари) + свободные слесари своего участка;
  //  · слесарь — страница недоступна.
  function wkVisibleUsers() {
    var us = DB.getUsers().filter(function (u) {
      return u && u.active !== false && ['nach', 'smaster', 'engineer', 'master', 'slesar'].indexOf(u.role) !== -1;
    });
    if (S.role === 'admin' || S.role === 'viewer') {
      return us.filter(function (u) { return !dashAreaActive() || u.area === S.dashArea; });
    }
    if (S.role === 'master') {
      return us.filter(function (u) {
        if (u.id === (S.user && S.user.id)) return true; // сам мастер
        if (u.role !== 'slesar' || !S.user || u.area !== S.user.area) return false;
        var b = wkData(u.id).brigade;
        return !b || b === S.user.id; // его слесари + свободные слесари участка
      });
    }
    return us.filter(function (u) {
      if (dashAreaActive()) return u.area === S.dashArea; // участок выбран на дашборде
      return S.user && u.area === S.user.area;            // свой участок (nach / smaster)
    });
  }
  // Право менять настройки работника:
  //  · админ — все;
  //  · нач. участка / ст. мастер — работники СВОЕГО участка;
  //  · мастер — только сам и слесари СВОЕЙ бригады;
  //  · СЭОГС (начальник и заместитель) — только просмотр, менять ничего нельзя.
  function wkCanEdit(u) {
    if (!u) return false;
    if (S.role === 'admin') return true;
    if (S.role === 'viewer' || S.role === 'slesar') return false;
    if (S.role === 'nach' || S.role === 'smaster' || S.role === 'engineer') return !!(S.user && u.area === S.user.area);
    if (S.role === 'master') {
      return !!(S.user && (u.id === S.user.id || (u.role === 'slesar' && wkData(u.id).brigade === S.user.id)));
    }
    return false;
  }
  // Право ПЕРЕНОСА слесаря в бригаду (targetMasterId = '' → «без бригады»):
  // мастер может брать в свою бригаду свободных слесарей своего участка
  // и убирать из своей; чужие бригады ему недоступны.
  function wkCanMoveTo(slesar, targetMasterId) {
    if (!slesar || slesar.role !== 'slesar') return false;
    if (S.role === 'admin') return true;
    if (S.role === 'viewer') return false;
    if (S.role === 'nach' || S.role === 'smaster' || S.role === 'engineer') return wkCanEdit(slesar); // свой участок
    if (S.role === 'master' && S.user) {
      var cur = wkData(slesar.id).brigade;
      if (targetMasterId === S.user.id) return slesar.area === S.user.area && (!cur || cur === S.user.id);
      if (targetMasterId === '') return cur === S.user.id; // убрать из своей бригады
      return false;
    }
    return false;
  }
  // Карточку слесаря можно перетаскивать?
  function wkCardDraggable(u) {
    if (!u || u.role !== 'slesar') return false;
    if (wkCanEdit(u)) return true; // админ / нач. участка / ст. мастер / своя бригада мастера
    if (S.role === 'master' && S.user && u.area === S.user.area) {
      var b = wkData(u.id).brigade;
      return !b || b === S.user.id; // свободных своего участка — в свою бригаду
    }
    return false;
  }
  function wkMonth() {
    if (!S.wkMonth) S.wkMonth = { y: TODAY.getFullYear(), m: TODAY.getMonth() };
    return S.wkMonth;
  }
  // Период для «Графики смен»: month или year. S.schRange = 'month' | 'year'.
  function wkShiftMonth(dn) {
    var wm = wkMonth();
    var d = new Date(wm.y, wm.m + dn, 1);
    S.wkMonth = { y: d.getFullYear(), m: d.getMonth() };
    // месяц переключён в открытой карточке → перерисовать модалку, иначе страницу
    if (S.wkModalUid && overlay.classList.contains('show')) openWkCardModal(S.wkModalUid);
    else renderWorkers();
  }
  // Перенос слесаря перетаскиванием: masterId = '' → без бригады
  function wkDropSlesar(uid, masterId) {
    try {
      var u = DB.getUser(uid);
      if (!u || u.role !== 'slesar') return;
      if (!wkCanMoveTo(u, masterId)) { toast('err', 'Нет прав на этот перенос'); renderWorkers(); return; }
      if (masterId) {
        var m = DB.getUser(masterId);
        if (!m || m.role !== 'master') return;
        if (window.SP_WORKERS) SP_WORKERS.setWorker(uid, { brigade: masterId });
        toast('ok', '✓ ' + u.full_name + ' — в бригаду мастера ' + m.full_name);
      } else {
        if (window.SP_WORKERS) SP_WORKERS.setWorker(uid, { brigade: null });
        toast('ok', '✓ ' + u.full_name + ' — убран(а) из бригады');
      }
      logAction('Работники: перенос в бригаду', u.full_name + (masterId ? ' → мастер ' + DB.getUser(masterId).full_name : ' → без бригады'));
      renderWorkers();
    } catch (e) { /* перенос не может ломать страницу */ }
  }

  // Компактная карточка: квадрат со скруглёнными краями, ФИО + профессия.
  // Клик → полная карточка; карточки слесарей — draggable (перетащить в бригаду).
  function wkCardHtml(u, masters) {
    var can = wkCanEdit(u);
    var isSlesar = u.role === 'slesar';
    var draggable = wkCardDraggable(u); // перетаскивание — по своим правилам (мастер: свободных в свою бригаду)
    var absToday = wkIsAbsent(u.id, 0);
    // подсказка про перетаскивание — только пока слесарь не в бригаде
    var wd0 = wkData(u.id);
    var inBrigade = isSlesar && wd0.brigade && (masters || []).some(function (m) { return m.id === wd0.brigade; });
    return '<div class="wk-card" data-action="wk-open-card" data-uid="' + esc(u.id) + '" title="Открыть карточку работника"' +
      (draggable ? ' draggable="true"' : '') +
      ' style="flex:0 0 auto;width:168px;min-height:116px;border:1px solid var(--line);border-bottom:4px solid ' + (u.color || '#94a3b8') + ';border-radius:16px;padding:12px 10px;background:var(--card);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-align:center;user-select:none;transition:box-shadow .15s,transform .15s"' +
      ' onmouseover="this.style.boxShadow=\'0 6px 18px rgba(15,39,64,.15)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.boxShadow=\'none\';this.style.transform=\'\'">' +
      avaHtml(u, 36, 13.5) + // 22.09-219: фото-аватар, если загружен
      '<b style="font-size:12.5px;color:var(--ink);line-height:1.25">' + esc(u.full_name) + '</b>' +
      '<span style="font-size:12px;color:var(--muted);font-weight:700">' + esc(wkProfLabel(u)) + '</span>' +
      (absToday ? '<span style="font-size:11px;color:var(--red);font-weight:800">отсутствует сегодня</span>' : '') +
      (draggable && !inBrigade ? '<span style="font-size:11px;color:#94a3b8">⠿ перетащить в бригаду</span>' : '') +
      '</div>';
  }

  // Календарь работника: сетка месяца с тремя состояниями дня.
  // 🟢 рабочий по графику, ⚪ выходной, 🔴 отсутствие (отпуск/больничный).
  function wkCalendarHtml(u, wd) {
    var wm = wkMonth();
    var dim = new Date(wm.y, wm.m + 1, 0).getDate();
    var lead = (new Date(wm.y, wm.m, 1).getDay() + 6) % 7; // Пн = 0
    var can = wkCanEdit(u) && S.wkCardROUid !== u.id; // 22.09-94: режим «только просмотр»
    var s = '<div style="border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--card)">';
    s += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
    s += '<button type="button" class="btn sm" data-action="wk-month-prev" title="Предыдущий месяц">‹</button>';
    s += '<span style="font-weight:800;font-size:12.5px;color:var(--ink);flex:1;text-align:center">' + MON_NOM[wm.m] + ' ' + wm.y + '</span>';
    s += '<button type="button" class="btn sm" data-action="wk-month-next" title="Следующий месяц">›</button>';
    s += '<span style="font-size:10px;color:var(--muted);display:flex;gap:6px;align-items:center;font-weight:700">' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#dcfce7;border:1px solid #16a34a"></span>раб' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f1f5f9;border:1px solid #cbd5e1"></span>вых' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fee2e2;border:1px solid #dc2626"></span>отс' +
      '</span></div>';
    s += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;font-size:10px;color:var(--muted);text-align:center;margin-bottom:3px;font-weight:700">' +
      ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>';
    s += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
    for (var i = 0; i < lead; i++) s += '<span></span>';
    for (var dd = 1; dd <= dim; dd++) {
      var dt = new Date(wm.y, wm.m, dd);
      var ds = wm.y + '-' + String(wm.m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var state = wkDayState(u.id, ds); // 'work' | 'off' | 'abs'
      var absent = state === 'abs';
      var isToday = sameDay(dt, TODAY);
      var bg, border, fg;
      if (state === 'abs')        { bg = '#fee2e2'; border = '#dc2626'; fg = '#b91c1c'; }
      else if (state === 'work')  { bg = '#dcfce7'; border = '#16a34a'; fg = '#14532d'; }
      else                        { bg = '#f1f5f9'; border = '#cbd5e1'; fg = '#94a3b8'; }
      var title = absent
        ? ('Отсутствует' + (wd.abs[ds] ? ' — ' + wd.abs[ds] : '') + (can ? ' · нажмите, чтобы изменить причину или снять' : ''))
        : (state === 'work'
          ? (can ? 'Рабочий по графику · нажмите, чтобы отметить отсутствие' : 'Рабочий по графику')
          : (can ? 'Выходной по графику · нажмите, чтобы отметить отсутствие' : 'Выходной по графику'));
      // пустой день: один клик = отсутствие сразу (без комментария);
      // красный день: клик = модалка (причина / убрать отметку)
      var dayAct = absent ? 'wk-open-day' : 'wk-quick-abs';
      s += '<span role="button"' + (can ? ' data-action="' + dayAct + '" data-uid="' + esc(u.id) + '" data-ds="' + ds + '"' : '') +
        ' style="display:flex;align-items:center;justify-content:center;min-height:26px;border-radius:6px;font-size:11px;font-weight:700;cursor:' + (can ? 'pointer' : 'default') +
        ';border:1px solid ' + border +
        ';background:' + bg +
        ';color:' + fg +
        (isToday ? ';box-shadow:0 0 0 2px rgba(37,99,235,.35)' : '') + '" title="' + esc(title) + '">' + dd + '</span>';
    }
    s += '</div></div>';
    return s;
  }

  // ПОЛНАЯ карточка работника (в модалке): время, график, бригада, комментарий, календарь
  // Выпадающий список профессий участка из справочника «Профессии» (Сборка 22.09-92):
  // значение — текст «Название — N разряд» (SP_PROFS.label); записи без разряда — просто название.
  // Старые карточки со свободным текстом профессии показываются legacy-опцией «⚠ …».
  function wkProfOptionsHtml(cur) {
    var profs = (window.SP_PROFS && SP_PROFS.getAll) ? SP_PROFS.getAll().slice() : [];
    profs.sort(function (a, b) { var x = String(a.name || '').localeCompare(String(b.name || ''), 'ru'); return x || ((a.grade || 0) - (b.grade || 0)); });
    var seen = {};
    var s = '<option value="">— не указана —</option>';
    profs.forEach(function (p) {
      var lb = SP_PROFS.label(p);
      if (!lb || seen[lb]) return;
      seen[lb] = 1;
      s += '<option value="' + esc(lb) + '"' + (cur === lb ? ' selected' : '') + '>' + esc(lb) + '</option>';
    });
    if (cur && !seen[cur]) {
      s += '<option value="' + esc(cur) + '" selected>\u26a0 ' + esc(cur) + ' (нет в справочнике)</option>';
    }
    return s;
  }

  function wkPanelHtml(u, masters) {
    var wd = wkData(u.id);
    var can = wkCanEdit(u) && S.wkCardROUid !== u.id; // 22.09-94: режим «только просмотр»
    var dis = can ? '' : ' disabled';
    var isSlesar = u.role === 'slesar';
    var brigadeName = '';
    if (isSlesar && wd.brigade) {
      var bm = masters.filter(function (m) { return m.id === wd.brigade; })[0];
      if (bm) brigadeName = 'Бригада мастера ' + bm.full_name;
    }
    var s = '<div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card);width:100%;box-sizing:border-box">';
    s += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
    s += '<span style="width:12px;height:12px;border-radius:50%;background:' + (u.color || '#94a3b8') + ';flex:0 0 auto"></span>';
    s += '<b style="font-size:14px;color:var(--ink)">' + esc(u.full_name) + '</b>';
    s += '<span class="tag ok" style="font-size:12px">' + esc(wkProfLabel(u)) + '</span>';
    if (brigadeName) s += '<span class="sub" style="font-size:12px">👷 ' + esc(brigadeName) + '</span>';
    s += '<span style="margin-left:auto;font-size:12px;font-weight:800;color:var(--blue)">' + wd.hours + ' ч · ' + wd.sched + '</span>';
    s += '</div>';
    // Настройки — вертикально и ровно: название поля, под ним список на всю ширину карточки
    var wkFieldCss = 'display:block;width:100%;margin-top:3px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;font-family:inherit;font-size:12px;background:var(--card);font-weight:700;box-sizing:border-box';
    var wkLblCss = 'display:block;font-size:12px;color:var(--muted);font-weight:700';
    s += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">';
    var curProf = (u.prof || wd.prof || '');
    s += '<label style="' + wkLblCss + '">Профессия<select data-wk="prof" data-uid="' + esc(u.id) + '"' + dis + ' style="' + wkFieldCss + '">' + wkProfOptionsHtml(curProf) + '</select></label>';
    s += '<label style="' + wkLblCss + '">Время<select data-wk="hours" data-uid="' + esc(u.id) + '"' + dis + ' style="' + wkFieldCss + '"><option value="8"' + (wd.hours !== 12 ? ' selected' : '') + '>8 часов</option><option value="12"' + (wd.hours === 12 ? ' selected' : '') + '>12 часов</option></select></label>';
    s += '<label style="' + wkLblCss + '">График<select data-wk="sched" data-uid="' + esc(u.id) + '"' + dis + ' style="' + wkFieldCss + '"><option value="5/2"' + (wd.sched !== '2/2' ? ' selected' : '') + '>5/2</option><option value="2/2"' + (wd.sched === '2/2' ? ' selected' : '') + '>2/2</option></select></label>';
    // Цикл 2/2 — общий на бригаду, меняется в шапке бригады на странице «Работники».
    if (wd.sched === '2/2') {
      s += '<div style="font-size:12px;color:var(--muted);font-weight:700;padding:4px 0;margin-top:-2px">Цикл 2/2 — общий на бригаду, меняется в шапке бригады</div>';
    }
    if (isSlesar) {
      s += '<label style="' + wkLblCss + '">Бригада<select data-wk="brigade" data-uid="' + esc(u.id) + '"' + dis + ' style="' + wkFieldCss + '">';
      s += '<option value="">— без бригады —</option>';
      masters.forEach(function (mm) {
        s += '<option value="' + esc(mm.id) + '"' + (wd.brigade === mm.id ? ' selected' : '') + '>Бригада мастера ' + esc(mm.full_name) + '</option>';
      });
      s += '</select></label>';
    }
    s += '</div>';
    s += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px">';
    s += '<div style="flex:1;font-size:12px;color:' + (wd.comment ? 'var(--ink)' : 'var(--muted)') + ';background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:7px 10px;min-height:20px">' + (wd.comment ? esc(wd.comment) : '<i>комментарий не указан</i>') + '</div>';
    if (can) s += '<button type="button" class="btn sm" data-action="wk-edit-comment" data-uid="' + esc(u.id) + '" title="Комментарий к карточке работника">✎</button>';
    s += '</div>';
    s += wkCalendarHtml(u, wd);
    s += '</div>';
    return s;
  }

  // Настройки (время/график/цикл/бригада) — сохранение при смене
  function wireWkControls(root) {
    root.querySelectorAll('select[data-wk], input[data-wk]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var uid = inp.getAttribute('data-uid'), f = inp.getAttribute('data-wk');
        if (!uid || !wkCanEdit(DB.getUser(uid))) { toast('err', 'Нет прав: только свой участок'); return; }
        var patch = {};
        if (f === 'hours') {
          patch.hours = parseInt(inp.value, 10) || 8;
          // 8-часовой день → график 5/2, 12-часовой → 2/2 (автоматически)
          patch.sched = (patch.hours === 12) ? '2/2' : '5/2';
        }
        else if (f === 'sched') patch.sched = inp.value;
        else if (f === 'brigade') patch.brigade = inp.value || null;
        else if (f === 'prof') {
          patch.prof = inp.value;
          // у части пользователей «профессия» лежит в users_db (служебные должности) —
          // синхронизируем, чтобы карточка/список/печать показывали одно и то же (Сборка 22.09-92)
          var _pu = DB.getUser(uid);
          if (_pu && _pu.prof && inp.value !== _pu.prof && DB.updateUser) { try { DB.updateUser(uid, { prof: inp.value }); } catch (e) {} }
        }
        if (window.SP_WORKERS) SP_WORKERS.setWorker(uid, patch);
        toast('ok', '✓ Сохранено');
        renderWorkers(); // страница позади модалки
        if (S.wkModalUid === uid) openWkCardModal(uid); // обновить открытую карточку
      });
    });
  }

  // Drag&drop карточек слесарей (desktop): карточка → зона бригады мастера
  function wireWkDnD(root) {
    root.querySelectorAll('.wk-card[draggable="true"]').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        try { e.dataTransfer.setData('text/plain', card.getAttribute('data-uid')); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
        card.style.opacity = '0.4';
      });
      card.addEventListener('dragend', function () { card.style.opacity = ''; });
    });
    root.querySelectorAll('[data-wk-drop]').forEach(function (zone) {
      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
        zone.classList.add('wk-drop-on');
      });
      zone.addEventListener('dragleave', function (e) {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('wk-drop-on');
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('wk-drop-on');
        try {
          var uid = e.dataTransfer.getData('text/plain');
          if (uid) wkDropSlesar(uid, zone.getAttribute('data-wk-drop') || '');
        } catch (err) {}
      });
    });
  }

  function renderWorkers() {
    // 22.09-220: страница «Работники» переехала в окно «Настройки бригад» над «Графиками смен» —
    // функционал тот же, меняется только цель рендера (окно/страница)
    var v = S.workersModal ? document.getElementById('modal') : document.getElementById('view');
    var users = wkVisibleUsers();
    var leaders = users.filter(function (u) { return u.role === 'nach' || u.role === 'smaster'; });
    var masters = users.filter(function (u) { return u.role === 'master'; });
    var slesars = users.filter(function (u) { return u.role === 'slesar'; });
    var areaLabel = dashAreaActive() ? S.dashArea : (S.role === 'admin' ? 'все участки' : (S.user ? S.user.area : ''));

    var html = '<div class="card"><div class="card-h"><h2>👷 Работники</h2>';
    html += '<span class="sub">' + users.length + ' чел. · ' + esc(areaLabel) + '</span><div class="spacer"></div>';
    html += '<span class="sub">Клик по карточке — полная карточка · слесарей можно перетащить в бригаду' +
      (S.role === 'viewer' ? ' · режим просмотра (без изменений)' : (S.role === 'master' ? ' · вы видите свою бригаду' : '')) + '</span>';
    html += '</div><div class="card-b">';

    // Сверху — руководители: начальник участка и старший мастер
    if (leaders.length) {
      html += '<div style="margin-bottom:18px"><div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Руководство</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
      leaders.forEach(function (u) { html += wkCardHtml(u, masters); });
      html += '</div></div>';
    }

    // Бригады (зоны для перетаскивания слесарей): «Бригада мастера ФИО»
    masters.forEach(function (m) {
      var members = slesars.filter(function (s) { return wkData(s.id).brigade === m.id; });
      html += '<div data-wk-drop="' + esc(m.id) + '" style="margin-bottom:16px;border:1px dashed var(--line);border-radius:14px;padding:10px;transition:outline-color .15s">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><span style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">👷 Бригада мастера ' + esc(m.full_name) + (members.length ? ' · ' + (members.length + 1) + ' чел.' : '') + '</span>';
      // Быстрая замена времени, графика и цикла ВСЕЙ бригаде (мастер + его работники)
      if (members.length) {
        var _wdm = wkData(m.id);
        var _bdis = wkCanEdit(m) ? '' : ' disabled';
        html += '<span style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap" title="Замена сразу всем работникам бригады">';
        html += '<label style="font-size:12px;color:var(--muted);font-weight:700">Время: <select data-wkbrig="hours" data-uid="' + esc(m.id) + '"' + _bdis + ' style="padding:3px 6px;border:1px solid var(--line);border-radius:7px;font-family:inherit;font-size:12px;background:var(--card);font-weight:700"><option value="8"' + (_wdm.hours !== 12 ? ' selected' : '') + '>8 ч</option><option value="12"' + (_wdm.hours === 12 ? ' selected' : '') + '>12 ч</option></select></label>';
        html += '<label style="font-size:12px;color:var(--muted);font-weight:700">График: <select data-wkbrig="sched" data-uid="' + esc(m.id) + '"' + _bdis + ' style="padding:3px 6px;border:1px solid var(--line);border-radius:7px;font-family:inherit;font-size:12px;background:var(--card);font-weight:700"><option value="5/2"' + (_wdm.sched !== '2/2' ? ' selected' : '') + '>5/2</option><option value="2/2"' + (_wdm.sched === '2/2' ? ' selected' : '') + '>2/2</option></select></label>';
        // Цикл — показываем только при 2/2 (для 5/2 цикл не имеет смысла)
        if (_wdm.sched === '2/2') {
          html += '<label style="font-size:12px;color:var(--muted);font-weight:700" title="Первый рабочий день цикла (2 раб / 2 вых)">Цикл с: <input type="date" data-wkbrig="cycle" data-uid="' + esc(m.id) + '" value="' + esc(_wdm.cycle || '2026-01-05') + '"' + _bdis + ' style="padding:3px 6px;border:1px solid var(--line);border-radius:7px;font-family:inherit;font-size:12px;background:var(--card);font-weight:700"></label>';
        }
        html += '</span>';
      }
      // Кнопка «Полный график» — доступна и для одиночного мастера (распечатать свой график)
      var _bdis2 = wkCanEdit(m) ? '' : ' disabled';
      html += '<button type="button" class="btn sm" data-action="brig-full-schedule" data-uid="' + esc(m.id) + '" title="Открыть полный график бригады на месяц или год — можно распечатать или скачать в Excel"' + _bdis2 + ' style="margin-left:auto;padding:3px 8px;font-size:12px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border-color:#0284c7">📆 Полный график</button>';
      html += '</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
      html += wkCardHtml(m, masters);
      members.forEach(function (s) { html += wkCardHtml(s, masters); });
      html += '</div></div>';
    });

    // Слесари без бригады (зона: перетащить сюда — убрать из бригады)
    if (slesars.length) {
      var free = slesars.filter(function (s) {
        var b = wkData(s.id).brigade;
        return !b || !masters.some(function (m) { return m.id === b; });
      });
      html += '<div data-wk-drop="" style="border:1px dashed var(--line);border-radius:14px;padding:10px;transition:outline-color .15s">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><span style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Слесари без бригады</span></div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
      if (free.length) free.forEach(function (s) { html += wkCardHtml(s, masters); });
      else html += '<span style="font-size:12.5px;color:var(--muted);padding:14px">— все слесари распределены по бригадам —</span>';
      html += '</div></div>';
    }
    if (!users.length) html += '<div class="empty" style="padding:30px">Нет работников</div>';
    html += '</div></div>';
    if (S.workersModal) { html = '<div class="modal-h"><h3>⚙ Настройки бригад</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">' + html + '</div>'; } // 22.09-220
    v.innerHTML = html;
    wireWkDnD(v);
    // Быстрые «Время»/«График»/«Цикл» в заголовке бригады — замена сразу всей бригаде
    v.querySelectorAll('[data-wkbrig]').forEach(function (el) {
      var evt = el.tagName === 'SELECT' ? 'change' : 'change';
      el.addEventListener(evt, function () {
        var mid = el.getAttribute('data-uid'), f = el.getAttribute('data-wkbrig');
        var mu = DB.getUser(mid);
        if (!mu || !wkCanEdit(mu)) { toast('err', 'Нет прав: только свой участок'); renderWorkers(); return; }
        var brig = wkBrigadeOf(mid).filter(function (s) { return wkCanEdit(s); });
        var patch = {};
        if (f === 'hours') {
          patch.hours = parseInt(el.value, 10) || 8;
          // 8 ч → 5/2, 12 ч → 2/2 (автоматически всей бригаде);
          // при 2/2 цикл мастера уходит бригаде вместе с графиком
          patch.sched = (patch.hours === 12) ? '2/2' : '5/2';
          if (patch.sched === '2/2') patch.cycle = wkData(mid).cycle || '2026-01-05';
        }
        else if (f === 'sched') { patch.sched = el.value; patch.cycle = wkData(mid).cycle || '2026-01-05'; } // цикл мастера уходит бригаде вместе с графиком
        else if (f === 'cycle') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { toast('err', 'Некорректная дата цикла'); renderWorkers(); return; }
          patch.cycle = el.value;
          // Цикл сам по себе — оставляем график как есть (если у бригады 5/2, поле просто неактивно в UI)
        }
        if (window.SP_WORKERS) {
          SP_WORKERS.setWorker(mid, patch);
          brig.forEach(function (s) { SP_WORKERS.setWorker(s.id, patch); });
        }
        var label = (f === 'hours' ? 'Время' : f === 'sched' ? 'График' : 'Цикл');
        toast('ok', '✓ ' + label + ' заменено всей бригаде — ' + (brig.length + 1) + ' чел.');
        renderWorkers();
      });
    });
    // Кнопка «Полный график бригады» — открывает большой оверлей
    v.querySelectorAll('[data-action="brig-full-schedule"]').forEach(function (b) {
      b.addEventListener('click', function () { openBrigadeFullSchedule(b.getAttribute('data-uid')); });
    });
  }

  // Полная карточка работника (модалка): клик по компактной карточке
  // Открыть карточку работника. ro=true → режим «только просмотр» (Сборка 22.09-94):
  // все настройки и календарь отсутствий видны, но менять ничего нельзя.
  function openWkCardModal(uid, ro) {
    var u = DB.getUser(uid); if (!u) return;
    if (ro !== undefined) S.wkCardROUid = ro ? uid : null;      // режим задан явно
    else if (S.wkModalUid !== uid) S.wkCardROUid = null;        // другая карточка — сброс
    S.wkModalUid = uid;
    var isRO = S.wkCardROUid === uid;
    var masters = wkVisibleUsers().filter(function (x) { return x.role === 'master'; });
    // 22.09-220: из окна «Настройки бригад» карточка открывается ВТОРЫМ окном поверх него
    var _wko2 = !!S.workersModal;
    var _wkO = _wko2 ? document.getElementById('overlay2') : overlay;
    var _wkM = _wko2 ? document.getElementById('modal2') : modal;
    _wkM.style.maxWidth = '560px'; // 22.09-172: окно — ровно по ширине карточки работника (как карточка задачи); базовая 80%-ширина прочих окон не меняется
    _wkM.innerHTML = '<div class="modal-h"><h3>' + esc(u.full_name) + ' · ' + wkRoleLabel(u.role) + (isRO ? ' <span class="tag" style="background:#eff6ff;color:#1d4ed8;font-weight:800;font-size:11.5px;vertical-align:2px">просмотр</span>' : '') + '</h3><button class="x" data-action="close-modal' + (_wko2 ? '2' : '') + '">×</button></div>' +
      '<div class="modal-b">' + wkPanelHtml(u, masters) + '</div>';
    _wkO.classList.add('show');
    wireWkControls(_wkM);
  }

  // 22.09-220: «Настройки бригад» — бывшая страница «Работники» окном над «Графиками смен»
  function openWorkersSettingsModal() {
    S.workersModal = true;
    modal.style.maxWidth = '90vw'; modal.style.width = '90vw';
    renderWorkers();
    overlay.classList.add('show');
  }
  // 22.09-220: «Факт работ по объектам» — окно из панели мониторинга (блок «Выполнено за месяц»)
  function openFactMonthModal() {
    S.factModal = true;
    modal.style.maxWidth = '90vw'; modal.style.width = '90vw';
    renderFactMonth();
    overlay.classList.add('show');
  }

  /* ========== ГРАФИКИ СМЕН (бригады × дни месяца) ========== */
  // Сводный календарь по бригадам: вид «бригада → строка, дни → столбцы».
  // Цвета ячейки: 🟢 рабочий, ⚪ выходной, 🔴 отсутствие.
  // Клик по ячейке — отмечает/снимает отсутствие (если есть права на этого работника).
  /* ---------- ПРАЗДНИЧНЫЕ ДНИ РБ (22.09-109) ----------
     Список синхронизируется через раздел holidays на сервере
     (LS-кэш 'smartplan_holidays'). Жёлтая подсветка — в «Графиках смен». */
  function holidaysLoad() {
    try { var r = localStorage.getItem('smartplan_holidays'); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function holidaysSaveLS(list) { try { localStorage.setItem('smartplan_holidays', JSON.stringify(list)); } catch (e) {} }
  function holidayOn(ds) {
    // 22.09-110: праздник без года — сравниваем по «ММ-ДД»; старые записи «ГГГГ-ММ-ДД» тоже понимаем
    var md = String(ds || '').slice(5);
    var l = holidaysLoad();
    for (var i = 0; i < l.length; i++) {
      var d = l[i] && l[i].date ? String(l[i].date) : '';
      if (!d) continue;
      if (d === md || d.slice(5) === md || d === ds) return l[i].name || 'Праздник';
    }
    return '';
  }
  function hdFmtDate(ds) { var p = String(ds || '').split('-'); if (p.length === 2) return p[1] + '.' + p[0]; if (p.length === 3) return p[2] + '.' + p[1]; return String(ds || '—'); } // 22.09-110: без года → ДД.ММ
  function openHolidaysModal() {
    var canEdit = S.role === 'admin';
    var list = holidaysLoad().slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var h = '<div class="modal-h"><h3>🎉 Праздничные дни (РБ)</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div class="calc" style="margin-bottom:10px;align-items:flex-start">Праздники без года: одна дата (день.месяц) — повторяется каждый год; подсвечиваются в «Графиках смен» жёлтым. Радуница — переходящая, на будущие годы переносите вручную. Список общий для всех пользователей.' + (canEdit ? '' : ' <b>Изменение доступно администратору.</b>') + '</div>';
    if (canEdit) {
      h += '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">' +
        '<div class="fld" style="margin:0;flex:0 0 130px"><label>Дата (день.месяц)</label><input id="hd-md" placeholder="09.05" maxlength="5" inputmode="numeric" style="text-align:center;font-weight:700"></div>' +
        '<div class="fld" style="margin:0;flex:1;min-width:170px"><label>Наименование праздника</label><input id="hd-name" placeholder="напр.: День Победы"></div>' +
        '<button type="button" class="btn primary" data-action="holiday-add">+ Добавить</button></div>';
    }
    h += '<div style="max-height:340px;overflow-y:auto;border:1px solid var(--line);border-radius:8px">';
    if (!list.length) h += '<div style="padding:14px;color:var(--muted);font-size:12.5px">Праздников нет' + (canEdit ? ' — добавьте первую дату выше' : '') + '</div>';
    list.forEach(function (it) {
      h += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line)">' +
        '<b style="flex:0 0 92px;font-size:12px;color:var(--ink)">' + esc(hdFmtDate(it.date)) + '</b>' +
        '<span style="flex:1;font-size:12.5px;color:var(--ink)">' + esc(it.name || 'Праздник') + '</span>' +
        (canEdit ? '<button type="button" class="btn sm" data-action="holiday-del" data-id="' + esc(it.id) + '" style="color:var(--red)">Удалить</button>' : '') + '</div>';
    });
    h += '</div></div>';
    h += '<div class="modal-f"><button type="button" class="btn" data-action="close-modal">Закрыть</button></div>';
    modal.innerHTML = h;
    overlay.classList.add('show');
  }
  function holidayAddFromModal() {
    var dEl = document.getElementById('hd-md'), nEl = document.getElementById('hd-name');
    var raw = dEl ? dEl.value.trim() : '';
    var name = nEl ? nEl.value.trim() : '';
    // 22.09-110: дата без года — «ДД.ММ» (или «Д.М»); храним «ММ-ДД»
    var mm = raw.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!mm) { toast('err', 'Дата без года, формат: ДД.ММ (напр.: 09.05)'); return; }
    var ddN = parseInt(mm[1], 10), mmN = parseInt(mm[2], 10);
    if (mmN < 1 || mmN > 12 || ddN < 1 || ddN > 31) { toast('err', 'Нет такой даты: проверьте день и месяц'); return; }
    var md = String(mmN).padStart(2, '0') + '-' + String(ddN).padStart(2, '0');
    if (!name) { toast('err', 'Укажите наименование праздника'); return; }
    var list = holidaysLoad();
    for (var i = 0; i < list.length; i++) {
      var ld = list[i] && list[i].date ? String(list[i].date) : '';
      if (ld === md || ld.slice(5) === md) { toast('err', 'Эта дата уже есть в списке («' + (list[i].name || 'Праздник') + '»)'); return; }
    }
    var rec = { id: 'h_' + md, date: md, name: name }; // детерминированный id — дублей не будет и на сервере
    list.push(rec); holidaysSaveLS(list);
    if (window.SP_API && SP_API.upsert) SP_API.upsert('holidays', rec).then(function (r) { if (!r || !r.ok) toast('warn', '⚠ Не сохранилось на сервере (' + ((r && r.err) || 'сеть') + ') — попробуйте позже'); });
    logAction('Добавление праздника', md + ' · ' + name);
    toast('ok', '🎉 Добавлено: ' + name + ' (' + hdFmtDate(md) + ')');
    if (S.screen === 'schedules') renderSchedules();
    openHolidaysModal();
  }
  function holidayDelete(id) {
    if (!id) return;
    var list = holidaysLoad(), n = list.length;
    list = list.filter(function (x) { return x && x.id !== id; });
    if (list.length === n) return;
    holidaysSaveLS(list);
    if (window.SP_API && SP_API.del) SP_API.del('holidays', id).then(function (r) { if (!r || !r.ok) toast('warn', '⚠ Не удалилось на сервере (' + ((r && r.err) || 'сеть') + ') — попробуйте позже'); });
    logAction('Удаление праздника', id);
    toast('ok', 'Праздник удалён');
    if (S.screen === 'schedules') renderSchedules();
    openHolidaysModal();
  }

  /* ---------- ВИДЫ ТЕЛЕМЕТРИИ (22.09-111) ----------
     Общий список раздела telemetry на сервере (LS-кэш 'smartplan_telemetry').
     Выбирается в атрибутах объектов ГРП/ШРП/ПГРП — «Тип телеметрии». */
  function telemetryLoad() {
    try { var r = localStorage.getItem('smartplan_telemetry'); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function telemetrySaveLS(list) { try { localStorage.setItem('smartplan_telemetry', JSON.stringify(list)); } catch (e) {} }
  function telemetryNames() {
    var out = [];
    telemetryLoad().forEach(function (r) { if (r && r.name && !r._deleted && out.indexOf(r.name) < 0) out.push(r.name); });
    out.sort(function (a, b) { return String(a).localeCompare(String(b), 'ru'); });
    return out;
  }
  // Обновить открытый select «Тип телеметрии» в карточке объекта, не трогая остальные поля
  function telemetrySyncSelects() {
    var sels = document.querySelectorAll('select[data-oa-key="telemetry"]');
    var names = telemetryNames();
    for (var i = 0; i < sels.length; i++) {
      var cur = sels[i].value;
      var h = '<option value="">— нет телеметрии —</option>';
      for (var j = 0; j < names.length; j++) h += '<option value="' + esc(names[j]) + '"' + (names[j] === cur ? ' selected' : '') + '>' + esc(names[j]) + '</option>';
      if (cur && names.indexOf(cur) < 0) h += '<option value="' + esc(cur) + '" selected>⚠ ' + esc(cur) + ' (нет в списке)</option>';
      sels[i].innerHTML = h;
    }
  }
  function openTelemetryModal() {
    var canEdit = S.role === 'admin';
    var names = telemetryNames();
    var h = '<div class="modal-h"><h3>📡 Виды телеметрии</h3><button class="x" data-action="close-modal">×</button></div>';
    h += '<div class="modal-b">';
    h += '<div class="calc" style="margin-bottom:10px;align-items:flex-start">Список общий для всех объектов (ГРП/ШРП/ПГРП): добавленный тип можно выбрать в атрибутах любого объекта — вкладка «Технические», поле «Тип телеметрии».' + (canEdit ? '' : ' <b>Изменение доступно администратору.</b>') + '</div>';
    if (canEdit) {
      h += '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px">' +
        '<div class="fld" style="margin:0;flex:1"><label>Новый тип телеметрии</label><input id="tt-name" placeholder="напр.: ПТК «Сириус»"></div>' +
        '<button type="button" class="btn primary" data-action="telemetry-add">+ Добавить</button></div>';
    }
    h += '<div style="max-height:320px;overflow-y:auto;border:1px solid var(--line);border-radius:8px">';
    if (!names.length) h += '<div style="padding:14px;color:var(--muted);font-size:12.5px">Список пуст' + (canEdit ? ' — добавьте первый тип выше' : '') + '</div>';
    names.forEach(function (n) {
      var rid = '';
      telemetryLoad().forEach(function (r) { if (r && r.name === n) rid = r.id; });
      h += '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line)">' +
        '<span style="flex:1;font-size:12.5px;color:var(--ink);font-weight:600">📡 ' + esc(n) + '</span>' +
        (canEdit ? '<button type="button" class="btn sm" data-action="telemetry-del" data-id="' + esc(rid) + '" style="color:var(--red)">Удалить</button>' : '') + '</div>';
    });
    h += '</div></div>';
    h += '<div class="modal-f"><button type="button" class="btn" data-action="close-modal">Закрыть</button></div>';
    modal.innerHTML = h;
    overlay.classList.add('show');
  }
  function telemetryAddFromModal() {
    var nEl = document.getElementById('tt-name');
    var name = nEl ? nEl.value.trim() : '';
    if (!name) { toast('err', 'Укажите наименование типа телеметрии'); return; }
    if (telemetryNames().indexOf(name) >= 0) { toast('err', 'Такой тип уже есть в списке («' + name + '»)'); return; }
    var rec = { id: 'tt_' + Date.now().toString(36), name: name };
    var list = telemetryLoad(); list.push(rec); telemetrySaveLS(list);
    if (window.SP_API && SP_API.upsert) SP_API.upsert('telemetry', rec).then(function (r) { if (!r || !r.ok) toast('warn', '⚠ Не сохранилось на сервере (' + ((r && r.err) || 'сеть') + ') — попробуйте позже'); });
    logAction('Добавление вида телеметрии', name);
    toast('ok', '📡 Тип «' + name + '» добавлен — доступен на всех объектах');
    telemetrySyncSelects();
    openTelemetryModal();
  }
  function telemetryDelete(id) {
    if (!id) return;
    var list = telemetryLoad(), n = list.length;
    list = list.filter(function (x) { return x && x.id !== id; });
    if (list.length === n) return;
    telemetrySaveLS(list);
    if (window.SP_API && SP_API.del) SP_API.del('telemetry', id).then(function (r) { if (!r || !r.ok) toast('warn', '⚠ Не удалилось на сервере (' + ((r && r.err) || 'сеть') + ') — попробуйте позже'); });
    logAction('Удаление вида телеметрии', id);
    toast('ok', 'Вид телеметрии удалён из списка');
    telemetrySyncSelects();
    openTelemetryModal();
  }

  /* ---------- 22.09-136/137: миграция видов телеметрии ----------
     Переименования выполняются ПО ПАРАМ (старое имя → новое); id записи
     сохраняется, поэтому через сервер переименование разойдётся по всем
     устройствам. 22.09-136: «Индел» → «ПТК "Индел"»; 22.09-137:
     «ПТК "Эксорт"» → «ПТК "Эскорт"». Плюс гарантированные типы Wago /
     ПТК "Сириус" / ПТК "Эскорт". Ссылки на старое имя обновляются
     у объектов (attrs.telemetry) и работ (telemetry_type). Идемпотентно:
     если менять нечего — ничего не делает; запуск из enterApp, в т.ч.
     отложенно (после первой синхронизации раздела telemetry). */
  var TEL_RENAMES = [['Индел', 'ПТК "Индел"'], ['ПТК "Эксорт"', 'ПТК "Эскорт"']];
  var TEL_ENSURE = ['Wago', 'ПТК "Сириус"', 'ПТК "Эскорт"'];
  function telemetryMigrateTypes() {
    var changed = false;
    var applied = []; // переименования, выполненные в ЭТОМ вызове
    var list = telemetryLoad();
    // 1) переименования старых наименований по парам
    TEL_RENAMES.forEach(function (pair) {
      var oldN = pair[0], newN = pair[1];
      var hasOld = false, hasNew = false;
      for (var q = 0; q < list.length; q++) {
        var rq = list[q];
        if (rq && !rq._deleted) { if (rq.name === oldN) hasOld = true; if (rq.name === newN) hasNew = true; }
      }
      if (!hasOld) return;
      for (var i = 0; i < list.length; i++) {
        var rr = list[i];
        if (!rr || rr._deleted || rr.name !== oldN) continue;
        if (hasNew) { // обе записи есть — старую удаляем (ссылки перепишем ниже)
          list.splice(i, 1); i--;
          if (window.SP_API && SP_API.del) SP_API.del('telemetry', rr.id).catch(function () {});
        } else {
          rr = list[i] = Object.assign({}, rr, { id: rr.id || ('tt_' + Date.now().toString(36)), name: newN });
          if (window.SP_API && SP_API.upsert) SP_API.upsert('telemetry', rr).catch(function () {});
        }
        changed = true;
      }
      applied.push({ from: oldN, to: newN });
    });
    // 2) гарантированные типы (добавляем только отсутствующие)
    TEL_ENSURE.forEach(function (nm) {
      var found = false;
      for (var j = 0; j < list.length; j++) if (list[j] && list[j].name === nm && !list[j]._deleted) { found = true; break; }
      if (!found) {
        var rec = { id: 'tt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5), name: nm };
        list.push(rec);
        if (window.SP_API && SP_API.upsert) SP_API.upsert('telemetry', rec).catch(function () {});
        changed = true;
      }
    });
    if (changed) { telemetrySaveLS(list); try { telemetrySyncSelects(); } catch (e) {} }
    // 3) ссылки на старые имена — только для переименований этого вызова
    applied.forEach(function (p) { telemetryMigrateRefs(p.from, p.to); });
    var dd = null; // 22.09-142: после переименований — склейка дублей
    try { dd = telemetryDedupeTypes(); } catch (e) { console.error('telemetryDedupeTypes:', e); }
    return { changed: changed || !!(dd && dd.changed), renamed: applied.length > 0 };
  }
  /* 22.09-142: дедупликация видов телеметрии. Одна и та же запись могла
     завестись несколько раз с разным id (сид на нескольких устройствах +
     общий раздел на сервере): написания отличаются кавычками («»/""),
     пробелами или регистром. Записи объединяем в одну: каноничным считается
     вариант из TEL_ENSURE при точном совпадении, иначе первое встречное
     написание. Ссылки (объекты attrs.telemetry, работы telemetry_type)
     переписываем на канон, лишние записи удаляем локально и на сервере. */
  function telNormKey(nm) {
    return String(nm || '').toLowerCase()
      .replace(/[«»„“”]/g, '"').replace(/'/g, '"')
      .replace(/\s+/g, ' ').trim();
  }
  function telemetryDedupeTypes() {
    var list = telemetryLoad();
    var keep = [], byKey = {}, renames = [], removed = 0;
    list.forEach(function (r) {
      if (!r || r._deleted || !r.name || !telNormKey(r.name)) { keep.push(r); return; }
      var k = telNormKey(r.name);
      var cur = byKey[k];
      if (!cur) { byKey[k] = r; keep.push(r); return; }
      // дубликат: канон — вариант из гарантированного списка, если он есть
      var canon = cur, dup = r;
      if (TEL_ENSURE.indexOf(r.name) >= 0 && TEL_ENSURE.indexOf(cur.name) < 0) {
        canon = r; dup = cur;
        var ix = keep.indexOf(cur); if (ix >= 0) keep[ix] = r;
        byKey[k] = r;
      }
      removed++;
      if (dup.name !== canon.name) renames.push({ from: dup.name, to: canon.name });
      if (window.SP_API && SP_API.del && dup.id) SP_API.del('telemetry', dup.id).catch(function () {});
    });
    if (!removed) return { changed: false, removed: 0 };
    telemetrySaveLS(keep);
    try { telemetrySyncSelects(); } catch (e) {}
    var seen = {};
    renames.forEach(function (p) {
      var key = p.from + '→' + p.to;
      if (seen[key]) return;
      seen[key] = 1;
      try { telemetryMigrateRefs(p.from, p.to); } catch (e) {}
    });
    try { logAction('Дедупликация видов телеметрии', 'объединено дублей: ' + removed); } catch (e) {}
    return { changed: true, removed: removed };
  }

  // Переписать ссылки «старое имя → новое» у объектов (attrs.telemetry) и работ (telemetry_type)
  function telemetryMigrateRefs(oldN, newN) {
    var objsUpd = 0, worksUpd = 0;
    try {
      if (window.SP_OBJECTS && SP_OBJECTS.getObjects) {
        SP_OBJECTS.getObjects().forEach(function (o) {
          if (o && o.attrs && o.attrs.telemetry === oldN) {
            SP_OBJECTS.updateObject(o.id, { attrs: { telemetry: newN } });
            objsUpd++;
          }
        });
      }
    } catch (e) {}
    try {
      if (WORK && WORK.getWorkTree) {
        // getWorkTree: все участки КАТАЛОГА работ (getAreas зависит от справочника
        // участков и может не знать область, где лежат работы) — 22.09-136
        WORK.getWorkTree().forEach(function (w) {
          if (w && w.telemetry_type === oldN && w.area && w.area !== '__defaults') {
            WORK.updateWork(w.area, w.id, { telemetry_type: newN });
            worksUpd++;
          }
        });
      }
    } catch (e2) {}
    if (objsUpd || worksUpd) {
      try { logAction('Миграция телеметрии', '«' + oldN + '» → «' + newN + '»: объектов ' + objsUpd + ', работ ' + worksUpd); } catch (e) {}
      toast('ok', '📡 «' + oldN + '» → «' + newN + '» — обновлено: объектов ' + objsUpd + ', работ ' + worksUpd);
    }
  }

  function renderSchedules() {
    var v = document.getElementById('view');
    var users = wkVisibleUsers();
    var masters = users.filter(function (u) { return u.role === 'master'; });
    var slesars = users.filter(function (u) { return u.role === 'slesar'; });
    var wm = wkMonth();
    var dim = new Date(wm.y, wm.m + 1, 0).getDate();
    var lead = (new Date(wm.y, wm.m, 1).getDay() + 6) % 7;

    // Собираем строки: «бригада» — мастер + его слесари; плюс отдельная «без бригады»
    var rows = [];
    masters.forEach(function (m) {
      var members = slesars.filter(function (s) { return wkData(s.id).brigade === m.id; });
      rows.push({ kind: 'brigade', master: m, members: members });
    });
    var free = slesars.filter(function (s) {
      var b = wkData(s.id).brigade;
      return !b || !masters.some(function (m) { return m.id === b; });
    });
    if (free.length) rows.push({ kind: 'free', master: null, members: free });

    var html = '<div class="card"><div class="card-h"><h2>📅 Графики смен</h2>';
    html += '<span class="sub">' + masters.length + ' бригад · ' + slesars.length + ' слесарей · ' + users.length + ' чел.</span><div class="spacer"></div>';
    // Управление: переключатель месяца + режим отображения.
    // 22.09-164: «Праздничные дни» перенесены сюда из графика работ — слева от выбора месяца
    // 22.09-249: «Праздничные дни» и «Настройки бригад» — кнопки-значки, подпись появляется при наведении
    // (как на панели «Графика работ»: data-tip → всплывающее окошко #gt-tip); «Изменить график» — слева от «Печать»
    html += '<button type="button" class="gt-btn gt-sm gt-rose" data-action="sch-holidays" aria-label="Праздничные дни" data-tip="Праздничные дни (РБ) — список нерабочих дней; учитываются в графиках работ" style="margin-right:6px">' + GT_ICONS.gift + '</button>';
    html += '<button type="button" class="gt-btn gt-sm gt-sky" data-action="wk-settings-open" aria-label="Настройки бригад" data-tip="Настройки бригад — состав бригад, работники, их графики и отсутствия" style="margin-right:10px">' + GT_ICONS.team + '</button>';
    // 22.09-211: редактор графика — отдельное окно (черновик + кнопка «Сохранить»)
    var _canAnySch = users.some(function (u) { return wkCanEdit(u); });
    html += '<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">';
    html += '<button type="button" class="btn sm" data-action="sch-month-prev" title="Предыдущий месяц">‹</button>';
    html += '<b data-action="sch-month-label" style="font-size:13px;color:var(--ink);min-width:118px;text-align:center">' + MON_NOM[wm.m] + ' ' + wm.y + '</b>';
    html += '<button type="button" class="btn sm" data-action="sch-month-next" title="Следующий месяц">›</button>';
    html += '<span style="width:1px;height:20px;background:var(--line);margin:0 4px"></span>';
    var modes = [
      { id: 'all',  label: 'Все бригады' },
      { id: 'free', label: 'Только без бригады' }
    ];
    masters.forEach(function (m) { modes.push({ id: 'b:' + m.id, label: 'Бригада ' + m.full_name.split(' ')[0] }); });
    var curMode = S.schMode || 'all';
    html += '<select data-action="sch-mode" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-family:inherit;font-size:12.5px;font-weight:700;background:var(--card)">';
    modes.forEach(function (m) {
      html += '<option value="' + esc(m.id) + '"' + (m.id === curMode ? ' selected' : '') + '>' + esc(m.label) + '</option>';
    });
    html += '</select>';
    html += '<span style="display:inline-flex;gap:6px;align-items:center;white-space:nowrap;margin-left:4px">'; // 22.09-249: «Изменить график» · «Печать» · «Excel» — переносятся только вместе
    if (_canAnySch) html += '<button type="button" class="btn sm" data-action="sch-ed-open" title="Открыть окно редактирования графика смен: клик по дню — рабочий/выходной и часы, перетаскивание дней мышью (у 5/2 — только этот день, у 2/2 — весь график следом) — применяются по кнопке «Сохранить». Отработанные дни не редактируются. Если слева в списке выбрана конкретная бригада — в окне будет только она; «Все бригады» — все работники">✏ Изменить график</button>'; // 22.09-249: слева от «Печать»
    html += '<button type="button" class="btn sm" data-action="sch-print" title="Печать сводного графика (текущий период, выбранный режим)" style="background:#475569;color:#fff;border-color:#475569">🖨 Печать</button>';
    html += '<button type="button" class="btn sm" data-action="sch-excel" title="Скачать в Excel — текущий период, выбранный режим" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-color:#15803d">📥 Excel</button>';
    html += '</span>';
    html += '</span></div>';
    html += '<div class="card-b">';
    // 22.09-123: кнопка «Праздники» перенесена в графики работ (панель слева, после «Обозначения работ»)

    if (!rows.length) {
      html += '<div class="empty" style="padding:30px">Нет работников</div>';
      html += '</div></div>';
      v.innerHTML = html;
      wireSchedulesControls(v);
      return;
    }

    // Ширина столбца дня = 18px. 18 × 31 = 558, плюс колонка ФИО (~240) и сдвиг первой недели —
    // всё гарантированно влезает на любой ноутбук от 1024px без пустого хвоста.
    var colW = 18;

    // Фильтруем строки по режиму (нужно ДО расчёта nameColW, чтобы учесть только видимых)
    var showRows = rows;
    if (curMode === 'free') {
      showRows = rows.filter(function (r) { return r.kind === 'free'; });
    } else if (curMode.indexOf('b:') === 0) {
      var mbId = curMode.slice(2);
      showRows = rows.filter(function (r) { return r.kind === 'brigade' && r.master && r.master.id === mbId; });
    }

    // Ширина колонки ФИО — одинаковая для всех строк, по самому широкому ФИО.
    // Без фиксированной ширины строки «гуляют» по длине текста, и справа от ФИО
    // появляются пустые квадратики, визуально принадлежащие этой строке.
    var nameColW = 200; // минимум
    var sampleAll = [];
    showRows.forEach(function (row) {
      if (row.kind === 'brigade') sampleAll.push(row.master);
      sampleAll = sampleAll.concat(row.members);
    });
    sampleAll.forEach(function (u) {
      // Грубая оценка: 7px на символ кириллицы + 16 на кружок + 60 на отступы/пометку про график.
      var approx = (u.full_name || '').length * 7 + 100;
      if (approx > nameColW) nameColW = approx;
    });
    if (nameColW > 360) nameColW = 360; // потолок

    var html2 = '<div style="overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)">';
    // border-collapse:separate + border-spacing:0 — каждая ячейка имеет свою рамку,
    // на стыке двух одинаковых рамок получается 2px (1px бордюр одной + 1px бордюр другой).
    // table-layout:fixed + width:100% — браузер распределяет ширину колонок пропорционально,
    // все 31 день гарантированно растягиваются на всю ширину контейнера без пустого хвоста.
    html2 += '<table style="border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;min-width:' + (nameColW + lead * colW + dim * colW + 2) + 'px;font-size:12px">';
    // Шапка: пустая ячейка + дни месяца (с подсветкой выходных)
    html2 += '<thead><tr style="background:var(--panel-2)">';
    html2 += '<th style="position:sticky;left:0;background:var(--panel-2);z-index:2;padding:6px 8px;text-align:left;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-size:12px;color:var(--muted);font-weight:700;width:' + nameColW + 'px">Бригада / работник</th>';
    // Сдвиг для первой недели
    for (var li = 0; li < lead; li++) html2 += '<th style="width:' + colW + 'px;border-bottom:1px solid var(--line);border-right:1px solid var(--line)"></th>';
    for (var dd = 1; dd <= dim; dd++) {
      var dtH = new Date(wm.y, wm.m, dd);
      var dowH = dtH.getDay();
      var isWeH = dowH === 0 || dowH === 6;
      var isTodayH = sameDay(dtH, TODAY);
      var dsH = wm.y + '-' + String(wm.m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var _holH = holidayOn(dsH); // 22.09-109
      html2 += '<th title="' + dd + ' ' + MON_NOM[wm.m] + (_holH ? ' · 🎉 ' + esc(_holH) : '') + '" style="width:' + colW + 'px;padding:3px 0;font-size:11.5px;font-weight:700;color:' + (isWeH ? '#94a3b8' : 'var(--muted)') + ';border-bottom:1px solid var(--line);text-align:center;' + (isTodayH ? 'background:rgba(37,99,235,.1);' : (_holH ? 'background:#fef9c3;' : '')) + '">' + dd + '</th>';
    }
    html2 += '</tr></thead><tbody>';

    // (showRows и nameColW посчитаны выше — до открытия таблицы)

    if (!showRows.length) {
      html2 += '<tr><td colspan="' + (1 + lead + dim) + '" style="padding:18px;text-align:center;color:var(--muted)">Нет работников в выбранном режиме</td></tr>';
    }

    showRows.forEach(function (row) {
      // Заголовок бригады (если не free) — одна строка с мастером
      if (row.kind === 'brigade') {
        html2 += schBrigadeRow(row.master, wm, lead, dim, colW, true, nameColW);
        row.members.forEach(function (s) {
          html2 += schWorkerRow(s, wm, lead, dim, colW, nameColW);
        });
      } else {
        row.members.forEach(function (s) {
          html2 += schWorkerRow(s, wm, lead, dim, colW, nameColW);
        });
      }
    });

    html2 += '</tbody></table></div>';
    // Легенда
    html2 += '<div style="margin-top:10px;display:flex;gap:14px;align-items:center;font-size:12px;color:var(--muted);flex-wrap:wrap;font-weight:700">' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#dcfce7;border:1px solid #16a34a"></span>рабочий по графику</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#f1f5f9;border:1px solid #cbd5e1"></span>выходной по графику</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#fee2e2;border:1px solid #dc2626"></span>отсутствие (отпуск/больничный)</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#fef9c3;border:1px solid #eab308"></span>праздник</span>' + // 22.09-109
      '<span style="color:#94a3b8">· клик по ячейке — отметить/снять отсутствие</span>' +
      '</div>';
    // Карточки работников по бригадам внизу — ФИО + профессия, мастер и слесари рядом,
    // каждый мастер с новой строки. Итоги считаются за выбранный период.
    html2 += schBrigadeCards(showRows, wm.y, { kind: 'month', y: wm.y, m: wm.m });

    // ===== График за год (отдельный блок под месяцем) =====
    // Выбранный год берётся из S.schYear (по умолчанию — текущий год месяца).
    html2 += schYearBlock(users, masters, slesars, curMode);

    html += html2 + '</div></div>';
    v.innerHTML = html;
    wireSchedulesControls(v);
  }

  function schBrigadeRow(master, wm, lead, dim, colW, isHeader, nameColW) {
    var wd = wkData(master.id);
    var bg = isHeader ? 'var(--panel-2)' : 'var(--card)';
    var html = '<tr style="background:' + bg + '">';
    html += '<td data-uid="' + esc(master.id) + '" style="position:sticky;left:0;background:' + bg + ';z-index:1;padding:6px 8px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-weight:800;color:var(--ink);white-space:nowrap;width:' + nameColW + 'px;overflow:hidden;text-overflow:ellipsis">' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + (master.color || '#94a3b8') + ';margin-right:6px"></span>' +
      '👷 ' + esc(master.full_name) + ' <span style="color:var(--muted);font-weight:700;font-size:11.5px">· ' + wd.hours + ' ч · ' + wd.sched + (wd.sched === '2/2' ? ' (' + esc(wd.cycle) + ')' : '') + '</span>' +
      '</td>';
    for (var li = 0; li < lead; li++) html += '<td style="border-bottom:1px solid var(--line);width:' + colW + 'px"></td>';
    var wOrAbs = 0, wOff = 0, wAbs = 0;
    for (var dd = 1; dd <= dim; dd++) {
      var ds = wm.y + '-' + String(wm.m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var st = wkDayState(master.id, ds);
      var bg2 = st === 'work' ? '#dcfce7' : (st === 'abs' ? '#fee2e2' : '#f1f5f9');
      var bd2 = st === 'work' ? '#16a34a' : (st === 'abs' ? '#dc2626' : '#cbd5e1');
      html += schCellHtml(master, ds, st, bg2, bd2, colW, wm, dd);
      if (st === 'work') wOrAbs++; else if (st === 'abs') wAbs++; else wOff++;
    }
    html += '</tr>';
    return html;
  }
  function schWorkerRow(worker, wm, lead, dim, colW, nameColW) {
    var wd = wkData(worker.id);
    var bg = 'var(--card)';
    var html = '<tr>';
    html += '<td data-uid="' + esc(worker.id) + '" style="position:sticky;left:0;background:' + bg + ';z-index:1;padding:4px 8px 4px 24px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);color:var(--ink);white-space:nowrap;width:' + nameColW + 'px;overflow:hidden;text-overflow:ellipsis;font-size:11px">' +
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (worker.color || '#94a3b8') + ';margin-right:6px"></span>' +
      esc(worker.full_name) + ' <span style="color:var(--muted);font-weight:700;font-size:9.5px">· ' + wd.sched + '</span></td>';
    for (var li = 0; li < lead; li++) html += '<td style="border-bottom:1px solid var(--line);width:' + colW + 'px"></td>';
    for (var dd = 1; dd <= dim; dd++) {
      var ds = wm.y + '-' + String(wm.m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var st = wkDayState(worker.id, ds);
      var bg2 = st === 'work' ? '#dcfce7' : (st === 'abs' ? '#fee2e2' : '#f1f5f9');
      var bd2 = st === 'work' ? '#16a34a' : (st === 'abs' ? '#dc2626' : '#cbd5e1');
      html += schCellHtml(worker, ds, st, bg2, bd2, colW, wm, dd);
    }
    html += '</tr>';
    return html;
  }
  // 22.09-204: длительность рабочего дня по графику смен (подсказка ячейки «на работе»).
  // 12-часовая смена: мастер — 12 ч, слесарь — 11,5 ч (в любой рабочий день, включая выходные);
  // 8-часовая смена (5/2): мастер и слесарь — пн–чт 8,25 ч, пт 7 ч.
  function schDayHours(user, ds) {
    var wd = wkData(user.id);
    // 22.09-207: если для дня вручную заданы часы — берём их
    var ov = wd.overrides && wd.overrides[ds];
    if (ov && ov.s === 'work' && isFinite(+ov.h) && +ov.h > 0) return +ov.h;
    if (+wd.hours === 12) return (user && user.role === 'slesar') ? 11.5 : 12;
    var p = String(ds).split('-');
    var dow = new Date(+p[0], +p[1] - 1, +p[2]).getDay(); // 5 — пятница
    return (dow === 5) ? 7 : 8.25;
  }
  function schCellHtml(user, ds, state, bg, bd, colW, wm, dd) {
    var can = wkCanEdit(user);
    var dt = new Date(wm.y, wm.m, dd);
    var isToday = sameDay(dt, TODAY);
    var _hol = holidayOn(ds); // 22.09-109: праздник — жёлтый поверх любого состояния
    if (_hol) { bg = '#fef9c3'; bd = '#eab308'; }
    var title = state === 'work' ? (esc(ds) + ' · рабочий · ' + fmtH3(schDayHours(user, ds)) + ' ч') // 22.09-204
              : state === 'abs'  ? (esc(ds) + ' · отсутствие' + (wkData(user.id).abs[ds] ? ' (' + esc(wkData(user.id).abs[ds]) + ')' : ''))
              : (esc(ds) + ' · выходной');
    if (_hol) title += ' · 🎉 ' + esc(_hol) + ' (праздник)';
    // Подсветка «сегодня» — только снизу и слева (inset 0/2px), чтобы не ломать общую сетку.
    // 22.09-207: дни с ручным изменением графика — синяя риска снизу + пометка в подсказке
    var _ov = (wkData(user.id).overrides || {})[ds];
    var _sh = [];
    if (isToday) _sh.push('inset 2px 0 0 0 rgba(37,99,235,.4)', 'inset 0 2px 0 0 rgba(37,99,235,.4)');
    if (_ov && _ov.s) _sh.push('inset 0 -2px 0 0 rgba(37,99,235,.85)');
    var ring = _sh.length ? ';box-shadow:' + _sh.join(',') : '';
    if (_ov && _ov.s) title += ' · ✏ изменён вручную';
    var act = state === 'abs' ? 'wk-open-day' : 'wk-quick-abs';
    // 22.09-211: правка графика — только в окне «✏ Изменить график»; ячейка — про отсутствие
    // Полная окантовка 4-х сторон (border:1px solid). При border-spacing:0 и border-collapse:separate
    // на стыке двух одинаковых ячеек получается 2px (1px бордюр одной + 1px другой).
    return '<td data-action="' + (can ? act : '') + '" data-uid="' + esc(user.id) + '" data-ds="' + ds + '"' +
      (can ? ' role="button"' : '') +
      ' title="' + title + '" style="width:' + colW + 'px;height:22px;padding:0;background:' + bg + ';background-color:' + bg + ';border:1px solid ' + bd + ';cursor:' + (can ? 'pointer' : 'default') + ring + '"></td>';
  }
  // Под каждой бригадой — итог: рабочих / выходных / отсутствий за месяц
  // Годовая таблица графика смен — 12 месяцев × N работников.
  // В каждой ячейке-месяце — три значения (раб / вых / отс) цветом.
  // Используется в renderSchedulesYear (отдельный экран) и в schYearBlock (блок под месяцем).
  function renderSchedulesYear(v, users, masters, slesars, wm) {
    var y = wm.y;
    var curMode = S.schMode || 'all';
    var showRows = buildBrigadeRows(masters, slesars, curMode);

    var html2 = '';
    html2 += schYearHeader(y, users, masters, slesars);
    if (!showRows.length) {
      html2 += '<div class="empty" style="padding:30px">Нет работников в выбранном режиме</div>';
    } else {
      html2 += schYearTable(showRows, y);
      // Карточки по бригадам — ФИО + профессия, мастер + слесари рядом
      html2 += schBrigadeCards(showRows, y, { kind: 'year', y: y, m: 0 });
    }
    var card = document.createElement('div');
    card.innerHTML = html2;
    while (card.firstChild) v.appendChild(card.firstChild);
  }

  function buildBrigadeRows(masters, slesars, curMode) {
    var rows = [];
    masters.forEach(function (m) {
      var members = slesars.filter(function (s) { return wkData(s.id).brigade === m.id; });
      rows.push({ kind: 'brigade', master: m, members: members });
    });
    var free = slesars.filter(function (s) {
      var b = wkData(s.id).brigade;
      return !b || !masters.some(function (mm) { return mm.id === b; });
    });
    if (free.length) rows.push({ kind: 'free', master: null, members: free });
    if (curMode === 'free') {
      return rows.filter(function (r) { return r.kind === 'free'; });
    } else if (curMode.indexOf('b:') === 0) {
      var mbId = curMode.slice(2);
      return rows.filter(function (r) { return r.kind === 'brigade' && r.master && r.master.id === mbId; });
    }
    return rows;
  }

  // Шапка + легенда для годовой таблицы
  function schYearHeader(y, users, masters, slesars) {
    var html = '';
    html += '<div class="card" style="margin-bottom:14px"><div class="card-h"><h2>📅 Графики смен — ' + y + ' год</h2>';
    html += '<span class="sub">' + masters.length + ' бригад · ' + slesars.length + ' слесарей · ' + users.length + ' чел.</span></div></div>';
    html += '<div style="display:flex;gap:14px;align-items:center;font-size:12px;color:var(--muted);margin-bottom:10px;flex-wrap:wrap;font-weight:700">' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background-color:#dcfce7;border:1px solid #16a34a"></span>рабочий по графику</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background-color:#f1f5f9;border:1px solid #cbd5e1"></span>выходной по графику</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background-color:#fee2e2;border:1px solid #dc2626"></span>отсутствие</span>' +
      '</div>';
    return html;
  }

  // Годовая таблица: сотрудник × 12 месяцев (в каждом месяце 3 ячейки: раб/вых/отс)
  function schYearTable(showRows, y) {
    // Соберём всех юзеров из showRows в плоский список (мастер + слесари по бригадам + свободные).
    var allUsers = [];
    showRows.forEach(function (row) {
      if (row.kind === 'brigade') {
        allUsers.push({ u: row.master, isM: true });
        row.members.forEach(function (s) { allUsers.push({ u: s, isM: false }); });
      } else {
        row.members.forEach(function (s) { allUsers.push({ u: s, isM: false }); });
      }
    });
    if (!allUsers.length) return '';
    // Ширина колонки ФИО — по самому широкому
    var nameColW = 200;
    allUsers.forEach(function (x) {
      var approx = (x.u.full_name || '').length * 7 + 60;
      if (approx > nameColW) nameColW = approx;
    });
    if (nameColW > 360) nameColW = 360;
    var monthW = 78; // ширина ячейки месяца
    var html = '<div style="overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)">';
    html += '<table style="border-collapse:separate;border-spacing:0;width:auto;font-size:11px">';
    // Шапка: ФИО + 12 месяцев
    html += '<thead><tr style="background:var(--panel-2)">';
    html += '<th rowspan="2" style="position:sticky;left:0;background:var(--panel-2);z-index:2;padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-size:11px;color:var(--muted);font-weight:700;width:' + nameColW + 'px">Сотрудник</th>';
    for (var mm = 0; mm < 12; mm++) {
      html += '<th colspan="3" style="padding:4px 8px;font-size:11px;color:var(--ink);border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;font-weight:800;min-width:' + monthW + 'px">' + MON_NOM[mm] + '</th>';
    }
    // 22.09-217: справа — колонка с количеством рабочих часов за выбранный год
    html += '<th rowspan="2" title="Сумма рабочих часов за год" style="padding:4px 8px;font-size:10px;color:#1d4ed8;border-bottom:1px solid var(--line);text-align:center;font-weight:800;white-space:nowrap;background:var(--panel-2)">⏱ часы<br>за год</th>';
    html += '</tr><tr style="background:var(--panel-2)">';
    for (var mm2 = 0; mm2 < 12; mm2++) {
      html += '<th style="padding:2px 4px;font-size:9.5px;color:#16a34a;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-weight:800">раб</th>';
      html += '<th style="padding:2px 4px;font-size:9.5px;color:#94a3b8;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-weight:800">вых</th>';
      html += '<th style="padding:2px 4px;font-size:9.5px;color:#dc2626;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-weight:800">отс</th>';
    }
    html += '</tr></thead><tbody>';
    allUsers.forEach(function (x) {
      var u = x.u;
      html += '<tr>';
      html += '<td style="position:sticky;left:0;background:var(--card);z-index:1;padding:5px 10px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);color:var(--ink);white-space:nowrap;width:' + nameColW + 'px;font-weight:' + (x.isM ? '800' : '600') + '">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (u.color || '#94a3b8') + ';margin-right:6px"></span>' +
        esc(u.full_name) + (x.isM ? ' <span style="color:var(--muted);font-weight:700;font-size:10px">(мастер)</span>' : '') + '</td>';
      var yH = 0; // 22.09-217: рабочие часы за год
      for (var mm3 = 0; mm3 < 12; mm3++) {
        var dim = new Date(y, mm3 + 1, 0).getDate();
        var mw = 0, mo = 0, ma = 0;
        for (var dd = 1; dd <= dim; dd++) {
          var ds = y + '-' + String(mm3 + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
          var st = wkDayState(u.id, ds);
          if (st === 'work') { mw++; yH += schDayHours(u, ds); } else if (st === 'abs') ma++; else mo++;
        }
        html += '<td data-uid="' + esc(u.id) + '" data-month="' + (mm3 + 1) + '" style="padding:3px 4px;font-weight:800;color:#16a34a;text-align:center;border-left:1px solid var(--line);border-bottom:1px solid var(--line);background-color:' + (mw > 0 ? '#dcfce7' : '#fff') + '">' + mw + '</td>';
        html += '<td data-uid="' + esc(u.id) + '" data-month="' + (mm3 + 1) + '" style="padding:3px 4px;font-weight:800;color:#94a3b8;text-align:center;border-bottom:1px solid var(--line);background-color:' + (mo > 0 ? '#f1f5f9' : '#fff') + '">' + mo + '</td>';
        html += '<td data-uid="' + esc(u.id) + '" data-month="' + (mm3 + 1) + '" style="padding:3px 4px;font-weight:800;color:#dc2626;text-align:center;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background-color:' + (ma > 0 ? '#fee2e2' : '#fff') + '">' + ma + '</td>';
      }
      html += '<td title="Рабочие часы за ' + y + ' год" style="padding:3px 8px;font-weight:800;color:#1d4ed8;text-align:center;border-left:1px solid var(--line);border-bottom:1px solid var(--line);background-color:#eff6ff;white-space:nowrap">⏱ ' + fmtH3(yH) + ' ч</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // Карточки бригад внизу (ФИО + профессия, мастер и слесари рядом, каждый мастер с новой строки)
  // Карточки бригад внизу (ФИО + профессия, мастер и слесари рядом, каждый мастер с новой строки).
  // period = {kind:'month', y, m} или {kind:'year', y, m:0}
  function schBrigadeCards(showRows, y, period) {
    var periodLabel = period && period.kind === 'year' ? (y + ' год') : (MON_NOM[period.m] + ' ' + y);
    var html = '<div style="margin-top:18px;display:flex;flex-direction:column;gap:14px">';
    showRows.forEach(function (row) {
      if (row.kind === 'brigade') {
        var m = row.master;
        html += '<div style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--card)">';
        html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">👷 Бригада мастера ' + esc(m.full_name) + ' · ' + periodLabel + '</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start">';
        // Мастер и слесари рядом (на одной строке)
        html += schBrigadePersonCard(m, true, period);
        row.members.forEach(function (s) { html += schBrigadePersonCard(s, false, period); });
        html += '</div></div>';
      } else {
        html += '<div style="border:1px dashed var(--line);border-radius:12px;padding:10px 12px;background:var(--card)">';
        html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Слесари без бригады · ' + periodLabel + '</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start">';
        row.members.forEach(function (s) { html += schBrigadePersonCard(s, false, period); });
        html += '</div></div>';
      }
    });
    html += '</div>';
    return html;
  }
  // Блок «График за год» под месячной таблицей. Отступ 30px сверху.
  // Использует S.schYear (по умолчанию — текущий год). S.schYear меняется через селектор.
  function schYearBlock(users, masters, slesars, curMode) {
    if (S.schYear == null) S.schYear = (typeof TODAY === 'object' ? TODAY.getFullYear() : new Date().getFullYear());
    var y = S.schYear;
    var showRows = buildBrigadeRows(masters, slesars, curMode);
    var html = '<div style="margin-top:30px;padding-top:18px;border-top:1px solid var(--line)">';
    // Заголовок с селектором года
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">';
    html += '<h3 style="margin:0;font-size:15px;color:var(--ink)">📊 График за год</h3>';
    html += '<span style="display:inline-flex;align-items:center;gap:6px;margin-left:8px">';
    html += '<label style="font-size:12px;color:var(--muted);font-weight:700">Год:</label>';
    var yearOpts = '';
    var yNow = (typeof TODAY === 'object' ? TODAY.getFullYear() : new Date().getFullYear());
    for (var yy = yNow - 3; yy <= yNow + 3; yy++) {
      yearOpts += '<option value="' + yy + '"' + (yy === y ? ' selected' : '') + '>' + yy + '</option>';
    }
    html += '<select data-action="sch-year" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;background:var(--card)">' + yearOpts + '</select>';
    html += '</span>';
    html += '<span class="sub" style="font-size:12px">' + y + ' год — ' + masters.length + ' бригад · ' + slesars.length + ' слесарей</span>';
    html += '<span style="margin-left:auto;display:flex;gap:6px">';
    html += '<button type="button" class="btn sm" data-action="sch-year-print" title="Печать годового графика" style="background:#475569;color:#fff;border-color:#475569">🖨 Печать</button>';
    html += '<button type="button" class="btn sm" data-action="sch-year-excel" title="Скачать в Excel" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-color:#15803d">📥 Excel</button>';
    html += '</span>';
    html += '</div>';
    // Легенда
    html += '<div style="display:flex;gap:14px;align-items:center;font-size:12px;color:var(--muted);margin-bottom:10px;flex-wrap:wrap;font-weight:700">' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background-color:#dcfce7;border:1px solid #16a34a"></span>рабочий по графику</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background-color:#f1f5f9;border:1px solid #cbd5e1"></span>выходной</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background-color:#fee2e2;border:1px solid #dc2626"></span>отсутствие</span>' +
      '</div>';
    // Таблица
    if (!showRows.length) {
      html += '<div class="empty" style="padding:30px">Нет работников в выбранном режиме</div>';
    } else {
      html += schYearTable(showRows, y);
      // Карточки по бригадам — ФИО + профессия, мастер + слесари рядом
      html += schBrigadeCards(showRows, y, { kind: 'year', y: y, m: 0 });
    }
    html += '</div>';
    return html;
  }

  // Карточка работника: ФИО сверху, профессия под ним. Итоги — за выбранный период (месяц/год).
  // 22.09-217: карточка показывает и КОЛИЧЕСТВО РАБОЧИХ ЧАСОВ за период (pH).
  function schBrigadePersonCard(u, isMaster, period) {
    var pW = 0, pO = 0, pA = 0, pH = 0;
    if (period.kind === 'year') {
      var yy = period.y;
      for (var mm = 0; mm < 12; mm++) {
        var dim = new Date(yy, mm + 1, 0).getDate();
        for (var d = 1; d <= dim; d++) {
          var ds = yy + '-' + String(mm + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          var st = wkDayState(u.id, ds);
          if (st === 'work') { pW++; pH += schDayHours(u, ds); } else if (st === 'abs') pA++; else pO++;
        }
      }
    } else {
      var dim2 = new Date(period.y, period.m + 1, 0).getDate();
      for (var d2 = 1; d2 <= dim2; d2++) {
        var ds2 = period.y + '-' + String(period.m + 1).padStart(2, '0') + '-' + String(d2).padStart(2, '0');
        var st2 = wkDayState(u.id, ds2);
        if (st2 === 'work') { pW++; pH += schDayHours(u, ds2); } else if (st2 === 'abs') pA++; else pO++;
      }
    }
    var prof = wkProfLabel(u) || '';
    // 22.09-222: карточка — не шире 200 px; длинные ФИО/должность обрезаются с троеточием, как было раньше
    return '<div style="flex:0 0 auto;width:200px;max-width:200px;border:1px solid var(--line);border-bottom:4px solid ' + (u.color || '#94a3b8') + ';border-radius:12px;padding:8px 10px;background:var(--panel-2);display:flex;flex-direction:column;gap:4px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        avaHtml(u, 34, 12.5) + // 22.09-219: фото-аватар, если загружен
        '<div style="display:flex;flex-direction:column;line-height:1.2;min-width:0;flex:1">' +
          '<b title="' + esc(u.full_name) + '" style="font-size:12px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(u.full_name) + '</b>' + // 22.09-222: длинное ФИО снова обрезаем (полное — в подсказке при наведении)
          '<span title="' + esc(prof) + (isMaster ? ' · мастер' : '') + '" style="font-size:10.5px;color:var(--muted);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(prof) + (isMaster ? ' · мастер' : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;font-size:10.5px;font-weight:700;margin-top:4px;flex-wrap:wrap">' +
        '<span style="color:#16a34a">● ' + pW + ' раб</span>' +
        '<span style="color:#94a3b8">● ' + pO + ' вых</span>' +
        '<span style="color:#dc2626">● ' + pA + ' отс</span>' +
      '</div>' +
      // 22.09-217: рабочие часы за выбранный период (месяц на карточке месяца, год — на годовой)
      '<div title="Количество рабочих часов за ' + (period && period.kind === 'year' ? (period.y + ' год') : (MON_NOM[period.m] + ' ' + period.y)) + '" style="font-size:11px;font-weight:800;color:#1d4ed8">⏱ ' + fmtH3(pH) + ' ч <span style="font-weight:700;color:var(--muted);font-size:9.5px">· ' + (period && period.kind === 'year' ? ('за ' + period.y + ' год') : ('за ' + MON_NOM[period.m])) + '</span></div>' +
      '</div>';
  }

  function wireSchedulesControls(v) {
    // Месяц: ‹ / ›
    v.querySelectorAll('[data-action="sch-month-prev"]').forEach(function (b) {
      b.addEventListener('click', function () { wkShiftMonth(-1); renderSchedules(); });
    });
    v.querySelectorAll('[data-action="sch-month-next"]').forEach(function (b) {
      b.addEventListener('click', function () { wkShiftMonth(1); renderSchedules(); });
    });
    // Год: селектор
    var ys = v.querySelector('select[data-action="sch-year"]');
    // 22.09-211: открыть окно редактора графика
    var eT = v.querySelector('[data-action="sch-ed-open"]');
    if (eT) eT.addEventListener('click', function () { openSchEditorModal(); });
    if (ys) ys.addEventListener('change', function () {
      S.schYear = parseInt(ys.value, 10) || new Date().getFullYear();
      renderSchedules();
    });
    var sel = v.querySelector('select[data-action="sch-mode"]');
    if (sel) sel.addEventListener('change', function () { S.schMode = sel.value; renderSchedules(); });
    // Кнопка «Полный график» в строке бригады
    v.querySelectorAll('[data-action="brig-full-schedule"]').forEach(function (b) {
      b.addEventListener('click', function () { openBrigadeFullSchedule(b.getAttribute('data-uid')); });
    });
    // Печать и Excel месяца
    var pBtn = v.querySelector('[data-action="sch-print"]');
    if (pBtn) pBtn.addEventListener('click', function () { schPrintCurrent('month'); });
    var eBtn = v.querySelector('[data-action="sch-excel"]');
    if (eBtn) eBtn.addEventListener('click', function () { schExcelCurrent('month'); });
    // Печать и Excel года
    var pBtnY = v.querySelector('[data-action="sch-year-print"]');
    if (pBtnY) pBtnY.addEventListener('click', function () { schPrintCurrent('year'); });
    var eBtnY = v.querySelector('[data-action="sch-year-excel"]');
    if (eBtnY) eBtnY.addEventListener('click', function () { schExcelCurrent('year'); });
  }

  // Текущая таблица графика смен (живёт в #view) — собираем данные из DOM.
  // Конвертация rgb(r,g,b) / rgba(r,g,b,a) → #rrggbb. Пусто или прозрачный → null.
  function bgToHex(s) {
    if (!s) return null;
    var m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) {
      // может уже прийти как #hex
      if (s.charAt(0) === '#') return s.toLowerCase();
      return null;
    }
    function pad(n) { var h = parseInt(n, 10).toString(16); return h.length === 1 ? '0' + h : h; }
    return '#' + pad(m[1]) + pad(m[2]) + pad(m[3]);
  }

  // Собрать данные текущего режима (месяц или год).
  // month: { y, m, dim, label, rows: [{uid, name, states:[]}] }
  // year:  { y, kind:'year', rows: [{uid, name, yearData:[{m, w, o, a}]}] }
  // kind: 'month' (по умолчанию) или 'year' (из годового блока)
  function schCollectFor(kind) {
    if (kind === 'year') return schCollectYear();
    return schCollectMonth();
  }
  function schCollectMonth() {
    var table = document.querySelector('#view table');
    var wm = wkMonth();
    var dim = new Date(wm.y, wm.m + 1, 0).getDate();
    var rows = [];

    // Сначала пробуем DOM (быстрее и видим цвета)
    if (table) {
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        var firstTd = tr.querySelector('td');
        if (!firstTd) return;
        var uid = firstTd.getAttribute('data-uid') || '';
        if (!uid) return;
        var name = firstTd.textContent.trim().replace(/\s+/g, ' ');
        var states = [];
        var dayTds = tr.querySelectorAll('td:not([data-uid])');
        dayTds.forEach(function (td) {
          var bg = td.style.backgroundColor || '';
          if (!bg && window.getComputedStyle) {
            try { bg = window.getComputedStyle(td).backgroundColor || ''; } catch (e) {}
          }
          var hex = bgToHex(bg);
          if (hex === '#dcfce7') states.push('work');
          else if (hex === '#fee2e2') states.push('abs');
          else states.push('off');
        });
        rows.push({ uid: uid, name: name, states: states });
      });
    }

    // Если DOM-парсинг ничего не дал (или все off) — генерируем программно через wkDayState.
    var allOff = !rows.length || rows.every(function (r) { return !r.states || !r.states.length || r.states.every(function (s) { return s === 'off'; }); });
    if (allOff) {
      var users = wkVisibleUsers();
      var masters = users.filter(function (u) { return u.role === 'master'; });
      var slesars = users.filter(function (u) { return u.role === 'slesar'; });
      var curMode = S.schMode || 'all';
      var showRows = buildBrigadeRows(masters, slesars, curMode);
      rows = [];
      showRows.forEach(function (row) {
        if (row.kind === 'brigade') {
          addMonthRow(rows, row.master, wm, dim);
          row.members.forEach(function (s) { addMonthRow(rows, s, wm, dim); });
        } else {
          row.members.forEach(function (s) { addMonthRow(rows, s, wm, dim); });
        }
      });
    }

    return { kind: 'month', y: wm.y, m: wm.m, dim: dim, label: MON_NOM[wm.m] + ' ' + wm.y, rows: rows };
  }
  // Вспомогательная функция для программного расчёта строки месяца
  function addMonthRow(rows, u, wm, dim) {
    var states = [];
    for (var dd = 1; dd <= dim; dd++) {
      var ds = wm.y + '-' + String(wm.m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var st = wkDayState(u.id, ds);
      if (st === 'work') states.push('work');
      else if (st === 'abs') states.push('abs');
      else states.push('off');
    }
    rows.push({ uid: u.id, name: u.full_name, states: states });
  }
  function schCollectYear() {
    var y = S.schYear != null ? S.schYear : new Date().getFullYear();
    // На странице «Графики смен» теперь две таблицы: первая = месяц, вторая = год.
    var tables = document.querySelectorAll('#view table');
    var table = tables.length > 1 ? tables[1] : tables[0];
    if (!table) return null;
    var users = wkVisibleUsers();
    var masters = users.filter(function (u) { return u.role === 'master'; });
    var slesars = users.filter(function (u) { return u.role === 'slesar'; });
    var curMode = S.schMode || 'all';
    var showRows = buildBrigadeRows(masters, slesars, curMode);
    var usersList = [];
    showRows.forEach(function (row) {
      if (row.kind === 'brigade') {
        usersList.push(row.master);
        row.members.forEach(function (s) { usersList.push(s); });
      } else {
        row.members.forEach(function (s) { usersList.push(s); });
      }
    });

    // Сначала пробуем прочитать из DOM
    var domRows = [];
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      var firstTd = tr.querySelector('td');
      if (!firstTd) return;
      var uid = firstTd.getAttribute('data-uid') || '';
      if (!uid) return;
      var name = firstTd.textContent.trim().replace(/\s+/g, ' ');
      var yearData = [];
      var byMonth = {};
      tr.querySelectorAll('td[data-month]').forEach(function (td) {
        var m = parseInt(td.getAttribute('data-month'), 10);
        if (!byMonth[m]) byMonth[m] = {};
        var label = (td.textContent || '').trim();
        var num = parseInt(label, 10) || 0;
        var color = td.style.color || '';
        if (!color && window.getComputedStyle) {
          try { color = window.getComputedStyle(td).color || ''; } catch (e) {}
        }
        // rgb(22,163,74)=зелёный, rgb(100,116,139)=серый, rgb(220,38,38)=красный. Также принимаем hex.
        if (color === 'rgb(22, 163, 74)' || color === '#16a34a') byMonth[m].w = num;
        else if (color === 'rgb(100, 116, 139)' || color === '#64748b' || color === 'rgb(148, 163, 184)' || color === '#94a3b8') byMonth[m].o = num;
        else if (color === 'rgb(220, 38, 38)' || color === '#dc2626') byMonth[m].a = num;
        else {
          // Fallback по фону ячейки
          var bg2 = td.style.backgroundColor || '';
          if (!bg2 && window.getComputedStyle) {
            try { bg2 = window.getComputedStyle(td).backgroundColor || ''; } catch (e) {}
          }
          var hex = bgToHex(bg2);
          if (hex === '#dcfce7') byMonth[m].w = num;
          else if (hex === '#f1f5f9') byMonth[m].o = num;
          else if (hex === '#fee2e2') byMonth[m].a = num;
        }
      });
      for (var mm = 1; mm <= 12; mm++) {
        yearData.push({ m: mm, w: (byMonth[mm] && byMonth[mm].w) || 0, o: (byMonth[mm] && byMonth[mm].o) || 0, a: (byMonth[mm] && byMonth[mm].a) || 0 });
      }
      domRows.push({ uid: uid, name: name, yearData: yearData });
    });

    // Если DOM пустой или у всех нули — генерируем программно через wkDayState.
    var needProg = !domRows.length || domRows.every(function (r) { return r.yearData.every(function (m) { return !m.w && !m.o && !m.a; }); });
    if (needProg && usersList.length) {
      domRows = [];
      usersList.forEach(function (u) {
        var yearData = [];
        for (var m2 = 0; m2 < 12; m2++) {
          var dim = new Date(y, m2 + 1, 0).getDate();
          var w = 0, o = 0, a = 0;
          for (var d = 1; d <= dim; d++) {
            var ds = y + '-' + String(m2 + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            var st = wkDayState(u.id, ds);
            if (st === 'work') w++; else if (st === 'abs') a++; else o++;
          }
          yearData.push({ m: m2 + 1, w: w, o: o, a: a });
        }
        domRows.push({ uid: u.id, name: u.full_name, yearData: yearData });
      });
    }
    return { kind: 'year', y: y, label: String(y), rows: domRows };
  }
  // Конвертация rgb(r,g,b) / rgba(r,g,b,a) → #rrggbb. Пусто или прозрачный → null.

  // Печать текущего вида «Графики смен» — таблица всегда в ширину страницы (A4 landscape).
  // mode: 'month' (по умолчанию) или 'year' (из годового блока).
  function schPrintCurrent(mode) {
    var data = schCollectFor(mode === 'year' ? 'year' : 'month');
    if (!data || !data.rows.length) { toast('err', 'Нет данных для печати'); return; }
    if (data.kind === 'year') return schPrintYear(data);
    return schPrintMonth(data);
  }
  function schPrintMonth(data) {
    var w = window.open('', '_blank');
    if (!w) { toast('err', 'Разрешите всплывающие окна для печати'); return; }
    var title = 'Графики смен — ' + data.label;
    var nameColPx = 220;
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>' +
        'body{font-family:Arial,sans-serif;color:#000;padding:6mm;margin:0}' +
        'h1{font-size:14px;margin:0 0 4px}' +
        '.legend{display:flex;gap:10px;margin-bottom:6px;font-size:11.5px;flex-wrap:wrap}' +
        '.legend span{display:inline-flex;gap:4px;align-items:center}' +
        '.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid #888}' +
        'table{border-collapse:collapse;table-layout:fixed;width:100%;margin-top:6px}' +
        'th,td{border:1px solid #999;padding:0;text-align:center;font-size:10.5px;height:18px}' +
        'th{background:#e2e8f0;font-weight:700;padding:2px}' +
        'td.stick{background:#f8fafc;text-align:left;white-space:nowrap;font-weight:700;padding:2px 6px}' +
        '.work{background-color:#dcfce7}.off{background-color:#fff}.abs{background-color:#fee2e2}' +
        '@page{landscape;margin:8mm}' +
        '@media print{.no-print{display:none} body{padding:0}}' +
      '</style>' +
      '</head><body>';
    html += '<h1>' + esc(title) + '</h1>';
    html += '<div class="legend"><span><i style="background-color:#dcfce7"></i>рабочий</span><span><i style="background-color:#fff"></i>выходной</span><span><i style="background-color:#fee2e2"></i>отсутствие</span><span style="margin-left:auto">Печать: ' + esc(new Date().toLocaleString('ru-RU')) + '</span></div>';
    html += '<table><colgroup><col style="width:' + nameColPx + 'px">';
    for (var dd = 1; dd <= data.dim; dd++) html += '<col>';
    html += '</colgroup><thead><tr><th>Сотрудник</th>';
    for (var dd2 = 1; dd2 <= data.dim; dd2++) html += '<th>' + dd2 + '</th>';
    html += '</tr></thead><tbody>';
    data.rows.forEach(function (r) {
      html += '<tr><td class="stick">' + esc(r.name) + '</td>';
      for (var i = 0; i < data.dim; i++) {
        var cls = r.states[i] || 'off';
        html += '<td class="' + cls + '"></td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '<div class="no-print" style="margin-top:14px"><button onclick="window.print()" style="padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Печатать</button></div>';
    html += '<scr' + 'ipt>setTimeout(function(){window.print();},250);</scr' + 'ipt>';
    html += '</body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }
  function schPrintYear(data) {
    var w = window.open('', '_blank');
    if (!w) { toast('err', 'Разрешите всплывающие окна для печати'); return; }
    var title = 'Графики смен — ' + data.y + ' год';
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>' +
        'body{font-family:Arial,sans-serif;color:#000;padding:6mm;margin:0}' +
        'h1{font-size:14px;margin:0 0 4px}' +
        'table{border-collapse:collapse;table-layout:fixed;width:100%;margin-top:6px;font-size:11.5px}' +
        'th,td{border:1px solid #999;padding:2px;text-align:center;height:18px}' +
        'th{background:#e2e8f0;font-weight:700}' +
        'td.stick{background:#f8fafc;text-align:left;white-space:nowrap;font-weight:700;padding:2px 6px}' +
        'td.w{color:#16a34a;font-weight:700}' +
        'td.o{color:#64748b;font-weight:700}' +
        'td.a{color:#dc2626;font-weight:700}' +
        '@page{landscape;margin:8mm}' +
        '@media print{.no-print{display:none} body{padding:0}}' +
      '</style>' +
      '</head><body>';
    html += '<h1>' + esc(title) + '</h1>';
    html += '<table><colgroup><col style="width:240px">';
    for (var mm = 0; mm < 12; mm++) html += '<col><col><col>';
    html += '</colgroup><thead><tr><th rowspan="2" style="width:240px">Сотрудник</th>';
    for (var mm2 = 0; mm2 < 12; mm2++) html += '<th colspan="3">' + MON_NOM[mm2] + '</th>';
    html += '</tr><tr>';
    for (var mm3 = 0; mm3 < 12; mm3++) html += '<th style="color:#16a34a">раб</th><th style="color:#64748b">вых</th><th style="color:#dc2626">отс</th>';
    html += '</tr></thead><tbody>';
    data.rows.forEach(function (r) {
      html += '<tr><td class="stick">' + esc(r.name) + '</td>';
      r.yearData.forEach(function (m) {
        // Закрашиваем ячейку только если значение > 0 — пустые остаются белыми.
        var wBg = m.w > 0 ? 'background-color:#dcfce7;color:#15803d;' : '';
        var oBg = m.o > 0 ? 'background-color:#f1f5f9;color:#64748b;' : '';
        var aBg = m.a > 0 ? 'background-color:#fee2e2;color:#dc2626;' : '';
        html += '<td style="' + wBg + 'font-weight:700">' + (m.w || '') + '</td>';
        html += '<td style="' + oBg + 'font-weight:700">' + (m.o || '') + '</td>';
        html += '<td style="' + aBg + 'font-weight:700">' + (m.a || '') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '<div class="no-print" style="margin-top:14px"><button onclick="window.print()" style="padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Печатать</button></div>';
    html += '<scr' + 'ipt>setTimeout(function(){window.print();},250);</scr' + 'ipt>';
    html += '</body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }

  // Excel текущего вида «Графики смен» — настоящий XLSX с цветными ячейками.
  // mode: 'month' (по умолчанию) или 'year' (из годового блока).
  function schExcelCurrent(mode) {
    var data = schCollectFor(mode === 'year' ? 'year' : 'month');
    if (!data || !data.rows.length) { toast('err', 'Нет данных для экспорта'); return; }
    if (data.kind === 'year') return schExcelYear(data);
    return schExcelMonth(data);
  }
  function schExcelMonth(data) {
    function makeStyle() {
      return { font: { name: 'Calibri', sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'FFCBD5E1' } }, left: { style: 'thin', color: { rgb: 'FFCBD5E1' } }, right: { style: 'thin', color: { rgb: 'FFCBD5E1' } } } };
    }
    function workStyle() { var s = makeStyle(); s.fill = { patternType: 'solid', fgColor: { rgb: 'FFD1FAE5' } }; s.font = { color: { rgb: 'FF14532D' }, bold: true }; return s; }
    function absStyle() { var s = makeStyle(); s.fill = { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }; s.font = { color: { rgb: 'FF7F1D1D' }, bold: true }; return s; }
    function offStyle() { return makeStyle(); }
    function nameStyle() { var s = makeStyle(); s.font = { name: 'Calibri', sz: 10, bold: true }; s.alignment = { horizontal: 'left', vertical: 'center' }; s.fill = { patternType: 'solid', fgColor: { rgb: 'FFF8FAFC' } }; return s; }
    function headStyle() { var s = makeStyle(); s.fill = { patternType: 'solid', fgColor: { rgb: 'FFE2E8F0' } }; s.font = { bold: true }; return s; }
    function sumStyle(color) { var s = makeStyle(); s.font = { bold: true, color: { rgb: color } }; return s; }

    var aoa = [];
    var styles = [];
    aoa.push([{ v: 'Графики смен — ' + data.label, t: 's' }]); styles.push([{ font: { bold: true, sz: 12 } }]);
    aoa.push([]); styles.push([]);
    var headRow = ['Сотрудник'];
    for (var dd = 1; dd <= data.dim; dd++) headRow.push(String(dd));
    headRow.push('раб', 'вых', 'отс');
    aoa.push(headRow); styles.push(headRow.map(function () { return headStyle(); }));
    data.rows.forEach(function (r) {
      var row = [{ v: r.name, t: 's' }];
      var rowStyles = [nameStyle()];
      var w = 0, o = 0, a = 0;
      for (var i = 0; i < data.dim; i++) {
        var st = r.states[i] || 'off';
        if (st === 'work') { row.push(''); rowStyles.push(workStyle()); w++; }
        else if (st === 'abs') { row.push(''); rowStyles.push(absStyle()); a++; }
        else { row.push(''); rowStyles.push(offStyle()); o++; }
      }
      row.push({ v: w, t: 'n' }); rowStyles.push(sumStyle('FF16A34A'));
      row.push({ v: o, t: 'n' }); rowStyles.push(sumStyle('FF64748B'));
      row.push({ v: a, t: 'n' }); rowStyles.push(sumStyle('FFDC2626'));
      aoa.push(row);
      styles.push(rowStyles);
    });
    ensureXlsxStyle().then(function (ok) {
      if (!ok || !window.XLSX_STYLE) { toast('err', 'Библиотека Excel со стилями не загрузилась'); return; }
      // FALLBACK: если states из DOM пустые (старый кэш браузера) — пересчитываем программно.
      var allOff = data.rows.every(function (r) { return !r.states || !r.states.length || r.states.every(function (s) { return s === 'off'; }); });
      if (allOff) {
        for (var rIdx = 0; rIdx < data.rows.length; rIdx++) {
          var rr = data.rows[rIdx];
          rr.states = [];
          for (var d2 = 1; d2 <= data.dim; d2++) {
            var ds2 = data.y + '-' + String(data.m + 1).padStart(2, '0') + '-' + String(d2).padStart(2, '0');
            rr.states.push(wkDayState(rr.uid, ds2));
          }
        }
      }
      var ws = window.XLSX_STYLE.utils.aoa_to_sheet(aoa);
      for (var R = 0; R < styles.length; R++) {
        for (var C = 0; C < styles[R].length; C++) {
          var addr = window.XLSX_STYLE.utils.encode_cell({ r: R, c: C });
          if (ws[addr]) ws[addr].s = styles[R][C];
        }
      }
      ws['!cols'] = [{ wch: 30 }];
      for (var c2 = 0; c2 < data.dim + 3; c2++) ws['!cols'].push({ wch: c2 < data.dim ? 3.5 : 6 });
      var wb = window.XLSX_STYLE.utils.book_new();
      window.XLSX_STYLE.utils.book_append_sheet(wb, ws, data.label.replace(/[\\\/:*?\[\]]/g, '_').slice(0, 28));
      var fname = 'Графики_смен_' + data.y + '-' + String(data.m + 1).padStart(2, '0') + '.xlsx';
      window.XLSX_STYLE.writeFile(wb, fname);
      toast('ok', '✓ Скачан файл: ' + fname);
    });
  }
  function schExcelYear(data) {
    function makeStyle() {
      return { font: { name: 'Calibri', sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'FFCBD5E1' } }, left: { style: 'thin', color: { rgb: 'FFCBD5E1' } }, right: { style: 'thin', color: { rgb: 'FFCBD5E1' } } } };
    }
    function wStyle() { var s = makeStyle(); s.fill = { patternType: 'solid', fgColor: { rgb: 'FFD1FAE5' } }; s.font = { color: { rgb: 'FF16A34A' }, bold: true }; return s; }
    function oStyle() { var s = makeStyle(); s.fill = { patternType: 'solid', fgColor: { rgb: 'FFF1F5F9' } }; s.font = { color: { rgb: 'FF64748B' }, bold: true }; return s; }
    function aStyle() { var s = makeStyle(); s.fill = { patternType: 'solid', fgColor: { rgb: 'FFFEE2E2' } }; s.font = { color: { rgb: 'FFDC2626' }, bold: true }; return s; }
    function nameStyle() { var s = makeStyle(); s.font = { name: 'Calibri', sz: 10, bold: true }; s.alignment = { horizontal: 'left', vertical: 'center' }; s.fill = { patternType: 'solid', fgColor: { rgb: 'FFF8FAFC' } }; return s; }
    function headStyle() { var s = makeStyle(); s.fill = { patternType: 'solid', fgColor: { rgb: 'FFE2E8F0' } }; s.font = { bold: true }; return s; }

    var aoa = [];
    var styles = [];
    aoa.push([{ v: 'Графики смен — ' + data.y + ' год', t: 's' }]); styles.push([{ font: { bold: true, sz: 12 } }]);
    aoa.push([]); styles.push([]);
    // Шапка: ФИО + 12 названий месяцев. Имя месяца — в ПЕРВОЙ ячейке из 3,
    // остальные две пустые (потом объединим через ws['!merges']).
    var headRow1 = [{ v: 'Сотрудник', t: 's' }];
    for (var mm0 = 0; mm0 < 12; mm0++) headRow1.push({ v: MON_NOM[mm0], t: 's' }, '', '');
    aoa.push(headRow1);
    var s1 = [headStyle()];
    for (var mm2 = 0; mm2 < 12; mm2++) { s1.push(headStyle()); s1.push(headStyle()); s1.push(headStyle()); }
    styles.push(s1);
    // Шапка: раб/вых/отс
    var headRow2 = [''];
    for (var mm3 = 0; mm3 < 12; mm3++) headRow2.push('раб', 'вых', 'отс');
    aoa.push(headRow2);
    var s2 = [headStyle()];
    for (var mm4 = 0; mm4 < 12; mm4++) {
      var a1 = headStyle(); a1.font = { bold: true, color: { rgb: 'FF16A34A' } };
      var a2 = headStyle(); a2.font = { bold: true, color: { rgb: 'FF64748B' } };
      var a3 = headStyle(); a3.font = { bold: true, color: { rgb: 'FFDC2626' } };
      s2.push(a1, a2, a3);
    }
    styles.push(s2);
    // FALLBACK: если у всех строк yearData нулевые — пересчитываем программно.
    var allZero = data.rows.every(function (r) { return !r.yearData || !r.yearData.length || r.yearData.every(function (m) { return !m.w && !m.o && !m.a; }); });
    // Строки
    data.rows.forEach(function (r) {
      var row = [{ v: r.name, t: 's' }];
      var rowStyles = [nameStyle()];
      var yd = r.yearData;
      if (allZero) {
        yd = [];
        for (var m5 = 0; m5 < 12; m5++) {
          var dim2 = new Date(data.y, m5 + 1, 0).getDate();
          var ww = 0, oo = 0, aa = 0;
          for (var d3 = 1; d3 <= dim2; d3++) {
            var ds3 = data.y + '-' + String(m5 + 1).padStart(2, '0') + '-' + String(d3).padStart(2, '0');
            var st3 = wkDayState(r.uid, ds3);
            if (st3 === 'work') ww++; else if (st3 === 'abs') aa++; else oo++;
          }
          yd.push({ m: m5 + 1, w: ww, o: oo, a: aa });
        }
      }
      yd.forEach(function (m) {
        row.push({ v: m.w, t: 'n' }); rowStyles.push(wStyle());
        row.push({ v: m.o, t: 'n' }); rowStyles.push(oStyle());
        row.push({ v: m.a, t: 'n' }); rowStyles.push(aStyle());
      });
      aoa.push(row);
      styles.push(rowStyles);
    });
    ensureXlsxStyle().then(function (ok) {
      if (!ok || !window.XLSX_STYLE) { toast('err', 'Библиотека Excel со стилями не загрузилась'); return; }
      var ws = window.XLSX_STYLE.utils.aoa_to_sheet(aoa);
      for (var R = 0; R < styles.length; R++) {
        for (var C = 0; C < styles[R].length; C++) {
          var addr = window.XLSX_STYLE.utils.encode_cell({ r: R, c: C });
          if (ws[addr]) ws[addr].s = styles[R][C];
        }
      }
      // Объединяем названия месяцев (строка 2, колонки 1, 4, 7, ...) — по 3 ячейки
      var mergesY = [];
      for (var my = 0; my < 12; my++) {
        var startCY = 1 + my * 3;
        mergesY.push({ s: { r: 2, c: startCY }, e: { r: 2, c: startCY + 2 } });
      }
      ws['!merges'] = mergesY;
      ws['!cols'] = [{ wch: 30 }];
      for (var c2 = 0; c2 < 36; c2++) ws['!cols'].push({ wch: 5 });
      var wb = window.XLSX_STYLE.utils.book_new();
      window.XLSX_STYLE.utils.book_append_sheet(wb, ws, String(data.y));
      var fname = 'Графики_смен_' + data.y + '.xlsx';
      window.XLSX_STYLE.writeFile(wb, fname);
      toast('ok', '✓ Скачан файл: ' + fname);
    });
  }

  /* ===== ПОЛНОЭКРАННЫЙ ГРАФИК БРИГАДЫ (месяц / год) =====
     Оверлей на весь экран. Кнопки: печать (window.print) + скачать в Excel (xlsx).
     Те же ячейки-цвета, что в основной таблице графиков смен, но крупно. */
  function openBrigadeFullSchedule(masterId) {
    var master = DB.getUser(masterId);
    if (!master) return;
    var members = wkBrigadeOf(masterId);
    var canEdit = wkCanEdit(master);
    var initialRange = S.brigFullRange || 'month';

    var overlay = document.createElement('div');
    overlay.id = 'brig-full-overlay';
    // Оверлей — полупрозрачный фон на весь экран, центрирует содержимое.
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2000;display:flex;align-items:center;justify-content:center;padding:14px';
    // Внутренний блок подгоняется по высоте под содержимое, но не выше 95% экрана —
    // на маленьких ноутбуках таблица будет скроллиться внутри, а оверлей не уедет.
    overlay.innerHTML =
      '<div style="background:var(--card);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45);width:max-content;max-width:96vw;max-height:95vh">' +
        // Шапка оверлея
        '<div id="brig-full-head" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--panel-2);flex-wrap:wrap">' +
          '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + (master.color || '#94a3b8') + '"></span>' +
          '<b style="font-size:14.5px;color:var(--ink)">Полный график — бригада ' + esc(master.full_name) + '</b>' +
          '<span class="sub" style="font-size:12px">' + (members.length + 1) + ' чел.</span>' +
          '<span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
            '<button type="button" class="btn sm" data-action="bfs-prev" title="Назад">‹</button>' +
            '<select data-action="bfs-mode" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-family:inherit;font-size:12.5px;font-weight:700;background:var(--card)">' +
              '<option value="month"' + (initialRange === 'month' ? ' selected' : '') + '>Месяц</option>' +
              '<option value="year"' + (initialRange === 'year' ? ' selected' : '') + '>Год</option>' +
            '</select>' +
            '<b data-action="bfs-label" style="font-size:13px;color:var(--ink);min-width:140px;text-align:center"></b>' +
            '<button type="button" class="btn sm" data-action="bfs-next" title="Вперёд">›</button>' +
            '<span style="width:1px;height:22px;background:var(--line);margin:0 4px"></span>' +
            '<button type="button" class="btn sm" data-action="bfs-print" title="Печать" style="background:#475569;color:#fff;border-color:#475569">🖨 Печать</button>' +
            '<button type="button" class="btn sm" data-action="bfs-excel" title="Скачать в Excel" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-color:#15803d">📥 Excel</button>' +
            '<button type="button" class="btn sm" data-action="bfs-close" title="Закрыть" style="background:#dc2626;color:#fff;border-color:#dc2626">✕ Закрыть</button>' +
          '</span>' +
        '</div>' +
        // Тело — таблица графика; скроллится только если реально не влезает в 95vh
        '<div id="brig-full-body" style="overflow:auto;padding:14px"></div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeBrigadeFullSchedule(); });
    overlay.querySelector('[data-action="bfs-close"]').addEventListener('click', closeBrigadeFullSchedule);
    overlay.querySelector('[data-action="bfs-mode"]').addEventListener('change', function (e) {
      S.brigFullRange = e.target.value;
      renderBrigFullBody(master, members, canEdit);
    });
    overlay.querySelector('[data-action="bfs-prev"]').addEventListener('click', function () {
      brigFullShift(-1); renderBrigFullBody(master, members, canEdit);
    });
    overlay.querySelector('[data-action="bfs-next"]').addEventListener('click', function () {
      brigFullShift(1); renderBrigFullBody(master, members, canEdit);
    });
    overlay.querySelector('[data-action="bfs-print"]').addEventListener('click', function () { brigFullPrint(master, members, canEdit); });
    overlay.querySelector('[data-action="bfs-excel"]').addEventListener('click', function () { brigFullExcel(master, members, canEdit); });
    // ESC закрывает
    var escH = function (e) { if (e.key === 'Escape') { closeBrigadeFullSchedule(); document.removeEventListener('keydown', escH); } };
    document.addEventListener('keydown', escH);
    S.brigFullMaster = masterId;
    S.brigFullAnchor = S.brigFullAnchor || TODAY.toISOString().slice(0, 10); // первая точка диапазона
    renderBrigFullBody(master, members, canEdit);
  }

  function closeBrigadeFullSchedule() {
    var ov = document.getElementById('brig-full-overlay');
    if (ov) ov.remove();
  }

  function brigFullShift(dn) {
    // anchor сдвигаем на ±1 месяц или ±1 год
    var mode = S.brigFullRange || 'month';
    var parts = (S.brigFullAnchor || key(TODAY)).split('-');
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (mode === 'month') d.setMonth(d.getMonth() + dn);
    else d.setFullYear(d.getFullYear() + dn);
    S.brigFullAnchor = d.toISOString().slice(0, 10);
  }

  function brigFullGetRange() {
    var mode = S.brigFullRange || 'month';
    var parts = (S.brigFullAnchor || key(TODAY)).split('-');
    var y = +parts[0], m = +parts[1] - 1;
    if (mode === 'month') {
      var dim = new Date(y, m + 1, 0).getDate();
      return { mode: 'month', y: y, m: m, dim: dim, label: MON_NOM[m] + ' ' + y };
    }
    return { mode: 'year', y: y, label: String(y) };
  }

  function renderBrigFullBody(master, members, canEdit) {
    var body = document.getElementById('brig-full-body');
    var headLabel = document.querySelector('[data-action="bfs-label"]');
    if (!body) return;
    var range = brigFullGetRange();
    if (headLabel) headLabel.textContent = range.label;
    if (range.mode === 'month') {
      body.innerHTML = brigFullMonthTable(master, members, canEdit, range);
    } else {
      body.innerHTML = brigFullYearTable(master, members, canEdit, range);
    }
  }

  function brigFullMonthTable(master, members, canEdit, range) {
    var dim = range.dim;
    var lead = (new Date(range.y, range.m, 1).getDay() + 6) % 7;
    var all = [master].concat(members);
    var colW = 28;
    // Ширина колонки ФИО — по самому длинному ФИО, чтобы строки были ровные.
    var nameColW = 240;
    all.forEach(function (u) {
      var approx = (u.full_name || '').length * 7 + 80;
      if (approx > nameColW) nameColW = approx;
    });
    if (nameColW > 400) nameColW = 400;
    var html = '<div id="bfs-printable">';
    html += '<div style="display:flex;gap:14px;align-items:center;font-size:11px;color:var(--muted);margin-bottom:10px;flex-wrap:wrap;font-weight:700">' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#dcfce7;border:1px solid #16a34a"></span>рабочий по графику</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#f1f5f9;border:1px solid #cbd5e1"></span>выходной</span>' +
      '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:14px;border-radius:3px;background:#fee2e2;border:1px solid #dc2626"></span>отсутствие</span>' +
      '<span style="margin-left:auto;color:var(--ink);font-size:13px"><b>Бригада:</b> ' + esc(master.full_name) + ' · <b>Месяц:</b> ' + range.label + ' · <b>Сотрудников:</b> ' + all.length + '</span>' +
      '</div>';
    html += '<table style="border-collapse:separate;border-spacing:0;width:auto;font-size:11px;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden">';
    html += '<thead><tr style="background:var(--panel-2)">';
    html += '<th style="position:sticky;left:0;background:var(--panel-2);z-index:2;padding:8px 10px;text-align:left;font-size:12px;color:var(--ink);width:' + nameColW + 'px;border-bottom:1px solid var(--line);border-right:1px solid var(--line)">Сотрудник</th>';
    for (var li = 0; li < lead; li++) html += '<th style="width:' + colW + 'px;border-bottom:1px solid var(--line);border-right:1px solid var(--line)"></th>';
    for (var dd = 1; dd <= dim; dd++) {
      var dtH = new Date(range.y, range.m, dd);
      var dowH = dtH.getDay();
      var isWeH = dowH === 0 || dowH === 6;
      var isTodayH = sameDay(dtH, TODAY);
      html += '<th style="width:' + colW + 'px;padding:4px 0;font-size:11px;font-weight:800;color:' + (isWeH ? '#94a3b8' : 'var(--muted)') + ';border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;' + (isTodayH ? 'background:rgba(37,99,235,.1);' : '') + '">' + dd + '</th>';
    }
    // Итог
    html += '<th style="padding:4px 8px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;background:var(--panel-2)">раб</th>';
    html += '<th style="padding:4px 8px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;background:var(--panel-2)">вых</th>';
    html += '<th style="padding:4px 8px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--line);text-align:center;background:var(--panel-2)">отс</th>';
    html += '</tr></thead><tbody>';
    all.forEach(function (u, rowIdx) {
      var isM = u.id === master.id;
      html += '<tr>';
      html += '<td style="position:sticky;left:0;background:var(--card);z-index:1;padding:6px 10px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);color:var(--ink);white-space:nowrap;width:' + nameColW + 'px;font-weight:' + (isM ? '800' : '600') + ';overflow:hidden;text-overflow:ellipsis">' +
        '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + (u.color || '#94a3b8') + ';margin-right:6px"></span>' +
        esc(u.full_name) + (isM ? ' <span style="color:var(--muted);font-weight:700;font-size:10px">(мастер)</span>' : '') + '</td>';
      for (var li = 0; li < lead; li++) html += '<td style="border-bottom:1px solid var(--line);border-right:1px solid var(--line);width:' + colW + 'px"></td>';
      var w = 0, o = 0, a = 0;
      for (var dd = 1; dd <= dim; dd++) {
        var ds = range.y + '-' + String(range.m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
        var st = wkDayState(u.id, ds);
        var bg2 = st === 'work' ? '#dcfce7' : (st === 'abs' ? '#fee2e2' : '#f1f5f9');
        var bd2 = st === 'work' ? '#16a34a' : (st === 'abs' ? '#dc2626' : '#cbd5e1');
        if (st === 'work') w++; else if (st === 'abs') a++; else o++;
        // Полная окантовка вокруг ячейки дня (через box-shadow inset — каждая сторона рисуется отдельно).
        html += '<td title="' + esc(ds) + ' · ' + (st === 'work' ? 'рабочий' : st === 'abs' ? 'отсутствие' : 'выходной') + '" style="width:' + colW + 'px;height:24px;padding:0;background:' + bg2 + ';box-shadow:inset 0 0 0 1px ' + bd2 + '"></td>';
      }
      html += '<td style="padding:4px 8px;font-weight:800;color:#16a34a;text-align:center;background:var(--card);border-bottom:1px solid var(--line);border-left:1px solid var(--line)">' + w + '</td>';
      html += '<td style="padding:4px 8px;font-weight:800;color:#94a3b8;text-align:center;background:var(--card);border-bottom:1px solid var(--line);border-left:1px solid var(--line)">' + o + '</td>';
      html += '<td style="padding:4px 8px;font-weight:800;color:#dc2626;text-align:center;background:var(--card);border-bottom:1px solid var(--line);border-left:1px solid var(--line)">' + a + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '</div>';
    return html;
  }

  function brigFullYearTable(master, members, canEdit, range) {
    var y = range.y;
    var all = [master].concat(members);
    // Сетка: столбец «Сотрудник» + 12 столбцов-месяцев. В каждом месяце — рабочих/выходных/отс.
    var html = '<div id="bfs-printable">';
    html += '<div style="margin-bottom:10px;font-size:12px;color:var(--ink)"><b>Бригада:</b> ' + esc(master.full_name) + ' · <b>Год:</b> ' + y + ' · <b>Сотрудников:</b> ' + all.length + '</div>';
    html += '<table style="border-collapse:separate;border-spacing:0;width:auto;font-size:11px;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden">';
    html += '<thead><tr style="background:var(--panel-2)">';
    html += '<th rowspan="2" style="position:sticky;left:0;background:var(--panel-2);z-index:2;padding:8px 10px;text-align:left;font-size:12px;color:var(--ink);min-width:240px;border-bottom:1px solid var(--line);border-right:1px solid var(--line)">Сотрудник</th>';
    for (var mm = 0; mm < 12; mm++) {
      html += '<th colspan="3" style="padding:4px 8px;font-size:11px;color:var(--ink);border-bottom:1px solid var(--line);border-left:1px solid var(--line);text-align:center;font-weight:800">' + MON_NOM[mm] + '</th>';
    }
    html += '</tr><tr style="background:var(--panel-2)">';
    for (var mm2 = 0; mm2 < 12; mm2++) {
      html += '<th style="padding:3px 4px;font-size:9.5px;color:#16a34a;border-bottom:1px solid var(--line);border-left:1px solid var(--line);min-width:42px">раб</th>';
      html += '<th style="padding:3px 4px;font-size:9.5px;color:#94a3b8;border-bottom:1px solid var(--line);min-width:42px">вых</th>';
      html += '<th style="padding:3px 4px;font-size:9.5px;color:#dc2626;border-bottom:1px solid var(--line);min-width:42px">отс</th>';
    }
    html += '</tr></thead><tbody>';
    var yearTotals = { work: 0, off: 0, abs: 0 };
    all.forEach(function (u, rowIdx) {
      var isM = u.id === master.id;
      html += '<tr>';
      html += '<td style="position:sticky;left:0;background:var(--card);z-index:1;padding:6px 10px;border-bottom:1px solid var(--line);color:var(--ink);white-space:nowrap;min-width:240px;font-weight:' + (isM ? '800' : '600') + ';border-right:1px solid var(--line)">' +
        '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + (u.color || '#94a3b8') + ';margin-right:6px"></span>' +
        esc(u.full_name) + (isM ? ' <span style="color:var(--muted);font-weight:700;font-size:10px">(мастер)</span>' : '') + '</td>';
      var rowW = 0, rowO = 0, rowA = 0;
      for (var mm3 = 0; mm3 < 12; mm3++) {
        var dim = new Date(y, mm3 + 1, 0).getDate();
        var mw = 0, mo = 0, ma = 0;
        for (var dd = 1; dd <= dim; dd++) {
          var ds = y + '-' + String(mm3 + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
          var st = wkDayState(u.id, ds);
          if (st === 'work') mw++; else if (st === 'abs') ma++; else mo++;
        }
        rowW += mw; rowO += mo; rowA += ma;
        html += '<td style="padding:4px;font-weight:800;color:#16a34a;text-align:center;border-left:1px solid var(--line);border-bottom:1px solid var(--line)">' + mw + '</td>';
        html += '<td style="padding:4px;font-weight:800;color:#94a3b8;text-align:center;border-bottom:1px solid var(--line)">' + mo + '</td>';
        html += '<td style="padding:4px;font-weight:800;color:#dc2626;text-align:center;border-bottom:1px solid var(--line)">' + ma + '</td>';
      }
      html += '</tr>';
      yearTotals.work += rowW; yearTotals.off += rowO; yearTotals.abs += rowA;
    });
    // Итог по бригаде за год
    html += '<tr style="background:var(--panel-2)">';
    html += '<td style="position:sticky;left:0;background:var(--panel-2);z-index:1;padding:6px 10px;font-weight:800;color:var(--ink);border-right:1px solid var(--line);border-top:2px solid var(--line)">ИТОГО бригада</td>';
    // Пересчитаем по бригаде (все члены суммарно)
    var yrTotals = { work: 0, off: 0, abs: 0 };
    for (var mm4 = 0; mm4 < 12; mm4++) {
      var dim = new Date(y, mm4 + 1, 0).getDate();
      var mw = 0, mo = 0, ma = 0;
      for (var dd = 1; dd <= dim; dd++) {
        var ds = y + '-' + String(mm4 + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
        all.forEach(function (u) {
          var st = wkDayState(u.id, ds);
          if (st === 'work') mw++; else if (st === 'abs') ma++; else mo++;
        });
      }
      yrTotals.work += mw; yrTotals.off += mo; yrTotals.abs += ma;
      html += '<td style="padding:4px;font-weight:800;color:#16a34a;text-align:center;border-left:1px solid var(--line);border-top:2px solid var(--line)">' + mw + '</td>';
      html += '<td style="padding:4px;font-weight:800;color:#94a3b8;text-align:center;border-top:2px solid var(--line)">' + mo + '</td>';
      html += '<td style="padding:4px;font-weight:800;color:#dc2626;text-align:center;border-top:2px solid var(--line)">' + ma + '</td>';
    }
    html += '</tr>';
    html += '</tbody></table>';
    // Итог за год
    html += '<div style="margin-top:12px;display:flex;gap:14px;align-items:center;font-size:12px;color:var(--ink);flex-wrap:wrap;font-weight:700">' +
      '<span>Итого за ' + y + ' год (вся бригада):</span>' +
      '<span style="color:#16a34a">● ' + yrTotals.work + ' рабочих</span>' +
      '<span style="color:#94a3b8">● ' + yrTotals.off + ' выходных</span>' +
      '<span style="color:#dc2626">● ' + yrTotals.abs + ' отсутствий</span>' +
      '</div>';
    html += '</div>';
    return html;
  }

  // Печать: открываем новое окно с упрощённой HTML-таблицей и зовём window.print
  function brigFullPrint(master, members, canEdit) {
    var printable = document.getElementById('bfs-printable');
    if (!printable) return;
    var range = brigFullGetRange();
    var w = window.open('', '_blank');
    if (!w) { toast('err', 'Разрешите всплывающие окна для печати'); return; }
    var title = 'График — бригада ' + master.full_name + ' (' + range.label + ')';
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;color:#000;padding:14px} h1{font-size:16px;margin:0 0 8px} .legend{display:flex;gap:14px;margin-bottom:10px;font-size:12px} .legend span{display:inline-flex;gap:5px;align-items:center} .legend i{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid #888} table{border-collapse:collapse;width:100%} th,td{border:1px solid #999;padding:4px;text-align:center;font-size:11.5px} th{background:#e2e8f0} td.stick{background:#f8fafc;text-align:left;white-space:nowrap;font-weight:700} .work{background:#dcfce7}.off{background:#f1f5f9}.abs{background:#fee2e2;color:#7f1d1d} @media print{.no-print{display:none} body{padding:6mm}}</style>' +
      '</head><body>';
    html += '<h1>' + esc(title) + '</h1>';
    html += '<div class="legend"><span><i style="background:#dcfce7"></i>рабочий</span><span><i style="background:#f1f5f9"></i>выходной</span><span><i style="background:#fee2e2"></i>отсутствие</span><span style="margin-left:auto">Печать: ' + esc(new Date().toLocaleString('ru-RU')) + '</span></div>';
    // Берём исходную таблицу и заменяем классы для печати (на случай цветной печати)
    var tbl = printable.querySelector('table');
    if (tbl) {
      var clone = tbl.cloneNode(true);
      // Применяем CSS-классы к ячейкам по background-color
      clone.querySelectorAll('td, th').forEach(function (c) {
        var bg = c.style.background;
        if (!bg) return;
        if (bg.indexOf('#dcfce7') !== -1) c.classList.add('work');
        else if (bg.indexOf('#f1f5f9') !== -1) c.classList.add('off');
        else if (bg.indexOf('#fee2e2') !== -1) c.classList.add('abs');
        c.style.background = '';
      });
      html += clone.outerHTML;
    } else {
      html += printable.innerHTML;
    }
    html += '<div class="no-print" style="margin-top:16px"><button onclick="window.print()" style="padding:8px 14px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Печатать</button></div>';
    html += '<scr' + 'ipt>setTimeout(function(){window.print();},250);</scr' + 'ipt>';
    html += '</body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }

  // Excel: генерируем CSV с BOM (Excel правильно откроет) — без зависимостей от xlsx.full.min.js (быстрее и проще).
  function brigFullExcel(master, members, canEdit) {
    var range = brigFullGetRange();
    var all = [master].concat(members);
    var lines = [];
    var sep = ';'; // Excel в ru-RU понимает ;
    function cell(v) {
      var s = String(v == null ? '' : v);
      // CSV-экранирование: если есть ; " или перевод строки — оборачиваем в кавычки
      if (s.indexOf(sep) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }
    if (range.mode === 'month') {
      var dim = range.dim;
      // Заголовок: Бригада, год
      lines.push([cell('Бригада: ' + master.full_name), cell(range.label + ' (' + dim + ' дн.)')].join(sep));
      lines.push(''); // пустая строка
      // Шапка: ФИО, должность, время, график, цикл, 1, 2, ..., 31, Итого раб, Итого вых, Итого отс
      var header = ['Сотрудник', 'Должность', 'Время', 'График', 'Цикл'];
      for (var dd = 1; dd <= dim; dd++) header.push(String(dd));
      header.push('раб', 'вых', 'отс');
      lines.push(header.map(cell).join(sep));
      // Строки сотрудников
      all.forEach(function (u) {
        var wd = wkData(u.id);
        var row = [u.full_name, wkRoleLabel(u.role), wd.hours + ' ч', wd.sched, wd.cycle || ''];
        var w = 0, o = 0, a = 0;
        for (var d = 1; d <= dim; d++) {
          var ds = range.y + '-' + String(range.m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          var st = wkDayState(u.id, ds);
          row.push(st === 'work' ? 'раб' : (st === 'abs' ? 'отс' : 'вых'));
          if (st === 'work') w++; else if (st === 'abs') a++; else o++;
        }
        row.push(String(w), String(o), String(a));
        lines.push(row.map(cell).join(sep));
      });
      var fname = 'График_' + master.full_name.replace(/\s+/g, '_') + '_' + range.y + '-' + String(range.m + 1).padStart(2, '0') + '.csv';
    } else {
      // Год
      var y = range.y;
      lines.push([cell('Бригада: ' + master.full_name), cell('Год: ' + y)].join(sep));
      lines.push('');
      // Шапка: ФИО, должность, время, график, цикл, и для каждого месяца три колонки раб/вых/отс
      var header2 = ['Сотрудник', 'Должность', 'Время', 'График', 'Цикл'];
      for (var mm = 0; mm < 12; mm++) {
        var mon = MON_NOM[mm];
        header2.push(mon + ' раб', mon + ' вых', mon + ' отс');
      }
      header2.push('Итого раб', 'Итого вых', 'Итого отс');
      lines.push(header2.map(cell).join(sep));
      all.forEach(function (u) {
        var wd = wkData(u.id);
        var row = [u.full_name, wkRoleLabel(u.role), wd.hours + ' ч', wd.sched, wd.cycle || ''];
        var yW = 0, yO = 0, yA = 0;
        for (var mm2 = 0; mm2 < 12; mm2++) {
          var dim = new Date(y, mm2 + 1, 0).getDate();
          var mw = 0, mo = 0, ma = 0;
          for (var d = 1; d <= dim; d++) {
            var ds = y + '-' + String(mm2 + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            var st = wkDayState(u.id, ds);
            if (st === 'work') mw++; else if (st === 'abs') ma++; else mo++;
          }
          yW += mw; yO += mo; yA += ma;
          row.push(String(mw), String(mo), String(ma));
        }
        row.push(String(yW), String(yO), String(yA));
        lines.push(row.map(cell).join(sep));
      });
      var fname = 'График_' + master.full_name.replace(/\s+/g, '_') + '_' + y + '.csv';
    }
    // BOM + строки. \r\n для надёжного открытия в Excel
    var csv = '\ufeff' + lines.join('\r\n') + '\r\n';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    toast('ok', '✓ Скачан файл: ' + fname);
  }

  // Модалка дня отсутствия (комментарий к дню + отметить/убрать)
  function openWkDayModal(uid, ds) {
    var u = DB.getUser(uid); if (!u) return;
    var wd = wkData(uid);
    var cur = (wd.abs && wd.abs[ds] != null) ? wd.abs[ds] : '';
    S.wkDay = { uid: uid, ds: ds };
    var d = new Date(ds + 'T00:00:00');
    // 22.09-220: из окна «Настройки бригад» открываем ТРЕТЬИМ окном поверх карточки (не затираем нижние)
    var _wd3 = !!S.workersModal;
    var _wdM = _wd3 ? document.getElementById('modal3') : modal;
    var _wdO = _wd3 ? document.getElementById('overlay3') : overlay;
    _wdM.style.maxWidth = ''; _wdM.style.width = ''; // 22.09-238: ширина по умолчанию (не наследуем от широких окон)
    _wdM.innerHTML = '<div class="modal-h"><h3>Отсутствие — ' + esc(u.full_name) + '</h3><button class="x" data-action="close-modal' + (_wd3 ? '3' : '') + '">×</button></div>' +
      '<div class="modal-b">' +
      '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ' года</div>' +
      '<label style="font-size:12px;font-weight:700;color:var(--ink)">Комментарий (причина отсутствия)</label>' +
      '<textarea id="wk-day-comment" rows="3" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:13px;margin-top:5px;box-sizing:border-box" placeholder="Например: отпуск, больничный, обучение…">' + esc(cur) + '</textarea>' +
      '</div>' +
      '<div class="modal-f"><button class="btn" data-action="close-modal' + (_wd3 ? '3' : '') + '">Отмена</button>' +
      '<button class="btn" data-action="wk-day-del" style="color:var(--red);border-color:var(--red)">Убрать отметку</button>' +
      '<button class="btn primary" data-action="wk-day-save">Отметить отсутствие</button></div>';
    _wdO.classList.add('show');
  }
  // Модалка комментария к карточке работника
  function openWkCommentModal(uid) {
    var u = DB.getUser(uid); if (!u) return;
    var wd = wkData(uid);
    S.wkDay = { uid: uid };
    // 22.09-220: из окна «Настройки бригад» открываем ТРЕТЬИМ окном поверх карточки
    var _wc3 = !!S.workersModal;
    var _wcM = _wc3 ? document.getElementById('modal3') : modal;
    var _wcO = _wc3 ? document.getElementById('overlay3') : overlay;
    _wcM.style.maxWidth = ''; _wcM.style.width = ''; // 22.09-238: ширина по умолчанию (не наследуем от широких окон)
    _wcM.innerHTML = '<div class="modal-h"><h3>Комментарий — ' + esc(u.full_name) + '</h3><button class="x" data-action="close-modal' + (_wc3 ? '3' : '') + '">×</button></div>' +
      '<div class="modal-b">' +
      '<textarea id="wk-card-comment" rows="4" style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box" placeholder="Общий комментарий к работнику…">' + esc(wd.comment || '') + '</textarea>' +
      '</div>' +
      '<div class="modal-f"><button class="btn" data-action="close-modal' + (_wc3 ? '3' : '') + '">Отмена</button>' +
      '<button class="btn primary" data-action="wk-comment-save">Сохранить</button></div>';
    _wcO.classList.add('show');
  }

  /* 22.09-207: РЕДАКТОР ДНЯ В «ГРАФИКАХ СМЕН» (режим «✏ Изменить график»).
     Позволяет для СЕГОДНЯ и БУДУЩИХ дней (отработанные не трогаем):
     — сделать день рабочим (добавить рабочий день к графику) или выходным
       (перенести рабочий день: здесь выходной, на другой день — рабочий);
     — задать/изменить часы на этот день (снижение или добавление);
     — применить изменение сразу ко всей бригаде.
     Хранится вручную заданное исключение: SP_WORKERS.setDayOverride. */
  function schBrigadeOfUser(u) { // бригада работника: он сам + слесари его бригады (для мастера)
    if (!u) return [];
    var list = [u];
    if (u.role === 'master') {
      (DB.getUsers() || []).forEach(function (x) {
        if (x && x.role === 'slesar' && x.active && wkData(x.id).brigade === u.id) list.push(x);
      });
    } else if (u.role === 'slesar') {
      var mid = wkData(u.id).brigade;
      if (mid && DB.getUser(mid)) list.push(DB.getUser(mid));
    }
    return list;
  }
  function openSchDayEditModal(uid, ds) {
    var u = DB.getUser(uid); if (!u) return;
    var todayK = key(TODAY);
    if (ds < todayK) { toast('warn', '⚠ Отработанные (прошедшие) дни не редактируются'); return; }
    var wd = wkData(uid);
    var ov = (wd.overrides || {})[ds] || null;
    var baseState = wkDayState(uid, ds); // с учётом ручного изменения
    var curState = (baseState === 'abs') ? 'work' : baseState; // редактор — про рабочий/выходной
    var curH = schDayHours(u, ds);
    var obr = ov || (wd.overrides && wd.overrides[ds]);
    var brig = schBrigadeOfUser(u);
    S.schDay = { uid: uid, ds: ds };
    var d = new Date(ds + 'T00:00:00');
    var dateStr = d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ' года';
    modal.style.maxWidth = '';
    modal.style.width = 'min(430px,94vw)';
    modal.innerHTML = '<div class="modal-h"><h3>✏ Изменение дня — ' + esc(u.full_name) + '</h3><button class="x" data-action="close-modal">×</button></div>' +
      '<div class="modal-b">' +
      '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px">' + dateStr + '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<label class="cb" style="flex:1;display:flex;align-items:center;gap:6px;justify-content:center;padding:9px 8px;border:1px solid ' + (curState === 'work' ? '#16a34a;background:#dcfce7' : 'var(--line);background:#fff') + ';border-radius:8px;cursor:pointer;font-weight:700;font-size:13px"><input type="radio" name="sch-day-state" id="sch-day-work"' + (curState === 'work' ? ' checked' : '') + '> Рабочий</label>' +
      '<label class="cb" style="flex:1;display:flex;align-items:center;gap:6px;justify-content:center;padding:9px 8px;border:1px solid ' + (curState === 'off' ? '#64748b;background:#f1f5f9' : 'var(--line);background:#fff') + ';border-radius:8px;cursor:pointer;font-weight:700;font-size:13px"><input type="radio" name="sch-day-state" id="sch-day-off"' + (curState === 'off' ? ' checked' : '') + '> Выходной</label>' +
      '</div>' +
      '<div class="fld" style="max-width:200px"><label>Часов в этот день</label><input id="sch-day-hours" type="text" inputmode="decimal" value="' + String(curH).replace('.', ',') + '" placeholder="напр.: 8,25"></div>' +
      '<div style="font-size:12px;color:var(--muted);margin:-4px 0 10px">Учитывается, если день рабочий: можно снизить или добавить часы.</div>' +
      (brig.length > 1 ? '<label class="cb" style="display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px dashed var(--line);border-radius:8px;font-size:12.5px;font-weight:700;color:var(--ink);cursor:pointer"><input type="checkbox" id="sch-day-brig"> Применить ко всей бригаде (' + brig.length + ' чел.)</label>' : '') +
      (obr ? '<div style="margin-top:10px;font-size:12.5px;color:#1d4ed8;font-weight:600">✏ Для этого дня уже есть ручное изменение — кнопка «Вернуть стандарт» вернёт обычный график.</div>' : '') +
      '</div>' +
      '<div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button>' +
      (obr ? '<button class="btn" data-action="sch-day-reset" style="color:var(--red);border-color:var(--red)">Вернуть стандарт</button>' : '') +
      '<button class="btn primary" data-action="sch-day-save">Сохранить</button></div>';
    overlay.classList.add('show');
  }
  function schDayEditSave(reset) {
    if (!S.schDay || !window.SP_WORKERS) return;
    var uid = S.schDay.uid, ds = S.schDay.ds;
    var u = DB.getUser(uid); if (!u) { S.schDay = null; return; }
    var uids = [uid];
    var brigCb = document.getElementById('sch-day-brig');
    if (brigCb && brigCb.checked === true) {
      uids = schBrigadeOfUser(u).map(function (x) { return x.id; });
    }
    if (reset) {
      uids.forEach(function (x) { SP_WORKERS.setDayOverride(x, ds, null); });
      toast('ok', '✓ День возвращён к стандартному графику' + (uids.length > 1 ? ' у ' + uids.length + ' чел.' : ''));
    } else {
      var st = (document.getElementById('sch-day-off') || {}).checked ? 'off' : 'work';
      var hRaw = ((document.getElementById('sch-day-hours') || {}).value || '').trim().replace(',', '.');
      var h = (hRaw === '') ? null : parseFloat(hRaw);
      if (h != null && (!isFinite(h) || h <= 0 || h > 24)) { toast('err', 'Часы — от 0 до 24 (например 8,25)'); return; }
      uids.forEach(function (x) { SP_WORKERS.setDayOverride(x, ds, { s: st, h: (st === 'work' ? h : null) }); });
      logAction(st === 'work' ? 'График смен: день сделан рабочим' : 'График смен: день сделан выходным',
        (u.full_name || uid) + ' · ' + ds + (st === 'work' && h != null ? ' · ' + String(h).replace('.', ',') + ' ч' : '') + (uids.length > 1 ? ' · бригада ' + uids.length + ' чел.' : ''));
      toast('ok', '✓ Изменение сохранено' + (uids.length > 1 ? ' для ' + uids.length + ' чел. бригады' : ''));
    }
    S.schDay = null;
    overlay.classList.remove('show');
    modal.style.width = ''; modal.style.maxWidth = '';
    if (S.screen === 'schedules') renderSchedules();
  }

  /* ================ 22.09-211/212/213: РЕДАКТОР ГРАФИКА СМЕН (окно) ================
     Кнопка «✏ Изменить график» открывает окно. ВСЕ действия — в ЧЕРНОВИК (S.schEdAll)
     и применяются по кнопке «Сохранить» (schEdSaveAll); «Отмена» всё отбрасывает.
     22.09-212: окно выглядит как общая таблица (работники × дни), в квадратиках — часы.
     22.09-213: правим дни прямо в таблице у ВСЕХ работников (без выпадающего списка):
     • Клик по будущему дню — окошко: рабочий/выходной + часы (+ «Вернуть по графику»).
     • Перетаскивание дня мышью вдоль СВОЕЙ строки: у 5/2 переносится ТОЛЬКО этот день
       (остальной график не перестраивается); у 2/2 — весь цикл передвигается следом
       С СЕГОДНЯШНЕГО ДНЯ (запись в cycleHist workers_db); отработанные не меняются.
     • Отдельный блок кнопок сдвига всего графика удалён — это делает перетаскивание.
     22.09-215: дни меняются ИНДИВИДУАЛЬНО у каждого работника (и мастер, и слесарь):
     цикл 2/2 больше не наследуется от мастера бригады — при первом запуске текущий цикл
     скопирован каждому в его запись (workers_db schema 2), дальше перенос/сдвиг дней
     влияет только на того человека, у которого их делают. */
  // Цикл 2/2, действующий на дату (с учётом сохранённых сдвигов cycleHist)
  function wkCycleFrom(uid, dateStr) {
    var wd = wkData(uid);
    var c = wd.cycle || '2026-01-05';
    var hist = wd.cycleHist || [];
    var best = null;
    for (var i = 0; i < hist.length; i++) {
      var sh = hist[i];
      if (sh && sh.from && sh.cycle && sh.from <= dateStr && (!best || sh.from > best.from)) best = sh;
    }
    return best ? best.cycle : c;
  }
  // Текущий черновик работника (создаётся при первом действии). 213: uid передаётся —
  // выделенного работника больше нет, правим всех прямо в таблице.
  function schEdCur(uid) {
    if (!uid) return null;
    if (!S.schEdAll) S.schEdAll = {};
    var cur = S.schEdAll[uid];
    if (!cur) {
      var u = DB.getUser(uid) || {};
      var wd = wkData(uid);
      var owner = (u.role === 'slesar' && wd.brigade) ? wd.brigade : uid;
      cur = S.schEdAll[uid] = { uid: uid, ownerId: owner, draft: {}, shifts: [], shiftDelta: 0, shiftsRm: [] };
    }
    cur.cycleOwner = (wkData(uid).sched === '2/2'); // 22.09-215: по собственному графику
    return cur;
  }
  // Цикл работника на дату с учётом его черновых сдвигов. 22.09-215: только
  // собственная запись (дни индивидуальные, без наследования от мастера бригады)
  function schEdEffCycle(uid, ds, withDraft) {
    var extra = [];
    if (withDraft && S.schEdAll && S.schEdAll[uid]) extra = S.schEdAll[uid].shifts || [];
    var wd = wkData(uid);
    var c = wd.cycle || '2026-01-05';
    var best = null;
    (wd.cycleHist || []).concat(extra).forEach(function (sh) {
      if (sh && sh.from && sh.cycle && sh.from <= ds && (!best || sh.from > best.from)) best = sh;
    });
    return best ? best.cycle : c;
  }
  // Шаблон «рабочий ли день» в окне (как wkIsWorking, но цикл — с черновыми сдвигами)
  function schEdTplWork(uid, ds) {
    var wd = wkData(uid);
    var sched = wd.sched || '5/2';
    var parts = ds.split('-');
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (sched === '2/2') {
      var cycleStr = schEdEffCycle(uid, ds, true); // 22.09-215: индивидуальный цикл
      var cp = cycleStr.split('-');
      var c = new Date(+cp[0], +cp[1] - 1, +cp[2]);
      var days = Math.floor((d - c) / 86400000);
      if (days < 0) { var dow = d.getDay(); return dow !== 0 && dow !== 6; }
      return (days % 4) < 2;
    }
    if (sched === '5/2') { var dw = d.getDay(); return dw !== 0 && dw !== 6; }
    return true;
  }
  function schEdDefHours(uid, ds, u) {
    var wd = wkData(uid);
    if (+wd.hours === 12) return (u && u.role === 'slesar') ? 11.5 : 12;
    var p = ds.split('-'); var dow = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
    return dow === 5 ? 7 : 8.25;
  }
  // Состояние дня в окне: черновик > сохранённое изменение > шаблон. 213: черновик
  // читаем по uid самой строки (выделенного работника нет); черновое значение null —
  // «вернуть по графику» (на экране — сразу шаблон, при сохранении снимет изменение).
  function schEdCellInfo(uid, ds) {
    var wd = wkData(uid);
    if (wd.abs && wd.abs[ds] !== undefined) return { st: 'abs' };
    var cur = (S.schEdAll || {})[uid];
    if (cur && cur.draft && Object.prototype.hasOwnProperty.call(cur.draft, ds)) {
      var dv = cur.draft[ds];
      if (dv === null) return { st: schEdTplWork(uid, ds) ? 'work' : 'off', draft: true, reset: true };
      if (dv && dv.s) return { st: dv.s, h: (dv.s === 'work' && dv.h ? dv.h : null), manual: true, draft: true };
    }
    var ov = (wd.overrides || {})[ds];
    if (ov && ov.s) return { st: ov.s, h: ov.h || null, manual: true };
    return { st: schEdTplWork(uid, ds) ? 'work' : 'off' };
  }
  // 22.09-213: окошко одного дня (поверх редактора): рабочий/выходной + часы
  function openSchEdDayModal(uid, ds) {
    var u = DB.getUser(uid); if (!u || !wkCanEdit(u)) return;
    var todayK = key(TODAY);
    if (!ds) return;
    var isPast = ds < todayK; // 22.09-218: в прошедших днях окошко позволяет поправить ЧАСЫ рабочего дня
    var ci = schEdCellInfo(uid, ds);
    if (ci.st === 'abs') { toast('warn', 'Этот день — отсутствие (отпуск/больничный): снимается кликом по красному дню в общей таблице'); return; }
    if (isPast && ci.st !== 'work') { toast('warn', 'В прошедшие дни можно менять только часы рабочего дня'); return; }
    var overlay2 = document.getElementById('overlay2'), modal2 = document.getElementById('modal2');
    if (!overlay2 || !modal2) return;
    S.schEdDay = { uid: uid, ds: ds, past: isPast };
    var dt = new Date(ds + 'T00:00:00');
    var dateStr = dt.getDate() + ' ' + MON[dt.getMonth()] + ' ' + dt.getFullYear() + ' года';
    var hrs = (ci.st === 'work' && ci.h) ? ci.h : schEdDefHours(uid, ds, u);
    var changed = !!(ci.manual || ci.draft); // есть ручное или черновое изменение
    modal2.style.width = 'min(380px,94vw)';
    modal2.innerHTML = '<div class="modal-h"><h3>✏ ' + esc(u.full_name) + '</h3><button class="x" data-action="close-modal2">×</button></div>' +
      '<div class="modal-b">' +
      '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px">' + dateStr + '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<label class="cb" style="flex:1;display:flex;align-items:center;gap:6px;justify-content:center;padding:9px 8px;border:1px solid ' + (ci.st === 'work' ? '#16a34a;background:#dcfce7' : 'var(--line);background:#fff') + ';border-radius:8px;cursor:' + (isPast ? 'default' : 'pointer') + ';font-weight:700;font-size:13px;' + (isPast ? 'opacity:.55;' : '') + '"' + (isPast ? ' title="В прошедшие дни рабочий/выходной не меняется — только часы"' : '') + '><input type="radio" name="scheday-st" id="scheday-work"' + (ci.st === 'work' ? ' checked' : '') + (isPast ? ' disabled' : '') + '> Рабочий</label>' +
      '<label class="cb" style="flex:1;display:flex;align-items:center;gap:6px;justify-content:center;padding:9px 8px;border:1px solid ' + (ci.st === 'off' ? '#64748b;background:#f1f5f9' : 'var(--line);background:#fff') + ';border-radius:8px;cursor:' + (isPast ? 'default' : 'pointer') + ';font-weight:700;font-size:13px;' + (isPast ? 'opacity:.55;' : '') + '"' + (isPast ? ' title="В прошедшие дни рабочий/выходной не меняется — только часы"' : '') + '><input type="radio" name="scheday-st" id="scheday-off"' + (ci.st === 'off' ? ' checked' : '') + (isPast ? ' disabled' : '') + '> Выходной</label>' +
      '</div>' +
      '<div class="fld" style="max-width:200px"><label>Часов в этот день</label><input id="scheday-hours" type="text" inputmode="decimal" value="' + String(hrs).replace('.', ',') + '" placeholder="напр.: 8,25"></div>' +
      '<div style="font-size:12px;color:var(--muted);margin:-4px 0 10px">' + (isPast ? 'Прошедший день: здесь можно поправить только количество часов (фактическая отработка). ' : 'Учитывается, если день рабочий. ') + 'Изменение уйдёт в черновик и применится по кнопке «Сохранить» в окне редактора.</div>' +
      '</div>' +
      '<div class="modal-f"><button class="btn" data-action="close-modal2">Отмена</button>' +
      (changed ? '<button class="btn" data-action="scheday-reset" style="color:var(--red);border-color:var(--red)">Вернуть по графику</button>' : '') +
      '<button class="btn primary" data-action="scheday-apply">Применить</button></div>';
    overlay2.classList.add('show');
  }
  function schEdDayClose() {
    var overlay2 = document.getElementById('overlay2');
    if (overlay2) overlay2.classList.remove('show');
    S.schEdDay = null;
  }
  function schEdDayApply() {
    var sd = S.schEdDay; if (!sd) return;
    var u = DB.getUser(sd.uid); if (!u) { schEdDayClose(); return; }
    var st = (document.getElementById('scheday-off') || {}).checked ? 'off' : 'work';
    if (sd.past) st = 'work'; // 22.09-218: в прошедшем дне меняются только часы — рабочий/выходной не трогаем
    var hRaw = ((document.getElementById('scheday-hours') || {}).value || '').trim().replace(',', '.');
    var h = (hRaw === '') ? null : parseFloat(hRaw);
    if (st === 'work' && (h == null || !isFinite(h) || h <= 0 || h > 24)) { toast('err', 'Часы — от 0 до 24 (например 8,25)'); return; }
    var cur = schEdCur(sd.uid);
    cur.draft[sd.ds] = { s: st, h: (st === 'work' ? h : null) };
    schEdDayClose();
    schEdRender();
    toast('ok', '✓ В черновике — применится по кнопке «Сохранить»');
  }
  function schEdDayReset() {
    var sd = S.schEdDay; if (!sd) return;
    var cur = schEdCur(sd.uid);
    cur.draft[sd.ds] = null; // вернуть к стандартному графику (при сохранении снимет ручное изменение)
    schEdDayClose();
    schEdRender();
  }
  // 22.09-213: перенос одного дня мышью внутри строки. У 5/2 (и любых не-2/2)
  // передвигается ТОЛЬКО этот день — остальной график не перестраивается.
  function schEdMoveDay(uid, src, dst) {
    var u = DB.getUser(uid); if (!u) return;
    var todayK = key(TODAY);
    if (dst < todayK) { toast('warn', '⚠ В прошедшие дни переносить нельзя'); return; }
    var ciS = schEdCellInfo(uid, src);
    if (ciS.st === 'abs') return;
    var cur = schEdCur(uid);
    cur.draft[src] = { s: ciS.st === 'work' ? 'off' : 'work' };
    cur.draft[dst] = { s: ciS.st, h: (ciS.st === 'work' ? (ciS.h || schEdDefHours(uid, src, u)) : null) };
    schEdRender();
  }
  // Сдвиг всего цикла 2/2 на dlt дней — делается перетаскиванием дня мышью у работника
  // с графиком 2/2. Черновик хранится на владельце цикла (мастере бригады): сдвиг общий
  // для всей бригады. Действует С СЕГОДНЯШНЕГО ДНЯ; отработанные (прошедшие) дни не трогаем.
  function schEdPatternShift(dlt, uid) {
    // 22.09-215: сдвиг — индивидуальный, пишется на запись самого работника
    var cur = schEdCur(uid); if (!cur) return;
    if (!cur.cycleOwner) { toast('warn', 'Сдвиг цикла доступен для графика 2/2'); return; }
    var todayK = key(TODAY);
    var eff = schEdEffCycle(uid, todayK, true);
    cur.shifts = [{ from: todayK, cycle: gwAddDaysISO(eff, dlt) }];
    cur.shiftDelta = (cur.shiftDelta || 0) + dlt;
    if (!cur.shiftDelta) cur.shifts = [];
    schEdRender();
  }
  function schEdMonthNav(dlt) {
    var m = S.schEd.m + dlt, y = S.schEd.y;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    S.schEd.m = m; S.schEd.y = y;
    schEdRender();
  }
  function schEdSaveAll() {
    if (!S.schEdAll) return;
    var touched = 0;
    Object.keys(S.schEdAll).forEach(function (uid) {
      var cur = S.schEdAll[uid];
      var n = 0;
      Object.keys(cur.draft || {}).forEach(function (ds) { SP_WORKERS.setDayOverride(uid, ds, cur.draft[ds]); n++; });
      (cur.shiftsRm || []).forEach(function (fr) { SP_WORKERS.removeCycleShift(uid, fr); n++; });
      (cur.shifts || []).forEach(function (sh) { SP_WORKERS.addCycleShift(uid, sh.from, sh.cycle); n++; });
      if (n) { touched += n; try { var u = DB.getUser(uid); logAction('График смен: ручные изменения', (u ? u.full_name : uid) + ' · ' + n + ' шт'); } catch (e) {} }
    });
    S.schEd = null; S.schEdAll = null; S.schEdDay = null; S.schEdMode = null;
    overlay.classList.remove('show');
    modal.style.width = ''; modal.style.maxWidth = '';
    toast('ok', touched ? ('✓ Изменения графика сохранены (' + touched + ')') : '✓ Изменений не было');
    if (S.screen === 'schedules') renderSchedules();
    else if (S.screen === 'workers' || S.workersModal) renderWorkers();
  }
  function schEdRender() {
    if (!S.schEd) return;
    var todayK = key(TODAY);
    var y = S.schEd.y, m = S.schEd.m;
    var dim = new Date(y, m + 1, 0).getDate();
    // 22.09-217: пустые столбики «сдвига первой недели» перед 1-м числом убраны —
    // дни сразу следуют за колонкой ФИО
    // список работников, которых можно править — все правятся прямо в таблице (без списка)
    var users = [];
    try { users = (wkVisibleUsers() || []).filter(function (x) { return x && wkCanEdit(x); }); } catch (e) {}
    var h = '<div class="modal-h"><h3>✏ Изменение графика смен</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
      '<button type="button" class="btn sm" data-action="sch-ed-prev" title="Предыдущий месяц">‹</button>' +
      '<b style="min-width:120px;text-align:center;font-size:13px">' + MON_NOM[m] + ' ' + y + '</b>' +
      '<button type="button" class="btn sm" data-action="sch-ed-next" title="Следующий месяц">›</button>' +
      '<span style="font-size:11px;color:var(--muted)">клик по дню — окошко дня (у прошедших — только часы) · дни перетаскиваются мышью вдоль своей строки · всё применится по кнопке «Сохранить»</span></div>';
    // 22.09-212: сетка окна = та же таблица, что на странице «Графики смен»
    // (шапка с числами месяца, колонка «Бригада / работник» слева, цветные квадратики),
    // только в каждом рабочем квадратике написаны часы.
    // 22.09-213: править можно ВСЕ строки — клик по дню/перетаскивание работают у каждого.
    var colW = 26; // квадратик шире, чем в общей таблице, чтобы помещались часы (8,25 / 11,5)
    // Строки: бригады (мастер + его слесари) + «без бригады» — как в общей таблице
    var esMasters = users.filter(function (x) { return x.role === 'master'; });
    var esSlesars = users.filter(function (x) { return x.role === 'slesar'; });
    var edRows = [];
    esMasters.forEach(function (mm) {
      edRows.push({ master: mm, members: esSlesars.filter(function (ss) { return wkData(ss.id).brigade === mm.id; }) });
    });
    var freeSl = esSlesars.filter(function (ss) {
      var bb = wkData(ss.id).brigade;
      return !bb || !esMasters.some(function (mm) { return mm.id === bb; });
    });
    if (freeSl.length) edRows.push({ master: null, members: freeSl });
    var inRows = {};
    edRows.forEach(function (rw) { if (rw.master) inRows[rw.master.id] = 1; rw.members.forEach(function (ss) { inRows[ss.id] = 1; }); });
    var rest = users.filter(function (x) { return !inRows[x.id]; });
    if (rest.length) edRows.push({ master: null, members: rest });
    // 22.09-221: фильтр окна берётся из списка на странице «Графики смен» — выбрана бригада, показываем только её
    var curEdMode = S.schEdMode || 'all';
    var edModeLbl = '';
    if (curEdMode === 'free') {
      var _fFree = edRows.filter(function (rw) { return !rw.master; });
      edRows = _fFree; edModeLbl = 'только без бригады';
    } else if (curEdMode.indexOf('b:') === 0) {
      var _fMid = curEdMode.slice(2);
      var _fBr = edRows.filter(function (rw) { return rw.master && rw.master.id === _fMid; });
      if (_fBr.length) { edRows = _fBr; edModeLbl = 'бригада ' + (_fBr[0].master.full_name || ''); }
    }
    // Ширина колонки ФИО — по самому длинному имени (как в общей таблице), только видимые строки
    var nameColW = 200;
    var poolN = [];
    edRows.forEach(function (rwN) { if (rwN.master) poolN.push(rwN.master); poolN = poolN.concat(rwN.members); });
    poolN.forEach(function (x) { var ap = (x.full_name || '').length * 7 + 100; if (ap > nameColW) nameColW = ap; });
    if (nameColW > 340) nameColW = 340;
    // Одна ячейка дня: часы внутри; клик — окошко дня; будущие обычные дни — перетаскивание
    function schEdTd(xu, dd) {
      var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var past = ds < todayK;
      var ci = schEdCellInfo(xu.id, ds);
      var bg = ci.st === 'work' ? '#dcfce7' : (ci.st === 'abs' ? '#fee2e2' : '#f1f5f9');
      var bd = ci.st === 'work' ? '#16a34a' : (ci.st === 'abs' ? '#dc2626' : '#cbd5e1');
      var _hol = holidayOn(ds);
      if (_hol) { bg = '#fef9c3'; bd = '#eab308'; }
      var hours = '';
      if (ci.st === 'work') {
        var hv = ci.h || schEdDefHours(xu.id, ds, xu);
        hours = String(hv).replace('.', ',');
      }
      var shs = [];
      if (sameDay(new Date(y, m, dd), TODAY)) shs.push('inset 2px 0 0 0 rgba(37,99,235,.4)', 'inset 0 2px 0 0 rgba(37,99,235,.4)');
      if (ci.manual) shs.push('inset 0 -2px 0 0 rgba(37,99,235,.85)');
      if (ci.draft) bd = '#2563eb'; // черновое изменение — синяя рамка квадратика
      var title = ds + (ci.st === 'work' ? ' · рабочий · ' + hours + ' ч' : (ci.st === 'abs' ? ' · отсутствие' : ' · выходной'));
      if (ci.manual) title += ' · ✏ изменён вручную';
      if (ci.draft) title += (ci.reset ? ' · • черновик: вернуть по графику' : ' · • черновик (не сохранено)');
      if (_hol) title += ' · 🎉 ' + _hol;
      if (past && ci.st === 'work') title += ' · ⏪ прошедший день: клик — поправить часы';
      // 22.09-218: клик работает и по прошедшим дням — в окошке дня у них редактируются только часы
      var act = 'sch-ed-cell';
      var drag = (!past && ci.st !== 'abs');
      return '<td data-action="' + act + '" data-uid="' + esc(xu.id) + '" data-sch-day="' + ds + '"' + (drag ? ' data-sch-drag="1"' : '') +
        (act ? ' role="button"' : '') + ' title="' + esc(title) + '"' +
        ' style="width:' + colW + 'px;height:26px;padding:0;background:' + bg + ';border:1px solid ' + bd + ';text-align:center;box-sizing:border-box;' +
        (shs.length ? 'box-shadow:' + shs.join(',') + ';' : '') +
        (past ? 'opacity:.45;cursor:pointer;' : 'cursor:pointer;') + '">' +
        (hours ? '<span style="font-size:8.5px;font-weight:800;color:#14532d;line-height:1">' + hours + '</span>' : '') +
        '</td>';
    }
    // Строка работника (как в общей таблице)
    function schEdTr(xu, isMaster) {
      var xw = wkData(xu.id);
      var rbg = isMaster ? 'var(--panel-2)' : 'var(--card)';
      var tds = '';
      for (var dd = 1; dd <= dim; dd++) tds += schEdTd(xu, dd);
      return '<tr style="background:' + rbg + '">' +
        '<td style="position:sticky;left:0;background:' + rbg + ';z-index:1;padding:' + (isMaster ? '6px 8px' : '4px 8px 4px 24px') + ';border-bottom:1px solid var(--line);border-right:1px solid var(--line);white-space:nowrap;width:' + nameColW + 'px;overflow:hidden;text-overflow:ellipsis;' +
        (isMaster ? 'font-weight:800;' : 'font-size:11px;') + 'color:var(--ink)">' +
        '<span style="display:inline-block;width:' + (isMaster ? 10 : 8) + 'px;height:' + (isMaster ? 10 : 8) + 'px;border-radius:50%;background:' + (xu.color || '#94a3b8') + ';margin-right:6px"></span>' +
        (isMaster ? '👷 ' : '') + esc(xu.full_name) +
        ' <span style="color:var(--muted);font-weight:700;font-size:9.5px">· ' + xw.hours + ' ч · ' + (xw.sched || '5/2') + '</span>' +
        '</td>' + tds + '</tr>';
    }
    if (edModeLbl) h += '<div style="margin:0 0 8px"><span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#1d4ed8;background:#dbeafe;border:1px solid #93c5fd;border-radius:999px;padding:3px 10px" title="В списке рядом с месяцем на странице «Графики смен» выбрана ' + (curEdMode === 'free' ? 'не бригада, а «Только без бригады»' : 'конкретная бригада') + ' — поэтому в окне видны не все. Вернитесь на страницу и выберите «Все бригады», чтобы видеть всех">👥 Показано: ' + esc(edModeLbl) + '</span></div>';
    h += '<div id="sch-ed-grid" style="overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);user-select:none">';
    h += '<table style="border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;min-width:' + (nameColW + dim * colW + 2) + 'px;font-size:11px">';
    // Шапка: колонка ФИО + числа месяца (как в общей таблице: выходные — серые, сегодня/праздник подсвечены)
    h += '<thead><tr style="background:var(--panel-2)">';
    h += '<th style="position:sticky;left:0;background:var(--panel-2);z-index:2;padding:6px 8px;text-align:left;border-bottom:1px solid var(--line);border-right:1px solid var(--line);font-size:11px;color:var(--muted);font-weight:700;width:' + nameColW + 'px">Бригада / работник</th>';
    for (var dd2 = 1; dd2 <= dim; dd2++) {
      var dtH = new Date(y, m, dd2);
      var isWeH = (dtH.getDay() === 0 || dtH.getDay() === 6);
      var dsH = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dd2).padStart(2, '0');
      var _holH = holidayOn(dsH);
      h += '<th title="' + dd2 + ' ' + MON_NOM[m] + (_holH ? ' · 🎉 ' + esc(_holH) : '') + '" style="width:' + colW + 'px;padding:3px 0;font-size:10px;font-weight:700;color:' + (isWeH ? '#94a3b8' : 'var(--muted)') + ';border-bottom:1px solid var(--line);text-align:center;' + (sameDay(dtH, TODAY) ? 'background:rgba(37,99,235,.1);' : (_holH ? 'background:#fef9c3;' : '')) + '">' + dd2 + '</th>';
    }
    h += '</tr></thead><tbody>';
    edRows.forEach(function (rw) {
      if (rw.master) h += schEdTr(rw.master, true);
      rw.members.forEach(function (ss) { h += schEdTr(ss, false); });
    });
    h += '</tbody></table></div>';
    h += '<div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5">В квадратиках — рабочие часы дня. Клик по будущему дню — окошко «рабочий/выходной/часы» (там же «Вернуть по графику»). Перетаскивание дня мышью вдоль строки: у графика 5/2 переносится только этот день, у 2/2 — его график едет следом (с сегодняшнего дня). Дни каждого работника меняются независимо от остальных. Синяя риска снизу — изменён вручную, синяя рамка квадратика — черновое изменение (не сохранено). Прошедшие дни: клик по рабочему квадратику — окошко, где можно поправить часы (рабочий/выходной в прошлом не меняется, перетаскивание недоступно).</div>';
    h += '</div>';
    h += '<div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="sch-ed-save">💾 Сохранить</button></div>';
    // 22.09-216: окно редактора — 90% ширины экрана, по центру (центрирует контейнер overlay)
    modal.style.maxWidth = '90vw'; modal.style.width = '90vw';
    modal.innerHTML = h;
    // Перетаскивание дней мышью (все строки): у 2/2 — сдвиг всего графика следом,
    // у 5/2 — переносится только этот день, остальной график не перестраивается.
    var grid = document.getElementById('sch-ed-grid');
    if (grid) grid.querySelectorAll('[data-sch-drag]').forEach(function (cell) {
      var ds2 = cell.getAttribute('data-sch-day');
      var uid2 = cell.getAttribute('data-uid');
      if (!ds2 || !uid2 || ds2 < todayK) return;
      try { cell.draggable = true; } catch (e) {}
      cell.addEventListener('dragstart', function (ev) { S._schDrag = uid2 + '|' + ds2; try { ev.dataTransfer.setData('text/plain', S._schDrag); } catch (e) {} });
      cell.addEventListener('dragover', function (ev) { ev.preventDefault(); });
      cell.addEventListener('drop', function (ev) {
        ev.preventDefault();
        var dd0 = String(S._schDrag || ''); S._schDrag = null;
        var parts = dd0.split('|'); var srcUid = parts[0], srcDs = parts[1];
        if (!srcDs || srcDs === ds2) return;
        if (srcUid !== uid2) { toast('warn', 'День можно перетаскивать только внутри строки того же работника'); return; }
        var delta = Math.round((new Date(ds2 + 'T00:00:00') - new Date(srcDs + 'T00:00:00')) / 86400000);
        if (!delta) return;
        var cur0 = schEdCur(uid2);
        if (cur0 && cur0.cycleOwner) { schEdPatternShift(delta, uid2); return; } // 2/2: весь график следом
        schEdMoveDay(uid2, srcDs, ds2); // 5/2: двигается только этот день
      });
    });
  }
  function openSchEditorModal() {
    var users = [];
    try { users = (wkVisibleUsers() || []).filter(function (x) { return x && wkCanEdit(x); }); } catch (e) {}
    if (!users.length) { toast('err', 'Нет работников с правом на изменение'); return; }
    var wm = wkMonth();
    S.schEd = { y: wm.y, m: wm.m };
    // 22.09-221: что выбрано в списке рядом с месяцем на странице — бригада откроется одна, «Все» — все
    S.schEdMode = (S.screen === 'schedules' && S.schMode) ? String(S.schMode) : 'all';
    S.schEdAll = {};
    schEdRender();
    overlay.classList.add('show');
  }


  function renderPerms() {
    var view = document.getElementById('view');
    var permsUrl = 'https://178.124.167.87:11442/orgs-rep/100308563/6393';
    
    var html = '<div style="height:calc(100vh - 62px);width:100%;position:relative;z-index:0;background:#e8eef3;">' +
      
      // Контейнер сверху справа (поверх iframe)
      '<div class="perms-wrapper" style="position:absolute;top:8px;right:12px;z-index:20;text-align:center;">' +
        
        // Сама кнопка (уменьшенная в 2 раза)
        '<a href="' + permsUrl + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:#dc2626;color:#fff;border-radius:6px;font-size:10.5px;font-weight:700;text-decoration:none;box-shadow:0 2px 8px rgba(220,38,38,0.4);cursor:pointer;transition:0.2s;">' +
          '🔧 Исправить ошибку' +
        '</a>' +
        
        // Окно подсказки (скрыто по умолчанию)
        '<div class="perms-tooltip" style="position:absolute;top:100%;right:0;margin-top:8px;padding:14px 18px;background:#1f2937;color:#fff;border-radius:10px;font-size:13px;line-height:1.7;box-shadow:0 10px 30px rgba(0,0,0,0.5);width:340px;max-width:90vw;text-align:left;display:none;">' +
          'Если сайт не открывается:<br>' +
          'Нажмите кнопку <b style="color:#fca5a5;background:rgba(220,38,38,0.3);padding:1px 6px;border-radius:4px;">исправить ошибку</b>,<br>' +
          'при переходе на сайт нажмите кнопку <b style="color:#fde047;background:rgba(250,204,21,0.2);padding:1px 6px;border-radius:4px;">дополнительные настройки</b><br>' +
          'и <b style="color:#86efac;background:rgba(34,197,94,0.2);padding:1px 6px;border-radius:4px;">Перейти на сайт 178.124.167.87</b>' +
        '</div>' +
      '</div>' +

      // CSS-правило для показа подсказки при наведении мыши
      '<style>' +
        '.perms-wrapper:hover .perms-tooltip { display: block !important; }' +
      '</style>' +

      // Еслирамба на весь экран
      '<iframe src="' + permsUrl + '" allowfullscreen loading="eager" title="Разрешения на производство работ" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;display:block;"></iframe>' +
    '</div>';
    
    view.innerHTML = html;
  }

