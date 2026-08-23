/* Ormritaren — forslag medan eleven skriv.
 *
 * CodeMirror 5 har ingen ferdig Python-hjelpar, så denne er skriven for hand.
 * Det er ein fordel her: lista er kuratert for det elevane faktisk bruker, og
 * kvart forslag har ei kort forklaring på nynorsk. Ein generell hjelpar ville
 * drukna `forward` i tre hundre namn frå standardbiblioteket.
 *
 * Forslaga er ei hjelp til å hugse, ikkje ein fasit: vi fyller aldri inn noko
 * av oss sjølve (`completeSingle: false`), så eleven må alltid velje sjølv.
 */
const OrmForslag = (function () {

    const NØKKELORD = {
        'if': 'dersom', 'elif': 'elles dersom', 'else': 'elles',
        'for': 'gjenta for kvart element', 'while': 'gjenta så lenge',
        'def': 'lag ein funksjon', 'return': 'send tilbake ein verdi',
        'import': 'hent inn eit bibliotek', 'from': 'hent noko frå eit bibliotek',
        'in': 'er med i', 'not': 'ikkje', 'and': 'og', 'or': 'eller',
        'True': 'sant', 'False': 'usant', 'None': 'ingenting',
        'break': 'hopp ut av lykkja', 'continue': 'hopp til neste runde',
        'class': 'lag ein klasse', 'try': 'prøv', 'except': 'om det går gale',
        'finally': 'til slutt uansett', 'with': 'bruk og rydd opp',
        'as': 'gje eit anna namn', 'pass': 'gjer ingenting',
        'lambda': 'liten funksjon på éi linje', 'global': 'bruk variabel utanfrå'
    };

    const INNEBYGDE = {
        'print': 'skriv ut', 'input': 'spør brukaren om noko',
        'len': 'kor mange element', 'range': 'ei rekkje tal',
        'int': 'gjer om til heiltal', 'float': 'gjer om til desimaltal',
        'str': 'gjer om til tekst', 'bool': 'sant eller usant',
        'list': 'lag ei liste', 'dict': 'lag ei ordbok', 'set': 'lag ei mengd',
        'tuple': 'lag ein tuppel', 'sum': 'legg saman', 'min': 'minste',
        'max': 'største', 'abs': 'absoluttverdi', 'round': 'rund av',
        'sorted': 'sorter', 'reversed': 'snu rekkjefølgja',
        'enumerate': 'gjev både nummer og element', 'zip': 'para saman',
        'type': 'kva slag verdi er dette', 'open': 'opne ei fil',
        'format': 'set saman tekst'
    };

    /* Medlemmer per bibliotek. Kuratert — ikkje alt som finst, men det
     * elevane treng. */
    const MEDLEMMER = {
        turtle: {
            'forward': 'gå framover', 'backward': 'gå bakover',
            'right': 'snu til høgre', 'left': 'snu til venstre',
            'penup': 'løft pennen', 'pendown': 'sett ned pennen',
            'pencolor': 'farge på streken', 'fillcolor': 'farge å fylle med',
            'pensize': 'kor tjukk streken er', 'speed': 'kor fort ho går (0–10)',
            'goto': 'gå til eit punkt', 'circle': 'teikn ein sirkel',
            'dot': 'teikn ein prikk', 'write': 'skriv tekst',
            'begin_fill': 'start fylling', 'end_fill': 'avslutt fylling',
            'hideturtle': 'gøym skilpadda', 'showturtle': 'vis skilpadda',
            'home': 'tilbake til midten', 'clear': 'tøm teikninga',
            'reset': 'start heilt på nytt', 'position': 'kvar ho er',
            'heading': 'kva veg ho ser', 'bgcolor': 'bakgrunnsfarge',
            'setheading': 'sett retning', 'Turtle': 'lag ei ny skilpadde',
            'done': 'ferdig'
        },
        math: {
            'sqrt': 'kvadratrot', 'pi': '3,14159…', 'e': '2,71828…',
            'tau': '2π', 'inf': 'uendeleg',
            'sin': 'sinus', 'cos': 'cosinus', 'tan': 'tangens',
            'floor': 'rund ned', 'ceil': 'rund opp', 'pow': 'opphøgd i',
            'log': 'logaritme', 'radians': 'grader til radianar',
            'degrees': 'radianar til grader', 'fabs': 'absoluttverdi',
            'factorial': 'fakultet', 'gcd': 'største felles faktor',
            'dist': 'avstand mellom to punkt'
        },
        random: {
            'randint': 'tilfeldig heiltal frå og med a til og med b',
            'random': 'tilfeldig tal mellom 0 og 1',
            'choice': 'plukk eitt tilfeldig element',
            'choices': 'plukk fleire, kan gjenta',
            'shuffle': 'stokk om lista', 'sample': 'plukk fleire ulike',
            'uniform': 'tilfeldig desimaltal', 'randrange': 'tilfeldig frå ei rekkje',
            'seed': 'same tilfeldigheit kvar gong'
        },
        statistics: {
            'mean': 'gjennomsnitt', 'median': 'medianen',
            'mode': 'typetalet', 'stdev': 'standardavvik',
            'variance': 'varians'
        },
        plt: {
            'plot': 'teikn ein graf', 'bar': 'søylediagram',
            'barh': 'liggjande søyler', 'scatter': 'punktdiagram',
            'hist': 'histogram', 'pie': 'kakediagram',
            'title': 'overskrift', 'xlabel': 'tekst på x-aksen',
            'ylabel': 'tekst på y-aksen', 'legend': 'forklaring',
            'grid': 'rutenett', 'show': 'vis figuren',
            'figure': 'ny figur', 'xlim': 'grenser på x-aksen',
            'ylim': 'grenser på y-aksen', 'subplot': 'fleire figurar i eitt',
            'axis': 'still aksane', 'text': 'skriv tekst i figuren'
        },
        np: {
            'array': 'lag ein tabell', 'arange': 'rekkje med fast steg',
            'linspace': 'jamt fordelte tal', 'zeros': 'berre nullar',
            'ones': 'berre einarar', 'mean': 'gjennomsnitt', 'sum': 'sum',
            'max': 'største', 'min': 'minste', 'sqrt': 'kvadratrot',
            'sin': 'sinus', 'cos': 'cosinus', 'pi': '3,14159…',
            'round': 'rund av', 'sort': 'sorter', 'reshape': 'endre forma',
            'random': 'tilfeldige tal'
        }
    };

    /* Etter punktum på noko vi ikkje kjenner: dei metodane elevane oftast
     * er ute etter på tekst og lister. */
    const VANLEGE_METODAR = {
        'append': 'legg til bakarst', 'insert': 'set inn på ein plass',
        'remove': 'ta bort eit element', 'pop': 'ta ut siste',
        'sort': 'sorter lista', 'reverse': 'snu lista', 'count': 'tel opp',
        'index': 'kvar ligg elementet', 'clear': 'tøm', 'copy': 'lag ein kopi',
        'extend': 'legg til fleire',
        'upper': 'STORE BOKSTAVAR', 'lower': 'små bokstavar',
        'title': 'Stor Fyrste Bokstav', 'capitalize': 'stor fyrste bokstav',
        'strip': 'fjern mellomrom i endane', 'split': 'del opp i ei liste',
        'join': 'set saman til tekst', 'replace': 'byt ut', 'find': 'finn tekst',
        'startswith': 'byrjar med', 'endswith': 'sluttar med',
        'format': 'set inn verdiar', 'isdigit': 'er det berre siffer',
        'keys': 'nøklane i ordboka', 'values': 'verdiane', 'items': 'par av nøkkel og verdi',
        'get': 'hent verdi, eller None'
    };

    /* Alias frå koden: «import numpy as np» skal gje np-lista. */
    function lesAlias(kode) {
        const alias = {};
        const modulnamn = (m) => {
            if (m === 'matplotlib.pyplot') return 'plt';
            if (m === 'numpy') return 'np';
            return m;
        };

        // import x as y  /  import x.y as z
        for (const t of kode.matchAll(/^\s*import\s+([\w.]+)\s+as\s+(\w+)/gm)) {
            alias[t[2]] = modulnamn(t[1]);
        }
        // import x
        for (const t of kode.matchAll(/^\s*import\s+([\w.]+)\s*$/gm)) {
            const kort = t[1].split('.')[0];
            alias[kort] = modulnamn(t[1]) in MEDLEMMER ? modulnamn(t[1]) : kort;
        }
        // from matplotlib import pyplot as plt
        for (const t of kode.matchAll(/^\s*from\s+([\w.]+)\s+import\s+(\w+)\s+as\s+(\w+)/gm)) {
            alias[t[3]] = modulnamn(t[1] + '.' + t[2]);
        }
        // t = Turtle()  /  t = turtle.Turtle()
        for (const t of kode.matchAll(/(\w+)\s*=\s*(?:\w+\.)?Turtle\s*\(/g)) {
            alias[t[1]] = 'turtle';
        }
        return alias;
    }

    /* Alle ord i dokumentet, så eleven får forslag på sine eigne
     * variabel- og funksjonsnamn òg. */
    function ordIKoden(kode, utanom) {
        const sett = new Set();
        for (const t of kode.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
            if (t[0] !== utanom && t[0].length > 1) sett.add(t[0]);
        }
        return sett;
    }

    function lagForslag(namn, skildring, type) {
        return {
            text: namn,
            displayText: namn,
            className: 'orm-hint orm-hint-' + type,
            render(el) {
                const n = document.createElement('span');
                n.className = 'orm-hint-namn';
                n.textContent = namn;
                el.appendChild(n);
                if (skildring) {
                    const s = document.createElement('span');
                    s.className = 'orm-hint-skildring';
                    s.textContent = skildring;
                    el.appendChild(s);
                }
            }
        };
    }

    function hjelpar(cm) {
        const pos = cm.getCursor();
        const linje = cm.getLine(pos.line);
        const token = cm.getTokenAt(pos);

        // Ikkje foreslå inne i tekst eller kommentar — der er det berre i vegen.
        if (token.type === 'string' || token.type === 'comment') return null;

        const foer = linje.slice(0, pos.ch);
        const kode = cm.getValue();

        // Etter punktum: medlemmer av det som står føre punktumet.
        const etterPunktum = foer.match(/([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z0-9_]*)$/);
        if (etterPunktum) {
            const [, objekt, byrjing] = etterPunktum;
            const alias = lesAlias(kode);
            const nøkkel = MEDLEMMER[objekt] ? objekt : alias[objekt];
            const tabell = MEDLEMMER[nøkkel] || VANLEGE_METODAR;

            const treff = Object.entries(tabell)
                .filter(([n]) => n.toLowerCase().startsWith(byrjing.toLowerCase()))
                .map(([n, s]) => lagForslag(n, s, 'medlem'));

            if (!treff.length) return null;
            return {
                list: treff,
                from: CodeMirror.Pos(pos.line, pos.ch - byrjing.length),
                to: pos
            };
        }

        // Elles: nøkkelord, innebygde og ord frå koden.
        const ordet = (foer.match(/[A-Za-z_][A-Za-z0-9_]*$/) || [''])[0];
        if (!ordet) return null;

        const lav = ordet.toLowerCase();
        const passar = (n) => n.toLowerCase().startsWith(lav) && n !== ordet;
        const liste = [];
        const sett = new Set();

        const legg = (namn, skildring, type) => {
            if (sett.has(namn) || !passar(namn)) return;
            sett.add(namn);
            liste.push(lagForslag(namn, skildring, type));
        };

        Object.entries(NØKKELORD).forEach(([n, s]) => legg(n, s, 'nokkelord'));
        Object.entries(INNEBYGDE).forEach(([n, s]) => legg(n, s, 'innebygd'));

        // Modulnamn som faktisk er importerte
        Object.keys(lesAlias(kode)).forEach(n => legg(n, 'bibliotek', 'modul'));
        Object.keys(MEDLEMMER).forEach(n => legg(n, 'bibliotek', 'modul'));

        ordIKoden(kode, ordet).forEach(n => legg(n, '', 'ord'));

        if (!liste.length) return null;
        return {
            list: liste.slice(0, 40),
            from: CodeMirror.Pos(pos.line, pos.ch - ordet.length),
            to: pos
        };
    }

    /** Koplar automatiske forslag til ein editor. */
    function kople(cm) {
        const vis = () => cm.showHint({
            hint: hjelpar,
            completeSingle: false,   // fyll aldri inn av seg sjølv
            closeOnUnfocus: true
        });

        cm.on('inputRead', (_cm, endring) => {
            if (endring.origin !== '+input') return;
            const teikn = endring.text[0];
            if (teikn === '.') { vis(); return; }
            // Vent til to teikn: eitt teikn gjev for mykje støy.
            if (!/[A-Za-z_]/.test(teikn)) return;
            const pos = cm.getCursor();
            const ordet = (cm.getLine(pos.line).slice(0, pos.ch).match(/[A-Za-z_][A-Za-z0-9_]*$/) || [''])[0];
            if (ordet.length >= 2) vis();
        });

        return vis;
    }

    return { kople, hjelpar };
})();
