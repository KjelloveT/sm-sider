/* ══════════════════════════════════════════════
   FRØDEKAPP — PeerJS Vert-kommunikasjon
   Handterer romoppretting og P2P-tilkoplingar
   ══════════════════════════════════════════════ */

class PeerHost {
    /**
     * @param {string} roomCode
     * @param {object} callbacks - { onPlayerJoin, onPlayerLeave, onPlayerMessage, onReady, onError }
     */
    constructor(roomCode, callbacks) {
        this.roomCode = roomCode;
        this.peerId = 'fk-' + roomCode;
        this.callbacks = callbacks;
        this.connections = new Map(); // playerId → { conn, name }
        this.peer = null;
        this.destroyed = false;
        this.serverIndex = 0;
        this.opened = false;
        this.openTimer = null;

        this._initPeer();
    }

    _initPeer() {
        const options = FKPeerConfig.optionsFor(this.serverIndex);
        console.log('[PeerHost] Koplar til signalvert:', options.host);
        this.peer = new Peer(this.peerId, options);

        // Ein hengande signalvert gjev inga error-hending — då må vi sjølve gje opp.
        this.openTimer = setTimeout(() => {
            console.warn('[PeerHost] Signalverten svarte ikkje innan tidsfristen:', options.host);
            this._handleServerFailure('Kunne ikkje koble til signaltenesta. Sjekk internett-tilkoplinga.');
        }, FKPeerConfig.OPEN_TIMEOUT_MS);

        this.peer.on('open', (id) => {
            this._clearOpenTimer();
            this.opened = true;
            console.log('[PeerHost] Opna med ID:', id);
            if (this.callbacks.onReady) this.callbacks.onReady(this.roomCode);
        });

        this.peer.on('connection', (conn) => {
            this._handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('[PeerHost] Feil:', err.type, err.message);
            if (err.type === 'unavailable-id') {
                this._clearOpenTimer();
                if (this.callbacks.onError) this.callbacks.onError('Romkoden er allereie i bruk. Prøv ein annan.');
            } else if (err.type === 'network' || err.type === 'server-error') {
                this._handleServerFailure('Kunne ikkje koble til signaltenesta. Sjekk internett-tilkoplinga.');
            } else {
                this._clearOpenTimer();
                if (this.callbacks.onError) this.callbacks.onError('Tilkoplingsfeil: ' + err.type);
            }
        });

        this.peer.on('disconnected', () => {
            console.log('[PeerHost] Fråkopla frå signalserver. Prøver å koble til igjen...');
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
     * @param {string} message
     */
    _handleServerFailure(message) {
        this._clearOpenTimer();
        if (this.destroyed || this.opened) return;

        if (!FKPeerConfig.hasFallbackAfter(this.serverIndex)) {
            if (this.callbacks.onError) this.callbacks.onError(message);
            return;
        }

        try { this.peer.destroy(); } catch (e) { /* ignorer */ }
        this.serverIndex++;
        this._initPeer();
    }

    _handleConnection(conn) {
        conn.on('open', () => {
            console.log('[PeerHost] Ny tilkopling:', conn.peer);
        });

        conn.on('data', (data) => {
            if (data.type === 'join') {
                const playerId = data.playerId || conn.peer;
                this.connections.set(playerId, { conn, name: data.name });

                // Send velkommen
                conn.send({
                    type: 'welcome',
                    playerId: playerId,
                    players: this.getPlayerList()
                });

                // Varsle alle andre
                this.broadcast({
                    type: 'player-joined',
                    name: data.name,
                    count: this.connections.size
                }, playerId);

                if (this.callbacks.onPlayerJoin) {
                    this.callbacks.onPlayerJoin({ id: playerId, name: data.name });
                }
            } else {
                // Andre meldingar (t.d. svar)
                const playerId = this._findPlayerByConn(conn);
                if (this.callbacks.onPlayerMessage) {
                    this.callbacks.onPlayerMessage(playerId, data);
                }
            }
        });

        conn.on('close', () => {
            const playerId = this._findPlayerByConn(conn);
            if (playerId) {
                const playerName = this.connections.get(playerId)?.name;
                this.connections.delete(playerId);

                this.broadcast({
                    type: 'player-left',
                    name: playerName,
                    count: this.connections.size
                });

                if (this.callbacks.onPlayerLeave) {
                    this.callbacks.onPlayerLeave({ id: playerId, name: playerName });
                }
            }
        });

        conn.on('error', (err) => {
            console.error('[PeerHost] Tilkoplingsfeil:', err);
        });
    }

    _findPlayerByConn(conn) {
        for (const [id, data] of this.connections) {
            if (data.conn === conn) return id;
        }
        return null;
    }

    /**
     * Send melding til alle spelarar
     * @param {object} data
     * @param {string} [exceptId] - Utelat denne spelaren
     */
    broadcast(data, exceptId = null) {
        for (const [id, { conn }] of this.connections) {
            if (id !== exceptId && conn.open) {
                try { conn.send(data); } catch (e) { console.error('[PeerHost] Send feil:', e); }
            }
        }
    }

    /**
     * Send melding til éin spelar
     * @param {string} playerId
     * @param {object} data
     */
    sendTo(playerId, data) {
        const entry = this.connections.get(playerId);
        if (entry && entry.conn.open) {
            try { entry.conn.send(data); } catch (e) { console.error('[PeerHost] Send feil:', e); }
        }
    }

    /**
     * Hent liste av tilkopla spelarar
     * @returns {Array} [{id, name}]
     */
    getPlayerList() {
        return Array.from(this.connections).map(([id, { name }]) => ({ id, name }));
    }

    /**
     * Hent antal tilkopla spelarar
     * @returns {number}
     */
    getPlayerCount() {
        return this.connections.size;
    }

    /**
     * Avslutt og rydd opp
     */
    destroy() {
        this.destroyed = true;
        this._clearOpenTimer();
        this.connections.forEach(({ conn }) => {
            try { conn.close(); } catch (e) { /* ignorer */ }
        });
        this.connections.clear();
        if (this.peer) {
            try { this.peer.destroy(); } catch (e) { /* ignorer */ }
        }
    }
}
