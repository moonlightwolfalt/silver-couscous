# silver-couscous: a mope.io-style game

A multiplayer browser game in the style of [mope.io](https://mope.io): start as a mouse, eat food and
smaller animals to earn XP, and evolve up the food chain through 12 tiers, from Mouse to Dragon.

The code is original. It recreates the gameplay from how the game plays and does not use mope.io's
code, art or network protocol.

## Run

```bash
npm install
npm start          # http://localhost:3000  (set PORT to change)
npm test
```

## How to play

- **Mouse**: steer (the farther the cursor is from your animal, the faster you go)
- **Click / Space**: boost (costs water, 1.2 s cooldown)
- Eat **berries** (any tier), **mushrooms** (Pig+) and **watermelons** (Zebra+, which also give water).
- Eat animals of a **lower tier** by moving over them. A **red outline** means that animal can eat you,
  and a white outline means you can eat it.
- Your **water** bar drains over time, faster for bigger animals. Swim in lakes to refill it. At 0 water
  you lose HP and die of thirst.
- Bots fill the world when few people are online.

## Layout

| Path | What it does |
| --- | --- |
| `shared/config.js` | Animal tiers, food types, and world constants (used by both server and browser) |
| `server/game.js` | Authoritative simulation: movement, eating, evolution, water, bot AI, snapshots |
| `server/index.js` | HTTP static server and WebSocket game loop (30 ticks/s) |
| `public/` | Canvas client: rendering, interpolation, HUD, leaderboard, minimap |
| `test/` | `node:test` unit tests for the game rules |
