/* ══════════════════════════════════════════════
   FRØDEKAPP — Delt UI-hjelpefunksjonar
   Rendring med neobrutalisme-klassar og Lucide-ikon.
   ══════════════════════════════════════════════ */

const UI = {
    /**
     * Vis ein skjerm og gøym alle andre
     * @param {string} screenId - ID til skjermen som skal visast
     */
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(screenId);
        if (el) el.classList.add('active');
    },

    /**
     * Sett tekst-innhald på eit element
     */
    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    /**
     * Vis/gøym eit element
     */
    toggle(id, visible) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !visible);
    },

    /**
     * Aktiver/deaktiver ein knapp
     */
    enableBtn(id, enabled) {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    },

    /**
     * Sett svar-ikon (Lucide-form) + tekst på ein svarknapp-node.
     * @param {HTMLElement} node
     * @param {number} i - svar-indeks (0-3)
     * @param {string} text
     */
    _fillAnswer(node, i, text) {
        const icon = document.createElement('span');
        icon.className = 'answer-icon';
        icon.innerHTML = ICON(ANSWER_ICON_NAMES[i], 26);
        const label = document.createElement('span');
        label.className = 'answer-label';
        label.textContent = text;
        node.append(icon, label);
    },

    /**
     * Lag svaralternativ-knappar (Kahoot-stil)
     * @param {string[]} options
     * @param {function} onClick - callback(index)
     * @returns {HTMLElement} grid-container
     */
    createAnswerGrid(options, onClick) {
        const grid = document.createElement('div');
        grid.className = 'answer-grid';

        options.forEach((text, i) => {
            const btn = document.createElement('button');
            btn.className = `answer-btn ${QuizEngine.ANSWER_CLASSES[i]}`;
            this._fillAnswer(btn, i, text);
            btn.addEventListener('click', () => onClick(i));
            grid.appendChild(btn);
        });

        return grid;
    },

    /**
     * Lag svaralternativ for vert-visning (ikkje klikkbare)
     */
    createAnswerGridDisplay(options) {
        const grid = document.createElement('div');
        grid.className = 'answer-grid';

        options.forEach((text, i) => {
            const div = document.createElement('div');
            div.className = `answer-btn ${QuizEngine.ANSWER_CLASSES[i]}`;
            this._fillAnswer(div, i, text);
            grid.appendChild(div);
        });

        return grid;
    },

    /**
     * Marker rett/feil svar i eit answer-grid
     */
    revealAnswers(grid, correctIndex, selectedIndex) {
        const btns = grid.querySelectorAll('.answer-btn');
        btns.forEach((btn, i) => {
            btn.disabled = true;
            if (i === correctIndex) {
                btn.classList.add('correct');
            } else {
                btn.classList.add('incorrect');
            }
            if (i === selectedIndex && i !== correctIndex) {
                btn.classList.add('selected-wrong');
            }
        });
    },

    /**
     * Bygg ein leaderboard-tabell
     * @param {Array} leaderboard - [{rank, name, score}]
     * @param {number} [maxRows=10]
     * @returns {HTMLElement}
     */
    createLeaderboard(leaderboard, maxRows = 10) {
        const container = document.createElement('div');
        container.className = 'leaderboard';

        const rankClasses = ['gold', 'silver', 'bronze'];
        leaderboard.slice(0, maxRows).forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'lb-row';
            if (i < 3) row.classList.add(rankClasses[i]);

            const rank = document.createElement('span');
            rank.className = 'lb-rank';
            if (i < 3) {
                rank.innerHTML = ICON('medal', 24);
            } else {
                rank.textContent = `${p.rank}.`;
            }

            const name = document.createElement('span');
            name.className = 'lb-name';
            name.textContent = p.name;

            const score = document.createElement('span');
            score.className = 'lb-score';
            score.textContent = p.score;

            row.append(rank, name, score);
            container.appendChild(row);
        });

        return container;
    },

    /**
     * Bygg podium (topp 3)
     */
    createPodium(leaderboard) {
        const podium = document.createElement('div');
        podium.className = 'podium';

        const places = [
            { index: 1, cls: 'second' },
            { index: 0, cls: 'first' },
            { index: 2, cls: 'third' }
        ];

        places.forEach(({ index, cls }) => {
            const p = leaderboard[index];
            const place = document.createElement('div');
            place.className = `podium-place ${cls}`;

            const medal = document.createElement('div');
            medal.className = 'podium-medal';
            medal.innerHTML = ICON(index === 0 ? 'trophy' : 'medal', 36);
            place.appendChild(medal);

            const name = document.createElement('div');
            name.className = 'podium-name';
            name.textContent = p ? p.name : '—';
            place.appendChild(name);

            if (p) {
                const score = document.createElement('div');
                score.className = 'podium-score';
                score.textContent = `${p.score} poeng`;
                place.appendChild(score);
            }

            podium.appendChild(place);
        });

        return podium;
    },

    /**
     * Start ein nedteljing og oppdater eit element
     * @returns {{ stop: function, getRemaining: function }}
     */
    startTimer(elementId, seconds, onTick, onDone) {
        const el = document.getElementById(elementId);
        let remaining = seconds;
        let intervalId = null;

        const update = () => {
            if (el) {
                el.textContent = QuizEngine.formatTime(remaining);
                el.classList.toggle('warning', remaining <= 5);
            }
            if (onTick) onTick(remaining);
        };

        update();

        intervalId = setInterval(() => {
            remaining--;
            update();
            if (remaining <= 0) {
                clearInterval(intervalId);
                if (onDone) onDone();
            }
        }, 1000);

        return {
            stop() { clearInterval(intervalId); },
            getRemaining() { return remaining; }
        };
    },

    /**
     * Vis ei kort melding (toast). Tekst via textContent.
     * @param {string} text
     * @param {string} [type='info'] - 'info' | 'success' | 'error'
     */
    toast(text, type = 'info') {
        /* Sjølve visinga ligg i Vy.toast() (js/vyrdepil-util.js). Her mapper vi
           berre Frødekapp sine tre typar over på dei felles variantane. */
        const KIND = { success: 'good', error: 'warn', info: null };
        const IKON = { success: 'check', error: 'alert', info: 'list' };
        return Vy.toast(text, { icon: IKON[type] || 'list', kind: KIND[type], ms: 2500 });
    },

    /**
     * Escape HTML for sikker rendering (brukt der innerHTML er naudsynt)
     */
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Lag ein spelar-chip
     */
    createPlayerChip(name, isHost = false) {
        const chip = document.createElement('span');
        chip.className = 'player-chip' + (isHost ? ' host' : '');
        chip.textContent = name;
        return chip;
    },

    /**
     * Oppdater spelar-liste (DOM-API, ingen innerHTML med data)
     */
    updatePlayerList(containerId, players) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.textContent = '';

        if (players.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'fk-empty';
            empty.textContent = 'Ingen spelarar tilkopla enno';
            container.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'player-list';
        players.forEach(p => list.appendChild(this.createPlayerChip(p.name)));
        container.appendChild(list);
    }
};
