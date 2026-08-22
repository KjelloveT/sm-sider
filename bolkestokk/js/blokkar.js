/* Bolkestokk — blokkatalogen.
 *
 * Kvar blokk er eitt dataobjekt. Editoren, tolken og Python-omsetjaren les
 * alle herifrå, og ingen av dei har si eiga liste over kva blokker som finst.
 * Det er heile poenget: ein ny modul — rutenett-robot, terningkast, tabellar —
 * skal vere ei utviding av desse dataa, ikkje ny motorkode.
 *
 * Felt i ein definisjon:
 *   id        nøkkelen som ligg i lagra program. Endrar du han, brotnar
 *             gamle program og alle fasitane i moduler/*.json.
 *   form      'hatt'    — toppen av ein stabel, kan ikkje ligge inni noko
 *             'setning' — vanleg blokk i ein stabel
 *             'krop'    — setning som har ein stabel inni seg (gjenta)
 *             'verdi'   — kan berre ligge i eit verdi-hol
 *   tekst     orda og hola, i den rekkjefølgja dei skal lesast
 *   koyr      generator: gjer arbeidet. Han treng ikkje yield sjølv —
 *             koyrNode() varslar blokka før han kallar han, og det
 *             varselet ER steget. Berre blokker som inneheld andre
 *             blokker (gjenta, Bruk) gjev vidare med yield*.
 *   verdi     rein funksjon: reknar ut ein verdi. Berre for form 'verdi'.
 *   python    lagar ei lesbar Python-linje
 *
 * Hola i `tekst` er objekt:
 *   { felt:'lengd', slag:'tal', standard:100 }   tal, kan bytast med verdiblokk
 *   { felt:'op', slag:'val', val:[...] }         nedtrekksliste
 */
const BolkBlokkar = (function () {

    /* Farge på pennen.
     *
     * «Vanleg» er ikkje ein fast farge: han blir slått opp i --text når
     * teikninga skjer, slik at streken er synleg i alle 21 tema. Dei andre
     * er faste — ei teikning er elevens innhald, ikkje UI-krom, og då skal
     * ho sjå lik ut same kva tema maskina står i. Alle seks er valde så dei
     * held mot både lys og mørk bakgrunn. */
    const FARGAR = [
        { verdi: 'vanleg',  tekst: 'vanleg',  hex: null,      py: 'black'  },
        { verdi: 'raud',    tekst: 'raud',    hex: '#e11d48', py: 'red'    },
        { verdi: 'blaa',    tekst: 'blå',     hex: '#2563eb', py: 'blue'   },
        { verdi: 'groen',   tekst: 'grøn',    hex: '#16a34a', py: 'green'  },
        { verdi: 'gul',     tekst: 'gul',     hex: '#eab308', py: 'gold'   },
        { verdi: 'lilla',   tekst: 'lilla',   hex: '#9333ea', py: 'purple' },
        { verdi: 'oransje', tekst: 'oransje', hex: '#ea580c', py: 'orange' }
    ];

    /* Rekneartane. Dei ligg i éi blokk med nedtrekksliste framfor fem
     * separate blokker: paletten til ein sjetteklassing skal vere kort nok
     * til å sjåast utan å rulle. */
    const REKNEARTAR = [
        { verdi: 'pluss', tekst: '+',               py: '+', gjer: (a, b) => a + b },
        { verdi: 'minus', tekst: '−',          py: '-', gjer: (a, b) => a - b },
        { verdi: 'gonge', tekst: '×',          py: '*', gjer: (a, b) => a * b },
        { verdi: 'dele',  tekst: '÷',          py: '/', gjer: (a, b) => b === 0 ? 0 : a / b },
        { verdi: 'rest',  tekst: 'rest ved deling', py: '%', gjer: (a, b) => b === 0 ? 0 : a % b }
    ];

    /* Blokkfargane.
     *
     * Faste verdiar, ikkje temavariablar. Ei blokk er fylt med fargen sin og
     * har svart tekst og svart ramme oppå, og då må fargen vere kjend på
     * førehand for at kontrasten skal vere det. Alle sju er lyse nok til at
     * #111 held minst 7,3:1 mot dei — målt. Det er den motsette løysinga av
     * den AGENTS.md §3.2 skisserer (fargen ved sida av teksten), men han
     * held same krav, og han er den som gjer blokkene til blokker.
     *
     * Verdiane er henta ordrett frå fargeprofilen i Block Coding UI-mockupen. */
    const FARGAR_BLOKK = {
        gaa:   '#8CC2FF',   // gå og flytt
        snu:   '#2FD4C4',   // snu
        penn:  '#FF6FB5',   // penn og farge
        lokke: '#FFB833',   // gjenta
        tal:   '#FFC93C',   // tal, rekning og utskrift
        boks:  '#FF7A45',   // variablar
        mi:    '#CBAAFF',   // eigne kommandoar
        start: '#FFDD57'    // hattar
    };

    const KATEGORIAR = [
        { id: 'styring',   tittel: 'Styring',          farge: 'lokke' },
        { id: 'skilpadde', tittel: 'Skilpadda',        farge: 'gaa'   },
        { id: 'verdi',     tittel: 'Tal og rekning',   farge: 'tal'   },
        { id: 'variabel',  tittel: 'Variablar',        farge: 'boks'  },
        { id: 'kommando',  tittel: 'Eigne kommandoar', farge: 'mi'    }
    ];

    const DEF = [

        /* ---- styring ---------------------------------------------------- */
        {
            id: 'start', farge: 'start', ikon: 'flag', kategori: 'styring', form: 'hatt',
            tekst: ['Når eg trykkjer Køyr'],
            python: () => null
        },
        {
            id: 'gjenta', farge: 'lokke', ikon: 'refreshCw', kategori: 'styring', form: 'krop',
            tekst: ['Gjenta', { felt: 'tal', slag: 'tal', standard: 4 }, 'gonger'],
            /* Taket på 1000 er ikkje ei tryggleiksgrense — utan medan-løkke kan
             * eit program uansett ikkje henge. Det er for å hindre at ein elev
             * som skriv 100000 i farta trur maskina er øydelagd. */
            koyr: function* (node, ktx, hj) {
                const n = Math.min(1000, Math.max(0, Math.round(hj.verdi(node.felt.tal, ktx))));
                for (let i = 0; i < n; i++) yield* hj.koyrStabel(node.kropp || [], ktx);
            },
            python: (f, hj) => 'for i in range(' + hj.uttrykk(f.tal) + '):'
        },

        /* ---- skilpadda -------------------------------------------------- */
        {
            id: 'framover', farge: 'gaa', ikon: 'arrowUp', kategori: 'skilpadde', form: 'setning',
            tekst: ['Gå framover', { felt: 'lengd', slag: 'tal', standard: 100, steg: 10 }, 'steg'],
            koyr: function* (node, ktx, hj) { ktx.skilpadde.gaa(hj.verdi(node.felt.lengd, ktx)); },
            python: (f, hj) => 'forward(' + hj.uttrykk(f.lengd) + ')'
        },
        {
            id: 'bakover', farge: 'gaa', ikon: 'arrowDown', kategori: 'skilpadde', form: 'setning',
            tekst: ['Gå bakover', { felt: 'lengd', slag: 'tal', standard: 50, steg: 10 }, 'steg'],
            koyr: function* (node, ktx, hj) { ktx.skilpadde.gaa(-hj.verdi(node.felt.lengd, ktx)); },
            python: (f, hj) => 'backward(' + hj.uttrykk(f.lengd) + ')'
        },
        {
            id: 'snuHogre', farge: 'snu', ikon: 'rotateCw', kategori: 'skilpadde', form: 'setning',
            tekst: ['Snu høgre', { felt: 'grader', slag: 'tal', standard: 90, steg: 15 }, 'gradar'],
            koyr: function* (node, ktx, hj) { ktx.skilpadde.snu(hj.verdi(node.felt.grader, ktx)); },
            python: (f, hj) => 'right(' + hj.uttrykk(f.grader) + ')'
        },
        {
            id: 'snuVenstre', farge: 'snu', ikon: 'rotateCcw', kategori: 'skilpadde', form: 'setning',
            tekst: ['Snu venstre', { felt: 'grader', slag: 'tal', standard: 90, steg: 15 }, 'gradar'],
            koyr: function* (node, ktx, hj) { ktx.skilpadde.snu(-hj.verdi(node.felt.grader, ktx)); },
            python: (f, hj) => 'left(' + hj.uttrykk(f.grader) + ')'
        },
        {
            id: 'pennOpp', farge: 'penn', ikon: 'eraser', kategori: 'skilpadde', form: 'setning',
            tekst: ['Penn opp'],
            koyr: function* (node, ktx) { ktx.skilpadde.penn(false); },
            python: () => 'penup()'
        },
        {
            id: 'pennNed', farge: 'penn', ikon: 'pencil', kategori: 'skilpadde', form: 'setning',
            tekst: ['Penn ned'],
            koyr: function* (node, ktx) { ktx.skilpadde.penn(true); },
            python: () => 'pendown()'
        },
        {
            id: 'setFarge', farge: 'penn', ikon: 'palette', kategori: 'skilpadde', form: 'setning',
            tekst: ['Set farge til', { felt: 'farge', slag: 'val', val: FARGAR, standard: 'raud' }],
            koyr: function* (node, ktx) { ktx.skilpadde.setFarge(node.felt.farge); },
            python: (f) => {
                const v = FARGAR.find(x => x.verdi === f.farge) || FARGAR[0];
                return 'pencolor("' + v.py + '")';
            }
        },
        {
            id: 'setTjukn', farge: 'penn', ikon: 'sliders', kategori: 'skilpadde', form: 'setning',
            tekst: ['Set tjukn til', { felt: 'tjukn', slag: 'tal', standard: 3 }],
            koyr: function* (node, ktx, hj) { ktx.skilpadde.setTjukn(hj.verdi(node.felt.tjukn, ktx)); },
            python: (f, hj) => 'pensize(' + hj.uttrykk(f.tjukn) + ')'
        },
        {
            id: 'tilStart', farge: 'gaa', ikon: 'home', kategori: 'skilpadde', form: 'setning',
            tekst: ['Gå til start'],
            koyr: function* (node, ktx) { ktx.skilpadde.tilStart(); },
            /* Python sin turtle startar peikande mot høgre, så retninga
             * må setjast attende til opp. Fleire linjer ut av éi blokk. */
            python: () => ['penup()', 'goto(0, 0)', 'setheading(90)', 'pendown()']
        },

        /* ---- tal og rekning --------------------------------------------- */
        /* Det finst med vilje inga «tal»-blokk. Kvart tal-hòl har eit felt
         * eleven kan skrive rett i, så ei eiga blokk for å halde eit tal
         * ville vore ein omveg til det same — og ein blokk til i ein palett
         * som skal kunne sjåast utan å rulle. */
        {
            id: 'rekne', farge: 'tal', ikon: 'plus', kategori: 'verdi', form: 'verdi', namn: 'rekning',
            tekst: [
                { felt: 'a', slag: 'tal', standard: 360 },
                { felt: 'op', slag: 'val', val: REKNEARTAR, standard: 'dele' },
                { felt: 'b', slag: 'tal', standard: 6 }
            ],
            verdi: (f, ktx, hj) => {
                const art = REKNEARTAR.find(r => r.verdi === f.op) || REKNEARTAR[0];
                return art.gjer(hj.verdi(f.a, ktx), hj.verdi(f.b, ktx));
            },
            /* Parentes berre der han trengst. `right(360 / 6)` les betre enn
             * `right((360 / 6))`, men `2 * (3 + 4)` må ha han for å bety det
             * blokkene viser. */
            python: (f, hj) => {
                const art = REKNEARTAR.find(r => r.verdi === f.op) || REKNEARTAR[0];
                const led = (h) => {
                    const t = hj.uttrykk(h);
                    return (h && typeof h === 'object' && h.type === 'rekne') ? '(' + t + ')' : t;
                };
                return led(f.a) + ' ' + art.py + ' ' + led(f.b);
            }
        },
        {
            id: 'tilfeldig', farge: 'tal', ikon: 'shuffle', kategori: 'verdi', form: 'verdi',
            tekst: ['tilfeldig tal frå', { felt: 'fra', slag: 'tal', standard: 1 },
                    'til', { felt: 'til', slag: 'tal', standard: 6 }],
            verdi: (f, ktx, hj) => {
                const a = Math.round(hj.verdi(f.fra, ktx));
                const b = Math.round(hj.verdi(f.til, ktx));
                const laag = Math.min(a, b), hoeg = Math.max(a, b);
                return laag + Math.floor(ktx.tilfeldig() * (hoeg - laag + 1));
            },
            python: (f, hj) => 'randint(' + hj.uttrykk(f.fra) + ', ' + hj.uttrykk(f.til) + ')'
        },

        /* ---- variablar --------------------------------------------------- */
        {
            id: 'settVar', farge: 'boks', ikon: 'package', kategori: 'variabel', form: 'setning',
            tekst: ['Set', { felt: 'namn', slag: 'val', val: 'variablar', standard: 'lengd' },
                    'til', { felt: 'verdi', slag: 'tal', standard: 50, steg: 10 }],
            koyr: function* (node, ktx, hj) {
                ktx.variablar[node.felt.namn] = hj.verdi(node.felt.verdi, ktx);
            },
            python: (f, hj) => f.namn + ' = ' + hj.uttrykk(f.verdi)
        },
        {
            id: 'endreVar', farge: 'boks', ikon: 'plusCircle', kategori: 'variabel', form: 'setning',
            tekst: ['Endre', { felt: 'namn', slag: 'val', val: 'variablar', standard: 'lengd' },
                    'med', { felt: 'med', slag: 'tal', standard: 10, steg: 5 }],
            koyr: function* (node, ktx, hj) {
                const naa = ktx.variablar[node.felt.namn] || 0;
                ktx.variablar[node.felt.namn] = naa + hj.verdi(node.felt.med, ktx);
            },
            python: (f, hj) => f.namn + ' = ' + f.namn + ' + ' + hj.uttrykk(f.med)
        },
        {
            id: 'lesVar', farge: 'boks', ikon: 'package', kategori: 'variabel', form: 'verdi', namn: 'verdien i ein variabel',
            tekst: [{ felt: 'namn', slag: 'val', val: 'variablar', standard: 'lengd' }],
            verdi: (f, ktx) => ktx.variablar[f.namn] || 0,
            python: (f) => f.namn
        },

        /* ---- eigne kommandoar -------------------------------------------- */
        {
            id: 'lagKommando', farge: 'mi', ikon: 'sparkles', kategori: 'kommando', form: 'hatt',
            tekst: ['Lag kommandoen', { felt: 'namn', slag: 'tekst', standard: 'firkant' }],
            python: (f) => 'def ' + f.namn + '():'
        },
        {
            id: 'kallKommando', farge: 'mi', ikon: 'sparkle', kategori: 'kommando', form: 'setning',
            tekst: ['Bruk', { felt: 'namn', slag: 'val', val: 'kommandoar', standard: '' }],
            /* Djupna på 20 finst fordi ein kommando kan kalle seg sjølv. Det er
             * ikkje forbode — ein spiral laga med rekursjon er eit fint syn —
             * men utan grense ville det tømt stakken i staden for å seie frå. */
            koyr: function* (node, ktx, hj) {
                const kom = ktx.kommandoar[node.felt.namn];
                if (!kom) return;
                if (ktx.djupn >= 20) throw new Error('Kommandoen brukar seg sjølv for mange gonger.');
                ktx.djupn++;
                try { yield* hj.koyrStabel(kom, ktx); } finally { ktx.djupn--; }
            },
            python: (f) => f.namn + '()'
        },

        /* ---- utskrift ----------------------------------------------------- */
        {
            id: 'skrivUt', farge: 'tal', ikon: 'text', kategori: 'verdi', form: 'setning',
            tekst: ['Skriv ut', { felt: 'verdi', slag: 'tal', standard: 0 }],
            koyr: function* (node, ktx, hj) {
                ktx.utskrift.push(talTekst(hj.verdi(node.felt.verdi, ktx)));
            },
            python: (f, hj) => 'print(' + hj.uttrykk(f.verdi) + ')'
        }
    ];

    const KART = new Map(DEF.map(d => [d.id, d]));

    function hent(id) { return KART.get(id); }

    /** Hola i ei blokk, i lesest-rekkjefølgje. */
    function felt(id) {
        const def = hent(id);
        return (def ? def.tekst : []).filter(d => typeof d === 'object');
    }

    /** Standardverdiane for ei fersk blokk. */
    function standardFelt(id) {
        const ut = {};
        felt(id).forEach(f => { ut[f.felt] = f.standard !== undefined ? f.standard : 0; });
        return ut;
    }

    /* Tal blir viste utan unødige desimalar: 360/6 skal stå som «60», ikkje
     * «60.00000000000001». Seks desimalar er langt meir enn ein sjetteklassing
     * treng, og nok til at avrundingsstøy frå flyttal forsvinn. */
    function talTekst(n) {
        if (!isFinite(n)) return '0';
        return String(Math.round(n * 1e6) / 1e6);
    }

    /**
     * Blokka lesen som ei setning, med verdiane fylte inn:
     * «Gå framover 100 steg», «Gjenta 6 gonger».
     *
     * Brukt av stegmodus, som gjentek blokka ved sida av teikninga. Utan det
     * måtte eleven som følgjer skilpadda sjå bort på arbeidsbenken for kvart
     * steg — og då ser han ikkje streken bli teikna, som var heile poenget.
     */
    function lesbar(node) {
        const def = hent(node && node.type);
        if (!def) return '';
        return def.tekst.map(del => {
            if (typeof del === 'string') return del;
            const v = node.felt ? node.felt[del.felt] : undefined;

            // Eit hòl med ei verdiblokk i blir lese ut det òg.
            if (v && typeof v === 'object') return lesbar(v);

            if (del.slag === 'val') {
                const liste = Array.isArray(del.val) ? del.val : null;
                const treff = liste && liste.find(x => x.verdi === v);
                return treff ? treff.tekst : String(v === undefined ? '' : v);
            }
            return v === undefined || v === '' ? '…' : String(v);
        }).join(' ').replace(/\s+/g, ' ').trim();
    }

    function fargeHex(namn) {
        const f = FARGAR.find(x => x.verdi === namn);
        return (f || FARGAR[0]).hex;
    }

    return {
        DEF, KATEGORIAR, FARGAR, REKNEARTAR,
        hent, felt, standardFelt, talTekst, fargeHex, lesbar, FARGAR_BLOKK,
        idar: () => DEF.map(d => d.id)
    };
})();
