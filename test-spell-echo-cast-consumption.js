import assert from 'node:assert/strict';

import { executeRound } from './src/battleEngine.js';

function makeHero(id, name) {
  return {
    id,
    name,
    health: 20,
    armor: 0,
    speed: 0,
    energy: 10,
    spellPower: 0,
    _towerSpellEcho: 'back',
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'slash', cost: 1, casts: 1 }
    }
  };
}

function makeEnemy(id, name) {
  return {
    id,
    name,
    health: 20,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };
}

function makeTile(player, index, hero) {
  return {
    id: `${player}-main-${index}`,
    player,
    index,
    boardName: `${player}Board`,
    type: 'main',
    hero,
    currentHealth: hero.health,
    currentArmor: hero.armor,
    currentSpeed: hero.speed,
    currentEnergy: hero.energy,
    currentSpellPower: hero.spellPower,
    effects: [],
    _passives: [],
    spellCasts: [],
    _castsRemaining: {
      front: hero.spells.front.casts,
      middle: hero.spells.middle.casts,
      back: hero.spells.back.casts
    }
  };
}

function makeEmptyTile(player, index) {
  return {
    id: `${player}-main-${index}`,
    player,
    index,
    boardName: `${player}Board`,
    type: 'main',
    hero: null,
    effects: []
  };
}

function buildBoard(player, occupied = {}) {
  return Array.from({ length: 9 }, (_, index) => occupied[index] || makeEmptyTile(player, index));
}

async function run() {
  const casterHero = makeHero('echoMage', 'Echo Mage');
  const enemyHero = makeEnemy('target', 'Target Dummy');

  const casterTile = makeTile('p1', 6, casterHero);
  const enemyTile = makeTile('p2', 6, enemyHero);

  const state = {
    p1Board: buildBoard('p1', { 6: casterTile }),
    p2Board: buildBoard('p2', { 6: enemyTile }),
    p1Reserve: [],
    p2Reserve: [],
    addLog: null,
    priorityPlayer: 'player1'
  };

  casterTile.spellCasts = [{
    spellId: 'slash',
    slot: 'back',
    queuedEnergy: 1,
    queuedCost: 1
  }];

  const result = await executeRound(
    state,
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      postCastDelayMs: 0,
      reactionDelayMs: 0,
      speedMultiplier: 99
    }
  );

  const finalCaster = result.p1Board[6];

  assert.ok(finalCaster, 'Expected caster tile to exist after round resolution');
  assert.equal(finalCaster._castsRemaining.back, 0, 'Spell Echo should consume only the original back-row cast');

  console.log('Spell Echo cast consumption test passed.');
}

run().catch((error) => {
  console.error('Spell Echo cast consumption test failed:', error);
  process.exit(1);
});