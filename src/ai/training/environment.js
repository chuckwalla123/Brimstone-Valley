import { executeRound } from '../../battleEngine.js';
import { deepClone } from '../../../shared/gameLogic.js';

const MAIN_SIZE = 9;
const RESERVE_SIZE = 2;

const cloneBoard = (board, size) => {
  const source = Array.isArray(board) ? board : [];
  return Array.from({ length: size }, (_, index) => deepClone(source[index] ?? null));
};

const isAliveTile = (tile) => !!(tile && tile.hero && !tile._dead);

const countsTowardMainLimit = (tile) => (
  isAliveTile(tile) && !tile._revivedExtra && tile.hero.isMinion !== true
);

const hasPreventMovement = (tile) => {
  const effects = Array.isArray(tile?.effects)
    ? tile.effects
    : (Array.isArray(tile?.hero?.effects) ? tile.hero.effects : []);
  return effects.some((effect) => effect && effect.preventMovement);
};

const normalizePrioritySide = (priorityPlayer) => {
  const priority = String(priorityPlayer || '').toLowerCase();
  return priority === 'p2' || priority === 'player2' ? 'p2' : 'p1';
};

const toPriorityPlayer = (side) => side === 'p2' ? 'player2' : 'player1';

export const getMovementSequence = (priorityPlayer) => (
  normalizePrioritySide(priorityPlayer) === 'p1'
    ? ['p1', 'p2', 'p2', 'p1']
    : ['p2', 'p1', 'p1', 'p2']
);

export const parseMovementToken = (token) => {
  const raw = String(token || '');
  const match = /^(p[12])(Reserve)?:([0-9]+)$/.exec(raw);
  if (!match) return null;

  return {
    side: match[1],
    isReserve: !!match[2],
    index: Number(match[3]),
  };
};

const tokenFor = (side, isReserve, index) => `${side}${isReserve ? 'Reserve' : ''}:${index}`;

const getBoardKey = (side, isReserve) => `${side}${isReserve ? 'Reserve' : 'Main'}`;

const getBoard = (state, parsedToken) => state[getBoardKey(parsedToken.side, parsedToken.isReserve)];

const getNoopAction = (state, side) => {
  const main = state[`${side}Main`];
  for (let index = 0; index < main.length; index += 1) {
    if (isAliveTile(main[index]) && !hasPreventMovement(main[index])) {
      const token = tokenFor(side, false, index);
      return { type: 'move', sourceId: token, destinationId: token };
    }
  }

  const reserve = state[`${side}Reserve`];
  for (let index = 0; index < reserve.length; index += 1) {
    if (isAliveTile(reserve[index]) && !hasPreventMovement(reserve[index])) {
      const token = tokenFor(side, true, index);
      return { type: 'move', sourceId: token, destinationId: token };
    }
  }

  return null;
};

export const createTrainingState = (state = {}) => ({
  p1Main: cloneBoard(state.p1Main ?? state.p1Board, MAIN_SIZE),
  p1Reserve: cloneBoard(state.p1Reserve, RESERVE_SIZE),
  p2Main: cloneBoard(state.p2Main ?? state.p2Board, MAIN_SIZE),
  p2Reserve: cloneBoard(state.p2Reserve, RESERVE_SIZE),
  priorityPlayer: toPriorityPlayer(normalizePrioritySide(state.priorityPlayer)),
  roundNumber: Math.max(1, Number(state.roundNumber || 1)),
  movementIndex: Math.max(0, Number(state.movementIndex || 0)),
  lastCastActionBySide: deepClone(state.lastCastActionBySide || null),
  gameMode: state.gameMode || 'classic',
});

export const getCurrentMover = (state) => {
  const sequence = getMovementSequence(state.priorityPlayer);
  return sequence[state.movementIndex] || null;
};

export const isLegalMovementAction = (state, action) => {
  if (!action || action.type !== 'move') return false;

  const source = parseMovementToken(action.sourceId);
  const destination = parseMovementToken(action.destinationId);
  const mover = getCurrentMover(state);
  if (!source || !destination || source.side !== destination.side || source.side !== mover) return false;

  const sourceBoard = getBoard(state, source);
  const destinationBoard = getBoard(state, destination);
  if (!Array.isArray(sourceBoard) || !Array.isArray(destinationBoard)) return false;
  if (source.index < 0 || source.index >= sourceBoard.length) return false;
  if (destination.index < 0 || destination.index >= destinationBoard.length) return false;

  const sourceTile = sourceBoard[source.index];
  const destinationTile = destinationBoard[destination.index];
  if (!isAliveTile(sourceTile) || hasPreventMovement(sourceTile) || hasPreventMovement(destinationTile)) return false;

  if (source.isReserve && !destination.isReserve) {
    const main = state[`${source.side}Main`];
    const mainAliveCount = main.filter(countsTowardMainLimit).length;
    if (!countsTowardMainLimit(destinationTile) && mainAliveCount >= 5) return false;
  }

  return true;
};

export const listLegalMovementActions = (state) => {
  const mover = getCurrentMover(state);
  if (!mover) return [];

  const actions = [];
  const sourceBoards = [
    { board: state[`${mover}Main`], isReserve: false },
    { board: state[`${mover}Reserve`], isReserve: true },
  ];
  const destinationBoards = sourceBoards;

  sourceBoards.forEach(({ board: sourceBoard, isReserve: sourceIsReserve }) => {
    sourceBoard.forEach((sourceTile, sourceIndex) => {
      if (!isAliveTile(sourceTile) || hasPreventMovement(sourceTile)) return;

      destinationBoards.forEach(({ board: destinationBoard, isReserve: destinationIsReserve }) => {
        destinationBoard.forEach((_, destinationIndex) => {
          const action = {
            type: 'move',
            sourceId: tokenFor(mover, sourceIsReserve, sourceIndex),
            destinationId: tokenFor(mover, destinationIsReserve, destinationIndex),
          };
          if (isLegalMovementAction(state, action)) actions.push(action);
        });
      });
    });
  });

  return actions;
};

export const applyMovementAction = (state, action) => {
  const nextState = createTrainingState(state);
  if (action?.type === 'skip') {
    nextState.movementIndex += 1;
    return { accepted: true, state: nextState, action };
  }

  const resolvedAction = action?.type === 'noop' ? getNoopAction(nextState, getCurrentMover(nextState)) : action;
  if (!isLegalMovementAction(nextState, resolvedAction)) {
    return { accepted: false, state: nextState, reason: 'illegal-movement-action' };
  }

  const source = parseMovementToken(resolvedAction.sourceId);
  const destination = parseMovementToken(resolvedAction.destinationId);
  const sourceBoard = getBoard(nextState, source);
  const destinationBoard = getBoard(nextState, destination);
  const sourceTile = sourceBoard[source.index];
  const destinationTile = destinationBoard[destination.index];

  sourceBoard[source.index] = destinationTile;
  destinationBoard[destination.index] = sourceTile;

  if (sourceBoard[source.index]?.hero) {
    sourceBoard[source.index].hero._movedThisMovementPhase = true;
  }
  if (destinationBoard[destination.index]?.hero) {
    destinationBoard[destination.index].hero._movedThisMovementPhase = true;
  }

  nextState.movementIndex += 1;
  return { accepted: true, state: nextState, action: resolvedAction };
};

export const isTerminal = (state) => {
  const p1Alive = [...state.p1Main, ...state.p1Reserve].some(isAliveTile);
  const p2Alive = [...state.p2Main, ...state.p2Reserve].some(isAliveTile);
  return !p1Alive || !p2Alive;
};

export const getOutcome = (state) => {
  if (!isTerminal(state)) return null;
  const p1Alive = [...state.p1Main, ...state.p1Reserve].some(isAliveTile);
  const p2Alive = [...state.p2Main, ...state.p2Reserve].some(isAliveTile);
  if (p1Alive === p2Alive) return 'draw';
  return p1Alive ? 'p1' : 'p2';
};

export const resolveBattleRound = async (state) => {
  const current = createTrainingState(state);
  const result = await executeRound(
    {
      p1Board: current.p1Main,
      p1Reserve: current.p1Reserve,
      p2Board: current.p2Main,
      p2Reserve: current.p2Reserve,
      priorityPlayer: current.priorityPlayer,
      roundNumber: current.roundNumber,
      lastCastActionBySide: current.lastCastActionBySide,
      gameMode: current.gameMode,
    },
    {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      onStep: null,
      quiet: true,
    },
  );

  return createTrainingState({
    p1Main: result.p1Board || current.p1Main,
    p1Reserve: result.p1Reserve || current.p1Reserve,
    p2Main: result.p2Board || current.p2Main,
    p2Reserve: result.p2Reserve || current.p2Reserve,
    priorityPlayer: result.priorityPlayer || current.priorityPlayer,
    roundNumber: current.roundNumber + 1,
    lastCastActionBySide: result.lastCastActionBySide || current.lastCastActionBySide,
    gameMode: current.gameMode,
  });
};

export const advanceToNextDecision = async (state, action) => {
  const movement = applyMovementAction(state, action);
  if (!movement.accepted) return movement;

  const sequence = getMovementSequence(movement.state.priorityPlayer);
  if (movement.state.movementIndex < sequence.length) return movement;

  const nextPrioritySide = normalizePrioritySide(movement.state.priorityPlayer) === 'p1' ? 'p2' : 'p1';
  const stateForRound = {
    ...movement.state,
    priorityPlayer: toPriorityPlayer(nextPrioritySide),
    movementIndex: 0,
  };
  const resolvedState = await resolveBattleRound(stateForRound);

  return {
    accepted: true,
    action: movement.action,
    resolvedRound: true,
    state: resolvedState,
  };
};
