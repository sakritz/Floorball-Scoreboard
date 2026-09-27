/* ── Floorball Scoreboard ──────────────────────────────────────────────
   Spotify-Fernsteuerung (EXPERIMENTELLER Proof of Concept, separater Branch).
   Steuert einen bereits laufenden Spotify-Client fern (Spotify Connect),
   kein eingebettetes Audio. Komplett eigenständig, keine Vermischung mit
   js/music.js. Nur im Controller-Fenster der Electron-App aktiv –
   window.spotifyControl kommt aus electron/preload.js.
   Benötigt: isScoreboard.
────────────────────────────────────────────────────────────────────── */
// Copyright (c) 2026 sakritz — MIT License

const SPOTIFY_ERROR_TEXT = {
  NOT_CONNECTED: 'Nicht mit Spotify verbunden.',
  NO_ACTIVE_DEVICE: 'Kein aktives Spotify-Gerät gefunden. Bitte Spotify auf einem Gerät öffnen und kurz etwas abspielen.',
  PREMIUM_REQUIRED: 'Spotify Premium ist für die Wiedergabesteuerung erforderlich.',
  NO_CLIENT_ID: 'Bitte zuerst eine Client-ID eintragen und speichern.',
  NO_URI: 'Bitte eine Spotify-URI eingeben.',
  UNKNOWN: 'Unbekannter Fehler bei der Spotify-Anfrage.',
};

function spotifyAvailable() {
  return !isScoreboard && !!window.spotifyControl;
}

function initSpotify() {
  const card = document.getElementById('ct-spotify-card');
  if (!card) return;
  if (!spotifyAvailable()) { card.style.display = 'none'; return; }
  card.style.display = '';

  window.spotifyControl.getConfig().then(renderSpotifyConfig);
  window.spotifyControl.onStatusChange(renderSpotifyConfig);
}

function renderSpotifyConfig(cfg) {
  const idEl = document.getElementById('ct-spotify-client-id');
  if (idEl && document.activeElement !== idEl) idEl.value = cfg.clientId || '';

  const statusEl = document.getElementById('ct-spotify-status');
  if (statusEl) {
    statusEl.textContent = cfg.connected ? 'Verbunden' : 'Nicht verbunden';
    statusEl.style.color = cfg.connected ? 'var(--lime-t)' : 'var(--ct-muted-t)';
  }
  _setSpotifyError(null);
}

function saveSpotifyClientId() {
  if (!spotifyAvailable()) return;
  const idEl = document.getElementById('ct-spotify-client-id');
  window.spotifyControl.setClientId(idEl ? idEl.value : '').then(renderSpotifyConfig);
}

function connectSpotify() {
  if (!spotifyAvailable()) return;
  window.spotifyControl.connect().then(res => {
    if (!res.ok) _setSpotifyError(res.error);
  });
}

function disconnectSpotify() {
  if (!spotifyAvailable()) return;
  window.spotifyControl.disconnect().then(renderSpotifyConfig);
}

function playSpotifyUri() {
  if (!spotifyAvailable()) return;
  const uriEl = document.getElementById('ct-spotify-uri');
  const uri = uriEl ? uriEl.value.trim() : '';
  if (!uri) { _setSpotifyError('NO_URI'); return; }
  window.spotifyControl.play(uri).then(res => {
    _setSpotifyError(res.ok ? null : res.error);
  });
}

function pauseSpotify() {
  if (!spotifyAvailable()) return;
  window.spotifyControl.pause().then(res => {
    _setSpotifyError(res.ok ? null : res.error);
  });
}

function _setSpotifyError(code) {
  const el = document.getElementById('ct-spotify-error');
  if (!el) return;
  if (!code) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = SPOTIFY_ERROR_TEXT[code] || SPOTIFY_ERROR_TEXT.UNKNOWN;
  el.style.display = '';
}
