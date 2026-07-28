/* ============================================================
   DUKE$DEFENSE — net.js
   The client half of co-op.

   The host's browser owns the simulation and pushes snapshots at
   SNAP_HZ. Everyone else sends commands and renders what comes
   back, interpolated. Cursors are gossiped separately at a lower
   rate so you can see where your squad is pointing.
   ============================================================ */
'use strict';

const Net = (() => {

  const SNAP_HZ   = 12;
  const CURSOR_HZ = 10;

  let ws = null;
  let url = '';
  let selfId = null;
  let roomCode = null;
  let isHost = false;
  let players = [];
  let listeners = {};
  let snapTimer = null, cursorTimer = null;
  let ping = 0, pingSentAt = 0;
  let connected = false;

  const on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  const emit = (evt, data) => { (listeners[evt] || []).forEach(f => f(data)); };

  function defaultUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (location.protocol === 'file:') return 'ws://localhost:8177';
    return proto + '//' + location.host;
  }

  function connect(target) {
    url = target || defaultUrl();
    return new Promise((resolve, reject) => {
      try { ws = new WebSocket(url); }
      catch (e) { reject(new Error('BAD SERVER ADDRESS')); return; }

      /* Generous: a free cloud host may be cold and take ~30s to wake. On
         a tunnel or LAN this still resolves the instant the socket opens. */
      const to = setTimeout(() => {
        if (!connected) { try { ws.close(); } catch (e) {} reject(new Error('NO ANSWER FROM SERVER')); }
      }, 40000);

      ws.onopen = () => { connected = true; clearTimeout(to); startPing(); resolve(); };
      ws.onerror = () => { clearTimeout(to); if (!connected) reject(new Error('CANNOT REACH SERVER')); };
      ws.onclose = () => {
        connected = false;
        stopSnapshots(); stopCursor(); stopPing();
        emit('closed', null);
      };
      ws.onmessage = ev => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        route(m);
      };
    });
  }

  function tx(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  /* ---------- inbound ---------- */
  function route(m) {
    switch (m.t) {
      case 'hello':  selfId = m.id; break;
      case 'joined':
        roomCode = m.code; isHost = m.host; selfId = m.you;
        emit('joined', m);
        break;
      case 'joinfail': emit('joinfail', m); break;
      case 'roster':
        players = m.players;
        isHost = !!(players.find(p => p.id === selfId) || {}).host;
        emit('roster', m);
        break;
      case 'left':   emit('left', m); break;
      case 'hostchange':
        isHost = (m.id === selfId);
        emit('hostchange', m);
        if (isHost) startSnapshots();
        break;
      case 'start':  emit('start', m); break;

      case 'cmd': {
        const G = Game.state;
        if (!G) break;
        if (isHost) Game.apply(m.c ? Object.assign(m.c, { by: m.by }) : m);
        else if (m.by !== selfId) {
          /* cosmetic echo only — the snapshot is the truth */
          const c = m.c || m;
          if (c.t === 'ab' || c.t === 'shoot') Game.apply(Object.assign({}, c, { by: m.by }));
        }
        break;
      }

      case 'snap':
        if (!isHost && Game.state) Game.applySnapshot(m.s);
        break;

      case 'cursor': {
        const G = Game.state;
        if (G && G.peers[m.id]) G.peers[m.id].cursor = { x: m.x, y: m.y };
        break;
      }

      case 'chat': emit('chat', m); break;
      case 'pong': ping = Math.round(performance.now() - pingSentAt); break;
    }
  }

  /* ---------- outbound ---------- */
  function sendCommand(c) {
    tx({ t: 'cmd', c });
  }

  function startSnapshots() {
    stopSnapshots();
    snapTimer = setInterval(() => {
      const G = Game.state;
      if (!G || !isHost) return;
      tx({ t: 'snap', s: Game.makeSnapshot() });
    }, 1000 / SNAP_HZ);
  }
  function stopSnapshots() { if (snapTimer) clearInterval(snapTimer); snapTimer = null; }

  function startCursor() {
    stopCursor();
    cursorTimer = setInterval(() => {
      const G = Game.state;
      if (!G || !G.ui.mouse) return;
      tx({ t: 'cursor', x: Math.round(G.ui.mouse.x), y: Math.round(G.ui.mouse.y) });
    }, 1000 / CURSOR_HZ);
  }
  function stopCursor() { if (cursorTimer) clearInterval(cursorTimer); cursorTimer = null; }

  let pingTimer = null;
  function startPing() {
    stopPing();
    pingTimer = setInterval(() => { pingSentAt = performance.now(); tx({ t: 'ping', s: pingSentAt }); }, 3000);
  }
  function stopPing() { if (pingTimer) clearInterval(pingTimer); pingTimer = null; }

  /* ---------- lobby ---------- */
  const setName  = n => tx({ t: 'name', name: n });
  const create   = (name, level) => tx({ t: 'create', name, level });
  const join     = (code, name) => tx({ t: 'join', code, name });
  const setLevel = level => tx({ t: 'level', level });
  const setReady = v => tx({ t: 'ready', v });
  const start    = () => tx({ t: 'start' });
  const chat     = msg => tx({ t: 'chat', msg });
  const leave    = () => { tx({ t: 'leave' }); roomCode = null; stopSnapshots(); stopCursor(); };
  function disconnect() {
    stopSnapshots(); stopCursor(); stopPing();
    if (ws) { try { ws.close(); } catch (e) {} }
    ws = null; connected = false; roomCode = null;
  }

  /* wire the game's outbound command channel into the socket */
  function attachToGame() {
    const G = Game.state;
    if (!G) return;
    G.sendCommand = sendCommand;
    if (isHost) startSnapshots();
    startCursor();
  }

  return {
    connect, disconnect, attachToGame,
    create, join, setName, setLevel, setReady, start, chat, leave,
    on, sendCommand,
    get selfId() { return selfId; },
    get room() { return roomCode; },
    get isHost() { return isHost; },
    get players() { return players; },
    get ping() { return ping; },
    get connected() { return connected; },
    get url() { return url; },
    defaultUrl
  };
})();
