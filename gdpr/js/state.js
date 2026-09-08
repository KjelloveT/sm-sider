/* ══════════════════════════════════════════════
   STATE.JS — Protokollen du arbeider med no

   Observatørmønster som i `leitekryss/js/state.js`: modulane melder seg på med
   `onChange(fn)`, og `emit(emne)` fortel kva som endra seg. Emna er:

     'forside'    kontaktopplysningar, godkjenning, omgrep
     'liste'      aktivitetar lagde til, fjerna eller flytte
     'aktivitet'  eit felt i den aktive aktiviteten endra seg
     'val'        kva aktivitet som er open
     'avvist'     eit funn frå kvalitetssjekken vart avvist
     'load'       heile protokollen vart bytt ut

   `emit` er brukt framfor å la kvar modul lese tilstanden på nytt heile tida,
   fordi 19 felt × mange aktivitetar blir mykje unødig teikning.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const APP = 'gdpr-protokoll';
  const VERSJON = 1;

  const lyttarar = [];
  let aktivId = null;

  function tomForside() {
    const f = {};
    GD.felt.FORSIDE.forEach(function (felt) { f[felt.id] = ''; });
    return f;
  }

  function tom() {
    return {
      id: GD.util.uuid(),
      namn: '',
      dato: new Date().toISOString(),
      forside: tomForside(),
      /* Endringshistorikk. Datatilsynet har han på forsida i malen sin, og
         det er ikkje pynt: artikkel 30 krev at protokollen er oppdatert, og
         då må ein kunne sjå kva som er endra og av kven. */
      endringar: [],
      aktivitetar: [],
      /* Funn frå kvalitetssjekken brukaren har vurdert og avvist, med grunn.
         Sjå `sjekk.js` for kvifor det er mogleg i det heile. */
      avviste: []
    };
  }

  let data = tom();

  function emit(emne) {
    lyttarar.forEach(function (fn) { fn(emne, data); });
  }

  function onChange(fn) {
    lyttarar.push(fn);
  }

  /* ──────────────── Aktivitetar ──────────────── */

  function aktivitetar() {
    return data.aktivitetar;
  }

  function aktiv() {
    if (!aktivId) return null;
    return data.aktivitetar.filter(function (a) { return a.id === aktivId; })[0] || null;
  }

  function velg(id) {
    aktivId = id;
    emit('val');
  }

  function leggTil(mal) {
    const a = GD.felt.tomAktivitet(GD.util.uuid());
    if (mal) {
      Object.keys(mal).forEach(function (k) {
        if (k !== 'id' && mal[k] != null) a[k] = mal[k];
      });
    }
    data.aktivitetar.push(a);
    aktivId = a.id;
    emit('liste');
    emit('val');
    return a;
  }

  /* Ein kopi er den vanlegaste måten å leggje til nummer to på: same
     funksjonsområde, same system, same sikringstiltak, ulikt formål. */
  function dupliser(id) {
    const kjelde = data.aktivitetar.filter(function (a) { return a.id === id; })[0];
    if (!kjelde) return null;
    const ny = leggTil(kjelde);
    return ny;
  }

  function slett(id) {
    data.aktivitetar = data.aktivitetar.filter(function (a) { return a.id !== id; });
    /* Avviste funn som peika på denne aktiviteten har ikkje lenger noko å
       peike på, og ville elles blitt liggjande i fila for alltid. */
    data.avviste = data.avviste.filter(function (v) { return v.aktivitet !== id; });
    if (aktivId === id) aktivId = data.aktivitetar.length ? data.aktivitetar[0].id : null;
    emit('liste');
    emit('val');
  }

  function flytt(id, steg) {
    const i = data.aktivitetar.findIndex(function (a) { return a.id === id; });
    const j = i + steg;
    if (i === -1 || j < 0 || j >= data.aktivitetar.length) return;
    const t = data.aktivitetar[i];
    data.aktivitetar[i] = data.aktivitetar[j];
    data.aktivitetar[j] = t;
    emit('liste');
  }

  function settFelt(id, feltId, verdi) {
    const a = data.aktivitetar.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    a[feltId] = verdi;
    emit('aktivitet');
  }

  /* ──────────────── Forside ──────────────── */

  function settForside(feltId, verdi) {
    data.forside[feltId] = verdi;
    emit('forside');
  }

  function leggEndring(rad) {
    data.endringar.push({
      namn: rad.namn || '',
      dato: rad.dato || new Date().toISOString().slice(0, 10),
      skildring: rad.skildring || ''
    });
    emit('forside');
  }

  function slettEndring(i) {
    data.endringar.splice(i, 1);
    emit('forside');
  }

  /* ──────────────── Avviste funn ──────────────── */

  function avvis(regelId, aktivitetId, grunn) {
    data.avviste = data.avviste.filter(function (v) {
      return !(v.regel === regelId && v.aktivitet === aktivitetId);
    });
    data.avviste.push({ regel: regelId, aktivitet: aktivitetId || null, grunn: grunn || '' });
    emit('avvist');
  }

  function angreAvvis(regelId, aktivitetId) {
    data.avviste = data.avviste.filter(function (v) {
      return !(v.regel === regelId && v.aktivitet === aktivitetId);
    });
    emit('avvist');
  }

  function erAvvist(regelId, aktivitetId) {
    return data.avviste.some(function (v) {
      return v.regel === regelId && v.aktivitet === (aktivitetId || null);
    });
  }

  /* ──────────────── Lagring og lasting ──────────────── */

  /** Til lagring og til eksport. Same objekt til begge (AGENTS.md §5.2). */
  function serialize(namn) {
    return {
      app: APP,
      version: VERSJON,
      id: data.id || GD.util.uuid(),
      name: namn || data.namn || data.forside.verksemd || 'Utan namn',
      date: new Date().toISOString(),
      forside: Object.assign({}, data.forside),
      endringar: data.endringar.map(function (e) { return Object.assign({}, e); }),
      aktivitetar: data.aktivitetar.map(function (a) { return Object.assign({}, a); }),
      avviste: data.avviste.map(function (v) { return Object.assign({}, v); })
    };
  }

  /**
   * Byggjer tilstanden opp att frå ei lagra fil. Defensivt heile vegen: fila
   * kan kome frå ein eldre versjon, eller vere halvskriven fordi nokon lukka
   * fana midt i ei nedlasting.
   */
  function load(lagra) {
    const n = tom();
    if (lagra && typeof lagra === 'object') {
      n.id = lagra.id || n.id;
      n.namn = lagra.name || '';
      n.dato = lagra.date || n.dato;

      if (lagra.forside && typeof lagra.forside === 'object') {
        GD.felt.FORSIDE.forEach(function (f) {
          if (typeof lagra.forside[f.id] === 'string') n.forside[f.id] = lagra.forside[f.id];
        });
      }

      if (Array.isArray(lagra.endringar)) {
        n.endringar = lagra.endringar.filter(function (e) { return e && typeof e === 'object'; })
          .map(function (e) {
            return { namn: e.namn || '', dato: e.dato || '', skildring: e.skildring || '' };
          });
      }

      if (Array.isArray(lagra.aktivitetar)) {
        n.aktivitetar = lagra.aktivitetar
          .filter(function (a) { return a && typeof a === 'object'; })
          .map(function (a) {
            /* Byggjer frå ein tom aktivitet, så eit felt som kom til seinare
               finst sjølv om fila er eldre enn feltet. */
            const ut = GD.felt.tomAktivitet(a.id || GD.util.uuid());
            GD.felt.AKTIVITET.forEach(function (f) {
              if (typeof a[f.id] === 'string') ut[f.id] = a[f.id];
            });
            return ut;
          });
      }

      if (Array.isArray(lagra.avviste)) {
        n.avviste = lagra.avviste.filter(function (v) { return v && v.regel; })
          .map(function (v) {
            return { regel: v.regel, aktivitet: v.aktivitet || null, grunn: v.grunn || '' };
          });
      }
    }
    data = n;
    aktivId = data.aktivitetar.length ? data.aktivitetar[0].id : null;
    emit('load');
  }

  function nullstill() {
    load(null);
  }

  root.GD = root.GD || {};
  root.GD.state = {
    APP: APP,
    VERSJON: VERSJON,
    get data() { return data; },
    emit: emit,
    onChange: onChange,
    aktivitetar: aktivitetar,
    aktiv: aktiv,
    aktivId: function () { return aktivId; },
    velg: velg,
    leggTil: leggTil,
    dupliser: dupliser,
    slett: slett,
    flytt: flytt,
    settFelt: settFelt,
    settForside: settForside,
    leggEndring: leggEndring,
    slettEndring: slettEndring,
    avvis: avvis,
    angreAvvis: angreAvvis,
    erAvvist: erAvvist,
    serialize: serialize,
    load: load,
    nullstill: nullstill
  };
})(window);
