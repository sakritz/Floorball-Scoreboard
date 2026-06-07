/* ── Floorball Scoreboard ──────────────────────────────────────────────
   State speichern/laden (localStorage) – benötigt: S, isScoreboard
────────────────────────────────────────────────────────────────────── */

/* ─── PERSISTENCE ─────────────────────────────────────────────────── */
const LS_KEY = 'floorball_state_v2';

function saveState() {
  if (isScoreboard) return;
  try {
    const snapshot = JSON.parse(JSON.stringify(S));
    snapshot._savedAt = Date.now();
    snapshot._clockMs = clockMs;
    localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
  } catch(e) {}
}

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 Minuten

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);

    // Invalidate state older than 15 minutes
    if (saved._savedAt && (Date.now() - saved._savedAt) > STATE_MAX_AGE_MS) {
      localStorage.removeItem(LS_KEY);
      return false;
    }

    // Compensate for time elapsed while tab was closed
    if (saved.running && saved._savedAt && saved._clockMs != null) {
      const elapsed = Date.now() - saved._savedAt;
      saved._clockMs = Math.max(0, saved._clockMs - elapsed);
      saved.clock    = Math.ceil(saved._clockMs / 1000);
      // If clock ran out while away, stop it
      if (saved._clockMs <= 0) saved.running = false;
    }

    const restoredClockMs = saved._clockMs;
    delete saved._savedAt;
    delete saved._clockMs;

    Object.assign(S, saved);

    // Migration: ensure countdown direction (false = down) is the default
    // Only override if the key was never explicitly saved (undefined in old saves)
    if (saved.ctrlCountUp === undefined) S.ctrlCountUp = false;
    if (saved.sbCountUp   === undefined) S.sbCountUp   = false;
    clockMs = restoredClockMs != null ? restoredClockMs : S.clock * 1000;
    prevHomeScore = S.homeScore;
    prevAwayScore = S.awayScore;
    return true;
  } catch(e) { return false; }
}

// ── Beforeunload warning (only controller, only once game has started) ──
if (!isScoreboard) {
  window.addEventListener('beforeunload', e => {
    if (S.gameStarted) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Block F5 / Ctrl+R / Cmd+R in controller window
  document.addEventListener('keydown', e => {
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
      if (S.gameStarted) {
        e.preventDefault();
      }
    }
  }, true);
}

