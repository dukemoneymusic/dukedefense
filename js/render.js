/* ============================================================
   DUKE$DEFENSE — render.js
   Every creature, every tower, every effect, drawn as vectors
   so they animate instead of sliding around as flat stamps.

   Convention: the caller translates to the entity position and
   rotates to its heading. Sprites draw facing +x at origin.
   ============================================================ */
'use strict';

const SPRITE = (() => {

  const TAU = U.TAU;

  /* ---------- shared limbs ---------- */
  function legs(x, n, len, w, phase, col, spread) {
    x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const along = (Math.floor(i / 2) / Math.max(1, (n / 2 - 1)) - .5) * spread;
      const sw = Math.sin(phase + i * 1.7) * len * .5;
      x.beginPath();
      x.moveTo(along, side * len * .35);
      x.lineTo(along + sw, side * len);
      x.stroke();
    }
  }

  function ellipse(x, cx, cy, rx, ry, rot, fill) {
    x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU);
    x.fillStyle = fill; x.fill();
  }

  /* body with a top-left key light, so things read as rounded */
  function shadedBody(x, cx, cy, rx, ry, col, rot) {
    const g = x.createRadialGradient(cx - rx * .35, cy - ry * .5, rx * .1, cx, cy, rx * 1.25);
    g.addColorStop(0, U.shade(col, 1.5));
    g.addColorStop(.45, col);
    g.addColorStop(1, U.shade(col, .5));
    x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU);
    x.fillStyle = g; x.fill();
  }

  function eyes(x, cx, cy, sp, r, col) {
    x.fillStyle = '#0b0d12';
    x.beginPath(); x.arc(cx, cy - sp, r, 0, TAU); x.fill();
    x.beginPath(); x.arc(cx, cy + sp, r, 0, TAU); x.fill();
    x.fillStyle = col || '#ff5a4a';
    x.beginPath(); x.arc(cx + r * .35, cy - sp, r * .45, 0, TAU); x.fill();
    x.beginPath(); x.arc(cx + r * .35, cy + sp, r * .45, 0, TAU); x.fill();
  }

  /* =========================================================
     CRITTERS — rat family
     ========================================================= */
  function critter(x, e, t, o) {
    const s = e.r / 11;
    const ph = t * (e.spd / 8) + e.seed * 9;
    const col = e.col;
    const bl = (o.bodyL || 13) * s, bw = (o.bodyW || 8) * s;

    /* tail */
    if (o.tail === 'bushy') {
      const wag = Math.sin(ph * .8) * .5;
      x.save(); x.translate(-bl * .9, 0); x.rotate(wag);
      for (let k = 0; k < 5; k++) {
        ellipse(x, -k * 3.6 * s, -k * 1.6 * s, (7 - k * .7) * s, (5.5 - k * .5) * s, 0, U.shade(col, 1 + k * .12));
      }
      x.restore();
    } else if (o.tail === 'ring') {
      x.save(); x.translate(-bl * .95, 0);
      x.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        x.strokeStyle = k % 2 ? '#20242c' : U.shade(col, 1.3);
        x.lineWidth = (5.5 - k * .5) * s;
        x.beginPath();
        const a0 = k / 5 * 2.2, a1 = (k + 1) / 5 * 2.2;
        x.arc(0, 0, 9 * s, Math.PI - a0 + Math.sin(ph * .7) * .3, Math.PI - a1 + Math.sin(ph * .7) * .3, true);
        x.stroke();
      }
      x.restore();
    } else if (o.tail !== 'none') {
      x.strokeStyle = U.shade(col, .8); x.lineWidth = 2.2 * s; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(-bl * .85, 0);
      x.quadraticCurveTo(-bl * 1.6, Math.sin(ph * .9) * 6 * s, -bl * 2.1, Math.sin(ph * .9 + .8) * 9 * s);
      x.stroke();
    }

    /* legs */
    legs(x, 4, 6.5 * s, 2.2 * s, ph, U.shade(col, .55), bl * 1.1);

    /* body */
    const squash = 1 + Math.sin(ph * 2) * .05;
    shadedBody(x, 0, 0, bl, bw * squash, col);
    /* belly */
    x.save(); x.globalAlpha = .35;
    ellipse(x, bl * .1, bw * .35, bl * .7, bw * .4, 0, U.shade(col, 1.55));
    x.restore();

    /* head */
    const hx = bl * .92, bob = Math.sin(ph * 2) * .8 * s;
    shadedBody(x, hx, bob, 6.4 * s, 5.4 * s, U.shade(col, 1.1));
    /* snout */
    x.beginPath();
    x.moveTo(hx + 2 * s, bob - 3 * s);
    x.lineTo(hx + 9 * s, bob);
    x.lineTo(hx + 2 * s, bob + 3 * s);
    x.closePath();
    x.fillStyle = U.shade(col, 1.25); x.fill();
    x.fillStyle = '#e07a8a';
    x.beginPath(); x.arc(hx + 9 * s, bob, 1.5 * s, 0, TAU); x.fill();
    /* ears */
    if (o.ears !== false) {
      const er = (o.bigEars ? 5.2 : 3.8) * s;
      ellipse(x, hx - 2 * s, bob - 5.2 * s, er, er * .85, -.3, U.shade(col, .8));
      ellipse(x, hx - 2 * s, bob + 5.2 * s, er, er * .85, .3, U.shade(col, .8));
      ellipse(x, hx - 2 * s, bob - 5.2 * s, er * .5, er * .45, -.3, '#c98a92');
      ellipse(x, hx - 2 * s, bob + 5.2 * s, er * .5, er * .45, .3, '#c98a92');
    }
    /* mask (raccoon) */
    if (o.mask) {
      x.save(); x.globalAlpha = .85; x.fillStyle = '#1c2028';
      x.beginPath(); x.ellipse(hx + 1 * s, bob - 3.2 * s, 3.6 * s, 2.4 * s, -.2, 0, TAU); x.fill();
      x.beginPath(); x.ellipse(hx + 1 * s, bob + 3.2 * s, 3.6 * s, 2.4 * s, .2, 0, TAU); x.fill();
      x.restore();
    }
    eyes(x, hx + 2 * s, bob, 3.2 * s, 1.5 * s, o.eye);
    /* whiskers */
    x.strokeStyle = U.rgba(255, 255, 255, .35); x.lineWidth = .7 * s;
    for (let k = -1; k <= 1; k++) {
      x.beginPath(); x.moveTo(hx + 7 * s, bob + k * 1.4 * s);
      x.lineTo(hx + 15 * s, bob + k * 4 * s + Math.sin(ph * 3) * s); x.stroke();
    }
  }

  /* =========================================================
     BIRDS
     ========================================================= */
  function bird(x, e, t, o) {
    const s = e.r / 11;
    const flap = Math.sin(t * (o.flapRate || 11) + e.seed * 5);
    const col = e.col;
    const span = (o.span || 15) * s;

    /* far wing */
    x.save();
    x.rotate(flap * .5);
    x.beginPath();
    x.moveTo(-2 * s, 0);
    x.quadraticCurveTo(-8 * s, -span * .9, -1 * s, -span * 1.5);
    x.quadraticCurveTo(6 * s, -span * .8, 3 * s, 0);
    x.closePath();
    x.fillStyle = U.shade(col, .62); x.fill();
    x.restore();

    /* tail */
    x.beginPath();
    x.moveTo(-8 * s, -4 * s); x.lineTo(-17 * s, 0); x.lineTo(-8 * s, 4 * s);
    x.closePath(); x.fillStyle = U.shade(col, .78); x.fill();

    /* body */
    shadedBody(x, 0, 0, 11 * s, 7.5 * s, col);
    if (o.chest) { x.save(); x.globalAlpha = .55; ellipse(x, 3 * s, 2 * s, 6 * s, 4 * s, 0, o.chest); x.restore(); }

    /* head */
    const hx = 10 * s;
    shadedBody(x, hx, -2 * s, 5.4 * s, 4.8 * s, U.shade(col, o.headShade || 1.15));
    /* beak */
    x.beginPath();
    x.moveTo(hx + 3 * s, -3.4 * s);
    x.lineTo(hx + (o.beak || 10) * s, -1.6 * s);
    x.lineTo(hx + 3 * s, .4 * s);
    x.closePath();
    x.fillStyle = o.beakCol || '#e8a83a'; x.fill();
    x.fillStyle = '#0b0d12';
    x.beginPath(); x.arc(hx + 1.5 * s, -3.4 * s, 1.6 * s, 0, TAU); x.fill();
    x.fillStyle = o.eye || '#ffd24d';
    x.beginPath(); x.arc(hx + 2 * s, -3.6 * s, .7 * s, 0, TAU); x.fill();

    /* near wing */
    x.save();
    x.rotate(-flap * .5);
    x.beginPath();
    x.moveTo(-2 * s, 0);
    x.quadraticCurveTo(-8 * s, span * .9, -1 * s, span * 1.5);
    x.quadraticCurveTo(6 * s, span * .8, 3 * s, 0);
    x.closePath();
    const wg = x.createLinearGradient(0, 0, 0, span * 1.5);
    wg.addColorStop(0, U.shade(col, 1.3));
    wg.addColorStop(1, U.shade(col, .7));
    x.fillStyle = wg; x.fill();
    /* flight feathers */
    x.strokeStyle = U.rgba(0, 0, 0, .22); x.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      x.beginPath(); x.moveTo(0, span * .3 * k * .5);
      x.lineTo(-2 * s, span * 1.35); x.stroke();
    }
    x.restore();
  }

  /* =========================================================
     BUGS
     ========================================================= */
  function bug(x, e, t, o) {
    const s = e.r / 9;
    const ph = t * 16 + e.seed * 4;
    const col = e.col;
    legs(x, 6, 6 * s, 1.6 * s, ph, U.shade(col, .55), 12 * s);
    /* antennae */
    x.strokeStyle = U.shade(col, .6); x.lineWidth = 1.2 * s;
    [-1, 1].forEach(sd => {
      x.beginPath(); x.moveTo(7 * s, sd * 2 * s);
      x.quadraticCurveTo(14 * s, sd * 5 * s, 18 * s, sd * (3 + Math.sin(ph * .5) * 3) * s);
      x.stroke();
    });
    shadedBody(x, 0, 0, 10 * s, 6.5 * s, col);
    /* carapace split */
    x.strokeStyle = U.rgba(0, 0, 0, .45); x.lineWidth = 1.2 * s;
    x.beginPath(); x.moveTo(6 * s, 0); x.lineTo(-9 * s, 0); x.stroke();
    if (o.segments) {
      for (let k = 0; k < 4; k++) {
        x.beginPath();
        x.ellipse(-1 * s - k * 2 * s, 0, 6 * s - k * s, 5.5 * s - k * s, 0, -1.2, 1.2);
        x.stroke();
      }
    }
    /* head */
    ellipse(x, 8 * s, 0, 4 * s, 4 * s, 0, U.shade(col, 1.2));
    x.save(); x.globalAlpha = .5;
    ellipse(x, -1 * s, -2 * s, 8 * s, 3 * s, -.15, U.shade(col, 1.7));
    x.restore();
  }

  /* =========================================================
     THE ROSTER
     ========================================================= */
  const enemy = {
    rat:      (x, e, t) => critter(x, e, t, { bodyL: 13, bodyW: 8, bigEars: true }),
    squirrel: (x, e, t) => critter(x, e, t, { bodyL: 11, bodyW: 8, tail: 'bushy' }),
    raccoon:  (x, e, t) => critter(x, e, t, { bodyL: 16, bodyW: 11, tail: 'ring', mask: true, eye: '#ffd24d' }),

    pizzarat: (x, e, t) => {
      critter(x, e, t, { bodyL: 12, bodyW: 8, bigEars: true });
      /* the slice, held aloft */
      const s = e.r / 11, bob = Math.sin(t * 8 + e.seed) * 1.5 * s;
      x.save();
      x.translate(6 * s, -11 * s + bob); x.rotate(-.4);
      x.beginPath(); x.moveTo(-9 * s, 6 * s); x.lineTo(9 * s, 6 * s); x.lineTo(0, -9 * s); x.closePath();
      x.fillStyle = '#e8b95c'; x.fill();
      x.beginPath(); x.moveTo(-7.5 * s, 4.6 * s); x.lineTo(7.5 * s, 4.6 * s); x.lineTo(0, -7 * s); x.closePath();
      x.fillStyle = '#d9542f'; x.fill();
      x.fillStyle = '#f2d98a';
      x.beginPath(); x.moveTo(-6.5 * s, 3.6 * s); x.lineTo(6.5 * s, 3.6 * s); x.lineTo(0, -5.5 * s); x.closePath(); x.fill();
      x.fillStyle = '#b8332a';
      [[-3, 1], [2.5, .5], [0, -2]].forEach(p => { x.beginPath(); x.arc(p[0] * s, p[1] * s, 1.4 * s, 0, TAU); x.fill(); });
      x.restore();
    },

    roach:  (x, e, t) => bug(x, e, t, {}),
    bedbug: (x, e, t) => bug(x, e, t, { segments: true }),

    pigeon: (x, e, t) => bird(x, e, t, { span: 14, chest: '#5c7fa8', beak: 8, beakCol: '#c8b8a8', eye: '#ff8a3a' }),
    gull:   (x, e, t) => bird(x, e, t, { span: 20, flapRate: 8, beak: 12, beakCol: '#ffb02a', headShade: 1.05 }),
    hawk:   (x, e, t) => {
      bird(x, e, t, { span: 24, flapRate: 6.5, beak: 10, beakCol: '#f2c14a', chest: '#d8c0a0', eye: '#ffd24d' });
      /* talons */
      const s = e.r / 11;
      x.strokeStyle = '#e8b83a'; x.lineWidth = 1.8 * s; x.lineCap = 'round';
      [-1, 1].forEach(sd => {
        x.beginPath(); x.moveTo(2 * s, sd * 3 * s); x.lineTo(6 * s, sd * 7 * s + 3 * s); x.stroke();
      });
    },

    tourist: (x, e, t) => {
      const s = e.r / 18, ph = t * 4 + e.seed;
      /* three figures shuffling as a clump */
      const cols = ['#cf5b8a', '#4a8fd8', '#e8b33a'];
      [[-8, -7], [4, 6], [-2, 8]].forEach((p, i) => {
        const bx = p[0] * s, by = p[1] * s, bob = Math.sin(ph + i * 2) * 1.6 * s;
        x.save(); x.translate(bx, by + bob);
        /* legs */
        x.strokeStyle = '#3a4150'; x.lineWidth = 3 * s; x.lineCap = 'round';
        x.beginPath(); x.moveTo(0, 4 * s); x.lineTo(Math.sin(ph + i) * 3 * s, 11 * s); x.stroke();
        x.beginPath(); x.moveTo(0, 4 * s); x.lineTo(-Math.sin(ph + i) * 3 * s, 11 * s); x.stroke();
        /* torso */
        x.fillStyle = cols[i];
        x.beginPath(); x.roundRect(-6 * s, -6 * s, 12 * s, 12 * s, 3 * s); x.fill();
        /* head */
        ellipse(x, 0, -10 * s, 5 * s, 5 * s, 0, '#d8ab8a');
        /* cap */
        x.fillStyle = '#2d3a4d';
        x.beginPath(); x.arc(0, -11 * s, 5.2 * s, Math.PI, 0); x.fill();
        x.fillRect(0, -12 * s, 8 * s, 2 * s);
        /* camera */
        if (i === 0) {
          x.fillStyle = '#20242c';
          x.beginPath(); x.roundRect(4 * s, -8 * s, 8 * s, 6 * s, 1.5 * s); x.fill();
          x.fillStyle = '#6cc8ff';
          x.beginPath(); x.arc(8 * s, -5 * s, 2 * s, 0, TAU); x.fill();
        }
        x.restore();
      });
    },

    elmo: (x, e, t) => {
      const s = e.r / 17, ph = t * 5 + e.seed;
      /* shaggy red suit */
      const col = e.col;
      x.strokeStyle = U.shade(col, .7); x.lineWidth = 4 * s; x.lineCap = 'round';
      x.beginPath(); x.moveTo(0, 5 * s); x.lineTo(Math.sin(ph) * 5 * s, 15 * s); x.stroke();
      x.beginPath(); x.moveTo(0, 5 * s); x.lineTo(-Math.sin(ph) * 5 * s, 15 * s); x.stroke();
      shadedBody(x, 0, 0, 12 * s, 11 * s, col);
      /* fur fringe */
      const r = U.rng(e.seed * 31 | 0);
      x.fillStyle = U.shade(col, 1.25);
      for (let k = 0; k < 26; k++) {
        const a = k / 26 * TAU;
        x.beginPath();
        x.arc(Math.cos(a) * 12 * s, Math.sin(a) * 11 * s, (1.4 + r() * 1.4) * s, 0, TAU);
        x.fill();
      }
      /* head */
      shadedBody(x, 4 * s, -12 * s, 10 * s, 9 * s, U.shade(col, 1.1));
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(7 * s, -16 * s, 4.4 * s, 0, TAU); x.fill();
      x.beginPath(); x.arc(7 * s, -8 * s, 4.4 * s, 0, TAU); x.fill();
      x.fillStyle = '#101318';
      x.beginPath(); x.arc(8.6 * s, -16 * s, 2.2 * s, 0, TAU); x.fill();
      x.beginPath(); x.arc(8.6 * s, -8 * s, 2.2 * s, 0, TAU); x.fill();
      x.fillStyle = '#e8781a';
      x.beginPath(); x.ellipse(12 * s, -12 * s, 3.4 * s, 2.6 * s, 0, 0, TAU); x.fill();
      /* healing glimmer */
      x.save(); x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 34 * s);
      const pulse = .12 + Math.sin(t * 3) * .06;
      g.addColorStop(0, U.rgba(120, 255, 170, pulse));
      g.addColorStop(1, U.rgba(120, 255, 170, 0));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 34 * s, 0, TAU); x.fill();
      x.restore();
    },

    drone: (x, e, t) => {
      const s = e.r / 14, spin = t * 40;
      /* arms */
      x.strokeStyle = '#2a303c'; x.lineWidth = 3 * s;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(d => {
        x.beginPath(); x.moveTo(0, 0); x.lineTo(d[0] * 12 * s, d[1] * 12 * s); x.stroke();
      });
      /* rotors */
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((d, i) => {
        const cx = d[0] * 12 * s, cy = d[1] * 12 * s;
        x.fillStyle = '#1a1f28';
        x.beginPath(); x.arc(cx, cy, 3 * s, 0, TAU); x.fill();
        x.save(); x.globalAlpha = .35;
        x.strokeStyle = '#aab4c4'; x.lineWidth = 1.6 * s;
        x.beginPath(); x.ellipse(cx, cy, 9 * s, 2 * s, spin + i, 0, TAU); x.stroke();
        x.beginPath(); x.ellipse(cx, cy, 9 * s, 2 * s, spin + i + 1.57, 0, TAU); x.stroke();
        x.restore();
      });
      /* chassis */
      shadedBody(x, 0, 0, 10 * s, 8 * s, e.col);
      /* payload box */
      x.fillStyle = '#a8763f';
      x.beginPath(); x.roundRect(-6 * s, -5 * s, 12 * s, 10 * s, 1.5 * s); x.fill();
      x.strokeStyle = '#6b4a25'; x.lineWidth = 1.2 * s;
      x.beginPath(); x.moveTo(-6 * s, 0); x.lineTo(6 * s, 0); x.stroke();
      x.beginPath(); x.moveTo(0, -5 * s); x.lineTo(0, 5 * s); x.stroke();
      /* status LED */
      x.fillStyle = Math.sin(t * 9) > 0 ? '#ff4a4a' : '#3a1a1a';
      x.beginPath(); x.arc(9 * s, 0, 1.8 * s, 0, TAU); x.fill();
    },

    gator: (x, e, t) => {
      const s = e.r / 22, ph = t * 3.4 + e.seed;
      const col = e.col;
      /* tail — three tapering segments that swing */
      x.save();
      for (let k = 0; k < 4; k++) {
        x.translate(-9 * s, 0);
        x.rotate(Math.sin(ph + k * .8) * .18);
        ellipse(x, 0, 0, 10 * s - k * 1.6 * s, 7 * s - k * 1.4 * s, 0, U.shade(col, .82 + k * .04));
        /* scutes */
        x.fillStyle = U.shade(col, .6);
        for (let j = -1; j <= 1; j++) {
          x.beginPath(); x.moveTo(j * 4 * s - 2 * s, -6 * s + k * s);
          x.lineTo(j * 4 * s, -10 * s + k * s); x.lineTo(j * 4 * s + 2 * s, -6 * s + k * s);
          x.closePath(); x.fill();
        }
      }
      x.restore();
      /* legs */
      legs(x, 4, 9 * s, 3.4 * s, ph * 1.4, U.shade(col, .6), 20 * s);
      /* body */
      shadedBody(x, 0, 0, 22 * s, 12 * s, col);
      /* dorsal ridge */
      x.fillStyle = U.shade(col, .55);
      for (let k = -3; k <= 3; k++) {
        x.beginPath();
        x.moveTo(k * 6 * s - 3 * s, -9 * s); x.lineTo(k * 6 * s, -15 * s); x.lineTo(k * 6 * s + 3 * s, -9 * s);
        x.closePath(); x.fill();
      }
      x.save(); x.globalAlpha = .4;
      ellipse(x, 0, 5 * s, 18 * s, 6 * s, 0, U.shade(col, 1.6));
      x.restore();
      /* head + snout */
      shadedBody(x, 24 * s, 0, 13 * s, 8 * s, U.shade(col, 1.08));
      x.beginPath();
      x.moveTo(30 * s, -6 * s); x.lineTo(46 * s, -4 * s);
      x.lineTo(46 * s, 4 * s); x.lineTo(30 * s, 6 * s); x.closePath();
      x.fillStyle = U.shade(col, 1.15); x.fill();
      /* teeth */
      x.fillStyle = '#f2f0e6';
      for (let k = 0; k < 6; k++) {
        const tx = 32 * s + k * 2.4 * s;
        x.beginPath(); x.moveTo(tx, -4 * s); x.lineTo(tx + 1.2 * s, -1 * s); x.lineTo(tx + 2.4 * s, -4 * s); x.closePath(); x.fill();
        x.beginPath(); x.moveTo(tx, 4 * s); x.lineTo(tx + 1.2 * s, 1 * s); x.lineTo(tx + 2.4 * s, 4 * s); x.closePath(); x.fill();
      }
      /* eyes on top of the skull */
      ellipse(x, 22 * s, -6 * s, 3.4 * s, 3 * s, 0, U.shade(col, 1.3));
      ellipse(x, 22 * s, 6 * s, 3.4 * s, 3 * s, 0, U.shade(col, 1.3));
      x.fillStyle = '#f2c93a';
      x.beginPath(); x.arc(23 * s, -6 * s, 1.8 * s, 0, TAU); x.fill();
      x.beginPath(); x.arc(23 * s, 6 * s, 1.8 * s, 0, TAU); x.fill();
      x.fillStyle = '#101318';
      x.fillRect(22.4 * s, -7.6 * s, .9 * s, 3.2 * s);
      x.fillRect(22.4 * s, 4.4 * s, .9 * s, 3.2 * s);
    },

    golem: (x, e, t) => {
      const s = e.r / 26, ph = t * 2.6 + e.seed;
      const col = e.col;
      /* pipe legs */
      x.strokeStyle = '#59616e'; x.lineWidth = 6 * s; x.lineCap = 'round';
      [-1, 1].forEach((sd, i) => {
        const sw = Math.sin(ph + i * Math.PI) * 7 * s;
        x.beginPath(); x.moveTo(0, sd * 9 * s); x.lineTo(sw, sd * 22 * s); x.stroke();
        x.fillStyle = '#3d434e';
        x.beginPath(); x.roundRect(sw - 6 * s, sd * 20 * s, 12 * s, 5 * s, 2 * s); x.fill();
      });
      /* scaffold frame body */
      x.strokeStyle = '#6e7684'; x.lineWidth = 4.5 * s;
      x.strokeRect(-16 * s, -16 * s, 32 * s, 32 * s);
      x.lineWidth = 2.6 * s;
      x.beginPath(); x.moveTo(-16 * s, -16 * s); x.lineTo(16 * s, 16 * s); x.stroke();
      x.beginPath(); x.moveTo(16 * s, -16 * s); x.lineTo(-16 * s, 16 * s); x.stroke();
      x.beginPath(); x.moveTo(-16 * s, 0); x.lineTo(16 * s, 0); x.stroke();
      /* plywood panel */
      x.save(); x.globalAlpha = .9;
      x.fillStyle = '#2f6b4a';
      x.fillRect(-13 * s, -12 * s, 26 * s, 24 * s);
      x.fillStyle = U.rgba(255, 255, 255, .12);
      x.fillRect(-13 * s, -12 * s, 26 * s, 4 * s);
      x.restore();
      /* safety light */
      x.fillStyle = Math.sin(t * 6) > 0 ? '#ffb02a' : '#4a3a12';
      x.beginPath(); x.arc(0, -18 * s, 3.4 * s, 0, TAU); x.fill();
      /* arms of pipe */
      x.strokeStyle = '#6e7684'; x.lineWidth = 5 * s;
      [-1, 1].forEach((sd, i) => {
        const sw = Math.sin(ph + i * Math.PI + 1) * 6 * s;
        x.beginPath(); x.moveTo(6 * s, sd * 14 * s);
        x.lineTo(18 * s + sw, sd * 20 * s); x.stroke();
      });
      /* head — a caution sign */
      x.save(); x.translate(20 * s, 0); x.rotate(.785);
      x.fillStyle = '#f2b01e'; x.fillRect(-7 * s, -7 * s, 14 * s, 14 * s);
      x.strokeStyle = '#1a1a1a'; x.lineWidth = 2 * s; x.strokeRect(-7 * s, -7 * s, 14 * s, 14 * s);
      x.restore();
      x.fillStyle = '#101318';
      x.beginPath(); x.arc(22 * s, -3 * s, 2 * s, 0, TAU); x.fill();
      x.beginPath(); x.arc(22 * s, 3 * s, 2 * s, 0, TAU); x.fill();
    },

    /* ---------- bosses ---------- */
    b_ratking: (x, e, t) => {
      const s = e.r / 40;
      /* three tangled rats sharing one crown */
      [[-14, -12, -.4], [-12, 14, .5], [4, 0, 0]].forEach((p, i) => {
        x.save();
        x.translate(p[0] * s, p[1] * s); x.rotate(p[2] + Math.sin(t * 2 + i) * .08);
        critter(x, { r: 22, spd: e.spd, seed: e.seed + i * 3, col: e.col }, t + i, { bodyL: 15, bodyW: 9, bigEars: true, eye: '#ff2a2a' });
        x.restore();
      });
      /* knotted tails */
      x.strokeStyle = '#4a4038'; x.lineWidth = 4 * s; x.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        x.beginPath();
        x.moveTo(-26 * s, 0);
        x.quadraticCurveTo(-40 * s, Math.sin(t * 2 + k) * 18 * s, -52 * s, Math.cos(t * 1.6 + k) * 22 * s);
        x.stroke();
      }
      /* crown */
      const cy = -34 * s;
      x.fillStyle = '#e8b81e';
      x.beginPath();
      x.moveTo(-18 * s, cy + 10 * s);
      for (let k = 0; k <= 4; k++) {
        x.lineTo(-18 * s + k * 9 * s, cy + (k % 2 ? 10 : -6) * s);
      }
      x.lineTo(18 * s, cy + 10 * s);
      x.closePath(); x.fill();
      x.strokeStyle = '#8a6b0a'; x.lineWidth = 1.6 * s; x.stroke();
      ['#ff3a4a', '#4ab7ff', '#4aff8a'].forEach((c, i) => {
        x.fillStyle = c;
        x.beginPath(); x.arc(-10 * s + i * 10 * s, cy + 6 * s, 2.6 * s, 0, TAU); x.fill();
      });
      x.save(); x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(0, cy, 0, 0, cy, 60 * s);
      g.addColorStop(0, U.rgba(255, 200, 40, .3)); g.addColorStop(1, U.rgba(255, 200, 40, 0));
      x.fillStyle = g; x.beginPath(); x.arc(0, cy, 60 * s, 0, TAU); x.fill();
      x.restore();
    },

    b_gatorlord: (x, e, t) => {
      x.save(); x.scale(1.9, 1.9);
      enemy.gator(x, { r: 22, spd: e.spd, seed: e.seed, col: e.col }, t);
      x.restore();
      const s = e.r / 46;
      /* bone spines */
      x.fillStyle = '#d8d0b8';
      for (let k = -4; k <= 4; k++) {
        x.beginPath();
        x.moveTo(k * 11 * s - 5 * s, -18 * s); x.lineTo(k * 11 * s, -34 * s); x.lineTo(k * 11 * s + 5 * s, -18 * s);
        x.closePath(); x.fill();
      }
      x.save(); x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(40 * s, 0, 0, 40 * s, 0, 70 * s);
      g.addColorStop(0, U.rgba(120, 255, 120, .22)); g.addColorStop(1, U.rgba(120, 255, 120, 0));
      x.fillStyle = g; x.beginPath(); x.arc(40 * s, 0, 70 * s, 0, TAU); x.fill();
      x.restore();
    },

    b_flock: (x, e, t) => {
      const s = e.r / 38;
      /* a knot of birds moving as one mass */
      const r = U.rng(e.seed * 17 | 0);
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * TAU + t * .6;
        const d = (12 + (k % 3) * 12) * s;
        x.save();
        x.translate(Math.cos(a) * d, Math.sin(a) * d * .7);
        x.rotate(Math.sin(t * 2 + k) * .3);
        bird(x, { r: 11 + (k % 3) * 3, spd: e.spd, seed: k, col: k % 2 ? '#98a4b6' : '#6e7b90' }, t + k * .4, { span: 15, flapRate: 9 + k });
        x.restore();
      }
      x.save(); x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 70 * s);
      g.addColorStop(0, U.rgba(180, 200, 255, .18)); g.addColorStop(1, U.rgba(180, 200, 255, 0));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 70 * s, 0, TAU); x.fill();
      x.restore();
    },

    b_titan: (x, e, t) => {
      x.save(); x.scale(2.1, 2.1);
      enemy.golem(x, { r: 26, spd: e.spd, seed: e.seed, col: e.col }, t);
      x.restore();
      const s = e.r / 54;
      /* extra scaffolding storeys */
      x.strokeStyle = '#7c8492'; x.lineWidth = 5 * s;
      for (let k = 1; k <= 2; k++) {
        x.strokeRect(-38 * s, -38 * s - k * 16 * s, 76 * s, 16 * s);
      }
      x.fillStyle = '#2f6b4a';
      x.fillRect(-34 * s, -66 * s, 68 * s, 12 * s);
      x.fillStyle = '#f2b01e'; x.font = `bold ${9 * s}px Helvetica,Arial`; x.textAlign = 'center';
      x.fillText('SIDEWALK CLOSED', 0, -57 * s);
      /* strobes */
      for (let k = -1; k <= 1; k += 2) {
        x.fillStyle = Math.sin(t * 8 + k) > 0 ? '#ffb02a' : '#3a2a08';
        x.beginPath(); x.arc(k * 30 * s, -70 * s, 4 * s, 0, TAU); x.fill();
      }
    },

    b_bigcheese: (x, e, t) => {
      const s = e.r / 60;
      /* colossal rat wearing a wedge of cheese like a helm */
      x.save(); x.scale(2.6, 2.6);
      critter(x, { r: 22, spd: e.spd, seed: e.seed, col: e.col }, t, { bodyL: 16, bodyW: 10, bigEars: true, eye: '#ff2a2a' });
      x.restore();
      /* cheese crown */
      const hx = 46 * s, hy = -34 * s;
      x.save(); x.translate(hx, hy); x.rotate(-.15 + Math.sin(t * 1.4) * .04);
      const g = x.createLinearGradient(-30 * s, 0, 30 * s, 0);
      g.addColorStop(0, '#f2d04a'); g.addColorStop(.5, '#ffe37a'); g.addColorStop(1, '#c9a01e');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(-32 * s, 16 * s); x.lineTo(32 * s, 16 * s); x.lineTo(6 * s, -24 * s); x.closePath(); x.fill();
      x.fillStyle = U.rgba(160, 120, 10, .55);
      [[-14, 6, 5], [4, 2, 4], [12, 10, 3], [-4, 11, 3.4]].forEach(h => {
        x.beginPath(); x.arc(h[0] * s, h[1] * s, h[2] * s, 0, TAU); x.fill();
      });
      x.restore();
      /* aura */
      x.save(); x.globalCompositeOperation = 'lighter';
      const gg = x.createRadialGradient(0, 0, 0, 0, 0, 130 * s);
      const pulse = .18 + Math.sin(t * 2.4) * .07;
      gg.addColorStop(0, U.rgba(255, 190, 40, pulse));
      gg.addColorStop(1, U.rgba(255, 190, 40, 0));
      x.fillStyle = gg; x.beginPath(); x.arc(0, 0, 130 * s, 0, TAU); x.fill();
      x.restore();
    }
  };

  /* =========================================================
     WEAPON EMPLACEMENTS
     Drawn base-at-origin. `T.aim` is the barrel bearing in world
     radians; the mount body stays put and only the gun tracks.
     ========================================================= */

  /* sandbag ring every emplacement sits in */
  function emplacement(x, col, tier, r) {
    x.save(); x.globalAlpha = .55; x.fillStyle = '#05070c';
    x.beginPath(); x.ellipse(2, 6, r + 5, (r + 5) * .45, 0, 0, TAU); x.fill(); x.restore();

    /* dirt pad */
    const g = x.createRadialGradient(-r * .3, -r * .2, 2, 0, 0, r + 4);
    g.addColorStop(0, '#4a4438'); g.addColorStop(1, '#221f18');
    x.fillStyle = g;
    x.beginPath(); x.ellipse(0, 2, r + 3, (r + 3) * .44, 0, 0, TAU); x.fill();

    /* sandbags around the back half */
    const n = Math.max(7, Math.round(r * .55));
    for (let i = 0; i < n; i++) {
      const a = Math.PI * .12 + (i / (n - 1)) * Math.PI * 1.76;
      const bx = Math.cos(a) * r, by = Math.sin(a) * r * .46 + 2;
      const shade = .8 + Math.sin(a) * .25;
      x.save(); x.translate(bx, by); x.rotate(a * .3);
      x.fillStyle = U.shade('#7a6a4a', shade);
      x.beginPath(); x.roundRect(-5.4, -3.6, 10.8, 7.2, 3); x.fill();
      x.strokeStyle = U.rgba(0, 0, 0, .3); x.lineWidth = .8;
      x.beginPath(); x.roundRect(-5.4, -3.6, 10.8, 7.2, 3); x.stroke();
      x.restore();
    }
    /* tier chevrons */
    for (let k = 0; k < tier; k++) {
      x.strokeStyle = col; x.lineWidth = 2;
      x.beginPath();
      x.moveTo(-7 + k * 7, r * .46 + 9);
      x.lineTo(-4 + k * 7, r * .46 + 5);
      x.lineTo(-1 + k * 7, r * .46 + 9);
      x.stroke();
    }
  }

  /* a gun barrel with muzzle flash */
  function barrel(x, len, w, col, recoil, flash) {
    x.save();
    x.translate(-recoil, 0);
    x.fillStyle = U.shade(col, .55);
    x.beginPath(); x.roundRect(0, -w / 2, len, w, w * .35); x.fill();
    x.fillStyle = U.shade(col, 1.25);
    x.fillRect(0, -w / 2, len, w * .3);
    x.fillStyle = '#0d1016';
    x.beginPath(); x.arc(len, 0, w * .34, 0, TAU); x.fill();
    if (flash > 0) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = flash;
      const g = x.createRadialGradient(len + 4, 0, 0, len + 4, 0, 22);
      g.addColorStop(0, U.rgba(255, 250, 210, 1));
      g.addColorStop(.35, U.rgba(255, 190, 70, .8));
      g.addColorStop(1, U.rgba(255, 120, 30, 0));
      x.fillStyle = g;
      x.beginPath(); x.arc(len + 4, 0, 22, 0, TAU); x.fill();
      /* star flare */
      x.strokeStyle = U.rgba(255, 240, 190, .9); x.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 4;
        x.beginPath();
        x.moveTo(len + 4 - Math.cos(a) * 14, -Math.sin(a) * 14);
        x.lineTo(len + 4 + Math.cos(a) * 14, Math.sin(a) * 14);
        x.stroke();
      }
      x.restore();
    }
    x.restore();
  }

  /* ammo box / crate detail */
  function crate(x, cx, cy, w, h, col) {
    x.fillStyle = U.shade(col, .7);
    x.beginPath(); x.roundRect(cx - w / 2, cy - h, w, h, 2); x.fill();
    x.fillStyle = U.shade(col, 1.2);
    x.fillRect(cx - w / 2, cy - h, w, h * .28);
    x.strokeStyle = U.rgba(0, 0, 0, .35); x.lineWidth = 1;
    x.beginPath(); x.roundRect(cx - w / 2, cy - h, w, h, 2); x.stroke();
  }

  const tower = {

    pistol(x, T, t) {
      const d = TOWERS.pistol;
      emplacement(x, d.col, T.tier + 1, 16);
      crate(x, -13, 6, 12, 8, '#4a5a3a');
      x.save(); x.rotate(T.aim || 0);
      /* pintle */
      x.fillStyle = '#39424f';
      x.beginPath(); x.arc(0, -8, 6, 0, TAU); x.fill();
      /* slide + grip */
      x.save(); x.translate(0, -8);
      barrel(x, 20, 7, '#8d939c', Math.min(4, T.recoil * 16), T.flash || 0);
      x.fillStyle = '#2b3340';
      x.beginPath(); x.roundRect(-6, -1, 9, 11, 2); x.fill();
      x.restore();
      x.restore();
      if (T.tier >= 2) {
        x.save(); x.rotate((T.aim || 0) + .28); x.translate(0, -8);
        barrel(x, 18, 6, '#8d939c', Math.min(4, T.recoil * 16), T.flash || 0);
        x.restore();
      }
    },

    shotgun(x, T, t) {
      const d = TOWERS.shotgun;
      emplacement(x, d.col, T.tier + 1, 18);
      crate(x, 14, 8, 13, 9, '#6b4a2a');
      x.save(); x.rotate(T.aim || 0);
      x.fillStyle = '#2f3743';
      x.beginPath(); x.roundRect(-12, -14, 16, 12, 3); x.fill();
      x.save(); x.translate(0, -9);
      /* twin tubes */
      barrel(x, 30, 8, '#6b5240', Math.min(6, T.recoil * 22), T.flash || 0);
      if (T.tier >= 1) {
        x.save(); x.translate(0, 7);
        barrel(x, 28, 7, '#6b5240', Math.min(6, T.recoil * 22), T.flash || 0);
        x.restore();
      }
      /* drum mag on tier 3 */
      if (T.tier >= 2) {
        x.fillStyle = '#39424f';
        x.beginPath(); x.arc(-4, 8, 8, 0, TAU); x.fill();
        x.strokeStyle = '#5a6472'; x.lineWidth = 1.6;
        x.beginPath(); x.arc(-4, 8, 8, 0, TAU); x.stroke();
      }
      x.restore();
      x.restore();
    },

    smg(x, T, t) {
      const d = TOWERS.smg;
      emplacement(x, d.col, T.tier + 1, 16);
      crate(x, -14, 7, 11, 8, '#3f4a5c');
      x.save(); x.rotate(T.aim || 0);
      x.fillStyle = '#39424f';
      x.beginPath(); x.arc(0, -9, 5.5, 0, TAU); x.fill();
      x.save(); x.translate(0, -9);
      barrel(x, 19, 6, '#8fa3c4', Math.min(3, T.recoil * 14), T.flash || 0);
      x.fillStyle = '#20262f';
      x.beginPath(); x.roundRect(-8, -4, 12, 8, 2); x.fill();
      /* mag */
      x.fillStyle = '#2b3340';
      x.beginPath(); x.roundRect(-2, 3, 4, 11, 1.5); x.fill();
      x.restore();
      if (T.tier >= 2) {
        x.save(); x.translate(0, 1);
        barrel(x, 17, 5, '#8fa3c4', Math.min(3, T.recoil * 14), T.flash || 0);
        x.restore();
      }
      x.restore();
    },

    rifle(x, T, t) {
      const d = TOWERS.rifle;
      emplacement(x, d.col, T.tier + 1, 17);
      crate(x, 15, 7, 12, 9, '#4a5a3a');
      x.save(); x.rotate(T.aim || 0);
      /* bipod */
      x.strokeStyle = '#39424f'; x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(8, -10); x.lineTo(4, 3); x.stroke();
      x.beginPath(); x.moveTo(8, -10); x.lineTo(14, 3); x.stroke();
      x.save(); x.translate(0, -11);
      barrel(x, 30, 6.5, '#5c6656', Math.min(5, T.recoil * 18), T.flash || 0);
      /* receiver + stock */
      x.fillStyle = '#2f3743';
      x.beginPath(); x.roundRect(-14, -4.5, 17, 9, 2); x.fill();
      x.fillStyle = '#3d4a3a';
      x.beginPath(); x.roundRect(-22, -3.5, 9, 7, 2); x.fill();
      /* optic */
      x.fillStyle = '#1a1f28';
      x.beginPath(); x.roundRect(-6, -9, 13, 5, 2); x.fill();
      if (T.tier >= 1) {
        x.fillStyle = U.rgba(120, 220, 255, .5 + Math.sin(t * 4) * .2);
        x.beginPath(); x.arc(7, -6.5, 1.8, 0, TAU); x.fill();
      }
      /* mag */
      x.fillStyle = '#242c38';
      x.beginPath(); x.roundRect(-6, 3, 5, 12, 1.5); x.fill();
      x.restore();
      x.restore();
    },

    lmg(x, T, t) {
      const d = TOWERS.lmg;
      emplacement(x, d.col, T.tier + 1, 20);
      /* ammo cans */
      crate(x, -17, 8, 14, 10, '#3f4a3a');
      crate(x, 17, 8, 14, 10, '#3f4a3a');
      x.save(); x.rotate(T.aim || 0);
      /* tripod legs */
      x.strokeStyle = '#39424f'; x.lineWidth = 3;
      [-2.4, 0, 2.4].forEach(k => {
        x.beginPath(); x.moveTo(0, -13);
        x.lineTo(Math.cos(k + 2.2) * 15, 4 + Math.sin(k + 2.2) * 6); x.stroke();
      });
      x.save(); x.translate(0, -13);
      const spin = T.charge || 0;
      if (T.tier >= 2) {
        /* rotary barrel cluster */
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * TAU + t * (6 + spin * 40);
          const off = Math.sin(a) * 3.4;
          x.save(); x.translate(0, off);
          barrel(x, 34 - Math.abs(off) * .5, 4, '#6b7280', Math.min(4, T.recoil * 12), k === 0 ? (T.flash || 0) : 0);
          x.restore();
        }
        x.fillStyle = '#2f3743';
        x.beginPath(); x.arc(6, 0, 6.5, 0, TAU); x.fill();
      } else {
        barrel(x, 36, 8, '#6b7280', Math.min(5, T.recoil * 14), T.flash || 0);
        /* heat shield vents */
        x.fillStyle = U.rgba(0, 0, 0, .4);
        for (let k = 0; k < 5; k++) x.fillRect(8 + k * 4, -2, 2, 4);
      }
      /* receiver + belt */
      x.fillStyle = '#2b3340';
      x.beginPath(); x.roundRect(-16, -6, 20, 12, 3); x.fill();
      x.strokeStyle = '#b8a24a'; x.lineWidth = 3;
      x.beginPath();
      x.moveTo(-6, 5);
      x.quadraticCurveTo(-12, 12 + Math.sin(t * 9) * 2, -20, 13);
      x.stroke();
      /* glowing barrel when wound up */
      if (spin > .3) {
        x.save(); x.globalCompositeOperation = 'lighter';
        x.globalAlpha = (spin - .3) * .8;
        const g = x.createLinearGradient(6, 0, 34, 0);
        g.addColorStop(0, U.rgba(255, 120, 40, 0));
        g.addColorStop(1, U.rgba(255, 90, 30, .9));
        x.strokeStyle = g; x.lineWidth = 6; x.lineCap = 'round';
        x.beginPath(); x.moveTo(6, 0); x.lineTo(34, 0); x.stroke();
        x.restore();
      }
      x.restore();
      x.restore();
    },

    sniper(x, T, t) {
      const d = TOWERS.sniper;
      emplacement(x, d.col, T.tier + 1, 18);
      /* spotter's scope on a stand */
      x.strokeStyle = '#39424f'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(-16, 6); x.lineTo(-16, -12); x.stroke();
      x.fillStyle = '#1a1f28';
      x.beginPath(); x.roundRect(-22, -18, 13, 6, 2); x.fill();

      x.save(); x.rotate(T.aim || 0);
      x.strokeStyle = '#39424f'; x.lineWidth = 2.6;
      x.beginPath(); x.moveTo(10, -13); x.lineTo(5, 4); x.stroke();
      x.beginPath(); x.moveTo(10, -13); x.lineTo(17, 4); x.stroke();
      x.save(); x.translate(0, -14);
      barrel(x, 46, 7, '#4a5568', Math.min(9, T.recoil * 30), T.flash || 0);
      /* muzzle brake */
      x.fillStyle = '#2b3340';
      x.beginPath(); x.roundRect(38, -5.5, 10, 11, 2); x.fill();
      x.fillStyle = '#141920';
      for (let k = 0; k < 3; k++) x.fillRect(40 + k * 3, -5, 1.6, 10);
      /* receiver, stock, big glass */
      x.fillStyle = '#2f3743';
      x.beginPath(); x.roundRect(-18, -5, 22, 10, 2); x.fill();
      x.fillStyle = '#39424f';
      x.beginPath(); x.roundRect(-30, -4, 13, 8, 2); x.fill();
      x.fillStyle = '#12161d';
      x.beginPath(); x.roundRect(-10, -11, 20, 6, 2); x.fill();
      x.fillStyle = U.rgba(140, 230, 255, .55 + Math.sin(t * 2.2) * .2);
      x.beginPath(); x.arc(10, -8, 2.4, 0, TAU); x.fill();
      /* laser on tier 3 */
      if (T.tier >= 2 && T.target) {
        x.save(); x.globalCompositeOperation = 'lighter';
        x.strokeStyle = U.rgba(255, 60, 60, .35); x.lineWidth = 1;
        x.beginPath(); x.moveTo(46, 0); x.lineTo(500, 0); x.stroke();
        x.restore();
      }
      x.restore();
      x.restore();
    },

    gl(x, T, t) {
      const d = TOWERS.gl;
      emplacement(x, d.col, T.tier + 1, 20);
      crate(x, -18, 8, 15, 10, '#5c6b3a');
      x.save(); x.rotate(T.aim || 0);
      x.fillStyle = '#2f3743';
      x.beginPath(); x.roundRect(-14, -16, 18, 14, 3); x.fill();
      x.save(); x.translate(0, -13);
      /* elevated tube */
      x.save(); x.rotate(-.35);
      barrel(x, 26, 12, '#7a6b3a', Math.min(5, T.recoil * 18), T.flash || 0);
      x.restore();
      /* drum of 40mm */
      x.fillStyle = '#39424f';
      x.beginPath(); x.arc(-6, 6, 9, 0, TAU); x.fill();
      x.strokeStyle = '#5a6472'; x.lineWidth = 1.6;
      x.beginPath(); x.arc(-6, 6, 9, 0, TAU); x.stroke();
      x.fillStyle = '#8a7a3a';
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * TAU + t * .6;
        x.beginPath(); x.arc(-6 + Math.cos(a) * 5.4, 6 + Math.sin(a) * 5.4, 1.8, 0, TAU); x.fill();
      }
      x.restore();
      x.restore();
    },

    mortar(x, T, t) {
      const d = TOWERS.mortar;
      emplacement(x, d.col, T.tier + 1, 24);
      /* shell rack */
      for (let k = 0; k < 4; k++) {
        const sx = -22 + k * 6;
        x.fillStyle = '#4a5a3a';
        x.beginPath(); x.moveTo(sx - 2, 10); x.lineTo(sx + 2, 10); x.lineTo(sx + 2, -2); x.lineTo(sx, -6); x.lineTo(sx - 2, -2); x.closePath(); x.fill();
      }
      /* baseplate */
      x.fillStyle = '#39424f';
      x.beginPath(); x.ellipse(4, 2, 15, 7, 0, 0, TAU); x.fill();
      x.save(); x.rotate(T.aim || 0);
      /* the tube, steeply elevated */
      x.save(); x.translate(0, -4); x.rotate(-1.05);
      const rec = Math.min(6, T.recoil * 20);
      x.save(); x.translate(-rec * .5, 0);
      const g = x.createLinearGradient(0, -8, 0, 8);
      g.addColorStop(0, '#7c8a6a'); g.addColorStop(.5, '#4a5540'); g.addColorStop(1, '#2c3427');
      x.fillStyle = g;
      x.beginPath(); x.roundRect(0, -8, 46 + T.tier * 5, 16, 5); x.fill();
      x.fillStyle = '#0d1016';
      x.beginPath(); x.ellipse(46 + T.tier * 5, 0, 3.5, 6.5, 0, 0, TAU); x.fill();
      /* bands */
      x.strokeStyle = U.rgba(0, 0, 0, .35); x.lineWidth = 1.6;
      for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(k * 11, -8); x.lineTo(k * 11, 8); x.stroke(); }
      x.restore();
      x.restore();
      /* bipod */
      x.strokeStyle = '#4a5568'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(14, -12); x.lineTo(8, 6); x.stroke();
      x.beginPath(); x.moveTo(14, -12); x.lineTo(20, 6); x.stroke();
      x.restore();
      /* smoke ring after firing */
      if (T.recoil > .05) {
        x.save(); x.globalCompositeOperation = 'screen';
        x.globalAlpha = T.recoil * .5;
        x.fillStyle = '#d8dde6';
        x.beginPath(); x.arc(0, -26, 10 + (1 - T.recoil) * 22, 0, TAU); x.fill();
        x.restore();
      }
    },

    rocket(x, T, t) {
      const d = TOWERS.rocket;
      emplacement(x, d.col, T.tier + 1, 21);
      x.save(); x.rotate(T.aim || 0);
      /* turret base */
      x.fillStyle = '#39424f';
      x.beginPath(); x.roundRect(-12, -12, 18, 16, 3); x.fill();
      x.save(); x.translate(0, -11); x.rotate(-.18);
      /* launch tubes */
      const rows = T.tier >= 2 ? 3 : 2;
      for (let r0 = 0; r0 < rows; r0++) {
        const oy = (r0 - (rows - 1) / 2) * 9;
        x.save(); x.translate(0, oy);
        const g = x.createLinearGradient(0, -4.5, 0, 4.5);
        g.addColorStop(0, '#d86a52'); g.addColorStop(.5, '#a03a2c'); g.addColorStop(1, '#5c1e16');
        x.fillStyle = g;
        x.beginPath(); x.roundRect(0, -4.5, 34, 9, 3); x.fill();
        x.fillStyle = '#1a1f28';
        x.beginPath(); x.ellipse(34, 0, 2.6, 3.8, 0, 0, TAU); x.fill();
        /* warhead peeking out */
        if (T.reloaded !== false) {
          x.fillStyle = '#e8d24a';
          x.beginPath(); x.moveTo(34, -2.6); x.lineTo(40, 0); x.lineTo(34, 2.6); x.closePath(); x.fill();
        }
        x.restore();
      }
      x.restore();
      /* seeker dish */
      x.fillStyle = '#2b3340';
      x.beginPath(); x.arc(-10, -14, 6, 0, TAU); x.fill();
      x.fillStyle = U.rgba(120, 220, 255, .5 + Math.sin(t * 3) * .25);
      x.beginPath(); x.arc(-10, -14, 3, 0, TAU); x.fill();
      x.restore();
    },

    flame(x, T, t) {
      const d = TOWERS.flame;
      emplacement(x, d.col, T.tier + 1, 19);
      /* fuel tanks */
      [-15, -6].forEach((tx, i) => {
        const g = x.createLinearGradient(tx - 5, 0, tx + 5, 0);
        g.addColorStop(0, '#7a3a1a'); g.addColorStop(.45, '#c85a2a'); g.addColorStop(1, '#5c2a12');
        x.fillStyle = g;
        x.beginPath(); x.roundRect(tx - 5, -22, 10, 24, 5); x.fill();
        x.fillStyle = '#e8622a';
        x.beginPath(); x.arc(tx, -22, 5, Math.PI, 0); x.fill();
      });
      x.save(); x.rotate(T.aim || 0);
      x.save(); x.translate(0, -10);
      barrel(x, 26, 9, '#6b5240', 0, 0);
      /* pilot light */
      x.save(); x.globalCompositeOperation = 'lighter';
      const flick = .5 + Math.sin(t * 22) * .25;
      const pg = x.createRadialGradient(28, 0, 0, 28, 0, 9);
      pg.addColorStop(0, U.rgba(255, 240, 180, flick));
      pg.addColorStop(1, U.rgba(255, 120, 30, 0));
      x.fillStyle = pg; x.beginPath(); x.arc(28, 0, 9, 0, TAU); x.fill();
      x.restore();
      /* hose back to the tanks */
      x.strokeStyle = '#2b2018'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(-4, 3);
      x.quadraticCurveTo(-16, 10 + Math.sin(t * 5) * 2, -22, 4); x.stroke();
      x.restore();
      x.restore();
    },

    cryo(x, T, t) {
      const d = TOWERS.cryo;
      emplacement(x, d.col, T.tier + 1, 19);
      /* dewar flasks */
      [-14, 14].forEach(tx => {
        const g = x.createLinearGradient(tx - 6, 0, tx + 6, 0);
        g.addColorStop(0, '#4a6b7a'); g.addColorStop(.45, '#a8d8e8'); g.addColorStop(1, '#3a5460');
        x.fillStyle = g;
        x.beginPath(); x.roundRect(tx - 6, -24, 12, 26, 5); x.fill();
        x.fillStyle = '#cfeaf5';
        x.beginPath(); x.ellipse(tx, -24, 6, 3, 0, 0, TAU); x.fill();
        /* frost */
        x.save(); x.globalAlpha = .5; x.fillStyle = '#fff';
        for (let k = 0; k < 5; k++) x.fillRect(tx - 5 + (k * 2.4), -20 + (k % 3) * 6, 1.6, 4);
        x.restore();
      });
      x.save(); x.rotate(T.aim || 0);
      x.save(); x.translate(0, -12);
      barrel(x, 24, 10, '#7fb8cc', 0, 0);
      x.fillStyle = '#2b3340';
      x.beginPath(); x.roundRect(-10, -6, 14, 12, 3); x.fill();
      x.restore();
      x.restore();
      /* vapour pooling at the base */
      x.save(); x.globalAlpha = .22 + Math.sin(t * 2.4) * .07;
      x.fillStyle = '#cfeaf5';
      x.beginPath(); x.ellipse(0, 8, 26 + Math.sin(t * 1.7) * 4, 10, 0, 0, TAU); x.fill();
      x.restore();
    },

    tesla(x, T, t) {
      const d = TOWERS.tesla;
      emplacement(x, d.col, T.tier + 1, 20);
      /* generator */
      crate(x, -17, 8, 16, 12, '#3a4150');
      /* mast */
      const H = 44 + T.tier * 7;
      x.strokeStyle = '#4a5568'; x.lineWidth = 4;
      x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -H); x.stroke();
      x.strokeStyle = '#39424f'; x.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const y0 = -k * H / 5, y1 = -(k + 1) * H / 5;
        x.beginPath(); x.moveTo(-5, y0); x.lineTo(5, y1); x.stroke();
        x.beginPath(); x.moveTo(5, y0); x.lineTo(-5, y1); x.stroke();
      }
      /* insulator stack */
      for (let k = 0; k < 3; k++) {
        x.fillStyle = '#8a7f6a';
        x.beginPath(); x.ellipse(0, -H - 4 - k * 5, 7 - k, 2.6, 0, 0, TAU); x.fill();
      }
      /* toroid */
      const ty = -H - 22;
      const g = x.createLinearGradient(0, ty - 8, 0, ty + 8);
      g.addColorStop(0, '#d8dce6'); g.addColorStop(.5, '#8d939c'); g.addColorStop(1, '#4a5058');
      x.fillStyle = g;
      x.beginPath(); x.ellipse(0, ty, 15, 7, 0, 0, TAU); x.fill();
      x.fillStyle = '#2b3340';
      x.beginPath(); x.ellipse(0, ty, 6, 2.8, 0, 0, TAU); x.fill();
      /* idle corona */
      x.save(); x.globalCompositeOperation = 'lighter';
      const pulse = .25 + Math.sin(t * 5) * .12 + (T.flash || 0) * .8;
      const cg = x.createRadialGradient(0, ty, 0, 0, ty, 46);
      cg.addColorStop(0, U.alpha(d.col, pulse));
      cg.addColorStop(1, U.alpha(d.col, 0));
      x.fillStyle = cg; x.beginPath(); x.arc(0, ty, 46, 0, TAU); x.fill();
      /* crawling arcs */
      x.strokeStyle = U.rgba(200, 190, 255, .55 + (T.flash || 0));
      x.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) {
        const a0 = t * 3 + k * 2.1;
        x.beginPath();
        x.moveTo(Math.cos(a0) * 13, ty + Math.sin(a0) * 5);
        for (let j = 1; j <= 3; j++) {
          x.lineTo(Math.cos(a0 + j * .5) * (13 + j * 5) + (Math.random() - .5) * 5,
                   ty + Math.sin(a0 + j * .5) * (5 + j * 4) + (Math.random() - .5) * 5);
        }
        x.stroke();
      }
      x.restore();
    }
  };

  return { enemy, tower, critter, bird, bug, shadedBody, emplacement, barrel, ellipse };
})();


/* ============================================================
   RENDERER
   ============================================================ */
/* ============================================================
   RENDERER
   Everything below draws through the camera transform, so the
   world can be far larger than the window.
   ============================================================ */
const Render = (() => {

  /* VIEW_* changes on resize/rotate, so never capture it at module load —
     every draw reads the live value. */
  let grainTiles = null, grainIdx = 0;

  function initGrain() {
    grainTiles = [];
    for (let i = 0; i < 4; i++) {
      const s = U.surface(220, 220);
      const img = s.x.createImageData(220, 220);
      const d = img.data;
      for (let k = 0; k < d.length; k += 4) {
        const v = (Math.random() * 255) | 0;
        d[k] = d[k + 1] = d[k + 2] = v;
        d[k + 3] = 16;
      }
      s.x.putImageData(img, 0, 0);
      grainTiles.push(s.c);
    }
  }

  /* ---------- small pieces ---------- */
  function hpBar(x, e) {
    if (e.hp >= e.maxHp) return;
    const w = Math.max(20, e.r * 2.1), h = e.boss ? 6 : 4;
    const y = -e.r - (e.boss ? 22 : 12);
    x.fillStyle = U.rgba(0, 0, 0, .65);
    x.beginPath(); x.roundRect(-w / 2 - 1, y - 1, w + 2, h + 2, 2); x.fill();
    const f = U.clamp(e.hp / e.maxHp, 0, 1);
    const col = f > .55 ? '#3fdd8f' : (f > .25 ? '#ffc21a' : '#ff4a5a');
    x.fillStyle = col;
    x.beginPath(); x.roundRect(-w / 2, y, w * f, h, 1.5); x.fill();
    if (e.shieldHp > 0) {
      x.fillStyle = '#6cc8ff';
      x.beginPath(); x.roundRect(-w / 2, y - 4, w * U.clamp(e.shieldHp / e.maxShield, 0, 1), 2.5, 1.5); x.fill();
    }
  }

  function statusIcons(x, e) {
    const y = -e.r - (e.boss ? 32 : 22);
    let n = 0;
    const dot = (col) => {
      x.fillStyle = col;
      x.beginPath(); x.arc(-8 + n * 8, y, 3, 0, U.TAU); x.fill();
      n++;
    };
    if (e.slowT > 0) dot('#6cc8ff');
    if (e.burnT > 0) dot('#ff8a2a');
    if (e.stunT > 0) dot('#ffe066');
    if (e.shredT > 0) dot('#b9c6d6');
  }

  function shadow(x, e) {
    const lift = e.fly ? 26 : 0;
    x.save();
    x.globalAlpha = e.fly ? .28 : .42;
    x.fillStyle = '#000';
    x.beginPath();
    x.ellipse(e.x + 5 + lift * .2, e.y + e.r * .5 + lift, e.r * (e.fly ? .8 : 1.05), e.r * .42, 0, 0, U.TAU);
    x.fill();
    x.restore();
  }

  /* ---------- projectiles ---------- */
  function drawProjectile(x, p, t) {
    x.save();
    x.translate(p.x, p.y);
    switch (p.kind) {
      case 'bullet':
        x.rotate(p.a);
        x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55;
        x.fillStyle = p.col || '#ffe6a0';
        x.beginPath(); x.roundRect(-(p.tracer || 16), -1.1, (p.tracer || 16), 2.2, 1.1); x.fill();
        x.restore();
        x.fillStyle = p.col || '#fff2c0';
        x.beginPath(); x.roundRect(-4, -1.5, 9, 3, 1.5); x.fill();
        break;
      case 'shell':
        x.rotate(p.spin);
        x.fillStyle = '#6b6b3a';
        x.beginPath(); x.roundRect(-7, -4, 14, 8, 3); x.fill();
        x.fillStyle = '#c9b04a';
        x.beginPath(); x.moveTo(7, -4); x.lineTo(13, 0); x.lineTo(7, 4); x.closePath(); x.fill();
        x.strokeStyle = U.rgba(0, 0, 0, .4); x.lineWidth = 1;
        x.beginPath(); x.moveTo(-2, -4); x.lineTo(-2, 4); x.stroke();
        break;
      case 'bomb':
        x.rotate(p.spin);
        x.fillStyle = '#4a5540';
        x.beginPath(); x.ellipse(0, 0, 9, 5.5, 0, 0, U.TAU); x.fill();
        x.fillStyle = '#2c3427';
        x.beginPath(); x.moveTo(-9, -5); x.lineTo(-15, 0); x.lineTo(-9, 5); x.closePath(); x.fill();
        x.fillStyle = '#c9b04a';
        x.beginPath(); x.arc(6, 0, 2.4, 0, U.TAU); x.fill();
        break;
      case 'rocketp': {
        x.rotate(p.a);
        /* exhaust */
        x.save(); x.globalCompositeOperation = 'lighter';
        const g = x.createLinearGradient(-34, 0, -4, 0);
        g.addColorStop(0, U.rgba(255, 120, 30, 0));
        g.addColorStop(.6, U.rgba(255, 170, 60, .55));
        g.addColorStop(1, U.rgba(255, 245, 210, .9));
        x.fillStyle = g;
        x.beginPath(); x.moveTo(-34, 0); x.lineTo(-4, -4.5); x.lineTo(-4, 4.5); x.closePath(); x.fill();
        x.restore();
        x.fillStyle = '#c8ccd4';
        x.beginPath(); x.roundRect(-8, -3, 16, 6, 2); x.fill();
        x.fillStyle = '#c0483a';
        x.beginPath(); x.moveTo(8, -3); x.lineTo(15, 0); x.lineTo(8, 3); x.closePath(); x.fill();
        x.fillStyle = '#39424f';
        x.beginPath(); x.moveTo(-8, -3); x.lineTo(-12, -7); x.lineTo(-6, -3); x.closePath(); x.fill();
        x.beginPath(); x.moveTo(-8, 3); x.lineTo(-12, 7); x.lineTo(-6, 3); x.closePath(); x.fill();
        break;
      }
      case 'frost':
        x.fillStyle = '#cfeaf5';
        for (let k = 0; k < 4; k++) {
          const a = p.seed + k * 1.6 + t * 6;
          x.beginPath(); x.arc(Math.cos(a) * 4, Math.sin(a) * 4, 1.8, 0, U.TAU); x.fill();
        }
        break;
    }
    x.restore();
  }

  /* ---------- particles ---------- */
  function drawParticle(x, p) {
    const life = p.t / p.life;
    const a = (1 - life);
    x.save();
    x.globalAlpha = a * (p.alpha === undefined ? 1 : p.alpha);
    switch (p.kind) {
      case 'spark':
        x.strokeStyle = p.col; x.lineWidth = p.r * a;
        x.beginPath(); x.moveTo(p.x, p.y);
        x.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); x.stroke();
        break;
      case 'tracer':
        x.globalCompositeOperation = 'lighter';
        x.strokeStyle = p.col; x.lineWidth = p.r * (1 - life * .6);
        x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x2, p.y2); x.stroke();
        break;
      case 'goo':
        x.fillStyle = p.col;
        x.beginPath(); x.ellipse(p.x, p.y, p.r * (1 - life * .4), p.r * (1 - life * .6), p.a || 0, 0, U.TAU); x.fill();
        break;
      case 'brass':
        x.fillStyle = '#d8b34a';
        x.save(); x.translate(p.x, p.y); x.rotate(p.a + p.t * 14);
        x.fillRect(-2.6, -1, 5.2, 2);
        x.restore();
        break;
      case 'smoke': {
        x.globalCompositeOperation = 'screen';
        x.globalAlpha = a * .3;
        const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (1 + life * 2));
        g.addColorStop(0, p.col); g.addColorStop(1, U.rgba(0, 0, 0, 0));
        x.fillStyle = g;
        x.beginPath(); x.arc(p.x, p.y, p.r * (1 + life * 2), 0, U.TAU); x.fill();
        break;
      }
      case 'fire': {
        x.globalCompositeOperation = 'lighter';
        const fg = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (1 + life));
        fg.addColorStop(0, U.rgba(255, 240, 180, a));
        fg.addColorStop(.4, U.rgba(255, 140, 40, a * .7));
        fg.addColorStop(1, U.rgba(255, 60, 0, 0));
        x.fillStyle = fg;
        x.beginPath(); x.arc(p.x, p.y, p.r * (1 + life), 0, U.TAU); x.fill();
        break;
      }
      case 'ring':
        x.globalCompositeOperation = 'lighter';
        x.strokeStyle = p.col; x.lineWidth = p.w * (1 - life);
        x.beginPath(); x.arc(p.x, p.y, p.r * U.ease.outCubic(life), 0, U.TAU); x.stroke();
        break;
      case 'shock':
        x.strokeStyle = p.col; x.lineWidth = 2 * (1 - life);
        x.beginPath(); x.ellipse(p.x, p.y, p.r * U.ease.outQuart(life), p.r * .38 * U.ease.outQuart(life), 0, 0, U.TAU);
        x.stroke();
        break;
      case 'arc': {
        x.globalCompositeOperation = 'lighter';
        x.strokeStyle = p.col; x.lineWidth = 2.6 * (1 - life);
        x.beginPath();
        x.moveTo(p.x, p.y);
        const seg = 5;
        for (let k = 1; k <= seg; k++) {
          const f = k / seg;
          const jx = (k < seg) ? (Math.random() - .5) * 16 : 0;
          const jy = (k < seg) ? (Math.random() - .5) * 16 : 0;
          x.lineTo(U.lerp(p.x, p.x2, f) + jx, U.lerp(p.y, p.y2, f) + jy);
        }
        x.stroke();
        break;
      }
      case 'ice':
        x.fillStyle = p.col;
        x.save(); x.translate(p.x, p.y); x.rotate(p.a);
        for (let k = 0; k < 3; k++) {
          x.rotate(Math.PI / 3);
          x.fillRect(-p.r * (1 - life), -.8, p.r * 2 * (1 - life), 1.6);
        }
        x.restore();
        break;
      case 'feather':
        x.fillStyle = p.col;
        x.save(); x.translate(p.x, p.y); x.rotate(p.a + p.t * 3);
        x.beginPath(); x.ellipse(0, 0, p.r * 2, p.r * .7, 0, 0, U.TAU); x.fill();
        x.restore();
        break;
    }
    x.restore();
  }

  /* ---------- pickups: shoot them for cash and supplies ---------- */
  function drawPickup(x, p, t) {
    const bob = Math.sin(t * 4 + p.seed) * 4;
    const fade = p.life < 2.5 ? (Math.sin(t * 14) * .35 + .65) : 1;
    x.save();
    x.globalAlpha = fade;

    /* ground shadow + beacon */
    x.save();
    x.globalAlpha = .4 * fade; x.fillStyle = '#000';
    x.beginPath(); x.ellipse(p.x + 3, p.y + 6, 15, 6, 0, 0, U.TAU); x.fill();
    x.restore();

    x.save();
    x.globalCompositeOperation = 'lighter';
    const col = p.kind === 'cash' ? '#ffc21a' : (p.kind === 'medkit' ? '#3fdd8f' : '#6cc8ff');
    const g = x.createRadialGradient(p.x, p.y - 10 + bob, 0, p.x, p.y - 10 + bob, 54);
    g.addColorStop(0, U.alpha(col, .38 * fade));
    g.addColorStop(1, U.alpha(col, 0));
    x.fillStyle = g;
    x.beginPath(); x.arc(p.x, p.y - 10 + bob, 54, 0, U.TAU); x.fill();
    x.restore();

    x.translate(p.x, p.y - 14 + bob);

    if (p.kind === 'cash') {
      x.save(); x.rotate(Math.sin(t * 2 + p.seed) * .25);
      /* banded stack of notes */
      for (let k = 2; k >= 0; k--) {
        x.fillStyle = k === 0 ? '#4c7f4a' : U.shade('#3d6b3c', 1 - k * .12);
        x.beginPath(); x.roundRect(-15, -9 - k * 3, 30, 17, 2); x.fill();
      }
      x.strokeStyle = '#2a4a29'; x.lineWidth = 1;
      x.beginPath(); x.roundRect(-15, -9, 30, 17, 2); x.stroke();
      x.fillStyle = '#d94a3a';
      x.fillRect(-5, -9, 10, 17);
      x.fillStyle = '#cfe6cf';
      x.font = 'bold 10px Helvetica,Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('$', 0, 0);
      x.restore();
    } else if (p.kind === 'medkit') {
      x.fillStyle = '#e8eef4';
      x.beginPath(); x.roundRect(-13, -10, 26, 20, 3); x.fill();
      x.strokeStyle = '#9aa5b4'; x.lineWidth = 1.4;
      x.beginPath(); x.roundRect(-13, -10, 26, 20, 3); x.stroke();
      x.fillStyle = '#d63a3a';
      x.fillRect(-3, -7, 6, 14);
      x.fillRect(-9, -3, 18, 6);
      x.fillStyle = '#39424f';
      x.beginPath(); x.roundRect(-5, -13, 10, 4, 1.5); x.fill();
    } else {
      /* ammo crate */
      x.fillStyle = '#4a5a3a';
      x.beginPath(); x.roundRect(-15, -10, 30, 20, 2); x.fill();
      x.fillStyle = '#5f7349';
      x.fillRect(-15, -10, 30, 6);
      x.strokeStyle = '#2c3427'; x.lineWidth = 1.4;
      x.beginPath(); x.roundRect(-15, -10, 30, 20, 2); x.stroke();
      x.fillStyle = '#c9b04a';
      x.font = 'bold 8px Helvetica,Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('AMMO', 0, 3);
    }

    /* Reticle drawn at the REAL grab radius, so what looks tappable is
       tappable. On a zoomed-out phone that ring is noticeably wider. */
    const rr = (p.grabR || 34) + Math.sin(t * 3 + p.seed) * 2;
    const cy = 14 - bob;                 /* back to the drop's true centre */
    x.strokeStyle = U.rgba(255, 255, 255, .5);
    x.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4 + t * .6;
      x.beginPath();
      x.arc(0, cy, rr, a - .3, a + .3);
      x.stroke();
    }
    x.restore();
  }

  /* ---------- weather ---------- */
  const wx = { drops: [], flakes: [], leaves: [], fog: [], kind: 'clear' };

  function initWeather(kind) {
    const W = VIEW_W, H = VIEW_H;
    wx.kind = kind;
    wx.drops.length = 0; wx.flakes.length = 0; wx.leaves.length = 0; wx.fog.length = 0;
    if (kind === 'rain') {
      for (let i = 0; i < 300; i++) wx.drops.push({ x: Math.random() * (W + 200) - 100, y: Math.random() * H, l: 12 + Math.random() * 26, s: 900 + Math.random() * 700 });
    } else if (kind === 'snow') {
      for (let i = 0; i < 220; i++) wx.flakes.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.6, s: 26 + Math.random() * 50, p: Math.random() * 10 });
    } else if (kind === 'leaves') {
      for (let i = 0; i < 80; i++) wx.leaves.push({ x: Math.random() * W, y: Math.random() * H, r: 3 + Math.random() * 4, s: 30 + Math.random() * 50, p: Math.random() * 10, a: Math.random() * 6, c: ['#c9621f', '#e08a1e', '#a8431a', '#d9a020'][(Math.random() * 4) | 0] });
    } else if (kind === 'fog') {
      for (let i = 0; i < 12; i++) wx.fog.push({ x: Math.random() * W, y: Math.random() * H, r: 200 + Math.random() * 260, s: 6 + Math.random() * 14, a: .05 + Math.random() * .07 });
    }
  }

  function stepWeather(kind, dt, wind) {
    const W = VIEW_W, H = VIEW_H;
    if (kind === 'rain') {
      wx.drops.forEach(d => {
        d.y += d.s * dt; d.x += wind * dt * 60;
        if (d.y > H + 30) { d.y = -30; d.x = Math.random() * (W + 200) - 100; }
      });
    } else if (kind === 'snow') {
      wx.flakes.forEach(f => {
        f.y += f.s * dt; f.p += dt;
        f.x += Math.sin(f.p) * 16 * dt + wind * dt * 30;
        if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W; }
      });
    } else if (kind === 'leaves') {
      wx.leaves.forEach(f => {
        f.y += f.s * dt; f.p += dt; f.a += dt * 2;
        f.x += Math.sin(f.p * .8) * 34 * dt + wind * dt * 40;
        if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W; }
      });
    } else if (kind === 'fog') {
      wx.fog.forEach(f => { f.x += f.s * dt; if (f.x - f.r > W) f.x = -f.r; });
    }
  }

  /* weather draws in SCREEN space, after the camera transform is popped */
  function drawWeather(x, kind, t) {
    if (kind === 'rain') {
      x.save();
      x.strokeStyle = U.rgba(190, 215, 245, .35); x.lineWidth = 1.2;
      x.beginPath();
      wx.drops.forEach(d => { x.moveTo(d.x, d.y); x.lineTo(d.x - d.l * .22, d.y + d.l); });
      x.stroke();
      x.restore();
    } else if (kind === 'snow') {
      x.save(); x.fillStyle = U.rgba(255, 255, 255, .78);
      wx.flakes.forEach(f => { x.beginPath(); x.arc(f.x, f.y, f.r, 0, U.TAU); x.fill(); });
      x.restore();
    } else if (kind === 'leaves') {
      wx.leaves.forEach(f => {
        x.save(); x.translate(f.x, f.y); x.rotate(f.a);
        x.fillStyle = f.c; x.globalAlpha = .85;
        x.beginPath(); x.ellipse(0, 0, f.r * 1.7, f.r * .7, 0, 0, U.TAU); x.fill();
        x.restore();
      });
    } else if (kind === 'fog') {
      x.save();
      wx.fog.forEach(f => {
        const g = x.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, U.rgba(210, 225, 240, f.a));
        g.addColorStop(1, U.rgba(210, 225, 240, 0));
        x.fillStyle = g;
        x.beginPath(); x.arc(f.x, f.y, f.r, 0, U.TAU); x.fill();
      });
      x.restore();
    }
  }

  /* ---------- floating text ---------- */
  function drawFloat(x, f) {
    const p = f.t / f.life;
    x.save();
    x.globalAlpha = 1 - U.ease.inQuad(p);
    x.translate(f.x, f.y - p * 40);
    x.font = `bold ${f.size}px Helvetica,Arial`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 3; x.strokeStyle = U.rgba(0, 0, 0, .75);
    x.strokeText(f.txt, 0, 0);
    x.fillStyle = f.col;
    x.fillText(f.txt, 0, 0);
    x.restore();
  }

  /* ---------- the placement ghost ---------- */
  function drawGhost(x, G, t) {
    const g = G.ui.ghost;
    if (!g) return;
    const d = TOWERS[g.type];
    const s = d.tiers[0];
    const ok = g.valid && G.gold >= s.cost;
    const col = ok ? '#3fdd8f' : '#ff4a5a';
    const W = G.wscale || 1;
    const range = s.range * W, minRange = s.minRange ? s.minRange * W : 0;

    /* range */
    x.save();
    x.globalCompositeOperation = 'lighter';
    const rg = x.createRadialGradient(g.x, g.y, range * .55, g.x, g.y, range);
    rg.addColorStop(0, U.alpha(col, .02));
    rg.addColorStop(.86, U.alpha(col, .10));
    rg.addColorStop(1, U.alpha(col, 0));
    x.fillStyle = rg;
    x.beginPath(); x.ellipse(g.x, g.y, range, range * .86, 0, 0, U.TAU); x.fill();
    x.restore();

    x.save();
    x.strokeStyle = U.alpha(col, .8); x.lineWidth = 2;
    x.setLineDash([10, 8]); x.lineDashOffset = -t * 30;
    x.beginPath(); x.ellipse(g.x, g.y, range, range * .86, 0, 0, U.TAU); x.stroke();
    x.setLineDash([]);

    /* minimum range for indirect fire */
    if (minRange) {
      x.strokeStyle = U.rgba(255, 90, 90, .55); x.lineWidth = 1.6;
      x.setLineDash([5, 6]);
      x.beginPath(); x.ellipse(g.x, g.y, minRange, minRange * .86, 0, 0, U.TAU); x.stroke();
      x.setLineDash([]);
    }

    /* footprint */
    x.fillStyle = U.alpha(col, .18);
    x.beginPath(); x.ellipse(g.x, g.y, d.foot, d.foot * .46, 0, 0, U.TAU); x.fill();
    x.strokeStyle = U.alpha(col, .9); x.lineWidth = 2;
    x.beginPath(); x.ellipse(g.x, g.y, d.foot, d.foot * .46, 0, 0, U.TAU); x.stroke();
    x.restore();

    /* the weapon itself, translucent */
    x.save();
    x.globalAlpha = ok ? .62 : .35;
    x.translate(g.x, g.y);
    const fn = SPRITE.tower[g.type];
    if (fn) fn(x, { type: g.type, def: d, tier: 0, recoil: 0, aim: -Math.PI / 2, charge: 0, flash: 0, seed: 1 }, t);
    x.restore();

    if (!ok) {
      x.save();
      x.translate(g.x, g.y - d.foot - 26);
      x.font = 'bold 12px Helvetica,Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const msg = !g.valid ? 'NO CLEAR GROUND' : 'INSUFFICIENT FUNDS';
      const w2 = x.measureText(msg).width + 18;
      x.fillStyle = U.rgba(8, 12, 20, .9);
      x.beginPath(); x.roundRect(-w2 / 2, -11, w2, 22, 5); x.fill();
      x.strokeStyle = U.rgba(255, 74, 90, .7); x.lineWidth = 1.4; x.stroke();
      x.fillStyle = '#ff8a95';
      x.fillText(msg, 0, 1);
      x.restore();
    }
  }

  /* ---------- other players' cursors ---------- */
  function drawPeers(x, G, t) {
    if (!G.peers) return;
    for (const id in G.peers) {
      const p = G.peers[id];
      if (p.self || !p.cursor) continue;
      const c = p.cursor;
      x.save();
      x.translate(c.x, c.y);
      /* reticle */
      x.strokeStyle = p.col; x.lineWidth = 2;
      x.beginPath(); x.arc(0, 0, 11, 0, U.TAU); x.stroke();
      x.beginPath();
      x.moveTo(-17, 0); x.lineTo(-6, 0);
      x.moveTo(6, 0); x.lineTo(17, 0);
      x.moveTo(0, -17); x.lineTo(0, -6);
      x.moveTo(0, 6); x.lineTo(0, 17);
      x.stroke();
      /* name tag */
      x.font = 'bold 11px Helvetica,Arial';
      x.textAlign = 'left'; x.textBaseline = 'middle';
      const w2 = x.measureText(p.name).width + 12;
      x.fillStyle = U.rgba(8, 12, 20, .82);
      x.beginPath(); x.roundRect(15, 12, w2, 18, 4); x.fill();
      x.fillStyle = p.col;
      x.fillText(p.name, 21, 22);
      x.restore();
    }
  }

  /* =========================================================
     FRAME
     ========================================================= */
  function frame(x, G, t, dt) {
    if (!grainTiles) initGrain();
    const W = VIEW_W, H = VIEW_H;
    const L = G.level;
    const cam = G.cam;

    x.clearRect(0, 0, W, H);

    x.save();
    x.translate(0, cam.padT);          /* board lives below the HUD, above the dock */
    x.scale(cam.z, cam.z);
    x.translate(-cam.x, -cam.y);
    const vis = cam.visible(240);

    /* 1. baked ground + decals + night grade (scenery only) */
    x.drawImage(G.bg, 0, 0);
    if (G.decals) x.drawImage(G.decals, 0, 0);
    if (G.lights) {
      x.save(); x.globalCompositeOperation = 'multiply';
      x.drawImage(G.lights, 0, 0); x.restore();
    }
    if (G.glow) {
      x.save(); x.globalCompositeOperation = 'lighter';
      x.drawImage(G.glow, 0, 0); x.restore();
    }

    /* 2. selected weapon's reach */
    if (G.ui.rangePreview) {
      const rp = G.ui.rangePreview;
      x.save();
      x.globalCompositeOperation = 'lighter';
      const g = x.createRadialGradient(rp.x, rp.y, rp.r * .55, rp.x, rp.y, rp.r);
      g.addColorStop(0, U.rgba(120, 190, 255, .02));
      g.addColorStop(.86, U.rgba(120, 190, 255, .10));
      g.addColorStop(1, U.rgba(120, 190, 255, 0));
      x.fillStyle = g;
      x.beginPath(); x.ellipse(rp.x, rp.y, rp.r, rp.r * .86, 0, 0, U.TAU); x.fill();
      x.restore();
      x.save();
      x.strokeStyle = U.rgba(150, 210, 255, .55); x.lineWidth = 2;
      x.setLineDash([9, 8]); x.lineDashOffset = -t * 26;
      x.beginPath(); x.ellipse(rp.x, rp.y, rp.r, rp.r * .86, 0, 0, U.TAU); x.stroke();
      if (rp.min) {
        x.strokeStyle = U.rgba(255, 110, 110, .45);
        x.beginPath(); x.ellipse(rp.x, rp.y, rp.min, rp.min * .86, 0, 0, U.TAU); x.stroke();
      }
      x.setLineDash([]);
      x.restore();
    }

    /* 3. placement ghost sits under the units */
    drawGhost(x, G, t);

    /* 4. shadows */
    for (const e of G.enemies) {
      if (e.x < vis.x0 || e.x > vis.x1 || e.y < vis.y0 || e.y > vis.y1) continue;
      shadow(x, e);
    }

    /* 5. entities, painter-sorted */
    const drawables = [];
    for (const tw of G.towers) {
      if (tw.x < vis.x0 || tw.x > vis.x1 || tw.y < vis.y0 || tw.y > vis.y1) continue;
      drawables.push({ y: tw.y, kind: 'tower', o: tw });
    }
    for (const e of G.enemies) {
      if (e.x < vis.x0 || e.x > vis.x1 || e.y < vis.y0 || e.y > vis.y1) continue;
      drawables.push({ y: e.y + (e.fly ? -30 : 0), kind: 'enemy', o: e });
    }
    drawables.push({ y: L.base.y, kind: 'apple', o: null });
    drawables.sort((a, b) => a.y - b.y);

    for (const d of drawables) {
      if (d.kind === 'apple') {
        ART.PROP.apple(x, L.base.x, L.base.y, 1.35, t);
        if (G.appleFlash > 0) {
          x.save();
          x.globalCompositeOperation = 'lighter';
          x.globalAlpha = G.appleFlash;
          const g = x.createRadialGradient(L.base.x, L.base.y - 14, 0, L.base.x, L.base.y - 14, 150);
          g.addColorStop(0, U.rgba(255, 60, 60, .9)); g.addColorStop(1, U.rgba(255, 60, 60, 0));
          x.fillStyle = g; x.beginPath(); x.arc(L.base.x, L.base.y - 14, 150, 0, U.TAU); x.fill();
          x.restore();
        }
        continue;
      }

      if (d.kind === 'tower') {
        const tw = d.o;
        x.save();
        x.translate(tw.x, tw.y);
        const fn = SPRITE.tower[tw.type];
        if (fn) fn(x, tw, t);
        if (G.ui.selected === tw) {
          x.strokeStyle = U.rgba(255, 194, 26, .85); x.lineWidth = 2.5;
          x.setLineDash([6, 5]); x.lineDashOffset = -t * 22;
          x.beginPath(); x.ellipse(0, 2, tw.def.foot + 8, (tw.def.foot + 8) * .46, 0, 0, U.TAU); x.stroke();
          x.setLineDash([]);
        }
        /* who built it, in co-op */
        if (G.coop && tw.owner !== undefined && G.peers && G.peers[tw.owner]) {
          x.fillStyle = G.peers[tw.owner].col;
          x.beginPath(); x.arc(0, tw.def.foot * .46 + 13, 3, 0, U.TAU); x.fill();
        }
        x.restore();
        continue;
      }

      /* enemy */
      const e = d.o;
      const bob = e.fly ? Math.sin(t * 3 + e.seed) * 4 : 0;

      if (L.night > .25) {
        x.save();
        x.globalCompositeOperation = 'lighter';
        const cy2 = e.y - (e.fly ? 28 : 0) + bob;
        const gg = x.createRadialGradient(e.x, cy2, 0, e.x, cy2, e.r * 2.4);
        gg.addColorStop(0, U.alpha(e.col, .16 * L.night));
        gg.addColorStop(1, U.alpha(e.col, 0));
        x.fillStyle = gg;
        x.beginPath(); x.arc(e.x, cy2, e.r * 2.4, 0, U.TAU); x.fill();
        x.restore();
      }

      x.save();
      x.translate(e.x, e.y - (e.fly ? 28 : 0));
      x.translate(0, bob);
      x.rotate(e.a);
      const drawCol = e.hitFlash > 0
        ? U.mix(e.col, '#ffffff', Math.min(.85, e.hitFlash * 2.2))
        : U.mix(e.col, L.pal.nightTint || '#0a1024', L.night * .24);
      const proxy = { r: e.r, spd: e.spd, seed: e.seed, col: drawCol, boss: e.boss };
      const fn = SPRITE.enemy[e.type];
      if (fn) fn(x, proxy, t); else SPRITE.enemy.rat(x, proxy, t);

      if (e.frozen > 0) {
        x.save();
        x.globalAlpha = .55;
        const g = x.createRadialGradient(0, 0, 0, 0, 0, e.r * 1.5);
        g.addColorStop(0, U.rgba(180, 235, 255, .35));
        g.addColorStop(.7, U.rgba(120, 200, 255, .55));
        g.addColorStop(1, U.rgba(90, 170, 255, .15));
        x.fillStyle = g;
        x.beginPath(); x.arc(0, 0, e.r * 1.5, 0, U.TAU); x.fill();
        x.strokeStyle = U.rgba(220, 250, 255, .7); x.lineWidth = 1.4;
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * U.TAU + e.seed;
          x.beginPath(); x.moveTo(Math.cos(a) * e.r * .5, Math.sin(a) * e.r * .5);
          x.lineTo(Math.cos(a) * e.r * 1.45, Math.sin(a) * e.r * 1.45); x.stroke();
        }
        x.restore();
      }
      if (e.burnT > 0) {
        x.save(); x.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const a = t * 6 + k * 2.1 + e.seed;
          const fx = Math.cos(a) * e.r * .6, fy = Math.sin(a * 1.3) * e.r * .5 - e.r * .4;
          const g = x.createRadialGradient(fx, fy, 0, fx, fy, e.r * .7);
          g.addColorStop(0, U.rgba(255, 220, 140, .55));
          g.addColorStop(1, U.rgba(255, 90, 20, 0));
          x.fillStyle = g; x.beginPath(); x.arc(fx, fy, e.r * .7, 0, U.TAU); x.fill();
        }
        x.restore();
      }
      x.restore();

      x.save();
      x.translate(e.x, e.y - (e.fly ? 28 : 0) + bob);
      hpBar(x, e);
      statusIcons(x, e);
      if (e.boss) {
        x.font = 'bold 10px Helvetica,Arial'; x.textAlign = 'center';
        x.fillStyle = U.rgba(0, 0, 0, .7);
        x.fillText(ENEMIES[e.type].name, 0, -e.r - 34);
        x.fillStyle = '#ff8a95';
        x.fillText(ENEMIES[e.type].name, 0, -e.r - 35);
      }
      x.restore();
    }

    /* 6. sustained beams — flamethrower cones */
    for (const tw of G.towers) {
      if (tw.def.proj !== 'flame' || !tw.beamTarget || !tw.beamTarget.alive) continue;
      const s = tw.def.tiers[tw.tier];
      x.save();
      x.translate(tw.x, tw.y - 10);
      x.rotate(tw.aim || 0);
      x.globalCompositeOperation = 'lighter';
      const flick = .78 + Math.sin(t * 26) * .22;
      const g = x.createRadialGradient(10, 0, 0, 10, 0, s.range);
      g.addColorStop(0, U.rgba(255, 250, 210, .85 * flick));
      g.addColorStop(.22, U.rgba(255, 180, 60, .60 * flick));
      g.addColorStop(.62, U.rgba(255, 90, 20, .28 * flick));
      g.addColorStop(1, U.rgba(180, 40, 10, 0));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(6, 0);
      x.arc(6, 0, s.range, -s.arc / 2, s.arc / 2);
      x.closePath(); x.fill();
      x.restore();
    }

    /* 7. projectiles + particles */
    for (const p of G.projectiles) {
      if (p.arc) {
        x.save(); x.globalAlpha = .3; x.fillStyle = '#000';
        x.beginPath(); x.ellipse(p.gx, p.gy, 8, 3.6, 0, 0, U.TAU); x.fill();
        x.restore();
      }
      drawProjectile(x, p, t);
    }
    for (const p of G.particles) drawParticle(x, p);

    /* 8. pickups sit above the smoke so they never get lost */
    for (const p of G.pickups) { p.grabR = G.grabR || 40; drawPickup(x, p, t); }

    /* 9. ability tints */
    if (G.freezeT > 0) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = U.clamp(G.freezeT / 1.2, 0, 1) * .24;
      x.fillStyle = '#bfe8ff';
      x.fillRect(cam.x, cam.y, W / cam.z, H / cam.z);
      x.restore();
    }

    /* 10. peers */
    drawPeers(x, G, t);

    /* 11. floating numbers ride in world space */
    for (const f of G.floats) drawFloat(x, f);

    x.restore();      /* <-- camera transform ends here */

    /* ---- screen space from here down ---- */

    stepWeather(L.weather, dt, G.wind);
    drawWeather(x, L.weather, t);

    if (G.lightning > 0) {
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = G.lightning * .55;
      x.fillStyle = '#c8dcff'; x.fillRect(0, 0, W, H);
      x.restore();
    }

    /* post: vignette + grain */
    x.save();
    x.globalCompositeOperation = 'multiply';
    const v = x.createRadialGradient(W / 2, H * .48, H * .40, W / 2, H * .48, H * 1.1);
    v.addColorStop(0, '#ffffff');
    v.addColorStop(1, '#9198a8');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    x.restore();

    x.save();
    x.globalAlpha = .5;
    grainIdx = (grainIdx + 1) & 3;
    x.fillStyle = x.createPattern(grainTiles[grainIdx], 'repeat');
    x.fillRect(0, 0, W, H);
    x.restore();

    /* your own crosshair */
    if (G.ui.mouse && !G.ui.ghost && !G.paused) {
      const m = cam.toScreen(G.ui.mouse.x, G.ui.mouse.y);
      const hot = G.sidearmCool <= 0;
      x.save();
      x.translate(m.x, m.y);
      x.strokeStyle = hot ? U.rgba(255, 210, 90, .9) : U.rgba(140, 150, 170, .5);
      x.lineWidth = 1.6;
      x.beginPath(); x.arc(0, 0, 13, 0, U.TAU); x.stroke();
      x.beginPath();
      x.moveTo(-20, 0); x.lineTo(-7, 0);
      x.moveTo(7, 0); x.lineTo(20, 0);
      x.moveTo(0, -20); x.lineTo(0, -7);
      x.moveTo(0, 7); x.lineTo(0, 20);
      x.stroke();
      if (!hot) {
        x.strokeStyle = U.rgba(255, 210, 90, .8); x.lineWidth = 2.4;
        x.beginPath();
        x.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + U.TAU * (1 - G.sidearmCool / G.sidearmMax));
        x.stroke();
      }
      x.restore();
    }

    /* minimap, bottom right */
    drawMinimap(x, G);

    if (G.paused) {
      x.save();
      x.fillStyle = U.rgba(4, 7, 13, .58);
      x.fillRect(0, 0, W, H);
      x.fillStyle = '#e8ecf4';
      x.font = 'bold 44px Helvetica,Arial';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('PAUSED', W / 2, H / 2 - 10);
      x.font = '13px Helvetica,Arial';
      x.fillStyle = '#8e99b0';
      x.fillText('SPACE TO RESUME', W / 2, H / 2 + 26);
      x.restore();
    }
  }

  /* ---------- minimap ---------- */
  /* The dock is taller in portrait, so the minimap is placed against the
     inset ui.js reports rather than a hard-coded offset. */
  let uiInset = { bottom: 182, top: 64 };
  function setInset(o) { uiInset = o; }

  function mmSize() {
    const s = Math.min(190, Math.max(112, VIEW_W * 0.22));
    return { w: s, h: Math.round(s * WORLD_H / WORLD_W) };
  }
  function drawMinimap(x, G) {
    const W = VIEW_W, H = VIEW_H;
    const { w: MM_W, h: MM_H } = mmSize();
    const ox = W - MM_W - 14, oy = H - MM_H - uiInset.bottom - 12;
    const sx = MM_W / WORLD_W, sy = MM_H / WORLD_H;
    x.save();
    x.globalAlpha = .92;
    x.fillStyle = U.rgba(6, 9, 16, .8);
    x.beginPath(); x.roundRect(ox - 4, oy - 4, MM_W + 8, MM_H + 8, 7); x.fill();
    x.strokeStyle = U.rgba(255, 255, 255, .12); x.lineWidth = 1; x.stroke();

    /* routes */
    x.save();
    x.translate(ox, oy);
    x.strokeStyle = U.rgba(255, 255, 255, .22); x.lineWidth = 2;
    G.level.builtPaths.forEach(bp => {
      x.beginPath();
      for (let i = 0; i < bp.pts.length; i += 8) {
        const p = bp.pts[i];
        i ? x.lineTo(p.x * sx, p.y * sy) : x.moveTo(p.x * sx, p.y * sy);
      }
      x.stroke();
    });
    /* towers */
    x.fillStyle = U.rgba(120, 200, 255, .85);
    for (const tw of G.towers) x.fillRect(tw.x * sx - 1.5, tw.y * sy - 1.5, 3, 3);
    /* enemies */
    x.fillStyle = '#ff5566';
    for (const e of G.enemies) x.fillRect(e.x * sx - 1.5, e.y * sy - 1.5, 3, 3);
    /* pickups */
    x.fillStyle = '#ffc21a';
    for (const p of G.pickups) x.fillRect(p.x * sx - 2, p.y * sy - 2, 4, 4);
    /* apple */
    x.fillStyle = '#ffd23a';
    x.beginPath(); x.arc(G.level.base.x * sx, G.level.base.y * sy, 4, 0, U.TAU); x.fill();
    /* viewport box */
    const cam = G.cam;
    x.strokeStyle = U.rgba(255, 255, 255, .75); x.lineWidth = 1.4;
    x.strokeRect(cam.x * sx, cam.y * sy, (VIEW_W / cam.z) * sx, (cam.usableH() / cam.z) * sy);
    x.restore();
    x.restore();
  }

  function minimapRect() {
    const { w, h } = mmSize();
    return { x: VIEW_W - w - 14, y: VIEW_H - h - uiInset.bottom - 12, w, h };
  }

  return { frame, initWeather, drawProjectile, minimapRect, setInset };
})();
