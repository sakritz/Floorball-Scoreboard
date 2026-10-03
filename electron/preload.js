// Copyright (c) 2026 sakritz — MIT License
//
// Preload-Script für das Steuer-Fenster. Stellt unter window.gamePresets eine
// kleine API bereit, über die der Renderer Spieltag-Vorlagen (Teamnamen, Logos,
// Format etc.) speichern/löschen/laden kann. contextIsolation bleibt aktiv –
// kein direkter Zugriff auf Node/Electron-APIs aus dem Renderer.

const { contextBridge, ipcRenderer } = require('electron');

// Zusätzliche Datei-Sicherung des laufenden Spielstands (neben localStorage),
// da dessen Browser-Quota bei langen Spielen mit großen Logo-Dateien eng werden kann.
// Wird nur mitgeschrieben, nicht automatisch beim Start gelesen (siehe js/persistence.js).
contextBridge.exposeInMainWorld('gameStateBackup', {
  save: (serialized) => ipcRenderer.invoke('state:saveBackup', serialized),
  onRestore: (callback) => ipcRenderer.on('state:restoreBackup', (_event, serialized) => callback(serialized)),
});

contextBridge.exposeInMainWorld('gamePresets', {
  save: (name, config) => ipcRenderer.invoke('presets:save', { name, config }),
  list: () => ipcRenderer.invoke('presets:list'),
  delete: (id) => ipcRenderer.invoke('presets:delete', id),
  onLoad: (callback) => ipcRenderer.on('presets:load', (_event, config) => callback(config)),
});

// Musiksteuerung (Proof of Concept): Ordner-/Datei-Auswahl läuft über native
// Dialoge im Main-Prozess, die eigentliche Audio-Wiedergabe läuft im Renderer
// über den lokalen HTTP-Server (siehe electron/main.js), nicht über IPC.
contextBridge.exposeInMainWorld('musicControl', {
  getConfig: () => ipcRenderer.invoke('music:getConfig'),
  pickPlaylistFolder: () => ipcRenderer.invoke('music:pickPlaylistFolder'),
  clearPlaylistFolder: () => ipcRenderer.invoke('music:clearPlaylistFolder'),
  setPlaylistSource: (source) => ipcRenderer.invoke('music:setPlaylistSource', source),
  setPlaylistSpotifyUri: (uri) => ipcRenderer.invoke('music:setPlaylistSpotifyUri', uri),
  pickAnthem: (side) => ipcRenderer.invoke('music:pickAnthem', side),
  clearAnthem: (side) => ipcRenderer.invoke('music:clearAnthem', side),
  setAnthemRange: (side, start, end) => ipcRenderer.invoke('music:setAnthemRange', side, start, end),
});

// Spotify-Fernsteuerung (EXPERIMENTELLER Proof of Concept, separater Branch):
// steuert einen bereits laufenden Spotify-Client fern (Spotify Connect),
// kein eingebettetes Audio. Tokens verlassen den Main-Prozess nie – der
// Renderer bekommt nur { connected: bool }.
contextBridge.exposeInMainWorld('spotifyControl', {
  getConfig: () => ipcRenderer.invoke('spotify:getConfig'),
  setClientId: (id) => ipcRenderer.invoke('spotify:setClientId', id),
  connect: () => ipcRenderer.invoke('spotify:connect'),
  disconnect: () => ipcRenderer.invoke('spotify:disconnect'),
  getStatus: () => ipcRenderer.invoke('spotify:getStatus'),
  play: (uri) => ipcRenderer.invoke('spotify:play', uri),
  pause: () => ipcRenderer.invoke('spotify:pause'),
  onStatusChange: (cb) => ipcRenderer.on('spotify:status', (_event, s) => cb(s)),
});
