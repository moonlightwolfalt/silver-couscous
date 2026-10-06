// Game constants shared by the server (CommonJS) and the browser (window.MopeConfig).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MopeConfig = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // xp = total XP needed to evolve into this animal.
  const ANIMALS = [
    { name: 'Mouse',    radius: 16, xp: 0,     speed: 5.4, color: '#a1a1a1', ear: '#f2a7b8' },
    { name: 'Rabbit',   radius: 20, xp: 50,    speed: 5.3, color: '#e8dccb', ear: '#f2a7b8' },
    { name: 'Pig',      radius: 24, xp: 150,   speed: 5.1, color: '#f5a3b5', ear: '#e07f96' },
    { name: 'Deer',     radius: 28, xp: 350,   speed: 5.0, color: '#b9844f', ear: '#8a5d33' },
    { name: 'Fox',      radius: 31, xp: 700,   speed: 4.9, color: '#e8742c', ear: '#3b2a20' },
    { name: 'Zebra',    radius: 34, xp: 1200,  speed: 4.8, color: '#f2f2f2', ear: '#222222' },
    { name: 'Cheetah',  radius: 37, xp: 2000,  speed: 4.8, color: '#e8c35a', ear: '#5a4320' },
    { name: 'Lion',     radius: 41, xp: 3200,  speed: 4.6, color: '#d9a441', ear: '#8b5a1c' },
    { name: 'Bear',     radius: 46, xp: 5000,  speed: 4.4, color: '#6e4a2f', ear: '#3d281a' },
    { name: 'Rhino',    radius: 51, xp: 7500,  speed: 4.2, color: '#8d8f94', ear: '#5d5f63' },
    { name: 'Elephant', radius: 58, xp: 11000, speed: 4.0, color: '#9aa3ad', ear: '#c7a0a8' },
    { name: 'Dragon',   radius: 68, xp: 16000, speed: 4.1, color: '#3fa34d', ear: '#c0392b' },
  ];

  // minTier: lowest animal tier that can eat this food.
  const FOOD_TYPES = [
    { name: 'berry',      radius: 7,  xp: 4,  water: 2,  minTier: 0, weight: 70 },
    { name: 'mushroom',   radius: 11, xp: 14, water: 0,  minTier: 2, weight: 22 },
    { name: 'watermelon', radius: 17, xp: 40, water: 30, minTier: 5, weight: 8 },
  ];

  return {
    WORLD_SIZE: 4000,
    TICK_RATE: 30,
    FOOD_COUNT: 650,
    LAKE_COUNT: 9,
    MIN_PLAYERS_WITH_BOTS: 14,
    MAX_NAME_LENGTH: 16,
    ANIMALS,
    FOOD_TYPES,
    viewRadius(tier) { return 900 + tier * 70; },
  };
});
