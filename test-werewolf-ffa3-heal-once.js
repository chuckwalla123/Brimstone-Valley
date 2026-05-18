import { executeRound } from './src/battleEngine.js';

function makeTile(hero, currentHealth = 5) {
  return {
    hero: { ...hero },
    currentHealth,
    currentArmor: Number(hero.armor ?? 0),
    currentSpeed: Number(hero.speed ?? 0),
    currentEnergy: Number(hero.energy ?? 0),
    currentSpellPower: Number(hero.spellPower ?? 0),
    effects: [],
    spellCasts: []
  };
}

async function run() {
  const logs = [];
  const dummy = {
    id: 'dummyID',
    name: 'Dummy',
    health: 20,
    armor: 0,
    speed: 0,
    energy: 0,
    spellPower: 0,
    spells: {
      front: { id: 'basicAttack', cost: 99, casts: 0 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    }
  };

  const werewolf = {
    id: 'werewolfID',
    name: 'Werewolf',
    health: 20,
    armor: 0,
    speed: 5,
    energy: 3,
    spellPower: 0,
    spells: {
      front: { id: 'bite', cost: 3, casts: 1 },
      middle: { id: 'basicAttack', cost: 99, casts: 0 },
      back: { id: 'basicAttack', cost: 99, casts: 0 }
    },
    _towerEffects: [{
      name: 'Dexterity II',
      kind: 'buff',
      duration: 'permanent',
      modifiers: { armor: 2, speed: 2 },
      _hidden: true
    }]
  };

  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);
  const p3Board = Array(9).fill(null);

  p1Board[2] = makeTile(werewolf, 5);
  p2Board[0] = makeTile(dummy, 20);
  p3Board[8] = makeTile(dummy, 20);

  const result = await executeRound(
    {
      p1Board,
      p2Board,
      p3Board,
      p1Reserve: [],
      p2Reserve: [],
      p3Reserve: [],
      priorityPlayer: 'player1',
      roundNumber: 1,
      phase: 'battle',
      gameMode: 'ffa3',
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

  const healLogs = logs.filter((line) => line.includes('Applied deferred health change 1 to p1Board[2]'));
  const p2HitLogs = logs.filter((line) => line.includes('Applied deferred health change -4 to p2Board[0]'));
  const p3HitLogs = logs.filter((line) => line.includes('Applied deferred health change -4 to p3Board[8]'));

  if (healLogs.length !== 1 || p2HitLogs.length !== 1 || p3HitLogs.length !== 1) {
    console.error('Werewolf FFA3 self-heal regression FAILED', {
      healLogs,
      p2HitLogs,
      p3HitLogs,
      finalHealth: Number(result?.p1Board?.[2]?.currentHealth || 0)
    });
    process.exit(1);
  }

  console.log('Werewolf FFA3 self-heal regression PASSED');
}

run().catch((error) => {
  console.error('Werewolf FFA3 self-heal regression crashed:', error);
  process.exit(1);
});