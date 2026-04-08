import { executeRound } from './src/battleEngine.js';
import { SPELLS } from './src/spells.js';
import { generateBossLevel } from './src/tower/towerState.js';

function makeTile(hero, id) {
  return {
    id,
    hero: { ...hero },
    currentHealth: Number(hero.currentHealth ?? hero.health ?? 0),
    currentArmor: Number(hero.currentArmor ?? hero.armor ?? 0),
    currentSpeed: Number(hero.currentSpeed ?? hero.speed ?? 0),
    currentEnergy: Number(hero.currentEnergy ?? hero.energy ?? 0),
    currentSpellPower: Number(hero.currentSpellPower ?? hero.spellPower ?? 0),
    effects: [],
    spellCasts: []
  }; 
}

async function run() {
  SPELLS.basicAttack = {
    ...SPELLS.basicAttack,
    description: 'Fallback attack for this test: deals 8 damage ignoring armor.',
    spec: {
      ...SPELLS.basicAttack.spec,
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 8, ignoreArmor: true, ignoreSpellPower: true },
      animationMs: 0
    }
  };

  const attacker = {
    id: 'bossMitigationTester',
    name: 'Boss Mitigation Tester',
    health: 30,
    armor: 0,
    speed: 10,
    energy: 1,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 1, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };

  const boss = generateBossLevel(40).boss;
  boss.speed = 0;
  boss.currentSpeed = 0;
  boss.energy = 0;
  boss.currentEnergy = 0;
  boss.spells = {
    front: { id: 'basicAttack', cost: 99, casts: 0 },
    middle: { id: 'basicAttack', cost: 99, casts: 0 },
    back: { id: 'basicAttack', cost: 99, casts: 0 }
  };

  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);
  p1Board[0] = makeTile(attacker, 'p1-attacker');
  p2Board[0] = makeTile(boss, 'p2-boss');

  const startHealth = Number(p2Board[0].currentHealth || 0);
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

  const endHealth = Number(result?.p2Board?.[0]?.currentHealth ?? startHealth);
  const damageTaken = Math.max(0, startHealth - endHealth);
  const expectedDamage = 6;
  const hasMitigation = Number(boss._towerIncomingDamageMultiplier || 1) === 0.75;
  const pass = hasMitigation && damageTaken === expectedDamage;

  console.log('\n=== Level 40 Boss Damage Reduction Regression ===');
  console.log(`Boss mitigation multiplier (expected 0.75): ${boss._towerIncomingDamageMultiplier}`);
  console.log(`Damage taken from 8 ignore-armor damage (expected ${expectedDamage}): ${damageTaken}`);
  console.log(`Result: ${pass ? 'PASS' : 'FAIL'}`);

  if (!pass) {
    console.log('\n--- Debug logs ---');
    logs
      .filter((line) => (
        line.includes('Resolving cast from')
        || line.includes('basicAttack')
        || line.includes('damage')
        || line.includes('Boss Mitigation')
      ))
      .slice(0, 80)
      .forEach((line) => console.log(line));
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('Level 40 boss damage reduction test failed with exception:', err);
  process.exit(1);
});