/* ══════════════════════════════════════
   APP.JS — Main application logic
   ══════════════════════════════════════ */

const App = (() => {
    let students = [];
    let swapMode = false;
    let swapFirst = null;
    let selectedLayout = null;

    function init() {
        Grid.init();
        injectIcons();
        bindToolbar();
        bindModals();
        bindSidebar();
        bindElementTools();
        bindKeyboard();
        
        // Initialize tabs after other modules
        Tabs.init();
        
        Storage.pushHistory(); // Initial state
    }

    function bindKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    Storage.redo();
                } else {
                    Storage.undo();
                }
            } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                Storage.redo();
            }
        });
    }

    /* Inject SVG icons into all [data-icon] placeholders.
       Det felles ikon-laget (js/vyrdepil-icons.js) hydrerer òg [data-icon] på
       DOMContentLoaded, men alltid i 18px. Vi vil ha kontekstavhengige
       storleikar, så vi tømmer plassholdaren først og merkar han som ferdig —
       elles hamnar det to SVG-ar i kvar knapp. */
    function injectIcons() {
        document.querySelectorAll('[data-icon]').forEach(el => {
            const name = el.dataset.icon;
            const size = el.classList.contains('mh-icon') ? 20
                       : el.classList.contains('sh-icon') ? 16
                       : el.closest('.element-tools, .tool-btn') ? 14
                       : el.closest('.tb-btn, .sb-btn') ? 16
                       : 18;
            el.textContent = '';
            el.appendChild(Icons.create(name, size));
            el.dataset.iconDone = '1';
        });
        /* Logo */
        const logo = document.getElementById('logo-icon');
        if (logo) logo.appendChild(Icons.create('armchair', 26));
    }

    /* ════════════════════════════════
       STUDENT LIST
       ════════════════════════════════ */

    function getStudentList() {
        return [...students];
    }

    function setStudentList(list) {
        students = [...list];
    }

    function refreshStudentPanel() {
        const container = document.getElementById('student-list');
        container.innerHTML = '';

        if (students.length === 0) {
            container.innerHTML = '<p class="placeholder-text">Ingen elevar lagt til enno.</p>';
            return;
        }

        const placedIds = new Set(Grid.getDesks().map(d => d.dataset.studentId));

        students.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'student-chip';
            if (placedIds.has(s.id)) chip.classList.add('placed');
            chip.dataset.studentId = s.id;
            chip.draggable = !placedIds.has(s.id);

            const dot = document.createElement('span');
            dot.className = 'chip-color';
            dot.style.background = s.color || '#ffffff';

            const name = document.createElement('span');
            name.className = 'chip-name';
            name.textContent = s.name;

            chip.appendChild(dot);
            chip.appendChild(name);

            chip.addEventListener('dragstart', (e) => {
                if (chip.classList.contains('placed')) { e.preventDefault(); return; }
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'student', id: s.id, name: s.name, color: s.color }));
                chip.classList.add('drag-ghost');
            });
            chip.addEventListener('dragend', () => chip.classList.remove('drag-ghost'));

            container.appendChild(chip);
        });
    }

    /* ════════════════════════════════
       TOOLBAR BINDINGS
       ════════════════════════════════ */

    function bindToolbar() {
        document.getElementById('btn-layout').addEventListener('click', () => openModal('modal-layout'));
        document.getElementById('btn-shuffle').addEventListener('click', shuffleStudents);
        document.getElementById('btn-swap').addEventListener('click', toggleSwapMode);
        document.getElementById('btn-file').addEventListener('click', openFileModal);
        document.getElementById('btn-export-png').addEventListener('click', () => Export.toPNG());
        document.getElementById('btn-undo').addEventListener('click', () => Storage.undo());
        document.getElementById('btn-redo').addEventListener('click', () => Storage.redo());
        document.getElementById('btn-grid-toggle').addEventListener('click', toggleGrid);
        document.getElementById('btn-clear').addEventListener('click', clearAll);

        document.getElementById('btn-export-json').addEventListener('click', () => Storage.exportJSON());
        document.getElementById('btn-import-json').addEventListener('click', () => document.getElementById('import-file').click());

        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                Storage.importJSON(e.target.files[0]).then(() => {
                    e.target.value = '';
                    refreshLoadList();
                }).catch(err => alert('Kunne ikkje importere fila: ' + err.message));
            }
        });

        document.getElementById('btn-import-flokkdeilar').addEventListener('click', () => {
            const container = document.getElementById('flokkdeilar-list');
            container.innerHTML = '';
            const raw = localStorage.getItem('VyrdepilStorage');
            const data = raw ? JSON.parse(raw) : {};
            const lister = data['flokkdeilar']?.['lister'] || [];
            if (lister.length === 0) {
                container.textContent = 'Ingen Flokkdeilar-lister funne.';
                return;
            }
            lister.forEach(liste => {
                const students = (liste.students || []).filter(s => s.name);
                const btn = document.createElement('button');
                btn.className = 'tb-btn';
                btn.style.cssText = 'display:block;width:100%;margin-bottom:6px;text-align:left;';
                btn.textContent = `${liste.name} (${students.length} elevar)`;
                btn.addEventListener('click', () => {
                    App.setStudentList(students.map(s => ({ name: s.name, id: s.id, color: '#ffffff' })));
                    App.refreshStudentPanel();
                    Storage.pushHistory();
                    container.innerHTML = '<p style="color:green;font-weight:700;">✓ Elevliste henta!</p><p style="font-size:0.85rem;color:#555;margin-top:6px;">Merk: Lista er ikkje kopla til Flokkdeilar. Endringar i den eine appen oppdaterer ikkje den andre.</p>';
                });
                container.appendChild(btn);
            });
        });
    }

    function toggleGrid() {
        document.getElementById('canvas').classList.toggle('show-grid');
    }

    function clearAll() {
        if (!confirm('Er du sikker på at du vil tøme alt?')) return;
        Grid.clearCanvas();
        students = [];
        refreshStudentPanel();
        Storage.pushHistory();
    }

    /* ════════════════════════════════
       SHUFFLE (random placement)
       ════════════════════════════════ */

    function shuffleStudents() {
        const desks = Grid.getDesks();
        if (desks.length === 0) {
            alert('Ingen pultar på kartet. Vel eit oppsett først!');
            return;
        }

        const locked = desks.filter(d => d.dataset.locked === '1');
        const unlocked = desks.filter(d => d.dataset.locked !== '1');
        const lockedPositions = locked.map(d => ({
            x: parseInt(d.style.left),
            y: parseInt(d.style.top)
        }));

        const unlockedNames = unlocked.map(d => ({
            name: d.dataset.studentName,
            id: d.dataset.studentId,
            color: d.dataset.color
        }));

        for (let i = unlockedNames.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unlockedNames[i], unlockedNames[j]] = [unlockedNames[j], unlockedNames[i]];
        }

        unlocked.forEach((d, i) => {
            const info = unlockedNames[i];
            d.dataset.studentName = info.name;
            d.dataset.studentId = info.id;
            d.dataset.color = info.color;
            d.querySelector('.desk-name').textContent = info.name;
            if (info.color && info.color !== '#ffffff') {
                d.style.background = info.color;
            } else {
                d.style.background = '#FDFD96';
            }
        });

        refreshStudentPanel();
        Storage.pushHistory();
    }

    /* ════════════════════════════════
       SWAP MODE
       ════════════════════════════════ */

    function toggleSwapMode() {
        swapMode = !swapMode;
        swapFirst = null;
        document.getElementById('btn-swap').classList.toggle('active', swapMode);
        Grid.getCanvas().style.cursor = swapMode ? 'crosshair' : '';

        // Show/hide instruction toast
        let toast = document.getElementById('swap-toast');
        if (swapMode) {
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'swap-toast';
                toast.className = 'neo-box swap-toast';
                toast.textContent = 'Klikk på den første eleven du vil byte...';
                document.body.appendChild(toast);
            }
            toast.classList.remove('hidden');
            Grid.getCanvas().addEventListener('click', onSwapClick);
        } else {
            if (toast) toast.classList.add('hidden');
            Grid.getCanvas().removeEventListener('click', onSwapClick);
            Grid.getDesks().forEach(d => d.classList.remove('swap-target'));
        }
    }

    function exitSwapMode() {
        if (swapMode) toggleSwapMode();
    }

    function onSwapClick(e) {
        const desk = e.target.closest('.desk');
        if (!desk) return;

        const toast = document.getElementById('swap-toast');

        if (!swapFirst) {
            swapFirst = desk;
            desk.classList.add('swap-target');
            if (toast) toast.textContent = 'Klikk på eleven som skal byte plass med ' + desk.dataset.studentName + '...';
        } else {
            if (desk === swapFirst) {
                swapFirst.classList.remove('swap-target');
                swapFirst = null;
                if (toast) toast.textContent = 'Klikk på den første eleven du vil byte...';
                return;
            }

            const a = swapFirst;
            const b = desk;
            
            const aName = a.dataset.studentName;
            const aId = a.dataset.studentId;
            const aColor = a.dataset.color;
            
            a.dataset.studentName = b.dataset.studentName;
            a.dataset.studentId = b.dataset.studentId;
            a.dataset.color = b.dataset.color;
            a.querySelector('.desk-name').textContent = b.dataset.studentName;

            b.dataset.studentName = aName;
            b.dataset.studentId = aId;
            b.dataset.color = aColor;
            b.querySelector('.desk-name').textContent = aName;

            if (a.dataset.color !== '#ffffff') a.style.background = a.dataset.color;
            else a.style.background = '#FDFD96';
            if (b.dataset.color !== '#ffffff') b.style.background = b.dataset.color;
            else b.style.background = '#FDFD96';

            // Visual feedback: brief pulse
            a.style.transform = 'scale(1.1)';
            b.style.transform = 'scale(1.1)';
            setTimeout(() => {
                a.style.transform = '';
                b.style.transform = '';
            }, 200);

            a.classList.remove('swap-target');
            toggleSwapMode(); // Exit swap mode after one swap
            refreshStudentPanel();
            Storage.pushHistory();
        }
    }

    /* ════════════════════════════════
       MODALS
       ════════════════════════════════ */

    function openModal(id) {
        document.getElementById(id).classList.remove('hidden');
    }

    function closeModal(id) {
        document.getElementById(id).classList.add('hidden');
    }

    function bindModals() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.dataset.close));
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.add('hidden');
            });
        });

        document.getElementById('btn-students-ok').addEventListener('click', addStudents);
        bindLayoutModal();
        bindFileModal();
    }

    /* ── Add students modal ── */
    function addStudents() {
        const input = document.getElementById('student-input');
        const names = input.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
        if (names.length === 0) return;

        names.forEach(name => {
            if (!students.find(s => s.name === name)) {
                students.push({
                    id: crypto.randomUUID(),
                    name,
                    color: '#ffffff'
                });
            }
        });

        input.value = '';
        closeModal('modal-students');
        refreshStudentPanel();
        Storage.pushHistory();
    }

    /* ── Layout modal ── */
    function bindLayoutModal() {
        const cards = document.querySelectorAll('.layout-card');
        const groupCfg = document.getElementById('layout-group-size');
        const applyBtn = document.getElementById('btn-apply-layout');

        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedLayout = card.dataset.layout;

                if (selectedLayout === 'groups') {
                    groupCfg.classList.remove('hidden');
                } else {
                    groupCfg.classList.add('hidden');
                    applyLayout(selectedLayout);
                    closeModal('modal-layout');
                }
            });
        });

        applyBtn.addEventListener('click', () => {
            const perGroup = parseInt(document.getElementById('group-size-select').value);
            applyLayout('groups', perGroup);
            closeModal('modal-layout');
        });
    }

    function applyLayout(type, perGroup) {
        if (students.length === 0) {
            alert('Legg til elevar først!');
            return;
        }

        Grid.clearDesks();
        const { w, h } = Grid.getCanvasSize();
        const positions = Layouts.generate(type, students.length, w, h, perGroup);

        students.forEach((s, i) => {
            if (i < positions.length) {
                Grid.createDesk(s.name, positions[i].x, positions[i].y, s.color, false, s.id, positions[i].rotation);
            }
        });

        refreshStudentPanel();
        Storage.pushHistory();
    }

    /* ── File modal (combined save/load/export/import) ── */
    function bindFileModal() {
        document.getElementById('btn-save-ok').addEventListener('click', () => {
            const name = document.getElementById('save-name').value.trim();
            if (!name) { alert('Skriv inn eit namn for oppsettet.'); return; }
            const data = Storage.captureState(true); // Include tabs when saving to list
            Storage.saveSetup(name, data);
            document.getElementById('save-name').value = '';
            refreshLoadList();
        });
    }

    function openFileModal() {
        refreshLoadList();
        openModal('modal-file');
    }

    function refreshLoadList() {
        const list = document.getElementById('load-list');
        const setups = Storage.getAll();

        if (setups.length === 0) {
            list.innerHTML = '<p class="placeholder-text">Ingen lagra oppsett.</p>';
        } else {
            list.innerHTML = '';
            setups.forEach(s => {
                const item = document.createElement('div');
                item.className = 'load-item';

                const nameEl = document.createElement('span');
                nameEl.className = 'load-item-name';
                nameEl.textContent = s.name;

                const actions = document.createElement('div');
                actions.className = 'load-item-actions';

                const loadBtn = document.createElement('button');
                loadBtn.className = 'load-btn';
                loadBtn.innerHTML = Icons.html('folder-open', 14) + ' Hent';
                loadBtn.addEventListener('click', () => {
                    if (s.data.tabs && typeof Tabs !== 'undefined') {
                        Tabs.setAllTabs(s.data.tabs);
                    } else {
                        Storage.restoreState(s.data);
                    }
                    closeModal('modal-file');
                });

                const delBtn = document.createElement('button');
                delBtn.className = 'del-btn';
                delBtn.innerHTML = Icons.html('trash-2', 14);
                delBtn.addEventListener('click', () => {
                    if (confirm('Slette "' + s.name + '"?')) {
                        Storage.deleteSetup(s.id);
                        refreshLoadList();
                    }
                });

                actions.appendChild(loadBtn);
                actions.appendChild(delBtn);
                item.appendChild(nameEl);
                item.appendChild(actions);
                list.appendChild(item);
            });
        }
    }

    /* ════════════════════════════════
       SIDEBAR — Drop on canvas
       ════════════════════════════════ */

    function bindSidebar() {
        const canvas = Grid.getCanvas();

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const canvasRect = Grid.getCanvasRect();
            const x = e.clientX - canvasRect.left;
            const y = e.clientY - canvasRect.top;

            const raw = e.dataTransfer.getData('text/plain');

            try {
                const data = JSON.parse(raw);
                if (data.type === 'student') {
                    const existing = Grid.getDesks().find(d => d.dataset.studentId === data.id);
                    if (existing) return;
                    Grid.createDesk(data.name, x - 40, y - 20, data.color, false, data.id);
                    refreshStudentPanel();
                    Storage.pushHistory();
                } else if (data.type === 'furniture') {
                    Grid.createFurniture(data.furnitureType, x - 40, y - 20, 0);
                    Storage.pushHistory();
                }
            } catch {
                /* ignore */
            }
        });

        document.querySelectorAll('.furniture-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const type = item.dataset.type;
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'furniture', furnitureType: type }));
                item.classList.add('drag-ghost');
            });
            item.addEventListener('dragend', () => item.classList.remove('drag-ghost'));
        });

        document.getElementById('btn-add-students').addEventListener('click', () => openModal('modal-students'));
    }

    /* ════════════════════════════════
       LEFT-CLICK SYMBOL TOOLS
       ════════════════════════════════ */

    let contextTarget = null;

    function getElementTools() {
        let tools = document.getElementById('element-tools');
        if (tools) return tools;

        tools = document.createElement('div');
        tools.id = 'element-tools';
        tools.className = 'element-tools hidden';
        tools.innerHTML = [
            '<button class="tool-btn" data-action="rotate" title="Roter"></button>',
            '<button class="tool-btn" data-action="color" title="Farge"></button>',
            '<button class="tool-btn" data-action="lock" title="Lås"></button>',
            '<button class="tool-btn" data-action="remove" title="Fjern"></button>'
        ].join('');

        document.body.appendChild(tools);

        tools.querySelector('[data-action="rotate"]').appendChild(Icons.create('rotate-cw', 14));
        tools.querySelector('[data-action="color"]').appendChild(Icons.create('palette', 14));
        tools.querySelector('[data-action="lock"]').appendChild(Icons.create('lock', 14));
        tools.querySelector('[data-action="remove"]').appendChild(Icons.create('trash-2', 14));

        return tools;
    }

    function showElementTools(el) {
        if (!el) return;
        contextTarget = el;
        const tools = getElementTools();
        const rect = el.getBoundingClientRect();
        const canvasRect = Grid.getCanvasRect();
        const isDesk = el.classList.contains('desk');

        const lockBtn = tools.querySelector('[data-action="lock"]');
        const colorBtn = tools.querySelector('[data-action="color"]');

        lockBtn.classList.toggle('hidden', !isDesk);
        colorBtn.classList.toggle('hidden', !isDesk);

        tools.style.left = (Math.max(canvasRect.left + 8, rect.right - 8)) + 'px';
        tools.style.top = (Math.max(canvasRect.top + 8, rect.top - 8)) + 'px';
        tools.classList.remove('hidden');
    }

    function hideElementTools() {
        const tools = document.getElementById('element-tools');
        if (tools) tools.classList.add('hidden');
    }

    function bindElementTools() {
        const picker = document.getElementById('color-picker');
        const tools = getElementTools();

        tools.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || !contextTarget) return;

            const action = btn.dataset.action;
            if (action === 'rotate') {
                let rot = parseInt(contextTarget.dataset.rotation) || 0;
                const oldRot = rot;
                rot = (rot + 90) % 360;
                contextTarget.dataset.rotation = String(rot);
                contextTarget.className = contextTarget.className.replace(/rot-\d+/g, '');
                if (rot) contextTarget.classList.add('rot-' + rot);
                
                // Adjust position if rotating to/from vertical to stay on grid
                if ((oldRot % 180) !== (rot % 180)) {
                    const x = parseInt(contextTarget.style.left);
                    const y = parseInt(contextTarget.style.top);
                    const w = contextTarget.offsetWidth;
                    const h = contextTarget.offsetHeight;
                    const snapped = Grid.snapPos(x, y, rot, w, h);
                    contextTarget.style.left = snapped.x + 'px';
                    contextTarget.style.top = snapped.y + 'px';
                }

                if (contextTarget.classList.contains('furniture')) {
                    Grid.updateFurnLayout(contextTarget);
                }
                Storage.pushHistory();
                showElementTools(contextTarget); // Reposition tools
            }

            if (action === 'lock' && contextTarget.classList.contains('desk')) {
                const isLocked = contextTarget.dataset.locked === '1';
                contextTarget.dataset.locked = isLocked ? '0' : '1';
                contextTarget.classList.toggle('locked', !isLocked);

                const lockIcon = contextTarget.querySelector('.lock-icon');
                if (!isLocked && !lockIcon) {
                    const icon = document.createElement('span');
                    icon.className = 'lock-icon';
                    icon.appendChild(Icons.create('lock', 12));
                    contextTarget.appendChild(icon);
                }
                if (isLocked && lockIcon) lockIcon.remove();
                Storage.pushHistory();
            }

            if (action === 'color' && contextTarget.classList.contains('desk')) {
                const tr = btn.getBoundingClientRect();
                picker.style.left = tr.left + 'px';
                picker.style.top = (tr.bottom + 6) + 'px';
                picker.classList.remove('hidden');
            }

            if (action === 'remove') {
                removeElement(contextTarget);
                hideElementTools();
                contextTarget = null;
                return;
            }

            if (contextTarget) showElementTools(contextTarget);
        });

        picker.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (contextTarget && contextTarget.classList.contains('desk')) {
                    const color = btn.dataset.color;
                    contextTarget.dataset.color = color;
                    contextTarget.style.background = color === '#ffffff' ? '#FDFD96' : color;

                    const sid = contextTarget.dataset.studentId;
                    const student = students.find(s => s.id === sid);
                    if (student) student.color = color;
                    refreshStudentPanel();
                    Storage.pushHistory();
                }
                picker.classList.add('hidden');
                if (contextTarget) showElementTools(contextTarget);
            });
        });

        document.addEventListener('click', (e) => {
            if (!tools.contains(e.target) && !e.target.closest('.desk, .furniture')) {
                hideElementTools();
            }
            if (!picker.contains(e.target) && !e.target.closest('[data-action="color"]')) {
                picker.classList.add('hidden');
            }
        });
    }

    function removeElement(el) {
        if (el.classList.contains('desk')) {
            const sid = el.dataset.studentId;
            /* Student remains in list, just unplaced */
        }
        el.remove();
        Grid.deselectAll();
        refreshStudentPanel();
        Storage.pushHistory();
    }

    /* ════════════════════════════════
       INIT
       ════════════════════════════════ */

    document.addEventListener('DOMContentLoaded', init);

    return {
        showElementTools, hideElementTools, removeElement, exitSwapMode,
        getStudentList, setStudentList, refreshStudentPanel
    };
})();
