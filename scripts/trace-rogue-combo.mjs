import { executeRound } from '../src/battleEngine.js';
import { SPELLS } from '../src/spells.js';
import { resolveTargets } from '../src/targeting.js';

function makeHero({ id, name, spellId = 'basicAttack', slot = 'front', energy = 0, attackPowerBonus = 0, heroOverrides = {} }) {
  const spells = {
    front: { id: 'basicAttack', cost: 99, casts: 0 },
    middle: { id: 'basicAttack', cost: 99, casts: 0 },
    back: { id: 'basicAttack', cost: 99, casts: 0 }
  };
  spells[slot] = { id: spellId, cost: energy, casts: 1 };
  return {
    id,
    name,
    health: 20,
    armor: 0,
    speed: 0,
    energy,
    spellPower: 0,
    _towerAttackPowerBonus: attackPowerBonus,
    spells,
    ...heroOverrides
  };
}

function makeTile(hero, overrides = {}) {
  return {
    hero: { ...hero, ...(overrides.hero || {}) },
    id: overrides.id || hero.id,
    effects: Array.isArray(overrides.effects) ? overrides.effects.map(effect => ({ ...effect })) : [],
    _passives: Array.isArray(overrides._passives) ? overrides._passives.map(passive => ({ ...passive })) : [],
    _dead: false,
    currentHealth: overrides.currentHealth ?? Number(hero.health || 0),
    currentArmor: overrides.currentArmor ?? Number(hero.armor || 0),
    currentSpeed: overrides.currentSpeed ?? Number(hero.speed || 0),
    currentEnergy: overrides.currentEnergy ?? Number(hero.energy || 0),
    currentSpellPower: overrides.currentSpellPower ?? Number(hero.spellPower || 0),
    spellCasts: Array.isArray(overrides.spellCasts) ? overrides.spellCasts.map(cast => ({ ...cast })) : []
  };
}

function makeBoard() {
  return Array(9).fill(null);
}

function makeInertEnemy({ id, name, health, armor = 0, heroOverrides = {}, tileOverrides = {} }) {
  return makeTile(makeHero({
    id,
    name,
    spellId: 'basicAttack',
    slot: 'front',
    energy: 0,
    heroOverrides: {
      armor,
      ...heroOverrides,
      spells: {
        front: { id: 'basicAttack', cost: 99, casts: 0 },
        middle: { id: 'basicAttack', cost: 99, casts: 0 },
        back: { id: 'basicAttack', cost: 99, casts: 0 }
      }
    }
  }), {
    currentHealth: health,
    currentArmor: armor,
    currentEnergy: -1,
    ...tileOverrides
  });
}

function summarizeBoard(board) {
  return board.map((tile, index) => {
    if (!tile || !tile.hero) return null;
    return {
      index,
      id: tile.hero.id,
      hp: tile.currentHealth,
      energy: tile.currentEnergy,
      dead: !!tile._dead,
      effects: (tile.effects || []).map(effect => effect && effect.name).filter(Boolean)
    };
  }).filter(Boolean);
}

function directResolveSummary() {
  const p1Board = makeBoard();
  const p2Board = makeBoard();
  p1Board[6] = makeTile(makeHero({ id: 'rogue-direct', name: 'Rogue', spellId: 'combo', slot: 'back', energy: 4 }), {
    currentEnergy: 4
  });
  p2Board[0] = makeInertEnemy({ id: 'low-health', name: 'Low Health', health: 8 });
  p2Board[1] = makeInertEnemy({ id: 'high-health', name: 'High Health', health: 12 });
  const casterRef = { boardName: 'p1Board', index: 6, tile: p1Board[6] };
  const spec = SPELLS.combo.spec;
  const tokens = resolveTargets(spec.targets, casterRef, { p1Board, p2Board });
  return tokens.map(token => `${token.board}[${token.index}]`).join(', ');
}

async function traceScenario(name, setup) {
  const p1Board = makeBoard();
  const p2Board = makeBoard();
  const trace = [];
  setup({ p1Board, p2Board });
  const result = await executeRound({
    p1Board,
    p2Board,
    p1Reserve: [],
    p2Reserve: [],
    priorityPlayer: 'player1',
    roundNumber: 1,
    addLog: (line) => trace.push(line)
  }, {
    castDelayMs: 0,
    postEffectDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    quiet: true,
    speedMultiplier: 30,
    onStep: (state) => {
      if (state?.lastAction) trace.push(`ACTION ${JSON.stringify(state.lastAction)}`);
    }
  });
  return {
    name,
    result,
    trace,
    p1: summarizeBoard(result.p1Board),
    p2: summarizeBoard(result.p2Board)
  };
}

async function main() {
  console.log('Direct Combo target resolution:', directResolveSummary());

  const scenarios = [
    await traceScenario('baseline-same-target', ({ p1Board, p2Board }) => {
      p1Board[6] = makeTile(makeHero({ id: 'rogue-baseline', name: 'Rogue', spellId: 'combo', slot: 'back', energy: 3 }), {
        currentEnergy: 3
      });
      p2Board[0] = makeInertEnemy({ id: 'combo-low', name: 'Combo Low', health: 8 });
      p2Board[1] = makeInertEnemy({ id: 'combo-high', name: 'Combo High', health: 12 });
    }),
    await traceScenario('kill-then-finisher', ({ p1Board, p2Board }) => {
      p1Board[6] = makeTile(makeHero({ id: 'rogue-finisher', name: 'Rogue', spellId: 'combo', slot: 'back', energy: 3 }), {
        currentEnergy: 3
      });
      p2Board[0] = makeInertEnemy({ id: 'combo-kill', name: 'Combo Kill', health: 6 });
      p2Board[1] = makeInertEnemy({ id: 'combo-finisher', name: 'Combo Finisher', health: 12 });
    }),
    await traceScenario('tower-bonus-damage', ({ p1Board, p2Board }) => {
      p1Board[6] = makeTile(makeHero({ id: 'rogue-bonus', name: 'Rogue', spellId: 'combo', slot: 'back', energy: 3, attackPowerBonus: 2 }), {
        currentEnergy: 3
      });
      p2Board[0] = makeInertEnemy({ id: 'combo-bonus-low', name: 'Combo Bonus Low', health: 8 });
      p2Board[1] = makeInertEnemy({ id: 'combo-bonus-high', name: 'Combo Bonus High', health: 12 });
    }),
    await traceScenario('death-prevention-target', ({ p1Board, p2Board }) => {
      p1Board[6] = makeTile(makeHero({ id: 'rogue-death-prevention', name: 'Rogue', spellId: 'combo', slot: 'back', energy: 3 }), {
        currentEnergy: 3
      });
      p2Board[0] = makeInertEnemy({
        id: 'combo-undying',
        name: 'Combo Undying',
        health: 6,
        heroOverrides: {
          passives: [{ name: 'Undying Rage', _used: false }]
        },
        tileOverrides: {
          _passives: [{ name: 'Undying Rage', _used: false }]
        }
      });
      p2Board[1] = makeInertEnemy({ id: 'combo-undying-other', name: 'Combo Undying Other', health: 12 });
    })
  ];

  scenarios.forEach((scenario) => {
    console.log(`\n=== ${scenario.name} ===`);
    console.log('Final p2:', JSON.stringify(scenario.p2, null, 2));
    const filteredTrace = scenario.trace.filter(line => /combo|conditionalSecondaryOnWouldKill|would deal|Applied deferred health change|roundComplete/i.test(line));
    filteredTrace.forEach(line => console.log(line));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});