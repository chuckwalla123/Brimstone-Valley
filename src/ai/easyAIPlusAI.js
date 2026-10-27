/**
 * EasyAI+ AI - EasyAI+ movement with MediumAI draft decisions.
 * Intended for gameplay testing and observing EasyAI+ movement behavior.
 */

import * as easyAI from './easyAI.js';
import * as mediumAI from './mediumAI.js';
import { makeEasyAIPlusMovementDecision } from './training/easyAIPlusTeacher.js';

export const makeBanDecision = (availableHeroes, boardState = null) =>
	easyAI.makeBanDecision(availableHeroes, boardState);

export const makePickDecision = (availableHeroes, boardState) =>
	easyAI.makePickDecision(availableHeroes, boardState);

export const makeMovementDecision = (p2Board, p2ReserveBoard, movement, p1Board = [], p1ReserveBoard = []) =>
	makeEasyAIPlusMovementDecision(p2Board, p2ReserveBoard, p1Board, p1ReserveBoard, movement)
	|| mediumAI.makeMovementDecision(p2Board, p2ReserveBoard, movement, p1Board, p1ReserveBoard);

export const getThinkingDelay = () => 450;
