/**
 * Medium AI - Uses alpha-beta pruning with real battleEngine simulation
 * Search depth: 2 moves ahead
 */

import { getSpellById } from '../spells.js';
import { executeRound } from '../battleEngine.js';

/**
 * Calculate Effective Combat Value for a hero
 * ECV = √(HP × (HP + Armor × 4))
 */
function calculateECV(hero) {
  if (!hero) return 0;
  const hp = hero.currentHealth || hero.health || 0;
  const armor = hero.currentArmor || hero.armor || 0;
  return Math.sqrt(hp * (hp + armor * 4));
}

/**
 * Synchronous wrapper for executeRound that skips animations
 * Runs the battle engine without delays for AI simulation
 */
async function simulateOneMove(p1Board, p1Reserve, p2Board, p2Reserve) {
  // Deep clone to avoid mutation
  const cloneBoard = (board) => board.map(tile => {
    if (!tile) return null;
    return {
      ...tile,
      hero: tile.hero ? { ...tile.hero } : null,
      _dead: tile._dead
    };
  });
  
  const state = {
    p1Board: cloneBoard(p1Board),
    p1Reserve: cloneBoard(p1Reserve),
    p2Board: cloneBoard(p2Board),
    p2Reserve: cloneBoard(p2Reserve)
  };
  
  try {
    // Run battle engine with 0ms delays (no animations)
    const result = await executeRound(state, {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      onStep: null, // Skip animation callbacks
      quiet: true
    });
    
    return {
      p1Board: result.p1Board || state.p1Board,
      p1Reserve: result.p1Reserve || state.p1Reserve,
      p2Board: result.p2Board || state.p2Board,
      p2Reserve: result.p2Reserve || state.p2Reserve,
      lastCastActionBySide: result.lastCastActionBySide || state.lastCastActionBySide || null
    };
  } catch (e) {
    console.error('[MediumAI] Simulation error:', e);
    // Return unchanged state if simulation fails
    return state;
  }
}

/**
 * Evaluate board state from P2's perspective
 * Returns: P2's total ECV - P1's total ECV
 */
function evaluateBoardState(p1Board, p1Reserve, p2Board, p2Reserve) {
  let p1Score = 0;
  let p2Score = 0;
  
  // Sum ECV for all alive P1 heroes (main board full value, reserve 20%)
  p1Board.forEach(tile => {
    if (tile && tile.hero && !tile._dead) {
      p1Score += calculateECV(tile.hero);
    }
  });
  
  p1Reserve.forEach(tile => {
    if (tile && tile.hero && !tile._dead) {
      p1Score += calculateECV(tile.hero) * 0.2;
    }
  });
  
  // Sum ECV for all alive P2 heroes (main board full value, reserve 20%)
  p2Board.forEach(tile => {
    if (tile && tile.hero && !tile._dead) {
      p2Score += calculateECV(tile.hero);
    }
  });
  
  p2Reserve.forEach(tile => {
    if (tile && tile.hero && !tile._dead) {
      p2Score += calculateECV(tile.hero) * 0.2;
    }
  });
  
  return p2Score - p1Score;
}

/**
 * Generate all possible moves for a player
 * Returns array of { type: 'move', from: index, to: index } or { type: 'noop' }
 */
function generateMoves(board, reserve, isP2) {
  const moves = [{ type: 'noop' }]; // Always can do nothing
  const countsTowardMainLimit = (tile) => tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true;
  
  const allTiles = [...board, ...reserve];
  const mainCount = board.filter(countsTowardMainLimit).length;
  
  // For each hero, try moving to each main board position
  allTiles.forEach((sourceTile, sourceIdx) => {
    if (!sourceTile || !sourceTile.hero || sourceTile._dead) return;
    
    const isSourceOnMain = sourceIdx < board.length;
    const isSourceOnReserve = sourceIdx >= board.length;
    
    // Try moving to each main board position
    board.forEach((targetTile, targetIdx) => {
      // Can't move to yourself
      if (sourceIdx === targetIdx) return;
      
      // Treat dead tiles as empty slots - they can be moved into
      const targetIsEmpty = !targetTile || !targetTile.hero || targetTile._dead;
      
      if (targetIsEmpty) {
        // Empty or dead slot - can move if under 5 hero limit or swapping from main
        if (mainCount < 5 || isSourceOnMain) {
          moves.push({ type: 'move', from: sourceIdx, to: targetIdx });
        }
      } else {
        // Occupied slot with living hero - can always swap (doesn't change count)
        moves.push({ type: 'swap', from: sourceIdx, to: targetIdx });
      }
    });
  });
  
  return moves;
}

/**
 * Apply a move to the board state
 */
function applyMove(board, reserve, move) {
  if (move.type === 'noop') {
    return { board: [...board], reserve: [...reserve] };
  }
  
  const newBoard = [...board];
  const newReserve = [...reserve];
  const allTiles = [...newBoard, ...newReserve];
  
  const sourceTile = allTiles[move.from];
  const targetIdx = move.to;
  
  if (!sourceTile || targetIdx >= newBoard.length) {
    return { board: newBoard, reserve: newReserve };
  }
  
  if (move.type === 'swap') {
    // Swap two heroes
    const targetTile = newBoard[targetIdx];
    const sourceIsOnMain = move.from < board.length;
    
    // Place source at target
    newBoard[targetIdx] = { ...sourceTile };
    
    if (sourceIsOnMain) {
      // Both on main - swap them
      newBoard[move.from] = { ...targetTile };
    } else {
      // Source is reserve - move target to reserve
      const reserveIdx = move.from - board.length;
      newReserve[reserveIdx] = { ...targetTile };
    }
  } else {
    // Regular move to empty slot
    newBoard[targetIdx] = { ...sourceTile };
    
    // Clear source
    if (move.from < newBoard.length) {
      newBoard[move.from] = null;
    } else {
      newReserve[move.from - newBoard.length] = null;
    }
  }
  
  return { board: newBoard, reserve: newReserve };
}

/**
 * Alpha-beta minimax search with actual battleEngine simulation
 * @param {Object} state - Current game state
 * @param {number} depth - Remaining depth to search (number of moves)
 * @param {number} alpha - Alpha value for pruning
 * @param {number} beta - Beta value for pruning
 * @param {boolean} maximizingPlayer - True if maximizing (P2), false if minimizing (P1)
 * @returns {Promise<number>} Best evaluation score
 */
async function alphabeta(state, depth, alpha, beta, maximizingPlayer) {
  // Base case: reached depth 0
  if (depth === 0) {
    return evaluateBoardState(state.p1Board, state.p1Reserve, state.p2Board, state.p2Reserve);
  }
  
  // Check for terminal state (one side has no heroes)
  const p1Alive = [...state.p1Board, ...state.p1Reserve].some(t => t && t.hero && !t._dead);
  const p2Alive = [...state.p2Board, ...state.p2Reserve].some(t => t && t.hero && !t._dead);
  
  if (!p1Alive) return 10000; // P2 wins
  if (!p2Alive) return -10000; // P1 wins
  
  if (maximizingPlayer) {
    // P2's turn (maximize)
    let value = -Infinity;
    const moves = generateMoves(state.p2Board, state.p2Reserve, true);
    
    for (const move of moves) {
      // Apply movement
      const { board: newP2Board, reserve: newP2Reserve } = applyMove(state.p2Board, state.p2Reserve, move);
      
      // Simulate one turn of combat using actual battleEngine
      const simulated = await simulateOneMove(state.p1Board, state.p1Reserve, newP2Board, newP2Reserve);
      
      const newState = {
        p1Board: simulated.p1Board,
        p1Reserve: simulated.p1Reserve,
        p2Board: simulated.p2Board,
        p2Reserve: simulated.p2Reserve
      };
      
      value = Math.max(value, await alphabeta(newState, depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, value);
      
      if (beta <= alpha) break; // Beta cutoff
    }
    
    return value;
  } else {
    // P1's turn (minimize)
    let value = Infinity;
    const moves = generateMoves(state.p1Board, state.p1Reserve, false);
    
    for (const move of moves) {
      // Apply movement
      const { board: newP1Board, reserve: newP1Reserve } = applyMove(state.p1Board, state.p1Reserve, move);
      
      // Simulate one turn of combat using actual battleEngine
      const simulated = await simulateOneMove(newP1Board, newP1Reserve, state.p2Board, state.p2Reserve);
      
      const newState = {
        p1Board: simulated.p1Board,
        p1Reserve: simulated.p1Reserve,
        p2Board: simulated.p2Board,
        p2Reserve: simulated.p2Reserve
      };
      
      value = Math.min(value, await alphabeta(newState, depth - 1, alpha, beta, true));
      beta = Math.min(beta, value);
      
      if (beta <= alpha) break; // Alpha cutoff
    }
    
    return value;
  }
}

/**
 * Make ban decision - use Easy AI's logic for now
 */
export const makeBanDecision = (availableHeroes) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  
  // Ban highest health + armor*3
  let bestHero = null;
  let bestValue = -1;
  
  availableHeroes.forEach(hero => {
    const hp = hero.health || 0;
    const armor = hero.armor || 0;
    const value = hp + armor * 3;
    
    if (value > bestValue) {
      bestValue = value;
      bestHero = hero;
    }
  });
  
  return bestHero;
};

/**
 * Make pick decision - evaluate all options with 2-move lookahead
 */
export const makePickDecision = async (availableHeroes, boardState) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  if (!boardState) return availableHeroes[0];
  
  const { p2Main = [], p2Reserve = [], p1Main = [], p1Reserve = [] } = boardState;
  
  // Count current heroes
  const mainCount = p2Main.filter(t => t && t.hero && !t._dead).length;
  const reserveCount = p2Reserve.filter(t => t && t.hero && !t._dead).length;
  
  // Build list of valid slots
  const validSlots = [];
  
  if (mainCount < 5) {
    p2Main.forEach((tile, idx) => {
      if (!tile || !tile.hero) {
        validSlots.push({ index: idx, type: 'main' });
      }
    });
  }
  
  if (reserveCount < 2) {
    p2Reserve.forEach((tile, idx) => {
      if (!tile || !tile.hero) {
        validSlots.push({ index: idx, type: 'reserve' });
      }
    });
  }
  
  if (validSlots.length === 0) return null;
  
  let bestChoice = null;
  let bestScore = -Infinity;
  
  
  // During draft, use simple ECV evaluation (alpha-beta search would be too slow)
  for (const hero of availableHeroes) {
    for (const slot of validSlots) {
      // Create hypothetical board with this hero placed
      const testP2Main = [...p2Main];
      const testP2Reserve = [...p2Reserve];
      
      if (slot.type === 'main') {
        testP2Main[slot.index] = { hero: { ...hero }, _dead: false };
      } else {
        testP2Reserve[slot.index] = { hero: { ...hero }, _dead: false };
      }
      
      // Simple evaluation: just compare total ECV
      const score = evaluateBoardState(p1Main, p1Reserve, testP2Main, testP2Reserve);
      
      if (score > bestScore) {
        bestScore = score;
        bestChoice = { hero, slotIndex: slot.index, slotType: slot.type, score };
      }
    }
  }
  
  
  return bestChoice;
};

/**
 * Make movement decision - use alpha-beta with depth 2
 * Always returns a valid move (may be a noop if no improving move found)
 */
export const makeMovementDecision = async (p2Board, p2ReserveBoard, movement, p1Board = [], p1ReserveBoard = []) => {
  // Helper: find first available P2 hero for noop fallback
  const getNoopMove = () => {
    for (let i = 0; i < (p2Board || []).length; i++) {
      if (p2Board[i]?.hero && !p2Board[i]._dead) {
        return { sourceId: `p2:${i}`, destinationId: `p2:${i}` };
      }
    }
    for (let i = 0; i < (p2ReserveBoard || []).length; i++) {
      if (p2ReserveBoard[i]?.hero && !p2ReserveBoard[i]._dead) {
        return { sourceId: `p2Reserve:${i}`, destinationId: `p2Reserve:${i}` };
      }
    }
    // Ultimate fallback
    return { sourceId: 'p2:0', destinationId: 'p2:0' };
  };

  if (!movement || !movement.movementPhase) {
    
    return getNoopMove();
  }
  
  const phase = movement.movementPhase;
  const currentMover = phase.sequence[phase.index];
  
  if (currentMover !== 'p2') {
    
    return getNoopMove();
  }
  
  const moves = generateMoves(p2Board, p2ReserveBoard, true);
  let bestMove = null;
  let bestScore = -Infinity;
  
  
  // Evaluate each possible move using alpha-beta search with depth 2
  for (const move of moves) {
    const { board: newP2Board, reserve: newP2Reserve } = applyMove(p2Board, p2ReserveBoard, move);
    
    const state = {
      p1Board: p1Board,
      p1Reserve: p1ReserveBoard,
      p2Board: newP2Board,
      p2Reserve: newP2Reserve
    };
    
    // Use alpha-beta search with depth 2
    const score = await alphabeta(state, 2, -Infinity, Infinity, false); // P1 moves next
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  
  // Convert move to the expected format
  if (!bestMove || bestMove.type === 'noop') {
    
    return getNoopMove();
  }
  
  const sourceId = bestMove.from < (p2Board || []).length 
    ? `p2:${bestMove.from}` 
    : `p2Reserve:${bestMove.from - (p2Board || []).length}`;
  const destinationId = `p2:${bestMove.to}`;
  
  
  return { sourceId, destinationId };
};

export const getThinkingDelay = () => {
  return Math.floor(Math.random() * 1000) + 1500; // 1.5-2.5 seconds
};
