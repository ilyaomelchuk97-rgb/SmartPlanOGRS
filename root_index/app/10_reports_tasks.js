  /* ── часть 10 · app/10_reports_tasks.js — отчёты, новая задача, импорт задач из Excel ── */
  /* =====================================================================
     РЕНДЕР: ОТЧЁТЫ (печать вместо Excel)
     ===================================================================== */
  /* =====================================================================
     ОТЧЁТЫ: помощники для выбранного отчётного месяца
     ===================================================================== */
  // Возвращает {y, m} выбранного отчётного месяца (по умолчанию — текущий)
  function getReportMY() {
    if (S.reportMonth) return { y: S.reportMonth.year, m: S.reportMonth.month };
    return { y: TODAY.getFullYear(), m: TODAY.getMonth() };
  }
  // Строка периода отчёта: «июля 2026»
  function reportPeriodStr() { var p = getReportMY(); return MON_NOM[p.m] + ' ' + p.y; }
  // Фильтр задач по выбранному отчётному месяцу (по плановой дате)
  function filterReportMonth(tasks) {
    var p = getReportMY();
    return tasks.filter(function (t) { var d = offToDate(t.d); return d.getMonth() === p.m && d.getFullYear() === p.y; });
  }
  // Сокращённый YYYY-MM для имени файла (отчётный месяц)
  function reportMonthKey() { var p = getReportMY(); return p.y + '-' + String(p.m + 1).padStart(2, '0'); }

  // === Состояние календаря выбора месяца в отчётах ===
  var rmState = { viewYear: TODAY.getFullYear() };

  function toggleReportMonthPicker() {
    var dd = document.getElementById('report-month-dropdown');
    if (!dd) return;
    if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
    var p = getReportMY();
    rmState.viewYear = p.y;
    renderReportMonthPicker();
    // Позиционируем по кнопке
    var btn = document.querySelector('[data-action="report-month-toggle"]');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      dd.style.top = (rect.bottom + 6) + 'px';
      dd.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 316)) + 'px';
    }
    dd.classList.add('open');
  }

  function renderReportMonthPicker() {
    var dd = document.getElementById('report-month-dropdown');
    if (!dd) return;
    var p = getReportMY();
    var html = '';
    html += '<div class="rm-head">';
    html += '<button type="button" data-action="rm-prev-year">‹</button>';
    html += '<span class="rm-year">' + rmState.viewYear + '</span>';
    html += '<button type="button" data-action="rm-next-year">›</button>';
    html += '<button type="button" class="rm-close" data-action="rm-close">×</button>';
    html += '</div>';
    html += '<div class="rm-grid">';
    for (var mo = 0; mo < 12; mo++) {
      var isSel = (rmState.viewYear === p.y && mo === p.m);
      var isCur = (rmState.viewYear === TODAY.getFullYear() && mo === TODAY.getMonth());
      html += '<button type="button" class="rm-month' + (isSel ? ' selected' : '') + (isCur ? ' current' : '') + '" data-action="rm-pick" data-year="' + rmState.viewYear + '" data-month="' + mo + '">' + MON_NOM[mo] + '</button>';
    }
    html += '</div>';
    dd.innerHTML = html;
  }

  function pickReportMonth(year, month) {
    S.reportMonth = { year: year, month: month };
    var dd = document.getElementById('report-month-dropdown');
    if (dd) dd.classList.remove('open');
    renderReports();
  }

  /* ---------- ПЕЧАТЬ ОТЧЁТА (открывает окно печати браузера) ---------- */
  function printReport(title, bodyHtml) {
    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { toast('err', 'Разрешите всплывающие окна для печати'); return; }
    w.document.write(
      '<html><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>' +
      '@page{size:A4;margin:1.5cm}' +
      'body{font-family:"Times New Roman",serif;font-size:12pt;color:#000;line-height:1.5}' +
      'h1{font-size:14pt;text-align:center;margin:0 0 8pt 0;text-transform:uppercase}' +
      'h2{font-size:13pt;margin:16pt 0 6pt 0}' +
      '.hdr{text-align:center;margin-bottom:12pt;border-bottom:2px solid #000;padding-bottom:6pt}' +
      '.hdr .org{font-size:11pt;color:#444}' +
      '.hdr .date{font-size:10pt;color:#666;margin-top:2pt}' +
      'table{width:100%;border-collapse:collapse;margin:8pt 0;font-size:11pt}' +
      'th{border:1px solid #000;padding:4pt 6pt;background:#f0f0f0;text-align:left;font-weight:bold}' +
      'td{border:1px solid #000;padding:4pt 6pt}' +
      '.rz-row{display:flex;gap:8pt;padding:6pt 0;border-bottom:1px dashed #ccc;align-items:center}' +
      '.rz-bar{width:4px;height:28px;border-radius:2px;flex:0 0 4px}' +
      '.rz-main{flex:1}' +
      '.rz-t{font-weight:bold;font-size:11pt}' +
      '.rz-s{font-size:10pt;color:#555}' +
      '.rz-dl{font-weight:bold;font-size:10pt;white-space:nowrap}' +
      '.footer{margin-top:20pt;font-size:10pt;color:#888;text-align:center;border-top:1px solid #ccc;padding-top:6pt}' +
      '@media print{.noprint{display:none}}' +
      '</style></head><body>' +
      '<div class="hdr"><div class="org">УП «МИНГАЗ» · УБиРОГС</div><h1>' + title + '</h1><div class="date">Период: ' + reportPeriodStr() + ' · Сформирован: ' + fmt(TODAY) + '</div></div>' +
      bodyHtml +
      '<div class="footer">SmartPlan · ' + key(TODAY) + '</div>' +
      '<div class="noprint" style="text-align:center;margin-top:16pt"><button onclick="window.print()" style="padding:8pt 24pt;font-size:12pt;cursor:pointer;background:#2563eb;color:#fff;border:none;border-radius:6pt">🖨 Печать</button></div>' +
      '</body></html>'
    );
    w.document.close();
    setTimeout(function() { w.focus(); w.print(); }, 500);
  }

  // === Отчёт №1: План-график ===
  function printReport1() {
    var rows = filterReportMonth(visibleTasks());
    rows.sort(function (a, b) { if (a.d !== b.d) return a.d - b.d; return addrOf(a).localeCompare(addrOf(b)); });
    var body = '<table><thead><tr><th>Дата</th><th>Мастер</th><th>Объект</th><th>Вид работы</th><th>Объём</th><th>Трудозатраты</th></tr></thead><tbody>';
    var totalH = 0;
    rows.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m), d = offToDate(t.d);
      var h = taskHours(t); totalH += h;
      body += '<tr><td>' + d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear() + '</td><td>' + esc(m ? m.name : '—') + '</td><td>' + esc(addrOf(t)) + '</td><td>' + esc(w ? w.name : '—') + '</td><td>' + (t.volume || 1) + ' ' + (w ? w.unit : '') + '</td><td style="text-align:right">' + fmtH(h) + ' ч</td></tr>';
    });
    body += '<tr style="font-weight:bold;background:var(--panel-2)"><td colspan="5" style="text-align:right">Итого трудозатрат:</td><td style="text-align:right">' + fmtH(totalH) + ' ч</td></tr>';
    body += '</tbody></table>';
    printReport('План-график работ', body);
  }

  // === Отчёт №2: План/факт ===
  function printReport2() {
    var byMaster = {};
    filterReportMonth(visibleTasks()).forEach(function (t) { byMaster[t.m] = byMaster[t.m] || { p: 0, f: 0 }; byMaster[t.m].p++; if (isDone(t)) byMaster[t.m].f++; });
    var totP = 0, totF = 0;
    var body = '<table><thead><tr><th>Мастер</th><th>Участок</th><th style="text-align:center">План</th><th style="text-align:center">Факт</th><th style="text-align:center">Выполнено, %</th></tr></thead><tbody>';
    Object.keys(byMaster).forEach(function (mid) {
      var x = byMaster[mid]; totP += x.p; totF += x.f;
      var m = masterById(mid); var pct = x.p ? Math.round(x.f / x.p * 100) : 0;
      body += '<tr><td>' + esc(m ? m.name : '—') + '</td><td>' + esc(m ? m.area : '—') + '</td><td style="text-align:center">' + x.p + '</td><td style="text-align:center">' + x.f + '</td><td style="text-align:center"><b>' + pct + '%</b></td></tr>';
    });
    var totPct = totP ? Math.round(totF / totP * 100) : 0;
    body += '<tr style="font-weight:bold;background:var(--panel-2)"><td colspan="2" style="text-align:right">Итого:</td><td style="text-align:center">' + totP + '</td><td style="text-align:center">' + totF + '</td><td style="text-align:center"><b>' + totPct + '%</b></td></tr>';
    body += '</tbody></table>';
    printReport('Анализ выполнения (план/факт)', body);
  }

  // === Спецотчёт: Контроль ордеров ===
  function printPermitReport() {
    var tasks = filterReportMonth(visibleTasks()).filter(function (t) { return t.needs_permit; });
    tasks.sort(function (a, b) { return a.dl - b.dl; });
    var body = '<p style="font-size:11pt;color:#444;margin-bottom:8pt">Работы, требующие разрешения (ордера). Проверьте сроки истечения.</p>';
    body += '<table><thead><tr><th>Вид работы</th><th>Объект</th><th>Мастер</th><th>Ордер до</th><th>Осталось</th></tr></thead><tbody>';
    tasks.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      var dlDate = t.dl_date || (t.dl != null ? key(offToDate(t.dl)) : '—');
      var daysLeft = t.dl != null ? t.dl : 0;
      var dlColor = daysLeft < 0 ? '#dc2626' : daysLeft <= 3 ? '#ca8a04' : '#16a34a';
      body += '<tr><td>' + esc(w ? w.name : '?') + '</td><td>' + esc(addrOf(t)) + '</td><td>' + esc(m ? m.name : '—') + '</td><td>' + dlDate + '</td><td style="color:' + dlColor + ';font-weight:bold">' + (daysLeft < 0 ? 'просрочка ' + (-daysLeft) + ' дн' : daysLeft === 0 ? 'сегодня!' : daysLeft + ' дн') + '</td></tr>';
    });
    if (!tasks.length) body += '<tr><td colspan="5" style="text-align:center;color:#888">Нет работ с ордерами</td></tr>';
    body += '</tbody></table>';
    printReport('Контроль ордеров (разрешений)', body);
  }

  // === Спецотчёт: Контроль снега ===
  function printSnowReport() {
    var tasks = filterReportMonth(visibleTasks()).filter(function (t) { return t.depends_on_snow; });
    var body = '<p style="font-size:11pt;color:#444;margin-bottom:8pt">Снегоуборочные работы. Норматив реагирования — 48 часов после снегопада.</p>';
    body += '<table><thead><tr><th>Вид работы</th><th>Объект</th><th>Мастер</th><th>Объём</th><th>Трудозатраты</th></tr></thead><tbody>';
    tasks.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      body += '<tr><td>' + esc(w ? w.name : '?') + '</td><td>' + esc(addrOf(t)) + '</td><td>' + esc(m ? m.name : '—') + '</td><td>' + (t.volume || 1) + ' ' + (w ? w.unit : '') + '</td><td>' + fmtH(taskHours(t)) + ' ч</td></tr>';
    });
    if (!tasks.length) body += '<tr><td colspan="5" style="text-align:center;color:#888">Нет снегоуборочных работ</td></tr>';
    body += '</tbody></table>';
    printReport('Контроль снегоуборки', body);
  }

  // === Спецотчёт: Ожидание погоды ===
  function printWeatherReport() {
    var tasks = filterReportMonth(visibleTasks()).filter(function (t) { var w = workOf(t); var wf = getWeatherForecast(t.d); return w && w.min_temp > -50 && wf && wf.temp != null && wf.temp < w.min_temp; });
    var body = '<p style="font-size:11pt;color:#444;margin-bottom:8pt">Задачи, заблокированные погодными условиями (температура ниже допустимой).</p>';
    body += '<table><thead><tr><th>Вид работы</th><th>Объект</th><th>Мин. t°C</th><th>Прогноз t°C</th><th>Погода</th><th>План</th></tr></thead><tbody>';
    tasks.forEach(function (t) {
      var w = workOf(t); var wf = getWeatherForecast(t.d);
      body += '<tr><td>' + esc(w ? w.name : '?') + '</td><td>' + esc(addrOf(t)) + '</td><td>+' + (w ? w.min_temp : -50) + '°C</td><td>' + (wf ? wf.temp : '?') + '°C</td><td>' + (wf ? wf.desc : '—') + '</td><td>' + fmtShort(t.d) + '</td></tr>';
    });
    if (!tasks.length) body += '<tr><td colspan="6" style="text-align:center;color:#888">Нет задач в ожидании погоды</td></tr>';
    body += '</tbody></table>';
    printReport('Ожидание погоды', body);
  }

  // === ЭКСПОРТ ОТЧЁТОВ В EXCEL ===
  function exportReport1Excel() {
    if (!window.XLSX) { ensureXlsxRetry(exportReport1Excel); return; } // ленивая загрузка xlsx
    var data = [];
    data.push(['План-график работ — ' + reportPeriodStr()]);
    data.push(['Сформирован: ' + fmt(TODAY)]);
    data.push([]);
    data.push(['Дата', 'Мастер', 'Объект', 'Вид работы', 'Объём', 'Трудозатраты, ч']);

    var rows = filterReportMonth(visibleTasks());
    rows.sort(function (a, b) { if (a.d !== b.d) return a.d - b.d; return addrOf(a).localeCompare(addrOf(b)); });

    rows.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m), d = offToDate(t.d);
      data.push([
        d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(),
        m ? m.name : '—', addrOf(t), w ? w.name : '—',
        (t.volume || 1) + ' ' + (w ? w.unit : ''),
        parseFloat(fmtH(taskHours(t)).replace(',', '.'))
      ]);
    });
    var total = rows.reduce(function (s, t) { return s + taskHours(t); }, 0);
    data.push([]);
    data.push(['', '', '', 'Итого трудозатрат, ч:', parseFloat(fmtH(total).replace(',', '.'))]);

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 32 }, { wch: 32 }, { wch: 12 }, { wch: 14 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'План-график');
    var fileName = 'Отчёт_1_План-график_' + reportMonthKey() + '.xlsx';
    try { XLSX.writeFile(wb, fileName); toast('ok', '📥 Сформирован файл: ' + fileName + ' (' + rows.length + ' записей)'); } catch (err) { toast('err', 'Ошибка формирования Excel'); }
  }

  function exportReport2Excel() {
    if (!window.XLSX) { ensureXlsxRetry(exportReport2Excel); return; } // ленивая загрузка xlsx
    var byMaster = {};
    filterReportMonth(visibleTasks()).forEach(function (t) { byMaster[t.m] = byMaster[t.m] || { p: 0, f: 0 }; byMaster[t.m].p++; if (isDone(t)) byMaster[t.m].f++; });
    var totP = 0, totF = 0;
    var data = [];
    data.push(['Анализ выполнения (план/факт) — ' + reportPeriodStr()]);
    data.push(['Сформирован: ' + fmt(TODAY)]);
    data.push([]);
    data.push(['Мастер', 'Участок', 'План', 'Факт', 'Выполнено, %']);
    Object.keys(byMaster).forEach(function (mid) {
      var x = byMaster[mid]; totP += x.p; totF += x.f;
      var m = masterById(mid); var pct = x.p ? Math.round(x.f / x.p * 100) : 0;
      data.push([m ? m.name : '—', m ? m.area : '—', x.p, x.f, pct + '%']);
    });
    var totPct = totP ? Math.round(totF / totP * 100) : 0;
    data.push([]);
    data.push(['Итого:', '', totP, totF, totPct + '%']);
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'План-факт');
    var fileName = 'Отчёт_2_План_факт_' + reportMonthKey() + '.xlsx';
    try { XLSX.writeFile(wb, fileName); toast('ok', '📥 Сформирован файл: ' + fileName); } catch (err) { toast('err', 'Ошибка формирования Excel'); }
  }

  function exportPermitExcel() {
    if (!window.XLSX) { ensureXlsxRetry(exportPermitExcel); return; } // ленивая загрузка xlsx
    var tasks = filterReportMonth(visibleTasks()).filter(function (t) { return t.needs_permit; });
    tasks.sort(function (a, b) { return a.dl - b.dl; });
    var data = [];
    data.push(['Контроль ордеров (разрешений) — ' + reportPeriodStr()]);
    data.push(['Сформирован: ' + fmt(TODAY)]);
    data.push([]);
    data.push(['Вид работы', 'Объект', 'Мастер', 'Ордер до', 'Осталось']);
    tasks.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      var dlDate = t.dl_date || (t.dl != null ? key(offToDate(t.dl)) : '—');
      var daysLeft = t.dl != null ? t.dl : 0;
      var dlText = daysLeft < 0 ? 'просрочка ' + (-daysLeft) + ' дн' : daysLeft === 0 ? 'сегодня!' : daysLeft + ' дн';
      data.push([w ? w.name : '?', addrOf(t), m ? m.name : '—', dlDate, dlText]);
    });
    if (!tasks.length) data.push(['Нет работ с ордерами']);
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 32 }, { wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 16 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Ордера');
    var fileName = 'Контроль_ордеров_' + reportMonthKey() + '.xlsx';
    try { XLSX.writeFile(wb, fileName); toast('ok', '📥 Сформирован файл: ' + fileName); } catch (err) { toast('err', 'Ошибка формирования Excel'); }
  }

  function exportSnowExcel() {
    if (!window.XLSX) { ensureXlsxRetry(exportSnowExcel); return; } // ленивая загрузка xlsx
    var tasks = filterReportMonth(visibleTasks()).filter(function (t) { return t.depends_on_snow; });
    var data = [];
    data.push(['Контроль снегоуборки — ' + reportPeriodStr()]);
    data.push(['Сформирован: ' + fmt(TODAY)]);
    data.push([]);
    data.push(['Вид работы', 'Объект', 'Мастер', 'Объём', 'Трудозатраты, ч']);
    tasks.forEach(function (t) {
      var w = workOf(t), m = masterById(t.m);
      data.push([w ? w.name : '?', addrOf(t), m ? m.name : '—', (t.volume || 1) + ' ' + (w ? w.unit : ''), parseFloat(fmtH(taskHours(t)).replace(',', '.'))]);
    });
    if (!tasks.length) data.push(['Нет снегоуборочных работ']);
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 32 }, { wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 16 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Снег');
    var fileName = 'Контроль_снега_' + reportMonthKey() + '.xlsx';
    try { XLSX.writeFile(wb, fileName); toast('ok', '📥 Сформирован файл: ' + fileName); } catch (err) { toast('err', 'Ошибка формирования Excel'); }
  }

  function exportWeatherExcel() {
    if (!window.XLSX) { ensureXlsxRetry(exportWeatherExcel); return; } // ленивая загрузка xlsx
    var tasks = filterReportMonth(visibleTasks()).filter(function (t) { var w = workOf(t); var wf = getWeatherForecast(t.d); return w && w.min_temp > -50 && wf && wf.temp != null && wf.temp < w.min_temp; });
    var data = [];
    data.push(['Ожидание погоды — ' + reportPeriodStr()]);
    data.push(['Сформирован: ' + fmt(TODAY)]);
    data.push([]);
    data.push(['Вид работы', 'Объект', 'Мин. t°C', 'Прогноз t°C', 'Погода', 'План']);
    tasks.forEach(function (t) {
      var w = workOf(t); var wf = getWeatherForecast(t.d);
      data.push([w ? w.name : '?', addrOf(t), w ? w.min_temp : -50, wf ? wf.temp : '?', wf ? wf.desc : '—', fmtShort(t.d)]);
    });
    if (!tasks.length) data.push(['Нет задач в ожидании погоды']);
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 32 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Погода');
    var fileName = 'Ожидание_погоды_' + reportMonthKey() + '.xlsx';
    try { XLSX.writeFile(wb, fileName); toast('ok', '📥 Сформирован файл: ' + fileName); } catch (err) { toast('err', 'Ошибка формирования Excel'); }
  }

  /* ---------- ПОПАП ПОГОДЫ (выпадающий список) ---------- */
  function getWeatherIcon(desc, snowfall, temp) {
    if (desc.indexOf('Снег') !== -1 || (snowfall && snowfall > 0)) return '❄️';
    if (desc.indexOf('Дождь') !== -1 || desc.indexOf('Морось') !== -1 || desc.indexOf('Ливень') !== -1) return '🌧️';
    if (desc.indexOf('Гроза') !== -1) return '⛈️';
    if (desc.indexOf('Облачно') !== -1) return '☁️';
    if (temp != null && temp <= 0) return '🥶';
    return '☀️';
  }

  function toggleWeatherDropdown() {
    var dd = document.getElementById('weather-dropdown');
    if (!dd) return;
    if (dd.classList.contains('open')) {
      dd.classList.remove('open');
      return;
    }
    var html = '';
    // Количество дней прогноза — без ограничения (максимум 15 дней от API)
    var daysCount = 15;

    html += '<div class="wd-head"><div><div class="wd-title">Прогноз погоды</div><div class="wd-sub">Минск · ' + daysCount + ' дн. (нажмите для деталей)</div></div><button class="wd-close" onclick="document.getElementById(\'weather-dropdown\').classList.remove(\'open\')">×</button></div>';
    html += '<div class="wd-grid">';
    for (var off = 0; off < daysCount; off++) {
      var d = offToDate(off);
      var wf = getWeatherForecast(off); // Теперь никогда не возвращает null
      var shortDow = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
      var isToday = (off === 0);
      
      var icon = getWeatherIcon(wf.desc, wf.snowfall, wf.temp);
      var delay = off * 0.06;
      html += '<div class="wd-day' + (isToday ? ' today' : '') + '" style="animation-delay:' + delay + 's" data-action="open-hourly" data-off="' + off + '">';
      html += '<div class="wd-dow">' + (isToday ? 'Сегодня' : shortDow) + '</div>';
      html += '<div class="wd-date">' + d.getDate() + ' ' + MON[d.getMonth()].slice(0,3) + '</div>';
      html += '<div class="wd-icon">' + icon + '</div>';
      html += '<div class="wd-temp">' + wf.temp + '°C</div>';
      html += '<div class="wd-desc">' + esc(wf.desc) + '</div>';
      html += '</div>';
    }
    html += '</div>';
    dd.innerHTML = html;
    dd.classList.add('open');
    // 22.09-231: фон карточек прогноза — та же анимация погоды с облачками,
    // что над ними, только облачков больше, во весь блок и размыто (blur)
    var _cl = document.createElement('div');
    _cl.innerHTML = wxBlurCloudsHtml(26);
    dd.insertBefore(_cl.firstChild, dd.firstChild);
    var _tw = getWeatherForecast(0);
    var _windy = _tw && (_tw.wind || 0) >= 5; // ветер → снос снежинок вправо (амплитуда вправо ×2)
    var _ddRain = _tw && ((_tw.code >= 51 && _tw.code <= 67) || (_tw.code >= 80 && _tw.code <= 82) || _tw.code >= 95 || (_tw.rain && _tw.rain > 0));
    if (_ddRain) {
      var _gl = document.createElement('div');
      _gl.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:14px;pointer-events:none;z-index:0';
      dd.insertBefore(_gl, dd.firstChild);
      var _gdrops = [];
      function _spawnG() {
        var d = { x: Math.random() * 100, y: Math.random() * 15, sp: 0.2 + Math.random() * 1, life: 0, max: 50 + Math.random() * 140, el: document.createElement('div') };
        d.el.className = 'glass-head'; d.el.style.cssText = 'left:' + d.x.toFixed(1) + '%;top:' + d.y.toFixed(0) + 'px;opacity:0';
        _gl.appendChild(d.el);
        setTimeout(function () { d.el.style.opacity = '.5'; }, 50);
        _gdrops.push(d);
      }
      function _tickG() {
        if (!document.getElementById('weather-dropdown').classList.contains('open')) { _gdrops = []; _gl.remove(); return; }
        if (Math.random() < 0.3 && _gdrops.length < 22) _spawnG();
        var _H = _gl.offsetHeight || 300;
        for (var i = _gdrops.length - 1; i >= 0; i--) {
          var d = _gdrops[i]; d.life++;
          var _sp = d.sp * (0.7 + Math.random() * 0.6) * (d.zig ? 0.5 : 1);
          d.y += _sp;
          if (d.zig === undefined) d.zig = Math.random() < 0.4;
          if (d.zig) { d.zc = (d.zc || 0) + 1; var amp = d.zamp || (d.zamp = 0.03 + Math.random() * 0.22); d.x += Math.sin(d.zc * 0.15) * amp; d.el.style.left = d.x.toFixed(1) + '%'; }
          if (d.life % 6 === 0) { var t = document.createElement('div'); t.className = 'glass-trail'; t.style.cssText = 'left:' + d.x.toFixed(1) + '%;top:' + d.y.toFixed(0) + 'px'; _gl.appendChild(t); (function (e) { setTimeout(function () { e.style.opacity = '0'; setTimeout(function () { e.remove(); }, 2500); }, 800); })(t); }
          d.el.style.top = d.y.toFixed(0) + 'px';
          if (d.life > d.max * 0.7 && d.max > 0) { var _p = (d.life - d.max * 0.7) / (d.max * 0.3); var _sc = 1 - _p * 0.85; var _op = 0.5 * (1 - _p); d.el.style.transform = 'scale(' + _sc.toFixed(2) + ')'; d.el.style.opacity = _op.toFixed(2); }
          if (d.life > d.max || d.y > _H) { (function (e) { setTimeout(function () { e.remove(); }, 200); })(d.el); _gdrops.splice(i, 1); }
        }
        requestAnimationFrame(_tickG);
      }
      for (var gi = 0; gi < 10; gi++) _spawnG();
      _tickG();
    }
    // Снежинки на фоне прогноза (если снег): падают как в погоде → уменьшаются до точки → точка исчезает.
    // Комков снега внизу НЕТ.
    var _ddSnow = _tw && ((_tw.code >= 71 && _tw.code <= 77) || _tw.code === 85 || _tw.code === 86 || (_tw.snowfall && _tw.snowfall > 0.1));
    if (_ddSnow) {
      var _sl = document.createElement('div');
      _sl.style.cssText = 'position:absolute;inset:0;overflow:hidden;border-radius:14px;pointer-events:none;z-index:0';
      dd.insertBefore(_sl, dd.firstChild);
      var _snow = [];
      function _spawnS() {
        var d = { x: Math.random() * 100, y: -5, sp: 0.15 + Math.random() * 0.5, sw: 0.1 + Math.random() * 0.3, ph: Math.random() * 6.28, state: 'fall', life: 0, maxFall: 100 + Math.random() * 140, op: 0.5 + Math.random() * 0.35, el: document.createElement('div') };
        d.el.className = 'glass-flake'; d.el.style.cssText = 'left:' + d.x.toFixed(1) + '%;top:' + d.y.toFixed(0) + 'px;opacity:0';
        _sl.appendChild(d.el);
        setTimeout(function () { d.el.style.opacity = d.op.toFixed(2); }, 50);
        _snow.push(d);
      }
      function _tickS() {
        if (!document.getElementById('weather-dropdown').classList.contains('open')) { _snow = []; _sl.remove(); return; }
        if (Math.random() < 0.4 && _snow.length < 30) _spawnS();
        var _H = _sl.offsetHeight || 300;
        for (var i = _snow.length - 1; i >= 0; i--) {
          var d = _snow[i];
          // Движение по траектории (падение + колыхание) — во ВСЕХ фазах,
          // чтобы превратившись в точку, она продолжала лететь, пока не исчезнет.
          // При ветре: траектория-волна сохраняется, но амплитуда вправо ×3 больше влево
          // + постоянный снос вправо → снежинка явно уходит вправо по ветру.
          d.ph += 0.04; d.y += d.sp * (0.8 + Math.random() * 0.4);
          var _sx = Math.sin(d.ph);
          d.x += _sx * (_windy && _sx > 0 ? 3 : 1) * d.sw + (_windy ? 0.08 : 0);
          d.el.style.left = d.x.toFixed(1) + '%'; d.el.style.top = d.y.toFixed(0) + 'px';
          if (d.state === 'fall') {
            // Фаза 1: снежинка падает и колышется, как в погодной сцене
            d.life++;
            // Переход к уменьшению: по времени жизни ИЛИ у нижнего края (без комков!)
            if (d.life > d.maxFall || d.y > _H - 4) { d.state = 'shrink'; d.hl = 0; d.hm = 26 + Math.random() * 34; }
          } else if (d.state === 'shrink') {
            // Фаза 2: снежинка уменьшается и превращается в точку (scale 1.0 → 0.28), продолжая лететь
            d.hl++; var _hp = d.hl / d.hm;
            d.el.style.transform = 'scale(' + (1 - _hp * 0.72).toFixed(3) + ')';
            if (d.hl > d.hm) { d.state = 'fade'; d.fl = 0; d.fm = 22 + Math.random() * 26; }
          } else if (d.state === 'fade') {
            // Фаза 3: точка летит дальше по траектории, уменьшается и пропадает (scale 0.28 → 0, opacity → 0)
            d.fl++; var _fp = d.fl / d.fm;
            d.el.style.transform = 'scale(' + (0.28 * (1 - _fp)).toFixed(3) + ')';
            d.el.style.opacity = (d.op * (1 - _fp)).toFixed(2);
            if (d.fl > d.fm) { d.el.remove(); _snow.splice(i, 1); }
          }
        }
        requestAnimationFrame(_tickS);
      }
      for (var si = 0; si < 12; si++) _spawnS();
      _tickS();
    }
  }

  function initWeatherPopup() {}

  // === ОТКРЫТЬ КАРТУ ПОГОДЫ (полноэкранная модалка) ===
  // Использует WXT — карта осадков Open-Meteo по сетке 16×16 точек
  // (Минск + Минский район), границы регионов, ползунок времени,
  // окошко погоды в точке по клику. Заменяет страницу «Тест погодный».
  function openWeatherMap() {
    if (document.getElementById('wx-map-overlay')) {
      document.getElementById('wx-map-overlay').classList.add('show');
      return;
    }
    var ov = document.createElement('div');
    ov.id = 'wx-map-overlay';
    ov.className = 'show';
    ov.innerHTML =
      '<div id="wx-map-window">' +
        '<div id="wx-map-header">' +
          '<div class="wx-title">🗺 Карта погоды — Минск и Минский район · осадки Open-Meteo</div>' +
          '<button id="wx-map-close" type="button" title="Закрыть" style="background:none;border:none;color:#fff;font-size:26px;cursor:pointer;line-height:1">×</button>' +
        '</div>' +
        '<div id="wx-map-body">' +
          '<div id="wx-map-canvas"></div>' +
          // Легенда
          '<div style="position:absolute;left:42px;top:12px;z-index:1000;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:11px;color:#334155;pointer-events:none;line-height:1.55">' +
            '<div style="font-weight:800;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Легенда</div>' +
            '<div><span style="display:inline-block;width:18px;height:0;border-top:3px solid #e11d48;vertical-align:middle;margin-right:6px"></span>г. Минск</div>' +
            '<div><span style="display:inline-block;width:18px;height:0;border-top:3px dashed #2563eb;vertical-align:middle;margin-right:6px"></span>Минский район</div>' +
            '<div style="margin-top:6px;display:flex;align-items:center;gap:6px"><span style="min-width:34px">Дождь</span><span style="flex:1;height:9px;border-radius:4px;background:linear-gradient(90deg,#88ddee,#00a3e0,#005588,#ffee00,#ff8100,#c10000)"></span></div>' +
            '<div style="display:flex;align-items:center;gap:6px"><span style="min-width:34px">Снег</span><span style="flex:1;height:9px;border-radius:4px;background:linear-gradient(90deg,#b8f8ff,#7fbfff,#4888ff,#0028ff)"></span></div>' +
            '<div style="margin-top:4px;color:#94a3b8;font-size:10px">данные Open-Meteo · все 24 часа</div>' +
          '</div>' +
          // Ползунок часа
          '<div id="wx-bar" style="position:absolute;left:12px;right:12px;bottom:12px;z-index:1000;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:9px 14px 21px;display:flex;align-items:center;gap:12px">' +
            '<button type="button" class="btn sm" id="wx-tl-play" title="Прокрутить сутки: 00:00 → 23:00" style="display:inline-flex;align-items:center;justify-content:center;line-height:1;padding:6px 10px;font-size:14px">▶</button>' +
            '<span id="wx-bar-time" style="font-size:15px;font-weight:800;color:#0f2740;min-width:48px;text-align:center">—</span>' +
            '<div style="flex:1;position:relative">' +
              '<input type="range" id="wx-slider" min="0" max="23" step="1" value="0" style="width:100%;accent-color:#2563eb;cursor:pointer" title="Ползунок времени: сегодня, все 24 часа">' +
              '<div id="wx-ticks" style="position:relative;height:13px;font-size:10.5px;color:#7da7d6;margin-top:2px"></div>' +
            '</div>' +
            // Заголовок часа (справа от ползунка)
            '<div id="wx-hour-info" style="min-width:130px;text-align:right;font-size:12px;color:#0f2740">' +
              '<div style="font-weight:800;font-size:13px">—</div>' +
              '<div style="color:#64748b;font-size:11px">—</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    // Закрытие
    function close() { closeWeatherMap(); }
    document.getElementById('wx-map-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    // Ползунок и Play
    var sl = document.getElementById('wx-slider');
    sl.addEventListener('input', function () { wxtShowHour(+sl.value); });
    // Обработчик Play/Pause вешается в initWxTestMap() через wire('wx-tl-play', ...).
    // Здесь НЕ дублируем — иначе toggle вызывается дважды (start → stop за один клик).

    // Инициализация карты осадков в canvas модалки (то же, что в #wxt-map на странице)
    WXT.canvasHolder = document.getElementById('wx-map-canvas');
    WXT.ticksBuilt = false;
    initWxTestMap();
  }

  function closeWeatherMap() {
    if (WXT && WXT.playTimer) { clearInterval(WXT.playTimer); WXT.playTimer = null; }
    var p = document.getElementById('wxt-pop');
    if (p) p.remove();
    var ov = document.getElementById('wx-map-overlay');
    if (ov) ov.classList.remove('show');
  }


  function openHourlyWeather(off) {
    var d = offToDate(off);
    var wf = getWeatherForecast(off);
    if (!wf) {
      toast('warn', 'Нет подробных данных за этот день');
      return;
    }

    // Надёжный разбор времени восхода/заката (устойчив к формату "HH:MM" и ISO)
    function fmtSunTime(val) {
      if (!val) return '—';
      var dt = new Date(val);
      if (!isNaN(dt.getTime())) return dt.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
      var m = String(val).match(/(\d{1,2}:\d{2})/);
      if (m) return m[1];
      return '—';
    }
    var sunrise = fmtSunTime(wf.sunrise);
    var sunset = fmtSunTime(wf.sunset);

    // Наличие осадков: снег или дождь за день
    var precipIcon, precipType, precipAmount;
    if (wf.snowfall && wf.snowfall > 0.1) {
      precipIcon = '❄️'; precipType = 'Снег'; precipAmount = (Math.round(wf.snowfall * 10) / 10) + ' см';
    } else if (wf.rain && wf.rain > 0.1) {
      precipIcon = '🌧️'; precipType = 'Дождь'; precipAmount = (Math.round(wf.rain * 10) / 10) + ' мм';
    } else if (wf.precip && wf.precip > 0.1) {
      precipIcon = '💧'; precipType = 'Осадки'; precipAmount = (Math.round(wf.precip * 10) / 10) + ' мм';
    } else {
      precipIcon = '☀️'; precipType = 'Без осадков'; precipAmount = '0 мм';
    }

    // === Состояние окна погоды (ползунок времени, автопрокрутка) ===
    if (!window.HOURLY) window.HOURLY = { dayOff: 0, hour: -1, playTimer: null, ticksBuilt: false };
    HOURLY.dayOff = off;
    if (HOURLY.hour < 0) HOURLY.hour = (off === 0) ? new Date().getHours() : 12;
    if (HOURLY.playTimer) { clearInterval(HOURLY.playTimer); HOURLY.playTimer = null; }

    var nowH = (off === 0) ? new Date().getHours() : -1;
    var html = '<div class="modal-h" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;"><h3 style="color:#fff">Погода подробно · ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + '</h3><button class="x" data-action="close-hourly" style="color:#fff" title="Закрыть">×</button></div>';
    html += '<div class="modal-b" style="padding:0">';

    // Информация о Солнце и Луне + кнопка "Погода в точке"
    html += '<div style="display:flex;justify-content:space-around;align-items:center;background:var(--panel-2);padding:14px;border-bottom:1px solid var(--line);text-align:center;font-size:12px;color:var(--txt);gap:10px;">';
    html += '<div>☀️<br><span style="font-size:11.5px;color:#64748b">Восход</span><br><b>' + sunrise + '</b></div>';
    html += '<div>🌇<br><span style="font-size:11.5px;color:#64748b">Закат</span><br><b>' + sunset + '</b></div>';
    html += '<div>' + precipIcon + '<br><span style="font-size:11.5px;color:#64748b">Осадки</span><br><b style="font-size:12px">' + precipType + '</b><br><span style="font-size:11.5px;color:#64748b">' + precipAmount + '</span></div>';
    html += '<div style="margin-left:auto"><button type="button" class="btn sm" id="hly-point-btn" style="background:#0f2740;color:#fff;border:none;padding:7px 12px;font-weight:700;display:inline-flex;align-items:center;gap:6px" title="Запросить погоду в конкретной точке (Open-Meteo)">📍 Погода в точке</button></div>';
    html += '</div>';

    // === Анимированная сцена погоды (как в тесте погодном) ===
    // Берём данные hourly[hour] для текущего часа
    var curH = (wf.hourly && wf.hourly[HOURLY.hour]) ? wf.hourly[HOURLY.hour] : { temp: wf.temp, desc: wf.desc, snow: wf.snow, snowfall: wf.snowfall, rain: wf.rain, code: wf.code };
    if (curH && wf.date && !curH.date) curH.date = wf.date;
    if (curH && wf.sunrise && !curH.sunrise) curH.sunrise = wf.sunrise;
    if (curH && wf.sunset && !curH.sunset) curH.sunset = wf.sunset;
    var sceneInfo = weatherSceneHTML(curH, { hour: HOURLY.hour });
    // Сцена = обёртка + содержимое (для плавных CSS-переходов между часами
    // меняем только style.background и innerHTML контейнера эффектов)
    html += '<div id="hly-scene-wrap" data-hour="' + HOURLY.hour + '" style="position:relative;height:140px;background:' + (sceneInfo.bg || '#42a5f5') + ';overflow:hidden;transition:background 1.2s ease;">';
    html += '<div id="hly-scene-fx" style="position:absolute;inset:0;transition:opacity .6s ease">' + sceneInfo.html + '</div>';
    // Текущая температура и описание часа (поверх сцены)
    html += '<div id="hly-scene-info" style="position:absolute;left:18px;top:14px;z-index:5;color:#fff;font-weight:800;text-shadow:0 2px 8px rgba(0,0,0,.55);transition:opacity .35s ease">';
    html += '<div style="font-size:24px;line-height:1">' + (curH.temp > 0 ? '+' : '') + curH.temp + '°C</div>';
    html += '<div style="font-size:12px;font-weight:700;opacity:.95">' + esc(curH.desc || '—') + '</div>';
    html += '</div>';
    html += '<div id="hly-hour-label" style="position:absolute;right:18px;top:14px;z-index:5;color:#fff;font-weight:800;font-size:13px;background:rgba(15,39,64,.55);padding:6px 12px;border-radius:8px;text-shadow:0 1px 4px rgba(0,0,0,.45)">⏰ ' + (HOURLY.hour < 10 ? '0' + HOURLY.hour : HOURLY.hour) + ':00</div>';
    html += '</div>';

    // === Ползунок времени (24 часа) + Play ===
    html += '<div style="background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px 14px;display:flex;align-items:center;gap:12px">';
    html += '<button type="button" class="btn sm" id="hly-play" title="Прокрутить сутки: 00:00 → 23:00" style="width:36px;height:36px;padding:0;font-size:16px;line-height:1;background:#2563eb;color:#fff;border:none;border-radius:50%;font-weight:800;display:inline-flex;align-items:center;justify-content:center">▶</button>';
    html += '<span id="hly-bar-time" style="font-size:15px;font-weight:800;color:#0f2740;min-width:48px;text-align:center">' + (HOURLY.hour < 10 ? '0' + HOURLY.hour : HOURLY.hour) + ':00</span>';
    html += '<div style="flex:1;position:relative">';
    html += '<input type="range" id="hly-slider" min="0" max="23" step="1" value="' + HOURLY.hour + '" style="width:100%;accent-color:#2563eb;cursor:pointer" title="Ползунок времени: все 24 часа выбранного дня">';
    html += '<div id="hly-ticks" style="position:relative;height:14px;font-size:12px;color:#64748b;margin-top:2px"></div>';
    html += '</div></div>';

    // === Почасовой прогноз (клик по строке = прыжок на этот час) ===
    if (wf.hourly && wf.hourly.length) {
      html += '<div id="hly-list" style="max-height:340px;overflow-y:auto;padding:8px 0;">';
      wf.hourly.forEach(function (h, hi) {
        var icon = getWeatherIcon(h.desc, h.snowfall, h.temp);
        var isDay = h.hour >= 6 && h.hour <= 22;
        var precipStr = '';
        if (h.snowfall && h.snowfall > 0) precipStr = '❄️ ' + (Math.round(h.snowfall * 10) / 10) + 'см';
        else if (h.rain && h.rain > 0) precipStr = '🌧️ ' + (Math.round(h.rain * 10) / 10) + 'мм';
        else if (h.precipProb && h.precipProb > 0) precipStr = '💧 ' + h.precipProb + '%';
        var tColor = h.temp < 0 ? '#3b82f6' : h.temp > 22 ? '#dc2626' : 'var(--ink)';
        html += '<div class="hly-row" data-hour="' + hi + '" style="display:flex;align-items:center;gap:10px;padding:8px 18px;border-bottom:1px solid var(--line);font-size:13.5px;cursor:pointer;transition:background .12s;' + (isDay ? '' : 'opacity:0.6;') + '" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'\'">';
        html += '<div style="width:46px;font-weight:700;color:var(--muted)">' + (h.hour < 10 ? '0' + h.hour : h.hour) + ':00</div>';
        html += '<div style="width:28px;text-align:center;font-size:16px">' + icon + '</div>';
        html += '<div style="flex:1;color:var(--txt)">' + esc(h.desc) + '</div>';
        html += '<div style="font-weight:700;width:54px;text-align:right;color:' + tColor + '">' + h.temp + '°</div>';
        html += '<div style="width:84px;text-align:right;font-size:12px;color:#0ea5e9;font-weight:600">' + precipStr + '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="empty">Почасовой прогноз недоступен</div>';
    }

    html += '</div>';
    html += '<div class="modal-f" style="justify-content:space-between"><div style="font-size:12px;color:var(--muted)">' + (nowH >= 0 ? 'Текущий час отмечен на ползунке · ' : '') + 'Источник: Open-Meteo</div><button class="btn" data-action="close-hourly">Закрыть</button></div>';

    modal.style.maxWidth = '780px';
    modal.innerHTML = html;
    overlay.classList.add('show');

    // === Привязка обработчиков ползунка / Play / строк ===
    function setHour(h, fromPlay) {
      h = ((Math.round(h) % 24) + 24) % 24;
      var prevH = HOURLY.hour;
      HOURLY.hour = h;
      var curH2 = (wf.hourly && wf.hourly[h]) ? wf.hourly[h] : { temp: wf.temp, desc: wf.desc, snow: wf.snow, snowfall: wf.snowfall, rain: wf.rain, code: wf.code };
      // Прокидываем дату и восход/закат в hourly-запись, чтобы weatherSceneHTML
      // мог рисовать сцену для нужного дня (а не для реального сегодня)
      if (curH2 && wf.date && !curH2.date) curH2.date = wf.date;
      if (curH2 && wf.sunrise && !curH2.sunrise) curH2.sunrise = wf.sunrise;
      if (curH2 && wf.sunset && !curH2.sunset) curH2.sunset = wf.sunset;

      // === ПЛАВНАЯ СМЕНА СЦЕНЫ: за 1.2с до плавного перехода состояния погоды
      // (sun↔moon, ясно↔дождь↔снег) — рисуем новый слой и кладём поверх старого,
      // плавно меняя opacity. CSS transition на #hly-scene-wrap (background)
      // и на .wx-scene / .wx-cloud / .wx-drop / .wx-flake / .wx-sun делает
      // переход визуально непрерывным.
      var sceneWrap = modal.querySelector('#hly-scene-wrap');
      var sceneFx = modal.querySelector('#hly-scene-fx');
      if (sceneWrap && sceneFx) {
        var nextInfo = weatherSceneHTML(curH2, { hour: h });
        if (prevH !== h && prevH >= 0) {
          // Двухслойный кросс-фейд: новый слой fade-in поверх старого fade-out
          var newLayer = document.createElement('div');
          newLayer.id = 'hly-scene-fx-new';
          newLayer.style.cssText = 'position:absolute;inset:0;opacity:0;transition:opacity 1.0s ease;pointer-events:none';
          newLayer.innerHTML = nextInfo.html;
          sceneWrap.appendChild(newLayer);
          // фон контейнера — к новому цвету (плавно через CSS transition)
          sceneWrap.style.background = nextInfo.bg || '#42a5f5';
          // Запускаем fade
          requestAnimationFrame(function () {
            newLayer.style.opacity = '1';
            sceneFx.style.opacity = '0';
          });
          // Через 1.1с убираем старый и заменяем новый → постоянный слой
          setTimeout(function () {
            if (sceneWrap) {
              // Удаляем временный новый слой, делаем старый «новым постоянным»
              sceneFx.innerHTML = nextInfo.html;
              sceneFx.style.opacity = '1';
              var tmp = sceneWrap.querySelector('#hly-scene-fx-new');
              if (tmp) tmp.remove();
            }
          }, 1100);
        } else {
          // Первый рендер (или тот же час) — обычная отрисовка
          sceneWrap.style.background = nextInfo.bg || '#42a5f5';
          sceneFx.innerHTML = nextInfo.html;
        }
      }

      // Температура/описание поверх сцены (плавный fade)
      var sceneHolder = modal.querySelector('#hly-scene-info');
      if (sceneHolder) {
        sceneHolder.style.opacity = '0';
        setTimeout(function () {
          if (sceneHolder) {
            sceneHolder.innerHTML = '<div style="font-size:24px;line-height:1">' + (curH2.temp > 0 ? '+' : '') + curH2.temp + '°C</div><div style="font-size:12px;font-weight:700;opacity:.95">' + esc(curH2.desc || '—') + '</div>';
            sceneHolder.style.opacity = '1';
          }
        }, 180);
      }

      var hl = modal.querySelector('#hly-hour-label');
      if (hl) hl.textContent = '⏰ ' + (h < 10 ? '0' + h : h) + ':00';
      var bt = modal.querySelector('#hly-bar-time');
      if (bt) bt.textContent = (h < 10 ? '0' + h : h) + ':00';
      var sl = modal.querySelector('#hly-slider');
      if (sl) sl.value = h;  // при Play тоже двигаем слайдер, чтобы пользователь видел прогресс
      // Подсветка активной строки
      var rows = modal.querySelectorAll('.hly-row');
      rows.forEach(function (r, i) { r.style.background = (i === h) ? '#dbeafe' : ''; r.style.fontWeight = (i === h) ? '700' : ''; });
      // Скроллим к активной строке
      var listEl = modal.querySelector('#hly-list');
      if (listEl && rows[h]) {
        try { rows[h].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
      }
    }

    var sl = modal.querySelector('#hly-slider');
    if (sl) sl.addEventListener('input', function () { setHour(+this.value, false); });
    var playBtn = modal.querySelector('#hly-play');
    if (playBtn) playBtn.addEventListener('click', function () {
      if (HOURLY.playTimer) {
        clearInterval(HOURLY.playTimer); HOURLY.playTimer = null;
        playBtn.textContent = '▶';
        return;
      }
      playBtn.textContent = '⏸';
      HOURLY.playTimer = setInterval(function () {
        if (!document.getElementById('overlay').classList.contains('show') || !document.querySelector('#hly-slider')) {
          clearInterval(HOURLY.playTimer); HOURLY.playTimer = null;
          if (playBtn) playBtn.textContent = '▶';
          return;
        }
        var nh = HOURLY.hour + 1;
        if (nh > 23) nh = 0;
        setHour(nh, true);
      }, 900);
    });

    // Тики под ползунком
    var ticks = modal.querySelector('#hly-ticks');
    if (ticks) {
      HOURLY.ticksBuilt = false; // каждый раз перестраиваем (дата могла смениться)
      var t = '';
      for (var i = 0; i < 24; i++) {
        t += '<span style="position:absolute;left:' + ((i / 23) * 100).toFixed(2) + '%;transform:translateX(-50%);white-space:nowrap' +
          (i === nowH ? ';font-weight:800;color:#0f2740' : '') + '" title="' + (i < 10 ? '0' + i : i) + ':00' + (i === nowH ? ' (сейчас)' : '') + '">' + (i % 3 === 0 ? (i < 10 ? '0' + i : i) : '') + '</span>';
      }
      ticks.innerHTML = t;
    }

    // Клик по строке — переход на этот час
    var rows = modal.querySelectorAll('.hly-row');
    rows.forEach(function (r) {
      r.addEventListener('click', function () {
        var h = +this.getAttribute('data-hour');
        setHour(h, false);
      });
    });

    // === Кнопка "Погода в точке" — окошко с погодой по координатам ===
    var pointBtn = modal.querySelector('#hly-point-btn');
    if (pointBtn) pointBtn.addEventListener('click', function () {
      hlyPopShowPoint();
    });

    // Инициализация: подсветить текущий час
    setHour(HOURLY.hour, true);

    /* 22.09-165: автопрокрутка при открытии УБРАНА (дёргала часы +2/−2 при
       открытии карточки дня; её интервал также «переезжал» на следующую
       открытую карточку, если закрыть окно раньше времени). Анимация суток
       по-прежнему запускается вручную кнопкой ▶ справа от ползунка. */
  }

  // Окошко "Погода в точке" — ввод координат + запрос Open-Meteo для выбранного часа
  function hlyPopShowPoint() {
    // Если уже открыто — закрыть
    var old = document.getElementById('hly-pop');
    if (old) old.remove();
    var coords = (window.SP_CONFIG && SP_CONFIG.weatherLat != null)
      ? [SP_CONFIG.weatherLat, SP_CONFIG.weatherLng]
      : [53.9023, 27.5619]; // Минск по умолчанию
    var hour = (HOURLY && HOURLY.hour >= 0) ? HOURLY.hour : new Date().getHours();
    var dayKey = key(offToDate((HOURLY && HOURLY.dayOff != null) ? HOURLY.dayOff : 0));

    var d = document.createElement('div');
    d.id = 'hly-pop';
    d.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:12px;line-height:1.6;color:var(--ink);box-shadow:0 6px 20px rgba(15,39,64,.18);max-width:280px';
    d.innerHTML = '<div id="hly-pop-c"><div style="font-weight:800">⏳ Запрос погоды…</div></div>' +
      '<div style="margin-top:8px;border-top:1px dashed var(--line);padding-top:8px">' +
      '<div style="font-size:10.5px;color:#64748b;margin-bottom:4px">Координаты точки (lat, lng):</div>' +
      '<div style="display:flex;gap:4px;align-items:center"><input id="hly-pop-lat" type="number" step="0.0001" value="' + coords[0] + '" style="flex:1;width:50%;padding:5px 7px;border:1px solid var(--line);border-radius:6px;font-family:inherit;font-size:12px"><input id="hly-pop-lng" type="number" step="0.0001" value="' + coords[1] + '" style="flex:1;width:50%;padding:5px 7px;border:1px solid var(--line);border-radius:6px;font-family:inherit;font-size:12px"></div>' +
      '<button id="hly-pop-btn" type="button" style="margin-top:6px;width:100%;padding:6px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px">Запросить погоду здесь</button>' +
      '<button id="hly-pop-x" type="button" style="position:absolute;right:6px;top:6px;width:20px;height:20px;line-height:18px;text-align:center;border:none;background:transparent;color:#94a3b8;font-size:14px;font-family:inherit;cursor:pointer;border-radius:5px;padding:0">✕</button>' +
      '</div>';
    document.body.appendChild(d);

    // Позиционируем по центру экрана
    var w = d.offsetWidth || 280, h = d.offsetHeight || 200;
    d.style.left = Math.max(8, Math.min((window.innerWidth - w) / 2, window.innerWidth - w - 8)) + 'px';
    d.style.top = Math.max(8, Math.min((window.innerHeight - h) / 2, window.innerHeight - h - 8)) + 'px';

    document.getElementById('hly-pop-x').addEventListener('click', function () { d.remove(); });

    function fetchHourly(lat, lng) {
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
        '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,snowfall,weather_code' +
        '&past_days=7&forecast_days=8&timezone=Europe%2FMinsk&wind_speed_unit=ms';
      var c = document.getElementById('hly-pop-c');
      if (c) c.innerHTML = '<div style="font-weight:800">⏳ Запрос Open-Meteo…</div><div style="color:#94a3b8;font-size:10.5px">' + (+lat).toFixed(4) + ', ' + (+lng).toFixed(4) + '</div>';
      return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.hourly || !j.hourly.time) {
          if (c) c.innerHTML = '<b>Ошибка</b><br>нет данных';
          return;
        }
        // Ищем индекс для нужного дня+часа
        var dt = offToDate((HOURLY && HOURLY.dayOff != null) ? HOURLY.dayOff : 0);
        var datePart = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        var hh = (hour < 10 ? '0' + hour : hour) + ':00';
        var idx = -1;
        for (var i = 0; i < j.hourly.time.length; i++) {
          if (j.hourly.time[i].indexOf(datePart + 'T' + hh) === 0) { idx = i; break; }
        }
        if (idx < 0) {
          if (c) c.innerHTML = '<b>Нет данных</b><br>на этот день/час';
          return;
        }
        var t = j.hourly.temperature_2m[idx];
        var ws = j.hourly.wind_speed_10m[idx];
        var wd = j.hourly.wind_direction_10m[idx];
        var pr = j.hourly.precipitation[idx];
        var sf = j.hourly.snowfall[idx];
        var wc = j.hourly.weather_code[idx];
        var dirs = ['северный', 'северо-восточный', 'восточный', 'юго-восточный', 'южный', 'юго-западный', 'западный', 'северо-западный'];
        var dirName = dirs[Math.round((((+wd || 0) % 360) + 360) % 360 / 45) % 8];
        var wcStr = wxtWeatherText(+wc || 0);
        var prec = 'осадков нет';
        if (+sf > 0) prec = '❄️ снег ' + (+sf).toFixed(2) + ' см/ч';
        else if (+pr > 0) prec = '🌧 дождь ' + (+pr).toFixed(2) + ' мм/ч';
        c.innerHTML =
          '<div style="font-weight:800;margin-bottom:2px">📍 ' + (+lat).toFixed(4) + ', ' + (+lng).toFixed(4) + '</div>' +
          '<div style="color:#94a3b8;font-size:10.5px;margin-bottom:4px">' + datePart + ' · ' + hh + '</div>' +
          '<div>🌡 Температура: <b>' + (t > 0 ? '+' : '') + (+t).toFixed(1) + ' °C</b></div>' +
          '<div>💨 Ветер: <b>' + (+ws).toFixed(1) + ' м/с</b>, ' + dirName + '</div>' +
          (wcStr ? '<div>' + wcStr + '</div>' : '') +
          '<div>' + prec + '</div>' +
          '<div style="color:#94a3b8;font-size:10px;margin-top:3px">Open-Meteo</div>';
      }).catch(function () {
        if (c) c.innerHTML = '<b>Нет связи</b><br>с Open-Meteo';
      });
    }

    // Первичный запрос по умолчанию
    fetchHourly(coords[0], coords[1]);

    // Кнопка "Запросить"
    document.getElementById('hly-pop-btn').addEventListener('click', function () {
      var lat = parseFloat(document.getElementById('hly-pop-lat').value);
      var lng = parseFloat(document.getElementById('hly-pop-lng').value);
      if (isNaN(lat) || isNaN(lng)) {
        toast('err', 'Введите корректные координаты');
        return;
      }
      fetchHourly(lat, lng);
    });
  }

  // Закрытие окна погоды — чистим таймеры
  function closeHourlyWeather() {
    if (window.HOURLY && HOURLY.playTimer) {
      clearInterval(HOURLY.playTimer);
      HOURLY.playTimer = null;
    }
    var pop = document.getElementById('hly-pop');
    if (pop) pop.remove();
    overlay.classList.remove('show');
  }

  function renderReports() {
    var vt = visibleTasks();
    var monthTasks = filterReportMonth(vt);
    var permitTasks = filterReportMonth(vt).filter(function (t) { return t.needs_permit; });
    var snowTasks = filterReportMonth(vt).filter(function (t) { return t.depends_on_snow; });
    var weatherBlocked = filterReportMonth(vt).filter(function (t) { var w = workOf(t); var wf = getWeatherForecast(t.d); return w && w.min_temp > -50 && wf && wf.temp != null && wf.temp < w.min_temp; });

    var printIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>';

    var html = '<div class="card"><div class="card-h"><h2>Формирование печатных форм</h2><div class="spacer"></div><button type="button" class="btn sm" data-action="report-month-toggle" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-weight:700;cursor:pointer;">📅 <span id="report-period-label">' + reportPeriodStr() + '</span></button></div><div class="card-b">';

    // Стандартные отчёты
    html += '<div class="dash-grid" style="grid-template-columns:1fr 1fr">';
    // Отчёт №1
    html += '<div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><h3 style="margin:0;color:var(--ink);font-size:14px">Отчёт №1. План-график</h3><div style="display:flex;gap:6px"><button class="btn sm" data-action="print-report1" style="background:#2563eb;color:#fff;border-color:#2563eb">' + printIcon + ' Печать</button><button class="btn sm" data-action="excel-report1" style="background:#10b981;color:#fff;border-color:#10b981">' + IC.download + ' Excel</button></div></div><table class="dt"><thead><tr><th>Дата</th><th>Объект</th><th>Работа</th><th>Объём</th><th>ч</th></tr></thead><tbody>';
    monthTasks.slice(0, 9).forEach(function (t) {
      var w = workOf(t);
      var d = offToDate(t.d);
      html += '<tr><td>' + d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '</td><td>' + esc(addrOf(t)) + '</td><td>' + esc(w ? w.name : '?') + '</td><td>' + (t.volume || 1) + ' ' + (w ? w.unit : '') + '</td><td>' + fmtH(taskHours(t)) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    // Отчёт №2
    html += '<div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><h3 style="margin:0;color:var(--ink);font-size:14px">Отчёт №2. План/факт</h3><div style="display:flex;gap:6px"><button class="btn sm" data-action="print-report2" style="background:#2563eb;color:#fff;border-color:#2563eb">' + printIcon + ' Печать</button><button class="btn sm" data-action="excel-report2" style="background:#10b981;color:#fff;border-color:#10b981">' + IC.download + ' Excel</button></div></div><table class="dt"><thead><tr><th>Мастер</th><th>План</th><th>Факт</th><th>%</th></tr></thead><tbody>';
    var byMaster = {};
    monthTasks.forEach(function (t) { byMaster[t.m] = byMaster[t.m] || { p: 0, f: 0 }; byMaster[t.m].p++; if (isDone(t)) byMaster[t.m].f++; });
    Object.keys(byMaster).forEach(function (mid) { var x = byMaster[mid]; var m = masterById(mid); html += '<tr><td>' + esc(m ? m.name : '?') + '</td><td>' + x.p + '</td><td>' + x.f + '</td><td><b>' + (x.p ? Math.round(x.f / x.p * 100) : 0) + '%</b></td></tr>'; });
    html += '</tbody></table></div>';
    html += '</div>';

    // === СПЕЦОТЧЁТЫ УБиРОГС ===
    html += '<div style="margin-top:20px;font-size:14px;font-weight:700;color:var(--ink);">📋 Спецотчёты УБиРОГС</div>';

    // Контроль ордеров
    html += '<div class="card" style="margin-top:10px;"><div class="card-h"><h2 style="font-size:13px;">📋 Контроль ордеров (разрешений)</h2><div class="spacer"></div><div style="display:flex;gap:6px"><button class="btn sm" data-action="print-permit" style="background:#2563eb;color:#fff;border-color:#2563eb">' + printIcon + ' Печать</button><button class="btn sm" data-action="excel-permit" style="background:#10b981;color:#fff;border-color:#10b981">' + IC.download + ' Excel</button></div></div><div class="card-b">';
    if (!permitTasks.length) html += '<div class="empty">Нет работ с ордерами</div>';
    permitTasks.forEach(function (t) {
      var w = workOf(t);
      var dlDate = t.dl_date || (t.dl != null ? key(offToDate(t.dl)) : '—');
      var daysLeft = t.dl != null ? t.dl - 0 : 0;
      var cls = daysLeft < 0 ? 'color:var(--red)' : daysLeft <= 3 ? 'color:var(--yellow)' : 'color:var(--green)';
      html += '<div class="rz-item"><div class="rz-bar" style="background:' + (daysLeft < 0 ? 'var(--red)' : daysLeft <= 3 ? 'var(--yellow)' : 'var(--green)') + '"></div><div class="rz-main"><div class="rz-t">' + esc(w ? w.name : '?') + ' — ' + esc(addrOf(t)) + '</div><div class="rz-s">Ордер до: ' + dlDate + '</div></div><div class="rz-dl" style="' + cls + '">' + (daysLeft < 0 ? 'просрочка ' + (-daysLeft) + ' дн' : daysLeft === 0 ? 'сегодня!' : 'осталось ' + daysLeft + ' дн') + '</div></div>';
    });
    html += '</div></div>';

    // Контроль снега
    html += '<div class="card" style="margin-top:10px;"><div class="card-h"><h2 style="font-size:13px;">❄️ Контроль снегоуборки</h2><div class="spacer"></div><div style="display:flex;gap:6px"><button class="btn sm" data-action="print-snow" style="background:#2563eb;color:#fff;border-color:#2563eb">' + printIcon + ' Печать</button><button class="btn sm" data-action="excel-snow" style="background:#10b981;color:#fff;border-color:#10b981">' + IC.download + ' Excel</button></div></div><div class="card-b">';
    if (!snowTasks.length) html += '<div class="empty">Нет снегоуборочных работ</div>';
    snowTasks.forEach(function (t) {
      var w = workOf(t);
      html += '<div class="rz-item"><div class="rz-bar" style="background:#3b82f6"></div><div class="rz-main"><div class="rz-t">' + esc(w ? w.name : '?') + ' — ' + esc(addrOf(t)) + '</div><div class="rz-s">Объём: ' + (t.volume || 1) + ' ' + (w ? w.unit : '') + ' · Норматив: 48 ч</div></div><div class="rz-dl" style="color:#2563eb">❄️ ' + fmtH(taskHours(t)) + ' ч</div></div>';
    });
    html += '</div></div>';

    // Контроль погоды
    html += '<div class="card" style="margin-top:10px;margin-bottom:0;"><div class="card-h"><h2 style="font-size:13px;">🌡️ Ожидание погоды</h2><div class="spacer"></div><div style="display:flex;gap:6px"><button class="btn sm" data-action="print-weather" style="background:#2563eb;color:#fff;border-color:#2563eb">' + printIcon + ' Печать</button><button class="btn sm" data-action="excel-weather" style="background:#10b981;color:#fff;border-color:#10b981">' + IC.download + ' Excel</button></div></div><div class="card-b">';
    if (!weatherBlocked.length) html += '<div class="empty">Нет задач в ожидании погоды</div>';
    weatherBlocked.forEach(function (t) {
      var w = workOf(t);
      var wf = getWeatherForecast(t.d);
      var temp = wf ? wf.temp : '?';
      var wDesc = wf ? wf.desc : 'нет данных';
      html += '<div class="rz-item"><div class="rz-bar" style="background:#f59e0b"></div><div class="rz-main"><div class="rz-t">' + esc(w ? w.name : '?') + ' — ' + esc(addrOf(t)) + '</div><div class="rz-s">Погода: ' + temp + '°C · ' + wDesc + ' · Нужно: ≥' + (w ? w.min_temp : -50) + '°C</div></div><div class="rz-dl" style="color:#f59e0b">⚠ t°</div></div>';
    });
    html += '</div></div>';

    html += '</div></div>';
    view.innerHTML = html;
  }

  /* =====================================================================
     МОДАЛ: НОВАЯ ЗАДАЧА
     ===================================================================== */
  // ===== Карта в окне «Выбор объекта» (карточка задачи) =====
  // Состояние на уровне модуля: карта обязана уничтожаться при ЛЮБОМ закрытии
  // (livemap-паттерн: map.destroy, никаких «висящих» экземпляров).
  var objPickMapState = { map: null, dot: null, dotHref: null, docClick: null, esc: null };
  // Снять Esc-обработчик пикера (глобально, один экземпляр — без утечек)
  function objPickRemoveEsc() {
    if (objPickMapState.esc) {
      try { document.removeEventListener('keydown', objPickMapState.esc); } catch (e) {}
      objPickMapState.esc = null;
    }
  }
  // Уничтожить карту выбора (оверлей карты + облачко + обработчики). Пикер списка не трогает.
  function objPickMapDestroy() {
    var tip = document.getElementById('obj-map-tip'); if (tip) tip.remove();
    if (objPickMapState.docClick) {
      try { document.removeEventListener('click', objPickMapState.docClick, true); } catch (e) {}
      objPickMapState.docClick = null;
    }
    try { if (objPickMapState.map) objPickMapState.map.destroy(); } catch (e) {}
    objPickMapState.map = null; objPickMapState.dot = null;
    var mo = document.getElementById('obj-map-overlay'); if (mo) mo.remove();
  }
  // Полная очистка: карта выбора + пикер. Вызывается при закрытии карточки задачи
  // (close-modal) и после сохранения — страховка от «висящих» оверлеев.
  function closeTaskObjectPickers() {
    objPickMapDestroy();
    objPickRemoveEsc();
    var po = document.getElementById('obj-picker-overlay'); if (po) po.remove();
  }
  /* 22.09-150: зимний период графиков работ — для сезонного фильтра автовыбора
     в карточке задачи. Источник: текущий график, иначе последний созданный
     график с заданным периодом («Сезоны» на панели графика). */
  function taskWinterPeriod() {
    var list = [];
    try { list = graphsLoad() || []; } catch (e) {}
    var cur = null;
    if (typeof GS !== 'undefined' && GS && GS.cur) { list.forEach(function (x) { if (x && x.id === GS.cur) cur = x; }); }
    if (cur && cur.winter && cur.winter.from && cur.winter.to) return { from: cur.winter.from, to: cur.winter.to };
    for (var i = list.length - 1; i >= 0; i--) {
      var x = list[i];
      if (x && x.winter && x.winter.from && x.winter.to) return { from: x.winter.from, to: x.winter.to };
    }
    return null;
  }
  /* Дата в зимнем периоде? null — определить нельзя (нет периода или даты) */
  function taskDateIsWinter(dateISO) {
    var wp = taskWinterPeriod();
    if (!wp || !dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
    function md(x) { var p = String(x).split('-'); return (+p[0]) * 100 + (+p[1]); }
    var cur = md(dateISO.slice(5, 10)), from = md(wp.from), to = md(wp.to);
    return from <= to ? (cur >= from && cur <= to) : (cur >= from || cur <= to);
  }
  /* Сезон работы против даты задачи: зимняя дата — только «Зима» и без пометки;
     летняя — только «Лето» и без пометки. Период/дата неизвестны — не фильтруем. */
  function taskSeasonOk(w, dateISO) {
    var s = String(w && w.season || '').toLowerCase();
    if (!s) return true; // работы без пометки сезона — всегда
    var iz = taskDateIsWinter(dateISO);
    if (iz === null) return true;
    return iz ? (s === 'зима') : (s === 'лето');
  }
  /* 22.09-146/150: автовыбор конкретной РАБОТЫ внутри выбранной ГРУППЫ — по тем же
     правилам, что автоподбор работ в графике: тип объекта, линии редуцирования,
     наличие телеметрии (+ вид обслуживания, отопление) — всегда при выбранном
     объекте, и СЕЗОН: дата задачи по зимнему периоду графика выбирает «Зима»/
     «Лето» версию; работы без пометки подходят всегда. Исключённые названия
     (автоподбор НИКОГДА) не берутся. */
  function taskGroupAutopick(area, gp, objId, dateISO) {
    if (!gp) return null;
    var works = [];
    try { works = WORK.getWorks(area) || []; } catch (e) {}
    var attrs = {}, objType = '';
    try {
      var rec = (window.SP_OBJECTS && objId) ? SP_OBJECTS.getObject(objId) : null;
      if (rec) { objType = rec.type || ''; if (window.SP_OBJ_ATTRS) attrs = SP_OBJ_ATTRS.getAttrs(rec) || {}; }
    } catch (e2) {}
    var rules = objId
      ? { type: true, lines: true, telemetry: true, service: true, heating: true }
      : { type: false, lines: false, telemetry: false, service: false, heating: false };
    var firstOk = null, firstAny = null;
    for (var i = 0; i < works.length; i++) {
      var w = works[i];
      if (!w || gwWorkGroup(w) !== gp) continue;
      if (!firstAny) firstAny = w;
      if (autopickExcludedName(w.name)) continue;
      if (!taskSeasonOk(w, dateISO)) continue;
      if (!firstOk) firstOk = w;
      if (workMatchesObjectParams(w, attrs, objType, rules)) return w;
    }
    return firstOk || firstAny;
  }
  /* 22.09-148: точный выбор работы в группе (справа от списка работ — 🎯).
     Список: все работы группы целиком (название, норма/единица, значки);
     без группы — все работы участка. Текущая работа подсвечена. */
  function exactWorkPickHtml(area, gp, curWid) {
    var works = [];
    try { works = WORK.getWorks(area) || []; } catch (e) {}
    function badgesOf(w) {
      var b = [];
      if (w.needs_permit) b.push('📋 ордер');
      if (w.depends_on_snow) b.push('❄️ снег');
      if (w.min_temp > -50) b.push('🌡️');
      if (w.telemetry_type) b.push('📡 ' + w.telemetry_type);
      else if (w.telemetry_req === 'equipped') b.push('📡 ТМ');
      else if (w.telemetry_req === 'not_equipped') b.push('🚫📡 без ТМ');
      if (w.lines_count) b.push('линий: ' + w.lines_count);
      return b;
    }
    var h = '', total = 0;
    works.forEach(function (w) {
      if (gp && gwWorkGroup(w) !== gp) return;
      total++;
      var cur = w.id === curWid;
      var b = badgesOf(w);
      h += '<button type="button" data-ewp="' + esc(w.id) + '"' +
        ' style="display:block;width:100%;text-align:left;padding:9px 12px;border:1.5px solid ' + (cur ? '#16a34a' : 'var(--line)') + ';border-radius:10px;background:' + (cur ? '#f0fdf4' : 'var(--card)') + ';cursor:pointer;font-family:inherit">' +
        '<div style="font-size:12.5px;font-weight:700;color:var(--ink)">' + (cur ? '✓ ' : '') + esc(w.name) + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + fmtH(w.norm) + ' ч/' + esc(w.unit) + (b.length ? ' · ' + esc(b.join(' · ')) : '') + '</div>' +
        '</button>';
    });
    if (!total) h = '<div class="empty" style="padding:16px 12px;font-size:12.5px">Нет работ ' + (gp ? 'в этой группе' : 'на участке') + '.</div>';
    return h;
  }
  /* Окно — ОТДЕЛЬНЫЙ оверлей поверх карточки задачи/периодичности (их модалка
     не перекрывается — закрытие вернёт к ней). Выбор: onPick(wid). */
  function openExactWorkPickModal(area, gp, curWid, onPick) {
    var prev = document.getElementById('ewp-overlay');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var ov = document.createElement('div');
    ov.id = 'ewp-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:1300;display:flex;align-items:center;justify-content:center;padding:18px';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--card);border-radius:14px;box-shadow:0 18px 46px rgba(15,23,42,.35);width:100%;max-width:560px;max-height:84vh;display:flex;flex-direction:column;overflow:hidden';
    box.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)">' +
      '<h3 style="margin:0;font-size:15px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">🎯 Точный выбор работы' + (gp ? ' · <span style="color:var(--muted);font-weight:600">' + esc(gp) + '</span>' : '') + '</h3>' +
      '<button type="button" id="ewp-close" style="border:none;background:transparent;font-size:20px;cursor:pointer;color:var(--muted);line-height:1;flex:0 0 auto">×</button></div>' +
      '<div style="padding:10px 16px 0;font-size:12.5px;color:var(--muted)">Выбранная здесь работа заменяет автовыбор по параметрам объекта' + (gp ? ' в этой группе' : '') + '.</div>' +
      '<div id="ewp-list" style="padding:12px 16px 16px;display:flex;flex-direction:column;gap:8px;overflow-y:auto">' + exactWorkPickHtml(area, gp, curWid) + '</div>';
    ov.appendChild(box);
    document.body.appendChild(ov);
    function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener('click', function (e) {
      if (e.target === ov || (e.target && e.target.closest && e.target.closest('#ewp-close'))) { close(); return; }
      var btn = e.target && e.target.closest ? e.target.closest('[data-ewp]') : null;
      if (!btn) return;
      var wid = btn.getAttribute('data-ewp');
      close();
      if (typeof onPick === 'function') { try { onPick(wid); } catch (e2) {} }
    });
  }
  /* 22.09-147: переподобрать АВТОвыбранные работы строк карточки под объект.
     worksArr/autoArr — параллельные массивы (autoArr[i]: значение автовыбрано
     и должно следовать за объектом; false — закреплено, не трогаем).
     Возвращает число изменённых строк. */
  function taskReautoWorks(area, worksArr, autoArr, objId, dateISO) {
    if (!area || !Array.isArray(worksArr)) return 0;
    var changed = 0;
    for (var i = 0; i < worksArr.length; i++) {
      if (!autoArr || !autoArr[i]) continue;
      var w = null;
      try { w = worksArr[i] ? WORK.getWork(area, worksArr[i]) : null; } catch (e) {}
      var gp = gwWorkGroup(w);
      if (!gp) continue; // у работ без группы автовыбора нет
      var w2 = taskGroupAutopick(area, gp, objId, dateISO);
      if (w2 && w2.id !== worksArr[i]) { worksArr[i] = w2.id; changed++; }
    }
    return changed;
  }
  /* Опции списка работ карточки задачи: по ГРУППЕ на строку. На виду — название
     группы; во всплывающей подсказке опции/списка — какая работа выбрана в этой
     группе (ранее выбранная сохраняется; новая — автовыбором). Работы без
     группы — отдельными строками с названием, как раньше. Значение опции
     по-прежнему id работы — сохранение задачи не меняется. */
  function taskWorkOptionsHtml(area, works, selWid, objId, dateISO) {
    function badgesOf(w) {
      var b = [];
      if (w.needs_permit) b.push('📋');
      if (w.depends_on_snow) b.push('❄️');
      if (w.min_temp > -50) b.push('🌡️');
      return b.length ? ' ' + b.join('') : '';
    }
    var order = [], gmap = {};
    (works || []).forEach(function (w) {
      var gp = gwWorkGroup(w);
      if (!gp) return;
      if (!gmap[gp]) { gmap[gp] = []; order.push(gp); }
      gmap[gp].push(w);
    });
    var h = '';
    order.forEach(function (gp) {
      var ws = gmap[gp];
      var chosen = null;
      ws.forEach(function (w) { if (w.id === selWid) chosen = w; }); // уже выбранная — сохраняем
      var w0 = chosen || taskGroupAutopick(area, gp, objId, dateISO) || ws[0];
      var tip = w0.name + ' (' + fmtH(w0.norm) + ' ч/' + w0.unit + ')' + badgesOf(w0);
      // 22.09-157: в закрытом списке — просто название группы; при раскрытии
      // к опции добавляется «(число работ)» — см. grpSelExpandText
      h += '<option value="' + esc(w0.id) + '"' + (chosen ? ' selected' : '') + ' title="' + esc(tip) + '" data-grp="' + esc(gp) + '"' + (ws.length > 1 ? ' data-cnt="' + ws.length + '"' : '') + '>' + esc(gp) + '</option>';
    });
    (works || []).forEach(function (w) {
      if (gwWorkGroup(w)) return; // работы с группой — выше, по одной строке на группу
      var tip = w.name + ' (' + fmtH(w.norm) + ' ч/' + w.unit + ')' + badgesOf(w);
      h += '<option value="' + esc(w.id) + '"' + (w.id === selWid ? ' selected' : '') + ' title="' + esc(tip) + '">' + esc(w.name) + '</option>';
    });
    return h;
  }
  function openTaskModal(mode, tid) {
    var masters = visibleMasters();
    if (!masters.length) { toast('err', 'Нет мастеров. Добавьте пользователя с ролью «Мастер» в разделе «Пользователи».'); return; }
    
    var isEdit = mode === 'edit';
    var t = isEdit ? findTask(tid) : null;
    S.editTaskId = (isEdit && t) ? t.id : null;

    if (isEdit && t) {
      if (t.works && t.works.length > 0) S.taskModalWorks = t.works.slice();
      else if (t.w) S.taskModalWorks = [t.w];
      else S.taskModalWorks = [''];
      // 22.09-147: сохранённые виды — закреплены: автовыбор при смене объекта их не трогает
      S.taskModalWorksAuto = S.taskModalWorks.map(function () { return false; });
    } else {
      /* 22.09-153: НОВАЯ задача — карточка открывается СОВСЕМ ПУСТОЙ: ни одного
         вида работ; пользователь сам добавляет виды зелёной «+» и выбирает группу */
      S.taskModalWorks = [];
      S.taskModalWorksAuto = [];
    }
    // Объём работ — СВОЙ у каждого вида работ (параллельный массив)
    if (isEdit && t && t.volumes && t.volumes.length === S.taskModalWorks.length) {
      S.taskModalVols = t.volumes.slice();
    } else if (isEdit && t && t.volume != null) {
      S.taskModalVols = S.taskModalWorks.map(function () { return t.volume; });
    } else {
      S.taskModalVols = S.taskModalWorks.map(function () { return 1; });
    }
    // Привязка к объекту справочника (ГРП/ШРП): адрес и координаты возьмутся из него
    S.taskModalObjId = (isEdit && t && t.o) ? t.o : null;
    // Точка, выбранная на карте («Выбрать на карте» без объекта): точные координаты
    // для обычного адреса — чтобы геокодер не сдвинул её при сохранении
    S.taskModalMapCoords = (!S.taskModalObjId && isEdit && t && t.lat != null && t.lng != null)
      ? { lat: t.lat, lng: t.lng } : null;
    // Слесарь/Бригада: конкретные слесари или «вся бригада участка»
    S.taskModalSlesari = (isEdit && t && t.slesari && t.slesari.length) ? t.slesari.slice() : [];
    S.taskModalBrigade = !!(isEdit && t && t.brigade);

    var title = isEdit ? 'Редактирование задачи' : 'Добавление задачи';
    var btnText = isEdit ? 'Сохранить изменения' : 'Добавить задачу';
    var initAddr = (isEdit && t) ? addrOf(t) : '';
    var initDate = (isEdit && t) ? key(offToDate(t.d)) : key(offToDate(1));
    var initDl = (isEdit && t) ? (t.dl != null ? t.dl : 7) : 7;
    var initMaster = (isEdit && t) ? t.m : (masters[0] ? masters[0].id : '');
    var initM2 = (isEdit && t && t.m2 != null) ? t.m2 : 100;

    var html = '<div class="modal-h"><h3>' + title + '</h3><div style="flex:1"></div>' +
      '<label style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;user-select:none;white-space:nowrap;margin-right:10px" title="Задача НЕ включается в график: серия работ и треугольники в графике не изменятся">' +
      'вне плана <input type="checkbox" id="f-offplan"' + (isEdit && t && t.offplan ? ' checked' : '') + ' style="width:15px;height:15px;cursor:pointer;accent-color:#2563eb;margin:0">' +
      '</label>' +
      '<button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div class="fld"><label>Объект (адрес)</label><div style="display:flex;gap:6px;align-items:stretch">';
    html += '<input id="f-obj" value="' + esc(initAddr) + '" placeholder="ГРП-1, ул. Ленина, 5" style="flex:1">';
    html += '<button type="button" id="btn-pick-obj" style="flex:0 0 auto;white-space:nowrap;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s,border-color .15s" title="Выбрать ГРП/ШРП из справочника объектов — адрес и координаты подставятся автоматически">📍 Выбор объекта</button>';
    html += '</div><div id="f-obj-hint" style="font-size:12.5px;margin-top:5px;color:var(--green);font-weight:600"></div></div>';
    html += '<div class="attr-row"><div class="fld"><label>Плановая дата</label><input id="f-day" type="date" value="' + initDate + '"></div>';
    html += '<div class="fld"><label id="f-dl-label">Дедлайн</label><input id="f-dl-date" type="date" value="' + (isEdit && t && t.dl_date ? t.dl_date : '') + '" placeholder="Дата"></div></div>';
    html += '<div class="fld"><label>Мастер / Бригада</label><select id="f-master">';
    masters.forEach(function (m) { html += '<option value="' + m.id + '"' + (m.id === initMaster ? ' selected' : '') + '>' + esc(m.name) + ' (' + esc(m.area) + ')</option>'; });
    html += '</select></div>';
    // Слесарь/Бригада: выпадающие списки (+ для нескольких), вариант «Вся бригада участка»
    html += '<div class="fld"><label id="f-slesar-label">Слесарь/Бригада</label>' +
      '<div id="f-slesar-list" style="display:flex;flex-direction:column;gap:8px;padding-right:85px"></div></div>';
    html += '<div class="fld"><label>Виды работ на адресе (можно выбрать несколько)</label><div id="f-work-list" style="display:flex;flex-direction:column;gap:8px;max-height:200px;overflow:auto;padding:2px;"></div></div>'; // 22.09-154: padding-right:75px удалён — строки работ во всю ширину окна
    html += '<div id="f-attr-panel"></div>';
    html += '<div class="calc" id="f-calc">Выберите объект и работы — система рассчитает трудозатраты автоматически.</div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-task">' + btnText + '</button></div>';
    modal.style.maxWidth = ''; // сброс инлайн-ширины (напр. 60% у Excel-модалки); ширину задаёт CSS max-width:fit-content
    modal.innerHTML = html;
    overlay.classList.add('show');

    /* 22.09-147: объект выбран/сменился — АВТОвыбранные строки переподбираем
       под его параметры (линии редуцирования, телеметрия и др. — как автоподбор
       графика). Загруженные из сохранённой задачи виды закреплены и не меняются. */
    // 22.09-150: плановая дата задачи (для сезонного фильтра автовыбора)
    function taskFormDateISO() {
      var el = document.getElementById('f-day');
      return (el && /^\d{4}-\d{2}-\d{2}$/.test(el.value)) ? el.value : '';
    }
    function reautoTaskWorks() {
      var midEl = document.getElementById('f-master');
      var m = midEl ? masterById(midEl.value) : null;
      var ch = taskReautoWorks(m ? m.area : null, S.taskModalWorks, S.taskModalWorksAuto, S.taskModalObjId, taskFormDateISO());
      if (ch) toast('ok', '🔁 Виды работ переподобраны под объект и сезон: ' + ch + ' шт.');
    }
    function renderTaskWorksList(highlightIdx) {
      var cont = document.getElementById('f-work-list'); if (!cont) return;
      var mid = document.getElementById('f-master').value;
      var m = masterById(mid);
      var area = m ? m.area : null;
      var works = area ? WORK.getWorks(area) : [];
      if (!works.length) {
        cont.innerHTML = '<div class="empty" style="padding:10px;font-size:12px;">— нет работ для участка —</div>';
        recalc(); return;
      }
      var htmlStr = '';
      if (!S.taskModalWorks.length) {
        // пусто (новая задача или все виды удалены) — предлагаем добавить («+» работает и здесь)
        htmlStr += '<div style="border:1.5px dashed var(--line);border-radius:10px;padding:14px 10px;text-align:center;background:var(--panel-2)">' +
          '<button type="button" class="work-add-btn" data-idx="-1" style="margin:0 auto;" title="Добавить вид работ">+</button>' +
          '<div style="font-size:12.5px;color:var(--muted);margin-top:6px">Вид работ не выбран — нажмите «+», чтобы добавить</div>' +
          '</div>';
      }
      S.taskModalWorks.forEach(function(selectedWid, idx) {
        var widOk = works.some(function(w) { return w.id === selectedWid; });
        // 22.09-153: пустая строка остаётся ПУСТОЙ («— выберите вид работ —») — ничего не подставляем
        // Объём этой работы (свой у каждого вида)
        var volVal = 1;
        if (S.taskModalVols && S.taskModalVols.length > idx) {
          var _pv = parseFloat(S.taskModalVols[idx]);
          if (isFinite(_pv) && _pv > 0) volVal = _pv;
        }
        var wSel = null;
        works.forEach(function(w) { if (w.id === selectedWid) wSel = w; });
        var unitSel = wSel ? wSel.unit : 'объект';
        /* 22.09-153: СТРОКА = карточка вида работ + её СОБСТВЕННЫЕ кнопки СПРАВА
           от карточки (снаружи, не внутри): зелёная «+» высотой во ВЕСЬ БЛОК,
           ещё правее — «×». У каждого вида работ — свои «+» и «×». */
        htmlStr += '<div style="display:flex;gap:8px;align-items:stretch">';
        htmlStr += '<div class="work-item' + (idx === highlightIdx ? ' work-row-new' : '') + '" style="flex:1;min-width:0">';
        htmlStr += '<div class="work-row">';
        // 22.09-146/153: выбор между ГРУППАМИ работ; пустая строка — «— выберите вид работ —»
        htmlStr += '<select class="task-work-sel" data-idx="' + idx + '" title="' + esc(wSel ? wSel.name : '') + '" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--card);font-family:inherit;">';
        if (!widOk) htmlStr += '<option value="">— выберите вид работ —</option>'; // 22.09-153: пустая строка
        htmlStr += taskWorkOptionsHtml(area, works, selectedWid, S.taskModalObjId, taskFormDateISO());
        htmlStr += '</select>';
        /* 22.09-155: 🎯 — ВНУТРИ карточки работы, сразу СПРАВА от выпадающего
           списка групп; сделана заметной (светло-синяя заливка, рамка), чтобы
           кнопку было видно с первого взгляда */
        htmlStr += '<button type="button" class="btn sm work-pick-btn" data-idx="' + idx + '" title="Точный выбор работы в этой группе: весь список работ группы с полными названиями" style="flex:0 0 auto;padding:7px 9px;background:#eff6ff;border:1.5px solid #93c5fd;color:#1d4ed8;border-radius:8px;font-size:13px;line-height:1">🎯</button>';
        htmlStr += '</div>';
        htmlStr += '<div class="vol-input" title="Объём работ для этого вида">' +
          '<input class="task-vol-input" data-idx="' + idx + '" type="number" step="0.01" min="0.01" value="' + volVal + '" placeholder="Объём">' +
          '<span class="vol-unit">' + esc(unitSel) + '</span>' +
          '</div>';
        htmlStr += '</div>'; // конец карточки .work-item
        htmlStr += '<button type="button" class="work-add-btn" data-idx="' + idx + '" title="Добавить ещё один вид работ на этот адрес (новая пустая строка встанет после этой)" style="height:auto;align-self:stretch">+</button>';
        htmlStr += '<button type="button" class="btn sm ghost del-work-item" data-idx="' + idx + '" style="color:var(--red);border-color:transparent;padding:4px 8px;font-size:14px;font-weight:bold;align-self:flex-start" title="Убрать этот вид работ">×</button>';
        htmlStr += '</div>'; // конец строки (карточка + «+» + «×»)
      });
      cont.innerHTML = htmlStr;
      cont.querySelectorAll('.task-work-sel').forEach(function(sel) {
        sel.addEventListener('change', function(e) {
          var i = parseInt(e.target.dataset.idx, 10);
          S.taskModalWorks[i] = e.target.value;
          if (S.taskModalWorksAuto) S.taskModalWorksAuto[i] = true; // 22.09-147: из группы — автовыбор, следует за объектом
          renderTaskWorksList(); // перерисовка: обновится единица измерения у объёма
        });
        /* 22.09-157: раскрытый список — «Группа (N)», закрытый — «Группа».
           (после change список перерисовывается целиком — тексты и так чистые) */
        sel.addEventListener('mousedown', function () { grpSelExpandText(sel); });
        sel.addEventListener('keydown', function (e) { if (e.key === 'Escape') grpSelCollapseText(sel); else grpSelExpandText(sel); });
        sel.addEventListener('blur', function () { grpSelCollapseText(sel); });
      });
      cont.querySelectorAll('.task-vol-input').forEach(function(inp) {
        inp.addEventListener('input', function(e) {
          var i = parseInt(e.target.dataset.idx, 10);
          S.taskModalVols[i] = e.target.value;
          recalc();
        });
      });
      cont.querySelectorAll('.del-work-item').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          var i = parseInt(e.currentTarget.dataset.idx, 10);
          S.taskModalWorks.splice(i, 1);
          if (S.taskModalVols) S.taskModalVols.splice(i, 1);
          if (S.taskModalWorksAuto) S.taskModalWorksAuto.splice(i, 1); // 22.09-147
          renderTaskWorksList();
        });
      });
      // 22.09-148: 🎯 — точный выбор работы в группе (закрепляется: за объектом
      // уже не переподбирается, пока группу не сменили заново)
      cont.querySelectorAll('.work-pick-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          var i = parseInt(e.currentTarget.dataset.idx, 10);
          var wid = S.taskModalWorks[i] || '';
          var wCur = null; try { wCur = wid ? WORK.getWork(area, wid) : null; } catch (err) {}
          openExactWorkPickModal(area, gwWorkGroup(wCur), wid, function (newWid) {
            S.taskModalWorks[i] = newWid;
            if (S.taskModalWorksAuto) S.taskModalWorksAuto[i] = false;
            renderTaskWorksList();
          });
        });
      });
      cont.querySelectorAll('.work-add-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          var i = parseInt(e.currentTarget.dataset.idx, 10);
          /* 22.09-153: «+» добавляет ПУСТУЮ строку сразу после своей — вид работ
             пользователь выбирает сам из списка групп (конкретная работа внутри
             выбранной группы подставится автовыбором по параметрам объекта и сезону) */
          S.taskModalWorks.splice(i + 1, 0, '');
          if (S.taskModalVols) S.taskModalVols.splice(i + 1, 0, 1); // у нового вида — свой объём
          if (S.taskModalWorksAuto) S.taskModalWorksAuto.splice(i + 1, 0, true); // 22.09-147
          renderTaskWorksList(i + 1);
          var sels = cont.querySelectorAll('.task-work-sel');
          if (sels[i + 1]) sels[i + 1].focus();
        });
      });
      recalc();
    }

    function recalc() {
      var mid = document.getElementById('f-master').value;
      var m = masterById(mid);
      var area = m ? m.area : null;
      var totalH = 0;
      var workNames = [];
      var attrWarnings = [];
      var firstWork = null;

      S.taskModalWorks.forEach(function(wid) {
        var w = area ? WORK.getWork(area, wid) : null;
        if (w) {
          if (!firstWork) firstWork = w;
          workNames.push(w.name);
        }
      });

      // Панель атрибутов (объём теперь у каждого вида работ — в своём блоке)
      var ap = document.getElementById('f-attr-panel');
      if (ap && firstWork) {
        // Динамическая метка дедлайна
        var dlLabel = document.getElementById('f-dl-label');
        if (dlLabel) dlLabel.textContent = firstWork.needs_permit ? 'Срок истечения ордера' : 'Дедлайн';

        var ah = '';
        // Метки атрибутов
        ah += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">';
        if (firstWork.needs_permit) ah += '<span class="permit-badge">📋 Требуется ордер</span>';
        if (firstWork.depends_on_snow) ah += '<span class="snow-badge">❄️ Зависит от снегопада</span>';
        if (firstWork.min_temp > -50) ah += '<span class="weather-badge">🌡️ Мин. t: +' + firstWork.min_temp + '°C</span>';
        if (firstWork.equipment && firstWork.equipment !== '—') ah += '<span class="equipment-badge">🚜 ' + esc(firstWork.equipment) + '</span>';
        ah += '</div>';

        // Подсказки
        if (firstWork.needs_permit) attrWarnings.push('📋 Дедлайн обязателен — укажите срок ордера');
        if (firstWork.depends_on_snow) attrWarnings.push('❄️ Дедлайн = дата снегопада + норматив реагирования (48 ч)');
        if (firstWork.min_temp > -50) attrWarnings.push('🌡️ Работа не планируется при t ниже +' + firstWork.min_temp + '°C');

        ap.innerHTML = ah;
      } else if (ap) {
        ap.innerHTML = ''; // 22.09-153: вид работ не выбран — панель атрибутов пустая
      }

      // Расчёт трудозатрат: у каждого вида работ СВОЙ объём
      var calcParts = [];
      S.taskModalWorks.forEach(function(wid, i) {
        var w = area ? WORK.getWork(area, wid) : null;
        if (!w) return;
        var vol = parseFloat(S.taskModalVols && S.taskModalVols[i]);
        if (!isFinite(vol) || vol <= 0) vol = 1;
        var h = w.norm * vol;
        totalH += h;
        calcParts.push({ name: w.name, norm: w.norm, vol: vol, unit: w.unit, h: h });
      });

      // Предупреждение о повторяющемся виде работы
      var seenMap = {}, hasDup = false;
      S.taskModalWorks.forEach(function(wid) { if (wid) { if (seenMap[wid]) hasDup = true; seenMap[wid] = true; } });
      // Разбивка по видам работ (сколько часов даёт каждый со своим объёмом)
      var fmtVol = function (v) { return (Math.round(v * 100) / 100).toString().replace('.', ','); };
      var singleVolStr = calcParts.length === 1 ? ' (объём ' + fmtVol(calcParts[0].vol) + ' ' + calcParts[0].unit + ')' : '';
      // .calc — flex-column: каждая строка ЦЕЛЬНЫМ div-элементом (фрагменты текста/<b>/<span>
      // НЕ должны становиться отдельными flex-элементами — иначе строки разорвутся)
      if (totalH > 0) {
        var calcLines = [];
        calcLines.push('📏 <b>Общие трудозатраты: ' + fmtH(totalH) + ' чел/ч</b>' + (calcParts.length > 1 ? ' — ' + calcParts.length + ' вида работ' : '') + singleVolStr);
        if (calcParts.length > 1) {
          calcParts.forEach(function (p) {
            calcLines.push('<span style="color:var(--txt);">— ' + esc(p.name) + ': ' + fmtH(p.norm) + ' ч × ' + fmtVol(p.vol) + ' ' + esc(p.unit) + ' = <b>' + fmtH(p.h) + ' ч</b></span>');
          });
        }
        attrWarnings.forEach(function (w) { calcLines.push('<span style="color:#92400e;">' + w + '</span>'); });
        if (hasDup) calcLines.push('<span style="color:var(--red);">⚠ Повтор: один и тот же вид работы выбран больше одного раза — трудозатраты задвоятся</span>');
        document.getElementById('f-calc').innerHTML = calcLines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
      } else {
        document.getElementById('f-calc').innerHTML = 'Выберите работу.';
      }
    }

    // ---------- Выбор объекта из справочника (ГРП/ШРП) ----------
    function updateObjPickUI() {
      var btn = document.getElementById('btn-pick-obj');
      var hint = document.getElementById('f-obj-hint');
      var o = S.taskModalObjId ? OBJ_MAP[S.taskModalObjId] : null;
      if (btn) {
        if (o) {
          btn.style.background = 'var(--green-l)'; btn.style.borderColor = 'var(--green)'; btn.style.color = 'var(--green)';
          btn.innerHTML = '✓ ' + esc(o.type || 'Объект') + (objNumOf(o) ? ' №' + esc(objNumOf(o)) : '');
          btn.title = 'Объект привязан: ' + objFullAddr(o);
        } else {
          btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = '';
          btn.innerHTML = '📍 Выбор объекта';
          btn.title = 'Выбрать ГРП/ШРП из справочника объектов — адрес и координаты подставятся автоматически';
        }
      }
      if (hint) hint.innerHTML = o
        ? '✓ Адрес и координаты возьмутся из справочника объектов' + ((o.lat != null && o.lng != null) ? ' (📍 ' + (+o.lat).toFixed(5) + ', ' + (+o.lng).toFixed(5) + ')' : ' — координаты не заданы, будет геокодирование')
        : (S.taskModalMapCoords
            ? '📍 Точка выбрана на карте (' + (+S.taskModalMapCoords.lat).toFixed(5) + ', ' + (+S.taskModalMapCoords.lng).toFixed(5) + ') — задача встанет точно туда'
            : '');
    }
    function closeObjectPicker() {
      var ex = document.getElementById('obj-picker-overlay');
      if (ex) ex.remove();
      // снимать Esc-обработчик при ЛЮБОМ закрытии пикера (иначе он «утекает»
      // и накапливается — лишние Escape закрывали пикер/карту неожиданно)
      objPickRemoveEsc();
    }
    function openObjectPicker() {
      closeObjectPicker();
      var grps = [], shrps = [], other = [];
      OBJECTS.forEach(function (o) {
        if (!o || o.type === 'Область') return; // области (полигоны) в задание не выбираются
        if (o.type === 'ГРП') grps.push(o);
        else if (o.type === 'ШРП') shrps.push(o);
        else other.push(o); // «Прочие» — включая трассы/просеки, созданные как область
      });
      function byNum(a, b) {
        var na = parseInt(objNumOf(a), 10) || 0, nb = parseInt(objNumOf(b), 10) || 0;
        return (na - nb) || String(objNumOf(a)).localeCompare(String(objNumOf(b)), 'ru');
      }
      grps.sort(byNum); shrps.sort(byNum);
      var ov = document.createElement('div');
      ov.id = 'obj-picker-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,39,64,.62);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto';
      ov.innerHTML = '<div class="modal" style="max-width:920px">' +
        '<div class="modal-h"><h3>Выбор объекта</h3><button class="x" type="button" id="obj-pick-close">×</button></div>' +
        '<div class="modal-b">' +
        '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:stretch">' +
        '<input id="obj-pick-search" placeholder="🔍 Поиск по номеру или адресу…" style="flex:1;min-width:0;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit">' +
        '<button type="button" id="obj-pick-map" title="Выбрать объект или точку на карте — все ГРП/ШРП справочника на карте" style="flex:0 0 auto;white-space:nowrap;padding:9px 13px;border:1px solid #2563eb;border-radius:8px;background:#2563eb;color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s">🗺️ Выбрать на карте</button>' +
        '</div>' +
        // ТРИ КОЛОНКИ: слева «Прочие», посередине «ШРП», справа «ГРП»;
        // на узких экранах колонки переносятся вниз (flex-wrap)
        '<div id="obj-pick-cols" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start">' +
        '<div id="obj-pick-col-other" style="flex:1 1 200px;min-width:0"></div>' +
        '<div id="obj-pick-col-shrp" style="flex:1 1 200px;min-width:0"></div>' +
        '<div id="obj-pick-col-grp" style="flex:1 1 200px;min-width:0"></div>' +
        '</div>' +
        '</div></div>';
      document.body.appendChild(ov);

      function renderPickList(filter) {
        var q = (filter || '').toLowerCase().trim();
        function match(o) {
          if (!q) return true;
          return (objFullAddr(o) + ' ' + objNumOf(o) + ' ' + (o.type || '')).toLowerCase().indexOf(q) !== -1;
        }
        // Колонка: заголовок с количеством + свой скролл; карточка объекта — две строки
        // (тип № — цвет секции, ниже — адрес), чтобы читалось в узкой колонке
        function colHtml(title, arr, color, emptyText) {
          var list = arr.filter(match);
          var s = '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin:0 0 6px">' + title + ' (' + list.length + ')</div>';
          if (!list.length) return s + '<div style="padding:6px 2px;color:var(--muted);font-size:12px">' + emptyText + '</div>';
          s += '<div style="max-height:44vh;overflow:auto;padding-right:2px">';
          list.forEach(function (o) {
            var sel = S.taskModalObjId === o.id;
            s += '<button type="button" class="obj-pick-item" data-oid="' + esc(o.id) + '" style="display:flex;flex-direction:column;align-items:stretch;gap:2px;width:100%;text-align:left;padding:8px 10px;margin-bottom:6px;border:1px solid ' + (sel ? 'var(--green)' : 'var(--line)') + ';background:' + (sel ? 'var(--green-l)' : '#fff') + ';border-radius:9px;cursor:pointer;font-family:inherit;font-size:13px' + (sel ? ';box-shadow:0 0 0 2px rgba(22,163,74,.15)' : '') + '">' +
              '<span style="display:flex;align-items:center;gap:6px;min-width:0">' +
              '<span style="font-weight:800;color:' + color + ';white-space:nowrap">' + esc(o.type || 'Объект') + ' №' + esc(objNumOf(o) || '—') + '</span>' +
              (o.lat != null && o.lng != null ? '<span style="font-size:11.5px;color:var(--green);font-weight:700" title="Координаты заданы">📍</span>' : '') +
              '</span>' +
              '<span style="color:var(--muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(o.addr || 'адрес не указан') + '</span>' +
              '</button>';
          });
          return s + '</div>';
        }
        // слева → справа: Прочие, ШРП, ГРП
        var cols = [
          { el: document.getElementById('obj-pick-col-other'), html: colHtml('Прочие', other, '#64748b', other.length ? 'Ничего не найдено' : 'Нет объектов') },
          { el: document.getElementById('obj-pick-col-shrp'), html: colHtml('ШРП', shrps, '#7c3aed', shrps.length ? 'Ничего не найдено' : 'Нет объектов') },
          { el: document.getElementById('obj-pick-col-grp'), html: colHtml('ГРП', grps, '#2563eb', grps.length ? 'Ничего не найдено' : 'Нет объектов') }
        ];
        cols.forEach(function (c) { if (c.el) c.el.innerHTML = c.html; });
      }
      renderPickList('');

      var search = document.getElementById('obj-pick-search');
      if (search) {
        search.focus();
        search.addEventListener('input', function (e) { renderPickList(e.target.value); });
      }

      // ---------- «Выбрать на карте»: карта со всеми объектами справочника ----------
      // Паттерн livemap (защита от зависаний): ВСЕ метки прозрачны для событий
      // (interactivityModel 'default#transparent', hasBalloon/hasHint: false),
      // клики ловит ОДИН map.events.add('click'), облачко — обычный DOM-элемент.
      // Облачка хранят наименование + адрес + кнопку «Выбрать».
      function objMapHideTip() {
        var t = document.getElementById('obj-map-tip'); if (t) t.remove();
        if (objPickMapState.docClick) {
          try { document.removeEventListener('click', objPickMapState.docClick, true); } catch (e) {}
          objPickMapState.docClick = null;
        }
      }
      // DOM-облачко (как lmShowHintTip): позиция из пикселей клика, кнопка «Выбрать»
      function objMapShowTip(header, bodyHtml, evt, onSelect) {
        objMapHideTip();
        var tip = document.createElement('div');
        tip.id = 'obj-map-tip';
        tip.style.cssText = 'position:fixed;z-index:450;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 28px rgba(15,39,64,.3);padding:11px 13px;font-family:inherit;font-size:12.5px;color:var(--ink);max-width:280px;line-height:1.45';
        tip.innerHTML = '<div style="font-weight:800;font-size:12px;color:var(--navy);margin-bottom:3px">' + header + '</div>' + bodyHtml +
          '<button type="button" class="obj-map-select" style="margin-top:9px;width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--green);color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">Выбрать</button>' +
          '<button type="button" class="obj-map-x" title="Закрыть" style="position:absolute;top:4px;right:7px;border:none;background:none;cursor:pointer;font-size:15px;color:#64748b;font-family:inherit;line-height:1">×</button>';
        document.body.appendChild(tip);
        // позиция: пиксели клика, иначе — низ карты по центру
        var x = null, y = null;
        try {
          var pos = (evt && evt.get) ? evt.get('position') : null;
          if (pos && isFinite(pos[0]) && isFinite(pos[1])) { x = pos[0]; y = pos[1]; }
        } catch (e) {}
        var mapEl = document.getElementById('obj-map-canvas');
        if (x == null && mapEl) {
          var r = mapEl.getBoundingClientRect();
          x = r.left + r.width / 2; y = r.bottom - 90;
        }
        if (x == null) { x = window.innerWidth / 2; y = window.innerHeight - 120; }
        var w = tip.offsetWidth || 230, h = tip.offsetHeight || 80;
        x = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2));
        y = Math.max(8, y - h - 16);
        if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
        tip.style.left = Math.round(x) + 'px';
        tip.style.top = Math.round(y) + 'px';
        tip.querySelector('.obj-map-x').addEventListener('click', function (e) { e.stopPropagation(); objMapHideTip(); });
        tip.querySelector('.obj-map-select').addEventListener('click', function (e) {
          e.stopPropagation();
          try { onSelect(); } catch (err) { /* выбор не может ломать форму */ }
        });
        // клик мимо облачка — закрыть (capture на document, как на livemap;
        // через 60мс, чтобы не закрыть тем же кликом, который его открыл)
        setTimeout(function () {
          if (!document.getElementById('obj-map-tip')) return;
          function closer(ev) {
            if (ev && ev.target && tip.contains(ev.target)) return;
            objMapHideTip();
          }
          document.addEventListener('click', closer, true);
          objPickMapState.docClick = closer;
        }, 60);
      }
      // Кружок в точке клика (один, заменяется; прозрачен для событий)
      function objMapShowDot(lat, lng) {
        try {
          var map = objPickMapState.map;
          if (!map) return;
          if (objPickMapState.dot) { try { map.geoObjects.remove(objPickMapState.dot); } catch (e) {} objPickMapState.dot = null; }
          if (!objPickMapState.dotHref) objPickMapState.dotHref = lmDotIcon();
          objPickMapState.dot = new ymaps.Placemark([lat, lng], {}, {
            iconLayout: 'default#image',
            iconImageHref: objPickMapState.dotHref,
            iconImageSize: [18, 18], iconImageOffset: [-9, -9],
            hasBalloon: false, hasHint: false,
            interactivityModel: 'default#transparent',
            pane: 'overlaps'
          });
          map.geoObjects.add(objPickMapState.dot);
        } catch (e) { /* клик не может ломать форму */ }
      }
      // Применить выбранный объект справочника (как выбор из списка)
      function objMapApplyObject(o) {
        S.taskModalObjId = o.id;
        S.taskModalMapCoords = null;
        var inp = document.getElementById('f-obj');
        if (inp) inp.value = objShortAddr(o); // в адресе — только «ГРП №N»
        objPickMapDestroy();
        closeObjectPicker();
        updateObjPickUI();
        reautoTaskWorks();   // 22.09-147
        renderTaskWorksList();
      }
      // Применить «просто адрес» (точка на карте без объекта): адрес + точные координаты
      function objMapApplyPoint(addr, lat, lng) {
        S.taskModalObjId = null;
        S.taskModalMapCoords = { lat: lat, lng: lng };
        var inp = document.getElementById('f-obj');
        if (inp) inp.value = addr;
        objPickMapDestroy();
        closeObjectPicker();
        updateObjPickUI();
        reautoTaskWorks();   // 22.09-147: объект снят — автовыбор без фильтров
        renderTaskWorksList();
      }
      // Облачко объекта: наименование + адрес + «Выбрать»
      function objMapShowObjectTip(o, evt) {
        var title = esc(o.type || 'Объект') + (objNumOf(o) ? ' №' + esc(objNumOf(o)) : '');
        objMapShowTip('🏭 ' + title,
          '<div style="margin-bottom:4px">' + esc(o.addr || 'адрес не указан') + '</div>' +
          ((o.lat != null && o.lng != null)
            ? '<div style="font-size:12px;color:var(--muted)">📍 ' + (+o.lat).toFixed(5) + ', ' + (+o.lng).toFixed(5) + '</div>'
            : '<div style="font-size:12px;color:var(--red)">координаты не заданы — будет геокодирование</div>'),
          evt, function () { objMapApplyObject(o); });
      }
      // Облачко «просто адрес»: обратное геокодирование точки + «Выбрать»
      function objMapShowPointTip(lat, lng, evt) {
        var info = { addr: null };
        objMapShowTip('📍 Точка на карте',
          '<div id="obj-map-addr" style="margin-bottom:4px">⏳ Определяем адрес…</div>' +
          '<div style="font-size:12px;color:var(--muted)">' + (+lat).toFixed(5) + ', ' + (+lng).toFixed(5) + '</div>',
          evt, function () {
            var a = info.addr || ((+lat).toFixed(5) + ', ' + (+lng).toFixed(5));
            objMapApplyPoint(a, lat, lng);
          });
        reverseGeocodeAddr(lat, lng).then(function (name) {
          info.addr = name;
          var el = document.getElementById('obj-map-addr');
          if (el) el.innerHTML = name ? '📍 <b>' + esc(name) + '</b>' : '<span style="color:var(--muted)">Адрес не определён — будет сохранена точка</span>';
        });
      }
      function openObjMapPicker() {
        objPickMapDestroy(); // на всякий случай — старой карты быть не должно
        var withCoords = [];
        OBJECTS.forEach(function (o) {
          if (o && o.type !== 'Область' && o.lat != null && o.lng != null && isFinite(+o.lat) && isFinite(+o.lng)) withCoords.push(o);
        });
        var ov = document.createElement('div');
        ov.id = 'obj-map-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,39,64,.72);z-index:400;display:flex;align-items:stretch;justify-content:center;padding:14px';
        ov.innerHTML =
          '<div style="position:relative;width:100%;max-width:1200px;background:var(--card);border-radius:14px;box-shadow:0 20px 60px rgba(15,39,64,.4);display:flex;flex-direction:column;overflow:hidden">' +
            '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);flex:0 0 auto;flex-wrap:wrap">' +
              '<h3 style="margin:0;font-size:14.5px;color:var(--ink);white-space:nowrap">Выбор на карте</h3>' +
              '<span style="font-size:12.5px;color:var(--muted)">Нажмите на метку объекта или на любую точку карты</span>' +
              '<span style="display:flex;gap:10px;font-size:12px;color:var(--muted);margin-left:auto;white-space:nowrap">' +
                '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2563eb;margin-right:4px"></span>ГРП</span>' +
                '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7c3aed;margin-right:4px"></span>ШРП</span>' +
                '<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#64748b;margin-right:4px"></span>Прочие</span>' +
              '</span>' +
              '<button type="button" id="obj-map-close" title="Закрыть карту (вернуться к списку)" style="border:none;background:none;cursor:pointer;font-size:19px;color:#64748b;font-family:inherit;line-height:1;padding:2px 6px">×</button>' +
            '</div>' +
            '<div id="obj-map-canvas" style="flex:1 1 auto;min-height:0;background:var(--panel-2)"></div>' +
            '<div style="padding:6px 14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);flex:0 0 auto">Объектов с координатами на карте: ' + withCoords.length + ' из ' + OBJECTS.length + (withCoords.length < OBJECTS.length ? ' — без координат ищите в списке' : '') + '</div>' +
          '</div>';
        document.body.appendChild(ov);
        // ВСЕ поиски внутри оверлея карты (ov.querySelector) — id не могут
        // конфликтовать с элементами вне окна (кнопка пикера и контейнер карты
        // больше не делят один id)
        var closeBtn = ov.querySelector('#obj-map-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { objPickMapDestroy(); });
        var canvas = ov.querySelector('#obj-map-canvas');
        if (canvas) canvas.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;padding:30px">' +
          '<div class="skel" style="width:75%;height:26px"></div>' +
          '<div class="skel" style="width:55%;height:26px"></div>' +
          '<div class="skel" style="width:85%;height:26px"></div>' +
          '<div class="skel" style="width:45%;height:26px"></div>' +
          '<div style="font-size:12.5px;font-weight:700;color:var(--muted);margin-top:4px">⏳ Загружаем карту…</div></div>';
        ensureYandex(function () {
          if (!document.getElementById('obj-map-overlay')) return; // окно уже закрыли
          var holder = ov.querySelector('#obj-map-canvas');
          if (!holder) return;
          holder.innerHTML = '';
          try {
            var map = new ymaps.Map(holder, {
              center: [53.9023, 27.5619], zoom: 11,
              controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
            }, { suppressMapOpenBlock: true });
            objPickMapState.map = map;
            // Все объекты справочника с координатами (метки прозрачны — клики ловит карта).
            // Если объектов много (>50) — кластеризация: кучные метки схлопываются
            // в кружки с количеством, клик по кластеру приближает его область.
            // Кластер и метки без балунов; клики объектов идут через обработчик карты.
            var bLat1 = null, bLng1 = null, bLat2 = null, bLng2 = null;
            var placemarks = [];
            withCoords.forEach(function (o) {
              var la = +o.lat, ln = +o.lng;
              var color = (o.type === 'ГРП') ? '#2563eb' : (o.type === 'ШРП') ? '#7c3aed' : '#64748b';
              placemarks.push(new ymaps.Placemark([la, ln], {}, {
                iconLayout: 'default#image',
                iconImageHref: lmSvgIcon(objNumOf(o) || '·', color, 32),
                iconImageSize: [32, 32], iconImageOffset: [-16, -16],
                hasBalloon: false, hasHint: false,
                interactivityModel: 'default#transparent'
              }));
              if (bLat1 == null || la < bLat1) bLat1 = la;
              if (bLat2 == null || la > bLat2) bLat2 = la;
              if (bLng1 == null || ln < bLng1) bLng1 = ln;
              if (bLng2 == null || ln > bLng2) bLng2 = ln;
            });
            if (withCoords.length > 50 && window.ymaps.Clusterer) {
              try {
                var clusterer = new ymaps.Clusterer({
                  hasBalloon: false, hasHint: false,
                  clusterHasBalloon: false, clusterHasHint: false,
                  clusterDisableClickZoom: true, // зумим сами (безопасный одиночный обработчик)
                  clusterIconColor: '#2563eb',
                  gridSize: 64
                });
                clusterer.add(placemarks);
                map.geoObjects.add(clusterer);
                // ОДНА подписка на клики по кластерам — приблизить область кластера
                // (аналог map.events.add: один обработчик, никаких балунов)
                clusterer.events.add('click', function (e) {
                  try {
                    var t = (e && e.get) ? e.get('target') : null;
                    if (t && typeof t.getBounds === 'function') {
                      var b = t.getBounds();
                      if (b) map.setBounds(b, { checkZoomRange: true, zoomMargin: 30 });
                    }
                  } catch (err) { /* клик по кластеру не может ломать форму */ }
                });
              } catch (e) {
                placemarks.forEach(function (pm) { map.geoObjects.add(pm); });
              }
            } else {
              placemarks.forEach(function (pm) { map.geoObjects.add(pm); });
            }
            if (withCoords.length > 1) {
              try { map.setBounds([[bLat1, bLng1], [bLat2, bLng2]], { checkZoomRange: true, zoomMargin: 40 }); } catch (e) {}
            } else if (withCoords.length === 1) {
              map.setCenter([+withCoords[0].lat, +withCoords[0].lng], 14);
            }
            // ЕДИНСТВЕННЫЙ обработчик кликов (объекты ~20px, иначе — точка на карте)
            map.events.add('click', function (e) {
              try {
                objMapHideTip();
                var c = (e && e.get) ? e.get('coords') : null;
                if (!c || c[0] == null || !isFinite(c[0]) || !isFinite(c[1])) return;
                var lat = c[0], lng = c[1];
                var zoom = map.getZoom();
                var mPerPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
                var R = 20 * mPerPx / 111320; // ~20px вокруг метки объекта
                var best = null, bestD2 = R * R;
                for (var i = 0; i < withCoords.length; i++) {
                  var o = withCoords[i];
                  var dy = +o.lat - lat, dx = +o.lng - lng, d2 = dy * dy + dx * dx;
                  if (d2 < bestD2) { bestD2 = d2; best = o; }
                }
                if (best) { objMapShowObjectTip(best, e); return; } // метка — без кружка, облачко у метки
                objMapShowDot(lat, lng);
                objMapShowPointTip(lat, lng, e);
              } catch (err) { /* клик по карте не может ломать форму */ }
            });
          } catch (e) {
            toast('err', 'Не удалось открыть карту');
            objPickMapDestroy();
          }
        }, function () {
          toast('err', 'Карта недоступна — проверьте интернет');
          objPickMapDestroy();
        });
      }

      function onPickClick(e) {
        if (e.target.closest && e.target.closest('#obj-pick-map')) { openObjMapPicker(); return; }
        var item = e.target.closest('.obj-pick-item');
        if (item) {
          var o = OBJ_MAP[item.dataset.oid];
          if (o) {
            S.taskModalObjId = o.id;
            var inp = document.getElementById('f-obj');
            if (inp) inp.value = objShortAddr(o); // в адресе — только «ГРП №N»
          }
          closeObjectPicker();
          updateObjPickUI();
          reautoTaskWorks();   // 22.09-147: переподбор под объект
          renderTaskWorksList();
          return;
        }
        if (e.target.id === 'obj-pick-close' || e.target === ov) { closeObjectPicker(); }
      }
      ov.addEventListener('click', onPickClick);
      objPickRemoveEsc(); // предыдущего обработчика быть не должно
      objPickMapState.esc = function (e) {
        if (e.key === 'Escape') {
          // если открыта карта — Escape закрывает сначала её (пикер остаётся)
          if (document.getElementById('obj-map-overlay')) { objPickMapDestroy(); return; }
          closeObjectPicker();
        }
      };
      document.addEventListener('keydown', objPickMapState.esc);
    }

    var btnPickObj = document.getElementById('btn-pick-obj');
    if (btnPickObj) btnPickObj.addEventListener('click', openObjectPicker);
    // 22.09-150: сменили плановую дату — сезон другой, автовыбранные работы переподбираем
    var fDayInput = document.getElementById('f-day');
    if (fDayInput) fDayInput.addEventListener('change', function () { reautoTaskWorks(); renderTaskWorksList(); });
    var fObjInput = document.getElementById('f-obj');
    if (fObjInput) fObjInput.addEventListener('input', function () {
      // Ручное редактирование адреса снимает привязку к объекту справочника
      // и точку, выбранную на карте (адрес изменился — координаты устарели)
      if (S.taskModalObjId || S.taskModalMapCoords) {
        S.taskModalObjId = null; S.taskModalMapCoords = null; updateObjPickUI();
        reautoTaskWorks();   // 22.09-147
        renderTaskWorksList();
        return;
      }
      recalc();
    });
    updateObjPickUI();

    // Слесарь/Бригада: строки с выпадающими списками (как у видов работ);
    // для 2+ слесарей — кнопка «+» добавляет ещё список;
    // «👷 Вся бригада участка» — все слесари участка одним выбором
    function renderSlesariList() {
      var cont = document.getElementById('f-slesar-list'); if (!cont) return;
      var mid = document.getElementById('f-master').value;
      var m = masterById(mid);
      var area = m ? m.area : null;
      var list = (DB.getUsers() || []).filter(function (u) {
        return u && u.role === 'slesar' && u.active && (area ? u.area === area : true);
      });
      // убрать из выбранных тех, кто не из участка выбранного мастера
      S.taskModalSlesari = (S.taskModalSlesari || []).filter(function (id) {
        return list.some(function (u) { return u.id === id; });
      });
      var lbl = document.getElementById('f-slesar-label');
      if (lbl) {
        lbl.textContent = 'Слесарь/Бригада' + (S.taskModalBrigade ? ' — вся бригада' : (S.taskModalSlesari.length ? ' — выбрано: ' + S.taskModalSlesari.length : ''));
      }
      if (!list.length && !S.taskModalBrigade) {
        cont.innerHTML = '<div class="empty" style="padding:8px 10px;font-size:12px;border:1px solid var(--line);border-radius:8px;">— нет слесарей на участке «' + esc(area || '—') + '» (добавьте их в «Пользователях» с ролью «Слесарь») —</div>';
        return;
      }
      function slRowHtml(idx, uid) {
        var isBrig = uid === '__brig__';
        var r = '<div style="display:flex;gap:6px;align-items:center">';
        r += '<select class="f-sl-sel" data-idx="' + idx + '" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--card);font-family:inherit;">';
        r += '<option value="__brig__"' + (isBrig ? ' selected' : '') + '>👷 Вся бригада участка (' + list.length + ' чел.)</option>';
        list.forEach(function (u) {
          var taken = !isBrig && S.taskModalSlesari.indexOf(u.id) !== -1 && u.id !== uid;
          r += '<option value="' + esc(u.id) + '"' + (u.id === uid ? ' selected' : '') + (taken ? ' disabled' : '') + '>' + esc(u.full_name) + (taken ? ' (уже выбран)' : '') + '</option>';
        });
        r += '</select>';
        if (!isBrig) r += '<button type="button" class="work-add-btn f-sl-add" data-idx="' + idx + '" title="Добавить ещё одного слесаря">+</button>';
        r += '<button type="button" class="btn sm ghost f-sl-del" data-idx="' + idx + '" style="color:var(--red);border-color:transparent;padding:4px 8px;font-size:14px;font-weight:bold;" title="Убрать слесаря">×</button>';
        r += '</div>';
        return r;
      }
      var h = '';
      if (S.taskModalBrigade) {
        h += slRowHtml(-1, '__brig__'); // режим бригады — одна строка
      } else if (!S.taskModalSlesari.length) {
        h += '<div style="border:1.5px dashed var(--line);border-radius:10px;padding:10px;text-align:center;background:var(--panel-2)">' +
          '<button type="button" class="work-add-btn f-sl-add" data-idx="-1" style="margin:0 auto;" title="Добавить слесаря">+</button>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:5px">Слесарь не выбран — нажмите «+» или выберите «Вся бригада»</div></div>';
      } else {
        S.taskModalSlesari.forEach(function (uid, i) { h += slRowHtml(i, uid); });
      }
      cont.innerHTML = h;
      cont.querySelectorAll('.f-sl-sel').forEach(function (sel) {
        sel.addEventListener('change', function () {
          if (sel.value === '__brig__') {           // выбрали всю бригаду
            S.taskModalBrigade = true;
            S.taskModalSlesari = [];
          } else if (S.taskModalBrigade) {          // сменили бригаду на конкретного слесаря
            S.taskModalBrigade = false;
            S.taskModalSlesari = [sel.value];
          } else {
            S.taskModalSlesari[parseInt(sel.dataset.idx, 10)] = sel.value;
          }
          renderSlesariList();
        });
      });
      cont.querySelectorAll('.f-sl-add').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = parseInt(btn.dataset.idx, 10);
          if (S.taskModalBrigade) { S.taskModalBrigade = false; S.taskModalSlesari = []; }
          var nextUid = '';
          for (var k = 0; k < list.length; k++) {
            if (S.taskModalSlesari.indexOf(list[k].id) === -1) { nextUid = list[k].id; break; }
          }
          if (!nextUid && list.length) nextUid = list[0].id;
          S.taskModalSlesari.splice(i + 1, 0, nextUid);
          renderSlesariList();
        });
      });
      cont.querySelectorAll('.f-sl-del').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (S.taskModalBrigade) { S.taskModalBrigade = false; S.taskModalSlesari = []; }
          else S.taskModalSlesari.splice(parseInt(btn.dataset.idx, 10), 1);
          renderSlesariList();
        });
      });
    }
    document.getElementById('f-master').addEventListener('change', function () {
      // смена мастера: его бригада (страница «Работники») подставляется автоматически
      var brig = wkBrigadeOf(this.value);
      if (brig.length) {
        S.taskModalSlesari = brig.map(function (u) { return u.id; });
        S.taskModalBrigade = false;
      }
      renderTaskWorksList(); renderSlesariList();
    });
    // Новая задача: если у мастера по умолчанию есть бригада — его работники
    // автоматически выбраны исполнителями («в качестве бригады»)
    if (!isEdit) {
      var _brigInit = wkBrigadeOf(document.getElementById('f-master') ? document.getElementById('f-master').value : null);
      if (_brigInit.length) S.taskModalSlesari = _brigInit.map(function (u) { return u.id; });
    }
    renderSlesariList();
    var fAreaInp = document.getElementById('f-area');
    if (fAreaInp) fAreaInp.addEventListener('input', recalc);
    renderTaskWorksList();
    // Режим только просмотра для «Начальник СЭОГС»
    if (S.role === 'viewer') {
      modal.querySelectorAll('input, select, textarea, .work-add-btn, .del-work-item, .f-sl-del, #btn-pick-obj').forEach(function (el) { el.disabled = true; });
      var _vh3 = modal.querySelector('.modal-h h3'); if (_vh3) _vh3.textContent = 'Просмотр задачи';
      var _vsb = modal.querySelector('[data-action="save-task"]'); if (_vsb) _vsb.style.display = 'none';
      var _vcb = modal.querySelector('[data-action="close-modal"]'); if (_vcb) _vcb.textContent = 'Закрыть';
    }
  }
  function saveTask() {
    var addr = document.getElementById('f-obj').value.trim();
    // Работы + СВОЙ объём у каждой (параллельные массивы)
    var _pairs = [];
    (S.taskModalWorks || []).forEach(function (wid, i) {
      if (!wid) return;
      var v = parseFloat(S.taskModalVols && S.taskModalVols[i]);
      _pairs.push({ wid: wid, vol: (isFinite(v) && v > 0) ? v : 1 });
    });
    var worksArr = _pairs.map(function (p) { return p.wid; });
    var volsArr = _pairs.map(function (p) { return p.vol; });
    var slesariArr = S.taskModalBrigade ? [] : (S.taskModalSlesari || []).slice();
    var brigadeFlag = !!S.taskModalBrigade;
    var volume = volsArr.length ? volsArr[0] : 1; // обратная совместимость (старые отчёты)
    if (!addr) { toast('err', 'Введите адрес объекта'); return; }
    if (!worksArr.length) { toast('err', 'Выберите вид работы'); return; }
    var dlDate = document.getElementById('f-dl-date') ? document.getElementById('f-dl-date').value : '';
    var dayStr = document.getElementById('f-day').value;
    var off = 1;
    if (dayStr) { var picked = new Date(dayStr + 'T00:00:00'); if (!isNaN(picked.getTime())) off = dateToOff(picked); }
    // Привязанный объект справочника (кнопка «Выбор объекта») — приоритетнее поиска по тексту
    var boundObj = S.taskModalObjId ? OBJ_MAP[S.taskModalObjId] : null;
    var o = null;
    if (boundObj) {
      addr = objShortAddr(boundObj); // в адресе задачи — только «ГРП №N» (улица хранится в справочнике)
      var _fObj = document.getElementById('f-obj'); if (_fObj) _fObj.value = addr;
      o = boundObj;
    } else {
      o = findObjectByAddr(addr);
    }
    // Источник координат: 'object' — из справочника (не перезабивается геокодером),
    // 'map' — точка, выбранная на карте («Выбрать на карте» без объекта), 'geocode' — из геокодера
    var coordSrc = (o && o.lat != null && o.lng != null) ? 'object' : (S.taskModalMapCoords ? 'map' : 'geocode');

    // Определяем атрибуты работы
    var m = masterById(document.getElementById('f-master').value);
    var area = m ? m.area : null;
    var w0 = area ? WORK.getWork(area, worksArr[0]) : null;
    var needsPermit = w0 && w0.needs_permit;
    var snowDep = w0 && w0.depends_on_snow;
    if (needsPermit && !dlDate) { toast('warn', '⚠ Эта работа требует ордера — укажите дату дедлайна (срок ордера)'); }

    var dl = dlDate ? dateToOff(new Date(dlDate + 'T00:00:00')) : 7;

    // === ГЕОКОДИРОВАНИЕ: получаем координаты один раз и сохраняем в задачу ===
    // Точка с карты («Выбрать на карте») — точные координаты клика, геокодер не нужен
    var initLat = o ? o.lat : (S.taskModalMapCoords ? S.taskModalMapCoords.lat : null);
    var initLng = o ? o.lng : (S.taskModalMapCoords ? S.taskModalMapCoords.lng : null);

    // Геокодирование напрямую через Nominatim (на русском, перевод не нужен)
      function finalizeSave(coords) {
        var lat = initLat, lng = initLng;
        if (coords) { lat = coords.lat; lng = coords.lng; }

        if (S.editTaskId) {
          var ex = findTask(S.editTaskId);
          if (ex) {
            var _oldEM = ex.m, _oldED = ex.d;
            if (!canEditTask(ex)) { toast('err', 'Нет прав'); return; }
            planUndoPush('редактирование задачи «' + ((workOf(ex) || {}).name || '?') + '»'); // 22.09-225: снимок до правки
            ex.addr = addr; ex.o = o ? o.id : null; ex.works = worksArr; ex.w = worksArr[0];
            ex.m = document.getElementById('f-master').value; ex.d = off; ex.dl = dl;
            ex.volume = volume; ex.volumes = volsArr; ex.slesari = slesariArr; ex.brigade = brigadeFlag; ex.dl_date = dlDate; ex.needs_permit = needsPermit; ex.depends_on_snow = snowDep;
            ex.lat = lat; ex.lng = lng; ex.coord_src = coordSrc;
            if ((ex.s || ex.status) === 'done') stampTaskDoneDate(ex, true); // 22.09-181: закрытая без даты — проставить
            var _opEl = document.getElementById('f-offplan');
            if (_opEl && _opEl.checked) ex.offplan = true; else delete ex.offplan;
            if (TASKS_DB) { TASKS_DB.updateTask(ex.id, ex); S.tasks = TASKS_DB.getTasks(); }
            invalidateRouteCache(_oldEM, _oldED);
            invalidateRouteCache(ex.m, ex.d);
            logAction('Редактирование задачи', ex.addr || addr);
            closeTaskObjectPickers();
            overlay.classList.remove('show');
            var _wEdit = wkOffDayWarn(ex.m, ex.d);
            if (_wEdit) toast('warn', _wEdit);
            toast('ok', '✓ Задача обновлена'); refresh(); return;
          }
        }
        var offplanEl = document.getElementById('f-offplan');
        var offplan = !!(offplanEl && offplanEl.checked);
        var t = {
          id: 't' + Date.now(), addr: addr, o: o ? o.id : null, w: worksArr[0], works: worksArr,
          m: document.getElementById('f-master').value, d: off, dl: dl, s: 'plan', status: 'plan',
          volume: volume, volumes: volsArr, slesari: slesariArr, brigade: brigadeFlag, dl_date: dlDate, needs_permit: needsPermit, depends_on_snow: snowDep,
          min_temp: w0 ? w0.min_temp : -50, equipment: w0 ? w0.equipment : '—',
          lat: lat, lng: lng, coord_src: coordSrc
        };
        if (offplan) t.offplan = true; // «вне плана» — график не затрагивается
        if (TASKS_DB) { TASKS_DB.addTask(t); S.tasks = TASKS_DB.getTasks(); } else { S.tasks.push(t); }
        // Созданная в планировании задача входит в график (объект графика с
        // периодичностью) и серия продолжает строиться по периодичности.
        // Задачи «вне плана» график не меняют.
        if (!offplan && t.o) { try { graphSeriesOnCreate(t); } catch (e) {} }
        invalidateRouteCache(t.m, t.d);
        closeTaskObjectPickers();
        overlay.classList.remove('show');
        logAction('Создание задачи', addr + ' (' + fmtH(taskHours(t)) + ' ч)');
        var _wNew = wkOffDayWarn(t.m, t.d);
        if (_wNew) toast('warn', _wNew);
        toast('ok', 'Заявка добавлена: ' + addr + ' (' + fmtH(taskHours(t)) + ' ч)');
        refresh();
      }

      if (initLat != null && initLng != null) {
        finalizeSave(null);
      } else {
        geocodeAddressUnified(addr).then(finalizeSave);
      }
  }

  /* =====================================================================
     ИМПОРТ ЗАДАЧ ИЗ EXCEL 
     ===================================================================== */
  var excelDemoRows = [];
  function openTasksExcelModal() {
    var modal = document.getElementById('modal');
    var overlay = document.getElementById('overlay');
    var html = '<div class="modal-h"><h3>📥 Импорт задач из Excel с валидацией </h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div style="margin-bottom:14px;background:var(--panel-2);padding:12px;border-radius:8px;border:1px solid var(--line);font-size:12.5px;line-height:1.5;">';
    html += '<b>Алгоритм автовалидации:</b>';
    html += '<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">';
    html += '<div>🟨 <span style="background:#fef9c3;padding:1px 6px;border-radius:4px;border:1px solid #facc15;color:#854d0e;font-weight:600;">Желтый</span> — Адрес не найден в справочнике Панорамы (требуется ручной ввод координат).</div>';
    html += '<div>🟥 <span style="background:#fee2e2;padding:1px 6px;border-radius:4px;border:1px solid #f87171;color:#b91c1c;font-weight:600;">Красный</span> — Ответственный мастер не найден в кадровой системе.</div>';
    html += '<div>🟧 <span style="background:#ffedd5;padding:1px 6px;border-radius:4px;border:1px solid #fb923c;color:#c2410c;font-weight:600;">Оранжевый</span> — Вид работы не найден в справочнике норм времени.</div>';
    html += '<div>🟩 <span style="background:#dcfce7;padding:1px 6px;border-radius:4px;border:1px solid #4ade80;color:#15803d;font-weight:600;">Зеленый</span> — Строка прошла валидацию на 100%.</div>';
    html += '</div></div>';
    html += '<div style="display:flex;gap:10px;margin-bottom:16px;">';
    html += '<button class="btn primary" data-action="excel-demo-load" style="background:#10b981;border-color:#10b981;">📑 Загрузить тестовый пример</button>';
    html += '<label class="btn ghost" style="cursor:pointer;border-color:var(--blue);color:var(--blue);">📂 Выбрать файл .xlsx / .csv<input type="file" id="tasks-excel-file-inp" accept=".xlsx,.xls,.csv" style="display:none"></label>';
    html += '</div>';
    html += '<div id="excel-import-preview-container"><div class="empty" style="padding:30px 0;">Нажмите «Загрузить тестовый пример» или выберите файл Excel для предпросмотра</div></div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="excel-import-confirm" id="btn-excel-conf" style="display:none;">✔ Утвердить и импортировать в план</button></div>';
    modal.innerHTML = html;
    modal.style.maxWidth = '60%';
    overlay.classList.add('show');

    var fi = document.getElementById('tasks-excel-file-inp');
    if (fi) fi.addEventListener('change', function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      parseTasksExcelFile(file);
    });
  }

  function loadDemoExcelData() {
    excelDemoRows = [
      { addr: 'ул. Советская, д. 15', work: 'ТО запорных устройств', dl: '20.07.2026', master: 'Иванов И.И.', count: 4, prio: 'Высокий', note: 'Замена крана на вводе', val: 'ok', msg: 'Координаты (53.909, 27.571) привязаны из Панорамы' },
      { addr: 'ул. Пушкина, д. 10', work: 'Осмотр трассы', dl: '25.07.2026', master: 'Петров П.П.', count: 1, prio: 'Средний', note: 'Проверка после раскопок', val: 'ok', msg: 'Все поля валидны' },
      { addr: 'ул. Неизвестная, д. 99 (новое строен.)', work: 'ТО ГРП', dl: '22.07.2026', master: 'Иванов И.И.', count: 1, prio: 'Высокий', note: 'Ввод в эксплуатацию', val: 'warn-addr', msg: '⚠ Адрес не найден в Панораме (требуется ручная привязка)' },
      { addr: 'ул. Ленина, д. 5', work: 'ТО запорных устройств', dl: '21.07.2026', master: 'Ковалев Д.А. (уволен)', count: 2, prio: 'Низкий', note: 'Плановая проверка', val: 'err-master', msg: '🛑 Мастер не найден в кадровой системе АРМ' },
      { addr: 'пр. Независимости, д. 76', work: 'Специальная диагностика узлов', dl: '24.07.2026', master: 'Сидоров С.С.', count: 1, prio: 'Высокий', note: 'Заявка ПУ-1', val: 'warn-work', msg: '🟧 Вид работы отсутствует в справочнике норм времени' }
    ];
    renderExcelPreviewTable();
  }

  function parseTasksExcelFile(file) {
    if (!window.XLSX) { ensureXlsxRetry(function () { parseTasksExcelFile(file); }); return; } // ленивая загрузка xlsx
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rows || rows.length < 2) { toast('warn', 'Файл пуст'); return; }
        excelDemoRows = [];
        for (var i = 1; i < rows.length; i++) {
          var r = rows[i]; if (!r || !r.length) continue;
          var addr = String(r[0] || '').trim(); if (!addr) continue;
          var work = String(r[1] || 'ТО запорных устройств').trim();
          var dl = String(r[2] || '25.07.2026').trim();
          var master = String(r[3] || 'Иванов И.И.').trim();
          var count = parseInt(r[4] || '1', 10) || 1;
          var prio = String(r[5] || 'Средний').trim();
          var note = String(r[6] || '').trim();

          var val = 'ok', msg = 'Валидно';
          if (master.indexOf('уволен') !== -1 || (master !== 'Иванов И.И.' && master !== 'Петров П.П.' && master !== 'Сидоров С.С.' && master !== 'Ковалев Д.А.' && master !== 'Макась В.Ю.')) {
            val = 'err-master'; msg = '🛑 Мастер не найден в кадровой системе';
          } else if (work.indexOf('Спец') !== -1 || work.indexOf('Неизв') !== -1) {
            val = 'warn-work'; msg = '🟧 Вид работы не найден в справочнике';
          } else if (addr.indexOf('Неизв') !== -1 || addr.indexOf('новое') !== -1) {
            val = 'warn-addr'; msg = '⚠ Адрес не найден в справочнике Панорамы';
          }
          excelDemoRows.push({ addr: addr, work: work, dl: dl, master: master, count: count, prio: prio, note: note, val: val, msg: msg });
        }
        renderExcelPreviewTable();
      } catch(err) { toast('err', 'Ошибка чтения Excel: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }

  function renderExcelPreviewTable() {
    var cont = document.getElementById('excel-import-preview-container');
    if (!cont) return;
    var html = '<table class="dt" style="font-size:12px;"><thead><tr><th>#</th><th>Адрес объекта</th><th>Вид работы</th><th>Дейден</th><th>Мастер</th><th>Кол-во</th><th>Статус валидации</th></tr></thead><tbody>';
    excelDemoRows.forEach(function(r, idx) {
      var bg = '#ffffff';
      if (r.val === 'warn-addr') bg = '#fef9c3'; // желтый
      else if (r.val === 'err-master') bg = '#fee2e2'; // красный
      else if (r.val === 'warn-work') bg = '#ffedd5'; // оранжевый
      else if (r.val === 'ok') bg = '#f0fdf4'; // зеленый

      html += '<tr style="background:' + bg + ';">';
      html += '<td><b>' + (idx + 1) + '</b></td>';
      html += '<td><b>' + esc(r.addr) + '</b><br><span style="font-size:12px;color:#64748b;">' + esc(r.note) + '</span></td>';
      html += '<td>' + esc(r.work) + '</td>';
      html += '<td>' + esc(r.dl) + '</td>';
      html += '<td><b>' + esc(r.master) + '</b></td>';
      html += '<td style="text-align:center;">' + r.count + '</td>';
      html += '<td>' + r.msg + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    cont.innerHTML = html;
    var btn = document.getElementById('btn-excel-conf');
    if (btn) btn.style.display = 'inline-flex';
  }

  function confirmExcelImport() {
    var addedCount = 0;
    excelDemoRows.forEach(function(r, idx) {
      if (r.val !== 'err-master') {
        var mObj = null;
        var ms = getMasters();
        for (var i = 0; i < ms.length; i++) if (ms[i].name.indexOf(r.master.split(' ')[0]) !== -1) { mObj = ms[i]; break; }
        var mid = mObj ? mObj.id : (S.user ? S.user.id : 'm1');
        var o = findObjectByAddr(r.addr);
        var tm = 15;
        if (o && o.lat && o.lng) {
          var dk = distKm(currentBase(), { lat: o.lat, lng: o.lng }) * 1.4;
          tm = Math.max(1, Math.round(dk / 30 * 60));
        }
        var tObj = { id: 't_ex_' + Date.now() + '_' + idx, addr: o ? objFullAddr(o) : r.addr, o: o ? o.id : null, w: 'w1', m: mid, d: (idx % 5), dl: 5, s: 'plan', status: 'plan', travelMin: tm, count: r.count, prio: r.prio };
        // Координаты из справочника — точка на карте встанет сразу, без геокодера
        if (o && o.lat != null && o.lng != null) { tObj.lat = o.lat; tObj.lng = o.lng; tObj.coord_src = 'object'; }
        if (TASKS_DB) { TASKS_DB.addTask(tObj); S.tasks = TASKS_DB.getTasks(); } else { S.tasks.push(tObj); }
        addedCount++;
      }
    });
    document.getElementById('overlay').classList.remove('show');
    toast('ok', '✓ Импортировано ' + addedCount + ' задач из Excel в график планирования! ');
    refresh();
  }

  /* ---------- TOAST ---------- */
