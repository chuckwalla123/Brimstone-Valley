# HardAI Movement Training

This guide is for training the **HardAI movement candidate scorer** from the repository root. The current workflow uses supervised movement labels and evaluates the trained candidate against **EasyAI+ by default**.

> **Do not use `train.html` for this workflow.** It runs the older browser-based neural self-play trainer, which is separate from the current HardAI movement scorer.

## The training workflow at a glance

1. Generate legal movement examples and shallow-search labels scored with the EasyAI+ position evaluator.
2. Train the candidate scorer on those labels.
3. Evaluate it against EasyAI+ in both board positions (P1 and P2).
4. Review the metrics and, only when ready, request champion promotion.

Labels use the EasyAI+ position evaluator and shallow movement-response search. The shallow-search oracle is also benchmarked against EasyAI+. This aligns the training target and oracle benchmark with the **EasyAI+ opponent used to evaluate and gate the candidate**; this is not online self-play or reinforcement learning.

## Before the first run

Open a terminal in the repository root, then run the focused checks:

```bash
node ./test-training-environment.js
node ./test-movement-scenario-corpus.js
node ./test-movement-label-generator.js
node ./test-champion-evaluation.js
```

If a check fails, stop and resolve it before training. These checks verify the production movement environment, scenario generation, labels, and EasyAI+ evaluation path.

## First: run the quick smoke test

Copy and run:

```bash
npm run hardai:quick -- --fresh --evaluation-opponent easyplus
```

This starts from new model weights, trains on a small corpus, and checks evaluation against EasyAI+. It is only a setup test; do not expect it to produce a strong candidate or pass the promotion gate.

## Then: start a full training run from scratch

Copy and run:

```bash
npm run hardai:train -- --fresh --evaluation-opponent easyplus --seed 20261016
```

This uses the full default training configuration:

- 50 random training scenarios per round, one round (no fixtures by default). Use `--rounds N` to keep training on newly generated scenarios.
- Up to 4 immediate responses per labeled action.
- 20 training epochs per round with the pairwise ranking objective.
- 20 random evaluation scenarios, played once as P1 and once as P2. Only "balanced" scenarios are kept: an EasyAI+ mirror match must finish and last at least 3 rounds.
- Evaluation plays the model as a shortlist (top 4 moves) followed by the EasyAI+ lookahead search (`--evaluation-mode hybrid`); the model alone is also reported as a diagnostic.
- EasyAI+ as the evaluation and promotion baseline.
- Up to 20 rounds per evaluation match.
- A fresh random seed each run (printed at the start). Every run, and every round, trains and evaluates on new random scenarios; pass `--seed N` to reproduce one.

The run writes the candidate to `models/hardai-movement-candidate.json` and its metadata beside it. It updates `models/hardai-movement-best.json` only if the candidate was evaluated on at least `--min-best-games` games (default 40), scored at least `--min-best-score-rate` (default 50%) against the baseline, and improved on the previous best. A previous best only counts as comparable if it used the same feature version, opponent, evaluation mode and also had enough games.

The report includes paired results per scenario: won both colors, lost both, or split. Split scenarios only show that one color was favored, so the won-vs-lost ratio is the better signal.

## Next run: choose fresh weights or resume

Use **one** of these commands. Do not combine `--fresh` and `--resume`.

### Start a new independent model

```bash
npm run hardai:train -- --fresh --evaluation-opponent easyplus --seed 20261017
```

`--fresh` initializes new weights. It does not delete the best checkpoint. It overwrites the configured candidate output when training completes. If you want to keep the current candidate too, choose another output path:

```bash
npm run hardai:train -- --fresh --evaluation-opponent easyplus --seed 20261017 --output models/hardai-easyplus-seed-20261017.json --best models/hardai-easyplus-seed-20261017-best.json
```

### Continue from the saved candidate

```bash
npm run hardai:train -- --resume --evaluation-opponent easyplus --seed 20261017
```

`--resume` loads `models/hardai-movement-candidate.json` and continues fitting it on the labels generated for this run. It does **not** reload a previous run's label dataset. If the candidate checkpoint is missing or incompatible, the command stops with an error; it will not silently start from scratch.

The current labels use the EasyAI+ position evaluator. A candidate trained before this label change is not compatible for resuming; use `--fresh` for the next run. The trainer will reject `--resume` when its metadata shows a different label evaluator.

### Which option should I use?

| What you want | Command choice |
|---|---|
| New model, first run, or independent experiment | Use `--fresh` |
| Continue training the existing candidate checkpoint | Use `--resume` |
| Evaluate only; do not train | Use `npm run hardai:evaluate` |
| Promote only after reviewing a passing run | Add `--promote` to the training command |

You do not need `--fresh` when running `npm run hardai:quick` by itself: the trainer starts fresh by default. The examples include `--fresh` to make the intended behavior explicit. There is no automatic resume.

## Evaluation only

Evaluate the current candidate against EasyAI+ without training:

```bash
npm run hardai:evaluate -- --model models/hardai-movement-candidate.json --evaluation-opponent easyplus
```

For a comparison against regular EasyAI instead:

```bash
npm run hardai:evaluate -- --model models/hardai-movement-candidate.json --evaluation-opponent easy
```

Training also accepts `--evaluation-opponent easy` if you specifically want the regular EasyAI benchmark. If omitted, the training and evaluation scripts use EasyAI+.

## Promotion

Training never promotes a model unless `--promote` is explicitly supplied. The default gate checks the selected baseline and, if a champion exists, the current champion. The EasyAI+ baseline gate requires:

- At least 40 completed baseline games, balanced across P1 and P2.
- At least a 55% win rate and a 50% Wilson lower confidence bound.
- No unfinished games.
- At least a 50% win rate against the existing champion, when present.
- The candidate must also improve the recorded best-candidate quality.

After reviewing a run, continue from the candidate and request promotion with:

```bash
npm run hardai:train -- --resume --promote --evaluation-opponent easyplus --seed 20261018
```

The champion is copied to `models/hardai-movement-champion.json` only if all promotion and best-candidate checks pass. Otherwise, the command reports failure and leaves the champion unchanged.

## Useful commands

Use the full training command with overrides when you want a larger run:

```bash
npm run hardai:train -- --fresh --evaluation-opponent easyplus --random-count 100 --max-responses 6 --epochs 30 --evaluation-random-count 40 --seed 20261020
```

Compare the pairwise objective with the legacy absolute-score regression objective using the same seed and separate output files:

```bash
npm run hardai:train -- --fresh --evaluation-opponent easyplus --objective pairwise --seed 20261022 --output models/hardai-pairwise.json --best models/hardai-pairwise-best.json
npm run hardai:train -- --fresh --evaluation-opponent easyplus --objective mse --seed 20261022 --output models/hardai-mse.json --best models/hardai-mse-best.json
```

The supported training options are:

| Option | Default | Purpose |
|---|---:|---|
| `--fresh` | off | Explicitly initialize new model weights. |
| `--resume` | off | Resume from the selected candidate checkpoint; errors if it is missing. |
| `--promote` | off | Copy the candidate to the champion path only if all gates pass. |
| `--evaluation-opponent easyplus\|easy` | `easyplus` | Select the evaluation and promotion baseline. |
| `--random-count N` | `50` | Random training scenarios per round. |
| `--rounds N` | `1` | Training rounds; each generates new random scenarios and trains `--epochs` epochs. |
| `--fixture-count N` | `0` | Number of tactical fixtures (maximum 5). |
| `--max-responses N` | `4` | Immediate responses evaluated for each action label. |
| `--epochs N` | `20` | Training epochs per round. |
| `--batch-size N` | `32` | Training batch size. |
| `--objective pairwise\|mse` | `pairwise` | Ranking loss or legacy score regression. |
| `--evaluation-random-count N` | `20` | Balanced random scenarios used in baseline evaluation. |
| `--evaluation-mode hybrid\|net` | `hybrid` | Evaluate the model shortlist plus search, or the model alone. |
| `--shortlist-size N` | `4` | Moves the model passes to the search in hybrid mode. |
| `--min-balanced-rounds N` | `3` | Minimum EasyAI+ mirror-match length for an evaluation scenario. |
| `--min-best-games N` | `40` | Games required before a candidate can become the best checkpoint. |
| `--min-best-score-rate X` | `0.5` | Baseline score rate required to become the best checkpoint. |
| `--max-rounds N` | `20` | Round cap per evaluation match. |
| `--seed N` | random | Reproducible training and scenario seed; a new one is chosen each run if omitted. |
| `--output PATH` | `models/hardai-movement-candidate.json` | Candidate checkpoint path. |
| `--best PATH` | `models/hardai-movement-best.json` | Best-candidate checkpoint path. |
| `--champion PATH` | `models/hardai-movement-champion.json` | Champion checkpoint path. |

`--fresh` and `--resume` are mutually exclusive. When `--resume` is omitted, the trainer starts fresh; it never resumes implicitly.

## Reading the results

The terminal output reports per-match outcomes, candidate side, round count, fallback moves, forced skips, and baseline results broken down by P1/P2. The JSON metadata beside the candidate also includes:

- Held-out top-1 and top-3 agreement with the shallow-search labels.
- Spearman correlation between predicted and labeled action rankings.
- A shallow-search oracle benchmark against EasyAI+.
- Evaluation and promotion-gate details for the selected baseline.

Interpretation:

| Result | What to check next |
|---|---|
| Many fallbacks | Investigate action translation or legal-action handling before comparing win rates. |
| P1 and P2 results differ sharply | Inspect board mirroring and side-specific behavior using `npm run hardai:monitor`. |
| Oracle loses to EasyAI+ | Improve the labels/search/evaluator before increasing training time. |
| Oracle wins but the scorer loses | Improve features, training data, or scorer fitting. |
| Held-out ranking improves but EasyAI+ results do not | The scorer is matching labels better, but those labels may not improve play against EasyAI+. |

`unfinished` means the configured round cap was reached. It is not a draw and blocks promotion by default. Forced skips, such as when all eligible heroes are movement-locked, are expected game behavior; fallbacks from an invalid or missing controller action are not.

To inspect individual movement choices and board snapshots, run:

```bash
npm run hardai:monitor -- --games 4 --seed 20261016 --p1 easyplus --p2 easy
```

## Checkpoints and feature versions

Candidate checkpoints record the candidate feature version. If the feature encoder changes, an old checkpoint cannot be resumed safely. Start with `--fresh` (and use a new `--output` path if you want to retain the old file). The trainer reports incompatible checkpoints rather than silently loading them.

The current scorer and its checkpoints are Node-based JSON files under `models/`. They are separate from the older browser IndexedDB neural model.

## Focused tests

Run these after changing training or evaluation code:

```bash
node ./test-training-environment.js
node ./test-movement-candidate-scorer.js
node ./test-movement-label-generator.js
node ./test-champion-evaluation.js
node ./test-training-diagnostics.js
```

## Main implementation files

- `scripts/train-hardai-movement.mjs` - training CLI, checkpoint handling, evaluation, and optional promotion.
- `scripts/evaluate-hardai-movement.mjs` - evaluation-only CLI.
- `src/ai/training/environment.js` - legal movement and production battle-round transitions.
- `src/ai/training/scenarioCorpus.js` - tactical fixtures and seeded random states.
- `src/ai/training/labelGenerator.js` - shallow-search labels for legal actions.
- `src/ai/training/candidateFeatures.js` - board-aware feature encoding.
- `src/ai/training/candidateScorer.js` - trainable movement scorer.
- `src/ai/training/easyAIPlusTeacher.js` - EasyAI+ movement decision logic.
- `src/ai/training/championEvaluation.js` - side-balanced baseline/champion matches and promotion gates.
- `src/ai/training/trainingDiagnostics.js` - held-out label ranking and oracle diagnostics.
