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

async function main() {
  const logs = [];

  const demon = {
    id: 'demonID',
    name: 'Demon',
    health: 10,
    armor: 0,
    speed: 0,
    energy: 2,
    spellPower: 0,
    passives: [],
    spells: {
      front: { id: 'siphon', cost: 2, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };

  const dummy = {
    id: 'dummyID',
    name: 'Dummy',
    health: 15,
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

  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  p1Board[2] = makeTile(demon, 'p1-2-demon', 'p1Board', 2);
  p2Board[0] = makeTile(dummy, 'p2-0-dummy', 'p2Board', 0);

  p1Board[2].currentEnergy = 2;
  p1Board[2].currentHealth = 10;
  p1Board[2].currentArmor = 0;

  p2Board[0].currentHealth = 15;
  p2Board[0].currentArmor = 0;

  const beforeSelfHealth = Number(p1Board[2].currentHealth || 0);

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

  const afterSelfHealth = Number(result?.p1Board?.[2]?.currentHealth || 0);
  const castedOnSelf = logs.some((line) => line.includes('Demon used Siphon on Demon.'));
  const directSelfDamageLog = logs.some((line) => {
    return /^\s*>\s*p1Board\[2\].*(would deal|dealt).*to p1Board\[2\]/.test(line);
  });
  const healedCaster = afterSelfHealth > beforeSelfHealth;

  const passed = !castedOnSelf && !directSelfDamageLog && healedCaster;

  console.log('=== Siphon Self-Target Regression ===');
  console.log(`${passed ? 'PASS' : 'FAIL'} - Siphon should not target or damage caster directly`);
  console.log(`  beforeSelfHealth=${beforeSelfHealth}, afterSelfHealth=${afterSelfHealth}`);
  console.log(`  castedOnSelfLog=${castedOnSelf}`);
  console.log(`  directSelfDamageLog=${directSelfDamageLog}`);
  console.log(`  healedCaster=${healedCaster}`);

  if (!passed) {
    console.log('--- Potential self-damage lines ---');
    logs
      .filter((line) => line.includes('to p1Board[2]') || line.includes('Siphon') || line.includes('Demon'))
      .slice(0, 80)
      .forEach((line) => console.log(line));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Siphon regression test failed with exception:', err);
  process.exit(1);
});
