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
  SPELLS.__roundStartDeathCleanupSpell = {
    id: '__roundStartDeathCleanupSpell',
    name: 'Round Start Death Cleanup Spell',
    description: 'Test-only spell that targets the highest-health enemy.',
    spec: {
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 4, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[2] = makeTile({
    id: 'round-start-victim',
    name: 'Round Start Victim',
    health: 1,
    armor: 0,
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
      name: 'Round Start Turret Test',
      kind: 'debuff',
      duration: 1,
      pulse: { type: 'damage', value: 2 }
    }
  ]);

  p2Board[0] = makeTile({
    id: 'round-start-attacker',
    name: 'Round Start Attacker',
    health: 20,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: '__roundStartDeathCleanupSpell', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  const casts = [];
  const result = await executeRound(
    {
      p1Board,
      p2Board,
      p1Reserve: [],
      p2Reserve: [],
      priorityPlayer: 'player2',
      roundNumber: 1
    },
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

  const attackerCast = casts.find(action => action?.spellId === '__roundStartDeathCleanupSpell');
  const primaryTargets = Array.isArray(attackerCast?.primaryTargets) ? attackerCast.primaryTargets : [];
  const victimTargeted = primaryTargets.some(target => target?.boardName === 'p1Board' && Number(target?.index) === 2);
  const victimTile = result?.p1Board?.[2] || null;

  if (!victimTile?._dead) {
    console.error('Round-start death cleanup regression FAILED: victim was not dead before casts resolved');
    process.exit(1);
  }

  if (victimTargeted) {
    console.error('Round-start death cleanup regression FAILED: first cast still targeted the dead victim');
    process.exit(1);
  }

  console.log('Round-start death cleanup regression PASSED');
  console.log(`- attacker primary targets: ${JSON.stringify(primaryTargets)}`);
}

run().catch((error) => {
  console.error('Round-start death cleanup test crashed:', error);
  process.exit(1);
});