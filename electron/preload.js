// Copyright (c) 2026 sakritz — MIT License
//
// Preload-Script für das Steuer-Fenster. Stellt unter window.gamePresets eine
// kleine API bereit, über die der Renderer Spieltag-Vorlagen (Teamnamen, Logos,
// Format etc.) speichern/löschen/laden kann. contextIsolation bleibt aktiv –
// kein direkter Zugriff auf Node/Electron-APIs aus dem Renderer.

const { contextBridge, ipcRenderer } = require('electron');

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
  pickAnthem: (side) => ipcRenderer.invoke('music:pickAnthem', side),
  clearAnthem: (side) => ipcRenderer.invoke('music:clearAnthem', side),
  setAnthemRange: (side, start, end) => ipcRenderer.invoke('music:setAnthemRange', side, start, end),
});
