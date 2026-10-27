import '../src/ai/training/nodeBackend.js';
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
import { generateCorpusLabels, MOVEMENT_LABEL_EVALUATOR } from '../src/ai/training/labelGenerator.js';
import { createMovementScenarioCorpus } from '../src/ai/training/scenarioCorpus.js';
import { createBalancedRandomScenarios, createFreshSeed, deriveSeed } from '../src/ai/training/scenarioSampling.js';
import { loadNodeModel, saveNodeModel } from '../src/ai/training/nodeModelCheckpoint.js';
import { getCandidateFeatureMetadata } from '../src/ai/training/candidateFeatures.js';
import {
  evaluateHeldOutRanking,
  evaluateShallowSearchOracle,
  isCandidateQualityImproved,
} from '../src/ai/training/trainingDiagnostics.js';

const DEFAULTS = {
  randomCount: 50,
  fixtureCount: 0,
  rounds: 1,
  maxResponses: 4,
  epochs: 20,
  batchSize: 32,
  objective: 'pairwise',
  evaluationOpponent: 'easyplus',
  evaluationMode: 'hybrid',
  shortlistSize: 4,
  minBalancedRounds: 3,
  minBestGames: 40,
  minBestScoreRate: 0.5,
  // null means a fresh random seed every run, so each run trains and evaluates on new scenarios.
  seed: null,
  evaluationRandomCount: 20,
  diagnosticRandomCount: 10,
  oracleScenarioCount: 5,
  disagreementLimit: 20,
  maxRounds: 20,
  output: 'models/hardai-movement-candidate.json',
  best: 'models/hardai-movement-best.json',
  champion: 'models/hardai-movement-champion.json',
  resume: false,
  fresh: false,
  promote: false,
};

const OPTION_NAMES = new Map([
  ['random-count', 'randomCount'],
  ['fixture-count', 'fixtureCount'],
  ['rounds', 'rounds'],
  ['max-responses', 'maxResponses'],
  ['epochs', 'epochs'],
  ['batch-size', 'batchSize'],
  ['objective', 'objective'],
  ['evaluation-opponent', 'evaluationOpponent'],
  ['evaluation-mode', 'evaluationMode'],
  ['shortlist-size', 'shortlistSize'],
  ['min-balanced-rounds', 'minBalancedRounds'],
  ['min-best-games', 'minBestGames'],
  ['min-best-score-rate', 'minBestScoreRate'],
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
  ['fresh', 'fresh'],
  ['promote', 'promote'],
]);

const parseArguments = (argv) => {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = OPTION_NAMES.get(argument.slice(2));
    if (!key) throw new Error(`Unsupported option: ${argument}`);
    if (key === 'resume' || key === 'fresh' || key === 'promote') {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Option ${argument} requires a value`);
    index += 1;
    options[key] = ['output', 'best', 'champion', 'objective', 'evaluationOpponent', 'evaluationMode'].includes(key) ? value : Number(value);
  }

  ['randomCount', 'fixtureCount', 'rounds', 'maxResponses', 'epochs', 'batchSize', 'evaluationRandomCount', 'diagnosticRandomCount', 'oracleScenarioCount', 'disagreementLimit', 'maxRounds', 'shortlistSize', 'minBalancedRounds', 'minBestGames']
    .forEach((key) => {
      if (!Number.isInteger(options[key]) || options[key] < 0) {
        throw new Error(`${key} must be a non-negative integer`);
      }
    });
  if (options.rounds < 1) throw new Error('rounds must be at least 1');
  if (options.shortlistSize < 1) throw new Error('shortlist-size must be at least 1');
  if (options.seed === null) options.seed = createFreshSeed();
  if (!Number.isInteger(options.seed)) throw new Error('seed must be an integer');
  if (!['net', 'hybrid'].includes(options.evaluationMode)) {
    throw new Error('evaluation-mode must be either net or hybrid');
  }
  if (!['pairwise', 'mse'].includes(options.objective)) {
    throw new Error('objective must be either pairwise or mse');
  }
  if (!['easy', 'easyplus'].includes(options.evaluationOpponent)) {
    throw new Error('evaluation-opponent must be either easy or easyplus');
  }
  if (options.resume && options.fresh) {
    throw new Error('Choose either --resume or --fresh, not both.');
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
  if (options.resume && !await exists(outputPath)) {
    throw new Error(`Cannot resume: candidate checkpoint does not exist: ${outputPath}. Run without --resume or use --fresh to start from new weights.`);
  }
  if (options.resume) {
    const candidateMetadataPath = outputPath.replace(/\.json$/i, '.metadata.json');
    const candidateMetadata = await loadMetadata(candidateMetadataPath);
    if (candidateMetadata?.labelEvaluator !== MOVEMENT_LABEL_EVALUATOR) {
      throw new Error(`Cannot resume: candidate checkpoint was not trained with ${MOVEMENT_LABEL_EVALUATOR}. Run with --fresh to start with weights trained against the current EasyAI+ labels.`);
    }
  }
  console.log(`[HardAI] Run seed ${options.seed}${process.argv.includes('--seed') ? '' : ' (random; pass --seed to reproduce)'}.`);
  const shouldResume = options.resume && !options.fresh;
  const model = shouldResume
    ? compileCandidateScorer(await loadNodeModel(outputPath))
    : compileCandidateScorer(createCandidateScorer());
  console.log(`[HardAI] ${shouldResume ? 'Resuming existing' : 'Starting fresh'} candidate scorer with ${options.objective} objective: ${options.rounds} round(s) of ${options.randomCount} new random scenario(s), ${options.epochs} epoch(s) each.`);

  let scenarioCount = 0;
  let labelCount = 0;
  let loss = NaN;
  for (let round = 1; round <= options.rounds; round += 1) {
    // Every round trains on newly generated random scenarios, so the corpus never repeats.
    const scenarios = selectScenarios(options.randomCount, options.fixtureCount, deriveSeed(options.seed, 'train', round));
    console.log(`[HardAI] Round ${round}/${options.rounds}: labeling ${scenarios.length} movement scenarios with ${options.maxResponses} response(s) per move using the EasyAI+ position evaluator.`);
    const labelSets = await generateCorpusLabels(scenarios, {
      maxResponses: Math.max(1, options.maxResponses),
      seed: deriveSeed(options.seed, 'label', round),
      onProgress: createScenarioProgressReporter('Labeling', scenarios.length),
    });
    const roundLabelCount = labelSets.reduce((total, labelSet) => total + labelSet.labels.length, 0);
    console.log(`[HardAI] Generated ${roundLabelCount} legal-action labels.`);
    scenarioCount += scenarios.length;
    labelCount += roundLabelCount;

    const history = await trainCandidateScorer(model, labelSets, {
      epochs: options.epochs,
      batchSize: options.batchSize,
      objective: options.objective,
      onEpochEnd: ({ epoch, totalEpochs, loss: epochLoss, mse, objective }) => {
        const mseText = Number.isFinite(mse) ? `, mse=${mse.toFixed(6)}` : '';
        console.log(`[HardAI] Round ${round} epoch ${epoch}/${totalEpochs} (${objective}): loss=${epochLoss.toFixed(6)}${mseText}.`);
      },
    });
    loss = history.history.loss.at(-1);
    await saveNodeModel(model, outputPath);
  }
  console.log(`[HardAI] Final training loss: ${Number(loss).toFixed(6)}`);
  console.log(`[HardAI] Saved candidate checkpoint: ${outputPath}`);

  console.log(`[HardAI] Selecting ${options.evaluationRandomCount} balanced evaluation scenarios (EasyAI+ mirror match must finish and last at least ${options.minBalancedRounds} rounds).`);
  const { scenarios: evaluationScenarios, inspected: inspectedScenarios } = await createBalancedRandomScenarios({
    count: options.evaluationRandomCount,
    seed: deriveSeed(options.seed, 'evaluation'),
    minRounds: options.minBalancedRounds,
    maxRounds: options.maxRounds,
  });
  console.log(`[HardAI] Kept ${evaluationScenarios.length} of ${inspectedScenarios} generated scenarios.`);
  const championModel = await exists(championPath)
    ? compileCandidateScorer(await loadNodeModel(championPath))
    : null;
  const evaluationSearchOptions = {
    candidateMode: options.evaluationMode,
    shortlistSize: options.shortlistSize,
    maxResponses: Math.max(1, options.maxResponses),
  };
  console.log(`[HardAI] Evaluating ${evaluationScenarios.length} scenarios (${options.evaluationMode === 'hybrid' ? `model shortlist of ${options.shortlistSize} + search` : 'model only'}) against ${options.evaluationOpponent === 'easyplus' ? 'EasyAI+' : 'EasyAI'}${championModel ? ' and the current champion' : ''}.`);
  const evaluation = await evaluateCandidate({
    candidateModel: model,
    championModel,
    scenarios: evaluationScenarios,
    evaluationOpponent: options.evaluationOpponent,
    maxRounds: options.maxRounds,
    seed: deriveSeed(options.seed, 'evaluation-match'),
    ...evaluationSearchOptions,
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
  const baseline = options.evaluationOpponent === 'easyplus' ? evaluation.againstEasyPlus : evaluation.againstEasy;
  const baselineLabel = options.evaluationOpponent === 'easyplus' ? 'EasyAI+' : 'EasyAI';
  console.log(`[HardAI] ${baselineLabel}: ${baseline.wins}W/${baseline.draws}D/${baseline.losses}L/${baseline.unfinished} unfinished (${(baseline.winRate * 100).toFixed(1)}% wins).`);
  console.log(`[HardAI] ${baselineLabel} by side: P1 ${baseline.bySide.p1.wins}W/${baseline.bySide.p1.draws}D/${baseline.bySide.p1.losses}L/${baseline.bySide.p1.unfinished} unfinished; P2 ${baseline.bySide.p2.wins}W/${baseline.bySide.p2.draws}D/${baseline.bySide.p2.losses}L/${baseline.bySide.p2.unfinished} unfinished.`);
  console.log(`[HardAI] ${baselineLabel} fallbacks: ${baseline.fallbackCount} total; by controller=${JSON.stringify(baseline.fallbackByController)}; by reason=${JSON.stringify(baseline.fallbackByReason)}.`);
  console.log(`[HardAI] Forced skips: ${baseline.forcedSkipCount} total; by controller=${JSON.stringify(baseline.forcedSkipsByController)}.`);
  if (evaluation.againstChampion) {
    console.log(`[HardAI] Champion: ${evaluation.againstChampion.wins}W/${evaluation.againstChampion.draws}D/${evaluation.againstChampion.losses}L (${(evaluation.againstChampion.winRate * 100).toFixed(1)}% wins).`);
  }
  console.log(`[HardAI] Promotion gate: ${promotion.passed ? 'PASSED' : 'not passed'}.`);
  const paired = baseline.paired;
  console.log(`[HardAI] ${baselineLabel} paired scenarios: won both colors ${paired.wonBoth}, lost both ${paired.lostBoth}, split ${paired.split}${paired.other ? `, other ${paired.other}` : ''} (${(paired.pairedWinRate * 100).toFixed(1)}% of decisive scenarios won).`);

  // The model alone is far cheaper to play than shortlist+search, so report it as a diagnostic too.
  let netOnlyEvaluation = null;
  if (options.evaluationMode === 'hybrid') {
    console.log('[HardAI] Evaluating the model alone (no search) on the same scenarios.');
    netOnlyEvaluation = await evaluateCandidate({
      candidateModel: model,
      scenarios: evaluationScenarios,
      evaluationOpponent: options.evaluationOpponent,
      maxRounds: options.maxRounds,
      seed: deriveSeed(options.seed, 'evaluation-match'),
      candidateMode: 'net',
    });
    const netBaseline = options.evaluationOpponent === 'easyplus' ? netOnlyEvaluation.againstEasyPlus : netOnlyEvaluation.againstEasy;
    console.log(`[HardAI] Model alone vs ${baselineLabel}: ${netBaseline.wins}W/${netBaseline.draws}D/${netBaseline.losses}L/${netBaseline.unfinished} unfinished (${(netBaseline.winRate * 100).toFixed(1)}% wins); paired won ${netBaseline.paired.wonBoth}, lost ${netBaseline.paired.lostBoth}, split ${netBaseline.paired.split}.`);
  }

  const metadataPath = outputPath.replace(/\.json$/i, '.metadata.json');
  const heldOutScenarios = selectScenarios(
    options.diagnosticRandomCount,
    options.fixtureCount,
    deriveSeed(options.seed, 'held-out'),
  );
  console.log(`[HardAI] Generating held-out labels for ${heldOutScenarios.length} diagnostic scenarios.`);
  const heldOutLabels = await generateCorpusLabels(heldOutScenarios, {
    maxResponses: Math.max(1, options.maxResponses),
    seed: deriveSeed(options.seed, 'held-out-label'),
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
      seed: deriveSeed(options.seed, 'oracle'),
      onProgress: createScenarioProgressReporter('Oracle benchmark', oracleScenarios.length),
    })
    : null;
  if (oracle) {
    console.log(`[HardAI] Shallow-search oracle vs EasyAI+: ${oracle.wins}W/${oracle.draws}D/${oracle.losses}L/${oracle.unfinished} unfinished (${(oracle.winRate * 100).toFixed(1)}% wins).`);
  }

  const quality = {
    baselineScoreRate: baseline.scoreRate,
    pairedWinRate: baseline.paired.pairedWinRate,
    heldOutTop1Agreement: heldOutRanking.top1Agreement,
    heldOutSpearman: heldOutRanking.meanSpearmanCorrelation,
  };
  const bestMetadataPath = bestPath.replace(/\.json$/i, '.metadata.json');
  const previousBest = await loadMetadata(bestMetadataPath);
  const featureMetadata = getCandidateFeatureMetadata();
  const previousBestGames = previousBest?.evaluation?.[options.evaluationOpponent === 'easyplus' ? 'againstEasyPlus' : 'againstEasy']?.games ?? 0;
  // A previous best only counts if it was measured the same way and on enough games to be trusted.
  const comparableBest = previousBest?.featureVersion === featureMetadata.featureVersion
    && previousBest?.options?.evaluationOpponent === options.evaluationOpponent
    && (previousBest?.options?.evaluationMode ?? 'net') === options.evaluationMode
    && previousBestGames >= options.minBestGames
    ? previousBest
    : null;
  const comparableBestQuality = comparableBest?.labelEvaluator === MOVEMENT_LABEL_EVALUATOR
    ? comparableBest.quality
    : comparableBest
      ? {
        baselineScoreRate: comparableBest.quality?.baselineScoreRate ?? comparableBest.quality?.easyScoreRate,
      }
      : null;
  const bestEligibility = {
    enoughGames: baseline.games >= options.minBestGames,
    scoreRate: baseline.scoreRate >= options.minBestScoreRate,
  };
  const isBestEligible = Object.values(bestEligibility).every(Boolean);
  const isBest = isBestEligible && isCandidateQualityImproved(quality, comparableBestQuality);
  const metadata = {
    trainedAt: new Date().toISOString(),
    options,
    scenarioCount,
    evaluationScenarioCount: evaluationScenarios.length,
    labelCount,
    trainingObjective: options.objective,
    labelEvaluator: MOVEMENT_LABEL_EVALUATOR,
    finalLoss: loss,
    evaluation,
    netOnlyEvaluation,
    promotion,
    heldOutRanking,
    oracle,
    quality,
    bestEligibility,
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
    const reason = !isBestEligible
      ? `candidate not eligible (games ${baseline.games}/${options.minBestGames}, score rate ${(baseline.scoreRate * 100).toFixed(1)}%/${(options.minBestScoreRate * 100).toFixed(1)}% required)`
      : 'candidate did not beat the existing best';
    console.log(`[HardAI] Preserved existing best candidate checkpoint: ${bestPath} (${reason}).`);
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
