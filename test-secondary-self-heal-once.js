import { executeRound } from './src/battleEngine.js';

function makeTile(hero, id, boardName, index) {
  return {
    id,
    boardName,
    index,
    hero,
    currentHealth: Number(hero.health || 0),
    currentArmor: Number(hero.armor || 0),
    currentSpeed: Number(hero.speed || 0),
    currentEnergy: Number(hero.energy || 0),
    currentSpellPower: Number(hero.spellPower || 0),
    effects: [],
    spellCasts: []
  };
}

function makeDummyEnemy() {
  return {
    id: 'dummyID',
    name: 'Dummy',
    health: 20,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    passives: [],
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };
}

async function runCase({ name, spellId, expectedHeal }) {
  const logs = [];
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  const caster = {
    id: `tester-${spellId}`,
    name,
    health: 15,
    armor: 0,
    speed: 0,
    energy: 2,
    spellPower: 0,
    passives: [],
    spells: {
      front: { id: spellId, cost: 2, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };

  p1Board[2] = makeTile(caster, 'p1-2-caster', 'p1Board', 2);
  p2Board[0] = makeTile(makeDummyEnemy(), 'p2-0-dummy', 'p2Board', 0);

  p1Board[2].currentHealth = 5;
  p1Board[2].currentEnergy = 2;

  const beforeHealth = Number(p1Board[2].currentHealth || 0);

  const result = await executeRound(
    {
      p1Board,
      p2Board,
      p1Reserve: [],
      p2Reserve: [],
      priorityPlayer: 'player1',
      roundNumber: 1,
      addLog: (line) => logs.push(String(line || ''))
    },
    {
      quiet: true,
      castDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      postEffectDelayMs: 0,
      speedMultiplier: 100
    }
  );

  const afterHealth = Number(result?.p1Board?.[2]?.currentHealth || 0);
  const healedBy = afterHealth - beforeHealth;
  const casterHealLogNeedle = `Applied deferred health change ${expectedHeal} to p1Board[2]`;
  const casterHealLogs = logs.filter((line) => line.includes('Applied deferred health change') && line.includes('to p1Board[2]') && !line.includes(' -'));
  const expectedHealLoggedOnce = logs.filter((line) => line.includes(casterHealLogNeedle)).length === 1;
  const pass = expectedHealLoggedOnce && casterHealLogs.length === 1;

  return {
    name: `${spellId} heals exactly ${expectedHeal}`,
    pass,
    beforeHealth,
    afterHealth,
    healedBy,
    casterHealLogs,
    expectedHealLoggedOnce,
    logs
  };
}

async function main() {
  const cases = [];
  cases.push(await runCase({ name: 'WerewolfTester', spellId: 'bite', expectedHeal: 1 }));
  cases.push(await runCase({ name: 'DragonlingTester', spellId: 'claw', expectedHeal: 2 }));

  let allPass = true;
  console.log('=== Secondary Self-Heal Once Regression ===');
  for (const c of cases) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} - ${c.name}`);
    console.log(`  before=${c.beforeHealth}, after=${c.afterHealth}, healedBy=${c.healedBy}, casterHealLogs=${c.casterHealLogs.length}, expectedHealLoggedOnce=${c.expectedHealLoggedOnce}`);
    if (!c.pass) {
      allPass = false;
      c.logs.filter((line) => line.includes('healed') || line.includes('Applied deferred health change')).slice(0, 60).forEach((line) => console.log(line));
    }
  }

  if (!allPass) process.exit(1);
}

main().catch((err) => {
  console.error('Secondary self-heal regression test failed with exception:', err);
  process.exit(1);
});
