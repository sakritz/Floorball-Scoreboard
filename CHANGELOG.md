# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert. Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Hinzugefügt
- `docs/ROADMAP.md`: Ideensammlung für Wartungsthemen und neue Features

### Geändert
- `README.md`, `docs/ARCHITECTURE.md`, `docs/anleitung.md` an aktuellen Funktionsstand angepasst (Musiksteuerung, Spielbericht, Mobile-Ansicht, Spieltag-Vorlagen, Regelwerk 2026)

## [2.1.0] - 2026-09-27

### Hinzugefügt
- Regelwerk 2026 (SPRGK): Terminologie, Strafcode-Tabelle, Aktivierungsreihenfolge wartender Strafen (§603.7), gepaarte Strafen (§603.9), technisches Tor (§701.3)
- Spieltag-Vorlagen: Spiel-Konfigurationen speichern & über Electron-Menü laden
- Musiksteuerung (Proof of Concept): Playlist + Tor-Hymnen, eigener Tab
- Spotify-Fernsteuerung (Proof of Concept): umschaltbare Playlist-Quelle
- Bestätigungsdialoge für destruktive Aktionen
- Tastatur-Bedienung: Schalter und Tabs fokussierbar (Enter), `role`/`aria`-Attribute, sichtbarer Fokusring
- Electron-Anwendungsmenü, Shortcuts nicht mehr global (nur bei fokussierter App)

### Geändert
- Hell-Modus: Textkontraste auf WCAG AA angehoben
- Einstellungen: Schriftgröße für Tabs/Tab-Leiste, Segment-Buttons themefähig, Karten neu angeordnet
- Größere Schrift auf Scoreboard/Controller

### Behoben
- Eigentor hebt Strafe des gegnerischen Teams in Überzahl auf (SPRGK 6.3.6)

### Sonstiges
- Saisonmanager-Import im Setup-Dialog temporär deaktiviert (siehe [ROADMAP](docs/ROADMAP.md))
- `CLAUDE.md` als Projekt-Kontextdokument hinzugefügt

## [2.0.0] – Aufteilung in Module

Umbau von der Single-File-Version (`legacy/`) auf die aktuelle Modulstruktur (`js/`, `css/`): Electron-Desktop-App, OBS-Overlay via lokalem Server, patch-basiertes Undo-System, Hell-/Dunkel-Modus, mobile Controller-Ansicht, Spielbericht-Export, Setup-Dialog mit Saisonmanager-Import, Penaltyschießen-Logik, erweiterte Buzzer-Optionen.

## [1.0.0] – Erste Version

Single-File-Version (siehe `legacy/`), nicht mehr gepflegt.
