// Targeted regression test for global row-based basic attack behavior.
// Run with: node test-basic-attack-row-based.js

import { executeRound } from './src/battleEngine.js';

function makeHero(id, name, energy = 3) {
  return {
    id,
    name,
    health: 20,
    armor: 0,
    speed: 0,
    energy,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 1, casts: 0 },
      middle: { id: 'basicAttack', cost: 1, casts: 2 },
      back: { id: 'basicAttack', cost: 1, casts: 2 }
    }
  };
}

function makeEnemy(id, name) {
  return {
    id,
    name,
    health: 40,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 1, casts: 0 },
      middle: { id: 'basicAttack', cost: 1, casts: 0 },
      back: { id: 'basicAttack', cost: 1, casts: 0 }
    }
  };
}

function getSpellId(action) {
  if (!action || typeof action !== 'object') return null;
  return action.spellId || action.spell?.id || action.castSpellId || null;
}

async function run() {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  // P1 index 2 is front row for p1 mapping.
  p1Board[2] = { hero: makeHero('row-basic-tester', 'Row Basic Tester', 3) };
  // P2 index 0 is front row for p2 mapping and gives a valid target.
  p2Board[0] = { hero: makeEnemy('enemy-anchor', 'Enemy Anchor') };

  const actions = [];
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
      speedMultiplier: 30,
      onStep: (snapshot) => {
        if (snapshot?.lastAction) actions.push(snapshot.lastAction);
      }
    }
  );

  const p1Casts = actions.filter((a) => a?.type === 'cast' && a?.caster?.boardName === 'p1Board' && Number(a?.caster?.index) === 2);
  const p1BasicCasts = p1Casts.filter((a) => getSpellId(a) === 'basicAttack');
  const p1NonBasicCasts = p1Casts.filter((a) => getSpellId(a) !== 'basicAttack');

  const casterTile = result?.p1Board?.[2] || null;
  const casterEnergy = Number(casterTile?.currentEnergy ?? casterTile?.hero?.currentEnergy ?? casterTile?.hero?.energy ?? 0);

  const failures = [];
  if (p1BasicCasts.length !== 1) {
    failures.push(`Expected exactly 1 basic attack cast from p1[2], got ${p1BasicCasts.length}`);
  }
  if (p1NonBasicCasts.length !== 0) {
    failures.push(`Expected 0 non-basic casts from p1[2], got ${p1NonBasicCasts.length}`);
  }
  if (casterEnergy !== 0) {
    failures.push(`Expected p1[2] energy to be 0 after basic attack, got ${casterEnergy}`);
  }

  if (failures.length > 0) {
    console.error('\nBasic attack row-based regression FAILED:');
    failures.forEach((msg) => console.error(`- ${msg}`));
    process.exit(1);
  }

  console.log('\nBasic attack row-based regression PASSED');
  console.log(`- p1 basic casts: ${p1BasicCasts.length}`);
  console.log(`- p1 non-basic casts: ${p1NonBasicCasts.length}`);
  console.log(`- p1 final energy: ${casterEnergy}`);
}

run().catch((error) => {
  console.error('Test crashed:', error);
  process.exit(1);
});
