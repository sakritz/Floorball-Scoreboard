/* ── Floorball Scoreboard ──────────────────────────────────────────────
   Spielfluss: renderController, pushAndRender, Strafen, Perioden, Auszeiten – benötigt: S, BC, push, saveState, pushUndo
────────────────────────────────────────────────────────────────────── */

/* ─── SPIELFLUSS-AUTOMATIK ─────────────────────────────────────────── */

// Erkennt ob ein benutzerdefiniertes Format aktiv ist (nicht Regelstandard)
function _isCustomFormat() {
  return !(
    (S.maxPeriods === 3 && S.periodSecs === 1200) || // Großfeld 3×20
    (S.maxPeriods === 3 && S.periodSecs === 900)  || // Großfeld Spieltag 3×15
    (S.maxPeriods === 2 && S.periodSecs === 1200)    // Kleinfeld 2×20
  );
}

// Regelkonforme VL-Dauer (§2.3): Kleinfeld 5 Min, sonst 10 Min
function _defaultOtSecs() {
  return (S.maxPeriods === 2 && S.periodSecs === 1200) ? 300 : 600;
}

// Golden Goal: Tor in der Verlängerung beendet das Spiel sofort (§2.3)
function checkGoldenGoal(side) {
  if (S.period <= S.maxPeriods) return false;
  stopClock();
  const winner = side === 'home' ? S.homeName : S.awayName;
  setTimeout(() => {
    ctAlert({
      icon: '🏆',
      title: 'Golden Goal!',
      body: `${winner} gewinnt die Verlängerung! Endstand: ${S.homeScore}:${S.awayScore}`,
    });
  }, 80);
  return true;
}

function periodName(p) {
  if (p > S.maxPeriods) return 'Verlängerung';
  if (S.maxPeriods === 2) return p === 1 ? '1. Halbzeit' : '2. Halbzeit';
  return p === 1 ? '1. Drittel' : p === 2 ? '2. Drittel' : '3. Drittel';
}

function nextPeriodName() {
  const next = S.period + 1;
  if (next > S.maxPeriods) return 'Verlängerung';
  if (S.maxPeriods === 2) return next === 1 ? '1. Halbzeit' : '2. Halbzeit';
  return next === 1 ? '1. Drittel' : next === 2 ? '2. Drittel' : '3. Drittel';
}

function onPeriodEnd() {
  const isOT    = S.period > S.maxPeriods;
  const isLast  = S.period === S.maxPeriods || isOT;
  const pauseMin = Math.round((S.pauseSecs || 600) / 60);
  const isTied  = S.homeScore === S.awayScore;

  if (isOT) {
    // Verlängerung abgelaufen
    if (isTied) {
      // Noch Gleichstand → Penaltyschießen anbieten
      S.shootoutReady = true;
      saveState();
      ctConfirm({
        icon: '🥊',
        title: 'Verlängerung – Penaltyschießen?',
        body: `Verlängerung ohne Tor · Stand ${S.homeScore}:${S.awayScore}. Jetzt Penaltyschießen starten?`,
        okLabel: '▶ Penaltyschießen starten',
        okClass: 'btn-orange',
        onOk: () => { startPenaltyShootout(); },
        onCancel: () => { pushAndRender(); },
      });
      setTimeout(() => {
        const cancel = document.getElementById('ct-confirm-cancel');
        if (cancel) cancel.textContent = 'Manuell steuern';
      }, 0);
    } else {
      // Gewinner in der VL – Spiel beendet
      ctAlert({ icon: '🏁', title: 'Spielende nach Verlängerung', body: `${S.homeName} ${S.homeScore}:${S.awayScore} ${S.awayName}` });
      pushAndRender();
    }
  } else if (isLast) {
    // Letzter regulärer Abschnitt
    if (isTied) {
      // Gleichstand → Verlängerung anbieten (mit Dauerwahl bei Custom-Format)
      const isCustom = _isCustomFormat();
      const defaultOtMin = _defaultOtSecs() / 60;
      ctConfirm({
        icon: '⚖',
        title: 'Gleichstand – Verlängerung?',
        body: `${periodName(S.period)} abgelaufen · Stand ${S.homeScore}:${S.awayScore}. Verlängerung starten?`,
        okLabel: '▶ Verlängerung starten',
        okClass: 'btn-orange',
        input: isCustom ? { label: 'Verlängerungsdauer', value: defaultOtMin, unit: 'Min', min: 1, max: 60 } : null,
        onOk: (duration) => {
          S.otSecs = isCustom ? (parseInt(duration) || defaultOtMin) * 60 : _defaultOtSecs();
          setPeriod(S.maxPeriods + 1, true);
        },
        onCancel: () => { pushAndRender(); },
      });
      setTimeout(() => {
        const cancel = document.getElementById('ct-confirm-cancel');
        if (cancel) cancel.textContent = 'Spiel beendet';
      }, 0);
    } else {
      // Klarer Sieger – einfache Meldung
      ctAlert({ icon: '🏁', title: 'Spielende', body: `${periodName(S.period)} abgelaufen · ${S.homeName} ${S.homeScore}:${S.awayScore} ${S.awayName}` });
      pushAndRender();
    }
  } else {
    // Zwischendrittel / Halbzeit
    const next = nextPeriodName();
    ctConfirm({
      icon: '⏸',
      title: `${periodName(S.period)} beendet`,
      body: `Pause starten? (${pauseMin} Min) Danach geht es mit ${next} weiter.`,
      okLabel: `▶ Pause starten`,
      okClass: 'btn-lime',
      onOk: () => {
        startPause();
        // when pause ends, prompt for next period
        _flowPauseCallback = true;
      },
      onCancel: () => {
        // Skip pause, go straight to next period
        setPeriod(S.period + 1, true);
      },
    });
    setTimeout(() => {
      const cancel = document.getElementById('ct-confirm-cancel');
      if (cancel) cancel.textContent = `→ Direkt zu ${next}`;
    }, 0);
  }
}

// Flag: after pause ends, show "start next period?" prompt
let _flowPauseCallback = false;

function onPauseEnd() {
  if (!_flowPauseCallback) return;
  _flowPauseCallback = false;
  const next = nextPeriodName();
  ctConfirm({
    icon: '▶',
    title: `Weiter mit ${next}?`,
    body: `Die Pause ist abgelaufen. Jetzt ${next} starten?`,
    okLabel: `▶ ${next} starten`,
    okClass: 'btn-lime',
    onOk: () => setPeriod(S.period + 1, true),
    onCancel: () => { /* manual control */ },
  });
  setTimeout(() => {
    const cancel = document.getElementById('ct-confirm-cancel');
    if (cancel) cancel.textContent = 'Manuell steuern';
  }, 0);
}

function nextPeriod() { if (S.period <= S.maxPeriods) setPeriod(S.period + 1); }
function prevPeriod() { if (S.period > 1) setPeriod(S.period - 1); }

// ── Penalties ──

// Returns only penalties that affect team strength (not personal 10-min)
function teamStrengthPens(side) {
  return (S[side + 'Penalties'] || []).filter(p => !p.personal && !p.waiting);
}
function teamStrengthPensS(pens) {
  // scoreboard version — filters from array
  return (pens || []).filter(p => !p.personal && !p.waiting);
}

/* ─── STRAFCODES (Spielberichtsbogen SPRGK 2022) ──────────────────────── */
const PENALTY_CODES = [
  { code: '901', name: 'Stockschlag' },
  { code: '902', name: 'Blockieren des Stocks' },
  { code: '903', name: 'Anheben des Stocks' },
  { code: '904', name: 'Hoher Stock' },
  { code: '906', name: 'Haken' },
  { code: '907', name: 'Stoßen' },
  { code: '909', name: 'Überharter Körpereinsatz' },
  { code: '910', name: 'Halten' },
  { code: '911', name: 'Sperren' },
  { code: '913', name: 'Hoher Fuß' },
  { code: '915', name: 'Unkorrekter Abstand' },
  { code: '919', name: 'Bodenspiel' },
  { code: '920', name: 'Handspiel' },
  { code: '922', name: 'Wechselfehler' },
  { code: '923', name: 'Wiederholte Vergehen' },
  { code: '924', name: 'Spielverzögerung' },
  { code: '925', name: 'Reklamieren' },
  { code: '950', name: 'Unsportliches Verhalten' },
  { code: '999', name: 'Sonstige Vergehen' },
];

function updatePenReason(side) {
  const reasonEl = document.getElementById('ct-' + side + '-pen-reason');
  if (!reasonEl) return;
  reasonEl.innerHTML = '<option value="">– auswählen –</option>' +
    PENALTY_CODES.map(c =>
      `<option value="${c.code}|${c.name}">${c.code} – ${c.name}</option>`
    ).join('');
}

function addPenalty(side) {
  const num = document.getElementById('ct-' + side + '-pen-num').value || '?';
  const raw = document.getElementById('ct-' + side + '-pen-type').value;
  const now = Date.now();
  pushUndo(`Strafe ${side === 'home' ? S.homeName : S.awayName}`, {
    type: 'penalty', side,
    prevPenalties: JSON.parse(JSON.stringify(S[side + 'Penalties'])),
  });
  let penTypeLabel = '';

  if (raw === 'double' || raw === 'techMatch' || raw === 'match') {
    // Doppelte Zeitstrafe: 2 × 2 Min nacheinander
    // Für techMatch/match: Spieler rausgeflogenen, aber jemand sitzt die 2+2
    const id1 = now;
    const id2 = now + 1;
    const isRed = raw === 'techMatch' || raw === 'match';
    const redLabel = raw === 'techMatch' ? 'TECHN.MATCH' : 'MATCH';
    S[side + 'Penalties'].push({
      id: id1, number: num, secs: 120, remaining: 120,
      doubleFirst: true, doubleId: id2,
      redCard: isRed, redCardLabel: isRed ? redLabel : undefined,
    });
    S[side + 'Penalties'].push({
      id: id2, number: num, secs: 120, remaining: 120,
      doubleSecond: true, doubleId: id1, waiting: true,
      redCard: isRed, redCardLabel: isRed ? redLabel : undefined,
    });
    penTypeLabel = isRed ? `2+2 MIN (${redLabel})` : '2+2 MIN';

  } else if (raw === 'personal10') {
    // Persönliche 10-Min-Strafe (§6.9):
    // Begleitet von einer einfachen 2-Min-Zeitstrafe.
    // Die 2-Min → Unterzahl (normal, erlischt bei Überzahltor).
    // Die 10-Min → persönlich, KEIN Unterzahl (personal=true).
    const id2min  = now;
    const id10min = now + 1;
    S[side + 'Penalties'].push({
      id: id2min, number: num, secs: 120, remaining: 120,
      // normal 2-min companion — counts for team strength
    });
    S[side + 'Penalties'].push({
      id: id10min, number: num, secs: 600, remaining: 600,
      personal: true,  // personal = does NOT count for power play
    });
    penTypeLabel = '10 MIN (PERS.)';

  } else {
    // Einfache Zeitstrafe (2 Min)
    const secs = parseInt(raw);
    S[side + 'Penalties'].push({ id: now, number: num, secs, remaining: secs });
    penTypeLabel = '2 MIN';
  }

  document.getElementById('ct-' + side + '-pen-num').value = '';
  // Strafgrund aus Events-Feld lesen (nur wenn aktiviert)
  let penReason = '';
  if (S.showEventsTab) {
    const rv = document.getElementById('ct-' + side + '-pen-reason')?.value || '';
    if (rv) {
      const [code, name] = rv.split('|');
      penReason = (code && code !== '–') ? `${code} – ${name}` : name;
    }
    // Reset für nächste Strafe
    const reasonEl = document.getElementById('ct-' + side + '-pen-reason');
    if (reasonEl) reasonEl.value = '';
  }
  logEvent('penalty', side, { number: num, penType: penTypeLabel, penReason });
  pushAndRender();
}

function removePenalty(side, id) {
  pushUndo(`Strafe entfernt ${side === 'home' ? S.homeName : S.awayName}`, {
    type: 'penalty', side,
    prevPenalties: JSON.parse(JSON.stringify(S[side + 'Penalties'])),
  });
  const pens = S[side + 'Penalties'];
  const removed = pens.find(p => p.id === id);

  // If removing a doubleFirst, activate its waiting second part immediately
  if (removed && removed.doubleFirst) {
    S[side + 'Penalties'] = pens
      .filter(p => p.id !== id)
      .map(p => (p.doubleSecond && p.doubleId === removed.id)
        ? { ...p, waiting: false }
        : p);
  } else {
    S[side + 'Penalties'] = pens.filter(p => p.id !== id);
  }
  pushAndRender();
}

function tickPenalties() {
  ['home','away'].forEach(side => {
    const pens = S[side + 'Penalties'];
    // Find which double-first penalties just expired this tick
    const expiredDoubleFirstIds = new Set();

    const ticked = pens.map(p => {
      if (p.waiting) return p; // don't tick waiting second part
      return { ...p, remaining: p.remaining - 1 };
    });

    // Find expired double-first entries
    ticked.forEach(p => {
      if (p.doubleFirst && p.remaining <= 0) expiredDoubleFirstIds.add(p.doubleId);
    });

    // Activate waiting second parts whose first just expired
    const activated = ticked.map(p => {
      if (p.doubleSecond && expiredDoubleFirstIds.has(p.id)) {
        return { ...p, waiting: false };
      }
      return p;
    });

    S[side + 'Penalties'] = activated.filter(p => p.remaining > 0);
  });
}

// ── Timeout – runs independently from the game clock ──
let toTimer = null;
let pauseTimer = null;

function startTimeout(side) {
  if (S[side + 'ToUsed'] || S.activeTimeout) return;
  pushUndo(`Auszeit ${side === 'home' ? S.homeName : S.awayName}`, {
    type: 'timeout', side,
    prevToUsed: S[side + 'ToUsed'],
    prevActiveTimeout: S.activeTimeout,
  });
  S[side + 'ToUsed'] = true;
  const clockWasRunning = !!S.running;
  if (clockWasRunning) stopClock();                          // Spieluhr anhalten
  S.activeTimeout = { team: side, remaining: 30 };
  logEvent('timeout', side, { team: side });
  clearInterval(toTimer);
  toTimer = setInterval(() => {
    if (S.activeTimeout) {
      S.activeTimeout.remaining--;
      if (S.activeTimeout.remaining <= 0) {
        S.activeTimeout = null;
        clearInterval(toTimer); toTimer = null;
        if (S.timeoutBuzzerEnabled) playBuzzerShort();
      }
    } else {
      clearInterval(toTimer); toTimer = null;
    }
    pushAndRender();
  }, 1000);
  pushAndRender();
}

function endTimeout() {
  S.activeTimeout = null;
  clearInterval(toTimer); toTimer = null;
  S.pause = null;
  clearInterval(pauseTimer); pauseTimer = null;
  pushAndRender();
}

function startPause() {
  if (S.pause) return;
  const duration = S.pauseSecs || 600;
  S.pause = { remaining: duration, duration };
  clearInterval(pauseTimer);
  pauseTimer = setInterval(() => {
    if (S.pause) {
      S.pause.remaining--;
      if (S.pause.remaining <= 0) {
        S.pause = null;
        clearInterval(pauseTimer); pauseTimer = null;
        if (S.pauseBuzzerEnabled) playBuzzerShort();
        pushAndRender();
        onPauseEnd();
        return;
      }
    } else {
      clearInterval(pauseTimer); pauseTimer = null;
    }
    pushAndRender();
  }, 1000);
  pushAndRender();
}

function endPause() {
  S.pause = null;
  clearInterval(pauseTimer); pauseTimer = null;
  pushAndRender();
}

function resetTO(side) {
  S[side + 'ToUsed'] = false;
  pushAndRender();
}

// no longer called from clock tick but kept for safety
function tickTimeout() {}

// ── Reset ──
function resetGame() {
  ctConfirm({
    icon: '🔄',
    title: 'Spiel zurücksetzen?',
    body: 'Tore, Spielzeit, Strafen und Auszeiten werden auf Null zurückgesetzt. Teamnamen und Farben bleiben erhalten.',
    okLabel: 'Zurücksetzen',
    onOk: () => {
      stopClock();
      S.homeScore = 0; S.awayScore = 0;
      S.clock = S.periodSecs;
      S.period = 1;
      S.homePenalties = []; S.awayPenalties = [];
      S.homeToUsed = false; S.awayToUsed = false;
      S.activeTimeout = null;
      S.gameStarted = false;
      S.shootoutReady = false;
      S.otSecs = null;
      clearInterval(toTimer); toTimer = null;
      S.pause = null;
      clearInterval(pauseTimer); pauseTimer = null;
      document.getElementById('ct-set-min').value = 20;
      document.getElementById('ct-set-sec').value = 0;
      buildPeriodPills();
      pushAndRender();
    },
  });
}

function clearSavedState() {
  try { localStorage.removeItem(LS_KEY); } catch(e) {}
}

function endGame() {
  ctConfirm({
    icon: '⏹',
    title: 'Spiel beenden?',
    body: 'Der gespeicherte Spielstand wird gelöscht und der Setup-Dialog für ein neues Spiel geöffnet.',
    okLabel: 'Spiel beenden',
    onOk: () => {
      if (ctCountdownTimer) { clearInterval(ctCountdownTimer); ctCountdownTimer = null; }
      stopClock();
      clearInterval(toTimer);   toTimer   = null;
      clearInterval(pauseTimer); pauseTimer = null;

      // S vollständig auf Standardwerte zurücksetzen, damit saveState()
      // keinen alten Spielstand zurückschreibt wenn startBlankGame() aufgerufen wird
      S.homeName = 'HEIMTEAM'; S.awayName = 'GASTTEAM';
      S.homeLogo = null;        S.awayLogo = null;
      S.homeAccent = '#c8ff00'; S.awayAccent = '#22c55e';
      S.homeJersey = '#0d2e0d'; S.awayJersey = '#0a1a0a';
      S.homeScore = 0;          S.awayScore = 0;
      S.clock = 1200;           S.running = false;
      S.period = 1;             S.maxPeriods = 3;
      S.periodSecs = 1200;      S.pauseSecs = 600;
      S.homePenalties = [];     S.awayPenalties = [];
      S.homeToUsed = false;     S.awayToUsed = false;
      S.activeTimeout = null;   S.pause = null;
      S.gameStarted = false;    S.pendingGoal = null;
      S.events = [];            S.penaltyShootout = null;
      S.leagueName = null;      S.kickoffTime = null;
      S.shootoutReady = false;  S.otSecs = null;
      clockMs = 1200 * 1000;
      _undoStack = [];

      try { localStorage.removeItem(LS_KEY); } catch(e) {}
      initController(true);
      showStartScreen();
    },
  });
}

// ── PiP Preview ──
let pipOpen = false;

function pipScaleIframe() {
  const pip     = document.getElementById('ct-pip');
  const wrap    = document.getElementById('ct-pip-frame-wrap');
  const iframe  = document.getElementById('ct-pip-iframe');
  if (!pip || !wrap || !iframe) return;
  const w = pip.offsetWidth;
  const h = pip.offsetHeight - 22; // subtract titlebar
  const scale = Math.min(w / 1280, h / 720);
  iframe.style.transform = `scale(${scale})`;
}

function togglePip() {
  pipOpen = !pipOpen;
  const pip = document.getElementById('ct-pip');
  const btn = document.getElementById('ct-pip-btn');
  pip.style.display     = pipOpen ? 'block' : 'none';
  btn.style.background  = pipOpen ? 'rgba(200,255,0,.12)' : 'rgba(255,255,255,.04)';
  btn.style.borderColor = pipOpen ? 'rgba(200,255,0,.4)'  : 'rgba(255,255,255,.15)';
  btn.style.color       = pipOpen ? 'var(--lime)' : 'var(--muted2)';

  if (pipOpen) {
    const iframe = document.getElementById('ct-pip-iframe');
    pipScaleIframe();
    if (!iframe.getAttribute('data-loaded')) {
      iframe.src = location.pathname + '?view=scoreboard';
      iframe.onload = () => { push(); iframe.setAttribute('data-loaded','1'); iframe.onload = null; };
    } else {
      push();
    }
  }
}

// Drag (titlebar) + Resize (corner handle)
(function() {
  function initPipInteraction() {
    const pip      = document.getElementById('ct-pip');
    const titlebar = document.getElementById('ct-pip-titlebar');
    const resizeHd = document.getElementById('ct-pip-resize');
    if (!pip || !titlebar || !resizeHd) return;

    // Convert bottom/right to top/left so we can move freely
    function anchorToTopLeft() {
      const r = pip.getBoundingClientRect();
      pip.style.right  = 'auto';
      pip.style.bottom = 'auto';
      pip.style.left   = r.left + 'px';
      pip.style.top    = r.top  + 'px';
    }

    // ── DRAG ──
    titlebar.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      anchorToTopLeft();
      const startX = e.clientX - pip.offsetLeft;
      const startY = e.clientY - pip.offsetTop;
      titlebar.style.cursor = 'grabbing';
      function onMove(e) {
        pip.style.left = (e.clientX - startX) + 'px';
        pip.style.top  = (e.clientY - startY) + 'px';
      }
      function onUp() {
        titlebar.style.cursor = 'grab';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      e.preventDefault();
    });

    // ── RESIZE ──
    resizeHd.addEventListener('mousedown', e => {
      anchorToTopLeft();
      const startX = e.clientX, startY = e.clientY;
      const startW = pip.offsetWidth, startH = pip.offsetHeight;
      function onMove(e) {
        const newW = Math.max(280, startW + e.clientX - startX);
        const newH = Math.max(180, startH + e.clientY - startY);
        pip.style.width  = newW + 'px';
        pip.style.height = newH + 'px';
        pipScaleIframe();
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  }

  // Init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPipInteraction);
  } else {
    initPipInteraction();
  }
})();

// renderPip is now a no-op – the iframe handles itself via BroadcastChannel
function renderPip(s) {}


// ── Open Scoreboard ──
function openScoreboard() {
  const sb = window.open(location.pathname + '?view=scoreboard', 'floorball_sb',
    'width=1280,height=720,menubar=no,toolbar=no,location=no');
  // Push state once loaded
  setTimeout(() => push(), 800);
}

// ── Render controller UI ──
// ── Tab switching ──
function toggleCard(id) {
  document.getElementById(id).classList.toggle('collapsed');
}

function togglePenCard(side) {
  const card = document.getElementById('card-' + side + '-pen');
  const isCollapsed = card.classList.toggle('collapsed');
  const addBtn = document.getElementById('ct-' + side + '-pen-add-btn');
  // show + button only when open
  addBtn.style.display = isCollapsed ? 'none' : 'flex';
  // close form when collapsing
  if (isCollapsed) {
    const form = document.getElementById('ct-' + side + '-pen-form');
    form.classList.remove('open');
    addBtn.querySelector('span').textContent = '+';
  }
}

function togglePenAdd(side) {
  const form = document.getElementById('ct-' + side + '-pen-form');
  const btn  = document.getElementById('ct-' + side + '-pen-add-btn');
  const open = form.classList.toggle('open');
  btn.textContent = open ? '× Schließen' : '+ Strafe hinzufügen';
  if (open) {
    setTimeout(() => document.getElementById('ct-' + side + '-pen-num').focus(), 50);
    // Strafgrund-Row zeigen/verstecken und Optionen befüllen
    const reasonRow = document.getElementById('ct-' + side + '-pen-reason-row');
    if (reasonRow) {
      reasonRow.style.display = S.showEventsTab ? '' : 'none';
      if (S.showEventsTab) updatePenReason(side);
    }
  }
}

function addPenaltyAndClose(side) {
  addPenalty(side);
  const form = document.getElementById('ct-' + side + '-pen-form');
  const btn  = document.getElementById('ct-' + side + '-pen-add-btn');
  form.classList.remove('open');
  btn.textContent = '+ Strafe hinzufügen';
}

function switchTab(tab) {
  const allTabs = ['admin','teams','strafen','auszeiten','settings','danger','events'];
  const tabArea = document.getElementById('ct-tab-area');

  // Find currently active tab
  const currentActive = allTabs.find(t => {
    const btn = document.getElementById('tab-btn-' + t);
    return btn && btn.classList.contains('active');
  });

  // Toggle: clicking active tab closes it; unknown tab names do nothing
  const isKnownTab = allTabs.includes(tab);
  const opening = isKnownTab && currentActive !== tab;

  allTabs.forEach(t => {
    const btn  = document.getElementById('tab-btn-' + t);
    const pane = document.getElementById('tab-' + t);
    const isTarget = t === tab && opening;
    if (btn)  btn.classList.toggle('active', isTarget);
    if (pane) pane.classList.toggle('active', isTarget);
  });

  if (tabArea) tabArea.classList.toggle('tab-open', opening);
  if (opening && tab === 'events') renderEvents();
}

function renderController() {
  const s = S;
  const fmt = t => { const m=Math.floor(t/60),sc=t%60; return `${m}:${String(sc).padStart(2,'0')}`; };
  const fmtClock = t => {
    const disp = S.ctrlCountUp ? (S.periodSecs - t) : t;
    const d = Math.max(0, disp);
    return `${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`;
  };

  // Clock in control bar
  const clockStr = fmtClock(s.clock);
  const barClock = document.getElementById('ct-bar-clock');
  barClock.textContent = clockStr;
  barClock.className = 'ct-bar-clock ' + (s.running ? 'running' : 'stopped');

  // Toggle btn
  const tb = document.getElementById('ct-toggle-btn');
  tb.textContent = s.running ? '◼ STOPPEN' : '▶ STARTEN';
  tb.className = 'ct-bar-toggle ' + (s.running ? 'stop' : 'start');

  // Period chip
  const pnames3 = ['1. DRITTEL','2. DRITTEL','3. DRITTEL','VERLÄNGERUNG'];
  const pnames2 = ['1. HALBZEIT','2. HALBZEIT','VERLÄNGERUNG'];
  const pnames  = s.maxPeriods === 3 ? pnames3 : pnames2;
  document.getElementById('ct-period-chip').textContent = pnames[s.period-1] || 'ENDE';

  // Scores + team names in bar
  document.getElementById('ct-home-score').textContent = s.homeScore;
  document.getElementById('ct-away-score').textContent = s.awayScore;
  document.getElementById('ct-bar-home-name').textContent = s.homeName;
  document.getElementById('ct-bar-away-name').textContent = s.awayName;

  // Bar color accents
  document.getElementById('ct-home-score').style.color = s.homeAccent || 'var(--lime)';
  document.getElementById('ct-away-score').style.color = s.awayAccent || 'var(--cyan)';
  document.getElementById('ct-bar-home-name').style.color = s.homeAccent || 'var(--lime)';
  document.getElementById('ct-bar-away-name').style.color = s.awayAccent || 'var(--cyan)';

  // Penalty indicators in bar – show count + shortest remaining time
  const homePenEl = document.getElementById('ct-home-pen-count');
  const awayPenEl = document.getElementById('ct-away-pen-count');
  if (s.homePenalties.length) {
    const active = s.homePenalties.filter(p=>!p.waiting);
    const shortest = active.length ? Math.min(...active.map(p=>p.remaining)) : Math.min(...s.homePenalties.map(p=>p.remaining));
    const m=Math.floor(shortest/60), sc=shortest%60;
    homePenEl.textContent = `● STRAFE ${m}:${String(sc).padStart(2,'0')}`;
    homePenEl.style.display = 'block';
  } else {
    homePenEl.style.display = 'none';
  }
  if (s.awayPenalties.length) {
    const active = s.awayPenalties.filter(p=>!p.waiting);
    const shortest = active.length ? Math.min(...active.map(p=>p.remaining)) : Math.min(...s.awayPenalties.map(p=>p.remaining));
    const m=Math.floor(shortest/60), sc=shortest%60;
    awayPenEl.textContent = `STRAFE ${m}:${String(sc).padStart(2,'0')} ●`;
    awayPenEl.style.display = 'block';
  } else {
    awayPenEl.style.display = 'none';
  }

  // Timeout indicators in bar
  document.getElementById('ct-home-to-running').style.display =
    (s.activeTimeout && s.activeTimeout.team === 'home') ? 'block' : 'none';
  document.getElementById('ct-away-to-running').style.display =
    (s.activeTimeout && s.activeTimeout.team === 'away') ? 'block' : 'none';

  // Timeouts
  ['home','away'].forEach(side => {
    const used = s[side + 'ToUsed'];
    const badge = document.getElementById('ct-' + side + '-to-badge');
    const btn   = document.getElementById('ct-' + side + '-to-btn');
    badge.textContent = used ? '1× VERBRAUCHT' : '1× VERFÜGBAR';
    badge.className = 'timeout-badge ' + (used ? 'used' : 'avail');
    btn.disabled = used || !!s.activeTimeout;
    btn.style.opacity = (used || !!s.activeTimeout) ? '.4' : '1';
  });

  // Active timeout box (tab card - hide, now shown in control bar)
  const toCard = document.getElementById('ct-to-active-card');
  if (toCard) toCard.style.display = 'none';

  // Secondary clock in control bar (pause or timeout)
  const secClock = document.getElementById('ct-secondary-clock');
  const secLabel = document.getElementById('ct-secondary-label');
  const secTime  = document.getElementById('ct-secondary-time');
  if (secClock && secLabel && secTime) {
    if (s.activeTimeout) {
      secClock.style.display = 'flex';
      const toTeamName = s.activeTimeout.team === 'home' ? s.homeName : s.awayName;
      secLabel.textContent = `AUSZEIT · ${toTeamName}`;
      secLabel.style.color = 'var(--orange)';
      secTime.style.color  = 'var(--orange)';
      secTime.textContent  = fmt(s.activeTimeout.remaining);
    } else if (s.pause) {
      secClock.style.display = 'flex';
      secLabel.textContent = 'PAUSE';
      secLabel.style.color = 'var(--purple, #b44fff)';
      secTime.style.color  = 'var(--purple, #b44fff)';
      secTime.textContent  = fmt(s.pause.remaining);
    } else {
      secClock.style.display = 'none';
    }
  }

  // Dir toggle sync
  updateDirToggles();

  // Buzzer toggle sync
  const bt = document.getElementById('ct-buzzer-toggle');
  const bk = document.getElementById('ct-buzzer-knob');
  const bl = document.getElementById('ct-buzzer-label');
  if (bt) {
    bt.style.background = s.buzzerEnabled ? 'var(--lime)' : '';
    bk.style.left = s.buzzerEnabled ? '22px' : '2px';
    bl.textContent = s.buzzerEnabled ? 'AN' : 'AUS';
  }
  _updateBuzzerToggleUI('ct-pause-buzzer',   s.pauseBuzzerEnabled   !== false);
  _updateBuzzerToggleUI('ct-timeout-buzzer', s.timeoutBuzzerEnabled !== false);
  renderBuzzerSoundPicker();

  // Penalty lists + count badges in header
  renderPenList('home', s.homePenalties, fmt);
  renderPenList('away', s.awayPenalties, fmt);
  ['home','away'].forEach(side => {
    const badge = document.getElementById('ct-' + side + '-pen-count-badge');
    if (!badge) return;
    const count = s[side + 'Penalties'].length;
    if (count) {
      badge.textContent = count + ' AKTIV';
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  });

  // Penalty shootout controller state
  const psActive = s.penaltyShootout && s.penaltyShootout.active;
  if (psActive) renderPenaltyShootoutCtrl();

  // PS-Card nur sichtbar wenn PS aktiv
  const psCard = document.getElementById('ct-ps-card');
  if (psCard) psCard.style.display = psActive ? '' : 'none';

  // Flow-Knoten im Spielabschnitt-Card: Zustände live aktualisieren
  const inOT = s.period > s.maxPeriods;
  // Perioden-Knoten
  for (let i = 1; i <= s.maxPeriods; i++) {
    const el = document.getElementById('ct-flow-p-' + i);
    if (!el) continue;
    const past    = inOT || i < s.period;
    const current = !inOT && i === s.period;
    el.style.background  = current ? 'var(--lime)' : past ? 'rgba(255,255,255,.09)' : 'transparent';
    el.style.color       = current ? '#0a0a0a' : past ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.45)';
    el.style.borderColor = current ? 'var(--lime)' : 'rgba(255,255,255,.12)';
  }
  // Pause-Knoten
  for (let j = 1; j < s.maxPeriods; j++) {
    const el = document.getElementById('ct-flow-pause-' + j);
    if (!el) continue;
    const running = !!s.pause;
    el.disabled = running;
    el.style.background  = running ? 'rgba(180,79,255,.14)' : 'transparent';
    el.style.color       = running ? 'var(--purple,#b44fff)' : 'rgba(255,255,255,.4)';
    el.style.borderColor = running ? 'rgba(180,79,255,.35)' : 'rgba(255,255,255,.12)';
  }
  // VL-Knoten
  const vlNode = document.getElementById('ct-flow-vl');
  if (vlNode) {
    vlNode.disabled = inOT;
    vlNode.style.background  = inOT ? 'rgba(255,140,0,.14)' : 'transparent';
    vlNode.style.color       = inOT ? 'var(--orange)' : 'rgba(255,255,255,.4)';
    vlNode.style.borderColor = inOT ? 'rgba(255,140,0,.35)' : 'rgba(255,255,255,.12)';
  }
  // PS-Knoten
  const psNode = document.getElementById('ct-flow-ps');
  if (psNode) {
    psNode.disabled = psActive;
    psNode.style.background  = psActive ? 'rgba(255,140,0,.14)' : 'transparent';
    psNode.style.color       = psActive ? 'var(--orange)' : 'rgba(255,255,255,.4)';
    psNode.style.borderColor = psActive ? 'rgba(255,140,0,.35)' : 'rgba(255,255,255,.12)';
  }
  // Legende: konfigurierte Zeiten
  const flowLegend = document.getElementById('ct-flow-legend');
  if (flowLegend) {
    const pMin   = Math.round(s.periodSecs / 60);
    const pausMin = Math.round((s.pauseSecs || 600) / 60);
    const otMin  = Math.round((s.otSecs || _defaultOtSecs()) / 60);
    const pLabel = s.maxPeriods === 3 ? 'Drittel' : 'HZ';
    flowLegend.textContent = `${s.maxPeriods} × ${pMin} Min  ·  Pause ${pausMin} Min  ·  VL ${otMin} Min`;
  }

  // Smart auto-collapse in Spiel tab (only on first render, not on every tick)
  if (!renderController._collapseInitDone) {
    renderController._collapseInitDone = true;
    setCardCollapsed('ct-admin-setup-card', s.gameStarted);
    if (psActive) setCardCollapsed('ct-ps-card', false);
  }

  // Mobile-Ansicht (Logos, Perioden-Segmente, Uhr-Label) synchron halten
  if (typeof renderMobileBars === 'function') renderMobileBars(s);
}

function renderPenList(side, pens, fmt) {
  const c = document.getElementById('ct-' + side + '-pen-list');
  const typeLabel = (secs, p) => { if (p&&p.redCardLabel) return p.redCardLabel+' 2+2'; if (p&&p.doubleFirst) return '2+2 MIN (1)'; if (p&&p.doubleSecond) return '2+2 MIN (2)'; if (p&&p.waiting) return '2+2 MIN (2)'; if (p&&p.personal) return '10 MIN PERS.'; return secs<=120?'2 MIN':'10 MIN'; };

  if (!pens.length) {
    c.innerHTML = '<div class="empty-msg">Keine aktiven Strafen</div>';
    return;
  }

  // index existing rendered items by id
  const existing = {};
  c.querySelectorAll('.penalty-item[data-id]').forEach(el => {
    existing[el.dataset.id] = el;
  });
  const currentIds = new Set(pens.map(p => String(p.id)));

  // remove stale entries
  Object.keys(existing).forEach(id => { if (!currentIds.has(id)) existing[id].remove(); });

  // remove empty-msg if present
  const emptyEl = c.querySelector('.empty-msg');
  if (emptyEl) emptyEl.remove();

  // update or create
  pens.forEach(p => {
    const idStr = String(p.id);
    if (existing[idStr]) {
      // only update the time — no DOM rebuild, no animation re-trigger
      existing[idStr].querySelector('.pen-time').textContent = fmt(p.remaining);
    } else {
      const d = document.createElement('div');
      d.className = 'penalty-item';
      d.dataset.id = idStr;
      d.innerHTML = `
        <div class="pen-num">#${p.number}</div>
        <div class="pen-time">${fmt(p.remaining)}</div>
        <div class="pen-badge">${typeLabel(p.secs, p)}</div>
        <div class="pen-del" onclick="removePenalty('${side}',${p.id})">\u2715</div>
      `;
      c.appendChild(d);
    }
  });
}

function startPauseWithDialog() {
  if (S.pause) return;
  const pauseMin = Math.round((S.pauseSecs || 600) / 60);
  ctConfirm({
    icon: '⏸',
    title: 'Pause starten?',
    body: `${pauseMin}-minütige Pause starten?`,
    okLabel: '▶ Pause starten',
    okClass: 'btn-lime',
    onOk: () => { startPause(); _flowPauseCallback = false; },
  });
}

function startPenaltyShootoutWithDialog() {
  if (S.penaltyShootout && S.penaltyShootout.active) return;
  ctConfirm({
    icon: '🥊',
    title: 'Penaltyschießen starten?',
    body: 'Startet das Penaltyschießen im Presentation Mode. Je 5 Schüsse abwechselnd.',
    okLabel: '▶ Starten',
    okClass: 'btn-orange',
    onOk: () => startPenaltyShootout(),
  });
}

function pushAndRender() {
  push();
  saveState();
  renderController();
  renderPip(S);
}

// ── Styled confirm modal ──
function ctConfirm({ icon = '⚠', title, body = '', okLabel = 'Bestätigen', okClass = 'btn-danger', onOk, onCancel, input = null } = {}) {
  const modal     = document.getElementById('ct-confirm-modal');
  const iconEl    = document.getElementById('ct-confirm-icon');
  const titleEl   = document.getElementById('ct-confirm-title');
  const bodyEl    = document.getElementById('ct-confirm-body');
  const okBtn     = document.getElementById('ct-confirm-ok');
  const cancelBtn = document.getElementById('ct-confirm-cancel');
  const inputRow  = document.getElementById('ct-confirm-input-row');
  const inputEl   = document.getElementById('ct-confirm-input');
  const inputLbl  = document.getElementById('ct-confirm-input-label');
  const inputUnit = document.getElementById('ct-confirm-input-unit');

  iconEl.textContent  = icon;
  titleEl.textContent = title;
  bodyEl.textContent  = body;
  okBtn.textContent   = okLabel;
  okBtn.className     = `btn ${okClass}`;
  okBtn.style.flex    = '1';

  // Optional input field
  if (inputRow) {
    if (input) {
      if (inputLbl)  inputLbl.textContent  = input.label || '';
      if (inputUnit) inputUnit.textContent = input.unit  || 'Min';
      if (inputEl) {
        inputEl.value = input.value ?? 10;
        inputEl.min   = String(input.min ?? 1);
        inputEl.max   = String(input.max ?? 60);
      }
      inputRow.style.display = '';
      setTimeout(() => inputEl && inputEl.focus(), 80);
    } else {
      inputRow.style.display = 'none';
    }
  }

  modal.classList.add('open');

  const close = () => {
    modal.classList.remove('open');
    if (inputRow) inputRow.style.display = 'none';
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    modal.removeEventListener('click', handleBackdrop);
  };
  const handleOk      = () => { const val = (input && inputEl) ? inputEl.value : undefined; close(); onOk?.(val); };
  const handleCancel  = () => { close(); onCancel?.(); };
  const handleBackdrop = e => { if (e.target === modal) handleCancel(); };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  modal.addEventListener('click', handleBackdrop);
}

function ctAlert({ icon = '✓', title, body = '' } = {}) {
  const modal   = document.getElementById('ct-confirm-modal');
  const iconEl  = document.getElementById('ct-confirm-icon');
  const titleEl = document.getElementById('ct-confirm-title');
  const bodyEl  = document.getElementById('ct-confirm-body');
  const okBtn   = document.getElementById('ct-confirm-ok');
  const cancelBtn = document.getElementById('ct-confirm-cancel');

  iconEl.textContent  = icon;
  titleEl.textContent = title;
  bodyEl.textContent  = body;
  okBtn.textContent   = 'OK';
  okBtn.className     = 'btn btn-lime';
  okBtn.style.flex    = '1';
  cancelBtn.style.display = 'none';

  modal.classList.add('open');

  const close = () => {
    modal.classList.remove('open');
    cancelBtn.style.display = '';
    okBtn.removeEventListener('click', close);
    modal.removeEventListener('click', handleBackdrop);
  };
  const handleBackdrop = e => { if (e.target === modal) close(); };
  okBtn.addEventListener('click', close);
  modal.addEventListener('click', handleBackdrop);
}

