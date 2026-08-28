/* ══════════════════════════════════════════════
   HAGE3D.JS — Bokstavhagen i tre dimensjonar

   Kvar bokstav er ei plante. Vekststeget ER boksen i den adaptive
   motoren, akkurat som i den flate hagen: det eleven ser er nøyaktig det
   motoren veit, og hagen visnar aldri.

   ── INGEN SPELMOTOR ──

   Hagen teiknar ~6 500 trekantar utan lys, skugge, texturar, animasjon
   eller fysikk. Det er hundre linjer WebGL. Å hente inn three.js for
   dette ville lagt 600 kB på ei skule-iPad for å sleppe å skrive dei
   hundre linjene — og dratt inn ES-modular og eit importmap i eit
   prosjekt som ikkje har noko byggjesteg.

   ── STILLBILETE, IKKJE EI LØKKE ──

   Det finst ingen requestAnimationFrame her. Hagen er eit bilete som
   blir teikna på nytt når noko faktisk endrar seg: sida opnar, vindauget
   skiftar storleik, eller eleven dreier på hagen. Ei iPad som ligg open
   på ein pult med hagen framme brukar då null batteri på han.

   ── HEILE HAGEN ER EIN BUFFER ──

   Plantene blir baka til verdskoordinatar på CPU-en når hagen blir bygd,
   og teikna med eitt einaste kall. Det er 29 planter; ei instansering
   ville vore meir kode og mindre kompatibel, og eitt kall er raskt nok
   med god margin.

   ── BOKSTAVANE ER DOM ──

   Namnelappane er ikkje teikna i lerretet. Dei er span-element som blir
   plasserte over det, så dei arvar lesefonten eleven har valt, blir med
   i tabrekkjefølgja og kan lesast av ein skjermlesar. Ein bokstav teikna
   i ein tekstur ville vore usynleg for alt det.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const ROT = 'hage/';
  const RUTE = 1.0;          // breidda på ei plantebed i verdseiningar
  const KOLONNAR = 6;

  let bib = null;            // { modellar, artar, palett, bokstavar }
  let geo = null;            // Int16Array over heile biblioteket
  let lastar = null;         // promise, så samtidige kall deler éi henting

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
      fetch(ROT + 'planter.json').then(function (r) {
        if (!r.ok) throw new Error('planter.json: ' + r.status);
        return r.json();
      }),
      fetch(ROT + 'planter.bin').then(function (r) {
        if (!r.ok) throw new Error('planter.bin: ' + r.status);
        return r.arrayBuffer();
      })
    ]).then(function (svar) {
      bib = svar[0];
      geo = new DataView(svar[1]);
      return bib;
    });
    return lastar;
  }

  /* ──────────────── Matriser ──────────────── */

  function multiplo(a, b) {
    const ut = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        ut[i * 4 + j] = s;
      }
    }
    return ut;
  }

  function perspektiv(fov, sideforhold, naer, fjern) {
    const f = 1 / Math.tan(fov / 2);
    const ut = new Float32Array(16);
    ut[0] = f / sideforhold; ut[5] = f;
    ut[10] = (fjern + naer) / (naer - fjern); ut[11] = -1;
    ut[14] = 2 * fjern * naer / (naer - fjern);
    return ut;
  }

  function sePaa(oye, maal, opp) {
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function kryss(a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }
    function norm(v) {
      const l = Math.hypot(v[0], v[1], v[2]) || 1e-9;
      return [v[0] / l, v[1] / l, v[2] / l];
    }
    function prikk(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    const z = norm(sub(oye, maal));
    const x = norm(kryss(opp, z));
    const y = kryss(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -prikk(x, oye), -prikk(y, oye), -prikk(z, oye), 1
    ]);
  }

  /* ──────────────── Plassering ──────────────── */

  /* Radene er forskyvne annakvar gong. Eit reint rutenett les som eit
     rekneark; ei forskyving gjer det same talet planter til eit bed. */
  function plass(i) {
    const rad = Math.floor(i / KOLONNAR);
    const kol = i % KOLONNAR;
    const radTal = Math.ceil(29 / KOLONNAR);
    const skift = (rad % 2) ? RUTE * 0.5 : 0;
    return {
      x: (kol - (KOLONNAR - 1) / 2) * RUTE + skift,
      z: (rad - (radTal - 1) / 2) * RUTE * 0.92
    };
  }

  /* Same bokstav skal stå likt kvar gong, på kvar maskin. Ein
     tilfeldig-generator med bokstaven som frø gjev variasjon utan å
     gjere hagen ustabil. */
  function stokk(ch) {
    let h = 2166136261;
    for (let i = 0; i < ch.length; i++) {
      h ^= ch.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
  }

  /* Kor stor planta står, som ein faktor på den storleiken ho har i
     Kenney-settet. Ho veks jamt frå spire til fullvaksen; steg 0 er
     berre jorda, og då er det ingen plante å skalere.

     Rampa startar på 45 % og ikkje på null: ei spire som er uendeleg
     lita er ikkje ei spire, ho er ingenting. */
  function skala(art, steg) {
    if (steg <= 0) return 0;
    return art.maks * (0.45 + 0.55 * ((steg - 1) / 4));
  }

  /* ──────────────── Bygging av geometrien ──────────────── */

  function leggModell(mod, ut, mx, my, mz, skala, vinkel, dimma) {
    const s = 1 / bib.skala;
    const cos = Math.cos(vinkel), sin = Math.sin(vinkel);
    const start = mod.start, tal = mod.tal;
    for (let i = 0; i < tal; i++) {
      const o = (start + i) * bib.steg;
      const px = geo.getInt16(o, true) * s;
      const py = geo.getInt16(o + 2, true) * s;
      const pz = geo.getInt16(o + 4, true) * s;
      const nx = geo.getInt8(o + 6) / 127;
      const ny = geo.getInt8(o + 7) / 127;
      const nz = geo.getInt8(o + 8) / 127;
      const pal = bib.palett[geo.getUint8(o + 9)] || [200, 200, 200];

      ut.pos.push(
        (px * cos - pz * sin) * skala + mx,
        py * skala + my,
        (px * sin + pz * cos) * skala + mz
      );
      ut.nor.push(nx * cos - nz * sin, ny, nx * sin + nz * cos);
      /* Ein bokstav som ikkje er opna enno står som ei tom seng. Vi
         dempar mot grått i staden for å gøyme han: eleven skal sjå at
         hagen har plass til fleire. */
      const d = dimma ? 0.45 : 1;
      const g = dimma ? 0.55 : 0;
      ut.far.push(
        (pal[0] / 255) * d + g, (pal[1] / 255) * d + g, (pal[2] / 255) * d + g
      );
    }
  }

  /* ── ØYA ──

     Ein firkant er ei flate; ei øy er ein stad. Forma blir rekna ut her
     og ikkje henta frå ein modell: ho må passe til talet bokstavar, og
     ein hage for eit anna alfabet skal ikkje krevje ein ny 3D-fil.

     Omrisset er ein ring med radius som svingar mjukt — tre sinusar med
     ulik periode. Det er nok til at kanten les som noko som har vorte
     til, og lite nok til at ho ikkje ser tilfeldig ut.

     Under toppflata går tre ringar nedover og innover: ei grasrand, ei
     jordside, og ei spiss underside. Øya flyt, så ho treng ein botn. */
  const SIDER = 44;

  function omkrins(vinkel, rx, rz) {
    const bulk = 1
      + 0.085 * Math.sin(vinkel * 3 + 0.7)
      + 0.055 * Math.sin(vinkel * 5 - 1.9)
      + 0.030 * Math.sin(vinkel * 8 + 2.6);
    return { x: Math.cos(vinkel) * rx * bulk, z: Math.sin(vinkel) * rz * bulk, bulk: bulk };
  }

  function trekant(ut, a, b, c, farge) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1e-9;
    nx /= nl; ny /= nl; nz /= nl;
    [a, b, c].forEach(function (p) {
      ut.pos.push(p[0], p[1], p[2]);
      ut.nor.push(nx, ny, nz);
      ut.far.push(farge[0], farge[1], farge[2]);
    });
  }

  /* Kenney sin eigen palett, henta ut av biblioteket, så øya og plantene
     er same verd. Fell tilbake på faste verdiar om eit materiale skulle
     forsvinne ut av settet. */
  function palettFarge(namn, reserve) {
    const i = bib && bib.palettNamn ? bib.palettNamn.indexOf(namn) : -1;
    const c = i >= 0 ? bib.palett[i] : reserve;
    return [c[0] / 255, c[1] / 255, c[2] / 255];
  }

  function oy(ut, rx, rz) {
    const gras = palettFarge('grass', [44, 216, 184]);
    const jord = palettFarge('dirt', [226, 131, 87]);
    const djup = palettFarge('dirtDark', [181, 104, 69]);

    /* Ringane: y, innskrenking, og farge på flata ned til neste. */
    const ringar = [
      { y: 0, k: 1.00, farge: jord },
      { y: -0.34, k: 0.97, farge: jord },
      { y: -1.05, k: 0.72, farge: djup },
      { y: -1.95, k: 0.30, farge: djup }
    ];

    for (let i = 0; i < SIDER; i++) {
      const v0 = i / SIDER * Math.PI * 2;
      const v1 = (i + 1) / SIDER * Math.PI * 2;
      const a0 = omkrins(v0, rx, rz);
      const a1 = omkrins(v1, rx, rz);

      /* Toppflata, som ei vifte frå midten. */
      trekant(ut, [0, 0, 0], [a1.x, 0, a1.z], [a0.x, 0, a0.z], gras);

      for (let r = 0; r < ringar.length - 1; r++) {
        const o = ringar[r], n = ringar[r + 1];
        const p00 = [a0.x * o.k, o.y, a0.z * o.k];
        const p10 = [a1.x * o.k, o.y, a1.z * o.k];
        const p01 = [a0.x * n.k, n.y, a0.z * n.k];
        const p11 = [a1.x * n.k, n.y, a1.z * n.k];
        trekant(ut, p00, p01, p11, o.farge);
        trekant(ut, p00, p11, p10, o.farge);
      }
      /* Spissen i botnen. */
      const s = ringar[ringar.length - 1];
      trekant(ut,
        [a0.x * s.k, s.y, a0.z * s.k],
        [0, s.y - 0.55, 0],
        [a1.x * s.k, s.y, a1.z * s.k], djup);
    }
  }

  /* ── PYNT ──

     Steinar, stubbar og gras mellom bedene og langs kanten. Dei står i
     eit fast mønster rekna ut frå eit frø, så hagen ser lik ut kvar gong
     utan at vi lagrar ei liste over kvar stein.

     Ingen av dei kjem nær eit bed. Ein stein oppå ei plante ville sett
     ut som ein feil, og eleven har ingen måte å flytte han på. */
  function pyntOya(ut, rx, rz) {
    if (!bib.pynt || !bib.pynt.length) return;
    const bedRadius = 0.42;
    const senter = [];
    for (let i = 0; i < LjodLetters.ALPHABET.length; i++) senter.push(plass(i));

    let fro = 20260828;
    function neste() {
      fro = (fro * 1103515245 + 12345) & 0x7fffffff;
      return fro / 0x7fffffff;
    }

    let sett = 0;
    for (let forsok = 0; forsok < 900 && sett < 34; forsok++) {
      const v = neste() * Math.PI * 2;
      /* Kvadratrota gjev jamn tettleik utover i staden for ein klump i
         midten — det er fordelinga av punkt i ein sirkel. */
      const r = Math.sqrt(neste());
      const kant = omkrins(v, rx, rz);
      const x = kant.x * r * 0.94;
      const z = kant.z * r * 0.94;

      let naerBed = false;
      for (let k = 0; k < senter.length; k++) {
        if (Math.hypot(x - senter[k].x, z - senter[k].z) < bedRadius) { naerBed = true; break; }
      }
      if (naerBed) continue;

      const namn = bib.pynt[Math.floor(neste() * bib.pynt.length) % bib.pynt.length];
      const mod = bib.modellar[namn];
      if (!mod) continue;
      /* Skalér mot ei MÅLHØGD og ikkje med ein rå faktor. Pynten er
         alt frå ei grastust på 14 cm til ein stubbe på 21, og ein felles
         faktor gjer den eine usynleg og den andre til eit møbel. Alt
         havnar mellom 10 og 22 cm, godt under den minste planta. */
      const maal = 0.10 + neste() * 0.12;
      /* Breidda tel med. Ein tømmerstokk er 17 cm høg og 71 brei; skalert
         berre etter høgda blir han ein planke tvers over hagen. */
      const sk = maal / Math.max(mod.hogd, mod.vidd * 0.5, 0.01);
      leggModell(mod, ut, x, 0, z, sk, neste() * Math.PI * 2, false);
      sett++;
    }
  }

  /**
   * @param profil frå LjodState
   * @returns { pos, nor, far, tal, beds: [{ch, x, z, hogd, steg, aktiv}] }
   */
  function byggHage(profil) {
    const a = profil.adaptive;
    const ut = { pos: [], nor: [], far: [], beds: [] };

    /* Øya er så stor som bedene treng og ein rute til. Ei stor tom flate
       rundt hagen ser ut som ein hage nokon har gjeve opp. */
    const radTal = Math.ceil(LjodLetters.ALPHABET.length / KOLONNAR);
    const rx = (KOLONNAR - 1) / 2 * RUTE + RUTE * 1.35;
    const rz = (radTal - 1) / 2 * RUTE * 0.92 + RUTE * 1.15;
    oy(ut, rx, rz);
    pyntOya(ut, rx, rz);

    LjodLetters.ALPHABET.forEach(function (ch, i) {
      const p = plass(i);
      const artId = bib.bokstavar[ch];
      const art = bib.artar.filter(function (x) { return x.id === artId; })[0];
      const it = a.items[ch];
      const steg = Math.max(0, Math.min(5, it ? it.maxBox : 0));
      const aktiv = LjodLetters.get(ch).step <= a.step;
      const r = stokk(ch);
      const vinkel = r * Math.PI * 2;
      /* Litt slark i storleiken, styrt av bokstaven sjølv. To naboar av
         same art skal ikkje stå som to kopiar. */
      const sk = skala(art, steg) * (0.92 + r * 0.16);

      /* Jorda ligg under kvar plante, ikkje berre under dei som ikkje
         har vakse enno: eit bed skal sjå ut som eit bed heile vegen. */
      leggModell(bib.modellar['crops_dirtSingle'], ut, p.x, 0, p.z, 1, vinkel, !aktiv);

      let toppen = bib.modellar['crops_dirtSingle'].hogd;
      if (steg > 0 && aktiv) {
        const mod = bib.modellar[art.steg[steg]];
        /* Fleire eksemplar i same bed. Éin blomsterstilk midt i eit bed
           ser ut som ein blome nokon gløymde; tre er ein plante. Dei
           står i ein liten ring, og den minste står midt i. */
        const tal = (art.klynge && art.klynge[steg]) || 1;
        for (let k = 0; k < tal; k++) {
          const midt = (tal === 1 || k === tal - 1);
          const vri = vinkel + k * (Math.PI * 2 / Math.max(tal, 1));
          const rad = midt ? 0 : 0.17 * (0.8 + r * 0.4);
          const eiga = sk * (midt ? 1 : 0.78 + (k % 2) * 0.1);
          leggModell(mod, ut,
            p.x + Math.cos(vri) * rad, toppen * 0.5, p.z + Math.sin(vri) * rad,
            eiga, vri, false);
        }
        toppen = toppen * 0.5 + mod.hogd * sk;
      }

      ut.beds.push({
        ch: ch, x: p.x, z: p.z, hogd: toppen,
        steg: steg, aktiv: aktiv, art: art
      });
    });

    ut.tal = ut.pos.length / 3;
    return ut;
  }

  /* ──────────────── WebGL ──────────────── */

  const VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNor;',
    'attribute vec3 aFar;',
    'uniform mat4 uMvp;',
    'varying vec3 vNor;',
    'varying vec3 vFar;',
    'void main() {',
    '  vNor = aNor;',
    '  vFar = aFar;',
    '  gl_Position = uMvp * vec4(aPos, 1.0);',
    '}'
  ].join('\n');

  /* To lys og eit botnlys. Eit einaste retningslys gjer undersida av
     kvar plante heilt svart, og då ser ein hage med små planter ut som
     ein hage full av hòl. */
  const FS = [
    'precision mediump float;',
    'varying vec3 vNor;',
    'varying vec3 vFar;',
    'void main() {',
    '  vec3 n = normalize(vNor);',
    '  float hovud = max(dot(n, normalize(vec3(-0.42, 0.86, 0.30))), 0.0);',
    '  float fyll  = max(dot(n, normalize(vec3(0.55, 0.25, -0.60))), 0.0);',
    '  float lys = 0.52 + 0.42 * hovud + 0.14 * fyll;',
    '  gl_FragColor = vec4(vFar * lys, 1.0);',
    '}'
  ].join('\n');

  function lagShader(gl, type, kjelde) {
    const s = gl.createShader(type);
    gl.shaderSource(s, kjelde);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function lagProgram(gl) {
    const p = gl.createProgram();
    gl.attachShader(p, lagShader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, lagShader(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  /* ──────────────── Visninga ──────────────── */

  function lag(vert, profil) {
    const canvas = document.createElement('canvas');
    canvas.className = 'ljod-hage3d-lerret';
    /* Lerretet er pynt; innhaldet ligg i lappane under, som har tekst. */
    canvas.setAttribute('aria-hidden', 'true');
    const lapper = document.createElement('div');
    lapper.className = 'ljod-hage3d-lapper';

    vert.appendChild(canvas);
    vert.appendChild(lapper);

    const gl = canvas.getContext('webgl', { antialias: true, alpha: true })
      || canvas.getContext('experimental-webgl', { antialias: true, alpha: true });
    if (!gl) throw new Error('ingen webgl-kontekst');

    const prog = lagProgram(gl);
    const buf = {
      pos: gl.createBuffer(), nor: gl.createBuffer(), far: gl.createBuffer()
    };
    const stad = {
      pos: gl.getAttribLocation(prog, 'aPos'),
      nor: gl.getAttribLocation(prog, 'aNor'),
      far: gl.getAttribLocation(prog, 'aFar'),
      mvp: gl.getUniformLocation(prog, 'uMvp')
    };

    gl.enable(gl.DEPTH_TEST);
    /* INGA BAKSIDEKUTTING. Fleire av Kenney-plantene — grasstrå, blad,
       kronblad — er einsidige flater. Med kutting forsvinn dei når ein
       dreier hagen forbi dei, og bakken forsvinn heilt. 6 500 trekantar
       er for lite til at kuttinga er verdt den feilen. */
    gl.disable(gl.CULL_FACE);

    let hage = byggHage(profil);
    let dreiing = -0.42;
    let mvp = null;

    function lastOpp() {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hage.pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hage.nor), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.far);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hage.far), gl.STATIC_DRAW);
    }
    lastOpp();

    function teikn() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const b = vert.clientWidth || 640;
      const h = Math.max(260, Math.round(b * 0.52));
      canvas.style.height = h + 'px';
      canvas.width = Math.round(b * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* Kameraet står så langt ute at heile hagen får plass, og litt
         lenger ute på ein smal skjerm. Ei fast avstand som fungerer på
         ein PC klipper dei ytste bedene på ein telefon. */
      const smal = Math.min(1, (b / h) / 1.9);
      const avstand = 8.6 + (1 - smal) * 5.2;
      const hogde = 4.6 + (1 - smal) * 2.0;
      const oye = [Math.sin(dreiing) * avstand, hogde, Math.cos(dreiing) * avstand];
      const P = perspektiv(0.62, b / h, 0.5, 40);
      const V = sePaa(oye, [0, 0.5, 0], [0, 1, 0]);
      mvp = multiplo(P, V);

      gl.useProgram(prog);
      gl.uniformMatrix4fv(stad.mvp, false, mvp);
      [['pos', 3], ['nor', 3], ['far', 3]].forEach(function (d) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf[d[0]]);
        gl.enableVertexAttribArray(stad[d[0]]);
        gl.vertexAttribPointer(stad[d[0]], d[1], gl.FLOAT, false, 0, 0);
      });
      gl.drawArrays(gl.TRIANGLES, 0, hage.tal);

      plasserLapper(b, h);
    }

    /* Lappane blir projiserte med same matrise som geometrien, så dei
       følgjer plantene når hagen blir dreidd. */
    function plasserLapper(b, h) {
      hage.beds.forEach(function (bed, i) {
        const el = lapper.children[i];
        if (!el) return;
        /* Lappen står ved ROTA, ikkje over toppen. Over toppen låg han i
           vegen for planta han skulle namngje — og han flytta seg
           oppover kvar gong planta voks, så auget måtte leite etter han
           på nytt. Ved rota står han i ro.

           Han blir skoven eit lite steg mot kameraet, så han ikkje
           forsvinn inn i stilken. Retninga følgjer dreiinga. */
        const mot = 0.34;
        const x = bed.x + Math.sin(dreiing) * mot;
        const y = 0.10;
        const z = bed.z + Math.cos(dreiing) * mot;
        const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
        const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
        const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
        if (cw <= 0) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = '';
        el.style.left = ((cx / cw * 0.5 + 0.5) * b) + 'px';
        el.style.top = ((-cy / cw * 0.5 + 0.5) * h) + 'px';
      });
    }

    function byggLapper() {
      lapper.innerHTML = '';
      hage.beds.forEach(function (bed) {
        const el = document.createElement('span');
        el.className = 'ljod-hage3d-lapp' + (bed.aktiv ? '' : ' is-locked');
        el.textContent = bed.ch;
        const stegnamn = bed.art.stegnamn[bed.steg];
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', bed.aktiv
          ? ('Bokstaven ' + bed.ch.toUpperCase() + ': ' + bed.art.namn.toLowerCase() +
             ', ' + stegnamn)
          : ('Bokstaven ' + bed.ch.toUpperCase() + ': ikkje opna enno'));
        el.title = bed.ch.toUpperCase() + ' — ' +
          (bed.aktiv ? bed.art.namn + ', ' + stegnamn : 'ikkje opna enno');
        lapper.appendChild(el);
      });
    }
    byggLapper();

    /* ── Dreiing ──
       Berre vassrett, og berre så mykje at ein kan sjå bak dei fremste
       plantene. Fri bane i alle retningar er lett å miste seg i og
       vanskeleg å komme tilbake frå. */
    let drar = false, sisteX = 0;
    canvas.style.touchAction = 'pan-y';

    canvas.addEventListener('pointerdown', function (e) {
      drar = true; sisteX = e.clientX;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drar) return;
      dreiing += (e.clientX - sisteX) * 0.008;
      dreiing = Math.max(-1.15, Math.min(0.31, dreiing));
      sisteX = e.clientX;
      teikn();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
      canvas.addEventListener(n, function () { drar = false; });
    });

    let tidsavbrot = null;
    function paaStorleik() {
      clearTimeout(tidsavbrot);
      tidsavbrot = setTimeout(teikn, 120);
    }
    root.addEventListener('resize', paaStorleik);

    teikn();

    return {
      element: vert,
      teikn: teikn,
      oppdater: function (nyProfil) {
        hage = byggHage(nyProfil);
        lastOpp();
        byggLapper();
        teikn();
      },
      riv: function () {
        root.removeEventListener('resize', paaStorleik);
        clearTimeout(tidsavbrot);
        const utvid = gl.getExtension('WEBGL_lose_context');
        if (utvid) utvid.loseContext();
      }
    };
  }

  root.LjodHage3D = {
    stott: stott, last: last, lag: lag,
    byggHage: byggHage, plass: plass, skala: skala
  };
})(window);
