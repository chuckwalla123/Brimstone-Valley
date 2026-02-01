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

const app = express();
app.use(cors()); // Allow client connections
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000
}); // WebSockets for real-time

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
  availableHeroes: HEROES,
  bans: [],
  step: 0,
  roundNumber: 0,
  phase: 'draft' // or 'battle'
};

// Global step queue for non-match games only
let stepQueue = [];
let stepIndex = 0;
let awaitingAck = false;
let stepTimeout = null;
let isRunningRound = false;
let pendingMovementStart = null;

// Matchmaking
let matchQueue = [];
const activeMatches = new Map();
const matchStates = new Map();

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

const startMovementPhase = (state, matchId = null) => {
  const prioShort = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'p1' : 'p2';
  const other = prioShort === 'p1' ? 'p2' : 'p1';
  const sequence = prioShort === 'p1' ? ['p1', 'p2', 'p2', 'p1'] : ['p2', 'p1', 'p1', 'p2'];
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
                if (winner === 'draw') {
                  recordMatchResult(match.p1.playFabId, match.p2.playFabId, true);
                } else if (winner === 'player1') {
                  recordMatchResult(match.p1.playFabId, match.p2.playFabId, false);
                } else if (winner === 'player2') {
                  recordMatchResult(match.p2.playFabId, match.p1.playFabId, false);
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
      if (payload.p1Reserve) state.p1Reserve = payload.p1Reserve;
      if (payload.p2Reserve) state.p2Reserve = payload.p2Reserve;
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
        const direct = findIn(state.p1Main, 'p1Main') || findIn(state.p2Main, 'p2Main') || findIn(state.p1Reserve, 'p1Reserve') || findIn(state.p2Reserve, 'p2Reserve');
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
              if (plow === 'p1reserve') return { boardName: 'p1Reserve', index: idx, tile: (state.p1Reserve || [])[idx] };
              if (plow === 'p2reserve') return { boardName: 'p2Reserve', index: idx, tile: (state.p2Reserve || [])[idx] };
            }
          } else if (parts.length === 3 && parts[1] === 'reserve') {
            const idx = parseInt(parts[2], 10);
            if (!isNaN(idx)) {
              if (parts[0] === 'p1') return { boardName: 'p1Reserve', index: idx, tile: (state.p1Reserve || [])[idx] };
              if (parts[0] === 'p2') return { boardName: 'p2Reserve', index: idx, tile: (state.p2Reserve || [])[idx] };
            }
          } else if (tileId.includes('player1-main-') || tileId.includes('player2-main-') || tileId.includes('player1-reserve-') || tileId.includes('player2-reserve-')) {
            const m = tileId.match(/(player1|player2)-(main|reserve)-(\d+)/);
            if (m) {
              const side = m[1] === 'player1' ? 'p1' : 'p2';
              const kind = m[2];
              const idx = parseInt(m[3], 10);
              if (kind === 'main') return { boardName: side === 'p1' ? 'p1Main' : 'p2Main', index: idx, tile: (side === 'p1' ? state.p1Main : state.p2Main)[idx] };
              return { boardName: side === 'p1' ? 'p1Reserve' : 'p2Reserve', index: idx, tile: (side === 'p1' ? state.p1Reserve : state.p2Reserve)[idx] };
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
            state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
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
            state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
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

      const srcPlayer = src.boardName.startsWith('p1') ? 'p1' : 'p2';
      if (srcPlayer !== mover) {
        console.log('[Server] movementMove: Wrong player trying to move', srcPlayer, 'vs', mover);
        return;
      }

      // Validate: moving from reserve to main should not exceed 5 heroes
      const srcIsReserve = src.boardName.includes('Reserve');
      const dstIsMain = dst.boardName.includes('Main');
      if (srcIsReserve && dstIsMain) {
        const mainBoard = srcPlayer === 'p1' ? state.p1Main : state.p2Main;
        const mainAliveCount = (mainBoard || []).filter(t => t && t.hero && !t._dead).length;
        const dstTile = dst.tile;
        const dstHasLivingHero = dstTile && dstTile.hero && !dstTile._dead;
        
        // If destination doesn't have a living hero, we're adding one
        if (!dstHasLivingHero && mainAliveCount >= 5) {
          console.log('[Server] movementMove: BLOCKED - would exceed 5 heroes. mainAlive=' + mainAliveCount);
          // Don't execute the move, but still advance the phase (treat as skip)
          const nextIndex = mp.index + 1;
          if (nextIndex >= mp.sequence.length) {
            state.movementPhase = null;
            state.phase = 'ready';
            state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
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
        if (name === 'p1Reserve') return state.p1Reserve;
        return state.p2Reserve;
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
        state.priorityPlayer = (state.priorityPlayer === 'player1' || state.priorityPlayer === 'p1') ? 'player2' : 'player1';
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
  socket.on('resetGame', () => {
    console.log('Resetting game state');
    gameState = {
      p1Main: makeEmptyMain('player1'),
      p1Reserve: makeReserve('player1'),
      p2Main: makeEmptyMain('player2'),
      p2Reserve: makeReserve('player2'),
      availableHeroes: HEROES,
      bans: [],
      step: 0,
      roundNumber: 0,
      phase: 'draft'
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
    matchQueue = matchQueue.filter(id => id !== socket.id);
    // Clean up match mapping and execution state
    if (socket.data && socket.data.matchId) {
      const matchId = socket.data.matchId;
      const match = activeMatches.get(matchId);
      const execState = matchExecutionState.has(matchId) ? matchExecutionState.get(matchId) : null;
      
      // Notify the other player that opponent disconnected
      if (match) {
        const disconnectedPlayerId = socket.id;
        const otherPlayerId = match.p1.id === socket.id ? match.p2.id : match.p1.id;
        const otherSocket = io.sockets.sockets.get(otherPlayerId);
        
        // Only record disconnect as win if game result wasn't already recorded
        if (!execState || !execState.resultRecorded) {
          const winnerPlayFabId = match.p1.id === socket.id ? match.p2.playFabId : match.p1.playFabId;
          const loserPlayFabId = match.p1.id === socket.id ? match.p1.playFabId : match.p2.playFabId;
          console.log(`[SERVER] Match ${matchId} - player disconnected, recording win for opponent`);
          recordMatchResult(winnerPlayFabId, loserPlayFabId, false);
        } else {
          console.log(`[SERVER] Match ${matchId} - player disconnected, but result already recorded (game ended normally)`);
        }
        
        if (otherSocket) {
          otherSocket.emit('opponentDisconnected', { matchId });
          // Remove the other player from the match too
          otherSocket.data.matchId = null;
          otherSocket.leave(matchId);
        }
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
  socket.on('findMatch', () => {
    console.log('[Matchmaking] findMatch', socket.id, socket.data?.playfab?.playFabId || 'no-auth');
    if (!socket.data || !socket.data.playfab) {
      socket.emit('matchError', { message: 'Not authenticated' });
      return;
    }
    if (socket.data.matchId) {
      socket.emit('matchError', { message: 'Already in match' });
      return;
    }
    if (matchQueue.includes(socket.id)) return;

    if (matchQueue.length > 0) {
      const opponentId = matchQueue.shift();
      const opponent = io.sockets.sockets.get(opponentId);
      if (!opponent || !opponent.data || !opponent.data.playfab) {
        // Opponent not available, requeue this socket
        matchQueue = matchQueue.filter(id => id !== opponentId);
        matchQueue.push(socket.id);
        socket.emit('matchQueued', { position: matchQueue.length });
        return;
      }
      const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const p1 = { id: socket.id, playFabId: socket.data.playfab.playFabId, username: socket.data.playfab.username };
      const p2 = { id: opponent.id, playFabId: opponent.data.playfab.playFabId, username: opponent.data.playfab.username };
      activeMatches.set(matchId, { p1, p2, createdAt: Date.now() });
      socket.data.matchId = matchId;
      opponent.data.matchId = matchId;
      socket.join(matchId);
      opponent.join(matchId);
      matchStates.set(matchId, {
        p1Main: makeEmptyMain('player1'),
        p1Reserve: makeReserve('player1'),
        p2Main: makeEmptyMain('player2'),
        p2Reserve: makeReserve('player2'),
        availableHeroes: HEROES,
        bans: [],
        step: 0,
        roundNumber: 0,
        phase: 'draft'
      });
      io.to(matchId).emit('gameState', cloneForWire(matchStates.get(matchId)));
      socket.emit('matchFound', { matchId, side: 'p1', opponent: { playFabId: p2.playFabId, username: p2.username } });
      opponent.emit('matchFound', { matchId, side: 'p2', opponent: { playFabId: p1.playFabId, username: p1.username } });
      console.log('[Matchmaking] Match found', matchId, p1.playFabId, p2.playFabId);
    } else {
      matchQueue.push(socket.id);
      socket.emit('matchQueued', { position: matchQueue.length });
      console.log('[Matchmaking] Queued', socket.id, 'position', matchQueue.length);
    }
  });

  socket.on('cancelMatch', () => {
    matchQueue = matchQueue.filter(id => id !== socket.id);
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
      const otherPlayerId = match.p1.id === socket.id ? match.p2.id : match.p1.id;
      const otherSocket = io.sockets.sockets.get(otherPlayerId);
      if (otherSocket) {
        otherSocket.emit('opponentLeft', { matchId });
        otherSocket.data.matchId = null;
        otherSocket.leave(matchId);
      }
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