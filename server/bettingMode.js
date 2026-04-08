import { makeEmptyMain, makeReserve, deepClone, processMove } from '../shared/gameLogic.js';
import { HEROES } from '../src/heroes.js';
import { executeRound } from '../src/battleEngine.js';
import { makeMovementDecision } from '../src/ai/easyAI.js';

const BETTING_MAX_PLAYERS = 12;
const BETTING_MIN_PLAYERS = 2;
const BETTING_STARTING_COINS = 10;
const BETTING_TOTAL_ROUNDS = 8;
const BETTING_BET_MS = 60_000;
const BETTING_BATTLE_SPEED_MULTIPLIER = 4;
const BETTING_BATTLE_VISUAL_TIMEOUT_MS = 90_000;
const BETTING_PREPARE_BATTLE_MAX_MS = 20_000;
const BETTING_ROUND_EXECUTION_TIMEOUT_MS = 25_000;
const BETTING_ROUND_VISUAL_ACK_TIMEOUT_MS = 20_000;
const BETTING_LOBBY_RECONNECT_GRACE_MS = 30_000;
const BETTING_SUMMARY_MS = 15_000;
const BETTING_SIMULATION_TIMEOUT_MS = 120_000;
const BETTING_SETTLE_WATCHDOG_MS = 210_000;
const BETTING_STEP_ACK_TIMEOUT_MS = 8_000;
const BETTING_SERVER_INSTANCE_ID = process.env.FLY_ALLOC_ID || process.env.HOSTNAME || `pid:${process.pid}`;

function getProcessMemorySnapshot() {
  try {
    const usage = process.memoryUsage();
    return {
      rssMb: Math.round(Number(usage.rss || 0) / (1024 * 1024)),
      heapUsedMb: Math.round(Number(usage.heapUsed || 0) / (1024 * 1024)),
      heapTotalMb: Math.round(Number(usage.heapTotal || 0) / (1024 * 1024)),
      externalMb: Math.round(Number(usage.external || 0) / (1024 * 1024))
    };
  } catch (error) {
    return null;
  }
}

function estimateStepVisualMs(step) {
  const type = String(step?.type || '').toLowerCase();
  if (type === 'movementstart' || type === 'movementswap' || type === 'movementcomplete') return 180;
  if (type === 'precast' || type === 'effectprecast') return 420;
  if (type === 'cast' || type === 'castapplied' || type === 'effectapplied') return 300;
  if (type === 'postcastwait') return Math.max(80, Number(step?.duration || 180));
  if (type === 'energyapplied' || type === 'energyincrement' || type === 'posteffectdelay') return 160;
  if (type === 'onroundstarttriggered') return 220;
  if (type === 'roundcomplete' || type === 'gameend') return 800;
  return 120;
}

function withTimelineMeta(step) {
  if (!step || typeof step !== 'object') return step;
  const out = { ...step };
  out.timeline = {
    emittedAt: Date.now(),
    expectedMs: estimateStepVisualMs(step)
  };
  return out;
}

function buildBattleStateSnapshotFromStep(step) {
  if (!step || typeof step !== 'object' || !step.state || typeof step.state !== 'object') return null;
  const lastAction = toSocketSafe({ ...step });
  if (lastAction && typeof lastAction === 'object' && Object.prototype.hasOwnProperty.call(lastAction, 'state')) {
    delete lastAction.state;
  }
  const snapshot = {
    ...step.state,
    lastAction,
    seq: Number(step.seq || 0)
  };
  return toSocketSafe(snapshot);
}

function buildBattleStateSnapshotFromState(state, lastAction = null) {
  if (!state || typeof state !== 'object') return null;
  const safeAction = lastAction && typeof lastAction === 'object'
    ? toSocketSafe({ ...lastAction })
    : null;
  if (safeAction && typeof safeAction === 'object' && Object.prototype.hasOwnProperty.call(safeAction, 'state')) {
    delete safeAction.state;
  }
  return toSocketSafe({
    p1Main: deepClone(state.p1Main || []),
    p2Main: deepClone(state.p2Main || []),
    p1Reserve: deepClone(state.p1Reserve || []),
    p2Reserve: deepClone(state.p2Reserve || []),
    priorityPlayer: state.priorityPlayer || 'player1',
    phase: state.phase || 'battle',
    roundNumber: Number(state.roundNumber || 0),
    lastAction: safeAction,
    seq: Number((safeAction && safeAction.seq) || state.seq || 0)
  });
}

const DRAFTABLE_HEROES = HEROES.filter((hero) => hero && hero.draftable !== false);

const BOT_NAMES = [
  'Ashbite', 'Copper Vow', 'Red Hollow', 'Mirecoil', 'Thorn Knell', 'Iron Lantern', 'Violet Pike', 'Hearthspite',
  'Ruinwell', 'Black Salt', 'Ridge Hex', 'Crow Tithe', 'Fable Hook', 'Stone Choir', 'Cinder Halo', 'Night Ore',
  'Moss Brand', 'Tarnished Bell', 'Harrow Vane', 'Rook Ember', 'Fogwarden', 'Grim Orchard', 'Mallet Saint', 'Rune Pledge',
  'Brackish Sun', 'Wolf Candle', 'Glass Briar', 'Warden Pike', 'Hush Quarry', 'Vex Banner', 'Frost Latch', 'Coal Monarch',
  'Ivory Fathom', 'Gale Tonic', 'Rattle Hymn', 'Duskwell', 'Hex Marble', 'Amber Graft', 'Brass Sparrow', 'Hollow Sickle',
  'Nettle Sovereign', 'Dagger Bloom', 'Sable Moor', 'Crag Reliquary', 'Vein Compass', 'Rookhaven', 'Spite Lantern', 'Orchid Fang',
  'Mercy Pike', 'Flint Parable', 'Gutter Crown', 'Mourn Current', 'Alder Ruin', 'Storm Gavel', 'Flare Bishop', 'Tide Fable',
  'Crypt Thread', 'Steel Ivy', 'Dawn Furnace', 'Briar Oracle', 'Ravel Drum', 'Grimward', 'Mire Bloom', 'Ashen Quill',
  'Echo Scar', 'Pale Carbine', 'Umber Anthem', 'Gloom Atlas', 'Riven Laurel', 'Shard Chapel', 'Cairn Zeal', 'Wick Harbor',
  'Thistle Regent', 'Smolder Loom', 'Bastion Crow', 'Hearth Tempest', 'Dread Finch', 'Trench Psalm', 'Velvet Sunder', 'Carven Mist',
  'Obsidian Lark', 'Marrow Bell', 'Fen Paladin', 'Rune Anchor', 'Vault Thorn', 'Gray Casket', 'Silt Herald', 'Blood Cowl',
  'Morrow Pike', 'Rust Litany', 'Wraith Acre', 'Harvest Spark', 'Pyre Beacon', 'Aegis Marsh', 'Wild Garrison', 'Cobalt Reliant',
  'Umbral Vicar', 'Warden Bloom', 'Feral Ledger', 'Quarry Saint'
];

const SIDE_BET_POOL = [
  {
    id: 1,
    title: 'Total Health Of Winning Team',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict total remaining health on the winning team.'
  },
  {
    id: 2,
    title: 'Round The Game Ends On',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict the exact ending round.'
  },
  {
    id: 3,
    title: 'Total Energy Of Winning Team',
    multiplier: 5,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict total ending energy on the winning team.'
  },
  {
    id: 4,
    title: 'Hero With Most Damage',
    multiplier: 6,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the hero with the most total damage dealt.'
  },
  {
    id: 5,
    title: 'Hero With Least Casts (Alive)',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the alive hero with the fewest casts.'
  },
  {
    id: 6,
    title: 'Hero With Most Casts (Alive)',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the alive hero with the most casts.'
  },
  {
    id: 7,
    title: 'First Hero To Die',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the first hero to die.'
  },
  {
    id: 8,
    title: 'Last Hero To Die On Losing Team',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'hero',
    prompt: 'Pick the last hero to die on the losing team.'
  },
  {
    id: 9,
    title: 'Round With Most Hero Deaths',
    multiplier: 4,
    maxStake: 5,
    predictionType: 'number',
    prompt: 'Predict the round with the highest death count.'
  }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toSocketSafe(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value;
  const t = typeof value;
  if (t === 'number' || t === 'string' || t === 'boolean') return value;
  if (t !== 'object') return undefined;
  if (depth > 14) return null;
  if (seen.has(value)) return null;

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => toSocketSafe(entry, depth + 1, seen));
    }
    const out = {};
    Object.keys(value).forEach((key) => {
      const v = toSocketSafe(value[key], depth + 1, seen);
      if (v !== undefined) out[key] = v;
    });
    return out;
  } finally {
    seen.delete(value);
  }
}

function sampleUnique(source, count) {
  const list = Array.isArray(source) ? [...source] : [];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list.slice(0, Math.max(0, Math.min(count, list.length)));
}

function makeLobbyCode(existingCodes) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  return `L${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

function cloneHeroForBattle(hero, uid) {
  const h = deepClone(hero);
  h.currentHealth = Number(h.health || 0);
  h.currentArmor = Number(h.armor || 0);
  h.currentEnergy = Number(h.energy || 0);
  h.currentSpeed = Number(h.speed || 0);
  h.currentSpellPower = Number(h.spellPower || 0);
  h._bettingUid = uid;
  return h;
}

function chooseBotNames() {
  const picks = sampleUnique(BOT_NAMES, 2);
  if (picks.length < 2) return ['Easy Bot A', 'Easy Bot B'];
  return picks;
}

function chooseSideBet(heroOptions) {
  const picked = SIDE_BET_POOL[Math.floor(Math.random() * SIDE_BET_POOL.length)];
  return {
    ...picked,
    heroOptions: picked.predictionType === 'hero' ? heroOptions : []
  };
}

function createBattleSpec(roundNumber) {
  const [botA, botB] = chooseBotNames();
  const mainSlots = sampleUnique([0, 1, 2, 3, 4, 5, 6, 7, 8], 5);

  const teamA = {
    main: makeEmptyMain('player1'),
    reserve: makeReserve('player1')
  };
  const teamB = {
    main: makeEmptyMain('player2'),
    reserve: makeReserve('player2')
  };

  const heroesA = sampleUnique(DRAFTABLE_HEROES, 7);
  const heroesB = sampleUnique(DRAFTABLE_HEROES, 7);

  const heroOptions = [];

  for (let i = 0; i < 5; i += 1) {
    const slot = mainSlots[i];
    const heroA = heroesA[i];
    const heroB = heroesB[i];
    if (heroA) {
      const uidA = `r${roundNumber}-p1-main-${slot}-${heroA.id}-${i}`;
      teamA.main[slot] = {
        ...teamA.main[slot],
        hero: cloneHeroForBattle(heroA, uidA)
      };
      heroOptions.push({ uid: uidA, name: heroA.name, team: botA });
    }
    if (heroB) {
      const uidB = `r${roundNumber}-p2-main-${slot}-${heroB.id}-${i}`;
      teamB.main[slot] = {
        ...teamB.main[slot],
        hero: cloneHeroForBattle(heroB, uidB)
      };
      heroOptions.push({ uid: uidB, name: heroB.name, team: botB });
    }
  }

  for (let i = 0; i < 2; i += 1) {
    const heroA = heroesA[5 + i];
    const heroB = heroesB[5 + i];
    if (heroA) {
      const uidA = `r${roundNumber}-p1-res-${i}-${heroA.id}`;
      teamA.reserve[i] = {
        ...teamA.reserve[i],
        hero: cloneHeroForBattle(heroA, uidA)
      };
      heroOptions.push({ uid: uidA, name: heroA.name, team: botA });
    }
    if (heroB) {
      const uidB = `r${roundNumber}-p2-res-${i}-${heroB.id}`;
      teamB.reserve[i] = {
        ...teamB.reserve[i],
        hero: cloneHeroForBattle(heroB, uidB)
      };
      heroOptions.push({ uid: uidB, name: heroB.name, team: botB });
    }
  }

  const sideBet = chooseSideBet(heroOptions);

  return {
    roundNumber,
    bots: {
      p1: botA,
      p2: botB
    },
    p1Main: teamA.main,
    p1Reserve: teamA.reserve,
    p2Main: teamB.main,
    p2Reserve: teamB.reserve,
    heroOptions,
    sideBet
  };
}

function getTileByToken(snapshot, token) {
  if (!snapshot || !token || typeof token.index !== 'number') return null;
  const boardName = String(token.boardName || '');
  if (boardName === 'p1Main') return (snapshot.p1Board || [])[token.index] || null;
  if (boardName === 'p2Main') return (snapshot.p2Board || [])[token.index] || null;
  if (boardName === 'p1Reserve') return (snapshot.p1Reserve || [])[token.index] || null;
  if (boardName === 'p2Reserve') return (snapshot.p2Reserve || [])[token.index] || null;
  return null;
}

function isAliveTile(tile) {
  if (!tile || !tile.hero) return false;
  if (tile._dead) return false;
  const hp = tile.currentHealth != null ? Number(tile.currentHealth) : Number(tile.hero.health || 0);
  return hp > 0;
}

function collectAllTiles(snapshot) {
  const out = [];
  const collect = (arr, side) => {
    (arr || []).forEach((tile) => {
      if (!tile || !tile.hero || !tile.hero._bettingUid) return;
      out.push({
        uid: tile.hero._bettingUid,
        name: tile.hero.name || 'Hero',
        side,
        alive: isAliveTile(tile),
        tile
      });
    });
  };
  collect(snapshot.p1Board, 'p1');
  collect(snapshot.p1Reserve, 'p1');
  collect(snapshot.p2Board, 'p2');
  collect(snapshot.p2Reserve, 'p2');
  return out;
}

function remainingStat(snapshot, side, field) {
  const arrays = side === 'p1'
    ? [snapshot.p1Board || [], snapshot.p1Reserve || []]
    : [snapshot.p2Board || [], snapshot.p2Reserve || []];

  return arrays.reduce((sum, arr) => sum + arr.reduce((acc, tile) => {
    if (!isAliveTile(tile)) return acc;
    const value = tile[field] != null
      ? Number(tile[field])
      : Number(tile.hero && tile.hero[field.replace('current', '').toLowerCase()] || 0);
    return acc + Math.max(0, value);
  }, 0), 0);
}

function countAliveTilesForSide(snapshot, side) {
  const arrays = side === 'p1'
    ? [snapshot?.p1Board || [], snapshot?.p1Reserve || []]
    : [snapshot?.p2Board || [], snapshot?.p2Reserve || []];

  let count = 0;
  arrays.forEach((arr) => {
    (arr || []).forEach((tile) => {
      if (!tile || !tile.hero) return;
      if (tile._dead) return;
      const hp = tile.currentHealth != null ? Number(tile.currentHealth) : Number(tile.hero.health || 0);
      if (hp > 0) count += 1;
    });
  });
  return count;
}

function evaluateSideBetWinners(sideBet, placed, outcome) {
  const eligible = placed.filter((entry) => Number(entry.sideAmount || 0) > 0);
  if (!sideBet || eligible.length === 0) return new Set();

  const winners = new Set();

  if (sideBet.id === 1) {
    let best = Infinity;
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamHealth || 0));
      best = Math.min(best, dist);
    });
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamHealth || 0));
      if (dist === best) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 2) {
    eligible.forEach((entry) => {
      if (Number(entry.sidePrediction) === Number(outcome.endRound || 0)) {
        winners.add(entry.playerId);
      }
    });
    return winners;
  }

  if (sideBet.id === 3) {
    let best = Infinity;
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamEnergy || 0));
      best = Math.min(best, dist);
    });
    eligible.forEach((entry) => {
      const guess = Number(entry.sidePrediction);
      if (!Number.isFinite(guess)) return;
      const dist = Math.abs(guess - Number(outcome.winningTeamEnergy || 0));
      if (dist === best) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 4) {
    const set = new Set(outcome.mostDamageHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 5) {
    const set = new Set(outcome.leastCastsAliveHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 6) {
    const set = new Set(outcome.mostCastsAliveHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 7) {
    const set = new Set(outcome.firstToDieHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 8) {
    const set = new Set(outcome.lastDieOnLosingTeamHeroes || []);
    eligible.forEach((entry) => {
      if (set.has(String(entry.sidePrediction || ''))) winners.add(entry.playerId);
    });
    return winners;
  }

  if (sideBet.id === 9) {
    const set = new Set(outcome.roundsWithMostDeaths || []);
    eligible.forEach((entry) => {
      if (set.has(Number(entry.sidePrediction))) winners.add(entry.playerId);
    });
  }

  return winners;
}

function computeTeamPower(main, reserve) {
  const all = [...(main || []), ...(reserve || [])];
  return all.reduce((sum, tile) => {
    if (!tile || !tile.hero) return sum;
    const h = tile.hero;
    return sum
      + Number(h.health || 0)
      + Number(h.armor || 0)
      + Number(h.speed || 0)
      + Number(h.spellPower || 0)
      + Number(h.energy || 0);
  }, 0);
}

function buildFallbackBattleOutcome(spec) {
  const p1Power = computeTeamPower(spec.p1Main, spec.p1Reserve);
  const p2Power = computeTeamPower(spec.p2Main, spec.p2Reserve);
  const winnerSide = p1Power >= p2Power ? 'p1' : 'p2';
  const losingSide = winnerSide === 'p1' ? 'p2' : 'p1';

  return {
    winnerSide,
    losingSide,
    endRound: 1,
    winningTeamHealth: 0,
    winningTeamEnergy: 0,
    mostDamageHeroes: [],
    leastCastsAliveHeroes: [],
    mostCastsAliveHeroes: [],
    firstToDieHeroes: [],
    lastDieOnLosingTeamHeroes: [],
    roundsWithMostDeaths: [1],
    heroNameByUid: {},
    castsByHero: {},
    damageByHero: {},
    playback: ['Battle simulation timeout fallback applied.'],
    replayInitialState: toSocketSafe({
      p1Main: deepClone(spec.p1Main),
      p2Main: deepClone(spec.p2Main),
      p1Reserve: deepClone(spec.p1Reserve),
      p2Reserve: deepClone(spec.p2Reserve),
      phase: 'battle',
      gameMode: 'classic',
      roundNumber: 0,
      priorityPlayer: 'player1'
    }),
    replaySteps: []
  };
}

function parseMoveToken(token) {
  const raw = String(token || '');
  if (raw.startsWith('p1Reserve:')) {
    const idx = Number(raw.split(':')[1]);
    return Number.isFinite(idx) ? { side: 'p1', isReserve: true, index: idx } : null;
  }
  if (raw.startsWith('p2Reserve:')) {
    const idx = Number(raw.split(':')[1]);
    return Number.isFinite(idx) ? { side: 'p2', isReserve: true, index: idx } : null;
  }
  if (raw.startsWith('p1:')) {
    const idx = Number(raw.split(':')[1]);
    return Number.isFinite(idx) ? { side: 'p1', isReserve: false, index: idx } : null;
  }
  if (raw.startsWith('p2:')) {
    const idx = Number(raw.split(':')[1]);
    return Number.isFinite(idx) ? { side: 'p2', isReserve: false, index: idx } : null;
  }
  return null;
}

function normalizeDecisionForSide(decision, side) {
  if (!decision || !decision.sourceId || !decision.destinationId) return null;
  if (side === 'p2') return decision;
  const map = (id) => String(id || '').replace(/^p2Reserve:/, 'p1Reserve:').replace(/^p2:/, 'p1:');
  return {
    sourceId: map(decision.sourceId),
    destinationId: map(decision.destinationId)
  };
}

function applyMoveDecisionToBoards(boards, decision) {
  const src = parseMoveToken(decision?.sourceId);
  const dst = parseMoveToken(decision?.destinationId);
  if (!src || !dst || src.side !== dst.side) return false;

  const mainKey = src.side === 'p1' ? 'p1Main' : 'p2Main';
  const reserveKey = src.side === 'p1' ? 'p1Reserve' : 'p2Reserve';
  const srcArr = src.isReserve ? boards[reserveKey] : boards[mainKey];
  const dstArr = dst.isReserve ? boards[reserveKey] : boards[mainKey];

  if (!Array.isArray(srcArr) || !Array.isArray(dstArr)) return false;
  if (src.index < 0 || src.index >= srcArr.length) return false;
  if (dst.index < 0 || dst.index >= dstArr.length) return false;

  const tmp = srcArr[src.index];
  srcArr[src.index] = dstArr[dst.index];
  dstArr[dst.index] = tmp;
  return true;
}

function normalizePrioritySide(prio) {
  const raw = String(prio || '').toLowerCase();
  if (raw === 'player1' || raw === 'p1') return 'p1';
  if (raw === 'player2' || raw === 'p2') return 'p2';
  return 'p1';
}

function toPriorityPlayer(side) {
  return side === 'p2' ? 'player2' : 'player1';
}

function getMovementSequenceFromPriority(priorityPlayer) {
  const side = normalizePrioritySide(priorityPlayer);
  return side === 'p1' ? ['p1', 'p2', 'p2', 'p1'] : ['p2', 'p1', 'p1', 'p2'];
}

function hasPreventMovement(tile) {
  return !!(tile && Array.isArray(tile.effects) && tile.effects.some((e) => e && e.preventMovement));
}

function countsTowardMainLimit(tile) {
  return !!(tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true);
}

function markHeroMovedThisPhase(tile) {
  try {
    if (tile && tile.hero) tile.hero._movedThisMovementPhase = true;
  } catch (e) {}
}

function applyValidatedMoveDecisionToBoards(boards, decision) {
  const src = parseMoveToken(decision?.sourceId);
  const dst = parseMoveToken(decision?.destinationId);
  if (!src || !dst || src.side !== dst.side) return false;

  const mainKey = src.side === 'p1' ? 'p1Main' : 'p2Main';
  const reserveKey = src.side === 'p1' ? 'p1Reserve' : 'p2Reserve';
  const srcArr = src.isReserve ? boards[reserveKey] : boards[mainKey];
  const dstArr = dst.isReserve ? boards[reserveKey] : boards[mainKey];

  if (!Array.isArray(srcArr) || !Array.isArray(dstArr)) return false;
  if (src.index < 0 || src.index >= srcArr.length) return false;
  if (dst.index < 0 || dst.index >= dstArr.length) return false;

  const srcTile = srcArr[src.index];
  const dstTile = dstArr[dst.index];
  if (!srcTile || !srcTile.hero || srcTile._dead) return false;
  if (hasPreventMovement(srcTile) || hasPreventMovement(dstTile)) return false;

  if (src.isReserve && !dst.isReserve) {
    const mainArr = boards[mainKey] || [];
    const mainAliveCount = mainArr.filter(countsTowardMainLimit).length;
    const dstHasLivingHero = countsTowardMainLimit(dstTile);
    if (!dstHasLivingHero && mainAliveCount >= 5) return false;
  }

  const sourceTileState = srcTile && srcTile._tileState ? srcTile._tileState : null;
  const sourceMineMeta = srcTile && srcTile._mine ? { ...srcTile._mine } : null;
  const destinationTileState = dstTile && dstTile._tileState ? dstTile._tileState : null;
  const destinationMineMeta = dstTile && dstTile._mine ? { ...dstTile._mine } : null;

  const tmp = srcArr[src.index];
  srcArr[src.index] = dstArr[dst.index];
  dstArr[dst.index] = tmp;

  if (srcArr[src.index]) {
    srcArr[src.index]._tileState = sourceTileState;
    srcArr[src.index]._mine = sourceMineMeta;
  }
  if (dstArr[dst.index]) {
    dstArr[dst.index]._tileState = destinationTileState;
    dstArr[dst.index]._mine = destinationMineMeta;
  }

  markHeroMovedThisPhase(srcArr[src.index]);
  markHeroMovedThisPhase(dstArr[dst.index]);
  return true;
}

function mirrorMainBoardForP2Perspective(board) {
  const src = Array.isArray(board) ? board : [];
  const out = new Array(9).fill(null);
  for (let i = 0; i < 9; i += 1) {
    out[i] = src[8 - i] || null;
  }
  return out;
}

function unmirrorP1TokenFromP2Perspective(token) {
  const raw = String(token || '');
  if (raw.startsWith('p2Reserve:')) {
    return raw.replace('p2Reserve:', 'p1Reserve:');
  }
  if (raw.startsWith('p2:')) {
    const idx = Number(raw.split(':')[1]);
    if (!Number.isFinite(idx)) return null;
    return `p1:${8 - idx}`;
  }
  return null;
}

function chooseMovementDecisionForSide(side, p1Main, p1Reserve, p2Main, p2Reserve) {
  if (side === 'p2') {
    const baseDecision = makeMovementDecision(
      p2Main,
      p2Reserve,
      { movementPhase: { sequence: ['p2'], index: 0 } },
      p1Main,
      p1Reserve
    );
    return normalizeDecisionForSide(baseDecision, 'p2');
  }

  const mirroredP1Main = mirrorMainBoardForP2Perspective(p1Main);
  const mirroredP2Main = mirrorMainBoardForP2Perspective(p2Main);
  const baseDecision = makeMovementDecision(
    mirroredP1Main,
    p1Reserve,
    { movementPhase: { sequence: ['p2'], index: 0 } },
    mirroredP2Main,
    p2Reserve
  );
  if (!baseDecision) return null;

  const sourceId = unmirrorP1TokenFromP2Perspective(baseDecision.sourceId);
  const destinationId = unmirrorP1TokenFromP2Perspective(baseDecision.destinationId);
  if (!sourceId || !destinationId) return null;

  return {
    sourceId,
    destinationId
  };
}

async function simulateBattleWithTimeout(spec, timeoutMs = 15_000, options = {}) {
  let timeoutId = null;
  let didTimeout = false;
  const startedAt = Date.now();
  try {
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        resolve(null);
      }, timeoutMs);
    });
    const result = await Promise.race([
      simulateBattle(spec, {
        ...options,
        isCancelled: () => didTimeout
      }),
      timeoutPromise
    ]);
    return {
      result,
      didTimeout,
      timeoutMs: Number(timeoutMs || 0),
      elapsedMs: Date.now() - startedAt
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function simulateBattle(spec, options = {}) {
  const onLiveStep = typeof options.onLiveStep === 'function' ? options.onLiveStep : null;
  const onRoundVisualBarrier = typeof options.onRoundVisualBarrier === 'function' ? options.onRoundVisualBarrier : null;
  const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : (() => false);
  let p1Main = deepClone(spec.p1Main);
  let p1Reserve = deepClone(spec.p1Reserve);
  let p2Main = deepClone(spec.p2Main);
  let p2Reserve = deepClone(spec.p2Reserve);

  const damageByHero = new Map();
  const castsByHero = new Map();
  const heroNameByUid = new Map();
  const heroSideByUid = new Map();
  const deathEvents = [];
  const deathsByRound = new Map();
  const playback = [];
  const replaySteps = [];
  let replaySeq = 0;

  let deathSeq = 0;
  let prevAlive = new Map();
  const prevHealthByUid = new Map();
  let winnerToken = null;
  let endRound = 0;
  let eliminationRound = null;
  let eliminationWinnerSide = null;
  let winningTeamHealthAtElimination = null;
  let winningTeamEnergyAtElimination = null;
  let currentPriorityPlayer = 'player1';
  let lastCastActionBySide = null;

  const seedSnapshot = { p1Board: p1Main, p2Board: p2Main, p1Reserve, p2Reserve };
  collectAllTiles(seedSnapshot).forEach((entry) => {
    prevAlive.set(entry.uid, entry.alive);
    const hp = entry.tile && entry.tile.currentHealth != null
      ? Number(entry.tile.currentHealth)
      : Number(entry.tile?.hero?.health || 0);
    prevHealthByUid.set(entry.uid, Math.max(0, hp));
    heroNameByUid.set(entry.uid, entry.name);
    heroSideByUid.set(entry.uid, entry.side);
    damageByHero.set(entry.uid, 0);
    castsByHero.set(entry.uid, 0);
  });

  for (let round = 1; round <= 20; round += 1) {
    if (isCancelled()) return null;
    endRound = round;
    let roundBoundarySeq = null;
    let roundBoundaryWinner = null;

    const pushReplayState = (actionType, movementPhase = null) => {
      if (isCancelled()) return;
      replaySeq += 1;
      const action = { type: actionType, seq: replaySeq };
      action.state = toSocketSafe({
        p1Main: deepClone(p1Main || []),
        p2Main: deepClone(p2Main || []),
        p1Reserve: deepClone(p1Reserve || []),
        p2Reserve: deepClone(p2Reserve || []),
        priorityPlayer: round % 2 === 0 ? 'player2' : 'player1',
        phase: movementPhase ? 'movement' : (actionType === 'movementComplete' ? 'ready' : 'battle'),
        roundNumber: Number(round)
      });
      if (movementPhase) action.state.movementPhase = toSocketSafe(deepClone(movementPhase));
      const safeAction = toSocketSafe(action);
      replaySteps.push(safeAction);
      if (onLiveStep && safeAction) onLiveStep(safeAction);
    };

    if (round > 1) {
      const movementOrder = getMovementSequenceFromPriority(currentPriorityPlayer);
      for (let moveIndex = 0; moveIndex < movementOrder.length; moveIndex += 1) {
        if (isCancelled()) return null;
        const mover = movementOrder[moveIndex];
        const movementPhase = { sequence: movementOrder, index: moveIndex };
        pushReplayState('movementStart', movementPhase);

        const decision = chooseMovementDecisionForSide(mover, p1Main, p1Reserve, p2Main, p2Reserve);
        if (decision) {
          applyValidatedMoveDecisionToBoards({ p1Main, p2Main, p1Reserve, p2Reserve }, decision);
        }

        pushReplayState('movementSwap', { sequence: movementOrder, index: Math.min(moveIndex + 1, movementOrder.length - 1) });
      }

      pushReplayState('movementComplete', null);

      const nextPrioritySide = normalizePrioritySide(currentPriorityPlayer) === 'p1' ? 'p2' : 'p1';
      currentPriorityPlayer = toPriorityPlayer(nextPrioritySide);
    }

    const result = await executeRound(
      {
        p1Board: p1Main,
        p2Board: p2Main,
        p1Reserve,
        p2Reserve,
        priorityPlayer: currentPriorityPlayer,
        roundNumber: round,
        lastCastActionBySide,
        gameMode: 'classic'
      },
      {
        castDelayMs: 0,
        postEffectDelayMs: 0,
        reactionDelayMs: 0,
        postCastDelayMs: 0,
        quiet: true,
        speedMultiplier: 30,
        onStep: (snapshot) => {
          if (isCancelled()) return;
          const action = snapshot && snapshot.lastAction ? snapshot.lastAction : null;
          replaySeq += 1;
          const stepAction = toSocketSafe(action ? deepClone(action) : { type: 'stateSync' }) || { type: 'stateSync' };
          stepAction.seq = replaySeq;
          stepAction.state = toSocketSafe({
            p1Main: deepClone(snapshot?.p1Board || []),
            p2Main: deepClone(snapshot?.p2Board || []),
            p1Reserve: deepClone(snapshot?.p1Reserve || []),
            p2Reserve: deepClone(snapshot?.p2Reserve || []),
            priorityPlayer: snapshot?.priorityPlayer || 'player1',
            phase: snapshot?.phase || 'battle',
            roundNumber: Number(snapshot?.roundNumber || round)
          });
          const safeStep = toSocketSafe(stepAction);
          replaySteps.push(safeStep);
          if (onLiveStep && safeStep) onLiveStep(safeStep);

          if (safeStep && (safeStep.type === 'roundComplete' || safeStep.type === 'gameEnd')) {
            roundBoundarySeq = Number(safeStep.seq || 0);
            roundBoundaryWinner = safeStep.winner || null;
          }

          if (safeStep && safeStep.type === 'gameEnd' && eliminationRound == null) {
            const snapshotRound = Number(snapshot?.roundNumber || round);
            const stepWinner = safeStep.winner === 'player1'
              ? 'p1'
              : safeStep.winner === 'player2'
                ? 'p2'
                : null;
            if (stepWinner) {
              eliminationRound = Math.max(1, snapshotRound);
              eliminationWinnerSide = stepWinner;
              winningTeamHealthAtElimination = remainingStat(snapshot, stepWinner, 'currentHealth');
              winningTeamEnergyAtElimination = remainingStat(snapshot, stepWinner, 'currentEnergy');
            }
          }

          collectAllTiles(snapshot).forEach((entry) => {
            heroNameByUid.set(entry.uid, entry.name);
            heroSideByUid.set(entry.uid, entry.side);
            if (!damageByHero.has(entry.uid)) damageByHero.set(entry.uid, 0);
            if (!castsByHero.has(entry.uid)) castsByHero.set(entry.uid, 0);
          });

          if (action && action.type === 'cast' && action.caster) {
            const casterTile = getTileByToken(snapshot, action.caster);
            const casterUid = casterTile && casterTile.hero ? casterTile.hero._bettingUid : null;
            if (casterUid) {
              castsByHero.set(casterUid, Number(castsByHero.get(casterUid) || 0) + 1);

              // Use health deltas between snapshots to capture deferred/indirect cast damage.
              const casterSide = heroSideByUid.get(casterUid) || null;
              let damage = 0;
              collectAllTiles(snapshot).forEach((entry) => {
                const currentHp = entry.tile && entry.tile.currentHealth != null
                  ? Number(entry.tile.currentHealth)
                  : Number(entry.tile?.hero?.health || 0);
                const nowHp = Math.max(0, currentHp);
                const prevHp = Number(prevHealthByUid.get(entry.uid) || 0);
                if (casterSide && entry.side !== casterSide) {
                  damage += Math.max(0, prevHp - nowHp);
                }
              });

              if (damage <= 0) {
                // Fallback for non-deferred direct result payloads.
                damage = (Array.isArray(action.results) ? action.results : []).reduce((sum, item) => {
                  const amount = item && item.applied && item.applied.type === 'damage'
                    ? Number(item.applied.amount || 0)
                    : 0;
                  return sum + Math.max(0, amount);
                }, 0);
              }

              damageByHero.set(casterUid, Number(damageByHero.get(casterUid) || 0) + damage);
              const casterName = heroNameByUid.get(casterUid) || 'Hero';
              if (damage > 0 && playback.length < 220) {
                playback.push(`Round ${round}: ${casterName} dealt ${damage} total damage.`);
              }
            }
          }

          const allNow = collectAllTiles(snapshot);
          const nowUids = new Set(allNow.map((entry) => entry.uid));

          if (eliminationRound == null) {
            const p1Alive = countAliveTilesForSide(snapshot, 'p1');
            const p2Alive = countAliveTilesForSide(snapshot, 'p2');

            if (p1Alive === 0 || p2Alive === 0) {
              const snapshotRound = Number(snapshot?.roundNumber || round);
              let snapshotWinnerSide = null;
              if (p1Alive > p2Alive) snapshotWinnerSide = 'p1';
              else if (p2Alive > p1Alive) snapshotWinnerSide = 'p2';
              else {
                const p1Hp = remainingStat(snapshot, 'p1', 'currentHealth');
                const p2Hp = remainingStat(snapshot, 'p2', 'currentHealth');
                snapshotWinnerSide = p1Hp >= p2Hp ? 'p1' : 'p2';
              }

              eliminationRound = Math.max(1, snapshotRound);
              eliminationWinnerSide = snapshotWinnerSide;
              winningTeamHealthAtElimination = remainingStat(snapshot, snapshotWinnerSide, 'currentHealth');
              winningTeamEnergyAtElimination = remainingStat(snapshot, snapshotWinnerSide, 'currentEnergy');
            }
          }

          // Some death flows remove heroes from the board immediately.
          // Treat missing previously-alive heroes as death events.
          prevAlive.forEach((beforeAlive, uid) => {
            if (beforeAlive !== true) return;
            if (nowUids.has(uid)) return;
            const side = heroSideByUid.get(uid) || null;
            const name = heroNameByUid.get(uid) || 'Hero';
            deathSeq += 1;
            deathEvents.push({ uid, round, seq: deathSeq, side });
            deathsByRound.set(round, Number(deathsByRound.get(round) || 0) + 1);
            prevAlive.set(uid, false);
            if (playback.length < 220) {
              playback.push(`Round ${round}: ${name} was slain.`);
            }
          });

          allNow.forEach((entry) => {
            const beforeAlive = prevAlive.get(entry.uid);
            const nowAlive = entry.alive;
            prevAlive.set(entry.uid, nowAlive);
            if (beforeAlive === true && nowAlive === false) {
              deathSeq += 1;
              deathEvents.push({ uid: entry.uid, round, seq: deathSeq, side: entry.side });
              deathsByRound.set(round, Number(deathsByRound.get(round) || 0) + 1);
              if (playback.length < 220) {
                playback.push(`Round ${round}: ${entry.name} was slain.`);
              }
            }

            const hp = entry.tile && entry.tile.currentHealth != null
              ? Number(entry.tile.currentHealth)
              : Number(entry.tile?.hero?.health || 0);
            prevHealthByUid.set(entry.uid, Math.max(0, hp));
          });
        }
      }
    );

    if (isCancelled()) return null;

    p1Main = result.p1Board;
    p2Main = result.p2Board;
    p1Reserve = result.p1Reserve;
    p2Reserve = result.p2Reserve;
    currentPriorityPlayer = result.priorityPlayer || currentPriorityPlayer;
    lastCastActionBySide = result.lastCastActionBySide || lastCastActionBySide;

    if (onRoundVisualBarrier && Number(roundBoundarySeq || 0) > 0) {
      await onRoundVisualBarrier({
        round: Number(round),
        seq: Number(roundBoundarySeq),
        hasWinner: !!roundBoundaryWinner
      });
    }

    if (result.winner) {
      winnerToken = result.winner;
      break;
    }
  }

  const finalSnapshot = { p1Board: p1Main, p2Board: p2Main, p1Reserve, p2Reserve };

  const p1Health = remainingStat(finalSnapshot, 'p1', 'currentHealth');
  const p2Health = remainingStat(finalSnapshot, 'p2', 'currentHealth');

  let winnerSide = eliminationWinnerSide
    || (winnerToken === 'player1'
      ? 'p1'
      : winnerToken === 'player2'
        ? 'p2'
        : p1Health >= p2Health
          ? 'p1'
          : 'p2');

  const losingSide = winnerSide === 'p1' ? 'p2' : 'p1';

  const winningTeamHealth = winningTeamHealthAtElimination != null
    ? Number(winningTeamHealthAtElimination)
    : remainingStat(finalSnapshot, winnerSide, 'currentHealth');
  const winningTeamEnergy = winningTeamEnergyAtElimination != null
    ? Number(winningTeamEnergyAtElimination)
    : remainingStat(finalSnapshot, winnerSide, 'currentEnergy');

  const damageEntries = [...damageByHero.entries()];
  const maxDamage = damageEntries.reduce((max, [, value]) => Math.max(max, Number(value || 0)), 0);
  const mostDamageHeroes = damageEntries
    .filter(([, value]) => Number(value || 0) === maxDamage)
    .map(([uid]) => uid);

  const aliveTiles = collectAllTiles(finalSnapshot).filter((entry) => entry.alive);
  const aliveCastEntries = aliveTiles.map((entry) => ({
    uid: entry.uid,
    casts: Number(castsByHero.get(entry.uid) || 0)
  }));

  const leastCast = aliveCastEntries.length > 0
    ? aliveCastEntries.reduce((min, entry) => Math.min(min, entry.casts), Infinity)
    : null;
  const mostCast = aliveCastEntries.length > 0
    ? aliveCastEntries.reduce((max, entry) => Math.max(max, entry.casts), -Infinity)
    : null;

  const leastCastsAliveHeroes = leastCast == null
    ? []
    : aliveCastEntries.filter((entry) => entry.casts === leastCast).map((entry) => entry.uid);
  const mostCastsAliveHeroes = mostCast == null
    ? []
    : aliveCastEntries.filter((entry) => entry.casts === mostCast).map((entry) => entry.uid);

  const firstToDieHeroes = [];
  if (deathEvents.length > 0) {
    const minSeq = deathEvents.reduce((min, event) => Math.min(min, event.seq), Infinity);
    deathEvents.forEach((event) => {
      if (event.seq === minSeq) firstToDieHeroes.push(event.uid);
    });
  }

  const losingDeaths = deathEvents.filter((event) => event.side === losingSide);
  const lastDieOnLosingTeamHeroes = [];
  if (losingDeaths.length > 0) {
    const maxSeq = losingDeaths.reduce((max, event) => Math.max(max, event.seq), -Infinity);
    losingDeaths.forEach((event) => {
      if (event.seq === maxSeq) lastDieOnLosingTeamHeroes.push(event.uid);
    });
  }

  const roundDeathEntries = [...deathsByRound.entries()];
  const maxDeathsAnyRound = roundDeathEntries.reduce((max, [, value]) => Math.max(max, Number(value || 0)), 0);
  const roundsWithMostDeaths = roundDeathEntries
    .filter(([, value]) => Number(value || 0) === maxDeathsAnyRound)
    .map(([round]) => Number(round));

  const replayDerivedEndRound = replaySteps.reduce((max, step) => {
    const stateRound = Number(step?.state?.roundNumber || 0);
    const actionRound = Number(step?.roundNumber || 0);
    return Math.max(max, stateRound, actionRound);
  }, 0);

  const resolvedEndRound = eliminationRound != null
    ? Number(eliminationRound)
    : Math.max(Number(endRound || 0), Number(replayDerivedEndRound || 0), 1);

  return {
    winnerSide,
    losingSide,
    endRound: resolvedEndRound,
    winningTeamHealth,
    winningTeamEnergy,
    mostDamageHeroes,
    leastCastsAliveHeroes,
    mostCastsAliveHeroes,
    firstToDieHeroes,
    lastDieOnLosingTeamHeroes,
    roundsWithMostDeaths,
    heroNameByUid: Object.fromEntries(heroNameByUid.entries()),
    castsByHero: Object.fromEntries(castsByHero.entries()),
    damageByHero: Object.fromEntries(damageByHero.entries()),
    playback: playback.slice(0, 220),
    replayInitialState: toSocketSafe({
      p1Main: deepClone(spec.p1Main),
      p2Main: deepClone(spec.p2Main),
      p1Reserve: deepClone(spec.p1Reserve),
      p2Reserve: deepClone(spec.p2Reserve),
      phase: 'battle',
      gameMode: 'classic',
      roundNumber: 0,
      priorityPlayer: 'player1'
    }),
    replaySteps: toSocketSafe(replaySteps),
    finalSnapshot
  };
}

function createLiveBattleTracking(spec) {
  const tracking = {
    p1Main: deepClone(spec?.p1Main || []),
    p2Main: deepClone(spec?.p2Main || []),
    p1Reserve: deepClone(spec?.p1Reserve || []),
    p2Reserve: deepClone(spec?.p2Reserve || []),
    priorityPlayer: 'player1',
    lastCastActionBySide: null,
    roundNumber: 0,
    phase: 'battle',
    seq: 0,
    winnerToken: null,
    eliminationRound: null,
    eliminationWinnerSide: null,
    winningTeamHealthAtElimination: null,
    winningTeamEnergyAtElimination: null,
    damageByHero: new Map(),
    castsByHero: new Map(),
    heroNameByUid: new Map(),
    heroSideByUid: new Map(),
    deathEvents: [],
    deathsByRound: new Map(),
    playback: [],
    deathSeq: 0,
    prevAlive: new Map(),
    prevHealthByUid: new Map()
  };

  const seedSnapshot = {
    p1Board: tracking.p1Main,
    p2Board: tracking.p2Main,
    p1Reserve: tracking.p1Reserve,
    p2Reserve: tracking.p2Reserve
  };
  collectAllTiles(seedSnapshot).forEach((entry) => {
    tracking.prevAlive.set(entry.uid, entry.alive);
    const hp = entry.tile && entry.tile.currentHealth != null
      ? Number(entry.tile.currentHealth)
      : Number(entry.tile?.hero?.health || 0);
    tracking.prevHealthByUid.set(entry.uid, Math.max(0, hp));
    tracking.heroNameByUid.set(entry.uid, entry.name);
    tracking.heroSideByUid.set(entry.uid, entry.side);
    tracking.damageByHero.set(entry.uid, 0);
    tracking.castsByHero.set(entry.uid, 0);
  });

  return tracking;
}

function observeLiveBattleSnapshot(tracking, snapshot, round) {
  if (!tracking || !snapshot) return;
  const safeRound = Number(round || snapshot?.roundNumber || 0) || 0;
  const action = snapshot && snapshot.lastAction ? snapshot.lastAction : null;

  collectAllTiles(snapshot).forEach((entry) => {
    tracking.heroNameByUid.set(entry.uid, entry.name);
    tracking.heroSideByUid.set(entry.uid, entry.side);
    if (!tracking.damageByHero.has(entry.uid)) tracking.damageByHero.set(entry.uid, 0);
    if (!tracking.castsByHero.has(entry.uid)) tracking.castsByHero.set(entry.uid, 0);
  });

  if (action && action.type === 'cast' && action.caster) {
    const casterTile = getTileByToken(snapshot, action.caster);
    const casterUid = casterTile && casterTile.hero ? casterTile.hero._bettingUid : null;
    if (casterUid) {
      tracking.castsByHero.set(casterUid, Number(tracking.castsByHero.get(casterUid) || 0) + 1);

      const casterSide = tracking.heroSideByUid.get(casterUid) || null;
      let damage = 0;
      collectAllTiles(snapshot).forEach((entry) => {
        const currentHp = entry.tile && entry.tile.currentHealth != null
          ? Number(entry.tile.currentHealth)
          : Number(entry.tile?.hero?.health || 0);
        const nowHp = Math.max(0, currentHp);
        const prevHp = Number(tracking.prevHealthByUid.get(entry.uid) || 0);
        if (casterSide && entry.side !== casterSide) {
          damage += Math.max(0, prevHp - nowHp);
        }
      });

      if (damage <= 0) {
        damage = (Array.isArray(action.results) ? action.results : []).reduce((sum, item) => {
          const amount = item && item.applied && item.applied.type === 'damage'
            ? Number(item.applied.amount || 0)
            : 0;
          return sum + Math.max(0, amount);
        }, 0);
      }

      tracking.damageByHero.set(casterUid, Number(tracking.damageByHero.get(casterUid) || 0) + damage);
      const casterName = tracking.heroNameByUid.get(casterUid) || 'Hero';
      if (damage > 0 && tracking.playback.length < 220) {
        tracking.playback.push(`Round ${safeRound}: ${casterName} dealt ${damage} total damage.`);
      }
    }
  }

  const allNow = collectAllTiles(snapshot);
  const nowUids = new Set(allNow.map((entry) => entry.uid));

  if (tracking.eliminationRound == null) {
    const p1Alive = countAliveTilesForSide(snapshot, 'p1');
    const p2Alive = countAliveTilesForSide(snapshot, 'p2');

    if (p1Alive === 0 || p2Alive === 0) {
      let snapshotWinnerSide = null;
      if (p1Alive > p2Alive) snapshotWinnerSide = 'p1';
      else if (p2Alive > p1Alive) snapshotWinnerSide = 'p2';
      else {
        const p1Hp = remainingStat(snapshot, 'p1', 'currentHealth');
        const p2Hp = remainingStat(snapshot, 'p2', 'currentHealth');
        snapshotWinnerSide = p1Hp >= p2Hp ? 'p1' : 'p2';
      }

      tracking.eliminationRound = Math.max(1, safeRound);
      tracking.eliminationWinnerSide = snapshotWinnerSide;
      tracking.winningTeamHealthAtElimination = remainingStat(snapshot, snapshotWinnerSide, 'currentHealth');
      tracking.winningTeamEnergyAtElimination = remainingStat(snapshot, snapshotWinnerSide, 'currentEnergy');
    }
  }

  tracking.prevAlive.forEach((beforeAlive, uid) => {
    if (beforeAlive !== true) return;
    if (nowUids.has(uid)) return;
    const side = tracking.heroSideByUid.get(uid) || null;
    const name = tracking.heroNameByUid.get(uid) || 'Hero';
    tracking.deathSeq += 1;
    tracking.deathEvents.push({ uid, round: safeRound, seq: tracking.deathSeq, side });
    tracking.deathsByRound.set(safeRound, Number(tracking.deathsByRound.get(safeRound) || 0) + 1);
    tracking.prevAlive.set(uid, false);
    if (tracking.playback.length < 220) {
      tracking.playback.push(`Round ${safeRound}: ${name} was slain.`);
    }
  });

  allNow.forEach((entry) => {
    const beforeAlive = tracking.prevAlive.get(entry.uid);
    const nowAlive = entry.alive;
    tracking.prevAlive.set(entry.uid, nowAlive);
    if (beforeAlive === true && nowAlive === false) {
      tracking.deathSeq += 1;
      tracking.deathEvents.push({ uid: entry.uid, round: safeRound, seq: tracking.deathSeq, side: entry.side });
      tracking.deathsByRound.set(safeRound, Number(tracking.deathsByRound.get(safeRound) || 0) + 1);
      if (tracking.playback.length < 220) {
        tracking.playback.push(`Round ${safeRound}: ${entry.name} was slain.`);
      }
    }

    const hp = entry.tile && entry.tile.currentHealth != null
      ? Number(entry.tile.currentHealth)
      : Number(entry.tile?.hero?.health || 0);
    tracking.prevHealthByUid.set(entry.uid, Math.max(0, hp));
  });
}

function finalizeLiveBattleOutcome(spec, tracking) {
  const finalSnapshot = {
    p1Board: tracking.p1Main,
    p2Board: tracking.p2Main,
    p1Reserve: tracking.p1Reserve,
    p2Reserve: tracking.p2Reserve
  };

  const p1Health = remainingStat(finalSnapshot, 'p1', 'currentHealth');
  const p2Health = remainingStat(finalSnapshot, 'p2', 'currentHealth');

  const winnerSide = tracking.eliminationWinnerSide
    || (tracking.winnerToken === 'player1'
      ? 'p1'
      : tracking.winnerToken === 'player2'
        ? 'p2'
        : p1Health >= p2Health
          ? 'p1'
          : 'p2');
  const losingSide = winnerSide === 'p1' ? 'p2' : 'p1';

  const winningTeamHealth = tracking.winningTeamHealthAtElimination != null
    ? Number(tracking.winningTeamHealthAtElimination)
    : remainingStat(finalSnapshot, winnerSide, 'currentHealth');
  const winningTeamEnergy = tracking.winningTeamEnergyAtElimination != null
    ? Number(tracking.winningTeamEnergyAtElimination)
    : remainingStat(finalSnapshot, winnerSide, 'currentEnergy');

  const damageEntries = [...tracking.damageByHero.entries()];
  const maxDamage = damageEntries.reduce((max, [, value]) => Math.max(max, Number(value || 0)), 0);
  const mostDamageHeroes = damageEntries
    .filter(([, value]) => Number(value || 0) === maxDamage)
    .map(([uid]) => uid);

  const aliveTiles = collectAllTiles(finalSnapshot).filter((entry) => entry.alive);
  const aliveCastEntries = aliveTiles.map((entry) => ({
    uid: entry.uid,
    casts: Number(tracking.castsByHero.get(entry.uid) || 0)
  }));

  const leastCast = aliveCastEntries.length > 0
    ? aliveCastEntries.reduce((min, entry) => Math.min(min, entry.casts), Infinity)
    : null;
  const mostCast = aliveCastEntries.length > 0
    ? aliveCastEntries.reduce((max, entry) => Math.max(max, entry.casts), -Infinity)
    : null;

  const leastCastsAliveHeroes = leastCast == null
    ? []
    : aliveCastEntries.filter((entry) => entry.casts === leastCast).map((entry) => entry.uid);
  const mostCastsAliveHeroes = mostCast == null
    ? []
    : aliveCastEntries.filter((entry) => entry.casts === mostCast).map((entry) => entry.uid);

  const firstToDieHeroes = [];
  if (tracking.deathEvents.length > 0) {
    const minSeq = tracking.deathEvents.reduce((min, event) => Math.min(min, event.seq), Infinity);
    tracking.deathEvents.forEach((event) => {
      if (event.seq === minSeq) firstToDieHeroes.push(event.uid);
    });
  }

  const losingDeaths = tracking.deathEvents.filter((event) => event.side === losingSide);
  const lastDieOnLosingTeamHeroes = [];
  if (losingDeaths.length > 0) {
    const maxSeq = losingDeaths.reduce((max, event) => Math.max(max, event.seq), -Infinity);
    losingDeaths.forEach((event) => {
      if (event.seq === maxSeq) lastDieOnLosingTeamHeroes.push(event.uid);
    });
  }

  const roundDeathEntries = [...tracking.deathsByRound.entries()];
  const maxDeathsAnyRound = roundDeathEntries.reduce((max, [, value]) => Math.max(max, Number(value || 0)), 0);
  const roundsWithMostDeaths = roundDeathEntries
    .filter(([, value]) => Number(value || 0) === maxDeathsAnyRound)
    .map(([round]) => Number(round));

  return {
    winnerSide,
    losingSide,
    endRound: Number(tracking.eliminationRound || tracking.roundNumber || 1),
    winningTeamHealth,
    winningTeamEnergy,
    mostDamageHeroes,
    leastCastsAliveHeroes,
    mostCastsAliveHeroes,
    firstToDieHeroes,
    lastDieOnLosingTeamHeroes,
    roundsWithMostDeaths,
    heroNameByUid: Object.fromEntries(tracking.heroNameByUid.entries()),
    castsByHero: Object.fromEntries(tracking.castsByHero.entries()),
    damageByHero: Object.fromEntries(tracking.damageByHero.entries()),
    playback: tracking.playback.slice(0, 220),
    finalSnapshot
  };
}

export function createBettingModeManager(io) {
  const lobbiesByCode = new Map();
  const lobbyCodeBySocketId = new Map();
  const lobbyCodeByPlayerId = new Map();
  const playerIdBySocketId = new Map();

  const roomForLobby = (code) => `betting:${code}`;

  const getPlayerId = (socket) => {
    const raw = socket?.data?.playfab?.playFabId;
    if (!raw) return null;
    return String(raw);
  };

  const getPlayerName = (socket) => String(socket?.data?.playfab?.username || 'Player');

  const getLiveSocket = (socketId) => {
    if (!socketId) return null;
    return io.sockets.sockets.get(String(socketId)) || null;
  };

  const reconcilePlayerConnectionState = (lobby, playerId, now = Date.now()) => {
    if (!lobby || !playerId) return null;
    const id = String(playerId);
    const player = lobby.players.get(id);
    if (!player) {
      lobbyCodeByPlayerId.delete(id);
      return null;
    }

    const socketId = player.socketId ? String(player.socketId) : null;
    const liveSocket = socketId ? getLiveSocket(socketId) : null;

    if (socketId && !liveSocket) {
      lobbyCodeBySocketId.delete(socketId);
      player.socketId = null;
      player.online = false;
      player.lastSeenAt = now;
    } else if (!socketId && player.online) {
      player.online = false;
      player.lastSeenAt = now;
    }

    return player;
  };

  const getExistingLobbyForPlayer = (playerId, now = Date.now()) => {
    if (!playerId) return null;
    const id = String(playerId);
    const code = lobbyCodeByPlayerId.get(id);
    if (!code) return null;

    const lobby = lobbiesByCode.get(code);
    if (!lobby || !lobby.players.has(id)) {
      lobbyCodeByPlayerId.delete(id);
      return null;
    }

    const player = reconcilePlayerConnectionState(lobby, id, now);
    const liveSocket = player?.socketId ? getLiveSocket(player.socketId) : null;
    return { lobby, player, liveSocket };
  };

  const detachPlayerFromLobby = (lobby, playerId) => {
    if (!lobby || !playerId || !lobby.players.has(String(playerId))) return false;
    const id = String(playerId);
    const player = lobby.players.get(id);
    if (player?.socketId) {
      lobbyCodeBySocketId.delete(String(player.socketId));
      playerIdBySocketId.delete(String(player.socketId));
      try {
        getLiveSocket(player.socketId)?.leave(roomForLobby(lobby.code));
      } catch (e) {}
    }
    const removed = purgePlayerFromLobby(lobby, id);
    if (!removed) return false;
    if (lobby.playerOrder.length > 0) {
      emitLobbyState(lobby);
    }
    deleteLobbyIfEmpty(lobby);
    return true;
  };

  const preparePlayerForLobbyAction = (socket, { allowTakeover = false } = {}) => {
    const playerId = getPlayerId(socket);
    if (!playerId) {
      return { ok: false, playerId: null };
    }

    const existing = getExistingLobbyForPlayer(playerId, Date.now());
    if (!existing || !existing.lobby || !existing.player) {
      return { ok: true, playerId, previousLobby: null };
    }

    const existingSocketId = existing.player.socketId ? String(existing.player.socketId) : null;
    const hasOtherLiveSocket = !!(existing.liveSocket && existingSocketId && existingSocketId !== socket.id);
    if (hasOtherLiveSocket && !allowTakeover) {
      return {
        ok: false,
        playerId,
        reason: 'already-connected',
        previousLobby: existing.lobby
      };
    }

    if (existingSocketId === socket.id) {
      removeFromLobby(socket, { silent: true });
    } else {
      detachPlayerFromLobby(existing.lobby, playerId);
    }

    return { ok: true, playerId, previousLobby: existing.lobby };
  };

  const clearLobbyTimer = (lobby) => {
    if (lobby && lobby.timer) {
      clearTimeout(lobby.timer);
      lobby.timer = null;
    }
  };

  const clearRoundVisualGate = (lobby) => {
    if (!lobby || !lobby.pendingRoundVisualGate) return;
    const gate = lobby.pendingRoundVisualGate;
    if (gate.timeout) {
      clearTimeout(gate.timeout);
    }
    lobby.pendingRoundVisualGate = null;
  };

  const clearPlaybackStepTimeout = (lobby) => {
    if (!lobby || !lobby.playbackSession) return;
    if (lobby.playbackSession.timeout) {
      clearTimeout(lobby.playbackSession.timeout);
      lobby.playbackSession.timeout = null;
    }
  };

  const clearPlaybackStateFeedTimeout = (lobby) => {
    if (!lobby || !lobby.playbackSession) return;
  };

  const clearPlaybackSession = (lobby, resolve = false) => {
    if (!lobby || !lobby.playbackSession) return;
    const session = lobby.playbackSession;
    clearPlaybackStepTimeout(lobby);
    clearPlaybackStateFeedTimeout(lobby);
    lobby.playbackSession = null;
    if (resolve && typeof session.resolve === 'function') {
      session.resolve();
    }
  };

  const purgePlayerFromLobby = (lobby, playerId) => {
    if (!lobby || !playerId) return false;
    const id = String(playerId);
    const player = lobby.players.get(id);
    if (!player) return false;
    if (player.socketId) {
      lobbyCodeBySocketId.delete(player.socketId);
    }
    lobby.players.delete(id);
    lobby.playerOrder = lobby.playerOrder.filter((entry) => String(entry) !== id);
    delete lobby.bets[id];
    lobbyCodeByPlayerId.delete(id);
    if (lobby.hostPlayerId === id) {
      lobby.hostPlayerId = lobby.playerOrder[0] || null;
    }
    return true;
  };

  const pruneStaleLobbies = (now = Date.now()) => {
    let changed = false;
    const lobbyCodes = Array.from(lobbiesByCode.keys());
    lobbyCodes.forEach((code) => {
      const lobby = lobbiesByCode.get(code);
      if (!lobby) return;

      lobby.playerOrder.forEach((playerId) => {
        const before = lobby.players.get(playerId);
        const beforeOnline = !!before?.online;
        const beforeSocketId = before?.socketId ? String(before.socketId) : null;
        const player = reconcilePlayerConnectionState(lobby, playerId, now);
        const afterOnline = !!player?.online;
        const afterSocketId = player?.socketId ? String(player.socketId) : null;
        if (beforeOnline !== afterOnline || beforeSocketId !== afterSocketId) {
          changed = true;
        }
      });

      if (lobby.phase === 'lobby') {
        const staleOfflinePlayers = lobby.playerOrder.filter((playerId) => {
          const player = lobby.players.get(playerId);
          if (!player || player.online) return false;
          const lastSeenAt = Number(player.lastSeenAt || 0);
          return lastSeenAt > 0 && (now - lastSeenAt) >= BETTING_LOBBY_RECONNECT_GRACE_MS;
        });
        staleOfflinePlayers.forEach((playerId) => {
          if (purgePlayerFromLobby(lobby, playerId)) {
            changed = true;
          }
        });
      }

      const onlinePlayers = lobby.playerOrder.filter((playerId) => {
        const player = lobby.players.get(playerId);
        return !!(player && player.online);
      });
      const allOfflineStale = lobby.playerOrder.length > 0 && onlinePlayers.length === 0 && lobby.playerOrder.every((playerId) => {
        const player = lobby.players.get(playerId);
        const lastSeenAt = Number(player?.lastSeenAt || 0);
        return lastSeenAt > 0 && (now - lastSeenAt) >= BETTING_LOBBY_RECONNECT_GRACE_MS;
      });

      if (lobby.playerOrder.length === 0 || allOfflineStale) {
        clearLobbyTimer(lobby);
        clearRoundVisualGate(lobby);
        clearPlaybackSession(lobby, false);
        lobby.playerOrder.forEach((playerId) => {
          const player = lobby.players.get(playerId);
          if (player?.socketId) {
            lobbyCodeBySocketId.delete(player.socketId);
          }
          lobbyCodeByPlayerId.delete(String(playerId));
        });
        lobbiesByCode.delete(lobby.code);
        changed = true;
      }
    });
    return changed;
  };

  const emitBattleStateSnapshot = (lobby, step) => {
    if (!lobby || !step) return;
    const payload = buildBattleStateSnapshotFromStep(step);
    if (!payload) return;
    lobby.liveBattleState = payload;
    io.to(roomForLobby(lobby.code)).emit('bettingBattleState', payload);
  };

  const sendNextPlaybackStep = (lobby) => {
    if (!lobby || !lobby.playbackSession) return;
    const session = lobby.playbackSession;
    if (!lobbiesByCode.has(lobby.code)) {
      clearPlaybackSession(lobby, true);
      return;
    }
    if (!Array.isArray(session.steps) || session.index >= session.steps.length) {
      clearPlaybackSession(lobby, true);
      return;
    }

    const step = session.steps[session.index];
    session.awaitingAck = true;
  emitBattleStateSnapshot(lobby, step);
    io.to(roomForLobby(lobby.code)).emit('bettingBattleStep', withTimelineMeta(step));

    clearPlaybackStepTimeout(lobby);
    session.timeout = setTimeout(() => {
      if (!lobby.playbackSession || lobby.playbackSession !== session) return;
      session.awaitingAck = false;
      session.index += 1;
      sendNextPlaybackStep(lobby);
    }, BETTING_STEP_ACK_TIMEOUT_MS);
  };

  const advancePlaybackStep = (lobby) => {
    if (!lobby || !lobby.playbackSession) return;
    const session = lobby.playbackSession;
    if (!session.awaitingAck) return;
    session.awaitingAck = false;
    clearPlaybackStepTimeout(lobby);
    session.index += 1;
    sendNextPlaybackStep(lobby);
  };

  const hasAllActivePlaybackAcksForCurrentStep = (lobby) => {
    if (!lobby || !lobby.playbackSession || !lobby.playbackSession.awaitingAck) return false;
    const session = lobby.playbackSession;
    const current = Array.isArray(session.steps) ? session.steps[session.index] : null;
    const expectedSeq = Number(current?.seq || 0);
    if (!expectedSeq) return false;
    const activeIds = activeOnlinePlayerIds(lobby).map((id) => String(id));
    if (activeIds.length === 0) return false;
    const ackByPlayer = lobby.battleStepAckSeqByPlayer instanceof Map ? lobby.battleStepAckSeqByPlayer : new Map();
    return activeIds.every((playerId) => Number(ackByPlayer.get(playerId) || 0) >= expectedSeq);
  };

  const playBattleStepsWithAck = (lobby, steps) => {
    if (!lobby || !Array.isArray(steps) || steps.length === 0) return Promise.resolve();
    clearPlaybackSession(lobby, false);

    const normalizedSteps = steps
      .filter((step) => step && typeof step === 'object')
      .map((step, idx) => ({
        ...step,
        seq: Number(step.seq || (idx + 1))
      }));

    if (normalizedSteps.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      lobby.playbackSession = {
        steps: normalizedSteps,
        index: 0,
        awaitingAck: false,
        timeout: null,
        resolve
      };
      sendNextPlaybackStep(lobby);
    });
  };

  const tryResolveRoundVisualGate = (lobby) => {
    if (!lobby || !lobby.pendingRoundVisualGate) return false;
    const gate = lobby.pendingRoundVisualGate;
    const required = gate.requiredPlayerIds instanceof Set ? gate.requiredPlayerIds : new Set();
    if (required.size === 0) {
      const resolver = gate.resolve;
      clearRoundVisualGate(lobby);
      if (typeof resolver === 'function') resolver();
      return true;
    }
    const acked = gate.ackedPlayerIds instanceof Set ? gate.ackedPlayerIds : new Set();
    const hasAllAcks = Array.from(required).every((playerId) => acked.has(String(playerId)));
    if (!hasAllAcks) return false;
    const resolver = gate.resolve;
    clearRoundVisualGate(lobby);
    if (typeof resolver === 'function') resolver();
    return true;
  };

  const waitForRoundVisualBarrier = (lobby, payload = {}) => {
    if (!lobby) return Promise.resolve();
    clearRoundVisualGate(lobby);

    const requiredPlayerIds = new Set(activeOnlinePlayerIds(lobby).map((id) => String(id)));
    const seq = Number(payload.seq || 0);
    const round = Number(payload.round || 0);
    const timeoutMs = Math.max(2_000, Number(payload.timeoutMs || BETTING_ROUND_VISUAL_ACK_TIMEOUT_MS));

    if (requiredPlayerIds.size === 0 || seq <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const gate = {
        seq,
        round,
        hasWinner: !!payload.hasWinner,
        requiredPlayerIds,
        ackedPlayerIds: new Set(),
        resolve,
        timeout: null
      };

      const lastAckByPlayer = lobby.battleStepAckSeqByPlayer instanceof Map ? lobby.battleStepAckSeqByPlayer : new Map();
      requiredPlayerIds.forEach((playerId) => {
        const lastSeq = Number(lastAckByPlayer.get(String(playerId)) || 0);
        if (lastSeq >= seq) {
          gate.ackedPlayerIds.add(String(playerId));
        }
      });

      gate.timeout = setTimeout(() => {
        const stillPending = lobby.pendingRoundVisualGate && Number(lobby.pendingRoundVisualGate.seq || 0) === seq;
        if (!stillPending) return;
        const resolver = lobby.pendingRoundVisualGate.resolve;
        clearRoundVisualGate(lobby);
        if (typeof resolver === 'function') resolver();
      }, timeoutMs);

      lobby.pendingRoundVisualGate = gate;
      tryResolveRoundVisualGate(lobby);
    });
  };

  const activeOnlinePlayerIds = (lobby) => lobby.playerOrder.filter((id) => {
    const player = lobby.players.get(id);
    return !!(player && player.online !== false);
  });

  const tryAdvanceBattleToSummary = (lobby) => {
    if (!lobby || lobby.phase !== 'battle') return false;
    if (Number(lobby.lastSettledRound || 0) !== Number(lobby.currentRound || 0)) return false;
    if (!lobby.roundSummary) return false;
    if (lobby.playbackPending === true) return false;
    if (lobby.playbackSession) return false;
    const active = activeOnlinePlayerIds(lobby);
    if (active.length === 0) return false;
    const ackSet = lobby.battleVisualAcks instanceof Set ? lobby.battleVisualAcks : new Set();
    const allActiveAcked = active.every((playerId) => ackSet.has(String(playerId)));
    if (!allActiveAcked) return false;
    clearLobbyTimer(lobby);
    beginSummaryPhase(lobby);
    return true;
  };

  const serializeLobby = (lobby, socketId) => {
    const mePlayerId = playerIdBySocketId.get(socketId) || null;
    const players = lobby.playerOrder
      .map((playerId) => lobby.players.get(playerId))
      .filter(Boolean)
      .map((player) => ({
        id: player.playerId,
        username: player.username,
        coins: Number(player.coins || 0),
        isHost: player.playerId === lobby.hostPlayerId,
        online: !!player.online
      }));

    const me = mePlayerId ? (lobby.players.get(mePlayerId) || null) : null;

    return {
      serverNowTs: Date.now(),
      serverInstanceId: BETTING_SERVER_INSTANCE_ID,
      code: lobby.code,
      visibility: lobby.visibility,
      phase: lobby.phase,
      hostId: lobby.hostPlayerId,
      currentRound: lobby.currentRound,
      totalRounds: BETTING_TOTAL_ROUNDS,
      canStart: mePlayerId === lobby.hostPlayerId && lobby.phase === 'lobby' && players.length >= BETTING_MIN_PLAYERS,
      players,
      me: me
        ? {
            id: me.playerId,
            username: me.username,
            coins: Number(me.coins || 0),
            hasSubmittedBet: !!(mePlayerId && lobby.bets && lobby.bets[mePlayerId])
          }
        : null,
      submittedBets: Object.keys(lobby.bets || {}).length,
      betDeadlineTs: lobby.betDeadlineTs || null,
      battleDeadlineTs: lobby.battleDeadlineTs || null,
      summaryDeadlineTs: lobby.summaryDeadlineTs || null,
      battle: lobby.battleSpec
        ? {
            bots: lobby.battleSpec.bots,
            p1Main: toSocketSafe(lobby.battleSpec.p1Main),
            p1Reserve: toSocketSafe(lobby.battleSpec.p1Reserve),
            p2Main: toSocketSafe(lobby.battleSpec.p2Main),
            p2Reserve: toSocketSafe(lobby.battleSpec.p2Reserve),
            sideBet: lobby.battleSpec.sideBet,
            liveState: lobby.liveBattleState ? toSocketSafe(lobby.liveBattleState) : null,
            replay: null
          }
        : null,
      playback: lobby.playback || null,
      roundSummary: lobby.roundSummary || null,
      finalStandings: lobby.finalStandings || null
    };
  };

  const serializeLobbyBrowser = () => {
    pruneStaleLobbies(Date.now());
    const cards = [];
    lobbiesByCode.forEach((lobby) => {
      if (!lobby || lobby.visibility !== 'public') return;
      if (lobby.phase !== 'lobby') return;
      const totalPlayers = lobby.playerOrder.length;
      const onlinePlayers = lobby.playerOrder.reduce((acc, playerId) => {
        const p = lobby.players.get(playerId);
        return acc + (p && p.online ? 1 : 0);
      }, 0);
      if (onlinePlayers <= 0) return;
      cards.push({
        code: lobby.code,
        serverInstanceId: BETTING_SERVER_INSTANCE_ID,
        phase: lobby.phase,
        visibility: lobby.visibility,
        currentRound: lobby.currentRound,
        totalRounds: BETTING_TOTAL_ROUNDS,
        totalPlayers,
        onlinePlayers,
        hostUsername: lobby.players.get(lobby.hostPlayerId)?.username || 'Host',
        canJoin: lobby.phase === 'lobby' && totalPlayers < BETTING_MAX_PLAYERS
      });
    });
    cards.sort((a, b) => Number(b.totalPlayers || 0) - Number(a.totalPlayers || 0));
    return cards;
  };

  const emitLobbyBrowser = () => {
    pruneStaleLobbies(Date.now());
    const payload = { lobbies: serializeLobbyBrowser() };
    io.emit('bettingLobbyBrowser', payload);
  };

  const emitLobbyState = (lobby) => {
    lobby.playerOrder.forEach((playerId) => {
      const socketId = lobby.players.get(playerId)?.socketId;
      if (!socketId) return;
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) return;
      socket.emit('bettingLobbyState', serializeLobby(lobby, socketId));
    });
    emitLobbyBrowser();
  };

  const getLobbyForSocket = (socketId) => {
    const code = lobbyCodeBySocketId.get(socketId);
    if (!code) return null;
    return lobbiesByCode.get(code) || null;
  };

  const deleteLobbyIfEmpty = (lobby) => {
    if (!lobby || lobby.playerOrder.length > 0) return;
    clearLobbyTimer(lobby);
    lobby.playerOrder.forEach((playerId) => {
      lobbyCodeByPlayerId.delete(playerId);
    });
    lobbiesByCode.delete(lobby.code);
    emitLobbyBrowser();
  };

  const removeFromLobby = (socket, { silent = false } = {}) => {
    const playerId = getPlayerId(socket);
    if (!playerId) return;
    const lobby = getLobbyForSocket(socket.id);
    if (!lobby) return;

    lobby.players.delete(playerId);
    lobby.playerOrder = lobby.playerOrder.filter((id) => id !== playerId);
    delete lobby.bets[playerId];
    lobbyCodeBySocketId.delete(socket.id);
    lobbyCodeByPlayerId.delete(playerId);
    playerIdBySocketId.delete(socket.id);

    socket.leave(roomForLobby(lobby.code));

    if (lobby.hostPlayerId === playerId) {
      lobby.hostPlayerId = lobby.playerOrder[0] || null;
    }

    if (lobby.phase !== 'lobby' && lobby.playerOrder.length < BETTING_MIN_PLAYERS) {
      clearLobbyTimer(lobby);
      lobby.phase = 'complete';
      lobby.finalStandings = lobby.playerOrder
        .map((id) => lobby.players.get(id))
        .filter(Boolean)
        .map((player) => ({ username: player.username, coins: Number(player.coins || 0) }))
        .sort((a, b) => b.coins - a.coins);
    }

    if (!silent) {
      socket.emit('bettingLeftLobby', { ok: true });
    }

    if (lobby.playerOrder.length > 0) {
      emitLobbyState(lobby);
    }
    deleteLobbyIfEmpty(lobby);
  };

  const beginSummaryPhase = (lobby) => {
    lobby.phase = 'summary';
    lobby.summaryDeadlineTs = Date.now() + BETTING_SUMMARY_MS;
    lobby.betDeadlineTs = null;
    lobby.battleDeadlineTs = null;
    lobby.playback = null;
    lobby.liveBattleState = null;

    emitLobbyState(lobby);

    clearLobbyTimer(lobby);
    lobby.timer = setTimeout(() => {
      if (!lobbiesByCode.has(lobby.code)) return;
      if (lobby.currentRound >= BETTING_TOTAL_ROUNDS) {
        lobby.phase = 'complete';
        lobby.finalStandings = lobby.playerOrder
          .map((playerId) => lobby.players.get(playerId))
          .filter(Boolean)
          .map((player) => ({ username: player.username, coins: Number(player.coins || 0) }))
          .sort((a, b) => b.coins - a.coins);
        lobby.summaryDeadlineTs = null;
        emitLobbyState(lobby);
        return;
      }
      startBettingRound(lobby).catch((error) => {
        console.error('[Betting] Failed to start next round:', error);
      });
    }, BETTING_SUMMARY_MS);
  };

  const emitBattleSyncToSocket = (socket, lobby, { forceSync = false } = {}) => {
    if (!socket || !lobby || !lobby.liveBattleState) return;
    socket.emit('bettingBattleState', {
      ...toSocketSafe(lobby.liveBattleState),
      forceSync: !!forceSync,
      syncNonce: Date.now()
    });
  };

  const buildMovementStateStep = (tracking, roundNumber, actionType, movementPhase = null) => {
    tracking.seq += 1;
    return toSocketSafe({
      type: actionType,
      seq: tracking.seq,
      state: {
        p1Main: deepClone(tracking.p1Main || []),
        p2Main: deepClone(tracking.p2Main || []),
        p1Reserve: deepClone(tracking.p1Reserve || []),
        p2Reserve: deepClone(tracking.p2Reserve || []),
        priorityPlayer: tracking.priorityPlayer || 'player1',
        phase: movementPhase ? 'movement' : (actionType === 'movementComplete' ? 'ready' : 'battle'),
        roundNumber: Number(roundNumber || 0),
        ...(movementPhase ? { movementPhase: toSocketSafe(deepClone(movementPhase)) } : {})
      }
    });
  };

  const runLiveBettingBattle = async (lobby) => {
    if (!lobby || !lobby.battleSpec) return;

    const tracking = createLiveBattleTracking(lobby.battleSpec);
    lobby.liveBattleRuntime = tracking;
    lobby.phase = 'battle';
    lobby.betDeadlineTs = null;
    lobby.battleDeadlineTs = null;
    lobby.playbackPending = false;
    lobby.battleVisualAcks = new Set();
    lobby.liveBattleState = buildBattleStateSnapshotFromState({
      p1Main: tracking.p1Main,
      p2Main: tracking.p2Main,
      p1Reserve: tracking.p1Reserve,
      p2Reserve: tracking.p2Reserve,
      priorityPlayer: tracking.priorityPlayer,
      phase: 'battle',
      roundNumber: 0,
      seq: 0
    });
    emitLobbyState(lobby);

    for (let round = 1; round <= 20; round += 1) {
      if (!lobbiesByCode.has(lobby.code)) return;
      tracking.roundNumber = round;
      console.info('[Betting] Round start', {
        lobbyCode: lobby.code,
        round,
        seq: tracking.seq,
        priorityPlayer: tracking.priorityPlayer,
        memory: getProcessMemorySnapshot()
      });

      const steps = [];
      if (round > 1) {
        const movementOrder = getMovementSequenceFromPriority(tracking.priorityPlayer);
        for (let moveIndex = 0; moveIndex < movementOrder.length; moveIndex += 1) {
          const mover = movementOrder[moveIndex];
          const movementPhase = { sequence: movementOrder, index: moveIndex };
          steps.push(buildMovementStateStep(tracking, round, 'movementStart', movementPhase));

          const decision = chooseMovementDecisionForSide(mover, tracking.p1Main, tracking.p1Reserve, tracking.p2Main, tracking.p2Reserve);
          if (decision) {
            applyValidatedMoveDecisionToBoards({
              p1Main: tracking.p1Main,
              p2Main: tracking.p2Main,
              p1Reserve: tracking.p1Reserve,
              p2Reserve: tracking.p2Reserve
            }, decision);
          }

          steps.push(buildMovementStateStep(
            tracking,
            round,
            'movementSwap',
            { sequence: movementOrder, index: Math.min(moveIndex + 1, movementOrder.length - 1) }
          ));
        }

        steps.push(buildMovementStateStep(tracking, round, 'movementComplete'));

        const nextPrioritySide = normalizePrioritySide(tracking.priorityPlayer) === 'p1' ? 'p2' : 'p1';
        tracking.priorityPlayer = toPriorityPlayer(nextPrioritySide);
      }

      const roundStartedAt = Date.now();
      let roundExecutionTimedOut = false;
      let roundTimeoutId = null;
      let result = null;
      try {
        result = await Promise.race([
          processMove(
            {
              p1Main: tracking.p1Main,
              p2Main: tracking.p2Main,
              p1Reserve: tracking.p1Reserve,
              p2Reserve: tracking.p2Reserve,
              roundNumber: Math.max(0, round - 1),
              priorityPlayer: tracking.priorityPlayer,
              phase: 'battle',
              gameMode: 'classic',
              lastCastActionBySide: tracking.lastCastActionBySide || null
            },
            {
              type: 'startRound',
              priorityPlayer: tracking.priorityPlayer,
              speedMultiplier: BETTING_BATTLE_SPEED_MULTIPLIER
            },
            null,
            { returnSteps: true }
          ),
          new Promise((resolve) => {
            roundTimeoutId = setTimeout(() => {
              roundExecutionTimedOut = true;
              resolve(null);
            }, BETTING_ROUND_EXECUTION_TIMEOUT_MS);
          })
        ]);
      } finally {
        if (roundTimeoutId) clearTimeout(roundTimeoutId);
      }

      if (!result) {
        console.warn('[Betting] Live round execution timed out', {
          lobbyCode: lobby.code,
          round,
          elapsedMs: Date.now() - roundStartedAt,
          timeoutMs: BETTING_ROUND_EXECUTION_TIMEOUT_MS,
          bufferedSteps: steps.length,
          seq: tracking.seq,
          memory: getProcessMemorySnapshot()
        });
        const timedOutOutcome = finalizeLiveBattleOutcome(lobby.battleSpec, tracking);
        timedOutOutcome.debug = {
          ...(timedOutOutcome.debug || {}),
          outcomeSource: 'fallback:round-execution-timeout',
          round,
          roundExecutionTimeoutMs: Number(BETTING_ROUND_EXECUTION_TIMEOUT_MS),
          roundExecutionElapsedMs: Math.max(0, Date.now() - roundStartedAt),
          bufferedSteps: Number(steps.length || 0)
        };
        applyBattleOutcomeToLobby(lobby, timedOutOutcome);
        tryAdvanceBattleToSummary(lobby);
        return;
      }

      const normalizedSteps = Array.isArray(result?.steps)
        ? result.steps
            .filter((step) => step && typeof step === 'object')
            .map((step) => {
              tracking.seq += 1;
              return toSocketSafe({
                ...step,
                seq: tracking.seq,
                state: {
                  ...(step?.state || {}),
                  roundNumber: Number(step?.state?.roundNumber || round),
                  phase: step?.state?.phase || 'battle'
                }
              });
            })
            .filter(Boolean)
        : [];

      normalizedSteps.forEach((safeStep) => {
        const safeRound = Number(safeStep?.state?.roundNumber || safeStep?.roundNumber || round || 0) || round;
        observeLiveBattleSnapshot(tracking, {
          p1Board: safeStep?.state?.p1Main || [],
          p2Board: safeStep?.state?.p2Main || [],
          p1Reserve: safeStep?.state?.p1Reserve || [],
          p2Reserve: safeStep?.state?.p2Reserve || [],
          priorityPlayer: safeStep?.state?.priorityPlayer || tracking.priorityPlayer || 'player1',
          roundNumber: safeRound,
          lastAction: (() => {
            const action = { ...safeStep };
            delete action.state;
            return action;
          })()
        }, safeRound);
        steps.push(safeStep);
        if (safeStep.type === 'gameEnd' && !tracking.eliminationRound) {
          const stepWinner = safeStep.winner === 'player1'
            ? 'p1'
            : safeStep.winner === 'player2'
              ? 'p2'
              : null;
          if (stepWinner) {
            tracking.eliminationRound = Math.max(1, safeRound);
            tracking.eliminationWinnerSide = stepWinner;
            tracking.winningTeamHealthAtElimination = remainingStat({
              p1Board: safeStep?.state?.p1Main || [],
              p2Board: safeStep?.state?.p2Main || [],
              p1Reserve: safeStep?.state?.p1Reserve || [],
              p2Reserve: safeStep?.state?.p2Reserve || []
            }, stepWinner, 'currentHealth');
            tracking.winningTeamEnergyAtElimination = remainingStat({
              p1Board: safeStep?.state?.p1Main || [],
              p2Board: safeStep?.state?.p2Main || [],
              p1Reserve: safeStep?.state?.p1Reserve || [],
              p2Reserve: safeStep?.state?.p2Reserve || []
            }, stepWinner, 'currentEnergy');
          }
        }
      });

      tracking.p1Main = result?.state?.p1Main || tracking.p1Main;
      tracking.p2Main = result?.state?.p2Main || tracking.p2Main;
      tracking.p1Reserve = result?.state?.p1Reserve || tracking.p1Reserve;
      tracking.p2Reserve = result?.state?.p2Reserve || tracking.p2Reserve;
      tracking.priorityPlayer = result?.state?.priorityPlayer || tracking.priorityPlayer;
      tracking.lastCastActionBySide = result?.state?.lastCastActionBySide || tracking.lastCastActionBySide;
      tracking.phase = result?.state?.phase || 'battle';

      console.info('[Betting] Round resolved', {
        lobbyCode: lobby.code,
        round,
        elapsedMs: Math.max(0, Date.now() - roundStartedAt),
        movementSteps: steps.length - normalizedSteps.length,
        battleSteps: normalizedSteps.length,
        totalSteps: steps.length,
        seq: tracking.seq,
        winner: normalizedSteps.find((step) => step && step.type === 'gameEnd')?.winner || null,
        memory: getProcessMemorySnapshot()
      });

      await playBattleStepsWithAck(lobby, steps);

      if (!lobbiesByCode.has(lobby.code)) return;

      lobby.liveBattleState = buildBattleStateSnapshotFromState({
        p1Main: tracking.p1Main,
        p2Main: tracking.p2Main,
        p1Reserve: tracking.p1Reserve,
        p2Reserve: tracking.p2Reserve,
        priorityPlayer: tracking.priorityPlayer,
        phase: 'battle',
        roundNumber: tracking.roundNumber,
        seq: tracking.seq
      });

      const winningStep = normalizedSteps.find((step) => step && (step.type === 'gameEnd' || (step.type === 'roundComplete' && step.winner)));
      if (winningStep?.winner) {
        tracking.winnerToken = winningStep.winner;
        const battleOutcome = finalizeLiveBattleOutcome(lobby.battleSpec, tracking);
        applyBattleOutcomeToLobby(lobby, battleOutcome);
        tryAdvanceBattleToSummary(lobby);
        return;
      }
    }

    applyBattleOutcomeToLobby(lobby, finalizeLiveBattleOutcome(lobby.battleSpec, tracking));
    tryAdvanceBattleToSummary(lobby);
  };

  const applyBattleOutcomeToLobby = (lobby, battleOutcome) => {
    if (!lobby || !battleOutcome) return;
    if (Number(lobby.lastSettledRound || 0) === Number(lobby.currentRound || 0)) return;

    const placed = lobby.playerOrder.map((id) => {
      const bet = lobby.bets[id] || {};
      return {
        playerId: id,
        primaryPick: String(bet.primaryPick || ''),
        primaryAmount: Number(bet.primaryAmount || 0),
        sideAmount: Number(bet.sideAmount || 0),
        sidePrediction: bet.sidePrediction
      };
    });

    const sideWinners = evaluateSideBetWinners(lobby.battleSpec.sideBet, placed, battleOutcome);
    const roundRows = [];

    placed.forEach((entry) => {
      const player = lobby.players.get(entry.playerId);
      if (!player) return;

      const before = Number(player.coins || 0);
      const primaryAmount = Math.max(0, Math.floor(Number(entry.primaryAmount || 0)));
      const sideAmount = Math.max(0, Math.floor(Number(entry.sideAmount || 0)));
      const totalStake = primaryAmount + sideAmount;

      const wonPrimary = primaryAmount > 0 && entry.primaryPick === battleOutcome.winnerSide;
      const wonSide = sideAmount > 0 && sideWinners.has(entry.playerId);

      const primaryPayout = wonPrimary ? primaryAmount * 2 : 0;
      const sidePayout = wonSide ? sideAmount * Number(lobby.battleSpec.sideBet.multiplier || 0) : 0;
      const payout = primaryPayout + sidePayout;

      const after = Math.max(0, before - totalStake + payout);
      player.coins = after;

      roundRows.push({
        playerId: entry.playerId,
        username: player.username,
        coinsBefore: before,
        coinsAfter: after,
        primaryPick: entry.primaryPick || null,
        primaryAmount,
        sidePrediction: entry.sidePrediction ?? null,
        sideAmount,
        wonPrimary,
        wonSide,
        payout
      });
    });

    lobby.playback = {
      lines: battleOutcome.playback,
      winnerSide: battleOutcome.winnerSide,
      winnerName: battleOutcome.winnerSide === 'p1' ? lobby.battleSpec.bots.p1 : lobby.battleSpec.bots.p2
    };
    lobby.battleReplay = null;

    lobby.roundSummary = {
      round: lobby.currentRound,
      winnerSide: battleOutcome.winnerSide,
      winnerName: battleOutcome.winnerSide === 'p1' ? lobby.battleSpec.bots.p1 : lobby.battleSpec.bots.p2,
      endRound: battleOutcome.endRound,
      debug: battleOutcome.debug || null,
      sideBet: lobby.battleSpec.sideBet,
      sideBetOutcome: {
        winningTeamHealth: battleOutcome.winningTeamHealth,
        winningTeamEnergy: battleOutcome.winningTeamEnergy,
        mostDamageHeroes: battleOutcome.mostDamageHeroes,
        leastCastsAliveHeroes: battleOutcome.leastCastsAliveHeroes,
        mostCastsAliveHeroes: battleOutcome.mostCastsAliveHeroes,
        firstToDieHeroes: battleOutcome.firstToDieHeroes,
        lastDieOnLosingTeamHeroes: battleOutcome.lastDieOnLosingTeamHeroes,
        roundsWithMostDeaths: battleOutcome.roundsWithMostDeaths,
        heroNameByUid: battleOutcome.heroNameByUid
      },
      rows: roundRows
    };

    lobby.phase = 'battle';
    lobby.betDeadlineTs = null;
    lobby.battleDeadlineTs = null;
    lobby.playbackPending = false;
    lobby.battleVisualAcks = new Set();
    lobby.lastSettledRound = Number(lobby.currentRound || 0);
    lobby.liveBattleRuntime = null;

    emitLobbyState(lobby);

    clearLobbyTimer(lobby);
    lobby.timer = setTimeout(() => {
      if (!lobbiesByCode.has(lobby.code)) return;
      if (lobby.phase !== 'battle') return;
      beginSummaryPhase(lobby);
    }, BETTING_BATTLE_VISUAL_TIMEOUT_MS);
  };

  const closeBettingWindow = async (lobby) => {
    if (!lobby || lobby.phase !== 'betting') return;
    lobby.betDeadlineTs = null;
    // Keep lobby in a pre-battle settle phase while simulation runs.
    // This avoids mounting BattlePhase before replay steps are ready.
    lobby.phase = 'settling';
    lobby.battleDeadlineTs = null;
    lobby.settlingRound = true;
    lobby._debugSettleStartedAt = Date.now();
    emitLobbyState(lobby);

    const prepareBattleWatchdog = setTimeout(() => {
      if (!lobby || !lobbiesByCode.has(lobby.code)) return;
      if (lobby.phase !== 'settling') return;
      if (Number(lobby.lastSettledRound || 0) === Number(lobby.currentRound || 0)) return;
      try {
        console.warn('[Betting] Prepare battle watchdog fallback applied for lobby', lobby.code, 'round', lobby.currentRound);
        const fallback = buildFallbackBattleOutcome(lobby.battleSpec);
        fallback.debug = {
          ...(fallback.debug || {}),
          outcomeSource: 'fallback:prepare-battle-watchdog',
          settleStartedAt: Number(lobby._debugSettleStartedAt || 0),
          settleElapsedMs: Math.max(0, Date.now() - Number(lobby._debugSettleStartedAt || Date.now())),
          prepareBattleMaxMs: Number(BETTING_PREPARE_BATTLE_MAX_MS),
          simulationTimeoutMs: Number(BETTING_SIMULATION_TIMEOUT_MS),
          settledRound: Number(lobby.currentRound || 0)
        };
        applyBattleOutcomeToLobby(lobby, fallback);
      } catch (error) {
        console.error('[Betting] Prepare battle watchdog fallback failed:', error);
      }
    }, BETTING_PREPARE_BATTLE_MAX_MS);

    const settleWatchdog = setTimeout(() => {
      if (!lobby || !lobbiesByCode.has(lobby.code)) return;
      if (lobby.phase !== 'settling') return;
      if (Number(lobby.lastSettledRound || 0) === Number(lobby.currentRound || 0)) return;
      try {
        console.warn('[Betting] Settle watchdog fallback applied for lobby', lobby.code, 'round', lobby.currentRound);
        const fallback = buildFallbackBattleOutcome(lobby.battleSpec);
        fallback.debug = {
          outcomeSource: 'fallback:settle-watchdog',
          settleStartedAt: Number(lobby._debugSettleStartedAt || 0),
          settleElapsedMs: Math.max(0, Date.now() - Number(lobby._debugSettleStartedAt || Date.now())),
          watchdogMs: Number(BETTING_SETTLE_WATCHDOG_MS),
          simulationTimeoutMs: Number(BETTING_SIMULATION_TIMEOUT_MS),
          settledRound: Number(lobby.currentRound || 0)
        };
        applyBattleOutcomeToLobby(lobby, fallback);
      } catch (error) {
        console.error('[Betting] Watchdog fallback failed:', error);
      }
    }, BETTING_SETTLE_WATCHDOG_MS);

    try {
      await runLiveBettingBattle(lobby);
    } catch (error) {
      console.error('[Betting] Failed to settle round:', error);
      lobby.phase = 'summary';
      lobby.roundSummary = {
        round: lobby.currentRound,
        winnerName: 'Unavailable',
        debug: {
          outcomeSource: 'error:settle-exception',
          settleStartedAt: Number(lobby._debugSettleStartedAt || 0),
          settleElapsedMs: Math.max(0, Date.now() - Number(lobby._debugSettleStartedAt || Date.now())),
          simulationTimeoutMs: Number(BETTING_SIMULATION_TIMEOUT_MS),
          watchdogMs: Number(BETTING_SETTLE_WATCHDOG_MS),
          settledRound: Number(lobby.currentRound || 0)
        },
        rows: []
      };
      clearRoundVisualGate(lobby);
      clearPlaybackSession(lobby, false);
      lobby.liveBattleRuntime = null;
      emitLobbyState(lobby);
    } finally {
      clearTimeout(prepareBattleWatchdog);
      clearTimeout(settleWatchdog);
      clearRoundVisualGate(lobby);
      clearPlaybackSession(lobby, false);
      lobby.settlingRound = false;
      lobby._debugSettleStartedAt = null;
    }
  };

  async function startBettingRound(lobby) {
    lobby.currentRound += 1;
    lobby.phase = 'betting';
    lobby.bets = {};
    lobby.roundSummary = null;
    lobby.playback = null;
    lobby.battleReplay = null;
    lobby.liveBattleState = null;
    lobby.liveBattleRuntime = null;
    lobby.battleVisualAcks = null;
    lobby.playbackPending = false;
    lobby.battleStepAckSeqByPlayer = new Map();
    clearRoundVisualGate(lobby);
    clearPlaybackSession(lobby, false);
    lobby.summaryDeadlineTs = null;
    lobby.battleDeadlineTs = null;

    lobby.battleSpec = createBattleSpec(lobby.currentRound);
    lobby.betDeadlineTs = Date.now() + BETTING_BET_MS;

    emitLobbyState(lobby);

    clearLobbyTimer(lobby);
    lobby.timer = setTimeout(() => {
      closeBettingWindow(lobby).catch((error) => {
        console.error('[Betting] Failed to close betting window:', error);
      });
    }, BETTING_BET_MS);
  }

  const onConnection = (socket) => {
    const createLobbyInternal = (visibilityRaw = 'public') => {
      pruneStaleLobbies(Date.now());
      if (!socket.data || !socket.data.playfab) {
        socket.emit('bettingError', { message: 'You must be logged in to create a lobby.' });
        return;
      }

      const prepared = preparePlayerForLobbyAction(socket);
      const playerId = prepared.playerId;
      if (!playerId) {
        socket.emit('bettingError', { message: 'Could not determine player identity.' });
        return;
      }
      if (!prepared.ok) {
        socket.emit('bettingError', { message: 'This account is already connected to a betting lobby on another device/tab.' });
        socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
        return;
      }

      const code = makeLobbyCode(lobbiesByCode);
      const visibility = String(visibilityRaw || '').toLowerCase() === 'private' ? 'private' : 'public';
      const lobby = {
        code,
        createdAt: Date.now(),
        hostPlayerId: playerId,
        visibility,
        phase: 'lobby',
        currentRound: 0,
        players: new Map(),
        playerOrder: [],
        battleSpec: null,
        battleReplay: null,
        bets: {},
        playback: null,
        liveBattleRuntime: null,
        roundSummary: null,
        finalStandings: null,
        lastSettledRound: 0,
        settlingRound: false,
        battleStepAckSeqByPlayer: new Map(),
        timer: null,
        betDeadlineTs: null,
        battleDeadlineTs: null,
        summaryDeadlineTs: null
      };

      lobby.players.set(playerId, {
        playerId,
        socketId: socket.id,
        username: getPlayerName(socket),
        coins: BETTING_STARTING_COINS,
        online: true,
        lastSeenAt: Date.now()
      });
      lobby.playerOrder.push(playerId);

      lobbiesByCode.set(code, lobby);
      lobbyCodeBySocketId.set(socket.id, code);
      playerIdBySocketId.set(socket.id, playerId);
      lobbyCodeByPlayerId.set(playerId, code);
      socket.join(roomForLobby(code));

      emitLobbyState(lobby);
    };

    socket.on('listBettingLobbies', () => {
      pruneStaleLobbies(Date.now());
      socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
    });

    socket.on('createBettingLobby', () => {
      createLobbyInternal('public');
    });

    socket.on('createBettingLobbyWithVisibility', (payload = {}) => {
      createLobbyInternal(payload.visibility);
    });

    socket.on('joinBettingLobby', (payload = {}) => {
      pruneStaleLobbies(Date.now());
      if (!socket.data || !socket.data.playfab) {
        socket.emit('bettingError', { message: 'You must be logged in to join a lobby.' });
        return;
      }

      const playerId = getPlayerId(socket);
      if (!playerId) return;

      const code = String(payload.code || '').trim().toUpperCase();
      const lobby = lobbiesByCode.get(code);
      if (!lobby) {
        socket.emit('bettingError', { message: 'Lobby not found.' });
        return;
      }
      if (lobby.playerOrder.length >= BETTING_MAX_PLAYERS) {
        socket.emit('bettingError', { message: 'Lobby is full.' });
        return;
      }
      if (lobby.phase !== 'lobby') {
        socket.emit('bettingError', { message: 'Game already started in this lobby.' });
        return;
      }

      const existingInLobby = reconcilePlayerConnectionState(lobby, playerId, Date.now());
      if (existingInLobby && existingInLobby.online && existingInLobby.socketId && existingInLobby.socketId !== socket.id && getLiveSocket(existingInLobby.socketId)) {
        socket.emit('bettingError', { message: 'This account is already connected to the lobby on another device/tab.' });
        return;
      }

      const prepared = preparePlayerForLobbyAction(socket);
      if (!prepared.ok) {
        socket.emit('bettingError', { message: 'This account is already connected to a betting lobby on another device/tab.' });
        socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
        return;
      }

      if (lobby.players.has(playerId)) {
        const player = lobby.players.get(playerId);
        player.socketId = socket.id;
        player.online = true;
        player.username = getPlayerName(socket);
        player.lastSeenAt = Date.now();
      } else {
        lobby.players.set(playerId, {
          playerId,
          socketId: socket.id,
          username: getPlayerName(socket),
          coins: BETTING_STARTING_COINS,
          online: true,
          lastSeenAt: Date.now()
        });
        lobby.playerOrder.push(playerId);
      }
      lobbyCodeBySocketId.set(socket.id, code);
      playerIdBySocketId.set(socket.id, playerId);
      lobbyCodeByPlayerId.set(playerId, code);
      socket.join(roomForLobby(code));

      emitLobbyState(lobby);
    });

    socket.on('leaveBettingLobby', () => {
      removeFromLobby(socket);
    });

    socket.on('startBettingGame', () => {
      const playerId = getPlayerId(socket);
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby) {
        socket.emit('bettingError', { message: 'Join a lobby first.' });
        return;
      }
      if (!playerId || lobby.hostPlayerId !== playerId) {
        socket.emit('bettingError', { message: 'Only the lobby host can start.' });
        return;
      }
      if (lobby.phase !== 'lobby') {
        socket.emit('bettingError', { message: 'Game already started.' });
        return;
      }
      if (lobby.playerOrder.length < BETTING_MIN_PLAYERS) {
        socket.emit('bettingError', { message: 'At least 2 players are required to start.' });
        return;
      }

      lobby.playerOrder.forEach((id) => {
        const player = lobby.players.get(id);
        if (player) player.coins = BETTING_STARTING_COINS;
      });

      startBettingRound(lobby).catch((error) => {
        console.error('[Betting] Failed to start game:', error);
        socket.emit('bettingError', { message: 'Could not start betting game.' });
      });
    });

    socket.on('placeBettingBet', (payload = {}) => {
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby) return;
      if (lobby.phase !== 'betting') return;

      const playerId = getPlayerId(socket);
      if (!playerId) return;

      const player = lobby.players.get(playerId);
      if (!player) return;

      if (lobby.bets[playerId]) {
        socket.emit('bettingError', { message: 'Bet already submitted for this round.' });
        return;
      }

      const primaryAmount = Math.max(0, Math.floor(Number(payload.primaryAmount || 0)));
      const sideAmountRaw = Math.max(0, Math.floor(Number(payload.sideAmount || 0)));
      const sideAmount = Math.min(Number(lobby.battleSpec?.sideBet?.maxStake || 5), sideAmountRaw);
      const primaryPick = String(payload.primaryPick || '');
      const total = primaryAmount + sideAmount;

      if (!['p1', 'p2'].includes(primaryPick)) {
        socket.emit('bettingError', { message: 'Primary bet must pick one of the two bots.' });
        return;
      }
      if (primaryAmount < 1) {
        socket.emit('bettingError', { message: 'Primary bet minimum is 1 coin.' });
        return;
      }
      if (total > Number(player.coins || 0)) {
        socket.emit('bettingError', { message: 'Your total stake exceeds your coins.' });
        return;
      }

      const sideBet = lobby.battleSpec?.sideBet || null;
      let sidePrediction = payload.sidePrediction;
      if (sideAmount > 0 && sideBet) {
        if (sideBet.predictionType === 'hero') {
          const valid = (sideBet.heroOptions || []).some((option) => option.uid === String(sidePrediction || ''));
          if (!valid) {
            socket.emit('bettingError', { message: 'Choose a valid hero for the side bet.' });
            return;
          }
          sidePrediction = String(sidePrediction || '');
        } else {
          const num = Number(sidePrediction);
          if (!Number.isFinite(num)) {
            socket.emit('bettingError', { message: 'Side bet prediction must be numeric.' });
            return;
          }
          sidePrediction = Math.floor(num);
        }
      } else {
        sidePrediction = null;
      }

      lobby.bets[playerId] = {
        primaryPick,
        primaryAmount,
        sideAmount,
        sidePrediction,
        submittedAt: Date.now()
      };

      const submittedPlayers = new Set(Object.keys(lobby.bets || {}));
      const activePlayerIds = lobby.playerOrder.filter((id) => {
        const p = lobby.players.get(id);
        return !!(p && p.online !== false);
      });
      const allActiveSubmitted = activePlayerIds.length > 0 && activePlayerIds.every((id) => submittedPlayers.has(String(id)));
      const allSeatsSubmitted = lobby.playerOrder.length > 0 && lobby.playerOrder.every((id) => submittedPlayers.has(String(id)));

      if (allActiveSubmitted || allSeatsSubmitted) {
        clearLobbyTimer(lobby);
        closeBettingWindow(lobby).catch((error) => {
          console.error('[Betting] Failed to settle early close:', error);
        });
        return;
      }

      emitLobbyState(lobby);
    });

    socket.on('bettingBattleVisualComplete', (payload = {}) => {
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby || lobby.phase !== 'battle') return;
      if (lobby.settlingRound) return;
      if (Number(lobby.lastSettledRound || 0) !== Number(lobby.currentRound || 0)) return;
      if (!lobby.roundSummary) return;

      const playerId = getPlayerId(socket);
      if (!playerId) return;

      const expectedRound = Number(payload?.round || 0);
      if (expectedRound && expectedRound !== Number(lobby.currentRound || 0)) return;

      if (!(lobby.battleVisualAcks instanceof Set)) {
        lobby.battleVisualAcks = new Set();
      }
      lobby.battleVisualAcks.add(String(playerId));
      tryAdvanceBattleToSummary(lobby);
    });

    socket.on('bettingBattleStepAck', (payload = {}) => {
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby) return;

      const seq = Number(payload?.seq || 0);
      if (!Number.isFinite(seq) || seq <= 0) return;

      if (lobby.playbackSession && lobby.playbackSession.awaitingAck) {
        const current = Array.isArray(lobby.playbackSession.steps)
          ? lobby.playbackSession.steps[lobby.playbackSession.index]
          : null;
        if (current && Number(current.seq || 0) === seq) {
          advancePlaybackStep(lobby);
          return;
        }
      }
    });

    socket.on('requestBettingBattleSync', () => {
      const lobby = getLobbyForSocket(socket.id);
      if (!lobby || lobby.phase !== 'battle') return;
      emitBattleSyncToSocket(socket, lobby, { forceSync: true });
    });
  };

  const onAuthenticated = (socket) => {
    pruneStaleLobbies(Date.now());
    const playerId = getPlayerId(socket);
    if (!playerId) return;

    const existing = getExistingLobbyForPlayer(playerId, Date.now());
    if (!existing || !existing.lobby) {
      socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
      return;
    }

    const lobby = existing.lobby;

    if (lobby.phase === 'complete') {
      const player = lobby.players.get(playerId);
      if (player && player.socketId) {
        lobbyCodeBySocketId.delete(player.socketId);
      }
      lobby.players.delete(playerId);
      lobby.playerOrder = lobby.playerOrder.filter((id) => id !== playerId);
      delete lobby.bets[playerId];
      lobbyCodeByPlayerId.delete(playerId);
      deleteLobbyIfEmpty(lobby);
      socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
      return;
    }

    const player = lobby.players.get(playerId);
    if (player.online && player.socketId && player.socketId !== socket.id && getLiveSocket(player.socketId)) {
      socket.emit('bettingError', { message: 'This account is already connected to that betting lobby on another device/tab.' });
      socket.emit('bettingLobbyBrowser', { lobbies: serializeLobbyBrowser() });
      return;
    }

    lobbyCodeBySocketId.set(socket.id, lobby.code);
    playerIdBySocketId.set(socket.id, playerId);
    socket.join(roomForLobby(lobby.code));

    player.socketId = socket.id;
    player.online = true;
    player.username = getPlayerName(socket);
    player.lastSeenAt = Date.now();

    emitLobbyState(lobby);
  };

  const onDisconnect = (socket) => {
    const lobby = getLobbyForSocket(socket.id);
    const playerId = playerIdBySocketId.get(socket.id);
    lobbyCodeBySocketId.delete(socket.id);
    playerIdBySocketId.delete(socket.id);
    if (!lobby || !playerId) return;
    const player = lobby.players.get(playerId);
    if (!player) return;
    player.socketId = null;
    player.online = false;
    player.lastSeenAt = Date.now();
    pruneStaleLobbies(Date.now());
    emitLobbyState(lobby);
    tryAdvanceBattleToSummary(lobby);
  };

  return {
    onConnection,
    onAuthenticated,
    onDisconnect
  };
}
