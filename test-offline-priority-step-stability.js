import { processMove } from './shared/gameLogic.js';
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
  SPELLS.__offlinePriorityStepSpell = {
    id: '__offlinePriorityStepSpell',
    name: 'Offline Priority Step Stability Test',
    description: 'Test-only spell for offline priority snapshot stability.',
    spec: {
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 0, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 200
    }
  };

  const p1Main = Array.from({ length: 9 }, () => makeEmptySlot());
  const p2Main = Array.from({ length: 9 }, () => makeEmptySlot());

  p1Main[2] = makeTile({
    id: 'offline-priority-p1',
    name: 'Offline Priority P1',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: '__offlinePriorityStepSpell', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  p2Main[6] = makeTile({
    id: 'offline-priority-p2',
    name: 'Offline Priority P2',
    health: 10,
    armor: 0,
    allowZeroSpeed: true,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: '__offlinePriorityStepSpell', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  });

  const gameState = {
    p1Main,
    p2Main,
    p1Reserve: [],
    p2Reserve: [],
    phase: 'battle',
    priorityPlayer: 'player1',
    roundNumber: 0,
    gameMode: 'classic'
  };

  const result = await processMove(
    gameState,
    { type: 'startRound', priorityPlayer: 'player1', speedMultiplier: 30 },
    null,
    { returnSteps: true }
  );

  const steps = Array.isArray(result?.steps) ? result.steps : [];
  const finalStep = steps[steps.length - 1];
  const earlyPriorityLeak = steps.find((step) => {
    const type = String(step?.type || '');
    if (type === 'roundComplete' || type === 'gameEnd') return false;
    return step?.state?.priorityPlayer && step.state.priorityPlayer !== 'player1';
  });

  if (earlyPriorityLeak) {
    console.error('Offline priority snapshot regression FAILED: mid-round step leaked rotated priority.', {
      type: earlyPriorityLeak.type,
      priorityPlayer: earlyPriorityLeak?.state?.priorityPlayer,
      seq: earlyPriorityLeak?.seq
    });
    process.exit(1);
  }

  if ((result?.state?.priorityPlayer || null) !== 'player2') {
    console.error('Offline priority snapshot regression FAILED: final offline state did not persist rotated priority.', {
      priorityPlayer: result?.state?.priorityPlayer,
      finalStepType: finalStep?.type,
      finalStepPriorityPlayer: finalStep?.state?.priorityPlayer
    });
    process.exit(1);
  }

  if ((finalStep?.state?.priorityPlayer || null) !== 'player2') {
    console.error('Offline priority snapshot regression FAILED: final step did not expose rotated priority.', {
      finalStepType: finalStep?.type,
      finalStepPriorityPlayer: finalStep?.state?.priorityPlayer
    });
    process.exit(1);
  }

  console.log('Offline priority snapshot regression PASSED');
}

run().catch((error) => {
  console.error('Offline priority snapshot test crashed:', error);
  process.exit(1);
});