// Genererer datafilene til Duldord.
// Køyrast éin gong; resultatet blir sjekka inn og skal ikkje regenererast,
// for då ville rekkjefølgja på orda endra seg for alle som alt har spelt.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCRATCH = 'C:/Users/88kjebjo/AppData/Local/Temp/claude/C--Users-88kjebjo--projects/9f664830-6ebd-4ab8-b0a1-b48c4d4fe15c/scratchpad';
const OUT = 'C:/Users/88kjebjo/_projects/duldord/data';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzæøå';
const SEED = 20260804;
const MIN_GAP = 4; // same forbokstav skal ikkje kome att innan så mange dagar

const answers = readFileSync(join(SCRATCH, 'ord.txt'), 'utf8')
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
if (answers.length !== 365) throw new Error(`Venta 365 fasitord, fann ${answers.length}`);

// --- deterministisk stokking ---------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const order = answers.slice();
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}

// Rein stokking kan framleis leggje to b-ord etter kvarandre. Vi gjer difor eit
// reparasjonspass som byter plass til ingen forbokstav gjentek seg innan MIN_GAP dagar.
const clashes = (arr, i, w) => {
  for (let k = Math.max(0, i - MIN_GAP + 1); k < Math.min(arr.length, i + MIN_GAP); k++) {
    if (k !== i && arr[k] && arr[k][0] === w[0]) return true;
  }
  return false;
};
for (let pass = 0; pass < 60; pass++) {
  let fixed = 0;
  for (let i = 1; i < order.length; i++) {
    if (!clashes(order, i, order[i])) continue;
    for (let d = 1; d < order.length; d++) {
      const j = (i + d) % order.length;
      const a = order[i], b = order[j];
      order[i] = b; order[j] = a;
      if (!clashes(order, i, b) && !clashes(order, j, a)) { fixed++; break; }
      order[i] = a; order[j] = b;
    }
  }
  if (!fixed) break;
}

let worst = Infinity, worstAt = -1;
for (let i = 1; i < order.length; i++) {
  for (let k = i - 1; k >= 0 && i - k < 10; k--) {
    if (order[k][0] === order[i][0] && i - k < worst) { worst = i - k; worstAt = i; }
  }
}
console.log(`Stokka. Minste avstand mellom to like forbokstavar: ${worst} dagar (dag ${worstAt + 1}).`);
console.log(`Fyrste ti: ${order.slice(0, 10).join(', ')}`);

// --- obfuskering ----------------------------------------------------------
// Ikkje tryggleik, berre nok til at fasiten ikkje kan lesast rett ut av devtools.
const encode = (word, i) => {
  const shift = (i * 7 + 13) % ALPHABET.length;
  return [...word].map(ch => {
    const p = ALPHABET.indexOf(ch);
    if (p < 0) throw new Error(`Ukjend teikn "${ch}" i "${word}"`);
    return ALPHABET[(p + shift) % ALPHABET.length];
  }).join('');
};
const encoded = order.map(encode);
// sanity: dekod att og samanlikn
const decode = (word, i) => {
  const shift = (i * 7 + 13) % ALPHABET.length;
  return [...word].map(ch => ALPHABET[(ALPHABET.indexOf(ch) - shift + ALPHABET.length) % ALPHABET.length]).join('');
};
encoded.forEach((w, i) => { if (decode(w, i) !== order[i]) throw new Error(`Kodefeil på ${i}`); });
console.log('Koding verifisert for alle 365.');

// --- gjettbare ord --------------------------------------------------------
const bank = JSON.parse(readFileSync(join(SCRATCH, 'ordbank/duldord-gjettbare.json'), 'utf8'));
const guessable = [...new Set([...bank.ord, ...answers])].sort();
console.log(`Gjettbare ord: ${guessable.length} (${guessable.length - bank.ord.length} lagt til frå fasitlista).`);

mkdirSync(OUT, { recursive: true });

writeFileSync(join(OUT, 'ord.js'),
`// Duldord — fasitord for år 1, dag 1 = 2026-08-04.
// Orda er stokka éin gong med fast frø og lett obfuskerte; sjå README i mappa.
// Rekkjefølgja må ALDRI endrast — då byter alle tidlegare dagar ord.
window.DULDORD_WORDS = ${JSON.stringify(encoded)};
window.DULDORD_START = '2026-08-04';
`, 'utf8');

writeFileSync(join(OUT, 'gjettbare.json'), JSON.stringify({
  app: 'duldord',
  version: 1,
  kjelde: 'Norsk Ordbank – Nynorsk 2012 (Språkbanken, Nasjonalbiblioteket), CC-BY 4.0',
  henta: '2026-08-04',
  merknad: 'Femteikns nynorske ordformer utan eigennamn, pluss dei 365 fasitorda.',
  tal: guessable.length,
  ord: guessable
}), 'utf8');

console.log('Skrivne filer i ' + OUT);
