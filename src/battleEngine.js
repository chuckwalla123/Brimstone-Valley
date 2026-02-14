// Expanded minimal battle engine
// - Increments energy each round
// - Collects simple spell casts from tiles (`tile.spellCasts`)
// - Orders casts by speed (and optional priority tie-break)
// - Resolves simple payloads: damage/heal to target descriptors
// The engine is intentionally simple but provides clear extension points.

/* ==================== BOARD LAYOUT REFERENCE ====================
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
 *   P3: Front = [0,1,2], Middle = [3,4,5], Back = [6,7,8]
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

import { resolveTargets, indexToRow, indexToColumn, columnIndicesForBoard } from './targeting.js';
import { buildPayloadFromSpec, applyEffectsToTile } from './spell.js';
import { getSpellById, SPELLS } from './spells.js';
import { EFFECTS } from './effects.js';
import { HEROES } from './heroes.js';
import { incEnergy, findTileInBoards, recomputeModifiers, applyPayloadToTarget, ensureHeroInstanceId } from '../shared/gameLogic.js';

// Configurable default reaction animation delay (ms) used when showing reaction pulses
// Increased to 1000ms so reaction procs (e.g., Prayer, Bleed reactions)
// have a visible pause before applying their effects.
const DEFAULT_REACTION_DELAY_MS = 1000;
// How long to display a pulse (damage/heal float) before applying the stat change
const DEFAULT_PULSE_DISPLAY_MS = 0;
// How long to wait after a cast (post-apply) before resolving the next cast
const DEFAULT_POST_CAST_DELAY_MS = 3000;
// Scale a precast glow based on the effect magnitude
const getEffectPrecastScale = (amount) => {
  const v = Math.abs(Number(amount || 0));
  return Math.min(1.8, Math.max(0.85, 0.9 + v / 8));
};
// Global counter for queued cast IDs so we can track/process casts across
// repeated collect calls and avoid duplicate execution when re-collecting.
let _queuedCastCounter = 0;

// Health cap handling: by default non-monster heroes have a hard cap of 15 HP.
function isMonster(tile) {
  return !!(tile && tile.hero && tile.hero.monster === true);
}
function capHealthForTile(tile, health) {
  if (isMonster(tile)) return health;
  if (tile && tile.hero && tile.hero.towerNoHealthCap) return health;
  return Math.min(15, health == null ? 0 : Number(health));
}
function ensureTileHealthInitialized(tile) {
  if (!tile) return;
  if (typeof tile.currentHealth === 'undefined' || tile.currentHealth === null) {
    const base = (tile.hero && typeof tile.hero.health === 'number') ? Number(tile.hero.health) : 0;
    tile.currentHealth = capHealthForTile(tile, base);
  }
}

function isSideAliveMain(boardArr) {
  return (boardArr || []).some(t => t && t.hero && !t._dead && (typeof t.currentHealth !== 'number' || t.currentHealth > 0));
}

function getAliveSidesMain(p1Board, p2Board, p3Board) {
  const alive = [];
  if (isSideAliveMain(p1Board)) alive.push('p1');
  if (isSideAliveMain(p2Board)) alive.push('p2');
  if (isSideAliveMain(p3Board)) alive.push('p3');
  return alive;
}
function applyHealthDelta(tile, delta) {
  if (!tile) return;
  ensureTileHealthInitialized(tile);
  const cur = Number(tile.currentHealth || 0);
  const next = cur + Number(delta || 0);
  tile.currentHealth = capHealthForTile(tile, next);
}

function clampEnergy(tile) {
  if (!tile) return;
  tile.currentEnergy = Math.max(0, Number(tile.currentEnergy || 0));
}

function getVoidShieldValue(tile) {
  if (!tile || !tile.hero || typeof tile.hero._towerVoidShield !== 'number') return 0;
  return Math.max(0, Number(tile.hero._towerVoidShield || 0));
}

function applyVoidShieldReduction(tile, damage) {
  const raw = Math.max(0, Number(damage || 0));
  const vs = getVoidShieldValue(tile);
  if (vs <= 0 || raw <= 0) return { damage: raw, reducedBy: 0 };
  const reduced = Math.max(0, raw - vs);
  return { damage: reduced, reducedBy: raw - reduced };
}

function cloneArr(arr) { 
  return (arr || []).map(t => {
    if (!t) return null;
    // Deep clone effects array to prevent mutations from affecting queued state snapshots
    const cloned = { ...t };
    if (Array.isArray(t.effects)) {
      cloned.effects = t.effects.map(e => e ? { ...e } : null);
    }
    return cloned;
  });
}

function collectSpellCasts(p1Board, p2Board, p3Board, p1Reserve, p2Reserve, p3Reserve) {
  const out = [];
  const scan = (arr, boardName) => {
          (arr || []).forEach((tile, idx) => {
      if (!tile) return;
      if (tile._dead) return; // dead heroes do not have queued casts
      const casts = tile.spellCasts || [];
      // If casts were not annotated with queuedEnergy at enqueue time, we attempt to reconstruct
      // a sensible queuedEnergy by assuming casts are ordered and were enqueued earliest->latest.
      let simulatedEnergy = (tile.currentEnergy != null ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0);
      const costs = casts.map(cc => {
        const sid = cc && cc.spellId;
        if (!sid) return 0;
        // Prefer any explicit queuedCost set at enqueue time
        if (cc && typeof cc.queuedCost === 'number') return Number(cc.queuedCost);
        // Prefer slot-specific cost from the caster's hero slot if available
        try {
          if (cc && cc.slot && tile && tile.hero && tile.hero.spells && tile.hero.spells[cc.slot]) {
            const slotSpec = tile.hero.spells[cc.slot];
            if (slotSpec && typeof slotSpec.cost !== 'undefined') return Number(slotSpec.cost) || 0;
          }
          // If slot wasn't provided, try to infer by matching spell id to hero slots
          if (tile && tile.hero && tile.hero.spells) {
            const hs = tile.hero.spells;
            if (hs.front && hs.front.id === sid && typeof hs.front.cost !== 'undefined') return Number(hs.front.cost) || 0;
            if (hs.middle && hs.middle.id === sid && typeof hs.middle.cost !== 'undefined') return Number(hs.middle.cost) || 0;
            if (hs.back && hs.back.id === sid && typeof hs.back.cost !== 'undefined') return Number(hs.back.cost) || 0;
          }
        } catch (e) {}
        // Costs are authoritative from hero slots or queued/runtime payloads; do not fall back to SPELLS definitions here
        return 0;
      });
      // Ensure each queued cast object has a stable `queuedId` so we can track
      // which casts have been processed and avoid duplicates when re-collecting
      // after mid-round auto-cast checks.
      for (let i = 0; i < casts.length; i++) {
        const c = casts[i];
        if (!c) continue;
        if (typeof c.queuedId === 'undefined' || c.queuedId === null) {
          c.queuedId = ++_queuedCastCounter;
        }
      }
      // If any cast already has queuedEnergy (e.g. auto-cast attached it), prefer those values.
      const anyHasQueued = casts.some(c => c && typeof c.queuedEnergy === 'number');
      if (anyHasQueued) {
        for (let i = 0; i < casts.length; i++) {
          const c = casts[i];
          const qEnergy = (c && typeof c.queuedEnergy === 'number') ? c.queuedEnergy : simulatedEnergy;
          out.push({ caster: { boardName, index: idx, tile }, payload: { ...c, queuedEnergy: qEnergy, queuedId: c.queuedId } });
        }
      } else {
        // Assume currentEnergy is the pre-cast visual energy; assign queuedEnergy sequentially and
        // decrement an internal cursor, but do NOT modify the visible tile.currentEnergy here.
        let energyCursor = simulatedEnergy;
        for (let i = 0; i < casts.length; i++) {
          const c = casts[i];
          const qEnergy = energyCursor;
          out.push({ caster: { boardName, index: idx, tile }, payload: { ...c, queuedEnergy: qEnergy, queuedId: c.queuedId } });
          energyCursor = Math.max(0, energyCursor - (costs[i] || 0));
        }
      }
    });
  };
  scan(p1Board, 'p1Board');
  scan(p2Board, 'p2Board');
  scan(p3Board, 'p3Board');
  // Do not collect casts from reserves — reserve heroes should not cast.
  return out;
}

function getCastOrder(casts = [], p1Board = [], p2Board = [], p3Board = [], priorityPlayer = 'player1', addLog) {
  // Cast tier ordering (higher first): default 0, then -1, etc.
  // Within each tier: group by energy (highest first), then book order, then priority tie-break.
  const getCastTier = (c) => {
    try {
      if (c && c.payload && typeof c.payload.castPriority === 'number') return Number(c.payload.castPriority);
      if (c && c.payload && c.payload.spellId) {
        const spell = getSpellById(c.payload.spellId);
        if (spell && typeof spell.castPriority === 'number') return Number(spell.castPriority);
      }
    } catch (e) {}
    return 0;
  };

  const byTier = {};
  casts.forEach(c => {
    const tier = getCastTier(c);
    byTier[tier] = byTier[tier] || [];
    byTier[tier].push(c);
  });

  const tiers = Object.keys(byTier).map(Number).sort((a, b) => b - a);
  const ordered = [];

  // Book-order positions based on the visual tile numbering used by the UI (tile numbers 1..9):
  // For Player 1, tile numbers 1..9 map to indices: [2,5,8,1,4,7,0,3,6]
  // For Player 2, tile numbers 1..9 map to indices: [6,3,0,7,4,1,8,5,2]
  const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
  const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
  const bookOrderP3 = [0,1,2,3,4,5,6,7,8];
  const boardNameToPlayer = (boardName) => {
    if (boardName && String(boardName).startsWith('p1')) return 'player1';
    if (boardName && String(boardName).startsWith('p2')) return 'player2';
    return 'player3';
  };
  const getBookIndex = (caster) => {
    if (!caster || typeof caster.index !== 'number' || !caster.boardName) return 9999;
    const arr = caster.boardName.startsWith('p1') ? bookOrderP1 : (caster.boardName.startsWith('p2') ? bookOrderP2 : bookOrderP3);
    const pos = arr.indexOf(caster.index);
    return pos === -1 ? 9999 : pos;
  };

  tiers.forEach(tier => {
    const byEnergy = {};
    (byTier[tier] || []).forEach(c => {
      const energy = (c && c.payload && typeof c.payload.queuedEnergy === 'number') ? c.payload.queuedEnergy : ((c.caster && c.caster.tile && (c.caster.tile.currentEnergy != null ? c.caster.tile.currentEnergy : (c.caster.tile.hero && c.caster.tile.hero.energy) || 0)) || 0);
      byEnergy[energy] = byEnergy[energy] || [];
      byEnergy[energy].push(c);
    });
    const energies = Object.keys(byEnergy).map(Number).sort((a, b) => b - a);

    energies.forEach(en => {
      const group = byEnergy[en].slice();
      while (group.length > 0) {
        let minIdx = Infinity;
        group.forEach(g => { const bi = getBookIndex(g.caster); if (bi < minIdx) minIdx = bi; });
        const candidates = group.filter(g => getBookIndex(g.caster) === minIdx);
        let pick = null;
        if (candidates.length === 1) {
          pick = candidates[0];
        } else {
          const casterKeys = new Set(candidates.map(c => `${(c.caster.boardName||'')}:${String(c.caster.index)}`));
          if (casterKeys.size === 1) {
            pick = candidates[0];
          } else {
            const order = ['player1', 'player2', 'player3'];
            const startIdx = Math.max(0, order.indexOf(priorityPlayer));
            try {
              const infos = candidates.map(c => ({ board: c.caster.boardName, index: c.caster.index, bookIndex: getBookIndex(c.caster), energy: c.payload?.queuedEnergy, castPriority: getCastTier(c) }));
              addLog && addLog(`  > TIE DETECTED! Tier: ${tier}, Energy: ${en}, Candidates: ${JSON.stringify(infos)}, priorityPlayer: ${priorityPlayer}`);
            } catch (e) {}
            let chosen = null;
            for (let i = 0; i < order.length; i++) {
              const player = order[(startIdx + i) % order.length];
              const cand = candidates.find(c => boardNameToPlayer(c.caster.boardName) === player);
              if (cand) { chosen = cand; priorityPlayer = player; break; }
            }
            pick = chosen || candidates[0];
            addLog && addLog(`  > Priority used. New priority: ${priorityPlayer}`);
          }
        }
        ordered.push(pick);
        const idx = group.indexOf(pick);
        if (idx !== -1) group.splice(idx, 1);
      }
    });
  });

  return { ordered, priorityPlayer };
}

export async function executeRound({ p1Board = [], p2Board = [], p3Board = [], p1Reserve = [], p2Reserve = [], p3Reserve = [], addLog, priorityPlayer = 'player1', roundNumber = 1, lastCastActionBySide = null, gameMode = null }, { castDelayMs = 700, onStep, postEffectDelayMs = 0, reactionDelayMs = 1000, postCastDelayMs = 500, quiet = false } = {}) {
  const cP1 = cloneArr(p1Board);
  const cP2 = cloneArr(p2Board);
  const cP3 = cloneArr(p3Board);
  const cR1 = cloneArr(p1Reserve);
  const cR2 = cloneArr(p2Reserve);
  const cR3 = cloneArr(p3Reserve);
  const isFfa3 = gameMode === 'ffa3';
  let gameWinner = null;
  // Track last cast actions by side so Copy Cat can reference enemy casts across rounds
  let lastCastBySide = (lastCastActionBySide && typeof lastCastActionBySide === 'object')
    ? { p1: lastCastActionBySide.p1 || null, p2: lastCastActionBySide.p2 || null, p3: lastCastActionBySide.p3 || null }
    : { p1: null, p2: null, p3: null };

  // Initialize runtime fields on each occupied tile so damage/heal math uses proper starting HP/armor/speed
  // NOTE: This function must be defined BEFORE the forEach loops that call it (temporal dead zone).
  const initTileRuntime = (tile) => {
    if (!tile || !tile.hero) return tile;
    try {
      if (roundNumber === 1 && tile.hero._towerFirstStrike) {
        tile._towerFirstStrikeUsed = false;
      }
    } catch (e) {}
    try {
      if (tile.hero && tile.hero._towerWarmUp) tile._towerWarmUpUsedRound = false;
      if (tile.hero && tile.hero._towerEchoCaster) tile._towerEchoCasterUsedRound = false;
      if (roundNumber === 1 && tile.hero && tile.hero._towerMomentum) tile._towerMomentumGains = 0;
      if (tile._towerArcaneExchangePending) {
        tile._towerArcaneExchangeReady = true;
        tile._towerArcaneExchangePending = false;
      }
      if (tile._towerPredatorPacePending) {
        applyEffectsToTile(tile, [{ name: 'Predator\'s Pace', kind: 'buff', duration: 1, modifiers: { speed: 2 }, _hidden: true }], addLog, { boardName: tile.boardName, index: tile.index, tile });
        tile._towerPredatorPacePending = false;
      }
    } catch (e) {}
    // initialize baseline runtime fields if missing
    // ensure hidden passives are initialized from hero.passives (do not copy into visible effects)
    if (!tile._passives) tile._passives = (tile.hero && tile.hero.passives) ? (tile.hero.passives.map(e => ({ ...e }))) : [];
    ensureTileHealthInitialized(tile);
    if (tile.currentArmor == null) tile.currentArmor = (tile.hero && tile.hero.armor) || 0;
    if (tile.currentSpeed == null) tile.currentSpeed = (tile.hero && tile.hero.speed) || 0;
    if (tile.currentEnergy == null) tile.currentEnergy = (tile.hero && tile.hero.energy) || 0;
    try { recomputeModifiers(tile); } catch (e) {}
    try {
      const boardName = String(tile.boardName || '');
      const isReserve = boardName.toLowerCase().includes('reserve');
      if (!isReserve) {
        const side = boardName.startsWith('p1') ? 'p1' : (boardName.startsWith('p2') ? 'p2' : 'p3');
        const row = indexToRow(tile.index, side);
        if (tile._lastRow != null && row !== tile._lastRow) {
          if (tile.hero && tile.hero._towerAttunement) {
            tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + 1;
            clampEnergy(tile);
            applyEffectsToTile(tile, [{ name: 'Attunement', kind: 'buff', duration: 1, modifiers: { spellPower: 1 }, _hidden: true }], addLog, { boardName: tile.boardName, index: tile.index, tile });
          }
          if (tile.hero && tile.hero._towerTacticalSwap) {
            applyEffectsToTile(tile, [{ name: 'Tactical Swap', kind: 'buff', duration: 1, modifiers: { armor: 2 }, _hidden: true }], addLog, { boardName: tile.boardName, index: tile.index, tile });
          }
        }
        tile._lastRow = row;
      }
    } catch (e) {}
    try {
      if (!tile._startingEffectsApplied) {
        const starting = (tile.hero && Array.isArray(tile.hero.startingEffects)) ? tile.hero.startingEffects : [];
        const toApply = (starting || []).map(e => (typeof e === 'string' ? EFFECTS[e] : e)).filter(Boolean);
        if (toApply.length > 0) {
          applyEffectsToTile(tile, toApply, addLog, { boardName: tile.boardName, index: tile.index, tile });
        }
        tile._startingEffectsApplied = true;
      }
    } catch (e) {}
    // Safety: if reserve bonus wasn't applied by recomputeModifiers for any reason,
    // apply it here so fixed-positional reserve heroes reliably gain their starting energy.
    try {
      const isReserve = String(tile.boardName || '').toLowerCase().includes('reserve');
      if (isReserve && tile.hero && tile.hero.fixedPositional && tile.hero.positionalModifiers && tile.hero.positionalModifiers.reserve && typeof tile.hero.positionalModifiers.reserve.energy === 'number') {
        if (!tile._reserveBonusApplied) {
          const bonus = Number(tile.hero.positionalModifiers.reserve.energy || 0);
          tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + bonus;
          tile._reserveBonusApplied = true;
          // Cache the hero's starting row so fixedPositional bonuses remain 'reserve' even after movement
          try { if (tile.hero && !tile.hero._startingRow) tile.hero._startingRow = 'reserve'; } catch (e) {}
        }
      }
    } catch (e) {}
    return tile;
  };

  const tryPhoenixRebirth = (tile, boardName, index) => {
    try {
      if (!tile || !tile.hero || tile.hero._towerPhoenix !== true) return false;
      if (tile.hero._towerPhoenixUsed) return false;
      const base = (tile.hero && typeof tile.hero.health === 'number') ? Number(tile.hero.health) : 0;
      const reviveHealth = Math.max(1, Math.ceil(base * 0.25));
      tile.hero._towerPhoenixUsed = true;
      tile._dead = false;
      tile.currentHealth = capHealthForTile(tile, reviveHealth);
      addLog && addLog(`  > Phoenix Rebirth: ${boardName}[${index}] revived at ${tile.currentHealth} HP`);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Assign `boardName` and `index` to each tile clone and initialize runtime fields
  try {
    (cP1 || []).forEach((t, i) => { if (t) { t.boardName = 'p1Board'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cP2 || []).forEach((t, i) => { if (t) { t.boardName = 'p2Board'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cP3 || []).forEach((t, i) => { if (t) { t.boardName = 'p3Board'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cR1 || []).forEach((t, i) => { if (t) { t.boardName = 'p1Reserve'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cR2 || []).forEach((t, i) => { if (t) { t.boardName = 'p2Reserve'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cR3 || []).forEach((t, i) => { if (t) { t.boardName = 'p3Reserve'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
  } catch (e) {}

  const applyRowPlacementAugments = (tile) => {
    if (!tile || !tile.hero) return;
    const boardName = String(tile.boardName || '').toLowerCase();
    if (!boardName || boardName.includes('reserve')) return;
    if (typeof tile.index !== 'number') return;
    const slot = slotForIndex(tile.boardName, tile.index);
    if (tile.hero._towerFrontlineVanguard) {
      if (typeof tile.hero._towerFrontlineVanguardActive !== 'boolean') {
        tile.hero._towerFrontlineVanguardActive = slot === 'front';
      }
      if (tile.hero._towerFrontlineVanguardActive) {
        if (!tile.hero._towerFrontlineVanguardCastsApplied && tile._castsRemaining) {
          tile._castsRemaining.front = Number(tile._castsRemaining.front || 0) + 1;
          tile.hero._towerFrontlineVanguardCastsApplied = true;
        }
        if (!tile.hero._towerFrontlineVanguardEnergyApplied) {
          tile.hero._towerFrontlineVanguardEnergyApplied = true;
          tile.currentEnergy = Number(tile.currentEnergy || 0) + 1;
        }
      }
    }
    if (tile.hero._towerRearguard) {
      if (typeof tile.hero._towerRearguardActive !== 'boolean') {
        tile.hero._towerRearguardActive = slot === 'back';
      }
      if (tile.hero._towerRearguardActive) {
        if (!tile.hero._towerRearguardCastsApplied && tile._castsRemaining) {
          tile._castsRemaining.back = Number(tile._castsRemaining.back || 0) + 1;
          tile.hero._towerRearguardCastsApplied = true;
        }
        if (!tile.hero._towerRearguardEnergyApplied) {
          tile.hero._towerRearguardEnergyApplied = true;
          tile.currentEnergy = Number(tile.currentEnergy || 0) + 1;
        }
      }
    }
  };

  // Clear any leftover queued casts from previous rounds and reset per-tile casts-remaining
  // so each round's auto-cast logic starts from the hero's configured casts.
  [cP1, cP2, cP3, cR1, cR2, cR3].forEach(arr => (arr || []).forEach(tile => {
    if (!tile || !tile.hero) return;
    // Clear queued casts (they should not persist between rounds), but preserve
    // the runtime `_castsRemaining` value if already present so casts decrement
    // across rounds rather than reset every round. Initialize it once from
    // the hero's configured values when missing.
    tile.spellCasts = [];
    if (!tile._castsRemaining) {
      tile._castsRemaining = {
        front: tile.hero.spells && tile.hero.spells.front ? (tile.hero.spells.front.casts || 0) : 0,
        middle: tile.hero.spells && tile.hero.spells.middle ? (tile.hero.spells.middle.casts || 0) : 0,
        back: tile.hero.spells && tile.hero.spells.back ? (tile.hero.spells.back.casts || 0) : 0,
      };
    }
    applyRowPlacementAugments(tile);
  }));

  // Apply pending Echo Caster bonuses after _castsRemaining is available
  [cP1, cP2, cP3].forEach(arr => (arr || []).forEach(tile => {
    if (!tile || !tile.hero) return;
    if (tile._towerEchoCasterPending && tile._castsRemaining) {
      const slotKey = tile._towerEchoCasterPending;
      const before = Number(tile._castsRemaining[slotKey] || 0);
      tile._castsRemaining[slotKey] = before + 1;
      tile._towerEchoCasterPending = null;
      addLog && addLog(`  > Echo Caster: increased ${tile.boardName}[${tile.index}]._castsRemaining.${slotKey} ${before} -> ${tile._castsRemaining[slotKey]}`);
    }
  }));

  // Ensure auto-cast energy snapshot does not persist across rounds so heroes
  // will auto-enqueue based on the fresh start-of-round energy value.
  [cP1, cP2, cP3].forEach(arr => (arr || []).forEach(tile => { if (!tile || !tile.hero) return; tile._lastAutoCastEnergy = Number.NEGATIVE_INFINITY; }));

  const resolveEffectApplierForPulse = (effect) => {
    try {
      if (!effect) return null;
      const byInstanceId = effect.appliedByHeroInstanceId;
      const byId = effect.appliedByHeroId;
      const byBoardName = effect.appliedByBoardName;
      const byIndex = typeof effect.appliedByIndex === 'number'
        ? effect.appliedByIndex
        : (effect.appliedBy && typeof effect.appliedBy.index === 'number' ? effect.appliedBy.index : null);
      const checkTile = (boardArr, boardName, idx) => {
        if (!boardArr || typeof idx !== 'number') return null;
        const tile = boardArr[idx];
        if (!tile || !tile.hero || tile._dead) return null;
        if (byInstanceId && tile.hero._instanceId !== byInstanceId) return null;
        if (byId && tile.hero.id !== byId) return null;
        return { boardName, index: idx, tile };
      };
      if (byInstanceId) {
        for (let i = 0; i < (cP1 || []).length; i++) {
          const t = (cP1 || [])[i];
          if (t && t.hero && !t._dead && t.hero._instanceId === byInstanceId) return { boardName: 'p1Board', index: i, tile: t };
        }
        for (let i = 0; i < (cP2 || []).length; i++) {
          const t = (cP2 || [])[i];
          if (t && t.hero && !t._dead && t.hero._instanceId === byInstanceId) return { boardName: 'p2Board', index: i, tile: t };
        }
        for (let i = 0; i < (cP3 || []).length; i++) {
          const t = (cP3 || [])[i];
          if (t && t.hero && !t._dead && t.hero._instanceId === byInstanceId) return { boardName: 'p3Board', index: i, tile: t };
        }
      }
      if (byId) {
        for (let i = 0; i < (cP1 || []).length; i++) {
          const t = (cP1 || [])[i];
          if (t && t.hero && !t._dead && t.hero.id === byId) return { boardName: 'p1Board', index: i, tile: t };
        }
        for (let i = 0; i < (cP2 || []).length; i++) {
          const t = (cP2 || [])[i];
          if (t && t.hero && !t._dead && t.hero.id === byId) return { boardName: 'p2Board', index: i, tile: t };
        }
        for (let i = 0; i < (cP3 || []).length; i++) {
          const t = (cP3 || [])[i];
          if (t && t.hero && !t._dead && t.hero.id === byId) return { boardName: 'p3Board', index: i, tile: t };
        }
      }
      if (byBoardName === 'p1Board') return checkTile(cP1, 'p1Board', byIndex);
      if (byBoardName === 'p2Board') return checkTile(cP2, 'p2Board', byIndex);
      if (byBoardName === 'p3Board') return checkTile(cP3, 'p3Board', byIndex);
    } catch (e) {}
    return null;
  };

  // Helper: apply pulses from effects (DOT/HOT) on their host tile
  const applyEffectPulses = async (boardArr, boardName) => {
    const reactions = [];
    const pulses = [];
    
    // Collect all pulses first in reading order (by index)
    (boardArr || []).forEach((tile, idx) => {
      if (!tile || !tile.effects) return;
      (tile.effects || []).forEach((effect, ei) => {
        if (!effect || !effect.pulse) return;
        pulses.push({ tile, idx, effect, ei, boardName });
      });
    });
    
    // Process pulses sequentially so they animate one at a time
    for (const p of pulses) {
      const { tile, idx, effect, ei, boardName } = p;
      const pulse = effect.pulse;
      
      if (pulse.type === 'damage') {
            // support dynamic pulses derived from tile stats (e.g., Treachery derives damage from current Armor)
            let v = Number(pulse.value || 0);
            if (pulse.derivedFrom === 'armor') {
              try { v = Number((tile && typeof tile.currentArmor === 'number') ? tile.currentArmor : 0); } catch (e) { v = Number(pulse.value || 0); }
            }
            if (pulse.derivedFrom === 'roundNumber') {
              try { v = Number(roundNumber || 1); } catch (e) { v = Number(pulse.value || 0); }
            }
            const vsResult = applyVoidShieldReduction(tile, v);
            if (vsResult.reducedBy > 0) {
              addLog && addLog(`  > Void Shield reduced effect damage by ${vsResult.reducedBy} on ${boardName}[${idx}]`);
            }
            const finalPulseDamage = vsResult.damage;
            addLog && addLog(`  > ${effect.name || 'Effect'} pulse will deal ${finalPulseDamage} to ${boardName}[${idx}]`);
            
            // Emit UI step BEFORE applying damage (so animation shows pre-damage state)
            try {
              if (typeof onStep === 'function') {
                const lastAction = { type: 'effectPulse', target: { boardName, index: idx }, effectName: effect.name, action: 'damage', amount: finalPulseDamage, effectIndex: ei };
                onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction });
              }
            } catch (e) {}
            
            // Apply damage immediately (so next pulse sees updated state)
            applyHealthDelta(tile, -finalPulseDamage);

            // Optional: after pulse damage, spread a configured effect to adjacent heroes
            // on the same board (used by Wildfire). Order is strictly damage first, then spread.
            try {
              const spreadSpec = effect.spreadEffectToAdjacentOnPulse;
              if (spreadSpec && tile && tile.hero && !tile._dead && Number(tile.currentHealth || 0) > 0) {
                const spreadEffectName = (typeof spreadSpec === 'string')
                  ? spreadSpec
                  : (spreadSpec.effect || spreadSpec.effectName || spreadSpec.name || '');
                const spreadEffect = spreadEffectName ? EFFECTS[spreadEffectName] : null;
                if (spreadEffect) {
                  const ownerRefForSpread = { boardName, index: idx, tile };
                  const sourceRow = indexToRow(idx, boardName.startsWith('p1') ? 'p1' : (boardName.startsWith('p2') ? 'p2' : 'p3'));
                  const sourceCol = indexToColumn(idx, boardName.startsWith('p1') ? 'p1' : (boardName.startsWith('p2') ? 'p2' : 'p3'));
                  for (let ai = 0; ai < (boardArr || []).length; ai++) {
                    if (ai === idx) continue;
                    const targetTile = (boardArr || [])[ai];
                    if (!targetTile || !targetTile.hero || targetTile._dead) continue;
                    const targetRow = indexToRow(ai, boardName.startsWith('p1') ? 'p1' : (boardName.startsWith('p2') ? 'p2' : 'p3'));
                    const targetCol = indexToColumn(ai, boardName.startsWith('p1') ? 'p1' : (boardName.startsWith('p2') ? 'p2' : 'p3'));
                    const isAdjacent = Math.abs(targetRow - sourceRow) + Math.abs(targetCol - sourceCol) === 1;
                    if (!isAdjacent) continue;

                    applyEffectsToTile(targetTile, [spreadEffect], addLog, ownerRefForSpread);
                    addLog && addLog(`  > ${effect.name || 'Effect'} spread ${spreadEffect.name} to ${boardName}[${ai}]`);
                  }
                }
              }
            } catch (e) {}

            // Optional: heal the applier when this effect deals pulse damage
            try {
              const healSpec = effect.healApplierOnPulse;
              if (healSpec) {
                const applierRef = resolveEffectApplierForPulse(effect);
                const healAmount = (typeof healSpec === 'number')
                  ? Number(healSpec || 0)
                  : (healSpec && typeof healSpec.amount === 'number' ? Number(healSpec.amount || 0) : 0);
                if (applierRef && applierRef.tile && !applierRef.tile._dead && healAmount > 0) {
                  if (typeof onStep === 'function') {
                    const lastAction = { type: 'effectPulse', target: { boardName: applierRef.boardName, index: applierRef.index }, effectName: effect.name, action: 'heal', amount: healAmount, effectIndex: ei };
                    onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction });
                  }
                  applyHealthDelta(applierRef.tile, healAmount);
                  addLog && addLog(`  > ${effect.name || 'Effect'} pulse healed applier ${applierRef.boardName}[${applierRef.index}] for ${healAmount}`);
                }
              }
            } catch (e) {}
            
            // Frenzy passive: add +1 energy when this tile takes damage
            // Only trigger if actual damage dealt is greater than 0
            try {
              if (finalPulseDamage > 0 && tile._passives && Array.isArray(tile._passives)) {
                const frenzy = tile._passives.find(e => e && e.name === 'Frenzy');
                if (frenzy) {
                  // Emit energyIncrement step BEFORE applying energy (so UI can show emote)
                  if (typeof onStep === 'function') {
                    onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'energyIncrement', target: { boardName, index: idx }, amount: 1, effectName: 'Frenzy' } });
                  }
                  // Wait for the emote animation to display
                  await new Promise(res => setTimeout(res, 800));
                  tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + 1;
                  clampEnergy(tile);
                  addLog && addLog(`  > ${boardName}[${idx}] gained 1 Energy from Frenzy (now ${tile.currentEnergy})`);
                }
              }
            } catch (e) {}
            
            // Collect onDamaged reactions (e.g., Prayer heals all allies when damaged)
            // Effect damage (from DOTs like Bleed, Burn) should always trigger onDamaged reactions
            // since there's no caster/spell to bypass triggers
            try {
              const seenOnDamaged = new Set();
              if (tile.effects && Array.isArray(tile.effects)) {
                (tile.effects || []).forEach((eff, effectIdx) => {
                  if (!eff || !eff.onDamaged) return;
                  if (eff.name) seenOnDamaged.add(eff.name);
                  const od = eff.onDamaged;
                  if (od.type === 'healAlliesExceptSelf') {
                    const healVal = Number(od.value || 0);
                    reactions.push({ type: 'healAlliesExceptSelf', ownerBoardName: boardName, ownerIndex: idx, effectName: eff.name, value: healVal, effectIndex: effectIdx });
                  }
                  if (od.type === 'damage') {
                    reactions.push({ type: 'damageAttacker', value: Number(od.value || 0), effectName: eff.name });
                  }
                });
              }

              const passiveList = (tile._passives && Array.isArray(tile._passives)) ? tile._passives : (tile.hero && Array.isArray(tile.hero.passives) ? tile.hero.passives : []);
              (passiveList || []).forEach((eff) => {
                if (!eff || !eff.onDamaged) return;
                if (eff.name && seenOnDamaged.has(eff.name)) return;
                const od = eff.onDamaged;
                if (od.type === 'healAlliesExceptSelf') {
                  const healVal = Number(od.value || 0);
                  reactions.push({ type: 'healAlliesExceptSelf', ownerBoardName: boardName, ownerIndex: idx, effectName: eff.name, value: healVal });
                }
                if (od.type === 'damage') {
                  reactions.push({ type: 'damageAttacker', value: Number(od.value || 0), effectName: eff.name });
                }
              });
            } catch (e) {}
          } else if (pulse.type === 'heal') {
            const v = Number(pulse.value || 0);
            addLog && addLog(`  > ${effect.name || 'Effect'} pulse will heal ${v} to ${boardName}[${idx}]`);
            
            // Emit UI step BEFORE applying heal
            try {
              if (typeof onStep === 'function') {
                const lastAction = { type: 'effectPulse', target: { boardName, index: idx }, effectName: effect.name, action: 'heal', amount: v, effectIndex: ei };
                onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction });
              }
            } catch (e) {}
            
            // Apply heal immediately
            applyHealthDelta(tile, v);
        }
    }
    
    try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'pulsesApplied' } }); } catch (e) {}

    // If any reactions were collected (e.g., Prayer onDamaged), emit precast + pulse events (client handles timing)
    if (reactions.length > 0) {
      // Deduplicate identical reactions within this pulse batch
      const dedupedReactions = [];
      const seenReactionKeys = new Set();
      reactions.forEach(rx => {
        if (!rx) return;
        const key = `${rx.type || ''}:${rx.effectName || ''}:${rx.effectIndex ?? ''}:${rx.attackerBoard || ''}:${rx.attackerIndex || ''}:${rx.ownerBoardName || ''}:${rx.ownerIndex || ''}:${rx.value || ''}`;
        if (seenReactionKeys.has(key)) return;
        seenReactionKeys.add(key);
        dedupedReactions.push(rx);
      });

      // Emit reaction precast + pulses (visual only)
      dedupedReactions.forEach((rx, rxIdx) => {
        if (rx.type === 'healAlliesExceptSelf') {
          const ownerSide = (rx.ownerBoardName || '').startsWith('p1')
            ? 'p1'
            : ((rx.ownerBoardName || '').startsWith('p2') ? 'p2' : 'p3');
          const ownerArr = ownerSide === 'p1' ? cP1 : (ownerSide === 'p2' ? cP2 : cP3);
          (ownerArr || []).forEach((allyTile, ai) => {
            if (!allyTile) return;
            if (ai === rx.ownerIndex) return;
            try {
              if (typeof onStep === 'function') {
                const pre = { type: 'effectPreCast', target: { boardName: ownerSide === 'p1' ? 'p1Board' : (ownerSide === 'p2' ? 'p2Board' : 'p3Board'), index: ai }, effectName: rx.effectName, amount: rx.value, scale: getEffectPrecastScale(rx.value), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
                const lastAction = { type: 'effectPulse', target: { boardName: ownerSide === 'p1' ? 'p1Board' : (ownerSide === 'p2' ? 'p2Board' : 'p3Board'), index: ai }, effectName: rx.effectName, action: 'heal', amount: rx.value, reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
              }
            } catch (e) {}
          });
        }
        if (rx.type === 'damageAttacker') {
          try {
            // best-effort: if attacker info present, show damage pulse; otherwise skip
            if (rx.attackerBoard && typeof rx.attackerIndex === 'number') {
              const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : (rx.attackerBoard === 'p2Board' ? cP2 : cP3);
              const atk = (aBoard || [])[rx.attackerIndex];
              if (atk) {
                if (typeof onStep === 'function') {
                  const vsResult = applyVoidShieldReduction(atk, Number(rx.value || 0));
                  // effectPreCast should flash the OWNER's effect icon (hero with the effect), not the attacker
                  const ownerTarget = (rx.ownerBoardName && typeof rx.ownerIndex === 'number')
                    ? { boardName: rx.ownerBoardName, index: rx.ownerIndex }
                    : { boardName: rx.attackerBoard, index: rx.attackerIndex };
                  const pre = { type: 'effectPreCast', target: ownerTarget, effectName: rx.effectName, amount: vsResult.damage, scale: getEffectPrecastScale(vsResult.damage), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
                  // effectPulse shows damage on the ATTACKER
                  const lastAction = { type: 'effectPulse', target: { boardName: rx.attackerBoard, index: rx.attackerIndex }, effectName: rx.effectName, action: 'damage', amount: vsResult.damage };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
                }
              }
            }
          } catch (e) {}
        }
      });

      // Apply reactions' effects to the board state now
      dedupedReactions.forEach(rx => {
        if (rx.type === 'healAlliesExceptSelf') {
          const ownerSide = (rx.ownerBoardName || '').startsWith('p1')
            ? 'p1'
            : ((rx.ownerBoardName || '').startsWith('p2') ? 'p2' : 'p3');
          const ownerArr = ownerSide === 'p1' ? cP1 : (ownerSide === 'p2' ? cP2 : cP3);
          (ownerArr || []).forEach((allyTile, ai) => {
            if (!allyTile) return;
            if (ai === rx.ownerIndex) return;
            applyHealthDelta(allyTile, Number(rx.value || 0));
            addLog && addLog(`  > ${rx.effectName} applied heal ${rx.value} to ${(ownerSide === 'p1' ? 'p1Board' : (ownerSide === 'p2' ? 'p2Board' : 'p3Board'))}[${ai}]`);
          });
        }
        if (rx.type === 'damageAttacker') {
          if (typeof rx.attackerBoard !== 'undefined' && typeof rx.attackerIndex === 'number') {
            const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : (rx.attackerBoard === 'p2Board' ? cP2 : cP3);
            const atk = (aBoard || [])[rx.attackerIndex];
            if (atk) {
                const dmg = Number(rx.value || 0);
                const vsResult = applyVoidShieldReduction(atk, dmg);
                applyHealthDelta(atk, -vsResult.damage);
                addLog && addLog(`  > ${rx.effectName} applied ${vsResult.damage} damage to ${rx.attackerBoard}[${rx.attackerIndex}]`);
            }
          }
        }
      });

      try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'reactionsApplied' } }); } catch (e) {}
    }

    // Mark newly-dead tiles after pulses and reactions so reaction emotes render first
    try {
      const allBoardsLocal = [
        { arr: cP1, name: 'p1Board' },
        { arr: cP2, name: 'p2Board' },
        { arr: cP3, name: 'p3Board' },
        { arr: cR1, name: 'p1Reserve' },
        { arr: cR2, name: 'p2Reserve' },
        { arr: cR3, name: 'p3Reserve' }
      ];
      const deadNow = [];
      allBoardsLocal.forEach(b => {
        (b.arr || []).forEach((t, i) => {
          if (!t || !t.hero) return;
          const hp = (t.currentHealth != null ? t.currentHealth : (t.hero && t.hero.health) || 0);
          if (hp <= 0) {
            // Check for Undying Rage passive before marking as dead
            let shouldDie = true;
            try {
              if (!t._passives && t.hero && t.hero.passives) {
                t._passives = t.hero.passives.map(e => ({ ...e }));
              }
              if (t._passives && Array.isArray(t._passives)) {
                const ur = t._passives.find(p => p && (p.name === 'Undying Rage' || p.name === 'UndyingRage') && !p._used);
                if (ur) {
                  ur._used = true;
                  t.currentHealth = 1;
                  shouldDie = false;
                  addLog && addLog(`  > ${b.name}[${i}] Undying Rage triggered! Survived with 1 HP.`);
                }
                const rg = t._passives.find(p => p && (p.name === 'Regeloop' || p.name === 'RegelOOP' || p.name === 'REGLOOP'));
                if (rg && (rg._uses == null || rg._uses < 3)) {
                  rg._uses = Number(rg._uses || 0) + 1;
                  t.currentHealth = 4;
                  t.effects = (t.effects || []).filter(e => !(e && (e.kind === 'buff' || e.kind === 'debuff')));
                  try { recomputeModifiers(t); } catch (e) {}
                  shouldDie = false;
                  addLog && addLog(`  > ${b.name}[${i}] Regeloop triggered (${rg._uses}/3)! Restored to 4 HP and cleansed buffs/debuffs.`);
                }
              }
            } catch (e) {}
            if (shouldDie && tryPhoenixRebirth(t, b.name, i)) {
              shouldDie = false;
            }
            if (shouldDie) {
              deadNow.push({ boardName: b.name, index: i, tile: t });
            }
          }
        });
      });
      if (deadNow.length > 0 && typeof onStep === 'function') {
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'preDeath' } }); } catch (e) {}
      }
      deadNow.forEach(dead => {
        try {
          const { boardName, index, tile } = dead;
          if (!tile) return;
          if (tile.hero && tile.hero.leavesCorpse === false) {
            const removedName = tile.hero && tile.hero.name ? tile.hero.name : 'minion';
            tile.hero = null;
            tile._dead = false;
            tile.effects = [];
            tile.currentHealth = null;
            tile.currentArmor = null;
            tile.currentSpeed = null;
            tile.currentEnergy = null;
            tile.spellCasts = [];
            tile._castsRemaining = null;
            tile._passives = null;
            addLog && addLog(`  > Removed ${removedName} from ${boardName}[${index}] on death`);
            return;
          }
          tile._dead = true;
          tile.effects = [];
          tile.spellCasts = [];
          tile.currentEnergy = 0;
          addLog && addLog(`  > Marked ${boardName}[${index}] as dead and cleared effects (start-of-round)`);
        } catch (e) {}
      });
      if (deadNow.length > 0 && typeof onStep === 'function') {
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'deathApplied' } }); } catch (e) {}
      }
    } catch (e) {}
  };

  // Helper: process onRoundStart triggers that have spellSpec and resolve them immediately
  const processOnRoundStart = (boardArr, boardName) => {
    for (let idx = 0; idx < (boardArr || []).length; idx++) {
      const tile = (boardArr || [])[idx];
      if (!tile || !tile.effects) continue;
      for (let ei = 0; ei < (tile.effects || []).length; ei++) {
        const effect = (tile.effects || [])[ei];
        if (!effect) continue;
        if (effect.trigger === 'onRoundStart' && effect.spellSpec) {
          addLog && addLog(`  > Triggering onRoundStart effect ${effect.name} from ${boardName}[${idx}]`);
          const ownerRef = { boardName, index: idx, tile };
          const applierRef = (effect && effect.appliedBy) ? effect.appliedBy : ownerRef;
          const runtimeList = (() => {
            const boards = { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 };
            if (!isFfa3 || !effect.spellSpec || !Array.isArray(effect.spellSpec.targets)) {
              return [buildPayloadFromSpec(effect.spellSpec, applierRef, boards, ownerRef)];
            }
            const casterSide = (boardName || '').startsWith('p1') ? 'p1' : ((boardName || '').startsWith('p2') ? 'p2' : 'p3');
            const descs = effect.spellSpec.targets || [];
            const isEnemyDesc = (d) => d && (d.side || 'enemy') === 'enemy' && d.type !== 'self';
            const enemyDescs = descs.filter(d => isEnemyDesc(d));
            const nonEnemyDescs = descs.filter(d => !isEnemyDesc(d));
            const out = [];
            if (nonEnemyDescs.length > 0) {
              out.push(buildPayloadFromSpec({ ...effect.spellSpec, targets: nonEnemyDescs }, applierRef, boards, ownerRef, { forceAllySide: casterSide }));
            }
            if (enemyDescs.length > 0) {
              const aliveSides = getAliveSidesMain(cP1, cP2, cP3).filter(s => s !== casterSide);
              aliveSides.forEach((side) => {
                out.push(buildPayloadFromSpec({ ...effect.spellSpec, targets: enemyDescs }, applierRef, boards, ownerRef, { forceEnemySide: side }));
              });
            }
            return out.length > 0 ? out : [buildPayloadFromSpec(effect.spellSpec, applierRef, boards, ownerRef)];
          })();

          const pendingRoundStartChanges = [];

          runtimeList.forEach((runtime) => {
            if (!runtime) return;
            runtime.source = `${boardName}[${idx}]`;
            const tdescs = runtime && runtime.targets ? runtime.targets : (runtime && runtime.rawTargets ? runtime.rawTargets : []);
            const targetTokens = Array.isArray(tdescs) ? tdescs : [tdescs];

            // Emit effectPulse for each target before applying (so UI shows damage floats)
            for (let ti = 0; ti < targetTokens.length; ti++) {
              const tdesc = targetTokens[ti];
              const tref = findTileInBoards(tdesc, cP1, cP2, cP3, cR1, cR2, cR3);
              if (!tref || !tref.tile) continue;

              const perPayload = (runtime.perTargetPayloads && runtime.perTargetPayloads[ti]) ? runtime.perTargetPayloads[ti] : runtime;
              const applied = (perPayload && perPayload.action)
                ? applyPayloadToTarget({ ...perPayload, source: runtime.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, onStep, false)
                : null;

              if (applied && applied.type === 'damage') pendingRoundStartChanges.push({ boardName: tref.boardName, index: tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0) });
              if (applied && applied.type === 'heal') pendingRoundStartChanges.push({ boardName: tref.boardName, index: tref.index, deltaHealth: Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0) });

              let pulseAction = null;
              let pulseAmount = 0;
              if (applied && applied.type === 'damage') { pulseAction = 'damage'; pulseAmount = Number(applied.amount || 0); }
              if (applied && applied.type === 'heal') { pulseAction = 'heal'; pulseAmount = Number(applied.amount || 0); }

              if (pulseAction && typeof onStep === 'function') {
                const lastAction = { type: 'effectPulse', target: { boardName: tref.boardName, index: tref.index }, effectName: effect.name, action: pulseAction, amount: pulseAmount, effectIndex: ei };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
              }
            }

            for (let ti = 0; ti < targetTokens.length; ti++) {
              const tdesc = targetTokens[ti];
              const tref = findTileInBoards(tdesc, cP1, cP2, cP3, cR1, cR2, cR3);
              if (runtime.effects && runtime.effects.length > 0) applyEffectsToTile(tref && tref.tile, runtime.effects, addLog, ownerRef);
            }
          });

          // Apply the actual damage/heal and effects after pulses
          pendingRoundStartChanges.forEach(ch => {
            try {
              const arr = (ch.boardName || '').startsWith('p1')
                ? cP1
                : ((ch.boardName || '').startsWith('p2') ? cP2 : cP3);
              const tile = (arr || [])[ch.index];
              if (!tile) return;
              if (typeof ch.deltaHealth === 'number') applyHealthDelta(tile, Number(ch.deltaHealth || 0));
              if (typeof ch.deltaEnergy === 'number') tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + Number(ch.deltaEnergy || 0);
            } catch (e) {}
          });
          
          // Emit a state update after all targets processed
          try {
            if (typeof onStep === 'function') {
              const lastAction = { type: 'onRoundStartTriggered', effectName: effect.name, source: { boardName, index: idx } };
              try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
            }
          } catch (e) {}
        }
      }
    }
  };

  // Apply pulses and onRoundStart triggers before collecting casts
  // Only main boards process pulses and onRoundStart triggers; reserves are inert
  await applyEffectPulses(cP1, 'p1Board');
  await applyEffectPulses(cP2, 'p2Board');
  await applyEffectPulses(cP3, 'p3Board');

  processOnRoundStart(cP1, 'p1Board');
  processOnRoundStart(cP2, 'p2Board');
  processOnRoundStart(cP3, 'p3Board');

  // Optional short pause after effect pulses/onRoundStart triggers so UI can show damage animations
  if (typeof postEffectDelayMs === 'number' && postEffectDelayMs > 0) {
    addLog && addLog(`Pausing ${postEffectDelayMs}ms after onRoundStart effects before casting`);
    try {
      if (typeof onStep === 'function') {
        const pauseAction = { type: 'postEffectDelay', duration: Number(postEffectDelayMs) };
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pauseAction }); } catch (e) {}
      }
    } catch (e) {}
    await new Promise(res => setTimeout(res, Number(postEffectDelayMs)));
  }

  // Apply energy increments sequentially (emit event BEFORE applying each increment)
  // Only main boards gain energy after effect pulses/onRoundStart; reserve heroes do not gain energy.
  try {
    for (const arr of [cP1, cP2, cP3]) {
      for (let i = 0; i < arr.length; i++) {
        const tile = arr[i];
        if (tile && tile.hero) {
          // Calculate energy gain amount (based on speed)
          const speed = Number(tile.currentSpeed != null ? tile.currentSpeed : (tile.hero && tile.hero.speed) || 0);
          const energyGain = speed;
          
          // Emit energyIncrement event with PRE-INCREMENT state
          if (typeof onStep === 'function') {
            onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'energyIncrement', target: { boardName: tile.boardName, index: tile.index }, amount: energyGain } });
          }
          // Now apply the energy increment for this specific hero
          incEnergy(tile);
        }
      }
    }
    // Emit gameState after all energy increments applied
    if (typeof onStep === 'function') {
      onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'energyApplied' } });
    }
  } catch (e) {}

  // PROCESS PASSIVES: Accept Contract -- if any tile gained more than 4 energy this start,
  // and an enemy tile has the Accept Contract passive effect active, apply Mark to that tile.
  try {
    const applyAcceptContract = (boardArr, enemyArr, boardName) => {
      (boardArr || []).forEach((tile, idx) => {
        if (!tile || !tile.hero) return;
        const gained = Number(tile._energyGainedThisStart || 0);
        // check for threshold crossing: previous energy <=4 and now >4
        const prev = Number(tile._energyBeforeStart || 0);
        const now = Number(tile.currentEnergy || 0);
        if (!(prev <= 4 && now > 4)) return;
        // any enemy with Accept Contract passive should cause this tile to gain Mark
        (enemyArr || []).forEach((etile, eidx) => {
          if (!etile || !etile.hero || etile._dead) return; // dead heroes cannot trigger passives
          const hasAccept = (etile._passives || []).some(e => e && e.name === 'Accept Contract') || (etile.hero && (etile.hero.passives || []).some(e => e && e.name === 'Accept Contract'));
          if (hasAccept) {
            // apply Mark effect to this tile if not already present
            const already = (tile.effects || []).some(e => e && e.name === 'Marked');
            if (!already) {
              tile.effects = tile.effects || [];
              const mark = { ...EFFECTS.Marked };
              // ensure proper duration clone
              tile.effects.push(mark);
              addLog && addLog(`  > Accept Contract: applied Mark to ${boardName}[${idx}] because enemy has Accept Contract`);
            }
          }
        });
      });
    };
    applyAcceptContract(cP1, cP2, 'p1Board');
    applyAcceptContract(cP1, cP3, 'p1Board');
    applyAcceptContract(cP2, cP1, 'p2Board');
    applyAcceptContract(cP2, cP3, 'p2Board');
    applyAcceptContract(cP3, cP1, 'p3Board');
    applyAcceptContract(cP3, cP2, 'p3Board');
  } catch (e) {}

  // PROCESS PASSIVES/EFFECTS: Reap -- if a hero's health crosses to 2 or below,
  // and an enemy has Reap active, execute that hero for 999 damage.
  const applyReapExecutions = ({ contextTag = 'round' } = {}) => {
    try {
      const sideData = [
        { side: 'p1', boardName: 'p1Board', arr: cP1 },
        { side: 'p2', boardName: 'p2Board', arr: cP2 },
        { side: 'p3', boardName: 'p3Board', arr: cP3 }
      ];
      const sideHasReap = { p1: false, p2: false, p3: false };

      sideData.forEach(({ side, arr }) => {
        sideHasReap[side] = (arr || []).some(tile => {
          if (!tile || !tile.hero || tile._dead) return false;
          const effects = Array.isArray(tile.effects) ? tile.effects : [];
          const passives = Array.isArray(tile._passives)
            ? tile._passives
            : (tile.hero && Array.isArray(tile.hero.passives) ? tile.hero.passives : []);
          return [...effects, ...passives].some(e => e && (e.name === 'Reap' || Number(e.executeAtOrBelowHealth || 0) > 0));
        });
      });

      sideData.forEach(({ side, boardName, arr }) => {
        const enemySides = isFfa3
          ? ['p1', 'p2', 'p3'].filter(s => s !== side && sideHasReap[s])
          : [(side === 'p1' ? 'p2' : 'p1')].filter(s => sideHasReap[s]);

        if (enemySides.length === 0) {
          (arr || []).forEach(tile => {
            if (!tile || !tile.hero || tile._dead) return;
            const hp = Number((typeof tile.currentHealth === 'number') ? tile.currentHealth : ((tile.hero && tile.hero.health) || 0));
            tile._lastReapObservedHealth = hp;
          });
          return;
        }

        (arr || []).forEach((tile, idx) => {
          if (!tile || !tile.hero || tile._dead) return;
          const hp = Number((typeof tile.currentHealth === 'number') ? tile.currentHealth : ((tile.hero && tile.hero.health) || 0));
          const prevHp = Number.isFinite(Number(tile._lastReapObservedHealth)) ? Number(tile._lastReapObservedHealth) : Number.POSITIVE_INFINITY;
          const crossedThreshold = prevHp > 2 && hp <= 2 && hp > 0;
          if (crossedThreshold) {
            const executeDamage = Number(EFFECTS.Reap && EFFECTS.Reap.executeDamage ? EFFECTS.Reap.executeDamage : 999);
            if (typeof onStep === 'function') {
              const lastAction = { type: 'effectPulse', target: { boardName, index: idx }, effectName: 'Reap', action: 'damage', amount: executeDamage, phase: 'secondary' };
              try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
            }
            applyHealthDelta(tile, -executeDamage);
            addLog && addLog(`  > Reap (${contextTag}) executed ${boardName}[${idx}] for ${executeDamage} (HP crossed to <= 2)`);
          }
          tile._lastReapObservedHealth = Number((typeof tile.currentHealth === 'number') ? tile.currentHealth : hp);
        });
      });
    } catch (e) {}
  };

  applyReapExecutions({ contextTag: 'roundStart' });

// Helper: map tile index to slot ('front','middle','back') for either player's board
function slotForIndex(boardName, idx) {
  const mod = (idx % 3 + 3) % 3;
  if (String(boardName || '').startsWith('p1')) {
    return mod === 0 ? 'back' : (mod === 1 ? 'middle' : 'front');
  }
  if (String(boardName || '').startsWith('p3')) {
    const row = Math.floor(((idx || 0) + 9) % 9 / 3);
    return row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
  }
  return mod === 0 ? 'front' : (mod === 1 ? 'middle' : 'back');
}

function evaluateGameWinner(p1Board, p2Board, p3Board) {
  const aliveP1 = (p1Board || []).some(t => t && t.hero && !t._dead);
  const aliveP2 = (p2Board || []).some(t => t && t.hero && !t._dead);
  const aliveP3 = (p3Board || []).some(t => t && t.hero && !t._dead);
  const aliveCount = (aliveP1 ? 1 : 0) + (aliveP2 ? 1 : 0) + (aliveP3 ? 1 : 0);
  if (aliveCount === 0) return 'draw';
  if (aliveCount === 1) return aliveP1 ? 'player1' : (aliveP2 ? 'player2' : 'player3');
  return null;
}

  // Auto-cast: tiles automatically enqueue casts when they have enough energy
  const autoCastFromBoard = (boardArr, boardName) => {
    (boardArr || []).forEach((tile, idx) => {
      if (!tile || !tile.hero) return;
      if (tile._dead) return; // dead heroes do not auto-cast
      // initialize per-tile remaining-casts tracker
      if (!tile._castsRemaining) {
        tile._castsRemaining = {
          front: tile.hero.spells && tile.hero.spells.front ? (tile.hero.spells.front.casts || 0) : 0,
          middle: tile.hero.spells && tile.hero.spells.middle ? (tile.hero.spells.middle.casts || 0) : 0,
          back: tile.hero.spells && tile.hero.spells.back ? (tile.hero.spells.back.casts || 0) : 0,
        };
      }

      const slot = slotForIndex(boardName, idx);
      const spec = tile.hero.spells && tile.hero.spells[slot];
      // Track the last energy value when we auto-cast for this tile so repeated
      // auto-cast passes do not re-enqueue identical casts unless the tile's
      // visible energy has increased since the last pass (e.g. gained from Frenzy).
      if (typeof tile._lastAutoCastEnergy === 'undefined') tile._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
      let basicQueued = false;
      // compute casts remaining for the current slot at start of this auto-cast pass
      // and total remaining across all slots. Basic attacks should only be
      // considered when the hero has no casts remaining across any slot.
      const slotRemainingAtStart = (tile._castsRemaining && Number(tile._castsRemaining[slot] || 0)) || 0;
      const totalCastsRemaining = (tile._castsRemaining ? (Number(tile._castsRemaining.front || 0) + Number(tile._castsRemaining.middle || 0) + Number(tile._castsRemaining.back || 0)) : 0);
      // prepare locals that we may reuse after enqueuing spec casts
      let cost = 0;
      let remaining = tile._castsRemaining ? Number(tile._castsRemaining[slot] || 0) : 0;
      let energy = tile.currentEnergy || 0;
      // energyCursorForPost represents leftover energy after reserving/enqueuing
      // any new casts for this slot. Use this when deciding whether to enqueue
      // a post-cast basic attack so we don't base it on the pre-enqueue snapshot.
      let energyCursorForPost = energy;
      // Diagnostic log to help trace basic-attack eligibility (report slot remaining)
      addLog && addLog(`Auto-cast check ${boardName}[${idx}] _castsRemaining=${JSON.stringify(tile._castsRemaining)} slotRemainingAtStart=${slotRemainingAtStart}`);
      if (spec && spec.id) {
        cost = Number(spec.cost || 0);
        // allow multiple casts in the same round while energy and remaining allow
        // but only enqueue if the tile's energy increased since the last auto-cast
        // pass. This prevents duplicate enqueues when auto-cast is re-run.
        if (!(Number(tile.currentEnergy || 0) > Number(tile._lastAutoCastEnergy || Number.NEGATIVE_INFINITY))) {
          addLog && addLog(`  > Skipping auto-enqueue for ${boardName}[${idx}] — no energy increase (now ${tile.currentEnergy}, last ${tile._lastAutoCastEnergy})`);
        } else {
          // Prepare queued list and compute how many new entries we should add.
          // If there are already queued entries for this exact spell+slot, update
          // the earliest existing entry's `queuedEnergy` to reflect a higher
          // visible energy snapshot instead of blindly pushing a new entry.
          tile.spellCasts = tile.spellCasts || [];
          const existingEntries = tile.spellCasts.filter(sc => sc && sc.spellId === spec.id && sc.slot === slot);
          // total cost already reserved by existing queued entries of this spell
          const existingReservedCost = (existingEntries.length || 0) * cost;
          // energy available for creating NEW queued entries beyond existing ones

          let energyAvailableForNew = Math.max(0, energy - existingReservedCost);
          energyCursorForPost = energyAvailableForNew;

          // If an existing queued entry exists, merge by bumping its queuedEnergy
          // to the higher snapshot (so it will order correctly) and ensure it has
          // a stable queuedId. This prevents creating duplicate queued entries
          // for the same spell when Frenzy/other effects increase energy mid-round.
          if (existingEntries.length > 0) {
            const firstExisting = existingEntries[0];
            const prevQE = (typeof firstExisting.queuedEnergy === 'number') ? firstExisting.queuedEnergy : 0;
            const newQE = Math.max(prevQE, energy);
            if (newQE !== prevQE) {
              firstExisting.queuedEnergy = newQE;
              addLog && addLog(`Auto-cast merge ${spec.id} for ${boardName}[${idx}] updating queuedEnergy ${prevQE} -> ${newQE}`);
            } else {
              addLog && addLog(`Auto-cast merge ${spec.id} for ${boardName}[${idx}] — existing queuedEnergy ${prevQE} unchanged`);
            }
            if (typeof firstExisting.queuedId === 'undefined' || firstExisting.queuedId === null) firstExisting.queuedId = ++_queuedCastCounter;
          }

          // How many additional casts can we enqueue beyond existing entries
          const alreadyQueuedCount = existingEntries.length;
          let toEnqueue = Math.max(0, remaining - alreadyQueuedCount);
          // Use an energy cursor derived from leftover energy after reserving existing entries
          let energyCursor = energyAvailableForNew;
          while (toEnqueue > 0 && energyCursor >= cost && cost >= 0) {
            const entry = { spellId: spec.id, queuedEnergy: energyCursor, slot };
            entry.queuedId = ++_queuedCastCounter;
            tile.spellCasts.push(entry);
            energyCursor = Math.max(0, energyCursor - cost);
            remaining = remaining - 1;
            toEnqueue = toEnqueue - 1;
            addLog && addLog(`Auto-cast ${spec.id} from ${boardName}[${idx}] (cost ${cost}, remainingAfterEnqueue ${remaining}, queuedEnergy ${Math.max(0, energyCursor + cost)})`);
          }
          // after enqueuing, energyCursor holds the leftover energy available
          energyCursorForPost = energyCursor;
          // record the snapshot energy so subsequent auto-cast passes won't re-enqueue
          tile._lastAutoCastEnergy = Number(tile.currentEnergy || 0);
        }
        // Do NOT modify tile.currentEnergy here; visual energy remains until cast resolves.
      }

      // If we had a spell slot and we consumed all casts for that slot during enqueuing,
      // allow a basic attack with any leftover energy (this supports e.g. 1-slot left + extra energy).
      try {
        if (spec && spec.id) {
          // Only enqueue a post-cast basic when THIS slot started with >0 casts
          // and we consumed them during this auto-enqueue pass (i.e. remaining <= 0).
          // This prevents re-adding a basic attack on subsequent passes when no
          // energy increase occurred.
          if (slotRemainingAtStart > 0 && remaining <= 0 && energyCursorForPost >= 1 && !basicQueued) {
            tile.spellCasts = tile.spellCasts || [];
            const alreadyBasic = tile.spellCasts.some(sc => sc && sc.spellId === 'basicAttack' && sc.slot === 'basic' && sc.queuedEnergy === energyCursorForPost);
            if (!alreadyBasic) {
              const be = { spellId: 'basicAttack', queuedEnergy: energyCursorForPost, queuedCost: energyCursorForPost, slot: 'basic' };
              be.queuedId = ++_queuedCastCounter;
              tile.spellCasts.push(be);
            }
            basicQueued = true;
            addLog && addLog(`Post-cast basicAttack from ${boardName}[${idx}] due to leftover energy ${energyCursorForPost} after exhausting slot ${slot}`);
          }
        }
      } catch (e) {}
      // If the slot has no spell OR the hero started the pass with zero casts remaining
      // (meaning they are out of casts across all slots), allow a basic attack while energy permits.
      try {
        let energyForBasic = tile.currentEnergy || 0;
        const heroSlotExhausted = slotRemainingAtStart <= 0;
        if ((!spec || !spec.id) || heroSlotExhausted) {
          if (heroSlotExhausted) addLog && addLog(`  > ${boardName}[${idx}] slotRemainingAtStart=0 — basic attack eligible for slot ${slot}`);
          if (energyForBasic >= 1 && !basicQueued) {
              // basic attack consumes all current energy at resolution time; attach queuedCost
              tile.spellCasts = tile.spellCasts || [];
              const alreadyBasic = tile.spellCasts.some(sc => sc && sc.spellId === 'basicAttack' && sc.slot === 'basic' && sc.queuedEnergy === energyForBasic);
              if (!alreadyBasic) {
                const be = { spellId: 'basicAttack', queuedEnergy: energyForBasic, queuedCost: energyForBasic, slot: 'basic' };
                be.queuedId = ++_queuedCastCounter;
                tile.spellCasts.push(be);
              }
            basicQueued = true;
            addLog && addLog(`Auto-cast basicAttack from ${boardName}[${idx}] (queuedEnergy ${energyForBasic})`);
          } else {
            addLog && addLog(`  > ${boardName}[${idx}] basic attack eligible but insufficient energy (${energyForBasic})`);
          }
        } else {
          addLog && addLog(`  > ${boardName}[${idx}] has casts remaining, skipping basic attack`);
        }
      } catch (e) {}
      // If after auto-cast attempts this tile ended up with no queued casts but has energy,
      // enqueue a basic attack as a fallback. This ensures heroes who are out of casts
      // still perform a basic attack when they have energy.
      try {
        // Only enqueue fallback basic attack when this slot truly has no casts remaining
        // and nothing else was queued for this tile.
        const slotRemainingAtStartForFallback = (tile._castsRemaining && Number(tile._castsRemaining[slot] || 0)) || 0;
        if ((tile.spellCasts || []).length === 0 && slotRemainingAtStartForFallback <= 0) {
          const eNow = tile.currentEnergy || 0;
          if (eNow >= 1 && !basicQueued) {
            tile.spellCasts = tile.spellCasts || [];
            const alreadyFb = tile.spellCasts.some(sc => sc && sc.spellId === 'basicAttack' && sc.slot === 'basic' && sc.queuedEnergy === eNow);
            if (!alreadyFb) {
              const fe = { spellId: 'basicAttack', queuedEnergy: eNow, queuedCost: eNow, slot: 'basic' };
              fe.queuedId = ++_queuedCastCounter;
              tile.spellCasts.push(fe);
            }
            addLog && addLog(`Fallback basicAttack enqueued for ${boardName}[${idx}] (queuedEnergy ${eNow})`);
          }
        }
      } catch (e) {}
    });
  };

  // Auto-cast only on main boards. Reserve slots should not auto-cast.
  autoCastFromBoard(cP1, 'p1Board');
  autoCastFromBoard(cP2, 'p2Board');
  if (isFfa3) autoCastFromBoard(cP3, 'p3Board');

  // Collect casts initially
  let pendingCasts = collectSpellCasts(cP1, cP2, cP3, cR1, cR2, cR3);
  if (pendingCasts.length > 0) addLog && addLog(`Found ${pendingCasts.length} pending cast(s)`);

  // We will process casts in a dynamic loop. After each cast is resolved we
  // re-run auto-cast collection to allow tiles that gained energy mid-round
  // (e.g. from Frenzy) to enqueue casts and act during the same round.
  const processedQueuedIds = new Set();
  while (pendingCasts.length > 0) {
    // Order pending casts and pick the next one to resolve
    const go = getCastOrder(pendingCasts, cP1, cP2, cP3, priorityPlayer, addLog);
    const ordered = go.ordered;
    priorityPlayer = go.priorityPlayer;
    if (!ordered || ordered.length === 0) break;
    const cast = ordered[0];
    // recentDamageEvents collects deferred damage applied during this cast
    // so we can attribute kills to their sources (used for passives like Bounty)
    let recentDamageEvents = [];
    const src = cast.caster;
    const casterHero = src && src.tile && src.tile.hero ? src.tile.hero : null;
    const baseBoards = { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 };
    const isDamageSpec = (spec) => {
      const t = spec && spec.formula && spec.formula.type;
      return t === 'attackPower' || t === 'damage' || t === 'roll';
    };
    let bonusSpellPowerForCast = 0;
    if (roundNumber === 1 && casterHero && casterHero._towerEarlySpark) {
      bonusSpellPowerForCast = Number(casterHero._towerEarlySpark || 0);
    }
    const consumeArcaneExchangeBonus = (spec) => {
      if (src && src.tile && src.tile._towerArcaneExchangeReady && isDamageSpec(spec)) {
        src.tile._towerArcaneExchangeReady = false;
        return 2;
      }
      return 0;
    };
    const getBonusOptions = (spec, spellIdForSpec) => {
      let bonusDamage = 0;
      let bonusSpellPower = bonusSpellPowerForCast;
      if (casterHero && casterHero._towerKeenStrike && spellIdForSpec === 'basicAttack') {
        bonusDamage += Number(casterHero._towerKeenStrike || 1);
      }
      bonusDamage += consumeArcaneExchangeBonus(spec);
      if (casterHero && casterHero._towerLastStand && isDamageSpec(spec)) {
        try {
          const maxHealth = Number((casterHero && casterHero.health) || 0);
          const curHealth = Number((src && src.tile && typeof src.tile.currentHealth === 'number') ? src.tile.currentHealth : maxHealth);
          if (maxHealth > 0 && curHealth / maxHealth <= 0.25) {
            bonusSpellPower += 3;
          }
        } catch (e) {}
      }
      return { bonusSpellPower, bonusDamage };
    };
    addLog && addLog(`Resolving cast from ${src.boardName}[${src.index}] payload=${JSON.stringify(cast.payload)}`);

    // If the caster is dead at resolution time skip the cast entirely.
    // Casts are collected at the start of the round, but should not execute
    // if the caster was killed earlier in the same round.
    try {
      if (!src || !src.tile || !src.tile.hero || src.tile._dead || (typeof src.tile.currentHealth === 'number' && src.tile.currentHealth <= 0)) {
        addLog && addLog(`  > Skipping cast from ${src && src.boardName ? src.boardName : 'unknown'}[${src && typeof src.index === 'number' ? src.index : '?'}] — caster is dead`);
        // Remove this cast from pending list and from the caster's queued list
        try { if (cast && cast.payload && typeof cast.payload.queuedId !== 'undefined' && src && src.tile && Array.isArray(src.tile.spellCasts)) { src.tile.spellCasts = src.tile.spellCasts.filter(sc => sc && sc.queuedId !== cast.payload.queuedId); } } catch(e){}
        pendingCasts = pendingCasts.filter(pc => !(pc.payload && typeof pc.payload.queuedId !== 'undefined' && pc.payload.queuedId === (cast.payload && cast.payload.queuedId)));
        continue;
      }
    } catch (e) {}

    // If payload references a spell id, resolve it to a spec; otherwise support inline spec objects
    let runtimePayload = cast.payload;
    if (cast.payload && cast.payload.spellId) {
      const spell = getSpellById(cast.payload.spellId);
      if (spell && spell.spec) {
        // Special case: ensure Cone of Cold targets front+middle rows (frontTwoRows) to match visual mapping
        if (spell.id === 'coneOfCold') {
          const modifiedSpec = { ...spell.spec, targets: [{ type: 'frontTwoRows', side: 'enemy' }] };
          const bonusOptions = getBonusOptions(modifiedSpec, spell.id);
          runtimePayload = buildPayloadFromSpec(modifiedSpec, src, baseBoards, null, bonusOptions);
          runtimePayload._bonusOptions = bonusOptions;
        } else if (spell.id === 'copyCat') {
          // Special-case: perform the last spell cast by an enemy Hero, as though `src` is the caster.
          // We only do this if there is a previous cast and it was performed by the opposing side.
          try {
            const casterBoard = src && src.boardName && String(src.boardName).startsWith('p1') ? 'p1' : (src && src.boardName && String(src.boardName).startsWith('p2') ? 'p2' : 'p3');
            const enemyBoards = casterBoard === 'p1' ? ['p2', 'p3'] : (casterBoard === 'p2' ? ['p1', 'p3'] : ['p1', 'p2']);
            const lastEnemyCastAction = enemyBoards.map(b => lastCastBySide[b]).filter(Boolean).slice(-1)[0] || null;
            if (lastEnemyCastAction && lastEnemyCastAction.type === 'cast' && lastEnemyCastAction.spellId) {
              const copied = getSpellById(lastEnemyCastAction.spellId);
                if (copied && copied.spec) {
                  const bonusOptions = getBonusOptions(copied.spec, copied.id);
                  runtimePayload = buildPayloadFromSpec(copied.spec, src, baseBoards, null, bonusOptions);
                  runtimePayload._bonusOptions = bonusOptions;
                  runtimePayload._copiedFrom = lastEnemyCastAction.caster || null;
                  runtimePayload._copiedSpellId = copied.id;
                  addLog && addLog(`  > CopyCat: ${src.boardName}[${src.index}] will attempt to perform ${String(lastEnemyCastAction.spellId || '')}`);
                } else {
                  // Nothing to copy — fallback to a no-op payload
                  const bonusOptions = getBonusOptions({ targets: [] }, null);
                  runtimePayload = buildPayloadFromSpec({ targets: [] }, src, baseBoards, null, bonusOptions);
                  runtimePayload._bonusOptions = bonusOptions;
                }
            } else {
              const bonusOptions = getBonusOptions({ targets: [] }, null);
              runtimePayload = buildPayloadFromSpec({ targets: [] }, src, baseBoards, null, bonusOptions);
              runtimePayload._bonusOptions = bonusOptions;
            }
          } catch (e) {
            const bonusOptions = getBonusOptions({ targets: [] }, null);
            runtimePayload = buildPayloadFromSpec({ targets: [] }, src, baseBoards, null, bonusOptions);
            runtimePayload._bonusOptions = bonusOptions;
          }
        } else {
          const bonusOptions = getBonusOptions(spell.spec, spell.id);
          runtimePayload = buildPayloadFromSpec(spell.spec, src, baseBoards, null, bonusOptions);
          runtimePayload._bonusOptions = bonusOptions;
        }
        runtimePayload.source = `${src.boardName}[${src.index}]`;
      }
    } else if (cast.payload && (cast.payload.spec || cast.payload.rawTargets || cast.payload.targets == null)) {
      // allow either payload.spec or payload (if it's already a spec object)
      const spec = cast.payload.spec || cast.payload;
      const bonusOptions = getBonusOptions(spec, null);
      runtimePayload = buildPayloadFromSpec(spec, src, baseBoards, null, bonusOptions);
      runtimePayload._bonusOptions = bonusOptions;
      runtimePayload.source = `${src.boardName}[${src.index}]`;
    }

    // Debug: log runtime payload for Ice Mage casts
    try {
      const casterId = src && src.tile && src.tile.hero && src.tile.hero.id;
      const spellId = (cast && cast.payload && cast.payload.spellId) || (runtimePayload && runtimePayload.spellId) || null;
      if (casterId === 'iceMageID') {
        const rawTargets = runtimePayload && runtimePayload.rawTargets ? runtimePayload.rawTargets : null;
        const enemyBoard = (src && src.boardName && src.boardName.startsWith('p1')) ? cP2 : cP1;
        const occupiedIndices = [];
        for (let i = 0; i < (enemyBoard || []).length; i++) {
          const s = enemyBoard[i];
          if (s && s.hero && !s._dead && !(typeof s.currentHealth === 'number' && s.currentHealth <= 0)) occupiedIndices.push(i);
        }
        addLog && addLog(`[CastDebug] CASTER ${casterId} at ${src.boardName}[${src.index}] spell=${spellId} rawTargets=${JSON.stringify(rawTargets)} runtimeTargets=${JSON.stringify(runtimePayload.targets || [])} perTargetPayloads=${JSON.stringify(runtimePayload.perTargetPayloads || [])} enemyOccupiedIndices=${JSON.stringify(occupiedIndices)}`);
        // debug output removed
      }
    } catch (e) {}

    const spellId = (cast && cast.payload && cast.payload.spellId) || (runtimePayload && runtimePayload.spellId) || null;
    const spellDef = spellId ? getSpellById(spellId) || {} : {};

    // Resolve spell cost before applying payloads so we can enforce energy requirements.
    let resolvedSpellCost = 0;
    try {
      // prefer an explicit queuedCost attached at enqueue time (used by basicAttack to spend all energy)
      if (cast.payload && typeof cast.payload.queuedCost === 'number') {
        resolvedSpellCost = Number(cast.payload.queuedCost) || 0;
      } else {
        // Prefer hero slot-specific cost when available (cast.payload.slot or infer by spellId)
        try {
          const slotKey = (cast.payload && cast.payload.slot) || null;
          if (slotKey && src && src.tile && src.tile.hero && src.tile.hero.spells && src.tile.hero.spells[slotKey] && typeof src.tile.hero.spells[slotKey].cost !== 'undefined') {
            resolvedSpellCost = Number(src.tile.hero.spells[slotKey].cost) || 0;
          } else if (cast.payload && cast.payload.spellId && src && src.tile && src.tile.hero && src.tile.hero.spells) {
            const sid = cast.payload.spellId;
            const hs = src.tile.hero.spells;
            if (hs.front && hs.front.id === sid && typeof hs.front.cost !== 'undefined') resolvedSpellCost = Number(hs.front.cost) || 0;
            else if (hs.middle && hs.middle.id === sid && typeof hs.middle.cost !== 'undefined') resolvedSpellCost = Number(hs.middle.cost) || 0;
            else if (hs.back && hs.back.id === sid && typeof hs.back.cost !== 'undefined') resolvedSpellCost = Number(hs.back.cost) || 0;
            else {
              // No hero-slot cost found; prefer runtime payload cost if present, otherwise default to 0.
              if (runtimePayload && typeof runtimePayload.cost === 'number') {
                resolvedSpellCost = Number(runtimePayload.cost) || 0;
              } else {
                resolvedSpellCost = 0;
              }
            }
          }
        } catch (e) {
          // Error retrieving costs; default to 0 to enforce hero-slot-only cost policy.
          resolvedSpellCost = 0;
        }
      }
    } catch (e) {
      resolvedSpellCost = 0;
    }

    // If the caster does not have enough energy for the resolved cost, skip this cast.
    try {
      const currentEnergy = (src && src.tile && src.tile.currentEnergy != null)
        ? Number(src.tile.currentEnergy)
        : Number((src && src.tile && src.tile.hero && src.tile.hero.energy) || 0);
      if (resolvedSpellCost > 0 && currentEnergy < resolvedSpellCost) {
        addLog && addLog(`  > Skipping cast from ${src && src.boardName ? src.boardName : 'unknown'}[${src && typeof src.index === 'number' ? src.index : '?'}] — insufficient energy (${currentEnergy} < ${resolvedSpellCost})`);
        // Remove this cast from pending list and from the caster's queued list
        try { if (cast && cast.payload && typeof cast.payload.queuedId !== 'undefined' && src && src.tile && Array.isArray(src.tile.spellCasts)) { src.tile.spellCasts = src.tile.spellCasts.filter(sc => sc && sc.queuedId !== cast.payload.queuedId); } } catch(e){}
        pendingCasts = pendingCasts.filter(pc => !(pc.payload && typeof pc.payload.queuedId !== 'undefined' && pc.payload.queuedId === (cast.payload && cast.payload.queuedId)));
        continue;
      }
    } catch (e) {}

    // Focused Column: reduce energy cost for column spells by 1 (min 1)
    try {
      if (src && src.tile && src.tile.hero && src.tile.hero._towerFocusedColumn) {
        const specForCost = (runtimePayload && runtimePayload._spec) || (spellDef && spellDef.spec) || null;
        const isColumnSpell = !!(specForCost && Array.isArray(specForCost.targets) && specForCost.targets.some(t => t && t.type === 'column'));
        if (isColumnSpell && resolvedSpellCost > 1) {
          resolvedSpellCost = Math.max(1, resolvedSpellCost - 1);
        }
      }
    } catch (e) {}

    // Emit a pre-cast visual step so UI can show a glow/charging animation.
    try {
      if (typeof onStep === 'function') {
        const pre = {
          type: 'preCast',
          caster: { boardName: src.boardName, index: src.index },
          spellId: cast.payload && cast.payload.spellId ? cast.payload.spellId : null
        };
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
      }
    } catch (e) {}

    // If runtimePayload has rawTargets or targets descriptors, resolve to concrete tokens
    const rawDescs = runtimePayload && runtimePayload.rawTargets ? runtimePayload.rawTargets : [];
    const tdescs = (isFfa3 && rawDescs && rawDescs.length > 0)
      ? rawDescs
      : (runtimePayload && runtimePayload.targets ? runtimePayload.targets : rawDescs);
    // Check if targets are already concrete tokens (have 'board' field) or descriptors (have 'type' field)
    const tdescsArray = Array.isArray(tdescs) ? tdescs : [tdescs];
    const needsResolution = tdescsArray.length > 0 && tdescsArray.some(t => t && t.type && !t.board);
    const casterSide = src && src.boardName && String(src.boardName).startsWith('p1') ? 'p1' : (src && src.boardName && String(src.boardName).startsWith('p2') ? 'p2' : 'p3');
    const isEnemyDesc = (d) => d && (d.side || 'enemy') === 'enemy' && d.type !== 'self';
    let targetTokens = needsResolution
      ? (() => {
          if (!isFfa3) {
            return resolveTargets(tdescs, src, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 });
          }

          const specForFfa = (runtimePayload && runtimePayload._spec) || (spellDef && spellDef.spec) || null;
          if (!specForFfa) {
            return resolveTargets(tdescs, src, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 });
          }

          const enemyDescs = tdescsArray
            .map((d, idx) => ({ desc: d, idx }))
            .filter(d => isEnemyDesc(d.desc));
          const nonEnemyDescs = tdescsArray
            .map((d, idx) => ({ desc: d, idx }))
            .filter(d => !isEnemyDesc(d.desc));
          const enemySides = getAliveSidesMain(cP1, cP2, cP3).filter(s => s !== casterSide);

          const combinedTargets = [];
          const combinedPerTarget = [];
          const combinedDescriptorIndices = [];
          const basePerTargetExtras = Array.isArray(specForFfa.perTargetExtras)
            ? specForFfa.perTargetExtras
            : (Array.isArray(specForFfa.perTargetPayloadExtras) ? specForFfa.perTargetPayloadExtras : []);
          const mapPerTargetExtras = (descs) => (
            basePerTargetExtras.length > 0
              ? descs.map(d => basePerTargetExtras[d.idx] || null)
              : null
          );

          const appendPayload = (payload, descriptorIndexMap) => {
            if (!payload || !Array.isArray(payload.targets)) return;
            const perTargets = Array.isArray(payload.perTargetPayloads) ? payload.perTargetPayloads : [];
            const perDescriptor = Array.isArray(payload._descriptorIndexForTarget) ? payload._descriptorIndexForTarget : [];
            for (let i = 0; i < payload.targets.length; i++) {
              const target = payload.targets[i];
              if (!target) continue;
              combinedTargets.push(target);
              combinedPerTarget.push(perTargets[i] || null);
              const localDescIdx = perDescriptor[i];
              const mapped = (typeof localDescIdx === 'number' && descriptorIndexMap[localDescIdx] != null)
                ? descriptorIndexMap[localDescIdx]
                : descriptorIndexMap[0];
              combinedDescriptorIndices.push(typeof mapped === 'number' ? mapped : localDescIdx);
            }
          };

          const bonusOptions = (runtimePayload && runtimePayload._bonusOptions) ? runtimePayload._bonusOptions : {};

          if (nonEnemyDescs.length > 0) {
            const mappedExtras = mapPerTargetExtras(nonEnemyDescs);
            const nonEnemySpec = {
              ...specForFfa,
              targets: nonEnemyDescs.map(d => d.desc),
              perTargetExtras: mappedExtras || [],
              perTargetPayloadExtras: mappedExtras || []
            };
            const nonEnemyPayload = buildPayloadFromSpec(nonEnemySpec, src, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, null, { ...bonusOptions, forceAllySide: casterSide });
            appendPayload(nonEnemyPayload, nonEnemyDescs.map(d => d.idx));
          }

          if (enemyDescs.length > 0) {
            const mappedExtras = mapPerTargetExtras(enemyDescs);
            const enemySpec = {
              ...specForFfa,
              targets: enemyDescs.map(d => d.desc),
              perTargetExtras: mappedExtras || [],
              perTargetPayloadExtras: mappedExtras || []
            };
            enemySides.forEach((side) => {
              const enemyPayload = buildPayloadFromSpec(enemySpec, src, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, null, { ...bonusOptions, forceEnemySide: side });
              appendPayload(enemyPayload, enemyDescs.map(d => d.idx));
            });
          }

          if (combinedPerTarget.length > 0) runtimePayload.perTargetPayloads = combinedPerTarget;
          if (combinedDescriptorIndices.length > 0) runtimePayload._descriptorIndexForTarget = combinedDescriptorIndices;
          return combinedTargets;
        })()
      : tdescsArray;

    // Defend interception rules:
    // - projectile hitting a Defend target nullifies the entire spell
    // - projectilePlus1: primary (first) hit on Defend nullifies entire spell; secondary Defend hit nullifies only that secondary target
    // - column: Defend blocks rows at/behind the defender in that column (front=>all, middle=>middle+back, back=>back only)
    try {
      const hasDefend = (tile) => {
        const effects = Array.isArray(tile && tile.effects) ? tile.effects : [];
        const passives = Array.isArray(tile && tile._passives) ? tile._passives : (tile && tile.hero && Array.isArray(tile.hero.passives) ? tile.hero.passives : []);
        return [...effects, ...passives].some(e => e && (e.blocksProjectileAndColumn || e.name === 'Defend'));
      };

      const defendTargetDescriptors = (() => {
        if (runtimePayload && Array.isArray(runtimePayload.rawTargets) && runtimePayload.rawTargets.length > 0) {
          return runtimePayload.rawTargets;
        }
        if (runtimePayload && runtimePayload._spec && Array.isArray(runtimePayload._spec.targets) && runtimePayload._spec.targets.length > 0) {
          return runtimePayload._spec.targets;
        }
        return tdescsArray;
      })();

      const descriptorIndexForTarget = (() => {
        if (runtimePayload && Array.isArray(runtimePayload._descriptorIndexForTarget) && runtimePayload._descriptorIndexForTarget.length === targetTokens.length) {
          return runtimePayload._descriptorIndexForTarget.slice();
        }
        if (Array.isArray(defendTargetDescriptors) && defendTargetDescriptors.length <= 1) {
          return targetTokens.map(() => 0);
        }
        return targetTokens.map(() => 0);
      })();

      const groupedByDescriptor = new Map();
      descriptorIndexForTarget.forEach((di, i) => {
        const key = Number.isFinite(Number(di)) ? Number(di) : 0;
        if (!groupedByDescriptor.has(key)) groupedByDescriptor.set(key, []);
        groupedByDescriptor.get(key).push(i);
      });

      const blockedTokenIndexes = new Set();
      let nullifyEntireSpell = false;

      groupedByDescriptor.forEach((globalIndexes, descriptorIndex) => {
        const desc = (Array.isArray(defendTargetDescriptors) && defendTargetDescriptors[descriptorIndex]) ? defendTargetDescriptors[descriptorIndex] : null;
        const type = desc && desc.type;
        if (!type) return;

        const defendedInDescriptor = [];
        globalIndexes.forEach((globalIdx, localIdx) => {
          const token = targetTokens[globalIdx];
          if (!token) return;
          const tref = findTileInBoards(token, cP1, cP2, cP3, cR1, cR2, cR3);
          if (tref && tref.tile && hasDefend(tref.tile)) {
            defendedInDescriptor.push({ globalIdx, localIdx, tref });
          }
        });

        if (defendedInDescriptor.length === 0) return;

        if (type === 'projectile') {
          nullifyEntireSpell = true;
          return;
        }

        if (type === 'projectilePlus1') {
          const primaryWasDefended = defendedInDescriptor.some(d => (d.localIdx % 2) === 0);
          if (primaryWasDefended) {
            nullifyEntireSpell = true;
            return;
          }
          defendedInDescriptor.forEach(d => blockedTokenIndexes.add(d.globalIdx));
          return;
        }

        if (type === 'column') {
          const minProtectedRow = defendedInDescriptor.reduce((minRow, d) => {
            const row = indexToRow(d.tref.index, d.tref.boardName === 'p1Board' ? 'p1' : (d.tref.boardName === 'p2Board' ? 'p2' : 'p3'));
            return Math.min(minRow, row);
          }, 99);
          globalIndexes.forEach(globalIdx => {
            const token = targetTokens[globalIdx];
            if (!token) return;
            const row = indexToRow(token.index, token.board);
            if (row >= minProtectedRow) blockedTokenIndexes.add(globalIdx);
          });
        }
      });

      if (nullifyEntireSpell) {
        for (let i = 0; i < targetTokens.length; i++) blockedTokenIndexes.add(i);
      }

      if (blockedTokenIndexes.size > 0) {
        targetTokens = targetTokens.filter((_, idx) => !blockedTokenIndexes.has(idx));
        if (runtimePayload && Array.isArray(runtimePayload.perTargetPayloads)) {
          runtimePayload.perTargetPayloads = runtimePayload.perTargetPayloads.filter((_, idx) => !blockedTokenIndexes.has(idx));
        }
        runtimePayload._descriptorIndexForTarget = descriptorIndexForTarget.filter((_, idx) => !blockedTokenIndexes.has(idx));
        addLog && addLog(`  > Defend nullified ${blockedTokenIndexes.size} target(s) for this cast.`);
      }
    } catch (e) {}

    // Optional post hook: apply an effect to the caster (self) as part of the spell's post processing.
    // Spell specs may set `post.applyEffectToSelf.effects` to an array of effect names or objects.
    const pendingEffects = [];
    const pendingEffectRemovals = [];
    try {
      if (runtimePayload.post && runtimePayload.post.applyEffectToSelf && src && src.tile) {
        const arr = runtimePayload.post.applyEffectToSelf.effects || [];
        const toApply = arr.map(e => (typeof e === 'string' ? EFFECTS[e] : e)).filter(Boolean);
        if (toApply.length > 0) {
          addLog && addLog(`  > Queued post-cast self-effects to ${src.boardName}[${src.index}]`);
          pendingEffects.push({ target: src, effects: toApply, applier: src });
        }
      }
    } catch (e) {}
    const actionResults = [];
    const pendingCastChanges = [];
    let lifestealDamagedEnemyCount = 0;
    const moveAllBackApplied = new Set();
    let swapWithReserveApplied = false;
    const pruneInvalidQueuedCastsForCurrentSlot = (slotTile, slotBoardKey, slotIndex) => {
      if (!slotTile) return;
      const slotName = slotForIndex(slotBoardKey, slotIndex);
      const remainingForSlot = slotTile._castsRemaining ? Number(slotTile._castsRemaining[slotName] || 0) : 0;
      if (!Array.isArray(slotTile.spellCasts) || slotTile.spellCasts.length === 0) return;
      let allowed = Math.max(0, remainingForSlot);
      const kept = [];
      const removedQueuedIds = new Set();
      slotTile.spellCasts.forEach(sc => {
        if (!sc) return;
        if (sc.slot === 'basic') {
          kept.push(sc);
          return;
        }
        if (allowed > 0) {
          kept.push(sc);
          allowed -= 1;
          return;
        }
        if (typeof sc.queuedId !== 'undefined') removedQueuedIds.add(sc.queuedId);
      });
      if (removedQueuedIds.size > 0) {
        slotTile.spellCasts = kept;
        if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
          pendingCasts = pendingCasts.filter(pc => {
            if (!pc || !pc.caster || !pc.payload) return true;
            if (pc.caster.boardName !== slotBoardKey || Number(pc.caster.index) !== slotIndex) return true;
            if (pc.payload.slot === 'basic') return true;
            if (typeof pc.payload.queuedId === 'undefined') return true;
            return !removedQueuedIds.has(pc.payload.queuedId);
          });
        }
      }
    };
    const firstStrikeActive = !!(src && src.tile && src.tile.hero && src.tile.hero._towerFirstStrike && !src.tile._towerFirstStrikeUsed);
    const descriptorIndices = (runtimePayload && Array.isArray(runtimePayload._descriptorIndexForTarget))
      ? runtimePayload._descriptorIndexForTarget
      : [];
    const uniqueDescriptorIndices = new Set(descriptorIndices.filter(d => typeof d === 'number'));
    const hasMultipleDescriptorIndices = uniqueDescriptorIndices.size > 1;
    const hasProjectilePlus1 = (() => {
      const specTargets = (runtimePayload && runtimePayload._spec && Array.isArray(runtimePayload._spec.targets))
        ? runtimePayload._spec.targets
        : (spellDef && spellDef.spec && Array.isArray(spellDef.spec.targets) ? spellDef.spec.targets : []);
      return specTargets.some(t => t && t.type === 'projectilePlus1');
    })();
    const projectilePlus1SeenByBoard = new Map();

    targetTokens.forEach((tdesc, tidx) => {
      const tref = findTileInBoards(tdesc, cP1, cP2, cP3, cR1, cR2, cR3);
      let applied = null;
      const descriptorIndex = (runtimePayload && Array.isArray(runtimePayload._descriptorIndexForTarget))
        ? runtimePayload._descriptorIndexForTarget[tidx]
        : null;
      let projectilePlus1Secondary = false;
      if (hasProjectilePlus1 && !hasMultipleDescriptorIndices) {
        const tokenBoard = (tdesc && typeof tdesc.board === 'string')
          ? tdesc.board
          : (tref && tref.boardName && String(tref.boardName).startsWith('p1'))
            ? 'p1'
            : (tref && tref.boardName && String(tref.boardName).startsWith('p2'))
              ? 'p2'
              : 'p3';
        const dIdx = (typeof descriptorIndex === 'number') ? descriptorIndex : 0;
        const boardKey = `${dIdx}:${tokenBoard}`;
        const seen = Number(projectilePlus1SeenByBoard.get(boardKey) || 0);
        projectilePlus1Secondary = seen > 0;
        projectilePlus1SeenByBoard.set(boardKey, seen + 1);
      }
      const isSecondaryTarget = !!(spellDef && spellDef.animationSecondary) && (
        (typeof descriptorIndex === 'number' && descriptorIndex > 0)
          || projectilePlus1Secondary
      );
      const phaseTag = isSecondaryTarget ? 'secondary' : 'primary';
      // select per-target payload if provided
      const per = (runtimePayload && Array.isArray(runtimePayload.perTargetPayloads) && runtimePayload.perTargetPayloads[tidx]) ? { ...runtimePayload, ...runtimePayload.perTargetPayloads[tidx] } : runtimePayload;

      // Debug: per-target details for Ice Mage
      try {
        const casterId = src && src.tile && src.tile.hero && src.tile.hero.id;
        if (casterId === 'iceMageID') {
          addLog && addLog(`[CastDebug] targetIndex=${tidx} token=${JSON.stringify(tdesc)} resolved=${JSON.stringify(tref)} per=${JSON.stringify(per)}`);
          if (!(per && per.action)) addLog && addLog(`[CastDebug] Skipping apply for ${casterId} -> target ${tidx} because per.action is missing or null`);
          // debug output removed
        }
      } catch (e) {}

      if (per && per.action) {
        try {
          const slotKey = (cast && cast.payload && cast.payload.slot) ? cast.payload.slot : null;
          const isSlotSpell = slotKey && slotKey !== 'basic';
          const specForDamage = (per && per._spec) || (runtimePayload && runtimePayload._spec) || (spellDef && spellDef.spec) || null;
          if (per.action === 'damage' && isSlotSpell && casterHero && casterHero._towerExecutioner && isDamageSpec(specForDamage)) {
            const t = tref && tref.tile ? tref.tile : null;
            const maxHp = Number((t && t.hero && typeof t.hero.health === 'number') ? t.hero.health : (t && typeof t.currentHealth === 'number' ? t.currentHealth : 0));
            const curHp = Number((t && typeof t.currentHealth === 'number') ? t.currentHealth : maxHp);
            if (maxHp > 0 && curHp / maxHp <= 0.5) {
              per.value = Math.round(Number(per.value || 0) * 1.5);
            }
          }
        } catch (e) {}
        if (firstStrikeActive && per.action === 'damage') {
          const base = Number(per.value || 0);
          per.value = Math.max(0, Math.round(base * 1.5));
        }
        // honor optional post-condition: onlyApplyToWithEffect or onlyApplyIfHasDebuff
        const onlyIf = per.post && per.post.onlyApplyToWithEffect;
        const onlyIfHasDebuff = per.post && per.post.onlyApplyIfHasDebuff;
        if (onlyIf) {
          const has = tref && tref.tile && (tref.tile.effects || []).some(e => e && e.name === onlyIf);
          if (!has) {
            addLog && addLog(`  > Skipping target ${tref && tref.boardName}[${tref && tref.index}] — lacks effect ${onlyIf}`);
          } else {
            applied = applyPayloadToTarget({ ...per, source: per.source || runtimePayload.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, onStep, false);
            try {
              if (applied && applied.type === 'damage') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), source: (per && per.source) || (runtimePayload && runtimePayload.source), spellId: (runtimePayload && runtimePayload.spellId) || (cast && cast.payload && cast.payload.spellId) || null, phase: phaseTag, voidShieldApplied: !!(applied && applied.voidShieldApplied) });
              if (applied && applied.type === 'heal') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), phase: phaseTag });
            } catch (e) {}
          }
        } else if (onlyIfHasDebuff) {
          const hasDebuff = tref && tref.tile && (tref.tile.effects || []).some(e => e && e.kind === 'debuff');
          if (!hasDebuff) {
            addLog && addLog(`  > Skipping target ${tref && tref.boardName}[${tref && tref.index}] — lacks any debuff`);
          } else {
            applied = applyPayloadToTarget({ ...per, source: per.source || runtimePayload.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, onStep, false);
            try {
              if (applied && applied.type === 'damage') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), source: (per && per.source) || (runtimePayload && runtimePayload.source), spellId: (runtimePayload && runtimePayload.spellId) || (cast && cast.payload && cast.payload.spellId) || null, phase: phaseTag, voidShieldApplied: !!(applied && applied.voidShieldApplied) });
              if (applied && applied.type === 'heal') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), phase: phaseTag });
            } catch (e) {}
          }
          } else {
            applied = applyPayloadToTarget({ ...per, source: per.source || runtimePayload.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, onStep, false);
            try {
              if (applied && applied.type === 'damage') {
                pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), source: (per && per.source) || (runtimePayload && runtimePayload.source), spellId: (runtimePayload && runtimePayload.spellId) || (cast && cast.payload && cast.payload.spellId) || null, phase: phaseTag, voidShieldApplied: !!(applied && applied.voidShieldApplied) });
                // Soul Link: if damage was redirected, queue the redirect damage
                if (applied.soulLinkRedirect) {
                  const redirect = applied.soulLinkRedirect;
                  pendingCastChanges.push({ boardName: redirect.boardName, index: redirect.index, deltaHealth: -Number(redirect.damage || 0), amount: Number(redirect.damage || 0), source: 'Soul Link', phase: phaseTag });
                  addLog && addLog(`  > Soul Link: queued ${redirect.damage} damage to ${redirect.boardName}[${redirect.index}]`);
                }
                // Blood Drain: if payload requests healing caster after damage
                if (per.post && per.post.healCasterAmount) {
                  const healAmt = Number(per.post.healCasterAmount || 0);
                  pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaHealth: healAmt, amount: healAmt, phase: 'secondary' });
                  addLog && addLog(`  > Blood Drain: queued heal ${healAmt} to caster ${src.boardName}[${src.index}]`);
                }
                // Optional: heal caster for the exact damage dealt (after armor)
                try {
                  const healForDamage = (per && per.post && per.post.healCasterEqualToDamage)
                    || (runtimePayload && runtimePayload.post && runtimePayload.post.healCasterEqualToDamage);
                  if (healForDamage) {
                    const healAmt = Math.max(0, Number(applied.amount || 0));
                    if (healAmt > 0 && src && src.boardName) {
                      pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaHealth: healAmt, amount: healAmt, phase: 'secondary' });
                      addLog && addLog(`  > healCasterEqualToDamage: queued heal ${healAmt} to caster ${src.boardName}[${src.index}]`);
                    }
                  }
                } catch (e) {}
                try {
                  const retaliateCfg = (per && per.post && per.post.targetRetaliatesIfSpeedAbove)
                    || (runtimePayload && runtimePayload.post && runtimePayload.post.targetRetaliatesIfSpeedAbove);
                  if (retaliateCfg && tref && tref.tile && src && src.tile && !tref.tile._dead && !src.tile._dead) {
                    const speedThreshold = Number(retaliateCfg.speed ?? retaliateCfg.threshold ?? 0);
                    const retaliateRaw = Number(retaliateCfg.amount ?? retaliateCfg.value ?? 0);
                    const targetSpeed = (typeof tref.tile.currentSpeed === 'number')
                      ? Number(tref.tile.currentSpeed)
                      : Number((tref.tile.hero && tref.tile.hero.speed) || 0);
                    if (retaliateRaw > 0 && targetSpeed > speedThreshold) {
                      const casterArmor = (typeof src.tile.currentArmor === 'number')
                        ? Number(src.tile.currentArmor)
                        : Number((src.tile.hero && src.tile.hero.armor) || 0);
                      const retaliateDamage = Math.max(0, retaliateRaw - casterArmor);
                      if (retaliateDamage > 0) {
                        pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaHealth: -retaliateDamage, amount: retaliateDamage, source: 'Retaliate', phase: 'secondary' });
                        addLog && addLog(`  > targetRetaliatesIfSpeedAbove: queued ${retaliateDamage} retaliation damage to caster ${src.boardName}[${src.index}]`);
                      }
                    }
                  }
                } catch (e) {}
              }
              if (applied && applied.type === 'heal') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), phase: phaseTag });
            } catch (e) {}
          }
      }
      // Optional post-processing hooks: e.g. remove debuffs before applying buffs
      if (runtimePayload.post && runtimePayload.post.removeDebuffs) {
        if (tref && tref.tile) {
          // Ensure effects is an array for consistent processing
          const effectsArr = Array.isArray(tref.tile.effects) ? tref.tile.effects : [];
          const before = effectsArr.length;
          const after = effectsArr.filter(e => !(e && e.kind === 'debuff')).length;
          const removedCount = Math.max(0, before - after);
          addLog && addLog(`  > Queued removal of ${removedCount} debuff(s) from ${tref.boardName}[${tref.index}] due to post.removeDebuffs`);
          pendingEffectRemovals.push({ type: 'removeDebuffs', target: tref });
          // Optional conditional heal if a debuff was removed and spec requests it
          try {
            if (removedCount > 0 && runtimePayload.post && runtimePayload.post.healIfRemoved && typeof runtimePayload.post.healIfRemoved.amount === 'number') {
              const amt = Number(runtimePayload.post.healIfRemoved.amount || 0);
              if (amt > 0) {
                // Queue the heal as a pendingCastChange so the UI shows the heal pulse
                pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(amt), amount: Number(amt), deltaEnergy: 0, phase: phaseTag });
                addLog && addLog(`  > post.removeDebuffs queued heal ${amt} to ${tref.boardName}[${tref.index}] because a debuff was removed`);
              }
            }
            // If spec declares a deltaEnergy for post-remove, queue that energy gain for the target
            try {
              // If spec declares a deltaEnergy for post-remove, queue that energy gain
              // for the target. For brimberryLeaves we want the energy to apply even
              // when no debuffs were removed (i.e. grant +2 to the chosen ally), so
              // don't gate this on removedCount. Other conditional/heal behaviors
              // (like healIfRemoved) remain dependent on removal.
              const postDelta = runtimePayload && runtimePayload.post && typeof runtimePayload.post.deltaEnergy === 'number' ? Number(runtimePayload.post.deltaEnergy) : null;
              if (postDelta && postDelta !== 0) {
                pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaEnergy: Number(postDelta), phase: phaseTag });
                addLog && addLog(`  > post.removeDebuffs queued energy ${postDelta} to ${tref.boardName}[${tref.index}]`);
              }
            } catch (e) {}
          } catch (e) {}
        }
      }
      const resolveEffectApplier = (removedEffect) => {
        if (!removedEffect) return null;
        const byInstanceId = removedEffect.appliedByHeroInstanceId;
        const byId = removedEffect.appliedByHeroId;
        const byBoardName = removedEffect.appliedByBoardName;
        const byIndex = typeof removedEffect.appliedByIndex === 'number' ? removedEffect.appliedByIndex : (removedEffect.appliedBy && typeof removedEffect.appliedBy.index === 'number' ? removedEffect.appliedBy.index : null);
        const checkTile = (boardArr, boardName, idx) => {
          if (!boardArr || typeof idx !== 'number') return null;
          const tile = boardArr[idx];
          if (!tile || !tile.hero || tile._dead) return null;
          if (byInstanceId && tile.hero._instanceId !== byInstanceId) return null;
          if (byId && tile.hero.id !== byId) return null;
          return { boardName, index: idx, tile };
        };
        // Prefer resolving by hero instance id on main boards
        if (byInstanceId) {
          for (let i = 0; i < (cP1 || []).length; i++) {
            const t = (cP1 || [])[i];
            if (t && t.hero && !t._dead && t.hero._instanceId === byInstanceId) return { boardName: 'p1Board', index: i, tile: t };
          }
          for (let i = 0; i < (cP2 || []).length; i++) {
            const t = (cP2 || [])[i];
            if (t && t.hero && !t._dead && t.hero._instanceId === byInstanceId) return { boardName: 'p2Board', index: i, tile: t };
          }
          for (let i = 0; i < (cP3 || []).length; i++) {
            const t = (cP3 || [])[i];
            if (t && t.hero && !t._dead && t.hero._instanceId === byInstanceId) return { boardName: 'p3Board', index: i, tile: t };
          }
        }
        // Fallback: resolve by hero id on main boards
        if (byId) {
          for (let i = 0; i < (cP1 || []).length; i++) {
            const t = (cP1 || [])[i];
            if (t && t.hero && !t._dead && t.hero.id === byId) return { boardName: 'p1Board', index: i, tile: t };
          }
          for (let i = 0; i < (cP2 || []).length; i++) {
            const t = (cP2 || [])[i];
            if (t && t.hero && !t._dead && t.hero.id === byId) return { boardName: 'p2Board', index: i, tile: t };
          }
          for (let i = 0; i < (cP3 || []).length; i++) {
            const t = (cP3 || [])[i];
            if (t && t.hero && !t._dead && t.hero.id === byId) return { boardName: 'p3Board', index: i, tile: t };
          }
        }
        // Fallback to stored board/index if it still points to a living hero
        if (byBoardName === 'p1Board') return checkTile(cP1, 'p1Board', byIndex);
        if (byBoardName === 'p2Board') return checkTile(cP2, 'p2Board', byIndex);
        if (byBoardName === 'p3Board') return checkTile(cP3, 'p3Board', byIndex);
        return null;
      };

      // Optional post-processing: remove the top debuff (oldest negative effect) from the target
      if (runtimePayload.post && runtimePayload.post.removeTopDebuff) {
        if (tref && tref.tile && Array.isArray(tref.tile.effects) && tref.tile.effects.length > 0) {
          // Find from the end (top visual/oldest) the first debuff effect and remove it
          const idx = (() => {
            for (let i = tref.tile.effects.length - 1; i >= 0; i--) {
              const ef = tref.tile.effects[i];
              if (ef && ef.kind === 'debuff') return i;
            }
            return -1;
          })();
          if (idx !== -1) {
            const removed = tref.tile.effects[idx];
            pendingEffectRemovals.push({ type: 'removeTopDebuff', target: tref, effectName: removed && removed.name });
            addLog && addLog(`  > Queued removal of top debuff ${removed && removed.name} from ${tref.boardName}[${tref.index}] due to post.removeTopDebuff`);
            try {
              const applyIfRemoved = runtimePayload && runtimePayload.post && runtimePayload.post.applyEffectIfRemoved;
              if (applyIfRemoved) {
                const list = Array.isArray(applyIfRemoved.effects)
                  ? applyIfRemoved.effects
                  : (Array.isArray(applyIfRemoved) ? applyIfRemoved : []);
                const toApply = list.map(e => (typeof e === 'string' ? EFFECTS[e] : e)).filter(Boolean);
                if (toApply.length > 0) {
                  pendingEffects.push({ target: tref, effects: toApply, applier: src });
                  addLog && addLog(`  > post.removeTopDebuff queued effects ${toApply.map(e => e && e.name).filter(Boolean).join(', ')} on ${tref.boardName}[${tref.index}]`);
                }
              }
            } catch (e) {}
            // Optional conditional heal if a debuff was removed and spec requests it
            try {
              if (runtimePayload.post && runtimePayload.post.healIfRemoved && typeof runtimePayload.post.healIfRemoved.amount === 'number') {
                const amt = Number(runtimePayload.post.healIfRemoved.amount || 0);
                if (amt > 0) {
                  pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(amt), amount: Number(amt), deltaEnergy: 0, phase: phaseTag });
                  addLog && addLog(`  > post.removeTopDebuff queued heal ${amt} to ${tref.boardName}[${tref.index}] because a debuff was removed`);
                }
              }
            } catch (e) {}
            // Optional: damage the original applier of the removed debuff (Exorcism)
            try {
              const dmgCfg = runtimePayload.post && runtimePayload.post.damageEffectApplier ? runtimePayload.post.damageEffectApplier : null;
              if (dmgCfg && typeof dmgCfg.amount === 'number') {
                const applierRef = resolveEffectApplier(removed);
                if (applierRef && applierRef.tile && !applierRef.tile._dead) {
                  const casterSpellPower = (src && src.tile && typeof src.tile.currentSpellPower === 'number') ? Number(src.tile.currentSpellPower) : 0;
                  const addSpellPower = dmgCfg.ignoreSpellPower ? 0 : casterSpellPower;
                  const dmg = Math.max(0, Number(dmgCfg.amount || 0) + addSpellPower);
                  if (dmg > 0) {
                    pendingCastChanges.push({ boardName: applierRef.boardName, index: applierRef.index, deltaHealth: -Math.abs(dmg), amount: Math.abs(dmg), source: (runtimePayload && runtimePayload.source) || (src && src.boardName ? `${src.boardName}[${src.index}]` : undefined), phase: phaseTag });
                    addLog && addLog(`  > post.removeTopDebuff queued ${dmg} damage to debuff applier ${applierRef.boardName}[${applierRef.index}]`);
                  }
                } else {
                  addLog && addLog('  > post.removeTopDebuff: debuff applier not found or dead; skipping damage');
                }
              }
            } catch (e) {}
          }
        }
      }
      // Optional post-processing: revive a dead ally (Revive)
      if (runtimePayload.post && runtimePayload.post.revive) {
        const reviveCfg = runtimePayload.post.revive || {};
        if (tref && tref.tile && tref.tile.hero) {
          const tile = tref.tile;
          const isCorpse = !!tile._dead || (typeof tile.currentHealth === 'number' && tile.currentHealth <= 0);
          if (!isCorpse) return;
          tile._dead = false;
          tile._revivedExtra = true;
          tile.currentHealth = 0;
          if (tile.currentEnergy == null) tile.currentEnergy = 0;
          if (!tile._castsRemaining) {
            tile._castsRemaining = {
              front: tile.hero.spells && tile.hero.spells.front ? (tile.hero.spells.front.casts || 0) : 0,
              middle: tile.hero.spells && tile.hero.spells.middle ? (tile.hero.spells.middle.casts || 0) : 0,
              back: tile.hero.spells && tile.hero.spells.back ? (tile.hero.spells.back.casts || 0) : 0,
            };
          }
          try { recomputeModifiers(tile); } catch (e) {}
          const casterSpellPower = (src && src.tile && typeof src.tile.currentSpellPower === 'number') ? Number(src.tile.currentSpellPower) : 0;
          const baseHeal = Number(reviveCfg.heal ?? reviveCfg.amount ?? reviveCfg.value ?? 0);
          const healAmt = baseHeal + (reviveCfg.ignoreSpellPower ? 0 : casterSpellPower);
          if (healAmt > 0) {
            try { applyHealthDelta(tile, Number(healAmt)); } catch (e) {}
            pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(healAmt), amount: Number(healAmt), deltaEnergy: 0, phase: phaseTag, _skipApply: true });
            addLog && addLog(`  > post.revive healed ${tref.boardName}[${tref.index}] for ${healAmt}`);
          } else {
            try { tile.currentHealth = Math.max(1, Number(tile.currentHealth || 0)); } catch (e) {}
          }
        }
      }
      // Optional post-processing: replace a dead ally with a specific hero (Raise Dead)
      if (runtimePayload.post && runtimePayload.post.raiseDeadToHeroId) {
        const summonId = runtimePayload.post.raiseDeadToHeroId;
        if (tref && tref.tile && tref.tile.hero) {
          const tile = tref.tile;
          const isCorpse = !!tile._dead || (typeof tile.currentHealth === 'number' && tile.currentHealth <= 0);
          if (!isCorpse) return;
          const template = HEROES.find(h => h && h.id === summonId);
          if (template) {
            const summoned = JSON.parse(JSON.stringify(template));
            tile.hero = summoned;
            tile._dead = false;
            tile.effects = [];
            tile._passives = Array.isArray(summoned.passives) ? summoned.passives.map(e => ({ ...e })) : [];
            tile.currentHealth = Number(summoned.health || 0);
            tile.currentArmor = Number(summoned.armor || 0);
            tile.currentSpeed = Number(summoned.speed || 0);
            tile.currentEnergy = Number(summoned.energy || 0);
            tile.currentSpellPower = Number(summoned.spellPower || 0);
            tile.spellCasts = [];
            tile._castsRemaining = {
              front: summoned.spells && summoned.spells.front ? (summoned.spells.front.casts || 0) : 0,
              middle: summoned.spells && summoned.spells.middle ? (summoned.spells.middle.casts || 0) : 0,
              back: summoned.spells && summoned.spells.back ? (summoned.spells.back.casts || 0) : 0,
            };
            try { ensureHeroInstanceId(tile); } catch (e) {}
            try { recomputeModifiers(tile); } catch (e) {}
            pendingCastChanges.push({ boardName: tref.boardName, index: tref.index, deltaHealth: 0, deltaEnergy: 0, phase: phaseTag, _skipApply: true });
            addLog && addLog(`  > post.raiseDeadToHeroId replaced corpse with ${summoned.name} at ${tref.boardName}[${tref.index}]`);
          }
        }
      }
      // Optional post-processing: remove the top effect by name (e.g., Burn for Consume Burn)
      const removeTopByName = (per && per.post && per.post.removeTopEffectByName) || (runtimePayload && runtimePayload.post && runtimePayload.post.removeTopEffectByName);
      if (removeTopByName) {
        const removeName = (typeof removeTopByName === 'string') ? removeTopByName : (removeTopByName.name || removeTopByName.effect || removeTopByName.effectName);
        const onRemoved = (typeof removeTopByName === 'object' && removeTopByName.onRemoved) ? removeTopByName.onRemoved : (runtimePayload && runtimePayload.post && runtimePayload.post.onRemoved);
        if (removeName && tref && tref.tile && Array.isArray(tref.tile.effects) && tref.tile.effects.length > 0) {
          const idx = (() => {
            for (let i = tref.tile.effects.length - 1; i >= 0; i--) {
              const ef = tref.tile.effects[i];
              if (ef && ef.name === removeName) return i;
            }
            return -1;
          })();
          if (idx !== -1) {
            pendingEffectRemovals.push({ type: 'removeTopEffectByName', target: tref, effectName: removeName });
            addLog && addLog(`  > Queued removal of top effect ${removeName} from ${tref.boardName}[${tref.index}] due to post.removeTopEffectByName`);
            if (onRemoved) {
              const casterSpellPower = (src && src.tile && typeof src.tile.currentSpellPower === 'number') ? Number(src.tile.currentSpellPower) : 0;
              if (typeof onRemoved.damageTarget === 'number') {
                const dmg = Number(onRemoved.damageTarget || 0) + casterSpellPower;
                if (dmg !== 0) {
                  pendingCastChanges.push({ boardName: tref.boardName, index: tref.index, deltaHealth: -Math.abs(dmg), amount: Math.abs(dmg), source: (runtimePayload && runtimePayload.source) || (src && src.boardName ? `${src.boardName}[${src.index}]` : undefined), phase: phaseTag });
                  addLog && addLog(`  > post.removeTopEffectByName queued damage ${dmg} to ${tref.boardName}[${tref.index}]`);
                }
              }
              if (typeof onRemoved.healCaster === 'number') {
                const heal = Number(onRemoved.healCaster || 0) + casterSpellPower;
                if (heal !== 0 && src) {
                  pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaHealth: Math.abs(heal), amount: Math.abs(heal), phase: phaseTag });
                  addLog && addLog(`  > post.removeTopEffectByName queued heal ${heal} to caster ${src.boardName}[${src.index}]`);
                }
              }
            }
          }
        }
      }
      // Optional post-processing: remove the top positive (buff) effect from the target
      const removeTop = (per && per.post && per.post.removeTopPositiveEffect) || (runtimePayload && runtimePayload.post && runtimePayload.post.removeTopPositiveEffect);
      if (removeTop) {
        if (tref && tref.tile && Array.isArray(tref.tile.effects) && tref.tile.effects.length > 0) {
          // Find from the end (top visual) the first buff effect and remove it
          const idx = (() => {
            for (let i = tref.tile.effects.length - 1; i >= 0; i--) {
              const ef = tref.tile.effects[i];
              if (ef && ef.kind === 'buff') return i;
            }
            return -1;
          })();
          if (idx !== -1) {
            const removed = tref.tile.effects[idx];
            pendingEffectRemovals.push({ type: 'removeTopPositiveEffect', target: tref, effectName: removed && removed.name });
            addLog && addLog(`  > Queued removal of top positive effect ${removed && removed.name} from ${tref.boardName}[${tref.index}] due to post.removeTopPositiveEffect`);
          }
        }
      }
      let effectsApplied = [];
      
      // Consume Corpse: if spell targets dead allies and requests corpse removal
      if (runtimePayload.post && runtimePayload.post.removeCorpse) {
        let corpseRemoved = false;
        if (tref && tref.tile && tref.tile.hero && tref.tile._dead) {
          // Remove the corpse by clearing the tile
          addLog && addLog(`  > Consume Corpse: removing ${tref.tile.hero.name} from ${tref.boardName}[${tref.index}]`);
          tref.tile.hero = null;
          tref.tile._dead = false;
          tref.tile.effects = [];
          tref.tile.currentHealth = null;
          tref.tile.currentArmor = null;
          tref.tile.currentSpeed = null;
          tref.tile.currentEnergy = null;
          tref.tile.spellCasts = [];
          corpseRemoved = true;
        }
        // If corpse was removed, heal the caster
        if (corpseRemoved && runtimePayload.post.healCasterIfRemoved) {
          const healAmt = Number(runtimePayload.post.healCasterIfRemoved || 0) + (src.tile && typeof src.tile.currentSpellPower === 'number' ? src.tile.currentSpellPower : 0);
          pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaHealth: healAmt, amount: healAmt, phase: 'primary' });
          addLog && addLog(`  > Consume Corpse: healed caster for ${healAmt}`);
        }
      }
      
      let effectsToApply = (per && Array.isArray(per.effects) && per.effects.length > 0)
        ? per.effects
        : (runtimePayload.effects || []);
      try {
        const armorSpec = (per && per.post && per.post.applyEffectIfTargetArmorAtLeast)
          ? per.post.applyEffectIfTargetArmorAtLeast
          : (runtimePayload && runtimePayload.post ? runtimePayload.post.applyEffectIfTargetArmorAtLeast : null);
        if (armorSpec) {
          const minArmor = Number(armorSpec.minArmor ?? armorSpec.amount ?? 0);
          const targetArmor = (tref && tref.tile)
            ? (typeof tref.tile.currentArmor === 'number' ? Number(tref.tile.currentArmor) : Number((tref.tile.hero && tref.tile.hero.armor) || 0))
            : 0;
          if (targetArmor < minArmor) {
            effectsToApply = [];
          } else if (Array.isArray(armorSpec.effects) && armorSpec.effects.length > 0) {
            effectsToApply = armorSpec.effects.map(e => (typeof e === 'string' ? EFFECTS[e] : e)).filter(Boolean);
          }
        }
      } catch (e) {}
      if (effectsToApply && effectsToApply.length > 0) {
        const targetHero = tref && tref.tile ? tref.tile.hero : null;
        if (targetHero && targetHero.isBoss) {
          effectsToApply = effectsToApply.filter(e => {
            if (!e) return false;
            if (typeof e === 'string') return e !== 'Shackle';
            return e.name !== 'Shackle';
          });
        }
        if (effectsToApply.length > 0) {
          pendingEffects.push({ target: tref, effects: effectsToApply, applier: src });
        }
        effectsApplied = (effectsToApply || []).map(e => e && e.name).filter(Boolean);
      }

      const bypassCastTriggers = !!((per && per.post && per.post.bypassTriggers) || (runtimePayload && runtimePayload.post && runtimePayload.post.bypassTriggers));
      let targetedReactions = [];
      try {
        if (!bypassCastTriggers && tref && tref.tile && src && src.boardName) {
          const attackerBoard = String(src.boardName || '').startsWith('p1')
            ? 'p1Board'
            : (String(src.boardName || '').startsWith('p2') ? 'p2Board' : 'p3Board');
          const attackerSide = attackerBoard.startsWith('p1') ? 'p1' : (attackerBoard.startsWith('p2') ? 'p2' : 'p3');
          const targetSide = String(tref.boardName || '').startsWith('p1')
            ? 'p1'
            : (String(tref.boardName || '').startsWith('p2') ? 'p2' : 'p3');
          const attackerIsEnemy = attackerSide !== targetSide;
          if (attackerIsEnemy) {
            const targetEffects = [
              ...((tref.tile && Array.isArray(tref.tile.effects)) ? tref.tile.effects : []),
              ...((tref.tile && Array.isArray(tref.tile._passives)) ? tref.tile._passives : [])
            ];
            targetEffects.forEach((eff, effectIdx) => {
              if (!eff || !eff.onTargeted) return;
              const ot = eff.onTargeted;
              if (ot.type === 'damage') {
                targetedReactions.push({
                  type: 'damageAttacker',
                  value: Number(ot.value || 0),
                  effectName: eff.name,
                  attackerBoard,
                  attackerIndex: Number(src.index),
                  ownerBoardName: tref.boardName,
                  ownerIndex: tref.index,
                  effectIndex: effectIdx
                });
              }
              if (ot.type === 'applyEffectToAttacker') {
                const effectName = ot.effect || ot.effectName || ot.name;
                if (!effectName) return;
                targetedReactions.push({
                  type: 'applyEffectToAttacker',
                  effectName,
                  attackerBoard,
                  attackerIndex: Number(src.index),
                  ownerBoardName: tref.boardName,
                  ownerIndex: tref.index,
                  effectIndex: effectIdx
                });
              }
            });
          }
        }
      } catch (e) {}
      // Apply caster on-cast effects to targeted enemies (e.g., Heating Up -> Burn)
      try {
        if (!bypassCastTriggers) {
          const casterEffects = (src && src.tile && Array.isArray(src.tile.effects)) ? src.tile.effects : [];
          const casterSide = (src && src.boardName && String(src.boardName).startsWith('p1'))
            ? 'p1'
            : ((src && src.boardName && String(src.boardName).startsWith('p2')) ? 'p2' : 'p3');
          for (const ce of casterEffects) {
            if (!ce || !ce.onCastApplyEffectToTargets) continue;
            const cfg = ce.onCastApplyEffectToTargets;
            const effectName = cfg.effect || cfg.effectName || cfg.name;
            if (!effectName) continue;
            const side = cfg.side || 'enemy';
            const targetSide = (tref && tref.boardName && String(tref.boardName).startsWith('p1'))
              ? 'p1'
              : ((tref && tref.boardName && String(tref.boardName).startsWith('p2')) ? 'p2' : 'p3');
            const isEnemy = targetSide !== casterSide;
            if ((side === 'enemy' && !isEnemy) || (side === 'ally' && isEnemy)) continue;
            const eff = EFFECTS[effectName] || null;
            if (eff) {
              pendingEffects.push({ target: tref, effects: [eff], applier: src });
              effectsApplied.push(eff.name);
            }
          }
        }
      } catch (e) {}

      // Apply Tower debuff augments tied to the caster's spell slot (e.g., Scorching Front -> Burn)
      try {
        if (!bypassCastTriggers) {
          const casterHero = src && src.tile && src.tile.hero ? src.tile.hero : null;
          const debuffAugments = casterHero && casterHero._towerDebuffAugments ? casterHero._towerDebuffAugments : null;
          if (debuffAugments && tref && tref.tile && tref.tile.hero) {
            const casterSide = (src && src.boardName && String(src.boardName).startsWith('p1'))
              ? 'p1'
              : ((src && src.boardName && String(src.boardName).startsWith('p2')) ? 'p2' : 'p3');
            const targetSide = (tref && tref.boardName && String(tref.boardName).startsWith('p1'))
              ? 'p1'
              : ((tref && tref.boardName && String(tref.boardName).startsWith('p2')) ? 'p2' : 'p3');
            if (casterSide && targetSide && casterSide === targetSide) return;
            let slotKey = (cast && cast.payload && cast.payload.slot) || null;
            if (!slotKey) {
              const sid = (cast && cast.payload && cast.payload.spellId) || (runtimePayload && runtimePayload.spellId) || null;
              const hs = casterHero && casterHero.spells ? casterHero.spells : null;
              if (sid && hs) {
                if (hs.front && hs.front.id === sid) slotKey = 'front';
                else if (hs.middle && hs.middle.id === sid) slotKey = 'middle';
                else if (hs.back && hs.back.id === sid) slotKey = 'back';
              }
            }
            const debuffsForSlot = slotKey ? (debuffAugments[slotKey] || []) : [];
            if (Array.isArray(debuffsForSlot) && debuffsForSlot.length > 0) {
              debuffsForSlot.forEach((effectName) => {
                const eff = effectName && (EFFECTS[effectName] || null);
                if (eff) {
                  pendingEffects.push({ target: tref, effects: [eff], applier: src });
                  effectsApplied.push(eff.name);
                }
              });
            }
          }
        }
      } catch (e) {}

      // Optional post hook: apply an effect to this target with a probability.
      try {
        const chanceSpec = (per && per.post && per.post.applyEffectWithChance) || (runtimePayload && runtimePayload.post && runtimePayload.post.applyEffectWithChance);
        if (chanceSpec) {
          const specs = Array.isArray(chanceSpec) ? chanceSpec : [chanceSpec];
          for (const cs of specs) {
            try {
              const effectName = cs && cs.effect;
              const chance = typeof cs.chance === 'number' ? Number(cs.chance) : (typeof cs.probability === 'number' ? Number(cs.probability) : 0);
              const eff = effectName && (EFFECTS[effectName] || null);
                if (eff && Math.random() < chance) {
                  addLog && addLog(`  > applyEffectWithChance: queued ${eff.name} on ${tref && tref.boardName}[${tref && tref.index}] (chance ${chance})`);
                  pendingEffects.push({ target: tref, effects: [eff], applier: src });
                  effectsApplied.push(eff.name);
                } else {
                addLog && addLog(`  > applyEffectWithChance: roll failed for ${effectName} (chance ${chance})`);
              }
            } catch (e) {}
          }
        }
      } catch (e) {}

      let appliedResult = applied;
      if (targetedReactions.length > 0) {
        if (!appliedResult || typeof appliedResult !== 'object') {
          appliedResult = { reactions: [] };
        }
        const existingReactions = Array.isArray(appliedResult.reactions) ? appliedResult.reactions : [];
        appliedResult.reactions = [...existingReactions, ...targetedReactions];
      }

      try {
        if (appliedResult && appliedResult.type === 'damage' && Number(appliedResult.amount || 0) > 0 && src && src.boardName && tref && tref.boardName) {
          const casterSide = String(src.boardName || '').startsWith('p1')
            ? 'p1'
            : (String(src.boardName || '').startsWith('p2') ? 'p2' : 'p3');
          const targetSide = String(tref.boardName || '').startsWith('p1')
            ? 'p1'
            : (String(tref.boardName || '').startsWith('p2') ? 'p2' : 'p3');
          if (casterSide !== targetSide) lifestealDamagedEnemyCount += 1;
        }
      } catch (e) {}

      actionResults.push({ target: tref, applied: appliedResult, effectsApplied, phase: phaseTag });

      // Arcane Exchange: when you heal an ally, gain +1 Energy and charge next-round damage bonus
      try {
        const isAllyTarget = src && tref && src.boardName && tref.boardName && src.boardName === tref.boardName;
        if (isAllyTarget && applied && applied.type === 'heal' && src && src.tile && src.tile.hero && src.tile.hero._towerArcaneExchange) {
          pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaEnergy: 1, phase: 'secondary' });
          src.tile._towerArcaneExchangePending = true;
          addLog && addLog(`  > Arcane Exchange: queued +1 energy for ${src.boardName}[${src.index}]`);
        }
      } catch (e) {}

      // If spec declares a deltaEnergy for this target (post.deltaEnergy),
      // queue it as a pendingCastChange so the UI shows the energy pulse and
      // the engine applies the energy at the same time as other pending changes.
      try {
        const postDeltaSpec = (per && per.post && typeof per.post.deltaEnergy !== 'undefined')
          ? per.post.deltaEnergy
          : (runtimePayload && runtimePayload.post ? runtimePayload.post.deltaEnergy : null);

        let deltaAmount = null;
        let targetRef = tref;

        if (typeof postDeltaSpec === 'number') {
          deltaAmount = Number(postDeltaSpec);
        } else if (postDeltaSpec && typeof postDeltaSpec === 'object') {
          const amt = Number(postDeltaSpec.amount || 0);
          if (amt !== 0) deltaAmount = amt;
          const target = String(postDeltaSpec.target || '').toLowerCase();
          const side = String(postDeltaSpec.side || '').toLowerCase();
          if (target === 'self' || target === 'caster') {
            targetRef = src || tref;
          } else if (target === 'target') {
            targetRef = tref;
          } else if (side === 'ally') {
            targetRef = src || tref;
          } else if (side === 'enemy') {
            targetRef = tref;
          }
        }

        if (deltaAmount && deltaAmount !== 0 && targetRef && targetRef.boardName) {
          const already = pendingCastChanges.some(ch =>
            ch && ch.boardName === targetRef.boardName &&
            Number(ch.index) === Number(targetRef.index) &&
            Number(ch.deltaEnergy || 0) === Number(deltaAmount)
          );
          if (!already) {
            pendingCastChanges.push({ boardName: targetRef.boardName, index: targetRef.index, deltaEnergy: Number(deltaAmount), phase: phaseTag });
            addLog && addLog(`  > post.deltaEnergy queued ${deltaAmount} to ${targetRef.boardName}[${targetRef.index}]`);
          }
        }
      } catch (e) {}

      // Conditional secondary hook: if this cast declared a `conditionalSecondaryOnWouldKill`
      // and the current target would be killed by the deferred damage we just queued, run the
      // `secondarySpec` as an additional deferred cast (using the original caster as source).
      try {
        const cond = runtimePayload && runtimePayload.post && runtimePayload.post.conditionalSecondaryOnWouldKill;
        if (cond && cond.secondarySpec && applied && applied.type === 'damage') {
          try {
            // find the pending deferred change we just queued for this target
            const matchPending = pendingCastChanges.find(ch => ch && ch.boardName === (tref && tref.boardName) && Number(ch.index) === Number(tref && tref.index) && typeof ch.deltaHealth === 'number');
            if (matchPending) {
              const arr = (matchPending.boardName || '').startsWith('p1') ? cP1 : cP2;
              const tile = (arr || [])[matchPending.index];
              const newHealth = (tile && typeof tile.currentHealth === 'number' ? tile.currentHealth : (tile && tile.hero && tile.hero.health) || 0) + Number(matchPending.deltaHealth || 0);
              if (newHealth <= 0) {
                addLog && addLog(`  > conditionalSecondaryOnWouldKill: target ${matchPending.boardName}[${matchPending.index}] would die — queuing secondary`);
                const bonusOptions = (runtimePayload && runtimePayload._bonusOptions) ? runtimePayload._bonusOptions : {};
                const secRuntime = buildPayloadFromSpec(cond.secondarySpec, src, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, null, bonusOptions);
                secRuntime.source = `${src.boardName}[${src.index}]`;
                // Apply per-target resolution for the secondary spec (deferred)
                for (let si = 0; si < (secRuntime.targets || []).length; si++) {
                  const st = secRuntime.targets[si];
                  const stRef = findTileInBoards(st, cP1, cP2, cP3, cR1, cR2, cR3);
                  const sper = (secRuntime && Array.isArray(secRuntime.perTargetPayloads) && secRuntime.perTargetPayloads[si]) ? { ...secRuntime, ...secRuntime.perTargetPayloads[si] } : secRuntime;
                  if (sper && sper.action) {
                    const applied2 = applyPayloadToTarget({ ...sper, source: sper.source || secRuntime.source }, stRef, addLog, { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 }, onStep, false);
                    if (applied2 && applied2.type === 'damage') pendingCastChanges.push({ boardName: stRef && stRef.boardName, index: stRef && stRef.index, deltaHealth: -Number(applied2.amount || 0), amount: Number(applied2.amount || 0), deltaEnergy: Number(applied2.deltaEnergy || 0), source: sper && sper.source || secRuntime.source, phase: 'secondary', voidShieldApplied: !!(applied2 && applied2.voidShieldApplied) });
                    if (applied2 && applied2.type === 'heal') pendingCastChanges.push({ boardName: stRef && stRef.boardName, index: stRef && stRef.index, deltaHealth: Number(applied2.amount || 0), amount: Number(applied2.amount || 0), deltaEnergy: Number(applied2.deltaEnergy || 0), phase: 'secondary' });
                    actionResults.push({ target: stRef, applied: applied2, effectsApplied: [], phase: 'secondary' });
                  }
                }
              }
            }
          } catch (e) {}
        }
      } catch (e) {}

      // Optional post-processing: swap caster with first living reserve hero (top to bottom)
      try {
        const swapSpec = (per && per.post && per.post.swapWithReserve) || (runtimePayload && runtimePayload.post && runtimePayload.post.swapWithReserve);
        if (!swapWithReserveApplied && swapSpec && src && src.tile && src.tile.hero && tref && tref.boardName === src.boardName && Number(tref.index) === Number(src.index)) {
          const sideKey = String(src.boardName || '').startsWith('p1') ? 'p1' : (String(src.boardName || '').startsWith('p2') ? 'p2' : 'p3');
          const mainBoard = sideKey === 'p1' ? cP1 : (sideKey === 'p2' ? cP2 : cP3);
          const reserveBoard = sideKey === 'p1' ? cR1 : (sideKey === 'p2' ? cR2 : cR3);
          const mainBoardName = sideKey === 'p1' ? 'p1Board' : (sideKey === 'p2' ? 'p2Board' : 'p3Board');
          const reserveBoardName = sideKey === 'p1' ? 'p1Reserve' : (sideKey === 'p2' ? 'p2Reserve' : 'p3Reserve');
          const mainIdx = Number(src.index);
          const reserveIdx = (reserveBoard || []).findIndex(slot => slot && slot.hero && !slot._dead && (typeof slot.currentHealth !== 'number' || slot.currentHealth > 0));

          if (mainIdx >= 0 && reserveIdx >= 0 && mainBoard[mainIdx] && reserveBoard[reserveIdx]) {
            const mainSlot = mainBoard[mainIdx];
            const reserveSlot = reserveBoard[reserveIdx];
            const mainSnapshot = {
              hero: mainSlot.hero,
              effects: Array.isArray(mainSlot.effects) ? mainSlot.effects.map(e => ({ ...e })) : [],
              _passives: Array.isArray(mainSlot._passives) ? mainSlot._passives.map(e => ({ ...e })) : [],
              _castsRemaining: mainSlot._castsRemaining ? { ...mainSlot._castsRemaining } : undefined,
              currentEnergy: mainSlot.currentEnergy,
              currentHealth: mainSlot.currentHealth,
              currentArmor: mainSlot.currentArmor,
              currentSpeed: mainSlot.currentSpeed,
              currentSpellPower: mainSlot.currentSpellPower,
              spellCasts: Array.isArray(mainSlot.spellCasts) ? mainSlot.spellCasts.map(c => ({ ...c })) : []
            };
            const reserveSnapshot = {
              hero: reserveSlot.hero,
              effects: Array.isArray(reserveSlot.effects) ? reserveSlot.effects.map(e => ({ ...e })) : [],
              _passives: Array.isArray(reserveSlot._passives) ? reserveSlot._passives.map(e => ({ ...e })) : [],
              _castsRemaining: reserveSlot._castsRemaining ? { ...reserveSlot._castsRemaining } : undefined,
              currentEnergy: reserveSlot.currentEnergy,
              currentHealth: reserveSlot.currentHealth,
              currentArmor: reserveSlot.currentArmor,
              currentSpeed: reserveSlot.currentSpeed,
              currentSpellPower: reserveSlot.currentSpellPower,
              spellCasts: Array.isArray(reserveSlot.spellCasts) ? reserveSlot.spellCasts.map(c => ({ ...c })) : []
            };

            mainSlot.hero = reserveSnapshot.hero;
            mainSlot.effects = reserveSnapshot.effects || [];
            mainSlot._passives = reserveSnapshot._passives || [];
            mainSlot._castsRemaining = reserveSnapshot._castsRemaining ? { ...reserveSnapshot._castsRemaining } : undefined;
            mainSlot.currentEnergy = reserveSnapshot.currentEnergy;
            mainSlot.currentHealth = reserveSnapshot.currentHealth;
            mainSlot.currentArmor = reserveSnapshot.currentArmor;
            mainSlot.currentSpeed = reserveSnapshot.currentSpeed;
            mainSlot.currentSpellPower = reserveSnapshot.currentSpellPower;
            mainSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
            mainSlot.spellCasts = reserveSnapshot.spellCasts || [];

            reserveSlot.hero = mainSnapshot.hero;
            reserveSlot.effects = mainSnapshot.effects || [];
            reserveSlot._passives = mainSnapshot._passives || [];
            reserveSlot._castsRemaining = mainSnapshot._castsRemaining ? { ...mainSnapshot._castsRemaining } : undefined;
            reserveSlot.currentEnergy = mainSnapshot.currentEnergy;
            reserveSlot.currentHealth = mainSnapshot.currentHealth;
            reserveSlot.currentArmor = mainSnapshot.currentArmor;
            reserveSlot.currentSpeed = mainSnapshot.currentSpeed;
            reserveSlot.currentSpellPower = mainSnapshot.currentSpellPower;
            reserveSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
            reserveSlot.spellCasts = [];

            const incomingSlot = slotForIndex(mainBoardName, mainIdx);
            if (Array.isArray(mainSlot.spellCasts) && mainSlot.spellCasts.length > 0) {
              mainSlot.spellCasts = mainSlot.spellCasts.map(sc => {
                if (!sc) return sc;
                const next = { ...sc };
                if (next.slot && next.slot !== 'basic') {
                  next.slot = incomingSlot;
                  try {
                    if (mainSlot.hero && mainSlot.hero.spells && mainSlot.hero.spells[incomingSlot] && mainSlot.hero.spells[incomingSlot].id) {
                      next.spellId = mainSlot.hero.spells[incomingSlot].id;
                    }
                  } catch (e) {}
                }
                return next;
              });
            }
            pruneInvalidQueuedCastsForCurrentSlot(mainSlot, mainBoardName, mainIdx);

            const gainEnergy = Number((typeof swapSpec === 'object' && swapSpec && swapSpec.gainEnergy != null) ? swapSpec.gainEnergy : 3) || 0;
            if (gainEnergy !== 0) {
              mainSlot.currentEnergy = Number(mainSlot.currentEnergy || 0) + gainEnergy;
              clampEnergy(mainSlot);
              addLog && addLog(`  > post.swapWithReserve granted ${gainEnergy} energy to ${mainBoardName}[${mainIdx}]`);
            }

            try {
              if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                pendingCasts = pendingCasts.filter(pc => !(pc && pc.caster && pc.caster.boardName === mainBoardName && Number(pc.caster.index) === mainIdx));
              }
            } catch (e) {}

            src.boardName = reserveBoardName;
            src.index = reserveIdx;
            src.tile = reserveSlot;

            try { recomputeModifiers(mainSlot); } catch (e) {}
            try { recomputeModifiers(reserveSlot); } catch (e) {}
            addLog && addLog(`  > post.swapWithReserve moved caster from ${mainBoardName}[${mainIdx}] to ${reserveBoardName}[${reserveIdx}]`);
            try {
              if (typeof onStep === 'function') {
                onStep({
                  p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3),
                  p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3),
                  priorityPlayer,
                  lastAction: { type: 'swapWithReserve', from: { board: mainBoardName, index: mainIdx }, to: { board: reserveBoardName, index: reserveIdx }, source: runtimePayload.source || null }
                });
              }
            } catch (e) {}
          } else {
            addLog && addLog('  > post.swapWithReserve miss: no living reserve hero available');
          }
          swapWithReserveApplied = true;
        }
      } catch (e) {}

      // Optional post-processing: damage the caster if requested
      try {
        const damageCaster = (per && per.post && per.post.damageCaster) || (runtimePayload && runtimePayload.post && runtimePayload.post.damageCaster);
        if (damageCaster && src && src.tile && src.tile.hero) {
          const amount = Number(typeof damageCaster === 'object' ? damageCaster.amount : damageCaster) || 1;
          const asAttackPower = !!(typeof damageCaster === 'object' && damageCaster.asAttackPower);
          let dealt = amount;
          if (asAttackPower) {
            const casterSpellPower = (typeof src.tile.currentSpellPower === 'number')
              ? Number(src.tile.currentSpellPower)
              : (src.tile.hero && typeof src.tile.hero.spellPower === 'number' ? Number(src.tile.hero.spellPower) : 0);
            const raw = Number(amount) + Number(casterSpellPower || 0);
            const armor = (typeof src.tile.currentArmor === 'number')
              ? Number(src.tile.currentArmor)
              : (src.tile.hero && typeof src.tile.hero.armor === 'number' ? Number(src.tile.hero.armor) : 0);
            dealt = Math.max(0, raw - Math.max(0, armor));
          }
          if (Number(dealt) > 0 && typeof onStep === 'function') {
            const lastAction = {
              type: 'effectPulse',
              target: { boardName: src.boardName, index: src.index },
              effectName: 'Spell',
              action: 'damage',
              amount: Number(dealt),
              phase: 'primary'
            };
            onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction });
          }
          applyHealthDelta(src.tile, -Number(dealt));
          addLog && addLog(`  > post.damageCaster dealt ${Number(dealt)} damage to caster ${src.boardName}[${src.index}]`);
        }
      } catch (e) {}

      // Optional post-processing: move the target hero back by one row if requested
      try {
        const moveBack = (per && per.post && per.post.moveRowBack) || (runtimePayload && runtimePayload.post && runtimePayload.post.moveRowBack);
        if (moveBack && tref && tref.boardName) {
          const boardName = (tref.boardName === 'p1Board') ? 'p1' : (tref.boardName === 'p2Board' ? 'p2' : 'p3');
          const boardArr = (boardName === 'p1') ? cP1 : (boardName === 'p2' ? cP2 : cP3);
          const boardKey = boardName === 'p1' ? 'p1Board' : (boardName === 'p2' ? 'p2Board' : 'p3Board');
          const row = indexToRow(tref.index, boardName);
          addLog && addLog(`  > post.moveRowBack triggered on ${tref.boardName}[${tref.index}] (row ${row})`);
          const pruneInvalidQueuedCasts = (slotTile, slotBoardKey, slotIndex) => {
            if (!slotTile) return;
            const slotName = slotForIndex(slotBoardKey, slotIndex);
            const remainingForSlot = slotTile._castsRemaining ? Number(slotTile._castsRemaining[slotName] || 0) : 0;
            if (!Array.isArray(slotTile.spellCasts) || slotTile.spellCasts.length === 0) return;
            let allowed = Math.max(0, remainingForSlot);
            const kept = [];
            const removedQueuedIds = new Set();
            slotTile.spellCasts.forEach(sc => {
              if (!sc) return;
              if (sc.slot === 'basic') {
                kept.push(sc);
                return;
              }
              if (allowed > 0) {
                kept.push(sc);
                allowed -= 1;
                return;
              }
              if (typeof sc.queuedId !== 'undefined') removedQueuedIds.add(sc.queuedId);
            });
            if (removedQueuedIds.size > 0) {
              slotTile.spellCasts = kept;
              if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                pendingCasts = pendingCasts.filter(pc => {
                  if (!pc || !pc.caster || !pc.payload) return true;
                  if (pc.caster.boardName !== slotBoardKey || Number(pc.caster.index) !== slotIndex) return true;
                  if (pc.payload.slot === 'basic') return true;
                  if (typeof pc.payload.queuedId === 'undefined') return true;
                  return !removedQueuedIds.has(pc.payload.queuedId);
                });
              }
            }
          };
          // Only move the specific targeted hero, not all heroes in the row
          const fromIdx = tref.index;
          // Use indexToColumn to get the correct visual column (accounts for P1/P2 board orientation)
          const col = indexToColumn(fromIdx, boardName);
          const indices = columnIndicesForBoard(col, boardName);
          const pos = indices.indexOf(fromIdx);
          if (pos !== -1) {
            const toPos = pos + 1;
            if (toPos < indices.length) { // there is a row behind
              const toIdx = indices[toPos];
              
              // Check if destination is occupied by another hero that also needs to move
              // If so, recursively move that hero first
              const toSlot = boardArr[toIdx];
              if (toSlot && toSlot.hero && !toSlot._dead) {
                // Recursively move the blocking hero first
                // Use indexToColumn to get the correct visual column (accounts for P1/P2 board orientation)
                const blockingCol = indexToColumn(toIdx, boardName);
                const blockingIndices = columnIndicesForBoard(blockingCol, boardName);
                const blockingPos = blockingIndices.indexOf(toIdx);
                if (blockingPos !== -1) {
                  const blockingToPos = blockingPos + 1;
                  if (blockingToPos < blockingIndices.length) {
                    const blockingToIdx = blockingIndices[blockingToPos];
                    const blockingToSlot = boardArr[blockingToIdx];
                    if (!blockingToSlot || !blockingToSlot.hero || blockingToSlot._dead) {
                      addLog && addLog(`  > Recursively moving blocking hero from ${boardName}[${toIdx}] to ${boardName}[${blockingToIdx}] first`);
                      // Move the blocking hero (code duplicated for simplicity)
                      blockingToSlot.hero = toSlot.hero;
                      blockingToSlot.effects = toSlot.effects || [];
                      blockingToSlot._castsRemaining = toSlot._castsRemaining ? { ...toSlot._castsRemaining } : undefined;
                      // Reset _lastAutoCastEnergy so auto-cast will re-evaluate the moved hero
                      // at their new position (new row = new spell slot with potentially different cost)
                      blockingToSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
                      blockingToSlot.currentEnergy = toSlot.currentEnergy;
                      blockingToSlot.currentHealth = toSlot.currentHealth;
                      blockingToSlot.currentArmor = toSlot.currentArmor;
                      blockingToSlot.currentSpeed = toSlot.currentSpeed;
                      blockingToSlot.currentSpellPower = toSlot.currentSpellPower;
                      try {
                        const movedCasts = (Array.isArray(toSlot.spellCasts) ? toSlot.spellCasts.map(c => ({ ...c })) : []);
                        const newSlot = slotForIndex(boardKey, blockingToIdx);
                        for (const mc of movedCasts) {
                          if (!mc || !mc.slot || mc.slot === 'basic') continue;
                          mc.slot = newSlot;
                          try { if (blockingToSlot && blockingToSlot.hero && blockingToSlot.hero.spells && blockingToSlot.hero.spells[newSlot] && blockingToSlot.hero.spells[newSlot].id) mc.spellId = blockingToSlot.hero.spells[newSlot].id; } catch (e) {}
                        }
                        blockingToSlot.spellCasts = (Array.isArray(blockingToSlot.spellCasts) ? blockingToSlot.spellCasts : []).concat(movedCasts);
                        if (movedCasts.length > 0) addLog && addLog(`  > Moved ${movedCasts.length} queued cast(s) from ${boardName}[${toIdx}] to ${boardName}[${blockingToIdx}]`);
                        pruneInvalidQueuedCasts(blockingToSlot, boardKey, blockingToIdx);
                        if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                          const expectedBoard = boardKey;
                          for (const pc of pendingCasts) {
                            if (!pc || !pc.caster || typeof pc.caster.index !== 'number' || pc.caster.boardName !== expectedBoard || Number(pc.caster.index) !== toIdx) continue;
                            pc.caster.index = blockingToIdx;
                            pc.caster.tile = blockingToSlot;
                            try { const match = movedCasts.find(mc => mc && mc.queuedId === (pc.payload && pc.payload.queuedId)); if (match && match.slot && match.slot !== 'basic') { pc.payload.slot = match.slot; pc.payload.spellId = match.spellId; } } catch (e) {}
                          }
                        }
                        if (typeof pendingCastChanges !== 'undefined' && Array.isArray(pendingCastChanges)) {
                          const expectedBoardName = boardKey;
                          for (const ch of pendingCastChanges) {
                            if (!ch || ch.boardName !== expectedBoardName || Number(ch.index) !== toIdx) continue;
                            ch.index = blockingToIdx;
                            addLog && addLog(`  > Updated pendingCastChange index from ${expectedBoardName}[${toIdx}] to ${expectedBoardName}[${blockingToIdx}]`);
                          }
                        }
                      } catch (e) {}
                      toSlot.hero = null;
                      toSlot.effects = [];
                      toSlot._castsRemaining = undefined;
                      toSlot._lastAutoCastEnergy = undefined;
                      toSlot.currentEnergy = undefined;
                      toSlot.currentHealth = undefined;
                      toSlot.currentArmor = undefined;
                      toSlot.currentSpeed = undefined;
                      toSlot.currentSpellPower = undefined;
                      try { toSlot.spellCasts = []; } catch (e) {}
                      try { recomputeModifiers(blockingToSlot); recomputeModifiers(toSlot); } catch (e) {}
                      // Update targetTokens for all remaining unprocessed targets that reference the moved blocking hero
                      try {
                        const expectedBoardShort = boardName;
                        for (let i = tidx + 1; i < targetTokens.length; i++) {
                          const tok = targetTokens[i];
                          if (!tok) continue;
                          if (typeof tok === 'string' && tok.includes(':')) {
                            const [b, idx] = tok.split(':');
                            const tokIdx = parseInt(idx, 10);
                            if (b === expectedBoardShort && tokIdx === toIdx) {
                              targetTokens[i] = `${b}:${blockingToIdx}`;
                              addLog && addLog(`  > Updated targetToken ${i} from ${tok} to ${targetTokens[i]} due to recursive moveRowBack`);
                            }
                          } else if (typeof tok === 'object' && tok.board === expectedBoardShort && tok.index === toIdx) {
                            tok.index = blockingToIdx;
                            addLog && addLog(`  > Updated targetToken ${i} index from ${toIdx} to ${blockingToIdx} due to recursive moveRowBack`);
                          }
                        }
                      } catch (e) {}
                    }
                  }
                }
              }
              
              // Now move the original hero
              const fromSlot = boardArr[fromIdx];
              const finalToSlot = boardArr[toIdx];
              if (fromSlot && fromSlot.hero && (!finalToSlot || !finalToSlot.hero || finalToSlot._dead)) {
                // Ensure destination slot exists (defensive - boards should always have 9 slot objects)
                if (!boardArr[toIdx]) {
                  console.error('[moveRowBack] Destination slot is null - cannot move hero', { boardName, toIdx, boardArrLength: boardArr?.length });
                  return; // Skip this spell cast in the forEach loop
                }
                addLog && addLog(`  > Moving hero from ${boardName}[${fromIdx}] to ${boardName}[${toIdx}] due to moveRowBack`);
                // move hero and runtime fields - access board directly to ensure slot exists
                const toSlot = boardArr[toIdx];
                toSlot.hero = fromSlot.hero;
                toSlot.effects = fromSlot.effects || [];
                toSlot._castsRemaining = fromSlot._castsRemaining ? { ...fromSlot._castsRemaining } : undefined;
                // Reset _lastAutoCastEnergy so auto-cast will re-evaluate the moved hero
                // at their new position (new row = new spell slot with potentially different cost)
                toSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
                toSlot.currentEnergy = fromSlot.currentEnergy;
                toSlot.currentHealth = fromSlot.currentHealth;
                toSlot.currentArmor = fromSlot.currentArmor;
                toSlot.currentSpeed = fromSlot.currentSpeed;
                toSlot.currentSpellPower = fromSlot.currentSpellPower;
                // Move any queued casts with the hero so the cast order reflects the new position
                try {
                  const movedCasts = (Array.isArray(fromSlot.spellCasts) ? fromSlot.spellCasts.map(c => ({ ...c })) : []);
                  // Update moved casts to match the hero's new slot mapping (e.g., front->middle when moved back one row)
                  try {
                    const newSlot = slotForIndex(boardKey, toIdx);
                    for (const mc of movedCasts) {
                      if (!mc) continue;
                      // Only remap non-basic entries
                      if (mc.slot && mc.slot !== 'basic') {
                        mc.slot = newSlot;
                        // Update spellId to the hero's spell at the new slot, if possible
                        try {
                          if (toSlot && toSlot.hero && toSlot.hero.spells && toSlot.hero.spells[newSlot] && toSlot.hero.spells[newSlot].id) {
                            mc.spellId = toSlot.hero.spells[newSlot].id;
                          }
                        } catch (e) {}
                      }
                    }
                  } catch (e) {}

                  toSlot.spellCasts = (Array.isArray(toSlot.spellCasts) ? toSlot.spellCasts : []).concat(movedCasts);
                  if (movedCasts.length > 0) addLog && addLog(`  > Moved ${movedCasts.length} queued cast(s) from ${boardName}[${fromIdx}] to ${boardName}[${toIdx}] due to moveRowBack`);
                  pruneInvalidQueuedCasts(toSlot, boardKey, toIdx);

                  // Update in-memory pending cast references so already-collected casts point to the new index
                  try {
                    if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                      for (const pc of pendingCasts) {
                        if (!pc || !pc.caster || typeof pc.caster.index !== 'number' || !pc.caster.boardName) continue;
                        const pcBoard = pc.caster.boardName;
                        const expectedBoard = boardKey;
                        if (pcBoard === expectedBoard && Number(pc.caster.index) === fromIdx) {
                          // If this pending cast matches one of the moved casts by queuedId, update its payload and caster ref
                          try {
                            const match = movedCasts.find(mc => mc && mc.queuedId === (pc.payload && pc.payload.queuedId));
                            if (match) {
                              if (match.slot && match.slot !== 'basic') {
                                pc.payload.slot = match.slot;
                                pc.payload.spellId = match.spellId;
                              }
                            }
                          } catch (e) {}
                          pc.caster.index = toIdx;
                          pc.caster.tile = toSlot;
                          addLog && addLog(`  > Updated pending cast caster ref from ${boardName}[${fromIdx}] to ${boardName}[${toIdx}]`);
                        }
                      }
                    }
                  } catch (e) {}
                  // Update pendingCastChanges so health/energy deltas target the moved hero's new index
                  try {
                    if (typeof pendingCastChanges !== 'undefined' && Array.isArray(pendingCastChanges)) {
                      const expectedBoardName = boardKey;
                      for (const ch of pendingCastChanges) {
                        if (!ch || ch.boardName !== expectedBoardName || Number(ch.index) !== fromIdx) continue;
                        ch.index = toIdx;
                        addLog && addLog(`  > Updated pendingCastChange index from ${expectedBoardName}[${fromIdx}] to ${expectedBoardName}[${toIdx}]`);
                      }
                    }
                  } catch (e) {}
                } catch (e) {}
                // clear source slot - access board directly in case reference was invalidated
                if (boardArr[fromIdx]) {
                  boardArr[fromIdx].hero = null;
                  boardArr[fromIdx].effects = [];
                  boardArr[fromIdx]._castsRemaining = undefined;
                  boardArr[fromIdx]._lastAutoCastEnergy = undefined;
                  boardArr[fromIdx].currentEnergy = undefined;
                  boardArr[fromIdx].currentHealth = undefined;
                  boardArr[fromIdx].currentArmor = undefined;
                  boardArr[fromIdx].currentSpeed = undefined;
                  boardArr[fromIdx].currentSpellPower = undefined;
                  // Clear any queued casts left on the source slot since the hero moved
                  try { boardArr[fromIdx].spellCasts = []; } catch (e) {}
                }
                try { recomputeModifiers(toSlot); } catch (e) {}
                try { if (boardArr[fromIdx]) recomputeModifiers(boardArr[fromIdx]); } catch (e) {}
                // Emit an onStep movement event so UI can animate reposition
                try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'moveRowBack', source: runtimePayload.source || null, from: { board: boardName, index: fromIdx }, to: { board: boardName, index: toIdx } } }); } catch (e) {}
                // Update targetTokens for all remaining unprocessed targets that reference the moved hero
                try {
                  const expectedBoardName = boardKey;
                  const expectedBoardShort = boardName;
                  for (let i = tidx + 1; i < targetTokens.length; i++) {
                    const tok = targetTokens[i];
                    if (!tok) continue;
                    // Handle string format like "p1:5"
                    if (typeof tok === 'string' && tok.includes(':')) {
                      const [b, idx] = tok.split(':');
                      const tokIdx = parseInt(idx, 10);
                      if (b === expectedBoardShort && tokIdx === fromIdx) {
                        targetTokens[i] = `${b}:${toIdx}`;
                        addLog && addLog(`  > Updated targetToken ${i} from ${tok} to ${targetTokens[i]} due to moveRowBack`);
                      }
                    }
                    // Handle object format like {board: 'p1', index: 5}
                    else if (typeof tok === 'object' && tok.board === expectedBoardShort && tok.index === fromIdx) {
                      tok.index = toIdx;
                      addLog && addLog(`  > Updated targetToken ${i} index from ${fromIdx} to ${toIdx} due to moveRowBack`);
                    }
                  }
                } catch (e) {}
              }
            } else {
            }
          } else {
          }
        }
      } catch (e) {
        console.error('[moveRowBack] Error:', e);
      }

      // Optional post-processing: move the targeted hero to the frontmost available row in their column
      try {
        const moveFront = (per && per.post && per.post.moveToFrontmostAvailable) || (runtimePayload && runtimePayload.post && runtimePayload.post.moveToFrontmostAvailable);
        if (moveFront && tref && tref.boardName) {
          const boardName = (tref.boardName === 'p1Board') ? 'p1' : (tref.boardName === 'p2Board' ? 'p2' : 'p3');
          const boardArr = (boardName === 'p1') ? cP1 : (boardName === 'p2' ? cP2 : cP3);
          const boardKey = boardName === 'p1' ? 'p1Board' : (boardName === 'p2' ? 'p2Board' : 'p3Board');
          const fromIdx = Number(tref.index);
          const fromSlot = boardArr[fromIdx];
          if (fromSlot && fromSlot.hero && !fromSlot._dead) {
            const col = indexToColumn(fromIdx, boardName);
            const indices = columnIndicesForBoard(col, boardName); // front->middle->back
            let toIdx = fromIdx;
            for (const idx of indices) {
              const slot = boardArr[idx];
              const occupiedByOther = idx !== fromIdx && slot && slot.hero && !slot._dead;
              if (!occupiedByOther) {
                toIdx = idx;
                break;
              }
            }

            if (toIdx !== fromIdx && boardArr[toIdx] && (!boardArr[toIdx].hero || boardArr[toIdx]._dead)) {
              const toSlot = boardArr[toIdx];
              addLog && addLog(`  > post.moveToFrontmostAvailable moving hero from ${boardName}[${fromIdx}] to ${boardName}[${toIdx}]`);

              toSlot.hero = fromSlot.hero;
              toSlot.effects = fromSlot.effects || [];
              toSlot._castsRemaining = fromSlot._castsRemaining ? { ...fromSlot._castsRemaining } : undefined;
              toSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
              toSlot.currentEnergy = fromSlot.currentEnergy;
              toSlot.currentHealth = fromSlot.currentHealth;
              toSlot.currentArmor = fromSlot.currentArmor;
              toSlot.currentSpeed = fromSlot.currentSpeed;
              toSlot.currentSpellPower = fromSlot.currentSpellPower;

              try {
                const movedCasts = (Array.isArray(fromSlot.spellCasts) ? fromSlot.spellCasts.map(c => ({ ...c })) : []);
                const newSlot = slotForIndex(boardKey, toIdx);
                for (const mc of movedCasts) {
                  if (!mc || !mc.slot || mc.slot === 'basic') continue;
                  mc.slot = newSlot;
                  try {
                    if (toSlot && toSlot.hero && toSlot.hero.spells && toSlot.hero.spells[newSlot] && toSlot.hero.spells[newSlot].id) {
                      mc.spellId = toSlot.hero.spells[newSlot].id;
                    }
                  } catch (e) {}
                }
                toSlot.spellCasts = (Array.isArray(toSlot.spellCasts) ? toSlot.spellCasts : []).concat(movedCasts);

                if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                  const expectedBoard = boardKey;
                  for (const pc of pendingCasts) {
                    if (!pc || !pc.caster || typeof pc.caster.index !== 'number' || pc.caster.boardName !== expectedBoard || Number(pc.caster.index) !== fromIdx) continue;
                    pc.caster.index = toIdx;
                    pc.caster.tile = toSlot;
                    try {
                      const match = movedCasts.find(mc => mc && mc.queuedId === (pc.payload && pc.payload.queuedId));
                      if (match && match.slot && match.slot !== 'basic') {
                        pc.payload.slot = match.slot;
                        pc.payload.spellId = match.spellId;
                      }
                    } catch (e) {}
                  }
                }

                if (typeof pendingCastChanges !== 'undefined' && Array.isArray(pendingCastChanges)) {
                  const expectedBoardName = boardKey;
                  for (const ch of pendingCastChanges) {
                    if (!ch || ch.boardName !== expectedBoardName || Number(ch.index) !== fromIdx) continue;
                    ch.index = toIdx;
                  }
                }
              } catch (e) {}

              fromSlot.hero = null;
              fromSlot.effects = [];
              fromSlot._castsRemaining = undefined;
              fromSlot._lastAutoCastEnergy = undefined;
              fromSlot.currentEnergy = undefined;
              fromSlot.currentHealth = undefined;
              fromSlot.currentArmor = undefined;
              fromSlot.currentSpeed = undefined;
              fromSlot.currentSpellPower = undefined;
              try { fromSlot.spellCasts = []; } catch (e) {}

              try { recomputeModifiers(toSlot); } catch (e) {}
              try { recomputeModifiers(fromSlot); } catch (e) {}

              try {
                if (typeof onStep === 'function') {
                  onStep({
                    p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3),
                    p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3),
                    priorityPlayer,
                    lastAction: {
                      type: 'moveToFrontmostAvailable',
                      source: runtimePayload.source || null,
                      from: { board: boardName, index: fromIdx },
                      to: { board: boardName, index: toIdx }
                    }
                  });
                }
              } catch (e) {}

              try {
                const expectedBoardShort = boardName;
                for (let i = tidx + 1; i < targetTokens.length; i++) {
                  const tok = targetTokens[i];
                  if (!tok) continue;
                  if (typeof tok === 'string' && tok.includes(':')) {
                    const [b, idx] = tok.split(':');
                    const tokIdx = parseInt(idx, 10);
                    if (b === expectedBoardShort && tokIdx === fromIdx) {
                      targetTokens[i] = `${b}:${toIdx}`;
                    }
                  } else if (typeof tok === 'object' && tok.board === expectedBoardShort && tok.index === fromIdx) {
                    tok.index = toIdx;
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.error('[moveToFrontmostAvailable] Error:', e);
      }

      // Optional post-processing: move all heroes in each column back as far as possible
      try {
        const moveAll = (per && per.post && per.post.moveAllBack) || (runtimePayload && runtimePayload.post && runtimePayload.post.moveAllBack);
        const boardName = (tref && tref.boardName === 'p1Board') ? 'p1' : (tref && tref.boardName === 'p2Board' ? 'p2' : 'p3');
        if (moveAll && tref && tref.boardName && !moveAllBackApplied.has(boardName)) {
          moveAllBackApplied.add(boardName);
          const boardArr = (boardName === 'p1') ? cP1 : (boardName === 'p2' ? cP2 : cP3);
          const boardKey = boardName === 'p1' ? 'p1Board' : (boardName === 'p2' ? 'p2Board' : 'p3Board');
          addLog && addLog(`  > post.moveAllBack triggered on ${tref.boardName}[${tref.index}]`);
          for (let col = 0; col < 3; col++) {
            const indices = columnIndicesForBoard(col, boardName); // front->middle->back
            const heroIndices = indices.filter(i => boardArr[i] && boardArr[i].hero);
            const n = heroIndices.length;
            if (n === 0) continue;
            const dest = indices.slice(indices.length - n);
            // capture entries
            const entries = heroIndices.map(i => {
              const s = boardArr[i];
              return {
                fromIdx: i,
                data: {
                  hero: s.hero && { ...s.hero },
                  effects: Array.isArray(s.effects) ? s.effects.map(e => ({ ...e })) : [],
                  _castsRemaining: s._castsRemaining ? { ...s._castsRemaining } : undefined,
                  _lastAutoCastEnergy: s._lastAutoCastEnergy,
                  currentEnergy: s.currentEnergy,
                  currentHealth: s.currentHealth,
                  currentArmor: s.currentArmor,
                  currentSpeed: s.currentSpeed,
                  currentSpellPower: s.currentSpellPower,
                  spellCasts: Array.isArray(s.spellCasts) ? s.spellCasts.map(c => ({ ...c })) : []
                }
              };
            });
            // clear sources
            for (const e of entries) {
              try {
                const fs = boardArr[e.fromIdx];
                fs.hero = null; fs.effects = []; fs._castsRemaining = undefined; fs._lastAutoCastEnergy = undefined;
                fs.currentEnergy = undefined; fs.currentHealth = undefined; fs.currentArmor = undefined; fs.currentSpeed = undefined; fs.currentSpellPower = undefined;
                try { fs.spellCasts = []; } catch (ee) {}
                try { recomputeModifiers(fs); } catch (ee) {}
              } catch (ee) {}
            }
            // place into destinations preserving order
            for (let j = 0; j < entries.length; j++) {
              const toIdx = dest[j];
              const ent = entries[j];
              const toSlot = boardArr[toIdx];
              const d = ent.data;
              toSlot.hero = d.hero;
              toSlot.effects = d.effects || [];
              toSlot._castsRemaining = d._castsRemaining ? { ...d._castsRemaining } : undefined;
              // Reset _lastAutoCastEnergy so auto-cast will re-evaluate the moved hero
              // at their new position (new row = new spell slot with potentially different cost)
              toSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
              toSlot.currentEnergy = d.currentEnergy;
              toSlot.currentHealth = d.currentHealth;
              toSlot.currentArmor = d.currentArmor;
              toSlot.currentSpeed = d.currentSpeed;
              toSlot.currentSpellPower = d.currentSpellPower;
              try {
                const movedCasts = (Array.isArray(d.spellCasts) ? d.spellCasts.map(c => ({ ...c })) : []);
                const newSlot = slotForIndex(boardKey, toIdx);
                for (const mc of movedCasts) {
                  if (mc && mc.slot && mc.slot !== 'basic') mc.slot = newSlot;
                  try { if (toSlot && toSlot.hero && toSlot.hero.spells && toSlot.hero.spells[newSlot] && toSlot.hero.spells[newSlot].id) mc.spellId = toSlot.hero.spells[newSlot].id; } catch (e) {}
                }
                toSlot.spellCasts = (Array.isArray(toSlot.spellCasts) ? toSlot.spellCasts : []).concat(movedCasts);
                pruneInvalidQueuedCastsForCurrentSlot(toSlot, boardKey, toIdx);
                if (movedCasts.length > 0) addLog && addLog(`  > Moved ${movedCasts.length} queued cast(s) into ${boardName}[${toIdx}] due to moveAllBack`);
                try {
                  if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                    for (const pc of pendingCasts) {
                      if (!pc || !pc.caster || typeof pc.caster.index !== 'number' || !pc.caster.boardName) continue;
                      const expectedBoard = boardKey;
                      if (pc.caster.boardName === expectedBoard && Number(pc.caster.index) === ent.fromIdx) {
                        const match = movedCasts.find(mc => mc && mc.queuedId === (pc.payload && pc.payload.queuedId));
                        if (match) {
                          if (match.slot && match.slot !== 'basic') {
                            pc.payload.slot = match.slot; pc.payload.spellId = match.spellId;
                          }
                        }
                        pc.caster.index = toIdx; pc.caster.tile = toSlot;
                        addLog && addLog(`  > Updated pending cast caster ref from ${boardName}[${ent.fromIdx}] to ${boardName}[${toIdx}]`);
                      }
                    }
                  }
                } catch (e) {}
              } catch (e) {}
              try { recomputeModifiers(toSlot); } catch (e) {}
            }
            try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'moveAllBack', source: runtimePayload.source || null, column: col } }); } catch (e) {}
          }
        }
      } catch (e) {}

      // Optional post-processing: reduce the number of casts for the row containing the target
      try {
        const reduceBy = (per && per.post && typeof per.post.reduceRowCastsBy === 'number') ? Number(per.post.reduceRowCastsBy) : (runtimePayload && runtimePayload.post && typeof runtimePayload.post.reduceRowCastsBy === 'number' ? Number(runtimePayload.post.reduceRowCastsBy) : 0);
        if (reduceBy && tref && tref.boardName) {
          const boardName = (tref.boardName === 'p1Board') ? 'p1' : (tref.boardName === 'p2Board' ? 'p2' : 'p3');
          const boardArr = (boardName === 'p1') ? cP1 : (boardName === 'p2' ? cP2 : cP3);
          const row = indexToRow(tref.index, boardName);
          const slotKey = row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
          addLog && addLog(`  > post.reduceRowCastsBy ${reduceBy} on ${tref.boardName}[${tref.index}] (row ${row}, slot ${slotKey})`);
          const pruneQueuedCastsForSlot = (slotTile, slotBoardKey, slotIndex, slotName) => {
            if (!slotTile || !Array.isArray(slotTile.spellCasts) || slotTile.spellCasts.length === 0) return;
            let allowed = Math.max(0, Number(slotTile._castsRemaining ? slotTile._castsRemaining[slotName] || 0 : 0));
            const kept = [];
            const removedQueuedIds = new Set();
            slotTile.spellCasts.forEach(sc => {
              if (!sc) return;
              if (sc.slot !== slotName) {
                kept.push(sc);
                return;
              }
              if (allowed > 0) {
                kept.push(sc);
                allowed -= 1;
                return;
              }
              if (typeof sc.queuedId !== 'undefined') removedQueuedIds.add(sc.queuedId);
            });
            if (removedQueuedIds.size > 0) {
              slotTile.spellCasts = kept;
              if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                pendingCasts = pendingCasts.filter(pc => {
                  if (!pc || !pc.caster || !pc.payload) return true;
                  if (pc.caster.boardName !== slotBoardKey || Number(pc.caster.index) !== slotIndex) return true;
                  if (pc.payload.slot !== slotName) return true;
                  if (typeof pc.payload.queuedId === 'undefined') return true;
                  return !removedQueuedIds.has(pc.payload.queuedId);
                });
              }
            }
          };
          // For each slot in the row, decrement its tile._castsRemaining for the corresponding slotKey
          const map = (boardName === 'p1') ? [2,5,8,1,4,7,0,3,6] : (boardName === 'p2' ? [6,3,0,7,4,1,8,5,2] : [0,1,2,3,4,5,6,7,8]);
          for (const idx of map) {
            const r = indexToRow(idx, boardName);
            if (r !== row) continue;
            const slot = boardArr[idx];
            if (!slot || !slot.hero) continue;
            if (!slot._castsRemaining) slot._castsRemaining = { front: 0, middle: 0, back: 0 };
            const before = Number(slot._castsRemaining[slotKey] || 0);
            slot._castsRemaining[slotKey] = Math.max(0, before - reduceBy);
            addLog && addLog(`  > Reduced ${boardName}[${idx}]._castsRemaining.${slotKey} ${before} -> ${slot._castsRemaining[slotKey]}`);
            pruneQueuedCastsForSlot(slot, (boardName === 'p1') ? 'p1Board' : (boardName === 'p2' ? 'p2Board' : 'p3Board'), idx, slotKey);
            // Emit a small onStep to update visuals
            try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'reduceRowCasts', board: boardName, index: idx, slot: slotKey, before, after: slot._castsRemaining[slotKey] } }); } catch (e) {}
          }
        }
      } catch (e) {}

      // Optional post-processing: increase the number of casts for the row containing the target
      try {
        const increaseBy = (per && per.post && typeof per.post.increaseRowCastsBy === 'number') ? Number(per.post.increaseRowCastsBy) : (runtimePayload && runtimePayload.post && typeof runtimePayload.post.increaseRowCastsBy === 'number' ? Number(runtimePayload.post.increaseRowCastsBy) : 0);
        if (increaseBy && tref && tref.boardName) {
          const boardName = (tref.boardName === 'p1Board') ? 'p1' : (tref.boardName === 'p2Board' ? 'p2' : 'p3');
          const boardArr = (boardName === 'p1') ? cP1 : (boardName === 'p2' ? cP2 : cP3);
          const row = indexToRow(tref.index, boardName);
          const slotKey = row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
          addLog && addLog(`  > post.increaseRowCastsBy ${increaseBy} on ${tref.boardName}[${tref.index}] (row ${row}, slot ${slotKey})`);
          const map = (boardName === 'p1') ? [2,5,8,1,4,7,0,3,6] : (boardName === 'p2' ? [6,3,0,7,4,1,8,5,2] : [0,1,2,3,4,5,6,7,8]);
          for (const idx of map) {
            const r = indexToRow(idx, boardName);
            if (r !== row) continue;
            const slot = boardArr[idx];
            if (!slot || !slot.hero) continue;
            if (!slot._castsRemaining) slot._castsRemaining = { front: 0, middle: 0, back: 0 };
            const before = Number(slot._castsRemaining[slotKey] || 0);
            slot._castsRemaining[slotKey] = before + increaseBy;
            addLog && addLog(`  > Increased ${boardName}[${idx}]._castsRemaining.${slotKey} ${before} -> ${slot._castsRemaining[slotKey]}`);
            try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'increaseRowCasts', board: boardName, index: idx, slot: slotKey, before, after: slot._castsRemaining[slotKey] } }); } catch (e) {}
          }
        }
      } catch (e) {}
    });

    try {
      const passiveList = (src && src.tile && Array.isArray(src.tile._passives))
        ? src.tile._passives
        : (src && src.tile && src.tile.hero && Array.isArray(src.tile.hero.passives) ? src.tile.hero.passives : []);
      const lifesteal = (passiveList || []).find(p => p && p.name === 'Lifesteal');
      if (lifesteal && lifestealDamagedEnemyCount > 0) {
        const healPer = Math.max(1, Number(lifesteal.healPerDamagedEnemy || 1));
        const totalHeal = lifestealDamagedEnemyCount * healPer;
        pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaHealth: totalHeal, amount: totalHeal, phase: 'secondary' });
        addLog && addLog(`  > Lifesteal: queued heal ${totalHeal} to ${src.boardName}[${src.index}] (${lifestealDamagedEnemyCount} damaged enemies)`);
      }
    } catch (e) {}

    if (firstStrikeActive && src && src.tile) {
      src.tile._towerFirstStrikeUsed = true;
    }

    // Warm-Up: after first cast each round, gain +1 Energy
    try {
      if (src && src.tile && src.tile.hero && src.tile.hero._towerWarmUp && !src.tile._towerWarmUpUsedRound) {
        pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaEnergy: 1, phase: 'secondary' });
        src.tile._towerWarmUpUsedRound = true;
        addLog && addLog(`  > Warm-Up: queued +1 energy to ${src.boardName}[${src.index}]`);
      }
    } catch (e) {}

    // Momentum: each cast grants +1 Speed, max +2 per battle
    try {
      if (src && src.tile && src.tile.hero && src.tile.hero._towerMomentum) {
        const gains = Number(src.tile._towerMomentumGains || 0);
        if (gains < 2) {
          src.tile._towerMomentumGains = gains + 1;
          src.tile.hero.speed = (src.tile.hero.speed || 0) + 1;
          src.tile.currentSpeed = (src.tile.currentSpeed || src.tile.hero.speed || 0) + 1;
          try { recomputeModifiers(src.tile); } catch (e) {}
          addLog && addLog(`  > Momentum: ${src.boardName}[${src.index}] speed +1 (${src.tile._towerMomentumGains}/2)`);
        }
      }
    } catch (e) {}

    // Echo Caster: first cast each round grants +1 casts for that row next round
    try {
      if (src && src.tile && src.tile.hero && src.tile.hero._towerEchoCaster && !src.tile._towerEchoCasterUsedRound) {
        const side = String(src.boardName || '').startsWith('p1') ? 'p1' : (String(src.boardName || '').startsWith('p2') ? 'p2' : 'p3');
        const row = indexToRow(src.index, side);
        const slotKey = row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
        src.tile._towerEchoCasterPending = slotKey;
        src.tile._towerEchoCasterUsedRound = true;
        addLog && addLog(`  > Echo Caster: queued +1 ${slotKey} casts next round for ${src.boardName}[${src.index}]`);
      }
    } catch (e) {}

    // Apply tower special augments (e.g., Vampiric) based on damage dealt this cast.
    try {
      const casterHero = src && src.tile && src.tile.hero ? src.tile.hero : null;
      const sourceKey = runtimePayload && runtimePayload.source ? runtimePayload.source : null;
      if (casterHero && casterHero._towerVampiric && sourceKey && Array.isArray(pendingCastChanges)) {
        const totalDamage = pendingCastChanges
          .filter(ch => ch && ch.source === sourceKey && typeof ch.deltaHealth === 'number' && Number(ch.deltaHealth) < 0)
          .reduce((sum, ch) => sum + Math.abs(Number(ch.amount || ch.deltaHealth || 0)), 0);
        const healAmt = Math.floor(totalDamage * 0.25);
        if (healAmt > 0 && src && src.boardName) {
          pendingCastChanges.push({ boardName: src.boardName, index: src.index, deltaHealth: healAmt, amount: healAmt, phase: 'secondary' });
        }
      }
    } catch (e) {}

    // At resolution time, subtract the spell cost from the caster's visible energy.
    try {
      if (resolvedSpellCost > 0 && src && src.tile && typeof src.tile.currentEnergy === 'number') {
        src.tile.currentEnergy = Math.max(0, src.tile.currentEnergy - resolvedSpellCost);
        addLog && addLog(`  > ${src.boardName}[${src.index}] spent ${resolvedSpellCost} energy (now ${src.tile.currentEnergy})`);
        // Update the auto-cast snapshot to the caster's new energy after spending.
        // This ensures later mid-round energy gains (Frenzy, pulses) are compared
        // against the correct baseline and can trigger auto-enqueue when appropriate.
        try { src.tile._lastAutoCastEnergy = Number(src.tile.currentEnergy || 0); } catch (e) {}
      }
    } catch (e) {}

    // Decrement the caster's remaining-casts for the slot at resolution time.
    try {
      if (src && src.tile && src.tile._castsRemaining) {
        // Prefer explicit slot annotated on the queued payload (set at enqueue time)
        let resolvedSlot = (cast.payload && cast.payload.slot) || null;
        // Fallback: infer from caster's hero spell slots if spellId present and slot missing
        if (!resolvedSlot && cast.payload && cast.payload.spellId && src.tile.hero && src.tile.hero.spells) {
          const sid = cast.payload.spellId;
          const hs = src.tile.hero.spells;
          if (hs.front && hs.front.id === sid) resolvedSlot = 'front';
          else if (hs.middle && hs.middle.id === sid) resolvedSlot = 'middle';
          else if (hs.back && hs.back.id === sid) resolvedSlot = 'back';
        }
        if (resolvedSlot && resolvedSlot !== 'basic' && typeof src.tile._castsRemaining[resolvedSlot] === 'number') {
          src.tile._castsRemaining[resolvedSlot] = Math.max(0, Number(src.tile._castsRemaining[resolvedSlot]) - 1);
          addLog && addLog(`  > ${src.boardName}[${src.index}] ${resolvedSlot} casts remaining -> ${src.tile._castsRemaining[resolvedSlot]}`);
        }
      }
    } catch (e) {}

    // Double-cast augments: enqueue an extra cast if eligible.
    try {
      const basePayload = cast && cast.payload ? cast.payload : null;
      const resolvedSlot = basePayload && basePayload.slot ? basePayload.slot : null;
      const baseSpellId = basePayload && basePayload.spellId ? basePayload.spellId : null;
      const isBonusCast = !!(basePayload && basePayload._towerBonusCast);
      const canDouble = !isBonusCast && resolvedSlot && resolvedSlot !== 'basic' && baseSpellId;

      if (canDouble && src && src.tile && src.tile.hero) {
        let shouldEcho = false;
        const echoSlot = src.tile.hero._towerSpellEcho;
        const hasEcho = echoSlot && resolvedSlot === echoSlot;
        if (hasEcho) {
          const remaining = src.tile._castsRemaining ? Number(src.tile._castsRemaining[resolvedSlot] || 0) : 0;
          if (remaining > 0) shouldEcho = true;
        }

        let shouldDoubleStrike = false;
        if (!shouldEcho && typeof src.tile.hero._towerDoubleStrike === 'number') {
          const chance = Number(src.tile.hero._towerDoubleStrike || 0);
          if (chance > 0 && Math.random() < chance) shouldDoubleStrike = true;
        }

        if (shouldEcho || shouldDoubleStrike) {
          const bonusPayload = {
            spellId: baseSpellId,
            slot: resolvedSlot,
            queuedEnergy: (typeof basePayload.queuedEnergy === 'number') ? basePayload.queuedEnergy : Number(src.tile.currentEnergy || 0),
            queuedCost: (typeof basePayload.queuedCost === 'number') ? basePayload.queuedCost : undefined,
            _towerBonusCast: true,
            _towerBonusCastReason: shouldEcho ? 'spellEcho' : 'doubleStrike'
          };
          bonusPayload.queuedId = ++_queuedCastCounter;
          src.tile.spellCasts = src.tile.spellCasts || [];
          src.tile.spellCasts.push({ ...bonusPayload });
          pendingCasts = pendingCasts || [];
          pendingCasts.push({ caster: { boardName: src.boardName, index: src.index, tile: src.tile }, payload: { ...bonusPayload } });
          addLog && addLog(`  > Bonus cast queued (${bonusPayload._towerBonusCastReason}) for ${src.boardName}[${src.index}] ${baseSpellId}`);
        }
      }
    } catch (e) {}

    // After processing this cast, mark it processed and remove it from the caster's queued list
    try {
      if (cast && cast.payload && typeof cast.payload.queuedId !== 'undefined' && src && src.tile && Array.isArray(src.tile.spellCasts)) {
        // remove the matching queued entry so it won't be re-collected
        src.tile.spellCasts = src.tile.spellCasts.filter(sc => !(sc && sc.queuedId === cast.payload.queuedId));
        processedQueuedIds.add(cast.payload.queuedId);
      }
    } catch (e) {}

    // Immediate death processing after each cast: handle onDeath triggers and mark dead tiles
    const immediateDeathProcessing = async () => {
      const allBoardsLocal = [
        { arr: cP1, name: 'p1Board' },
        { arr: cP2, name: 'p2Board' },
        { arr: cR1, name: 'p1Reserve' },
        { arr: cR2, name: 'p2Reserve' }
      ];

      const deadNow = [];
      allBoardsLocal.forEach(b => {
        (b.arr || []).forEach((t, i) => {
          if (!t || !t.hero) return;
          const hp = (t.currentHealth != null ? t.currentHealth : (t.hero && t.hero.health) || 0);
          if (hp <= 0) {
            // Check for Undying Rage passive before marking as dead
            let shouldDie = true;
            try {
              if (!t._passives && t.hero && t.hero.passives) {
                t._passives = t.hero.passives.map(e => ({ ...e }));
              }
              if (t._passives && Array.isArray(t._passives)) {
                const ur = t._passives.find(p => p && (p.name === 'Undying Rage' || p.name === 'UndyingRage') && !p._used);
                if (ur) {
                  ur._used = true;
                  t.currentHealth = 1;
                  shouldDie = false;
                  addLog && addLog(`  > ${b.name}[${i}] Undying Rage triggered! Survived with 1 HP.`);
                }
                const rg = t._passives.find(p => p && (p.name === 'Regeloop' || p.name === 'RegelOOP' || p.name === 'REGLOOP'));
                if (rg && (rg._uses == null || rg._uses < 3)) {
                  rg._uses = Number(rg._uses || 0) + 1;
                  t.currentHealth = 4;
                  t.effects = (t.effects || []).filter(e => !(e && (e.kind === 'buff' || e.kind === 'debuff')));
                  try { recomputeModifiers(t); } catch (e) {}
                  shouldDie = false;
                  addLog && addLog(`  > ${b.name}[${i}] Regeloop triggered (${rg._uses}/3)! Restored to 4 HP and cleansed buffs/debuffs.`);
                }
              }
            } catch (e) {}
            if (shouldDie && tryPhoenixRebirth(t, b.name, i)) {
              shouldDie = false;
            }
            if (shouldDie) {
              deadNow.push({ boardName: b.name, index: i, tile: t });
            }
          }
        });
      });

      if (deadNow.length === 0) return;

      // process onDeath effects immediately
      const pendingOnDeathVisuals = [];
      const pendingOnDeathApplies = [];
      deadNow.forEach(dead => {
        addLog && addLog(`Processing death of ${dead.boardName}[${dead.index}]`);
        allBoardsLocal.forEach(ownerBoard => {
          (ownerBoard.arr || []).forEach((ownerTile, ownerIdx) => {
            if (!ownerTile) return;
            const passiveList = (ownerTile._passives && Array.isArray(ownerTile._passives))
              ? ownerTile._passives
              : (ownerTile.hero && Array.isArray(ownerTile.hero.passives) ? ownerTile.hero.passives : []);
            const effectList = Array.isArray(ownerTile.effects) ? ownerTile.effects : [];
            const extraPassives = (passiveList || []).filter(p => !(effectList || []).some(e => e && p && e.name === p.name));
            const onDeathEffects = (effectList || []).concat(extraPassives || []);
            (onDeathEffects || []).forEach(effect => {
              if (!effect || !effect.onDeath) return;
              const ownerIsP1 = ownerBoard.name.startsWith('p1');
              const deadIsP1 = dead.boardName.startsWith('p1');
              if (ownerIsP1 !== deadIsP1) return;
              const od = effect.onDeath;
              if (od && od.onlySelf) {
                if (ownerBoard.name !== dead.boardName) return;
                if (ownerIdx !== dead.index) return;
              }
              if (od.type === 'healAlliesExceptSelf') {
                const healVal = Number(od.value || 0);
                const targetArr = ownerIsP1 ? cP1 : cP2;
                (targetArr || []).forEach((allyTile, ai) => {
                  if (!allyTile) return;
                  if (ai === ownerIdx) return;
                  pendingOnDeathApplies.push({ type: 'heal', value: Number(healVal || 0), boardName: ownerBoard.name, index: ai, effectName: effect.name });
                  pendingOnDeathVisuals.push({ type: 'pre', target: { boardName: ownerBoard.name, index: ai }, effectName: effect.name, amount: healVal, ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                  pendingOnDeathVisuals.push({ type: 'pulse', target: { boardName: ownerBoard.name, index: ai }, effectName: effect.name, action: 'heal', amount: healVal, ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                });
              } else if (od.type === 'damageEnemiesWithSpeedAtMost') {
                const targetArr = ownerIsP1 ? cP2 : cP1;
                pendingOnDeathVisuals.push({ type: 'pre', target: { boardName: ownerBoard.name, index: ownerIdx }, effectName: effect.name, amount: Number(od.value || 0), ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                (targetArr || []).forEach((enemyTile, ei) => {
                  if (!enemyTile || enemyTile._dead) return;
                  try { recomputeModifiers(enemyTile); } catch (e) {}
                  const speedVal = Number(enemyTile.currentSpeed != null ? enemyTile.currentSpeed : (enemyTile.hero && enemyTile.hero.speed) || 0);
                  if (speedVal <= Number(od.maxSpeed || 0)) {
                    pendingOnDeathVisuals.push({ type: 'pulse', target: { boardName: ownerIsP1 ? 'p2Board' : 'p1Board', index: ei }, effectName: effect.name, action: 'damage', amount: Number(od.value || 0), ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                    pendingOnDeathApplies.push({ type: 'damage', value: Number(od.value || 0), ignoreArmor: !!od.ignoreArmor, boardName: ownerIsP1 ? 'p2Board' : 'p1Board', index: ei, source: `${dead.boardName}[${dead.index}]`, effectName: effect.name });
                  }
                });
              }
            });
          });
        });
      });

      if (pendingOnDeathVisuals.length > 0 && typeof onStep === 'function') {
        pendingOnDeathVisuals.forEach(v => {
          if (!v) return;
          if (v.type === 'pre') {
            const pre = { type: 'effectPreCast', target: v.target, effectName: v.effectName, amount: v.amount, scale: getEffectPrecastScale(v.amount), ownerBoardName: v.ownerBoardName, ownerIndex: v.ownerIndex };
            try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
          }
          if (v.type === 'pulse') {
            const pulse = { type: 'effectPulse', target: v.target, effectName: v.effectName, action: v.action, amount: v.amount, ownerBoardName: v.ownerBoardName, ownerIndex: v.ownerIndex };
            try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pulse }); } catch (e) {}
          }
        });
        try { await new Promise(res => setTimeout(res, 500)); } catch (e) {}
      }

      pendingOnDeathApplies.forEach(ap => {
        try {
          if (ap.type === 'heal') {
            const arr = (ap.boardName || '').startsWith('p1') ? cP1 : cP2;
            const tile = (arr || [])[ap.index];
            if (!tile) return;
            applyHealthDelta(tile, Number(ap.value || 0));
            addLog && addLog(`  > ${ap.effectName} healed ${ap.value} to ${ap.boardName}[${ap.index}] due to death`);
          } else if (ap.type === 'damage') {
            const arr = (ap.boardName || '').startsWith('p1') ? cP1 : cP2;
            const tile = (arr || [])[ap.index];
            if (!tile) return;
            applyPayloadToTarget(
              { action: 'damage', value: Number(ap.value || 0), ignoreArmor: !!ap.ignoreArmor, source: ap.source },
              { boardName: ap.boardName, index: ap.index, tile },
              addLog,
              { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 },
              null,
              true
            );
            addLog && addLog(`  > ${ap.effectName} damaged ${ap.boardName}[${ap.index}] for ${ap.value} due to death`);
          }
        } catch (e) {}
      });

      // mark dead tiles immediately
      deadNow.forEach(dead => {
        try {
          const { boardName, index, tile } = dead;
          if (!tile) return;
          if (tile.hero && tile.hero.leavesCorpse === false) {
            const removedName = tile.hero && tile.hero.name ? tile.hero.name : 'minion';
            tile.hero = null;
            tile._dead = false;
            tile.effects = [];
            tile.currentHealth = null;
            tile.currentArmor = null;
            tile.currentSpeed = null;
            tile.currentEnergy = null;
            tile.spellCasts = [];
            tile._castsRemaining = null;
            tile._passives = null;
            addLog && addLog(`  > Removed ${removedName} from ${boardName}[${index}] on death`);
            return;
          }
          tile._dead = true;
          tile.effects = [];
          tile.spellCasts = [];
          tile.currentEnergy = 0;
          addLog && addLog(`  > Marked ${boardName}[${index}] as dead and cleared effects`);
        } catch (e) {}
      });

      // After marking deaths, check main boards (reserves excluded) for a game end
      try {
        const winner = evaluateGameWinner(cP1, cP2, cP3);
        if (winner) {
          gameWinner = winner;
          addLog && addLog(`Game end detected: ${winner}`);
        }
      } catch (e) {}
    };
    await immediateDeathProcessing();

    // build a concise lastAction payload for UI to animate (caster, spell, per-target results)
    const lastAction = {
      type: 'cast',
      caster: { boardName: src.boardName, index: src.index },
      spellId: cast.payload && cast.payload.spellId ? cast.payload.spellId : (runtimePayload && runtimePayload.spellId ? runtimePayload.spellId : null),
      results: actionResults.map(r => ({ target: r.target, applied: (r.applied && r.applied.deferred) ? null : r.applied, effectsApplied: r.effectsApplied, phase: r.phase }))
    };
    if (runtimePayload && runtimePayload._copiedSpellId) {
      lastAction.copiedSpellId = runtimePayload._copiedSpellId;
    }
    // Include dice roll info if any result has rollInfo (for spells like Wild Punch)
    try {
      const rollResult = actionResults.find(r => r && r.applied && r.applied.rollInfo);
      if (rollResult && rollResult.applied && rollResult.applied.rollInfo) {
        lastAction.rollInfo = rollResult.applied.rollInfo;
      }
    } catch (e) {}
    // Include animationMs in lastAction so UI can schedule sprite timing consistently
    try { if (runtimePayload && typeof runtimePayload.animationMs === 'number') lastAction.animationMs = Number(runtimePayload.animationMs || 0); } catch (e) {}
    // Include secondary animation metadata if defined on the spell
    try {
      const animationSpellId = (runtimePayload && runtimePayload._copiedSpellId) ? runtimePayload._copiedSpellId : lastAction.spellId;
      const spellDef = getSpellById(animationSpellId) || {};
      if (spellDef.animationSecondary) {
        lastAction.secondaryAnimation = spellDef.animationSecondary;
        lastAction.secondaryAnimationMs = (typeof runtimePayload.animationMs === 'number') ? Number(runtimePayload.animationMs || 0) : 0;
        // Prefer pendingCastChanges (authoritative for secondary pulses) to determine secondary targets.
        const secondaryFromChanges = (pendingCastChanges || [])
          .filter(ch => ch && ch.phase === 'secondary' && ch.boardName && typeof ch.index === 'number')
          .map(ch => ({ boardName: ch.boardName, index: ch.index }));
        const secondaryFromResults = (actionResults || [])
          .filter(r => r && r.phase === 'secondary' && r.target && r.target.boardName && typeof r.target.index === 'number')
          .map(r => ({ boardName: r.target.boardName, index: r.target.index }));
        const allSecondary = [...secondaryFromChanges, ...secondaryFromResults];
        const dedup = new Map();
        allSecondary.forEach(t => {
          const key = `${t.boardName}:${t.index}`;
          if (!dedup.has(key)) dedup.set(key, t);
        });
        lastAction.secondaryTargets = Array.from(dedup.values());
      }
    } catch (e) {}

    // invoke visual update callback after processing this cast, before the delay
    try {
      if (typeof onStep === 'function') {
        onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction });
      }
    } catch (e) {}
    try {
      if (lastAction && lastAction.type === 'cast') {
        const casterSide = (lastAction.caster && String(lastAction.caster.boardName || '').startsWith('p1')) ? 'p1' : (lastAction.caster && String(lastAction.caster.boardName || '').startsWith('p2') ? 'p2' : 'p3');
        lastCastBySide[casterSide] = lastAction;
      }
    } catch (e) {}

    

    // If a game-winning condition was detected during death processing, notify UI and stop resolving further casts
    if (gameWinner) {
      try {
        if (typeof onStep === 'function') {
          try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'gameEnd', winner: gameWinner } }); } catch (e) {}
        }
      } catch (e) {}
      return { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3, priorityPlayer, winner: gameWinner, lastCastActionBySide: lastCastBySide };
    }

    // Emit post-cast wait so client can pause before impact pulses
    try {
      if (typeof onStep === 'function') {
        onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'postCastWait', duration: postCastDelayMs } });
      }
    } catch (e) {}

    // Wait here so the client has time to process the `postCastWait` and set up
    // any pending secondary animation state (e.g., `pendingSecondaryRef`) before
    // we emit effect pulses. This keeps secondary visuals in front of their
    // corresponding damage/heal pulses.
    try {
      if (typeof postCastDelayMs === 'number' && postCastDelayMs > 0) {
        await new Promise(res => setTimeout(res, Number(postCastDelayMs || 0)));
      }
    } catch (e) {}

    // Emit pulses and apply changes (client handles animation timing)
    try {
      if (typeof pendingCastChanges !== 'undefined' && Array.isArray(pendingCastChanges) && pendingCastChanges.length > 0) {
        const getBoardByName = (boardName) => {
          if ((boardName || '').startsWith('p1')) return cP1;
          if ((boardName || '').startsWith('p2')) return cP2;
          if ((boardName || '').startsWith('p3')) return cP3;
          return null;
        };
        const applyVoidShieldToChange = (ch) => {
          if (!ch || ch.voidShieldApplied) return;
          if (String(ch.spellId || '') === 'basicAttack') return;
          if (typeof ch.deltaHealth !== 'number' || Number(ch.deltaHealth) >= 0) return;
          const arr = getBoardByName(ch.boardName);
          const tile = (arr || [])[ch.index];
          if (!tile) return;
          const dmg = Math.abs(Number(ch.amount || ch.deltaHealth || 0));
          const vsResult = applyVoidShieldReduction(tile, dmg);
          if (vsResult.reducedBy > 0) {
            ch.deltaHealth = -vsResult.damage;
            ch.amount = vsResult.damage;
            ch.voidShieldApplied = true;
            addLog && addLog(`  > Void Shield reduced deferred damage by ${vsResult.reducedBy} on ${ch.boardName}[${ch.index}]`);
          }
        };
        // Emit one `effectPulse` per change
        pendingCastChanges.forEach(ch => {
          try {
            applyVoidShieldToChange(ch);
            const aBoardName = ch.boardName;
            const idx = ch.index;
            let action = null;
            let amount = 0;
            if (typeof ch.deltaHealth === 'number' && Number(ch.deltaHealth) !== 0) {
              action = Number(ch.deltaHealth) < 0 ? 'damage' : 'heal';
              amount = Math.abs(Number(ch.amount || ch.deltaHealth || 0));
            } else if (typeof ch.deltaEnergy === 'number' && Number(ch.deltaEnergy) !== 0) {
              action = 'energy';
              amount = Number(ch.deltaEnergy || 0);
            }
            if (action && typeof onStep === 'function') {
              const lastAction = { type: 'effectPulse', target: { boardName: aBoardName, index: idx }, effectName: 'Spell', action, amount, phase: ch && ch.phase ? ch.phase : 'primary' };
              onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction });
            }
            // If there's ALSO a deltaEnergy (e.g., from Frenzy passive triggering on damage), emit a separate energyIncrement step
            if (typeof ch.deltaHealth === 'number' && Number(ch.deltaHealth) < 0 && typeof ch.deltaEnergy === 'number' && Number(ch.deltaEnergy) > 0 && typeof onStep === 'function') {
              const energyAction = { type: 'energyIncrement', target: { boardName: aBoardName, index: idx }, amount: Number(ch.deltaEnergy), effectName: 'Frenzy' };
              onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: energyAction });
            }
          } catch (e) {}
        });

        // Apply the pending stat changes
        pendingCastChanges.forEach(ch => {
          try {
            const arr = getBoardByName(ch.boardName);
            const tile = (arr || [])[ch.index];
            if (!tile) return;
            if (ch && ch._skipApply) return;
            if (typeof ch.deltaHealth === 'number') {
              if (Number(ch.deltaHealth) < 0) {
                recentDamageEvents.push({ boardName: ch.boardName, index: ch.index, amount: Math.abs(Number(ch.deltaHealth || 0)), source: ch.source });
              }
              applyHealthDelta(tile, Number(ch.deltaHealth || 0));
              addLog && addLog(`  > Applied deferred health change ${ch.deltaHealth} to ${ch.boardName}[${ch.index}]`);
            }
              if (typeof ch.deltaEnergy === 'number') {
                tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + Number(ch.deltaEnergy || 0);
                clampEnergy(tile);
                addLog && addLog(`  > Applied deferred energy change ${ch.deltaEnergy} to ${ch.deltaEnergy} to ${ch.boardName}[${ch.index}]`);
              }
          } catch (e) {}
        });

        applyReapExecutions({ contextTag: 'postCast' });
      }

      // Apply any pending effect removals after pulses/changes
      if (Array.isArray(pendingEffectRemovals) && pendingEffectRemovals.length > 0) {
        pendingEffectRemovals.forEach(rem => {
          try {
            if (!rem || !rem.target || !rem.target.tile) return;
            const tile = rem.target.tile;
            tile.effects = Array.isArray(tile.effects) ? tile.effects : [];
            if (rem.type === 'removeDebuffs') {
              tile.effects = tile.effects.filter(e => !(e && e.kind === 'debuff'));
            } else if (rem.type === 'removeTopDebuff') {
              const idx = (() => {
                for (let i = tile.effects.length - 1; i >= 0; i--) {
                  const ef = tile.effects[i];
                  if (ef && ef.kind === 'debuff' && (!rem.effectName || ef.name === rem.effectName)) return i;
                }
                return -1;
              })();
              if (idx !== -1) tile.effects.splice(idx, 1);
            } else if (rem.type === 'removeTopEffectByName') {
              const idx = (() => {
                for (let i = tile.effects.length - 1; i >= 0; i--) {
                  const ef = tile.effects[i];
                  if (ef && (!rem.effectName || ef.name === rem.effectName)) return i;
                }
                return -1;
              })();
              if (idx !== -1) tile.effects.splice(idx, 1);
            } else if (rem.type === 'removeTopPositiveEffect') {
              const idx = (() => {
                for (let i = tile.effects.length - 1; i >= 0; i--) {
                  const ef = tile.effects[i];
                  if (ef && ef.kind === 'buff' && (!rem.effectName || ef.name === rem.effectName)) return i;
                }
                return -1;
              })();
              if (idx !== -1) tile.effects.splice(idx, 1);
            }
          } catch (e) {}
        });
      }

      // Apply any pending effects after removals
      if (Array.isArray(pendingEffects) && pendingEffects.length > 0) {
        pendingEffects.forEach(pe => {
          try {
            if (!pe || !pe.target || !pe.target.tile) return;
            applyEffectsToTile(pe.target.tile, pe.effects || [], addLog, pe.applier || pe.target);
            try {
              const names = (pe.effects || []).map(e => e && e.name).filter(Boolean);
              names.forEach(name => {
                if (typeof onStep === 'function') {
                  const lastAction = { type: 'effectApplied', target: { boardName: pe.target.boardName, index: pe.target.index }, effectName: name };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
                }
              });
            } catch (e) {}
          } catch (e) {}
        });
      }

      // Recompute modifiers for all affected tiles
      if ((Array.isArray(pendingEffectRemovals) && pendingEffectRemovals.length > 0) || (Array.isArray(pendingEffects) && pendingEffects.length > 0)) {
        const touched = new Set();
        (pendingEffectRemovals || []).forEach(r => { try { if (r && r.target) touched.add(`${r.target.boardName}:${r.target.index}`); } catch (e) {} });
        (pendingEffects || []).forEach(e => { try { if (e && e.target) touched.add(`${e.target.boardName}:${e.target.index}`); } catch (e) {} });
        const getBoardByName = (boardName) => {
          if ((boardName || '').startsWith('p1')) return cP1;
          if ((boardName || '').startsWith('p2')) return cP2;
          if ((boardName || '').startsWith('p3')) return cP3;
          return null;
        };
        touched.forEach(key => {
          try {
            const [bn, idxStr] = String(key).split(':');
            const idx = Number(idxStr);
            const arr = getBoardByName(bn);
            const tile = (arr || [])[idx];
            if (tile) recomputeModifiers(tile);
          } catch (e) {}
        });
      }

      // Emit gameState update even for effect-only casts
      if (typeof onStep === 'function') {
        onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'castApplied' } });
      }
    } catch (e) {}

    // Process any reaction effects (collected from damage resolution) AFTER the cast animation
    try {
      const reactions = [];
      actionResults.forEach(r => {
        if (r && r.applied && Array.isArray(r.applied.reactions)) {
          r.applied.reactions.forEach(rx => reactions.push({ ...rx, ownerTarget: r.target }));
        }
      });
      if (reactions.length > 0) {
        // Deduplicate identical reactions within this cast
        const dedupedReactions = [];
        const seenReactionKeys = new Set();
        reactions.forEach(rx => {
          if (!rx) return;
          const key = `${rx.type || ''}:${rx.effectName || ''}:${rx.effectIndex ?? ''}:${rx.attackerBoard || ''}:${rx.attackerIndex || ''}:${rx.ownerBoardName || ''}:${rx.ownerIndex || ''}:${rx.value || ''}`;
          if (seenReactionKeys.has(key)) return;
          seenReactionKeys.add(key);
          dedupedReactions.push(rx);
        });

        // Emit precast + pulses for reactions (client handles timing)
        dedupedReactions.forEach((rx, rxIdx) => {
          if (rx.type === 'healAlliesExceptSelf') {
            const ownerSide = (rx.ownerBoardName || '').startsWith('p1')
              ? 'p1'
              : ((rx.ownerBoardName || '').startsWith('p2') ? 'p2' : 'p3');
            const ownerArr = ownerSide === 'p1' ? cP1 : (ownerSide === 'p2' ? cP2 : cP3);
            (ownerArr || []).forEach((allyTile, ai) => {
              if (!allyTile) return;
              if (ai === rx.ownerIndex) return;
              try {
                if (typeof onStep === 'function') {
                  const pre = { type: 'effectPreCast', target: { boardName: ownerSide === 'p1' ? 'p1Board' : (ownerSide === 'p2' ? 'p2Board' : 'p3Board'), index: ai }, effectName: rx.effectName, amount: rx.value, scale: getEffectPrecastScale(rx.value), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
                  const lastAction = { type: 'effectPulse', target: { boardName: ownerSide === 'p1' ? 'p1Board' : (ownerSide === 'p2' ? 'p2Board' : 'p3Board'), index: ai }, effectName: rx.effectName, action: 'heal', amount: rx.value, reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
                }
              } catch (e) {}
            });
          }
          if (rx.type === 'damageAttacker') {
            try {
              const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : (rx.attackerBoard === 'p2Board' ? cP2 : cP3);
              const atk = (aBoard || [])[rx.attackerIndex];
              if (atk) {
                if (typeof onStep === 'function') {
                  const vsResult = applyVoidShieldReduction(atk, Number(rx.value || 0));
                  const ownerTarget = (rx.ownerBoardName && typeof rx.ownerIndex === 'number')
                    ? { boardName: rx.ownerBoardName, index: rx.ownerIndex }
                    : { boardName: rx.attackerBoard, index: rx.attackerIndex };
                  const pre = { type: 'effectPreCast', target: ownerTarget, effectName: rx.effectName, amount: vsResult.damage, scale: getEffectPrecastScale(vsResult.damage), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
                  const lastAction = { type: 'effectPulse', target: { boardName: rx.attackerBoard, index: rx.attackerIndex }, effectName: rx.effectName, action: 'damage', amount: vsResult.damage };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction }); } catch (e) {}
                }
              }
            } catch (e) {}
          }
          if (rx.type === 'applyEffectToAttacker') {
            try {
              const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : (rx.attackerBoard === 'p2Board' ? cP2 : cP3);
              const atk = (aBoard || [])[rx.attackerIndex];
              if (atk && typeof onStep === 'function') {
                const ownerTarget = (rx.ownerBoardName && typeof rx.ownerIndex === 'number')
                  ? { boardName: rx.ownerBoardName, index: rx.ownerIndex }
                  : { boardName: rx.attackerBoard, index: rx.attackerIndex };
                const pre = { type: 'effectPreCast', target: ownerTarget, effectName: rx.effectName, amount: 0, scale: getEffectPrecastScale(1), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
                const appliedAction = { type: 'effectApplied', target: { boardName: rx.attackerBoard, index: rx.attackerIndex }, effectName: rx.effectName };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: appliedAction }); } catch (e) {}
              }
            } catch (e) {}
          }
        });

        // Then apply reactions' effects to the board state and emit update steps
        dedupedReactions.forEach(rx => {
          if (rx.type === 'healAlliesExceptSelf') {
            const ownerSide = (rx.ownerBoardName || '').startsWith('p1')
              ? 'p1'
              : ((rx.ownerBoardName || '').startsWith('p2') ? 'p2' : 'p3');
            const ownerArr = ownerSide === 'p1' ? cP1 : (ownerSide === 'p2' ? cP2 : cP3);
            (ownerArr || []).forEach((allyTile, ai) => {
              if (!allyTile) return;
              if (ai === rx.ownerIndex) return;
              applyHealthDelta(allyTile, Number(rx.value || 0));
              addLog && addLog(`  > ${rx.effectName} applied heal ${rx.value} to ${(ownerSide === 'p1' ? 'p1Board' : (ownerSide === 'p2' ? 'p2Board' : 'p3Board'))}[${ai}]`);
            });
          }
          if (rx.type === 'damageAttacker') {
            const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : (rx.attackerBoard === 'p2Board' ? cP2 : cP3);
            const atk = (aBoard || [])[rx.attackerIndex];
            if (atk) {
              const dmg = Number(rx.value || 0);
              const vsResult = applyVoidShieldReduction(atk, dmg);
              applyHealthDelta(atk, -vsResult.damage);
              addLog && addLog(`  > ${rx.effectName} applied ${vsResult.damage} damage to ${rx.attackerBoard}[${rx.attackerIndex}]`);
              try {
                if (vsResult.damage > 0) {
                  if (!atk._passives && atk.hero && Array.isArray(atk.hero.passives)) {
                    atk._passives = atk.hero.passives.map(e => ({ ...e }));
                  }
                  const frenzy = (atk._passives || []).find(e => e && e.name === 'Frenzy');
                  if (frenzy) {
                    if (typeof onStep === 'function') {
                      onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'energyIncrement', target: { boardName: rx.attackerBoard, index: rx.attackerIndex }, amount: 1, effectName: 'Frenzy' } });
                    }
                    atk.currentEnergy = (typeof atk.currentEnergy === 'number' ? atk.currentEnergy : (atk.hero && atk.hero.energy) || 0) + 1;
                    clampEnergy(atk);
                    addLog && addLog(`  > ${rx.attackerBoard}[${rx.attackerIndex}] gained 1 Energy from Frenzy (now ${atk.currentEnergy})`);
                  }
                }
              } catch (e) {}
            }
          }
          if (rx.type === 'applyEffectToAttacker') {
            const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : (rx.attackerBoard === 'p2Board' ? cP2 : cP3);
            const atk = (aBoard || [])[rx.attackerIndex];
            const eff = rx.effectName ? (EFFECTS[rx.effectName] || null) : null;
            if (atk && eff) {
              applyEffectsToTile(atk, [eff], addLog, { boardName: rx.ownerBoardName, index: rx.ownerIndex, tile: atk });
              addLog && addLog(`  > ${rx.effectName} applied to ${rx.attackerBoard}[${rx.attackerIndex}]`);
            }
          }
        });
        try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'reactionsApplied' } }); } catch (e) {}
      }
    } catch (e) {}

    try { applyReapExecutions(); } catch (e) {}

    // Process deaths that resulted from this cast and its reactions (deferred damage)
    try {
      const recent = typeof recentDamageEvents !== 'undefined' ? recentDamageEvents : [];
      const allBoardsLocal = [
        { arr: cP1, name: 'p1Board' },
        { arr: cP2, name: 'p2Board' },
        { arr: cP3, name: 'p3Board' },
        { arr: cR1, name: 'p1Reserve' },
        { arr: cR2, name: 'p2Reserve' },
        { arr: cR3, name: 'p3Reserve' }
      ];
      const deadNow = [];
      allBoardsLocal.forEach(b => {
        (b.arr || []).forEach((t, i) => {
          if (!t || !t.hero) return;
          const hp = (t.currentHealth != null ? t.currentHealth : (t.hero && t.hero.health) || 0);
          if (hp <= 0 && !t._dead) {
            // Check for Undying Rage passive before marking as dead
            let shouldDie = true;
            try {
              if (!t._passives && t.hero && t.hero.passives) {
                t._passives = t.hero.passives.map(e => ({ ...e }));
              }
              if (t._passives && Array.isArray(t._passives)) {
                const ur = t._passives.find(p => p && (p.name === 'Undying Rage' || p.name === 'UndyingRage') && !p._used);
                if (ur) {
                  ur._used = true;
                  t.currentHealth = 1;
                  shouldDie = false;
                  addLog && addLog(`  > ${b.name}[${i}] Undying Rage triggered! Survived with 1 HP.`);
                }
                const rg = t._passives.find(p => p && (p.name === 'Regeloop' || p.name === 'RegelOOP' || p.name === 'REGLOOP'));
                if (rg && (rg._uses == null || rg._uses < 3)) {
                  rg._uses = Number(rg._uses || 0) + 1;
                  t.currentHealth = 4;
                  t.effects = (t.effects || []).filter(e => !(e && (e.kind === 'buff' || e.kind === 'debuff')));
                  try { recomputeModifiers(t); } catch (e) {}
                  shouldDie = false;
                  addLog && addLog(`  > ${b.name}[${i}] Regeloop triggered (${rg._uses}/3)! Restored to 4 HP and cleansed buffs/debuffs.`);
                }
              }
            } catch (e) {}
            if (shouldDie && tryPhoenixRebirth(t, b.name, i)) {
              shouldDie = false;
            }
            if (shouldDie) {
              deadNow.push({ boardName: b.name, index: i, tile: t });
            }
          }
        });
      });

      if (deadNow.length > 0) {
        // process onDeath effects immediately (similar to earlier immediateDeathProcessing)
        const pendingOnDeathVisuals = [];
        const pendingOnDeathApplies = [];
        const sideFromBoard = (boardName) => {
          if ((boardName || '').startsWith('p1')) return 'p1';
          if ((boardName || '').startsWith('p2')) return 'p2';
          return 'p3';
        };
        const boardForSide = (side) => (side === 'p1' ? cP1 : (side === 'p2' ? cP2 : cP3));
        deadNow.forEach(dead => {
          addLog && addLog(`Processing death of ${dead.boardName}[${dead.index}] (post-cast)`);
          allBoardsLocal.forEach(ownerBoard => {
            (ownerBoard.arr || []).forEach((ownerTile, ownerIdx) => {
              if (!ownerTile) return;
              const passiveList = (ownerTile._passives && Array.isArray(ownerTile._passives))
                ? ownerTile._passives
                : (ownerTile.hero && Array.isArray(ownerTile.hero.passives) ? ownerTile.hero.passives : []);
              const effectList = Array.isArray(ownerTile.effects) ? ownerTile.effects : [];
              const extraPassives = (passiveList || []).filter(p => !(effectList || []).some(e => e && p && e.name === p.name));
              const onDeathEffects = (effectList || []).concat(extraPassives || []);
              (onDeathEffects || []).forEach(effect => {
                if (!effect || !effect.onDeath) return;
                const ownerSide = sideFromBoard(ownerBoard.name);
                const deadSide = sideFromBoard(dead.boardName);
                if (ownerSide !== deadSide) return;
                const od = effect.onDeath;
                if (od && od.onlySelf) {
                  if (ownerBoard.name !== dead.boardName) return;
                  if (ownerIdx !== dead.index) return;
                }
                if (od.type === 'healAlliesExceptSelf') {
                  const healVal = Number(od.value || 0);
                  const targetArr = boardForSide(ownerSide);
                  (targetArr || []).forEach((allyTile, ai) => {
                    if (!allyTile) return;
                    if (ai === ownerIdx) return;
                    pendingOnDeathApplies.push({ type: 'heal', value: Number(healVal || 0), boardName: ownerBoard.name, index: ai, effectName: effect.name });
                    pendingOnDeathVisuals.push({ type: 'pre', target: { boardName: ownerBoard.name, index: ai }, effectName: effect.name, amount: healVal, ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                    pendingOnDeathVisuals.push({ type: 'pulse', target: { boardName: ownerBoard.name, index: ai }, effectName: effect.name, action: 'heal', amount: healVal, ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                  });
                } else if (od.type === 'damageEnemiesWithSpeedAtMost') {
                  const enemySides = isFfa3
                    ? getAliveSidesMain(cP1, cP2, cP3).filter(s => s !== ownerSide)
                    : [ownerSide === 'p1' ? 'p2' : 'p1'];
                  pendingOnDeathVisuals.push({ type: 'pre', target: { boardName: ownerBoard.name, index: ownerIdx }, effectName: effect.name, amount: Number(od.value || 0), ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                  enemySides.forEach((side) => {
                    const targetArr = boardForSide(side);
                    const targetBoardName = side === 'p1' ? 'p1Board' : (side === 'p2' ? 'p2Board' : 'p3Board');
                    (targetArr || []).forEach((enemyTile, ei) => {
                      if (!enemyTile || enemyTile._dead) return;
                      try { recomputeModifiers(enemyTile); } catch (e) {}
                      const speedVal = Number(enemyTile.currentSpeed != null ? enemyTile.currentSpeed : (enemyTile.hero && enemyTile.hero.speed) || 0);
                      if (speedVal <= Number(od.maxSpeed || 0)) {
                        pendingOnDeathVisuals.push({ type: 'pulse', target: { boardName: targetBoardName, index: ei }, effectName: effect.name, action: 'damage', amount: Number(od.value || 0), ownerBoardName: ownerBoard.name, ownerIndex: ownerIdx });
                        pendingOnDeathApplies.push({ type: 'damage', value: Number(od.value || 0), ignoreArmor: !!od.ignoreArmor, boardName: targetBoardName, index: ei, source: `${dead.boardName}[${dead.index}]`, effectName: effect.name });
                      }
                    });
                  });
                }
              });
            });
          });
        });

        if (pendingOnDeathVisuals.length > 0 && typeof onStep === 'function') {
          pendingOnDeathVisuals.forEach(v => {
            if (!v) return;
            if (v.type === 'pre') {
              const pre = { type: 'effectPreCast', target: v.target, effectName: v.effectName, amount: v.amount, scale: getEffectPrecastScale(v.amount), ownerBoardName: v.ownerBoardName, ownerIndex: v.ownerIndex };
              try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pre }); } catch (e) {}
            }
            if (v.type === 'pulse') {
              const pulse = { type: 'effectPulse', target: v.target, effectName: v.effectName, action: v.action, amount: v.amount, ownerBoardName: v.ownerBoardName, ownerIndex: v.ownerIndex };
              try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: pulse }); } catch (e) {}
            }
          });
          try { await new Promise(res => setTimeout(res, 500)); } catch (e) {}
        }

        pendingOnDeathApplies.forEach(ap => {
          try {
            if (ap.type === 'heal') {
              const arr = (ap.boardName || '').startsWith('p1') ? cP1 : ((ap.boardName || '').startsWith('p2') ? cP2 : cP3);
              const tile = (arr || [])[ap.index];
              if (!tile) return;
              applyHealthDelta(tile, Number(ap.value || 0));
              addLog && addLog(`  > ${ap.effectName} healed ${ap.value} to ${ap.boardName}[${ap.index}] due to death`);
            } else if (ap.type === 'damage') {
              const arr = (ap.boardName || '').startsWith('p1') ? cP1 : ((ap.boardName || '').startsWith('p2') ? cP2 : cP3);
              const tile = (arr || [])[ap.index];
              if (!tile) return;
              applyPayloadToTarget(
                { action: 'damage', value: Number(ap.value || 0), ignoreArmor: !!ap.ignoreArmor, source: ap.source },
                { boardName: ap.boardName, index: ap.index, tile },
                addLog,
                { p1Board: cP1, p2Board: cP2, p3Board: cP3, p1Reserve: cR1, p2Reserve: cR2, p3Reserve: cR3 },
                null,
                true
              );
              addLog && addLog(`  > ${ap.effectName} damaged ${ap.boardName}[${ap.index}] for ${ap.value} due to death`);
            }
          } catch (e) {}
        });

        // Emit pre-death state so reaction emotes render before removal
        try {
          if (deadNow.length > 0 && typeof onStep === 'function') {
            onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'preDeath' } });
          }
        } catch (e) {}

        // Mark dead tiles and clear their state
        deadNow.forEach(dead => {
          try {
            const { boardName, index, tile } = dead;
            if (!tile) return;
            tile._dead = true;
            tile.effects = [];
            tile.spellCasts = [];
            tile.currentEnergy = 0;
            addLog && addLog(`  > Marked ${boardName}[${index}] as dead and cleared effects (post-cast)`);
            // If we can attribute the kill, check for Bounty passive on the killer
            try {
              // find the most recent damage event for this tile
              const ev = recent.slice().reverse().find(r => r && r.boardName === boardName && Number(r.index) === Number(index) && r.source);
              if (ev && typeof ev.source === 'string') {
                const m = ev.source.match(/^(p[123]Board)\[(\d+)\]$/);
                if (m) {
                  const srcBoardName = m[1];
                  const srcIndex = Number(m[2]);
                  const srcArr = srcBoardName === 'p1Board' ? cP1 : (srcBoardName === 'p2Board' ? cP2 : cP3);
                  const srcTile = (srcArr || [])[srcIndex];
                  if (srcTile && !srcTile._dead) { // dead heroes cannot trigger passives
                    // Check both _passives (runtime) and hero.passives (fallback) for Bounty passive
                    const hasBounty = (srcTile._passives && Array.isArray(srcTile._passives) && srcTile._passives.some(pp => pp && pp.name === 'Bounty'))
                      || (srcTile.hero && srcTile.hero.passives && Array.isArray(srcTile.hero.passives) && srcTile.hero.passives.some(pp => pp && pp.name === 'Bounty'));
                    if (hasBounty) {
                      // apply Bounty: heal 2 and apply Strength effect
                      applyHealthDelta(srcTile, 2);
                      addLog && addLog(`  > Bounty passive: healed ${srcBoardName}[${srcIndex}] for 2 HP`);
                      try { applyEffectsToTile(srcTile, [EFFECTS.Strength], addLog, { boardName: srcBoardName, index: srcIndex, tile: srcTile }); } catch (e) {}
                      try { recomputeModifiers(srcTile); } catch (e) {}
                      // emit UI pulses for the bounty heal and effect application
                      try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'effectPulse', target: { boardName: srcBoardName, index: srcIndex }, effectName: 'Bounty', action: 'heal', amount: 2 } }); } catch (e) {}
                      try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'effectApplied', target: { boardName: srcBoardName, index: srcIndex }, effectName: 'Strength' } }); } catch (e) {}
                      try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'bountyActivated', source: { boardName: srcBoardName, index: srcIndex }, victim: { boardName: boardName, index: index }, heal: 2, appliedEffect: 'Strength' } }); } catch (e) {}
                    }

                    // Predator's Pace: on kill, gain +2 Speed next round
                    try {
                      if (srcTile.hero && srcTile.hero._towerPredatorPace) {
                        srcTile._towerPredatorPacePending = true;
                        addLog && addLog(`  > Predator's Pace: queued +2 Speed next round for ${srcBoardName}[${srcIndex}]`);
                      }
                    } catch (e) {}

                    // Handle on-kill effects from active buffs (e.g., Give A Quest)
                    try {
                      const killEffects = (srcTile.effects && Array.isArray(srcTile.effects)) ? srcTile.effects.filter(eff => eff && eff.onKill) : [];
                      for (const eff of killEffects) {
                        const cfg = eff.onKill || {};
                        const healAmt = Number(cfg.heal || 0);
                        if (healAmt) {
                          applyHealthDelta(srcTile, healAmt);
                          addLog && addLog(`  > ${eff.name} onKill: healed ${srcBoardName}[${srcIndex}] for ${healAmt} HP`);
                          try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'effectPulse', target: { boardName: srcBoardName, index: srcIndex }, effectName: eff.name, action: 'heal', amount: healAmt } }); } catch (e) {}
                        }
                        if (cfg.applyEffect) {
                          const applyKey = cfg.applyEffect;
                          const effectToApply = (typeof applyKey === 'string')
                            ? (EFFECTS[applyKey] || Object.values(EFFECTS).find(e2 => e2 && e2.name === applyKey))
                            : applyKey;
                          if (effectToApply) {
                            try { applyEffectsToTile(srcTile, [effectToApply], addLog, { boardName: srcBoardName, index: srcIndex, tile: srcTile }); } catch (e) {}
                            try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'effectApplied', target: { boardName: srcBoardName, index: srcIndex }, effectName: effectToApply.name } }); } catch (e) {}
                          }
                        }
                        if (cfg.consume && srcTile.effects && Array.isArray(srcTile.effects)) {
                          const idxToRemove = (() => {
                            for (let i = srcTile.effects.length - 1; i >= 0; i--) {
                              if (srcTile.effects[i] && srcTile.effects[i].name === eff.name) return i;
                            }
                            return -1;
                          })();
                          if (idxToRemove !== -1) {
                            const removed = srcTile.effects.splice(idxToRemove, 1)[0];
                            addLog && addLog(`  > ${removed && removed.name} onKill consumed on ${srcBoardName}[${srcIndex}]`);
                          }
                        }
                      }
                    } catch (e) {}
                  }
                }
              }
            } catch (e) {}
          } catch (e) {}
        });

        try {
          if (deadNow.length > 0 && typeof onStep === 'function') {
            onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p3Board: cloneArr(cP3), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), p3Reserve: cloneArr(cR3), priorityPlayer, lastAction: { type: 'deathApplied' } });
          }
        } catch (e) {}

        // After marking deaths, check main boards (reserves excluded) for a game end
        try {
          const winner = evaluateGameWinner(cP1, cP2, cP3);
          if (winner) {
            gameWinner = winner;
            addLog && addLog(`Game end detected: ${winner}`);
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Post-cast pause and re-collect after each cast, not after all casts
    try {
      // Notify UI that engine is pausing between casts (duration in ms)
      try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'postCastWait', duration: postCastDelayMs } }); } catch (e) {}
      await new Promise(res => setTimeout(res, postCastDelayMs));
      autoCastFromBoard(cP1, 'p1Board');
      autoCastFromBoard(cP2, 'p2Board');
      // Rebuild pendingCasts from current tile.spellCasts, excluding any already processed
      pendingCasts = collectSpellCasts(cP1, cP2, cP3, cR1, cR2, cR3).filter(pc => !(pc.payload && typeof pc.payload.queuedId !== 'undefined' && processedQueuedIds.has(pc.payload.queuedId)));
      if (pendingCasts.length > 0) addLog && addLog(`Found ${pendingCasts.length} pending cast(s) after re-collect`);
    } catch (e) {}
  }

  // (Death processing handled immediately after each cast now.)

  // Tick down effect durations and remove expired only on main boards; reserves remain inert
  [cP1, cP2, cP3].forEach(arr => {
    (arr || []).forEach((t, i) => {
      if (!t || !t.hero || !t.effects) return;
      t.effects = (t.effects || []).filter(e => {
        if (!e) return false;
        if (typeof e.duration === 'number' && e.duration > 0) {
          e.duration -= 1;
        }
        return !(typeof e.duration === 'number' && e.duration <= 0);
      });
      // After removing expired effects, recompute modifiers so stats update
      try { recomputeModifiers(t); } catch (e) {}
    });
  });

  // End-of-round hooks (placeholder)
  addLog && addLog('end of round');
  // Priority will be switched by server after movement phase completes (see server.js)

  // Final winner check (in case no early detection occurred during casts)
  try {
    if (!gameWinner) {
      gameWinner = evaluateGameWinner(cP1, cP2, cP3);
    }
  } catch (e) {}

  // Notify UI that the round is complete
  try {
    if (typeof onStep === 'function') {
      onStep({
        p1Board: cloneArr(cP1),
        p2Board: cloneArr(cP2),
        p1Reserve: cloneArr(cR1),
        p2Reserve: cloneArr(cR2),
        priorityPlayer,
        lastAction: { type: 'roundComplete', winner: gameWinner || null }
      });
    }
  } catch (e) {}

  return {
    p1Board: cP1,
    p2Board: cP2,
    p1Reserve: cR1,
    p2Reserve: cR2,
    priorityPlayer,
    winner: gameWinner,
    lastCastActionBySide: lastCastBySide
  };
}

export default {
  executeRound
};
