/* ══════════════════════════════════════════════
   FRØDEKAPP — PeerJS Spelar-kommunikasjon
   Kobler til verten sin Peer-ID via romkode
   ══════════════════════════════════════════════ */

class PeerPlayer {
    /**
     * @param {string} roomCode
     * @param {string} playerName
     * @param {object} callbacks - { onConnected, onMessage, onDisconnected, onError }
     */
    constructor(roomCode, playerName, callbacks) {
        this.roomCode = roomCode;
        this.hostPeerId = 'fk-' + roomCode;
        this.playerName = playerName;
        this.playerId = QuizEngine.generatePlayerId();
        this.callbacks = callbacks;
        this.peer = null;
        this.conn = null;
        this.destroyed = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.serverIndex = 0;
        this.opened = false;
        this.openTimer = null;

        this._initPeer();
    }

    _initPeer() {
        const options = FKPeerConfig.optionsFor(this.serverIndex);
        console.log('[PeerPlayer] Koplar til signalvert:', options.host);
        this.peer = new Peer(undefined, options);

        // Ein hengande signalvert gjev inga error-hending — då må vi sjølve gje opp.
        this.openTimer = setTimeout(() => {
            console.warn('[PeerPlayer] Signalverten svarte ikkje innan tidsfristen:', options.host);
            this._handleServerFailure();
        }, FKPeerConfig.OPEN_TIMEOUT_MS);

        this.peer.on('open', () => {
            this._clearOpenTimer();
            this.opened = true;
            console.log('[PeerPlayer] Peer opna, koplar til vert:', this.hostPeerId);
            this._connectToHost();
        });

        this.peer.on('error', (err) => {
            console.error('[PeerPlayer] Feil:', err.type, err.message);
            if (err.type === 'peer-unavailable') {
                this._clearOpenTimer();
                if (this.callbacks.onError) this.callbacks.onError('Fann ikkje rommet. Sjekk at romkoden er rett og at verten er tilkopla.');
            } else if (err.type === 'network' || err.type === 'server-error') {
                this._handleServerFailure();
            } else {
                this._clearOpenTimer();
                if (this.callbacks.onError) this.callbacks.onError('Tilkoplingsfeil: ' + err.type);
            }
        });

        this.peer.on('disconnected', () => {
            console.log('[PeerPlayer] Fråkopla frå signalserver');
            if (!this.destroyed) {
                setTimeout(() => {
                    if (!this.destroyed && this.peer && !this.peer.destroyed) {
                        this.peer.reconnect();
                    }
                }, 2000);
            }
        });
    }

    _clearOpenTimer() {
        if (this.openTimer) {
            clearTimeout(this.openTimer);
            this.openTimer = null;
        }
    }

    /**
     * Signalverten svarar ikkje: prøv neste i lista, eller meld frå om lista er tom.
     * Gjeld berre den første oppkoplinga — etter 'open' tek reconnect-logikken over.
     */
    _handleServerFailure() {
        this._clearOpenTimer();
        if (this.destroyed || this.opened) return;

        if (!FKPeerConfig.hasFallbackAfter(this.serverIndex)) {
            if (this.callbacks.onError) {
                this.callbacks.onError('Signaltenesta som koplar saman spelet svarar ikkje akkurat no. Vent litt og prøv igjen.');
            }
            return;
        }

        try { this.peer.destroy(); } catch (e) { /* ignorer */ }
        this.serverIndex++;
        this._initPeer();
    }

    _connectToHost() {
        this.conn = this.peer.connect(this.hostPeerId, {
            reliable: true
        });

        this.conn.on('open', () => {
            console.log('[PeerPlayer] Kopla til vert!');
            this.reconnectAttempts = 0;

            // Send join-melding
            this.conn.send({
                type: 'join',
                playerId: this.playerId,
                name: this.playerName
            });
        });

        this.conn.on('data', (data) => {
            if (data.type === 'welcome') {
                this.playerId = data.playerId || this.playerId;
                if (this.callbacks.onConnected) {
                    this.callbacks.onConnected(this.playerId, data.players);
                }
            } else {
                if (this.callbacks.onMessage) {
                    this.callbacks.onMessage(data);
                }
            }
        });

        this.conn.on('close', () => {
            console.log('[PeerPlayer] Tilkopling til vert lukka');
            if (!this.destroyed) {
                if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
                this._tryReconnect();
            }
        });

        this.conn.on('error', (err) => {
            console.error('[PeerPlayer] Tilkoplingsfeil:', err);
        });
    }

    _tryReconnect() {
        if (this.destroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.callbacks.onError) {
                this.callbacks.onError('Mista tilkoplinga til verten. Sjekk at du er på same wifi som verten — nokre nett sperrar for direkte tilkopling mellom maskiner. Prøv så å laste sida på nytt.');
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * this.reconnectAttempts, 5000);
        console.log(`[PeerPlayer] Prøver å koble til igjen (${this.reconnectAttempts}/${this.maxReconnectAttempts}) om ${delay}ms`);

        setTimeout(() => {
            if (!this.destroyed && this.peer && !this.peer.destroyed) {
                this._connectToHost();
            }
        }, delay);
    }

    /**
     * Send melding til verten
     * @param {object} data
     */
    send(data) {
        if (this.conn && this.conn.open) {
            try {
                this.conn.send(data);
            } catch (e) {
                console.error('[PeerPlayer] Send feil:', e);
            }
        }
    }

    /**
     * Avslutt og rydd opp
     */
    destroy() {
        this.destroyed = true;
        this._clearOpenTimer();
        if (this.conn) {
            try { this.conn.close(); } catch (e) { /* ignorer */ }
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) { /* ignorer */ }
        }
    }
}
