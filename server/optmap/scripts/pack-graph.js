/* ============================================================
   OptMap → SmartPlan: упаковщик графа в бинарный формат OPTG1BIN.
   ------------------------------------------------------------
   Зачем: загрузка graph.json.gz требовала разобрать ~100 МБ JSON в
   обычные JS-массивы (~400–500 МБ пик памяти) — сервер на Render (free,
   512 МБ) умирал по OOM при деплое (502). Бинарный формат читается
   почти без копий: gunzip (~45 МБ буфер) + типизированные массивы как
   ВИДЫ поверх буфера (без копирования). Пик загрузки ~70 МБ вместо ~500.

   Запуск:  node server/optmap/scripts/pack-graph.js <in.json.gz> <out.bin.gz>
   ============================================================ */
'use strict';

const fs = require('fs');
const zlib = require('zlib');

const MAGIC = 'OPTG1BIN';

function packGraph(obj) {
  if (!obj || obj.format !== 'optmap-graph') throw new Error('Неверный формат входного графа');
  const n = obj.lat.length;
  const m = obj.eu.length;
  const k = obj.shapeCoords.length; // плоский массив чисел (2 координаты на точку)
  if (obj.shapeOff.length !== m + 1) throw new Error('shapeOff не совпадает с числом рёбер');

  const metaJson = Buffer.from(JSON.stringify({
    meta: obj.meta || {},
    classes: obj.classes || [],
    names: obj.names || [],
    mapData: null, // в SmartPlan не используется
    counts: { nodes: n, edges: m, shapeNumbers: k },
  }), 'utf8');

  // Разметка секций с выравниванием: F64 → 8, U32/I32 → 4, U16 → 2
  const head = 8 + 4 + metaJson.length;
  const sections = [];
  let off = head;
  function align(a) { off = Math.ceil(off / a) * a; }
  function sec(name, bytes, alignTo) {
    align(alignTo);
    sections.push({ name, off, len: bytes });
    off += bytes;
  }
  sec('lat', n * 8, 8);
  sec('lon', n * 8, 8);
  sec('eu', m * 4, 4);
  sec('ev', m * 4, 4);
  sec('lenM', m * 8, 8);
  sec('kmh', m * 2, 2);
  sec('clsI', m * 4, 4);
  sec('nameI', m * 4, 4);
  sec('shapeOff', (m + 1) * 4, 4);
  sec('shapeCoords', k * 8, 8);

  const total = off;
  const buf = Buffer.alloc(total);
  buf.write(MAGIC, 0, 'latin1');
  buf.writeUInt32LE(metaJson.length, 8);
  metaJson.copy(buf, 12);

  const S = Object.fromEntries(sections.map((s) => [s.name, s]));
  const f64 = (arr, s) => { const v = new Float64Array(buf.buffer, s.off, arr.length); v.set(arr); };
  const u32 = (arr, s) => { const v = new Uint32Array(buf.buffer, s.off, arr.length); v.set(arr); };
  const i32 = (arr, s) => { const v = new Int32Array(buf.buffer, s.off, arr.length); v.set(arr); };
  const u16 = (arr, s) => { const v = new Uint16Array(buf.buffer, s.off, arr.length); v.set(arr); };

  f64(obj.lat, S.lat);
  f64(obj.lon, S.lon);
  u32(obj.eu, S.eu);
  u32(obj.ev, S.ev);
  f64(obj.lenM, S.lenM);
  u16(obj.kmh, S.kmh);
  i32(obj.clsI, S.clsI);
  i32(obj.nameI, S.nameI);
  u32(obj.shapeOff, S.shapeOff);
  f64(obj.shapeCoords, S.shapeCoords);

  return buf;
}

function main() {
  const [,, inPath, outPath] = process.argv;
  if (!inPath || !outPath) {
    console.error('запуск: node pack-graph.js <in.graph.json.gz> <out.graph.bin.gz>');
    process.exit(1);
  }
  const t0 = Date.now();
  console.log('читаю', inPath, '…');
  const json = JSON.parse(zlib.gunzipSync(fs.readFileSync(inPath)).toString('utf8'));
  console.log('узлов:', json.lat.length, 'рёбер:', json.eu.length, '| чисел геометрии:', json.shapeCoords.length);
  const buf = packGraph(json);
  const gz = zlib.gzipSync(buf, { level: 6 });
  fs.writeFileSync(outPath, gz);
  console.log('готово за', Date.now() - t0, 'мс →', outPath,
    '(', Math.round(buf.length / 1048576), 'МБ бинарь,', Math.round(gz.length / 1048576), 'МБ в gzip )');
}

main();
