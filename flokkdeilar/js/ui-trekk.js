/* ══════════════════════════════════════
   UI-TREKK.JS — Trekke-skjerm
   ══════════════════════════════════════ */

(function () {
    'use strict';

    /* ── Hent liste-ID frå URL ── */
    const params = new URLSearchParams(location.search);
    const listId = params.get('id');
    if (!listId) { location.href = 'index.html'; return; }

    let liste = FStorage.getById(listId);
    if (!liste) { location.href = 'index.html'; return; }

    /* ── State ── */
    let absentIds    = new Set();
    let lockedGroups = [];
    let lastGroups   = [];

    /* ── DOM ── */
    const listeTittel  = document.getElementById('listeTittel');
    const elevChips    = document.getElementById('elevChips');
    const selectMode   = document.getElementById('selectMode');
    const inputValue   = document.getElementById('inputValue');
    const valueLabel   = document.getElementById('valueLabel');
    const selectCat    = document.getElementById('selectCategory');
    const sizePreview  = document.getElementById('sizePreview');
    const btnTrekk     = document.getElementById('btnTrekk');
    const btnNyttTrekk = document.getElementById('btnNyttTrekk');
    const resultArea   = document.getElementById('resultArea');
    const groupsGrid   = document.getElementById('groupsGrid');
    const warningBox   = document.getElementById('warningBox');
    const warningText  = document.getElementById('warningText');
    const btnSkrivUt   = document.getElementById('btnSkrivUt');
    const btnLagrePng  = document.getElementById('btnLagrePng');
    const printTittel  = document.getElementById('printTittel');
    const printDato    = document.getElementById('printDato');

    /* ── Ikon ── */
    document.getElementById('icon-back').appendChild(Icons.create('arrow-left', 16));
    document.getElementById('icon-shuffle').appendChild(Icons.create('shuffle', 18));
    document.getElementById('icon-refresh').appendChild(Icons.create('refresh-cw', 16));
    document.getElementById('icon-warning').appendChild(Icons.create('alert-triangle', 18));
    document.getElementById('icon-printer').appendChild(Icons.create('printer', 16));
    document.getElementById('icon-image').appendChild(Icons.create('image', 16));

    /* ── Tittel ── */
    listeTittel.textContent = liste.name;
    document.title = `Flokkdeilar — ${liste.name}`;

    /* ── Kategori-val ── */
    Names.getCategories().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        selectCat.appendChild(opt);
    });

    /* ── Elev-chips ── */
    function renderChips() {
        elevChips.innerHTML = '';
        (liste.students || []).forEach(s => {
            const chip = document.createElement('button');
            chip.className = 'elev-chip' + (absentIds.has(s.id) ? ' absent' : '');
            chip.setAttribute('aria-pressed', absentIds.has(s.id) ? 'true' : 'false');
            chip.setAttribute('aria-label', `${s.name} — ${absentIds.has(s.id) ? 'fråverande' : 'til stades'}`);
            chip.textContent = s.name;
            if (absentIds.has(s.id)) {
                const x = document.createElement('span');
                x.className = 'chip-x';
                x.setAttribute('aria-hidden', 'true');
                x.textContent = '✕';
                chip.appendChild(x);
            }
            chip.addEventListener('click', () => {
                if (absentIds.has(s.id)) absentIds.delete(s.id);
                else absentIds.add(s.id);
                updatePreview();
                renderChips();
            });
            elevChips.appendChild(chip);
        });
    }

    /* ── Storleiks-førehandsvising ── */
    function updatePreview() {
        const active = (liste.students || []).filter(s => !absentIds.has(s.id));
        if (active.length === 0) { sizePreview.textContent = ''; return; }
        const label = Generator.sizeLabel(
            liste.students.length,
            selectMode.value,
            parseInt(inputValue.value) || 1,
            absentIds.size
        );
        sizePreview.textContent = label;
    }

    selectMode.addEventListener('change', () => {
        valueLabel.textContent = selectMode.value === 'size' ? 'Storleik per gruppe' : 'Tal grupper';
        updatePreview();
    });

    inputValue.addEventListener('input', updatePreview);
    selectCat.addEventListener('change', updatePreview);

    /* ── Trekk! ── */
    function doTrekk(keepLocked) {
        liste = FStorage.getById(listId); // oppdatert versjon
        const active = (liste.students || []).filter(s => !absentIds.has(s.id));
        if (active.length === 0) return;

        const locked = keepLocked ? lockedGroups : [];

        warningBox.style.display = 'none';

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const result = Generator.generate(
            active,
            liste.relations || {},
            selectMode.value,
            parseInt(inputValue.value) || 1,
            selectCat.value,
            locked
        );

        lastGroups   = result.groups;
        /* Låste grupper kjem alltid fyrst i result.groups (frå generator.js) */
        lockedGroups = result.groups.slice(0, locked.length);

        if (result.warning) {
            warningText.textContent = result.warning;
            warningBox.style.display = '';
        }

        renderGroups(result.groups, prefersReduced);
        printTittel.textContent = liste.name;
        printDato.textContent = new Date().toLocaleDateString('nn-NO', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        resultArea.style.display = '';
    }

    btnTrekk.addEventListener('click', () => {
        lockedGroups = [];
        doTrekk(false);
    });

    btnNyttTrekk.addEventListener('click', () => doTrekk(true));

    /* ── Eksport ── */
    btnSkrivUt.addEventListener('click', () => FlokkExport.printGroups());

    btnLagrePng.addEventListener('click', async () => {
        if (lastGroups.length === 0) return;
        btnLagrePng.disabled = true;
        try {
            await FlokkExport.toPNG(lastGroups, liste.name);
        } finally {
            btnLagrePng.disabled = false;
        }
    });

    /* ── Render gruppekort ── */
    function renderGroups(groups, noAnim) {
        groupsGrid.innerHTML = '';

        groups.forEach((g, idx) => {
            const isLocked = lockedGroups.some(l => l === g);
            const card = document.createElement('div');
            card.className = 'group-card' + (isLocked ? ' locked' : '') + (noAnim ? '' : ' animate-in');
            card.style.background = g.color;
            if (!noAnim) card.style.animationDelay = `${idx * 60}ms`;

            /* Lås-knapp */
            const lockBtn = document.createElement('button');
            lockBtn.className = 'group-card-lock';
            lockBtn.setAttribute('aria-label', isLocked ? 'Lås opp gruppe' : 'Lås gruppe');
            lockBtn.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
            lockBtn.appendChild(Icons.create(isLocked ? 'lock' : 'unlock', 18));
            lockBtn.addEventListener('click', () => {
                if (isLocked) {
                    lockedGroups = lockedGroups.filter(l => l !== g);
                } else {
                    lockedGroups = [...lockedGroups, g];
                }
                renderGroups(lastGroups, true);
            });

            /* Ikon */
            const iconWrap = document.createElement('div');
            iconWrap.className = 'group-card-icon';
            iconWrap.appendChild(Icons.create(g.icon, 56));

            /* Namn */
            const name = document.createElement('div');
            name.className = 'group-card-name';
            name.textContent = g.name;

            /* Elevliste */
            const ul = document.createElement('ul');
            ul.className = 'group-card-members';
            (g.members || []).forEach(m => {
                const li = document.createElement('li');
                li.textContent = m.name;
                ul.appendChild(li);
            });

            card.appendChild(lockBtn);
            card.appendChild(iconWrap);
            card.appendChild(name);
            card.appendChild(ul);
            groupsGrid.appendChild(card);
        });
    }

    /* ── Init ── */
    renderChips();
    updatePreview();

})();
