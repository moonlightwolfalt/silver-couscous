'use strict';

const C = require('../shared/config');

const BOT_NAMES = [
  'Nibbles', 'Hopper', 'Truffle', 'Bambi', 'Rusty', 'Stripes', 'Dash', 'Simba',
  'Grizzly', 'Tank', 'Dumbo', 'Smaug', 'Pip', 'Clover', 'Mocha', 'Shadow',
];

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

class Game {
  constructor({ rng = Math.random, bots = true } = {}) {
    this.rng = rng;
    this.size = C.WORLD_SIZE;
    this.players = new Map();
    this.food = new Map();
    this.lakes = [];
    this.nextId = 1;
    this.botsEnabled = bots;
    this.events = []; // { to, type, ... } drained by the network layer each tick

    this.generateLakes();
    while (this.food.size < C.FOOD_COUNT) this.spawnFood();
  }

  generateLakes() {
    for (let i = 0; i < C.LAKE_COUNT; i++) {
      const r = 110 + this.rng() * 140;
      this.lakes.push({
        x: r + this.rng() * (this.size - 2 * r),
        y: r + this.rng() * (this.size - 2 * r),
        r,
      });
    }
  }

  inLake(x, y) {
    return this.lakes.some((l) => dist2(x, y, l.x, l.y) < l.r * l.r);
  }

  randomLandPoint(margin = 30) {
    for (let i = 0; i < 50; i++) {
      const x = margin + this.rng() * (this.size - 2 * margin);
      const y = margin + this.rng() * (this.size - 2 * margin);
      if (!this.inLake(x, y)) return { x, y };
    }
    return { x: this.size / 2, y: this.size / 2 };
  }

  spawnFood() {
    const total = C.FOOD_TYPES.reduce((s, f) => s + f.weight, 0);
    let roll = this.rng() * total;
    let kind = 0;
    while (roll >= C.FOOD_TYPES[kind].weight) roll -= C.FOOD_TYPES[kind++].weight;
    const { x, y } = this.randomLandPoint();
    const id = this.nextId++;
    this.food.set(id, { id, x, y, kind });
  }

  addPlayer(name, { bot = false } = {}) {
    const { x, y } = this.randomLandPoint(100);
    const id = this.nextId++;
    const p = {
      id,
      name: String(name || '').trim().slice(0, C.MAX_NAME_LENGTH) || 'mope',
      bot,
      x, y,
      vx: 0, vy: 0,
      angle: 0,
      throttle: 0,
      boostRequested: false,
      boostCooldown: 0,
      tier: 0,
      xp: 0,
      water: 100,
      hp: 100,
      kills: 0,
      alive: true,
      aiTimer: 0,
    };
    this.players.set(id, p);
    return p;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  setInput(id, { angle, throttle, boost }) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (Number.isFinite(angle)) p.angle = angle;
    if (Number.isFinite(throttle)) p.throttle = clamp(throttle, 0, 1);
    p.boostRequested = !!boost;
  }

  animal(p) {
    return C.ANIMALS[p.tier];
  }

  canEat(a, b) {
    return a.alive && b.alive && a.tier > b.tier;
  }

  kill(victim, cause, killer) {
    victim.alive = false;
    victim.vx = victim.vy = 0;
    this.events.push({
      to: victim.id,
      type: 'death',
      cause,
      killer: killer ? `${killer.name} the ${this.animal(killer).name}` : null,
      score: Math.floor(victim.xp),
      animal: this.animal(victim).name,
    });
    if (victim.bot) this.players.delete(victim.id);
  }

  gainXp(p, amount) {
    p.xp += amount;
    while (p.tier < C.ANIMALS.length - 1 && p.xp >= C.ANIMALS[p.tier + 1].xp) {
      p.tier++;
      p.hp = 100;
      this.events.push({ to: p.id, type: 'evolve', animal: this.animal(p).name });
    }
  }

  tick(dt) {
    if (this.botsEnabled) this.manageBots();
    const living = [...this.players.values()].filter((p) => p.alive);

    for (const p of living) {
      if (p.bot) this.updateBot(p, dt);
      this.move(p, dt);
      this.updateVitals(p, dt);
    }

    for (const p of living) if (p.alive) this.eatFood(p);
    this.resolvePlayerCollisions(living);

    while (this.food.size < C.FOOD_COUNT) this.spawnFood();
  }

  move(p, dt) {
    const a = this.animal(p);
    const swimming = this.inLake(p.x, p.y);
    const speed = a.speed * 60 * (swimming ? 0.7 : 1);

    p.boostCooldown = Math.max(0, p.boostCooldown - dt);
    if (p.boostRequested && p.boostCooldown === 0 && p.water >= 10) {
      p.water -= 8;
      p.boostCooldown = 1.2;
      p.vx += Math.cos(p.angle) * speed * 2.2;
      p.vy += Math.sin(p.angle) * speed * 2.2;
    }

    const tx = Math.cos(p.angle) * speed * p.throttle;
    const ty = Math.sin(p.angle) * speed * p.throttle;
    const k = 1 - Math.exp(-6 * dt);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;

    const r = a.radius;
    p.x = clamp(p.x + p.vx * dt, r, this.size - r);
    p.y = clamp(p.y + p.vy * dt, r, this.size - r);
  }

  updateVitals(p, dt) {
    if (this.inLake(p.x, p.y)) p.water = Math.min(100, p.water + 30 * dt);
    else p.water = Math.max(0, p.water - (1.1 + p.tier * 0.12) * dt);

    if (p.water <= 0) p.hp -= 12 * dt;
    else p.hp = Math.min(100, p.hp + 4 * dt);

    if (p.hp <= 0) this.kill(p, 'thirst');
  }

  eatFood(p) {
    const r = this.animal(p).radius;
    for (const f of this.food.values()) {
      const type = C.FOOD_TYPES[f.kind];
      if (p.tier < type.minTier) continue;
      const reach = r + type.radius * 0.5;
      if (dist2(p.x, p.y, f.x, f.y) < reach * reach) {
        this.food.delete(f.id);
        p.water = Math.min(100, p.water + type.water);
        this.gainXp(p, type.xp);
      }
    }
  }

  resolvePlayerCollisions(living) {
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i];
        const b = living[j];
        if (!a.alive || !b.alive) continue;
        const ra = this.animal(a).radius;
        const rb = this.animal(b).radius;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 >= (ra + rb) ** 2) continue;

        const d = Math.sqrt(d2) || 0.01;
        const [big, small, rBig, rSmall] = a.tier >= b.tier ? [a, b, ra, rb] : [b, a, rb, ra];
        if (this.canEat(big, small) && d < rBig - rSmall * 0.2) {
          big.kills++;
          this.gainXp(big, Math.max(15, small.xp * 0.35));
          this.kill(small, 'eaten', big);
          continue;
        }
        if (big.tier === small.tier) {
          // Same tier: push apart evenly.
          const push = (ra + rb - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  // ---- bots ----

  manageBots() {
    const all = [...this.players.values()];
    const humans = all.filter((p) => !p.bot).length;
    const bots = all.filter((p) => p.bot).length;
    const want = Math.max(4, C.MIN_PLAYERS_WITH_BOTS - humans);
    if (bots < want && this.rng() < 0.05) {
      this.addPlayer(BOT_NAMES[Math.floor(this.rng() * BOT_NAMES.length)], { bot: true });
    }
  }

  updateBot(p, dt) {
    p.aiTimer -= dt;
    if (p.aiTimer > 0) return;
    p.aiTimer = 0.25 + this.rng() * 0.2;
    p.boostRequested = false;
    p.throttle = 1;

    const view = 500 + p.tier * 30;
    let threat = null, threatD = Infinity, prey = null, preyD = Infinity;
    for (const o of this.players.values()) {
      if (o === p || !o.alive) continue;
      const d = Math.sqrt(dist2(p.x, p.y, o.x, o.y));
      if (d > view) continue;
      if (this.canEat(o, p) && d < threatD) { threat = o; threatD = d; }
      else if (this.canEat(p, o) && d < preyD) { prey = o; preyD = d; }
    }

    const face = (x, y) => { p.angle = Math.atan2(y - p.y, x - p.x); };

    if (threat && threatD < 350) {
      p.angle = Math.atan2(p.y - threat.y, p.x - threat.x) + (this.rng() - 0.5) * 0.6;
      p.boostRequested = threatD < 160;
      return;
    }
    if (p.water < 35) {
      let best = null, bestD = Infinity;
      for (const l of this.lakes) {
        const d = dist2(p.x, p.y, l.x, l.y);
        if (d < bestD) { best = l; bestD = d; }
      }
      if (best) return face(best.x, best.y);
    }
    if (prey) {
      face(prey.x, prey.y);
      p.boostRequested = preyD < 140;
      return;
    }
    let best = null, bestScore = -Infinity;
    for (const f of this.food.values()) {
      const type = C.FOOD_TYPES[f.kind];
      if (p.tier < type.minTier) continue;
      const d = Math.sqrt(dist2(p.x, p.y, f.x, f.y));
      if (d > view) continue;
      const score = type.xp / (d + 40);
      if (score > bestScore) { best = f; bestScore = score; }
    }
    if (best) face(best.x, best.y);
    else p.angle += (this.rng() - 0.5) * 1.5;
  }

  // ---- snapshots ----

  leaderboard(n = 10) {
    return [...this.players.values()]
      .filter((p) => p.alive)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, n)
      .map((p) => ({ id: p.id, name: p.name, xp: Math.floor(p.xp), tier: p.tier }));
  }

  snapshotFor(id) {
    const me = this.players.get(id);
    if (!me) return null;
    const vr = C.viewRadius(me.tier);
    const inView = (x, y) => Math.abs(x - me.x) < vr * 1.4 && Math.abs(y - me.y) < vr;
    const players = [];
    for (const p of this.players.values()) {
      if (!p.alive || !inView(p.x, p.y)) continue;
      players.push([p.id, Math.round(p.x), Math.round(p.y), +p.angle.toFixed(2), p.tier, p.name]);
    }
    const food = [];
    for (const f of this.food.values()) {
      if (inView(f.x, f.y)) food.push([f.id, Math.round(f.x), Math.round(f.y), f.kind]);
    }
    return {
      t: 'state',
      me: {
        x: Math.round(me.x), y: Math.round(me.y),
        tier: me.tier, xp: Math.floor(me.xp),
        water: Math.round(me.water), hp: Math.round(me.hp), alive: me.alive,
      },
      players,
      food,
    };
  }
}

module.exports = { Game };
