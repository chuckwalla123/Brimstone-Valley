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

const PLAYFAB_TITLE_ID = process.env.PLAYFAB_TITLE_ID || '';
const PLAYFAB_SECRET_KEY = process.env.PLAYFAB_SECRET_KEY || '';

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

// Record match result - update wins/losses for both players
const recordMatchResult = async (winnerPlayFabId, loserPlayFabId, isDraw = false) => {
  if (isDraw) {
    // Both players get a draw
    await updatePlayerStatistics(winnerPlayFabId, [{ StatisticName: 'Draws', Value: 1 }]);
    await updatePlayerStatistics(loserPlayFabId, [{ StatisticName: 'Draws', Value: 1 }]);
    console.log('[PlayFab] Draw recorded for', winnerPlayFabId, loserPlayFabId);
  } else {
    // Winner gets a win, loser gets a loss
    await updatePlayerStatistics(winnerPlayFabId, [{ StatisticName: 'Wins', Value: 1 }]);
    await updatePlayerStatistics(loserPlayFabId, [{ StatisticName: 'Losses', Value: 1 }]);
    console.log('[PlayFab] Win recorded for', winnerPlayFabId, ', loss for', loserPlayFabId);
  }
};

const recordFfa3Result = async (match, winnerKey) => {
  if (!match) return;
  const p1Id = match.p1 && match.p1.playFabId ? match.p1.playFabId : null;
  const p2Id = match.p2 && match.p2.playFabId ? match.p2.playFabId : null;
  const p3Id = match.p3 && match.p3.playFabId ? match.p3.playFabId : null;
  const playerIds = [p1Id, p2Id, p3Id].filter(Boolean);
  if (playerIds.length === 0) return;

  if (winnerKey === 'draw') {
    await Promise.all(playerIds.map((id) => updatePlayerStatistics(id, [{ StatisticName: 'Draws', Value: 1 }])));
    console.log('[PlayFab] FFA3 draw recorded for', playerIds.join(', '));
    return;
  }

  const winnerId = winnerKey === 'player1' ? p1Id : (winnerKey === 'player2' ? p2Id : p3Id);
  const loserIds = playerIds.filter((id) => id && id !== winnerId);
  if (!winnerId) return;

  await updatePlayerStatistics(winnerId, [{ StatisticName: 'Wins', Value: 1 }]);
  await Promise.all(loserIds.map((id) => updatePlayerStatistics(id, [{ StatisticName: 'Losses', Value: 1 }])));
  console.log('[PlayFab] FFA3 win recorded for', winnerId, ', losses for', loserIds.join(', '));
};

const app = express();
app.use(cors()); // Allow client connections
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000
}); // WebSockets for real-time

const isDraftableHero = (hero) => hero && hero.draftable !== false;
const DRAFTABLE_HEROES = HEROES.filter(isDraftableHero);

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
  availableHeroes: DRAFTABLE_HEROES,
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
  ffa3: []
};
const activeMatches = new Map();
const matchStates = new Map();
const normalizeGameMode = (mode) => (mode === 'ffa3' ? 'ffa3' : 'classic');
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
  io.to(matchId).emit('step', cloneForWire({ ...step, matchId }));
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
  io.emit('step', cloneForWire(step));
  startStepTimeout();
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

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
                console.log(`[SERVER] Match ${matchId} ended with winner: ${winner}`);
                if (match.gameMode !== 'ffa3') {
                  if (winner === 'draw') {
                    recordMatchResult(match.p1.playFabId, match.p2.playFabId, true);
                  } else if (winner === 'player1') {
                    recordMatchResult(match.p1.playFabId, match.p2.playFabId, false);
                  } else if (winner === 'player2') {
                    recordMatchResult(match.p2.playFabId, match.p1.playFabId, false);
                  }
                } else {
                  recordFfa3Result(match, winner);
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
      socket.emit('authResult', { ok: true, user: socket.data.playfab });
    } catch (e) {
      socket.emit('authResult', { ok: false });
    }
  });

  socket.on('movementComplete', (payload) => {
    try {
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
      if (srcPlayer !== mover) {
        console.log('[Server] movementMove: Wrong player trying to move', srcPlayer, 'vs', mover);
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
      const tmp = boardA[src.index];
      boardA[src.index] = boardB[dst.index];
      boardB[dst.index] = tmp;

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
    const availableHeroes = isFfa3 ? sampleHeroes(DRAFTABLE_HEROES, 26) : DRAFTABLE_HEROES;
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

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    // Remove from queue if present
    removeFromQueues(socket.id);
    // Clean up match mapping and execution state
    if (socket.data && socket.data.matchId) {
      const matchId = socket.data.matchId;
      const match = activeMatches.get(matchId);
      const execState = matchExecutionState.has(matchId) ? matchExecutionState.get(matchId) : null;
      
      // Notify the other player that opponent disconnected
      if (match) {
        const otherPlayers = [];
        if (match.p1 && match.p1.id !== socket.id) otherPlayers.push(match.p1);
        if (match.p2 && match.p2.id !== socket.id) otherPlayers.push(match.p2);
        if (match.p3 && match.p3.id !== socket.id) otherPlayers.push(match.p3);

        // Only record disconnect as win for classic matches
        if (!execState || !execState.resultRecorded) {
          if (match.gameMode !== 'ffa3' && otherPlayers.length === 1) {
            const winnerPlayFabId = otherPlayers[0].playFabId;
            const loserPlayFabId = match.p1.id === socket.id ? match.p1.playFabId : match.p2.playFabId;
            console.log(`[SERVER] Match ${matchId} - player disconnected, recording win for opponent`);
            recordMatchResult(winnerPlayFabId, loserPlayFabId, false);
          } else {
            console.log(`[SERVER] Match ${matchId} - player disconnected, skipping result record for ffa3`);
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
    if (socket.data.matchId) {
      socket.emit('matchError', { message: 'Already in match' });
      return;
    }
    const queue = getMatchQueue(gameMode);
    socket.data.queueMode = gameMode;
    if (queue.includes(socket.id)) return;

    const requiredPlayers = gameMode === 'ffa3' ? 3 : 2;
    const opponents = [];

    const pullNextValid = () => {
      while (queue.length > 0) {
        const id = queue.shift();
        const s = io.sockets.sockets.get(id);
        if (s && s.data && s.data.playfab && !s.data.matchId) return s;
      }
      return null;
    };

    for (let i = 0; i < requiredPlayers - 1; i += 1) {
      const s = pullNextValid();
      if (!s) break;
      opponents.push(s);
    }

    if (opponents.length < requiredPlayers - 1) {
      opponents.forEach((s) => queue.push(s.id));
      queue.push(socket.id);
      socket.emit('matchQueued', { position: queue.length, gameMode });
      console.log('[Matchmaking] Queued', socket.id, 'position', queue.length, 'mode', gameMode);
      return;
    }

    const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const p1 = { id: socket.id, playFabId: socket.data.playfab.playFabId, username: socket.data.playfab.username };
    const p2 = { id: opponents[0].id, playFabId: opponents[0].data.playfab.playFabId, username: opponents[0].data.playfab.username };
    const p3 = gameMode === 'ffa3' ? { id: opponents[1].id, playFabId: opponents[1].data.playfab.playFabId, username: opponents[1].data.playfab.username } : null;

    activeMatches.set(matchId, { p1, p2, p3, gameMode, createdAt: Date.now() });
    socket.data.matchId = matchId;
    opponents.forEach((s) => { s.data.matchId = matchId; });
    socket.join(matchId);
    opponents.forEach((s) => s.join(matchId));

    const baseState = {
      p1Main: makeEmptyMain('player1'),
      p1Reserve: makeReserve('player1'),
      p2Main: makeEmptyMain('player2'),
      p2Reserve: makeReserve('player2'),
      ...(gameMode === 'ffa3' ? { p3Main: makeEmptyMain('player3'), p3Reserve: makeReserve('player3') } : {}),
      availableHeroes: gameMode === 'ffa3' ? sampleHeroes(DRAFTABLE_HEROES, 26) : DRAFTABLE_HEROES,
      bans: [],
      step: 0,
      roundNumber: 0,
      phase: 'draft',
      gameMode
    };

    matchStates.set(matchId, baseState);
    io.to(matchId).emit('gameState', cloneForWire(matchStates.get(matchId)));

    const playersPayload = {
      p1: p1.username || 'Player 1',
      p2: p2.username || 'Player 2',
      ...(p3 ? { p3: p3.username || 'Player 3' } : {})
    };

    socket.emit('matchFound', { matchId, side: 'p1', gameMode, players: playersPayload, opponent: { playFabId: p2.playFabId, username: p2.username } });
    opponents[0].emit('matchFound', { matchId, side: 'p2', gameMode, players: playersPayload, opponent: { playFabId: p1.playFabId, username: p1.username } });
    if (p3) {
      opponents[1].emit('matchFound', { matchId, side: 'p3', gameMode, players: playersPayload, opponent: { playFabId: p1.playFabId, username: p1.username } });
    }
    console.log('[Matchmaking] Match found', matchId, p1.playFabId, p2.playFabId, p3 ? p3.playFabId : null, 'mode', gameMode);
  });

  socket.on('cancelMatch', () => {
    removeFromQueues(socket.id);
    socket.emit('matchCanceled');
  });

  // Leave an active match gracefully
  socket.on('leaveMatch', () => {
    if (!socket.data || !socket.data.matchId) {
      socket.emit('leaveMatchResult', { ok: false, message: 'Not in a match' });
      return;
    }
    
    const matchId = socket.data.matchId;
    const match = activeMatches.get(matchId);
    
    console.log(`[Matchmaking] Player ${socket.id} leaving match ${matchId}`);
    
    // Notify the other player
    if (match) {
      const otherPlayers = [];
      if (match.p1 && match.p1.id !== socket.id) otherPlayers.push(match.p1);
      if (match.p2 && match.p2.id !== socket.id) otherPlayers.push(match.p2);
      if (match.p3 && match.p3.id !== socket.id) otherPlayers.push(match.p3);

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