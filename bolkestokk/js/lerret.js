/* Bolkestokk — teikneflata.
 *
 * Tek imot streklista frå skilpadda og set henne på eit canvas. All
 * geometri er alt gjord; her handlar det berre om å få henne synleg.
 *
 * To ting kostar meir kode enn dei ser ut til:
 *
 * 1. `--vanleg` penn kan ikkje vere ein fast farge. Canvas forstår ikkje
 *    CSS-variablar, så verdien må slåast opp med getComputedStyle når vi
 *    teiknar. Same knepet som tidvis/js/clock.js brukar for utskrift.
 *
 * 2. Figuren blir skalert til å passe. Ein sjetteklassing som skriv 500 i
 *    staden for 50 skal sjå figuren sin, ikkje ei tom rute — og då har han
 *    sjølv sjansen til å oppdage at talet var for stort.
 */
const BolkLerret = (function () {

    const KANT = 24;         // luft rundt figuren, i piksel
    const MAKS_SKALA = 3;    // ein liten figur skal fylle flata, men ikkje bli grynete

    let lerret = null, ctx = null;
    let siste = { strek: [], tilstand: null };

    function init(element) {
        lerret = element;
        ctx = lerret.getContext('2d');
        window.addEventListener('resize', () => teiknPaaNytt());
    }

    /** Fargen ein «vanleg» penn skal ha i det temaet som står no. */
    function vanlegFarge() {
        return getComputedStyle(document.body).getPropertyValue('--text').trim() || '#000';
    }

    /* Canvas har si eiga pikselstorleik uavhengig av CSS-storleiken. Utan
     * dette blir strekane uskarpe på alle skjermar med meir enn éin
     * einingspiksel — altså på alle nettbrett. */
    function maal() {
        const r = lerret.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (lerret.width !== Math.round(r.width * dpr) || lerret.height !== Math.round(r.height * dpr)) {
            lerret.width = Math.round(r.width * dpr);
            lerret.height = Math.round(r.height * dpr);
        }
        return { b: r.width, h: r.height, dpr };
    }

    function teikn(strek, tilstand) {
        siste = { strek: strek || [], tilstand: tilstand || null };
        teiknPaaNytt();
    }

    function teiknPaaNytt() {
        if (!ctx) return;
        const { b, h, dpr } = maal();

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, b, h);

        const strek = siste.strek;
        const vanleg = vanlegFarge();

        /* Skala og midtpunkt. Vi tek med skilpadda si eiga stilling i
         * omfanget: står ho langt utanfor teikninga (penn opp og av garde),
         * skal ho framleis vere å sjå. */
        const om = omfang(strek, siste.tilstand);
        let skala = 1, midtX = 0, midtY = 0;
        if (om) {
            const breidd = Math.max(1, om.x2 - om.x1);
            const hogd = Math.max(1, om.y2 - om.y1);
            skala = Math.min(MAKS_SKALA, (b - 2 * KANT) / breidd, (h - 2 * KANT) / hogd);
            if (!isFinite(skala) || skala <= 0) skala = 1;
            midtX = (om.x1 + om.x2) / 2;
            midtY = (om.y1 + om.y2) / 2;
        }

        // Til skjermkoordinatar: midtstill, skaler, og snu y (matematisk y peikar opp).
        const px = (x) => b / 2 + (x - midtX) * skala;
        const py = (y) => h / 2 - (y - midtY) * skala;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        strek.forEach(s => {
            ctx.beginPath();
            ctx.strokeStyle = BolkBlokkar.fargeHex(s.farge) || vanleg;
            ctx.lineWidth = Math.max(1, s.tjukn * Math.min(1, skala));
            ctx.moveTo(px(s.x1), py(s.y1));
            ctx.lineTo(px(s.x2), py(s.y2));
            ctx.stroke();
        });

        if (siste.tilstand) teiknSkilpadde(px, py, siste.tilstand, vanleg);
    }

    function omfang(strek, tilstand) {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        strek.forEach(s => {
            x1 = Math.min(x1, s.x1, s.x2); x2 = Math.max(x2, s.x1, s.x2);
            y1 = Math.min(y1, s.y1, s.y2); y2 = Math.max(y2, s.y1, s.y2);
        });
        if (tilstand) {
            x1 = Math.min(x1, tilstand.x); x2 = Math.max(x2, tilstand.x);
            y1 = Math.min(y1, tilstand.y); y2 = Math.max(y2, tilstand.y);
        }
        if (!isFinite(x1)) return null;
        // Ein figur utan utstrekning (eit einaste punkt) ville gjeve uendeleg skala.
        if (x2 - x1 < 1 && y2 - y1 < 1) return { x1: x1 - 50, y1: y1 - 50, x2: x2 + 50, y2: y2 + 50 };
        return { x1, y1, x2, y2 };
    }

    /* ---- skilpadda ------------------------------------------------------------
     *
     * Ho er eit sprite-ark: 24 rammer à 96px på ei stripe, bygd frå den
     * teikna GIF-en. Vi valde det framfor å leggje GIF-en rett inn av tre
     * grunnar. Ein GIF på 1,44 MB blir liggjande i historikka for alltid i
     * eit repo utan LFS. Ein GIF kan ikkje pausast når skilpadda står
     * stille. Og MP4-en har ingen alfakanal, så han hadde fått ein synleg
     * firkant rundt seg. Arket er 25 kB og løyser alle tre.
     *
     * Rammene går fram etter kor langt skilpadda har GÅTT, ikkje etter
     * klokka. Då padlar ho fortare når ho teiknar fort, ho står heilt
     * stille når programmet står stille, og luffene stemmer med farten
     * eleven sjølv har valt — utan ei einaste ekstra innstilling.
     */

    const ARK = '../_resources/bolkestokk-skilpadde.png';
    const RAMMER = 24;
    const RAMME_PX = 96;
    const VIS_PX = 46;              // storleik på skjermen
    const STEG_PER_RAMME = 14;      // teikneeiningar mellom kvar luffe-ramme

    /* Skilpadda er teikna med nasen 46 grader frå rett opp. Målt over alle
     * 69 GIF-rammene: retninga held seg mellom 44 og 53 grader, med sum
     * rotasjon 0 over syklusen — ho svaiar, ho spinn ikkje. Vi trekkjer frå
     * dei 46 så ho peikar dit ho faktisk går. */
    const NASE = 46;

    const bilete = new Image();
    let arkKlart = false;
    bilete.addEventListener('load', () => { arkKlart = true; teiknPaaNytt(); });
    bilete.src = ARK;

    function teiknSkilpadde(px, py, t, vanleg) {
        const x = px(t.x), y = py(t.y);
        const v = (t.vinkel - NASE) * Math.PI / 180;

        if (!arkKlart) return teiknTrekant(x, y, t, vanleg);

        const ramme = Math.abs(Math.floor((t.gaatt || 0) / STEG_PER_RAMME)) % RAMMER;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(v);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bilete, ramme * RAMME_PX, 0, RAMME_PX, RAMME_PX,
                      -VIS_PX / 2, -VIS_PX / 2, VIS_PX, VIS_PX);
        ctx.restore();
    }

    /* Reserve medan arket lastar, og om det skulle mangle. Ein trekant er
     * ikkje like triveleg, men han peikar rett — og det er det viktigaste
     * skilpadda gjer. */
    function teiknTrekant(x, y, t, vanleg) {
        const v = (t.vinkel - 90) * Math.PI / 180;
        const L = 13, B = 7;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(v);
        ctx.beginPath();
        ctx.moveTo(L, 0);
        ctx.lineTo(-B, B);
        ctx.lineTo(-B, -B);
        ctx.closePath();
        ctx.fillStyle = '#6FDE4F';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#111';
        ctx.stroke();
        ctx.restore();
    }

    function tom() { teikn([], null); }

    return { init, teikn, tom, teiknPaaNytt };
})();
