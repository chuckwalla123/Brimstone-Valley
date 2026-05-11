import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';

function makeEmptySlot() {
  return {
    hero: null,
    effects: [],
    spellCasts: []
  };
}

function makeTile(hero) {
  return {
    hero: { ...hero },
    currentHealth: Number(hero.health || 0),
    currentArmor: Number(hero.armor || 0),
    currentSpeed: Number(hero.speed || 0),
    currentEnergy: Number(hero.energy || 0),
    currentSpellPower: Number(hero.spellPower || 0),
    effects: [],
    spellCasts: []
  };
}

async function run() {
  SPELLS.__priorityTieRotationSpell = {
    id: '__priorityTieRotationSpell',
    name: 'Priority Tie Rotation Test',
    description: 'Test-only spell for tie rotation.',
    spec: {
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 0, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const casts = [];

  p1Board[2] = makeTile({
    id: 'p1-tie-caster',
    name: 'P1 Tie Caster',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: '__priorityTieRotationSpell', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Board[6] = makeTile({
    id: 'p2-tie-caster',
    name: 'P2 Tie Caster',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: '__priorityTieRotationSpell', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

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

  if (result?.priorityPlayer !== 'player2') {
    console.error('Priority tie rotation regression FAILED: priority should rotate to player2 after the tie.', {
      priorityPlayer: result?.priorityPlayer,
      casts: casts.map(c => ({ caster: c?.caster, spellId: c?.spellId }))
    });
    process.exit(1);
  }

  console.log('Priority tie rotation regression PASSED');
}

run().catch((error) => {
  console.error('Priority tie rotation test crashed:', error);
  process.exit(1);
});
