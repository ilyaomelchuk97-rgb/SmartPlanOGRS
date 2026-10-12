  /* ── часть 07 · app/07_refs.js — справочники: импорт/экспорт Excel, группы, виды работ, групповое изменение, профессии ── */
  /* =====================================================================
     ЭКСПОРТ / ИМПОРТ СПРАВОЧНИКА ИЗ EXCEL (Виды работ и Нормы времени)
     ===================================================================== */
  function downloadRefTemplate(mode) {
    if (!window.XLSX) { ensureXlsxRetry(function () { downloadRefTemplate(mode); }); return; } // ленивая загрузка xlsx
    var area = S.workArea || 'ПУГС №1';
    var works = WORK.getWorks(area);
    var wb = XLSX.utils.book_new();
    var data = [];

    // Заголовок
    data.push(['Группа работ', 'Вид работы', 'Норма времени (ч)', 'Единица измерения']);

    if (mode === 'norms') {
      // Для норм времени выгружаем существующий справочник участка (чтобы удобно было менять цифры норм и загружать обратно)
      if (works.length > 0) {
        works.forEach(function (w) {
          data.push([w.group || 'Без группы', w.name, w.norm, w.unit]);
        });
      } else {
        data.push(['Техническое обслуживание', 'ТО ЗУ', 0.5, 'ЗУ']);
        data.push(['Техническое обслуживание', 'ТО ГРП', 2.0, 'объект']);
        data.push(['Техническое обслуживание', 'Проверка ШРП', 1.0, 'объект']);
        data.push(['Ревизия и ремонт', 'Ревизия оборудования', 3.0, 'объект']);
      }
    } else {
      // Для видов работ выгружаем существующие и примеры для добавления большого объема работ
      if (works.length > 0) {
        works.forEach(function (w) {
          data.push([w.group || 'Без группы', w.name, w.norm, w.unit]);
        });
      } else {
        data.push(['Техническое обслуживание', 'ТО газопровода низкого давления', 1.5, 'км']);
        data.push(['Техническое обслуживание', 'Проверка герметичности фланцевых соединений', 0.8, 'шт.']);
        data.push(['Ревизия и ремонт', 'Замена задвижки Ду 100 на газопроводе', 4.0, 'шт.']);
        data.push(['Обход трасс', 'Внеочередной обход трассы при паводке', 1.8, 'км']);
        data.push(['Аварийно-восстановительные работы', 'Локализация утечки газа на подземном газопроводе', 3.5, 'объект']);
      }
      // Добавляем строку-подсказку в конец для новых работ
      data.push(['Новая группа работ (пример)', 'Новый вид работы для загрузки в систему', 2.5, 'объект']);
      data.push(['Новая группа работ (пример) / Зима', 'Пример работы в подгруппе — подгруппа пишется после «/»', 2.5, 'объект']);
    }

    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 32 }, { wch: 48 }, { wch: 20 }, { wch: 18 }];

    var sheetName = mode === 'norms' ? 'Нормы_времени' : 'Виды_работ';
    var safeArea = esc(area).replace(/[^a-zA-Z0-9А-Яа-я]/g, '_');
    var fileName = mode === 'norms' ? 'Шаблон_Нормы_Времени_' + safeArea + '.xlsx' : 'Шаблон_Виды_Работ_' + safeArea + '.xlsx';

    try {
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, fileName);
      toast('ok', '📥 Скачан файл: ' + fileName);
    } catch (err) {
      console.error('Ошибка скачивания Excel:', err);
      toast('warn', 'Если скачивание заблокировано песочницей, откройте файл в отдельном окне браузера');
    }
  }

  /* ===== Импорт норм ГРП (формат «Сопоставление видов работ и норма времени», Сборка 22.09-87) =====
     Колонки: № | Вид работы | Вид нормы времени | Чел.-ч | Кол-во линий | Тип объекта | Кол-во исп. | <Профессия N р.>…
     → работы на участок «ГРП» (группа = «Вид работы»), профессии → справочник «Профессии». */
  var GRP_PROF_ABBR = {
    'сл. г/исп.': 'Слесарь газоиспользующего оборудования',
    'электрогаз.': 'Электрогазосварщик',
    'нал. кипиа': 'Наладчик КИПиА',
    'слесарь кипиа': 'Слесарь КИПиА',
    'оператор пэвм': 'Оператор ПЭВМ'
  };
  function grpNormClean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
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
      var m = headers[c] && headers[c].match(/^(.+?)\s+(\d+)\s*р\.?$/);
      if (!m) continue;
      var abbr = m[1].trim();
      var grade = parseInt(m[2], 10);
      var fullName = GRP_PROF_ABBR[abbr] || grpNormClean(rows[0][c]).replace(/\s*\d+\s*р\.?\s*$/i, '') || rows[0][c];
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

  function importRefsFromExcel(file, mode) {
    if (!window.XLSX) { ensureXlsxRetry(function () { importRefsFromExcel(file, mode); }); return; } // ленивая загрузка xlsx
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var firstSheetName = workbook.SheetNames[0];
        var worksheet = workbook.Sheets[firstSheetName];
        var rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length < 2) {
          toast('warn', 'Файл пуст или не содержит данных под заголовком');
          return;
        }

        var headers = rows[0].map(function (h) { return String(h || '').toLowerCase().trim(); });

        // === 22.09-87: файл «Сопоставление видов работ и норма времени» (ГРП) ===
        if (mode === 'works' || mode === 'norms') {
          var hJoined = ' ' + headers.join(' ') + ' ';
          if (hJoined.indexOf('вид нормы времени') !== -1 && hJoined.indexOf('чел.-ч') !== -1) {
            importGrpNorms(rows);
            return;
          }
        }

        // === Режим УЧАСТКИ: колонка «Участок» (или первая) ===
        if (mode === 'areas') {
          var idxAreaCol = -1;
          headers.forEach(function (h, i) { if (h.indexOf('участ') !== -1 || h.indexOf('район') !== -1) idxAreaCol = i; });
          if (idxAreaCol === -1) idxAreaCol = 0;
          var names = [];
          for (var ia = 1; ia < rows.length; ia++) {
            var ra = rows[ia];
            if (!ra || !ra.length) continue;
            var na = String(ra[idxAreaCol] != null ? ra[idxAreaCol] : '').trim();
            if (na && names.indexOf(na) === -1) names.push(na);
          }
          if (!names.length) { toast('warn', 'В файле не найдено ни одного участка'); return; }
          var resA = window.SP_AREAS ? SP_AREAS.importAreas(names) : { added: 0, skipped: names.length };
          if (resA.added && WORK && WORK.ensureArea) {
            SP_AREAS.getAreas().forEach(function (an) { WORK.ensureArea(an); });
          }
          logAction('Импорт участков из Excel', 'добавлено: ' + resA.added + ', существовало: ' + resA.skipped);
          toast('ok', '📤 Импорт участков: добавлено ' + resA.added + ', уже существовало ' + resA.skipped);
          renderRefs();
          return;
        }

        // === Режим ОБЪЕКТЫ (ГРП/ШРП): колонки Тип / Номер / Адрес / Широта / Долгота ===
        if (mode === 'objects') {
          var iT = -1, iN = -1, iA = -1, iLa = -1, iLo = -1, iP = -1, iDs = -1, iCo = -1;
          headers.forEach(function (h, i) {
            if (h.indexOf('тип') !== -1 || h.indexOf('type') !== -1) iT = i;
            else if (h.indexOf('номер') !== -1 || h.indexOf('ном') !== -1 || h.indexOf('num') !== -1) iN = i;
            else if (h.indexOf('полигон') !== -1 || h.indexOf('област') !== -1 || h.indexOf('poly') !== -1) iP = i;
            else if (h.indexOf('описан') !== -1 || h.indexOf('desc') !== -1) iDs = i;
            else if (h.indexOf('цвет') !== -1 || h.indexOf('color') !== -1) iCo = i;
            else if (h.indexOf('адрес') !== -1 || h.indexOf('addr') !== -1) iA = i;
            else if (h.indexOf('широт') !== -1 || h.indexOf('lat') !== -1) iLa = i;
            else if (h.indexOf('долгот') !== -1 || h.indexOf('lng') !== -1 || h.indexOf('lon') !== -1) iLo = i;
          });
          if (iT === -1 && iN === -1 && iA === -1 && iLa === -1 && iLo === -1) { iT = 0; iN = 1; iA = 2; iLa = 3; iLo = 4; }
          if (iN === -1 && iA === -1) { toast('warn', 'В файле нет колонок «Номер» или «Адрес»'); return; }
          refreshObjects();
          var typeOk = { 'ГРП': 1, 'ШРП': 1, 'ГРС': 1, 'ПГРП': 1, 'Трасса': 1, 'Просека': 1, 'Область': 1 };
          var addedO = 0, updatedO = 0, skippedO = 0;
          var updatedIds = {};
          for (var io = 1; io < rows.length; io++) {
            var ro = rows[io];
            if (!ro || !ro.length) continue;
            var typO = String(ro[iT] != null ? ro[iT] : '').trim();
            if (!typeOk[typO]) typO = 'ГРП'; // пустой/неизвестный тип → ГРП
            var numO = String(ro[iN] != null ? ro[iN] : '').trim();
            var addrO = String(ro[iA] != null ? ro[iA] : '').trim();
            if (!numO && !addrO) { skippedO++; continue; }
            var latO = parseFloat(String(ro[iLa] != null ? ro[iLa] : '').replace(',', '.'));
            var lngO = parseFloat(String(ro[iLo] != null ? ro[iLo] : '').replace(',', '.'));
            if (!isFinite(latO)) latO = null;
            if (!isFinite(lngO)) lngO = null;
            // полигон: «lat,lng; lat,lng; …» (или по строкам)
            var polyO = null;
            if (iP !== -1) {
              var pRaw = String(ro[iP] != null ? ro[iP] : '').trim();
              if (pRaw) {
                var pPts = [];
                pRaw.split(/[;\n]+/).forEach(function (seg) {
                  var pm = seg.trim().match(/^(-?\d+[.,]?\d*)\s*[ ,\t]\s*(-?\d+[.,]?\d*)$/);
                  if (pm) {
                    var pa = parseFloat(pm[1].replace(',', '.')), pn = parseFloat(pm[2].replace(',', '.'));
                    if (isFinite(pa) && isFinite(pn)) pPts.push([pa, pn]);
                  }
                });
                if (pPts.length >= 3) polyO = pPts;
              }
            }
            // существующий объект: по типу+номеру (если есть номер), иначе по адресу
            // описание и цвет области (пустая ячейка — не трогаем текущее значение)
            var descrO = (iDs !== -1 && ro[iDs] != null) ? String(ro[iDs]).trim() : '';
            var colorO = (iCo !== -1 && ro[iCo] != null) ? String(ro[iCo]).trim() : '';
            if (colorO && !/^#[0-9a-fA-F]{3,8}$/.test(colorO)) colorO = '';
            var exO = null;
            for (var jo = 0; jo < OBJECTS.length; jo++) {
              var oo = OBJECTS[jo];
              if (numO) {
                if (objNumOf(oo) === numO && (oo.type || 'ГРП') === typO) { exO = oo; break; }
              } else if (addrO && (String(oo.addr || '') === addrO || objFullAddr(oo) === addrO)) { exO = oo; break; }
            }
            if (exO) {
              OBJECTS_DB.updateObject(exO.id, {
                type: typO,
                num: numO || objNumOf(exO),
                addr: addrO || exO.addr || '',
                lat: latO != null ? latO : exO.lat,
                lng: lngO != null ? lngO : exO.lng,
                poly: polyO !== null ? polyO : (exO.poly || null),
                descr: descrO || (exO.descr || ''),
                color: colorO || (exO.color || '')
              });
              updatedIds[exO.id] = 1;
              updatedO++;
            } else {
              OBJECTS_DB.addObject({ type: typO, num: numO, addr: addrO, lat: latO, lng: lngO, poly: polyO, descr: descrO, color: colorO });
              addedO++;
            }
          }
          refreshObjects();
          // Задачи, привязанные к обновлённым объектам, синхронизируются (как при редактировании)
          var syncedTasks = 0;
          S.tasks.forEach(function (t) {
            if (!t || !t.o || !updatedIds[t.o]) return;
            var ob = OBJ_MAP[t.o];
            if (!ob) return;
            var upd = { addr: objFullAddr(ob) };
            if (ob.lat != null && ob.lng != null) { upd.lat = ob.lat; upd.lng = ob.lng; upd.coord_src = 'object'; }
            Object.assign(t, upd);
            if (TASKS_DB) TASKS_DB.updateTask(t.id, upd);
            syncedTasks++;
          });
          logAction('Импорт объектов из Excel', 'добавлено: ' + addedO + ', обновлено: ' + updatedO + ', пропущено: ' + skippedO + (syncedTasks ? ', задач синхронизировано: ' + syncedTasks : ''));
          toast('ok', '📤 Импорт объектов: добавлено ' + addedO + ', обновлено ' + updatedO + (skippedO ? ', пропущено ' + skippedO : '') + (syncedTasks ? ' · задач синхронизировано: ' + syncedTasks : ''));
          renderRefs();
          return;
        }

        var idxGroup = -1, idxName = -1, idxNorm = -1, idxUnit = -1;

        headers.forEach(function (h, i) {
          if (h.indexOf('групп') !== -1 || h.indexOf('категор') !== -1 || h.indexOf('group') !== -1) idxGroup = i;
          else if (h.indexOf('работа') !== -1 || h.indexOf('вид') !== -1 || h.indexOf('наименован') !== -1 || h.indexOf('назван') !== -1 || h.indexOf('name') !== -1) idxName = i;
          else if (h.indexOf('норм') !== -1 || h.indexOf('час') !== -1 || h.indexOf('время') !== -1 || h.indexOf('norm') !== -1 || h.indexOf('time') !== -1) idxNorm = i;
          else if (h.indexOf('ед') !== -1 || h.indexOf('изм') !== -1 || h.indexOf('unit') !== -1) idxUnit = i;
        });

        if (idxName === -1) { idxGroup = 0; idxName = 1; idxNorm = 2; idxUnit = 3; }
        if (idxGroup === -1) idxGroup = 0;
        if (idxNorm === -1) idxNorm = 2;
        if (idxUnit === -1) idxUnit = 3;

        var area = S.workArea || 'ПУГС №1';
        var currentWorks = WORK.getWorks(area);
        var added = 0, updated = 0;

        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          if (!row || !row.length) continue;
          var nameStr = String(row[idxName] != null ? row[idxName] : '').trim();
          if (!nameStr || nameStr === 'Вид работы' || nameStr === '—' || nameStr.indexOf('Итого') === 0 || nameStr === 'Новый вид работы для загрузки в систему') continue;

          var groupStr = normGroupPath(String(row[idxGroup] != null ? row[idxGroup] : 'Без группы')) || 'Без группы'; // 22.09-112: «Группа/Подгруппа» в любом написании
          var normVal = parseFloat(String(row[idxNorm] != null ? row[idxNorm] : '0').replace(',', '.')) || 0;
          var unitStr = String(row[idxUnit] != null ? row[idxUnit] : 'объект').trim() || 'объект';

          var existing = null;
          for (var j = 0; j < currentWorks.length; j++) {
            if (currentWorks[j].name.toLowerCase() === nameStr.toLowerCase()) {
              existing = currentWorks[j];
              break;
            }
          }

          if (existing) {
            WORK.updateWork(area, existing.id, {
              group: groupStr !== 'Без группы' && groupStr !== 'Новая группа работ (пример)' ? groupStr : existing.group,
              name: nameStr,
              norm: normVal > 0 ? normVal : existing.norm,
              unit: unitStr
            });
            updated++;
          } else {
            WORK.addWork(area, {
              group: groupStr !== 'Новая группа работ (пример)' ? groupStr : 'Без группы',
              name: nameStr,
              norm: normVal > 0 ? normVal : 1.0,
              unit: unitStr
            });
            added++;
            currentWorks.push({ id: 'temp_' + i, group: groupStr, name: nameStr, norm: normVal, unit: unitStr });
          }
        }

        if (added > 0 || updated > 0) {
          toast('ok', '✓ ' + (mode === 'norms' ? 'Нормы времени' : 'Виды работ') + ' успешно обработаны из Excel (Добавлено: ' + added + ', Обновлено: ' + updated + ')');
          refresh();
        } else {
          toast('warn', 'Не найдено новых или изменённых записей для добавления');
        }
      } catch (err) {
        console.error('Ошибка импорта Excel:', err);
        toast('err', 'Ошибка чтения Excel файла: ' + (err.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* =====================================================================
     22.09-112: ГРУППЫ РАБОТ — дерево с подгруппами.
     Подгруппа хранится прямо в поле group через « / »: «Проверка ГРП / Зима».
     ===================================================================== */
  function normGroupPath(s) {
    // Разделитель подгрупп — косая черта С ПРОБЕЛОМ хотя бы с одной стороны (« / »),
    // чтобы «ГРП/ШРП» в существующих наименованиях НЕ превращалось в подгруппу.
    var parts = String(s || '').split(/\s+\/\s*|\s*\/\s+/).map(function (p) { return p.trim(); }).filter(Boolean);
    return parts.join(' / ');
  }
  function buildWorkTree(works) {
    var root = { name: '', path: '', children: {}, order: [], works: [] };
    works.forEach(function (w) {
      var g = normGroupPath(w.group) || 'Без группы';
      var parts = g.split(' / ');
      var node = root, path = [];
      parts.forEach(function (p) {
        path.push(p);
        if (!node.children[p]) { node.children[p] = { name: p, path: path.join(' / '), children: {}, order: [], works: [] }; node.order.push(p); }
        node = node.children[p];
      });
      node.works.push(w);
    });
    return root;
  }
  // Сколько работ затронет переименование пути (сам узел + его подгруппы)
  function groupPathAffected(works, path) {
    var n = 0;
    works.forEach(function (w) {
      var g = normGroupPath(w.group) || 'Без группы';
      if (g === path || g.indexOf(path + ' / ') === 0) n++;
    });
    return n;
  }
  // Существующие группы/подгруппы участка — для datalist-подсказок карточки работы
  function groupSuggest(area) {
    var tops = {}, subs = {};
    WORK.getWorks(area).forEach(function (w) {
      var g = normGroupPath(w.group) || 'Без группы';
      var parts = g.split(' / ');
      tops[parts[0]] = 1;
      // 22.09-208: подгруппы собираем под узлом ЛЮБОГО уровня (надгруппа/группа)
      for (var i = 0; i < parts.length - 1; i++) {
        (subs[parts[i]] = subs[parts[i]] || {})[parts.slice(i + 1).join(' / ')] = 1;
      }
    });
    var ru = function (a, b) { return a.localeCompare(b, 'ru'); };
    return {
      tops: Object.keys(tops).sort(ru),
      subsFor: function (top) {
        var tSegs = normGroupPath(top).split(' / ');
        var t = tSegs[tSegs.length - 1] || '';
        return t ? Object.keys(subs[t] || {}).sort(ru) : [];
      }
    };
  }

  /* =====================================================================
     РЕНДЕР: СПРАВОЧНИКИ
     ===================================================================== */
  function renderRefs() {
    var admin = S.role === 'admin';
    var refsTabsHtml = '<div class="tabs">' + tabBtn('profs', 'Профессии') + tabBtn('tree', 'Виды работ') + tabBtn('norms', 'Нормы времени') + tabBtn('areas', 'Участки') + tabBtn('objects', 'Объекты (ГРП/ШРП/ГРС/ПГРП)') + '</div>';
    var html = '';

    if (S.refsTab === 'profs') {
      html += renderProfsTab(admin, refsTabsHtml);
      view.innerHTML = html;
      return;
    }
    if (S.refsTab === 'areas') {
      html += renderAreasRefTab(admin, refsTabsHtml);
      html += '<input type="file" id="ref-excel-file" accept=".xlsx,.xls,.csv" style="display:none">';
      view.innerHTML = html;
      bindRefExcelFile();
      return;
    }
    if (S.refsTab === 'objects') {
      html += renderObjectsRefTab(admin, refsTabsHtml);
      html += '<input type="file" id="ref-excel-file" accept=".xlsx,.xls,.csv" style="display:none">';
      view.innerHTML = html;
      bindRefExcelFile();
      return;
    }

    var areaOpts = admin ? areasList() : (S.user.area ? [S.user.area] : areasList());
    if (S.workArea && areaOpts.indexOf(S.workArea) === -1 && S.user.area) areaOpts.push(S.user.area);
    if (!S.workArea || areaOpts.indexOf(S.workArea) === -1) S.workArea = areaOpts[0];
    var area = S.workArea;
    var works = WORK.getWorks(area);
    // 22.09-112: дерево «группа / подгруппа» вместо плоской карты групп
    var workTree = buildWorkTree(works);

    html += '<div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
    html += '<label style="font-size:12px;font-weight:600;color:var(--muted)">Участок:</label>';
    html += '<select id="ref-area" style="padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-family:inherit;background:var(--card)">';
    areaOpts.forEach(function (a) { html += '<option value="' + esc(a) + '"' + (a === area ? ' selected' : '') + '>' + esc(a) + '</option>'; });
    html += '</select>';
    html += '<span class="sub" style="font-size:12px;color:var(--muted)">Видов работ: ' + works.length + '</span>';
    html += '<div style="flex:1"></div>';

    var isNorms = S.refsTab === 'norms';
    var dlAction = isNorms ? 'dl-norms-tpl' : 'dl-works-tpl';
    var dlText = isNorms ? '📥 Скачать форму норм (Excel)' : '📥 Скачать форму работ (Excel)';
    var ulAction = isNorms ? 'ul-norms-excel' : 'ul-works-excel';
    var ulText = isNorms ? '📤 Загрузить нормы (Excel)' : '📤 Загрузить работы (Excel)';

    html += '<button class="btn ghost" data-action="' + dlAction + '" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;" title="Скачать шаблон Excel со списком колонок">' + dlText + '</button>';
    html += '<button class="btn ghost" data-action="' + ulAction + '" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;" title="Загрузить заполненный Excel файл в справочник">' + ulText + '</button>';

    if (admin) html += '<button class="btn primary" data-action="new-work">' + IC.plus + ' Добавить работу</button>';
    if (admin && !isNorms) html += '<button class="btn ghost" data-action="wsel-open" style="border:1px solid var(--line);background:var(--card);padding:7px 11px;font-size:12.5px;display:inline-flex;align-items:center;gap:6px;" title="22.09-229: групповое изменение — отметьте работы галочками в списке (или всю группу кнопкой ☑ у её названия) и откройте окно правки сразу всех выбранных">☑ Групповое изменение</button>';
    html += '</div>';

    html += refsTabsHtml;

    // 22.09-96: бейджи атрибутов работы — общий конструктор для вкладок «Виды работ» и «Нормы времени»
    function workRefBadgesHtml(w) {
      var attr = '';
      if (w.needs_permit) attr += ' <span class="permit-badge">📋 Ордер</span>';
      if (w.depends_on_snow) attr += ' <span class="snow-badge">❄️ Снег</span>';
      if (w.min_temp > -50) attr += ' <span class="weather-badge">🌡️ t≥' + w.min_temp + '°</span>';
      if (w.season && w.season !== 'Круглый год') attr += ' <span class="weather-badge" title="Сезон проведения">' + (w.season === 'Зима' ? '❄️' : w.season === 'Лето' ? '☀️' : '🍂') + ' ' + esc(w.season) + '</span>'; // 22.09-113
      if (w.telemetry_type) attr += ' <span class="equipment-badge" title="Автоподбор: только объекты с телеметрией «' + esc(w.telemetry_type) + '»">📡 ' + esc(w.telemetry_type) + '</span>'; // 22.09-115
      else if (w.telemetry_req === 'equipped') attr += ' <span class="equipment-badge" title="Автоподбор: только объекты с телеметрией">📡 ТМ</span>';
      else if (w.telemetry_req === 'not_equipped') attr += ' <span class="equipment-badge" title="Автоподбор: только объекты без телеметрии">🚫📡 без ТМ</span>';
      if (w.diag_equipment) attr += ' <span class="permit-badge" title="Автоподбор: вид обслуживания Region-gas">🧪 диагностика</span>';
      if (w.heating_req) attr += ' <span class="weather-badge" title="Автоподбор: только объекты с отоплением (ГРП)">🔥 отопление</span>';
      if (w.equipment && w.equipment !== '—') attr += ' <span class="equipment-badge">' + esc(w.equipment) + '</span>';
      if (w.object_categories && w.object_categories.length) {
        attr += ' <span class="equipment-badge" title="Категория объекта: ' + esc(w.object_categories.join(', ')) + '">' + esc(w.object_categories[0]) + (w.object_categories.length > 1 ? ' +' + (w.object_categories.length - 1) : '') + '</span>';
      }
      if (w.periodicity_value) {
        attr += ' <span class="permit-badge" title="Периодичность">🔁 ' + w.periodicity_value + ' ' + esc(w.periodicity_unit || 'мес') + '</span>';
      }
      // 22.09-134: joint_with — массив id (старая строка читается как одиночный выбор)
      var _jwArr = Array.isArray(w.joint_with) ? w.joint_with : (w.joint_with ? [w.joint_with] : []);
      if (_jwArr.length) {
        var _jwNames = _jwArr.map(function (id) {
          var ww = null; try { ww = WORK.getWorkById && WORK.getWorkById(id); } catch (e) {}
          return ww ? ww.name : id;
        });
        attr += ' <span class="snow-badge" title="Проводится совместно с: ' + esc(_jwNames.join(' · ')) + '">🤝 совместно' + (_jwArr.length > 1 ? ' ×' + _jwArr.length : '') + '</span>';
      }
      if (w.crew_size) {
        var crewDesc = (w.crew || []).filter(function (e) { return e && e.prof; })
          .map(function (e) { return e.prof + (e.grade ? ' · ' + e.grade + ' разряд' : '') + ' × ' + e.count; }).join('; ');
        attr += ' <span class="permit-badge" title="Исполнители — ' + w.crew_size + ' чел.' + (crewDesc ? ': ' + esc(crewDesc) : '') + '">👥 ' + w.crew_size + '</span>';
      }
      if (w.op_journal) attr += ' <span class="weather-badge" title="Запись в оперативном журнале">📓 журнал</span>';
      if (w.passport_entry) attr += ' <span class="weather-badge" title="Запись в эксплуатационном паспорте">📋 паспорт</span>';
      if (w.scan_attach) attr += ' <span class="equipment-badge" title="Присоединение сканов">📎 сканы</span>';
      if (w.lines_count) attr += ' <span class="equipment-badge" title="Кол-во линий редуцирования (шт)">Линий: ' + w.lines_count + '</span>';
      return attr;
    }

    // 22.09-112: дерево групп/подгрупп (рекурсивно). У группы могут быть и свои
    // работы, и подгруппы — собственные работы рисуются первыми, затем подгруппы.
    // У админа у каждой группы: «＋» — новая работа прямо в эту группу,
    // «✏️» — переименование сразу для всех работ группы.
    function grpHeadHtml(ch, depth) {
      var open = !!(S.refsOpen && S.refsOpen[ch.path]);
      var g = '<div class="grp' + (open ? '' : ' closed') + '" data-action="toggle-tree" data-grp="' + esc(ch.path) + '"' + (depth ? ' style="font-weight:600;font-size:12.5px"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' + esc(ch.name);
      // 22.09-137: бейджи свойств группы (🏷); наследуются от родительских групп
      var _gf = []; try { _gf = (WORK.groupFlagsOf && WORK.groupFlagsOf(area, ch.path)) || []; } catch (e) {}
      _gf.forEach(function (f) {
        var _fx = String(f || '').trim(), _fl = _fx.toLowerCase();
        // 22.09-144: «Телеметрия» → «Работы с ТМ»; «ГРП» упразднена — просто метка
        var _isTel = (_fl === 'телеметрия' || _fl === 'работы с тм'), _isNoTm = (_fl === 'без телеметрии');
        var _tip = _isTel ? 'Группа помечена «Работы с ТМ»: работы подбираются только объектам с телеметрией' :
          (_isNoTm ? 'Группа помечена «Без телеметрии»: работы подбираются только объектам без телеметрии' :
          'Свойство группы (метка, на автоподбор не влияет)');
        g += ' <span class="equipment-badge" style="font-size:11.5px" title="' + _tip + '">' + (_isTel ? '📡 ' : _isNoTm ? '🚫📡 ' : '🏷 ') + esc(_isTel ? 'Работы с ТМ' : _fx) + '</span>';
      });
      if (admin) g += '<span style="margin-left:auto;display:inline-flex;gap:4px;flex-shrink:0">' +
        (!isNorms ? '<button type="button" class="btn sm ghost" data-action="grp-selall" data-path="' + esc(ch.path) + '" title="22.09-229: отметить/снять все работы этой группы (вместе с подгруппами) для группового изменения" style="padding:2px 8px;font-size:12px;line-height:1.4">☑</button>' : '') +
        '<button type="button" class="btn sm ghost" data-action="grp-newwork" data-path="' + esc(ch.path) + '" title="Добавить работу в эту группу (подгруппа задаётся в карточке работы)" style="padding:2px 8px;font-size:12px;line-height:1.4">＋</button>' +
        (area === 'ГРП' ? '<button type="button" class="btn sm ghost" data-action="grp-props" data-path="' + esc(ch.path) + '" title="Свойства группы (только участок ГРП): «Работы с ТМ» — только объектам с телеметрией, «Без телеметрии» — только объектам без ТМ; применяются ко всем работам группы и её подгрупп" style="padding:2px 8px;font-size:12px;line-height:1.4">🏷</button>' : '') +
        '<button type="button" class="btn sm ghost" data-action="grp-rename" data-path="' + esc(ch.path) + '" title="Переименовать группу для всех работ сразу" style="padding:2px 8px;font-size:12px;line-height:1.4">✏️</button></span>';
      return g + '</div>';
    }
    function workNodeLi(ch, depth) {
      // 22.09-96: группы свёрнуты при входе; раскрытые запоминаются (S.refsOpen) до ухода со страницы
      var open = !!(S.refsOpen && S.refsOpen[ch.path]);
      var h = '<li>' + grpHeadHtml(ch, depth) + '<ul' + (open ? '' : ' style="display:none"') + '>';
      if (isNorms) {
        // 22.09-97: раскрывающиеся группы остаются, внутри — таблица (вид как раньше)
        if (ch.works.length) {
          h += '<li><table class="dt" style="margin:4px 0 14px"><thead><tr><th>Работа</th><th>Норма, ч</th><th>Ед. изм.</th>' + (admin ? '<th style="text-align:right">Действия</th>' : '') + '</tr></thead><tbody>';
          ch.works.forEach(function (w) {
            // 22.09-99: свойства (🌡️, техника и т.д.) в нормах времени не показываем
            h += '<tr><td><b>' + esc(w.name) + '</b></td><td>' + fmtH(w.norm) + '</td><td>' + esc(w.unit) + '</td>';
            if (admin) h += '<td style="text-align:right;white-space:nowrap"><button class="btn sm" data-action="edit-work" data-wid="' + w.id + '">Изменить</button> <button class="btn sm" data-action="del-work" data-wid="' + w.id + '" style="color:var(--red)">Удалить</button></td>';
            h += '</tr>';
          });
          h += '</tbody></table></li>';
        }
      } else {
        ch.works.forEach(function (w) {
          var attr = workRefBadgesHtml(w);
          // 22.09-98: название слева, свойства (вид объекта, линии и др.) и кнопки — по правому краю
          h += '<li class="w">' + (admin ? '<input type="checkbox" data-action="wsel-toggle" data-wid="' + esc(w.id) + '"' + (S.wsel && S.wsel[w.id] ? ' checked' : '') + ' title="22.09-229: отметить для группового изменения" style="flex:0 0 auto;margin:0 4px 0 0;cursor:pointer">' : '') + '<span style="color:var(--blue)">▪</span><span>' + esc(w.name) + '</span><span style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;text-align:right">' + attr + '</span>';
          if (admin) h += '<span style="margin-left:10px;white-space:nowrap"><button class="btn sm" data-action="edit-work" data-wid="' + w.id + '">Изменить</button> <button class="btn sm" data-action="del-work" data-wid="' + w.id + '" style="color:var(--red)">Удалить</button></span>';
          h += '</li>';
        });
      }
      ch.order.forEach(function (k) { h += workNodeLi(ch.children[k], depth + 1); });
      return h + '</ul></li>';
    }

    html += '<div class="card"><div class="card-b"><div class="tree">';
    if (!works.length) html += isNorms
      ? '<div class="empty">На участке пока нет работ</div>'
      : '<div class="empty">На участке «' + esc(area) + '» пока нет видов работ. ' + (admin ? 'Нажмите «Добавить работу».' : '') + '</div>';
    if (workTree.order.length) {
      html += '<ul style="padding-left:0">';
      workTree.order.forEach(function (k) { html += workNodeLi(workTree.children[k], 0); });
      html += '</ul>';
    }
    html += '</div></div></div>';
    // 22.09-229: выбор галочек — убрать удалённые работы и дорисовать панель группового изменения
    if (S.wsel) { var _wsKeep = {}; works.forEach(function (w) { _wsKeep[w.id] = 1; }); Object.keys(S.wsel).forEach(function (id) { if (!_wsKeep[id]) delete S.wsel[id]; }); }
    if (admin && !isNorms) html += wselBarHtml();
    html += '<input type="file" id="ref-excel-file" accept=".xlsx,.xls,.csv" style="display:none">';
    view.innerHTML = html;

    var refArea = document.getElementById('ref-area');
    if (refArea) refArea.addEventListener('change', function (e) { S.workArea = e.target.value; S.wsel = {}; renderRefs(); }); // 22.09-229: сменили участок — галочки группового изменения сброшены
    bindRefExcelFile();
  }
  // Привязка скрытого input файла (импорт Excel) — общая для всех вкладок справочников
  function bindRefExcelFile() {
    var refFile = document.getElementById('ref-excel-file');
    if (!refFile || refFile._spBound) return;
    refFile._spBound = true;
    refFile.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      importRefsFromExcel(file, S.excelImportMode || 'works');
      e.target.value = '';
    });
  }
  /* =====================================================================
     22.09-229: ГРУППОВОЕ ИЗМЕНЕНИЕ ВИДОВ РАБОТ (вкладка «Виды работ»)
     Галочки у работ (или ☑ у группы — все её работы с подгруппами),
     панель снизу «Изменить выбранные» → окно, где отмеченные атрибуты
     применяются сразу ко всем выбранным: надгруппа/группа (перемещение),
     сезон, мин. температура, норма, единица, исполнители, численность
     бригады, техника, а «Проводится совместно» — кнопками
     «Заменить связи» / «Добавить связи». Только для администратора.
     22.09-237: набор атрибутов окна — КАК В КАРТОЧКЕ вида работ выбранного
     участка (ГРП — атрибуты ГРП, УБиРОГС — атрибуты УБиРОГС, у прочих — только
     структура), см. wbulkFieldsFor; в «Структуре» добавлена подгруппа.
     ===================================================================== */
  function wselSelCount() { var n = 0; if (S.wsel) Object.keys(S.wsel).forEach(function (k) { if (S.wsel[k]) n++; }); return n; }
  function wselBarHtml() {
    var n = wselSelCount();
    if (!n) return '';
    return '<div id="wsel-bar" style="position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:90;display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.18);padding:8px 12px;font-size:12.5px;font-weight:700">' +
      '<span>☑ Выбрано работ: ' + n + '</span>' +
      '<button type="button" class="btn primary sm" data-action="wsel-open" title="Открыть окно группового изменения выбранных работ">✏ Изменить выбранные</button>' +
      '<button type="button" class="btn sm" data-action="wsel-clear" title="Снять все галочки">✕ Снять выбор</button>' +
      '</div>';
  }
  /* ☑ у группы: отметить (повторное нажатие — снять) все её работы
     вместе с подгруппами. Путь группы совпадает по префиксу «path» или
     «path + " / "» — тот же разделитель, что в дереве справочника. */
  function grpSelAll(path) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    path = String(path || '');
    if (!path) return;
    S.wsel = S.wsel || {};
    var ids = [];
    try {
      (WORK.getWorks(S.workArea) || []).forEach(function (w) {
        var g = (w && w.group != null) ? String(w.group).trim() : '';
        if (g === path || g.indexOf(path + ' / ') === 0) ids.push(w.id);
      });
    } catch (e) {}
    if (!ids.length) { toast('warn', 'В группе «' + path + '» нет работ'); return; }
    var allOn = true;
    ids.forEach(function (id) { if (!S.wsel[id]) allOn = false; });
    ids.forEach(function (id) { if (allOn) delete S.wsel[id]; else S.wsel[id] = 1; });
    toast('ok', (allOn ? 'Снята отметка с группы' : 'Отмечена группа') + ' «' + path + '» — работ: ' + ids.length);
    renderRefs();
  }
  /* 22.09-237: поля окна группового изменения — ТЕ ЖЕ атрибуты, что в карточке вида работ
     ВЫБРАННОГО участка (подписи — как в карточке): ГРП → «📋 Атрибуты ГРП», УБиРОГС →
     «⚙️ Атрибуты УБиРОГС»; у остальных участков в карточке собственных атрибутов нет —
     остаётся только «Структура» (надгруппа / группа / подгруппа).
     Поле: k — ключ работы; t — тип: dec (дробное, можно с запятой), int, num, text, sel, bool (Да/Нет),
     multi (галочки + заменить/добавить/убрать), list (через запятую + заменить/добавить/убрать),
     minopt (мин/оптим. исполнителей), crewsize (общее кол-во исполнителей), crew (состав бригады);
     lb — подпись, hint — пояснение серым, sh — коротко для журнала, sec — подзаголовок блока. */
  function wbulkFieldsFor(area) {
    if (area === 'ГРП') {
      var tel = []; try { tel = telemetryNames() || []; } catch (e) {}
      var deps = []; try { if (window.SP_AREAS && typeof SP_AREAS.getAreas === 'function') deps = SP_AREAS.getAreas() || []; } catch (e) {}
      if (!deps.length) deps = ['УБиРОГС'];
      return [
        { k: 'norm', t: 'dec', sec: '📏 Норма времени', lb: 'Норма времени (чел/ч на единицу)', hint: 'можно с запятой', sh: 'норма', ph: 'напр.: 0,15' },
        { k: 'unit', t: 'text', lb: 'Единица измерения', sh: 'единица', dl: ['объект', 'шт', 'м', 'м2', 'км', 'компл.', 'ч'], def: 'объект', ph: 'объект' },
        { k: 'object_categories', t: 'multi', sec: '🏷 Категории и подразделения', lb: 'Категория объекта обслуживания', sh: 'категории объекта', opts: ['ГРП', 'ШРП', 'ПГРП', 'ГРС', 'Узел учёта газа', 'Иное'] },
        { k: 'departments', t: 'multi', lb: 'Доступно подразделениям', hint: 'Справочник Подразделения', sh: 'подразделения', opts: deps },
        { k: 'season', t: 'sel', sec: '🔁 Сезон и периодичность выполнения', lb: 'Сезон проведения', sh: 'сезон', opts: ['Круглый год', 'Зима', 'Лето'] },
        { k: 'periodicity_value', t: 'int', min: 0, lb: 'Периодичность, месяцев', sh: 'периодичность', ph: 'напр.: 12' },
        { k: 'periodicity_dev', t: 'int', min: 0, lb: 'Отклонение, дней', sh: 'отклонение', ph: 'напр.: 2' },
        { k: 'periodicity_basis', t: 'sel', lb: 'Реквизит отсчёта для выполнения работ', sh: 'реквизит отсчёта', opts: [['prev_date', 'Дата предыдущего выполнения'], ['commissioning_date', 'Дата ввода в эксплуатацию'], ['service_life_end', 'Дата окончания срока службы оборудования']] },
        { k: 'operations', t: 'list', sec: '🧾 Операции и линии редуцирования', lb: 'Операции', hint: 'список значений, через запятую', sh: 'операции', ph: 'напр.: Подготовка, Монтаж, Проверка' },
        { k: 'lines_count', t: 'int', min: 0, lb: 'Кол-во линий редуцирования (шт)', sh: 'линии редуцирования', ph: '0 — не задано' },
        { k: 'telemetry_req', t: 'sel', sec: '🔌 Связь с оборудованием объекта — для автоподбора в графике', lb: 'Телеметрия на объекте', sh: 'телеметрия на объекте', empty: true, opts: [['', 'Не важно (работа для любых объектов)'], ['equipped', 'Только объекты, оборудованные телеметрией'], ['not_equipped', 'Только объекты БЕЗ телеметрии']] },
        { k: 'telemetry_type', t: 'sel', lb: 'Тип телеметрии', sh: 'тип телеметрии', empty: true, opts: [['', '— любой тип —']].concat(tel.map(function (x) { return [x, x]; })) },
        { k: 'diag_equipment', t: 'bool', lb: 'С использованием приборного диагностического оборудования', hint: 'добавляется объектам с видом обслуживания «Region-gas»', sh: 'диагностическое оборудование' },
        { k: 'heating_req', t: 'bool', lb: 'ТО отопительного оборудования', hint: 'только объектам с отоплением — ГРП', sh: 'ТО отопления' },
        { k: 'crew_size', t: 'crewsize', sec: '👷 Количество исполнителей и состав бригады', lb: 'Количество исполнителей (общее)', sh: 'кол-во исполнителей' },
        { k: 'crew', t: 'crew', lb: 'Работники будут', hint: 'профессия из справочника «Профессии» — количество', sh: 'состав бригады' },
        { k: 'indicators', t: 'list', sec: '📄 Показатели, печатные формы, записи', lb: 'Показатели эксплуатации (контролируемые)', hint: 'список значений', sh: 'показатели', ph: 'напр.: Давление, Температура, Расход' },
        { k: 'print_forms', t: 'list', lb: 'Перечень печатных форм', hint: 'список, через запятую', sh: 'печатные формы', ph: 'напр.: Акт осмотра, Протокол измерений' },
        { k: 'op_journal', t: 'bool', lb: 'Записи в оперативном журнале', sh: 'оперативный журнал' },
        { k: 'passport_entry', t: 'bool', lb: 'Записи в эксплуатационном паспорте', sh: 'эксплуатационный паспорт' },
        { k: 'scan_attach', t: 'bool', lb: 'Присоединение отсканированных подписанных документов', sh: 'сканы документов' }
      ];
    }
    if (area === 'УБиРОГС') return [
      { k: 'needs_permit', t: 'bool', lb: 'Требуется ордер', sh: 'ордер' },
      { k: 'depends_on_snow', t: 'bool', lb: 'Зависит от снегопада', sh: 'снегопад' },
      { k: 'min_temp', t: 'num', lb: 'Мин. температура, °C', hint: '-50 = без ограничений', sh: 'мин. температура', def: -50 },
      { k: 'season', t: 'sel', lb: 'Сезон', sh: 'сезон', opts: ['Круглый год', 'Зима', 'Лето', 'Весна-осень'] },
      { k: 'equipment', t: 'text', lb: 'Требуемая техника', sh: 'техника', def: '—', ph: 'Экскаватор, КДМ, ...' },
      { k: 'min_workers', t: 'minopt', lb: 'Кол-во исполнителей (мин / оптим.)', sh: 'исполнители' }
    ];
    return [];
  }
  /* 22.09-237: элемент ввода поля окна группового изменения (по типу поля) */
  function wbulkCtrlHtml(f) {
    var id = 'wb-v-' + f.k;
    function optHtml(o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '">' + esc(t) + '</option>';
    }
    var MODE = '<select id="wb-m-' + f.k + '" style="flex:0 0 auto;width:auto" title="Как применить к значениям каждой выбранной работы">' +
      '<option value="replace">заменить на указанные</option>' +
      '<option value="add">добавить к имеющимся</option>' +
      '<option value="remove">убрать указанные</option></select>';
    if (f.t === 'dec') return '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" placeholder="' + esc(f.ph || '') + '">';
    if (f.t === 'int') return '<input id="' + id + '" type="number" min="' + (f.min || 0) + '" step="1" placeholder="' + esc(f.ph || '') + '">';
    if (f.t === 'num') return '<input id="' + id + '" type="number" value="' + esc(String(f.def != null ? f.def : '')) + '">';
    if (f.t === 'text') {
      return '<input id="' + id + '"' + (f.dl ? ' list="wb-dl-' + f.k + '"' : '') + ' autocomplete="off" placeholder="' + esc(f.ph || '') + '">' +
        (f.dl ? '<datalist id="wb-dl-' + f.k + '">' + f.dl.map(function (u) { return '<option value="' + esc(u) + '">'; }).join('') + '</datalist>' : '');
    }
    if (f.t === 'sel') return '<select id="' + id + '">' + (f.opts || []).map(optHtml).join('') + '</select>';
    if (f.t === 'bool') return '<select id="' + id + '"><option value="1">Да</option><option value="0">Нет</option></select>';
    if (f.t === 'multi') {
      return '<div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:220px;display:flex;flex-wrap:wrap;gap:6px;padding:2px 0">' +
        (f.opts || []).map(function (o) {
          return '<label class="cb" style="border:1px solid #e2e8f0;border-radius:6px;padding:4px 9px;font-size:12px;font-weight:600;color:#1e3a8a;background:#fff;cursor:pointer;margin:0">' +
            '<input type="checkbox" data-wbm="' + esc(f.k) + '" data-v="' + esc(o) + '">' + esc(o) + '</label>';
        }).join('') +
        '</div>' + MODE + '</div>';
    }
    if (f.t === 'list') return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="' + id + '" style="flex:1;min-width:200px" autocomplete="off" placeholder="' + esc(f.ph || '') + '">' + MODE + '</div>';
    if (f.t === 'minopt') return '<div style="display:flex;gap:8px"><input id="wb-v-min_workers" type="number" min="1" style="flex:1" placeholder="мин"><input id="wb-v-opt_workers" type="number" min="1" style="flex:1" placeholder="опт"></div>';
    if (f.t === 'crewsize') {
      return '<input id="wm-crew-size" type="number" min="0" step="1" placeholder="напр.: 3" style="width:140px">' +
        '<div style="font-size:12px;color:var(--muted);margin-top:3px">Если больше 0 — как в карточке: мин. и оптим. число исполнителей станут равны этому числу</div>';
    }
    if (f.t === 'crew') {
      var profsCnt = 0;
      try { if (window.SP_PROFS && SP_PROFS.getAll) profsCnt = SP_PROFS.getAll().length; } catch (e) {}
      return '<div id="wm-crew-rows"></div>' +
        (profsCnt ? '' : '<div style="font-size:12.5px;color:#92400e;background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:6px 9px;margin:2px 0 6px">⚠️ Справочник «Профессии» пока пуст — сначала добавьте профессии: «Справочники» → «Профессии».</div>') +
        '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;flex-wrap:wrap"><button type="button" id="wm-crew-add" class="btn sm" style="border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:600">＋ Добавить профессию</button><span id="wm-crew-hint" style="font-size:12.5px;font-weight:600"></span></div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:3px">Указанный состав ЗАМЕНИТ состав бригады у всех выбранных работ</div>';
    }
    return '';
  }
  function openWorkBulkModal() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var area = S.workArea;
    var ids = S.wsel ? Object.keys(S.wsel).filter(function (k) { return S.wsel[k]; }) : [];
    if (!ids.length) { toast('warn', 'Сначала отметьте работы галочками в списке (или кнопкой ☑ у группы — все работы группы сразу)'); return; }
    var works = [];
    ids.forEach(function (id) { var w = null; try { w = WORK.getWork(area, id); } catch (e) {} if (w) works.push(w); });
    if (!works.length) { toast('err', 'Выбранные работы не найдены на участке ' + area); return; }
    S.wmBulkJoint = []; // выбор групп «Проводится совместно» — чистый при каждом открытии
    var fields = wbulkFieldsFor(area); // 22.09-237: атрибуты — как в карточке вида работ этого участка
    var isGrp = (area === 'ГРП');
    var hasJoint = isGrp; // «Проводится совместно» — атрибут карточки ГРП
    var grpLists = groupSuggest(area);
    var subsAll = {};
    grpLists.tops.forEach(function (t) { grpLists.subsFor(t).forEach(function (sb) { subsAll[sb] = 1; }); });
    function dlOptsHtml2(arr) { return arr.map(function (v) { return '<option value="' + esc(v) + '">'; }).join(''); }
    function fldRow(onId, label, ctrlHtml) {
      return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">' +
        '<label class="cb" style="flex:0 0 auto;padding-top:26px" title="Применять этот атрибут ко всем выбранным работам"><input type="checkbox" id="' + onId + '"></label>' +
        '<div class="fld" style="flex:1;margin:0"><label>' + label + '</label>' + ctrlHtml + '</div></div>';
    }
    var h = '<div class="modal-h"><h3>☑ Групповое изменение работ · ' + works.length + ' шт. · ' + esc(area) + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    h += '<div style="max-height:110px;overflow:auto;border:1px dashed var(--line);border-radius:8px;padding:6px 8px;margin-bottom:12px;font-size:12px;line-height:1.6">';
    works.forEach(function (w) { h += '<div>▪ <b style="color:var(--ink)">' + esc(w.name) + '</b> <span style="color:#94a3b8">(' + esc(w.group || 'Без группы') + ')</span></div>'; });
    h += '</div>';
    h += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.5">Отметьте галочками слева атрибуты, которые нужно изменить СРАЗУ У ВСЕХ выбранных работ, задайте новые значения и нажмите кнопку внизу. Неотмеченные атрибуты останутся у работ как были. Набор атрибутов — как в карточке вида работ участка «' + esc(area) + '».</div>';
    // Структура — у всех участков (как верх карточки: надгруппа / группа / подгруппа)
    h += '<div style="background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:10px">';
    h += '<div style="font-size:12px;font-weight:700;margin-bottom:8px">🗂 Структура — переместить выбранные работы</div>';
    h += fldRow('wb-on-super', 'Надгруппа <span style="color:#94a3b8;font-weight:500">(пусто — снять надгруппу)</span>', '<input id="wb-super-group" list="wb-sup-dl" autocomplete="off" placeholder="Без надгруппы"><datalist id="wb-sup-dl">' + dlOptsHtml2(grpLists.tops) + '</datalist>');
    h += fldRow('wb-on-group', 'Группа работ', '<input id="wb-group-group" list="wb-grp-dl" autocomplete="off" placeholder="Напр.: Покраска газопроводов"><datalist id="wb-grp-dl">' + dlOptsHtml2(grpLists.tops) + '</datalist>');
    h += fldRow('wb-on-sub', 'Подгруппа <span style="color:#94a3b8;font-weight:500">(пусто — без подгруппы)</span>', '<input id="wb-sub-group" list="wb-sub-dl" autocomplete="off" placeholder="Без подгруппы"><datalist id="wb-sub-dl">' + dlOptsHtml2(Object.keys(subsAll).sort(function (a, b) { return a.localeCompare(b, 'ru'); })) + '</datalist>');
    h += '</div>';
    // Атрибуты участка — те же, что в карточке вида работ этого участка
    if (fields.length) {
      h += '<div style="background:' + (isGrp ? '#eef6ff' : 'var(--panel-2)') + ';border:1px solid ' + (isGrp ? '#bfdbfe' : 'var(--line)') + ';border-radius:8px;padding:10px 12px;margin-bottom:10px">';
      h += '<div style="font-size:12px;font-weight:700;color:' + (isGrp ? '#1d4ed8' : 'var(--ink)') + ';margin-bottom:8px">' + (isGrp ? '📋 Атрибуты ГРП' : '⚙️ Атрибуты ' + esc(area)) +
        ' <span style="color:#94a3b8;font-weight:500">— как в карточке вида работ</span></div>';
      var firstSec = true;
      fields.forEach(function (f) {
        if (f.sec) {
          h += '<div style="font-size:12.5px;font-weight:800;color:' + (isGrp ? '#1e3a8a' : 'var(--ink)') + ';margin:' + (firstSec ? '2px' : '12px') + ' 0 6px;' + (firstSec ? '' : 'padding-top:9px;border-top:1px dashed ' + (isGrp ? '#bfdbfe' : 'var(--line)') + ';') + '">' + f.sec + '</div>';
          firstSec = false;
        }
        h += fldRow('wb-on-' + f.k, esc(f.lb) + (f.hint ? ' <span style="color:#94a3b8;font-weight:500">(' + esc(f.hint) + ')</span>' : ''), wbulkCtrlHtml(f));
      });
      h += '</div>';
    } else {
      h += '<div class="calc" style="margin-bottom:10px;align-items:flex-start;font-size:12px;line-height:1.5">ℹ У участка «' + esc(area) + '» в карточке вида работ нет собственных атрибутов (они есть у участков ГРП и УБиРОГС) — для выбранных работ доступно перемещение по группам (блок «Структура» выше).</div>';
    }
    if (hasJoint) {
      h += '<div style="background:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:10px">';
      h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><label class="cb" title="Применять связи «Проводится совместно» ко всем выбранным"><input type="checkbox" id="wb-on-joint"></label><div style="font-size:12px;font-weight:700;color:#1d4ed8">🤝 Проводится совместно — связанные группы работ</div></div>';
      var jgroups = []; try { jgroups = wmJointGroups(area); } catch (e) {}
      var gcnt = {};
      try { (WORK.getWorks(area) || []).forEach(function (ww) { var g = (ww && ww.group != null) ? String(ww.group).trim() : ''; if (g) gcnt[g] = (gcnt[g] || 0) + 1; }); } catch (e) {}
      h += '<div style="max-height:150px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px;background:#fff">';
      if (!jgroups.length) h += '<div style="color:#94a3b8;font-size:12.5px;padding:10px;text-align:center">На участке нет групп работ</div>';
      jgroups.forEach(function (g) {
        var on = S.wmBulkJoint.indexOf(g) >= 0;
        h += '<label class="cb" style="display:flex;align-items:center;gap:7px;padding:4px 6px;font-size:12.5px;cursor:pointer"><input type="checkbox" data-action="wbulk-jt" data-g="' + esc(g) + '"' + (on ? ' checked' : '') + '><span style="flex:1"><b style="color:var(--ink)">' + esc(g) + '</b><span style="color:#64748b"> · работ: ' + (gcnt[g] || 0) + '</span></span></label>';
      });
      h += '</div>';
      h += '<div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5">Связи применяются отдельными кнопками внизу: «Заменить» — у всех выбранных работ останутся ТОЛЬКО отмеченные здесь группы; «Добавить» — отмеченные группы добавятся к уже имеющимся связям каждой работы.</div>';
      h += '</div>';
    }
    h += '</div>';
    h += '<div class="modal-f" style="flex-wrap:wrap;gap:8px">' +
      '<button class="btn" data-action="close-modal">Отмена</button>' +
      '<button class="btn primary" data-action="wbulk-apply" title="Применить отмеченные галочками атрибуты' + (hasJoint ? ' (кроме связей — для них свои кнопки)' : '') + '">💾 Применить атрибуты</button>' +
      (hasJoint ?
        '<button class="btn primary" data-action="wbulk-j-replace" style="background:#7c3aed" title="Применить и ЗАМЕНИТЬ связи «Проводится совместно» у всех выбранных работ отмеченными группами">🤝 Заменить связи</button>' +
        '<button class="btn primary" data-action="wbulk-j-add" style="background:#0e7490" title="Применить и ДОБАВИТЬ отмеченные группы к уже имеющимся связям выбранных работ">🤝 Добавить связи</button>' : '') +
      '</div>';
    modal.innerHTML = h;
    modal.style.width = ''; modal.style.maxWidth = isGrp ? '820px' : '660px';
    overlay.classList.add('show');
    if (fields.some(function (f) { return f.t === 'crew'; })) initCrewEditor(null, 0); // состав бригады — тот же редактор, что в карточке ГРП
  }
  /* Применение групповой правки. jointMode: '' — только атрибуты;
     'replace' / 'add' — плюс связи «Проводится совместно» (только ГРП; если у блока стоит
     галочка): заменить связи отмеченными группами или добавить их к имеющимся.
     22.09-237: применяются ТОЛЬКО атрибуты карточки текущего участка (wbulkFieldsFor). */
  function workBulkApply(jointMode) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var area = S.workArea;
    var ids = S.wsel ? Object.keys(S.wsel).filter(function (k) { return S.wsel[k]; }) : [];
    if (!ids.length) { toast('warn', 'Нет выбранных работ'); return; }
    function val(id) { var el = document.getElementById(id); var v = el ? el.value : ''; return (typeof v === 'string') ? v.trim() : ''; } // только строки: иначе «не задано»
    function on(id) { var el = document.getElementById(id); return !!(el && el.checked === true); } // строго: галочка браузера — true/false
    function plain(sv) { return String(sv || '').replace(/<[^>]*>/g, ''); }
    var doSuper = on('wb-on-super'), newSuper = normGroupPath(val('wb-super-group'));
    var doGroup = on('wb-on-group'), newGroup = normGroupPath(val('wb-group-group'));
    var doSub = on('wb-on-sub'), newSub = normGroupPath(val('wb-sub-group'));
    if (doGroup && !newGroup) { toast('err', '«Группа работ» отмечена, но значение пустое — группа не может быть пустой'); return; }
    var fields = wbulkFieldsFor(area);
    var set = {}, ops = [], errs = [], fieldsLog = [], crewSkipped = 0;
    fields.forEach(function (f) {
      if (!on('wb-on-' + f.k)) return;
      var v = val('wb-v-' + f.k);
      if (f.t === 'dec') {
        var raw = v.replace(',', '.'), n = parseFloat(raw);
        if (raw === '' || !isFinite(n) || n < 0) { errs.push(plain(f.lb) + ' — некорректное число (принимаем и запятую: 0,15)'); return; }
        set[f.k] = n;
      } else if (f.t === 'int' || f.t === 'crewsize') {
        var vi = parseInt(f.t === 'crewsize' ? val('wm-crew-size') : v, 10);
        if (!isFinite(vi) || vi < (f.min || 0)) { errs.push(plain(f.lb) + ' — целое число от ' + (f.min || 0)); return; }
        set[f.k] = vi;
      } else if (f.t === 'num') {
        var nf = parseFloat(v.replace(',', '.'));
        if (!isFinite(nf)) { errs.push(plain(f.lb) + ' — не число'); return; }
        set[f.k] = nf;
      } else if (f.t === 'text') {
        set[f.k] = v || (f.def != null ? f.def : '');
      } else if (f.t === 'sel') {
        var okv = (f.opts || []).map(function (o) { return Array.isArray(o) ? o[0] : o; });
        if (okv.indexOf(v) === -1 || (v === '' && !f.empty)) v = okv[0]; // в окне всегда одно из значений списка
        set[f.k] = v;
      } else if (f.t === 'bool') {
        set[f.k] = (v !== '0'); // «Да» — по умолчанию (первый пункт)
      } else if (f.t === 'multi' || f.t === 'list') {
        var items = [];
        if (f.t === 'multi') {
          try { document.querySelectorAll('[data-wbm="' + f.k + '"]').forEach(function (nd) { if (nd && nd.checked === true) items.push(nd.getAttribute('data-v')); }); } catch (e) {}
        } else {
          items = v.split(',').map(function (sv) { return sv.trim(); }).filter(Boolean);
        }
        var mode = val('wb-m-' + f.k);
        if (mode !== 'add' && mode !== 'remove') mode = 'replace';
        if (mode !== 'replace' && !items.length) { errs.push(plain(f.lb) + ' — ' + (f.t === 'multi' ? 'отметьте значения' : 'впишите значения через запятую') + ', которые нужно ' + (mode === 'add' ? 'добавить' : 'убрать')); return; }
        ops.push({ k: f.k, mode: mode, items: items, sh: f.sh });
      } else if (f.t === 'minopt') {
        var mn = parseInt(val('wb-v-min_workers'), 10), op = parseInt(val('wb-v-opt_workers'), 10);
        if (!(isFinite(mn) && mn >= 1) && !(isFinite(op) && op >= 1)) { errs.push('Кол-во исполнителей: укажите мин и/или оптим. (целое от 1)'); return; }
        if (isFinite(mn) && mn >= 1) set.min_workers = mn;
        if (isFinite(op) && op >= 1) set.opt_workers = op;
      } else if (f.t === 'crew') {
        var cr = [];
        try { cr = crewCollect(); } catch (e) { cr = []; }
        crewSkipped = cr.skipped || 0;
        set.crew = cr.slice();
      }
      fieldsLog.push(f.sh || plain(f.lb));
    });
    if (errs.length) { toast('err', errs[0]); return; }
    var hasJoint = (area === 'ГРП');
    var doJoint = hasJoint && (jointMode === 'replace' || jointMode === 'add') && on('wb-on-joint');
    var jSel = (Array.isArray(S.wmBulkJoint) ? S.wmBulkJoint.slice() : []);
    var _ask = []; // 22.09-244: вопросы — одним оформленным окном
    if (doJoint && jointMode === 'replace' && !jSel.length) _ask.push('Группы не отмечены — связи «Проводится совместно» будут ОЧИЩЕНЫ у всех выбранных работ.');
    var clearing = [];
    ops.forEach(function (o) { if (o.mode === 'replace' && !o.items.length) clearing.push(o.sh); });
    if (set.crew && !set.crew.length) clearing.push('состав бригады');
    if (clearing.length) _ask.push('Значения не указаны — у всех выбранных работ будут ОЧИЩЕНЫ: ' + clearing.join(', ') + '.');
    if (!doSuper && !doGroup && !doSub && !Object.keys(set).length && !ops.length && !doJoint) {
      toast('warn', 'Не отмечен ни один атрибут для изменения — поставьте галочки у нужных'); return;
    }
    if (_ask.length) return spConfirm(_ask.join('\n\n') + '\n\nПродолжить?', { title: 'Групповое изменение работ', ok: 'Продолжить', danger: true }, wbApplyGo);
    return wbApplyGo();
    function wbApplyGo() { // 22.09-244: применение — после подтверждения (если оно нужно)
    var structLog = [];
    if (doSuper) structLog.push('надгруппа'); if (doGroup) structLog.push('группа'); if (doSub) structLog.push('подгруппа');
    fieldsLog = structLog.concat(fieldsLog);
    if (doJoint) fieldsLog.push(jointMode === 'add' ? 'связи (добавлены)' : 'связи (заменены)');
    var applied = 0, fails = 0;
    ids.forEach(function (id) {
      var w = null; try { w = WORK.getWork(area, id); } catch (e) {}
      if (!w) return;
      var patch = {};
      if (doSuper || doGroup || doSub) {
        var segs = normGroupPath(w.group || '').split(' / ').filter(Boolean);
        var sup = '', grp = '', subs = '';
        if (segs.length >= 3) { sup = segs[0]; grp = segs[1] || ''; subs = segs.slice(2).join(' / '); }
        else { grp = segs[0] || ''; subs = segs.slice(1).join(' / '); } // старые 1–2 сегмента — без надгруппы
        if (doSuper) sup = newSuper; // пусто — снять надгруппу
        if (doGroup) grp = newGroup;
        if (doSub) subs = newSub; // пусто — без подгруппы
        if (!grp) { fails++; return; } // группа обязана остаться
        var parts = [];
        if (sup) parts.push(sup);
        parts.push(grp);
        if (subs) parts.push(subs);
        patch.group = parts.join(' / ');
      }
      Object.keys(set).forEach(function (k) { patch[k] = Array.isArray(set[k]) ? set[k].map(function (x) { return (x && typeof x === 'object') ? Object.assign({}, x) : x; }) : set[k]; });
      if (set.crew_size != null && set.crew_size > 0) { patch.min_workers = set.crew_size; patch.opt_workers = set.crew_size; } // как в карточке ГРП: общее кол-во исполнителей главнее мин/опт
      ops.forEach(function (o) {
        var ex = Array.isArray(w[o.k]) ? w[o.k].slice() : (w[o.k] ? [w[o.k]] : []);
        var res;
        if (o.mode === 'add') { res = ex.slice(); o.items.forEach(function (x) { if (res.indexOf(x) === -1) res.push(x); }); }
        else if (o.mode === 'remove') { res = ex.filter(function (x) { return o.items.indexOf(x) === -1; }); }
        else { res = o.items.slice(); }
        patch[o.k] = res;
      });
      if (doJoint) {
        var ex = Array.isArray(w.joint_with) ? w.joint_with.slice() : (w.joint_with ? [w.joint_with] : []);
        var merged = (jointMode === 'add') ? ex.slice() : [];
        jSel.forEach(function (g) { if (g && g !== id && merged.indexOf(g) === -1) merged.push(g); });
        patch.joint_with = merged;
      }
      if (!Object.keys(patch).length) return;
      try {
        var sw2 = WORK.updateWork(area, id, patch);
        // переезд в другую группу — наследование пометок группы (как в карточке, 22.09-137)
        try {
          if ((doSuper || doGroup || doSub) && sw2 && sw2.id && WORK.groupFlagsOf) {
            var gfOwn = Array.isArray(sw2.group_flags) ? sw2.group_flags : [];
            var gfNew = WORK.groupFlagsOf(area, patch.group, sw2.id) || [];
            if (JSON.stringify(gfOwn) !== JSON.stringify(gfNew)) WORK.updateWork(area, sw2.id, { group_flags: gfNew });
          }
        } catch (eF) {}
        applied++;
      } catch (eU) { fails++; }
    });
    if (applied) logAction('Групповое изменение работ', area + ': ' + applied + ' работ — ' + fieldsLog.join(', '));
    overlay.classList.remove('show'); modal.style.width = ''; modal.style.maxWidth = '';
    if (!fails) toast('ok', '✅ Групповое изменение применено — работ: ' + applied + ' (' + fieldsLog.join(', ') + ')');
    else toast('warn', 'Групповое изменение: применено к ' + applied + ' работам, не удалось — ' + fails);
    if (crewSkipped) toast('warn', '⚠️ Строк состава бригады с количеством, но без профессии не сохранено: ' + crewSkipped);
    if (set.crew && set.crew_size != null) {
      var crewSum = set.crew.reduce(function (a, e) { return a + (e.count || 0); }, 0);
      if (set.crew_size > 0 && crewSum !== set.crew_size) toast('warn', '⚠️ Состав исполнителей (' + crewSum + ') не совпадает с общим количеством (' + set.crew_size + ')');
    }
    renderRefs();
    }
  }

  function tabBtn(t, label) { return '<button class="' + (S.refsTab === t ? 'on' : '') + '" data-action="refs-tab" data-tab="' + t + '">' + label + '</button>'; }

  /* =====================================================================
     СПРАВОЧНИК: ПРОФЕССИИ (Сборка 22.09-86)
     ===================================================================== */
  function renderProfsTab(admin, tabsHtml) {
    var profs = window.SP_PROFS ? SP_PROFS.getAll() : [];
    profs.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'ru') || ((a.grade || 0) - (b.grade || 0)); });
    var html = '<div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
    html += '<span class="sub" style="font-size:12px;color:var(--muted)">Всего профессий: ' + profs.length + '</span>';
    html += '<div style="flex:1"></div>';
    if (admin) html += '<button class="btn primary" data-action="new-prof">' + IC.plus + ' Добавить профессию</button>';
    html += '</div>';
    html += tabsHtml;
    html += '<div class="card"><table class="dt"><thead><tr><th>Наименование профессии</th><th>Разряд</th>' + (admin ? '<th style="text-align:right">Действия</th>' : '') + '</tr></thead><tbody>';
    if (!profs.length) html += '<tr><td colspan="' + (admin ? 3 : 2) + '" class="empty">Справочник профессий пуст. ' + (admin ? 'Нажмите «Добавить профессию».' : '') + '</td></tr>';
    profs.forEach(function (p) {
      html += '<tr><td><b>' + esc(p.name) + '</b></td><td>' + (p.grade ? esc(String(p.grade)) + ' разряд' : '<span style="color:#94a3b8">без разряда</span>') + '</td>';
      if (admin) html += '<td style="text-align:right;white-space:nowrap"><button class="btn sm" data-action="edit-prof" data-pid="' + esc(p.id) + '">Изменить</button> <button class="btn sm" data-action="del-prof" data-pid="' + esc(p.id) + '" style="color:var(--red)">Удалить</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // Модал добавления/изменения профессии: наименование + разряд (3–6)
  // Список названий для выпадающего списка карточки профессии (Сборка 22.09-89)
  function profNameListOptionsHtml() {
    var names = [];
    try { if (window.SP_PROFS && SP_PROFS.getNameList) names = SP_PROFS.getNameList(); } catch (e) {}
    return names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  }
  function openProfModal(mode, pid) {
    S.profModalMode = mode; S.profModalPid = pid || null;
    var p = (mode === 'edit' && window.SP_PROFS) ? SP_PROFS.getById(pid) : null;
    var html = '<div class="modal-h"><h3>' + (mode === 'edit' ? 'Изменение профессии' : 'Новая профессия') + '</h3><button class="x" data-action="close-modal">×</button></div><div class="modal-b">';
    html += '<div class="fld"><label>Наименование профессии</label>';
    html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">';
    html += '<select id="pm-name-list" style="flex:1"><option value="">— выбрать из списка —</option>' + profNameListOptionsHtml() + '</select>';
    if (mode !== 'edit') html += '<button type="button" id="pm-namedel" class="btn sm" style="color:var(--red);padding:5px 10px;white-space:nowrap" title="Удалить выбранное название из списка">🗑 Удалить</button>';
    html += '</div>';
    html += '<input id="pm-name" value="' + (p ? esc(p.name) : '') + '" placeholder="…или впишите вручную, напр.: Слесарь газоиспользующего оборудования"></div>';
    html += '<div class="fld"><label>Разряд <span style="color:#94a3b8;font-weight:500">(необязательно)</span></label><select id="pm-grade">';
    html += '<option value=""' + (p && !p.grade ? ' selected' : '') + '>без разряда</option>';
    (window.SP_PROFS ? SP_PROFS.GRADES : [3, 4, 5, 6]).forEach(function (g) {
      html += '<option value="' + g + '"' + (p && p.grade === g ? ' selected' : '') + '>' + g + ' разряд</option>';
    });
    html += '</select></div>';
    html += '<div class="calc">ℹ️ Профессии применяются в составе исполнителей работ участка ГРП. Название можно выбрать из списка или вписать вручную — вписанное запомнится в списке.</div>';
    html += '</div><div class="modal-f"><button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-prof">' + (mode === 'edit' ? 'Сохранить' : 'Добавить профессию') + '</button></div>';
    modal.style.width = '80%'; modal.style.maxWidth = '80%'; // 22.09-107: карточки справочников — 80% по центру
    modal.innerHTML = html; overlay.classList.add('show');
    var listEl = document.getElementById('pm-name-list');
    var nameEl = document.getElementById('pm-name');
    if (listEl && nameEl) listEl.addEventListener('change', function () {
      if (listEl.value) nameEl.value = listEl.value;
      nameEl.focus(); nameEl.select();
    });
    var delNameBtn = document.getElementById('pm-namedel');
    if (delNameBtn) delNameBtn.addEventListener('click', function () { delProfNameFromModal(); });
    if (nameEl) { nameEl.focus(); nameEl.select(); }
  }
  // Удалить выбранное название из выпадающего списка (Сборка 22.09-89).
  // Если в справочнике есть записи с этим названием — удаляются и они (с подтверждением),
  // иначе название всё равно осталось бы видно через них.
  function delProfNameFromModal() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var listEl = document.getElementById('pm-name-list');
    var name = listEl ? listEl.value : '';
    if (!name) { toast('warn', 'Сначала выберите название в списке'); return; }
    if (!window.SP_PROFS) return;
    var entries = SP_PROFS.getAll().filter(function (p) { return p.name === name; });
    var msg;
    if (entries.length) {
      // есть записи справочника — предупреждаем и считаем использование в работах ГРП
      var used = 0;
      try {
        (WORK.getWorks('ГРП') || []).forEach(function (w) {
          (w.crew || []).forEach(function (e) { if (e && e.prof === name) used++; });
        });
      } catch (e) {}
      msg = 'Удалить название «' + name + '» из списка вместе с ' + entries.length +
        (entries.length === 1 ? ' записью' : ' записями') + ' справочника?';
      if (used) msg += '\n\n⚠️ Оно указано в составе исполнителей ' + used + (used === 1 ? ' работы' : ' работ') + ' ГРП — там останется пометка «⚠ нет в справочнике».';
    } else {
      msg = 'Убрать название «' + name + '» из списка?';
    }
    return spConfirm(msg, { title: 'Удаление из списка профессий', ok: 'Убрать', danger: true }, function () { // 22.09-244: оформленное окно
    SP_PROFS.deleteProfNameByName(name);
    entries.forEach(function (e2) { SP_PROFS.deleteProf(e2.id); });
    logAction('Удаление названия профессии из списка', name);
    toast('ok', entries.length ? 'Название и записи справочника удалены' : 'Название убрано из списка');
    // перерисовать сам выпадающий список (оставаясь в карточке)
    if (listEl) listEl.innerHTML = '<option value="">— выбрать из списка —</option>' + profNameListOptionsHtml();
    });
  }
  function saveProf() {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    var nEl = document.getElementById('pm-name');
    var gEl = document.getElementById('pm-grade');
    var res = (S.profModalMode === 'edit')
      ? SP_PROFS.updateProf(S.profModalPid, nEl ? nEl.value : '', gEl ? gEl.value : '')
      : SP_PROFS.addProf(nEl ? nEl.value : '', gEl ? gEl.value : '');
    if (!res.ok) { toast('err', res.error); return; }
    try { if (res.prof && res.prof.name && SP_PROFS.addProfName) SP_PROFS.addProfName(res.prof.name); } catch (e) {}
    logAction(S.profModalMode === 'edit' ? 'Изменение профессии' : 'Добавление профессии', SP_PROFS.label(res.prof));
    toast('ok', S.profModalMode === 'edit' ? 'Профессия изменена' : 'Профессия «' + SP_PROFS.label(res.prof) + '» добавлена');
    overlay.classList.remove('show'); modal.style.width = ''; modal.style.maxWidth = ''; // 22.09-107
    refresh();
  }
  function delProfAction(pid) {
    if (S.role !== 'admin') { toast('err', 'Только для администратора'); return; }
    if (!window.SP_PROFS) return;
    var p = SP_PROFS.getById(pid);
    if (!p) return;
    // Сколько работ ГРП ссылаются на профессию (по наименованию + разряду)
    var used = 0;
    try {
      (WORK.getWorks('ГРП') || []).forEach(function (w) {
        (w.crew || []).forEach(function (e) {
          if (e && e.prof === p.name && String(e.grade || '') === String(p.grade)) used++;
        });
      });
    } catch (e) {}
    var msg = 'Удалить профессию «' + SP_PROFS.label(p) + '» из справочника?';
    if (used) msg += '\n\n⚠️ Она указана в составе исполнителей ' + used + (used === 1 ? ' работы' : ' работ') + ' ГРП — там останется пометка «⚠ нет в справочнике».';
    return spConfirm(msg, { title: 'Удаление профессии', ok: 'Удалить', danger: true }, function () { // 22.09-244: оформленное окно
    SP_PROFS.deleteProf(pid);
    logAction('Удаление профессии', SP_PROFS.label(p));
    toast('ok', 'Профессия удалена');
    refresh();
    });
  }

