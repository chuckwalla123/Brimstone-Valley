import { executeRound } from './src/battleEngine.js';
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
    currentHealth: Number(hero.currentHealth != null ? hero.currentHealth : (hero.health || 0)),
    currentArmor: Number(hero.armor || 0),
    currentSpeed: Number(hero.speed || 0),
    currentEnergy: Number(hero.energy || 0),
    currentSpellPower: Number(hero.spellPower || 0),
    effects: effects.map(effect => ({ ...effect })),
    spellCasts: []
  };
}

async function run() {
  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[4] = makeTile({
    id: 'hard-fall-giant',
    name: 'Giant',
    health: 19,
    currentHealth: 5,
    armor: 0,
    speed: 3,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, [
    EFFECTS.HardFall,
    {
      name: 'Round Start Test Pulse',
      kind: 'debuff',
      duration: 1,
      pulse: { type: 'damage', value: 6 }
    }
  ]);

  p2Board[3] = makeTile({
    id: 'slow-enemy',
    name: 'Slow Enemy',
    health: 10,
    armor: 0,
    speed: 2,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Board[5] = makeTile({
    id: 'fast-enemy',
    name: 'Fast Enemy',
    health: 10,
    armor: 0,
    speed: 3,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  const result = await executeRound(
    {
      p1Board,
      p2Board,
      p1Reserve: [],
      p2Reserve: [],
      priorityPlayer: 'player1',
      roundNumber: 1
    },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      quiet: true,
      speedMultiplier: 30
    }
  );

  const giantTile = result?.p1Board?.[4] || null;
  const slowEnemy = result?.p2Board?.[3] || null;
  const fastEnemy = result?.p2Board?.[5] || null;

  if (!giantTile?._dead) {
    console.error('Hard Fall effect-damage regression FAILED: Giant did not die from round-start effect damage.');
    process.exit(1);
  }

  if (Number(slowEnemy?.currentHealth) !== 7) {
    console.error('Hard Fall effect-damage regression FAILED: slow enemy did not take 3 damage from Hard Fall.', slowEnemy?.currentHealth);
    process.exit(1);
  }

  if (Number(fastEnemy?.currentHealth) !== 10) {
    console.error('Hard Fall effect-damage regression FAILED: fast enemy should not have been hit.', fastEnemy?.currentHealth);
    process.exit(1);
  }

  console.log('Hard Fall effect-damage regression PASSED');
}

run().catch((error) => {
  console.error('Hard Fall effect-damage test crashed:', error);
  process.exit(1);
});
