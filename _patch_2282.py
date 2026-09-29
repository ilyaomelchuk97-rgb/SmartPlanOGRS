#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""22.09-82:
1) Окно «Добавить объекты в график»: фильтр «Ответственный» — только мастера
   (master/smaster/nach через getMasters()), слесарей и прочих ролей больше нет.
2) В месячных таблицах графика (клик по месяцу и график объекта в месяце —
   обе рисуются graphDaysTableHtml) ячейки дней, когда мастер графика на работе
   (wkDayState === 'work'), закрашиваются зелёным (#dcfce7); шапки дней тоже;
   под таблицей — легенда с указанием мастера и числа рабочих дней.
"""
import io, re

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

# ---------- 1) Фильтр «Ответственный» — без слесарей ----------
old_resp = """    var users = (DB.getUsers() || []).filter(function (u) { return u && u.active !== false; });
    users.sort(function (a, b) { return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru'); });
    var respOpts = '<option value="">Все ответственные</option>';"""
new_resp = """    // 22.09-82: в фильтре «Ответственный» — только мастера (ст. мастера, нач. участка),
    // как в окне создания графика. Слесарей и прочие роли здесь быть не должно.
    var users = getMasters().slice();
    users.sort(function (a, b) { return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru'); });
    var respOpts = '<option value="">Все ответственные</option>';"""
rep(old_resp, new_resp, 'resp-filter')

# ---------- 2) Зелёные рабочие дни мастера в месячной таблице ----------
old_tbl = """  function graphDaysTableHtml(g, rows, mi) {
    var year = g.year;
    var days = new Date(year, mi + 1, 0).getDate();
    var h = '<div class="gw-scroll"><div class="gw-grid" style="grid-template-columns:minmax(210px,1.3fr) repeat(' + days + ',minmax(54px,1fr))">';
    h += '<div class="gw-h gw-corner">Объект<span>' + MONTHS_RU[mi] + ' ' + year + '</span></div>';
    for (var d = 1; d <= days; d++) {
      h += '<div class="gw-h gd-h"><b>' + d + '</b><span>' + WEEKDAYS_RU[new Date(year, mi, d).getDay()] + '</span></div>';
    }
    rows.forEach(function (ob) {
      h += '<div class="gw-obj"><span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span><span class="gw-obj-nm" title="' + esc(ob.title || ob.label) + '">' + esc(ob.label) + '</span></div>';
      for (var c = 1; c <= days; c++) {
        var iso = year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(c).padStart(2, '0');
        var tri = '';
        if (ob.src) {
          gwObjWorks(ob.src).forEach(function (wrk) {
            (wrk.occs || []).forEach(function (oc) {
              if (oc.date === iso) tri += '<span class="gw-tri-w" data-gw-tip="' + esc(gwWorkTipHtml(g, ob.src, wrk, oc)) + '">' + (gwOccDone(oc) ? gwDoneMark(16, gwColorOf(g, oc.wid || wrk.wid)) : gwTriangle(gwColorOf(g, oc.wid || wrk.wid), 14)) + '</span>';
            });
          });
        }
        h += '<div class="gd-c">' + (tri ? '<div class="gw-tris">' + tri + '</div>' : '') + '</div>';
      }
    });
    h += '</div></div>';
    return h;
  }"""
new_tbl = """  function graphDaysTableHtml(g, rows, mi) {
    var year = g.year;
    var days = new Date(year, mi + 1, 0).getDate();
    // 22.09-82: состояние каждого дня месяца для мастера графика по его графику
    // смен («Работники»): зелёные ячейки — дни, когда он на работе; так видно,
    // в какие дни реально можно ставить треугольники работ.
    var dayStates = {}, workCnt = 0;
    if (g.respId) {
      for (var di = 1; di <= days; di++) {
        var isoD = year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(di).padStart(2, '0');
        try { dayStates[di] = wkDayState(g.respId, isoD); } catch (e) { dayStates[di] = ''; }
        if (dayStates[di] === 'work') workCnt++;
      }
    }
    var h = '<div class="gw-scroll"><div class="gw-grid" style="grid-template-columns:minmax(210px,1.3fr) repeat(' + days + ',minmax(54px,1fr))">';
    h += '<div class="gw-h gw-corner">Объект<span>' + MONTHS_RU[mi] + ' ' + year + '</span></div>';
    for (var d = 1; d <= days; d++) {
      h += '<div class="gw-h gd-h"' + (dayStates[d] === 'work' ? ' style="background:#dcfce7"' : '') + '><b>' + d + '</b><span>' + WEEKDAYS_RU[new Date(year, mi, d).getDay()] + '</span></div>';
    }
    rows.forEach(function (ob) {
      h += '<div class="gw-obj"><span class="chip ' + esc(ob.type) + '">' + esc(ob.type) + '</span><span class="gw-obj-nm" title="' + esc(ob.title || ob.label) + '">' + esc(ob.label) + '</span></div>';
      for (var c = 1; c <= days; c++) {
        var iso = year + '-' + String(mi + 1).padStart(2, '0') + '-' + String(c).padStart(2, '0');
        var tri = '';
        if (ob.src) {
          gwObjWorks(ob.src).forEach(function (wrk) {
            (wrk.occs || []).forEach(function (oc) {
              if (oc.date === iso) tri += '<span class="gw-tri-w" data-gw-tip="' + esc(gwWorkTipHtml(g, ob.src, wrk, oc)) + '">' + (gwOccDone(oc) ? gwDoneMark(16, gwColorOf(g, oc.wid || wrk.wid)) : gwTriangle(gwColorOf(g, oc.wid || wrk.wid), 14)) + '</span>';
            });
          });
        }
        h += '<div class="gd-c"' + (dayStates[c] === 'work' ? ' style="background:#dcfce7"' : '') + '>' + (tri ? '<div class="gw-tris">' + tri + '</div>' : '') + '</div>';
      }
    });
    h += '</div></div>';
    // Легенда подсветки: чей график смен и сколько рабочих дней в месяце
    if (g.respId) {
      var mName = g.respName || '';
      h += '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:11.5px;color:var(--muted);font-weight:700;flex-wrap:wrap">' +
        '<span style="width:14px;height:14px;border-radius:3px;background:#dcfce7;border:1px solid #16a34a;flex:0 0 auto"></span>' +
        'мастер ' + (mName ? '«' + esc(mName) + '» ' : '') + 'на работе (график смен, вкладка «Работники») — ' + workCnt + ' дн. в этом месяце' +
        '</div>';
    }
    return h;
  }"""
rep(old_tbl, new_tbl, 'days-table-green')

# ---------- 3) build-marker ----------
rep(
  "    objmap: ['Карта объектов', 'Сборка 22.09-81 · график работ уважает график смен мастера (только новые/изменённые серии переносятся на рабочие дни; старые не трогаем)'],",
  "    objmap: ['Карта объектов', 'Сборка 22.09-82 · в добавлении объектов ответственный — только мастера; рабочие дни мастера подсвечены зелёным в месячном графике'],",
  'build-marker'
)

io.open(APP, 'w', encoding='utf-8').write(src)
print('app.js: %d -> %d (+%d bytes)' % (orig, len(src), len(src) - orig))

idx = io.open(IDX, encoding='utf-8').read()
m = re.search(r'(<div[^>]*id="build-marker"[^>]*>)(.*?)(</div>)', idx, re.S)
assert m, 'build-marker not found'
idx = idx[:m.start(2)] + 'Сборка 22.09-82 · ответственный при добавлении объектов — без слесарей; в графике на месяц рабочие дни мастера подсвечены зелёным' + idx[m.end(2):]
io.open(IDX, 'w', encoding='utf-8').write(idx)
print('index.html build-marker updated')
print('DONE')
