import { executeRound } from './src/battleEngine.js';

function makeTile(hero, id) {
  return {
    hero: { ...hero },
    id,
    currentHealth: hero.health,
    currentArmor: hero.armor,
    currentSpeed: hero.speed,
    currentEnergy: hero.energy,
    currentSpellPower: hero.spellPower,
    effects: [],
    spellCasts: []
  };
}

async function runFocusedDoubleStrikeTest() {
  const casterHero = {
    id: 'doubleStrikeTester',
    name: 'Double Strike Tester',
    health: 60,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    _towerDoubleStrike: 1.0,
    spells: {
      front: { id: 'slash', cost: 1, casts: 1 },
      middle: { id: 'slash', cost: 1, casts: 1 },
      back: { id: 'slash', cost: 1, casts: 1 }
    }
  };

  const targetHero = {
    id: 'targetDummy',
    name: 'Target Dummy',
    health: 999,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 1, casts: 99 },
      middle: { id: 'basicAttack', cost: 1, casts: 99 },
      back: { id: 'basicAttack', cost: 1, casts: 99 }
    }
  };

  const summary = [];

  for (let trial = 1; trial <= 10; trial++) {
    const p1Board = Array(9).fill(null);
    const p2Board = Array(9).fill(null);

    p1Board[2] = makeTile(casterHero, `p1-2-t${trial}`); // P1 front row => uses front slot
    p2Board[0] = makeTile(targetHero, `p2-0-t${trial}`);

    // Seed exactly one paid cast; bonus cast (if any) should be appended by engine.
    p1Board[2].currentEnergy = 1;
    p1Board[2]._lastAutoCastEnergy = 1;
    p1Board[2].spellCasts = [{
      spellId: 'slash',
      slot: 'front',
      queuedEnergy: 1,
      queuedCost: 1
    }];

    let casterCastEvents = 0;
    let casterSlashEvents = 0;

    const result = await executeRound(
      {
        p1Board,
        p2Board,
        p1Reserve: [],
        p2Reserve: [],
        addLog: null,
        priorityPlayer: 'player1'
      },
      {
        castDelayMs: 0,
        postEffectDelayMs: 0,
        onStep: (state) => {
          const action = state?.lastAction;
          if (!action || action.type !== 'cast') return;
          const caster = action.caster;
          if (caster?.boardName === 'p1Board' && caster?.index === 2) {
            casterCastEvents += 1;
            if (action.spellId === 'slash') casterSlashEvents += 1;
          }
        }
      }
    );

    const postEnergy = Number(result?.p1Board?.[2]?.currentEnergy ?? 0);
    const targetHp = Number(result?.p2Board?.[0]?.currentHealth ?? 0);

    summary.push({
      trial,
      casterCastEvents,
      casterSlashEvents,
      postEnergy,
      targetHp
    });
  }

  console.log('\n=== Focused Double Strike Test (10 isolated trials) ===');
  summary.forEach((r) => {
    console.log(
      `Trial ${r.trial}: castEvents=${r.casterCastEvents}, slashCasts=${r.casterSlashEvents}, postEnergy=${r.postEnergy}, targetHP=${r.targetHp}`
    );
  });

  const allRoundsDoubleCast = summary.every((r) => r.casterSlashEvents >= 2);
  const allRoundsEnergyFreeBonus = summary.every((r) => r.postEnergy === 0);

  console.log('\n=== Result ===');
  console.log(`Double Strike triggered each round (expect true): ${allRoundsDoubleCast}`);
  console.log(`Bonus cast did not consume extra energy (expect true): ${allRoundsEnergyFreeBonus}`);

  if (!allRoundsDoubleCast || !allRoundsEnergyFreeBonus) {
    process.exitCode = 1;
  }
}

runFocusedDoubleStrikeTest().catch((err) => {
  console.error('Focused Double Strike test failed with exception:', err);
  process.exit(1);
});
