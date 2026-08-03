/* ============================================================
   DUKE$DEFENSE — ui.js
   Screens, camera control, input, HUD, lobby, and the main loop.
   ============================================================ */
'use strict';

(() => {

  /* VIEW_* is recomputed on every resize, so read it live rather than
     capturing it once. */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const stage = $('#stage');
  const cv    = $('#cv');
  const ctx   = cv.getContext('2d', { alpha: false });

  let dpr = 1;
  let curLevel = -1;
  let running = false;
  let last = 0;
  let G = null;
  let coopMode = false;

  const keys = {};

  /* ==========================================================
     CANVAS
     ========================================================== */
  /* The canvas fills the window. Its LOGICAL size follows the window's
     aspect ratio, so a phone held upright gets a tall playfield instead of
     a letterboxed sliver. */
  function resize() {
    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(320, window.innerHeight);
    setViewport(vw, vh);

    const heavy = VIEW_W * VIEW_H > 1500000;
    dpr = Math.min(window.devicePixelRatio || 1, heavy ? 1.25 : 2);

    cv.style.width = vw + 'px';
    cv.style.height = vh + 'px';
    cv.width = Math.floor(VIEW_W * dpr);
    cv.height = Math.floor(VIEW_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    document.body.classList.toggle('portrait', vh > vw);

    if (G) {
      G.cam.updateViewport();
      Render.initWeather(G.level.weather);
    }
    reportInset();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  /* tell the renderer how much of the bottom the dock is eating, in
     logical canvas units, so the minimap always clears it */
  function reportInset() {
    const dock = $('#dock');
    const hud = $('#hud');
    const cssH = Math.max(1, cv.getBoundingClientRect().height);
    const px2logical = VIEW_H / cssH;
    const dockCss = (dock && !dock.classList.contains('hidden'))
      ? dock.getBoundingClientRect().height : 12;
    const bottom = dockCss * px2logical + 8;
    const top = (hud && !hud.classList.contains('hidden'))
      ? hud.getBoundingClientRect().height * px2logical : 20;
    Render.setInset({ bottom, top });

    /* the camera fits the board into the space BETWEEN the bars, so the
       full playfield is reachable without anything hiding under the UI */
    if (G && G.cam) G.cam.setPads(top, bottom);

    /* park the zoom cluster just above the minimap */
    const mm = Render.minimapRect();
    const z = $('#zoomctl');
    if (z) z.style.bottom = (dockCss + (mm.h / px2logical) + 26) + 'px';
  }

  function canvasPoint(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    return { x: (clientX - r.left) * (VIEW_W / r.width), y: (clientY - r.top) * (VIEW_H / r.height) };
  }

  /* How many WORLD units correspond to `cssPx` on the physical screen right
     now. Hit targets are sized with this so a supply drop stays thumb-sized
     whether you are zoomed all the way out on a phone or right in on a
     monitor. */
  function worldPerCss(cssPx) {
    const r = cv.getBoundingClientRect();
    const logicalPerCss = VIEW_W / Math.max(1, r.width);
    return cssPx * logicalPerCss / (G ? G.cam.z : 1);
  }
  let lastPointerTouch = false;
  /* 44 CSS px under a thumb — drops expire, and grabbing the nearest one is
     almost always what a tap near it meant. */
  const grabRadius = () => Math.max(40, worldPerCss(lastPointerTouch ? 44 : 24));
  function toWorld(clientX, clientY) {
    const p = canvasPoint(clientX, clientY);
    return G.cam.toWorld(p.x, p.y);
  }

  /* ==========================================================
     SCREENS + TOASTS
     ========================================================== */
  function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }
  function hideAll() { $$('.screen').forEach(s => s.classList.remove('active')); }

  function toast(msg, kind, big) {
    const wrap = $('#toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '') + (big ? ' big' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    while (wrap.children.length > 4) wrap.firstChild.remove();
  }

  /* ==========================================================
     TITLE BACKDROP
     ========================================================== */
  const tcv = $('#titlecv');
  const tctx = tcv.getContext('2d');
  let titleT = 0, skyline = null;

  function buildSkyline(w, h) {
    const layers = [];
    for (let L = 0; L < 3; L++) {
      const s = U.surface(w, h);
      const x = s.x;
      const r = U.rng(7000 + L * 91);
      const base = h * (.62 + L * .13);
      const col = ['#0d1220', '#151d2e', '#1e2740'][L];
      let px = -10;
      while (px < w + 10) {
        const bw = 26 + r() * 74;
        const bh = (50 + r() * 260) * (1 - L * .22);
        x.fillStyle = col;
        x.fillRect(px, base - bh, bw - 3, bh + h);
        for (let wy = base - bh + 10; wy < base - 6; wy += 14) {
          for (let wx2 = px + 6; wx2 < px + bw - 9; wx2 += 12) {
            if (r() < .34) {
              x.fillStyle = U.rgba(255, 205, 120, .25 + r() * .55);
              x.fillRect(wx2, wy, 5, 7);
            }
          }
        }
        if (r() < .22) {
          x.fillStyle = '#2a1d12';
          x.fillRect(px + bw * .3, base - bh - 18, 14, 14);
          x.beginPath();
          x.moveTo(px + bw * .3 - 3, base - bh - 18);
          x.lineTo(px + bw * .3 + 7, base - bh - 28);
          x.lineTo(px + bw * .3 + 17, base - bh - 18);
          x.closePath(); x.fill();
        }
        px += bw;
      }
      layers.push(s.c);
    }
    return layers;
  }

  function titleFrame(dt) {
    const w = tcv.clientWidth, h = tcv.clientHeight;
    if (tcv.width !== w || tcv.height !== h) { tcv.width = w; tcv.height = h; skyline = buildSkyline(w + 200, h); }
    if (!skyline) return;
    titleT += dt;
    const x = tctx;

    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#070b16'); g.addColorStop(.45, '#111a2e');
    g.addColorStop(.8, '#2a2340'); g.addColorStop(1, '#3c2a3a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);

    const mg = x.createRadialGradient(w * .78, h * .18, 0, w * .78, h * .18, h * .5);
    mg.addColorStop(0, U.rgba(255, 230, 190, .16)); mg.addColorStop(1, U.rgba(255, 230, 190, 0));
    x.fillStyle = mg; x.fillRect(0, 0, w, h);

    skyline.forEach((c, i) => x.drawImage(c, -((titleT * (3 + i * 5)) % 200), 0));

    const px = ((titleT * 26) % (w + 200)) - 100;
    x.fillStyle = Math.sin(titleT * 6) > 0 ? '#ff5a4a' : '#5a1a14';
    x.beginPath(); x.arc(px, h * .16, 2.2, 0, U.TAU); x.fill();

    x.strokeStyle = U.rgba(170, 200, 235, .16); x.lineWidth = 1;
    x.beginPath();
    for (let i = 0; i < 160; i++) {
      const rx = (i * 137.5 + titleT * 60) % (w + 100) - 50;
      const ry = (i * 79.3 + titleT * 700) % (h + 60) - 30;
      x.moveTo(rx, ry); x.lineTo(rx - 5, ry + 22);
    }
    x.stroke();

    const sg = x.createLinearGradient(0, h * .72, 0, h);
    sg.addColorStop(0, U.rgba(255, 160, 60, 0)); sg.addColorStop(1, U.rgba(255, 150, 50, .22));
    x.fillStyle = sg; x.fillRect(0, h * .72, w, h * .28);

    x.save();
    x.globalCompositeOperation = 'multiply';
    const v = x.createRadialGradient(w / 2, h / 2, h * .25, w / 2, h / 2, h * 1.1);
    v.addColorStop(0, '#ffffff'); v.addColorStop(1, '#454c66');
    x.fillStyle = v; x.fillRect(0, 0, w, h);
    x.restore();
  }

  /* ==========================================================
     DISTRICT GRID
     ========================================================== */
  function buildGrid() {
    const grid = $('#levelgrid');
    grid.innerHTML = '';
    const unlocked = Save.unlocked();
    let cleared = 0;

    LEVELS.forEach((L, i) => {
      const stars = Save.stars(L.id);
      if (stars > 0) cleared++;
      const locked = i >= unlocked;

      const card = document.createElement('div');
      card.className = 'lvl' + (locked ? ' locked' : '') + (stars > 0 ? ' cleared' : '');

      const c = ART.thumb(L, 300, 188);
      c.style.width = '100%'; c.style.height = '100%';
      card.appendChild(c);

      const veil = document.createElement('div'); veil.className = 'veil'; card.appendChild(veil);
      const num = document.createElement('div'); num.className = 'num';
      num.textContent = String(i + 1).padStart(2, '0'); card.appendChild(num);

      if (stars > 0) {
        const flag = document.createElement('div'); flag.className = 'flag';
        flag.textContent = 'HELD'; card.appendChild(flag);
      }

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML =
        `<div class="boro">${L.borough}</div><h3>${L.name}</h3>` +
        `<div class="st">${[0, 1, 2].map(k => `<span class="${k < stars ? 'on' : ''}">&#9733;</span>`).join('')}</div>`;
      card.appendChild(meta);

      if (locked) {
        const lk = document.createElement('div'); lk.className = 'lock';
        lk.innerHTML = '&#128274;'; card.appendChild(lk);
      }

      card.addEventListener('click', () => {
        Audio2.unlock();
        if (locked) { Audio2.play('error'); toast('HOLD THE PREVIOUS DISTRICT FIRST', 'bad'); return; }
        Audio2.play('ui'); openBrief(i);
      });
      grid.appendChild(card);
    });

    $('#m-progress').textContent = `${cleared} / ${LEVELS.length} districts held`;
    $('#m-stars').textContent = Save.totalStars();
  }

  /* ==========================================================
     BRIEFING
     ========================================================== */
  let briefIdx = 0;
  function openBrief(i) {
    briefIdx = i;
    const L = LEVELS[i];
    $('#b-borough').textContent = L.borough;
    $('#b-name').textContent = L.name;
    $('#b-blurb').textContent = L.blurb;
    $('#b-waves').textContent = L.waves.length;
    $('#b-lives').textContent = L.lives;
    $('#b-gold').textContent = U.fmtMoney(L.gold);
    $('#b-weather').textContent = ({
      clear: L.night > .6 ? 'NIGHT' : 'CLEAR', rain: 'HEAVY RAIN',
      snow: 'SNOW', fog: 'DENSE FOG', leaves: 'AUTUMN WIND'
    })[L.weather] || 'CLEAR';

    const box = $('#b-threats');
    box.innerHTML = '';
    L.threats.forEach(t => {
      const d = ENEMIES[t];
      const el = document.createElement('div');
      el.className = 'threat' + (d.boss ? ' boss' : '');
      el.innerHTML = `<span>${d.icon}</span>${d.name}`;
      box.appendChild(el);
    });
    show('scr-brief');
  }

  /* ==========================================================
     WEAPON TRAY
     ========================================================== */
  const TRAY_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

  function buildTray() {
    const tray = $('#tray');
    tray.innerHTML = '';
    TOWER_ORDER.forEach((id, i) => {
      const d = TOWERS[id];
      const b = document.createElement('button');
      b.className = 'wpn';
      b.dataset.type = id;
      b.title = d.name + ' — ' + d.blurb;
      b.innerHTML =
        `<span class="w-key">${TRAY_KEYS[i] || ''}</span>` +
        (d.targets === 'both' ? '<span class="w-air">AIR</span>' : '') +
        `<span class="w-ic" style="color:${d.col}">${d.icon}</span>` +
        `<span class="w-name">${d.short}</span>` +
        `<span class="w-cost">$${d.tiers[0].cost}</span>`;
      b.addEventListener('click', () => armWeapon(id));
      tray.appendChild(b);
    });
  }

  function armWeapon(id) {
    if (!G) return;
    Audio2.unlock();
    if (G.ui.buildType === id) { disarm(); return; }
    G.ui.buildType = id;
    G.ui.armed = null;
    G.ui.selected = null;
    G.ui.rangePreview = null;
    hidePanel();
    Audio2.play('ui');
    syncTray();
  }
  function disarm() {
    if (!G) return;
    G.ui.buildType = null;
    G.ui.ghost = null;
    syncTray();
  }
  function syncTray() {
    $$('.wpn').forEach(b => {
      const d = TOWERS[b.dataset.type];
      b.classList.toggle('armed', !!G && G.ui.buildType === b.dataset.type);
      b.classList.toggle('broke', !!G && G.gold < d.tiers[0].cost);
    });
  }

  /* ==========================================================
     WEAPON PANEL
     ========================================================== */
  const panel = document.createElement('div');
  panel.id = 'towerpanel';
  panel.style.cssText = `
    position:absolute; z-index:7; width:238px; display:none;
    background:linear-gradient(180deg,#18202f,#0b111c);
    border:1px solid #2a3448; border-radius:12px;
    box-shadow:0 18px 50px rgba(0,0,0,.7);
    padding:13px; font-family:inherit; color:#e8ecf4;`;
  stage.appendChild(panel);
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  function hidePanel() { panel.style.display = 'none'; }

  function showPanel(t) {
    const s = Game.stat(t);
    const up = Game.upgradeCost(t);
    const nxt = t.tier < 2 ? t.def.tiers[t.tier + 1] : null;
    const sellFor = Math.floor((t.invested || t.def.tiers[0].cost) * .7);
    const AMMO = { ball: 'BALL', ap: 'ARMOUR PIERCING', buck: 'BUCKSHOT', he: 'HIGH EXPLOSIVE', incen: 'INCENDIARY', cryo: 'CRYOGENIC', energy: 'ENERGY' };
    const tg = { ground: 'GROUND ONLY', air: 'AIR ONLY', both: 'GROUND + AIR' }[t.def.targets];
    const dps = s.dps ? s.dps : Math.round(s.dmg * (s.rate || 1) * (s.multi || 1) * (s.pellets || 1));
    /* in co-op you may inspect anyone's kit but only operate your own */
    const mine = !G.coop || t.owner === G.selfId;
    const ownerName = mine ? '' : ((G.peers[t.owner] && G.peers[t.owner].name) || 'SQUADMATE').toUpperCase();

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">
        <div style="font:900 15px/1 Helvetica,Arial;color:${t.def.col};min-width:34px">${t.def.icon}</div>
        <div style="min-width:0">
          <div style="font-size:12.5px;font-weight:900;letter-spacing:.09em">${t.def.name.toUpperCase()}</div>
          <div style="font-size:8.5px;letter-spacing:.2em;color:${t.def.col}">${s.label} &middot; TIER ${t.tier + 1}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#202839;border:1px solid #202839;border-radius:8px;overflow:hidden;margin-bottom:9px">
        <div style="background:#0e1524;padding:7px 9px">
          <div style="font-size:7.5px;letter-spacing:.16em;color:#64708a">${s.dps ? 'DPS' : 'DAMAGE/S'}</div>
          <div style="font-size:15px;font-weight:900">${dps}</div></div>
        <div style="background:#0e1524;padding:7px 9px">
          <div style="font-size:7.5px;letter-spacing:.16em;color:#64708a">RANGE</div>
          <div style="font-size:15px;font-weight:900">${s.range}${s.minRange ? '<span style="font-size:9px;color:#64708a"> min ' + s.minRange + '</span>' : ''}</div></div>
        <div style="background:#0e1524;padding:7px 9px">
          <div style="font-size:7.5px;letter-spacing:.16em;color:#64708a">AMMUNITION</div>
          <div style="font-size:10px;font-weight:800;margin-top:3px">${AMMO[t.def.dtype]}</div></div>
        <div style="background:#0e1524;padding:7px 9px">
          <div style="font-size:7.5px;letter-spacing:.16em;color:#64708a">ENGAGES</div>
          <div style="font-size:10px;font-weight:800;margin-top:3px">${tg}</div></div>
      </div>
      <div style="font-size:7.5px;letter-spacing:.16em;color:#64708a;margin-bottom:5px">TARGET PRIORITY</div>
      <div id="tp-modes" style="display:flex;gap:4px;margin-bottom:10px;${mine ? '' : 'opacity:.4;pointer-events:none'}">
        ${['first', 'last', 'strong', 'close'].map(m => `
          <button data-m="${m}" style="flex:1;height:26px;border-radius:6px;cursor:pointer;
            border:1px solid ${t.mode === m ? '#ffc21a' : '#2a3448'};
            background:${t.mode === m ? 'rgba(255,194,26,.14)' : '#141c2c'};
            color:${t.mode === m ? '#ffc21a' : '#8e99b0'};
            font:800 8px/1 Helvetica,Arial;letter-spacing:.08em">${m.toUpperCase()}</button>`).join('')}
      </div>
      ${!mine ? `
        <div style="text-align:center;font:900 9px/1.5 Helvetica,Arial;letter-spacing:.18em;color:#64708a;padding:12px 0 4px">
          ${ownerName}'S WEAPON<br><span style="font-size:8px;letter-spacing:.12em;color:#4a5468">ONLY THEY CAN UPGRADE OR SELL IT</span>
        </div>` : nxt ? `
        <button id="tp-up" style="width:100%;height:44px;border-radius:9px;margin-bottom:7px;cursor:pointer;
          border:1px solid ${G.gold >= up ? '#8a6410' : '#3a2f18'};
          background:${G.gold >= up ? 'linear-gradient(180deg,#ffd257,#e0a30a)' : '#232a35'};
          color:${G.gold >= up ? '#2a1c00' : '#5c6478'};
          font:900 11px/1.3 Helvetica,Arial;letter-spacing:.1em">
          UPGRADE &rarr; ${nxt.label}<br><span style="font-size:9px">${U.fmtMoney(up)}</span>
        </button>` : `
        <div style="text-align:center;font:900 9px/1 Helvetica,Arial;letter-spacing:.22em;color:#3fdd8f;padding:12px 0 10px">MAXIMUM TIER</div>`}
      ${mine ? `<button id="tp-sell" style="width:100%;height:30px;border-radius:8px;cursor:pointer;
        border:1px solid #4a2028;background:transparent;color:#ff8a95;
        font:800 9px/1 Helvetica,Arial;letter-spacing:.14em">SELL &middot; +${U.fmtMoney(sellFor)}</button>` : ''}`;

    panel.querySelectorAll('#tp-modes button').forEach(b => {
      b.onclick = ev => {
        ev.stopPropagation();
        Game.cmd({ t: 'mode', id: t.id, mode: b.dataset.m });
        t.mode = b.dataset.m; Audio2.play('ui'); showPanel(t);
      };
    });
    const upBtn = panel.querySelector('#tp-up');
    if (upBtn) upBtn.onclick = ev => {
      ev.stopPropagation();
      Game.cmd({ t: 'up', id: t.id });
      setTimeout(() => { if (G && G.towers.includes(t)) showPanel(t); }, 60);
    };
    const sellBtn = panel.querySelector('#tp-sell');
    if (sellBtn) sellBtn.onclick = ev => {
      ev.stopPropagation();
      Game.cmd({ t: 'sell', id: t.id });
      hidePanel(); G.ui.selected = null; G.ui.rangePreview = null;
    };

    const sp = G.cam.toScreen(t.x, t.y);
    const r = cv.getBoundingClientRect();
    const stageR = stage.getBoundingClientRect();
    const sx = r.left - stageR.left + sp.x * (r.width / VIEW_W);
    const sy = r.top - stageR.top + sp.y * (r.height / VIEW_H);
    panel.style.display = 'block';
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    let px = sx + 50, py = sy - 120;
    if (px + pw > stageR.width - 12) px = sx - pw - 50;
    px = U.clamp(px, 12, Math.max(12, stageR.width - pw - 12));
    py = U.clamp(py, 70, Math.max(70, stageR.height - ph - 172));
    panel.style.left = px + 'px';
    panel.style.top = py + 'px';
  }

  /* ==========================================================
     CAMERA + POINTER
     ========================================================== */
  let panning = false, panActive = false, panId = null, panLast = null, panOrigin = null, panMoved = 0, panStart = 0;
  let mmDrag = false;

  function inMinimap(p) {
    const r = Render.minimapRect();
    return p.x >= r.x - 6 && p.x <= r.x + r.w + 6 && p.y >= r.y - 6 && p.y <= r.y + r.h + 6;
  }
  function minimapJump(p) {
    const r = Render.minimapRect();
    G.cam.centerOn(
      U.clamp((p.x - r.x) / r.w, 0, 1) * WORLD_W,
      U.clamp((p.y - r.y) / r.h, 0, 1) * WORLD_H
    );
  }

  cv.addEventListener('wheel', ev => {
    if (!G || !running) return;
    ev.preventDefault();
    const p = canvasPoint(ev.clientX, ev.clientY);
    G.cam.zoomAt(p.x, p.y, ev.deltaY < 0 ? 1.14 : 1 / 1.14);
  }, { passive: false });

  cv.addEventListener('contextmenu', e => e.preventDefault());

  /* two fingers on the glass = pinch zoom */
  const touches = new Map();
  let pinchDist = 0, pinchMid = null;

  function pinchMetrics() {
    const pts = [...touches.values()];
    if (pts.length < 2) return null;
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    return {
      d: Math.hypot(dx, dy),
      mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
    };
  }

  cv.addEventListener('pointerdown', ev => {
    if (!G || !running) return;
    Audio2.unlock();
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    const cp = canvasPoint(ev.clientX, ev.clientY);

    lastPointerTouch = ev.pointerType === 'touch';
    if (ev.pointerType === 'touch') {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touches.size === 2) {
        const m = pinchMetrics();
        pinchDist = m.d; pinchMid = m.mid;
        panning = false;                 /* second finger cancels the pan */
        return;
      }
    }

    if (inMinimap(cp)) { mmDrag = true; minimapJump(cp); return; }

    if (ev.button === 2 || ev.button === 1 || ev.pointerType === 'touch') {
      panning = true; panId = ev.pointerId;
      panLast = { x: ev.clientX, y: ev.clientY };
      panOrigin = { x: ev.clientX, y: ev.clientY };
      panActive = false; panMoved = 0; panStart = performance.now();
      return;
    }
    if (ev.button !== 0) return;
    primaryAction(toWorld(ev.clientX, ev.clientY));
  });

  cv.addEventListener('pointermove', ev => {
    if (!G || !running) return;
    const cp = canvasPoint(ev.clientX, ev.clientY);

    if (ev.pointerType === 'touch' && touches.has(ev.pointerId)) {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touches.size >= 2) {
        const m = pinchMetrics();
        if (m && pinchDist > 0) {
          const r = cv.getBoundingClientRect();
          const anchor = {
            x: (m.mid.x - r.left) * (VIEW_W / r.width),
            y: (m.mid.y - r.top) * (VIEW_H / r.height)
          };
          G.cam.zoomAt(anchor.x, anchor.y, m.d / pinchDist);
          G.cam.z = G.cam.tz;            /* pinch tracks the fingers exactly */
          pinchDist = m.d;
        }
        return;
      }
    }

    if (mmDrag) { minimapJump(cp); return; }

    if (panning && ev.pointerId === panId) {
      /* Hold the camera still until the finger has clearly committed to a
         drag. Otherwise a tap nudges the map out from under itself and the
         thing you were aiming at moves before you let go. */
      const drift = panOrigin ? Math.hypot(ev.clientX - panOrigin.x, ev.clientY - panOrigin.y) : 0;
      const slop = ev.pointerType === 'touch' ? 12 : 3;
      if (!panActive) {
        if (drift < slop) { panLast = { x: ev.clientX, y: ev.clientY }; return; }
        panActive = true;
      }
      const r = cv.getBoundingClientRect();
      const k = VIEW_W / r.width;
      const dx = (ev.clientX - panLast.x) * k, dy = (ev.clientY - panLast.y) * k;
      panMoved += Math.abs(dx) + Math.abs(dy);
      G.cam.panBy(dx, dy);
      G.cam.x = G.cam.tx; G.cam.y = G.cam.ty;
      panLast = { x: ev.clientX, y: ev.clientY };
      return;
    }

    const wp = G.cam.toWorld(cp.x, cp.y);
    G.ui.mouse = wp;

    if (G.ui.buildType) {
      G.ui.ghost = { type: G.ui.buildType, x: wp.x, y: wp.y, valid: Game.placementOk(wp.x, wp.y, G.ui.buildType) };
      cv.style.cursor = 'none';
      return;
    }
    G.ui.ghost = null;

    const t = Game.towerAt(wp.x, wp.y);
    if (t) {
      const st = Game.stat(t);
      G.ui.rangePreview = { x: t.x, y: t.y, r: st.range, min: st.minRange };
      cv.style.cursor = 'pointer';
    } else {
      cv.style.cursor = 'none';
      if (G.ui.selected && G.towers.includes(G.ui.selected)) {
        const st = Game.stat(G.ui.selected);
        G.ui.rangePreview = { x: G.ui.selected.x, y: G.ui.selected.y, r: st.range, min: st.minRange };
      } else G.ui.rangePreview = null;
    }
  });

  function endPointer(ev) {
    if (!G) return;
    const wasPinching = touches.size >= 2;
    touches.delete(ev.pointerId);
    if (wasPinching) { panning = false; pinchDist = 0; return; }

    if (mmDrag) { mmDrag = false; return; }
    if (panning && ev.pointerId === panId) {
      panning = false; panActive = false;
      /* Distance travelled must be judged in real screen pixels, and against
         where the finger STARTED — accumulating every wobble in canvas units
         made an ordinary tap look like a drag and swallowed it. */
      const touch = ev.pointerType === 'touch';
      const drift = panOrigin
        ? Math.hypot(ev.clientX - panOrigin.x, ev.clientY - panOrigin.y) : 0;
      const quick = performance.now() - panStart < (touch ? 500 : 260)
                 && drift < (touch ? 18 : 6);
      if (quick) {
        if (touch) primaryAction(toWorld(ev.clientX, ev.clientY));
        else cancelAll();
      }
    }
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('pointerleave', () => { if (G) G.ui.mouse = null; });

  function cancelAll() {
    if (G.ui.buildType) { disarm(); return; }
    if (G.ui.armed) { G.ui.armed = null; syncAbilities(); return; }
    G.ui.selected = null; G.ui.rangePreview = null; hidePanel();
  }

  /* the single left-click verb */
  function primaryAction(wp) {
    if (G.ui.armed) {
      const name = G.ui.armed;
      if (ABILITIES[name].aim) Game.cmd({ t: 'ab', name, x: Math.round(wp.x), y: Math.round(wp.y) });
      G.ui.armed = null; syncAbilities();
      return;
    }

    if (G.ui.buildType) {
      const type = G.ui.buildType;
      if (!Game.placementOk(wp.x, wp.y, type)) { Audio2.play('error'); toast('NO CLEAR GROUND', 'bad'); return; }
      if (G.gold < TOWERS[type].tiers[0].cost) { Audio2.play('error'); toast('INSUFFICIENT FUNDS', 'bad'); return; }
      Game.cmd({ t: 'build', x: Math.round(wp.x), y: Math.round(wp.y), type });
      return;
    }

    /* Drops are checked before weapons: they expire, so grabbing one is
       always the more urgent thing you meant by that tap. */
    const tol = grabRadius();
    const p = Game.pickupAt(wp.x, wp.y, tol);
    if (p) { Game.cmd({ t: 'grab', id: p.id }); return; }

    const t = Game.towerAt(wp.x, wp.y);
    if (t) {
      G.ui.selected = t;
      const st = Game.stat(t);
      G.ui.rangePreview = { x: t.x, y: t.y, r: st.range, min: st.minRange };
      showPanel(t); Audio2.play('ui');
      return;
    }

    if (G.sidearmCool > 0) return;
    G.sidearmCool = G.sidearmMax;
    Game.cmd({ t: 'shoot', x: Math.round(wp.x), y: Math.round(wp.y), tol: Math.round(tol) });
    G.ui.selected = null; G.ui.rangePreview = null; hidePanel();
  }

  function cameraKeys(dt) {
    if (!G) return;
    const sp = 780 * dt;
    let dx = 0, dy = 0;
    if (keys['a'] || keys['arrowleft']) dx += sp;
    if (keys['d'] || keys['arrowright']) dx -= sp;
    if (keys['w'] || keys['arrowup']) dy += sp;
    if (keys['s'] || keys['arrowdown']) dy -= sp;
    if (dx || dy) G.cam.panBy(dx, dy);
  }

  /* ==========================================================
     HUD
     ========================================================== */
  let lastGold = -1, lastLives = -1;

  function syncHud() {
    if (!G) return;
    const gEl = $('#hud-gold'), lEl = $('#hud-lives');
    const gold = Math.round(G.gold);
    if (gold !== lastGold) {
      lastGold = gold; gEl.textContent = gold;
      gEl.parentElement.classList.remove('flash');
      void gEl.parentElement.offsetWidth;
      gEl.parentElement.classList.add('flash');
      syncTray();
    }
    if (G.lives !== lastLives) {
      lastLives = G.lives; lEl.textContent = G.lives;
      lEl.parentElement.classList.remove('flash');
      void lEl.parentElement.offsetWidth;
      lEl.parentElement.classList.add('flash');
    }
    $('#hud-wave').textContent =
      `${Math.min(Math.max(1, G.wavesSent + (G.state === 'prep' ? 1 : 0)), G.totalWaves)} / ${G.totalWaves}`;
    syncSquadCash();

    const btn = $('#btn-next');
    const canSend = !coopMode || Net.isHost;
    if (G.waveIdx >= G.totalWaves || !canSend) {
      btn.classList.add('disabled');
      btn.querySelector('.nw-main').textContent = G.waveIdx >= G.totalWaves ? 'FINAL WAVE OUT' : 'HOST CONTROLS WAVES';
      $('#nw-bonus').textContent = '0';
    } else {
      btn.classList.remove('disabled');
      btn.querySelector('.nw-main').textContent = `SEND WAVE ${G.waveIdx + 1}  ·  ${Math.max(0, Math.ceil(G.waveTimer))}s`;
      $('#nw-bonus').textContent = Game.earlyBonus();
    }
  }

  function buildPips() {
    const w = $('#wavepips'); w.innerHTML = '';
    G.level.waves.forEach(wv => {
      const el = document.createElement('i');
      if (wv.boss) el.classList.add('boss');
      w.appendChild(el);
    });
  }
  function syncPips() {
    const kids = $('#wavepips').children;
    for (let i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('done', i < G.wavesSent && !!G.level.waves[i]._paid);
      kids[i].classList.toggle('now', i === G.wavesSent - 1 && !G.level.waves[i]._paid);
    }
  }

  function syncAbilities() {
    $$('.ability').forEach(b => {
      const name = b.dataset.ab;
      const cd = G ? G.cd[name] : 0;
      b.querySelector('.ab-cd').style.height = (cd / ABILITIES[name].cd * 100) + '%';
      b.classList.toggle('cooling', cd > 0);
      b.classList.toggle('armed', !!G && G.ui.armed === name);
    });
  }

  function syncSquad() {
    const box = $('#squad');
    box.innerHTML = '';
    if (!coopMode || !G) return;
    for (const id in G.peers) {
      const p = G.peers[id];
      const el = document.createElement('div');
      el.className = 'sq' + (p.host ? ' host' : '');
      el.dataset.pid = id;
      /* each purse is that player's alone, so show it next to their name */
      el.innerHTML = `<i style="background:${p.col}"></i>${p.name}` +
        `<b class="sq-cash" style="margin-left:6px;color:#ffc21a;font-weight:800">$0</b>` +
        `<b class="sq-guns" style="margin-left:5px;color:#64708a;font-weight:700">0</b>`;
      box.appendChild(el);
    }
    syncSquadCash();
  }

  /* cheap enough to run every frame — only touches text nodes that changed */
  function syncSquadCash() {
    if (!coopMode || !G) return;
    const guns = {};
    for (const t of G.towers) guns[t.owner] = (guns[t.owner] || 0) + 1;
    $$('#squad .sq').forEach(el => {
      const id = el.dataset.pid;
      const cash = '$' + Math.round(G.wallets[id] || 0);
      const n = String(guns[id] || 0);
      const c = el.querySelector('.sq-cash'), g = el.querySelector('.sq-guns');
      if (c && c.textContent !== cash) c.textContent = cash;
      if (g && g.textContent !== n) g.textContent = n;
    });
  }

  $$('.ability').forEach(b => {
    b.addEventListener('click', () => {
      if (!G || !running) return;
      Audio2.unlock();
      const name = b.dataset.ab;
      if (G.cd[name] > 0) { Audio2.play('error'); return; }
      if (ABILITIES[name].aim) {
        G.ui.armed = G.ui.armed === name ? null : name;
        disarm(); hidePanel(); G.ui.selected = null;
      } else Game.cmd({ t: 'ab', name });
      syncAbilities();
    });
  });

  $('#btn-next').addEventListener('click', () => {
    if (!G || !running) return;
    if (coopMode && !Net.isHost) { toast('ONLY THE HOST SENDS WAVES', 'warn'); return; }
    Audio2.unlock(); Game.cmd({ t: 'wave' }); syncHud();
  });

  $('#btn-pause').addEventListener('click', () => {
    if (!G) return;
    if (coopMode) { toast('NO PAUSING IN CO-OP', 'warn'); return; }
    G.paused = !G.paused;
    $('#btn-pause').innerHTML = G.paused ? '&#9654;' : '&#10073;&#10073;';
    $('#btn-pause').classList.toggle('hot', G.paused);
  });

  $('#btn-speed').addEventListener('click', () => {
    if (!G) return;
    if (coopMode && !Net.isHost) { toast('ONLY THE HOST SETS SPEED', 'warn'); return; }
    const v = G.speed === 1 ? 2 : (G.speed === 2 ? 3 : 1);
    Game.cmd({ t: 'speed', v });
    G.speed = v;
    $('#btn-speed').textContent = v + '×';
    $('#btn-speed').classList.toggle('hot', v > 1);
    Audio2.play('ui');
  });

  $('#btn-zoomin').addEventListener('click', () => {
    if (G) G.cam.zoomAt(VIEW_W / 2, VIEW_H / 2, 1.28);
  });
  $('#btn-zoomout').addEventListener('click', () => {
    if (G) G.cam.zoomAt(VIEW_W / 2, VIEW_H / 2, 1 / 1.28);
  });

  $('#btn-sound').addEventListener('click', () => {
    const m = Audio2.setMuted(!Audio2.isMuted());
    Save.set('muted', m);
    $('#btn-sound').innerHTML = m ? '&#128263;' : '&#128266;';
    $('#btn-sound').classList.toggle('hot', m);
  });

  $('#btn-quit').addEventListener('click', () => {
    if (!confirm('Withdraw from the district? This run is lost.')) return;
    quitToMap();
  });

  function quitToMap() {
    running = false; G = null;
    stage.classList.remove('on');
    $('#hud').classList.add('hidden');
    $('#dock').classList.add('hidden'); $('#zoomctl').classList.add('hidden');
    $('#netbar').classList.add('hidden');
    $('#chatlog').classList.add('hidden');
    hidePanel();
    Audio2.stopMusic(); Audio2.play('back');
    if (coopMode) { Net.leave(); coopMode = false; }
    buildGrid(); show('scr-map');
  }

  /* ==========================================================
     KEYBOARD
     ========================================================== */
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (document.activeElement === $('#chatbox')) {
      if (k === 'enter') {
        const v = $('#chatbox').value.trim();
        if (v) Net.chat(v);
        $('#chatbox').value = '';
        $('#chatbox').classList.add('hidden');
        $('#chatbox').blur();
      } else if (k === 'escape') {
        $('#chatbox').value = ''; $('#chatbox').classList.add('hidden'); $('#chatbox').blur();
      }
      return;
    }
    if (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (!running || !G) return;

    const ti = TRAY_KEYS.indexOf(e.key);
    if (ti >= 0 && ti < TOWER_ORDER.length) { armWeapon(TOWER_ORDER[ti]); e.preventDefault(); return; }

    if (k === ' ') { e.preventDefault(); $('#btn-pause').click(); }
    else if (k === 'f') $('#btn-speed').click();
    else if (k === 'n') $('#btn-next').click();
    else if (k === 'z') $('#ab-plow').click();
    else if (k === 'x') $('#ab-freeze').click();
    else if (k === 'c') $('#ab-blast').click();
    else if (k === 'q') G.cam.zoomAt(VIEW_W / 2, VIEW_H / 2, 1 / 1.2);
    else if (k === 'e') G.cam.zoomAt(VIEW_W / 2, VIEW_H / 2, 1.2);
    else if (k === 'enter' && coopMode) { $('#chatbox').classList.remove('hidden'); $('#chatbox').focus(); e.preventDefault(); }
    else if (k === 'escape') cancelAll();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  /* ==========================================================
     GAME EVENTS
     ========================================================== */
  function hookEvents() {
    G.onEvent = (type, data) => {
      switch (type) {
        case 'toast': toast(data.msg, data.kind); break;
        case 'boss': toast('BOSS INBOUND', 'bad', true); break;
        case 'crate': toast('SUPPLY DROP ON THE MAP', 'good'); break;
        case 'win': finish(true, data); break;
        case 'lose': finish(false, data); break;
        case 'wavedone': case 'wave': syncPips(); break;
      }
    };
  }

  function finish(won, data) {
    running = false;
    setTimeout(() => {
      const L = LEVELS[curLevel];
      const stars = won ? data.stars : 0;
      if (won) Save.record(L.id, coopMode ? Math.max(1, stars - 1) : stars, LEVELS.length);

      $('#r-banner').textContent = won ? 'DISTRICT HELD' : 'THE APPLE FELL';
      $('#r-banner').classList.toggle('fail', !won);
      $('#r-name').textContent = L.name;
      $$('#r-stars i').forEach((el, i) => el.classList.toggle('on', i < stars));
      $('#r-kills').textContent = data.kills;
      $('#r-lives').textContent = won ? Math.round(data.lives / data.maxLives * 100) + '%' : '0%';
      $('#r-gold').textContent = U.fmtMoney(data.gold);
      $('#r-time').textContent = U.fmtTime(data.time);
      $('#r-side').textContent = data.sidearmKills || 0;
      $('#r-grab').textContent = data.grabbed || 0;

      $('#r-next').style.display = (curLevel + 1 < LEVELS.length && won && !coopMode) ? '' : 'none';
      $('#r-retry').textContent = won ? 'REPLAY' : 'TRY AGAIN';
      $('#r-retry').style.display = coopMode ? 'none' : '';

      stage.classList.remove('on');
      $('#hud').classList.add('hidden');
      $('#dock').classList.add('hidden'); $('#zoomctl').classList.add('hidden');
      $('#netbar').classList.add('hidden');
      $('#chatlog').classList.add('hidden');
      hidePanel();
      show('scr-result');
    }, won ? 1100 : 1500);
  }

  /* ==========================================================
     START A LEVEL
     ========================================================== */
  function startLevel(i, netOpts) {
    curLevel = i;
    const L = LEVELS[i];
    L.waves.forEach(w => { delete w._paid; });

    hideAll(); show('scr-load');
    $('#loadfill').style.width = '0%';
    $('#loadtxt').textContent = 'SURVEYING THE GROUND…';
    Audio2.unlock();

    Game.load(i,
      (p, msg) => {
        $('#loadfill').style.width = Math.round(p * 100) + '%';
        if (msg) $('#loadtxt').textContent = msg + '…';
      },
      state => {
        G = state;
        hookEvents();
        lastGold = -1; lastLives = -1;

        $('#hud-district').textContent = L.name.toUpperCase();
        $('#hud-sub').textContent = L.borough.toUpperCase();
        $('#btn-speed').textContent = '1×';
        $('#btn-speed').classList.remove('hot');
        $('#btn-pause').innerHTML = '&#10073;&#10073;';
        $('#btn-pause').classList.remove('hot');

        buildTray(); buildPips(); syncHud(); syncAbilities(); syncTray(); syncSquad();

        hideAll();
        stage.classList.add('on');
        $('#hud').classList.remove('hidden');
        $('#dock').classList.remove('hidden'); $('#zoomctl').classList.remove('hidden');
        if (coopMode) { $('#netbar').classList.remove('hidden'); $('#chatlog').classList.remove('hidden'); }
        resize();
        /* the dock is laid out now, so the minimap can be placed above it */
        requestAnimationFrame(reportInset);

        if (coopMode) Net.attachToGame();

        Audio2.startMusic(L.mood);
        toast(L.name.toUpperCase(), 'warn', true);
        running = true;
        last = performance.now();
      },
      netOpts || {});
  }

  /* ==========================================================
     CO-OP LOBBY
     ========================================================== */
  let lobbyPlayers = [];

  function fillLevelSelect() {
    const sel = $('#co-level');
    sel.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = String(i + 1).padStart(2, '0') + '  ·  ' + L.name.toUpperCase();
      sel.appendChild(o);
    });
  }

  function renderRoster() {
    const box = $('#co-roster');
    box.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const p = lobbyPlayers[i];
      const el = document.createElement('div');
      el.className = 'rp' + (p ? '' : ' empty');
      el.innerHTML = p
        ? `<i style="background:${p.col}"></i><span class="nm">${p.name}</span>` +
          (p.host ? '<span class="tag host">HOST</span>' : '<span class="tag">READY</span>')
        : `<i style="background:#2a3448"></i><span class="nm">OPEN SLOT</span>`;
      box.appendChild(el);
    }
    $('#co-start').style.display = Net.isHost ? '' : 'none';
    $('#co-waiting').textContent = Net.isHost
      ? 'You are the host: your machine runs the battle for everyone.'
      : 'Waiting for the host to deploy.';
    $('#co-level').disabled = !Net.isHost;
  }

  function lobbyChat(name, msg, col) {
    const box = $('#co-chat');
    const line = document.createElement('div');
    line.innerHTML = `<b style="color:${col || '#8e99b0'}">${name}</b> ${msg}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 60) box.firstChild.remove();
  }

  /* This page was opened over the web (a deployed URL or a tunnel) rather
     than double-clicked as a local file. In that case the server IS this
     origin — the player never needs to type an address. */
  const servedOverWeb = location.protocol === 'http:' || location.protocol === 'https:';

  async function ensureConnected() {
    if (Net.connected) return true;
    const server = servedOverWeb
      ? Net.defaultUrl()
      : ($('#co-server').value.trim() || Net.defaultUrl());
    $('#co-err').textContent = 'CONNECTING…';
    try {
      await Net.connect(server);
      Save.set('lastServer', server);
      $('#co-err').textContent = '';
      return true;
    } catch (e) {
      $('#co-err').textContent = e.message + (servedOverWeb ? '' : ' — IS server.js RUNNING?');
      return false;
    }
  }

  $('#t-coop').addEventListener('click', () => {
    Audio2.unlock(); Audio2.play('ui');
    fillLevelSelect();
    $('#co-name').value = Save.get().name || 'DUKE';
    $('#co-server').value = Save.get().lastServer || Net.defaultUrl();

    /* Hide the server field and the "run server.js" note whenever the page
       is served over the web — a friend who clicked a link just picks
       Host or Join and plays. The plumbing is only surfaced for local
       file:// play, where you genuinely have to point at someone's box. */
    const srvField = $('#co-server').closest('.fld');
    if (srvField) srvField.style.display = servedOverWeb ? 'none' : '';
    const localHint = $('#co-localhint');
    if (localHint) localHint.style.display = servedOverWeb ? 'none' : '';
    const webHint = $('#co-webhint');
    if (webHint) webHint.style.display = servedOverWeb ? '' : 'none';

    $('#coop-connect').classList.remove('hidden');
    $('#coop-room').classList.add('hidden');
    $('#co-joinrow').classList.add('hidden');
    $('#co-err').textContent = '';
    show('scr-coop');
  });

  $('#co-back').addEventListener('click', () => { Net.disconnect(); Audio2.play('back'); show('scr-title'); });
  $('#co-joinbtn').addEventListener('click', () => { $('#co-joinrow').classList.remove('hidden'); $('#co-code').focus(); });

  $('#co-host').addEventListener('click', async () => {
    const name = ($('#co-name').value.trim() || 'DUKE').toUpperCase();
    Save.set('name', name);
    if (!await ensureConnected()) return;
    Net.create(name, 0);
  });

  $('#co-godo').addEventListener('click', async () => {
    const name = ($('#co-name').value.trim() || 'DUKE').toUpperCase();
    /* codes are A-Z / 2-9 (no ambiguous 0,1,I,O); strip anything else a
       friend might have pasted around it */
    const code = $('#co-code').value.toUpperCase().replace(/[^A-Z2-9]/g, '');
    if (code.length !== 4) { $('#co-err').textContent = 'ROOM CODES ARE FOUR CHARACTERS'; return; }
    Save.set('name', name);
    if (!await ensureConnected()) return;
    Net.join(code, name);
  });

  $('#co-copy').addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText($('#co-roomcode').textContent);
    toast('ROOM CODE COPIED', 'good');
  });
  $('#co-leave').addEventListener('click', () => {
    Net.leave();
    $('#coop-room').classList.add('hidden');
    $('#coop-connect').classList.remove('hidden');
  });
  $('#co-level').addEventListener('change', e => { if (Net.isHost) Net.setLevel(parseInt(e.target.value, 10)); });
  $('#co-start').addEventListener('click', () => { Audio2.play('ui'); Net.start(); });
  $('#co-say').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = e.target.value.trim();
      if (v) Net.chat(v);
      e.target.value = '';
    }
  });

  Net.on('joined', m => {
    $('#co-roomcode').textContent = m.code;
    $('#coop-connect').classList.add('hidden');
    $('#coop-room').classList.remove('hidden');
    Audio2.play('build');
  });
  Net.on('joinfail', m => { $('#co-err').textContent = m.why; Audio2.play('error'); });
  Net.on('roster', m => {
    lobbyPlayers = m.players;
    if (!Net.isHost) $('#co-level').value = m.level;
    renderRoster();
    if (running && G) {
      const peers = {};
      m.players.forEach(p => {
        const old = G.peers[p.id];
        peers[p.id] = { name: p.name, col: p.col, host: p.host, self: p.id === Net.selfId, cursor: old ? old.cursor : null };
      });
      G.peers = peers;
      syncSquad();
    }
  });
  Net.on('hostchange', () => {
    renderRoster();
    toast('HOST MIGRATED', 'warn');
    if (running && G) G.netRole = Net.isHost ? 'host' : 'client';
  });
  Net.on('closed', () => {
    if (running) toast('CONNECTION LOST', 'bad');
    $('#coop-room').classList.add('hidden');
    $('#coop-connect').classList.remove('hidden');
    $('#co-err').textContent = 'DISCONNECTED';
  });
  Net.on('chat', m => {
    const p = lobbyPlayers.find(x => x.id === m.id);
    const col = p ? p.col : '#8e99b0';
    if (running) {
      const log = $('#chatlog');
      const line = document.createElement('div');
      line.className = 'line';
      line.innerHTML = `<b style="color:${col}">${m.name}</b> ${m.msg}`;
      log.appendChild(line);
      setTimeout(() => line.remove(), 9000);
      while (log.children.length > 5) log.firstChild.remove();
    } else lobbyChat(m.name, m.msg, col);
  });

  Net.on('start', m => {
    coopMode = true;
    const peers = {};
    m.players.forEach(p => {
      peers[p.id] = { name: p.name, col: p.col, host: p.host, self: p.id === Net.selfId, cursor: null };
    });
    startLevel(m.level, {
      coop: true,
      netRole: Net.isHost ? 'host' : 'client',
      selfId: Net.selfId,
      peers, seed: m.seed
    });
  });

  /* ==========================================================
     MAIN LOOP
     ========================================================== */
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.06, (now - last) / 1000) || 0;
    last = now;

    if ($('#scr-title').classList.contains('active')) { titleFrame(dt); return; }
    if (!running || !G) return;

    cameraKeys(dt);
    G.grabR = grabRadius();          /* renderer draws the reticle at this size */
    Game.update(dt);

    ctx.save();
    ctx.translate(G.shakeX, G.shakeY);
    Render.frame(ctx, G, G.time, dt * (G.paused ? 0 : 1));
    ctx.restore();

    syncHud(); syncAbilities();

    if (coopMode) {
      const nb = $('#netbar');
      nb.classList.toggle('bad', Net.ping > 180 || !Net.connected);
      nb.innerHTML = `${Net.isHost ? 'HOSTING' : 'CLIENT'} &middot; ROOM ${Net.room || '----'} &middot; <b>${Net.ping}ms</b>`;
    }

    if (G.ui.selected && panel.style.display === 'block' && !G.towers.includes(G.ui.selected)) {
      hidePanel(); G.ui.selected = null;
    }
  }

  /* ==========================================================
     WIRING
     ========================================================== */
  $('#t-play').addEventListener('click', () => { Audio2.unlock(); Audio2.play('ui'); coopMode = false; buildGrid(); show('scr-map'); });
  $('#t-how').addEventListener('click', () => { Audio2.unlock(); Audio2.play('ui'); show('scr-how'); });
  $('#how-back').addEventListener('click', () => { Audio2.play('back'); show('scr-title'); });
  $('#t-reset').addEventListener('click', () => {
    if (!confirm('Erase all district progress and stars?')) return;
    Save.reset(); Audio2.play('back'); toast('PROGRESS ERASED', 'bad');
  });

  $('#m-back').addEventListener('click', () => { Audio2.play('back'); show('scr-title'); });
  $('#b-back').addEventListener('click', () => { Audio2.play('back'); show('scr-map'); });
  $('#b-go').addEventListener('click', () => { Audio2.play('ui'); coopMode = false; startLevel(briefIdx); });

  $('#r-map').addEventListener('click', () => {
    Audio2.play('back');
    if (coopMode) { Net.leave(); coopMode = false; }
    buildGrid(); show('scr-map');
  });
  $('#r-retry').addEventListener('click', () => { Audio2.play('ui'); startLevel(curLevel); });
  $('#r-next').addEventListener('click', () => {
    Audio2.play('ui');
    if (curLevel + 1 < LEVELS.length) startLevel(curLevel + 1);
    else { buildGrid(); show('scr-map'); }
  });

  /* boot */
  resize();
  if (Save.get().muted) {
    Audio2.setMuted(true);
    $('#btn-sound').innerHTML = '&#128263;';
    $('#btn-sound').classList.add('hot');
  }
  requestAnimationFrame(t => { last = t; loop(t); });

  const kick = () => {
    Audio2.unlock();
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);

})();
