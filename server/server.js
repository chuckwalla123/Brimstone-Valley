/*
 * ==================== BOARD LAYOUT REFERENCE ====================
 * Each board is a 3x3 grid stored as a flat array [0..8]:
 *
 *   P1 Board        P2 Board
 *   [0, 1, 2]       [0, 1, 2]
 *   [3, 4, 5]       [3, 4, 5]
 *   [6, 7, 8]       [6, 7, 8]
 *
 * ROW DEFINITIONS (front/middle/back are relative to each player):
 *   P1: Front = [2,5,8], Middle = [1,4,7], Back = [0,3,6]
 *   P2: Front = [0,3,6], Middle = [1,4,7], Back = [2,5,8]
 *
 * COLUMN DEFINITIONS (vertical slices):
 *   Column 0 = [0,1,2], Column 1 = [3,4,5], Column 2 = [6,7,8]
 *
 * PROJECTILE/COLUMN TARGETING:
 *   - Columns mirror across boards (P1 col 0 targets P2 col 0, etc.)
 *   - Example: P1 casting from column [0,1,2] targets P2's [0,1,2]
 *   - Column attacks hit all 3 tiles in the target column
 *   - Projectiles hit front-most occupied tile first (P2: 0, then 1, then 2)
 *
 * VISUAL NOTE: The boards face each other, so P1's front (2,5,8) is
 * closest to P2's front (0,3,6).
 * ================================================================
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { makeEmptyMain, makeReserve, processMove, isValidMove, deepClone } from '../shared/gameLogic.js';
import { HEROES } from '../src/heroes.js';
import { executeRound } from '../src/battleEngine.js';
import { getRandomAugments, applyAugmentsToHero } from '../src/tower/augments.js';
import { createBettingModeManager } from './bettingMode.js';

const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID || '';
const PLAYFAB_SECRET_KEY = process.env.PLAYFAB_SECRET_KEY || '';
const SERVER_INSTANCE_ID = process.env.FLY_ALLOC_ID || process.env.HOSTNAME || `pid:${process.pid}`;

const verifyPlayFabSession = async (sessionTicket) => {
  if (!PLAYFAB_TITLE_ID || !PLAYFAB_SECRET_KEY) return null;
  if (!sessionTicket) return null;
  try {
    const url = `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Server/AuthenticateSessionTicket`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SecretKey': PLAYFAB_SECRET_KEY
      },
      body: JSON.stringify({ SessionTicket: sessionTicket })
    });
    const data = await res.json();
    if (!res.ok || data.error) return null;
    return data.data;
  } catch (e) {
    console.error('PlayFab auth error:', e);
    return null;
  }
};

// Update player statistics via PlayFab Server API
const updatePlayerStatistics = async (playFabId, statistics) => {
  if (!PLAYFAB_TITLE_ID || !PLAYFAB_SECRET_KEY || !playFabId) {
    console.log('[PlayFab] Cannot update stats - missing config or playFabId');
    return false;
  }
  try {
    const url = `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Server/UpdatePlayerStatistics`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SecretKey': PLAYFAB_SECRET_KEY
      },
      body: JSON.stringify({
        PlayFabId: playFabId,
        Statistics: statistics // Array of { StatisticName, Value }
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('[PlayFab] Failed to update stats:', data);
      return false;
    }
    console.log('[PlayFab] Stats updated for', playFabId, statistics);
    return true;
  } catch (e) {
    console.error('[PlayFab] Error updating stats:', e);
    return false;
  }
};

const getPlayerStatistics = async (playFabId, statisticNames = []) => {
  if (!PLAYFAB_TITLE_ID || !PLAYFAB_SECRET_KEY || !playFabId) {
    console.log('[PlayFab] Cannot fetch stats - missing config or playFabId');
    return null;
  }
  try {
    const url = `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetPlayerStatistics`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SecretKey': PLAYFAB_SECRET_KEY
      },
      body: JSON.stringify({
        PlayFabId: playFabId,
        StatisticNames: statisticNames
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('[PlayFab] Failed to fetch stats:', data);
      return null;
    }
    const stats = {};
    for (const stat of data.data?.Statistics || []) {
      if (!stat?.StatisticName) continue;
      stats[stat.StatisticName] = Number(stat.Value || 0);
    }
    return stats;
  } catch (e) {
    console.error('[PlayFab] Error fetching stats:', e);
    return null;
  }
};

const incrementPlayerStatistics = async (playFabId, statisticDeltas) => {
  const deltas = Array.isArray(statisticDeltas)
    ? statisticDeltas.filter((entry) => entry && entry.StatisticName && Number.isFinite(Number(entry.Value)))
    : [];
  if (deltas.length === 0) return true;

  const statisticNames = [...new Set(deltas.map((entry) => entry.StatisticName))];
  const currentStats = await getPlayerStatistics(playFabId, statisticNames);
  if (currentStats == null) return false;

  const nextStats = deltas.map((entry) => ({
    StatisticName: entry.StatisticName,
    Value: Number(currentStats[entry.StatisticName] || 0) + Number(entry.Value || 0)
  }));

  return updatePlayerStatistics(playFabId, nextStats);
};

// Record match result - update wins/losses for both players
const recordMatchResult = async (winnerPlayFabId, loserPlayFabId, isDraw = false) => {
  if (isDraw) {
    // Both players get a draw
    const [winnerOk, loserOk] = await Promise.all([
      incrementPlayerStatistics(winnerPlayFabId, [{ StatisticName: 'Draws', Value: 1 }]),
      incrementPlayerStatistics(loserPlayFabId, [{ StatisticName: 'Draws', Value: 1 }])
    ]);
    if (!winnerOk || !loserOk) {
      console.error('[PlayFab] Failed to record draw for', winnerPlayFabId, loserPlayFabId);
      return false;
    }
    console.log('[PlayFab] Draw recorded for', winnerPlayFabId, loserPlayFabId);
  } else {
    // Winner gets a win, loser gets a loss
    const [winnerOk, loserOk] = await Promise.all([
      incrementPlayerStatistics(winnerPlayFabId, [{ StatisticName: 'Wins', Value: 1 }]),
      incrementPlayerStatistics(loserPlayFabId, [{ StatisticName: 'Losses', Value: 1 }])
    ]);
    if (!winnerOk || !loserOk) {
      console.error('[PlayFab] Failed to record win/loss for', winnerPlayFabId, loserPlayFabId);
      return false;
    }
    console.log('[PlayFab] Win recorded for', winnerPlayFabId, ', loss for', loserPlayFabId);
  }
  return true;
};

const recordFfa3Result = async (match, winnerKey) => {
  if (!match) return;
  const p1Id = match.p1 && match.p1.playFabId ? match.p1.playFabId : null;
  const p2Id = match.p2 && match.p2.playFabId ? match.p2.playFabId : null;
  const p3Id = match.p3 && match.p3.playFabId ? match.p3.playFabId : null;
  const playerIds = [p1Id, p2Id, p3Id].filter(Boolean);
  if (playerIds.length === 0) return;

  if (winnerKey === 'draw') {
    const results = await Promise.all(playerIds.map((id) => incrementPlayerStatistics(id, [{ StatisticName: 'Draws', Value: 1 }])));
    if (results.some((ok) => !ok)) {
      console.error('[PlayFab] Failed to record FFA3 draw for', playerIds.join(', '));
      return false;
    }
    console.log('[PlayFab] FFA3 draw recorded for', playerIds.join(', '));
    return true;
  }

  const winnerId = winnerKey === 'player1' ? p1Id : (winnerKey === 'player2' ? p2Id : p3Id);
  const loserIds = playerIds.filter((id) => id && id !== winnerId);
  if (!winnerId) return false;

  const winnerOk = await incrementPlayerStatistics(winnerId, [{ StatisticName: 'Wins', Value: 1 }]);
  const loserResults = await Promise.all(loserIds.map((id) => incrementPlayerStatistics(id, [{ StatisticName: 'Losses', Value: 1 }])));
  if (!winnerOk || loserResults.some((ok) => !ok)) {
    console.error('[PlayFab] Failed to record FFA3 result for', winnerId, loserIds.join(', '));
    return false;
  }
  console.log('[PlayFab] FFA3 win recorded for', winnerId, ', losses for', loserIds.join(', '));
  return true;
};

const getClassicMatchDepartureResult = (match, departingSocketId) => {
  if (!match || match.gameMode !== 'classic' || !match.p1 || !match.p2) return null;

  if (match.p1.id === departingSocketId) {
    return {
      winnerPlayFabId: match.p2.playFabId,
      loserPlayFabId: match.p1.playFabId
    };
  }

  if (match.p2.id === departingSocketId) {
    return {
      winnerPlayFabId: match.p1.playFabId,
      loserPlayFabId: match.p2.playFabId
    };
  }

  return null;
};

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS
  || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173,https://brimstonevalley.fly.dev')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Socket.IO CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST']
  },
  pingInterval: 25000,
  pingTimeout: 60000
}); // WebSockets for real-time

const bettingModeManager = createBettingModeManager(io);

const isDraftableHero = (hero) => hero && hero.draftable !== false;
const DRAFTABLE_HEROES = HEROES.filter(isDraftableHero);
const CLASSIC_DRAFT_POOL_SIZE = 30;
const FFA3_DRAFT_POOL_SIZE = 26;
const LEAGUE4_TEAM_SIZE_MAIN = 5;
const LEAGUE4_TEAM_SIZE_RESERVE = 2;
const LEAGUE4_DRAFT_POOL_SIZE = 12;
const LEAGUE4_DRAFT_TIMER_MS = 120000;
const LEAGUE4_SWAP_TIMER_MS = 120000;
const LEAGUE4_SHOP_TURN_TIMER_MS = 30000;
const LEAGUE4_CHESS_TIME_MS = 4 * 60 * 1000;
const LEAGUE4_TOTAL_ROUNDS = 6;
const LEAGUE4_SHOP_SIZE = 5;
const LEAGUE4_WIN_COINS = 10;
const LEAGUE4_LOSS_COINS = 7;
const LEAGUE4_DRAW_COINS = 8;
const LEAGUE4_LOSS_STREAK_BONUS = [0, 0, 1, 2, 3];
const LEAGUE4_AUGMENT_COST_BY_TIER = {
  common: 5,
  uncommon: 7,
  rare: 9,
  epic: 12,
  legendary: 15
};

const LEAGUE4_SCHEDULE = [
  [['player1', 'player2'], ['player3', 'player4']],
  [['player1', 'player3'], ['player2', 'player4']],
  [['player1', 'player4'], ['player2', 'player3']],
  [['player1', 'player2'], ['player3', 'player4']],
  [['player1', 'player3'], ['player2', 'player4']],
  [['player1', 'player4'], ['player2', 'player3']]
];

// Sample n heroes from source array (Fisher-Yates shuffle)
const sampleHeroes = (source, n) => {
  const pool = Array.isArray(source) ? source.filter(isDraftableHero) : [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Math.min(n, shuffled.length)));
};

const cloneForWire = (value) => {
  const seen = new WeakMap();
  const stack = new WeakSet();

  const clone = (val) => {
    if (val === null || typeof val !== 'object') return val;
    if (stack.has(val)) return null; // break cycles only
    if (seen.has(val)) return seen.get(val);

    const out = Array.isArray(val) ? [] : {};
    seen.set(val, out);
    stack.add(val);
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i += 1) {
        out[i] = clone(val[i]);
      }
    } else {
      Object.keys(val).forEach((key) => {
        out[key] = clone(val[key]);
      });
    }
    stack.delete(val);
    return out;
  };

  return clone(value);
};

const leaguePhaseTimers = new Map();
const leaguePairSessions = new Map();

const playerKeyToSide = (playerKey) => (
  playerKey === 'player1' ? 'p1'
    : playerKey === 'player2' ? 'p2'
      : playerKey === 'player3' ? 'p3'
        : 'p4'
);

const sideToPlayerKey4 = (side) => (
  side === 'p1' ? 'player1'
    : side === 'p2' ? 'player2'
      : side === 'p3' ? 'player3'
        : 'player4'
);

const clearLeaguePhaseTimer = (matchId) => {
  if (!leaguePhaseTimers.has(matchId)) return;
  const timer = leaguePhaseTimers.get(matchId);
  if (timer) clearTimeout(timer);
  leaguePhaseTimers.delete(matchId);
};

const getLeaguePairKey = (a, b) => [a, b].sort().join('_vs_');

const getCurrentLeaguePairings = (league4State) => {
  if (!league4State) return [];
  const schedule = Array.isArray(league4State.roundSchedule) ? league4State.roundSchedule : LEAGUE4_SCHEDULE;
  const idx = Math.max(0, Math.min(schedule.length - 1, Number(league4State.currentRound || 1) - 1));
  const pairs = Array.isArray(schedule[idx]) ? schedule[idx] : [];
  return pairs.filter((p) => Array.isArray(p) && p.length === 2);
};

const cloneHeroForLeagueTeam = (hero) => {
  const h = deepClone(hero);
  h.currentHealth = Number(h.health || 0);
  h.currentEnergy = Number(h.energy || 0);
  h.currentArmor = Number(h.armor || 0);
  h.currentSpeed = Number(h.speed || 0);
  h.currentSpellPower = Number(h.spellPower || 0);
  return h;
};

const buildLeagueTeam = () => {
  const main = makeEmptyMain('player1');
  const reserve = makeReserve('player1');
  const teamSample = sampleHeroes(DRAFTABLE_HEROES, LEAGUE4_TEAM_SIZE_MAIN + LEAGUE4_TEAM_SIZE_RESERVE);
  for (let i = 0; i < LEAGUE4_TEAM_SIZE_MAIN; i += 1) {
    const hero = teamSample[i];
    if (!hero) continue;
    main[i] = {
      ...main[i],
      hero: cloneHeroForLeagueTeam(hero),
      currentHealth: Number(hero.health || 0),
      currentEnergy: Number(hero.energy || 0),
      currentArmor: Number(hero.armor || 0),
      currentSpeed: Number(hero.speed || 0),
      currentSpellPower: Number(hero.spellPower || 0)
    };
  }
  for (let i = 0; i < LEAGUE4_TEAM_SIZE_RESERVE; i += 1) {
    const hero = teamSample[LEAGUE4_TEAM_SIZE_MAIN + i];
    if (!hero) continue;
    reserve[i] = {
      ...reserve[i],
      hero: cloneHeroForLeagueTeam(hero),
      currentHealth: Number(hero.health || 0),
      currentEnergy: Number(hero.energy || 0),
      currentArmor: Number(hero.armor || 0),
      currentSpeed: Number(hero.speed || 0),
      currentSpellPower: Number(hero.spellPower || 0)
    };
  }
  return { main, reserve };
};

const makeEmptyLeagueTeam = () => ({
  main: makeEmptyMain('player1'),
  reserve: makeReserve('player1')
});

const fillLeagueTeamFromDraft = (team, draftPool, placements) => {
  if (!team || !Array.isArray(team.main) || !Array.isArray(team.reserve)) return false;
  const pool = Array.isArray(draftPool) ? draftPool : [];
  const byId = new Map(pool.map((h) => [String(h?.id || ''), h]).filter(([id]) => !!id));
  const list = Array.isArray(placements) ? placements : [];
  if (list.length !== (LEAGUE4_TEAM_SIZE_MAIN + LEAGUE4_TEAM_SIZE_RESERVE)) return false;

  const seenHero = new Set();
  const usedMain = new Set();
  const usedReserve = new Set();

  const nextMain = makeEmptyMain('player1');
  const nextReserve = makeReserve('player1');

  for (const raw of list) {
    if (!raw) return false;
    const heroId = String(raw.heroId || '');
    const hero = byId.get(heroId);
    if (!hero || seenHero.has(heroId)) return false;
    const slotType = raw.slotType === 'reserve' ? 'reserve' : 'main';
    const slotIndex = Number(raw.slotIndex);
    if (!Number.isInteger(slotIndex)) return false;

    const tile = {
      ...(slotType === 'reserve' ? nextReserve[slotIndex] : nextMain[slotIndex]),
      hero: cloneHeroForLeagueTeam(hero),
      currentHealth: Number(hero.health || 0),
      currentEnergy: Number(hero.energy || 0),
      currentArmor: Number(hero.armor || 0),
      currentSpeed: Number(hero.speed || 0),
      currentSpellPower: Number(hero.spellPower || 0)
    };

    if (slotType === 'main') {
      if (slotIndex < 0 || slotIndex >= nextMain.length || usedMain.has(slotIndex)) return false;
      nextMain[slotIndex] = tile;
      usedMain.add(slotIndex);
    } else {
      if (slotIndex < 0 || slotIndex >= LEAGUE4_TEAM_SIZE_RESERVE || usedReserve.has(slotIndex)) return false;
      nextReserve[slotIndex] = tile;
      usedReserve.add(slotIndex);
    }

    seenHero.add(heroId);
  }

  if (usedMain.size !== LEAGUE4_TEAM_SIZE_MAIN || usedReserve.size !== LEAGUE4_TEAM_SIZE_RESERVE) return false;

  team.main = nextMain;
  team.reserve = nextReserve;
  return true;
};

const cloneLeagueTeamForBattle = (team, playerKey) => {
  const main = makeEmptyMain(playerKey);
  const reserve = makeReserve(playerKey);
  (team.main || []).forEach((tile, index) => {
    if (!tile || !tile.hero) return;
    const hero = cloneHeroForLeagueTeam(tile.hero);
    main[index] = {
      ...main[index],
      hero,
      currentHealth: Number(hero.health || 0),
      currentEnergy: Number(hero.energy || 0),
      currentArmor: Number(hero.armor || 0),
      currentSpeed: Number(hero.speed || 0),
      currentSpellPower: Number(hero.spellPower || 0)
    };
  });
  (team.reserve || []).forEach((tile, index) => {
    if (!tile || !tile.hero) return;
    const hero = cloneHeroForLeagueTeam(tile.hero);
    reserve[index] = {
      ...reserve[index],
      hero,
      currentHealth: Number(hero.health || 0),
      currentEnergy: Number(hero.energy || 0),
      currentArmor: Number(hero.armor || 0),
      currentSpeed: Number(hero.speed || 0),
      currentSpellPower: Number(hero.spellPower || 0)
    };
  });
  return { main, reserve };
};

const getLeagueAugmentCost = (augment) => {
  const tier = String(augment?.tier || 'common').toLowerCase();
  return Number(LEAGUE4_AUGMENT_COST_BY_TIER[tier] || LEAGUE4_AUGMENT_COST_BY_TIER.common);
};

const getLeagueLossStreakBonus = (streak) => {
  const idx = Math.max(0, Math.min(LEAGUE4_LOSS_STREAK_BONUS.length - 1, Number(streak || 0)));
  return Number(LEAGUE4_LOSS_STREAK_BONUS[idx] || 0);
};

const ensureLeagueEconomyState = (league4State) => {
  const keys = ['player1', 'player2', 'player3', 'player4'];
  league4State.economy = league4State.economy || {};
  keys.forEach((playerKey) => {
    if (!league4State.economy[playerKey]) {
      league4State.economy[playerKey] = {
        coins: 0,
        lossStreak: 0,
        totalEarned: 0,
        totalSpent: 0
      };
    }
  });
  return league4State.economy;
};

const getLeagueShopTurnOrder = (league4State, match) => {
  const standingsRows = getLeague4SortedStandings(league4State, match);
  const standingsByKey = new Map(standingsRows.map((row) => [row.playerKey, row]));
  const economy = ensureLeagueEconomyState(league4State);
  const players = ['player1', 'player2', 'player3', 'player4'];

  return [...players].sort((a, b) => {
    const sa = standingsByKey.get(a) || { losses: 0, points: 0, tiebreakPower: 0 };
    const sb = standingsByKey.get(b) || { losses: 0, points: 0, tiebreakPower: 0 };
    const streakA = Number(economy[a]?.lossStreak || 0);
    const streakB = Number(economy[b]?.lossStreak || 0);

    if (Number(sb.losses || 0) !== Number(sa.losses || 0)) return Number(sb.losses || 0) - Number(sa.losses || 0);
    if (streakB !== streakA) return streakB - streakA;
    if (Number(sa.points || 0) !== Number(sb.points || 0)) return Number(sa.points || 0) - Number(sb.points || 0);
    if (Number(sa.tiebreakPower || 0) !== Number(sb.tiebreakPower || 0)) return Number(sa.tiebreakPower || 0) - Number(sb.tiebreakPower || 0);
    return String(a).localeCompare(String(b));
  });
};

const toWireLeagueOffer = (offer) => {
  if (!offer) return null;
  return {
    id: offer.id,
    name: offer.name,
    tier: offer.tier,
    type: offer.type,
    description: offer.description,
    rolledValue: offer.rolledValue ?? null,
    cost: getLeagueAugmentCost(offer)
  };
};

const findLeagueDefaultTarget = (team) => {
  const main = team?.main || [];
  const reserve = team?.reserve || [];
  const mainIndex = main.findIndex((t) => t && t.hero);
  if (mainIndex >= 0) return { slotType: 'main', slotIndex: mainIndex, tile: main[mainIndex] };
  const reserveIndex = reserve.findIndex((t) => t && t.hero);
  if (reserveIndex >= 0) return { slotType: 'reserve', slotIndex: reserveIndex, tile: reserve[reserveIndex] };
  return null;
};

const buildLeagueShopOffers = (level) => {
  const safeLevel = Math.max(1, Number(level || 1));
  let offers = getRandomAugments(safeLevel, LEAGUE4_SHOP_SIZE);
  if (Array.isArray(offers) && offers.length > 0) return offers;

  offers = getRandomAugments(1, LEAGUE4_SHOP_SIZE);
  if (Array.isArray(offers) && offers.length > 0) return offers;

  // Last-resort fallback includes boss-exclusive augments so shop phase can always proceed.
  offers = getRandomAugments(safeLevel, LEAGUE4_SHOP_SIZE, [], { includeBossExclusive: true });
  return Array.isArray(offers) ? offers : [];
};

const applyLeaguePurchasedAugment = (league4State, playerKey, submission, picked) => {
  if (!picked) return false;

  const team = league4State.teams?.[playerKey];
  if (!team) return false;

  const slotType = submission?.slotType === 'reserve' ? 'reserve' : 'main';
  const slotList = slotType === 'reserve' ? (team.reserve || []) : (team.main || []);
  const slotIndex = Number(submission?.slotIndex);
  let tile = Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < slotList.length
    ? slotList[slotIndex]
    : null;

  if (!tile || !tile.hero) {
    const fallback = findLeagueDefaultTarget(team);
    tile = fallback?.tile || null;
  }
  if (!tile || !tile.hero) return false;

  applyAugmentsToHero(tile.hero, [picked]);
  tile.hero._towerAugments = Array.isArray(tile.hero._towerAugments) ? tile.hero._towerAugments : [];
  tile.hero._towerAugments.push({
    id: picked.id,
    name: picked.name,
    tier: picked.tier,
    description: picked.description,
    rolledValue: picked.rolledValue ?? null
  });
  return true;
};

const makeLeague4State = () => {
  const teams = {
    player1: makeEmptyLeagueTeam(),
    player2: makeEmptyLeagueTeam(),
    player3: makeEmptyLeagueTeam(),
    player4: makeEmptyLeagueTeam()
  };
  const draftPools = {
    player1: sampleHeroes(DRAFTABLE_HEROES, LEAGUE4_DRAFT_POOL_SIZE),
    player2: sampleHeroes(DRAFTABLE_HEROES, LEAGUE4_DRAFT_POOL_SIZE),
    player3: sampleHeroes(DRAFTABLE_HEROES, LEAGUE4_DRAFT_POOL_SIZE),
    player4: sampleHeroes(DRAFTABLE_HEROES, LEAGUE4_DRAFT_POOL_SIZE)
  };
  return {
    phase: 'league_draft',
    gameMode: 'league4',
    league4: {
      totalRounds: LEAGUE4_TOTAL_ROUNDS,
      currentRound: 1,
      roundSchedule: LEAGUE4_SCHEDULE,
      standings: {
        player1: { points: 0, wins: 0, losses: 0, draws: 0 },
        player2: { points: 0, wins: 0, losses: 0, draws: 0 },
        player3: { points: 0, wins: 0, losses: 0, draws: 0 },
        player4: { points: 0, wins: 0, losses: 0, draws: 0 }
      },
      teams,
      decision: {
        type: 'draft',
        deadlineTs: 0,
        submissions: {}
      },
      draftPools,
      pendingMatchReports: {},
      augmentOffers: {},
      economy: {
        player1: { coins: 0, lossStreak: 0, totalEarned: 0, totalSpent: 0 },
        player2: { coins: 0, lossStreak: 0, totalEarned: 0, totalSpent: 0 },
        player3: { coins: 0, lossStreak: 0, totalEarned: 0, totalSpent: 0 },
        player4: { coins: 0, lossStreak: 0, totalEarned: 0, totalSpent: 0 }
      },
      shopState: {
        offers: [],
        turnOrder: [],
        turnIndex: 0,
        purchases: [],
        passes: {},
        completedTurnOrder: []
      },
      latestCoinRewards: {},
      latestRoundResults: [],
      roundHistory: [],
      matchHighlights: [],
      summary: null,
      stateVersion: 1,
      processing: false,
      completed: false,
      winner: null
    }
  };
};

const getLeague4SortedStandings = (league4State, match) => {
  const keys = ['player1', 'player2', 'player3', 'player4'];
  const pointsByPlayer = league4State.standings || {};
  const getDiff = (playerKey) => {
    const team = league4State.teams?.[playerKey];
    if (!team || !Array.isArray(team.main)) return 0;
    return team.main.reduce((sum, tile) => {
      if (!tile || !tile.hero) return sum;
      return sum + Number(tile.hero.health || 0) + Number(tile.hero.armor || 0);
    }, 0);
  };
  return keys.map((playerKey) => {
    const slot = playerKeyToSide(playerKey);
    const playerRec = match && match[slot] ? match[slot] : null;
    const rec = pointsByPlayer[playerKey] || { points: 0, wins: 0, losses: 0, draws: 0 };
    return {
      playerKey,
      username: playerRec?.username || slot.toUpperCase(),
      bot: !!(playerRec && playerRec.bot),
      points: Number(rec.points || 0),
      wins: Number(rec.wins || 0),
      losses: Number(rec.losses || 0),
      draws: Number(rec.draws || 0),
      tiebreakPower: getDiff(playerKey)
    };
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.tiebreakPower - a.tiebreakPower;
  });
};

const emitLeague4State = (matchId) => {
  if (!matchStates.has(matchId)) return;
  const state = matchStates.get(matchId);
  const match = activeMatches.get(matchId);
  if (!state || state.gameMode !== 'league4' || !state.league4) return;
  const standings = getLeague4SortedStandings(state.league4, match);
  const wireShopOffers = Array.isArray(state.league4?.shopState?.offers)
    ? state.league4.shopState.offers.map(toWireLeagueOffer).filter(Boolean)
    : [];
  const payload = {
    serverNowTs: Date.now(),
    gameMode: 'league4',
    phase: state.phase,
    league4: {
      ...state.league4,
      shopState: {
        ...(state.league4.shopState || {}),
        offers: wireShopOffers
      },
      standingsSorted: standings
    }
  };
  io.to(matchId).emit('gameState', cloneForWire(payload));
};

const scoreLeagueHeroForMvp = (hero) => {
  if (!hero) return -Infinity;
  const hp = Number(hero.health || 0);
  const armor = Number(hero.armor || 0);
  const speed = Number(hero.speed || 0);
  const energy = Number(hero.energy || 0);
  const spellPower = Number(hero.spellPower || 0);
  const augmentCount = Array.isArray(hero._towerAugments) ? hero._towerAugments.length : 0;
  return hp + armor * 1.5 + speed * 2 + energy + spellPower * 2 + augmentCount * 4;
};

const pickLeagueMvpHero = (league4State, winnerKey) => {
  if (!winnerKey) return null;
  const team = league4State?.teams?.[winnerKey];
  if (!team) return null;
  const candidates = [];

  (team.main || []).forEach((tile, index) => {
    if (!tile || !tile.hero) return;
    candidates.push({ slotType: 'main', slotIndex: index, hero: tile.hero, score: scoreLeagueHeroForMvp(tile.hero) });
  });
  (team.reserve || []).forEach((tile, index) => {
    if (!tile || !tile.hero) return;
    candidates.push({ slotType: 'reserve', slotIndex: index, hero: tile.hero, score: scoreLeagueHeroForMvp(tile.hero) });
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return {
    heroId: top.hero.id || null,
    heroName: top.hero.name || 'Unknown Hero',
    slotType: top.slotType,
    slotIndex: top.slotIndex,
    augmentCount: Array.isArray(top.hero._towerAugments) ? top.hero._towerAugments.length : 0,
    score: Math.round(top.score)
  };
};

const applyLeagueSwapDecision = (team, submission) => {
  if (!team || !Array.isArray(team.main)) return;
  if (!submission || submission.type === 'noop') return;
  if (submission.type === 'placements' && Array.isArray(submission.placements)) {
    const list = submission.placements;
    if (list.length !== (LEAGUE4_TEAM_SIZE_MAIN + LEAGUE4_TEAM_SIZE_RESERVE)) return;

    const allHeroes = [...(team.main || []), ...(team.reserve || [])]
      .filter((tile) => tile && tile.hero)
      .map((tile) => tile.hero);
    const byId = new Map(allHeroes.map((hero) => [String(hero?.id || ''), hero]).filter(([id]) => !!id));

    const nextMain = (team.main || []).map((tile) => ({ ...(tile || {}) }));
    const nextReserve = (team.reserve || []).map((tile) => ({ ...(tile || {}) }));
    nextMain.forEach((tile) => {
      if (!tile) return;
      tile.hero = null;
    });
    nextReserve.forEach((tile) => {
      if (!tile) return;
      tile.hero = null;
    });

    const seenHero = new Set();
    const usedMain = new Set();
    const usedReserve = new Set();

    for (const entry of list) {
      if (!entry) return;
      const heroId = String(entry.heroId || '');
      const hero = byId.get(heroId);
      if (!hero || seenHero.has(heroId)) return;
      const slotType = entry.slotType === 'reserve' ? 'reserve' : 'main';
      const slotIndex = Number(entry.slotIndex);
      if (!Number.isInteger(slotIndex)) return;

      if (slotType === 'main') {
        if (slotIndex < 0 || slotIndex >= nextMain.length || usedMain.has(slotIndex)) return;
        nextMain[slotIndex] = {
          ...(nextMain[slotIndex] || {}),
          hero: cloneHeroForLeagueTeam(hero)
        };
        usedMain.add(slotIndex);
      } else {
        if (slotIndex < 0 || slotIndex >= LEAGUE4_TEAM_SIZE_RESERVE || usedReserve.has(slotIndex)) return;
        nextReserve[slotIndex] = {
          ...(nextReserve[slotIndex] || {}),
          hero: cloneHeroForLeagueTeam(hero)
        };
        usedReserve.add(slotIndex);
      }
      seenHero.add(heroId);
    }

    if (usedMain.size !== LEAGUE4_TEAM_SIZE_MAIN || usedReserve.size !== LEAGUE4_TEAM_SIZE_RESERVE) return;
    team.main = nextMain;
    team.reserve = nextReserve;
    return;
  }
  if (submission.type === 'arrange' && Array.isArray(submission.mainOrder)) {
    const len = team.main.length;
    const order = submission.mainOrder.map((n) => Number(n));
    if (order.length !== len) return;
    const seen = new Set(order);
    if (seen.size !== len) return;
    if (order.some((n) => !Number.isInteger(n) || n < 0 || n >= len)) return;
    const nextMain = order.map((fromIndex) => team.main[fromIndex]);
    team.main = nextMain;
    return;
  }
  const source = Number(submission.sourceIndex);
  const target = Number(submission.targetIndex);
  if (!Number.isInteger(source) || !Number.isInteger(target)) return;
  if (source < 0 || source >= team.main.length) return;
  if (target < 0 || target >= team.main.length) return;
  if (source === target) return;
  const a = team.main[source];
  const b = team.main[target];
  team.main[source] = b;
  team.main[target] = a;
};

const pickLeagueAffordableAutoChoice = (offers, coins) => {
  const list = Array.isArray(offers) ? offers : [];
  if (list.length === 0) return null;
  const affordable = list.filter((offer) => Number(coins || 0) >= getLeagueAugmentCost(offer));
  if (affordable.length === 0) return null;
  const tierRank = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  return [...affordable].sort((a, b) => {
    const ta = tierRank[String(a?.tier || '').toLowerCase()] || 0;
    const tb = tierRank[String(b?.tier || '').toLowerCase()] || 0;
    if (tb !== ta) return tb - ta;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  })[0] || affordable[0];
};

const resolveLeagueHeadToHead = async (teamA, teamB, playerA, playerB) => {
  let { main: p1Main, reserve: p1Reserve } = cloneLeagueTeamForBattle(teamA, playerA);
  let { main: p2Main, reserve: p2Reserve } = cloneLeagueTeamForBattle(teamB, playerB);
  let priorityPlayer = Math.random() < 0.5 ? 'player1' : 'player2';
  let winner = null;
  const maxRounds = 20;
  let roundsPlayed = 0;

  for (let round = 1; round <= maxRounds; round += 1) {
    roundsPlayed = round;
    const result = await executeRound(
      {
        p1Board: p1Main,
        p2Board: p2Main,
        p1Reserve,
        p2Reserve,
        priorityPlayer,
        roundNumber: round,
        gameMode: 'classic'
      },
      {
        castDelayMs: 0,
        postEffectDelayMs: 0,
        reactionDelayMs: 0,
        postCastDelayMs: 0,
        quiet: true,
        speedMultiplier: 30
      }
    );
    p1Main = result.p1Board;
    p2Main = result.p2Board;
    p1Reserve = result.p1Reserve;
    p2Reserve = result.p2Reserve;
    priorityPlayer = result.priorityPlayer || priorityPlayer;
    if (result.winner) {
      winner = result.winner;
      break;
    }
  }

  const remainingHealth = (board) => (board || []).reduce((sum, tile) => {
    if (!tile || !tile.hero || tile._dead) return sum;
    const hp = tile.currentHealth != null ? Number(tile.currentHealth) : Number(tile.hero.health || 0);
    return sum + Math.max(0, hp);
  }, 0);

  const hpA = remainingHealth(p1Main);
  const hpB = remainingHealth(p2Main);

  let leagueWinner = 'draw';
  let resolution = 'draw';
  if (winner === 'player1') leagueWinner = playerA;
  else if (winner === 'player2') leagueWinner = playerB;
  else if (hpA > hpB) {
    leagueWinner = playerA;
    resolution = 'health_tiebreak';
  } else if (hpB > hpA) {
    leagueWinner = playerB;
    resolution = 'health_tiebreak';
  }

  if (winner === 'player1' || winner === 'player2') {
    resolution = 'knockout';
  }

  const hpDiff = Math.abs(hpA - hpB);

  return {
    a: playerA,
    b: playerB,
    winner: leagueWinner,
    roundsPlayed,
    resolution,
    scoreLine: `${hpA}-${hpB}`,
    hpDiff,
    remainingHealth: {
      [playerA]: hpA,
      [playerB]: hpB
    }
  };
};

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Basic game state (in-memory for now; use DB later)
// This is only used for non-match games (local testing, single player spectate, etc.)
let gameState = {
  // Placeholder initial state - we'll expand this
  p1Main: makeEmptyMain('player1'),
  p1Reserve: makeReserve('player1'),
  p2Main: makeEmptyMain('player2'),
  p2Reserve: makeReserve('player2'),
  availableHeroes: sampleHeroes(DRAFTABLE_HEROES, CLASSIC_DRAFT_POOL_SIZE),
  bans: [],
  step: 0,
  roundNumber: 0,
  phase: 'draft', // or 'battle'
  gameMode: 'classic'
};

// Global step queue for non-match games only
let stepQueue = [];
let stepIndex = 0;
let awaitingAck = false;
let stepTimeout = null;
let isRunningRound = false;
let pendingMovementStart = null;

// Matchmaking
const matchQueues = {
  classic: [],
  ffa3: [],
  league4: []
};
const activeMatches = new Map();
const matchStates = new Map();
const normalizeGameMode = (mode) => {
  if (mode === 'ffa3') return 'ffa3';
  if (mode === 'league4') return 'league4';
  return 'classic';
};
const getMatchQueue = (mode) => (matchQueues[mode] || matchQueues.classic);
const removeFromQueues = (socketId) => {
  Object.values(matchQueues).forEach((queue) => {
    let idx = queue.indexOf(socketId);
    while (idx >= 0) {
      queue.splice(idx, 1);
      idx = queue.indexOf(socketId);
    }
  });
};

const getSocketPlayFabId = (socket) => String(socket?.data?.playfab?.playFabId || '');

const clearStaleMatchForSocket = (socket, reason = 'stale-match-reference') => {
  if (!socket?.data?.matchId) return false;
  const staleMatchId = socket.data.matchId;
  const hasLiveMatch = activeMatches.has(staleMatchId) || matchStates.has(staleMatchId);
  if (hasLiveMatch) return false;
  console.warn('[Matchmaking] Clearing stale matchId', {
    socketId: socket.id,
    playFabId: getSocketPlayFabId(socket) || 'unknown',
    matchId: staleMatchId,
    reason
  });
  try {
    socket.leave(staleMatchId);
  } catch (e) {}
  socket.data.matchId = null;
  return true;
};

const removeQueuedSocketsForPlayFabId = (playFabId, keepSocketId = null) => {
  const normalizedId = String(playFabId || '');
  if (!normalizedId) return false;
  let changed = false;
  Object.values(matchQueues).forEach((queue) => {
    for (let idx = queue.length - 1; idx >= 0; idx -= 1) {
      const queuedSocketId = queue[idx];
      if (keepSocketId && queuedSocketId === keepSocketId) continue;
      const queuedSocket = io.sockets.sockets.get(queuedSocketId);
      if (!queuedSocket) {
        queue.splice(idx, 1);
        changed = true;
        continue;
      }
      clearStaleMatchForSocket(queuedSocket, 'queue-scan');
      if (getSocketPlayFabId(queuedSocket) !== normalizedId) continue;
      queue.splice(idx, 1);
      queuedSocket.data.queueMode = null;
      changed = true;
    }
  });
  return changed;
};


// Per-match step queues and execution state
// Key: matchId, Value: { stepQueue, stepIndex, awaitingAck, stepTimeout, isRunningRound, pendingMovementStart }
const matchExecutionState = new Map();

const getMatchExecState = (matchId) => {
  if (!matchExecutionState.has(matchId)) {
    matchExecutionState.set(matchId, {
      stepQueue: [],
      stepIndex: 0,
      awaitingAck: false,
      stepTimeout: null,
      isRunningRound: false,
      pendingMovementStart: null,
      resultRecorded: false  // Prevent double-recording on disconnect after game end
    });
  }
  return matchExecutionState.get(matchId);
};

const clearMatchStepTimeout = (matchId) => {
  if (matchId) {
    const execState = getMatchExecState(matchId);
    if (execState.stepTimeout) {
      clearTimeout(execState.stepTimeout);
      execState.stepTimeout = null;
    }
  } else {
    // Global (non-match)
    if (stepTimeout) {
      clearTimeout(stepTimeout);
      stepTimeout = null;
    }
  }
};

// Legacy global clear for non-match games
const clearStepTimeout = () => {
  clearMatchStepTimeout(null);
};

const estimateStepVisualMs = (step) => {
  const type = String(step?.type || '').toLowerCase();
  if (type === 'movementstart' || type === 'movementswap' || type === 'movementcomplete') return 180;
  if (type === 'precast' || type === 'effectprecast') return 420;
  if (type === 'cast' || type === 'castapplied' || type === 'effectapplied') return 300;
  if (type === 'postcastwait') return Math.max(80, Number(step?.duration || 180));
  if (type === 'energyapplied' || type === 'energyincrement' || type === 'posteffectdelay') return 160;
  if (type === 'onroundstarttriggered') return 220;
  if (type === 'roundcomplete' || type === 'gameend') return 800;
  return 120;
};

const withTimelineMeta = (step) => {
  if (!step || typeof step !== 'object') return step;
  return {
    ...step,
    timeline: {
      emittedAt: Date.now(),
      expectedMs: estimateStepVisualMs(step)
    }
  };
};

const isSideAlive = (boardArr) => (boardArr || []).some(t => {
  if (!t || !t.hero) return false;
  if (t._dead) return false;
  if (typeof t.currentHealth === 'number' && t.currentHealth <= 0) return false;
  return true;
});

const getAliveSides = (state) => {
  if (!state) return [];
  const alive = [];
  if (isSideAlive(state.p1Main)) alive.push('p1');
  if (isSideAlive(state.p2Main)) alive.push('p2');
  if (state.gameMode === 'ffa3' && isSideAlive(state.p3Main)) alive.push('p3');
  return alive;
};

const getActiveOrder = (state) => {
  const alive = getAliveSides(state);
  const order = ['p1', 'p2', 'p3'];
  return order.filter(side => alive.includes(side));
};

const normalizePrioritySide = (prio) => (
  (prio === 'player1' || prio === 'p1') ? 'p1' : (prio === 'player2' || prio === 'p2') ? 'p2' : 'p3'
);

const sideToPlayerKey = (side) => (side === 'p1' ? 'player1' : (side === 'p2' ? 'player2' : 'player3'));

const markHeroMovedThisPhase = (tile) => {
  try {
    if (tile && tile.hero) tile.hero._movedThisMovementPhase = true;
  } catch (e) {}
};

const getNextPriorityPlayer = (state) => {
  const active = getActiveOrder(state);
  if (active.length === 0) return 'player1';
  const curSide = normalizePrioritySide(state.priorityPlayer);
  const idx = active.indexOf(curSide);
  const nextSide = active[(idx >= 0 ? (idx + 1) % active.length : 0)];
  return sideToPlayerKey(nextSide);
};

const startMovementPhase = (state, matchId = null) => {
  const prio = state.priorityPlayer || 'player1';
  let prioShort = normalizePrioritySide(prio);
  let sequence;
  if (state.gameMode === 'ffa3') {
    const order = getActiveOrder(state);
    if (order.length <= 1) {
      state.movementPhase = null;
      state.phase = 'ready';
      if (matchId) {
        matchStates.set(matchId, state);
        io.to(matchId).emit('gameState', cloneForWire(state));
      } else {
        gameState = state;
        io.emit('gameState', cloneForWire(gameState));
      }
      return;
    }
    if (!order.includes(prioShort)) {
      prioShort = order[0];
      state.priorityPlayer = sideToPlayerKey(prioShort);
    }
    const prioIdx = order.indexOf(prioShort);
    const forward = prioIdx >= 0
      ? [...order.slice(prioIdx), ...order.slice(0, prioIdx)]
      : order;
    const backward = [...forward].reverse();
    sequence = [...forward, ...backward];
  } else {
    sequence = prioShort === 'p1' ? ['p1', 'p2', 'p2', 'p1'] : ['p2', 'p1', 'p1', 'p2'];
  }
  state.movementPhase = { sequence, index: 0 };
  state.phase = 'movement';
  console.log('[Server] Starting movement phase. matchId:', matchId, 'priorityPlayer:', state.priorityPlayer, 'prioShort:', prioShort, 'sequence:', sequence);
  if (matchId) {
    matchStates.set(matchId, state);
    io.to(matchId).emit('gameState', cloneForWire(state));
  } else {
    gameState = state;
    io.emit('gameState', cloneForWire(gameState));
  }
};

const startMatchStepTimeout = (matchId) => {
  if (matchId) {
    const execState = getMatchExecState(matchId);
    clearMatchStepTimeout(matchId);
    execState.stepTimeout = setTimeout(() => {
      // Fallback: advance if client doesn't ack in time
      execState.awaitingAck = false;
      execState.stepIndex += 1;
      sendNextStepForMatch(matchId);
    }, 8000);
  } else {
    // Global (non-match)
    clearStepTimeout();
    stepTimeout = setTimeout(() => {
      awaitingAck = false;
      stepIndex += 1;
      sendNextStep();
    }, 8000);
  }
};

// Legacy global for non-match games
const startStepTimeout = () => {
  startMatchStepTimeout(null);
};

const sendNextStepForMatch = (matchId) => {
  const execState = getMatchExecState(matchId);
  const state = matchStates.get(matchId);
  
  if (execState.awaitingAck) return;
  if (!execState.stepQueue || execState.stepIndex >= execState.stepQueue.length) {
    execState.stepQueue = [];
    execState.stepIndex = 0;
    console.log(`[SERVER] Match ${matchId}: All steps complete, resetting isRunningRound to false`);
    execState.isRunningRound = false;
    clearMatchStepTimeout(matchId);
    if (execState.pendingMovementStart) {
      const pending = execState.pendingMovementStart;
      execState.pendingMovementStart = null;
      if (state) {
        startMovementPhase(state, matchId);
      }
    }
    return;
  }
  const step = execState.stepQueue[execState.stepIndex];
  execState.awaitingAck = true;
  io.to(matchId).emit('step', cloneForWire(withTimelineMeta({ ...step, matchId })));
  startMatchStepTimeout(matchId);
};

// Legacy global sendNextStep for non-match games
const sendNextStep = () => {
  if (awaitingAck) return;
  if (!stepQueue || stepIndex >= stepQueue.length) {
    stepQueue = [];
    stepIndex = 0;
    console.log('[SERVER] All steps complete, resetting isRunningRound to false');
    isRunningRound = false;
    clearStepTimeout();
    if (pendingMovementStart) {
      const pending = pendingMovementStart;
      pendingMovementStart = null;
      startMovementPhase(gameState);
    }
    return;
  }
  const step = stepQueue[stepIndex];
  awaitingAck = true;
  io.emit('step', cloneForWire(withTimelineMeta(step)));
  startStepTimeout();
};

const startLeague4PhaseTimer = (matchId, ms, onTimeout) => {
  clearLeaguePhaseTimer(matchId);
  const timer = setTimeout(async () => {
    try {
      await onTimeout();
    } catch (error) {
      console.error(`[League4] Timer error for ${matchId}:`, error);
    }
  }, ms);
  leaguePhaseTimers.set(matchId, timer);
};

const cloneLeagueTeamWithSubmission = (team, submission) => {
  const cloned = {
    main: (team?.main || []).map((tile) => (tile ? deepClone(tile) : tile)),
    reserve: (team?.reserve || []).map((tile) => (tile ? deepClone(tile) : tile))
  };
  applyLeagueSwapDecision(cloned, submission || { type: 'noop' });
  return cloned;
};

const mirrorMainBoardForP2 = (mainBoard) => {
  const source = Array.isArray(mainBoard) ? mainBoard : [];
  const mirrored = Array(source.length).fill(null);
  source.forEach((tile, srcIndex) => {
    const row = Math.floor(srcIndex / 3);
    const col = srcIndex % 3;
    const dstIndex = (row * 3) + (2 - col);
    mirrored[dstIndex] = tile;
  });
  return mirrored;
};

const toPairBattleTiles = (tiles, playerKey, type) => (
  (tiles || []).map((tile, index) => {
    const base = tile ? deepClone(tile) : {};
    return {
      ...base,
      id: `${playerKey}-${type}-${index}`,
      player: playerKey,
      index,
      type,
      hero: tile?.hero ? deepClone(tile.hero) : null
    };
  })
);

const getLeaguePairSessionStore = (matchId) => {
  if (!leaguePairSessions.has(matchId)) {
    leaguePairSessions.set(matchId, {});
  }
  return leaguePairSessions.get(matchId);
};

const clearLeaguePairSessionStore = (matchId) => {
  if (!leaguePairSessions.has(matchId)) return;
  const store = leaguePairSessions.get(matchId);
  Object.keys(store || {}).forEach((pairKey) => {
    const session = store[pairKey];
    if (session?.stepTimeout) {
      clearTimeout(session.stepTimeout);
      session.stepTimeout = null;
    }
    if (session?.clockTimeout) {
      clearTimeout(session.clockTimeout);
      session.clockTimeout = null;
    }
  });
  leaguePairSessions.delete(matchId);
};

const getLeaguePairSessionForPlayer = (matchId, playerKey, pairKeyHint = null) => {
  const store = getLeaguePairSessionStore(matchId);
  if (pairKeyHint && store[pairKeyHint] && (store[pairKeyHint].a === playerKey || store[pairKeyHint].b === playerKey)) {
    return { pairKey: pairKeyHint, session: store[pairKeyHint] };
  }
  const pairKey = Object.keys(store).find((key) => {
    const s = store[key];
    return s && (s.a === playerKey || s.b === playerKey);
  });
  return pairKey ? { pairKey, session: store[pairKey] } : null;
};

const emitLeaguePairState = (matchId, pairKey) => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session || !session.state) return;
  const clock = syncLeaguePairClock(session, Date.now());
  session.state.clockState = clock ? { ...clock } : null;
  io.to(matchId).emit('leaguePairBattleState', cloneForWire({
    serverNowTs: Date.now(),
    pairKey,
    a: session.a,
    b: session.b,
    state: session.state
  }));
};

const startLeaguePairStepTimeout = (matchId, pairKey) => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session) return;
  if (session.stepTimeout) {
    clearTimeout(session.stepTimeout);
    session.stepTimeout = null;
  }
  session.stepTimeout = setTimeout(() => {
    session.awaitingAck = false;
    session.stepIndex += 1;
    sendNextStepForLeaguePair(matchId, pairKey);
  }, 8000);
};

const clearLeaguePairStepTimeout = (matchId, pairKey) => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session || !session.stepTimeout) return;
  clearTimeout(session.stepTimeout);
  session.stepTimeout = null;
};

const ensureLeaguePairClockState = (session) => {
  if (!session) return null;
  session.clockState = session.clockState || {
    player1Ms: LEAGUE4_CHESS_TIME_MS,
    player2Ms: LEAGUE4_CHESS_TIME_MS,
    activePlayerKey: null,
    lastUpdatedTs: Date.now(),
    deadlineTs: null
  };
  return session.clockState;
};

const clearLeaguePairClockTimeout = (matchId, pairKey) => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session || !session.clockTimeout) return;
  clearTimeout(session.clockTimeout);
  session.clockTimeout = null;
};

const syncLeaguePairClock = (session, nowTs = Date.now()) => {
  const clock = ensureLeaguePairClockState(session);
  if (!clock) return null;
  const active = clock.activePlayerKey;
  const lastUpdated = Number(clock.lastUpdatedTs || nowTs);
  const elapsed = Math.max(0, Number(nowTs) - lastUpdated);

  if (active === 'player1' && elapsed > 0) {
    clock.player1Ms = Math.max(0, Number(clock.player1Ms || 0) - elapsed);
  } else if (active === 'player2' && elapsed > 0) {
    clock.player2Ms = Math.max(0, Number(clock.player2Ms || 0) - elapsed);
  }

  clock.lastUpdatedTs = Number(nowTs);
  if (active) {
    const remaining = active === 'player1' ? Number(clock.player1Ms || 0) : Number(clock.player2Ms || 0);
    clock.deadlineTs = Number(nowTs) + remaining;
  } else {
    clock.deadlineTs = null;
  }
  return clock;
};

const getLeaguePairActiveClockPlayer = (session) => {
  if (!session || !session.state || session.state.phase !== 'movement') return null;
  const mover = session.state.movementPhase?.sequence?.[session.state.movementPhase?.index];
  if (mover === 'p1') return 'player1';
  if (mover === 'p2') return 'player2';
  return null;
};

const advanceLeaguePairMovementTurn = (matchId, pairKey, reason = 'timeout') => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session || !session.state || session.state.phase !== 'movement' || !session.state.movementPhase) return false;

  const pairState = session.state;
  const mp = pairState.movementPhase;
  const nextIndex = Number(mp.index || 0) + 1;
  if (nextIndex >= mp.sequence.length) {
    pairState.movementPhase = null;
    pairState.phase = 'ready';
    pairState.priorityPlayer = (pairState.priorityPlayer === 'player1' || pairState.priorityPlayer === 'p1') ? 'player2' : 'player1';
  } else {
    pairState.movementPhase = { ...mp, index: nextIndex };
  }

  const nextActive = getLeaguePairActiveClockPlayer(session);
  setLeaguePairClockActive(matchId, pairKey, nextActive);
  emitLeaguePairState(matchId, pairKey);
  return true;
};

const setLeaguePairClockActive = (matchId, pairKey, activePlayerKey) => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session) return;

  const nowTs = Date.now();
  const clock = syncLeaguePairClock(session, nowTs);
  clearLeaguePairClockTimeout(matchId, pairKey);

  clock.activePlayerKey = activePlayerKey || null;
  clock.lastUpdatedTs = nowTs;
  if (!clock.activePlayerKey) {
    clock.deadlineTs = null;
    return;
  }

  const remaining = clock.activePlayerKey === 'player1'
    ? Number(clock.player1Ms || 0)
    : Number(clock.player2Ms || 0);
  clock.deadlineTs = nowTs + remaining;

  if (remaining <= 0) {
    setTimeout(() => {
      advanceLeaguePairMovementTurn(matchId, pairKey, 'clock-expired');
    }, 0);
    return;
  }

  session.clockTimeout = setTimeout(() => {
    const latestStore = getLeaguePairSessionStore(matchId);
    const latestSession = latestStore[pairKey];
    if (!latestSession) return;
    const latestClock = syncLeaguePairClock(latestSession, Date.now());
    if (latestClock.activePlayerKey !== activePlayerKey) return;
    advanceLeaguePairMovementTurn(matchId, pairKey, 'clock-expired');
  }, remaining);
};

const startMovementPhaseForLeaguePair = (matchId, pairKey) => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session || !session.state) return;
  const state = session.state;
  const prio = state.priorityPlayer || 'player1';
  const prioShort = (prio === 'player1' || prio === 'p1') ? 'p1' : 'p2';
  const sequence = prioShort === 'p1' ? ['p1', 'p2', 'p2', 'p1'] : ['p2', 'p1', 'p1', 'p2'];
  state.movementPhase = { sequence, index: 0 };
  state.phase = 'movement';
  setLeaguePairClockActive(matchId, pairKey, getLeaguePairActiveClockPlayer(session));
  emitLeaguePairState(matchId, pairKey);
};

const getRemainingHealthOnMain = (board) => (board || []).reduce((sum, tile) => {
  if (!tile || !tile.hero || tile._dead) return sum;
  const hp = tile.currentHealth != null ? Number(tile.currentHealth) : Number(tile.hero.health || 0);
  return sum + Math.max(0, hp);
}, 0);

const finalizeLeaguePairResult = async (matchId, pairKey, winnerToken) => {
  const state = matchStates.get(matchId);
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!state || !state.league4 || !session || session.resultReported) return;
  session.resultReported = true;

  const winner = winnerToken === 'player1'
    ? session.a
    : winnerToken === 'player2'
      ? session.b
      : 'draw';
  const hpA = getRemainingHealthOnMain(session.state?.p1Main || []);
  const hpB = getRemainingHealthOnMain(session.state?.p2Main || []);

  state.league4.pendingMatchReports = state.league4.pendingMatchReports || {};
  state.league4.pendingMatchReports[pairKey] = {
    winner,
    reportedBy: 'server_live',
    scoreLine: `${hpA}-${hpB}`,
    hpDiff: Math.abs(hpA - hpB),
    roundsPlayed: Number(session.state?.roundNumber || 0),
    remainingHealth: {
      [session.a]: hpA,
      [session.b]: hpB
    }
  };

  io.to(matchId).emit('leaguePairBattleEnded', cloneForWire({ pairKey, winner }));
  emitLeague4State(matchId);

  const expectedReports = getCurrentLeaguePairings(state.league4).length;
  const reportCount = Object.keys(state.league4.pendingMatchReports || {}).length;
  if (expectedReports > 0 && reportCount >= expectedReports) {
    await finalizeLeague4Round(matchId);
  }
};

const startLeaguePairRound = async (matchId, pairKey, priorityPlayer = 'player1') => {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session || !session.state) return;
  if (session.isRunningRound || session.awaitingAck || (session.stepQueue && session.stepQueue.length > 0)) return;

  session.isRunningRound = true;
  const result = await processMove(session.state, {
    type: 'startRound',
    priorityPlayer,
    speedMultiplier: 4
  }, io, { returnSteps: true });
  session.state = result.state;
  setLeaguePairClockActive(matchId, pairKey, null);
  session.stepQueue = (result.steps || []).map((step) => (step && typeof step === 'object' ? { ...step, leaguePairKey: pairKey } : step));
  session.stepIndex = 0;
  session.awaitingAck = false;
  session.pendingMovementStart = true;
  sendNextStepForLeaguePair(matchId, pairKey);
};

function sendNextStepForLeaguePair(matchId, pairKey) {
  const store = getLeaguePairSessionStore(matchId);
  const session = store[pairKey];
  if (!session || session.awaitingAck) return;

  if (!session.stepQueue || session.stepIndex >= session.stepQueue.length) {
    session.stepQueue = [];
    session.stepIndex = 0;
    session.isRunningRound = false;
    clearLeaguePairStepTimeout(matchId, pairKey);
    if (session.pendingMovementStart) {
      session.pendingMovementStart = false;
      startMovementPhaseForLeaguePair(matchId, pairKey);
    }
    return;
  }

  const step = session.stepQueue[session.stepIndex];
  session.awaitingAck = true;
  io.to(matchId).emit('leaguePairBattleStep', cloneForWire(withTimelineMeta({ ...step, pairKey })));
  const gameEnd = step && (step.type === 'gameEnd' || (step.type === 'roundComplete' && step.winner));
  if (gameEnd && step.winner) {
    finalizeLeaguePairResult(matchId, pairKey, step.winner).catch((error) => {
      console.error(`[League4] Failed to finalize pair ${pairKey}:`, error);
    });
  }
  startLeaguePairStepTimeout(matchId, pairKey);
}

const beginLeague4LivePairBattles = (matchId) => {
  const state = matchStates.get(matchId);
  if (!state || state.gameMode !== 'league4' || !state.league4 || state.phase !== 'league_swap') return;
  const pairings = getCurrentLeaguePairings(state.league4);
  const store = getLeaguePairSessionStore(matchId);
  Object.keys(store).forEach((k) => {
    clearLeaguePairStepTimeout(matchId, k);
    clearLeaguePairClockTimeout(matchId, k);
    delete store[k];
  });
  state.league4.pendingMatchReports = {};

  pairings.forEach((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) return;
    const [a, b] = pair;
    const pairKey = getLeaguePairKey(a, b);
    const teamA = cloneLeagueTeamWithSubmission(state.league4.teams?.[a], state.league4.decision?.submissions?.[a]);
    const teamBRaw = cloneLeagueTeamWithSubmission(state.league4.teams?.[b], state.league4.decision?.submissions?.[b]);
    const teamB = { ...teamBRaw, main: mirrorMainBoardForP2(teamBRaw.main || []) };
    const sessionState = {
      p1Main: toPairBattleTiles(teamA.main, 'player1', 'main'),
      p1Reserve: toPairBattleTiles(teamA.reserve, 'player1', 'reserve'),
      p2Main: toPairBattleTiles(teamB.main, 'player2', 'main'),
      p2Reserve: toPairBattleTiles(teamB.reserve, 'player2', 'reserve'),
      phase: 'battle',
      gameMode: 'classic',
      roundNumber: 0,
      priorityPlayer: Math.random() < 0.5 ? 'player1' : 'player2'
    };

    store[pairKey] = {
      pairKey,
      a,
      b,
      state: sessionState,
      clockState: {
        player1Ms: LEAGUE4_CHESS_TIME_MS,
        player2Ms: LEAGUE4_CHESS_TIME_MS,
        activePlayerKey: null,
        lastUpdatedTs: Date.now(),
        deadlineTs: null
      },
      stepQueue: [],
      stepIndex: 0,
      awaitingAck: false,
      stepTimeout: null,
      clockTimeout: null,
      isRunningRound: false,
      pendingMovementStart: false,
      resultReported: false
    };
    emitLeaguePairState(matchId, pairKey);
    setTimeout(() => {
      startLeaguePairRound(matchId, pairKey, sessionState.priorityPlayer).catch((error) => {
        console.error(`[League4] Failed to auto-start pair round for ${pairKey}:`, error);
      });
    }, 120);
  });

  emitLeague4State(matchId);
};

const beginLeague4RoundOneBattles = (matchId) => {
  const st = matchStates.get(matchId);
  if (!st || st.gameMode !== 'league4' || !st.league4) return;
  st.phase = 'league_swap';
  st.league4.pendingMatchReports = {};
  st.league4.decision = {
    type: 'swap',
    deadlineTs: Date.now() + LEAGUE4_SWAP_TIMER_MS,
    submissions: {}
  };

  ['player1', 'player2', 'player3', 'player4'].forEach((playerKey) => {
    const team = st.league4.teams?.[playerKey] || { main: [], reserve: [] };
    const placements = [];
    (team.main || []).forEach((tile, slotIndex) => {
      const heroId = tile?.hero?.id;
      if (heroId) placements.push({ heroId: String(heroId), slotType: 'main', slotIndex });
    });
    (team.reserve || []).forEach((tile, slotIndex) => {
      const heroId = tile?.hero?.id;
      if (heroId) placements.push({ heroId: String(heroId), slotType: 'reserve', slotIndex });
    });

    st.league4.decision.submissions[playerKey] = {
      type: 'placements',
      placements,
      auto: true
    };
  });

  beginLeague4LivePairBattles(matchId);
};

const beginLeague4SwapPhase = (matchId) => {
  const st = matchStates.get(matchId);
  if (!st || st.gameMode !== 'league4' || !st.league4) return;
  st.phase = 'league_swap';
  st.league4.pendingMatchReports = {};
  st.league4.decision = {
    type: 'swap',
    deadlineTs: Date.now() + LEAGUE4_SWAP_TIMER_MS,
    submissions: {}
  };

  emitLeague4State(matchId);

  startLeague4PhaseTimer(matchId, LEAGUE4_SWAP_TIMER_MS, async () => {
    const state = matchStates.get(matchId);
    if (!state || state.gameMode !== 'league4' || !state.league4 || state.phase !== 'league_swap') return;
    ['player1', 'player2', 'player3', 'player4'].forEach((playerKey) => {
      if (!state.league4.decision.submissions[playerKey]) {
        state.league4.decision.submissions[playerKey] = { type: 'noop', auto: true };
      }
    });
    beginLeague4LivePairBattles(matchId);
  });
};

const beginLeague4DraftPhase = (matchId) => {
  const st = matchStates.get(matchId);
  if (!st || st.gameMode !== 'league4' || !st.league4) return;
  st.phase = 'league_draft';
  st.league4.decision = {
    type: 'draft',
    deadlineTs: Date.now() + LEAGUE4_DRAFT_TIMER_MS,
    submissions: {}
  };
  emitLeague4State(matchId);

  startLeague4PhaseTimer(matchId, LEAGUE4_DRAFT_TIMER_MS, async () => {
    const state = matchStates.get(matchId);
    if (!state || state.gameMode !== 'league4' || !state.league4 || state.phase !== 'league_draft') return;
    ['player1', 'player2', 'player3', 'player4'].forEach((playerKey) => {
      if (!state.league4.decision.submissions[playerKey]) {
        const pool = state.league4.draftPools?.[playerKey] || [];
        const defaultMainSlots = [2, 5, 8, 1, 4];
        const placements = [];
        for (let i = 0; i < LEAGUE4_TEAM_SIZE_MAIN; i += 1) {
          const hero = pool[i];
          if (!hero) continue;
          placements.push({ heroId: hero.id, slotType: 'main', slotIndex: defaultMainSlots[i] });
        }
        for (let i = 0; i < LEAGUE4_TEAM_SIZE_RESERVE; i += 1) {
          const hero = pool[LEAGUE4_TEAM_SIZE_MAIN + i];
          if (!hero) continue;
          placements.push({ heroId: hero.id, slotType: 'reserve', slotIndex: i });
        }
        state.league4.decision.submissions[playerKey] = { placements, auto: true };
      }
      fillLeagueTeamFromDraft(
        state.league4.teams[playerKey],
        state.league4.draftPools?.[playerKey] || [],
        state.league4.decision.submissions[playerKey]?.placements || []
      );
    });

    state.league4.draftPools = {};
    if (Number(state.league4.currentRound || 1) === 1) {
      clearLeaguePhaseTimer(matchId);
      beginLeague4RoundOneBattles(matchId);
      return;
    }
    beginLeague4SwapPhase(matchId);
  });
};

const awardLeague4RoundEconomy = (league4State, roundResults, match) => {
  const economy = ensureLeagueEconomyState(league4State);
  const rewards = {
    player1: { base: 0, streakBonus: 0, catchupBonus: 0, total: 0, result: 'draw' },
    player2: { base: 0, streakBonus: 0, catchupBonus: 0, total: 0, result: 'draw' },
    player3: { base: 0, streakBonus: 0, catchupBonus: 0, total: 0, result: 'draw' },
    player4: { base: 0, streakBonus: 0, catchupBonus: 0, total: 0, result: 'draw' }
  };

  (roundResults || []).forEach((result) => {
    if (!result || !result.a || !result.b) return;
    if (result.winner === 'draw') {
      rewards[result.a].base += LEAGUE4_DRAW_COINS;
      rewards[result.b].base += LEAGUE4_DRAW_COINS;
      rewards[result.a].result = 'draw';
      rewards[result.b].result = 'draw';
      economy[result.a].lossStreak = 0;
      economy[result.b].lossStreak = 0;
      return;
    }

    const winner = result.winner;
    const loser = winner === result.a ? result.b : result.a;
    rewards[winner].base += LEAGUE4_WIN_COINS;
    rewards[winner].result = 'win';
    rewards[loser].base += LEAGUE4_LOSS_COINS;
    rewards[loser].result = 'loss';

    economy[winner].lossStreak = 0;
    economy[loser].lossStreak = Number(economy[loser].lossStreak || 0) + 1;
    rewards[loser].streakBonus += getLeagueLossStreakBonus(economy[loser].lossStreak);
  });

  const standings = getLeague4SortedStandings(league4State, match);
  if (standings[2]?.playerKey) rewards[standings[2].playerKey].catchupBonus += 1;
  if (standings[3]?.playerKey) rewards[standings[3].playerKey].catchupBonus += 2;

  ['player1', 'player2', 'player3', 'player4'].forEach((playerKey) => {
    const rec = rewards[playerKey];
    const gain = Math.max(0, Number(rec.base || 0) + Number(rec.streakBonus || 0) + Number(rec.catchupBonus || 0));
    rec.total = gain;
    economy[playerKey].coins = Number(economy[playerKey].coins || 0) + gain;
    economy[playerKey].totalEarned = Number(economy[playerKey].totalEarned || 0) + gain;
  });

  league4State.latestCoinRewards = rewards;
};

const finishLeague4ShopPhase = (matchId) => {
  const state = matchStates.get(matchId);
  if (!state || state.gameMode !== 'league4' || !state.league4) return;
  const l4 = state.league4;
  clearLeaguePhaseTimer(matchId);
  l4.currentRound = Number(l4.currentRound || 1) + 1;
  l4.shopState = {
    offers: [],
    turnOrder: [],
    turnIndex: 0,
    purchases: [],
    passes: {},
    completedTurnOrder: []
  };
  beginLeague4SwapPhase(matchId);
};

const advanceLeague4ShopTurn = (matchId, timeout = false) => {
  const state = matchStates.get(matchId);
  const match = activeMatches.get(matchId);
  if (!state || !match || state.gameMode !== 'league4' || !state.league4) return;
  if (state.phase !== 'league_shop' || state.league4.decision?.type !== 'shop') return;

  const l4 = state.league4;
  const shop = l4.shopState || {};
  const order = Array.isArray(shop.turnOrder) ? shop.turnOrder : [];
  const turnIndex = Number(shop.turnIndex || 0);
  const activePlayerKey = order[turnIndex] || null;
  if (!activePlayerKey) {
    finishLeague4ShopPhase(matchId);
    return;
  }

  if (timeout && !l4.decision.submissions?.[activePlayerKey]) {
    const economy = ensureLeagueEconomyState(l4);
    const coins = Number(economy[activePlayerKey]?.coins || 0);
    const offers = Array.isArray(shop.offers) ? shop.offers : [];
    const picked = pickLeagueAffordableAutoChoice(offers, coins);
    if (picked) {
      const team = l4.teams?.[activePlayerKey];
      const fallback = findLeagueDefaultTarget(team);
      const slotType = fallback?.slotType || 'main';
      const slotIndex = Number(fallback?.slotIndex || 0);
      const cost = getLeagueAugmentCost(picked);
      const ok = applyLeaguePurchasedAugment(l4, activePlayerKey, { slotType, slotIndex }, picked);
      if (ok) {
        economy[activePlayerKey].coins = Math.max(0, coins - cost);
        economy[activePlayerKey].totalSpent = Number(economy[activePlayerKey].totalSpent || 0) + cost;
        l4.shopState.purchases = Array.isArray(l4.shopState.purchases) ? l4.shopState.purchases : [];
        l4.shopState.purchases.push({ playerKey: activePlayerKey, augmentId: picked.id, cost, slotType, slotIndex, auto: true });
        l4.shopState.offers = (l4.shopState.offers || []).filter((offer) => offer && offer.id !== picked.id);
        l4.decision.submissions[activePlayerKey] = { type: 'buy', augmentId: picked.id, slotType, slotIndex, cost, auto: true };
      }
    }

    if (!l4.decision.submissions?.[activePlayerKey]) {
      l4.shopState.passes = l4.shopState.passes || {};
      l4.shopState.passes[activePlayerKey] = true;
      l4.decision.submissions[activePlayerKey] = { type: 'pass', auto: true };
    }
  }

  l4.shopState.completedTurnOrder = Array.isArray(l4.shopState.completedTurnOrder) ? l4.shopState.completedTurnOrder : [];
  if (activePlayerKey && !l4.shopState.completedTurnOrder.includes(activePlayerKey)) {
    l4.shopState.completedTurnOrder.push(activePlayerKey);
  }
  l4.shopState.turnIndex = turnIndex + 1;

  const done = l4.shopState.turnIndex >= order.length;
  if (done) {
    emitLeague4State(matchId);
    finishLeague4ShopPhase(matchId);
    return;
  }

  const nextPlayerKey = order[l4.shopState.turnIndex];
  l4.decision = {
    type: 'shop',
    deadlineTs: Date.now() + LEAGUE4_SHOP_TURN_TIMER_MS,
    submissions: l4.decision.submissions || {},
    activePlayerKey: nextPlayerKey
  };
  state.phase = 'league_shop';
  emitLeague4State(matchId);

  startLeague4PhaseTimer(matchId, LEAGUE4_SHOP_TURN_TIMER_MS, async () => {
    advanceLeague4ShopTurn(matchId, true);
  });
};

const beginLeague4ShopPhase = (matchId) => {
  const state = matchStates.get(matchId);
  const match = activeMatches.get(matchId);
  if (!state || !match || state.gameMode !== 'league4' || !state.league4) return;
  const l4 = state.league4;
  clearLeaguePhaseTimer(matchId);
  ensureLeagueEconomyState(l4);

  l4.shopState = {
    offers: buildLeagueShopOffers(Number(l4.currentRound || 1) + 1),
    turnOrder: getLeagueShopTurnOrder(l4, match),
    turnIndex: 0,
    purchases: [],
    passes: {},
    completedTurnOrder: []
  };

  const firstPlayerKey = l4.shopState.turnOrder[0] || null;
  l4.decision = {
    type: 'shop',
    deadlineTs: Date.now() + LEAGUE4_SHOP_TURN_TIMER_MS,
    submissions: {},
    activePlayerKey: firstPlayerKey
  };
  state.phase = 'league_shop';
  l4.processing = false;
  emitLeague4State(matchId);

  startLeague4PhaseTimer(matchId, LEAGUE4_SHOP_TURN_TIMER_MS, async () => {
    advanceLeague4ShopTurn(matchId, true);
  });
};

const finalizeLeague4Round = async (matchId) => {
  const state = matchStates.get(matchId);
  const match = activeMatches.get(matchId);
  if (!state || !match || state.gameMode !== 'league4' || !state.league4) return;
  clearLeaguePairSessionStore(matchId);
  const l4 = state.league4;
  if (l4.processing) return;
  l4.processing = true;
  clearLeaguePhaseTimer(matchId);
  const roundNumber = Number(l4.currentRound || 1);

  const scheduleIndex = Math.max(0, Math.min(LEAGUE4_SCHEDULE.length - 1, roundNumber - 1));
  const pairings = LEAGUE4_SCHEDULE[scheduleIndex] || [];

  Object.keys(l4.teams || {}).forEach((playerKey) => {
    const submission = l4.decision?.submissions?.[playerKey] || { type: 'noop' };
    applyLeagueSwapDecision(l4.teams[playerKey], submission);
  });

  const roundResults = [];
  l4.matchHighlights = Array.isArray(l4.matchHighlights) ? l4.matchHighlights : [];
  for (const pair of pairings) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [a, b] = pair;
    const pairKey = getLeaguePairKey(a, b);
    const reported = l4.pendingMatchReports && l4.pendingMatchReports[pairKey]
      ? l4.pendingMatchReports[pairKey]
      : null;
    const result = reported
      ? {
          a,
          b,
          winner: reported.winner || 'draw',
          roundsPlayed: Number(reported.roundsPlayed || 0),
          resolution: 'played',
          scoreLine: reported.scoreLine || 'played',
          hpDiff: Number(reported.hpDiff || 0),
          remainingHealth: reported.remainingHealth || {}
        }
      : await resolveLeagueHeadToHead(l4.teams[a], l4.teams[b], a, b);
    roundResults.push(result);
    l4.matchHighlights.push({
      round: roundNumber,
      ...result
    });

    if (result.winner === 'draw') {
      l4.standings[a].points += 1;
      l4.standings[b].points += 1;
      l4.standings[a].draws += 1;
      l4.standings[b].draws += 1;
    } else if (result.winner === a) {
      l4.standings[a].points += 3;
      l4.standings[a].wins += 1;
      l4.standings[b].losses += 1;
    } else {
      l4.standings[b].points += 3;
      l4.standings[b].wins += 1;
      l4.standings[a].losses += 1;
    }
  }

  l4.latestRoundResults = roundResults;
  l4.roundHistory = Array.isArray(l4.roundHistory) ? l4.roundHistory : [];
  l4.roundHistory.push({
    round: roundNumber,
    createdAt: Date.now(),
    results: roundResults
  });
  if (l4.roundHistory.length > LEAGUE4_TOTAL_ROUNDS) {
    l4.roundHistory = l4.roundHistory.slice(-LEAGUE4_TOTAL_ROUNDS);
  }

  if (roundNumber >= LEAGUE4_TOTAL_ROUNDS) {
    l4.completed = true;
    state.phase = 'league_complete';
    l4.decision = { type: 'none', deadlineTs: 0, submissions: {} };
    l4.augmentOffers = {};
    l4.shopState = {
      offers: [],
      turnOrder: [],
      turnIndex: 0,
      purchases: [],
      passes: {},
      completedTurnOrder: []
    };
    const standings = getLeague4SortedStandings(l4, match);
    l4.winner = standings[0]?.playerKey || null;

    const dominant = [...(l4.matchHighlights || [])]
      .filter((m) => m && m.winner && m.winner !== 'draw')
      .sort((a, b) => {
        if (Number(b.hpDiff || 0) !== Number(a.hpDiff || 0)) return Number(b.hpDiff || 0) - Number(a.hpDiff || 0);
        return Number(a.roundsPlayed || 99) - Number(b.roundsPlayed || 99);
      })[0] || null;

    l4.summary = {
      winner: l4.winner,
      winnerUsername: standings[0]?.username || null,
      mvpHero: pickLeagueMvpHero(l4, l4.winner),
      dominantMatch: dominant
    };

    l4.processing = false;
    emitLeague4State(matchId);
    return;
  }

  awardLeague4RoundEconomy(l4, roundResults, match);
  beginLeague4ShopPhase(matchId);
};

const getRequiredPlayersForMode = (gameMode) => (gameMode === 'ffa3' ? 3 : (gameMode === 'league4' ? 4 : 2));

const emitQueuePositions = (gameMode) => {
  const queue = getMatchQueue(gameMode);
  const validIds = queue.filter((id) => {
    const s = io.sockets.sockets.get(id);
    if (s) {
      clearStaleMatchForSocket(s, 'emit-queue-positions');
    }
    return !!(s && s.data && s.data.playfab && !s.data.matchId);
  });
  validIds.forEach((id, idx) => {
    const s = io.sockets.sockets.get(id);
    if (s) s.emit('matchQueued', { position: idx + 1, gameMode, serverInstanceId: SERVER_INSTANCE_ID });
  });
};

const initializeMatchState = (matchId, gameMode) => {
  const baseState = gameMode === 'league4'
    ? makeLeague4State()
    : {
        p1Main: makeEmptyMain('player1'),
        p1Reserve: makeReserve('player1'),
        p2Main: makeEmptyMain('player2'),
        p2Reserve: makeReserve('player2'),
        ...(gameMode === 'ffa3' ? { p3Main: makeEmptyMain('player3'), p3Reserve: makeReserve('player3') } : {}),
        availableHeroes: gameMode === 'ffa3'
          ? sampleHeroes(DRAFTABLE_HEROES, FFA3_DRAFT_POOL_SIZE)
          : sampleHeroes(DRAFTABLE_HEROES, CLASSIC_DRAFT_POOL_SIZE),
        bans: [],
        step: 0,
        roundNumber: 0,
        phase: 'draft',
        gameMode
      };

  matchStates.set(matchId, baseState);
  if (gameMode === 'league4') {
    beginLeague4DraftPhase(matchId);
  } else {
    io.to(matchId).emit('gameState', cloneForWire(matchStates.get(matchId)));
  }
};

const startQueuedMatchIfReady = (gameMode) => {
  const queue = getMatchQueue(gameMode);
  const required = getRequiredPlayersForMode(gameMode);

  const pullNextValidSocket = (pickedPlayFabIds = new Set()) => {
    while (queue.length > 0) {
      const id = queue.shift();
      const s = io.sockets.sockets.get(id);
      if (!s || !s.data || !s.data.playfab) continue;
      clearStaleMatchForSocket(s, 'queue-pick');
      if (s.data.matchId) continue;
      const playFabId = getSocketPlayFabId(s);
      if (!playFabId) continue;
      if (pickedPlayFabIds.has(playFabId)) continue;
      return s;
    }
    return null;
  };

  while (true) {
    const picked = [];
    const pickedPlayFabIds = new Set();
    for (let i = 0; i < required; i += 1) {
      const s = pullNextValidSocket(pickedPlayFabIds);
      if (!s) break;
      picked.push(s);
      pickedPlayFabIds.add(getSocketPlayFabId(s));
    }

    if (picked.length < required) {
      picked.forEach((s) => queue.unshift(s.id));
      break;
    }

    const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const p1Socket = picked[0];
    const p2Socket = picked[1];
    const p3Socket = required >= 3 ? picked[2] : null;
    const p4Socket = required >= 4 ? picked[3] : null;

    const p1 = { id: p1Socket.id, playFabId: p1Socket.data.playfab.playFabId, username: p1Socket.data.playfab.username };
    const p2 = { id: p2Socket.id, playFabId: p2Socket.data.playfab.playFabId, username: p2Socket.data.playfab.username };
    const p3 = p3Socket ? { id: p3Socket.id, playFabId: p3Socket.data.playfab.playFabId, username: p3Socket.data.playfab.username } : null;
    const p4 = p4Socket ? { id: p4Socket.id, playFabId: p4Socket.data.playfab.playFabId, username: p4Socket.data.playfab.username } : null;

    activeMatches.set(matchId, { p1, p2, p3, p4, gameMode, createdAt: Date.now() });

    picked.forEach((s) => {
      s.data.matchId = matchId;
      s.join(matchId);
    });

    initializeMatchState(matchId, gameMode);

    const playersPayload = {
      p1: p1.username || 'Player 1',
      p2: p2.username || 'Player 2',
      ...(p3 ? { p3: p3.username || 'Player 3' } : {}),
      ...(p4 ? { p4: p4.username || 'Player 4' } : {})
    };

    p1Socket.emit('matchFound', { matchId, side: 'p1', gameMode, players: playersPayload, opponent: { playFabId: p2.playFabId, username: p2.username }, serverInstanceId: SERVER_INSTANCE_ID });
    p2Socket.emit('matchFound', { matchId, side: 'p2', gameMode, players: playersPayload, opponent: { playFabId: p1.playFabId, username: p1.username }, serverInstanceId: SERVER_INSTANCE_ID });
    if (p3Socket) p3Socket.emit('matchFound', { matchId, side: 'p3', gameMode, players: playersPayload, opponent: { playFabId: p1.playFabId, username: p1.username }, serverInstanceId: SERVER_INSTANCE_ID });
    if (p4Socket) p4Socket.emit('matchFound', { matchId, side: 'p4', gameMode, players: playersPayload, opponent: { playFabId: p1.playFabId, username: p1.username }, serverInstanceId: SERVER_INSTANCE_ID });

    console.log('[Matchmaking] Match found', matchId, p1.playFabId, p2.playFabId, p3 ? p3.playFabId : null, p4 ? p4.playFabId : null, 'mode', gameMode);
  }

  emitQueuePositions(gameMode);
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  bettingModeManager.onConnection(socket);

  // Only send global state to players not in a match (for local/single-player modes)
  // Match players will receive their state when they join/create a match
  if (!socket.data?.matchId) {
    socket.emit('gameState', cloneForWire(gameState));
  }

  // Handle player actions
  socket.on('makeMove', async (action) => {
    try {
      console.log('Received action:', action, 'from socket:', socket.id);
      const matchId = socket.data && socket.data.matchId ? socket.data.matchId : null;
      const state = matchId && matchStates.has(matchId) ? matchStates.get(matchId) : gameState;

      if (matchId && state && state.gameMode === 'league4' && state.league4) {
        const match = activeMatches.get(matchId);
        const side = match?.p1?.id === socket.id ? 'p1'
          : match?.p2?.id === socket.id ? 'p2'
            : match?.p3?.id === socket.id ? 'p3'
              : match?.p4?.id === socket.id ? 'p4'
                : null;
        const playerKey = side ? sideToPlayerKey4(side) : null;

        if (!playerKey) return;
        const decision = state.league4.decision || {};

        if (action && (action.type === 'startRound' || action.type === 'syncBattleState')) {
          const pairCtx = getLeaguePairSessionForPlayer(matchId, playerKey, action.leaguePairKey || null);
          if (!pairCtx || !pairCtx.session) return;
          const { pairKey, session } = pairCtx;

          if (action.type === 'syncBattleState') {
            if (action.p1Main) session.state.p1Main = action.p1Main;
            if (action.p2Main) session.state.p2Main = action.p2Main;
            if (action.p1Reserve) session.state.p1Reserve = action.p1Reserve;
            if (action.p2Reserve) session.state.p2Reserve = action.p2Reserve;
            if (action.priorityPlayer) session.state.priorityPlayer = action.priorityPlayer;
            session.state.phase = action.phase || 'battle';
            socket.emit('syncBattleAck', { requestId: action.requestId || null });
            emitLeaguePairState(matchId, pairKey);
            return;
          }

          if (session.isRunningRound || session.awaitingAck || (session.stepQueue && session.stepQueue.length > 0)) {
            return;
          }

          await startLeaguePairRound(matchId, pairKey, action.priorityPlayer || session.state?.priorityPlayer || 'player1');
          return;
        }

        if (action && action.type === 'leagueSubmitDraft') {
          if (state.phase !== 'league_draft' || decision.type !== 'draft') return;
          const placements = Array.isArray(action.placements) ? action.placements : [];
          const ok = fillLeagueTeamFromDraft(
            state.league4.teams[playerKey],
            state.league4.draftPools?.[playerKey] || [],
            placements
          );
          if (!ok) return;

          state.league4.decision.submissions[playerKey] = {
            placements: placements.map((entry) => ({
              heroId: String(entry.heroId || ''),
              slotType: entry.slotType === 'reserve' ? 'reserve' : 'main',
              slotIndex: Number(entry.slotIndex)
            })),
            auto: false
          };
          emitLeague4State(matchId);

          const allSubmitted = ['player1', 'player2', 'player3', 'player4'].every((pk) => !!state.league4.decision.submissions[pk]);
          if (allSubmitted) {
            clearLeaguePhaseTimer(matchId);
            state.league4.draftPools = {};
            if (Number(state.league4.currentRound || 1) === 1) {
              beginLeague4RoundOneBattles(matchId);
            } else {
              beginLeague4SwapPhase(matchId);
            }
          }
          return;
        }

        if (action && action.type === 'leagueSubmitSwap') {
          if (state.phase !== 'league_swap' || decision.type !== 'swap') return;
          const incomingPlacements = Array.isArray(action.placements) ? action.placements : null;
          const incomingOrder = Array.isArray(action.mainOrder) ? action.mainOrder : null;
          if (!action.noop && incomingPlacements && incomingPlacements.length > 0) {
            state.league4.decision.submissions[playerKey] = {
              type: 'placements',
              placements: incomingPlacements.map((entry) => ({
                heroId: String(entry?.heroId || ''),
                slotType: entry?.slotType === 'reserve' ? 'reserve' : 'main',
                slotIndex: Number(entry?.slotIndex)
              })),
              auto: false
            };
          } else if (!action.noop && incomingOrder && incomingOrder.length > 0) {
            state.league4.decision.submissions[playerKey] = {
              type: 'arrange',
              mainOrder: incomingOrder.map((n) => Number(n)),
              auto: false
            };
          } else {
            state.league4.decision.submissions[playerKey] = {
              type: action.noop ? 'noop' : 'swap',
              sourceIndex: Number(action.sourceIndex),
              targetIndex: Number(action.targetIndex),
              auto: false
            };
          }
          emitLeague4State(matchId);

          const allSubmitted = ['player1', 'player2', 'player3', 'player4'].every((pk) => !!state.league4.decision.submissions[pk]);
          if (allSubmitted) {
            clearLeaguePhaseTimer(matchId);
            beginLeague4LivePairBattles(matchId);
          }
          return;
        }

        if (action && action.type === 'leagueSubmitMatchResult') {
          if (state.phase !== 'league_swap') return;
          const opponentKey = String(action.opponentKey || '');
          if (!opponentKey || !['player1', 'player2', 'player3', 'player4'].includes(opponentKey)) return;
          if (opponentKey === playerKey) return;

          const validPairings = getCurrentLeaguePairings(state.league4);
          const inPairing = validPairings.some((pair) => Array.isArray(pair) && pair.includes(playerKey) && pair.includes(opponentKey));
          if (!inPairing) return;

          let winner = String(action.winner || 'draw');
          if (!['draw', playerKey, opponentKey].includes(winner)) {
            winner = 'draw';
          }

          const pairKey = getLeaguePairKey(playerKey, opponentKey);
          state.league4.pendingMatchReports = state.league4.pendingMatchReports || {};
          if (!state.league4.pendingMatchReports[pairKey]) {
            state.league4.pendingMatchReports[pairKey] = {
              winner,
              reportedBy: playerKey,
              scoreLine: String(action.scoreLine || 'played'),
              hpDiff: Number(action.hpDiff || 0),
              roundsPlayed: Number(action.roundsPlayed || 0),
              remainingHealth: action.remainingHealth || {}
            };
          }

          emitLeague4State(matchId);

          const expectedReports = getCurrentLeaguePairings(state.league4).length;
          const reportCount = Object.keys(state.league4.pendingMatchReports || {}).length;
          const allSwapsSubmitted = ['player1', 'player2', 'player3', 'player4'].every((pk) => !!state.league4.decision.submissions[pk]);
          if (expectedReports > 0 && reportCount >= expectedReports && allSwapsSubmitted) {
            await finalizeLeague4Round(matchId);
          }
          return;
        }

        if (action && action.type === 'leagueShopAction') {
          if (state.phase !== 'league_shop' || decision.type !== 'shop') return;
          const activePlayerKey = decision.activePlayerKey || null;
          if (!activePlayerKey || activePlayerKey !== playerKey) return;
          if (state.league4.decision.submissions?.[playerKey]) return;

          state.league4.shopState = state.league4.shopState || {
            offers: [],
            turnOrder: [],
            turnIndex: 0,
            purchases: [],
            passes: {},
            completedTurnOrder: []
          };

          if (action.pass) {
            state.league4.shopState.passes = state.league4.shopState.passes || {};
            state.league4.shopState.passes[playerKey] = true;
            state.league4.decision.submissions[playerKey] = { type: 'pass', auto: false };
            clearLeaguePhaseTimer(matchId);
            emitLeague4State(matchId);
            advanceLeague4ShopTurn(matchId, false);
            return;
          }

          const offers = Array.isArray(state.league4.shopState.offers) ? state.league4.shopState.offers : [];
          const picked = offers.find((offer) => offer && offer.id === action.augmentId);
          if (!picked) return;

          const economy = ensureLeagueEconomyState(state.league4);
          const coins = Number(economy[playerKey]?.coins || 0);
          const cost = getLeagueAugmentCost(picked);
          if (coins < cost) return;

          const slotType = action.slotType === 'reserve' ? 'reserve' : 'main';
          const slotIndex = Number(action.slotIndex);
          const applied = applyLeaguePurchasedAugment(
            state.league4,
            playerKey,
            { slotType, slotIndex },
            picked
          );
          if (!applied) return;

          economy[playerKey].coins = Math.max(0, coins - cost);
          economy[playerKey].totalSpent = Number(economy[playerKey].totalSpent || 0) + cost;
          state.league4.shopState.offers = offers.filter((offer) => offer && offer.id !== picked.id);
          state.league4.shopState.purchases = Array.isArray(state.league4.shopState.purchases) ? state.league4.shopState.purchases : [];
          state.league4.shopState.purchases.push({
            playerKey,
            augmentId: picked.id,
            cost,
            slotType,
            slotIndex,
            auto: false
          });
          state.league4.decision.submissions[playerKey] = {
            type: 'buy',
            augmentId: picked.id,
            slotType,
            slotIndex,
            cost,
            auto: false
          };

          clearLeaguePhaseTimer(matchId);
          emitLeague4State(matchId);
          advanceLeague4ShopTurn(matchId, false);
          return;
        }
      }
      
      if (isValidMove(state, action)) {
        if (action && action.type === 'startRound') {
          if (matchId) {
            // Use match-specific execution state
            const execState = getMatchExecState(matchId);
            if (execState.isRunningRound || execState.awaitingAck || (execState.stepQueue && execState.stepQueue.length > 0)) {
              console.log(`[SERVER] Match ${matchId}: Ignoring duplicate startRound - isRunningRound=${execState.isRunningRound}, awaitingAck=${execState.awaitingAck}, stepQueue.length=${execState.stepQueue ? execState.stepQueue.length : 0}`);
              return;
            }
            console.log(`[SERVER] Match ${matchId}: Starting new round execution`);
            execState.isRunningRound = true;
            const result = await processMove(state, action, io, { returnSteps: true });
            matchStates.set(matchId, result.state);
            execState.stepQueue = (result.steps || []).map((step) => (step && typeof step === 'object' ? { ...step, matchId } : step));
            execState.stepIndex = 0;
            execState.awaitingAck = false;
            execState.pendingMovementStart = { matchId };
            
            // Check for gameEnd in steps and record match result
            // Note: steps are lastAction objects directly, not wrapped in { lastAction: ... }
            // Winner can be in 'gameEnd' type OR 'roundComplete' type with a winner property
            console.log(`[SERVER] Match ${matchId}: Checking ${(result.steps || []).length} steps for gameEnd`);
            const gameEndStep = (result.steps || []).find(s => s && (s.type === 'gameEnd' || (s.type === 'roundComplete' && s.winner)));
            if (gameEndStep) {
              console.log(`[SERVER] Match ${matchId}: Found game-ending step:`, JSON.stringify({ type: gameEndStep.type, winner: gameEndStep.winner }));
            }
            if (gameEndStep && gameEndStep.winner) {
              const match = activeMatches.get(matchId);
              if (match && !execState.resultRecorded) {
                execState.resultRecorded = true;  // Prevent double-recording on disconnect
                const winner = gameEndStep.winner;
                let saved = true;
                console.log(`[SERVER] Match ${matchId} ended with winner: ${winner}`);
                if (match.gameMode !== 'ffa3') {
                  if (winner === 'draw') {
                    saved = await recordMatchResult(match.p1.playFabId, match.p2.playFabId, true);
                  } else if (winner === 'player1') {
                    saved = await recordMatchResult(match.p1.playFabId, match.p2.playFabId, false);
                  } else if (winner === 'player2') {
                    saved = await recordMatchResult(match.p2.playFabId, match.p1.playFabId, false);
                  }
                } else {
                  saved = await recordFfa3Result(match, winner);
                }
                if (!saved) {
                  execState.resultRecorded = false;
                }
              } else if (execState.resultRecorded) {
                console.log(`[SERVER] Match ${matchId}: Result already recorded, skipping`);
              }
            }
            
            sendNextStepForMatch(matchId);
          } else {
            // Use global execution state for non-match games
            if (isRunningRound || awaitingAck || (stepQueue && stepQueue.length > 0)) {
              console.log(`[SERVER] Ignoring duplicate startRound - isRunningRound=${isRunningRound}, awaitingAck=${awaitingAck}, stepQueue.length=${stepQueue ? stepQueue.length : 0}`);
              return;
            }
            console.log('[SERVER] Starting new round execution (global)');
            isRunningRound = true;
            const result = await processMove(state, action, io, { returnSteps: true });
            gameState = result.state;
            stepQueue = (result.steps || []).map((step) => (step && typeof step === 'object' ? { ...step } : step));
            stepIndex = 0;
            awaitingAck = false;
            pendingMovementStart = { matchId: null };
            sendNextStep();
          }
        } else {
          const nextState = await processMove(state, action, io);
          if (matchId) {
            matchStates.set(matchId, nextState);
            io.to(matchId).emit('gameState', cloneForWire(nextState));
          } else {
            gameState = nextState;
            io.emit('gameState', cloneForWire(gameState));
          }
          if (action && action.type === 'syncBattleState') {
            socket.emit('syncBattleAck', { requestId: action.requestId || null });
          }
        }
      } else {
        socket.emit('error', 'Invalid move');
      }
    } catch (error) {
      console.error('Error processing move:', error);
      socket.emit('error', 'Server error processing move');
    }
  });

  // PlayFab auth
  socket.on('auth', async (payload) => {
    try {
      console.log('[Auth] Session ticket received for', socket.id);
      const ticket = payload && payload.sessionTicket;
      const auth = await verifyPlayFabSession(ticket);
      if (!auth || !auth.UserInfo) {
        socket.emit('authResult', { ok: false });
        return;
      }
      socket.data.playfab = {
        playFabId: auth.UserInfo.PlayFabId,
        username: auth.UserInfo.Username || null
      };
      try {
        bettingModeManager.onAuthenticated(socket);
      } catch (e) {
        console.error('[Betting] onAuthenticated failed:', e);
      }
      socket.emit('authResult', { ok: true, user: socket.data.playfab, serverInstanceId: SERVER_INSTANCE_ID });
    } catch (e) {
      socket.emit('authResult', { ok: false });
    }
  });

  socket.on('getPlayerStats', async (callback) => {
    if (typeof callback !== 'function') return;

    try {
      const playFabId = socket.data?.playfab?.playFabId;
      if (!playFabId) {
        callback({ ok: false, error: 'Not authenticated' });
        return;
      }

      const stats = await getPlayerStatistics(playFabId, ['Wins', 'Losses', 'Draws']);
      if (stats == null) {
        callback({ ok: false, error: 'Could not fetch player stats' });
        return;
      }

      callback({
        ok: true,
        stats: {
          Wins: Number(stats.Wins || 0),
          Losses: Number(stats.Losses || 0),
          Draws: Number(stats.Draws || 0)
        }
      });
    } catch (e) {
      console.error('[PlayFab] Socket stats fetch failed:', e);
      callback({ ok: false, error: 'Could not fetch player stats' });
    }
  });

  socket.on('movementComplete', (payload) => {
    try {
      if (payload && payload.leaguePairKey) {
        const matchId = socket.data && socket.data.matchId ? socket.data.matchId : null;
        if (!matchId) return;
        const state = matchStates.get(matchId);
        const match = activeMatches.get(matchId);
        if (!state || state.gameMode !== 'league4' || !state.league4 || !match) return;
        const side = match?.p1?.id === socket.id ? 'p1'
          : match?.p2?.id === socket.id ? 'p2'
            : match?.p3?.id === socket.id ? 'p3'
              : match?.p4?.id === socket.id ? 'p4'
                : null;
        const playerKey = side ? sideToPlayerKey4(side) : null;
        if (!playerKey) return;
        const pairCtx = getLeaguePairSessionForPlayer(matchId, playerKey, payload.leaguePairKey || null);
        if (!pairCtx || !pairCtx.session) return;
        const { pairKey, session } = pairCtx;
        syncLeaguePairClock(session, Date.now());
        if (payload.p1Main) session.state.p1Main = payload.p1Main;
        if (payload.p2Main) session.state.p2Main = payload.p2Main;
        if (payload.p1Reserve) session.state.p1Reserve = payload.p1Reserve;
        if (payload.p2Reserve) session.state.p2Reserve = payload.p2Reserve;
        if (payload.priorityPlayer) session.state.priorityPlayer = payload.priorityPlayer;
        session.state.phase = 'battle';
        setLeaguePairClockActive(matchId, pairKey, null);
        emitLeaguePairState(matchId, pairKey);
        return;
      }

      const matchId = socket.data && socket.data.matchId ? socket.data.matchId : null;
      const state = matchId && matchStates.has(matchId) ? matchStates.get(matchId) : gameState;
      if (!payload) return;
      if (payload.p1Main) state.p1Main = payload.p1Main;
      if (payload.p2Main) state.p2Main = payload.p2Main;
      if (payload.p3Main) state.p3Main = payload.p3Main;
      if (payload.p1Reserve) state.p1Reserve = payload.p1Reserve;
      if (payload.p2Reserve) state.p2Reserve = payload.p2Reserve;
      if (payload.p3Reserve) state.p3Reserve = payload.p3Reserve;
      if (payload.priorityPlayer) state.priorityPlayer = payload.priorityPlayer;
      state.phase = 'battle';
      if (matchId) {
        matchStates.set(matchId, state);
        io.to(matchId).emit('gameState', cloneForWire(state));
      } else {
        gameState = state;
        io.emit('gameState', cloneForWire(gameState));
      }
    } catch (error) {
      console.error('Error handling movementComplete:', error);
    }
  });

  socket.on('movementMove', (payload) => {
    try {
      if (payload && payload.leaguePairKey) {
        const matchId = socket.data && socket.data.matchId ? socket.data.matchId : null;
        if (!matchId) return;
        const state = matchStates.get(matchId);
        const match = activeMatches.get(matchId);
        if (!state || state.gameMode !== 'league4' || !state.league4 || !match) return;
        const side = match?.p1?.id === socket.id ? 'p1'
          : match?.p2?.id === socket.id ? 'p2'
            : match?.p3?.id === socket.id ? 'p3'
              : match?.p4?.id === socket.id ? 'p4'
                : null;
        const playerKey = side ? sideToPlayerKey4(side) : null;
        if (!playerKey) return;
        const pairCtx = getLeaguePairSessionForPlayer(matchId, playerKey, payload.leaguePairKey || null);
        if (!pairCtx || !pairCtx.session || !pairCtx.session.state?.movementPhase) return;

        const { pairKey, session } = pairCtx;
        const pairState = session.state;
        syncLeaguePairClock(session, Date.now());
        const srcId = payload.sourceId;
        const dstId = payload.targetId;
        if (!srcId || !dstId) return;

        const mp = pairState.movementPhase;
        const mover = mp.sequence[mp.index];

        const findTileById = (tileId) => {
          const findIn = (arr, boardName) => {
            const idx = (arr || []).findIndex(t => t && t.id === tileId);
            if (idx !== -1) return { boardName, index: idx, tile: arr[idx] };
            return null;
          };
          const direct = findIn(pairState.p1Main, 'p1Main') || findIn(pairState.p2Main, 'p2Main') || findIn(pairState.p1Reserve, 'p1Reserve') || findIn(pairState.p2Reserve, 'p2Reserve');
          if (direct) return direct;
          if (typeof tileId !== 'string') return null;

          const parts = tileId.split(':');
          if (parts.length === 2) {
            const [p, i] = parts;
            const idx = parseInt(i, 10);
            if (!Number.isInteger(idx)) return null;
            const plow = p.toLowerCase();
            if (plow === 'p1') return { boardName: 'p1Main', index: idx, tile: (pairState.p1Main || [])[idx] };
            if (plow === 'p2') return { boardName: 'p2Main', index: idx, tile: (pairState.p2Main || [])[idx] };
            if (plow === 'p1reserve') return { boardName: 'p1Reserve', index: idx, tile: (pairState.p1Reserve || [])[idx] };
            if (plow === 'p2reserve') return { boardName: 'p2Reserve', index: idx, tile: (pairState.p2Reserve || [])[idx] };
          }
          const m = tileId.match(/(player1|player2)-(main|reserve)-(\d+)/);
          if (m) {
            const sideKey = m[1] === 'player1' ? 'p1' : 'p2';
            const kind = m[2];
            const idx = parseInt(m[3], 10);
            if (kind === 'main') return { boardName: sideKey === 'p1' ? 'p1Main' : 'p2Main', index: idx, tile: (sideKey === 'p1' ? pairState.p1Main : pairState.p2Main)[idx] };
            return { boardName: sideKey === 'p1' ? 'p1Reserve' : 'p2Reserve', index: idx, tile: (sideKey === 'p1' ? pairState.p1Reserve : pairState.p2Reserve)[idx] };
          }
          return null;
        };

        const src = findTileById(srcId);
        const dst = findTileById(dstId);
        if (!src || !dst) return;

        const srcPlayer = src.boardName.startsWith('p1') ? 'p1' : 'p2';
        const dstPlayer = dst.boardName.startsWith('p1') ? 'p1' : 'p2';
        if (srcPlayer !== mover || dstPlayer !== mover) return;

        const srcIsReserve = src.boardName.includes('Reserve');
        const dstIsMain = dst.boardName.includes('Main');
        if (srcIsReserve && dstIsMain) {
          const countsTowardMainLimit = (tile) => tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true;
          const mainBoard = srcPlayer === 'p1' ? pairState.p1Main : pairState.p2Main;
          const mainAliveCount = (mainBoard || []).filter(countsTowardMainLimit).length;
          const dstHasLivingHero = countsTowardMainLimit(dst.tile);
          if (!dstHasLivingHero && mainAliveCount >= 5) {
            const nextIndex = mp.index + 1;
            if (nextIndex >= mp.sequence.length) {
              pairState.movementPhase = null;
              pairState.phase = 'ready';
              pairState.priorityPlayer = (pairState.priorityPlayer === 'player1' || pairState.priorityPlayer === 'p1') ? 'player2' : 'player1';
            } else {
              pairState.movementPhase = { ...mp, index: nextIndex };
            }
            emitLeaguePairState(matchId, pairKey);
            return;
          }
        }

        const getBoardRef = (name) => {
          if (name === 'p1Main') return pairState.p1Main;
          if (name === 'p2Main') return pairState.p2Main;
          if (name === 'p1Reserve') return pairState.p1Reserve;
          return pairState.p2Reserve;
        };

        const boardA = getBoardRef(src.boardName);
        const boardB = getBoardRef(dst.boardName);
        const sourceTileState = (src.tile && src.tile._tileState) ? src.tile._tileState : null;
        const sourceMineMeta = (src.tile && src.tile._mine) ? { ...src.tile._mine } : null;
        const destinationTileState = (dst.tile && dst.tile._tileState) ? dst.tile._tileState : null;
        const destinationMineMeta = (dst.tile && dst.tile._mine) ? { ...dst.tile._mine } : null;

        const tmp = boardA[src.index];
        boardA[src.index] = boardB[dst.index];
        boardB[dst.index] = tmp;

        if (boardA[src.index]) {
          boardA[src.index]._tileState = sourceTileState;
          boardA[src.index]._mine = sourceMineMeta;
        }
        if (boardB[dst.index]) {
          boardB[dst.index]._tileState = destinationTileState;
          boardB[dst.index]._mine = destinationMineMeta;
        }

        markHeroMovedThisPhase(boardA[src.index]);
        markHeroMovedThisPhase(boardB[dst.index]);

        const nextIndex = mp.index + 1;
        if (nextIndex >= mp.sequence.length) {
          pairState.movementPhase = null;
          pairState.phase = 'ready';
          pairState.priorityPlayer = (pairState.priorityPlayer === 'player1' || pairState.priorityPlayer === 'p1') ? 'player2' : 'player1';
        } else {
          pairState.movementPhase = { ...mp, index: nextIndex };
        }
        setLeaguePairClockActive(matchId, pairKey, getLeaguePairActiveClockPlayer(session));
        emitLeaguePairState(matchId, pairKey);
        return;
      }

      const matchId = socket.data && socket.data.matchId ? socket.data.matchId : null;
      const state = matchId && matchStates.has(matchId) ? matchStates.get(matchId) : gameState;
      if (!payload || !state.movementPhase) return;
      const srcId = payload.sourceId;
      const dstId = payload.targetId;
      if (!srcId || !dstId) return;

      const mp = state.movementPhase;
      const mover = mp.sequence[mp.index];

      const findTileById = (tileId) => {
        const findIn = (arr, boardName) => {
          const idx = (arr || []).findIndex(t => t && t.id === tileId);
          if (idx !== -1) return { boardName, index: idx, tile: arr[idx] };
          return null;
        };
        const direct = findIn(state.p1Main, 'p1Main') || findIn(state.p2Main, 'p2Main') || findIn(state.p3Main, 'p3Main') || findIn(state.p1Reserve, 'p1Reserve') || findIn(state.p2Reserve, 'p2Reserve') || findIn(state.p3Reserve, 'p3Reserve');
        if (direct) return direct;

        if (typeof tileId === 'string') {
          const parts = tileId.split(':');
          if (parts.length === 2) {
            const [p, i] = parts;
            const idx = parseInt(i, 10);
            if (!isNaN(idx)) {
              // Handle p1Reserve:X and p2Reserve:X format
              const plow = p.toLowerCase();
              if (plow === 'p1') return { boardName: 'p1Main', index: idx, tile: (state.p1Main || [])[idx] };
              if (plow === 'p2') return { boardName: 'p2Main', index: idx, tile: (state.p2Main || [])[idx] };
              if (plow === 'p3') return { boardName: 'p3Main', index: idx, tile: (state.p3Main || [])[idx] };
              if (plow === 'p1reserve') return { boardName: 'p1Reserve', index: idx, tile: (state.p1Reserve || [])[idx] };
              if (plow === 'p2reserve') return { boardName: 'p2Reserve', index: idx, tile: (state.p2Reserve || [])[idx] };
              if (plow === 'p3reserve') return { boardName: 'p3Reserve', index: idx, tile: (state.p3Reserve || [])[idx] };
            }
          } else if (parts.length === 3 && parts[1] === 'reserve') {
            const idx = parseInt(parts[2], 10);
            if (!isNaN(idx)) {
              if (parts[0] === 'p1') return { boardName: 'p1Reserve', index: idx, tile: (state.p1Reserve || [])[idx] };
              if (parts[0] === 'p2') return { boardName: 'p2Reserve', index: idx, tile: (state.p2Reserve || [])[idx] };
              if (parts[0] === 'p3') return { boardName: 'p3Reserve', index: idx, tile: (state.p3Reserve || [])[idx] };
            }
          } else if (tileId.includes('player1-main-') || tileId.includes('player2-main-') || tileId.includes('player3-main-') || tileId.includes('player1-reserve-') || tileId.includes('player2-reserve-') || tileId.includes('player3-reserve-')) {
            const m = tileId.match(/(player1|player2|player3)-(main|reserve)-(\d+)/);
            if (m) {
              const side = m[1] === 'player1' ? 'p1' : (m[1] === 'player2' ? 'p2' : 'p3');
              const kind = m[2];
              const idx = parseInt(m[3], 10);
              if (kind === 'main') return { boardName: side === 'p1' ? 'p1Main' : (side === 'p2' ? 'p2Main' : 'p3Main'), index: idx, tile: (side === 'p1' ? state.p1Main : (side === 'p2' ? state.p2Main : state.p3Main))[idx] };
              return { boardName: side === 'p1' ? 'p1Reserve' : (side === 'p2' ? 'p2Reserve' : 'p3Reserve'), index: idx, tile: (side === 'p1' ? state.p1Reserve : (side === 'p2' ? state.p2Reserve : state.p3Reserve))[idx] };
            }
          }
        }
        return null;
      };

      const src = findTileById(srcId);
      const dst = findTileById(dstId);
      if (!src || !dst) {
        console.log('[Server] movementMove: Invalid src/dst', srcId, dstId);
        return;
      }

      // Check if source tile has Shackle effect (preventMovement)
      if (src.tile && src.tile.effects && Array.isArray(src.tile.effects)) {
        const srcHasShackle = src.tile.effects.some(e => e && e.preventMovement);
        if (srcHasShackle) {
          console.log('[Server] movementMove: BLOCKED - source tile is shackled');
          // Don't execute the move, but still advance the phase (treat as skip)
          const nextIndex = mp.index + 1;
          if (nextIndex >= mp.sequence.length) {
            state.movementPhase = null;
            state.phase = 'ready';
            if (state.gameMode === 'ffa3') {
              state.priorityPlayer = getNextPriorityPlayer(state);
            } else {
              state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
            }
            console.log('[Server] Movement complete (shackled move skipped), switching to ready phase');
          } else {
            state.movementPhase = { ...mp, index: nextIndex };
            console.log('[Server] Movement advanced (shackled move skipped) to index', nextIndex);
          }
          if (matchId) {
            matchStates.set(matchId, state);
            io.to(matchId).emit('gameState', cloneForWire(state));
          } else {
            gameState = state;
            io.emit('gameState', cloneForWire(gameState));
          }
          return;
        }
      }

      // Check if destination tile has Shackle effect (preventMovement)
      if (dst.tile && dst.tile.effects && Array.isArray(dst.tile.effects)) {
        const dstHasShackle = dst.tile.effects.some(e => e && e.preventMovement);
        if (dstHasShackle) {
          console.log('[Server] movementMove: BLOCKED - destination tile is shackled');
          // Don't execute the move, but still advance the phase (treat as skip)
          const nextIndex = mp.index + 1;
          if (nextIndex >= mp.sequence.length) {
            state.movementPhase = null;
            state.phase = 'ready';
            if (state.gameMode === 'ffa3') {
              state.priorityPlayer = getNextPriorityPlayer(state);
            } else {
              state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
            }
            console.log('[Server] Movement complete (shackled move skipped), switching to ready phase');
          } else {
            state.movementPhase = { ...mp, index: nextIndex };
            console.log('[Server] Movement advanced (shackled move skipped) to index', nextIndex);
          }
          if (matchId) {
            matchStates.set(matchId, state);
            io.to(matchId).emit('gameState', cloneForWire(state));
          } else {
            gameState = state;
            io.emit('gameState', cloneForWire(gameState));
          }
          return;
        }
      }

      const srcPlayer = src.boardName.startsWith('p1') ? 'p1' : (src.boardName.startsWith('p2') ? 'p2' : 'p3');
      const dstPlayer = dst.boardName.startsWith('p1') ? 'p1' : (dst.boardName.startsWith('p2') ? 'p2' : 'p3');
      if (srcPlayer !== mover || dstPlayer !== mover) {
        console.log('[Server] movementMove: Wrong side move/swap attempt', srcPlayer, dstPlayer, 'vs', mover);
        return;
      }

      // Validate: moving from reserve to main should not exceed 5 heroes
      const srcIsReserve = src.boardName.includes('Reserve');
      const dstIsMain = dst.boardName.includes('Main');
      if (srcIsReserve && dstIsMain) {
        const countsTowardMainLimit = (tile) => tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true;
        const mainBoard = srcPlayer === 'p1' ? state.p1Main : (srcPlayer === 'p2' ? state.p2Main : state.p3Main);
        const mainAliveCount = (mainBoard || []).filter(countsTowardMainLimit).length;
        const dstTile = dst.tile;
        const dstHasLivingHero = countsTowardMainLimit(dstTile);
        
        // If destination doesn't have a living hero, we're adding one
        if (!dstHasLivingHero && mainAliveCount >= 5) {
          console.log('[Server] movementMove: BLOCKED - would exceed 5 heroes. mainAlive=' + mainAliveCount);
          // Don't execute the move, but still advance the phase (treat as skip)
          const nextIndex = mp.index + 1;
          if (nextIndex >= mp.sequence.length) {
            state.movementPhase = null;
            state.phase = 'ready';
            if (state.gameMode === 'ffa3') {
              state.priorityPlayer = getNextPriorityPlayer(state);
            } else {
              state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
            }
            console.log('[Server] Movement complete (blocked move skipped), switching to ready phase');
          } else {
            state.movementPhase = { ...mp, index: nextIndex };
            console.log('[Server] Movement advanced (blocked move skipped) to index', nextIndex);
          }
          if (matchId) {
            matchStates.set(matchId, state);
            io.to(matchId).emit('gameState', cloneForWire(state));
          } else {
            gameState = state;
            io.emit('gameState', cloneForWire(gameState));
          }
          return;
        }
      }

      const getBoardRef = (name) => {
        if (name === 'p1Main') return state.p1Main;
        if (name === 'p2Main') return state.p2Main;
        if (name === 'p3Main') return state.p3Main;
        if (name === 'p1Reserve') return state.p1Reserve;
        if (name === 'p2Reserve') return state.p2Reserve;
        return state.p3Reserve;
      };

      const boardA = getBoardRef(src.boardName);
      const boardB = getBoardRef(dst.boardName);

      const sourceTileState = (src.tile && src.tile._tileState) ? src.tile._tileState : null;
      const sourceMineMeta = (src.tile && src.tile._mine) ? { ...src.tile._mine } : null;
      const destinationTileState = (dst.tile && dst.tile._tileState) ? dst.tile._tileState : null;
      const destinationMineMeta = (dst.tile && dst.tile._mine) ? { ...dst.tile._mine } : null;

      const tmp = boardA[src.index];
      boardA[src.index] = boardB[dst.index];
      boardB[dst.index] = tmp;

      if (boardA[src.index]) {
        boardA[src.index]._tileState = sourceTileState;
        boardA[src.index]._mine = sourceMineMeta;
      }
      if (boardB[dst.index]) {
        boardB[dst.index]._tileState = destinationTileState;
        boardB[dst.index]._mine = destinationMineMeta;
      }

      markHeroMovedThisPhase(boardA[src.index]);
      markHeroMovedThisPhase(boardB[dst.index]);

      const nextIndex = mp.index + 1;
      if (nextIndex >= mp.sequence.length) {
        // Movement complete - transition to ready phase
        state.movementPhase = null;
        state.phase = 'ready';
        if (state.gameMode === 'ffa3') {
          state.priorityPlayer = getNextPriorityPlayer(state);
        } else {
          state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
        }
        console.log('[Server] Movement complete, switching to ready phase, new priority:', state.priorityPlayer);
      } else {
        state.movementPhase = { ...mp, index: nextIndex };
        console.log('[Server] Movement advanced to index', nextIndex, 'next mover:', mp.sequence[nextIndex]);
      }
      if (matchId) {
        matchStates.set(matchId, state);
        io.to(matchId).emit('gameState', cloneForWire(state));
      } else {
        gameState = state;
        io.emit('gameState', cloneForWire(gameState));
      }
    } catch (error) {
      console.error('Error handling movementMove:', error);
    }
  });

  socket.on('stepAck', (payload) => {
    if (payload && payload.leaguePairKey) {
      const matchId = socket.data && socket.data.matchId ? socket.data.matchId : null;
      if (!matchId) return;
      const state = matchStates.get(matchId);
      const match = activeMatches.get(matchId);
      if (!state || state.gameMode !== 'league4' || !state.league4 || !match) return;
      const side = match?.p1?.id === socket.id ? 'p1'
        : match?.p2?.id === socket.id ? 'p2'
          : match?.p3?.id === socket.id ? 'p3'
            : match?.p4?.id === socket.id ? 'p4'
              : null;
      const playerKey = side ? sideToPlayerKey4(side) : null;
      if (!playerKey) return;
      const pairCtx = getLeaguePairSessionForPlayer(matchId, playerKey, payload.leaguePairKey || null);
      if (!pairCtx || !pairCtx.session) return;
      const { pairKey, session } = pairCtx;
      if (!session.awaitingAck || !session.stepQueue.length) return;
      const current = session.stepQueue[session.stepIndex];
      const seq = payload && typeof payload.seq === 'number' ? payload.seq : null;
      if (!current || (seq != null && seq !== current.seq)) return;
      clearLeaguePairStepTimeout(matchId, pairKey);
      session.awaitingAck = false;
      session.stepIndex += 1;
      sendNextStepForLeaguePair(matchId, pairKey);
      return;
    }

    const matchId = socket.data && socket.data.matchId ? socket.data.matchId : null;
    
    if (matchId) {
      // Match-specific step ack
      const execState = getMatchExecState(matchId);
      if (!execState.awaitingAck || !execState.stepQueue.length) return;
      const current = execState.stepQueue[execState.stepIndex];
      const seq = payload && typeof payload.seq === 'number' ? payload.seq : null;
      if (!current || (seq != null && seq !== current.seq)) return;
      clearMatchStepTimeout(matchId);
      execState.awaitingAck = false;
      execState.stepIndex += 1;
      sendNextStepForMatch(matchId);
    } else {
      // Global step ack for non-match games
      if (!awaitingAck || !stepQueue.length) return;
      const current = stepQueue[stepIndex];
      const seq = payload && typeof payload.seq === 'number' ? payload.seq : null;
      if (!current || (seq != null && seq !== current.seq)) return;
      clearStepTimeout();
      awaitingAck = false;
      stepIndex += 1;
      sendNextStep();
    }
  });

  // Handle game reset
  socket.on('resetGame', (payload = null) => {
    console.log('Resetting game state');
    const gameMode = payload && payload.gameMode ? payload.gameMode : 'classic';
    const isFfa3 = gameMode === 'ffa3';
    const availableHeroes = isFfa3
      ? sampleHeroes(DRAFTABLE_HEROES, FFA3_DRAFT_POOL_SIZE)
      : sampleHeroes(DRAFTABLE_HEROES, CLASSIC_DRAFT_POOL_SIZE);
    gameState = {
      p1Main: makeEmptyMain('player1'),
      p1Reserve: makeReserve('player1'),
      p2Main: makeEmptyMain('player2'),
      p2Reserve: makeReserve('player2'),
      ...(isFfa3 ? { p3Main: makeEmptyMain('player3'), p3Reserve: makeReserve('player3') } : {}),
      availableHeroes,
      bans: [],
      step: 0,
      roundNumber: 0,
      phase: 'draft',
      gameMode
    };
    stepQueue = [];
    stepIndex = 0;
    awaitingAck = false;
    isRunningRound = false;
    pendingMovementStart = null;
    clearStepTimeout();
    io.emit('gameState', cloneForWire(gameState)); // Broadcast reset state to all players
  });

  // Handle test state setup
  socket.on('setTestState', (testState) => {
    try {
      console.log('Setting test game state');
      gameState = testState || gameState;
      if (!gameState.phase) gameState.phase = 'battle';
      if (!gameState.priorityPlayer) gameState.priorityPlayer = 'player1';
      // Reset round/step state so test battles can start immediately
      stepQueue = [];
      stepIndex = 0;
      awaitingAck = false;
      isRunningRound = false;
      pendingMovementStart = null;
      clearStepTimeout();
      if (gameState.movementPhase) delete gameState.movementPhase;
      io.emit('gameState', cloneForWire(gameState)); // Use cloneForWire to handle circular refs
    } catch (error) {
      console.error('Error setting test state:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('Player disconnected:', socket.id);
    bettingModeManager.onDisconnect(socket);
    // Remove from queue if present
    const queuedMode = socket.data?.queueMode ? normalizeGameMode(socket.data.queueMode) : null;
    removeFromQueues(socket.id);
    if (queuedMode) emitQueuePositions(queuedMode);
    // Clean up match mapping and execution state
    if (socket.data && socket.data.matchId) {
      const matchId = socket.data.matchId;
      const match = activeMatches.get(matchId);
      const execState = matchExecutionState.has(matchId) ? matchExecutionState.get(matchId) : null;

      if (match && match.gameMode === 'league4') {
        const slots = ['p1', 'p2', 'p3', 'p4'];
        const disconnectedSlot = slots.find((k) => match[k] && match[k].id === socket.id) || null;
        if (disconnectedSlot && match[disconnectedSlot]) {
          match[disconnectedSlot] = {
            ...match[disconnectedSlot],
            id: null,
            bot: true,
            username: `${match[disconnectedSlot].username || disconnectedSlot.toUpperCase()} (Bot)`
          };
          activeMatches.set(matchId, match);
          io.to(matchId).emit('leaguePlayerBot', { matchId, side: disconnectedSlot });
          emitLeague4State(matchId);
        }
        const allBotOrEmpty = slots.every((k) => !match[k] || !match[k].id);
        if (allBotOrEmpty) {
          clearLeaguePhaseTimer(matchId);
          clearLeaguePairSessionStore(matchId);
          activeMatches.delete(matchId);
          matchStates.delete(matchId);
          console.log(`[Matchmaking] League4 ${matchId}: cleaned up (all players left)`);
        }
        console.log(`[Matchmaking] League4 ${matchId}: player converted to bot on disconnect`);
        return;
      }
      
      // Notify the other player that opponent disconnected
      if (match) {
        const otherPlayers = [];
        if (match.p1 && match.p1.id !== socket.id) otherPlayers.push(match.p1);
        if (match.p2 && match.p2.id !== socket.id) otherPlayers.push(match.p2);
        if (match.p3 && match.p3.id !== socket.id) otherPlayers.push(match.p3);
        if (match.p4 && match.p4.id !== socket.id) otherPlayers.push(match.p4);

        // Only record disconnect as win for classic matches
        if (!execState || !execState.resultRecorded) {
          const departureResult = getClassicMatchDepartureResult(match, socket.id);
          if (departureResult && otherPlayers.length === 1) {
            console.log(`[SERVER] Match ${matchId} - player disconnected, recording win for opponent`);
            if (execState) execState.resultRecorded = true;
            const saved = await recordMatchResult(departureResult.winnerPlayFabId, departureResult.loserPlayFabId, false);
            if (!saved && execState) execState.resultRecorded = false;
          } else {
            console.log(`[SERVER] Match ${matchId} - player disconnected, skipping result record for non-classic match`);
          }
        } else {
          console.log(`[SERVER] Match ${matchId} - player disconnected, but result already recorded (game ended normally)`);
        }

        otherPlayers.forEach((player) => {
          const otherSocket = io.sockets.sockets.get(player.id);
          if (otherSocket) {
            otherSocket.emit('opponentDisconnected', { matchId });
            otherSocket.data.matchId = null;
            otherSocket.leave(matchId);
          }
        });
      }
      
      // Clean up match resources
      activeMatches.delete(matchId);
      matchStates.delete(matchId);
      clearLeaguePairSessionStore(matchId);
      
      // Clean up execution state and clear any pending timeouts
      if (matchExecutionState.has(matchId)) {
        clearMatchStepTimeout(matchId);
        matchExecutionState.delete(matchId);
      }
      
      console.log(`[Matchmaking] Match ${matchId} cleaned up due to disconnect`);
    }
  });

  // Matchmaking
  socket.on('findMatch', (payload = {}) => {
    const gameMode = normalizeGameMode(payload.gameMode || payload.mode);
    console.log('[Matchmaking] findMatch', socket.id, socket.data?.playfab?.playFabId || 'no-auth', 'mode', gameMode);
    if (!socket.data || !socket.data.playfab) {
      socket.emit('matchError', { message: 'Not authenticated' });
      return;
    }
    clearStaleMatchForSocket(socket, 'find-match');
    if (socket.data.matchId) {
      socket.emit('matchError', { message: 'Already in match' });
      return;
    }
    const playFabId = getSocketPlayFabId(socket);
    const removedOtherQueuedSockets = removeQueuedSocketsForPlayFabId(playFabId, socket.id);
    const queue = getMatchQueue(gameMode);
    socket.data.queueMode = gameMode;
    removeFromQueues(socket.id);
    if (!queue.includes(socket.id)) queue.push(socket.id);
    if (removedOtherQueuedSockets) {
      Object.keys(matchQueues).forEach((mode) => emitQueuePositions(normalizeGameMode(mode)));
    }
    emitQueuePositions(gameMode);
    console.log('[Matchmaking] Queued', socket.id, 'mode', gameMode);
    startQueuedMatchIfReady(gameMode);
  });

  socket.on('cancelMatch', () => {
    const mode = socket.data?.queueMode ? normalizeGameMode(socket.data.queueMode) : null;
    removeFromQueues(socket.id);
    if (mode) emitQueuePositions(mode);
    socket.emit('matchCanceled');
  });

  // Leave an active match gracefully
  socket.on('leaveMatch', async () => {
    if (!socket.data || !socket.data.matchId) {
      socket.emit('leaveMatchResult', { ok: false, message: 'Not in a match' });
      return;
    }
    
    const matchId = socket.data.matchId;
    const match = activeMatches.get(matchId);
    const execState = matchExecutionState.has(matchId) ? matchExecutionState.get(matchId) : null;
    
    console.log(`[Matchmaking] Player ${socket.id} leaving match ${matchId}`);
    
    // Notify the other player
    if (match) {
      if (match.gameMode === 'league4') {
        const slots = ['p1', 'p2', 'p3', 'p4'];
        const leavingSlot = slots.find((k) => match[k] && match[k].id === socket.id) || null;
        if (leavingSlot && match[leavingSlot]) {
          match[leavingSlot] = {
            ...match[leavingSlot],
            id: null,
            bot: true,
            username: `${match[leavingSlot].username || leavingSlot.toUpperCase()} (Bot)`
          };
          activeMatches.set(matchId, match);
          socket.leave(matchId);
          socket.data.matchId = null;
          socket.emit('leaveMatchResult', { ok: true, convertedToBot: true });
          emitLeague4State(matchId);
          const allBotOrEmpty = slots.every((k) => !match[k] || !match[k].id);
          if (allBotOrEmpty) {
            clearLeaguePhaseTimer(matchId);
            clearLeaguePairSessionStore(matchId);
            activeMatches.delete(matchId);
            matchStates.delete(matchId);
          }
          return;
        }
      }

      const otherPlayers = [];
      if (match.p1 && match.p1.id !== socket.id) otherPlayers.push(match.p1);
      if (match.p2 && match.p2.id !== socket.id) otherPlayers.push(match.p2);
      if (match.p3 && match.p3.id !== socket.id) otherPlayers.push(match.p3);
      if (match.p4 && match.p4.id !== socket.id) otherPlayers.push(match.p4);

      if (!execState || !execState.resultRecorded) {
        const departureResult = getClassicMatchDepartureResult(match, socket.id);
        if (departureResult && otherPlayers.length === 1) {
          console.log(`[SERVER] Match ${matchId} - player left, recording win for opponent`);
          if (execState) execState.resultRecorded = true;
          const saved = await recordMatchResult(departureResult.winnerPlayFabId, departureResult.loserPlayFabId, false);
          if (!saved && execState) execState.resultRecorded = false;
        } else {
          console.log(`[SERVER] Match ${matchId} - player left, skipping result record for non-classic match`);
        }
      } else {
        console.log(`[SERVER] Match ${matchId} - player left after result already recorded`);
      }

      otherPlayers.forEach((player) => {
        const otherSocket = io.sockets.sockets.get(player.id);
        if (otherSocket) {
          otherSocket.emit('opponentLeft', { matchId });
          otherSocket.data.matchId = null;
          otherSocket.leave(matchId);
        }
      });
    }
    
    // Clean up
    socket.leave(matchId);
    socket.data.matchId = null;
    activeMatches.delete(matchId);
    matchStates.delete(matchId);
    clearLeaguePairSessionStore(matchId);
    
    if (matchExecutionState.has(matchId)) {
      clearMatchStepTimeout(matchId);
      matchExecutionState.delete(matchId);
    }
    
    socket.emit('leaveMatchResult', { ok: true });
    console.log(`[Matchmaking] Match ${matchId} ended - player left`);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});