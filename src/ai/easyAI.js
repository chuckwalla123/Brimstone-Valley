/**
 * Easy AI - Makes basic strategic decisions using point-based evaluation
 * 
 * Evaluation Formula:
 * Hero Points = Effective_Combat_Value + (Tile_Value × Expected_Turns_Alive)
 * Where:
 *   Effective_Combat_Value = √(HP × (HP + Armor × 4))
 *   Expected_Turns_Alive = Effective_Combat_Value / 4
 */

import { getSpellById } from '../spells.js';
import { getEffectByName } from '../effects.js';
import { indexToRow, indexToColumn, resolveTargets, columnIndicesForBoard } from '../targeting.js';

/**
 * Calculate the effective combat value (ECV) of a hero
 * ECV models the synergy between health and armor
 * @param {Object} hero - Hero object with health, armor properties
 * @returns {number} Effective combat value
 */
function calculateEffectiveCombatValue(hero) {
  const health = hero.currentHealth || hero.health || 0;
  const armor = hero.currentArmor || hero.armor || 0;
  
  // ECV = √(HP × (HP + Armor × 6))
  // This creates multiplicative scaling where armor and health synergize
  return Math.sqrt(health * (health + armor * 6));
}

/**
 * Calculate the base stats value of a hero (for ban decisions)
 * @param {Object} hero - Hero object with health, armor properties
 * @returns {number} Base value (health + armor*3)
 */
function calculateBaseStats(hero) {
  const health = hero.currentHealth || hero.health || 0;
  const armor = hero.currentArmor || hero.armor || 0;
  return health + (armor * 5);
}

/**
 * Estimate spell damage/healing based on actual board positions
 * Simulates casting the spell from a specific tile position
 * @param {Object} spell - Spell object
 * @param {number} tileIndex - Index of tile on main board (0-8) or -1/-2 for reserve
 * @param {boolean} isP2 - Whether this is P2's perspective
 * @param {Array} enemyBoard - Enemy main board (9 tiles)
 * @param {Array} enemyReserve - Enemy reserve board (2 tiles)
 * @param {Array} allyBoard - Ally main board (9 tiles)
 * @param {Array} allyReserve - Ally reserve board (2 tiles)
 * @returns {number} Estimated total impact of the spell
 */
const getFormulaBaseValue = (formula = {}, casterSpellPower = 0) => {
  if (!formula) return 0;
  const baseValue = Number(formula.value || 0);
  if (formula.type === 'roll') {
    const die = Number(formula.die || 6);
    const base = Number(formula.base || 0);
    const avgRoll = (die + 1) / 2;
    return (formula.ignoreSpellPower ? (base + avgRoll) : (base + avgRoll + casterSpellPower));
  }
  if (formula.type === 'attackPower') {
    return formula.ignoreSpellPower ? baseValue : (baseValue + casterSpellPower);
  }
  if (formula.type === 'healPower') {
    return baseValue + casterSpellPower;
  }
  return baseValue;
};

const getEffectScore = (effect) => {
  const resolved = typeof effect === 'string' ? getEffectByName(effect) : effect;
  if (!resolved) return 0;
  let score = 0;
  if (resolved.pulse && typeof resolved.pulse.value === 'number') {
    score += Math.abs(resolved.pulse.value);
  }
  if (resolved.modifiers && typeof resolved.modifiers === 'object') {
    score += Object.values(resolved.modifiers)
      .reduce((sum, val) => sum + Math.abs(Number(val) || 0), 0);
  }
  if (resolved.onTargeted && typeof resolved.onTargeted.value === 'number') {
    score += Math.abs(resolved.onTargeted.value);
  }
  if (resolved.onDamaged && typeof resolved.onDamaged.value === 'number') {
    score += Math.abs(resolved.onDamaged.value);
  }
  if (resolved.onDeath && typeof resolved.onDeath.value === 'number') {
    score += Math.abs(resolved.onDeath.value);
  }
  return score > 0 ? score : 1;
};

const getEffectThreatScore = (effect) => {
  const resolved = typeof effect === 'string' ? getEffectByName(effect) : effect;
  if (!resolved) return 0;
  if (resolved.kind !== 'debuff' && !(resolved.pulse && resolved.pulse.type === 'damage')) return 0;
  return getEffectScore(resolved);
};

const estimateIncomingDamagePerTurn = (hero, tileIndex, isP2, enemyBoard = [], enemyReserve = [], allyBoard = [], allyReserve = []) => {
  if (!hero) return 0;
  if (tileIndex < 0) return 0; // reserve tiles are untargetable

  const heroArmor = hero.currentArmor || hero.armor || 0;
  const allyBoardSim = [...(allyBoard || [])];

  // Simulate the hero being on the evaluated tile.
  allyBoardSim[tileIndex] = allyBoardSim[tileIndex] && allyBoardSim[tileIndex].hero
    ? { ...allyBoardSim[tileIndex], hero }
    : { hero, _dead: false };

  const boards = isP2
    ? { p1Board: enemyBoard, p2Board: allyBoardSim, p1Reserve: enemyReserve, p2Reserve: allyReserve }
    : { p1Board: allyBoardSim, p2Board: enemyBoard, p1Reserve: allyReserve, p2Reserve: enemyReserve };

  const enemySide = isP2 ? 'p1' : 'p2';
  const targetSide = isP2 ? 'p2' : 'p1';

  let totalIncoming = 0;

  (enemyBoard || []).forEach((enemyTile, enemyIdx) => {
    if (!enemyTile || !enemyTile.hero || enemyTile._dead) return;
    const enemyHero = enemyTile.hero;

    const row = indexToRow(enemyIdx, enemySide);
    const activeRow = row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
    const spellData = enemyHero.spells ? enemyHero.spells[activeRow] : null;
    if (!spellData) return;

    const castsRemaining = (enemyTile._castsRemaining && typeof enemyTile._castsRemaining[activeRow] === 'number')
      ? Number(enemyTile._castsRemaining[activeRow])
      : (spellData.casts != null ? Number(spellData.casts) : null);
    if (castsRemaining == null || Number.isNaN(castsRemaining) || castsRemaining <= 0) return;

    const spellId = spellData.spell || spellData.id;
    if (!spellId) return;
    const spell = getSpellById(spellId);
    if (!spell || !spell.spec) return;

    const casterSpellPower = (enemyTile && typeof enemyTile.currentSpellPower === 'number')
      ? Number(enemyTile.currentSpellPower)
      : (typeof enemyHero.spellPower === 'number' ? Number(enemyHero.spellPower) : 0);

    const targets = resolveTargets(
      spell.spec.targets || [],
      { boardName: enemySide, index: enemyIdx, tile: enemyTile },
      boards,
      null,
      { bypassTriggers: !!(spell.spec.post && spell.spec.post.bypassTriggers) }
    );

    const isTargeted = targets.some(t => t && t.board === targetSide && t.index === tileIndex);
    if (!isTargeted) return;

    const formula = spell.spec.formula || {};
    const baseValue = getFormulaBaseValue(formula, casterSpellPower);

    if (formula.type === 'attackPower' || formula.type === 'damage' || formula.type === 'roll') {
      const ignoreArmor = formula.ignoreArmor || formula.type === 'damage';
      const effectiveDamage = ignoreArmor ? baseValue : Math.max(0, baseValue - heroArmor);
      totalIncoming += effectiveDamage;
    }

    const effects = spell.spec.effects || [];
    if (effects.length > 0) {
      const effectThreat = effects.reduce((sum, effect) => sum + getEffectThreatScore(effect), 0);
      totalIncoming += effectThreat;
    }
  });

  return totalIncoming;
};

const getDeltaEnergyAmount = (deltaEnergy) => {
  if (typeof deltaEnergy === 'number') return deltaEnergy;
  if (deltaEnergy && typeof deltaEnergy === 'object' && typeof deltaEnergy.amount === 'number') {
    return deltaEnergy.amount;
  }
  return 0;
};

const estimateIncomingAllyEnergyPerTurn = (
  tileIndex,
  isP2,
  enemyBoard = [],
  enemyReserve = [],
  allyBoard = [],
  allyReserve = []
) => {
  if (tileIndex < 0) return 0;

  const allySide = isP2 ? 'p2' : 'p1';
  const enemySide = isP2 ? 'p1' : 'p2';
  const boards = isP2
    ? { p1Board: enemyBoard, p2Board: allyBoard, p1Reserve: enemyReserve, p2Reserve: allyReserve }
    : { p1Board: allyBoard, p2Board: enemyBoard, p1Reserve: allyReserve, p2Reserve: enemyReserve };

  let totalEnergySupport = 0;

  (allyBoard || []).forEach((allyTile, allyIdx) => {
    if (!allyTile || !allyTile.hero || allyTile._dead) return;
    const allyHero = allyTile.hero;
    const row = indexToRow(allyIdx, allySide);
    const activeRow = row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
    const spellData = allyHero.spells ? allyHero.spells[activeRow] : null;
    if (!spellData) return;

    const castsRemaining = (allyTile._castsRemaining && typeof allyTile._castsRemaining[activeRow] === 'number')
      ? Number(allyTile._castsRemaining[activeRow])
      : (spellData.casts != null ? Number(spellData.casts) : null);
    if (castsRemaining == null || Number.isNaN(castsRemaining) || castsRemaining <= 0) return;

    const spellId = spellData.spell || spellData.id;
    if (!spellId) return;
    const spell = getSpellById(spellId);
    if (!spell || !spell.spec || !spell.spec.post || !spell.spec.post.deltaEnergy) return;

    const cost = Number(spellData.cost || 0);
    const allySpeed = Number(allyTile.currentSpeed ?? allyHero.speed ?? 0);
    const allyEnergy = Number(allyTile.currentEnergy ?? allyHero.energy ?? 0) + allySpeed;
    if (cost > 0 && allyEnergy < cost) return;

    const targets = resolveTargets(
      spell.spec.targets || [],
      { boardName: allySide, index: allyIdx, tile: allyTile },
      boards,
      null,
      { bypassTriggers: !!(spell.spec.post && spell.spec.post.bypassTriggers) }
    );

    const hitsEvaluatedTile = (targets || []).some(
      t => t && t.board === allySide && t.index === tileIndex
    );
    if (!hitsEvaluatedTile) return;

    const deltaEnergy = getDeltaEnergyAmount(spell.spec.post.deltaEnergy);
    if (deltaEnergy > 0) {
      totalEnergySupport += deltaEnergy;
    }
  });

  return totalEnergySupport;
};

function estimateSpellValue(spell, tileIndex, isP2, enemyBoard = [], enemyReserve = [], allyBoard = [], allyReserve = [], casterSpellPower = 0, hero = null, slotKey = null) {
  if (!spell || !spell.spec) return 0;
  
  const spec = spell.spec;
  const formula = spec.formula || {};
  // Don't default to 1 - utility spells with no damage formula should have 0 baseDamage
  const baseValue = getFormulaBaseValue(formula, casterSpellPower);
  const isHealingSpell = formula.type === 'heal' || formula.type === 'healPower';
  const targets = spec.targets || [];
  
  let totalImpact = 0;
  
  // Helper to get tile position info using proper visual row/column mapping
  // The board index 0-8 maps differently to visual rows/cols than simple division
  const boardSide = isP2 ? 'p2' : 'p1';
  const getTileInfo = (idx) => {
    if (idx < 0) return { row: -1, col: -1 }; // Reserve
    const row = indexToRow(idx, boardSide);
    const col = indexToColumn(idx, boardSide);
    return { row, col };
  };
  
  // For enemy board, we need their perspective
  const enemySide = isP2 ? 'p1' : 'p2';
  const getEnemyTileInfo = (idx) => {
    if (idx < 0) return { row: -1, col: -1 };
    const row = indexToRow(idx, enemySide);
    const col = indexToColumn(idx, enemySide);
    return { row, col };
  };

  const getTileInfoBySide = (idx, sideKey) => {
    if (idx < 0) return { row: -1, col: -1 };
    const row = indexToRow(idx, sideKey);
    const col = indexToColumn(idx, sideKey);
    return { row, col };
  };
  
  const casterPos = getTileInfo(tileIndex);

  const isTileAlive = (tile) => (tile && tile.hero && !tile._dead);
  
  // Helper to get the target column when attacking across boards
  // Per targeting.js column targeting: when attacking enemies, columns are INVERTED
  // col 0 -> col 2, col 1 -> col 1, col 2 -> col 0
  const getTargetColumn = (casterCol, targetSide) => {
    if (targetSide === 'enemy') {
      return 2 - casterCol; // Invert for cross-board attacks
    }
    return casterCol; // Same column for ally targets
  };
  
  let lastResolved = null;
  targets.forEach(target => {
    const side = target.side || 'enemy';
    const boardToCheck = side === 'enemy' ? enemyBoard : allyBoard;
    const reserveToCheck = side === 'enemy' ? enemyReserve : allyReserve;
    // Use appropriate tile info getter based on which board we're checking
    const getTileInfoForBoard = side === 'enemy' ? getEnemyTileInfo : getTileInfo;
    
    let affectedTargets = [];
    let damageTargets = null;
    
    // Get the target column (mirrored for cross-board attacks)
    const targetCol = casterPos.col >= 0 ? getTargetColumn(casterPos.col, side) : -1;
    
    switch (target.type) {
      case 'frontRow':
      case 'middleRow':
      case 'backRow':
      case 'frontTwoRows': {
        const rowsToInclude = new Set();
        if (target.type === 'frontRow') rowsToInclude.add(0);
        if (target.type === 'middleRow') rowsToInclude.add(1);
        if (target.type === 'backRow') rowsToInclude.add(2);
        if (target.type === 'frontTwoRows') { rowsToInclude.add(0); rowsToInclude.add(1); }
        for (let i = 0; i < 9; i++) {
          const targetPos = getTileInfoForBoard(i);
          if (rowsToInclude.has(targetPos.row) && isTileAlive(boardToCheck[i])) {
            affectedTargets.push(boardToCheck[i].hero);
          }
        }
        break;
      }

      case 'frontmostRowWithHero': {
        let bestRow = null;
        for (let i = 0; i < 9; i++) {
          const targetPos = getTileInfoForBoard(i);
          if (isTileAlive(boardToCheck[i])) {
            if (bestRow == null || targetPos.row < bestRow) bestRow = targetPos.row;
          }
        }
        if (bestRow != null) {
          for (let i = 0; i < 9; i++) {
            const targetPos = getTileInfoForBoard(i);
            if (targetPos.row === bestRow && isTileAlive(boardToCheck[i])) {
              affectedTargets.push(boardToCheck[i].hero);
            }
          }
        }
        break;
      }

      case 'rowContainingHighestArmor':
      case 'rowContainingLowestArmor': {
        let bestRow = null;
        let bestArmor = target.type === 'rowContainingHighestArmor' ? -Infinity : Infinity;
        for (let i = 0; i < 9; i++) {
          const tile = boardToCheck[i];
          if (!isTileAlive(tile)) continue;
          const armor = tile.hero.currentArmor || tile.hero.armor || 0;
          const targetPos = getTileInfoForBoard(i);
          if ((target.type === 'rowContainingHighestArmor' && armor > bestArmor) ||
              (target.type === 'rowContainingLowestArmor' && armor < bestArmor)) {
            bestArmor = armor;
            bestRow = targetPos.row;
          }
        }
        if (bestRow != null) {
          for (let i = 0; i < 9; i++) {
            const targetPos = getTileInfoForBoard(i);
            if (targetPos.row === bestRow && isTileAlive(boardToCheck[i])) {
              affectedTargets.push(boardToCheck[i].hero);
            }
          }
        }
        break;
      }

      case 'rowWithHighestSumArmor': {
        const rowTotals = { 0: 0, 1: 0, 2: 0 };
        for (let i = 0; i < 9; i++) {
          const tile = boardToCheck[i];
          if (!isTileAlive(tile)) continue;
          const targetPos = getTileInfoForBoard(i);
          const armor = tile.hero.currentArmor || tile.hero.armor || 0;
          rowTotals[targetPos.row] += armor;
        }
        const bestRow = Object.keys(rowTotals)
          .map(r => Number(r))
          .sort((a, b) => rowTotals[b] - rowTotals[a])[0];
        if (bestRow != null) {
          for (let i = 0; i < 9; i++) {
            const targetPos = getTileInfoForBoard(i);
            if (targetPos.row === bestRow && isTileAlive(boardToCheck[i])) {
              affectedTargets.push(boardToCheck[i].hero);
            }
          }
        }
        break;
      }

      case 'leastEffects': {
        let best = null;
        let bestCount = Infinity;
        [...boardToCheck, ...reserveToCheck].forEach((tile, idx) => {
          if (!isTileAlive(tile)) return;
          if (target.excludeSelf && side === 'ally' && tileIndex >= 0 && idx === tileIndex) return;
          const tileEffects = tile.effects || tile.hero?.effects || [];
          const count = tileEffects.length;
          if (count < bestCount) {
            bestCount = count;
            best = tile.hero;
          }
        });
        if (best) affectedTargets.push(best);
        break;
      }

      case 'mostEffects': {
        let best = null;
        let bestCount = -1;
        [...boardToCheck, ...reserveToCheck].forEach((tile, idx) => {
          if (!isTileAlive(tile)) return;
          if (target.excludeSelf && side === 'ally' && tileIndex >= 0 && idx === tileIndex) return;
          const tileEffects = tile.effects || tile.hero?.effects || [];
          const count = tileEffects.length;
          if (count > bestCount) {
            bestCount = count;
            best = tile.hero;
          }
        });
        if (best) affectedTargets.push(best);
        break;
      }

      case 'mostEffectName': {
        let best = null;
        let bestCount = -1;
        const effectName = target.effectName;
        [...boardToCheck, ...reserveToCheck].forEach((tile, idx) => {
          if (!isTileAlive(tile)) return;
          if (target.excludeSelf && side === 'ally' && tileIndex >= 0 && idx === tileIndex) return;
          const tileEffects = tile.effects || tile.hero?.effects || [];
          const count = effectName ? tileEffects.filter(e => e && e.name === effectName).length : 0;
          if (count > bestCount) {
            bestCount = count;
            best = tile.hero;
          }
        });
        if (best) affectedTargets.push(best);
        break;
      }

      case 'nearest': {
        const candidates = [];
        for (let i = 0; i < boardToCheck.length; i++) {
          const tile = boardToCheck[i];
          if (!isTileAlive(tile)) continue;
          if (target.excludeSelf && side === 'ally' && tileIndex >= 0 && i === tileIndex) continue;
          const pos = getTileInfoForBoard(i);
          const dist = (pos.row < 0 || pos.col < 0 || casterPos.row < 0 || casterPos.col < 0)
            ? Infinity
            : Math.abs(pos.row - casterPos.row) + Math.abs(pos.col - casterPos.col);
          candidates.push({ hero: tile.hero, dist, row: pos.row });
        }
        candidates.sort((a, b) => a.dist - b.dist || a.row - b.row);
        const maxTargets = target.max || 1;
        affectedTargets.push(...candidates.slice(0, maxTargets).map(c => c.hero));
        break;
      }

      case 'nearestDeadAlly': {
        let best = null;
        let bestDist = Infinity;
        boardToCheck.forEach((tile, i) => {
          if (!tile || !tile.hero || !tile._dead) return;
          const pos = getTileInfoForBoard(i);
          const dist = (pos.row < 0 || pos.col < 0 || casterPos.row < 0 || casterPos.col < 0)
            ? Infinity
            : Math.abs(pos.row - casterPos.row) + Math.abs(pos.col - casterPos.col);
          if (dist < bestDist) {
            bestDist = dist;
            best = tile.hero;
          }
        });
        if (best) affectedTargets.push(best);
        break;
      }

      case 'nearestDeadEnemy': {
        let bestIdx = null;
        let bestDist = Infinity;
        boardToCheck.forEach((tile, i) => {
          if (!tile || !tile.hero || !tile._dead) return;
          const pos = getTileInfoForBoard(i);
          const dist = (pos.row < 0 || pos.col < 0 || casterPos.row < 0 || casterPos.col < 0)
            ? Infinity
            : Math.abs(pos.row - casterPos.row) + Math.abs(pos.col - casterPos.col);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        });
        if (bestIdx != null) {
          lastResolved = { idx: bestIdx, boardSide: side === 'enemy' ? enemySide : boardSide };
        }
        break;
      }

      case 'projectile': {
        // Find enemy in target column (projectile path)
        if (targetCol >= 0) {
          // Use columnIndicesForBoard to get the actual array indices in this column
          const targetSide = side === 'enemy' ? enemySide : boardSide;
          const columnIndices = columnIndicesForBoard(targetCol, targetSide);
          
          // DEBUG: Log projectile targeting details
          if (hero && (hero.name === 'Lancer' || hero.name?.includes('Boss') || hero.name?.includes('Lord') || hero.name?.includes('King') || hero.name?.includes('Queen'))) {
            console.log(`[EasyAI Projectile] ${hero.name} at index ${tileIndex} (${casterPos.row},${casterPos.col}) targeting col ${targetCol} on ${side} board, indices: [${columnIndices.join(',')}]`);
          }
          
          // columnIndicesForBoard returns indices in front→back order, so first alive hero is frontmost
          for (const i of columnIndices) {
            if (i < boardToCheck.length && isTileAlive(boardToCheck[i])) {
              affectedTargets.push(boardToCheck[i].hero);
              lastResolved = { idx: i, boardSide: side === 'enemy' ? enemySide : boardSide };
              if (hero && (hero.name === 'Lancer' || hero.name?.includes('Boss') || hero.name?.includes('Lord') || hero.name?.includes('King') || hero.name?.includes('Queen'))) {
                console.log(`  [EasyAI Projectile] Hitting frontmost at idx ${i}`);
              }
              break; // Projectile hits only the frontmost target
            }
          }
          
          if (affectedTargets.length === 0 && hero && (hero.name === 'Lancer' || hero.name?.includes('Boss') || hero.name?.includes('Lord') || hero.name?.includes('King') || hero.name?.includes('Queen'))) {
            console.log(`  [EasyAI Projectile] No targets found in column ${targetCol}`);
          }
        }
        break;
      }
      
      case 'highestHealth': {
        let highest = null;
        let maxHealth = -1;
        [...boardToCheck, ...reserveToCheck].forEach(tile => {
          if (isTileAlive(tile)) {
            const hp = tile.hero.currentHealth || tile.hero.health || 0;
            if (hp > maxHealth) {
              maxHealth = hp;
              highest = tile.hero;
            }
          }
        });
        if (highest) affectedTargets.push(highest);
        break;
      }
      
      case 'lowestHealth': {
        let lowest = null;
        let minHealth = Infinity;
        [...boardToCheck, ...reserveToCheck].forEach(tile => {
          if (isTileAlive(tile)) {
            const hp = tile.hero.currentHealth || tile.hero.health || 0;
            if (hp < minHealth) {
              minHealth = hp;
              lowest = tile.hero;
            }
          }
        });
        if (lowest) affectedTargets.push(lowest);
        break;
      }
      
      case 'column': {
        // All tiles in target column (mirrored for cross-board attacks)
        if (targetCol >= 0) {
          // Use columnIndicesForBoard to get the actual array indices in this column
          const targetSide = side === 'enemy' ? enemySide : boardSide;
          const columnIndices = columnIndicesForBoard(targetCol, targetSide);
          
          // DEBUG: Log column targeting details
          if (hero && (hero.name === 'Lancer' || hero.name?.includes('Boss') || hero.name?.includes('Lord') || hero.name?.includes('King') || hero.name?.includes('Queen'))) {
            console.log(`[EasyAI Column] ${hero.name} at index ${tileIndex} (row=${casterPos.row},col=${casterPos.col}) on ${boardSide} board`);
            console.log(`  Targeting col ${targetCol} on ${side} board (${targetSide}), indices: [${columnIndices.join(',')}]`);
            console.log(`  Enemy board has ${boardToCheck.length} slots:`, boardToCheck.map((t,i) => t && t.hero ? `${i}:${t.hero.name}` : `${i}:empty`).join(' '));
          }
          
          // Check only the indices that are actually in the target column
          for (const i of columnIndices) {
            if (i < boardToCheck.length && isTileAlive(boardToCheck[i])) {
              affectedTargets.push(boardToCheck[i].hero);
            }
          }
          
          if (hero && (hero.name === 'Lancer' || hero.name?.includes('Boss') || hero.name?.includes('Lord') || hero.name?.includes('King') || hero.name?.includes('Queen'))) {
            console.log(`  [EasyAI Column] Found ${affectedTargets.length} targets in column ${targetCol}`);
          }
        }
        break;
      }
      
      case 'adjacent': {
        // Adjacent tiles (up, down, left, right) anchored to the last resolved target.
        if (lastResolved && typeof lastResolved.idx === 'number') {
          const anchorBoard = lastResolved.boardSide;
          const boardArr = anchorBoard === enemySide ? enemyBoard : allyBoard;
          const anchorPos = getTileInfoBySide(lastResolved.idx, anchorBoard);
          if (anchorPos.row >= 0 && anchorPos.col >= 0) {
            for (let i = 0; i < 9; i++) {
              const targetPos = getTileInfoBySide(i, anchorBoard);
              const rowDiff = Math.abs(targetPos.row - anchorPos.row);
              const colDiff = Math.abs(targetPos.col - anchorPos.col);
              // Adjacent means exactly 1 step in row OR col, not both (no diagonals)
              if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
                if (isTileAlive(boardArr[i])) {
                  affectedTargets.push(boardArr[i].hero);
                }
              }
            }
          }
        }
        break;
      }

      case 'nearestToLastTarget': {
        if (lastResolved && typeof lastResolved.idx === 'number') {
          const anchorBoard = lastResolved.boardSide;
          const boardArr = anchorBoard === enemySide ? enemyBoard : allyBoard;
          const anchorPos = getTileInfoBySide(lastResolved.idx, anchorBoard);
          const candidates = [];
          for (let i = 0; i < 9; i++) {
            if (!isTileAlive(boardArr[i])) continue;
            const targetPos = getTileInfoBySide(i, anchorBoard);
            const dist = Math.abs(targetPos.row - anchorPos.row) + Math.abs(targetPos.col - anchorPos.col);
            candidates.push({ idx: i, dist });
          }
          if (candidates.length > 0) {
            const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
            const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
            const order = anchorBoard === 'p2' ? bookOrderP2 : bookOrderP1;
            const priority = {}; order.forEach((v, i) => { priority[v] = i; });
            candidates.sort((a, b) => {
              if (a.dist !== b.dist) return a.dist - b.dist;
              return (priority[a.idx] || 0) - (priority[b.idx] || 0);
            });
            const chosen = candidates[0].idx;
            affectedTargets.push(boardArr[chosen].hero);
            lastResolved = { idx: chosen, boardSide: anchorBoard };
          }
        }
        break;
      }
      
      case 'all': {
        [...boardToCheck, ...reserveToCheck].forEach(tile => {
          if (isTileAlive(tile)) {
            const tileEffects = tile.effects || tile.hero?.effects || [];
            
            // Check conditional targeting
            const onlyIfHasDebuff = spec.post && spec.post.onlyApplyIfHasDebuff;
            const onlyIfHasEffect = spec.post && spec.post.onlyApplyToWithEffect;
            
            if (onlyIfHasDebuff) {
              const hasDebuff = tileEffects.some(e => e && e.kind === 'debuff');
              if (!damageTargets) damageTargets = [];
              if (hasDebuff) damageTargets.push(tile.hero);
              affectedTargets.push(tile.hero);
            } else if (onlyIfHasEffect) {
              const hasRequiredEffect = tileEffects.some(e => e && e.name === onlyIfHasEffect);
              if (!damageTargets) damageTargets = [];
              if (hasRequiredEffect) damageTargets.push(tile.hero);
              affectedTargets.push(tile.hero);
            } else {
              affectedTargets.push(tile.hero);
            }
          }
        });
        break;
      }
      
      case 'board': {
        // Board-wide effects (like gale's moveAllBack) - targets all heroes on the main board only
        // Also handles spells like Truth that only affect enemies with debuffs
        // And spells like Assassinate that only affect enemies with specific effects
        boardToCheck.forEach(tile => {
          if (isTileAlive(tile)) {
            const tileEffects = tile.effects || tile.hero?.effects || [];
            
            // Check if spell only applies to targets with debuffs (like Truth)
            const onlyIfHasDebuff = spec.post && spec.post.onlyApplyIfHasDebuff;
            if (onlyIfHasDebuff) {
              // Only add target if they have at least one debuff
              const hasDebuff = tileEffects.some(e => e && e.kind === 'debuff');
              if (!damageTargets) damageTargets = [];
              if (hasDebuff) damageTargets.push(tile.hero);
              affectedTargets.push(tile.hero);
              return; // Skip other checks
            }
            
            // Check if spell only applies to targets with a specific effect (like Assassinate requiring Marked)
            const onlyIfHasEffect = spec.post && spec.post.onlyApplyToWithEffect;
            if (onlyIfHasEffect) {
              // Only add target if they have the required effect
              const hasRequiredEffect = tileEffects.some(e => e && e.name === onlyIfHasEffect);
              if (!damageTargets) damageTargets = [];
              if (hasRequiredEffect) damageTargets.push(tile.hero);
              affectedTargets.push(tile.hero);
              return; // Skip other checks
            }
            
            // No conditions, add all alive targets
            affectedTargets.push(tile.hero);
          }
        });
        break;
      }
      
      case 'self': {
        affectedTargets.push({ health: 1 }); // Placeholder for self
        break;
      }
      
      default:
        // Generic single target
        if (boardToCheck[0]?.hero) affectedTargets.push(boardToCheck[0].hero);
    }
    
    const damageTargetsToUse = damageTargets !== null ? damageTargets : affectedTargets;

    // Calculate impact based on targets
    damageTargetsToUse.forEach(hero => {
      if (isHealingSpell) {
        // For healing spells, value is based on how much health the target is missing
        const currentHealth = hero.currentHealth ?? hero.health ?? 0;
        const maxHealth = hero.health || hero.maxHealth || currentHealth;
        const missingHealth = maxHealth - currentHealth;
        // Heal value is the minimum of the heal amount and missing health (can't overheal)
        // Add a small base value even at full health so AI doesn't completely ignore heals
        const effectiveHeal = Math.min(baseValue, missingHealth) + (missingHealth > 0 ? 0 : baseValue * 0.2);
        totalImpact += effectiveHeal;
      } else {
        // For damage spells, subtract armor from damage
        const armor = hero.currentArmor || hero.armor || 0;
        let damageValue = baseValue;
        if (formula.addTargetEffectNameCount && hero.effects) {
          const effectName = formula.addTargetEffectNameCount;
          const mult = (typeof formula.addTargetEffectCountMultiplier === 'number')
            ? Number(formula.addTargetEffectCountMultiplier)
            : 1;
          const count = (hero.effects || []).filter(e => e && e.name === effectName).length;
          damageValue += count * mult;
        }
        if (typeof formula.addTargetEffectsMultiplier === 'number' && hero.effects) {
          const buffs = (hero.effects || []).filter(e => e && e.kind === 'buff').length;
          damageValue += buffs * Number(formula.addTargetEffectsMultiplier || 0);
        }
        const effectiveDamage = formula.ignoreArmor ? damageValue : Math.max(0, damageValue - armor);
        totalImpact += effectiveDamage;
      }
    });
    
    // Add value for effects: each effect adds 2 value per target affected
    // This incentivizes the AI to use spells with debuffs/buffs even if damage is lower
    const baseEffects = spec.effects || [];
    const augmentEffects = (() => {
      if (!hero || !slotKey || !hero._towerDebuffAugments) return [];
      const debuffs = hero._towerDebuffAugments[slotKey] || [];
      return debuffs.map(name => getEffectByName(name)).filter(Boolean);
    })();
    const effects = [...baseEffects, ...augmentEffects];
    if (effects.length > 0 && affectedTargets.length > 0) {
      const effectScore = effects.reduce((sum, effect) => sum + getEffectScore(effect), 0);
      totalImpact += effectScore * affectedTargets.length;
    }
    
    // Add value for utility post-effects (like moveAllBack, moveRowBack, etc.)
    const post = spec.post || {};
    if (affectedTargets.length > 0) {
      // Movement effects are valuable for disruption
      if (post.moveAllBack || post.moveRowBack || post.knockBack) {
        totalImpact += affectedTargets.length * 1.5; // Disruption value per target
      }
      // Secondary healing effects (like leech's secondaryHeal)
      if (post.secondaryHeal) {
        totalImpact += (post.secondaryHeal.amount || 0);
      }
      // Immediate heal effects (like blessingOfLife's immediateHeal)
      if (post.immediateHeal) {
        totalImpact += (post.immediateHeal.amount || 0) * affectedTargets.length;
      }
      // Energy manipulation
      if (post.deltaEnergy) {
        totalImpact += Math.abs(post.deltaEnergy) * affectedTargets.length;
      }
    }
  });
  
  return totalImpact;
}

/**
 * Calculate tile value for a hero in a specific position
 * Tile Value = Sum of (Spell Impact * Hero Speed / Spell Cost) for all spells active at that position
 * @param {Object} hero - Hero object
 * @param {number} tileIndex - Position index (0-8 for main, -1/-2 for reserve)
 * @param {boolean} isP2 - Whether this is P2's perspective
 * @param {Array} enemyBoard - Enemy main board state
 * @param {Array} enemyReserve - Enemy reserve state
 * @param {Array} allyBoard - Ally main board state
 * @param {Array} allyReserve - Ally reserve state
 * @param {Object} tile - Optional tile object containing runtime state like _castsRemaining
 * @returns {number} Tile value
 */
function calculateTileValue(hero, tileIndex, isP2, enemyBoard = [], enemyReserve = [], allyBoard = [], allyReserve = [], tile = null) {
  if (!hero || !hero.spells) return 0;

  // Reserve tiles don't contribute to spell output
  if (tileIndex < 0) {
    return 0;
  }
  
  // Determine which row this tile is in to know which spells are active
  // Use proper visual row mapping - indexToRow returns 0=front, 1=middle, 2=back
  const boardSide = isP2 ? 'p2' : 'p1';
  let activeRow = 'middle';
  const row = indexToRow(tileIndex, boardSide);
  if (row === 0) activeRow = 'front';
  else if (row === 1) activeRow = 'middle';
  else if (row === 2) activeRow = 'back';
  
  const speed = hero.speed || 1;
  let totalSpellValue = 0;

  const allyBoardSim = [...(allyBoard || [])];
  allyBoardSim[tileIndex] = allyBoardSim[tileIndex] && allyBoardSim[tileIndex].hero
    ? { ...allyBoardSim[tileIndex], hero }
    : { hero, _dead: false };

  const incomingAllyEnergy = estimateIncomingAllyEnergyPerTurn(
    tileIndex,
    isP2,
    enemyBoard,
    enemyReserve,
    allyBoardSim,
    allyReserve
  );
  
  // Evaluate only the spell(s) active at this position
  // Most heroes have one spell per row, but some might have multiple
  let hasValidSpell = false;
  
  Object.entries(hero.spells).forEach(([position, spellData]) => {
    if (!spellData) return;
    
    // Only evaluate spells that are active from this row
    if (position !== activeRow) return;

    // Heroes define spells using `id` (e.g. front: { id: 'fireball', cost: 3, casts: 2 })
    const spellId = spellData.spell || spellData.id;
    if (!spellId) return;
    
    // Check if spell has casts remaining - use tile._castsRemaining if available (runtime state),
    // otherwise fall back to hero's static spellData.casts
    // If casts is 0, treat as no spell (hero would only be able to do basic attack)
    const castsRemaining = (tile && tile._castsRemaining && typeof tile._castsRemaining[position] === 'number')
      ? Number(tile._castsRemaining[position])
      : (spellData.casts != null ? Number(spellData.casts) : null);
    const hasCasts = !(castsRemaining == null || Number.isNaN(castsRemaining) || castsRemaining <= 0);
    if (!hasCasts) return;

    const spell = getSpellById(spellId);
    if (!spell) return;
    
    hasValidSpell = true;

    const cost = spellData.cost || 1;

    // Simulate casting from this specific position
    const casterSpellPower = (tile && typeof tile.currentSpellPower === 'number')
      ? Number(tile.currentSpellPower)
      : (typeof hero.spellPower === 'number' ? Number(hero.spellPower) : 0);

    const spellImpact = estimateSpellValue(
      spell,
      tileIndex,
      isP2,
      enemyBoard,
      enemyReserve,
      allyBoard,
      allyReserve,
      casterSpellPower,
      hero,
      position
    );

    // Compute per-turn impact: (spell damage per cast) × (speed / cost)
    // Clamp by current energy and remaining casts when runtime state is available.
    let perTurnImpact = spellImpact * (speed / cost);
    const currentEnergy = (tile && typeof tile.currentEnergy === 'number')
      ? Number(tile.currentEnergy) + speed + incomingAllyEnergy
      : null;
    if (cost > 0 && castsRemaining != null) {
      let castsThisTurn = Number(castsRemaining);
      if (currentEnergy != null && currentEnergy >= cost) {
        castsThisTurn = Math.min(castsThisTurn, Math.floor(currentEnergy / cost));
      }
      perTurnImpact = spellImpact * Math.min((speed / cost), castsThisTurn);
    }

    // Sum all spell contributions (don't average - a hero with more spells is more versatile)
    totalSpellValue += perTurnImpact;
  });
  
  // If no valid spell for this row, the hero can only do basic attacks
  if (!hasValidSpell) {
    return 1; // Basic attack only
  }
  
  // Add basic attack as fallback value (in case spell has no targets)
  const basicAttackValue = 1;
  
  return totalSpellValue + basicAttackValue;
}

/**
 * Calculate total hero points for a hero in a given tile
        const hasCasts = !(castsRemaining == null || Number.isNaN(castsRemaining) || castsRemaining <= 0);
        const castsPenalty = hasCasts ? 1 : 0.15;
        const perTurnImpact = spellImpact * (speed / cost) * castsPenalty;
 * Where:
 *   Effective_Combat_Value = √(HP × (HP + Armor × 4))
 *   Expected_Turns_Alive = Effective_Combat_Value / 4
 * 
 * @param {Object} hero - Hero object
 * @param {number} tileIndex - Tile position index
 * @param {boolean} isP2 - Whether this is P2's perspective
 * @param {Array} enemyBoard - Enemy main board
 * @param {Array} enemyReserve - Enemy reserve
 * @param {Array} allyBoard - Ally main board
 * @param {Array} allyReserve - Ally reserve
 * @param {Object} tile - Optional tile object containing runtime state like _castsRemaining
 * @returns {number} Total hero points
 */
function calculateHeroPoints(hero, tileIndex, isP2, enemyBoard = [], enemyReserve = [], allyBoard = [], allyReserve = [], tile = null) {
  // Dead heroes have zero value
  if (tile && tile._dead) return 0;
  
  const ecv = calculateEffectiveCombatValue(hero);
  const tileValue = calculateTileValue(hero, tileIndex, isP2, enemyBoard, enemyReserve, allyBoard, allyReserve, tile);
  const incomingDamage = estimateIncomingDamagePerTurn(hero, tileIndex, isP2, enemyBoard, enemyReserve, allyBoard, allyReserve);
  
  // Expected turns alive = ECV / 4
  const expectedTurnsAlive = ecv / 4;
  
  // Tile contribution weighted by survival expectation
  const tileContribution = tileValue * expectedTurnsAlive;
  const incomingPenalty = incomingDamage * expectedTurnsAlive;
  
  const reservePenalty = tileIndex < 0 ? 50 : 0;

  return ecv + tileContribution - incomingPenalty - reservePenalty;
}

/**
 * Makes a ban decision - ban the hero with highest base stats
 * @param {Array} availableHeroes - List of heroes that can be banned
 * @returns {Object} The hero to ban, or null if no heroes available
 */
export const makeBanDecision = (availableHeroes) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  
  // Ban the hero with highest health + armor*3
  let bestHero = null;
  let bestValue = -1;
  
  availableHeroes.forEach(hero => {
    const value = calculateBaseStats(hero);
    if (value > bestValue) {
      bestValue = value;
      bestHero = hero;
    }
  });
  
  return bestHero;
};

/**
 * Makes a pick decision - pick hero/slot combo with highest points
 * @param {Array} availableHeroes - List of heroes that can be picked
 * @param {Object} boardState - Object with { p2Main, p2Reserve, p1Main, p1Reserve }
 * @returns {Object} { hero, slotIndex, slotType } or null if no valid pick
 */
export const makePickDecision = (availableHeroes, boardState) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  if (!boardState) return null;
  
  const { p2Main = [], p2Reserve = [], p1Main = [], p1Reserve = [] } = boardState;
  
  // Count current heroes
  const mainCount = p2Main.filter(t => t && t.hero && !t._dead).length;
  const reserveCount = p2Reserve.filter(t => t && t.hero && !t._dead).length;
  
  // Build list of valid slots
  const validSlots = [];
  
  if (mainCount < 5) {
    p2Main.forEach((tile, idx) => {
      if (!tile.hero) {
        validSlots.push({ index: idx, type: 'main' });
      }
    });
  }
  
  if (reserveCount < 2) {
    p2Reserve.forEach((tile, idx) => {
      if (!tile.hero) {
        validSlots.push({ index: idx, type: 'reserve' });
      }
    });
  }
  
  if (validSlots.length === 0) return null;
  
  // Evaluate each hero in each slot with actual board simulation
  let bestChoice = null;
  let bestPoints = -1;
  
  const enemyBoardFull = [...p1Main, ...Array(Math.max(0, 9 - p1Main.length)).fill(null)];
  const enemyReserve = p1Reserve;
  const allyBoardFull = [...p2Main, ...Array(Math.max(0, 9 - p2Main.length)).fill(null)];
  const allyReserve = p2Reserve;
  
  const choices = [];
  
  availableHeroes.forEach(hero => {
    validSlots.forEach(slot => {
      try {
        const tileIndex = slot.type === 'main' ? slot.index : -1 - slot.index;
        const points = calculateHeroPoints(hero, tileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve);
        
        if (typeof points !== 'number' || isNaN(points)) {
          console.error(`[EasyAI Draft] Invalid points for ${hero.name || hero.id} at ${slot.type}[${slot.index}]:`, points);
          return;
        }
        
        choices.push({
          hero,
          slotIndex: slot.index,
          slotType: slot.type,
          points
        });
      } catch (e) {
        console.error(`[EasyAI Draft] Error evaluating ${hero.name || hero.id} at ${slot.type}[${slot.index}]:`, e);
      }
    });
  });
  
  if (choices.length === 0) {
    console.warn('[EasyAI Draft] No valid choices generated');
    return null;
  }
  
  // Find best points value
  bestPoints = Math.max(...choices.map(c => c.points));
  
  console.log(`[EasyAI Draft] Evaluated ${choices.length} choices, best points: ${bestPoints}`);
  
  // Get all choices with best points (for randomization)
  const bestChoices = choices.filter(c => c.points === bestPoints);
  
  // Pick randomly among ties to avoid clumping
  if (bestChoices.length > 0) {
    bestChoice = bestChoices[Math.floor(Math.random() * bestChoices.length)];
  }
  
  
  return bestChoice;
};

/**
 * Makes a movement decision - move hero to tile with highest points
 * Returns a noop (same source/dest) if no valid improving move is found.
 * @param {Array} p2Board - P2's main board
 * @param {Array} p2ReserveBoard - P2's reserve board
 * @param {Object} movement - Movement hook with phase info
 * @param {Array} p1Board - P1's main board for evaluation
 * @param {Array} p1ReserveBoard - P1's reserve board for evaluation
 * @returns {Object} { sourceId, destinationId } - always returns a valid move (may be noop)
 */
export const makeMovementDecision = (p2Board, p2ReserveBoard, movement, p1Board = [], p1ReserveBoard = []) => {
  const logBossTileEvaluations = (movable, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve) => {
    if (!movable || !movable.hero) return;
    const heroName = movable.hero.name || movable.hero.id || 'Hero';
    if (!movable.hero.isBoss && heroName !== 'Lancer' && movable.hero.id !== 'lancerID') return;
    const tileRef = movable.tile || null;
    const evalRows = [];
    for (let idx = 0; idx < 9; idx++) {
      const row = indexToRow(idx, 'p2');
      const activeRow = row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
      const castsRemaining = (tileRef && tileRef._castsRemaining && typeof tileRef._castsRemaining[activeRow] === 'number')
        ? tileRef._castsRemaining[activeRow]
        : (movable.hero.spells && movable.hero.spells[activeRow] ? movable.hero.spells[activeRow].casts : null);
      const tileValue = calculateTileValue(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, tileRef);
      const incomingDamage = estimateIncomingDamagePerTurn(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve);
      const heroPoints = calculateHeroPoints(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, tileRef);
      evalRows.push({ idx, activeRow, castsRemaining, tileValue, incomingDamage, heroPoints });
    }
    const label = movable.hero.isBoss ? 'BossAI' : 'EasyAI';
    console.log(`[${label}] ${heroName} tile evals:`, evalRows);
  };
  const hasPreventMovement = (tile) => {
    if (!tile) return false;
    const effects = Array.isArray(tile.effects) ? tile.effects : (Array.isArray(tile.hero?.effects) ? tile.hero.effects : []);
    return effects.some(e => e && e.preventMovement);
  };
  const countsTowardMainLimit = (tile) => tile && tile.hero && !tile._dead && !tile._revivedExtra && tile.hero.isMinion !== true;
  // Helper: find first available P2 hero for noop fallback
  const getNoopMove = () => {
    for (let i = 0; i < (p2Board || []).length; i++) {
      if (p2Board[i]?.hero && !p2Board[i]._dead) {
        return { sourceId: `p2:${i}`, destinationId: `p2:${i}` };
      }
    }
    for (let i = 0; i < (p2ReserveBoard || []).length; i++) {
      if (p2ReserveBoard[i]?.hero && !p2ReserveBoard[i]._dead) {
        return { sourceId: `p2Reserve:${i}`, destinationId: `p2Reserve:${i}` };
      }
    }
    // Ultimate fallback - shouldn't happen but return something valid
    return { sourceId: 'p2:0', destinationId: 'p2:0' };
  };

  // Validate movement phase exists and it's P2's turn
  if (!movement || !movement.movementPhase) {
    return getNoopMove();
  }
  
  const phase = movement.movementPhase;
  const currentMover = phase.sequence[phase.index];
  
  if (currentMover !== 'p2') {
    return getNoopMove();
  }
  
  // Get all heroes that can move
  const movableHeroes = [];
  
  (p2Board || []).forEach((tile, idx) => {
    if (tile && tile.hero && !tile._dead && !hasPreventMovement(tile)) {
      movableHeroes.push({
        hero: tile.hero,
        tile: tile, // Include tile for runtime state like _castsRemaining
        sourceId: `p2:${idx}`,
        currentIndex: idx,
        isReserve: false
      });
    }
  });
  
  (p2ReserveBoard || []).forEach((tile, idx) => {
    if (tile && tile.hero && !tile._dead && !hasPreventMovement(tile)) {
      movableHeroes.push({
        hero: tile.hero,
        tile: tile, // Include tile for runtime state like _castsRemaining
        sourceId: `p2Reserve:${idx}`,
        currentIndex: idx,
        isReserve: true
      });
    }
  });
  
  if (movableHeroes.length === 0) {
    return getNoopMove();
  }
  
  // Get all possible destination tiles with proper board padding
  const enemyBoardFull = [...(p1Board || []), ...Array(Math.max(0, 9 - (p1Board?.length || 0))).fill(null)];
  const enemyReserve = p1ReserveBoard || [];
  const allyBoardFull = [...(p2Board || []), ...Array(Math.max(0, 9 - (p2Board?.length || 0))).fill(null)];
  const allyReserve = p2ReserveBoard || [];

  const simulateBoardsForMove = (sourceId, destinationId) => {
    const s = parseToken(sourceId);
    const d = parseToken(destinationId);
    if (!s || !d) return { main: [...(p2Board || [])], reserve: [...(p2ReserveBoard || [])] };

    const main = [...(p2Board || [])];
    const reserve = [...(p2ReserveBoard || [])];

    const srcBoard = s.isReserve ? reserve : main;
    const dstBoard = d.isReserve ? reserve : main;

    const srcTile = srcBoard[s.idx];
    const dstTile = dstBoard[d.idx];

    srcBoard[s.idx] = dstTile;
    dstBoard[d.idx] = srcTile;

    return { main, reserve };
  };

  const calculateTeamPoints = (mainBoard, reserveBoard) => {
    let total = 0;
    (mainBoard || []).forEach((tile, idx) => {
      if (tile && tile.hero && !tile._dead) {
        total += calculateHeroPoints(tile.hero, idx, true, enemyBoardFull, enemyReserve, mainBoard, reserveBoard, tile);
      }
    });
    (reserveBoard || []).forEach((tile, idx) => {
      if (tile && tile.hero && !tile._dead) {
        const reserveTileIndex = -1 - idx;
        total += calculateHeroPoints(tile.hero, reserveTileIndex, true, enemyBoardFull, enemyReserve, mainBoard, reserveBoard, tile);
      }
    });
    return total;
  };

  const currentTeamPoints = calculateTeamPoints(allyBoardFull, allyReserve);

  movableHeroes.forEach(movable => {
    logBossTileEvaluations(movable, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve);
  });
  
  console.log(`[EasyAI Movement] Evaluating ${movableHeroes.length} movable heroes:`, movableHeroes.map(m => `${m.hero.name || m.hero.id}@${m.sourceId}`).join(', '));
  
  // Helper: parse token and legality check
  const parseToken = (token) => {
    if (!token || typeof token !== 'string') return null;
    if (token.startsWith('p2Reserve:')) {
      const idx = Number(token.split(':')[1]);
      return { side: 'p2', isReserve: true, idx };
    }
    if (token.startsWith('p2:')) {
      const idx = Number(token.split(':')[1]);
      return { side: 'p2', isReserve: false, idx };
    }
    return null;
  };

  const isLegalMove = (sourceId, destinationId, logDetails = false) => {
    try {
      const s = parseToken(sourceId);
      const d = parseToken(destinationId);
      if (!s || !d) {
        return false;
      }

      const srcBoard = s.isReserve ? (p2ReserveBoard || []) : (p2Board || []);
      const dstBoard = d.isReserve ? (p2ReserveBoard || []) : (p2Board || []);
      
      const srcTile = srcBoard[s.idx];
      const dstTile = dstBoard[d.idx];

      // Source must exist, have hero, and be alive
      if (!srcTile || !srcTile.hero || srcTile._dead) {
        return false;
      }

      // Respect Shackle/preventMovement on source or destination
      if (hasPreventMovement(srcTile) || hasPreventMovement(dstTile)) {
        return false;
      }

      // Destination index must be valid (within board length)
      if (d.isReserve) {
        if (d.idx < 0 || d.idx >= (p2ReserveBoard || []).length) {
          return false;
        }
      } else {
        if (d.idx < 0 || d.idx >= (p2Board || []).length) {
          return false;
        }
      }

      // If moving from reserve into main, check if it would exceed 5 heroes
      if (s.isReserve && !d.isReserve) {
        // Count current ALIVE heroes on main board
        const mainBoardAlive = (p2Board || []).filter(countsTowardMainLimit).length;
        // Check if destination has a living hero (swap) or is empty/dead (would add to count)
        // A dead tile counts as empty - we can move into it freely
        const destHasLivingHero = countsTowardMainLimit(dstTile);
        
        // If destination has a dead hero or is empty, and we already have 5+ alive heroes, block it
        // If destination has a living hero, this is a swap and doesn't change the count
        if (!destHasLivingHero && mainBoardAlive >= 5) {
          return false;
        }
        // Allow moving into dead/empty slots when we have < 5 heroes
        // (This is already allowed by falling through to return true)
      }

      // All other cases allowed (swapping with occupied tile, moving main->reserve, main->main swap)
      return true;
    } catch (e) {
      return false;
    }
  };

  // Evaluate each hero in each possible position
  const moves = [];
  
  movableHeroes.forEach(movable => {
    // DEBUG: Log which hero is being evaluated for movement
    if (movable.hero && (movable.hero.name?.toLowerCase().includes('lancer') || movable.hero.id === 'lancerID')) {
      console.log(`[EasyAI Movement] Evaluating ${movable.hero.name || movable.hero.id} at ${movable.sourceId} (currentIdx=${movable.currentIndex})`);
    }
    
    const currentTileIndex = movable.isReserve ? -1 - movable.currentIndex : movable.currentIndex;
    const currentPoints = calculateHeroPoints(movable.hero, currentTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
    const currentTileValue = calculateTileValue(movable.hero, currentTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
    
    // Try moving to main board positions
    const mainBoardHeroCount = (p2Board || []).filter(countsTowardMainLimit).length;
    
    (p2Board || []).forEach((tile, idx) => {
      const destId = `p2:${idx}`;
      
      // Skip same tile
      if (destId === movable.sourceId) return;
      
      // Check legality first
      if (!isLegalMove(movable.sourceId, destId)) return;
      
      // If moving from reserve into an empty main slot and there's room, always consider it
      // This is a high-value move since reserves don't contribute to combat
      if (movable.isReserve && (!tile || !tile.hero || tile._dead) && mainBoardHeroCount < 5) {
        const points = calculateHeroPoints(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
        const tileVal = calculateTileValue(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
        const simulated = simulateBoardsForMove(movable.sourceId, destId);
        const teamPoints = calculateTeamPoints(simulated.main, simulated.reserve);
        const teamImprovement = teamPoints - currentTeamPoints;
        // Reserve -> main board is always a big improvement (reserve heroes can't cast)
        const reserveBonus = 50; // Large bonus to prioritize getting reserves on board
        moves.push({
          sourceId: movable.sourceId,
          destinationId: destId,
          points: points + reserveBonus,
          improvement: (points + reserveBonus) - currentPoints,
          tileImprovement: tileVal - currentTileValue,
          teamPoints,
          teamImprovement
        });
        return;
      }

      const points = calculateHeroPoints(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
      const tileVal = calculateTileValue(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
      const simulated = simulateBoardsForMove(movable.sourceId, destId);
      const teamPoints = calculateTeamPoints(simulated.main, simulated.reserve);
      const teamImprovement = teamPoints - currentTeamPoints;

      // Consider moves that increase tile impact (targeting) even if total points improvement is small,
      // or moves that improve overall points by >5%.
      const pointImprovement = points - currentPoints;
      const tileImprovement = tileVal - currentTileValue;
      
      // DEBUG: Log Lancer move evaluations
      if (movable.hero && (movable.hero.name === 'Lancer' || movable.hero.id === 'lancerID' || movable.hero.name?.toLowerCase().includes('lancer'))) {
        console.log(`[EasyAI Movement] ${movable.hero.name || movable.hero.id} ${movable.sourceId} -> ${destId}: currentPts=${currentPoints.toFixed(1)} newPts=${points.toFixed(1)} improvement=${pointImprovement.toFixed(1)} | currentTileVal=${currentTileValue.toFixed(1)} newTileVal=${tileVal.toFixed(1)} tileImprov=${tileImprovement.toFixed(1)} | teamImprov=${teamImprovement.toFixed(1)} threshold=${(currentTeamPoints * 0.01).toFixed(1)} | passesThreshold=${pointImprovement > currentPoints * 0.05 || tileImprovement > 0.1 || teamImprovement > currentTeamPoints * 0.01}`);
      }
      
      if (pointImprovement > currentPoints * 0.05 || tileImprovement > 0.1 || teamImprovement > currentTeamPoints * 0.01) {
        moves.push({
          sourceId: movable.sourceId,
          destinationId: destId,
          points,
          improvement: pointImprovement,
          tileImprovement,
          teamPoints,
          teamImprovement
        });
      }
    });
    
    // Try moving to reserve positions
    (p2ReserveBoard || []).forEach((tile, idx) => {
      const destId = `p2Reserve:${idx}`;
      if (destId === movable.sourceId) return;
      
      // Check legality first
      if (!isLegalMove(movable.sourceId, destId)) return;

      // Avoid subbing heroes off the board into empty reserve slots
      if (!movable.isReserve) {
        const destHasLivingHero = tile && tile.hero && !tile._dead;
        if (!destHasLivingHero) return;
      }
      
      const reserveTileIndex = -1 - idx;
      const points = calculateHeroPoints(movable.hero, reserveTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
      const tileVal = calculateTileValue(movable.hero, reserveTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
      const simulated = simulateBoardsForMove(movable.sourceId, destId);
      const teamPoints = calculateTeamPoints(simulated.main, simulated.reserve);
      const teamImprovement = teamPoints - currentTeamPoints;
      const pointImprovement = points - currentPoints;
      const tileImprovement = tileVal - currentTileValue;

      if (pointImprovement > currentPoints * 0.05 || tileImprovement > 0.1 || teamImprovement > currentTeamPoints * 0.01) {
        moves.push({
          sourceId: movable.sourceId,
          destinationId: destId,
          points,
          improvement: pointImprovement,
          tileImprovement,
          teamPoints,
          teamImprovement
        });
      }
    });
  });

  // Find best legal move
  let bestMove = null;
  if (moves.length > 0) {
    // Sort unique improvements descending
    const improvements = Array.from(new Set(moves.map(m => (typeof m.teamImprovement === 'number' ? m.teamImprovement : m.improvement)))).sort((a, b) => b - a);
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

    outer: for (const imp of improvements) {
      const candidates = shuffle(moves.filter(m => (typeof m.teamImprovement === 'number' ? m.teamImprovement : m.improvement) === imp));
      for (const c of candidates) {
        // Double-check legality before returning with detailed logging
        const legal = isLegalMove(c.sourceId, c.destinationId, true);
        if (legal) {
          bestMove = c;
          break outer;
        }
      }
    }
  }

  // If no improving move found, return a noop (same tile swap)
  if (!bestMove) {
    console.log('[EasyAI Movement] No valid improving moves found, returning noop');
    return getNoopMove();
  }

  console.log(`[EasyAI Movement] Selected move: ${bestMove.sourceId} -> ${bestMove.destinationId} (teamImprovement=${bestMove.teamImprovement?.toFixed(1)}, improvement=${bestMove.improvement?.toFixed(1)})`);
  return bestMove;
};

/**
 * Gets the thinking delay for this AI difficulty (in milliseconds)
 */
export const getThinkingDelay = () => {
  return 800; // 0.8 seconds - slightly faster than super easy
};
