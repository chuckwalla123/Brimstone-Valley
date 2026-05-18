import { executeRound } from './src/battleEngine.js';

function emptySlot() {
  return { hero: null, effects: [], spellCasts: [] };
}

function makeTile(hero, extra = {}) {
  return {
    hero: { ...hero },
    currentHealth: Number(extra.currentHealth ?? hero.health ?? 0),
    currentArmor: Number(extra.currentArmor ?? hero.armor ?? 0),
    currentSpeed: Number(extra.currentSpeed ?? hero.speed ?? 0),
    currentEnergy: Number(extra.currentEnergy ?? hero.energy ?? 0),
    currentSpellPower: Number(extra.currentSpellPower ?? hero.spellPower ?? 0),
    effects: Array.isArray(extra.effects) ? extra.effects.map((effect) => ({ ...effect })) : [],
    spellCasts: Array.isArray(extra.spellCasts) ? extra.spellCasts.map((cast) => ({ ...cast })) : [],
    _castsRemaining: extra._castsRemaining ? { ...extra._castsRemaining } : null,
    _lastAutoCastEnergy: extra._lastAutoCastEnergy,
  };
}

async function run() {
  const p1Board = Array.from({ length: 9 }, emptySlot);
  const p2Board = Array.from({ length: 9 }, emptySlot);

  p1Board[4] = makeTile({
    id: 'kingID',
    name: 'King',
    health: 12,
    armor: 2,
    speed: 5,
    energy: 3,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'benevolence', cost: 3, casts: 1 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, {
    currentEnergy: 3,
    spellCasts: [{ spellId: 'benevolence', slot: 'middle' }],
    _castsRemaining: { front: 0, middle: 1, back: 0 }
  });

  p1Board[6] = makeTile({
    id: 'angelID',
    name: 'Angel',
    health: 10,
    armor: 1,
    speed: 1,
    energy: 3,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'prayer', cost: 3, casts: 0 }
    }
  }, {
    currentEnergy: 3,
    _castsRemaining: { front: 0, middle: 0, back: 0 },
    _lastAutoCastEnergy: 3
  });

  p2Board[4] = makeTile({
    id: 'dummyID',
    name: 'Dummy',
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
  });

  const castIds = [];
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
        if (snapshot?.lastAction?.type === 'cast') {
          castIds.push(snapshot.lastAction.spellId);
        }
      }
    }
  );

  if (!castIds.includes('prayer')) {
    console.error('Benevolence requeue regression FAILED: Prayer was not cast after Benevolence granted a row cast.', castIds);
    process.exit(1);
  }

  console.log('Benevolence requeue regression PASSED');
}

run().catch((error) => {
  console.error('Benevolence requeue regression crashed:', error);
  process.exit(1);
});