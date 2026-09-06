/* Leitekryss — elevnamn.
   Sjølve henting, reinsking og dialogen ligg i js/vyrdepil-elevlister.js.
   Her står berre det som er særskilt for Leitekryss: kva element dialogen
   skal bruke, og kva som skjer med tilstanden når namna kjem inn. */
window.LK = window.LK || {};

LK.names = (function () {
  'use strict';

  const state = LK.state;
  let veljar = null;

  function init() {
    veljar = VyrdepilElevlister.lagVeljar({
      prefix: 'lk',
      dom: {
        openBtn: document.getElementById('namesBtn'),
        clearBtn: document.getElementById('clearNamesBtn'),
        info: document.getElementById('namesInfo'),
        chips: document.getElementById('nameChips'),
        overlay: document.getElementById('namesOverlay'),
        sources: document.getElementById('namesSources'),
        paste: document.getElementById('namesPaste'),
        pasteConfirm: document.getElementById('namesPasteConfirm'),
        cancel: document.getElementById('namesCancel'),
        close: document.getElementById('namesClose')
      },
      read: function () {
        return { names: state.data.names, source: state.data.nameSource };
      },
      onApply: function (names, source) {
        state.data.names = names;
        state.data.nameSource = source;
        /* Utan namn finst det ingen elevar å gje kvar sitt rutenett til, så
           valet må slåast av — elles står det på i grensesnittet og gjer
           ingenting. */
        if (!names.length) state.data.settings.uniquePerPupil = false;
        state.emit('names');
      }
    });

    state.onChange(function (topic) {
      if (topic === 'names' || topic === 'load') veljar.render();
    });
    veljar.render();
  }

  function render() {
    if (veljar) veljar.render();
  }

  return { init: init, render: render };
})();
