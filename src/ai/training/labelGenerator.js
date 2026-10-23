import { evaluateHeroPoints } from '../easyAI.js';
import {
  advanceToNextDecision,
  applyMovementAction,
  createTrainingState,
  getCurrentMover,
  isTerminal,
  listLegalMovementActions,
} from './environment.js';

const TERMINAL_SCORE = 100000;

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

const scoreSide = (state, side) => {
  const ownMain = side === 'p1' ? state.p1Main : state.p2Main;
  const ownReserve = side === 'p1' ? state.p1Reserve : state.p2Reserve;
  const enemyMain = side === 'p1' ? state.p2Main : state.p1Main;
  const enemyReserve = side === 'p1' ? state.p2Reserve : state.p1Reserve;
  const isP2 = side === 'p2';

  return [...ownMain, ...ownReserve].reduce((score, tile, index) => {
    if (!tile?.hero || tile._dead) return score;
    const tileIndex = index < ownMain.length ? index : -1 - (index - ownMain.length);
    return score + evaluateHeroPoints(
      tile.hero,
      tileIndex,
      isP2,
      enemyMain,
      enemyReserve,
      ownMain,
      ownReserve,
      tile,
    );
  }, 0);
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

  return scoreSide(state, perspectiveSide) - scoreSide(state, opponent);
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
} = {}) => {
  const state = createTrainingState(scenario.state || scenario);
  const perspectiveSide = getCurrentMover(state);
  if (!perspectiveSide) throw new Error('Movement scenario has no active mover');

  const actions = listLegalMovementActions(state).sort(compareActions);
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
