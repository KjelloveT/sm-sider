/* ══════════════════════════════════════════════
   FRØDEKAPP — Nettsjekk
   Finn ut kva eit nett slepp gjennom av det
   live-quizen treng: signalteneste, STUN og TURN
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    /* Open Relay er ei open TURN-testteneste. Vi brukar henne berre for å sjå
       kva portar nettet slepp gjennom — ikkje som leverandør. Legitimasjonen er
       den offentlege som alle brukar. */
    const TURN_TEST = {
        username: 'openrelayproject',
        credential: 'openrelayproject'
    };

    const TESTAR = [
        {
            id: 'ws-1',
            namn: 'Signalteneste — 1.peerjs.com',
            forklaring: 'WebSocket til den verten Frødekapp brukar først.',
            køyr: () => testWebSocket('wss://1.peerjs.com/peerjs?key=peerjs&id=' + tilfeldigId() + '&token=t&version=1.5.4')
        },
        {
            id: 'ws-0',
            namn: 'Signalteneste — 0.peerjs.com',
            forklaring: 'Reserveverten. Han har vore nede, så feil her er venta.',
            valfri: true,
            køyr: () => testWebSocket('wss://0.peerjs.com/peerjs?key=peerjs&id=' + tilfeldigId() + '&token=t&version=1.5.4')
        },
        {
            id: 'peer',
            namn: 'Opprette eit rom',
            forklaring: 'Same veg som live-quizen går: registrerer ein peer-id via signaltenesta.',
            køyr: testPeerRegistrering
        },
        {
            id: 'stun',
            namn: 'STUN over UDP 19302',
            forklaring: 'Finn den offentlege IP-adressa di. Feilar denne, er utgåande UDP stengd.',
            køyr: () => testIce(
                [{ urls: 'stun:stun.l.google.com:19302' }],
                'srflx',
                'all'
            )
        },
        {
            id: 'turn-udp',
            namn: 'TURN over UDP 3478',
            forklaring: 'Den raskaste vegen for ein hjelpetenar.',
            køyr: () => testIce(
                [Object.assign({ urls: 'turn:openrelay.metered.ca:80' }, TURN_TEST)],
                'relay',
                'relay'
            )
        },
        {
            id: 'turn-tcp',
            namn: 'TURN over TCP 443',
            forklaring: 'Går ut som vanleg vevtrafikk. Dette er det som plar koma gjennom strenge brannmurar.',
            køyr: () => testIce(
                [Object.assign({ urls: 'turns:openrelay.metered.ca:443?transport=tcp' }, TURN_TEST)],
                'relay',
                'relay'
            )
        },
        {
            id: 'relay-kanal',
            namn: 'Datakanal gjennom TURN',
            forklaring: 'Set opp ei ekte tilkopling som må gå via hjelpetenaren. Klarar denne seg, ville quizen kome fram.',
            køyr: testRelayDatakanal
        }
    ];

    let resultat = [];

    /* ── Testar ────────────────────────────────── */

    function tilfeldigId() {
        return 'sjekk' + Math.random().toString(36).slice(2, 10);
    }

    function testWebSocket(url) {
        return new Promise((ferdig) => {
            const t0 = Date.now();
            let ws;
            let svara = false;

            const svar = (ok, melding) => {
                if (svara) return;
                svara = true;
                clearTimeout(timer);
                try { if (ws) ws.close(); } catch (e) { /* ignorer */ }
                ferdig({ ok, melding, ms: Date.now() - t0 });
            };

            const timer = setTimeout(() => svar(false, 'Ikkje noko svar innan 12 sekund — trafikken blir truleg svelgd av eit filter.'), 12000);

            try {
                ws = new WebSocket(url);
            } catch (e) {
                return svar(false, 'Nettlesaren nekta å opne tilkoplinga: ' + e.message);
            }

            ws.onopen = () => svar(true, 'Tilkoplinga opna.');
            ws.onerror = () => svar(false, 'Tilkoplinga blei avvist.');
            ws.onclose = (e) => svar(false, 'Tilkoplinga blei lukka' + (e.code ? ' (kode ' + e.code + ')' : '') + '.');
        });
    }

    function testPeerRegistrering() {
        return new Promise((ferdig) => {
            const t0 = Date.now();
            let peer;
            let svara = false;

            const svar = (ok, melding) => {
                if (svara) return;
                svara = true;
                clearTimeout(timer);
                try { if (peer) peer.destroy(); } catch (e) { /* ignorer */ }
                ferdig({ ok, melding, ms: Date.now() - t0 });
            };

            const timer = setTimeout(() => svar(false, 'Fekk ingen peer-id innan 15 sekund.'), 15000);

            try {
                peer = new Peer(tilfeldigId(), FKPeerConfig.optionsFor(0));
            } catch (e) {
                return svar(false, 'Klarte ikkje starte: ' + e.message);
            }

            peer.on('open', (id) => svar(true, 'Fekk peer-id «' + id + '».'));
            peer.on('error', (err) => svar(false, 'Feil av typen «' + err.type + '».'));
        });
    }

    /**
     * Samlar ICE-kandidatar og ser om vi får den typen vi er ute etter.
     * @param {Array} iceServers
     * @param {string} ventaType - 'srflx' eller 'relay'
     * @param {string} policy - 'all' eller 'relay'
     */
    function testIce(iceServers, ventaType, policy) {
        return new Promise((ferdig) => {
            const t0 = Date.now();
            const funne = [];
            let pc;
            let svara = false;

            const svar = (ok, melding) => {
                if (svara) return;
                svara = true;
                clearTimeout(timer);
                try { if (pc) pc.close(); } catch (e) { /* ignorer */ }
                ferdig({ ok, melding, ms: Date.now() - t0, detaljar: funne });
            };

            const timer = setTimeout(() => {
                svar(false, funne.length
                    ? 'Fann ingen ' + ventaType + '-kandidat innan 12 sekund.'
                    : 'Fann ingen kandidatar i det heile innan 12 sekund.');
            }, 12000);

            try {
                pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: policy });
            } catch (e) {
                return svar(false, 'Nettlesaren støttar ikkje dette: ' + e.message);
            }

            pc.onicecandidate = (e) => {
                if (!e.candidate) {
                    // Innsamlinga er ferdig
                    if (!funne.some(k => k.type === ventaType)) {
                        svar(false, 'Innsamlinga blei ferdig utan nokon ' + ventaType + '-kandidat.');
                    }
                    return;
                }
                const c = e.candidate;
                funne.push({ type: c.type, protocol: c.protocol, port: c.port });
                if (c.type === ventaType) {
                    svar(true, 'Fekk ' + ventaType + '-kandidat over ' + (c.protocol || 'ukjend protokoll') + '.');
                }
            };

            pc.createDataChannel('sjekk');
            pc.createOffer()
                .then(o => pc.setLocalDescription(o))
                .catch(e => svar(false, 'Klarte ikkje starte innsamlinga: ' + e.message));
        });
    }

    /**
     * To tilkoplingar i same side som berre får lov å snakke via TURN.
     * Kjem datakanalen opp, ville quiz-trafikken òg kome fram.
     */
    function testRelayDatakanal() {
        return new Promise((ferdig) => {
            const t0 = Date.now();
            const iceServers = [
                Object.assign({ urls: 'turn:openrelay.metered.ca:80' }, TURN_TEST),
                Object.assign({ urls: 'turns:openrelay.metered.ca:443?transport=tcp' }, TURN_TEST)
            ];
            let a, b;
            let svara = false;

            const svar = (ok, melding) => {
                if (svara) return;
                svara = true;
                clearTimeout(timer);
                try { if (a) a.close(); } catch (e) { /* ignorer */ }
                try { if (b) b.close(); } catch (e) { /* ignorer */ }
                ferdig({ ok, melding, ms: Date.now() - t0 });
            };

            const timer = setTimeout(() => svar(false, 'Datakanalen kom ikkje opp innan 20 sekund.'), 20000);

            try {
                a = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
                b = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
            } catch (e) {
                return svar(false, 'Nettlesaren støttar ikkje dette: ' + e.message);
            }

            a.onicecandidate = (e) => { if (e.candidate) b.addIceCandidate(e.candidate).catch(() => {}); };
            b.onicecandidate = (e) => { if (e.candidate) a.addIceCandidate(e.candidate).catch(() => {}); };

            const kanal = a.createDataChannel('sjekk');
            kanal.onopen = () => svar(true, 'Datakanalen kom opp gjennom hjelpetenaren.');

            a.createOffer()
                .then(o => a.setLocalDescription(o))
                .then(() => b.setRemoteDescription(a.localDescription))
                .then(() => b.createAnswer())
                .then(s => b.setLocalDescription(s))
                .then(() => a.setRemoteDescription(b.localDescription))
                .catch(e => svar(false, 'Klarte ikkje setje opp tilkoplinga: ' + e.message));
        });
    }

    /* ── Vising ────────────────────────────────── */

    function lagRad(test) {
        const boks = document.createElement('div');
        boks.className = 'box1 mt-16';
        boks.id = 'rad-' + test.id;

        const tittel = document.createElement('h3');
        tittel.className = 'heading3 no-mt';
        tittel.textContent = test.namn;
        boks.appendChild(tittel);

        const forklaring = document.createElement('p');
        forklaring.className = 'nettsjekk-forklaring';
        forklaring.textContent = test.forklaring;
        boks.appendChild(forklaring);

        const status = document.createElement('p');
        status.className = 'nettsjekk-status';
        status.setAttribute('aria-live', 'polite');
        status.textContent = 'Ventar…';
        boks.appendChild(status);

        return { boks, status };
    }

    function visStatus(status, tilstand, tekst, ms) {
        status.dataset.tilstand = tilstand;
        const merke = tilstand === 'ok' ? '✔' : tilstand === 'feil' ? '✖' : '…';
        status.textContent = merke + ' ' + tekst + (typeof ms === 'number' ? ' (' + ms + ' ms)' : '');
    }

    function oppsummer() {
        const boks = document.getElementById('summary');
        const finn = (id) => resultat.find(r => r.id === id) || { ok: false };

        const signal = finn('ws-1').ok && finn('peer').ok;
        const udp = finn('stun').ok;
        const turnTcp = finn('turn-tcp').ok;
        const relay = finn('relay-kanal').ok;

        let tittel, tekst;

        if (!signal) {
            tittel = 'Vi kjem ikkje fram til signaltenesta';
            tekst = 'Maskinene får ikkje finne kvarandre i det heile, så live-quizen kjem ikkje i gang. Testen kan ikkje sjå skilnad på om nettet ditt sperrar tenesta, eller om tenesta sjølv avviser oss — begge delar peikar mot at vi bør køyre signaltenesta på vårt eige domene. Ei TURN-teneste hjelper ikkje mot dette åleine.';
        } else if (relay) {
            tittel = 'TURN vil løyse problemet her';
            tekst = 'Signaltenesta er open, og trafikken kjem fram gjennom ein hjelpetenar. Set vi opp TURN, vil live-quizen verke på dette nettet.';
        } else if (turnTcp) {
            tittel = 'TURN kjem gjennom, men datakanalen kom ikkje opp';
            tekst = 'Nettet slepp gjennom TURN over TCP 443, men testtilkoplinga blei ikkje fullført. Det kan vere testtenesta som er overbelasta — verdt å køyre testen ein gong til.';
        } else if (udp) {
            tittel = 'UDP er ope, men ingen hjelpetenar nådde fram';
            tekst = 'Direkte tilkopling mellom maskiner på same nett vil ofte gå bra her. Er elevane på eit anna nett enn læraren, trengst det TURN. Merk at TURN-testane brukar ei open testteneste vi ikkje kontrollerer — feilar dei, kan det like gjerne vere tenesta som er nede som at nettet ditt sperrar.';
        } else {
            tittel = 'Utgåande UDP er stengd';
            tekst = 'Direkte tilkopling er utelukka på dette nettet. Det einaste som vil verke er TURN over TCP/TLS på port 443 — og den kom ikkje gjennom i testen her. Testtenesta vi brukar er open og utan garantiar, så prøv gjerne ein gong til før vi konkluderer.';
        }

        boks.hidden = false;
        boks.textContent = '';
        boks.className = 'box2 mt-24';

        const h = document.createElement('h2');
        h.className = 'heading3 no-mt';
        h.textContent = tittel;
        boks.appendChild(h);

        const p = document.createElement('p');
        p.textContent = tekst;
        boks.appendChild(p);
    }

    function somTekst() {
        const linjer = [
            'Frødekapp nettsjekk',
            'Tidspunkt: ' + new Date().toISOString(),
            'Nettlesar: ' + navigator.userAgent,
            ''
        ];
        resultat.forEach(r => {
            linjer.push((r.ok ? 'OK   ' : 'FEIL ') + r.namn + ' — ' + r.melding + ' (' + r.ms + ' ms)');
            if (r.detaljar && r.detaljar.length) {
                const typar = r.detaljar.map(d => d.type + '/' + d.protocol + ':' + d.port).join(', ');
                linjer.push('       kandidatar: ' + typar);
            }
        });
        return linjer.join('\n');
    }

    /* ── Køyring ───────────────────────────────── */

    async function køyrAlle() {
        const knapp = document.getElementById('btn-run');
        const kopier = document.getElementById('btn-copy');
        const liste = document.getElementById('results');

        knapp.disabled = true;
        kopier.disabled = true;
        document.getElementById('summary').hidden = true;
        liste.textContent = '';
        resultat = [];

        const rader = TESTAR.map(test => {
            const rad = lagRad(test);
            liste.appendChild(rad.boks);
            return rad;
        });

        for (let i = 0; i < TESTAR.length; i++) {
            const test = TESTAR[i];
            visStatus(rader[i].status, 'ventar', 'Testar…');

            let svar;
            try {
                svar = await test.køyr();
            } catch (e) {
                svar = { ok: false, melding: 'Testen krasja: ' + e.message, ms: 0 };
            }

            visStatus(rader[i].status, svar.ok ? 'ok' : 'feil', svar.melding, svar.ms);
            resultat.push(Object.assign({ id: test.id, namn: test.namn }, svar));
        }

        oppsummer();
        knapp.disabled = false;
        kopier.disabled = false;
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-run').addEventListener('click', køyrAlle);
        document.getElementById('btn-copy').addEventListener('click', async () => {
            const knapp = document.getElementById('btn-copy');
            try {
                await navigator.clipboard.writeText(somTekst());
                knapp.dataset.kopiert = 'ja';
                setTimeout(() => { delete knapp.dataset.kopiert; }, 2000);
            } catch (e) {
                window.prompt('Kopier resultatet:', somTekst());
            }
        });
    });
})();
