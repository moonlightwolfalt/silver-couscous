'use strict';

const test = require('node:test');
const assert = require('node:assert');
const C = require('../shared/config');
const { Game } = require('../server/game');

function emptyGame() {
  const g = new Game({ bots: false });
  g.food.clear();
  g.lakes = [];
  return g;
}

test('gaining enough XP evolves the animal', () => {
  const g = emptyGame();
  const p = g.addPlayer('a');
  g.gainXp(p, C.ANIMALS[2].xp);
  assert.strictEqual(p.tier, 2);
  assert.ok(g.events.some((e) => e.type === 'evolve' && e.to === p.id));
});

test('a higher tier eats a lower tier on overlap', () => {
  const g = emptyGame();
  const big = g.addPlayer('big');
  const small = g.addPlayer('small');
  big.tier = 3;
  Object.assign(big, { x: 500, y: 500 });
  Object.assign(small, { x: 505, y: 500 });
  g.tick(1 / 30);
  assert.strictEqual(small.alive, false);
  assert.strictEqual(big.kills, 1);
});

test('same tier animals push apart instead of eating', () => {
  const g = emptyGame();
  const a = g.addPlayer('a');
  const b = g.addPlayer('b');
  Object.assign(a, { x: 500, y: 500 });
  Object.assign(b, { x: 505, y: 500 });
  g.tick(1 / 30);
  assert.ok(a.alive && b.alive);
  assert.ok(b.x - a.x > 5);
});

test('food respects the minimum tier', () => {
  const g = emptyGame();
  const p = g.addPlayer('a');
  Object.assign(p, { x: 500, y: 500 });
  g.food.set(1, { id: 1, x: 500, y: 500, kind: 1 }); // mushroom, minTier 2
  g.eatFood(p);
  assert.ok(g.food.has(1));
  p.tier = 2;
  g.eatFood(p);
  assert.ok(!g.food.has(1));
});

test('running out of water eventually kills you', () => {
  const g = emptyGame();
  const p = g.addPlayer('a');
  p.water = 0;
  for (let i = 0; i < 400 && p.alive; i++) g.updateVitals(p, 1 / 30);
  assert.strictEqual(p.alive, false);
});

test('drinking in a lake refills water', () => {
  const g = emptyGame();
  const p = g.addPlayer('a');
  g.lakes = [{ x: 500, y: 500, r: 100 }];
  Object.assign(p, { x: 500, y: 500, water: 10 });
  g.updateVitals(p, 1);
  assert.ok(p.water > 30);
});
