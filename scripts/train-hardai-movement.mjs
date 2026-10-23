import { access, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  compileCandidateScorer,
  createCandidateScorer,
  trainCandidateScorer,
} from '../src/ai/training/candidateScorer.js';
import {
  evaluateCandidate,
  evaluatePromotionGate,
} from '../src/ai/training/championEvaluation.js';
import { generateCorpusLabels } from '../src/ai/training/labelGenerator.js';
import { createMovementScenarioCorpus } from '../src/ai/training/scenarioCorpus.js';
import { loadNodeModel, saveNodeModel } from '../src/ai/training/nodeModelCheckpoint.js';
import { getCandidateFeatureMetadata } from '../src/ai/training/candidateFeatures.js';
import {
  evaluateHeldOutRanking,
  evaluateShallowSearchOracle,
  isCandidateQualityImproved,
} from '../src/ai/training/trainingDiagnostics.js';

const DEFAULTS = {
  randomCount: 50,
  fixtureCount: 5,
  maxResponses: 4,
  epochs: 20,
  batchSize: 32,
  objective: 'pairwise',
  seed: 20261016,
  evaluationRandomCount: 20,
  diagnosticRandomCount: 10,
  oracleScenarioCount: 5,
  disagreementLimit: 20,
  maxRounds: 20,
  output: 'models/hardai-movement-candidate.json',
  best: 'models/hardai-movement-best.json',
  champion: 'models/hardai-movement-champion.json',
  resume: false,
  promote: false,
};

const OPTION_NAMES = new Map([
  ['random-count', 'randomCount'],
  ['fixture-count', 'fixtureCount'],
  ['max-responses', 'maxResponses'],
  ['epochs', 'epochs'],
  ['batch-size', 'batchSize'],
  ['objective', 'objective'],
  ['seed', 'seed'],
  ['evaluation-random-count', 'evaluationRandomCount'],
  ['diagnostic-random-count', 'diagnosticRandomCount'],
  ['oracle-scenario-count', 'oracleScenarioCount'],
  ['disagreement-limit', 'disagreementLimit'],
  ['max-rounds', 'maxRounds'],
  ['output', 'output'],
  ['best', 'best'],
  ['champion', 'champion'],
  ['resume', 'resume'],
  ['promote', 'promote'],
]);

const parseArguments = (argv) => {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = OPTION_NAMES.get(argument.slice(2));
    if (!key) throw new Error(`Unsupported option: ${argument}`);
    if (key === 'resume' || key === 'promote') {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Option ${argument} requires a value`);
    index += 1;
    options[key] = ['output', 'best', 'champion', 'objective'].includes(key) ? value : Number(value);
  }

  ['randomCount', 'fixtureCount', 'maxResponses', 'epochs', 'batchSize', 'evaluationRandomCount', 'diagnosticRandomCount', 'oracleScenarioCount', 'disagreementLimit', 'maxRounds']
    .forEach((key) => {
      if (!Number.isInteger(options[key]) || options[key] < 0) {
        throw new Error(`${key} must be a non-negative integer`);
      }
    });
  if (!Number.isInteger(options.seed)) throw new Error('seed must be an integer');
  if (!['pairwise', 'mse'].includes(options.objective)) {
    throw new Error('objective must be either pairwise or mse');
  }
  if (options.fixtureCount > 5) throw new Error('fixture-count cannot exceed 5');
  if (!options.fixtureCount && !options.randomCount) {
    throw new Error('At least one fixture or random scenario is required');
  }
  return options;
};

const selectScenarios = (randomCount, fixtureCount, seed) => {
  const corpus = createMovementScenarioCorpus({ randomCount, seed });
  const fixtures = corpus.filter((scenario) => scenario.source === 'fixture').slice(0, fixtureCount);
  const random = corpus.filter((scenario) => scenario.source === 'random');
  return [...fixtures, ...random];
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch (_) {
    return false;
  }
};

const loadMetadata = async (path) => {
  if (!await exists(path)) return null;
  return JSON.parse(await readFile(path, 'utf8'));
};

const createScenarioProgressReporter = (phase, total) => {
  const interval = Math.max(1, Math.ceil(Math.max(1, total) / 10));
  return ({ completed, scenarioId, benchmark }) => {
    if (completed !== total && completed % interval !== 0) return;
    const suffix = benchmark ? ` (${benchmark})` : '';
    const scenario = scenarioId ? `; latest: ${scenarioId}` : '';
    console.log(`[HardAI] ${phase}${suffix}: ${completed}/${total} scenarios${scenario}.`);
  };
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const outputPath = resolve(options.output);
  const bestPath = resolve(options.best);
  const championPath = resolve(options.champion);
  const scenarios = selectScenarios(options.randomCount, options.fixtureCount, options.seed);
  console.log(`[HardAI] Labeling ${scenarios.length} movement scenarios with ${options.maxResponses} response(s) per move.`);

  const labelSets = await generateCorpusLabels(scenarios, {
    maxResponses: Math.max(1, options.maxResponses),
    seed: options.seed,
    onProgress: createScenarioProgressReporter('Labeling', scenarios.length),
  });
  const labelCount = labelSets.reduce((total, labelSet) => total + labelSet.labels.length, 0);
  console.log(`[HardAI] Generated ${labelCount} legal-action labels.`);

  const shouldResume = options.resume && await exists(outputPath);
  const model = shouldResume
    ? compileCandidateScorer(await loadNodeModel(outputPath))
    : compileCandidateScorer(createCandidateScorer());
  console.log(`[HardAI] ${shouldResume ? 'Resuming' : 'Training'} candidate scorer with ${options.objective} objective for ${options.epochs} epoch(s).`);

  const history = await trainCandidateScorer(model, labelSets, {
    epochs: options.epochs,
    batchSize: options.batchSize,
    objective: options.objective,
    onEpochEnd: ({ epoch, totalEpochs, loss, mse, objective }) => {
      const mseText = Number.isFinite(mse) ? `, mse=${mse.toFixed(6)}` : '';
      console.log(`[HardAI] Training epoch ${epoch}/${totalEpochs} (${objective}): loss=${loss.toFixed(6)}${mseText}.`);
    },
  });
  const loss = history.history.loss.at(-1);
  console.log(`[HardAI] Final training loss: ${Number(loss).toFixed(6)}`);
  await saveNodeModel(model, outputPath);
  console.log(`[HardAI] Saved candidate checkpoint: ${outputPath}`);

  const evaluationScenarios = selectScenarios(
    options.evaluationRandomCount,
    options.fixtureCount,
    options.seed + 1,
  );
  const championModel = await exists(championPath)
    ? compileCandidateScorer(await loadNodeModel(championPath))
    : null;
  console.log(`[HardAI] Evaluating ${evaluationScenarios.length} scenarios against EasyAI${championModel ? ' and the current champion' : ''}.`);
  const evaluation = await evaluateCandidate({
    candidateModel: model,
    championModel,
    scenarios: evaluationScenarios,
    maxRounds: options.maxRounds,
    seed: options.seed + 2,
    onProgress: createScenarioProgressReporter('Evaluating', evaluationScenarios.length),
    onMatchComplete: ({
      benchmark,
      scenarioId,
      candidateSide,
      candidateResult,
      outcome,
      resolvedRounds,
      fallbacks,
      forcedSkips,
    }) => {
      const side = candidateSide.toUpperCase();
      const result = candidateResult.toUpperCase();
      const fallbackText = fallbacks.length ? `, fallbacks=${fallbacks.length}` : '';
      const fallbackDetails = fallbacks.length
        ? ` [${fallbacks.map((fallback) => `${fallback.controller}/${fallback.mover}/${fallback.reason}:${fallback.attemptedAction?.sourceId || 'none'}->${fallback.attemptedAction?.destinationId || 'none'}`).join('; ')}]`
        : '';
      const forcedSkipText = forcedSkips.length ? `, forced-skips=${forcedSkips.length}` : '';
      console.log(
        `[HardAI] Match (${benchmark}): HardAI=${side}, result=${result}, outcome=${outcome.toUpperCase()}, rounds=${resolvedRounds}${fallbackText}${fallbackDetails}${forcedSkipText}, scenario=${scenarioId || 'unnamed'}.`,
      );
    },
  });
  const promotion = evaluatePromotionGate(evaluation);
  console.log(`[HardAI] EasyAI: ${evaluation.againstEasy.wins}W/${evaluation.againstEasy.draws}D/${evaluation.againstEasy.losses}L/${evaluation.againstEasy.unfinished} unfinished (${(evaluation.againstEasy.winRate * 100).toFixed(1)}% wins).`);
  console.log(`[HardAI] EasyAI by side: P1 ${evaluation.againstEasy.bySide.p1.wins}W/${evaluation.againstEasy.bySide.p1.draws}D/${evaluation.againstEasy.bySide.p1.losses}L/${evaluation.againstEasy.bySide.p1.unfinished} unfinished; P2 ${evaluation.againstEasy.bySide.p2.wins}W/${evaluation.againstEasy.bySide.p2.draws}D/${evaluation.againstEasy.bySide.p2.losses}L/${evaluation.againstEasy.bySide.p2.unfinished} unfinished.`);
  console.log(`[HardAI] EasyAI fallbacks: ${evaluation.againstEasy.fallbackCount} total; by controller=${JSON.stringify(evaluation.againstEasy.fallbackByController)}; by reason=${JSON.stringify(evaluation.againstEasy.fallbackByReason)}.`);
  console.log(`[HardAI] Forced skips: ${evaluation.againstEasy.forcedSkipCount} total; by controller=${JSON.stringify(evaluation.againstEasy.forcedSkipsByController)}.`);
  if (evaluation.againstChampion) {
    console.log(`[HardAI] Champion: ${evaluation.againstChampion.wins}W/${evaluation.againstChampion.draws}D/${evaluation.againstChampion.losses}L (${(evaluation.againstChampion.winRate * 100).toFixed(1)}% wins).`);
  }
  console.log(`[HardAI] Promotion gate: ${promotion.passed ? 'PASSED' : 'not passed'}.`);

  const metadataPath = outputPath.replace(/\.json$/i, '.metadata.json');
  const heldOutScenarios = selectScenarios(
    options.diagnosticRandomCount,
    options.fixtureCount,
    options.seed + 10,
  );
  console.log(`[HardAI] Generating held-out labels for ${heldOutScenarios.length} diagnostic scenarios.`);
  const heldOutLabels = await generateCorpusLabels(heldOutScenarios, {
    maxResponses: Math.max(1, options.maxResponses),
    seed: options.seed + 10,
    onProgress: createScenarioProgressReporter('Held-out labeling', heldOutScenarios.length),
  });
  const heldOutRanking = await evaluateHeldOutRanking(model, heldOutLabels, {
    disagreementLimit: options.disagreementLimit,
  });
  console.log(`[HardAI] Held-out ranking: ${(heldOutRanking.top1Agreement * 100).toFixed(1)}% top-1, ${(heldOutRanking.topKAgreement * 100).toFixed(1)}% top-3, ${heldOutRanking.meanSpearmanCorrelation.toFixed(3)} Spearman.`);

  const oracleScenarios = heldOutScenarios.slice(0, options.oracleScenarioCount);
  const oracle = oracleScenarios.length
    ? await evaluateShallowSearchOracle(oracleScenarios, {
      maxResponses: Math.max(1, options.maxResponses),
      maxRounds: options.maxRounds,
      seed: options.seed + 20,
      onProgress: createScenarioProgressReporter('Oracle benchmark', oracleScenarios.length),
    })
    : null;
  if (oracle) {
    console.log(`[HardAI] Shallow-search oracle vs EasyAI: ${oracle.wins}W/${oracle.draws}D/${oracle.losses}L/${oracle.unfinished} unfinished (${(oracle.winRate * 100).toFixed(1)}% wins).`);
  }

  const quality = {
    easyScoreRate: evaluation.againstEasy.scoreRate,
    heldOutTop1Agreement: heldOutRanking.top1Agreement,
    heldOutSpearman: heldOutRanking.meanSpearmanCorrelation,
  };
  const bestMetadataPath = bestPath.replace(/\.json$/i, '.metadata.json');
  const previousBest = await loadMetadata(bestMetadataPath);
  const featureMetadata = getCandidateFeatureMetadata();
  const compatibleBest = previousBest?.featureVersion === featureMetadata.featureVersion ? previousBest : null;
  const isBest = isCandidateQualityImproved(quality, compatibleBest?.quality);
  const metadata = {
    trainedAt: new Date().toISOString(),
    options,
    scenarioCount: scenarios.length,
    labelCount,
    trainingObjective: options.objective,
    finalLoss: loss,
    evaluation,
    promotion,
    heldOutRanking,
    oracle,
    quality,
    isBest,
    featureVersion: featureMetadata.featureVersion,
    featureSize: featureMetadata.featureSize,
  };
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`[HardAI] Wrote training metadata: ${metadataPath}`);
  if (isBest) {
    await copyFile(outputPath, bestPath);
    await writeFile(bestMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`[HardAI] Updated best candidate checkpoint: ${bestPath}`);
  } else {
    console.log(`[HardAI] Preserved existing best candidate checkpoint: ${bestPath}`);
  }

  if (options.promote) {
    if (!promotion.passed || !isBest) {
      throw new Error('Candidate did not pass the promotion gate or improve the best checkpoint; champion checkpoint was not replaced.');
    }
    await copyFile(outputPath, championPath);
    console.log(`[HardAI] Promoted candidate checkpoint: ${championPath}`);
  }

  championModel?.dispose();
  model.dispose();
};

main().catch((error) => {
  console.error(`[HardAI] Training failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
