import { EFFECTS } from '../../effects.js';
import { HEROES } from '../../heroes.js';
import { deepClone, makeEmptyMain, makeReserve } from '../../../shared/gameLogic.js';
import { createTrainingState, listLegalMovementActions } from './environment.js';

const DRAFTABLE_HEROES = HEROES.filter((hero) => hero && hero.draftable !== false);
const RANDOM_EFFECTS = [EFFECTS.Poison, EFFECTS.Marked, EFFECTS.Burn, EFFECTS.Strength, EFFECTS.Shackle];

const createSeededRandom = (seed) => {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const randomInteger = (random, min, max) => Math.floor(random() * (max - min + 1)) + min;

const sampleWithoutReplacement = (random, items, count) => {
  const candidates = [...items];
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }
  return candidates.slice(0, Math.min(count, candidates.length));
};

const createBoards = (side) => ({
  main: makeEmptyMain(side === 'p1' ? 'player1' : 'player2'),
  reserve: makeReserve(side === 'p1' ? 'player1' : 'player2'),
});

const createTile = (hero, overrides = {}) => {
  const clonedHero = deepClone(hero);
  const maxHealth = Number(clonedHero.health || 0);
  return {
    hero: clonedHero,
    effects: deepClone(overrides.effects || []),
    currentHealth: Number(overrides.currentHealth ?? maxHealth),
    currentArmor: Number(overrides.currentArmor ?? clonedHero.armor ?? 0),
    currentEnergy: Number(overrides.currentEnergy ?? clonedHero.energy ?? 0),
    currentSpeed: Number(overrides.currentSpeed ?? clonedHero.speed ?? 0),
    currentSpellPower: Number(overrides.currentSpellPower ?? clonedHero.spellPower ?? 0),
    _dead: overrides.dead === true,
  };
};

const placeHero = (board, index, heroId, overrides = {}) => {
  const hero = HEROES.find((entry) => entry.id === heroId);
  if (!hero) throw new Error(`Missing scenario hero: ${heroId}`);
  board[index] = {
    ...board[index],
    ...createTile(hero, overrides),
  };
};

const createScenario = (id, tags, setup) => {
  const p1 = createBoards('p1');
  const p2 = createBoards('p2');
  const metadata = setup(p1, p2) || {};

  return {
    id,
    source: 'fixture',
    tags,
    state: createTrainingState({
      p1Main: p1.main,
      p1Reserve: p1.reserve,
      p2Main: p2.main,
      p2Reserve: p2.reserve,
      priorityPlayer: metadata.priorityPlayer || 'player2',
      roundNumber: metadata.roundNumber || 2,
      movementIndex: metadata.movementIndex || 0,
    }),
  };
};

const createFixtureScenarios = () => [
  createScenario('injured-berserker-buffed-enemy', ['conditional-spell', 'low-health', 'enemy-buffs'], (p1, p2) => {
    placeHero(p2.main, 4, 'berserkerID', { currentHealth: 2 });
    placeHero(p1.main, 0, 'warriorID', { effects: [EFFECTS.Strength, EFFECTS.Power] });
    placeHero(p1.main, 4, 'warriorID');
  }),
  createScenario('cleanse-and-purify-counterplay', ['cleanse', 'buff-removal', 'debuff'], (p1, p2) => {
    placeHero(p2.main, 4, 'clericID');
    placeHero(p2.main, 0, 'warriorID', { currentHealth: 7, effects: [EFFECTS.Poison] });
    placeHero(p1.main, 4, 'warriorID', { effects: [EFFECTS.Strength] });
  }),
  createScenario('shackled-frontline', ['movement-lock', 'shackle'], (p1, p2) => {
    placeHero(p2.main, 0, 'warriorID', { effects: [EFFECTS.Shackle] });
    placeHero(p2.main, 4, 'priestID');
    placeHero(p1.main, 4, 'warriorID');
  }),
  createScenario('full-main-reserve-swap', ['reserve', 'main-capacity'], (p1, p2) => {
    ['warriorID', 'clericID', 'priestID', 'berserkerID', 'apothecaryID'].forEach((heroId, index) => {
      placeHero(p2.main, index, heroId);
    });
    placeHero(p2.reserve, 0, 'assassinID');
    placeHero(p1.main, 4, 'warriorID');
  }),
  createScenario('corpse-and-burn-opportunity', ['corpse', 'burn', 'conditional-spell'], (p1, p2) => {
    placeHero(p2.main, 3, 'necromancerID');
    placeHero(p2.main, 8, 'fireGolemID');
    placeHero(p1.main, 0, 'warriorID', { dead: true });
    placeHero(p1.main, 4, 'warriorID', { effects: [EFFECTS.Burn, EFFECTS.Burn] });
  }),
];

const randomizeTile = (random, hero) => {
  const maxHealth = Math.max(1, Number(hero.health || 1));
  const effectCount = random() < 0.35 ? randomInteger(random, 1, 2) : 0;
  return createTile(hero, {
    currentHealth: randomInteger(random, Math.max(1, Math.ceil(maxHealth * 0.35)), maxHealth),
    currentArmor: Math.max(0, Number(hero.armor || 0) + randomInteger(random, -1, 2)),
    currentEnergy: Math.max(0, Number(hero.energy || 0) + randomInteger(random, 0, 3)),
    effects: sampleWithoutReplacement(random, RANDOM_EFFECTS, effectCount),
  });
};

const populateRandomSide = (random, boards, heroes) => {
  const mainCount = randomInteger(random, 3, 5);
  const reserveCount = randomInteger(random, 0, 2);
  const mainSlots = sampleWithoutReplacement(random, [...Array(9).keys()], mainCount);
  const selectedHeroes = heroes.slice(0, mainCount + reserveCount);

  mainSlots.forEach((slot, index) => {
    boards.main[slot] = {
      ...boards.main[slot],
      ...randomizeTile(random, selectedHeroes[index]),
    };
  });
  for (let index = 0; index < reserveCount; index += 1) {
    boards.reserve[index] = {
      ...boards.reserve[index],
      ...randomizeTile(random, selectedHeroes[mainCount + index]),
    };
  }
};

export const createRandomMovementScenarios = ({ count = 100, seed = 1 } = {}) => {
  const random = createSeededRandom(seed);
  const scenarios = [];
  const maxAttempts = Math.max(count * 20, 100);

  for (let attempt = 0; scenarios.length < count && attempt < maxAttempts; attempt += 1) {
    const p1 = createBoards('p1');
    const p2 = createBoards('p2');
    const selectedHeroes = sampleWithoutReplacement(random, DRAFTABLE_HEROES, 14);
    populateRandomSide(random, p1, selectedHeroes.slice(0, 7));
    populateRandomSide(random, p2, selectedHeroes.slice(7, 14));

    const state = createTrainingState({
      p1Main: p1.main,
      p1Reserve: p1.reserve,
      p2Main: p2.main,
      p2Reserve: p2.reserve,
      priorityPlayer: random() < 0.5 ? 'player1' : 'player2',
      roundNumber: randomInteger(random, 2, 12),
    });

    if (!listLegalMovementActions(state).length) continue;
    scenarios.push({
      id: `random-${seed}-${scenarios.length + 1}`,
      source: 'random',
      tags: ['randomized', 'movement-only'],
      state,
    });
  }

  if (scenarios.length !== count) {
    throw new Error(`Unable to generate ${count} valid movement scenarios from seed ${seed}`);
  }

  return scenarios;
};

export const createMovementScenarioCorpus = ({ randomCount = 100, seed = 1 } = {}) => {
  const fixtures = createFixtureScenarios();
  fixtures.forEach((scenario) => {
    if (!listLegalMovementActions(scenario.state).length) {
      throw new Error(`Fixture ${scenario.id} has no legal movement actions`);
    }
  });

  return [...fixtures, ...createRandomMovementScenarios({ count: randomCount, seed })];
};
