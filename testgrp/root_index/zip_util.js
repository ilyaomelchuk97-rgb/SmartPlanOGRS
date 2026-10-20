/* ============================================================
   SmartPlan — ZIP-утилита (zip_util.js) · Сборка 22.09-139
   ------------------------------------------------------------
   Чистый JS, без внешних библиотек (на странице нет CDN):
   · zipBuildStore(entries) — создаёт ZIP-архив (метод STORE, без
     сжатия — JSON уже компактный; открывается любым архиватором);
   · zipReadStore(bytes) — читает ZIP: методы 0 (store) и 8
     (deflate — собственный распаковщик RFC1951: stored/fixed/
     dynamic блоки), проверка CRC32;
   · crc32(bytes) — контрольная сумма.
   Используется страницей «Бэкапы БД»: каждая база — отдельный
   JSON-файл, при выборе 2+ баз файлы упаковываются в архив;
   восстановление читает .json и .zip.
   ============================================================ */
window.SP_ZIP = (function () {
  'use strict';

  /* ---------- CRC32 (IEEE, полином 0xEDB88320) ---------- */
  var CT = (function () {
    var t = new Uint32Array(256), n, c, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF, i;
    for (i = 0; i < b.length; i++) c = CT[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---------- Строки <-> байты (UTF-8) ---------- */
  function strToBytes(s) {
    if (typeof TextEncoder !== 'undefined') { try { return new TextEncoder().encode(s); } catch (e) {} }
    var u = unescape(encodeURIComponent(s)), b = new Uint8Array(u.length), i;
    for (i = 0; i < u.length; i++) b[i] = u.charCodeAt(i);
    return b;
  }
  function bytesToStr(b) {
    if (typeof TextDecoder !== 'undefined') { try { return new TextDecoder('utf-8').decode(b); } catch (e) {} }
    var s = '', i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    try { return decodeURIComponent(escape(s)); } catch (e2) { return s; }
  }

  /* ---------- DEFLATE распаковщик (RFC1951), по мотивам zlib puff ----------
     Bit-reader читает LSB-first; после любого чтения (≤13 бит за раз)
     остаток бит всегда лежит в одном последнем байте, поэтому переход
     на границу байта перед stored-блоком — простое обнуление. */
  var LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEN_EXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DIST_EXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function huffBuild(lengths) {
    var maxLen = 0, i, l;
    for (i = 0; i < lengths.length; i++) if (lengths[i] > maxLen) maxLen = lengths[i];
    var count = new Uint16Array(maxLen + 1), first = new Uint32Array(maxLen + 1), offs = new Uint16Array(maxLen + 2);
    for (i = 0; i < lengths.length; i++) if (lengths[i]) count[lengths[i]]++;
    for (l = 2; l <= maxLen; l++) first[l] = (first[l - 1] + count[l - 1]) << 1;
    for (l = 1; l <= maxLen; l++) offs[l + 1] = offs[l] + count[l];
    var symbols = new Uint16Array(lengths.length);
    for (i = 0; i < lengths.length; i++) { l = lengths[i]; if (l) symbols[offs[l]++] = i; }
    return { count: count, first: first, symbols: symbols, maxLen: maxLen };
  }
  var FIXED_LIT = null, FIXED_DIST = null;
  function fixedTrees() {
    if (!FIXED_LIT) {
      var lit = new Uint8Array(288), i;
      for (i = 0; i < 144; i++) lit[i] = 8;
      for (; i < 256; i++) lit[i] = 9;
      for (; i < 280; i++) lit[i] = 7;
      for (; i < 288; i++) lit[i] = 8;
      FIXED_LIT = huffBuild(lit);
      var dist = new Uint8Array(30);
      for (i = 0; i < 30; i++) dist[i] = 5;
      FIXED_DIST = huffBuild(dist);
    }
    return { lit: FIXED_LIT, dist: FIXED_DIST };
  }
  function inflate(input, outSize) {
    var pos = 0, bitbuf = 0, bitcnt = 0;
    var out = new Uint8Array(outSize > 0 ? outSize : 1), olen = 0;
    function bits(n) {
      while (bitcnt < n) {
        if (pos >= input.length) throw new Error('deflate: неожиданный конец данных');
        bitbuf |= input[pos++] << bitcnt; bitcnt += 8;
      }
      var v = bitbuf & ((1 << n) - 1);
      bitbuf >>>= n; bitcnt -= n;
      return v;
    }
    function decode(h) {
      var code = 0, first = 0, index = 0, l;
      for (l = 1; l <= h.maxLen; l++) {
        code |= bits(1);
        var c = h.count[l];
        if (code - h.first[l] < c) return h.symbols[index + (code - h.first[l])];
        index += c; first = (first + c) << 1; code <<= 1;
      }
      throw new Error('deflate: неверный код');
    }
    function pushByte(b) {
      if (olen >= out.length) { // страховка: вдруг размер в ZIP-заголовке занижен
        var n = new Uint8Array(out.length * 2 + 64); n.set(out); out = n;
      }
      out[olen++] = b;
    }
    function blockStored() {
      bitbuf = 0; bitcnt = 0; // выравнивание на байт
      if (pos + 4 > input.length) throw new Error('deflate: обрезанный stored-блок');
      var len = input[pos] | (input[pos + 1] << 8), nlen = input[pos + 2] | (input[pos + 3] << 8);
      pos += 4;
      if ((len ^ nlen) !== 0xFFFF) throw new Error('deflate: LEN/NLEN не совпадают');
      if (pos + len > input.length) throw new Error('deflate: обрезанные данные stored-блока');
      for (var i = 0; i < len; i++) pushByte(input[pos++]);
    }
    function dynamicTrees() {
      var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      if (hlit > 286 || hdist > 30) throw new Error('deflate: неверные HLIT/HDIST');
      var clLen = new Uint8Array(19), i;
      for (i = 0; i < hclen; i++) clLen[CL_ORDER[i]] = bits(3);
      var clH = huffBuild(clLen);
      var lens = new Uint8Array(hlit + hdist), n = 0;
      while (n < hlit + hdist) {
        var s = decode(clH);
        if (s < 16) lens[n++] = s;
        else if (s === 16) {
          if (!n) throw new Error('deflate: повтор без длины');
          var prev = lens[n - 1], rep = 3 + bits(2);
          while (rep-- && n < lens.length) lens[n++] = prev;
        } else if (s === 17) { var z1 = 3 + bits(3); while (z1-- && n < lens.length) lens[n++] = 0; }
        else if (s === 18) { var z2 = 11 + bits(7); while (z2-- && n < lens.length) lens[n++] = 0; }
        else throw new Error('deflate: неверный код длины');
      }
      if (n < hlit + hdist) throw new Error('deflate: мало кодов длин');
      var litLens = lens.slice(0, hlit), distLens = lens.slice(hlit);
      if (!distLens.length) distLens = [0];
      return { lit: huffBuild(litLens), dist: huffBuild(distLens) };
    }
    function blockCompressed(trees) {
      for (;;) {
        var s = decode(trees.lit);
        if (s < 256) { pushByte(s); continue; }
        if (s === 256) return; // конец блока
        s -= 257;
        if (s >= 29) throw new Error('deflate: неверный код длины 285+');
        var len = LEN_BASE[s] + bits(LEN_EXT[s]);
        var ds = decode(trees.dist);
        if (ds >= 30) throw new Error('deflate: неверный код расстояния');
        var dist = DIST_BASE[ds] + bits(DIST_EXT[ds]);
        if (dist > olen) throw new Error('deflate: расстояние за пределы вывода');
        for (var i = 0; i < len; i++) pushByte(out[olen - dist]); // перекрытие допустимо — побайтно
      }
    }
    var last;
    do {
      last = bits(1);
      var type = bits(2);
      if (type === 0) blockStored();
      else if (type === 1) blockCompressed(fixedTrees());
      else if (type === 2) blockCompressed(dynamicTrees());
      else throw new Error('deflate: неверный тип блока');
    } while (!last);
    return out.slice(0, olen);
  }

  /* ---------- DOS-время ---------- */
  function dosDT(d) {
    return {
      t: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31),
      d: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
  }

  /* ---------- Создание ZIP (STORE) ----------
     entries: [{name:'файл.json', bytes:Uint8Array, mtime:Date?}] → Uint8Array */
  function zipBuildStore(entries) {
    var chunks = [], central = [], off = 0;
    entries.forEach(function (e) {
      var nb = strToBytes(e.name), dt = dosDT(e.mtime || new Date()), crc = crc32(e.bytes), size = e.bytes.length;
      var h = new Uint8Array(30 + nb.length), hv = new DataView(h.buffer);
      hv.setUint32(0, 0x04034b50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 0x0800, true); // UTF-8
      hv.setUint16(8, 0, true); hv.setUint16(10, dt.t, true); hv.setUint16(12, dt.d, true);
      hv.setUint32(14, crc, true); hv.setUint32(18, size, true); hv.setUint32(22, size, true);
      hv.setUint16(26, nb.length, true); hv.setUint16(28, 0, true);
      h.set(nb, 30);
      chunks.push(h); chunks.push(e.bytes);
      var c = new Uint8Array(46 + nb.length), cv = new DataView(c.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true); cv.setUint16(12, dt.t, true); cv.setUint16(14, dt.d, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
      cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true);
      c.set(nb, 46);
      central.push(c);
      off += h.length + size;
    });
    var cdSize = 0;
    central.forEach(function (c) { cdSize += c.length; });
    var end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, off, true);
    var total = off + cdSize + 22, out = new Uint8Array(total), p = 0;
    chunks.forEach(function (ch) { out.set(ch, p); p += ch.length; });
    central.forEach(function (c) { out.set(c, p); p += c.length; });
    out.set(end, p);
    return out;
  }

  /* ---------- Чтение ZIP ----------
     bytes: Uint8Array → [{name, bytes}] ; методы 0 (store) и 8 (deflate).
     CRC32 каждого файла сверяется — битый архив не восстановится молча. */
  function zipReadStore(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = -1, i;
    for (i = bytes.length - 22; i >= 0 && i >= bytes.length - 65558; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Не ZIP-архив (нет центральной директории)');
    var n = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    var out = [], p = cdOff;
    for (var e = 0; e < n; e++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Повреждённая центральная директория ZIP');
      var method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true);
      var comp = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = bytesToStr(bytes.slice(p + 46, p + 46 + nl));
      if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error('Повреждённый локальный заголовок ZIP');
      var lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
      var dataOff = lho + 30 + lnl + lel, raw = bytes.slice(dataOff, dataOff + comp), data;
      if (method === 0) data = raw;
      else if (method === 8) data = inflate(raw, size);
      else throw new Error('Метод сжатия ' + method + ' не поддерживается — распакуйте архив в файлы .json');
      if (data.length !== size) throw new Error('Размер файла «' + name + '» не совпал — архив повреждён');
      if (crc32(data) !== crc) throw new Error('CRC файла «' + name + '» не сошёлся — архив повреждён');
      out.push({ name: name, bytes: data });
      p += 46 + nl + el + cl;
    }
    return out;
  }

  return { crc32: crc32, strToBytes: strToBytes, bytesToStr: bytesToStr, inflate: inflate, zipBuildStore: zipBuildStore, zipReadStore: zipReadStore };
})();
