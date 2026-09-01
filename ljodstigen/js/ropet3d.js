/* ══════════════════════════════════════════════
   ROPET3D.JS — leirplassen, og figuren som går rundt i han

   Teiknar Bokstavropet i 3D: ei lita øy med telt, bål og tre, og ein
   figur eleven styrer.

   ── SKJELETTET HAR SJU LEDD ──

   Det er heile grunnen til at dette går utan eit bibliotek. Figuren frå
   Kenney har root, to bein, ein torso, to armar og eit hovud. Sju
   leddmatriser per bilete er ei løkke på sju; shaderen slår opp fire av
   dei per hjørne og blandar. three.js gjer det same, og gjer det betre,
   men det er 600 kB på ei skule-iPad for ei løkke på sju.

   ── HER KØYRER DET EI LØKKE ──

   Til skilnad frå skogen. Ein figur som går må teiknast om att seksti
   gonger i sekundet, og då er requestAnimationFrame rett verktøy. Løkka
   stoppar når fana blir gøymd, og når spelet blir rive.

   ── KAMERAET SNUR SEG IKKJE ──

   Det står fast bak leiren og følgjer figuren. Ein seksåring som skal
   finne eit telt skal ikkje samtidig halde styr på kva veg han ser: opp
   er bort frå deg, ned er mot deg, kvar gong.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Figuren, skjelettet og matrisene bur i figur3d.js — han er delt med
     skogen. Her ligg berre leirplassen. */
  const F = root.Figur3D;

  const ROT = 'ropet/';

  let bib = null;      // leir.json
  let bin = null;      // DataView over leir.bin
  let lastar = null;

  /* ──────────────── Lasting ──────────────── */

  function stott() {
    if (!root.WebGLRenderingContext) return false;
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  function last() {
    if (lastar) return lastar;
    lastar = Promise.all([
      fetch(ROT + 'leir.json').then(function (r) {
        if (!r.ok) throw new Error('leir.json: ' + r.status);
        return r.json();
      }),
      fetch(ROT + 'leir.bin').then(function (r) {
        if (!r.ok) throw new Error('leir.bin: ' + r.status);
        return r.arrayBuffer();
      })
      ,
      F.last()
    ]).then(function (svar) {
      bib = svar[0];
      bin = new DataView(svar[1]);
      return bib;
    });
    return lastar;
  }

  /* ──────────────── Geometri ut av fila ──────────────── */

  /** Statisk modell, plassert i verda. Bakar inn plasseringa. */
  function leggStatisk(namn, ut, x, y, z, vinkel, skala) {
    const mod = bib.modellar[namn];
    if (!mod) return;
    const s = 1 / bib.skala;
    const c = Math.cos(vinkel), si = Math.sin(vinkel);
    for (let i = 0; i < mod.tal; i++) {
      const o = (mod.start + i) * bib.stegStatisk;
      const px = bin.getInt16(o, true) * s;
      const py = bin.getInt16(o + 2, true) * s;
      const pz = bin.getInt16(o + 4, true) * s;
      const nx = bin.getInt8(o + 6) / 127;
      const ny = bin.getInt8(o + 7) / 127;
      const nz = bin.getInt8(o + 8) / 127;
      ut.pos.push((px * c - pz * si) * skala + x, py * skala + y, (px * si + pz * c) * skala + z);
      ut.nor.push(nx * c - nz * si, ny, nx * si + nz * c);
      ut.far.push(bin.getUint8(o + 9) / 255, bin.getUint8(o + 10) / 255, bin.getUint8(o + 11) / 255);
    }
  }

  /* ──────────────── Leirplassen ──────────────── */

  const OY_R = 5.6;
  const SIDER = 40;

  function omkrins(v) {
    const bulk = 1 + 0.07 * Math.sin(v * 3 + 0.5) + 0.045 * Math.sin(v * 5 - 1.4);
    return { x: Math.cos(v) * OY_R * bulk, z: Math.sin(v) * OY_R * bulk };
  }

  function trekant(ut, a, b, c, farge) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1e-9;
    [a, b, c].forEach(function (p) {
      ut.pos.push(p[0], p[1], p[2]);
      ut.nor.push(nx / nl, ny / nl, nz / nl);
      ut.far.push(farge[0], farge[1], farge[2]);
    });
  }

  function oy(ut) {
    const gras = [0.17, 0.85, 0.72];
    const jord = [0.89, 0.51, 0.34];
    const djup = [0.71, 0.41, 0.27];
    const ringar = [
      { y: 0, k: 1.00, farge: jord },
      { y: -0.36, k: 0.96, farge: jord },
      { y: -1.20, k: 0.66, farge: djup }
    ];
    for (let i = 0; i < SIDER; i++) {
      const a0 = omkrins(i / SIDER * Math.PI * 2);
      const a1 = omkrins((i + 1) / SIDER * Math.PI * 2);
      trekant(ut, [0, 0, 0], [a1.x, 0, a1.z], [a0.x, 0, a0.z], gras);
      for (let r = 0; r < ringar.length - 1; r++) {
        const o = ringar[r], n = ringar[r + 1];
        trekant(ut, [a0.x * o.k, o.y, a0.z * o.k], [a0.x * n.k, n.y, a0.z * n.k],
                [a1.x * n.k, n.y, a1.z * n.k], o.farge);
        trekant(ut, [a0.x * o.k, o.y, a0.z * o.k], [a1.x * n.k, n.y, a1.z * n.k],
                [a1.x * o.k, o.y, a1.z * o.k], o.farge);
      }
      const s = ringar[ringar.length - 1];
      trekant(ut, [a0.x * s.k, s.y, a0.z * s.k], [0, s.y - 0.7, 0],
              [a1.x * s.k, s.y, a1.z * s.k], djup);
    }
  }

  /* ── TELTA STÅR I EIN RING RUNDT BÅLET ──

     Ikkje i ein boge framfor eleven: ein ring gjer at ingen telt er
     «det første», og at avstanden frå bålet til kvart av dei er den
     same. Med to telt blir ringen ein boge av seg sjølv.

     Ringen veks med talet telt, så to som står ved sida av kvarandre
     alltid har same avstand. To telt som står tett er to telt eleven kan
     komme borti på ein gong, og då er valet hans ikkje eit val.

     Og dei vender inn mot bålet. Ein leirplass der telta snur ryggen
     til elden er ikkje ein leirplass. */
  const BAAL = { x: 0, z: 1.5 };
  const TELT_AVSTAND = 1.85;     // minste avstand mellom to teltmidtar

  function teltplassar(tal) {
    const ut = [];
    /* Radius slik at nabotelt får minst TELT_AVSTAND mellom seg, men
       aldri så stor at telta hamnar utanfor øya. */
    const spenn = Math.min(Math.PI * 1.45, 0.62 * tal + 0.5);
    const bogeSteg = tal > 1 ? spenn / (tal - 1) : 0;
    const r = Math.max(2.9, Math.min(OY_R * 0.62,
      bogeSteg > 0 ? TELT_AVSTAND / (2 * Math.sin(bogeSteg / 2)) : 2.9));

    for (let i = 0; i < tal; i++) {
      const v = -Math.PI / 2 + (tal === 1 ? 0 : (i / (tal - 1) - 0.5) * spenn);
      const x = BAAL.x + Math.cos(v) * r;
      const z = BAAL.z + Math.sin(v) * r;
      /* SNU OPNINGA MOT BÅLET.

         Målt og ikkje gjetta: teiknar ein det same teltet ved 0, 90, 180
         og 270 grader og ser rett på dei, er det 180 som vender opninga
         mot kameraet. Kameraet står på +z, så opninga ligg på -z i
         modellen når vinkelen er null.

         leggStatisk roterer slik at eit punkt (0, -1) hamnar på
         (sin v, -cos v). Skal det peike i retning (dx, dz), må
         sin v = dx og cos v = -dz — altså atan2(dx, -dz).

         Dei to første utgåvene la på ein halv og ein kvart omdreiing på
         atan2(dx, dz). Det er ei SPEGLING og ikkje ei dreiing: han
         traff for telt rett nord for bålet og bomma meir og meir dess
         lenger ut til sida dei stod. */
      ut.push({ x: x, z: z, vinkel: Math.atan2(BAAL.x - x, -(BAAL.z - z)) });
    }
    return ut;
  }

  /* Alt som ikkje er telt: bål, kubbar, tre langs kanten, litt gras.
     Faste plassar frå eit frø, så leiren ser lik ut kvar gong.

     Dei store tinga blir samtidig lagde i ei liste over HINDRINGAR med
     ein radius kvar. Ein figur som glir tvers gjennom eit tre gjer
     leiren til ein kulisse; ein som må gå rundt gjer han til ein stad.
     Graset og blomane står ikkje i lista — å bli stoppa av ei grastust
     er verre enn å gå gjennom henne. */
  function pynt(ut) {
    let fro = 90210;
    function neste() {
      fro = (fro * 1103515245 + 12345) & 0x7fffffff;
      return fro / 0x7fffffff;
    }
    ut.hindringar = ut.hindringar || [];
    function stopp(x, z, r) { ut.hindringar.push({ x: x, z: z, r: r }); }

    /* MIDTEN ER BERRE BÅLET. Alt anna som stod inne mellom telta var
       noko eleven måtte gå rundt for å komme fram, og vegen til teltet
       er ikkje der oppgåva ligg. Kubbane er flytta ut utanfor teltringen
       — dei ser framleis ut som ein leirplass, men dei står ikkje i
       vegen for nokon. */
    leggStatisk('campfire_stones', ut, BAAL.x, 0, BAAL.z, 0, 1.0);
    leggStatisk('campfire_logs', ut, BAAL.x, 0.02, BAAL.z, 0.6, 1.0);
    stopp(BAAL.x, BAAL.z, 0.52);

    const utanfor = [
      { namn: 'log', v: 2.35, r: 4.5, vri: 0.4 },
      { namn: 'log_stack', v: 0.75, r: 4.6, vri: -0.3 },
      { namn: 'log', v: -2.1, r: 4.4, vri: 1.1 }
    ];
    utanfor.forEach(function (k) {
      const x = BAAL.x + Math.cos(k.v) * k.r;
      const z = BAAL.z + Math.sin(k.v) * k.r;
      leggStatisk(k.namn, ut, x, 0, z, k.vri, 1.0);
      stopp(x, z, 0.42);
    });

    const kant = ['tree_pineDefaultA', 'tree_default', 'tree_small'];
    for (let i = 0; i < 12; i++) {
      const v = (i / 12) * Math.PI * 2 + 0.2;
      const k = omkrins(v);
      const r = 0.86 + neste() * 0.08;
      const sk = 0.5 + neste() * 0.25;
      leggStatisk(kant[i % kant.length], ut, k.x * r, 0, k.z * r,
                  neste() * Math.PI * 2, sk);
      /* Stammen, ikkje krona: eit tre skal stoppe deg der han står i
         bakken, ikkje ein halv meter før. */
      stopp(k.x * r, k.z * r, 0.30 * sk + 0.18);
    }
    /* Gras og blomar berre UTANFOR teltringen. Inne på plassen skal det
       vere fri veg til kvart telt; ein blome ein må gå rundt er ein
       blome for mykje. Steinar er heilt ute — dei var det einaste her som
       stoppa nokon. */
    const smaatt = ['plant_bush', 'grass', 'grass_large', 'flower_redA',
                    'flower_yellowA', 'mushroom_red'];
    for (let i = 0; i < 22; i++) {
      const v = neste() * Math.PI * 2;
      const k = omkrins(v);
      const r = 0.62 + neste() * 0.22;
      const x = k.x * r, z = k.z * r;
      if (Math.hypot(x - BAAL.x, z - BAAL.z) < 4.0) continue;   // ikkje inne på plassen
      leggStatisk(smaatt[Math.floor(neste() * smaatt.length) % smaatt.length],
                  ut, x, 0, z, neste() * Math.PI * 2, 0.6 + neste() * 0.5);
    }
  }

  root.RopetVerd = {
    stott: stott, last: last,
    /* Vidaresendt frå figur3d.js, så leirplassen slepp å vite at han
       ligg der. Skulle han flytte, er det denne lista som endrar seg. */
    ident: F.ident, gonge: F.gonge, perspektiv: F.perspektiv, sePaa: F.sePaa,
    plassering: F.plassering, leddmatriser: F.leddmatriser,
    figurBuffer: F.buffer, lagProgram: F.lagProgram, FIGUR_VS: F.VS,
    leggStatisk: leggStatisk,
    oy: oy, pynt: pynt, teltplassar: teltplassar, omkrins: omkrins,
    BAAL: BAAL, TELT_AVSTAND: TELT_AVSTAND,
    VS: F.STATISK_VS, FS: F.FS,
    OY_R: OY_R,
    bib: function () { return bib; }
  };
})(window);
