import { executeRound } from './src/battleEngine.js';

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

function expect(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

async function runChargeBlockCase() {
  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[2] = makeTile({
    id: 'charge-front-target',
    name: 'Charge Front Target',
    health: 12,
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
  p1Board[1] = makeTile({
    id: 'charge-middle-blocker',
    name: 'Charge Middle Blocker',
    health: 12,
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
    id: 'charge-caster',
    name: 'Charge Caster',
    health: 20,
    armor: 0,
    speed: 5,
    energy: 3,
    spellPower: 0,
    spells: {
      front: { id: 'charge', cost: 3, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  const result = await executeRound(
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [], priorityPlayer: 'player2', roundNumber: 1, addLog: () => {} },
    { castDelayMs: 0, postEffectDelayMs: 0, reactionDelayMs: 0, postCastDelayMs: 0, quiet: true, speedMultiplier: 30 }
  );

  expect(result.p1Board[2]?.hero?.id === 'charge-front-target', 'Charge regression FAILED: front target moved even though the middle row was occupied.');
  expect(result.p1Board[1]?.hero?.id === 'charge-middle-blocker', 'Charge regression FAILED: untargeted middle-row blocker was moved.');
}

async function runFanBlockCase() {
  const p1Board = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Board = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Board[2] = makeTile({
    id: 'fan-front-blocked',
    name: 'Fan Front Blocked',
    health: 12,
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
  p1Board[1] = makeTile({
    id: 'fan-middle-blocker',
    name: 'Fan Middle Blocker',
    health: 12,
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
  p1Board[8] = makeTile({
    id: 'fan-front-open',
    name: 'Fan Front Open',
    health: 12,
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
    id: 'fan-caster',
    name: 'Fan Caster',
    health: 20,
    armor: 0,
    speed: 5,
    energy: 4,
    spellPower: 0,
    spells: {
      front: { id: 'fan', cost: 4, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  const result = await executeRound(
    { p1Board, p2Board, p1Reserve: [], p2Reserve: [], priorityPlayer: 'player2', roundNumber: 1, addLog: () => {} },
    { castDelayMs: 0, postEffectDelayMs: 0, reactionDelayMs: 0, postCastDelayMs: 0, quiet: true, speedMultiplier: 30 }
  );

  expect(result.p1Board[2]?.hero?.id === 'fan-front-blocked', 'Fan regression FAILED: blocked front-row target moved anyway.');
  expect(result.p1Board[1]?.hero?.id === 'fan-middle-blocker', 'Fan regression FAILED: untargeted blocker moved.');
  expect(result.p1Board[7]?.hero?.id === 'fan-front-open', 'Fan regression FAILED: open front-row target did not move back one row.');
}

await runChargeBlockCase();
await runFanBlockCase();

console.log('Targeted moveRowBack regression PASSED');