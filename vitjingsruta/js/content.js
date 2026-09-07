/* ══════════════════════════════════════════════
   CONTENT.JS — Innhaldstypar

   Ein QR-kode inneheld alltid berre tekst. Det som avgjer om telefonen
   opnar ei nettside, koplar seg til eit trådlaust nett eller tilbyr å
   lagre ein kontakt, er kva FORM teksten har. Kvar type her veit si eiga
   form, og skjemaet blir bygd frå felt-lista.

   Escapinga er ikkje valfri: står det eit semikolon i WiFi-passordet og
   vi ikkje rømmer det, blir resten av strengen lesen som eit nytt felt,
   og koden koplar til feil nett — eller ingen.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.content = (function () {
  'use strict';

  /* ──────────────── Hjelparar ──────────────── */

  function t(v) { return String(v == null ? '' : v).trim(); }

  /* WIFI- og MECARD-formata rømmer med bakstrek. */
  function escMeta(v) {
    return t(v).replace(/([\\;,:"])/g, '\\$1');
  }

  /* vCard skil felt med semikolon og linjer med CRLF; begge må rømmast,
     og ei rå linjeskifting i eit notat ville elles avslutte feltet. */
  function escVcard(v) {
    return t(v)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function escIcal(v) { return escVcard(v); }

  /* iCalendar vil ha UTC på forma 20260906T143000Z. Feltet frå nettlesaren
     er lokal tid utan sone, så vi lèt Date tolke han lokalt og skriv UTC. */
  function icalTime(local) {
    if (!local) return '';
    const d = new Date(local);
    if (isNaN(d.getTime())) return '';
    const p = (x) => String(x).padStart(2, '0');
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
      'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  }

  /* Telefonnummer: behald pluss og siffer, kast mellomrom og bindestrekar.
     tel:-skjemaet toler dei, men ein del eldre skannarar gjer det ikkje. */
  function phone(v) {
    return t(v).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  }

  function lines(arr) {
    return arr.filter(l => l != null && l !== '').join('\r\n');
  }

  /* ──────────────── Typane ──────────────── */

  const TYPES = [
    {
      id: 'url',
      label: 'Lenkje',
      icon: 'link',
      hint: 'Den vanlegaste bruken: ei nettadresse nokon skal opne.',
      fields: [
        { name: 'url', label: 'Nettadresse', type: 'text', placeholder: 'vyrdepil.no/ordkryss', wide: true }
      ],
      build(v) {
        let u = t(v.url);
        if (!u) return '';
        /* Utan protokoll blir strengen lesen som rein tekst av mange
           skannarar, og då opnar ingenting. */
        if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
        return u;
      },
      warn(v) {
        const u = t(v.url);
        if (!u) return null;
        if (/\s/.test(u)) return 'Adressa har mellomrom. Dei fleste skannarar stoppar ved det første.';
        const host = u.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0];
        if (/[æøåÆØÅ]/.test(host)) {
          return 'Domenet har æ, ø eller å. Det verkar ofte, men ikkje overalt — vurder punycode-forma.';
        }
        return null;
      }
    },

    {
      id: 'text',
      label: 'Fritekst',
      icon: 'text',
      hint: 'Rein tekst. Telefonen viser han fram; han opnar ingenting.',
      fields: [
        { name: 'text', label: 'Tekst', type: 'textarea', placeholder: 'Skriv teksten her …', wide: true }
      ],
      build(v) { return t(v.text); }
    },

    {
      id: 'wifi',
      label: 'Trådlaust nett',
      icon: 'wifi',
      hint: 'Skann og bli kopla til. Sparer deg for å lese opp eit passord på tjue teikn.',
      fields: [
        { name: 'ssid', label: 'Nettnamn (SSID)', type: 'text' },
        { name: 'security', label: 'Tryggleik', type: 'select', options: [
          { value: 'WPA', label: 'WPA/WPA2/WPA3' },
          { value: 'WEP', label: 'WEP (gammalt)' },
          { value: 'nopass', label: 'Ope nett' }
        ] },
        { name: 'password', label: 'Passord', type: 'text' },
        { name: 'hidden', label: 'Nettet er skjult', type: 'checkbox' }
      ],
      build(v) {
        const ssid = t(v.ssid);
        if (!ssid) return '';
        const sec = v.security || 'WPA';
        const parts = ['WIFI:', 'T:' + sec + ';', 'S:' + escMeta(ssid) + ';'];
        if (sec !== 'nopass') parts.push('P:' + escMeta(v.password) + ';');
        if (v.hidden) parts.push('H:true;');
        return parts.join('') + ';';
      },
      warn(v) {
        if (t(v.ssid) && v.security !== 'nopass' && !t(v.password)) {
          return 'Passordfeltet er tomt. Vel «Ope nett» om nettet ikkje har passord.';
        }
        return null;
      }
    },

    {
      id: 'vcard',
      label: 'Kontaktkort',
      icon: 'contact',
      hint: 'Telefonen tilbyr å lagre kontakten. Nyttig på foreldremøte og konferansar.',
      fields: [
        { name: 'firstName', label: 'Fornamn', type: 'text' },
        { name: 'lastName', label: 'Etternamn', type: 'text' },
        { name: 'org', label: 'Organisasjon', type: 'text' },
        { name: 'title', label: 'Tittel', type: 'text' },
        { name: 'phone', label: 'Telefon', type: 'text' },
        { name: 'email', label: 'E-post', type: 'text' },
        { name: 'url', label: 'Nettstad', type: 'text' },
        { name: 'address', label: 'Adresse', type: 'text', wide: true },
        { name: 'format', label: 'Format', type: 'select', options: [
          { value: 'vcard', label: 'vCard 3.0 (best støtte)' },
          { value: 'mecard', label: 'MeCard (kortare kode)' }
        ] }
      ],
      build(v) {
        const first = t(v.firstName), last = t(v.lastName);
        const full = [first, last].filter(Boolean).join(' ');
        if (!full && !t(v.org) && !t(v.phone) && !t(v.email)) return '';

        if (v.format === 'mecard') {
          const parts = ['MECARD:'];
          if (full) parts.push('N:' + escMeta(last) + ',' + escMeta(first) + ';');
          if (t(v.phone)) parts.push('TEL:' + escMeta(phone(v.phone)) + ';');
          if (t(v.email)) parts.push('EMAIL:' + escMeta(v.email) + ';');
          if (t(v.org)) parts.push('ORG:' + escMeta(v.org) + ';');
          if (t(v.url)) parts.push('URL:' + escMeta(v.url) + ';');
          if (t(v.address)) parts.push('ADR:' + escMeta(v.address) + ';');
          return parts.join('') + ';';
        }

        return lines([
          'BEGIN:VCARD',
          'VERSION:3.0',
          'N:' + escVcard(last) + ';' + escVcard(first) + ';;;',
          full ? 'FN:' + escVcard(full) : null,
          t(v.org) ? 'ORG:' + escVcard(v.org) : null,
          t(v.title) ? 'TITLE:' + escVcard(v.title) : null,
          t(v.phone) ? 'TEL;TYPE=CELL:' + escVcard(phone(v.phone)) : null,
          t(v.email) ? 'EMAIL;TYPE=INTERNET:' + escVcard(v.email) : null,
          t(v.url) ? 'URL:' + escVcard(v.url) : null,
          t(v.address) ? 'ADR;TYPE=WORK:;;' + escVcard(v.address) + ';;;;' : null,
          'END:VCARD'
        ]);
      }
    },

    {
      id: 'email',
      label: 'E-post',
      icon: 'mail',
      hint: 'Opnar e-postprogrammet med mottakar, emne og tekst ferdig utfylt.',
      fields: [
        { name: 'to', label: 'Mottakar', type: 'text' },
        { name: 'subject', label: 'Emne', type: 'text' },
        { name: 'body', label: 'Melding', type: 'textarea', wide: true }
      ],
      build(v) {
        const to = t(v.to);
        if (!to) return '';
        const q = [];
        if (t(v.subject)) q.push('subject=' + encodeURIComponent(t(v.subject)));
        if (t(v.body)) q.push('body=' + encodeURIComponent(t(v.body)));
        return 'mailto:' + to + (q.length ? '?' + q.join('&') : '');
      }
    },

    {
      id: 'sms',
      label: 'SMS',
      icon: 'messageSquare',
      hint: 'Opnar meldingsprogrammet med nummer og tekst klar. Sender ikkje sjølv.',
      fields: [
        { name: 'number', label: 'Telefonnummer', type: 'text' },
        { name: 'message', label: 'Melding', type: 'textarea', wide: true }
      ],
      build(v) {
        const nr = phone(v.number);
        return nr ? 'SMSTO:' + nr + ':' + t(v.message) : '';
      }
    },

    {
      id: 'tel',
      label: 'Telefon',
      icon: 'phone',
      hint: 'Legg nummeret i tastaturet. Ringer ikkje av seg sjølv.',
      fields: [
        { name: 'number', label: 'Telefonnummer', type: 'text' }
      ],
      build(v) {
        const nr = phone(v.number);
        return nr ? 'tel:' + nr : '';
      }
    },

    {
      id: 'geo',
      label: 'Posisjon',
      icon: 'mapPin',
      hint: 'Opnar kartprogrammet på staden. Koordinatane finn du ved å høgreklikke i eit kart.',
      fields: [
        { name: 'lat', label: 'Breiddegrad', type: 'text', placeholder: '60.3913' },
        { name: 'lon', label: 'Lengdegrad', type: 'text', placeholder: '5.3221' }
      ],
      build(v) {
        const la = t(v.lat).replace(',', '.');
        const lo = t(v.lon).replace(',', '.');
        if (!la || !lo || !isFinite(+la) || !isFinite(+lo)) return '';
        return 'geo:' + (+la) + ',' + (+lo);
      },
      warn(v) {
        const la = +t(v.lat).replace(',', '.');
        const lo = +t(v.lon).replace(',', '.');
        if (t(v.lat) && (!isFinite(la) || la < -90 || la > 90)) return 'Breiddegraden må vere mellom −90 og 90.';
        if (t(v.lon) && (!isFinite(lo) || lo < -180 || lo > 180)) return 'Lengdegraden må vere mellom −180 og 180.';
        return null;
      }
    },

    {
      id: 'event',
      label: 'Kalenderhending',
      icon: 'calendar',
      hint: 'Telefonen tilbyr å leggje hendinga i kalenderen.',
      fields: [
        { name: 'summary', label: 'Tittel', type: 'text', wide: true },
        { name: 'location', label: 'Stad', type: 'text', wide: true },
        { name: 'start', label: 'Startar', type: 'datetime-local' },
        { name: 'end', label: 'Sluttar', type: 'datetime-local' }
      ],
      build(v) {
        const s = t(v.summary);
        if (!s) return '';
        return lines([
          'BEGIN:VEVENT',
          'SUMMARY:' + escIcal(s),
          t(v.location) ? 'LOCATION:' + escIcal(v.location) : null,
          icalTime(v.start) ? 'DTSTART:' + icalTime(v.start) : null,
          icalTime(v.end) ? 'DTEND:' + icalTime(v.end) : null,
          'END:VEVENT'
        ]);
      },
      warn(v) {
        if (v.start && v.end && new Date(v.end) <= new Date(v.start)) {
          return 'Hendinga sluttar før ho startar.';
        }
        return null;
      }
    }
  ];

  function byId(id) {
    for (let i = 0; i < TYPES.length; i++) {
      if (TYPES[i].id === id) return TYPES[i];
    }
    return TYPES[0];
  }

  /** Byggjer strengen for eit heilt innhaldsobjekt {type, values{}}. */
  function build(content) {
    if (!content) return '';
    return byId(content.type).build(content.values || {}) || '';
  }

  function warn(content) {
    if (!content) return null;
    const type = byId(content.type);
    return type.warn ? type.warn(content.values || {}) : null;
  }

  return { TYPES, byId, build, warn };
})();
