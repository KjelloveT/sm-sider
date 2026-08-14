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

    let lerret, ctx, biletboks, tomtekst;
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
        tomtekst = el.tomtekst;
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
        spelar = false;
        skilpadde = null;
        harInnhald = false;
        if (ctx) ctx.clearRect(0, 0, lerret.width, lerret.height);
        if (biletboks) biletboks.textContent = '';
        if (tomtekst) tomtekst.hidden = false;
    }

    /* ---- turtle ---------------------------------------------------- */

    function leggTil(kommandoar) {
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
        ctx.save();
        while (kø.length) kjoer(kø.shift());
        ctx.restore();
        teiknSkilpadde();
    }

    document.addEventListener('visibilitychange', () => { if (!document.hidden) driv(); });

    function steg() {
        if (!kø.length) { spelar = false; teiknSkilpadde(); return; }

        // fart 0 tyder «så fort som råd» i turtle. Elles skalerer vi opp
        // talet på kommandoar per bilete, så fart 10 blir merkbart raskare
        // enn fart 1 utan at det tek eit sekund per strek.
        const perBilete = fart === 0 ? kø.length : Math.max(1, fart * fart);

        ctx.save();
        for (let i = 0; i < perBilete && kø.length; i++) kjoer(kø.shift());
        ctx.restore();

        teiknSkilpadde();
        requestAnimationFrame(steg);
    }

    function utfoer(k) {
        switch (k.k) {
            case 'linje':
                harInnhald = true;
                ctx.beginPath();
                ctx.moveTo(px(k.x1), py(k.y1));
                ctx.lineTo(px(k.x2), py(k.y2));
                ctx.strokeStyle = k.farge;
                ctx.lineWidth = k.tjukn;
                ctx.lineCap = 'round';
                ctx.stroke();
                skilpadde = { x: k.x2, y: k.y2, v: skilpadde ? skilpadde.v : 0, synleg: true };
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

    function teiknSkilpadde() {
        if (markorLag) {
            ctx.putImageData(markorLag.data, markorLag.x, markorLag.y);
            markorLag = null;
        }
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

    function vis() {
        if (tomtekst) tomtekst.hidden = true;
        onEndra?.();
    }

    return { init, tom, leggTil, visBilete, tilpassStorleik };
})();
