/* ── Floorball Scoreboard ──────────────────────────────────────────────
   State speichern/laden (localStorage) – benötigt: S, isScoreboard
────────────────────────────────────────────────────────────────────── */

/* ─── PERSISTENCE ─────────────────────────────────────────────────── */
const LS_KEY        = 'floorball_state_v2';
const LS_KEY_BACKUP = 'floorball_state_v2_backup'; // vorherige Version, falls der letzte Write korrupt war

function saveState() {
  if (isScoreboard) return;
  try {
    const snapshot = JSON.parse(JSON.stringify(S));
    snapshot._savedAt = Date.now();
    snapshot._clockMs = clockMs;
    const serialized = JSON.stringify(snapshot);

    // Rolling Backup: bisherigen Stand sichern, bevor er überschrieben wird
    const prev = localStorage.getItem(LS_KEY);
    if (prev) localStorage.setItem(LS_KEY_BACKUP, prev);
    localStorage.setItem(LS_KEY, serialized);

    // Zusätzliche Datei-Sicherung in Electron (kein localStorage-Quota, übersteht Browserdaten-Löschung)
    if (window.gameStateBackup) window.gameStateBackup.save(serialized).catch(() => {});
  } catch(e) { showPersistenceWarning(); }
}

// Sichtbarer Hinweis statt stillem Fehler (z.B. localStorage voll/deaktiviert) –
// gleiches Muster wie showBuzzerWarning() in js/buzzer.js.
let _persistenceToastTimer = null;
function showPersistenceWarning() {
  const el = document.getElementById('ct-persistence-toast');
  if (!el) return;
  el.textContent = '⚠ Spielstand konnte nicht gespeichert werden';
  el.classList.add('visible');
  clearTimeout(_persistenceToastTimer);
  _persistenceToastTimer = setTimeout(() => el.classList.remove('visible'), 4000);
}

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 Minuten

// Übernimmt einen geladenen Snapshot in S (Zeitkorrektur der Uhr, Migration,
// Score-Spiegelvariablen) – gemeinsame Logik für _tryLoadFrom() und die
// manuelle Wiederherstellung (restoreFromSnapshotString()).
function _applyLoadedSnapshot(saved) {
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
}

// Lädt & wendet den State aus einem bestimmten localStorage-Key an. Wirft bei
// kaputtem JSON, damit loadState() auf den Backup-Key ausweichen kann.
function _tryLoadFrom(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const saved = JSON.parse(raw);

    // Invalidate state older than 15 minutes
    if (saved._savedAt && (Date.now() - saved._savedAt) > STATE_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return false;
    }

    _applyLoadedSnapshot(saved);
    return true;
  } catch(e) { return false; }
}

function loadState() {
  return _tryLoadFrom(LS_KEY) || _tryLoadFrom(LS_KEY_BACKUP);
}

// Manuelle Wiederherstellung aus der Electron-Datei-Sicherung (Menü "Datei →
// Spielstand aus Sicherung wiederherstellen", siehe game-flow.js
// restoreStateFromBackupWithConfirm()). Ignoriert bewusst STATE_MAX_AGE_MS –
// der Bediener wählt die Sicherung aktiv aus, auch wenn sie älter als 15 Min. ist.
function restoreFromSnapshotString(serialized) {
  try {
    _applyLoadedSnapshot(JSON.parse(serialized));
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

