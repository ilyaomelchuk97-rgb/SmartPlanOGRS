  /* ── часть 02 · app/02_dashboard.js — панель мониторинга: КПД, плитки, «Сегодня», гант-шкала дня ── */
  /* =====================================================================
     KPI ПОПАПЫ (Панель мониторинга)
     ===================================================================== */
  function openKpiPopup(title, color, bodyHtml) {
    var h = '<div class="modal-h" style="border-bottom:1px solid var(--line);background:' + color + ';color:#fff;"><h3 style="color:#fff">' + esc(title) + '</h3><button class="x" data-action="close-modal" style="color:#fff">×</button></div>';
    h += '<div class="modal-b">';
    h += bodyHtml || '<div class="empty">Нет данных</div>';
    h += '</div>';
    h += '<div class="modal-f"><button class="btn" data-action="close-modal">Закрыть</button></div>';
    modal.style.maxWidth = ''; // сброс автоширины карточки задачи
    modal.innerHTML = h;
    overlay.classList.add('show');
  }

  // 22.09-193: «КПД мастеров» — выбор мастера на панели мониторинга (null = все мастера).
  // Цифры, блок «Сегодня» и всплывающие списки KPI считаются только по выбранному мастеру.
  function kpiMasterPick() { return S.dashMaster ? String(S.dashMaster) : ''; }
  function kpiTasks() { var pk = kpiMasterPick(); return visibleTasks().filter(function (t) { return !pk || String(t.m) === pk; }); }
  function kpiMasters() { var pk = kpiMasterPick(); var vm = visibleMasters(); return pk ? vm.filter(function (m) { return String(m.id) === pk; }) : vm; }

  function kpiToday() {
    var vt = kpiTasks().filter(function (t) { return t.d === 0; });
    var body = '';
    if (!vt.length) { openKpiPopup('Задачи на сегодня', '#2563eb', null); return; }
    vt.sort(function(a,b) { return (a.m||'').localeCompare(b.m||''); });
    vt.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      body += '<div class="rz-item"><div class="rz-bar" style="background:' + (m ? m.color : '#94a3b8') + '"></div><div class="rz-main"><div class="rz-t">' + esc(w ? w.name : '?') + ' — ' + esc(addrOf(t)) + '</div><div class="rz-s">' + esc(m ? m.name : '?') + ' · ' + esc(m ? m.area : '') + ' · ' + fmtH(taskHours(t)) + ' ч' + (t.volume || t.volumes ? ' · Объём: ' + taskVolLabel(t) + ' ' + (w ? w.unit : '') : '') + '</div></div><div class="rz-dl" style="color:#2563eb">' + statusLabel(t) + '</div></div>';
    });
    openKpiPopup('Задачи на сегодня (' + vt.length + ')', '#2563eb', body);
  }

  function kpiOverloads() {
    var masters = kpiMasters();
    var overloaded = masters.filter(function (m) { return loadForDay(m.id, 0) > masterCapacity(m.id, 0); });
    var body = '';
    if (!overloaded.length) { openKpiPopup('Перегрузок сегодня', '#dc2626', '<div class="empty">🎉 Перегрузок нет!</div>'); return; }
    overloaded.forEach(function (m) {
      var load = loadForDay(m.id, 0);
      var dayTasks = kpiTasks().filter(function(t) { return t.m === m.id && t.d === 0 && !isDone(t); });
      var taskList = '';
      dayTasks.forEach(function(t) { var w = workOf(t); taskList += '<div class="taskline"><span class="pill">' + esc(w ? w.name : '?') + '</span><span>' + esc(addrOf(t)) + '</span><span style="margin-left:auto;color:var(--red);font-weight:700">' + fmtH(taskHours(t)) + ' ч</span></div>'; });
      body += '<div class="today-mstr" style="border-color:var(--red);background:var(--red-l);"><span class="dot" style="background:' + m.color + '"></span><div><div class="nm">' + esc(m.name) + '</div><div class="ar">' + esc(m.area) + '</div></div><div class="meta"><div class="h" style="color:var(--red)">' + fmtH(load) + ' ч / ' + fmtH(masterCapacity(m.id, 0)) + ' ч</div><span class="tag over">⚠ +' + fmtH(load - masterCapacity(m.id, 0)) + ' ч</span></div></div>';
      body += taskList;
    });
    openKpiPopup('Перегрузки сегодня (' + overloaded.length + ')', '#dc2626', body);
  }

  function kpiMonth() {
    // 22.09-220: блок «Выполнено за месяц» открывает окно «Факт работ по объектам»
    // (сама карточка в панели мониторинга считает процент, как раньше)
    openFactMonthModal();
  }

  function kpiPermits() {
    var vt = kpiTasks().filter(function (t) { return t.needs_permit && !isDone(t); });
    var body = '';
    if (!vt.length) { openKpiPopup('Ордеров истекает', '#f59e0b', '<div class="empty">Нет задач с ордерами</div>'); return; }
    vt.sort(function(a,b) { return a.dl - b.dl; });
    vt.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      var dlDate = t.dl_date || (t.dl != null ? key(offToDate(t.dl)) : '—');
      var daysLeft = t.dl != null ? t.dl : 0;
      var cls = daysLeft < 0 ? 'color:var(--red)' : daysLeft <= 3 ? 'color:var(--yellow)' : 'color:var(--green)';
      body += '<div class="rz-item"><div class="rz-bar" style="background:' + (daysLeft < 0 ? 'var(--red)' : daysLeft <= 3 ? 'var(--yellow)' : 'var(--green)') + '"></div><div class="rz-main"><div class="rz-t">' + esc(w ? w.name : '?') + ' — ' + esc(addrOf(t)) + '</div><div class="rz-s">' + esc(m ? m.name : '?') + ' · Ордер до: ' + dlDate + '</div></div><div class="rz-dl" style="' + cls + '">' + (daysLeft < 0 ? 'просрочка ' + (-daysLeft) + ' дн' : daysLeft === 0 ? 'сегодня!' : daysLeft + ' дн') + '</div></div>';
    });
    openKpiPopup('Ордера и разрешения (' + vt.length + ')', '#f59e0b', body);
  }

  // 22.09-171: «Красная зона» — всплывающий список задач (срок ≤ 2 дн или просрочено)
  function kpiRedzone() {
    var vt = kpiTasks().filter(function (t) { return !isDone(t) && (t.dl <= 2 || t.d < 0); });
    vt.sort(function (a, b) { return a.dl - b.dl; });
    if (!vt.length) { openKpiPopup('Красная зона', '#dc2626', '<div class="empty">Просрочек нет 🎉</div>'); return; }
    var body = '';
    vt.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      var col = taskColor(t);
      body += '<div class="rz-item"><div class="rz-bar" style="background:' + (col === 'red' ? 'var(--red)' : 'var(--yellow)') + '"></div><div class="rz-main"><div class="rz-t">' + esc(w ? w.name : '?') + ' — ' + esc(addrOf(t)) + '</div><div class="rz-s">' + esc(m ? m.name : '?') + ' · ' + esc(m ? m.area : '') + ' · ' + statusLabel(t) + '</div></div><div class="rz-dl ' + (col === 'red' ? 'red' : 'yel') + '">' + (t.dl < 0 ? 'просрочка ' + (-t.dl) + ' дн' : t.dl === 0 ? 'сегодня!' : 'осталось ' + t.dl + ' дн') + '</div></div>';
    });
    openKpiPopup('Красная зона (' + vt.length + ')', '#dc2626', body);
  }

  /* =====================================================================
     РЕНДЕР: ДАШБОРД
     ===================================================================== */
  // Время в пути задачи (мин): из расчёта маршрута дня либо из самой задачи
  function taskTravelMin(t) {
    if (!t) return 0;
    var rt = getRouteTime(t.m, t.d);
    if (rt && rt.legs && rt.legs[t.id]) return rt.legs[t.id].min || 0;
    return (t.travelMin != null) ? t.travelMin : 0;
  }
  // Оценка времени в пути до объекта (мин), если реальный маршрут не рассчитан:
  // расстояние по прямой от базы × коэффициент дорог / ~35 км/ч.
  function estimateTravelMin(t) {
    if (!t) return 0;
    var _eo = OBJ_MAP[t.o];
    var lat = (_eo && _eo.lat != null) ? _eo.lat : ((t.lat != null) ? t.lat : null);
    var lng = (_eo && _eo.lng != null) ? _eo.lng : ((t.lng != null) ? t.lng : null);
    if (lat == null || lng == null) return 0;
    var km = distKm(currentBase(), { lat: lat, lng: lng }) * 1.4; // коэффициент извилистости дорог
    return Math.max(3, Math.round(km / 35 * 60));
  }
  // Кол-во рабочих дней (пн–пт) в месяце
  var dmState = { viewYear: TODAY.getFullYear() }; // 22.09-184: HOTFIX — объявление затёрто чисткой 22.09-182
  function getDashMY() {
    if (S.dashMonth) return { y: S.dashMonth.year, m: S.dashMonth.month };
    return { y: TODAY.getFullYear(), m: TODAY.getMonth() };
  }
  function dashMonthLabel() { var p = getDashMY(); return MON_NOM[p.m] + ' ' + p.y; }
  function toggleDashMonthPicker(btnEl) {
    var dd = document.getElementById('dash-month-dropdown');
    if (!dd) return;
    if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
    var p = getDashMY();
    dmState.viewYear = p.y;
    renderDashMonthPicker();
    var btn = btnEl || document.querySelector('[data-action="dash-month-toggle"]');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      dd.style.top = (rect.bottom + 6) + 'px';
      dd.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 316)) + 'px';
    }
    dd.classList.add('open');
  }
  function renderDashMonthPicker() {
    var dd = document.getElementById('dash-month-dropdown');
    if (!dd) return;
    var p = getDashMY();
    var html = '<div class="rm-head">';
    html += '<button type="button" data-action="dm-prev-year">\u2039</button>';
    html += '<span class="rm-year">' + dmState.viewYear + '</span>';
    html += '<button type="button" data-action="dm-next-year">\u203a</button>';
    html += '<button type="button" class="rm-close" data-action="dm-close">\u00d7</button>';
    html += '</div><div class="rm-grid">';
    for (var mo = 0; mo < 12; mo++) {
      var isSel = (dmState.viewYear === p.y && mo === p.m);
      var isCur = (dmState.viewYear === TODAY.getFullYear() && mo === TODAY.getMonth());
      html += '<button type="button" class="rm-month' + (isSel ? ' selected' : '') + (isCur ? ' current' : '') + '" data-action="dm-pick" data-year="' + dmState.viewYear + '" data-month="' + mo + '">' + MON_NOM[mo] + '</button>';
    }
    html += '</div>';
    dd.innerHTML = html;
  }
  function pickDashMonth(year, month) {
    S.dashMonth = { year: year, month: month };
    var dd = document.getElementById('dash-month-dropdown');
    if (dd) dd.classList.remove('open');
    renderDashboard();
  }

  // Анимированная сцена погоды для карточки дашборда: солнце/луна/звёзды + облака/дождь/снег
  // Фаза луны (0=новая, 0.5=полная, 1=снова новая)
  function getMoonPhase(date) {
    var knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
    var lunarCycle = 29.530588853 * 86400000;
    var diff = date.getTime() - knownNewMoon;
    var phase = (diff % lunarCycle) / lunarCycle;
    if (phase < 0) phase += 1;
    return phase;
  }

  // Количество капель дождя в сцене зависит от интенсивности осадков.
  // Учитываем код погоды WMO (тип дождя) и суточное количество осадков в мм.
  // Возвращает { count, dur }: count — число капель, dur — базовая скорость падения (с).
  function rainIntensity(wf) {
    var code = wf.code || 0;
    var mm = wf.rain || 0;
    var count;
    // Базовое количество по коду погоды (WMO)
    if (code === 51 || code === 56) count = 14;          // слабая морось
    else if (code === 53) count = 20;                     // умеренная морось
    else if (code === 55 || code === 57) count = 28;      // густая/сильная морось
    else if (code === 61 || code === 66 || code === 80) count = 26; // небольшой дождь/ливень
    else if (code === 63 || code === 67 || code === 81) count = 40; // умеренный дождь
    else if (code === 65 || code === 82) count = 54;      // сильный/проливной дождь
    else if (code >= 95) count = 60;                      // гроза с ливнем
    else count = 22;                                       // есть осадки, код не детализирован
    // Корректировка по количеству осадков за день (мм) — уточняет интенсивность
    if (mm > 0) {
      if (mm < 1) count = Math.min(count, 16);            // следы осадков
      else if (mm < 2.5) count = Math.max(count, 28);     // слабый
      else if (mm < 5) count = Math.max(count, 42);       // умеренный
      else if (mm < 8) count = Math.max(count, 54);       // сильный
      else count = Math.max(count, 64);                   // очень сильный/ливень
    }
    // Скорость падения капель: чем сильнее дождь, тем быстрее летят (с)
    var heavy = (code === 65 || code === 82 || code >= 95) || mm >= 5;
    var moder = (code === 63 || code === 67 || code === 81 || code === 55 || code === 57) || (mm >= 2.5 && mm < 5);
    var dur = heavy ? 0.45 : moder ? 0.6 : 0.75;
    // Морось — капель по стандарту (×1); сильный дождь/ливень/гроза — в 2 раза больше; прочий дождь — ×1.5
    var mult = heavy ? 2 : ((code >= 51 && code <= 57) ? 1 : 1.5);
    return { count: Math.round(count * mult), dur: dur };
  }

  /* 22.09-231: размытый слой анимированных облачков — фон блока прогноза
     погоды в панели мониторинга. Те же облака, что в анимации над карточками
     (css .wx-cloud + wxCloudRight/Left), но: БОЛЬШЕ (count), плывут по ВСЕМУ
     блоку (top 0–100%) и размыты по всему блоку (blur — css .wx-bgclouds). */
  function wxBlurCloudsHtml(count) {
    var nc = count || 26;
    var h = '<div class="wx-bgclouds">';
    for (var i = 0; i < nc; i++) {
      var cAnim = i % 2 === 0 ? 'wxCloudRight' : 'wxCloudLeft';
      var cDur = 200 + Math.random() * 420;
      var cScale = (0.8 + Math.random() * 0.9).toFixed(2);
      var cTop = (Math.random() * 100).toFixed(0);
      h += '<span class="wx-cloud" style="top:' + cTop + '%;transform:scale(' + cScale + ');opacity:.9;animation:' + cAnim + ' ' + cDur.toFixed(0) + 's linear infinite;animation-delay:-' + (Math.random() * cDur).toFixed(0) + 's"></span>';
    }
    return h + '</div>';
  }

  function weatherSceneHTML(wf, opt) {
    wf = wf || {};
    opt = opt || {};
    // === Определяем «сейчас» по выбранному часу (ползунок) или по реальному времени.
    // Берём дату из wf.date (если есть) — иначе сегодня. Иначе при открытии
    // погоды на другой день sunrise/sunset окажутся в прошлом относительно now.
    var now = new Date();
    if (wf.date) {
      var _d = new Date(wf.date);
      if (!isNaN(_d.getTime())) now = new Date(_d);
    }
    if (typeof opt.hour === 'number' && opt.hour >= 0 && opt.hour <= 23) {
      now.setHours(opt.hour, 0, 0, 0);
    }
    var sr = wf.sunrise ? new Date(wf.sunrise) : null;
    var ss = wf.sunset ? new Date(wf.sunset) : null;
    if (!sr || !ss || isNaN(sr.getTime()) || isNaN(ss.getTime())) {
      sr = new Date(now); sr.setHours(6, 0, 0, 0);
      ss = new Date(now); ss.setHours(20, 0, 0, 0);
    }
    var morningEnd = new Date(sr.getTime() + 2.5 * 3600000);
    var eveningStart = new Date(ss.getTime() - 2.5 * 3600000);
    var tod;
    if (now < sr || now >= ss) tod = 'night';
    else if (now < morningEnd) tod = 'morning';
    else if (now >= eveningStart) tod = 'evening';
    else tod = 'day';
    // === Определяем погоду: по коду WMO, по описанию, по факту осадков ===
    // (hourly-данные не содержат code, поэтому опираемся на desc + snowfall/rain)
    var code = (typeof wf.code === 'number') ? wf.code : -1;
    var desc = wf.desc || '';
    var snowfall = (typeof wf.snowfall === 'number') ? wf.snowfall : (wf.snow ? 0.5 : 0);
    var rain     = (typeof wf.rain === 'number')     ? wf.rain     : 0;
    var cloudy = (code >= 2 && code <= 3) ||
                 desc.indexOf('Облачно') !== -1 || desc.indexOf('Пасмурно') !== -1 ||
                 desc.indexOf('Туман') !== -1 || desc.indexOf('Мгла') !== -1;
    var hasRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95) ||
                  desc.indexOf('Дождь') !== -1 || desc.indexOf('Морось') !== -1 ||
                  desc.indexOf('Ливень') !== -1 || (rain > 0.1);
    var hasSnow = (code >= 71 && code <= 77) || code === 85 || code === 86 ||
                  desc.indexOf('Снег') !== -1 || desc.indexOf('Метель') !== -1 ||
                  (snowfall > 0.1);
    var hasStorm = code >= 95 || desc.indexOf('Гроза') !== -1; // гроза → молнии
    var stormClouds = hasStorm || code === 65 || code === 82 || (rain >= 5); // сильный дождь/ливень/гроза → грозовые облака
    var c;
    if (tod === 'night') c = '#15233d';
    else if (tod === 'morning') c = '#f6b89c';
    else if (tod === 'evening') c = '#f0a868';
    else c = '#42a5f5';
    // 22.09-129: два варианта сцены. Блок «погода сегодня» на главной
    // (opt.leftFade) — эффекты растворяются маской к левому краю; 22.09-132:
    // цвет неба заливает ВЕСЬ блок, а слева поверх лежит слой размытия
    // (см. ниже) — анимация там расплывается, преобладает чистый цвет неба.
    // Окно прогноза «по часам» — без фейда и без размытия (как есть).
    var _leftFade = !!(opt && opt.leftFade);
    var sceneBg = 'linear-gradient(to right,' + c + ' 0%,' + c + ' 60%,' + c + ' 100%)';
    var windy = (wf.wind || 0) >= 5; // средний/сильный ветер → дождь под углом + линии ветра
    var scene = '<div class="wx-scene' + (windy ? ' wx-windy' : '') + '" style="background:' + sceneBg + ';transition:background 1.2s ease">';
    // При левом фейде звёзды/ветер/снег уходят в ноль к ~25% ширины (как раньше);
    // без фейда (прогноз) — эффекты летают по всему блоку
    var maskCss = 'position:absolute;inset:0;pointer-events:none' +
      (_leftFade ? ';-webkit-mask-image:linear-gradient(to right,transparent 25%,black 55%);mask-image:linear-gradient(to right,transparent 25%,black 55%)' : '');
    // Небесное тело (чистый CSS — без эмодзи)
    if (tod === 'night') {
      scene += '<div style="' + maskCss + '">';
      for (var i = 0; i < 20; i++) scene += '<span class="wx-star" style="left:' + (28+Math.random()*70).toFixed(1) + '%;top:' + (Math.random()*70).toFixed(1) + '%;animation-delay:' + (Math.random()*2.5).toFixed(2) + 's"></span>';
      scene += '</div>';
      // Луна: фаза рисуется смещением круга-тени по расчётной фазе
      var mp = getMoonPhase(now);
      var _md = 46;
      var _shLeft = mp <= 0.5 ? -2 * mp * _md : 2 * (1 - mp) * _md;
      scene += '<span class="wx-moon" style="top:-6px;right:12px;z-index:1"><span class="wx-moon-shadow" style="left:' + _shLeft.toFixed(0) + 'px"></span></span>';
    } else {
      // Солнце: светящийся диск + вращающиеся лучи; при ясной погоде — ещё полупрозрачные толстые лучи (god rays) через весь блок
      var _sunny = !cloudy && !hasRain && !hasSnow && !hasStorm;
      if (_sunny) scene += '<div class="wx-godrays"></div>';
      var _sunCls = !_sunny ? ' dim' : (tod === 'evening' ? ' evening' : (tod === 'morning' ? ' morning' : ''));
      scene += '<span class="wx-sun-wrap' + _sunCls + '" style="top:-26px;right:6px;z-index:1"><span class="wx-sun"></span>';
      if (_sunny) scene += '<span class="wx-sun-rays"></span>';
      scene += '</span>';
    }
    // Облака (чистый CSS: основание + выпуклости, масштаб случайный)
    // Минимум 10–14 (ясная погода), при облачности/осадках/грозе — 20
    var nc = (cloudy || hasRain || hasSnow || hasStorm) ? 20 : (10 + Math.floor(Math.random() * 5));
    var _windFactor = Math.max(0.3, 1 - (wf.wind || 0) / 30);
    for (var cf = 0; cf < nc; cf++) {
      var cAnim = cf % 2 === 0 ? 'wxCloudRight' : 'wxCloudLeft';
      var cDur = (400 + Math.random() * 640) * _windFactor;
      var cScale = (0.62 + Math.random() * 0.5).toFixed(2);
      var cTop = Math.random() * 82;
      var cZ = Math.random() < 0.5 ? 0 : 2;
      var cDark = stormClouds && Math.random() < 0.5; // половина облаков — грозовые (тёмные)
      scene += '<span class="wx-cloud' + (cDark ? ' dark' : '') + '" style="top:' + cTop.toFixed(0) + '%;transform:scale(' + cScale + ');z-index:' + cZ + ';opacity:' + (cDark ? '.92' : '.78') + ';animation:' + cAnim + ' ' + cDur.toFixed(0) + 's linear infinite;animation-delay:-' + (Math.random()*cDur).toFixed(0) + 's"></span>';
    }
    // Ветер: полупрозрачные изогнутые линии, движущиеся слева направо
    if (windy) {
      var nw = 5 + Math.floor(Math.random() * 4);
      scene += '<div style="' + maskCss + '">';
      for (var wi = 0; wi < nw; wi++) {
        var wTop = Math.random() * 85;
        var wW = (30 + Math.random() * 50).toFixed(0);
        var wDur = (2 + Math.random() * 3).toFixed(1);
        scene += '<span class="wx-wind" style="top:' + wTop.toFixed(0) + '%;width:' + wW + 'px;animation:wxWindMove ' + wDur + 's linear infinite;animation-delay:-' + (Math.random() * wDur).toFixed(1) + 's"></span>';
      }
      scene += '</div>';
    }
    // Капли дождя: на главной — как раньше, полоса справа от 28% с фейдом;
    // в прогнозе — по всей ширине блока
    if (hasRain || hasStorm) {
      var ri = rainIntensity(wf);
      scene += '<div style="position:absolute;' + (_leftFade ? 'left:28%;' : 'left:0;') +
        'top:0;right:0;bottom:0;overflow:hidden;pointer-events:none' +
        (_leftFade ? ';-webkit-mask:linear-gradient(to right,transparent,#000 14%);mask:linear-gradient(to right,transparent,#000 14%)' : '') + '">';
      for (var r = 0; r < ri.count; r++) scene += '<span class="wx-drop" style="left:' + (Math.random()*100).toFixed(1) + '%;top:0;animation-delay:-' + (Math.random()*ri.dur).toFixed(2) + 's;animation-duration:' + (ri.dur+Math.random()*0.3).toFixed(2) + 's"></span>';
      scene += '</div>';
    }
    // Снежинки (чистый CSS): на главной — справа от 28% (как раньше), в прогнозе —
    // по всей ширине. При ветре — анимация wxFlakeFallWind.
    if (hasSnow) {
      var _flakeAnim = windy ? 'wxFlakeFallWind' : 'wxFlakeFall';
      var _flakeLeft = function () { return _leftFade ? (28 + Math.random() * 70) : (Math.random() * 100); };
      scene += '<div style="' + maskCss + ';z-index:3">';
      for (var sf = 0; sf < 14; sf++) scene += '<span class="wx-flake" style="left:' + _flakeLeft().toFixed(1) + '%;top:0;animation-name:' + _flakeAnim + ';animation-delay:' + (Math.random()*3.5).toFixed(2) + 's;animation-duration:' + (2.5+Math.random()*2).toFixed(2) + 's"></span>';
      scene += '</div>';
    }
    // Грозовые облака: контейнер для маленьких молний, бьющих из облаков
    if (stormClouds) {
      scene += '<div class="wx-sparks" id="wx-sparks"></div>';
    }
    // Гроза: контейнеры для случайных вспышек молний (запускаются setupLightning на дашборде)
    if (hasStorm) {
      scene += '<div class="wx-flash" id="wx-flash"></div>';
      scene += '<div class="wx-bolts" id="wx-bolts"></div>';
    }
    // 22.09-132: только дашборд (leftFade). Слой «размытия» слева, под текстом
    // погоды и кнопкой «🗺 Карта погоды»: backdrop-blur растворяет анимацию в
    // мягкие пятна (облака/капли расплываются), лёгкая тёмная вуаль сохраняет
    // читаемость белого текста; маской слой плавно исчезает к ~58% ширины
    // блока (элемент занимает левые 62%, прозрачен с 94% своей ширины) —
    // преобладает чистый цвет неба. Без поддержки backdrop-filter остаётся
    // вуаль: небо читается, детали приглушены. z-index 5: выше облаков (0/2),
    // снега (3), искр (4); молнии (6) остаются поверх.
    if (_leftFade) {
      scene += '<div style="position:absolute;left:0;top:0;bottom:0;right:38%;pointer-events:none;z-index:5;' +
        'background:linear-gradient(to right,rgba(8,20,40,.34) 0%,rgba(8,20,40,.16) 48%,rgba(8,20,40,0) 94%);' +
        '-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);' +
        '-webkit-mask-image:linear-gradient(to right,black 0%,black 55%,transparent 94%);' +
        'mask-image:linear-gradient(to right,black 0%,black 55%,transparent 94%)"></div>';
    }
    scene += '</div>';
    return { html: scene, bg: sceneBg };
  }

  /* ---------- МОЛНИИ ПРИ ГРОЗЕ (случайные вспышки с ответвлениями) ---------- */
  var wxLightningTimer = null;
  var wxStrikeHideTm = null;
  var wxSecondBoltTm = null;
  var wxSparkTimer = null;
  var wxSparkHideTm = null;
  function stopLightning() {
    if (wxLightningTimer) { clearTimeout(wxLightningTimer); wxLightningTimer = null; }
    if (wxStrikeHideTm) { clearTimeout(wxStrikeHideTm); wxStrikeHideTm = null; }
    if (wxSecondBoltTm) { clearTimeout(wxSecondBoltTm); wxSecondBoltTm = null; }
    if (wxSparkTimer) { clearTimeout(wxSparkTimer); wxSparkTimer = null; }
    if (wxSparkHideTm) { clearTimeout(wxSparkHideTm); wxSparkHideTm = null; }
    var f = document.getElementById('wx-flash'); if (f) f.classList.remove('on');
    var h = document.getElementById('wx-bolts'); if (h) h.innerHTML = '';
    var sp = document.getElementById('wx-sparks'); if (sp) sp.innerHTML = '';
  }
  // Запуск вспышек: большие молнии (гроза) и/или маленькие искры из грозовых облаков
  function setupLightning() {
    stopLightning();
    var hasBig = !!document.getElementById('wx-bolts');
    var hasSparks = !!document.getElementById('wx-sparks');
    if (!hasBig && !hasSparks) return; // грозы/ливня нет / не дашборд
    if (hasBig) {
      (function loop() {
        var delay = 2200 + Math.random() * 3800; // 2.2–6.0 c между большими разрядами
        wxLightningTimer = setTimeout(function () {
          if (!document.getElementById('wx-bolts')) { stopLightning(); return; }
          fireLightningStrike();
          loop();
        }, delay);
      })();
    }
    if (hasSparks) {
      (function sparkLoop() {
        var delay = 700 + Math.random() * 1300; // 0.7–2.0 c между маленькими молниями
        wxSparkTimer = setTimeout(function () {
          if (!document.getElementById('wx-sparks')) { stopLightning(); return; }
          sparkStrike();
          sparkLoop();
        }, delay);
      })();
    }
  }
  // Маленькая молния из грозового облака: бьёт строго из нижнего края тёмного облака
  function sparkStrike() {
    var host = document.getElementById('wx-sparks');
    if (!host) return;
    var scene = host.parentNode;
    if (!scene) return;
    var darkClouds = scene.querySelectorAll('.wx-cloud.dark');
    if (!darkClouds.length) return;
    var cloud = darkClouds[Math.floor(Math.random() * darkClouds.length)];
    var sRect = scene.getBoundingClientRect();
    var cRect = cloud.getBoundingClientRect();
    var x = (cRect.left - sRect.left) + cRect.width * (0.2 + Math.random() * 0.6);
    var y = (cRect.bottom - sRect.top) - 3;
    var len = 12 + Math.random() * 22;
    var ang = Math.PI * (0.25 + Math.random() * 0.5);
    var ex = x + Math.cos(ang) * len;
    var ey = y + Math.abs(Math.sin(ang)) * len + 6;
    var segs = 2 + Math.floor(Math.random() * 2);
    host.innerHTML = wxBoltSegments(wxJaggedPolyline(x, y, ex, ey, segs), 1.4, 1);
    if (wxSparkHideTm) clearTimeout(wxSparkHideTm);
    wxSparkHideTm = setTimeout(function () { host.innerHTML = ''; }, 90 + Math.random() * 70);
  }
  // Разряд грозы: одна молния; при удаче (35%) — вторая бьёт через 0.5 с после первой.
  function fireLightningStrike() {
    strikeOnce();
    if (Math.random() < 0.35) {
      wxSecondBoltTm = setTimeout(function () { strikeOnce(); }, 500);
    }
  }
  // Один разряд молнии: бьёт в случайном месте по всему блоку (зигзаг + ответвления),
  // кратко засвечивает сцену и самоочищается через ~0.3 с.
  function strikeOnce() {
    var host = document.getElementById('wx-bolts');
    var flash = document.getElementById('wx-flash');
    if (!host || !flash) return;
    var W = host.clientWidth || 600;
    var H = host.clientHeight || 80;
    var yellow = Math.random() < 0.2; // 20% — жёлтая вспышка и жёлтый свет
    flash.classList.toggle('yellow', yellow);
    host.classList.toggle('yellow', yellow);
    // Главная молния: старт в верхней зоне, удар в любую точку нижней части блока
    var x0 = 6 + Math.random() * Math.max(1, W - 12);
    var y0 = -10 + Math.random() * (H * 0.2);
    var x1 = 6 + Math.random() * Math.max(1, W - 12);
    var y1 = H * (0.5 + Math.random() * 0.55);
    var segs = 5 + Math.floor(Math.random() * 4);
    var main = wxJaggedPolyline(x0, y0, x1, y1, segs);
    var html = wxBoltSegments(main, 2.6, 1);
    // Ответвления («пучки») в случайных направлениях из случайных вершин
    var branches = 1 + Math.floor(Math.random() * 3);
    for (var b = 0; b < branches; b++) {
      if (main.length < 3) break;
      var vi = 1 + Math.floor(Math.random() * (main.length - 2));
      var bx = main[vi][0], by = main[vi][1];
      var ang = Math.PI + Math.random() * Math.PI;   // вниз и в любую сторону
      var len = 18 + Math.random() * 44;
      var ex = bx + Math.cos(ang) * len;
      var ey = by + Math.abs(Math.sin(ang)) * len;   // преимущественно вниз
      html += wxBoltSegments(wxJaggedPolyline(bx, by, ex, ey, 2 + Math.floor(Math.random() * 2)), 1.8, 0.8);
    }
    host.innerHTML = html;
    // Вспышка на всю сцену (перезапуск анимации)
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    if (wxStrikeHideTm) clearTimeout(wxStrikeHideTm);
    wxStrikeHideTm = setTimeout(function () {
      host.innerHTML = '';
      flash.classList.remove('on');
    }, 230 + Math.random() * 90);
  }
  // Ломаная (зигзаг) от (x0,y0) до (x1,y1) из segs сегментов с боковым дрожанием.
  function wxJaggedPolyline(x0, y0, x1, y1, segs) {
    var pts = [[x0, y0]];
    var dx = x1 - x0, dy = y1 - y0;
    var L = Math.sqrt(dx * dx + dy * dy);
    var maxJ = Math.min(40, L * 0.2);
    var pl = Math.max(1, L);
    var nx = -dy / pl, ny = dx / pl; // перпендикуляр для бокового отклонения
    for (var i = 1; i < segs; i++) {
      var t = i / segs;
      var j = (Math.random() * 2 - 1) * maxJ;
      pts.push([x0 + dx * t + nx * j, y0 + dy * t + ny * j]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  // Превращает ломаную в набор наклонных светящихся полос (.wx-seg)
  function wxBoltSegments(pts, thickness, alpha) {
    var s = '';
    for (var i = 1; i < pts.length; i++) {
      var x1 = pts[i - 1][0], y1 = pts[i - 1][1], x2 = pts[i][0], y2 = pts[i][1];
      var dx = x2 - x1, dy = y2 - y1;
      var len = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      s += '<i class="wx-seg" style="left:' + (mx - len / 2).toFixed(1) + 'px;top:' + (my - thickness / 2).toFixed(1) + 'px;width:' + len.toFixed(1) + 'px;height:' + thickness + 'px;opacity:' + alpha + ';transform:rotate(' + ang.toFixed(1) + 'deg)"></i>';
    }
    return s;
  }


  // 🗺 Карта погоды: ТОЛЬКО Open-Meteo (без радара)
  // Прошлое (0..nowH) — ERA5 архив (api.archive-api.open-meteo.com), будущее (nowH+1..23) — DWD ICON-EU.
  // Ползунок внизу: с 00:00 сегодня до 23:00. Дождь/снег подсвечиваются на карте.
  // Минский район выделен светящейся окантовкой, точки сетки — только внутри района.

  // Граница Минского района (ОSM relation 59190), упрощена до ~88 точек. Формат [lat,lng].
  var MINSK_DISTRICT_BORDER = [[53.9306,27.9145],[53.907,27.9156],[53.9038,27.8846],[53.8889,27.8964],[53.874,27.8653],[53.855,27.8865],[53.8188,27.879],[53.8221,27.9319],[53.8073,27.9619],[53.7679,27.9427],[53.7538,27.8731],[53.765,27.7832],[53.7464,27.7436],[53.734,27.7579],[53.7178,27.7083],[53.7002,27.7206],[53.6839,27.711],[53.6713,27.6534],[53.6529,27.6309],[53.6397,27.6363],[53.6271,27.5358],[53.6505,27.5193],[53.6593,27.5292],[53.6651,27.4718],[53.714,27.4453],[53.7253,27.396],[53.74,27.4168],[53.7636,27.4127],[53.7846,27.3497],[53.8033,27.3683],[53.7955,27.3291],[53.8139,27.2788],[53.8398,27.2568],[53.8473,27.2686],[53.8734,27.1985],[53.8546,27.1772],[53.8711,27.1438],[53.8626,27.0876],[53.8907,27.0668],[53.8847,27.0187],[53.9426,27.0325],[53.9477,27.077],[54.0098,27.132],[54.0036,27.1839],[54.0196,27.1991],[54.0413,27.1923],[54.0453,27.1664],[54.0669,27.1717],[54.0671,27.1898],[54.0846,27.1646],[54.0928,27.2165],[54.1361,27.2135],[54.1474,27.2536],[54.138,27.2866],[54.1487,27.2936],[54.1648,27.2739],[54.1873,27.3062],[54.2081,27.3014],[54.2331,27.338],[54.2465,27.3355],[54.236,27.3556],[54.2518,27.3673],[54.2551,27.4074],[54.2544,27.4379],[54.2379,27.4311],[54.2343,27.4475],[54.2128,27.4477],[54.1889,27.5037],[54.1962,27.568],[54.1739,27.5838],[54.1517,27.5542],[54.1218,27.5698],[54.102,27.5617],[54.0723,27.5923],[54.064,27.6533],[54.0919,27.6432],[54.1029,27.6056],[54.1146,27.6736],[54.1143,27.7076],[54.0911,27.7187],[54.0787,27.8017],[54.0463,27.7946],[54.0298,27.8491],[54.0164,27.8395],[53.9892,27.8579],[53.9927,27.8828],[53.9698,27.8788],[53.9306,27.9145]];

  // Граница города Минска (OSM relation 59195), упрощена. Формат [lat,lng].
  var MINSK_CITY_BORDER = [[53.9281,27.7406],[53.9251,27.7266],[53.9309,27.7158],[53.941,27.7452],[53.952,27.7397],[53.9555,27.7463],[53.9637,27.7387],[53.9583,27.7245],[53.9612,27.6926],[53.958,27.6852],[53.9553,27.6905],[53.9467,27.6643],[53.959,27.6302],[53.9668,27.6416],[53.961,27.6243],[53.9715,27.5955],[53.9661,27.4698],[53.9457,27.4321],[53.9131,27.41],[53.9116,27.4024],[53.9093,27.4083],[53.8916,27.4114],[53.8903,27.402],[53.9033,27.3988],[53.889,27.3991],[53.8858,27.4109],[53.8913,27.4116],[53.8797,27.4171],[53.8816,27.3997],[53.8747,27.3987],[53.872,27.374],[53.8604,27.3967],[53.8677,27.3966],[53.8696,27.4222],[53.8506,27.4349],[53.8426,27.4667],[53.8356,27.4688],[53.8408,27.4819],[53.8324,27.575],[53.8243,27.5799],[53.8241,27.5702],[53.8168,27.5708],[53.8004,27.5863],[53.8037,27.5908],[53.7938,27.5899],[53.8013,27.5996],[53.8239,27.5927],[53.8243,27.5805],[53.8323,27.576],[53.8339,27.646],[53.8444,27.6678],[53.8331,27.679],[53.826,27.6613],[53.8157,27.6551],[53.8264,27.6673],[53.8189,27.6803],[53.8088,27.6702],[53.8048,27.6894],[53.8178,27.713],[53.8311,27.6977],[53.8279,27.714],[53.8385,27.7173],[53.8235,27.7557],[53.8246,27.782],[53.839,27.7825],[53.8447,27.8159],[53.8548,27.8184],[53.86,27.7954],[53.8657,27.7939],[53.863,27.7515],[53.8694,27.7543],[53.8756,27.7745],[53.8758,27.849],[53.8993,27.8491],[53.9034,27.8296],[53.8989,27.7755],[53.9137,27.7451],[53.9193,27.7522],[53.9214,27.7428],[53.9299,27.7491],[53.9281,27.7406]];
  // Граница Минской области (OSM relation 59752), упрощена.
  var MINSK_OBLAST_BORDER = [[54.6607,28.5443],[54.6675,28.6303],[54.5726,28.6903],[54.5631,28.855],[54.5857,28.8838],[54.6089,28.8673],[54.6162,28.9004],[54.5866,29.0198],[54.6424,29.1009],[54.6407,29.2145],[54.5828,29.2062],[54.5567,29.2801],[54.5868,29.3132],[54.5831,29.4034],[54.6201,29.4355],[54.6052,29.4854],[54.4997,29.4509],[54.4666,29.3998],[54.3908,29.4446],[54.3666,29.3428],[54.3191,29.4165],[54.245,29.3356],[54.2124,29.4619],[54.1283,29.4058],[54.0971,29.4476],[54.0934,29.4223],[54.0415,29.4286],[54.0078,29.3266],[53.9187,29.3962],[53.8784,29.3683],[53.8655,29.4204],[53.8415,29.3843],[53.8166,29.3974],[53.8006,29.4928],[53.7871,29.3863],[53.7259,29.3919],[53.7453,29.3213],[53.691,29.3],[53.6562,29.1979],[53.6866,29.0992],[53.645,29.1042],[53.6378,29.0665],[53.5863,29.0846],[53.5815,28.9478],[53.5168,28.9667],[53.6031,28.8156],[53.5789,28.7062],[53.6133,28.6194],[53.5763,28.6225],[53.5777,28.5856],[53.5249,28.568],[53.4768,28.333],[53.4505,28.4046],[53.3974,28.4062],[53.3872,28.3597],[53.3532,28.3512],[53.318,28.3845],[53.321,28.4312],[53.2757,28.4223],[53.2744,28.0817],[53.2221,28.108],[53.1863,28.1856],[53.1987,28.3227],[53.1815,28.351],[53.1564,28.31],[53.1656,28.346],[53.1454,28.3414],[53.1619,28.49],[53.1085,28.5307],[53.0177,28.5297],[52.9987,28.5632],[52.9595,28.4328],[52.8926,28.4818],[52.858,28.4127],[52.8115,28.4452],[52.7596,28.3678],[52.7267,28.368],[52.6831,28.474],[52.6595,28.4375],[52.5437,28.4349],[52.4905,28.342],[52.4747,28.2021],[52.4864,28.1329],[52.5237,28.1224],[52.5146,27.9925],[52.4345,27.9544],[52.4216,27.88],[52.4724,27.6156],[52.543,27.6289],[52.5329,27.3985],[52.4927,27.3481],[52.4391,27.3624],[52.3898,27.279],[52.4192,27.1626],[52.4855,27.1262],[52.4877,27.0579],[52.5597,27.0553],[52.6155,27.0003],[52.6167,27.033],[52.6722,27.0272],[52.6757,27.0654],[52.7781,27.0095],[52.736,26.9579],[52.7682,26.8313],[52.8528,26.7556],[52.8437,26.6884],[52.8938,26.5836],[52.8421,26.5537],[52.832,26.5223],[52.8625,26.5121],[52.8097,26.4568],[52.8424,26.3887],[52.9086,26.4586],[52.9821,26.3851],[53.001,26.4608],[53.0567,26.467],[53.0601,26.5235],[53.1192,26.4691],[53.1311,26.3751],[53.2097,26.2726],[53.2606,26.3855],[53.3176,26.4028],[53.3634,26.3549],[53.4004,26.5804],[53.4984,26.5579],[53.5107,26.4935],[53.5476,26.5472],[53.5762,26.4682],[53.6274,26.4406],[53.6682,26.3596],[53.696,26.3695],[53.7057,26.3052],[53.7608,26.2619],[53.7946,26.2803],[53.8257,26.2253],[53.8284,26.2586],[53.865,26.2293],[53.8971,26.381],[53.9282,26.359],[53.953,26.4351],[53.996,26.4003],[53.9744,26.3008],[54.0581,26.3204],[54.0285,26.1651],[54.101,26.1221],[54.1484,26.1396],[54.141,26.0776],[54.1118,26.0965],[54.1537,26.0032],[54.1951,26.0457],[54.1844,26.1025],[54.2359,26.1961],[54.2137,26.3567],[54.2894,26.4251],[54.3029,26.4875],[54.4083,26.5583],[54.4232,26.6293],[54.4879,26.6565],[54.5592,26.6235],[54.5532,26.6607],[54.5887,26.6611],[54.5933,26.7012],[54.5994,26.6648],[54.6503,26.6449],[54.6586,26.5756],[54.7128,26.5376],[54.7541,26.5494],[54.8361,26.4247],[54.8247,26.3325],[54.8789,26.3653],[54.9346,26.2795],[54.9528,26.2901],[54.9652,26.346],[54.9916,26.3447],[54.942,26.5645],[54.9657,26.6136],[54.9809,26.5913],[54.958,26.7398],[55.0222,26.8992],[54.9666,26.9679],[55.0075,27.1903],[54.9961,27.2568],[54.9405,27.314],[54.9131,27.3043],[54.8576,27.3982],[54.838,27.4933],[54.8087,27.479],[54.8105,27.5552],[54.7702,27.5285],[54.7485,27.7013],[54.6811,27.6994],[54.6668,27.7404],[54.6144,27.7605],[54.6468,27.867],[54.5849,27.9814],[54.6292,28.0515],[54.6301,28.1534],[54.6545,28.1262],[54.6775,28.2048],[54.5527,28.3969],[54.6633,28.4516],[54.6607,28.5443]];

  // Регионы — выделенные участки на карте (Минск, Минский район, Минская область).
  // polygon: граница [lat,lng]; lat/lng: центр для метки и запроса погоды.
  // Выделяются только г. Минск и Минский район (окантовкой). Минская область НЕ выделяется.
  var WX_REGIONS = [
    { name: 'Минск',         border: MINSK_CITY_BORDER,     lat: 53.902, lng: 27.562 },
    { name: 'Минский район', border: MINSK_DISTRICT_BORDER, lat: 53.942, lng: 27.233 }
  ];
  // Мелкие границы внутри Минска (районы города) и Минского района (сельсоветы) — ячейки с данными погоды.
              var WX_CELLS = [
    { fi:3, lat:53.6342, lng:27.53474, border:[[53.6389,27.5387],[53.62746,27.5387],[53.6271,27.5358],[53.6389,27.52748]] },
    { fi:3, lat:53.63378, lng:27.54829, border:[[53.6389,27.5387],[53.6389,27.5587],[53.62997,27.5587],[53.62746,27.5387]] },
    { fi:3, lat:53.63503, lng:27.56816, border:[[53.6389,27.5587],[53.6389,27.5787],[53.63248,27.5787],[53.62997,27.5587]] },
    { fi:3, lat:53.63627, lng:27.58789, border:[[53.6389,27.5787],[53.6389,27.5987],[53.63499,27.5987],[53.63248,27.5787]] },
    { fi:3, lat:53.63747, lng:27.60713, border:[[53.6389,27.5987],[53.6389,27.6187],[53.63749,27.6187],[53.63499,27.5987]] },
    { fi:3, lat:53.63843, lng:27.62244, border:[[53.6389,27.6187],[53.6389,27.62992],[53.63749,27.6187]] },
    { fi:3, lat:53.64533, lng:27.53082, border:[[53.6507,27.5387],[53.6389,27.5387],[53.6389,27.52748],[53.6505,27.5193],[53.6507,27.51953]] },
    { fi:3, lat:53.6448, lng:27.5487, border:[[53.6507,27.5387],[53.6507,27.5587],[53.6389,27.5587],[53.6389,27.5387]] },
    { fi:3, lat:53.6448, lng:27.5687, border:[[53.6507,27.5587],[53.6507,27.5787],[53.6389,27.5787],[53.6389,27.5587]] },
    { fi:3, lat:53.6448, lng:27.5887, border:[[53.6507,27.5787],[53.6507,27.5987],[53.6389,27.5987],[53.6389,27.5787]] },
    { fi:3, lat:53.6448, lng:27.6087, border:[[53.6507,27.5987],[53.6507,27.6187],[53.6389,27.6187],[53.6389,27.5987]] },
    { fi:3, lat:53.64457, lng:27.6264, border:[[53.6389,27.6187],[53.6507,27.6187],[53.6507,27.6318],[53.6397,27.6363],[53.6389,27.62992]] },
    { fi:3, lat:53.66178, lng:27.51168, border:[[53.6625,27.4987],[53.6625,27.5187],[53.66036,27.5187],[53.66238,27.4987]] },
    { fi:3, lat:53.65661, lng:27.53064, border:[[53.6625,27.5187],[53.6625,27.5387],[53.6507,27.5387],[53.6507,27.51953],[53.6593,27.5292],[53.66036,27.5187]] },
    { fi:3, lat:53.6566, lng:27.5487, border:[[53.6625,27.5387],[53.6625,27.5587],[53.6507,27.5587],[53.6507,27.5387]] },
    { fi:3, lat:53.6566, lng:27.5687, border:[[53.6625,27.5587],[53.6625,27.5787],[53.6507,27.5787],[53.6507,27.5587]] },
    { fi:3, lat:53.6566, lng:27.5887, border:[[53.6625,27.5787],[53.6625,27.5987],[53.6507,27.5987],[53.6507,27.5787]] },
    { fi:3, lat:53.6566, lng:27.6087, border:[[53.6625,27.5987],[53.6625,27.6187],[53.6507,27.6187],[53.6507,27.5987]] },
    { fi:3, lat:53.6572, lng:27.62723, border:[[53.6507,27.6187],[53.6625,27.6187],[53.6625,27.6387],[53.65928,27.6387],[53.6529,27.6309],[53.6507,27.6318]] },
    { fi:3, lat:53.66143, lng:27.64001, border:[[53.6625,27.6387],[53.6625,27.64264],[53.65928,27.6387]] },
    { fi:2, lat:53.66997, lng:27.47396, border:[[53.6743,27.4787],[53.6644,27.4787],[53.6651,27.4718],[53.6743,27.46681]] },
    { fi:2, lat:53.66883, lng:27.48901, border:[[53.6743,27.4787],[53.6743,27.4987],[53.6625,27.4987],[53.6625,27.49753],[53.6644,27.4787]] },
    { fi:3, lat:53.6684, lng:27.5087, border:[[53.6743,27.4987],[53.6743,27.5187],[53.6625,27.5187],[53.6625,27.4987]] },
    { fi:3, lat:53.6684, lng:27.5287, border:[[53.6743,27.5187],[53.6743,27.5387],[53.6625,27.5387],[53.6625,27.5187]] },
    { fi:3, lat:53.6684, lng:27.5487, border:[[53.6743,27.5387],[53.6743,27.5587],[53.6625,27.5587],[53.6625,27.5387]] },
    { fi:3, lat:53.6684, lng:27.5687, border:[[53.6743,27.5587],[53.6743,27.5787],[53.6625,27.5787],[53.6625,27.5587]] },
    { fi:3, lat:53.6684, lng:27.5887, border:[[53.6743,27.5787],[53.6743,27.5987],[53.6625,27.5987],[53.6625,27.5787]] },
    { fi:3, lat:53.6684, lng:27.6087, border:[[53.6743,27.5987],[53.6743,27.6187],[53.6625,27.6187],[53.6625,27.5987]] },
    { fi:3, lat:53.6684, lng:27.6287, border:[[53.6743,27.6187],[53.6743,27.6387],[53.6625,27.6387],[53.6625,27.6187]] },
    { fi:3, lat:53.66984, lng:27.64567, border:[[53.6625,27.6387],[53.6743,27.6387],[53.6743,27.6587],[53.67246,27.6587],[53.6713,27.6534],[53.6625,27.64264]] },
    { fi:4, lat:53.67369, lng:27.6615, border:[[53.6743,27.6587],[53.6743,27.66711],[53.67246,27.6587]] },
    { fi:2, lat:53.68062, lng:27.47105, border:[[53.6861,27.4787],[53.6743,27.4787],[53.6743,27.46681],[53.6861,27.46042]] },
    { fi:2, lat:53.6802, lng:27.4887, border:[[53.6861,27.4787],[53.6861,27.4987],[53.6743,27.4987],[53.6743,27.4787]] },
    { fi:3, lat:53.6802, lng:27.5087, border:[[53.6861,27.4987],[53.6861,27.5187],[53.6743,27.5187],[53.6743,27.4987]] },
    { fi:3, lat:53.6802, lng:27.5287, border:[[53.6861,27.5187],[53.6861,27.5387],[53.6743,27.5387],[53.6743,27.5187]] },
    { fi:3, lat:53.6802, lng:27.5487, border:[[53.6861,27.5387],[53.6861,27.5587],[53.6743,27.5587],[53.6743,27.5387]] },
    { fi:3, lat:53.6802, lng:27.5687, border:[[53.6861,27.5587],[53.6861,27.5787],[53.6743,27.5787],[53.6743,27.5587]] },
    { fi:3, lat:53.6802, lng:27.5887, border:[[53.6861,27.5787],[53.6861,27.5987],[53.6743,27.5987],[53.6743,27.5787]] },
    { fi:3, lat:53.6802, lng:27.6087, border:[[53.6861,27.5987],[53.6861,27.6187],[53.6743,27.6187],[53.6743,27.5987]] },
    { fi:3, lat:53.6802, lng:27.6287, border:[[53.6861,27.6187],[53.6861,27.6387],[53.6743,27.6387],[53.6743,27.6187]] },
    { fi:3, lat:53.6802, lng:27.6487, border:[[53.6861,27.6387],[53.6861,27.6587],[53.6743,27.6587],[53.6743,27.6387]] },
    { fi:4, lat:53.68054, lng:27.66829, border:[[53.6743,27.6587],[53.6861,27.6587],[53.6861,27.6787],[53.67683,27.6787],[53.6743,27.66711]] },
    { fi:4, lat:53.68245, lng:27.68767, border:[[53.6861,27.6787],[53.6861,27.6987],[53.68121,27.6987],[53.67683,27.6787]] },
    { fi:4, lat:53.68428, lng:27.70431, border:[[53.6861,27.6987],[53.6861,27.7123],[53.6839,27.711],[53.68121,27.6987]] },
    { fi:2, lat:53.69502, lng:27.45714, border:[[53.6979,27.4587],[53.68927,27.4587],[53.6979,27.45402]] },
    { fi:2, lat:53.69206, lng:27.46881, border:[[53.6979,27.4587],[53.6979,27.4787],[53.6861,27.4787],[53.6861,27.46042],[53.68927,27.4587]] },
    { fi:2, lat:53.692, lng:27.4887, border:[[53.6979,27.4787],[53.6979,27.4987],[53.6861,27.4987],[53.6861,27.4787]] },
    { fi:3, lat:53.692, lng:27.5087, border:[[53.6979,27.4987],[53.6979,27.5187],[53.6861,27.5187],[53.6861,27.4987]] },
    { fi:3, lat:53.692, lng:27.5287, border:[[53.6979,27.5187],[53.6979,27.5387],[53.6861,27.5387],[53.6861,27.5187]] },
    { fi:3, lat:53.692, lng:27.5487, border:[[53.6979,27.5387],[53.6979,27.5587],[53.6861,27.5587],[53.6861,27.5387]] },
    { fi:3, lat:53.692, lng:27.5687, border:[[53.6979,27.5587],[53.6979,27.5787],[53.6861,27.5787],[53.6861,27.5587]] },
    { fi:3, lat:53.692, lng:27.5887, border:[[53.6979,27.5787],[53.6979,27.5987],[53.6861,27.5987],[53.6861,27.5787]] },
    { fi:3, lat:53.692, lng:27.6087, border:[[53.6979,27.5987],[53.6979,27.6187],[53.6861,27.6187],[53.6861,27.5987]] },
    { fi:3, lat:53.692, lng:27.6287, border:[[53.6979,27.6187],[53.6979,27.6387],[53.6861,27.6387],[53.6861,27.6187]] },
    { fi:3, lat:53.692, lng:27.6487, border:[[53.6979,27.6387],[53.6979,27.6587],[53.6861,27.6587],[53.6861,27.6387]] },
    { fi:4, lat:53.692, lng:27.6687, border:[[53.6979,27.6587],[53.6979,27.6787],[53.6861,27.6787],[53.6861,27.6587]] },
    { fi:4, lat:53.692, lng:27.6887, border:[[53.6979,27.6787],[53.6979,27.6987],[53.6861,27.6987],[53.6861,27.6787]] },
    { fi:4, lat:53.69239, lng:27.70734, border:[[53.6861,27.6987],[53.6979,27.6987],[53.6979,27.7187],[53.69697,27.7187],[53.6861,27.7123]] },
    { fi:2, lat:53.7046, lng:27.45455, border:[[53.7097,27.4587],[53.6979,27.4587],[53.6979,27.45402],[53.7097,27.44763]] },
    { fi:2, lat:53.7038, lng:27.4687, border:[[53.7097,27.4587],[53.7097,27.4787],[53.6979,27.4787],[53.6979,27.4587]] },
    { fi:2, lat:53.7038, lng:27.4887, border:[[53.7097,27.4787],[53.7097,27.4987],[53.6979,27.4987],[53.6979,27.4787]] },
    { fi:3, lat:53.7038, lng:27.5087, border:[[53.7097,27.4987],[53.7097,27.5187],[53.6979,27.5187],[53.6979,27.4987]] },
    { fi:3, lat:53.7038, lng:27.5287, border:[[53.7097,27.5187],[53.7097,27.5387],[53.6979,27.5387],[53.6979,27.5187]] },
    { fi:3, lat:53.7038, lng:27.5487, border:[[53.7097,27.5387],[53.7097,27.5587],[53.6979,27.5587],[53.6979,27.5387]] },
    { fi:3, lat:53.7038, lng:27.5687, border:[[53.7097,27.5587],[53.7097,27.5787],[53.6979,27.5787],[53.6979,27.5587]] },
    { fi:3, lat:53.7038, lng:27.5887, border:[[53.7097,27.5787],[53.7097,27.5987],[53.6979,27.5987],[53.6979,27.5787]] },
    { fi:3, lat:53.7038, lng:27.6087, border:[[53.7097,27.5987],[53.7097,27.6187],[53.6979,27.6187],[53.6979,27.5987]] },
    { fi:3, lat:53.7038, lng:27.6287, border:[[53.7097,27.6187],[53.7097,27.6387],[53.6979,27.6387],[53.6979,27.6187]] },
    { fi:3, lat:53.7038, lng:27.6487, border:[[53.7097,27.6387],[53.7097,27.6587],[53.6979,27.6587],[53.6979,27.6387]] },
    { fi:4, lat:53.7038, lng:27.6687, border:[[53.7097,27.6587],[53.7097,27.6787],[53.6979,27.6787],[53.6979,27.6587]] },
    { fi:4, lat:53.7038, lng:27.6887, border:[[53.7097,27.6787],[53.7097,27.6987],[53.6979,27.6987],[53.6979,27.6787]] },
    { fi:4, lat:53.70353, lng:27.70808, border:[[53.6979,27.7187],[53.6979,27.6987],[53.7097,27.6987],[53.7097,27.71396],[53.70292,27.7187]] },
    { fi:4, lat:53.70015, lng:27.71935, border:[[53.6979,27.7187],[53.70292,27.7187],[53.7002,27.7206],[53.6979,27.71925]] },
    { fi:2, lat:53.72103, lng:27.41666, border:[[53.7215,27.4187],[53.7201,27.4187],[53.7215,27.41258]] },
    { fi:2, lat:53.71942, lng:27.43077, border:[[53.7215,27.4187],[53.7215,27.4387],[53.71551,27.4387],[53.7201,27.4187]] },
    { fi:2, lat:53.71628, lng:27.44993, border:[[53.7215,27.4387],[53.7215,27.4587],[53.7097,27.4587],[53.7097,27.44763],[53.714,27.4453],[53.71551,27.4387]] },
    { fi:2, lat:53.7156, lng:27.4687, border:[[53.7215,27.4587],[53.7215,27.4787],[53.7097,27.4787],[53.7097,27.4587]] },
    { fi:2, lat:53.7156, lng:27.4887, border:[[53.7215,27.4787],[53.7215,27.4987],[53.7097,27.4987],[53.7097,27.4787]] },
    { fi:3, lat:53.7156, lng:27.5087, border:[[53.7215,27.4987],[53.7215,27.5187],[53.7097,27.5187],[53.7097,27.4987]] },
    { fi:3, lat:53.7156, lng:27.5287, border:[[53.7215,27.5187],[53.7215,27.5387],[53.7097,27.5387],[53.7097,27.5187]] },
    { fi:3, lat:53.7156, lng:27.5487, border:[[53.7215,27.5387],[53.7215,27.5587],[53.7097,27.5587],[53.7097,27.5387]] },
    { fi:3, lat:53.7156, lng:27.5687, border:[[53.7215,27.5587],[53.7215,27.5787],[53.7097,27.5787],[53.7097,27.5587]] },
    { fi:3, lat:53.7156, lng:27.5887, border:[[53.7215,27.5787],[53.7215,27.5987],[53.7097,27.5987],[53.7097,27.5787]] },
    { fi:3, lat:53.7156, lng:27.6087, border:[[53.7215,27.5987],[53.7215,27.6187],[53.7097,27.6187],[53.7097,27.5987]] },
    { fi:3, lat:53.7156, lng:27.6287, border:[[53.7215,27.6187],[53.7215,27.6387],[53.7097,27.6387],[53.7097,27.6187]] },
    { fi:3, lat:53.7156, lng:27.6487, border:[[53.7215,27.6387],[53.7215,27.6587],[53.7097,27.6587],[53.7097,27.6387]] },
    { fi:4, lat:53.7156, lng:27.6687, border:[[53.7215,27.6587],[53.7215,27.6787],[53.7097,27.6787],[53.7097,27.6587]] },
    { fi:4, lat:53.7156, lng:27.6887, border:[[53.7215,27.6787],[53.7215,27.6987],[53.7097,27.6987],[53.7097,27.6787]] },
    { fi:4, lat:53.71575, lng:27.70561, border:[[53.7097,27.6987],[53.7215,27.6987],[53.7215,27.7187],[53.7212,27.7187],[53.7178,27.7083],[53.7097,27.71396]] },
    { fi:2, lat:53.72573, lng:27.3978, border:[[53.72468,27.3987],[53.7253,27.396],[53.72721,27.3987]] },
    { fi:2, lat:53.72743, lng:27.41033, border:[[53.7333,27.4187],[53.7215,27.4187],[53.7215,27.41258],[53.72468,27.3987],[53.72721,27.3987],[53.7333,27.40732]] },
    { fi:2, lat:53.7274, lng:27.4287, border:[[53.7333,27.4187],[53.7333,27.4387],[53.7215,27.4387],[53.7215,27.4187]] },
    { fi:2, lat:53.7274, lng:27.4487, border:[[53.7333,27.4387],[53.7333,27.4587],[53.7215,27.4587],[53.7215,27.4387]] },
    { fi:2, lat:53.7274, lng:27.4687, border:[[53.7333,27.4587],[53.7333,27.4787],[53.7215,27.4787],[53.7215,27.4587]] },
    { fi:2, lat:53.7274, lng:27.4887, border:[[53.7333,27.4787],[53.7333,27.4987],[53.7215,27.4987],[53.7215,27.4787]] },
    { fi:3, lat:53.7274, lng:27.5087, border:[[53.7333,27.4987],[53.7333,27.5187],[53.7215,27.5187],[53.7215,27.4987]] },
    { fi:3, lat:53.7274, lng:27.5287, border:[[53.7333,27.5187],[53.7333,27.5387],[53.7215,27.5387],[53.7215,27.5187]] },
    { fi:3, lat:53.7274, lng:27.5487, border:[[53.7333,27.5387],[53.7333,27.5587],[53.7215,27.5587],[53.7215,27.5387]] },
    { fi:3, lat:53.7274, lng:27.5687, border:[[53.7333,27.5587],[53.7333,27.5787],[53.7215,27.5787],[53.7215,27.5587]] },
    { fi:3, lat:53.7274, lng:27.5887, border:[[53.7333,27.5787],[53.7333,27.5987],[53.7215,27.5987],[53.7215,27.5787]] },
    { fi:3, lat:53.7274, lng:27.6087, border:[[53.7333,27.5987],[53.7333,27.6187],[53.7215,27.6187],[53.7215,27.5987]] },
    { fi:3, lat:53.7274, lng:27.6287, border:[[53.7333,27.6187],[53.7333,27.6387],[53.7215,27.6387],[53.7215,27.6187]] },
    { fi:3, lat:53.7274, lng:27.6487, border:[[53.7333,27.6387],[53.7333,27.6587],[53.7215,27.6587],[53.7215,27.6387]] },
    { fi:4, lat:53.7274, lng:27.6687, border:[[53.7333,27.6587],[53.7333,27.6787],[53.7215,27.6787],[53.7215,27.6587]] },
    { fi:4, lat:53.7274, lng:27.6887, border:[[53.7333,27.6787],[53.7333,27.6987],[53.7215,27.6987],[53.7215,27.6787]] },
    { fi:4, lat:53.7274, lng:27.7087, border:[[53.7333,27.6987],[53.7333,27.7187],[53.7215,27.7187],[53.7215,27.6987]] },
    { fi:4, lat:53.72869, lng:27.72747, border:[[53.7215,27.7187],[53.7333,27.7187],[53.7333,27.7387],[53.72773,27.7387],[53.7215,27.71963]] },
    { fi:4, lat:53.73144, lng:27.74439, border:[[53.7333,27.7387],[53.7333,27.75576],[53.72773,27.7387]] },
    { fi:2, lat:53.7373, lng:27.41539, border:[[53.7451,27.4187],[53.7333,27.4187],[53.7333,27.40732],[53.74,27.4168],[53.7451,27.41591]] },
    { fi:2, lat:53.7392, lng:27.4287, border:[[53.7451,27.4187],[53.7451,27.4387],[53.7333,27.4387],[53.7333,27.4187]] },
    { fi:2, lat:53.7392, lng:27.4487, border:[[53.7451,27.4387],[53.7451,27.4587],[53.7333,27.4587],[53.7333,27.4387]] },
    { fi:2, lat:53.7392, lng:27.4687, border:[[53.7451,27.4587],[53.7451,27.4787],[53.7333,27.4787],[53.7333,27.4587]] },
    { fi:2, lat:53.7392, lng:27.4887, border:[[53.7451,27.4787],[53.7451,27.4987],[53.7333,27.4987],[53.7333,27.4787]] },
    { fi:3, lat:53.7392, lng:27.5087, border:[[53.7451,27.4987],[53.7451,27.5187],[53.7333,27.5187],[53.7333,27.4987]] },
    { fi:3, lat:53.7392, lng:27.5287, border:[[53.7451,27.5187],[53.7451,27.5387],[53.7333,27.5387],[53.7333,27.5187]] },
    { fi:3, lat:53.7392, lng:27.5487, border:[[53.7451,27.5387],[53.7451,27.5587],[53.7333,27.5587],[53.7333,27.5387]] },
    { fi:3, lat:53.7392, lng:27.5687, border:[[53.7451,27.5587],[53.7451,27.5787],[53.7333,27.5787],[53.7333,27.5587]] },
    { fi:3, lat:53.7392, lng:27.5887, border:[[53.7451,27.5787],[53.7451,27.5987],[53.7333,27.5987],[53.7333,27.5787]] },
    { fi:3, lat:53.7392, lng:27.6087, border:[[53.7451,27.5987],[53.7451,27.6187],[53.7333,27.6187],[53.7333,27.5987]] },
    { fi:3, lat:53.7392, lng:27.6287, border:[[53.7451,27.6187],[53.7451,27.6387],[53.7333,27.6387],[53.7333,27.6187]] },
    { fi:3, lat:53.7392, lng:27.6487, border:[[53.7451,27.6387],[53.7451,27.6587],[53.7333,27.6587],[53.7333,27.6387]] },
    { fi:4, lat:53.7392, lng:27.6687, border:[[53.7451,27.6587],[53.7451,27.6787],[53.7333,27.6787],[53.7333,27.6587]] },
    { fi:4, lat:53.7392, lng:27.6887, border:[[53.7451,27.6787],[53.7451,27.6987],[53.7333,27.6987],[53.7333,27.6787]] },
    { fi:4, lat:53.7392, lng:27.7087, border:[[53.7451,27.6987],[53.7451,27.7187],[53.7333,27.7187],[53.7333,27.6987]] },
    { fi:4, lat:53.7392, lng:27.7287, border:[[53.7451,27.7187],[53.7451,27.7387],[53.7333,27.7387],[53.7333,27.7187]] },
    { fi:4, lat:53.73822, lng:27.74581, border:[[53.7333,27.7387],[53.7451,27.7387],[53.7451,27.7451],[53.734,27.7579],[53.7333,27.75576]] },
    { fi:2, lat:53.75153, lng:27.41675, border:[[53.7569,27.4187],[53.7451,27.4187],[53.7451,27.41591],[53.7569,27.41386]] },
    { fi:2, lat:53.751, lng:27.4287, border:[[53.7569,27.4187],[53.7569,27.4387],[53.7451,27.4387],[53.7451,27.4187]] },
    { fi:2, lat:53.751, lng:27.4487, border:[[53.7569,27.4387],[53.7569,27.4587],[53.7451,27.4587],[53.7451,27.4387]] },
    { fi:2, lat:53.751, lng:27.4687, border:[[53.7569,27.4587],[53.7569,27.4787],[53.7451,27.4787],[53.7451,27.4587]] },
    { fi:2, lat:53.751, lng:27.4887, border:[[53.7569,27.4787],[53.7569,27.4987],[53.7451,27.4987],[53.7451,27.4787]] },
    { fi:3, lat:53.751, lng:27.5087, border:[[53.7569,27.4987],[53.7569,27.5187],[53.7451,27.5187],[53.7451,27.4987]] },
    { fi:3, lat:53.751, lng:27.5287, border:[[53.7569,27.5187],[53.7569,27.5387],[53.7451,27.5387],[53.7451,27.5187]] },
    { fi:3, lat:53.751, lng:27.5487, border:[[53.7569,27.5387],[53.7569,27.5587],[53.7451,27.5587],[53.7451,27.5387]] },
    { fi:3, lat:53.751, lng:27.5687, border:[[53.7569,27.5587],[53.7569,27.5787],[53.7451,27.5787],[53.7451,27.5587]] },
    { fi:3, lat:53.751, lng:27.5887, border:[[53.7569,27.5787],[53.7569,27.5987],[53.7451,27.5987],[53.7451,27.5787]] },
    { fi:3, lat:53.751, lng:27.6087, border:[[53.7569,27.5987],[53.7569,27.6187],[53.7451,27.6187],[53.7451,27.5987]] },
    { fi:3, lat:53.751, lng:27.6287, border:[[53.7569,27.6187],[53.7569,27.6387],[53.7451,27.6387],[53.7451,27.6187]] },
    { fi:3, lat:53.751, lng:27.6487, border:[[53.7569,27.6387],[53.7569,27.6587],[53.7451,27.6587],[53.7451,27.6387]] },
    { fi:4, lat:53.751, lng:27.6687, border:[[53.7569,27.6587],[53.7569,27.6787],[53.7451,27.6787],[53.7451,27.6587]] },
    { fi:4, lat:53.751, lng:27.6887, border:[[53.7569,27.6787],[53.7569,27.6987],[53.7451,27.6987],[53.7451,27.6787]] },
    { fi:4, lat:53.751, lng:27.7087, border:[[53.7569,27.6987],[53.7569,27.7187],[53.7451,27.7187],[53.7451,27.6987]] },
    { fi:4, lat:53.751, lng:27.7287, border:[[53.7569,27.7187],[53.7569,27.7387],[53.7451,27.7387],[53.7451,27.7187]] },
    { fi:4, lat:53.75233, lng:27.74676, border:[[53.7451,27.7387],[53.7569,27.7387],[53.7569,27.7587],[53.75349,27.7587],[53.7464,27.7436],[53.7451,27.7451]] },
    { fi:4, lat:53.75576, lng:27.76112, border:[[53.7569,27.7587],[53.7569,27.76595],[53.75349,27.7587]] },
    { fi:5, lat:53.75646, lng:27.85521, border:[[53.7569,27.8587],[53.75559,27.8587],[53.7569,27.84822]] },
    { fi:5, lat:53.7557, lng:27.8696, border:[[53.7569,27.8587],[53.7569,27.8787],[53.75493,27.8787],[53.7538,27.8731],[53.75559,27.8587]] },
    { fi:5, lat:53.75624, lng:27.88193, border:[[53.7569,27.8787],[53.7569,27.8884],[53.75493,27.8787]] },
    { fi:2, lat:53.76447, lng:27.41285, border:[[53.7687,27.3987],[53.7687,27.4187],[53.7569,27.4187],[53.7569,27.41386],[53.7636,27.4127],[53.76827,27.3987]] },
    { fi:2, lat:53.7628, lng:27.4287, border:[[53.7687,27.4187],[53.7687,27.4387],[53.7569,27.4387],[53.7569,27.4187]] },
    { fi:2, lat:53.7628, lng:27.4487, border:[[53.7687,27.4387],[53.7687,27.4587],[53.7569,27.4587],[53.7569,27.4387]] },
    { fi:2, lat:53.7628, lng:27.4687, border:[[53.7687,27.4587],[53.7687,27.4787],[53.7569,27.4787],[53.7569,27.4587]] },
    { fi:2, lat:53.7628, lng:27.4887, border:[[53.7687,27.4787],[53.7687,27.4987],[53.7569,27.4987],[53.7569,27.4787]] },
    { fi:3, lat:53.7628, lng:27.5087, border:[[53.7687,27.4987],[53.7687,27.5187],[53.7569,27.5187],[53.7569,27.4987]] },
    { fi:3, lat:53.7628, lng:27.5287, border:[[53.7687,27.5187],[53.7687,27.5387],[53.7569,27.5387],[53.7569,27.5187]] },
    { fi:3, lat:53.7628, lng:27.5487, border:[[53.7687,27.5387],[53.7687,27.5587],[53.7569,27.5587],[53.7569,27.5387]] },
    { fi:3, lat:53.7628, lng:27.5687, border:[[53.7687,27.5587],[53.7687,27.5787],[53.7569,27.5787],[53.7569,27.5587]] },
    { fi:3, lat:53.7628, lng:27.5887, border:[[53.7687,27.5787],[53.7687,27.5987],[53.7569,27.5987],[53.7569,27.5787]] },
    { fi:3, lat:53.7628, lng:27.6087, border:[[53.7687,27.5987],[53.7687,27.6187],[53.7569,27.6187],[53.7569,27.5987]] },
    { fi:3, lat:53.7628, lng:27.6287, border:[[53.7687,27.6187],[53.7687,27.6387],[53.7569,27.6387],[53.7569,27.6187]] },
    { fi:3, lat:53.7628, lng:27.6487, border:[[53.7687,27.6387],[53.7687,27.6587],[53.7569,27.6587],[53.7569,27.6387]] },
    { fi:4, lat:53.7628, lng:27.6687, border:[[53.7687,27.6587],[53.7687,27.6787],[53.7569,27.6787],[53.7569,27.6587]] },
    { fi:4, lat:53.7628, lng:27.6887, border:[[53.7687,27.6787],[53.7687,27.6987],[53.7569,27.6987],[53.7569,27.6787]] },
    { fi:4, lat:53.7628, lng:27.7087, border:[[53.7687,27.6987],[53.7687,27.7187],[53.7569,27.7187],[53.7569,27.6987]] },
    { fi:4, lat:53.7628, lng:27.7287, border:[[53.7687,27.7187],[53.7687,27.7387],[53.7569,27.7387],[53.7569,27.7187]] },
    { fi:4, lat:53.7628, lng:27.7487, border:[[53.7687,27.7387],[53.7687,27.7587],[53.7569,27.7587],[53.7569,27.7387]] },
    { fi:4, lat:53.76355, lng:27.76759, border:[[53.7569,27.7587],[53.7687,27.7587],[53.7687,27.7787],[53.76289,27.7787],[53.7569,27.76595]] },
    { fi:4, lat:53.76632, lng:27.78904, border:[[53.7687,27.7787],[53.7687,27.7987],[53.76307,27.7987],[53.765,27.7832],[53.76289,27.7787]] },
    { fi:4, lat:53.76522, lng:27.8093, border:[[53.7687,27.7987],[53.7687,27.8187],[53.76058,27.8187],[53.76307,27.7987]] },
    { fi:5, lat:53.76399, lng:27.82914, border:[[53.7687,27.8187],[53.7687,27.8387],[53.75809,27.8387],[53.76058,27.8187]] },
    { fi:5, lat:53.76293, lng:27.84887, border:[[53.7687,27.8387],[53.7687,27.8587],[53.7569,27.8587],[53.7569,27.84822],[53.75809,27.8387]] },
    { fi:5, lat:53.7628, lng:27.8687, border:[[53.7687,27.8587],[53.7687,27.8787],[53.7569,27.8787],[53.7569,27.8587]] },
    { fi:5, lat:53.76305, lng:27.88839, border:[[53.7569,27.8787],[53.7687,27.8787],[53.7687,27.8987],[53.75899,27.8987],[53.7569,27.8884]] },
    { fi:5, lat:53.76477, lng:27.90782, border:[[53.7687,27.8987],[53.7687,27.9187],[53.76304,27.9187],[53.75899,27.8987]] },
    { fi:5, lat:53.76669, lng:27.92684, border:[[53.7687,27.9187],[53.7687,27.9387],[53.76709,27.9387],[53.76304,27.9187]] },
    { fi:5, lat:53.76809, lng:27.94055, border:[[53.7687,27.9387],[53.7687,27.94309],[53.7679,27.9427],[53.76709,27.9387]] },
    { fi:2, lat:53.77864, lng:27.37313, border:[[53.7805,27.3787],[53.77493,27.3787],[53.7805,27.362]] },
    { fi:2, lat:53.77585, lng:27.38994, border:[[53.7805,27.3787],[53.7805,27.3987],[53.7687,27.3987],[53.7687,27.3974],[53.77493,27.3787]] },
    { fi:2, lat:53.7746, lng:27.4087, border:[[53.7805,27.3987],[53.7805,27.4187],[53.7687,27.4187],[53.7687,27.3987]] },
    { fi:2, lat:53.7746, lng:27.4287, border:[[53.7805,27.4187],[53.7805,27.4387],[53.7687,27.4387],[53.7687,27.4187]] },
    { fi:2, lat:53.7746, lng:27.4487, border:[[53.7805,27.4387],[53.7805,27.4587],[53.7687,27.4587],[53.7687,27.4387]] },
    { fi:2, lat:53.7746, lng:27.4687, border:[[53.7805,27.4587],[53.7805,27.4787],[53.7687,27.4787],[53.7687,27.4587]] },
    { fi:2, lat:53.7746, lng:27.4887, border:[[53.7805,27.4787],[53.7805,27.4987],[53.7687,27.4987],[53.7687,27.4787]] },
    { fi:3, lat:53.7746, lng:27.5087, border:[[53.7805,27.4987],[53.7805,27.5187],[53.7687,27.5187],[53.7687,27.4987]] },
    { fi:3, lat:53.7746, lng:27.5287, border:[[53.7805,27.5187],[53.7805,27.5387],[53.7687,27.5387],[53.7687,27.5187]] },
    { fi:3, lat:53.7746, lng:27.5487, border:[[53.7805,27.5387],[53.7805,27.5587],[53.7687,27.5587],[53.7687,27.5387]] },
    { fi:3, lat:53.7746, lng:27.5687, border:[[53.7805,27.5587],[53.7805,27.5787],[53.7687,27.5787],[53.7687,27.5587]] },
    { fi:3, lat:53.7746, lng:27.5887, border:[[53.7805,27.5787],[53.7805,27.5987],[53.7687,27.5987],[53.7687,27.5787]] },
    { fi:3, lat:53.7746, lng:27.6087, border:[[53.7805,27.5987],[53.7805,27.6187],[53.7687,27.6187],[53.7687,27.5987]] },
    { fi:3, lat:53.7746, lng:27.6287, border:[[53.7805,27.6187],[53.7805,27.6387],[53.7687,27.6387],[53.7687,27.6187]] },
    { fi:3, lat:53.7746, lng:27.6487, border:[[53.7805,27.6387],[53.7805,27.6587],[53.7687,27.6587],[53.7687,27.6387]] },
    { fi:4, lat:53.7746, lng:27.6687, border:[[53.7805,27.6587],[53.7805,27.6787],[53.7687,27.6787],[53.7687,27.6587]] },
    { fi:4, lat:53.7746, lng:27.6887, border:[[53.7805,27.6787],[53.7805,27.6987],[53.7687,27.6987],[53.7687,27.6787]] },
    { fi:4, lat:53.7746, lng:27.7087, border:[[53.7805,27.6987],[53.7805,27.7187],[53.7687,27.7187],[53.7687,27.6987]] },
    { fi:4, lat:53.7746, lng:27.7287, border:[[53.7805,27.7187],[53.7805,27.7387],[53.7687,27.7387],[53.7687,27.7187]] },
    { fi:4, lat:53.7746, lng:27.7487, border:[[53.7805,27.7387],[53.7805,27.7587],[53.7687,27.7587],[53.7687,27.7387]] },
    { fi:4, lat:53.7746, lng:27.7687, border:[[53.7805,27.7587],[53.7805,27.7787],[53.7687,27.7787],[53.7687,27.7587]] },
    { fi:4, lat:53.7746, lng:27.7887, border:[[53.7805,27.7787],[53.7805,27.7987],[53.7687,27.7987],[53.7687,27.7787]] },
    { fi:4, lat:53.7746, lng:27.8087, border:[[53.7805,27.7987],[53.7805,27.8187],[53.7687,27.8187],[53.7687,27.7987]] },
    { fi:5, lat:53.7746, lng:27.8287, border:[[53.7805,27.8187],[53.7805,27.8387],[53.7687,27.8387],[53.7687,27.8187]] },
    { fi:5, lat:53.7746, lng:27.8487, border:[[53.7805,27.8387],[53.7805,27.8587],[53.7687,27.8587],[53.7687,27.8387]] },
    { fi:5, lat:53.7746, lng:27.8687, border:[[53.7805,27.8587],[53.7805,27.8787],[53.7687,27.8787],[53.7687,27.8587]] },
    { fi:5, lat:53.7746, lng:27.8887, border:[[53.7805,27.8787],[53.7805,27.8987],[53.7687,27.8987],[53.7687,27.8787]] },
    { fi:5, lat:53.7746, lng:27.9087, border:[[53.7805,27.8987],[53.7805,27.9187],[53.7687,27.9187],[53.7687,27.8987]] },
    { fi:5, lat:53.7746, lng:27.9287, border:[[53.7805,27.9187],[53.7805,27.9387],[53.7687,27.9387],[53.7687,27.9187]] },
    { fi:5, lat:53.77538, lng:27.94252, border:[[53.7687,27.9387],[53.7805,27.9387],[53.7805,27.94884],[53.7687,27.94309]] },
    { fi:2, lat:53.78651, lng:27.35566, border:[[53.7923,27.3587],[53.7816,27.3587],[53.7846,27.3497],[53.7923,27.35736]] },
    { fi:2, lat:53.78644, lng:27.36877, border:[[53.7923,27.3587],[53.7923,27.3787],[53.7805,27.3787],[53.7805,27.362],[53.7816,27.3587]] },
    { fi:2, lat:53.7864, lng:27.3887, border:[[53.7923,27.3787],[53.7923,27.3987],[53.7805,27.3987],[53.7805,27.3787]] },
    { fi:2, lat:53.7864, lng:27.4087, border:[[53.7923,27.3987],[53.7923,27.4187],[53.7805,27.4187],[53.7805,27.3987]] },
    { fi:2, lat:53.7864, lng:27.4287, border:[[53.7923,27.4187],[53.7923,27.4387],[53.7805,27.4387],[53.7805,27.4187]] },
    { fi:2, lat:53.7864, lng:27.4487, border:[[53.7923,27.4387],[53.7923,27.4587],[53.7805,27.4587],[53.7805,27.4387]] },
    { fi:2, lat:53.7864, lng:27.4687, border:[[53.7923,27.4587],[53.7923,27.4787],[53.7805,27.4787],[53.7805,27.4587]] },
    { fi:2, lat:53.7864, lng:27.4887, border:[[53.7923,27.4787],[53.7923,27.4987],[53.7805,27.4987],[53.7805,27.4787]] },
    { fi:3, lat:53.7864, lng:27.5087, border:[[53.7923,27.4987],[53.7923,27.5187],[53.7805,27.5187],[53.7805,27.4987]] },
    { fi:3, lat:53.7864, lng:27.5287, border:[[53.7923,27.5187],[53.7923,27.5387],[53.7805,27.5387],[53.7805,27.5187]] },
    { fi:3, lat:53.7864, lng:27.5487, border:[[53.7923,27.5387],[53.7923,27.5587],[53.7805,27.5587],[53.7805,27.5387]] },
    { fi:3, lat:53.7864, lng:27.5687, border:[[53.7923,27.5587],[53.7923,27.5787],[53.7805,27.5787],[53.7805,27.5587]] },
    { fi:3, lat:53.7864, lng:27.5887, border:[[53.7923,27.5787],[53.7923,27.5987],[53.7805,27.5987],[53.7805,27.5787]] },
    { fi:3, lat:53.7864, lng:27.6087, border:[[53.7923,27.5987],[53.7923,27.6187],[53.7805,27.6187],[53.7805,27.5987]] },
    { fi:3, lat:53.7864, lng:27.6287, border:[[53.7923,27.6187],[53.7923,27.6387],[53.7805,27.6387],[53.7805,27.6187]] },
    { fi:3, lat:53.7864, lng:27.6487, border:[[53.7923,27.6387],[53.7923,27.6587],[53.7805,27.6587],[53.7805,27.6387]] },
    { fi:4, lat:53.7864, lng:27.6687, border:[[53.7923,27.6587],[53.7923,27.6787],[53.7805,27.6787],[53.7805,27.6587]] },
    { fi:4, lat:53.7864, lng:27.6887, border:[[53.7923,27.6787],[53.7923,27.6987],[53.7805,27.6987],[53.7805,27.6787]] },
    { fi:4, lat:53.7864, lng:27.7087, border:[[53.7923,27.6987],[53.7923,27.7187],[53.7805,27.7187],[53.7805,27.6987]] },
    { fi:4, lat:53.7864, lng:27.7287, border:[[53.7923,27.7187],[53.7923,27.7387],[53.7805,27.7387],[53.7805,27.7187]] },
    { fi:4, lat:53.7864, lng:27.7487, border:[[53.7923,27.7387],[53.7923,27.7587],[53.7805,27.7587],[53.7805,27.7387]] },
    { fi:4, lat:53.7864, lng:27.7687, border:[[53.7923,27.7587],[53.7923,27.7787],[53.7805,27.7787],[53.7805,27.7587]] },
    { fi:4, lat:53.7864, lng:27.7887, border:[[53.7923,27.7787],[53.7923,27.7987],[53.7805,27.7987],[53.7805,27.7787]] },
    { fi:4, lat:53.7864, lng:27.8087, border:[[53.7923,27.7987],[53.7923,27.8187],[53.7805,27.8187],[53.7805,27.7987]] },
    { fi:5, lat:53.7864, lng:27.8287, border:[[53.7923,27.8187],[53.7923,27.8387],[53.7805,27.8387],[53.7805,27.8187]] },
    { fi:5, lat:53.7864, lng:27.8487, border:[[53.7923,27.8387],[53.7923,27.8587],[53.7805,27.8587],[53.7805,27.8387]] },
    { fi:5, lat:53.7864, lng:27.8687, border:[[53.7923,27.8587],[53.7923,27.8787],[53.7805,27.8787],[53.7805,27.8587]] },
    { fi:5, lat:53.7864, lng:27.8887, border:[[53.7923,27.8787],[53.7923,27.8987],[53.7805,27.8987],[53.7805,27.8787]] },
    { fi:5, lat:53.7864, lng:27.9087, border:[[53.7923,27.8987],[53.7923,27.9187],[53.7805,27.9187],[53.7805,27.8987]] },
    { fi:5, lat:53.7864, lng:27.9287, border:[[53.7923,27.9187],[53.7923,27.9387],[53.7805,27.9387],[53.7805,27.9187]] },
    { fi:5, lat:53.78683, lng:27.94531, border:[[53.7805,27.9387],[53.7923,27.9387],[53.7923,27.95459],[53.7805,27.94884]] },
    { fi:7, lat:53.8025, lng:27.31433, border:[[53.8041,27.3187],[53.7993,27.3187],[53.8041,27.30559]] },
    { fi:7, lat:53.80045, lng:27.32917, border:[[53.8041,27.3187],[53.8041,27.3387],[53.79741,27.3387],[53.7955,27.3291],[53.7993,27.3187]] },
    { fi:8, lat:53.80161, lng:27.34729, border:[[53.8041,27.3387],[53.8041,27.3587],[53.80139,27.3587],[53.79741,27.3387]] },
    { fi:8, lat:53.79797, lng:27.36997, border:[[53.8041,27.3587],[53.8041,27.3787],[53.7923,27.3787],[53.7923,27.3587],[53.79365,27.3587],[53.8033,27.3683],[53.80139,27.3587]] },
    { fi:8, lat:53.7982, lng:27.3887, border:[[53.8041,27.3787],[53.8041,27.3987],[53.7923,27.3987],[53.7923,27.3787]] },
    { fi:8, lat:53.7982, lng:27.4087, border:[[53.8041,27.3987],[53.8041,27.4187],[53.7923,27.4187],[53.7923,27.3987]] },
    { fi:8, lat:53.7982, lng:27.4287, border:[[53.8041,27.4187],[53.8041,27.4387],[53.7923,27.4387],[53.7923,27.4187]] },
    { fi:8, lat:53.7982, lng:27.4487, border:[[53.8041,27.4387],[53.8041,27.4587],[53.7923,27.4587],[53.7923,27.4387]] },
    { fi:8, lat:53.7982, lng:27.4687, border:[[53.8041,27.4587],[53.8041,27.4787],[53.7923,27.4787],[53.7923,27.4587]] },
    { fi:8, lat:53.7982, lng:27.4887, border:[[53.8041,27.4787],[53.8041,27.4987],[53.7923,27.4987],[53.7923,27.4787]] },
    { fi:9, lat:53.7982, lng:27.5087, border:[[53.8041,27.4987],[53.8041,27.5187],[53.7923,27.5187],[53.7923,27.4987]] },
    { fi:9, lat:53.7982, lng:27.5287, border:[[53.8041,27.5187],[53.8041,27.5387],[53.7923,27.5387],[53.7923,27.5187]] },
    { fi:9, lat:53.7982, lng:27.5487, border:[[53.8041,27.5387],[53.8041,27.5587],[53.7923,27.5587],[53.7923,27.5387]] },
    { fi:9, lat:53.7982, lng:27.5687, border:[[53.8041,27.5587],[53.8041,27.5787],[53.7923,27.5787],[53.7923,27.5587]] },
    { fi:9, lat:53.7982, lng:27.5887, border:[[53.8041,27.5787],[53.8041,27.5987],[53.7923,27.5987],[53.7923,27.5787]] },
    { fi:9, lat:53.7982, lng:27.6087, border:[[53.8041,27.5987],[53.8041,27.6187],[53.7923,27.6187],[53.7923,27.5987]] },
    { fi:9, lat:53.7982, lng:27.6287, border:[[53.8041,27.6187],[53.8041,27.6387],[53.7923,27.6387],[53.7923,27.6187]] },
    { fi:9, lat:53.7982, lng:27.6487, border:[[53.8041,27.6387],[53.8041,27.6587],[53.7923,27.6587],[53.7923,27.6387]] },
    { fi:10, lat:53.7982, lng:27.6687, border:[[53.8041,27.6587],[53.8041,27.6787],[53.7923,27.6787],[53.7923,27.6587]] },
    { fi:10, lat:53.7982, lng:27.6887, border:[[53.8041,27.6787],[53.8041,27.6987],[53.7923,27.6987],[53.7923,27.6787]] },
    { fi:10, lat:53.7982, lng:27.7087, border:[[53.8041,27.6987],[53.8041,27.7187],[53.7923,27.7187],[53.7923,27.6987]] },
    { fi:10, lat:53.7982, lng:27.7287, border:[[53.8041,27.7187],[53.8041,27.7387],[53.7923,27.7387],[53.7923,27.7187]] },
    { fi:10, lat:53.7982, lng:27.7487, border:[[53.8041,27.7387],[53.8041,27.7587],[53.7923,27.7587],[53.7923,27.7387]] },
    { fi:10, lat:53.7982, lng:27.7687, border:[[53.8041,27.7587],[53.8041,27.7787],[53.7923,27.7787],[53.7923,27.7587]] },
    { fi:10, lat:53.7982, lng:27.7887, border:[[53.8041,27.7787],[53.8041,27.7987],[53.7923,27.7987],[53.7923,27.7787]] },
    { fi:10, lat:53.7982, lng:27.8087, border:[[53.8041,27.7987],[53.8041,27.8187],[53.7923,27.8187],[53.7923,27.7987]] },
    { fi:11, lat:53.7982, lng:27.8287, border:[[53.8041,27.8187],[53.8041,27.8387],[53.7923,27.8387],[53.7923,27.8187]] },
    { fi:11, lat:53.7982, lng:27.8487, border:[[53.8041,27.8387],[53.8041,27.8587],[53.7923,27.8587],[53.7923,27.8387]] },
    { fi:11, lat:53.7982, lng:27.8687, border:[[53.8041,27.8587],[53.8041,27.8787],[53.7923,27.8787],[53.7923,27.8587]] },
    { fi:11, lat:53.7982, lng:27.8887, border:[[53.8041,27.8787],[53.8041,27.8987],[53.7923,27.8987],[53.7923,27.8787]] },
    { fi:11, lat:53.7982, lng:27.9087, border:[[53.8041,27.8987],[53.8041,27.9187],[53.7923,27.9187],[53.7923,27.8987]] },
    { fi:11, lat:53.7982, lng:27.9287, border:[[53.8041,27.9187],[53.8041,27.9387],[53.7923,27.9387],[53.7923,27.9187]] },
    { fi:11, lat:53.79844, lng:27.94802, border:[[53.7923,27.9387],[53.8041,27.9387],[53.8041,27.9587],[53.80073,27.9587],[53.7923,27.95459]] },
    { fi:11, lat:53.80298, lng:27.95925, border:[[53.8041,27.9587],[53.8041,27.96034],[53.80073,27.9587]] },
    { fi:7, lat:53.81527, lng:27.27817, border:[[53.8159,27.2787],[53.81402,27.2787],[53.8159,27.2771]] },
    { fi:7, lat:53.81269, lng:27.29087, border:[[53.8159,27.2787],[53.8159,27.2987],[53.80662,27.2987],[53.8139,27.2788],[53.81402,27.2787]] },
    { fi:7, lat:53.81019, lng:27.30899, border:[[53.8159,27.2987],[53.8159,27.3187],[53.8041,27.3187],[53.8041,27.30559],[53.80662,27.2987]] },
    { fi:7, lat:53.81, lng:27.3287, border:[[53.8159,27.3187],[53.8159,27.3387],[53.8041,27.3387],[53.8041,27.3187]] },
    { fi:8, lat:53.81, lng:27.3487, border:[[53.8159,27.3387],[53.8159,27.3587],[53.8041,27.3587],[53.8041,27.3387]] },
    { fi:8, lat:53.81, lng:27.3687, border:[[53.8159,27.3587],[53.8159,27.3787],[53.8041,27.3787],[53.8041,27.3587]] },
    { fi:8, lat:53.81, lng:27.3887, border:[[53.8159,27.3787],[53.8159,27.3987],[53.8041,27.3987],[53.8041,27.3787]] },
    { fi:8, lat:53.81, lng:27.4087, border:[[53.8159,27.3987],[53.8159,27.4187],[53.8041,27.4187],[53.8041,27.3987]] },
    { fi:8, lat:53.81, lng:27.4287, border:[[53.8159,27.4187],[53.8159,27.4387],[53.8041,27.4387],[53.8041,27.4187]] },
    { fi:8, lat:53.81, lng:27.4487, border:[[53.8159,27.4387],[53.8159,27.4587],[53.8041,27.4587],[53.8041,27.4387]] },
    { fi:8, lat:53.81, lng:27.4687, border:[[53.8159,27.4587],[53.8159,27.4787],[53.8041,27.4787],[53.8041,27.4587]] },
    { fi:8, lat:53.81, lng:27.4887, border:[[53.8159,27.4787],[53.8159,27.4987],[53.8041,27.4987],[53.8041,27.4787]] },
    { fi:9, lat:53.81, lng:27.5087, border:[[53.8159,27.4987],[53.8159,27.5187],[53.8041,27.5187],[53.8041,27.4987]] },
    { fi:9, lat:53.81, lng:27.5287, border:[[53.8159,27.5187],[53.8159,27.5387],[53.8041,27.5387],[53.8041,27.5187]] },
    { fi:9, lat:53.81, lng:27.5487, border:[[53.8159,27.5387],[53.8159,27.5587],[53.8041,27.5587],[53.8041,27.5387]] },
    { fi:9, lat:53.81, lng:27.5687, border:[[53.8159,27.5587],[53.8159,27.5787],[53.8041,27.5787],[53.8041,27.5587]] },
    { fi:9, lat:53.81, lng:27.5887, border:[[53.8159,27.5787],[53.8159,27.5987],[53.8041,27.5987],[53.8041,27.5787]] },
    { fi:9, lat:53.81, lng:27.6087, border:[[53.8159,27.5987],[53.8159,27.6187],[53.8041,27.6187],[53.8041,27.5987]] },
    { fi:9, lat:53.81, lng:27.6287, border:[[53.8159,27.6187],[53.8159,27.6387],[53.8041,27.6387],[53.8041,27.6187]] },
    { fi:9, lat:53.81, lng:27.6487, border:[[53.8159,27.6387],[53.8159,27.6587],[53.8041,27.6587],[53.8041,27.6387]] },
    { fi:10, lat:53.81, lng:27.6687, border:[[53.8159,27.6587],[53.8159,27.6787],[53.8041,27.6787],[53.8041,27.6587]] },
    { fi:10, lat:53.81, lng:27.6887, border:[[53.8159,27.6787],[53.8159,27.6987],[53.8041,27.6987],[53.8041,27.6787]] },
    { fi:10, lat:53.81, lng:27.7087, border:[[53.8159,27.6987],[53.8159,27.7187],[53.8041,27.7187],[53.8041,27.6987]] },
    { fi:10, lat:53.81, lng:27.7287, border:[[53.8159,27.7187],[53.8159,27.7387],[53.8041,27.7387],[53.8041,27.7187]] },
    { fi:10, lat:53.81, lng:27.7487, border:[[53.8159,27.7387],[53.8159,27.7587],[53.8041,27.7587],[53.8041,27.7387]] },
    { fi:10, lat:53.81, lng:27.7687, border:[[53.8159,27.7587],[53.8159,27.7787],[53.8041,27.7787],[53.8041,27.7587]] },
    { fi:10, lat:53.81, lng:27.7887, border:[[53.8159,27.7787],[53.8159,27.7987],[53.8041,27.7987],[53.8041,27.7787]] },
    { fi:10, lat:53.81, lng:27.8087, border:[[53.8159,27.7987],[53.8159,27.8187],[53.8041,27.8187],[53.8041,27.7987]] },
    { fi:11, lat:53.81, lng:27.8287, border:[[53.8159,27.8187],[53.8159,27.8387],[53.8041,27.8387],[53.8041,27.8187]] },
    { fi:11, lat:53.81, lng:27.8487, border:[[53.8159,27.8387],[53.8159,27.8587],[53.8041,27.8587],[53.8041,27.8387]] },
    { fi:11, lat:53.81, lng:27.8687, border:[[53.8159,27.8587],[53.8159,27.8787],[53.8041,27.8787],[53.8041,27.8587]] },
    { fi:11, lat:53.81, lng:27.8887, border:[[53.8159,27.8787],[53.8159,27.8987],[53.8041,27.8987],[53.8041,27.8787]] },
    { fi:11, lat:53.81, lng:27.9087, border:[[53.8159,27.8987],[53.8159,27.9187],[53.8041,27.9187],[53.8041,27.8987]] },
    { fi:11, lat:53.81, lng:27.9287, border:[[53.8159,27.9187],[53.8159,27.9387],[53.8041,27.9387],[53.8041,27.9187]] },
    { fi:11, lat:53.80904, lng:27.94729, border:[[53.8041,27.9587],[53.8041,27.9387],[53.8159,27.9387],[53.8159,27.94447],[53.80888,27.9587]] },
    { fi:11, lat:53.80635, lng:27.95991, border:[[53.8041,27.9587],[53.80888,27.9587],[53.8073,27.9619],[53.8041,27.96034]] },
    { fi:7, lat:53.82329, lng:27.27476, border:[[53.8277,27.2787],[53.8159,27.2787],[53.8159,27.2771],[53.8277,27.26708]] },
    { fi:7, lat:53.8218, lng:27.2887, border:[[53.8277,27.2787],[53.8277,27.2987],[53.8159,27.2987],[53.8159,27.2787]] },
    { fi:7, lat:53.8218, lng:27.3087, border:[[53.8277,27.2987],[53.8277,27.3187],[53.8159,27.3187],[53.8159,27.2987]] },
    { fi:7, lat:53.8218, lng:27.3287, border:[[53.8277,27.3187],[53.8277,27.3387],[53.8159,27.3387],[53.8159,27.3187]] },
    { fi:8, lat:53.8218, lng:27.3487, border:[[53.8277,27.3387],[53.8277,27.3587],[53.8159,27.3587],[53.8159,27.3387]] },
    { fi:8, lat:53.8218, lng:27.3687, border:[[53.8277,27.3587],[53.8277,27.3787],[53.8159,27.3787],[53.8159,27.3587]] },
    { fi:8, lat:53.8218, lng:27.3887, border:[[53.8277,27.3787],[53.8277,27.3987],[53.8159,27.3987],[53.8159,27.3787]] },
    { fi:8, lat:53.8218, lng:27.4087, border:[[53.8277,27.3987],[53.8277,27.4187],[53.8159,27.4187],[53.8159,27.3987]] },
    { fi:8, lat:53.8218, lng:27.4287, border:[[53.8277,27.4187],[53.8277,27.4387],[53.8159,27.4387],[53.8159,27.4187]] },
    { fi:8, lat:53.8218, lng:27.4487, border:[[53.8277,27.4387],[53.8277,27.4587],[53.8159,27.4587],[53.8159,27.4387]] },
    { fi:8, lat:53.8218, lng:27.4687, border:[[53.8277,27.4587],[53.8277,27.4787],[53.8159,27.4787],[53.8159,27.4587]] },
    { fi:8, lat:53.8218, lng:27.4887, border:[[53.8277,27.4787],[53.8277,27.4987],[53.8159,27.4987],[53.8159,27.4787]] },
    { fi:9, lat:53.8218, lng:27.5087, border:[[53.8277,27.4987],[53.8277,27.5187],[53.8159,27.5187],[53.8159,27.4987]] },
    { fi:9, lat:53.8218, lng:27.5287, border:[[53.8277,27.5187],[53.8277,27.5387],[53.8159,27.5387],[53.8159,27.5187]] },
    { fi:9, lat:53.8218, lng:27.5487, border:[[53.8277,27.5387],[53.8277,27.5587],[53.8159,27.5587],[53.8159,27.5387]] },
    { fi:9, lat:53.8218, lng:27.5687, border:[[53.8277,27.5587],[53.8277,27.5787],[53.8159,27.5787],[53.8159,27.5587]] },
    { fi:9, lat:53.8218, lng:27.5887, border:[[53.8277,27.5787],[53.8277,27.5987],[53.8159,27.5987],[53.8159,27.5787]] },
    { fi:9, lat:53.8218, lng:27.6087, border:[[53.8277,27.5987],[53.8277,27.6187],[53.8159,27.6187],[53.8159,27.5987]] },
    { fi:9, lat:53.8218, lng:27.6287, border:[[53.8277,27.6187],[53.8277,27.6387],[53.8159,27.6387],[53.8159,27.6187]] },
    { fi:9, lat:53.8218, lng:27.6487, border:[[53.8277,27.6387],[53.8277,27.6587],[53.8159,27.6587],[53.8159,27.6387]] },
    { fi:10, lat:53.8218, lng:27.6687, border:[[53.8277,27.6587],[53.8277,27.6787],[53.8159,27.6787],[53.8159,27.6587]] },
    { fi:10, lat:53.8218, lng:27.6887, border:[[53.8277,27.6787],[53.8277,27.6987],[53.8159,27.6987],[53.8159,27.6787]] },
    { fi:10, lat:53.8218, lng:27.7087, border:[[53.8277,27.6987],[53.8277,27.7187],[53.8159,27.7187],[53.8159,27.6987]] },
    { fi:10, lat:53.8218, lng:27.7287, border:[[53.8277,27.7187],[53.8277,27.7387],[53.8159,27.7387],[53.8159,27.7187]] },
    { fi:10, lat:53.8218, lng:27.7487, border:[[53.8277,27.7387],[53.8277,27.7587],[53.8159,27.7587],[53.8159,27.7387]] },
    { fi:10, lat:53.8218, lng:27.7687, border:[[53.8277,27.7587],[53.8277,27.7787],[53.8159,27.7787],[53.8159,27.7587]] },
    { fi:10, lat:53.8218, lng:27.7887, border:[[53.8277,27.7787],[53.8277,27.7987],[53.8159,27.7987],[53.8159,27.7787]] },
    { fi:10, lat:53.8218, lng:27.8087, border:[[53.8277,27.7987],[53.8277,27.8187],[53.8159,27.8187],[53.8159,27.7987]] },
    { fi:11, lat:53.8218, lng:27.8287, border:[[53.8277,27.8187],[53.8277,27.8387],[53.8159,27.8387],[53.8159,27.8187]] },
    { fi:11, lat:53.8218, lng:27.8487, border:[[53.8277,27.8387],[53.8277,27.8587],[53.8159,27.8587],[53.8159,27.8387]] },
    { fi:11, lat:53.8218, lng:27.8687, border:[[53.8277,27.8587],[53.8277,27.8787],[53.8159,27.8787],[53.8159,27.8587]] },
    { fi:11, lat:53.81857, lng:27.88797, border:[[53.8159,27.8987],[53.8159,27.8787],[53.8277,27.8787],[53.8277,27.88084],[53.8188,27.879],[53.82003,27.8987]] },
    { fi:11, lat:53.81829, lng:27.90914, border:[[53.8159,27.9187],[53.8159,27.8987],[53.82003,27.8987],[53.82128,27.9187]] },
    { fi:11, lat:53.81865, lng:27.92816, border:[[53.8159,27.9387],[53.8159,27.9187],[53.82128,27.9187],[53.8221,27.9319],[53.81875,27.9387]] },
    { fi:11, lat:53.81685, lng:27.94062, border:[[53.8159,27.9387],[53.81875,27.9387],[53.8159,27.94447]] },
    { fi:7, lat:53.83885, lng:27.25815, border:[[53.8395,27.2587],[53.83756,27.2587],[53.8395,27.25705]] },
    { fi:7, lat:53.83415, lng:27.27023, border:[[53.8395,27.2587],[53.8395,27.2787],[53.8277,27.2787],[53.8277,27.26708],[53.83756,27.2587]] },
    { fi:7, lat:53.8336, lng:27.2887, border:[[53.8395,27.2787],[53.8395,27.2987],[53.8277,27.2987],[53.8277,27.2787]] },
    { fi:7, lat:53.8336, lng:27.3087, border:[[53.8395,27.2987],[53.8395,27.3187],[53.8277,27.3187],[53.8277,27.2987]] },
    { fi:7, lat:53.8336, lng:27.3287, border:[[53.8395,27.3187],[53.8395,27.3387],[53.8277,27.3387],[53.8277,27.3187]] },
    { fi:8, lat:53.8336, lng:27.3487, border:[[53.8395,27.3387],[53.8395,27.3587],[53.8277,27.3587],[53.8277,27.3387]] },
    { fi:8, lat:53.8336, lng:27.3687, border:[[53.8395,27.3587],[53.8395,27.3787],[53.8277,27.3787],[53.8277,27.3587]] },
    { fi:8, lat:53.8336, lng:27.3887, border:[[53.8395,27.3787],[53.8395,27.3987],[53.8277,27.3987],[53.8277,27.3787]] },
    { fi:8, lat:53.8336, lng:27.4087, border:[[53.8395,27.3987],[53.8395,27.4187],[53.8277,27.4187],[53.8277,27.3987]] },
    { fi:8, lat:53.8336, lng:27.4287, border:[[53.8395,27.4187],[53.8395,27.4387],[53.8277,27.4387],[53.8277,27.4187]] },
    { fi:8, lat:53.8336, lng:27.4487, border:[[53.8395,27.4387],[53.8395,27.4587],[53.8277,27.4587],[53.8277,27.4387]] },
    { fi:8, lat:53.8336, lng:27.4687, border:[[53.8395,27.4587],[53.8395,27.4787],[53.8277,27.4787],[53.8277,27.4587]] },
    { fi:8, lat:53.8336, lng:27.4887, border:[[53.8395,27.4787],[53.8395,27.4987],[53.8277,27.4987],[53.8277,27.4787]] },
    { fi:9, lat:53.8336, lng:27.5087, border:[[53.8395,27.4987],[53.8395,27.5187],[53.8277,27.5187],[53.8277,27.4987]] },
    { fi:9, lat:53.8336, lng:27.5287, border:[[53.8395,27.5187],[53.8395,27.5387],[53.8277,27.5387],[53.8277,27.5187]] },
    { fi:9, lat:53.8336, lng:27.5487, border:[[53.8395,27.5387],[53.8395,27.5587],[53.8277,27.5587],[53.8277,27.5387]] },
    { fi:9, lat:53.8336, lng:27.5687, border:[[53.8395,27.5587],[53.8395,27.5787],[53.8277,27.5787],[53.8277,27.5587]] },
    { fi:9, lat:53.8336, lng:27.5887, border:[[53.8395,27.5787],[53.8395,27.5987],[53.8277,27.5987],[53.8277,27.5787]] },
    { fi:9, lat:53.8336, lng:27.6087, border:[[53.8395,27.5987],[53.8395,27.6187],[53.8277,27.6187],[53.8277,27.5987]] },
    { fi:9, lat:53.8336, lng:27.6287, border:[[53.8395,27.6187],[53.8395,27.6387],[53.8277,27.6387],[53.8277,27.6187]] },
    { fi:9, lat:53.8336, lng:27.6487, border:[[53.8395,27.6387],[53.8395,27.6587],[53.8277,27.6587],[53.8277,27.6387]] },
    { fi:10, lat:53.8336, lng:27.6687, border:[[53.8395,27.6587],[53.8395,27.6787],[53.8277,27.6787],[53.8277,27.6587]] },
    { fi:10, lat:53.8336, lng:27.6887, border:[[53.8395,27.6787],[53.8395,27.6987],[53.8277,27.6987],[53.8277,27.6787]] },
    { fi:10, lat:53.8336, lng:27.7087, border:[[53.8395,27.6987],[53.8395,27.7187],[53.8277,27.7187],[53.8277,27.6987]] },
    { fi:10, lat:53.8336, lng:27.7287, border:[[53.8395,27.7187],[53.8395,27.7387],[53.8277,27.7387],[53.8277,27.7187]] },
    { fi:10, lat:53.8336, lng:27.7487, border:[[53.8395,27.7387],[53.8395,27.7587],[53.8277,27.7587],[53.8277,27.7387]] },
    { fi:10, lat:53.8336, lng:27.7687, border:[[53.8395,27.7587],[53.8395,27.7787],[53.8277,27.7787],[53.8277,27.7587]] },
    { fi:10, lat:53.8336, lng:27.7887, border:[[53.8395,27.7787],[53.8395,27.7987],[53.8277,27.7987],[53.8277,27.7787]] },
    { fi:10, lat:53.8336, lng:27.8087, border:[[53.8395,27.7987],[53.8395,27.8187],[53.8277,27.8187],[53.8277,27.7987]] },
    { fi:11, lat:53.8336, lng:27.8287, border:[[53.8395,27.8187],[53.8395,27.8387],[53.8277,27.8387],[53.8277,27.8187]] },
    { fi:11, lat:53.8336, lng:27.8487, border:[[53.8395,27.8387],[53.8395,27.8587],[53.8277,27.8587],[53.8277,27.8387]] },
    { fi:11, lat:53.8336, lng:27.8687, border:[[53.8395,27.8587],[53.8395,27.8787],[53.8277,27.8787],[53.8277,27.8587]] },
    { fi:11, lat:53.83431, lng:27.88046, border:[[53.8277,27.8787],[53.8395,27.8787],[53.8395,27.88329],[53.8277,27.88084]] },
    { fi:7, lat:53.84003, lng:27.25799, border:[[53.8395,27.2587],[53.8395,27.25705],[53.8398,27.2568],[53.84101,27.2587]] },
    { fi:7, lat:53.84513, lng:27.27047, border:[[53.8513,27.2587],[53.8513,27.2787],[53.8395,27.2787],[53.8395,27.2587],[53.84101,27.2587],[53.8473,27.2686],[53.85099,27.2587]] },
    { fi:7, lat:53.8454, lng:27.2887, border:[[53.8513,27.2787],[53.8513,27.2987],[53.8395,27.2987],[53.8395,27.2787]] },
    { fi:7, lat:53.8454, lng:27.3087, border:[[53.8513,27.2987],[53.8513,27.3187],[53.8395,27.3187],[53.8395,27.2987]] },
    { fi:7, lat:53.8454, lng:27.3287, border:[[53.8513,27.3187],[53.8513,27.3387],[53.8395,27.3387],[53.8395,27.3187]] },
    { fi:8, lat:53.8454, lng:27.3487, border:[[53.8513,27.3387],[53.8513,27.3587],[53.8395,27.3587],[53.8395,27.3387]] },
    { fi:8, lat:53.8454, lng:27.3687, border:[[53.8513,27.3587],[53.8513,27.3787],[53.8395,27.3787],[53.8395,27.3587]] },
    { fi:8, lat:53.8454, lng:27.3887, border:[[53.8513,27.3787],[53.8513,27.3987],[53.8395,27.3987],[53.8395,27.3787]] },
    { fi:8, lat:53.8454, lng:27.4087, border:[[53.8513,27.3987],[53.8513,27.4187],[53.8395,27.4187],[53.8395,27.3987]] },
    { fi:8, lat:53.8454, lng:27.4287, border:[[53.8513,27.4187],[53.8513,27.4387],[53.8395,27.4387],[53.8395,27.4187]] },
    { fi:8, lat:53.8454, lng:27.4487, border:[[53.8513,27.4387],[53.8513,27.4587],[53.8395,27.4587],[53.8395,27.4387]] },
    { fi:8, lat:53.8454, lng:27.4687, border:[[53.8513,27.4587],[53.8513,27.4787],[53.8395,27.4787],[53.8395,27.4587]] },
    { fi:8, lat:53.8454, lng:27.4887, border:[[53.8513,27.4787],[53.8513,27.4987],[53.8395,27.4987],[53.8395,27.4787]] },
    { fi:9, lat:53.8454, lng:27.5087, border:[[53.8513,27.4987],[53.8513,27.5187],[53.8395,27.5187],[53.8395,27.4987]] },
    { fi:9, lat:53.8454, lng:27.5287, border:[[53.8513,27.5187],[53.8513,27.5387],[53.8395,27.5387],[53.8395,27.5187]] },
    { fi:9, lat:53.8454, lng:27.5487, border:[[53.8513,27.5387],[53.8513,27.5587],[53.8395,27.5587],[53.8395,27.5387]] },
    { fi:9, lat:53.8454, lng:27.5687, border:[[53.8513,27.5587],[53.8513,27.5787],[53.8395,27.5787],[53.8395,27.5587]] },
    { fi:9, lat:53.8454, lng:27.5887, border:[[53.8513,27.5787],[53.8513,27.5987],[53.8395,27.5987],[53.8395,27.5787]] },
    { fi:9, lat:53.8454, lng:27.6087, border:[[53.8513,27.5987],[53.8513,27.6187],[53.8395,27.6187],[53.8395,27.5987]] },
    { fi:9, lat:53.8454, lng:27.6287, border:[[53.8513,27.6187],[53.8513,27.6387],[53.8395,27.6387],[53.8395,27.6187]] },
    { fi:9, lat:53.8454, lng:27.6487, border:[[53.8513,27.6387],[53.8513,27.6587],[53.8395,27.6587],[53.8395,27.6387]] },
    { fi:10, lat:53.8454, lng:27.6687, border:[[53.8513,27.6587],[53.8513,27.6787],[53.8395,27.6787],[53.8395,27.6587]] },
    { fi:10, lat:53.8454, lng:27.6887, border:[[53.8513,27.6787],[53.8513,27.6987],[53.8395,27.6987],[53.8395,27.6787]] },
    { fi:10, lat:53.8454, lng:27.7087, border:[[53.8513,27.6987],[53.8513,27.7187],[53.8395,27.7187],[53.8395,27.6987]] },
    { fi:10, lat:53.8454, lng:27.7287, border:[[53.8513,27.7187],[53.8513,27.7387],[53.8395,27.7387],[53.8395,27.7187]] },
    { fi:10, lat:53.8454, lng:27.7487, border:[[53.8513,27.7387],[53.8513,27.7587],[53.8395,27.7587],[53.8395,27.7387]] },
    { fi:10, lat:53.8454, lng:27.7687, border:[[53.8513,27.7587],[53.8513,27.7787],[53.8395,27.7787],[53.8395,27.7587]] },
    { fi:10, lat:53.8454, lng:27.7887, border:[[53.8513,27.7787],[53.8513,27.7987],[53.8395,27.7987],[53.8395,27.7787]] },
    { fi:10, lat:53.8454, lng:27.8087, border:[[53.8513,27.7987],[53.8513,27.8187],[53.8395,27.8187],[53.8395,27.7987]] },
    { fi:11, lat:53.8454, lng:27.8287, border:[[53.8513,27.8187],[53.8513,27.8387],[53.8395,27.8387],[53.8395,27.8187]] },
    { fi:11, lat:53.8454, lng:27.8487, border:[[53.8513,27.8387],[53.8513,27.8587],[53.8395,27.8587],[53.8395,27.8387]] },
    { fi:11, lat:53.8454, lng:27.8687, border:[[53.8513,27.8587],[53.8513,27.8787],[53.8395,27.8787],[53.8395,27.8587]] },
    { fi:11, lat:53.84581, lng:27.88165, border:[[53.8395,27.8787],[53.8513,27.8787],[53.8513,27.88573],[53.8395,27.88329]] },
    { fi:6, lat:53.86011, lng:27.17236, border:[[53.8631,27.1787],[53.85592,27.1787],[53.8546,27.1772],[53.8631,27.15999]] },
    { fi:7, lat:53.86071, lng:27.18141, border:[[53.8631,27.1787],[53.8631,27.18683],[53.85592,27.1787]] },
    { fi:7, lat:53.86154, lng:27.23452, border:[[53.8631,27.2387],[53.85843,27.2387],[53.8631,27.22616]] },
    { fi:7, lat:53.85864, lng:27.25017, border:[[53.8631,27.2387],[53.8631,27.2587],[53.8513,27.2587],[53.8513,27.25786],[53.85843,27.2387]] },
    { fi:7, lat:53.8572, lng:27.2687, border:[[53.8631,27.2587],[53.8631,27.2787],[53.8513,27.2787],[53.8513,27.2587]] },
    { fi:7, lat:53.8572, lng:27.2887, border:[[53.8631,27.2787],[53.8631,27.2987],[53.8513,27.2987],[53.8513,27.2787]] },
    { fi:7, lat:53.8572, lng:27.3087, border:[[53.8631,27.2987],[53.8631,27.3187],[53.8513,27.3187],[53.8513,27.2987]] },
    { fi:7, lat:53.8572, lng:27.3287, border:[[53.8631,27.3187],[53.8631,27.3387],[53.8513,27.3387],[53.8513,27.3187]] },
    { fi:8, lat:53.8572, lng:27.3487, border:[[53.8631,27.3387],[53.8631,27.3587],[53.8513,27.3587],[53.8513,27.3387]] },
    { fi:8, lat:53.8572, lng:27.3687, border:[[53.8631,27.3587],[53.8631,27.3787],[53.8513,27.3787],[53.8513,27.3587]] },
    { fi:8, lat:53.8572, lng:27.3887, border:[[53.8631,27.3787],[53.8631,27.3987],[53.8513,27.3987],[53.8513,27.3787]] },
    { fi:8, lat:53.8572, lng:27.4087, border:[[53.8631,27.3987],[53.8631,27.4187],[53.8513,27.4187],[53.8513,27.3987]] },
    { fi:8, lat:53.8572, lng:27.4287, border:[[53.8631,27.4187],[53.8631,27.4387],[53.8513,27.4387],[53.8513,27.4187]] },
    { fi:8, lat:53.8572, lng:27.4487, border:[[53.8631,27.4387],[53.8631,27.4587],[53.8513,27.4587],[53.8513,27.4387]] },
    { fi:8, lat:53.8572, lng:27.4687, border:[[53.8631,27.4587],[53.8631,27.4787],[53.8513,27.4787],[53.8513,27.4587]] },
    { fi:8, lat:53.8572, lng:27.4887, border:[[53.8631,27.4787],[53.8631,27.4987],[53.8513,27.4987],[53.8513,27.4787]] },
    { fi:9, lat:53.8572, lng:27.5087, border:[[53.8631,27.4987],[53.8631,27.5187],[53.8513,27.5187],[53.8513,27.4987]] },
    { fi:9, lat:53.8572, lng:27.5287, border:[[53.8631,27.5187],[53.8631,27.5387],[53.8513,27.5387],[53.8513,27.5187]] },
    { fi:9, lat:53.8572, lng:27.5487, border:[[53.8631,27.5387],[53.8631,27.5587],[53.8513,27.5587],[53.8513,27.5387]] },
    { fi:9, lat:53.8572, lng:27.5687, border:[[53.8631,27.5587],[53.8631,27.5787],[53.8513,27.5787],[53.8513,27.5587]] },
    { fi:9, lat:53.8572, lng:27.5887, border:[[53.8631,27.5787],[53.8631,27.5987],[53.8513,27.5987],[53.8513,27.5787]] },
    { fi:9, lat:53.8572, lng:27.6087, border:[[53.8631,27.5987],[53.8631,27.6187],[53.8513,27.6187],[53.8513,27.5987]] },
    { fi:9, lat:53.8572, lng:27.6287, border:[[53.8631,27.6187],[53.8631,27.6387],[53.8513,27.6387],[53.8513,27.6187]] },
    { fi:9, lat:53.8572, lng:27.6487, border:[[53.8631,27.6387],[53.8631,27.6587],[53.8513,27.6587],[53.8513,27.6387]] },
    { fi:10, lat:53.8572, lng:27.6687, border:[[53.8631,27.6587],[53.8631,27.6787],[53.8513,27.6787],[53.8513,27.6587]] },
    { fi:10, lat:53.8572, lng:27.6887, border:[[53.8631,27.6787],[53.8631,27.6987],[53.8513,27.6987],[53.8513,27.6787]] },
    { fi:10, lat:53.8572, lng:27.7087, border:[[53.8631,27.6987],[53.8631,27.7187],[53.8513,27.7187],[53.8513,27.6987]] },
    { fi:10, lat:53.8572, lng:27.7287, border:[[53.8631,27.7187],[53.8631,27.7387],[53.8513,27.7387],[53.8513,27.7187]] },
    { fi:10, lat:53.8572, lng:27.7487, border:[[53.8631,27.7387],[53.8631,27.7587],[53.8513,27.7587],[53.8513,27.7387]] },
    { fi:10, lat:53.8572, lng:27.7687, border:[[53.8631,27.7587],[53.8631,27.7787],[53.8513,27.7787],[53.8513,27.7587]] },
    { fi:10, lat:53.8572, lng:27.7887, border:[[53.8631,27.7787],[53.8631,27.7987],[53.8513,27.7987],[53.8513,27.7787]] },
    { fi:10, lat:53.8572, lng:27.8087, border:[[53.8631,27.7987],[53.8631,27.8187],[53.8513,27.8187],[53.8513,27.7987]] },
    { fi:11, lat:53.8572, lng:27.8287, border:[[53.8631,27.8187],[53.8631,27.8387],[53.8513,27.8387],[53.8513,27.8187]] },
    { fi:11, lat:53.8572, lng:27.8487, border:[[53.8631,27.8387],[53.8631,27.8587],[53.8513,27.8587],[53.8513,27.8387]] },
    { fi:11, lat:53.85718, lng:27.86867, border:[[53.8513,27.8787],[53.8513,27.8587],[53.8631,27.8587],[53.8631,27.87746],[53.86199,27.8787]] },
    { fi:11, lat:53.85525, lng:27.88186, border:[[53.8513,27.8787],[53.86199,27.8787],[53.855,27.8865],[53.8513,27.88573]] },
    { fi:6, lat:53.86969, lng:27.09044, border:[[53.8631,27.08723],[53.87462,27.0787],[53.8749,27.0787],[53.8749,27.0987],[53.86428,27.0987],[53.8631,27.09091]] },
    { fi:6, lat:53.8703, lng:27.10815, border:[[53.8749,27.0987],[53.8749,27.1187],[53.8673,27.1187],[53.86428,27.0987]] },
    { fi:6, lat:53.8718, lng:27.12787, border:[[53.8749,27.1187],[53.8749,27.1387],[53.87033,27.1387],[53.8673,27.1187]] },
    { fi:6, lat:53.87117, lng:27.15066, border:[[53.8749,27.1387],[53.8749,27.1587],[53.86374,27.1587],[53.8711,27.1438],[53.87033,27.1387]] },
    { fi:6, lat:53.86901, lng:27.16872, border:[[53.8749,27.1587],[53.8749,27.1787],[53.8631,27.1787],[53.8631,27.15999],[53.86374,27.1587]] },
    { fi:7, lat:53.86986, lng:27.18654, border:[[53.8631,27.1787],[53.8749,27.1787],[53.8749,27.1987],[53.87333,27.1987],[53.8734,27.1985],[53.8631,27.18683]] },
    { fi:7, lat:53.87182, lng:27.21104, border:[[53.8749,27.1987],[53.8749,27.2187],[53.86588,27.2187],[53.87333,27.1987]] },
    { fi:7, lat:53.86923, lng:27.22905, border:[[53.8749,27.2187],[53.8749,27.2387],[53.8631,27.2387],[53.8631,27.22616],[53.86588,27.2187]] },
    { fi:7, lat:53.869, lng:27.2487, border:[[53.8749,27.2387],[53.8749,27.2587],[53.8631,27.2587],[53.8631,27.2387]] },
    { fi:7, lat:53.869, lng:27.2687, border:[[53.8749,27.2587],[53.8749,27.2787],[53.8631,27.2787],[53.8631,27.2587]] },
    { fi:7, lat:53.869, lng:27.2887, border:[[53.8749,27.2787],[53.8749,27.2987],[53.8631,27.2987],[53.8631,27.2787]] },
    { fi:7, lat:53.869, lng:27.3087, border:[[53.8749,27.2987],[53.8749,27.3187],[53.8631,27.3187],[53.8631,27.2987]] },
    { fi:7, lat:53.869, lng:27.3287, border:[[53.8749,27.3187],[53.8749,27.3387],[53.8631,27.3387],[53.8631,27.3187]] },
    { fi:8, lat:53.869, lng:27.3487, border:[[53.8749,27.3387],[53.8749,27.3587],[53.8631,27.3587],[53.8631,27.3387]] },
    { fi:8, lat:53.869, lng:27.3687, border:[[53.8749,27.3587],[53.8749,27.3787],[53.8631,27.3787],[53.8631,27.3587]] },
    { fi:8, lat:53.869, lng:27.3887, border:[[53.8749,27.3787],[53.8749,27.3987],[53.8631,27.3987],[53.8631,27.3787]] },
    { fi:8, lat:53.869, lng:27.4087, border:[[53.8749,27.3987],[53.8749,27.4187],[53.8631,27.4187],[53.8631,27.3987]] },
    { fi:8, lat:53.869, lng:27.4287, border:[[53.8749,27.4187],[53.8749,27.4387],[53.8631,27.4387],[53.8631,27.4187]] },
    { fi:8, lat:53.869, lng:27.4487, border:[[53.8749,27.4387],[53.8749,27.4587],[53.8631,27.4587],[53.8631,27.4387]] },
    { fi:8, lat:53.869, lng:27.4687, border:[[53.8749,27.4587],[53.8749,27.4787],[53.8631,27.4787],[53.8631,27.4587]] },
    { fi:8, lat:53.869, lng:27.4887, border:[[53.8749,27.4787],[53.8749,27.4987],[53.8631,27.4987],[53.8631,27.4787]] },
    { fi:9, lat:53.869, lng:27.5087, border:[[53.8749,27.4987],[53.8749,27.5187],[53.8631,27.5187],[53.8631,27.4987]] },
    { fi:9, lat:53.869, lng:27.5287, border:[[53.8749,27.5187],[53.8749,27.5387],[53.8631,27.5387],[53.8631,27.5187]] },
    { fi:9, lat:53.869, lng:27.5487, border:[[53.8749,27.5387],[53.8749,27.5587],[53.8631,27.5587],[53.8631,27.5387]] },
    { fi:9, lat:53.869, lng:27.5687, border:[[53.8749,27.5587],[53.8749,27.5787],[53.8631,27.5787],[53.8631,27.5587]] },
    { fi:9, lat:53.869, lng:27.5887, border:[[53.8749,27.5787],[53.8749,27.5987],[53.8631,27.5987],[53.8631,27.5787]] },
    { fi:9, lat:53.869, lng:27.6087, border:[[53.8749,27.5987],[53.8749,27.6187],[53.8631,27.6187],[53.8631,27.5987]] },
    { fi:9, lat:53.869, lng:27.6287, border:[[53.8749,27.6187],[53.8749,27.6387],[53.8631,27.6387],[53.8631,27.6187]] },
    { fi:9, lat:53.869, lng:27.6487, border:[[53.8749,27.6387],[53.8749,27.6587],[53.8631,27.6587],[53.8631,27.6387]] },
    { fi:10, lat:53.869, lng:27.6687, border:[[53.8749,27.6587],[53.8749,27.6787],[53.8631,27.6787],[53.8631,27.6587]] },
    { fi:10, lat:53.869, lng:27.6887, border:[[53.8749,27.6787],[53.8749,27.6987],[53.8631,27.6987],[53.8631,27.6787]] },
    { fi:10, lat:53.869, lng:27.7087, border:[[53.8749,27.6987],[53.8749,27.7187],[53.8631,27.7187],[53.8631,27.6987]] },
    { fi:10, lat:53.869, lng:27.7287, border:[[53.8749,27.7187],[53.8749,27.7387],[53.8631,27.7387],[53.8631,27.7187]] },
    { fi:10, lat:53.869, lng:27.7487, border:[[53.8749,27.7387],[53.8749,27.7587],[53.8631,27.7587],[53.8631,27.7387]] },
    { fi:10, lat:53.869, lng:27.7687, border:[[53.8749,27.7587],[53.8749,27.7787],[53.8631,27.7787],[53.8631,27.7587]] },
    { fi:10, lat:53.869, lng:27.7887, border:[[53.8749,27.7787],[53.8749,27.7987],[53.8631,27.7987],[53.8631,27.7787]] },
    { fi:10, lat:53.869, lng:27.8087, border:[[53.8749,27.7987],[53.8749,27.8187],[53.8631,27.8187],[53.8631,27.7987]] },
    { fi:11, lat:53.869, lng:27.8287, border:[[53.8749,27.8187],[53.8749,27.8387],[53.8631,27.8387],[53.8631,27.8187]] },
    { fi:11, lat:53.869, lng:27.8487, border:[[53.8749,27.8387],[53.8749,27.8587],[53.8631,27.8587],[53.8631,27.8387]] },
    { fi:11, lat:53.868, lng:27.86538, border:[[53.8631,27.8587],[53.8749,27.8587],[53.8749,27.86718],[53.874,27.8653],[53.8631,27.87746]] },
    { fi:6, lat:53.88603, lng:27.0242, border:[[53.8867,27.03473],[53.8847,27.0187],[53.8867,27.01918]] },
    { fi:6, lat:53.88268, lng:27.07572, border:[[53.8867,27.0787],[53.8749,27.0787],[53.8749,27.0785],[53.8867,27.06976]] },
    { fi:6, lat:53.8808, lng:27.0887, border:[[53.8867,27.0787],[53.8867,27.0987],[53.8749,27.0987],[53.8749,27.0787]] },
    { fi:6, lat:53.8808, lng:27.1087, border:[[53.8867,27.0987],[53.8867,27.1187],[53.8749,27.1187],[53.8749,27.0987]] },
    { fi:6, lat:53.8808, lng:27.1287, border:[[53.8867,27.1187],[53.8867,27.1387],[53.8749,27.1387],[53.8749,27.1187]] },
    { fi:6, lat:53.8808, lng:27.1487, border:[[53.8867,27.1387],[53.8867,27.1587],[53.8749,27.1587],[53.8749,27.1387]] },
    { fi:6, lat:53.8808, lng:27.1687, border:[[53.8867,27.1587],[53.8867,27.1787],[53.8749,27.1787],[53.8749,27.1587]] },
    { fi:7, lat:53.8808, lng:27.1887, border:[[53.8867,27.1787],[53.8867,27.1987],[53.8749,27.1987],[53.8749,27.1787]] },
    { fi:7, lat:53.8808, lng:27.2087, border:[[53.8867,27.1987],[53.8867,27.2187],[53.8749,27.2187],[53.8749,27.1987]] },
    { fi:7, lat:53.8808, lng:27.2287, border:[[53.8867,27.2187],[53.8867,27.2387],[53.8749,27.2387],[53.8749,27.2187]] },
    { fi:7, lat:53.8808, lng:27.2487, border:[[53.8867,27.2387],[53.8867,27.2587],[53.8749,27.2587],[53.8749,27.2387]] },
    { fi:7, lat:53.8808, lng:27.2687, border:[[53.8867,27.2587],[53.8867,27.2787],[53.8749,27.2787],[53.8749,27.2587]] },
    { fi:7, lat:53.8808, lng:27.2887, border:[[53.8867,27.2787],[53.8867,27.2987],[53.8749,27.2987],[53.8749,27.2787]] },
    { fi:7, lat:53.8808, lng:27.3087, border:[[53.8867,27.2987],[53.8867,27.3187],[53.8749,27.3187],[53.8749,27.2987]] },
    { fi:7, lat:53.8808, lng:27.3287, border:[[53.8867,27.3187],[53.8867,27.3387],[53.8749,27.3387],[53.8749,27.3187]] },
    { fi:8, lat:53.8808, lng:27.3487, border:[[53.8867,27.3387],[53.8867,27.3587],[53.8749,27.3587],[53.8749,27.3387]] },
    { fi:8, lat:53.8808, lng:27.3687, border:[[53.8867,27.3587],[53.8867,27.3787],[53.8749,27.3787],[53.8749,27.3587]] },
    { fi:8, lat:53.8808, lng:27.3887, border:[[53.8867,27.3787],[53.8867,27.3987],[53.8749,27.3987],[53.8749,27.3787]] },
    { fi:8, lat:53.8808, lng:27.4087, border:[[53.8867,27.3987],[53.8867,27.4187],[53.8749,27.4187],[53.8749,27.3987]] },
    { fi:8, lat:53.8808, lng:27.4287, border:[[53.8867,27.4187],[53.8867,27.4387],[53.8749,27.4387],[53.8749,27.4187]] },
    { fi:8, lat:53.8808, lng:27.4487, border:[[53.8867,27.4387],[53.8867,27.4587],[53.8749,27.4587],[53.8749,27.4387]] },
    { fi:8, lat:53.8808, lng:27.4687, border:[[53.8867,27.4587],[53.8867,27.4787],[53.8749,27.4787],[53.8749,27.4587]] },
    { fi:8, lat:53.8808, lng:27.4887, border:[[53.8867,27.4787],[53.8867,27.4987],[53.8749,27.4987],[53.8749,27.4787]] },
    { fi:9, lat:53.8808, lng:27.5087, border:[[53.8867,27.4987],[53.8867,27.5187],[53.8749,27.5187],[53.8749,27.4987]] },
    { fi:9, lat:53.8808, lng:27.5287, border:[[53.8867,27.5187],[53.8867,27.5387],[53.8749,27.5387],[53.8749,27.5187]] },
    { fi:9, lat:53.8808, lng:27.5487, border:[[53.8867,27.5387],[53.8867,27.5587],[53.8749,27.5587],[53.8749,27.5387]] },
    { fi:9, lat:53.8808, lng:27.5687, border:[[53.8867,27.5587],[53.8867,27.5787],[53.8749,27.5787],[53.8749,27.5587]] },
    { fi:9, lat:53.8808, lng:27.5887, border:[[53.8867,27.5787],[53.8867,27.5987],[53.8749,27.5987],[53.8749,27.5787]] },
    { fi:9, lat:53.8808, lng:27.6087, border:[[53.8867,27.5987],[53.8867,27.6187],[53.8749,27.6187],[53.8749,27.5987]] },
    { fi:9, lat:53.8808, lng:27.6287, border:[[53.8867,27.6187],[53.8867,27.6387],[53.8749,27.6387],[53.8749,27.6187]] },
    { fi:9, lat:53.8808, lng:27.6487, border:[[53.8867,27.6387],[53.8867,27.6587],[53.8749,27.6587],[53.8749,27.6387]] },
    { fi:10, lat:53.8808, lng:27.6687, border:[[53.8867,27.6587],[53.8867,27.6787],[53.8749,27.6787],[53.8749,27.6587]] },
    { fi:10, lat:53.8808, lng:27.6887, border:[[53.8867,27.6787],[53.8867,27.6987],[53.8749,27.6987],[53.8749,27.6787]] },
    { fi:10, lat:53.8808, lng:27.7087, border:[[53.8867,27.6987],[53.8867,27.7187],[53.8749,27.7187],[53.8749,27.6987]] },
    { fi:10, lat:53.8808, lng:27.7287, border:[[53.8867,27.7187],[53.8867,27.7387],[53.8749,27.7387],[53.8749,27.7187]] },
    { fi:10, lat:53.8808, lng:27.7487, border:[[53.8867,27.7387],[53.8867,27.7587],[53.8749,27.7587],[53.8749,27.7387]] },
    { fi:10, lat:53.8808, lng:27.7687, border:[[53.8867,27.7587],[53.8867,27.7787],[53.8749,27.7787],[53.8749,27.7587]] },
    { fi:10, lat:53.8808, lng:27.7887, border:[[53.8867,27.7787],[53.8867,27.7987],[53.8749,27.7987],[53.8749,27.7787]] },
    { fi:10, lat:53.8808, lng:27.8087, border:[[53.8867,27.7987],[53.8867,27.8187],[53.8749,27.8187],[53.8749,27.7987]] },
    { fi:11, lat:53.8808, lng:27.8287, border:[[53.8867,27.8187],[53.8867,27.8387],[53.8749,27.8387],[53.8749,27.8187]] },
    { fi:11, lat:53.8808, lng:27.8487, border:[[53.8867,27.8387],[53.8867,27.8587],[53.8749,27.8587],[53.8749,27.8387]] },
    { fi:11, lat:53.88143, lng:27.86774, border:[[53.8749,27.8587],[53.8867,27.8587],[53.8867,27.8787],[53.88042,27.8787],[53.8749,27.86718]] },
    { fi:11, lat:53.88461, lng:27.88307, border:[[53.8867,27.8787],[53.8867,27.89181],[53.88042,27.8787]] },
    { fi:6, lat:53.89247, lng:27.02959, border:[[53.8867,27.01918],[53.8985,27.02199],[53.8985,27.0387],[53.88719,27.0387],[53.8867,27.03473]] },
    { fi:6, lat:53.89345, lng:27.04829, border:[[53.8985,27.0387],[53.8985,27.0587],[53.88969,27.0587],[53.88719,27.0387]] },
    { fi:6, lat:53.89331, lng:27.06953, border:[[53.8985,27.0587],[53.8985,27.0787],[53.8867,27.0787],[53.8867,27.06976],[53.8907,27.0668],[53.88969,27.0587]] },
    { fi:6, lat:53.8926, lng:27.0887, border:[[53.8985,27.0787],[53.8985,27.0987],[53.8867,27.0987],[53.8867,27.0787]] },
    { fi:6, lat:53.8926, lng:27.1087, border:[[53.8985,27.0987],[53.8985,27.1187],[53.8867,27.1187],[53.8867,27.0987]] },
    { fi:6, lat:53.8926, lng:27.1287, border:[[53.8985,27.1187],[53.8985,27.1387],[53.8867,27.1387],[53.8867,27.1187]] },
    { fi:6, lat:53.8926, lng:27.1487, border:[[53.8985,27.1387],[53.8985,27.1587],[53.8867,27.1587],[53.8867,27.1387]] },
    { fi:6, lat:53.8926, lng:27.1687, border:[[53.8985,27.1587],[53.8985,27.1787],[53.8867,27.1787],[53.8867,27.1587]] },
    { fi:7, lat:53.8926, lng:27.1887, border:[[53.8985,27.1787],[53.8985,27.1987],[53.8867,27.1987],[53.8867,27.1787]] },
    { fi:7, lat:53.8926, lng:27.2087, border:[[53.8985,27.1987],[53.8985,27.2187],[53.8867,27.2187],[53.8867,27.1987]] },
    { fi:7, lat:53.8926, lng:27.2287, border:[[53.8985,27.2187],[53.8985,27.2387],[53.8867,27.2387],[53.8867,27.2187]] },
    { fi:7, lat:53.8926, lng:27.2487, border:[[53.8985,27.2387],[53.8985,27.2587],[53.8867,27.2587],[53.8867,27.2387]] },
    { fi:7, lat:53.8926, lng:27.2687, border:[[53.8985,27.2587],[53.8985,27.2787],[53.8867,27.2787],[53.8867,27.2587]] },
    { fi:7, lat:53.8926, lng:27.2887, border:[[53.8985,27.2787],[53.8985,27.2987],[53.8867,27.2987],[53.8867,27.2787]] },
    { fi:7, lat:53.8926, lng:27.3087, border:[[53.8985,27.2987],[53.8985,27.3187],[53.8867,27.3187],[53.8867,27.2987]] },
    { fi:7, lat:53.8926, lng:27.3287, border:[[53.8985,27.3187],[53.8985,27.3387],[53.8867,27.3387],[53.8867,27.3187]] },
    { fi:8, lat:53.8926, lng:27.3487, border:[[53.8985,27.3387],[53.8985,27.3587],[53.8867,27.3587],[53.8867,27.3387]] },
    { fi:8, lat:53.8926, lng:27.3687, border:[[53.8985,27.3587],[53.8985,27.3787],[53.8867,27.3787],[53.8867,27.3587]] },
    { fi:8, lat:53.8926, lng:27.3887, border:[[53.8985,27.3787],[53.8985,27.3987],[53.8867,27.3987],[53.8867,27.3787]] },
    { fi:8, lat:53.8926, lng:27.4087, border:[[53.8985,27.3987],[53.8985,27.4187],[53.8867,27.4187],[53.8867,27.3987]] },
    { fi:8, lat:53.8926, lng:27.4287, border:[[53.8985,27.4187],[53.8985,27.4387],[53.8867,27.4387],[53.8867,27.4187]] },
    { fi:8, lat:53.8926, lng:27.4487, border:[[53.8985,27.4387],[53.8985,27.4587],[53.8867,27.4587],[53.8867,27.4387]] },
    { fi:8, lat:53.8926, lng:27.4687, border:[[53.8985,27.4587],[53.8985,27.4787],[53.8867,27.4787],[53.8867,27.4587]] },
    { fi:8, lat:53.8926, lng:27.4887, border:[[53.8985,27.4787],[53.8985,27.4987],[53.8867,27.4987],[53.8867,27.4787]] },
    { fi:9, lat:53.8926, lng:27.5087, border:[[53.8985,27.4987],[53.8985,27.5187],[53.8867,27.5187],[53.8867,27.4987]] },
    { fi:9, lat:53.8926, lng:27.5287, border:[[53.8985,27.5187],[53.8985,27.5387],[53.8867,27.5387],[53.8867,27.5187]] },
    { fi:9, lat:53.8926, lng:27.5487, border:[[53.8985,27.5387],[53.8985,27.5587],[53.8867,27.5587],[53.8867,27.5387]] },
    { fi:9, lat:53.8926, lng:27.5687, border:[[53.8985,27.5587],[53.8985,27.5787],[53.8867,27.5787],[53.8867,27.5587]] },
    { fi:9, lat:53.8926, lng:27.5887, border:[[53.8985,27.5787],[53.8985,27.5987],[53.8867,27.5987],[53.8867,27.5787]] },
    { fi:9, lat:53.8926, lng:27.6087, border:[[53.8985,27.5987],[53.8985,27.6187],[53.8867,27.6187],[53.8867,27.5987]] },
    { fi:9, lat:53.8926, lng:27.6287, border:[[53.8985,27.6187],[53.8985,27.6387],[53.8867,27.6387],[53.8867,27.6187]] },
    { fi:9, lat:53.8926, lng:27.6487, border:[[53.8985,27.6387],[53.8985,27.6587],[53.8867,27.6587],[53.8867,27.6387]] },
    { fi:10, lat:53.8926, lng:27.6687, border:[[53.8985,27.6587],[53.8985,27.6787],[53.8867,27.6787],[53.8867,27.6587]] },
    { fi:10, lat:53.8926, lng:27.6887, border:[[53.8985,27.6787],[53.8985,27.6987],[53.8867,27.6987],[53.8867,27.6787]] },
    { fi:10, lat:53.8926, lng:27.7087, border:[[53.8985,27.6987],[53.8985,27.7187],[53.8867,27.7187],[53.8867,27.6987]] },
    { fi:10, lat:53.8926, lng:27.7287, border:[[53.8985,27.7187],[53.8985,27.7387],[53.8867,27.7387],[53.8867,27.7187]] },
    { fi:10, lat:53.8926, lng:27.7487, border:[[53.8985,27.7387],[53.8985,27.7587],[53.8867,27.7587],[53.8867,27.7387]] },
    { fi:10, lat:53.8926, lng:27.7687, border:[[53.8985,27.7587],[53.8985,27.7787],[53.8867,27.7787],[53.8867,27.7587]] },
    { fi:10, lat:53.8926, lng:27.7887, border:[[53.8985,27.7787],[53.8985,27.7987],[53.8867,27.7987],[53.8867,27.7787]] },
    { fi:10, lat:53.8926, lng:27.8087, border:[[53.8985,27.7987],[53.8985,27.8187],[53.8867,27.8187],[53.8867,27.7987]] },
    { fi:11, lat:53.8926, lng:27.8287, border:[[53.8985,27.8187],[53.8985,27.8387],[53.8867,27.8387],[53.8867,27.8187]] },
    { fi:11, lat:53.8926, lng:27.8487, border:[[53.8985,27.8387],[53.8985,27.8587],[53.8867,27.8587],[53.8867,27.8387]] },
    { fi:11, lat:53.8926, lng:27.8687, border:[[53.8985,27.8587],[53.8985,27.8787],[53.8867,27.8787],[53.8867,27.8587]] },
    { fi:11, lat:53.89217, lng:27.88595, border:[[53.8867,27.8787],[53.8985,27.8787],[53.8985,27.8888],[53.8889,27.8964],[53.8867,27.89181]] },
    { fi:6, lat:53.90422, lng:27.03103, border:[[53.9103,27.0387],[53.8985,27.0387],[53.8985,27.02199],[53.9103,27.0248]] },
    { fi:6, lat:53.9044, lng:27.0487, border:[[53.9103,27.0387],[53.9103,27.0587],[53.8985,27.0587],[53.8985,27.0387]] },
    { fi:6, lat:53.9044, lng:27.0687, border:[[53.9103,27.0587],[53.9103,27.0787],[53.8985,27.0787],[53.8985,27.0587]] },
    { fi:6, lat:53.9044, lng:27.0887, border:[[53.9103,27.0787],[53.9103,27.0987],[53.8985,27.0987],[53.8985,27.0787]] },
    { fi:6, lat:53.9044, lng:27.1087, border:[[53.9103,27.0987],[53.9103,27.1187],[53.8985,27.1187],[53.8985,27.0987]] },
    { fi:6, lat:53.9044, lng:27.1287, border:[[53.9103,27.1187],[53.9103,27.1387],[53.8985,27.1387],[53.8985,27.1187]] },
    { fi:6, lat:53.9044, lng:27.1487, border:[[53.9103,27.1387],[53.9103,27.1587],[53.8985,27.1587],[53.8985,27.1387]] },
    { fi:6, lat:53.9044, lng:27.1687, border:[[53.9103,27.1587],[53.9103,27.1787],[53.8985,27.1787],[53.8985,27.1587]] },
    { fi:7, lat:53.9044, lng:27.1887, border:[[53.9103,27.1787],[53.9103,27.1987],[53.8985,27.1987],[53.8985,27.1787]] },
    { fi:7, lat:53.9044, lng:27.2087, border:[[53.9103,27.1987],[53.9103,27.2187],[53.8985,27.2187],[53.8985,27.1987]] },
    { fi:7, lat:53.9044, lng:27.2287, border:[[53.9103,27.2187],[53.9103,27.2387],[53.8985,27.2387],[53.8985,27.2187]] },
    { fi:7, lat:53.9044, lng:27.2487, border:[[53.9103,27.2387],[53.9103,27.2587],[53.8985,27.2587],[53.8985,27.2387]] },
    { fi:7, lat:53.9044, lng:27.2687, border:[[53.9103,27.2587],[53.9103,27.2787],[53.8985,27.2787],[53.8985,27.2587]] },
    { fi:7, lat:53.9044, lng:27.2887, border:[[53.9103,27.2787],[53.9103,27.2987],[53.8985,27.2987],[53.8985,27.2787]] },
    { fi:7, lat:53.9044, lng:27.3087, border:[[53.9103,27.2987],[53.9103,27.3187],[53.8985,27.3187],[53.8985,27.2987]] },
    { fi:7, lat:53.9044, lng:27.3287, border:[[53.9103,27.3187],[53.9103,27.3387],[53.8985,27.3387],[53.8985,27.3187]] },
    { fi:8, lat:53.9044, lng:27.3487, border:[[53.9103,27.3387],[53.9103,27.3587],[53.8985,27.3587],[53.8985,27.3387]] },
    { fi:8, lat:53.9044, lng:27.3687, border:[[53.9103,27.3587],[53.9103,27.3787],[53.8985,27.3787],[53.8985,27.3587]] },
    { fi:8, lat:53.9044, lng:27.3887, border:[[53.9103,27.3787],[53.9103,27.3987],[53.8985,27.3987],[53.8985,27.3787]] },
    { fi:8, lat:53.9044, lng:27.4087, border:[[53.9103,27.3987],[53.9103,27.4187],[53.8985,27.4187],[53.8985,27.3987]] },
    { fi:8, lat:53.9044, lng:27.4287, border:[[53.9103,27.4187],[53.9103,27.4387],[53.8985,27.4387],[53.8985,27.4187]] },
    { fi:8, lat:53.9044, lng:27.4487, border:[[53.9103,27.4387],[53.9103,27.4587],[53.8985,27.4587],[53.8985,27.4387]] },
    { fi:8, lat:53.9044, lng:27.4687, border:[[53.9103,27.4587],[53.9103,27.4787],[53.8985,27.4787],[53.8985,27.4587]] },
    { fi:8, lat:53.9044, lng:27.4887, border:[[53.9103,27.4787],[53.9103,27.4987],[53.8985,27.4987],[53.8985,27.4787]] },
    { fi:9, lat:53.9044, lng:27.5087, border:[[53.9103,27.4987],[53.9103,27.5187],[53.8985,27.5187],[53.8985,27.4987]] },
    { fi:9, lat:53.9044, lng:27.5287, border:[[53.9103,27.5187],[53.9103,27.5387],[53.8985,27.5387],[53.8985,27.5187]] },
    { fi:9, lat:53.9044, lng:27.5487, border:[[53.9103,27.5387],[53.9103,27.5587],[53.8985,27.5587],[53.8985,27.5387]] },
    { fi:9, lat:53.9044, lng:27.5687, border:[[53.9103,27.5587],[53.9103,27.5787],[53.8985,27.5787],[53.8985,27.5587]] },
    { fi:9, lat:53.9044, lng:27.5887, border:[[53.9103,27.5787],[53.9103,27.5987],[53.8985,27.5987],[53.8985,27.5787]] },
    { fi:9, lat:53.9044, lng:27.6087, border:[[53.9103,27.5987],[53.9103,27.6187],[53.8985,27.6187],[53.8985,27.5987]] },
    { fi:9, lat:53.9044, lng:27.6287, border:[[53.9103,27.6187],[53.9103,27.6387],[53.8985,27.6387],[53.8985,27.6187]] },
    { fi:9, lat:53.9044, lng:27.6487, border:[[53.9103,27.6387],[53.9103,27.6587],[53.8985,27.6587],[53.8985,27.6387]] },
    { fi:10, lat:53.9044, lng:27.6687, border:[[53.9103,27.6587],[53.9103,27.6787],[53.8985,27.6787],[53.8985,27.6587]] },
    { fi:10, lat:53.9044, lng:27.6887, border:[[53.9103,27.6787],[53.9103,27.6987],[53.8985,27.6987],[53.8985,27.6787]] },
    { fi:10, lat:53.9044, lng:27.7087, border:[[53.9103,27.6987],[53.9103,27.7187],[53.8985,27.7187],[53.8985,27.6987]] },
    { fi:10, lat:53.9044, lng:27.7287, border:[[53.9103,27.7187],[53.9103,27.7387],[53.8985,27.7387],[53.8985,27.7187]] },
    { fi:10, lat:53.9044, lng:27.7487, border:[[53.9103,27.7387],[53.9103,27.7587],[53.8985,27.7587],[53.8985,27.7387]] },
    { fi:10, lat:53.9044, lng:27.7687, border:[[53.9103,27.7587],[53.9103,27.7787],[53.8985,27.7787],[53.8985,27.7587]] },
    { fi:10, lat:53.9044, lng:27.7887, border:[[53.9103,27.7787],[53.9103,27.7987],[53.8985,27.7987],[53.8985,27.7787]] },
    { fi:10, lat:53.9044, lng:27.8087, border:[[53.9103,27.7987],[53.9103,27.8187],[53.8985,27.8187],[53.8985,27.7987]] },
    { fi:11, lat:53.9044, lng:27.8287, border:[[53.9103,27.8187],[53.9103,27.8387],[53.8985,27.8387],[53.8985,27.8187]] },
    { fi:11, lat:53.9044, lng:27.8487, border:[[53.9103,27.8387],[53.9103,27.8587],[53.8985,27.8587],[53.8985,27.8387]] },
    { fi:11, lat:53.9044, lng:27.8687, border:[[53.9103,27.8587],[53.9103,27.8787],[53.8985,27.8787],[53.8985,27.8587]] },
    { fi:11, lat:53.90562, lng:27.88682, border:[[53.8985,27.8787],[53.9103,27.8787],[53.9103,27.8987],[53.90526,27.8987],[53.9038,27.8846],[53.8985,27.8888]] },
    { fi:11, lat:53.90818, lng:27.90653, border:[[53.9103,27.8987],[53.9103,27.91545],[53.907,27.9156],[53.90526,27.8987]] },
    { fi:6, lat:53.91598, lng:27.03243, border:[[53.9221,27.0387],[53.9103,27.0387],[53.9103,27.0248],[53.9221,27.02761]] },
    { fi:6, lat:53.9162, lng:27.0487, border:[[53.9221,27.0387],[53.9221,27.0587],[53.9103,27.0587],[53.9103,27.0387]] },
    { fi:6, lat:53.9162, lng:27.0687, border:[[53.9221,27.0587],[53.9221,27.0787],[53.9103,27.0787],[53.9103,27.0587]] },
    { fi:6, lat:53.9162, lng:27.0887, border:[[53.9221,27.0787],[53.9221,27.0987],[53.9103,27.0987],[53.9103,27.0787]] },
    { fi:6, lat:53.9162, lng:27.1087, border:[[53.9221,27.0987],[53.9221,27.1187],[53.9103,27.1187],[53.9103,27.0987]] },
    { fi:6, lat:53.9162, lng:27.1287, border:[[53.9221,27.1187],[53.9221,27.1387],[53.9103,27.1387],[53.9103,27.1187]] },
    { fi:6, lat:53.9162, lng:27.1487, border:[[53.9221,27.1387],[53.9221,27.1587],[53.9103,27.1587],[53.9103,27.1387]] },
    { fi:6, lat:53.9162, lng:27.1687, border:[[53.9221,27.1587],[53.9221,27.1787],[53.9103,27.1787],[53.9103,27.1587]] },
    { fi:7, lat:53.9162, lng:27.1887, border:[[53.9221,27.1787],[53.9221,27.1987],[53.9103,27.1987],[53.9103,27.1787]] },
    { fi:7, lat:53.9162, lng:27.2087, border:[[53.9221,27.1987],[53.9221,27.2187],[53.9103,27.2187],[53.9103,27.1987]] },
    { fi:7, lat:53.9162, lng:27.2287, border:[[53.9221,27.2187],[53.9221,27.2387],[53.9103,27.2387],[53.9103,27.2187]] },
    { fi:7, lat:53.9162, lng:27.2487, border:[[53.9221,27.2387],[53.9221,27.2587],[53.9103,27.2587],[53.9103,27.2387]] },
    { fi:7, lat:53.9162, lng:27.2687, border:[[53.9221,27.2587],[53.9221,27.2787],[53.9103,27.2787],[53.9103,27.2587]] },
    { fi:7, lat:53.9162, lng:27.2887, border:[[53.9221,27.2787],[53.9221,27.2987],[53.9103,27.2987],[53.9103,27.2787]] },
    { fi:7, lat:53.9162, lng:27.3087, border:[[53.9221,27.2987],[53.9221,27.3187],[53.9103,27.3187],[53.9103,27.2987]] },
    { fi:7, lat:53.9162, lng:27.3287, border:[[53.9221,27.3187],[53.9221,27.3387],[53.9103,27.3387],[53.9103,27.3187]] },
    { fi:8, lat:53.9162, lng:27.3487, border:[[53.9221,27.3387],[53.9221,27.3587],[53.9103,27.3587],[53.9103,27.3387]] },
    { fi:8, lat:53.9162, lng:27.3687, border:[[53.9221,27.3587],[53.9221,27.3787],[53.9103,27.3787],[53.9103,27.3587]] },
    { fi:8, lat:53.9162, lng:27.3887, border:[[53.9221,27.3787],[53.9221,27.3987],[53.9103,27.3987],[53.9103,27.3787]] },
    { fi:8, lat:53.9162, lng:27.4087, border:[[53.9221,27.3987],[53.9221,27.4187],[53.9103,27.4187],[53.9103,27.3987]] },
    { fi:8, lat:53.9162, lng:27.4287, border:[[53.9221,27.4187],[53.9221,27.4387],[53.9103,27.4387],[53.9103,27.4187]] },
    { fi:8, lat:53.9162, lng:27.4487, border:[[53.9221,27.4387],[53.9221,27.4587],[53.9103,27.4587],[53.9103,27.4387]] },
    { fi:8, lat:53.9162, lng:27.4687, border:[[53.9221,27.4587],[53.9221,27.4787],[53.9103,27.4787],[53.9103,27.4587]] },
    { fi:8, lat:53.9162, lng:27.4887, border:[[53.9221,27.4787],[53.9221,27.4987],[53.9103,27.4987],[53.9103,27.4787]] },
    { fi:9, lat:53.9162, lng:27.5087, border:[[53.9221,27.4987],[53.9221,27.5187],[53.9103,27.5187],[53.9103,27.4987]] },
    { fi:9, lat:53.9162, lng:27.5287, border:[[53.9221,27.5187],[53.9221,27.5387],[53.9103,27.5387],[53.9103,27.5187]] },
    { fi:9, lat:53.9162, lng:27.5487, border:[[53.9221,27.5387],[53.9221,27.5587],[53.9103,27.5587],[53.9103,27.5387]] },
    { fi:9, lat:53.9162, lng:27.5687, border:[[53.9221,27.5587],[53.9221,27.5787],[53.9103,27.5787],[53.9103,27.5587]] },
    { fi:9, lat:53.9162, lng:27.5887, border:[[53.9221,27.5787],[53.9221,27.5987],[53.9103,27.5987],[53.9103,27.5787]] },
    { fi:9, lat:53.9162, lng:27.6087, border:[[53.9221,27.5987],[53.9221,27.6187],[53.9103,27.6187],[53.9103,27.5987]] },
    { fi:9, lat:53.9162, lng:27.6287, border:[[53.9221,27.6187],[53.9221,27.6387],[53.9103,27.6387],[53.9103,27.6187]] },
    { fi:9, lat:53.9162, lng:27.6487, border:[[53.9221,27.6387],[53.9221,27.6587],[53.9103,27.6587],[53.9103,27.6387]] },
    { fi:10, lat:53.9162, lng:27.6687, border:[[53.9221,27.6587],[53.9221,27.6787],[53.9103,27.6787],[53.9103,27.6587]] },
    { fi:10, lat:53.9162, lng:27.6887, border:[[53.9221,27.6787],[53.9221,27.6987],[53.9103,27.6987],[53.9103,27.6787]] },
    { fi:10, lat:53.9162, lng:27.7087, border:[[53.9221,27.6987],[53.9221,27.7187],[53.9103,27.7187],[53.9103,27.6987]] },
    { fi:10, lat:53.9162, lng:27.7287, border:[[53.9221,27.7187],[53.9221,27.7387],[53.9103,27.7387],[53.9103,27.7187]] },
    { fi:10, lat:53.9162, lng:27.7487, border:[[53.9221,27.7387],[53.9221,27.7587],[53.9103,27.7587],[53.9103,27.7387]] },
    { fi:10, lat:53.9162, lng:27.7687, border:[[53.9221,27.7587],[53.9221,27.7787],[53.9103,27.7787],[53.9103,27.7587]] },
    { fi:10, lat:53.9162, lng:27.7887, border:[[53.9221,27.7787],[53.9221,27.7987],[53.9103,27.7987],[53.9103,27.7787]] },
    { fi:10, lat:53.9162, lng:27.8087, border:[[53.9221,27.7987],[53.9221,27.8187],[53.9103,27.8187],[53.9103,27.7987]] },
    { fi:11, lat:53.9162, lng:27.8287, border:[[53.9221,27.8187],[53.9221,27.8387],[53.9103,27.8387],[53.9103,27.8187]] },
    { fi:11, lat:53.9162, lng:27.8487, border:[[53.9221,27.8387],[53.9221,27.8587],[53.9103,27.8587],[53.9103,27.8387]] },
    { fi:11, lat:53.9162, lng:27.8687, border:[[53.9221,27.8587],[53.9221,27.8787],[53.9103,27.8787],[53.9103,27.8587]] },
    { fi:11, lat:53.9162, lng:27.8887, border:[[53.9221,27.8787],[53.9221,27.8987],[53.9103,27.8987],[53.9103,27.8787]] },
    { fi:11, lat:53.91617, lng:27.90694, border:[[53.9103,27.8987],[53.9221,27.8987],[53.9221,27.9149],[53.9103,27.91545]] },
    { fi:6, lat:53.92771, lng:27.03383, border:[[53.9339,27.0387],[53.9221,27.0387],[53.9221,27.02761],[53.9339,27.03043]] },
    { fi:6, lat:53.928, lng:27.0487, border:[[53.9339,27.0387],[53.9339,27.0587],[53.9221,27.0587],[53.9221,27.0387]] },
    { fi:6, lat:53.928, lng:27.0687, border:[[53.9339,27.0587],[53.9339,27.0787],[53.9221,27.0787],[53.9221,27.0587]] },
    { fi:6, lat:53.928, lng:27.0887, border:[[53.9339,27.0787],[53.9339,27.0987],[53.9221,27.0987],[53.9221,27.0787]] },
    { fi:6, lat:53.928, lng:27.1087, border:[[53.9339,27.0987],[53.9339,27.1187],[53.9221,27.1187],[53.9221,27.0987]] },
    { fi:6, lat:53.928, lng:27.1287, border:[[53.9339,27.1187],[53.9339,27.1387],[53.9221,27.1387],[53.9221,27.1187]] },
    { fi:6, lat:53.928, lng:27.1487, border:[[53.9339,27.1387],[53.9339,27.1587],[53.9221,27.1587],[53.9221,27.1387]] },
    { fi:6, lat:53.928, lng:27.1687, border:[[53.9339,27.1587],[53.9339,27.1787],[53.9221,27.1787],[53.9221,27.1587]] },
    { fi:7, lat:53.928, lng:27.1887, border:[[53.9339,27.1787],[53.9339,27.1987],[53.9221,27.1987],[53.9221,27.1787]] },
    { fi:7, lat:53.928, lng:27.2087, border:[[53.9339,27.1987],[53.9339,27.2187],[53.9221,27.2187],[53.9221,27.1987]] },
    { fi:7, lat:53.928, lng:27.2287, border:[[53.9339,27.2187],[53.9339,27.2387],[53.9221,27.2387],[53.9221,27.2187]] },
    { fi:7, lat:53.928, lng:27.2487, border:[[53.9339,27.2387],[53.9339,27.2587],[53.9221,27.2587],[53.9221,27.2387]] },
    { fi:7, lat:53.928, lng:27.2687, border:[[53.9339,27.2587],[53.9339,27.2787],[53.9221,27.2787],[53.9221,27.2587]] },
    { fi:7, lat:53.928, lng:27.2887, border:[[53.9339,27.2787],[53.9339,27.2987],[53.9221,27.2987],[53.9221,27.2787]] },
    { fi:7, lat:53.928, lng:27.3087, border:[[53.9339,27.2987],[53.9339,27.3187],[53.9221,27.3187],[53.9221,27.2987]] },
    { fi:7, lat:53.928, lng:27.3287, border:[[53.9339,27.3187],[53.9339,27.3387],[53.9221,27.3387],[53.9221,27.3187]] },
    { fi:8, lat:53.928, lng:27.3487, border:[[53.9339,27.3387],[53.9339,27.3587],[53.9221,27.3587],[53.9221,27.3387]] },
    { fi:8, lat:53.928, lng:27.3687, border:[[53.9339,27.3587],[53.9339,27.3787],[53.9221,27.3787],[53.9221,27.3587]] },
    { fi:8, lat:53.928, lng:27.3887, border:[[53.9339,27.3787],[53.9339,27.3987],[53.9221,27.3987],[53.9221,27.3787]] },
    { fi:8, lat:53.928, lng:27.4087, border:[[53.9339,27.3987],[53.9339,27.4187],[53.9221,27.4187],[53.9221,27.3987]] },
    { fi:8, lat:53.928, lng:27.4287, border:[[53.9339,27.4187],[53.9339,27.4387],[53.9221,27.4387],[53.9221,27.4187]] },
    { fi:8, lat:53.928, lng:27.4487, border:[[53.9339,27.4387],[53.9339,27.4587],[53.9221,27.4587],[53.9221,27.4387]] },
    { fi:8, lat:53.928, lng:27.4687, border:[[53.9339,27.4587],[53.9339,27.4787],[53.9221,27.4787],[53.9221,27.4587]] },
    { fi:8, lat:53.928, lng:27.4887, border:[[53.9339,27.4787],[53.9339,27.4987],[53.9221,27.4987],[53.9221,27.4787]] },
    { fi:9, lat:53.928, lng:27.5087, border:[[53.9339,27.4987],[53.9339,27.5187],[53.9221,27.5187],[53.9221,27.4987]] },
    { fi:9, lat:53.928, lng:27.5287, border:[[53.9339,27.5187],[53.9339,27.5387],[53.9221,27.5387],[53.9221,27.5187]] },
    { fi:9, lat:53.928, lng:27.5487, border:[[53.9339,27.5387],[53.9339,27.5587],[53.9221,27.5587],[53.9221,27.5387]] },
    { fi:9, lat:53.928, lng:27.5687, border:[[53.9339,27.5587],[53.9339,27.5787],[53.9221,27.5787],[53.9221,27.5587]] },
    { fi:9, lat:53.928, lng:27.5887, border:[[53.9339,27.5787],[53.9339,27.5987],[53.9221,27.5987],[53.9221,27.5787]] },
    { fi:9, lat:53.928, lng:27.6087, border:[[53.9339,27.5987],[53.9339,27.6187],[53.9221,27.6187],[53.9221,27.5987]] },
    { fi:9, lat:53.928, lng:27.6287, border:[[53.9339,27.6187],[53.9339,27.6387],[53.9221,27.6387],[53.9221,27.6187]] },
    { fi:9, lat:53.928, lng:27.6487, border:[[53.9339,27.6387],[53.9339,27.6587],[53.9221,27.6587],[53.9221,27.6387]] },
    { fi:10, lat:53.928, lng:27.6687, border:[[53.9339,27.6587],[53.9339,27.6787],[53.9221,27.6787],[53.9221,27.6587]] },
    { fi:10, lat:53.928, lng:27.6887, border:[[53.9339,27.6787],[53.9339,27.6987],[53.9221,27.6987],[53.9221,27.6787]] },
    { fi:10, lat:53.928, lng:27.7087, border:[[53.9339,27.6987],[53.9339,27.7187],[53.9221,27.7187],[53.9221,27.6987]] },
    { fi:10, lat:53.928, lng:27.7287, border:[[53.9339,27.7187],[53.9339,27.7387],[53.9221,27.7387],[53.9221,27.7187]] },
    { fi:10, lat:53.928, lng:27.7487, border:[[53.9339,27.7387],[53.9339,27.7587],[53.9221,27.7587],[53.9221,27.7387]] },
    { fi:10, lat:53.928, lng:27.7687, border:[[53.9339,27.7587],[53.9339,27.7787],[53.9221,27.7787],[53.9221,27.7587]] },
    { fi:10, lat:53.928, lng:27.7887, border:[[53.9339,27.7787],[53.9339,27.7987],[53.9221,27.7987],[53.9221,27.7787]] },
    { fi:10, lat:53.928, lng:27.8087, border:[[53.9339,27.7987],[53.9339,27.8187],[53.9221,27.8187],[53.9221,27.7987]] },
    { fi:11, lat:53.928, lng:27.8287, border:[[53.9339,27.8187],[53.9339,27.8387],[53.9221,27.8387],[53.9221,27.8187]] },
    { fi:11, lat:53.928, lng:27.8487, border:[[53.9339,27.8387],[53.9339,27.8587],[53.9221,27.8587],[53.9221,27.8387]] },
    { fi:11, lat:53.928, lng:27.8687, border:[[53.9339,27.8587],[53.9339,27.8787],[53.9221,27.8787],[53.9221,27.8587]] },
    { fi:11, lat:53.928, lng:27.8887, border:[[53.9339,27.8787],[53.9339,27.8987],[53.9221,27.8987],[53.9221,27.8787]] },
    { fi:11, lat:53.92784, lng:27.90649, border:[[53.9221,27.8987],[53.9339,27.8987],[53.9339,27.91149],[53.9306,27.9145],[53.9221,27.9149]] },
    { fi:6, lat:53.9382, lng:27.03511, border:[[53.9339,27.0387],[53.9339,27.03043],[53.9426,27.0325],[53.94331,27.0387]] },
    { fi:6, lat:53.9392, lng:27.04906, border:[[53.9339,27.0587],[53.9339,27.0387],[53.94331,27.0387],[53.9456,27.0587]] },
    { fi:6, lat:53.9398, lng:27.0687, border:[[53.9457,27.0787],[53.9339,27.0787],[53.9339,27.0587],[53.9456,27.0587],[53.9457,27.05955]] },
    { fi:6, lat:53.9398, lng:27.0887, border:[[53.9457,27.0787],[53.9457,27.0987],[53.9339,27.0987],[53.9339,27.0787]] },
    { fi:6, lat:53.9398, lng:27.1087, border:[[53.9457,27.0987],[53.9457,27.1187],[53.9339,27.1187],[53.9339,27.0987]] },
    { fi:6, lat:53.9398, lng:27.1287, border:[[53.9457,27.1187],[53.9457,27.1387],[53.9339,27.1387],[53.9339,27.1187]] },
    { fi:6, lat:53.9398, lng:27.1487, border:[[53.9457,27.1387],[53.9457,27.1587],[53.9339,27.1587],[53.9339,27.1387]] },
    { fi:6, lat:53.9398, lng:27.1687, border:[[53.9457,27.1587],[53.9457,27.1787],[53.9339,27.1787],[53.9339,27.1587]] },
    { fi:7, lat:53.9398, lng:27.1887, border:[[53.9457,27.1787],[53.9457,27.1987],[53.9339,27.1987],[53.9339,27.1787]] },
    { fi:7, lat:53.9398, lng:27.2087, border:[[53.9457,27.1987],[53.9457,27.2187],[53.9339,27.2187],[53.9339,27.1987]] },
    { fi:7, lat:53.9398, lng:27.2287, border:[[53.9457,27.2187],[53.9457,27.2387],[53.9339,27.2387],[53.9339,27.2187]] },
    { fi:7, lat:53.9398, lng:27.2487, border:[[53.9457,27.2387],[53.9457,27.2587],[53.9339,27.2587],[53.9339,27.2387]] },
    { fi:7, lat:53.9398, lng:27.2687, border:[[53.9457,27.2587],[53.9457,27.2787],[53.9339,27.2787],[53.9339,27.2587]] },
    { fi:7, lat:53.9398, lng:27.2887, border:[[53.9457,27.2787],[53.9457,27.2987],[53.9339,27.2987],[53.9339,27.2787]] },
    { fi:7, lat:53.9398, lng:27.3087, border:[[53.9457,27.2987],[53.9457,27.3187],[53.9339,27.3187],[53.9339,27.2987]] },
    { fi:7, lat:53.9398, lng:27.3287, border:[[53.9457,27.3187],[53.9457,27.3387],[53.9339,27.3387],[53.9339,27.3187]] },
    { fi:8, lat:53.9398, lng:27.3487, border:[[53.9457,27.3387],[53.9457,27.3587],[53.9339,27.3587],[53.9339,27.3387]] },
    { fi:8, lat:53.9398, lng:27.3687, border:[[53.9457,27.3587],[53.9457,27.3787],[53.9339,27.3787],[53.9339,27.3587]] },
    { fi:8, lat:53.9398, lng:27.3887, border:[[53.9457,27.3787],[53.9457,27.3987],[53.9339,27.3987],[53.9339,27.3787]] },
    { fi:8, lat:53.9398, lng:27.4087, border:[[53.9457,27.3987],[53.9457,27.4187],[53.9339,27.4187],[53.9339,27.3987]] },
    { fi:8, lat:53.9398, lng:27.4287, border:[[53.9457,27.4187],[53.9457,27.4387],[53.9339,27.4387],[53.9339,27.4187]] },
    { fi:8, lat:53.9398, lng:27.4487, border:[[53.9457,27.4387],[53.9457,27.4587],[53.9339,27.4587],[53.9339,27.4387]] },
    { fi:8, lat:53.9398, lng:27.4687, border:[[53.9457,27.4587],[53.9457,27.4787],[53.9339,27.4787],[53.9339,27.4587]] },
    { fi:8, lat:53.9398, lng:27.4887, border:[[53.9457,27.4787],[53.9457,27.4987],[53.9339,27.4987],[53.9339,27.4787]] },
    { fi:9, lat:53.9398, lng:27.5087, border:[[53.9457,27.4987],[53.9457,27.5187],[53.9339,27.5187],[53.9339,27.4987]] },
    { fi:9, lat:53.9398, lng:27.5287, border:[[53.9457,27.5187],[53.9457,27.5387],[53.9339,27.5387],[53.9339,27.5187]] },
    { fi:9, lat:53.9398, lng:27.5487, border:[[53.9457,27.5387],[53.9457,27.5587],[53.9339,27.5587],[53.9339,27.5387]] },
    { fi:9, lat:53.9398, lng:27.5687, border:[[53.9457,27.5587],[53.9457,27.5787],[53.9339,27.5787],[53.9339,27.5587]] },
    { fi:9, lat:53.9398, lng:27.5887, border:[[53.9457,27.5787],[53.9457,27.5987],[53.9339,27.5987],[53.9339,27.5787]] },
    { fi:9, lat:53.9398, lng:27.6087, border:[[53.9457,27.5987],[53.9457,27.6187],[53.9339,27.6187],[53.9339,27.5987]] },
    { fi:9, lat:53.9398, lng:27.6287, border:[[53.9457,27.6187],[53.9457,27.6387],[53.9339,27.6387],[53.9339,27.6187]] },
    { fi:9, lat:53.9398, lng:27.6487, border:[[53.9457,27.6387],[53.9457,27.6587],[53.9339,27.6587],[53.9339,27.6387]] },
    { fi:10, lat:53.9398, lng:27.6687, border:[[53.9457,27.6587],[53.9457,27.6787],[53.9339,27.6787],[53.9339,27.6587]] },
    { fi:10, lat:53.9398, lng:27.6887, border:[[53.9457,27.6787],[53.9457,27.6987],[53.9339,27.6987],[53.9339,27.6787]] },
    { fi:10, lat:53.9398, lng:27.7087, border:[[53.9457,27.6987],[53.9457,27.7187],[53.9339,27.7187],[53.9339,27.6987]] },
    { fi:10, lat:53.9398, lng:27.7287, border:[[53.9457,27.7187],[53.9457,27.7387],[53.9339,27.7387],[53.9339,27.7187]] },
    { fi:10, lat:53.9398, lng:27.7487, border:[[53.9457,27.7387],[53.9457,27.7587],[53.9339,27.7587],[53.9339,27.7387]] },
    { fi:10, lat:53.9398, lng:27.7687, border:[[53.9457,27.7587],[53.9457,27.7787],[53.9339,27.7787],[53.9339,27.7587]] },
    { fi:10, lat:53.9398, lng:27.7887, border:[[53.9457,27.7787],[53.9457,27.7987],[53.9339,27.7987],[53.9339,27.7787]] },
    { fi:10, lat:53.9398, lng:27.8087, border:[[53.9457,27.7987],[53.9457,27.8187],[53.9339,27.8187],[53.9339,27.7987]] },
    { fi:11, lat:53.9398, lng:27.8287, border:[[53.9457,27.8187],[53.9457,27.8387],[53.9339,27.8387],[53.9339,27.8187]] },
    { fi:11, lat:53.9398, lng:27.8487, border:[[53.9457,27.8387],[53.9457,27.8587],[53.9339,27.8587],[53.9339,27.8387]] },
    { fi:11, lat:53.9398, lng:27.8687, border:[[53.9457,27.8587],[53.9457,27.8787],[53.9339,27.8787],[53.9339,27.8587]] },
    { fi:11, lat:53.9398, lng:27.8887, border:[[53.9457,27.8787],[53.9457,27.8987],[53.9339,27.8987],[53.9339,27.8787]] },
    { fi:11, lat:53.93838, lng:27.90306, border:[[53.9339,27.8987],[53.9457,27.8987],[53.9457,27.90075],[53.9339,27.91149]] },
    { fi:6, lat:53.94656, lng:27.0727, border:[[53.9457,27.0787],[53.9457,27.05955],[53.9477,27.077],[53.94962,27.0787]] },
    { fi:12, lat:53.95117, lng:27.08971, border:[[53.9575,27.0987],[53.9457,27.0987],[53.9457,27.0787],[53.94962,27.0787],[53.9575,27.08568]] },
    { fi:12, lat:53.9516, lng:27.1087, border:[[53.9575,27.0987],[53.9575,27.1187],[53.9457,27.1187],[53.9457,27.0987]] },
    { fi:12, lat:53.9516, lng:27.1287, border:[[53.9575,27.1187],[53.9575,27.1387],[53.9457,27.1387],[53.9457,27.1187]] },
    { fi:12, lat:53.9516, lng:27.1487, border:[[53.9575,27.1387],[53.9575,27.1587],[53.9457,27.1587],[53.9457,27.1387]] },
    { fi:12, lat:53.9516, lng:27.1687, border:[[53.9575,27.1587],[53.9575,27.1787],[53.9457,27.1787],[53.9457,27.1587]] },
    { fi:13, lat:53.9516, lng:27.1887, border:[[53.9575,27.1787],[53.9575,27.1987],[53.9457,27.1987],[53.9457,27.1787]] },
    { fi:13, lat:53.9516, lng:27.2087, border:[[53.9575,27.1987],[53.9575,27.2187],[53.9457,27.2187],[53.9457,27.1987]] },
    { fi:13, lat:53.9516, lng:27.2287, border:[[53.9575,27.2187],[53.9575,27.2387],[53.9457,27.2387],[53.9457,27.2187]] },
    { fi:13, lat:53.9516, lng:27.2487, border:[[53.9575,27.2387],[53.9575,27.2587],[53.9457,27.2587],[53.9457,27.2387]] },
    { fi:13, lat:53.9516, lng:27.2687, border:[[53.9575,27.2587],[53.9575,27.2787],[53.9457,27.2787],[53.9457,27.2587]] },
    { fi:13, lat:53.9516, lng:27.2887, border:[[53.9575,27.2787],[53.9575,27.2987],[53.9457,27.2987],[53.9457,27.2787]] },
    { fi:13, lat:53.9516, lng:27.3087, border:[[53.9575,27.2987],[53.9575,27.3187],[53.9457,27.3187],[53.9457,27.2987]] },
    { fi:13, lat:53.9516, lng:27.3287, border:[[53.9575,27.3187],[53.9575,27.3387],[53.9457,27.3387],[53.9457,27.3187]] },
    { fi:14, lat:53.9516, lng:27.3487, border:[[53.9575,27.3387],[53.9575,27.3587],[53.9457,27.3587],[53.9457,27.3387]] },
    { fi:14, lat:53.9516, lng:27.3687, border:[[53.9575,27.3587],[53.9575,27.3787],[53.9457,27.3787],[53.9457,27.3587]] },
    { fi:14, lat:53.9516, lng:27.3887, border:[[53.9575,27.3787],[53.9575,27.3987],[53.9457,27.3987],[53.9457,27.3787]] },
    { fi:14, lat:53.9516, lng:27.4087, border:[[53.9575,27.3987],[53.9575,27.4187],[53.9457,27.4187],[53.9457,27.3987]] },
    { fi:14, lat:53.9516, lng:27.4287, border:[[53.9575,27.4187],[53.9575,27.4387],[53.9457,27.4387],[53.9457,27.4187]] },
    { fi:14, lat:53.9516, lng:27.4487, border:[[53.9575,27.4387],[53.9575,27.4587],[53.9457,27.4587],[53.9457,27.4387]] },
    { fi:14, lat:53.9516, lng:27.4687, border:[[53.9575,27.4587],[53.9575,27.4787],[53.9457,27.4787],[53.9457,27.4587]] },
    { fi:14, lat:53.9516, lng:27.4887, border:[[53.9575,27.4787],[53.9575,27.4987],[53.9457,27.4987],[53.9457,27.4787]] },
    { fi:15, lat:53.9516, lng:27.5087, border:[[53.9575,27.4987],[53.9575,27.5187],[53.9457,27.5187],[53.9457,27.4987]] },
    { fi:15, lat:53.9516, lng:27.5287, border:[[53.9575,27.5187],[53.9575,27.5387],[53.9457,27.5387],[53.9457,27.5187]] },
    { fi:15, lat:53.9516, lng:27.5487, border:[[53.9575,27.5387],[53.9575,27.5587],[53.9457,27.5587],[53.9457,27.5387]] },
    { fi:15, lat:53.9516, lng:27.5687, border:[[53.9575,27.5587],[53.9575,27.5787],[53.9457,27.5787],[53.9457,27.5587]] },
    { fi:15, lat:53.9516, lng:27.5887, border:[[53.9575,27.5787],[53.9575,27.5987],[53.9457,27.5987],[53.9457,27.5787]] },
    { fi:15, lat:53.9516, lng:27.6087, border:[[53.9575,27.5987],[53.9575,27.6187],[53.9457,27.6187],[53.9457,27.5987]] },
    { fi:15, lat:53.9516, lng:27.6287, border:[[53.9575,27.6187],[53.9575,27.6387],[53.9457,27.6387],[53.9457,27.6187]] },
    { fi:15, lat:53.9516, lng:27.6487, border:[[53.9575,27.6387],[53.9575,27.6587],[53.9457,27.6587],[53.9457,27.6387]] },
    { fi:16, lat:53.9516, lng:27.6687, border:[[53.9575,27.6587],[53.9575,27.6787],[53.9457,27.6787],[53.9457,27.6587]] },
    { fi:16, lat:53.9516, lng:27.6887, border:[[53.9575,27.6787],[53.9575,27.6987],[53.9457,27.6987],[53.9457,27.6787]] },
    { fi:16, lat:53.9516, lng:27.7087, border:[[53.9575,27.6987],[53.9575,27.7187],[53.9457,27.7187],[53.9457,27.6987]] },
    { fi:16, lat:53.9516, lng:27.7287, border:[[53.9575,27.7187],[53.9575,27.7387],[53.9457,27.7387],[53.9457,27.7187]] },
    { fi:16, lat:53.9516, lng:27.7487, border:[[53.9575,27.7387],[53.9575,27.7587],[53.9457,27.7587],[53.9457,27.7387]] },
    { fi:16, lat:53.9516, lng:27.7687, border:[[53.9575,27.7587],[53.9575,27.7787],[53.9457,27.7787],[53.9457,27.7587]] },
    { fi:16, lat:53.9516, lng:27.7887, border:[[53.9575,27.7787],[53.9575,27.7987],[53.9457,27.7987],[53.9457,27.7787]] },
    { fi:16, lat:53.9516, lng:27.8087, border:[[53.9575,27.7987],[53.9575,27.8187],[53.9457,27.8187],[53.9457,27.7987]] },
    { fi:17, lat:53.9516, lng:27.8287, border:[[53.9575,27.8187],[53.9575,27.8387],[53.9457,27.8387],[53.9457,27.8187]] },
    { fi:17, lat:53.9516, lng:27.8487, border:[[53.9575,27.8387],[53.9575,27.8587],[53.9457,27.8587],[53.9457,27.8387]] },
    { fi:17, lat:53.9516, lng:27.8687, border:[[53.9575,27.8587],[53.9575,27.8787],[53.9457,27.8787],[53.9457,27.8587]] },
    { fi:17, lat:53.95102, lng:27.88718, border:[[53.9457,27.8987],[53.9457,27.8787],[53.9575,27.8787],[53.9575,27.89],[53.94795,27.8987]] },
    { fi:11, lat:53.94645, lng:27.89938, border:[[53.9457,27.8987],[53.94795,27.8987],[53.9457,27.90075]] },
    { fi:12, lat:53.96208, lng:27.09422, border:[[53.9693,27.0987],[53.9575,27.0987],[53.9575,27.08568],[53.9693,27.09613]] },
    { fi:12, lat:53.9634, lng:27.1087, border:[[53.9693,27.0987],[53.9693,27.1187],[53.9575,27.1187],[53.9575,27.0987]] },
    { fi:12, lat:53.9634, lng:27.1287, border:[[53.9693,27.1187],[53.9693,27.1387],[53.9575,27.1387],[53.9575,27.1187]] },
    { fi:12, lat:53.9634, lng:27.1487, border:[[53.9693,27.1387],[53.9693,27.1587],[53.9575,27.1587],[53.9575,27.1387]] },
    { fi:12, lat:53.9634, lng:27.1687, border:[[53.9693,27.1587],[53.9693,27.1787],[53.9575,27.1787],[53.9575,27.1587]] },
    { fi:13, lat:53.9634, lng:27.1887, border:[[53.9693,27.1787],[53.9693,27.1987],[53.9575,27.1987],[53.9575,27.1787]] },
    { fi:13, lat:53.9634, lng:27.2087, border:[[53.9693,27.1987],[53.9693,27.2187],[53.9575,27.2187],[53.9575,27.1987]] },
    { fi:13, lat:53.9634, lng:27.2287, border:[[53.9693,27.2187],[53.9693,27.2387],[53.9575,27.2387],[53.9575,27.2187]] },
    { fi:13, lat:53.9634, lng:27.2487, border:[[53.9693,27.2387],[53.9693,27.2587],[53.9575,27.2587],[53.9575,27.2387]] },
    { fi:13, lat:53.9634, lng:27.2687, border:[[53.9693,27.2587],[53.9693,27.2787],[53.9575,27.2787],[53.9575,27.2587]] },
    { fi:13, lat:53.9634, lng:27.2887, border:[[53.9693,27.2787],[53.9693,27.2987],[53.9575,27.2987],[53.9575,27.2787]] },
    { fi:13, lat:53.9634, lng:27.3087, border:[[53.9693,27.2987],[53.9693,27.3187],[53.9575,27.3187],[53.9575,27.2987]] },
    { fi:13, lat:53.9634, lng:27.3287, border:[[53.9693,27.3187],[53.9693,27.3387],[53.9575,27.3387],[53.9575,27.3187]] },
    { fi:14, lat:53.9634, lng:27.3487, border:[[53.9693,27.3387],[53.9693,27.3587],[53.9575,27.3587],[53.9575,27.3387]] },
    { fi:14, lat:53.9634, lng:27.3687, border:[[53.9693,27.3587],[53.9693,27.3787],[53.9575,27.3787],[53.9575,27.3587]] },
    { fi:14, lat:53.9634, lng:27.3887, border:[[53.9693,27.3787],[53.9693,27.3987],[53.9575,27.3987],[53.9575,27.3787]] },
    { fi:14, lat:53.9634, lng:27.4087, border:[[53.9693,27.3987],[53.9693,27.4187],[53.9575,27.4187],[53.9575,27.3987]] },
    { fi:14, lat:53.9634, lng:27.4287, border:[[53.9693,27.4187],[53.9693,27.4387],[53.9575,27.4387],[53.9575,27.4187]] },
    { fi:14, lat:53.9634, lng:27.4487, border:[[53.9693,27.4387],[53.9693,27.4587],[53.9575,27.4587],[53.9575,27.4387]] },
    { fi:14, lat:53.9634, lng:27.4687, border:[[53.9693,27.4587],[53.9693,27.4787],[53.9575,27.4787],[53.9575,27.4587]] },
    { fi:14, lat:53.9634, lng:27.4887, border:[[53.9693,27.4787],[53.9693,27.4987],[53.9575,27.4987],[53.9575,27.4787]] },
    { fi:15, lat:53.9634, lng:27.5087, border:[[53.9693,27.4987],[53.9693,27.5187],[53.9575,27.5187],[53.9575,27.4987]] },
    { fi:15, lat:53.9634, lng:27.5287, border:[[53.9693,27.5187],[53.9693,27.5387],[53.9575,27.5387],[53.9575,27.5187]] },
    { fi:15, lat:53.9634, lng:27.5487, border:[[53.9693,27.5387],[53.9693,27.5587],[53.9575,27.5587],[53.9575,27.5387]] },
    { fi:15, lat:53.9634, lng:27.5687, border:[[53.9693,27.5587],[53.9693,27.5787],[53.9575,27.5787],[53.9575,27.5587]] },
    { fi:15, lat:53.9634, lng:27.5887, border:[[53.9693,27.5787],[53.9693,27.5987],[53.9575,27.5987],[53.9575,27.5787]] },
    { fi:15, lat:53.9634, lng:27.6087, border:[[53.9693,27.5987],[53.9693,27.6187],[53.9575,27.6187],[53.9575,27.5987]] },
    { fi:15, lat:53.9634, lng:27.6287, border:[[53.9693,27.6187],[53.9693,27.6387],[53.9575,27.6387],[53.9575,27.6187]] },
    { fi:15, lat:53.9634, lng:27.6487, border:[[53.9693,27.6387],[53.9693,27.6587],[53.9575,27.6587],[53.9575,27.6387]] },
    { fi:16, lat:53.9634, lng:27.6687, border:[[53.9693,27.6587],[53.9693,27.6787],[53.9575,27.6787],[53.9575,27.6587]] },
    { fi:16, lat:53.9634, lng:27.6887, border:[[53.9693,27.6787],[53.9693,27.6987],[53.9575,27.6987],[53.9575,27.6787]] },
    { fi:16, lat:53.9634, lng:27.7087, border:[[53.9693,27.6987],[53.9693,27.7187],[53.9575,27.7187],[53.9575,27.6987]] },
    { fi:16, lat:53.9634, lng:27.7287, border:[[53.9693,27.7187],[53.9693,27.7387],[53.9575,27.7387],[53.9575,27.7187]] },
    { fi:16, lat:53.9634, lng:27.7487, border:[[53.9693,27.7387],[53.9693,27.7587],[53.9575,27.7587],[53.9575,27.7387]] },
    { fi:16, lat:53.9634, lng:27.7687, border:[[53.9693,27.7587],[53.9693,27.7787],[53.9575,27.7787],[53.9575,27.7587]] },
    { fi:16, lat:53.9634, lng:27.7887, border:[[53.9693,27.7787],[53.9693,27.7987],[53.9575,27.7987],[53.9575,27.7787]] },
    { fi:16, lat:53.9634, lng:27.8087, border:[[53.9693,27.7987],[53.9693,27.8187],[53.9575,27.8187],[53.9575,27.7987]] },
    { fi:17, lat:53.9634, lng:27.8287, border:[[53.9693,27.8187],[53.9693,27.8387],[53.9575,27.8387],[53.9575,27.8187]] },
    { fi:17, lat:53.9634, lng:27.8487, border:[[53.9693,27.8387],[53.9693,27.8587],[53.9575,27.8587],[53.9575,27.8387]] },
    { fi:17, lat:53.9634, lng:27.8687, border:[[53.9693,27.8587],[53.9693,27.8787],[53.9575,27.8787],[53.9575,27.8587]] },
    { fi:17, lat:53.96162, lng:27.88248, border:[[53.9575,27.8787],[53.9693,27.8787],[53.9693,27.87926],[53.9575,27.89]] },
    { fi:12, lat:53.97027, lng:27.09784, border:[[53.9693,27.0987],[53.9693,27.09613],[53.9722,27.0987]] },
    { fi:12, lat:53.97469, lng:27.10999, border:[[53.9811,27.1187],[53.9693,27.1187],[53.9693,27.0987],[53.9722,27.0987],[53.9811,27.10658]] },
    { fi:12, lat:53.9752, lng:27.1287, border:[[53.9811,27.1187],[53.9811,27.1387],[53.9693,27.1387],[53.9693,27.1187]] },
    { fi:12, lat:53.9752, lng:27.1487, border:[[53.9811,27.1387],[53.9811,27.1587],[53.9693,27.1587],[53.9693,27.1387]] },
    { fi:12, lat:53.9752, lng:27.1687, border:[[53.9811,27.1587],[53.9811,27.1787],[53.9693,27.1787],[53.9693,27.1587]] },
    { fi:13, lat:53.9752, lng:27.1887, border:[[53.9811,27.1787],[53.9811,27.1987],[53.9693,27.1987],[53.9693,27.1787]] },
    { fi:13, lat:53.9752, lng:27.2087, border:[[53.9811,27.1987],[53.9811,27.2187],[53.9693,27.2187],[53.9693,27.1987]] },
    { fi:13, lat:53.9752, lng:27.2287, border:[[53.9811,27.2187],[53.9811,27.2387],[53.9693,27.2387],[53.9693,27.2187]] },
    { fi:13, lat:53.9752, lng:27.2487, border:[[53.9811,27.2387],[53.9811,27.2587],[53.9693,27.2587],[53.9693,27.2387]] },
    { fi:13, lat:53.9752, lng:27.2687, border:[[53.9811,27.2587],[53.9811,27.2787],[53.9693,27.2787],[53.9693,27.2587]] },
    { fi:13, lat:53.9752, lng:27.2887, border:[[53.9811,27.2787],[53.9811,27.2987],[53.9693,27.2987],[53.9693,27.2787]] },
    { fi:13, lat:53.9752, lng:27.3087, border:[[53.9811,27.2987],[53.9811,27.3187],[53.9693,27.3187],[53.9693,27.2987]] },
    { fi:13, lat:53.9752, lng:27.3287, border:[[53.9811,27.3187],[53.9811,27.3387],[53.9693,27.3387],[53.9693,27.3187]] },
    { fi:14, lat:53.9752, lng:27.3487, border:[[53.9811,27.3387],[53.9811,27.3587],[53.9693,27.3587],[53.9693,27.3387]] },
    { fi:14, lat:53.9752, lng:27.3687, border:[[53.9811,27.3587],[53.9811,27.3787],[53.9693,27.3787],[53.9693,27.3587]] },
    { fi:14, lat:53.9752, lng:27.3887, border:[[53.9811,27.3787],[53.9811,27.3987],[53.9693,27.3987],[53.9693,27.3787]] },
    { fi:14, lat:53.9752, lng:27.4087, border:[[53.9811,27.3987],[53.9811,27.4187],[53.9693,27.4187],[53.9693,27.3987]] },
    { fi:14, lat:53.9752, lng:27.4287, border:[[53.9811,27.4187],[53.9811,27.4387],[53.9693,27.4387],[53.9693,27.4187]] },
    { fi:14, lat:53.9752, lng:27.4487, border:[[53.9811,27.4387],[53.9811,27.4587],[53.9693,27.4587],[53.9693,27.4387]] },
    { fi:14, lat:53.9752, lng:27.4687, border:[[53.9811,27.4587],[53.9811,27.4787],[53.9693,27.4787],[53.9693,27.4587]] },
    { fi:14, lat:53.9752, lng:27.4887, border:[[53.9811,27.4787],[53.9811,27.4987],[53.9693,27.4987],[53.9693,27.4787]] },
    { fi:15, lat:53.9752, lng:27.5087, border:[[53.9811,27.4987],[53.9811,27.5187],[53.9693,27.5187],[53.9693,27.4987]] },
    { fi:15, lat:53.9752, lng:27.5287, border:[[53.9811,27.5187],[53.9811,27.5387],[53.9693,27.5387],[53.9693,27.5187]] },
    { fi:15, lat:53.9752, lng:27.5487, border:[[53.9811,27.5387],[53.9811,27.5587],[53.9693,27.5587],[53.9693,27.5387]] },
    { fi:15, lat:53.9752, lng:27.5687, border:[[53.9811,27.5587],[53.9811,27.5787],[53.9693,27.5787],[53.9693,27.5587]] },
    { fi:15, lat:53.9752, lng:27.5887, border:[[53.9811,27.5787],[53.9811,27.5987],[53.9693,27.5987],[53.9693,27.5787]] },
    { fi:15, lat:53.9752, lng:27.6087, border:[[53.9811,27.5987],[53.9811,27.6187],[53.9693,27.6187],[53.9693,27.5987]] },
    { fi:15, lat:53.9752, lng:27.6287, border:[[53.9811,27.6187],[53.9811,27.6387],[53.9693,27.6387],[53.9693,27.6187]] },
    { fi:15, lat:53.9752, lng:27.6487, border:[[53.9811,27.6387],[53.9811,27.6587],[53.9693,27.6587],[53.9693,27.6387]] },
    { fi:16, lat:53.9752, lng:27.6687, border:[[53.9811,27.6587],[53.9811,27.6787],[53.9693,27.6787],[53.9693,27.6587]] },
    { fi:16, lat:53.9752, lng:27.6887, border:[[53.9811,27.6787],[53.9811,27.6987],[53.9693,27.6987],[53.9693,27.6787]] },
    { fi:16, lat:53.9752, lng:27.7087, border:[[53.9811,27.6987],[53.9811,27.7187],[53.9693,27.7187],[53.9693,27.6987]] },
    { fi:16, lat:53.9752, lng:27.7287, border:[[53.9811,27.7187],[53.9811,27.7387],[53.9693,27.7387],[53.9693,27.7187]] },
    { fi:16, lat:53.9752, lng:27.7487, border:[[53.9811,27.7387],[53.9811,27.7587],[53.9693,27.7587],[53.9693,27.7387]] },
    { fi:16, lat:53.9752, lng:27.7687, border:[[53.9811,27.7587],[53.9811,27.7787],[53.9693,27.7787],[53.9693,27.7587]] },
    { fi:16, lat:53.9752, lng:27.7887, border:[[53.9811,27.7787],[53.9811,27.7987],[53.9693,27.7987],[53.9693,27.7787]] },
    { fi:16, lat:53.9752, lng:27.8087, border:[[53.9811,27.7987],[53.9811,27.8187],[53.9693,27.8187],[53.9693,27.7987]] },
    { fi:17, lat:53.9752, lng:27.8287, border:[[53.9811,27.8187],[53.9811,27.8387],[53.9693,27.8387],[53.9693,27.8187]] },
    { fi:17, lat:53.9752, lng:27.8487, border:[[53.9811,27.8387],[53.9811,27.8587],[53.9693,27.8587],[53.9693,27.8387]] },
    { fi:17, lat:53.9752, lng:27.8687, border:[[53.9811,27.8587],[53.9811,27.8787],[53.9693,27.8787],[53.9693,27.8587]] },
    { fi:17, lat:53.97706, lng:27.87939, border:[[53.9693,27.8787],[53.9811,27.8787],[53.9811,27.88077],[53.9698,27.8788],[53.9693,27.87926]] },
    { fi:12, lat:53.98551, lng:27.11459, border:[[53.9929,27.1187],[53.9811,27.1187],[53.9811,27.10658],[53.9929,27.11703]] },
    { fi:12, lat:53.987, lng:27.1287, border:[[53.9929,27.1187],[53.9929,27.1387],[53.9811,27.1387],[53.9811,27.1187]] },
    { fi:12, lat:53.987, lng:27.1487, border:[[53.9929,27.1387],[53.9929,27.1587],[53.9811,27.1587],[53.9811,27.1387]] },
    { fi:12, lat:53.987, lng:27.1687, border:[[53.9929,27.1587],[53.9929,27.1787],[53.9811,27.1787],[53.9811,27.1587]] },
    { fi:13, lat:53.987, lng:27.1887, border:[[53.9929,27.1787],[53.9929,27.1987],[53.9811,27.1987],[53.9811,27.1787]] },
    { fi:13, lat:53.987, lng:27.2087, border:[[53.9929,27.1987],[53.9929,27.2187],[53.9811,27.2187],[53.9811,27.1987]] },
    { fi:13, lat:53.987, lng:27.2287, border:[[53.9929,27.2187],[53.9929,27.2387],[53.9811,27.2387],[53.9811,27.2187]] },
    { fi:13, lat:53.987, lng:27.2487, border:[[53.9929,27.2387],[53.9929,27.2587],[53.9811,27.2587],[53.9811,27.2387]] },
    { fi:13, lat:53.987, lng:27.2687, border:[[53.9929,27.2587],[53.9929,27.2787],[53.9811,27.2787],[53.9811,27.2587]] },
    { fi:13, lat:53.987, lng:27.2887, border:[[53.9929,27.2787],[53.9929,27.2987],[53.9811,27.2987],[53.9811,27.2787]] },
    { fi:13, lat:53.987, lng:27.3087, border:[[53.9929,27.2987],[53.9929,27.3187],[53.9811,27.3187],[53.9811,27.2987]] },
    { fi:13, lat:53.987, lng:27.3287, border:[[53.9929,27.3187],[53.9929,27.3387],[53.9811,27.3387],[53.9811,27.3187]] },
    { fi:14, lat:53.987, lng:27.3487, border:[[53.9929,27.3387],[53.9929,27.3587],[53.9811,27.3587],[53.9811,27.3387]] },
    { fi:14, lat:53.987, lng:27.3687, border:[[53.9929,27.3587],[53.9929,27.3787],[53.9811,27.3787],[53.9811,27.3587]] },
    { fi:14, lat:53.987, lng:27.3887, border:[[53.9929,27.3787],[53.9929,27.3987],[53.9811,27.3987],[53.9811,27.3787]] },
    { fi:14, lat:53.987, lng:27.4087, border:[[53.9929,27.3987],[53.9929,27.4187],[53.9811,27.4187],[53.9811,27.3987]] },
    { fi:14, lat:53.987, lng:27.4287, border:[[53.9929,27.4187],[53.9929,27.4387],[53.9811,27.4387],[53.9811,27.4187]] },
    { fi:14, lat:53.987, lng:27.4487, border:[[53.9929,27.4387],[53.9929,27.4587],[53.9811,27.4587],[53.9811,27.4387]] },
    { fi:14, lat:53.987, lng:27.4687, border:[[53.9929,27.4587],[53.9929,27.4787],[53.9811,27.4787],[53.9811,27.4587]] },
    { fi:14, lat:53.987, lng:27.4887, border:[[53.9929,27.4787],[53.9929,27.4987],[53.9811,27.4987],[53.9811,27.4787]] },
    { fi:15, lat:53.987, lng:27.5087, border:[[53.9929,27.4987],[53.9929,27.5187],[53.9811,27.5187],[53.9811,27.4987]] },
    { fi:15, lat:53.987, lng:27.5287, border:[[53.9929,27.5187],[53.9929,27.5387],[53.9811,27.5387],[53.9811,27.5187]] },
    { fi:15, lat:53.987, lng:27.5487, border:[[53.9929,27.5387],[53.9929,27.5587],[53.9811,27.5587],[53.9811,27.5387]] },
    { fi:15, lat:53.987, lng:27.5687, border:[[53.9929,27.5587],[53.9929,27.5787],[53.9811,27.5787],[53.9811,27.5587]] },
    { fi:15, lat:53.987, lng:27.5887, border:[[53.9929,27.5787],[53.9929,27.5987],[53.9811,27.5987],[53.9811,27.5787]] },
    { fi:15, lat:53.987, lng:27.6087, border:[[53.9929,27.5987],[53.9929,27.6187],[53.9811,27.6187],[53.9811,27.5987]] },
    { fi:15, lat:53.987, lng:27.6287, border:[[53.9929,27.6187],[53.9929,27.6387],[53.9811,27.6387],[53.9811,27.6187]] },
    { fi:15, lat:53.987, lng:27.6487, border:[[53.9929,27.6387],[53.9929,27.6587],[53.9811,27.6587],[53.9811,27.6387]] },
    { fi:16, lat:53.987, lng:27.6687, border:[[53.9929,27.6587],[53.9929,27.6787],[53.9811,27.6787],[53.9811,27.6587]] },
    { fi:16, lat:53.987, lng:27.6887, border:[[53.9929,27.6787],[53.9929,27.6987],[53.9811,27.6987],[53.9811,27.6787]] },
    { fi:16, lat:53.987, lng:27.7087, border:[[53.9929,27.6987],[53.9929,27.7187],[53.9811,27.7187],[53.9811,27.6987]] },
    { fi:16, lat:53.987, lng:27.7287, border:[[53.9929,27.7187],[53.9929,27.7387],[53.9811,27.7387],[53.9811,27.7187]] },
    { fi:16, lat:53.987, lng:27.7487, border:[[53.9929,27.7387],[53.9929,27.7587],[53.9811,27.7587],[53.9811,27.7387]] },
    { fi:16, lat:53.987, lng:27.7687, border:[[53.9929,27.7587],[53.9929,27.7787],[53.9811,27.7787],[53.9811,27.7587]] },
    { fi:16, lat:53.987, lng:27.7887, border:[[53.9929,27.7787],[53.9929,27.7987],[53.9811,27.7987],[53.9811,27.7787]] },
    { fi:16, lat:53.987, lng:27.8087, border:[[53.9929,27.7987],[53.9929,27.8187],[53.9811,27.8187],[53.9811,27.7987]] },
    { fi:17, lat:53.987, lng:27.8287, border:[[53.9929,27.8187],[53.9929,27.8387],[53.9811,27.8387],[53.9811,27.8187]] },
    { fi:17, lat:53.98685, lng:27.84841, border:[[53.9811,27.8587],[53.9811,27.8387],[53.9929,27.8387],[53.9929,27.8554],[53.9892,27.8579],[53.98931,27.8587]] },
    { fi:17, lat:53.98594, lng:27.86919, border:[[53.9811,27.8787],[53.9811,27.8587],[53.98931,27.8587],[53.99212,27.8787]] },
    { fi:17, lat:53.98736, lng:27.88031, border:[[53.9811,27.8787],[53.99212,27.8787],[53.9927,27.8828],[53.9811,27.88077]] },
    { fi:12, lat:53.99353, lng:27.11814, border:[[53.9929,27.1187],[53.9929,27.11703],[53.99478,27.1187]] },
    { fi:12, lat:53.99821, lng:27.1303, border:[[54.0047,27.1387],[53.9929,27.1387],[53.9929,27.1187],[53.99478,27.1187],[54.0047,27.12748]] },
    { fi:12, lat:53.9988, lng:27.1487, border:[[54.0047,27.1387],[54.0047,27.1587],[53.9929,27.1587],[53.9929,27.1387]] },
    { fi:12, lat:53.99878, lng:27.16866, border:[[53.9929,27.1787],[53.9929,27.1587],[54.0047,27.1587],[54.0047,27.17469],[54.00422,27.1787]] },
    { fi:13, lat:53.99869, lng:27.18884, border:[[54.0047,27.1987],[53.9929,27.1987],[53.9929,27.1787],[54.00422,27.1787],[54.0036,27.1839],[54.0047,27.18495]] },
    { fi:13, lat:53.9988, lng:27.2087, border:[[54.0047,27.1987],[54.0047,27.2187],[53.9929,27.2187],[53.9929,27.1987]] },
    { fi:13, lat:53.9988, lng:27.2287, border:[[54.0047,27.2187],[54.0047,27.2387],[53.9929,27.2387],[53.9929,27.2187]] },
    { fi:13, lat:53.9988, lng:27.2487, border:[[54.0047,27.2387],[54.0047,27.2587],[53.9929,27.2587],[53.9929,27.2387]] },
    { fi:13, lat:53.9988, lng:27.2687, border:[[54.0047,27.2587],[54.0047,27.2787],[53.9929,27.2787],[53.9929,27.2587]] },
    { fi:13, lat:53.9988, lng:27.2887, border:[[54.0047,27.2787],[54.0047,27.2987],[53.9929,27.2987],[53.9929,27.2787]] },
    { fi:13, lat:53.9988, lng:27.3087, border:[[54.0047,27.2987],[54.0047,27.3187],[53.9929,27.3187],[53.9929,27.2987]] },
    { fi:13, lat:53.9988, lng:27.3287, border:[[54.0047,27.3187],[54.0047,27.3387],[53.9929,27.3387],[53.9929,27.3187]] },
    { fi:14, lat:53.9988, lng:27.3487, border:[[54.0047,27.3387],[54.0047,27.3587],[53.9929,27.3587],[53.9929,27.3387]] },
    { fi:14, lat:53.9988, lng:27.3687, border:[[54.0047,27.3587],[54.0047,27.3787],[53.9929,27.3787],[53.9929,27.3587]] },
    { fi:14, lat:53.9988, lng:27.3887, border:[[54.0047,27.3787],[54.0047,27.3987],[53.9929,27.3987],[53.9929,27.3787]] },
    { fi:14, lat:53.9988, lng:27.4087, border:[[54.0047,27.3987],[54.0047,27.4187],[53.9929,27.4187],[53.9929,27.3987]] },
    { fi:14, lat:53.9988, lng:27.4287, border:[[54.0047,27.4187],[54.0047,27.4387],[53.9929,27.4387],[53.9929,27.4187]] },
    { fi:14, lat:53.9988, lng:27.4487, border:[[54.0047,27.4387],[54.0047,27.4587],[53.9929,27.4587],[53.9929,27.4387]] },
    { fi:14, lat:53.9988, lng:27.4687, border:[[54.0047,27.4587],[54.0047,27.4787],[53.9929,27.4787],[53.9929,27.4587]] },
    { fi:14, lat:53.9988, lng:27.4887, border:[[54.0047,27.4787],[54.0047,27.4987],[53.9929,27.4987],[53.9929,27.4787]] },
    { fi:15, lat:53.9988, lng:27.5087, border:[[54.0047,27.4987],[54.0047,27.5187],[53.9929,27.5187],[53.9929,27.4987]] },
    { fi:15, lat:53.9988, lng:27.5287, border:[[54.0047,27.5187],[54.0047,27.5387],[53.9929,27.5387],[53.9929,27.5187]] },
    { fi:15, lat:53.9988, lng:27.5487, border:[[54.0047,27.5387],[54.0047,27.5587],[53.9929,27.5587],[53.9929,27.5387]] },
    { fi:15, lat:53.9988, lng:27.5687, border:[[54.0047,27.5587],[54.0047,27.5787],[53.9929,27.5787],[53.9929,27.5587]] },
    { fi:15, lat:53.9988, lng:27.5887, border:[[54.0047,27.5787],[54.0047,27.5987],[53.9929,27.5987],[53.9929,27.5787]] },
    { fi:15, lat:53.9988, lng:27.6087, border:[[54.0047,27.5987],[54.0047,27.6187],[53.9929,27.6187],[53.9929,27.5987]] },
    { fi:15, lat:53.9988, lng:27.6287, border:[[54.0047,27.6187],[54.0047,27.6387],[53.9929,27.6387],[53.9929,27.6187]] },
    { fi:15, lat:53.9988, lng:27.6487, border:[[54.0047,27.6387],[54.0047,27.6587],[53.9929,27.6587],[53.9929,27.6387]] },
    { fi:16, lat:53.9988, lng:27.6687, border:[[54.0047,27.6587],[54.0047,27.6787],[53.9929,27.6787],[53.9929,27.6587]] },
    { fi:16, lat:53.9988, lng:27.6887, border:[[54.0047,27.6787],[54.0047,27.6987],[53.9929,27.6987],[53.9929,27.6787]] },
    { fi:16, lat:53.9988, lng:27.7087, border:[[54.0047,27.6987],[54.0047,27.7187],[53.9929,27.7187],[53.9929,27.6987]] },
    { fi:16, lat:53.9988, lng:27.7287, border:[[54.0047,27.7187],[54.0047,27.7387],[53.9929,27.7387],[53.9929,27.7187]] },
    { fi:16, lat:53.9988, lng:27.7487, border:[[54.0047,27.7387],[54.0047,27.7587],[53.9929,27.7587],[53.9929,27.7387]] },
    { fi:16, lat:53.9988, lng:27.7687, border:[[54.0047,27.7587],[54.0047,27.7787],[53.9929,27.7787],[53.9929,27.7587]] },
    { fi:16, lat:53.9988, lng:27.7887, border:[[54.0047,27.7787],[54.0047,27.7987],[53.9929,27.7987],[53.9929,27.7787]] },
    { fi:16, lat:53.9988, lng:27.8087, border:[[54.0047,27.7987],[54.0047,27.8187],[53.9929,27.8187],[53.9929,27.7987]] },
    { fi:17, lat:53.9988, lng:27.8287, border:[[54.0047,27.8187],[54.0047,27.8387],[53.9929,27.8387],[53.9929,27.8187]] },
    { fi:17, lat:53.99818, lng:27.84526, border:[[53.9929,27.8387],[54.0047,27.8387],[54.0047,27.84741],[53.9929,27.8554]] },
    { fi:12, lat:54.00688, lng:27.13398, border:[[54.0047,27.1387],[54.0047,27.12748],[54.0098,27.132],[54.009,27.1387]] },
    { fi:12, lat:54.00633, lng:27.14742, border:[[54.0047,27.1587],[54.0047,27.1387],[54.009,27.1387],[54.00661,27.1587]] },
    { fi:12, lat:54.00534, lng:27.16403, border:[[54.0047,27.1587],[54.00661,27.1587],[54.0047,27.17469]] },
    { fi:13, lat:54.00925, lng:27.19398, border:[[54.0165,27.1987],[54.0047,27.1987],[54.0047,27.18495],[54.0165,27.19616]] },
    { fi:13, lat:54.0106, lng:27.2087, border:[[54.0165,27.1987],[54.0165,27.2187],[54.0047,27.2187],[54.0047,27.1987]] },
    { fi:13, lat:54.0106, lng:27.2287, border:[[54.0165,27.2187],[54.0165,27.2387],[54.0047,27.2387],[54.0047,27.2187]] },
    { fi:13, lat:54.0106, lng:27.2487, border:[[54.0165,27.2387],[54.0165,27.2587],[54.0047,27.2587],[54.0047,27.2387]] },
    { fi:13, lat:54.0106, lng:27.2687, border:[[54.0165,27.2587],[54.0165,27.2787],[54.0047,27.2787],[54.0047,27.2587]] },
    { fi:13, lat:54.0106, lng:27.2887, border:[[54.0165,27.2787],[54.0165,27.2987],[54.0047,27.2987],[54.0047,27.2787]] },
    { fi:13, lat:54.0106, lng:27.3087, border:[[54.0165,27.2987],[54.0165,27.3187],[54.0047,27.3187],[54.0047,27.2987]] },
    { fi:13, lat:54.0106, lng:27.3287, border:[[54.0165,27.3187],[54.0165,27.3387],[54.0047,27.3387],[54.0047,27.3187]] },
    { fi:14, lat:54.0106, lng:27.3487, border:[[54.0165,27.3387],[54.0165,27.3587],[54.0047,27.3587],[54.0047,27.3387]] },
    { fi:14, lat:54.0106, lng:27.3687, border:[[54.0165,27.3587],[54.0165,27.3787],[54.0047,27.3787],[54.0047,27.3587]] },
    { fi:14, lat:54.0106, lng:27.3887, border:[[54.0165,27.3787],[54.0165,27.3987],[54.0047,27.3987],[54.0047,27.3787]] },
    { fi:14, lat:54.0106, lng:27.4087, border:[[54.0165,27.3987],[54.0165,27.4187],[54.0047,27.4187],[54.0047,27.3987]] },
    { fi:14, lat:54.0106, lng:27.4287, border:[[54.0165,27.4187],[54.0165,27.4387],[54.0047,27.4387],[54.0047,27.4187]] },
    { fi:14, lat:54.0106, lng:27.4487, border:[[54.0165,27.4387],[54.0165,27.4587],[54.0047,27.4587],[54.0047,27.4387]] },
    { fi:14, lat:54.0106, lng:27.4687, border:[[54.0165,27.4587],[54.0165,27.4787],[54.0047,27.4787],[54.0047,27.4587]] },
    { fi:14, lat:54.0106, lng:27.4887, border:[[54.0165,27.4787],[54.0165,27.4987],[54.0047,27.4987],[54.0047,27.4787]] },
    { fi:15, lat:54.0106, lng:27.5087, border:[[54.0165,27.4987],[54.0165,27.5187],[54.0047,27.5187],[54.0047,27.4987]] },
    { fi:15, lat:54.0106, lng:27.5287, border:[[54.0165,27.5187],[54.0165,27.5387],[54.0047,27.5387],[54.0047,27.5187]] },
    { fi:15, lat:54.0106, lng:27.5487, border:[[54.0165,27.5387],[54.0165,27.5587],[54.0047,27.5587],[54.0047,27.5387]] },
    { fi:15, lat:54.0106, lng:27.5687, border:[[54.0165,27.5587],[54.0165,27.5787],[54.0047,27.5787],[54.0047,27.5587]] },
    { fi:15, lat:54.0106, lng:27.5887, border:[[54.0165,27.5787],[54.0165,27.5987],[54.0047,27.5987],[54.0047,27.5787]] },
    { fi:15, lat:54.0106, lng:27.6087, border:[[54.0165,27.5987],[54.0165,27.6187],[54.0047,27.6187],[54.0047,27.5987]] },
    { fi:15, lat:54.0106, lng:27.6287, border:[[54.0165,27.6187],[54.0165,27.6387],[54.0047,27.6387],[54.0047,27.6187]] },
    { fi:15, lat:54.0106, lng:27.6487, border:[[54.0165,27.6387],[54.0165,27.6587],[54.0047,27.6587],[54.0047,27.6387]] },
    { fi:16, lat:54.0106, lng:27.6687, border:[[54.0165,27.6587],[54.0165,27.6787],[54.0047,27.6787],[54.0047,27.6587]] },
    { fi:16, lat:54.0106, lng:27.6887, border:[[54.0165,27.6787],[54.0165,27.6987],[54.0047,27.6987],[54.0047,27.6787]] },
    { fi:16, lat:54.0106, lng:27.7087, border:[[54.0165,27.6987],[54.0165,27.7187],[54.0047,27.7187],[54.0047,27.6987]] },
    { fi:16, lat:54.0106, lng:27.7287, border:[[54.0165,27.7187],[54.0165,27.7387],[54.0047,27.7387],[54.0047,27.7187]] },
    { fi:16, lat:54.0106, lng:27.7487, border:[[54.0165,27.7387],[54.0165,27.7587],[54.0047,27.7587],[54.0047,27.7387]] },
    { fi:16, lat:54.0106, lng:27.7687, border:[[54.0165,27.7587],[54.0165,27.7787],[54.0047,27.7787],[54.0047,27.7587]] },
    { fi:16, lat:54.0106, lng:27.7887, border:[[54.0165,27.7787],[54.0165,27.7987],[54.0047,27.7987],[54.0047,27.7787]] },
    { fi:16, lat:54.0106, lng:27.8087, border:[[54.0165,27.7987],[54.0165,27.8187],[54.0047,27.8187],[54.0047,27.7987]] },
    { fi:17, lat:54.0106, lng:27.8287, border:[[54.0165,27.8187],[54.0165,27.8387],[54.0047,27.8387],[54.0047,27.8187]] },
    { fi:17, lat:54.00894, lng:27.84162, border:[[54.0047,27.8387],[54.0165,27.8387],[54.0165,27.83957],[54.0164,27.8395],[54.0047,27.84741]] },
    { fi:13, lat:54.01739, lng:27.19785, border:[[54.0165,27.1987],[54.0165,27.19616],[54.01918,27.1987]] },
    { fi:13, lat:54.02583, lng:27.19792, border:[[54.0283,27.1987],[54.02088,27.1987],[54.0283,27.19637]] },
    { fi:13, lat:54.0224, lng:27.20871, border:[[54.0283,27.1987],[54.0283,27.2187],[54.0165,27.2187],[54.0165,27.1987],[54.01918,27.1987],[54.0196,27.1991],[54.02088,27.1987]] },
    { fi:13, lat:54.0224, lng:27.2287, border:[[54.0283,27.2187],[54.0283,27.2387],[54.0165,27.2387],[54.0165,27.2187]] },
    { fi:13, lat:54.0224, lng:27.2487, border:[[54.0283,27.2387],[54.0283,27.2587],[54.0165,27.2587],[54.0165,27.2387]] },
    { fi:13, lat:54.0224, lng:27.2687, border:[[54.0283,27.2587],[54.0283,27.2787],[54.0165,27.2787],[54.0165,27.2587]] },
    { fi:13, lat:54.0224, lng:27.2887, border:[[54.0283,27.2787],[54.0283,27.2987],[54.0165,27.2987],[54.0165,27.2787]] },
    { fi:13, lat:54.0224, lng:27.3087, border:[[54.0283,27.2987],[54.0283,27.3187],[54.0165,27.3187],[54.0165,27.2987]] },
    { fi:13, lat:54.0224, lng:27.3287, border:[[54.0283,27.3187],[54.0283,27.3387],[54.0165,27.3387],[54.0165,27.3187]] },
    { fi:14, lat:54.0224, lng:27.3487, border:[[54.0283,27.3387],[54.0283,27.3587],[54.0165,27.3587],[54.0165,27.3387]] },
    { fi:14, lat:54.0224, lng:27.3687, border:[[54.0283,27.3587],[54.0283,27.3787],[54.0165,27.3787],[54.0165,27.3587]] },
    { fi:14, lat:54.0224, lng:27.3887, border:[[54.0283,27.3787],[54.0283,27.3987],[54.0165,27.3987],[54.0165,27.3787]] },
    { fi:14, lat:54.0224, lng:27.4087, border:[[54.0283,27.3987],[54.0283,27.4187],[54.0165,27.4187],[54.0165,27.3987]] },
    { fi:14, lat:54.0224, lng:27.4287, border:[[54.0283,27.4187],[54.0283,27.4387],[54.0165,27.4387],[54.0165,27.4187]] },
    { fi:14, lat:54.0224, lng:27.4487, border:[[54.0283,27.4387],[54.0283,27.4587],[54.0165,27.4587],[54.0165,27.4387]] },
    { fi:14, lat:54.0224, lng:27.4687, border:[[54.0283,27.4587],[54.0283,27.4787],[54.0165,27.4787],[54.0165,27.4587]] },
    { fi:14, lat:54.0224, lng:27.4887, border:[[54.0283,27.4787],[54.0283,27.4987],[54.0165,27.4987],[54.0165,27.4787]] },
    { fi:15, lat:54.0224, lng:27.5087, border:[[54.0283,27.4987],[54.0283,27.5187],[54.0165,27.5187],[54.0165,27.4987]] },
    { fi:15, lat:54.0224, lng:27.5287, border:[[54.0283,27.5187],[54.0283,27.5387],[54.0165,27.5387],[54.0165,27.5187]] },
    { fi:15, lat:54.0224, lng:27.5487, border:[[54.0283,27.5387],[54.0283,27.5587],[54.0165,27.5587],[54.0165,27.5387]] },
    { fi:15, lat:54.0224, lng:27.5687, border:[[54.0283,27.5587],[54.0283,27.5787],[54.0165,27.5787],[54.0165,27.5587]] },
    { fi:15, lat:54.0224, lng:27.5887, border:[[54.0283,27.5787],[54.0283,27.5987],[54.0165,27.5987],[54.0165,27.5787]] },
    { fi:15, lat:54.0224, lng:27.6087, border:[[54.0283,27.5987],[54.0283,27.6187],[54.0165,27.6187],[54.0165,27.5987]] },
    { fi:15, lat:54.0224, lng:27.6287, border:[[54.0283,27.6187],[54.0283,27.6387],[54.0165,27.6387],[54.0165,27.6187]] },
    { fi:15, lat:54.0224, lng:27.6487, border:[[54.0283,27.6387],[54.0283,27.6587],[54.0165,27.6587],[54.0165,27.6387]] },
    { fi:16, lat:54.0224, lng:27.6687, border:[[54.0283,27.6587],[54.0283,27.6787],[54.0165,27.6787],[54.0165,27.6587]] },
    { fi:16, lat:54.0224, lng:27.6887, border:[[54.0283,27.6787],[54.0283,27.6987],[54.0165,27.6987],[54.0165,27.6787]] },
    { fi:16, lat:54.0224, lng:27.7087, border:[[54.0283,27.6987],[54.0283,27.7187],[54.0165,27.7187],[54.0165,27.6987]] },
    { fi:16, lat:54.0224, lng:27.7287, border:[[54.0283,27.7187],[54.0283,27.7387],[54.0165,27.7387],[54.0165,27.7187]] },
    { fi:16, lat:54.0224, lng:27.7487, border:[[54.0283,27.7387],[54.0283,27.7587],[54.0165,27.7587],[54.0165,27.7387]] },
    { fi:16, lat:54.0224, lng:27.7687, border:[[54.0283,27.7587],[54.0283,27.7787],[54.0165,27.7787],[54.0165,27.7587]] },
    { fi:16, lat:54.0224, lng:27.7887, border:[[54.0283,27.7787],[54.0283,27.7987],[54.0165,27.7987],[54.0165,27.7787]] },
    { fi:16, lat:54.0224, lng:27.8087, border:[[54.0283,27.7987],[54.0283,27.8187],[54.0165,27.8187],[54.0165,27.7987]] },
    { fi:17, lat:54.0224, lng:27.8287, border:[[54.0283,27.8187],[54.0283,27.8387],[54.0165,27.8387],[54.0165,27.8187]] },
    { fi:17, lat:54.02403, lng:27.84183, border:[[54.0165,27.8387],[54.0283,27.8387],[54.0283,27.84803],[54.0165,27.83957]] },
    { fi:13, lat:54.03507, lng:27.19648, border:[[54.0401,27.1987],[54.0283,27.1987],[54.0283,27.19637],[54.0401,27.19268]] },
    { fi:13, lat:54.0342, lng:27.2087, border:[[54.0401,27.1987],[54.0401,27.2187],[54.0283,27.2187],[54.0283,27.1987]] },
    { fi:13, lat:54.0342, lng:27.2287, border:[[54.0401,27.2187],[54.0401,27.2387],[54.0283,27.2387],[54.0283,27.2187]] },
    { fi:13, lat:54.0342, lng:27.2487, border:[[54.0401,27.2387],[54.0401,27.2587],[54.0283,27.2587],[54.0283,27.2387]] },
    { fi:13, lat:54.0342, lng:27.2687, border:[[54.0401,27.2587],[54.0401,27.2787],[54.0283,27.2787],[54.0283,27.2587]] },
    { fi:13, lat:54.0342, lng:27.2887, border:[[54.0401,27.2787],[54.0401,27.2987],[54.0283,27.2987],[54.0283,27.2787]] },
    { fi:13, lat:54.0342, lng:27.3087, border:[[54.0401,27.2987],[54.0401,27.3187],[54.0283,27.3187],[54.0283,27.2987]] },
    { fi:13, lat:54.0342, lng:27.3287, border:[[54.0401,27.3187],[54.0401,27.3387],[54.0283,27.3387],[54.0283,27.3187]] },
    { fi:14, lat:54.0342, lng:27.3487, border:[[54.0401,27.3387],[54.0401,27.3587],[54.0283,27.3587],[54.0283,27.3387]] },
    { fi:14, lat:54.0342, lng:27.3687, border:[[54.0401,27.3587],[54.0401,27.3787],[54.0283,27.3787],[54.0283,27.3587]] },
    { fi:14, lat:54.0342, lng:27.3887, border:[[54.0401,27.3787],[54.0401,27.3987],[54.0283,27.3987],[54.0283,27.3787]] },
    { fi:14, lat:54.0342, lng:27.4087, border:[[54.0401,27.3987],[54.0401,27.4187],[54.0283,27.4187],[54.0283,27.3987]] },
    { fi:14, lat:54.0342, lng:27.4287, border:[[54.0401,27.4187],[54.0401,27.4387],[54.0283,27.4387],[54.0283,27.4187]] },
    { fi:14, lat:54.0342, lng:27.4487, border:[[54.0401,27.4387],[54.0401,27.4587],[54.0283,27.4587],[54.0283,27.4387]] },
    { fi:14, lat:54.0342, lng:27.4687, border:[[54.0401,27.4587],[54.0401,27.4787],[54.0283,27.4787],[54.0283,27.4587]] },
    { fi:14, lat:54.0342, lng:27.4887, border:[[54.0401,27.4787],[54.0401,27.4987],[54.0283,27.4987],[54.0283,27.4787]] },
    { fi:15, lat:54.0342, lng:27.5087, border:[[54.0401,27.4987],[54.0401,27.5187],[54.0283,27.5187],[54.0283,27.4987]] },
    { fi:15, lat:54.0342, lng:27.5287, border:[[54.0401,27.5187],[54.0401,27.5387],[54.0283,27.5387],[54.0283,27.5187]] },
    { fi:15, lat:54.0342, lng:27.5487, border:[[54.0401,27.5387],[54.0401,27.5587],[54.0283,27.5587],[54.0283,27.5387]] },
    { fi:15, lat:54.0342, lng:27.5687, border:[[54.0401,27.5587],[54.0401,27.5787],[54.0283,27.5787],[54.0283,27.5587]] },
    { fi:15, lat:54.0342, lng:27.5887, border:[[54.0401,27.5787],[54.0401,27.5987],[54.0283,27.5987],[54.0283,27.5787]] },
    { fi:15, lat:54.0342, lng:27.6087, border:[[54.0401,27.5987],[54.0401,27.6187],[54.0283,27.6187],[54.0283,27.5987]] },
    { fi:15, lat:54.0342, lng:27.6287, border:[[54.0401,27.6187],[54.0401,27.6387],[54.0283,27.6387],[54.0283,27.6187]] },
    { fi:15, lat:54.0342, lng:27.6487, border:[[54.0401,27.6387],[54.0401,27.6587],[54.0283,27.6587],[54.0283,27.6387]] },
    { fi:16, lat:54.0342, lng:27.6687, border:[[54.0401,27.6587],[54.0401,27.6787],[54.0283,27.6787],[54.0283,27.6587]] },
    { fi:16, lat:54.0342, lng:27.6887, border:[[54.0401,27.6787],[54.0401,27.6987],[54.0283,27.6987],[54.0283,27.6787]] },
    { fi:16, lat:54.0342, lng:27.7087, border:[[54.0401,27.6987],[54.0401,27.7187],[54.0283,27.7187],[54.0283,27.6987]] },
    { fi:16, lat:54.0342, lng:27.7287, border:[[54.0401,27.7187],[54.0401,27.7387],[54.0283,27.7387],[54.0283,27.7187]] },
    { fi:16, lat:54.0342, lng:27.7487, border:[[54.0401,27.7387],[54.0401,27.7587],[54.0283,27.7587],[54.0283,27.7387]] },
    { fi:16, lat:54.0342, lng:27.7687, border:[[54.0401,27.7587],[54.0401,27.7787],[54.0283,27.7787],[54.0283,27.7587]] },
    { fi:16, lat:54.0342, lng:27.7887, border:[[54.0401,27.7787],[54.0401,27.7987],[54.0283,27.7987],[54.0283,27.7787]] },
    { fi:16, lat:54.03415, lng:27.80863, border:[[54.0283,27.8187],[54.0283,27.7987],[54.0401,27.7987],[54.0401,27.81508],[54.039,27.8187]] },
    { fi:17, lat:54.03234, lng:27.82739, border:[[54.0283,27.8387],[54.0283,27.8187],[54.039,27.8187],[54.03295,27.8387]] },
    { fi:17, lat:54.03, lng:27.84286, border:[[54.0283,27.8387],[54.03295,27.8387],[54.0298,27.8491],[54.0283,27.84803]] },
    { fi:12, lat:54.04801, lng:27.17317, border:[[54.0519,27.1787],[54.0434,27.1787],[54.0453,27.1664],[54.0519,27.16802]] },
    { fi:13, lat:54.04671, lng:27.18933, border:[[54.0519,27.1787],[54.0519,27.1987],[54.0401,27.1987],[54.0401,27.19268],[54.0413,27.1923],[54.0434,27.1787]] },
    { fi:13, lat:54.046, lng:27.2087, border:[[54.0519,27.1987],[54.0519,27.2187],[54.0401,27.2187],[54.0401,27.1987]] },
    { fi:13, lat:54.046, lng:27.2287, border:[[54.0519,27.2187],[54.0519,27.2387],[54.0401,27.2387],[54.0401,27.2187]] },
    { fi:13, lat:54.046, lng:27.2487, border:[[54.0519,27.2387],[54.0519,27.2587],[54.0401,27.2587],[54.0401,27.2387]] },
    { fi:13, lat:54.046, lng:27.2687, border:[[54.0519,27.2587],[54.0519,27.2787],[54.0401,27.2787],[54.0401,27.2587]] },
    { fi:13, lat:54.046, lng:27.2887, border:[[54.0519,27.2787],[54.0519,27.2987],[54.0401,27.2987],[54.0401,27.2787]] },
    { fi:13, lat:54.046, lng:27.3087, border:[[54.0519,27.2987],[54.0519,27.3187],[54.0401,27.3187],[54.0401,27.2987]] },
    { fi:13, lat:54.046, lng:27.3287, border:[[54.0519,27.3187],[54.0519,27.3387],[54.0401,27.3387],[54.0401,27.3187]] },
    { fi:14, lat:54.046, lng:27.3487, border:[[54.0519,27.3387],[54.0519,27.3587],[54.0401,27.3587],[54.0401,27.3387]] },
    { fi:14, lat:54.046, lng:27.3687, border:[[54.0519,27.3587],[54.0519,27.3787],[54.0401,27.3787],[54.0401,27.3587]] },
    { fi:14, lat:54.046, lng:27.3887, border:[[54.0519,27.3787],[54.0519,27.3987],[54.0401,27.3987],[54.0401,27.3787]] },
    { fi:14, lat:54.046, lng:27.4087, border:[[54.0519,27.3987],[54.0519,27.4187],[54.0401,27.4187],[54.0401,27.3987]] },
    { fi:14, lat:54.046, lng:27.4287, border:[[54.0519,27.4187],[54.0519,27.4387],[54.0401,27.4387],[54.0401,27.4187]] },
    { fi:14, lat:54.046, lng:27.4487, border:[[54.0519,27.4387],[54.0519,27.4587],[54.0401,27.4587],[54.0401,27.4387]] },
    { fi:14, lat:54.046, lng:27.4687, border:[[54.0519,27.4587],[54.0519,27.4787],[54.0401,27.4787],[54.0401,27.4587]] },
    { fi:14, lat:54.046, lng:27.4887, border:[[54.0519,27.4787],[54.0519,27.4987],[54.0401,27.4987],[54.0401,27.4787]] },
    { fi:15, lat:54.046, lng:27.5087, border:[[54.0519,27.4987],[54.0519,27.5187],[54.0401,27.5187],[54.0401,27.4987]] },
    { fi:15, lat:54.046, lng:27.5287, border:[[54.0519,27.5187],[54.0519,27.5387],[54.0401,27.5387],[54.0401,27.5187]] },
    { fi:15, lat:54.046, lng:27.5487, border:[[54.0519,27.5387],[54.0519,27.5587],[54.0401,27.5587],[54.0401,27.5387]] },
    { fi:15, lat:54.046, lng:27.5687, border:[[54.0519,27.5587],[54.0519,27.5787],[54.0401,27.5787],[54.0401,27.5587]] },
    { fi:15, lat:54.046, lng:27.5887, border:[[54.0519,27.5787],[54.0519,27.5987],[54.0401,27.5987],[54.0401,27.5787]] },
    { fi:15, lat:54.046, lng:27.6087, border:[[54.0519,27.5987],[54.0519,27.6187],[54.0401,27.6187],[54.0401,27.5987]] },
    { fi:15, lat:54.046, lng:27.6287, border:[[54.0519,27.6187],[54.0519,27.6387],[54.0401,27.6387],[54.0401,27.6187]] },
    { fi:15, lat:54.046, lng:27.6487, border:[[54.0519,27.6387],[54.0519,27.6587],[54.0401,27.6587],[54.0401,27.6387]] },
    { fi:16, lat:54.046, lng:27.6687, border:[[54.0519,27.6587],[54.0519,27.6787],[54.0401,27.6787],[54.0401,27.6587]] },
    { fi:16, lat:54.046, lng:27.6887, border:[[54.0519,27.6787],[54.0519,27.6987],[54.0401,27.6987],[54.0401,27.6787]] },
    { fi:16, lat:54.046, lng:27.7087, border:[[54.0519,27.6987],[54.0519,27.7187],[54.0401,27.7187],[54.0401,27.6987]] },
    { fi:16, lat:54.046, lng:27.7287, border:[[54.0519,27.7187],[54.0519,27.7387],[54.0401,27.7387],[54.0401,27.7187]] },
    { fi:16, lat:54.046, lng:27.7487, border:[[54.0519,27.7387],[54.0519,27.7587],[54.0401,27.7587],[54.0401,27.7387]] },
    { fi:16, lat:54.046, lng:27.7687, border:[[54.0519,27.7587],[54.0519,27.7787],[54.0401,27.7787],[54.0401,27.7587]] },
    { fi:16, lat:54.04573, lng:27.78785, border:[[54.0401,27.7987],[54.0401,27.7787],[54.0519,27.7787],[54.0519,27.79583],[54.0463,27.7946],[54.04506,27.7987]] },
    { fi:16, lat:54.04175, lng:27.80416, border:[[54.0401,27.7987],[54.04506,27.7987],[54.0401,27.81508]] },
    { fi:12, lat:54.05749, lng:27.17405, border:[[54.0637,27.1787],[54.0519,27.1787],[54.0519,27.16802],[54.0637,27.17091]] },
    { fi:13, lat:54.0578, lng:27.1887, border:[[54.0637,27.1787],[54.0637,27.1987],[54.0519,27.1987],[54.0519,27.1787]] },
    { fi:13, lat:54.0578, lng:27.2087, border:[[54.0637,27.1987],[54.0637,27.2187],[54.0519,27.2187],[54.0519,27.1987]] },
    { fi:13, lat:54.0578, lng:27.2287, border:[[54.0637,27.2187],[54.0637,27.2387],[54.0519,27.2387],[54.0519,27.2187]] },
    { fi:13, lat:54.0578, lng:27.2487, border:[[54.0637,27.2387],[54.0637,27.2587],[54.0519,27.2587],[54.0519,27.2387]] },
    { fi:13, lat:54.0578, lng:27.2687, border:[[54.0637,27.2587],[54.0637,27.2787],[54.0519,27.2787],[54.0519,27.2587]] },
    { fi:13, lat:54.0578, lng:27.2887, border:[[54.0637,27.2787],[54.0637,27.2987],[54.0519,27.2987],[54.0519,27.2787]] },
    { fi:13, lat:54.0578, lng:27.3087, border:[[54.0637,27.2987],[54.0637,27.3187],[54.0519,27.3187],[54.0519,27.2987]] },
    { fi:13, lat:54.0578, lng:27.3287, border:[[54.0637,27.3187],[54.0637,27.3387],[54.0519,27.3387],[54.0519,27.3187]] },
    { fi:14, lat:54.0578, lng:27.3487, border:[[54.0637,27.3387],[54.0637,27.3587],[54.0519,27.3587],[54.0519,27.3387]] },
    { fi:14, lat:54.0578, lng:27.3687, border:[[54.0637,27.3587],[54.0637,27.3787],[54.0519,27.3787],[54.0519,27.3587]] },
    { fi:14, lat:54.0578, lng:27.3887, border:[[54.0637,27.3787],[54.0637,27.3987],[54.0519,27.3987],[54.0519,27.3787]] },
    { fi:14, lat:54.0578, lng:27.4087, border:[[54.0637,27.3987],[54.0637,27.4187],[54.0519,27.4187],[54.0519,27.3987]] },
    { fi:14, lat:54.0578, lng:27.4287, border:[[54.0637,27.4187],[54.0637,27.4387],[54.0519,27.4387],[54.0519,27.4187]] },
    { fi:14, lat:54.0578, lng:27.4487, border:[[54.0637,27.4387],[54.0637,27.4587],[54.0519,27.4587],[54.0519,27.4387]] },
    { fi:14, lat:54.0578, lng:27.4687, border:[[54.0637,27.4587],[54.0637,27.4787],[54.0519,27.4787],[54.0519,27.4587]] },
    { fi:14, lat:54.0578, lng:27.4887, border:[[54.0637,27.4787],[54.0637,27.4987],[54.0519,27.4987],[54.0519,27.4787]] },
    { fi:15, lat:54.0578, lng:27.5087, border:[[54.0637,27.4987],[54.0637,27.5187],[54.0519,27.5187],[54.0519,27.4987]] },
    { fi:15, lat:54.0578, lng:27.5287, border:[[54.0637,27.5187],[54.0637,27.5387],[54.0519,27.5387],[54.0519,27.5187]] },
    { fi:15, lat:54.0578, lng:27.5487, border:[[54.0637,27.5387],[54.0637,27.5587],[54.0519,27.5587],[54.0519,27.5387]] },
    { fi:15, lat:54.0578, lng:27.5687, border:[[54.0637,27.5587],[54.0637,27.5787],[54.0519,27.5787],[54.0519,27.5587]] },
    { fi:15, lat:54.0578, lng:27.5887, border:[[54.0637,27.5787],[54.0637,27.5987],[54.0519,27.5987],[54.0519,27.5787]] },
    { fi:15, lat:54.0578, lng:27.6087, border:[[54.0637,27.5987],[54.0637,27.6187],[54.0519,27.6187],[54.0519,27.5987]] },
    { fi:15, lat:54.0578, lng:27.6287, border:[[54.0637,27.6187],[54.0637,27.6387],[54.0519,27.6387],[54.0519,27.6187]] },
    { fi:15, lat:54.0578, lng:27.6487, border:[[54.0637,27.6387],[54.0637,27.6587],[54.0519,27.6587],[54.0519,27.6387]] },
    { fi:16, lat:54.0578, lng:27.6687, border:[[54.0637,27.6587],[54.0637,27.6787],[54.0519,27.6787],[54.0519,27.6587]] },
    { fi:16, lat:54.0578, lng:27.6887, border:[[54.0637,27.6787],[54.0637,27.6987],[54.0519,27.6987],[54.0519,27.6787]] },
    { fi:16, lat:54.0578, lng:27.7087, border:[[54.0637,27.6987],[54.0637,27.7187],[54.0519,27.7187],[54.0519,27.6987]] },
    { fi:16, lat:54.0578, lng:27.7287, border:[[54.0637,27.7187],[54.0637,27.7387],[54.0519,27.7387],[54.0519,27.7187]] },
    { fi:16, lat:54.0578, lng:27.7487, border:[[54.0637,27.7387],[54.0637,27.7587],[54.0519,27.7587],[54.0519,27.7387]] },
    { fi:16, lat:54.0578, lng:27.7687, border:[[54.0637,27.7587],[54.0637,27.7787],[54.0519,27.7787],[54.0519,27.7587]] },
    { fi:16, lat:54.05794, lng:27.78793, border:[[54.0519,27.7787],[54.0637,27.7787],[54.0637,27.79841],[54.0519,27.79583]] },
    { fi:12, lat:54.06529, lng:27.17502, border:[[54.0637,27.1787],[54.0637,27.17091],[54.0669,27.1717],[54.06698,27.1787]] },
    { fi:13, lat:54.06959, lng:27.19012, border:[[54.0755,27.1787],[54.0755,27.1987],[54.0637,27.1987],[54.0637,27.1787],[54.06698,27.1787],[54.0671,27.1898],[54.07481,27.1787]] },
    { fi:13, lat:54.0696, lng:27.2087, border:[[54.0755,27.1987],[54.0755,27.2187],[54.0637,27.2187],[54.0637,27.1987]] },
    { fi:13, lat:54.0696, lng:27.2287, border:[[54.0755,27.2187],[54.0755,27.2387],[54.0637,27.2387],[54.0637,27.2187]] },
    { fi:13, lat:54.0696, lng:27.2487, border:[[54.0755,27.2387],[54.0755,27.2587],[54.0637,27.2587],[54.0637,27.2387]] },
    { fi:13, lat:54.0696, lng:27.2687, border:[[54.0755,27.2587],[54.0755,27.2787],[54.0637,27.2787],[54.0637,27.2587]] },
    { fi:13, lat:54.0696, lng:27.2887, border:[[54.0755,27.2787],[54.0755,27.2987],[54.0637,27.2987],[54.0637,27.2787]] },
    { fi:13, lat:54.0696, lng:27.3087, border:[[54.0755,27.2987],[54.0755,27.3187],[54.0637,27.3187],[54.0637,27.2987]] },
    { fi:13, lat:54.0696, lng:27.3287, border:[[54.0755,27.3187],[54.0755,27.3387],[54.0637,27.3387],[54.0637,27.3187]] },
    { fi:14, lat:54.0696, lng:27.3487, border:[[54.0755,27.3387],[54.0755,27.3587],[54.0637,27.3587],[54.0637,27.3387]] },
    { fi:14, lat:54.0696, lng:27.3687, border:[[54.0755,27.3587],[54.0755,27.3787],[54.0637,27.3787],[54.0637,27.3587]] },
    { fi:14, lat:54.0696, lng:27.3887, border:[[54.0755,27.3787],[54.0755,27.3987],[54.0637,27.3987],[54.0637,27.3787]] },
    { fi:14, lat:54.0696, lng:27.4087, border:[[54.0755,27.3987],[54.0755,27.4187],[54.0637,27.4187],[54.0637,27.3987]] },
    { fi:14, lat:54.0696, lng:27.4287, border:[[54.0755,27.4187],[54.0755,27.4387],[54.0637,27.4387],[54.0637,27.4187]] },
    { fi:14, lat:54.0696, lng:27.4487, border:[[54.0755,27.4387],[54.0755,27.4587],[54.0637,27.4587],[54.0637,27.4387]] },
    { fi:14, lat:54.0696, lng:27.4687, border:[[54.0755,27.4587],[54.0755,27.4787],[54.0637,27.4787],[54.0637,27.4587]] },
    { fi:14, lat:54.0696, lng:27.4887, border:[[54.0755,27.4787],[54.0755,27.4987],[54.0637,27.4987],[54.0637,27.4787]] },
    { fi:15, lat:54.0696, lng:27.5087, border:[[54.0755,27.4987],[54.0755,27.5187],[54.0637,27.5187],[54.0637,27.4987]] },
    { fi:15, lat:54.0696, lng:27.5287, border:[[54.0755,27.5187],[54.0755,27.5387],[54.0637,27.5387],[54.0637,27.5187]] },
    { fi:15, lat:54.0696, lng:27.5487, border:[[54.0755,27.5387],[54.0755,27.5587],[54.0637,27.5587],[54.0637,27.5387]] },
    { fi:15, lat:54.0696, lng:27.5687, border:[[54.0755,27.5587],[54.0755,27.5787],[54.0637,27.5787],[54.0637,27.5587]] },
    { fi:15, lat:54.06902, lng:27.58786, border:[[54.0637,27.5987],[54.0637,27.5787],[54.0755,27.5787],[54.0755,27.589],[54.0723,27.5923],[54.07143,27.5987]] },
    { fi:15, lat:54.06693, lng:27.60799, border:[[54.0637,27.6187],[54.0637,27.5987],[54.07143,27.5987],[54.06871,27.6187]] },
    { fi:15, lat:54.06561, lng:27.62746, border:[[54.0637,27.6387],[54.0637,27.6187],[54.06871,27.6187],[54.06599,27.6387]] },
    { fi:15, lat:54.06916, lng:27.65298, border:[[54.0755,27.6587],[54.0637,27.6587],[54.0637,27.6387],[54.06599,27.6387],[54.064,27.6533],[54.0755,27.64914]] },
    { fi:16, lat:54.0696, lng:27.6687, border:[[54.0755,27.6587],[54.0755,27.6787],[54.0637,27.6787],[54.0637,27.6587]] },
    { fi:16, lat:54.0696, lng:27.6887, border:[[54.0755,27.6787],[54.0755,27.6987],[54.0637,27.6987],[54.0637,27.6787]] },
    { fi:16, lat:54.0696, lng:27.7087, border:[[54.0755,27.6987],[54.0755,27.7187],[54.0637,27.7187],[54.0637,27.6987]] },
    { fi:16, lat:54.0696, lng:27.7287, border:[[54.0755,27.7187],[54.0755,27.7387],[54.0637,27.7387],[54.0637,27.7187]] },
    { fi:16, lat:54.0696, lng:27.7487, border:[[54.0755,27.7387],[54.0755,27.7587],[54.0637,27.7587],[54.0637,27.7387]] },
    { fi:16, lat:54.0696, lng:27.7687, border:[[54.0755,27.7587],[54.0755,27.7787],[54.0637,27.7787],[54.0637,27.7587]] },
    { fi:16, lat:54.0696, lng:27.78869, border:[[54.0637,27.7787],[54.0755,27.7787],[54.0755,27.7987],[54.06501,27.7987],[54.0637,27.79841]] },
    { fi:16, lat:54.072, lng:27.79947, border:[[54.0755,27.7987],[54.0755,27.801],[54.06501,27.7987]] },
    { fi:12, lat:54.08211, lng:27.17398, border:[[54.0755,27.1787],[54.0755,27.1777],[54.0846,27.1646],[54.08683,27.1787]] },
    { fi:13, lat:54.08138, lng:27.18873, border:[[54.0873,27.1987],[54.0755,27.1987],[54.0755,27.1787],[54.08683,27.1787],[54.0873,27.18169]] },
    { fi:13, lat:54.0814, lng:27.2087, border:[[54.0873,27.1987],[54.0873,27.2187],[54.0755,27.2187],[54.0755,27.1987]] },
    { fi:13, lat:54.0814, lng:27.2287, border:[[54.0873,27.2187],[54.0873,27.2387],[54.0755,27.2387],[54.0755,27.2187]] },
    { fi:13, lat:54.0814, lng:27.2487, border:[[54.0873,27.2387],[54.0873,27.2587],[54.0755,27.2587],[54.0755,27.2387]] },
    { fi:13, lat:54.0814, lng:27.2687, border:[[54.0873,27.2587],[54.0873,27.2787],[54.0755,27.2787],[54.0755,27.2587]] },
    { fi:13, lat:54.0814, lng:27.2887, border:[[54.0873,27.2787],[54.0873,27.2987],[54.0755,27.2987],[54.0755,27.2787]] },
    { fi:13, lat:54.0814, lng:27.3087, border:[[54.0873,27.2987],[54.0873,27.3187],[54.0755,27.3187],[54.0755,27.2987]] },
    { fi:13, lat:54.0814, lng:27.3287, border:[[54.0873,27.3187],[54.0873,27.3387],[54.0755,27.3387],[54.0755,27.3187]] },
    { fi:14, lat:54.0814, lng:27.3487, border:[[54.0873,27.3387],[54.0873,27.3587],[54.0755,27.3587],[54.0755,27.3387]] },
    { fi:14, lat:54.0814, lng:27.3687, border:[[54.0873,27.3587],[54.0873,27.3787],[54.0755,27.3787],[54.0755,27.3587]] },
    { fi:14, lat:54.0814, lng:27.3887, border:[[54.0873,27.3787],[54.0873,27.3987],[54.0755,27.3987],[54.0755,27.3787]] },
    { fi:14, lat:54.0814, lng:27.4087, border:[[54.0873,27.3987],[54.0873,27.4187],[54.0755,27.4187],[54.0755,27.3987]] },
    { fi:14, lat:54.0814, lng:27.4287, border:[[54.0873,27.4187],[54.0873,27.4387],[54.0755,27.4387],[54.0755,27.4187]] },
    { fi:14, lat:54.0814, lng:27.4487, border:[[54.0873,27.4387],[54.0873,27.4587],[54.0755,27.4587],[54.0755,27.4387]] },
    { fi:14, lat:54.0814, lng:27.4687, border:[[54.0873,27.4587],[54.0873,27.4787],[54.0755,27.4787],[54.0755,27.4587]] },
    { fi:14, lat:54.0814, lng:27.4887, border:[[54.0873,27.4787],[54.0873,27.4987],[54.0755,27.4987],[54.0755,27.4787]] },
    { fi:15, lat:54.0814, lng:27.5087, border:[[54.0873,27.4987],[54.0873,27.5187],[54.0755,27.5187],[54.0755,27.4987]] },
    { fi:15, lat:54.0814, lng:27.5287, border:[[54.0873,27.5187],[54.0873,27.5387],[54.0755,27.5387],[54.0755,27.5187]] },
    { fi:15, lat:54.0814, lng:27.5487, border:[[54.0873,27.5387],[54.0873,27.5587],[54.0755,27.5587],[54.0755,27.5387]] },
    { fi:15, lat:54.08136, lng:27.56863, border:[[54.0755,27.5787],[54.0755,27.5587],[54.0873,27.5587],[54.0873,27.57685],[54.0855,27.5787]] },
    { fi:15, lat:54.07883, lng:27.58213, border:[[54.0755,27.5787],[54.0855,27.5787],[54.0755,27.589]] },
    { fi:15, lat:54.08176, lng:27.65279, border:[[54.0873,27.6587],[54.0755,27.6587],[54.0755,27.64914],[54.0873,27.64487]] },
    { fi:16, lat:54.0814, lng:27.6687, border:[[54.0873,27.6587],[54.0873,27.6787],[54.0755,27.6787],[54.0755,27.6587]] },
    { fi:16, lat:54.0814, lng:27.6887, border:[[54.0873,27.6787],[54.0873,27.6987],[54.0755,27.6987],[54.0755,27.6787]] },
    { fi:16, lat:54.0814, lng:27.7087, border:[[54.0873,27.6987],[54.0873,27.7187],[54.0755,27.7187],[54.0755,27.6987]] },
    { fi:16, lat:54.0814, lng:27.7287, border:[[54.0873,27.7187],[54.0873,27.7387],[54.0755,27.7387],[54.0755,27.7187]] },
    { fi:16, lat:54.08103, lng:27.74833, border:[[54.0755,27.7587],[54.0755,27.7387],[54.0873,27.7387],[54.0873,27.74414],[54.08512,27.7587]] },
    { fi:16, lat:54.07961, lng:27.76809, border:[[54.0755,27.7787],[54.0755,27.7587],[54.08512,27.7587],[54.08214,27.7787]] },
    { fi:16, lat:54.07814, lng:27.78773, border:[[54.0755,27.7987],[54.0755,27.7787],[54.08214,27.7787],[54.07915,27.7987]] },
    { fi:16, lat:54.07729, lng:27.80001, border:[[54.0755,27.7987],[54.07915,27.7987],[54.0787,27.8017],[54.0755,27.801]] },
    { fi:13, lat:54.0882, lng:27.19303, border:[[54.0873,27.1987],[54.0873,27.18169],[54.08999,27.1987]] },
    { fi:13, lat:54.09051, lng:27.21105, border:[[54.0991,27.2187],[54.0873,27.2187],[54.0873,27.1987],[54.08999,27.1987],[54.0928,27.2165],[54.0991,27.21606]] },
    { fi:13, lat:54.0932, lng:27.2287, border:[[54.0991,27.2187],[54.0991,27.2387],[54.0873,27.2387],[54.0873,27.2187]] },
    { fi:13, lat:54.0932, lng:27.2487, border:[[54.0991,27.2387],[54.0991,27.2587],[54.0873,27.2587],[54.0873,27.2387]] },
    { fi:13, lat:54.0932, lng:27.2687, border:[[54.0991,27.2587],[54.0991,27.2787],[54.0873,27.2787],[54.0873,27.2587]] },
    { fi:13, lat:54.0932, lng:27.2887, border:[[54.0991,27.2787],[54.0991,27.2987],[54.0873,27.2987],[54.0873,27.2787]] },
    { fi:13, lat:54.0932, lng:27.3087, border:[[54.0991,27.2987],[54.0991,27.3187],[54.0873,27.3187],[54.0873,27.2987]] },
    { fi:13, lat:54.0932, lng:27.3287, border:[[54.0991,27.3187],[54.0991,27.3387],[54.0873,27.3387],[54.0873,27.3187]] },
    { fi:14, lat:54.0932, lng:27.3487, border:[[54.0991,27.3387],[54.0991,27.3587],[54.0873,27.3587],[54.0873,27.3387]] },
    { fi:14, lat:54.0932, lng:27.3687, border:[[54.0991,27.3587],[54.0991,27.3787],[54.0873,27.3787],[54.0873,27.3587]] },
    { fi:14, lat:54.0932, lng:27.3887, border:[[54.0991,27.3787],[54.0991,27.3987],[54.0873,27.3987],[54.0873,27.3787]] },
    { fi:14, lat:54.0932, lng:27.4087, border:[[54.0991,27.3987],[54.0991,27.4187],[54.0873,27.4187],[54.0873,27.3987]] },
    { fi:14, lat:54.0932, lng:27.4287, border:[[54.0991,27.4187],[54.0991,27.4387],[54.0873,27.4387],[54.0873,27.4187]] },
    { fi:14, lat:54.0932, lng:27.4487, border:[[54.0991,27.4387],[54.0991,27.4587],[54.0873,27.4587],[54.0873,27.4387]] },
    { fi:14, lat:54.0932, lng:27.4687, border:[[54.0991,27.4587],[54.0991,27.4787],[54.0873,27.4787],[54.0873,27.4587]] },
    { fi:14, lat:54.0932, lng:27.4887, border:[[54.0991,27.4787],[54.0991,27.4987],[54.0873,27.4987],[54.0873,27.4787]] },
    { fi:15, lat:54.0932, lng:27.5087, border:[[54.0991,27.4987],[54.0991,27.5187],[54.0873,27.5187],[54.0873,27.4987]] },
    { fi:15, lat:54.0932, lng:27.5287, border:[[54.0991,27.5187],[54.0991,27.5387],[54.0873,27.5387],[54.0873,27.5187]] },
    { fi:15, lat:54.0932, lng:27.5487, border:[[54.0991,27.5387],[54.0991,27.5587],[54.0873,27.5587],[54.0873,27.5387]] },
    { fi:15, lat:54.09221, lng:27.56524, border:[[54.0873,27.5587],[54.0991,27.5587],[54.0991,27.56469],[54.0873,27.57685]] },
    { fi:15, lat:54.09714, lng:27.632, border:[[54.0991,27.6187],[54.0991,27.6387],[54.09322,27.6387],[54.09907,27.6187]] },
    { fi:15, lat:54.09365, lng:27.64968, border:[[54.0991,27.6387],[54.0991,27.6587],[54.0873,27.6587],[54.0873,27.64487],[54.0919,27.6432],[54.09322,27.6387]] },
    { fi:16, lat:54.0932, lng:27.6687, border:[[54.0991,27.6587],[54.0991,27.6787],[54.0873,27.6787],[54.0873,27.6587]] },
    { fi:16, lat:54.0932, lng:27.6887, border:[[54.0991,27.6787],[54.0991,27.6987],[54.0873,27.6987],[54.0873,27.6787]] },
    { fi:16, lat:54.09298, lng:27.70809, border:[[54.0873,27.7187],[54.0873,27.6987],[54.0991,27.6987],[54.0991,27.71487],[54.0911,27.7187]] },
    { fi:16, lat:54.08861, lng:27.72654, border:[[54.0873,27.7387],[54.0873,27.7187],[54.0911,27.7187],[54.08811,27.7387]] },
    { fi:16, lat:54.08757, lng:27.74051, border:[[54.0873,27.7387],[54.08811,27.7387],[54.0873,27.74414]] },
    { fi:13, lat:54.10526, lng:27.21717, border:[[54.1109,27.2187],[54.0991,27.2187],[54.0991,27.21606],[54.1109,27.21525]] },
    { fi:13, lat:54.105, lng:27.2287, border:[[54.1109,27.2187],[54.1109,27.2387],[54.0991,27.2387],[54.0991,27.2187]] },
    { fi:13, lat:54.105, lng:27.2487, border:[[54.1109,27.2387],[54.1109,27.2587],[54.0991,27.2587],[54.0991,27.2387]] },
    { fi:13, lat:54.105, lng:27.2687, border:[[54.1109,27.2587],[54.1109,27.2787],[54.0991,27.2787],[54.0991,27.2587]] },
    { fi:13, lat:54.105, lng:27.2887, border:[[54.1109,27.2787],[54.1109,27.2987],[54.0991,27.2987],[54.0991,27.2787]] },
    { fi:13, lat:54.105, lng:27.3087, border:[[54.1109,27.2987],[54.1109,27.3187],[54.0991,27.3187],[54.0991,27.2987]] },
    { fi:13, lat:54.105, lng:27.3287, border:[[54.1109,27.3187],[54.1109,27.3387],[54.0991,27.3387],[54.0991,27.3187]] },
    { fi:14, lat:54.105, lng:27.3487, border:[[54.1109,27.3387],[54.1109,27.3587],[54.0991,27.3587],[54.0991,27.3387]] },
    { fi:14, lat:54.105, lng:27.3687, border:[[54.1109,27.3587],[54.1109,27.3787],[54.0991,27.3787],[54.0991,27.3587]] },
    { fi:14, lat:54.105, lng:27.3887, border:[[54.1109,27.3787],[54.1109,27.3987],[54.0991,27.3987],[54.0991,27.3787]] },
    { fi:14, lat:54.105, lng:27.4087, border:[[54.1109,27.3987],[54.1109,27.4187],[54.0991,27.4187],[54.0991,27.3987]] },
    { fi:14, lat:54.105, lng:27.4287, border:[[54.1109,27.4187],[54.1109,27.4387],[54.0991,27.4387],[54.0991,27.4187]] },
    { fi:14, lat:54.105, lng:27.4487, border:[[54.1109,27.4387],[54.1109,27.4587],[54.0991,27.4587],[54.0991,27.4387]] },
    { fi:14, lat:54.105, lng:27.4687, border:[[54.1109,27.4587],[54.1109,27.4787],[54.0991,27.4787],[54.0991,27.4587]] },
    { fi:14, lat:54.105, lng:27.4887, border:[[54.1109,27.4787],[54.1109,27.4987],[54.0991,27.4987],[54.0991,27.4787]] },
    { fi:15, lat:54.105, lng:27.5087, border:[[54.1109,27.4987],[54.1109,27.5187],[54.0991,27.5187],[54.0991,27.4987]] },
    { fi:15, lat:54.105, lng:27.5287, border:[[54.1109,27.5187],[54.1109,27.5387],[54.0991,27.5387],[54.0991,27.5187]] },
    { fi:15, lat:54.105, lng:27.5487, border:[[54.1109,27.5387],[54.1109,27.5587],[54.0991,27.5587],[54.0991,27.5387]] },
    { fi:15, lat:54.10547, lng:27.56118, border:[[54.0991,27.5587],[54.1109,27.5587],[54.1109,27.56534],[54.102,27.5617],[54.0991,27.56469]] },
    { fi:15, lat:54.10237, lng:27.61433, border:[[54.0991,27.6187],[54.0991,27.61859],[54.1029,27.6056],[54.10515,27.6187]] },
    { fi:15, lat:54.10305, lng:27.62944, border:[[54.0991,27.6387],[54.0991,27.6187],[54.10515,27.6187],[54.1086,27.6387]] },
    { fi:15, lat:54.10464, lng:27.64909, border:[[54.1109,27.6587],[54.0991,27.6587],[54.0991,27.6387],[54.1086,27.6387],[54.1109,27.6521]] },
    { fi:16, lat:54.105, lng:27.6687, border:[[54.1109,27.6587],[54.1109,27.6787],[54.0991,27.6787],[54.0991,27.6587]] },
    { fi:16, lat:54.105, lng:27.6887, border:[[54.1109,27.6787],[54.1109,27.6987],[54.0991,27.6987],[54.0991,27.6787]] },
    { fi:16, lat:54.10458, lng:27.70547, border:[[54.0991,27.6987],[54.1109,27.6987],[54.1109,27.70923],[54.0991,27.71487]] },
    { fi:19, lat:54.11701, lng:27.21676, border:[[54.1227,27.2187],[54.1109,27.2187],[54.1109,27.21525],[54.1227,27.21443]] },
    { fi:19, lat:54.1168, lng:27.2287, border:[[54.1227,27.2187],[54.1227,27.2387],[54.1109,27.2387],[54.1109,27.2187]] },
    { fi:19, lat:54.1168, lng:27.2487, border:[[54.1227,27.2387],[54.1227,27.2587],[54.1109,27.2587],[54.1109,27.2387]] },
    { fi:19, lat:54.1168, lng:27.2687, border:[[54.1227,27.2587],[54.1227,27.2787],[54.1109,27.2787],[54.1109,27.2587]] },
    { fi:19, lat:54.1168, lng:27.2887, border:[[54.1227,27.2787],[54.1227,27.2987],[54.1109,27.2987],[54.1109,27.2787]] },
    { fi:19, lat:54.1168, lng:27.3087, border:[[54.1227,27.2987],[54.1227,27.3187],[54.1109,27.3187],[54.1109,27.2987]] },
    { fi:19, lat:54.1168, lng:27.3287, border:[[54.1227,27.3187],[54.1227,27.3387],[54.1109,27.3387],[54.1109,27.3187]] },
    { fi:20, lat:54.1168, lng:27.3487, border:[[54.1227,27.3387],[54.1227,27.3587],[54.1109,27.3587],[54.1109,27.3387]] },
    { fi:20, lat:54.1168, lng:27.3687, border:[[54.1227,27.3587],[54.1227,27.3787],[54.1109,27.3787],[54.1109,27.3587]] },
    { fi:20, lat:54.1168, lng:27.3887, border:[[54.1227,27.3787],[54.1227,27.3987],[54.1109,27.3987],[54.1109,27.3787]] },
    { fi:20, lat:54.1168, lng:27.4087, border:[[54.1227,27.3987],[54.1227,27.4187],[54.1109,27.4187],[54.1109,27.3987]] },
    { fi:20, lat:54.1168, lng:27.4287, border:[[54.1227,27.4187],[54.1227,27.4387],[54.1109,27.4387],[54.1109,27.4187]] },
    { fi:20, lat:54.1168, lng:27.4487, border:[[54.1227,27.4387],[54.1227,27.4587],[54.1109,27.4587],[54.1109,27.4387]] },
    { fi:20, lat:54.1168, lng:27.4687, border:[[54.1227,27.4587],[54.1227,27.4787],[54.1109,27.4787],[54.1109,27.4587]] },
    { fi:20, lat:54.1168, lng:27.4887, border:[[54.1227,27.4787],[54.1227,27.4987],[54.1109,27.4987],[54.1109,27.4787]] },
    { fi:21, lat:54.1168, lng:27.5087, border:[[54.1227,27.4987],[54.1227,27.5187],[54.1109,27.5187],[54.1109,27.4987]] },
    { fi:21, lat:54.1168, lng:27.5287, border:[[54.1227,27.5187],[54.1227,27.5387],[54.1109,27.5387],[54.1109,27.5187]] },
    { fi:21, lat:54.1168, lng:27.5487, border:[[54.1227,27.5387],[54.1227,27.5587],[54.1109,27.5587],[54.1109,27.5387]] },
    { fi:21, lat:54.11731, lng:27.56331, border:[[54.1109,27.5587],[54.1227,27.5587],[54.1227,27.56933],[54.1218,27.5698],[54.1109,27.56534]] },
    { fi:21, lat:54.11128, lng:27.6565, border:[[54.1109,27.6587],[54.1109,27.6521],[54.11204,27.6587]] },
    { fi:22, lat:54.1124, lng:27.67044, border:[[54.1109,27.6787],[54.1109,27.6587],[54.11204,27.6587],[54.1146,27.6736],[54.11456,27.6787]] },
    { fi:22, lat:54.11268, lng:27.68862, border:[[54.1109,27.6987],[54.1109,27.6787],[54.11456,27.6787],[54.11438,27.6987]] },
    { fi:22, lat:54.11257, lng:27.70355, border:[[54.1109,27.6987],[54.11438,27.6987],[54.1143,27.7076],[54.1109,27.70923]] },
    { fi:19, lat:54.12877, lng:27.21635, border:[[54.1345,27.2187],[54.1227,27.2187],[54.1227,27.21443],[54.1345,27.21361]] },
    { fi:19, lat:54.1286, lng:27.2287, border:[[54.1345,27.2187],[54.1345,27.2387],[54.1227,27.2387],[54.1227,27.2187]] },
    { fi:19, lat:54.1286, lng:27.2487, border:[[54.1345,27.2387],[54.1345,27.2587],[54.1227,27.2587],[54.1227,27.2387]] },
    { fi:19, lat:54.1286, lng:27.2687, border:[[54.1345,27.2587],[54.1345,27.2787],[54.1227,27.2787],[54.1227,27.2587]] },
    { fi:19, lat:54.1286, lng:27.2887, border:[[54.1345,27.2787],[54.1345,27.2987],[54.1227,27.2987],[54.1227,27.2787]] },
    { fi:19, lat:54.1286, lng:27.3087, border:[[54.1345,27.2987],[54.1345,27.3187],[54.1227,27.3187],[54.1227,27.2987]] },
    { fi:19, lat:54.1286, lng:27.3287, border:[[54.1345,27.3187],[54.1345,27.3387],[54.1227,27.3387],[54.1227,27.3187]] },
    { fi:20, lat:54.1286, lng:27.3487, border:[[54.1345,27.3387],[54.1345,27.3587],[54.1227,27.3587],[54.1227,27.3387]] },
    { fi:20, lat:54.1286, lng:27.3687, border:[[54.1345,27.3587],[54.1345,27.3787],[54.1227,27.3787],[54.1227,27.3587]] },
    { fi:20, lat:54.1286, lng:27.3887, border:[[54.1345,27.3787],[54.1345,27.3987],[54.1227,27.3987],[54.1227,27.3787]] },
    { fi:20, lat:54.1286, lng:27.4087, border:[[54.1345,27.3987],[54.1345,27.4187],[54.1227,27.4187],[54.1227,27.3987]] },
    { fi:20, lat:54.1286, lng:27.4287, border:[[54.1345,27.4187],[54.1345,27.4387],[54.1227,27.4387],[54.1227,27.4187]] },
    { fi:20, lat:54.1286, lng:27.4487, border:[[54.1345,27.4387],[54.1345,27.4587],[54.1227,27.4587],[54.1227,27.4387]] },
    { fi:20, lat:54.1286, lng:27.4687, border:[[54.1345,27.4587],[54.1345,27.4787],[54.1227,27.4787],[54.1227,27.4587]] },
    { fi:20, lat:54.1286, lng:27.4887, border:[[54.1345,27.4787],[54.1345,27.4987],[54.1227,27.4987],[54.1227,27.4787]] },
    { fi:21, lat:54.1286, lng:27.5087, border:[[54.1345,27.4987],[54.1345,27.5187],[54.1227,27.5187],[54.1227,27.4987]] },
    { fi:21, lat:54.1286, lng:27.5287, border:[[54.1345,27.5187],[54.1345,27.5387],[54.1227,27.5387],[54.1227,27.5187]] },
    { fi:21, lat:54.1286, lng:27.5487, border:[[54.1345,27.5387],[54.1345,27.5587],[54.1227,27.5587],[54.1227,27.5387]] },
    { fi:21, lat:54.1278, lng:27.56269, border:[[54.1227,27.5587],[54.1345,27.5587],[54.1345,27.56317],[54.1227,27.56933]] },
    { fi:19, lat:54.13571, lng:27.21639, border:[[54.1345,27.2187],[54.1345,27.21361],[54.1361,27.2135],[54.13757,27.2187]] },
    { fi:19, lat:54.13767, lng:27.2303, border:[[54.1345,27.2387],[54.1345,27.2187],[54.13757,27.2187],[54.1432,27.2387]] },
    { fi:19, lat:54.14002, lng:27.24918, border:[[54.1345,27.2587],[54.1345,27.2387],[54.1432,27.2387],[54.1463,27.2497],[54.1463,27.25746],[54.14595,27.2587]] },
    { fi:19, lat:54.13896, lng:27.2676, border:[[54.1345,27.2787],[54.1345,27.2587],[54.14595,27.2587],[54.14025,27.2787]] },
    { fi:19, lat:54.13912, lng:27.29085, border:[[54.1463,27.2987],[54.1345,27.2987],[54.1345,27.2787],[54.14025,27.2787],[54.138,27.2866],[54.1463,27.29203]] },
    { fi:19, lat:54.1404, lng:27.3087, border:[[54.1463,27.2987],[54.1463,27.3187],[54.1345,27.3187],[54.1345,27.2987]] },
    { fi:19, lat:54.1404, lng:27.3287, border:[[54.1463,27.3187],[54.1463,27.3387],[54.1345,27.3387],[54.1345,27.3187]] },
    { fi:20, lat:54.1404, lng:27.3487, border:[[54.1463,27.3387],[54.1463,27.3587],[54.1345,27.3587],[54.1345,27.3387]] },
    { fi:20, lat:54.1404, lng:27.3687, border:[[54.1463,27.3587],[54.1463,27.3787],[54.1345,27.3787],[54.1345,27.3587]] },
    { fi:20, lat:54.1404, lng:27.3887, border:[[54.1463,27.3787],[54.1463,27.3987],[54.1345,27.3987],[54.1345,27.3787]] },
    { fi:20, lat:54.1404, lng:27.4087, border:[[54.1463,27.3987],[54.1463,27.4187],[54.1345,27.4187],[54.1345,27.3987]] },
    { fi:20, lat:54.1404, lng:27.4287, border:[[54.1463,27.4187],[54.1463,27.4387],[54.1345,27.4387],[54.1345,27.4187]] },
    { fi:20, lat:54.1404, lng:27.4487, border:[[54.1463,27.4387],[54.1463,27.4587],[54.1345,27.4587],[54.1345,27.4387]] },
    { fi:20, lat:54.1404, lng:27.4687, border:[[54.1463,27.4587],[54.1463,27.4787],[54.1345,27.4787],[54.1345,27.4587]] },
    { fi:20, lat:54.1404, lng:27.4887, border:[[54.1463,27.4787],[54.1463,27.4987],[54.1345,27.4987],[54.1345,27.4787]] },
    { fi:21, lat:54.1404, lng:27.5087, border:[[54.1463,27.4987],[54.1463,27.5187],[54.1345,27.5187],[54.1345,27.4987]] },
    { fi:21, lat:54.1404, lng:27.5287, border:[[54.1463,27.5187],[54.1463,27.5387],[54.1345,27.5387],[54.1345,27.5187]] },
    { fi:21, lat:54.14034, lng:27.54859, border:[[54.1345,27.5587],[54.1345,27.5387],[54.1463,27.5387],[54.1463,27.55702],[54.14308,27.5587]] },
    { fi:21, lat:54.13736, lng:27.56019, border:[[54.1345,27.5587],[54.14308,27.5587],[54.1345,27.56317]] },
    { fi:19, lat:54.14667, lng:27.25359, border:[[54.1463,27.2497],[54.1474,27.2536],[54.1463,27.25746]] },
    { fi:19, lat:54.15341, lng:27.29313, border:[[54.1581,27.2987],[54.1463,27.2987],[54.1463,27.29203],[54.1487,27.2936],[54.1581,27.2821]] },
    { fi:19, lat:54.1522, lng:27.3087, border:[[54.1581,27.2987],[54.1581,27.3187],[54.1463,27.3187],[54.1463,27.2987]] },
    { fi:19, lat:54.1522, lng:27.3287, border:[[54.1581,27.3187],[54.1581,27.3387],[54.1463,27.3387],[54.1463,27.3187]] },
    { fi:20, lat:54.1522, lng:27.3487, border:[[54.1581,27.3387],[54.1581,27.3587],[54.1463,27.3587],[54.1463,27.3387]] },
    { fi:20, lat:54.1522, lng:27.3687, border:[[54.1581,27.3587],[54.1581,27.3787],[54.1463,27.3787],[54.1463,27.3587]] },
    { fi:20, lat:54.1522, lng:27.3887, border:[[54.1581,27.3787],[54.1581,27.3987],[54.1463,27.3987],[54.1463,27.3787]] },
    { fi:20, lat:54.1522, lng:27.4087, border:[[54.1581,27.3987],[54.1581,27.4187],[54.1463,27.4187],[54.1463,27.3987]] },
    { fi:20, lat:54.1522, lng:27.4287, border:[[54.1581,27.4187],[54.1581,27.4387],[54.1463,27.4387],[54.1463,27.4187]] },
    { fi:20, lat:54.1522, lng:27.4487, border:[[54.1581,27.4387],[54.1581,27.4587],[54.1463,27.4587],[54.1463,27.4387]] },
    { fi:20, lat:54.1522, lng:27.4687, border:[[54.1581,27.4587],[54.1581,27.4787],[54.1463,27.4787],[54.1463,27.4587]] },
    { fi:20, lat:54.1522, lng:27.4887, border:[[54.1581,27.4787],[54.1581,27.4987],[54.1463,27.4987],[54.1463,27.4787]] },
    { fi:21, lat:54.1522, lng:27.5087, border:[[54.1581,27.4987],[54.1581,27.5187],[54.1463,27.5187],[54.1463,27.4987]] },
    { fi:21, lat:54.1522, lng:27.5287, border:[[54.1581,27.5187],[54.1581,27.5387],[54.1463,27.5387],[54.1463,27.5187]] },
    { fi:21, lat:54.1524, lng:27.54774, border:[[54.1463,27.5387],[54.1581,27.5387],[54.1581,27.5587],[54.15507,27.5587],[54.1517,27.5542],[54.1463,27.55702]] },
    { fi:21, lat:54.15709, lng:27.56004, border:[[54.1581,27.5587],[54.1581,27.56273],[54.15507,27.5587]] },
    { fi:19, lat:54.16461, lng:27.2771, border:[[54.16088,27.2787],[54.1648,27.2739],[54.16814,27.2787]] },
    { fi:19, lat:54.16405, lng:27.28897, border:[[54.1699,27.2987],[54.1581,27.2987],[54.1581,27.2821],[54.16088,27.2787],[54.16814,27.2787],[54.1699,27.28122]] },
    { fi:19, lat:54.164, lng:27.3087, border:[[54.1699,27.2987],[54.1699,27.3187],[54.1581,27.3187],[54.1581,27.2987]] },
    { fi:19, lat:54.164, lng:27.3287, border:[[54.1699,27.3187],[54.1699,27.3387],[54.1581,27.3387],[54.1581,27.3187]] },
    { fi:20, lat:54.164, lng:27.3487, border:[[54.1699,27.3387],[54.1699,27.3587],[54.1581,27.3587],[54.1581,27.3387]] },
    { fi:20, lat:54.164, lng:27.3687, border:[[54.1699,27.3587],[54.1699,27.3787],[54.1581,27.3787],[54.1581,27.3587]] },
    { fi:20, lat:54.164, lng:27.3887, border:[[54.1699,27.3787],[54.1699,27.3987],[54.1581,27.3987],[54.1581,27.3787]] },
    { fi:20, lat:54.164, lng:27.4087, border:[[54.1699,27.3987],[54.1699,27.4187],[54.1581,27.4187],[54.1581,27.3987]] },
    { fi:20, lat:54.164, lng:27.4287, border:[[54.1699,27.4187],[54.1699,27.4387],[54.1581,27.4387],[54.1581,27.4187]] },
    { fi:20, lat:54.164, lng:27.4487, border:[[54.1699,27.4387],[54.1699,27.4587],[54.1581,27.4587],[54.1581,27.4387]] },
    { fi:20, lat:54.164, lng:27.4687, border:[[54.1699,27.4587],[54.1699,27.4787],[54.1581,27.4787],[54.1581,27.4587]] },
    { fi:20, lat:54.164, lng:27.4887, border:[[54.1699,27.4787],[54.1699,27.4987],[54.1581,27.4987],[54.1581,27.4787]] },
    { fi:21, lat:54.164, lng:27.5087, border:[[54.1699,27.4987],[54.1699,27.5187],[54.1581,27.5187],[54.1581,27.4987]] },
    { fi:21, lat:54.164, lng:27.5287, border:[[54.1699,27.5187],[54.1699,27.5387],[54.1581,27.5387],[54.1581,27.5187]] },
    { fi:21, lat:54.164, lng:27.5487, border:[[54.1699,27.5387],[54.1699,27.5587],[54.1581,27.5587],[54.1581,27.5387]] },
    { fi:21, lat:54.1653, lng:27.56552, border:[[54.1581,27.5587],[54.1699,27.5587],[54.1699,27.57847],[54.1581,27.56273]] },
    { fi:19, lat:54.17395, lng:27.29287, border:[[54.1817,27.2987],[54.1699,27.2987],[54.1699,27.28122],[54.1817,27.29816]] },
    { fi:19, lat:54.1758, lng:27.3087, border:[[54.1817,27.2987],[54.1817,27.3187],[54.1699,27.3187],[54.1699,27.2987]] },
    { fi:19, lat:54.1758, lng:27.3287, border:[[54.1817,27.3187],[54.1817,27.3387],[54.1699,27.3387],[54.1699,27.3187]] },
    { fi:20, lat:54.1758, lng:27.3487, border:[[54.1817,27.3387],[54.1817,27.3587],[54.1699,27.3587],[54.1699,27.3387]] },
    { fi:20, lat:54.1758, lng:27.3687, border:[[54.1817,27.3587],[54.1817,27.3787],[54.1699,27.3787],[54.1699,27.3587]] },
    { fi:20, lat:54.1758, lng:27.3887, border:[[54.1817,27.3787],[54.1817,27.3987],[54.1699,27.3987],[54.1699,27.3787]] },
    { fi:20, lat:54.1758, lng:27.4087, border:[[54.1817,27.3987],[54.1817,27.4187],[54.1699,27.4187],[54.1699,27.3987]] },
    { fi:20, lat:54.1758, lng:27.4287, border:[[54.1817,27.4187],[54.1817,27.4387],[54.1699,27.4387],[54.1699,27.4187]] },
    { fi:20, lat:54.1758, lng:27.4487, border:[[54.1817,27.4387],[54.1817,27.4587],[54.1699,27.4587],[54.1699,27.4387]] },
    { fi:20, lat:54.1758, lng:27.4687, border:[[54.1817,27.4587],[54.1817,27.4787],[54.1699,27.4787],[54.1699,27.4587]] },
    { fi:20, lat:54.1758, lng:27.4887, border:[[54.1817,27.4787],[54.1817,27.4987],[54.1699,27.4987],[54.1699,27.4787]] },
    { fi:21, lat:54.1758, lng:27.5087, border:[[54.1817,27.4987],[54.1817,27.5187],[54.1699,27.5187],[54.1699,27.4987]] },
    { fi:21, lat:54.1758, lng:27.5287, border:[[54.1817,27.5187],[54.1817,27.5387],[54.1699,27.5387],[54.1699,27.5187]] },
    { fi:21, lat:54.1758, lng:27.5487, border:[[54.1817,27.5387],[54.1817,27.5587],[54.1699,27.5587],[54.1699,27.5387]] },
    { fi:21, lat:54.1758, lng:27.56869, border:[[54.1699,27.5587],[54.1817,27.5587],[54.1817,27.57827],[54.1811,27.5787],[54.17007,27.5787],[54.1699,27.57847]] },
    { fi:21, lat:54.17502, lng:27.5804, border:[[54.1811,27.5787],[54.1739,27.5838],[54.17007,27.5787]] },
    { fi:19, lat:54.18718, lng:27.31113, border:[[54.1935,27.3187],[54.1817,27.3187],[54.1817,27.2987],[54.18208,27.2987],[54.1873,27.3062],[54.1935,27.30477]] },
    { fi:19, lat:54.1876, lng:27.3287, border:[[54.1935,27.3187],[54.1935,27.3387],[54.1817,27.3387],[54.1817,27.3187]] },
    { fi:20, lat:54.1876, lng:27.3487, border:[[54.1935,27.3387],[54.1935,27.3587],[54.1817,27.3587],[54.1817,27.3387]] },
    { fi:20, lat:54.1876, lng:27.3687, border:[[54.1935,27.3587],[54.1935,27.3787],[54.1817,27.3787],[54.1817,27.3587]] },
    { fi:20, lat:54.1876, lng:27.3887, border:[[54.1935,27.3787],[54.1935,27.3987],[54.1817,27.3987],[54.1817,27.3787]] },
    { fi:20, lat:54.1876, lng:27.4087, border:[[54.1935,27.3987],[54.1935,27.4187],[54.1817,27.4187],[54.1817,27.3987]] },
    { fi:20, lat:54.1876, lng:27.4287, border:[[54.1935,27.4187],[54.1935,27.4387],[54.1817,27.4387],[54.1817,27.4187]] },
    { fi:20, lat:54.1876, lng:27.4487, border:[[54.1935,27.4387],[54.1935,27.4587],[54.1817,27.4587],[54.1817,27.4387]] },
    { fi:20, lat:54.1876, lng:27.4687, border:[[54.1935,27.4587],[54.1935,27.4787],[54.1817,27.4787],[54.1817,27.4587]] },
    { fi:20, lat:54.18744, lng:27.48845, border:[[54.1817,27.4987],[54.1817,27.4787],[54.1935,27.4787],[54.1935,27.49292],[54.19103,27.4987]] },
    { fi:21, lat:54.18577, lng:27.50882, border:[[54.1817,27.5187],[54.1817,27.4987],[54.19103,27.4987],[54.1889,27.5037],[54.1906,27.5187]] },
    { fi:21, lat:54.18674, lng:27.52908, border:[[54.1817,27.5387],[54.1817,27.5187],[54.1906,27.5187],[54.19287,27.5387]] },
    { fi:21, lat:54.18756, lng:27.54876, border:[[54.1935,27.5587],[54.1817,27.5587],[54.1817,27.5387],[54.19287,27.5387],[54.1935,27.54422]] },
    { fi:21, lat:54.18707, lng:27.56659, border:[[54.1817,27.5587],[54.1935,27.5587],[54.1935,27.56991],[54.1817,27.57827]] },
    { fi:19, lat:54.19958, lng:27.31103, border:[[54.2053,27.3187],[54.1935,27.3187],[54.1935,27.30477],[54.2053,27.30205]] },
    { fi:19, lat:54.1994, lng:27.3287, border:[[54.2053,27.3187],[54.2053,27.3387],[54.1935,27.3387],[54.1935,27.3187]] },
    { fi:20, lat:54.1994, lng:27.3487, border:[[54.2053,27.3387],[54.2053,27.3587],[54.1935,27.3587],[54.1935,27.3387]] },
    { fi:20, lat:54.1994, lng:27.3687, border:[[54.2053,27.3587],[54.2053,27.3787],[54.1935,27.3787],[54.1935,27.3587]] },
    { fi:20, lat:54.1994, lng:27.3887, border:[[54.2053,27.3787],[54.2053,27.3987],[54.1935,27.3987],[54.1935,27.3787]] },
    { fi:20, lat:54.1994, lng:27.4087, border:[[54.2053,27.3987],[54.2053,27.4187],[54.1935,27.4187],[54.1935,27.3987]] },
    { fi:20, lat:54.1994, lng:27.4287, border:[[54.2053,27.4187],[54.2053,27.4387],[54.1935,27.4387],[54.1935,27.4187]] },
    { fi:20, lat:54.1994, lng:27.4487, border:[[54.2053,27.4387],[54.2053,27.4587],[54.1935,27.4587],[54.1935,27.4387]] },
    { fi:20, lat:54.19862, lng:27.46762, border:[[54.1935,27.4787],[54.1935,27.4587],[54.2053,27.4587],[54.2053,27.46527],[54.19957,27.4787]] },
    { fi:20, lat:54.19552, lng:27.48344, border:[[54.1935,27.4787],[54.19957,27.4787],[54.1935,27.49292]] },
    { fi:21, lat:54.19405, lng:27.55387, border:[[54.1935,27.5587],[54.1935,27.54422],[54.19514,27.5587]] },
    { fi:21, lat:54.19458, lng:27.56428, border:[[54.1935,27.5587],[54.19514,27.5587],[54.1962,27.568],[54.1935,27.56991]] },
    { fi:19, lat:54.21004, lng:27.31186, border:[[54.2171,27.3187],[54.2053,27.3187],[54.2053,27.30205],[54.2081,27.3014],[54.2171,27.31458]] },
    { fi:19, lat:54.2112, lng:27.3287, border:[[54.2171,27.3187],[54.2171,27.3387],[54.2053,27.3387],[54.2053,27.3187]] },
    { fi:20, lat:54.2112, lng:27.3487, border:[[54.2171,27.3387],[54.2171,27.3587],[54.2053,27.3587],[54.2053,27.3387]] },
    { fi:20, lat:54.2112, lng:27.3687, border:[[54.2171,27.3587],[54.2171,27.3787],[54.2053,27.3787],[54.2053,27.3587]] },
    { fi:20, lat:54.2112, lng:27.3887, border:[[54.2171,27.3787],[54.2171,27.3987],[54.2053,27.3987],[54.2053,27.3787]] },
    { fi:20, lat:54.2112, lng:27.4087, border:[[54.2171,27.3987],[54.2171,27.4187],[54.2053,27.4187],[54.2053,27.3987]] },
    { fi:20, lat:54.2112, lng:27.4287, border:[[54.2171,27.4187],[54.2171,27.4387],[54.2053,27.4387],[54.2053,27.4187]] },
    { fi:20, lat:54.2101, lng:27.44639, border:[[54.2053,27.4587],[54.2053,27.4387],[54.2171,27.4387],[54.2171,27.44766],[54.2128,27.4477],[54.20811,27.4587]] },
    { fi:20, lat:54.20624, lng:27.46089, border:[[54.2053,27.4587],[54.20811,27.4587],[54.2053,27.46527]] },
    { fi:19, lat:54.21804, lng:27.31733, border:[[54.2171,27.3187],[54.2171,27.31458],[54.21992,27.3187]] },
    { fi:19, lat:54.22203, lng:27.33058, border:[[54.2289,27.3387],[54.2171,27.3387],[54.2171,27.3187],[54.21992,27.3187],[54.2289,27.33185]] },
    { fi:20, lat:54.223, lng:27.3487, border:[[54.2289,27.3387],[54.2289,27.3587],[54.2171,27.3587],[54.2171,27.3387]] },
    { fi:20, lat:54.223, lng:27.3687, border:[[54.2289,27.3587],[54.2289,27.3787],[54.2171,27.3787],[54.2171,27.3587]] },
    { fi:20, lat:54.223, lng:27.3887, border:[[54.2289,27.3787],[54.2289,27.3987],[54.2171,27.3987],[54.2171,27.3787]] },
    { fi:20, lat:54.223, lng:27.4087, border:[[54.2289,27.3987],[54.2289,27.4187],[54.2171,27.4187],[54.2171,27.3987]] },
    { fi:20, lat:54.223, lng:27.4287, border:[[54.2289,27.4187],[54.2289,27.4387],[54.2171,27.4387],[54.2171,27.4187]] },
    { fi:20, lat:54.22299, lng:27.44315, border:[[54.2171,27.4387],[54.2289,27.4387],[54.2289,27.44755],[54.2171,27.44766]] },
    { fi:19, lat:54.2333, lng:27.33702, border:[[54.2407,27.3387],[54.2289,27.3387],[54.2289,27.33185],[54.2331,27.338],[54.2407,27.33658]] },
    { fi:20, lat:54.23419, lng:27.34799, border:[[54.2289,27.3587],[54.2289,27.3387],[54.2407,27.3387],[54.2407,27.3466],[54.236,27.3556],[54.24019,27.3587]] },
    { fi:20, lat:54.2348, lng:27.3687, border:[[54.2407,27.3787],[54.2289,27.3787],[54.2289,27.3587],[54.24019,27.3587],[54.2407,27.35908]] },
    { fi:20, lat:54.2348, lng:27.3887, border:[[54.2407,27.3787],[54.2407,27.3987],[54.2289,27.3987],[54.2289,27.3787]] },
    { fi:20, lat:54.2348, lng:27.4087, border:[[54.2407,27.3987],[54.2407,27.4187],[54.2289,27.4187],[54.2289,27.3987]] },
    { fi:20, lat:54.23431, lng:27.42787, border:[[54.2289,27.4387],[54.2289,27.4187],[54.2407,27.4187],[54.2407,27.43225],[54.2379,27.4311],[54.23623,27.4387]] },
    { fi:20, lat:54.2321, lng:27.44289, border:[[54.2289,27.4387],[54.23623,27.4387],[54.2343,27.4475],[54.2289,27.44755]] },
    { fi:19, lat:54.24335, lng:27.33729, border:[[54.2407,27.3387],[54.2407,27.33658],[54.2465,27.3355],[54.24483,27.3387]] },
    { fi:20, lat:54.24208, lng:27.34133, border:[[54.2407,27.3387],[54.24483,27.3387],[54.2407,27.3466]] },
    { fi:20, lat:54.24594, lng:27.37087, border:[[54.2525,27.3787],[54.2407,27.3787],[54.2407,27.35908],[54.2518,27.3673],[54.2525,27.37581]] },
    { fi:20, lat:54.2466, lng:27.3887, border:[[54.2525,27.3787],[54.2525,27.3987],[54.2407,27.3987],[54.2407,27.3787]] },
    { fi:20, lat:54.2466, lng:27.4087, border:[[54.2525,27.3987],[54.2525,27.4187],[54.2407,27.4187],[54.2407,27.3987]] },
    { fi:20, lat:54.2469, lng:27.42675, border:[[54.2407,27.4187],[54.2525,27.4187],[54.2525,27.43712],[54.2407,27.43225]] },
    { fi:20, lat:54.25314, lng:27.39129, border:[[54.2525,27.3987],[54.2525,27.3787],[54.25274,27.3787],[54.25438,27.3987]] },
    { fi:20, lat:54.25369, lng:27.40897, border:[[54.2525,27.4187],[54.2525,27.3987],[54.25438,27.3987],[54.2551,27.4074],[54.25484,27.4187]] },
    { fi:20, lat:54.25357, lng:27.42779, border:[[54.2525,27.4187],[54.25484,27.4187],[54.2544,27.4379],[54.2525,27.43712]] },
  ];
  var WX_LABELS = [
    { fi:3, lat:53.66142, lng:27.54348 },
    { fi:2, lat:53.73006, lng:27.42686 },
    { fi:3, lat:53.73006, lng:27.54348 },
    { fi:4, lat:53.73006, lng:27.6601 },
    { fi:8, lat:53.79871, lng:27.42686 },
    { fi:9, lat:53.79871, lng:27.54348 },
    { fi:10, lat:53.79871, lng:27.6601 },
    { fi:10, lat:53.79871, lng:27.77671 },
    { fi:11, lat:53.79871, lng:27.89333 },
    { fi:7, lat:53.86735, lng:27.31024 },
    { fi:8, lat:53.86735, lng:27.42686 },
    { fi:9, lat:53.86735, lng:27.54348 },
    { fi:10, lat:53.86735, lng:27.6601 },
    { fi:10, lat:53.86735, lng:27.77671 },
    { fi:6, lat:53.93599, lng:27.07701 },
    { fi:7, lat:53.93599, lng:27.19363 },
    { fi:7, lat:53.93599, lng:27.31024 },
    { fi:8, lat:53.93599, lng:27.42686 },
    { fi:9, lat:53.93599, lng:27.54348 },
    { fi:10, lat:53.93599, lng:27.6601 },
    { fi:10, lat:53.93599, lng:27.77671 },
    { fi:11, lat:53.93599, lng:27.89333 },
    { fi:13, lat:54.00464, lng:27.19363 },
    { fi:13, lat:54.00464, lng:27.31024 },
    { fi:14, lat:54.00464, lng:27.42686 },
    { fi:15, lat:54.00464, lng:27.54348 },
    { fi:16, lat:54.00464, lng:27.6601 },
    { fi:16, lat:54.00464, lng:27.77671 },
    { fi:13, lat:54.07328, lng:27.19363 },
    { fi:13, lat:54.07328, lng:27.31024 },
    { fi:14, lat:54.07328, lng:27.42686 },
    { fi:15, lat:54.07328, lng:27.54348 },
    { fi:16, lat:54.07328, lng:27.6601 },
    { fi:16, lat:54.07328, lng:27.77671 },
    { fi:19, lat:54.14192, lng:27.31024 },
    { fi:20, lat:54.14192, lng:27.42686 },
    { fi:21, lat:54.14192, lng:27.54348 },
    { fi:19, lat:54.21056, lng:27.31024 },
    { fi:20, lat:54.21056, lng:27.42686 },
  ];
  var WX_FETCH = [[53.7071,27.0987],[53.7071,27.2587],[53.7071,27.4187],[53.7071,27.5787],[53.7071,27.7387],[53.7071,27.8987],[53.8671,27.0987],[53.8671,27.2587],[53.8671,27.4187],[53.8671,27.5787],[53.8671,27.7387],[53.8671,27.8987],[54.0271,27.0987],[54.0271,27.2587],[54.0271,27.4187],[54.0271,27.5787],[54.0271,27.7387],[54.0271,27.8987],[54.1871,27.0987],[54.1871,27.2587],[54.1871,27.4187],[54.1871,27.5787],[54.1871,27.7387],[54.1871,27.8987]];
  var WX_LAYERS = [
    { id:'temp',     name:'Температура', ic:'🌡', col:'#f59e0b' },
    { id:'rain',     name:'Дождь',       ic:'🌧', col:'#38bdf8' },
    { id:'snow',     name:'Снег',        ic:'❄', col:'#7dd3fc' },
    { id:'wind',     name:'Ветер',       ic:'💨', col:'#a78bfa' }
  ];

  function renderDashboard() {
    // Для админа: фильтр по участку (null = все участки)
    var dashFilterArea = S.dashArea;
    var dashCanFilter = (S.role === 'admin' || S.role === 'nach' || S.role === 'viewer'); // включая начальника СЭОГС
    function dashMastersAll() {
      // Админ, начальник участка и начальник СЭОГС на дашборде видят ВСЕ участки (с возможностью выбора); прочие — свой
      var all = dashCanFilter ? getMasters() : visibleMasters();
      if (dashCanFilter && dashFilterArea) return all.filter(function (m) { return m.area === dashFilterArea; });
      return all;
    }
    // 22.09-193: если выбранный в «КПД мастеров» мастер выпал из списка (сменили участок) — выбор сбрасывается
    if (S.dashMaster && !dashMastersAll().some(function (m) { return String(m.id) === String(S.dashMaster); })) S.dashMaster = null;
    function dashMasters() {
      var all = dashMastersAll();
      if (S.dashMaster) all = all.filter(function (m) { return String(m.id) === String(S.dashMaster); }); // 22.09-193: один мастер
      return all;
    }
    function dashTasks() {
      var dm = dashMasters(); var ids = {};
      dm.forEach(function (m) { ids[m.id] = 1; });
      return S.tasks.filter(function (t) { return ids[t.m]; });
    }

    var vt = dashTasks();
    var today = vt.filter(function (t) { return t.d === 0; });
    var redzone = vt.filter(function (t) { return !isDone(t) && (t.dl <= 2 || t.d < 0); }).sort(function (a, b) { return a.dl - b.dl; });

    var mastersToday = dashMasters();
    var overloads = mastersToday.filter(function (m) { return loadForDay(m.id, 0) > masterCapacity(m.id, 0); }).length;
    var doneMonth = 0, totalMonth = 0;
    vt.forEach(function (t) {
      var d = offToDate(t.d);
      if (d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()) { totalMonth++; if (isDone(t)) doneMonth++; }
    });
    var pct = totalMonth ? Math.round(doneMonth / totalMonth * 100) : 0;

    var areas = {};
    vt.forEach(function (t) {
      var d = offToDate(t.d);
      if (d.getMonth() !== TODAY.getMonth() || d.getFullYear() !== TODAY.getFullYear()) return;
      var m = masterById(t.m); if (!m) return;
      areas[m.area] = areas[m.area] || { done: 0, total: 0 };
      areas[m.area].total++; if (isDone(t)) areas[m.area].done++;
    });

    var html = '';

    // === Селектор участка для админа, начальника участка и начальника СЭОГС ===
    if (dashCanFilter) {
      html += '<div data-dw="filter" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'; // 22.09-269: метка виджета
      html += '<label style="font-size:12px;font-weight:600;color:var(--muted)">Участок:</label>';
      html += '<select id="dash-area" style="padding:8px 12px;border:1px solid var(--line);border-radius:9px;font-size:13px;font-family:inherit;background:var(--card)">';
      html += '<option value=""' + (!dashFilterArea ? ' selected' : '') + '>Все участки</option>';
      var _dashAreas = areasList();
      _dashAreas.forEach(function (a) { html += '<option value="' + esc(a) + '"' + (dashFilterArea === a ? ' selected' : '') + '>' + esc(a) + '</option>'; });
      html += '</select>';
      if (dashFilterArea) {
        html += '<button class="btn sm" data-action="dash-area-clear">Сбросить</button>';
      }
      html += '</div>';
    }

    // 22.09-193: право выбирать мастера для просмотра КПД — админ, начальник СЭОГС, начальник участка, старший мастер.
    // 22.09-199: сам выпадающий список перенесён с верха страницы в заголовок карточки «⚡ КПД мастеров» (см. _dashJoin ниже)
    var dashCanPickMaster = (S.role === 'admin' || S.role === 'viewer' || S.role === 'nach' || S.role === 'smaster');

    html += '<div class="kpi-row" data-dw="kpi">'; // 22.09-269: метка виджета
    html += kpi(today.length, 'Задач на сегодня', 'по ' + mastersToday.filter(function (m) { return today.some(function (t) { return String(t.m) === String(m.id); }); }).length + ' мастера(ам)', '#2563eb', 'kpi-today'); // 22.09-187: мастера без задач сегодня не считаем
    html += kpi(overloads, 'Перегрузок сегодня', 'превышение фонда рабочего времени', '#dc2626', 'kpi-overloads');
    html += kpi(pct + '%', 'Выполнено за месяц', doneMonth + ' из ' + totalMonth + ' работ', '#16a34a', 'kpi-month');
    // KPI УБиРОГС
    var permitCount = vt.filter(function(t) { return t.needs_permit && !isDone(t); }).length;
    var weatherCount = vt.filter(function(t) { var w = workOf(t); var wf = getWeatherForecast(t.d); return w && w.min_temp > -50 && wf && wf.temp != null && wf.temp < w.min_temp; }).length;
    html += kpi(permitCount, 'Ордеров истекает', 'работы с разрешениями', '#f59e0b', 'kpi-permits');
    // 22.09-171: «Красная зона» — пятая кнопка в ряду KPI (как прочие — по нажатию список задач зоны)
    html += kpi(redzone.length, 'Красная зона', 'предельный срок ≤ 2 дн', '#dc2626', 'kpi-redzone');
    html += '</div>';

    // Оповещения УБиРОГС
    if (permitCount > 0) {
      html += '<div class="permit-warn" data-dw="warn">📋 <b>Внимание:</b> ' + permitCount + ' задач с действующими ордерами. Проверьте сроки истечения разрешений в разделе «Отчёты».</div>';
    }
    if (weatherCount > 0) {
      html += '<div class="weather-warn" data-dw="warn">🌡️ <b>Погодные ограничения:</b> ' + weatherCount + ' задач не могут быть выполнены из-за несоответствия температуры.</div>';
    }
    // Информация о погоде из прогноза
    var todayWeather = getWeatherForecast(0);
    if (!todayWeather) {
      todayWeather = { temp: '—', desc: 'Загрузка...', snow: false, snowfall: 0 };
    }
    var snowExpected = '';
    for (var off = 1; off <= 7; off++) {
      var wf = getWeatherForecast(off);
      if (wf && wf.snow && wf.snowfall > 0.1) {
        snowExpected = ' · ❄️ Снег ожидается ' + fmtShort(off) + ' (' + wf.snowfall + ' мм)';
        break;
      }
    }
    var wIcon = todayWeather.snow ? '❄️' : todayWeather.desc.indexOf('Дождь') !== -1 || todayWeather.desc.indexOf('Морось') !== -1 ? '🌧️' : todayWeather.desc === 'Ясно' ? '☀️' : '⛅';
    var _wx = weatherSceneHTML(todayWeather, { hour: new Date().getHours(), leftFade: true });
    html += '<div data-dw="weather" data-action="open-weather" style="margin-bottom:0;padding:14px 18px;min-height:68px;background:#1e3a5f;color:#fff;border-radius:10px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:transform .2s,box-shadow .2s;position:relative;overflow:hidden;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 24px rgba(0,0,0,.3)\';" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';" title="Нажмите для просмотра прогноза на 15 дней">';
    html += _wx.html;
    html += '<span style="font-size:28px;position:relative;z-index:1;text-shadow:0 1px 5px rgba(0,0,0,.35);">' + wIcon + '</span>';
    html += '<div style="position:relative;z-index:1;text-shadow:0 1px 5px rgba(0,0,0,.35);"><div style="font-size:15px;font-weight:700;">' + todayWeather.temp + '°C · ' + todayWeather.desc + '</div>';
    html += '<div style="font-size:12px;color:#e2e8f0;">Погода: Минск · ' + fmt(TODAY) + snowExpected + '</div></div>';
    html += '<button class="wx-map-fab" data-action="open-wx-map" title="Открыть карту погоды Минска и Минской области">🗺 Карта погоды</button>';
    html += '</div>';
    // Выпадающий список при нажатии
    html += '<div id="weather-dropdown" class="weather-dropdown" data-dw="weather"></div>'; // 22.09-269: едет вместе с блоком погоды
    // Отступ перед панелью аналитики
    html += '<div style="height:16px;"></div>';

    // 22.09-173: «Панель аналитики» удалена с панели мониторинга (выбор месяца — кнопкой-календарём в «⚡ КПД мастеров»)

    // === ГРАФИКИ (SVG, без библиотек; учитывают выбранный участок — dashTasks/dashMasters) ===
    // 1) План/факт по дням текущего месяца; 2) КПД мастеров (22.09-166)
    var _dashJoin = ''; // 22.09-169: одна общая карточка «⚡ КПД мастеров + 📈 Выполнение по дням» (собирает dashCharts)
    (function dashCharts() {
      var cmy = getDashMY(); // 22.09-171: график по дням — за месяц, выбранный календариком КПД
      var dim = new Date(cmy.y, cmy.m + 1, 0).getDate();
      var plan = [], fact = [];
      for (var dd = 1; dd <= dim; dd++) {
        var dOff = dateToOff(new Date(cmy.y, cmy.m, dd));
        var dts = vt.filter(function (t) { return t.d === dOff; });
        plan.push(dts.length);
        fact.push(dts.filter(isDone).length);
      }
      var maxV = Math.max.apply(null, plan.concat(fact, [1]));
      var W = 760, H = 210, L = 30, B = 20, T = 22; // T — запас над столбиками под цифры
      var bw = (W - L - 8) / dim;
      var bars = '', grid = '', nums = '';
      // 22.09-188: график растягивается по высоте карточки (SVG с preserveAspectRatio="none"),
      // поэтому ВСЕ цифры — HTML-слой поверх SVG с %-позициями: шрифт больше не искажается
      [0, 0.5, 1].forEach(function (f) {
        var gy = T + Math.round((H - T - B) * (1 - f));
        grid += '<line x1="' + L + '" y1="' + gy + '" x2="' + (W - 4) + '" y2="' + gy + '" stroke="#64748b" stroke-opacity=".35" stroke-width="1"/>';
        nums += '<span style="position:absolute;left:0;width:' + (L - 4) + 'px;text-align:right;bottom:' + ((H - gy - 4) / H * 100).toFixed(2) + '%;font-size:11.5px;color:#94a3b8;line-height:1">' + Math.round(maxV * f) + '</span>';
      });
      for (var bi = 0; bi < dim; bi++) {
        var bx = L + bi * bw;
        var hP = Math.round((H - T - B) * plan[bi] / maxV);
        var hF = Math.round((H - T - B) * fact[bi] / maxV);
        var bwid = Math.max(1, bw - 2).toFixed(1);
        var xC = ((bx + bw / 2) / W * 100).toFixed(3);
        bars += '<rect x="' + (bx + 1).toFixed(1) + '" y="' + (H - B - hP) + '" width="' + bwid + '" height="' + Math.max(hP, 0) + '" rx="2" fill="#bfdbfe"><title>' + (bi + 1) + ' ' + MON[cmy.m] + ': план ' + plan[bi] + ' задач</title></rect>';
        if (fact[bi] > 0) bars += '<rect x="' + (bx + 1).toFixed(1) + '" y="' + (H - B - hF) + '" width="' + bwid + '" height="' + Math.max(hF, 0) + '" rx="2" fill="#16a34a"><title>' + (bi + 1) + ' ' + MON[cmy.m] + ': выполнено ' + fact[bi] + '</title></rect>';
        // цифра количества задач дня — над столбиком (только дни с задачами); HTML — не растягивается
        if (plan[bi] > 0) nums += '<span style="position:absolute;left:' + xC + '%;transform:translateX(-50%);bottom:' + ((B + hP + 5) / H * 100).toFixed(2) + '%;font-size:12px;font-weight:800;color:#1e40af;line-height:1;pointer-events:none">' + plan[bi] + '</span>';
        if ((bi + 1) % 5 === 0 || bi === 0) nums += '<span style="position:absolute;left:' + xC + '%;transform:translateX(-50%);bottom:2px;font-size:11.5px;color:#64748b;line-height:1;pointer-events:none">' + (bi + 1) + '</span>';
      }
      var svg1 = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;display:block" xmlns="http://www.w3.org/2000/svg">' + grid + bars + '</svg>';
      var chart1 = '<div style="position:relative;flex:1;min-height:190px">' + svg1 + nums + '</div>';

      /* 22.09-166: вместо «Загрузка мастеров сегодня» — карточка «⚡ КПД мастеров»
         (та же метрика, что в панели аналитики — выбранный там месяц, —
         но в светлом виде соседних блоков «Выполнение по дням»/«Сегодня») */
      var kMY = getDashMY();
      var kTasks = vt.filter(function (t) { var dd = offToDate(t.d); return dd.getMonth() === kMY.m && dd.getFullYear() === kMY.y; });
      var kWorkH = 0, kTravelMin = 0, kTravelCnt = 0;
      kTasks.forEach(function (t) {
        kWorkH += taskHours(t);
        var tmin = taskTravelMin(t);
        if (tmin <= 0) tmin = estimateTravelMin(t);   // нет расчёта маршрута — оценка по расстоянию
        if (tmin > 0) { kTravelMin += tmin; kTravelCnt++; }
      });
      var kTravelH = kTravelMin / 60;
      var kTotalH = kWorkH + kTravelH;
      var kPctObj = kTotalH > 0 ? (kWorkH / kTotalH * 100) : 0;
      var kPctRoad = kTotalH > 0 ? (kTravelH / kTotalH * 100) : 0;
      var kAvgTravel = kTravelCnt > 0 ? Math.round(kTravelMin / kTravelCnt) : 0;
      var kDec = function (x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); };
      var kpdBar = (kTotalH > 0)
        ? '<div style="display:flex;height:16px;border-radius:8px;overflow:hidden;background:#eef2f7;border:1px solid #cbd5e1">' +
          '<div style="width:' + kPctObj.toFixed(1) + '%;background:#2563eb" title="Работа на объектах: ' + kDec(kPctObj) + '%"></div>' +
          '<div style="width:' + kPctRoad.toFixed(1) + '%;background:#f59e0b" title="В пути: ' + kDec(kPctRoad) + '%"></div></div>'
        : '<div style="height:16px;border-radius:8px;background:#eef2f7;border:1px dashed #cbd5e1"></div>';
      var kpdBody =
        '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
          '<div style="text-align:center;min-width:96px"><div style="font-size:30px;font-weight:800;color:#1d4ed8;line-height:1.05">' + (kTotalH > 0 ? kDec(kPctObj) : '—') + '%</div>' +
          '<div style="font-size:12px;font-weight:600;color:var(--muted);margin-top:2px">на объектах</div></div>' +
          '<div style="flex:1;min-width:190px">' + kpdBar +
            '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:12px;font-weight:700">' +
              '<span style="color:#1d4ed8">■ Работа на объектах: ' + fmtH(kWorkH) + ' ч</span>' +
              '<span style="color:#b45309">■ В пути: ' + fmtH(kTravelH) + ' ч</span>' +
            '</div></div></div>' +
        '<div style="margin-top:10px;font-size:12.5px;color:var(--muted)">🚗 В пути за ' + esc(dashMonthLabel().toLowerCase()) + ': <b style="color:var(--ink)">' + (kTotalH > 0 ? kDec(kPctRoad) : '0') + '%</b> от всего времени (' + fmtH(kTotalH) + ' ч) · Среднее время переезда: <b style="color:var(--ink)">≈ ' + kAvgTravel + ' мин</b></div>';

      // 22.09-199: выбор мастера для просмотра КПД — прямо в заголовке этой карточки (блок справа внизу)
      // (тот же id dash-master: привязка события — в конце renderDashboard; выбор влияет на расчёт КПД ниже и весь дашборд)
      var kpdMasterSel = '';
      if (dashCanPickMaster) {
        kpdMasterSel = '<select id="dash-master" title="Показатели панели, списки KPI и блок «Сегодня» — по выбранному мастеру или по всем сразу" style="padding:5px 10px;border:1px solid var(--line);border-radius:9px;font-size:12.5px;font-weight:700;font-family:inherit;background:var(--card);color:var(--ink);max-width:230px;cursor:pointer">';
        kpdMasterSel += '<option value=""' + (!S.dashMaster ? ' selected' : '') + '>👷 Все мастера</option>';
        dashMastersAll().forEach(function (m) { kpdMasterSel += '<option value="' + esc(m.id) + '"' + (S.dashMaster && String(S.dashMaster) === String(m.id) ? ' selected' : '') + '>' + esc(m.name) + (m.area ? ' · ' + esc(m.area) : '') + '</option>'; });
        kpdMasterSel += '</select>';
      }
      // 22.09-169: «КПД мастеров» и «Выполнение по дням» — ОДНА карточка:
      // сверху метрика КПД, под ней через разделитель — график по дням
      // 22.09-171: в заголовке — календарик выбора месяца (та же кнопка, что в панели аналитики);
      // «Выполнение по дням» — за тот же выбранный месяц; график занимает всю свободную высоту карточки
      _dashJoin = '<div class="card" data-dw="charts" style="display:flex;flex-direction:column;height:100%"><div class="card-h" style="flex:none"><h2>⚡ КПД мастеров</h2><div class="spacer"></div>' + kpdMasterSel + '<button type="button" data-action="dash-month-toggle" title="Выбрать месяц для расчёта КПД и графика по дням" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-weight:700;font-family:inherit;border-radius:9px;padding:5px 12px;cursor:pointer;font-size:12.5px;white-space:nowrap">📅 ' + esc(dashMonthLabel()) + '</button></div><div class="card-b" style="flex:1;display:flex;flex-direction:column;min-height:0">' + kpdBody +
        '<div style="margin-top:14px;padding-top:11px;border-top:1px dashed var(--line);flex:1;display:flex;flex-direction:column;min-height:0">' +
          '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px;flex:none"><span style="font-size:13.5px;font-weight:800;color:var(--ink)">📈 Выполнение по дням</span><span style="font-size:12.5px;color:var(--muted);font-weight:600">' + MON_NOM[cmy.m] + ' ' + cmy.y + ' · <span style="color:#2563eb;font-weight:700">■ план</span> <span style="color:#16a34a;font-weight:700">■ выполнено</span></span></div>' +
          chart1 +
        '</div></div></div>';
    })();

    // 22.09-171: календарик выбора даты — блок показывает работы на любой выбранный день
    var dayOff = (typeof S.dashDayOff === 'number' && isFinite(S.dashDayOff)) ? Math.round(S.dashDayOff) : 0;
    var dayDate = offToDate(dayOff);
    var dayTask = vt.filter(function (t) { return t.d === dayOff; });
    var mastersDay = mastersToday.filter(function (m) { return dayTask.some(function (t) { return String(t.m) === String(m.id); }); }); // 22.09-187: только мастера С задачами; 22.09-188: id — строками
    var overloadsDay = mastersDay.filter(function (m) { return loadForDay(m.id, dayOff) > masterCapacity(m.id, dayOff); }).length;

    html += '<div class="dash-grid" data-dw="grid">'; // 22.09-269: контейнер «Сегодня + графики»
    html += '<div class="card" data-dw="today"><div class="card-h"><h2>' + (dayOff === 0 ? 'Сегодня' : esc(fmt(dayDate))) + '</h2><span class="sub" style="display:flex;align-items:center;gap:6px"><input type="date" id="dash-day-sel" value="' + key(dayDate) + '" title="Выбрать дату для просмотра работ" style="padding:4px 8px;border:1px solid var(--line);border-radius:8px;font-size:12px;font-family:inherit;background:var(--card);color:var(--ink)">' + (dayOff !== 0 ? '<button type="button" class="btn sm" data-action="dash-day-today" title="Вернуться на сегодня">Сегодня</button>' : '') + '</span><div class="spacer"></div><span class="badge tag ' + (overloadsDay ? 'over' : 'ok') + '">' + (overloadsDay ? 'Есть перегрузки' : 'Без перегрузок') + '</span></div><div class="card-b">';
    if (!dayTask.length) html += '<div class="empty">' + (dayOff === 0 ? 'На сегодня задач нет' : 'На ' + esc(fmt(dayDate)) + ' задач нет') + '</div>';
    mastersDay.forEach(function (m) {
      var mt = dayTask.filter(function (t) { return String(t.m) === String(m.id); }); // 22.09-188: id — строками
      var load = mt.reduce(function (s, t) { return s + (isDone(t) ? 0 : taskDurHours(t)); }, 0); // 22.09-223: загрузка = длительность (норма делится на исполнителей)
      var inProg = mt.filter(function (t) { return t.started_at && !isDone(t); })[0]; // 22.09-190: сейчас работает на объекте
      var _mc = masterCapacity(m.id, dayOff);
      var over = load > _mc;
      // 22.09-251: «Карточки работ на день» открываются нажатием на ВЕСЬ блок мастера (а не только на ФИО)
      html += '<div class="today-mstr" data-action="wc-open" data-mid="' + esc(m.id) + '" title="Нажмите — откроются карточки всех работ мастера на этот день"><span class="dot" style="background:' + m.color + '"></span><div><div class="nm">' + esc(m.name) + ' <span style="color:var(--muted);font-weight:600;font-size:12px">→</span></div><div class="ar">' + esc(m.area) + '</div></div><div class="meta"><div class="h" style="color:' + (over ? 'var(--red)' : 'var(--ink)') + '">' + fmtH(load) + ' ч / ' + fmtH(_mc) + ' ч</div><span class="tag ' + (over ? 'over' : 'ok') + '">' + (over ? '⚠ Перегрузка +' + fmtH(load - _mc) + ' ч' : mt.length + ' заданий') + '</span>' + (dayOff === 0 && inProg ? ' <span class="tag ok" style="background:#dcfce7;color:#166534" title="Работа начата в ' + fmtClock(inProg.started_at) + '">🔨 на объекте с ' + fmtClock(inProg.started_at) + '</span>' : '') + '</div></div>';
      // гант-шкала дня: 8:00–20:00, задачи и переезды
      html += ganttDayHtml(m, dayOff);
      mt.slice(0, 4).forEach(function (t) {
        var w = workOf(t);
        // 22.09-248: под мастером — ГРУППА работ (вид работ — во всплывающей подсказке); кнопок «Приступил/Закончил»
        // здесь нет — они в «Карточках работ на день» (клик по блоку мастера, 22.09-251), здесь только отметка факта
        var _gp = gwWorkGroup(w); if (_gp === 'Без группы') _gp = '';
        html += '<div class="taskline"><span class="pill" style="max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc((_gp ? 'Группа работ: ' + _gp + '\n' : '') + 'Вид работ: ' + (w ? w.name : '—')) + '">' + esc(_gp || (w ? w.name : '?')) + '</span><span>' + esc(addrOf(t)) + '</span>' + taskDayStatusHtml(t) + '<span style="margin-left:auto;color:var(--muted)">' + fmtH(taskHours(t)) + ' ч</span></div>';
      });
      if (mt.length > 4) html += '<div class="taskline" style="color:var(--muted)">и ещё ' + (mt.length - 4) + '…</div>';
    });
    html += '</div></div>';
    html += _dashJoin; // 22.09-169: общая карточка «КПД мастеров + Выполнение по дням» — рядом с «Сегодня»
    html += '</div>';

    view.innerHTML = html;
    animKpiNumbers(); // цифры KPI «накручиваются»
    document.getElementById('rz-badge').textContent = redzone.length;

    // привязка селектора участка (для админа)
    var dashAreaSel = document.getElementById('dash-area');
    if (dashAreaSel) dashAreaSel.addEventListener('change', function (e) { S.dashArea = e.target.value || null; renderDashboard(); });
    // 22.09-193: привязка селектора «КПД мастеров»
    var dashMasterSel = document.getElementById('dash-master');
    if (dashMasterSel) dashMasterSel.addEventListener('change', function (e) { S.dashMaster = e.target.value || null; renderDashboard(); });
    // 22.09-171: календарик выбора даты в блоке «Сегодня»
    var dashDaySel = document.getElementById('dash-day-sel');
    if (dashDaySel) dashDaySel.addEventListener('change', function (e) {
      var v = e.target.value;
      if (!v) { S.dashDayOff = 0; renderDashboard(); return; }
      var parts = v.split('-');
      S.dashDayOff = dateToOff(new Date(+parts[0], +parts[1] - 1, +parts[2]));
      renderDashboard();
    });
    // Запуск случайных вспышек молний, если сегодня гроза (сцена содержит #wx-bolts)
    setupLightning();
    // 22.09-268: кнопка «Настроить панель» и порядок/видимость блоков — при КАЖДОЙ отрисовке
    try { dashboardDecorate(); } catch (eDash) {}
  }

  function kpi(val, lab, hint, color, action) {
    var clickAttr = action ? ' data-action="' + action + '" style="cursor:pointer"' : '';
    return '<div class="kpi"' + clickAttr + '><div class="acc" style="background:' + color + '"></div><div class="lab">' + lab + '</div><div class="val">' + val + '</div><div class="hint">' + hint + '</div></div>';
  }

  /* ===== ГАНТ-ШКАЛА ДНЯ МАСТЕРА (8:00–20:00): задачи + переезды ===== */
  // Конец гант-шкалы дня: 8-часовой день — 8:00–20:00, 12-часовой — 8:00–21:00
  // (у 12-часовика рабочий день законно заканчивается после 20:00 — «везде по 12»)
  function ganttDayEndMin(m) { return 480 + (wkData(m.id).hours === 12 ? 13 : 12) * 60; }
  function ganttBlock(from, min, color, title, op, endMin) {
    if (min <= 0) return '';
    var span = (endMin || 1200) - 480;
    var l = (from - 480) / span * 100, w = min / span * 100;
    return '<span style="position:absolute;top:2px;bottom:2px;left:' + l.toFixed(2) + '%;width:' + Math.max(0.4, w).toFixed(2) + '%;border-radius:3px;background:' + color + (op != null ? ';opacity:' + op : '') + '" title="' + esc(title) + '"></span>';
  }
  /* Гант-шкала дня мастера — ТОТ ЖЕ движок, что и карта местоположения:
     порядок объезда (ближайший сосед от базы) и реальные времена переездов
     от единого роутера BRouter car (economic) с учётом пробок (кэш sessionStorage).
     Если кэша нет — оценка по расстояниям и фоновый запрос роутера: когда придёт,
     дашборд перерисуется и числа совпадут с картой местоположения точно.
     Выезд с базы в 8:30. */
  function ganttDayHtml(m, dayOff) {
    try {
      var tasks = S.tasks.filter(function (t) { return t.m === m.id && t.d === dayOff; });
      if (!tasks.length) return '';
      var base = currentBase();
      // координаты точек — приоритет как на livemap (задача → объект → кэш геокодера)
      var pts = [], allGeo = true;
      tasks.forEach(function (t) {
        // приоритет координат — КАК НА КАРТЕ МЕСТОПОЛОЖЕНИЯ (lmBuildRoute):
        // сначала координаты задачи, затем объект справочника, затем кэш геокодера
        var o = OBJ_MAP[t.o];
        var lat = (t.lat != null) ? t.lat : ((o && o.lat != null) ? o.lat : null);
        var lng = (t.lng != null) ? t.lng : ((o && o.lng != null) ? o.lng : null);
        if (lat == null) {
          try { var c = getTaskCoords(t.addr); if (c) { lat = c.lat; lng = c.lng; } } catch (e) {}
        }
        if (lat == null || lng == null) allGeo = false;
        pts.push({ t: t, lat: lat, lng: lng, hours: taskDurHours(t), addr: addrOf(t) }); // 22.09-223: стоянка = длительность
      });
      if (!allGeo) return ganttDayEstHtml(m, tasks); // нет координат — упрощённая оценка
      var ordered = lmNearestOrder(pts, base);
      // OSRM-кэш карты местоположения (тот же ключ) — точные числа без запросов
      var res = null;
      try {
        var raw = sessionStorage.getItem(lmOsrmCacheKey(m, ordered, base, dayOff));
        if (raw) {
          var c = JSON.parse(raw);
          if (c && c.res && (Date.now() - c.ts) < 6 * 3600 * 1000) res = c.res;
        }
      } catch (e) {}
      if (!res) {
        // кэша нет: оценка по расстояниям (те же коэффициенты, что estimateTravelMin)
        var legs = [], cur = base, sumKm = 0, sumMin = 0;
        var seq = ordered.concat([base]); // …и возврат на базу
        seq.forEach(function (p) {
          var km = distKm(cur, p) * 1.4;
          var min = Math.max(3, Math.round(km / 35 * 60));
          legs.push({ distance: km * 1000, duration: min * 60 });
          sumKm += km; sumMin += min; cur = p;
        });
        res = { ok: true, legs: legs, km: sumKm, min: sumMin };
        wkGanttFetchOsrm(m, ordered, base, dayOff); // фоном подтянуть точные числа у OSRM
      }
      var opt = lmOrderByWaypoints(ordered, res);
      var sched = lmSchedCore(opt, res);
      return ganttFromSchedHtml(m, sched);
    } catch (e) { return ''; }
  }

  // Отрисовка ганта из расписания (движок livemap): drive = серый, stay = задача
  function ganttFromSchedHtml(m, sched) {
    var T1 = ganttDayEndMin(m), blocks = '', end = 0; // окно шкалы — по часам мастера (8/12)
    sched.evs.forEach(function (ev) {
      if (ev.type === 'drive') {
        var ttl = ev.dest
          ? ('🚗 Переезд: ' + (ev.dest.addr || '') + ' · ' + fmtDuration(ev.min))
          : ('🚗 Возврат на базу · ' + fmtDuration(ev.min));
        blocks += ganttBlock(ev.t0, ev.min, '#94a3b8', ttl, .45, T1);
      } else {
        var t = ev.pt.t, w = workOf(t);
        blocks += ganttBlock(ev.t0, ev.min, isDone(t) ? '#16a34a' : (m.color || '#2563eb'),
          (w ? w.name : '?') + ' · ' + fmtH(ev.min / 60) + ' ч' + (isDone(t) ? ' ✓ выполнено' : ''), isDone(t) ? .95 : .6, T1);
      }
      end = Math.max(end, ev.t0 + ev.min);
    });
    var s = '<div style="position:relative;height:18px;border-radius:6px;background:var(--panel-3);margin:7px 0 2px;overflow:hidden" title="Гант дня (выезд с базы в 8:30, как на карте местоположения): цветные — задачи, серые — переезды">';
    s += blocks;
    if (end > T1) s += '<span style="position:absolute;right:3px;top:2px;font-size:10.5px;color:var(--red);font-weight:800">▸ ' + lmFmtTime(T1) + '+</span>';
    s += '</div>';
    return s;
  }

  // Запасной вариант без координат: последовательная оценка (без OSRM)
  function ganttDayEstHtml(m, tasks) {
    var T1 = ganttDayEndMin(m), cur = 8 * 60, blocks = '', over = false; // окно шкалы — по часам мастера (8/12)
    tasks.sort(function (a, b) { return (a.dl - b.dl) || (taskDurHours(b) - taskDurHours(a)); }); // 22.09-223: по длительности
    tasks.forEach(function (t) {
      var w = workOf(t);
      var tv = t.travelMin != null ? t.travelMin : estimateTravelMin(t);
      if (!tv || tv < 0 || !isFinite(tv)) tv = 15;
      if (cur < T1) blocks += ganttBlock(cur, Math.min(tv, T1 - cur), '#94a3b8', '🚗 Переезд ~' + fmtDuration(tv), .45, T1);
      cur += tv;
      var h = Math.round(taskDurHours(t) * 60); // 22.09-223: длина блока — длительность
      if (cur < T1) blocks += ganttBlock(cur, Math.min(h, T1 - cur), isDone(t) ? '#16a34a' : (m.color || '#2563eb'),
        (w ? w.name : '?') + ' · ' + fmtH(taskDurHours(t)) + ' ч' + (isDone(t) ? ' ✓ выполнено' : ''), isDone(t) ? .95 : .6, T1);
      cur += h;
      if (cur > T1) over = true;
    });
    var s = '<div style="position:relative;height:18px;border-radius:6px;background:var(--panel-3);margin:7px 0 2px;overflow:hidden" title="Гант дня (оценка: координаты части задач неизвестны)">';
    s += blocks;
    if (over) s += '<span style="position:absolute;right:3px;top:2px;font-size:10.5px;color:var(--red);font-weight:800">▸ ' + lmFmtTime(T1) + '+</span>';
    s += '</div>';
    return s;
  }

  // Фоновый запрос OSRM для ганта (мягкая очередь, кэш livemap) + перерисовка дашборда
  var wkOsrmQueue = [], wkOsrmBusy = false, wkOsrmPending = {}, wkOsrmRerender = null;
  function wkGanttFetchOsrm(m, ordered, base, dayOff) {
    try {
      var key = lmOsrmCacheKey(m, ordered, base, dayOff);
      if (wkOsrmPending[key]) return;
      wkOsrmPending[key] = 1;
      wkOsrmQueue.push({ m: m, ordered: ordered, base: base, key: key, dayOff: dayOff });
      wkOsrmNext();
    } catch (e) {}
  }
  function wkOsrmNext() {
    if (wkOsrmBusy || !wkOsrmQueue.length) return;
    var job = wkOsrmQueue.shift();
    wkOsrmBusy = true;
    lmOsrmCached(job.m, job.ordered, job.base, function (res) {
      delete wkOsrmPending[job.key];
      wkOsrmBusy = false;
      if (res && res.ok && S.screen === 'dashboard') {
        if (wkOsrmRerender) clearTimeout(wkOsrmRerender);
        wkOsrmRerender = setTimeout(function () {
          wkOsrmRerender = null;
          if (S.screen === 'dashboard') renderDashboard(); // теперь — точные числа
        }, 250);
      }
      setTimeout(wkOsrmNext, 300); // мягкая пауза между запросами к OSRM
    }, job.dayOff);
  }

  // Ось времени для гант-шкал (одна на карточку «Сегодня»)
  /* ===== ЖИВЫЕ KPI: цифры «накручиваются» при отрисовке дашборда ===== */
  function animKpiNumbers() {
    try {
      document.querySelectorAll('.kpi .val').forEach(function (el) {
        var txt = el.textContent || '';
        var mm = /^([\d]+)(.*)$/.exec(txt);
        if (!mm) return;
        var target = parseInt(mm[1], 10);
        if (!isFinite(target) || target <= 0) return;
        var suffix = mm[2];
        var t0 = null, DUR = 650;
        function step(ts) {
          try {
            if (t0 === null) t0 = ts;
            var k = Math.min(1, (ts - t0) / DUR);
            var ke = 1 - Math.pow(1 - k, 3);
            el.textContent = Math.round(target * ke) + suffix;
            if (k < 1) requestAnimationFrame(step);
            else el.textContent = txt;
          } catch (e) { el.textContent = txt; }
        }
        requestAnimationFrame(step);
      });
    } catch (e) { /* анимация не может ломать дашборд */ }
  }

  // Мягкое обновление KPI на дашборде — только числа, без перестройки DOM
  function softUpdateDashboard() {
    var vt = visibleTasks();
    var mastersToday = visibleMasters();
    var today = vt.filter(function (t) { return t.d === 0; });
    var overloads = mastersToday.filter(function (m) { return loadForDay(m.id, 0) > masterCapacity(m.id, 0); }).length;
    var permitCount = vt.filter(function(t) { return t.needs_permit && !isDone(t); }).length;

    // Обновляем только значения внутри существующих KPI карточек
    var kpiEls = document.querySelectorAll('.kpi .val');
    if (kpiEls.length >= 4) {
      if (kpiEls[0]) kpiEls[0].textContent = today.length;
      if (kpiEls[1]) kpiEls[1].textContent = overloads;
      // KPI 3 — процент выполнения
      var doneMonth = 0, totalMonth = 0;
      vt.forEach(function (t) {
        var d = offToDate(t.d);
        if (d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear()) { totalMonth++; if (isDone(t)) doneMonth++; }
      });
      var pct = totalMonth ? Math.round(doneMonth / totalMonth * 100) : 0;
      if (kpiEls[2]) kpiEls[2].textContent = pct + '%';
      if (kpiEls[3]) kpiEls[3].textContent = permitCount;
    }
  }

