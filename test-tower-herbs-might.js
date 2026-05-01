import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';
import { AUGMENTS } from './src/tower/augments.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTile(hero, overrides = {}) {
  return {
    hero: { ...hero },
    effects: Array.isArray(overrides.effects) ? overrides.effects.map(effect => ({ ...effect })) : [],
    _passives: [],
    _dead: false,
    currentHealth: overrides.currentHealth ?? Number(hero.health || 0),
    currentArmor: overrides.currentArmor ?? Number(hero.armor || 0),
    currentSpeed: overrides.currentSpeed ?? Number(hero.speed || 0),
    currentEnergy: overrides.currentEnergy ?? Number(hero.energy || 0),
    currentSpellPower: overrides.currentSpellPower ?? Number(hero.spellPower || 0),
    spellCasts: []
  };
}

function makeHero({ id, name, spellId, energy = 1, speed = 0 }) {
  return {
    id,
    name,
    health: 20,
    armor: 0,
    speed,
    energy,
    spellPower: 0,
    spells: {
      front: { id: spellId, cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };
}

function makeEnemy(id = 'enemy-target') {
  return {
    id,
    name: id,
    health: 50,
    armor: 0,
    speed: 0,
    energy: 0,
    monster: true,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };
}

async function runDamageScenario(spellId, applyMight) {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  p1Board[2] = makeTile(makeHero({ id: `caster-${spellId}-${applyMight ? 'might' : 'base'}`, name: 'Caster', spellId }));
  p2Board[0] = makeTile(makeEnemy(`enemy-${spellId}-${applyMight ? 'might' : 'base'}`));

  if (applyMight) {
    AUGMENTS.attackPowerBoostLarge.apply(p1Board[2].hero, 5);
  }

  const result = await executeRound({
    p1Board,
    p2Board,
    p1Reserve: [],
    p2Reserve: [],
    priorityPlayer: 'player1',
    roundNumber: 1
  }, {
    castDelayMs: 0,
    postEffectDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    quiet: true,
    speedMultiplier: 30
  });

  const targetTile = result?.p2Board?.[0];
  return 50 - Number(targetTile?.currentHealth ?? 50);
}

async function runMightRegressionTest() {
  SPELLS.__towerMightAttackSpell = {
    id: '__towerMightAttackSpell',
    name: 'Tower Might Attack Spell',
    description: 'Test-only attack-power spell.',
    spec: {
      targets: [{ type: 'nearest', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 4, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const basicBaseDamage = await runDamageScenario('basicAttack', false);
  const basicMightDamage = await runDamageScenario('basicAttack', true);
  const spellBaseDamage = await runDamageScenario('__towerMightAttackSpell', false);
  const spellMightDamage = await runDamageScenario('__towerMightAttackSpell', true);

  assert(
    basicMightDamage === basicBaseDamage,
    `Expected Might to leave basic attack damage unchanged, got base ${basicBaseDamage} vs Might ${basicMightDamage}`
  );
  assert(
    spellMightDamage === spellBaseDamage + 5,
    `Expected Might to add 5 damage to attack-power spells, got base ${spellBaseDamage} vs Might ${spellMightDamage}`
  );
}

async function runHerbsSeveranceRegressionTest() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const caster = {
    id: 'herbs-caster',
    name: 'Herbs Caster',
    health: 20,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'herbs', cost: 0, casts: 1 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };

  const allyA = {
    id: 'herbs-ally-a',
    name: 'Herbs Ally A',
    health: 12,
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

  const allyB = { ...allyA, id: 'herbs-ally-b', name: 'Herbs Ally B' };

  p1Board[4] = makeTile(caster);
  p1Board[3] = makeTile(allyA, {
    currentHealth: 7,
    effects: [{ name: 'Burn', kind: 'debuff', duration: 2 }]
  });
  p1Board[5] = makeTile(allyB, {
    currentHealth: 6,
    effects: [{ name: 'Bleed', kind: 'debuff', duration: 2 }]
  });
  p2Board[0] = makeTile(makeEnemy('herbs-dummy-enemy'));

  AUGMENTS.severanceI.apply(p1Board[4].hero);

  const result = await executeRound({
    p1Board,
    p2Board,
    p1Reserve: [],
    p2Reserve: [],
    priorityPlayer: 'player1',
    roundNumber: 1
  }, {
    castDelayMs: 0,
    postEffectDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    quiet: true,
    speedMultiplier: 30
  });

  const healedA = result?.p1Board?.[3];
  const healedB = result?.p1Board?.[5];

  assert(Number(healedA?.currentHealth) === 10, `Expected Herbs + Severance to heal ally A to 10, got ${healedA?.currentHealth}`);
  assert(Number(healedB?.currentHealth) === 9, `Expected Herbs + Severance to heal ally B to 9, got ${healedB?.currentHealth}`);
  assert((healedA?.effects || []).length === 0, `Expected Herbs to remove ally A debuff, got ${JSON.stringify(healedA?.effects || [])}`);
  assert((healedB?.effects || []).length === 0, `Expected Herbs to remove ally B debuff, got ${JSON.stringify(healedB?.effects || [])}`);
}

async function main() {
  await runMightRegressionTest();
  console.log('Tower Might regression PASSED');
  await runHerbsSeveranceRegressionTest();
  console.log('Tower Herbs + Severance regression PASSED');
}

main().catch((error) => {
  console.error('Tower regression FAILED:', error.message);
  process.exit(1);
});