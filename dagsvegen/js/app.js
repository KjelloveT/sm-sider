/* ══════════════════════════════════════
   APP.JS — Init og samankopling: modusbyte, verktøyrad, økt-tilstand,
   innstillingar, Escape-handtering og toast-meldingar.
   ══════════════════════════════════════ */

const App = (() => {
    const $ = (id) => document.getElementById(id);
    let session = null;

    /* ---- økt-tilstand og dagens plan ---- */

    function getSession() { return session; }
    function getSettings() { return session.settings; }
    function saveSession() { Store.setState(session); }

    function getTodayPlan() {
        if (!session.today) return null;
        if (session.today.date !== State.dateKey(Engine.now())) {
            session.today = null; // ny dag — arbeidskopien frå i går er utgått
            saveSession();
            return null;
        }
        return session.today.plan;
    }

    function setTodayPlan(plan, sourcePlanId) {
        session.today = {
            date: State.dateKey(Engine.now()),
            sourcePlanId: sourcePlanId || null,
            plan: plan
        };
        saveSession();
        Render.bump();
        Engine.tick();
    }

    /* +5/−5 på ein aktivitet — muterer berre dagens arbeidskopi */
    function adjustTime(blockId, actId, delta) {
        const plan = getTodayPlan();
        if (!plan) return;
        const block = plan.blocks.find(b => b.id === blockId);
        if (!block) return;
        State.addTime(block, actId, delta, Engine.now());
        saveSession();
        Render.bump();
        Engine.tick();
    }

    /* ---- modus ---- */

    function setMode(mode) {
        document.body.dataset.mode = mode;
        $('edit-view').classList.toggle('dv-hidden', mode !== 'edit');
        applyHero();
        if (mode === 'edit') {
            $('empty-state').classList.add('dv-hidden');
            applyPanels();
            Edit.enter();
        } else {
            Render.bump();
            Engine.tick();
        }
    }

    /* ---- hero (kan lukkast for godt) ---- */

    function applyHero() {
        $('hero').classList.toggle('dv-hidden',
            document.body.dataset.mode !== 'edit' || session.ui.heroDismissed);
    }

    /* ---- flyttbare panel: dagsplan og plan for timen ---- */

    function applyPanels() {
        const plan = getTodayPlan();
        const hasPlan = !!(plan && plan.blocks && plan.blocks.length);
        const display = document.body.dataset.mode !== 'edit';
        $('day-panel').classList.toggle('dv-hidden', !(display && hasPlan && session.panels.day.on));
        $('lesson-wrap').classList.toggle('dv-hidden', !(display && hasPlan && session.panels.lesson.on));
        $('btn-panel-day').classList.toggle('active', session.panels.day.on);
        $('btn-panel-lesson').classList.toggle('active', session.panels.lesson.on);
    }

    function togglePanel(key) {
        setPanel(key, !session.panels[key].on);
    }

    function setPanel(key, on) {
        session.panels[key].on = on;
        saveSession();
        applyPanels();
        Engine.tick();
    }

    function initPanel(wrapId, barId, title, key) {
        const box = $(wrapId);
        const bar = $(barId);
        bar.appendChild(Icons.create('grip', 14));
        bar.appendChild(Dom.el('span', { class: 'dv-panel-title', text: title }));
        bar.appendChild(Dom.el('button', {
            class: 'dv-icon-btn', 'aria-label': 'Skjul ' + title.toLowerCase(),
            onclick: () => togglePanel(key)
        }, Icons.create('x', 16)));
        Widgets.makeDraggable(box, bar, (x, y) => {
            session.panels[key].x = Math.round(x);
            session.panels[key].y = Math.round(y);
            saveSession();
        });
        const p = session.panels[key];
        if (p.x != null && p.y != null) {
            box.style.left = Math.min(p.x, window.innerWidth - 80) + 'px';
            box.style.top = Math.min(Math.max(0, p.y), window.innerHeight - 60) + 'px';
            box.style.right = 'auto';
        }
    }

    function initPanels() {
        initPanel('day-panel', 'day-panel-bar', 'Dagsplan', 'day');
        initPanel('lesson-wrap', 'lesson-panel-bar', 'Plan for timen', 'lesson');
        $('btn-panel-day').addEventListener('click', () => togglePanel('day'));
        $('btn-panel-lesson').addEventListener('click', () => togglePanel('lesson'));
    }

    /* ---- venstremeny ---- */

    function positionSidebar() {
        const header = document.querySelector('neo-header');
        const bottom = header ? header.getBoundingClientRect().bottom : 70;
        $('sidebar').style.top = Math.max(10, bottom + 10) + 'px';
    }

    function applySidebar() {
        $('sidebar').classList.toggle('open', !!session.ui.sidebarOpen);
        $('sidebar-toggle').setAttribute('aria-expanded', String(!!session.ui.sidebarOpen));
    }

    function wireSidebar() {
        $('sidebar-toggle').addEventListener('click', () => {
            session.ui.sidebarOpen = !session.ui.sidebarOpen;
            saveSession();
            applySidebar();
        });
        applySidebar();
        positionSidebar();
        window.addEventListener('resize', positionSidebar);
        window.addEventListener('load', positionSidebar);
    }

    /* ---- toast ---- */

    /* Kort melding — sjå Vy.toast() i js/vyrdepil-util.js. */
    function toast(msg) {
        return Vy.toast(msg, { ms: 3500 });
    }

    /* ---- innstillingar ---- */

    function openSettings() {
        $('set-warn').value = session.settings.warnMinutes;
        $('set-autoclear').checked = session.settings.autoClearDrawing;
        $('set-showclock').checked = session.settings.showClock;
        $('set-breaks').value = Store.getBreaks().map(b => b.text).join('\n');
        $('modal-settings').classList.add('open');
    }

    function wireSettings() {
        $('set-warn').addEventListener('change', () => {
            session.settings.warnMinutes = Math.max(0, parseInt($('set-warn').value, 10) || 2);
            saveSession();
        });
        $('set-autoclear').addEventListener('change', () => {
            session.settings.autoClearDrawing = $('set-autoclear').checked;
            saveSession();
        });
        $('set-showclock').addEventListener('change', () => {
            session.settings.showClock = $('set-showclock').checked;
            saveSession();
            Widgets.applyClockVisibility();
        });
        $('set-breaks').addEventListener('change', () => {
            const lines = $('set-breaks').value.split('\n').map(t => t.trim()).filter(Boolean);
            Store.setBreaks(lines.map(t => ({ id: State.uid('br'), text: t })));
        });
        $('btn-settings-subjects').addEventListener('click', () => {
            $('modal-settings').classList.remove('open');
            document.getElementById('btn-open-subjects').click();
        });
    }

    /* ---- Escape og modal-lukking ---- */

    function wireModals() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (ev) => {
                if (ev.target === overlay) overlay.classList.remove('open');
            });
        });
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const overlay = document.getElementById(btn.dataset.close);
                if (overlay) overlay.classList.remove('open');
            });
        });
        document.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape') return;
            const openModal = document.querySelector('.modal-overlay.open');
            if (openModal) { openModal.classList.remove('open'); return; }
            if (Draw.isActive()) { Draw.setActive(false); syncDrawBtn(); return; }
            if (Widgets.calmIsOpen()) Widgets.closeCalm();
        });
    }

    /* ---- tom tilstand ---- */

    function wireEmptyState() {
        $('btn-empty-create').addEventListener('click', () => setMode('edit'));
        $('btn-empty-load').addEventListener('click', () => {
            setMode('edit');
            Edit.openFilesModal();
        });
        $('btn-empty-help').addEventListener('click', () => $('modal-help').classList.add('open'));
        $('btn-empty-quick').addEventListener('click', () => Edit.openQuickModal());
        $('btn-empty-close').addEventListener('click', () => {
            session.ui.emptyDismissed = true;
            saveSession();
            $('empty-state').classList.add('dv-hidden');
        });
        const wd = State.isoWeekday(Engine.now());
        const tpl = Store.getWeekdayPlan(wd);
        const btn = $('btn-empty-weekday');
        if (tpl) {
            btn.classList.remove('dv-hidden');
            Dom.clear(btn);
            btn.appendChild(Icons.create('calendar', 18));
            btn.appendChild(document.createTextNode('Last vekemalen for ' + State.DAYS[wd % 7]));
            btn.addEventListener('click', () => {
                const copy = State.clonePlan(tpl);
                copy.id = State.uid('p');
                copy.weekday = null;
                copy.name = 'I dag';
                setTodayPlan(copy, tpl.id);
            });
        }
    }

    /* ---- verktøyknappar i menyen ---- */

    function syncDrawBtn() {
        $('btn-draw').classList.toggle('active', Draw.isActive());
    }

    function wireToolbar() {
        $('btn-edit').addEventListener('click', () => setMode('edit'));
        $('btn-quick').addEventListener('click', () => Edit.openQuickModal());
        $('btn-done').addEventListener('click', () => setMode('display'));
        $('btn-countdown').addEventListener('click', () =>
            $('btn-countdown').classList.toggle('active', Widgets.toggle('countdown-widget')));
        $('btn-stopwatch').addEventListener('click', () =>
            $('btn-stopwatch').classList.toggle('active', Widgets.toggle('stopwatch-widget')));
        $('btn-traffic').addEventListener('click', () =>
            $('btn-traffic').classList.toggle('active', Widgets.toggle('traffic-widget')));
        $('btn-calm').addEventListener('click', () => Widgets.openCalm());
        $('btn-break').addEventListener('click', () => Widgets.openBrainBreak());
        $('btn-draw').addEventListener('click', () => { Draw.setActive(!Draw.isActive()); syncDrawBtn(); });
        $('btn-note').addEventListener('click', () => Notes.addNote());
        $('btn-settings').addEventListener('click', openSettings);
        $('btn-help').addEventListener('click', () => $('modal-help').classList.add('open'));
        $('btn-hero-close').addEventListener('click', () => {
            session.ui.heroDismissed = true;
            saveSession();
            applyHero();
        });
        $('btn-fullscreen').addEventListener('click', () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
        });
    }

    /* ---- init ---- */

    function init() {
        Store.ensureSeed();
        session = Store.getState();

        Edit.init();
        Widgets.init();
        Notes.init();
        Draw.init();
        initPanels();
        wireSidebar();
        wireToolbar();
        wireSettings();
        wireModals();
        wireEmptyState();

        Engine.setPlanProvider(getTodayPlan);
        Engine.onTick(Render.update);
        Engine.onSwitch(() => {
            if (session.settings.autoClearDrawing) Draw.clear();
        });

        setMode('display');
        Engine.start();
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        session: getSession, getSettings, saveSession,
        getTodayPlan, setTodayPlan, adjustTime,
        setMode, toast, applyPanels, setPanel
    };
})();
