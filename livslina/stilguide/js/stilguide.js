/* Livslina — stilguide: palett-visning og paper doll-kontrollar. */
(function () {
  'use strict';

  const PALETTE = [
    { hex: '#1a1a1a', name: 'Blekk', note: 'kontur og skugge' },
    { hex: '#faf7f0', name: 'Papir', note: 'plate/bakgrunn' },
    { hex: '#e63946', name: 'Raud' },
    { hex: '#2b6cb0', name: 'Blå' },
    { hex: '#2f9e63', name: 'Grøn' },
    { hex: '#f4b942', name: 'Gul' },
    { hex: '#7c5cd6', name: 'Lilla' },
    { hex: '#ef7d2f', name: 'Oransje' },
    { hex: '#8a5a33', name: 'Treverk' },
    { hex: '#d9d3c7', name: 'Lys grå' },
    { hex: '#8a8378', name: 'Mørk grå' },
    { hex: '#f6d7b0', name: 'Hud 1', note: 'berre figurar' },
    { hex: '#e8b98a', name: 'Hud 2', note: 'berre figurar' },
    { hex: '#b07b4f', name: 'Hud 3', note: 'berre figurar' },
    { hex: '#7c4a2a', name: 'Hud 4', note: 'berre figurar' },
    { hex: '#26201c', name: 'Hår mørk' },
    { hex: '#e3b23c', name: 'Hår blond' },
    { hex: '#c1502e', name: 'Hår raud' },
    { hex: '#6b6b6b', name: 'Hår grå' }
  ];

  const SKIN_TONES = ['#f6d7b0', '#e8b98a', '#b07b4f', '#7c4a2a'];
  const HAIR_COLORS = ['#26201c', '#e3b23c', '#c1502e', '#6b6b6b'];
  const TOP_COLORS = ['#e63946', '#2b6cb0', '#2f9e63', '#f4b942', '#7c5cd6'];

  const HAIR_STYLES = [
    { id: 'kort', label: 'Kort' },
    { id: 'langt', label: 'Langt' },
    { id: 'krollete', label: 'Krøllete' }
  ];
  const TOP_STYLES = [
    { id: 'tskjorte', label: 'T-skjorte' },
    { id: 'genser', label: 'Genser' },
    { id: 'hettegenser', label: 'Hettegenser' }
  ];

  const ROOM_BEDS = [
    { id: 'madrass', label: 'Madrass på golvet' },
    { id: 'seng', label: 'Skikkeleg seng' }
  ];
  const ROOM_DESKS = [
    { id: 'enkel', label: 'Enkel pult' },
    { id: 'gaming', label: 'Gaming-oppsett' }
  ];
  const ROOM_HOBBIES = [
    { id: 'plante', label: 'Grønplante' },
    { id: 'gitar', label: 'Gitar' },
    { id: 'trening', label: 'Treningsutstyr' }
  ];

  const svg = document.getElementById('dollSvg');
  const roomSvg = document.getElementById('roomSvg');

  function renderPalette() {
    const wrap = document.getElementById('palette');
    PALETTE.forEach((c) => {
      const chip = document.createElement('div');
      chip.className = 'll-chip';
      const dot = document.createElement('span');
      dot.className = 'll-chip-dot';
      dot.style.background = c.hex;
      const label = document.createElement('span');
      label.textContent = c.name;
      const small = document.createElement('small');
      small.textContent = c.note ? c.hex + ' — ' + c.note : c.hex;
      label.appendChild(small);
      chip.append(dot, label);
      wrap.appendChild(chip);
    });
  }

  function makeSwatchRow(rowId, colors, cssVar, groupLabel) {
    const row = document.getElementById(rowId);
    colors.forEach((hex, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'll-swatch';
      btn.style.background = hex;
      btn.setAttribute('aria-label', groupLabel + ' ' + (i + 1));
      btn.setAttribute('aria-pressed', String(svg.style.getPropertyValue(cssVar).trim() === hex));
      btn.addEventListener('click', () => {
        svg.style.setProperty(cssVar, hex);
        row.querySelectorAll('.ll-swatch').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
      });
      row.appendChild(btn);
    });
  }

  function makeVariantRow(targetSvg, rowId, styles, layerClass) {
    const row = document.getElementById(rowId);
    styles.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = s.label;
      btn.setAttribute('aria-pressed', String(i === 0));
      btn.addEventListener('click', () => {
        targetSvg.querySelectorAll('.' + layerClass).forEach((g) => {
          g.toggleAttribute('hidden', g.dataset.variant !== s.id);
        });
        row.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
      });
      row.appendChild(btn);
    });
  }

  renderPalette();
  makeSwatchRow('skinRow', SKIN_TONES, '--doll-skin', 'Hudtone');
  makeSwatchRow('hairRow', HAIR_COLORS, '--doll-hair', 'Hårfarge');
  makeSwatchRow('topRow', TOP_COLORS, '--doll-top', 'Farge på overdel');
  makeVariantRow(svg, 'hairStyleRow', HAIR_STYLES, 'doll-hair');
  makeVariantRow(svg, 'topStyleRow', TOP_STYLES, 'doll-top');
  makeVariantRow(roomSvg, 'bedRow', ROOM_BEDS, 'slot-bed');
  makeVariantRow(roomSvg, 'deskRow', ROOM_DESKS, 'slot-desk');
  makeVariantRow(roomSvg, 'hobbyRow', ROOM_HOBBIES, 'slot-hobby');
})();
