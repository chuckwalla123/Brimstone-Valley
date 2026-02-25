import { executeRound } from '../src/battleEngine.js';
import { HEROES } from '../src/heroes.js';
import { makeEmptyMain, makeReserve } from '../shared/gameLogic.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function heroById(id, { castsBySlot = null } = {}) {
  const base = HEROES.find(h => h.id === id);
  if (!base) throw new Error(`Hero not found: ${id}`);
  const hero = clone(base);
  if (castsBySlot && hero.spells) {
    ['front', 'middle', 'back'].forEach((slot) => {
      if (!hero.spells[slot]) return;
      if (typeof castsBySlot[slot] === 'number') {
        hero.spells[slot].casts = castsBySlot[slot];
      }
    });
  }
  return hero;
}

async function testQuicknessTargetUsesPostSpendEnergy() {
  const p1Board = makeEmptyMain('p1');
  const p2Board = makeEmptyMain('p2');
  const p1Reserve = makeReserve('p1');
  const p2Reserve = makeReserve('p2');

  const priest = heroById('priestID', { castsBySlot: { front: 1, middle: 0, back: 0 } });
  const allySpirit = heroById('tetheredSpiritID', { castsBySlot: { front: 0, middle: 0, back: 0 } });
  const enemyDummy = heroById('executionerID', { castsBySlot: { front: 0, middle: 0, back: 0 } });

  // P1 front row indices: [2,5,8]
  p1Board[2].hero = priest;
  p1Board[2].currentEnergy = 3;

  p1Board[5].hero = allySpirit;
  p1Board[5].currentEnergy = 4;

  p2Board[0].hero = enemyDummy;
  p2Board[0].currentEnergy = 0;

  const logs = [];
  const result = await executeRound({
    p1Board,
    p2Board,
    p1Reserve,
    p2Reserve,
    addLog: (line) => logs.push(String(line || '')),
    priorityPlayer: 'player1',
    roundNumber: 1
  }, {
    quiet: true,
    castDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    postEffectDelayMs: 0,
    speedMultiplier: 100
  });

  const casterEffects = (result.p1Board[2]?.effects || []).map(e => e?.name).filter(Boolean);
  const allyEffects = (result.p1Board[5]?.effects || []).map(e => e?.name).filter(Boolean);
  const passed = !casterEffects.includes('Quickness') && allyEffects.includes('Quickness');

  return {
    passed,
    details: {
      casterEffects,
      allyEffects,
      casterEnergyAfter: result.p1Board[2]?.currentEnergy,
      allyEnergyAfter: result.p1Board[5]?.currentEnergy
    },
    logs
  };
}

async function testReapExecutesAlreadyAtTwoHealthWhenActivated() {
  const p1Board = makeEmptyMain('p1');
  const p2Board = makeEmptyMain('p2');
  const p1Reserve = makeReserve('p1');
  const p2Reserve = makeReserve('p2');

  const reaper = heroById('reaperID', { castsBySlot: { front: 0, middle: 1, back: 0 } });
  const enemyTarget = heroById('priestID', { castsBySlot: { front: 0, middle: 0, back: 0 } });

  // P1 middle row indices: [1,4,7]
  p1Board[1].hero = reaper;
  p1Board[1].currentEnergy = 2;

  p2Board[0].hero = enemyTarget;
  p2Board[0].currentHealth = 2;
  p2Board[0].currentEnergy = 0;

  const logs = [];
  const result = await executeRound({
    p1Board,
    p2Board,
    p1Reserve,
    p2Reserve,
    addLog: (line) => logs.push(String(line || '')),
    priorityPlayer: 'player1',
    roundNumber: 1
  }, {
    quiet: true,
    castDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    postEffectDelayMs: 0,
    speedMultiplier: 100
  });

  const enemyTile = result.p2Board[0];
  const passed = !!enemyTile && (enemyTile._dead === true || Number(enemyTile.currentHealth || 0) <= 0);

  return {
    passed,
    details: {
      enemyDead: enemyTile?._dead,
      enemyHealthAfter: enemyTile?.currentHealth,
      enemyEffectsAfter: (enemyTile?.effects || []).map(e => e?.name).filter(Boolean)
    },
    logs
  };
}

async function main() {
  const quickness = await testQuicknessTargetUsesPostSpendEnergy();
  const reap = await testReapExecutesAlreadyAtTwoHealthWhenActivated();

  const allPassed = quickness.passed && reap.passed;

  console.log('Quickness post-spend targeting:', quickness.passed ? 'PASS' : 'FAIL');
  console.log('  Details:', JSON.stringify(quickness.details));

  console.log('Reap executes at <=2 when activated:', reap.passed ? 'PASS' : 'FAIL');
  console.log('  Details:', JSON.stringify(reap.details));

  if (!allPassed) {
    console.log('\n--- Debug excerpts ---');
    if (!quickness.passed) {
      console.log('[Quickness]');
      quickness.logs.slice(-20).forEach(l => console.log(l));
    }
    if (!reap.passed) {
      console.log('[Reap]');
      reap.logs.slice(-20).forEach(l => console.log(l));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
