/**
 * Neural Network Model for Board Game AI
 * 
 * Architecture: ResNet-style with two heads (AlphaZero approach)
 * - Input: Encoded game state
 * - Body: Shared residual layers for feature extraction
 * - Policy Head: Outputs move probabilities
 * - Value Head: Outputs win probability
 */

import * as tf from '@tensorflow/tfjs';
import { STATE_SIZE, ACTION_SPACE_SIZE } from './stateEncoder.js';

/**
 * Create a residual block
 * 
 * @param {tf.SymbolicTensor} input
 * @param {number} filters
 * @returns {tf.SymbolicTensor}
 */
function residualBlock(input, filters) {
  const conv1 = tf.layers.dense({ units: filters, activation: 'relu' }).apply(input);
  const bn1 = tf.layers.batchNormalization().apply(conv1);
  const conv2 = tf.layers.dense({ units: filters, activation: 'linear' }).apply(bn1);
  const bn2 = tf.layers.batchNormalization().apply(conv2);
  
  // Skip connection
  const added = tf.layers.add().apply([input, bn2]);
  const activated = tf.layers.activation({ activation: 'relu' }).apply(added);
  
  return activated;
}

/**
 * Create the neural network model
 * 
 * @param {Object} config - Model configuration
 * @returns {tf.LayersModel}
 */
export function createModel(config = {}) {
  const {
    hiddenSize = 256,
    numResidualBlocks = 4,
    policyOutputSize = ACTION_SPACE_SIZE,
    valueHiddenSize = 128
  } = config;
  
  // Input layer
  const input = tf.input({ shape: [STATE_SIZE], name: 'state_input' });
  
  // Initial dense layer to expand features
  let x = tf.layers.dense({
    units: hiddenSize,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    name: 'input_dense'
  }).apply(input);
  
  x = tf.layers.batchNormalization({ name: 'input_bn' }).apply(x);
  
  // Residual blocks (shared trunk)
  for (let i = 0; i < numResidualBlocks; i++) {
    x = residualBlock(x, hiddenSize);
  }
  
  // Policy Head (outputs move probabilities)
  let policy = tf.layers.dense({
    units: 128,
    activation: 'relu',
    name: 'policy_dense1'
  }).apply(x);

  policy = tf.layers.batchNormalization({ name: 'policy_bn' }).apply(policy);

  policy = tf.layers.dense({
    units: policyOutputSize,
    activation: 'softmax',
    name: 'policy_output'
  }).apply(policy);

  // Value Head (outputs win probability)
  let value = tf.layers.dense({
    units: valueHiddenSize,
    activation: 'relu',
    name: 'value_dense1'
  }).apply(x);

  value = tf.layers.batchNormalization({ name: 'value_bn' }).apply(value);

  value = tf.layers.dense({
    units: 1,
    activation: 'tanh', // Output in range [-1, 1]
    name: 'value_output'
  }).apply(value);

  // Draft Value Head (outputs draft win probability)
  let draftValue = tf.layers.dense({
    units: valueHiddenSize,
    activation: 'relu',
    name: 'draft_value_dense1'
  }).apply(x);

  draftValue = tf.layers.batchNormalization({ name: 'draft_value_bn' }).apply(draftValue);

  draftValue = tf.layers.dense({
    units: 1,
    activation: 'tanh', // Output in range [-1, 1]
    name: 'draft_value_output'
  }).apply(draftValue);

  // Create model with three outputs (order: policy, value, draft_value)
  // Note: TensorFlow.js doesn't support named outputs object, must use array
  const model = tf.model({
    inputs: input,
    outputs: [policy, value, draftValue],
    name: 'board_game_ai'
  });

  return model;
}

/**
 * Compile the model with appropriate loss functions
 * 
 * @param {tf.LayersModel} model
 * @param {number} learningRate
 */
export function compileModel(model, learningRate = 0.001) {
  // Check number of outputs to determine model type
  const numOutputs = model.outputs.length;
  
  let loss, metrics;
  if (numOutputs === 3) {
    // New models with 3 outputs: [policy, value, draft_value]
    loss = ['categoricalCrossentropy', 'meanSquaredError', 'meanSquaredError'];
    metrics = [['accuracy'], ['mse'], ['mse']];
  } else {
    // Old models with 2 outputs: [policy, value]
    loss = ['categoricalCrossentropy', 'meanSquaredError'];
    metrics = [['accuracy'], ['mse']];
  }
  
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss,
    metrics
  });
}

/**
 * Save model to local storage or file system
 * 
 * @param {tf.LayersModel} model
 * @param {string} savePath
 */
export async function saveModel(model, savePath = 'indexeddb://board-game-ai') {
  try {
    await model.save(savePath);
  } catch (error) {
    console.error(`[SaveModel] Failed to save:`, error);
    throw error;
  }
}

/**
 * Load model from storage
 * 
 * @param {string} loadPath
 * @returns {Promise<tf.LayersModel>}
 */
export async function loadModel(loadPath = 'indexeddb://board-game-ai') {
  try {
    const model = await tf.loadLayersModel(loadPath);
    return model;
  } catch (error) {
    return null;
  }
}

/**
 * Predict policy and value for a given state
 * 
 * @param {tf.LayersModel} model
 * @param {Float32Array} stateEncoding
 * @returns {Promise<{policy: Float32Array, value: number}>}
 */
export async function predict(model, stateEncoding) {
  const stateTensor = tf.tensor2d([stateEncoding], [1, STATE_SIZE]);

  // Support both object and array outputs for backward compatibility
  const output = model.predict(stateTensor);
  let policyTensor, valueTensor, draftValueTensor;
  if (Array.isArray(output)) {
    // Old model: [policy, value] or [policy, value, draftValue]
    [policyTensor, valueTensor, draftValueTensor] = output;
  } else {
    // New model: {policy_output, value_output, draft_value_output}
    policyTensor = output.policy_output;
    valueTensor = output.value_output;
    draftValueTensor = output.draft_value_output;
  }

  const policy = await policyTensor.data();
  const value = (await valueTensor.data())[0];
  const draftValue = draftValueTensor ? (await draftValueTensor.data())[0] : 0;

  // Clean up tensors
  stateTensor.dispose();
  policyTensor.dispose();
  valueTensor.dispose();
  if (draftValueTensor) draftValueTensor.dispose();

  return {
    policy: new Float32Array(policy),
    value,
    draftValue
  };
}

/**
 * Predict with action masking (only consider legal moves)
 * 
 * @param {tf.LayersModel} model
 * @param {Float32Array} stateEncoding
 * @param {Float32Array} actionMask - Binary mask of legal actions
 * @returns {Promise<{policy: Float32Array, value: number}>}
 */
export async function predictWithMask(model, stateEncoding, actionMask) {
  const result = await predict(model, stateEncoding);

  // Apply mask: zero out illegal actions
  for (let i = 0; i < result.policy.length; i++) {
    result.policy[i] *= actionMask[i];
  }

  // Re-normalize to sum to 1
  const sum = result.policy.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (let i = 0; i < result.policy.length; i++) {
      result.policy[i] /= sum;
    }
  }

  // result now includes draftValue
  return result;
}

/**
 * Get model summary
 */
export function printModelSummary(model) {
  model.summary();
}
