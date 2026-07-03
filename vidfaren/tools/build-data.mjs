// ════════════════════════════════════════════════════════════════════
// LANDKJENNING — Byggjeskript for geografidata (køyrast éin gong)
//
//   node landkjenning/tools/build-data.mjs
//
// Hentar (krev nett, berre ved bygging — aldri i sjølve spelet):
//   1. Natural Earth 110m countries (GeoJSON)  — landgeometri
//   2. mledoze/countries (JSON)                — norsk namn, hovudstad, region, koordinat
//   3. Wikidata (SPARQL)                        — høgaste fjell + største innsjø (best-effort)
//
// Skriv:
//   landkjenning/data/countries.json   — alt spelet treng (eitt objekt per land)
//   landkjenning/assets/world.svg      — samla verdskart, eitt <path id="ISO2"> per land
//
// Geometri og pin bruker same ekvirektangulære projeksjon → fullt konsistent.
// Ingen npm-avhengnader: Node 18+ har innebygd fetch.
// ════════════════════════════════════════════════════════════════════

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const ASSETS_DIR = join(ROOT, 'assets');

// Projeksjon: ekvirektangulær (plate carrée) inn i eit W×H lerret.
const W = 1000, H = 500;
const projX = (lng) => ((lng + 180) / 360) * W;
const projY = (lat) => ((90 - lat) / 180) * H;
const r1 = (n) => Math.round(n * 10) / 10; // ein desimal — held fila lita

const NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const MLEDOZE_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const WD_SPARQL = 'https://query.wikidata.org/sparql';

const REGION_NO = {
  'Africa': 'Afrika', 'Americas': 'Amerika', 'Asia': 'Asia',
  'Europe': 'Europa', 'Oceania': 'Oseania', 'Antarctic': 'Antarktis', '': 'Anna'
};

// ── Henting med retry ────────────────────────────────────────────────
async function getJSON(url, opts = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Landkjenning-build/1.0 (vyrdepil)' }, ...opts });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn(`  forsøk ${attempt} feila for ${url.slice(0, 60)}…: ${e.message}`);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

async function sparql(query) {
  const url = WD_SPARQL + '?format=json&query=' + encodeURIComponent(query);
  const data = await getJSON(url, { headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'Landkjenning-build/1.0 (vyrdepil; kjellomail@gmail.com)' } });
  return data.results.bindings;
}

// ── Geometri → SVG-path + bbox ───────────────────────────────────────
function ringToPath(ring) {
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const x = r1(projX(lng)), y = r1(projY(lat));
    d += (i === 0 ? 'M' : 'L') + x + ' ' + y;
  }
  return d + 'Z';
}

// Bbox per polygon i lng/lat, med areal (for å finne hovudlandet).
function polyMeta(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [lng, lat] of rings[0]) {
    if (lng < minX) minX = lng; if (lng > maxX) maxX = lng;
    if (lat < minY) minY = lat; if (lat > maxY) maxY = lat;
  }
  return { rings, box: { minX, minY, maxX, maxY }, area: (maxX - minX) * (maxY - minY) };
}

// Kortaste avstand mellom to bbox-ar (grader). 0 om dei overlappar.
function boxGap(a, b) {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return Math.hypot(dx, dy);
}

// Fjern fjerne oversjøiske delar (t.d. Fransk Guyana) som gjer omrisset
// uattkjenneleg. Behald hovudlandet + alt som ligg nær det. Terskelen
// tilpassar seg storleiken på hovudlandet, så øygardar (mange spreidde
// øyar) ikkje blir øydelagde.
function trimFarParts(polys) {
  if (polys.length <= 1) return polys;
  const main = polys.reduce((m, p) => (p.area > m.area ? p : m), polys[0]);
  const dim = Math.max(main.box.maxX - main.box.minX, main.box.maxY - main.box.minY);
  const threshold = Math.max(3, dim); // grader (~3° ≈ 330 km minimum)
  return polys.filter(p => p === main || boxGap(p.box, main.box) <= threshold);
}

// Punkt-i-polygon (ray casting) på ytre ring i lng/lat.
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Representativt punkt garantert inne i polygonet: rutenett-søk som
// maksimerer avstanden til næraste hjørne (≈ visuelt sentrum). Sikrar at
// pinnen ligg på landmassa vår, ikkje på eit mledoze-punkt som kan bomme.
function repPoint(poly) {
  const r = poly.rings[0], b = poly.box, N = 24;
  let best = null, bestD = -1;
  for (let i = 0; i <= N; i++) {
    for (let k = 0; k <= N; k++) {
      const x = b.minX + (b.maxX - b.minX) * i / N;
      const y = b.minY + (b.maxY - b.minY) * k / N;
      if (!pointInRing(x, y, r)) continue;
      let md = Infinity;
      for (const [vx, vy] of r) { const d = (vx - x) ** 2 + (vy - y) ** 2; if (d < md) md = d; }
      if (md > bestD) { bestD = md; best = [x, y]; }
    }
  }
  if (!best) best = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  return [r1(projX(best[0])), r1(projY(best[1]))];
}

function geometryToPath(geom) {
  if (!geom) return null;
  const raw = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  if (!raw.length) return null;
  const polys = trimFarParts(raw.map(polyMeta));
  const main = polys.reduce((m, p) => (p.area > m.area ? p : m), polys[0]);

  let d = '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polys) {
    for (const ring of poly.rings) {
      if (ring.length < 3) continue;
      d += ringToPath(ring);
      for (const [lng, lat] of ring) {
        const x = projX(lng), y = projY(lat);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!d) return null;
  return { path: d, bbox: [r1(minX), r1(minY), r1(maxX - minX), r1(maxY - minY)], pin: repPoint(main) };
}

// ── Hovudprogram ─────────────────────────────────────────────────────
async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(ASSETS_DIR, { recursive: true });

  console.log('1/4  Hentar Natural Earth-geometri …');
  const ne = await getJSON(NE_URL);
  const geomByA3 = new Map();
  const popByA3 = new Map();
  for (const f of ne.features) {
    const p = f.properties || {};
    const a3 = (p.ADM0_A3 || p.ISO_A3 || p.SOV_A3 || '').toUpperCase();
    if (!a3 || a3 === '-99') continue;
    const g = geometryToPath(f.geometry);
    if (g) geomByA3.set(a3, g);
    if (p.POP_EST) popByA3.set(a3, Number(p.POP_EST));
  }
  console.log(`     ${geomByA3.size} land med geometri.`);

  console.log('2/4  Hentar mledoze-metadata …');
  const mled = await getJSON(MLEDOZE_URL);

  console.log('3/4  Hentar namn + fjell + innsjø frå Wikidata (best-effort) …');
  const nameByIso = new Map();
  const peakByIso = new Map();
  const lakeByIso = new Map();
  try {
    // Norske (nynorsk fyrst, så bokmål) landnamn — mledoze manglar dei.
    const names = await sparql(`
      SELECT ?iso2 ?cLabel WHERE {
        ?c wdt:P31 wd:Q6256 ; wdt:P297 ?iso2 .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "nn,nb,en". }
      }`);
    for (const b of names) {
      const iso = b.iso2?.value?.toUpperCase();
      const nm = b.cLabel?.value;
      if (iso && nm && !nameByIso.has(iso)) nameByIso.set(iso, nm);
    }
    console.log(`     ${nameByIso.size} norske landnamn.`);
  } catch (e) {
    console.warn('     Hoppar over namn (Wikidata feila): ' + e.message);
  }
  try {
    const peaks = await sparql(`
      SELECT ?iso2 ?peakLabel ?elev WHERE {
        ?c wdt:P31 wd:Q6256 ; wdt:P297 ?iso2 ; wdt:P610 ?peak .
        OPTIONAL { ?peak wdt:P2044 ?elev . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "nb,nn,en". }
      }`);
    for (const b of peaks) {
      const iso = b.iso2?.value?.toUpperCase();
      if (!iso || peakByIso.has(iso)) continue;
      peakByIso.set(iso, { name: b.peakLabel?.value || null, elev_m: b.elev ? Math.round(Number(b.elev.value)) : null });
    }
    console.log(`     ${peakByIso.size} land med høgaste fjell.`);
  } catch (e) {
    console.warn('     Hoppar over fjell (Wikidata feila): ' + e.message);
  }
  try {
    // Normalisert areal (psn: → kvantitet i m²) så land med ulike eininger kan samanliknast.
    const lakes = await sparql(`
      SELECT ?iso2 ?lakeLabel ?area WHERE {
        ?c wdt:P31 wd:Q6256 ; wdt:P297 ?iso2 .
        ?lake wdt:P31/wdt:P279* wd:Q23397 ; wdt:P17 ?c .
        FILTER NOT EXISTS { ?lake wdt:P576 ?dissolved . }   # ikkje nedlagt/forsvunne
        FILTER NOT EXISTS { ?lake wdt:P31 wd:Q63100595 . }  # ikkje førhistorisk innsjø
        ?lake p:P2046/psn:P2046/wikibase:quantityAmount ?area .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "nn,nb,en". }
      }`);
    for (const b of lakes) {
      const iso = b.iso2?.value?.toUpperCase();
      const area = Number(b.area?.value || 0); // m²
      if (!iso || !area || area > 4.2e11) continue; // tak ~Kaspihavet; sile bort dataråte
      const cur = lakeByIso.get(iso);
      if (!cur || area > cur.area) lakeByIso.set(iso, { name: b.lakeLabel?.value || null, area_km2: Math.round(area / 1e6), area });
    }
    console.log(`     ${lakeByIso.size} land med største innsjø.`);
  } catch (e) {
    console.warn('     Hoppar over innsjø (Wikidata feila): ' + e.message);
  }

  const capImgByIso = new Map();
  try {
    // Bilete av hovudstaden (P36 → P18). Lagrast som lenkje så spelet slepp spørjing.
    const imgs = await sparql(`
      SELECT ?iso2 ?img WHERE {
        ?c wdt:P31 wd:Q6256 ; wdt:P297 ?iso2 ; wdt:P36 ?cap .
        ?cap wdt:P18 ?img .
      }`);
    for (const b of imgs) {
      const iso = b.iso2?.value?.toUpperCase();
      const img = b.img?.value;
      if (iso && img && !capImgByIso.has(iso)) capImgByIso.set(iso, img);
    }
    console.log(`     ${capImgByIso.size} hovudstadsbilete.`);
  } catch (e) {
    console.warn('     Hoppar over hovudstadsbilete (Wikidata feila): ' + e.message);
  }

  const flagByIso = new Map();
  try {
    // Flagg (P41 → Wikimedia Commons). Same kjelde som hovudstadsbileta.
    const flags = await sparql(`
      SELECT ?iso2 ?flag WHERE {
        ?c wdt:P31 wd:Q6256 ; wdt:P297 ?iso2 ; wdt:P41 ?flag .
      }`);
    for (const b of flags) {
      const iso = b.iso2?.value?.toUpperCase();
      const flag = b.flag?.value;
      if (iso && flag && !flagByIso.has(iso)) flagByIso.set(iso, flag);
    }
    console.log(`     ${flagByIso.size} flagg.`);
  } catch (e) {
    console.warn('     Hoppar over flagg (Wikidata feila): ' + e.message);
  }

  // Valfri kuratert overstyring (namn vi vil sikre / fylle hol)
  let overrides = {};
  try { overrides = JSON.parse(await readFile(join(__dirname, 'overrides.json'), 'utf8')); } catch { /* valfri */ }

  console.log('4/4  Byggjer countries.json + world.svg …');
  const countries = [];
  for (const m of mled) {
    if (m.independent === false && m.unMember === false) continue; // hopp over territorium
    const iso2 = (m.cca2 || '').toUpperCase();
    const a3 = (m.cca3 || '').toUpperCase();
    if (!iso2 || !a3) continue;

    const geo = geomByA3.get(a3) || null;
    const name = nameByIso.get(iso2) || m.name?.common || iso2;
    const capital = Array.isArray(m.capital) && m.capital.length ? m.capital[0] : null;
    const region = REGION_NO[m.region || ''] || (m.region || 'Anna');
    const latlng = Array.isArray(m.latlng) && m.latlng.length === 2 ? m.latlng : null;
    const ov = overrides[iso2] || {};
    const lake = lakeByIso.get(iso2);

    countries.push({
      iso2,
      name: ov.name || name,
      capital: ov.capital || capital,
      capitalImg: ov.capitalImg || capImgByIso.get(iso2) || null,
      flag: ov.flag || flagByIso.get(iso2) || null,
      region,
      latlng,
      pop: popByA3.get(a3) || 0,
      highestPeak: ov.highestPeak || peakByIso.get(iso2) || null,
      largestLake: ov.largestLake || (lake ? { name: lake.name, area_km2: lake.area_km2 } : null),
      hasGeo: !!geo,
      bbox: geo ? geo.bbox : null,
      path: geo ? geo.path : null,
      pin: geo ? geo.pin : null
    });
  }

  // Nivådeling frå folketal: tier 1 (topp 40), tier 2 (neste 70), tier 3 (resten).
  const byPop = [...countries].sort((a, b) => b.pop - a.pop);
  byPop.forEach((c, i) => { c.tier = i < 40 ? 1 : i < 110 ? 2 : 3; });

  countries.sort((a, b) => a.name.localeCompare(b.name, 'nb'));

  const withCap = countries.filter(c => c.capital).length;
  const withPeak = countries.filter(c => c.highestPeak?.name).length;
  const withLake = countries.filter(c => c.largestLake?.name).length;
  const withGeo = countries.filter(c => c.hasGeo).length;

  await writeFile(join(DATA_DIR, 'countries.json'),
    JSON.stringify({ generated: new Date().toISOString(), viewBox: [0, 0, W, H], countries }, null, 0));

  // Samla verdskart-SVG
  const paths = countries.filter(c => c.path)
    .map(c => `<path id="c-${c.iso2}" data-iso="${c.iso2}" d="${c.path}"/>`).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="world-map">
<g class="lands">
${paths}
</g>
</svg>\n`;
  await writeFile(join(ASSETS_DIR, 'world.svg'), svg);

  // ── Standard geografi-øvingar til Ordaklok ─────────────────────────
  // Genererer innebygde lister (a=kjenneteikn, b=land) frå same datakjelde.
  const now = new Date().toISOString();
  const mkList = (id, title, labelA, desc, pairs) => ({
    app: 'ordaklok', version: 1, id, title, labelA, labelB: 'Land',
    description: desc, builtin: true, created: now, updated: now, pairs
  });
  const builtins = [
    mkList('builtin_geo_hovudstad', 'Hovudstader i verda', 'Hovudstad',
      'Para hovudstad og land. Standardøving frå Vidfaren.',
      countries.filter(c => c.capital).map(c => ({ a: c.capital, b: c.name }))),
    mkList('builtin_geo_fjell', 'Høgaste fjell i verda', 'Fjell',
      'Para høgaste fjell og land. Standardøving frå Vidfaren.',
      countries.filter(c => c.highestPeak?.name).map(c => ({ a: c.highestPeak.name, b: c.name }))),
    mkList('builtin_geo_innsjo', 'Største innsjøar', 'Innsjø',
      'Para største innsjø og land. Standardøving frå Vidfaren.',
      countries.filter(c => c.largestLake?.name).map(c => ({ a: c.largestLake.name, b: c.name })))
  ];
  const ordaklokDir = join(ROOT, '..', 'ordaklok', 'data');
  await mkdir(ordaklokDir, { recursive: true });
  await writeFile(join(ordaklokDir, 'geografi.js'),
    '/* Auto-generert av vidfaren/tools/build-data.mjs — ikkje rediger for hand. */\n' +
    'window.OrdaklokBuiltins = ' + JSON.stringify(builtins) + ';\n');

  const withImg = countries.filter(c => c.capitalImg).length;
  const withFlag = countries.filter(c => c.flag).length;
  console.log(`\nFerdig: ${countries.length} land  (hovudstad ${withCap}, bilete ${withImg}, flagg ${withFlag}, fjell ${withPeak}, innsjø ${withLake}, geometri ${withGeo}).`);
  console.log('  →', join(DATA_DIR, 'countries.json'));
  console.log('  →', join(ASSETS_DIR, 'world.svg'));
  console.log('  →', join(ordaklokDir, 'geografi.js'));
}

main().catch(e => { console.error('\nBygging feila:', e); process.exit(1); });
