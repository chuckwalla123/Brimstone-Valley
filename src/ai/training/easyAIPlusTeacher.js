import { getSpellById } from '../../spells.js';
import { getEffectByName } from '../../effects.js';
import { indexToRow, columnIndicesForBoard } from '../../targeting.js';
import { deepClone } from '../../../shared/gameLogic.js';
import { evaluateHeroPointsWithOptions } from '../easyAI.js';
import { evaluateEffectValue } from '../effectValue.js';

export const EASY_AI_PLUS_EVALUATION_OPTIONS = Object.freeze({ advancedSpellEvaluation: true });

const countsTowardMainLimit = (tile) => !!(tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true);
const isAliveTile = (tile) => !!(tile && tile.hero && !tile._dead);
const getTileEffects = (tile) => Array.isArray(tile?.effects)
  ? tile.effects
  : (Array.isArray(tile?.hero?.effects) ? tile.hero.effects : []);

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

const estimateEffectValue = evaluateEffectValue;

const getProfileFormulaValue = (formula = {}) => {
  if (!formula) return 0;
  let value = Number(formula.value || formula.base || 0);
  if (formula.type === 'roll') {
    value = Number(formula.base || 0) + ((Number(formula.die || 6) + 1) / 2);
  }
  if (formula.divideByTargetSpeed) {
    const quotient = value / 3;
    value = formula.roundUp ? Math.ceil(quotient) : Math.floor(quotient);
  }
  return Math.max(0, value);
};

const buildHeroProfile = (hero, rowKey = 'all') => {
  const profile = {
    effectPressure: 0,
    buffValue: 0,
    maxDebuffValue: 0,
    maxBuffValue: 0,
    cleanseCoverage: 0,
    cleanseHealBonus: 0,
    buffStripCoverage: 0,
    producerTags: new Set(),
  };

  const spellEntries = rowKey === 'reserve'
    ? []
    : Object.entries(hero?.spells || {}).filter(([position]) => rowKey === 'all' || position === rowKey);

  spellEntries.forEach(([, spellData]) => {
    const spellId = spellData?.spell || spellData?.id;
    const spell = spellId ? getSpellById(spellId) : null;
    const spec = spell?.spec;
    if (!spec) return;

    const formula = spec.formula || {};
    const targets = spec.targets || [];
    const post = spec.post || {};
    const effects = spec.effects || [];
    const targetCoverage = getTargetCoverage(targets);

    if (post.removeTopDebuff || post.removeDebuffs || post.healIfRemoved) {
      profile.cleanseCoverage += post.removeDebuffs ? Math.max(1.5, targetCoverage) : Math.max(1, targetCoverage);
      profile.cleanseHealBonus += Number(post.healIfRemoved?.amount || 0) * Math.max(1, targetCoverage);
    }
    if (post.removeTopPositiveEffect) {
      profile.buffStripCoverage += Math.max(1, targetCoverage);
    }
    if (typeof formula.addTargetEffectsMultiplier === 'number') {
      profile.producerTags.add('enemy-buff');
    }

    effects.forEach((effect) => {
      const resolved = typeof effect === 'string' ? getEffectByName(effect) : effect;
      if (!resolved?.name) return;
      const effectUnitValue = estimateEffectValue(resolved);
      profile.producerTags.add(resolved.name);
      if (resolved.kind === 'debuff') {
        profile.producerTags.add('enemy-debuff');
        profile.effectPressure += effectUnitValue * targetCoverage;
        profile.maxDebuffValue = Math.max(profile.maxDebuffValue, effectUnitValue);
      }
      if (resolved.kind === 'buff') {
        profile.producerTags.add('ally-buff');
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

const getHeroProfile = (hero, rowKey = 'all') => {
  const cacheKey = `${hero?.id || hero?.name || 'unknown'}::${rowKey}`;
  if (!profileCache.has(cacheKey)) {
    profileCache.set(cacheKey, buildHeroProfile(hero, rowKey));
  }
  return profileCache.get(cacheKey);
};

const getTileProfile = (tile) => {
  if (!isAliveTile(tile)) return null;
  const boardName = String(tile.boardName || tile.hero?.boardName || 'p2Board');
  const side = boardName.startsWith('p2') ? 'p2' : 'p1';
  const isReserve = boardName.toLowerCase().includes('reserve') || tile.type === 'reserve';
  const rowKey = isReserve ? 'reserve' : getRowKey(Number(tile.index || 0), side);
  return getHeroProfile(tile.hero, rowKey);
};

const RESERVE_PROFILE_WEIGHT = 0.5;

const scaleProfile = (profile, weight) => ({
  ...profile,
  effectPressure: profile.effectPressure * weight,
  buffValue: profile.buffValue * weight,
  maxDebuffValue: profile.maxDebuffValue * weight,
  maxBuffValue: profile.maxBuffValue * weight,
  cleanseCoverage: profile.cleanseCoverage * weight,
  cleanseHealBonus: profile.cleanseHealBonus * weight,
  buffStripCoverage: profile.buffStripCoverage * weight,
});

// Main-board heroes contribute only the spell for their current row (by array position, since
// simulated moves do not rewrite tile.index); reserve heroes are discounted.
const getRosterProfiles = (tiles = [], mainCount = Infinity, side = 'p2') => tiles
  .map((tile, position) => ({ tile, position }))
  .filter(({ tile }) => isAliveTile(tile))
  .map(({ tile, position }) => ({
    hero: tile.hero,
    profile: position < mainCount
      ? getHeroProfile(tile.hero, getRowKey(position, side))
      : scaleProfile(getHeroProfile(tile.hero), RESERVE_PROFILE_WEIGHT),
  }));

const getActiveEffectStats = (tiles = [], kind) => {
  let total = 0;
  let max = 0;
  tiles.filter(isAliveTile).forEach((tile) => {
    getTileEffects(tile).forEach((effect) => {
      if (!effect || effect.kind !== kind) return;
      const value = estimateEffectValue(effect);
      total += value;
      max = Math.max(max, value);
    });
  });
  return { total, max };
};

export const evaluateEasyAIPlusBoardAdvantage = (p2Main, p2Reserve, p1Main, p1Reserve) => {
  let p2Score = 0;
  let p1Score = 0;

  (p2Main || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p2Score += evaluateHeroPointsWithOptions(
        tile.hero,
        index,
        true,
        p1Main,
        p1Reserve,
        p2Main,
        p2Reserve,
        tile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      );
    }
  });
  (p2Reserve || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p2Score += evaluateHeroPointsWithOptions(
        tile.hero,
        -1 - index,
        true,
        p1Main,
        p1Reserve,
        p2Main,
        p2Reserve,
        tile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      );
    }
  });

  (p1Main || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p1Score += evaluateHeroPointsWithOptions(
        tile.hero,
        index,
        false,
        p2Main,
        p2Reserve,
        p1Main,
        p1Reserve,
        tile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      );
    }
  });
  (p1Reserve || []).forEach((tile, index) => {
    if (isAliveTile(tile)) {
      p1Score += evaluateHeroPointsWithOptions(
        tile.hero,
        -1 - index,
        false,
        p2Main,
        p2Reserve,
        p1Main,
        p1Reserve,
        tile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      );
    }
  });

  return p2Score - p1Score;
};

export const evaluateEasyAIPlusEffectMatchup = (allyTiles, enemyTiles, layout = {}) => {
  const allyProfiles = getRosterProfiles(allyTiles, layout.allyMainCount, layout.allySide || 'p2').map(entry => entry.profile);
  const enemyProfiles = getRosterProfiles(enemyTiles, layout.enemyMainCount, layout.enemySide || 'p1').map(entry => entry.profile);
  if (!allyProfiles.length && !enemyProfiles.length) return 0;

  const allyEffectPressure = allyProfiles.reduce((sum, profile) => sum + profile.effectPressure, 0);
  const enemyEffectPressure = enemyProfiles.reduce((sum, profile) => sum + profile.effectPressure, 0);

  const enemyMaxDebuffValue = enemyProfiles.reduce((max, profile) => Math.max(max, profile.maxDebuffValue || 0), 0);
  const allyMaxDebuffValue = allyProfiles.reduce((max, profile) => Math.max(max, profile.maxDebuffValue || 0), 0);

  // Buff stripping is only valuable against buffs that are actually on the board right now.
  const allyActiveBuffs = getActiveEffectStats(allyTiles.slice(0, layout.allyMainCount ?? allyTiles.length), 'buff');
  const enemyActiveBuffs = getActiveEffectStats(enemyTiles.slice(0, layout.enemyMainCount ?? enemyTiles.length), 'buff');

  const allyCleanseValue = allyProfiles.reduce((sum, profile) => sum + (profile.cleanseCoverage * enemyMaxDebuffValue) + profile.cleanseHealBonus, 0);
  const enemyCleanseValue = enemyProfiles.reduce((sum, profile) => sum + (profile.cleanseCoverage * allyMaxDebuffValue) + profile.cleanseHealBonus, 0);
  const allyBuffStripValue = allyProfiles.reduce((sum, profile) => sum + (profile.buffStripCoverage * enemyActiveBuffs.max), 0);
  const enemyBuffStripValue = enemyProfiles.reduce((sum, profile) => sum + (profile.buffStripCoverage * allyActiveBuffs.max), 0);

  let score = 0;
  score += Math.min(allyCleanseValue, enemyEffectPressure) * 0.55;
  score -= Math.min(enemyCleanseValue, allyEffectPressure) * 0.2;
  score += Math.max(0, allyEffectPressure - enemyCleanseValue * 0.7) * 0.35;
  score -= Math.max(0, enemyEffectPressure - allyCleanseValue * 0.7) * 0.45;
  score += Math.min(allyBuffStripValue, enemyActiveBuffs.total) * 0.6;
  score -= Math.min(enemyBuffStripValue, allyActiveBuffs.total) * 0.3;

  if (enemyEffectPressure > 0 && allyCleanseValue === 0) score -= enemyEffectPressure * 0.1;
  if (allyEffectPressure > 0 && enemyCleanseValue === 0) score += allyEffectPressure * 0.08;

  return score;
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

export const evaluateEasyAIPlusSetupScore = (p2Main, p2Reserve, p1Main, p1Reserve) => {
  let score = 0;
  const allyRoster = [...(p2Main || []), ...(p2Reserve || [])].filter(isAliveTile);
  const allyProducerTags = new Set();

  allyRoster.forEach((tile) => {
    const profile = getTileProfile(tile);
    if (!profile) return;
    profile.producerTags.forEach(tag => allyProducerTags.add(tag));
  });

  (p2Main || []).forEach((tile, index) => {
    if (!isAliveTile(tile)) return;
    const activeSpell = getActiveSpell(tile.hero, index, 'p2');
    const activeTag = getConditionalTagForSpell(activeSpell);
    const post = activeSpell?.spec?.post || {};
    if (post.onlyApplyIfHasDebuff) {
      const eligibleEnemyCount = (p1Main || []).filter(enemyTile =>
        isAliveTile(enemyTile) && getTileEffects(enemyTile).some(effect => effect?.kind === 'debuff')
      ).length;
      score += eligibleEnemyCount > 0 ? Math.min(4, eligibleEnemyCount * 2) : -4;
    } else if (post.onlyApplyToWithEffect) {
      // Spell evaluation already credits damage only to targets that have the effect. A slot with
      // nothing to consume is a dead cast, so discourage moving into it unless a mark could appear.
      const requiredEffect = post.onlyApplyToWithEffect;
      const enemyHasEffect = (p1Main || []).some(enemyTile =>
        isAliveTile(enemyTile) && getTileEffects(enemyTile).some(effect => effect?.name === requiredEffect)
      );
      const canProduceEffect = allyProducerTags.has(requiredEffect)
        || (requiredEffect === 'Marked'
          && allyRoster.some(tile => (tile?.hero?.passives || []).some(passive => passive?.name === 'Accept Contract'))
          // Accept Contract only marks enemies whose energy crosses above 4 at round start
          && [...(p1Main || [])].some(enemyTile => isAliveTile(enemyTile)
            && Number(enemyTile.currentEnergy || 0) >= 3 && Number(enemyTile.currentEnergy || 0) <= 4));
      if (!enemyHasEffect && !canProduceEffect) score -= 6;
    } else if (activeTag && allyProducerTags.has(activeTag)) {
      score += 2;
    } else if (activeTag) {
      score -= 2;
    }
  });

  (p1Main || []).forEach((tile, index) => {
    if (!isAliveTile(tile)) return;
    const activeSpell = getActiveSpell(tile.hero, index, 'p1');
    const spec = activeSpell?.spec || {};
    const post = spec.post || {};
    if (post.onlyApplyIfHasDebuff || post.removeTopPositiveEffect || post.removeTopEffectByName || post.removeCorpse) {
      score -= 1.25;
    }
  });

  return score;
};

export const getOpponentColumnAttackDamage = (p1Main) => {
  let maxDamage = 0;
  (p1Main || []).forEach((tile, index) => {
    if (!isAliveTile(tile)) return;
    const spec = getActiveSpell(tile.hero, index, 'p1')?.spec;
    if (!spec || !(spec.targets || []).some(target => target?.type === 'column' && target.side === 'enemy')) return;
    const formula = spec.formula || {};
    const damage = formula.type === 'roll'
      ? Number(formula.base || 0) + ((Number(formula.die || 6) + 1) / 2)
      : Number(formula.value || 0);
    maxDamage = Math.max(maxDamage, damage, 1);
  });
  return maxDamage;
};

// Columns are the index triples [0,1,2], [3,4,5], [6,7,8] on both boards (see targeting.js). An opponent
// with a column attack and the last move can aim at any column after we have committed, so a full
// column of three heroes would take three hits.
const evaluateColumnStackPenalty = (p2Main, columnAttackDamage) => {
  if (!(columnAttackDamage > 0)) return 0;
  let penalty = 0;
  for (let col = 0; col < 3; col += 1) {
    const aliveInColumn = columnIndicesForBoard(col, 'p2')
      .filter(index => isAliveTile((p2Main || [])[index])).length;
    if (aliveInColumn >= 3) penalty += Math.max(6, columnAttackDamage * 2);
  }
  return penalty;
};

export const evaluateEasyAIPlusPosition = (p2Main, p2Reserve, p1Main, p1Reserve, context = {}) => {
  const boardScore = evaluateEasyAIPlusBoardAdvantage(p2Main, p2Reserve, p1Main, p1Reserve);
  const effectScore = evaluateEasyAIPlusEffectMatchup(
    [...(p2Main || []), ...(p2Reserve || [])],
    [...(p1Main || []), ...(p1Reserve || [])],
    {
      allyMainCount: (p2Main || []).length,
      enemyMainCount: (p1Main || []).length,
      allySide: 'p2',
      enemySide: 'p1',
    },
  );
  const setupScore = evaluateEasyAIPlusSetupScore(p2Main, p2Reserve, p1Main, p1Reserve);
  const columnStackPenalty = context.opponentHasLastMove
    ? evaluateColumnStackPenalty(p2Main, getOpponentColumnAttackDamage(p1Main))
    : 0;
  return {
    boardScore,
    effectScore,
    setupScore,
    columnStackPenalty,
    totalScore: boardScore + effectScore + setupScore - columnStackPenalty,
  };
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

const compareMovesDeterministically = (left, right) => {
  if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore;
  if (right.delta !== left.delta) return right.delta - left.delta;
  if (right.effectScore !== left.effectScore) return right.effectScore - left.effectScore;
  if (right.setupScore !== left.setupScore) return right.setupScore - left.setupScore;
  const leftKey = `${left.sourceId}->${left.destinationId}`;
  const rightKey = `${right.sourceId}->${right.destinationId}`;
  return leftKey.localeCompare(rightKey);
};

export const buildEasyAIPlusMovementCandidates = (p2Board, p2ReserveBoard, p1Board = [], p1ReserveBoard = [], context = {}) => {
  const base = evaluateEasyAIPlusPosition(p2Board, p2ReserveBoard, p1Board, p1ReserveBoard, context);
  const moves = [];

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
      const scored = evaluateEasyAIPlusPosition(simulated.main, simulated.reserve, p1Board, p1ReserveBoard, context);
      moves.push({
        sourceId,
        destinationId,
        ...scored,
        delta: scored.totalScore - base.totalScore,
      });
    });
  });

  const noopMove = getNoopMove(p2Board, p2ReserveBoard);
  moves.push({
    sourceId: noopMove.sourceId,
    destinationId: noopMove.destinationId,
    ...base,
    delta: 0,
  });

  return moves.sort(compareMovesDeterministically);
};

export const makeEasyAIPlusMovementDecision = (p2Board, p2ReserveBoard, p1Board = [], p1ReserveBoard = [], movement = null) => {
  const phase = movement?.movementPhase;
  const sequence = phase?.sequence || [];
  const opponentHasLastMove = sequence[sequence.length - 1] === 'p1'
    && Number(phase?.index || 0) < sequence.length - 1;
  const candidates = buildEasyAIPlusMovementCandidates(p2Board, p2ReserveBoard, p1Board, p1ReserveBoard, { opponentHasLastMove });
  if (!candidates.length) {
    return getNoopMove(p2Board, p2ReserveBoard);
  }

  const best = candidates[0];
  if (!best || best.delta <= 0) {
    return getNoopMove(p2Board, p2ReserveBoard);
  }

  return {
    sourceId: best.sourceId,
    destinationId: best.destinationId,
  };
};

export default {
  buildEasyAIPlusMovementCandidates,
  evaluateEasyAIPlusBoardAdvantage,
  evaluateEasyAIPlusEffectMatchup,
  evaluateEasyAIPlusSetupScore,
  makeEasyAIPlusMovementDecision,
};