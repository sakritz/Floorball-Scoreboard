const { app, BrowserWindow, globalShortcut, screen, Menu } = require('electron');
const path = require('path');

// Menüleiste komplett entfernen
Menu.setApplicationMenu(null);

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

  controlWindow.loadFile(path.join(__dirname, '..', 'scoreboard.html'));

  // Entwicklerwerkzeuge nur im Dev-Modus öffnen
  if (process.env.NODE_ENV === 'development') {
    controlWindow.webContents.openDevTools();
  }

  controlWindow.on('closed', () => {
    controlWindow = null;
    // Wenn das Steuer-Panel geschlossen wird, Display-Fenster auch schließen
    if (displayWindow) displayWindow.close();
  });
}

// ── Hilfsfunktion: Display-Fenster (Scoreboard) erstellen ────────────────────
function createDisplayWindow() {
  const displays = screen.getAllDisplays();

  // Zweiten Monitor bevorzugen, sonst primären nehmen
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
    frame: false,           // Kein Fensterrahmen
    alwaysOnTop: true,      // Immer im Vordergrund
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  displayWindow.loadFile(path.join(__dirname, '..', 'scoreboard.html'));

  displayWindow.on('closed', () => {
    displayWindow = null;
  });
}

// ── App-Start ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createControlWindow();

  // Globale Tastenkürzel registrieren
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
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
});

// ── Tastenkürzel freigeben beim Beenden ───────────────────────────────────────
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
