# Floorball Scoreboard – Benutzerhandbuch

> Vollständige Anleitung für Controller und Präsentations-Ansicht

---

## Inhaltsverzeichnis

1. [Überblick & Architektur](#überblick--architektur)
2. [Erste Schritte – Setup](#erste-schritte--setup)
3. [Controller-Oberfläche](#controller-oberfläche)
4. [Spieluhr](#spieluhr)
5. [Tore erfassen](#tore-erfassen)
6. [Strafen](#strafen)
7. [Auszeiten](#auszeiten)
8. [Pausen](#pausen)
9. [Penalty-Shootout](#penalty-shootout)
10. [Teams & Farben](#teams--farben)
11. [Einstellungen](#einstellungen)
12. [Danger Zone](#danger-zone)
13. [Scoreboard-Präsentation](#scoreboard-präsentation)
14. [Spielbericht](#spielbericht)
15. [Musiksteuerung (Proof of Concept)](#musiksteuerung-proof-of-concept)
16. [Spieltag-Vorlagen](#spieltag-vorlagen)
17. [Mobile-Ansicht](#mobile-ansicht)
18. [Tastenkürzel](#tastenkürzel)
19. [Tipps & Troubleshooting](#tipps--troubleshooting)

---

## Überblick & Architektur

Das Floorball Scoreboard ist eine **einzelne HTML-Datei**, die in zwei Modi betrieben wird:

| Modus | URL | Zweck |
|---|---|---|
| **Controller** | `scoreboard.html` | Steuerung des Spiels |
| **Präsentation** | `scoreboard.html?view=scoreboard` | Anzeige auf Beamer / zweitem Bildschirm |

Beide Fenster kommunizieren in **Echtzeit** über den Browser-internen `BroadcastChannel`. Eine Serververbindung ist nicht erforderlich – die App funktioniert vollständig offline, auch über `file://`.

Der Spielstand wird automatisch im `localStorage` des Browsers gespeichert. Falls der Controller-Tab versehentlich geschlossen wird, wird beim erneuten Öffnen der Zustand wiederhergestellt – inklusive Korrektur der abgelaufenen Zeit.

### Empfohlenes Setup

```
Laptop (Controller)  ──BroadcastChannel──  Beamer-Tab (Scoreboard)
```

1. Datei im Browser öffnen → **Controller** lädt
2. Über den Button **„Scoreboard öffnen"** ein zweites Fenster / einen zweiten Tab starten → **Präsentation** lädt
3. Den Präsentations-Tab auf den Beamer / zweiten Monitor ziehen und auf Vollbild stellen (`F11`)

---

## Erste Schritte – Setup

Beim ersten Start erscheint automatisch der **Setup-Dialog**. Er kann jederzeit über den Tab **Spiel** → Karte **„Spiel einrichten"** → Button **„⚙ Setup öffnen"** wieder aufgerufen werden.

> **Hinweis:** Der Saisonmanager-Import im Setup-Dialog ist aktuell temporär deaktiviert. Spielkonfigurationen lassen sich stattdessen über **Spieltag-Vorlagen** speichern und wiederverwenden (nur Desktop-App, siehe [Spieltag-Vorlagen](#spieltag-vorlagen)).

### Felder im Setup

| Feld | Beschreibung |
|---|---|
| **Spielformat** | Großfeld 3 × 20 Min · Großfeld-Spieltag 3 × 15 Min · Kleinfeld 2 × 20 Min · Benutzerdefiniert |
| **Liga / Turnier** | Wird in der Topbar des Scoreboards angezeigt (optional) |
| **Anpfiff** | Datum & Uhrzeit; startet optional einen Countdown auf dem Scoreboard |
| **Heimteam / Gastteam** | Teamname (wird großgeschrieben angezeigt) |
| **Teamfarbe (Akzent)** | Hauptfarbe des Teams auf dem Scoreboard |
| **Trikotfarbe** | Sekundärfarbe (optionaler Farbbalken unter dem Teamnamen) |
| **Team-Logo** | Bild-Upload; wird auf dem Scoreboard angezeigt |

### Farben wählen

- **Neon-Palette**: 9 vorbereitete Neon-Farben per Klick auswählen
- **Color Picker**: Beliebige Farbe manuell einstellen
- **Logo-Extraktion**: Wird ein Logo hochgeladen, schlägt das System automatisch passende Farben aus dem Logo vor

### Setup abschließen

Klick auf **„Spiel starten"** übernimmt alle Einstellungen und schließt den Dialog. Falls eine Anpfiffzeit gesetzt wurde, fragt die App, ob ein Countdown auf dem Scoreboard angezeigt werden soll.

---

## Controller-Oberfläche

Der Controller besteht aus drei Bereichen:

```
┌─────────────────────────────────────────────────┐
│              CONTROL BAR (fest oben)            │
│  [Heim] [−][Score][+]  [Uhr] [Abschnitt]  [+][Score][−] [Gast]  │
├─────────────────────────────────────────────────┤
│                    TAB-LEISTE                   │
│  Spiel | Strafen | Auszeiten | Teams | ⚙ | ⚠   │
├─────────────────────────────────────────────────┤
│                 TAB-INHALT                      │
│  (wechselt je nach aktivem Tab)                 │
└─────────────────────────────────────────────────┘
```

### Control Bar

Die **Control Bar** ist immer sichtbar und enthält die wichtigsten Steuerelemente:

- **Teamnamen** mit Strafen- und Auszeit-Indikatoren
- **`−` / `+`-Buttons**: Score direkt anpassen (öffnet bei `+` den Tor-Dialog)
- **Spieluhr** in der Mitte mit Start/Stopp-Button
- **Abschnitts-Chip**: Zeigt aktuellen Abschnitt (z. B. „2. DRITTEL")
- **Sekundär-Timer**: Erscheint bei laufender Auszeit oder Pause

### Tab-Leiste

| Tab | Inhalt |
|---|---|
| **Spiel** | Abschnittssteuerung, Pause, Penaltyschießen, Setup |
| **Strafen** | Strafen erfassen und verwalten |
| **Auszeiten** | Auszeit starten und zurücksetzen |
| **Teams** | Teamnamen, Farben, Logos bearbeiten |
| **⚙ Einstellungen** | Uhr, Buzzer, Präsentations-, Spielbericht- und Musik-Optionen |
| **⚠ Danger Zone** | Uhr überschreiben, Spiel zurücksetzen / beenden |
| **Events** *(optional)* | Spielprotokoll, Spielbericht-Export – nur sichtbar wenn in den Einstellungen aktiviert |
| **Musik** *(optional, nur Electron)* | Playlist & Tor-Hymnen – nur sichtbar wenn in den Einstellungen aktiviert |

> **Tipp:** Tabs können auch per Tastatur aufgerufen werden – die Ziffern `1` bis `9` wählen die sichtbaren Tabs von links nach rechts aus.

---

## Spieluhr

### Starten & Stoppen

| Aktion | Möglichkeit |
|---|---|
| Starten / Stoppen | Großer Button in der Control Bar |
| Starten / Stoppen | `Leertaste` (nur wenn kein Eingabefeld aktiv ist) |

Die Uhr zeigt in der Control Bar die **Controller-Zeit** an. Das Scoreboard kann eine abweichende Zählrichtung haben (einstellbar unter **⚙ Einstellungen → Uhranzeige**).

### Zählrichtung

- **Countdown** (↓): Uhr zählt von der Periodenzeit auf 0 herunter *(Standard)*
- **Count-up** (↑): Uhr zählt von 0 aufwärts

Zählrichtung kann **separat** für Controller und Scoreboard eingestellt werden.

### Abschnitt wechseln

Im Tab **Spiel** → Karte **„Abschnitt"** sind die Abschnitts-Pills (z. B. D1, D2, D3) anklickbar:

- Bei **gestoppter Uhr oder vor Spielbeginn**: Wechsel sofort
- Bei **laufender Uhr und gestarteter Partie**: Sicherheitsabfrage erscheint

### Buzzer

Am Ende jeder Periode ertönt automatisch ein **elektronischer Buzzer-Ton** (sofern aktiviert). Der Buzzer kann in den Einstellungen deaktiviert oder durch verschiedene Sounds ersetzt werden.

---

## Tore erfassen

### Tor eintragen

1. Klick auf den **`+`-Button** neben dem jeweiligen Team (oder Taste `H` für Heim, `G` für Gast)
2. Im Tor-Dialog erscheinen folgende Felder:

| Feld | Beschreibung |
|---|---|
| **Tortyp-Buttons** | **Penalty**, **Eigentor** oder **Techn. Tor** (optional; kein Tortyp = normales Tor) |
| **Schütze (Nummer)** | Rückennummer des Torschützen (optional) |
| **Vorlage (Nummer)** | Rückennummer des Assistenten (optional; entfällt bei Penalty/Eigentor/Techn. Tor) |

3. Klick auf **„Bestätigen"** speichert das Tor

> Bei **Eigentor** und **Technischem Tor** werden Schützen- und Vorlagenfeld ausgeblendet. Bei einem **Penalty** entfällt nur das Vorlagenfeld.

### Sonderfälle bei Strafen

- **Eigentor** und normale Tore heben eine laufende Strafe des Teams in Unterzahl auf (Powerplay endet)
- Ein **Penalty-Tor** oder ein **Technisches Tor** hebt keine laufende Strafe auf

### Tor rückgängig machen

- Taste `Shift + H` → letztes Heimtor entfernen
- Taste `Shift + G` → letztes Gasttor entfernen
- Alternativ: `−`-Button in der Control Bar

### Pending-Goal (Bully-Regelung)

Wird ein Tor eingetragen, während die **Uhr gestoppt** war, gilt die Bully-Regelung:

- Das Tor wird als **„Pending"** gespeichert
- Der Score auf dem Scoreboard erscheint **abgedunkelt**
- Erst beim **nächsten Uhrstart** wird das Tor sichtbar und die TOR!-Animation abgespielt

### TOR!-Animation

Nach einem Tor zeigt das Scoreboard eine **animierte „TOR!"-Einblendung** in der jeweiligen Teamfarbe. Falls der **Events-Tab aktiviert** ist, folgt danach eine Einblendung mit Trikotnummer des Torschützen und ggf. des Assistenten.

Die Animation kann in den **Einstellungen** deaktiviert werden.

---

## Strafen

### Strafe hinzufügen

1. Tab **Strafen** öffnen
2. Klick auf **„+ Strafe hinzufügen"** beim jeweiligen Team
3. Trikotnummer und Strafart auswählen
4. Klick auf **„+ Eintragen"**

### Strafarten

| Typ | Beschreibung |
|---|---|
| **2 Min (einfach)** | Standard-Bankstrafe. Erlischt bei Überzahltor automatisch. |
| **2+2 Min (doppelt)** | Zwei aufeinanderfolgende 2-Min-Strafen. Die erste erlischt bei Überzahltor; die zweite läuft danach automatisch an. |
| **10 Min (pers.) + 2 Min** | Persönliche 10-Min-Strafe (zählt nicht für Unter-/Überzahl) plus eine normale 2-Min-Bankstrafe (erlischt bei Überzahltor). |
| **Techn. Matchstrafe + 2+2 Min** | Technische Matchstrafe mit zwei 2-Min-Bankstrafen. |
| **Matchstrafe + 2+2 Min** | Matchstrafe mit zwei 2-Min-Bankstrafen. |

### Strafuhr

- Die Strafuhr läuft **parallel zur Spieluhr**
- Bei gestoppter Spieluhr pausiert auch die Strafuhr
- Aktive Strafen werden als **Chips** unter dem Score auf dem Scoreboard angezeigt, mit Countdown
- Wartende zweite Teile einer Doppelstrafe zeigen **„– –"** bis sie aktiviert werden

### Strafe löschen

In der Strafenliste erscheint bei jeder aktiven Strafe ein **✕-Button** zum manuellen Entfernen. Wird der erste Teil einer Doppelstrafe gelöscht, wird der wartende zweite Teil sofort aktiviert. Wird eine **gepaarte** Strafe gelöscht, wird die Partner-Strafe automatisch entkoppelt.

### Gepaarte Strafen

Wird eine Strafe eingetragen, während das gegnerische Team bereits eine laufende, ungepaarte Strafe gleicher Dauer/Art bei derselben Spieluhr-Stellung hat, fragt die App **„Strafen koppeln?"**. Gepaarte Strafen zählen nicht für die Spielerzahl (Über-/Unterzahl bleibt unverändert), erlöschen nicht durch ein Powerplay-Tor, laufen aber normal weiter und tragen im Controller/Scoreboard das Badge **„GEPAART"**.

### Strafcodes

Beim Eintragen einer Strafe kann zusätzlich ein Strafcode aus der offiziellen Statistik-Kategorien-Liste des Spielberichtsbogens gewählt werden. Die Codes dienen der Auswertung im Spielbericht, sind aber kein Eindeutigkeits-Schlüssel – mehrere Strafen können denselben Code tragen.

### Über-/Unterzahl-Anzeige

Das Scoreboard zeigt in der **Fußleiste** automatisch das aktuelle Kräfteverhältnis an (z. B. `5 vs 4`), wenn eine Strafe aktiv ist.

---

## Auszeiten

Jedes Team hat pro Spiel **eine Auszeit** von 30 Sekunden.

### Auszeit starten

1. Tab **Auszeiten** öffnen
2. Klick auf **„⏱ Auszeit starten"** beim jeweiligen Team

Das Scoreboard zeigt ein **AUSZEIT-Overlay** mit Teamname und Countdown (30 → 0).

Die Auszeit läuft **unabhängig von der Spieluhr**.

### Auszeit beenden

- Automatisch nach 30 Sekunden (optionaler Buzzer)
- Manuell über **„✕ Beenden"** im Controller (erscheint im Sekundär-Timer-Bereich der Control Bar)

### Auszeit zurücksetzen

Falls eine Auszeit fälschlicherweise verbraucht wurde: Im Tab **Auszeiten** per **↺-Button** direkt bei dem betreffenden Team zurücksetzen.

---

## Pausen

Nach einem Abschnitt (außer dem letzten) schlägt die App automatisch eine **Pause** vor.

### Pausendauer

Standard: **10 Minuten** (600 Sekunden). Bei benutzerdefiniertem Format kann die Pausendauer frei eingestellt werden.

### Pause starten

Im Tab **Spiel** → Karte **„Pause"** → Button **„⏱ Pause starten"**. Alternativ erscheint nach Ablauf eines Abschnitts automatisch ein Bestätigungsdialog.

### Pause-Overlay

Das Scoreboard zeigt während der Pause ein **PAUSE-Overlay** mit Countdown und dem nächsten Abschnittsnamen.

### Pause manuell beenden

Im Controller erscheint während der Pause ein **Sekundär-Timer** in der Control Bar mit einem **✕-Button** zum vorzeitigen Beenden. Nach Ablauf der Pause erscheint ein Dialog zur Bestätigung des nächsten Abschnitts.

---

## Penalty-Shootout

### Shootout starten

1. Tab **Spiel** öffnen
2. Karte **„Penaltyschießen"** aufklappen
3. Klick auf **„▶ Penaltyschießen starten"**

Das Scoreboard wechselt automatisch in die **Shootout-Ansicht**. Im Controller öffnet sich das Shootout-Overlay.

### Schüsse erfassen

Im Shootout-Overlay:

1. Optionale Trikotnummer des Schützen eingeben
2. Klick auf **„✓"** (Tor) oder **„✕"** (Fehlschuss)

Schüsse werden abwechselnd für Heim und Gast erfasst. Jeder Klick auf denselben Button hebt die Eingabe wieder auf (Toggle).

### Visualisierung auf dem Scoreboard

Dots zeigen den aktuellen Stand:

| Dot-Zustand | Bedeutung |
|---|---|
| Gefüllt | Tor erzielt |
| Kreuz | Fehlschuss |
| Pulsierend | Nächster ausstehender Schuss |
| Schwach | Noch nicht an der Reihe |

### Zusatzrunden

Steht es nach 5 Schüssen unentschieden, werden automatisch **Zusatzrunden** hinzugefügt (je ein Schuss pro Team), bis ein Sieger feststeht.

### Sieger-Ermittlung

Sobald ein Team **mathematisch nicht mehr eingeholt** werden kann, wird der Sieger automatisch angezeigt.

### Shootout beenden

Klick auf **„✕ Beenden"** (mit Bestätigungsdialog) schließt das Shootout-Overlay und das normale Scoreboard wird wieder angezeigt. Über **„↺ Neu"** kann das Schießen zurückgesetzt werden.

---

## Teams & Farben

### Im Tab „Teams"

| Einstellung | Beschreibung |
|---|---|
| **Teamname** | Wird in Echtzeit übernommen |
| **Logo** | Bild hochladen; wird auf dem Scoreboard angezeigt |
| **Akzentfarbe** | Hauptfarbe auf dem Scoreboard (Score, Teamname, Glow) |
| **Trikotfarbe** | Sekundärfarbe (Farbbalken, sofern in Einstellungen aktiviert) |

### Farbauswahl

- **Neon-Palette**: 9 Schnellzugriff-Farben
- **Color Picker**: Beliebige Farbe per Farbwähler
- **Hex-Anzeige**: Aktueller Hex-Code wird neben dem Picker angezeigt
- **Zurücksetzen**: ↺-Button stellt die Standard-Farbe wieder her
- **Logo-Vorschläge**: Nach Logo-Upload werden passende Farben automatisch aus dem Logo extrahiert und als Swatches vorgeschlagen

---

## Einstellungen

### Uhranzeige

| Option | Beschreibung |
|---|---|
| **Steuerung: ↓ Runter / ↑ Hoch** | Zählrichtung im Controller |
| **Präsentation: ↓ Runter / ↑ Hoch** | Zählrichtung auf dem Scoreboard |

### Präsentation

| Option | Standard | Beschreibung |
|---|---|---|
| **Fußleiste anzeigen** | AN | Ticker-Leiste mit Liga, Überzahl, Format |
| **Events-Tab & Ereignisse** | AUS | Spielprotokoll-Tab einblenden; aktiviert auch Scorer-Einblendung nach Toren |
| **Tor-Animation** | AN | TOR!-Einblendung nach Tor |
| **Trikotfarben anzeigen** | AUS | Farbbalken unter Teamnamen auf dem Scoreboard |

### Buzzer

| Option | Beschreibung |
|---|---|
| **Spielende** | Buzzer bei Ablauf der Periodenzeit |
| **Pausenende** | Buzzer bei Ablauf der Pause |
| **Auszeit-Ende** | Buzzer bei Ablauf der Auszeit |
| **Sound** | Classic · Horn · Beep · Bell · Eigene Datei (max. 3 MB) |

Ein **„▶ Test-Buzzer"**-Button ermöglicht die Vorschau des gewählten Sounds.

### Scoreboard-Vorschau (PiP)

Der **⧉-Button** in der Control Bar öffnet eine skalierte Live-Vorschau des Scoreboards direkt im Controller-Fenster. Das Vorschaufenster ist frei positionierbar (Titelleiste ziehen) und größenveränderbar (Anfasser rechts unten).

### Darstellung

| Option | Beschreibung |
|---|---|
| **Hell-/Dunkelmodus** | Theme des Controllers umschalten |
| **Schriftgröße der Tabs** | Drei Zoomstufen (Standard / groß / sehr groß) für Tab-Leiste und -Inhalte |

---

## Danger Zone

> ⚠️ Aktionen in diesem Tab erfordern eine Bestätigung und können nicht rückgängig gemacht werden.

### Uhr überschreiben

Erlaubt das manuelle Setzen der Spielzeit auf einen beliebigen Wert im Format `MM : SS`.

**Nur bei gestoppter Uhr möglich.**

### Spiel zurücksetzen

Setzt Score, Spielzeit, Abschnitt (zurück auf 1), Strafen und Auszeiten zurück – **Teamnamen, Farben und Logos bleiben erhalten**.

### Spiel beenden

Beendet das aktuelle Spiel, löscht den gespeicherten Stand vollständig und öffnet den **Setup-Dialog** für ein neues Spiel.

---

## Scoreboard-Präsentation

Das Scoreboard ist die Vollbild-Ansicht für Beamer oder zweiten Monitor.

### Layout-Überblick

```
┌──────────────────────────────────────────────────┐
│ 🔴 LIVE    [Liga]              ● SPIELZEIT LÄUFT │  ← Topbar
├──────────────────────────────────────────────────┤
│              2. DRITTEL                          │  ← Periode
│         ██ ██ ░░  (Perioden-Balken)              │
├──────────────┬───────────────┬───────────────────┤
│ HEIMTEAM     │               │       GASTTEAM    │
│              │   20:00       │                   │
│   3          │               │           1       │
│              │  VERBLEIBEND  │                   │
│ [Strafchip]  │               │   [Strafchip]     │
├──────────────┴───────────────┴───────────────────┤
│ #7 · 2 MIN   │   5 vs 4 PP   │  Großfeld 3×20    │  ← Fußleiste
└──────────────────────────────────────────────────┘
```

### Overlays

| Overlay | Auslöser |
|---|---|
| **TOR!** | Tor wird sichtbar (sofort oder nach Uhrstart bei Pending-Goal) |
| **AUSZEIT** | Auszeit läuft |
| **PAUSE** | Abschnittspause läuft |
| **Shootout** | Penalty-Shootout aktiv |
| **Countdown** | Vor dem Anpfiff, wenn Anpfiffzeit gesetzt ist |

### Responsive Skalierung

Alle Schriftgrößen und Abstände skalieren über CSS `clamp()` automatisch mit der Fenstergröße. Das Scoreboard sieht auf jedem Format gut aus – vom 13"-Laptop-Screen bis zum 4K-Beamer.

---

## Spielbericht

Im Tab **⚙ Einstellungen** → Karte **„Spielbericht"** lässt sich einstellen, ob Beteiligte über **Rückennummern** oder **Namen** erfasst werden ("Nummern im Spiel, Namen im Training").

### Bericht exportieren

1. Tab **Events** (sichtbar, wenn „Events-Tab & Ereignisse" in den Einstellungen aktiviert ist) öffnen
2. Klick auf **„Export"**
3. Im Dialog **„Spielbericht exportieren"** eine Ausgabeform wählen:

| Format | Beschreibung |
|---|---|
| **PDF (Druck)** | Öffnet den Browser-Druckdialog mit einer aufbereiteten, chronologischen Timeline aller Ereignisse |
| **Markdown** | Kopiert den Bericht als Markdown-Text in die Zwischenablage |
| **JSON** | Lädt die vollständigen Berichtsdaten als `.json`-Datei herunter |

---

## Musiksteuerung (Proof of Concept)

> Nur in der Desktop-App (Electron) verfügbar. Bewusst minimal gehalten: keine automatische Auslösung durch Spielereignisse, keine Playlist-Persistenz über Neustarts hinaus.

### Aktivieren

Im Tab **⚙ Einstellungen** → Karte **„Musiksteuerung"** den Schalter **„Aktiv"** einschalten. Dadurch erscheint ein eigener Tab **„Musik"**.

### Bedienen

Im Tab **Musik** wird ein Playlist-Ordner sowie optional Tor-Hymnen pro Team ausgewählt. In der Control Bar erscheint zusätzlich ein Playlist-Button für die schnelle Wiedergabesteuerung.

### Spotify-Fernsteuerung (experimentell)

Alternativ zur lokalen Playlist kann eine Spotify-Playlist per URI als Wiedergabequelle hinterlegt werden. Erfordert eine einmalige Autorisierung; als Proof of Concept nicht für Mehrfach-Verbindungen ausgelegt.

---

## Spieltag-Vorlagen

> Nur in der Desktop-App (Electron) verfügbar.

### Vorlage speichern

Im Setup-Dialog auf **„💾 Als Vorlage speichern"** klicken, um die aktuelle Spielkonfiguration (Format, Teams, Farben, Logos) unter einem Namen abzulegen.

### Vorlage laden

Über das Anwendungsmenü **Datei → Vorlage laden** die gewünschte gespeicherte Vorlage auswählen.

### Vorlagen verwalten

Über das Anwendungsmenü **Datei → Vorlage laden → Vorlagen verwalten…** öffnet sich ein eigenes Fenster mit allen gespeicherten Vorlagen (Name, Speicherdatum) zum Löschen.

---

## Mobile-Ansicht

Auf schmalen Bildschirmen (Smartphone/Tablet) wechselt der Controller automatisch auf ein Bottom-Nav-Layout.

### Bottom-Nav

| Eintrag | Zeigt |
|---|---|
| **Spiel** | Control Bar (Score, Uhr, Abschnitt) |
| **Ereignisse** | Spielprotokoll (sofern aktiviert) |
| **Strafen** | Strafenliste |
| **Auszeit** | Auszeit-Steuerung |
| **Mehr** | Öffnet ein Sheet mit Teams, Einstellungen, Danger Zone und ggf. Musik |

Die Control Bar zeigt zusätzlich Team-Logos, Perioden-Fortschritt als Segmente und die Uhr-Richtung kompakt an. Beim Vergrößern des Fensters über die mobile Breite hinaus schließt ein offenes „Mehr"-Sheet automatisch.

---

## Tastenkürzel

| Taste | Aktion |
|---|---|
| `Leertaste` | Spieluhr starten / stoppen |
| `H` | Tor-Dialog für Heimteam öffnen |
| `G` | Tor-Dialog für Gastteam öffnen |
| `Shift + H` | Letztes Heimtor rückgängig |
| `Shift + G` | Letztes Gasttor rückgängig |
| `Strg + Z` | Letzte Aktion rückgängig (Undo-Stack) |
| `1` – `9` | Tabs wechseln (links → rechts, nur sichtbare Tabs) |
| `Esc` | Offene Dialoge schließen |
| `?` | Tastenkürzel-Übersicht anzeigen |

> **Hinweis:** `Leertaste` funktioniert nur, wenn kein Eingabefeld (Textfeld, Zahlenfeld) aktiv ist.

---

## Tipps & Troubleshooting

### Scoreboard und Controller synchronisieren sich nicht

- Beide Tabs müssen aus **derselben Datei** geöffnet sein (gleiche URL / gleicher `file://`-Pfad)
- Der `BroadcastChannel` funktioniert **nicht** über verschiedene Browser oder Geräte
- Lösung für Netzwerk-Einsatz: Datei über einen lokalen Webserver bereitstellen (z. B. `npx serve`)

### Spielstand nach Tab-Schließen wiederhergestellt?

Ja – der Zustand wird im `localStorage` gespeichert. Beim erneuten Öffnen des Controllers wird die Zeit automatisch um die Abwesenheitsdauer korrigiert.

### Uhr läuft im Hintergrund weiter?

Ja, bewusst so gestaltet. Auch wenn der Controller-Tab nicht aktiv ist, läuft der Timer weiter. Beim Zurückkehren ist die Zeit korrekt.

### Browser-Refresh vermeiden

Der Controller warnt bei `F5` / `Ctrl+R` / `Cmd+R`, sobald das Spiel gestartet wurde. Der gespeicherte Zustand wird beim Reload wiederhergestellt.

### Buzzer ertönt nicht

- Prüfen ob der Buzzer unter **⚙ Einstellungen → Buzzer → Spielende** aktiviert ist
- Der Browser benötigt eine **Benutzeraktion** (Klick), bevor er Audio abspielen darf – einfach die Uhr einmal manuell starten
- Bei Custom-Sound: Datei unter 3 MB halten

### Score stimmt nicht

- `−`-Button in der Control Bar korrigiert das letzte Tor
- Alternativ: `Shift + H` / `Shift + G` per Tastatur

### Vollbild auf dem Beamer

- Scoreboard-Tab auf den Beamer-Monitor ziehen
- `F11` drücken → Vollbild
- Browser-Adressleiste und Tabs verschwinden

---

*Floorball Scoreboard · Alle Rechte vorbehalten*
