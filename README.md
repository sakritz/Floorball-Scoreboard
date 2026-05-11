![Floorball Scoreboard App Logo](logo.png)


# Floorball Scoreboard App

Ein lokales, browserbasieres Scoreboard für Floorball-Spiele – gebaut als einzelne HTML-Datei, ohne Server, ohne Installation.

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

**Präsentation**
- Separates Scoreboard-Fenster für zweiten Monitor / Beamer
- Uhrrichtung (hoch/runter) für Steuerung und Präsentation unabhängig einstellbar
- Eingebettete Vorschau (PiP) direkt in der Steuerungsansicht
- Tor-Animation, Auszeit-Overlay, Pause-Overlay

---

## Benutzung

1. `floorball.html` herunterladen
2. Im Browser öffnen – das ist die **Steuerungsansicht**
3. Auf **📺 Scoreboard öffnen** klicken – öffnet das Scoreboard in einem neuen Fenster
4. Scoreboard-Fenster auf den zweiten Monitor / Beamer ziehen und maximieren

Kein Server, kein Build-Schritt, keine Abhängigkeiten. Die Datei funktioniert direkt von der Festplatte (`file://`).

> **Hinweis:** Steuerung und Scoreboard müssen im selben Browser geöffnet sein, da die Synchronisation über den `BroadcastChannel`-API des Browsers läuft.

---

## Technischer Hintergrund

Die App ist eine einzelne HTML-Datei (~2400 Zeilen) mit Vanilla HTML, CSS und JavaScript.

**Synchronisation** zwischen Steuerung und Scoreboard läuft über [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) – kein WebSocket, kein Server nötig. Beide Fenster teilen denselben `file://`-Ursprung, wodurch die API zuverlässig funktioniert.

**Buzzer-Sound** wird über die [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) synthetisiert – kein externes Audio-File.

**Schriften** werden von Google Fonts geladen (Barlow Condensed, Bebas Neue). Bei fehlendem Internetzugang fallen die Texte auf Systemschriften zurück.

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