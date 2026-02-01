/**
 * AI Module - Central export for all AI difficulty levels
 */

import * as superEasyAI from './superEasyAI.js';
import * as easyAI from './easyAI.js';
import * as mediumAI from './mediumAI.js';
import * as neuralAI from './neuralAI.js';
import * as hardAI from './hardAI.js';

// Initialize neural AI on module load
neuralAI.initializeNeuralAI().catch(err => {
});

/**
 * Get the AI module for a specific difficulty
 * @param {string} difficulty - 'super-easy', 'easy', 'medium', or 'hard'
 * @returns {Object} AI module with decision-making functions
 */
export const getAI = (difficulty) => {
  switch (difficulty) {
    case 'super-easy':
      return superEasyAI;
    case 'easy':
      return easyAI;
    case 'medium':
      return neuralAI;
    case 'hard':
      return hardAI;
    default:
      return superEasyAI;
  }
};

export { superEasyAI, easyAI, mediumAI, neuralAI, hardAI };
