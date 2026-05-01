import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';
import { EFFECTS } from './src/effects.js';
import { resolveTargets } from './src/targeting.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTile(hero, overrides = {}) {
  return {
    hero: { ...hero },
    id: overrides.id || hero.id,
    effects: Array.isArray(overrides.effects) ? overrides.effects.map(effect => ({ ...effect })) : [],
    _passives: [],
    _dead: false,
    currentHealth: overrides.currentHealth ?? Number(hero.health || 0),
    currentArmor: overrides.currentArmor ?? Number(hero.armor || 0),
    currentSpeed: overrides.currentSpeed ?? Number(hero.speed || 0),
    currentEnergy: overrides.currentEnergy ?? Number(hero.energy || 0),
    currentSpellPower: overrides.currentSpellPower ?? Number(hero.spellPower || 0),
    spellCasts: Array.isArray(overrides.spellCasts) ? overrides.spellCasts.map(cast => ({ ...cast })) : []
  };
}

function makeHero({ id, name, spellId, slot = 'front', energy = 0 }) {
  const spells = {
    front: { id: 'basicAttack', cost: 99, casts: 0 },
    middle: { id: 'basicAttack', cost: 99, casts: 0 },
    back: { id: 'basicAttack', cost: 99, casts: 0 }
  };
  spells[slot] = { id: spellId, cost: energy, casts: 1 };
  return {
    id,
    name,
    health: 20,
    armor: 0,
    speed: 0,
    energy,
    spellPower: 0,
    spells
  };
}

function makeInertEnemy(id, name, currentHealth) {
  return {
    hero: {
      id,
      name,
      health: currentHealth,
      armor: 0,
      speed: 0,
      energy: 0,
      spellPower: 0,
      spells: {
        front: { id: 'basicAttack', cost: 99, casts: 0 },
        middle: { id: 'basicAttack', cost: 99, casts: 0 },
        back: { id: 'basicAttack', cost: 99, casts: 0 }
      }
    },
    id,
    effects: [],
    _passives: [],
    _dead: false,
    currentHealth,
    currentArmor: 0,
    currentSpeed: 0,
    currentEnergy: -1,
    currentSpellPower: 0,
    spellCasts: []
  };
}

async function runRound(p1Board, p2Board) {
  return executeRound({
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
}

async function testShieldMaidenExcludeSelf() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const shieldMaiden = makeHero({
    id: 'shield-maiden-test',
    name: 'Shield Maiden',
    spellId: 'shieldMaidenLoyalty',
    slot: 'back',
    energy: 3
  });
  const ally = makeHero({
    id: 'ally-test',
    name: 'Ally',
    spellId: 'basicAttack',
    slot: 'front',
    energy: 1
  });

  p1Board[6] = makeTile(shieldMaiden, {
    id: 'p1-shield-maiden',
    currentEnergy: 3,
    spellCasts: [{ spellId: 'shieldMaidenLoyalty', slot: 'back', queuedEnergy: 3, queuedCost: 3 }]
  });
  p1Board[4] = makeTile(ally, { id: 'p1-ally', currentEnergy: 1 });

  const result = await runRound(p1Board, p2Board);
  const allyEffects = result?.p1Board?.[4]?.effects || [];
  const maidenEffects = result?.p1Board?.[6]?.effects || [];

  assert(allyEffects.some(effect => effect && effect.name === 'Loyalty'), 'Expected Loyalty to land on the ally, not Shield Maiden');
  assert(!maidenEffects.some(effect => effect && effect.name === 'Loyalty'), 'Expected Shield Maiden not to self-target Loyalty');
}

async function testHowlUsesFrontRowOnly() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const werewolf = makeHero({
    id: 'werewolf-test',
    name: 'Werewolf',
    spellId: 'howl',
    slot: 'middle',
    energy: 3
  });
  const enemy = makeHero({
    id: 'middle-enemy',
    name: 'Middle Enemy',
    spellId: 'basicAttack',
    slot: 'front',
    energy: 5
  });

  p1Board[4] = makeTile(werewolf, { id: 'p1-werewolf', currentEnergy: 3 });
  p2Board[4] = makeTile(enemy, { id: 'p2-middle-enemy', currentEnergy: 5 });

  const targets = resolveTargets(
    [{ type: 'frontRow', side: 'enemy' }],
    { boardName: 'p1Board', index: 4, tile: p1Board[4] },
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [] }
  );

  assert(targets.length === 0, `Expected frontRow targeting to ignore middle-row-only enemies, got ${JSON.stringify(targets)}`);
}

async function testAgonyTollAppliesAcrossFirstCast() {
  const runScenario = async (enableToll) => {
    const p1Board = Array(9).fill(null);
    const p2Board = Array(9).fill(null);

    const caster = makeHero({
      id: enableToll ? 'affliction-caster-toll' : 'affliction-caster-base',
      name: 'Affliction Caster',
      spellId: 'conflagration',
      slot: 'middle',
      energy: 3
    });
    if (enableToll) {
      caster._towerAfflictionToll = { energyDrain: 1, bonusDamage: 2 };
      caster._towerDebuffAugments = { middle: ['Burn'] };
    }

    p1Board[4] = makeTile(caster, {
      id: enableToll ? 'p1-affliction-caster-toll' : 'p1-affliction-caster-base',
      currentEnergy: 3,
      spellCasts: [{ spellId: 'conflagration', slot: 'middle', queuedEnergy: 3, queuedCost: 3 }]
    });
    p2Board[0] = makeTile(makeHero({ id: `enemy-a-${enableToll ? 'toll' : 'base'}`, name: 'Enemy A', spellId: 'basicAttack', slot: 'front', energy: 0 }), { id: `p2-enemy-a-${enableToll ? 'toll' : 'base'}` });
    p2Board[1] = makeTile(makeHero({ id: `enemy-b-${enableToll ? 'toll' : 'base'}`, name: 'Enemy B', spellId: 'basicAttack', slot: 'front', energy: 0 }), { id: `p2-enemy-b-${enableToll ? 'toll' : 'base'}` });

    const result = await runRound(p1Board, p2Board);
    return {
      enemyAHealth: Number(result?.p2Board?.[0]?.currentHealth ?? 20),
      enemyBHealth: Number(result?.p2Board?.[1]?.currentHealth ?? 20)
    };
  };

  const base = await runScenario(false);
  const toll = await runScenario(true);
  const deltaA = base.enemyAHealth - toll.enemyAHealth;
  const deltaB = base.enemyBHealth - toll.enemyBHealth;

  assert(deltaA > 0, `Expected Agony Toll to add extra damage to Enemy A, got base ${base.enemyAHealth} vs toll ${toll.enemyAHealth}`);
  assert(deltaB > 0, `Expected Agony Toll to add extra damage to Enemy B, got base ${base.enemyBHealth} vs toll ${toll.enemyBHealth}`);
  assert(deltaA === deltaB, `Expected Agony Toll bonus damage to apply equally across the first AOE cast, got deltas ${deltaA} and ${deltaB}`);
}

async function testRepeatHitDebuffAppliesOncePerTargetSelection() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const caster = makeHero({
    id: 'repeat-hit-caster',
    name: 'Repeat Hit Caster',
    spellId: 'honor',
    slot: 'middle',
    energy: 3
  });
  caster._towerDebuffAugments = { middle: ['Burn'] };

  p1Board[4] = makeTile(caster, {
    id: 'p1-repeat-hit-caster',
    currentEnergy: 3,
    spellCasts: [{ spellId: 'honor', slot: 'middle', queuedEnergy: 3, queuedCost: 3 }]
  });
  p2Board[0] = makeTile(makeHero({ id: 'repeat-target', name: 'Repeat Target', spellId: 'basicAttack', slot: 'front', energy: 0 }), {
    id: 'p2-repeat-target',
    currentHealth: 30
  });

  const result = await runRound(p1Board, p2Board);
  const burnEffects = (result?.p2Board?.[0]?.effects || []).filter(effect => effect && effect.name === 'Burn');

  assert(burnEffects.length === 1, `Expected repeated-hit spell to apply Burn once, got ${burnEffects.length}`);
}

async function testComboHitsSameTargetTwice() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const rogue = makeHero({
    id: 'rogue-combo-same-target',
    name: 'Rogue',
    spellId: 'combo',
    slot: 'back',
    energy: 3
  });

  p1Board[6] = makeTile(rogue, {
    id: 'p1-rogue-combo-same-target',
    currentEnergy: 3
  });
  p2Board[0] = makeInertEnemy('p2-combo-low', 'Combo Low', 8);
  p2Board[1] = makeInertEnemy('p2-combo-high', 'Combo High', 12);

  const targets = resolveTargets(
    SPELLS.combo.spec.targets,
    { boardName: 'p1Board', index: 6, tile: p1Board[6] },
    { p1Board, p2Board }
  );

  assert(targets.length === 2, `Expected Combo to resolve two primary target tokens, got ${targets.length}`);
  assert(targets[0]?.board === 'p2' && Number(targets[0]?.index) === 0, `Expected Combo primary hit to target the lowest-health enemy, got ${targets[0]?.board}[${targets[0]?.index}]`);
  assert(targets[1]?.board === 'p2' && Number(targets[1]?.index) === 0, `Expected Combo follow-up hit to reuse the same target, got ${targets[1]?.board}[${targets[1]?.index}]`);
}

async function testComboTauntRedirectsEntireSequence() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const rogue = makeHero({
    id: 'rogue-combo-taunt',
    name: 'Rogue',
    spellId: 'combo',
    slot: 'back',
    energy: 3
  });

  p1Board[6] = makeTile(rogue, {
    id: 'p1-rogue-combo-taunt',
    currentEnergy: 3
  });
  p2Board[0] = makeTile(makeHero({ id: 'taunt-target', name: 'Taunt Target', spellId: 'basicAttack', slot: 'front', energy: 0 }), {
    id: 'p2-taunt-target',
    currentHealth: 12,
    currentEnergy: -1,
    effects: [{ ...EFFECTS.Taunt }]
  });
  p2Board[1] = makeInertEnemy('p2-combo-low-while-taunt', 'Combo Low While Taunt', 6);

  const targets = resolveTargets(
    SPELLS.combo.spec.targets,
    { boardName: 'p1Board', index: 6, tile: p1Board[6] },
    { p1Board, p2Board }
  );

  assert(targets.length === 2, `Expected Combo with Taunt to resolve two target tokens, got ${targets.length}`);
  assert(targets.every(target => target?.board === 'p2' && Number(target?.index) === 0), `Expected Taunt to redirect the entire Combo sequence, got ${targets.map(target => `${target?.board}[${target?.index}]`).join(', ')}`);
}

async function testHonorTauntRedirectsEntireSequence() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const samurai = makeHero({
    id: 'samurai-honor-taunt',
    name: 'Samurai',
    spellId: 'honor',
    slot: 'back',
    energy: 3
  });

  p1Board[6] = makeTile(samurai, {
    id: 'p1-samurai-honor-taunt',
    currentEnergy: 3
  });
  p2Board[0] = makeTile(makeHero({ id: 'taunt-target-honor', name: 'Taunt Target Honor', spellId: 'basicAttack', slot: 'front', energy: 0 }), {
    id: 'p2-taunt-target-honor',
    currentHealth: 8,
    currentEnergy: -1,
    effects: [{ ...EFFECTS.Taunt }]
  });
  p2Board[1] = makeInertEnemy('p2-honor-high-while-taunt', 'Honor High While Taunt', 14);

  const targets = resolveTargets(
    SPELLS.honor.spec.targets,
    { boardName: 'p1Board', index: 6, tile: p1Board[6] },
    { p1Board, p2Board }
  );

  assert(targets.length === 3, `Expected Honor with Taunt to resolve three target tokens, got ${targets.length}`);
  assert(targets.every(target => target?.board === 'p2' && Number(target?.index) === 0), `Expected Taunt to redirect the entire Honor sequence, got ${targets.map(target => `${target?.board}[${target?.index}]`).join(', ')}`);
}

async function testComboQueuesFinisherOnKill() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const rogue = makeHero({
    id: 'rogue-combo-finisher',
    name: 'Rogue',
    spellId: 'combo',
    slot: 'back',
    energy: 3
  });

  p1Board[6] = makeTile(rogue, {
    id: 'p1-rogue-combo-finisher',
    currentEnergy: 3
  });
  p2Board[0] = makeInertEnemy('p2-combo-kill-target', 'Combo Kill Target', 6);
  p2Board[1] = makeInertEnemy('p2-combo-finisher-target', 'Combo Finisher Target', 12);

  const result = await runRound(p1Board, p2Board);

  assert(!result?.p2Board?.[0]?.hero || Number(result?.p2Board?.[0]?.currentHealth) <= 0 || result?.p2Board?.[0]?._dead, 'Expected Combo primary target to die from the two hits');
  assert(Number(result?.p2Board?.[1]?.currentHealth) === 6, `Expected Combo finisher plus post-cast basic attack to leave the highest-health target at 6, got ${result?.p2Board?.[1]?.currentHealth}`);
}

async function main() {
  await testShieldMaidenExcludeSelf();
  console.log('Shield Maiden exclude-self regression PASSED');
  await testHowlUsesFrontRowOnly();
  console.log('Werewolf Howl front-row regression PASSED');
  await testAgonyTollAppliesAcrossFirstCast();
  console.log('Agony Toll board-wide regression PASSED');
  await testRepeatHitDebuffAppliesOncePerTargetSelection();
  console.log('Repeated-hit debuff regression PASSED');
  await testComboHitsSameTargetTwice();
  console.log('Rogue Combo same-target regression PASSED');
  await testComboTauntRedirectsEntireSequence();
  console.log('Rogue Combo taunt regression PASSED');
  await testHonorTauntRedirectsEntireSequence();
  console.log('Samurai Honor taunt regression PASSED');
  await testComboQueuesFinisherOnKill();
  console.log('Rogue Combo finisher regression PASSED');
}

main().catch((error) => {
  console.error('Regression test FAILED:', error.message);
  process.exit(1);
});