// Regression test for Thief Pilfer
// Verifies:
// 1) Pilfer resolves after normal-priority spells because it has castPriority -1
// 2) Pilfer steals the top positive effect from the target and applies it to
//    the caster
//
// Run with: node test-thief-pilfer.js

import assert from 'node:assert/strict';
import { executeRound } from './src/battleEngine.js';

function makeTile(hero, id, effects = []) {
  return {
    id,
    hero: { ...hero },
    effects: effects.map(e => ({ ...e })),
    _passives: [],
    _dead: false,
    currentHealth: hero.health,
    currentArmor: hero.armor,
    currentSpeed: hero.speed,
    currentEnergy: hero.energy,
    currentSpellPower: hero.spellPower || 0,
    spellCasts: []
  };
}

const thiefHero = {
  id: 'testThief',
  name: 'Test Thief',
  health: 7,
  armor: 2,
  speed: 0,
  energy: 8,
  spellPower: 0,
  spells: {
    front: { id: 'basicAttack', cost: 99, casts: 0 },
    middle: { id: 'pilfer', cost: 5, casts: 1 },
    back: { id: 'basicAttack', cost: 99, casts: 0 }
  }
};

const allyGuardianHero = {
  id: 'testGuardian',
  name: 'Test Guardian',
  health: 20,
  armor: 1,
  speed: 0,
  energy: 8,
  spellPower: 0,
  spells: {
    front: { id: 'basicAttack', cost: 99, casts: 0 },
    middle: { id: 'defend', cost: 1, casts: 1 },
    back: { id: 'basicAttack', cost: 99, casts: 0 }
  }
};

const buffedEnemyHero = {
  id: 'testBuffedEnemy',
  name: 'Buffed Enemy',
  health: 12,
  armor: 1,
  speed: 0,
  energy: 0,
  spellPower: 0,
  spells: {
    front: { id: 'basicAttack', cost: 99, casts: 0 },
    middle: { id: 'basicAttack', cost: 99, casts: 0 },
    back: { id: 'basicAttack', cost: 99, casts: 0 }
  }
};

async function run() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  // Place both P1 casters in middle-row slots so they use their middle spells.
  p1Board[1] = makeTile(allyGuardianHero, 'p1-1'); // casts Defend (normal priority)
  p1Board[4] = makeTile(thiefHero, 'p1-4');       // casts Pilfer (castPriority -1)

  // Buffed enemy target with two buffs so it remains the most-buffs target.
  // Top positive effect is the last buff in the array => Strength.
  p2Board[4] = makeTile(buffedEnemyHero, 'p2-4', [
    { name: 'Armor Up', kind: 'buff', duration: 'permanent' },
    { name: 'Strength', kind: 'buff', duration: 'permanent' }
  ]);
  // Mirror runtime effect metadata shape: effects often carry appliedBy refs,
  // which can be circular via appliedBy.tile.effects.
  p2Board[4].effects[1].appliedBy = { boardName: 'p2Board', index: 4, tile: p2Board[4] };

  const preCastOrder = [];

  const result = await executeRound(
    {
      p1Board,
      p2Board,
      p1Reserve: [],
      p2Reserve: [],
      addLog: () => {},
      priorityPlayer: 'player1',
      roundNumber: 1
    },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      onStep: (state) => {
        const action = state && state.lastAction;
        if (action && action.type === 'preCast' && action.spellId) {
          preCastOrder.push(action.spellId);
        }
      }
    }
  );

  const defendIdx = preCastOrder.indexOf('defend');
  const pilferIdx = preCastOrder.indexOf('pilfer');

  assert.ok(defendIdx !== -1, `Expected Defend to appear in pre-cast order, got ${JSON.stringify(preCastOrder)}`);
  assert.ok(pilferIdx !== -1, `Expected Pilfer to appear in pre-cast order, got ${JSON.stringify(preCastOrder)}`);
  assert.ok(defendIdx < pilferIdx, `Expected normal-priority Defend to cast before Pilfer(-1). Order: ${JSON.stringify(preCastOrder)}`);

  const casterAfter = result.p1Board[4];
  const allyAfter = result.p1Board[1];
  const enemyAfter = result.p2Board[4];

  const casterEffectNames = (casterAfter.effects || []).map(e => e && e.name).filter(Boolean);
  const allyEffectNames = (allyAfter.effects || []).map(e => e && e.name).filter(Boolean);
  const enemyEffectNames = (enemyAfter.effects || []).map(e => e && e.name).filter(Boolean);

  assert.ok(casterEffectNames.includes('Strength'), `Expected caster to receive stolen Strength. Caster effects: ${JSON.stringify(casterEffectNames)}`);
  assert.ok(!allyEffectNames.includes('Strength'), `Expected non-caster ally to not receive stolen Strength. Ally effects: ${JSON.stringify(allyEffectNames)}`);
  assert.ok(!enemyEffectNames.includes('Strength'), `Expected enemy to lose stolen Strength. Enemy effects: ${JSON.stringify(enemyEffectNames)}`);

  console.log('✅ Thief Pilfer test passed');
  console.log(`   preCast order: ${JSON.stringify(preCastOrder)}`);
  console.log(`   caster effects: ${JSON.stringify(casterEffectNames)}`);
  console.log(`   ally effects: ${JSON.stringify(allyEffectNames)}`);
  console.log(`   enemy effects: ${JSON.stringify(enemyEffectNames)}`);
}

run().catch((err) => {
  console.error('❌ Thief Pilfer test failed:', err.message);
  process.exit(1);
});
