/* ── Floorball Scoreboard ──────────────────────────────────────────────
   Controller-Logik: initController, push, Uhr, Score – benötigt: S, BC, saveState, pushUndo, renderController, buildPeriodPills
────────────────────────────────────────────────────────────────────── */

/* ─── CONTROLLER LOGIC ────────────────────────────────────────────── */
if (!isScoreboard) {
  document.addEventListener('DOMContentLoaded', () => {
    var hasSaved = (function(){
      try {
        var raw = localStorage.getItem('floorball_state_v2');
        if (!raw) return false;
        var s = JSON.parse(raw);
        // expired?
        if (s._savedAt && (Date.now() - s._savedAt) > STATE_MAX_AGE_MS) return false;
        return true;
      } catch(e) { return false; }
    })();
    initController();
    if (!hasSaved) showStartScreen();
  });
} else {
  // Scoreboard side
}

function initController(skipLoad = false) {
  if (!skipLoad) loadState();
  buildPeriodPills();
  applyControllerColors();
  switchTab('spiel');
  renderController();
  initCtNeonPalettes();

  // Restore countdown bar if kickoff is still in the future
  if (S.kickoffTime && S.kickoffTime > Date.now() && !S.gameStarted) {
    startCountdownDisplay();
  }

  // If clock was running when we left, restart it
  if (S.running) {
    S.running = false; // startClock checks this
    startClock();
  }

  // Respond to scoreboard asking for a state push
  BC.onmessage = e => {
    if (e.data.type === 'REQ_STATE') push();
  };

  // Watch control bar height and scale fonts accordingly
  const cb = document.querySelector('.ct-control-bar');
  if (cb && window.ResizeObserver) {
    new ResizeObserver(updateControlBarSizes).observe(cb);
  }
  updateControlBarSizes();

  // Keyboard listeners werden nur einmalig registriert
  if (initController._listenersBound) return;
  initController._listenersBound = true;

  // Einheitliches Ein-/Ausklappen aller Cards: Klick auf den Card-Kopf.
  // Delegiert über document → gilt auch für Cards ohne eigenes onclick.
  document.addEventListener('click', e => {
    const head = e.target.closest('.ct-card-head');
    if (!head) return;
    const card = head.closest('.ct-card.collapsible');
    if (!card || head.parentElement !== card) return;                    // nur der eigene Kopf zählt
    if (e.target.closest('button, input, select, textarea, a, label')) return; // Bedienelemente nicht abfangen
    card.classList.toggle('collapsed');
  });

  // Spacebar toggles clock unless focus is in a text/number input
  document.addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    const tag  = document.activeElement?.tagName?.toLowerCase();
    const type = document.activeElement?.type?.toLowerCase();
    const isText = tag === 'textarea' ||
      (tag === 'input' && (type === 'text' || type === 'number' || type === 'search'));
    if (isText) return;
    const confirmOpen = document.getElementById('ct-confirm-modal')?.classList.contains('open');
    const goalOpen    = document.getElementById('ct-goal-dialog')?.classList.contains('open');
    const setupOpen   = !document.getElementById('setup-overlay')?.classList.contains('hidden');
    if (confirmOpen || goalOpen || setupOpen) return;
    e.preventDefault();
    toggleClock();
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  // H/G = Tor-Dialog Heim/Gast · Shift+H/G = Tor rückgängig
  // 1–9 = Tabs (Spiel, Teams, Strafen, Auszeiten, Einstellungen)
  document.addEventListener('keydown', e => {
    // Ignore if a text/number input is focused
    const tag  = document.activeElement?.tagName?.toLowerCase();
    const type = document.activeElement?.type?.toLowerCase();
    const isText = tag === 'textarea' ||
      (tag === 'input' && (type === 'text' || type === 'number' || type === 'search'));
    if (isText) return;

    const goalOpen    = document.getElementById('ct-goal-dialog')?.classList.contains('open');
    const confirmOpen = document.getElementById('ct-confirm-modal')?.classList.contains('open');
    const setupOpen   = !document.getElementById('setup-overlay')?.classList.contains('hidden');

    // Escape schließt offene Dialoge — läuft VOR dem allgemeinen Block
    if (e.key === 'Escape') {
      if (confirmOpen) { document.getElementById('ct-confirm-cancel')?.click(); e.preventDefault(); return; }
      if (goalOpen)    { closeGoalDialog(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }

    if (goalOpen || confirmOpen || setupOpen) return;

    const key = e.key;

    // Undo
    if ((e.ctrlKey || e.metaKey) && key === 'z') { undo(); e.preventDefault(); return; }

    // Shortcuts-Overlay togglen
    if (key === '?') { toggleShortcutsOverlay(); e.preventDefault(); return; }

    // Tore
    if (key === 'h' || key === 'H') {
      if (e.shiftKey) { adjScore('home', -1); }
      else            { adjScore('home', +1); }
      e.preventDefault(); return;
    }
    if (key === 'g' || key === 'G') {
      if (e.shiftKey) { adjScore('away', -1); }
      else            { adjScore('away', +1); }
      e.preventDefault(); return;
    }

    // Tabs von links nach rechts — dynamisch, damit Events-Tab und Danger Zone
    // korrekt mitgezählt werden wenn sie sichtbar sind
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const idx = parseInt(key);
      if (idx >= 1 && idx <= 9) {
        const allTabIds = ['admin','events','strafen','auszeiten','teams','settings','danger'];
        const visibleTabs = allTabIds.filter(id => {
          const btn = document.getElementById('tab-btn-' + id);
          return btn && btn.offsetParent !== null && getComputedStyle(btn).display !== 'none';
        });
        const target = visibleTabs[idx - 1];
        if (target) { switchTab(target); e.preventDefault(); return; }
      }
    }
  });
}

function toggleShortcutsOverlay() {
  const el = document.getElementById('ct-shortcuts-overlay');
  if (el) el.classList.toggle('visible');
}

function push() {
  const payload = JSON.parse(JSON.stringify(S));
  BC.postMessage({ type: 'STATE', payload });
  // Spielstand an lokalen Express-Server schicken (für OBS stream.html)
  // Nur wenn Server verfügbar (Electron-Modus), sonst still ignorieren
  if (location.protocol === 'http:') {
    const streamPayload = Object.assign({}, payload, { _clockMs: clockMs, _sentAt: Date.now() });
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(streamPayload)
    }).catch(() => {}); // Fehler still ignorieren (z.B. kein Server)
  }
}

// ── Responsive control bar sizing ──
function updateControlBarSizes() {
  const bar = document.getElementById('view-controller');
  if (!bar) return;
  const cb = bar.querySelector('.ct-control-bar');
  if (!cb) return;
  const h = cb.getBoundingClientRect().height;

  // Scale relative to height: base is 136px
  const ratio = h / 180;  // new base height
  const clamp = (min, val, max) => Math.min(max, Math.max(min, val));

  const score   = clamp(52,  Math.round(100 * ratio), 130) + 'px';
  const clock   = clamp(56,  Math.round(84  * ratio), 140) + 'px';
  const name    = clamp(13,  Math.round(18  * ratio),  28) + 'px';
  const adj     = clamp(40,  Math.round(56  * ratio),  80) + 'px';
  const adjIcon = clamp(20,  Math.round(28  * ratio),  40) + 'px';
  const btnPad  = clamp(8,   Math.round(13  * ratio),  20) + 'px';
  const btn     = clamp(13,  Math.round(15  * ratio),  20) + 'px';

  const root = document.documentElement;
  root.style.setProperty('--cb-score',    score);
  root.style.setProperty('--cb-clock',    clock);
  root.style.setProperty('--cb-name',     name);
  root.style.setProperty('--cb-adj',      adj);
  root.style.setProperty('--cb-adj-icon', adjIcon);
  root.style.setProperty('--cb-btn-pad',  btnPad);
  root.style.setProperty('--cb-btn',      btn);
}

// ── Clock ──
function toggleClock() {
  S.running ? stopClock() : startClock();
}

function startClock() {
  if (S.running) return;
  S.running = true;
  S.gameStarted = true;

  // Pending goal confirmed by Bully → clear it now (scoreboard will reveal score)
  if (S.pendingGoal) S.pendingGoal = null;

  // Initialise precise ms tracker from display value if not yet set
  if (clockMs === null) clockMs = S.clock * 1000;
  clockStartedAt = Date.now();

  clockTimer = setInterval(() => {
    const now = Date.now();
    const elapsedMs = now - clockStartedAt;
    clockStartedAt = now;

    const prevSecs = Math.ceil(clockMs / 1000);
    clockMs = Math.max(0, clockMs - elapsedMs);
    const newSecs  = Math.ceil(clockMs / 1000);

    // Tick penalties/timeout once per elapsed whole second
    const tickCount = prevSecs - newSecs;
    for (let i = 0; i < tickCount; i++) {
      tickPenalties();
      tickTimeout();
    }

    // Update display (whole seconds)
    S.clock = Math.ceil(clockMs / 1000);

    if (clockMs <= 0) {
      stopClock();
      playBuzzer();
      onPeriodEnd();
      return;
    }
    pushAndRender();
  }, 100); // 100ms poll – smooth and accurate
  pushAndRender();
}

function stopClock() {
  if (S.running && clockStartedAt !== null) {
    // Capture any remaining ms since last interval tick
    const elapsedMs = Date.now() - clockStartedAt;
    const prevSecs = Math.ceil(clockMs / 1000);
    clockMs = Math.max(0, clockMs - elapsedMs);
    const newSecs  = Math.ceil(clockMs / 1000);

    const tickCount = prevSecs - newSecs;
    for (let i = 0; i < tickCount; i++) {
      tickPenalties();
      tickTimeout();
    }
    S.clock = Math.ceil(clockMs / 1000);
  }
  S.running = false;
  clearInterval(clockTimer); clockTimer = null;
  clockStartedAt = null;
  pushAndRender();
}

function setClock() {
  pushUndo('Uhr gesetzt', {
    type: 'clock',
    prevClock:  S.clock,
    prevClockMs: clockMs ?? S.clock * 1000,
  });
  const m = parseInt(document.getElementById('ct-set-min').value) || 0;
  const s = parseInt(document.getElementById('ct-set-sec').value) || 0;
  S.clock = m * 60 + s;
  clockMs = S.clock * 1000; // reset precise tracker too
  pushAndRender();
}

// ── Score ──
function adjScore(side, delta) {
  if (delta > 0) {
    if (S.showEventsTab) {
      _pendingGoalSide = side;
      openGoalDialog(side);
    } else {
      pushUndo(`Tor ${side === 'home' ? S.homeName : S.awayName}`, {
        type: 'goal', side,
        prevScore: side === 'home' ? S.homeScore : S.awayScore,
        prevPendingGoal: S.pendingGoal,
      });
      if (side === 'home') S.homeScore = Math.max(0, S.homeScore + 1);
      else                 S.awayScore = Math.max(0, S.awayScore + 1);
      if (S.period > S.maxPeriods) {
        // Golden Goal – kein Bully, Uhr stoppen
        S.pendingGoal = null;
        pushAndRender();
        checkGoldenGoal(side);
      } else {
        S.pendingGoal = { side, scorer: null, assist: null };
        checkPowerPlayPenalty(side, null); // null = no goalType known (not penalty/own)
        pushAndRender();
      }
    }
  } else {
    pushUndo(`Tor entfernt ${side === 'home' ? S.homeName : S.awayName}`, {
      type: 'goal', side,
      prevScore: side === 'home' ? S.homeScore : S.awayScore,
      prevPendingGoal: S.pendingGoal,
    });
    if (side === 'home') S.homeScore = Math.max(0, S.homeScore + delta);
    else                 S.awayScore = Math.max(0, S.awayScore + delta);
    pushAndRender();
  }
}

/**
 * After a goal: check if scoring team was in power play and offer to remove
 * the shortest active penalty from the opposing team.
 * Rules:
 *  - Only when goalType is normal (not 'penalty' / 'own')
 *  - Only when opposing team has strictly more active penalties (true PP)
 *  - Only the shortest non-waiting penalty is offered for removal
 */
function checkPowerPlayPenalty(scoringSide, goalType) {
  if (goalType === 'penalty' || goalType === 'own') return;

  const oppSide = scoringSide === 'home' ? 'away' : 'home';
  const myPens  = teamStrengthPens(scoringSide).length;
  const oppPens = teamStrengthPens(oppSide).length;

  // True power play: opposing team has strictly more penalties
  if (oppPens <= myPens) return;

  // Find the shortest currently MEASURED penalty on opposing team.
  // §6.3.3: nur laufende Strafen zählen – eine wegen des Team-Limits
  // wartende Strafe wird nicht aufgehoben.
  const oppPensArr = S[oppSide + 'Penalties'] || [];
  const running = runningPenIds(oppPensArr, maxPensFor(S));
  const active = oppPensArr
    .filter(p => running.has(p.id))
    .sort((a, b) => a.remaining - b.remaining);
  if (!active.length) return;

  const pen = active[0];
  const teamName = oppSide === 'home' ? S.homeName : S.awayName;
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const typeLabel = pen.redCardLabel ? pen.redCardLabel + ' 2+2' :
                    pen.doubleFirst ? '2+2 MIN (1)' :
                    pen.personal    ? '10 MIN PERS.' :
                    pen.secs <= 120 ? '2 MIN' : '10 MIN';

  ctConfirm({
    icon: '⚑',
    title: 'Strafe aufheben?',
    body: `${teamName} hat ein Tor in Unterzahl kassiert. Strafe #${pen.number} (${typeLabel}, noch ${fmt(pen.remaining)}) aufheben?`,
    okLabel: 'Strafe aufheben',
    okClass: 'btn-lime',
    onOk: () => removePenalty(oppSide, pen.id),
    onCancel: () => {},
  });
}

// ── Names / Logos ──

function onColorChange(side, field, value) {
  S[side + field] = value;
  const hexEl = document.getElementById('ct-' + side + '-' + field.toLowerCase() + '-hex');
  if (hexEl) hexEl.textContent = value;
  // Sync active state on neon palette
  if (field === 'Accent') {
    const pal = document.getElementById('ct-' + side + '-neon-palette');
    if (pal) pal.querySelectorAll('.neon-swatch').forEach(b =>
      b.classList.toggle('active', b.style.background.toLowerCase() === value.toLowerCase() ||
        b.title.toLowerCase() === value.toLowerCase()));
  }
  applyControllerColors();
  pushAndRender();
}

function resetColor(side, field) {
  const defaults = { homeAccent: '#c8ff00', awayAccent: '#22c55e', homeJersey: '#0d2e0d', awayJersey: '#0a1a0a' };
  const key = side + field;
  const def = defaults[key] || '#ffffff';
  S[key] = def;
  const inputEl = document.getElementById('ct-' + side + '-' + field.toLowerCase());
  const hexEl   = document.getElementById('ct-' + side + '-' + field.toLowerCase() + '-hex');
  if (inputEl) inputEl.value = def;
  if (hexEl)   hexEl.textContent = def;
  if (field === 'Accent') initCtNeonPalettes();
  applyControllerColors();
  pushAndRender();
}

// returns perceived luminance 0..1
function luminance(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const toL = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  return 0.2126*toL(r) + 0.7152*toL(g) + 0.0722*toL(b);
}

function contrastText(hex) {
  return luminance(hex) > 0.35 ? '#000000' : '#ffffff';
}

// hex -> rgba string for glow
function hexGlow(hex, alpha=0.3) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function applyControllerColors() {
  // Card head accents
  document.querySelectorAll('.ct-card-head.lime').forEach(el =>
    el.style.borderLeftColor = S.homeAccent);
  document.querySelectorAll('.ct-card-head.cyan').forEach(el =>
    el.style.borderLeftColor = S.awayAccent);
  // Score + name colors
  const hs = document.getElementById('ct-home-score');
  const as = document.getElementById('ct-away-score');
  const hn = document.getElementById('ct-bar-home-name');
  const an = document.getElementById('ct-bar-away-name');
  if (hs) hs.style.color = S.homeAccent;
  if (as) as.style.color = S.awayAccent;
  if (hn) hn.style.color = S.homeAccent;
  if (an) an.style.color = S.awayAccent;
  // Top accent bars on control bar team sections
  const hbar = document.querySelector('.ct-team-bar.home');
  const abar = document.querySelector('.ct-team-bar.away');
  if (hbar) hbar.style.setProperty('--team-accent', S.homeAccent);
  if (abar) abar.style.setProperty('--team-accent', S.awayAccent);
  // Also update the plus adj buttons
  document.querySelectorAll('.ct-bar-adj.plus.home').forEach(b => {
    b.style.background = S.homeAccent; b.style.color = '#0a0a0a';
  });
  document.querySelectorAll('.ct-bar-adj.plus.away').forEach(b => {
    b.style.background = S.awayAccent; b.style.color = '#0a0a0a';
  });
}

function applyScoreboardColors(s) {
  const hc = s.homeAccent  || '#c8ff00';
  const ac = s.awayAccent  || '#22c55e';
  const hj = s.homeJersey  || '#0d2e0d';
  const aj = s.awayJersey  || '#0a1a0a';
  const root = document.documentElement;
  root.style.setProperty('--sb-home', hc);
  root.style.setProperty('--sb-away', ac);
  root.style.setProperty('--sb-home-text', contrastText(hc));
  root.style.setProperty('--sb-away-text', contrastText(ac));
  root.style.setProperty('--sb-home-glow', hexGlow(hc, 0.28));
  root.style.setProperty('--sb-away-glow', hexGlow(ac, 0.28));
  root.style.setProperty('--sb-home-glow-dim', hexGlow(hc, 0.08));
  root.style.setProperty('--sb-away-glow-dim', hexGlow(ac, 0.08));
}

function onNameChange() {
  S.homeName = document.getElementById('ct-home-name').value || 'HEIMTEAM';
  S.awayName = document.getElementById('ct-away-name').value || 'GASTTEAM';
  updateLogoThumbs();
  pushAndRender();
}

function onLogo(side, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    S[side + 'Logo'] = e.target.result;
    updateLogoThumbs();
    extractColorsFromLogo(e.target.result, colors => {
      renderColorSwatches('ct-' + side, colors, (hex, type) => {
        if (type === 'accent') {
          S[side + 'Accent'] = hex;
          document.getElementById('ct-' + side + '-accent').value = hex;
          document.getElementById('ct-' + side + '-accent-hex').textContent = hex;
          onColorChange(side, 'Accent', hex);
        } else {
          S[side + 'Jersey'] = hex;
          document.getElementById('ct-' + side + '-jersey').value = hex;
          document.getElementById('ct-' + side + '-jersey-hex').textContent = hex;
          onColorChange(side, 'Jersey', hex);
        }
      });
    });
    pushAndRender();
  };
  reader.readAsDataURL(file);
}

function removeLogo(side) {
  S[side + 'Logo'] = null;
  document.getElementById('ct-' + side + '-logo-file').value = '';
  // Hide color suggestions
  const sugg = document.getElementById('ct-' + side + '-color-suggestions');
  if (sugg) sugg.style.display = 'none';
  updateLogoThumbs();
  pushAndRender();
}

function updateLogoThumbs() {
  ['home','away'].forEach(side => {
    const el = document.getElementById('ct-' + side + '-logo-prev');
    const logo = S[side + 'Logo'];
    const name = side === 'home' ? S.homeName : S.awayName;
    el.innerHTML = logo ? `<img src="${logo}">` : name.charAt(0);
  });
}

