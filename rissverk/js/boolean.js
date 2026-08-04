/* ══════════════════════════════════════════════
   BOOLEAN.JS — Union, subtraksjon, snitt og ekskludering

   Dette er den einaste modulen i Rissverk der eg vil grunngje val av
   ALGORITME og ikkje berre av kode, for det finst fleire vegar hit og
   dei skil seg mykje i kor lett dei er å ta feil av.

   Den vanlege framgangsmåten i lærebøkene er Greiner–Hormann eller ein
   sveipelinje som Martinez–Rueda: ein følgjer omrisset og byter mellom
   dei to formene ved kvart kryss. Han er rask, men han byggjer på at
   krysspunkta vekslar pent mellom «inn» og «ut». I det to kantar ligg
   oppå kvarandre, eit hjørne så vidt streifar ein kant, eller ei form
   kryssar seg sjølv, held ikkje den føresetnaden lenger, og resultatet
   blir stille feil — ei form som ser nesten rett ut.

   Vi gjer det på ein annan måte, som er tyngre å rekne men mykje
   vanskelegare å ta feil av:

     1. Del ALLE kantar mot ALLE andre kantar. Etterpå finst det ingen
        kryss lenger, berre endepunkt som møtest.
     2. For kvart kantstykke: gå eit lite steg ut til kvar side, og spør
        kva OMRÅDE du står i. Er svaret ulikt på dei to sidene, ligg
        stykket på kanten av resultatet og skal vere med. Er svaret likt,
        ligg det midt inne i noko eller heilt utanfor, og skal bort.
     3. Snu stykket slik at resultatet alltid ligg på same sida.
     4. Kjed stykka saman til lykkjer.

   Steg 2 er heile poenget. Han spør ikkje «kryssar vi her?», han spør
   «kva er sant på kvar side?». Difor bryr han seg ikkje om at ei form
   kryssar seg sjølv, at hol er uttrykte med motsett vinding, eller at
   tre kantar møtest i same punkt. Alt det fell ut av seg sjølv.

   PRISEN: kurver blir til linjestykke. Vi flatar ut før vi reknar, og
   det finst ingen veg tilbake — det er matematisk uråd å hente den
   opphavlege kurva ut att av resultatet. Brukaren får beskjed.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.boolean = (function () {
  'use strict';

  /* Kor fint kurvene blir flata ut, i dokumenteiningar. Finare gjev
     rundare resultat og fleire punkt; grovare gjev kantete former. */
  const FLATTEN = 0.12;

  /* ──────────────── Operasjonane ──────────────── */

  const OPS = {
    /* A eller B */
    union:     (a, b) => a || b,
    /* A og B */
    intersect: (a, b) => a && b,
    /* A men ikkje B */
    subtract:  (a, b) => a && !b,
    /* anten A eller B, men ikkje begge */
    exclude:   (a, b) => a !== b
  };

  /* ──────────────── Inngang ──────────────── */

  /**
   * @param {string} op union | intersect | subtract | exclude
   * @param {Array} aPolys punktlister for form A, i dokumentkoordinatar
   * @param {Array} bPolys punktlister for form B
   * @returns {Array|null} nye delstiar, eller null når resultatet er tomt
   */
  function run(op, aPolys, bPolys) {
    const test = OPS[op];
    if (!test) return null;

    const eps = epsilonFor(aPolys.concat(bPolys));
    const edges = buildEdges(aPolys, bPolys);
    splitAll(edges);

    const kept = [];
    edges.forEach((edge) => {
      fragments(edge).forEach((frag) => {
        const side = classify(frag, aPolys, bPolys, test, eps);
        if (side) kept.push(side);
      });
    });

    const clean = dedupe(kept, eps);
    if (!clean.length) return null;
    const loops = chain(clean, eps);
    if (!loops.length) return null;

    return loops.map(loop => RV.geom.makeSubpath(
      loop.map(p => RV.geom.makePoint(p.x, p.y, 'corner')), true));
  }

  /**
   * Kor langt vi går ut til sida når vi spør kva område vi står i.
   *
   * Steget må vere lite nok til at vi ikkje hoppar over ein tynn del av
   * forma, og stort nok til at det ikkje druknar i flyttalsstøy. Vi
   * knyter det til storleiken på formene, så same koden verkar både på
   * eit ikon på 24 einingar og på ei teikning på fire tusen.
   */
  function epsilonFor(polys) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polys.forEach(poly => poly.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }));
    const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
    return Math.max(1e-9, diag * 1e-5);
  }

  /* ──────────────── Kantar ──────────────── */

  function buildEdges(aPolys, bPolys) {
    const edges = [];
    const add = (polys) => {
      polys.forEach((poly) => {
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          if (a.x === b.x && a.y === b.y) continue;    // nullkant
          edges.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, cuts: [] });
        }
      });
    };
    add(aPolys);
    add(bPolys);
    return edges;
  }

  /**
   * Deler alle kantar mot alle andre.
   *
   * Krysspunktet blir rekna ut ÉIN gong og lagt inn på begge kantane som
   * det same objektet. Difor kan vi seinare kjede stykka saman på
   * identitet i staden for å samanlikne flyttal, og eit kryss kan ikkje
   * bli til to punkt som ligg 1e-16 frå kvarandre.
   */
  function splitAll(edges) {
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const hit = crossing(edges[i], edges[j]);
        if (!hit) continue;
        // Kryss i eit endepunkt treng ingen deling — punktet finst frå før.
        if (hit.t > 1e-12 && hit.t < 1 - 1e-12) edges[i].cuts.push({ t: hit.t, p: hit.p });
        if (hit.u > 1e-12 && hit.u < 1 - 1e-12) edges[j].cuts.push({ t: hit.u, p: hit.p });
      }
    }
  }

  function crossing(e1, e2) {
    const r = { x: e1.b.x - e1.a.x, y: e1.b.y - e1.a.y };
    const s = { x: e2.b.x - e2.a.x, y: e2.b.y - e2.a.y };
    const denom = r.x * s.y - r.y * s.x;
    // Parallelle kantar. Ligg dei oppå kvarandre, ordnar side-testen
    // seinare opp i det — dei treng ingen deling her.
    if (Math.abs(denom) < 1e-12) return null;

    const dx = e2.a.x - e1.a.x;
    const dy = e2.a.y - e1.a.y;
    const t = (dx * s.y - dy * s.x) / denom;
    const u = (dx * r.y - dy * r.x) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;

    return { t: t, u: u, p: { x: e1.a.x + t * r.x, y: e1.a.y + t * r.y } };
  }

  /** Kanten delt opp i stykke ved kutta sine. */
  function fragments(edge) {
    if (!edge.cuts.length) return [{ a: edge.a, b: edge.b }];

    edge.cuts.sort((x, y) => x.t - y.t);
    const out = [];
    let from = edge.a;
    edge.cuts.forEach((cut) => {
      if (cut.p !== from) out.push({ a: from, b: cut.p });
      from = cut.p;
    });
    out.push({ a: from, b: edge.b });
    return out.filter(f => f.a.x !== f.b.x || f.a.y !== f.b.y);
  }

  /* ──────────────── Klassifisering ──────────────── */

  /**
   * Skal stykket vere med, og kva veg skal det peike?
   *
   * Vi går eit lite steg ut til kvar side av midten og spør om vi er
   * inne i A og inne i B. Så reknar vi ut om vi er inne i RESULTATET på
   * kvar side. Er svaret ulikt, ligg stykket på kanten av resultatet.
   *
   * Retninga blir sett slik at resultatet alltid ligg på venstre side.
   * Utan det ville hol og ytterkantar fått same vinding, og
   * nonzero-regelen ville fylt hola igjen.
   */
  function classify(frag, aPolys, bPolys, test, eps) {
    const mx = (frag.a.x + frag.b.x) / 2;
    const my = (frag.a.y + frag.b.y) / 2;

    const dx = frag.b.x - frag.a.x;
    const dy = frag.b.y - frag.a.y;
    const len = Math.hypot(dx, dy);
    if (len < eps) return null;

    // Normalen, med lengd eps.
    const nx = (-dy / len) * eps;
    const ny = (dx / len) * eps;

    const leftIn = test(
      RV.geom.pointInPolygons(aPolys, mx + nx, my + ny),
      RV.geom.pointInPolygons(bPolys, mx + nx, my + ny));
    const rightIn = test(
      RV.geom.pointInPolygons(aPolys, mx - nx, my - ny),
      RV.geom.pointInPolygons(bPolys, mx - nx, my - ny));

    if (leftIn === rightIn) return null;             // midt inne, eller heilt utanfor
    // Resultatet skal liggje til venstre. Er det til høgre, snur vi.
    return leftIn ? { a: frag.a, b: frag.b } : { a: frag.b, b: frag.a };
  }

  /* ──────────────── Samanfallande kantar ──────────────── */

  /**
   * Ryddar bort stykke som ligg oppå kvarandre.
   *
   * Legg brukaren to like former oppå kvarandre og slår dei saman, ligg
   * kvar einaste kant der i to eksemplar. Begge blir godkjende av
   * side-testen — dei har jo same område på kvar side — og resultatet
   * ville fått dobbelt omriss.
   *
   * To reglar:
   *   Same retning  — dette er den same kanten to gonger. Hald éin.
   *   Motsett retning — resultatet ligg på begge sider av stykket, så
   *     det er ikkje ein kant i det heile. Kast begge.
   *
   * Den andre regelen er den som gjer at «subtraher forma frå seg sjølv»
   * gjev ingenting i staden for eit omriss utan innhald.
   */
  function dedupe(frags, eps) {
    const grid = Math.max(eps, 1e-9);
    const at = p => Math.round(p.x / grid) + ':' + Math.round(p.y / grid);

    const seen = new Map();
    frags.forEach((f) => {
      const forward = at(f.a) + '>' + at(f.b);
      const backward = at(f.b) + '>' + at(f.a);

      if (seen.has(backward)) { seen.delete(backward); return; }   // opphevar kvarandre
      if (seen.has(forward)) return;                               // same kant om att
      seen.set(forward, f);
    });

    return Array.from(seen.values());
  }

  /* ──────────────── Kjeding ──────────────── */

  /**
   * Bind stykka saman til lukka lykkjer.
   *
   * Punkta er delte objekt der dei kjem frå same kryss, men eit
   * opphavleg hjørne og eit krysspunkt kan liggje uendeleg nær kvarandre
   * utan å vere same objekt. Difor kjedar vi på ein AVRUNDA nøkkel og
   * ikkje på identitet.
   */
  function chain(frags, eps) {
    const grid = Math.max(eps, 1e-9);
    const key = p => Math.round(p.x / grid) + ':' + Math.round(p.y / grid);

    const from = new Map();
    frags.forEach((f, i) => {
      const k = key(f.a);
      if (!from.has(k)) from.set(k, []);
      from.get(k).push(i);
    });

    const used = new Array(frags.length).fill(false);
    const loops = [];

    for (let i = 0; i < frags.length; i++) {
      if (used[i]) continue;

      const loop = [];
      let current = i;
      let guard = 0;

      while (current !== -1 && !used[current] && guard++ < frags.length + 2) {
        used[current] = true;
        loop.push(frags[current].a);

        const free = (from.get(key(frags[current].b)) || []).filter(c => !used[c]);
        current = free.length > 1 ? tightest(frags[current], free, frags)
                : (free.length === 1 ? free[0] : -1);
      }

      // Ei lykkje treng tre punkt for å ha eit areal. Opne kjeder er
      // rester frå avrundingar og blir kasta.
      if (loop.length >= 3) loops.push(loop);
    }

    return loops;
  }

  /**
   * Kva veg går vi når fleire stykke startar i same punkt?
   *
   * Dette skjer i eit KNIPEPUNKT: to delar av resultatet møtest i eit
   * einaste punkt, som når to kvadrat blir XOR-a og dei to L-formene
   * heng saman i hjørna. Fire stykke møtest der, og vel vi feil, blir
   * dei to formene kjeda saman til éi åttetalsforma lykkje.
   *
   * Rett val er å svinge så skarpt som råd — å halde seg tettast inntil
   * det området vi følgjer kanten av. Vi måler vinkelen frå den vegen vi
   * KOM (altså rett bakover) og rundt, og tek det første stykket vi
   * møter. Då kan vi ikkje ta steget over i naboforma.
   */
  function tightest(incoming, candidates, frags) {
    const back = Math.atan2(incoming.a.y - incoming.b.y, incoming.a.x - incoming.b.x);
    const TWO_PI = Math.PI * 2;

    let best = candidates[0];
    let bestTurn = Infinity;

    candidates.forEach((index) => {
      const f = frags[index];
      const out = Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x);
      let turn = (out - back) % TWO_PI;
      if (turn <= 1e-12) turn += TWO_PI;      // rett bakover er svingen heilt rundt
      if (turn < bestTurn) { bestTurn = turn; best = index; }
    });

    return best;
  }

  /* ──────────────── Kopling mot modellen ──────────────── */

  /** Ein node som punktlister i dokumentkoordinatar. */
  function polysOf(id) {
    const node = RV.state.get(id);
    if (!node) return null;

    if (node.type === 'group') {
      let all = [];
      RV.state.listOf(id).forEach((cid) => {
        const child = polysOf(cid);
        if (child) all = all.concat(child);
      });
      return all.length ? all : null;
    }

    const subpaths = RV.geom.toSubpaths(node);
    if (!subpaths.length) return null;
    const world = RV.geom.transformSubpaths(subpaths, RV.state.worldMatrix(id));
    return RV.geom.flattenSubpaths(world, FLATTEN);
  }

  /**
   * Køyrer operasjonen på det som er valt.
   *
   * Rekkjefølgja er teiknerekkjefølgja: den BAKARSTE forma er A, og alt
   * som ligg framfor blir rekna inn etter tur. Difor tyder «subtraher»
   * at det som ligg oppå blir skore bort frå det som ligg under — same
   * meining som i dei andre programma folk kjenner.
   *
   * @returns {string|null} feilmelding på nynorsk, eller null
   */
  function apply(op) {
    const ids = RV.state.topSelection();
    if (ids.length < 2) return 'Vel minst to former.';

    // Sorter etter teiknerekkjefølgje, bakarst først.
    const order = RV.state.data.root.filter(id => ids.indexOf(id) !== -1);
    if (order.length !== ids.length) {
      return 'Formene må liggje på same nivå — løys opp gruppa først.';
    }

    const sets = order.map(polysOf);
    if (sets.some(s => !s)) return 'Ei av formene har ingen geometri å rekne på.';

    let result = sets[0];
    for (let i = 1; i < sets.length; i++) {
      const merged = run(op, result, sets[i]);
      if (!merged) {
        result = null;
        break;
      }
      result = RV.geom.flattenSubpaths(merged, FLATTEN);
    }

    if (!result || !result.length) {
      return op === 'intersect'
        ? 'Formene overlappar ikkje, så snittet er tomt.'
        : 'Operasjonen gav ingenting att.';
    }

    RV.state.pushUndo();

    // Den bakarste forma gjev stilen, slik det er i dei fleste
    // vektorprogram: du subtraherer FRÅ noko, og det du subtraherer frå
    // skal sjå ut som før.
    const base = RV.state.get(order[0]);
    const node = RV.state.makeNode('path', {
      subpaths: result.map(poly => RV.geom.makeSubpath(
        poly.map(p => RV.geom.makePoint(p.x, p.y, 'corner')), true))
    });
    node.name = base.name;
    node.fill = JSON.parse(JSON.stringify(base.fill));
    node.stroke = JSON.parse(JSON.stringify(base.stroke));
    node.opacity = base.opacity;

    const at = RV.state.data.root.indexOf(order[0]);
    order.forEach(id => RV.state.remove(id));
    RV.state.add(node, null, at);
    RV.state.setSelection([node.id]);

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    return null;
  }

  return { run, apply, OPS, FLATTEN };
})();
