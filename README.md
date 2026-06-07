![Floorball Scoreboard App Logo](logo.png)


# Floorball Scoreboard App

Eine Scoreboard-App für Floorball – verfügbar als HTML-Datei (z.B. via GitHub Pages) und als installierbare Desktop-App (Electron).

![Design: TV-Broadcast Style mit Lime und Forest Green](https://img.shields.io/badge/Design-TV--Broadcast-c8ff00?style=flat-square&labelColor=0a0c12)
![Technologie: Vanilla HTML/CSS/JS](https://img.shields.io/badge/Tech-HTML%20%2F%20CSS%20%2F%20JS-22c55e?style=flat-square&labelColor=0a0c12)
![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-white?style=flat-square&labelColor=0a0c12)

---

## Features

**Spielsteuerung**
- Effektive Spielzeitmessung (Großfeld 3 × 20 Min, Großfeld Spieltagsmodus 3 × 15 Min, Kleinfeld 2 × 20 Min)
- Start/Stop per Button oder **Leertaste**
- Tore mit +/− Buttons pro Team
- Automatischer Buzzer-Sound bei Ablauf der Spielzeit
- Pausentimer (10 / 7 / 5 Min je nach Format)

**Strafzeiten & Auszeiten**
- Einfache Zeitstrafe (2 Min), Doppelte Zeitstrafe (2+2 Min), Persönliche 10-Min-Strafe
- Strafzeiten laufen synchron mit der Spieluhr
- 1 Auszeit pro Team (30 Sek), unabhängig von der Spieluhr
- Laufende Strafen sichtbar in Steuerung und Präsentation

**Teamkonfiguration**
- Teamname, Logo (Upload), Akzentfarbe und Trikotfarbe pro Team
- Alle Farben wirken live auf Scoreboard und Vorschau
- Import von Spieldaten (Liga, Teamnamen, Logos, Spielbeginn) direkt aus dem Saisonmanager

**Präsentation**
- Separates Scoreboard-Fenster als Hallenanzeige für zweiten Monitor / Beamer
- Uhrrichtung (hoch/runter) für Steuerung und Präsentation unabhängig einstellbar
- Eingebettete Vorschau (PiP) direkt in der Steuerungsansicht
- Tor-Animation, Auszeit-Overlay, Pausen-Overlay

---

## Benutzung

### Option A – Browser / GitHub Pages (kein Install)

1. Repository herunterladen oder klonen
2. `scoreboard.html` im Browser öffnen – das ist die **Steuerungsansicht**
3. Auf **📺 Scoreboard öffnen** klicken – öffnet das Scoreboard in einem neuen Fenster
4. Scoreboard-Fenster auf den zweiten Monitor / Beamer ziehen und maximieren

Kein Server, kein Build-Schritt, keine Abhängigkeiten. Die Dateien funktionieren direkt von der Festplatte (`file://`) oder über [GitHub Pages](https://sakritz.github.io/Floorball-Scoreboard/scoreboard.html).

> **Hinweis:** Steuerung und Scoreboard müssen im selben Browser geöffnet sein, da die Synchronisation über die `BroadcastChannel`-API läuft.

### Option B – Electron Desktop-App

Die Electron-App schaltet zusätzliche Features frei: automatisches Öffnen des Scoreboards auf dem zweiten Monitor und ein OBS-Overlay für Streams.

**Als Endnutzer** einfach den passenden Installer herunterladen und ausführen – keine weiteren Voraussetzungen.
 
**Für Entwickler** (selbst bauen / starten):

```bash
cd electron
npm install
npm start
```

| Shortcut | Aktion |
|---|---|
| `F12` | Scoreboard-Fenster auf zweitem Monitor öffnen / schließen |
| `F11` | Controller-Fenster Fullscreen umschalten |
| `Escape` | Fullscreen beenden |

**OBS-Overlay:** Wenn die Electron-App läuft, ist das Overlay unter `http://localhost:8080/stream.html` erreichbar. In OBS als Browser-Quelle hinzufügen.

---

## Dateistruktur

```
scoreboard.html       Markup-Gerüst (Steuerung + Scoreboard)
stream.html           OBS-Overlay (Score-Leiste für Streams)
logo.png

css/
  base.css            CSS-Variablen & Reset
  scoreboard.css      TV-/Monitor-Ansicht
  controller.css      Steuer-Panel
  ui.css              Dialoge & Overlays

js/
  state.js            Zentrales State-Objekt
  undo.js             Undo-Stack
  persistence.js      localStorage
  controller.js       Spieluhr & Score-Steuerung
  palette.js          Farbpalette & Periodensteuerung
  game-flow.js        Spielfluss (Strafen, Perioden, Auszeiten)
  logo.js             Logo-Farbextraktion
  buzzer.js           Buzzer-Sounds
  render.js           Scoreboard-Rendering
  ui.js               Dialoge, Startscreen, Setup

electron/
  main.js             Electron-Hauptprozess
  package.json
  assets/icon.png
```

---

## Technischer Hintergrund

Die App besteht aus einer schlanken `scoreboard.html` (~1400 Zeilen reines Markup) mit ausgelagertem CSS (`css/`) und JavaScript (`js/`). Kein Framework, kein Build-Schritt – Vanilla HTML, CSS und JS.

**Synchronisation** zwischen Steuerung und Scoreboard läuft über [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) – kein WebSocket, kein Server nötig. Im Browser-Modus teilen beide Fenster denselben Ursprung, wodurch die API zuverlässig funktioniert.

**OBS-Overlay** (nur Electron): Die Electron-App startet einen lokalen Express-Server auf Port 8080. Der Controller schickt bei jeder Änderung den State per HTTP POST an `/api/state`; `stream.html` pollt diesen Endpoint alle 200 ms. BroadcastChannel funktioniert zwischen Electron und OBS nicht (separate Chromium-Prozesse), daher der HTTP-Polling-Ansatz.

**Buzzer-Sound** wird über die [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) synthetisiert – kein externes Audio-File.

**Schriften** werden von Google Fonts geladen (Barlow Condensed, Bebas Neue). Bei fehlendem Internetzugang fallen die Texte auf Systemschriften zurück.

Eine ausführliche Beschreibung der internen Architektur (Datenfluß, State-Objekt, Undo-System) findet sich in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Regelwerk

Die Spielzeiten, Strafzeiten und Auszeiten entsprechen den **Floorball Spielregeln Großfeld/Kleinfeld (SPRGK) Version 2022** von Floorball Deutschland.

| Format | Spielzeit | Pause | Auszeit |
|---|---|---|---|
| Großfeld | 3 × 20 Min | 10 Min | 1 × 30 Sek |
| Großfeld Spieltag | 3 × 15 Min | 7 Min | 1 × 30 Sek |
| Kleinfeld | 2 × 20 Min | 5 Min | 1 × 30 Sek |

---

## Lizenz

MIT – frei nutzbar, veränderbar und weitergeben.
