'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const C = require('../shared/config');
const { Game } = require('./game');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SHARED_CONFIG = path.join(__dirname, '..', 'shared', 'config.js');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  const file = url === '/config.js'
    ? SHARED_CONFIG
    : path.join(PUBLIC_DIR, path.normalize(url === '/' ? '/index.html' : url));
  if (file !== SHARED_CONFIG && !file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const game = new Game();
const sockets = new Map(); // ws -> player id (or null before joining)

const wss = new WebSocketServer({ server, maxPayload: 1024 });
wss.on('connection', (ws) => {
  sockets.set(ws, null);
  ws.send(JSON.stringify({ t: 'world', size: game.size, lakes: game.lakes }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const id = sockets.get(ws);
    if (msg.t === 'join') {
      if (id !== null) game.removePlayer(id);
      const p = game.addPlayer(msg.name);
      sockets.set(ws, p.id);
      ws.send(JSON.stringify({ t: 'joined', id: p.id }));
    } else if (msg.t === 'input' && id !== null) {
      game.setInput(id, { angle: +msg.a, throttle: +msg.th, boost: !!msg.b });
    }
  });

  ws.on('close', () => {
    const id = sockets.get(ws);
    if (id !== null) game.removePlayer(id);
    sockets.delete(ws);
  });
});

let tickCount = 0;
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  game.tick(Math.min(0.1, (now - last) / 1000));
  last = now;
  tickCount++;

  const events = game.events.splice(0);
  const board = tickCount % 15 === 0 ? game.leaderboard() : null;

  for (const [ws, id] of sockets) {
    if (id === null || ws.readyState !== ws.OPEN) continue;
    const snap = game.snapshotFor(id);
    if (snap) {
      const mine = events.filter((e) => e.to === id);
      if (mine.length) snap.events = mine;
      if (board) snap.board = board;
      ws.send(JSON.stringify(snap));
    }
  }
}, 1000 / C.TICK_RATE);

server.listen(PORT, () => console.log(`mope clone running on http://localhost:${PORT}`));
