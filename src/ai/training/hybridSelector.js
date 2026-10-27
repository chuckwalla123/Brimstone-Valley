import { scoreLegalMovementActions } from './candidateScorer.js';
import { generateMovementLabels } from './labelGenerator.js';

export const DEFAULT_SHORTLIST_SIZE = 4;

// The scorer prunes the legal moves to a shortlist, then the EasyAI+ lookahead search picks among them.
export const selectShortlistSearchAction = async (model, state, side, {
  shortlistSize = DEFAULT_SHORTLIST_SIZE,
  maxResponses = 4,
  seed = 1,
} = {}) => {
  const scored = await scoreLegalMovementActions(model, state, side);
  if (!scored.length) return { action: null, shortlist: [] };

  const shortlist = scored.slice(0, Math.max(1, shortlistSize));
  if (shortlist.length === 1) return { action: shortlist[0].action, shortlist };

  const labelSet = await generateMovementLabels({ state }, {
    actions: shortlist.map((entry) => entry.action),
    maxResponses,
    seed,
  });
  return { action: labelSet.bestAction, shortlist, searchScore: labelSet.bestScore };
};
