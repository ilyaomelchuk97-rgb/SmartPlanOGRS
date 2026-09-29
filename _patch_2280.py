#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""22.09-80: График работ учитывает график смен мастера.
Выбор пользователя:
  - shift_direction=prev   — даты, попавшие на нерабочий день мастера, сдвигаются НАЗАД
                             до ближайшего предыдущего рабочего дня;
  - apply_scope=everywhere — генерация серий + каскады при ручном переносе
                             (OnMove/OnCreate) + предупреждение при ручной постановке
                             задачи на нерабочий день (не блокируем — аварийные работы);
  - realign_all            — при «Сохранить» периодичности неизменённые серии тоже
                             пересчитываются по новому правилу (выполненные задачи не трогаем).
«Рабочий день» = masterCapacity>0: отсутствия, цикл 2/2 бригады, исключение одиночного
мастера — та же логика, что и у загрузки дня в «Планировании».
"""
import io, re, sys

APP = '/home/user/root_index/app.js'
IDX = '/home/user/index.html'

src = io.open(APP, encoding='utf-8').read()
orig = len(src)

def rep(old, new, tag, count=1):
    global src
    n = src.count(old)
    assert n == count, '%s: expected %d match(es), found %d' % (tag, count, n)
    src = src.replace(old, new)
    print('OK:', tag)

# ---------- 1) Хелперы: рабочий день мастера / сдвиг назад / предупреждение ----------
old_h = "  function gwAddDaysISO(iso, n) { var d = gwFromISO(iso); d.setDate(d.getDate() + n); return gwToISO(d); }\n"
new_h = old_h + """  /* ===== ГРАФИК СМЕН МАСТЕРА В ГРАФИКЕ РАБОТ (22.09-80) =====
     «Рабочий день» мастера определяем КАК ВМЕСТИМОСТЬ ДНЯ > 0 (masterCapacity):
     отсутствия, выходные 5/2 (сб/вс) и 2/2 (цикл бригады), исключение одиночного
     мастера — точно как загрузка дня в «Планировании». Без мастера ограничений нет. */
  function gwIsWorkDay(masterId, iso) {
    if (!masterId) return true;
    try { return masterCapacity(masterId, dateToOff(gwFromISO(iso))) > 0; } catch (e) { return true; }
  }
  // Дата выполнения: якорь серии, сдвинутый НАЗАД до ближайшего рабочего дня
  // (суббота → пятница). Максимум 31 день назад — страховка от вечного цикла
  // (например, месячный отпуск мастера — тогда оставляем исходную дату).
  function gwBackToWorkDay(masterId, iso) {
    if (gwIsWorkDay(masterId, iso)) return iso;
    var d = gwFromISO(iso);
    for (var i = 0; i < 31; i++) {
      d.setDate(d.getDate() - 1);
      var t = gwToISO(d);
      if (gwIsWorkDay(masterId, t)) return t;
    }
    return iso;
  }
  // Дата вхождения серии: сдвиг назад до рабочего дня, но НЕ уходя за левую
  // границу года графика (треугольник в прошлом году этому графику не нужен).
  function gwOccDate(masterId, anchorIso, gYear) {
    var shifted = gwBackToWorkDay(masterId, anchorIso);
    if (shifted < String(gYear) + '-01-01') shifted = anchorIso;
    return shifted;
  }
  // Текст предупреждения для ручного планирования: мастер в этот день не работает.
  // '' — день рабочий, предупреждать нечего. НЕ блокируем (аварийные работы бывают).
  function wkOffDayWarn(masterId, off) {
    if (!masterId && masterId !== 0) return '';
    try { if (masterCapacity(masterId, off) > 0) return ''; } catch (e) { return ''; }
    var m = masterById(masterId);
    var ds = gwToISO(offToDate(off));
    var st = wkDayState(masterId, ds);
    var wd = wkData(masterId);
    var reason = st === 'abs' ? ('отсутствие' + (wd.abs[ds] ? ': ' + wd.abs[ds] : '')) : 'выходной по графику смен';
    return '⚠ ' + (m ? m.name : 'Мастер') + ' · ' + fmt(offToDate(off)) + ' — ' + reason + '. Задача поставлена на нерабочий день мастера.';
  }
"""
rep(old_h, new_h, 'helpers')

# ---------- 2) graphsPeriodSave: счётчик перенесённых ----------
rep(
  "    var created = 0, removed = 0, yearWarn = 0, taskFail = 0;",
  "    var created = 0, removed = 0, yearWarn = 0, taskFail = 0, shiftedCnt = 0;",
  'counter'

)

# ---------- 3) НЕИЗМЕНЁННЫЕ серии: пересчёт по правилу (перед чисткой прошедших) ----------
old_u = """        if (unchanged) {
          usedSids[r.sid] = 1;
          // незакрытые задачи серии с прошедшей датой — убираем (они «горят
          // красным» как просрочка), НО только если прошедшие дни не добавляются
          if (!pastOn) {"""
new_u = """        if (unchanged) {
          usedSids[r.sid] = 1;
          // 22.09-80: серия не изменилась, но даты ВСЕГДА приводим к правилу
          // «выполнение — только в рабочий день мастера графика» (сдвиг назад).
          // Выполненные задачи не трогаем — факт не переписываем. Ручные переносы
          // дат при этом сбрасываются к пред. рабочему дню своего якоря.
          (old.occs || []).forEach(function (oc) {
            var tk2 = oc.tid ? TASKS_DB.getTask(oc.tid) : null; // из БД
            if (tk2 && isDone(tk2)) return; // выполнена — факт, не переносим
            var occNew = gwOccDate(g.respId, oc.date, g.year);
            if (occNew === oc.date) return;
            oc.date = occNew; shiftedCnt++;
            if (tk2) {
              var oldOff2 = tk2.d;
              var dlIso2 = gwAddDaysISO(occNew, r.dev || 0);
              tk2.d = dateToOff(gwFromISO(occNew));
              tk2.dl_date = dlIso2; tk2.dl = dateToOff(gwFromISO(dlIso2));
              TASKS_DB.updateTask(tk2.id, { d: tk2.d, dl: tk2.dl, dl_date: tk2.dl_date });
              invalidateRouteCache(tk2.m, oldOff2);
              invalidateRouteCache(tk2.m, tk2.d);
            }
          });
          // незакрытые задачи серии с прошедшей датой — убираем (они «горят
          // красным» как просрочка), НО только если прошедшие дни не добавляются
          if (!pastOn) {"""
rep(old_u, new_u, 'unchanged-realign')

# ---------- 4) Генерация новой серии: сдвиг каждого вхождения к рабочему дню ----------
old_g = """          while (iso <= endISO && guard < 400) {
            // ПРОШЕДШИЕ даты: в графике остаются треугольниками. Задачи в
            // планировании создаются, только если у объекта включено
            // «Добавлять задачи на прошедшие дни»
            var isPast = gwFromISO(iso) < TODAY;
            var tk = null;
            if (!isPast || pastOn) {
              // дедлайн = дата по графику + дни из отклонения
              var dlIso = gwAddDaysISO(iso, r.dev || 0);"""
new_g = """          while (iso <= endISO && guard < 400) {
            // Дата выполнения = якорь серии, сдвинутый НАЗАД до рабочего дня
            // мастера графика (график смен «Работники»). Шаг серии при этом
            // считается ОТ ЯКОРЯ — периодичность (минус отклонение) не плывёт.
            var occIso = gwOccDate(g.respId, iso, g.year);
            if (occIso !== iso) shiftedCnt++;
            // ПРОШЕДШИЕ даты: в графике остаются треугольниками. Задачи в
            // планировании создаются, только если у объекта включено
            // «Добавлять задачи на прошедшие дни»
            var isPast = gwFromISO(occIso) < TODAY;
            var tk = null;
            if (!isPast || pastOn) {
              // дедлайн = (сдвинутая) дата выполнения + дни из отклонения
              var dlIso = gwAddDaysISO(occIso, r.dev || 0);"""
rep(old_g, new_g, 'generation-shift')

rep(
  "                  m: g.respId, d: dateToOff(gwFromISO(iso)), o: ob.oid, w: r.wid, garea: area,",
  "                  m: g.respId, d: dateToOff(gwFromISO(occIso)), o: ob.oid, w: r.wid, garea: area,",
  'addtask-date'
)
rep(
  "            w.occs.push({ date: iso, tid: tk ? tk.id : null, wid: r.wid });",
  "            w.occs.push({ date: occIso, tid: tk ? tk.id : null, wid: r.wid });",
  'occ-push'
)

# ---------- 5) Тост о количестве перенесённых ----------
old_t = "    if (created || removed) toast('ok', 'Работы в планировании: создано ' + created + (removed ? ', удалено старых ' + removed : '') + '. Треугольники выставлены в графике.');"
new_t = old_t + "\n    if (shiftedCnt) toast('ok', '⏮ По графику смен мастера: ' + shiftedCnt + ' вхождений перенесено на ближайший предыдущий рабочий день.');"
rep(old_t, new_t, 'shifted-toast')

# ---------- 6) Подсказка в окне «Настроить периодичность» ----------
old_i = "У каждого объекта может быть несколько работ — «+ работа». Работы появляются в «Планировании»; перемещение задачи там переносит её и последующие по шагу серии.</div>';"
new_i = "У каждого объекта может быть несколько работ — «+ работа». Работы появляются в «Планировании»; перемещение задачи там переносит её и последующие по шагу серии. <b>Даты, попавшие на день, когда мастер графика не работает (выходные 5/2 и 2/2, отсутствия — график смен на вкладке «Работники»), автоматически переносятся на ближайший предыдущий рабочий день; шаг серии считается от своих исходных дат.</b></div>';"
rep(old_i, new_i, 'period-hint')

# ---------- 7) Каскад при ручном переносе задачи серии (graphSeriesOnMove) ----------
old_m = """    wrk.occs[idx].date = gwToISO(offToDate(t.d));
    var prev = wrk.occs[idx].date;
    for (var k = idx + 1; k < wrk.occs.length; k++) {
      prev = gwNextISO(prev, wrk.period, wrk.dev || 0);
      wrk.occs[k].date = prev;
      var tk = wrk.occs[k].tid ? TASKS_DB.getTask(wrk.occs[k].tid) : null; // из БД
      if (tk) { tk.d = dateToOff(gwFromISO(prev)); if (TASKS_DB) TASKS_DB.updateTask(tk.id, { d: tk.d }); }
    }"""
new_m = """    wrk.occs[idx].date = gwToISO(offToDate(t.d));
    // Последующие: якорь = шаг от поставленной вручную даты, а дата выполнения —
    // якорь, сдвинутый назад до рабочего дня мастера графика (22.09-80).
    var prevA = wrk.occs[idx].date;
    for (var k = idx + 1; k < wrk.occs.length; k++) {
      prevA = gwNextISO(prevA, wrk.period, wrk.dev || 0);
      var occIso3 = gwOccDate(g.respId, prevA, g.year);
      wrk.occs[k].date = occIso3;
      var tk = wrk.occs[k].tid ? TASKS_DB.getTask(wrk.occs[k].tid) : null; // из БД
      if (tk) { tk.d = dateToOff(gwFromISO(occIso3)); if (TASKS_DB) TASKS_DB.updateTask(tk.id, { d: tk.d }); }
    }"""
rep(old_m, new_m, 'onMove-cascade')

# ---------- 8) Каскад при включении новой задачи в серию (graphSeriesOnCreate) ----------
old_c = """    var prev = iso;
    for (var k = idx + 1; k < wrk.occs.length; k++) {
      prev = gwNextISO(prev, wrk.period, wrk.dev || 0);
      wrk.occs[k].date = prev;
      var tk = wrk.occs[k].tid ? TASKS_DB.getTask(wrk.occs[k].tid) : null; // из БД
      if (tk) { tk.d = dateToOff(gwFromISO(prev)); if (TASKS_DB) TASKS_DB.updateTask(tk.id, { d: tk.d }); }
    }"""
new_c = """    var prevA = iso; // якорь — дата включённой задачи
    for (var k = idx + 1; k < wrk.occs.length; k++) {
      prevA = gwNextISO(prevA, wrk.period, wrk.dev || 0);
      var occIso3 = gwOccDate(g.respId, prevA, g.year); // 22.09-80: пред. рабочий день
      wrk.occs[k].date = occIso3;
      var tk = wrk.occs[k].tid ? TASKS_DB.getTask(wrk.occs[k].tid) : null; // из БД
      if (tk) { tk.d = dateToOff(gwFromISO(occIso3)); if (TASKS_DB) TASKS_DB.updateTask(tk.id, { d: tk.d }); }
    }"""
rep(old_c, new_c, 'onCreate-cascade')

# ---------- 9) Предупреждение при ручном перетаскивании в календаре ----------
rep(
  "    if (!canDropOn(newMaster)) { toast('err', 'Этот мастер вне вашего доступа'); return; }\n    var target = masterById(newMaster);",
  "    if (!canDropOn(newMaster)) { toast('err', 'Этот мастер вне вашего доступа'); return; }\n    var target = masterById(newMaster);\n    // 22.09-80: мастер в этот день не работает (график смен) — НЕ запрещаем\n    // (бывают аварийные вызовы), но предупреждаем после переноса.\n    var _wkOffWarn = wkOffDayWarn(newMaster, newOff);",
  'move-warn-calc'
)
old_mtc = """      drawCalendarGrid();
      var load = loadForDay(newMaster, newOff);
      if (load > masterCapacity(newMaster, newOff)) {"""
new_mtc = """      drawCalendarGrid();
      if (_wkOffWarn) toast('warn', _wkOffWarn);
      var load = loadForDay(newMaster, newOff);
      if (_wkOffWarn) { /* день нерабочий — перегрузочный тост не дублируем */ }
      else if (load > masterCapacity(newMaster, newOff)) {"""
rep(old_mtc, new_mtc, 'move-warn-toast')

# ---------- 10) Предупреждение при создании/правке задачи через окно ----------
rep(
  "            logAction('Редактирование задачи', ex.addr || addr);\n            closeTaskObjectPickers();\n            overlay.classList.remove('show'); toast('ok', '✓ Задача обновлена'); refresh(); return;",
  "            logAction('Редактирование задачи', ex.addr || addr);\n            closeTaskObjectPickers();\n            overlay.classList.remove('show');\n            var _wEdit = wkOffDayWarn(ex.m, ex.d);\n            if (_wEdit) toast('warn', _wEdit);\n            toast('ok', '✓ Задача обновлена'); refresh(); return;",
  'edit-warn'
)
rep(
  "        logAction('Создание задачи', addr + ' (' + fmtH(taskHours(t)) + ' ч)');\n        toast('ok', 'Заявка добавлена: ' + addr + ' (' + fmtH(taskHours(t)) + ' ч)');",
  "        logAction('Создание задачи', addr + ' (' + fmtH(taskHours(t)) + ' ч)');\n        var _wNew = wkOffDayWarn(t.m, t.d);\n        if (_wNew) toast('warn', _wNew);\n        toast('ok', 'Заявка добавлена: ' + addr + ' (' + fmtH(taskHours(t)) + ' ч)');",
  'create-warn'
)

# ---------- 11) build-marker в TITLES ----------
rep(
  "    objmap: ['Карта объектов', 'Сборка 22.09-79 · календарь планирования связан с графиками смен: метка состояния в каждой ячейке + всплывающий месячный график работника по клику на имя'],",
  "    objmap: ['Карта объектов', 'Сборка 22.09-80 · график работ учитывает график смен мастера: даты серий переносятся на пред. рабочий день, каскады и ручные переносы — с предупреждением'],",
  'build-marker'
)

io.open(APP, 'w', encoding='utf-8').write(src)
print('app.js: %d -> %d (+%d bytes)' % (orig, len(src), len(src) - orig))

# ---------- index.html build-marker ----------
idx = io.open(IDX, encoding='utf-8').read()
m = re.search(r'(<div[^>]*id="build-marker"[^>]*>)(.*?)(</div>)', idx, re.S)
assert m, 'build-marker not found'
idx = idx[:m.start(2)] + 'Сборка 22.09-80 · график работ ↔ график смен: даты серий — только на рабочие дни мастера (назад), предупреждение при постановке задачи на нерабочий день' + idx[m.end(2):]
io.open(IDX, 'w', encoding='utf-8').write(idx)
print('index.html build-marker updated')
print('DONE')
