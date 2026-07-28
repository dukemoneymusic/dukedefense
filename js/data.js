/* ============================================================
   DUKE$DEFENSE — data.js
   The arsenal, the vermin, and the fifteen districts.

   Ammunition types (the curve lives in damage() in game.js)
   --------------------------------------------------------
     ball    full metal jacket  — cheap, punished hard by armour
     ap      armour piercing    — .50 cal, mostly ignores plate
     buck    buckshot           — savage up close, useless against plate
     he      high explosive     — the anti-armour answer, splashes
     incen   incendiary         — bypasses armour, burns over time
     cryo    cryogenic          — part-bypasses plate, slows and embrittles
     energy  directed energy    — ignores armour entirely

   Every weapon has a FOOTPRINT radius. You may emplace it anywhere
   the placement mask is clear: off the road, off the buildings.
   ============================================================ */
'use strict';

/* ==========================================================
   THE ARSENAL
   Four heavy indirect-fire pieces cannot elevate onto air
   targets. Everything else can.
   ========================================================== */
const TOWERS = {

  pistol: {
    name: 'Sidearm Post', short: '9MM', icon: '9mm',
    blurb: 'A pistol on a swivel and a crate of nine-millimetre. It is not much, but it is up before anything else is.',
    dtype: 'ball', targets: 'both', proj: 'bullet', sfx: 'pistol',
    col: '#c8b48a', foot: 18,
    tiers: [
      { cost: 90,  range: 150, dmg: 11, rate: 2.8, speed: 780, label: 'M9 SIDEARM' },
      { cost: 130, range: 168, dmg: 19, rate: 3.4, speed: 860, label: 'MATCH TRIGGER' },
      { cost: 240, range: 190, dmg: 32, rate: 4.2, speed: 950, multi: 2, label: 'AKIMBO RIG' }
    ]
  },

  shotgun: {
    name: 'Breach Gun', short: '12GA', icon: '12G',
    blurb: 'Twelve gauge on a tripod. A wall of buckshot inside twenty metres and a hard shove behind it. Plate armour eats it for breakfast.',
    dtype: 'buck', targets: 'ground', proj: 'cone', sfx: 'shotgun',
    col: '#d97a3a', foot: 20,
    tiers: [
      { cost: 130, range: 118, dmg: 34, rate: 1.1,  pellets: 6,  spread: .52, push: 26, label: 'PUMP 12GA' },
      { cost: 190, range: 132, dmg: 58, rate: 1.25, pellets: 8,  spread: .56, push: 34, label: 'AUTO 12GA' },
      { cost: 330, range: 150, dmg: 100, rate: 1.4, pellets: 10, spread: .62, push: 48, stun: .35, label: 'STREET SWEEPER' }
    ]
  },

  smg: {
    name: 'SMG Nest', short: 'SMG', icon: 'SMG',
    blurb: 'Short barrel, short reach, and a cyclic rate that turns a corner into a meat grinder.',
    dtype: 'ball', targets: 'both', proj: 'bullet', sfx: 'smg',
    col: '#8fa3c4', foot: 18,
    tiers: [
      { cost: 160, range: 124, dmg: 8,  rate: 8.0,  speed: 900,  label: 'MP5' },
      { cost: 230, range: 138, dmg: 13, rate: 9.5,  speed: 980,  label: 'SUPPRESSED' },
      { cost: 400, range: 155, dmg: 22, rate: 11.5, speed: 1100, multi: 2, label: 'DUAL VECTOR' }
    ]
  },

  rifle: {
    name: 'Rifle Post', short: 'RIFLE', icon: 'M4',
    blurb: 'Three-round burst, optic, decent glass. The weapon you build when you do not yet know what is coming.',
    dtype: 'ball', targets: 'both', proj: 'bullet', sfx: 'rifle',
    col: '#7d8a6b', foot: 19,
    tiers: [
      { cost: 180, range: 200, dmg: 20, rate: 2.2, speed: 1100, multi: 3, label: 'M4 CARBINE' },
      { cost: 250, range: 224, dmg: 34, rate: 2.6, speed: 1200, multi: 3, label: 'ACOG + GRIP' },
      { cost: 430, range: 252, dmg: 58, rate: 3.0, speed: 1350, multi: 3, crit: .18, label: 'FULL AUTO MK18' }
    ]
  },

  lmg: {
    name: 'Machine Gun Nest', short: 'LMG', icon: 'SAW',
    blurb: 'Belt fed and tripod mounted. Takes a moment to wind onto a target, then does not stop.',
    dtype: 'ball', targets: 'both', proj: 'bullet', sfx: 'lmg',
    col: '#6b7280', foot: 22,
    tiers: [
      { cost: 260, range: 180, dmg: 12, rate: 6.5, speed: 950,  ramp: 1.9, rampT: 2.5, label: 'M249 SAW' },
      { cost: 360, range: 200, dmg: 20, rate: 7.5, speed: 1050, ramp: 2.1, rampT: 2.5, label: 'BELT FED' },
      { cost: 620, range: 226, dmg: 34, rate: 9.0, speed: 1200, ramp: 2.5, rampT: 2.5, label: 'M134 MINIGUN' }
    ]
  },

  sniper: {
    name: 'Anti-Materiel Rifle', short: 'SNIPER', icon: '.50',
    blurb: 'Fifty calibre, half the block of reach, and a round that does not particularly care what you are wearing.',
    dtype: 'ap', targets: 'both', proj: 'bullet', sfx: 'sniper',
    col: '#4a5568', foot: 20,
    tiers: [
      { cost: 300, range: 380, dmg: 95,  rate: .70, speed: 2200, crit: .22, label: 'M82 .50 CAL' },
      { cost: 420, range: 430, dmg: 175, rate: .80, speed: 2500, crit: .30, pierce: 1, label: 'RANGEFINDER' },
      { cost: 720, range: 500, dmg: 340, rate: .92, speed: 2800, crit: .42, pierce: 3, label: 'SABOT ROUNDS' }
    ]
  },

  gl: {
    name: 'Grenade Launcher', short: 'GL', icon: 'GL',
    blurb: 'Lobs forty-millimetre HE on a lazy arc. Cannot elevate onto anything airborne, and does not need to.',
    dtype: 'he', targets: 'ground', proj: 'arc', sfx: 'thump',
    col: '#8a7a3a', foot: 22,
    tiers: [
      { cost: 200, range: 210, dmg: 46,  rate: .95, splash: 70,  speed: 420, label: 'M203' },
      { cost: 280, range: 236, dmg: 82,  rate: 1.1, splash: 86,  speed: 450, label: 'MK19 AUTO' },
      { cost: 480, range: 268, dmg: 150, rate: 1.25, splash: 108, speed: 480, burn: 10, label: 'THUMPER SALVO' }
    ]
  },

  mortar: {
    name: 'Mortar Pit', short: 'MORTAR', icon: 'MTR',
    blurb: 'Indirect fire from clear across the district. Enormous reach, enormous splash, and a dead zone at its own feet.',
    dtype: 'he', targets: 'ground', proj: 'drop', sfx: 'mortar',
    col: '#5c6b4a', foot: 26,
    tiers: [
      { cost: 380, range: 460, minRange: 150, dmg: 130, rate: .38, splash: 96,  stun: .5,  label: '60MM MORTAR' },
      { cost: 520, range: 520, minRange: 160, dmg: 240, rate: .46, splash: 118, stun: .7,  label: '81MM MORTAR' },
      { cost: 860, range: 600, minRange: 170, dmg: 460, rate: .54, splash: 148, stun: 1.1, label: '120MM BATTERY' }
    ]
  },

  rocket: {
    name: 'Rocket Battery', short: 'ROCKET', icon: 'RKT',
    blurb: 'Fire and forget. The seeker head will chase anything, including whatever is trying to fly over you.',
    dtype: 'he', targets: 'both', proj: 'homing', sfx: 'rocket',
    col: '#c0483a', foot: 24,
    tiers: [
      { cost: 340, range: 250, dmg: 110, rate: .62, splash: 74,  speed: 300, label: 'AT4' },
      { cost: 470, range: 282, dmg: 200, rate: .72, splash: 90,  speed: 340, label: 'JAVELIN CLU' },
      { cost: 800, range: 320, dmg: 380, rate: .84, splash: 112, speed: 380, multi: 2, label: 'MLRS POD' }
    ]
  },

  flame: {
    name: 'Flamethrower', short: 'FLAME', icon: 'FLM',
    blurb: 'A cone of thickened fuel. Armour does not help, and whatever walks out of it keeps burning.',
    dtype: 'incen', targets: 'ground', proj: 'flame', sfx: 'flame',
    col: '#e8622a', foot: 21,
    tiers: [
      { cost: 240, range: 132, dps: 52,  arc: .58, burn: 16, burnT: 3.0, label: 'M2 FLAMETHROWER' },
      { cost: 330, range: 150, dps: 92,  arc: .62, burn: 28, burnT: 3.5, label: 'THICKENED FUEL' },
      { cost: 580, range: 172, dps: 170, arc: .68, burn: 50, burnT: 4.0, shred: 4, label: 'NAPALM PROJECTOR' }
    ]
  },

  cryo: {
    name: 'Cryo Cannon', short: 'CRYO', icon: 'CRY',
    blurb: 'Liquid nitrogen under pressure. Little damage on its own, but everything in the cloud crawls, and frozen things break easier.',
    dtype: 'cryo', targets: 'both', proj: 'wave', sfx: 'cryo',
    col: '#5fd8ff', foot: 21,
    tiers: [
      { cost: 190, range: 130, dmg: 14, rate: 1.0,  splash: 130, slow: .40, slowT: 1.8, shred: 1, label: 'LN2 SPRAYER' },
      { cost: 270, range: 150, dmg: 26, rate: 1.15, splash: 150, slow: .52, slowT: 2.3, shred: 2, label: 'CRYO CANNON' },
      { cost: 470, range: 176, dmg: 46, rate: 1.3,  splash: 176, slow: .64, slowT: 3.0, shred: 4, label: 'FLASH-FREEZE UNIT' }
    ]
  },

  tesla: {
    name: 'Arc Emitter', short: 'ARC', icon: 'ARC',
    blurb: 'Directed current that jumps from body to body. Plate armour is a conductor, which is very much their problem.',
    dtype: 'energy', targets: 'both', proj: 'chain', sfx: 'arc',
    col: '#9a6cff', foot: 22,
    tiers: [
      { cost: 300, range: 168, dmg: 40,  rate: 1.5, chain: 3, falloff: .78, stunChance: .18, stun: .40, label: 'ARC EMITTER' },
      { cost: 430, range: 190, dmg: 72,  rate: 1.7, chain: 4, falloff: .80, stunChance: .26, stun: .55, label: 'TESLA COIL' },
      { cost: 740, range: 216, dmg: 132, rate: 1.9, chain: 6, falloff: .84, stunChance: .36, stun: .80, label: 'STORM PYLON' }
    ]
  }
};

/* shop order: cheap and general first, specialists after */
const TOWER_ORDER = ['pistol', 'shotgun', 'smg', 'rifle', 'cryo', 'gl',
                     'lmg', 'flame', 'tesla', 'sniper', 'rocket', 'mortar'];



/* ==========================================================
   VERMIN
   ========================================================== */
const ENEMIES = {

  roach:  { name: 'Water Bug', icon: '\u{1FAB3}', hp: 20,  spd: 108, armor: 0,  bounty: 5,  bite: 1, r: 8,  col: '#5b3d22' },
  rat:    { name: 'Sewer Rat', icon: '\u{1F401}', hp: 38,  spd: 64,  armor: 0,  bounty: 7,  bite: 1, r: 11, col: '#6b6560', rodent: true },
  pigeon: { name: 'Pigeon',    icon: '\u{1F426}', hp: 32,  spd: 80,  armor: 0,  bounty: 8,  bite: 1, r: 10, col: '#7d8899', fly: true },
  squirrel:{name: 'Squirrel',  icon: '\u{1F43F}', hp: 50,  spd: 96,  armor: 1,  bounty: 10, bite: 1, r: 11, col: '#8a6b4a', rodent: true, evade: .18 },
  bedbug: { name: 'Bedbug',    icon: '\u{1F41B}', hp: 30,  spd: 76,  armor: 2,  bounty: 9,  bite: 1, r: 9,  col: '#8c3222', noSlow: true },
  gull:   { name: 'Seagull',   icon: '\u{1F54A}', hp: 78,  spd: 100, armor: 1,  bounty: 12, bite: 1, r: 13, col: '#e2e7ee', fly: true },
  raccoon:{ name: 'Raccoon',   icon: '\u{1F99D}', hp: 155, spd: 50,  armor: 3,  bounty: 16, bite: 2, r: 15, col: '#5f6774' },
  pizzarat:{name: 'Pizza Rat', icon: '\u{1F9C0}', hp: 96,  spd: 122, armor: 0,  bounty: 18, bite: 1, r: 12, col: '#7a6b5c', rodent: true, steal: 22 },
  tourist:{ name: 'Tour Group',icon: '\u{1F4F8}', hp: 220, spd: 40,  armor: 2,  bounty: 20, bite: 2, r: 18, col: '#cf5b8a', splits: { t: 'rat', n: 3 } },
  elmo:   { name: 'Costume Character', icon: '\u{1F9F8}', hp: 200, spd: 48, armor: 3, bounty: 26, bite: 2, r: 17, col: '#e03a3a', heal: { rate: 22, range: 110 } },
  drone:  { name: 'Delivery Drone', icon: '\u{1F6F8}', hp: 260, spd: 136, armor: 2, bounty: 30, bite: 2, r: 14, col: '#3f4a5c', fly: true },
  gator:  { name: 'Sewer Gator', icon: '\u{1F40A}', hp: 580, spd: 36, armor: 9, bounty: 42, bite: 3, r: 22, col: '#3f6b46' },
  hawk:   { name: 'Red-Tail Hawk', icon: '\u{1F985}', hp: 460, spd: 92, armor: 5, bounty: 46, bite: 3, r: 18, col: '#7a4a28', fly: true },
  golem:  { name: 'Scaffold Golem', icon: '\u{1F3D7}', hp: 980, spd: 28, armor: 13, bounty: 70, bite: 4, r: 26, col: '#6b7280', regen: 14 },

  /* ---- bosses ---- */
  b_ratking: {
    name: 'THE RAT KING', icon: '\u{1F451}', hp: 4200, spd: 34, armor: 12, bounty: 320, bite: 8, r: 40,
    col: '#5a4f45', boss: true, rodent: true, spawns: { t: 'rat', every: 3.2, n: 3 }, regen: 30
  },
  b_gatorlord: {
    name: 'THE GATOR LORD', icon: '\u{1F40A}', hp: 6800, spd: 30, armor: 18, bounty: 420, bite: 9, r: 46,
    col: '#2f5c3a', boss: true, regen: 45, rage: 1.7
  },
  b_flock: {
    name: 'THE FLOCK', icon: '\u{1F426}', hp: 5200, spd: 76, armor: 10, bounty: 380, bite: 7, r: 38,
    col: '#98a4b6', boss: true, fly: true, spawns: { t: 'pigeon', every: 2.6, n: 4 }
  },
  b_titan: {
    name: 'THE SCAFFOLD TITAN', icon: '\u{1F3D7}', hp: 11000, spd: 24, armor: 25, bounty: 560, bite: 12, r: 54,
    col: '#7c8492', boss: true, regen: 90, shield: .3
  },
  b_bigcheese: {
    name: 'THE BIG CHEESE', icon: '\u{1F9C0}', hp: 20000, spd: 30, armor: 22, bounty: 900, bite: 20, r: 60,
    col: '#c9a03a', boss: true, rodent: true, regen: 140, rage: 1.9,
    spawns: { t: 'pizzarat', every: 2.4, n: 3 }
  }
};


/* ==========================================================
   WAVE GENERATOR
   Hand-tuned curve, procedurally filled. Every district keeps
   its own roster so Coney Island feels like gulls and the
   Bronx feels like teeth.
   ========================================================== */
function makeWaves(idx, count, pool, boss, opts) {
  opts = opts || {};
  const r = U.rng(4200 + idx * 977);
  const waves = [];
  /* Every district hands the player a fresh wallet, so wave 1 has to stay
     beatable with tier-1 towers. District difficulty comes from the roster
     (gators and golems show up early later on), extra lanes and more waves
     — NOT from multiplying turn-one hit points into the stratosphere. */
  const tier = 1 + idx * 0.075;
  const nPaths = opts.paths || 1;

  for (let w = 0; w < count; w++) {
    const p = count > 1 ? w / (count - 1) : 0;
    const isBoss = (w === count - 1) && !!boss;
    const isMini = !isBoss && count > 8 && w === Math.floor(count * .55);
    const hpMul = tier * (0.68 + p * 1.55);
    const spdMul = 1 + p * 0.13 + idx * 0.006;
    /* Two or three lanes means each tower covers half or a third as much
       of the assault, so the same head-count is roughly twice the fight. */
    const laneFactor = 1 / (0.62 + 0.38 * nPaths);
    const groups = [];

    if (isBoss) {
      groups.push({ type: boss, count: 1, gap: 1, delay: 0, hpMul: hpMul * .92, spdMul: 1, path: 0, boss: true });
      /* escort so the boss isn't lonely */
      const esc = pool.filter(e => e.from <= .7);
      for (let k = 0; k < Math.min(2, esc.length); k++) {
        const e = esc[(r() * esc.length) | 0];
        groups.push({
          type: e.t, count: Math.max(3, Math.round((6 + idx * 1.2) * laneFactor)),
          gap: .55, delay: 2 + k * 3.5,
          hpMul: hpMul * .8, spdMul, path: k % nPaths
        });
      }
    } else {
      const avail = pool.filter(e => e.from <= p + .001);
      const kinds = U.clamp(1 + Math.floor(p * 3.6) + (isMini ? 1 : 0), 1, Math.min(4, avail.length));
      const used = {};
      for (let k = 0; k < kinds; k++) {
        /* weighted pick, no repeats */
        let tot = 0;
        avail.forEach(e => { if (!used[e.t]) tot += (e.w || 1); });
        if (tot <= 0) break;
        let acc = r() * tot, chosen = null;
        for (const e of avail) {
          if (used[e.t]) continue;
          acc -= (e.w || 1);
          if (acc <= 0) { chosen = e; break; }
        }
        if (!chosen) break;
        used[chosen.t] = 1;

        const def = ENEMIES[chosen.t];
        const bulk = def.hp < 60 ? 1.9 : (def.hp < 200 ? 1.0 : 0.45);
        const n = Math.max(2, Math.round((3 + p * 13 + idx * .55) * bulk * (chosen.n || 1) * (isMini ? 1.5 : 1) * laneFactor));
        groups.push({
          type: chosen.t,
          count: n,
          gap: U.clamp(.9 - p * .42, .3, .9) / (bulk > 1.4 ? 1.9 : 1),
          delay: k * (1.6 + r() * 2.4),
          hpMul: hpMul * (isMini ? 1.18 : 1),
          spdMul,
          path: nPaths > 1 ? (k % nPaths) : 0
        });
      }
    }

    waves.push({
      groups,
      reward: Math.round(54 + idx * 9 + w * 12 + (isBoss ? 260 : 0) + (isMini ? 60 : 0)),
      prep: w === 0 ? 24 : (isBoss ? 22 : 16),
      boss: isBoss, mini: isMini
    });
  }
  return waves;
}


/* ==========================================================
   LEVEL CONSTRUCTION HELPERS
   ========================================================== */
/* Layouts were authored against a 1600x900 board. The battlefield is
   now WORLD_W x WORLD_H, so everything spatial gets scaled up on the
   way in — routes get longer, blocks get further apart, and there is
   real estate to actually manoeuvre weapons around. */
const SCALE_X = WORLD_W / 1600;
const SCALE_Y = WORLD_H / 900;
const SCALE   = Math.min(SCALE_X, SCALE_Y);

function mkLevel(cfg) {
  /* extra lanes mean extra opening capital and a little more slack */
  cfg.gold += (cfg.paths.length - 1) * 150;
  cfg.lives += (cfg.paths.length - 1) * 3;

  /* --- scale the layout up to the real board --- */
  cfg.paths = cfg.paths.map(p => p.map(w => ({ x: w.x * SCALE_X, y: w.y * SCALE_Y })));
  if (cfg.landmark) {
    cfg.landmark.x *= SCALE_X; cfg.landmark.y *= SCALE_Y;
    cfg.landmark.s = (cfg.landmark.s || 1) * SCALE;
    cfg.landmark.clear = (cfg.landmark.clear || 260) * SCALE;
  }
  (cfg.props || []).forEach(p => {
    p.x *= SCALE_X; p.y *= SCALE_Y;
    if (p.t === 'tree') p.s = (p.s || 26) * SCALE; else p.s = (p.s || 1) * SCALE;
    if (p.len) p.len *= SCALE;
  });
  (cfg.lights || []).forEach(l => { l.x *= SCALE_X; l.y *= SCALE_Y; l.r = (l.r || 130) * SCALE; });
  (cfg.keepClear || []).forEach(k => { k.x *= SCALE_X; k.y *= SCALE_Y; k.r *= SCALE; });
  cfg.roadW = Math.round((cfg.roadW || 64) * SCALE);
  cfg.cityDensity = Math.round((cfg.cityDensity === undefined ? 46 : cfg.cityDensity) * 2.1);

  cfg.builtPaths = cfg.paths.map(p => U.buildPath(p, 5));
  const last = cfg.paths[0][cfg.paths[0].length - 1];
  cfg.base = cfg.base || { x: last.x, y: last.y };
  delete cfg.padSpec;

  cfg.waves = makeWaves(cfg.id, cfg.waveCount, cfg.pool, cfg.boss, { paths: cfg.paths.length });
  cfg.threats = [];
  const seen = {};
  cfg.waves.forEach(w => w.groups.forEach(g => { if (!seen[g.type]) { seen[g.type] = 1; cfg.threats.push(g.type); } }));

  /* where the camera opens: on the apple */
  cfg.startView = { x: cfg.base.x, y: cfg.base.y };
  return cfg;
}

/* shorthand for enemy pool entries */
const E = (t, from, w, n) => ({ t, from, w: w || 1, n: n || 1 });


/* ==========================================================
   THE FIFTEEN DISTRICTS
   ========================================================== */
const LEVELS = [

  /* ---------- 1. TIMES SQUARE ---------- */
  mkLevel({
    id: 0, name: 'Times Square', borough: 'Midtown Manhattan', mood: 'neon',
    blurb: 'It starts here, because of course it does. Something got into the subway grates under Duffy Square and it is coming up hungry. Forty-two billboards, no place to hide, and one golden apple on a plinth where the TKTS steps used to be.',
    ground: 'asphalt', night: .92, weather: 'clear', season: 'summer',
    lives: 20, gold: 320, waveCount: 12, roadW: 68,
    pal: {
      ground: '#2b2f38', road: '#22262e', roadLine: '#e8d24a', curb: '#4a505c',
      bldg: ['#2f3542', '#3a3f4c', '#454b5a', '#28303c'], sky: '#141c30',
      grade: '#3a3f66', nightTint: '#0b1226', lampCol: '#ffbe5c'
    },
    buildSeed: 1001, cityDensity: 42, heightMul: 1.35,
    bldgStyles: ['glass', 'stone', 'brick'],
    propSet: ['lamp', 'hydrant', 'trash', 'car', 'news', 'cone'],
    paths: [[
      { x: -70, y: 210 }, { x: 180, y: 230 }, { x: 360, y: 330 }, { x: 520, y: 420 },
      { x: 700, y: 400 }, { x: 860, y: 300 }, { x: 1040, y: 300 }, { x: 1180, y: 420 },
      { x: 1220, y: 590 }, { x: 1090, y: 700 }, { x: 900, y: 720 }, { x: 800, y: 700 }
    ]],
    landmark: { t: 'billboards', x: 620, y: 120, s: 1, clear: 200 },
    lights: [{ x: 620, y: 160, r: 300, s: .8, c: '#ff4d7a' }, { x: 900, y: 130, r: 240, s: .7, c: '#4de0ff' }],
    pool: [E('rat', 0, 3), E('roach', 0, 2.4), E('pigeon', .18, 1.8), E('squirrel', .34, 1.4),
           E('raccoon', .5, 1.2), E('tourist', .62, 1), E('pizzarat', .74, 1)],
    boss: 'b_ratking'
  }),

  /* ---------- 2. CENTRAL PARK ---------- */
  mkLevel({
    id: 1, name: 'Central Park', borough: 'The Ramble', mood: 'park',
    blurb: 'Eight hundred and forty green acres and every raccoon in them has opinions about your apple. The path loops through the Ramble where nobody can see you and the squirrels are, frankly, organised.',
    ground: 'grass', night: .12, weather: 'clear', season: 'summer',
    lives: 22, gold: 340, waveCount: 12, roadW: 56,
    pal: {
      ground: '#37542c', road: '#6b5a3e', roadLine: '#8f7d59', curb: '#5e6b45',
      bldg: ['#5a4a3c', '#6b5748', '#4a4038', '#7a6553'], sky: '#8db4d8',
      grade: '#7d8f9a', nightTint: '#101b28', lampCol: '#ffd9a0'
    },
    buildSeed: 2002, cityDensity: 30, cityEdgeOnly: true, heightMul: 1.5,
    bldgStyles: ['brick', 'stone'],
    propSet: ['tree', 'bench', 'lamp', 'planter', 'trash'],
    paths: [[
      { x: 810, y: -70 }, { x: 800, y: 120 }, { x: 640, y: 220 }, { x: 400, y: 250 },
      { x: 250, y: 380 }, { x: 300, y: 560 }, { x: 500, y: 640 }, { x: 720, y: 600 },
      { x: 900, y: 490 }, { x: 1110, y: 470 }, { x: 1250, y: 560 }, { x: 1230, y: 720 },
      { x: 1050, y: 780 }, { x: 880, y: 740 }
    ]],
    props: [
      { t: 'tree', x: 150, y: 700, s: 46 }, { t: 'tree', x: 260, y: 780, s: 40 },
      { t: 'tree', x: 420, y: 120, s: 44 }, { t: 'tree', x: 1000, y: 200, s: 48 },
      { t: 'tree', x: 1300, y: 300, s: 42 }, { t: 'tree', x: 620, y: 820, s: 38 },
      { t: 'tree', x: 90, y: 420, s: 36 }, { t: 'tree', x: 1420, y: 640, s: 44 }
    ],
    landmark: { t: 'arch', x: 640, y: 830, s: 1.1, clear: 190 },
    pool: [E('squirrel', 0, 3), E('rat', 0, 2), E('pigeon', .12, 2), E('raccoon', .3, 2),
           E('roach', .2, 1.4), E('gull', .48, 1.2), E('tourist', .58, 1.2), E('elmo', .72, 1)],
    boss: 'b_flock'
  }),

  /* ---------- 3. BROOKLYN BRIDGE ---------- */
  mkLevel({
    id: 2, name: 'Brooklyn Bridge', borough: 'East River Crossing', mood: 'harbor',
    blurb: 'They are coming over the promenade from both sides at once and there is nowhere on a bridge to fall back to. Gothic arches, steel cable, cold water, one apple wedged against the Manhattan tower.',
    ground: 'boardwalk', night: .55, weather: 'clear', season: 'summer',
    lives: 18, gold: 450, waveCount: 13, roadW: 54,
    pal: {
      ground: '#6b5a44', road: '#3e3830', roadLine: '#c8b98a', curb: '#5a5348',
      bldg: ['#2f3644', '#3a4150', '#454d5e'], sky: '#2a3c5c',
      grade: '#48597a', nightTint: '#0d1626', lampCol: '#ffd08a'
    },
    buildSeed: 3003, cityDensity: 26, cityEdgeOnly: true, heightMul: 1.3,
    bldgStyles: ['stone', 'glass'],
    propSet: ['lamp', 'bench', 'trash'],
    paths: [
      [{ x: -70, y: 300 }, { x: 200, y: 320 }, { x: 430, y: 380 }, { x: 640, y: 430 }, { x: 810, y: 470 }],
      [{ x: 1670, y: 640 }, { x: 1400, y: 620 }, { x: 1160, y: 570 }, { x: 950, y: 510 }, { x: 810, y: 470 }]
    ],
    landmark: { t: 'bridgeTower', x: 760, y: 250, s: .9, clear: 240 },
    lights: [{ x: 760, y: 300, r: 320, s: .55, c: '#ffd08a' }],
    pool: [E('rat', 0, 3), E('pigeon', 0, 1.8), E('roach', 0, 2), E('gull', .26, 1.8),
           E('raccoon', .34, 1.6), E('bedbug', .46, 1.3), E('drone', .62, 1.2), E('hawk', .8, 1)],
    boss: 'b_flock'
  }),

  /* ---------- 4. WALL STREET ---------- */
  mkLevel({
    id: 3, name: 'Wall Street', borough: 'Financial District', mood: 'gold',
    blurb: 'Streets laid out by seventeenth-century cows, canyons of stone twenty storeys deep, and not one ray of sun at street level. Whatever is nesting in the vaults has learned to take the shortest possible route.',
    ground: 'cobble', night: .35, weather: 'fog', season: 'summer',
    lives: 20, gold: 400, waveCount: 13, roadW: 58,
    pal: {
      ground: '#5a5750', road: '#33302b', roadLine: '#d8cba0', curb: '#6e6a60',
      bldg: ['#4a4740', '#5c584f', '#3d3a34', '#6b665b'], sky: '#5f6b7d',
      grade: '#6b6f80', nightTint: '#151a26', lampCol: '#ffe0a8'
    },
    buildSeed: 4004, cityDensity: 52, heightMul: 1.9,
    bldgStyles: ['stone', 'castiron', 'glass'],
    propSet: ['lamp', 'hydrant', 'planter', 'car', 'trash'],
    paths: [[
      { x: -70, y: 760 }, { x: 200, y: 760 }, { x: 260, y: 560 }, { x: 480, y: 520 },
      { x: 540, y: 300 }, { x: 760, y: 250 }, { x: 830, y: 460 }, { x: 1060, y: 500 },
      { x: 1120, y: 700 }, { x: 1340, y: 740 }, { x: 1400, y: 560 }, { x: 1380, y: 400 }
    ]],
    landmark: { t: 'flatiron', x: 980, y: 180, s: 1, clear: 200 },
    pool: [E('rat', 0, 2.4), E('roach', 0, 2), E('bedbug', .2, 1.8), E('raccoon', .3, 1.6),
           E('squirrel', .16, 1.4), E('elmo', .46, 1.2), E('gator', .62, 1.2), E('golem', .8, 1)],
    boss: 'b_gatorlord'
  }),

  /* ---------- 5. CHINATOWN ---------- */
  mkLevel({
    id: 4, name: 'Chinatown', borough: 'Lower East Side', mood: 'grit',
    blurb: 'Mott and Doyers, three feet of rain an hour, and lanterns strung so low you have to duck. Two alleys feed the same square and both of them are moving.',
    ground: 'asphalt', night: .78, weather: 'rain', season: 'summer',
    lives: 18, gold: 400, waveCount: 13, roadW: 52,
    pal: {
      ground: '#2e3138', road: '#24272d', roadLine: '#d8c26a', curb: '#484c55',
      bldg: ['#5c3b33', '#6b4a3a', '#43312c', '#7a5240'], sky: '#20283a',
      grade: '#4a3d52', nightTint: '#101426', lampCol: '#ff8a5c'
    },
    buildSeed: 5005, cityDensity: 50, heightMul: .9,
    bldgStyles: ['brick', 'brownstone'],
    propSet: ['lantern', 'trash', 'hydrant', 'cone', 'news'],
    paths: [
      [{ x: -70, y: 130 }, { x: 220, y: 180 }, { x: 330, y: 350 }, { x: 260, y: 520 },
       { x: 400, y: 640 }, { x: 620, y: 660 }, { x: 780, y: 560 }],
      [{ x: 1670, y: 250 }, { x: 1400, y: 230 }, { x: 1230, y: 340 }, { x: 1250, y: 520 },
       { x: 1080, y: 640 }, { x: 900, y: 620 }, { x: 780, y: 560 }]
    ],
    props: [
      { t: 'lantern', x: 520, y: 300, s: 1.2 }, { t: 'lantern', x: 1000, y: 300, s: 1.2 },
      { t: 'lantern', x: 700, y: 800, s: 1.2 }
    ],
    lights: [{ x: 520, y: 300, r: 150, s: .5, c: '#ff5b45' }, { x: 1000, y: 300, r: 150, s: .5, c: '#ff5b45' }],
    pool: [E('roach', 0, 3), E('rat', 0, 2.6), E('bedbug', .14, 2.2), E('pizzarat', .3, 1.8),
           E('squirrel', .22, 1.4), E('raccoon', .42, 1.4), E('tourist', .56, 1.2), E('gator', .72, 1.2)],
    boss: 'b_ratking'
  }),

  /* ---------- 6. CONEY ISLAND ---------- */
  mkLevel({
    id: 5, name: 'Coney Island', borough: 'South Brooklyn', mood: 'neon',
    blurb: 'End of the F train, end of the world. The gulls out here have been stealing food from human hands for a century and they have absolutely no fear left in them. Boardwalk runs long and straight — use it.',
    ground: 'boardwalk', night: .62, weather: 'clear', season: 'summer',
    lives: 20, gold: 420, waveCount: 14, roadW: 60,
    pal: {
      ground: '#8a6a45', road: '#4a3d2c', roadLine: '#e8d9a8', curb: '#6b5a42',
      bldg: ['#3d4658', '#4a5468', '#5c4a58', '#2f3a4a'], sky: '#3a2f5c',
      grade: '#6b4a7a', nightTint: '#150e28', lampCol: '#ffb04d'
    },
    buildSeed: 6006, cityDensity: 24, cityEdgeOnly: true, heightMul: .7,
    bldgStyles: ['brick', 'stone'],
    propSet: ['lamp', 'bench', 'trash', 'cone'],
    paths: [[
      { x: -70, y: 640 }, { x: 200, y: 660 }, { x: 380, y: 580 }, { x: 560, y: 640 },
      { x: 740, y: 700 }, { x: 920, y: 640 }, { x: 1100, y: 560 }, { x: 1280, y: 600 },
      { x: 1420, y: 700 }, { x: 1400, y: 820 }, { x: 1160, y: 840 }, { x: 980, y: 820 }
    ]],
    landmark: { t: 'wonderwheel', x: 400, y: 330, s: 1, clear: 250 },
    props: [{ t: 'newsstand', x: 1080, y: 300, s: 1 }],
    lights: [{ x: 400, y: 220, r: 300, s: .7, c: '#ff4d6d' }, { x: 1150, y: 230, r: 260, s: .6, c: '#4de0ff' }],
    extraLandmark: { t: 'coaster', x: 1080, y: 320, s: 1 },
    pool: [E('gull', 0, 2.2), E('pigeon', 0, 1.8), E('rat', 0, 2.8), E('roach', 0, 2.2),
           E('pizzarat', .3, 1.6), E('raccoon', .4, 1.6), E('drone', .56, 1.3), E('hawk', .72, 1.1), E('tourist', .5, 1)],
    boss: 'b_flock'
  }),

  /* ---------- 7. HARLEM ---------- */
  mkLevel({
    id: 6, name: 'Harlem', borough: 'Uptown Manhattan', mood: 'gold',
    blurb: 'One-Two-Five Street on a Saturday night, brownstones shoulder to shoulder, the Apollo marquee throwing red light down the whole block. They are coming up Frederick Douglass and across from Lenox at the same time.',
    ground: 'asphalt', night: .70, weather: 'clear', season: 'autumn',
    lives: 20, gold: 440, waveCount: 14, roadW: 62,
    pal: {
      ground: '#2f3239', road: '#26292f', roadLine: '#e0cf6a', curb: '#4c515a',
      bldg: ['#6b4438', '#7a5040', '#553a30', '#8a5c46'], sky: '#25203a',
      grade: '#5a4050', nightTint: '#120e20', lampCol: '#ffc26a'
    },
    buildSeed: 7007, cityDensity: 48, heightMul: .85,
    bldgStyles: ['brownstone', 'brick'],
    propSet: ['lamp', 'trash', 'hydrant', 'car', 'tree', 'news'],
    paths: [
      [{ x: -70, y: 420 }, { x: 240, y: 430 }, { x: 470, y: 400 }, { x: 640, y: 470 }, { x: 800, y: 560 }],
      [{ x: 830, y: -70 }, { x: 840, y: 180 }, { x: 780, y: 340 }, { x: 800, y: 460 }, { x: 800, y: 560 }]
    ],
    landmark: { t: 'apollo', x: 1180, y: 300, s: 1, clear: 250 },
    lights: [{ x: 1180, y: 300, r: 300, s: .7, c: '#ff4d6d' }],
    pool: [E('rat', 0, 2.4), E('pigeon', 0, 2), E('squirrel', .12, 2), E('raccoon', .26, 1.8),
           E('pizzarat', .34, 1.6), E('elmo', .48, 1.4), E('gator', .6, 1.4), E('drone', .7, 1.2), E('golem', .84, 1)],
    boss: 'b_ratking'
  }),

  /* ---------- 8. GRAND CENTRAL ---------- */
  mkLevel({
    id: 7, name: 'Grand Central', borough: 'Terminal Concourse', mood: 'gold',
    blurb: 'Marble floor, painted sky, seven hundred and fifty thousand people a day and a rat population nobody has ever successfully counted. Three ramps feed the Main Concourse. The apple is under the clock.',
    ground: 'marble', night: .40, weather: 'clear', season: 'summer',
    lives: 18, gold: 460, waveCount: 14, roadW: 56,
    pal: {
      ground: '#9a8f78', road: '#6e6350', roadLine: '#d8c99a', curb: '#b3a88f',
      bldg: ['#8a7d64', '#9c8f76', '#7a6e58'], sky: '#3d5a6b',
      grade: '#8a7d6b', nightTint: '#1a1a14', lampCol: '#ffdc9a'
    },
    buildSeed: 8008, cityDensity: 18, cityEdgeOnly: true, heightMul: 1.1,
    bldgStyles: ['stone'],
    propSet: ['bench', 'planter', 'lamp'],
    paths: [
      [{ x: -70, y: 180 }, { x: 220, y: 220 }, { x: 420, y: 340 }, { x: 620, y: 430 }, { x: 780, y: 500 }],
      [{ x: 1670, y: 200 }, { x: 1380, y: 240 }, { x: 1160, y: 350 }, { x: 950, y: 440 }, { x: 780, y: 500 }],
      [{ x: 800, y: 970 }, { x: 790, y: 800 }, { x: 800, y: 660 }, { x: 780, y: 500 }]
    ],
    landmark: { t: 'terminal', x: 800, y: 150, s: 1, clear: 300 },
    lights: [{ x: 800, y: 200, r: 380, s: .6, c: '#ffdc9a' }],
    pool: [E('rat', 0, 3), E('roach', 0, 2.4), E('pigeon', .1, 2), E('bedbug', .2, 1.8),
           E('tourist', .3, 1.8), E('pizzarat', .4, 1.4), E('elmo', .5, 1.4), E('golem', .68, 1.2), E('drone', .78, 1.2)],
    boss: 'b_titan'
  }),

  /* ---------- 9. SOHO ---------- */
  mkLevel({
    id: 8, name: 'SoHo', borough: 'Cast Iron District', mood: 'grit',
    blurb: 'Belgian block that will break an ankle, cast-iron facades painted the colour of money, and a scaffold that has been up since 2009. Whatever lives behind that sidewalk shed has been growing the whole time.',
    ground: 'cobble', night: .45, weather: 'rain', season: 'autumn',
    lives: 18, gold: 480, waveCount: 15, roadW: 54,
    pal: {
      ground: '#5e5a54', road: '#38352f', roadLine: '#d0c49c', curb: '#6e695f',
      bldg: ['#4a5a55', '#5c6b62', '#6b5a4a', '#3f4a4a'], sky: '#4a5464',
      grade: '#5a6270', nightTint: '#131722', lampCol: '#ffd8a0'
    },
    buildSeed: 9009, cityDensity: 46, heightMul: .95,
    bldgStyles: ['castiron', 'brick'],
    propSet: ['lamp', 'hydrant', 'trash', 'planter', 'cone', 'car'],
    paths: [[
      { x: -70, y: 480 }, { x: 180, y: 470 }, { x: 300, y: 250 }, { x: 540, y: 190 },
      { x: 760, y: 260 }, { x: 830, y: 470 }, { x: 700, y: 660 }, { x: 480, y: 720 },
      { x: 330, y: 830 }, { x: 500, y: 880 }, { x: 900, y: 850 }, { x: 1180, y: 740 },
      { x: 1300, y: 540 }, { x: 1220, y: 340 }
    ]],
    props: [
      { t: 'scaffold', x: 620, y: 430, s: 1, len: 240, rot: 0 },
      { t: 'scaffold', x: 1000, y: 200, s: 1, len: 180, rot: .2 }
    ],
    pool: [E('roach', 0, 2.6), E('rat', 0, 2.4), E('bedbug', .12, 2), E('squirrel', .2, 1.8),
           E('raccoon', .3, 1.8), E('pizzarat', .4, 1.4), E('gator', .52, 1.4), E('golem', .64, 1.6), E('drone', .76, 1.2)],
    boss: 'b_titan'
  }),

  /* ---------- 10. LIBERTY ISLAND ---------- */
  mkLevel({
    id: 9, name: 'Liberty Island', borough: 'New York Harbor', mood: 'harbor',
    blurb: 'Twelve acres of fill in the middle of the harbour with one very famous copper woman on it. They are swimming in. Some of them are flying in. There is no third exit.',
    ground: 'water', night: .18, weather: 'clear', season: 'summer',
    lives: 16, gold: 580, waveCount: 15, roadW: 66,
    /* the route is the seawall causeway, not open water — it has to read */
    pal: {
      ground: '#2a5470', road: '#6e7466', roadLine: '#d8d2b0', curb: '#9aa483',
      bldg: ['#5a6b6b', '#6b7a72', '#4a5a5a'], sky: '#7fb0d8',
      grade: '#6b8fa8', nightTint: '#0d1c2c', lampCol: '#ffe0b0'
    },
    buildSeed: 10010, cityDensity: 14, cityEdgeOnly: true, heightMul: 1.2,
    bldgStyles: ['stone'],
    propSet: ['lamp', 'bench'],
    paths: [
      [{ x: -80, y: 250 }, { x: 200, y: 300 }, { x: 420, y: 400 }, { x: 600, y: 520 }, { x: 740, y: 610 }],
      [{ x: 1680, y: 340 }, { x: 1400, y: 380 }, { x: 1160, y: 450 }, { x: 940, y: 540 }, { x: 740, y: 610 }]
    ],
    landmark: { t: 'liberty', x: 810, y: 300, s: 1, clear: 260 },
    props: [{ t: 'ferry', x: 300, y: 800, s: 1 }],
    pool: [E('gull', 0, 2), E('pigeon', 0, 1.7), E('rat', 0, 2.8), E('roach', 0, 2.2),
           E('drone', .3, 1.7), E('hawk', .42, 1.6), E('gator', .48, 1.6), E('golem', .68, 1.2), E('elmo', .58, 1)],
    boss: 'b_flock'
  }),

  /* ---------- 11. YANKEE STADIUM ---------- */
  mkLevel({
    id: 10, name: 'Yankee Stadium', borough: 'The Bronx', mood: 'gold',
    blurb: 'Bottom of the ninth and the field is full of things that are not baseball players. The frieze is intact, the lights are on, and the warning track runs all the way around — which means so do they.',
    ground: 'field', night: .80, weather: 'clear', season: 'summer',
    lives: 20, gold: 520, waveCount: 15, roadW: 60,
    pal: {
      ground: '#2f5c30', road: '#8a6b45', roadLine: '#e8dcc0', curb: '#3d6b3c',
      bldg: ['#4a4f58', '#5a606b', '#3d424a'], sky: '#1a2438',
      grade: '#4a5a5a', nightTint: '#0c1420', lampCol: '#fff2c8'
    },
    buildSeed: 11011, cityDensity: 20, cityEdgeOnly: true, heightMul: .8,
    bldgStyles: ['stone'],
    propSet: ['lamp', 'bench', 'cone'],
    paths: [
      [{ x: -70, y: 700 }, { x: 200, y: 760 }, { x: 440, y: 780 }, { x: 660, y: 740 }, { x: 800, y: 660 }],
      [{ x: 1670, y: 700 }, { x: 1400, y: 770 }, { x: 1150, y: 790 }, { x: 950, y: 740 }, { x: 800, y: 660 }]
    ],
    landmark: { t: 'stadium', x: 800, y: 330, s: 1, clear: 340 },
    pool: [E('rat', 0, 2.6), E('pigeon', 0, 1.9), E('squirrel', .1, 2), E('gull', .24, 1.7),
           E('raccoon', .26, 1.8), E('hawk', .48, 1.5), E('gator', .5, 1.6), E('golem', .62, 1.6),
           E('drone', .72, 1.4), E('elmo', .8, 1.2)],
    boss: 'b_gatorlord'
  }),

  /* ---------- 12. FLUSHING MEADOWS ---------- */
  mkLevel({
    id: 11, name: 'Flushing Meadows', borough: 'Queens', mood: 'park',
    blurb: 'Two World’s Fairs left their bones here and the Unisphere still turns in the middle of it. Late October, the leaves are down, and something has been living inside the New York State Pavilion.',
    ground: 'grass', night: .30, weather: 'leaves', season: 'autumn',
    lives: 18, gold: 540, waveCount: 15, roadW: 58,
    pal: {
      ground: '#4a5a2e', road: '#5c5240', roadLine: '#c8bc94', curb: '#6b6b48',
      bldg: ['#6b5a48', '#7a6a55', '#544838'], sky: '#a08a6a',
      grade: '#8a7a5a', nightTint: '#15181f', lampCol: '#ffd08a'
    },
    buildSeed: 12012, cityDensity: 24, cityEdgeOnly: true, heightMul: 1.0,
    bldgStyles: ['stone', 'brick'],
    propSet: ['tree', 'bench', 'lamp', 'planter'],
    paths: [
      [{ x: -70, y: 160 }, { x: 260, y: 200 }, { x: 400, y: 400 }, { x: 380, y: 620 }, { x: 560, y: 740 }, { x: 760, y: 720 }],
      [{ x: 1670, y: 180 }, { x: 1340, y: 220 }, { x: 1200, y: 420 }, { x: 1220, y: 630 }, { x: 1010, y: 750 }, { x: 760, y: 720 }]
    ],
    landmark: { t: 'unisphere', x: 800, y: 400, s: 1, clear: 250 },
    props: [
      { t: 'tree', x: 180, y: 640, s: 42 }, { t: 'tree', x: 1440, y: 620, s: 44 },
      { t: 'tree', x: 640, y: 120, s: 40 }, { t: 'tree', x: 1000, y: 140, s: 38 }
    ],
    pool: [E('squirrel', 0, 2.6), E('rat', 0, 2), E('raccoon', .12, 2), E('pigeon', .1, 1.8),
           E('hawk', .3, 1.6), E('gator', .4, 1.6), E('drone', .5, 1.6), E('golem', .6, 1.6),
           E('elmo', .68, 1.4), E('tourist', .3, 1.4)],
    boss: 'b_gatorlord'
  }),

  /* ---------- 13. STATEN ISLAND FERRY ---------- */
  mkLevel({
    id: 12, name: 'St. George Terminal', borough: 'Staten Island', mood: 'harbor',
    blurb: 'Six in the morning, fog thick enough to lean on, the orange boat pulling in and something disembarking that did not buy a ticket. You cannot see past the second slip. Build tight.',
    ground: 'concrete', night: .55, weather: 'fog', season: 'winter',
    lives: 16, gold: 560, waveCount: 16, roadW: 58,
    pal: {
      ground: '#54595f', road: '#3a3e44', roadLine: '#c8ccd2', curb: '#666c74',
      bldg: ['#4a5058', '#585f68', '#3d434a'], sky: '#6b7580',
      grade: '#6b7480', nightTint: '#1c2430', lampCol: '#9fb4cc'
    },
    buildSeed: 13013, cityDensity: 32, heightMul: .9,
    bldgStyles: ['stone', 'glass'],
    propSet: ['lamp', 'bench', 'cone', 'trash'],
    paths: [
      [{ x: -70, y: 560 }, { x: 220, y: 520 }, { x: 330, y: 300 }, { x: 560, y: 230 },
       { x: 700, y: 380 }, { x: 660, y: 560 }, { x: 800, y: 680 }],
      [{ x: 1670, y: 520 }, { x: 1380, y: 490 }, { x: 1260, y: 290 }, { x: 1040, y: 230 },
       { x: 900, y: 380 }, { x: 940, y: 560 }, { x: 800, y: 680 }]
    ],
    props: [{ t: 'ferry', x: 800, y: 120, s: 1.1 }],
    lights: [{ x: 800, y: 140, r: 220, s: .34, c: '#ffb04d' }],
    pool: [E('gull', 0, 2.6), E('rat', 0, 2), E('roach', 0, 1.8), E('bedbug', .14, 1.8),
           E('drone', .26, 1.8), E('hawk', .36, 1.8), E('gator', .46, 1.6), E('golem', .56, 1.8),
           E('raccoon', .2, 1.4), E('elmo', .66, 1.2), E('tourist', .3, 1.2)],
    boss: 'b_titan'
  }),

  /* ---------- 14. MIDTOWN ROOFTOPS ---------- */
  mkLevel({
    id: 13, name: 'Midtown Rooftops', borough: 'Above 34th Street', mood: 'neon',
    blurb: 'Eight hundred feet up, in a thunderstorm, on a tar roof, in the shadow of the Empire State. They came up the fire escapes. All of them. There is nowhere left below to retreat to.',
    ground: 'concrete', night: .95, weather: 'rain', season: 'summer',
    lives: 15, gold: 600, waveCount: 16, roadW: 56,
    pal: {
      ground: '#3a3d44', road: '#2b2e34', roadLine: '#d8d2b0', curb: '#4e535c',
      bldg: ['#2f3542', '#3a404e', '#454c5c', '#262c38'], sky: '#101828',
      grade: '#3d4460', nightTint: '#080e1c', lampCol: '#9ad0ff'
    },
    buildSeed: 14014, cityDensity: 56, heightMul: 2.1,
    bldgStyles: ['glass', 'stone'],
    propSet: ['cone', 'trash', 'lamp'],
    paths: [[
      { x: -70, y: 360 }, { x: 200, y: 330 }, { x: 400, y: 430 }, { x: 350, y: 620 },
      { x: 540, y: 740 }, { x: 780, y: 760 }, { x: 980, y: 680 }, { x: 1080, y: 500 },
      { x: 980, y: 330 }, { x: 780, y: 260 }, { x: 600, y: 300 }, { x: 520, y: 460 },
      { x: 640, y: 570 }, { x: 800, y: 540 }
    ]],
    landmark: { t: 'empire', x: 1340, y: 260, s: 1, clear: 240 },
    lights: [{ x: 1340, y: 200, r: 340, s: .6, c: '#9ad0ff' }],
    pool: [E('rat', 0, 2.4), E('pigeon', 0, 2), E('drone', .14, 2.2), E('gull', .18, 1.8),
           E('bedbug', .16, 1.6), E('hawk', .3, 1.8), E('golem', .4, 1.8), E('gator', .48, 1.6),
           E('elmo', .56, 1.4), E('tourist', .3, 1.2), E('pizzarat', .2, 1.2)],
    boss: 'b_titan'
  }),

  /* ---------- 15. THE TUNNELS ---------- */
  mkLevel({
    id: 14, name: 'The Tunnels', borough: 'Beneath It All', mood: 'deep',
    blurb: 'Under the Chambers Street lower level there is a platform that was sealed in 1918 and never appeared on a map again. Everything you have fought came from down here. This is where it lives. Three tunnel mouths. No daylight. Last stand.',
    ground: 'tunnel', night: 1.0, weather: 'clear', season: 'winter',
    lives: 25, gold: 700, waveCount: 18, roadW: 58, roadStyle: 'track',
    pal: {
      ground: '#232830', road: '#1a1e25', roadLine: '#8a8f98', curb: '#3a4049',
      bldg: ['#2a3038', '#343b45', '#22282f'], sky: '#0a0e15',
      grade: '#2a3040', nightTint: '#04070d', lampCol: '#6ee08a'
    },
    buildSeed: 15015, cityDensity: 30, heightMul: .5,
    bldgStyles: ['stone', 'brick'],
    propSet: ['lamp', 'cone', 'trash'],
    paths: [
      [{ x: -80, y: 200 }, { x: 220, y: 240 }, { x: 420, y: 380 }, { x: 620, y: 470 }, { x: 790, y: 540 }],
      [{ x: 1680, y: 240 }, { x: 1380, y: 280 }, { x: 1180, y: 400 }, { x: 970, y: 480 }, { x: 790, y: 540 }],
      [{ x: 800, y: 980 }, { x: 810, y: 820 }, { x: 790, y: 690 }, { x: 790, y: 540 }]
    ],
    landmark: { t: 'tunnelMouth', x: 800, y: 120, s: 1, clear: 200 },
    lights: [
      { x: 300, y: 300, r: 170, s: .55, c: '#6ee08a' },
      { x: 1300, y: 320, r: 170, s: .55, c: '#6ee08a' },
      { x: 800, y: 820, r: 170, s: .55, c: '#6ee08a' }
    ],
    pool: [E('rat', 0, 3), E('roach', 0, 2.6), E('bedbug', 0, 2.2), E('pizzarat', .1, 2),
           E('gator', .26, 2.2), E('golem', .38, 2.2), E('raccoon', .1, 1.6), E('drone', .42, 1.6),
           E('hawk', .46, 1.6), E('elmo', .5, 1.6), E('tourist', .3, 1.4), E('squirrel', .12, 1.4),
           E('gull', .4, 1.2), E('pigeon', .3, 1.2)],
    boss: 'b_bigcheese'
  })
];

/* Coney gets a second landmark drawn manually at bake time.
   Authored in the original 1600x900 space, so scale it like everything else. */
LEVELS[5].onExtra = (x) => ART.LAND.coaster(x, 1080 * SCALE_X, 320 * SCALE_Y, SCALE, LEVELS[5].night);


/* ==========================================================
   CITY POWERS
   ========================================================== */
const ABILITIES = {
  plow:   { name: 'Snow Plow',  cd: 34, dur: 5.5, slow: .62, icon: '\u{1F69B}', aim: false },
  freeze: { name: "Nor'easter", cd: 52, dur: 3.6, icon: '\u{2744}', aim: false },
  blast:  { name: 'Manhole Blast', cd: 40, dmg: 460, radius: 150, icon: '\u{1F4A5}', aim: true }
};
