/**
 * LocalGameEngine - Offline game engine that mimics server socket behavior
 * Allows playing vs AI or local multiplayer without server connection
 */

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

import { processMove, makeEmptyMain, makeReserve } from '../../shared/gameLogic.js';
import { HEROES } from '../heroes.js';

// Sample n heroes from source array (Fisher-Yates shuffle)
const isDraftableHero = (hero) => hero && hero.draftable !== false;
function sampleHeroes(source, n) {
  const pool = Array.isArray(source) ? source.filter(isDraftableHero) : [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

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

class LocalGameEngine {
  constructor() {
    this.gameState = null;
    this.listeners = new Map();
    this.connected = true; // Always "connected" locally
    this.gameMode = 'classic';
    // Step queue for ACK-based animation sequencing
    this.stepQueue = [];
    this.stepIndex = 0;
    this.awaitingAck = false;
    this.pendingMovementStart = false;
  }

  // Mimic socket.io's on() method
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Mimic socket.io's off() method
  off(event, callback) {
    if (this.listeners.has(event)) {
      if (callback) {
        // Remove specific callback
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      } else {
        // Remove all callbacks for this event (socket.io behavior when no callback specified)
        this.listeners.set(event, []);
      }
    }
  }

  // Emit event to listeners
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`[LocalGameEngine] Error in ${event} listener:`, e);
        }
      });
    }
  }

  // Mimic socket.io's emit() method - process actions locally
  async emit(event, data) {
    
    
    switch (event) {
      case 'auth':
        // Local mode doesn't need auth
        this._emit('authResult', { ok: true, user: { username: 'Local Player' } });
        break;

      case 'resetGame':
        this._resetGame(data);
        break;

      case 'makeMove':
        await this._handleMove(data);
        break;

      case 'stepAck':
        // Handle animation step acknowledgement
        this._handleStepAck(data);
        break;

      case 'movementComplete':
        // Handle movement phase completion - transition back to battle phase
        this._handleMovementComplete(data);
        break;

      case 'movementMove':
        // Handle individual movement during movement phase
        this._handleMovementMove(data);
        break;

      case 'setTestState':
        // Handle test state setup (for TestBattle)
        this._handleSetTestState(data);
        break;

      case 'syncBattleState':
        // Handle battle state sync
        this._handleSyncBattleState(data);
        break;

      case 'leaveMatch':
        // No-op for local games
        break;

      case 'findMatch':
        // Local mode doesn't do matchmaking
        
        break;

      case 'cancelMatch':
        // No-op for local games
        break;

      default:
        
    }
  }

  // Initialize/reset game state
  _resetGame(payload = null) {
    const nextMode = payload && payload.gameMode ? payload.gameMode : this.gameMode;
    this.gameMode = nextMode || 'classic';
    const isFfa3 = this.gameMode === 'ffa3';
    // Sample heroes for the draft pool
    const availableHeroes = sampleHeroes(HEROES, isFfa3 ? 26 : 30);

    this.gameState = {
      phase: 'draft',
      step: 0,
      roundNumber: 0,
      p1Main: makeEmptyMain('player1'),
      p1Reserve: makeReserve('player1'),
      p2Main: makeEmptyMain('player2'),
      p2Reserve: makeReserve('player2'),
      ...(isFfa3 ? { p3Main: makeEmptyMain('player3'), p3Reserve: makeReserve('player3') } : {}),
      availableHeroes,
      bans: [],
      priorityPlayer: 'player1',
      gameMode: this.gameMode
    };

    // Reset step queue state
    this.stepQueue = [];
    this.stepIndex = 0;
    this.awaitingAck = false;

    // Emit the new game state
    this._emit('gameState', { ...this.gameState });
    
  }

  // Start the movement phase after a battle round
  _startMovementPhase() {
    const prio = this.gameState.priorityPlayer || 'player1';
    let prioShort = normalizePrioritySide(prio);
    let sequence;
    if (this.gameState.gameMode === 'ffa3') {
      const order = getActiveOrder(this.gameState);
      if (order.length <= 1) {
        this.gameState.movementPhase = null;
        this.gameState.phase = 'ready';
        this._emit('gameState', { ...this.gameState });
        return;
      }
      if (!order.includes(prioShort)) {
        prioShort = order[0];
        this.gameState.priorityPlayer = sideToPlayerKey(prioShort);
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
    this.gameState.movementPhase = { sequence, index: 0 };
    this.gameState.phase = 'movement';
    
    this._emit('gameState', { ...this.gameState });
  }

  // Send the next step in the queue (ACK-based like the server)
  _sendNextStep() {
    if (this.awaitingAck) return;
    if (!this.stepQueue || this.stepIndex >= this.stepQueue.length) {
      // All steps complete
      this.stepQueue = [];
      this.stepIndex = 0;
      
      
      // Start movement phase if it was pending (just like the server does)
      if (this.pendingMovementStart) {
        this.pendingMovementStart = false;
        this._startMovementPhase();
      }
      return;
    }
    const step = this.stepQueue[this.stepIndex];
    this.awaitingAck = true;
    
    this._emit('step', step);
  }

  // Handle stepAck from client
  _handleStepAck(data) {
    if (!this.awaitingAck) return;
    this.awaitingAck = false;
    this.stepIndex++;
    // Small delay before next step for smoother animations
    setTimeout(() => this._sendNextStep(), 50);
  }

  // Handle movement phase completion - transition back to battle
  _handleMovementComplete(payload) {
    if (!payload || !this.gameState) return;
    
    // Update board state with any movement changes
    if (payload.p1Main) this.gameState.p1Main = payload.p1Main;
    if (payload.p2Main) this.gameState.p2Main = payload.p2Main;
    if (payload.p3Main) this.gameState.p3Main = payload.p3Main;
    if (payload.p1Reserve) this.gameState.p1Reserve = payload.p1Reserve;
    if (payload.p2Reserve) this.gameState.p2Reserve = payload.p2Reserve;
    if (payload.p3Reserve) this.gameState.p3Reserve = payload.p3Reserve;
    if (payload.priorityPlayer) this.gameState.priorityPlayer = payload.priorityPlayer;
    
    // Transition back to battle phase
    this.gameState.phase = 'battle';
    
    this._emit('gameState', { ...this.gameState });
  }

  // Handle individual movement during movement phase (swap tiles)
  _handleMovementMove(payload) {
    if (!payload || !this.gameState || !this.gameState.movementPhase) return;
    
    const srcId = payload.sourceId;
    const dstId = payload.targetId;
    if (!srcId || !dstId) return;

    const mp = this.gameState.movementPhase;
    const mover = mp.sequence[mp.index];
    if (this.gameState.gameMode === 'ffa3' && !getActiveOrder(this.gameState).includes(mover)) {
      this._advanceMovementPhase();
      return;
    }

    // Helper to find tile by ID
    const findTileById = (tileId) => {
      const findIn = (arr, boardName) => {
        const idx = (arr || []).findIndex(t => t && t.id === tileId);
        if (idx !== -1) return { boardName, index: idx, tile: arr[idx] };
        return null;
      };
      const direct = findIn(this.gameState.p1Main, 'p1Main') || 
             findIn(this.gameState.p2Main, 'p2Main') || 
             findIn(this.gameState.p3Main, 'p3Main') || 
             findIn(this.gameState.p1Reserve, 'p1Reserve') || 
             findIn(this.gameState.p2Reserve, 'p2Reserve') ||
             findIn(this.gameState.p3Reserve, 'p3Reserve');
      if (direct) return direct;

      // Parse string-based tile IDs like "p1:2" or "p1reserve:0"
      if (typeof tileId === 'string') {
        const parts = tileId.split(':');
        if (parts.length === 2) {
          const [p, i] = parts;
          const idx = parseInt(i, 10);
          if (!isNaN(idx)) {
            const plow = p.toLowerCase();
            if (plow === 'p1') return { boardName: 'p1Main', index: idx, tile: (this.gameState.p1Main || [])[idx] };
            if (plow === 'p2') return { boardName: 'p2Main', index: idx, tile: (this.gameState.p2Main || [])[idx] };
            if (plow === 'p3') return { boardName: 'p3Main', index: idx, tile: (this.gameState.p3Main || [])[idx] };
            if (plow === 'p1reserve') return { boardName: 'p1Reserve', index: idx, tile: (this.gameState.p1Reserve || [])[idx] };
            if (plow === 'p2reserve') return { boardName: 'p2Reserve', index: idx, tile: (this.gameState.p2Reserve || [])[idx] };
            if (plow === 'p3reserve') return { boardName: 'p3Reserve', index: idx, tile: (this.gameState.p3Reserve || [])[idx] };
          }
        } else if (parts.length === 3 && parts[1] === 'reserve') {
          const idx = parseInt(parts[2], 10);
          if (!isNaN(idx)) {
            if (parts[0] === 'p1') return { boardName: 'p1Reserve', index: idx, tile: (this.gameState.p1Reserve || [])[idx] };
            if (parts[0] === 'p2') return { boardName: 'p2Reserve', index: idx, tile: (this.gameState.p2Reserve || [])[idx] };
            if (parts[0] === 'p3') return { boardName: 'p3Reserve', index: idx, tile: (this.gameState.p3Reserve || [])[idx] };
          }
        } else if (tileId.includes('player1-main-') || tileId.includes('player2-main-') || tileId.includes('player3-main-') || tileId.includes('player1-reserve-') || tileId.includes('player2-reserve-') || tileId.includes('player3-reserve-')) {
          const m = tileId.match(/(player1|player2|player3)-(main|reserve)-(\d+)/);
          if (m) {
            const side = m[1] === 'player1' ? 'p1' : (m[1] === 'player2' ? 'p2' : 'p3');
            const kind = m[2];
            const idx = parseInt(m[3], 10);
            if (kind === 'main') return { boardName: side === 'p1' ? 'p1Main' : (side === 'p2' ? 'p2Main' : 'p3Main'), index: idx, tile: (side === 'p1' ? this.gameState.p1Main : (side === 'p2' ? this.gameState.p2Main : this.gameState.p3Main))[idx] };
            return { boardName: side === 'p1' ? 'p1Reserve' : (side === 'p2' ? 'p2Reserve' : 'p3Reserve'), index: idx, tile: (side === 'p1' ? this.gameState.p1Reserve : (side === 'p2' ? this.gameState.p2Reserve : this.gameState.p3Reserve))[idx] };
          }
        }
      }
      return null;
    };

    const src = findTileById(srcId);
    const dst = findTileById(dstId);
    if (!src || !dst) {
      
      return;
    }

    const srcPlayer = src.boardName.startsWith('p1') ? 'p1' : (src.boardName.startsWith('p2') ? 'p2' : 'p3');
    if (srcPlayer !== mover) {
      console.log('[LocalGameEngine] movementMove: Wrong player trying to move', srcPlayer, 'vs', mover);
      return;
    }

    // Prevent bosses from being moved into reserve slots
    const dstIsReserve = dst.boardName.includes('Reserve');
    if (dstIsReserve && src?.tile?.hero?.isBoss) {
      console.log('[LocalGameEngine] movementMove: BLOCKED - boss cannot move to reserve');
      // Advance the phase (treat as skip)
      this._advanceMovementPhase();
      return;
    }

    // Validate: moving from reserve to main should not exceed 5 heroes
    const srcIsReserve = src.boardName.includes('Reserve');
    const dstIsMain = dst.boardName.includes('Main');
    if (srcIsReserve && dstIsMain) {
      const countsTowardMainLimit = (tile) => tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true;
      const mainBoard = srcPlayer === 'p1' ? this.gameState.p1Main : (srcPlayer === 'p2' ? this.gameState.p2Main : this.gameState.p3Main);
      const mainAliveCount = (mainBoard || []).filter(countsTowardMainLimit).length;
      const dstTile = dst.tile;
      const dstHasLivingHero = countsTowardMainLimit(dstTile);
      
      if (!dstHasLivingHero && mainAliveCount >= 5) {
        console.log('[LocalGameEngine] movementMove: BLOCKED - would exceed 5 heroes');
        // Advance the phase (treat as skip)
        this._advanceMovementPhase();
        return;
      }
    }

    // Perform the swap
    const getBoardRef = (name) => {
      if (name === 'p1Main') return this.gameState.p1Main;
      if (name === 'p2Main') return this.gameState.p2Main;
      if (name === 'p3Main') return this.gameState.p3Main;
      if (name === 'p1Reserve') return this.gameState.p1Reserve;
      if (name === 'p2Reserve') return this.gameState.p2Reserve;
      return this.gameState.p3Reserve;
    };

    const boardA = getBoardRef(src.boardName);
    const boardB = getBoardRef(dst.boardName);
    const tmp = boardA[src.index];
    boardA[src.index] = boardB[dst.index];
    boardB[dst.index] = tmp;

    this._advanceMovementPhase();
  }

  // Helper to advance movement phase index
  _advanceMovementPhase() {
    const mp = this.gameState.movementPhase;
    const nextIndex = mp.index + 1;
    
    if (nextIndex >= mp.sequence.length) {
      // Movement complete - transition to ready phase
      this.gameState.movementPhase = null;
      this.gameState.phase = 'ready';
      if (this.gameState.gameMode === 'ffa3') {
        this.gameState.priorityPlayer = getNextPriorityPlayer(this.gameState);
      } else {
        this.gameState.priorityPlayer = (this.gameState.priorityPlayer === 'player1' || this.gameState.priorityPlayer === 'p1') ? 'player2' : 'player1';
      }
      console.log('[LocalGameEngine] Movement complete, switching to ready phase, new priority:', this.gameState.priorityPlayer);
    } else {
      this.gameState.movementPhase = { ...mp, index: nextIndex };
      console.log('[LocalGameEngine] Movement advanced to index', nextIndex, 'next mover:', mp.sequence[nextIndex]);
    }
    
    this._emit('gameState', { ...this.gameState });
  }

  // Handle test state setup (for TestBattle component)
  _handleSetTestState(testState) {
    try {
      console.log('[LocalGameEngine] Setting test game state');
      this.gameState = testState || this.gameState;
      if (!this.gameState.phase) this.gameState.phase = 'battle';
      if (!this.gameState.priorityPlayer) this.gameState.priorityPlayer = 'player1';
      
      // Reset round/step state so test battles can start immediately
      this.stepQueue = [];
      this.stepIndex = 0;
      this.awaitingAck = false;
      this.pendingMovementStart = false;
      
      if (this.gameState.movementPhase) delete this.gameState.movementPhase;
      
      this._emit('gameState', { ...this.gameState });
    } catch (error) {
      console.error('[LocalGameEngine] Error setting test state:', error);
    }
  }

  // Handle battle state sync (for visual movement sync)
  _handleSyncBattleState(payload) {
    if (!payload || !this.gameState) return;
    
    if (payload.p1Main) this.gameState.p1Main = payload.p1Main;
    if (payload.p2Main) this.gameState.p2Main = payload.p2Main;
    if (payload.p3Main) this.gameState.p3Main = payload.p3Main;
    if (payload.p1Reserve) this.gameState.p1Reserve = payload.p1Reserve;
    if (payload.p2Reserve) this.gameState.p2Reserve = payload.p2Reserve;
    if (payload.p3Reserve) this.gameState.p3Reserve = payload.p3Reserve;
    if (payload.priorityPlayer) this.gameState.priorityPlayer = payload.priorityPlayer;
    if (payload.phase) this.gameState.phase = payload.phase;
    
    // Emit ack if requested
    if (payload.requestAck) {
      this._emit('syncBattleAck', { ok: true });
    }
    
    this._emit('gameState', { ...this.gameState });
  }

  // Handle game moves
  async _handleMove(action) {
    if (!this.gameState) {
      console.warn('[LocalGameEngine] No game state, resetting...');
      this._resetGame();
      return;
    }

    try {
      // Process the move using shared game logic
      const result = await processMove(this.gameState, action, null, { returnSteps: true });
      
      if (result.state) {
        this.gameState = result.state;
      } else {
        this.gameState = result;
      }

      // If there are step animations (for battle), queue them for ACK-based delivery
      // For startRound actions, do NOT emit gameState immediately - let step animations
      // drive the state updates to avoid heroes disappearing and premature winner detection.
      // The final state (including winner) will be applied via step events.
      if (result.steps && result.steps.length > 0) {
        this.stepQueue = result.steps;
        this.stepIndex = 0;
        this.awaitingAck = false;
        
        // Set pending movement start for battle rounds (like the server does)
        if (action.type === 'startRound') {
          this.pendingMovementStart = true;
        }
        
        // Start sending steps - state will be applied progressively via step events
        this._sendNextStep();
      } else {
        // No steps - emit state immediately (for non-battle actions like draft picks)
        this._emit('gameState', { ...this.gameState });
      }

    } catch (error) {
      console.error('[LocalGameEngine] Error processing move:', error);
      this._emit('error', 'Failed to process move: ' + error.message);
    }
  }

  // Close connection (no-op for local)
  close() {
    console.log('[LocalGameEngine] Connection closed');
    this.connected = false;
  }

  // Reconnect (no-op for local)
  connect() {
    console.log('[LocalGameEngine] Reconnected');
    this.connected = true;
    this._emit('connect');
  }
}

// Factory function to create local engine or attempt server connection
export function createOfflineSocket() {
  return new LocalGameEngine();
}

export default LocalGameEngine;
