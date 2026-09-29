# -*- coding: utf-8 -*-
"""Сборка 22.09-87: атрибут ГРП «Кол-во линий редуцирования» + импорт норм ГРП из Excel
(формат «Сопоставление видов работ и норма времени»: работы на участок ГРП + профессии в справочник)."""
import io

def patch(path, pairs):
    with io.open(path, encoding='utf-8') as f:
        code = f.read()
    for old, new, tag, exp in pairs:
        cnt = code.count(old)
        assert cnt == exp, '%s: anchor count=%d (expected %d) for %r' % (path, cnt, exp, tag)
        code = code.replace(old, new)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print('patched', path)

# ============================== work_db.js ==============================
patch('/home/user/root_index/work_db.js', [(
    """      crew_size:            0,           // количество исполнителей (общее) — Сборка 22.09-85
      crew:                 []           // состав: [{prof:'...', grade:'3', count:2}]""",
    """      lines_count:          0,           // кол-во линий редуцирования (шт) — Сборка 22.09-87
      crew_size:            0,           // количество исполнителей (общее) — Сборка 22.09-85
      crew:                 []           // состав: [{prof:'...', grade:'3', count:2}]""",
    'defaults +lines_count', 1),
    ("""      crew_size:               Math.max(0, Math.round(toNum(d.crew_size, 0))),
      crew:                    toCrew(d.crew)""",
     """      lines_count:             Math.max(0, Math.round(toNum(d.lines_count, 0))),
      crew_size:               Math.max(0, Math.round(toNum(d.crew_size, 0))),
      crew:                    toCrew(d.crew)""",
     'parse +lines_count', 1)])

# ============================== app.js ==============================
PATCH = []

# --- 1. поле «Кол-во линий редуцирования» в карточке ГРП ---
PATCH.append((
    "    // 8.5. Исполнители: общее количество + состав бригады по профессиям (Сборка 22.09-85)",
    """    // 8.2. Количество линий редуцирования (Сборка 22.09-87)
    h += '<div class="fld" style="max-width:280px"><label>Кол-во линий редуцирования (шт)</label><input id="wm-lines" type="number" min="0" step="1" value="' + ((w && w.lines_count) || 0) + '" placeholder="0 — не задано"></div>';

    // 8.5. Исполнители: общее количество + состав бригады по профессиям (Сборка 22.09-85)""",
    'modal +lines field', 1))

# --- 2. saveWork: lines_count ---
PATCH.append((
    """      // Сборка 22.09-85: исполнители — общее количество + состав по профессиям
      data.crew = crewCollect();""",
    """      // Сборка 22.09-87: количество линий редуцирования
      data.lines_count = parseInt(val('wm-lines'), 10);
      if (!isFinite(data.lines_count) || data.lines_count < 0) data.lines_count = 0;
      // Сборка 22.09-85: исполнители — общее количество + состав по профессиям
      data.crew = crewCollect();""",
    'saveWork +lines_count', 1))

# --- 3. preserve list +lines_count ---
PATCH.append((
    "        'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach',\n        'crew_size', 'crew']",
    "        'indicators', 'print_forms', 'op_journal', 'passport_entry', 'scan_attach',\n        'crew_size', 'crew', 'lines_count']",
    'preserve +lines_count', 1))

# --- 4. бейдж «Линий: N» в списке работ ---
PATCH.append((
    """          html += '<li class="w"><span style="color:var(--blue)">▪</span>""",
    """          // Сборка 22.09-87: бейдж количества линий редуцирования
          if (w.lines_count) attr += ' <span class="equipment-badge" title="Кол-во линий редуцирования (шт)">Линий: ' + w.lines_count + '</span>';
          html += '<li class="w"><span style="color:var(--blue)">▪</span>""",
    'refs badge lines', 1))

# --- 5. импортёр норм ГРП: чистые функции перед importRefsFromExcel ---
PATCH.append((
    "  function importRefsFromExcel(file, mode) {",
    """  /* ===== Импорт норм ГРП (формат «Сопоставление видов работ и норма времени», Сборка 22.09-87) =====
     Колонки: № | Вид работы | Вид нормы времени | Чел.-ч | Кол-во линий | Тип объекта | Кол-во исп. | <Профессия N р.>…
     → работы на участок «ГРП» (группа = «Вид работы»), профессии → справочник «Профессии». */
  var GRP_PROF_ABBR = {
    'сл. г/исп.': 'Слесарь газоиспользующего оборудования',
    'электрогаз.': 'Электрогазосварщик',
    'нал. кипиа': 'Наладчик КИПиА',
    'слесарь кипиа': 'Слесарь КИПиА',
    'оператор пэвм': 'Оператор ПЭВМ'
  };
  function grpNormClean(s) { return String(s == null ? '' : s).replace(/\\s+/g, ' ').trim(); }
  // Разбор матрицы (массив строк-массивов) → {ok, profs, works, skipped, err}
  function grpNormParseMatrix(rows) {
    var out = { ok: false, err: '', profs: [], works: [], skipped: [] };
    if (!rows || !rows.length) { out.err = 'Файл пуст'; return out; }
    var headers = (rows[0] || []).map(function (h) { return grpNormClean(h).toLowerCase(); });
    function findCol() {
      for (var a = 0; a < arguments.length; a++) {
        for (var i = 0; i < headers.length; i++) if (headers[i].indexOf(arguments[a]) !== -1) return i;
      }
      return -1;
    }
    var iGrp = findCol('вид работы');
    var iName = findCol('вид нормы времени');
    var iNorm = findCol('чел.-ч', 'чел. ч', 'норма');
    var iLines = findCol('линий');
    var iType = findCol('тип объекта');
    var iCrew = findCol('кол-во исп', 'исполнител');
    if (iName === -1 || iNorm === -1) { out.err = 'Не найдены колонки «Вид нормы времени»/«Чел.-ч»'; return out; }
    // Колонки профессий: правее «Кол-во исп.», заголовок вида «<профессия> N р.»
    var profCols = [];
    var fromC = (iCrew !== -1 ? iCrew + 1 : (iType !== -1 ? iType + 1 : iNorm + 1));
    for (var c = fromC; c < headers.length; c++) {
      var m = headers[c] && headers[c].match(/^(.+?)\\s+(\\d+)\\s*р\\.?$/);
      if (!m) continue;
      var abbr = m[1].trim();
      var grade = parseInt(m[2], 10);
      var fullName = GRP_PROF_ABBR[abbr] || grpNormClean(rows[0][c]).replace(/\\s*\\d+\\s*р\\.?\\s*$/i, '') || rows[0][c];
      profCols.push({ col: c, name: fullName, grade: grade });
    }
    var seenProf = {};
    for (var ri = 1; ri < rows.length; ri++) {
      var r = rows[ri];
      if (!r || !r.length) continue;
      var name = grpNormClean(r[iName]);
      if (!name) continue;
      var normNum = parseFloat(String(r[iNorm] != null ? r[iNorm] : '').replace(',', '.'));
      if (!isFinite(normNum) || normNum <= 0) {
        out.skipped.push({ name: name, reason: 'нет нормы времени' });
        continue;
      }
      var crew = [];
      var crewSum = 0;
      profCols.forEach(function (pc) {
        var v = r[pc.col];
        if (v == null || v === '' || v === '-') return;
        var cnt = parseFloat(String(v).replace(',', '.'));
        if (!isFinite(cnt) || cnt <= 0) return;
        cnt = Math.round(cnt);
        crew.push({ prof: pc.name, grade: String(pc.grade), count: cnt });
        crewSum += cnt;
        var key = pc.name.toLowerCase() + '|' + pc.grade;
        if (!seenProf[key]) { seenProf[key] = 1; out.profs.push({ name: pc.name, grade: pc.grade }); }
      });
      var crewSize = (iCrew !== -1 ? parseInt(r[iCrew], 10) : 0);
      if (!isFinite(crewSize) || crewSize < 0) crewSize = 0;
      if (!crewSize && crewSum) crewSize = crewSum;
      var lines = (iLines !== -1 ? parseInt(r[iLines], 10) : 0);
      if (!isFinite(lines) || lines < 0) lines = 0;
      var typ = grpNormClean(iType !== -1 ? r[iType] : '');
      var cats = (typ === 'ГРП' || typ === 'ШРП' || typ === 'ПГРП' || typ === 'ГРС') ? [typ] : [];
      out.works.push({
        group: (iGrp !== -1 ? grpNormClean(r[iGrp]) : '') || 'Без группы',
        name: name,
        norm: Math.round(normNum * 1000) / 1000,
        unit: 'объект',
        needs_permit: false, depends_on_snow: false, min_temp: -50,
        season: 'Круглый год', equipment: '—',
        min_workers: crewSize || 1, opt_workers: crewSize || 1,
        object_categories: cats,
        lines_count: lines,
        crew_size: crewSize,
        crew: crew
      });
    }
    out.ok = true;
    return out;
  }
  // Применить разбор: профессии → «Профессии», работы → участок «ГРП» (дубликаты по названию пропускаем)
  function importGrpNorms(rows) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var res = grpNormParseMatrix(rows);
    if (!res.ok) { toast('err', res.err || 'Не удалось разобрать файл'); return; }
    if (!res.works.length) { toast('warn', 'В файле не найдено ни одной нормы для импорта'); return; }
    var profAdded = 0, profExists = 0, profBad = 0;
    if (window.SP_PROFS && SP_PROFS.addProf) {
      res.profs.forEach(function (p) {
        if (SP_PROFS.GRADES.indexOf(p.grade) === -1) { profBad++; return; }
        var rp = SP_PROFS.addProf(p.name, p.grade);
        if (rp.ok) profAdded++; else profExists++;
      });
    }
    var area = 'ГРП';
    try { if (WORK.ensureArea) WORK.ensureArea(area); } catch (e) {}
    var existing = {};
    (WORK.getWorks(area) || []).forEach(function (w) { existing[String(w.name || '').trim()] = 1; });
    var added = 0, exists = 0;
    res.works.forEach(function (d) {
      if (existing[d.name]) { exists++; return; }
      existing[d.name] = 1;
      WORK.addWork(area, d);
      added++;
    });
    logAction('Импорт норм ГРП из Excel', 'работ +' + added + ', профессий +' + profAdded + ', дублей ' + exists + ', без нормы ' + res.skipped.length);
    var msg = '📤 Импорт норм ГРП: работ добавлено ' + added;
    if (exists) msg += ', уже было ' + exists;
    msg += '; профессий +' + profAdded + (profExists ? ' (уже было ' + profExists + ')' : '');
    if (res.skipped.length) msg += '; без нормы пропущено: ' + res.skipped.length;
    if (profBad) msg += '; профессий вне разрядов 3–6: ' + profBad;
    toast('ok', msg);
    renderRefs();
  }

  function importRefsFromExcel(file, mode) {""",
    'grp importer functions', 1))

# --- 6. авто-распознавание формата в начале импорта ---
PATCH.append((
    """        var headers = rows[0].map(function (h) { return String(h || '').toLowerCase().trim(); });

        // === Режим УЧАСТКИ: колонка «Участок» (или первая) ===""",
    """        var headers = rows[0].map(function (h) { return String(h || '').toLowerCase().trim(); });

        // === 22.09-87: файл «Сопоставление видов работ и норма времени» (ГРП) ===
        if (mode === 'works' || mode === 'norms') {
          var hJoined = ' ' + headers.join(' ') + ' ';
          if (hJoined.indexOf('вид нормы времени') !== -1 && hJoined.indexOf('чел.-ч') !== -1) {
            importGrpNorms(rows);
            return;
          }
        }

        // === Режим УЧАСТКИ: колонка «Участок» (или первая) ===""",
    'grp format autodetect', 1))

# --- 7. маркер ---
PATCH.append((
    "    objmap: ['Карта объектов', 'Сборка 22.09-86 · справочник «Профессии» перед «Видами работ» (наименование + разряд 3–6); состав исполнителей ГРП — выбор строго из справочника'],",
    "    objmap: ['Карта объектов', 'Сборка 22.09-87 · импорт норм ГРП из Excel (работы + профессии + исполнители) и новый атрибут «Кол-во линий редуцирования» у атрибутов ГРП'],",
    'app marker 22.09-87', 1))

patch('/home/user/root_index/app.js', PATCH)

# ============================== index.html ==============================
patch('/home/user/index.html', [(
    '<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-86 · справочник «Профессии» (наименование + разряд 3–6) перед «Видами работ»; состав исполнителей ГРП — выбор строго из справочника</div>',
    '<div id="build-marker" style="margin-top:12px;text-align:center;font-size:10.5px;color:#94a3b8">Сборка 22.09-87 · импорт норм ГРП из Excel («Загрузить работы (Excel)»): работы + профессии + исполнители; атрибут «Кол-во линий редуцирования»</div>',
    'index marker 22.09-87', 1)])

print('ALL PATCHES OK')
