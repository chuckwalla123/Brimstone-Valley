import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as tf from '@tensorflow/tfjs';
import { getCandidateFeatureMetadata } from './candidateFeatures.js';

export async function saveNodeModel(model, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await model.save(tf.io.withSaveHandler(async (artifacts) => {
    const checkpoint = {
      format: 'brimstone-movement-candidate-scorer',
      ...getCandidateFeatureMetadata(),
      modelTopology: artifacts.modelTopology,
      weightSpecs: artifacts.weightSpecs,
      weightData: Buffer.from(artifacts.weightData).toString('base64'),
    };
    await writeFile(outputPath, JSON.stringify(checkpoint), 'utf8');
    return {
      dateSaved: new Date(),
      modelTopologyType: 'JSON',
      modelTopologyBytes: JSON.stringify(artifacts.modelTopology).length,
      weightSpecsBytes: JSON.stringify(artifacts.weightSpecs).length,
      weightDataBytes: artifacts.weightData.byteLength,
    };
  }));
}

export async function loadNodeModel(inputPath) {
  const checkpoint = JSON.parse(await readFile(inputPath, 'utf8'));
  if (checkpoint.format !== 'brimstone-movement-candidate-scorer') {
    throw new Error(`Unsupported HardAI checkpoint format in ${inputPath}`);
  }
  const expected = getCandidateFeatureMetadata();
  if (
    checkpoint.featureVersion !== expected.featureVersion
    || checkpoint.featureSize !== expected.featureSize
  ) {
    throw new Error(
      `Checkpoint ${inputPath} uses incompatible candidate features. Start fresh without --resume after a feature encoder upgrade.`,
    );
  }

  const weightData = Buffer.from(checkpoint.weightData, 'base64');
  return tf.loadLayersModel(tf.io.fromMemory({
    modelTopology: checkpoint.modelTopology,
    weightSpecs: checkpoint.weightSpecs,
    weightData: weightData.buffer.slice(weightData.byteOffset, weightData.byteOffset + weightData.byteLength),
  }));
}
