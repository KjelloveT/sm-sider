/* Ormritaren — lærarverktøy for å redigere oppgåvefilene.
 *
 * Sida er ikkje lenka til frå nokon stad. Ho les modulfilene, lèt læraren
 * endre tekst, kode og fasitar, og eksporterer resultatet — anten som heile
 * fila eller som eit lite endringssett som er lett å lime inn i ein samtale.
 *
 * Verdt å vite om to val her:
 *
 * Kodefelta er vanlege textarea, ikkje CodeMirror. Ein leksjon har opp mot
 * tretti kodefelt, og tretti editorinstansar er både tungt og fiklete. Det
 * som faktisk fangar feil i koden er «Sjekk oppgåvene», som køyrer alt
 * gjennom same rettemotoren elevane får — ikkje fargelegging.
 *
 * Testane blir redigerte som rå JSON. Eit skjema for kvar testtype ville
 * vore mykje kode for noko ein lærar sjeldan rører; prosa og kode er det
 * ein justerer. JSON-en blir validert medan du skriv, så ein skrivefeil
 * ikkje kan øydeleggje fila.
 */
const OrmRedigering = (function () {

    const LAGER = 'ormritaren-redigering';

    let katalog = null;
    let modulId = null;
    let original = null;     // slik fila ligg på tenaren
    let arbeid = null;       // slik læraren har endra henne
    let vald = 0;
    let pythonKlar = false;

    const el = {};

    const kopi = (x) => JSON.parse(JSON.stringify(x));
    const lik = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    /* ---- oppstart ------------------------------------------------------- */

    async function start() {
        [
            'modulVal', 'redStatus', 'sjekkKnapp', 'kopierKnapp', 'lastNedKnapp',
            'hentInnFelt', 'nullstillKnapp', 'redVarsel', 'sjekkPanel',
            'eksportPanel', 'eksportFelt', 'eksportHjelp', 'lukkEksport',
            'leksjonsliste', 'skjema'
        ].forEach(id => { el[id] = document.getElementById(id); });

        koplKnappar();

        try {
            katalog = await hentJson('moduler/index.json');
        } catch (feil) {
            return varsle('Klarte ikkje lese modulkatalogen: ' + feil.message);
        }

        katalog.modular.forEach(m => {
            const val = document.createElement('option');
            val.value = m.id;
            val.textContent = m.tittel;
            el.modulVal.appendChild(val);
        });

        const kladd = les_kladd();
        await opneModul(kladd ? kladd.modulId : katalog.modular[0].id, kladd);

        startPython();
    }

    async function hentJson(sti) {
        const svar = await fetch(sti);
        if (!svar.ok) throw new Error(`${sti} gav ${svar.status}`);
        return svar.json();
    }

    /** Python blir berre brukt av «Sjekk oppgåvene», så vi ventar ikkje på han. */
    function startPython() {
        OrmRunner.init({
            onKlar: () => { pythonKlar = true; oppdaterStatus(); },
            onOppstartsfeil: (m) => varsle('Python starta ikkje: ' + m
                + ' — du kan framleis redigere, men ikkje sjekke oppgåvene.')
        });
    }

    async function opneModul(id, kladd) {
        modulId = id;
        el.modulVal.value = id;
        const post = katalog.modular.find(m => m.id === id);

        try {
            original = await hentJson('moduler/' + post.fil);
        } catch (feil) {
            return varsle('Klarte ikkje lese ' + post.fil + ': ' + feil.message);
        }

        // Ein kladd gjeld berre den øya han vart laga for.
        arbeid = (kladd && kladd.modulId === id && kladd.arbeid)
            ? kladd.arbeid : kopi(original);

        vald = 0;
        teiknListe();
        teiknSkjema();
        oppdaterStatus();
    }

    /* ---- kladd i nettlesaren -------------------------------------------- */

    function lagre_kladd() {
        try {
            VyrdepilStorage.setGameState(LAGER, { modulId, arbeid });
        } catch (feil) {
            varsle('Klarte ikkje lagre kladden i nettlesaren. Last ned fila '
                 + 'så du ikkje mistar arbeidet.');
        }
    }

    function les_kladd() {
        try {
            return VyrdepilStorage.getGameState(LAGER);
        } catch (feil) {
            return null;
        }
    }

    /* ---- endringar ------------------------------------------------------ */

    function endra(i) {
        return !lik(original.leksjonar[i], arbeid.leksjonar[i]);
    }

    function talEndra() {
        return arbeid.leksjonar.filter((_, i) => endra(i)).length;
    }

    /** Kalla frå kvart felt. Held lista, statusen og kladden i takt. */
    function rort() {
        lagre_kladd();
        oppdaterStatus();
        teiknListe();
    }

    function oppdaterStatus() {
        const n = talEndra();
        const delar = [];
        delar.push(n === 0 ? 'Ingen endringar'
                 : n === 1 ? '1 leksjon endra' : `${n} leksjonar endra`);
        if (!pythonKlar) delar.push('Python startar …');
        el.redStatus.textContent = delar.join(' · ');
        el.redStatus.classList.toggle('orm-redstatus-endra', n > 0);
        el.sjekkKnapp.disabled = !pythonKlar;
    }

    function varsle(melding) {
        el.redVarsel.textContent = melding;
        el.redVarsel.hidden = !melding;
    }

    /* ---- leksjonslista -------------------------------------------------- */

    function teiknListe() {
        el.leksjonsliste.textContent = '';
        arbeid.leksjonar.forEach((l, i) => {
            const knapp = document.createElement('button');
            knapp.type = 'button';
            knapp.className = 'orm-redlistepost' + (i === vald ? ' aktiv' : '');
            knapp.setAttribute('aria-current', i === vald ? 'true' : 'false');

            const nr = document.createElement('span');
            nr.className = 'orm-redlistenr';
            nr.textContent = i + 1;
            knapp.appendChild(nr);

            const namn = document.createElement('span');
            namn.className = 'orm-redlistenamn';
            namn.textContent = l.tittel || l.id;
            knapp.appendChild(namn);

            if (endra(i)) {
                const prikk = document.createElement('span');
                prikk.className = 'orm-redprikk';
                prikk.setAttribute('aria-label', 'endra');
                knapp.appendChild(prikk);
            }

            knapp.addEventListener('click', () => {
                vald = i;
                teiknListe();
                teiknSkjema();
            });
            el.leksjonsliste.appendChild(knapp);
        });
    }

    /* ---- byggjeklossar for skjemaet ------------------------------------- */

    function bolk(tittel) {
        const s = document.createElement('section');
        s.className = 'box4 orm-panel orm-redbolk';
        const h = document.createElement('div');
        h.className = 'box-header orm-panel-topp';
        h.textContent = tittel;
        s.appendChild(h);
        const kropp = document.createElement('div');
        kropp.className = 'box-body';
        s.appendChild(kropp);
        s.kropp = kropp;
        return s;
    }

    function merkelapp(tekst, felt) {
        const l = document.createElement('label');
        l.className = 'orm-redfelt';
        const t = document.createElement('span');
        t.className = 'orm-redfelttittel';
        t.textContent = tekst;
        l.appendChild(t);
        l.appendChild(felt);
        return l;
    }

    /** Eittlinjes tekstfelt kopla til obj[noekkel]. */
    function tekstfelt(tittel, obj, noekkel) {
        const inn = document.createElement('input');
        inn.type = 'text';
        inn.className = 'orm-redinput';
        inn.value = obj[noekkel] || '';
        inn.addEventListener('input', () => { obj[noekkel] = inn.value; rort(); });
        return merkelapp(tittel, inn);
    }

    /** Fleirlinjes felt. `kode` gjev maskinskrift og Tab som innrykk. */
    function omraade(tittel, obj, noekkel, { kode = false, rader = 3 } = {}) {
        const ta = document.createElement('textarea');
        ta.className = 'orm-redomraade' + (kode ? ' orm-redkode' : '');
        ta.rows = rader;
        ta.spellcheck = !kode;
        ta.value = obj[noekkel] || '';
        ta.addEventListener('input', () => {
            obj[noekkel] = ta.value;
            voksTil(ta);
            rort();
        });
        if (kode) ta.addEventListener('keydown', tabInnrykk);
        requestAnimationFrame(() => voksTil(ta));
        return merkelapp(tittel, ta);
    }

    function voksTil(ta) {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight + 4, 900) + 'px';
    }

    /* Tab skal rykkje inn i eit kodefelt, ikkje hoppe vidare i skjemaet.
     * Shift+Tab hoppar framleis ut, så tastaturbrukarar ikkje blir fanga. */
    function tabInnrykk(e) {
        if (e.key !== 'Tab' || e.shiftKey) return;
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        ta.value = ta.value.slice(0, start) + '    ' + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = start + 4;
        ta.dispatchEvent(new Event('input'));
    }

    /** Liste av strengar, éi per linje. Brukt til kompetansemål og hint. */
    function linjeliste(tittel, obj, noekkel, hjelp) {
        const ta = document.createElement('textarea');
        ta.className = 'orm-redomraade';
        ta.rows = 3;
        ta.value = (obj[noekkel] || []).join('\n');
        ta.addEventListener('input', () => {
            obj[noekkel] = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
            voksTil(ta);
            rort();
        });
        requestAnimationFrame(() => voksTil(ta));
        const l = merkelapp(tittel, ta);
        if (hjelp) l.appendChild(sidenote(hjelp));
        return l;
    }

    function sidenote(tekst) {
        const p = document.createElement('p');
        p.className = 'orm-sidenote';
        OrmTekst.set(p, tekst);
        return p;
    }

    function knapperad(knappar) {
        const rad = document.createElement('div');
        rad.className = 'orm-redknapperad';
        knappar.forEach(({ tekst, ikon, ved, fare }) => {
            const k = document.createElement('button');
            k.type = 'button';
            k.className = 'btn orm-btn-liten' + (fare ? ' orm-btn-fare' : '');
            if (ikon && window.hydrateIcons) {
                const i = document.createElement('span');
                i.dataset.icon = ikon;
                k.appendChild(i);
            }
            k.appendChild(document.createTextNode(tekst));
            k.addEventListener('click', ved);
            rad.appendChild(k);
        });
        if (window.hydrateIcons) hydrateIcons(rad);
        return rad;
    }

    /** Flytt opp / flytt ned / slett for eit element i ei liste. */
    function listeknappar(liste, i, teiknPaaNytt) {
        return knapperad([
            { tekst: 'Opp', ikon: 'arrowUp', ved: () => {
                if (i === 0) return;
                [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
                rort(); teiknPaaNytt();
            }},
            { tekst: 'Ned', ikon: 'arrowDown', ved: () => {
                if (i === liste.length - 1) return;
                [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]];
                rort(); teiknPaaNytt();
            }},
            { tekst: 'Slett', ikon: 'trash2', fare: true, ved: () => {
                if (!confirm('Slette denne?')) return;
                liste.splice(i, 1);
                rort(); teiknPaaNytt();
            }}
        ]);
    }

    /* ---- sjølve skjemaet ------------------------------------------------ */

    function teiknSkjema() {
        const l = arbeid.leksjonar[vald];
        el.skjema.textContent = '';
        if (!l) return;

        const topp = document.createElement('p');
        topp.className = 'orm-redsteg';
        topp.textContent = `Leksjon ${vald + 1} av ${arbeid.leksjonar.length} · id: ${l.id}`;
        el.skjema.appendChild(topp);

        // --- om leksjonen
        const om = bolk('Om leksjonen');
        om.kropp.appendChild(tekstfelt('Tittel', l, 'tittel'));
        om.kropp.appendChild(linjeliste('Kompetansemål', l, 'kompetansemaal',
            'Eitt mål per linje. Blir vist til læraren øvst i leksjonen.'));
        om.kropp.appendChild(omraade('Oppsummering', l, 'oppsummering', { rader: 3 }));
        el.skjema.appendChild(om);

        el.skjema.appendChild(tekstbolk(l));
        el.skjema.appendChild(doemebolk(l));
        el.skjema.appendChild(loypebolk(l));
        el.skjema.appendChild(oppgavebolk(l));
    }

    /* Læreteksten — blokkene i rekkjefølgje. */
    function tekstbolk(l) {
        const b = bolk('Læretekst');
        l.tekst = l.tekst || [];

        const teikn = () => {
            liste.textContent = '';
            l.tekst.forEach((blokk, i) => {
                const rad = document.createElement('div');
                rad.className = 'orm-redelement';

                const val = document.createElement('select');
                val.className = 'orm-redvel';
                [['avsnitt', 'Avsnitt'], ['merk', 'Merk (utheva boks)'],
                 ['kode', 'Kodedøme'], ['punkt', 'Punktliste']].forEach(([v, t]) => {
                    const o = document.createElement('option');
                    o.value = v; o.textContent = t;
                    val.appendChild(o);
                });
                val.value = blokk.type;
                val.addEventListener('change', () => {
                    blokk.type = val.value;
                    rort(); teikn();
                });
                rad.appendChild(merkelapp('Type', val));

                if (blokk.type === 'kode') {
                    rad.appendChild(omraade('Kode', blokk, 'kode', { kode: true, rader: 5 }));
                } else if (blokk.type === 'punkt') {
                    rad.appendChild(linjeliste('Punkt', blokk, 'punkt', 'Eitt punkt per linje.'));
                } else {
                    rad.appendChild(omraade('Tekst', blokk, 'tekst', { rader: 3 }));
                }

                rad.appendChild(listeknappar(l.tekst, i, teikn));
                liste.appendChild(rad);
            });
        };

        const liste = document.createElement('div');
        b.kropp.appendChild(liste);
        b.kropp.appendChild(sidenote(
            'I tekst kan du bruke `**utheva**` og bakkar rundt `kodeord`. Ingen annan formatering.'));
        b.kropp.appendChild(knapperad([
            { tekst: 'Nytt avsnitt', ikon: 'plus', ved: () => {
                l.tekst.push({ type: 'avsnitt', tekst: '' }); rort(); teikn(); }},
            { tekst: 'Nytt kodedøme', ikon: 'plus', ved: () => {
                l.tekst.push({ type: 'kode', kode: '' }); rort(); teikn(); }}
        ]));
        teikn();
        return b;
    }

    function doemebolk(l) {
        const b = bolk('Prøv sjølv');
        l.doeme = l.doeme || { kode: '', oppmoding: '' };
        b.kropp.appendChild(omraade('Kode', l.doeme, 'kode', { kode: true, rader: 8 }));
        b.kropp.appendChild(omraade('Oppmoding', l.doeme, 'oppmoding', { rader: 2 }));
        return b;
    }

    function loypebolk(l) {
        const b = bolk('Løype');
        l.loype = l.loype || { tittel: '', maal: '', steg: [] };
        b.kropp.appendChild(tekstfelt('Tittel', l.loype, 'tittel'));
        b.kropp.appendChild(omraade('Mål — kva eleven byggjer', l.loype, 'maal', { rader: 2 }));

        const teikn = () => {
            liste.textContent = '';
            l.loype.steg.forEach((steg, i) => {
                const rad = document.createElement('div');
                rad.className = 'orm-redelement';
                const nr = document.createElement('p');
                nr.className = 'orm-redsteg';
                nr.textContent = 'Steg ' + (i + 1);
                rad.appendChild(nr);
                rad.appendChild(omraade('Forklaring', steg, 'tekst', { rader: 2 }));
                rad.appendChild(omraade('Heile koden på dette steget', steg, 'kode',
                    { kode: true, rader: 8 }));
                rad.appendChild(omraade('Prøv sjølv (valfritt)', steg, 'proev', { rader: 2 }));
                rad.appendChild(listeknappar(l.loype.steg, i, teikn));
                liste.appendChild(rad);
            });
        };

        const liste = document.createElement('div');
        b.kropp.appendChild(liste);
        b.kropp.appendChild(sidenote(
            'Kvart steg inneheld **heile** koden slik han skal sjå ut der — ikkje berre det nye. '
          + 'Dei nye linjene blir rekna ut ved å samanlikne med steget før.'));
        b.kropp.appendChild(knapperad([
            { tekst: 'Nytt steg', ikon: 'plus', ved: () => {
                const sist = l.loype.steg[l.loype.steg.length - 1];
                l.loype.steg.push({ tekst: '', kode: sist ? sist.kode : '' });
                rort(); teikn(); }}
        ]));
        teikn();
        return b;
    }

    function oppgavebolk(l) {
        const b = bolk('Oppgåver');
        l.oppgaver = l.oppgaver || [];

        const teikn = () => {
            liste.textContent = '';
            l.oppgaver.forEach((o, i) => {
                const rad = document.createElement('div');
                rad.className = 'orm-redelement orm-redoppgave';

                const merke = document.createElement('p');
                merke.className = 'orm-redsteg';
                merke.textContent = `Oppgåve ${i + 1} · ${o.type} · id: ${o.id}`;
                rad.appendChild(merke);

                if (o.type === 'les') {
                    rad.appendChild(omraade('Programmet eleven skal lese', o, 'kode',
                        { kode: true, rader: 7 }));
                    rad.appendChild(tekstfelt('Spørsmål', o, 'sporsmal'));
                    rad.appendChild(alternativfelt(o));
                    rad.appendChild(omraade('Forklaring etter svaret', o, 'forklaring',
                        { rader: 3 }));
                } else {
                    rad.appendChild(omraade('Oppgåvetekst', o, 'tekst', { rader: 3 }));
                    rad.appendChild(omraade('Startkode', o, 'startkode',
                        { kode: true, rader: 5 }));
                    rad.appendChild(linjeliste('Hint', o, 'hint',
                        'Eitt hint per linje. Eleven får dei eitt om gongen.'));
                    rad.appendChild(omraade('Løysing (fasit)', o, 'loeysing',
                        { kode: true, rader: 5 }));
                    rad.appendChild(testfelt(o));
                }

                rad.appendChild(listeknappar(l.oppgaver, i, teikn));
                liste.appendChild(rad);
            });
        };

        const liste = document.createElement('div');
        b.kropp.appendChild(liste);
        teikn();
        return b;
    }

    /** Svaralternativa til ei les-oppgåve, med radioknapp for fasiten. */
    function alternativfelt(o) {
        const boks = document.createElement('div');
        boks.className = 'orm-redfelt';
        const t = document.createElement('span');
        t.className = 'orm-redfelttittel';
        t.textContent = 'Svaralternativ — merk av for det rette';
        boks.appendChild(t);

        const teikn = () => {
            rader.textContent = '';
            (o.alternativ || []).forEach((tekst, i) => {
                const rad = document.createElement('div');
                rad.className = 'orm-redalternativ';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'fasit-' + o.id;
                radio.checked = o.rett === i;
                radio.setAttribute('aria-label', `Alternativ ${i + 1} er rett`);
                radio.addEventListener('change', () => { o.rett = i; rort(); });
                rad.appendChild(radio);

                const ta = document.createElement('textarea');
                ta.className = 'orm-redomraade orm-redkode';
                ta.rows = 1;
                ta.value = tekst;
                ta.addEventListener('input', () => {
                    o.alternativ[i] = ta.value; voksTil(ta); rort();
                });
                requestAnimationFrame(() => voksTil(ta));
                rad.appendChild(ta);

                const slett = document.createElement('button');
                slett.type = 'button';
                slett.className = 'btn orm-btn-liten orm-btn-fare';
                slett.textContent = 'Slett';
                slett.addEventListener('click', () => {
                    o.alternativ.splice(i, 1);
                    if (o.rett >= o.alternativ.length) o.rett = 0;
                    rort(); teikn();
                });
                rad.appendChild(slett);

                rader.appendChild(rad);
            });
        };

        const rader = document.createElement('div');
        boks.appendChild(rader);
        boks.appendChild(sidenote(
            'Det rette alternativet må vere **nøyaktig** det programmet skriv ut. '
          + 'Går utskrifta over fleire linjer, skal alternativet gjere det same.'));
        boks.appendChild(knapperad([
            { tekst: 'Nytt alternativ', ikon: 'plus', ved: () => {
                o.alternativ = o.alternativ || [];
                o.alternativ.push('');
                rort(); teikn(); }}
        ]));
        teikn();
        return boks;
    }

    /** Testane som rå JSON, validert medan du skriv. */
    function testfelt(o) {
        const ta = document.createElement('textarea');
        ta.className = 'orm-redomraade orm-redkode';
        ta.rows = 6;
        ta.spellcheck = false;
        ta.value = JSON.stringify(o.testar || [], null, 1);

        const melding = document.createElement('p');
        melding.className = 'orm-sidenote';

        const sjekk = () => {
            try {
                const nye = JSON.parse(ta.value);
                if (!Array.isArray(nye)) throw new Error('Testane må vere ei liste [ … ]');
                o.testar = nye;
                ta.classList.remove('orm-redfeil');
                melding.textContent = nye.length + ' testar.';
                rort();
            } catch (feil) {
                // Vi skriv ikkje til oppgåva før JSON-en er gyldig, så eit
                // halvskrive felt kan ikkje øydeleggje fila.
                ta.classList.add('orm-redfeil');
                melding.textContent = 'Ikkje gyldig JSON enno: ' + feil.message;
            }
        };
        ta.addEventListener('input', () => { voksTil(ta); sjekk(); });
        requestAnimationFrame(() => voksTil(ta));
        sjekk();

        const l = merkelapp('Testar', ta);
        l.appendChild(melding);
        l.appendChild(sidenote(
            'Typar: `kall` (fn, args, vent), `utskrift` (vent, stdin), '
          + '`naer` (fn/variabel, vent, slingring) og `inneheld` (vent, grunn).'));
        return l;
    }

    /* ---- sjekk mot rettemotoren ----------------------------------------- */

    async function sjekk() {
        if (!pythonKlar) return;
        el.sjekkKnapp.disabled = true;
        el.sjekkPanel.hidden = false;
        el.sjekkPanel.textContent = 'Sjekkar …';

        const problem = [];
        const aatvaringar = [];
        let talt = 0;

        for (const l of arbeid.leksjonar) {
            /* Kodedøme i læreteksten og «Prøv sjølv» blir køyrde, men eit
             * brot her er ei åtvaring og ikkje eit problem. Ein del bitar er
             * med vilje ufullstendige — dei held fram på eit døme lenger opp,
             * eller dei ventar på `input()` som ingen kan svare på her. */
            const bitar = [];
            (l.tekst || []).forEach((b, i) => {
                if (b.type === 'kode') bitar.push([`læretekst, kodedøme ${i + 1}`, b.kode]);
            });
            if (l.doeme?.kode) bitar.push(['Prøv sjølv', l.doeme.kode]);

            for (const [kvar, kode] of bitar) {
                talt++;
                const svar = await OrmRunner.test(kode, [{ type: 'koyrer' }]);
                const feila = svar.find(r => !r.ok);
                if (feila) {
                    aatvaringar.push({
                        kvar: `${l.tittel} · ${kvar}`,
                        kva: 'Koden køyrer ikkje åleine.',
                        melding: feila.melding
                    });
                }
            }

            for (const o of (l.oppgaver || [])) {
                if (o.type === 'les') {
                    talt++;
                    const fasit = (o.alternativ || [])[o.rett];
                    // Ei les-oppgåve kan ha svar på input() lagra i fila.
                    const svar = await OrmRunner.test(o.kode,
                        [{ type: 'utskrift', stdin: o.stdin,
                           vent: fasit === undefined ? '' : fasit }]);
                    const daarleg = svar.find(r => !r.ok);
                    // Nokre les-oppgåver spør kva slags feil koden gjev, ikkje
                    // kva han skriv ut. Då er fasiten namnet på unntaket.
                    const feiltypeSvarar = daarleg && daarleg.type
                        && String(fasit ?? '').trim() === daarleg.type;
                    if (daarleg && !feiltypeSvarar) {
                        problem.push({
                            kvar: `${l.tittel} · ${o.id}`,
                            kva: 'Fasiten stemmer ikkje med det programmet skriv ut.',
                            fekk: daarleg.fekk, vente: daarleg.vente,
                            melding: daarleg.melding
                        });
                    }
                } else {
                    talt++;
                    const fasit = await OrmRunner.test(o.loeysing, o.testar || []);
                    const feila = fasit.find(r => !r.ok);
                    if (feila) {
                        problem.push({
                            kvar: `${l.tittel} · ${o.id}`,
                            kva: 'Løysinga går ikkje gjennom testane.',
                            melding: feila.melding, fekk: feila.fekk, vente: feila.vente
                        });
                    }
                    // Ei oppgåve der startkoden alt er rett har ingen oppgåve i seg.
                    const start = await OrmRunner.test(o.startkode, o.testar || []);
                    if (start.length && start.every(r => r.ok)) {
                        problem.push({
                            kvar: `${l.tittel} · ${o.id}`,
                            kva: 'Startkoden går allereie gjennom alle testane — '
                               + 'då er det ingenting att å gjere for eleven.'
                        });
                    }
                }
            }

            /* Løypestega blir køyrde, men eit brot er ei åtvaring. Leksjonen
             * om feilmeldingar har med vilje kode som ikkje går, og eit steg
             * som spør etter `input()` kan ingen svare på her — det siste
             * hoppar vi difor heilt over. */
            for (const [i, steg] of (l.loype?.steg || []).entries()) {
                if (/\binput\s*\(/.test(steg.kode || '')) continue;
                talt++;
                const svar = await OrmRunner.test(steg.kode, [{ type: 'koyrer' }]);
                const feila = svar.find(r => !r.ok);
                if (feila) {
                    aatvaringar.push({
                        kvar: `${l.tittel} · løype steg ${i + 1}`,
                        kva: 'Koden køyrer ikkje.', melding: feila.melding
                    });
                }
            }
        }

        visSjekk(problem, aatvaringar, talt);
        el.sjekkKnapp.disabled = false;
    }

    function visSjekk(problem, aatvaringar, talt) {
        el.sjekkPanel.textContent = '';
        el.sjekkPanel.classList.toggle('orm-sjekk-feil', problem.length > 0);

        const h = document.createElement('p');
        h.className = 'orm-sjekktittel';
        h.textContent = problem.length === 0
            ? `Alt i orden — ${talt} sjekkar gjekk gjennom.`
            : `${problem.length} problem av ${talt} sjekkar.`;
        el.sjekkPanel.appendChild(h);

        problem.forEach(p => el.sjekkPanel.appendChild(sjekkpost(p)));

        if (aatvaringar.length) {
            const t = document.createElement('p');
            t.className = 'orm-sjekktittel orm-sjekkaatvaringstittel';
            t.textContent = `${aatvaringar.length} kodebitar køyrer ikkje åleine`;
            el.sjekkPanel.appendChild(t);

            el.sjekkPanel.appendChild(sidenote(
                'Dette er ikkje nødvendigvis feil. Eit døme som held fram på eit '
              + 'tidlegare døme, som ventar på `input()`, eller som er meint å '
              + 'vere øydelagt — som i leksjonen om feilmeldingar — hamnar her '
              + 'heilt naturleg. Sjå etter dei du ikkje kjenner att.'));

            aatvaringar.forEach(a => {
                const post = sjekkpost(a);
                post.classList.add('orm-sjekkaatvaring');
                el.sjekkPanel.appendChild(post);
            });
        }
    }

    function sjekkpost(p) {
        const boks = document.createElement('div');
        boks.className = 'orm-sjekkpost';

        const kvar = document.createElement('p');
        kvar.className = 'orm-sjekkkvar';
        kvar.textContent = p.kvar;
        boks.appendChild(kvar);

        const kva = document.createElement('p');
        kva.textContent = p.kva;
        boks.appendChild(kva);

        if (p.melding) {
            const m = document.createElement('p');
            m.className = 'orm-sjekkdetalj';
            m.textContent = p.melding;
            boks.appendChild(m);
        }
        if (p.fekk !== undefined || p.vente !== undefined) {
            const m = document.createElement('pre');
            m.className = 'orm-sjekkdetalj';
            m.textContent = `fekk:  ${p.fekk}\nvente: ${p.vente}`;
            boks.appendChild(m);
        }
        return boks;
    }

    /* ---- eksport -------------------------------------------------------- */

    function filtekst() {
        return JSON.stringify(arbeid, null, 2) + '\n';
    }

    function lastNed() {
        const post = katalog.modular.find(m => m.id === modulId);
        const blob = new Blob([filtekst()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = post.fil;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** Berre dei endra leksjonane — lite nok til å lime inn i ein samtale. */
    async function kopierEndringar() {
        const endra_leksjonar = arbeid.leksjonar.filter((_, i) => endra(i));
        if (!endra_leksjonar.length) {
            varsle('Du har ikkje endra noko i denne øya enno.');
            return;
        }

        const sett = {
            app: 'ormritaren',
            type: 'endringssett',
            modul: modulId,
            fil: 'ormritaren/moduler/' + katalog.modular.find(m => m.id === modulId).fil,
            leksjonar: endra_leksjonar
        };
        const tekst = JSON.stringify(sett, null, 1);

        el.eksportPanel.hidden = false;
        el.eksportFelt.value = tekst;
        el.eksportHjelp.textContent =
            `${endra_leksjonar.length} endra leksjon(ar). Teksten er kopiert — `
          + 'lim han inn der du vil ha endringane lagde inn. Gjekk ikkje kopieringa, '
          + 'kan du merke alt i feltet under og kopiere sjølv.';
        el.eksportFelt.focus();
        el.eksportFelt.select();

        try {
            await navigator.clipboard.writeText(tekst);
        } catch (feil) {
            el.eksportHjelp.textContent =
                `${endra_leksjonar.length} endra leksjon(ar). Nettlesaren ville ikkje `
              + 'kopiere av seg sjølv — teksten er merkt, så trykk Ctrl + C (eller Cmd + C).';
        }
        varsle('');
    }

    function hentInn(fil) {
        const lesar = new FileReader();
        lesar.onload = () => {
            let inn;
            try {
                inn = JSON.parse(lesar.result);
            } catch (feil) {
                return varsle('Fila er ikkje gyldig JSON: ' + feil.message);
            }

            if (inn.type === 'endringssett') {
                if (inn.modul !== modulId) {
                    return varsle(`Endringssettet gjeld øya «${inn.modul}», `
                                + `men du har «${modulId}» open.`);
                }
                let treff = 0;
                inn.leksjonar.forEach(ny => {
                    const i = arbeid.leksjonar.findIndex(l => l.id === ny.id);
                    if (i >= 0) { arbeid.leksjonar[i] = ny; treff++; }
                });
                varsle(`Henta inn ${treff} leksjon(ar) frå endringssettet.`);
            } else if (Array.isArray(inn.leksjonar)) {
                if (inn.id !== modulId) {
                    return varsle(`Fila er øya «${inn.id}», men du har «${modulId}» open.`);
                }
                arbeid = inn;
                varsle('Henta inn heile fila.');
            } else {
                return varsle('Fann verken ei modulfil eller eit endringssett i fila.');
            }

            vald = 0;
            rort();
            teiknSkjema();
        };
        lesar.readAsText(fil);
    }

    function nullstill() {
        if (!confirm('Kaste alle endringane du har gjort i denne øya?')) return;
        arbeid = kopi(original);
        vald = 0;
        el.sjekkPanel.hidden = true;
        varsle('');
        rort();
        teiknSkjema();
    }

    /* ---- knappar -------------------------------------------------------- */

    function koplKnappar() {
        el.modulVal.addEventListener('change', () => {
            if (talEndra() > 0 &&
                !confirm('Du har endringar som ikkje er eksporterte. Byte øy likevel?')) {
                el.modulVal.value = modulId;
                return;
            }
            el.sjekkPanel.hidden = true;
            opneModul(el.modulVal.value, null);
        });

        el.sjekkKnapp.addEventListener('click', sjekk);
        el.lastNedKnapp.addEventListener('click', lastNed);
        el.kopierKnapp.addEventListener('click', kopierEndringar);
        el.nullstillKnapp.addEventListener('click', nullstill);
        el.lukkEksport.addEventListener('click', () => { el.eksportPanel.hidden = true; });
        el.hentInnFelt.addEventListener('change', (e) => {
            const fil = e.target.files[0];
            if (fil) hentInn(fil);
            e.target.value = '';
        });

        // Ein lærar som har halde på ei stund skal ikkje miste alt på refresh.
        window.addEventListener('beforeunload', (e) => {
            if (talEndra() === 0) return;
            e.preventDefault();
            e.returnValue = '';
        });
    }

    document.addEventListener('DOMContentLoaded', start);

    return { sjekk };
})();
