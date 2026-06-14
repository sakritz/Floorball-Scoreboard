const { app, BrowserWindow, globalShortcut, screen, Menu, dialog } = require('electron');
const path = require('path');
const APP_ROOT = path.resolve(__dirname, '..');
const express = require('express');

// Menüleiste komplett entfernen
Menu.setApplicationMenu(null);

// ── Lokaler HTTP-Server für OBS ───────────────────────────────────────────────
const PORT = 8080;
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
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Über den lokalen Server laden – damit fetch('/api/state') funktioniert
  controlWindow.loadURL(`http://localhost:${PORT}/scoreboard.html`);

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
    icon: path.join(__dirname, 'assets/icon.png'),
    frame: false,
    alwaysOnTop: true,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  displayWindow.loadURL(`http://localhost:${PORT}/scoreboard.html?view=scoreboard`);

  displayWindow.on('closed', () => {
    displayWindow = null;
  });
}

// ── App-Start ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startLocalServer();

  // Kurz warten bis der Server bereit ist, dann Fenster öffnen
  setTimeout(() => {
    createControlWindow();
  }, 200);

  // F11 → Steuer-Panel Fullscreen umschalten
  globalShortcut.register('F11', () => {
    if (controlWindow) {
      controlWindow.setFullScreen(!controlWindow.isFullScreen());
    }
  });

  // F12 → Display-Fenster auf zweitem Monitor öffnen/schließen
  globalShortcut.register('F12', () => {
    if (displayWindow) {
      displayWindow.close();
    } else {
      createDisplayWindow();
    }
  });

  // Escape → Fullscreen beenden
  globalShortcut.register('Escape', () => {
    if (controlWindow && controlWindow.isFullScreen()) {
      controlWindow.setFullScreen(false);
    }
  });
});

// ── App beenden wenn alle Fenster geschlossen (außer macOS) ──────────────────
app.on('window-all-closed', () => {
  stopLocalServer();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
});

// ── Tastenkürzel freigeben beim Beenden ───────────────────────────────────────
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
