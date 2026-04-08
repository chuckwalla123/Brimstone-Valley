import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';

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

function makeEmptySlot() {
  return {
    hero: null,
    effects: [],
    spellCasts: []
  };
}

async function run() {
  SPELLS.__movementRequeueTestSpell = {
    id: '__movementRequeueTestSpell',
    name: 'Movement Requeue Test',
    description: 'Test-only spell used to verify row-based requeue after movement.',
    spec: {
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 9, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[2] = makeTile({
    id: 'movement-requeue-victim',
    name: 'Movement Requeue Victim',
    health: 20,
    armor: 0,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 1, casts: 0 },
      middle: { id: '__movementRequeueTestSpell', cost: 1, casts: 1 },
      back: { id: 'basicAttack', cost: 1, casts: 0 }
    }
  });

  p2Board[0] = makeTile({
    id: 'movement-requeue-gale',
    name: 'Movement Requeue Fan',
    health: 30,
    armor: 0,
    speed: 0,
    energy: 2,
    spellPower: 0,
    spells: {
      front: { id: 'fan', cost: 3, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  const casts = [];
  const logs = [];
  const result = await executeRound(
    {
      p1Board,
      p2Board,
      p1Reserve: [],
      p2Reserve: [],
      priorityPlayer: 'player2',
      roundNumber: 1,
      addLog: (line) => logs.push(String(line || ''))
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

  const victimCasts = casts.filter(action => action?.caster?.boardName === 'p1Board');
  const spellIds = victimCasts.map(action => action?.spellId);

  if (spellIds[0] !== '__movementRequeueTestSpell') {
    console.error('Basic attack movement requeue regression FAILED: victim did not rebuild into the new row spell first', spellIds);
    process.exit(1);
  }

  if (!spellIds.includes('__movementRequeueTestSpell')) {
    const finalIndex = (result?.p1Board || []).findIndex(tile => tile && tile.hero && tile.hero.id === 'movement-requeue-victim');
    console.error(`Final victim board index: ${finalIndex}`);
    console.error(`Final queued casts: ${JSON.stringify((finalIndex >= 0 && result?.p1Board?.[finalIndex] && result.p1Board[finalIndex].spellCasts) || [])}`);
    console.error('Relevant logs:');
    logs.filter(line => line.includes('movement-requeue') || line.includes('fan') || line.includes('basicAttack') || line.includes('Recalculating queued casts') || line.includes('Auto-cast')).forEach(line => console.error(line));
    console.error('Basic attack movement requeue regression FAILED: victim did not recast from new row', spellIds);
    process.exit(1);
  }

  console.log('Basic attack movement requeue regression PASSED');
  console.log(`- victim casts: ${JSON.stringify(spellIds)}`);
}

run().catch((error) => {
  console.error('Basic attack movement requeue test crashed:', error);
  process.exit(1);
});