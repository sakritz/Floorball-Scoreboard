# Roadmap

Ideensammlung für mögliche nächste Schritte – **keine Zusagen, kein Sprint-Plan**. Entstanden aus einer Code-Analyse (Stand 2026-09-27). Priorisierung erfolgt erst im Gespräch, dann gibt es für den jeweiligen Punkt einen eigenen, konkreten Umsetzungsplan (siehe `CLAUDE.md`: "erst Vorschlag/Liste zeigen, dann umsetzen").

Sortierung: Komplexität (Aufwand) × Dringlichkeit. Bei der Dringlichkeit zählt vor allem: Was kann während eines echten Spiels schiefgehen (Datenverlust, stumme Fehler) – das wiegt schwerer als reiner Komfort.

---

## Teil 1 – Wartung & Robustheit

### A. Schnell umsetzbar & wichtig (Quick Wins)

1. **Buzzer: stilles Scheitern beheben** — `js/buzzer.js:57-138` fängt Audiofehler nur mit leerem `catch(e){}` ab (Zeile 137), auch bei `<audio>.play()` (Zeile 61, 155). Kein `AudioContext`-Resume bei `suspended`-State/User-Gesture-Sperre. Folge: Buzzer kann live lautlos ausfallen, ohne dass die Bedienperson es merkt.
   Komplexität: niedrig · Dringlichkeit: hoch (Live-Spielbetrieb)

2. **Persistence: stille Fehler sichtbar machen** — `js/persistence.js` fängt alle Fehler beim Laden/Speichern per try/catch ab und gibt nur `false` zurück (Zeile 15, 55), ohne Nutzerhinweis. Kein Schema-Check des geladenen Objekts vor `Object.assign` in `S` (Zeile 45). Mindestens: sichtbarer Hinweis bei fehlgeschlagenem Laden/Speichern statt stillem Fallback auf Default-State.
   Komplexität: niedrig-mittel · Dringlichkeit: hoch (Datenverlust-Risiko unbemerkt)

3. ~~**Doku aktualisieren**~~ — `README.md`, `docs/ARCHITECTURE.md` und `docs/anleitung.md` wurden am 2026-09-27 auf den aktuellen Stand gebracht (Musiksteuerung/Spotify-POC, Spielbericht, Mobile-Ansicht, Spieltag-Vorlagen, Regelwerk 2026, gepaarte Strafen, technisches Tor). **Offen:** `docs/anleitung.html` (eigenständig gestylte HTML-Version, kein automatisches Duplikat von `anleitung.md`) wurde bewusst nicht nachgezogen — deutlich aufwändiger, da Struktur/Styles von Hand nachgebaut werden müssten.
   Komplexität: niedrig (nur noch `anleitung.html` offen, dafür manuell aufwändiger als reiner Text) · Dringlichkeit: niedrig

4. **Saisonmanager-Import-UI entscheiden** — in `scoreboard.html:1579` aktuell auskommentiert ("temporär deaktiviert, siehe Setup-Dialog"). Toter Code sollte entweder fertiggestellt oder entfernt werden, statt unklar herumzuliegen.
   Komplexität: niedrig (Entscheidung) bis mittel (Fertigstellung) · Dringlichkeit: mittel

### B. Mittelfristig (moderater Aufwand)

5. **Crash-Recovery bei Persistenz verbessern** — aktuell wird State nach 15 Minuten Inaktivität verworfen (`STATE_MAX_AGE_MS`), kein `storage`-Event-Listener für Mehrfach-Tab-Konflikte, kein Backup-Mechanismus. Ein Absturz/Schließen während einer längeren Pause killt den ganzen Spielstand. Sinnvoll: expliziter "Spiel wiederherstellen?"-Dialog statt automatischem Verwerfen, evtl. zusätzlicher Sicherungs-Snapshot.
   Komplexität: mittel · Dringlichkeit: mittel-hoch

6. **Mobile: Musik/Spotify & Presets-Manager anpassen** — Musiksteuerung landet aktuell nur ungestylt im generischen "Mehr"-Overflow (`js/mobile.js:16,38`), Presets-Manager/Logo-Upload vermutlich unangepasst im Mobile-Layout. Prüfen und bei Bedarf gezielt für Touch/kleine Screens anpassen.
   Komplexität: mittel · Dringlichkeit: mittel (abhängig von tatsächlicher mobiler Nutzung)

7. **Electron Auto-Update** — kein `electron-updater`, Nutzer müssen GitHub Releases manuell prüfen. In-App-Update-Check wäre Komfortgewinn für Windows-Installer-Nutzer.
   Komplexität: mittel · Dringlichkeit: niedrig-mittel

8. **Spielbericht: Kleinkorrekturen** — Label "PDF-Export" ist eigentlich ein Druckdialog (`window.print()`, `js/report.js`), leicht irreführend. Hartcodierter Fallback `S.periodSecs || 1200` (Zeile 21, 33, 67) sollte auf Custom-Formate geprüft werden. `document.execCommand('copy')`-Fallback (Zeile 344-356) ist deprecated, funktioniert aber noch.
   Komplexität: niedrig · Dringlichkeit: niedrig

### C. Größere / strategische Themen

9. **Musiksteuerung/Spotify-Fernsteuerung: POC → stabiles Feature?** — aktuell bewusst minimal (manuelle Buttons, kein automatisches Torevent-Triggern, `electron/spotify.js:52` explizit "Single-Use, kein Multi-Flow-Support fürs PoC"). Grundsatzentscheidung nötig: ausbauen (automatische Tor-Hymnen-Trigger, robustere Fehlerbehandlung, Playlist-Persistenz) oder bewusst als Experiment/separater Branch belassen.
   Komplexität: hoch · Dringlichkeit: niedrig (funktioniert manuell bereits)

10. **Barrierefreiheit (Accessibility)** — praktisch nicht vorhanden: nur wenige `aria-`/`role`/`alt`-Vorkommen in `scoreboard.html`, kaum Fokus-Styles, kein `prefers-reduced-motion`/`prefers-contrast`. Für ein öffentliches Open-Source-Projekt mit GitHub-Pages-Auftritt ein durchgängiges Thema (betrifft `css/` komplett + Markup).
    Komplexität: hoch (zieht sich durch alle CSS-Dateien + Markup) · Dringlichkeit: niedrig-mittel

11. **Regelwerk 2026 – verbleibende offene Punkte** (bereits in `CLAUDE.md` notiert):
    - §204 Penaltyschießen-Spielersperre softwareseitig erzwingen — braucht neue Spieler-Tracking-Struktur im Shootout, aktuell bewusst Schiedsrichter-Verantwortung.
    - §603.9-Priorisierung "große vor kleine Bankstrafe" bei gleichzeitigen Paarungs-Kandidaten (`findPairCandidate()` nimmt aktuell den ersten Treffer) — in der Praxis seltener Edge-Case.
    Komplexität: mittel-hoch · Dringlichkeit: niedrig (seltene Edge-Cases, bewusst zurückgestellt)

12. **Architektur-Refactoring-Ideen aus `CLAUDE.md`** — Format-/Perioden-Ableitung aus `palette.js` als reines Modul mit Tests, Penaltyschießen-Logik aus `render.js` herauslösen, zentraler `dispatch`-Store, explizites Feldgrößen-Flag für Custom-Formate. Rein strukturell, kein direktes Nutzerfeature, aber sinnvolle Basis bevor größere neue Features (z.B. Punkt 9/10) draufgesattelt werden.
    Komplexität: hoch · Dringlichkeit: niedrig

### D. Zur Kenntnis, kein Handlungsbedarf jetzt

13. **Lokaler Express-Server ohne Auth** (`electron/main.js`, `/api/state`, `/api/music/*`) — bindet korrekt nur auf `127.0.0.1`, daher aktuell kein reales Risiko. Nur relevant, falls später eine Netzwerk-/LAN-Fernanzeige-Funktion dazukommt (siehe Teil 2, Punkt "Wireless-Fernbedienung") — dann müsste Auth/CORS nachgerüstet werden.

14. **Kein Testsetup** — bewusste Entscheidung laut `CLAUDE.md` ("Refactoring nach `js/rules/` wurde verworfen"), hier keine Änderung vorgeschlagen.

---

## Teil 2 – Neue Feature-Ideen

### Electron-spezifisch (nur mit Node-Zugriff im Main-Prozess möglich)

- **Echter PDF-Export** über `webContents.printToPDF()` statt `window.print()`-Dialog — behebt gleich das "PDF ist eigentlich nur Drucken"-Problem aus Teil 1, Punkt 8 sauber.
- **Datei-basiertes Backup/Restore** — Spielstand explizit als Datei speichern/laden (natives Save/Open), zusätzlich zu localStorage. Löst das Datenverlust-Risiko bei Absturz robuster als ein reiner Persistenz-Fix (siehe Teil 1, Punkt 5).
- **Kiosk-/Multi-Monitor-Setup-Assistent** — Electrons `screen`-API erkennt alle Displays und ordnet Controller/Scoreboard/Stream automatisch zu, statt sich `F12` merken zu müssen.
- **Wireless-Fernbedienung übers WLAN** — der schon vorhandene Express-Server (aktuell nur für OBS) könnte erweitert werden, sodass ein Handy/Tablet im selben Netz als echte Fernbedienung dient (QR-Code zum Verbinden). Das wäre ein echter Unterschied zur aktuellen Mobile-Ansicht, die nur im selben Browser-Tab per `BroadcastChannel` läuft, nicht geräteübergreifend.
- **System-Tray-Icon** mit Schnellzugriff (Uhr Start/Stop, Undo), auch wenn Fenster minimiert ist.
- **Native Desktop-Benachrichtigungen** ("Periode endet in 1 Minute", "Strafe läuft aus") auch außerhalb des Fokus.
- **Datei-Assoziation für Spieltag-Vorlagen** — Doppelklick auf eine `.floorball`-Datei startet die App direkt mit dieser Konfiguration.

### Unabhängig von Electron (ginge auch im Web)

- **Zuschauer-Ansicht** — read-only Link fürs Stadion-WLAN, baut auf derselben Netzwerk-Idee wie die Wireless-Fernbedienung auf.
- **Saison-Statistik** über mehrere Spiele hinweg (Tore/Strafen pro Team/Spieler), aufbauend auf den vorhandenen Spieltag-Vorlagen.
- **Liveticker-Textexport** für Social Media/Vereins-Website ("Halbzeit: Team A 3:2 Team B" zum Copy-Paste).

### Einordnung

Favoriten aus dieser Liste: **Wireless-Fernbedienung** (nutzt Infrastruktur, die schon da ist, größter praktischer Sprung für Trainer/Betreuer) und **Datei-Backup** (pragmatischer Quick-Win mit echtem Sicherheitsgewinn, siehe auch Teil 1, Punkt 5).
