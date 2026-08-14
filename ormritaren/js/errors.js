/* Ormritaren — omsetjing av Python-feil til nynorsk.
 *
 * Forklaringa kjem OVER den ekte tracebacken, aldri i staden for han.
 * Elevar skal lære å lese verkelege feilmeldingar; dette er ei bru, ikkje ein erstatning.
 */
const OrmFeil = (function () {

    /* Mønster som lèt oss seie noko meir presist enn berre unntakstypen. */
    const PRESIST = [
        {
            type: 'NameError',
            re: /name '(.+?)' is not defined/,
            tekst: (m) => `Python kjenner ikkje til noko som heiter <code>${m[1]}</code>. ` +
                `Har du stava det likt overalt, eller gløymt å gje det ein verdi fyrst?`
        },
        {
            type: 'TypeError',
            re: /can only concatenate str \(not "(.+?)"\) to str/,
            tekst: (m) => `Du prøver å leggje eit tal (<code>${m[1]}</code>) saman med tekst med <code>+</code>. ` +
                `Gjer talet om til tekst fyrst: <code>str(talet)</code>.`
        },
        {
            type: 'TypeError',
            re: /unsupported operand type\(s\) for (.+?): '(.+?)' and '(.+?)'/,
            tekst: (m) => `Du kan ikkje bruke <code>${m[1]}</code> mellom <code>${m[2]}</code> og <code>${m[3]}</code>. ` +
                `Hugs at <code>input()</code> alltid gjev tekst — bruk <code>int(...)</code> om du vil rekne med det.`
        },
        {
            type: 'ValueError',
            re: /invalid literal for int\(\) with base 10: '(.*?)'/,
            tekst: (m) => `<code>${m[1] || '(tomt)'}</code> er ikkje eit heiltal, så <code>int()</code> greier ikkje gjere det om.`
        },
        {
            type: 'AttributeError',
            re: /'(.+?)' object has no attribute '(.+?)'/,
            tekst: (m) => `Ein <code>${m[1]}</code> har ingen <code>${m[2]}</code>. ` +
                `Sjekk stavinga, eller om variabelen inneheld det du trur.`
        },
        {
            type: 'IndexError',
            re: /list index out of range/,
            tekst: () => `Du ber om eit element som ligg utanfor lista. ` +
                `Hugs at fyrste element er nummer <code>0</code>, så ei liste med 3 element sluttar på <code>2</code>.`
        }
    ];

    /* Fallback per unntakstype. */
    const GENERELT = {
        SyntaxError: 'Python skjøner ikkje korleis linja er skriven. Sjå etter manglande <code>:</code> på slutten av <code>if</code>, <code>for</code> eller <code>def</code>, eller ein parentes som ikkje er lukka.',
        IndentationError: 'Innrykket stemmer ikkje. Alt som høyrer inn under ein <code>if</code>, <code>for</code> eller <code>def</code> må rykkjast like langt inn — bruk fire mellomrom.',
        TabError: 'Du har blanda tabulator og mellomrom i innrykket. Bruk berre mellomrom.',
        NameError: 'Du bruker eit namn Python ikkje kjenner att. Sjekk stavinga, eller om variabelen har fått ein verdi fyrst.',
        TypeError: 'Du bruker ein verdi på ein måte som ikkje passar til typen hans — til dømes reknar med tekst som om det var eit tal.',
        ValueError: 'Verdien har rett type, men feil innhald for det du prøver å gjere.',
        ZeroDivisionError: 'Du deler på null, og det går ikkje an i matematikken heller.',
        IndexError: 'Du ber om ein plass i lista som ikkje finst.',
        KeyError: 'Nøkkelen finst ikkje i ordboka. Sjekk stavinga, eller bruk <code>.get()</code> som gjev <code>None</code> i staden for feil.',
        AttributeError: 'Du bruker ein eigenskap eller metode som ikkje finst på denne typen.',
        ImportError: 'Biblioteket vart ikkje funne. Har du henta det inn under «Bibliotek» fyrst?',
        ModuleNotFoundError: 'Biblioteket finst ikkje i Ormritaren. Sjå under «Bibliotek» kva som er tilgjengeleg.',
        RecursionError: 'Ein funksjon kallar seg sjølv utan stopp. Sørg for at det finst eit tilfelle der han sluttar å kalle seg sjølv.',
        KeyboardInterrupt: 'Programmet vart stoppa.'
    };

    /**
     * @param {{type:string, melding:string, linje:number|null}} feil
     * @returns {string} HTML-trygg forklaring (inneheld berre <code> vi lagar sjølve)
     */
    function forklar(feil) {
        if (!feil) return '';
        for (const m of PRESIST) {
            if (m.type !== feil.type) continue;
            const treff = m.re.exec(feil.melding || '');
            if (treff) return m.tekst(treff.map(escapeHtml));
        }
        return GENERELT[feil.type] || 'Noko gjekk gale under køyringa.';
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return { forklar, escapeHtml };
})();
