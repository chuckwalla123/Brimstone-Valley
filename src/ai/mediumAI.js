/**
 * Medium AI - Tactical EasyAI wrapper.
 *
 * Strategy:
 * - Use EasyAI's static evaluation as the baseline scorer.
 * - Re-rank only the strongest candidate moves with one-round battle simulation.
 * - Add composition and synergy heuristics during draft.
 */

import { executeRound } from '../battleEngine.js';
import { getEffectByName } from '../effects.js';
import { deepClone } from '../../shared/gameLogic.js';
import { indexToRow, resolveTargets } from '../targeting.js';
import { getSpellById } from '../spells.js';
import {
  evaluateHeroPoints,
  makeBanDecision as makeEasyBanDecision,
  makeMovementDecision as makeEasyMovementDecision,
} from './easyAI.js';
import { EFFECT_EVALUATION_OVERRIDES } from './effectEvaluationOverrides.js';

const TOP_MOVEMENT_CANDIDATES = 5;
const MEDIUM_THINK_MIN_MS = 650;
const MEDIUM_THINK_MAX_MS = 1050;
const EXPECTED_TARGET_SPEED = 3;
const DRAFT_EFFECT_HORIZON = 6;
const DRAFT_TOP_PICK_CANDIDATES = 5;
const DRAFT_TOP_RESPONSE_CANDIDATES = 4;
const DRAFT_TOP_FOLLOWUP_CANDIDATES = 2;
const DRAFT_TOP_SLOT_VARIANTS_PER_HERO = 3;
const DRAFT_SIMULATION_WEIGHT = 0.65;
const DRAFT_SIMULATION_ROUNDS = 2;
const EARLY_DRAFT_EXTRA_LOOKAHEAD_MAX_FILLED = 4;

const countsTowardMainLimit = (tile) => !!(tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true);
const isAliveTile = (tile) => !!(tile && tile.hero && !tile._dead);

const getNoopMove = (board, reserve) => {
  for (let index = 0; index < (board || []).length; index += 1) {
    if (isAliveTile(board[index])) return { sourceId: `p2:${index}`, destinationId: `p2:${index}` };
  }
  for (let index = 0; index < (reserve || []).length; index += 1) {
    if (isAliveTile(reserve[index])) return { sourceId: `p2Reserve:${index}`, destinationId: `p2Reserve:${index}` };
  }
  return { sourceId: 'p2:0', destinationId: 'p2:0' };
};

const hasPreventMovement = (tile) => {
  if (!tile) return false;
  const effects = Array.isArray(tile.effects) ? tile.effects : (Array.isArray(tile.hero?.effects) ? tile.hero.effects : []);
  return effects.some(effect => effect && effect.preventMovement);
};

const parseToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  if (token.startsWith('p2Reserve:')) return { isReserve: true, idx: Number(token.split(':')[1]) };
  if (token.startsWith('p2:')) return { isReserve: false, idx: Number(token.split(':')[1]) };
  return null;
};

const cloneBoard = (tiles = []) => tiles.map(tile => (tile ? deepClone(tile) : tile));

const getRowKey = (index, side = 'p2') => {
  const row = indexToRow(index, side);
  if (row === 0) return 'front';
  if (row === 1) return 'middle';
  return 'back';
};

const getActiveSpell = (hero, tileIndex, side = 'p2') => {
  if (!hero || tileIndex < 0) return null;
  const rowKey = getRowKey(tileIndex, side);
  const spellData = hero.spells?.[rowKey];
  const spellId = spellData?.spell || spellData?.id;
  return spellId ? getSpellById(spellId) : null;
};

const getOpponent = (player) => (player === 'player2' ? 'player1' : 'player2');

const getPlayerBoards = (state, player) => player === 'player2'
  ? { main: state.p2Main || [], reserve: state.p2Reserve || [] }
  : { main: state.p1Main || [], reserve: state.p1Reserve || [] };

const cloneDraftState = (state) => ({
  p1Main: cloneBoard(state?.p1Main || []),
  p1Reserve: cloneBoard(state?.p1Reserve || []),
  p2Main: cloneBoard(state?.p2Main || []),
  p2Reserve: cloneBoard(state?.p2Reserve || []),
});

const createEmptyDraftState = () => ({
  p1Main: Array(9).fill(null),
  p1Reserve: Array(2).fill(null),
  p2Main: Array(9).fill(null),
  p2Reserve: Array(2).fill(null),
});

const countDraftedHeroes = (state) => [
  ...(state?.p1Main || []),
  ...(state?.p1Reserve || []),
  ...(state?.p2Main || []),
  ...(state?.p2Reserve || []),
].filter(isAliveTile).length;

const shouldUseExtendedDraftLookahead = (state) => countDraftedHeroes(state) <= EARLY_DRAFT_EXTRA_LOOKAHEAD_MAX_FILLED;

const createDraftTile = (hero, slot = {}) => {
  const clonedHero = deepClone(hero);
  return {
    ...slot,
    hero: clonedHero,
    effects: Array.isArray(slot?.effects) ? deepClone(slot.effects) : [],
    _dead: false,
    currentHealth: Number(clonedHero.currentHealth ?? clonedHero.health ?? 0),
    currentArmor: Number(clonedHero.currentArmor ?? clonedHero.armor ?? 0),
    currentEnergy: Number(clonedHero.currentEnergy ?? clonedHero.energy ?? 0),
    currentSpeed: Number(clonedHero.currentSpeed ?? clonedHero.speed ?? 0),
    currentSpellPower: Number(clonedHero.currentSpellPower ?? clonedHero.spellPower ?? 0),
  };
};

const getValidDraftSlots = (state, player) => {
  const { main, reserve } = getPlayerBoards(state, player);
  const valid = [];
  const mainCount = main.filter(tile => tile && tile.hero && !tile._dead).length;
  const reserveCount = reserve.filter(tile => tile && tile.hero && !tile._dead).length;

  if (mainCount < 5) {
    main.forEach((tile, index) => {
      if (!tile?.hero) valid.push({ index, type: 'main' });
    });
  }
  if (reserveCount < 2) {
    reserve.forEach((tile, index) => {
      if (!tile?.hero) valid.push({ index, type: 'reserve' });
    });
  }
  return valid;
};

const applyDraftPick = (state, player, hero, slot) => {
  if (!hero || !slot) return cloneDraftState(state);
  const nextState = cloneDraftState(state);
  const boards = getPlayerBoards(nextState, player);
  const nextMain = cloneBoard(boards.main);
  const nextReserve = cloneBoard(boards.reserve);
  if (slot.type === 'main') nextMain[slot.index] = createDraftTile(hero, nextMain[slot.index] || {});
  else nextReserve[slot.index] = createDraftTile(hero, nextReserve[slot.index] || {});

  if (player === 'player2') {
    nextState.p2Main = nextMain;
    nextState.p2Reserve = nextReserve;
  } else {
    nextState.p1Main = nextMain;
    nextState.p1Reserve = nextReserve;
  }
  return nextState;
};

const removeHeroFromPool = (heroes, hero) => (heroes || []).filter(entry => entry && entry.id !== hero?.id);

const getTargetCoverage = (targets = []) => {
  let coverage = 1;
  (targets || []).forEach((target) => {
    if (!target) return;
    const maxTargets = typeof target.max === 'number' && target.max > 0 ? target.max : 1;
    switch (target.type) {
      case 'board':
      case 'all':
        coverage = Math.max(coverage, 3);
        break;
      case 'frontTwoRows':
        coverage = Math.max(coverage, 2.5);
        break;
      case 'frontRow':
      case 'middleRow':
      case 'backRow':
      case 'frontmostRowWithHero':
      case 'backmostRowWithHero':
      case 'rowContainingHighestArmor':
      case 'rowContainingLowestArmor':
      case 'rowWithHighestSumArmor':
      case 'rowWithMostHeroes':
      case 'cornerTiles':
        coverage = Math.max(coverage, 1.8);
        break;
      case 'column':
      case 'projectilePlus1':
      case 'adjacent':
      case 'nearestToLastTarget':
      case 'adjacentToSelf':
        coverage = Math.max(coverage, 1.6);
        break;
      case 'self':
        coverage = Math.max(coverage, 0.6);
        break;
      default:
        coverage = Math.max(coverage, Math.min(1.3, maxTargets));
        break;
    }
  });
  return coverage;
};

const getEffectTurns = (duration) => {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(1, Math.min(DRAFT_EFFECT_HORIZON, Number(duration)));
  }
  return DRAFT_EFFECT_HORIZON;
};

const estimateEffectValue = (effect) => {
  const resolved = typeof effect === 'string' ? getEffectByName(effect) : effect;
  if (!resolved) return 0;
  const override = EFFECT_EVALUATION_OVERRIDES[resolved.name];
  if (typeof override === 'number' && Number.isFinite(override)) {
    return override;
  }

  const turns = getEffectTurns(resolved.duration);
  let score = 0;

  if (resolved.pulse?.type === 'damage') {
    if (resolved.pulse.derivedFrom === 'roundNumber') {
      score += (turns * (turns + 1)) / 2;
    } else if (resolved.pulse.derivedFrom === 'armor') {
      score += 4 * turns;
    } else {
      score += Number(resolved.pulse.value || 0) * turns;
    }
  }
  if (resolved.pulse?.type === 'heal') {
    score += Number(resolved.pulse.value || 0) * turns * 0.85;
  }
  if (resolved.modifiers && typeof resolved.modifiers === 'object') {
    const modifierMagnitude = Object.values(resolved.modifiers)
      .reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0);
    score += modifierMagnitude * turns * (resolved.kind === 'debuff' ? 1.15 : 0.8);
  }
  if (resolved.onTargeted?.value) score += Math.abs(Number(resolved.onTargeted.value || 0)) * 1.15;
  if (resolved.onDamaged?.value) score += Math.abs(Number(resolved.onDamaged.value || 0)) * 1.15;
  if (resolved.onDeath?.value) score += Math.abs(Number(resolved.onDeath.value || 0)) * 0.75;
  if (resolved.healApplierOnPulse?.amount) score += Number(resolved.healApplierOnPulse.amount || 0) * turns * 0.65;
  if (resolved.spreadEffectToAdjacentOnPulse?.effect) score += turns * 1.6;
  if (resolved.preventSingleTarget) score += 5;
  if (resolved.taunt) score += 4;
  if (resolved.blocksProjectileAndColumn) score += 4;
  if (resolved.redirectSingleTargetToEffectApplier) score += 4;
  if (resolved.forceMultiTargetToSelf) score += 4;
  if (resolved.forceSingleTargetLowestArmor) score += 2.5;

  if (score === 0) {
    if (resolved.kind === 'debuff') score = 1.5;
    else if (resolved.kind === 'buff') score = 1;
  }

  return Math.max(0, score);
};

const getProfileFormulaValue = (formula = {}) => {
  if (!formula) return 0;
  let value = Number(formula.value || formula.base || 0);
  if (formula.type === 'roll') {
    value = Number(formula.base || 0) + ((Number(formula.die || 6) + 1) / 2);
  }
  if (formula.divideByTargetSpeed) {
    const quotient = value / EXPECTED_TARGET_SPEED;
    value = formula.roundUp ? Math.ceil(quotient) : Math.floor(quotient);
  }
  return Math.max(0, value);
};

const buildHeroProfile = (hero) => {
  const profile = {
    damage: 0,
    support: 0,
    control: 0,
    aoe: 0,
    durability: Number(hero?.health || 0) + Number(hero?.armor || 0) * 2,
    effectPressure: 0,
    buffValue: 0,
    maxDebuffValue: 0,
    maxBuffValue: 0,
    cleanseCoverage: 0,
    cleanseHealBonus: 0,
    buffStripCoverage: 0,
    producerTags: new Set(),
    consumerTags: new Set(),
  };

  Object.values(hero?.spells || {}).forEach((spellData) => {
    const spellId = spellData?.spell || spellData?.id;
    const spell = spellId ? getSpellById(spellId) : null;
    const spec = spell?.spec;
    if (!spec) return;

    const formula = spec.formula || {};
    const targets = spec.targets || [];
    const post = spec.post || {};
    const effects = spec.effects || [];
    const targetTypes = new Set(targets.map(target => target.type));
    const baseValue = getProfileFormulaValue(formula);
    const targetCoverage = getTargetCoverage(targets);

    if (formula.type === 'attackPower' || formula.type === 'damage' || formula.type === 'roll') {
      profile.damage += Math.max(1, baseValue);
    }
    if (formula.type === 'heal' || formula.type === 'healPower') {
      profile.support += Math.max(2, baseValue);
    }
    if (targetTypes.has('board') || targetTypes.has('all') || targetTypes.has('frontRow') || targetTypes.has('frontTwoRows') || targetTypes.has('column')) {
      profile.aoe += 1;
    }
    if (post.moveAllBack || post.moveRowBack || post.knockBack) {
      profile.control += 3;
    }
    if (post.removeTopDebuff || post.removeDebuffs || post.healIfRemoved) {
      profile.support += 4;
      profile.consumerTags.add('ally-debuff');
      profile.cleanseCoverage += post.removeDebuffs ? Math.max(1.5, targetCoverage) : Math.max(1, targetCoverage);
      profile.cleanseHealBonus += Number(post.healIfRemoved?.amount || 0) * Math.max(1, targetCoverage);
    }
    if (post.onlyApplyIfHasDebuff) {
      profile.consumerTags.add('enemy-debuff');
    }
    if (post.onlyApplyToWithEffect) {
      profile.consumerTags.add(post.onlyApplyToWithEffect);
    }
    if (post.removeTopPositiveEffect) {
      profile.consumerTags.add('enemy-buff');
      profile.control += 2;
      profile.buffStripCoverage += Math.max(1, targetCoverage);
    }
    if (post.removeTopEffectByName?.name) {
      profile.consumerTags.add(post.removeTopEffectByName.name);
      profile.control += 2;
    }
    if (post.removeCorpse) {
      profile.consumerTags.add('corpse');
      profile.control += 2;
    }
    if (post.deltaEnergy) {
      profile.support += Math.abs(typeof post.deltaEnergy === 'number' ? post.deltaEnergy : Number(post.deltaEnergy?.amount || 0));
    }
    if (typeof formula.addTargetEffectNameCount === 'string') {
      profile.consumerTags.add(formula.addTargetEffectNameCount);
    }
    if (typeof formula.addTargetEffectsMultiplier === 'number') {
      profile.consumerTags.add('enemy-buff');
    }

    effects.forEach((effect) => {
      const resolved = typeof effect === 'string' ? getEffectByName(effect) : effect;
      if (!resolved?.name) return;
      const effectUnitValue = estimateEffectValue(resolved);
      profile.producerTags.add(resolved.name);
      if (resolved.kind === 'debuff') {
        profile.producerTags.add('enemy-debuff');
        profile.control += 1;
        profile.effectPressure += effectUnitValue * targetCoverage;
        profile.maxDebuffValue = Math.max(profile.maxDebuffValue, effectUnitValue);
      }
      if (resolved.kind === 'buff') {
        profile.producerTags.add('ally-buff');
        profile.support += 1;
        profile.buffValue += effectUnitValue * targetCoverage;
        profile.maxBuffValue = Math.max(profile.maxBuffValue, effectUnitValue);
      }
    });

    if (post.applyEffectWithChance?.effect) {
      const chanceEffect = getEffectByName(post.applyEffectWithChance.effect);
      const chance = Number(post.applyEffectWithChance.chance ?? 1);
      if (chanceEffect) {
        const chanceValue = estimateEffectValue(chanceEffect) * chance;
        if (chanceEffect.kind === 'debuff') {
          profile.producerTags.add(chanceEffect.name);
          profile.producerTags.add('enemy-debuff');
          profile.effectPressure += chanceValue * targetCoverage;
          profile.maxDebuffValue = Math.max(profile.maxDebuffValue, chanceValue);
        }
        if (chanceEffect.kind === 'buff') {
          profile.producerTags.add(chanceEffect.name);
          profile.producerTags.add('ally-buff');
          profile.buffValue += chanceValue * targetCoverage;
          profile.maxBuffValue = Math.max(profile.maxBuffValue, chanceValue);
        }
      }
    }
  });

  return profile;
};

const profileCache = new Map();
const getHeroProfile = (hero) => {
  const cacheKey = hero?.id || hero?.name || Math.random().toString(36);
  if (!profileCache.has(cacheKey)) {
    profileCache.set(cacheKey, buildHeroProfile(hero));
  }
  return profileCache.get(cacheKey);
};

const getRosterProfiles = (tiles = []) => tiles
  .filter(isAliveTile)
  .map(tile => ({ hero: tile.hero, profile: getHeroProfile(tile.hero) }));

const countMatchingTags = (profiles, tag) => profiles.reduce((sum, entry) => sum + (entry.profile.producerTags.has(tag) ? 1 : 0), 0);

const evaluateCompositionScore = (allyTiles, enemyTiles) => {
  const allyProfiles = getRosterProfiles(allyTiles);
  const enemyProfiles = getRosterProfiles(enemyTiles);
  const supportCount = allyProfiles.filter(entry => entry.profile.support >= 4).length;
  const frontlineCount = allyProfiles.filter(entry => entry.profile.durability >= 12).length;
  let score = 0;

  if (supportCount === 0) score -= 5;
  else if (supportCount === 1) score += 4;
  else if (supportCount === 2) score += 2;
  else score -= 2;

  if (frontlineCount === 0) score -= 5;
  else if (frontlineCount === 1) score += 3;
  else if (frontlineCount === 2) score += 2;

  allyProfiles.forEach((entry) => {
    entry.profile.consumerTags.forEach((tag) => {
      if (tag === 'ally-debuff') return;
      const allyMatches = countMatchingTags(allyProfiles, tag);
      const enemyMatches = countMatchingTags(enemyProfiles, tag);
      if (allyMatches > 0) score += 2.5;
      else if (enemyMatches > 0 && (tag === 'enemy-buff' || tag === 'enemy-debuff')) score += 1.5;
      else score -= 1;
    });
  });

  const totalControl = allyProfiles.reduce((sum, entry) => sum + entry.profile.control, 0);
  const totalAoe = allyProfiles.reduce((sum, entry) => sum + entry.profile.aoe, 0);
  score += Math.min(4, totalControl * 0.5) + Math.min(3, totalAoe * 0.5);

  return score;
};

const evaluateEffectMatchup = (allyTiles, enemyTiles) => {
  const allyProfiles = getRosterProfiles(allyTiles).map(entry => entry.profile);
  const enemyProfiles = getRosterProfiles(enemyTiles).map(entry => entry.profile);
  if (!allyProfiles.length && !enemyProfiles.length) return 0;

  const allyEffectPressure = allyProfiles.reduce((sum, profile) => sum + profile.effectPressure, 0);
  const enemyEffectPressure = enemyProfiles.reduce((sum, profile) => sum + profile.effectPressure, 0);
  const allyBuffValue = allyProfiles.reduce((sum, profile) => sum + profile.buffValue, 0);
  const enemyBuffValue = enemyProfiles.reduce((sum, profile) => sum + profile.buffValue, 0);

  const enemyMaxDebuffValue = enemyProfiles.reduce((max, profile) => Math.max(max, profile.maxDebuffValue || 0), 0);
  const allyMaxDebuffValue = allyProfiles.reduce((max, profile) => Math.max(max, profile.maxDebuffValue || 0), 0);
  const enemyMaxBuffValue = enemyProfiles.reduce((max, profile) => Math.max(max, profile.maxBuffValue || 0), 0);
  const allyMaxBuffValue = allyProfiles.reduce((max, profile) => Math.max(max, profile.maxBuffValue || 0), 0);

  const allyCleanseValue = allyProfiles.reduce((sum, profile) => sum + (profile.cleanseCoverage * enemyMaxDebuffValue) + profile.cleanseHealBonus, 0);
  const enemyCleanseValue = enemyProfiles.reduce((sum, profile) => sum + (profile.cleanseCoverage * allyMaxDebuffValue) + profile.cleanseHealBonus, 0);
  const allyBuffStripValue = allyProfiles.reduce((sum, profile) => sum + (profile.buffStripCoverage * enemyMaxBuffValue), 0);
  const enemyBuffStripValue = enemyProfiles.reduce((sum, profile) => sum + (profile.buffStripCoverage * allyMaxBuffValue), 0);

  let score = 0;
  score += Math.min(allyCleanseValue, enemyEffectPressure) * 0.55;
  score -= Math.min(enemyCleanseValue, allyEffectPressure) * 0.2;
  score += Math.max(0, allyEffectPressure - enemyCleanseValue * 0.7) * 0.35;
  score -= Math.max(0, enemyEffectPressure - allyCleanseValue * 0.7) * 0.45;
  score += Math.min(allyBuffStripValue, enemyBuffValue) * 0.45;
  score -= Math.min(enemyBuffStripValue, allyBuffValue) * 0.12;
  score += Math.min(allyBuffStripValue, enemyBuffValue) * 0.45;
  score -= Math.min(enemyBuffStripValue, allyBuffValue) * 0.3;

  if (enemyEffectPressure > 0 && allyCleanseValue === 0) score -= enemyEffectPressure * 0.1;
  if (allyEffectPressure > 0 && enemyCleanseValue === 0) score += allyEffectPressure * 0.08;

  return score;
};

const evaluateDraftStateScore = (state, player) => {
  const opponent = getOpponent(player);
  const allyBoards = getPlayerBoards(state, player);
  const enemyBoards = getPlayerBoards(state, opponent);
  const allyTiles = [...allyBoards.main, ...allyBoards.reserve];
  const enemyTiles = [...enemyBoards.main, ...enemyBoards.reserve];
  const boardScore = evaluateBoardAdvantage(state.p2Main, state.p2Reserve, state.p1Main, state.p1Reserve);
  const perspectiveBoardScore = player === 'player2' ? boardScore : -boardScore;
  const effectScore = evaluateEffectMatchup(allyTiles, enemyTiles);
  return perspectiveBoardScore * 0.2 + effectScore;
};

const buildDraftRoundState = (state) => ({
  p1Board: cloneBoard(state.p1Main || []),
  p1Reserve: cloneBoard(state.p1Reserve || []),
  p2Board: cloneBoard(state.p2Main || []),
  p2Reserve: cloneBoard(state.p2Reserve || []),
  roundNumber: 1,
  priorityPlayer: 'player1',
  lastCastActionBySide: null,
  gameMode: 'classic',
});

const evaluateResolvedDraftState = (resultState, player) => {
  const boardScore = evaluateBoardAdvantage(
    resultState.p2Board || resultState.p2Main || [],
    resultState.p2Reserve || [],
    resultState.p1Board || resultState.p1Main || [],
    resultState.p1Reserve || [],
  );
  const perspectiveBoardScore = player === 'player2' ? boardScore : -boardScore;
  const allyTiles = player === 'player2'
    ? [...(resultState.p2Board || []), ...(resultState.p2Reserve || [])]
    : [...(resultState.p1Board || []), ...(resultState.p1Reserve || [])];
  const enemyTiles = player === 'player2'
    ? [...(resultState.p1Board || []), ...(resultState.p1Reserve || [])]
    : [...(resultState.p2Board || []), ...(resultState.p2Reserve || [])];
  return perspectiveBoardScore * 0.2 + evaluateEffectMatchup(allyTiles, enemyTiles);
};

const simulateDraftRoundScore = async (state, player) => {
  let currentState = buildDraftRoundState(state);
  try {
    for (let roundIndex = 0; roundIndex < DRAFT_SIMULATION_ROUNDS; roundIndex += 1) {
      const result = await executeRound(currentState, {
        castDelayMs: 0,
        postEffectDelayMs: 0,
        reactionDelayMs: 0,
        postCastDelayMs: 0,
        speedMultiplier: 1,
        onStep: null,
        quiet: true,
      });

      currentState = {
        p1Board: cloneBoard(result.p1Board || currentState.p1Board || []),
        p1Reserve: cloneBoard(result.p1Reserve || currentState.p1Reserve || []),
        p2Board: cloneBoard(result.p2Board || currentState.p2Board || []),
        p2Reserve: cloneBoard(result.p2Reserve || currentState.p2Reserve || []),
        roundNumber: Number(currentState.roundNumber || 1) + 1,
        priorityPlayer: result.priorityPlayer || currentState.priorityPlayer || 'player1',
        lastCastActionBySide: result.lastCastActionBySide || currentState.lastCastActionBySide || null,
        gameMode: currentState.gameMode || 'classic',
      };
    }
    return evaluateResolvedDraftState(currentState, player);
  } catch (_) {
    return null;
  }
};

const scoreDraftStateWithSimulation = async (state, player) => {
  const staticScore = evaluateDraftStateScore(state, player);
  const simulatedScore = await simulateDraftRoundScore(state, player);
  return staticScore + ((simulatedScore ?? staticScore) * DRAFT_SIMULATION_WEIGHT);
};

const getBestFollowupScore = async (availableHeroes, state, player) => {
  if (!availableHeroes?.length) return null;
  const followupChoices = getPickChoicesForPlayer(availableHeroes, state, player)
    .slice(0, DRAFT_TOP_FOLLOWUP_CANDIDATES);
  if (!followupChoices.length) return null;

  let bestScore = -Infinity;
  for (const followup of followupChoices) {
    const followupState = applyDraftPick(state, player, followup.hero, { index: followup.slotIndex, type: followup.slotType });
    const followupScore = await scoreDraftStateWithSimulation(followupState, player);
    if (followupScore > bestScore) bestScore = followupScore;
  }

  return Number.isFinite(bestScore) ? bestScore : null;
};

const scorePickChoice = (hero, slot, state, player) => {
  const opponent = getOpponent(player);
  const allyBoards = getPlayerBoards(state, player);
  const enemyBoards = getPlayerBoards(state, opponent);
  const tileIndex = slot.type === 'main' ? slot.index : -1 - slot.index;
  const enemyBoardFull = [...enemyBoards.main, ...Array(Math.max(0, 9 - enemyBoards.main.length)).fill(null)];
  const allyBoardFull = [...allyBoards.main, ...Array(Math.max(0, 9 - allyBoards.main.length)).fill(null)];
  const easyScore = evaluateHeroPoints(
    hero,
    tileIndex,
    player === 'player2',
    enemyBoardFull,
    enemyBoards.reserve,
    allyBoardFull,
    allyBoards.reserve,
  );

  const projected = applyDraftPick(state, player, hero, slot);
  return easyScore + evaluateDraftStateScore(projected, player);
};

const getSlotChoicesForHero = (hero, state, player) => {
  const slots = getValidDraftSlots(state, player);
  if (!hero || !slots.length) return [];

  return slots.map((slot) => ({
    hero,
    slotIndex: slot.index,
    slotType: slot.type,
    score: scorePickChoice(hero, slot, state, player),
  })).sort((left, right) => right.score - left.score);
};

const getPickChoicesForPlayer = (availableHeroes, state, player) => {
  if (!getValidDraftSlots(state, player).length || !availableHeroes?.length) return [];

  const byHero = [];
  availableHeroes.forEach((hero) => {
    const [bestChoice] = getSlotChoicesForHero(hero, state, player);
    if (bestChoice) byHero.push(bestChoice);
  });

  byHero.sort((left, right) => right.score - left.score);
  return byHero;
};

const getBanChoicesForPlayer = (availableHeroes, state, player) => {
  if (!availableHeroes?.length || !state) return [];
  const opponent = getOpponent(player);

  return (availableHeroes || []).map((hero) => {
    const remainingPool = removeHeroFromPool(availableHeroes, hero);
    const opponentChoices = getPickChoicesForPlayer(remainingPool, state, opponent);
    const deniedPickScore = getPickChoicesForPlayer(availableHeroes, state, opponent)
      .find(choice => choice.hero?.id === hero?.id)?.score || 0;

    let opponentBestScore = evaluateDraftStateScore(state, opponent);
    if (opponentChoices.length) {
      opponentBestScore = opponentChoices[0].score;
    }

    const heroProfile = getHeroProfile(hero);
    const immediateThreat = heroProfile.damage
      + heroProfile.support * 1.1
      + heroProfile.control * 1.25
      + heroProfile.aoe * 2
      + heroProfile.durability * 0.5
      + heroProfile.effectPressure * 0.85
      + heroProfile.buffValue * 0.4
      + heroProfile.cleanseCoverage * 0.6
      + heroProfile.buffStripCoverage * 0.5;

    return {
      hero,
      score: deniedPickScore - opponentBestScore * 0.35 + immediateThreat * 0.4,
    };
  }).sort((left, right) => right.score - left.score);
};

const evaluateBoardAdvantage = (p2Main, p2Reserve, p1Main, p1Reserve) => {
  let p2Score = 0;
  let p1Score = 0;

  (p2Main || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p2Score += evaluateHeroPoints(tile.hero, index, true, p1Main, p1Reserve, p2Main, p2Reserve, tile);
    }
  });
  (p2Reserve || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p2Score += evaluateHeroPoints(tile.hero, -1 - index, true, p1Main, p1Reserve, p2Main, p2Reserve, tile);
    }
  });

  (p1Main || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p1Score += evaluateHeroPoints(tile.hero, index, false, p2Main, p2Reserve, p1Main, p1Reserve, tile);
    }
  });
  (p1Reserve || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p1Score += evaluateHeroPoints(tile.hero, -1 - index, false, p2Main, p2Reserve, p1Main, p1Reserve, tile);
    }
  });

  return p2Score - p1Score;
};

const getConditionalTagForSpell = (spell) => {
  const spec = spell?.spec;
  if (!spec) return null;
  const formula = spec.formula || {};
  const post = spec.post || {};
  if (typeof formula.addTargetEffectNameCount === 'string') return formula.addTargetEffectNameCount;
  if (post.onlyApplyToWithEffect) return post.onlyApplyToWithEffect;
  if (post.removeTopEffectByName?.name) return post.removeTopEffectByName.name;
  if (post.onlyApplyIfHasDebuff) return 'enemy-debuff';
  if (post.removeTopPositiveEffect) return 'enemy-buff';
  if (post.removeTopDebuff || post.removeDebuffs) return 'ally-debuff';
  if (post.removeCorpse) return 'corpse';
  return null;
};

const evaluateSetupAndCounterplay = (p2Main, p2Reserve, p1Main, p1Reserve) => {
  let score = 0;
  const allyRoster = [...(p2Main || []), ...(p2Reserve || [])].filter(isAliveTile);
  const enemyRoster = [...(p1Main || []), ...(p1Reserve || [])].filter(isAliveTile);
  const allyProducerTags = new Set();

  allyRoster.forEach((tile) => {
    const profile = getHeroProfile(tile.hero);
    profile.producerTags.forEach(tag => allyProducerTags.add(tag));
  });

  (p2Main || []).forEach((tile, index) => {
    if (!isAliveTile(tile)) return;
    const activeSpell = getActiveSpell(tile.hero, index, 'p2');
    const activeTag = getConditionalTagForSpell(activeSpell);
    if (activeTag && allyProducerTags.has(activeTag)) {
      score += 2;
    }
  });

  (p1Main || []).forEach((tile, index) => {
    if (!isAliveTile(tile)) return;
    const activeSpell = getActiveSpell(tile.hero, index, 'p1');
    const spec = activeSpell?.spec || {};
    const post = spec.post || {};
    if (post.onlyApplyIfHasDebuff || post.onlyApplyToWithEffect || post.removeTopPositiveEffect || post.removeTopEffectByName || post.removeCorpse) {
      score -= 1.25;
    }
  });

  return score;
};

const simulateP2Move = (p2Board, p2Reserve, move) => {
  const nextMain = cloneBoard(p2Board);
  const nextReserve = cloneBoard(p2Reserve);
  const source = parseToken(move.sourceId);
  const destination = parseToken(move.destinationId);
  if (!source || !destination) return { main: nextMain, reserve: nextReserve };
  const srcBoard = source.isReserve ? nextReserve : nextMain;
  const dstBoard = destination.isReserve ? nextReserve : nextMain;
  const srcTile = srcBoard[source.idx];
  const dstTile = dstBoard[destination.idx];
  srcBoard[source.idx] = dstTile;
  dstBoard[destination.idx] = srcTile;
  return { main: nextMain, reserve: nextReserve };
};

const remapDecisionToPlayer = (decision, player) => {
  if (!decision || player !== 'player1') return decision;
  const remapToken = (token) => {
    if (typeof token !== 'string') return token;
    if (token.startsWith('p2Reserve:')) return token.replace('p2Reserve:', 'p1Reserve:');
    if (token.startsWith('p2:')) return token.replace('p2:', 'p1:');
    return token;
  };

  return {
    sourceId: remapToken(decision.sourceId),
    destinationId: remapToken(decision.destinationId),
  };
};

const getNoopDecisionForPlayer = (state, player) => {
  const main = player === 'player1' ? state.p1Main : state.p2Main;
  const reserve = player === 'player1' ? state.p1Reserve : state.p2Reserve;
  const mainPrefix = player === 'player1' ? 'p1' : 'p2';
  const reservePrefix = player === 'player1' ? 'p1Reserve' : 'p2Reserve';

  const mainIndex = (main || []).findIndex(isAliveTile);
  if (mainIndex !== -1) {
    return { sourceId: `${mainPrefix}:${mainIndex}`, destinationId: `${mainPrefix}:${mainIndex}` };
  }

  const reserveIndex = (reserve || []).findIndex(isAliveTile);
  if (reserveIndex !== -1) {
    return { sourceId: `${reservePrefix}:${reserveIndex}`, destinationId: `${reservePrefix}:${reserveIndex}` };
  }

  return { sourceId: `${mainPrefix}:0`, destinationId: `${mainPrefix}:0` };
};

const parseMovementToken = (token) => {
  if (typeof token !== 'string') return null;
  if (token.startsWith('p1Reserve:')) return { side: 'p1', reserve: true, index: Number.parseInt(token.slice('p1Reserve:'.length), 10) };
  if (token.startsWith('p2Reserve:')) return { side: 'p2', reserve: true, index: Number.parseInt(token.slice('p2Reserve:'.length), 10) };
  if (token.startsWith('p1:')) return { side: 'p1', reserve: false, index: Number.parseInt(token.slice('p1:'.length), 10) };
  if (token.startsWith('p2:')) return { side: 'p2', reserve: false, index: Number.parseInt(token.slice('p2:'.length), 10) };
  return null;
};

const getMovementBoardRef = (state, parsedToken) => {
  if (!parsedToken) return null;
  if (parsedToken.side === 'p1') return parsedToken.reserve ? state.p1Reserve : state.p1Main;
  if (parsedToken.side === 'p2') return parsedToken.reserve ? state.p2Reserve : state.p2Main;
  return null;
};

const applyMovementDecisionToState = (state, player, decision) => {
  const moverSide = player === 'player1' ? 'p1' : 'p2';
  const fallback = getNoopDecisionForPlayer(state, player);
  const resolvedDecision = decision?.sourceId && decision?.destinationId ? decision : fallback;
  const source = parseMovementToken(resolvedDecision.sourceId);
  const destination = parseMovementToken(resolvedDecision.destinationId);

  if (!source || !destination || source.side !== moverSide || destination.side !== moverSide) return state;

  const sourceBoard = getMovementBoardRef(state, source);
  const destinationBoard = getMovementBoardRef(state, destination);
  if (!sourceBoard || !destinationBoard) return state;
  if (!sourceBoard[source.index] || !destinationBoard[destination.index]) return state;

  const sourceTile = sourceBoard[source.index];
  const destinationTile = destinationBoard[destination.index];
  if (!isAliveTile(sourceTile)) return state;
  if (destination.reserve && sourceTile.hero?.isBoss) return state;

  if (source.reserve && !destination.reserve) {
    const mainBoard = moverSide === 'p1' ? state.p1Main : state.p2Main;
    const mainAliveCount = (mainBoard || []).filter(countsTowardMainLimit).length;
    const destinationHasLivingHero = countsTowardMainLimit(destinationTile);
    if (!destinationHasLivingHero && mainAliveCount >= 5) return state;
  }

  const nextState = {
    ...state,
    p1Main: cloneBoard(state.p1Main || []),
    p1Reserve: cloneBoard(state.p1Reserve || []),
    p2Main: cloneBoard(state.p2Main || []),
    p2Reserve: cloneBoard(state.p2Reserve || []),
  };
  const nextSourceBoard = getMovementBoardRef(nextState, source);
  const nextDestinationBoard = getMovementBoardRef(nextState, destination);

  const swapped = nextSourceBoard[source.index];
  nextSourceBoard[source.index] = nextDestinationBoard[destination.index];
  nextDestinationBoard[destination.index] = swapped;

  return nextState;
};

const isLegalMoveForPlayer = (state, player, sourceId, destinationId) => {
  const moverSide = player === 'player1' ? 'p1' : 'p2';
  const source = parseMovementToken(sourceId);
  const destination = parseMovementToken(destinationId);
  if (!source || !destination || source.side !== moverSide || destination.side !== moverSide) return false;

  const sourceBoard = getMovementBoardRef(state, source);
  const destinationBoard = getMovementBoardRef(state, destination);
  if (!sourceBoard || !destinationBoard) return false;
  if (!sourceBoard[source.index] || !destinationBoard[destination.index]) return false;

  const sourceTile = sourceBoard[source.index];
  const destinationTile = destinationBoard[destination.index];
  if (!isAliveTile(sourceTile)) return false;
  if (hasPreventMovement(sourceTile) || hasPreventMovement(destinationTile)) return false;
  if (destination.reserve && sourceTile.hero?.isBoss) return false;

  if (source.reserve && !destination.reserve) {
    const mainBoard = player === 'player1' ? state.p1Main : state.p2Main;
    const mainAliveCount = (mainBoard || []).filter(countsTowardMainLimit).length;
    const destinationHasLivingHero = countsTowardMainLimit(destinationTile);
    if (!destinationHasLivingHero && mainAliveCount >= 5) return false;
  }

  if (!source.reserve && destination.reserve && !isAliveTile(destinationTile)) return false;

  return true;
};

const listLegalMovesForPlayer = (state, player) => {
  const main = player === 'player1' ? state.p1Main : state.p2Main;
  const reserve = player === 'player1' ? state.p1Reserve : state.p2Reserve;
  const mainPrefix = player === 'player1' ? 'p1' : 'p2';
  const reservePrefix = player === 'player1' ? 'p1Reserve' : 'p2Reserve';
  const sources = [];

  (main || []).forEach((tile, index) => {
    if (isAliveTile(tile) && !hasPreventMovement(tile)) sources.push(`${mainPrefix}:${index}`);
  });
  (reserve || []).forEach((tile, index) => {
    if (isAliveTile(tile) && !hasPreventMovement(tile)) sources.push(`${reservePrefix}:${index}`);
  });

  const destinations = [
    ...(main || []).map((_, index) => `${mainPrefix}:${index}`),
    ...(reserve || []).map((_, index) => `${reservePrefix}:${index}`),
  ];

  const moves = [];
  sources.forEach((sourceId) => {
    destinations.forEach((destinationId) => {
      if (!isLegalMoveForPlayer(state, player, sourceId, destinationId)) return;
      moves.push({ sourceId, destinationId });
    });
  });

  if (!moves.length) moves.push(getNoopDecisionForPlayer(state, player));
  return moves;
};

const getEasyMovementDecisionForPlayer = (state, player) => {
  const movement = { movementPhase: { sequence: ['p2'], index: 0 } };
  if (player === 'player1') {
    const decision = makeEasyMovementDecision(state.p1Main, state.p1Reserve, movement, state.p2Main, state.p2Reserve);
    return remapDecisionToPlayer(decision, player);
  }
  return makeEasyMovementDecision(state.p2Main, state.p2Reserve, movement, state.p1Main, state.p1Reserve);
};

const buildTargetResolutionBoards = (movementState) => ({
  p1Board: movementState.p1Main || [],
  p1Reserve: movementState.p1Reserve || [],
  p2Board: movementState.p2Main || [],
  p2Reserve: movementState.p2Reserve || [],
});

const getProjectileFragilityThreats = (movementState) => {
  const boards = buildTargetResolutionBoards(movementState);
  const threats = [];

  (movementState.p2Main || []).forEach((tile, index) => {
    if (!isAliveTile(tile)) return;
    const spell = getActiveSpell(tile.hero, index, 'p2');
    const spec = spell?.spec;
    if (!spec?.targets?.length) return;

    const hasProjectileAnchor = spec.targets.some((target) => target && (target.type === 'projectile' || target.type === 'projectilePlus1'));
    if (!hasProjectileAnchor) return;

    const targets = resolveTargets(spec.targets, { boardName: 'p2', index, tile }, boards, null, {});
    if (targets.length < 2) return;

    const formulaValue = Math.max(1, getProfileFormulaValue(spec.formula || {}));
    const effectValue = (spec.effects || []).reduce((sum, effect) => sum + Math.min(3, estimateEffectValue(effect)), 0);
    threats.push({
      index,
      spell,
      currentTargets: targets.length,
      perTargetValue: Math.max(3, formulaValue + (effectValue * 0.5)),
    });
  });

  return threats;
};

const getProjectileFragilityPenalty = (threats, respondedState) => {
  if (!threats.length) return 0;
  const boards = buildTargetResolutionBoards(respondedState);
  let penalty = 0;

  threats.forEach((threat) => {
    const tile = (respondedState.p2Main || [])[threat.index];
    if (!isAliveTile(tile)) return;
    const targets = resolveTargets(threat.spell.spec.targets, { boardName: 'p2', index: threat.index, tile }, boards, null, {});
    const targetLoss = Math.max(0, threat.currentTargets - targets.length);
    if (targetLoss <= 0) return;
    penalty += targetLoss * threat.perTargetValue;
    if (threat.currentTargets >= 3 && targets.length === 0) {
      penalty += threat.perTargetValue * 1.5;
    }
  });

  return penalty;
};

const simulateBattleScoreFromMovementState = async (movementState) => {
  const state = {
    p1Board: cloneBoard(movementState.p1Main || []),
    p1Reserve: cloneBoard(movementState.p1Reserve || []),
    p2Board: cloneBoard(movementState.p2Main || []),
    p2Reserve: cloneBoard(movementState.p2Reserve || []),
    roundNumber: 1,
    priorityPlayer: 'player1',
    lastCastActionBySide: null,
    gameMode: 'classic',
  };

  try {
    const result = await executeRound(state, {
      castDelayMs: 0,
      postEffectDelayMs: 0,
      reactionDelayMs: 0,
      postCastDelayMs: 0,
      speedMultiplier: 1,
      onStep: null,
      quiet: true,
    });

    return evaluateBoardAdvantage(
      result.p2Board || state.p2Board,
      result.p2Reserve || state.p2Reserve,
      result.p1Board || state.p1Board,
      result.p1Reserve || state.p1Reserve,
    );
  } catch (_) {
    return evaluateBoardAdvantage(state.p2Board, state.p2Reserve, state.p1Board, state.p1Reserve);
  }
};

const isLegalMove = (sourceId, destinationId, p2Board, p2ReserveBoard) => {
  const source = parseToken(sourceId);
  const destination = parseToken(destinationId);
  if (!source || !destination) return false;

  const srcBoard = source.isReserve ? (p2ReserveBoard || []) : (p2Board || []);
  const dstBoard = destination.isReserve ? (p2ReserveBoard || []) : (p2Board || []);
  const srcTile = srcBoard[source.idx];
  const dstTile = dstBoard[destination.idx];

  if (!isAliveTile(srcTile)) return false;
  if (hasPreventMovement(srcTile) || hasPreventMovement(dstTile)) return false;
  if (destination.isReserve) {
    if (destination.idx < 0 || destination.idx >= (p2ReserveBoard || []).length) return false;
  } else if (destination.idx < 0 || destination.idx >= (p2Board || []).length) {
    return false;
  }

  if (source.isReserve && !destination.isReserve) {
    const mainAlive = (p2Board || []).filter(countsTowardMainLimit).length;
    const destinationHasHero = countsTowardMainLimit(dstTile);
    if (!destinationHasHero && mainAlive >= 5) return false;
  }

  if (!source.isReserve && destination.isReserve) {
    const destinationHasLivingHero = isAliveTile(dstTile);
    if (!destinationHasLivingHero) return false;
  }

  return true;
};

const buildMovementCandidates = (p2Board, p2ReserveBoard, p1Board, p1ReserveBoard) => {
  const moves = [];
  const baseBoardScore = evaluateBoardAdvantage(p2Board, p2ReserveBoard, p1Board, p1ReserveBoard);

  const movable = [];
  (p2Board || []).forEach((tile, index) => {
    if (isAliveTile(tile) && !hasPreventMovement(tile)) movable.push({ sourceId: `p2:${index}` });
  });
  (p2ReserveBoard || []).forEach((tile, index) => {
    if (isAliveTile(tile) && !hasPreventMovement(tile)) movable.push({ sourceId: `p2Reserve:${index}` });
  });

  const allDestinations = [
    ...(p2Board || []).map((_, index) => `p2:${index}`),
    ...(p2ReserveBoard || []).map((_, index) => `p2Reserve:${index}`),
  ];

  movable.forEach(({ sourceId }) => {
    allDestinations.forEach((destinationId) => {
      if (sourceId === destinationId) return;
      if (!isLegalMove(sourceId, destinationId, p2Board, p2ReserveBoard)) return;
      const simulated = simulateP2Move(p2Board, p2ReserveBoard, { sourceId, destinationId });
      const boardScore = evaluateBoardAdvantage(simulated.main, simulated.reserve, p1Board, p1ReserveBoard);
      const setupScore = evaluateSetupAndCounterplay(simulated.main, simulated.reserve, p1Board, p1ReserveBoard);
      const compositionScore = evaluateCompositionScore([...simulated.main, ...simulated.reserve], [...(p1Board || []), ...(p1ReserveBoard || [])]);
      const score = boardScore + setupScore + compositionScore;
      moves.push({
        sourceId,
        destinationId,
        score,
        boardScore,
        setupScore,
        compositionScore,
        delta: score - baseBoardScore,
      });
    });
  });

  const noopMove = getNoopMove(p2Board, p2ReserveBoard);
  moves.push({
    sourceId: noopMove.sourceId,
    destinationId: noopMove.destinationId,
    score: baseBoardScore,
    boardScore: baseBoardScore,
    setupScore: evaluateSetupAndCounterplay(p2Board, p2ReserveBoard, p1Board, p1ReserveBoard),
    compositionScore: evaluateCompositionScore([...(p2Board || []), ...(p2ReserveBoard || [])], [...(p1Board || []), ...(p1ReserveBoard || [])]),
    delta: 0,
  });

  return moves.sort((left, right) => right.score - left.score);
};

const simulateCandidateRound = async (candidate, p2Board, p2ReserveBoard, p1Board, p1ReserveBoard, movement = null) => {
  const moved = simulateP2Move(p2Board, p2ReserveBoard, candidate);
  let movementState = {
    p1Main: cloneBoard(p1Board),
    p1Reserve: cloneBoard(p1ReserveBoard),
    p2Main: moved.main,
    p2Reserve: moved.reserve,
  };

  const phase = movement?.movementPhase;
  if (!phase?.sequence?.length || Number(phase.index || 0) >= phase.sequence.length - 1) {
    return simulateBattleScoreFromMovementState(movementState);
  }

  const finalIndex = phase.sequence.length - 1;
  for (let nextIndex = Number(phase.index || 0) + 1; nextIndex < finalIndex; nextIndex += 1) {
    const mover = phase.sequence[nextIndex];
    const player = mover === 'p1' ? 'player1' : mover === 'p2' ? 'player2' : null;
    if (!player) continue;
    const decision = getEasyMovementDecisionForPlayer(movementState, player);
    movementState = applyMovementDecisionToState(movementState, player, decision);
  }

  const finalMover = phase.sequence[finalIndex];
  const finalPlayer = finalMover === 'p1' ? 'player1' : finalMover === 'p2' ? 'player2' : null;
  if (!finalPlayer) return simulateBattleScoreFromMovementState(movementState);

  if (finalPlayer === 'player1') {
    const legalResponses = listLegalMovesForPlayer(movementState, finalPlayer);
    const fragilityThreats = getProjectileFragilityThreats(movementState);
    let worstScore = Infinity;
    for (const response of legalResponses) {
      const respondedState = applyMovementDecisionToState(movementState, finalPlayer, response);
      const score = await simulateBattleScoreFromMovementState(respondedState);
      const fragilityPenalty = getProjectileFragilityPenalty(fragilityThreats, respondedState);
      const adjustedScore = score - fragilityPenalty;
      if (adjustedScore < worstScore) worstScore = adjustedScore;
    }
    return Number.isFinite(worstScore) ? worstScore : candidate.score;
  }

  const finalDecision = getEasyMovementDecisionForPlayer(movementState, finalPlayer);
  const finalState = applyMovementDecisionToState(movementState, finalPlayer, finalDecision);
  return simulateBattleScoreFromMovementState(finalState);
};

const pickBestHeroChoice = (choices) => {
  if (!choices.length) return null;
  const bestScore = Math.max(...choices.map(choice => choice.score));
  const top = choices.filter(choice => choice.score === bestScore);
  return top[Math.floor(Math.random() * top.length)];
};

export const makeBanDecision = async (availableHeroes, boardState = null) => {
  if (!availableHeroes?.length) return null;
  const draftState = boardState ? cloneDraftState(boardState) : createEmptyDraftState();
  const banChoices = getBanChoicesForPlayer(availableHeroes, draftState, 'player2').slice(0, DRAFT_TOP_RESPONSE_CANDIDATES);
  if (banChoices.length) {
    let bestBan = null;
    let bestScore = -Infinity;

    for (const banChoice of banChoices) {
      const remainingPool = removeHeroFromPool(availableHeroes, banChoice.hero);
      const opponentChoices = getPickChoicesForPlayer(remainingPool, draftState, 'player1').slice(0, DRAFT_TOP_RESPONSE_CANDIDATES);
      let worstResponse = evaluateDraftStateScore(draftState, 'player2');

      if (opponentChoices.length) {
        worstResponse = Infinity;
        for (const response of opponentChoices) {
          const responseState = applyDraftPick(draftState, 'player1', response.hero, { index: response.slotIndex, type: response.slotType });
          const finalScore = await scoreDraftStateWithSimulation(responseState, 'player2');
          if (finalScore < worstResponse) worstResponse = finalScore;
        }
      }

      if (worstResponse > bestScore) {
        bestScore = worstResponse;
        bestBan = banChoice.hero;
      }
    }

    if (bestBan) return bestBan;
  }
  let best = null;
  let bestScore = -Infinity;

  availableHeroes.forEach((hero) => {
    const profile = getHeroProfile(hero);
    const easyBan = makeEasyBanDecision([hero]);
    const easyScore = easyBan ? (Number(hero.health || 0) + Number(hero.armor || 0) * 5) : 0;
    const profileScore = profile.damage + profile.support * 1.1 + profile.control * 1.25 + profile.aoe * 2 + profile.durability * 0.5 + profile.effectPressure * 0.85 + profile.buffValue * 0.4 + profile.cleanseCoverage * 0.6 + profile.buffStripCoverage * 0.5;
    const totalScore = easyScore + profileScore;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = hero;
    }
  });

  return best;
};

export const makePickDecision = async (availableHeroes, boardState) => {
  if (!availableHeroes?.length || !boardState) return null;

  const draftState = cloneDraftState(boardState);
  const useExtendedLookahead = shouldUseExtendedDraftLookahead(draftState);
  const myChoices = getPickChoicesForPlayer(availableHeroes, draftState, 'player2');
  if (!myChoices.length) return null;

  let best = null;
  let bestScore = -Infinity;

  const topChoices = myChoices.slice(0, DRAFT_TOP_PICK_CANDIDATES)
    .flatMap((choice) => getSlotChoicesForHero(choice.hero, draftState, 'player2').slice(0, DRAFT_TOP_SLOT_VARIANTS_PER_HERO));

  for (const choice of topChoices) {
    const pickedState = applyDraftPick(draftState, 'player2', choice.hero, { index: choice.slotIndex, type: choice.slotType });
    const remainingPool = removeHeroFromPool(availableHeroes, choice.hero);
    const pickedStaticScore = evaluateDraftStateScore(pickedState, 'player2');
    const pickedSimulatedScore = await simulateDraftRoundScore(pickedState, 'player2');
    const opponentChoices = getPickChoicesForPlayer(remainingPool, pickedState, 'player1').slice(0, DRAFT_TOP_RESPONSE_CANDIDATES);

    let worstResponseScore = pickedStaticScore + ((pickedSimulatedScore ?? pickedStaticScore) * DRAFT_SIMULATION_WEIGHT);
    if (opponentChoices.length) {
      worstResponseScore = Infinity;
      for (const response of opponentChoices) {
        const responseState = applyDraftPick(pickedState, 'player1', response.hero, { index: response.slotIndex, type: response.slotType });
        let finalScore = await scoreDraftStateWithSimulation(responseState, 'player2');
        if (useExtendedLookahead) {
          const followupPool = removeHeroFromPool(remainingPool, response.hero);
          const followupScore = await getBestFollowupScore(followupPool, responseState, 'player2');
          if (followupScore !== null) {
            finalScore = (finalScore * 0.35) + (followupScore * 0.65);
          }
        }
        if (finalScore < worstResponseScore) worstResponseScore = finalScore;
      }
    }

    const totalScore = worstResponseScore + pickedStaticScore * 0.15 + choice.score * 0.05;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = choice;
    }
  }

  return best || pickBestHeroChoice(myChoices);
};

export const makeMovementDecision = async (p2Board, p2ReserveBoard, movement, p1Board = [], p1ReserveBoard = []) => {
  if (!movement?.movementPhase) return getNoopMove(p2Board, p2ReserveBoard);
  const phase = movement.movementPhase;
  if (phase.sequence?.[phase.index] !== 'p2') return getNoopMove(p2Board, p2ReserveBoard);
  const finalMover = phase.sequence?.[phase.sequence.length - 1] || null;
  const opponentHasLastMove = finalMover === 'p1' && Number(phase.index || 0) < Number(phase.sequence.length || 0) - 1;

  const candidates = buildMovementCandidates(p2Board, p2ReserveBoard, p1Board, p1ReserveBoard);
  if (!candidates.length) {
    return makeEasyMovementDecision(p2Board, p2ReserveBoard, movement, p1Board, p1ReserveBoard);
  }

  const topCandidates = candidates.slice(0, TOP_MOVEMENT_CANDIDATES);
  let best = null;
  let bestScore = -Infinity;

  for (const candidate of topCandidates) {
    const tacticalScore = await simulateCandidateRound(candidate, p2Board, p2ReserveBoard, p1Board, p1ReserveBoard, movement);
    const totalScore = tacticalScore + candidate.setupScore * 0.8 + candidate.compositionScore * 0.4;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = candidate;
    }
  }

  if (best && best.sourceId === best.destinationId) {
    return { sourceId: best.sourceId, destinationId: best.destinationId };
  }

  if (!best || best.delta <= 0) {
    if (opponentHasLastMove) {
      return getNoopMove(p2Board, p2ReserveBoard);
    }
    return makeEasyMovementDecision(p2Board, p2ReserveBoard, movement, p1Board, p1ReserveBoard);
  }

  return { sourceId: best.sourceId, destinationId: best.destinationId };
};

export const getThinkingDelay = () => {
  const span = MEDIUM_THINK_MAX_MS - MEDIUM_THINK_MIN_MS;
  return MEDIUM_THINK_MIN_MS + Math.floor(Math.random() * (span + 1));
};
