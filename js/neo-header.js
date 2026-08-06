/* ========================================
   NEO-HEADER WEB COMPONENT
   ======================================== */

class NeoHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.attachStyles();
    this.attachEventListeners();
    this.buildMenu();
    this.startLogoCycle();

    /* Kategorifargane i menyen får tekstfarge ut frå kor lys accenten er,
       så dei må reknast om når temaet skiftar. Vi ser på attributtet i
       staden for på tema-hendingane, sidan temaet blir sett frå fleire
       stader (knappen her, setTheme(), lagra val ved lasting). */
    this.themeObserver = new MutationObserver(() => this.applyCategoryTextColour());
    this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  }

  disconnectedCallback() {
    if (this.logoTimer) clearInterval(this.logoTimer);
    if (this.themeObserver) this.themeObserver.disconnect();
  }

  /* Logoen skiftar mellom dei fire uttrykka på fyrste lina i sprite-arket.
     Held brukaren seg til «redusert rørsle», står han på det fyrste. */
  startLogoCycle() {
    const logo = this.shadowRoot.getElementById('siteLogoVyrde');
    if (!logo) return;
    const frames = [0, 1, 2, 3];
    const show = (frame) => {
      logo.style.setProperty('--vyrde-col', frame % 4);
      logo.style.setProperty('--vyrde-row', Math.floor(frame / 4));
    };
    show(frames[0]);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    this.logoTimer = setInterval(() => {
      i = (i + 1) % frames.length;
      show(frames[i]);
    }, 30000);
  }

  render() {
    // Dynamically calculate the base path to make relative links work in subfolders
    const scriptTag = document.querySelector('script[src*="neo-header.js"]');
    const src = scriptTag ? scriptTag.getAttribute('src') : '';
    const basePath = src.startsWith('../') ? '../' : '';
    this.basePath = basePath;

    this.shadowRoot.innerHTML = `
      <header class="site-header">
        <div class="header-inner">
          <a href="${basePath}index.html" class="site-logo"><span class="site-logo-img" id="siteLogoVyrde"><img src="${basePath}_resources/vyrde.png" alt="Vyrdepil"></span> Vyrdepil</a>
          
          <div class="header-actions">
            <button class="theme-toggle-btn" id="themeToggleBtn" aria-label="Skift mellom lys og mørkt tema">
              <span id="themeIcon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg></span>
            </button>

            <button class="menu-btn" id="menuBtn" aria-label="Meny" aria-expanded="false" aria-controls="siteMenu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>

        <nav class="site-menu" id="siteMenu" aria-label="Spel og verktøy"></nav>
      </header>
    `;
  }

  /**
   * Byggjer menyen frå json/apps.json — same kjelde som framsida, så
   * kategorifargar og logoar er dei same begge stader. Éin meny for alle
   * skjermbreidder; CSS avgjer om han flyt som ei nedtrekksliste eller
   * legg seg som eit panel i full breidd.
   */
  buildMenu() {
    const base = this.basePath || '';
    const menu = this.shadowRoot.getElementById('siteMenu');
    if (!menu) return;

    /* Lucide-ikon til dei to sidene som ikkje er ein app med eigen logo. */
    const EXTRA_ICONS = {
      home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
      shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
    };

    /* «/mappe/index.html», «/mappe/» og «/mappe» skal reknast som same side. */
    const norm = p => p.replace(/index\.html$/, '').replace(/\/{2,}/g, '/');
    const current = norm(location.pathname);

    const catHeader = (label, accent) => {
      const el = document.createElement('div');
      el.className = 'menu-cat menu-cat-' + (accent || 'accent2');
      el.dataset.accent = accent || 'accent2';
      el.textContent = label;
      return el;
    };

    const item = (name, href, img, iconName) => {
      const link = document.createElement('a');
      link.className = 'menu-item';
      link.href = base + href;
      if (norm(new URL(link.href, location.href).pathname) === current) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }

      const figure = document.createElement('span');
      figure.className = 'menu-item-fig';
      if (img) {
        const el = document.createElement('img');
        /* Adressa ligg i data-src til menyen blir opna fyrste gongen.
           Logoane er til saman kring 3 MB, og `loading="lazy"` hjelper ikkje:
           nettlesaren hentar dei likevel med ein gong, sjølv om panelet står
           med display: none. Utan dette ville kvar einaste side dra på seg
           3 MB berre for menyen. */
        el.dataset.src = base + img;
        el.alt = '';
        el.decoding = 'async';
        figure.appendChild(el);
      } else if (iconName) {
        figure.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
          + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + EXTRA_ICONS[iconName] + '</svg>';
      }
      link.appendChild(figure);

      const label = document.createElement('span');
      label.className = 'menu-item-name';
      label.textContent = name;
      link.appendChild(label);

      return link;
    };

    const grid = () => {
      const el = document.createElement('div');
      el.className = 'menu-grid';
      return el;
    };

    fetch(base + 'json/apps.json')
      .then(r => r.json())
      .then(data => {
        /* hidden = appen finst framleis, men skal berre nåast med direktelenkje. */
        const apps = (data.apps || []).filter(a => !a.disabled && !a.hidden && a.href);
        const frag = document.createDocumentFragment();

        (data.categories || []).forEach(cat => {
          const items = apps.filter(a => a.cat === cat.id);
          if (!items.length) return;
          frag.appendChild(catHeader(cat.menuLabel || cat.label, cat.accent));
          const g = grid();
          items.forEach(a => g.appendChild(item(a.name, a.href, a.img)));
          frag.appendChild(g);
        });

        frag.appendChild(catHeader('Meir', 'accent3'));
        const more = grid();
        more.appendChild(item('Heim', 'index.html', null, 'home'));
        more.appendChild(item('Personvern', 'personvern.html', null, 'shield'));
        frag.appendChild(more);

        menu.textContent = '';
        menu.appendChild(frag);
        this.applyCategoryTextColour();
        /* Rekk brukaren å opne menyen før lista er bygd, må logoane hentast
           med ein gong — elles sit han att med tomme ruter. */
        if (menu.classList.contains('open')) this.loadMenuImages();

        menu.querySelectorAll('a').forEach(link =>
          link.addEventListener('click', () => this.closeMenu()));
      })
      .catch(e => console.error('neo-header: klarte ikkje laste json/apps.json:', e));
  }

  /**
   * Vel svart eller kvit tekst på kategorioverskriftene ut frå kor lys
   * accent-fargen faktisk er i det aktive temaet.
   *
   * Framsida har same fargar, men der er overskrifta stor og feit — og stor
   * tekst treng berre 3:1 i kontrast. Her er ho 11px, og då gjeld 4.5:1.
   * Fast «kvit på accent/accent2» held ikkje: i fleire tema er dei to
   * fargane lyse, og då kjem vi ned i 2,4:1. Difor reknar vi ut kva av dei
   * to tekstfargane som gjev best kontrast, i staden for å gjette.
   */
  applyCategoryTextColour() {
    const menu = this.shadowRoot.getElementById('siteMenu');
    if (!menu) return;
    const styles = getComputedStyle(document.body);
    const AA = 4.5;

    /** «#abc», «#aabbcc» og «rgb(1, 2, 3)» → [r, g, b]. */
    const rgbOf = (col) => {
      const hex = String(col).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex) {
        let h = hex[1];
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
      }
      const nums = String(col).match(/\d+(\.\d+)?/g);
      return nums && nums.length >= 3 ? nums.slice(0, 3).map(Number) : null;
    };
    const lum = ([r, g, b]) => {
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    /** Legg eit lag med gjennomsiktig svart (mot 0) eller kvit (mot 255) over. */
    const veil = (rgb, towards, a) => rgb.map(v => v * (1 - a) + towards * a);

    const light = rgbOf(styles.getPropertyValue('--text-on-accent') || '#ffffff');
    const dark = rgbOf(styles.getPropertyValue('--text-on-light-accent') || '#1a1a1a');
    if (!light || !dark) return;
    const lLight = lum(light), lDark = lum(dark);

    menu.querySelectorAll('.menu-cat').forEach(el => {
      const base = rgbOf(styles.getPropertyValue('--' + (el.dataset.accent || 'accent2')));
      if (!base) return;
      const lBase = lum(base);

      const useLight = contrast(lBase, lLight) >= contrast(lBase, lDark);
      el.style.color = useLight ? 'var(--text-on-accent)' : 'var(--text-on-light-accent)';

      /* Nokre tema har accent-fargar midt på skalaen, der korkje kvit eller
         svart tekst når 4.5:1. Då legg vi eit tynt slør i motsett retning av
         teksten over fargen — fargen er den same, berre litt mørkare eller
         lysare, akkurat nok til at teksten blir lesbar. */
      const target = useLight ? lLight : lDark;
      let alpha = 0;
      while (contrast(lum(veil(base, useLight ? 0 : 255, alpha)), target) < AA && alpha < 0.6) {
        alpha += 0.04;
      }
      el.style.backgroundImage = alpha > 0
        ? `linear-gradient(rgba(${useLight ? '0,0,0' : '255,255,255'},${alpha.toFixed(2)}) 0 100%)`
        : '';
    });
  }

  /** Hentar logoane fyrste gongen menyen blir opna. */
  loadMenuImages() {
    const menu = this.shadowRoot.getElementById('siteMenu');
    if (!menu) return;
    menu.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      delete img.dataset.src;
    });
  }

  openMenu() {
    const btn = this.shadowRoot.getElementById('menuBtn');
    const menu = this.shadowRoot.getElementById('siteMenu');
    if (!btn || !menu) return;
    this.loadMenuImages();
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    menu.classList.add('open');
  }

  closeMenu() {
    const btn = this.shadowRoot.getElementById('menuBtn');
    const menu = this.shadowRoot.getElementById('siteMenu');
    if (!btn || !menu) return;
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('open');
  }

  attachStyles() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
      }

      .site-header {
        background: var(--accent2);
        border-bottom: 3px solid var(--border);
        box-shadow: 0 4px 0 var(--shadow);
        position: relative;
        z-index: 1000;
      }

      .header-inner {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        gap: 16px;
      }

      .site-logo {
        font-weight: 900;
        font-size: clamp(18px, 4vw, 24px);
        color: #fff;
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
      }

      .site-logo span {
        font-size: clamp(24px, 5vw, 32px);
      }

      /* Logoen er maskoten Vyrde, klipt ut av sprite-arket
         _resources/vyrde.png (4 x 3 uttrykk, celle 440 x 300). Headeren ligg
         i ein shadow root, så css/vyrde.css når ikkje inn hit — difor står
         reglane her. Sjå js/vyrde.js for same komponent elles på nettstaden. */
      .site-logo-img {
        --vyrde-col: 0;
        --vyrde-row: 0;
        display: block;
        position: relative;
        overflow: hidden;
        height: clamp(32px, 5vw, 40px);
        aspect-ratio: 440 / 300;
        flex-shrink: 0;
        transition: transform 0.18s ease-out;
      }

      .site-logo-img img {
        position: absolute;
        width: 400%;
        height: 300%;
        max-width: none;
        left: calc(var(--vyrde-col) * -100%);
        top: calc(var(--vyrde-row) * -100%);
      }

      /* Boksen veks, ikkje biletet — boksen klipper, så eit skalert bilete
         ville fått toppen av hovudet kutta av kanten. */
      .site-logo:hover .site-logo-img { transform: scale(1.06); }

      @media (prefers-reduced-motion: reduce) {
        .site-logo-img { transition: none; }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: clamp(8px, 2vw, 16px);
      }

      /* ── Menyknapp (hamburger) ──────────────────────────────
         Éin knapp for alle skjermbreidder. Den gamle løysinga hadde ein
         "Meny"-knapp *og* ein hamburger, som begge dukka opp på mobil og
         opna kvar sin meny med ulikt innhald. */
      .menu-btn {
        width: 44px;
        height: 44px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 5px;
        background: var(--surface);
        border: 3px solid var(--border);
        padding: 0;
        box-shadow: 3px 3px 0 var(--shadow);
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      }

      .menu-btn:hover,
      .menu-btn.open {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0 var(--shadow);
        background: var(--accent);
      }

      .menu-btn:hover span,
      .menu-btn.open span { background: var(--text-on-accent); }

      .menu-btn:focus-visible {
        outline: 3px solid var(--accent2);
        outline-offset: 3px;
      }

      .menu-btn span {
        display: block;
        width: 22px;
        height: 3px;
        background: var(--text);
        border-radius: 2px;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s;
        transform-origin: center;
      }

      .menu-btn.open span:nth-child(1) { transform: translateY(8px) rotate(45deg); }
      .menu-btn.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
      .menu-btn.open span:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }

      /* ── Menypanelet ────────────────────────────────────────
         Flyt som nedtrekksliste under knappen på store skjermar; går over
         til eit panel i full breidd når det blir trongt. Same innhald. */
      .site-menu {
        display: none;
        position: absolute;
        top: 100%;
        right: clamp(12px, 4vw, 20px);
        margin-top: 12px;
        width: min(560px, calc(100vw - 24px));
        background: var(--surface);
        border: 3px solid var(--border);
        box-shadow: 6px 6px 0 var(--shadow);
        max-height: min(70vh, 620px);
        overflow-y: auto;
        overflow-x: hidden;
        z-index: 1001;
      }

      .site-menu.open {
        display: block;
        animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      @keyframes popIn {
        0% { transform: scale(0.97) translateY(-8px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .site-menu.open { animation: none; }
        .menu-btn, .menu-btn span { transition: none; }
      }

      /* Kategorioverskrift — same temafarge som seksjonen på framsida.
         accent og accent2 er mørke og tek kvit tekst; accent3-5 er lyse
         pastellar og tek mørk tekst (sjå AGENTS.md §3.2). */
      .menu-cat {
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 8px 16px;
        border-bottom: 2px solid var(--border);
        margin: 0;
      }

      .menu-cat:not(:first-child) { border-top: 2px solid var(--border); }

      .menu-cat-accent  { background: var(--accent);  color: var(--text-on-accent); }
      .menu-cat-accent2 { background: var(--accent2); color: var(--text-on-accent); }
      .menu-cat-accent3 { background: var(--accent3); color: var(--text-on-light-accent); }
      .menu-cat-accent4 { background: var(--accent4); color: var(--text-on-light-accent); }
      .menu-cat-accent5 { background: var(--accent5); color: var(--text-on-light-accent); }

      /* Negativ margin dreg siste kolonne og siste rad sine kantar inn
         under ramma på panelet, så kantane ikkje blir doble. */
      .menu-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        margin: 0 -2px -2px 0;
      }

      .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        font-weight: 700;
        font-size: 13px;
        background: var(--surface);
        color: var(--text);
        text-decoration: none;
        border-right: 2px solid var(--border);
        border-bottom: 2px solid var(--border);
        transition: background 0.1s, color 0.1s;
        min-width: 0;
      }

      .menu-item:hover,
      .menu-item:focus-visible,
      .menu-item.active {
        background: var(--accent);
        color: var(--text-on-accent);
      }

      .menu-item:focus-visible {
        outline: 3px solid var(--accent2);
        outline-offset: -3px;
      }

      .menu-item-fig {
        width: 30px;
        height: 30px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .menu-item-fig img,
      .menu-item-fig svg {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }

      .menu-item-name {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      /* Theme Toggle Button */
      .theme-toggle-btn {
        width: 44px;
        height: 44px;
        border: 3px solid var(--border);
        font-weight: 800;
        font-size: 1.3rem;
        cursor: pointer;
        background: var(--surface);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 3px 3px 0 var(--shadow);
        transition: all 0.15s ease;
        padding: 0;
      }

      .theme-toggle-btn:hover {
        transform: translate(2px,2px);
        box-shadow: 1px 1px 0 var(--shadow);
        background: var(--accent);
        color: var(--text-on-accent);
      }

      /* Knappen er den same heile vegen ned; berre panelet endrar form. */
      @media (max-width: 40rem) {
        .site-menu {
          left: 0;
          right: 0;
          width: auto;
          margin-top: 0;
          border-left: none;
          border-right: none;
          box-shadow: 0 8px 0 var(--shadow);
          max-height: calc(100vh - 76px);
        }
        .menu-grid { grid-template-columns: 1fr 1fr; }
      }

    `;
    this.shadowRoot.appendChild(style);
  }

  attachEventListeners() {
    // Menyknapp
    const menuBtn = this.shadowRoot.getElementById('menuBtn');
    const siteMenu = this.shadowRoot.getElementById('siteMenu');

    if (menuBtn && siteMenu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (siteMenu.classList.contains('open')) this.closeMenu();
        else this.openMenu();
      });

      // Klikk utanfor lukkar menyen
      document.addEventListener('click', (e) => {
        if (!this.shadowRoot.contains(e.target)) this.closeMenu();
      });

      // Escape lukkar og gjev fokus attende til knappen
      this.shadowRoot.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && siteMenu.classList.contains('open')) {
          this.closeMenu();
          menuBtn.focus();
        }
      });
    }

    // Theme toggle
    const themeBtn = this.shadowRoot.getElementById('themeToggleBtn');
    const themeIcon = this.shadowRoot.getElementById('themeIcon');

    if (themeBtn && themeIcon) {
      // Setup initial icon state based on current theme vs light theme
      const currentTheme = document.body.getAttribute('data-theme');
      const lightTheme = document.body.getAttribute('data-light-theme') || 'classic';
      themeIcon.innerHTML = currentTheme === lightTheme ? 
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>' : 
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

      themeBtn.addEventListener('click', () => {
        const body = document.body;
        const lightTheme = body.getAttribute('data-light-theme') || 'classic';
        const darkTheme = body.getAttribute('data-dark-theme') || 'space';
        const currentTheme = body.getAttribute('data-theme');

        const newTheme = currentTheme === lightTheme ? darkTheme : lightTheme;
        
        // Trigger theme change event (legacy compatibility)
        const event = new CustomEvent('theme-change', { 
          detail: { theme: newTheme },
          bubbles: true 
        });
        document.dispatchEvent(event);

        // Also call global setTheme if it exists (which updates localStorage and DOM)
        if (typeof window.setTheme === 'function') {
          window.setTheme(newTheme);
        }

        // Update icon
        themeIcon.innerHTML = newTheme === lightTheme ? 
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>' : 
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
      });

    // Listen for theme changes to update icon from external sources
    // We attach this to window because document events don't pierce shadow boundary unless composed: true
    window.addEventListener('theme-changed', (e) => {
      if (themeIcon) {
        const body = document.body;
        const lightTheme = body.getAttribute('data-light-theme') || 'classic';
        themeIcon.innerHTML = e.detail === lightTheme ? 
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>' : 
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
      }
    });
    }
  }
}

customElements.define('neo-header', NeoHeader);
