// Copyright (c) 2026 sakritz — MIT License

const { app, BrowserWindow, screen, Menu, dialog, clipboard, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const APP_ROOT = path.resolve(__dirname, '..');
const express = require('express');
const { registerSpotify } = require('./spotify');

// ── Lokaler HTTP-Server für OBS ───────────────────────────────────────────────
const PORT = 8080;
const ICON = path.join(__dirname, '..', 'img', 'icon.png');
const GITHUB_URL = 'https://github.com/sakritz/Floorball-Scoreboard';
let server = null;

function startLocalServer() {
  const expressApp = express();

  // JSON-Body parsen (für /api/state POST)
  expressApp.use(express.json({ limit: '2mb' }));

  // ── State-Speicher für OBS-Overlay ────────────────────────────────────────
  let currentState = null;

  // Controller schickt bei jedem push() den aktuellen State hierhin
  expressApp.post('/api/state', (req, res) => {
    currentState = req.body;
    res.json({ ok: true });
  });

  // stream.html pollt diesen Endpoint
  expressApp.get('/api/state', (req, res) => {
    res.json(currentState || {});
  });

  // ── Musiksteuerung: Audio-Auslieferung (Ordner-/Dateiauswahl läuft über IPC,
  // siehe ipcMain.handle('music:...') oben; hier nur das Ausliefern der Bytes) ──
  expressApp.get('/api/music/tracks', (req, res) => {
    const { playlistFolder } = loadMusicConfig();
    if (!playlistFolder) return res.json([]);
    try {
      const files = fs.readdirSync(playlistFolder, { withFileTypes: true })
        .filter(f => f.isFile() && MUSIC_EXTENSIONS.includes(path.extname(f.name).toLowerCase()))
        .map(f => ({ file: f.name, url: '/music/' + encodeURIComponent(f.name) }));
      res.json(files);
    } catch (e) {
      res.json([]);
    }
  });

  expressApp.use('/music', (req, res, next) => {
    const { playlistFolder } = loadMusicConfig();
    if (!playlistFolder) return res.status(404).end();
    express.static(playlistFolder)(req, res, next);
  });

  ['home', 'away'].forEach(side => {
    expressApp.get(`/api/music/anthem/${side}/file`, (req, res) => {
      const anthemPath = loadMusicConfig()[side + 'Anthem'];
      if (!anthemPath) return res.status(404).end();
      res.sendFile(anthemPath, err => { if (err && !res.headersSent) res.status(404).end(); });
    });
  });

  // ── Spotify-Fernsteuerung (EXPERIMENTELLER Proof of Concept) ──────────────
  registerSpotify({ app, ipcMain, expressApp, shell, getControlWindow: () => controlWindow, port: PORT });

  // scoreboard.html, stream.html und alle Dateien aus dem Projekt-Root ausliefern
  expressApp.use(express.static(APP_ROOT));


  server = expressApp.listen(PORT, '127.0.0.1', () => {
    console.log(`Lokaler Server läuft auf http://localhost:${PORT}`);
    console.log(`OBS Overlay:  http://localhost:${PORT}/stream.html`);
  });

  server.on('error', (err) => {
    console.error(`Server-Fehler: ${err.message}`);
  });
}

function stopLocalServer() {
  if (server) {
    server.closeAllConnections(); // offene Verbindungen sofort kappen
    server.close(() => console.log('Server gestoppt.'));
    server = null;
  }
}

// ── Spieltag-Vorlagen (gespeicherte Spiel-Konfigurationen) ───────────────────
// Eine Datei im Electron-Nutzerverzeichnis statt localStorage: Logos werden
// unkomprimiert als Data-URL gespeichert, mehrere Vorlagen könnten das
// localStorage-Quota sprengen. Array von { id, name, savedAt, config }.
const PRESETS_FILE = path.join(app.getPath('userData'), 'game-presets.json');

function loadPresets() {
  try {
    return JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function savePresets(presets) {
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf8');
}

ipcMain.handle('presets:save', (event, { name, config }) => {
  const presets = loadPresets();
  presets.push({ id: Date.now(), name, savedAt: Date.now(), config });
  savePresets(presets);
  buildMenu();
  return presets.map(({ id, name, savedAt }) => ({ id, name, savedAt }));
});

ipcMain.handle('presets:list', () => {
  return loadPresets().map(({ id, name, savedAt }) => ({ id, name, savedAt }));
});

ipcMain.handle('presets:delete', (event, id) => {
  const presets = loadPresets().filter(p => p.id !== id);
  savePresets(presets);
  buildMenu();
  return presets.map(({ id, name, savedAt }) => ({ id, name, savedAt }));
});

// ── Musiksteuerung (Proof of Concept) ─────────────────────────────────────────
// Ordner-/Dateipfade liegen im Main-Prozess (nicht localStorage), da native
// Dialoge nur hier verfügbar sind. Die eigentliche Wiedergabe läuft über den
// lokalen HTTP-Server weiter unten, da das Controller-Fenster über
// http://localhost lädt und file://-Audioquellen dort blockiert würden.
const MUSIC_CONFIG_FILE = path.join(app.getPath('userData'), 'music-config.json');
const MUSIC_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];

function loadMusicConfig() {
  try {
    return JSON.parse(fs.readFileSync(MUSIC_CONFIG_FILE, 'utf8'));
  } catch (e) {
    return {
      playlistFolder: null,
      playlistSource: 'local', // 'local' | 'spotify'
      playlistSpotifyUri: null,
      homeAnthem: null, homeAnthemStart: null, homeAnthemEnd: null,
      awayAnthem: null, awayAnthemStart: null, awayAnthemEnd: null,
    };
  }
}

function saveMusicConfig(config) {
  fs.writeFileSync(MUSIC_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

ipcMain.handle('music:getConfig', () => loadMusicConfig());

ipcMain.handle('music:pickPlaylistFolder', async () => {
  const { filePaths } = await dialog.showOpenDialog(controlWindow, { properties: ['openDirectory'] });
  if (filePaths[0]) {
    const config = loadMusicConfig();
    config.playlistFolder = filePaths[0];
    saveMusicConfig(config);
  }
  return loadMusicConfig();
});

ipcMain.handle('music:clearPlaylistFolder', () => {
  const config = loadMusicConfig();
  config.playlistFolder = null;
  saveMusicConfig(config);
  return config;
});

ipcMain.handle('music:setPlaylistSource', (event, source) => {
  const config = loadMusicConfig();
  config.playlistSource = (source === 'spotify') ? 'spotify' : 'local';
  saveMusicConfig(config);
  return config;
});

ipcMain.handle('music:setPlaylistSpotifyUri', (event, uri) => {
  const config = loadMusicConfig();
  config.playlistSpotifyUri = (uri || '').trim() || null;
  saveMusicConfig(config);
  return config;
});

ipcMain.handle('music:pickAnthem', async (event, side) => {
  if (side !== 'home' && side !== 'away') return loadMusicConfig();
  const { filePaths } = await dialog.showOpenDialog(controlWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: MUSIC_EXTENSIONS.map(e => e.slice(1)) }],
  });
  if (filePaths[0]) {
    const config = loadMusicConfig();
    config[side + 'Anthem'] = filePaths[0];
    // Neue Datei → alter Ausschnitt (Sekundenwerte) passt nicht mehr
    config[side + 'AnthemStart'] = null;
    config[side + 'AnthemEnd'] = null;
    saveMusicConfig(config);
  }
  return loadMusicConfig();
});

ipcMain.handle('music:clearAnthem', (event, side) => {
  if (side !== 'home' && side !== 'away') return loadMusicConfig();
  const config = loadMusicConfig();
  config[side + 'Anthem'] = null;
  config[side + 'AnthemStart'] = null;
  config[side + 'AnthemEnd'] = null;
  saveMusicConfig(config);
  return config;
});

ipcMain.handle('music:setAnthemRange', (event, side, start, end) => {
  if (side !== 'home' && side !== 'away') return loadMusicConfig();
  const config = loadMusicConfig();
  config[side + 'AnthemStart'] = (typeof start === 'number' && start >= 0) ? start : null;
  config[side + 'AnthemEnd']   = (typeof end === 'number' && end > 0) ? end : null;
  saveMusicConfig(config);
  return config;
});

// ── Fenster-Referenzen ────────────────────────────────────────────────────────
let controlWindow = null;   // Steuer-Panel (auf dem Laptop)
let displayWindow = null;   // Scoreboard-Anzeige (auf dem zweiten Monitor / TV)

// ── Hilfsfunktion: Steuer-Panel erstellen ────────────────────────────────────
function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Floorball Scoreboard – Steuerung',
    icon: ICON,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Über den lokalen Server laden – damit fetch('/api/state') funktioniert
  controlWindow.loadURL(`http://localhost:${PORT}/scoreboard.html`);

  // Esc beendet den Vollbildmodus (nur wenn das Fenster Fokus hat)
  controlWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && controlWindow.isFullScreen()) {
      controlWindow.setFullScreen(false);
    }
  });

  // Entwicklerwerkzeuge nur im Dev-Modus öffnen
  if (process.env.NODE_ENV === 'development') {
    controlWindow.webContents.openDevTools();
  }

  controlWindow.on('close', async (e) => {
    e.preventDefault();
    const { response } = await dialog.showMessageBox(controlWindow, {
      type: 'question',
      buttons: ['Beenden', 'Abbrechen'],
      defaultId: 1,
      title: 'Floorball Scoreboard',
      message: 'Spiel läuft noch. Wirklich beenden?',
    });
    if (response === 0) {
      if (displayWindow) displayWindow.destroy();
      controlWindow.destroy();
    }
  });

  controlWindow.on('closed', () => {
    controlWindow = null;
    app.quit();
  });
}

// ── Hilfsfunktion: Display-Fenster (Scoreboard) erstellen ────────────────────
function createDisplayWindow() {
  const displays = screen.getAllDisplays();

  const targetDisplay = displays.length > 1
    ? displays.find(d => d.id !== screen.getPrimaryDisplay().id)
    : screen.getPrimaryDisplay();

  displayWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    title: 'Floorball Scoreboard – Anzeige',
    icon: ICON,
    frame: false,
    alwaysOnTop: true,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  displayWindow.removeMenu();
  displayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') toggleDisplayWindow();
  });

  displayWindow.loadURL(`http://localhost:${PORT}/scoreboard.html?view=scoreboard`);

  displayWindow.on('closed', () => {
    displayWindow = null;
  });
}

// Anzeige-Fenster öffnen bzw. schließen (Menü und F12)
function toggleDisplayWindow() {
  if (displayWindow) displayWindow.close();
  else createDisplayWindow();
}

// ── Hilfsfunktion: Vorlagen-Verwalten-Fenster erstellen ──────────────────────
let presetsManagerWindow = null;
function openPresetsManagerWindow() {
  if (presetsManagerWindow) { presetsManagerWindow.focus(); return; }
  presetsManagerWindow = new BrowserWindow({
    width: 480,
    height: 560,
    minWidth: 360,
    minHeight: 360,
    title: 'Vorlagen verwalten',
    icon: ICON,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), // gleiche window.gamePresets-API wie im Setup-Dialog
    },
  });
  presetsManagerWindow.setMenuBarVisibility(false);
  presetsManagerWindow.loadURL(`http://localhost:${PORT}/presets-manager.html`);
  presetsManagerWindow.on('closed', () => { presetsManagerWindow = null; });
}

// ── Anwendungsmenü ────────────────────────────────────────────────────────────
function buildMenu() {
  const presets = loadPresets();
  const loadPresetSubmenu = [
    ...(presets.length
      ? presets.map(p => ({
          label: p.name,
          click: () => {
            if (controlWindow) controlWindow.webContents.send('presets:load', p.config);
          },
        }))
      : [{ label: 'Keine Vorlagen gespeichert', enabled: false }]),
    { type: 'separator' },
    { label: 'Vorlagen verwalten…', click: openPresetsManagerWindow },
  ];

  const template = [
    {
      label: 'Datei',
      submenu: [
        { label: 'Anzeige öffnen/schließen', accelerator: 'F12', click: toggleDisplayWindow },
        { type: 'separator' },
        { label: 'Vorlage laden', submenu: loadPresetSubmenu },
        { type: 'separator' },
        { label: 'Beenden', accelerator: 'CmdOrCtrl+Q', click: () => { if (controlWindow) controlWindow.close(); } },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Vollbild', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Vergrößern', role: 'zoomIn' },
        { label: 'Verkleinern', role: 'zoomOut' },
        { label: 'Zoom zurücksetzen', role: 'resetZoom' },
        ...(process.env.NODE_ENV === 'development'
          ? [{ type: 'separator' }, { label: 'Entwicklerwerkzeuge', role: 'toggleDevTools' }]
          : []),
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'OBS-Overlay-Adresse kopieren',
          click: () => {
            clipboard.writeText(`http://localhost:${PORT}/stream.html`);
            dialog.showMessageBox(controlWindow, {
              type: 'info',
              buttons: ['OK'],
              title: 'Floorball Scoreboard',
              message: 'Adresse kopiert',
              detail: `http://localhost:${PORT}/stream.html\n\nAls Browserquelle in OBS einfügen.`,
            });
          },
        },
        { label: 'Projekt auf GitHub', click: () => shell.openExternal(GITHUB_URL) },
        { type: 'separator' },
        {
          label: 'Über Floorball Scoreboard',
          click: () => dialog.showMessageBox(controlWindow, {
            type: 'info',
            buttons: ['OK'],
            title: 'Über Floorball Scoreboard',
            message: `Floorball Scoreboard ${app.getVersion()}`,
            detail: 'Open Source (MIT-Lizenz)\n© 2026 sakritz\n' + GITHUB_URL,
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App-Start ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startLocalServer();
  buildMenu();

  // Kurz warten bis der Server bereit ist, dann Fenster öffnen
  setTimeout(() => {
    createControlWindow();
  }, 200);
});

// ── App beenden wenn alle Fenster geschlossen (außer macOS) ──────────────────
app.on('window-all-closed', () => {
  stopLocalServer();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
});
