// src/targeting.js
// Utilities to resolve high-level target descriptors (from spell specs)

/*
 * ==================== BOARD LAYOUT REFERENCE ====================
 * Each board is a 3x3 grid stored as a flat array [0..8]:
 *
 *   P1 Board        P2 Board
 *   [0, 1, 2]       [0, 1, 2]
 *   [3, 4, 5]       [3, 4, 5]
 *   [6, 7, 8]       [6, 7, 8]
 *
 * ROW DEFINITIONS (front/middle/back are relative to each player):
 *   P1: Front = [2,5,8], Middle = [1,4,7], Back = [0,3,6]
 *   P2: Front = [0,3,6], Middle = [1,4,7], Back = [2,5,8]
 *
 * COLUMN DEFINITIONS (vertical slices):
 *   Column 0 = [0,1,2], Column 1 = [3,4,5], Column 2 = [6,7,8]
 *
 * PROJECTILE/COLUMN TARGETING:
 *   - Columns mirror across boards (P1 col 0 targets P2 col 0, etc.)
 *   - Example: P1 casting from column [0,1,2] targets P2's [0,1,2]
 *   - Column attacks hit all 3 tiles in the target column
 *   - Projectiles hit front-most occupied tile first (P2: 0, then 1, then 2)
 *
 * VISUAL NOTE: The boards face each other, so P1's front (2,5,8) is
 * closest to P2's front (0,3,6).
 * ================================================================
 */

// Visual mapping between array index (0..8) and tile numbers (1..9) used by the UI
const P1_INDEX_TO_TILE = [7,4,1,8,5,2,9,6,3];
const P2_INDEX_TO_TILE = [3,6,9,2,5,8,1,4,7];
// P3 faces upward (front is top row)
const P3_INDEX_TO_TILE = [1,2,3,4,5,6,7,8,9];

// Book-order (tile-number) priority per side for tie breaks.
const BOOK_ORDER_P1 = [2,5,8,1,4,7,0,3,6];
const BOOK_ORDER_P2 = [6,3,0,7,4,1,8,5,2];
const BOOK_ORDER_P3 = [0,1,2,3,4,5,6,7,8];
const getBookOrder = (side) => (side === 'p2' ? BOOK_ORDER_P2 : (side === 'p3' ? BOOK_ORDER_P3 : BOOK_ORDER_P1));

const buildTileToIndex = (map) => {
  const inv = {};
  for (let i = 0; i < map.length; i++) {
    const tileNum = map[i];
    if (tileNum != null) inv[tileNum] = i;
  }
  return inv;
};

const P1_TILE_TO_INDEX = buildTileToIndex(P1_INDEX_TO_TILE);
const P2_TILE_TO_INDEX = buildTileToIndex(P2_INDEX_TO_TILE);
const P3_TILE_TO_INDEX = buildTileToIndex(P3_INDEX_TO_TILE);

export function indexToTileNumber(index, boardName = 'p1') {
  const idx = Number(index || 0);
  if (boardName && boardName.startsWith('p2')) return P2_INDEX_TO_TILE[idx] || 0;
  if (boardName && boardName.startsWith('p3')) return P3_INDEX_TO_TILE[idx] || 0;
  return P1_INDEX_TO_TILE[idx] || 0;
}

export function tileNumberToIndex(tileNumber, boardName = 'p1') {
  const num = Number(tileNumber || 0);
  if (!num) return 0;
  const map = (boardName && boardName.startsWith('p2'))
    ? P2_TILE_TO_INDEX
    : (boardName && boardName.startsWith('p3'))
      ? P3_TILE_TO_INDEX
      : P1_TILE_TO_INDEX;
  return (typeof map[num] === 'number') ? map[num] : 0;
}

// Convert tower UI position (row-major 0..8) into engine index (0..8)
// Tower UI uses rows: 0=back, 1=middle, 2=front; cols: 0=left,1=middle,2=right
export function towerPositionToIndex(position, boardName = 'p1') {
  if (position == null) return null;
  const pos = Number(position);
  if (Number.isNaN(pos) || pos < 0 || pos > 8) return null;
  const row = Math.floor(pos / 3);
  const col = pos % 3;
  const tileNumber = (2 - row) * 3 + (col + 1); // back row -> 7..9, front row -> 1..3
  return tileNumberToIndex(tileNumber, boardName);
}

// Convert battle index (0..8) into tower UI position (row-major 0..8)
export function indexToTowerPosition(index, boardName = 'p1') {
  if (index == null) return null;
  const idx = Number(index);
  if (Number.isNaN(idx) || idx < 0 || idx > 8) return null;
  const tileNumber = indexToTileNumber(idx, boardName);
  if (!tileNumber) return null;
  const row = Math.floor((tileNumber - 1) / 3); // 0=front,1=middle,2=back
  const col = (tileNumber - 1) % 3;
  const towerRow = 2 - row; // 0=back,1=middle,2=front
  return towerRow * 3 + col;
}

export function indexToColumn(index, boardName = 'p1') {
  const tileNum = indexToTileNumber(index, boardName);
  if (!tileNum) return 0;
  return ((tileNum - 1) % 3 + 3) % 3; // 0=left,1=middle,2=right
}

export function indexToRow(index, boardName = 'p1') {
  const tileNum = indexToTileNumber(index, boardName);
  if (!tileNum) return 0;
  return Math.floor((tileNum - 1) / 3); // 0=front,1=middle,2=back
}

function indexToVisualColumn(index) {
  const idx = Number(index || 0);
  return ((idx % 3) + 3) % 3;
}

function indexToVisualRow(index) {
  const idx = Number(index || 0);
  return Math.floor(idx / 3);
}

function indexToVisualGlobalX(index, boardName = 'p1') {
  const col = indexToVisualColumn(index);
  if (boardName === 'p2') return col + 3;
  if (boardName === 'p3') return col + 6;
  return col;
}

// Return the array indices on a given board that belong to the visual column (0..2)
export function columnIndicesForBoard(col, boardSide = 'p1') {
  const out = [];
  const map = (boardSide === 'p2') ? P2_INDEX_TO_TILE : (boardSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
  for (let i = 0; i < map.length; i++) {
    const tileNum = map[i];
    if (((tileNum - 1) % 3 + 3) % 3 === col) out.push(i);
  }
  // Ensure returned indices are in visual front->middle->back order by sorting
  // ascending by the visual tile number (1..9). This makes column attacks
  // traverse front->middle->back when resolving targets.
  out.sort((a, b) => (map[a] || 0) - (map[b] || 0));
  return out;
}

// helper: treat a slot as occupied only if it has a hero and is not marked dead
function isOccupiedAndAlive(slot) {
  if (!slot || !slot.hero) return false;
  if (slot._dead) return false;
  return true;
}

function getVisibleEffects(slot) {
  if (!slot || !Array.isArray(slot.effects)) return [];
  return slot.effects.filter(e => e && !e._hidden);
}

// helper: return true if a slot has an effect that prevents single-target spells
function isProtectedFromSingleTarget(slot) {
  try {
    if (!slot) return false;
    const effects = Array.isArray(slot.effects) ? slot.effects : [];
    const passives = Array.isArray(slot._passives) ? slot._passives : (slot.hero && Array.isArray(slot.hero.passives) ? slot.hero.passives : []);
    return [...effects, ...passives].some(e => e && e.preventSingleTarget);
  } catch (e) { return false; }
}

// helper: return true if a slot has Taunt
function hasTaunt(slot) {
  try {
    if (!slot) return false;
    const effects = Array.isArray(slot.effects) ? slot.effects : [];
    const passives = Array.isArray(slot._passives) ? slot._passives : (slot.hero && Array.isArray(slot.hero.passives) ? slot.hero.passives : []);
    return [...effects, ...passives].some(e => e && (e.taunt || e.name === 'Taunt'));
  } catch (e) { return false; }
}

// helper: return true if a slot forces multi-target enemy spells to target only it
function hasMultiTargetRedirect(slot) {
  try {
    if (!slot) return false;
    const effects = Array.isArray(slot.effects) ? slot.effects : [];
    const passives = Array.isArray(slot._passives) ? slot._passives : (slot.hero && Array.isArray(slot.hero.passives) ? slot.hero.passives : []);
    return [...effects, ...passives].some(e => e && (e.forceMultiTargetToSelf || e.name === 'Protective Growth'));
  } catch (e) { return false; }
}

// helper: return true if caster has a flag effect (e.g., Subjugation)
function casterHasEffectFlag(casterRef, flagName) {
  try {
    const tile = casterRef && casterRef.tile ? casterRef.tile : null;
    if (!tile) return false;
    const effects = Array.isArray(tile.effects) ? tile.effects : [];
    const passives = Array.isArray(tile._passives) ? tile._passives : (tile.hero && Array.isArray(tile.hero.passives) ? tile.hero.passives : []);
    return [...effects, ...passives].some(e => e && (e[flagName] || e.name === 'Subjugation'));
  } catch (e) { return false; }
}

function getTauntTargets(boardArr = [], boardSide = 'p1') {
  const map = boardSide === 'p2' ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
  const out = [];
  for (let i = 0; i < (boardArr || []).length; i++) {
    const slot = (boardArr || [])[i];
    if (isOccupiedAndAlive(slot) && hasTaunt(slot)) out.push(i);
  }
  out.sort((a, b) => (map[a] || 0) - (map[b] || 0));
  return out;
}

function getMultiTargetRedirectTargets(boardArr = [], boardSide = 'p1') {
  const map = boardSide === 'p2' ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
  const out = [];
  for (let i = 0; i < (boardArr || []).length; i++) {
    const slot = (boardArr || [])[i];
    if (isOccupiedAndAlive(slot) && hasMultiTargetRedirect(slot)) out.push(i);
  }
  out.sort((a, b) => (map[a] || 0) - (map[b] || 0));
  return out;
}

function getSingleTargetRedirectTarget(slot, boardArr = [], boardSide = 'p1') {
  try {
    if (!slot) return null;
    const effects = Array.isArray(slot.effects) ? slot.effects : [];
    const passives = Array.isArray(slot._passives) ? slot._passives : (slot.hero && Array.isArray(slot.hero.passives) ? slot.hero.passives : []);
    const all = [...effects, ...passives];

    for (const effect of all) {
      if (!effect) continue;
      if (!(effect.redirectSingleTargetToEffectApplier || effect.name === 'Loyalty')) continue;

      const normalizedAppliedBoard = (effect.appliedByBoardName && String(effect.appliedByBoardName).startsWith('p1'))
        ? 'p1'
        : (effect.appliedByBoardName && String(effect.appliedByBoardName).startsWith('p2'))
          ? 'p2'
          : (effect.appliedByBoardName && String(effect.appliedByBoardName).startsWith('p3'))
            ? 'p3'
            : null;

      let redirectIdx = null;

      // Prefer the exact applier hero instance id since board indices can change
      // after movement/swaps between rounds.
      if (effect.appliedByHeroInstanceId) {
        const foundByInstance = (boardArr || []).findIndex(t =>
          isOccupiedAndAlive(t) && t.hero && t.hero._instanceId === effect.appliedByHeroInstanceId
        );
        if (foundByInstance >= 0) redirectIdx = foundByInstance;
      }

      // Next best: only trust appliedByIndex if it still points to the same applier
      // (matching instance id or hero id when available).
      if (redirectIdx == null && normalizedAppliedBoard === boardSide && typeof effect.appliedByIndex === 'number') {
        const idx = Number(effect.appliedByIndex);
        const indexedSlot = (boardArr || [])[idx];
        const matchesInstance = !!(effect.appliedByHeroInstanceId && indexedSlot && indexedSlot.hero && indexedSlot.hero._instanceId === effect.appliedByHeroInstanceId);
        const matchesHeroId = !!(effect.appliedByHeroId && indexedSlot && indexedSlot.hero && indexedSlot.hero.id === effect.appliedByHeroId);
        const hasNoIdentityHints = !effect.appliedByHeroInstanceId && !effect.appliedByHeroId;
        if (isOccupiedAndAlive(indexedSlot) && (matchesInstance || matchesHeroId || hasNoIdentityHints)) {
          redirectIdx = idx;
        }
      }

      if (redirectIdx == null && effect.appliedByHeroId) {
        const foundByHeroId = (boardArr || []).findIndex(t =>
          isOccupiedAndAlive(t) && t.hero && t.hero.id === effect.appliedByHeroId
        );
        if (foundByHeroId >= 0) redirectIdx = foundByHeroId;
      }

      if (typeof redirectIdx === 'number' && redirectIdx >= 0) {
        const redirectSlot = (boardArr || [])[redirectIdx];
        if (!isOccupiedAndAlive(redirectSlot)) return null;
        if (isProtectedFromSingleTarget(redirectSlot)) return null;
        return { board: boardSide, index: redirectIdx };
      }
    }
  } catch (e) {}
  return null;
}

// boards: { p1Board, p2Board, p1Reserve, p2Reserve }
// options: { bypassTriggers: boolean } - if true, skip preventSingleTarget checks (e.g., basicAttack)
export function resolveTargets(targetDescriptors = [], casterRef = {}, boards = {}, ownerRef = null, options = {}) {
  const out = [];
  const { p1Board = [], p2Board = [], p3Board = [], p1Reserve = [], p2Reserve = [], p3Reserve = [] } = boards;

  const casterSide = (casterRef.boardName && casterRef.boardName.startsWith('p1'))
    ? 'p1'
    : (casterRef.boardName && casterRef.boardName.startsWith('p2'))
      ? 'p2'
      : 'p3';
  const forceEnemySide = options && options.forceEnemySide ? options.forceEnemySide : null;
  const forceAllySide = options && options.forceAllySide ? options.forceAllySide : null;
  const resolveSide = (side) => {
    if (side === 'ally') return forceAllySide || casterSide;
    if (side === 'enemy') {
      if (forceEnemySide) return forceEnemySide;
      if (casterSide === 'p1') return 'p2';
      if (casterSide === 'p2') return 'p1';
      return 'p1';
    }
    return null;
  };
  const getBoardArr = (sideKey) => {
    if (sideKey === 'p1') return p1Board;
    if (sideKey === 'p2') return p2Board;
    if (sideKey === 'p3') return p3Board;
    return null;
  };

  // Determine whether this spell can potentially hit multiple ENEMY targets based on its descriptors.
  // Ally/self targets (e.g., Siphon's self-heal) should not make the spell bypass preventSingleTarget.
  const enemyDescriptorsForMulti = (targetDescriptors || []).filter(d => d && d.type !== 'self' && (d.side || 'enemy') === 'enemy');
  const enemyIndependentDescriptors = (enemyDescriptorsForMulti || []).filter(d => d && d.type !== 'lastResolvedTarget');
  const isPotentiallyMultiTarget = (enemyIndependentDescriptors && Array.isArray(enemyIndependentDescriptors)) ? (
    enemyIndependentDescriptors.length > 1 || enemyIndependentDescriptors.some(d => ['board','column','adjacent','nearestToLastTarget','projectilePlus1','frontTwoRows','middleRow','backRow','frontmostRowWithHero','backmostRowWithHero','rowWithHighestSumArmor','rowContainingHighestArmor','rowContainingLowestArmor','rowWithMostHeroes','cornerTiles'].includes(d.type))
  ) : false;

  const enemyDescriptors = (targetDescriptors || []).filter(d => d && (d.side || 'enemy') === 'enemy' && d.type !== 'self');
  const enemyHasMulti = enemyDescriptors.some(d =>
    ['board','column','adjacent','nearestToLastTarget','projectilePlus1','frontTwoRows','backRow','rowWithHighestSumArmor','rowContainingLowestArmor','rowWithMostHeroes','frontmostRowWithHero','backmostRowWithHero','middleRow','cornerTiles'].includes(d.type)
      || (typeof d.max === 'number' && d.max > 1)
  );
  const hasSingleEnemyTarget = enemyDescriptors.length === 1 && !enemyHasMulti;
  const casterForcesLowestArmor = casterHasEffectFlag(casterRef, 'forceSingleTargetLowestArmor');
  
  // If bypassTriggers is set (e.g., basicAttack), skip all preventSingleTarget checks
  const bypassTriggers = !!(options && options.bypassTriggers);

  const multiTargetRedirect = (() => {
    if (bypassTriggers || !enemyHasMulti) return null;
    const targetSide = resolveSide('enemy') || casterSide;
    const boardArr = getBoardArr(targetSide) || [];
    const redirectTargets = getMultiTargetRedirectTargets(boardArr, targetSide);
    if (redirectTargets.length === 0) return null;
    return { board: targetSide, index: redirectTargets[0], _used: false };
  })();

  const pushToken = (boardName, idx, descLocal) => {
    // Skip caster if descriptor requests excluding self; accept an explicit descriptor so this
    // function doesn't rely on an out-of-scope `desc` variable.
    const localDesc = descLocal || null;
    if (localDesc && localDesc.excludeSelf && casterRef && typeof casterRef.index === 'number' && casterRef.boardName) {
      const casterBoard = casterSide;
      const b = (boardName === 'p1Board' || boardName === 'p1') ? 'p1' : (boardName === 'p2Board' || boardName === 'p2' ? 'p2' : (boardName === 'p3Board' || boardName === 'p3' ? 'p3' : null));
      if (b === casterBoard && idx === casterRef.index) return;
    }

    // If the spell is single-target (not potentially multi-target), respect effects that prevent single-target targeting
    // Unless bypassTriggers is set (e.g., basicAttack bypasses all effect triggers including preventSingleTarget)
    try {
      if (!isPotentiallyMultiTarget && !bypassTriggers) {
        const b = (boardName === 'p1Board' || boardName === 'p1') ? 'p1' : (boardName === 'p2Board' || boardName === 'p2' ? 'p2' : 'p3');
        const boardArr = getBoardArr(b);
        const slot = boardArr && boardArr[idx];
        if (slot && isProtectedFromSingleTarget(slot)) return; // skip pushing this token as it's protected against single-target spells
      }
    } catch (e) {}

    // normalize to simple token object { board: 'p1'|'p2', index }
    if (boardName === 'p1Board' || boardName === 'p1') out.push({ board: 'p1', index: idx });
    else if (boardName === 'p2Board' || boardName === 'p2') out.push({ board: 'p2', index: idx });
    else if (boardName === 'p3Board' || boardName === 'p3') out.push({ board: 'p3', index: idx });
  }; 

  for (const desc of targetDescriptors) {
    if (!desc) continue;
    let type = desc.type || 'projectile';
    const side = desc.side || 'enemy';

    if (side === 'enemy' && multiTargetRedirect && type !== 'self') {
      if (!multiTargetRedirect._used) {
        out.push({ board: multiTargetRedirect.board, index: multiTargetRedirect.index });
        multiTargetRedirect._used = true;
      }
      continue;
    }

    if (!bypassTriggers && side === 'enemy' && hasSingleEnemyTarget && type !== 'self') {
      const targetSide = resolveSide('enemy') || casterSide;
      const targetBoardArr = getBoardArr(targetSide) || [];
      const tauntTargets = getTauntTargets(targetBoardArr, targetSide);
      if (tauntTargets.length > 0) {
        const tauntIdx = tauntTargets[0];
        if (isOccupiedAndAlive((targetBoardArr || [])[tauntIdx])) {
          out.push({ board: targetSide, index: tauntIdx });
        }
        continue;
      }
    }

    // Subjugation: force single-target spells to target lowest Armor
    if (!bypassTriggers && casterForcesLowestArmor && !isPotentiallyMultiTarget && type !== 'self') {
      type = 'leastArmor';
    }

    if (type === 'self') {
      if (casterRef.boardName && casterRef.index != null) {
        const b = casterSide;
        out.push({ board: b, index: casterRef.index });
      }
      continue;
    }

    if (type === 'lastResolvedTarget') {
      // Reuse the exact most-recently-resolved target token.
      // Useful for effects like "hit the same target twice".
      const anchor = out.length ? out[out.length - 1] : null;
      if (!anchor) continue;
      pushToken(anchor.board, Number(anchor.index || 0), desc);
      continue;
    }

    if (type === 'board') {
      // all allies or enemies on the board (only occupied alive tiles)
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const order = getBookOrder(targetSide);
      for (const i of order) {
        const slot = (boardArr || [])[i];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: i });
      }
      continue;
    }

    if (type === 'column') {
      // choose explicit descriptor column when provided; otherwise derive from caster index
      const casterBoard = casterSide;
      let col = (desc.col != null)
        ? Number(desc.col)
        : ((casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : 0);
      // target side: ally or enemy relative to caster
      const targetSide = resolveSide(side) || casterSide;
      // When targeting enemies, prefer the mirrored visual column so a caster on the left
      // of their board aims at the right column of the opposing board (and vice-versa).
      if (side === 'enemy') {
        col = 2 - col;
      }
      const indices = columnIndicesForBoard(col, targetSide);
        // Only include occupied (alive) tiles in the column — empty slots should cause the column
        // attack to skip that position rather than hitting nothing. Preserve visual ordering (front->middle->back).
        for (const idx of indices) {
          const slot = (getBoardArr(targetSide) || [])[idx];
          if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
        }
      continue;
    }

    if (type === 'frontmostRowWithHero') {
      // Choose the first enemy row (front -> middle -> back) that has at least one occupied alive tile
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Rows in front-to-back order: 0 (front), 1 (middle), 2 (back)
      for (let row = 0; row <= 2; row++) {
        const rowIndices = [];
        for (let i = 0; i < (boardArr || []).length; i++) {
          if (indexToRow(i, targetSide) === row) rowIndices.push(i);
        }
        // Sort left->right using visual column mapping
        rowIndices.sort((a, b) => indexToColumn(a, targetSide) - indexToColumn(b, targetSide));
        // If any occupied tile in this row, include occupied tiles in visual left->right order
        const occupiedInRow = rowIndices.some(idx => isOccupiedAndAlive((boardArr || [])[idx]));
        if (occupiedInRow) {
          for (const idx of rowIndices) {
            const slot = (boardArr || [])[idx];
            if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
          }
          break;
        }
      }
      continue;
    }

    if (type === 'backmostRowWithHero') {
      // Choose the first row in back-to-front order that has at least one occupied alive tile
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      for (let row = 2; row >= 0; row--) {
        const rowIndices = [];
        for (let i = 0; i < (boardArr || []).length; i++) {
          if (indexToRow(i, targetSide) === row) rowIndices.push(i);
        }
        rowIndices.sort((a, b) => indexToColumn(a, targetSide) - indexToColumn(b, targetSide));
        const occupiedInRow = rowIndices.some(idx => isOccupiedAndAlive((boardArr || [])[idx]));
        if (occupiedInRow) {
          for (const idx of rowIndices) {
            const slot = (boardArr || [])[idx];
            if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
          }
          break;
        }
      }
      continue;
    }

    // New: frontTwoRows — include visual front row (row 0) left->right, then middle row (row 1) left->right
    if (type === 'frontTwoRows') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
      const frontIndices = [];
      const middleIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        const row = Math.floor((tileNum - 1) / 3);
        if (row === 0) frontIndices.push(i);
        else if (row === 1) middleIndices.push(i);
      }
      frontIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));
      middleIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));
      const ordered = frontIndices.concat(middleIndices);
      for (const idx of ordered) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'backRow') {
      // Choose the back row (visual row index 2) on the target side and include occupied tiles
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === 2) rowIndices.push(i);
      }
      rowIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));
      for (const idx of rowIndices) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'middleRow') {
      // Choose the middle row (visual row index 1) on the target side and include occupied tiles
      // Optionally skip a specific column via descriptor `excludeColumn`.
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
      const rowIndices = [];
      const excludedCol = (typeof desc.excludeColumn === 'number') ? Number(desc.excludeColumn) : null;
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) !== 1) continue;
        if (excludedCol != null && indexToColumn(i, targetSide) === excludedCol) continue;
        rowIndices.push(i);
      }
      rowIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));
      for (const idx of rowIndices) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'cornerTiles') {
      // Choose the four corner tiles (front-left, front-right, back-left, back-right)
      // on the target side and include only occupied alive tiles.
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
      const cornerIndices = [];
      for (let i = 0; i < map.length; i++) {
        const row = indexToRow(i, targetSide);
        const col = indexToColumn(i, targetSide);
        if ((row === 0 || row === 2) && (col === 0 || col === 2)) cornerIndices.push(i);
      }
      cornerIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));
      for (const idx of cornerIndices) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'adjacent') {
      // Choose tiles adjacent (up/down/left/right) to the most-recently-resolved target.
      // Anchor to the last appended token in `out` (the primary target).
      const anchor = out.length ? out[out.length - 1] : null;
      if (!anchor) continue;
      const anchorBoard = anchor.board;
      const anchorIdx = Number(anchor.index || 0);
      const anchorRow = indexToRow(anchorIdx, anchorBoard);
      const anchorCol = indexToColumn(anchorIdx, anchorBoard);
      const targetSide = anchorBoard === 'p1' ? 'p1' : (anchorBoard === 'p2' ? 'p2' : 'p3');
      const boardArr = getBoardArr(targetSide) || [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const r = indexToRow(i, targetSide);
        const c = indexToColumn(i, targetSide);
        const manhattan = Math.abs(r - anchorRow) + Math.abs(c - anchorCol);
        if (manhattan === 1) {
          const slot = (boardArr || [])[i];
          if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: i });
        }
      }
      continue;
    }

    if (type === 'nearestToLastTarget') {
      // Choose the nearest occupied living tile to the most-recently-resolved target.
      const anchor = out.length ? out[out.length - 1] : null;
      if (!anchor) continue;
      const anchorBoard = anchor.board;
      const anchorIdx = Number(anchor.index || 0);
      const targetSide = anchorBoard === 'p1' ? 'p1' : (anchorBoard === 'p2' ? 'p2' : 'p3');
      const boardArr = getBoardArr(targetSide) || [];
      const anchorRow = indexToRow(anchorIdx, targetSide);
      const anchorCol = indexToColumn(anchorIdx, targetSide);
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const slot = (boardArr || [])[i];
        if (!isOccupiedAndAlive(slot)) continue;
        const r = indexToRow(i, targetSide);
        const c = indexToColumn(i, targetSide);
        const dist = Math.abs(r - anchorRow) + Math.abs(c - anchorCol);
        candidates.push({ index: i, dist });
      }
      if (candidates.length === 0) continue;
      const order = getBookOrder(targetSide);
      const priority = {}; order.forEach((v, i) => { priority[v] = i; });
      candidates.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });
      out.push({ board: targetSide, index: candidates[0].index });
      continue;
    }

    if (type === 'adjacentToSelf') {
      // Choose tiles adjacent to the effect owner (or caster if no owner) on the specified side.
      // This is used for effects like Static Shock that damage adjacent tiles on the owner's board.
      // If ownerRef is provided, use it for position; otherwise use casterRef.
      const posRef = ownerRef || casterRef;
      const posBoard = posRef.boardName && posRef.boardName.startsWith('p1') ? 'p1' : (posRef.boardName && posRef.boardName.startsWith('p2') ? 'p2' : 'p3');
      const posIdx = Number(posRef.index || 0);
      const posRow = indexToRow(posIdx, posBoard);
      const posCol = indexToColumn(posIdx, posBoard);
      // Determine target side from caster's perspective (for ally/enemy resolution)
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const r = indexToRow(i, targetSide);
        const c = indexToColumn(i, targetSide);
        const manhattan = Math.abs(r - posRow) + Math.abs(c - posCol);
        if (manhattan === 1) {
          const slot = (boardArr || [])[i];
          if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: i });
        }
      }
      continue;
    }

    if (type === 'nearest') {
      // Nearest: pick up to `desc.max` distinct targets by Manhattan distance
      // on a virtual grid where p1 occupies columns 0..2 and p2 occupies 3..5.
      const casterBoard = casterSide;
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const maxCount = (typeof desc.max === 'number' && desc.max > 0) ? Math.floor(desc.max) : 1;
      // Compute Manhattan distance using direct visual slot coordinates (index grid 0..8).
      const cRow = (casterRef.index != null) ? indexToVisualRow(casterRef.index) : 0;
      const cX = (casterRef.index != null) ? indexToVisualGlobalX(casterRef.index, casterBoard) : 0;

      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const slot = boardArr[i];
        if (!isOccupiedAndAlive(slot)) continue;
        // Skip caster early if excludeSelf is requested (before sorting by distance)
        if (desc && desc.excludeSelf && casterRef && typeof casterRef.index === 'number') {
          if (targetSide === casterBoard && i === casterRef.index) continue;
        }
        const tRow = indexToVisualRow(i);
        const tX = indexToVisualGlobalX(i, targetSide);
        const dist = Math.abs(tX - cX) + Math.abs(tRow - cRow);
        candidates.push({ index: i, dist });
      }
      if (candidates.length === 0) continue;

      // tiebreak by book-order priority (visual book reading)
      const order = getBookOrder(targetSide);
      const priority = {}; order.forEach((v,i) => { priority[v] = i; });

      candidates.sort((a,b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });

      const take = Math.min(maxCount, candidates.length);
      for (let k = 0; k < take; k++) {
        pushToken(targetSide, candidates[k].index, desc);
      }
      continue;
    }

    if (type === 'nearestWithEffect') {
      const casterBoard = casterSide;
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const maxCount = (typeof desc.max === 'number' && desc.max > 0) ? Math.floor(desc.max) : 1;
      const effectName = String(desc.effectName || desc.effect || '').trim();
      if (!effectName) continue;

      const cRow = (casterRef.index != null) ? indexToVisualRow(casterRef.index) : 0;
      const cX = (casterRef.index != null) ? indexToVisualGlobalX(casterRef.index, casterBoard) : 0;

      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const slot = boardArr[i];
        if (!isOccupiedAndAlive(slot)) continue;
        if (desc && desc.excludeSelf && casterRef && typeof casterRef.index === 'number') {
          if (targetSide === casterBoard && i === casterRef.index) continue;
        }

        const effects = [
          ...((slot && Array.isArray(slot.effects)) ? slot.effects : []),
          ...((slot && Array.isArray(slot._passives)) ? slot._passives : (slot && slot.hero && Array.isArray(slot.hero.passives) ? slot.hero.passives : []))
        ];
        const hasNamedEffect = effects.some(e => e && e.name === effectName);
        if (!hasNamedEffect) continue;

        const tRow = indexToVisualRow(i);
        const tX = indexToVisualGlobalX(i, targetSide);
        const dist = Math.abs(tX - cX) + Math.abs(tRow - cRow);
        candidates.push({ index: i, dist });
      }
      if (candidates.length === 0) continue;

      const order = getBookOrder(targetSide);
      const priority = {}; order.forEach((v, j) => { priority[v] = j; });
      candidates.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });

      const take = Math.min(maxCount, candidates.length);
      for (let k = 0; k < take; k++) {
        pushToken(targetSide, candidates[k].index, desc);
      }
      continue;
    }

    if (type === 'projectile' || type === 'projectilePlus1') {
      const casterBoard = casterSide;
      let col = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : 0;
      const hasExplicitCol = Number.isFinite(Number(desc.col));
      // target side: ally or enemy relative to caster (respect forced side)
      const targetSide = resolveSide(side) || casterSide;
      // Mirror column when targeting the enemy so a caster on the left of their board
      // aims at the right column of the opposing board (and vice-versa). Match logic
      // used by `column` targeting to keep behavior consistent.
      if (hasExplicitCol) {
        col = Math.max(0, Math.min(2, Number(desc.col)));
      } else if (side === 'enemy') {
        col = 2 - col;
      }
      // Get indices for this column, already sorted front->middle->back by columnIndicesForBoard
      const indices = columnIndicesForBoard(col, targetSide);
      const boardArr = getBoardArr(targetSide) || [];
      
      // Find the first occupied hero in the column (front row first, then middle, then back)
      for (let oi = 0; oi < indices.length; oi++) {
        const idx = indices[oi];
        const t = (boardArr || [])[idx];
        if (isOccupiedAndAlive(t)) {
          // If this spell is single-target, skip tiles protected from single-target spells
          if (!isPotentiallyMultiTarget && !bypassTriggers) {
            const blocked = isProtectedFromSingleTarget(t);
            if (blocked) {
              // skip this tile and continue searching for the next occupied tile in the column
              continue;
            }
          }

          out.push({ board: targetSide, index: idx });
          if (type === 'projectilePlus1') {
            // include the tile behind in same column (if present)
            const behindIdx = (oi + 1 < indices.length) ? indices[oi + 1] : null;
            if (behindIdx != null) {
              const behindT = (boardArr || [])[behindIdx];
              if (isOccupiedAndAlive(behindT)) {
                out.push({ board: targetSide, index: behindIdx });
              }
            }
          }
          break; // Only hit the first target (and optionally the one behind for projectilePlus1)
        }
      }
      continue;
    }

    if (type === 'firstEmptyInOpposingColumn') {
      const casterBoard = casterSide;
      let col = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : 0;
      const targetSide = resolveSide('enemy') || (casterSide === 'p1' ? 'p2' : (casterSide === 'p2' ? 'p1' : 'p1'));
      col = 2 - col;
      const indices = columnIndicesForBoard(col, targetSide);
      const boardArr = getBoardArr(targetSide) || [];
      for (const idx of indices) {
        const slot = (boardArr || [])[idx];
        if (!slot || !slot.hero) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'highestEnergy') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      let bestEnergy = -Infinity;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const en = (t.currentEnergy != null ? t.currentEnergy : (t.hero && t.hero.energy) || 0);
        if (en > bestEnergy) bestEnergy = en;
      }
      if (bestEnergy === -Infinity) continue;
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const slot = (boardArr || [])[idx];
        if (!isOccupiedAndAlive(slot)) continue;
        // Skip protected single-target slots if this spell is not potentially multi-target and not bypassing
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(slot)) continue;
        const en = (slot.currentEnergy != null ? slot.currentEnergy : (slot.hero && slot.hero.energy) || 0);
        if (en === bestEnergy) { out.push({ board: targetSide, index: idx }); break; }
      }
      continue;
    }

    if (type === 'lowestEnergy') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const en = (t.currentEnergy != null ? t.currentEnergy : (t.hero && t.hero.energy) || 0);
        candidates.push({ index: i, energy: en });
      }
      if (candidates.length === 0) continue;
      let bestEnergy = Infinity;
      for (const c of candidates) {
        if (c.energy < bestEnergy) bestEnergy = c.energy;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.energy === bestEnergy) {
          pushToken(targetSide, idx, desc);
          break;
        }
      }
      continue;
    }

    if (type === 'highestSpeed') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const sp = (t.currentSpeed != null ? t.currentSpeed : (t.hero && t.hero.speed) || 0);
        candidates.push({ index: i, speed: sp });
      }
      if (candidates.length === 0) continue;
      // Find highest speed among valid candidates
      let bestSpeed = -Infinity;
      for (const c of candidates) {
        if (c.speed > bestSpeed) bestSpeed = c.speed;
      }
      // Use book order as tiebreaker
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.speed === bestSpeed) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'lowestSpeed') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const sp = (t.currentSpeed != null ? t.currentSpeed : (t.hero && t.hero.speed) || 0);
        candidates.push({ index: i, speed: sp });
      }
      if (candidates.length === 0) continue;
      // Find lowest speed among valid candidates
      let bestSpeed = Infinity;
      for (const c of candidates) {
        if (c.speed < bestSpeed) bestSpeed = c.speed;
      }
      // Use book order as tiebreaker
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.speed === bestSpeed) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'highestSpeedLeastEffects') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        if (desc && desc.excludeSelf && casterRef && typeof casterRef.index === 'number') {
          if (targetSide === casterSide && i === casterRef.index) continue;
        }
        const sp = (t.currentSpeed != null ? t.currentSpeed : (t.hero && t.hero.speed) || 0);
        const effectCount = getVisibleEffects(t).length;
        candidates.push({ index: i, speed: sp, effectCount });
      }
      if (candidates.length === 0) continue;
      let bestSpeed = -Infinity;
      for (const c of candidates) {
        if (c.speed > bestSpeed) bestSpeed = c.speed;
      }
      const fastest = candidates.filter(c => c.speed === bestSpeed);
      let leastEffects = Infinity;
      for (const c of fastest) {
        if (c.effectCount < leastEffects) leastEffects = c.effectCount;
      }
      const finalists = fastest.filter(c => c.effectCount === leastEffects);
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        if (finalists.some(c => c.index === idx)) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'leastSpeedAndArmor') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const sp = (t.currentSpeed != null ? t.currentSpeed : (t.hero && t.hero.speed) || 0);
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        const sum = sp + ar;
        candidates.push({ index: i, sum });
      }
      if (candidates.length === 0) continue;
      // Find lowest sum among valid candidates
      let bestSum = Infinity;
      for (const c of candidates) {
        if (c.sum < bestSum) bestSum = c.sum;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.sum === bestSum) {
          pushToken(targetSide, idx, desc);
          break;
        }
      }
      continue;
    }

    if (type === 'highestArmor' || type === 'mostArmor') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        candidates.push({ index: i, armor: ar });
      }
      if (candidates.length === 0) continue;
      // Find highest armor among valid candidates
      let bestArmor = -Infinity;
      for (const c of candidates) {
        if (c.armor > bestArmor) bestArmor = c.armor;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.armor === bestArmor) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'rowContainingHighestArmor') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      let bestArmor = -Infinity;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        if (ar > bestArmor) bestArmor = ar;
      }
      if (bestArmor === -Infinity) continue;
      const order = getBookOrder(targetSide);
      let chosenIdx = null;
      for (const idx of order) {
        const t = (boardArr || [])[idx];
        if (!isOccupiedAndAlive(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        if (ar === bestArmor) { chosenIdx = idx; break; }
      }
      if (chosenIdx == null) continue;
      const row = indexToRow(chosenIdx, targetSide);
      // collect indices in that row (left->middle->right ordering by tile number)
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === row) rowIndices.push(i);
      }
      rowIndices.sort((a,b) => (map[a]||0) - (map[b]||0));
      for (const idx of rowIndices) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    // New: rowWithHighestSumArmor — find the row with the highest total armor sum
    if (type === 'rowWithHighestSumArmor') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
      
      // Calculate sum of armor for each row (0=front, 1=middle, 2=back)
      const rowArmorSums = [0, 0, 0];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const tileNum = map[i];
        const row = Math.floor((tileNum - 1) / 3);
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        rowArmorSums[row] += ar;
      }
      
      // Find row with highest sum
      let maxSum = -Infinity;
      let chosenRow = -1;
      for (let r = 0; r < 3; r++) {
        if (rowArmorSums[r] > maxSum) {
          maxSum = rowArmorSums[r];
          chosenRow = r;
        }
      }
      
      // If no row was chosen (no heroes), skip
      if (chosenRow === -1) continue;
      
      // If all rows have 0 armor, fall back to first row with heroes (book reading order)
      if (maxSum === 0) {
        const order = getBookOrder(targetSide);
        for (const idx of order) {
          const t = (boardArr || [])[idx];
          if (isOccupiedAndAlive(t)) {
            chosenRow = indexToRow(idx, targetSide);
            break;
          }
        }
      }
      
      // Collect all indices in that row
      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === chosenRow) rowIndices.push(i);
      }
      rowIndices.sort((a,b) => (map[a]||0) - (map[b]||0));
      for (const idx of rowIndices) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    // New: rowContainingLowestArmor — find the row that contains the hero with the lowest armor
    if (type === 'rowContainingLowestArmor') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      let bestArmor = Infinity;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        if (ar < bestArmor) bestArmor = ar;
      }
      if (bestArmor === Infinity) continue;
      const order = getBookOrder(targetSide);
      let chosenIdx = null;
      for (const idx of order) {
        const t = (boardArr || [])[idx];
        if (!isOccupiedAndAlive(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        if (ar === bestArmor) { chosenIdx = idx; break; }
      }
      if (chosenIdx == null) continue;
      const row = indexToRow(chosenIdx, targetSide);
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);
      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === row) rowIndices.push(i);
      }
      rowIndices.sort((a,b) => (map[a]||0) - (map[b]||0));
      for (const idx of rowIndices) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'rowWithMostHeroes') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : (targetSide === 'p3' ? P3_INDEX_TO_TILE : P1_INDEX_TO_TILE);

      const rowCounts = [0, 0, 0];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const row = indexToRow(i, targetSide);
        if (row >= 0 && row <= 2) rowCounts[row] += 1;
      }

      const maxCount = Math.max(...rowCounts);
      if (maxCount <= 0) continue;

      let chosenRow = 0;
      for (let r = 0; r < 3; r++) {
        if (rowCounts[r] === maxCount) {
          chosenRow = r;
          break;
        }
      }

      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === chosenRow) rowIndices.push(i);
      }
      rowIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));

      for (const idx of rowIndices) {
        const slot = (boardArr || [])[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'highestHealth') {
      // find highest health on target side
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const hp = (t.currentHealth != null ? t.currentHealth : (t.hero && t.hero.health) || 0);
        candidates.push({ index: i, health: hp });
      }
      if (candidates.length === 0) continue;
      // Find highest health among valid candidates
      let bestHp = -Infinity;
      for (const c of candidates) {
        if (c.health > bestHp) bestHp = c.health;
      }
      // Use the same visual book-order as the UI (tile numbers 1..9 mapping)
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.health === bestHp) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'furthest') {
      // Furthest: pick up to `desc.max` targets by Manhattan tile distance
      // from caster (no diagonals), with book-order tie-break.
      const casterBoard = casterSide;
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const maxCount = (typeof desc.max === 'number' && desc.max > 0) ? Math.floor(desc.max) : 1;

      // Compute Manhattan distance using direct visual slot coordinates (index grid 0..8).
      const cRow = (casterRef.index != null) ? indexToVisualRow(casterRef.index) : 0;
      const cX = (casterRef.index != null) ? indexToVisualGlobalX(casterRef.index, casterBoard) : 0;

      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const slot = boardArr[i];
        if (!isOccupiedAndAlive(slot)) continue;
        if (desc && desc.excludeSelf && casterRef && typeof casterRef.index === 'number') {
          if (targetSide === casterBoard && i === casterRef.index) continue;
        }
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(slot)) continue;

        const tRow = indexToVisualRow(i);
        const tX = indexToVisualGlobalX(i, targetSide);
        const dist = Math.abs(tX - cX) + Math.abs(tRow - cRow);
        candidates.push({ index: i, dist });
      }
      if (candidates.length === 0) continue;

      const order = getBookOrder(targetSide);
      const priority = {}; order.forEach((v, i) => { priority[v] = i; });
      candidates.sort((a, b) => {
        if (a.dist !== b.dist) return b.dist - a.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });

      const take = Math.min(maxCount, candidates.length);
      for (let k = 0; k < take; k++) {
        pushToken(targetSide, candidates[k].index, desc);
      }
      continue;
    }

    if (type === 'lowestHealth' || type === 'leastHealth') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Support requesting multiple lowest-health targets via desc.max
      const maxCount = (typeof desc.max === 'number' && desc.max > 0) ? Math.floor(desc.max) : 1;
      // Collect occupied tiles with their health
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (desc && desc.excludeSelf && casterRef && typeof casterRef.index === 'number') {
          const casterBoard = casterSide;
          if (targetSide === casterBoard && i === casterRef.index) continue;
        }
        // Exclude protected single-target tiles from candidates
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const hp = (t.currentHealth != null ? t.currentHealth : (t.hero && t.hero.health) || 0);
        candidates.push({ index: i, hp });
      }
      if (candidates.length === 0) continue;
      // Use visual book-order as tiebreaker: produce ordering array and map index->priority
      const order = getBookOrder(targetSide);
      const priority = {}; order.forEach((v,i) => { priority[v] = i; });
      // Sort by health asc, then by book-order priority
      candidates.sort((a,b) => { if (a.hp !== b.hp) return a.hp - b.hp; return (priority[a.index] || 0) - (priority[b.index] || 0); });
      const take = Math.min(maxCount, candidates.length);
      for (let j = 0; j < take; j++) pushToken(targetSide, candidates[j].index, desc);
      continue;
    }

    if (type === 'leastArmor') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (desc && desc.excludeSelf && casterRef && typeof casterRef.index === 'number') {
          const casterBoard = casterSide;
          if (targetSide === casterBoard && i === casterRef.index) continue;
        }
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        candidates.push({ index: i, armor: ar });
      }
      if (candidates.length === 0) continue;
      // Find lowest armor among valid candidates
      let bestArmor = Infinity;
      for (const c of candidates) {
        if (c.armor < bestArmor) bestArmor = c.armor;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.armor === bestArmor) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'mostDebuffs') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const cnt = getVisibleEffects(t).filter(e => e && e.kind === 'debuff').length;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      // Find highest debuff count among valid candidates
      let bestCount = -Infinity;
      for (const c of candidates) {
        if (c.count > bestCount) bestCount = c.count;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.count === bestCount) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'mostMissingHealth') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        if (desc && desc.excludeSelf && casterRef && typeof casterRef.index === 'number') {
          if (targetSide === casterSide && i === casterRef.index) continue;
        }
        const maxHp = (t.hero && typeof t.hero.health === 'number') ? Number(t.hero.health) : 0;
        const curHp = (t.currentHealth != null) ? Number(t.currentHealth) : maxHp;
        const missing = Math.max(0, maxHp - curHp);
        candidates.push({ index: i, missing });
      }
      if (candidates.length === 0) continue;
      let bestMissing = -Infinity;
      for (const c of candidates) {
        if (c.missing > bestMissing) bestMissing = c.missing;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.missing === bestMissing) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'mostEffectName' || type === 'mostBurns' || type === 'mostPoisonEffects') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const effectName = type === 'mostBurns' ? 'Burn' : (type === 'mostPoisonEffects' ? 'Poison' : (desc.effectName || desc.name || desc.effect || ''));
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const cnt = getVisibleEffects(t).filter(e => e && (!effectName || e.name === effectName)).length;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      let bestCount = -Infinity;
      for (const c of candidates) {
        if (c.count > bestCount) bestCount = c.count;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.count === bestCount) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'leastEffects') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const cnt = getVisibleEffects(t).length;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      // Find lowest effect count among valid candidates
      let bestCount = Infinity;
      for (const c of candidates) {
        if (c.count < bestCount) bestCount = c.count;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.count === bestCount) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'leastVoidShields') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const fromEffects = Array.isArray(t.effects)
          ? t.effects.filter(e => e && e.name === 'Void Shield').length
          : 0;
        const fromTower = Math.max(0, Number((t.hero && t.hero._towerVoidShield) || 0));
        candidates.push({ index: i, count: fromEffects + fromTower });
      }
      if (candidates.length === 0) continue;
      let bestCount = Infinity;
      for (const c of candidates) {
        if (c.count < bestCount) bestCount = c.count;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.count === bestCount) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'mostBuffs') {
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        const cnt = getVisibleEffects(t).filter(e => e && e.kind === 'buff').length;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      // Find highest buff count among valid candidates
      let bestCount = -Infinity;
      for (const c of candidates) {
        if (c.count > bestCount) bestCount = c.count;
      }
      const order = getBookOrder(targetSide);
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.count === bestCount) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'nearestDeadAlly') {
      // Find the nearest dead ally (corpse) for Blood Golem's Consume Corpse spell
      const casterBoard = casterSide;
      const boardArr = getBoardArr(casterBoard) || [];
      const casterCol = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : 0;
      const casterRow = (casterRef.index != null) ? indexToRow(casterRef.index, casterBoard) : 0;
      
      // Adjust caster column to visual (P2 col is mirrored)
      const casterVisualCol = casterCol + (casterBoard === 'p2' ? 3 : (casterBoard === 'p3' ? 6 : 0));
      
      // Collect all dead allies (corpses)
      const deadCandidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        // A corpse is a tile with a hero that is marked dead
        if (t && t.hero && t._dead) {
          const col = indexToColumn(i, casterBoard);
          const row = indexToRow(i, casterBoard);
          const visualCol = col + (casterBoard === 'p2' ? 3 : (casterBoard === 'p3' ? 6 : 0));
          const dist = Math.abs(visualCol - casterVisualCol) + Math.abs(row - casterRow);
          deadCandidates.push({ index: i, dist });
        }
      }
      
      if (deadCandidates.length === 0) continue;
      
      // Sort by distance (nearest first), then by book order as tiebreaker
      const order = getBookOrder(casterBoard);
      const priority = {}; order.forEach((v,i) => { priority[v] = i; });
      deadCandidates.sort((a,b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });
      
      // Return only the nearest corpse
      out.push({ board: casterBoard, index: deadCandidates[0].index });
      continue;
    }

    if (type === 'nearestDeadEnemy') {
      // Find the nearest dead enemy (corpse)
      const casterBoard = casterSide;
      const targetSide = resolveSide(side) || casterSide;
      const boardArr = getBoardArr(targetSide) || [];
      const casterCol = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : 0;
      const casterRow = (casterRef.index != null) ? indexToRow(casterRef.index, casterBoard) : 0;

      // Adjust caster column to visual (P2 col is mirrored)
      const casterVisualCol = casterCol + (casterBoard === 'p2' ? 3 : (casterBoard === 'p3' ? 6 : 0));

      const deadCandidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (t && t.hero && t._dead) {
          const col = indexToColumn(i, targetSide);
          const row = indexToRow(i, targetSide);
          const visualCol = col + (targetSide === 'p2' ? 3 : (targetSide === 'p3' ? 6 : 0));
          const dist = Math.abs(visualCol - casterVisualCol) + Math.abs(row - casterRow);
          deadCandidates.push({ index: i, dist });
        }
      }

      if (deadCandidates.length === 0) continue;

      const order = getBookOrder(targetSide);
      const priority = {}; order.forEach((v, i) => { priority[v] = i; });
      deadCandidates.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });

      out.push({ board: targetSide, index: deadCandidates[0].index });
      continue;
    }

    if (type === 'reverseBook') {
      // reverse book reading: exact visual reverse of the visual book-order arrays
      const casterBoard = casterSide;
      const targetSide = resolveSide(side) || casterSide;
      const order = getBookOrder(targetSide).slice().reverse();
      const boardArr = getBoardArr(targetSide) || [];
      for (const idx of order) {
        const t = (boardArr || [])[idx];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && !bypassTriggers && isProtectedFromSingleTarget(t)) continue;
        out.push({ board: targetSide, index: idx });
        break;
      }
      continue;
    }

    // fallback: if desc contains direct index/board — but never allow reserve tiles to be targeted
    if (desc.board && typeof desc.index === 'number') {
      const b = String(desc.board || '');
      if (b.toLowerCase().includes('reserve')) {
        // skip reserve targets — reserves are untargetable
        continue;
      }
      // skip dead tiles
      const boardArr = (String(desc.board).startsWith('p1') ? p1Board : (String(desc.board).startsWith('p2') ? p2Board : p3Board)) || [];
      const slot = boardArr[desc.index];
      if (!isOccupiedAndAlive(slot)) continue;
      out.push({ board: desc.board, index: desc.index });
      continue;
    }
  }

  try {
    if (!bypassTriggers && hasSingleEnemyTarget) {
      const enemySide = resolveSide('enemy') || casterSide;
      const enemyBoardArr = getBoardArr(enemySide) || [];
      const tauntTargets = getTauntTargets(enemyBoardArr, enemySide);
      if (tauntTargets.length === 0) {
        for (let i = 0; i < out.length; i++) {
          const token = out[i];
          if (!token || token.board !== enemySide || typeof token.index !== 'number') continue;
          const slot = enemyBoardArr[token.index];
          if (!isOccupiedAndAlive(slot)) continue;
          const redirect = getSingleTargetRedirectTarget(slot, enemyBoardArr, enemySide);
          if (redirect && typeof redirect.index === 'number') {
            out[i] = { board: redirect.board, index: redirect.index };
          }
          break;
        }
      }
    }
  } catch (e) {}

  return out;
}

export default { resolveTargets };
