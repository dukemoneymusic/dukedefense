/* ============================================================
   DUKE$DEFENSE — server.js
   Static file host + co-op relay, with no npm dependencies at all.

   RFC 6455 is implemented directly below because pulling in `ws`
   would mean the project stops being "download it and double-click
   it". Everything here is plain Node core.

     node server.js                 → http + ws on 8177
     PORT=3000 node server.js       → somewhere else
     HOST=0.0.0.0 node server.js    → reachable from the LAN (default)

   Rooms are four-player, created on demand by code. The first
   player in a room is the HOST: their browser runs the simulation
   and everyone else receives snapshots. If the host leaves, the
   next player in the room is promoted automatically.
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
/* A hosting platform injects PORT and routes traffic to exactly it, so on a
   deploy we must bind that port or nothing. Only local dev (no PORT set) is
   allowed to hop to a neighbour when the default is busy. */
const PORT_FROM_ENV = process.env.PORT != null && process.env.PORT !== '';
const PORT = parseInt(process.env.PORT, 10) || 8177;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_PLAYERS = 4;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

/* ============================================================
   STATIC FILES
   ============================================================ */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: sockets.size }));
  }
  const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

/* ============================================================
   WEBSOCKET — handshake
   ============================================================ */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const sockets = new Set();

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  socket.setNoDelay(true);
  attach(socket);
});

/* ---- frame encoding ---- */
function encode(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  header[0] = 0x81;                      /* FIN + text */
  return Buffer.concat([header, payload]);
}

function send(sock, obj) {
  if (sock.destroyed) return;
  try { sock.write(encode(JSON.stringify(obj))); } catch (e) { /* peer vanished */ }
}

/* ---- frame decoding: a small state machine over a growing buffer ---- */
function attach(socket) {
  let buf = Buffer.alloc(0);
  socket.info = { id: 'p' + (++idSeq), room: null, name: 'PLAYER', ready: false };
  sockets.add(socket);
  send(socket, { t: 'hello', id: socket.info.id });

  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const b0 = buf[0], b1 = buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2)); off = 10;
      }
      let mask = null;
      if (masked) {
        if (buf.length < off + 4) return;
        mask = buf.slice(off, off + 4); off += 4;
      }
      if (buf.length < off + len) return;
      const data = buf.slice(off, off + len);
      buf = buf.slice(off + len);

      if (masked) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];

      if (opcode === 0x8) { socket.end(); return; }            /* close */
      if (opcode === 0x9) {                                     /* ping */
        const pong = Buffer.concat([Buffer.from([0x8a, data.length]), data]);
        try { socket.write(pong); } catch (e) {}
        continue;
      }
      if (opcode !== 0x1 && opcode !== 0x2) continue;

      let msg;
      try { msg = JSON.parse(data.toString('utf8')); } catch (e) { continue; }
      handle(socket, msg);
    }
  });

  const bye = () => { leave(socket); sockets.delete(socket); };
  socket.on('close', bye);
  socket.on('error', bye);
  socket.on('end', bye);
}

/* ============================================================
   ROOMS
   ============================================================ */
let idSeq = 0;
const rooms = new Map();                  /* code -> { code, members:[socket], level, seed } */

const COLORS = ['#ffc21a', '#4ab7ff', '#3fdd8f', '#ff6a8a'];

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); }
  while (rooms.has(c));
  return c;
}

function roster(room) {
  return room.members.map((s, i) => ({
    id: s.info.id, name: s.info.name, col: COLORS[i % COLORS.length],
    host: i === 0, ready: s.info.ready
  }));
}

function broadcast(room, obj, except) {
  for (const s of room.members) if (s !== except) send(s, obj);
}

function pushRoster(room) {
  broadcast(room, { t: 'roster', code: room.code, players: roster(room), level: room.level, seed: room.seed });
}

function leave(socket) {
  const code = socket.info && socket.info.room;
  if (!code) return;
  const room = rooms.get(code);
  socket.info.room = null;
  if (!room) return;
  const wasHost = room.members[0] === socket;
  room.members = room.members.filter(s => s !== socket);
  if (!room.members.length) { rooms.delete(code); return; }
  if (wasHost) {
    /* promote the next player and tell everyone to resync */
    broadcast(room, { t: 'hostchange', id: room.members[0].info.id });
  }
  broadcast(room, { t: 'left', id: socket.info.id });
  pushRoster(room);
}

function handle(socket, m) {
  const info = socket.info;

  switch (m.t) {

    case 'name':
      info.name = String(m.name || 'PLAYER').slice(0, 12).toUpperCase();
      if (info.room && rooms.has(info.room)) pushRoster(rooms.get(info.room));
      break;

    case 'create': {
      leave(socket);
      const code = makeCode();
      const room = { code, members: [socket], level: m.level || 0, seed: (Math.random() * 1e9) | 0 };
      rooms.set(code, room);
      info.room = code;
      info.name = String(m.name || info.name).slice(0, 12).toUpperCase();
      send(socket, { t: 'joined', code, you: info.id, host: true });
      pushRoster(room);
      break;
    }

    case 'join': {
      const code = String(m.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) { send(socket, { t: 'joinfail', why: 'NO SUCH ROOM' }); break; }
      if (room.members.length >= MAX_PLAYERS) { send(socket, { t: 'joinfail', why: 'ROOM IS FULL' }); break; }
      if (room.started) { send(socket, { t: 'joinfail', why: 'ALREADY DEPLOYED' }); break; }
      leave(socket);
      room.members.push(socket);
      info.room = code;
      info.name = String(m.name || info.name).slice(0, 12).toUpperCase();
      send(socket, { t: 'joined', code, you: info.id, host: false });
      pushRoster(room);
      break;
    }

    case 'level': {
      const room = rooms.get(info.room);
      if (!room || room.members[0] !== socket) break;
      room.level = m.level | 0;
      pushRoster(room);
      break;
    }

    case 'ready':
      info.ready = !!m.v;
      if (rooms.has(info.room)) pushRoster(rooms.get(info.room));
      break;

    case 'start': {
      const room = rooms.get(info.room);
      if (!room || room.members[0] !== socket) break;
      room.started = true;
      broadcast(room, { t: 'start', level: room.level, seed: room.seed, players: roster(room) });
      break;
    }

    /* gameplay traffic is relayed verbatim; the host is authoritative */
    case 'cmd': {
      const room = rooms.get(info.room);
      if (!room) break;
      m.by = info.id;
      const host = room.members[0];
      if (socket === host) broadcast(room, m, socket);        /* host echo */
      else send(host, m);                                      /* client request */
      break;
    }

    case 'snap': {
      const room = rooms.get(info.room);
      if (!room || room.members[0] !== socket) break;
      broadcast(room, m, socket);
      break;
    }

    case 'cursor': {
      const room = rooms.get(info.room);
      if (!room) break;
      broadcast(room, { t: 'cursor', id: info.id, x: m.x, y: m.y }, socket);
      break;
    }

    case 'chat': {
      const room = rooms.get(info.room);
      if (!room) break;
      broadcast(room, { t: 'chat', id: info.id, name: info.name, msg: String(m.msg || '').slice(0, 120) });
      break;
    }

    case 'leave':
      leave(socket);
      break;

    case 'ping':
      send(socket, { t: 'pong', s: m.s });
      break;
  }
}

/* ============================================================
   NETWORK ADDRESSES
   Sort real LAN interfaces ahead of the virtual adapters that
   Docker / WSL / VM software leave lying around, so the address
   we tell friends to use is one they can actually reach.
   ============================================================ */
function lanAddresses() {
  const nets = require('os').networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family !== 'IPv4' || ni.internal) continue;
      const virtual = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|npcap/i.test(name);
      out.push({ ip: ni.address, name, virtual });
    }
  }
  /* 192.168.* and 10.* home networks first, virtual adapters last */
  out.sort((a, b) => {
    if (a.virtual !== b.virtual) return a.virtual ? 1 : -1;
    const rank = ip => ip.startsWith('192.168.') ? 0 : (ip.startsWith('10.') ? 1 : 2);
    return rank(a.ip) - rank(b.ip);
  });
  return out;
}

/* ============================================================
   BOOT
   A second copy of the game on the same machine shouldn't fail —
   if the port is taken, walk up until we find a free one.
   ============================================================ */
function boot(port, attemptsLeft) {
  /* Each attempt starts clean — a failed listen leaves its inline callback
     registered as a pending 'listening' listener, which would then fire
     (with the wrong port) once a later attempt succeeds. */
  server.removeAllListeners('error');
  server.removeAllListeners('listening');

  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log('  Port ' + port + ' is busy — trying ' + (port + 1) + '…');
      setTimeout(() => boot(port + 1, attemptsLeft - 1), 60);
    } else if (err.code === 'EADDRINUSE') {
      console.error('\n  Could not find a free port near ' + PORT + '.');
      console.error('  Something else is using them. Set one explicitly:\n');
      console.error('    PORT=9000 node server.js\n');
      process.exit(1);
    } else {
      console.error('\n  Server error: ' + err.message + '\n');
      process.exit(1);
    }
  });

  server.on('listening', () => {
    const lan = lanAddresses();
    console.log('');
    console.log('  DUKE$DEFENSE');
    console.log('  ─────────────────────────────────────────');
    console.log('  Local     http://localhost:' + port);
    const primary = lan.filter(a => !a.virtual);
    (primary.length ? primary : lan).forEach(a =>
      console.log('  Network   http://' + a.ip + ':' + port + '   <- friends use this'));
    lan.filter(a => a.virtual).forEach(a =>
      console.log('  (virtual) http://' + a.ip + ':' + port + '   <- ignore, not real WiFi'));
    console.log('  ─────────────────────────────────────────');
    console.log('  Co-op: up to ' + MAX_PLAYERS + ' players per room.');
    if (port !== PORT) console.log('  (port ' + PORT + ' was busy, using ' + port + ' instead)');
    console.log('');
    keepAwake();
  });

  server.listen(port, HOST);
}

/* ============================================================
   KEEP-AWAKE
   Free hosts (Render's free plan, etc.) put a service to sleep
   after ~15 minutes with no inbound traffic, so the first player
   back has to wait for a cold start. While we're running we ping
   our own public URL every 10 minutes — that inbound request
   resets the idle timer, so the service just never sleeps and the
   link is effectively always-on. Costs nothing and stays well
   inside the free monthly hours for a single service.

   OFF BY DEFAULT since 2026-07-31. Render's free tier allows 750
   instance-hours per ACCOUNT per month, and one service kept awake
   round the clock burns ~730 of them on its own. With SKELLZ NEON
   now deployed too, leaving this on here as well would exhaust the
   allowance and suspend BOTH games before month end. SKELLZ is the
   always-on one now; set KEEP_AWAKE=1 here to swap it back (and
   turn it off there if you do).

   Render injects RENDER_EXTERNAL_URL. Any other host can enable
   this by setting SELF_URL to the public https address.
   ============================================================ */
let keepAwakeStarted = false;
function keepAwake() {
  if (keepAwakeStarted) return;
  if (!/^(1|true|yes|on)$/i.test(process.env.KEEP_AWAKE || '')) return;
  const url = (process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || '').replace(/\/+$/, '');
  if (!url || typeof fetch !== 'function') return;
  keepAwakeStarted = true;
  console.log('  Keep-awake: pinging ' + url + '/health every 10 min so it never sleeps.');
  setInterval(() => {
    fetch(url + '/health').catch(() => {});     /* an inbound hit resets the idle timer */
  }, 10 * 60 * 1000);
}

boot(PORT, PORT_FROM_ENV ? 0 : 20);
