/**
 * Self-Play Game Generator
 * 
 * Generates training data by having the AI play games against itself.
 * Each move is guided by MCTS, producing high-quality training examples.
 */

import { runMCTS, selectActionFromMCTS } from './mcts.js';
import { encodeState, decodeAction, getActionMask } from './stateEncoder.js';
import { executeRound } from '../../battleEngine.js';
import { indexToRow } from '../../targeting.js';
import { HEROES } from '../../heroes.js';

/**
 * Apply a move to the state
 */
function applyMove(state, move, isP2Turn) {
  const newState = {
    p1Board: state.p1Board.map(t => t ? { ...t, hero: t.hero ? { ...t.hero } : null } : null),
    p1Reserve: state.p1Reserve.map(t => t ? { ...t, hero: t.hero ? { ...t.hero } : null } : null),
    p2Board: state.p2Board.map(t => t ? { ...t, hero: t.hero ? { ...t.hero } : null } : null),
    p2Reserve: state.p2Reserve.map(t => t ? { ...t, hero: t.hero ? { ...t.hero } : null } : null),
    phase: state.phase || 'battle',
    round1Executed: state.round1Executed || false,
    availableHeroes: state.availableHeroes ? [...state.availableHeroes] : [],
    bannedHeroes: state.bannedHeroes ? [...state.bannedHeroes] : [],
    draftTurn: state.draftTurn || 0,
    maxDraftTurns: state.maxDraftTurns || 28,
    p1Picks: state.p1Picks ? [...state.p1Picks] : [],
    p2Picks: state.p2Picks ? [...state.p2Picks] : [],
    p1Bans: state.p1Bans || 0,
    p2Bans: state.p2Bans || 0,
    battleRoundMoveIndex: state.battleRoundMoveIndex || 0,
    priorityPlayer: state.priorityPlayer || 'player1'
  };
  
  // Handle ban action during draft phase
  if (move.type === 'ban' && newState.phase === 'draft') {
    if (!newState.availableHeroes.includes(move.heroId)) {
      return newState;
    }
    
    // Remove hero from available pool and add to banned list
    newState.availableHeroes = newState.availableHeroes.filter(id => id !== move.heroId);
    newState.bannedHeroes.push(move.heroId);
    
    if (isP2Turn) {
      newState.p2Bans++;
    } else {
      newState.p1Bans++;
    }
    
    newState.draftTurn++;
    
    // Check if draft is complete (28 turns: 14 bans + 14 picks)
    if (newState.draftTurn >= newState.maxDraftTurns) {
      newState.phase = 'battle';
      
      // Place picks on boards
      for (let i = 0; i < newState.p1Picks.length; i++) {
        const tile = { hero: newState.p1Picks[i], _dead: false };
        if (i < 9) {
          newState.p1Board[i] = tile;
        } else {
          newState.p1Reserve[i - 9] = tile;
        }
      }
      
      for (let i = 0; i < newState.p2Picks.length; i++) {
        const tile = { hero: newState.p2Picks[i], _dead: false };
        if (i < 9) {
          newState.p2Board[i] = tile;
        } else {
          newState.p2Reserve[i - 9] = tile;
        }
      }
    }
    
    return newState;
  }
  
  // Handle draft pick action during draft phase
  if (move.type === 'draft' && newState.phase === 'draft') {
    const hero = HEROES.find(h => h.id === move.heroId);
    if (!hero || !newState.availableHeroes.includes(move.heroId)) {
      return newState;
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
    
    // Place directly on board at specified position
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
    
    const slotType = slotIndex < 9 ? 'main' : 'reserve';
    const slotPos = slotType === 'main' ? slotIndex : slotIndex - 9;
    console.log(`[Draft Pick] ${isP2Turn ? 'P2' : 'P1'} ${heroWithDefaults.name || heroWithDefaults.id} -> ${slotType}:${slotPos}`);

    // Check if draft is complete (28 turns: 14 bans + 14 picks)
    if (newState.draftTurn >= newState.maxDraftTurns) {
      newState.phase = 'battle';
      newState.round1Executed = false;
    }
    
    return newState;
  }
  
  // Battle phase: handle movement
  const board = isP2Turn ? newState.p2Board : newState.p1Board;
  const reserve = isP2Turn ? newState.p2Reserve : newState.p1Reserve;
  
  if (move.type === 'noop') {
    const moveIdx = (newState.battleRoundMoveIndex ?? 0) + 1;
    const prio = newState.priorityPlayer || (isP2Turn ? 'player2' : 'player1');
    console.log(`[Movement] ${isP2Turn ? 'P2' : 'P1'} noop (prio:${prio}, move ${moveIdx}/4)`);
    return newState;
  }
  
  const fromIndex = move.from;
  const toIndex = move.to;
  
  if (fromIndex < 9 && toIndex < 9) {
    [board[fromIndex], board[toIndex]] = [board[toIndex], board[fromIndex]];
  } else if (fromIndex >= 9 && toIndex < 9) {
    board[toIndex] = reserve[fromIndex - 9];
    reserve[fromIndex - 9] = null;
  } else if (fromIndex < 9 && toIndex >= 9) {
    reserve[toIndex - 9] = board[fromIndex];
    board[fromIndex] = null;
  } else {
    [reserve[fromIndex - 9], reserve[toIndex - 9]] = [reserve[toIndex - 9], reserve[fromIndex - 9]];
  }
  
  const moveIdx = (newState.battleRoundMoveIndex ?? 0) + 1;
  const prio = newState.priorityPlayer || (isP2Turn ? 'player2' : 'player1');
  console.log(`[Movement] ${isP2Turn ? 'P2' : 'P1'} ${move.type} ${fromIndex}->${toIndex} (prio:${prio}, move ${moveIdx}/4)`);
  return newState;
}

/**
 * Check if game is over
 */
function isGameOver(state) {
  const p1Alive = [...state.p1Board, ...state.p1Reserve].some(t => t && t.hero && !t._dead);
  const p2Alive = [...state.p2Board, ...state.p2Reserve].some(t => t && t.hero && !t._dead);
  
  return !p1Alive || !p2Alive;
}

/**
 * Get game outcome from P2's perspective
 */
function getOutcome(state) {
  const p1Alive = [...state.p1Board, ...state.p1Reserve].some(t => t && t.hero && !t._dead);
  const p2Alive = [...state.p2Board, ...state.p2Reserve].some(t => t && t.hero && !t._dead);
  
  if (!p2Alive) return -1; // P1 wins
  if (!p1Alive) return 1;  // P2 wins
  return 0; // Draw
}

/**
 * Play one self-play game
 * 
 * @param {tf.LayersModel} model - Neural network model
 * @param {number} numSimulations - MCTS simulations per move
 * @param {number} temperature - Sampling temperature
 * @returns {Promise<Array>} Training examples: [{ state, policy, value }, ...]
 */
export async function playSelfPlayGame(model, draftSimulations = 100, battleSimulations = 25, temperature = 1.0) {
  // Build the action queue matching game rules: opponent ban, then player pick
  const picks = [
    'player1','player2','player2','player1','player1','player2','player2',
    'player1','player1','player2','player2','player1','player1','player2'
  ];
  const actionQueue = [];
  for (const p of picks) {
    const opponent = p === 'player1' ? 'player2' : 'player1';
    actionQueue.push({ type: 'ban', player: opponent });
    actionQueue.push({ type: 'pick', player: p });
  }
  
  // Initialize draft state
  const availableHeroes = [...HEROES].map(h => h.id);
  let state = {
    p1Board: new Array(9).fill(null),
    p1Reserve: new Array(2).fill(null),
    p2Board: new Array(9).fill(null),
    p2Reserve: new Array(2).fill(null),
    phase: 'draft', // Single phase for both bans and picks
    round1Executed: false,
    availableHeroes,
    bannedHeroes: [],
    draftTurn: 0,
    maxDraftTurns: 28, // 14 bans + 14 picks
    p1Picks: [],
    p2Picks: [],
    p1Bans: 0,
    p2Bans: 0,
    battleRoundMoveIndex: 0,
    priorityPlayer: 'player1'
  };
  
  const trainingExamples = [];
  let turnNumber = 0;
  const maxTurns = 74; // Draft (28) + Battle (up to 46)
  let priorityPlayer = 'player1'; // P1 has priority initially
  let battleRoundMoveIndex = 0; // Track which of the 4 moves in current battle round
  
  // Main game loop (draft + battle)
  while (turnNumber < maxTurns) {
    turnNumber++;
    
    // Determine current action and player
    let isP2Turn;
    let playerName;
    let actionType;
    
    if (state.phase === 'draft' && state.draftTurn < 28) {
      const currentAction = actionQueue[state.draftTurn];
      isP2Turn = currentAction.player === 'player2';
      actionType = currentAction.type;
      const actionNum = Math.floor(state.draftTurn / 2) + 1;
      playerName = `${isP2Turn ? 'P2' : 'P1'} (${actionType} ${actionNum}/14)`;
      
      // Store expected action type in state for action masking
      state.expectedActionType = actionType;
    } else {
      // Battle phase: 4 movements per round based on priority
      // Priority player goes: 1st and 4th
      // Non-priority player goes: 2nd and 3rd
      battleRoundMoveIndex = state.battleRoundMoveIndex ?? battleRoundMoveIndex;
      priorityPlayer = state.priorityPlayer || priorityPlayer;
      const moveOrder = priorityPlayer === 'player1' 
        ? ['player1', 'player2', 'player2', 'player1']
        : ['player2', 'player1', 'player1', 'player2'];
      
      const currentMovePlayer = moveOrder[battleRoundMoveIndex];
      isP2Turn = currentMovePlayer === 'player2';
      actionType = 'move';
      const battleTurnNum = turnNumber - 28;
      const roundNum = Math.floor((battleTurnNum - 1) / 4) + 2; // +2 because Round 1 already executed
      const moveInRound = battleRoundMoveIndex + 1; // Display as 1-indexed
      playerName = `${isP2Turn ? 'P2' : 'P1'} (Battle R${roundNum} move ${moveInRound}/4)`;
      state.expectedActionType = 'move';
    }
    
    // Yield to browser
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check if game is over (only check in battle phase)
    if (state.phase === 'battle' && isGameOver(state)) {
      break;
    }

    // Execute Round 1 immediately after draft (no movements before it)
    if (state.phase === 'battle' && !state.round1Executed) {
      try {
        const result = await executeRound(state, {
          castDelayMs: 0,
          postEffectDelayMs: 0,
          reactionDelayMs: 0,
          postCastDelayMs: 0,
          onStep: null,
          quiet: true
        });
        if (result.priorityPlayer) {
          priorityPlayer = result.priorityPlayer;
        }
        state = {
          p1Board: result.p1Board || state.p1Board,
          p1Reserve: result.p1Reserve || state.p1Reserve,
          p2Board: result.p2Board || state.p2Board,
          p2Reserve: result.p2Reserve || state.p2Reserve,
          phase: 'battle',
          round1Executed: true,
          battleRoundMoveIndex: 0,
          priorityPlayer
        };
        const p1Alive = [...state.p1Board, ...state.p1Reserve].filter(t => t && t.hero && !t._dead).length;
        const p2Alive = [...state.p2Board, ...state.p2Reserve].filter(t => t && t.hero && !t._dead).length;
        console.log(`[Round Executed] Round 1 resolved. Alive P1=${p1Alive}, P2=${p2Alive}, priority=${priorityPlayer}`);
      } catch (error) {
        console.error('[Self-Play] Round 1 execution error:', error);
      }
      continue;
    }
    
    // Run MCTS to get move probabilities (use more simulations for draft, fewer for battle)
    const currentSimulations = state.phase === 'draft' ? draftSimulations : battleSimulations;
    const { actionProbs, rootValue } = await runMCTS(state, model, currentSimulations, isP2Turn);
    
    // Store training example (state, policy, placeholder value)
    const stateEncoding = encodeState(state);
    trainingExamples.push({
      state: stateEncoding,
      policy: actionProbs,
      isP2Turn,
      value: 0, // Will be filled in with game outcome
      draftValue: state.phase === 'draft' ? 0 : null // Will be filled in after outcome is known
    });
    
    // Select action
    const actionIndex = selectActionFromMCTS(actionProbs, temperature);
    const move = decodeAction(actionIndex);
    
    // Apply move (handles both draft and battle)
    state = applyMove(state, move, isP2Turn);
    
    // In battle phase, execute round after 4th movement
    if (state.phase === 'battle') {
      battleRoundMoveIndex++;
      state.battleRoundMoveIndex = battleRoundMoveIndex;
      state.priorityPlayer = priorityPlayer;
      
      // After 4 movements, execute the battle round
      if (battleRoundMoveIndex >= 4) {
        battleRoundMoveIndex = 0; // Reset for next round
        
        try {
          const result = await executeRound(state, {
            castDelayMs: 0,
            postEffectDelayMs: 0,
            reactionDelayMs: 0,
            postCastDelayMs: 0,
            onStep: null,
            quiet: true
          });
          
          // Update priority for next round
          if (result.priorityPlayer) {
            priorityPlayer = result.priorityPlayer;
          }
          
          state = {
            p1Board: result.p1Board || state.p1Board,
            p1Reserve: result.p1Reserve || state.p1Reserve,
            p2Board: result.p2Board || state.p2Board,
            p2Reserve: result.p2Reserve || state.p2Reserve,
            phase: 'battle',
            round1Executed: true,
            battleRoundMoveIndex: 0,
            priorityPlayer: priorityPlayer
          };
          const p1Alive = [...state.p1Board, ...state.p1Reserve].filter(t => t && t.hero && !t._dead).length;
          const p2Alive = [...state.p2Board, ...state.p2Reserve].filter(t => t && t.hero && !t._dead).length;
          console.log(`[Round Executed] Round ${Math.floor((turnNumber - 29) / 4) + 2} resolved. Alive P1=${p1Alive}, P2=${p2Alive}, priority=${priorityPlayer}`);
        } catch (error) {
          console.error('[Self-Play] Battle simulation error:', error);
        }
      }
    }
    
  }
  
  // Fill in game outcome for all training examples
  const outcome = getOutcome(state);
  for (const example of trainingExamples) {
    // Value from P2's perspective (P2 is the learning player)
    example.value = example.isP2Turn ? outcome : -outcome;
    // Draft value: only meaningful for draft-phase states
    if (example.draftValue !== null && example.draftValue !== undefined) {
      example.draftValue = example.isP2Turn ? outcome : -outcome;
    } else {
      example.draftValue = 0;
    }
  }
  
  return trainingExamples;
}

/**
 * Generate a batch of self-play games
 * 
 * @param {tf.LayersModel} model
 * @param {number} numGames
 * @param {number} numSimulations
 * @param {number} temperature
 * @returns {Promise<Array>} All training examples
 */
export async function generateSelfPlayBatch(model, numGames = 10, draftSimulations = 100, battleSimulations = 25, temperature = 1.0) {
  const allExamples = [];
  
  for (let i = 0; i < numGames; i++) {
    console.log(`[Game ${i + 1}/${numGames}]`);
    
    try {
      const examples = await playSelfPlayGame(model, draftSimulations, battleSimulations, temperature);
      allExamples.push(...examples);
    } catch (error) {
      console.error(`[Self-Play] Error in game ${i + 1}:`, error);
      console.error('[Self-Play] Error stack:', error.stack);
    }
  }
  
  return allExamples;
}

/**
 * Save training examples to storage
 */
export function saveTrainingExamples(examples, filename = 'training_data.json') {
  try {
    const buildPayload = (exampleList) => JSON.stringify({
      examples: exampleList.map(ex => ({
        state: Array.from(ex.state),
        policy: Array.from(ex.policy),
        value: ex.value,
        isP2Turn: ex.isP2Turn
      })),
      timestamp: Date.now(),
      count: exampleList.length
    });
    let data = buildPayload(examples);
    
    // Store in localStorage (for browser) or file system (for Node.js)
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(filename, data);
        return data;
      } catch (storageError) {
        const isQuota = storageError && (
          storageError.name === 'QuotaExceededError' ||
          storageError.code === 22
        );
        if (!isQuota) {
          throw storageError;
        }

        // Quota exceeded: save a smaller recent subset for persistence
        const fallbackSizes = [5000, 2000, 1000, 500];
        for (const size of fallbackSizes) {
          const subset = examples.length > size ? examples.slice(-size) : examples;
          try {
            data = buildPayload(subset);
            localStorage.setItem(filename, data);
            console.warn(`[Self-Play] Storage quota hit. Saved last ${subset.length} examples instead.`);
            return data;
          } catch (retryError) {
            const retryIsQuota = retryError && (
              retryError.name === 'QuotaExceededError' ||
              retryError.code === 22
            );
            if (!retryIsQuota) {
              throw retryError;
            }
          }
        }

        console.error('[Self-Play] Storage quota exceeded. Unable to save training examples.');
        return null;
      }
    }

    return data;
  } catch (error) {
    console.error('[Self-Play] Error saving training examples:', error);
    return null;
  }
}

/**
 * Load training examples from storage
 */
export function loadTrainingExamples(filename = 'training_data.json') {
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    
    const data = localStorage.getItem(filename);
    if (!data) {
      return [];
    }
    
    const parsed = JSON.parse(data);
    const examples = parsed.examples.map(ex => ({
      state: new Float32Array(ex.state),
      policy: new Float32Array(ex.policy),
      value: ex.value,
      isP2Turn: ex.isP2Turn,
      draftValue: (ex.draftValue !== undefined && ex.draftValue !== null) ? ex.draftValue : 0
    }));
    return examples;
  } catch (error) {
    console.error('[Self-Play] Error loading training examples:', error);
    return [];
  }
}
