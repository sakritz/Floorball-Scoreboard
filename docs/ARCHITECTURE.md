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
        ├── Fenster 2: Scoreboard-Anzeige (zweiter Monitor, F12)
        └── Express-Server auf http://localhost:8080
              ├── Serviert scoreboard.html + alle Dateien statisch
              ├── POST /api/state  ← Controller schickt State-Updates
              └── GET  /api/state  ← stream.html (OBS) pollt State
```

OBS bindet das Overlay als Browser-Quelle ein: `http://localhost:8080/stream.html`

---

## Dateistruktur

```
scoreboard.html          Markup-Gerüst; kein inline CSS, kein inline JS
stream.html              OBS-Overlay (Score-Leiste für Streams)

css/
  base.css               CSS Custom Properties, Reset (Fundament für alle anderen)
  scoreboard.css         TV-/Monitor-Ansicht (Topbar, Teams, Uhr, Ticker)
  controller.css         Steuer-Panel (Tabs, Karten, Buttons, Formulare)
  ui.css                 Shared UI (Setup-Dialog, Startscreen, Countdown)

js/
  state.js               Globale Grundvariablen: S (State-Objekt), isScoreboard, BC
  undo.js                Undo-Stack (patch-basiert) + Clock-Hilfsvariablen
  persistence.js         localStorage: saveState / loadState
  controller.js          initController, push, Spieluhr, Score-Anpassung
  palette.js             Neon-Farbpalette, setPeriod, buildPeriodPills
  game-flow.js           renderController, pushAndRender, Strafen, Perioden, Auszeiten
  logo.js                Farbextraktion aus Team-Logos (Canvas, standalone)
  buzzer.js              Buzzer-Sounds (Web Audio API)
  render.js              initScoreboard, renderScoreboard, Penalty-Shootout
  ui.js                  Help-Modal, Startscreen, Countdown, Setup-Dialog, Theme

electron/
  main.js                Electron-Hauptprozess (Fenster, Express-Server, Shortcuts)
  package.json           Dependencies: electron, express
  assets/
    icon.png             App-Icon
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
- **`createDisplayWindow()`** — Rahmenloses Vollbild-Fenster auf dem zweiten Monitor (falls vorhanden), lädt `http://localhost:8080/scoreboard.html` (BroadcastChannel synchronisiert automatisch)
- **`startLocalServer()`** — Express-Server auf `127.0.0.1:8080`, serviert alle Projektdateien statisch + `/api/state`-Endpoint
- **`stopLocalServer()`** — Ruft `closeAllConnections()` vor `server.close()` auf, um hängende Prozesse beim Beenden zu vermeiden

Globale Tastenkürzel:

| Shortcut | Aktion |
|---|---|
| `F11` | Controller-Fenster Fullscreen umschalten |
| `F12` | Display-Fenster öffnen / schließen |
| `Escape` | Fullscreen beenden |

---

## GitHub Pages / Standalone-Betrieb

Da `scoreboard.html` nur relative Pfade verwendet (`css/`, `js/`) und auf reguläre `<script src>`-Tags (keine ES-Module) setzt, funktioniert die App:

- **lokal per `file://`** — Doppelklick auf `scoreboard.html`, alle Dateien im selben Ordner
- **über GitHub Pages** — statisches Hosting ohne Buildschritt; OBS-Integration nicht verfügbar (kein lokaler Server)
- **als Electron-App** — vollständige Funktionalität inkl. OBS-Overlay
