/* Ormritaren — grafikkruta.
 *
 * To slag grafikk endar her: teiknekommandoar frå turtle, som blir spelte av
 * på eit canvas, og ferdige PNG-ar frå matplotlib, som blir viste som bilete.
 *
 * Turtle blir spelt av i takt i staden for å teiknast med ein gong. Det er
 * ikkje pynt: å sjå forma bli til, steg for steg, er heile grunnen til at
 * turtle blir brukt i skulen. Farten kjem frå `speed()` i elevkoden.
 */
const OrmGrafikk = (function () {

    let lerret, ctx, biletboks;
    let kø = [];               // kommandoar som ventar på å bli teikna
    let spelar = false;
    let fart = 6;              // 0 = teikn alt med ein gong (turtle sin «fastest»)
    let skilpadde = null;      // siste kjende posisjon, teikna som markør
    let harInnhald = false;
    let onEndra = null;

    /* Alt som er teikna, slik at vi kan teikne det opp att ved endra storleik.
     * Alternativet — å ta vare på biletet med toDataURL og leggje det inn att —
     * er asynkront, og då kan ei ny teikning kome før biletet er tilbake. */
    let historikk = [];

    function init(el, callback) {
        lerret = el.lerret;
        biletboks = el.bilete;
        onEndra = callback;
        ctx = lerret.getContext('2d');
        tilpassStorleik();

        /* window.resize er ikkje nok: canvas-boksen endrar seg òg når fana
         * byter, når skrifta lastar eller når panelet blir vist fyrste gong.
         * Utan dette blir bufferen målt på feil tidspunkt, og heile teikninga
         * hamnar skalert og forskjøvet. */
        if (window.ResizeObserver) {
            new ResizeObserver(tilpassStorleik).observe(lerret);
        } else {
            window.addEventListener('resize', tilpassStorleik);
        }
    }

    /* Canvas må ha ei fysisk oppløysing som svarar til CSS-storleiken,
     * elles blir strekane uskarpe på skjermar med høg pikseltettleik. */
    function tilpassStorleik() {
        if (!lerret) return;
        const dpr = window.devicePixelRatio || 1;
        // clientWidth/Height, ikkje getBoundingClientRect: rect-en tel med
        // ramma på 2px, medan px()/py() reknar frå innhaldsboksen. Blandar
        // ein dei, hamnar sentrum eit par pikslar feil.
        const br = lerret.clientWidth, hg = lerret.clientHeight;
        if (!br || !hg) return;

        const nyB = Math.round(br * dpr);
        const nyH = Math.round(hg * dpr);
        if (lerret.width === nyB && lerret.height === nyH) return;

        lerret.width = nyB;          // nullstiller lerretet og transformen
        lerret.height = nyH;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Teikn opp att med ein gong, utan animasjon.
        markorLag = null;
        ctx.save();
        historikk.forEach(utfoer);
        ctx.restore();
        teiknSkilpadde();
    }

    /* Turtle-koordinatar: (0,0) i midten, y oppover. Canvas: y nedover. */
    const px = (x) => lerret.clientWidth / 2 + x;
    const py = (y) => lerret.clientHeight / 2 - y;

    function tom() {
        kø = [];
        historikk = [];
        markorLag = null;
        aktivLinje = null;
        spelar = false;
        skilpadde = null;
        harInnhald = false;
        if (ctx) ctx.clearRect(0, 0, lerret.width, lerret.height);
        if (lerret) lerret.hidden = true;
        if (biletboks) biletboks.textContent = '';
    }

    /* ---- turtle ---------------------------------------------------- */

    function leggTil(kommandoar) {
        // Teikneflata kjem fyrst fram når turtle faktisk teiknar — eit program
        // som berre lagar eit matplotlib-plott skal ikkje få ei tom rute over
        // figuren.
        lerret.hidden = false;
        kø.push(...kommandoar);
        vis();
        driv();
    }

    /* Teiknar og fører til historikka. Avspeling ved endra storleik kallar
     * utfoer() direkte, så same kommandoen ikkje blir ført opp to gonger. */
    function kjoer(k) {
        // turtle.clear() gjer alt før seg irrelevant — hald historikka kort.
        if (k.k === 'tøm') historikk = [];
        historikk.push(k);
        utfoer(k);
    }

    /* Animasjonen er til for den som ser på. Ligg fana i bakgrunnen, fyrer
     * ikkje requestAnimationFrame i det heile, og teikninga ville blitt
     * ståande halvferdig til eleven kom tilbake. Då teiknar vi heller alt
     * med ein gong, så biletet er ferdig når han ser hit att. */
    function driv() {
        if (spelar) return;
        // Mål opp lerretet rett før vi teiknar. ResizeObserver høyrer til
        // renderings-syklusen og fyrer ikkje når fana ikkje blir teikna, og
        // då ville bufferen stått att med feil storleik og heile teikninga
        // blitt skalert og forskjøvet.
        tilpassStorleik();
        if (document.hidden) { tømKøen(); return; }
        spelar = true;
        requestAnimationFrame(steg);
    }

    function tømKøen() {
        fjernMarkor();
        ctx.save();
        while (kø.length) kjoer(kø.shift());
        ctx.restore();
        teiknSkilpadde();
    }

    document.addEventListener('visibilitychange', () => { if (!document.hidden) driv(); });

    /* Strek som er under teikning. Ein forward() kjem som éin kommando, men
     * blir teikna bit for bit slik at eleven ser pennen gå. Utan dette dukkar
     * heile figuren opp på ein gong, og då er det ingenting å sjå på — som er
     * heile grunnen til at turtle blir brukt i skulen. */
    let aktivLinje = null;

    function steg() {
        if (!kø.length && !aktivLinje) { spelar = false; teiknSkilpadde(); return; }

        // Pikslar per bilete. fart 0 tyder «så fort som råd» i turtle;
        // elles går det frå rolege 3 px/bilete på fart 1 til raske 100 på fart 10.
        let budsjett = fart === 0 ? Infinity : fart * fart + 2;

        fjernMarkor();   // før vi teiknar, ikkje etter — sjå fjernMarkor()
        ctx.save();
        while (budsjett > 0) {
            if (!aktivLinje) {
                if (!kø.length) break;
                const k = kø.shift();
                if (k.k !== 'linje') { kjoer(k); continue; }

                historikk.push(k);           // historikka held heile streken
                const lengd = Math.hypot(k.x2 - k.x1, k.y2 - k.y1);
                if (lengd < 0.01) continue;  // penn opp og ned på same punkt
                aktivLinje = { k, lengd, gjort: 0, x: k.x1, y: k.y1 };
            }

            const bit = Math.min(aktivLinje.lengd - aktivLinje.gjort, budsjett);
            budsjett -= bit;
            aktivLinje.gjort += bit;

            const t = aktivLinje.gjort / aktivLinje.lengd;
            const nx = aktivLinje.k.x1 + (aktivLinje.k.x2 - aktivLinje.k.x1) * t;
            const ny = aktivLinje.k.y1 + (aktivLinje.k.y2 - aktivLinje.k.y1) * t;

            strek(aktivLinje.x, aktivLinje.y, nx, ny, aktivLinje.k.farge, aktivLinje.k.tjukn);
            aktivLinje.x = nx;
            aktivLinje.y = ny;

            // Flytt markøren med pennen, elles står skilpadda stille medan
            // streken veks ut under henne.
            if (skilpadde) { skilpadde.x = nx; skilpadde.y = ny; }
            else skilpadde = { x: nx, y: ny, v: 0, synleg: true };

            if (aktivLinje.gjort >= aktivLinje.lengd - 1e-9) aktivLinje = null;
        }
        ctx.restore();

        teiknSkilpadde();
        requestAnimationFrame(steg);
    }

    function strek(x1, y1, x2, y2, farge, tjukn) {
        harInnhald = true;
        ctx.beginPath();
        ctx.moveTo(px(x1), py(y1));
        ctx.lineTo(px(x2), py(y2));
        ctx.strokeStyle = farge;
        ctx.lineWidth = tjukn;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    function utfoer(k) {
        switch (k.k) {
            case 'linje':
                strek(k.x1, k.y1, k.x2, k.y2, k.farge, k.tjukn);
                skilpadde = { x: k.x2, y: k.y2, v: skilpadde ? skilpadde.v : 0,
                              synleg: skilpadde ? skilpadde.synleg : true };
                break;

            case 'prikk':
                harInnhald = true;
                ctx.beginPath();
                ctx.arc(px(k.x), py(k.y), k.r, 0, Math.PI * 2);
                ctx.fillStyle = k.farge;
                ctx.fill();
                break;

            case 'fyll':
                harInnhald = true;
                ctx.beginPath();
                k.punkt.forEach(([x, y], i) => i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)));
                ctx.closePath();
                ctx.fillStyle = k.farge;
                ctx.fill();
                break;

            case 'skriv':
                harInnhald = true;
                ctx.fillStyle = k.farge;
                ctx.font = `${k.storleik}px system-ui, sans-serif`;
                ctx.textAlign = k.justering === 'center' ? 'center'
                    : k.justering === 'right' ? 'right' : 'left';
                ctx.fillText(k.tekst, px(k.x), py(k.y));
                break;

            case 'bakgrunn':
                harInnhald = true;
                ctx.fillStyle = k.farge;
                ctx.fillRect(0, 0, lerret.clientWidth, lerret.clientHeight);
                break;

            case 'skilpadde':
                skilpadde = { x: k.x, y: k.y, v: k.v, synleg: k.synleg };
                if (typeof k.fart === 'number') fart = k.fart;
                break;

            case 'tøm':
                ctx.clearRect(0, 0, lerret.width, lerret.height);
                harInnhald = false;
                break;
        }
    }

    /* Markøren blir teikna oppå, og viska ut att ved neste bilete, så han
     * ikkje blir liggjande att som eit spor i sjølve teikninga. */
    let markorLag = null;

    /* Legg tilbake pikslane som låg under markøren.
     *
     * Dette MÅ gjerast før det blir teikna noko nytt. Gjer ein det etterpå,
     * viskar tilbakelegginga ut strekar som er teikna innanfor det same vesle
     * området — og ved låg fart flyttar pennen seg berre nokre få pikslar per
     * bilete, altså midt inni der markøren stod. Resultatet er ei skilpadde
     * som går rundt utan å leggje att spor. */
    function fjernMarkor() {
        if (!markorLag) return;
        ctx.putImageData(markorLag.data, markorLag.x, markorLag.y);
        markorLag = null;
    }

    function teiknSkilpadde() {
        fjernMarkor();
        if (!skilpadde || !skilpadde.synleg) return;

        const dpr = window.devicePixelRatio || 1;
        const x = px(skilpadde.x), y = py(skilpadde.y);
        const r = 14;
        const bx = Math.max(0, Math.round((x - r) * dpr));
        const by = Math.max(0, Math.round((y - r) * dpr));
        const bw = Math.min(lerret.width - bx, Math.round(r * 2 * dpr));
        const bh = Math.min(lerret.height - by, Math.round(r * 2 * dpr));
        if (bw <= 0 || bh <= 0) return;

        markorLag = { data: ctx.getImageData(bx, by, bw, bh), x: bx, y: by };

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-skilpadde.v * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, -6);
        ctx.closePath();
        ctx.fillStyle = '#1f9d55';
        ctx.strokeStyle = '#0b3d24';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /* ---- matplotlib ------------------------------------------------- */

    function visBilete(base64) {
        const img = document.createElement('img');
        img.className = 'orm-plott';
        img.alt = 'Figur frå matplotlib';
        img.src = 'data:image/png;base64,' + base64;
        biletboks.appendChild(img);
        vis();
    }

    /* Seier frå til appen om at panelet må visast — det står skjult til
     * programmet faktisk lagar noko som skal dit. */
    function vis() {
        onEndra?.();
    }

    return { init, tom, leggTil, visBilete, tilpassStorleik };
})();
