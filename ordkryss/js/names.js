/* Ordkryss — elevnamn.
   Sjølve henting, reinsking og dialogen ligg i js/vyrdepil-elevlister.js.
   Her står berre det som er særskilt for Ordkryss: kva element dialogen skal
   bruke, og kva som skjer med tilstanden når namna kjem inn. */
window.OK = window.OK || {};

OK.names = (function () {
  'use strict';

  const state = OK.state;
  let veljar = null;

  function init() {
    veljar = VyrdepilElevlister.lagVeljar({
      prefix: 'ok',
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
      /* Alle elevane får det same kryssordet i Ordkryss — berre namnet på
         arket skil dei. Difor ein annan hale enn standardteksten. */
      emptyText: 'Utan namn blir det eitt ark med blank namnelinje. Hentar du namn, ' +
                 'får kvar elev sitt eige ark med same kryssord.',
      filledText: 'Kvar elev får eit ark med same kryssord.',
      read: function () {
        return { names: state.data.names, source: state.data.nameSource };
      },
      onApply: function (names, source) {
        state.data.names = names;
        state.data.nameSource = source;
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
