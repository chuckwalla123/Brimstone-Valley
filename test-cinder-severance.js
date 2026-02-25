// Test script for Tower augments: Cinder Tax + Severance
// Run with: node test-cinder-severance.js

import { executeRound } from './src/battleEngine.js';
import { AUGMENTS } from './src/tower/augments.js';

function makeTile(hero, id) {
  return {
    id,
    hero: { ...hero },
    effects: [],
    _passives: [],
    _dead: false,
    currentHealth: hero.health,
    currentArmor: hero.armor,
    currentSpeed: hero.speed,
    currentEnergy: hero.energy,
    currentSpellPower: hero.spellPower,
    spellCasts: []
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runCinderTaxTest() {
  const casterHero = {
    id: 'cinderCaster',
    name: 'Cinder Caster',
    health: 20,
    armor: 0,
    speed: 10,
    energy: 10,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 0, casts: 0 },
      middle: { id: 'basicAttack', cost: 0, casts: 0 },
      back: { id: 'fireBolt', cost: 0, casts: 1 }
    }
  };

  const targetHero = {
    id: 'cinderTarget',
    name: 'Cinder Target',
    health: 20,
    armor: 1,
    speed: 0,
    energy: 3,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 0, casts: 0 },
      middle: { id: 'basicAttack', cost: 0, casts: 0 },
      back: { id: 'basicAttack', cost: 0, casts: 0 }
    }
  };

  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  p1Board[0] = makeTile(casterHero, 'p1-0');
  p2Board[0] = makeTile(targetHero, 'p2-0');

  // Apply Cinder Tax II: first Burn each round drains energy and deals small extra damage
  AUGMENTS.cinderTaxII.apply(p1Board[0].hero);

  const cinderEnergyPulses = [];

  const result = await executeRound({
    p1Board,
    p2Board,
    p1Reserve: [],
    p2Reserve: [],
    addLog: () => {},
    priorityPlayer: 'player1',
    roundNumber: 1
  }, {
    castDelayMs: 0,
    postEffectDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    onStep: (state) => {
      const lastAction = state && state.lastAction;
      if (!lastAction || lastAction.type !== 'effectPulse') return;
      if (lastAction.action !== 'energy') return;
      if (!lastAction.target || lastAction.target.boardName !== 'p2Board' || lastAction.target.index !== 0) return;
      cinderEnergyPulses.push(lastAction.amount);
    }
  });

  const target = result.p2Board[0];
  assert(cinderEnergyPulses.some(v => Number(v) === -1), `Expected Cinder Tax to emit energy drain pulse -1, got ${JSON.stringify(cinderEnergyPulses)}`);
  assert(target.currentHealth === 13, `Expected target health 13 after Fire Bolt + Cinder Tax bonus, got ${target.currentHealth}`);
  assert(Array.isArray(target.effects) && target.effects.some(e => e && e.name === 'Burn'), 'Target should have Burn applied');
}

async function runSeveranceTest() {
  const casterHero = {
    id: 'severCaster',
    name: 'Sever Caster',
    health: 25,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 0, casts: 0 },
      middle: { id: 'humility', cost: 0, casts: 1 },
      back: { id: 'basicAttack', cost: 0, casts: 0 }
    }
  };

  const buffedTargetHero = {
    id: 'buffedTarget',
    name: 'Buffed Target',
    health: 40,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 0, casts: 0 },
      middle: { id: 'basicAttack', cost: 0, casts: 0 },
      back: { id: 'basicAttack', cost: 0, casts: 0 }
    }
  };

  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  p1Board[4] = makeTile(casterHero, 'p1-4');
  p2Board[4] = makeTile(buffedTargetHero, 'p2-4');
  p2Board[4].effects = [
    { name: 'Armor Up', kind: 'buff', duration: 'permanent' },
    { name: 'Strength', kind: 'buff', duration: 'permanent' }
  ];

  // Apply Severance II: remove enemy buff/debuff => speed gain + empower next damage spell
  AUGMENTS.severanceII.apply(p1Board[4].hero);
  assert(!!p1Board[4].hero._towerSeverance, 'Severance II apply did not set _towerSeverance on caster');

  const severanceLogs = [];

  const afterFirst = await executeRound({
    p1Board,
    p2Board,
    p1Reserve: [],
    p2Reserve: [],
    addLog: (msg) => severanceLogs.push(String(msg || '')),
    priorityPlayer: 'player1',
    roundNumber: 1
  }, {
    castDelayMs: 0,
    postEffectDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0
  });

  const casterAfterFirst = afterFirst.p1Board[4];
  const targetAfterFirst = afterFirst.p2Board[4];

  assert(targetAfterFirst.currentHealth < 40, `Expected first cast to deal damage; target health is ${targetAfterFirst.currentHealth}`);
  assert(Array.isArray(targetAfterFirst.effects) && targetAfterFirst.effects.length === 1, `Humility should remove one buff, remaining effects: ${JSON.stringify(targetAfterFirst.effects)}`);
  assert(severanceLogs.some(l => l.includes('Severance triggered')), `Expected Severance trigger log, got logs:\n${severanceLogs.join('\n')}`);
  assert(severanceLogs.some(l => l.includes('Severance empower consumed')), `Expected Severance consume log, got logs:\n${severanceLogs.join('\n')}`);
}

async function main() {
  console.log('\n=== Testing Cinder Tax + Severance ===');
  await runCinderTaxTest();
  console.log('✅ Cinder Tax test passed');
  await runSeveranceTest();
  console.log('✅ Severance test passed');
  console.log('✅ All tests passed');
}

main().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
