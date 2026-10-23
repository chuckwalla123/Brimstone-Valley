import * as tf from '@tensorflow/tfjs';
import { CANDIDATE_FEATURE_SIZE, encodeMovementCandidate } from './candidateFeatures.js';
import { listLegalMovementActions } from './environment.js';

const SCORE_SCALE = 100;
const DEFAULT_MODEL_PATH = 'indexeddb://brimstone-movement-candidate-scorer';

const normalizeScore = (score) => Math.tanh(Number(score || 0) / SCORE_SCALE);
const denormalizeScore = (score) => Math.atanh(Math.max(-0.999999, Math.min(0.999999, score))) * SCORE_SCALE;
const assertFeatureCompatibility = (model) => {
  const featureSize = Number(model?.inputs?.[0]?.shape?.[1]);
  if (featureSize !== CANDIDATE_FEATURE_SIZE) {
    throw new Error(
      `Candidate scorer expects ${CANDIDATE_FEATURE_SIZE} features, but this checkpoint uses ${featureSize}. Start a fresh model instead of resuming an older checkpoint.`,
    );
  }
};

export const createCandidateScorer = ({ hiddenSize = 128, dropoutRate = 0.1 } = {}) => {
  const input = tf.input({ shape: [CANDIDATE_FEATURE_SIZE], name: 'candidate_features' });
  let layer = tf.layers.dense({
    units: hiddenSize,
    activation: 'relu',
    kernelInitializer: 'heNormal',
    name: 'candidate_dense_1',
  }).apply(input);
  layer = tf.layers.layerNormalization({ name: 'candidate_norm_1' }).apply(layer);
  layer = tf.layers.dropout({ rate: dropoutRate, name: 'candidate_dropout' }).apply(layer);
  layer = tf.layers.dense({
    units: Math.max(32, Math.floor(hiddenSize / 2)),
    activation: 'relu',
    kernelInitializer: 'heNormal',
    name: 'candidate_dense_2',
  }).apply(layer);
  const output = tf.layers.dense({
    units: 1,
    activation: 'tanh',
    name: 'candidate_score',
  }).apply(layer);

  return tf.model({ inputs: input, outputs: output, name: 'movement_candidate_scorer' });
};

export const compileCandidateScorer = (model, learningRate = 0.001) => {
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'meanSquaredError',
    metrics: ['mse'],
  });
  return model;
};

export const prepareCandidateTrainingExamples = (labelSets) => {
  const features = [];
  const targets = [];

  (labelSets || []).forEach((labelSet) => {
    (labelSet.labels || []).forEach((label) => {
      features.push(Array.from(encodeMovementCandidate(labelSet.state, label.action, labelSet.perspectiveSide)));
      targets.push([normalizeScore(label.score)]);
    });
  });

  if (!features.length) throw new Error('Candidate scorer requires at least one labeled action');
  return { features, targets };
};

export const preparePairwiseRankingExamples = (labelSets, {
  minScoreGap = 1,
  maxPairsPerState = 96,
} = {}) => {
  if (!Number.isFinite(minScoreGap) || minScoreGap < 0) {
    throw new Error('minScoreGap must be a non-negative number');
  }
  if (!Number.isInteger(maxPairsPerState) || maxPairsPerState < 1) {
    throw new Error('maxPairsPerState must be a positive integer');
  }

  const preferredFeatures = [];
  const otherFeatures = [];
  const scoreGaps = [];
  let stateCount = 0;

  (labelSets || []).forEach((labelSet) => {
    const labels = [...(labelSet.labels || [])].sort((left, right) => right.score - left.score);
    const pairs = [];
    for (let preferredIndex = 0; preferredIndex < labels.length; preferredIndex += 1) {
      for (let otherIndex = preferredIndex + 1; otherIndex < labels.length; otherIndex += 1) {
        const gap = labels[preferredIndex].score - labels[otherIndex].score;
        if (gap < minScoreGap) continue;
        pairs.push({
          preferred: labels[preferredIndex],
          other: labels[otherIndex],
          gap,
          prioritizesBestAction: preferredIndex === 0,
        });
      }
    }

    pairs.sort((left, right) => (
      Number(right.prioritizesBestAction) - Number(left.prioritizesBestAction)
      || right.gap - left.gap
    ));
    pairs.slice(0, maxPairsPerState).forEach((pair) => {
      preferredFeatures.push(Array.from(encodeMovementCandidate(
        labelSet.state,
        pair.preferred.action,
        labelSet.perspectiveSide,
      )));
      otherFeatures.push(Array.from(encodeMovementCandidate(
        labelSet.state,
        pair.other.action,
        labelSet.perspectiveSide,
      )));
      scoreGaps.push(pair.gap);
    });
    if (pairs.length) stateCount += 1;
  });

  if (!preferredFeatures.length) {
    throw new Error('Pairwise ranking requires at least one unequal legal-action pair');
  }
  return { preferredFeatures, otherFeatures, scoreGaps, stateCount };
};

const trainWithMeanSquaredError = async (model, examples, {
  batchSize,
  epochs,
  validationSplit,
  onEpochEnd,
}) => {
  const input = tf.tensor2d(examples.features, [examples.features.length, CANDIDATE_FEATURE_SIZE]);
  const targets = tf.tensor2d(examples.targets, [examples.targets.length, 1]);

  try {
    return await model.fit(input, targets, {
      batchSize: Math.min(batchSize, examples.features.length),
      epochs,
      validationSplit: examples.features.length > 10 ? validationSplit : 0,
      shuffle: true,
      verbose: 0,
      callbacks: typeof onEpochEnd === 'function'
        ? {
          onEpochEnd: async (epoch, logs) => {
            onEpochEnd({
              epoch: epoch + 1,
              totalEpochs: epochs,
              loss: Number(logs?.loss ?? NaN),
              mse: Number(logs?.mse ?? NaN),
              objective: 'mse',
            });
          },
        }
        : undefined,
    });
  } finally {
    input.dispose();
    targets.dispose();
  }
};

const shuffledIndices = (count) => {
  const indices = Array.from({ length: count }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[otherIndex]] = [indices[otherIndex], indices[index]];
  }
  return indices;
};

const trainWithPairwiseRanking = async (model, examples, {
  batchSize,
  epochs,
  learningRate,
  onEpochEnd,
}) => {
  const optimizer = tf.train.adam(learningRate);
  const losses = [];

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const indices = shuffledIndices(examples.preferredFeatures.length);
    let totalLoss = 0;
    let batchCount = 0;

    for (let start = 0; start < indices.length; start += batchSize) {
      const batchIndices = indices.slice(start, start + batchSize);
      const loss = optimizer.minimize(() => tf.tidy(() => {
        const preferredInput = tf.tensor2d(
          batchIndices.map((index) => examples.preferredFeatures[index]),
          [batchIndices.length, CANDIDATE_FEATURE_SIZE],
        );
        const otherInput = tf.tensor2d(
          batchIndices.map((index) => examples.otherFeatures[index]),
          [batchIndices.length, CANDIDATE_FEATURE_SIZE],
        );
        const preferredScore = model.apply(preferredInput, { training: true });
        const otherScore = model.apply(otherInput, { training: true });
        return tf.mean(tf.softplus(tf.neg(tf.sub(preferredScore, otherScore))));
      }), true);
      const [value] = await loss.data();
      loss.dispose();
      totalLoss += value;
      batchCount += 1;
    }

    const epochLoss = totalLoss / batchCount;
    losses.push(epochLoss);
    if (typeof onEpochEnd === 'function') {
      await onEpochEnd({
        epoch: epoch + 1,
        totalEpochs: epochs,
        loss: epochLoss,
        mse: NaN,
        objective: 'pairwise',
      });
    }
  }

  return { history: { loss: losses } };
};

export const trainCandidateScorer = async (model, labelSets, {
  batchSize = 32,
  epochs = 20,
  validationSplit = 0,
  learningRate = 0.001,
  objective = 'pairwise',
  minScoreGap = 1,
  maxPairsPerState = 96,
  onEpochEnd = null,
} = {}) => {
  assertFeatureCompatibility(model);
  if (!Number.isInteger(epochs) || epochs < 1) throw new Error('epochs must be a positive integer');
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be a positive integer');
  if (!Number.isFinite(learningRate) || learningRate <= 0) throw new Error('learningRate must be positive');

  if (objective === 'mse') {
    return trainWithMeanSquaredError(model, prepareCandidateTrainingExamples(labelSets), {
      batchSize,
      epochs,
      validationSplit,
      onEpochEnd,
    });
  }
  if (objective !== 'pairwise') throw new Error(`Unsupported candidate scorer objective: ${objective}`);
  return trainWithPairwiseRanking(model, preparePairwiseRankingExamples(labelSets, {
    minScoreGap,
    maxPairsPerState,
  }), {
    batchSize,
    epochs,
    learningRate,
    onEpochEnd,
  });
};

export const scoreLegalMovementActions = async (model, state, perspectiveSide) => {
  assertFeatureCompatibility(model);
  const actions = listLegalMovementActions(state);
  if (!actions.length) return [];
  const features = actions.map((action) => Array.from(encodeMovementCandidate(state, action, perspectiveSide)));
  const input = tf.tensor2d(features, [features.length, CANDIDATE_FEATURE_SIZE]);
  let prediction;

  try {
    prediction = model.predict(input);
    const scores = await prediction.data();
    return actions.map((action, index) => ({
      action,
      score: denormalizeScore(scores[index]),
    })).sort((left, right) => {
      const difference = right.score - left.score;
      if (difference !== 0) return difference;
      return `${left.action.sourceId}:${left.action.destinationId}`
        .localeCompare(`${right.action.sourceId}:${right.action.destinationId}`);
    });
  } finally {
    input.dispose();
    if (prediction) prediction.dispose();
  }
};

export const saveCandidateScorer = async (model, path = DEFAULT_MODEL_PATH) => model.save(path);

export const loadCandidateScorer = async (path = DEFAULT_MODEL_PATH) => {
  try {
    return await tf.loadLayersModel(path);
  } catch (_) {
    return null;
  }
};
