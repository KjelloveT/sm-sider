/* Bolkestokk — verifisering av innhaldet.
 *
 *   node bolkestokk/verifiser.mjs [modul]
 *
 * Skriptet brukar **den same rettemotoren som elevane**. Filene i js/ blir
 * lesne og evaluerte som dei er — ikkje skrivne om for Node. Ein kopi ville
 * før eller seinare kome i utakt med den ekte, og då hadde vi verifisert
 * noko anna enn det som faktisk køyrer. Same grunngjevinga som
 * verifiser_ormritaren.py gjev for å importere _test.py framfor å kopiere han.
 *
 * Det blir kontrollert at:
 *   1. kvar `loeysing` passerer sine eigne testar
 *   2. kvar `startProgram` FEILAR minst éin test — elles er oppgåva løyst
 *      på førehand, og eleven har ingenting å gjere
 *   3. kvar blokk ei oppgåve krev, ligg i paletten leksjonen opnar for.
 *      Ei oppgåve som treng ei blokk eleven ikkje har, er uløyseleg
 *   4. blokktaket er stramt: står det «høgst 5» og fasiten brukar 3, slepper
 *      ei utrulla løysing gjennom, og då gjer taket ingen nytte
 *   5. alle døme- og løypeprogram køyrer utan feil
 *   6. kvar leksjon har løype med mål og steg
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HER = path.dirname(fileURLToPath(import.meta.url));
const FILER = ['blokkar', 'tre', 'skilpadde', 'tolk', 'python', 'test'];

/* Motoren, lasta rått. `test.js` og resten rører ikkje DOM, nettopp for at
 * dette skal gå an. */
const kjelde = FILER.map(f => fs.readFileSync(path.join(HER, 'js', f + '.js'), 'utf8')).join('\n;\n');
const M = new Function(kjelde
    + '\nreturn {BolkBlokkar,BolkTre,BolkSkilpadde,BolkTolk,BolkPython,BolkTest};')();
const { BolkBlokkar, BolkTre, BolkTolk, BolkTest } = M;

let feil = 0, aatvaring = 0, sjekka = 0;

const FEIL = (kvar, kva) => { console.log('  FEIL     ' + kvar + ': ' + kva); feil++; };
const AATV = (kvar, kva) => { console.log('  ÅTVARING ' + kvar + ': ' + kva); aatvaring++; };

/* Blokktypane eit program faktisk brukar. */
function brukteBlokker(data) {
    const p = BolkTre.lesInn(data);
    return new Set(BolkTre.alle(p).map(n => n.type));
}

function koyrer(data) {
    try {
        const r = BolkTolk.koyrHeilt(BolkTre.lesInn(data));
        return r.feil;
    } catch (f) { return f.message || String(f); }
}

function sjekkModul(fil) {
    const modul = JSON.parse(fs.readFileSync(fil, 'utf8'));
    console.log('\n' + modul.tittel + ' (' + modul.leksjonar.length + ' leksjonar)');

    modul.leksjonar.forEach((l, i) => {
        const merke = 'leksjon ' + (i + 1) + ' «' + l.id + '»';
        const palett = new Set(l.palett || BolkBlokkar.idar());

        if (!l.kompetansemaal || !l.kompetansemaal.length) AATV(merke, 'ingen kompetansemål');
        if (!l.loype || !l.loype.steg || !l.loype.steg.length) FEIL(merke, 'manglar løype med steg');
        else if (!l.loype.maal) AATV(merke, 'løypa manglar mål');

        (l.palett || []).forEach(b => {
            if (!BolkBlokkar.hent(b)) FEIL(merke, 'paletten viser til blokka «' + b + '» som ikkje finst');
        });

        // Døme og løypesteg må køyre.
        if (l.doeme) {
            const f = koyrer(l.doeme.program);
            if (f) FEIL(merke + ' døme', f);
            utanforPaletten(merke + ' døme', l.doeme.program, palett);
        }
        (l.loype ? l.loype.steg : []).forEach((s, j) => {
            const f = koyrer(s.program);
            if (f) FEIL(merke + ' løypesteg ' + (j + 1), f);
            utanforPaletten(merke + ' løypesteg ' + (j + 1), s.program, palett);
        });

        (l.oppgaver || []).forEach(o => sjekkOppgave(o, merke, palett));
    });
}

function utanforPaletten(kvar, data, palett) {
    if (!data) return;
    [...brukteBlokker(data)].forEach(b => {
        if (!palett.has(b)) FEIL(kvar, 'brukar blokka «' + b + '» som ikkje ligg i paletten');
    });
}

function sjekkOppgave(o, leksjon, palett) {
    const merke = leksjon + ' / oppgåve «' + o.id + '»';
    sjekka++;

    if (o.type === 'les') return sjekkLes(o, merke);

    if (!o.testar || !o.testar.length) { AATV(merke, 'har ingen testar'); return; }
    if (!o.loeysing) { FEIL(merke, 'manglar løysingsforslag'); return; }

    // 1. Fasiten må passere sine eigne testar.
    const fasit = BolkTre.lesInn(o.loeysing);
    const r = BolkTest.sjekk(fasit, o);
    r.filter(x => !x.ok).forEach(x => {
        FEIL(merke, 'løysingsforslaget stryk på «' + x.tittel + '» — ' + (x.melding || (x.fekk + ' mot venta ' + x.vent)));
    });

    // 1b. Fasiten mot ei UAVHENGIG skildring av figuren.
    //
    // Punkt 1 over er sirkulært for `teikning`-testen: han samanliknar
    // elevens figur med `loeysing`, så fasiten blir samanlikna med seg sjølv
    // og kan aldri stryke. Ei oppgåve der teksten seier «sider på 100 steg»
    // medan fasiten teiknar 80, ville gått rett gjennom.
    //
    // `venta` er difor skriven for hand ut frå oppgåveteksten og geometrien,
    // ikkje rekna ut frå fasiten. Det er den andre kjelda som gjer sjekken
    // verd noko.
    if (o.venta) sjekkVenta(o, merke, fasit);
    else if ((o.testar || []).some(t => t.type === 'teikning')) {
        AATV(merke, 'har ein teikning-test, men ingen `venta` å måle fasiten mot');
    }

    // 3. Fasiten må vere bygd av blokker eleven har.
    utanforPaletten(merke + ' (fasit)', o.loeysing, palett);

    // 4. Er blokktaket stramt?
    const tak = o.testar.find(t => t.type === 'maksBlokker');
    if (tak) {
        const n = BolkTre.tel(fasit);
        if (n < tak.vent) {
            AATV(merke, 'taket er ' + tak.vent + ' blokker, men fasiten brukar ' + n
                + '. Slakken kan sleppe gjennom ei utrulla løysing.');
        }
    }

    // 2. Startprogrammet må FEILE.
    if (o.startProgram) {
        utanforPaletten(merke + ' (start)', o.startProgram, palett);
        const rs = BolkTest.sjekk(BolkTre.lesInn(o.startProgram), o);
        if (rs.every(x => x.ok)) {
            FEIL(merke, 'startprogrammet passerer alle testane — oppgåva er løyst på førehand');
        }
    }
}

/** Fasiten mot det oppgåveteksten lovar. Slingring på ein halv piksel. */
function sjekkVenta(o, merke, fasit) {
    const r = BolkTolk.koyrHeilt(fasit);
    if (r.feil) { FEIL(merke, 'løysingsforslaget feilar: ' + r.feil); return; }

    const sp = r.skilpadde;
    const v = o.venta;
    const naer = (a, b) => Math.abs(a - b) <= 0.5;

    if (v.strek !== undefined && sp.strek.length !== v.strek) {
        FEIL(merke, 'fasiten teiknar ' + sp.strek.length + ' strek, oppgåva seier ' + v.strek);
    }

    if (v.lukka !== undefined) {
        const t = sp.tilstand;
        const heimatt = Math.abs(t.x) <= 0.5 && Math.abs(t.y) <= 0.5;
        if (heimatt !== v.lukka) {
            FEIL(merke, v.lukka
                ? 'figuren skulle lukke seg, men skilpadda endar ' + Math.round(Math.hypot(t.x, t.y)) + ' steg frå start'
                : 'figuren skulle ikkje lukke seg, men skilpadda er tilbake ved start');
        }
    }

    const om = sp.omfang();
    if (om && (v.breidd !== undefined || v.hogd !== undefined)) {
        if (v.breidd !== undefined && !naer(om.x2 - om.x1, v.breidd)) {
            FEIL(merke, 'figuren er ' + (om.x2 - om.x1).toFixed(1) + ' brei, oppgåva seier ' + v.breidd.toFixed(1));
        }
        if (v.hogd !== undefined && !naer(om.y2 - om.y1, v.hogd)) {
            FEIL(merke, 'figuren er ' + (om.y2 - om.y1).toFixed(1) + ' høg, oppgåva seier ' + v.hogd.toFixed(1));
        }
    }
}

function sjekkLes(o, merke) {
    if (!o.alternativ || o.alternativ.length < 2) { FEIL(merke, 'for få alternativ'); return; }
    if (typeof o.rett !== 'number' || !o.alternativ[o.rett]) { FEIL(merke, 'ugyldig fasit'); return; }
    if (new Set(o.alternativ).size !== o.alternativ.length) FEIL(merke, 'to alternativ er like');
    if (!o.forklaring) AATV(merke, 'manglar forklaring');

    if (o.program) {
        const f = koyrer(o.program);
        if (f) FEIL(merke, 'programmet som skal lesast, feilar: ' + f);
    }

    /* Er svaret talet på strek, kan vi rekne det ut i staden for å tru på det.
     * Oppgåva må seie frå sjølv — vi gjettar ikkje på kva spørsmålet handlar om. */
    if (o.fasitFraStrek && o.program) {
        const n = BolkTolk.koyrHeilt(BolkTre.lesInn(o.program)).skilpadde.strek.length;
        if (String(n) !== String(o.alternativ[o.rett])) {
            FEIL(merke, 'fasiten seier ' + o.alternativ[o.rett] + ' strek, men programmet teiknar ' + n);
        }
    }
}

/* ---- køyr ------------------------------------------------------------------ */

const bedt = process.argv[2];
const katalog = JSON.parse(fs.readFileSync(path.join(HER, 'moduler', 'index.json'), 'utf8'));
const modular = katalog.modular.filter(m => m.klar !== false && (!bedt || m.id === bedt));

if (!modular.length) {
    console.log(bedt ? 'Fann ingen ferdig modul som heiter ' + bedt : 'Ingen ferdige modular.');
    process.exit(1);
}

modular.forEach(m => sjekkModul(path.join(HER, 'moduler', m.fil)));

console.log('\n' + sjekka + ' oppgåver kontrollerte.');
console.log(feil ? feil + ' feil, ' + aatvaring + ' åtvaringar.'
                 : 'Ingen feil. ' + aatvaring + ' åtvaringar.');
process.exit(feil ? 1 : 0);
