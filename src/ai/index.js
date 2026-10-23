/**
 * AI Module - Central export for all AI difficulty levels
 */

import * as superEasyAI from './superEasyAI.js';
import * as easyAI from './easyAI.js';
import * as easyAIPlusAI from './easyAIPlusAI.js';
import * as mediumAI from './mediumAI.js';
import * as neuralAI from './neuralAI.js';
import * as hardAI from './hardAI.js';

/**
 * Get the AI module for a specific difficulty
 * @param {string} difficulty - Player-selectable difficulty, or internal 'easy-plus'
 * @returns {Object} AI module with decision-making functions
 */
export const getAI = (difficulty) => {
  switch (difficulty) {
    case 'super-easy':
      return superEasyAI;
    case 'easy':
      return easyAI;
    case 'easy-plus':
      return easyAIPlusAI;
    case 'medium':
      return mediumAI;
    case 'hard':
      return hardAI;
    default:
      return superEasyAI;
  }
};

export { superEasyAI, easyAI, easyAIPlusAI, mediumAI, neuralAI, hardAI };
