/* ══════════════════════════════════════════════
   FRØDEKAPP — Peer-oppsett
   Éin stad for signalvertar og ICE-tenarar
   ══════════════════════════════════════════════ */

/*
   VIKTIG — to ting må haldast i synk:

   1. Kvar vert i SERVERS må stå i `connect-src` i staticwebapp.config.json i rota,
      både med https:// og wss://, elles blir han blokkert av CSP i produksjon.
      Den lokale serve.ps1 sender ingen CSP-header, så feilen syner seg først live.

   2. Same lista blir testa av nettsjekk.js. Legg du til ein vert her, legg han til der.
*/

const FKPeerConfig = {

    /**
     * Signalvertar, prøvde i tur og orden. Fell vidare til neste om ein ikkje svarar.
     *
     * Først vår eigen PeerServer: eit `peerjs/peerjs-server`-bilete på Azure Container
     * Apps i Norway East, ressursgruppa `frodekapp-signal-rg`. Den er sett til nøyaktig
     * éi replika — PeerServer held registeret over tilkopla peer-ar i minnet, så med to
     * replikaer kunne læraren hamne på den eine og elevane på den andre og aldri finne
     * kvarandre. Skal tenesta skalerast, må ho få eit delt register først.
     *
     * `1.peerjs.com` står att som naudløysing. Den offentlege PeerJS-skya er grunnen til
     * at vi bygde vår eigen: ho avviste WebSocket-tilkoplingane våre på ~150 ms medan
     * vanleg HTTPS mot same vert svarte 200, truleg ei grense på tilkoplingar per IP —
     * som er nettopp det ein klasse bak éi skule-IP løyser ut.
     *
     * Merk: `path: '/'` — PeerJS legg sjølv på '/peerjs'-prefikset, så '/peerjs' her
     * ville gjeve '/peerjs/peerjs'.
     */
    SERVERS: [
        { host: 'frodekapp-signal.wittyhill-3f1036a7.norwayeast.azurecontainerapps.io', port: 443, path: '/', secure: true },
        { host: '1.peerjs.com', port: 443, path: '/', secure: true }
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
