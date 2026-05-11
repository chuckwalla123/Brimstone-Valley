import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';

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

async function run() {
  SPELLS.__skeletonCleanupAttack = {
    id: '__skeletonCleanupAttack',
    name: 'Skeleton Cleanup Attack',
    description: 'Test-only spell that targets the highest-health enemy.',
    spec: {
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 1, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[4] = makeTile({
    id: 'skeletonID',
    name: 'Skeleton',
    health: 6,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 1,
    spellPower: 0,
    leavesCorpse: false,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: '__skeletonCleanupAttack', cost: 1, casts: 1 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Board[4] = makeTile({
    id: 'warded-target',
    name: 'Warded Target',
    health: 20,
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
  }, [
    {
      name: 'Lethal Wards',
      kind: 'neutral',
      duration: 1,
      onTargeted: { type: 'damage', value: 10 }
    }
  ]);

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

  const skeletonTile = result?.p1Board?.[4] || null;

  if (skeletonTile?.hero) {
    console.error('Skeleton post-cast cleanup regression FAILED: skeleton still occupies the tile after dying.', {
      hero: skeletonTile?.hero?.name,
      currentHealth: skeletonTile?.currentHealth,
      dead: skeletonTile?._dead,
      effects: skeletonTile?.effects,
      spellCasts: skeletonTile?.spellCasts
    });
    process.exit(1);
  }

  if (skeletonTile?._dead) {
    console.error('Skeleton post-cast cleanup regression FAILED: skeleton tile was left as a corpse.', skeletonTile);
    process.exit(1);
  }

  console.log('Skeleton post-cast cleanup regression PASSED');
}

run().catch((error) => {
  console.error('Skeleton post-cast cleanup test crashed:', error);
  process.exit(1);
});
