/* ── Floorball Scoreboard ──────────────────────────────────────────────
   UI-Layer: Help, Startscreen, Countdown, Setup-Dialog – benötigt: S, push, pushAndRender, renderController
────────────────────────────────────────────────────────────────────── */

function toggleCard(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle('collapsed');
}

function setCardCollapsed(cardId, collapsed) {
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle('collapsed', collapsed);
}

function endSecondaryTimer() {
  if (S.activeTimeout) endTimeout();
  else if (S.pause) endPause();
}

/* ─── HELP MODAL ──────────────────────────────────────────────────── */
function openHelp() {
  const m = document.getElementById('ct-help-modal');
  m.style.display = 'flex';
  // small tick needed so the transition fires
  requestAnimationFrame(() => m.classList.add('open'));
}
function closeHelp() {
  const m = document.getElementById('ct-help-modal');
  m.classList.remove('open');
  m.style.display = 'none';
}
// Close on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('ct-help-modal');
  if (m) m.addEventListener('click', e => { if (e.target === m) closeHelp(); });
  // Escape key closes help
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && m && m.style.display !== 'none') closeHelp();
  });
});


/* ─── START SCREEN LOGIC ──────────────────────────────────────────── */
function showStartScreen() {
  var vs = document.getElementById('view-start');
  var vc = document.getElementById('view-controller');
  if (vs) { vs.style.display = 'flex'; vs.classList.add('visible'); }
  if (vc) vc.style.display = 'none';
}
function hideStartScreen() {
  var vs = document.getElementById('view-start');
  var vc = document.getElementById('view-controller');
  if (vs) vs.style.display = 'none';
  if (vc) vc.style.display = 'flex';
}
function startBlankGame() { hideStartScreen(); renderController(); pushAndRender(); }
function startConfiguredGame() { hideStartScreen(); renderController(); pushAndRender(); setTimeout(function(){ setupOpen(); }, 80); }

/* ─── COUNTDOWN CONTROLLER ───────────────────────────────────────── */
let ctCountdownTimer = null;

function startCountdownDisplay() {
  // Already has kickoffTime in S, just start the controller ticker
  updateCtCountdownBar();
  if (!ctCountdownTimer) {
    ctCountdownTimer = setInterval(updateCtCountdownBar, 1000);
  }
  pushAndRender();
}

function updateCtCountdownBar() {
  const bar = document.getElementById('ct-countdown-bar');
  const display = document.getElementById('ct-countdown-display');
  if (!bar || !display) return;

  if (!S.kickoffTime || S.gameStarted) {
    bar.style.display = 'none';
    if (ctCountdownTimer) { clearInterval(ctCountdownTimer); ctCountdownTimer = null; }
    return;
  }

  const diff = Math.max(0, S.kickoffTime - Date.now());
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => String(n).padStart(2,'0');

  display.textContent = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  display.style.color = totalSec <= 300 ? 'var(--lime)' : 'rgba(255,255,255,.6)';
  bar.style.display = 'flex';

  // Auto-stop when countdown reaches 0
  if (diff <= 0) {
    stopCountdown();
  }
}

function stopCountdown() {
  S.kickoffTime = null;
  const bar = document.getElementById('ct-countdown-bar');
  if (bar) bar.style.display = 'none';
  if (ctCountdownTimer) { clearInterval(ctCountdownTimer); ctCountdownTimer = null; }
  pushAndRender();
  saveState();
}

function setupClose() {
  document.getElementById('setup-overlay').classList.add('hidden');
}

/* ── THEME TOGGLE ── */
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  updateThemeToggleUI(isLight);
  try { localStorage.setItem('sb-theme', isLight ? 'light' : 'dark'); } catch(e) {}
}

function updateThemeToggleUI(isLight) {
  const label  = document.getElementById('ct-theme-label');
  const toggle = document.getElementById('ct-theme-toggle');
  const knob   = document.getElementById('ct-theme-knob');
  if (label)  label.textContent = isLight ? 'AN' : 'AUS';
  if (toggle) toggle.style.background = isLight ? 'var(--lime)' : 'var(--ct-muted)';
  if (knob)   knob.style.left = isLight ? '22px' : '2px';
}

(function initTheme() {
  try {
    const saved = localStorage.getItem('sb-theme');
    if (saved === 'light') {
      document.body.classList.add('light-mode');
      document.addEventListener('DOMContentLoaded', () => updateThemeToggleUI(true));
    }
  } catch(e) {}
})();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('setup-overlay');
    if (overlay && !overlay.classList.contains('hidden')) { setupClose(); return; }
    const scOverlay = document.getElementById('ct-shortcuts-overlay');
    if (scOverlay && scOverlay.classList.contains('visible')) { scOverlay.classList.remove('visible'); return; }
    const goalDialog = document.getElementById('ct-goal-dialog');
    if (goalDialog && goalDialog.classList.contains('open')) { closeGoalDialog(); return; }
    const confirmModal = document.getElementById('ct-confirm-modal');
    if (confirmModal && confirmModal.classList.contains('open')) { confirmModal.classList.remove('open'); return; }
  }
});

/* ─── SETUP DIALOG ────────────────────────────────────────────────── */
let setupPendingGame = null;
let setupHomeLogo = null;
let setupAwayLogo = null;

function setupSmLoad() {
  const raw = (document.getElementById('setup-sm-input').value || '').trim();
  setupSmSetStatus('');
  document.getElementById('setup-sm-preview').style.display = 'none';
  setupPendingGame = null;
  if (!raw) { setupSmSetStatus('⚠ Bitte URL oder Spiel-ID eingeben.'); return; }

  // Check if user pasted raw JSON directly
  if (raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw);
      setupSmShowPreview(data);
      return;
    } catch(e) {
      setupSmSetStatus('⚠ JSON ungültig. Bitte erneut kopieren.');
      return;
    }
  }

  const match = raw.match(/\/spiel\/(\d+)|^(\d+)$/);
  if (!match) { setupSmSetStatus('⚠ Keine Spiel-ID erkannt.'); return; }
  const gameId = match[1] || match[2];
  const apiUrl = `https://saisonmanager.de/api/v2/games/${gameId}.json`;
  setupSmSetStatus('⏳ Lade Spieldaten…', true);
  fetch(apiUrl)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => { setupSmSetStatus(''); setupSmShowPreview(data); })
    .catch(() => setupSmShowJsonFallback(gameId, apiUrl));
}

function setupSmShowJsonFallback(gameId, apiUrl) {
  const statusEl = document.getElementById('setup-sm-status');
  statusEl.style.display = 'block';
  statusEl.style.color = 'rgba(255,255,255,.5)';
  statusEl.innerHTML = `
    <div style="line-height:1.7;font-size:12px">
      <div style="color:var(--lime,#c8ff00);font-weight:700;letter-spacing:2px;margin-bottom:6px">DIREKTABRUF NICHT MÖGLICH</div>
      <div>① Öffne diesen Link im Browser:</div>
      <div style="margin:4px 0 8px">
        <a href="${apiUrl}" target="_blank"
           style="color:var(--lime,#c8ff00);font-family:monospace;font-size:11px;word-break:break-all">
          ${apiUrl}
        </a>
      </div>
      <div>② Kopiere den gesamten Seiteninhalt (Strg+A, Strg+C)</div>
      <div style="margin-top:4px">③ Füge ihn oben ins Eingabefeld ein und klicke „Laden"</div>
    </div>`;
}

function setupSmSetStatus(msg, isOk) {
  const el = document.getElementById('setup-sm-status');
  el.style.display = msg ? 'block' : 'none';
  el.style.color = isOk ? 'var(--lime)' : 'var(--red,#ff3b3b)';
  el.textContent = msg;
}

function setupSmShowPreview(g) {
  setupPendingGame = g;
  const homeName = g.home_team_name || 'HEIM';
  const awayName = g.guest_team_name || 'GAST';
  const homeLogo = g.home_team_small_logo || g.home_team_logo || null;
  const awayLogo = g.guest_team_small_logo || g.guest_team_logo || null;
  const date = g.date ? new Date(g.date + 'T' + (g.start_time || '00:00'))
    .toLocaleDateString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
  const arena = g.arena_short || g.arena_name || '';

  function logoHtml(url, initial) {
    if (!url) return initial;
    const abs = url.startsWith('http') ? url : 'https://saisonmanager.de' + url;
    return `<img src="${abs}" style="width:100%;height:100%;object-fit:contain">`;
  }
  document.getElementById('setup-sm-home-logo').innerHTML = logoHtml(homeLogo, homeName[0]);
  document.getElementById('setup-sm-away-logo').innerHTML = logoHtml(awayLogo, awayName[0]);
  document.getElementById('setup-sm-home-name').textContent = homeName;
  document.getElementById('setup-sm-away-name').textContent = awayName;
  document.getElementById('setup-sm-meta').textContent = [date, arena].filter(Boolean).join(' · ');
  document.getElementById('setup-sm-preview').style.display = 'flex';

  // Auto-detect format from league name and pre-select
  const leagueName = g.league_name || g.competition_name || '';
  const detectedFormat = detectFormatFromLeague(leagueName, g.game_operation_name || '');
  if (detectedFormat) {
    const sel = document.getElementById('setup-format');
    if (sel) {
      sel.value = detectedFormat;
      onSetupFormatChange();
      // Show hint only when league name was present (detection was meaningful)
      if (leagueName) {
        const formatLabels = { '3': 'Großfeld 3×20', '3s': 'Großfeld Spieltag 3×15', '2': 'Kleinfeld 2×20' };
        const metaEl = document.getElementById('setup-sm-meta');
        if (metaEl && formatLabels[detectedFormat]) {
          metaEl.textContent = [date, arena, `→ ${formatLabels[detectedFormat]} erkannt`].filter(Boolean).join(' · ');
        }
      }
    }
  }
}

function setupSmApply() {
  const g = setupPendingGame;
  if (!g) return;

  const homeName = (g.home_team_name || 'HEIM').toUpperCase();
  const awayName = (g.guest_team_name || 'GAST').toUpperCase();
  document.getElementById('setup-home-name').value = homeName;
  document.getElementById('setup-away-name').value = awayName;

  // Fill league name
  if (g.league_name || g.competition_name) {
    document.getElementById('setup-league').value = g.league_name || g.competition_name || '';
  }

  // Fill kickoff datetime
  if (g.date && g.start_time) {
    try {
      const dt = new Date(g.date + 'T' + g.start_time);
      const pad = n => String(n).padStart(2,'0');
      const local = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      document.getElementById('setup-kickoff').value = local;
    } catch(e) {}
  }

  document.getElementById('setup-sm-preview').style.display = 'none';
  setupSmSetStatus(`✓ ${homeName} vs ${awayName} übernommen!`, true);
  setTimeout(() => setupSmSetStatus(''), 3000);
  setupPendingGame = null;

  // Fetch each logo as blob → DataURL so pixel analysis + color picker work without CORS issues
  function fetchLogoAsDataUrl(rawUrl, side) {
    if (!rawUrl) return;
    const abs = rawUrl.startsWith('http') ? rawUrl : 'https://saisonmanager.de' + rawUrl;

    // Show logo immediately via <img> so it's visible while fetch runs
    const prev = document.getElementById('setup-' + side + '-logo-prev');
    if (prev) prev.innerHTML = `<img src="${abs}" style="width:100%;height:100%;object-fit:contain">`;

    fetch(abs)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.blob(); })
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => {
        // Store as DataURL — from here on identical to manual upload
        if (side === 'home') setupHomeLogo = dataUrl;
        else setupAwayLogo = dataUrl;

        // Update thumb to use DataURL (enables pixel reading in modal)
        if (prev) prev.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain">`;

        // Run color extraction
        extractColorsFromLogo(dataUrl, colors => {
          renderColorSwatches('setup-' + side, colors, (hex, type) => {
            if (type === 'accent') {
              document.getElementById('setup-' + side + '-accent').value = hex;
              document.getElementById('setup-' + side + '-accent-hex').textContent = hex;
            } else {
              document.getElementById('setup-' + side + '-jersey').value = hex;
              document.getElementById('setup-' + side + '-jersey-hex').textContent = hex;
            }
          });
        });
      })
      .catch(() => {
        // fetch blocked — keep external URL, picker will show fallback color input
        if (side === 'home') setupHomeLogo = abs;
        else setupAwayLogo = abs;
      });
  }

  fetchLogoAsDataUrl(g.home_team_small_logo || g.home_team_logo, 'home');
  fetchLogoAsDataUrl(g.guest_team_small_logo || g.guest_team_logo, 'away');
}

function setupOnLogo(side, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const url = e.target.result;
    if (side === 'home') setupHomeLogo = url;
    else setupAwayLogo = url;
    const prev = document.getElementById('setup-' + side + '-logo-prev');
    prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:contain">`;
    extractColorsFromLogo(url, colors => {
      renderColorSwatches('setup-' + side, colors, (hex, type) => {
        const accentId = 'setup-' + side + '-accent';
        const jerseyId = 'setup-' + side + '-jersey';
        const accentHexId = 'setup-' + side + '-accent-hex';
        const jerseyHexId = 'setup-' + side + '-jersey-hex';
        if (type === 'accent') {
          document.getElementById(accentId).value = hex;
          document.getElementById(accentHexId).textContent = hex;
        } else {
          document.getElementById(jerseyId).value = hex;
          document.getElementById(jerseyHexId).textContent = hex;
        }
      });
    });
  };
  reader.readAsDataURL(file);
}

function setupRemoveLogo(side) {
  if (side === 'home') setupHomeLogo = null;
  else setupAwayLogo = null;
  const name = side === 'home'
    ? (document.getElementById('setup-home-name').value || 'H')[0].toUpperCase()
    : (document.getElementById('setup-away-name').value || 'G')[0].toUpperCase();
  document.getElementById('setup-' + side + '-logo-prev').innerHTML = name;
  // Hide color suggestions
  const sugg = document.getElementById('setup-' + side + '-color-suggestions');
  if (sugg) sugg.style.display = 'none';
}

function setupStart() {
  // Collect values from the dialog
  const homeName = (document.getElementById('setup-home-name').value || 'HEIMTEAM').toUpperCase();
  const awayName = (document.getElementById('setup-away-name').value || 'GASTTEAM').toUpperCase();
  const format   = document.getElementById('setup-format').value;
  const league   = document.getElementById('setup-league').value.trim();
  const kickoff  = document.getElementById('setup-kickoff').value;

  // Apply format
  if (format === 'custom') {
    // Custom: read values directly, bypass ct-format select
    const periods = parseInt(document.getElementById('setup-custom-periods').value) || 3;
    const pMin    = parseInt(document.getElementById('setup-custom-period-min').value) || 20;
    const pausMin = parseInt(document.getElementById('setup-custom-pause-min').value) || 10;
    S.maxPeriods = periods;
    S.periodSecs = pMin * 60;
    S.pauseSecs  = pausMin * 60;
    S.period = 1;
    S.clock  = S.periodSecs;
    clockMs  = S.clock * 1000;
    S.gameStarted = false;
    document.getElementById('ct-set-min').value = pMin;
    document.getElementById('ct-set-sec').value = 0;
    // Sync hidden ct-format to closest standard (so controller dropdown makes sense)
    document.getElementById('ct-format').value = periods === 2 ? '2' : '3';
    buildPeriodPills();
  } else {
    document.getElementById('ct-format').value = format;
    onFormatChange();
  }

  // Apply team names + logos + colors into main state
  S.homeName = homeName;
  S.awayName = awayName;
  document.getElementById('ct-home-name').value = homeName;
  document.getElementById('ct-away-name').value = awayName;

  if (setupHomeLogo) {
    S.homeLogo = setupHomeLogo;
    const prev = document.getElementById('ct-home-logo-prev');
    if (prev) prev.innerHTML = `<img src="${setupHomeLogo}" style="width:100%;height:100%;object-fit:contain">`;
  }
  if (setupAwayLogo) {
    S.awayLogo = setupAwayLogo;
    const prev = document.getElementById('ct-away-logo-prev');
    if (prev) prev.innerHTML = `<img src="${setupAwayLogo}" style="width:100%;height:100%;object-fit:contain">`;
  }

  const homeAccent = document.getElementById('setup-home-accent').value;
  const awayAccent = document.getElementById('setup-away-accent').value;
  const homeJersey = document.getElementById('setup-home-jersey').value;
  const awayJersey = document.getElementById('setup-away-jersey').value;

  S.homeAccent = homeAccent; S.awayAccent = awayAccent;
  S.homeJersey = homeJersey; S.awayJersey = awayJersey;
  document.getElementById('ct-home-accent').value = homeAccent;
  document.getElementById('ct-away-accent').value = awayAccent;
  document.getElementById('ct-home-jersey').value = homeJersey;
  document.getElementById('ct-away-jersey').value = awayJersey;
  document.getElementById('ct-home-accent-hex').textContent = homeAccent;
  document.getElementById('ct-away-accent-hex').textContent = awayAccent;
  document.getElementById('ct-home-jersey-hex').textContent = homeJersey;
  document.getElementById('ct-away-jersey-hex').textContent = awayJersey;

  // Store league and kickoff in state
  S.leagueName = league || null;
  S.kickoffTime = kickoff ? new Date(kickoff).getTime() : null;

  // Hide setup overlay, save state, push to scoreboard
  document.getElementById('setup-overlay').classList.add('hidden');
  applyControllerColors();
  pushAndRender();
  saveState();

  // Ask about countdown only if kickoff time was set
  if (S.kickoffTime && S.kickoffTime > Date.now()) {
    const dt = new Date(S.kickoffTime);
    const pad = n => String(n).padStart(2,'0');
    const timeStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    ctConfirm({
      icon: '◷',
      title: 'Countdown anzeigen?',
      body: `Soll auf dem Scoreboard ein Countdown bis ${timeStr} Uhr angezeigt werden?`,
      okLabel: 'Ja, Countdown starten',
      okClass: 'btn-lime',
      onOk: () => startCountdownDisplay(),
      onCancel: () => {
        S.kickoffTime = null;
        pushAndRender();
        saveState();
      }
    });
  }

  // Push state to scoreboard and render
  applyControllerColors();
  pushAndRender();
  saveState();
}

function setupOpen() {
  // Pre-fill from current state when re-opening
  document.getElementById('setup-home-name').value = S.homeName;
  document.getElementById('setup-away-name').value = S.awayName;
  document.getElementById('setup-home-accent').value = S.homeAccent;
  document.getElementById('setup-away-accent').value = S.awayAccent;
  document.getElementById('setup-home-jersey').value = S.homeJersey;
  document.getElementById('setup-away-jersey').value = S.awayJersey;
  document.getElementById('setup-home-accent-hex').textContent = S.homeAccent;
  document.getElementById('setup-away-accent-hex').textContent = S.awayAccent;
  document.getElementById('setup-home-jersey-hex').textContent = S.homeJersey;
  document.getElementById('setup-away-jersey-hex').textContent = S.awayJersey;
  document.getElementById('setup-league').value = S.leagueName || '';

  // Restore format selection
  const sel = document.getElementById('setup-format');
  const pMin = Math.round(S.periodSecs / 60);
  const pausMin = Math.round(S.pauseSecs / 60);
  const isStd3  = S.maxPeriods === 3 && S.periodSecs === 1200;
  const isStd3s = S.maxPeriods === 3 && S.periodSecs === 900;
  const isStd2  = S.maxPeriods === 2 && S.periodSecs === 1200;
  if (isStd3)       sel.value = '3';
  else if (isStd3s) sel.value = '3s';
  else if (isStd2)  sel.value = '2';
  else {
    sel.value = 'custom';
    document.getElementById('setup-custom-periods').value = String(S.maxPeriods);
    document.getElementById('setup-custom-period-min').value = String(pMin);
    document.getElementById('setup-custom-pause-min').value = String(pausMin);
    updateSetupCustomSummary();
  }
  onSetupFormatChange();

  if (S.kickoffTime) {
    const dt = new Date(S.kickoffTime);
    const pad = n => String(n).padStart(2,'0');
    document.getElementById('setup-kickoff').value =
      `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  } else {
    document.getElementById('setup-kickoff').value = '';
  }
  if (S.homeLogo) {
    setupHomeLogo = S.homeLogo;
    document.getElementById('setup-home-logo-prev').innerHTML = `<img src="${S.homeLogo}" style="width:100%;height:100%;object-fit:contain">`;
  }
  if (S.awayLogo) {
    setupAwayLogo = S.awayLogo;
    document.getElementById('setup-away-logo-prev').innerHTML = `<img src="${S.awayLogo}" style="width:100%;height:100%;object-fit:contain">`;
  }
  document.getElementById('setup-overlay').classList.remove('hidden');
  initSetupNeonPalettes();
}

/* ─── COUNTDOWN (Scoreboard side) ───────────────────────────────── */
let countdownTimer = null;

function updateCountdown(state) {
  const cd = document.getElementById('sb-countdown');
  if (!cd) return;

  if (!state.kickoffTime || state.gameStarted) {
    cd.classList.remove('active');
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    return;
  }

  function renderCd() {
    const now = Date.now();
    const diff = Math.max(0, state.kickoffTime - now);
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = n => String(n).padStart(2,'0');
    const timeEl = document.getElementById('sbc-time');
    if (!timeEl) return;

    let display;
    if (h > 0) display = `${h}:${pad(m)}:${pad(s)}`;
    else display = `${pad(m)}:${pad(s)}`;

    timeEl.textContent = display;
    timeEl.classList.toggle('soon', totalSec <= 300 && totalSec > 0);

    if (diff <= 0) {
      timeEl.textContent = 'JETZT';
      timeEl.classList.add('soon');
    }
  }

  // Fill team info
  function logoHtml(url, initial) {
    if (!url) return initial;
    return `<img src="${url}" style="width:100%;height:100%;object-fit:contain">`;
  }
  const el = (id, html) => { const e = document.getElementById(id); if (e && e.innerHTML !== html) e.innerHTML = html; };
  el('sbc-home-logo', state.homeLogo ? logoHtml(state.homeLogo, state.homeName[0]) : state.homeName[0]);
  el('sbc-away-logo', state.awayLogo ? logoHtml(state.awayLogo, state.awayName[0]) : state.awayName[0]);
  document.getElementById('sbc-home-name').textContent = state.homeName;
  document.getElementById('sbc-away-name').textContent = state.awayName;
  document.getElementById('sbc-home-name').style.color = state.homeAccent || '#c8ff00';
  document.getElementById('sbc-away-name').style.color = state.awayAccent || '#22c55e';
  document.getElementById('sbc-league').textContent = state.leagueName || '';

  cd.classList.add('active');
  renderCd();
  if (!countdownTimer) countdownTimer = setInterval(renderCd, 1000);
}

(function initTabDragHandle() {
  const MIN_H = 100;
  const MAX_H = 400;
  const STORED_KEY = 'ct-tab-area-height';
  const DEFAULT_H = 160;

  function applyHeight(h) {
    h = Math.min(MAX_H, Math.max(MIN_H, h));
    const ta = document.getElementById('ct-tab-area');
    if (!ta) return;
    ta.style.flexBasis = h + 'px';
    try { localStorage.setItem(STORED_KEY, h); } catch(e) {}
  }

  function initHandle() {
    const handle = document.getElementById('ct-tab-drag-handle');
    const ta     = document.getElementById('ct-tab-area');
    if (!handle || !ta) return;

    // Restore saved height (applied when tab opens)
    let savedH = DEFAULT_H;
    try {
      const s = parseInt(localStorage.getItem(STORED_KEY));
      if (s >= MIN_H && s <= MAX_H) savedH = s;
    } catch(e) {}

    // Patch switchTab to apply saved height when opening
    const origSwitchTab = window.switchTab;
    window.switchTab = function(tab) {
      origSwitchTab(tab);
      const isOpen = ta.classList.contains('tab-open');
      if (isOpen) ta.style.flexBasis = savedH + 'px';
      else ta.style.flexBasis = '';
    };

    let startY = 0, startH = 0, dragging = false;

    function onMove(e) {
      if (!dragging) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      // dragging up = increasing height (handle is at top of tab-area)
      const newH = startH - (clientY - startY);
      savedH = Math.min(MAX_H, Math.max(MIN_H, newH));
      applyHeight(savedH);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      ta.classList.remove('dragging');
      handle.querySelector('.ct-tab-drag-grip').style.background = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onUp);
    }

    handle.addEventListener('mousedown', e => {
      if (!ta.classList.contains('tab-open')) return;
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startH = ta.getBoundingClientRect().height;
      ta.classList.add('dragging');
      handle.querySelector('.ct-tab-drag-grip').style.background = 'var(--lime)';
      document.body.style.cursor    = 'ns-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    });

    handle.addEventListener('touchstart', e => {
      if (!ta.classList.contains('tab-open')) return;
      dragging = true;
      startY = e.touches[0].clientY;
      startH = ta.getBoundingClientRect().height;
      ta.classList.add('dragging');
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend',  onUp);
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHandle);
  } else {
    initHandle();
  }
})();
