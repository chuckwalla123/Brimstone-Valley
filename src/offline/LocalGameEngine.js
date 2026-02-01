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
function sampleHeroes(source, n) {
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

class LocalGameEngine {
  constructor() {
    this.gameState = null;
    this.listeners = new Map();
    this.connected = true; // Always "connected" locally
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
    console.log('[LocalGameEngine] emit:', event, data);
    
    switch (event) {
      case 'auth':
        // Local mode doesn't need auth
        this._emit('authResult', { ok: true, user: { username: 'Local Player' } });
        break;

      case 'resetGame':
        this._resetGame();
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
        console.log('[LocalGameEngine] Matchmaking not available in offline mode');
        break;

      case 'cancelMatch':
        // No-op for local games
        break;

      default:
        console.log('[LocalGameEngine] Unhandled event:', event);
    }
  }

  // Initialize/reset game state
  _resetGame() {
    // Sample 30 heroes for the draft pool
    const availableHeroes = sampleHeroes(HEROES, 30);

    this.gameState = {
      phase: 'draft',
      step: 0,
      roundNumber: 0,
      p1Main: makeEmptyMain('player1'),
      p1Reserve: makeReserve('player1'),
      p2Main: makeEmptyMain('player2'),
      p2Reserve: makeReserve('player2'),
      availableHeroes,
      bans: [],
      priorityPlayer: 'player1'
    };

    // Reset step queue state
    this.stepQueue = [];
    this.stepIndex = 0;
    this.awaitingAck = false;

    // Emit the new game state
    this._emit('gameState', { ...this.gameState });
    console.log('[LocalGameEngine] Game reset, draft pool size:', availableHeroes.length);
  }

  // Start the movement phase after a battle round
  _startMovementPhase() {
    const prioShort = (this.gameState.priorityPlayer === 'player1' || this.gameState.priorityPlayer === 'p1') ? 'p1' : 'p2';
    const sequence = prioShort === 'p1' ? ['p1', 'p2', 'p2', 'p1'] : ['p2', 'p1', 'p1', 'p2'];
    this.gameState.movementPhase = { sequence, index: 0 };
    this.gameState.phase = 'movement';
    console.log('[LocalGameEngine] Starting movement phase. priorityPlayer:', this.gameState.priorityPlayer, 'sequence:', sequence);
    this._emit('gameState', { ...this.gameState });
  }

  // Send the next step in the queue (ACK-based like the server)
  _sendNextStep() {
    if (this.awaitingAck) return;
    if (!this.stepQueue || this.stepIndex >= this.stepQueue.length) {
      // All steps complete
      this.stepQueue = [];
      this.stepIndex = 0;
      console.log('[LocalGameEngine] All steps complete');
      
      // Start movement phase if it was pending (just like the server does)
      if (this.pendingMovementStart) {
        this.pendingMovementStart = false;
        this._startMovementPhase();
      }
      return;
    }
    const step = this.stepQueue[this.stepIndex];
    this.awaitingAck = true;
    console.log('[LocalGameEngine] Sending step', this.stepIndex, step?.type);
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
    if (payload.p1Reserve) this.gameState.p1Reserve = payload.p1Reserve;
    if (payload.p2Reserve) this.gameState.p2Reserve = payload.p2Reserve;
    if (payload.priorityPlayer) this.gameState.priorityPlayer = payload.priorityPlayer;
    
    // Transition back to battle phase
    this.gameState.phase = 'battle';
    console.log('[LocalGameEngine] Movement complete, transitioning to battle phase');
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

    // Helper to find tile by ID
    const findTileById = (tileId) => {
      const findIn = (arr, boardName) => {
        const idx = (arr || []).findIndex(t => t && t.id === tileId);
        if (idx !== -1) return { boardName, index: idx, tile: arr[idx] };
        return null;
      };
      const direct = findIn(this.gameState.p1Main, 'p1Main') || 
                     findIn(this.gameState.p2Main, 'p2Main') || 
                     findIn(this.gameState.p1Reserve, 'p1Reserve') || 
                     findIn(this.gameState.p2Reserve, 'p2Reserve');
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
            if (plow === 'p1reserve') return { boardName: 'p1Reserve', index: idx, tile: (this.gameState.p1Reserve || [])[idx] };
            if (plow === 'p2reserve') return { boardName: 'p2Reserve', index: idx, tile: (this.gameState.p2Reserve || [])[idx] };
          }
        } else if (parts.length === 3 && parts[1] === 'reserve') {
          const idx = parseInt(parts[2], 10);
          if (!isNaN(idx)) {
            if (parts[0] === 'p1') return { boardName: 'p1Reserve', index: idx, tile: (this.gameState.p1Reserve || [])[idx] };
            if (parts[0] === 'p2') return { boardName: 'p2Reserve', index: idx, tile: (this.gameState.p2Reserve || [])[idx] };
          }
        }
      }
      return null;
    };

    const src = findTileById(srcId);
    const dst = findTileById(dstId);
    if (!src || !dst) {
      console.log('[LocalGameEngine] movementMove: Invalid src/dst', srcId, dstId);
      return;
    }

    const srcPlayer = src.boardName.startsWith('p1') ? 'p1' : 'p2';
    if (srcPlayer !== mover) {
      console.log('[LocalGameEngine] movementMove: Wrong player trying to move', srcPlayer, 'vs', mover);
      return;
    }

    // Validate: moving from reserve to main should not exceed 5 heroes
    const srcIsReserve = src.boardName.includes('Reserve');
    const dstIsMain = dst.boardName.includes('Main');
    if (srcIsReserve && dstIsMain) {
      const mainBoard = srcPlayer === 'p1' ? this.gameState.p1Main : this.gameState.p2Main;
      const mainAliveCount = (mainBoard || []).filter(t => t && t.hero && !t._dead).length;
      const dstTile = dst.tile;
      const dstHasLivingHero = dstTile && dstTile.hero && !dstTile._dead;
      
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
      if (name === 'p1Reserve') return this.gameState.p1Reserve;
      return this.gameState.p2Reserve;
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
      this.gameState.priorityPlayer = (this.gameState.priorityPlayer === 'player1' || this.gameState.priorityPlayer === 'p1') ? 'player2' : 'player1';
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
    if (payload.p1Reserve) this.gameState.p1Reserve = payload.p1Reserve;
    if (payload.p2Reserve) this.gameState.p2Reserve = payload.p2Reserve;
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
