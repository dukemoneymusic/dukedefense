/* ============================================================
   DUKE$DEFENSE — game.js
   The simulation.

   Netplay model: one client is the HOST and owns the simulation.
   Everyone else sends COMMANDS and receives SNAPSHOTS, which they
   interpolate. Tower defence has a low input rate and no twitch
   aiming, so this stays smooth over ordinary connections and no
   client can drift into a different reality.
   ============================================================ */
'use strict';

const ENEMY_KEYS  = Object.keys(ENEMIES);
const TOWER_KEYS  = Object.keys(TOWERS);
const PICKUP_KIND = ['cash', 'medkit', 'ammo'];

const Game = (() => {

  /* world size changes between solo and co-op, so read it live */
  const W = () => WORLD_W, H = () => WORLD_H;
  let G = null;
  let uid = 1;

  /* ==========================================================
     SETUP
     ========================================================== */
  function load(levelIndex, onProgress, done, opts) {
    opts = opts || {};
    const L = LEVELS[levelIndex];

    /* pick the board size for this mode, then rebuild the level's geometry
       for it — must happen before anything bakes or the camera is made */
    setWorldSize(!!opts.coop);
    L.rescale();

    const steps = [
      () => { G = fresh(L, opts); onProgress(.05, 'SURVEYING THE GROUND'); },
      () => {
        const baked = ART.bake(L, p => onProgress(.05 + p * .55, 'BUILDING THE DISTRICT'));
        G.bg = baked.ground;
        L.mask = baked.mask;
        if (L.onExtra) L.onExtra(G.bg.getContext('2d'));
        onProgress(.62, 'RAISING BUILDINGS');
      },
      () => { G.lights = ART.bakeLights(L); onProgress(.76, 'KILLING THE LIGHTS'); },
      () => { G.glow = ART.bakeGlow(L); onProgress(.86, 'WIRING THE GRID'); },
      () => {
        const d = U.surface(W(), H());
        G.decals = d.c; G.decalsCtx = d.x;
        Render.initWeather(L.weather);
        G.cam.centerOn(L.base.x, L.base.y);
        onProgress(.96, 'RELEASING THE VERMIN');
      },
      () => { onProgress(1, 'WEAPONS FREE'); done(G); }
    ];
    let i = 0;
    (function tick() {
      if (i >= steps.length) return;
      steps[i++]();
      setTimeout(tick, 16);
    })();
  }

  function fresh(L, opts) {
    return {
      level: L,
      seed: opts.seed || 12345,
      rng: makeSync(opts.seed || 12345),
      cam: makeCamera(),

      bg: null, lights: null, glow: null, decals: null, decalsCtx: null,
      enemies: [], towers: [], projectiles: [], particles: [], floats: [], pickups: [],

      gold: L.gold, lives: L.lives, maxLives: L.lives,
      waveIdx: 0, wavesSent: 0, totalWaves: L.waves.length,
      spawnQueue: [], waveTimer: L.waves[0].prep,
      state: 'prep',
      speed: 1, paused: false,
      time: 0, realTime: 0, tick: 0,

      stats: { kills: 0, gold: 0, leaks: 0, sidearmKills: 0, grabbed: 0 },
      cd: { plow: 0, freeze: 0, blast: 0 },
      freezeT: 0, plowT: 0, ammoBoost: 0,
      appleFlash: 0, lightning: 0, lightningT: 4 + Math.random() * 8,
      wind: L.weather === 'rain' ? -1.4 : (L.weather === 'snow' ? .5 : .2),
      shake: 0, shakeX: 0, shakeY: 0,
      decalCount: 0,
      crateTimer: 16,
      shotLog: [],                          /* host records shots so clients can draw bullets */

      /* your own weapon */
      sidearmCool: 0, sidearmMax: 0.42, sidearmDmg: 24,

      /* co-op */
      coop: !!opts.coop,
      netRole: opts.netRole || 'off',          /* off | host | client */
      selfId: opts.selfId || 'p1',
      peers: opts.peers || { p1: { name: 'YOU', col: '#ffc21a', self: true, cursor: null } },
      lerpT: 0,

      ui: {
        selected: null, rangePreview: null, ghost: null,
        armed: null, mouse: null, buildType: null
      },
      onEvent: null,
      sendCommand: null                        /* installed by net.js */
    };
  }

  const emit = (type, data) => { if (G && G.onEvent) G.onEvent(type, data); };
  const isClient = () => G.netRole === 'client';

  /* ==========================================================
     COMMANDS — the only way state ever changes
     ========================================================== */
  function cmd(c) {
    if (!G) return;
    c.by = c.by || G.selfId;
    if (G.netRole === 'client') { if (G.sendCommand) G.sendCommand(c); return; }
    apply(c);
    if (G.netRole === 'host' && G.sendCommand) G.sendCommand(c);
  }

  function apply(c) {
    switch (c.t) {
      case 'build': doBuild(c.x, c.y, c.type, c.by); break;
      case 'up':    doUpgrade(byId(c.id)); break;
      case 'sell':  doSell(byId(c.id)); break;
      case 'mode':  { const tw = byId(c.id); if (tw) tw.mode = c.mode; break; }
      case 'ab':    doAbility(c.name, c.x !== undefined ? { x: c.x, y: c.y } : null, c.by); break;
      case 'shoot': doShoot(c.x, c.y, c.by, c.tol); break;
      case 'grab':  doGrab(c.id, c.by); break;
      case 'wave':  sendNext(true); break;
      case 'speed': G.speed = c.v; break;
    }
  }
  function byId(id) { return G.towers.find(t => t.id === id) || null; }

  /* ==========================================================
     ENEMIES
     ========================================================== */
  function spawn(type, pathIdx, hpMul, spdMul, waveIdx, atD) {
    const def = ENEMIES[type];
    const L = G.level;
    const path = L.builtPaths[Math.min(pathIdx, L.builtPaths.length - 1)];
    const start = path.pts[0];

    const e = {
      id: uid++, type, def, wave: waveIdx,
      pathIdx: Math.min(pathIdx, L.builtPaths.length - 1),
      fly: !!def.fly,
      d: atD || 0,
      x: start.x, y: start.y, a: 0,
      seed: G.rng() * 100,
      r: def.r, col: def.col,
      maxHp: def.hp * hpMul, hp: def.hp * hpMul,
      baseSpd: def.spd * spdMul, spd: def.spd * spdMul,
      baseArmor: def.armor, armor: def.armor,
      bounty: Math.round(def.bounty * (1 + (hpMul - 1) * .32)),
      bite: def.bite, boss: !!def.boss, alive: true,
      slowT: 0, slowAmt: 0, burnT: 0, burnDps: 0, stunT: 0, frozen: 0,
      shredT: 0, shred: 0, hitFlash: 0, healT: 0, spawnT: 0, raged: false,
      shieldHp: def.shield ? def.hp * hpMul * def.shield : 0,
      maxShield: def.shield ? def.hp * hpMul * def.shield : 0,
      pathLen: path.length
    };
    if (e.fly) {
      e.fx0 = start.x; e.fy0 = start.y;
      e.a = Math.atan2(L.base.y - start.y, L.base.x - start.x);
      e.px = start.x; e.py = start.y;
    }
    G.enemies.push(e);
    return e;
  }

  const CUT = 0.44;                 /* how hard flyers cut the bends */
  function posAt(e, d) {
    const path = G.level.builtPaths[e.pathIdx];
    const p = U.samplePath(path, d);
    if (!e.fly) return { x: p.x, y: p.y, a: p.a };
    const q = U.clamp(d / e.pathLen, 0, 1);
    const b = G.level.base;
    return {
      x: p.x + (e.fx0 + (b.x - e.fx0) * q - p.x) * CUT,
      y: p.y + (e.fy0 + (b.y - e.fy0) * q - p.y) * CUT,
      a: p.a
    };
  }
  function enemyPos(e) {
    const p = posAt(e, e.d);
    if (e.fly) {
      const dx = p.x - e.px, dy = p.y - e.py;
      if (dx * dx + dy * dy > .04) e.a = Math.atan2(dy, dx);
      e.px = p.x; e.py = p.y;
    } else e.a = p.a;
    e.x = p.x; e.y = p.y;
  }

  /* ---------- damage ---------- */
  function damage(e, amount, dtype, opts) {
    if (!e.alive) return 0;
    opts = opts || {};
    let dmg = amount;
    const armor = Math.max(0, e.armor);

    /* Armour scales against the SIZE of each hit rather than subtracting
       a flat amount, so chip damage still counts for something while
       heavy ordnance punches most of the way through. */
    const soak = (d, k) => (armor <= 0 ? d : (d * d) / (d + armor * k));
    switch (dtype) {
      case 'ball':  dmg = soak(dmg, 2.0); break;
      case 'ap':    dmg = soak(dmg, 0.5); break;
      case 'buck':  dmg = soak(dmg, 3.2); break;
      case 'he':    dmg = soak(dmg, 0.8) * (armor >= 6 ? 1.35 : 1); break;
      case 'cryo':  dmg = soak(dmg, 1.1); break;
      case 'incen': case 'energy': break;
      default:      dmg = soak(dmg, 2.0);
    }
    if (opts.crit) dmg *= 2.2;
    if (e.frozen > 0) dmg *= 1.35;

    if (e.shieldHp > 0) {
      const absorbed = Math.min(e.shieldHp, dmg);
      e.shieldHp -= absorbed; dmg -= absorbed;
    }
    e.hp -= dmg;
    e.hitFlash = .16;

    if (opts.big || e.boss) {
      float(e.x, e.y - e.r - 16, Math.round(dmg), opts.crit ? '#ff6a4a' : '#ffe6a0', opts.crit ? 20 : 15);
    }
    if (e.def.rage && !e.raged && e.hp / e.maxHp < .4) {
      e.raged = true;
      e.baseSpd *= e.def.rage;
      burst(e.x, e.y, 26, '#ff4a3a', 'fire');
      Audio2.play('boss');
      toast(ENEMIES[e.type].name + ' IS ENRAGED', 'bad');
    }
    if (e.hp <= 0) kill(e, opts.by);
    return dmg;
  }

  function kill(e, by) {
    if (!e.alive) return;
    e.alive = false;
    const pay = Math.round(e.bounty * (by === 'sidearm' ? 1.25 : 1));
    G.gold += pay; G.stats.gold += pay; G.stats.kills++;
    if (by === 'sidearm') G.stats.sidearmKills++;
    float(e.x, e.y - e.r - 10, '+' + pay, '#ffc21a', e.boss ? 24 : 13);

    if (e.def.fly) burst(e.x, e.y - (e.fly ? 28 : 0), 12, e.col, 'feather');
    else if (e.type === 'golem' || e.type === 'b_titan' || e.type === 'drone') {
      burst(e.x, e.y, 18, '#9aa3b0', 'spark'); splat(e.x, e.y, e.r * 1.1, '#2a2f38');
    } else { burst(e.x, e.y, 14, '#8a2230', 'goo'); splat(e.x, e.y, e.r * .9, '#40121c'); }

    if (e.boss) {
      shake(1.2); boom(e.x, e.y, 180, '#ffb02a');
      Audio2.play('boom'); Audio2.duckMusic(.35, 1.6);
    } else Audio2.play(e.def.rodent ? 'squeak' : 'splat', 55);

    /* loot */
    const chance = e.boss ? 1 : (0.055 + e.bounty / 900);
    if (G.rng() < chance) {
      const roll = G.rng();
      dropPickup(e.x, e.y,
        e.boss ? 'cash' : (roll < .74 ? 'cash' : (roll < .9 ? 'ammo' : 'medkit')),
        Math.round((e.boss ? 260 : 16 + e.bounty * 1.4) * (1 + G.wavesSent * .06)));
    }

    if (e.def.splits) {
      for (let k = 0; k < e.def.splits.n; k++) {
        const c = spawn(e.def.splits.t, e.pathIdx, e.maxHp / (ENEMIES[e.def.splits.t].hp * 3.2), 1.15, e.wave, Math.max(0, e.d - 8 + k * 8));
        c.hp = c.maxHp;
      }
    }
  }

  function bite(e) {
    e.alive = false;
    G.lives -= e.bite; G.stats.leaks++;
    G.appleFlash = 1;
    shake(.5 + e.bite * .06);
    Audio2.play('hurt');
    emit('bite', e);
    float(G.level.base.x, G.level.base.y - 80, '-' + e.bite, '#ff5566', 22);
    if (e.def.steal) {
      const stolen = Math.min(G.gold, e.def.steal);
      G.gold -= stolen;
      if (stolen > 0) float(G.level.base.x + 40, G.level.base.y - 50, '-$' + stolen, '#ff8a3a', 15);
    }
    if (G.lives <= 0) { G.lives = 0; lose(); }
  }

  /* ==========================================================
     PICKUPS — shoot them before they expire
     ========================================================== */
  function dropPickup(x, y, kind, value) {
    let px = x, py = y;
    for (let k = 0; k < 8; k++) {
      if (ART.canPlace(G.level, px, py, 8)) break;
      const a = G.rng() * U.TAU;
      px = U.clamp(x + Math.cos(a) * (30 + k * 12), 30, W() - 30);
      py = U.clamp(y + Math.sin(a) * (30 + k * 12), 30, H() - 30);
    }
    G.pickups.push({ id: uid++, kind, value: value || 30, x: px, y: py, life: 15, seed: G.rng() * 10 });
    if (G.pickups.length > 26) G.pickups.shift();
  }

  function doGrab(id, by) {
    const i = G.pickups.findIndex(p => p.id === id);
    if (i < 0) return;
    const p = G.pickups[i];
    G.pickups.splice(i, 1);
    G.stats.grabbed++;

    if (p.kind === 'cash') {
      G.gold += p.value; G.stats.gold += p.value;
      float(p.x, p.y - 26, '+' + U.fmtMoney(p.value), '#ffc21a', 19);
      Audio2.play('coin');
    } else if (p.kind === 'medkit') {
      const heal = Math.min(2, G.maxLives - G.lives);
      G.lives += heal;
      float(p.x, p.y - 26, heal > 0 ? '+' + heal + ' APPLE' : 'APPLE FULL', '#3fdd8f', 17);
      Audio2.play('upgrade');
    } else {
      G.ammoBoost = Math.max(G.ammoBoost, 8);
      float(p.x, p.y - 26, 'AMMO RESUPPLY', '#6cc8ff', 17);
      Audio2.play('reload');
    }
    ring(p.x, p.y, 60, p.kind === 'cash' ? '#ffc21a' : (p.kind === 'medkit' ? '#3fdd8f' : '#6cc8ff'));
    burst(p.x, p.y, 12, '#ffe6a0', 'spark');
  }

  /* ==========================================================
     YOUR SIDEARM
     ========================================================== */
  function doShoot(wx, wy, by, tol) {
    /* a shot that lands on a drop collects it rather than wasting the round */
    const near = pickupAt(wx, wy, tol || 40);
    if (near) { doGrab(near.id, by); return; }
    let best = null, bd = 40 * 40;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const ey = e.y - (e.fly ? 28 : 0);
      const d2 = U.dist2(wx, wy, e.x, ey);
      if (d2 < bd + e.r * e.r) { bd = d2; best = e; }
    }
    Audio2.play('pistol', 40);
    const from = { x: G.level.base.x, y: G.level.base.y - 60 };
    G.particles.push({ kind: 'tracer', x: from.x, y: from.y, x2: wx, y2: wy, r: 2, col: U.rgba(255, 220, 140, .8), t: 0, life: .1 });
    if (best) { damage(best, G.sidearmDmg, 'ball', { by: 'sidearm' }); burst(wx, wy, 6, '#ffe6a0', 'spark'); }
    else burst(wx, wy, 4, '#8e99b0', 'smoke');
  }

  /* ==========================================================
     WEAPONS
     ========================================================== */
  function placementOk(x, y, type) {
    const d = TOWERS[type];
    if (!d) return false;
    if (!ART.canPlace(G.level, x, y, d.foot)) return false;
    for (const t of G.towers) {
      const min = (t.def.foot + d.foot) * .92;
      if (U.dist2(x, y, t.x, t.y) < min * min) return false;
    }
    return true;
  }

  function doBuild(x, y, type, owner) {
    const def = TOWERS[type];
    if (!def) return null;
    const cost = def.tiers[0].cost;
    const mine = owner === G.selfId;
    if (G.gold < cost) { if (mine) { Audio2.play('error'); toast('INSUFFICIENT FUNDS', 'bad'); } return null; }
    if (!placementOk(x, y, type)) { if (mine) { Audio2.play('error'); toast('NO CLEAR GROUND', 'bad'); } return null; }
    G.gold -= cost;

    const t = {
      id: uid++, type, def, owner: owner || G.selfId,
      x, y, tier: 0, invested: cost,
      cool: 0, recoil: 0, flash: 0, aim: -Math.PI / 2, charge: 0,
      target: null, beamTarget: null, mode: 'first', seed: G.rng() * 10
    };
    G.towers.push(t);
    Audio2.play('build');
    burst(x, y, 14, def.col, 'spark');
    ring(x, y, 64, def.col);
    return t;
  }

  function upgradeCost(t) { return (!t || t.tier >= 2) ? null : t.def.tiers[t.tier + 1].cost; }

  function doUpgrade(t) {
    if (!t) return false;
    const c = upgradeCost(t);
    if (c === null) return false;
    if (G.gold < c) { Audio2.play('error'); toast('INSUFFICIENT FUNDS', 'bad'); return false; }
    G.gold -= c; t.invested += c; t.tier++;
    Audio2.play('upgrade');
    burst(t.x, t.y, 22, t.def.col, 'spark');
    ring(t.x, t.y, 84, t.def.col);
    float(t.x, t.y - 54, t.def.tiers[t.tier].label, '#ffe6a0', 13);
    return true;
  }

  function doSell(t) {
    if (!t) return 0;
    const back = Math.floor(t.invested * .7);
    G.gold += back;
    const i = G.towers.indexOf(t);
    if (i >= 0) G.towers.splice(i, 1);
    Audio2.play('sell');
    burst(t.x, t.y, 12, '#8e99b0', 'smoke');
    float(t.x, t.y - 44, '+' + U.fmtMoney(back), '#ffc21a', 15);
    if (G.ui.selected === t) G.ui.selected = null;
    return back;
  }

  const stat = t => t.def.tiers[t.tier];

  /* ---------- targeting ---------- */
  function findTarget(t) {
    const s = stat(t);
    const R2 = s.range * s.range;
    const minR2 = s.minRange ? s.minRange * s.minRange : 0;
    const canAir = t.def.targets !== 'ground';
    const canGround = t.def.targets !== 'air';
    let best = null, bestKey = -Infinity;

    for (const e of G.enemies) {
      if (!e.alive) continue;
      if (e.fly && !canAir) continue;
      if (!e.fly && !canGround) continue;
      const ey = e.y - (e.fly ? 28 : 0);
      const dx = e.x - t.x, dy = ey - (t.y - 14);
      const d2 = dx * dx + dy * dy;
      if (d2 > R2 || d2 < minR2) continue;
      let key;
      switch (t.mode) {
        case 'last':   key = -(e.d / e.pathLen); break;
        case 'strong': key = e.hp; break;
        case 'close':  key = -d2; break;
        default:       key = e.d / e.pathLen;
      }
      if (key > bestKey) { bestKey = key; best = e; }
    }
    return best;
  }

  function predict(t, e, speed) {
    const ey = e.y - (e.fly ? 28 : 0);
    if (!speed) return { x: e.x, y: ey };
    const tt = U.dist(t.x, t.y - 14, e.x, ey) / speed;
    const p = posAt(e, Math.min(e.pathLen, e.d + e.spd * tt));
    return { x: p.x, y: p.y - (e.fly ? 28 : 0) };
  }

  /* ---------- firing ---------- */
  function fire(t, target) {
    const s = stat(t);
    const def = t.def;
    const tx = t.x, ty = t.y - 14;
    t.aim = Math.atan2((target.y - (target.fly ? 28 : 0)) - ty, target.x - tx);

    switch (def.proj) {

      case 'bullet': {
        const n = s.multi || 1;
        for (let k = 0; k < n; k++) {
          const p = predict(t, target, s.speed);
          const jitter = n > 1 ? (k - (n - 1) / 2) * .045 : 0;
          const a = Math.atan2(p.y - ty, p.x - tx) + jitter;
          const crit = s.crit && G.rng() < s.crit;
          G.projectiles.push({
            kind: 'bullet', x: tx, y: ty, a,
            vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
            dmg: s.dmg * (s.ramp ? U.lerp(1, s.ramp, t.charge) : 1),
            dtype: def.dtype, crit,
            opts: { big: !!crit || def.dtype === 'ap', crit },
            target, homing: def.dtype === 'ap' ? 0 : .06, life: 2.2,
            pierce: s.pierce || 0, hitIds: null,
            tracer: def.dtype === 'ap' ? 40 : 16,
            col: def.dtype === 'ap' ? '#fff6d0' : '#ffd88a'
          });
        }
        ejectBrass(t);
        break;
      }

      case 'cone': {
        const base = t.aim, range = s.range;
        for (let k = 0; k < s.pellets; k++) {
          const a = base + (G.rng() - .5) * s.spread;
          G.particles.push({
            kind: 'tracer',
            x: tx + Math.cos(a) * 22, y: ty + Math.sin(a) * 22,
            x2: tx + Math.cos(a) * range, y2: ty + Math.sin(a) * range,
            r: 2.2, col: U.rgba(255, 214, 140, .55), t: 0, life: .09
          });
        }
        for (const e of G.enemies) {
          if (!e.alive || e.fly) continue;
          const d = U.dist(tx, ty, e.x, e.y);
          if (d > range) continue;
          if (Math.abs(U.angDiff(base, Math.atan2(e.y - ty, e.x - tx))) > s.spread / 2 + .12) continue;
          const falloff = U.lerp(1, .42, d / range);
          damage(e, s.dmg * falloff, def.dtype, { big: true });
          if (e.alive) {
            e.d = Math.max(0, e.d - s.push * falloff);
            if (s.stun) applyStun(e, s.stun);
          }
        }
        ejectBrass(t);
        break;
      }

      case 'arc': {
        const p = predict(t, target, s.speed);
        G.projectiles.push({
          kind: 'shell', arc: true,
          x0: tx, y0: ty - 10, x1: p.x, y1: p.y,
          x: tx, y: ty - 10, gx: tx, gy: t.y,
          t: 0, dur: U.clamp(U.dist(tx, ty, p.x, p.y) / s.speed, .25, 1.5), spin: 0,
          dmg: s.dmg, dtype: def.dtype, splash: s.splash, burn: s.burn, opts: { big: true }
        });
        break;
      }

      case 'drop': {
        const p = predict(t, target, 300);
        G.projectiles.push({
          kind: 'bomb', arc: true, drop: true,
          x0: p.x, y0: p.y - 460, x1: p.x, y1: p.y,
          x: p.x, y: p.y - 460, gx: p.x, gy: p.y,
          t: 0, dur: .85, spin: 0,
          dmg: s.dmg, dtype: def.dtype, splash: s.splash, stun: s.stun, opts: { big: true }
        });
        break;
      }

      case 'homing': {
        const n = s.multi || 1;
        for (let k = 0; k < n; k++) {
          const a = t.aim + (n > 1 ? (k - (n - 1) / 2) * .3 : 0);
          G.projectiles.push({
            kind: 'rocketp', x: tx, y: ty - 10, a,
            vx: Math.cos(a) * s.speed * .55, vy: Math.sin(a) * s.speed * .55,
            maxSpeed: s.speed,
            dmg: s.dmg, dtype: def.dtype, splash: s.splash,
            opts: { big: true }, target, homing: 1.0, life: 4, smokeT: 0
          });
        }
        break;
      }

      case 'wave': {
        areaHit(tx, t.y, s.splash, s.dmg, def.dtype, { slow: s.slow, slowT: s.slowT, shred: s.shred });
        ring(t.x, t.y, s.splash, '#7fd0ff');
        for (let k = 0; k < 14; k++) {
          const a = G.rng() * U.TAU, sp = 60 + G.rng() * 140;
          G.particles.push({
            kind: 'ice', x: t.x + Math.cos(a) * 12, y: t.y - 8 + Math.sin(a) * 8,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .5,
            r: 4 + G.rng() * 5, a: G.rng() * 3,
            col: U.rgba(220, 240, 255, .8), t: 0, life: .7
          });
        }
        break;
      }

      case 'chain': {
        let cur = target, dmg = s.dmg;
        const hit = {}; hit[cur.id] = 1;
        let fromX = tx, fromY = ty - 30;
        for (let k = 0; k < s.chain; k++) {
          const cy = cur.y - (cur.fly ? 28 : 0);
          G.particles.push({ kind: 'arc', x: fromX, y: fromY, x2: cur.x, y2: cy, r: 2, col: U.rgba(190, 170, 255, .9), t: 0, life: .16 });
          damage(cur, dmg, def.dtype, { big: k === 0 });
          if (cur.alive && G.rng() < s.stunChance) applyStun(cur, s.stun);
          fromX = cur.x; fromY = cy;
          dmg *= s.falloff;
          let nxt = null, nd = 150 * 150;
          for (const e of G.enemies) {
            if (!e.alive || hit[e.id]) continue;
            const d2 = U.dist2(fromX, fromY, e.x, e.y - (e.fly ? 28 : 0));
            if (d2 < nd) { nd = d2; nxt = e; }
          }
          if (!nxt) break;
          hit[nxt.id] = 1; cur = nxt;
        }
        break;
      }
    }

    t.recoil = 1; t.flash = 1;
    if (def.sfx) Audio2.play(def.sfx, def.proj === 'bullet' ? 28 : 45);

    /* host logs the shot (tower -> where it aimed) so every client can draw a
       bullet for it — clients don't run the sim, so this is how they see fire */
    if (G.netRole === 'host') {
      const ty2 = target.y - (target.fly ? 28 : 0);
      G.shotLog.push([t.id, Math.round(target.x), Math.round(ty2)]);
      if (G.shotLog.length > 80) G.shotLog.shift();
    }
  }

  function ejectBrass(t) {
    if (G.particles.length > 500) return;
    const a = (t.aim || 0) + Math.PI / 2 + (G.rng() - .5) * .6;
    G.particles.push({
      kind: 'brass', x: t.x, y: t.y - 12,
      vx: Math.cos(a) * (60 + G.rng() * 70), vy: Math.sin(a) * (40 + G.rng() * 50) - 40,
      r: 2, a: G.rng() * 6, grav: 420, col: '#d8b34a', t: 0, life: .7
    });
  }

  /* ---------- area of effect ---------- */
  function areaHit(cx, cy, radius, dmg, dtype, o) {
    o = o || {};
    const r2 = radius * radius;
    let hits = 0;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const ey = e.y - (e.fly ? 28 : 0);
      const dx = e.x - cx, dy = ey - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const falloff = o.flat ? 1 : U.lerp(1, .45, Math.sqrt(d2) / radius);
      damage(e, dmg * falloff, dtype, o);
      hits++;
      if (!e.alive) continue;
      if (o.slow) applySlow(e, o.slow, o.slowT);
      if (o.burn) applyBurn(e, o.burn, o.burnT || 3);
      if (o.shred) applyShred(e, o.shred);
      if (o.stun && (!o.stunChance || G.rng() < o.stunChance)) applyStun(e, o.stun);
      if (o.push) e.d = Math.max(0, e.d - o.push);
    }
    return hits;
  }

  function applySlow(e, amt, dur) {
    if (e.def.noSlow) return;
    if (amt >= e.slowAmt || e.slowT <= 0) e.slowAmt = amt;
    e.slowT = Math.max(e.slowT, dur);
  }
  function applyBurn(e, dps, dur) { e.burnDps = Math.max(e.burnDps, dps); e.burnT = Math.max(e.burnT, dur); }
  function applyStun(e, dur) { if (e.boss) dur *= .35; e.stunT = Math.max(e.stunT, dur); }
  function applyShred(e, amt) { e.shred = Math.min(e.baseArmor, e.shred + amt); e.shredT = 4; }

  /* ==========================================================
     EFFECTS
     ========================================================== */
  function float(x, y, txt, col, size) {
    G.floats.push({ x, y, txt: String(txt), col: col || '#fff', size: size || 14, t: 0, life: 1.1 });
    if (G.floats.length > 60) G.floats.shift();
  }
  function burst(x, y, n, col, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * U.TAU, sp = 40 + Math.random() * 220;
      G.particles.push({
        kind: kind || 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .6,
        r: 1.6 + Math.random() * 3.4, a: Math.random() * 6,
        col, t: 0, life: .35 + Math.random() * .55, grav: kind === 'goo' ? 260 : 0
      });
    }
  }
  function ring(x, y, r, col) { G.particles.push({ kind: 'ring', x, y, r, w: 4, col, t: 0, life: .5 }); }
  function boom(x, y, r, col) {
    G.particles.push({ kind: 'ring', x, y, r, w: 7, col: col || '#ffb02a', t: 0, life: .55 });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * U.TAU, sp = 60 + Math.random() * 340;
      G.particles.push({ kind: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .6, r: 5 + Math.random() * 14, col, t: 0, life: .4 + Math.random() * .5 });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * U.TAU, sp = 30 + Math.random() * 120;
      G.particles.push({ kind: 'smoke', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .6 - 30, r: 10 + Math.random() * 18, col: U.rgba(160, 160, 170, .8), t: 0, life: .9 + Math.random() * .7 });
    }
    scorch(x, y, r * .38);
  }
  function splat(x, y, r, col) {
    const c = G.decalsCtx; if (!c) return;
    c.save(); c.globalAlpha = .5; c.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      const a = Math.random() * U.TAU, d = Math.random() * r;
      c.beginPath();
      c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * .6, r * (.3 + Math.random() * .5), r * (.2 + Math.random() * .35), Math.random() * 3, 0, U.TAU);
      c.fill();
    }
    c.restore(); trimDecals();
  }
  function scorch(x, y, r) {
    const c = G.decalsCtx; if (!c) return;
    c.save();
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(10, 8, 6, .6));
    g.addColorStop(.6, U.rgba(20, 16, 12, .35));
    g.addColorStop(1, U.rgba(20, 16, 12, 0));
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, r, r * .6, 0, 0, U.TAU); c.fill();
    c.restore(); trimDecals();
  }
  function trimDecals() {
    G.decalCount++;
    if (G.decalCount > 300) {
      const c = G.decalsCtx;
      c.save(); c.globalCompositeOperation = 'destination-out';
      c.fillStyle = U.rgba(0, 0, 0, .35); c.fillRect(0, 0, W(), H());
      c.restore();
      G.decalCount = 160;
    }
  }
  function shake(a) { G.shake = Math.min(1.6, G.shake + a); }
  function toast(msg, kind) { emit('toast', { msg, kind }); }

  /* ==========================================================
     FIELD SUPPORT
     ========================================================== */
  function doAbility(name, aim, by) {
    if (G.cd[name] > 0) return false;
    const A = ABILITIES[name];

    if (name === 'plow') {
      G.plowT = A.dur;
      G.enemies.forEach(e => applySlow(e, A.slow, A.dur));
      Audio2.play('plow');
      toast('SUPPRESSION FIELD DEPLOYED', 'good');
    } else if (name === 'freeze') {
      G.freezeT = A.dur;
      G.enemies.forEach(e => { if (!e.def.noSlow) e.frozen = Math.max(e.frozen, A.dur * (e.boss ? .45 : 1)); });
      Audio2.play('freeze'); Audio2.duckMusic(.4, 2);
      toast('CRYO BURST', 'good'); shake(.35);
    } else if (name === 'blast' && aim) {
      const hits = areaHit(aim.x, aim.y, A.radius, A.dmg, 'he', { stun: 1.2, stunChance: 1, big: true });
      boom(aim.x, aim.y, A.radius, '#ff9d2e');
      Audio2.play('boom'); Audio2.duckMusic(.35, 1.4); shake(1.0);
      if (hits === 0) toast('ROUNDS ON EMPTY GROUND', 'warn');
    } else return false;

    G.cd[name] = A.cd;
    return true;
  }

  /* ==========================================================
     WAVES
     ========================================================== */
  function queueWave(idx) {
    const w = G.level.waves[idx];
    if (!w) return;
    w.groups.forEach(g => {
      for (let k = 0; k < g.count; k++) {
        G.spawnQueue.push({
          t: G.time + (g.delay || 0) + k * g.gap,
          type: g.type, path: g.path || 0,
          hpMul: g.hpMul, spdMul: g.spdMul, wave: idx
        });
      }
    });
    G.spawnQueue.sort((a, b) => a.t - b.t);
    G.wavesSent = Math.max(G.wavesSent, idx + 1);
    G.state = 'live';
    if (w.boss) {
      Audio2.play('boss'); Audio2.duckMusic(.3, 2.4);
      toast('BOSS INBOUND', 'bad'); emit('boss', w);
    } else {
      Audio2.play('wave'); toast('WAVE ' + (idx + 1) + ' INBOUND', 'warn');
    }
    emit('wave', idx);
  }

  function sendNext(manual) {
    if (G.state === 'won' || G.state === 'lost') return;
    if (G.waveIdx >= G.totalWaves) return;
    if (manual) {
      const bonus = earlyBonus();
      if (bonus > 0) {
        G.gold += bonus; G.stats.gold += bonus;
        float(G.level.base.x, G.level.base.y - 130, '+' + U.fmtMoney(bonus) + ' EARLY', '#3fdd8f', 17);
        Audio2.play('coin');
      }
    }
    queueWave(G.waveIdx);
    G.waveIdx++;
    G.waveTimer = G.waveIdx < G.totalWaves ? G.level.waves[G.waveIdx].prep : 0;
  }

  function earlyBonus() {
    if (G.state !== 'prep' && G.waveTimer <= 0) return Math.round(8 + G.waveIdx * 2);
    return Math.round(G.waveTimer * (2.2 + G.waveIdx * .3));
  }

  function waveCleared(idx) {
    if (G.spawnQueue.some(s => s.wave === idx)) return false;
    if (G.enemies.some(e => e.alive && e.wave === idx)) return false;
    return true;
  }

  /* ==========================================================
     END STATES
     ========================================================== */
  function win() {
    if (G.state === 'won' || G.state === 'lost') return;
    G.state = 'won';
    Audio2.play('win'); Audio2.stopMusic();
    const f = G.lives / G.maxLives;
    emit('win', {
      stars: f >= .999 ? 3 : (f >= .6 ? 2 : 1),
      kills: G.stats.kills, gold: G.stats.gold,
      lives: G.lives, maxLives: G.maxLives, time: G.realTime,
      sidearmKills: G.stats.sidearmKills, grabbed: G.stats.grabbed
    });
  }
  function lose() {
    if (G.state === 'won' || G.state === 'lost') return;
    G.state = 'lost';
    Audio2.play('lose'); Audio2.stopMusic(); shake(1.5);
    emit('lose', {
      kills: G.stats.kills, gold: G.stats.gold, time: G.realTime, wave: G.waveIdx,
      sidearmKills: G.stats.sidearmKills, grabbed: G.stats.grabbed
    });
  }

  /* ==========================================================
     UPDATE
     ========================================================== */
  function update(rawDt) {
    if (!G) return;
    G.cam.step(Math.min(.05, rawDt));
    if (G.paused) return;
    if (isClient()) { clientUpdate(rawDt); return; }
    if (G.state === 'won' || G.state === 'lost') { decayFx(rawDt); return; }

    const dt = Math.min(.05, rawDt) * G.speed;
    G.time += dt; G.realTime += rawDt; G.tick++;

    for (const k in G.cd) if (G.cd[k] > 0) G.cd[k] = Math.max(0, G.cd[k] - dt);
    if (G.freezeT > 0) G.freezeT -= dt;
    if (G.plowT > 0) G.plowT -= dt;
    if (G.ammoBoost > 0) G.ammoBoost -= dt;
    if (G.sidearmCool > 0) G.sidearmCool = Math.max(0, G.sidearmCool - rawDt);
    if (G.appleFlash > 0) G.appleFlash = Math.max(0, G.appleFlash - dt * 2.4);

    if (G.level.weather === 'rain' && G.level.night > .6) {
      G.lightningT -= dt;
      if (G.lightningT <= 0) { G.lightningT = 5 + Math.random() * 12; G.lightning = 1; Audio2.play('thunder'); }
    }
    if (G.lightning > 0) G.lightning = Math.max(0, G.lightning - dt * 3.4);

    /* supply drops keep you scanning the whole map */
    G.crateTimer -= dt;
    if (G.crateTimer <= 0 && G.state === 'live') {
      G.crateTimer = 20 + G.rng() * 16;
      for (let k = 0; k < 14; k++) {
        const px = 120 + G.rng() * (W() - 240), py = 120 + G.rng() * (H() - 240);
        if (ART.canPlace(G.level, px, py, 14)) {
          const roll = G.rng();
          dropPickup(px, py, roll < .6 ? 'cash' : (roll < .85 ? 'ammo' : 'medkit'),
            Math.round((70 + G.wavesSent * 16) * (1 + G.rng() * .5)));
          emit('crate', null);
          break;
        }
      }
    }

    if (G.waveIdx < G.totalWaves) {
      G.waveTimer -= dt;
      if (G.waveTimer <= 0) sendNext(false);
    }

    while (G.spawnQueue.length && G.spawnQueue[0].t <= G.time) {
      const s = G.spawnQueue.shift();
      spawn(s.type, s.path, s.hpMul, s.spdMul, s.wave);
    }

    for (let i = 0; i < G.wavesSent; i++) {
      const w = G.level.waves[i];
      if (w._paid) continue;
      if (waveCleared(i)) {
        w._paid = true;
        G.gold += w.reward; G.stats.gold += w.reward;
        float(G.level.base.x, G.level.base.y - 150, '+' + U.fmtMoney(w.reward), '#3fdd8f', 18);
        Audio2.play('coin');
        emit('wavedone', i);
      }
    }

    if (G.wavesSent >= G.totalWaves && G.spawnQueue.length === 0 && !G.enemies.some(e => e.alive)) {
      win(); return;
    }

    for (let i = G.pickups.length - 1; i >= 0; i--) {
      G.pickups[i].life -= dt;
      if (G.pickups[i].life <= 0) G.pickups.splice(i, 1);
    }

    /* --- enemies --- */
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      if (!e.alive) { G.enemies.splice(i, 1); continue; }

      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }
      if (e.frozen > 0) e.frozen -= dt;
      if (e.stunT > 0) e.stunT -= dt;
      if (e.shredT > 0) { e.shredT -= dt; if (e.shredT <= 0) e.shred = 0; }
      e.armor = Math.max(0, e.baseArmor - e.shred);

      if (e.burnT > 0) {
        e.burnT -= dt;
        damage(e, e.burnDps * dt, 'incen', {});
        if (!e.alive) { G.enemies.splice(i, 1); continue; }
        if (Math.random() < dt * 12) {
          G.particles.push({
            kind: 'fire', x: e.x + (Math.random() - .5) * e.r, y: e.y - (e.fly ? 28 : 0) - Math.random() * e.r,
            vx: (Math.random() - .5) * 20, vy: -30 - Math.random() * 40,
            r: 3 + Math.random() * 4, col: '#ff9d2e', t: 0, life: .4
          });
        }
      }

      if (e.def.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.def.regen * dt);

      if (e.def.heal) {
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = 1.1;
          let healed = 0;
          for (const o of G.enemies) {
            if (!o.alive || o === e) continue;
            if (U.dist(o.x, o.y, e.x, e.y) > e.def.heal.range) continue;
            if (o.hp >= o.maxHp) continue;
            o.hp = Math.min(o.maxHp, o.hp + e.def.heal.rate); healed++;
          }
          if (healed) G.particles.push({ kind: 'ring', x: e.x, y: e.y, r: e.def.heal.range, w: 3, col: U.rgba(120, 255, 170, .6), t: 0, life: .5 });
        }
      }

      if (e.def.spawns) {
        e.spawnT -= dt;
        if (e.spawnT <= 0) {
          e.spawnT = e.def.spawns.every;
          for (let k = 0; k < e.def.spawns.n; k++) {
            const c = spawn(e.def.spawns.t, e.pathIdx, Math.max(1, e.maxHp / 2600), 1.1, e.wave, Math.max(0, e.d - 20 + k * 10));
            c.hp = c.maxHp;
          }
          burst(e.x, e.y, 10, '#ffb02a', 'smoke');
        }
      }

      let mult = 1;
      if (e.slowT > 0) mult *= (1 - e.slowAmt);
      if (e.stunT > 0 || e.frozen > 0) mult = 0;
      e.spd = e.baseSpd * mult;
      e.d += e.spd * dt;

      if (e.d >= e.pathLen) { bite(e); G.enemies.splice(i, 1); continue; }
      enemyPos(e);
    }

    /* --- weapons --- */
    const rateBoost = G.ammoBoost > 0 ? 1.4 : 1;
    for (const t of G.towers) {
      const s = stat(t);
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 4.5);
      if (t.flash > 0) t.flash = Math.max(0, t.flash - dt * 9);

      if (t.def.proj === 'flame') {
        const tgt = findTarget(t);
        t.beamTarget = tgt;
        if (tgt) {
          t.aim = Math.atan2(tgt.y - (t.y - 10), tgt.x - t.x);
          for (const e of G.enemies) {
            if (!e.alive || e.fly) continue;
            const d = U.dist(t.x, t.y - 10, e.x, e.y);
            if (d > s.range) continue;
            if (Math.abs(U.angDiff(t.aim, Math.atan2(e.y - (t.y - 10), e.x - t.x))) > s.arc / 2) continue;
            damage(e, s.dps * rateBoost * dt, 'incen', {});
            if (e.alive) {
              applyBurn(e, s.burn, s.burnT);
              if (s.shred) applyShred(e, s.shred * dt);
            }
          }
          if (Math.random() < dt * 6) Audio2.play('flame', 180);
        }
        continue;
      }

      if (s.ramp) {
        const has = findTarget(t);
        t.charge = U.clamp(t.charge + (has ? dt / s.rampT : -dt * .8), 0, 1);
      }

      t.cool -= dt * rateBoost * (s.ramp ? U.lerp(.6, 1.25, t.charge) : 1);
      if (t.cool > 0) continue;
      const tgt = findTarget(t);
      t.target = tgt;
      if (!tgt) continue;
      if (tgt.def.evade && G.rng() < tgt.def.evade) {
        t.cool = .12;
        float(tgt.x, tgt.y - tgt.r - 10, 'MISS', '#8e99b0', 11);
        continue;
      }
      fire(t, tgt);
      t.cool = 1 / s.rate;
    }

    /* --- projectiles --- */
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const p = G.projectiles[i];

      if (p.arc) {
        p.t += dt;
        const k = U.clamp(p.t / p.dur, 0, 1);
        p.gx = U.lerp(p.x0, p.x1, k);
        p.gy = U.lerp(p.y0 + (p.drop ? 460 : 0), p.y1, k);
        const height = p.drop ? (1 - k) * 460 : Math.sin(k * Math.PI) * (130 + U.dist(p.x0, p.y0, p.x1, p.y1) * .16);
        p.x = p.gx; p.y = p.gy - height;
        p.spin += dt * (p.drop ? 5 : 9);
        if (k >= 1) {
          areaHit(p.x1, p.y1, p.splash, p.dmg, p.dtype, {
            burn: p.burn, burnT: 3, stun: p.stun, stunChance: p.stun ? 1 : 0, big: true
          });
          boom(p.x1, p.y1, p.splash, p.drop ? '#ffb02a' : '#ff9d2e');
          Audio2.play(p.drop ? 'boom' : 'thump', 60);
          shake(p.drop ? .5 : .18);
          splat(p.x1, p.y1, p.splash * .3, '#2a2018');
          G.projectiles.splice(i, 1);
        }
        continue;
      }

      p.life -= dt;
      if (p.life <= 0) { G.projectiles.splice(i, 1); continue; }

      if (p.kind === 'rocketp') {
        p.smokeT -= dt;
        if (p.smokeT <= 0) {
          p.smokeT = .022;
          G.particles.push({ kind: 'smoke', x: p.x, y: p.y, vx: 0, vy: -8, r: 4, col: U.rgba(210, 210, 220, .8), t: 0, life: .55 });
        }
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < p.maxSpeed) { const k = 1 + dt * 2.4; p.vx *= k; p.vy *= k; }
      }

      if (p.target && p.target.alive && p.homing) {
        const ty2 = p.target.y - (p.target.fly ? 28 : 0);
        const want = Math.atan2(ty2 - p.y, p.target.x - p.x);
        const sp = Math.hypot(p.vx, p.vy);
        const na = U.angLerp(Math.atan2(p.vy, p.vx), want, U.clamp(p.homing * dt * 8, 0, 1));
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
        p.a = na;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;

      if (p.x < -80 || p.x > W() + 80 || p.y < -80 || p.y > H() + 80) { G.projectiles.splice(i, 1); continue; }

      let hit = null;
      for (const e of G.enemies) {
        if (!e.alive) continue;
        if (p.hitIds && p.hitIds[e.id]) continue;
        const ey = e.y - (e.fly ? 28 : 0);
        if (U.dist2(p.x, p.y, e.x, ey) < (e.r + 7) * (e.r + 7)) { hit = e; break; }
      }
      if (hit) {
        if (p.splash) {
          areaHit(p.x, p.y, p.splash, p.dmg, p.dtype, { big: true });
          boom(p.x, p.y, p.splash, '#ff9d2e');
          Audio2.play('boom', 70); shake(.3);
          G.projectiles.splice(i, 1);
        } else {
          damage(hit, p.dmg, p.dtype, p.opts || {});
          burst(p.x, p.y, p.crit ? 8 : 4, p.crit ? '#ffd23a' : '#ffe6a0', 'spark');
          if (p.pierce > 0) {
            p.pierce--;
            p.hitIds = p.hitIds || {};
            p.hitIds[hit.id] = 1;
          } else G.projectiles.splice(i, 1);
        }
      }
    }

    stepParticles(dt); stepFloats(rawDt); stepShake(rawDt);
  }

  function stepParticles(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.t += dt;
      if (p.t >= p.life) { G.particles.splice(i, 1); continue; }
      if (p.vx !== undefined) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.grav) p.vy += p.grav * dt;
        p.vx *= (1 - dt * 2.2); p.vy *= (1 - dt * 2.2);
      }
    }
    if (G.particles.length > 800) G.particles.splice(0, G.particles.length - 800);
  }
  function stepFloats(rawDt) {
    for (let i = G.floats.length - 1; i >= 0; i--) {
      G.floats[i].t += rawDt;
      if (G.floats[i].t >= G.floats[i].life) G.floats.splice(i, 1);
    }
  }
  function stepShake(rawDt) {
    if (G.shake > 0) {
      G.shake = Math.max(0, G.shake - rawDt * 2.4);
      const m = G.shake * G.shake * 12;
      G.shakeX = (Math.random() - .5) * m;
      G.shakeY = (Math.random() - .5) * m;
    } else { G.shakeX = G.shakeY = 0; }
  }
  function decayFx(rawDt) { stepParticles(rawDt); stepFloats(rawDt); stepShake(rawDt); }

  /* ==========================================================
     NETPLAY — snapshots
     ========================================================== */
  function makeSnapshot() {
    const snap = {
      k: G.tick, g: Math.round(G.gold), l: G.lives,
      wi: G.waveIdx, ws: G.wavesSent, wt: +G.waveTimer.toFixed(2),
      st: G.state, sp: G.speed, tm: +G.time.toFixed(2),
      cd: [+G.cd.plow.toFixed(1), +G.cd.freeze.toFixed(1), +G.cd.blast.toFixed(1)],
      fz: +G.freezeT.toFixed(2), ab: +G.ammoBoost.toFixed(1),
      e: G.enemies.map(e => [
        e.id, ENEMY_KEYS.indexOf(e.type), Math.round(e.x), Math.round(e.y),
        +e.a.toFixed(2), Math.round(e.hp), Math.round(e.maxHp),
        (e.fly ? 1 : 0) | (e.frozen > 0 ? 2 : 0) | (e.burnT > 0 ? 4 : 0) |
        (e.slowT > 0 ? 8 : 0) | (e.stunT > 0 ? 16 : 0) | (e.boss ? 32 : 0),
        Math.round(e.shieldHp)
      ]),
      t: G.towers.map(t => [
        t.id, TOWER_KEYS.indexOf(t.type), Math.round(t.x), Math.round(t.y),
        t.tier, +t.aim.toFixed(2), t.owner, t.mode, +t.charge.toFixed(2)
      ]),
      p: G.pickups.map(p => [p.id, PICKUP_KIND.indexOf(p.kind), Math.round(p.x), Math.round(p.y), +p.life.toFixed(1), p.value]),
      sh: G.shotLog                          /* shots fired since the last snapshot */
    };
    G.shotLog = [];                          /* snap keeps the old array; start a fresh one */
    return snap;
  }

  function applySnapshot(s) {
    if (!G) return;
    G.lerpT = 0;

    G.gold = s.g; G.lives = s.l;
    G.waveIdx = s.wi; G.wavesSent = s.ws; G.waveTimer = s.wt;
    G.speed = s.sp; G.time = s.tm; G.ammoBoost = s.ab; G.freezeT = s.fz;
    G.cd.plow = s.cd[0]; G.cd.freeze = s.cd[1]; G.cd.blast = s.cd[2];

    if (s.st !== G.state) {
      G.state = s.st;
      const f = G.lives / G.maxLives;
      if (s.st === 'won') {
        Audio2.play('win'); Audio2.stopMusic();
        emit('win', { stars: f >= .999 ? 3 : (f >= .6 ? 2 : 1), kills: G.stats.kills, gold: G.stats.gold, lives: G.lives, maxLives: G.maxLives, time: G.realTime, sidearmKills: G.stats.sidearmKills, grabbed: G.stats.grabbed });
      }
      if (s.st === 'lost') {
        Audio2.play('lose'); Audio2.stopMusic();
        emit('lose', { kills: G.stats.kills, gold: G.stats.gold, time: G.realTime, wave: G.waveIdx, sidearmKills: G.stats.sidearmKills, grabbed: G.stats.grabbed });
      }
    }

    /* enemies, reconciled by id so sprites keep their animation phase */
    const seen = {};
    for (const row of s.e) {
      const id = row[0];
      seen[id] = 1;
      const type = ENEMY_KEYS[row[1]];
      let e = G.enemies.find(v => v.id === id);
      if (!e) {
        const def = ENEMIES[type];
        e = {
          id, type, def, alive: true, seed: (id * 37) % 100,
          r: def.r, col: def.col, x: row[2], y: row[3], a: row[4],
          hp: row[5], maxHp: row[6], shieldHp: row[8], maxShield: row[8] || 1,
          hitFlash: 0, slowT: 0, burnT: 0, stunT: 0, frozen: 0, shredT: 0,
          spd: def.spd, d: 0, pathLen: 1, pathIdx: 0
        };
        G.enemies.push(e);
      }
      if (e.hp > row[5]) e.hitFlash = .16;
      e.px2 = e.x; e.py2 = e.y;
      e.tx = row[2]; e.ty = row[3]; e.ta = row[4];
      e.hp = row[5]; e.maxHp = row[6]; e.shieldHp = row[8];
      const flags = row[7];
      e.fly = !!(flags & 1);
      e.frozen = (flags & 2) ? 1 : 0;
      e.burnT = (flags & 4) ? 1 : 0;
      e.slowT = (flags & 8) ? 1 : 0;
      e.stunT = (flags & 16) ? 1 : 0;
      e.boss = !!(flags & 32);
    }
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      if (!seen[G.enemies[i].id]) {
        const e = G.enemies[i];
        burst(e.x, e.y, 10, e.fly ? e.col : '#8a2230', e.fly ? 'feather' : 'goo');
        G.enemies.splice(i, 1);
      }
    }

    /* towers */
    const tseen = {};
    for (const row of s.t) {
      const id = row[0];
      tseen[id] = 1;
      const type = TOWER_KEYS[row[1]];
      let t = G.towers.find(v => v.id === id);
      if (!t) {
        t = { id, type, def: TOWERS[type], x: row[2], y: row[3], tier: row[4], aim: row[5], owner: row[6], mode: row[7], charge: row[8], cool: 0, recoil: 0, flash: 0, seed: (id * 13) % 10 };
        G.towers.push(t);
        Audio2.play('build');
        burst(t.x, t.y, 14, t.def.col, 'spark');
      }
      if (t.tier !== row[4]) { Audio2.play('upgrade'); burst(t.x, t.y, 18, t.def.col, 'spark'); }
      if (Math.abs(U.angDiff(t.aim, row[5])) > 0.02) t.flash = Math.max(t.flash, .6);
      t.tier = row[4]; t.aim = row[5]; t.owner = row[6]; t.mode = row[7]; t.charge = row[8];
    }
    for (let i = G.towers.length - 1; i >= 0; i--) {
      if (!tseen[G.towers[i].id]) {
        burst(G.towers[i].x, G.towers[i].y, 10, '#8e99b0', 'smoke');
        G.towers.splice(i, 1);
      }
    }

    /* pickups */
    const pseen = {};
    for (const row of s.p) {
      const id = row[0];
      pseen[id] = 1;
      let p = G.pickups.find(v => v.id === id);
      if (!p) G.pickups.push({ id, kind: PICKUP_KIND[row[1]], x: row[2], y: row[3], life: row[4], value: row[5], seed: (id * 7) % 10 });
      else p.life = row[4];
    }
    for (let i = G.pickups.length - 1; i >= 0; i--) if (!pseen[G.pickups[i].id]) G.pickups.splice(i, 1);

    /* draw a bullet for every shot the host reported since the last snapshot */
    if (s.sh && s.sh.length) {
      for (const shot of s.sh) {
        const tw = G.towers.find(v => v.id === shot[0]);
        if (!tw) continue;
        const tx = shot[1], ty = shot[2];
        const a = Math.atan2(ty - (tw.y - 14), tx - tw.x);
        const heavy = tw.def && /he|drop|arc|homing|wave|chain/.test(tw.def.proj);
        G.projectiles.push({
          cosmetic: true, kind: 'bullet',
          x: tw.x, y: tw.y - 14, a,
          vx: Math.cos(a) * (heavy ? 620 : 1050), vy: Math.sin(a) * (heavy ? 620 : 1050),
          gx: tx, gy: ty, life: 1.0,
          col: (tw.def && tw.def.dtype === 'ap') ? '#fff6d0' : (tw.def ? U.mix(tw.def.col, '#ffe6a0', .5) : '#ffd88a'),
          tracer: 18
        });
        tw.recoil = 1; tw.flash = 1;
        if (tw.def && tw.def.sfx) Audio2.play(tw.def.sfx, tw.def.proj === 'bullet' ? 40 : 60);
      }
    }
  }

  /* clients advance visuals only and slide entities toward the last snapshot */
  function clientUpdate(rawDt) {
    G.realTime += rawDt; G.time += rawDt;
    if (G.sidearmCool > 0) G.sidearmCool = Math.max(0, G.sidearmCool - rawDt);
    if (G.appleFlash > 0) G.appleFlash = Math.max(0, G.appleFlash - rawDt * 2.4);
    if (G.lightning > 0) G.lightning = Math.max(0, G.lightning - rawDt * 3.4);
    if (G.waveTimer > 0) G.waveTimer = Math.max(0, G.waveTimer - rawDt);

    G.lerpT = Math.min(1, G.lerpT + rawDt / 0.09);
    for (const e of G.enemies) {
      if (e.tx === undefined) continue;
      e.x = U.lerp(e.px2 === undefined ? e.tx : e.px2, e.tx, G.lerpT);
      e.y = U.lerp(e.py2 === undefined ? e.ty : e.py2, e.ty, G.lerpT);
      e.a = U.angLerp(e.a, e.ta, Math.min(1, rawDt * 12));
      if (e.hitFlash > 0) e.hitFlash -= rawDt;
    }
    for (const t of G.towers) {
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - rawDt * 4.5);
      if (t.flash > 0) t.flash = Math.max(0, t.flash - rawDt * 9);
    }
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      G.pickups[i].life -= rawDt;
      if (G.pickups[i].life <= 0) G.pickups.splice(i, 1);
    }

    /* fly the cosmetic bullets toward where the host aimed; pop on arrival */
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const p = G.projectiles[i];
      p.life -= rawDt;
      p.x += p.vx * rawDt; p.y += p.vy * rawDt;
      const reached = p.gx !== undefined &&
        ((p.x - p.gx) * p.vx + (p.y - p.gy) * p.vy) >= 0;   /* passed the target */
      if (p.life <= 0 || reached) {
        burst(p.gx !== undefined ? p.gx : p.x, p.gy !== undefined ? p.gy : p.y, 4, '#ffe6a0', 'spark');
        G.projectiles.splice(i, 1);
      }
    }

    stepParticles(rawDt); stepFloats(rawDt); stepShake(rawDt);
  }

  /* ==========================================================
     INPUT HELPERS
     ========================================================== */
  function towerAt(x, y) {
    let best = null, bd = Infinity;
    for (const t of G.towers) {
      const d = U.dist(x, y, t.x, t.y - 10);
      if (d < t.def.foot + 12 && d < bd) { bd = d; best = t; }
    }
    return best;
  }
  /* `tol` lets the UI widen the target so a drop is the same physical size
     under a fingertip no matter how far the camera is zoomed out. Nearest
     wins, so overlapping drops still resolve sensibly. */
  function pickupAt(x, y, tol) {
    const r = tol || 40;
    let best = null, bd = r * r;
    for (const p of G.pickups) {
      const d2 = U.dist2(x, y, p.x, p.y);
      if (d2 < bd) { bd = d2; best = p; }
    }
    return best;
  }

  return {
    load, update,
    get state() { return G; },
    cmd, apply, stat, upgradeCost, placementOk,
    sendNext, earlyBonus, towerAt, pickupAt,
    makeSnapshot, applySnapshot,
    win, lose, toast, float
  };
})();
