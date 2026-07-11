/* ── Floorball Scoreboard ─────────────────────────────────────────────
   Globale Grundvariablen: isScoreboard, BC (BroadcastChannel), S (State)
   Muss als erstes <script> geladen werden – alle anderen Dateien bauen darauf auf.
──────────────────────────────────────────────────────────────────── */
// Copyright (c) 2026 sakritz — MIT License

/* ─── ROUTING ─────────────────────────────────────────────────────── */
const isScoreboard = new URLSearchParams(location.search).get('view') === 'scoreboard';

document.getElementById('view-scoreboard').style.display = isScoreboard ? 'flex' : 'none';
document.getElementById('view-controller').style.display = isScoreboard ? 'none' : 'flex';

if (isScoreboard) document.title = 'Scoreboard';
else document.title = 'Floorball Controller';

/* ─── BROADCAST CHANNEL ───────────────────────────────────────────── */
// Both windows opened from the same file:// URL share the same origin,
// so BroadcastChannel works perfectly.
const BC = new BroadcastChannel('floorball_v2');

/* ─── STATE (controller only) ─────────────────────────────────────── */
let S = {
  homeName: 'HEIMTEAM', awayName: 'GASTTEAM',
  homeLogo: null,       awayLogo: null,
  homeAccent: '#c8ff00', awayAccent: '#22c55e',
  homeJersey: '#0d2e0d',  awayJersey: '#0a1a0a',
  homeScore: 0,         awayScore: 0,
  clock: 1200,          running: false,
  period: 1,            maxPeriods: 3,
  periodSecs: 1200,
  pauseSecs: 600,        // derived from format
  buzzerEnabled: true,
  pauseBuzzerEnabled: true,
  timeoutBuzzerEnabled: true,
  buzzerSound: 'classic',
  buzzerCustomData: null, // base64 data URL of uploaded audio file
  gameStarted: false,    // true once clock has run for the first time
  ctrlCountUp: false,   // controller shows count-up
  sbCountUp: false,     // scoreboard shows count-up
  homePenalties: [],    awayPenalties: [],
  homeToUsed: false,    awayToUsed: false,
  activeTimeout: null,  // { team, remaining }
  pause: null,          // { remaining, duration } – inter-period break
  events: [],           // { id, type, side, clock, period, data }
  showEventsTab: false, // toggle in settings
  goalAnimEnabled: true, // toggle in settings
  pendingGoal: null,     // { side, scorer, assist } – confirmed but waiting for clock start
  tickerVisible: true,   // controlled via settings toggle
  jerseyVisible: false,  // controlled via settings toggle
  penaltyShootout: null, // { active, shots: [{home,away}], round }
  leagueName: null,     // from setup
  kickoffTime: null,    // ms timestamp, from setup
  otSecs: null,         // Verlängerungsdauer in Sek. (null = Regelwert je Format)
  shootoutReady: false, // true nachdem VL mit Gleichstand endete → PS-Card freischalten
};

