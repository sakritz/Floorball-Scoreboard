/* ── Floorball Scoreboard ──────────────────────────────────────────────
   MOBILE-LOGIK · Controller · Variante A
   Dünne Schicht über der bestehenden Logik: nutzt switchTab/renderController
   wieder, fügt nur eine Bottom-Nav, ein Mehr-Sheet und Mobile-Render hinzu.
   Benötigt: isScoreboard, S, switchTab(), renderController() ruft renderMobileBars()
────────────────────────────────────────────────────────────────────── */
(function () {
  if (typeof isScoreboard !== 'undefined' && isScoreboard) return;   // nur Controller

  const vc = () => document.getElementById('view-controller');

  // Bottom-Nav-Eintrag → Panel-Tab (admin/Spiel hat kein eigenes Panel)
  const VIEW_TO_TAB = { events: 'events', strafen: 'strafen', auszeit: 'auszeiten' };
  // Panel-Tab → zu markierender Bottom-Nav-Eintrag
  const TAB_TO_NAV  = { events: 'events', strafen: 'strafen', auszeiten: 'auszeit',
                        teams: 'mehr', settings: 'mehr', danger: 'mehr' };
  const ALL_TABS = ['admin', 'teams', 'strafen', 'auszeiten', 'settings', 'danger', 'events'];

  function activeTabName() {
    return ALL_TABS.find(t => {
      const btn = document.getElementById('tab-btn-' + t);
      return btn && btn.classList.contains('active');
    });
  }
  // switchTab ist ein Toggle → sicher öffnen, ohne versehentlich zu schließen
  function ensureTabOpen(tab) {
    if (activeTabName() !== tab) switchTab(tab);
  }
  function closeActiveTab() {
    const a = activeTabName();
    if (a) switchTab(a);   // erneuter Aufruf schließt das Panel
  }

  // data-mobile-view steuert per CSS, ob Control-Bar oder Panel sichtbar ist
  function setView(view) {
    const el = vc(); if (!el) return;
    el.setAttribute('data-mobile-view', view);
    const nav = view === 'spiel' ? 'spiel' : (TAB_TO_NAV[view] || 'mehr');
    document.querySelectorAll('.ct-mnav-item').forEach(b =>
      b.classList.toggle('active', b.dataset.view === nav));
  }

  // ── Bottom-Nav ──
  window.mobileNav = function (view) {
    if (view === 'mehr') { openMehrSheet(); return; }
    closeMehrSheet();
    if (view === 'spiel') { closeActiveTab(); setView('spiel'); return; }
    ensureTabOpen(VIEW_TO_TAB[view]);
    setView(VIEW_TO_TAB[view]);
  };

  // ── Mehr-Sheet ──
  window.openMehrSheet = function () {
    const s = document.getElementById('ct-mehr-sheet');
    if (s) s.classList.add('open');
    document.querySelectorAll('.ct-mnav-item').forEach(b =>
      b.classList.toggle('active', b.dataset.view === 'mehr'));
  };
  window.closeMehrSheet = function () {
    const s = document.getElementById('ct-mehr-sheet');
    if (s) s.classList.remove('open');
    // Markierung wieder auf den tatsächlich offenen View setzen
    const at = activeTabName();
    const view = at || 'spiel';
    setView(view);
  };
  window.mehrSelect = function (tab) {
    closeMehrSheet();
    ensureTabOpen(tab);
    setView(tab);
  };

  // ── Mobile-Render: Logos, Perioden-Segmente, Uhr-Label, Team-Akzentfarben ──
  // Wird am Ende von renderController() aufgerufen.
  window.renderMobileBars = function (s) {
    s = s || S;
    const el = vc(); if (!el) return;

    // Team-Akzentfarben als CSS-Variablen (speist auch Topbar-Verlauf)
    el.style.setProperty('--ct-home', s.homeAccent || '#c8ff00');
    el.style.setProperty('--ct-away', s.awayAccent || '#22c55e');

    // Team-Logos (Bild, sonst Initiale auf Akzentfarbe)
    [['home', s.homeLogo, s.homeName, s.homeAccent || '#c8ff00'],
     ['away', s.awayLogo, s.awayName, s.awayAccent || '#22c55e']]
      .forEach(([side, logo, name, accent]) => {
        const lg = document.getElementById('ct-m-' + side + '-logo');
        if (!lg) return;
        if (logo) {
          lg.innerHTML = '<img src="' + logo + '" alt="">';
          lg.style.background = 'transparent';
        } else {
          lg.textContent = (name || '?').charAt(0).toUpperCase();
          lg.style.background = accent;
          lg.style.color = '#0a0a0a';
        }
      });

    // Perioden-Segmente
    const pc = document.getElementById('ct-m-period-pills');
    if (pc) {
      const total = s.maxPeriods || 3;
      let html = '';
      for (let i = 1; i <= total; i++) {
        const cls = i < s.period ? 'done' : (i === s.period ? 'active' : '');
        html += '<span class="ct-m-seg ' + cls + '"></span>';
      }
      if (s.period > total) html += '<span class="ct-m-seg active ot"></span>';
      pc.innerHTML = html;
    }

    // Uhr-Label
    const lbl = document.getElementById('ct-m-clock-label');
    if (lbl) lbl.textContent = s.ctrlCountUp ? 'GESPIELT' : 'VERBLEIBEND';
  };

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    setView('spiel');
    if (typeof S !== 'undefined') renderMobileBars(S);
    // Beim Wechsel zurück auf Desktop ein offenes Sheet schließen
    window.addEventListener('resize', () => {
      if (window.innerWidth > 640) {
        const sh = document.getElementById('ct-mehr-sheet');
        if (sh) sh.classList.remove('open');
      }
    });
  });
})();
