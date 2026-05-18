import { executeRound } from './src/battleEngine.js';
import { HEROES } from './src/heroes.js';
import { SPELLS } from './src/spells.js';
import { EFFECTS } from './src/effects.js';

function makeTile(hero, extras = {}) {
  return {
    hero: { ...hero },
    currentHealth: Number(extras.currentHealth ?? hero.health ?? 0),
    currentArmor: Number(extras.currentArmor ?? hero.armor ?? 0),
    currentSpeed: Number(extras.currentSpeed ?? hero.speed ?? 0),
    currentEnergy: Number(extras.currentEnergy ?? hero.energy ?? 0),
    currentSpellPower: Number(extras.currentSpellPower ?? hero.spellPower ?? 0),
    effects: Array.isArray(extras.effects) ? extras.effects.map((effect) => ({ ...effect })) : [],
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

function expect(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

async function runFreshCorpseCase() {
  SPELLS.__testKillLowest = {
    id: '__testKillLowest',
    name: 'Test Kill Lowest',
    description: 'Test-only kill spell.',
    spec: {
      targets: [{ type: 'lowestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 5, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 100
    }
  };

  const necromancer = HEROES.find((hero) => hero && hero.id === 'necromancerID');
  expect(!!necromancer, 'Fresh corpse regression setup FAILED: could not find Necromancer hero.');

  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[4] = makeTile(necromancer, { currentEnergy: 2, currentSpeed: 1 });
  p1Board[3] = makeTile({
    id: 'fresh-corpse-victim',
    name: 'Fresh Corpse Victim',
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
  });

  p2Board[0] = makeTile({
    id: 'fresh-corpse-killer',
    name: 'Fresh Corpse Killer',
    health: 10,
    armor: 0,
    speed: 5,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: '__testKillLowest', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  const result = await executeRound(
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [], priorityPlayer: 'player2', roundNumber: 1, addLog: () => {} },
    { castDelayMs: 0, postEffectDelayMs: 0, reactionDelayMs: 0, postCastDelayMs: 0, quiet: true, speedMultiplier: 30 }
  );

  expect(result.p1Board[3]?.hero?.id === 'skeletonID', 'Fresh corpse regression FAILED: Raise Dead did not replace a same-round corpse with a Skeleton.');
  expect(result.p1Board[3]?._dead !== true, 'Fresh corpse regression FAILED: expected the summoned Skeleton to be alive after the round.');
}

async function runRoundStartDeferredDeathCase() {
  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[0] = makeTile({
    id: 'round-start-nymph',
    name: 'Round Start Nymph',
    health: 1,
    armor: 0,
    speed: 0,
    energy: -1,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, {
    currentEnergy: -1,
    effects: [{ ...EFFECTS.Bleed }]
  });

  p2Board[0] = makeTile({
    id: 'spores-host',
    name: 'Spores Host',
    health: 10,
    armor: 0,
    speed: 0,
    energy: -1,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  }, {
    currentEnergy: -1,
    effects: [{
      ...EFFECTS.Spores,
      appliedBy: { boardName: 'p1Board', index: 0 },
      appliedByBoardName: 'p1Board',
      appliedByIndex: 0,
      appliedByHeroId: 'round-start-nymph'
    }]
  });

  const result = await executeRound(
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [], priorityPlayer: 'player1', roundNumber: 1, addLog: () => {} },
    { castDelayMs: 0, postEffectDelayMs: 0, reactionDelayMs: 0, postCastDelayMs: 0, quiet: true, speedMultiplier: 30 }
  );

  expect(result.p1Board[0]?.hero?.id === 'round-start-nymph', 'Round-start death regression FAILED: expected the nymph to remain on the board.');
  expect(result.p1Board[0]?._dead !== true, 'Round-start death regression FAILED: nymph was finalized dead before Spores healed the applier.');
  expect(Number(result.p1Board[0]?.currentHealth || 0) === 1, `Round-start death regression FAILED: expected nymph to end at 1 HP, got ${result.p1Board[0]?.currentHealth}.`);
}

await runFreshCorpseCase();
await runRoundStartDeferredDeathCase();

console.log('Round-start death and fresh-corpse regressions PASSED');