/* ── Floorball Scoreboard ─────────────────────────────────────────────
   Undo-Stack (patch-basiert) + Clock-Hilfsvariablen
   Benötigt: S, isScoreboard (aus state.js)
──────────────────────────────────────────────────────────────────── */

/* ─── UNDO STACK (patch-based, selektiv) ──────────────────────────
   Jeder Eintrag speichert nur die exakt betroffenen Felder (Patch),
   nicht den gesamten State. Dadurch kann jede Aktion unabhängig
   rückgängig gemacht werden, ohne spätere Aktionen zu berühren.
──────────────────────────────────────────────────────────────────── */
const UNDO_MAX = 20;
let _undoStack = []; // [{ label, patch }]
let _undoing   = false;

function pushUndo(label, patch) {
  if (_undoing || isScoreboard) return;
  _undoStack.push({ label, patch });
  if (_undoStack.length > UNDO_MAX) _undoStack.shift();
  renderUndoStack();
}

// Wendet den inversen Patch auf den aktuellen State an
function applyUndoPatch(patch) {
  switch (patch.type) {
    case 'goal':
      if (patch.side === 'home') S.homeScore = patch.prevScore;
      else                       S.awayScore = patch.prevScore;
      S.pendingGoal = patch.prevPendingGoal;
      if (patch.eventId !== undefined) S.events = S.events.filter(e => e.id !== patch.eventId);
      break;
    case 'penalty':
      S[patch.side + 'Penalties'] = JSON.parse(JSON.stringify(patch.prevPenalties));
      break;
    case 'timeout':
      S[patch.side + 'ToUsed'] = patch.prevToUsed;
      S.activeTimeout = patch.prevActiveTimeout;
      if (toTimer) { clearInterval(toTimer); toTimer = null; }
      break;
    case 'period':
      S.period = patch.prevPeriod;
      S.clock  = patch.prevClock;
      clockMs  = patch.prevClockMs;
      buildPeriodPills();
      break;
    case 'clock':
      S.clock = patch.prevClock;
      clockMs = patch.prevClockMs;
      break;
  }
}

// Macht genau einen Eintrag rückgängig — unabhängig von seiner Position im Stack
function undoTo(index) {
  if (index < 0 || index >= _undoStack.length || isScoreboard) return;
  const { label } = _undoStack[index];
  ctConfirm({
    icon: '↩',
    title: 'Rückgängig machen?',
    body: `„${label}" wird rückgängig gemacht. Alle anderen Aktionen bleiben erhalten.`,
    okLabel: 'Rückgängig',
    okClass: 'btn-orange',
    onOk: () => _executeUndo(index),
  });
}

function _executeUndo(index) {
  if (index < 0 || index >= _undoStack.length) return;
  const { label, patch } = _undoStack[index];
  _undoing = true;

  // Uhr stoppen während Undo — Benutzer prüft den Stand vor Neustart
  if (S.running) { clearInterval(clockTimer); clockTimer = null; clockStartedAt = null; S.running = false; }

  applyUndoPatch(patch);

  // Nur diesen einen Eintrag aus dem Stack entfernen
  _undoStack.splice(index, 1);
  _undoing = false;

  applyControllerColors();
  renderUndoStack();
  pushAndRender();
  showUndoToast(label);
}

function undo() {
  if (!_undoStack.length || isScoreboard) return;
  undoTo(_undoStack.length - 1);
}

function renderUndoStack() {
  const list = document.getElementById('ct-undo-stack-list');
  if (!list) return;
  const n = _undoStack.length;
  if (!n) {
    list.innerHTML = '<div style="color:var(--ct-muted);font-size:12px;text-align:center;padding:12px 0;letter-spacing:1px">Keine Aktionen im Stack</div>';
    return;
  }
  list.innerHTML = '';
  // Neueste zuerst: display-Index d → Stack-Index (n-1-d)
  for (let d = 0; d < n; d++) {
    const i = n - 1 - d;
    const entry = _undoStack[i];

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:9px;padding:7px 10px;cursor:pointer;' +
      'background:rgba(255,255,255,.03);border:1px solid var(--ct-border);transition:background .12s,border-color .12s;';
    row.onmouseenter = () => { row.style.background = 'rgba(255,140,0,.08)'; row.style.borderColor = 'rgba(255,140,0,.4)'; };
    row.onmouseleave = () => { row.style.background = 'rgba(255,255,255,.03)'; row.style.borderColor = 'var(--ct-border)'; };
    row.onclick = () => undoTo(i);

    const icon = document.createElement('span');
    icon.textContent = '↩';
    icon.style.cssText = 'font-size:13px;color:var(--ct-muted);flex-shrink:0';

    const lbl = document.createElement('span');
    lbl.textContent = entry.label;
    lbl.style.cssText = 'font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;' +
      'color:var(--ct-text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
      'font-family:Barlow Condensed,sans-serif';

    row.appendChild(icon);
    row.appendChild(lbl);

    if (d === 0) {
      const badge = document.createElement('span');
      badge.textContent = 'LETZTER';
      badge.style.cssText = 'font-size:9px;font-weight:700;letter-spacing:2px;color:var(--orange);' +
        'border:1px solid rgba(255,140,0,.35);padding:2px 6px;flex-shrink:0;font-family:Barlow Condensed,sans-serif';
      row.appendChild(badge);
    }

    list.appendChild(row);
  }
}

let _undoToastTimer = null;
function showUndoToast(label) {
  const el = document.getElementById('ct-undo-toast');
  if (!el) return;
  el.textContent = `↩ Rückgängig: ${label}`;
  el.classList.add('visible');
  clearTimeout(_undoToastTimer);
  _undoToastTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

let clockTimer = null;
// Wall-clock tracking: S.clock stores whole seconds (display),
// clockMs stores the precise remaining time in milliseconds.
// On stop we capture the exact remainder; on start we use it.
let clockMs = null;          // null = not yet initialised from S.clock
let clockStartedAt = null;   // Date.now() when clock last started
let prevHomeScore = 0, prevAwayScore = 0;

