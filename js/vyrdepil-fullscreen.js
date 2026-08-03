/* ══════════════════════════════════════════════
   VYRDEPIL — Delt fullskjerm-knapp

   Spel som må spelast i liggjande format mistar mykje av skjermen til
   URL-feltet og systemlinjene på mobil. Fullskjerm løyser det, men
   nettlesarane krev ei *brukarhandling* for å gå i fullskjerm — det går
   difor ikkje å gjere automatisk ved rotasjon. Denne modulen legg til ein
   liten flytande knapp som gjer det i staden.

   Merk: Safari på iPhone støttar ikkje Fullscreen API for vanlege element
   (berre <video>), og har ingen screen.orientation.lock(). Der blir knappen
   ikkje vist i det heile — difor må spela òg bruke dvh-einingar i CSS slik
   at layouten held seg innanfor det synlege området uansett.

   Ingen avhengnader (ikon-SVG-ane er bakte inn), slik at eldre spel som
   ikkje lastar vyrdepil-icons.js òg kan bruke han.

   Bruk:
     <script src="../js/vyrdepil-fullscreen.js"></script>
     VyrdepilFullscreen.mount();                       // standard
     VyrdepilFullscreen.mount({ position: 'top-right' });
   ══════════════════════════════════════════════ */
(function (global) {
    'use strict';

    const doc = global.document;

    // Lucide: maximize / minimize
    const ICONS = {
        maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
        minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'
    };

    function svg(name) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"' +
            ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
            ' stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
    }

    const root = doc.documentElement;
    const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);

    function isTouch() {
        return navigator.maxTouchPoints > 0 || 'ontouchstart' in global;
    }

    function isActive() {
        return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    }

    function lockOrientation(mode) {
        if (!mode) return;
        const o = global.screen && global.screen.orientation;
        if (!o || typeof o.lock !== 'function') return;
        // Ikkje støtta overalt, og feilar òg på desktop — stille avvising er greitt.
        try { const p = o.lock(mode); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignorert */ }
    }

    function unlockOrientation() {
        const o = global.screen && global.screen.orientation;
        if (o && typeof o.unlock === 'function') { try { o.unlock(); } catch (e) { /* ignorert */ } }
    }

    function enter(el, lock) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) return Promise.resolve(false);
        return Promise.resolve(req.call(el, { navigationUI: 'hide' }))
            .then(() => { lockOrientation(lock); return true; })
            .catch(() => false);
    }

    function exit() {
        const ex = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (!ex) return Promise.resolve(false);
        unlockOrientation();
        return Promise.resolve(ex.call(doc)).then(() => true).catch(() => false);
    }

    function toggle(el, lock) {
        return isActive() ? exit() : enter(el || root, lock);
    }

    const STYLE_ID = 'vp-fullscreen-style';
    const CSS = `
.vp-fs-btn{
  position:fixed;z-index:10000;display:inline-flex;align-items:center;gap:0;
  border:2px solid rgba(255,255,255,.55);border-radius:999px;
  background:rgba(0,0,0,.55);color:#fff;
  padding:9px;min-width:44px;min-height:44px;
  font:600 .82rem/1 'Segoe UI',system-ui,sans-serif;
  cursor:pointer;-webkit-tap-highlight-color:transparent;
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  transition:gap .25s ease,padding .25s ease,background .15s ease,opacity .25s ease;
}
.vp-fs-btn:hover{background:rgba(0,0,0,.75)}
.vp-fs-btn:focus-visible{outline:3px solid #ffdd55;outline-offset:2px}
.vp-fs-btn svg{flex:none;display:block}
.vp-fs-btn .vp-fs-label{
  max-width:0;overflow:hidden;white-space:nowrap;opacity:0;
  transition:max-width .25s ease,opacity .25s ease;
}
.vp-fs-btn.vp-fs-open{gap:8px;padding:9px 16px 9px 12px}
.vp-fs-btn.vp-fs-open .vp-fs-label{max-width:10rem;opacity:1}
.vp-fs-btn.vp-fs-nudge{animation:vp-fs-pulse 1.4s ease-in-out 3}
@keyframes vp-fs-pulse{
  0%,100%{box-shadow:0 0 0 0 rgba(255,221,85,0)}
  50%{box-shadow:0 0 0 8px rgba(255,221,85,.35)}
}
@media (prefers-reduced-motion:reduce){
  .vp-fs-btn,.vp-fs-btn .vp-fs-label{transition:none}
  .vp-fs-btn.vp-fs-nudge{animation:none}
}
/* I fullskjerm skal spelet ha heile flata — den globale headeren tek elles
   ein god del av høgda på ein liggjande mobil. */
/* Eigne reglar per prefiks: eit ukjent selektor-ledd i ei felles liste ville
   fått heile regelen forkasta. */
:fullscreen neo-header,:fullscreen .site-header{display:none}
:-webkit-full-screen neo-header,:-webkit-full-screen .site-header{display:none}
.vp-fs-top-right{top:calc(10px + env(safe-area-inset-top));right:calc(10px + env(safe-area-inset-right))}
.vp-fs-top-left{top:calc(10px + env(safe-area-inset-top));left:calc(10px + env(safe-area-inset-left))}
.vp-fs-bottom-right{bottom:calc(10px + env(safe-area-inset-bottom));right:calc(10px + env(safe-area-inset-right))}
.vp-fs-bottom-left{bottom:calc(10px + env(safe-area-inset-bottom));left:calc(10px + env(safe-area-inset-left))}
`;

    function injectStyle() {
        if (doc.getElementById(STYLE_ID)) return;
        const s = doc.createElement('style');
        s.id = STYLE_ID;
        s.textContent = CSS;
        doc.head.appendChild(s);
    }

    /**
     * Legg fullskjerm-knappen inn i sida.
     * @param {Object}  [opt]
     * @param {string}  [opt.position='bottom-right'] top-left|top-right|bottom-left|bottom-right
     * @param {Element} [opt.target]        elementet som skal fylle skjermen (standard <html>)
     * @param {string}  [opt.lock='landscape'] orientasjonslås i fullskjerm, null for ingen
     * @param {boolean} [opt.touchOnly=true] vis berre på einingar med touch
     * @returns {Element|null} knappen, eller null når fullskjerm ikkje er mogeleg
     */
    function mount(opt) {
        const o = opt || {};
        if (!supported) return null;
        if (o.touchOnly !== false && !isTouch()) return null;

        const existing = doc.querySelector('.vp-fs-btn');
        if (existing) return existing;

        injectStyle();

        const pos = o.position || 'bottom-right';
        const lock = o.lock === undefined ? 'landscape' : o.lock;
        const target = o.target || root;

        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'vp-fs-btn vp-fs-' + pos;
        let collapseTimer = null;
        function expand() {
            btn.classList.add('vp-fs-open');
            clearTimeout(collapseTimer);
            collapseTimer = setTimeout(() => btn.classList.remove('vp-fs-open'), 4500);
        }

        function sync() {
            const on = isActive();
            btn.innerHTML = svg(on ? 'minimize' : 'maximize') + '<span class="vp-fs-label"></span>';
            const lbl = btn.querySelector('.vp-fs-label');
            lbl.textContent = on ? 'Avslutt fullskjerm' : 'Fullskjerm';
            btn.setAttribute('aria-label', lbl.textContent);
            btn.setAttribute('aria-pressed', String(on));
            btn.classList.toggle('vp-fs-nudge', !on);
        }

        btn.addEventListener('click', () => { toggle(target, lock); });
        doc.addEventListener('fullscreenchange', sync);
        doc.addEventListener('webkitfullscreenchange', sync);

        // Når brukaren snur til liggjande og ikkje er i fullskjerm, minn om knappen.
        function onOrientation() {
            setTimeout(() => {
                if (!isActive() && global.innerWidth > global.innerHeight) expand();
            }, 250);
        }
        global.addEventListener('orientationchange', onOrientation);

        doc.body.appendChild(btn);
        sync();
        if (global.innerWidth > global.innerHeight) expand();
        return btn;
    }

    global.VyrdepilFullscreen = {
        mount: mount,
        toggle: toggle,
        enter: enter,
        exit: exit,
        isActive: isActive,
        isSupported: supported
    };
})(typeof window !== 'undefined' ? window : globalThis);
