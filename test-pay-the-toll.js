// Regression test for Pay The Toll movement tracking
// Run with: node test-pay-the-toll.js

import assert from 'node:assert/strict';
import LocalGameEngine from './src/offline/LocalGameEngine.js';
import { makeEmptyMain, makeReserve } from './shared/gameLogic.js';
import { EFFECTS } from './src/effects.js';

function makeHero(id, name, health = 10) {
  return {
    id,
    name,
    health,
    armor: 0,
    speed: 0,
    energy: 0,
    spells: {
      front: { id: 'basicAttack', cost: 1, casts: 0 },
      middle: { id: 'basicAttack', cost: 1, casts: 0 },
      back: { id: 'basicAttack', cost: 1, casts: 0 }
    }
  };
}

async function testMainBoardDamage() {
  const engine = new LocalGameEngine();
  const p1Main = makeEmptyMain('p1');
  const p2Main = makeEmptyMain('p2');
  const p1Reserve = makeReserve('p1');
  const p2Reserve = makeReserve('p2');

  p1Main[0].hero = makeHero('trollA', 'Troll');
  p1Main[0].currentHealth = 18;
  p1Main[0].effects = [{ ...EFFECTS.PayTheToll }];

  p2Main[0].hero = makeHero('moverA', 'Mover', 10);
  p2Main[0].currentHealth = 10;

  engine.gameState = {
    p1Main,
    p2Main,
    p1Reserve,
    p2Reserve,
    p3Main: makeEmptyMain('p3'),
    p3Reserve: makeReserve('p3'),
    phase: 'movement',
    movementPhase: { sequence: ['p2'], index: 0 },
    priorityPlayer: 'player2',
    gameMode: 'classic'
  };

  await engine.emit('movementMove', {
    sourceId: p2Main[0].id,
    targetId: p2Main[1].id
  });

  const moved = engine.gameState.p2Main[1];
  assert.ok(moved && moved.hero, 'Expected moved hero to end on main board tile 1');
  assert.equal(moved.currentHealth, 10, 'Expected no immediate Pay The Toll damage during movement; damage resolves at round start');

  console.log('✓ Main-board movement records target without immediate Pay The Toll damage');
}

async function testReserveNoDamage() {
  const engine = new LocalGameEngine();
  const p1Main = makeEmptyMain('p1');
  const p2Main = makeEmptyMain('p2');
  const p1Reserve = makeReserve('p1');
  const p2Reserve = makeReserve('p2');

  p1Main[0].hero = makeHero('trollB', 'Troll');
  p1Main[0].currentHealth = 18;
  p1Main[0].effects = [{ ...EFFECTS.PayTheToll }];

  p2Main[0].hero = makeHero('moverB', 'Mover', 10);
  p2Main[0].currentHealth = 10;

  engine.gameState = {
    p1Main,
    p2Main,
    p1Reserve,
    p2Reserve,
    p3Main: makeEmptyMain('p3'),
    p3Reserve: makeReserve('p3'),
    phase: 'movement',
    movementPhase: { sequence: ['p2'], index: 0 },
    priorityPlayer: 'player2',
    gameMode: 'classic'
  };

  await engine.emit('movementMove', {
    sourceId: p2Main[0].id,
    targetId: p2Reserve[0].id
  });

  const moved = engine.gameState.p2Reserve[0];
  assert.ok(moved && moved.hero, 'Expected moved hero to end on reserve tile 0');
  assert.equal(moved.currentHealth, 10, 'Expected no Pay The Toll damage for hero ending in reserve');

  console.log('✓ Reserve movement does not take Pay The Toll damage');
}

async function run() {
  await testMainBoardDamage();
  await testReserveNoDamage();
  console.log('\nAll Pay The Toll tests passed.');
}

run().catch((err) => {
  console.error('Pay The Toll test failed:', err);
  process.exit(1);
});
