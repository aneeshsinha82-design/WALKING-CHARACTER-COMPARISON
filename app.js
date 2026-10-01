/* Walking Character Comparison
 * Everything runs in the browser. No uploads leave your machine.
 * Layout: state -> sprites (processed frames) -> timeline -> drawScene(t) -> preview / MP4 export
 */
'use strict';
(() => {

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */
const REF_W = 1920, REF_H = 1080;          // all timing/position numbers are in 1920x1080 units
const MAX_FRAMES = 12;
const PALETTE = ['#F4C20D', '#4CC9F0', '#FF6B6B', '#7BE495', '#C77DFF', '#FF9F1C', '#F1F1F1', '#2EC4B6'];
const F1 = '"Barlow Condensed","Arial Narrow",Arial,sans-serif';
const F2 = '"Barlow Semi Condensed","Arial Narrow",Arial,sans-serif';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
let uid = 1;
const nid = () => 'i' + (uid++);
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3800);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---- height parsing / formatting ---- */
// Accepts: 187, 187 cm, 1.87, 1.87 m, 6'1.6, 6' 1", 6ft 1in, 5 ft, 72 in
function parseHeight(str) {
  const s = String(str).trim().toLowerCase().replace(',', '.');
  if (!s) return NaN;
  let m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  let cm = NaN;
  if (m) cm = (parseFloat(m[1]) * 12 + parseFloat(m[2] || 0)) * 2.54;
  else {
    m = s.match(/^(\d+(?:\.\d+)?)\s*(cm|m|in|inch|inches|")?$/);
    if (m) {
      const v = parseFloat(m[1]), u = m[2];
      if (u === 'm') cm = v * 100;
      else if (u === 'cm') cm = v;
      else if (u) cm = v * 2.54;
      else cm = v < 3 ? v * 100 : v;
    }
  }
  return cm >= 20 && cm <= 1000 ? cm : NaN;
}
function fmtHeight(cm) {
  const m = (cm / 100).toFixed(2);
  const totIn = cm / 2.54;
  let ft = Math.floor(totIn / 12);
  let inch = Math.round((totIn - ft * 12) * 10) / 10;
  if (inch >= 12) { ft += 1; inch = 0; }
  return `${m} m / ${ft} ft ${inch} in`;
}
function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
const defaultSettings = () => ({
  bg: 'stadium', bgColor: '#1f3a4d', bgImage: null,
  ground: 0.86, figFrac: 0.62, mainX: 480, gap: 340,
  walkFps: 8, speed: 320, hold: 3, overlap: 0, intro: 1.5, outro: 1.5,
  labelSize: 1, shadow: true, guide: false, ruler: false
});

function newChar(o = {}) {
  const c = {
    id: nid(), name: '', height: '175 cm', details: '', frames: [],
    faceRight: true, removeBg: false, tol: 40, color: PALETTE[0], open: true, cm: 175, ...o
  };
  const p = parseHeight(c.height);
  if (!isNaN(p)) c.cm = p;
  return c;
}

const state = { settings: defaultSettings(), chars: [] };
function resetToDefaults() {
  state.settings = defaultSettings();
  state.chars = [
    newChar({ name: 'Main character', height: '178 cm', color: PALETTE[0] }),
    newChar({ name: 'Giant', height: '2.10 m', color: PALETTE[1], open: false }),
    newChar({ name: 'Kid', height: '1.30 m', color: PALETTE[2], open: false })
  ];
}

/* ------------------------------------------------------------------ */
/* Placeholder stick-figure walk cycle (used until frames are uploaded) */
/* ------------------------------------------------------------------ */
function placeholderFrames(color) {
  const N = 8, W = 280, H = 460, K = 1.6, out = [];
  for (let i = 0; i < N; i++) {
    const c = document.createElement('canvas');
    c.width = W * K; c.height = H * K;
    const g = c.getContext('2d');
    g.scale(K, K);
    const ph = i / N * Math.PI * 2, L = 92, A = 58;
    const leg = (th, p) => {
      const flex = 0.95 * Math.max(0, Math.cos(p));
      const kx = L * Math.sin(th), ky = L * Math.cos(th);
      const sh = th - flex;
      return { kx, ky, fx: kx + L * Math.sin(sh), fy: ky + L * Math.cos(sh) };
    };
    const a = leg(0.55 * Math.sin(ph), ph);
    const b = leg(0.55 * Math.sin(ph + Math.PI), ph + Math.PI);
    const drop = Math.max(a.fy, b.fy);
    const hx = 130, hipY = (H - 16) - drop;
    const shY = hipY - 120, headCY = shY - 50, headR = 30;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = color;
    const drawLeg = l => {
      g.beginPath(); g.moveTo(hx, hipY); g.lineTo(hx + l.kx, hipY + l.ky); g.lineTo(hx + l.fx, hipY + l.fy);
      g.lineTo(hx + l.fx + 16, hipY + l.fy); g.stroke();
    };
    const drawArm = ang => {
      const ex = hx + A * Math.sin(ang), ey = shY + 6 + A * Math.cos(ang);
      const hd = ang + 0.45;
      g.beginPath(); g.moveTo(hx, shY + 6); g.lineTo(ex, ey); g.lineTo(ex + A * Math.sin(hd), ey + A * Math.cos(hd)); g.stroke();
    };
    g.globalAlpha = 0.55; drawLeg(b); drawArm(0.6 * Math.sin(ph)); g.globalAlpha = 1;
    g.beginPath(); g.moveTo(hx, hipY); g.lineTo(hx, shY - 10); g.stroke();
    g.beginPath(); g.arc(hx, headCY, headR, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fill(); g.stroke();
    g.fillStyle = color; g.beginPath(); g.arc(hx + 13, headCY - 5, 4, 0, Math.PI * 2); g.fill();
    drawLeg(a); drawArm(-0.6 * Math.sin(ph));
    out.push(c);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sprite building: decode frames, remove background, trim, align      */
/* ------------------------------------------------------------------ */
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Could not read an image'));
    im.src = src;
  });
}

// Flood-fill from the border: only background connected to the edge is removed,
// so white shirts / eyes inside the character survive.
function keyOut(ctx, w, h, tol) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => (y * w + x) * 4);
  if (corners.every(i => d[i + 3] < 20)) return;        // already transparent
  let br = 0, bg = 0, bb = 0;
  corners.forEach(i => { br += d[i]; bg += d[i + 1]; bb += d[i + 2]; });
  br /= 4; bg /= 4; bb /= 4;
  const match = p => {
    const i = p * 4;
    return d[i + 3] > 0 && Math.abs(d[i] - br) <= tol && Math.abs(d[i + 1] - bg) <= tol && Math.abs(d[i + 2] - bb) <= tol;
  };
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  let sp = 0;
  const push = p => { if (!seen[p] && match(p)) { seen[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp], x = p % w, y = (p / w) | 0;
    d[p * 4 + 3] = 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  ctx.putImageData(img, 0, 0);
}

function buildSprite(sources, removeBg, tol) {
  const MAXH = 1400;
  const dim = s => [s.naturalWidth || s.width, s.naturalHeight || s.height];
  const refH = dim(sources[0])[1];
  const k = Math.min(1, MAXH / refH);
  // 1) normalise every frame to the first frame's height
  const norm = sources.map(src => {
    const [sw, sh] = dim(src);
    const f = (refH / sh) * k;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * f)); c.height = Math.max(1, Math.round(sh * f));
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height);
    if (removeBg) keyOut(g, c.width, c.height, tol);
    return c;
  });
  // 2) put them on a common canvas (centred horizontally, bottom-aligned)
  const CW = Math.max(...norm.map(c => c.width)), CH = Math.max(...norm.map(c => c.height));
  const common = norm.map(c => {
    const o = document.createElement('canvas');
    o.width = CW; o.height = CH;
    const g = o.getContext('2d', { willReadFrequently: true });
    g.drawImage(c, Math.round((CW - c.width) / 2), CH - c.height);
    return o;
  });
  // 3) union bounding box of all visible pixels
  let x0 = CW, y0 = CH, x1 = -1, y1 = -1;
  common.forEach(c => {
    const d = c.getContext('2d').getImageData(0, 0, CW, CH).data;
    for (let y = 0; y < CH; y++) {
      const row = y * CW * 4;
      for (let x = 0; x < CW; x++) {
        if (d[row + x * 4 + 3] > 12) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
  });
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = CW - 1; y1 = CH - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const frames = common.map(c => {
    const o = document.createElement('canvas');
    o.width = bw; o.height = bh;
    o.getContext('2d').drawImage(c, x0, y0, bw, bh, 0, 0, bw, bh);
    return o;
  });
  return { frames, w: bw, h: bh };
}

const sprites = new Map();   // charId -> { key, data, promise }
function spriteKey(c) {
  return c.frames.length
    ? c.frames.map(f => f.id).join(',') + '|' + c.removeBg + '|' + c.tol
    : 'ph|' + c.color;
}
function ensureSprite(c) {
  const key = spriteKey(c);
  let e = sprites.get(c.id);
  if (!e || e.key !== key) {
    const prev = e && e.data;
    e = { key, data: prev || null, promise: null };
    sprites.set(c.id, e);
    e.promise = (async () => {
      try {
        let src;
        if (c.frames.length) src = await Promise.all(c.frames.map(f => loadImage(f.src)));
        else src = placeholderFrames(c.color);
        if (sprites.get(c.id) !== e) return;
        e.data = buildSprite(src, c.removeBg, c.tol);
      } catch (err) {
        console.error(err);
        toast('One of the frames could not be read. Try PNG or JPG files.');
      }
      needsDraw = true;
    })();
  }
  return e;
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */
let tl = null;
const invalidate = () => { tl = null; needsDraw = true; };
const START_X = REF_W + 320, END_X = -320;

function getTimeline() {
  if (tl) return tl;
  const S = state.settings;
  const holdX = clamp(S.mainX + S.gap, 200, REF_W - 120);
  const entries = [];
  let t = S.intro;
  state.chars.slice(1).forEach(c => {
    const dIn = (START_X - holdX) / S.speed;
    const start = t, arrive = start + dIn, leave = arrive + S.hold, end = leave + (holdX - END_X) / S.speed;
    entries.push({ c, start, arrive, leave, end, holdX });
    t = Math.max(end - S.overlap, leave - dIn + 0.25);
  });
  const last = entries.length ? entries[entries.length - 1].end : S.intro + 3;
  tl = { entries, total: last + S.outro, holdX };
  return tl;
}
function entryX(e, t, speed) {
  if (t < e.start) return null;
  if (t < e.arrive) return START_X - speed * (t - e.start);
  if (t < e.leave) return e.holdX;
  const x = e.holdX - speed * (t - e.leave);
  return x < END_X ? null : x;
}

/* ------------------------------------------------------------------ */
/* Background                                                          */
/* ------------------------------------------------------------------ */
let bgImgEl = null;
const bgCache = { key: '', canvas: null };
const lum = hex => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
const bgIsLight = () => {
  const S = state.settings;
  return S.bg === 'studio' || (S.bg === 'color' && lum(S.bgColor) > 150);
};

function paintBackground(g, W, H) {
  const S = state.settings, s = W / REF_W, groundY = S.ground * H;
  if (S.bg === 'stadium') {
    const grassTop = Math.max(H * 0.45, groundY - 0.2 * H);
    let gr = g.createLinearGradient(0, 0, 0, grassTop);
    gr.addColorStop(0, '#08121d'); gr.addColorStop(1, '#16283a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // crowd
    const rnd = mulberry32(7), cols = ['#8a97a6', '#c2c9d0', '#d65c4a', '#3f6fb5', '#e0b64a', '#5b6472', '#a5adb8'];
    const step = 8 * s, y0 = H * 0.12, y1 = grassTop - 0.03 * H;
    for (let y = y0; y < y1; y += step) {
      const fade = 0.25 + 0.5 * ((y - y0) / (y1 - y0));
      for (let x = -step; x < W + step; x += step) {
        g.globalAlpha = fade * (0.5 + rnd() * 0.5);
        g.fillStyle = cols[(rnd() * cols.length) | 0];
        g.beginPath(); g.arc(x + rnd() * step, y + rnd() * step, (2 + rnd() * 1.6) * s, 0, 6.283); g.fill();
      }
    }
    g.globalAlpha = 1;
    gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, 'rgba(6,14,24,0.65)'); gr.addColorStop(1, 'rgba(6,14,24,0.15)');
    g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
    // advertising boards
    g.fillStyle = '#1d2733'; g.fillRect(0, grassTop - 0.03 * H, W, 0.03 * H);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = 0; x < W; x += 190 * s) g.fillRect(x, grassTop - 0.03 * H + 5 * s, 96 * s, 0.03 * H - 10 * s);
    // pitch
    gr = g.createLinearGradient(0, grassTop, 0, H);
    gr.addColorStop(0, '#2c6b2f'); gr.addColorStop(1, '#173d1b');
    g.fillStyle = gr; g.fillRect(0, grassTop, W, H - grassTop);
    g.fillStyle = 'rgba(255,255,255,0.045)';
    for (let i = 0; i * 120 * s < W; i += 2) g.fillRect(i * 120 * s, grassTop, 120 * s, H - grassTop);
    gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  } else if (S.bg === 'studio') {
    let gr = g.createLinearGradient(0, 0, 0, groundY);
    gr.addColorStop(0, '#dfe6ea'); gr.addColorStop(1, '#f4f7f8');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const fy = groundY - 0.05 * H;
    gr = g.createLinearGradient(0, fy, 0, H);
    gr.addColorStop(0, '#b7c3ca'); gr.addColorStop(1, '#8c9ba4');
    g.fillStyle = gr; g.fillRect(0, fy, W, H - fy);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, fy, W, 3 * s);
  } else if (S.bg === 'grid') {
    g.fillStyle = '#0a2636'; g.fillRect(0, 0, W, H);
    const fl = g.createLinearGradient(0, groundY - 0.04 * H, 0, H);
    fl.addColorStop(0, 'rgba(255,255,255,0.05)'); fl.addColorStop(1, 'rgba(255,255,255,0.12)');
    g.fillStyle = fl; g.fillRect(0, groundY - 0.04 * H, W, H);
    const cell = 60 * s;
    for (let i = 0, x = 0; x <= W; x += cell, i++) {
      g.fillStyle = i % 5 === 0 ? 'rgba(120,200,255,0.22)' : 'rgba(120,200,255,0.09)';
      g.fillRect(x, 0, (i % 5 === 0 ? 2 : 1) * s, H);
    }
    for (let i = 0, y = groundY; y >= 0; y -= cell, i++) {
      g.fillStyle = i % 5 === 0 ? 'rgba(120,200,255,0.22)' : 'rgba(120,200,255,0.09)';
      g.fillRect(0, y, W, (i % 5 === 0 ? 2 : 1) * s);
    }
    g.fillStyle = 'rgba(244,194,13,0.7)'; g.fillRect(0, groundY, W, 3 * s);
  } else if (S.bg === 'green') {
    g.fillStyle = '#00b140'; g.fillRect(0, 0, W, H);
  } else if (S.bg === 'color') {
    g.fillStyle = S.bgColor; g.fillRect(0, 0, W, H);
  } else if (S.bg === 'image') {
    g.fillStyle = '#10171e'; g.fillRect(0, 0, W, H);
    if (bgImgEl && bgImgEl.complete && bgImgEl.naturalWidth) {
      const r = Math.max(W / bgImgEl.naturalWidth, H / bgImgEl.naturalHeight);
      const w = bgImgEl.naturalWidth * r, h = bgImgEl.naturalHeight * r;
      g.drawImage(bgImgEl, (W - w) / 2, (H - h) / 2, w, h);
    }
  }
}
function drawBackground(g, W, H) {
  const S = state.settings;
  const key = [W, H, S.bg, S.bgColor, S.ground, S.bgImage ? S.bgImage.length : 0, bgImgEl && bgImgEl.complete].join('|');
  if (bgCache.key !== key) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    paintBackground(c.getContext('2d'), W, H);
    bgCache.key = key; bgCache.canvas = c;
  }
  g.drawImage(bgCache.canvas, 0, 0);
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function drawLabel(g, x, headY, c, s, ls, index) {
  const lines = [
    { t: c.name || `Character ${index + 1}`, f: `700 ${38 * s * ls}px ${F1}`, h: 38, col: '#fff' },
    { t: fmtHeight(c.cm), f: `600 ${27 * s * ls}px ${F2}`, h: 27, col: '#fff' }
  ];
  if (c.details) lines.push({ t: c.details, f: `500 ${24 * s * ls}px ${F2}`, h: 24, col: 'rgba(255,255,255,0.78)' });
  let tw = 0;
  lines.forEach(l => { g.font = l.f; l.w = g.measureText(l.t).width; tw = Math.max(tw, l.w); });
  const padX = 18 * s * ls, padY = 11 * s * ls, bar = 6 * s * ls;
  const lh = lines.map(l => l.h * s * ls * 1.16);
  const w = tw + padX * 2 + bar, h = lh.reduce((a, b) => a + b, 0) + padY * 2;
  const bx = x - w / 2, by = headY - 20 * s - h;
  // connector to the head
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2 * s;
  g.beginPath(); g.moveTo(x, by + h); g.lineTo(x, headY - 5 * s); g.stroke();
  // plate
  g.fillStyle = 'rgba(8,16,24,0.78)'; rrect(g, bx, by, w, h, 5 * s); g.fill();
  g.fillStyle = c.color; g.fillRect(bx, by + 4 * s, bar * 0.6, h - 8 * s);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let ty = by + padY;
  lines.forEach((l, i) => {
    g.font = l.f; g.fillStyle = l.col;
    g.fillText(l.t, bx + bar + (w - bar) / 2, ty + lh[i] / 2 + 1 * s);
    ty += lh[i];
  });
}

function drawScene(g, W, H, t) {
  const S = state.settings, s = W / REF_W, T = getTimeline();
  g.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  drawBackground(g, W, H);

  const groundY = S.ground * H;
  const maxCm = Math.max(...state.chars.map(c => c.cm));
  const pxPerCm = S.figFrac * H / maxCm;
  const light = bgIsLight();
  const inkCol = light ? 'rgba(15,32,44,0.75)' : 'rgba(255,255,255,0.8)';

  // ruler
  if (S.ruler) {
    const x = 70 * s, top = maxCm * 1.12;
    g.save(); g.strokeStyle = inkCol; g.fillStyle = inkCol; g.lineWidth = 2 * s;
    g.font = `600 ${22 * s}px ${F2}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.beginPath(); g.moveTo(x, groundY); g.lineTo(x, groundY - top * pxPerCm); g.stroke();
    for (let cm = 0; cm <= top; cm += 10) {
      const y = groundY - cm * pxPerCm, long = cm % 50 === 0;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (long ? 30 : 15) * s, y); g.stroke();
      if (long && cm > 0) g.fillText(cm + ' cm', x + 38 * s, y);
    }
    g.restore();
  }

  const main = state.chars[0];
  const mainH = main.cm * pxPerCm;
  if (S.guide) {
    g.save(); g.strokeStyle = inkCol; g.lineWidth = 2 * s; g.setLineDash([14 * s, 10 * s]);
    g.beginPath(); g.moveTo(0, groundY - mainH); g.lineTo(W, groundY - mainH); g.stroke(); g.restore();
  }

  const labels = [];
  const drawChar = (c, x, flip, phase, idx) => {
    const e = ensureSprite(c);
    if (!e.data) return;
    const sp = e.data, hPx = c.cm * pxPerCm, wPx = hPx * sp.w / sp.h;
    if (S.shadow) {
      g.fillStyle = light ? 'rgba(0,0,0,0.20)' : 'rgba(0,0,0,0.32)';
      g.beginPath(); g.ellipse(x, groundY + 2 * s, wPx * 0.42, Math.max(4 * s, hPx * 0.018), 0, 0, 6.283); g.fill();
    }
    const fi = Math.floor((t + phase) * S.walkFps) % sp.frames.length;
    g.save();
    g.translate(x, groundY);
    if (flip) g.scale(-1, 1);
    g.drawImage(sp.frames[fi], -wPx / 2, -hPx, wPx, hPx);
    g.restore();
    labels.push({ x, headY: groundY - hPx, c, idx });
  };

  // main character: always on screen, faces right
  drawChar(main, S.mainX * s, !main.faceRight, 0, 0);
  // others: walk in from the right, face left
  T.entries.forEach((e, i) => {
    const x = entryX(e, t, S.speed);
    if (x == null) return;
    drawChar(e.c, x * s, e.c.faceRight, 0.37 * (i + 1), i + 1);
  });
  labels.forEach(l => drawLabel(g, l.x, l.headY, l.c, s, S.labelSize, l.idx));
}

/* ------------------------------------------------------------------ */
/* Sidebar UI                                                          */
/* ------------------------------------------------------------------ */
const mainEl = $('#mainChar'), othersEl = $('#otherChars');

function hintFor(c) {
  const v = parseHeight(c.height);
  return isNaN(v)
    ? { ok: false, text: `Try 178, 1.78 m or 5'10` }
    : { ok: true, text: `${Math.round(v * 10) / 10} cm · ${fmtHeight(v)}` };
}

function charHTML(c, isMain, idx, count) {
  const h = hintFor(c);
  const thumbs = c.frames.map((f, i) =>
    `<li><img src="${f.src}" alt="Frame ${i + 1}"><span class="n">${i + 1}</span>` +
    `<button type="button" class="x" data-act="rm-frame" data-fid="${f.id}" aria-label="Remove frame ${i + 1}">×</button></li>`).join('');
  return `
  <details class="char" data-id="${c.id}" style="--c:${c.color}" ${c.open ? 'open' : ''}>
    <summary><span class="sname">${esc(c.name || (isMain ? 'Main character' : 'Character ' + (idx + 1)))}</span><span class="sh">${esc(c.height)}</span></summary>
    <div class="fields">
      <label>Name<input type="text" data-f="name" value="${esc(c.name)}" placeholder="Shown above the head" autocomplete="off"></label>
      <label>Height<input type="text" data-f="height" value="${esc(c.height)}" inputmode="text" autocomplete="off" aria-describedby="hint-${c.id}"></label>
      <p class="hint ${h.ok ? '' : 'bad'}" id="hint-${c.id}" data-hint>${esc(h.text)}</p>
      <label>Details<input type="text" data-f="details" value="${esc(c.details)}" placeholder="Country, team, role (optional)" autocomplete="off"></label>

      <div class="frames">
        <label class="drop">
          <input type="file" class="vh" multiple accept="image/*" data-frames>
          <b>Upload walking frames</b>
          <span>${c.frames.length}/${MAX_FRAMES} added. Pick or drop up to ${MAX_FRAMES} images in walking order. They are sorted by file name.</span>
        </label>
        ${c.frames.length ? `<ol class="thumbs">${thumbs}</ol>` : `<p class="note">Showing a placeholder stick figure until you upload frames.</p>`}
      </div>

      <label>Frames face
        <select data-f="faceRight"><option value="1" ${c.faceRight ? 'selected' : ''}>right</option><option value="0" ${c.faceRight ? '' : 'selected'}>left</option></select>
      </label>
      <label class="chk"><input type="checkbox" data-f="removeBg" ${c.removeBg ? 'checked' : ''}> Remove plain background from frames</label>
      <label class="slider inline" ${c.removeBg ? '' : 'hidden'} data-tolrow>Background tolerance<input type="range" data-f="tol" min="5" max="120" value="${c.tol}"></label>

      <div class="card-actions">
        ${c.frames.length ? `<button type="button" class="btn small ghost" data-act="clear-frames">Clear frames</button>` : ''}
        ${isMain ? '' : `
          <button type="button" class="btn small ghost" data-act="up" ${idx === 1 ? 'disabled' : ''}>Move earlier</button>
          <button type="button" class="btn small ghost" data-act="down" ${idx === count - 1 ? 'disabled' : ''}>Move later</button>
          <button type="button" class="btn small danger" data-act="remove">Remove</button>`}
      </div>
    </div>
  </details>`;
}

function renderChars() {
  mainEl.innerHTML = charHTML(state.chars[0], true, 0, state.chars.length);
  othersEl.innerHTML = state.chars.slice(1).map((c, i) => charHTML(c, false, i + 1, state.chars.length)).join('')
    || '<p class="note">No other characters yet.</p>';
  invalidate();
}
const charById = id => state.chars.find(c => c.id === id);

function onSidebarInput(e) {
  const el = e.target, card = el.closest('.char');
  if (!card) return;
  const c = charById(card.dataset.id), f = el.dataset.f;
  if (!c || !f) return;
  if (f === 'faceRight') c.faceRight = el.value === '1';
  else if (f === 'removeBg') {
    c.removeBg = el.checked;
    $('[data-tolrow]', card).hidden = !c.removeBg;
  }
  else if (f === 'tol') c.tol = +el.value;
  else c[f] = el.value;
  if (f === 'height') {
    const p = parseHeight(el.value);
    if (!isNaN(p)) c.cm = p;
    const h = hintFor(c), hn = $('[data-hint]', card);
    hn.textContent = h.text; hn.classList.toggle('bad', !h.ok);
  }
  if (f === 'name' || f === 'height') {
    const idx = state.chars.indexOf(c);
    $('.sname', card).textContent = c.name || (idx === 0 ? 'Main character' : 'Character ' + (idx + 1));
    $('.sh', card).textContent = c.height;
  }
  invalidate();
}

const readDataURL = f => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
});

async function addFrames(c, fileList) {
  let files = [...fileList].filter(f => f.type.startsWith('image/'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!files.length) { toast('Those files are not images.'); return; }
  const room = MAX_FRAMES - c.frames.length;
  if (room <= 0) { toast(`A character can have ${MAX_FRAMES} frames at most.`); return; }
  if (files.length > room) { toast(`Only ${MAX_FRAMES} frames per character. Used the first ${room}.`); files = files.slice(0, room); }
  const urls = await Promise.all(files.map(readDataURL));
  urls.forEach((u, i) => c.frames.push({ id: nid(), src: u, name: files[i].name }));
  renderChars();
}

document.addEventListener('input', e => { if (e.target.closest('.settings') && e.target.closest('.char')) onSidebarInput(e); });
document.addEventListener('change', e => {
  const el = e.target;
  if (el.matches('input[type=file][data-frames]')) {
    const c = charById(el.closest('.char').dataset.id);
    addFrames(c, el.files);
  } else if (el.closest('.char') && el.dataset.f) onSidebarInput(e);
});
// details open/close doesn't bubble, so listen in the capture phase
document.addEventListener('toggle', e => {
  const card = e.target.closest && e.target.closest('.char');
  if (card && e.target === card) { const c = charById(card.dataset.id); if (c) c.open = card.open; }
}, true);

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const card = b.closest('.char'), c = card && charById(card.dataset.id);
  const act = b.dataset.act;
  if (act === 'rm-frame') { c.frames = c.frames.filter(f => f.id !== b.dataset.fid); renderChars(); }
  else if (act === 'clear-frames') { c.frames = []; renderChars(); }
  else if (act === 'remove') { state.chars = state.chars.filter(x => x !== c); sprites.delete(c.id); renderChars(); }
  else if (act === 'up' || act === 'down') {
    const i = state.chars.indexOf(c), j = act === 'up' ? i - 1 : i + 1;
    if (j >= 1 && j < state.chars.length) { [state.chars[i], state.chars[j]] = [state.chars[j], state.chars[i]]; renderChars(); }
  }
});

// drag & drop onto the upload zones
document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('.drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('.drop'); if (d) d.classList.remove('over'); });
document.addEventListener('drop', e => {
  const d = e.target.closest && e.target.closest('.drop');
  if (!d) return;
  e.preventDefault(); d.classList.remove('over');
  addFrames(charById(d.closest('.char').dataset.id), e.dataTransfer.files);
});

$('#addChar').addEventListener('click', () => {
  const n = state.chars.length;
  state.chars.forEach(c => (c.open = false));
  const c = newChar({ name: `Character ${n}`, height: '170 cm', color: PALETTE[n % PALETTE.length], open: true });
  state.chars.push(c);
  renderChars();
  const card = $(`.char[data-id="${c.id}"]`);
  if (card) { card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); $('[data-f=name]', card).focus({ preventScroll: true }); }
});

/* ---- scene settings ---- */
const unitFmt = {
  ground: v => Math.round(v * 100) + '%', figFrac: v => Math.round(v * 100) + '% of height',
  mainX: v => Math.round(v / REF_W * 100) + '% from left', gap: v => Math.round(v) + ' px',
  walkFps: v => v + ' / s', speed: v => Math.round(v) + ' px/s', hold: v => v + ' s', overlap: v => v + ' s',
  intro: v => v + ' s', outro: v => v + ' s', labelSize: v => Math.round(v * 100) + '%'
};
function syncSettingsUI() {
  const S = state.settings;
  $$('[data-setting]').forEach(el => {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = !!S[k];
    else el.value = S[k];
    const out = el.parentElement.querySelector('output');
    if (out && unitFmt[k]) out.textContent = unitFmt[k](+S[k]);
  });
  $('#bgColorRow').hidden = S.bg !== 'color';
  $('#bgImageRow').hidden = S.bg !== 'image';
}
$$('[data-setting]').forEach(el => {
  const handler = () => {
    const k = el.dataset.setting;
    state.settings[k] = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? +el.value : el.value);
    const out = el.parentElement.querySelector('output');
    if (out && unitFmt[k]) out.textContent = unitFmt[k](+state.settings[k]);
    if (k === 'bg') { $('#bgColorRow').hidden = el.value !== 'color'; $('#bgImageRow').hidden = el.value !== 'image'; }
    invalidate(); updateTransportUI(); updateExportInfo();
  };
  el.addEventListener('input', handler); el.addEventListener('change', handler);
});
$('#bgImage').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  const url = await readDataURL(f);
  state.settings.bgImage = url;
  bgImgEl = new Image(); bgImgEl.onload = () => { bgCache.key = ''; needsDraw = true; }; bgImgEl.src = url;
});

/* ---- project save / load ---- */
$('#saveProject').addEventListener('click', () => {
  const data = { app: 'walking-character-comparison', version: 1, settings: state.settings,
    chars: state.chars.map(({ id, open, ...rest }) => rest) };
  saveBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'walking-comparison-project.json');
  toast('Project saved. It includes your frames, so the file can be large.');
});
$('#loadProject').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || !Array.isArray(data.chars) || !data.chars.length) throw new Error('bad file');
    state.settings = { ...defaultSettings(), ...data.settings };
    state.chars = data.chars.map((c, i) => newChar({
      ...c, frames: (c.frames || []).map(fr => ({ id: nid(), src: fr.src, name: fr.name })), open: i < 2
    }));
    sprites.clear();
    bgImgEl = null;
    if (state.settings.bgImage) { bgImgEl = new Image(); bgImgEl.onload = () => { bgCache.key = ''; needsDraw = true; }; bgImgEl.src = state.settings.bgImage; }
    syncSettingsUI(); renderChars(); time = 0; updateTransportUI(); updateExportInfo();
    toast('Project loaded.');
  } catch (err) { toast('That does not look like a project file from this tool.'); }
  e.target.value = '';
});

/* ------------------------------------------------------------------ */
/* Preview player                                                      */
/* ------------------------------------------------------------------ */
const canvas = $('#stage'), ctx = canvas.getContext('2d');
let time = 0, playing = false, lastNow = 0, needsDraw = true;
const playBtn = $('#play'), scrub = $('#scrub');
const ICON_PLAY = 'M7 4.5v15l12-7.5z', ICON_PAUSE = 'M6 4.5h4.2v15H6zM13.8 4.5H18v15h-4.2z';

function setPlaying(p) {
  playing = p;
  $('#playIcon').setAttribute('d', p ? ICON_PAUSE : ICON_PLAY);
  playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
}
function updateTransportUI() {
  const total = getTimeline().total;
  scrub.style.setProperty('--n', Math.max(1, total).toFixed(2));
  scrub.value = Math.round(clamp(time / total, 0, 1) * 1000);
  $('#timeText').textContent = `${fmtTime(time)} / ${fmtTime(total)}`;
}
playBtn.addEventListener('click', () => {
  if (!playing && time >= getTimeline().total - 0.01) time = 0;
  setPlaying(!playing);
});
scrub.addEventListener('input', () => { time = scrub.value / 1000 * getTimeline().total; needsDraw = true; updateTransportUI(); });
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(document.activeElement.tagName)) { e.preventDefault(); playBtn.click(); }
});

function tick(now) {
  if (playing) {
    const dt = Math.min(0.1, (now - lastNow) / 1000), total = getTimeline().total;
    time += dt;
    if (time >= total) { if ($('#loop').checked) time %= total; else { time = total; setPlaying(false); } }
    needsDraw = true;
    updateTransportUI();
  }
  lastNow = now;
  if (needsDraw) {
    needsDraw = false;
    drawScene(ctx, canvas.width, canvas.height, time);
    if (!playing) updateTransportUI();
  }
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */
let cancelFlag = false, exporting = false;
const $status = $('#exportStatus'), $progress = $('#progress');

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function exportSettings() {
  const [w, h] = $('#expRes').value.split('x').map(Number);
  return { w, h, fps: +$('#expFps').value };
}
function updateExportInfo() {
  const { w, h, fps } = exportSettings(), total = getTimeline().total;
  const canWC = 'VideoEncoder' in window && window.Mp4Muxer;
  $('#exportInfo').textContent =
    `${w}×${h}, ${fps} fps, ${fmtTime(total)} long (${Math.ceil(total * fps)} frames). ` +
    (canWC ? 'Rendered frame by frame, so it is exact and does not have to play in real time.'
           : 'This browser cannot encode MP4 directly. It will record in real time instead, so keep this tab visible. Chrome, Edge or Safari give the best result.');
}
$('#expRes').addEventListener('change', updateExportInfo);
$('#expFps').addEventListener('change', updateExportInfo);

async function pickCodec(w, h, fps, bitrate) {
  // H.264 only: it is the one codec every phone, editor and upload site accepts in an .mp4
  const list = window.__wccCodecs || [
    { codec: 'avc1.640034', mux: 'avc' }, { codec: 'avc1.640033', mux: 'avc' }, { codec: 'avc1.64002A', mux: 'avc' },
    { codec: 'avc1.640028', mux: 'avc' }, { codec: 'avc1.4D0028', mux: 'avc' }, { codec: 'avc1.42E01F', mux: 'avc' }
  ];
  for (const c of list) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec: c.codec, width: w, height: h, bitrate, framerate: fps });
      if (r.supported) return c;
    } catch (_) { /* try next */ }
  }
  return null;
}

async function exportWebCodecs(w, h, fps, total, onProgress) {
  const bitrate = Math.round(w * h * fps * 0.11);        // ~12 Mbps @1080p30, ~50 Mbps @4K30
  const pick = await pickCodec(w, h, fps, bitrate);
  if (!pick) throw new Error('nocodec');
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const g = off.getContext('2d');
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({ target, video: { codec: pick.mux, width: w, height: h }, fastStart: 'in-memory' });
  let encError = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => { encError = e; }
  });
  enc.configure({ codec: pick.codec, width: w, height: h, bitrate, framerate: fps });
  const n = Math.ceil(total * fps), dur = 1e6 / fps;
  for (let i = 0; i < n; i++) {
    if (cancelFlag) { enc.close(); throw new Error('cancelled'); }
    if (encError) throw encError;
    drawScene(g, w, h, i / fps);
    const vf = new VideoFrame(off, { timestamp: Math.round(i * dur), duration: Math.round(dur) });
    enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
    if (i % 4 === 0) { onProgress(i / n); await new Promise(r => setTimeout(r)); }
  }
  await enc.flush();
  if (encError) throw encError;
  enc.close();
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
}

async function exportRecorder(w, h, fps, total, onProgress) {
  if (!('MediaRecorder' in window)) throw new Error('This browser cannot export video. Please use Chrome, Edge or Safari.');
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const g = off.getContext('2d');
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'];
  const mime = types.find(t => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error('This browser cannot record video. Please use Chrome, Edge or Safari.');
  const rec = new MediaRecorder(off.captureStream(fps), { mimeType: mime, videoBitsPerSecond: Math.round(w * h * fps * 0.11) });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => (rec.onstop = r));
  drawScene(g, w, h, 0);
  rec.start(500);
  const t0 = performance.now();
  await new Promise(res => {
    (function loop() {
      const t = (performance.now() - t0) / 1000;
      if (cancelFlag || t >= total) { rec.stop(); return res(); }
      drawScene(g, w, h, t); onProgress(t / total);
      requestAnimationFrame(loop);
    })();
  });
  await done;
  if (cancelFlag) throw new Error('cancelled');
  const ext = mime.includes('avc1') ? 'mp4' : 'webm';
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext };
}

$('#exportBtn').addEventListener('click', async () => {
  if (exporting) return;
  exporting = true; cancelFlag = false;
  const wasPlaying = playing; setPlaying(false);
  const { w, h, fps } = exportSettings(), total = getTimeline().total;
  $('#exportBtn').disabled = true; $('#cancelBtn').hidden = false;
  $progress.hidden = false; $progress.value = 0; $('#result').hidden = true;
  $status.textContent = 'Preparing frames and fonts…';
  try {
    await Promise.all(state.chars.map(c => ensureSprite(c).promise));
    try { await Promise.all([document.fonts.load(`700 38px ${F1}`), document.fonts.load(`600 27px ${F2}`)]); } catch (_) {}
    const onProgress = p => { $progress.value = p; $status.textContent = `Rendering ${Math.round(p * 100)}%`; };
    let out;
    if ('VideoEncoder' in window && window.Mp4Muxer) {
      try { out = await exportWebCodecs(w, h, fps, total, onProgress); }
      catch (err) {
        if (err.message === 'nocodec') { $status.textContent = 'No H.264 encoder at this size. Trying the recorder…'; out = await exportRecorder(w, h, fps, total, onProgress); }
        else throw err;
      }
    } else out = await exportRecorder(w, h, fps, total, onProgress);

    const name = `walking-character-comparison-${h}p.${out.ext}`;
    saveBlob(out.blob, name);
    const url = URL.createObjectURL(out.blob);
    $('#resultVideo').src = url; $('#resultLink').href = url; $('#resultLink').download = name;
    $('#result').hidden = false;
    $progress.value = 1;
    $status.textContent = out.ext === 'mp4'
      ? `Done. Saved ${name} (${(out.blob.size / 1048576).toFixed(1)} MB).`
      : `Done, but this browser could only write WebM (${name}). Use Chrome, Edge or Safari for MP4.`;
  } catch (err) {
    $progress.hidden = true;
    $status.textContent = err.message === 'cancelled' ? 'Export cancelled.' : `Export failed: ${err.message || err}`;
    console.error(err);
  } finally {
    exporting = false;
    $('#exportBtn').disabled = false; $('#cancelBtn').hidden = true;
    needsDraw = true;
    if (wasPlaying) setPlaying(true);
  }
});
$('#cancelBtn').addEventListener('click', () => { cancelFlag = true; });

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
resetToDefaults();
syncSettingsUI();
renderChars();
updateTransportUI();
updateExportInfo();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => (needsDraw = true));
setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
requestAnimationFrame(tick);

// tiny hook for automated tests
window.__wcc = { state, drawScene, getTimeline, ensureSprite, setTime: t => { time = t; needsDraw = true; } };
})();
