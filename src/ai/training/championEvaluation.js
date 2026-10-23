import { makeMovementDecision as makeEasyMovementDecision } from '../easyAI.js';
import { saveCandidateScorer } from './candidateScorer.js';
import {
  advanceToNextDecision,
  createTrainingState,
  getCurrentMover,
  getOutcome,
  isLegalMovementAction,
  isTerminal,
  listLegalMovementActions,
} from './environment.js';
import { scoreLegalMovementActions } from './candidateScorer.js';

const DEFAULT_GATE = {
  minGames: 40,
  minEasyWinRate: 0.55,
  minEasyWilsonLowerBound: 0.5,
  minChampionWinRate: 0.5,
  maxRounds: 20,
  maxUnfinishedGames: 0,
};
const DEFAULT_CHAMPION_PATH = 'indexeddb://brimstone-movement-candidate-champion';

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

const mirrorMainBoardForP2Perspective = (board) => {
  const mirrored = new Array(9).fill(null);
  for (let index = 0; index < 9; index += 1) {
    mirrored[index] = board[8 - index] || null;
  }
  return mirrored;
};

const unmirrorP1Token = (token) => {
  const raw = String(token || '');
  if (raw.startsWith('p2Reserve:')) return raw.replace('p2Reserve:', 'p1Reserve:');
  if (!raw.startsWith('p2:')) return null;
  const index = Number(raw.split(':')[1]);
  return Number.isFinite(index) ? `p1:${8 - index}` : null;
};

const normalizeEasyAction = (decision) => {
  if (!decision) return null;
  if (!decision.sourceId || !decision.destinationId) return { ...decision, type: 'move' };
  if (decision.sourceId === decision.destinationId) return { type: 'noop' };
  return { ...decision, type: 'move' };
};

const selectEasyAction = (state, side) => {
  if (side === 'p2') {
    const decision = makeEasyMovementDecision(
      state.p2Main,
      state.p2Reserve,
      { movementPhase: { sequence: ['p2'], index: 0 } },
      state.p1Main,
      state.p1Reserve,
    );
    return normalizeEasyAction(decision);
  }

  const decision = makeEasyMovementDecision(
    mirrorMainBoardForP2Perspective(state.p1Main),
    state.p1Reserve,
    { movementPhase: { sequence: ['p2'], index: 0 } },
    mirrorMainBoardForP2Perspective(state.p2Main),
    state.p2Reserve,
  );
  if (!decision) return null;

  return normalizeEasyAction({
    sourceId: unmirrorP1Token(decision.sourceId),
    destinationId: unmirrorP1Token(decision.destinationId),
  });
};

const selectModelAction = async (model, state, side) => {
  const [best] = await scoreLegalMovementActions(model, state, side);
  return best?.action || null;
};

const selectAction = async (controller, state, side) => {
  const legalActions = listLegalMovementActions(state);
  if (!legalActions.length) {
    return {
      action: { type: 'skip' },
      fallback: null,
      forcedSkip: true,
    };
  }

  if (controller.type === 'oracle') {
    const action = await controller.select(state, side);
    if (action && isLegalMovementAction(state, action)) return { action, fallback: null };
    return {
      action: legalActions[0],
      fallback: action ? 'oracle-illegal-action' : 'oracle-no-action',
      forcedSkip: false,
      attemptedAction: action,
    };
  }

  if (controller.type === 'easy') {
    const action = selectEasyAction(state, side);
    if (action?.type === 'noop' || isLegalMovementAction(state, action)) return { action, fallback: null };
    return {
      action: legalActions[0],
      fallback: action ? 'easyai-illegal-action' : 'easyai-no-action',
      forcedSkip: false,
      attemptedAction: action,
    };
  }

  const action = await selectModelAction(controller.model, state, side);
  if (action && isLegalMovementAction(state, action)) return { action, fallback: null };
  return {
    action: legalActions[0],
    fallback: action ? `${controller.type}-illegal-action` : `${controller.type}-no-action`,
    forcedSkip: false,
    attemptedAction: action,
  };
};

const controllerForSide = (candidateModel, opponent, candidateSide, side) => {
  if (side === candidateSide) return { type: 'candidate', model: candidateModel };
  return opponent.type === 'model'
    ? { type: 'champion', model: opponent.model }
    : { type: 'easy' };
};

export const playMovementControllerMatch = async (initialState, {
    p1Controller,
    p2Controller,
    maxRounds = DEFAULT_GATE.maxRounds,
    seed = 1,
} = {}) => withSeededRandom(seed, async () => {
    if (!p1Controller || !p2Controller) throw new Error('Both movement controllers are required for evaluation');

    let state = createTrainingState(initialState);
    let resolvedRounds = 0;
    const fallbacks = [];
    const forcedSkips = [];

    while (!isTerminal(state) && resolvedRounds < maxRounds) {
      const mover = getCurrentMover(state);
      if (!mover) throw new Error('Evaluation state has no active mover');
      const controller = mover === 'p1' ? p1Controller : p2Controller;
      const selection = await selectAction(controller, state, mover);
      if (selection.fallback) {
        fallbacks.push({
          controller: controller.type,
          mover,
          reason: selection.fallback,
          attemptedAction: selection.attemptedAction || null,
        });
      }
      if (selection.forcedSkip) {
        forcedSkips.push({ controller: controller.type, mover });
      }

      const transition = await advanceToNextDecision(state, selection.action);
      if (!transition.accepted) {
        throw new Error(`Evaluation transition rejected ${selection.action.type || 'move'} action`);
      }
      state = transition.state;
      if (transition.resolvedRound) resolvedRounds += 1;
    }

    const terminalOutcome = getOutcome(state);
    return {
      outcome: terminalOutcome || 'unfinished',
      completed: !!terminalOutcome,
      resolvedRounds,
      fallbacks,
      forcedSkips,
      state,
    };
});

export const playMovementEvaluationMatch = async (initialState, {
  candidateModel,
  opponent = { type: 'easy' },
  candidateSide = 'p2',
  maxRounds = DEFAULT_GATE.maxRounds,
  seed = 1,
} = {}) => {
  if (!candidateModel) throw new Error('Candidate model is required for evaluation');
  if (candidateSide !== 'p1' && candidateSide !== 'p2') throw new Error(`Unsupported candidate side: ${candidateSide}`);

  const result = await playMovementControllerMatch(initialState, {
    p1Controller: controllerForSide(candidateModel, opponent, candidateSide, 'p1'),
    p2Controller: controllerForSide(candidateModel, opponent, candidateSide, 'p2'),
    maxRounds,
    seed,
  });
  const outcome = result.outcome;
  const candidateResult = outcome === candidateSide
    ? 'win'
    : outcome === 'draw'
      ? 'draw'
      : outcome === 'unfinished'
        ? 'unfinished'
        : 'loss';
  return {
    candidateSide,
    candidateResult,
    ...result,
  };
};

const summarizeResults = (matches) => {
  const wins = matches.filter((match) => match.candidateResult === 'win').length;
  const draws = matches.filter((match) => match.candidateResult === 'draw').length;
  const losses = matches.filter((match) => match.candidateResult === 'loss').length;
  const unfinished = matches.filter((match) => match.candidateResult === 'unfinished').length;
  const bySide = {
    p1: { games: 0, wins: 0, draws: 0, losses: 0, unfinished: 0, fallbackCount: 0, forcedSkipCount: 0 },
    p2: { games: 0, wins: 0, draws: 0, losses: 0, unfinished: 0, fallbackCount: 0, forcedSkipCount: 0 },
  };
  const fallbackByController = {};
  const fallbackByReason = {};
  const forcedSkipsByController = {};
  matches.forEach((match) => {
    const side = bySide[match.candidateSide];
    side.games += 1;
    const resultKey = {
      win: 'wins',
      draw: 'draws',
      loss: 'losses',
      unfinished: 'unfinished',
    }[match.candidateResult];
    side[resultKey] += 1;
    side.fallbackCount += match.fallbacks.length;
    side.forcedSkipCount += match.forcedSkips.length;
    match.fallbacks.forEach((fallback) => {
      fallbackByController[fallback.controller] = (fallbackByController[fallback.controller] || 0) + 1;
      fallbackByReason[fallback.reason] = (fallbackByReason[fallback.reason] || 0) + 1;
    });
    match.forcedSkips.forEach((skip) => {
      forcedSkipsByController[skip.controller] = (forcedSkipsByController[skip.controller] || 0) + 1;
    });
  });

  return {
    games: matches.length,
    completedGames: matches.length - unfinished,
    wins,
    draws,
    losses,
    unfinished,
    winRate: matches.length ? wins / matches.length : 0,
    scoreRate: matches.length ? (wins + draws * 0.5) / matches.length : 0,
    fallbackCount: matches.reduce((count, match) => count + match.fallbacks.length, 0),
    bySide,
    fallbackByController,
    fallbackByReason,
    forcedSkipCount: matches.reduce((count, match) => count + match.forcedSkips.length, 0),
    forcedSkipsByController,
  };
};

export const wilsonLowerBound = (successes, total, z = 1.96) => {
  if (!total) return 0;
  const proportion = successes / total;
  const denominator = 1 + (z ** 2) / total;
  const centre = proportion + (z ** 2) / (2 * total);
  const margin = z * Math.sqrt((proportion * (1 - proportion) + (z ** 2) / (4 * total)) / total);
  return (centre - margin) / denominator;
};

const evaluateOpponent = async (scenarios, candidateModel, opponent, options) => {
  const matches = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    for (const candidateSide of ['p1', 'p2']) {
      const match = await playMovementEvaluationMatch(scenario.state || scenario, {
        candidateModel,
        opponent,
        candidateSide,
        maxRounds: options.maxRounds,
        seed: options.seed + index * 101 + (candidateSide === 'p1' ? 0 : 1),
      });
      matches.push(match);
      if (typeof options.onMatchComplete === 'function') {
        options.onMatchComplete({
          benchmark: opponent.type === 'model' ? 'champion' : 'easyai',
          scenarioId: scenario.id || null,
          ...match,
        });
      }
    }
    if (typeof options.onProgress === 'function') {
      options.onProgress({
        completed: index + 1,
        total: scenarios.length,
        benchmark: opponent.type === 'model' ? 'champion' : 'easyai',
      });
    }
  }
  return summarizeResults(matches);
};

export const evaluateCandidate = async ({
  candidateModel,
  championModel = null,
  scenarios,
  maxRounds = DEFAULT_GATE.maxRounds,
  seed = 1,
  onProgress = null,
  onMatchComplete = null,
} = {}) => {
  if (!Array.isArray(scenarios) || !scenarios.length) throw new Error('At least one evaluation scenario is required');

  const options = { maxRounds, seed };
  const againstEasy = await evaluateOpponent(scenarios, candidateModel, { type: 'easy' }, {
    ...options,
    onProgress,
    onMatchComplete,
  });
  const againstChampion = championModel
    ? await evaluateOpponent(scenarios, candidateModel, { type: 'model', model: championModel }, {
      ...options,
      onProgress,
      onMatchComplete,
    })
    : null;

  return { againstEasy, againstChampion };
};

export const evaluatePromotionGate = (evaluation, gate = {}) => {
  const config = { ...DEFAULT_GATE, ...gate };
  const easy = evaluation.againstEasy;
  const easyWilsonLowerBound = wilsonLowerBound(easy.wins, easy.games);
  const checks = {
    enoughEasyGames: easy.games >= config.minGames,
    easyWinRate: easy.winRate >= config.minEasyWinRate,
    easyConfidence: easyWilsonLowerBound >= config.minEasyWilsonLowerBound,
    noUnfinishedGames: easy.unfinished <= config.maxUnfinishedGames,
    championWinRate: !evaluation.againstChampion || evaluation.againstChampion.winRate >= config.minChampionWinRate,
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    easyWilsonLowerBound,
    config,
  };
};

export const evaluateAndPromoteCandidate = async ({
  candidateModel,
  championModel = null,
  scenarios,
  gate,
  maxRounds,
  seed,
  onPromote,
} = {}) => {
  const evaluation = await evaluateCandidate({
    candidateModel,
    championModel,
    scenarios,
    maxRounds,
    seed,
  });
  const promotion = evaluatePromotionGate(evaluation, gate);
  if (promotion.passed && onPromote) await onPromote(candidateModel, { evaluation, promotion });
  return { evaluation, promotion };
};

export const savePromotedChampion = async (model, path = DEFAULT_CHAMPION_PATH) => saveCandidateScorer(model, path);
