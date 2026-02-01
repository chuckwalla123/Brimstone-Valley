/**
 * Training Loop
 * 
 * Implements the AlphaZero training pipeline:
 * 1. Generate self-play games
 * 2. Train neural network on game data
 * 3. Evaluate new model vs old model
 * 4. Repeat
 */

import * as tf from '@tensorflow/tfjs';
import { createModel, compileModel, saveModel, loadModel } from './model.js';
import { generateSelfPlayBatch, saveTrainingExamples, loadTrainingExamples } from './selfPlay.js';
import { setPolicyMixing } from './mcts.js';
import { STATE_SIZE, ACTION_SPACE_SIZE } from './stateEncoder.js';

/**
 * Train the model on a batch of examples
 * 
 * @param {tf.LayersModel} model
 * @param {Array} examples - Training examples
 * @param {number} batchSize
 * @param {number} epochs
 * @returns {Promise<Object>} Training history
 */
export async function trainOnExamples(model, examples, batchSize = 32, epochs = 10) {
  if (examples.length === 0) {
    return null;
  }
  
  // Wait for TensorFlow.js backend to be ready
  await tf.ready();
  
  // Prepare tensors
  const states = [];
  const policies = [];
  const values = [];
  const draftValues = [];

  for (const example of examples) {
    states.push(Array.from(example.state));
    policies.push(Array.from(example.policy));
    values.push([example.value]); // Value is scalar, wrap in array
    draftValues.push([example.draftValue !== undefined ? example.draftValue : 0]);
  }

  const statesTensor = tf.tensor2d(states, [examples.length, STATE_SIZE]);
  const policiesTensor = tf.tensor2d(policies, [examples.length, ACTION_SPACE_SIZE]);
  const valuesTensor = tf.tensor2d(values, [examples.length, 1]);
  const draftValuesTensor = tf.tensor2d(draftValues, [examples.length, 1]);

  // Check number of outputs to determine model type
  const numOutputs = model.outputs.length;
  
  let targets;
  if (numOutputs === 3) {
    // New models with 3 outputs: [policy, value, draft_value]
    targets = [policiesTensor, valuesTensor, draftValuesTensor];
  } else {
    // Old models with 2 outputs: [policy, value]
    targets = [policiesTensor, valuesTensor];
  }

  // Train model
  const history = await model.fit(
    statesTensor,
    targets,
    {
      batchSize,
      epochs,
      validationSplit: examples.length > 100 ? 0.1 : 0, // Skip validation for small datasets
      shuffle: true,
      verbose: 0
    }
  );
  
  // Clean up tensors
  statesTensor.dispose();
  policiesTensor.dispose();
  valuesTensor.dispose();
  draftValuesTensor.dispose();

  return history;
}

/**
 * Training configuration
 */
const DEFAULT_TRAINING_CONFIG = {
  iterations: 10,          // Number of training iterations
  gamesPerIteration: 5,    // Self-play games per iteration
  mctsSimulations: 30,     // MCTS simulations per move
  temperature: 1.8,        // Sampling temperature - higher = more exploration
  uniformMixing: 0.9,       // Uniform policy mixing (0-1)
  trainEpochs: 5,          // Training epochs per iteration
  batchSize: 32,           // Training batch size
  learningRate: 0.001,     // Learning rate
  saveInterval: 1,         // Save model every N iterations
  modelPath: 'indexeddb://board-game-ai'
};

/**
 * Main training loop
 * 
 * @param {Object} config - Training configuration
 */
export async function runTrainingLoop(config = {}) {
  const cfg = { ...DEFAULT_TRAINING_CONFIG, ...config };
  setPolicyMixing({ uniform: cfg.uniformMixing });
  
  // Load or create model
  let model = await loadModel(cfg.modelPath);
  if (!model) {
    model = createModel();
    compileModel(model, cfg.learningRate);
  } else {
    // Recompile the loaded model for training
    compileModel(model, cfg.learningRate);
  }
  
  // Load existing training data if available
  const existingExamples = loadTrainingExamples();
  let allTrainingExamples = [...existingExamples];
  
  
  // Training iterations
  for (let iteration = 1; iteration <= cfg.iterations; iteration++) {
    console.log(`Iteration ${iteration}/${cfg.iterations}`);
    
    // 1. Generate self-play games
    const newExamples = await generateSelfPlayBatch(
      model,
      cfg.gamesPerIteration,
      cfg.draftSimulations || cfg.mctsSimulations,
      cfg.battleSimulations || cfg.mctsSimulations,
      cfg.temperature
    );
    
    allTrainingExamples.push(...newExamples);
    
    // Keep only last 10,000 examples to prevent memory issues
    if (allTrainingExamples.length > 10000) {
      allTrainingExamples = allTrainingExamples.slice(-10000);
    }
    
    // Save training examples
    saveTrainingExamples(allTrainingExamples);
    
    // 2. Train neural network
    await trainOnExamples(model, allTrainingExamples, cfg.batchSize, cfg.trainEpochs);
    
    // 3. Save model periodically
    if (iteration % cfg.saveInterval === 0) {
      await saveModel(model, cfg.modelPath);
    }
    
    // Memory cleanup
    if (typeof tf !== 'undefined' && tf.memory) {
      tf.memory();
    }
  }
  
  // Final save
  await saveModel(model, cfg.modelPath);
  
  return model;
}

/**
 * Quick training script (fewer iterations for testing)
 */
export async function runQuickTraining() {
  return runTrainingLoop({
    iterations: 3,
    gamesPerIteration: 2,
    mctsSimulations: 20,
    trainEpochs: 3
  });
}

/**
 * Full training script (production)
 */
export async function runFullTraining() {
  return runTrainingLoop({
    iterations: 20,
    gamesPerIteration: 10,
    mctsSimulations: 50,
    trainEpochs: 10
  });
}

/**
 * Continue training from saved model
 */
export async function continueTraining(additionalIterations = 5) {
  const existingExamples = loadTrainingExamples();
  
  return runTrainingLoop({
    iterations: additionalIterations,
    gamesPerIteration: 5,
    mctsSimulations: 30,
    trainEpochs: 5
  });
}
