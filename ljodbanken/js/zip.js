/* ══════════════════════════════════════════════
   ZIP.JS — Les og skriv zip-filer

   Vi skriv med metode 0 («store»), altså heilt utan komprimering. Det
   er ikkje latskap: eit ferdig mp3-klipp er alt pakka, og deflate ville
   brukt tid på å gjere det ein halv prosent mindre. WAV kunne krympa
   noko, men då måtte vi hatt ein deflate-implementasjon i tillegg — og
   ein ny avhengnad for eit verktøy som skal vere lett.

   Filnamna kan innehalde æ, ø og å (`f_å.mp3`), så vi set flagg 11 og
   skriv namna som UTF-8. Utan det flagget les Windows dei som cp437 og
   du får `f_Ã¥.mp3` ut att.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.zip = (function () {
  'use strict';

  /* ──────────────── CRC-32 ──────────────── */

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* Zip arva klokkeformatet frå MS-DOS: dato og tid ligg i kvar sin
     16-bitar, og sekunda har berre annakvart tal. Årstalet tel frå 1980. */
  function dosDateTime(date) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2));
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time: time & 0xFFFF, date: day & 0xFFFF };
  }

  function utf8(text) {
    return new TextEncoder().encode(text);
  }

  /* ──────────────── Skriving ──────────────── */

  /**
   * @param {Array<{name: string, bytes: Uint8Array}>} files
   * @returns {Blob}
   */
  function create(files) {
    const stamp = dosDateTime(new Date());
    const parts = [];        // det som blir sjølve fila
    const central = [];      // katalogen til slutt
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = utf8(file.name);
      const bytes = file.bytes;
      const sum = crc32(bytes);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);   // signatur
      local.setUint16(4, 20, true);           // trengst versjon 2.0
      local.setUint16(6, 0x0800, true);       // flagg 11: namnet er UTF-8
      local.setUint16(8, 0, true);            // metode 0 = ingen komprimering
      local.setUint16(10, stamp.time, true);
      local.setUint16(12, stamp.date, true);
      local.setUint32(14, sum, true);
      local.setUint32(18, bytes.length, true);
      local.setUint32(22, bytes.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);           // ingen ekstrafelt

      parts.push(local.buffer, nameBytes, bytes);

      const dir = new DataView(new ArrayBuffer(46));
      dir.setUint32(0, 0x02014b50, true);
      dir.setUint16(4, 20, true);             // skriven av versjon 2.0
      dir.setUint16(6, 20, true);
      dir.setUint16(8, 0x0800, true);
      dir.setUint16(10, 0, true);
      dir.setUint16(12, stamp.time, true);
      dir.setUint16(14, stamp.date, true);
      dir.setUint32(16, sum, true);
      dir.setUint32(20, bytes.length, true);
      dir.setUint32(24, bytes.length, true);
      dir.setUint16(28, nameBytes.length, true);
      dir.setUint32(42, offset, true);        // kvar den lokale headeren står
      central.push(dir.buffer, nameBytes);

      offset += 30 + nameBytes.length + bytes.length;
    });

    let centralSize = 0;
    central.forEach(p => { centralSize += p.byteLength; });

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }

  /* ──────────────── Lesing ──────────────── */

  /* Katalogen ligg bakerst, og bak han igjen ein sluttblokk vi må finne
     ved å leite bakover. Han er 22 byte, men kan ha ein kommentar på inntil
     65 535 byte etter seg — difor leitar vi i heile den siste bolken. */
  function findEnd(view) {
    const from = Math.max(0, view.byteLength - (22 + 0xFFFF));
    for (let i = view.byteLength - 22; i >= from; i--) {
      if (view.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
  }

  function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Nettlesaren din kan ikkje pakke ut denne zip-fila.'));
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(ab => new Uint8Array(ab));
  }

  /**
   * @param {ArrayBuffer} buffer
   * @returns {Promise<Array<{name: string, bytes: Uint8Array}>>}
   */
  function read(buffer) {
    const view = new DataView(buffer);
    const all = new Uint8Array(buffer);
    const endAt = findEnd(view);
    if (endAt < 0) return Promise.reject(new Error('Dette ser ikkje ut som ei zip-fil.'));

    const count = view.getUint16(endAt + 10, true);
    let at = view.getUint32(endAt + 16, true);
    const jobs = [];

    for (let i = 0; i < count; i++) {
      if (view.getUint32(at, true) !== 0x02014b50) break;
      const method = view.getUint16(at + 10, true);
      const compressed = view.getUint32(at + 20, true);
      const nameLen = view.getUint16(at + 28, true);
      const extraLen = view.getUint16(at + 30, true);
      const commentLen = view.getUint16(at + 32, true);
      const localAt = view.getUint32(at + 42, true);
      const name = new TextDecoder().decode(all.subarray(at + 46, at + 46 + nameLen));
      at += 46 + nameLen + extraLen + commentLen;

      if (name.endsWith('/')) continue;   // mapper har ingen data

      /* Namnet og ekstrafelta i den lokale headeren kan ha andre lengder
         enn i katalogen, så dataa må finnast ut frå han — ikkje frå det
         vi nettopp las. */
      const localNameLen = view.getUint16(localAt + 26, true);
      const localExtraLen = view.getUint16(localAt + 28, true);
      const dataAt = localAt + 30 + localNameLen + localExtraLen;
      const raw = all.subarray(dataAt, dataAt + compressed);

      if (method === 0) {
        jobs.push(Promise.resolve({ name: name, bytes: raw }));
      } else if (method === 8) {
        jobs.push(inflateRaw(raw).then(bytes => ({ name: name, bytes: bytes })));
      } else {
        return Promise.reject(new Error('Zip-fila brukar ei komprimering vi ikkje kjenner.'));
      }
    }

    return Promise.all(jobs);
  }

  return { create, read, crc32 };
})();
