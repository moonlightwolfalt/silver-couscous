(() => {
  'use strict';
  const C = window.MopeConfig;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const menu = document.getElementById('menu');
  const deathMsg = document.getElementById('death');
  const nameInput = document.getElementById('name');
  const toast = document.getElementById('toast');

  let ws = null;
  let world = { size: C.WORLD_SIZE, lakes: [] };
  let myId = null;
  let me = null;
  let board = [];
  const players = new Map(); // id -> { x, y, tx, ty, a, ta, tier, name }
  let food = [];
  const cam = { x: 0, y: 0, zoom: 1 };
  const input = { angle: 0, throttle: 0, boost: false };
  let toastTimer = 0;

  nameInput.value = (() => { try { return localStorage.getItem('mopeName') || ''; } catch { return ''; } })();

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onmessage = (e) => handle(JSON.parse(e.data));
    ws.onclose = () => setTimeout(connect, 1000);
  }

  function handle(msg) {
    if (msg.t === 'world') world = msg;
    else if (msg.t === 'joined') { myId = msg.id; players.clear(); }
    else if (msg.t === 'state') {
      me = msg.me;
      food = msg.food;
      if (msg.board) board = msg.board;
      const seen = new Set();
      for (const [id, x, y, a, tier, name] of msg.players) {
        seen.add(id);
        const p = players.get(id);
        if (p) Object.assign(p, { tx: x, ty: y, ta: a, tier, name });
        else players.set(id, { x, y, tx: x, ty: y, a, ta: a, tier, name });
      }
      for (const id of players.keys()) if (!seen.has(id)) players.delete(id);
      for (const ev of msg.events || []) handleEvent(ev);
    }
  }

  function handleEvent(ev) {
    if (ev.type === 'evolve') showToast(`You evolved into a ${ev.animal}!`);
    if (ev.type === 'death') {
      deathMsg.textContent = ev.cause === 'eaten'
        ? `You were eaten by ${ev.killer}. Score: ${ev.score}`
        : `You died of thirst as a ${ev.animal}. Score: ${ev.score}`;
      deathMsg.classList.remove('hidden');
      setTimeout(() => { menu.classList.remove('hidden'); nameInput.focus(); }, 900);
    }
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  function play() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try { localStorage.setItem('mopeName', nameInput.value); } catch {}
    ws.send(JSON.stringify({ t: 'join', name: nameInput.value }));
    menu.classList.add('hidden');
  }
  document.getElementById('play').onclick = play;
  nameInput.onkeydown = (e) => { if (e.key === 'Enter') play(); };

  // ---- input ----
  canvas.addEventListener('mousemove', (e) => {
    const dx = e.clientX - innerWidth / 2;
    const dy = e.clientY - innerHeight / 2;
    input.angle = Math.atan2(dy, dx);
    input.throttle = Math.min(1, Math.hypot(dx, dy) / 160);
  });
  canvas.addEventListener('mousedown', () => { input.boost = true; });
  addEventListener('mouseup', () => { input.boost = false; });
  addEventListener('keydown', (e) => { if (e.code === 'Space' && menu.classList.contains('hidden')) input.boost = true; });
  addEventListener('keyup', (e) => { if (e.code === 'Space') input.boost = false; });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const dx = t.clientX - innerWidth / 2;
    const dy = t.clientY - innerHeight / 2;
    input.angle = Math.atan2(dy, dx);
    input.throttle = Math.min(1, Math.hypot(dx, dy) / 120);
    e.preventDefault();
  }, { passive: false });

  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN && myId !== null) {
      ws.send(JSON.stringify({ t: 'input', a: +input.angle.toFixed(3), th: +input.throttle.toFixed(2), b: input.boost }));
    }
  }, 50);

  // ---- rendering ----
  function resize() {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
  }
  addEventListener('resize', resize);
  resize();

  const lerpAngle = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;

  function drawWorld() {
    ctx.fillStyle = '#1f5e27';
    ctx.fillRect(cam.x - 5000, cam.y - 5000, 10000, 10000);
    ctx.fillStyle = '#3fae4a';
    ctx.fillRect(0, 0, world.size, world.size);

    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let g = 0; g <= world.size; g += 80) {
      ctx.moveTo(g, 0); ctx.lineTo(g, world.size);
      ctx.moveTo(0, g); ctx.lineTo(world.size, g);
    }
    ctx.stroke();

    for (const l of world.lakes) {
      ctx.fillStyle = '#2d7fc9';
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4aa3eb';
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r - 14, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawFood(f) {
    const [, x, y, kind] = f;
    const r = C.FOOD_TYPES[kind].radius;
    if (kind === 0) {
      ctx.fillStyle = '#d6264a';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8fa5';
      ctx.beginPath(); ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 1) {
      ctx.fillStyle = '#efe3cf';
      ctx.fillRect(x - 3, y, 6, r * 0.8);
      ctx.fillStyle = '#9c5a32';
      ctx.beginPath(); ctx.arc(x, y + 1, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f3d9b8';
      ctx.beginPath(); ctx.arc(x - 4, y - 4, 2, 0, Math.PI * 2); ctx.arc(x + 4, y - 6, 1.6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#2e8b3a';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1c5e25'; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.ellipse(x, y, Math.abs(i) * r * 0.55 + 2, r, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drawAnimal(p, isMe) {
    const a = C.ANIMALS[p.tier];
    const r = a.radius;
    let outline = '#2a2a2a';
    if (!isMe && me && me.alive) {
      if (p.tier > me.tier) outline = '#e0262b';
      else if (p.tier < me.tier) outline = '#f5f5f5';
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a + Math.PI / 2); // face "up" in local space

    if (a.name === 'Dragon') {
      ctx.fillStyle = '#c0392b';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.5, 0);
        ctx.lineTo(s * r * 1.9, -r * 0.4);
        ctx.lineTo(s * r * 1.5, r * 0.6);
        ctx.closePath(); ctx.fill();
      }
    }

    // ears
    ctx.fillStyle = a.ear;
    const earR = a.name === 'Rabbit' ? r * 0.3 : r * 0.32;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (a.name === 'Rabbit') ctx.ellipse(s * r * 0.35, -r * 0.95, earR * 0.7, r * 0.6, s * 0.2, 0, Math.PI * 2);
      else if (a.name === 'Elephant') ctx.ellipse(s * r * 0.95, -r * 0.1, r * 0.45, r * 0.6, 0, 0, Math.PI * 2);
      else ctx.arc(s * r * 0.62, -r * 0.62, earR, 0, Math.PI * 2);
      ctx.fill();
    }

    // body
    ctx.fillStyle = a.color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(3, r * 0.1);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    if (a.name === 'Zebra') {
      ctx.strokeStyle = '#222'; ctx.lineWidth = r * 0.1;
      for (const yy of [-0.3, 0.1, 0.5]) { ctx.beginPath(); ctx.moveTo(-r * 0.8, r * yy); ctx.lineTo(r * 0.8, r * yy); ctx.stroke(); }
    } else if (a.name === 'Cheetah') {
      ctx.fillStyle = '#5a4320';
      for (const [sx, sy] of [[-0.4, 0.2], [0.35, 0.35], [0, 0.6], [-0.55, -0.15], [0.55, -0.1]]) {
        ctx.beginPath(); ctx.arc(sx * r, sy * r, r * 0.08, 0, Math.PI * 2); ctx.fill();
      }
    } else if (a.name === 'Lion') {
      ctx.strokeStyle = '#8b5a1c'; ctx.lineWidth = r * 0.18;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.stroke();
    }

    // snout / horn / trunk
    if (a.name === 'Rhino') {
      ctx.fillStyle = '#eee';
      ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.8); ctx.lineTo(0, -r * 1.3); ctx.lineTo(r * 0.15, -r * 0.8); ctx.fill();
    } else if (a.name === 'Elephant') {
      ctx.fillStyle = a.color;
      ctx.fillRect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.5);
    } else if (a.name === 'Pig') {
      ctx.fillStyle = '#e07f96';
      ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    }

    // eyes + nose
    ctx.fillStyle = '#111';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.32, -r * 0.3, Math.max(2.5, r * 0.09), 0, Math.PI * 2); ctx.fill(); }
    if (a.name !== 'Pig' && a.name !== 'Elephant') {
      ctx.beginPath(); ctx.arc(0, -r * 0.72, Math.max(2, r * 0.08), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.font = `bold ${Math.max(13, r * 0.38)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = '#fff';
    ctx.strokeText(p.name, p.x, p.y - r - 12);
    ctx.fillText(p.name, p.x, p.y - r - 12);
  }

  function bar(x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * frac), h - 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function drawHud(W, H) {
    if (!me) return;
    const cur = C.ANIMALS[me.tier];
    const next = C.ANIMALS[me.tier + 1];
    const w = Math.min(420, W - 32);
    const x = (W - w) / 2;

    const xpFrac = next ? (me.xp - cur.xp) / (next.xp - cur.xp) : 1;
    bar(x, H - 92, w, 26, xpFrac, '#e8b71c', next ? `${cur.name} · ${me.xp} XP · next: ${next.name} (${next.xp})` : `${cur.name} · ${me.xp} XP · max tier`);
    bar(x, H - 60, w, 26, me.water / 100, me.water < 25 ? '#e0262b' : '#3a8fd9', `Water ${me.water}%`);
    if (me.hp < 100) bar(x, H - 124, w, 18, me.hp / 100, '#4caf50', `HP ${me.hp}`);

    // leaderboard
    const lbW = 200;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(W - lbW - 12, 12, lbW, 30 + board.length * 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Leaderboard', W - lbW / 2 - 12, 32);
    ctx.font = '14px system-ui';
    board.forEach((e, i) => {
      ctx.fillStyle = e.id === myId ? '#ffe066' : '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${e.name}`, W - lbW - 2, 54 + i * 20);
      ctx.textAlign = 'right';
      ctx.fillText(e.xp, W - 20, 54 + i * 20);
    });

    // minimap
    const m = 140;
    const mx = W - m - 12;
    const my = H - m - 12;
    const s = m / world.size;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(mx, my, m, m);
    ctx.fillStyle = 'rgba(74,163,235,.8)';
    for (const l of world.lakes) { ctx.beginPath(); ctx.arc(mx + l.x * s, my + l.y * s, Math.max(2, l.r * s), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(mx + me.x * s, my + me.y * s, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  function frame() {
    const W = innerWidth;
    const H = innerHeight;
    for (const p of players.values()) {
      p.x += (p.tx - p.x) * 0.3;
      p.y += (p.ty - p.y) * 0.3;
      p.a = lerpAngle(p.a, p.ta, 0.3);
    }
    const mine = players.get(myId);
    if (mine) { cam.x = mine.x; cam.y = mine.y; }
    else if (me) { cam.x += (me.x - cam.x) * 0.1; cam.y += (me.y - cam.y) * 0.1; }
    else { cam.x = world.size / 2; cam.y = world.size / 2; }
    const targetZoom = Math.min(W, H * 1.4) / (C.viewRadius(me ? me.tier : 0) * 1.05);
    cam.zoom += (targetZoom - cam.zoom) * 0.05;

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    drawWorld();
    for (const f of food) drawFood(f);
    [...players.entries()]
      .sort((a, b) => a[1].tier - b[1].tier)
      .forEach(([id, p]) => drawAnimal(p, id === myId));
    ctx.restore();

    drawHud(W, H);
    requestAnimationFrame(frame);
  }

  connect();
  requestAnimationFrame(frame);
})();
