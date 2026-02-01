/**
 * Monte Carlo Tree Search (MCTS)
 * 
 * AlphaZero-style MCTS that uses neural network to guide search
 * and balance exploration vs exploitation.
 */

import { executeRound } from '../../battleEngine.js';
import { indexToRow } from '../../targeting.js';
import { encodeState, getActionMask, decodeAction, ACTION_SPACE_SIZE } from './stateEncoder.js';
import { predictWithMask } from './model.js';

let POLICY_MIXING = {
  uniform: 0.90,
  rootNoise: 0.10,
  minNet: 0.05
};

export function setPolicyMixing({ uniform = 0.90, rootNoise = 0.10, minNet = 0.05 } = {}) {
  POLICY_MIXING = {
    uniform: Math.max(0, Math.min(0.98, uniform)),
    rootNoise: Math.max(0, Math.min(0.2, rootNoise)),
    minNet: Math.max(0.01, Math.min(0.2, minNet))
  };
}

/**
 * Generate Dirichlet noise for exploration
 * Using Gamma distribution to approximate Dirichlet
 */
function generateDirichletNoise(size, alpha, mask) {
  const noise = new Float32Array(size);
  let sum = 0;
  
  for (let i = 0; i < size; i++) {
    if (mask[i] > 0) {
      // Generate gamma-distributed random variable
      // For simplicity, using a basic gamma approximation
      let gammaValue = 0;
      for (let j = 0; j < Math.floor(alpha); j++) {
        gammaValue -= Math.log(Math.random());
      }
      noise[i] = gammaValue;
      sum += gammaValue;
    }
  }
  
  // Normalize
  if (sum > 0) {
    for (let i = 0; i < size; i++) {
      noise[i] /= sum;
    }
  }
  
  return noise;
}

import { HEROES } from '../../heroes.js';

/**
 * MCTS Node representing a game state
 */
class MCTSNode {
  constructor(state, parent = null, actionTaken = null, priorProb = 1.0, isP2Turn = true) {
    this.state = state; // { p1Board, p1Reserve, p2Board, p2Reserve }
    this.parent = parent;
    this.actionTaken = actionTaken; // Action index that led to this node
    this.priorProb = priorProb; // Prior probability from neural network
    this.isP2Turn = isP2Turn; // Whose turn it is
    
    this.children = new Map(); // Map from action index to child node
    this.visitCount = 0;
    this.valueSum = 0;
    this.isExpanded = false;
    this.isTerminal = false;
  }
  
  /**
   * Get Q-value (average value)
   */
  getValue() {
    if (this.visitCount === 0) return 0;
    return this.valueSum / this.visitCount;
  }
  
  /**
   * Get UCB score for action selection
   * UCB = Q + c_puct * P * sqrt(N_parent) / (1 + N_child)
   * Values are already from current player's perspective after backprop
   */
  getUCB(cPuct = 5.0) { // Balanced exploration after backprop fix
    const qValue = this.getValue();
    const exploration = cPuct * this.priorProb * Math.sqrt(this.parent?.visitCount || 1) / (1 + this.visitCount);
    return qValue + exploration;
  }
  
  /**
   * Select best child using UCB
   */
  selectChild(cPuct = 5.0) {
    let bestUCB = -Infinity;
    const bestChildren = [];
    const epsilon = 1e-9;
    
    for (const [, child] of this.children) {
      const ucb = child.getUCB(cPuct);
      if (ucb > bestUCB + epsilon) {
        bestUCB = ucb;
        bestChildren.length = 0;
        bestChildren.push(child);
      } else if (Math.abs(ucb - bestUCB) <= epsilon) {
        bestChildren.push(child);
      }
    }
    
    if (bestChildren.length === 0) return null;
    const pickIndex = Math.floor(Math.random() * bestChildren.length);
    return bestChildren[pickIndex];
  }
  
  /**
   * Check if game is over
   */
  checkTerminal() {
    // Ban and draft phases are never terminal
    if (this.state.phase === 'ban' || this.state.phase === 'draft') {
      this.isTerminal = false;
      return false;
    }
    
    const p1Alive = [...this.state.p1Board, ...this.state.p1Reserve].some(t => t && t.hero && !t._dead);
    const p2Alive = [...this.state.p2Board, ...this.state.p2Reserve].some(t => t && t.hero && !t._dead);
    
    if (!p1Alive || !p2Alive) {
      this.isTerminal = true;
      return true;
    }
    return false;
  }
  
  /**
   * Get terminal value
   */
  getTerminalValue() {
    const p1Alive = [...this.state.p1Board, ...this.state.p1Reserve].some(t => t && t.hero && !t._dead);
    const p2Alive = [...this.state.p2Board, ...this.state.p2Reserve].some(t => t && t.hero && !t._dead);
    
    if (!p2Alive) return -1; // P1 wins
    if (!p1Alive) return 1;  // P2 wins
    return 0; // Draw (shouldn't happen)
  }
}

/**
 * Apply a move and simulate battle to get next state
 */
/**
 * Deep clone a tile (hero + metadata)
 */
function cloneTile(tile) {
  if (!tile) return null;
  
  const clonedTile = {
    _dead: tile._dead
  };
  
  if (tile.hero) {
    clonedTile.hero = {
      ...tile.hero,
      effects: tile.hero.effects ? tile.hero.effects.map(e => ({ ...e })) : [],
      spells: tile.hero.spells ? {
        front: tile.hero.spells.front ? { ...tile.hero.spells.front } : null,
        middle: tile.hero.spells.middle ? { ...tile.hero.spells.middle } : null,
        back: tile.hero.spells.back ? { ...tile.hero.spells.back } : null
      } : null
    };
  }
  
  return clonedTile;
}

async function applyMoveAndSimulate(state, move, isP2Turn) {
  // Deep clone state
  const newState = {
    p1Board: state.p1Board.map(cloneTile),
    p1Reserve: state.p1Reserve.map(cloneTile),
    p2Board: state.p2Board.map(cloneTile),
    p2Reserve: state.p2Reserve.map(cloneTile),
    phase: state.phase || 'battle',
    availableHeroes: state.availableHeroes ? [...state.availableHeroes] : [],
    bannedHeroes: state.bannedHeroes ? [...state.bannedHeroes] : [],
    banTurn: state.banTurn || 0,
    maxBanTurns: state.maxBanTurns || 14,
    draftTurn: state.draftTurn || 0,
    maxDraftTurns: state.maxDraftTurns || 14,
    p1Picks: state.p1Picks ? [...state.p1Picks] : [],
    p2Picks: state.p2Picks ? [...state.p2Picks] : [],
    battleRoundMoveIndex: state.battleRoundMoveIndex || 0,
    priorityPlayer: state.priorityPlayer || 'player1'
  };
  
  // Handle ban action
  if (move.type === 'ban' && newState.phase === 'ban') {
    if (!newState.availableHeroes.includes(move.heroId)) {
      return newState;
    }
    
    // Remove hero from available pool and add to banned list
    newState.availableHeroes = newState.availableHeroes.filter(id => id !== move.heroId);
    newState.bannedHeroes.push(move.heroId);
    newState.banTurn++;
    
    // Check if ban phase is complete
    if (newState.banTurn >= newState.maxBanTurns) {
      newState.phase = 'draft';
    }
    
    return newState;
  }
  
  // Handle draft action
  if (move.type === 'draft' && newState.phase === 'draft') {
    const hero = HEROES.find(h => h.id === move.heroId);
    if (!hero || !newState.availableHeroes.includes(move.heroId)) {
      return newState; // Invalid pick, return unchanged state
    }
    
    const slotIndex = move.slotIndex !== undefined ? move.slotIndex : 0;
    
    // Remove hero from available pool
    newState.availableHeroes = newState.availableHeroes.filter(id => id !== move.heroId);
    
    // Create hero with defaults
    const heroWithDefaults = {
      ...hero,
      health: hero.health,
      armor: hero.armor || 0,
      speed: hero.speed,
      energy: hero.energy || 0,
      effects: [],
      spells: hero.spells ? {
        front: hero.spells.front ? { ...hero.spells.front } : null,
        middle: hero.spells.middle ? { ...hero.spells.middle } : null,
        back: hero.spells.back ? { ...hero.spells.back } : null
      } : null
    };
    
    // Apply fixed-positional starting row and reserve energy bonus
    if (heroWithDefaults.fixedPositional) {
      const rowIdx = slotIndex >= 9 ? null : indexToRow(slotIndex, isP2Turn ? 'p2' : 'p1');
      const startingRow = slotIndex >= 9 ? 'reserve' : (rowIdx === 0 ? 'front' : (rowIdx === 1 ? 'middle' : 'back'));
      heroWithDefaults._startingRow = startingRow;
    }

    const tile = { hero: heroWithDefaults, _dead: false };
    if (slotIndex >= 9 && heroWithDefaults.fixedPositional && heroWithDefaults.positionalModifiers && heroWithDefaults.positionalModifiers.reserve && typeof heroWithDefaults.positionalModifiers.reserve.energy === 'number') {
      const bonus = Number(heroWithDefaults.positionalModifiers.reserve.energy || 0);
      tile.currentEnergy = (typeof heroWithDefaults.energy === 'number' ? heroWithDefaults.energy : 0) + bonus;
      tile._reserveBonusApplied = true;
    }
    
    // Place directly on board at specified position (9 main board + 2 reserve)
    if (isP2Turn) {
      if (slotIndex < 9) {
        newState.p2Board[slotIndex] = tile;
      } else {
        newState.p2Reserve[slotIndex - 9] = tile;
      }
    } else {
      if (slotIndex < 9) {
        newState.p1Board[slotIndex] = tile;
      } else {
        newState.p1Reserve[slotIndex - 9] = tile;
      }
    }
    
    newState.draftTurn++;
    
    // Check if draft is complete (28 turns: 14 bans + 14 picks)
    if (newState.draftTurn >= newState.maxDraftTurns) {
      newState.phase = 'battle';
    }
    
    return newState; // Return updated draft state
  }
  
  // Battle phase: apply movement
  const board = isP2Turn ? newState.p2Board : newState.p1Board;
  const reserve = isP2Turn ? newState.p2Reserve : newState.p1Reserve;
  
  if (move.type !== 'noop') {
    const fromIndex = move.from;
    const toIndex = move.to;
    
    if (fromIndex < 9 && toIndex < 9) {
      // Swap on main board
      [board[fromIndex], board[toIndex]] = [board[toIndex], board[fromIndex]];
    } else if (fromIndex >= 9 && toIndex < 9) {
      // Move from reserve to main
      board[toIndex] = reserve[fromIndex - 9];
      reserve[fromIndex - 9] = null;
    } else if (fromIndex < 9 && toIndex >= 9) {
      // Move from main to reserve
      reserve[toIndex - 9] = board[fromIndex];
      board[fromIndex] = null;
    } else {
      // Swap in reserve
      [reserve[fromIndex - 9], reserve[toIndex - 9]] = [reserve[toIndex - 9], reserve[fromIndex - 9]];
    }
  }
  
  // If still in ban or draft phase, don't simulate battle
  if (newState.phase === 'ban' || newState.phase === 'draft') {
    return newState;
  }
  
  // Battle phase: increment move counter
  newState.battleRoundMoveIndex++;
  
  // Only execute round after 4th move is complete
  if (newState.battleRoundMoveIndex >= 4) {
    // Reset counter for next round
    newState.battleRoundMoveIndex = 0;
    
    // Simulate battle round
    try {
      const result = await executeRound(newState, {
        castDelayMs: 0,
        postEffectDelayMs: 0,
        reactionDelayMs: 0,
        postCastDelayMs: 0,
        onStep: null,
        quiet: true
      });
      
      // Update priority based on round result
      const p1Health = [...result.p1Board, ...result.p1Reserve]
        .filter(t => t && t.hero && !t._dead)
        .reduce((sum, t) => sum + t.hero.health, 0);
      const p2Health = [...result.p2Board, ...result.p2Reserve]
        .filter(t => t && t.hero && !t._dead)
        .reduce((sum, t) => sum + t.hero.health, 0);
      
      if (p1Health > p2Health) {
        result.priorityPlayer = 'player1';
      } else if (p2Health > p1Health) {
        result.priorityPlayer = 'player2';
      }
      // else keep current priority
      
      return {
        p1Board: result.p1Board || newState.p1Board,
        p1Reserve: result.p1Reserve || newState.p1Reserve,
        p2Board: result.p2Board || newState.p2Board,
        p2Reserve: result.p2Reserve || newState.p2Reserve,
        phase: 'battle',
        battleRoundMoveIndex: 0,
        priorityPlayer: result.priorityPlayer || newState.priorityPlayer
      };
    } catch (error) {
      console.error('[MCTS] Battle simulation error:', error);
      return newState;
    }
  }
  
  // Movement applied but round not executed yet - just return state with updated counter
  return newState;
}

/**
 * Expand a node using neural network policy
 * @param {boolean} addNoise - Whether to add Dirichlet noise for exploration (root node only)
 */
async function expandNode(node, model, addNoise = false) {
  if (node.isTerminal) return;
  if (node.isExpanded) return;
  
  // Get policy and value from neural network
  const stateEncoding = encodeState(node.state);
  const actionMask = getActionMask(node.state, node.isP2Turn);
  
  // Debug: count legal actions
  const legalActionCount = actionMask.reduce((sum, val) => sum + (val > 0 ? 1 : 0), 0);
  
  if (legalActionCount === 0) {
    // No legal actions - treat as terminal node
    node.isTerminal = true;
    node.isExpanded = true;
    return;
  }
  
  const { policy } = await predictWithMask(model, stateEncoding, actionMask);
  
  // For early training, use nearly uniform policy everywhere to force exploration
  const legalCount = actionMask.reduce((sum, val) => sum + val, 0);
  const uniformProb = 1.0 / legalCount;
  let finalPolicy = new Float32Array(ACTION_SPACE_SIZE);
  
  if (addNoise) {
    // Root node: use mostly uniform with small network influence and noise
    const alpha = 0.5;
    const noise = generateDirichletNoise(ACTION_SPACE_SIZE, alpha, actionMask);
    const uniform = POLICY_MIXING.uniform;
    let net = 1 - uniform - POLICY_MIXING.rootNoise;
    if (net < POLICY_MIXING.minNet) {
      net = POLICY_MIXING.minNet;
    }
    const noiseWeight = Math.max(0, 1 - uniform - net);

    for (let i = 0; i < ACTION_SPACE_SIZE; i++) {
      if (actionMask[i] > 0) {
        finalPolicy[i] = uniform * uniformProb + noiseWeight * noise[i] + net * policy[i];
      }
    }
  } else {
    // Non-root nodes: use mostly uniform with small network influence
    const uniform = POLICY_MIXING.uniform;
    const net = Math.max(0.02, 1 - uniform);
    for (let i = 0; i < ACTION_SPACE_SIZE; i++) {
      if (actionMask[i] > 0) {
        finalPolicy[i] = uniform * uniformProb + net * policy[i];
      }
    }
  }
  
  // Create child nodes for all legal actions
  // Collect all legal actions first
  const legalActions = [];
  for (let actionIndex = 0; actionIndex < ACTION_SPACE_SIZE; actionIndex++) {
    if (actionMask[actionIndex] === 0) continue; // Skip illegal actions
    const priorProb = finalPolicy[actionIndex];
    legalActions.push({ actionIndex, priorProb });
  }
  
  // Shuffle to avoid deterministic ordering when probabilities are similar
  for (let i = legalActions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [legalActions[i], legalActions[j]] = [legalActions[j], legalActions[i]];
  }
  
  // Sort by probability descending
  legalActions.sort((a, b) => b.priorProb - a.priorProb);
  
  // Create child nodes for all legal actions (no artificial limit)
  for (let i = 0; i < legalActions.length; i++) {
    const { actionIndex, priorProb } = legalActions[i];
    
    // Determine next player turn based on phase and battle move index
    let nextIsP2Turn = !node.isP2Turn; // Default: alternate
    
    if (node.state.phase === 'battle') {
      // During battle, use priority-based turn order
      // After applying this move, battleRoundMoveIndex will increment
      const nextMoveIndex = ((node.state.battleRoundMoveIndex || 0) + 1) % 4;
      const priorityPlayer = node.state.priorityPlayer || 'player1';
      
      // Priority order: [priority, opponent, opponent, priority]
      const moveOrder = priorityPlayer === 'player1' 
        ? ['player1', 'player2', 'player2', 'player1']
        : ['player2', 'player1', 'player1', 'player2'];
      
      nextIsP2Turn = (moveOrder[nextMoveIndex] === 'player2');
    }
    
    // Create placeholder child (state will be computed when visited)
    const childNode = new MCTSNode(
      null, // State computed lazily
      node,
      actionIndex,
      priorProb,
      nextIsP2Turn
    );
    
    node.children.set(actionIndex, childNode);
  }
  
  node.isExpanded = true;
}

/**
 * Perform one MCTS simulation
 */
async function simulate(root, model, cPuct = 50.0) {
  let node = root;
  const path = [node];
  
  // 1. Selection: traverse tree using UCB until we hit unexpanded node
  while (node.isExpanded && !node.isTerminal && node.children.size > 0) {
    node = node.selectChild(cPuct);
    path.push(node);
  }
  
  // 2. Expansion: if node hasn't been expanded, expand it
  if (!node.isTerminal && !node.isExpanded) {
    // Compute state if not already computed (lazy evaluation)
    if (node.state === null) {
      const move = decodeAction(node.actionTaken);
      node.state = await applyMoveAndSimulate(node.parent.state, move, node.parent.isP2Turn);
    }
    
    // Check if terminal
    if (node.checkTerminal()) {
      let value = node.getTerminalValue();
      
      // Backpropagate with negation at each level
      for (const pathNode of path) {
        pathNode.visitCount++;
        pathNode.valueSum += value;
        value = -value; // Flip for parent
      }
      return;
    }
    
    await expandNode(node, model);
  }
  
  // 3. Evaluation: get value from neural network or terminal state
  let value;
  if (node.isTerminal) {
    value = node.getTerminalValue();
  } else {
    // Compute state if needed
    if (node.state === null && node.parent) {
      const move = decodeAction(node.actionTaken);
      node.state = await applyMoveAndSimulate(node.parent.state, move, node.parent.isP2Turn);
    }
    
    const stateEncoding = encodeState(node.state);
    const actionMask = getActionMask(node.state, node.isP2Turn);
    const prediction = await predictWithMask(model, stateEncoding, actionMask);
    value = prediction.value;
  }
  
  // 4. Backpropagation: update all nodes in path
  // Negate value at each level to maintain player perspective
  for (const pathNode of path) {
    pathNode.visitCount++;
    pathNode.valueSum += value;
    value = -value; // Flip value for parent node (opponent's perspective)
  }
}

/**
 * Run MCTS for a given number of simulations
 * 
 * @param {Object} state - Current game state
 * @param {tf.LayersModel} model - Neural network model
 * @param {number} numSimulations - Number of MCTS simulations
 * @param {boolean} isP2Turn - Whether it's P2's turn
 * @returns {Promise<Object>} { actionProbs, rootValue }
 */
export async function runMCTS(state, model, numSimulations = 100, isP2Turn = true) {
  const root = new MCTSNode(state, null, null, 1.0, isP2Turn);
  
  // Check if already terminal
  if (root.checkTerminal()) {
    const value = root.getTerminalValue();
    return { actionProbs: new Float32Array(ACTION_SPACE_SIZE), rootValue: value };
  }
  
  // Expand root with Dirichlet noise for exploration
  await expandNode(root, model, true);
  
  // Run simulations
  const c_puct = 5.0; // Balanced exploration constant
  for (let i = 0; i < numSimulations; i++) {
    await simulate(root, model, c_puct);
    
    // Yield to browser every 10 simulations to prevent freezing
    if ((i + 1) % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0)); // Yield to event loop
    }
  }
  
  // Extract action probabilities based on visit counts
  const actionProbs = new Float32Array(ACTION_SPACE_SIZE);
  let totalVisits = 0;
  
  for (const [actionIndex, child] of root.children) {
    totalVisits += child.visitCount;
  }
  
  if (totalVisits > 0) {
    for (const [actionIndex, child] of root.children) {
      actionProbs[actionIndex] = child.visitCount / totalVisits;
    }
  }
  
  const rootValue = root.getValue();
  
  return { actionProbs, rootValue };
}

/**
 * Select action based on MCTS results
 * 
 * @param {Float32Array} actionProbs - Action probabilities from MCTS
 * @param {number} temperature - Temperature for sampling
 * @returns {number} Selected action index
 */
export function selectActionFromMCTS(actionProbs, temperature = 1.0) {
  if (temperature === 0) {
    // Greedy: pick most visited
    let maxProb = -1;
    let bestAction = 0;
    for (let i = 0; i < actionProbs.length; i++) {
      if (actionProbs[i] > maxProb) {
        maxProb = actionProbs[i];
        bestAction = i;
      }
    }
    return bestAction;
  }
  
  // Apply temperature
  const temperedProbs = new Float32Array(actionProbs.length);
  let sum = 0;
  for (let i = 0; i < actionProbs.length; i++) {
    if (actionProbs[i] > 0) {
      temperedProbs[i] = Math.pow(actionProbs[i], 1 / temperature);
      sum += temperedProbs[i];
    }
  }
  
  // If all probabilities are 0 (no visits), return action 0 as fallback
  if (sum === 0) {
    return 0;
  }
  
  // Normalize
  for (let i = 0; i < temperedProbs.length; i++) {
    temperedProbs[i] /= sum;
  }
  
  // Sample
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < temperedProbs.length; i++) {
    cumulative += temperedProbs[i];
    if (rand <= cumulative) {
      return i;
    }
  }
  
  return temperedProbs.length - 1;
}
