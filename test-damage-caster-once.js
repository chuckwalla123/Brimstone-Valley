import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';

function makeTile(hero, id) {
  return {
    hero: { ...hero },
    id,
    currentHealth: Number(hero.health || 0),
    currentArmor: Number(hero.armor || 0),
    currentSpeed: Number(hero.speed || 0),
    currentEnergy: Number(hero.energy || 0),
    currentSpellPower: Number(hero.spellPower || 0),
    effects: [],
    spellCasts: []
  };
}

async function runRegression() {
  const TEST_SPELL_ID = '__testDamageCasterOnce';
  SPELLS[TEST_SPELL_ID] = {
    id: TEST_SPELL_ID,
    name: 'Test Damage Caster Once',
    description: 'Test-only board spell with post.damageCaster.',
    spec: {
      targets: [{ type: 'board', side: 'enemy' }],
      formula: { type: 'attackPower', value: 2 },
      post: { damageCaster: { amount: 7, asAttackPower: false } },
      animationMs: 200
    },
    animation: 'Slash_2x2_4frames',
    animationPlacement: 'inplace'
  };

  const casterHero = {
    id: 'postDamageCasterTester',
    name: 'Post Damage Caster Tester',
    health: 50,
    armor: 0,
    speed: 0,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: TEST_SPELL_ID, cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 1 },
      back: { id: 'basicAttack', cost: 99, casts: 1 }
    }
  };

  const targetHero = {
    id: 'dummy',
    name: 'Dummy',
    health: 20,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 1 },
      back: { id: 'basicAttack', cost: 99, casts: 1 }
    }
  };

  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  // Caster in front row
  p1Board[2] = makeTile(casterHero, 'p1-2-caster');

  // 4 enemy targets to reproduce the historical multi-proc bug
  p2Board[0] = makeTile(targetHero, 'p2-0');
  p2Board[1] = makeTile(targetHero, 'p2-1');
  p2Board[3] = makeTile(targetHero, 'p2-3');
  p2Board[4] = makeTile(targetHero, 'p2-4');

  const casterStartHealth = Number(p1Board[2].currentHealth || 0);
  const selfHitAmount = 7;

  const logs = [];
  const result = await executeRound(
    {
      p1Board,
      p2Board,
      p1Reserve: [],
      p2Reserve: [],
      addLog: (line) => { logs.push(String(line || '')); },
      priorityPlayer: 'player1'
    },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0
    }
  );

  const casterEndHealth = Number(result?.p1Board?.[2]?.currentHealth ?? casterStartHealth);
  const casterDamageTaken = Math.max(0, casterStartHealth - casterEndHealth);
  const postDamageCasterLogs = logs.filter((line) => line.includes('post.damageCaster dealt'));

  const expectedCasterDamage = selfHitAmount;
  const pass =
    postDamageCasterLogs.length === 1
    && postDamageCasterLogs[0].includes(`dealt ${expectedCasterDamage}`);

  console.log('\n=== post.damageCaster Once-Per-Cast Regression ===');
  console.log(`Enemy targets alive at cast time: 4`);
  console.log(`post.damageCaster log entries (expected 1): ${postDamageCasterLogs.length}`);
  console.log(`Caster damage taken (informational): ${casterDamageTaken}`);
  console.log(`Result: ${pass ? 'PASS' : 'FAIL'}`);

  if (!pass) {
    console.log('\n--- Debug logs (filtered) ---');
    logs
      .filter((line) => (
        line.includes('Resolving cast from')
        || line.includes(TEST_SPELL_ID)
        || line.includes('Skipping cast from')
        || line.includes('spent ')
        || line.includes('post.damageCaster')
      ))
      .slice(0, 80)
      .forEach((line) => console.log(line));
    process.exitCode = 1;
  }
}

runRegression().catch((err) => {
  console.error('post.damageCaster regression test failed with exception:', err);
  process.exit(1);
});
