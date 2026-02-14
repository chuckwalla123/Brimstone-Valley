/**
 * Hard AI - Makes advanced strategic decisions with predictive analysis
 * TODO: Implement hard difficulty AI
 * 
 * Strategy:
 * - Draft: Advanced synergy analysis, meta-game awareness, ban counters
 * - Movement: Predict opponent moves, optimal positioning for multi-turn plans
 */

// Placeholder - use easy AI movement for better positioning
import * as superEasyAI from './superEasyAI.js';
import * as easyAI from './easyAI.js';

export const makeBanDecision = superEasyAI.makeBanDecision;
export const makePickDecision = superEasyAI.makePickDecision;
export const makeMovementDecision = easyAI.makeMovementDecision;
export const getThinkingDelay = () => 400; // Fastest thinking
