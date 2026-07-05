/* Livslina — main.js
 * Oppstart, skjermbyte, modal-/toast-hjelparar og wiring.
 */
window.LL = window.LL || {};

LL.main = (function () {
  'use strict';

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }
  }

  function enterHome() {
    LL.uiHome.render();
    showScreen('screen-home');
  }

  // ── Modal ──
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(o => {
      if (o.classList.contains('modal-locked')) return; // t.d. hendingskort krev val
      o.classList.remove('open'); o.setAttribute('aria-hidden', 'true');
    });
  }

  // ── Toast ──
  function toast(msg) {
    const cont = document.getElementById('toastContainer');
    if (!cont) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  async function boot() {
    try {
      await LL.data.loadAll();
    } catch (e) {
      document.getElementById('bootError').hidden = false;
      console.error('Livslina: klarte ikkje laste datafiler', e);
      return;
    }
    LL.uiSetup.init();
    LL.uiHome.init();
    if (LL.uiSummer && LL.uiSummer.init) LL.uiSummer.init();
    if (LL.uiBudget && LL.uiBudget.init) LL.uiBudget.init();
    if (LL.uiPlayback && LL.uiPlayback.init) LL.uiPlayback.init();
    if (LL.uiReport && LL.uiReport.init) LL.uiReport.init();
    LL.uiSetup.renderStart();

    // Modal-lukking: kryss-knappar, overlay-klikk, Escape
    document.querySelectorAll('[data-close-modal]').forEach(b => {
      b.addEventListener('click', () => closeModal(b.getAttribute('data-close-modal')));
    });
    document.querySelectorAll('.modal-overlay').forEach(o => {
      o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

    LL.util.hydrate(document);
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { showScreen, enterHome, openModal, closeModal, closeAllModals, toast };
})();
