/**
 * Neural Network AI Wrapper
 * 
 * Provides an interface compatible with the existing AI system,
 * using a trained neural network to make decisions.
 */

import { 
  encodeState, 
  getActionMask, 
  decodeAction,
  ACTION_SPACE_SIZE 
} from './training/stateEncoder.js';
import { 
  loadModel, 
  predictWithMask 
} from './training/model.js';

let model = null;
let isModelLoaded = false;

/**
 * Initialize the neural AI by loading the trained model
 */
export async function initializeNeuralAI() {
  if (isModelLoaded) return true;
  
  try {
    model = await loadModel();
    if (model) {
      isModelLoaded = true;
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('[NeuralAI] Error loading model:', error);
    return false;
  }
}

/**
 * Sample an action from the policy distribution
 * 
 * @param {Float32Array} policy - Probability distribution over actions
 * @param {number} temperature - Temperature for sampling (0 = greedy, 1 = stochastic)
 * @returns {number} Action index
 */
function sampleAction(policy, temperature = 0.1) {
  if (temperature === 0) {
    // Greedy: pick best action
    let maxProb = -1;
    let bestAction = 0;
    for (let i = 0; i < policy.length; i++) {
      if (policy[i] > maxProb) {
        maxProb = policy[i];
        bestAction = i;
      }
    }
    return bestAction;
  }
  
  // Stochastic: sample from distribution
  // Apply temperature
  const temperedPolicy = new Float32Array(policy.length);
  let sum = 0;
  for (let i = 0; i < policy.length; i++) {
    temperedPolicy[i] = Math.pow(policy[i], 1 / temperature);
    sum += temperedPolicy[i];
  }
  
  // Normalize
  for (let i = 0; i < temperedPolicy.length; i++) {
    temperedPolicy[i] /= sum;
  }
  
  // Sample
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < temperedPolicy.length; i++) {
    cumulative += temperedPolicy[i];
    if (rand <= cumulative) {
      return i;
    }
  }
  
  return temperedPolicy.length - 1; // Fallback
}

/**
 * Apply a move to the board state
 */
function applyMove(board, reserve, move) {
  const newBoard = [...board];
  const newReserve = [...reserve];
  
  if (move.type === 'noop') {
    return { board: newBoard, reserve: newReserve };
  }
  
  const fromIndex = move.from;
  const toIndex = move.to;
  
  let fromTile, toTile;
  
  // Get source tile
  if (fromIndex < 5) {
    fromTile = newBoard[fromIndex];
  } else {
    fromTile = newReserve[fromIndex - 5];
  }
  
  // Get destination tile
  if (toIndex < 5) {
    toTile = newBoard[toIndex];
  } else {
    toTile = newReserve[toIndex - 5];
  }
  
  // Perform swap or move
  if (fromIndex < 5 && toIndex < 5) {
    // Swap on main board
    [newBoard[fromIndex], newBoard[toIndex]] = [newBoard[toIndex], newBoard[fromIndex]];
  } else if (fromIndex >= 5 && toIndex < 5) {
    // Move from reserve to main
    newBoard[toIndex] = newReserve[fromIndex - 5];
    newReserve[fromIndex - 5] = null;
  } else if (fromIndex < 5 && toIndex >= 5) {
    // Move from main to reserve
    newReserve[toIndex - 5] = newBoard[fromIndex];
    newBoard[fromIndex] = null;
  } else {
    // Swap in reserve
    [newReserve[fromIndex - 5], newReserve[toIndex - 5]] = [newReserve[toIndex - 5], newReserve[fromIndex - 5]];
  }
  
  return { board: newBoard, reserve: newReserve };
}

/**
 * Neural AI decision maker for movement phase
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

  if (!isModelLoaded || !model) {
    // Fallback to noop if model not loaded
    
    return getNoopMove();
  }
  
  if (!movement || !movement.movementPhase) {
    
    return getNoopMove();
  }

  const phase = movement.movementPhase;
  const currentMover = phase.sequence[phase.index];
  
  if (currentMover !== 'p2') {
    
    return getNoopMove();
  }
  
  // Encode current state
  const state = {
    p1Board,
    p1Reserve: p1ReserveBoard,
    p2Board,
    p2Reserve: p2ReserveBoard
  };
  
  const stateEncoding = encodeState(state);
  const actionMask = getActionMask(state, true); // true = P2's turn
  
  // Get policy and value from neural network
  const { policy, value } = await predictWithMask(model, stateEncoding, actionMask);
  
  
  // Sample action (use higher temperature for more exploration early on)
  const actionIndex = sampleAction(policy, 1.0);
  const move = decodeAction(actionIndex);
  
  
  // Convert move to expected format
  if (!move || move.type === 'noop') {
    
    return getNoopMove();
  }
  
  const MAIN_SLOTS = 9;
  const sourceId = move.from < MAIN_SLOTS
    ? `p2:${move.from}`
    : `p2Reserve:${move.from - MAIN_SLOTS}`;
  const destinationId = move.to < MAIN_SLOTS
    ? `p2:${move.to}`
    : `p2Reserve:${move.to - MAIN_SLOTS}`;
  
  const result = { sourceId, destinationId };
  
  return result;
};

/**
 * Neural AI decision maker for draft phase
 * Uses trained neural network to pick heroes
 */
export const makePickDecision = async (availableHeroes, boardState) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  if (!boardState) return { hero: availableHeroes[0], slotIndex: 0, slotType: 'main' };
  
  const { p2Main = [], p2Reserve = [], p1Main = [], p1Reserve = [] } = boardState;
  
  // If model isn't loaded, fall back to ECV
  if (!isModelLoaded || !model) {
    return ecvPickFallback(availableHeroes, p2Main, p2Reserve);
  }
  
  try {
    // Create draft state for neural network
    const draftTurn = p2Main.filter(t => t && t.hero).length + p2Reserve.filter(t => t && t.hero).length;
    const availableHeroIds = availableHeroes.map(h => h.id);
    
    const state = {
      p1Board: p1Main,
      p1Reserve: p1Reserve,
      p2Board: p2Main,
      p2Reserve: p2Reserve,
      phase: 'draft',
      availableHeroes: availableHeroIds,
      draftTurn,
      maxDraftTurns: 14
    };
    
    // Get neural network prediction
    const stateEncoding = encodeState(state);
    const actionMask = getActionMask(state, true); // P2's turn
    const { policy } = await predictWithMask(model, stateEncoding, actionMask);
    
    // Sample action with low temperature for more deterministic picks
    const actionIndex = sampleAction(policy, 0.1);
    const move = decodeAction(actionIndex);
    
    
    // Decode the hero pick
    if (move.type === 'draft') {
      const hero = availableHeroes.find(h => h.id === move.heroId);
      if (hero) {
        const mainCount = p2Main.filter(t => t && t.hero && !t._dead).length;
        const reserveCount = p2Reserve.filter(t => t && t.hero && !t._dead).length;
        const desiredSlot = typeof move.slotIndex === 'number' ? move.slotIndex : null;

        // Respect the model-selected slot if it's valid
        if (desiredSlot !== null) {
          if (desiredSlot < 9) {
            if (mainCount < 5 && (!p2Main[desiredSlot] || !p2Main[desiredSlot].hero)) {
              return { hero, slotIndex: desiredSlot, slotType: 'main' };
            }
          } else {
            const reserveIndex = desiredSlot - 9;
            if (reserveIndex >= 0 && reserveIndex < p2Reserve.length) {
              if (!p2Reserve[reserveIndex] || !p2Reserve[reserveIndex].hero) {
                return { hero, slotIndex: reserveIndex, slotType: 'reserve' };
              }
            }
          }
        }

        // Fallback: choose a random valid slot to avoid deterministic ordering
        const fallbackSlots = [];
        if (mainCount < 5) {
          for (let i = 0; i < p2Main.length; i++) {
            if (!p2Main[i] || !p2Main[i].hero) {
              fallbackSlots.push({ slotIndex: i, slotType: 'main' });
            }
          }
        }
        if (reserveCount < 2) {
          for (let i = 0; i < p2Reserve.length; i++) {
            if (!p2Reserve[i] || !p2Reserve[i].hero) {
              fallbackSlots.push({ slotIndex: i, slotType: 'reserve' });
            }
          }
        }
        if (fallbackSlots.length > 0) {
          const pick = fallbackSlots[Math.floor(Math.random() * fallbackSlots.length)];
          return { hero, slotIndex: pick.slotIndex, slotType: pick.slotType };
        }
      }
    }
    
    // Fallback if neural network pick was invalid
    return ecvPickFallback(availableHeroes, p2Main, p2Reserve);
    
  } catch (error) {
    console.error('[NeuralAI Draft] Error:', error);
    return ecvPickFallback(availableHeroes, p2Main, p2Reserve);
  }
};

/**
 * ECV-based draft fallback
 */
function ecvPickFallback(availableHeroes, p2Main, p2Reserve) {
  const calculateECV = (hero) => {
    const hp = hero.health || 0;
    const armor = hero.armor || 0;
    return Math.sqrt(hp * (hp + armor * 4));
  };
  
  // Find best hero by ECV
  let bestHero = availableHeroes[0];
  let bestECV = calculateECV(bestHero);
  
  for (const hero of availableHeroes) {
    const ecv = calculateECV(hero);
    if (ecv > bestECV) {
      bestECV = ecv;
      bestHero = hero;
    }
  }
  
  // Find first empty slot (prefer main board)
  const mainCount = p2Main.filter(t => t && t.hero && !t._dead).length;
  const reserveCount = p2Reserve.filter(t => t && t.hero && !t._dead).length;
  
  if (mainCount < 5) {
    for (let i = 0; i < p2Main.length; i++) {
      if (!p2Main[i] || !p2Main[i].hero) {
        return { hero: bestHero, slotIndex: i, slotType: 'main' };
      }
    }
  }
  
  if (reserveCount < 2) {
    for (let i = 0; i < p2Reserve.length; i++) {
      if (!p2Reserve[i] || !p2Reserve[i].hero) {
        return { hero: bestHero, slotIndex: i, slotType: 'reserve' };
      }
    }
  }
  
  return null;
}

/**
 * Get thinking delay (instant for neural network)
 */
export const getThinkingDelay = () => 500; // Short delay for visual feedback

/**
 * Ban decision (simple heuristic for now)
 */
/**
 * Neural AI decision maker for ban phase
 * Uses trained neural network to ban heroes
 */
export const makeBanDecision = async (availableHeroes) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  
  // If model isn't loaded, fall back to ECV
  if (!isModelLoaded || !model) {
    return ecvBanFallback(availableHeroes);
  }
  
  try {
    // Create ban state for neural network
    const availableHeroIds = availableHeroes.map(h => h.id);
    
    const state = {
      p1Board: new Array(5).fill(null),
      p1Reserve: new Array(2).fill(null),
      p2Board: new Array(5).fill(null),
      p2Reserve: new Array(2).fill(null),
      phase: 'ban',
      availableHeroes: availableHeroIds,
      bannedHeroes: [],
      banTurn: 0, // This will be updated by game context
      maxBanTurns: 14
    };
    
    // Get neural network prediction
    const stateEncoding = encodeState(state);
    const actionMask = getActionMask(state, true); // P2's turn
    const { policy } = await predictWithMask(model, stateEncoding, actionMask);
    
    // Sample action with low temperature for more deterministic bans
    const actionIndex = sampleAction(policy, 0.1);
    const move = decodeAction(actionIndex);
    
    
    // Decode the hero ban
    if (move.type === 'ban') {
      const hero = availableHeroes.find(h => h.id === move.heroId);
      if (hero) {
        return hero;
      }
    }
    
    // Fallback if neural network ban was invalid
    return ecvBanFallback(availableHeroes);
    
  } catch (error) {
    console.error('[NeuralAI Ban] Error:', error);
    return ecvBanFallback(availableHeroes);
  }
};

/**
 * ECV-based ban fallback (ban highest ECV)
 */
function ecvBanFallback(availableHeroes) {
  const calculateECV = (hero) => {
    const hp = hero.health || 0;
    const armor = hero.armor || 0;
    return Math.sqrt(hp * (hp + armor * 4));
  };
  
  let bestHero = availableHeroes[0];
  let bestECV = calculateECV(bestHero);
  
  for (const hero of availableHeroes) {
    const ecv = calculateECV(hero);
    if (ecv > bestECV) {
      bestECV = ecv;
      bestHero = hero;
    }
  }
  
  return bestHero;
}
