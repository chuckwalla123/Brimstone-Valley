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
import { indexToRow, indexToColumn } from '../targeting.js';

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
function estimateSpellValue(spell, tileIndex, isP2, enemyBoard = [], enemyReserve = [], allyBoard = [], allyReserve = []) {
  if (!spell || !spell.spec) return 0;
  
  const spec = spell.spec;
  const formula = spec.formula || {};
  // Don't default to 1 - utility spells with no damage formula should have 0 baseDamage
  const baseValue = formula.value || 0;
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
  
  const casterPos = getTileInfo(tileIndex);

  const isTileAlive = (tile) => (tile && tile.hero && !tile._dead);
  
  // Helper to get the target column when attacking across boards
  // Per targeting.js: "Columns mirror across boards (P1 col 0 targets P2 col 0, etc.)"
  // This means the SAME column index is targeted - there is no inversion
  const getTargetColumn = (casterCol, targetSide) => {
    // Both cross-board (enemy) and same-board (ally) attacks use the same column index
    return casterCol;
  };
  
  targets.forEach(target => {
    const side = target.side || 'enemy';
    const boardToCheck = side === 'enemy' ? enemyBoard : allyBoard;
    const reserveToCheck = side === 'enemy' ? enemyReserve : allyReserve;
    // Use appropriate tile info getter based on which board we're checking
    const getTileInfoForBoard = side === 'enemy' ? getEnemyTileInfo : getTileInfo;
    
    let affectedTargets = [];
    
    // Get the target column (mirrored for cross-board attacks)
    const targetCol = casterPos.col >= 0 ? getTargetColumn(casterPos.col, side) : -1;
    
    switch (target.type) {
      case 'projectile': {
        // Find enemy in target column (projectile path)
        // Sort by row to find frontmost (row 0 = front)
        if (targetCol >= 0) {
          const tilesInColumn = [];
          for (let i = 0; i < 9; i++) {
            const targetPos = getTileInfoForBoard(i);
            if (targetPos.col === targetCol && isTileAlive(boardToCheck[i])) {
              tilesInColumn.push({ index: i, row: targetPos.row, hero: boardToCheck[i].hero });
            }
          }
          // Projectile hits frontmost target (lowest row number = front)
          if (tilesInColumn.length > 0) {
            tilesInColumn.sort((a, b) => a.row - b.row);
            affectedTargets.push(tilesInColumn[0].hero);
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
          for (let i = 0; i < 9; i++) {
            const targetPos = getTileInfoForBoard(i);
            if (targetPos.col === targetCol && isTileAlive(boardToCheck[i])) {
              affectedTargets.push(boardToCheck[i].hero);
            }
          }
        }
        break;
      }
      
      case 'adjacent': {
        // Adjacent tiles (up, down, left, right) - find by checking each tile's position
        if (casterPos.row >= 0 && casterPos.col >= 0) {
          for (let i = 0; i < 9; i++) {
            const targetPos = getTileInfoForBoard(i);
            const rowDiff = Math.abs(targetPos.row - casterPos.row);
            const colDiff = Math.abs(targetPos.col - casterPos.col);
            // Adjacent means exactly 1 step in row OR col, not both (no diagonals)
            if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
              if (isTileAlive(boardToCheck[i])) {
                affectedTargets.push(boardToCheck[i].hero);
              }
            }
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
              if (hasDebuff) affectedTargets.push(tile.hero);
            } else if (onlyIfHasEffect) {
              const hasRequiredEffect = tileEffects.some(e => e && e.name === onlyIfHasEffect);
              if (hasRequiredEffect) affectedTargets.push(tile.hero);
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
              if (hasDebuff) {
                affectedTargets.push(tile.hero);
              }
              return; // Skip other checks
            }
            
            // Check if spell only applies to targets with a specific effect (like Assassinate requiring Marked)
            const onlyIfHasEffect = spec.post && spec.post.onlyApplyToWithEffect;
            if (onlyIfHasEffect) {
              // Only add target if they have the required effect
              const hasRequiredEffect = tileEffects.some(e => e && e.name === onlyIfHasEffect);
              if (hasRequiredEffect) {
                affectedTargets.push(tile.hero);
              }
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
    
    // Calculate impact based on targets
    affectedTargets.forEach(hero => {
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
        const effectiveDamage = Math.max(0, baseValue - armor);
        totalImpact += effectiveDamage;
      }
    });
    
    // Add value for effects: each effect adds 2 value per target affected
    // This incentivizes the AI to use spells with debuffs/buffs even if damage is lower
    const effects = spec.effects || [];
    if (effects.length > 0 && affectedTargets.length > 0) {
      totalImpact += effects.length * affectedTargets.length * 2;
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
  
  // Determine which row this tile is in to know which spells are active
  // Use proper visual row mapping - indexToRow returns 0=front, 1=middle, 2=back
  const boardSide = isP2 ? 'p2' : 'p1';
  let activeRow = 'middle'; // default for reserve
  if (tileIndex >= 0 && tileIndex <= 8) {
    const row = indexToRow(tileIndex, boardSide);
    if (row === 0) activeRow = 'front';
    else if (row === 1) activeRow = 'middle';
    else if (row === 2) activeRow = 'back';
  }
  
  const speed = hero.speed || 1;
  let totalSpellValue = 0;
  
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
      ? tile._castsRemaining[position]
      : spellData.casts;
    if (castsRemaining === 0) return;

    const spell = getSpellById(spellId);
    if (!spell) return;
    
    hasValidSpell = true;

    const cost = spellData.cost || 1;

    // Simulate casting from this specific position
    const spellImpact = estimateSpellValue(spell, tileIndex, isP2, enemyBoard, enemyReserve, allyBoard, allyReserve);

    // Compute per-turn impact: (spell damage per cast) × (speed / cost)
    // This represents how much damage/turn this spell contributes
    const perTurnImpact = spellImpact * (speed / cost);

    // Sum all spell contributions (don't average - a hero with more spells is more versatile)
    totalSpellValue += perTurnImpact;
  });
  
  // If no valid spell for this row, the hero can only do basic attacks
  // Basic attack does 1 damage per turn (consumes all energy)
  if (!hasValidSpell) {
    return 1; // Basic attack only
  }
  
  // Add basic attack as fallback value (in case spell has no targets)
  const basicAttackValue = 1;
  
  return totalSpellValue + basicAttackValue;
}

/**
 * Calculate total hero points for a hero in a given tile
 * Hero Points = Effective_Combat_Value + (Tile_Value × Expected_Turns_Alive)
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
  
  // Expected turns alive = ECV / 4
  const expectedTurnsAlive = ecv / 4;
  
  // Tile contribution weighted by survival expectation
  const tileContribution = tileValue * expectedTurnsAlive;
  
  return ecv + tileContribution;
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
      const tileIndex = slot.type === 'main' ? slot.index : -1 - slot.index;
      const points = calculateHeroPoints(hero, tileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve);
      
      choices.push({
        hero,
        slotIndex: slot.index,
        slotType: slot.type,
        points
      });
    });
  });
  
  // Find best points value
  bestPoints = Math.max(...choices.map(c => c.points));
  
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
    console.log('[EasyAI] No movement phase, returning noop');
    return getNoopMove();
  }
  
  const phase = movement.movementPhase;
  const currentMover = phase.sequence[phase.index];
  
  if (currentMover !== 'p2') {
    console.log('[EasyAI] Not P2 turn, returning noop');
    return getNoopMove();
  }
  
  // Get all heroes that can move
  const movableHeroes = [];
  
  (p2Board || []).forEach((tile, idx) => {
    if (tile && tile.hero && !tile._dead) {
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
    if (tile && tile.hero && !tile._dead) {
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
    console.log('[EasyAI] No movable heroes, returning noop');
    return getNoopMove();
  }
  
  // Get all possible destination tiles with proper board padding
  const enemyBoardFull = [...(p1Board || []), ...Array(Math.max(0, 9 - (p1Board?.length || 0))).fill(null)];
  const enemyReserve = p1ReserveBoard || [];
  const allyBoardFull = [...(p2Board || []), ...Array(Math.max(0, 9 - (p2Board?.length || 0))).fill(null)];
  const allyReserve = p2ReserveBoard || [];
  
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
        if (logDetails) console.log('[EasyAI] isLegalMove: invalid tokens', sourceId, destinationId);
        return false;
      }

      const srcBoard = s.isReserve ? (p2ReserveBoard || []) : (p2Board || []);
      const dstBoard = d.isReserve ? (p2ReserveBoard || []) : (p2Board || []);
      
      const srcTile = srcBoard[s.idx];
      const dstTile = dstBoard[d.idx];

      // Source must exist, have hero, and be alive
      if (!srcTile || !srcTile.hero || srcTile._dead) {
        if (logDetails) console.log('[EasyAI] isLegalMove: source invalid', { srcTile, hasHero: srcTile?.hero, isDead: srcTile?._dead });
        return false;
      }

      // Destination index must be valid (within board length)
      if (d.isReserve) {
        if (d.idx < 0 || d.idx >= (p2ReserveBoard || []).length) {
          if (logDetails) console.log('[EasyAI] isLegalMove: reserve dest out of bounds');
          return false;
        }
      } else {
        if (d.idx < 0 || d.idx >= (p2Board || []).length) {
          if (logDetails) console.log('[EasyAI] isLegalMove: main dest out of bounds');
          return false;
        }
      }

      // If moving from reserve into main, check if it would exceed 5 heroes
      if (s.isReserve && !d.isReserve) {
        // Count current ALIVE heroes on main board
        const mainBoardAlive = (p2Board || []).filter(t => t && t.hero && !t._dead).length;
        // Check if destination has a living hero (swap) or is empty/dead (would add to count)
        // A dead tile counts as empty - we can move into it freely
        const destHasLivingHero = dstTile && dstTile.hero && !dstTile._dead;
        
        if (logDetails) {
          console.log('[EasyAI] isLegalMove: reserve->main check', {
            mainBoardAlive,
            destHasLivingHero,
            dstTile: dstTile ? { hero: dstTile.hero?.name, _dead: dstTile._dead } : null
          });
        }
        
        // If destination has a dead hero or is empty, and we already have 5+ alive heroes, block it
        // If destination has a living hero, this is a swap and doesn't change the count
        if (!destHasLivingHero && mainBoardAlive >= 5) {
          if (logDetails) console.log('[EasyAI] isLegalMove: BLOCKED - would exceed 5 heroes on main');
          return false;
        }
        // Allow moving into dead/empty slots when we have < 5 heroes
        // (This is already allowed by falling through to return true)
      }

      // All other cases allowed (swapping with occupied tile, moving main->reserve, main->main swap)
      return true;
    } catch (e) {
      console.log('[EasyAI] isLegalMove error:', e);
      return false;
    }
  };

  // Evaluate each hero in each possible position
  const moves = [];
  
  movableHeroes.forEach(movable => {
    const currentTileIndex = movable.isReserve ? -1 - movable.currentIndex : movable.currentIndex;
    const currentPoints = calculateHeroPoints(movable.hero, currentTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
    const currentTileValue = calculateTileValue(movable.hero, currentTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
    
    // Try moving to main board positions
    const mainBoardHeroCount = (p2Board || []).filter(t => t && t.hero && !t._dead).length;
    
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
        // Reserve -> main board is always a big improvement (reserve heroes can't cast)
        const reserveBonus = 50; // Large bonus to prioritize getting reserves on board
        moves.push({ sourceId: movable.sourceId, destinationId: destId, points: points + reserveBonus, improvement: (points + reserveBonus) - currentPoints, tileImprovement: tileVal - currentTileValue });
        return;
      }

      const points = calculateHeroPoints(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
      const tileVal = calculateTileValue(movable.hero, idx, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);

      // Consider moves that increase tile impact (targeting) even if total points improvement is small,
      // or moves that improve overall points by >5%.
      const pointImprovement = points - currentPoints;
      const tileImprovement = tileVal - currentTileValue;
      if (pointImprovement > currentPoints * 0.05 || tileImprovement > 0.1) {
        moves.push({
          sourceId: movable.sourceId,
          destinationId: destId,
          points,
          improvement: pointImprovement,
          tileImprovement
        });
      }
    });
    
    // Try moving to reserve positions
    (p2ReserveBoard || []).forEach((tile, idx) => {
      const destId = `p2Reserve:${idx}`;
      if (destId === movable.sourceId) return;
      
      // Check legality first
      if (!isLegalMove(movable.sourceId, destId)) return;
      
      const reserveTileIndex = -1 - idx;
      const points = calculateHeroPoints(movable.hero, reserveTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
      const tileVal = calculateTileValue(movable.hero, reserveTileIndex, true, enemyBoardFull, enemyReserve, allyBoardFull, allyReserve, movable.tile);
      const pointImprovement = points - currentPoints;
      const tileImprovement = tileVal - currentTileValue;

      if (pointImprovement > currentPoints * 0.05 || tileImprovement > 0.1) {
        moves.push({
          sourceId: movable.sourceId,
          destinationId: destId,
          points,
          improvement: pointImprovement,
          tileImprovement
        });
      }
    });
  });

  // Find best legal move
  let bestMove = null;
  if (moves.length > 0) {
    // Sort unique improvements descending
    const improvements = Array.from(new Set(moves.map(m => m.improvement))).sort((a, b) => b - a);
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

    // Log current board state for debugging
    const mainBoardAlive = (p2Board || []).filter(t => t && t.hero && !t._dead).length;
    const reserveAlive = (p2ReserveBoard || []).filter(t => t && t.hero && !t._dead).length;
    console.log('[EasyAI] Board state: main=' + mainBoardAlive + ' alive, reserve=' + reserveAlive + ' alive');

    outer: for (const imp of improvements) {
      const candidates = shuffle(moves.filter(m => m.improvement === imp));
      for (const c of candidates) {
        // Double-check legality before returning with detailed logging
        const legal = isLegalMove(c.sourceId, c.destinationId, true);
        if (legal) {
          bestMove = c;
          break outer;
        } else {
          console.log('[EasyAI] Candidate rejected as illegal:', c.sourceId, '->', c.destinationId);
        }
      }
    }
  }

  // If no improving move found, return a noop (same tile swap)
  if (!bestMove) {
    console.log('[EasyAI] No improving move found, returning noop');
    return getNoopMove();
  }

  console.log('[EasyAI] Returning move:', bestMove.sourceId, '->', bestMove.destinationId);
  return bestMove;
};

/**
 * Gets the thinking delay for this AI difficulty (in milliseconds)
 */
export const getThinkingDelay = () => {
  return 800; // 0.8 seconds - slightly faster than super easy
};
