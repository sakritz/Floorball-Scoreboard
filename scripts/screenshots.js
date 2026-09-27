/* Screenshots für README/Doku aktualisieren.
   Aufruf: npm run screenshots (einmalig vorher: npx playwright install chromium)
   Öffnet scoreboard.html per file:// (kein Server nötig), spielt ein paar
   Standard-Situationen durch und speichert die Bilder unter img/screenshots/. */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(APP_DIR, 'img', 'screenshots');
const url = (view) => 'file:///' + APP_DIR.replace(/\\/g, '/') + '/scoreboard.html' + (view ? '?view=' + view : '');

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name + '.png') });
  console.log('  ✓ ' + name + '.png');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  // ── Desktop: Startscreen, Controller, Strafen, Scoreboard, Penaltyschießen ──
  const desktop = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const ctrl = await desktop.newPage();

  await ctrl.goto(url());
  await ctrl.waitForSelector('.start-btn-primary');
  await ctrl.waitForTimeout(2500); // Start-Animation abwarten
  await shot(ctrl, 'startscreen');

  await ctrl.click('.start-btn-primary'); // „Leeres Spiel öffnen“
  await ctrl.waitForSelector('#view-controller');
  await ctrl.waitForTimeout(500);
  await shot(ctrl, 'controller');

  // Strafen-Tab: eine Strafe eintragen, damit ein Strafen-Chip sichtbar ist
  await ctrl.click('#tab-btn-strafen');
  await ctrl.click('#ct-home-pen-add-btn');
  await ctrl.fill('#ct-home-pen-num', '7');
  await ctrl.click('#ct-home-pen-form button:has-text("Eintragen")');
  await ctrl.waitForTimeout(400);
  // Panel scrollt beim Eintragen ggf. zum neuen Chip - für den Screenshot
  // wieder nach oben, damit die Kartenköpfe sichtbar sind.
  await ctrl.evaluate(() => document.querySelectorAll('.ct-tab-content').forEach((el) => { el.scrollTop = 0; }));
  await shot(ctrl, 'controller-strafen');

  // Scoreboard-Präsentation läuft im selben Context mit (BroadcastChannel
  // funktioniert nur zwischen Fenstern desselben Origins/Kontexts)
  const board = await desktop.newPage();
  await board.goto(url('scoreboard'));
  await board.waitForTimeout(800);
  await shot(board, 'scoreboard');

  // Penaltyschießen: kein UI-Button im Normalbetrieb (wird nach torlosem
  // Overtime-Ende angeboten) – für den Screenshot direkt die Spielfunktionen
  // aufrufen, die sonst hinter dem Bestätigungsdialog stecken.
  await ctrl.evaluate(() => {
    startPenaltyShootout();
    setPsShot(0, 'home', true);
    setPsShot(0, 'away', false);
    setPsShot(1, 'home', true);
  });
  await board.waitForTimeout(500);
  await shot(board, 'scoreboard-penaltyschiessen');

  await desktop.close();

  // ── Mobile: eigener Context mit schmalem Viewport (Bottom-Nav-Layout) ──
  const mobile = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const mp = await mobile.newPage();
  await mp.goto(url());
  await mp.waitForSelector('.start-btn-primary');
  await mp.waitForTimeout(2500);
  await mp.click('.start-btn-primary');
  await mp.waitForSelector('#view-controller');
  await mp.waitForTimeout(500);
  await shot(mp, 'mobile-controller');
  await mobile.close();

  await browser.close();
  console.log('Fertig – Bilder liegen unter img/screenshots/');
}

main().catch((err) => { console.error(err); process.exit(1); });
