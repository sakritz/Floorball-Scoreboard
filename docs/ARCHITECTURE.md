# Architektur – Floorball Scoreboard

## Überblick

Das Floorball Scoreboard ist eine browserbasierte Anwendung, die ohne Build-Schritt oder Installation auskommt. Die Kernfunktionalität steckt in einer einzigen HTML-Datei (`scoreboard.html`) mit ausgelagerten CSS- und JS-Dateien. Optional kann die App als Electron-Desktop-Anwendung betrieben werden, die zusätzliche Features wie ein zweites Monitorfenster und einen lokalen HTTP-Server für OBS-Overlays freischaltet.

---

## Betriebsmodi

### Modus 1 – Browser / GitHub Pages (ohne Installation)

```
scoreboard.html?view=           → Controller-Ansicht (Steuer-Panel)
scoreboard.html?view=scoreboard → Scoreboard-Anzeige (TV/Monitor)
```

Der Nutzer öffnet `scoreboard.html` lokal per Doppelklick oder über einen Webserver. Controller und Scoreboard kommunizieren über die **BroadcastChannel API** des Browsers – beide Fenster müssen dazu im selben Browser und auf demselben Ursprung laufen.

### Modus 2 – Electron App (mit Installation)

```
electron/
  └── main.js startet beim Launch:
        ├── Fenster 1: Controller-Ansicht (Hauptmonitor)
        ├── Anwendungsmenü (Datei / Ansicht / Hilfe, buildMenu())
        └── Express-Server auf http://localhost:8080
              ├── Serviert scoreboard.html + alle Dateien statisch
              ├── POST /api/state         ← Controller schickt State-Updates
              ├── GET  /api/state         ← stream.html (OBS) pollt State
              └── GET  /api/music/tracks  ← Musiksteuerung: Playlist-Ordner auflisten

Fenster 2 (Scoreboard-Anzeige, zweiter Monitor) wird NICHT automatisch geöffnet,
sondern per F12 / Menü "Datei → Anzeige öffnen/schließen" umgeschaltet
(toggleDisplayWindow()).
```

OBS bindet das Overlay als Browser-Quelle ein: `http://localhost:8080/stream.html`

**Spieltag-Vorlagen** (Spielkonfigurationen speichern/laden) laufen über IPC: `electron/preload.js` exponiert `window.gamePresets` (list/save/delete) im Renderer; das Menü "Datei → Vorlage laden" listet gespeicherte Vorlagen, "Vorlagen verwalten…" öffnet `presets-manager.html` in einem eigenen Fenster (`openPresetsManagerWindow()`).

**Spotify-Fernsteuerung** (Proof of Concept) läuft über `electron/spotify.js` — ein lokaler, einmalig zu autorisierender OAuth-Flow (bewusst Single-Use, kein Multi-Flow-Support fürs PoC), im Renderer über `window.spotifyControl` (`preload.js`) angebunden. Genutzt von `js/music.js` als alternative Wiedergabequelle zur lokalen Playlist.

---

## Dateistruktur

```
scoreboard.html          Markup-Gerüst; kein inline CSS, kein inline JS
stream.html              OBS-Overlay (Score-Leiste für Streams)
presets-manager.html     Fenster zum Verwalten gespeicherter Spieltag-Vorlagen (Electron)

css/
  base.css               CSS Custom Properties, Reset (Fundament für alle anderen)
  scoreboard.css         TV-/Monitor-Ansicht (Topbar, Teams, Uhr, Ticker)
  controller.css         Steuer-Panel (Tabs, Karten, Buttons, Formulare)
  ui.css                 Shared UI (Setup-Dialog, Startscreen, Countdown)
  mobile.css             Mobile Controller-Ansicht (Bottom-Nav, gestapelte Layouts)

js/
  state.js               Globale Grundvariablen: S (State-Objekt), isScoreboard, BC
  undo.js                Undo-Stack (patch-basiert) + Clock-Hilfsvariablen
  persistence.js         localStorage: saveState / loadState
  controller.js          initController, push, Spieluhr, Score-Anpassung, Powerplay-Check
  palette.js             Neon-Farbpalette, setPeriod, buildPeriodPills
  game-flow.js           renderController, pushAndRender, Strafen, Perioden, Auszeiten, PENALTY_CODES
  logo.js                Farbextraktion aus Team-Logos (Canvas, standalone)
  buzzer.js              Buzzer-Sounds (Web Audio API)
  music.js               Musiksteuerung (Proof of Concept): Playlist-Ordner + Tor-Hymnen, nur Electron
  render.js              initScoreboard, renderScoreboard, Penalty-Shootout
  report.js              Spielbericht (Timeline, Export als PDF/Markdown/JSON)
  ui.js                  Help-Modal, Startscreen, Countdown, Setup-Dialog, Theme
  mobile.js              Mobile Navigation (Bottom-Nav, „Mehr"-Menü)

electron/
  main.js                Electron-Hauptprozess (Fenster, Express-Server, Menü, Shortcuts)
  preload.js             IPC-Bridge (u.a. window.gamePresets, window.spotifyControl)
  spotify.js             Spotify-Fernsteuerung (Proof of Concept, lokaler OAuth-Flow)
  assets/
    icon.png             App-Icon

package.json             Repo-Root: Dependencies (electron, express), electron-builder-Config
docs/                     ARCHITECTURE.md (dieses Dokument), Anleitung, ROADMAP.md
documents/                Regelwerke (SPRGK 2022/2026, Synopse), Spielberichtsbogen
legacy/                   Alte Single-File-Version (nicht mehr gepflegt)
```

---

## Datenfluß

### Controller → Scoreboard (BroadcastChannel)

```
Nutzer klickt (z.B. Tor) 
  → controller.js / game-flow.js ändert S
  → pushAndRender()
      ├── push()         → BroadcastChannel.postMessage(S) → Scoreboard-Fenster
      ├── saveState()    → localStorage
      └── renderController() + renderPip()
```

Das Scoreboard-Fenster horcht dauerhaft auf dem Channel:
```
BC.onmessage → S = event.data → renderScoreboard()
```

Beim Öffnen fragt das Scoreboard-Fenster aktiv nach dem aktuellen State:
```
BC.postMessage({ type: 'REQ_STATE' }) → Controller antwortet mit push()
```

### Controller → OBS-Overlay (HTTP Polling, nur Electron)

```
push() → fetch POST /api/state  (JSON des gesamten State-Objekts)

stream.html: setInterval(200ms) → fetch GET /api/state → Score-Leiste aktualisieren
```

BroadcastChannel funktioniert nicht zwischen Electron-Chromium und OBS-Chromium (separate Prozesse), daher HTTP-Polling als Brücke über den lokalen Express-Server.

### Musiksteuerung (nur Electron)

`GET /api/music/tracks` listet die Dateien im gewählten Playlist-Ordner auf; Audiodateien werden zusätzlich über `express.static(playlistFolder)` direkt ausgeliefert. `js/music.js` bedient darüber eine manuelle Playlist- und Tor-Hymnen-Steuerung; alternativ kann über `window.spotifyControl` (`preload.js` → `electron/spotify.js`) eine Spotify-Playlist als Wiedergabequelle angesteuert werden (Proof of Concept, Single-Use-OAuth-Flow).

---

## State-Objekt (`S`)

Definiert in `state.js`. Zentrales Datenobjekt — **alle** anderen Module lesen und schreiben ausschließlich über `S`. Direkte DOM-Manipulation außerhalb von `render.js` und `controller.js` ist auf ein Minimum beschränkt.

Wichtige Felder (Auszug):

| Feld | Bedeutung |
|---|---|
| `homeName` / `awayName` | Teamnamen |
| `homeScore` / `awayScore` | Aktueller Spielstand |
| `homeLogo` / `awayLogo` | Logo als Base64 |
| `homeAccent` / `awayAccent` | Teamfarben (Accent) |
| `clock` | Verbleibende Sekunden der Spielzeit |
| `running` | Uhr läuft / angehalten |
| `period` / `maxPeriods` | Aktuelles / maximales Drittel |
| `periodSecs` | Dauer eines Drittels in Sekunden |
| `penalties` | Array aktiver Strafen (home/away) |
| `events` | Spielereignislog (Tore, Strafen, Auszeiten) |
| `penaltyShootout` | Penaltyschießen-State (Schüsse, Runden) |
| `gameStarted` | Ob das Spiel bereits begonnen hat |
| `kickoffTime` | Geplanter Anpfiff (für Countdown) |

---

## Undo-System

Patch-basiert — jede Aktion speichert nur die **betroffenen Felder** des State, nicht den gesamten Snapshot. `applyUndoPatch()` stellt exakt diese Felder wieder her. Tor-Events werden über eine vorab generierte Event-ID (`eventId`) referenziert statt über einen Array-Snapshot, damit spätere Events beim Undo eines früheren Tors nicht verloren gehen.

---

## Electron-Details

`electron/main.js` verwaltet:

- **`createControlWindow()`** — Hauptfenster auf dem primären Monitor, lädt `http://localhost:8080/scoreboard.html`
- **`createDisplayWindow()` / `toggleDisplayWindow()`** — Rahmenloses Vollbild-Fenster auf dem zweiten Monitor (falls vorhanden), lädt `http://localhost:8080/scoreboard.html` (BroadcastChannel synchronisiert automatisch); wird nicht automatisch beim Start geöffnet, sondern per `F12`/Menü umgeschaltet
- **`startLocalServer()`** — Express-Server auf `127.0.0.1:8080`, serviert alle Projektdateien statisch + `/api/state`- und `/api/music/tracks`-Endpoints
- **`stopLocalServer()`** — Ruft `closeAllConnections()` vor `server.close()` auf, um hängende Prozesse beim Beenden zu vermeiden
- **`buildMenu()`** — Anwendungsmenü (Datei / Ansicht / Hilfe), inkl. dynamischem Untermenü der gespeicherten Spieltag-Vorlagen
- **`openPresetsManagerWindow()`** — öffnet `presets-manager.html` in einem eigenen kleinen Fenster

Tastenkürzel (nur bei fokussierter App, **keine** globalen System-Shortcuts):

| Shortcut | Aktion |
|---|---|
| `F11` | Controller-Fenster Fullscreen umschalten |
| `F12` | Display-Fenster öffnen / schließen |
| `Escape` | Fullscreen beenden |

Weitere App-Shortcuts (Leertaste, H/G, Strg+Z, Zifferntasten für Tabs, `?` für die Shortcut-Übersicht) sind reine JS-Event-Listener in `scoreboard.html`/`js/` und funktionieren identisch im Browser- und im Electron-Modus.

---

## GitHub Pages / Standalone-Betrieb

Da `scoreboard.html` nur relative Pfade verwendet (`css/`, `js/`) und auf reguläre `<script src>`-Tags (keine ES-Module) setzt, funktioniert die App:

- **lokal per `file://`** — Doppelklick auf `scoreboard.html`, alle Dateien im selben Ordner
- **über GitHub Pages** — statisches Hosting ohne Buildschritt; OBS-Integration nicht verfügbar (kein lokaler Server)
- **als Electron-App** — vollständige Funktionalität inkl. OBS-Overlay
