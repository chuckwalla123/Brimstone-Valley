/**
 * Test script to verify neural network setup
 * Run this to check that model creation and encoding work correctly
 */

import { createModel, compileModel, printModelSummary, predict } from './model.js';
import { encodeState, getActionMask, decodeAction, STATE_SIZE, ACTION_SPACE_SIZE } from './stateEncoder.js';

// 1. Test state encoding
const testState = {
  p1Board: [
    { hero: { id: 'lancerID', health: 11, armor: 2, speed: 3, energy: 0 } },
    null,
    null,
    null,
    null
  ],
  p1Reserve: [null, null],
  p2Board: [
    null,
    { hero: { id: 'angelID', health: 9, armor: 2, speed: 3, energy: 0 } },
    null,
    null,
    null
  ],
  p2Reserve: [null, null]
};

const encoded = encodeState(testState);

// 2. Test action masking
const mask = getActionMask(testState, true); // P2's turn
const legalActions = mask.filter(x => x === 1).length;

// 3. Test action encoding/decoding
const testMove = { type: 'move', from: 5, to: 0 }; // Reserve to main
const actionIndex = testMove.from * 7 + testMove.to;
const decoded = decodeAction(actionIndex);

// 4. Test model creation
const model = createModel({
  hiddenSize: 128,
  numResidualBlocks: 2
});

printModelSummary(model);

// 5. Test model compilation
compileModel(model, 0.001);

// 6. Test prediction
(async () => {
  const prediction = await predict(model, encoded);
  
  // Get top 3 actions
  const indexed = Array.from(prediction.policy).map((p, i) => ({ action: i, prob: p }));
  indexed.sort((a, b) => b.prob - a.prob);
  
  for (let i = 0; i < 3; i++) {
    const { action, prob } = indexed[i];
    const move = decodeAction(action);
  }
})();
