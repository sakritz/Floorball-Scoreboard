# CLAUDE.md – Floorball Scoreboard

Scoreboard-App für Floorball (Großfeld/Kleinfeld) mit Steuerungsansicht, Anzeige für zweiten Monitor/Beamer und OBS-Overlay. Open Source (MIT), öffentlich auf GitHub, Web-Variante auf GitHub Pages, Desktop-Variante als Electron-App (Windows-Installer über GitHub Releases).

## Sprache & Zusammenarbeit

- Kommunikation mit mir auf **Deutsch**. Alle UI-Texte in der App sind Deutsch.
- Code-Kommentare dürfen Deutsch oder Englisch sein, Hauptsache konsistent mit der Umgebung.
- Bei größeren Features oder Designfragen **erst Vorschlag/Liste zeigen, dann umsetzen**. Ich bevorzuge schlanke, minimalistische Lösungen gegenüber Feature-Überfrachtung.
- Nach Änderungen kurz zusammenfassen: welche Dateien, was geändert, was ich live prüfen sollte (UI-Verdrahtung, Abstände, Animationen können nicht automatisch getestet werden).
- Bei Regelfragen im offiziellen Regelwerk nachschlagen und Regelnummer im Code-Kommentar zitieren, statt aus dem Gedächtnis zu arbeiten.

## Harte Architektur-Constraints

- **Kein Framework, kein Build-Schritt.** Vanilla HTML/CSS/JS. Die App muss per Doppelklick (`file://`) und auf GitHub Pages laufen.
- **Klassische `<script src>`-Tags, keine ES-Module** (ES-Module brechen `file://`). Module teilen sich globale Variablen/Funktionen.
- **Ladereihenfolge in `scoreboard.html` ist relevant.** Aktuell: state → undo → persistence → controller → palette → game-flow → logo → buzzer → render → ui → report → mobile. Module teilen sich globale Funktionen/Variablen, neue Skripte nur mit Bedacht einordnen.
- Keine Runtime-Dependencies im Web-Teil. Node wird nur für Electron (und Syntax-Checks) gebraucht.
- `scoreboard.html` enthält kein inline CSS/JS (außer historischen Resten); neue Logik gehört in die passende Datei unter `js/`.
- Icons: **Phosphor-Icons als inline SVG-Sprite** in `scoreboard.html` (`<symbol id="ph-...">`), verwendet über `<span class="ph-icon ph-sm"><svg><use href="#ph-..."/></svg></span>`. Keine Emojis in der UI. Neue Icons als Symbol ins Sprite aufnehmen.
- Theming über CSS-Variablen (`--ct-bg`, `--ct-surface`, `--ct-card`, `--lime` …) in `css/base.css`; es gibt einen hellen und dunklen Modus, neue Farben also immer als Variable.

## Struktur

```
scoreboard.html        Markup: Startscreen, Controller, Scoreboard (per ?view=)
stream.html            OBS-Overlay (nur mit Electron-Server nutzbar)
css/
  base.css             Variablen, Reset, Themes
  scoreboard.css       Anzeige (TV/Monitor)
  controller.css       Steuer-Panel (Tabs, Karten, Formulare)
  ui.css               Startscreen, Setup-Dialog, Countdown, Dialoge
  mobile.css           Mobile Controller (Bottom-Nav, gestapelte Layouts)
js/
  state.js             Globales State-Objekt S, isScoreboard, BroadcastChannel BC
  undo.js              Patch-basierter Undo-Stack (+ Clock-Hilfsvariablen)
  persistence.js       saveState/loadState (localStorage)
  controller.js        initController, push, Spieluhr, Tore, Powerplay-Check
  palette.js           Farbpalette, setPeriod, Periodenpills/Format
  game-flow.js         renderController, Strafen, Perioden, Auszeiten, PENALTY_CODES
  logo.js              Farbextraktion aus Team-Logos
  buzzer.js            Buzzer (Web Audio API, kein Audiofile)
  render.js            initScoreboard, renderScoreboard, Ticker, Toranimation, Penaltyschießen
  report.js            Spielbericht (chronologische Timeline; PDF/Druck, Markdown, JSON)
  ui.js                Hilfe, Startscreen + Startmodus, Countdown, Setup-Dialog, Theme
  mobile.js            Mobile Navigation (Bottom-Nav, „Mehr“-Menü)
electron/
  main.js              Fenster, Express-Server, Shortcuts
package.json           Root: electron, express, electron-builder (Build-Config)
docs/                  ARCHITECTURE.md, Anleitung
documents/             Regelwerke (SPRGK 2022/2026, Synopse), Spielberichtsbogen (PDF)
legacy/                Alte Single-File-Version (nicht mehr pflegen)
```

Details: siehe `docs/ARCHITECTURE.md` und `README.md`.

## Datenfluss

- **Controller → Scoreboard:** `BroadcastChannel` (gleicher Browser, gleicher Origin). Die Anzeige läuft über `scoreboard.html?view=scoreboard` bzw. die eingebaute ⧉-Vorschau (PiP).
- **OBS-Overlay:** nur in Electron. Express auf `127.0.0.1:8080`; Controller POSTet den State an `/api/state`, `stream.html` pollt alle 200 ms. Der `fetch` ist per `location.protocol === 'http:'` abgesichert, damit er unter `file://` nicht stört.
- **Persistenz:** `localStorage` Key `floorball_state_v2`, inkl. Zeitkorrektur über `_savedAt`. State älter als `STATE_MAX_AGE_MS` (15 min) wird verworfen → Startscreen. Einstellungen liegen unter eigenen Keys (alle in `render.js`, außer wo angegeben): `ct-jersey-vis`, `ct-player-entry-mode`, `ct-ticker-hidden`, `ct-events-tab-on`, `ct-goal-anim-on`; in `ui.js`: `sb-theme`, `ct-tab-area-height`. Für den Startmodus gibt es keinen Key.
- **Undo:** patch-basiert (`pushUndo` / `applyUndoPatch`), Tor-Events werden über `eventId` referenziert, nicht über Array-Snapshots.
- Manche Effekte (Pending-Tor, Toranimation, Auszeit-/Pausen-Overlay) existieren **nur in der Anzeige**, nicht im Controller. Das ist gewollt.

## Regel-Logik

Es gibt bewusst **kein** separates Regel-Modul und keine Tests (Refactoring nach `js/rules/` wurde verworfen). Regellogik liegt direkt in `game-flow.js` (Strafen: `maxPensFor`, `runningPenIds`, `teamStrengthPens`, `PENALTY_CODES`) und `controller.js` (`checkPowerPlayPenalty`, Tore, Uhr). Regelnummer im Code-Kommentar zitieren.

## Befehle

```bash
node --check js/<datei>.js      # Syntax-Check nach Edits

npm install                     # Electron-Deps (im Repo-Root)
npm start                       # Electron-App lokal starten
npm run build:win               # Windows-Installer (dist/)
```

Build-Hinweise (Windows): Scheitert electron-builder beim Entpacken von winCodeSign mit Symlink-Fehler → Windows-Entwicklermodus aktivieren oder als Admin bauen. Kein Code-Signing-Zertifikat vorhanden. Für Releases nur die `Setup *.exe` hochladen.

Electron-Shortcuts: `F12` Anzeige auf zweitem Monitor, `F11` Fullscreen Controller, `Esc` Fullscreen beenden.
App-Shortcuts (bewusst minimal): `Space` Uhr, `H`/`G` Tor Heim/Gast (`Shift` = −1), `1–9` sichtbare Tabs, `Strg+Z` Undo, `?` Shortcut-Overlay, `Esc` schließt Dialoge. Der Listener-Guard `initController._listenersBound` verhindert doppelte Registrierung.

## Floorball-Regeln (Domäne)

Grundlage bisher: **Floorball Spielregeln Großfeld/Kleinfeld (SPRGK) 2022**, Floorball Deutschland. Die **Regelversion 2026** kommt – Umstellung läuft (siehe unten).

| Format | Spielzeit | Pause | Auszeit |
|---|---|---|---|
| Großfeld | 3 × 20 Min | 10 Min | 1 × 30 Sek |
| Großfeld Spieltag | 3 × 15 Min | 7 Min | 1 × 30 Sek |
| Kleinfeld | 2 × 20 Min | 5 Min | 1 × 30 Sek |

Wichtige, bereits umgesetzte Regeln:
- **Strafenlimit:** max. 2 gleichzeitig laufende Strafen pro Team (Großfeld), 1 im Kleinfeld; weitere warten („WARTET", Zeit `– –`) und ticken nicht. Custom-Formate fallen mangels Feldgrößen-Flag aufs Großfeld-Limit zurück.
- **Powerplay-Basis** feldgrößenabhängig (GF 5, KF 3).
- **Erlöschen (SPRGK 6.3.6):** Tor des Teams in Überzahl hebt eine laufende Strafe auf – auch **Eigentor**; **Strafschuss-Tor nicht**. Persönliche Strafen und wartende Strafen begründen kein Powerplay (bei 2+10 zählt nur die Begleit-2).
- **Strafcodes** (`PENALTY_CODES` in `game-flow.js`) = Liste vom Spielberichtsbogen, 901–999. **806 ist kein Strafcode**, sondern der Torprotokoll-Code für Tor per Strafschuss.
- Spielbericht nutzt Rückennummern oder Namen (Einstellung „Beteiligte erfassen als").

### Offene Punkte Regelwerk 2026 (Stand der Analyse Juni 2026 – vor Umsetzung Code prüfen, ob schon erledigt)
- **603.7** Wartende Strafen in Reihenfolge der kürzesten Restzeit aktivieren (aktuell nach ID/Aussprache, `runningPenIds`). Doppelstrafe zählt als eine Strafe.
- **603.9** Gleichzeitige gleichwertige Strafen beider Teams werden gepaart: beeinflussen Spielerzahl nicht, erlöschen nicht durch Tore, stehen aber im Bericht. Braucht `paired`-Flag, Anpassung von `teamStrengthPens` / `findPowerPlayPenalty`, UI.
- **204** Penaltyschießen: nach den ersten 5 verschiedenen Schützen darf jeder Feldspieler (auch mehrfach) schießen; Dialogtext anpassen. `checkPsExtraRound()` passt bereits.
- Labels: „STRAFSTOSS" → „PENALTY" (`render.js`), „Zeitstrafe" → „Bankstrafe", Strafcodes auf 2026er Nummern umstellen (u. a. 909→907, 910→908, 919→917, 922→920, 925→923, neu „Auseinandersetzung provozieren").
- Optional **701.3** technisches Tor als neuer Tortyp.

## Features, die leicht übersehen werden

- Mobile Controller-Ansicht über `css/mobile.css` (Bottom-Nav, „Mehr"-Menü). Änderungen am Controller-Layout auch mobil prüfen.
- Zwei Startpfade: `startBlankGame()` und `startConfiguredGame()` – Änderungen am Spielstart in beiden berücksichtigen.
- `scoreboard.html` enthält große base64-Logos in einzelnen Zeilen – beim Lesen/Greppen lange Zeilen abschneiden.

## Mögliche nächste Refactoring-Schritte (Ideen, nicht beschlossen)

- Format-/Periodenableitung aus `palette.js` als pures Modul mit Tests
- Penaltyschießen-Logik aus `render.js` herauslösen
- Zentraler `dispatch`-Store, in den die Regel-Reducer einziehen
- Explizites Feldgrößen-Flag im State für Custom-Formate