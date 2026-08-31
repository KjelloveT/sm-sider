/* ══════════════════════════════════════════════
   SKOG3D.JS — Bokstavskogen i tre dimensjonar

   Kvar bokstav er ei plante. Vekststeget ER boksen i den adaptive
   motoren, akkurat som i den flate skogen: det eleven ser er nøyaktig det
   motoren veit, og skogen visnar aldri.

   ── INGEN SPELMOTOR ──

   Skogen teiknar ~6 500 trekantar utan lys, skugge, texturar, animasjon
   eller fysikk. Det er hundre linjer WebGL. Å hente inn three.js for
   dette ville lagt 600 kB på ei skule-iPad for å sleppe å skrive dei
   hundre linjene — og dratt inn ES-modular og eit importmap i eit
   prosjekt som ikkje har noko byggjesteg.

   ── STILLBILETE, IKKJE EI LØKKE ──

   Det finst ingen requestAnimationFrame her. Skogen er eit bilete som
   blir teikna på nytt når noko faktisk endrar seg: sida opnar, vindauget
   skiftar storleik, eller eleven dreier på skogen. Ei iPad som ligg open
   på ein pult med skogen framme brukar då null batteri på han.

   ── HEILE HAGEN ER EIN BUFFER ──

   Plantene blir baka til verdskoordinatar på CPU-en når skogen blir bygd,
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

  const ROT = 'skog/';
  const RUTE = 1.5;          // breidda på ei rute i verdseiningar
  const BED = 1.85;          // jordflisa, som faktor på naturleg storleik
  const BED_FLAT = 0.30;     // og kor flat ho blir trykt i høgda
  const SKILT_MOT = 0.58;    // kor langt framfor treet skiltet står
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

  /* ── TREA STÅR TILFELDIG ──

     Eit rutenett med forskyvne rader var eit kompromiss, og det såg ut
     som eit kompromiss: dei fem første bokstavane stod på snorrett rekkje
     framme, og resten låg spreidde. Halvt rutenett og halvt tilfeldig les
     som ein feil.

     No er alle tilfeldige. Plasseringa blir rekna ut frå eit fast frø, så
     skogen ser lik ut kvar gong og på kvar maskin — eleven skal finne
     att si eiga rute — men han ser ikkje planlagd ut.

     Avvisingsmetoden: trekk eit punkt, forkast det om det er for nær eit
     tre som alt står. Det er den enkle måten å få jamn spreiing utan
     klumpar, og med tjueni punkt er han rask nok til at ingen merkar
     han. Kravet blir mjukna opp om det ikkje går: betre eit par tre som
     står tett enn ein bokstav som ikkje fekk plass. */
  let plassar = null;

  function byggPlassar(rx, rz) {
    const n = LjodLetters.ALPHABET.length;
    let fro = 4711;
    function neste() {
      fro = (fro * 1103515245 + 12345) & 0x7fffffff;
      return fro / 0x7fffffff;
    }
    const ut = [];
    let krav = RUTE * 0.98;
    for (let forsok = 0; ut.length < n && forsok < 40000; forsok++) {
      /* Kvadratrota gjev jamn tettleik utover i staden for ein klump i
         midten — det er fordelinga av punkt i ein sirkel. */
      const v = neste() * Math.PI * 2;
      const r = Math.sqrt(neste());
      const kant = omkrins(v, rx, rz);
      const x = kant.x * r * 0.80;
      /* Bakre femtedel er reservert til dei store steinane. */
      const z = kant.z * r * 0.80;
      if (z < -rz * 0.40) continue;

      let for_naer = false;
      for (let k = 0; k < ut.length; k++) {
        if (Math.hypot(x - ut[k].x, z - ut[k].z) < krav) { for_naer = true; break; }
      }
      if (for_naer) {
        if (forsok % 2000 === 1999) krav *= 0.92;
        continue;
      }
      ut.push({ x: x, z: z });
    }
    return ut;
  }

  function plass(i) {
    return plassar[i] || { x: 0, z: 0 };
  }

  /* Same bokstav skal stå likt kvar gong, på kvar maskin. Ein
     tilfeldig-generator med bokstaven som frø gjev variasjon utan å
     gjere skogen ustabil. */
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

  function leggModell(mod, ut, mx, my, mz, skala, vinkel, dimma, yskala) {
    const s = 1 / bib.skala;
    const sy = (yskala === undefined ? 1 : yskala) * skala;
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
        py * sy + my,
        (px * sin + pz * cos) * skala + mz
      );
      ut.nor.push(nx * cos - nz * sin, ny, nx * sin + nz * cos);
      /* Ein bokstav som ikkje er opna enno står som ei tom seng. Vi
         dempar mot grått i staden for å gøyme han: eleven skal sjå at
         skogen har plass til fleire. */
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
     ein skog for eit anna alfabet skal ikkje krevje ein ny 3D-fil.

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

  /* Store steinar langs bakkanten. Dei står bak det siste treet, der dei
     ikkje kan kome i vegen for nokon bokstav, og gjev skogen ein
     horisont: utan dei sluttar han berre. Dette er det einaste pyntet
     som er att — småstein, stubbar og grastuster mellom trea vart berre
     rot når trea vart tre gonger så store. */
  function storsteinar(ut, rx, rz) {
    if (!bib.store || !bib.store.length) return;
    const bak = -rz * 0.60;
    const tal = 7;
    for (let i = 0; i < tal; i++) {
      const t = (i + 0.5) / tal;
      const namn = bib.store[i % bib.store.length];
      const mod = bib.modellar[namn];
      if (!mod) continue;
      /* Litt slark i djupna, elles står dei på ei snorrett line. */
      const bolge = Math.sin(i * 2.1) * 0.34;
      const x = (t - 0.5) * 2 * rx * 0.58;
      const z = bak + bolge;
      /* Godt innanfor kanten. Ein stein som heng ut over rimen ser ut
         som ein feil i øya og ikkje som ein stein — og «rock_large*» er
         grastopa, så halvparten av han blir ei grasflate i lause lufta. */
      const kant = omkrins(Math.atan2(z, x), rx, rz);
      const naa = Math.hypot(x, z), maks = Math.hypot(kant.x, kant.z) * 0.74;
      if (naa > maks) continue;
      /* Breidda tel med. stone_largeA er 26 cm høg og 120 brei; skalert
         etter høgda åleine blei han ein kampestein på to og ein halv
         meter tvers over halve skogen. */
      const maal = 0.60 + ((i * 7) % 5) * 0.16;
      leggModell(mod, ut, x, -0.03, z,
        maal / Math.max(mod.hogd, mod.vidd * 0.42, 0.01), i * 1.7, false);
    }
  }

  /**
   * @param profil frå LjodState
   * @returns { pos, nor, far, tal, beds: [{ch, x, z, hogd, steg, aktiv}] }
   */
  function byggSkog(profil) {
    const a = profil.adaptive;
    const ut = { pos: [], nor: [], far: [], beds: [] };

    /* Kor stor øya må vere for å ta 29 tre. KOLONNAR og radTal er ikkje
       ei plassering lenger — trea står tilfeldig — men dei er framleis
       den enklaste måten å seie «så mange tre med så stor avstand».

       Meir rom bak enn framfor: bakre femtedel er reservert til dei
       store steinane, som gjev skogen ein horisont i staden for ein kant
       som berre sluttar. */
    const radTal = Math.ceil(LjodLetters.ALPHABET.length / KOLONNAR);
    const rx = (KOLONNAR - 1) / 2 * RUTE + RUTE * 1.35;
    const rz = (radTal - 1) / 2 * RUTE * 0.92 + RUTE * 1.95;
    oy(ut, rx, rz);
    storsteinar(ut, rx, rz);
    plassar = byggPlassar(rx, rz);
    /* Kameraet måler avstanden sin mot desse. Ein skog for eit anna
       alfabet får ei anna øy, og då skal ikkje nokon hugse å justere ei
       hardkoda avstand. */
    ut.rx = rx;
    ut.rz = rz;

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
      /* Bedet er breitt og nesten flatt. Ei tue som stod opp av bakken
         såg ut som ein maurtue under kvar plante; ei flat flekk med jord
         seier «her er det planta noko» utan å ta plass i biletet.

         Ein bokstav som ikkje er opna enno har ikkje jord i det heile —
         berre gras og eit skilt. Det er ei tom seng, ikkje ei grav. */
      let toppen = 0;
      if (aktiv) {
        leggModell(bib.modellar['crops_dirtSingle'], ut,
          p.x, 0, p.z, BED, vinkel, false, BED_FLAT);
        toppen = bib.modellar['crops_dirtSingle'].hogd * BED * BED_FLAT;
      }
      if (steg > 0 && aktiv) {
        /* Eitt tre per bokstav. Ein tidlegare versjon sette fleire
           eksemplar i same rute — det trongst for blomar, som er éin
           stilk kvar, men eit tre er stort nok til å vere ei rute. */
        const mod = bib.modellar[art.steg[steg]];
        leggModell(mod, ut, p.x, toppen * 0.5, p.z, sk, vinkel, false);
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
     kvar plante heilt svart, og då ser ein skog med små planter ut som
     ein skog full av hòl. */
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

  /* ── BOKSTAVANE ER SKILT, IKKJE ETIKETTAR ──

     Første utgåva la bokstavane som DOM-element oppå lerretet. Dei var
     skarpe og kunne lesast av ein skjermlesar, men dei var ikkje I skogen:
     når ein snudde på han, hoppa dei inn og ut alt etter kva djupnepróva
     sa, og eit namn som blinkar er verre enn eit namn som er litt uskarpt.

     No er kvart namn eit lite skilt som står i bakken framfor planta si,
     bygd av to firkantar: ein stolpe og eit bord. Bordet ber bokstaven
     som ein tekstur, og heile skiltet snur seg mot kameraet om den
     loddrette aksen — så det er alltid lesbart, og alltid eit føremål i
     rommet som eit tre kan stå framfor.

     Bokstavane blir teikna i eit lerret ved oppstart, ikkje bygde inn i
     ei bildefil. Då arvar dei lesefonten eleven har valt.

     Skjermlesarar får si eiga liste ved sida av lerretet. Ein tekstur er
     usynleg for dei, og det skal ikkje bety at skogen blir det. */
  /* ÅTTE KOLONNAR OG IKKJE SEKS, OG DET ER IKKJE SMAK.

     29 bokstavar i 8 x 4 ruter på 128 piksel gjev eit atlas på nøyaktig
     1024 x 512 — begge toarpotensar. WebGL 1 nektar å lage mipmap-nivå
     for ein tekstur som ikkje er det, og ein tekstur med
     LINEAR_MIPMAP_LINEAR og ingen mipmap er UFULLSTENDIG: han svarar
     (0, 0, 0, 1) på kvart oppslag.

     Med seks kolonnar blei atlaset 768 x 640, og alle skilta i skogen
     stod som heilt svarte tavler — alfa var 1 overalt, så blekket dekte
     bordet. Feilen såg ut som eit fargeproblem og var ein tekstur som
     aldri blei lest. */
  const ATLAS_RUTE = 128;
  const ATLAS_KOL = 8;

  function lagBokstavAtlas(font) {
    const alf = LjodLetters.ALPHABET;
    const rader = Math.ceil(alf.length / ATLAS_KOL);
    const c = document.createElement('canvas');
    c.width = ATLAS_KOL * ATLAS_RUTE;
    c.height = rader * ATLAS_RUTE;
    if ((c.width & (c.width - 1)) || (c.height & (c.height - 1))) {
      /* Ei line i konsollen er betre enn tjueni svarte tavler. */
      console.warn('[Ljodstigen] Bokstavatlaset er ' + c.width + 'x' + c.height +
        ' og ikkje ein toarpotens. Skilta blir svarte.');
    }
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#000';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    /* Feit og stort: bokstaven skal tole å bli teikna på eit bord som er
       tretti centimeter breitt i ein skog sett frå ni meter. */
    g.font = '700 ' + Math.round(ATLAS_RUTE * 0.86) + 'px ' + font;
    alf.forEach(function (ch, i) {
      const x = (i % ATLAS_KOL + 0.5) * ATLAS_RUTE;
      const y = (Math.floor(i / ATLAS_KOL) + 0.54) * ATLAS_RUTE;
      g.fillText(ch, x, y);
    });
    return c;
  }

  /* UV-rammene til ein bokstav, med litt luft rundt så naboruta ikkje
     lek inn når teksturen blir interpolert. */
  /* RADA MÅ SNUAST. Teksturen blir lasta opp med UNPACK_FLIP_Y_WEBGL,
     så biletet står rett veg — men då ligg rad 0 i lerretet øvst i
     teksturen, altså ved v = 1 og ikkje v = 0.

     Utan snuinga henta bokstav nr. 0 frå den nedste rada i staden for
     den øvste: a til e viste y, z, æ, ø og å, og f, g og h viste dei tre
     tomme rutene på slutten. Tre blanke skilt og tre bokstavar som var
     borte — og resten stod med feil bokstav utan at det var like lett å
     sjå. */
  function bokstavUv(i) {
    const rader = Math.ceil(LjodLetters.ALPHABET.length / ATLAS_KOL);
    const kol = i % ATLAS_KOL;
    const rad = rader - 1 - Math.floor(i / ATLAS_KOL);
    const luft = 0.02;
    return {
      u0: (kol + luft) / ATLAS_KOL,
      u1: (kol + 1 - luft) / ATLAS_KOL,
      v0: (rad + luft) / rader,
      v1: (rad + 1 - luft) / rader
    };
  }

  /* Ei tom rute i atlaset, til stolpen og sidene: dei skal vere reint
     trevirke. Alfabetet fyller ikkje siste rada, så den siste ruta i
     rutenettet er tom — og han blir slått opp med same funksjonen, så
     han ikkje kan hamne feil om rutenettet endrar seg. */
  function tomUv() {
    const n = LjodLetters.ALPHABET.length;
    return bokstavUv(ATLAS_KOL * Math.ceil(n / ATLAS_KOL) - 1);
  }

  const SKILT_VS = [
    'attribute vec3 aPos;',
    'attribute vec2 aUv;',
    'attribute vec3 aFar;',
    'uniform mat4 uMvp;',
    'varying vec2 vUv;',
    'varying vec3 vFar;',
    'void main() {',
    '  vUv = aUv;',
    '  vFar = aFar;',
    '  gl_Position = uMvp * vec4(aPos, 1.0);',
    '}'
  ].join('\n');

  /* Blekket er ein mørk versjon av bordet sjølv. Då treng skiltet berre
     éin farge per hjørne, og eit grått skilt for ein bokstav som ikkje er
     opna enno får grått blekk utan noka ekstra greie. */
  const SKILT_FS = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'varying vec2 vUv;',
    'varying vec3 vFar;',
    'void main() {',
    '  float blekk = texture2D(uTex, vUv).a;',
    '  gl_FragColor = vec4(mix(vFar, vFar * 0.16, blekk), 1.0);',
    '}'
  ].join('\n');

  function lagProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, lagShader(gl, gl.VERTEX_SHADER, vs || VS));
    gl.attachShader(p, lagShader(gl, gl.FRAGMENT_SHADER, fs || FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  /* ──────────────── Visninga ──────────────── */

  function lag(vert, profil) {
    const canvas = document.createElement('canvas');
    canvas.className = 'ljod-skog3d-lerret';
    /* Lerretet er pynt; innhaldet ligg i lappane under, som har tekst. */
    canvas.setAttribute('aria-hidden', 'true');
    const lapper = document.createElement('ul');
    lapper.className = 'ljod-skog3d-lesarliste';

    vert.appendChild(canvas);
    vert.appendChild(lapper);

    const gl = canvas.getContext('webgl', { antialias: true, alpha: true })
      || canvas.getContext('experimental-webgl', { antialias: true, alpha: true });
    if (!gl) throw new Error('ingen webgl-kontekst');

    const prog = lagProgram(gl);
    const skiltProg = lagProgram(gl, SKILT_VS, SKILT_FS);
    const buf = {
      pos: gl.createBuffer(), nor: gl.createBuffer(), far: gl.createBuffer()
    };
    const skiltBuf = {
      pos: gl.createBuffer(), uv: gl.createBuffer(), far: gl.createBuffer()
    };
    const stad = {
      pos: gl.getAttribLocation(prog, 'aPos'),
      nor: gl.getAttribLocation(prog, 'aNor'),
      far: gl.getAttribLocation(prog, 'aFar'),
      mvp: gl.getUniformLocation(prog, 'uMvp')
    };
    const skiltStad = {
      pos: gl.getAttribLocation(skiltProg, 'aPos'),
      uv: gl.getAttribLocation(skiltProg, 'aUv'),
      far: gl.getAttribLocation(skiltProg, 'aFar'),
      mvp: gl.getUniformLocation(skiltProg, 'uMvp'),
      tex: gl.getUniformLocation(skiltProg, 'uTex')
    };

    /* Bokstavane blir teikna i eit lerret og lasta opp som ein tekstur.
       Fonten er den eleven har valt, henta ut av sida sjølv. */
    const skiltTex = gl.createTexture();
    function lastAtlas() {
      const font = root.getComputedStyle(document.body).fontFamily ||
        'Verdana, sans-serif';
      const c = lagBokstavAtlas(font);
      gl.bindTexture(gl.TEXTURE_2D, skiltTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    lastAtlas();

    gl.enable(gl.DEPTH_TEST);
    /* INGA BAKSIDEKUTTING. Fleire av Kenney-plantene — grasstrå, blad,
       kronblad — er einsidige flater. Med kutting forsvinn dei når ein
       dreier skogen forbi dei, og bakken forsvinn heilt. 6 500 trekantar
       er for lite til at kuttinga er verdt den feilen. */
    gl.disable(gl.CULL_FACE);

    let skog = byggSkog(profil);
    /* Kameraet: vassrett vinkel, loddrett vinkel, og eit zoom-tal som
       er ein faktor på avstanden. Dei tre er heile kameratilstanden. */
    /* Zoom 1 er «heile øya med luft rundt». Standarden er nærare enn
       det: skogen skal fylle biletet, ikkje ligge som ein flekk i det.
       Bedene ligg godt innanfor kanten av øya, så bokstavane kjem ikkje
       utanfor sjølv om øykanten gjer det. */
    let dreiing = -0.42;
    let helling = 0.46;
    let zoom = 0.74;
    let mvp = null;

    const HELLING_MIN = 0.06;   // nesten i augehøgd med bakken
    const HELLING_MAKS = 1.42;  // nesten rett ovanfrå
    const ZOOM_MIN = 0.42;
    const ZOOM_MAKS = 1.6;

    /* SKILTA SNUR SEG MOT KAMERAET om den loddrette aksen. Difor blir
       geometrien deira bygd på nytt for kvar teikning — 29 skilt er 348
       hjørne, og det er billegare å rekne dei om att enn å finne på ein
       måte å sleppe det. */
    /* Eit skilt er lite. Halvparten av det det var: leseligheita kjem av
       at eleven kan gå rundt skogen og sjå nærare, ikkje av at skiltet er
       stort — og eit stort skilt framfor kvart tre gjer ein skog om til
       ei rekkje reklametavler. */
    const STOLPE_B = 0.012, STOLPE_H = 0.055;
    const BORD_B = 0.068, BORD_TOPP = 0.170;
    const TJUKN = 0.016;

    function byggSkilt() {
      const pos = [], uv = [], far = [];
      const hx = Math.sin(dreiing), hz = Math.cos(dreiing);   // mot kameraet
      const rx = Math.cos(dreiing), rz = -Math.sin(dreiing);  // sidelengs
      const tre = palettFarge('woodInner', [245, 215, 187]);
      const stamme = palettFarge('woodBark', [226, 131, 87]);

      skog.beds.forEach(function (bed, i) {
        /* Skiltet står framfor treet, ikkje oppi det. */
        const bx = bed.x + hx * SKILT_MOT;
        const bz = bed.z + hz * SKILT_MOT;
        const bokstav = bokstavUv(i);
        /* Ein bokstav som ikkje er opna enno får eit gråna skilt. Det
           står der framleis — eleven skal sjå at skogen har plass. */
        const d = bed.aktiv ? 1 : 0.62;
        const g = bed.aktiv ? 0 : 0.30;
        function tone(c, k) {
          return [(c[0] * d + g) * k, (c[1] * d + g) * k, (c[2] * d + g) * k];
        }

        /* ── SKILTA HAR TJUKKLEIK ──

           Flate firkantar forsvann til ein strek når ein såg dei ovanfrå,
           og eit skilt som blir borte når ein vippar kameraet er ikkje
           eit skilt. Ein boks har ei topplate og to kantar som fangar
           lyset, og då står han i rommet frå kvar vinkel.

           Sideflatene har ingen normal å lyssetje med — skiltshaderen
           kjenner berre farge — så skuggen ligg i fargen: kantane er
           mørkare enn framsida, toppen litt lysare. Det er billegare enn
           ein normal per hjørne og ser likt ut på ein boks. */
        function boks(b, y0, y1, grunn, u) {
          const framme = tone(grunn, 1.0);
          const side = tone(grunn, 0.74);
          const topp = tone(grunn, 1.12);
          const botn = tone(grunn, 0.6);
          const t = TJUKN;

          function flate(hjorne, farge, uu) {
            const q = [hjorne[0], hjorne[1], hjorne[2], hjorne[0], hjorne[2], hjorne[3]];
            const uvs = [[uu.u0, uu.v0], [uu.u1, uu.v0], [uu.u1, uu.v1],
                         [uu.u0, uu.v0], [uu.u1, uu.v1], [uu.u0, uu.v1]];
            q.forEach(function (h, k) {
              pos.push(bx + rx * h[0] + hx * h[2], h[1], bz + rz * h[0] + hz * h[2]);
              uv.push(uvs[k][0], uvs[k][1]);
              far.push(farge[0], farge[1], farge[2]);
            });
          }
          /* Framsida ber bokstaven; resten er reint trevirke. */
          flate([[-b, y0, t], [b, y0, t], [b, y1, t], [-b, y1, t]], framme, u);
          flate([[b, y0, -t], [-b, y0, -t], [-b, y1, -t], [b, y1, -t]], side, tomUv());
          flate([[b, y0, t], [b, y0, -t], [b, y1, -t], [b, y1, t]], side, tomUv());
          flate([[-b, y0, -t], [-b, y0, t], [-b, y1, t], [-b, y1, -t]], side, tomUv());
          flate([[-b, y1, t], [b, y1, t], [b, y1, -t], [-b, y1, -t]], topp, tomUv());
          flate([[-b, y0, -t], [b, y0, -t], [b, y0, t], [-b, y0, t]], botn, tomUv());
        }

        boks(STOLPE_B, 0, STOLPE_H + 0.015, stamme, tomUv());
        boks(BORD_B, STOLPE_H, BORD_TOPP, tre, bokstav);
      });

      gl.bindBuffer(gl.ARRAY_BUFFER, skiltBuf.pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, skiltBuf.uv);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, skiltBuf.far);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(far), gl.DYNAMIC_DRAW);
      return pos.length / 3;
    }

    function lastOpp() {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skog.pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skog.nor), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.far);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skog.far), gl.STATIC_DRAW);
    }
    lastOpp();

    function teikn() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const b = vert.clientWidth || 640;
      /* Høgare enn før. Skogen fekk 52 % av breidda, og då blei plantene
         små ved sida av bokstavlappane, som har ein fast storleik i
         piksel. Det er plass på skjermen; skogen skal bruke han. */
      /* Ei øvre grense òg: på ein brei skjerm blir 68 % av breidda ein
         skog på 760 piksel som skuvar alt anna ned frå sida. */
      const h = Math.max(340, Math.min(520, Math.round(b * 0.68)));
      canvas.style.height = h + 'px';
      canvas.width = Math.round(b * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* AVSTANDEN BLIR MÅLT, IKKJE GJETTA.

         Vi projiserer randa av øya og toppen av dei høgaste plantene med
         ein prøveavstand, ser kor langt utanfor ramma dei hamnar, og
         skalerer avstanden med akkurat det. Skalaen i eit perspektiv er
         omvendt proporsjonal med avstanden, så éi runde treffer.

         Det er dette som gjer at hellinga kan gå frå augehøgd til rett
         ovanfrå utan at nokon justerer eit tal: sett ovanfrå er øya
         djup, sett frå sida er ho flat, og formelen for det er ikkje
         verdt å skrive når ein kan måle. Ei hardkoda avstand klipte dei
         ytste bedene tre gonger før dette stod her. */
      const FOV = 0.62;

      function kameraFor(d) {
        return [
          Math.sin(dreiing) * Math.cos(helling) * d,
          Math.sin(helling) * d,
          Math.cos(dreiing) * Math.cos(helling) * d
        ];
      }
      /* Opp-vektoren må ikkje vere parallell med blikkretninga. Står
         kameraet rett over skogen, er han det — og då blir biletet borte.
         Difor stoppar hellinga før 90 grader. */
      function matrise(d) {
        return multiplo(perspektiv(FOV, b / h, 0.4, 200),
          sePaa(kameraFor(d), [0, 0.4, 0], [0, 1, 0]));
      }

      const proeve = 12;
      const M = matrise(proeve);
      let verst = 0.001;
      for (let i = 0; i < 24; i++) {
        const v = i / 24 * Math.PI * 2;
        const k = omkrins(v, skog.rx, skog.rz);
        [0, 1.35].forEach(function (y) {
          const cx = M[0] * k.x + M[4] * y + M[8] * k.z + M[12];
          const cy = M[1] * k.x + M[5] * y + M[9] * k.z + M[13];
          const cw = M[3] * k.x + M[7] * y + M[11] * k.z + M[15];
          if (cw <= 0.01) { verst = Math.max(verst, 3); return; }
          verst = Math.max(verst, Math.abs(cx / cw), Math.abs(cy / cw));
        });
      }
      /* 0,92 og ikkje 1,0: litt luft, så kanten ikkje ligg klemt mot
         ramma og bokstavlappane får plass utanfor plantene sine. */
      const grunn = proeve * (verst / 0.92) * zoom;
      mvp = matrise(grunn);

      gl.useProgram(prog);
      gl.uniformMatrix4fv(stad.mvp, false, mvp);
      [['pos', 3], ['nor', 3], ['far', 3]].forEach(function (d) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf[d[0]]);
        gl.enableVertexAttribArray(stad[d[0]]);
        gl.vertexAttribPointer(stad[d[0]], d[1], gl.FLOAT, false, 0, 0);
      });
      gl.drawArrays(gl.TRIANGLES, 0, skog.tal);

      /* Skilta er vanleg geometri i same djupnebuffer som resten, så eit
         tre som står framfor eit skilt dekkjer det — utan at nokon må
         rekne ut kva som er framfor kva. */
      const skiltTal = byggSkilt();
      gl.useProgram(skiltProg);
      gl.uniformMatrix4fv(skiltStad.mvp, false, mvp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, skiltTex);
      gl.uniform1i(skiltStad.tex, 0);
      [['pos', 3], ['uv', 2], ['far', 3]].forEach(function (d) {
        gl.bindBuffer(gl.ARRAY_BUFFER, skiltBuf[d[0]]);
        gl.enableVertexAttribArray(skiltStad[d[0]]);
        gl.vertexAttribPointer(skiltStad[d[0]], d[1], gl.FLOAT, false, 0, 0);
      });
      gl.drawArrays(gl.TRIANGLES, 0, skiltTal);
      [skiltStad.pos, skiltStad.uv, skiltStad.far].forEach(function (a) {
        if (a >= 0) gl.disableVertexAttribArray(a);
      });
    }

    /* Skjermlesarane får si eiga liste. Ein bokstav malt i ein tekstur
       finst ikkje for dei, og det skal ikkje bety at skogen ikkje finst. */
    function byggLesarliste() {
      lapper.innerHTML = '';
      skog.beds.forEach(function (bed) {
        const el = document.createElement('li');
        const stegnamn = bed.art.stegnamn[bed.steg];
        el.textContent = bed.aktiv
          ? (bed.ch.toUpperCase() + ': ' + bed.art.namn.toLowerCase() + ', ' + stegnamn)
          : (bed.ch.toUpperCase() + ': ikkje opna enno');
        lapper.appendChild(el);
      });
    }
    byggLesarliste();

    /* ── Å SJÅ PÅ HAGEN ──

       Heile vegen rundt vassrett, og frå nesten i augehøgd til nesten
       rett ovanfrå. Loddrett MÅ stoppe før 90 grader: står kameraet rett
       over skogen, blir opp-vektoren parallell med blikkretninga og
       biletet forsvinn.

       Ein finger dreier, to fingrar knip zoom. Hjulet zoomar. Piltastane
       dreier og pluss og minus zoomar, så skogen kan sjåast utan mus —
       lerretet har tabindex nettopp for det. */

    function stell() {
      helling = Math.max(HELLING_MIN, Math.min(HELLING_MAKS, helling));
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAKS, zoom));
      /* Dreiinga går heile vegen rundt og har ingen grense — men han
         blir halden i [0, 2π) så talet ikkje veks i det uendelege. */
      dreiing = (dreiing % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      teikn();
    }

    const fingrar = {};        // pointerId -> {x, y}
    let knipAvstand = 0;
    /* Draginga eig både aksane, så nettlesaren skal ikkje rulle sida
       samtidig. */
    canvas.style.touchAction = 'none';

    function fingerliste() {
      return Object.keys(fingrar).map(function (k) { return fingrar[k]; });
    }

    canvas.addEventListener('pointerdown', function (e) {
      fingrar[e.pointerId] = { x: e.clientX, y: e.clientY };
      const f = fingerliste();
      if (f.length === 2) knipAvstand = Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y);
      /* Fangst kan feile — ein peikar som alt er borte, ein nettlesar som
         ikkje vil. Det skal ikkje stoppe draginga. */
      try {
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      } catch (feil) { /* draginga går fint utan */ }
    });

    canvas.addEventListener('pointermove', function (e) {
      const gamal = fingrar[e.pointerId];
      if (!gamal) return;
      const dx = e.clientX - gamal.x;
      const dy = e.clientY - gamal.y;
      gamal.x = e.clientX; gamal.y = e.clientY;

      const f = fingerliste();
      if (f.length >= 2) {
        const ny = Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y);
        if (knipAvstand > 0 && ny > 0) zoom *= knipAvstand / ny;
        knipAvstand = ny;
      } else {
        dreiing += dx * 0.008;
        helling += dy * 0.006;
      }
      stell();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
      canvas.addEventListener(n, function (e) {
        delete fingrar[e.pointerId];
        if (fingerliste().length < 2) knipAvstand = 0;
      });
    });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom *= (e.deltaY > 0 ? 1.12 : 1 / 1.12);
      stell();
    }, { passive: false });

    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label',
      'Skogen sett i 3D. Dra for å snu, knip eller bruk pluss og minus for å zoome.');
    canvas.addEventListener('keydown', function (e) {
      const steg = 0.14;
      if (e.key === 'ArrowLeft') dreiing -= steg;
      else if (e.key === 'ArrowRight') dreiing += steg;
      else if (e.key === 'ArrowUp') helling += steg * 0.7;
      else if (e.key === 'ArrowDown') helling -= steg * 0.7;
      else if (e.key === '+' || e.key === '=') zoom /= 1.14;
      else if (e.key === '-') zoom *= 1.14;
      else return;
      e.preventDefault();
      stell();
    });

    function settUtsyn(d, hl, z) {
      dreiing = d; helling = hl; zoom = z;
      stell();
    }

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
      /* Knappane over skogen styrer kameraet gjennom desse. */
      zoomInn: function () { zoom /= 1.18; stell(); },
      zoomUt: function () { zoom *= 1.18; stell(); },
      midtstill: function () { settUtsyn(-0.42, 0.46, 0.74); },
      utsyn: function () { return { dreiing: dreiing, helling: helling, zoom: zoom }; },
      oppdater: function (nyProfil) {
        skog = byggSkog(nyProfil);
        lastOpp();
        byggLesarliste();
        teikn();
      },
      /* Skiftar eleven lesefont, må bokstavane teiknast om att. */
      nyFont: function () { lastAtlas(); teikn(); },
      riv: function () {
        root.removeEventListener('resize', paaStorleik);
        clearTimeout(tidsavbrot);
        const utvid = gl.getExtension('WEBGL_lose_context');
        if (utvid) utvid.loseContext();
      }
    };
  }

  root.LjodSkog3D = {
    stott: stott, last: last, lag: lag,
    byggSkog: byggSkog, plass: plass, skala: skala
  };
})(window);
