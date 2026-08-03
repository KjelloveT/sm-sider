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
  }

  disconnectedCallback() {
    if (this.logoTimer) clearInterval(this.logoTimer);
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
            <div class="tools-dropdown">
              <button class="tools-dropdown-btn" id="toolsDropdownBtn"><svg width="18" height="18" style="vertical-align: -3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> <span>Meny</span> ▾</button>
              <div class="tools-dropdown-menu" id="toolsMenu"></div>
            </div>

            <button class="theme-toggle-btn" id="themeToggleBtn" aria-label="Skift mellom lys og mørkt tema">
              <span id="themeIcon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg></span>
            </button>
            
            <button class="hamburger-btn" id="hamburgerBtn" aria-label="Vis meny">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
        
        <div class="mobile-nav-container" id="mobileNav">
          <div class="mobile-nav-inner">
            <div class="mobile-nav-grid" id="mobileNavGrid"></div>
          </div>
        </div>
      </header>
    `;
  }

  buildMenu() {
    const base = this.basePath || '';
    const menu = this.shadowRoot.getElementById('toolsMenu');
    const mobileGrid = this.shadowRoot.getElementById('mobileNavGrid');
    fetch(base + 'json/apps.json')
      .then(r => r.json())
      .then(data => {
        const cats = data.categories || [];
        const apps = (data.apps || []).filter(a => !a.disabled && a.href);

        // Dropdown (desktop): kategoriar som på framsida
        let html = '';
        cats.forEach(cat => {
          const items = apps.filter(a => a.cat === cat.id);
          if (!items.length) return;
          html += `<div class="tools-category">${cat.menuLabel || cat.label}</div><div class="tools-grid-wrapper">`;
          items.forEach(a => { html += `<a href="${base}${a.href}" class="tools-dropdown-item">${a.name}</a>`; });
          html += `</div>`;
        });
        html += `<div class="tools-category">Meir</div><div class="tools-grid-wrapper">`
          + `<a href="${base}index.html" class="tools-dropdown-item">Heim</a>`
          + `<a href="${base}personvern.html" class="tools-dropdown-item">Personvern</a></div>`;
        if (menu) menu.innerHTML = html;

        // Mobilmeny: flat liste + personvern
        if (mobileGrid) {
          let m = '';
          apps.forEach(a => { m += `<a href="${base}${a.href}">${a.name}</a>`; });
          m += `<a href="${base}personvern.html">Personvern</a>`;
          mobileGrid.innerHTML = m;
          const hb = this.shadowRoot.getElementById('hamburgerBtn');
          const mn = this.shadowRoot.getElementById('mobileNav');
          mobileGrid.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
            if (hb) hb.classList.remove('open');
            if (mn) mn.classList.remove('open');
          }));
        }
      })
      .catch(e => console.error('neo-header: klarte ikkje laste json/apps.json:', e));
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

      /* Desktop nav */
      .desktop-nav {
        display: flex;
        gap: 12px;
      }

      .desktop-nav a {
        text-decoration: none;
        color: var(--text);
        font-weight: 800;
        padding: 8px 16px;
        background: var(--surface);
        border: 3px solid var(--border);
        font-size: 14px;
        box-shadow: 3px 3px 0 var(--shadow);
        transition: all 0.15s ease;
      }

      .desktop-nav a:hover {
        transform: translate(2px,2px);
        box-shadow: 1px 1px 0 var(--shadow);
        background: var(--accent);
        color: var(--text-on-accent);
      }

      /* Tools Dropdown */
      .tools-dropdown {
        position: relative;
      }

      .tools-dropdown-btn {
        padding: 8px 16px;
        border: 3px solid var(--border);
        font-weight: 800;
        font-size: 14px;
        cursor: pointer;
        background: var(--surface);
        color: var(--text);
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 3px 3px 0 var(--shadow);
        transition: all 0.15s ease;
      }

      .tools-dropdown-btn:hover, .tools-dropdown-menu.open ~ .tools-dropdown-btn {
        transform: translate(2px,2px);
        box-shadow: 1px 1px 0 var(--shadow);
        background: var(--accent);
        color: var(--text-on-accent);
      }

      .tools-dropdown-menu {
        display: none;
        position: absolute;
        top: calc(100% + 16px);
        right: 0;
        background: var(--surface);
        border: 3px solid var(--border);
        box-shadow: 6px 6px 0 var(--shadow);
        width: clamp(280px, 90vw, 340px);
        max-height: 70vh;
        overflow-y: auto;
        z-index: 1001;
      }

      .tools-dropdown-menu.open {
        display: block;
        animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      @keyframes popIn {
        0% { transform: scale(0.95) translateY(-10px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }

      .tools-category {
        background: var(--muted);
        color: var(--surface);
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        padding: 8px 16px;
        border-bottom: 2px solid var(--border);
        letter-spacing: 1px;
        margin: 0;
      }

      .tools-category:not(:first-child) {
        border-top: 2px solid var(--border);
      }

      .tools-grid-wrapper {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .tools-dropdown-item {
        display: block;
        width: 100%;
        padding: 12px 16px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        background: var(--surface);
        border: none;
        border-bottom: 1px solid var(--border);
        border-right: 1px solid var(--border);
        text-align: left;
        color: var(--text);
        text-decoration: none;
        font-family: inherit;
        transition: background 0.1s;
        box-sizing: border-box;
      }

      .tools-dropdown-item:nth-child(even) {
        border-right: none;
      }

      .tools-dropdown-item:last-child, .tools-dropdown-item:nth-last-child(2):nth-child(odd) {
        border-bottom: none;
      }

      .tools-dropdown-item:hover, .tools-dropdown-item.active {
        background: var(--accent);
        color: var(--text-on-accent);
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

      /* Hamburger Menu */
      .hamburger-btn {
        display: none;
        width: 44px;
        height: 44px;
        cursor: pointer;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 5px;
        background: var(--surface);
        border: 3px solid var(--border);
        padding: 0;
        box-shadow: 3px 3px 0 var(--shadow);
        transition: all 0.2s ease;
      }

      .hamburger-btn:hover {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0 var(--shadow);
        background: var(--accent);
      }

      .hamburger-btn:hover span {
        background: var(--text-on-accent);
      }

      .hamburger-btn span { 
        display: block;
        width: 22px;
        height: 3px;
        background: var(--text);
        border-radius: 2px; 
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: center;
      }

      .hamburger-btn.open span:nth-child(1) {
        transform: translateY(8px) rotate(45deg);
      }

      .hamburger-btn.open span:nth-child(2) {
        opacity: 0;
        transform: scale(0);
      }

      .hamburger-btn.open span:nth-child(3) {
        transform: translateY(-8px) rotate(-45deg);
      }

      /* Mobile Nav Accordion */
      .mobile-nav-container {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: var(--surface);
        border-top: 0px solid var(--border);
      }

      .mobile-nav-container.open {
        grid-template-rows: 1fr;
        border-top: 3px solid var(--border);
        box-shadow: 0 8px 0 var(--shadow);
      }

      .mobile-nav-inner {
        overflow: hidden;
      }

      .mobile-nav-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .mobile-nav-grid a {
        text-decoration: none;
        color: var(--text);
        font-weight: 800;
        padding: 12px 16px;
        border: 3px solid var(--border);
        text-align: center;
        background: var(--surface);
        box-shadow: 4px 4px 0 var(--shadow);
        transition: transform 0.1s, box-shadow 0.1s;
      }

      .mobile-nav-grid a:active {
        transform: translate(2px,2px);
        box-shadow: 2px 2px 0 var(--shadow);
        background: var(--accent);
        color: var(--text-on-accent);
      }

      @media (max-width: 64rem) {
        .desktop-nav { display: none; }
        .hamburger-btn { display: flex; }
        .tools-dropdown-btn span { display: none; }
      }

      @media (min-width: 64rem) {
        .mobile-nav-container { display: none !important; }
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  attachEventListeners() {
    // Tools dropdown toggle
    const toolsBtn = this.shadowRoot.getElementById('toolsDropdownBtn');
    const toolsMenu = this.shadowRoot.getElementById('toolsMenu');

    if (toolsBtn && toolsMenu) {
      toolsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolsMenu.classList.toggle('open');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.shadowRoot.contains(e.target)) {
          toolsMenu.classList.remove('open');
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

    // Mobile nav toggle
    const hamburgerBtn = this.shadowRoot.getElementById('hamburgerBtn');
    const mobileNav = this.shadowRoot.getElementById('mobileNav');

    if (hamburgerBtn && mobileNav) {
      hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('open');
        mobileNav.classList.toggle('open');
      });

      // Close mobile nav when clicking a link
      const mobileLinks = mobileNav.querySelectorAll('a');
      mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
          hamburgerBtn.classList.remove('open');
          mobileNav.classList.remove('open');
        });
      });
    }
  }
}

customElements.define('neo-header', NeoHeader);
