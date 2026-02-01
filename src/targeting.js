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

export function indexToTileNumber(index, boardName = 'p1') {
  const idx = Number(index || 0);
  if (boardName && boardName.startsWith('p2')) return P2_INDEX_TO_TILE[idx] || 0;
  return P1_INDEX_TO_TILE[idx] || 0;
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

// Return the array indices on a given board that belong to the visual column (0..2)
export function columnIndicesForBoard(col, boardSide = 'p1') {
  const out = [];
  const map = (boardSide === 'p2') ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
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

// helper: return true if a slot has an effect that prevents single-target spells
function isProtectedFromSingleTarget(slot) {
  try {
    if (!slot || !slot.effects || !Array.isArray(slot.effects)) return false;
    return slot.effects.some(e => e && e.preventSingleTarget);
  } catch (e) { return false; }
}

// boards: { p1Board, p2Board, p1Reserve, p2Reserve }
// options: { bypassTriggers: boolean } - if true, skip preventSingleTarget checks (e.g., basicAttack)
export function resolveTargets(targetDescriptors = [], casterRef = {}, boards = {}, ownerRef = null, options = {}) {
  const out = [];
  const { p1Board = [], p2Board = [], p1Reserve = [], p2Reserve = [] } = boards;

  const getBoardBySide = (side) => (side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? p1Board : p2Board) : (side === 'enemy' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? p2Board : p1Board) : null));

  // Determine whether this spell can potentially hit multiple targets based on its descriptors
  // Exclude 'self' targets from this check since they don't represent additional enemy targets
  // (e.g., Siphon targets enemy + self for heal, but should still be blocked by preventSingleTarget)
  const nonSelfDescriptors = (targetDescriptors || []).filter(d => d && d.type !== 'self');
  const isPotentiallyMultiTarget = (nonSelfDescriptors && Array.isArray(nonSelfDescriptors)) ? (
    nonSelfDescriptors.length > 1 || nonSelfDescriptors.some(d => ['board','column','adjacent','projectilePlus1','frontTwoRows','nearest'].includes(d.type))
  ) : false;
  
  // If bypassTriggers is set (e.g., basicAttack), skip all preventSingleTarget checks
  const bypassTriggers = !!(options && options.bypassTriggers);

  const pushToken = (boardName, idx, descLocal) => {
    // Skip caster if descriptor requests excluding self; accept an explicit descriptor so this
    // function doesn't rely on an out-of-scope `desc` variable.
    const localDesc = descLocal || null;
    if (localDesc && localDesc.excludeSelf && casterRef && typeof casterRef.index === 'number' && casterRef.boardName) {
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const b = (boardName === 'p1Board' || boardName === 'p1') ? 'p1' : (boardName === 'p2Board' || boardName === 'p2' ? 'p2' : null);
      if (b === casterBoard && idx === casterRef.index) return;
    }

    // If the spell is single-target (not potentially multi-target), respect effects that prevent single-target targeting
    // Unless bypassTriggers is set (e.g., basicAttack bypasses all effect triggers including preventSingleTarget)
    try {
      if (!isPotentiallyMultiTarget && !bypassTriggers) {
        const b = (boardName === 'p1Board' || boardName === 'p1') ? 'p1' : 'p2';
        const boardArr = (b === 'p1') ? p1Board : p2Board;
        const slot = boardArr && boardArr[idx];
        if (slot && Array.isArray(slot.effects)) {
          const blocked = slot.effects.some(e => e && e.preventSingleTarget);
          if (blocked) return; // skip pushing this token as it's protected against single-target spells
        }
      }
    } catch (e) {}

    // normalize to simple token object { board: 'p1'|'p2', index }
    if (boardName === 'p1Board' || boardName === 'p1') out.push({ board: 'p1', index: idx });
    else if (boardName === 'p2Board' || boardName === 'p2') out.push({ board: 'p2', index: idx });
  }; 

  for (const desc of targetDescriptors) {
    if (!desc) continue;
    const type = desc.type || 'projectile';
    const side = desc.side || 'enemy';

    if (type === 'self') {
      if (casterRef.boardName && casterRef.index != null) {
        const b = casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
        out.push({ board: b, index: casterRef.index });
      }
      continue;
    }

    if (type === 'board') {
      // all allies or enemies on the board (only occupied alive tiles)
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const slot = (boardArr || [])[i];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: i });
      }
      continue;
    }

    if (type === 'column') {
      // choose column based on caster index, using the visual mapping
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      let col = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : (desc.col != null ? desc.col : 0);
      // target side: ally or enemy relative to caster
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      // When targeting enemies, prefer the mirrored visual column so a caster on the left
      // of their board aims at the right column of the opposing board (and vice-versa).
      if (side === 'enemy') {
        col = 2 - col;
      }
      const indices = columnIndicesForBoard(col, targetSide);
        // Only include occupied (alive) tiles in the column — empty slots should cause the column
        // attack to skip that position rather than hitting nothing. Preserve visual ordering (front->middle->back).
        for (const idx of indices) {
          const slot = (targetSide === 'p1' ? p1Board : p2Board)[idx];
          if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
        }
      continue;
    }

    if (type === 'frontmostRowWithHero') {
      // Choose the first enemy row (front -> middle -> back) that has at least one occupied alive tile
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
      // Rows in front-to-back order: 0 (front), 1 (middle), 2 (back)
      for (let row = 0; row <= 2; row++) {
        const rowIndices = [];
        for (let i = 0; i < map.length; i++) {
          const tileNum = map[i];
          if (Math.floor((tileNum - 1) / 3) === row) rowIndices.push(i);
        }
        rowIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));
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

    // New: frontTwoRows — include visual front row (row 0) left->right, then middle row (row 1) left->right
    if (type === 'frontTwoRows') {
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
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
        const slot = (targetSide === 'p1' ? p1Board : p2Board)[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'backRow') {
      // Choose the back row (visual row index 2) on the target side and include occupied tiles
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === 2) rowIndices.push(i);
      }
      rowIndices.sort((a, b) => (map[a] || 0) - (map[b] || 0));
      for (const idx of rowIndices) {
        const slot = (targetSide === 'p1' ? p1Board : p2Board)[idx];
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
      const targetSide = anchorBoard === 'p1' ? 'p1' : 'p2';
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const r = indexToRow(i, targetSide);
        const c = indexToColumn(i, targetSide);
        const manhattan = Math.abs(r - anchorRow) + Math.abs(c - anchorCol);
        if (manhattan === 1) {
          const slot = (targetSide === 'p1' ? p1Board : p2Board)[i];
          if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: i });
        }
      }
      continue;
    }

    if (type === 'adjacentToSelf') {
      // Choose tiles adjacent to the effect owner (or caster if no owner) on the specified side.
      // This is used for effects like Static Shock that damage adjacent tiles on the owner's board.
      // If ownerRef is provided, use it for position; otherwise use casterRef.
      const posRef = ownerRef || casterRef;
      const posBoard = posRef.boardName && posRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const posIdx = Number(posRef.index || 0);
      const posRow = indexToRow(posIdx, posBoard);
      const posCol = indexToColumn(posIdx, posBoard);
      // Determine target side from caster's perspective (for ally/enemy resolution)
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const r = indexToRow(i, targetSide);
        const c = indexToColumn(i, targetSide);
        const manhattan = Math.abs(r - posRow) + Math.abs(c - posCol);
        if (manhattan === 1) {
          const slot = (targetSide === 'p1' ? p1Board : p2Board)[i];
          if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: i });
        }
      }
      continue;
    }

    if (type === 'nearest') {
      // Nearest: pick up to `desc.max` distinct targets by Manhattan distance
      // on a virtual grid where p1 occupies columns 0..2 and p2 occupies 3..5.
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      const maxCount = (typeof desc.max === 'number' && desc.max > 0) ? Math.floor(desc.max) : 1;
      // compute caster global coords
      const cCol = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : 0;
      const cRow = (casterRef.index != null) ? indexToRow(casterRef.index, casterBoard) : 0;
      const cX = cCol + (casterBoard === 'p2' ? 3 : 0);

      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const slot = boardArr[i];
        if (!isOccupiedAndAlive(slot)) continue;
        const tCol = indexToColumn(i, targetSide);
        const tRow = indexToRow(i, targetSide);
        const tX = tCol + (targetSide === 'p2' ? 3 : 0);
        const dist = Math.abs(tX - cX) + Math.abs(tRow - cRow);
        candidates.push({ index: i, dist });
      }
      if (candidates.length === 0) continue;

      // tiebreak by book-order priority (visual book reading)
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      const priority = {}; order.forEach((v,i) => { priority[v] = i; });

      candidates.sort((a,b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });

      const take = Math.min(maxCount, candidates.length);
      for (let k = 0; k < take; k++) {
        pushToken(targetSide === 'p1' ? 'p1Board' : 'p2Board', candidates[k].index, desc);
      }
      continue;
    }

    if (type === 'projectile' || type === 'projectilePlus1') {
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      let col = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard) : 0;
      // target side: ally or enemy relative to caster
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      // Mirror column when targeting the enemy so a caster on the left of their board
      // aims at the right column of the opposing board (and vice-versa). Match logic
      // used by `column` targeting to keep behavior consistent.
      if (side === 'enemy') {
        col = 2 - col;
      }
      // Get indices for this column, already sorted front->middle->back by columnIndicesForBoard
      const indices = columnIndicesForBoard(col, targetSide);
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      
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

    if (type === 'highestEnergy') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      let bestEnergy = -Infinity;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const en = (t.currentEnergy != null ? t.currentEnergy : (t.hero && t.hero.energy) || 0);
        if (en > bestEnergy) bestEnergy = en;
      }
      if (bestEnergy === -Infinity) continue;
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      for (const idx of order) {
        const slot = (boardArr || [])[idx];
        if (!isOccupiedAndAlive(slot)) continue;
        // Skip protected single-target slots if this spell is not potentially multi-target
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(slot)) continue;
        const en = (slot.currentEnergy != null ? slot.currentEnergy : (slot.hero && slot.hero.energy) || 0);
        if (en === bestEnergy) { out.push({ board: targetSide, index: idx }); break; }
      }
      continue;
    }

    if (type === 'highestSpeed') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
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
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.speed === bestSpeed) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'leastSpeedAndArmor') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
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
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.sum === bestSum) {
          pushToken(targetSide === 'p1' ? 'p1' : 'p2', idx, desc);
          break;
        }
      }
      continue;
    }

    if (type === 'highestArmor' || type === 'mostArmor') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        candidates.push({ index: i, armor: ar });
      }
      if (candidates.length === 0) continue;
      // Find highest armor among valid candidates
      let bestArmor = -Infinity;
      for (const c of candidates) {
        if (c.armor > bestArmor) bestArmor = c.armor;
      }
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
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
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      let bestArmor = -Infinity;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        if (ar > bestArmor) bestArmor = ar;
      }
      if (bestArmor === -Infinity) continue;
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
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
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === row) rowIndices.push(i);
      }
      rowIndices.sort((a,b) => (map[a]||0) - (map[b]||0));
      for (const idx of rowIndices) {
        const slot = (targetSide === 'p1' ? p1Board : p2Board)[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    // New: rowWithHighestSumArmor — find the row with the highest total armor sum
    if (type === 'rowWithHighestSumArmor') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
      
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
        const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
        const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
        const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
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
        const slot = (targetSide === 'p1' ? p1Board : p2Board)[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    // New: rowContainingLowestArmor — find the row that contains the hero with the lowest armor
    if (type === 'rowContainingLowestArmor') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      let bestArmor = Infinity;
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        if (ar < bestArmor) bestArmor = ar;
      }
      if (bestArmor === Infinity) continue;
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      let chosenIdx = null;
      for (const idx of order) {
        const t = (boardArr || [])[idx];
        if (!isOccupiedAndAlive(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        if (ar === bestArmor) { chosenIdx = idx; break; }
      }
      if (chosenIdx == null) continue;
      const row = indexToRow(chosenIdx, targetSide);
      const map = (targetSide === 'p2') ? P2_INDEX_TO_TILE : P1_INDEX_TO_TILE;
      const rowIndices = [];
      for (let i = 0; i < map.length; i++) {
        const tileNum = map[i];
        if (Math.floor((tileNum - 1) / 3) === row) rowIndices.push(i);
      }
      rowIndices.sort((a,b) => (map[a]||0) - (map[b]||0));
      for (const idx of rowIndices) {
        const slot = (targetSide === 'p1' ? p1Board : p2Board)[idx];
        if (isOccupiedAndAlive(slot)) out.push({ board: targetSide, index: idx });
      }
      continue;
    }

    if (type === 'highestHealth') {
      // find highest health on target side
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
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
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.health === bestHp) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'lowestHealth' || type === 'leastHealth') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Support requesting multiple lowest-health targets via desc.max
      const maxCount = (typeof desc.max === 'number' && desc.max > 0) ? Math.floor(desc.max) : 1;
      // Collect occupied tiles with their health
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        // Exclude protected single-target tiles from candidates
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
        const hp = (t.currentHealth != null ? t.currentHealth : (t.hero && t.hero.health) || 0);
        candidates.push({ index: i, hp });
      }
      if (candidates.length === 0) continue;
      // Use visual book-order as tiebreaker: produce ordering array and map index->priority
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      const priority = {}; order.forEach((v,i) => { priority[v] = i; });
      // Sort by health asc, then by book-order priority
      candidates.sort((a,b) => { if (a.hp !== b.hp) return a.hp - b.hp; return (priority[a.index] || 0) - (priority[b.index] || 0); });
      const take = Math.min(maxCount, candidates.length);
      for (let j = 0; j < take; j++) out.push({ board: targetSide, index: candidates[j].index });
      continue;
    }

    if (type === 'leastArmor') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
        const ar = (t.currentArmor != null ? t.currentArmor : (t.hero && t.hero.armor) || 0);
        candidates.push({ index: i, armor: ar });
      }
      if (candidates.length === 0) continue;
      // Find lowest armor among valid candidates
      let bestArmor = Infinity;
      for (const c of candidates) {
        if (c.armor < bestArmor) bestArmor = c.armor;
      }
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
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
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
        const cnt = (t && t.effects) ? t.effects.filter(e => e && e.kind === 'debuff').length : 0;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      // Find highest debuff count among valid candidates
      let bestCount = -Infinity;
      for (const c of candidates) {
        if (c.count > bestCount) bestCount = c.count;
      }
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
      for (const idx of order) {
        const candidate = candidates.find(c => c.index === idx);
        if (candidate && candidate.count === bestCount) {
          out.push({ board: targetSide, index: idx });
          break;
        }
      }
      continue;
    }

    if (type === 'mostEffectName' || type === 'mostBurns') {
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      const effectName = type === 'mostBurns' ? 'Burn' : (desc.effectName || desc.name || desc.effect || '');
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
        const cnt = (t && t.effects) ? t.effects.filter(e => e && (!effectName || e.name === effectName)).length : 0;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      let bestCount = -Infinity;
      for (const c of candidates) {
        if (c.count > bestCount) bestCount = c.count;
      }
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
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
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
        const cnt = (t && t.effects) ? t.effects.filter(e => e).length : 0;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      // Find lowest effect count among valid candidates
      let bestCount = Infinity;
      for (const c of candidates) {
        if (c.count < bestCount) bestCount = c.count;
      }
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
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
      const targetSide = side === 'ally' ? (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2') : (casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p2' : 'p1');
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      // Collect all valid candidates (excluding protected targets for single-target spells)
      const candidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        if (!isOccupiedAndAlive(t)) continue;
        if (!isPotentiallyMultiTarget && isProtectedFromSingleTarget(t)) continue;
        const cnt = (t && t.effects) ? t.effects.filter(e => e && e.kind === 'buff').length : 0;
        candidates.push({ index: i, count: cnt });
      }
      if (candidates.length === 0) continue;
      // Find highest buff count among valid candidates
      let bestCount = -Infinity;
      for (const c of candidates) {
        if (c.count > bestCount) bestCount = c.count;
      }
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = targetSide === 'p1' ? bookOrderP1 : bookOrderP2;
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
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const boardArr = casterBoard === 'p1' ? p1Board : p2Board;
      const casterCol = (casterRef.index != null) ? indexToColumn(casterRef.index, casterBoard === 'p1' ? 'p1Board' : 'p2Board') : 0;
      const casterRow = (casterRef.index != null) ? indexToRow(casterRef.index, casterBoard === 'p1' ? 'p1Board' : 'p2Board') : 0;
      
      // Adjust caster column to visual (P2 col is mirrored)
      const casterVisualCol = casterCol + (casterBoard === 'p2' ? 3 : 0);
      
      // Collect all dead allies (corpses)
      const deadCandidates = [];
      for (let i = 0; i < (boardArr || []).length; i++) {
        const t = boardArr[i];
        // A corpse is a tile with a hero that is marked dead
        if (t && t.hero && t._dead) {
          const col = indexToColumn(i, casterBoard === 'p1' ? 'p1Board' : 'p2Board');
          const row = indexToRow(i, casterBoard === 'p1' ? 'p1Board' : 'p2Board');
          const visualCol = col + (casterBoard === 'p2' ? 3 : 0);
          const dist = Math.abs(visualCol - casterVisualCol) + Math.abs(row - casterRow);
          deadCandidates.push({ index: i, dist });
        }
      }
      
      if (deadCandidates.length === 0) continue;
      
      // Sort by distance (nearest first), then by book order as tiebreaker
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = casterBoard === 'p1' ? bookOrderP1 : bookOrderP2;
      const priority = {}; order.forEach((v,i) => { priority[v] = i; });
      deadCandidates.sort((a,b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return (priority[a.index] || 0) - (priority[b.index] || 0);
      });
      
      // Return only the nearest corpse
      out.push({ board: casterBoard, index: deadCandidates[0].index });
      continue;
    }

    if (type === 'reverseBook') {
      // reverse book reading: exact visual reverse of the visual book-order arrays
      const casterBoard = casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
      const targetSide = side === 'ally' ? casterBoard : (casterBoard === 'p1' ? 'p2' : 'p1');
      const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
      const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
      const order = (targetSide === 'p1' ? bookOrderP1.slice().reverse() : bookOrderP2.slice().reverse());
      const boardArr = targetSide === 'p1' ? p1Board : p2Board;
      for (const idx of order) {
        const t = (boardArr || [])[idx];
        if (isOccupiedAndAlive(t)) { out.push({ board: targetSide, index: idx }); break; }
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
      const boardArr = (String(desc.board).startsWith('p1') ? p1Board : p2Board) || [];
      const slot = boardArr[desc.index];
      if (!isOccupiedAndAlive(slot)) continue;
      out.push({ board: desc.board, index: desc.index });
      continue;
    }
  }

  return out;
}

export default { resolveTargets };
