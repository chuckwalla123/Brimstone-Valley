// src/story/storyState.js
// State helpers for Relic Hunt story mode.

import { getStoryArc } from './storyData.js';
import { getRandomAugments, AUGMENTS } from '../tower/augments.js';
import { HEROES } from '../heroes.js';

const STORY_STORAGE_KEY = 'brimstone_story_run';

export function createNewStoryRun(kingdomId) {
  const arc = getStoryArc(kingdomId);
  if (!arc) return null;
  return {
    kingdomId,
    currentNodeId: arc.map.start,
    completedNodeIds: [],
    selectedHeroes: [],
    pendingRelicChoice: null,
    relics: [],
    startedAt: Date.now(),
    lastPlayedAt: Date.now(),
    completed: false
  };
}

export function saveStoryRun(runState) {
  try {
    localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(runState));
    return true;
  } catch (e) {
    console.error('Failed to save story run:', e);
    return false;
  }
}

export function loadStoryRun() {
  try {
    const saved = localStorage.getItem(STORY_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load story run:', e);
  }
  return null;
}

export function clearStoryRun() {
  try {
    localStorage.removeItem(STORY_STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('Failed to clear story run:', e);
    return false;
  }
}

export function hasActiveStoryRun() {
  return loadStoryRun() !== null;
}

export function getStorySummary(runState) {
  if (!runState) return null;
  return {
    kingdomId: runState.kingdomId,
    completedNodes: (runState.completedNodeIds || []).length,
    relics: (runState.relics || []).length,
    lastPlayedAt: runState.lastPlayedAt,
    completed: !!runState.completed
  };
}

export function setStoryTeam(runState, heroSelections) {
  if (!runState) return runState;
  runState.selectedHeroes = heroSelections.map(sel => ({
    heroId: sel.heroId,
    position: sel.position,
    augments: sel.augments || []
  }));
  runState.lastPlayedAt = Date.now();
  saveStoryRun(runState);
  return runState;
}

export function getHeroById(heroId) {
  return HEROES.find(h => h.id === heroId) || null;
}

export function generateRelicChoices(runState, count = 3) {
  const choices = getRandomAugments(1, count);
  runState.pendingRelicChoice = choices;
  runState.lastPlayedAt = Date.now();
  saveStoryRun(runState);
  return choices;
}

export function applyRelicToHero(runState, heroIndex, augmentId, rolledValue) {
  if (!runState || !Array.isArray(runState.selectedHeroes)) return runState;
  const entry = runState.selectedHeroes[heroIndex];
  if (!entry) return runState;
  entry.augments = entry.augments || [];
  entry.augments.push({ augmentId, rolledValue });
  runState.relics = runState.relics || [];
  runState.relics.push({ augmentId, rolledValue, heroId: entry.heroId, at: Date.now() });
  runState.pendingRelicChoice = null;
  runState.lastPlayedAt = Date.now();
  saveStoryRun(runState);
  return runState;
}

export function getCurrentNode(runState) {
  if (!runState) return null;
  const arc = getStoryArc(runState.kingdomId);
  if (!arc || !arc.map) return null;
  return (arc.map.nodes || []).find(n => n.id === runState.currentNodeId) || null;
}

export function markNodeComplete(runState, nodeId) {
  if (!runState) return runState;
  runState.completedNodeIds = runState.completedNodeIds || [];
  if (!runState.completedNodeIds.includes(nodeId)) {
    runState.completedNodeIds.push(nodeId);
  }
  runState.lastPlayedAt = Date.now();
  saveStoryRun(runState);
  return runState;
}

export function advanceToNextNode(runState, nodeId, nextId) {
  if (!runState) return runState;
  markNodeComplete(runState, nodeId);
  runState.currentNodeId = nextId || null;
  if (!nextId) runState.completed = true;
  runState.lastPlayedAt = Date.now();
  saveStoryRun(runState);
  return runState;
}

export function resolveChoice(runState, choiceNextId) {
  if (!runState) return runState;
  runState.currentNodeId = choiceNextId;
  runState.lastPlayedAt = Date.now();
  saveStoryRun(runState);
  return runState;
}

export function describeAugment(augmentId, rolledValue) {
  const aug = AUGMENTS[augmentId];
  if (!aug) return '';
  const value = rolledValue != null ? rolledValue : '';
  return aug.description ? aug.description.replace('{value}', value) : '';
}
