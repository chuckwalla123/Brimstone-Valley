import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { makeMovementDecision } from '../src/ai/easyAI.js';
import { executeRound } from '../src/battleEngine.js';
import { HEROES } from '../src/heroes.js';
import { deepClone, makeEmptyMain, makeReserve } from '../shared/gameLogic.js';

const DEFAULT_GAMES = 1000;
const DEFAULT_MAX_ROUNDS = 60;
const DEFAULT_PROGRESS_EVERY = 100;
const DEFAULT_OUTPUT_PATH = 'scripts/easyai-random-teams-results.json';
const TEAM_SIZE = 7;
const MAIN_HEROES = 5;

function parseArgs(argv) {
  const options = {
    games: DEFAULT_GAMES,
    maxRounds: DEFAULT_MAX_ROUNDS,
    progressEvery: DEFAULT_PROGRESS_EVERY,
    out: DEFAULT_OUTPUT_PATH,
  };

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, rawValue] = arg.slice(2).split('=');
    const value = rawValue == null ? '' : rawValue;
    switch (key) {
      case 'games':
        options.games = clampInteger(value, DEFAULT_GAMES, 1);
        break;
      case 'max-rounds':
        options.maxRounds = clampInteger(value, DEFAULT_MAX_ROUNDS, 1);
        break;
      case 'progress-every':
        options.progressEvery = clampInteger(value, DEFAULT_PROGRESS_EVERY, 0);
        break;
      case 'out':
        options.out = value || DEFAULT_OUTPUT_PATH;
        break;
      default:
        throw new Error(`Unknown argument: --${key}`);
    }
  }

  return options;
}

function clampInteger(value, fallback, minValue) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, parsed);
}

function toCsvValue(value) {
  const raw = value == null ? '' : String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function getCsvPath(jsonPath) {
  const parsed = path.parse(jsonPath);
  return path.join(parsed.dir, `${parsed.name}.csv`);
}

function buildCsvReport(entries) {
  const header = ['heroId', 'heroName', 'appearances', 'wins', 'losses', 'draws', 'winRate', 'nonDrawRate'];
  const rows = entries.map((entry) => header.map((key) => toCsvValue(entry[key])).join(','));
  return `${header.join(',')}\n${rows.join('\n')}\n`;
}

function getDraftableHeroes() {
  return HEROES.filter((hero) => hero && hero.draftable !== false);
}

function sampleUnique(source, count) {
  const pool = Array.isArray(source) ? [...source] : [];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

function cloneHeroForBattle(hero) {
  const cloned = deepClone(hero);
  cloned.currentHealth = Number(cloned.health || 0);
  cloned.currentArmor = Number(cloned.armor || 0);
  cloned.currentEnergy = Number(cloned.energy || 0);
  cloned.currentSpeed = Number(cloned.speed || 0);
  cloned.currentSpellPower = Number(cloned.spellPower || 0);
  return cloned;
}

function createRandomTeam(playerId) {
  const main = makeEmptyMain(playerId);
  const reserve = makeReserve(playerId);
  const heroes = sampleUnique(getDraftableHeroes(), TEAM_SIZE);
  const mainSlots = sampleUnique([0, 1, 2, 3, 4, 5, 6, 7, 8], MAIN_HEROES);

  for (let index = 0; index < MAIN_HEROES; index += 1) {
    const slot = mainSlots[index];
    const hero = heroes[index];
    if (!hero) continue;
    main[slot] = {
      ...main[slot],
      hero: cloneHeroForBattle(hero),
    };
  }

  for (let index = 0; index < 2; index += 1) {
    const hero = heroes[MAIN_HEROES + index];
    if (!hero) continue;
    reserve[index] = {
      ...reserve[index],
      hero: cloneHeroForBattle(hero),
    };
  }

  return { main, reserve };
}

function createInitialState() {
  const p1 = createRandomTeam('player1');
  const p2 = createRandomTeam('player2');
  return {
    phase: 'battle',
    roundNumber: 0,
    gameMode: 'classic',
    priorityPlayer: 'player1',
    p1Main: p1.main,
    p1Reserve: p1.reserve,
    p2Main: p2.main,
    p2Reserve: p2.reserve,
    lastCastActionBySide: null,
  };
}

async function runBattleRound(state) {
  const nextRoundNumber = (typeof state.roundNumber === 'number' ? state.roundNumber : 0) + 1;
  const priorityPlayer = state.priorityPlayer || 'player1';
  const result = await executeRound(
    {
      p1Board: state.p1Main,
      p2Board: state.p2Main,
      p1Reserve: state.p1Reserve,
      p2Reserve: state.p2Reserve,
      addLog: null,
      priorityPlayer,
      roundNumber: nextRoundNumber,
      lastCastActionBySide: state.lastCastActionBySide || null,
      gameMode: state.gameMode || null,
    },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      speedMultiplier: 1,
      onStep: null,
    }
  );

  return {
    ...state,
    phase: 'battle',
    roundNumber: nextRoundNumber,
    p1Main: result.p1Board,
    p2Main: result.p2Board,
    p1Reserve: result.p1Reserve,
    p2Reserve: result.p2Reserve,
    priorityPlayer: result.priorityPlayer || priorityPlayer,
    lastCastActionBySide: result.lastCastActionBySide || state.lastCastActionBySide || null,
    lastAction: {
      type: result.winner ? 'gameEnd' : 'roundComplete',
      winner: result.winner || null,
    },
  };
}

function isAliveTile(tile) {
  if (!tile || !tile.hero || tile._dead) return false;
  if (typeof tile.currentHealth === 'number' && tile.currentHealth <= 0) return false;
  return true;
}

function getLivingHeroIds(mainBoard, reserveBoard) {
  const ids = new Set();
  for (const tile of [...(mainBoard || []), ...(reserveBoard || [])]) {
    if (isAliveTile(tile) && tile.hero?.id) ids.add(tile.hero.id);
  }
  return ids;
}

function determineWinner(state) {
  const p1Alive = [...(state.p1Main || []), ...(state.p1Reserve || [])].some(isAliveTile);
  const p2Alive = [...(state.p2Main || []), ...(state.p2Reserve || [])].some(isAliveTile);
  if (p1Alive && p2Alive) return null;
  if (p1Alive) return 'player1';
  if (p2Alive) return 'player2';
  return 'draw';
}

function buildMovementSequence(priorityPlayer) {
  const normalized = priorityPlayer === 'player2' || priorityPlayer === 'p2' ? 'p2' : 'p1';
  return normalized === 'p1' ? ['p1', 'p2', 'p2', 'p1'] : ['p2', 'p1', 'p1', 'p2'];
}

function remapDecisionToPlayer(decision, player) {
  if (!decision || player !== 'player1') return decision;
  const remapToken = (token) => {
    if (typeof token !== 'string') return token;
    if (token.startsWith('p2Reserve:')) return token.replace('p2Reserve:', 'p1Reserve:');
    if (token.startsWith('p2:')) return token.replace('p2:', 'p1:');
    return token;
  };
  return {
    sourceId: remapToken(decision.sourceId),
    destinationId: remapToken(decision.destinationId),
  };
}

function getNoopDecision(state, player) {
  const main = player === 'player1' ? state.p1Main : state.p2Main;
  const reserve = player === 'player1' ? state.p1Reserve : state.p2Reserve;
  const mainPrefix = player === 'player1' ? 'p1' : 'p2';
  const reservePrefix = player === 'player1' ? 'p1Reserve' : 'p2Reserve';

  const mainIndex = (main || []).findIndex(isAliveTile);
  if (mainIndex !== -1) return { sourceId: `${mainPrefix}:${mainIndex}`, destinationId: `${mainPrefix}:${mainIndex}` };
  const reserveIndex = (reserve || []).findIndex(isAliveTile);
  if (reserveIndex !== -1) return { sourceId: `${reservePrefix}:${reserveIndex}`, destinationId: `${reservePrefix}:${reserveIndex}` };
  return { sourceId: `${mainPrefix}:0`, destinationId: `${mainPrefix}:0` };
}

function parseMovementToken(token) {
  if (typeof token !== 'string') return null;
  if (token.startsWith('p1Reserve:')) return { side: 'p1', reserve: true, index: Number.parseInt(token.slice('p1Reserve:'.length), 10) };
  if (token.startsWith('p2Reserve:')) return { side: 'p2', reserve: true, index: Number.parseInt(token.slice('p2Reserve:'.length), 10) };
  if (token.startsWith('p1:')) return { side: 'p1', reserve: false, index: Number.parseInt(token.slice('p1:'.length), 10) };
  if (token.startsWith('p2:')) return { side: 'p2', reserve: false, index: Number.parseInt(token.slice('p2:'.length), 10) };
  return null;
}

function getBoardRef(state, parsedToken) {
  if (!parsedToken) return null;
  if (parsedToken.side === 'p1') return parsedToken.reserve ? state.p1Reserve : state.p1Main;
  if (parsedToken.side === 'p2') return parsedToken.reserve ? state.p2Reserve : state.p2Main;
  return null;
}

function countsTowardMainLimit(tile) {
  return !!(tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true);
}

function applyMovementDecision(state, player, decision) {
  const moverSide = player === 'player1' ? 'p1' : 'p2';
  const fallback = getNoopDecision(state, player);
  const resolvedDecision = decision?.sourceId && decision?.destinationId ? decision : fallback;
  const source = parseMovementToken(resolvedDecision.sourceId);
  const destination = parseMovementToken(resolvedDecision.destinationId);
  if (!source || !destination || source.side !== moverSide || destination.side !== moverSide) return state;

  const sourceBoard = getBoardRef(state, source);
  const destinationBoard = getBoardRef(state, destination);
  if (!sourceBoard || !destinationBoard) return state;
  if (!sourceBoard[source.index] || !destinationBoard[destination.index]) return state;

  const sourceTile = sourceBoard[source.index];
  const destinationTile = destinationBoard[destination.index];
  if (!isAliveTile(sourceTile)) return state;
  if (destination.reserve && sourceTile.hero?.isBoss) return state;

  if (source.reserve && !destination.reserve) {
    const mainBoard = moverSide === 'p1' ? state.p1Main : state.p2Main;
    const mainAliveCount = (mainBoard || []).filter(countsTowardMainLimit).length;
    const destinationHasLivingHero = countsTowardMainLimit(destinationTile);
    if (!destinationHasLivingHero && mainAliveCount >= 5) return state;
  }

  const nextState = {
    ...state,
    p1Main: [...(state.p1Main || [])],
    p1Reserve: [...(state.p1Reserve || [])],
    p2Main: [...(state.p2Main || [])],
    p2Reserve: [...(state.p2Reserve || [])],
  };
  const nextSourceBoard = getBoardRef(nextState, source);
  const nextDestinationBoard = getBoardRef(nextState, destination);
  const swapped = nextSourceBoard[source.index];
  nextSourceBoard[source.index] = nextDestinationBoard[destination.index];
  nextDestinationBoard[destination.index] = swapped;

  if (nextSourceBoard[source.index]?.hero) nextSourceBoard[source.index].hero._movedThisMovementPhase = true;
  if (nextDestinationBoard[destination.index]?.hero) nextDestinationBoard[destination.index].hero._movedThisMovementPhase = true;

  return nextState;
}

function getMovementDecision(state, player) {
  const movement = { movementPhase: { sequence: ['p2'], index: 0 } };
  if (player === 'player1') {
    const decision = makeMovementDecision(state.p1Main, state.p1Reserve, movement, state.p2Main, state.p2Reserve);
    return remapDecisionToPlayer(decision, player);
  }
  return makeMovementDecision(state.p2Main, state.p2Reserve, movement, state.p1Main, state.p1Reserve);
}

function applyMovementPhase(state) {
  let nextState = state;
  const sequence = buildMovementSequence(nextState.priorityPlayer);
  for (const side of sequence) {
    const player = side === 'p1' ? 'player1' : 'player2';
    const decision = getMovementDecision(nextState, player);
    nextState = applyMovementDecision(nextState, player, decision);
  }
  return {
    ...nextState,
    phase: 'ready',
    priorityPlayer: nextState.priorityPlayer === 'player2' || nextState.priorityPlayer === 'p2' ? 'player1' : 'player2',
  };
}

function collectTeamHeroIds(state) {
  return {
    player1: getLivingHeroIds(state.p1Main, state.p1Reserve),
    player2: getLivingHeroIds(state.p2Main, state.p2Reserve),
  };
}

function ensureHeroStats(statsMap, heroId, heroName) {
  if (!statsMap.has(heroId)) {
    statsMap.set(heroId, {
      heroId,
      heroName,
      appearances: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  }
  return statsMap.get(heroId);
}

function updateStatsForRoster(statsMap, heroRoster, outcome, heroLookup) {
  for (const heroId of heroRoster) {
    const hero = heroLookup.get(heroId);
    const entry = ensureHeroStats(statsMap, heroId, hero?.name || heroId);
    entry.appearances += 1;
    if (outcome === 'win') entry.wins += 1;
    else if (outcome === 'loss') entry.losses += 1;
    else entry.draws += 1;
  }
}

function finalizeStats(statsMap) {
  return [...statsMap.values()]
    .map((entry) => ({
      ...entry,
      winRate: entry.appearances > 0 ? Number((entry.wins / entry.appearances).toFixed(4)) : 0,
      nonDrawRate: entry.appearances > entry.draws
        ? Number((entry.wins / (entry.appearances - entry.draws)).toFixed(4))
        : 0,
    }))
    .sort((left, right) => {
      if (right.winRate !== left.winRate) return right.winRate - left.winRate;
      if (right.wins !== left.wins) return right.wins - left.wins;
      return left.heroName.localeCompare(right.heroName);
    });
}

async function runSingleGame(maxRounds) {
  let state = createInitialState();
  const roster = collectTeamHeroIds(state);
  let completedRounds = 0;
  let winner = null;

  while (completedRounds < maxRounds) {
    state = await runBattleRound(state);
    completedRounds += 1;
    winner = state.lastAction?.winner || determineWinner(state);
    if (winner) break;
    state = applyMovementPhase(state);
  }

  if (!winner) winner = determineWinner(state) || 'draw';

  return {
    winner,
    roundsPlayed: completedRounds,
    roster,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const statsMap = new Map();
  const heroLookup = new Map(HEROES.map((hero) => [hero.id, hero]));
  const startedAt = new Date();
  let draws = 0;
  let completedGames = 0;
  let failedGames = 0;
  let totalRoundsPlayed = 0;

  for (let gameIndex = 0; gameIndex < options.games; gameIndex += 1) {
    try {
      const result = await runSingleGame(options.maxRounds);
      completedGames += 1;
      totalRoundsPlayed += result.roundsPlayed;
      if (result.winner === 'draw') draws += 1;

      updateStatsForRoster(statsMap, result.roster.player1, result.winner === 'player1' ? 'win' : result.winner === 'player2' ? 'loss' : 'draw', heroLookup);
      updateStatsForRoster(statsMap, result.roster.player2, result.winner === 'player2' ? 'win' : result.winner === 'player1' ? 'loss' : 'draw', heroLookup);
    } catch (error) {
      failedGames += 1;
      console.error(`[easyai-random] Game ${gameIndex + 1} failed:`, error?.stack || error?.message || error);
    }

    if (options.progressEvery > 0 && (gameIndex + 1) % options.progressEvery === 0) {
      console.log(`[easyai-random] Completed ${gameIndex + 1}/${options.games} games`);
    }
  }

  const results = finalizeStats(statsMap);
  const report = {
    generatedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    mode: 'random-teams',
    rosterMode: 'betting-style-random',
    gamesRequested: options.games,
    gamesCompleted: completedGames,
    failedGames,
    draws,
    maxRoundsPerGame: options.maxRounds,
    averageRoundsPerCompletedGame: completedGames > 0 ? Number((totalRoundsPlayed / completedGames).toFixed(2)) : 0,
    heroes: results,
  };

  const outputPath = path.resolve(process.cwd(), options.out);
  const csvOutputPath = getCsvPath(outputPath);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(csvOutputPath, buildCsvReport(results), 'utf8');

  console.log(`[easyai-random] Wrote ${completedGames} completed games to ${outputPath}`);
  console.log(`[easyai-random] Wrote CSV summary to ${csvOutputPath}`);
  console.table(results.slice(0, 15).map((entry) => ({
    hero: entry.heroName,
    appearances: entry.appearances,
    wins: entry.wins,
    losses: entry.losses,
    draws: entry.draws,
    winRate: entry.winRate,
  })));
}

main().catch((error) => {
  console.error('[easyai-random] Fatal error:', error?.stack || error?.message || error);
  process.exitCode = 1;
});