/* ── Floorball Scoreboard ──────────────────────────────────────────────
   Musiksteuerung (Proof of Concept): 3 manuelle Buttons (Tor Heim, Tor Gast,
   Playlist) starten/stoppen lokale Audiodateien. Kein automatisches Triggern
   durch Spielereignisse. Benötigt: S, switchTab, _updateBuzzerToggleUI.
   Nur im Controller-Fenster der Electron-App aktiv – window.musicControl
   kommt aus electron/preload.js und existiert daher nicht in der reinen
   Web-/GitHub-Pages-Variante.
────────────────────────────────────────────────────────────────────── */
// Copyright (c) 2026 sakritz — MIT License

let _musicTracks = [];      // [{file, url}] – aktueller Playlist-Ordner
let _musicQueue = [];       // gemischte Reihenfolge der URLs
let _musicQueuePtr = 0;
let _playlistAudio = null;  // Audio-Objekt, solange die Playlist läuft
let _anthemAudio = { home: null, away: null };
let _musicConfig = {};      // letzter bekannter Stand aus window.musicControl.getConfig()

function musicAvailable() {
  return !isScoreboard && !!window.musicControl;
}

// "Musiksteuerung aktivieren" ist eine App-Einstellung, kein Spielstand – sie
// soll daher auch den State-Timeout (STATE_MAX_AGE_MS, führt zum Startscreen)
// überleben. Eigener localStorage-Key statt nur S.musicControlEnabled, analog
// zu ct-events-tab-on in render.js.
(function() {
  try {
    if (localStorage.getItem('ct-music-tab-on') === '1') S.musicControlEnabled = true;
  } catch (e) {}
})();

function initMusic() {
  const card = document.getElementById('ct-music-card');
  if (!card) return;
  if (!musicAvailable()) { card.style.display = 'none'; return; }
  card.style.display = '';
  syncMusicToggleUI();
  if (S.musicControlEnabled) refreshMusicConfig();
}

// Günstiger Sync-Aufruf, wird bei jedem renderController() mitgerufen
// (analog zu updateDirToggles()/_updateBuzzerToggleUI() für den Buzzer).
function syncMusicToggleUI() {
  if (!musicAvailable()) return;
  _updateBuzzerToggleUI('ct-music-enabled', S.musicControlEnabled);
  const tabBtn = document.getElementById('tab-btn-musik');
  if (tabBtn) tabBtn.style.display = S.musicControlEnabled ? '' : 'none';
  const mehrRow = document.getElementById('mehr-row-musik'); // mobile "Mehr"-Sheet
  if (mehrRow) mehrRow.style.display = S.musicControlEnabled ? '' : 'none';
  ['home', 'away', 'playlist'].forEach(id => {
    const btn = document.getElementById('ct-music-tb-' + id);
    if (btn) btn.style.display = S.musicControlEnabled ? 'inline-flex' : 'none';
  });
}

function toggleMusicControl() {
  S.musicControlEnabled = !S.musicControlEnabled;
  try { localStorage.setItem('ct-music-tab-on', S.musicControlEnabled ? '1' : '0'); } catch (e) {}
  syncMusicToggleUI();
  if (S.musicControlEnabled) {
    refreshMusicConfig();
  } else {
    stopPlaylist(); stopAnthem('home'); stopAnthem('away');
    // Falls der Musik-Tab gerade offen ist, schließen – der Button ist jetzt weg
    const tabBtn = document.getElementById('tab-btn-musik');
    if (tabBtn && tabBtn.classList.contains('active')) switchTab('musik');
  }
}

function refreshMusicConfig() {
  if (!musicAvailable()) return;
  window.musicControl.getConfig().then(config => {
    renderMusicFolderInfo(config);
    refreshMusicTracks();
  });
}

function renderMusicFolderInfo(config) {
  _musicConfig = config || {};

  const folderName = config.playlistFolder ? config.playlistFolder.split(/[\\/]/).pop() : 'Kein Ordner gewählt';
  const folderEl = document.getElementById('ct-music-playlist-name');
  if (folderEl) folderEl.textContent = folderName;
  const clearFolderBtn = document.getElementById('ct-music-playlist-clear');
  if (clearFolderBtn) clearFolderBtn.style.display = config.playlistFolder ? '' : 'none';

  ['home', 'away'].forEach(side => {
    const anthemPath = config[side + 'Anthem'];
    const nameEl = document.getElementById('ct-music-anthem-' + side + '-name');
    if (nameEl) nameEl.textContent = anthemPath ? anthemPath.split(/[\\/]/).pop() : 'Keine Datei gewählt';
    const clearBtn = document.getElementById('ct-music-anthem-' + side + '-clear');
    if (clearBtn) clearBtn.style.display = anthemPath ? '' : 'none';

    const startEl = document.getElementById('ct-music-anthem-' + side + '-start');
    const endEl = document.getElementById('ct-music-anthem-' + side + '-end');
    if (startEl) startEl.value = config[side + 'AnthemStart'] != null ? config[side + 'AnthemStart'] : '';
    if (endEl) endEl.value = config[side + 'AnthemEnd'] != null ? config[side + 'AnthemEnd'] : '';
    const rangeRow = document.getElementById('ct-music-anthem-' + side + '-range');
    if (rangeRow) rangeRow.style.display = anthemPath ? 'flex' : 'none';
  });
}

// Ausschnitt (Start-/End-Sekunde) übernehmen – leeres Feld = kein Trim an der Stelle
function setAnthemRange(side) {
  if (!musicAvailable()) return;
  const startEl = document.getElementById('ct-music-anthem-' + side + '-start');
  const endEl = document.getElementById('ct-music-anthem-' + side + '-end');
  const start = startEl && startEl.value !== '' ? parseFloat(startEl.value) : null;
  const end = endEl && endEl.value !== '' ? parseFloat(endEl.value) : null;
  window.musicControl.setAnthemRange(side, start, end).then(config => { _musicConfig = config; });
}

function refreshMusicTracks() {
  fetch('/api/music/tracks')
    .then(res => res.json())
    .then(tracks => { _musicTracks = tracks; _musicQueue = []; _updateMusicTrackCount(); })
    .catch(() => { _musicTracks = []; _musicQueue = []; _updateMusicTrackCount(); });
}

function _updateMusicTrackCount() {
  const countEl = document.getElementById('ct-music-track-count');
  if (!countEl) return;
  countEl.textContent = _musicTracks.length
    ? _musicTracks.length + ' Track(s) gefunden'
    : 'Keine Audiodateien im Ordner gefunden';
}

function pickPlaylistFolder() {
  if (!musicAvailable()) return;
  window.musicControl.pickPlaylistFolder().then(config => {
    renderMusicFolderInfo(config);
    refreshMusicTracks();
  });
}

function clearPlaylistFolder() {
  if (!musicAvailable()) return;
  stopPlaylist();
  window.musicControl.clearPlaylistFolder().then(config => {
    renderMusicFolderInfo(config);
    refreshMusicTracks();
  });
}

function pickAnthem(side) {
  if (!musicAvailable()) return;
  window.musicControl.pickAnthem(side).then(renderMusicFolderInfo);
}

function clearAnthem(side) {
  if (!musicAvailable()) return;
  stopAnthem(side);
  window.musicControl.clearAnthem(side).then(renderMusicFolderInfo);
}

/* ─── WIEDERGABE (manuell über die Toolbar-Buttons) ──────────────────── */

function _setMusicButtonActive(id, active) {
  const btn = document.getElementById(id);
  if (btn) btn.classList.toggle('active', active);
}

function toggleAnthem(side) {
  if (_anthemAudio[side]) stopAnthem(side);
  else startAnthem(side);
}

function startAnthem(side) {
  const start = _musicConfig[side + 'AnthemStart'];
  const end = _musicConfig[side + 'AnthemEnd'];
  const audio = new Audio('/api/music/anthem/' + side + '/file');
  audio.addEventListener('loadedmetadata', () => {
    if (start != null) audio.currentTime = start;
    audio.play().catch(() => stopAnthem(side));
  });
  if (end != null) {
    audio.addEventListener('timeupdate', () => {
      if (audio.currentTime >= end) stopAnthem(side);
    });
  }
  audio.addEventListener('ended', () => stopAnthem(side));
  _anthemAudio[side] = audio;
  _setMusicButtonActive('ct-music-tb-' + side, true);
}

function stopAnthem(side) {
  const audio = _anthemAudio[side];
  if (audio) { audio.pause(); audio.currentTime = 0; }
  _anthemAudio[side] = null;
  _setMusicButtonActive('ct-music-tb-' + side, false);
}

function togglePlaylist() {
  if (_playlistAudio) stopPlaylist();
  else startPlaylist();
}

function startPlaylist() {
  if (!_musicTracks.length) return;
  if (!_musicQueue.length) _buildMusicQueue();
  _playlistAudio = new Audio();
  _playlistAudio.addEventListener('ended', _playNextTrack);
  _setMusicButtonActive('ct-music-tb-playlist', true);
  _playNextTrack();
}

function stopPlaylist() {
  if (_playlistAudio) {
    _playlistAudio.removeEventListener('ended', _playNextTrack);
    _playlistAudio.pause();
  }
  _playlistAudio = null;
  _setMusicButtonActive('ct-music-tb-playlist', false);
}

function _buildMusicQueue() {
  _musicQueue = _musicTracks.map(t => t.url);
  for (let i = _musicQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_musicQueue[i], _musicQueue[j]] = [_musicQueue[j], _musicQueue[i]];
  }
  _musicQueuePtr = 0;
}

function _playNextTrack() {
  if (!_playlistAudio) return;
  if (_musicQueuePtr >= _musicQueue.length) _buildMusicQueue();
  if (!_musicQueue.length) { stopPlaylist(); return; }
  _playlistAudio.src = _musicQueue[_musicQueuePtr++];
  _playlistAudio.play().catch(() => stopPlaylist());
}
