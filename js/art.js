/* ============================================================
   DUKE$DEFENSE — art.js
   Procedural city generation. No image files anywhere: every
   texture, building, prop and landmark is drawn with canvas
   primitives into offscreen surfaces at level load.

   Projection: the world is a WORLD_W x WORLD_H plane seen from a
   camera hanging above NADIR. Anything with height is extruded
   away from the nadir, which gives the parallax lean you get
   looking down at a real block from a helicopter.

   Bake also produces the PLACEMENT MASK — a coarse grid marking
   every cell a weapon may not be dropped on: the road, building
   footprints, landmarks and the apple itself.
   ============================================================ */
'use strict';

const ART = (() => {

  /* These follow the live world size, which changes between solo and co-op.
     syncSize() refreshes them at the start of every bake so a bigger co-op
     board projects and masks correctly. */
  let W = WORLD_W, H = WORLD_H;
  let NADIR_X = W / 2, NADIR_Y = H + 460;
  const SPREAD  = 0.00030;              /* how hard walls lean out */
  const RISE    = 0.52;                 /* screen px per world height unit */

  /* placement mask granularity */
  const CELL = 16;
  let GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);

  function syncSize() {
    W = WORLD_W; H = WORLD_H;
    NADIR_X = W / 2;
    NADIR_Y = H + Math.round(H * 0.319);   /* nadir sits ~0.32H below the frame */
    GW = Math.ceil(W / CELL);
    GH = Math.ceil(H / CELL);
  }

  const N = U.makeNoise(9137);

  /* project a ground point at height h into screen space */
  function proj(x, y, h) {
    const k = 1 + h * SPREAD;
    return {
      x: NADIR_X + (x - NADIR_X) * k,
      y: NADIR_Y + (y - NADIR_Y) * k - h * RISE
    };
  }

  /* ==========================================================
     GROUND TEXTURES
     Each returns a tileable-ish surface the size requested.
     ========================================================== */

  function grain(x, w, h, amt, sizePx, seed) {
    /* speckle pass — cheap film-grain / aggregate look */
    const r = U.rng(seed);
    const img = x.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (r() - .5) * amt * 255;
      d[i] = d[i + 1] = d[i + 2] = 128 + v;
      d[i + 3] = 255;
    }
    const s = U.surface(w, h);
    s.x.putImageData(img, 0, 0);
    x.save();
    x.globalCompositeOperation = 'overlay';
    x.globalAlpha = .55;
    x.drawImage(s.c, 0, 0, w, h);
    x.restore();
  }

  const TEX = {

    asphalt(x, w, h, pal, seed) {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, U.shade(pal.ground, 1.12));
      g.addColorStop(.55, pal.ground);
      g.addColorStop(1, U.shade(pal.ground, .82));
      x.fillStyle = g; x.fillRect(0, 0, w, h);

      /* aggregate blotches */
      const r = U.rng(seed);
      for (let i = 0; i < 2600; i++) {
        const px = r() * w, py = r() * h, rad = r() * 2.6 + .4;
        x.fillStyle = U.rgba(255, 255, 255, r() * .045);
        x.beginPath(); x.arc(px, py, rad, 0, U.TAU); x.fill();
      }
      for (let i = 0; i < 1400; i++) {
        const px = r() * w, py = r() * h, rad = r() * 3.2 + .5;
        x.fillStyle = U.rgba(0, 0, 0, r() * .09);
        x.beginPath(); x.arc(px, py, rad, 0, U.TAU); x.fill();
      }
      /* patch repairs + tar seams */
      for (let i = 0; i < 26; i++) {
        const px = r() * w, py = r() * h, rw = r() * 130 + 40, rh = r() * 90 + 30;
        x.save(); x.globalAlpha = .16 + r() * .16;
        x.fillStyle = r() < .5 ? '#000' : U.shade(pal.ground, 1.3);
        x.beginPath();
        x.ellipse(px, py, rw / 2, rh / 2, r() * 3, 0, U.TAU);
        x.fill(); x.restore();
      }
      x.strokeStyle = U.rgba(0, 0, 0, .3); x.lineWidth = 1.6;
      for (let i = 0; i < 22; i++) {
        x.beginPath();
        let px = r() * w, py = r() * h;
        x.moveTo(px, py);
        for (let j = 0; j < 6; j++) { px += (r() - .5) * 90; py += (r() - .5) * 60; x.lineTo(px, py); }
        x.stroke();
      }
      grain(x, w, h, .10, 1, seed + 5);
    },

    concrete(x, w, h, pal, seed) {
      x.fillStyle = pal.ground; x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      for (let py = 0; py < h; py += 4) {
        for (let px = 0; px < w; px += 4) {
          const n = N.fbm(px * .01, py * .01, 4);
          x.fillStyle = U.rgba(255, 255, 255, Math.max(0, n) * .07);
          x.fillRect(px, py, 4, 4);
          x.fillStyle = U.rgba(0, 0, 0, Math.max(0, -n) * .10);
          x.fillRect(px, py, 4, 4);
        }
      }
      /* expansion joints */
      x.strokeStyle = U.rgba(0, 0, 0, .22); x.lineWidth = 2;
      for (let px = 0; px < w; px += 96) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }
      for (let py = 0; py < h; py += 96) { x.beginPath(); x.moveTo(0, py); x.lineTo(w, py); x.stroke(); }
      grain(x, w, h, .09, 1, seed + 11);
    },

    grass(x, w, h, pal, seed) {
      const g = x.createLinearGradient(0, 0, w * .3, h);
      g.addColorStop(0, U.shade(pal.ground, 1.16));
      g.addColorStop(1, U.shade(pal.ground, .78));
      x.fillStyle = g; x.fillRect(0, 0, w, h);

      /* mottled turf */
      for (let py = 0; py < h; py += 5) {
        for (let px = 0; px < w; px += 5) {
          const n = N.fbm(px * .006, py * .006, 5);
          if (n > .04) { x.fillStyle = U.rgba(140, 190, 90, n * .22); x.fillRect(px, py, 5, 5); }
          else if (n < -.04) { x.fillStyle = U.rgba(10, 40, 18, -n * .28); x.fillRect(px, py, 5, 5); }
        }
      }
      /* blades */
      const r = U.rng(seed);
      for (let i = 0; i < 9000; i++) {
        const px = r() * w, py = r() * h;
        const len = 2 + r() * 4;
        x.strokeStyle = U.rgba(r() < .5 ? 176 : 96, 210, 110, .10 + r() * .16);
        x.lineWidth = 1;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - .5) * 2, py - len); x.stroke();
      }
      /* worn dirt paths */
      for (let i = 0; i < 8; i++) {
        x.save(); x.globalAlpha = .12;
        x.fillStyle = '#6b5535';
        x.beginPath(); x.ellipse(r() * w, r() * h, 60 + r() * 120, 26 + r() * 50, r() * 3, 0, U.TAU); x.fill();
        x.restore();
      }
    },

    water(x, w, h, pal, seed) {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, U.shade(pal.ground, 1.25));
      g.addColorStop(.5, pal.ground);
      g.addColorStop(1, U.shade(pal.ground, .7));
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      /* long specular ripples */
      for (let i = 0; i < 900; i++) {
        const px = r() * w, py = r() * h, len = 12 + r() * 70;
        x.strokeStyle = U.rgba(255, 255, 255, .03 + r() * .09);
        x.lineWidth = .8 + r() * 1.6;
        x.beginPath();
        x.moveTo(px, py);
        x.bezierCurveTo(px + len * .3, py - 3, px + len * .7, py + 3, px + len, py);
        x.stroke();
      }
      for (let i = 0; i < 260; i++) {
        const px = r() * w, py = r() * h;
        x.fillStyle = U.rgba(10, 30, 50, .1 + r() * .2);
        x.beginPath(); x.ellipse(px, py, 20 + r() * 70, 4 + r() * 10, 0, 0, U.TAU); x.fill();
      }
    },

    cobble(x, w, h, pal, seed) {
      x.fillStyle = U.shade(pal.ground, .55); x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      const sz = 15;
      for (let row = 0; row * sz < h + sz; row++) {
        const off = (row % 2) * sz * .5;
        for (let col = -1; col * sz < w + sz; col++) {
          const px = col * sz + off + (r() - .5) * 2.2;
          const py = row * sz + (r() - .5) * 2.2;
          const cw = sz - 2 + r() * 1.5, ch = sz - 3 + r() * 1.5;
          const tint = .78 + r() * .5;
          x.fillStyle = U.shade(pal.ground, tint);
          x.beginPath();
          x.ellipse(px + cw / 2, py + ch / 2, cw / 2, ch / 2, (r() - .5) * .5, 0, U.TAU);
          x.fill();
          /* top-left key light */
          x.strokeStyle = U.rgba(255, 255, 255, .10 + r() * .1);
          x.lineWidth = 1;
          x.beginPath();
          x.ellipse(px + cw / 2, py + ch / 2 - .6, cw / 2 - .8, ch / 2 - .8, 0, Math.PI * 1.1, Math.PI * 1.9);
          x.stroke();
        }
      }
      grain(x, w, h, .12, 1, seed + 3);
    },

    boardwalk(x, w, h, pal, seed) {
      x.fillStyle = U.shade(pal.ground, .6); x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      const pw = 26;
      for (let px = 0; px < w; px += pw) {
        for (let py = 0; py < h; py += 150 + r() * 90) {
          const ph = 140 + r() * 100;
          const t = .78 + r() * .48;
          x.fillStyle = U.shade(pal.ground, t);
          x.fillRect(px + 1, py + 1, pw - 2, ph - 2);
          /* wood grain */
          x.strokeStyle = U.rgba(0, 0, 0, .12); x.lineWidth = 1;
          for (let k = 0; k < 5; k++) {
            const gx = px + 3 + r() * (pw - 6);
            x.beginPath(); x.moveTo(gx, py + 2);
            x.bezierCurveTo(gx + 2, py + ph * .3, gx - 2, py + ph * .7, gx, py + ph - 2);
            x.stroke();
          }
          /* nails */
          x.fillStyle = U.rgba(0, 0, 0, .4);
          x.beginPath(); x.arc(px + 5, py + 6, 1.2, 0, U.TAU); x.fill();
          x.beginPath(); x.arc(px + pw - 5, py + 6, 1.2, 0, U.TAU); x.fill();
        }
      }
      /* gap shadows between planks */
      x.strokeStyle = U.rgba(0, 0, 0, .5); x.lineWidth = 2;
      for (let px = 0; px < w; px += pw) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }
      grain(x, w, h, .1, 1, seed + 7);
    },

    marble(x, w, h, pal, seed) {
      x.fillStyle = pal.ground; x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      const sz = 88;
      for (let py = 0; py < h; py += sz) {
        for (let px = 0; px < w; px += sz) {
          const t = .9 + r() * .22;
          x.fillStyle = U.shade(pal.ground, t);
          x.fillRect(px + 1, py + 1, sz - 2, sz - 2);
          /* veining */
          x.strokeStyle = U.rgba(255, 255, 255, .12);
          x.lineWidth = 1.1;
          for (let k = 0; k < 3; k++) {
            x.beginPath();
            let vx = px + r() * sz, vy = py;
            x.moveTo(vx, vy);
            for (let s = 0; s < 6; s++) { vx += (r() - .5) * 26; vy += sz / 6; x.lineTo(vx, vy); }
            x.stroke();
          }
        }
      }
      x.strokeStyle = U.rgba(0, 0, 0, .3); x.lineWidth = 1.5;
      for (let px = 0; px <= w; px += sz) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }
      for (let py = 0; py <= h; py += sz) { x.beginPath(); x.moveTo(0, py); x.lineTo(w, py); x.stroke(); }
      grain(x, w, h, .06, 1, seed);
    },

    tunnel(x, w, h, pal, seed) {
      x.fillStyle = pal.ground; x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      /* wet concrete + track ballast */
      for (let py = 0; py < h; py += 4) {
        for (let px = 0; px < w; px += 4) {
          const n = N.fbm(px * .014, py * .014, 4);
          x.fillStyle = U.rgba(255, 255, 255, Math.max(0, n) * .05);
          x.fillRect(px, py, 4, 4);
          x.fillStyle = U.rgba(0, 0, 0, Math.max(0, -n) * .22);
          x.fillRect(px, py, 4, 4);
        }
      }
      for (let i = 0; i < 4200; i++) {
        const px = r() * w, py = r() * h;
        x.fillStyle = U.rgba(160, 160, 170, r() * .09);
        x.beginPath(); x.arc(px, py, r() * 2.4, 0, U.TAU); x.fill();
      }
      /* seepage stains */
      for (let i = 0; i < 34; i++) {
        x.save(); x.globalAlpha = .18;
        x.fillStyle = '#0d1a14';
        x.beginPath(); x.ellipse(r() * w, r() * h, 30 + r() * 90, 12 + r() * 40, r() * 3, 0, U.TAU); x.fill();
        x.restore();
      }
      grain(x, w, h, .14, 1, seed + 2);
    },

    snow(x, w, h, pal, seed) {
      x.fillStyle = pal.ground; x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      for (let py = 0; py < h; py += 5) {
        for (let px = 0; px < w; px += 5) {
          const n = N.fbm(px * .008, py * .008, 4);
          x.fillStyle = U.rgba(255, 255, 255, Math.max(0, n) * .35);
          x.fillRect(px, py, 5, 5);
          x.fillStyle = U.rgba(120, 150, 190, Math.max(0, -n) * .22);
          x.fillRect(px, py, 5, 5);
        }
      }
      /* footprints + slush */
      for (let i = 0; i < 90; i++) {
        x.fillStyle = U.rgba(90, 110, 140, .1 + r() * .12);
        x.beginPath(); x.ellipse(r() * w, r() * h, 4 + r() * 9, 3 + r() * 5, r() * 3, 0, U.TAU); x.fill();
      }
      grain(x, w, h, .07, 1, seed);
    },

    field(x, w, h, pal, seed) {
      /* ballpark turf with mow stripes */
      x.fillStyle = pal.ground; x.fillRect(0, 0, w, h);
      const r = U.rng(seed);
      for (let i = 0; i < 26; i++) {
        x.save();
        x.globalAlpha = i % 2 ? .09 : .0;
        x.fillStyle = '#ffffff';
        x.translate(w / 2, h / 2); x.rotate(-.34); x.translate(-w / 2, -h / 2);
        x.fillRect(-200 + i * 90, -200, 90, h + 400);
        x.restore();
      }
      for (let i = 0; i < 6000; i++) {
        const px = r() * w, py = r() * h;
        x.strokeStyle = U.rgba(150, 200, 120, .06 + r() * .1);
        x.lineWidth = 1;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 2 - r() * 3); x.stroke();
      }
    }
  };

  /* ==========================================================
     ROADS
     ========================================================== */
  function strokePath(x, pts, width, style, cap = 'round') {
    x.beginPath();
    x.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y);
    x.lineWidth = width; x.strokeStyle = style;
    x.lineCap = cap; x.lineJoin = 'round';
    x.stroke();
  }

  function drawRoad(x, path, pal, roadW, seed, style) {
    const pts = path.pts;
    const r = U.rng(seed);

    if (style === 'track') {
      /* subway right of way */
      strokePath(x, pts, roadW + 16, U.rgba(0, 0, 0, .55));
      strokePath(x, pts, roadW, U.shade(pal.road, .8));
      /* ties */
      for (let d = 0; d < path.length; d += 22) {
        const p = U.samplePath(path, d);
        x.save(); x.translate(p.x, p.y); x.rotate(p.a);
        x.fillStyle = U.shade('#4a3a28', .8 + r() * .5);
        x.fillRect(-5, -roadW * .40, 10, roadW * .80);
        x.restore();
      }
      /* rails */
      [-1, 1].forEach(s => {
        x.save();
        x.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], nx = Math.cos(p.a + Math.PI / 2) * roadW * .26 * s, ny = Math.sin(p.a + Math.PI / 2) * roadW * .26 * s;
          i ? x.lineTo(p.x + nx, p.y + ny) : x.moveTo(p.x + nx, p.y + ny);
        }
        x.lineWidth = 4; x.strokeStyle = '#8d939c'; x.lineCap = 'round'; x.stroke();
        x.lineWidth = 1.6; x.strokeStyle = '#cfd6e0'; x.stroke();
        x.restore();
      });
      /* third rail */
      x.save();
      x.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], nx = Math.cos(p.a + Math.PI / 2) * roadW * .46, ny = Math.sin(p.a + Math.PI / 2) * roadW * .46;
        i ? x.lineTo(p.x + nx, p.y + ny) : x.moveTo(p.x + nx, p.y + ny);
      }
      x.lineWidth = 5; x.strokeStyle = '#2a2f3a'; x.stroke();
      x.restore();
      return;
    }

    if (style === 'water') {
      /* ferry lane / river channel — just a subtle darker current */
      x.save(); x.globalAlpha = .35;
      strokePath(x, pts, roadW + 30, U.shade(pal.road, .75));
      x.globalAlpha = .25;
      strokePath(x, pts, roadW, U.shade(pal.road, 1.25));
      x.restore();
      return;
    }

    /* --- standard street --- */
    /* curb shadow */
    strokePath(x, pts, roadW + 26, U.rgba(0, 0, 0, .34));
    /* sidewalk */
    strokePath(x, pts, roadW + 22, pal.curb);
    /* curb inner lip */
    strokePath(x, pts, roadW + 8, U.shade(pal.curb, .72));
    /* road bed */
    strokePath(x, pts, roadW, pal.road);
    /* wear in the wheel tracks */
    x.save();
    x.globalAlpha = .18;
    [-1, 1].forEach(s => {
      x.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], nx = Math.cos(p.a + Math.PI / 2) * roadW * .22 * s, ny = Math.sin(p.a + Math.PI / 2) * roadW * .22 * s;
        i ? x.lineTo(p.x + nx, p.y + ny) : x.moveTo(p.x + nx, p.y + ny);
      }
      x.lineWidth = roadW * .26; x.strokeStyle = '#000'; x.lineCap = 'round'; x.stroke();
    });
    x.restore();

    /* centre line */
    x.save();
    x.setLineDash([26, 22]);
    strokePath(x, pts, 3.5, pal.roadLine, 'butt');
    x.setLineDash([]);
    x.restore();

    /* manholes, patches, puddles */
    for (let d = 60; d < path.length - 40; d += 150 + r() * 210) {
      const p = U.samplePath(path, d);
      const off = (r() - .5) * roadW * .5;
      const mx = p.x + Math.cos(p.a + Math.PI / 2) * off;
      const my = p.y + Math.sin(p.a + Math.PI / 2) * off;
      if (r() < .5) {
        /* manhole */
        x.save(); x.translate(mx, my);
        x.fillStyle = U.rgba(0, 0, 0, .35); x.beginPath(); x.ellipse(0, 2, 13, 11, 0, 0, U.TAU); x.fill();
        x.fillStyle = '#3b3f47'; x.beginPath(); x.ellipse(0, 0, 12, 10, 0, 0, U.TAU); x.fill();
        x.strokeStyle = '#585e69'; x.lineWidth = 1.4;
        for (let k = 1; k <= 3; k++) { x.beginPath(); x.ellipse(0, 0, 12 - k * 3, 10 - k * 2.5, 0, 0, U.TAU); x.stroke(); }
        x.restore();
      } else {
        /* tar patch */
        x.save(); x.globalAlpha = .22; x.fillStyle = '#000';
        x.beginPath(); x.ellipse(mx, my, 16 + r() * 26, 10 + r() * 16, r() * 3, 0, U.TAU); x.fill();
        x.restore();
      }
    }

    /* crosswalks near the ends */
    [0.06, 0.94].forEach(f => {
      const p = U.samplePath(path, path.length * f);
      x.save(); x.translate(p.x, p.y); x.rotate(p.a);
      x.fillStyle = U.rgba(255, 255, 255, .48);
      for (let i = -3; i <= 3; i++) x.fillRect(-16, i * 9 - 3, 32, 6);
      x.restore();
    });
  }

  /* ==========================================================
     BUILDINGS — extruded volumes with real facades
     ========================================================== */

  /* bilinear point inside a quad */
  function quadPt(q, u, v) {
    const ax = U.lerp(q[0].x, q[1].x, u), ay = U.lerp(q[0].y, q[1].y, u);
    const bx = U.lerp(q[3].x, q[2].x, u), by = U.lerp(q[3].y, q[2].y, u);
    return { x: U.lerp(ax, bx, v), y: U.lerp(ay, by, v) };
  }
  function quadFill(x, q, style) {
    x.beginPath(); x.moveTo(q[0].x, q[0].y);
    for (let i = 1; i < 4; i++) x.lineTo(q[i].x, q[i].y);
    x.closePath(); x.fillStyle = style; x.fill();
  }

  /* Draw one building. opts:
       col      base facade colour
       floors   number of window rows
       night    0..1 how many windows glow
       roof     'water'|'ac'|'spire'|'flat'|'crown'
       style    'brick'|'glass'|'stone'|'castiron'|'brownstone'
  */
  function building(x, bx, by, bw, bd, bh, opts, rnd) {
    const r = rnd || U.rng((bx * 31 + by * 17 + bh) | 0);
    const st = opts.style || 'brick';
    const col = opts.col;

    /* footprint corners, clockwise from NW */
    const f = [
      { x: bx - bw / 2, y: by - bd / 2 },
      { x: bx + bw / 2, y: by - bd / 2 },
      { x: bx + bw / 2, y: by + bd / 2 },
      { x: bx - bw / 2, y: by + bd / 2 }
    ];
    const rf = f.map(p => proj(p.x, p.y, bh));

    /* contact shadow on the ground */
    x.save();
    x.globalAlpha = .5;
    x.filter = 'blur(6px)';
    x.fillStyle = '#000';
    x.beginPath();
    x.ellipse(bx + 6, by + bd * .34 + 6, bw * .62, bd * .5, 0, 0, U.TAU);
    x.fill();
    x.restore();

    /* A wall is visible when its outward normal points back toward the
       camera, i.e. toward the nadir. Painter order is then simply base-edge
       screen depth: higher edges are further away, so draw them first. */
    const faces = [];
    for (let i = 0; i < 4; i++) {
      const a = f[i], b = f[(i + 1) % 4];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ex = b.x - a.x, ey = b.y - a.y;
      let nx = ey, ny = -ex;                       /* outward for CW winding */
      const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      const dot = nx * (mx - NADIR_X) + ny * (my - NADIR_Y);
      if (dot < 0) {
        faces.push({
          i, my,
          q: [a, b, rf[(i + 1) % 4], rf[i]],       /* base-a, base-b, roof-b, roof-a */
          /* key light comes from the upper left */
          light: U.clamp(.42 + (-nx * .45 - ny * .62), .18, 1.0)
        });
      }
    }
    faces.sort((p, q2) => p.my - q2.my);

    for (const fc of faces) {
      const q = fc.q;
      const base = U.shade(col, .62 + fc.light * .88);

      /* vertical gradient: darker at street level (soot + AO) */
      const g = x.createLinearGradient(
        (q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2,
        (q[2].x + q[3].x) / 2, (q[2].y + q[3].y) / 2);
      g.addColorStop(0, U.shade(base, .58));
      g.addColorStop(.28, U.shade(base, .88));
      g.addColorStop(1, U.shade(base, 1.1));
      quadFill(x, q, g);

      /* ---- facade detail ---- */
      const floors = Math.max(2, opts.floors || Math.round(bh / 22));
      const cols = Math.max(2, Math.round(Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) / 17));

      x.save();
      x.beginPath(); x.moveTo(q[0].x, q[0].y);
      for (let i = 1; i < 4; i++) x.lineTo(q[i].x, q[i].y);
      x.closePath(); x.clip();

      if (st === 'glass') {
        /* horizontal mullion bands + reflective sheen */
        for (let fl = 0; fl <= floors; fl++) {
          const v = fl / floors;
          const a = quadPt(q, 0, v), b = quadPt(q, 1, v);
          x.strokeStyle = U.rgba(255, 255, 255, .10);
          x.lineWidth = 1.4;
          x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
        }
        for (let c = 0; c <= cols; c++) {
          const u = c / cols;
          const a = quadPt(q, u, 0), b = quadPt(q, u, 1);
          x.strokeStyle = U.rgba(0, 0, 0, .18); x.lineWidth = 1;
          x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
        }
        /* sky reflection sweep */
        const sg = x.createLinearGradient(q[3].x, q[3].y, q[1].x, q[1].y);
        sg.addColorStop(0, U.rgba(150, 200, 255, .16));
        sg.addColorStop(.4, U.rgba(255, 255, 255, .04));
        sg.addColorStop(1, U.rgba(80, 120, 190, .12));
        quadFill(x, q, sg);
      } else {
        /* punched windows */
        const wu = .62 / cols, wv = .52 / floors;
        for (let fl = 0; fl < floors; fl++) {
          for (let c = 0; c < cols; c++) {
            const u = (c + .5) / cols, v = (fl + .55) / floors;
            const p0 = quadPt(q, u - wu / 2, v - wv / 2);
            const p1 = quadPt(q, u + wu / 2, v - wv / 2);
            const p2 = quadPt(q, u + wu / 2, v + wv / 2);
            const p3 = quadPt(q, u - wu / 2, v + wv / 2);
            const lit = r() < (opts.night || 0) * .78;
            const wq = [p0, p1, p2, p3];
            if (lit) {
              const warm = r() < .78;
              quadFill(x, wq, warm ? U.rgba(255, 214, 140, .92) : U.rgba(180, 225, 255, .8));
            } else {
              quadFill(x, wq, U.rgba(12, 16, 26, .78));
              /* faint pane reflection */
              quadFill(x, [p0, p1, quadPt(q, u + wu / 2, v), quadPt(q, u - wu / 2, v)], U.rgba(150, 190, 240, .10));
            }
            /* sill */
            x.strokeStyle = U.rgba(255, 255, 255, .13); x.lineWidth = 1;
            x.beginPath(); x.moveTo(p3.x, p3.y); x.lineTo(p2.x, p2.y); x.stroke();
          }
        }
        /* masonry courses */
        if (st === 'brick' || st === 'brownstone') {
          x.strokeStyle = U.rgba(0, 0, 0, .10); x.lineWidth = 1;
          for (let fl = 0; fl <= floors; fl++) {
            const v = fl / floors;
            const a = quadPt(q, 0, v), b = quadPt(q, 1, v);
            x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
          }
        }
        if (st === 'castiron') {
          /* pilasters */
          x.strokeStyle = U.rgba(255, 255, 255, .16); x.lineWidth = 2.2;
          for (let c = 0; c <= cols; c++) {
            const u = c / cols;
            const a = quadPt(q, u, 0), b = quadPt(q, u, 1);
            x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
          }
        }
        /* fire escape on ~1/3 of walls */
        if (opts.escape && fc.i === 0 && bh > 60) {
          x.strokeStyle = U.rgba(20, 24, 32, .82); x.lineWidth = 2;
          for (let fl = 1; fl < floors; fl++) {
            const v = fl / floors;
            const a = quadPt(q, .18, v), b = quadPt(q, .82, v);
            x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
            for (let k = 0; k <= 8; k++) {
              const p = quadPt(q, .18 + .64 * k / 8, v);
              const pu = quadPt(q, .18 + .64 * k / 8, v - .5 / floors);
              x.lineWidth = 1; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(pu.x, pu.y); x.stroke();
              x.lineWidth = 2;
            }
          }
        }
      }

      /* street-level storefront glow */
      const s0 = quadPt(q, .06, .90), s1 = quadPt(q, .94, .90);
      const s2 = quadPt(q, .94, 1.0), s3 = quadPt(q, .06, 1.0);
      quadFill(x, [s0, s1, s2, s3], opts.night > .3
        ? U.rgba(255, 190, 90, .55)
        : U.rgba(30, 36, 50, .55));

      x.restore();

      /* corner edge highlight */
      x.strokeStyle = U.rgba(255, 255, 255, .13); x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(q[0].x, q[0].y); x.lineTo(q[3].x, q[3].y); x.stroke();
    }

    /* ---- roof ---- */
    const rg = x.createLinearGradient(rf[0].x, rf[0].y, rf[2].x, rf[2].y);
    rg.addColorStop(0, U.shade(col, 1.32));
    rg.addColorStop(1, U.shade(col, .88));
    quadFill(x, rf, rg);
    /* gravel */
    x.save();
    x.beginPath(); x.moveTo(rf[0].x, rf[0].y);
    for (let i = 1; i < 4; i++) x.lineTo(rf[i].x, rf[i].y);
    x.closePath(); x.clip();
    for (let i = 0; i < 120; i++) {
      x.fillStyle = U.rgba(255, 255, 255, r() * .08);
      x.beginPath(); x.arc(rf[0].x + r() * bw * 1.2, rf[0].y + r() * bd * 1.2, r() * 1.6, 0, U.TAU); x.fill();
    }
    x.restore();
    /* parapet */
    x.strokeStyle = U.rgba(255, 255, 255, .22); x.lineWidth = 2;
    x.beginPath(); x.moveTo(rf[0].x, rf[0].y);
    for (let i = 1; i < 4; i++) x.lineTo(rf[i].x, rf[i].y);
    x.closePath(); x.stroke();

    /* rooftop furniture */
    const rx = (rf[0].x + rf[2].x) / 2, ry = (rf[0].y + rf[2].y) / 2;
    if (opts.roof === 'water' || (!opts.roof && r() < .38)) {
      /* wooden water tower — the most New York object there is */
      const s = Math.min(bw, bd) * .26 + 6;
      x.save(); x.translate(rx + (r() - .5) * bw * .3, ry + (r() - .5) * bd * .3);
      x.fillStyle = '#241a12';
      x.fillRect(-s * .5, -s * .2, s * .12, s * .5);
      x.fillRect(s * .38, -s * .2, s * .12, s * .5);
      const wg = x.createLinearGradient(-s * .6, 0, s * .6, 0);
      wg.addColorStop(0, '#4a3320'); wg.addColorStop(.45, '#7a5636'); wg.addColorStop(1, '#3a2718');
      x.fillStyle = wg;
      x.fillRect(-s * .6, -s * 1.1, s * 1.2, s * .95);
      x.strokeStyle = U.rgba(0, 0, 0, .35); x.lineWidth = 1;
      for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(-s * .6, -s * 1.1 + k * s * .24); x.lineTo(s * .6, -s * 1.1 + k * s * .24); x.stroke(); }
      x.fillStyle = '#2b1d12';
      x.beginPath(); x.moveTo(-s * .68, -s * 1.1); x.lineTo(0, -s * 1.6); x.lineTo(s * .68, -s * 1.1); x.closePath(); x.fill();
      x.restore();
    }
    if (opts.roof === 'ac' || (!opts.roof && r() < .5)) {
      for (let k = 0; k < 2 + (r() * 3 | 0); k++) {
        const ux = rx + (r() - .5) * bw * .7, uy = ry + (r() - .5) * bd * .7;
        const uw = 8 + r() * 12, uh = 6 + r() * 8;
        x.fillStyle = '#3d4450'; x.fillRect(ux - uw / 2, uy - uh, uw, uh);
        x.fillStyle = '#5b636f'; x.fillRect(ux - uw / 2, uy - uh - 3, uw, 4);
      }
    }
    if (opts.roof === 'spire') {
      x.strokeStyle = '#9aa3b2'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx, ry - 34 - r() * 26); x.stroke();
      x.fillStyle = '#ff5a4a';
      x.beginPath(); x.arc(rx, ry - 36 - r() * 26, 2.6, 0, U.TAU); x.fill();
    }
    if (opts.roof === 'crown' && opts.night > .3) {
      /* lit setback crown, Chrysler-adjacent */
      x.save(); x.globalCompositeOperation = 'lighter';
      const cg = x.createRadialGradient(rx, ry, 0, rx, ry, bw);
      cg.addColorStop(0, U.rgba(255, 220, 140, .5));
      cg.addColorStop(1, U.rgba(255, 200, 100, 0));
      x.fillStyle = cg; x.beginPath(); x.arc(rx, ry, bw, 0, U.TAU); x.fill();
      x.restore();
    }
  }

  /* ==========================================================
     STREET PROPS
     ========================================================== */
  const PROP = {
    tree(x, px, py, s, pal, r, season) {
      r = r || U.rng((px * 31 + py * 17) | 0);
      /* shadow */
      x.save(); x.globalAlpha = .42; x.filter = 'blur(4px)'; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 8, py + 4, s * .85, s * .34, 0, 0, U.TAU); x.fill();
      x.restore();
      /* trunk */
      const top = proj(px, py, s * 1.5);
      x.strokeStyle = '#4a3624'; x.lineWidth = Math.max(3, s * .17); x.lineCap = 'round';
      x.beginPath(); x.moveTo(px, py); x.lineTo(top.x, top.y + s * .5); x.stroke();
      /* canopy — layered blobs */
      const cols = season === 'autumn'
        ? ['#c9621f', '#e08a1e', '#a8431a', '#d9a020']
        : season === 'winter' ? null
        : ['#1f4d24', '#2d6b30', '#3d8a3c', '#54a04a'];
      if (!cols) {
        /* bare winter branches */
        x.strokeStyle = '#3a2c1e'; x.lineWidth = 2;
        for (let k = 0; k < 9; k++) {
          const a = -Math.PI / 2 + (r() - .5) * 2.2, L = s * (.5 + r() * .8);
          x.beginPath(); x.moveTo(top.x, top.y + s * .5);
          x.lineTo(top.x + Math.cos(a) * L, top.y + s * .5 + Math.sin(a) * L * .8);
          x.stroke();
        }
        return;
      }
      for (let k = 0; k < 11; k++) {
        const a = r() * U.TAU, d = r() * s * .72;
        const cx2 = top.x + Math.cos(a) * d, cy2 = top.y + Math.sin(a) * d * .74;
        x.fillStyle = cols[(r() * cols.length) | 0];
        x.globalAlpha = .82;
        x.beginPath(); x.arc(cx2, cy2, s * (.32 + r() * .3), 0, U.TAU); x.fill();
      }
      x.globalAlpha = 1;
      /* key light on top-left of canopy */
      x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .3;
      x.fillStyle = season === 'autumn' ? '#ffd07a' : '#9ede7a';
      x.beginPath(); x.arc(top.x - s * .28, top.y - s * .3, s * .42, 0, U.TAU); x.fill();
      x.restore();
    },

    lamp(x, px, py, s, pal, r, night) {
      const h = 74 * s;
      const top = proj(px, py, h);
      x.save(); x.globalAlpha = .4; x.filter = 'blur(3px)'; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 4, py + 2, 8 * s, 4 * s, 0, 0, U.TAU); x.fill();
      x.restore();
      x.strokeStyle = '#1e232d'; x.lineWidth = 4 * s; x.lineCap = 'round';
      x.beginPath(); x.moveTo(px, py); x.lineTo(top.x, top.y); x.stroke();
      x.strokeStyle = '#2a3240'; x.lineWidth = 3 * s;
      x.beginPath(); x.moveTo(top.x, top.y);
      x.quadraticCurveTo(top.x + 10 * s, top.y - 8 * s, top.x + 20 * s, top.y - 4 * s);
      x.stroke();
      x.fillStyle = night > .25 ? '#ffe9a8' : '#4d5566';
      x.beginPath(); x.ellipse(top.x + 21 * s, top.y - 3 * s, 6 * s, 3.4 * s, 0, 0, U.TAU); x.fill();
    },

    hydrant(x, px, py, s, pal) {
      x.save(); x.globalAlpha = .4; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 3, py + 2, 7 * s, 3.4 * s, 0, 0, U.TAU); x.fill();
      x.restore();
      const g = x.createLinearGradient(px - 6 * s, 0, px + 6 * s, 0);
      g.addColorStop(0, '#8e1a12'); g.addColorStop(.4, '#e04a30'); g.addColorStop(1, '#7a1410');
      x.fillStyle = g;
      x.beginPath();
      x.roundRect(px - 5 * s, py - 17 * s, 10 * s, 17 * s, 3 * s);
      x.fill();
      x.beginPath(); x.arc(px, py - 17 * s, 5 * s, Math.PI, 0); x.fill();
      x.fillStyle = '#a82a1c';
      x.fillRect(px - 8 * s, py - 12 * s, 16 * s, 3.5 * s);
      x.fillStyle = U.rgba(255, 255, 255, .3);
      x.fillRect(px - 3.4 * s, py - 16 * s, 1.8 * s, 13 * s);
    },

    trash(x, px, py, s) {
      x.save(); x.globalAlpha = .4; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 4, py + 2, 11 * s, 5 * s, 0, 0, U.TAU); x.fill();
      x.restore();
      x.fillStyle = '#2f3b33';
      x.beginPath(); x.moveTo(px - 9 * s, py); x.lineTo(px - 7 * s, py - 22 * s);
      x.lineTo(px + 7 * s, py - 22 * s); x.lineTo(px + 9 * s, py); x.closePath(); x.fill();
      x.strokeStyle = '#1a231d'; x.lineWidth = 1.4 * s;
      for (let k = -6; k <= 6; k += 3) { x.beginPath(); x.moveTo(px + k * s, py - 1 * s); x.lineTo(px + k * s * .8, py - 21 * s); x.stroke(); }
      x.fillStyle = '#47564a';
      x.beginPath(); x.ellipse(px, py - 22 * s, 8 * s, 3.2 * s, 0, 0, U.TAU); x.fill();
    },

    bench(x, px, py, s, rot) {
      x.save(); x.translate(px, py); x.rotate(rot || 0);
      x.globalAlpha = .4; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(3, 3, 26 * s, 8 * s, 0, 0, U.TAU); x.fill();
      x.globalAlpha = 1;
      x.fillStyle = '#5a3f26';
      for (let k = 0; k < 4; k++) x.fillRect(-24 * s, -6 * s + k * 4 * s, 48 * s, 3 * s);
      x.fillStyle = '#3a2a1a';
      x.fillRect(-22 * s, -18 * s, 4 * s, 14 * s);
      x.fillRect(18 * s, -18 * s, 4 * s, 14 * s);
      for (let k = 0; k < 3; k++) x.fillRect(-24 * s, -18 * s + k * 4 * s, 48 * s, 2.6 * s);
      x.restore();
    },

    car(x, px, py, s, rot, col) {
      x.save(); x.translate(px, py); x.rotate(rot || 0);
      x.globalAlpha = .45; x.filter = 'blur(3px)'; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(4, 4, 30 * s, 14 * s, 0, 0, U.TAU); x.fill();
      x.filter = 'none'; x.globalAlpha = 1;
      /* body */
      const g = x.createLinearGradient(0, -13 * s, 0, 13 * s);
      g.addColorStop(0, U.shade(col, 1.35)); g.addColorStop(.42, col); g.addColorStop(1, U.shade(col, .55));
      x.fillStyle = g;
      x.beginPath(); x.roundRect(-28 * s, -12 * s, 56 * s, 24 * s, 7 * s); x.fill();
      /* greenhouse */
      x.fillStyle = U.rgba(20, 30, 45, .88);
      x.beginPath(); x.roundRect(-13 * s, -9 * s, 24 * s, 18 * s, 4 * s); x.fill();
      x.fillStyle = U.rgba(160, 200, 255, .22);
      x.beginPath(); x.roundRect(-12 * s, -8 * s, 22 * s, 7 * s, 3 * s); x.fill();
      /* trim */
      x.strokeStyle = U.rgba(255, 255, 255, .3); x.lineWidth = 1.2 * s;
      x.beginPath(); x.roundRect(-28 * s, -12 * s, 56 * s, 24 * s, 7 * s); x.stroke();
      /* wheels */
      x.fillStyle = '#14171d';
      [-17, 17].forEach(wx => { [-13, 13].forEach(wy => {
        x.beginPath(); x.ellipse(wx * s, wy * s, 6 * s, 3.4 * s, 0, 0, U.TAU); x.fill();
      }); });
      /* lights */
      x.fillStyle = '#ffeeb0'; x.beginPath(); x.ellipse(28 * s, -7 * s, 2.4 * s, 2 * s, 0, 0, U.TAU); x.fill();
      x.beginPath(); x.ellipse(28 * s, 7 * s, 2.4 * s, 2 * s, 0, 0, U.TAU); x.fill();
      x.fillStyle = '#ff4433'; x.beginPath(); x.ellipse(-28 * s, -7 * s, 2 * s, 1.8 * s, 0, 0, U.TAU); x.fill();
      x.beginPath(); x.ellipse(-28 * s, 7 * s, 2 * s, 1.8 * s, 0, 0, U.TAU); x.fill();
      x.restore();
    },

    taxi(x, px, py, s, rot) {
      PROP.car(x, px, py, s, rot, '#ffc21a');
      x.save(); x.translate(px, py); x.rotate(rot || 0);
      x.fillStyle = '#1b1b1b';
      x.fillRect(-6 * s, -14 * s, 12 * s, 4 * s);
      x.fillStyle = '#fff'; x.font = `bold ${5 * s}px ${'Helvetica,Arial'}`;
      x.textAlign = 'center'; x.fillText('TAXI', 0, -10.6 * s);
      /* checker stripe */
      x.fillStyle = '#111';
      for (let k = 0; k < 7; k++) x.fillRect(-24 * s + k * 7 * s, (k % 2 ? 9 : 11.5) * s, 6 * s, 2.4 * s);
      x.restore();
    },

    subwayEnt(x, px, py, s, night) {
      x.save(); x.globalAlpha = .55; x.filter = 'blur(5px)'; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 6, py + 4, 34 * s, 16 * s, 0, 0, U.TAU); x.fill();
      x.restore();
      /* stair void */
      x.fillStyle = '#05070b';
      x.beginPath(); x.roundRect(px - 26 * s, py - 14 * s, 52 * s, 28 * s, 4 * s); x.fill();
      for (let k = 0; k < 5; k++) {
        x.fillStyle = U.rgba(60, 70, 90, .5 - k * .09);
        x.fillRect(px - 24 * s, py - 12 * s + k * 5 * s, 48 * s, 3 * s);
      }
      /* railing */
      const t1 = proj(px - 26 * s, py - 14 * s, 22), t2 = proj(px + 26 * s, py - 14 * s, 22);
      x.strokeStyle = '#39424f'; x.lineWidth = 3.4 * s;
      x.beginPath(); x.moveTo(px - 26 * s, py - 14 * s); x.lineTo(t1.x, t1.y);
      x.lineTo(t2.x, t2.y); x.lineTo(px + 26 * s, py - 14 * s); x.stroke();
      /* globe lamp */
      const gl = proj(px + 30 * s, py, 46);
      x.strokeStyle = '#2b333f'; x.lineWidth = 3 * s;
      x.beginPath(); x.moveTo(px + 30 * s, py); x.lineTo(gl.x, gl.y); x.stroke();
      x.fillStyle = night > .25 ? '#66e07a' : '#3c7a48';
      x.beginPath(); x.arc(gl.x, gl.y - 5 * s, 7 * s, 0, U.TAU); x.fill();
      if (night > .25) {
        x.save(); x.globalCompositeOperation = 'lighter';
        const g = x.createRadialGradient(gl.x, gl.y - 5 * s, 0, gl.x, gl.y - 5 * s, 34 * s);
        g.addColorStop(0, U.rgba(90, 255, 130, .45)); g.addColorStop(1, U.rgba(90, 255, 130, 0));
        x.fillStyle = g; x.beginPath(); x.arc(gl.x, gl.y - 5 * s, 34 * s, 0, U.TAU); x.fill();
        x.restore();
      }
    },

    scaffold(x, px, py, s, len, rot) {
      x.save(); x.translate(px, py); x.rotate(rot || 0);
      const h = 46 * s;
      const top = -h * RISE;
      x.globalAlpha = .45; x.fillStyle = '#000';
      x.fillRect(-len / 2, -6 * s, len, 14 * s);
      x.globalAlpha = 1;
      /* deck */
      x.fillStyle = '#3f4a3a';
      x.fillRect(-len / 2, top - 8 * s, len, 10 * s);
      x.fillStyle = '#586a4f';
      x.fillRect(-len / 2, top - 10 * s, len, 3 * s);
      /* posts */
      x.strokeStyle = '#4a5560'; x.lineWidth = 4 * s;
      for (let px2 = -len / 2 + 8; px2 < len / 2; px2 += 46 * s) {
        x.beginPath(); x.moveTo(px2, 0); x.lineTo(px2, top); x.stroke();
      }
      /* under-deck lamps */
      for (let px2 = -len / 2 + 26; px2 < len / 2; px2 += 92 * s) {
        x.fillStyle = '#ffe08a';
        x.beginPath(); x.ellipse(px2, top + 3 * s, 4 * s, 2 * s, 0, 0, U.TAU); x.fill();
      }
      x.restore();
    },

    planter(x, px, py, s) {
      x.save(); x.globalAlpha = .4; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 3, py + 2, 15 * s, 6 * s, 0, 0, U.TAU); x.fill(); x.restore();
      x.fillStyle = '#6d6257';
      x.beginPath(); x.roundRect(px - 13 * s, py - 14 * s, 26 * s, 15 * s, 2 * s); x.fill();
      x.fillStyle = '#847768'; x.fillRect(px - 14 * s, py - 16 * s, 28 * s, 3 * s);
      for (let k = 0; k < 7; k++) {
        x.fillStyle = k % 2 ? '#2f6b30' : '#3d8a3c';
        x.beginPath(); x.arc(px - 9 * s + k * 3 * s, py - 18 * s - (k % 3) * 2 * s, 4 * s, 0, U.TAU); x.fill();
      }
    },

    cone(x, px, py, s) {
      x.save(); x.globalAlpha = .4; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 2, py + 1, 7 * s, 3 * s, 0, 0, U.TAU); x.fill(); x.restore();
      x.fillStyle = '#e8571f';
      x.beginPath(); x.moveTo(px - 7 * s, py); x.lineTo(px, py - 20 * s); x.lineTo(px + 7 * s, py); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.fillRect(px - 4.4 * s, py - 12 * s, 8.8 * s, 3.4 * s);
      x.fillStyle = '#b8410f'; x.fillRect(px - 9 * s, py - 2 * s, 18 * s, 3 * s);
    },

    lantern(x, px, py, s, night) {
      const top = proj(px, py, 60);
      x.strokeStyle = '#2a2018'; x.lineWidth = 3 * s;
      x.beginPath(); x.moveTo(px, py); x.lineTo(top.x, top.y); x.stroke();
      for (let k = 0; k < 2; k++) {
        const lx = top.x + (k ? 14 : -14) * s, ly = top.y + 4 * s;
        x.fillStyle = night > .2 ? '#ff5b45' : '#8a2f24';
        x.beginPath(); x.ellipse(lx, ly, 7 * s, 9 * s, 0, 0, U.TAU); x.fill();
        x.strokeStyle = '#ffd76a'; x.lineWidth = 1;
        x.beginPath(); x.ellipse(lx, ly, 7 * s, 9 * s, 0, 0, U.TAU); x.stroke();
        if (night > .2) {
          x.save(); x.globalCompositeOperation = 'lighter';
          const g = x.createRadialGradient(lx, ly, 0, lx, ly, 30 * s);
          g.addColorStop(0, U.rgba(255, 90, 60, .4)); g.addColorStop(1, U.rgba(255, 90, 60, 0));
          x.fillStyle = g; x.beginPath(); x.arc(lx, ly, 30 * s, 0, U.TAU); x.fill(); x.restore();
        }
      }
    },

    newsstand(x, px, py, s, night) {
      x.save(); x.globalAlpha = .5; x.filter = 'blur(4px)'; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 6, py + 5, 30 * s, 13 * s, 0, 0, U.TAU); x.fill(); x.restore();
      building(x, px, py, 46 * s, 26 * s, 40 * s, {
        col: '#2c5b46', style: 'stone', floors: 1, night: night, roof: 'flat'
      }, U.rng(77));
      const t = proj(px, py - 13 * s, 40 * s);
      x.fillStyle = night > .3 ? '#ffcf6a' : '#8d9099';
      x.fillRect(t.x - 20 * s, t.y + 2 * s, 40 * s, 7 * s);
      x.fillStyle = '#1b1b1b'; x.font = `bold ${6 * s}px Helvetica,Arial`; x.textAlign = 'center';
      x.fillText('NEWS', t.x, t.y + 7.4 * s);
    },

    /* the golden apple you are defending */
    apple(x, px, py, s, t) {
      const bob = Math.sin(t * 1.6) * 3 * s;
      const py2 = py + bob;
      /* shadow */
      x.save(); x.globalAlpha = .5; x.filter = 'blur(7px)'; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 5, py + 12 * s, 34 * s, 13 * s, 0, 0, U.TAU); x.fill();
      x.restore();
      /* pedestal */
      x.fillStyle = '#242c3a';
      x.beginPath(); x.ellipse(px, py + 10 * s, 38 * s, 15 * s, 0, 0, U.TAU); x.fill();
      x.fillStyle = '#3a4657';
      x.beginPath(); x.ellipse(px, py + 6 * s, 34 * s, 13 * s, 0, 0, U.TAU); x.fill();
      x.strokeStyle = U.rgba(255, 194, 26, .5); x.lineWidth = 2;
      x.beginPath(); x.ellipse(px, py + 6 * s, 34 * s, 13 * s, 0, 0, U.TAU); x.stroke();

      /* body */
      const g = x.createRadialGradient(px - 12 * s, py2 - 20 * s, 2 * s, px, py2 - 6 * s, 44 * s);
      g.addColorStop(0, '#fff3b8');
      g.addColorStop(.32, '#ffd23f');
      g.addColorStop(.72, '#e8960f');
      g.addColorStop(1, '#7d4a06');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(px, py2 - 34 * s);
      x.bezierCurveTo(px - 34 * s, py2 - 40 * s, px - 36 * s, py2 + 4 * s, px, py2 + 8 * s);
      x.bezierCurveTo(px + 36 * s, py2 + 4 * s, px + 34 * s, py2 - 40 * s, px, py2 - 34 * s);
      x.fill();
      /* cleft */
      x.save(); x.globalAlpha = .25; x.strokeStyle = '#6b3d04'; x.lineWidth = 3 * s;
      x.beginPath(); x.moveTo(px, py2 - 30 * s); x.quadraticCurveTo(px - 4 * s, py2 - 12 * s, px, py2 + 4 * s); x.stroke();
      x.restore();
      /* specular */
      x.save(); x.globalAlpha = .55; x.fillStyle = '#fffdf0';
      x.beginPath(); x.ellipse(px - 12 * s, py2 - 20 * s, 8 * s, 12 * s, -.5, 0, U.TAU); x.fill();
      x.restore();
      /* stem + leaf */
      x.strokeStyle = '#4a3117'; x.lineWidth = 4 * s; x.lineCap = 'round';
      x.beginPath(); x.moveTo(px + 1 * s, py2 - 32 * s);
      x.quadraticCurveTo(px + 5 * s, py2 - 44 * s, px + 1 * s, py2 - 50 * s); x.stroke();
      x.fillStyle = '#2f8a3a';
      x.beginPath();
      x.ellipse(px + 13 * s, py2 - 45 * s, 12 * s, 6 * s, -.55, 0, U.TAU);
      x.fill();
      x.strokeStyle = '#1d5c26'; x.lineWidth = 1.2 * s;
      x.beginPath(); x.moveTo(px + 3 * s, py2 - 42 * s); x.lineTo(px + 22 * s, py2 - 49 * s); x.stroke();

      /* halo */
      x.save(); x.globalCompositeOperation = 'lighter';
      const hg = x.createRadialGradient(px, py2 - 14 * s, 0, px, py2 - 14 * s, 90 * s);
      hg.addColorStop(0, U.rgba(255, 200, 60, .22));
      hg.addColorStop(1, U.rgba(255, 200, 60, 0));
      x.fillStyle = hg; x.beginPath(); x.arc(px, py2 - 14 * s, 90 * s, 0, U.TAU); x.fill();
      x.restore();
    }
  };

  /* ==========================================================
     LANDMARKS
     Each is a signature silhouette so a district reads instantly.
     ========================================================== */
  const LAND = {

    liberty(x, px, py, s, night) {
      const H = 300 * s;
      const t = proj(px, py, H);
      /* pedestal */
      building(x, px, py, 90 * s, 66 * s, 120 * s, { col: '#5d5a52', style: 'stone', floors: 4, night: night * .3, roof: 'flat' }, U.rng(5));
      const base = proj(px, py, 120 * s);
      /* robe */
      const g = x.createLinearGradient(base.x - 40 * s, base.y, base.x + 40 * s, base.y - 180 * s);
      g.addColorStop(0, '#3f7f74'); g.addColorStop(.45, '#6fb5a4'); g.addColorStop(1, '#2e6058');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(base.x - 34 * s, base.y);
      x.quadraticCurveTo(base.x - 26 * s, base.y - 90 * s, base.x - 13 * s, base.y - 150 * s);
      x.lineTo(base.x + 13 * s, base.y - 150 * s);
      x.quadraticCurveTo(base.x + 26 * s, base.y - 90 * s, base.x + 34 * s, base.y);
      x.closePath(); x.fill();
      /* folds */
      x.strokeStyle = U.rgba(20, 60, 55, .45); x.lineWidth = 2 * s;
      for (let k = -3; k <= 3; k++) {
        x.beginPath();
        x.moveTo(base.x + k * 9 * s, base.y);
        x.quadraticCurveTo(base.x + k * 7 * s, base.y - 80 * s, base.x + k * 4 * s, base.y - 148 * s);
        x.stroke();
      }
      /* head + crown */
      const hy = base.y - 168 * s;
      x.fillStyle = '#79c0ae';
      x.beginPath(); x.ellipse(base.x, hy, 15 * s, 18 * s, 0, 0, U.TAU); x.fill();
      x.strokeStyle = '#8ed3c0'; x.lineWidth = 3 * s;
      for (let k = -3; k <= 3; k++) {
        const a = -Math.PI / 2 + k * .34;
        x.beginPath(); x.moveTo(base.x + Math.cos(a) * 14 * s, hy + Math.sin(a) * 16 * s);
        x.lineTo(base.x + Math.cos(a) * 30 * s, hy + Math.sin(a) * 32 * s); x.stroke();
      }
      /* torch arm */
      x.strokeStyle = '#5fa696'; x.lineWidth = 11 * s; x.lineCap = 'round';
      x.beginPath(); x.moveTo(base.x + 10 * s, base.y - 140 * s);
      x.lineTo(base.x + 40 * s, base.y - 205 * s); x.stroke();
      const tx = base.x + 44 * s, ty = base.y - 218 * s;
      x.fillStyle = '#c9a233';
      x.beginPath(); x.moveTo(tx - 8 * s, ty + 12 * s); x.lineTo(tx + 8 * s, ty + 12 * s);
      x.lineTo(tx + 5 * s, ty - 2 * s); x.lineTo(tx - 5 * s, ty - 2 * s); x.closePath(); x.fill();
      /* flame */
      x.save(); x.globalCompositeOperation = 'lighter';
      const fg = x.createRadialGradient(tx, ty - 8 * s, 0, tx, ty - 8 * s, 44 * s);
      fg.addColorStop(0, U.rgba(255, 240, 190, .95));
      fg.addColorStop(.25, U.rgba(255, 190, 70, .6));
      fg.addColorStop(1, U.rgba(255, 150, 40, 0));
      x.fillStyle = fg; x.beginPath(); x.arc(tx, ty - 8 * s, 44 * s, 0, U.TAU); x.fill();
      x.restore();
      /* tablet */
      x.save(); x.translate(base.x - 26 * s, base.y - 118 * s); x.rotate(-.4);
      x.fillStyle = '#5aa091'; x.fillRect(-13 * s, -18 * s, 26 * s, 36 * s);
      x.strokeStyle = '#2f6b5f'; x.lineWidth = 2 * s; x.strokeRect(-13 * s, -18 * s, 26 * s, 36 * s);
      x.restore();
    },

    bridgeTower(x, px, py, s, night) {
      const H = 250 * s;
      /* granite tower */
      building(x, px, py, 74 * s, 52 * s, H, { col: '#7a6a5c', style: 'stone', floors: 9, night: 0, roof: 'flat' }, U.rng(9));
      const t = proj(px, py, H);
      /* two gothic arches punched in the face */
      const fb = proj(px, py + 26 * s, 0);
      x.save();
      [-1, 1].forEach(sd => {
        const ax = px + sd * 19 * s;
        const a0 = proj(ax, py + 26 * s, 0);
        const a1 = proj(ax, py + 26 * s, H * .62);
        x.fillStyle = '#171b24';
        x.beginPath();
        x.moveTo(a0.x - 13 * s, a0.y);
        x.lineTo(a0.x - 13 * s, a1.y + 20 * s);
        x.quadraticCurveTo(a1.x, a1.y - 16 * s, a0.x + 13 * s, a1.y + 20 * s);
        x.lineTo(a0.x + 13 * s, a0.y);
        x.closePath(); x.fill();
        x.strokeStyle = U.rgba(255, 255, 255, .12); x.lineWidth = 2; x.stroke();
      });
      x.restore();
      /* cables */
      x.strokeStyle = U.rgba(230, 235, 245, .55); x.lineWidth = 2.4 * s;
      for (let k = 0; k < 12; k++) {
        x.beginPath();
        x.moveTo(t.x, t.y + 6 * s);
        x.lineTo(t.x - 320 * s + k * 12 * s, py + 40 * s);
        x.stroke();
        x.beginPath();
        x.moveTo(t.x, t.y + 6 * s);
        x.lineTo(t.x + 320 * s - k * 12 * s, py + 40 * s);
        x.stroke();
      }
      x.strokeStyle = U.rgba(255, 255, 255, .8); x.lineWidth = 4 * s;
      x.beginPath();
      x.moveTo(t.x - 400 * s, py + 10 * s);
      x.quadraticCurveTo(t.x - 200 * s, py - 30 * s, t.x, t.y + 6 * s);
      x.quadraticCurveTo(t.x + 200 * s, py - 30 * s, t.x + 400 * s, py + 10 * s);
      x.stroke();
    },

    empire(x, px, py, s, night) {
      const H = 330 * s;
      building(x, px, py, 96 * s, 70 * s, H * .62, { col: '#8d8377', style: 'stone', floors: 22, night, roof: 'flat' }, U.rng(21));
      const p1 = proj(px, py, H * .62);
      building(x, px, py - (py - p1.y) * 0, 66 * s, 48 * s, H * .84, { col: '#95897b', style: 'stone', floors: 12, night, roof: 'flat' }, U.rng(22));
      building(x, px, py, 40 * s, 30 * s, H, { col: '#9c9083', style: 'stone', floors: 8, night, roof: 'spire' }, U.rng(23));
      const t = proj(px, py, H);
      /* mast */
      x.strokeStyle = '#b9c0cc'; x.lineWidth = 5 * s;
      x.beginPath(); x.moveTo(t.x, t.y); x.lineTo(t.x, t.y - 60 * s); x.stroke();
      x.strokeStyle = '#8d95a2'; x.lineWidth = 2.4 * s;
      for (let k = 1; k < 5; k++) {
        const yy = t.y - k * 12 * s;
        x.beginPath(); x.moveTo(t.x - (6 - k) * 2.2 * s, yy); x.lineTo(t.x + (6 - k) * 2.2 * s, yy); x.stroke();
      }
      /* beacon */
      x.save(); x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(t.x, t.y - 62 * s, 0, t.x, t.y - 62 * s, 60 * s);
      g.addColorStop(0, U.rgba(255, 90, 80, .85)); g.addColorStop(1, U.rgba(255, 60, 60, 0));
      x.fillStyle = g; x.beginPath(); x.arc(t.x, t.y - 62 * s, 60 * s, 0, U.TAU); x.fill();
      /* crown floodlights */
      if (night > .3) {
        const cg = x.createRadialGradient(t.x, t.y + 20 * s, 0, t.x, t.y + 20 * s, 130 * s);
        cg.addColorStop(0, U.rgba(120, 170, 255, .35)); cg.addColorStop(1, U.rgba(120, 170, 255, 0));
        x.fillStyle = cg; x.beginPath(); x.arc(t.x, t.y + 20 * s, 130 * s, 0, U.TAU); x.fill();
      }
      x.restore();
    },

    flatiron(x, px, py, s, night) {
      const H = 210 * s;
      /* wedge footprint — draw as a triangular prism */
      const f = [{ x: px - 52 * s, y: py + 30 * s }, { x: px + 52 * s, y: py + 30 * s }, { x: px, y: py - 44 * s }];
      const rf = f.map(p => proj(p.x, p.y, H));
      x.save(); x.globalAlpha = .5; x.filter = 'blur(6px)'; x.fillStyle = '#000';
      x.beginPath(); x.ellipse(px + 6, py + 22 * s, 62 * s, 26 * s, 0, 0, U.TAU); x.fill(); x.restore();
      for (let i = 0; i < 3; i++) {
        const a = f[i], b = f[(i + 1) % 3];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        let nx = b.y - a.y, ny = -(b.x - a.x);
        const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
        if (nx * (mx - NADIR_X) + ny * (my - NADIR_Y) <= 0) continue;
        const q = [a, b, rf[(i + 1) % 3], rf[i]];
        const light = U.clamp(.42 + (-nx * .45 - ny * .62), .2, 1);
        const g = x.createLinearGradient(a.x, a.y, rf[i].x, rf[i].y);
        g.addColorStop(0, U.shade('#9b8367', .6 * light + .2));
        g.addColorStop(1, U.shade('#b59c7d', .7 * light + .35));
        quadFill(x, q, g);
        x.save();
        x.beginPath(); x.moveTo(q[0].x, q[0].y); for (let k = 1; k < 4; k++) x.lineTo(q[k].x, q[k].y);
        x.closePath(); x.clip();
        const cols = 7, floors = 20;
        for (let fl = 0; fl < floors; fl++) for (let c = 0; c < cols; c++) {
          const u = (c + .5) / cols, v = (fl + .5) / floors;
          const w0 = quadPt(q, u - .035, v - .018), w1 = quadPt(q, u + .035, v - .018);
          const w2 = quadPt(q, u + .035, v + .018), w3 = quadPt(q, u - .035, v + .018);
          quadFill(x, [w0, w1, w2, w3], Math.random() < night * .5 ? U.rgba(255, 214, 140, .9) : U.rgba(14, 18, 28, .8));
        }
        x.restore();
      }
      x.beginPath(); x.moveTo(rf[0].x, rf[0].y); x.lineTo(rf[1].x, rf[1].y); x.lineTo(rf[2].x, rf[2].y);
      x.closePath(); x.fillStyle = '#a8987f'; x.fill();
      x.strokeStyle = U.rgba(255, 255, 255, .25); x.lineWidth = 2; x.stroke();
    },

    unisphere(x, px, py, s, night) {
      const cy2 = py - 96 * s, R = 74 * s;
      /* tripod */
      x.strokeStyle = '#6d757f'; x.lineWidth = 7 * s;
      [-1, 0, 1].forEach(k => {
        x.beginPath(); x.moveTo(px + k * 40 * s, py); x.lineTo(px, cy2 + R * .7); x.stroke();
      });
      /* globe cage */
      x.strokeStyle = '#9aa5b4'; x.lineWidth = 2.4 * s;
      x.beginPath(); x.arc(px, cy2, R, 0, U.TAU); x.stroke();
      for (let k = 1; k < 6; k++) {
        const rr = R * Math.sin(k * Math.PI / 6);
        const yy = cy2 - R * Math.cos(k * Math.PI / 6);
        x.beginPath(); x.ellipse(px, yy, rr, rr * .3, 0, 0, U.TAU); x.stroke();
      }
      for (let k = 0; k < 8; k++) {
        const w2 = R * Math.abs(Math.cos(k * Math.PI / 8));
        x.beginPath(); x.ellipse(px, cy2, w2, R, 0, 0, U.TAU); x.stroke();
      }
      /* continents */
      x.fillStyle = U.rgba(120, 200, 150, .32);
      const r = U.rng(404);
      for (let k = 0; k < 7; k++) {
        x.beginPath();
        x.ellipse(px + (r() - .5) * R * 1.2, cy2 + (r() - .5) * R * 1.4, R * (.12 + r() * .2), R * (.1 + r() * .16), r() * 3, 0, U.TAU);
        x.fill();
      }
      /* rings */
      x.strokeStyle = U.rgba(200, 215, 235, .55); x.lineWidth = 3 * s;
      [-.5, .3].forEach(tt => {
        x.save(); x.translate(px, cy2); x.rotate(tt);
        x.beginPath(); x.ellipse(0, 0, R * 1.25, R * .34, 0, 0, U.TAU); x.stroke();
        x.restore();
      });
      if (night > .2) {
        x.save(); x.globalCompositeOperation = 'lighter';
        const g = x.createRadialGradient(px, cy2, 0, px, cy2, R * 2.2);
        g.addColorStop(0, U.rgba(140, 190, 255, .22)); g.addColorStop(1, U.rgba(140, 190, 255, 0));
        x.fillStyle = g; x.beginPath(); x.arc(px, cy2, R * 2.2, 0, U.TAU); x.fill(); x.restore();
      }
    },

    wonderwheel(x, px, py, s, night) {
      const cy2 = py - 128 * s, R = 104 * s;
      x.strokeStyle = '#3c4654'; x.lineWidth = 8 * s;
      [-1, 1].forEach(k => { x.beginPath(); x.moveTo(px + k * 52 * s, py); x.lineTo(px, cy2); x.stroke(); });
      /* rim */
      x.strokeStyle = night > .2 ? '#ff4d6d' : '#8d3d4d'; x.lineWidth = 5 * s;
      x.beginPath(); x.arc(px, cy2, R, 0, U.TAU); x.stroke();
      x.strokeStyle = night > .2 ? '#ffd24d' : '#8d7a3d'; x.lineWidth = 3 * s;
      x.beginPath(); x.arc(px, cy2, R * .72, 0, U.TAU); x.stroke();
      /* spokes + cars */
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * U.TAU;
        const ex = px + Math.cos(a) * R, ey = cy2 + Math.sin(a) * R;
        x.strokeStyle = U.rgba(180, 195, 215, .5); x.lineWidth = 1.8 * s;
        x.beginPath(); x.moveTo(px, cy2); x.lineTo(ex, ey); x.stroke();
        x.fillStyle = ['#ff5a4a', '#4ab7ff', '#ffd24d', '#5ee08a'][k % 4];
        x.beginPath(); x.roundRect(ex - 6 * s, ey - 4 * s, 12 * s, 10 * s, 2 * s); x.fill();
        if (night > .2) {
          x.save(); x.globalCompositeOperation = 'lighter';
          const g = x.createRadialGradient(ex, ey, 0, ex, ey, 26 * s);
          g.addColorStop(0, U.rgba(255, 200, 120, .5)); g.addColorStop(1, U.rgba(255, 200, 120, 0));
          x.fillStyle = g; x.beginPath(); x.arc(ex, ey, 26 * s, 0, U.TAU); x.fill(); x.restore();
        }
      }
      x.fillStyle = '#6d7787'; x.beginPath(); x.arc(px, cy2, 10 * s, 0, U.TAU); x.fill();
    },

    coaster(x, px, py, s, night) {
      /* Cyclone-style white timber lift hill */
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const xx = px - 220 * s + t * 440 * s;
        const yy = py - Math.max(0,
          160 * s * Math.exp(-Math.pow((t - .22) * 3.2, 2)) +
          90 * s * Math.exp(-Math.pow((t - .58) * 4.5, 2)) +
          58 * s * Math.exp(-Math.pow((t - .84) * 6, 2)));
        pts.push({ x: xx, y: yy });
      }
      /* trestle */
      x.strokeStyle = U.rgba(235, 238, 244, .55); x.lineWidth = 2 * s;
      for (let k = 0; k < pts.length; k += 2) {
        x.beginPath(); x.moveTo(pts[k].x, pts[k].y + 6 * s); x.lineTo(pts[k].x, py); x.stroke();
        if (k + 2 < pts.length) {
          x.beginPath(); x.moveTo(pts[k].x, py); x.lineTo(pts[k + 2].x, pts[k + 2].y + 6 * s); x.stroke();
        }
      }
      /* track */
      x.strokeStyle = '#f2f4f8'; x.lineWidth = 5 * s; x.lineJoin = 'round';
      x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.stroke();
      x.strokeStyle = '#c8202c'; x.lineWidth = 2 * s;
      x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p.x, p.y + 5 * s) : x.moveTo(p.x, p.y + 5 * s)); x.stroke();
    },

    apollo(x, px, py, s, night) {
      building(x, px, py, 170 * s, 60 * s, 130 * s, { col: '#6f4a3c', style: 'brick', floors: 5, night, escape: true, roof: 'flat' }, U.rng(33));
      const t = proj(px, py + 28 * s, 46 * s);
      /* marquee box */
      x.fillStyle = '#12161f';
      x.beginPath(); x.roundRect(t.x - 84 * s, t.y - 26 * s, 168 * s, 44 * s, 5 * s); x.fill();
      const g = x.createLinearGradient(0, t.y - 26 * s, 0, t.y + 18 * s);
      g.addColorStop(0, night > .2 ? '#ff3b5c' : '#7d2233');
      g.addColorStop(1, night > .2 ? '#c11a38' : '#5a1726');
      x.fillStyle = g;
      x.beginPath(); x.roundRect(t.x - 80 * s, t.y - 22 * s, 160 * s, 36 * s, 4 * s); x.fill();
      x.fillStyle = '#ffe9a8'; x.font = `bold ${17 * s}px Helvetica,Arial`; x.textAlign = 'center';
      x.fillText('APOLLO', t.x, t.y);
      /* bulb chase */
      for (let k = 0; k < 22; k++) {
        const bx = t.x - 82 * s + k * 7.6 * s;
        x.fillStyle = night > .2 ? (k % 2 ? '#fff0b8' : '#ffb84d') : '#5d5340';
        x.beginPath(); x.arc(bx, t.y + 16 * s, 2.4 * s, 0, U.TAU); x.fill();
        x.beginPath(); x.arc(bx, t.y - 24 * s, 2.4 * s, 0, U.TAU); x.fill();
      }
      if (night > .2) {
        x.save(); x.globalCompositeOperation = 'lighter';
        const gg = x.createRadialGradient(t.x, t.y, 0, t.x, t.y, 190 * s);
        gg.addColorStop(0, U.rgba(255, 90, 110, .3)); gg.addColorStop(1, U.rgba(255, 90, 110, 0));
        x.fillStyle = gg; x.beginPath(); x.arc(t.x, t.y, 190 * s, 0, U.TAU); x.fill(); x.restore();
      }
    },

    billboards(x, px, py, s, night, seed) {
      /* Times Square wall of light */
      const r = U.rng(seed || 808);
      const cols = ['#ff2b55', '#00e5ff', '#ffd400', '#7b5cff', '#00ff9d', '#ff6a00'];
      for (let k = 0; k < 7; k++) {
        const bx = px + (k - 3) * 96 * s + (r() - .5) * 30 * s;
        const bh = 130 * s + r() * 130 * s;
        const bw = 66 * s + r() * 30 * s;
        const t = proj(bx, py, bh);
        const col = cols[(r() * cols.length) | 0];
        /* frame */
        x.fillStyle = '#0c0f16';
        x.fillRect(t.x - bw / 2 - 3, t.y - 4, bw + 6, bh * .42 + 8);
        /* screen */
        const g = x.createLinearGradient(t.x, t.y, t.x, t.y + bh * .42);
        g.addColorStop(0, night > .15 ? col : U.shade(col, .34));
        g.addColorStop(1, night > .15 ? U.shade(col, .5) : U.shade(col, .2));
        x.fillStyle = g;
        x.fillRect(t.x - bw / 2, t.y, bw, bh * .42);
        /* scanlines + fake type */
        x.fillStyle = U.rgba(0, 0, 0, .22);
        for (let ly = 0; ly < bh * .42; ly += 4) x.fillRect(t.x - bw / 2, t.y + ly, bw, 1.6);
        x.fillStyle = U.rgba(255, 255, 255, night > .15 ? .8 : .3);
        for (let ln = 0; ln < 3; ln++) {
          const lw = bw * (.3 + r() * .5);
          x.fillRect(t.x - lw / 2, t.y + bh * .1 + ln * bh * .1, lw, bh * .045);
        }
        /* mast */
        x.strokeStyle = '#1a1f2a'; x.lineWidth = 5 * s;
        x.beginPath(); x.moveTo(bx, py); x.lineTo(t.x, t.y + bh * .42); x.stroke();
        if (night > .15) {
          x.save(); x.globalCompositeOperation = 'lighter';
          const gg = x.createRadialGradient(t.x, t.y + bh * .2, 0, t.x, t.y + bh * .2, 150 * s);
          gg.addColorStop(0, U.alpha(col, .34)); gg.addColorStop(1, U.alpha(col, 0));
          x.fillStyle = gg; x.beginPath(); x.arc(t.x, t.y + bh * .2, 150 * s, 0, U.TAU); x.fill();
          x.restore();
        }
      }
    },

    stadium(x, px, py, s, night) {
      /* A ballpark seen from behind home plate: bowl of seats stepping
         down to the warning track, then the frieze along the roofline. */
      x.save();
      x.translate(px, py);
      const A0 = Math.PI * 1.05, A1 = Math.PI * 1.95;
      const arc = (rx, ry, yOff) => { x.beginPath(); x.ellipse(0, yOff, rx, ry, 0, A0, A1); };

      /* outer shell */
      const g = x.createLinearGradient(0, -200 * s, 0, 60 * s);
      g.addColorStop(0, '#cfc9b6'); g.addColorStop(.6, '#a8a394'); g.addColorStop(1, '#6e6a5e');
      x.fillStyle = g;
      arc(430 * s, 200 * s, 0);
      x.lineTo(370 * s, 60 * s); x.lineTo(-370 * s, 60 * s);
      x.closePath(); x.fill();

      /* tiers of seating, stepping inward and getting darker */
      const tiers = [
        { r: 400, y: 14, c: '#1f3f7a' }, { r: 356, y: 26, c: '#24488a' },
        { r: 312, y: 38, c: '#1c3768' }, { r: 268, y: 48, c: '#213f78' }
      ];
      tiers.forEach((tr, i) => {
        x.fillStyle = tr.c;
        arc(tr.r * s, tr.r * .46 * s, tr.y * s);
        x.lineTo(tr.r * .86 * s, 60 * s); x.lineTo(-tr.r * .86 * s, 60 * s);
        x.closePath(); x.fill();
        /* seat rows */
        x.strokeStyle = U.rgba(255, 255, 255, .07); x.lineWidth = 1.4 * s;
        for (let k = 1; k < 7; k++) {
          arc((tr.r - k * 5) * s, (tr.r - k * 5) * .46 * s, (tr.y + k * 1.6) * s);
          x.stroke();
        }
        /* aisles */
        x.strokeStyle = U.rgba(220, 225, 235, .16); x.lineWidth = 2 * s;
        for (let k = 0; k <= 12; k++) {
          const a = A0 + (k / 12) * (A1 - A0);
          x.beginPath();
          x.moveTo(Math.cos(a) * tr.r * s, tr.y * s + Math.sin(a) * tr.r * .46 * s);
          x.lineTo(Math.cos(a) * (tr.r - 34) * s, tr.y * s + Math.sin(a) * (tr.r - 34) * .46 * s);
          x.stroke();
        }
      });

      /* outfield wall + warning track */
      x.fillStyle = '#123a1e';
      arc(250 * s, 116 * s, 52 * s);
      x.lineTo(214 * s, 76 * s); x.lineTo(-214 * s, 76 * s);
      x.closePath(); x.fill();
      x.strokeStyle = '#c08a4a'; x.lineWidth = 9 * s;
      arc(244 * s, 112 * s, 60 * s); x.stroke();

      /* the frieze — the one detail everyone recognises */
      x.strokeStyle = '#f7f4ea'; x.lineWidth = 4 * s;
      arc(430 * s, 200 * s, 0); x.stroke();
      x.fillStyle = '#f7f4ea';
      for (let k = 0; k < 46; k++) {
        const a = A0 + (k / 46) * (A1 - A0);
        const cx2 = Math.cos(a) * 430 * s, cy2 = Math.sin(a) * 200 * s;
        x.beginPath();
        x.arc(cx2, cy2 + 7 * s, 5.4 * s, Math.PI, 0);
        x.fill();
        x.fillRect(cx2 - 5.4 * s, cy2 + 7 * s, 10.8 * s, 5 * s);
      }
      x.restore();
      /* light banks */
      [-1, 1].forEach(sd => {
        const lx = px + sd * 330 * s;
        const t = proj(lx, py - 120 * s, 210 * s);
        x.strokeStyle = '#5a6470'; x.lineWidth = 6 * s;
        x.beginPath(); x.moveTo(lx, py - 120 * s); x.lineTo(t.x, t.y); x.stroke();
        x.fillStyle = '#39424e';
        x.fillRect(t.x - 34 * s, t.y - 22 * s, 68 * s, 26 * s);
        for (let ry = 0; ry < 3; ry++) for (let cx2 = 0; cx2 < 6; cx2++) {
          x.fillStyle = '#fff8dc';
          x.beginPath(); x.arc(t.x - 28 * s + cx2 * 11 * s, t.y - 17 * s + ry * 8 * s, 3.4 * s, 0, U.TAU); x.fill();
        }
        x.save(); x.globalCompositeOperation = 'lighter';
        const gg = x.createRadialGradient(t.x, t.y, 0, t.x, t.y, 300 * s);
        gg.addColorStop(0, U.rgba(255, 245, 210, .28)); gg.addColorStop(1, U.rgba(255, 245, 210, 0));
        x.fillStyle = gg; x.beginPath(); x.arc(t.x, t.y, 300 * s, 0, U.TAU); x.fill(); x.restore();
      });
    },

    terminal(x, px, py, s, night) {
      /* Grand Central concourse: arched windows + celestial ceiling */
      const H = 210 * s;
      building(x, px, py, 300 * s, 90 * s, H, { col: '#a99a80', style: 'stone', floors: 3, night: 0, roof: 'flat' }, U.rng(66));
      const t = proj(px, py + 40 * s, H * .1);
      /* three great arched windows */
      [-1, 0, 1].forEach(k => {
        const ax = px + k * 96 * s;
        const a0 = proj(ax, py + 44 * s, 12 * s);
        const a1 = proj(ax, py + 44 * s, H * .78);
        const g = x.createLinearGradient(0, a1.y, 0, a0.y);
        g.addColorStop(0, night > .2 ? '#ffd98a' : '#cfe4ff');
        g.addColorStop(1, night > .2 ? '#a9711f' : '#7fa4cc');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(a0.x - 40 * s, a0.y);
        x.lineTo(a0.x - 40 * s, a1.y + 42 * s);
        x.quadraticCurveTo(a1.x, a1.y - 40 * s, a0.x + 40 * s, a1.y + 42 * s);
        x.lineTo(a0.x + 40 * s, a0.y);
        x.closePath(); x.fill();
        /* mullions */
        x.strokeStyle = U.rgba(40, 40, 46, .8); x.lineWidth = 3 * s;
        for (let m = -3; m <= 3; m++) {
          x.beginPath(); x.moveTo(a0.x + m * 12 * s, a0.y); x.lineTo(a0.x + m * 12 * s, a1.y + 20 * s); x.stroke();
        }
        for (let m = 1; m < 5; m++) {
          const yy = U.lerp(a0.y, a1.y + 42 * s, m / 5);
          x.beginPath(); x.moveTo(a0.x - 38 * s, yy); x.lineTo(a0.x + 38 * s, yy); x.stroke();
        }
        x.save(); x.globalCompositeOperation = 'lighter';
        const gg = x.createRadialGradient(a1.x, a1.y + 40 * s, 0, a1.x, a1.y + 40 * s, 150 * s);
        gg.addColorStop(0, U.rgba(255, 220, 150, .22)); gg.addColorStop(1, U.rgba(255, 220, 150, 0));
        x.fillStyle = gg; x.beginPath(); x.arc(a1.x, a1.y + 40 * s, 150 * s, 0, U.TAU); x.fill(); x.restore();
      });
      /* clock */
      const ct = proj(px, py + 40 * s, H * .92);
      x.fillStyle = '#c9a94a'; x.beginPath(); x.arc(ct.x, ct.y, 26 * s, 0, U.TAU); x.fill();
      x.fillStyle = '#f2eddc'; x.beginPath(); x.arc(ct.x, ct.y, 21 * s, 0, U.TAU); x.fill();
      x.strokeStyle = '#2a2a30'; x.lineWidth = 2.6 * s; x.lineCap = 'round';
      x.beginPath(); x.moveTo(ct.x, ct.y); x.lineTo(ct.x + 10 * s, ct.y - 6 * s); x.stroke();
      x.beginPath(); x.moveTo(ct.x, ct.y); x.lineTo(ct.x - 3 * s, ct.y - 15 * s); x.stroke();
    },

    ferry(x, px, py, s, night) {
      const L = 250 * s;
      x.save(); x.translate(px, py);
      /* wake */
      x.globalAlpha = .35; x.fillStyle = '#cfe6f5';
      x.beginPath(); x.ellipse(-L * .8, 6 * s, L * .5, 26 * s, 0, 0, U.TAU); x.fill();
      x.globalAlpha = 1;
      /* hull */
      const g = x.createLinearGradient(0, -30 * s, 0, 34 * s);
      g.addColorStop(0, '#ff8a1e'); g.addColorStop(.55, '#e2620d'); g.addColorStop(1, '#8c3a06');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-L / 2, -20 * s); x.lineTo(L / 2 - 30 * s, -20 * s);
      x.quadraticCurveTo(L / 2 + 14 * s, 0, L / 2 - 30 * s, 24 * s);
      x.lineTo(-L / 2, 24 * s); x.closePath(); x.fill();
      /* decks */
      x.fillStyle = '#f0f2f6'; x.fillRect(-L / 2 + 20 * s, -52 * s, L - 80 * s, 32 * s);
      x.fillStyle = '#2b3340';
      for (let k = 0; k < 14; k++) x.fillRect(-L / 2 + 30 * s + k * 12 * s, -46 * s, 7 * s, 12 * s);
      x.fillStyle = '#e8590c'; x.fillRect(-L / 2 + 60 * s, -78 * s, 46 * s, 28 * s);
      /* stack */
      x.fillStyle = '#1e2530'; x.fillRect(L / 2 - 96 * s, -84 * s, 18 * s, 34 * s);
      x.restore();
    },

    tunnelMouth(x, px, py, s, night) {
      const H = 170 * s;
      const t = proj(px, py, H);
      /* arch of black */
      x.fillStyle = '#02040a';
      x.beginPath();
      x.moveTo(px - 110 * s, py + 30 * s);
      x.lineTo(px - 110 * s, t.y + 50 * s);
      x.quadraticCurveTo(t.x, t.y - 46 * s, px + 110 * s, t.y + 50 * s);
      x.lineTo(px + 110 * s, py + 30 * s);
      x.closePath(); x.fill();
      /* tiled ring */
      x.strokeStyle = '#7d8592'; x.lineWidth = 12 * s;
      x.beginPath();
      x.moveTo(px - 116 * s, py + 30 * s);
      x.lineTo(px - 116 * s, t.y + 50 * s);
      x.quadraticCurveTo(t.x, t.y - 54 * s, px + 116 * s, t.y + 50 * s);
      x.lineTo(px + 116 * s, py + 30 * s);
      x.stroke();
      x.strokeStyle = '#39414d'; x.lineWidth = 2 * s;
      for (let k = 0; k <= 18; k++) {
        const a = Math.PI + (k / 18) * Math.PI;
        x.beginPath();
        x.moveTo(t.x + Math.cos(a) * 104 * s, t.y + 30 * s + Math.sin(a) * 86 * s);
        x.lineTo(t.x + Math.cos(a) * 124 * s, t.y + 30 * s + Math.sin(a) * 104 * s);
        x.stroke();
      }
      /* headlight deep in the dark */
      x.save(); x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(t.x, t.y + 60 * s, 0, t.x, t.y + 60 * s, 90 * s);
      g.addColorStop(0, U.rgba(255, 240, 190, .5)); g.addColorStop(1, U.rgba(255, 240, 190, 0));
      x.fillStyle = g; x.beginPath(); x.arc(t.x, t.y + 60 * s, 90 * s, 0, U.TAU); x.fill();
      x.restore();
    },

    arch(x, px, py, s, night) {
      /* Washington Square arch */
      const H = 150 * s;
      const t = proj(px, py, H);
      x.fillStyle = '#d9d3c4';
      x.fillRect(px - 78 * s, t.y, 34 * s, py - t.y);
      x.fillRect(px + 44 * s, t.y, 34 * s, py - t.y);
      x.fillRect(px - 84 * s, t.y - 26 * s, 168 * s, 30 * s);
      x.fillStyle = '#bdb6a4'; x.fillRect(px - 90 * s, t.y - 34 * s, 180 * s, 10 * s);
      x.fillStyle = '#0d1017';
      x.beginPath();
      x.moveTo(px - 44 * s, py);
      x.lineTo(px - 44 * s, t.y + 54 * s);
      x.quadraticCurveTo(px, t.y - 6 * s, px + 44 * s, t.y + 54 * s);
      x.lineTo(px + 44 * s, py);
      x.closePath(); x.fill();
      x.strokeStyle = U.rgba(255, 255, 255, .3); x.lineWidth = 2;
      x.stroke();
    }
  };

  /* ==========================================================
     LEVEL BAKING
     Produces three surfaces:
       ground  — everything static, lit for daytime
       shade   — multiply layer for time of day
       glow    — additive layer for practical lights
     ========================================================== */
  function bake(L, onProgress) {
    syncSize();
    const g = U.surface(W, H);
    const x = g.x;
    const r = U.rng(L.buildSeed);
    const pal = L.pal;
    const night = L.night;

    /* Placement mask: 0 = a weapon may be emplaced here.
       Filled in as the road, the buildings and the landmark go down. */
    const mask = new Uint8Array(GW * GH);
    const markDisc = (cx, cy, rad) => {
      const c0 = Math.max(0, Math.floor((cx - rad) / CELL));
      const c1 = Math.min(GW - 1, Math.ceil((cx + rad) / CELL));
      const r0 = Math.max(0, Math.floor((cy - rad) / CELL));
      const r1 = Math.min(GH - 1, Math.ceil((cy + rad) / CELL));
      const r2 = rad * rad;
      for (let gy = r0; gy <= r1; gy++) {
        for (let gx = c0; gx <= c1; gx++) {
          const dx = (gx + .5) * CELL - cx, dy = (gy + .5) * CELL - cy;
          if (dx * dx + dy * dy <= r2) mask[gy * GW + gx] = 1;
        }
      }
    };
    const markRect = (cx, cy, hw, hh) => {
      const c0 = Math.max(0, Math.floor((cx - hw) / CELL));
      const c1 = Math.min(GW - 1, Math.ceil((cx + hw) / CELL));
      const r0 = Math.max(0, Math.floor((cy - hh) / CELL));
      const r1 = Math.min(GH - 1, Math.ceil((cy + hh) / CELL));
      for (let gy = r0; gy <= r1; gy++)
        for (let gx = c0; gx <= c1; gx++) mask[gy * GW + gx] = 1;
    };

    /* ---- 1. ground plane ---- */
    (TEX[L.ground] || TEX.asphalt)(x, W, H, pal, L.buildSeed);
    onProgress && onProgress(.18);

    /* ---- 2. the road is off limits, plus a curb margin ---- */
    const roadClear = L.roadW * .5 + 26;
    L.builtPaths.forEach(bp => {
      for (let d = 0; d <= bp.length; d += CELL * .7) {
        const p = U.samplePath(bp, d);
        markDisc(p.x, p.y, roadClear);
      }
    });

    /* ---- 3. roads ---- */
    L.builtPaths.forEach((p, i) => drawRoad(x, p, pal, L.roadW, L.buildSeed + i * 31, L.roadStyle));
    onProgress && onProgress(.34);

    /* ---- 4. scattered city ---- */
    const blocked = (px, py, pad) => {
      for (const bp of L.builtPaths) if (U.distToPath(px, py, bp.pts) < pad) return true;
      if (U.dist(px, py, L.base.x, L.base.y) < 200) return true;
      if (L.landmark && U.dist(px, py, L.landmark.x, L.landmark.y) < (L.landmark.clear || 260)) return true;
      if (L.keepClear) for (const k of L.keepClear) if (U.dist(px, py, k.x, k.y) < k.r) return true;
      return false;
    };

    const placed = [];
    const density = L.cityDensity === undefined ? 46 : L.cityDensity;
    let tries = 0;
    while (placed.length < density && tries < density * 40) {
      tries++;
      let px = r() * (W + 260) - 130;
      let py = r() * (H + 220) - 110;
      if (L.cityEdgeOnly) {
        /* push to the border ring */
        const bx = W * .13, by = H * .15;
        if (r() < .5) px = r() < .5 ? r() * bx - 80 : W - r() * bx + 80;
        else py = r() < .5 ? r() * by - 70 : H - r() * by + 70;
      }
      const bw = 58 + r() * 96, bd = 46 + r() * 74;
      if (blocked(px, py, L.roadW * .5 + Math.max(bw, bd) * .5 + 14)) continue;
      let clash = false;
      for (const p of placed) {
        if (Math.abs(p.x - px) < (p.bw + bw) * .58 && Math.abs(p.y - py) < (p.bd + bd) * .62) { clash = true; break; }
      }
      if (clash) continue;
      placed.push({ x: px, y: py, bw, bd });
    }

    /* far buildings first so near ones overlap correctly */
    placed.sort((a, b) => a.y - b.y);
    const styles = L.bldgStyles || ['brick', 'stone', 'glass'];

    /* Would a volume this tall rise up over a piece of playfield the
       player needs to see? If so, cut it down until it doesn't. */
    const occludes = (px, py, bw, bd, bh) => {
      const topY = proj(px, py - bd / 2, bh).y;
      const halfW = bw * .78 + 10;
      for (const bp of L.builtPaths) {
        for (let k = 0; k < bp.pts.length; k += 3) {
          const q = bp.pts[k];
          if (q.y >= py - bd * .5) continue;                 /* behind us, fine */
          if (q.y < topY - L.roadW) continue;                /* above the roof */
          if (Math.abs(q.x - px) < halfW + L.roadW * .5) return true;
        }
      }
      if (L.base.y < py && L.base.y > topY - 90 && Math.abs(L.base.x - px) < halfW + 90) return true;
      return false;
    };

    placed.forEach((p, i) => {
      const hMul = L.heightMul === undefined ? 1 : L.heightMul;
      let bh = (30 + r() * 155) * hMul;
      /* taller toward the top of the frame = skyline depth */
      bh *= U.lerp(1.12, .6, p.y / H);
      let guard = 0;
      while (bh > 26 && guard++ < 14 && occludes(p.x, p.y, p.bw, p.bd, bh)) bh *= .78;
      const st = styles[(r() * styles.length) | 0];
      building(x, p.x, p.y, p.bw, p.bd, bh, {
        col: pal.bldg[(r() * pal.bldg.length) | 0],
        style: st,
        floors: Math.max(2, Math.round(bh / (st === 'glass' ? 14 : 20))),
        night,
        escape: st === 'brick' && r() < .45,
        roof: r() < .3 ? 'water' : (r() < .5 ? 'ac' : (r() < .12 ? 'spire' : 'flat'))
      }, r);
      /* the footprint, plus a little skirt, is unbuildable */
      markRect(p.x, p.y, p.bw * .5 + 10, p.bd * .5 + 10);
      if (i % 12 === 0) onProgress && onProgress(.34 + .34 * (i / placed.length));
    });
    onProgress && onProgress(.7);

    /* ---- 5. landmark ---- */
    if (L.landmark && LAND[L.landmark.t]) {
      LAND[L.landmark.t](x, L.landmark.x, L.landmark.y, L.landmark.s || 1, night);
      markDisc(L.landmark.x, L.landmark.y, (L.landmark.clear || 260) * .55);
    }
    /* the apple's plinth */
    markDisc(L.base.x, L.base.y, 78);

    /* ---- 6. street furniture along the route ---- */
    const season = L.season || 'summer';
    L.builtPaths.forEach((bp, pi) => {
      const rr = U.rng(L.buildSeed + 700 + pi);
      for (let d = 40; d < bp.length - 40; d += 74 + rr() * 60) {
        const p = U.samplePath(bp, d);
        const side = rr() < .5 ? 1 : -1;
        const off = L.roadW * .5 + 22 + rr() * 16;
        const px = p.x + Math.cos(p.a + Math.PI / 2) * off * side;
        const py = p.y + Math.sin(p.a + Math.PI / 2) * off * side;
        if (px < -40 || px > W + 40 || py < -40 || py > H + 40) continue;
        if (U.dist(px, py, L.base.x, L.base.y) < 110) continue;
        const roll = rr();
        const set = L.propSet || ['lamp', 'hydrant', 'trash', 'tree', 'car'];
        const kind = set[(rr() * set.length) | 0];
        switch (kind) {
          case 'tree':    PROP.tree(x, px, py, 22 + rr() * 14, pal, rr, season); break;
          case 'lamp':    PROP.lamp(x, px, py, .9 + rr() * .35, pal, rr, night); break;
          case 'hydrant': PROP.hydrant(x, px, py, .9 + rr() * .3, pal); break;
          case 'trash':   PROP.trash(x, px, py, .9 + rr() * .3); break;
          case 'bench':   PROP.bench(x, px, py, .9, p.a); break;
          case 'planter': PROP.planter(x, px, py, 1); break;
          case 'cone':    PROP.cone(x, px, py, 1); break;
          case 'lantern': PROP.lantern(x, px, py, 1, night); break;
          case 'car':
            if (roll < .45) PROP.taxi(x, px, py, .82, p.a);
            else PROP.car(x, px, py, .82, p.a, ['#25303f', '#7a2b2b', '#2c4b6e', '#4a4f57', '#8c8e94'][(rr() * 5) | 0]);
            break;
          case 'subway':  PROP.subwayEnt(x, px, py, .9, night); break;
          case 'news':    PROP.newsstand(x, px, py, .9, night); break;
        }
      }
    });

    /* hand-placed props */
    (L.props || []).forEach(p => {
      const fn = PROP[p.t];
      if (!fn) return;
      if (p.t === 'tree') fn(x, p.x, p.y, p.s || 26, pal, U.rng((p.x * 7 + p.y) | 0), season);
      else if (p.t === 'lamp' || p.t === 'subwayEnt' || p.t === 'lantern' || p.t === 'newsstand') fn(x, p.x, p.y, p.s || 1, night);
      else if (p.t === 'bench' || p.t === 'car' || p.t === 'taxi' || p.t === 'scaffold') fn(x, p.x, p.y, p.s || 1, p.rot || 0, p.col || '#3a4351', p.len || 120);
      else fn(x, p.x, p.y, p.s || 1);
    });
    onProgress && onProgress(.86);

    /* ---- 7. global ambient occlusion + colour grade ---- */
    x.save();
    x.globalCompositeOperation = 'multiply';
    const vg = x.createRadialGradient(W / 2, H / 2, H * .40, W / 2, H / 2, H * 1.15);
    vg.addColorStop(0, '#ffffff');
    vg.addColorStop(1, U.mix('#ffffff', pal.grade || '#5a6480', .28));
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
    x.restore();

    /* ---- 8. hard border: nothing may be built off the edge ---- */
    for (let gy = 0; gy < GH; gy++)
      for (let gx = 0; gx < GW; gx++)
        if (gx < 2 || gy < 2 || gx >= GW - 2 || gy >= GH - 2) mask[gy * GW + gx] = 1;

    onProgress && onProgress(1);
    return { ground: g.c, mask, cell: CELL, gw: GW, gh: GH };
  }

  /* Can a weapon with this footprint stand here? */
  function canPlace(L, px, py, radius) {
    if (!L.mask) return false;
    if (px < radius || py < radius || px > W - radius || py > H - radius) return false;
    const step = CELL;
    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const gx = ((px + dx) / CELL) | 0, gy = ((py + dy) / CELL) | 0;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return false;
        if (L.mask[gy * GW + gx]) return false;
      }
    }
    return true;
  }

  /* ---- night lighting layer, rebuilt per level ---- */
  function bakeLights(L) {
    syncSize();
    const s = U.surface(W, H);
    const x = s.x;
    if (L.night <= .05) return null;

    /* Base darkness, punched through by practicals.
       Real night is darker than this, but a player has to be able to
       read a rat against asphalt — so the tint is lifted toward a cool
       blue and applied at partial strength instead of full black. */
    x.fillStyle = U.mix(L.pal.nightTint || '#0a1024', '#42557f', .40);
    x.globalAlpha = 0.26 + 0.46 * L.night;
    x.fillRect(0, 0, W, H);
    x.globalAlpha = 1;

    x.globalCompositeOperation = 'destination-out';
    /* A pool of light is a tight cone, not a fog bank — keep the
       falloff steep or the whole street turns into grey smudge. */
    const light = (px, py, rad, str) => {
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, U.rgba(0, 0, 0, str));
      g.addColorStop(.28, U.rgba(0, 0, 0, str * .46));
      g.addColorStop(.62, U.rgba(0, 0, 0, str * .13));
      g.addColorStop(1, U.rgba(0, 0, 0, 0));
      x.fillStyle = g;
      x.beginPath(); x.arc(px, py, rad, 0, U.TAU); x.fill();
    };

    /* streetlamps along every route */
    L.builtPaths.forEach((bp, pi) => {
      const rr = U.rng(L.buildSeed + 900 + pi);
      for (let d = 30; d < bp.length; d += 88) {
        const p = U.samplePath(bp, d);
        const side = rr() < .5 ? 1 : -1;
        const off = L.roadW * .5 + 22;
        light(p.x + Math.cos(p.a + Math.PI / 2) * off * side,
              p.y + Math.sin(p.a + Math.PI / 2) * off * side, 84, .72);
      }
    });
    /* apple glow */
    light(L.base.x, L.base.y, 190, .85);
    /* landmark */
    if (L.landmark) light(L.landmark.x, L.landmark.y - 40, 210, .42);
    (L.lights || []).forEach(l => light(l.x, l.y, (l.r || 130) * .8, l.s === undefined ? .6 : l.s * .8));

    return s.c;
  }

  /* additive practical glow layer */
  function bakeGlow(L) {
    syncSize();
    const s = U.surface(W, H);
    const x = s.x;
    if (L.night <= .05) return null;
    const warm = (px, py, rad, col, a) => {
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, U.alpha(col, a));
      g.addColorStop(1, U.alpha(col, 0));
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, U.TAU); x.fill();
    };
    L.builtPaths.forEach((bp, pi) => {
      const rr = U.rng(L.buildSeed + 900 + pi);
      for (let d = 30; d < bp.length; d += 88) {
        const p = U.samplePath(bp, d);
        const side = rr() < .5 ? 1 : -1;
        const off = L.roadW * .5 + 22;
        warm(p.x + Math.cos(p.a + Math.PI / 2) * off * side,
             p.y + Math.sin(p.a + Math.PI / 2) * off * side, 72, L.pal.lampCol || '#ffbe5c', .26);
      }
    });
    (L.lights || []).forEach(l => warm(l.x, l.y, l.r || 130, l.c || '#ffbe5c', .26));
    return s.c;
  }

  /* small stylised card for the district picker */
  function thumb(L, w, h) {
    const s = U.surface(w, h);
    const x = s.x;
    const pal = L.pal;
    const sky = x.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, U.mix(pal.sky || '#1a2440', '#000000', L.night * .55));
    sky.addColorStop(1, U.mix(pal.ground, '#000000', L.night * .45));
    x.fillStyle = sky; x.fillRect(0, 0, w, h);

    const r = U.rng(L.buildSeed);
    /* skyline silhouette, three depth layers */
    for (let layer = 0; layer < 3; layer++) {
      const base = h * (.58 + layer * .12);
      x.fillStyle = U.mix(pal.bldg[layer % pal.bldg.length], layer === 2 ? '#ffffff' : '#000000', layer === 2 ? .05 : .45 - layer * .12);
      let px = -10;
      while (px < w + 10) {
        const bw = 10 + r() * 26;
        const bh = (18 + r() * 62) * (1 - layer * .18);
        x.fillRect(px, base - bh, bw - 2, bh + 30);
        if (L.night > .3) {
          for (let k = 0; k < 6; k++) {
            if (r() < .35) {
              x.fillStyle = U.rgba(255, 210, 130, .55 + r() * .4);
              x.fillRect(px + 2 + (r() * (bw - 6) | 0), base - bh + 3 + (r() * (bh - 8) | 0), 2, 2.6);
            }
          }
          x.fillStyle = U.mix(pal.bldg[layer % pal.bldg.length], '#000000', .45 - layer * .12);
        }
        px += bw;
      }
    }
    /* street sweep */
    x.save();
    x.strokeStyle = U.alpha(pal.road, .95); x.lineWidth = h * .17; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-6, h * .95); x.quadraticCurveTo(w * .45, h * .72, w + 6, h * .88); x.stroke();
    x.setLineDash([6, 7]);
    x.strokeStyle = U.alpha(pal.roadLine, .8); x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(-6, h * .95); x.quadraticCurveTo(w * .45, h * .72, w + 6, h * .88); x.stroke();
    x.restore();

    /* the apple */
    x.save();
    x.globalCompositeOperation = 'lighter';
    const gg = x.createRadialGradient(w * .8, h * .8, 0, w * .8, h * .8, h * .35);
    gg.addColorStop(0, U.rgba(255, 200, 60, .7)); gg.addColorStop(1, U.rgba(255, 200, 60, 0));
    x.fillStyle = gg; x.fillRect(0, 0, w, h);
    x.restore();
    x.fillStyle = '#ffcf3a';
    x.beginPath(); x.arc(w * .8, h * .8, h * .06, 0, U.TAU); x.fill();

    /* grade */
    x.save(); x.globalCompositeOperation = 'multiply';
    const v = x.createRadialGradient(w / 2, h / 2, h * .2, w / 2, h / 2, h);
    v.addColorStop(0, '#fff'); v.addColorStop(1, '#4a5570');
    x.fillStyle = v; x.fillRect(0, 0, w, h);
    x.restore();
    return s.c;
  }

  return {
    W, H, CELL, proj, NADIR_X, NADIR_Y, TEX, PROP, LAND, building, drawRoad,
    bake, bakeLights, bakeGlow, thumb, canPlace, quadPt, quadFill, N
  };
})();
