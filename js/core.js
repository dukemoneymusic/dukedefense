/* ============================================================
   DUKE$DEFENSE — core.js
   Math, RNG, value noise, colour, camera, and the audio engine.
   Everything here is dependency-free and side-effect free until
   Audio2.unlock() is called from a user gesture.
   ============================================================ */
'use strict';

/* The battlefield is larger than the window; the camera shows a slice.
   VIEW_* is the logical canvas resolution — it follows the window's aspect
   ratio so a phone held upright gets a tall viewport instead of a letterboxed
   strip. Recomputed by setViewport() on every resize/rotate. */
/* Solo runs on the base board; co-op gets a much larger battlefield so four
   players have room to spread out and hold different approaches. The size is
   chosen before a level loads (setWorldSize) and everything that bakes or
   scales reads WORLD_W/WORLD_H live. */
/* One board size for every mode. Weapon ranges are tuned to this, so scaling
   the canvas up (as an earlier version did for co-op) left towers unable to
   reach the road. "A bigger board" is delivered instead as LONGER ROUTES —
   more road for enemies to cross before the apple — at this fixed size, so
   ranges and placement behave identically in solo and co-op. */
const BASE_WORLD_W = 2560, BASE_WORLD_H = 1440;
let WORLD_W = BASE_WORLD_W, WORLD_H = BASE_WORLD_H;
function setWorldSize(coop) {
  WORLD_W = BASE_WORLD_W;
  WORLD_H = BASE_WORLD_H;
}
let VIEW_W = 1600, VIEW_H = 900;

/* Pick a logical resolution matching the window's shape. The long edge is
   capped so we never render an absurd number of pixels on a big monitor,
   and floored so a small phone still sees a useful slice of the map. */
function setViewport(cssW, cssH) {
  const long = Math.max(cssW, cssH), short = Math.min(cssW, cssH);
  const logicalLong = Math.min(1600, Math.max(1000, Math.round(long * 1.4)));
  const logicalShort = Math.max(560, Math.round(logicalLong * short / long));
  if (cssW >= cssH) { VIEW_W = logicalLong; VIEW_H = logicalShort; }
  else { VIEW_W = logicalShort; VIEW_H = logicalLong; }
  return { w: VIEW_W, h: VIEW_H };
}

/* ---------------------------------------------------------- */
/*  U — utility namespace                                     */
/* ---------------------------------------------------------- */
const U = (() => {

  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const inv   = (a, b, v) => (b - a) === 0 ? 0 : (v - a) / (b - a);
  const mapR  = (v, a, b, c, d) => lerp(c, d, clamp(inv(a, b, v), 0, 1));

  const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  const dist  = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

  /* shortest signed angular difference */
  function angDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }
  const angLerp = (a, b, t) => a + angDiff(a, b) * t;

  /* deterministic PRNG — mulberry32 */
  function rng(seed) {
    let s = seed >>> 0;
    const f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (a, b) => a + f() * (b - a);
    f.int   = (a, b) => Math.floor(a + f() * (b - a + 1));
    f.pick  = arr => arr[Math.floor(f() * arr.length)];
    f.chance = p => f() < p;
    f.sign  = () => f() < 0.5 ? -1 : 1;
    return f;
  }

  const rand    = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick    = arr => arr[(Math.random() * arr.length) | 0];
  const chance  = p => Math.random() < p;

  /* easing */
  const ease = {
    linear:   t => t,
    inQuad:   t => t * t,
    outQuad:  t => t * (2 - t),
    inOutQuad:t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    outCubic: t => (--t) * t * t + 1,
    inCubic:  t => t * t * t,
    outQuart: t => 1 - Math.pow(1 - t, 4),
    outExpo:  t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
    outBack:  t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1
  };

  /* colour ---------------------------------------------------- */
  function rgba(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }

  function hexRGB(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbHex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(v | 0, 0, 255).toString(16).padStart(2, '0')).join('');
  }
  /* blend two hex colours */
  function mix(c1, c2, t) {
    const a = hexRGB(c1), b = hexRGB(c2);
    return rgbHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  }
  /* multiply brightness */
  function shade(hex, k) {
    const c = hexRGB(hex);
    return rgbHex(c[0] * k, c[1] * k, c[2] * k);
  }
  function alpha(hex, a) {
    const c = hexRGB(hex);
    return rgba(c[0], c[1], c[2], a);
  }

  /* value noise ------------------------------------------------ */
  function makeNoise(seed) {
    const r = rng(seed);
    const P = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = r.int(0, i); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const grad = new Float32Array(256);
    for (let i = 0; i < 256; i++) grad[i] = r() * 2 - 1;

    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

    function n2(x, y) {
      const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = fade(xf), v = fade(yf);
      const aa = grad[P[P[xi] + yi] & 255];
      const ab = grad[P[P[xi] + yi + 1] & 255];
      const ba = grad[P[P[xi + 1] + yi] & 255];
      const bb = grad[P[P[xi + 1] + yi + 1] & 255];
      return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
    }
    function fbm(x, y, oct = 4, lac = 2, gain = .5) {
      let a = 1, f = 1, s = 0, n = 0;
      for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * a; n += a; a *= gain; f *= lac; }
      return s / n;
    }
    return { n2, fbm };
  }

  /* geometry --------------------------------------------------- */
  /* distance from point to segment */
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    if (L === 0) return dist(px, py, ax, ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / L;
    t = clamp(t, 0, 1);
    return dist(px, py, ax + dx * t, ay + dy * t);
  }
  /* min distance from a point to a polyline */
  function distToPath(px, py, pts) {
    let m = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSeg(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < m) m = d;
    }
    return m;
  }

  /* Catmull-Rom resample: turns sparse waypoints into a smooth
     dense polyline with cumulative arclength for O(1) lookup.   */
  function buildPath(way, step = 6) {
    const p = [way[0], ...way, way[way.length - 1]];
    const out = [];
    for (let i = 1; i < p.length - 2; i++) {
      const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
      const seg = Math.max(2, Math.ceil(dist(p1.x, p1.y, p2.x, p2.y) / step));
      for (let j = 0; j < seg; j++) {
        const t = j / seg, t2 = t * t, t3 = t2 * t;
        out.push({
          x: .5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: .5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push({ x: way[way.length - 1].x, y: way[way.length - 1].y });

    /* cumulative length + heading */
    let total = 0;
    out[0].d = 0;
    for (let i = 1; i < out.length; i++) {
      total += dist(out[i - 1].x, out[i - 1].y, out[i].x, out[i].y);
      out[i].d = total;
    }
    for (let i = 0; i < out.length; i++) {
      const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
      out[i].a = Math.atan2(b.y - a.y, b.x - a.x);
    }
    return { pts: out, length: total };
  }

  /* sample a built path at arclength d */
  function samplePath(path, d) {
    const pts = path.pts;
    if (d <= 0) return { x: pts[0].x, y: pts[0].y, a: pts[0].a };
    if (d >= path.length) { const L = pts[pts.length - 1]; return { x: L.x, y: L.y, a: L.a }; }
    /* binary search */
    let lo = 0, hi = pts.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (pts[m].d <= d) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi];
    const t = (d - a.d) / Math.max(1e-6, b.d - a.d);
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), a: angLerp(a.a, b.a, t) };
  }

  /* misc ------------------------------------------------------- */
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }
  function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  /* offscreen canvas helper */
  function surface(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const x = c.getContext('2d');
    return { c, x, w: c.width, h: c.height };
  }

  return {
    TAU, clamp, lerp, inv, mapR, dist, dist2, angDiff, angLerp,
    rng, rand, randInt, pick, chance, ease,
    rgba, hexRGB, rgbHex, mix, shade, alpha,
    makeNoise, distToSeg, distToPath, buildPath, samplePath,
    fmtTime, fmtMoney, surface
  };
})();


/* ============================================================
   CAMERA — pans and zooms over the world plane.
   x,y is the world coordinate at the top-left of the viewport.
   ============================================================ */
function makeCamera() {
  return {
    x: 0, y: 0, z: 1,
    tx: 0, ty: 0, tz: 1,               /* targets, for smoothing */
    padT: 0, padB: 0,                  /* HUD / dock insets, screen px */
    minZ: Math.max(VIEW_W / WORLD_W, VIEW_H / WORLD_H),
    maxZ: 2.6,

    /* the strip of screen the board actually gets to live in, once the
       HUD (top) and dock (bottom) have taken their bite. World is fit and
       positioned into THIS, so nothing important ever hides behind a bar. */
    usableH() { return Math.max(120, VIEW_H - this.padT - this.padB); },

    setPads(top, bottom) {
      this.padT = top || 0;
      this.padB = bottom || 0;
      this.refit();
    },
    refit() {
      this.minZ = Math.max(VIEW_W / WORLD_W, this.usableH() / WORLD_H);
      if (this.tz < this.minZ) this.tz = this.minZ;
      this.clamp();
    },

    updateViewport() {
      const wasMin = Math.abs(this.tz - this.minZ) < 0.001;
      this.minZ = Math.max(VIEW_W / WORLD_W, this.usableH() / WORLD_H);
      if (wasMin || this.tz < this.minZ) this.tz = this.minZ;
      this.clamp();
      this.z = this.tz;
    },

    clamp() {
      this.tz = U.clamp(this.tz, this.minZ, this.maxZ);
      const vw = VIEW_W / this.tz, vh = this.usableH() / this.tz;
      this.tx = U.clamp(this.tx, 0, Math.max(0, WORLD_W - vw));
      this.ty = U.clamp(this.ty, 0, Math.max(0, WORLD_H - vh));
    },
    /* keep the world point under the cursor pinned while zooming */
    zoomAt(sx, sy, factor) {
      const wx = this.tx + sx / this.tz;
      const wy = this.ty + (sy - this.padT) / this.tz;
      this.tz = U.clamp(this.tz * factor, this.minZ, this.maxZ);
      this.tx = wx - sx / this.tz;
      this.ty = wy - (sy - this.padT) / this.tz;
      this.clamp();
    },
    panBy(dxScreen, dyScreen) {
      this.tx -= dxScreen / this.tz;
      this.ty -= dyScreen / this.tz;
      this.clamp();
    },
    centerOn(wx, wy) {
      this.tx = wx - (VIEW_W / this.tz) / 2;
      this.ty = wy - (this.usableH() / this.tz) / 2;
      this.clamp();
      this.x = this.tx; this.y = this.ty; this.z = this.tz;
    },
    step(dt) {
      const k = 1 - Math.pow(0.0008, dt);
      this.x += (this.tx - this.x) * k;
      this.y += (this.ty - this.y) * k;
      this.z += (this.tz - this.z) * k;
    },
    /* screen y is measured from the top of the window; the board is
       rendered starting at padT, so both mappings carry that offset. */
    toWorld(sx, sy) { return { x: this.x + sx / this.z, y: this.y + (sy - this.padT) / this.z }; },
    toScreen(wx, wy) { return { x: (wx - this.x) * this.z, y: (wy - this.y) * this.z + this.padT }; },
    visible(pad) {
      pad = pad || 0;
      return {
        x0: this.x - pad, y0: this.y - pad,
        x1: this.x + VIEW_W / this.z + pad,
        y1: this.y + this.usableH() / this.z + pad
      };
    }
  };
}


/* ============================================================
   SYNC — the one random source the simulation is allowed to use.
   Netplay replays the same command stream on every client, so
   anything that changes gameplay must come from here, seeded
   identically. Cosmetic randomness (sparks, smoke) may still use
   Math.random because nobody can desync on a particle.
   ============================================================ */
function makeSync(seed) {
  let s = (seed >>> 0) || 1;
  const f = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.chance = p => f() < p;
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.state = () => s;
  f.setState = v => { s = v >>> 0; };
  return f;
}


/* ============================================================
   AUDIO — fully synthesised. No files, no network.
   ============================================================ */
const Audio2 = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  let ready = false, muted = false;
  let musicNodes = [];
  let musicTimer = null;
  let lastPlay = {};                 /* throttle map */

  function unlock() {
    if (ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : .85;
    master.connect(ctx.destination);

    /* gentle limiter so stacked explosions don't clip */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22;
    comp.ratio.value = 7; comp.attack.value = .004; comp.release.value = .18;
    comp.connect(master);

    musicBus = ctx.createGain(); musicBus.gain.value = .30; musicBus.connect(comp);
    sfxBus   = ctx.createGain(); sfxBus.gain.value   = .95; sfxBus.connect(comp);
    ready = true;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : .85, ctx.currentTime, .05);
    return muted;
  }
  const isMuted = () => muted;

  /* --- primitives ------------------------------------------- */
  function env(node, t0, a, d, peak = 1) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(.0002, peak), t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    return s;
  }

  function tone(freq, t0, dur, type = 'sine', peak = .3, bend = 0, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t0 + dur);
    env(g, t0, Math.min(.02, dur * .2), dur, peak);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t0); o.stop(t0 + dur + .05);
    return o;
  }

  function burst(t0, dur, f0, f1, peak = .3, q = 1, type = 'lowpass') {
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    const g = ctx.createGain();
    env(g, t0, .004, dur, peak);
    n.connect(f); f.connect(g); g.connect(sfxBus);
    n.start(t0); n.stop(t0 + dur + .05);
  }

  /* --- SFX library ------------------------------------------- */
  const LIB = {
    ui:      () => { const t = ctx.currentTime; tone(660, t, .05, 'square', .10); tone(990, t + .03, .05, 'square', .06); },
    back:    () => { const t = ctx.currentTime; tone(420, t, .07, 'square', .09); tone(300, t + .04, .07, 'square', .06); },
    error:   () => { const t = ctx.currentTime; tone(150, t, .12, 'sawtooth', .14, .6); },
    build:   () => { const t = ctx.currentTime; burst(t, .10, 2600, 500, .28); tone(190, t + .02, .16, 'square', .16, .7); tone(380, t, .09, 'triangle', .1); },
    sell:    () => { const t = ctx.currentTime; [880, 660, 440].forEach((f, i) => tone(f, t + i * .045, .09, 'triangle', .12)); },
    upgrade: () => { const t = ctx.currentTime; [440, 587, 740, 880].forEach((f, i) => tone(f, t + i * .05, .16, 'triangle', .13)); burst(t + .16, .2, 5200, 900, .12); },
    coin:    () => { const t = ctx.currentTime; tone(1320, t, .05, 'square', .09); tone(1980, t + .04, .10, 'square', .07); },

    /* --- small arms ---
       A gunshot is a very short, very loud broadband transient with a
       low-frequency thump under it. Bigger calibre = lower thump, longer
       tail, more low-mid body. */
    pistol:  () => {
      const t = ctx.currentTime;
      burst(t, .085, 4200, 380, .30, .8);
      tone(180, t, .06, 'square', .16, .35);
      burst(t + .01, .17, 900, 180, .07, .5);
    },
    smg:     () => {
      const t = ctx.currentTime;
      burst(t, .055, 5200, 700, .22, 1.1);
      tone(240, t, .04, 'square', .10, .4);
    },
    rifle:   () => {
      const t = ctx.currentTime;
      burst(t, .10, 6000, 320, .34, .7);
      tone(140, t, .08, 'square', .20, .3);
      burst(t + .015, .26, 1400, 160, .10, .4);
    },
    lmg:     () => {
      const t = ctx.currentTime;
      burst(t, .075, 4800, 300, .30, .8);
      tone(110, t, .07, 'sawtooth', .18, .35);
    },
    shotgun: () => {
      const t = ctx.currentTime;
      burst(t, .16, 3000, 140, .42, .5);
      tone(90, t, .13, 'square', .26, .35);
      burst(t + .02, .34, 800, 110, .12, .4);
    },
    sniper:  () => {
      const t = ctx.currentTime;
      burst(t, .13, 7000, 220, .44, .6);
      tone(78, t, .16, 'square', .30, .28);
      /* the crack coming back off the buildings */
      burst(t + .16, .42, 1800, 200, .13, .35);
      burst(t + .33, .5, 1100, 150, .07, .3);
    },
    thump:   () => { const t = ctx.currentTime; burst(t, .12, 1400, 200, .28, .6); tone(120, t, .1, 'square', .18, .4); },
    mortar:  () => {
      const t = ctx.currentTime;
      tone(160, t, .22, 'sine', .26, .35);
      burst(t, .3, 900, 120, .24, .5);
    },
    rocket:  () => {
      const t = ctx.currentTime;
      burst(t, .55, 2400, 400, .30, .7, 'bandpass');
      tone(200, t, .4, 'sawtooth', .16, .35);
    },
    flame:   () => { const t = ctx.currentTime; burst(t, .34, 1600, 700, .16, .5); },
    cryo:    () => { const t = ctx.currentTime; burst(t, .3, 5600, 1400, .18, .9, 'highpass'); tone(520, t, .2, 'sine', .07, .5); },
    arc:     () => {
      const t = ctx.currentTime;
      tone(1500, t, .13, 'sawtooth', .16, .16);
      burst(t, .12, 7200, 1800, .16, 4, 'bandpass');
      tone(60, t, .1, 'square', .12, .5);
    },
    reload:  () => { const t = ctx.currentTime; burst(t, .05, 3000, 900, .16, 2); burst(t + .09, .06, 2200, 600, .18, 2); tone(300, t + .09, .05, 'square', .1); },
    thunder: () => { const t = ctx.currentTime; burst(t, 1.4, 700, 60, .30, .4); tone(48, t, 1.1, 'sine', .22, .5); },

    shoot:   () => { const t = ctx.currentTime; burst(t, .055, 3200, 700, .16, 1.2); tone(240, t, .05, 'square', .07, .5); },
    pop:     () => { const t = ctx.currentTime; burst(t, .04, 5000, 1400, .11, 2); },
    splat:   () => { const t = ctx.currentTime; burst(t, .13, 900, 160, .20, .7); tone(110, t, .1, 'sine', .1, .6); },
    lob:     () => { const t = ctx.currentTime; tone(300, t, .12, 'triangle', .10, 2.2); },
    boom:    () => {
      const t = ctx.currentTime;
      burst(t, .55, 1500, 60, .42, .5);
      tone(80, t, .38, 'sine', .30, .35);
      tone(140, t, .18, 'sawtooth', .14, .3);
    },
    thud:    () => { const t = ctx.currentTime; burst(t, .22, 500, 50, .34, .6); tone(64, t, .26, 'sine', .28, .5); },
    zap:     () => {
      const t = ctx.currentTime;
      tone(1600, t, .12, 'sawtooth', .14, .18);
      burst(t, .1, 7000, 2000, .13, 3, 'bandpass');
    },
    beam:    () => { const t = ctx.currentTime; tone(880, t, .18, 'sawtooth', .07, 1.6); burst(t, .16, 4000, 3000, .05, 6, 'bandpass'); },
    steam:   () => { const t = ctx.currentTime; burst(t, .42, 900, 5200, .17, .6, 'highpass'); },
    horn:    () => { const t = ctx.currentTime; tone(392, t, .26, 'sawtooth', .13); tone(494, t, .26, 'sawtooth', .10); tone(196, t, .3, 'square', .09); },
    water:   () => { const t = ctx.currentTime; burst(t, .3, 2600, 400, .18, .8); },
    freeze:  () => {
      const t = ctx.currentTime;
      [1760, 2093, 2637].forEach((f, i) => tone(f, t + i * .04, .5, 'sine', .11, .55));
      burst(t, .7, 9000, 1200, .1, 1.5, 'highpass');
    },
    plow:    () => { const t = ctx.currentTime; burst(t, .55, 700, 140, .25, .6); tone(120, t, .5, 'sawtooth', .1, .55); },

    hurt:    () => { const t = ctx.currentTime; tone(220, t, .22, 'square', .22, .35); burst(t, .18, 700, 120, .16); },
    squeak:  () => { const t = ctx.currentTime; tone(1400 + Math.random() * 500, t, .07, 'square', .06, 1.5); },
    wave:    () => {
      const t = ctx.currentTime;
      [261.6, 329.6, 392, 523.3].forEach((f, i) => { tone(f, t + i * .07, .5, 'sawtooth', .09); tone(f / 2, t + i * .07, .5, 'square', .05); });
    },
    boss:    () => {
      const t = ctx.currentTime;
      tone(55, t, 1.4, 'sawtooth', .30);
      tone(82.4, t + .05, 1.3, 'sawtooth', .20);
      tone(110, t + .1, 1.2, 'square', .12);
      burst(t, 1.0, 400, 60, .2, .5);
    },
    win:     () => {
      const t = ctx.currentTime;
      [523, 659, 784, 1046, 1318].forEach((f, i) => { tone(f, t + i * .12, .7, 'triangle', .17); tone(f * 2, t + i * .12, .5, 'sine', .06); });
    },
    lose:    () => {
      const t = ctx.currentTime;
      [392, 349, 311, 233].forEach((f, i) => { tone(f, t + i * .2, .8, 'sawtooth', .16); });
      tone(58, t, 1.8, 'sine', .2);
    }
  };

  /* throttled play — stops 40 rats dying at once from clipping */
  function play(name, throttleMs = 0) {
    if (!ready || muted) return;
    const f = LIB[name];
    if (!f) return;
    if (throttleMs) {
      const now = performance.now();
      if (lastPlay[name] && now - lastPlay[name] < throttleMs) return;
      lastPlay[name] = now;
    }
    try { f(); } catch (e) { /* audio graph hiccup — never break the game */ }
  }

  /* --- procedural music -------------------------------------- */
  /* Each district gets a mood: root note, scale, tempo, texture. */
  const MOODS = {
    neon:   { root: 55.0,  scale: [0, 3, 5, 7, 10], bpm: 104, pad: 'sawtooth', bright: .55 },
    park:   { root: 65.4,  scale: [0, 2, 4, 7, 9],  bpm: 84,  pad: 'triangle', bright: .40 },
    harbor: { root: 49.0,  scale: [0, 2, 3, 7, 8],  bpm: 74,  pad: 'sine',     bright: .30 },
    grit:   { root: 43.7,  scale: [0, 1, 5, 7, 8],  bpm: 96,  pad: 'sawtooth', bright: .48 },
    gold:   { root: 58.3,  scale: [0, 4, 7, 9, 11], bpm: 92,  pad: 'triangle', bright: .52 },
    deep:   { root: 36.7,  scale: [0, 1, 3, 6, 8],  bpm: 68,  pad: 'sawtooth', bright: .22 }
  };

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    musicNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} });
    musicNodes = [];
  }

  function startMusic(moodName) {
    if (!ready) return;
    stopMusic();
    const M = MOODS[moodName] || MOODS.neon;
    const beat = 60 / M.bpm;

    /* --- sustained pad: three detuned voices --- */
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.gain.setTargetAtTime(.30, ctx.currentTime, 2.5);
    const padFilt = ctx.createBiquadFilter();
    padFilt.type = 'lowpass';
    padFilt.frequency.value = 300 + M.bright * 900;
    padFilt.Q.value = 1.2;
    padGain.connect(padFilt); padFilt.connect(musicBus);

    [1, 2, 3].forEach((mul, i) => {
      const o = ctx.createOscillator();
      o.type = M.pad;
      o.frequency.value = M.root * mul * (1 + (i - 1) * 0.0035);
      const g = ctx.createGain(); g.gain.value = 1 / (mul * 2.2);
      o.connect(g); g.connect(padGain);
      o.start(); musicNodes.push(o);
    });

    /* slow filter drift so it never sits still */
    const lfo = ctx.createOscillator(); lfo.frequency.value = .045;
    const lfoG = ctx.createGain(); lfoG.gain.value = 200 + M.bright * 380;
    lfo.connect(lfoG); lfoG.connect(padFilt.frequency);
    lfo.start(); musicNodes.push(lfo);
    musicNodes.push(padGain);

    /* --- rhythmic arpeggio + subway-ish pulse --- */
    let step = 0;
    const seedR = U.rng(moodName.length * 7717 + 31);
    musicTimer = setInterval(() => {
      if (muted || !ready) return;
      const t = ctx.currentTime + .02;

      /* hat every other step */
      if (step % 2 === 0) {
        const n = noise();
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
        const g = ctx.createGain(); env(g, t, .002, step % 8 === 0 ? .07 : .035, .045);
        n.connect(f); f.connect(g); g.connect(musicBus);
        n.start(t); n.stop(t + .12);
      }
      /* kick on 1 and 3 */
      if (step % 8 === 0 || step % 8 === 4) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(42, t + .12);
        const g = ctx.createGain(); env(g, t, .004, .16, .30);
        o.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + .3);
      }
      /* arp note — sparse, so it stays background */
      if (seedR() < .34) {
        const deg = M.scale[Math.floor(seedR() * M.scale.length)];
        const oct = seedR() < .35 ? 4 : 3;
        const f = M.root * Math.pow(2, oct + deg / 12);
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain(); env(g, t, .01, .5, .052);
        const dl = ctx.createDelay(); dl.delayTime.value = beat * .75;
        const fb = ctx.createGain(); fb.gain.value = .3;
        o.connect(g); g.connect(musicBus);
        g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(musicBus);
        o.start(t); o.stop(t + .8);
      }
      step = (step + 1) % 16;
    }, beat * 500);          /* eighth notes */
  }

  function duckMusic(amount, seconds) {
    if (!ready || !musicBus) return;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(.30 * amount, t + .05);
    musicBus.gain.linearRampToValueAtTime(.30, t + seconds);
  }

  return { unlock, play, setMuted, isMuted, startMusic, stopMusic, duckMusic, get ready() { return ready; } };
})();


/* ============================================================
   SAVE — localStorage with graceful degradation
   ============================================================ */
const Save = (() => {
  const KEY = 'dukedefense.v1';
  const blank = { stars: {}, unlocked: 1, seen: false, muted: false, name: '', lastServer: '' };
  let data;

  try {
    data = Object.assign({}, blank, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) { data = Object.assign({}, blank); }

  function flush() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }
  return {
    get: () => data,
    stars: id => data.stars[id] || 0,
    totalStars: () => Object.values(data.stars).reduce((a, b) => a + b, 0),
    cleared: id => (data.stars[id] || 0) > 0,
    record(id, stars, levelCount) {
      if (stars > (data.stars[id] || 0)) data.stars[id] = stars;
      if (stars > 0) data.unlocked = Math.max(data.unlocked, Math.min(levelCount, id + 2));
      flush();
    },
    unlocked: () => data.unlocked,
    set(k, v) { data[k] = v; flush(); },
    reset() { data = Object.assign({}, blank); flush(); }
  };
})();
