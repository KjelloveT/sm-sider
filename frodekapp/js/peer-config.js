/* ══════════════════════════════════════════════
   FRØDEKAPP — Peer-oppsett
   Éin stad for signalvertar og ICE-tenarar
   ══════════════════════════════════════════════ */

/*
   VIKTIG — to ting må haldast i synk:

   1. Kvar vert i SERVERS må stå i `connect-src`taranswer/staticwebapp.config.json
      (både https:// og wss://) i staticwebapp.config.json i rota, elles blir han
      blokkert av CSP i produksjon.
      Den lokale serve.ps1 sender ingen CSP-header, så feilen syner seg først live.

   2. Får vi ein eigen sjølvhosta PeerServer, legg han berre fremst i SERVERS og i CSP-en.
      Ingen andre filer treng endrast.
*/

const FKPeerConfig = {

    /**
     * Signalvertar, prøvde i tur og orden. Fell vidare til neste om ein ikkje svarar.
     *
     * Merk: `path: '/'` — PeerJS legg sjølv på '/peerjs'-prefikset, så '/peerjs' her
     * ville gjeve '/peerjs/peerjs'.
     *
     * 0.peerjs.com ligg sist som reserve: han var standardverten i biblioteket, men
     * slutta å svare (TCP opnar, HTTP heng). Han står att i tilfelle han kjem tilbake.
     */
    SERVERS: [
        { host: '1.peerjs.com', port: 443, path: '/', secure: true },
        { host: '0.peerjs.com', port: 443, path: '/', secure: true }
    ],

    /**
     * ICE-tenarar. Vi set dette eksplisitt fordi standarden i peerjs.min.js peikar på
     * eu-0/us-0.turn.peerjs.com, som ikkje lenger finst (DNS resolverer ikkje).
     *
     * Berre STUN: det held når vert og spelarar er på same nett. Skal vi støtte elevar
     * bak AP-isolasjon eller på mobilnett, må ein TURN-tenar leggjast inn her.
     */
    ICE: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    },

    /**
     * Kor lenge vi ventar på 'open' før vi reknar verten som daud og prøver neste.
     * Ein hengande vert gjev ingen error-hending, så utan dette blir spinnaren ståande.
     */
    OPEN_TIMEOUT_MS: 8000,

    /**
     * Peer-opsjonar for vert nummer `index` i SERVERS.
     * @param {number} index
     * @returns {object|null} null når lista er oppbrukt
     */
    optionsFor(index) {
        const server = this.SERVERS[index];
        if (!server) return null;

        return {
            host: server.host,
            port: server.port,
            path: server.path,
            secure: server.secure,
            config: this.ICE,
            debug: 0
        };
    },

    /**
     * Finst det fleire vertar å prøve etter `index`?
     * @param {number} index
     * @returns {boolean}
     */
    hasFallbackAfter(index) {
        return index + 1 < this.SERVERS.length;
    }
};
