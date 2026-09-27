// Copyright (c) 2026 sakritz — MIT License
//
// Spotify-Fernsteuerung (EXPERIMENTELLER Proof of Concept, separater Branch).
// Steuert einen bereits laufenden Spotify-Client (Desktop/Handy/Lautsprecher)
// über Spotifys Web-API (Spotify Connect: /me/player/play, /pause) fern – kein
// eingebettetes Audio/Streaming in dieser App. Erfordert zwingend Spotify
// Premium (Spotifys eigene Einschränkung der Player-Endpunkte) und eine eigene,
// selbst registrierte Spotify-Developer-App pro Instanz (Client-ID), da eine
// gemeinsame Client-ID im Development Mode auf 25 Konten limitiert wäre.
//
// OAuth: Authorization Code mit PKCE (kein Client Secret nötig, liefert im
// Unterschied zu Implicit Grant ein Refresh Token – wichtig bei Spielen, die
// länger als die 1h-Gültigkeit eines Access Tokens dauern). Redirect-URI ist
// eine neue Route auf dem bereits laufenden lokalen Express-Server (kein neuer
// Port) – muss exakt im Spotify-Dashboard eingetragen werden.

const crypto = require('crypto');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SCOPES = 'user-modify-playback-state user-read-playback-state';

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function generateVerifier() {
  return base64url(crypto.randomBytes(32)); // 43 Zeichen, erfüllt RFC 7636 (43–128)
}
function challengeFromVerifier(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function registerSpotify({ app, ipcMain, expressApp, shell, getControlWindow, port }) {
  const path = require('path');
  const fs = require('fs');

  const SPOTIFY_CONFIG_FILE = path.join(app.getPath('userData'), 'spotify-config.json');
  const REDIRECT_URI = `http://127.0.0.1:${port}/spotify/callback`;

  function loadSpotifyConfig() {
    try {
      return JSON.parse(fs.readFileSync(SPOTIFY_CONFIG_FILE, 'utf8'));
    } catch (e) {
      return { clientId: null, accessToken: null, refreshToken: null, expiresAt: 0, lastPlayedUri: null };
    }
  }
  function saveSpotifyConfig(config) {
    fs.writeFileSync(SPOTIFY_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  }

  // Laufender Login-Versuch (Single-Use, kein Multi-Flow-Support nötig fürs PoC)
  let pendingAuth = null; // { state, codeVerifier, createdAt }

  // Vor jedem API-Call: Access Token bei Bedarf per Refresh Token erneuern.
  // Gibt null zurück, wenn (noch) keine Verbindung besteht.
  async function ensureAccessToken() {
    const cfg = loadSpotifyConfig();
    if (!cfg.refreshToken) return null;
    if (cfg.expiresAt > Date.now() + 30000) return cfg.accessToken;

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cfg.refreshToken,
        client_id: cfg.clientId,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    cfg.accessToken = data.access_token;
    if (data.refresh_token) cfg.refreshToken = data.refresh_token; // Spotify rotiert teils
    cfg.expiresAt = Date.now() + data.expires_in * 1000;
    saveSpotifyConfig(cfg);
    return cfg.accessToken;
  }

  // PUT/GET an die Spotify-Player-API mit einheitlichem Fehler-Mapping, statt
  // dass jeder Aufrufer HTTP-Status-Codes selbst interpretieren muss.
  async function playerRequest(method, path_, body) {
    const token = await ensureAccessToken();
    if (!token) return { ok: false, error: 'NOT_CONNECTED' };

    const res = await fetch(SPOTIFY_API_BASE + path_, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204 || res.ok) return { ok: true };
    if (res.status === 404) return { ok: false, error: 'NO_ACTIVE_DEVICE' };
    if (res.status === 403) return { ok: false, error: 'PREMIUM_REQUIRED' };
    if (res.status === 401) return { ok: false, error: 'NOT_CONNECTED' };
    return { ok: false, error: 'UNKNOWN', status: res.status };
  }

  // ── Express-Route: OAuth-Callback (Redirect-URI) ──────────────────────────
  expressApp.get('/spotify/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      res.status(400).send('<h2>Spotify-Verbindung abgelehnt.</h2><p>Dieses Fenster kann geschlossen werden.</p>');
      return;
    }
    if (!pendingAuth || Date.now() - pendingAuth.createdAt > 5 * 60 * 1000) {
      res.status(400).send('<h2>Anmeldung abgelaufen.</h2><p>Bitte in der App erneut auf „Mit Spotify verbinden" klicken.</p>');
      return;
    }
    if (state !== pendingAuth.state) {
      res.status(400).send('<h2>Ungültige Anfrage (state mismatch).</h2>');
      return;
    }

    const { codeVerifier } = pendingAuth;
    pendingAuth = null; // Single-Use

    try {
      const cfg = loadSpotifyConfig();
      const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: cfg.clientId,
          code_verifier: codeVerifier,
        }),
      });
      if (!tokenRes.ok) throw new Error('token exchange failed');
      const data = await tokenRes.json();

      cfg.accessToken = data.access_token;
      cfg.refreshToken = data.refresh_token;
      cfg.expiresAt = Date.now() + data.expires_in * 1000;
      saveSpotifyConfig(cfg);

      const win = getControlWindow();
      if (win) win.webContents.send('spotify:status', { connected: true });

      res.send('<h2>Mit Spotify verbunden.</h2><p>Dieses Fenster kann geschlossen werden.</p>');
    } catch (e) {
      res.status(500).send('<h2>Verbindung fehlgeschlagen.</h2><p>Bitte erneut versuchen.</p>');
    }
  });

  // ── IPC-Handler ────────────────────────────────────────────────────────────
  ipcMain.handle('spotify:getConfig', () => {
    const cfg = loadSpotifyConfig();
    return { clientId: cfg.clientId, connected: !!cfg.refreshToken };
  });

  ipcMain.handle('spotify:setClientId', (event, clientId) => {
    const cfg = loadSpotifyConfig();
    cfg.clientId = (clientId || '').trim() || null;
    saveSpotifyConfig(cfg);
    return { clientId: cfg.clientId, connected: !!cfg.refreshToken };
  });

  ipcMain.handle('spotify:connect', () => {
    const cfg = loadSpotifyConfig();
    if (!cfg.clientId) return { ok: false, error: 'NO_CLIENT_ID' };

    const codeVerifier = generateVerifier();
    const state = crypto.randomBytes(16).toString('hex');
    pendingAuth = { state, codeVerifier, createdAt: Date.now() };

    const url = new URL(SPOTIFY_AUTHORIZE_URL);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challengeFromVerifier(codeVerifier));

    shell.openExternal(url.toString());
    return { ok: true };
  });

  ipcMain.handle('spotify:disconnect', () => {
    const cfg = loadSpotifyConfig();
    cfg.accessToken = null;
    cfg.refreshToken = null;
    cfg.expiresAt = 0;
    saveSpotifyConfig(cfg);
    return { clientId: cfg.clientId, connected: false };
  });

  ipcMain.handle('spotify:getStatus', () => {
    const cfg = loadSpotifyConfig();
    return { connected: !!cfg.refreshToken };
  });

  ipcMain.handle('spotify:play', async (event, uri) => {
    if (!uri) return { ok: false, error: 'NO_URI' };
    const cfg = loadSpotifyConfig();

    // Gleiche URI wie beim letzten erfolgreichen Start → an der pausierten
    // Stelle fortsetzen (leerer Body = Resume), statt den Kontext neu zu
    // starten. Nur bei einer NEUEN URI wird wieder von vorne begonnen.
    let body;
    if (uri !== cfg.lastPlayedUri) {
      const type = uri.split(':')[1]; // spotify:track:... / spotify:playlist:... / spotify:album:...
      body = type === 'track' ? { uris: [uri] } : { context_uri: uri };
    }

    const result = await playerRequest('PUT', '/me/player/play', body);
    if (result.ok && uri !== cfg.lastPlayedUri) {
      cfg.lastPlayedUri = uri;
      saveSpotifyConfig(cfg);
    }
    return result;
  });

  ipcMain.handle('spotify:pause', () => playerRequest('PUT', '/me/player/pause'));
}

module.exports = { registerSpotify };
