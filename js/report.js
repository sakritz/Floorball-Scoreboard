/* ── Floorball Scoreboard · Spielbericht-Export ───────────────────────
   Erzeugt aus dem State S einen Spielbericht und exportiert ihn als
   PDF (Druck), Markdown (Zwischenablage) oder JSON (Datei).
   Reines Controller-Feature. Benötigt: S; optional calcPsState, ctAlert.
   Muss nach render.js / controller.js geladen werden.
──────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const pad  = n => String(n).padStart(2, '0');
  const mmss = secs => { const s = Math.max(0, secs); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

  function periodName(p) {
    const mp = S.maxPeriods === 2 ? 2 : 3;
    if (p > mp) return 'Verlängerung';
    if (mp === 2) return p === 1 ? '1. Halbzeit' : '2. Halbzeit';
    return p === 1 ? '1. Drittel' : p === 2 ? '2. Drittel' : '3. Drittel';
  }

  // Gespielte Zeit im Abschnitt aus der Restzeit (Events speichern Restsekunden).
  const elapsed = clock => mmss((S.periodSecs || 1200) - clock);

  function fmtDateTime(ms) {
    if (!ms) return null;
    try {
      return new Date(ms).toLocaleString('de-DE',
        { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return null; }
  }

  function formatLabel() {
    const mp  = S.maxPeriods === 2 ? 2 : 3;
    const min = Math.round((S.periodSecs || 1200) / 60);
    return `${mp} × ${min} Min`;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Strukturierte Berichtsdaten (auch Basis für JSON) ── */
  function buildReportData() {
    // Chronologisch: nach Abschnitt, dann nach gespielter Zeit (mehr Restzeit = früher).
    const evs = (S.events || []).slice().sort((a, b) => (a.period - b.period) || (b.clock - a.clock));
    const teamName = side => side === 'home' ? S.homeName : side === 'away' ? S.awayName : '—';
    const base = e => ({
      period: e.period, periodName: periodName(e.period), time: elapsed(e.clock),
      side: e.side, team: teamName(e.side),
    });

    const goals = evs.filter(e => e.type === 'goal').map(e => Object.assign(base(e), {
      scorer: (e.data && e.data.scorer) || null,
      assist: (e.data && e.data.assist) || null,
      kind:   (e.data && e.data.goalType) || null,   // 'penalty' | 'own' | null
    }));
    const penalties = evs.filter(e => e.type === 'penalty').map(e => Object.assign(base(e), {
      number:  (e.data && e.data.number)  || '?',
      penType: (e.data && e.data.penType) || '2 MIN',
    }));
    const timeouts = evs.filter(e => e.type === 'timeout').map(e => base(e));

    // Vereinheitlichte, chronologische Timeline (alle Ereignisse nach Zeit) mit laufendem Spielstand.
    let _h = 0, _a = 0;
    const timeline = evs.map(e => {
      const sec = Math.max(0, (S.periodSecs || 1200) - e.clock);
      const t = { type: e.type, period: e.period, periodName: periodName(e.period), sec, time: mmss(sec), side: e.side, team: teamName(e.side) };
      if (e.type === 'goal') {
        if (e.side === 'home') _h++; else if (e.side === 'away') _a++;
        t.scorer = (e.data && e.data.scorer) || null;
        t.assist = (e.data && e.data.assist) || null;
        t.kind   = (e.data && e.data.goalType) || null;
        t.scoreHome = _h; t.scoreAway = _a;
      } else if (e.type === 'penalty') {
        t.number  = (e.data && e.data.number)  || '?';
        t.penType = (e.data && e.data.penType) || '2 MIN';
      }
      return t;
    });

    let shootout = null;
    const ps = S.penaltyShootout;
    if (ps && ps.shots && ps.shots.length) {
      const st = (typeof calcPsState === 'function') ? calcPsState(ps) : null;
      shootout = {
        homeGoals: st ? st.homeGoals : null,
        awayGoals: st ? st.awayGoals : null,
        winner:    st ? st.winner    : null,
        shots: ps.shots.map((s, i) => ({
          round: i + 1,
          homeNum: s.homeNum || '', awayNum: s.awayNum || '',
          home: s.home, away: s.away,   // true=Tor, false=verschossen, null=offen
        })),
      };
    }

    return {
      schema: 'floorball-spielbericht/1',
      meta: {
        league:      S.leagueName || null,
        kickoff:     fmtDateTime(S.kickoffTime),
        format:      formatLabel(),
        generatedAt: fmtDateTime(Date.now()),
      },
      home: { name: S.homeName, score: S.homeScore, accent: S.homeAccent, logo: S.homeLogo || null },
      away: { name: S.awayName, score: S.awayScore, accent: S.awayAccent, logo: S.awayLogo || null },
      result: { home: S.homeScore, away: S.awayScore, decidedByShootout: !!shootout },
      timeoutsUsed: { home: !!S.homeToUsed, away: !!S.awayToUsed },
      counts: {
        goalsHome:     goals.filter(g => g.side === 'home').length,
        goalsAway:     goals.filter(g => g.side === 'away').length,
        penaltiesHome: penalties.filter(p => p.side === 'home').length,
        penaltiesAway: penalties.filter(p => p.side === 'away').length,
      },
      timeline, goals, penalties, timeouts, shootout,
    };
  }

  /* ── Markdown ── */
  function reportMarkdown(d) {
    const L = [];
    const sym = v => v === true ? 'Tor' : v === false ? 'verschossen' : '–';

    L.push('# Spielbericht', '');
    if (d.meta.league)  L.push(`**Liga / Wettbewerb:** ${d.meta.league}`);
    if (d.meta.kickoff) L.push(`**Anpfiff:** ${d.meta.kickoff}`);
    L.push(`**Format:** ${d.meta.format}`);
    if (d.meta.generatedAt) L.push(`**Erstellt:** ${d.meta.generatedAt}`);
    L.push('', '## Endstand', '');
    L.push(`**${d.home.name} ${d.result.home} : ${d.result.away} ${d.away.name}**`
      + (d.result.decidedByShootout ? '  _(nach Penaltyschießen)_' : ''));

    // Chronologischer Spielverlauf (alle Ereignisse nach Zeit, je Abschnitt)
    L.push('', '## Spielverlauf', '');
    if (d.timeline.length) {
      const periods = [...new Set(d.timeline.map(t => t.period))].sort((x, y) => x - y);
      periods.forEach(p => {
        L.push(`### ${periodName(p)}`, '');
        L.push('| Zeit | Team | Ereignis | Details | Stand |', '|---|---|---|---|---|');
        d.timeline.filter(t => t.period === p).forEach(t => {
          let ereignis = '', details = '–', stand = '';
          if (t.type === 'goal') {
            ereignis = t.kind === 'own' ? 'Tor (Eigentor)' : t.kind === 'penalty' ? 'Tor (Strafschuss)' : 'Tor';
            const dt = []; if (t.scorer) dt.push('#' + t.scorer); if (t.assist) dt.push('Vorlage #' + t.assist);
            details = dt.join(', ') || '–';
            stand = `${t.scoreHome}:${t.scoreAway}`;
          } else if (t.type === 'penalty') {
            ereignis = `Strafe ${t.penType}`; details = '#' + t.number;
          } else { ereignis = 'Auszeit'; }
          L.push(`| ${t.time} | ${t.team} | ${ereignis} | ${details} | ${stand} |`);
        });
        L.push('');
      });
    } else {
      L.push('_Keine Ereignisse erfasst (Event-Log war nicht aktiv)._', '');
      L.push(`- Auszeit ${d.home.name}: ${d.timeoutsUsed.home ? 'verbraucht' : 'nicht genutzt'}`);
      L.push(`- Auszeit ${d.away.name}: ${d.timeoutsUsed.away ? 'verbraucht' : 'nicht genutzt'}`, '');
    }

    if (d.shootout) {
      const sh = d.shootout;
      L.push('', `## Penaltyschießen (${sh.homeGoals}:${sh.awayGoals})`, '');
      L.push('| # | Heim Nr. | Heim | Gast Nr. | Gast |', '|---|---|---|---|---|');
      sh.shots.forEach(s => L.push(
        `| ${s.round} | ${s.homeNum ? '#' + s.homeNum : '–'} | ${sym(s.home)} | ${s.awayNum ? '#' + s.awayNum : '–'} | ${sym(s.away)} |`));
      if (sh.winner) L.push('', `**Sieger Penaltyschießen:** ${sh.winner === 'home' ? d.home.name : d.away.name}`);
    }

    L.push('', '---', '_Erstellt mit Floorball Scoreboard_');
    return L.join('\n');
  }

  /* ── Timeline-Bausteine (Inline-SVG, da das Druckfenster keine Symbol-Defs hat) ── */
  const ICON_GOAL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#15171c" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="8.6" r="1.1" fill="#15171c" stroke="none"/><circle cx="8.8" cy="13" r="1.1" fill="#15171c" stroke="none"/><circle cx="15.2" cy="13" r="1.1" fill="#15171c" stroke="none"/><circle cx="12" cy="15.4" r="1.1" fill="#15171c" stroke="none"/></svg>';
  const ICON_PEN  = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#15171c" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const ICON_TO   = '<svg viewBox="0 0 24 24" width="13" height="13"><rect x="8" y="7" width="3.2" height="10" rx="1" fill="#15171c"/><rect x="12.8" y="7" width="3.2" height="10" rx="1" fill="#15171c"/></svg>';

  function tlIcon(type) { return type === 'goal' ? ICON_GOAL : type === 'penalty' ? ICON_PEN : ICON_TO; }

  function tlCrest(team) {
    if (team.logo) return `<span class="tl-crest"><img src="${esc(team.logo)}" alt=""></span>`;
    return `<span class="tl-crest"><span class="tl-dot" style="background:${team.accent || '#888'}"></span></span>`;
  }
  function tlTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `<span>${pad(m)}'</span> <span class="s">${pad(s)}"</span>`;
  }
  function tlCard(t) {
    if (t.type === 'goal') {
      const main = `${t.scorer ? `<span class="tl-name">#${esc(t.scorer)}</span> ` : ''}<span class="tl-score">${t.scoreHome}:${t.scoreAway}</span> <span class="tl-type">Tor</span>`;
      const subs = [];
      if (t.kind === 'own')     subs.push('Eigentor');
      if (t.kind === 'penalty') subs.push('Strafschuss');
      if (t.assist)             subs.push(`Vorl. #${esc(t.assist)}`);
      return { main, sub: subs.join(' · ') };
    }
    if (t.type === 'penalty')
      return { main: `<span class="tl-name">#${esc(t.number)}</span> <span class="tl-type">Strafe ${esc(t.penType)}</span>`, sub: '' };
    return { main: '<span class="tl-type">Auszeit</span>', sub: '' };
  }

  function timelineHTML(d) {
    if (!d.timeline.length) {
      return `<p class="empty-note">Keine Ereignisse erfasst (Event-Log war nicht aktiv).</p>
        <ul class="list"><li>${esc(d.home.name)}: Auszeit ${d.timeoutsUsed.home ? 'verbraucht' : 'nicht genutzt'}</li><li>${esc(d.away.name)}: Auszeit ${d.timeoutsUsed.away ? 'verbraucht' : 'nicht genutzt'}</li></ul>`;
    }
    const periods = [...new Set(d.timeline.map(t => t.period))].sort((x, y) => x - y);
    return periods.map(p => {
      const rows = d.timeline.filter(t => t.period === p).map(t => {
        const team   = t.side === 'home' ? d.home : t.side === 'away' ? d.away : { accent: '#888' };
        const c      = tlCard(t);
        const card   = `<div class="tl-card"><div class="tl-text">${c.main}</div>${c.sub ? `<div class="tl-sub">${c.sub}</div>` : ''}</div>`;
        const crest  = tlCrest(team);
        const center = `<div class="tl-center"><div class="tl-node">${tlIcon(t.type)}</div><div class="tl-time">${tlTime(t.sec)}</div></div>`;
        return t.side === 'home'
          ? `<div class="tl-row home"><div class="tl-left">${crest}${card}</div>${center}<div class="tl-right"></div></div>`
          : `<div class="tl-row away"><div class="tl-left"></div>${center}<div class="tl-right">${card}${crest}</div></div>`;
      }).join('');
      return `<h3 class="tl-period">${esc(periodName(p))}</h3><div class="tl"><div class="tl-axis"></div>${rows}</div>`;
    }).join('');
  }

  /* ── Druck-/PDF-Ansicht (heller, offizieller Look) ── */
  function reportPrintHTML(d) {
    const hAccent = d.home.accent || '#c8ff00';
    const aAccent = d.away.accent || '#22c55e';
    const sym = v => v === true ? '✓ Tor' : v === false ? '✗ verschossen' : '–';

    const meta = [];
    if (d.meta.league)  meta.push(esc(d.meta.league));
    if (d.meta.kickoff) meta.push('Anpfiff: ' + esc(d.meta.kickoff));
    meta.push('Format: ' + esc(d.meta.format));

    let psBlock = '';
    if (d.shootout) {
      const sh = d.shootout;
      psBlock = `<h2>Penaltyschießen <span class="sub">${sh.homeGoals}:${sh.awayGoals}</span></h2>
      <table><thead><tr><th>#</th><th>${esc(d.home.name)} Nr.</th><th>${esc(d.home.name)}</th><th>${esc(d.away.name)} Nr.</th><th>${esc(d.away.name)}</th></tr></thead>
      <tbody>${sh.shots.map(s => `<tr><td class="t">${s.round}</td><td>${s.homeNum ? '#' + esc(s.homeNum) : '–'}</td><td>${sym(s.home)}</td><td>${s.awayNum ? '#' + esc(s.awayNum) : '–'}</td><td>${sym(s.away)}</td></tr>`).join('')}</tbody></table>
      ${sh.winner ? `<p class="ps-win">Sieger Penaltyschießen: <strong>${esc(sh.winner === 'home' ? d.home.name : d.away.name)}</strong></p>` : ''}`;
    }

    return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>Spielbericht – ${esc(d.home.name)} vs ${esc(d.away.name)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:#15171c; background:#eef0f3; margin:0; }
  .bar { position:sticky; top:0; display:flex; gap:8px; justify-content:center; padding:12px; background:#fff; border-bottom:1px solid #e3e5ea; }
  .bar button { font:inherit; font-size:13px; font-weight:600; padding:8px 16px; border:1px solid #c7cad1; background:#fff; border-radius:6px; cursor:pointer; }
  .bar button.primary { background:#15171c; color:#fff; border-color:#15171c; }
  .sheet { max-width:780px; margin:18px auto; background:#fff; padding:32px 36px; border:1px solid #e3e5ea; }
  h1 { font-size:13px; letter-spacing:4px; text-transform:uppercase; color:#6b7280; margin:0 0 4px; font-weight:700; }
  .meta { font-size:12px; color:#6b7280; margin:0 0 16px; }
  .score { display:flex; align-items:center; justify-content:center; gap:22px; padding:14px 0 6px; }
  .score .team { font-size:21px; font-weight:800; text-transform:uppercase; letter-spacing:1px; padding:2px 10px 5px; border-bottom:4px solid; max-width:300px; }
  .score .home { text-align:right; }
  .score .nums { font-size:42px; font-weight:800; letter-spacing:2px; white-space:nowrap; }
  .note { text-align:center; font-size:12px; color:#6b7280; margin:0 0 14px; min-height:6px; }
  h2 { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#374151; border-bottom:2px solid #15171c; padding-bottom:4px; margin:22px 0 8px; }
  h2 .sub { float:right; color:#6b7280; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th { text-align:left; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#6b7280; border-bottom:1px solid #c7cad1; padding:5px 8px; }
  td { border-bottom:1px solid #ececef; padding:6px 8px; }
  td.t { font-variant-numeric:tabular-nums; color:#374151; white-space:nowrap; }
  td.empty { color:#9aa0aa; font-style:italic; text-align:center; padding:12px; }
  .list { margin:4px 0 0; padding-left:18px; font-size:12.5px; line-height:1.7; }
  .list .t { font-variant-numeric:tabular-nums; color:#374151; }
  .ps-win { font-size:13px; margin:8px 0 0; }
  .empty-note { color:#9aa0aa; font-style:italic; font-size:12.5px; margin:6px 0; }
  /* Chronologische Timeline */
  .tl-period { font-size:13px; font-weight:800; color:#15171c; margin:16px 0 2px; }
  .tl { position:relative; margin:2px 0 6px; }
  .tl-axis { position:absolute; left:50%; top:8px; bottom:8px; width:2px; background:#e3e5ea; transform:translateX(-50%); }
  .tl-row { position:relative; display:grid; grid-template-columns:1fr 70px 1fr; align-items:center; column-gap:8px; padding:6px 0; }
  .tl-left, .tl-right { display:flex; align-items:center; justify-content:space-between; gap:10px; min-width:0; }
  .tl-row.home .tl-text { text-align:right; }
  .tl-row.away .tl-text { text-align:left; }
  .tl-text { font-size:13px; line-height:1.3; }
  .tl-name { font-weight:700; }
  .tl-score { font-weight:800; margin:0 3px; }
  .tl-type { color:#374151; }
  .tl-sub { font-size:11px; color:#9097a1; margin-top:1px; }
  .tl-crest { width:30px; height:30px; flex:0 0 30px; display:flex; align-items:center; justify-content:center; }
  .tl-crest img { max-width:30px; max-height:30px; object-fit:contain; }
  .tl-dot { width:13px; height:13px; border-radius:50%; }
  .tl-center { display:flex; flex-direction:column; align-items:center; gap:3px; }
  .tl-node { width:25px; height:25px; border-radius:50%; background:#fff; border:1.5px solid #c7cad1; display:flex; align-items:center; justify-content:center; }
  .tl-time { background:#fff; border:1px solid #d7dade; border-radius:12px; padding:1px 7px; font-size:11px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .tl-time .s { color:#9097a1; }
  footer { margin-top:26px; font-size:10.5px; color:#9aa0aa; text-align:center; border-top:1px solid #ececef; padding-top:10px; }
  @media print { .bar { display:none; } body { background:#fff; } .sheet { border:0; margin:0; max-width:none; padding:0; } .tl-row { break-inside:avoid; } }
</style></head>
<body>
  <div class="bar">
    <button class="primary" onclick="window.print()">Drucken / Als PDF speichern</button>
    <button onclick="window.close()">Schließen</button>
  </div>
  <div class="sheet">
    <h1>Spielbericht</h1>
    <p class="meta">${meta.join(' · ')}</p>
    <div class="score">
      <div class="team home" style="border-color:${hAccent}">${esc(d.home.name)}</div>
      <div class="nums">${d.result.home} : ${d.result.away}</div>
      <div class="team away" style="border-color:${aAccent}">${esc(d.away.name)}</div>
    </div>
    <p class="note">${d.result.decidedByShootout ? 'nach Penaltyschießen' : ''}</p>

    <h2>Spielverlauf <span class="sub">${d.result.home} : ${d.result.away}</span></h2>
    ${timelineHTML(d)}

    ${psBlock}

    <footer>Erstellt mit Floorball Scoreboard${d.meta.generatedAt ? ' · ' + esc(d.meta.generatedAt) : ''}</footer>
  </div>
  <script>window.addEventListener('load',function(){setTimeout(function(){try{window.print();}catch(e){}},400);});<\/script>
</body></html>`;
  }

  /* ── Hilfsfunktionen Export ── */
  function filenameBase() {
    const clean = s => (s || 'Team').replace(/[^0-9A-Za-zÄÖÜäöüß-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const dt = new Date();
    return `Spielbericht_${clean(S.homeName)}_vs_${clean(S.awayName)}_${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  function downloadFile(filename, text, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  function copyText(text, okMsg) {
    const ok = () => { if (typeof ctAlert === 'function') ctAlert({ icon: '✓', title: 'Kopiert', body: okMsg }); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(() => copyFallback(text, ok));
    } else copyFallback(text, ok);
  }
  function copyFallback(text, ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      ok();
    } catch (e) {
      const w = window.open('', '_blank');
      if (w) { w.document.write('<pre>' + esc(text) + '</pre>'); w.document.close(); }
    }
  }

  /* ── Öffentliche Aktionen ── */
  function reportExportPDF() {
    const w = window.open('', '_blank');
    if (!w) {
      if (typeof ctAlert === 'function')
        ctAlert({ icon: '⚠', title: 'Popup blockiert', body: 'Bitte Popups für diese Seite erlauben, um den Bericht zu drucken.' });
      return;
    }
    w.document.open();
    w.document.write(reportPrintHTML(buildReportData()));
    w.document.close();
    closeReport();
  }
  function reportCopyMarkdown() {
    copyText(reportMarkdown(buildReportData()), 'Spielbericht als Markdown in der Zwischenablage.');
    closeReport();
  }
  function reportDownloadJSON() {
    downloadFile(filenameBase() + '.json', JSON.stringify(buildReportData(), null, 2), 'application/json');
    closeReport();
  }

  function openReport()  { const m = document.getElementById('ct-report-modal'); if (m) m.classList.add('open'); }
  function closeReport() { const m = document.getElementById('ct-report-modal'); if (m) m.classList.remove('open'); }

  // Global verfügbar machen (Buttons rufen direkt auf)
  window.openReport        = openReport;
  window.closeReport       = closeReport;
  window.reportExportPDF   = reportExportPDF;
  window.reportCopyMarkdown = reportCopyMarkdown;
  window.reportDownloadJSON = reportDownloadJSON;
  window.buildReportData   = buildReportData;
})();
