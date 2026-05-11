import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';
import { EFFECTS } from './src/effects.js';

function makeEmptySlot() {
  return {
    hero: null,
    effects: [],
    spellCasts: []
  };
}

function makeTile(hero, effects = []) {
  return {
    hero: { ...hero },
    currentHealth: Number(hero.health || 0),
    currentArmor: Number(hero.armor || 0),
    currentSpeed: Number(hero.speed || 0),
    currentEnergy: Number(hero.energy || 0),
    currentSpellPower: Number(hero.spellPower || 0),
    effects: effects.map(effect => ({ ...effect })),
    spellCasts: []
  };
}

async function runProjectileCase() {
  SPELLS.__tauntProjectile = {
    id: '__tauntProjectile',
    name: 'Taunt Projectile Test',
    description: 'Test-only projectile spell.',
    spec: {
      targets: [{ type: 'projectile', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 4, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const casts = [];

  p1Board[4] = makeTile({
    id: 'projectile-caster',
    name: 'Projectile Caster',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: '__tauntProjectile', cost: 1, casts: 1 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Board[4] = makeTile({
    id: 'projectile-target',
    name: 'Projectile Target',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Board[6] = makeTile({
    id: 'projectile-taunter',
    name: 'Projectile Taunter',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, [EFFECTS.Taunt]);

  const result = await executeRound(
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [], priorityPlayer: 'player1', roundNumber: 1 },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      quiet: true,
      speedMultiplier: 30,
      onStep: (snapshot) => {
        if (snapshot?.lastAction?.type === 'cast') casts.push(snapshot.lastAction);
      }
    }
  );

  if (Number(result?.p2Board?.[4]?.currentHealth) !== 6) {
    throw new Error(`Projectile case failed: expected intended target at 6 HP, got ${result?.p2Board?.[4]?.currentHealth}; taunter=${result?.p2Board?.[6]?.currentHealth}; casts=${JSON.stringify(casts.map(c => ({ spellId: c?.spellId, primaryTargets: c?.primaryTargets })))}`);
  }
  if (Number(result?.p2Board?.[6]?.currentHealth) !== 10) {
    throw new Error(`Projectile case failed: taunter should be untouched, got ${result?.p2Board?.[6]?.currentHealth}; casts=${JSON.stringify(casts.map(c => ({ spellId: c?.spellId, primaryTargets: c?.primaryTargets })))}`);
  }
}

async function runEffectDrivenCase() {
  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const casts = [];

  p1Board[4] = makeTile({
    id: 'turret-host',
    name: 'Turret Host',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, [EFFECTS.Turret]);

  p2Board[4] = makeTile({
    id: 'turret-target',
    name: 'Turret Target',
    health: 25,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Board[6] = makeTile({
    id: 'turret-taunter',
    name: 'Turret Taunter',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, [EFFECTS.Taunt]);

  const result = await executeRound(
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [], priorityPlayer: 'player1', roundNumber: 1 },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      quiet: true,
      speedMultiplier: 30,
      onStep: (snapshot) => {
        if (snapshot?.lastAction?.type === 'cast') casts.push(snapshot.lastAction);
      }
    }
  );

  if (!(Number(result?.p2Board?.[4]?.currentHealth) < 25)) {
    throw new Error(`Effect-driven case failed: intended target was not damaged; got ${result?.p2Board?.[4]?.currentHealth}; taunter=${result?.p2Board?.[6]?.currentHealth}; casts=${JSON.stringify(casts.map(c => ({ spellId: c?.spellId, primaryTargets: c?.primaryTargets })))}`);
  }
  if (Number(result?.p2Board?.[6]?.currentHealth) !== 10) {
    throw new Error(`Effect-driven case failed: taunter should be untouched, got ${result?.p2Board?.[6]?.currentHealth}; casts=${JSON.stringify(casts.map(c => ({ spellId: c?.spellId, primaryTargets: c?.primaryTargets })))}`);
  }
}

async function runCorpseCase() {
  SPELLS.__tauntCorpseTarget = {
    id: '__tauntCorpseTarget',
    name: 'Taunt Corpse Target Test',
    description: 'Test-only corpse targeting spell.',
    spec: {
      targets: [{ type: 'nearestDeadEnemy', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 0, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const casts = [];

  p1Board[8] = makeTile({
    id: 'corpse-caster',
    name: 'Corpse Caster',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: '__tauntCorpseTarget', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Board[3] = {
    hero: {
      id: 'dead-target',
      name: 'Dead Target',
      health: 10,
      armor: 0,
      allowZeroSpeed: true,
      speed: 0,
      energy: 0,
      spellPower: 0,
      spells: {
        front: { id: 'basicAttack', cost: 99, casts: 0 },
        middle: { id: 'basicAttack', cost: 99, casts: 0 },
        back: { id: 'basicAttack', cost: 99, casts: 0 }
      }
    },
    currentHealth: 0,
    currentArmor: 0,
    currentSpeed: 0,
    currentEnergy: 0,
    currentSpellPower: 0,
    effects: [],
    spellCasts: [],
    _dead: true
  };

  p2Board[6] = makeTile({
    id: 'corpse-taunter',
    name: 'Corpse Taunter',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, [EFFECTS.Taunt]);

  await executeRound(
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [], priorityPlayer: 'player1', roundNumber: 1 },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      quiet: true,
      speedMultiplier: 30,
      onStep: (snapshot) => {
        if (snapshot?.lastAction?.type === 'cast') casts.push(snapshot.lastAction);
      }
    }
  );

  const corpseCast = casts.find(action => action?.spellId === '__tauntCorpseTarget');
  const primaryTargets = Array.isArray(corpseCast?.primaryTargets) ? corpseCast.primaryTargets : [];
  const targetedCorpse = primaryTargets.some(target => target?.boardName === 'p2Board' && Number(target?.index) === 3);
  const targetedTaunter = primaryTargets.some(target => target?.boardName === 'p2Board' && Number(target?.index) === 6);

  if (!targetedCorpse || targetedTaunter) {
    throw new Error(`Corpse case failed: expected corpse target only, got ${JSON.stringify(primaryTargets)}`);
  }
}

async function run() {
  await runProjectileCase();
  await runEffectDrivenCase();
  await runCorpseCase();
  console.log('Taunt exclusion regressions PASSED');
}

run().catch((error) => {
  console.error('Taunt exclusion test crashed:', error);
  process.exit(1);
});
