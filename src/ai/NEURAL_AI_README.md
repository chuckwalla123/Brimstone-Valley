# Neural AI Training System

Self-play reinforcement learning system for board game AI (AlphaZero-style).

## Architecture

### Core Components

1. **State Encoder** (`stateEncoder.js`)
   - Converts game state to neural network input
   - Encodes 14 slots (7 per player): hero stats, spells, effects, positions
   - Action space: 50 actions (7×7 board moves + noop)

2. **Neural Network** (`model.js`)
   - ResNet-style with residual blocks
   - **Policy Head**: Outputs move probability distribution
   - **Value Head**: Outputs win probability (-1 to +1)
   - ~100K parameters (configurable)

3. **Monte Carlo Tree Search** (`mcts.js`)
   - Explores move tree using neural network guidance
   - UCB formula balances exploration vs exploitation
   - Integrates with `executeRound` for accurate battle simulation

4. **Self-Play Generator** (`selfPlay.js`)
   - AI plays games against itself
   - Each move guided by MCTS
   - Produces training examples: (state, policy, outcome)

5. **Training Loop** (`trainer.js`)
   - Generate self-play games → Train network → Repeat
   - Saves model to IndexedDB (browser storage)
   - Keeps last 10,000 training examples

6. **Production-rule training environment** (`training/environment.js`)
   - Uses the production battle engine to resolve rounds
   - Provides immutable movement state transitions and exact priority sequencing
   - Enumerates and validates legal movement actions before a model can score them
   - Is intentionally separate from the legacy neural self-play loop until that loop is migrated

## Training Environment Parity Check

Before using the environment for generated training data, verify that its round resolution remains identical to the production engine:

```bash
node ./test-training-environment.js
```

The test covers priority order, shackle-aware legal movement generation, immutable movement transitions, and a seeded production-engine round parity check. It ignores only generated hero instance IDs, which differ across otherwise equivalent engine executions.

## Movement Scenario Corpus

`training/scenarioCorpus.js` supplies the movement-only input set for the first HardAI milestone. It keeps draft and ban decisions out of scope and produces:

- Fixed tactical fixtures for conditional spells, cleanse and buff removal, shackle restrictions, full-board reserve swaps, corpses, and Burn.
- Seeded random valid battle states with 3-5 main heroes and 0-2 reserve heroes per side.
- Only states with at least one action validated by `training/environment.js`.

Generate a corpus from code:

```javascript
import { createMovementScenarioCorpus } from './src/ai/training/scenarioCorpus.js';

const corpus = createMovementScenarioCorpus({ randomCount: 500, seed: 20261016 });
```

The supplied seed makes the random portion reproducible. Validate the corpus with:

```bash
node ./test-movement-scenario-corpus.js
```

## Shallow-Search Movement Labels

`training/labelGenerator.js` turns every legal action in a movement scenario into a supervised ranking label:

1. Applies the candidate through `training/environment.js`.
2. Evaluates a bounded set of the immediate mover's strongest static responses.
3. Completes the remaining movement decisions with deterministic greedy rollouts.
4. Resolves the battle round with the production battle engine.
5. Scores the resulting board using the existing EasyAI hero evaluator from the active mover's perspective.

The immediate responder maximizes the score when it is the active side and minimizes it when it is the opponent. The default response bound is eight; increase it only for offline label production after measuring runtime.

```javascript
import { generateMovementLabels } from './src/ai/training/labelGenerator.js';
import { createMovementScenarioCorpus } from './src/ai/training/scenarioCorpus.js';

const [scenario] = createMovementScenarioCorpus({ randomCount: 0 });
const labels = await generateMovementLabels(scenario, { maxResponses: 8, seed: 20261016 });
// labels.bestAction, labels.bestScore, labels.labels
```

The generator is deterministic for the same state, configuration, and seed. Validate it with:

```bash
node ./test-movement-label-generator.js
```

## Legal-Candidate Scorer

`training/candidateScorer.js` is the first trainable HardAI component. Unlike the legacy global policy network, it scores only actions already confirmed legal by `training/environment.js`.

The corresponding `training/candidateFeatures.js` encoder includes:

- Every main and reserve slot for both teams, before and after the candidate move.
- Per-slot hero identity, current health, armor, energy, speed, spell power, and casts remaining.
- Per-slot alive/dead corpse state, buffs, debuffs, movement locks, revived state, and exact effect counts.
- Source and destination board slots, active side, and movement index.

Train it from Step 3 labels:

```javascript
import {
  compileCandidateScorer,
  createCandidateScorer,
  scoreLegalMovementActions,
  trainCandidateScorer,
} from './src/ai/training/candidateScorer.js';

const model = compileCandidateScorer(createCandidateScorer());
await trainCandidateScorer(model, labelSets, { epochs: 20, batchSize: 32 });
const rankedMoves = await scoreLegalMovementActions(model, state, perspectiveSide);
```

Scores are learned from bounded production-round labels and returned in descending order. The model can be saved with `saveCandidateScorer` and loaded with `loadCandidateScorer`; the default IndexedDB path is separate from the legacy AlphaZero-style model.

### Feature encoder migration

The current board-aware encoder is feature version 2. Checkpoints trained before this upgrade use the retired aggregate encoder and cannot be resumed or evaluated safely. Start a fresh candidate:

```bash
npm run hardai:quick
```

Then run a fresh full training command **without** `--resume`. New portable checkpoints record their feature version and reject incompatible loads explicitly.

Validate the scorer with:

```bash
node ./test-movement-candidate-scorer.js
```

## Champion Evaluation and Promotion

`training/championEvaluation.js` prevents an unmeasured scorer from becoming HardAI. It evaluates a candidate in both P1 and P2 positions against:

- **EasyAI**, always.
- The current saved candidate-scorer champion, when one exists.

MediumAI is intentionally not included. Its self-play cost is too high for a meaningful evaluation volume, and EasyAI is the selected baseline.

Each movement decision is made through the production-rule environment. Matches are seedable, capped by a configurable round count, and record any explicit fallback if a controller emits no legal move. The default promotion gate requires:

- At least 40 color-balanced EasyAI games.
- At least a 55% candidate win rate against EasyAI.
- A Wilson lower confidence bound of at least 50% against EasyAI.
- At least a 50% win rate against the current champion, if one exists.

Use the gate with an explicit persistence callback:

```javascript
import {
  evaluateAndPromoteCandidate,
  savePromotedChampion,
} from './src/ai/training/championEvaluation.js';

const result = await evaluateAndPromoteCandidate({
  candidateModel,
  championModel,
  scenarios,
  onPromote: savePromotedChampion,
});
```

No model is saved automatically; promotion requires the gate to pass and a supplied `onPromote` callback. Validate the harness with:

```bash
node ./test-champion-evaluation.js
```

## Run HardAI Movement Training

The movement scorer can now be trained from the repository root with Node. It writes portable JSON checkpoints under `models/`; these are separate from the legacy browser IndexedDB model.

### First run: quick verification

```bash
npm run hardai:quick
```

This generates labels for the five tactical fixtures plus two seeded random scenarios, trains for five epochs, saves:

- `models/hardai-movement-candidate.json`
- `models/hardai-movement-candidate.metadata.json`

It then evaluates the candidate against EasyAI. This is a smoke run, not a model expected to pass promotion.

### Full training

```bash
npm run hardai:train
```

The default run uses five fixtures, 50 random training scenarios, four immediate responses per labeled action, 20 epochs, and 20 held-out random evaluation scenarios. It evaluates only against EasyAI and a current champion checkpoint when one exists.

### Terminal progress

Training prints progress while it is running:

- Labeling and held-out labeling: approximately ten evenly spaced scenario updates, including the most recently completed scenario.
- Model fitting: one ranking-loss update for every pairwise epoch, or loss and MSE for the legacy MSE objective.
- EasyAI/champion evaluation: approximately ten evenly spaced scenario updates for each benchmark.
- Shallow-search oracle benchmark: periodic completed-scenario updates.

For example:

```text
[HardAI] Labeling: 33/105 scenarios; latest: random-20261020-28.
[HardAI] Training epoch 12/30 (pairwise): loss=0.241823.
[HardAI] Match (easyai): HardAI=P1, result=WIN, outcome=P1, rounds=3, scenario=random-20261021-7.
[HardAI] Match (easyai): HardAI=P2, result=LOSS, outcome=P1, rounds=2, scenario=random-20261021-7.
[HardAI] Evaluating (easyai): 18/45 scenarios.
```

Each benchmark scenario is played once with HardAI as P1 and once as P2. The match lines make side-specific win/loss patterns and fallback counts visible for diagnosing mirroring or legal-action issues.

Useful overrides can be passed after `--`:

```bash
npm run hardai:train -- --random-count 100 --max-responses 6 --epochs 30 --evaluation-random-count 40 --seed 20261020
```

The default `pairwise` objective learns that the shallow-search-preferred legal action must rank above another legal action from the same state. This directly optimizes move selection. Use `--objective mse` only as a same-corpus baseline comparison with the legacy absolute-score regression objective.

To compare objectives, use the same corpus options and seed, but separate output paths so neither run overwrites the other:

```bash
npm run hardai:train -- --objective pairwise --seed 20261022 --output models/hardai-pairwise.json --best models/hardai-pairwise-best.json
npm run hardai:train -- --objective mse --seed 20261022 --output models/hardai-mse.json --best models/hardai-mse-best.json
```

Compare the two metadata files' held-out top-1/top-3 agreement and Spearman correlation first. Use the EasyAI score only as a later confirmation because it is much noisier.

Resume a previously saved candidate checkpoint:

```bash
npm run hardai:train -- --resume --epochs 20
```

Evaluate an existing checkpoint without training:

```bash
npm run hardai:evaluate
```

### Reading evaluation outcomes

The evaluation JSON and terminal match lines distinguish four outcomes:

- `win` / `loss`: a terminal game where one side was eliminated.
- `draw`: a real terminal draw, where neither side remains.
- `unfinished`: the configured round cap was reached before a terminal result. This is **not** counted as a draw and blocks promotion by default.

The default maximum is 20 rounds, matching the betting battle limit. Use `--max-rounds` only when intentionally running a shorter smoke evaluation.

The aggregate output includes an `againstEasy.bySide` section so P1 and P2 records can be compared directly, plus `fallbackByController` and `fallbackByReason`. A fallback means a controller returned no action or an illegal action while a legal move existed, and warrants investigation; each affected terminal match line also identifies the rejected attempted action. `forcedSkipCount` and `forcedSkipsByController` separately report turns with no legal movement action, such as when every living hero is Shackled; forced skips are expected game behavior and are not controller failures.

### Promotion

Training never replaces the champion by default. After a candidate meets the EasyAI/champion gate, rerun with:

```bash
npm run hardai:train -- --promote
```

If the gate passes, the candidate checkpoint is copied to `models/hardai-movement-champion.json`; otherwise the command exits with an error and leaves the champion unchanged.

## Training Diagnostics

Every training run now generates held-out labels from a different seed and reports:

- **Top-1 agreement:** how often the scorer selects the shallow-search label's best legal move.
- **Top-3 agreement:** how often the label's best move appears in the scorer's top three.
- **Spearman correlation:** agreement between the full predicted and labeled action rankings.
- **Shallow-search oracle vs EasyAI:** whether the labels themselves produce stronger decisions than EasyAI.

These values diagnose the next action:

| Observation | Meaning | Next step |
|---|---|---|
| Training loss falls, but held-out agreement stays low | The scorer is overfitting or features/model capacity are insufficient. | Improve features/model selection; do not merely add epochs. |
| Oracle loses to EasyAI | The shallow-search labels are weak. | Improve label search depth, response policy, or evaluator before training again. |
| Oracle wins, scorer loses | Labels are useful but the scorer is not reproducing them. | Improve encoder, training data, architecture, or checkpoint selection. |
| Held-out agreement and EasyAI score both improve | Training is productive. | Continue from the best checkpoint with a new seed and more scenarios. |

Each run writes disagreement examples to the candidate metadata file. The candidate checkpoint is always saved, but `models/hardai-movement-best.json` is replaced only when it improves the recorded EasyAI score, held-out top-1 agreement, or held-out ranking correlation.

Validate the diagnostic components with:

```bash
node ./test-training-diagnostics.js
```

## How to Train

### Option 1: Training UI (Recommended)

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open in browser:
   ```
   http://localhost:5173/train.html
   ```

3. Configure training:
   - **Iterations**: Number of self-play → training cycles
   - **Games per Iteration**: How many games to generate
   - **MCTS Simulations**: Search depth per move (higher = smarter but slower)
   - **Training Epochs**: How many times to train on data

4. Click "⚡ Quick Test" for a fast test run (3 iterations)
   - Or "▶️ Start Training" for full custom training

### Option 2: Programmatic Training

```javascript
import { runTrainingLoop } from './src/ai/training/trainer.js';

// Quick test (fast)
await runTrainingLoop({
  iterations: 3,
  gamesPerIteration: 2,
  mctsSimulations: 20,
  trainEpochs: 3
});

// Production training (slow but high quality)
await runTrainingLoop({
  iterations: 20,
  gamesPerIteration: 10,
  mctsSimulations: 50,
  trainEpochs: 10
});
```

## Training Process

Each iteration:

1. **Self-Play Phase**
   - Generate N games (AI vs AI)
   - Each move: Run MCTS with M simulations
   - Store training examples: (state, MCTS policy, game outcome)

2. **Training Phase**
   - Train neural network on all collected examples
   - Policy head learns to predict MCTS move distribution
   - Value head learns to predict game outcome

3. **Save Phase**
   - Save model to IndexedDB every 2 iterations
   - Save training examples to localStorage

## Using the Trained AI

Once trained, the AI can be used in the game:

```javascript
import { initializeNeuralAI, makeMovementDecision } from './src/ai/neuralAI.js';

// Initialize (loads trained model)
await initializeNeuralAI();

// Make decisions
const decision = await makeMovementDecision(
  p2Board, 
  p2Reserve, 
  movement, 
  p1Board, 
  p1Reserve
);
```

## Performance Expectations

### Training Time (approximate)

With default settings (MCTS simulations = 30):
- **Quick Test** (3 iterations, 2 games): ~10-15 minutes
- **Full Training** (20 iterations, 10 games): ~2-4 hours

Time per game depends on:
- MCTS simulations (more = slower but better)
- Game length (longer games = more moves)
- Hardware (GPU acceleration helps)

### Quality Progression

- **0 iterations**: Random moves (baseline)
- **5 iterations**: Basic patterns emerge
- **10 iterations**: Decent strategic play
- **20+ iterations**: Strong tactical awareness

## Tips for Better Training

1. **Start small**: Run quick test first to verify setup
2. **Monitor logs**: Watch for errors or unusual patterns
3. **Iterative training**: Train for 5 iterations, test, then continue
4. **Balance MCTS sims**: 25-50 is good balance of speed/quality
5. **Add new heroes**: Retrain whenever you add heroes to the game

## Troubleshooting

**Training is very slow**
- Reduce MCTS simulations (try 20)
- Reduce games per iteration
- Each MCTS simulation runs full battle engine

**Model not improving**
- Need more training data (more games)
- Increase MCTS simulations for better data quality
- Check that battles are ending (not infinite loops)

**Out of memory**
- Training data capped at 10,000 examples
- TensorFlow.js will dispose tensors automatically
- Refresh page if memory issues persist

**Model not loading in game**
- Verify model saved: Check browser DevTools → Application → IndexedDB
- Reinitialize: Call `initializeNeuralAI()` again

## File Structure

```
src/ai/
├── neuralAI.js              # Game integration (use this in DraftBoard, etc.)
├── training/
│   ├── environment.js       # Production-rule movement and round adapter
│   ├── scenarioCorpus.js    # Tactical fixtures and seeded movement states
│   ├── labelGenerator.js    # Bounded exact-round labels for every legal movement
│   ├── candidateFeatures.js # Runtime pre/post-action feature encoder
│   ├── candidateScorer.js   # Supervised legal-candidate model and inference
│   ├── championEvaluation.js # EasyAI/champion evaluation and promotion gates
│   ├── nodeModelCheckpoint.js # Node-only portable scorer checkpoint support
│   ├── trainingDiagnostics.js # Held-out agreement, oracle benchmark, checkpoint quality
│   ├── stateEncoder.js      # State → tensor conversion
│   ├── model.js             # Neural network architecture
│   ├── mcts.js              # Monte Carlo Tree Search
│   ├── selfPlay.js          # Self-play game generator
│   ├── trainer.js           # Training loop
│   └── test-setup.js        # Verification script
└── models/                  # (Reserved for future file-based models)

train.html                   # Training UI
```

## Next Steps

- [ ] Add "Neural" difficulty option to game
- [ ] Implement model evaluation (new vs old)
- [ ] Add training progress visualization
- [ ] Export models for sharing
- [ ] Train specialized models per hero pool

## Advanced: Custom Training

Customize training behavior:

```javascript
import { createModel, compileModel } from './src/ai/training/model.js';

// Create bigger model
const model = createModel({
  hiddenSize: 512,        // More neurons
  numResidualBlocks: 8    // Deeper network
});

compileModel(model, 0.0005);  // Lower learning rate
```

## Credits

Based on AlphaZero architecture (Silver et al., 2017):
- Neural network guides Monte Carlo Tree Search
- Self-play generates training data
- Policy and value heads learn from MCTS results
