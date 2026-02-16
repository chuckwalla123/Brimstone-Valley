// Shared game logic for both client and server
// Pure functions for game state updates, validation, etc.

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

import { executeRound } from '../src/battleEngine.js';

let heroInstanceCounter = 1;

export function ensureHeroInstanceId(tile) {
  if (!tile || !tile.hero) return;
  if (!tile.hero._instanceId) {
    tile.hero._instanceId = `hero-${heroInstanceCounter++}`;
  }
  if (!tile._heroInstanceId) tile._heroInstanceId = tile.hero._instanceId;
}

// Function to deep clone objects without circular references
export function deepClone(obj, visited = new Map()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (visited.has(obj)) return visited.get(obj);

  if (Array.isArray(obj)) {
    const arr = [];
    visited.set(obj, arr);
    for (let i = 0; i < obj.length; i += 1) {
      arr[i] = deepClone(obj[i], visited);
    }
    return arr;
  }

  const cloned = {};
  visited.set(obj, cloned);
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = deepClone(obj[key], visited);
      if (value !== undefined) {
        cloned[key] = value;
      }
    }
  }
  return cloned;
}

// Visual mapping between array index (0..8) and tile numbers (1..9) used by the UI
const P1_INDEX_TO_TILE = [7,4,1,8,5,2,9,6,3];
const P2_INDEX_TO_TILE = [3,6,9,2,5,8,1,4,7];
const P3_INDEX_TO_TILE = [1,2,3,4,5,6,7,8,9];

export function indexToTileNumber(index, boardName = 'p1') {
  const idx = Number(index || 0);
  if (boardName && boardName.startsWith('p2')) return P2_INDEX_TO_TILE[idx] || 0;
  if (boardName && boardName.startsWith('p3')) return P3_INDEX_TO_TILE[idx] || 0;
  return P1_INDEX_TO_TILE[idx] || 0;
}

export function indexToRow(index, boardName = 'p1') {
  const tileNum = indexToTileNumber(index, boardName);
  if (!tileNum) return 0;
  return Math.floor((tileNum - 1) / 3); // 0=front,1=middle,2=back
}

export function recomputeModifiers(tile) {
  if (!tile || !tile.hero) return;
  try { ensureHeroInstanceId(tile); } catch (e) {}
  const baseArmor = (tile.hero && typeof tile.hero.armor === 'number') ? Number(tile.hero.armor) : 0;
  const baseSpeed = (tile.hero && typeof tile.hero.speed === 'number') ? Number(tile.hero.speed) : 0;
  const baseSpellPower = (tile.hero && typeof tile.hero.spellPower === 'number') ? Number(tile.hero.spellPower) : 0;
    // By default, attackPower is reduced by target armor. If payload.ignoreArmor is set, 
  let modArmor = 0;
  let modSpeed = 0;
  let modSpellPower = 0;
  // Consider both transient effects and hidden passives when computing modifiers
  const sourceEffects = [ ...(tile._passives || []), ...(tile.effects || []) ];
  sourceEffects.forEach(e => {
    if (!e || !e.modifiers) return;
    const m = e.modifiers || {};
    if (typeof m.armor === 'number') modArmor += Number(m.armor);
    if (typeof m.speed === 'number') modSpeed += Number(m.speed);
    if (typeof m.spellPower === 'number') modSpellPower += Number(m.spellPower);
  });

  tile.currentArmor = baseArmor + modArmor;
  tile.currentSpeed = baseSpeed + modSpeed;
  tile.currentSpellPower = baseSpellPower + modSpellPower;
  // Positional modifiers defined on the hero (e.g., front:+armor, middle:+speed)
  try {
    if (tile && tile.hero && tile.hero.positionalModifiers) {
      // Support fixed (draft-time) positional bonuses: if hero has `fixedPositional` set,
      // compute and remember the starting row (front/middle/back/reserve) the first time
      // this tile is processed. Use that starting row for bonuses from then on.
      let rowIdx = null;
      let rowName = null;
      const isReserve = tile && tile.boardName && String(tile.boardName).toLowerCase().includes('reserve');
      if (tile && tile.hero && tile.hero.fixedPositional) {
        // Determine starting row name and cache it on the hero object so it persists
        if (!tile.hero._startingRow) {
          if (isReserve) {
            tile.hero._startingRow = 'reserve';
          } else if (typeof tile.index === 'number' && tile.boardName) {
            try { rowIdx = indexToRow(Number(tile.index), tile.boardName.startsWith('p1') ? 'p1' : (tile.boardName.startsWith('p2') ? 'p2' : 'p1')); } catch (e) { rowIdx = null; }
            tile.hero._startingRow = rowIdx === 0 ? 'front' : (rowIdx === 1 ? 'middle' : (rowIdx === 2 ? 'back' : null));
          } else {
            tile.hero._startingRow = null;
          }
        }
        rowName = tile.hero._startingRow;
      } else {
        if (typeof tile.index === 'number' && tile.boardName) {
          try { rowIdx = indexToRow(Number(tile.index), tile.boardName.startsWith('p1') ? 'p1' : (tile.boardName.startsWith('p2') ? 'p2' : 'p1')); } catch (e) { rowIdx = null; }
        }
        rowName = rowIdx === 0 ? 'front' : (rowIdx === 1 ? 'middle' : (rowIdx === 2 ? 'back' : null));
      }
      if (rowName && tile.hero.positionalModifiers && tile.hero.positionalModifiers[rowName]) {
        const pm = tile.hero.positionalModifiers[rowName] || {};
        if (typeof pm.armor === 'number') tile.currentArmor = Number(tile.currentArmor || 0) + Number(pm.armor);
        if (typeof pm.speed === 'number') tile.currentSpeed = Number(tile.currentSpeed || 0) + Number(pm.speed);
        if (typeof pm.spellPower === 'number') tile.currentSpellPower = Number(tile.currentSpellPower || 0) + Number(pm.spellPower);
      }
      // If the hero has a reserve starting energy bonus defined in positionalModifiers.reserve.energy
      // and the hero is fixedPositional and was drafted into reserve, apply it once to the tile's currentEnergy.
      try {
        if (tile && tile.hero && tile.hero.fixedPositional && rowName === 'reserve' && tile.hero.positionalModifiers && tile.hero.positionalModifiers.reserve && typeof tile.hero.positionalModifiers.reserve.energy === 'number') {
          if (!tile._reserveBonusApplied) {
            const bonus = Number(tile.hero.positionalModifiers.reserve.energy || 0);
            tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + bonus;
            tile._reserveBonusApplied = true;
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
  // If any active effect/passive supplies a `force` override, apply the override (last one wins)
  try {
    const forces = sourceEffects.map(e => e && e.force).filter(Boolean);
    if (forces && forces.length > 0) {
      const last = forces[forces.length - 1];
      if (typeof last.armor === 'number') tile.currentArmor = Number(last.armor);
      if (typeof last.speed === 'number') tile.currentSpeed = Number(last.speed);
      if (typeof last.spellPower === 'number') tile.currentSpellPower = Number(last.spellPower);
    }
  } catch (e) {}

  // Enforce hard speed floor of 1 unless a hero explicitly opts out by setting
  // `hero.allowZeroSpeed = true` (for special-case heroes that can drop to 0).
  try {
    const canZero = tile && tile.hero && tile.hero.allowZeroSpeed === true;
    tile.currentSpeed = canZero ? Number(tile.currentSpeed || 0) : Math.max(1, Number(tile.currentSpeed || 0));
  } catch (e) {}
  // Enforce armor floor at 0 so modifiers/augments cannot make armor negative.
  try {
    tile.currentArmor = Math.max(0, Number(tile.currentArmor || 0));
  } catch (e) {}
  // Optional armor cap from effects/passives (e.g., Overencumbered)
  try {
    const armorCaps = sourceEffects
      .map(e => (e && typeof e.maxArmor === 'number') ? Number(e.maxArmor) : null)
      .filter(v => v != null && Number.isFinite(v));
    if (armorCaps.length > 0) {
      const cap = Math.min(...armorCaps);
      tile.currentArmor = Math.min(Number(tile.currentArmor || 0), cap);
    }
  } catch (e) {}
}

// Helper: return true if this tile's hero is allowed to have zero or negative speed
export function canHaveZeroSpeed(tile) {
  return !!(tile && tile.hero && tile.hero.allowZeroSpeed === true);
}

// Helper: enforce the global speed floor (1) unless an exception is present
export function capSpeedForTile(tile, speed) {
  const s = Number(typeof speed === 'number' ? speed : (speed == null ? 0 : Number(speed)));
  return canHaveZeroSpeed(tile) ? s : Math.max(1, s);
}

export function incEnergy(tile) {
  if (!tile || !tile.hero) return;
  try {
    // Initialize baseline runtime stats if not present
    ensureTileHealthInitialized(tile);
    if (tile.currentArmor == null) tile.currentArmor = (tile.hero && tile.hero.armor) || 0;
    if (tile.currentSpeed == null) tile.currentSpeed = (tile.hero && tile.hero.speed) || 0;
    if (tile.currentSpellPower == null) tile.currentSpellPower = (tile.hero && tile.hero.spellPower) || 0;
    if (tile.currentEnergy == null) tile.currentEnergy = (tile.hero && tile.hero.energy) || 0;
    // Ensure hidden passives are initialized from hero.passives (do NOT put into visible `effects`)
    if (!tile._passives) tile._passives = (tile.hero && tile.hero.passives) ? (tile.hero.passives.map(e => ({ ...e }))) : [];
    // Recompute any modifiers contributed by effects so currentSpeed/currentArmor/spellPower are correct
    try { recomputeModifiers(tile); } catch (e) {}
    // Increment energy by speed (energy-by-speed rule)
    const speed = Number(tile.currentSpeed || 0);
    // record previous energy so callers can detect threshold crossings
    const prevEnergy = Number(tile.currentEnergy || 0);
    tile._energyBeforeStart = prevEnergy;
    tile.currentEnergy = Number(tile.currentEnergy || 0) + speed;
    tile._energyGainedThisStart = tile.currentEnergy - prevEnergy;
    // Ensure dead flag exists
    if (!tile._dead) tile._dead = false;
  } catch (e) {}
}

export function findTileInBoards(token, p1Board, p2Board, p3Board, p1Reserve, p2Reserve, p3Reserve) {
  // Backward compatibility: if called with old signature
  // (token, p1Board, p2Board, p1Reserve, p2Reserve), shift args.
  if (Array.isArray(p3Board) && (!p1Reserve || !p2Reserve) && (!p3Reserve)) {
    const looksLikeReserve = (arr) => Array.isArray(arr) && arr[0] && String(arr[0].type || '').toLowerCase().includes('reserve');
    if (looksLikeReserve(p3Board)) {
      p3Reserve = p2Reserve;
      p2Reserve = p1Reserve;
      p1Reserve = p3Board;
      p3Board = [];
    }
  }
  // token can be 'p1:0' or an object { board: 'p2', index: 1 }
  if (!token) return null;
    if (typeof token === 'string' && token.includes(':')) {
    const [b, idx] = token.split(':');
    const i = parseInt(idx, 10);
    if (isNaN(i)) return null;
    if (b === 'p1') return { boardName: 'p1Board', index: i, tile: (p1Board || [])[i] };
    if (b === 'p2') return { boardName: 'p2Board', index: i, tile: (p2Board || [])[i] };
    if (b === 'p3') return { boardName: 'p3Board', index: i, tile: (p3Board || [])[i] };
    // never resolve reserves as targetable
    return null;
  }
  if (typeof token === 'object' && token.board && typeof token.index === 'number') {
    const i = token.index;
    if (token.board === 'p1') return { boardName: 'p1Board', index: i, tile: (p1Board || [])[i] };
    if (token.board === 'p2') return { boardName: 'p2Board', index: i, tile: (p2Board || [])[i] };
    if (token.board === 'p3') return { boardName: 'p3Board', index: i, tile: (p3Board || [])[i] };
    // do not resolve reserve boards
    return null;
  }
  // fallback: search by id across boards
  const search = (arr, name) => {
    const idx = (arr || []).findIndex(t => t && t.id === token);
    if (idx !== -1) return { boardName: name, index: idx, tile: arr[idx] };
    return null;
  };
  // Only search main boards for id tokens; reserves are untargetable
  return search(p1Board, 'p1Board') || search(p2Board, 'p2Board') || search(p3Board, 'p3Board') || null;
}

export function applyPayloadToTarget(payload, targetRef, addLog, boards = {}, onStep = null, applyImmediately = true) {
  if (!targetRef || !targetRef.tile) return;
  const tile = targetRef.tile;
  const shouldBypass = !!(payload && payload.post && payload.post.bypassTriggers);
  // Ensure runtime passives exist so on-damage hooks (e.g., Frenzy) can trigger
  try {
    if (!tile._passives && tile.hero && Array.isArray(tile.hero.passives)) {
      tile._passives = tile.hero.passives.map(e => ({ ...e }));
    }
  } catch (e) {}
  // simple payload shapes supported: { action: 'damage'|'heal', value: number }
  if (!payload || !payload.action) return;
  if (payload.action === 'damage') {
    let v = Number(payload.value || 0);    
    // Soul Link: Check if any adjacent allies have Soul Link effect to redirect half damage
    let soulLinkRedirect = null;
    try {
      if (!shouldBypass) {
        const { p1Board = [], p2Board = [], p3Board = [] } = boards;
        const targetBoard = targetRef.boardName && targetRef.boardName.startsWith('p1') ? p1Board : (targetRef.boardName && targetRef.boardName.startsWith('p2') ? p2Board : p3Board);
        const targetBoardName = targetRef.boardName && targetRef.boardName.startsWith('p1') ? 'p1' : (targetRef.boardName && targetRef.boardName.startsWith('p2') ? 'p2' : 'p3');
        const targetBoardKey = targetBoardName === 'p1' ? 'p1Board' : (targetBoardName === 'p2' ? 'p2Board' : 'p3Board');
        const targetIndex = targetRef.index;
      
      // Find adjacent allies with Soul Link
      const adjacentIndices = [];
      const targetRow = indexToRow(targetIndex, targetBoardKey);
      const targetCol = ((indexToTileNumber(targetIndex, targetBoardKey) - 1) % 3 + 3) % 3;
      
      for (let i = 0; i < targetBoard.length; i++) {
        if (i === targetIndex) continue;
        const adjTile = targetBoard[i];
        if (!adjTile || !adjTile.hero || adjTile._dead) continue;
        
        const adjRow = indexToRow(i, targetBoardKey);
        const adjCol = ((indexToTileNumber(i, targetBoardKey) - 1) % 3 + 3) % 3;
        const dist = Math.abs(adjRow - targetRow) + Math.abs(adjCol - targetCol);
        
        if (dist === 1 && adjTile.effects && Array.isArray(adjTile.effects)) {
          const hasSoulLink = adjTile.effects.some(e => e && e.name === 'Soul Link');
          if (hasSoulLink) {
            adjacentIndices.push(i);
            break; // Only first Soul Link ally redirects (Soul Link does not stack)
          }
        }
      }
      
        // If Soul Link ally found, split damage
        if (adjacentIndices.length > 0) {
          const soulLinkIndex = adjacentIndices[0];
          const soulLinkTile = targetBoard[soulLinkIndex];
          const halfDamage = Math.ceil(v / 2); // Round up
          const remainingDamage = v - halfDamage;
          
          // Calculate Soul Link damage after armor (but don't apply yet if deferred)
          const soulLinkArmor = Math.max(0, Number((soulLinkTile.currentArmor != null ? soulLinkTile.currentArmor : soulLinkTile.hero && soulLinkTile.hero.armor || 0) || 0));
          const soulLinkDamageAfterArmor = Math.max(0, halfDamage - soulLinkArmor);
          
          if (applyImmediately) {
            // Apply immediately only when called in immediate mode
            applyHealthDelta(soulLinkTile, -soulLinkDamageAfterArmor);
            addLog && addLog(`  > Soul Link: ${targetBoardName}Board[${soulLinkIndex}] absorbed ${soulLinkDamageAfterArmor} damage (${halfDamage} - ${soulLinkArmor} armor)`);
          } else {
            // Store redirect info to return to caller for deferred processing
            soulLinkRedirect = {
              boardName: targetBoardKey,
              index: soulLinkIndex,
              damage: soulLinkDamageAfterArmor,
              rawDamage: halfDamage
            };
            addLog && addLog(`  > Soul Link: ${targetBoardName}Board[${soulLinkIndex}] will absorb ${soulLinkDamageAfterArmor} damage (deferred)`);
          }
          
          // Reduce damage to original target
          v = remainingDamage;
          addLog && addLog(`  > Soul Link: damage to ${targetRef.boardName}[${targetRef.index}] reduced to ${v}`);
        }
      }
    } catch (e) {
      // If Soul Link logic fails, continue with original damage
    }
    let sourceIgnoresArmor = false;
    try {
      if (payload && payload.source && typeof payload.source === 'string') {
        const m = payload.source.match(/p([123])Board\[(\d+)\]/);
        if (m) {
          const side = m[1] === '1' ? 'p1' : (m[1] === '2' ? 'p2' : 'p3');
          const idx = Number(m[2]);
          const sourceBoard = side === 'p1' ? (boards.p1Board || []) : (side === 'p2' ? (boards.p2Board || []) : (boards.p3Board || []));
          const sourceTile = sourceBoard[idx];
          sourceIgnoresArmor = !!(sourceTile && sourceTile.hero && sourceTile.hero._towerIgnoreArmor);
        }
      }
    } catch (e) {}
    // By default, attackPower is reduced by target armor. If payload.ignoreArmor is set,
    // or the caster has a tower ignore-armor flag, armor is ignored.
    if (!payload.ignoreArmor && !sourceIgnoresArmor) {
      const armorMul = Number(payload.armorMultiplier != null ? payload.armorMultiplier : 1) || 1;
      const armor = Math.max(0, Number((tile.currentArmor != null ? tile.currentArmor : (tile.hero && tile.hero.armor) || 0) || 0));
      const reduced = Math.max(0, Math.round(v - (armor * armorMul)));
      v = reduced;
    }
    let voidShieldReducedBy = 0;
    try {
      if (!shouldBypass) {
        const vs = (tile && tile.hero && typeof tile.hero._towerVoidShield === 'number') ? Number(tile.hero._towerVoidShield) : 0;
        if (vs > 0) {
          const before = v;
          v = Math.max(0, Number(v || 0) - vs);
          voidShieldReducedBy = Math.max(0, before - v);
          if (voidShieldReducedBy > 0) {
            addLog && addLog(`  > Void Shield reduced damage by ${voidShieldReducedBy} (now ${v})`);
          }
        }
      }
    } catch (e) {}
    let deferredEnergyGain = 0;
    const onTargetedReactions = [];
    try {
      if (!shouldBypass) {
        // Check both tile.effects and tile._passives for onTargeted reactions
        const allEffects = [...(tile.effects || []), ...(tile._passives || [])];
        for (let effectIdx = 0; effectIdx < allEffects.length; effectIdx++) {
          const effect = allEffects[effectIdx];
          if (!effect || !effect.onTargeted) continue;
          const ot = effect.onTargeted;
              if (payload && payload.source && typeof payload.source === 'string') {
            try {
                  const m = payload.source.match(/p([123])Board\[(\d+)\]/);
              if (m) {
                    const b = m[1] === '1' ? 'p1' : (m[1] === '2' ? 'p2' : 'p3');
                const i = Number(m[2]);
                const attackerBoardName = b === 'p1' ? 'p1Board' : (b === 'p2' ? 'p2Board' : 'p3Board');
                const targetSide = (targetRef && targetRef.boardName && String(targetRef.boardName).startsWith('p1')) ? 'p1'
                  : ((targetRef && targetRef.boardName && String(targetRef.boardName).startsWith('p2')) ? 'p2' : 'p3');
                const attackerIsEnemy = b !== targetSide;
                if (!attackerIsEnemy) continue;
                if (ot.type === 'damage') {
                  const reactVal = Number(ot.value || 0);
                  onTargetedReactions.push({ type: 'damageAttacker', value: reactVal, effectName: effect.name, attackerBoard: attackerBoardName, attackerIndex: i, ownerBoardName: targetRef.boardName, ownerIndex: targetRef.index, effectIndex: effectIdx });
                }
                if (ot.type === 'applyEffectToAttacker') {
                  const effectName = ot.effect || ot.effectName || ot.name;
                  if (effectName) {
                        onTargetedReactions.push({ type: 'applyEffectToAttacker', effectName, attackerBoard: attackerBoardName, attackerIndex: i, ownerBoardName: targetRef.boardName, ownerIndex: targetRef.index, effectIndex: effectIdx });
                  }
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    
    try { ensureTileHealthInitialized(tile); } catch (e) {}
    if (applyImmediately) {
      applyHealthDelta(tile, -v);
      addLog && addLog(`  > ${payload.source || 'Spell'} dealt ${v} to ${targetRef.boardName}[${targetRef.index}]`);
    } else {
      addLog && addLog(`  > ${payload.source || 'Spell'} would deal ${v} to ${targetRef.boardName}[${targetRef.index}] (deferred)`);
    }
    // Passive hooks: e.g. Frenzy — when this tile takes damage, grant energy
    // Only trigger if actual damage dealt (after armor reduction) is greater than 0
    try {
      if (!shouldBypass && v > 0 && tile._passives && Array.isArray(tile._passives)) {
        const frenzy = tile._passives.find(e => e && e.name === 'Frenzy');
        if (frenzy) {
          if (typeof tile.currentEnergy === 'number') {
            if (applyImmediately) {
              tile.currentEnergy = Number(tile.currentEnergy) + 1;
              addLog && addLog(`  > ${targetRef.boardName}[${targetRef.index}] gained 1 Energy from Frenzy (now ${tile.currentEnergy})`);
            } else {
              // queue deferred energy gain so it can be applied alongside deferred health changes
              deferredEnergyGain += 1;
              addLog && addLog(`  > ${targetRef.boardName}[${targetRef.index}] would gain 1 Energy from Frenzy (deferred - queued)`);
            }
          }
        }
      }
    } catch (e) {}
    // Effect hooks: onDamaged handlers are collected as reactions to be processed
    // after the cast animation. We return them as `reactions` on the applied result.
    try {
      const reactions = [];
      const seenOnDamaged = new Set();
      // Skip collecting reactions if the source spell has bypassTriggers (e.g., basicAttack)
      if (!shouldBypass && tile.effects && Array.isArray(tile.effects)) {
        for (let effectIdx = 0; effectIdx < (tile.effects || []).length; effectIdx++) {
          const effect = tile.effects[effectIdx];
          if (!effect || !effect.onDamaged) continue;
          if (effect.name) seenOnDamaged.add(effect.name);
          const od = effect.onDamaged;
          if (od.type === 'healAlliesExceptSelf') {
            const healVal = Number(od.value || 0);
            reactions.push({ type: 'healAlliesExceptSelf', value: healVal, effectName: effect.name, ownerBoardName: targetRef.boardName, ownerIndex: targetRef.index, effectIndex: effectIdx });
          }
          if (od.type === 'damage' && payload && payload.source && typeof payload.source === 'string') {
            try {
                    const m = payload.source.match(/p([123])Board\[(\d+)\]/);
              if (m) {
                      const b = m[1] === '1' ? 'p1' : (m[1] === '2' ? 'p2' : 'p3');
                const i = Number(m[2]);
                // Support special 'equal' marker to reflect the actual damage taken (v)
                const reactVal = (typeof od.value === 'string' && od.value === 'equal') ? v : Number(od.value || 0);
                      reactions.push({ type: 'damageAttacker', value: reactVal, effectName: effect.name, attackerBoard: b === 'p1' ? 'p1Board' : (b === 'p2' ? 'p2Board' : 'p3Board'), attackerIndex: i, ownerBoardName: targetRef.boardName, ownerIndex: targetRef.index, effectIndex: effectIdx });
              }
            } catch (e) {}
          }
        }
      }
      // Include onDamaged passives (e.g., Counter) when not already present as effects
      if (!shouldBypass) {
        const passiveList = (tile._passives && Array.isArray(tile._passives)) ? tile._passives : (tile.hero && Array.isArray(tile.hero.passives) ? tile.hero.passives : []);
        for (let passiveIdx = 0; passiveIdx < (passiveList || []).length; passiveIdx++) {
          const effect = passiveList[passiveIdx];
          if (!effect || !effect.onDamaged) continue;
          if (effect.name && seenOnDamaged.has(effect.name)) continue;
          const od = effect.onDamaged;
          if (od.type === 'healAlliesExceptSelf') {
            const healVal = Number(od.value || 0);
            reactions.push({ type: 'healAlliesExceptSelf', value: healVal, effectName: effect.name, ownerBoardName: targetRef.boardName, ownerIndex: targetRef.index });
          }
          if (od.type === 'damage' && payload && payload.source && typeof payload.source === 'string') {
            try {
                    const m = payload.source.match(/p([123])Board\[(\d+)\]/);
              if (m) {
                      const b = m[1] === '1' ? 'p1' : (m[1] === '2' ? 'p2' : 'p3');
                const i = Number(m[2]);
                const reactVal = (typeof od.value === 'string' && od.value === 'equal') ? v : Number(od.value || 0);
                      reactions.push({ type: 'damageAttacker', value: reactVal, effectName: effect.name, attackerBoard: b === 'p1' ? 'p1Board' : (b === 'p2' ? 'p2Board' : 'p3Board'), attackerIndex: i, ownerBoardName: targetRef.boardName, ownerIndex: targetRef.index });
              }
            } catch (e) {}
          }
        }
      }
      // Tower thorns augments: deal damage back to the attacker when hit
      if (!shouldBypass && v > 0 && tile && tile.hero && typeof tile.hero._towerThorns === 'number' && tile.hero._towerThorns > 0) {
        if (payload && payload.source && typeof payload.source === 'string') {
          try {
            const m = payload.source.match(/p([123])Board\[(\d+)\]/);
            if (m) {
              const b = m[1] === '1' ? 'p1' : (m[1] === '2' ? 'p2' : 'p3');
              const i = Number(m[2]);
              const thornsVal = Number(tile.hero._towerThorns || 0);
              reactions.push({ type: 'damageAttacker', value: thornsVal, effectName: 'Thorns', attackerBoard: b === 'p1' ? 'p1Board' : (b === 'p2' ? 'p2Board' : 'p3Board'), attackerIndex: i, ownerBoardName: targetRef.boardName, ownerIndex: targetRef.index });
            }
          } catch (e) {}
        }
      }
      // Merge onTargeted reactions (collected earlier) with onDamaged reactions
      if (onTargetedReactions.length > 0) {
        reactions.push(...onTargetedReactions);
      }
      // Preserve rollInfo from payload (for dice-based spells like Wild Punch)
      const result = { type: 'damage', amount: v, reactions: reactions.length > 0 ? reactions : undefined, deferred: !applyImmediately, deltaEnergy: deferredEnergyGain };
      if (voidShieldReducedBy > 0) {
        result.voidShieldApplied = true;
        result.voidShieldReducedBy = voidShieldReducedBy;
      }
      if (payload.rollInfo) result.rollInfo = payload.rollInfo;
      if (soulLinkRedirect) result.soulLinkRedirect = soulLinkRedirect;
      return result;
    } catch (e) {}
    // Preserve rollInfo from payload (for dice-based spells like Wild Punch)
    const result = { type: 'damage', amount: v, deferred: !applyImmediately, deltaEnergy: deferredEnergyGain };
    if (voidShieldReducedBy > 0) {
      result.voidShieldApplied = true;
      result.voidShieldReducedBy = voidShieldReducedBy;
    }
    if (payload.rollInfo) result.rollInfo = payload.rollInfo;
    if (soulLinkRedirect) result.soulLinkRedirect = soulLinkRedirect;
    // Include onTargeted reactions even if onDamaged collection failed
    if (onTargetedReactions.length > 0) result.reactions = onTargetedReactions;
    return result;
  } else if (payload.action === 'heal') {
    const v = Number(payload.value || 0);
    try { ensureTileHealthInitialized(tile); } catch (e) {}
    if (applyImmediately) {
      applyHealthDelta(tile, v);
      addLog && addLog(`  > ${payload.source || 'Spell'} healed ${v} to ${targetRef.boardName}[${targetRef.index}]`);
    } else {
      addLog && addLog(`  > ${payload.source || 'Spell'} would heal ${v} to ${targetRef.boardName}[${targetRef.index}] (deferred)`);
    }
    return { type: 'heal', amount: v, deferred: !applyImmediately };
  }
  return null;
}

// Health cap handling: by default non-monster heroes have a hard cap of 15 HP.
export function isMonster(tile) {
  return !!(tile && tile.hero && tile.hero.monster === true);
}

export function capHealthForTile(tile, health) {
  if (isMonster(tile)) return health;
  if (tile && tile.hero && tile.hero.towerNoHealthCap) return health;
  return Math.min(15, health == null ? 0 : Number(health));
}

export function ensureTileHealthInitialized(tile) {
  if (!tile) return;
  try { ensureHeroInstanceId(tile); } catch (e) {}
  if (typeof tile.currentHealth === 'undefined' || tile.currentHealth === null) {
    const base = (tile.hero && typeof tile.hero.health === 'number') ? Number(tile.hero.health) : 0;
    tile.currentHealth = capHealthForTile(tile, base);
  }
}

export function applyHealthDelta(tile, delta) {
  if (!tile) return;
  ensureTileHealthInitialized(tile);
  
  // Initialize passives from hero if not already done (critical for death-prevention passives)
  if (!tile._passives && tile.hero && tile.hero.passives) {
    tile._passives = tile.hero.passives.map(e => ({ ...e }));
  }
  
  const cur = Number(tile.currentHealth || 0);
  const next = cur + Number(delta || 0);
  const crossedCrumbleThreshold = Number(cur) >= 7 && Number(next) < 7;
  const maybeTriggerCrumble = () => {
    try {
      if (!crossedCrumbleThreshold) return;
      if (!tile._passives && tile.hero && tile.hero.passives) {
        tile._passives = tile.hero.passives.map(e => ({ ...e }));
      }
      if (!tile._passives || !Array.isArray(tile._passives)) return;
      const crumble = tile._passives.find(p => p && p.name === 'Crumble' && !p._used);
      if (!crumble) return;
      crumble._used = true;
      const currentBaseArmor = Number((tile.hero && tile.hero.armor) || 0);
      tile.hero.armor = Math.max(0, currentBaseArmor - 1);
      try { recomputeModifiers(tile); } catch (e) {}
    } catch (e) {}
  };
  
  // Intercept lethal damage for one-time passives like Undying Rage
  if (next <= 0) {
    try {
      if (tile._passives && Array.isArray(tile._passives)) {
        const ur = tile._passives.find(p => p && (p.name === 'Undying Rage' || p.name === 'UndyingRage') && !p._used);
        if (ur) {
          ur._used = true; // consume the passive
          tile.currentHealth = 1;
          maybeTriggerCrumble();
          return;
        }
      }
    } catch (err) {
    }
  }
  tile.currentHealth = capHealthForTile(tile, next);
  maybeTriggerCrumble();
}

export function makeEmptyMain(playerId) {
  return Array.from({ length: 9 }).map((_, i) => ({
    id: `${playerId}-main-${i}`,
    player: playerId,
    index: i,
    hero: null,
    type: 'main',
  }));
}

export function makeReserve(playerId) {
  return Array.from({ length: 2 }).map((_, i) => ({
    id: `${playerId}-reserve-${i}`,
    player: playerId,
    index: i,
    hero: null,
    type: 'reserve',
  }));
}

// Placeholder for game state update function
export async function processMove(gameState, action, io = null, options = {}) {
  const newState = { ...gameState };
  const returnSteps = !!options.returnSteps;
  let stepQueue = null;

  switch (action.type) {
    case 'syncBattleState':
      // Client-side movement state sync (TestBattle/visual movement)
      if (action.p1Main) newState.p1Main = action.p1Main;
      if (action.p2Main) newState.p2Main = action.p2Main;
      if (action.p3Main) newState.p3Main = action.p3Main;
      if (action.p1Reserve) newState.p1Reserve = action.p1Reserve;
      if (action.p2Reserve) newState.p2Reserve = action.p2Reserve;
      if (action.p3Reserve) newState.p3Reserve = action.p3Reserve;
      if (action.priorityPlayer) newState.priorityPlayer = action.priorityPlayer;
      if (action.phase) newState.phase = action.phase;
      break;
    case 'draftHero':
      // Handle drafting a hero
      const { hero, player, tileIndex, tileType, startingRow } = action;
      const mainKey = player === 'player1' ? 'p1Main' : (player === 'player2' ? 'p2Main' : 'p3Main');
      const reserveKey = player === 'player1' ? 'p1Reserve' : (player === 'player2' ? 'p2Reserve' : 'p3Reserve');
      const main = newState[mainKey] || [];
      const reserve = newState[reserveKey] || [];

      if (tileType === 'main') {
        main[tileIndex] = { ...main[tileIndex], hero };
        newState[mainKey] = main;
      } else {
        const tile = { ...reserve[tileIndex], hero };
        // Apply reserve bonuses if needed
        reserve[tileIndex] = tile;
        newState[reserveKey] = reserve;
      }

      // Remove from availableHeroes
      newState.availableHeroes = (newState.availableHeroes || []).filter(h => h.name !== hero.name);
      newState.step = (newState.step || 0) + 1; // Advance after pick
      break;
    case 'banHero':
      // Handle banning a hero
      const { hero: bannedHero } = action;
      newState.availableHeroes = (newState.availableHeroes || []).filter(h => h.name !== bannedHero.name);
      newState.bans = [...(newState.bans || []), bannedHero];
      newState.step = (newState.step || 0) + 1; // Advance after ban
      break;
    case 'advanceDraft':
      newState.step = (newState.step || 0) + 1;
      break;
    case 'startBattle':
      newState.phase = 'battle';
      break;
    case 'startRound':
      // Execute a battle round
      newState.phase = 'battle';
      // Initialize roundNumber if it doesn't exist (for backward compatibility)
      if (typeof newState.roundNumber !== 'number') newState.roundNumber = 0;
      // Increment round number at the start of each round
      newState.roundNumber = (newState.roundNumber || 0) + 1;
      let actionSeq = 0;
      stepQueue = [];
      try {
        const result = await executeRound(
          {
            p1Board: newState.p1Main,
            p2Board: newState.p2Main,
            p3Board: newState.p3Main,
            p1Reserve: newState.p1Reserve,
            p2Reserve: newState.p2Reserve,
            p3Reserve: newState.p3Reserve,
            addLog: null,
            priorityPlayer: action.priorityPlayer || 'player1',
            roundNumber: newState.roundNumber || 1,
            lastCastActionBySide: newState.lastCastActionBySide || null,
            gameMode: newState.gameMode || null
          },
          {
            castDelayMs: 0, // No delay on server
            onStep: ({ p1Board: nb1, p2Board: nb2, p3Board: nb3, p1Reserve: nr1, p2Reserve: nr2, p3Reserve: nr3, priorityPlayer: np, lastAction }) => {
              newState.p1Main = nb1;
              newState.p2Main = nb2;
              if (nb3) newState.p3Main = nb3;
              newState.p1Reserve = nr1;
              newState.p2Reserve = nr2;
              if (nr3) newState.p3Reserve = nr3;
              newState.priorityPlayer = np;
              if (lastAction && typeof lastAction === 'object') {
                actionSeq += 1;
                lastAction.seq = actionSeq;
                lastAction.state = {
                  p1Main: nb1,
                  p2Main: nb2,
                  ...(nb3 ? { p3Main: nb3 } : {}),
                  p1Reserve: nr1,
                  p2Reserve: nr2,
                  ...(nr3 ? { p3Reserve: nr3 } : {}),
                  priorityPlayer: np,
                  phase: newState.phase || 'battle'
                };
              }
              newState.lastAction = lastAction;
              if (lastAction) {
                stepQueue.push(deepClone(lastAction));
              }
            },
            postEffectDelayMs: 0,
            reactionDelayMs: 0,
            postCastDelayMs: 500
          }
        );
        if (result && result.lastCastActionBySide) {
          newState.lastCastActionBySide = result.lastCastActionBySide;
        }
      } catch (error) {
        console.error('executeRound error:', error);
      }
      break;
    default:
      break;
  }

  if (returnSteps) {
    return { state: newState, steps: stepQueue || [] };
  }
  return newState;
}

// Placeholder for validation
export function isValidMove(gameState, action) {
  // TODO: Add validation logic
  return true;
}