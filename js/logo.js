/* \u2500\u2500 Floorball Scoreboard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Logo-Farbextraktion (Canvas-basiert, keine externen Abh\u00e4ngigkeiten)
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/* ─── LOGO COLOR EXTRACTION ────────────────────────────────────────── */
/**
 * Extracts dominant, vibrant colors from a logo image using Canvas.
 * Uses a k-means-like quantization with saturation/brightness filtering
 * to find colors suitable for accent and jersey use.
 * @param {string} dataUrl  - base64 image data URL
 * @param {function} cb     - callback(colors: [{hex, r, g, b, score}])
 */
function extractColorsFromLogo(dataUrl, cb) {
  const img = new Image();
  img.onload = () => {
    const SIZE = 80;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, SIZE, SIZE);

    let pixels;
    try { pixels = ctx.getImageData(0, 0, SIZE, SIZE).data; }
    catch(e) { cb([]); return; }

    // Collect opaque pixels, skip near-transparent
    const samples = [];
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 100) continue;
      samples.push([pixels[i], pixels[i+1], pixels[i+2]]);
    }
    if (samples.length < 10) { cb([]); return; }

    // Bucket quantization: 16-level per channel
    const buckets = {};
    for (const [r, g, b] of samples) {
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 };
      buckets[key].count++;
      buckets[key].r += r;
      buckets[key].g += g;
      buckets[key].b += b;
    }

    // Average per bucket, compute HSL saturation safely
    const toHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      const s = d < 0.001 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return { h: 0, s, l };
    };

    const processed = Object.values(buckets)
      .filter(b => b.count >= 2)
      .map(b => {
        const r = Math.round(b.r / b.count);
        const g = Math.round(b.g / b.count);
        const bl = Math.round(b.b / b.count);
        const { s, l } = toHsl(r, g, bl);
        // Score: prefer saturated colors in mid-brightness range
        // Also allow dark/light colors with decent saturation
        const score = b.count * (0.3 + s * 0.7) * (1 - Math.abs(l - 0.5) * 0.6);
        return { r, g, b: bl, s, l, score };
      })
      .sort((a, b) => b.score - a.score);

    // De-duplicate: keep colors that are visually distinct (Euclidean RGB distance)
    const dist = (a, b) => Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
    const selected = [];
    for (const c of processed) {
      if (selected.every(s => dist(s, c) > 40)) {
        selected.push(c);
        if (selected.length >= 4) break;
      }
    }

    const toHex = (r, g, b) =>
      '#' + [r, g, b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');

    cb(selected.map(c => ({ hex: toHex(c.r, c.g, c.b), r: c.r, g: c.g, b: c.b, l: c.l, s: c.s })));
  };
  img.onerror = () => cb([]);
  img.src = dataUrl;
}

/**
 * Renders color swatch buttons into the suggestion area.
 * @param {string} prefix   - e.g. 'ct-home' or 'setup-home'
 * @param {Array}  colors   - from extractColorsFromLogo
 * @param {function} onPick - called with (hex, 'accent'|'jersey')
 */
