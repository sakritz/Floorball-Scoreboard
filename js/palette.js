/* ── Floorball Scoreboard ──────────────────────────────────────────────
   Neon-Farbpalette und Periodensteuerung – benötigt: S, pushUndo, pushAndRender
────────────────────────────────────────────────────────────────────── */

/* ─── NEON PALETTE ─────────────────────────────────────────────────── */
const NEON_PALETTE = [
  '#ff3d6e','#ff8a2a','#ffe600','#c8ff00',
  '#16d27a','#00e5ff','#5b9dff','#b366ff','#ff44bb',
];

/**
 * Renders the neon palette into a container element.
 * onPick(hex) is called when a swatch is clicked.
 * activeHex marks the currently selected color.
 */
function renderNeonPalette(containerId, activeHex, onPick) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  NEON_PALETTE.forEach(hex => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = hex;
    btn.className = 'neon-swatch' + (hex.toLowerCase() === (activeHex || '').toLowerCase() ? ' active' : '');
    btn.style.background = hex;
    btn.onclick = () => {
      container.querySelectorAll('.neon-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(hex);
    };
    container.appendChild(btn);
  });
}

// Init/refresh neon palettes in controller teams tab
function initCtNeonPalettes() {
  renderNeonPalette('ct-home-neon-palette', S.homeAccent, hex => {
    S.homeAccent = hex;
    document.getElementById('ct-home-accent').value = hex;
    document.getElementById('ct-home-accent-hex').textContent = hex;
    onColorChange('home', 'Accent', hex);
  });
  renderNeonPalette('ct-away-neon-palette', S.awayAccent, hex => {
    S.awayAccent = hex;
    document.getElementById('ct-away-accent').value = hex;
    document.getElementById('ct-away-accent-hex').textContent = hex;
    onColorChange('away', 'Accent', hex);
  });
}

// Init neon palettes in setup dialog
function initSetupNeonPalettes() {
  const homeAccent = document.getElementById('setup-home-accent').value;
  const awayAccent = document.getElementById('setup-away-accent').value;
  renderNeonPalette('setup-home-neon-palette', homeAccent, hex => {
    document.getElementById('setup-home-accent').value = hex;
    document.getElementById('setup-home-accent-hex').textContent = hex;
  });
  renderNeonPalette('setup-away-neon-palette', awayAccent, hex => {
    document.getElementById('setup-away-accent').value = hex;
    document.getElementById('setup-away-accent-hex').textContent = hex;
  });
}

function renderColorSwatches(prefix, colors, onPick) {
  const wrap = document.getElementById(prefix + '-color-suggestions');
  const container = document.getElementById(prefix + '-swatches');
  if (!wrap || !container) return;

  if (!colors || !colors.length) { wrap.style.display = 'none'; return; }

  container.innerHTML = '';

  colors.forEach(c => {
    const btn = document.createElement('button');
    btn.title = c.hex;
    btn.type = 'button'; // prevent form submission
    btn.style.cssText = [
      'width:28px', 'height:28px', 'border-radius:3px',
      'background:' + c.hex, 'border:2px solid rgba(255,255,255,.2)',
      'cursor:pointer', 'flex-shrink:0', 'padding:0',
      'transition:transform .12s,border-color .12s',
    ].join(';');

    btn.onmouseenter = () => { btn.style.transform = 'scale(1.18)'; btn.style.borderColor = 'rgba(255,255,255,.75)'; };
    btn.onmouseleave = () => { btn.style.transform = ''; btn.style.borderColor = 'rgba(255,255,255,.2)'; };

    btn.onclick = (ev) => {
      ev.stopPropagation();
      // Remove any existing picker
      document.querySelectorAll('.swatch-picker').forEach(el => el.remove());
      document.querySelectorAll('[data-swatch-active]').forEach(b => { b.style.outline = ''; delete b.dataset.swatchActive; });
      btn.style.outline = '2px solid rgba(255,255,255,.7)';
      btn.dataset.swatchActive = '1';

      const picker = document.createElement('div');
      picker.className = 'swatch-picker';
      picker.style.cssText = [
        'position:fixed', 'z-index:99999',
        'background:#1a1e28', 'border:1px solid rgba(255,255,255,.2)',
        'padding:6px', 'display:flex', 'flex-direction:column', 'gap:4px',
        'min-width:140px', 'box-shadow:0 4px 24px rgba(0,0,0,.7)',
        'font-family:Barlow Condensed,sans-serif',
      ].join(';');

      const hexLabel = document.createElement('div');
      hexLabel.textContent = c.hex;
      hexLabel.style.cssText = 'color:rgba(255,255,255,.35);font-size:10px;letter-spacing:2px;padding:2px 4px;font-family:monospace';
      picker.appendChild(hexLabel);

      [['Als Akzentfarbe', 'accent'], ['Als Trikotfarbe', 'jersey']].forEach(([label, type]) => {
        const pb = document.createElement('button');
        pb.type = 'button';
        pb.textContent = label;
        pb.style.cssText = [
          'background:rgba(255,255,255,.07)', 'border:1px solid rgba(255,255,255,.12)',
          'color:#f2f5ff', 'padding:6px 10px', 'cursor:pointer', 'text-align:left',
          'font-family:Barlow Condensed,sans-serif', 'font-size:12px', 'font-weight:700',
          'letter-spacing:1px', 'width:100%',
        ].join(';');
        pb.onmouseenter = () => { pb.style.background = 'rgba(200,255,0,.15)'; pb.style.color = '#c8ff00'; };
        pb.onmouseleave = () => { pb.style.background = 'rgba(255,255,255,.07)'; pb.style.color = '#f2f5ff'; };
        pb.onclick = (e2) => {
          e2.stopPropagation();
          onPick(c.hex, type);
          picker.remove();
          btn.style.outline = '';
          delete btn.dataset.swatchActive;
        };
        picker.appendChild(pb);
      });

      document.body.appendChild(picker);

      // Position below/beside the swatch button
      const br = btn.getBoundingClientRect();
      const pw = 150, ph = 80;
      let left = br.left;
      let top  = br.bottom + 4;
      if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
      if (top  + ph > window.innerHeight - 8) top  = br.top - ph - 4;
      picker.style.left = left + 'px';
      picker.style.top  = top  + 'px';

      // Close on outside click
      setTimeout(() => {
        function closePicker(e) {
          if (!picker.contains(e.target) && e.target !== btn) {
            picker.remove();
            btn.style.outline = '';
            delete btn.dataset.swatchActive;
            document.removeEventListener('click', closePicker);
          }
        }
        document.addEventListener('click', closePicker);
      }, 10);
    };

    container.appendChild(btn);
  });

  wrap.style.display = 'block';
}

// ── Period / Format ──
function onFormatChange() {
  const val = document.getElementById('ct-format').value;
  if (S.gameStarted) {
    const cur = S.maxPeriods === 2 ? '2' : S.periodSecs === 900 ? '3s' : '3';
    ctConfirm({
      icon: '⚠',
      title: 'Format ändern?',
      body: 'Das Spiel hat bereits begonnen. Format ändern setzt Spielzeit und Abschnitt zurück.',
      okLabel: 'Fortfahren',
      onOk: () => applyFormat(val),
      onCancel: () => { document.getElementById('ct-format').value = cur; },
    });
    return;
  }
  applyFormat(val);
}

function onSetupFormatChange() {
  const val = document.getElementById('setup-format').value;
  const customFields = document.getElementById('setup-custom-fields');
  customFields.style.display = val === 'custom' ? 'flex' : 'none';
  if (val === 'custom') updateSetupCustomSummary();
}

function updateSetupCustomSummary() {
  const periods = parseInt(document.getElementById('setup-custom-periods').value) || 3;
  const pMin    = parseInt(document.getElementById('setup-custom-period-min').value) || 20;
  const pausMin = parseInt(document.getElementById('setup-custom-pause-min').value) || 10;
  const label   = periods === 2 ? 'Halbzeiten' : 'Drittel';
  const el = document.getElementById('setup-custom-summary');
  if (el) el.textContent = `${periods} × ${pMin} Min · Pause ${pausMin} Min`;
}

// Auto-detect format from league name and game operation
function detectFormatFromLeague(leagueName, gameOperationName) {
  if (!leagueName && !gameOperationName) return null;
  const l = (leagueName || '').toLowerCase();
  const op = (gameOperationName || '').toLowerCase();

  // Kleinfeld: "KF" oder "Kleinfeld" im Liga-Namen
  if (/\bkf\b|kleinfeld/.test(l)) return '2';

  // NRW-Verband → alle Großfeld-Ligen spielen 3×15
  const isNRW = /nordrhein|nwfv/.test(op);
  if (isNRW) return '3s';

  // Großfeld Standard 3×20: explizit GF, Großfeld, oder FBL
  if (/\bgf\b|großfeld|gro.?feld|\bfbl\b/.test(l)) return '3';

  // Default: Großfeld 3×20
  return '3';
}

function applyFormat(val) {
  if (val === '3s') {
    S.maxPeriods = 3;
    S.periodSecs = 900;
    S.pauseSecs  = 420;
  } else if (val === '2') {
    S.maxPeriods = 2;
    S.periodSecs = 1200;
    S.pauseSecs  = 300;
  } else {
    // '3' and 'custom' both handled here; custom overrides below in setupStart
    S.maxPeriods = 3;
    S.periodSecs = 1200;
    S.pauseSecs  = 600;
  }
  S.period = 1;
  S.clock  = S.periodSecs;
  clockMs = S.clock * 1000;
  S.gameStarted = false;
  document.getElementById('ct-set-min').value = Math.floor(S.periodSecs / 60);
  document.getElementById('ct-set-sec').value = 0;
  buildPeriodPills();
  pushAndRender();
}

function buildPeriodPills() {
  buildGameFlow();
}

function buildGameFlow() {
  const c = document.getElementById('ct-game-flow');
  if (!c) return;
  c.innerHTML = '';

  // Parallelogram shape matching .btn design language (skewX -8deg, counter-rotate text)
  const BASE = [
    'display:inline-flex', 'align-items:center', 'justify-content:center',
    'padding:4px 11px', 'font-size:11px', 'font-weight:700',
    'letter-spacing:1px', 'cursor:pointer',
    'border:1px solid rgba(255,255,255,.12)',
    'background:transparent', 'color:rgba(255,255,255,.45)',
    'line-height:1', 'white-space:nowrap',
    'transform:skewX(-8deg)', 'border-radius:0',
  ].join(';');

  const addSep = () => {
    const s = document.createElement('span');
    s.style.cssText = 'color:rgba(255,255,255,.15);font-size:11px;padding:0 1px;user-select:none;line-height:1';
    s.textContent = '›';
    c.appendChild(s);
  };

  const addNode = (id, label, onclick) => {
    const b = document.createElement('button');
    b.id = id;
    b.style.cssText = BASE;
    b.onclick = onclick;
    // Counter-rotate text so it stays upright inside the skewed shape
    const span = document.createElement('span');
    span.style.cssText = 'transform:skewX(8deg);display:inline-block';
    span.textContent = label;
    b.appendChild(span);
    c.appendChild(b);
  };

  const pLabels = S.maxPeriods === 3 ? ['D1','D2','D3'] : ['H1','H2'];

  for (let i = 1; i <= S.maxPeriods; i++) {
    if (i > 1) addSep();
    const idx = i;
    addNode('ct-flow-p-' + i, pLabels[i - 1], () => setPeriod(idx));
    if (i < S.maxPeriods) {
      addSep();
      addNode('ct-flow-pause-' + i, 'Pause', () => startPauseWithDialog());
    }
  }

  addSep();
  addNode('ct-flow-vl', 'VL', () => startOvertime());
  addSep();
  addNode('ct-flow-ps', 'PS', () => startPenaltyShootoutWithDialog());
}

function startOvertime() {
  if (S.period > S.maxPeriods) return;
  const isCustom = _isCustomFormat();
  const defaultOtMin = _defaultOtSecs() / 60;
  ctConfirm({
    icon: '⏱',
    title: 'Verlängerung starten?',
    body: isCustom
      ? 'Benutzerdefiniertes Format – Verlängerungsdauer festlegen:'
      : `${defaultOtMin} Minuten Verlängerung starten?`,
    okLabel: '▶ Verlängerung starten',
    okClass: 'btn-orange',
    input: isCustom ? { label: 'Verlängerungsdauer', value: defaultOtMin, unit: 'Min', min: 1, max: 60 } : null,
    onOk: (duration) => {
      S.otSecs = isCustom ? (parseInt(duration) || defaultOtMin) * 60 : _defaultOtSecs();
      setPeriod(S.maxPeriods + 1, true);
    },
  });
}

function setPeriod(p, skipConfirm) {
  if (!skipConfirm && p !== S.period) {
    const pn3 = ['1. Drittel','2. Drittel','3. Drittel','Verlängerung'];
    const pn2 = ['1. Halbzeit','2. Halbzeit','Verlängerung'];
    const pn  = S.maxPeriods === 3 ? pn3 : pn2;
    const target = pn[p-1] || 'Verlängerung';
    ctConfirm({
      icon: '⏭',
      title: `Wechsel zu ${target}?`,
      body: 'Die Spieluhr wird zurückgesetzt.',
      okLabel: 'Fortfahren',
      onOk: () => setPeriod(p, true),
    });
    return;
  }
  pushUndo(`Abschnitt ${periodName(S.period)}`, {
    type: 'period',
    prevPeriod: S.period,
    prevClock:  S.clock,
    prevClockMs: clockMs ?? S.clock * 1000,
  });
  stopClock();
  S.period = p;
  S.clock = (S.period > S.maxPeriods) ? (S.otSecs || _defaultOtSecs()) : S.periodSecs;
  clockMs = S.clock * 1000;
  const [m,s] = [Math.floor(S.clock/60), S.clock%60];
  document.getElementById('ct-set-min').value = m;
  document.getElementById('ct-set-sec').value = s;
  buildPeriodPills();
  pushAndRender();
}

