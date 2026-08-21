/* Bolkestokk — rettemotoren.
 *
 * Fire testtypar. Kvar test køyrer programmet PÅ NYTT frå eit ferskt tre og
 * ei fersk skilpadde. Det er same grunngjevinga som står i
 * ormritaren/py/_test.py: elles kan ein variabel eller ein strek frå test 1
 * gjere at test 2 går gjennom utan at programmet eigentleg er rett — og då
 * rettar vi feil svar til grønt, som er verre enn ikkje å rette i det heile.
 *
 *   maksBlokker  tel blokkene eleven har lagt ut
 *   teikning     samanliknar figuren med fasiten sin
 *   brukar       krev at ei bestemt blokk finst (eventuelt inni ei anna)
 *   svar         samanliknar det programmet skreiv ut
 *
 * `maksBlokker` er den viktigaste av dei. Utan henne løyser eleven ein
 * sekskant med seks par kopierte blokker og lærer ingenting om gjentaking.
 * «Teikn ein sekskant med høgst 5 blokker» ER leksjonen.
 *
 * Ingen DOM her. Fila blir lasta både av nettlesaren og av verifiser.mjs,
 * og den siste har ikkje noko document å halde seg til.
 */
const BolkTest = (function () {

    const NAMN = {
        maksBlokker: 'Talet på blokker',
        teikning: 'Figuren',
        brukar: 'Framgangsmåten',
        svar: 'Det som blir skrive ut'
    };

    /**
     * Køyr alle testane i ei oppgåve.
     * @returns {Array<{ok, tittel, melding, fekk, vent}>}
     */
    function sjekk(program, oppgave) {
        const testar = (oppgave && oppgave.testar) || [];
        if (!testar.length) return [{ ok: true, tittel: 'Ingen krav', melding: 'Denne oppgåva har ingen fasit — sjå på figuren din og døm sjølv.' }];
        return testar.map(t => eitt(program, t, oppgave));
    }

    function eitt(program, test, oppgave) {
        const tittel = NAMN[test.type] || 'Test';
        try {
            switch (test.type) {
                case 'maksBlokker': return maksBlokker(program, test, tittel);
                case 'brukar':      return brukar(program, test, tittel);
                case 'teikning':    return teikning(program, test, oppgave, tittel);
                case 'svar':        return svar(program, test, tittel);
                default:            return { ok: true, tittel, melding: 'Ukjend test — hoppa over.' };
            }
        } catch (f) {
            return { ok: false, tittel, melding: 'Testen klarte ikkje å køyre: ' + (f.message || f) };
        }
    }

    /* ---- 1. tal blokker ---------------------------------------------------- */

    function maksBlokker(program, test, tittel) {
        const n = BolkTre.tel(program);
        const tak = Number(test.vent);
        return {
            ok: n <= tak,
            tittel,
            fekk: n + (n === 1 ? ' blokk' : ' blokker'),
            vent: 'høgst ' + tak,
            melding: n <= tak ? null
                : 'Du har brukt ' + n + ' blokker, og oppgåva gjev deg ' + tak
                  + '. Er det noko du gjer fleire gonger etter kvarandre? Då kan ei '
                  + 'gjenta-blokk gjere jobben.'
        };
    }

    /* ---- 2. framgangsmåte --------------------------------------------------- */

    function brukar(program, test, tittel) {
        const finst = test.inni
            ? BolkTre.brukarInni(program, test.blokk, test.inni)
            : BolkTre.brukar(program, test.blokk);
        const def = BolkBlokkar.hent(test.blokk);
        const namn = def ? lesbart(def) : test.blokk;
        return {
            ok: finst,
            tittel,
            fekk: finst ? 'ja' : 'nei',
            vent: test.inni ? namn + ' inni ' + lesbart(BolkBlokkar.hent(test.inni)) : namn,
            melding: finst ? null
                : 'Oppgåva ber deg bruke «' + namn + '»'
                  + (test.inni ? ' inni «' + lesbart(BolkBlokkar.hent(test.inni)) + '»' : '') + '.'
        };
    }

    const lesbart = (def) => def
        ? def.tekst.map(d => typeof d === 'string' ? d : '…').join(' ').trim()
        : '';

    /* ---- 3. figuren ---------------------------------------------------------- */

    /**
     * Fasiten ligg som eit lagra program i oppgåva. Vi køyrer begge og
     * samanliknar streklistene.
     *
     * Rekkjefølgja tel: to figurar som ser like ut men er teikna i ulik
     * rekkjefølgje er ikkje same program, og eleven har som regel gjort noko
     * anna enn det oppgåva ba om når det skjer.
     */
    function teikning(program, test, oppgave, tittel) {
        const fasitData = test.fasit || (oppgave && oppgave.loeysing);
        if (!fasitData) return { ok: true, tittel, melding: 'Oppgåva manglar fasit — hoppa over.' };

        const mi = BolkTolk.koyrHeilt(BolkTre.kloneProgram(program));
        if (mi.feil) return { ok: false, tittel, melding: mi.feil };

        const fasit = BolkTolk.koyrHeilt(BolkTre.lesInn(fasitData));
        const a = mi.skilpadde.strek, b = fasit.skilpadde.strek;

        const ok = BolkSkilpadde.likeStrek(a, b, test.slingring);
        return {
            ok, tittel,
            fekk: a.length + (a.length === 1 ? ' strek' : ' strek'),
            vent: b.length + ' strek',
            melding: ok ? null : (a.length !== b.length
                ? 'Figuren din har ' + a.length + ' strek, fasiten har ' + b.length + '.'
                : 'Rett tal strek, men dei går ikkje same vegen. Sjå på lengdene og vinklane.')
        };
    }

    /* ---- 4. utskrift ---------------------------------------------------------- */

    function svar(program, test, tittel) {
        const r = BolkTolk.koyrHeilt(BolkTre.kloneProgram(program));
        if (r.feil) return { ok: false, tittel, melding: r.feil };

        const fekk = r.utskrift.join('\n').trim();
        const vent = String(test.vent).trim();

        /* Tal blir samanlikna som tal når begge er tal. Elles ville «60» og
         * «60.0» vore ulike svar, og det er dei ikkje for ein sjetteklassing. */
        const bt = Number(fekk), bv = Number(vent);
        const ok = (fekk !== '' && isFinite(bt) && isFinite(bv))
            ? Math.abs(bt - bv) <= (test.slingring || 0)
            : fekk === vent;

        return {
            ok, tittel,
            fekk: fekk === '' ? '(ingenting)' : fekk,
            vent,
            melding: ok ? null : null
        };
    }

    return { sjekk, NAMN };
})();
