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
