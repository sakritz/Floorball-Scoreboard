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
