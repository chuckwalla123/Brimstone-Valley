# AI Module

This directory contains all AI opponent logic for single-player mode.

## Structure

```
src/ai/
  ├── index.js           # Main export - getAI(difficulty) function
  ├── superEasyAI.js     # ✅ Implemented - Random decisions
  ├── easyAI.js          # 🚧 TODO - Basic strategic decisions
  ├── mediumAI.js        # Tactical EasyAI wrapper with simulation + synergy
  └── hardAI.js          # 🚧 TODO - Advanced predictive analysis
```

## Usage

```javascript
import { getAI } from './ai';

const ai = getAI('super-easy');
const decision = ai.makeMovementDecision(p2Board, p2ReserveBoard, movement);
```

## AI Interface

Each AI module exports the following functions:

### `makeBanDecision(availableHeroes)`
Returns a hero to ban during the draft phase.
- **Parameters**: `availableHeroes` - Array of heroes that can be banned
- **Returns**: Hero object or null

### `makePickDecision(availableHeroes, playerBoard)`
Returns a hero and slot to pick during the draft phase.
- **Parameters**: 
  - `availableHeroes` - Array of heroes that can be picked
  - `playerBoard` - Current board state
- **Returns**: `{ hero, slotIndex }` or null

### `makeMovementDecision(p2Board, p2ReserveBoard, movement)`
Returns a move decision during the battle movement phase.
- **Parameters**:
  - `p2Board` - P2's main board array
  - `p2ReserveBoard` - P2's reserve board array
  - `movement` - Movement hook object with phase info
- **Returns**: `{ sourceId, destinationId }` or null

### `getThinkingDelay()`
Returns the delay in milliseconds before the AI makes a decision.
- **Returns**: Number (milliseconds)

## Difficulty Levels

### Super Easy (✅ Implemented)
- **Strategy**: Completely random decisions
- **Draft**: Random bans and picks
- **Movement**: Random swaps
- **Thinking Delay**: 1000ms
- **Target Audience**: Complete beginners learning the game

### Easy (🚧 TODO)
- **Strategy**: Basic strategic awareness
- **Draft**: Prefer heroes with higher stats
- **Movement**: Move damaged heroes to reserve, keep healthy heroes forward
- **Thinking Delay**: 800ms
- **Target Audience**: Players familiar with basic mechanics

### Medium
- **Strategy**: Tactical with team composition awareness
- **Draft**: Counter-pick against opponent, balance team composition
- **Movement**: Use EasyAI candidate scoring, then re-rank top moves with one-round simulation and setup/denial heuristics
- **Thinking Delay**: 600ms
- **Target Audience**: Intermediate players

### Hard (🚧 TODO)
- **Strategy**: Advanced predictive analysis
- **Draft**: Meta-game awareness, ban counters, synergy analysis
- **Movement**: Predict opponent moves, multi-turn planning
- **Thinking Delay**: 400ms
- **Target Audience**: Experienced players seeking challenge

## Integration Points

### DraftBoard.jsx
```javascript
import { getAI } from './ai';

useEffect(() => {
  if (aiDifficulty && currentAction.player === 'player2') {
    const ai = getAI(aiDifficulty);
    const decision = currentAction.type === 'ban' 
      ? ai.makeBanDecision(availableHeroes)
      : ai.makePickDecision(availableHeroes, player2Board);
    // Execute decision...
  }
}, [aiDifficulty, currentAction]);
```

### BattlePhase.jsx
```javascript
import { getAI } from './ai';

useEffect(() => {
  if (aiDifficulty && gameState === 'movement') {
    const ai = getAI(aiDifficulty);
    const decision = ai.makeMovementDecision(p2Board, p2ReserveBoard, movement);
    if (decision) {
      movement.handleSwapById(decision.sourceId, decision.destinationId);
    }
  }
}, [aiDifficulty, gameState, movement]);
```

## Development Roadmap

1. **Phase 1** (✅ Complete): Super Easy AI - Random decisions
2. **Phase 2** (Next): Easy AI - Basic strategic decisions
3. **Phase 3**: Medium AI - Tactical synergy-based decisions
4. **Phase 4**: Hard AI - Advanced predictive AI

Each phase builds on the previous, with increasing complexity in decision-making algorithms.
