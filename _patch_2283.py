#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""22.09-83: участок «ГРП» + починка синхронизации участков.
1) areas_db.js: syncWithServer(db) НЕ БЫЛА определена — каждый save() (создание/
   переименование/удаление участка) при залогиненном пользователе падал с
   ReferenceError: syncWithServer is not defined. Добавляем функцию (как в workers_db.js).
2) Участок «ГРП» добавляется в DEFAULTS и обязательной идемпотентной миграцией
   в ensureSeed — с фиксированным id 'a_grp' (на сервере уже создан записью с тем же
   id → upsert сходится, дубликатов не будет).
3) Маркер сборки 22.09-83.
"""
import io, re

DB = '/home/user/root_index/areas_db.js'
APP = '/home/user/root_index/app.js'
IDX = '/home/user/index.html'

src = io.open(DB, encoding='utf-8').read()

def rep(old, new, tag):
    global src
    assert src.count(old) == 1, '%s: matches=%d' % (tag, src.count(old))
    src = src.replace(old, new)
    print('OK:', tag)

# 1) DEFAULTS + ГРП
rep(
    "  var DEFAULTS = [{ id: 'a_ubirogs', name: 'УБиРОГС' }];",
    "  var DEFAULTS = [{ id: 'a_ubirogs', name: 'УБиРОГС' }, { id: 'a_grp', name: 'ГРП' }];",
    'defaults'
)

# 2) syncWithServer — раньше функции не было, save() падал ReferenceError
old_api = "  function apiUrl(path) { return (window.SP_CONFIG && window.SP_CONFIG.serverUrl ? SP_CONFIG.serverUrl : '') + path; }"
new_api = old_api + """
  // Сборка 22.09-83: автосинхронизация участков с сервером.
  // РАНЬШЕ: вызывалась из save(), но НЕ БЫЛА определена → ReferenceError,
  // создание/переименование/удаление участка через интерфейс падало у всех
  // залогиненных пользователей. Теперь как в workers_db.js — upsert каждой записи.
  function syncWithServer(db) {
    if (!window.SP_API || !window.SP_API.getToken || !window.SP_API.getToken()) return;
    if (db && db.areas) {
      db.areas.forEach(function (a) {
        if (!a || !a.id) return;
        window.SP_API.upsert('areas', Object.assign({}, a)).catch(function (e) {
          if (window.SP_ERRORS && SP_ERRORS.log) SP_ERRORS.log('warn', 'areas.sync', e && e.err || e);
        });
      });
    }
  }"""
rep(old_api, new_api, 'syncWithServer')

# 3) Идемпотентная миграция: участок «ГРП» должен быть у всех
old_seed = """  function ensureSeed() {
    var db = init();
    if (!db.areas.length) {
      db.areas = DEFAULTS.map(function (a) { return { id: a.id, name: a.name }; });
      save(db);
    }
    return Promise.resolve(db);
  }"""
new_seed = """  function ensureSeed() {
    var db = init();
    if (!db.areas.length) {
      db.areas = DEFAULTS.map(function (a) { return { id: a.id, name: a.name }; });
      save(db);
    }
    // Сборка 22.09-83: обязательный участок «ГРП». Идемпотентно: если его нет —
    // добавляем с ФИКСИРОВАННЫМ id 'a_grp' (все клиенты пишут одну и ту же
    // серверную запись: upsert по id, дубликатов не возникает). Если участок
    // с таким именем уже создан вручную (другой id) — ничего не делаем.
    if (!db.areas.some(function (a) { return a && a.name === 'ГРП'; })) {
      db.areas.push({ id: 'a_grp', name: 'ГРП', created: Date.now() });
      save(db); // save() сама синхронизирует с сервером (syncWithServer выше)
    }
    // Пустой каталог видов работ под участок — как при создании через интерфейс
    try {
      if (window.SP_WORK && typeof SP_WORK.ensureArea === 'function') SP_WORK.ensureArea('ГРП');
    } catch (e) {}
    return Promise.resolve(db);
  }"""
rep(old_seed, new_seed, 'ensureSeed-migration')

io.open(DB, 'w', encoding='utf-8').write(src)
print('areas_db.js patched')

# 4) Маркеры сборки
app = io.open(APP, encoding='utf-8').read()
old_t = "    objmap: ['Карта объектов', 'Сборка 22.09-82 · в добавлении объектов ответственный — только мастера; рабочие дни мастера подсвечены зелёным в месячном графике'],"
new_t = "    objmap: ['Карта объектов', 'Сборка 22.09-83 · создан участок «ГРП» (на сервере и в сиде); починена синхронизация участков — save() падал без syncWithServer'],"
assert app.count(old_t) == 1
app = app.replace(old_t, new_t)
io.open(APP, 'w', encoding='utf-8').write(app)

idx = io.open(IDX, encoding='utf-8').read()
m = re.search(r'(<div[^>]*id="build-marker"[^>]*>)(.*?)(</div>)', idx, re.S)
assert m, 'build-marker not found'
idx = idx[:m.start(2)] + 'Сборка 22.09-83 · участок «ГРП» создан; починка: создание/переименование участков через интерфейс больше не падает (syncWithServer)' + idx[m.end(2):]
io.open(IDX, 'w', encoding='utf-8').write(idx)
print('markers updated; DONE')
