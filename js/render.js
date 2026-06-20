/* ── Floorball Scoreboard ──────────────────────────────────────────────
   Scoreboard-Rendering + initScoreboard – benötigt: S, BC, isScoreboard, push, pushAndRender
────────────────────────────────────────────────────────────────────── */

/* ─── SCOREBOARD RENDER ────────────────────────────────────────────── */
if (isScoreboard) {
  initScoreboard();
}

function initScoreboard() {
  // Try to get state from controller via BroadcastChannel
  BC.postMessage({ type: 'REQ_STATE' });

  BC.onmessage = e => {
    if (e.data.type === 'STATE') {
      renderScoreboard(e.data.payload);
    }
  };

  // Fallback: if controller hasn't responded after 300ms (e.g. setup dialog still open),
  // load state from localStorage directly so countdown is shown immediately
  setTimeout(() => {
    try {
      const raw = localStorage.getItem('floorball_state_v2');
      if (raw) {
        const saved = JSON.parse(raw);
        delete saved._savedAt; delete saved._clockMs;
        renderScoreboard(saved);
      }
    } catch(e) {}
  }, 300);
}

let sbPrevHome = null, sbPrevAway = null;  // null = not yet initialised
let sbInitialized = false; // true after first render – don't fire anim on init
let sbLastPending = null;  // tracks pendingGoal.side across renders
let goalTimer = null;
let scorerTimer = null;
let s_colors = { home: '#c8ff00', away: '#22c55e' };

function renderScoreboard(s) {
  if (!s) return;

  // Update countdown (shows before kickoff, hides once game started)
  updateCountdown(s);

  // Colors
  applyScoreboardColors(s);
  s_colors = { home: s.homeAccent||'#c8ff00', away: s.awayAccent||'#22c55e' };
  const toRgb = hex => {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  };
  const root = document.documentElement;
  root.style.setProperty('--tv-home-rgb', toRgb(s.homeAccent||'#c8ff00'));
  root.style.setProperty('--tv-away-rgb', toRgb(s.awayAccent||'#22c55e'));

  const fmt = t => { if(t<0)t=0; const m=Math.floor(t/60),sc=t%60; return `${m}:${String(sc).padStart(2,'0')}`; };
  const fmtClock = t => {
    const disp = s.sbCountUp ? (s.periodSecs - t) : t;
    const d = Math.max(0, disp);
    return `${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`;
  };

  const pn3 = ['1. DRITTEL','2. DRITTEL','3. DRITTEL','VERLÄNGERUNG'];
  const pn2 = ['1. HALBZEIT','2. HALBZEIT','VERLÄNGERUNG'];
  const pn  = s.maxPeriods===3 ? pn3 : pn2;
  const periodName = pn[s.period-1] || 'ENDE';

  // Names + logos
  const setText = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setText('sb-home-name', s.homeName);
  setText('sb-away-name', s.awayName);
  setText('sb-period-label', periodName);
  setText('sb-clock-label', s.sbCountUp ? 'GESPIELT' : 'VERBLEIBEND');

  // League info in topbar (liga · drittel · kickoff if set)
  const leagueEl = document.getElementById('sb-league-info');
  if (leagueEl) {
    const parts = [];
    if (s.leagueName) parts.push(s.leagueName.toUpperCase());
    leagueEl.textContent = parts.join(' · ');
  }

  ['home','away'].forEach(side => {
    const el = document.getElementById('sb-' + side + '-logo');
    const logo = s[side + 'Logo'];
    const name = side==='home' ? s.homeName : s.awayName;
    if (el) {
      const newHtml = logo ? `<img src="${logo}">` : name.charAt(0);
      if (el.innerHTML !== newHtml) el.innerHTML = newHtml;
      el.classList.toggle('has-logo', !!logo);
      el.classList.toggle('show', !!logo);
    }
  });

  // Jersey bars visibility + color
  ['home','away'].forEach(side => {
    const bar = document.getElementById('sb-' + side + '-color-bar');
    if (!bar) return;
    const accentEl  = bar.querySelector('.sb-color-bar-accent');
    let jerseyEl    = bar.querySelector('.sb-color-bar-jersey');
    const jerseyColor = side === 'home' ? (s.homeJersey || '#0d2e0d') : (s.awayJersey || '#0a1a0a');
    if (s.jerseyVisible) {
      if (!jerseyEl) {
        jerseyEl = document.createElement('div');
        jerseyEl.className = 'sb-color-bar-jersey';
        bar.appendChild(jerseyEl);
      }
      jerseyEl.style.background = jerseyColor;
    } else {
      if (jerseyEl) jerseyEl.remove();
    }
  });

  // Scores + goal flash
  const homeEl = document.getElementById('sb-home-score');
  const awayEl = document.getElementById('sb-away-score');

  // Determine what scores to actually display (hide pending goal until clock runs)
  let displayHome = s.homeScore;
  let displayAway = s.awayScore;
  if (s.pendingGoal) {
    if (s.pendingGoal.side === 'home') displayHome = Math.max(0, s.homeScore - 1);
    else                               displayAway = Math.max(0, s.awayScore - 1);
  }

  if (!sbInitialized) {
    // First render: record baseline (use real scores, not display)
    sbPrevHome = s.homeScore;
    sbPrevAway = s.awayScore;
    sbInitialized = true;
  } else {
    // Trigger animation when real score rises (pending goal → anim immediately)
    // Trigger score reveal animation when pendingGoal clears (clock starts)
    const prevPending = sbLastPending;
    sbLastPending = s.pendingGoal ? (s.pendingGoal.side) : null;

    if (s.homeScore > sbPrevHome) {
      // New goal for home
      triggerGoal('home', homeEl, s.homeName, s);
    } else if (s.awayScore > sbPrevAway) {
      // New goal for away
      triggerGoal('away', awayEl, s.awayName, s);
    } else if (prevPending && !s.pendingGoal) {
      // pendingGoal just cleared → score reveal (no TOR! anim, just score-pop)
      const revealSide = prevPending;
      const revealEl = revealSide === 'home' ? homeEl : awayEl;
      revealEl.classList.remove('score-pop');
      void revealEl.offsetWidth;
      revealEl.classList.add('score-pop');
    }
    sbPrevHome = s.homeScore;
    sbPrevAway = s.awayScore;
  }

  homeEl.textContent = displayHome;
  awayEl.textContent = displayAway;
  // Dim pending score
  homeEl.classList.toggle('pending', !!(s.pendingGoal && s.pendingGoal.side === 'home'));
  awayEl.classList.toggle('pending', !!(s.pendingGoal && s.pendingGoal.side === 'away'));

  // Clock
  const clockEl = document.getElementById('sb-clock');
  if (clockEl) {
    clockEl.textContent = fmtClock(s.clock);
    clockEl.className = 'sb-clock ' + (s.running ? 'running' : 'stopped');
  }

  // Status
  const pill = document.getElementById('sb-status');
  if (pill) {
    pill.className = 'sb-status-pill ' + (s.running ? 'running' : 'stopped');
    setText('sb-status-text', s.running ? 'LÄUFT' : 'GESTOPPT');
  }

  // Period dots
  const dotsEl = document.getElementById('sb-dots');
  if (dotsEl) {
    dotsEl.innerHTML = '';
    for (let i = 1; i <= s.maxPeriods; i++) {
      const d = document.createElement('div');
      d.style.cssText = `height:5px;width:clamp(40px,7vw,110px);flex-shrink:0;transition:all .4s;border-radius:2px;`;
      if (i === s.period) {
        d.style.background = '#ff8c00';
        d.style.boxShadow  = '0 0 12px rgba(255,140,0,.7), 0 0 4px rgba(255,140,0,.5)';
      } else if (i < s.period) {
        d.style.background = 'rgba(255,255,255,.25)';
      } else {
        d.style.background = 'rgba(255,255,255,.1)';
      }
      dotsEl.appendChild(d);
    }
  }

  // Penalty chips under scores
  const typeLabel = (secs, p) => { if (p&&p.redCardLabel) return p.redCardLabel+' 2+2'; if (p&&p.doubleFirst) return '2+2 MIN (1)'; if (p&&p.doubleSecond) return '2+2 MIN (2)'; if (p&&p.waiting) return '2+2 MIN (2)'; if (p&&p.personal) return '10 MIN PERS.'; return secs<=120?'2 MIN':'10 MIN'; };
  ['home','away'].forEach(side => {
    const c = document.getElementById('sb-' + side + '-pen-chips');
    if (!c) return;
    const pens = s[side + 'Penalties'] || [];
    // smart update – only rebuild if count changed
    const existing = c.querySelectorAll('.sb-pen-chip[data-id]');
    const existingMap = {};
    existing.forEach(el => { existingMap[el.dataset.id] = el; });
    const currentIds = new Set(pens.map(p => String(p.id)));
    Object.keys(existingMap).forEach(id => { if (!currentIds.has(id)) existingMap[id].remove(); });
    pens.forEach(p => {
      const idStr = String(p.id);
      if (existingMap[idStr]) {
        existingMap[idStr].querySelector('.sb-pen-chip-time').textContent = p.waiting ? '– –' : fmt(p.remaining);
      } else {
        const el = document.createElement('div');
        el.className = 'sb-pen-chip' + (side==='away'?' away':'');
        el.dataset.id = idStr;
        el.innerHTML = `
          <div class="sb-pen-chip-num">#${p.number}</div>
          <div class="sb-pen-chip-time">${p.waiting ? '– –' : fmt(p.remaining)}</div>
          <div class="sb-pen-chip-type">${typeLabel(p.secs, p)}</div>`;
        c.appendChild(el);
      }
    });
  });

  // Ticker – fixed 3-column grid: Strafe Heim | Mitte | Strafe Gast
  const ticker = document.getElementById('sb-ticker');
  if (ticker) {
    // Show/hide based on state
    ticker.classList.toggle('ticker-hidden', s.tickerVisible === false);

    const hc = s.homeAccent || '#c8ff00';
    const ac = s.awayAccent || '#22c55e';
    const typeLabel = (secs, p) => {
      if (p && p.redCardLabel) return p.redCardLabel;
      if (p && p.doubleFirst)  return '2+2';
      if (p && p.doubleSecond) return '2+2';
      if (p && p.personal)     return '10 MIN PERS.';
      return secs <= 120 ? '2 MIN' : '10 MIN';
    };

    // LEFT: home penalty (shortest active team-strength first, then personal)
    const homePen = (s.homePenalties||[]).filter(p=>!p.waiting&&!p.personal).sort((a,b)=>a.remaining-b.remaining)[0]
                 || (s.homePenalties||[]).filter(p=>!p.waiting).sort((a,b)=>a.remaining-b.remaining)[0];
    let leftHtml = '';
    if (homePen) {
      leftHtml = `
        <div style="display:flex;flex-direction:column;gap:1px">
          <div class="sb-ticker-label" style="color:${hc}">STRAFE HEIM</div>
          <div class="sb-ticker-value">#${homePen.number} · ${typeLabel(homePen.secs,homePen)}</div>
        </div>
        <div class="sb-ticker-time" style="color:${hc};margin-left:auto">${homePen.waiting?'– –':fmt(homePen.remaining)}</div>`;
    }

    // RIGHT: away penalty (shortest active team-strength first, then personal)
    const awayPen = (s.awayPenalties||[]).filter(p=>!p.waiting&&!p.personal).sort((a,b)=>a.remaining-b.remaining)[0]
                 || (s.awayPenalties||[]).filter(p=>!p.waiting).sort((a,b)=>a.remaining-b.remaining)[0];
    let rightHtml = '';
    if (awayPen) {
      rightHtml = `
        <div class="sb-ticker-time" style="color:${ac};margin-right:auto">${awayPen.waiting?'– –':fmt(awayPen.remaining)}</div>
        <div style="display:flex;flex-direction:column;gap:1px;text-align:right">
          <div class="sb-ticker-label" style="color:${ac}">STRAFE GAST</div>
          <div class="sb-ticker-value">#${awayPen.number} · ${typeLabel(awayPen.secs,awayPen)}</div>
        </div>`;
    } else if (!homePen) {
      // No penalties – show period info on right
      rightHtml = `<div style="text-align:right;margin-left:auto">
        <div class="sb-ticker-label">ABSCHNITT</div>
        <div class="sb-ticker-value">${periodName}</div>
      </div>`;
    }

    // CENTER: Power Play, Timeout, or empty
    const homePens = teamStrengthPensS(s.homePenalties).length;
    const awayPens = teamStrengthPensS(s.awayPenalties).length;
    const hasPenAction = homePen || awayPen || homePens !== awayPens || s.activeTimeout;

    let midHtml = '';
    if (s.activeTimeout) {
      const toTeam = s.activeTimeout.team === 'home' ? s.homeName : s.awayName;
      midHtml = `
        <div class="sb-ticker-mid-label">AUSZEIT</div>
        <div class="sb-ticker-time" style="color:var(--orange,#ff9500)">${fmt(s.activeTimeout.remaining)}</div>
        <div class="sb-ticker-value" style="color:rgba(255,255,255,.5)">${toTeam}</div>`;
    } else if (homePens !== awayPens) {
      const ppHome = homePens < awayPens ? 5 : 5 - (homePens - awayPens);
      const ppAway = awayPens < homePens ? 5 : 5 - (awayPens - homePens);
      midHtml = `
        <div class="sb-ticker-mid-label">POWER PLAY</div>
        <div style="display:flex;align-items:baseline;gap:4px">
          <span class="sb-ticker-pp-num" style="color:${hc}">${ppHome}</span>
          <span class="sb-ticker-pp-vs">vs</span>
          <span class="sb-ticker-pp-num" style="color:${ac}">${ppAway}</span>
        </div>`;
    } else if (homePen || awayPen) {
      midHtml = `<div class="sb-ticker-mid-label" style="opacity:.4">–</div>`;
    }

    // If no penalty activity → show last 1-3 events as tiles
    if (!hasPenAction && s.showEventsTab && s.events && s.events.length) {
      const recent = s.events.slice(0);
      const tiles = recent.map((ev, i) => {
        const color = ev.side === 'home' ? hc : ev.side === 'away' ? ac : 'rgba(255,255,255,.6)';
        const teamName = ev.side === 'home' ? s.homeName : ev.side === 'away' ? s.awayName : '';
        let evLabel = '', evSub = '';
        if (ev.type === 'goal') {
          const isOwn = ev.data.goalType === 'own';
          const isPen = ev.data.goalType === 'penalty';
          evLabel = isOwn ? `EIGENTOR · ${teamName}` : isPen ? `STRAFSTOSS · ${teamName}` : `TOR · ${teamName}`;
          evSub   = isOwn ? 'ET' : [ev.data.scorer ? `#${ev.data.scorer}` : '', !isPen && ev.data.assist ? `▶ #${ev.data.assist}` : ''].filter(Boolean).join('  ') || '–';
        } else if (ev.type === 'penalty') {
          evLabel = `STRAFE · ${teamName}`;
          evSub   = ev.data.penReason ? `#${ev.data.number} · ${ev.data.penReason}` : `#${ev.data.number} · ${ev.data.penType}`;
        } else if (ev.type === 'timeout') {
          evLabel = `AUSZEIT · ${teamName}`;
          evSub   = '–';
        }
        const t = ev.clock;
        const clockStr = `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
        const pLabel = s.maxPeriods===3
          ? ['1. DRITTEL','2. DRITTEL','3. DRITTEL','VERL.'][ev.period-1]||''
          : ['1. HALBZEIT','2. HALBZEIT','VERL.'][ev.period-1]||'';
        const borderLeft = i === 0
          ? `3px solid ${color}`
          : `1px solid rgba(255,255,255,.08)`;
        return `<div style="
            flex:0 0 auto;width:clamp(220px,22vw,340px);
            display:flex;align-items:center;
            gap:clamp(8px,1.2vw,18px);
            padding:0 clamp(14px,2vw,30px);
            border-left:${borderLeft};
            height:100%;box-sizing:border-box;overflow:hidden">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
            <div class="sb-ticker-label" style="color:${color}">${evLabel}</div>
            <div class="sb-ticker-value" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${evSub}</div>
          </div>
          <div style="flex-shrink:0;text-align:right;display:flex;flex-direction:column;gap:3px">
            <div class="sb-ticker-label">${pLabel}</div>
            <div class="sb-ticker-value">${clockStr}</div>
          </div>
        </div>`;
      });
      // Switch ticker to block layout so the inner flex can overflow freely
      ticker.style.display = 'block';
      const tileWidth = 'clamp(220px,22vw,340px)';
      ticker.innerHTML = `<div style="display:flex;height:100%;align-items:stretch;flex-wrap:nowrap;width:max-content;min-width:100%">${tiles.join('')}</div>`;
    } else {
      // Restore grid for penalty/powerplay layout
      ticker.style.display = 'grid';
      // Accent stripes
      ticker.innerHTML = `
        <div class="sb-ticker-cell cell-left"
          style="${homePen ? `border-left:3px solid ${hc}` : ''}">
          ${leftHtml}
        </div>
        <div class="sb-ticker-cell cell-mid">
          ${midHtml}
        </div>
        <div class="sb-ticker-cell cell-right"
          style="${awayPen ? `border-right:3px solid ${ac}` : ''}">
          ${rightHtml}
        </div>`;
    }
  }

  // Overlays
  const toOv = document.getElementById('sb-timeout-overlay');
  if (s.activeTimeout) {
    toOv.classList.add('visible');
    setText('sb-timeout-team-label', s.activeTimeout.team==='home' ? s.homeName : s.awayName);
    setText('sb-timeout-count', fmt(s.activeTimeout.remaining));
  } else {
    toOv.classList.remove('visible');
  }
  const pauseOv = document.getElementById('sb-pause-overlay');
  if (s.pause) {
    pauseOv.classList.add('visible');
    setText('sb-pause-count', fmt(s.pause.remaining));
    const nextPn3 = ['2. DRITTEL','3. DRITTEL','VERLÄNGERUNG'];
    const nextPn2 = ['2. HALBZEIT','VERLÄNGERUNG'];
    setText('sb-pause-next-label', 'WEITER: ' + ((s.maxPeriods===3?nextPn3:nextPn2)[s.period-1]||''));
  } else {
    pauseOv.classList.remove('visible');
  }
  // Penalty shootout overlay
  renderPenaltyShootoutSb(s);
}


function renderSbPenalties(side, pens, fmt) {
  const c = document.getElementById('sb-' + side + '-penalties');
  const typeLabel = (secs, p) => { if (p&&p.redCardLabel) return p.redCardLabel+' 2+2'; if (p&&p.doubleFirst) return '2+2 MIN (1)'; if (p&&p.doubleSecond) return '2+2 MIN (2)'; if (p&&p.waiting) return '2+2 MIN (2)'; if (p&&p.personal) return '10 MIN PERS.'; return secs<=120?'2 MIN':'10 MIN'; };

  if (!pens || !pens.length) { c.innerHTML = ''; return; }

  // index existing
  const existing = {};
  c.querySelectorAll('.sb-penalty[data-id]').forEach(el => { existing[el.dataset.id] = el; });
  const currentIds = new Set(pens.map(p => String(p.id)));

  // remove stale
  Object.keys(existing).forEach(id => { if (!currentIds.has(id)) existing[id].remove(); });

  // update or create
  pens.forEach(p => {
    const idStr = String(p.id);
    if (existing[idStr]) {
      existing[idStr].querySelector('.sb-pen-time').textContent = fmt(p.remaining);
    } else {
      const el = document.createElement('div');
      el.className = 'sb-penalty';
      el.dataset.id = idStr;
      el.innerHTML = `
        <div class="sb-pen-num">#${p.number}</div>
        <div class="sb-pen-time">${fmt(p.remaining)}</div>
        <div class="sb-pen-type">${typeLabel(p.secs, p)}</div>
      `;
      c.appendChild(el);
    }
  });
}

function triggerGoal(side, el, teamName, s) {
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');

  if (!s || s.goalAnimEnabled === false) return;

  const ov   = document.getElementById('sb-goal-overlay');
  const txt  = document.getElementById('sb-goal-text');
  const slide = document.getElementById('sb-goal-scorer-slide');
  const color = side === 'home' ? (s_colors.home||'#c8ff00') : (s_colors.away||'#22c55e');

  // Reset both
  txt.classList.remove('animating');
  slide.classList.remove('animating');
  void txt.offsetWidth;

  txt.textContent = 'TOR!';
  txt.style.color = color;
  txt.classList.add('animating');
  slide.style.display = 'none';

  ov.classList.add('visible');
  clearTimeout(goalTimer);
  clearTimeout(scorerTimer);

  // After TOR! fades out, show scorer slide (if events on and data available)
  goalTimer = setTimeout(() => {
    txt.classList.remove('animating');

    const pg       = s.pendingGoal || {};
    const goalData = pg.goalType !== undefined ? pg
                   : (s.events && s.events[0] && s.events[0].type === 'goal' ? s.events[0].data : null);

    const isOwn     = goalData && goalData.goalType === 'own';
    const isPenalty = goalData && goalData.goalType === 'penalty';
    const hasSlide  = s.showEventsTab && goalData && (isOwn || isPenalty || goalData.scorer || goalData.assist);

    if (hasSlide) {
      const scorerNum = document.getElementById('sb-goal-scorer-num');
      const assistRow = document.getElementById('sb-goal-assist-row');
      const assistNum = document.getElementById('sb-goal-assist-num');
      const scorerLbl = document.getElementById('sb-goal-scorer-label');

      if (isOwn) {
        scorerLbl.textContent = `EIGENTOR · ${teamName}`;
        scorerLbl.style.color = color;
        scorerNum.textContent = 'ET';
        scorerNum.style.color = color;
        assistRow.style.display = 'none';
      } else {
        scorerLbl.textContent = isPenalty ? `STRAFSTOSS · ${teamName}` : `TOR · ${teamName}`;
        scorerLbl.style.color = color;
        scorerNum.textContent = goalData.scorer ? `#${goalData.scorer}` : '–';
        scorerNum.style.color = color;
        if (!isPenalty && goalData.assist) {
          assistRow.style.display = 'flex';
          assistNum.textContent   = `#${goalData.assist}`;
        } else {
          assistRow.style.display = 'none';
        }
      }

      void slide.offsetWidth;
      slide.style.display = 'flex';
      slide.classList.add('animating');

      scorerTimer = setTimeout(() => {
        slide.classList.remove('animating');
        slide.style.display = 'none';
        ov.classList.remove('visible');
      }, 3400);
    } else {
      ov.classList.remove('visible');
    }
  }, 2700);
}

// ── Fußleiste (Ticker) ein/ausblenden ──
function toggleTickerVisibility() {
  S.tickerVisible = !S.tickerVisible;
  const knob  = document.getElementById('ct-ticker-vis-knob');
  const tog   = document.getElementById('ct-ticker-vis-toggle');
  const label = document.getElementById('ct-ticker-vis-label');
  const on = S.tickerVisible;
  if (knob)  knob.style.left     = on ? '22px' : '2px';
  if (tog)   tog.style.background = on ? 'var(--lime)' : 'var(--ct-muted)';
  if (label) label.textContent   = on ? 'AN' : 'AUS';
  try { localStorage.setItem('ct-ticker-hidden', on ? '0' : '1'); } catch(e) {}
  pushAndRender();
}

// Restore ticker visibility preference
(function() {
  try {
    if (localStorage.getItem('ct-ticker-hidden') === '1') {
      S.tickerVisible = false;
      const knob  = document.getElementById('ct-ticker-vis-knob');
      const tog   = document.getElementById('ct-ticker-vis-toggle');
      const label = document.getElementById('ct-ticker-vis-label');
      if (knob)  knob.style.left = '2px';
      if (tog)   tog.style.background = 'var(--ct-muted)';
      if (label) label.textContent = 'AUS';
    }
    if (localStorage.getItem('ct-events-tab-on') === '1') {
      S.showEventsTab = true;
      const knob  = document.getElementById('ct-events-tab-knob');
      const tog   = document.getElementById('ct-events-tab-toggle');
      const label = document.getElementById('ct-events-tab-label');
      const btn   = document.getElementById('tab-btn-events');
      if (knob)  knob.style.left = '22px';
      if (tog)   tog.style.background = 'var(--lime)';
      if (label) label.textContent = 'AN';
      if (btn)   btn.style.display = '';
    }
    if (localStorage.getItem('ct-goal-anim-on') === '0') {
      S.goalAnimEnabled = false;
      const knob  = document.getElementById('ct-goal-anim-knob');
      const tog   = document.getElementById('ct-goal-anim-toggle');
      const label = document.getElementById('ct-goal-anim-label');
      if (knob)  knob.style.left = '2px';
      if (tog)   tog.style.background = 'var(--ct-muted)';
      if (label) label.textContent = 'AUS';
    }
    if (localStorage.getItem('ct-jersey-vis') === '1') {
      S.jerseyVisible = true;
      const knob  = document.getElementById('ct-jersey-vis-knob');
      const tog   = document.getElementById('ct-jersey-vis-toggle');
      const label = document.getElementById('ct-jersey-vis-label');
      if (knob)  knob.style.left = '22px';
      if (tog)   tog.style.background = 'var(--lime)';
      if (label) label.textContent = 'AN';
    }
  } catch(e) {}
})();

// ── Events Tab Toggle ──
function toggleEventsTab() {
  S.showEventsTab = !S.showEventsTab;
  const knob  = document.getElementById('ct-events-tab-knob');
  const tog   = document.getElementById('ct-events-tab-toggle');
  const label = document.getElementById('ct-events-tab-label');
  const btn   = document.getElementById('tab-btn-events');
  const on = S.showEventsTab;
  if (knob)  knob.style.left = on ? '22px' : '2px';
  if (tog)   tog.style.background = on ? 'var(--lime)' : 'var(--ct-muted)';
  if (label) label.textContent = on ? 'AN' : 'AUS';
  if (btn)   btn.style.display = on ? '' : 'none';
  try { localStorage.setItem('ct-events-tab-on', on ? '1' : '0'); } catch(e) {}
}

// ── Jersey Visibility Toggle ──
function toggleJerseyVis() {
  S.jerseyVisible = !S.jerseyVisible;
  const knob  = document.getElementById('ct-jersey-vis-knob');
  const tog   = document.getElementById('ct-jersey-vis-toggle');
  const label = document.getElementById('ct-jersey-vis-label');
  const on = S.jerseyVisible;
  if (knob)  knob.style.left      = on ? '22px' : '2px';
  if (tog)   tog.style.background  = on ? 'var(--lime)' : 'var(--ct-muted)';
  if (label) label.textContent    = on ? 'AN' : 'AUS';
  try { localStorage.setItem('ct-jersey-vis', on ? '1' : '0'); } catch(e) {}
  pushAndRender();
}

// ── Goal Animation Toggle ──
function toggleGoalAnim() {
  S.goalAnimEnabled = !S.goalAnimEnabled;
  const knob  = document.getElementById('ct-goal-anim-knob');
  const tog   = document.getElementById('ct-goal-anim-toggle');
  const label = document.getElementById('ct-goal-anim-label');
  const on = S.goalAnimEnabled;
  if (knob)  knob.style.left = on ? '22px' : '2px';
  if (tog)   tog.style.background = on ? 'var(--lime)' : 'var(--ct-muted)';
  if (label) label.textContent = on ? 'AN' : 'AUS';
  try { localStorage.setItem('ct-goal-anim-on', on ? '1' : '0'); } catch(e) {}
  pushAndRender();
}
function fmtClock(secs) {
  const m = Math.floor(Math.abs(secs)/60).toString().padStart(2,'0');
  const s = (Math.abs(secs)%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function logEvent(type, side, data, _id) {
  if (!S.showEventsTab) return;
  const ev = {
    id: _id || Date.now(),
    type,   // 'goal' | 'penalty' | 'timeout'
    side,   // 'home' | 'away' | 'neutral'
    clock: S.clock,
    period: S.period,
    data,   // { scorer, assist, number, penType, team }
  };
  S.events.unshift(ev); // newest first
  renderEvents();
}

function clearEvents() {
  ctConfirm({
    icon: '🗑',
    title: 'Ereignisse löschen?',
    body: 'Alle Spielereignisse werden unwiderruflich gelöscht.',
    okLabel: 'Löschen',
    onOk: () => { S.events = []; renderEvents(); },
  });
}

function deleteEvent(id) {
  S.events = S.events.filter(e => e.id !== id);
  renderEvents();
}

function renderEvents() {
  const list = document.getElementById('ct-events-list');
  if (!list) return;
  if (!S.events.length) {
    list.innerHTML = '<div style="color:var(--ct-muted2);font-size:12px;text-align:center;margin-top:24px">Noch keine Ereignisse</div>';
    return;
  }
  const periodName = p => {
    if (S.maxPeriods === 3) return ['1. DRITTEL','2. DRITTEL','3. DRITTEL','VERLÄNGERUNG'][p-1] || `P${p}`;
    return ['1. HALBZEIT','2. HALBZEIT','VERLÄNGERUNG'][p-1] || `P${p}`;
  };
  list.innerHTML = S.events.map(ev => {
    const sideClass = ev.side === 'home' ? 'ev-home' : ev.side === 'away' ? 'ev-away' : 'ev-neutral';
    const timeStr   = `${fmtClock(ev.clock)}<br><span style="font-size:9px;font-weight:400">${periodName(ev.period)}</span>`;
    let icon, main, sub;
    if (ev.type === 'goal') {
      const teamName = ev.side === 'home' ? S.homeName : S.awayName;
      icon = '<span class="ph-icon ph-lg"><svg><use href="#ph-flag-pennant"/></svg></span>';
      if (ev.data.goalType === 'own') {
        main = `EIGENTOR · ${teamName}`;
        sub  = 'ET';
      } else {
        main = `TOR · ${teamName}`;
        if (ev.data.goalType === 'penalty') main += ' <span style="font-size:10px;opacity:.5;letter-spacing:1px">· STRAFSTOSS</span>';
        const parts = [];
        if (ev.data.scorer) parts.push(`#${ev.data.scorer}`);
        if (ev.data.assist) parts.push(`Vorlage: #${ev.data.assist}`);
        sub = parts.join(' · ') || '–';
      }
    } else if (ev.type === 'penalty') {
      const teamName = ev.side === 'home' ? S.homeName : S.awayName;
      icon = '<span class="ph-icon ph-lg"><svg><use href="#ph-warning-circle"/></svg></span>';
      main = `STRAFE · ${teamName}`;
      sub = `#${ev.data.number} · ${ev.data.penType}` + (ev.data.penReason ? ` · ${ev.data.penReason}` : '');
    } else if (ev.type === 'timeout') {
      const teamName = ev.side === 'home' ? S.homeName : S.awayName;
      icon = '<span class="ph-icon ph-lg"><svg><use href="#ph-hourglass-medium"/></svg></span>';
      main = `AUSZEIT · ${teamName}`;
      sub = '';
    }
    return `<div class="ct-event-item ${sideClass}">
      <div class="ev-time">${timeStr}</div>
      <div class="ev-icon">${icon}</div>
      <div style="flex:1"><div class="ev-main">${main}</div>${sub ? `<div class="ev-sub">${sub}</div>` : ''}</div>
      <div class="ev-del" onclick="deleteEvent(${ev.id})">✕</div>
    </div>`;
  }).join('');
}

// ── Goal Dialog ──
let _goalDialogSide = null;
let _pendingGoalSide = null;
let _goalType = null; // null | 'penalty' | 'own'

function setGoalType(type) {
  _goalType = _goalType === type ? null : type; // toggle off if same clicked again
  const btnP = document.getElementById('ct-goal-btn-penalty');
  const btnO = document.getElementById('ct-goal-btn-own');
  const scorerWrap = document.getElementById('ct-goal-scorer-wrap');
  const assistWrap = document.getElementById('ct-goal-assist-wrap');

  btnP.classList.toggle('active', _goalType === 'penalty');
  btnO.classList.toggle('active', _goalType === 'own');

  if (_goalType === 'own') {
    scorerWrap.style.display = 'none';
    assistWrap.style.display = 'none';
  } else if (_goalType === 'penalty') {
    scorerWrap.style.display = '';
    assistWrap.style.display = 'none';
  } else {
    scorerWrap.style.display = '';
    assistWrap.style.display = '';
  }
}

function openGoalDialog(side) {
  _goalDialogSide = side;
  _goalType = null;
  const title = document.getElementById('ct-goal-dialog-title');
  const teamName = side === 'home' ? S.homeName : S.awayName;
  if (title) title.textContent = `TOR · ${teamName}`;
  document.getElementById('ct-goal-scorer').value = '';
  document.getElementById('ct-goal-assist').value = '';
  document.getElementById('ct-goal-btn-penalty').classList.remove('active');
  document.getElementById('ct-goal-btn-own').classList.remove('active');
  document.getElementById('ct-goal-scorer-wrap').style.display = '';
  document.getElementById('ct-goal-assist-wrap').style.display = '';
  document.getElementById('ct-goal-dialog').classList.add('open');
  setTimeout(() => document.getElementById('ct-goal-scorer').focus(), 50);
}

function closeGoalDialog() {
  document.getElementById('ct-goal-dialog').classList.remove('open');
  _goalDialogSide = null;
  _pendingGoalSide = null;
  _goalType = null;
}

function confirmGoal() {
  if (!_goalDialogSide) return;
  const side = _goalDialogSide;

  let scorer, assist, goalTypeLabel;
  if (_goalType === 'own') {
    scorer = null; assist = null; goalTypeLabel = 'ET';
  } else if (_goalType === 'penalty') {
    scorer = document.getElementById('ct-goal-scorer').value.trim();
    assist = null; goalTypeLabel = 'Strafstoß';
  } else {
    scorer = document.getElementById('ct-goal-scorer').value.trim();
    assist = document.getElementById('ct-goal-assist').value.trim();
    goalTypeLabel = null;
  }

  // Apply score, store as pending
  const _goalEventId = Date.now();
  pushUndo(`Tor ${side === 'home' ? S.homeName : S.awayName}`, {
    type: 'goal', side,
    prevScore: side === 'home' ? S.homeScore : S.awayScore,
    prevPendingGoal: S.pendingGoal,
    eventId: _goalEventId,
  });
  if (side === 'home') S.homeScore = Math.max(0, S.homeScore + 1);
  else                 S.awayScore = Math.max(0, S.awayScore + 1);

  if (S.period > S.maxPeriods) {
    // Golden Goal in VL – kein Bully, kein pendingGoal
    logEvent('goal', side, { scorer, assist, goalType: _goalType, goalTypeLabel }, _goalEventId);
    pushAndRender();
    const capturedSide = side;
    const capturedGoalType = _goalType;
    closeGoalDialog();
    _pendingGoalSide = null;
    setTimeout(() => {
      checkGoldenGoal(capturedSide);
      checkPowerPlayPenalty(capturedSide, capturedGoalType);
    }, 50);
    return;
  }

  S.pendingGoal = { side, scorer, assist, goalType: _goalType };

  logEvent('goal', side, { scorer, assist, goalType: _goalType, goalTypeLabel }, _goalEventId);
  pushAndRender();
  const capturedGoalType = _goalType; // save before closeGoalDialog clears it
  closeGoalDialog();
  _pendingGoalSide = null;

  // Check power play penalty removal (after dialog closes so modals don't stack)
  setTimeout(() => checkPowerPlayPenalty(side, capturedGoalType), 50);
}

// ── Ticker: render last events ──
function renderTickerEvents(ticker, s) {
  if (!s.showEventsTab || !s.events || !s.events.length) return false;
  // Show last 3 events (skip if there are active penalties/timeouts shown)
  const recent = s.events.slice(0, 3);
  const hc = s.homeAccent || '#c8ff00';
  const ac = s.awayAccent || '#22c55e';
  const cells = recent.map(ev => {
    const color = ev.side === 'home' ? hc : ev.side === 'away' ? ac : 'rgba(255,255,255,.6)';
    const teamName = ev.side === 'home' ? s.homeName : ev.side === 'away' ? s.awayName : '';
    if (ev.type === 'goal') {
      const isOwn     = ev.data.goalType === 'own';
      const isPenalty = ev.data.goalType === 'penalty';
      const label     = isOwn ? `EIGENTOR · ${teamName}` : isPenalty ? `STRAFSTOSS · ${teamName}` : `TOR · ${teamName}`;
      const sub       = isOwn ? 'ET'
                      : [ev.data.scorer ? `#${ev.data.scorer}` : '', !isPenalty && ev.data.assist ? `▶ #${ev.data.assist}` : ''].filter(Boolean).join(' ');
      return `<div class="sb-ticker-cell cell-${ev.side}">
        <div><div class="sb-ticker-label">${label}</div>
        <div class="sb-ticker-value">${sub || '–'}</div></div>
        <div class="sb-ticker-accent" style="color:${color}"><span class="ph-icon ph-md"><svg><use href="#ph-flag-pennant"/></svg></span></div>
      </div>`;
    } else if (ev.type === 'penalty') {
      return `<div class="sb-ticker-cell cell-${ev.side}">
        <div><div class="sb-ticker-label">STRAFE · ${teamName}</div>
        <div class="sb-ticker-value">#${ev.data.number} · ${ev.data.penReason || ev.data.penType}</div></div>
        <div class="sb-ticker-accent" style="color:${color}"><span class="ph-icon ph-md"><svg><use href="#ph-warning-circle"/></svg></span></div>
      </div>`;
    } else if (ev.type === 'timeout') {
      return `<div class="sb-ticker-cell cell-neutral">
        <div><div class="sb-ticker-label">AUSZEIT</div>
        <div class="sb-ticker-value">${teamName}</div></div>
        <div class="sb-ticker-accent" style="color:var(--orange,#ff9500)"><span class="ph-icon ph-md"><svg><use href="#ph-hourglass-medium"/></svg></span></div>
      </div>`;
    }
    return '';
  }).filter(Boolean);
  if (cells.length) {
    ticker.insertAdjacentHTML('beforeend', cells.join(''));
    return true;
  }
  return false;
}

// ── Penalty Shootout ──
const PS_SHOTS = 5; // shots per round

function startPenaltyShootout() {
  S.penaltyShootout = {
    active: true,
    shots: Array.from({length: PS_SHOTS}, () => ({ home: null, away: null, homeNum: '', awayNum: '' })),
    round: 1,
  };
  document.getElementById('ct-ps-start-wrap').style.display = 'none';
  document.getElementById('ct-ps-active-wrap').style.display = '';
  document.getElementById('ct-ps-overlay').classList.add('open');
  renderPenaltyShootoutCtrl();
  pushAndRender();
}

function resetPenaltyShootout() {
  ctConfirm({
    icon: '↺',
    title: 'Penaltyschießen neu?',
    body: 'Alle eingetragenen Schüsse werden zurückgesetzt.',
    okLabel: 'Neu starten',
    okClass: 'btn-orange',
    onOk: () => {
      S.penaltyShootout = {
        active: true,
        shots: Array.from({length: PS_SHOTS}, () => ({ home: null, away: null, homeNum: '', awayNum: '' })),
        round: 1,
      };
      renderPenaltyShootoutCtrl();
      pushAndRender();
    },
  });
}

function endPenaltyShootout() {
  ctConfirm({
    icon: '✕',
    title: 'Penaltyschießen beenden?',
    body: 'Das Penaltyschießen wird beendet und aus der Anzeige entfernt.',
    okLabel: 'Beenden',
    onOk: () => {
      S.penaltyShootout = null;
      document.getElementById('ct-ps-overlay').classList.remove('open');
      document.getElementById('ct-ps-start-wrap').style.display = '';
      document.getElementById('ct-ps-active-wrap').style.display = 'none';
      pushAndRender();
    },
  });
}

function setPsShot(idx, side, val) {
  const ps = S.penaltyShootout;
  if (!ps) return;
  // Extend shots array if needed (for extra rounds)
  while (ps.shots.length <= idx) ps.shots.push({ home: null, away: null });
  // Toggle: clicking same value clears it
  ps.shots[idx][side] = ps.shots[idx][side] === val ? null : val;
  // Check if we need to add more shots (ongoing shootout beyond round 1)
  checkPsExtraRound();
  renderPenaltyShootoutCtrl();
  pushAndRender();
}

function checkPsExtraRound() {
  const ps = S.penaltyShootout;
  if (!ps) return;
  const n = ps.shots.length;
  const { homeGoals, awayGoals, homeDone, awayDone } = calcPsState(ps);
  // All shots in current set done?
  const allDone = ps.shots.every(s => s.home !== null && s.away !== null);
  if (allDone && homeGoals === awayGoals) {
    // Still tied — add one more shot per team
    ps.shots.push({ home: null, away: null, homeNum: '', awayNum: '' });
    ps.round = Math.floor(ps.shots.length / PS_SHOTS) + 1;
  }
}

function calcPsState(ps) {
  let homeGoals = 0, awayGoals = 0, homeDone = 0, awayDone = 0;
  ps.shots.forEach(s => {
    if (s.home !== null) { homeDone++; if (s.home) homeGoals++; }
    if (s.away !== null) { awayDone++; if (s.away) awayGoals++; }
  });
  const n = ps.shots.length;
  // Check for early decision
  let winner = null;
  const homeRemaining = n - homeDone;
  const awayRemaining = n - awayDone;
  if (homeGoals > awayGoals + awayRemaining) winner = 'home';
  else if (awayGoals > homeGoals + homeRemaining) winner = 'away';
  else if (homeDone === n && awayDone === n && homeGoals !== awayGoals) {
    winner = homeGoals > awayGoals ? 'home' : 'away';
  }
  return { homeGoals, awayGoals, homeDone, awayDone, winner };
}

function setPsNum(idx, side, val) {
  const ps = S.penaltyShootout;
  if (!ps || !ps.shots[idx]) return;
  ps.shots[idx][side + 'Num'] = val;
  // no pushAndRender – numbers are local only, just keep in state
}

function renderPenaltyShootoutCtrl() {
  const ps = S.penaltyShootout;
  if (!ps) return;
  const { homeGoals, awayGoals, winner } = calcPsState(ps);
  const hc = S.homeAccent || '#c8ff00';
  const ac = S.awayAccent || '#22c55e';
  const homeName = S.homeName || 'HEIM';
  const awayName = S.awayName || 'GAST';

  // Mini card scores
  const setEl = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('ct-ps-home-score', homeGoals);
  setEl('ct-ps-away-score', awayGoals);
  setEl('ct-ps-home-label', homeName);
  setEl('ct-ps-away-label', awayName);

  // Overlay scores
  setEl('ct-ps-ov-home-score', homeGoals);
  setEl('ct-ps-ov-away-score', awayGoals);
  setEl('ct-ps-ov-home-label', homeName);
  setEl('ct-ps-ov-away-label', awayName);

  // Build shot grid (overlay)
  const buildGrid = (containerId) => {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = `
      <div class="ps-team-col">
        <div class="ps-team-head" style="color:${hc}">${homeName}</div>
        <div class="ps-shots">
          ${ps.shots.map((s, i) => `
            <div class="ps-shot">
              <div class="ps-shot-label">${i+1}</div>
              <input class="ps-shot-num" type="number" min="1" max="99" placeholder="#" value="${s.homeNum||''}"
                oninput="setPsNum(${i},'home',this.value)" title="Spielernummer">
              <div class="ps-shot-btns">
                <div class="ps-shot-btn ${s.home === true  ? 'goal' : ''}" onclick="setPsShot(${i},'home',true)">✓</div>
                <div class="ps-shot-btn ${s.home === false ? 'miss' : ''}" onclick="setPsShot(${i},'home',false)">✕</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="ps-team-col">
        <div class="ps-team-head" style="color:${ac}">${awayName}</div>
        <div class="ps-shots">
          ${ps.shots.map((s, i) => `
            <div class="ps-shot">
              <div class="ps-shot-btns">
                <div class="ps-shot-btn ${s.away === true  ? 'goal' : ''}" onclick="setPsShot(${i},'away',true)">✓</div>
                <div class="ps-shot-btn ${s.away === false ? 'miss' : ''}" onclick="setPsShot(${i},'away',false)">✕</div>
              </div>
              <input class="ps-shot-num" type="number" min="1" max="99" placeholder="#" value="${s.awayNum||''}"
                oninput="setPsNum(${i},'away',this.value)" title="Spielernummer">
              <div class="ps-shot-label" style="text-align:right">${i+1}</div>
            </div>`).join('')}
        </div>
      </div>`;
  };
  buildGrid('ct-ps-ov-grid');

  // Winner badge (mini card)
  const badge = document.getElementById('ct-ps-winner');
  if (badge) {
    if (winner) {
      const name = winner === 'home' ? homeName : awayName;
      const color = winner === 'home' ? hc : ac;
      badge.textContent = `★ ${name} GEWINNT`;
      badge.style.color = color; badge.style.borderColor = color;
      badge.style.background = `rgba(${winner==='home'?'200,255,0':'34,197,94'},.08)`;
      badge.classList.add('visible');
    } else { badge.classList.remove('visible'); }
  }
  // Winner badge (overlay header)
  const ovBadge = document.getElementById('ct-ps-ov-winner-badge');
  if (ovBadge) {
    if (winner) {
      const name = winner === 'home' ? homeName : awayName;
      const color = winner === 'home' ? hc : ac;
      ovBadge.textContent = `★ ${name} GEWINNT`;
      ovBadge.style.color = color; ovBadge.style.borderColor = color;
      ovBadge.style.display = '';
    } else { ovBadge.style.display = 'none'; }
  }
}

function renderPenaltyShootoutSb(s) {
  const ov = document.getElementById('sb-penalty-overlay');
  if (!ov) return;
  if (!s.penaltyShootout || !s.penaltyShootout.active) {
    ov.classList.remove('visible');
    return;
  }
  ov.classList.add('visible');
  const ps = s.penaltyShootout;
  const hc = s.homeAccent || '#c8ff00';
  const ac = s.awayAccent || '#22c55e';
  const { homeGoals, awayGoals, winner } = calcPsState(ps);
  const shotsDone = Math.max(ps.shots.filter(s => s.home !== null).length, ps.shots.filter(s => s.away !== null).length);
  const currentShot = Math.min(shotsDone + 1, ps.shots.length);
  const isExtra = ps.shots.length > PS_SHOTS;
  const roundLabel = isExtra
    ? `ZUSATZRUNDE ${ps.shots.length - PS_SHOTS + 1}`
    : winner ? `ABGESCHLOSSEN` : `SCHUSS ${currentShot} / ${PS_SHOTS}`;
  document.getElementById('sb-ps-round').textContent = roundLabel;
  document.getElementById('sb-ps-home-name').textContent = s.homeName || 'HEIMTEAM';
  document.getElementById('sb-ps-away-name').textContent = s.awayName || 'GASTTEAM';
  document.getElementById('sb-ps-home-score').textContent = homeGoals;
  document.getElementById('sb-ps-away-score').textContent = awayGoals;
  const homeDots = document.getElementById('sb-ps-home-dots');
  const nextHomeIdx = ps.shots.findIndex(x => x.home === null);
  homeDots.innerHTML = ps.shots.map((shot, i) => {
    let cls = 'pending';
    if (shot.home === true)  cls = 'goal';
    else if (shot.home === false) cls = 'miss';
    else if (i === nextHomeIdx) cls = 'current';
    return `<div class="sb-ps-dot ${cls}" style="color:${hc}"></div>`;
  }).join('');

  // Dots away
  const awayDots = document.getElementById('sb-ps-away-dots');
  const nextAwayIdx = ps.shots.findIndex(x => x.away === null);
  awayDots.innerHTML = ps.shots.map((shot, i) => {
    let cls = 'pending';
    if (shot.away === true)  cls = 'goal';
    else if (shot.away === false) cls = 'miss';
    else if (i === nextAwayIdx) cls = 'current';
    return `<div class="sb-ps-dot ${cls}" style="color:${ac}"></div>`;
  }).join('');

  // Winner
  const winnerEl = document.getElementById('sb-ps-winner-text');
  if (winner) {
    const name = winner === 'home' ? s.homeName : s.awayName;
    const color = winner === 'home' ? hc : ac;
    winnerEl.textContent = `★ ${name} GEWINNT`;
    winnerEl.style.color = color;
    winnerEl.style.textShadow = `0 0 60px ${color}`;
    winnerEl.classList.add('visible');
  } else {
    winnerEl.classList.remove('visible');
  }
}

// ── SAISONMANAGER IMPORT ────────────────────────────────────────────

let smPendingGame = null; // holds parsed API data until user confirms



