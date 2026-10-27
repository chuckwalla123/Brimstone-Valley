import { evaluateEasyAIPlusPosition } from './easyAIPlusTeacher.js';
import {
  advanceToNextDecision,
  applyMovementAction,
  createTrainingState,
  getCurrentMover,
  getMovementSequence,
  isTerminal,
  listLegalMovementActions,
} from './environment.js';

const TERMINAL_SCORE = 100000;
export const MOVEMENT_LABEL_EVALUATOR = 'easyplus-position-v1';

const compareActions = (left, right) => {
  const leftKey = `${left.sourceId || ''}:${left.destinationId || ''}:${left.type || ''}`;
  const rightKey = `${right.sourceId || ''}:${right.destinationId || ''}:${right.type || ''}`;
  return leftKey.localeCompare(rightKey);
};

const actionKey = (action) => `${action.type}:${action.sourceId || ''}:${action.destinationId || ''}`;

const createSeededRandom = (seed) => {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const withSeededRandom = async (seed, callback) => {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return await callback();
  } finally {
    Math.random = originalRandom;
  }
};

const mirrorMainBoard = (board) => Array.from({ length: 9 }, (_, index) => board[8 - index] || null);

const evaluateEasyAIPlusPositionForSide = (state, side) => {
  const isP2 = side === 'p2';
  const ownMain = isP2 ? state.p2Main : mirrorMainBoard(state.p1Main);
  const ownReserve = isP2 ? state.p2Reserve : state.p1Reserve;
  const enemyMain = isP2 ? state.p1Main : mirrorMainBoard(state.p2Main);
  const enemyReserve = isP2 ? state.p1Reserve : state.p2Reserve;
  const sequence = getMovementSequence(state.priorityPlayer);
  const opponentHasLastMove = sequence[sequence.length - 1] !== side
    && state.movementIndex < sequence.length - 1;

  return evaluateEasyAIPlusPosition(ownMain, ownReserve, enemyMain, enemyReserve, {
    opponentHasLastMove,
  }).totalScore;
};

export const evaluateMovementState = (state, perspectiveSide) => {
  const opponent = perspectiveSide === 'p1' ? 'p2' : 'p1';
  const ownAlive = [...state[`${perspectiveSide}Main`], ...state[`${perspectiveSide}Reserve`]]
    .some((tile) => tile?.hero && !tile._dead);
  const opponentAlive = [...state[`${opponent}Main`], ...state[`${opponent}Reserve`]]
    .some((tile) => tile?.hero && !tile._dead);

  if (!ownAlive || !opponentAlive) {
    if (ownAlive === opponentAlive) return 0;
    return ownAlive ? TERMINAL_SCORE : -TERMINAL_SCORE;
  }

  return evaluateEasyAIPlusPositionForSide(state, perspectiveSide);
};

const rankActions = (state, perspectiveSide, moverSide) => {
  const actions = listLegalMovementActions(state);
  const ranked = actions.map((action) => {
    const result = applyMovementAction(state, action);
    return {
      action,
      staticScore: evaluateMovementState(result.state, perspectiveSide),
    };
  });
  const direction = moverSide === perspectiveSide ? -1 : 1;

  return ranked.sort((left, right) => {
    const scoreDifference = direction * (left.staticScore - right.staticScore);
    if (scoreDifference !== 0) return scoreDifference;
    return compareActions(left.action, right.action);
  });
};

const runGreedyRollout = async (state, perspectiveSide) => {
  let current = state;
  while (!isTerminal(current)) {
    const mover = getCurrentMover(current);
    if (!mover) return current;

    const [best] = rankActions(current, perspectiveSide, mover);
    const action = best?.action || { type: 'skip' };
    const transition = await advanceToNextDecision(current, action);
    if (!transition.accepted) {
      throw new Error(`Unable to advance movement rollout with ${actionKey(action)}`);
    }
    current = transition.state;
    if (transition.resolvedRound) return current;
  }
  return current;
};

const simulateCandidate = async (state, action, perspectiveSide, maxResponses, seed) => {
  const firstTransition = await advanceToNextDecision(state, action);
  if (!firstTransition.accepted) {
    throw new Error(`Illegal root action supplied to label generator: ${actionKey(action)}`);
  }
  if (firstTransition.resolvedRound || isTerminal(firstTransition.state)) {
    return {
      score: evaluateMovementState(firstTransition.state, perspectiveSide),
      responseAction: null,
    };
  }

  const responseMover = getCurrentMover(firstTransition.state);
  const rankedResponses = rankActions(firstTransition.state, perspectiveSide, responseMover)
    .slice(0, Math.max(1, maxResponses));
  const responses = rankedResponses.length ? rankedResponses.map((entry) => entry.action) : [{ type: 'skip' }];
  const responseScores = [];

  for (let index = 0; index < responses.length; index += 1) {
    const responseAction = responses[index];
    const score = await withSeededRandom(seed + index + 1, async () => {
      const responseTransition = await advanceToNextDecision(firstTransition.state, responseAction);
      if (!responseTransition.accepted) {
        throw new Error(`Illegal response action supplied to label generator: ${actionKey(responseAction)}`);
      }
      const result = responseTransition.resolvedRound
        ? responseTransition.state
        : await runGreedyRollout(responseTransition.state, perspectiveSide);
      return evaluateMovementState(result, perspectiveSide);
    });
    responseScores.push({ action: responseAction, score });
  }

  const responseIsFriendly = responseMover === perspectiveSide;
  responseScores.sort((left, right) => {
    const difference = responseIsFriendly ? right.score - left.score : left.score - right.score;
    if (difference !== 0) return difference;
    return compareActions(left.action, right.action);
  });

  return {
    score: responseScores[0].score,
    responseAction: responseScores[0].action,
  };
};

export const generateMovementLabels = async (scenario, {
  maxResponses = 8,
  seed = 1,
  actions: restrictedActions = null,
} = {}) => {
  const state = createTrainingState(scenario.state || scenario);
  const perspectiveSide = getCurrentMover(state);
  if (!perspectiveSide) throw new Error('Movement scenario has no active mover');

  // An optional shortlist limits the search to those legal actions (used by the hybrid selector).
  const legalActions = listLegalMovementActions(state);
  const allowedKeys = restrictedActions ? new Set(restrictedActions.map(actionKey)) : null;
  const actions = (allowedKeys ? legalActions.filter((action) => allowedKeys.has(actionKey(action))) : legalActions)
    .sort(compareActions);
  if (!actions.length) throw new Error(`Movement scenario ${scenario.id || 'unnamed'} has no legal actions`);

  const labels = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const result = await withSeededRandom(seed + index * 1009, () => (
      simulateCandidate(state, action, perspectiveSide, maxResponses, seed + index * 1009)
    ));
    labels.push({
      action,
      score: result.score,
      responseAction: result.responseAction,
    });
  }

  labels.sort((left, right) => {
    const difference = right.score - left.score;
    if (difference !== 0) return difference;
    return compareActions(left.action, right.action);
  });

  return {
    scenarioId: scenario.id || null,
    evaluator: MOVEMENT_LABEL_EVALUATOR,
    perspectiveSide,
    state,
    labels,
    bestAction: labels[0].action,
    bestScore: labels[0].score,
  };
};

export const generateCorpusLabels = async (scenarios, {
  onProgress = null,
  ...options
} = {}) => {
  const labels = [];
  for (let index = 0; index < (scenarios || []).length; index += 1) {
    const labelSet = await generateMovementLabels(scenarios[index], {
      ...options,
      seed: Number(options.seed || 1) + index * 100003,
    });
    labels.push(labelSet);
    if (typeof onProgress === 'function') {
      onProgress({
        completed: index + 1,
        total: scenarios.length,
        scenarioId: labelSet.scenarioId,
        labelCount: labelSet.labels.length,
      });
    }
  }
  return labels;
};
