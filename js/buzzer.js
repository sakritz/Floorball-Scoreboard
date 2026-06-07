/* \u2500\u2500 Floorball Scoreboard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Buzzer-Logik (ben\u00f6tigt: S, saveState)
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/* ─── BUZZER ──────────────────────────────────────────────────────── */
function toggleDir(which) {
  const key = which === 'ctrl' ? 'ctrlCountUp' : 'sbCountUp';
  S[key] = !S[key];
  updateDirToggles();
  pushAndRender();
}

function updateDirToggles() {
  ['ctrl','sb'].forEach(which => {
    const key = which === 'ctrl' ? 'ctrlCountUp' : 'sbCountUp';
    const on  = S[key];
    const tog = document.getElementById('ct-dir-' + which + '-toggle');
    const knob= document.getElementById('ct-dir-' + which + '-knob');
    const lbl = document.getElementById('ct-dir-' + which + '-label');
    if (!tog) return;
    tog.style.background = on ? 'var(--lime)' : 'var(--muted)';
    knob.style.left = on ? '22px' : '2px';
    lbl.textContent  = on ? '↑ HOCH' : '↓ RUNTER';
    lbl.style.color  = on ? 'var(--lime)' : 'var(--white)';
  });
}

// ── BUZZER – langer elektronischer Ton ─────────────────────────────
function buildBuzzerOptions() {} // no-op, no selector needed

function toggleBuzzer() {
  S.buzzerEnabled = !S.buzzerEnabled;
  const toggle = document.getElementById('ct-buzzer-toggle');
  const knob   = document.getElementById('ct-buzzer-knob');
  const label  = document.getElementById('ct-buzzer-label');
  if (S.buzzerEnabled) {
    toggle.style.background = 'var(--lime)';
    knob.style.left = '22px';
    label.textContent = 'AN';
  } else {
    toggle.style.background = 'var(--ct-muted)';
    knob.style.left = '2px';
    label.textContent = 'AUS';
  }
  pushAndRender();
}

function playBuzzer() {
  if (!S.buzzerEnabled) return;
  _playBuzzerSound(S.buzzerSound || 'classic', false);
}

function playBuzzerShort() {
  _playBuzzerSound(S.buzzerSound || 'classic', true);
}

function _playBuzzerSound(type, short) {
  if (type === 'custom') {
    if (!S.buzzerCustomData) return;
    const audio = new Audio(S.buzzerCustomData);
    audio.play().catch(() => {});
    return;
  }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    if (type === 'classic') {
      // Classic electric buzzer: dual square wave, 2.4s / 0.6s
      const dur = short ? 0.6 : 2.4;
      const freqs = [[440, 0.55], [447, 0.45]];
      freqs.forEach(([freq, vol]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'square'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
        g.gain.setValueAtTime(vol, ctx.currentTime + dur - 0.05);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.05);
      });
      setTimeout(() => ctx.close(), (dur + 0.2) * 1000);

    } else if (type === 'horn') {
      // Air horn: sawtooth, rising pitch, long blast or short toot
      const dur = short ? 0.5 : 2.0;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      const dist = ctx.createWaveShaper();
      // Soft distortion curve for horn rasp
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i * 2) / 256 - 1; curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x)); }
      dist.curve = curve;
      osc.connect(dist); dist.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(short ? 200 : 220, ctx.currentTime + dur * 0.3);
      osc.frequency.setValueAtTime(short ? 200 : 220, ctx.currentTime + dur * 0.3);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.03);
      g.gain.setValueAtTime(0.6, ctx.currentTime + dur - 0.1);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.1);
      setTimeout(() => ctx.close(), (dur + 0.3) * 1000);

    } else if (type === 'beep') {
      // Electronic beep: clean sine, 3 short beeps or 1
      const beepDur = 0.12, beepGap = 0.10;
      const count = short ? 1 : 3;
      for (let i = 0; i < count; i++) {
        const t = ctx.currentTime + i * (beepDur + beepGap);
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = 880;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.7, t + 0.01);
        g.gain.setValueAtTime(0.7, t + beepDur - 0.02);
        g.gain.linearRampToValueAtTime(0, t + beepDur);
        osc.start(t); osc.stop(t + beepDur + 0.02);
      }
      setTimeout(() => ctx.close(), (count * (beepDur + beepGap) + 0.2) * 1000);

    } else if (type === 'bell') {
      // Bell: sine + harmonics, natural decay
      const fund = short ? 660 : 523;
      const partials = [[1, 0.7], [2.76, 0.3], [5.4, 0.15], [8.93, 0.08]];
      const dur = short ? 0.9 : 2.5;
      partials.forEach(([ratio, vol]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = fund * ratio;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.05);
      });
      setTimeout(() => ctx.close(), (dur + 0.2) * 1000);
    }
  } catch(e) {}
}

function loadCustomBuzzer(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    alert('Datei zu groß (max. 3 MB). Bitte eine kürzere Audiodatei verwenden.');
    input.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    S.buzzerCustomData = e.target.result;
    S.buzzerSound = 'custom';
    saveState();
    renderBuzzerSoundPicker();
    // Short preview
    const audio = new Audio(S.buzzerCustomData);
    audio.play().catch(() => {});
  };
  reader.readAsDataURL(file);
}

function removeCustomBuzzer() {
  S.buzzerCustomData = null;
  if (S.buzzerSound === 'custom') S.buzzerSound = 'classic';
  saveState();
  renderBuzzerSoundPicker();
}

function setBuzzerSound(type) {
  S.buzzerSound = type;
  saveState();
  renderBuzzerSoundPicker();
  // Play a short preview
  _playBuzzerSound(type, true);
}

function renderBuzzerSoundPicker() {
  const el = document.getElementById('ct-buzzer-sound-picker');
  if (!el) return;
  const current = S.buzzerSound || 'classic';
  const sounds = [
    { id: 'classic', label: 'Classic' },
    { id: 'horn',    label: 'Horn'    },
    { id: 'beep',    label: 'Beep'    },
    { id: 'bell',    label: 'Bell'    },
  ];
  const btnStyle = (id) => `flex:1;padding:6px 4px;font-size:11px;font-weight:900;letter-spacing:1px;
    font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;cursor:pointer;
    border:1px solid ${current === id ? 'var(--lime)' : 'rgba(255,255,255,.12)'};
    background:${current === id ? 'rgba(200,255,0,.15)' : 'rgba(255,255,255,.04)'};
    color:${current === id ? 'var(--lime)' : 'rgba(240,244,255,.6)'};`;

  el.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      ${sounds.map(s => `<button onclick="setBuzzerSound('${s.id}')" style="${btnStyle(s.id)}">${s.label}</button>`).join('')}
    </div>
    <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;
        padding:6px 10px;font-size:11px;font-weight:900;letter-spacing:1px;
        font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;
        border:1px solid ${current === 'custom' ? 'var(--lime)' : 'rgba(255,255,255,.12)'};
        background:${current === 'custom' ? 'rgba(200,255,0,.15)' : 'rgba(255,255,255,.04)'};
        color:${current === 'custom' ? 'var(--lime)' : 'rgba(240,244,255,.6)'};">
        <span>📁</span>
        <span>${S.buzzerCustomData ? 'Eigene Datei' : 'Eigene Datei…'}</span>
        <input type="file" accept="audio/*" onchange="loadCustomBuzzer(this)"
          style="display:none">
      </label>
      ${S.buzzerCustomData ? `<button onclick="removeCustomBuzzer()"
        style="padding:6px 8px;font-size:11px;font-weight:700;letter-spacing:1px;cursor:pointer;
          font-family:'Barlow Condensed',sans-serif;background:transparent;
          border:1px solid rgba(255,45,85,.3);color:rgba(255,45,85,.7);">✕</button>` : ''}
    </div>`;
}

function togglePauseBuzzer() {
  S.pauseBuzzerEnabled = !S.pauseBuzzerEnabled;
  _updateBuzzerToggleUI('ct-pause-buzzer', S.pauseBuzzerEnabled);
  saveState();
}

function toggleTimeoutBuzzer() {
  S.timeoutBuzzerEnabled = !S.timeoutBuzzerEnabled;
  _updateBuzzerToggleUI('ct-timeout-buzzer', S.timeoutBuzzerEnabled);
  saveState();
}

function _updateBuzzerToggleUI(id, enabled) {
  const toggle = document.getElementById(id + '-toggle');
  const knob   = document.getElementById(id + '-knob');
  const label  = document.getElementById(id + '-label');
  if (!toggle) return;
  toggle.style.background = enabled ? 'var(--lime)' : '';
  knob.style.left   = enabled ? '22px' : '2px';
  label.textContent = enabled ? 'AN' : 'AUS';
}

