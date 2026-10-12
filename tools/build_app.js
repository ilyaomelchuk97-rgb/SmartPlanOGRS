#!/usr/bin/env node
/* ============================================================
   SmartPlan — сборка root_index/app.js из частей (22.09-246)
   ------------------------------------------------------------
   Программа разделена на части по разделам: root_index/app/*.js
   (00_open — шапка, 01…17 — разделы, 99_close — конец).
   Браузеру отдаётся ОДИН собранный файл root_index/app.js —
   поведение сайта то же, что и до разделения.

   ПРАВИТЬ — ЧАСТИ, затем собрать:
     node tools/build_app.js          — собрать app.js
     node tools/build_app.js --check  — проверить, что app.js
                                        совпадает с частями
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'root_index', 'app');
const OUT = path.join(ROOT, 'root_index', 'app.js');

function partFiles() {
  return fs.readdirSync(DIR).filter((f) => /^\d\d_[\w-]+\.js$/.test(f)).sort();
}
function build() {
  return partFiles().map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('');
}

if (require.main === module) {
  const out = build();
  try { new vm.Script(out, { filename: 'app.js' }); } catch (e) {
    console.error('ОШИБКА синтаксиса в собранном app.js: ' + e.message);
    process.exit(1);
  }
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== out) { console.error('app.js НЕ совпадает с частями — соберите: node tools/build_app.js'); process.exit(1); }
    console.log('app.js совпадает с частями (' + partFiles().length + ' файлов)');
  } else {
    fs.writeFileSync(OUT, out);
    console.log('app.js собран из ' + partFiles().length + ' файлов, ' + out.split('\n').length + ' строк');
  }
}

module.exports = { build, partFiles, DIR, OUT };
