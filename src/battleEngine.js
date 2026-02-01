// Expanded minimal battle engine
// - Increments energy each round
// - Collects simple spell casts from tiles (`tile.spellCasts`)
// - Orders casts by speed (and optional priority tie-break)
// - Resolves simple payloads: damage/heal to target descriptors
// The engine is intentionally simple but provides clear extension points.

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

import { resolveTargets, indexToRow, indexToColumn, columnIndicesForBoard } from './targeting.js';
import { buildPayloadFromSpec, applyEffectsToTile } from './spell.js';
import { getSpellById, SPELLS } from './spells.js';
import { EFFECTS } from './effects.js';
import { incEnergy, findTileInBoards, recomputeModifiers, applyPayloadToTarget } from '../shared/gameLogic.js';

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
  return Math.min(15, health == null ? 0 : Number(health));
}
function ensureTileHealthInitialized(tile) {
  if (!tile) return;
  if (typeof tile.currentHealth === 'undefined' || tile.currentHealth === null) {
    const base = (tile.hero && typeof tile.hero.health === 'number') ? Number(tile.hero.health) : 0;
    tile.currentHealth = capHealthForTile(tile, base);
  }
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

function collectSpellCasts(p1Board, p2Board, p1Reserve, p2Reserve) {
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
  // Do not collect casts from reserves — reserve heroes should not cast.
  return out;
}

function getCastOrder(casts = [], p1Board = [], p2Board = [], priorityPlayer = 'player1', addLog) {
  // Group by energy value, highest first. Within each energy group use Book Reading Rule
  // (left-to-right on the caster's board -> lower index wins). If tie remains between players
  // at the same book index, use priorityPlayer to break and flip the arrow when used.
  const byEnergy = {};
  casts.forEach(c => {
    // Prefer queuedEnergy snapshot from payload; fall back to tile currentEnergy or hero base energy
    const energy = (c && c.payload && typeof c.payload.queuedEnergy === 'number') ? c.payload.queuedEnergy : ((c.caster && c.caster.tile && (c.caster.tile.currentEnergy != null ? c.caster.tile.currentEnergy : (c.caster.tile.hero && c.caster.tile.hero.energy) || 0)) || 0);
    byEnergy[energy] = byEnergy[energy] || [];
    byEnergy[energy].push(c);
  });

  const energies = Object.keys(byEnergy).map(Number).sort((a, b) => b - a);
  const ordered = [];

  // Book-order positions based on the visual tile numbering used by the UI (tile numbers 1..9):
  // For Player 1, tile numbers 1..9 map to indices: [2,5,8,1,4,7,0,3,6]
  // For Player 2, tile numbers 1..9 map to indices: [6,3,0,7,4,1,8,5,2]
  const bookOrderP1 = [2,5,8,1,4,7,0,3,6];
  const bookOrderP2 = [6,3,0,7,4,1,8,5,2];
  const getBookIndex = (caster) => {
    if (!caster || typeof caster.index !== 'number' || !caster.boardName) return 9999;
    const arr = caster.boardName.startsWith('p1') ? bookOrderP1 : bookOrderP2;
    const pos = arr.indexOf(caster.index);
    return pos === -1 ? 9999 : pos;
  };

  energies.forEach(en => {
    const group = byEnergy[en].slice();
    // resolve group ordering by repeated selection using book-index then priority
    while (group.length > 0) {
      let minIdx = Infinity;
      group.forEach(g => { const bi = getBookIndex(g.caster); if (bi < minIdx) minIdx = bi; });
      const candidates = group.filter(g => getBookIndex(g.caster) === minIdx);
      let pick = null;
      if (candidates.length === 1) {
        pick = candidates[0];
      } else {
        // If all candidates belong to the same caster (multiple queued casts), don't treat as a cross-caster tie
        const casterKeys = new Set(candidates.map(c => `${(c.caster.boardName||'')}:${String(c.caster.index)}`));
        if (casterKeys.size === 1) {
          pick = candidates[0];
        } else {
          const prefIsP1 = priorityPlayer === 'player1';
          // debug info for tie resolution
          try {
            const infos = candidates.map(c => ({ board: c.caster.boardName, index: c.caster.index, bookIndex: getBookIndex(c.caster), energy: c.payload?.queuedEnergy }));
            addLog && addLog(`  > TIE DETECTED! Energy: ${en}, Candidates: ${JSON.stringify(infos)}, priorityPlayer: ${priorityPlayer}`);
          } catch (e) {}
          const prefCandidate = candidates.find(c => (c.caster.boardName || '').startsWith(prefIsP1 ? 'p1' : 'p2'));
          if (prefCandidate) {
            pick = prefCandidate;
            priorityPlayer = prefIsP1 ? 'player2' : 'player1';
            addLog && addLog(`  > Priority used. New priority: ${priorityPlayer}`);
          } else {
            pick = candidates[0];
          }
        }
      }
      ordered.push(pick);
      const idx = group.indexOf(pick);
      if (idx !== -1) group.splice(idx, 1);
    }
  });

  return { ordered, priorityPlayer };
}

export async function executeRound({ p1Board = [], p2Board = [], p1Reserve = [], p2Reserve = [], addLog, priorityPlayer = 'player1', roundNumber = 1 }, { castDelayMs = 700, onStep, postEffectDelayMs = 0, reactionDelayMs = 1000, postCastDelayMs = 500, quiet = false } = {}) {
  const cP1 = cloneArr(p1Board);
  const cP2 = cloneArr(p2Board);
  const cR1 = cloneArr(p1Reserve);
  const cR2 = cloneArr(p2Reserve);
  let gameWinner = null;
  // Track the last cast action so special spells (e.g., Copy Cat) can reference it
  let lastCastAction = null;

  // Initialize runtime fields on each occupied tile so damage/heal math uses proper starting HP/armor/speed
  // NOTE: This function must be defined BEFORE the forEach loops that call it (temporal dead zone).
  const initTileRuntime = (tile) => {
    if (!tile || !tile.hero) return tile;
    // initialize baseline runtime fields if missing
    // ensure hidden passives are initialized from hero.passives (do not copy into visible effects)
    if (!tile._passives) tile._passives = (tile.hero && tile.hero.passives) ? (tile.hero.passives.map(e => ({ ...e }))) : [];
    ensureTileHealthInitialized(tile);
    if (tile.currentArmor == null) tile.currentArmor = (tile.hero && tile.hero.armor) || 0;
    if (tile.currentSpeed == null) tile.currentSpeed = (tile.hero && tile.hero.speed) || 0;
    if (tile.currentEnergy == null) tile.currentEnergy = (tile.hero && tile.hero.energy) || 0;
    // debug: log initialization for reserve tiles and then run recompute
    try {
      if (!quiet && String(tile.boardName || '').toLowerCase().includes('reserve')) {
        try { console.log && console.log('[initTileRuntime] before recompute', { boardName: tile.boardName, index: tile.index, heroId: tile.hero && tile.hero.id, currentEnergy: tile.currentEnergy }); } catch (e) {}
      }
    } catch (e) {}
    try { recomputeModifiers(tile); } catch (e) {}
    try {
      if (!quiet && String(tile.boardName || '').toLowerCase().includes('reserve')) {
        try { console.log && console.log('[initTileRuntime] after recompute', { boardName: tile.boardName, index: tile.index, heroId: tile.hero && tile.hero.id, currentEnergy: tile.currentEnergy, reserveApplied: !!tile._reserveBonusApplied }); } catch (e) {}
      }
    } catch (e) {}
    // Safety: if reserve bonus wasn't applied by recomputeModifiers for any reason,
    // apply it here so fixed-positional reserve heroes reliably gain their starting energy.
    try {
      const isReserve = String(tile.boardName || '').toLowerCase().includes('reserve');
      if (isReserve && tile.hero && tile.hero.fixedPositional && tile.hero.positionalModifiers && tile.hero.positionalModifiers.reserve && typeof tile.hero.positionalModifiers.reserve.energy === 'number') {
        if (!tile._reserveBonusApplied) {
          const bonus = Number(tile.hero.positionalModifiers.reserve.energy || 0);
          try { if (!quiet) console.log && console.log('[initTileRuntime] applying missing reserve bonus', { boardName: tile.boardName, index: tile.index, heroId: tile.hero && tile.hero.id, before: tile.currentEnergy, bonus }); } catch (e) {}
          tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + bonus;
          tile._reserveBonusApplied = true;
          // Cache the hero's starting row so fixedPositional bonuses remain 'reserve' even after movement
          try { if (tile.hero && !tile.hero._startingRow) tile.hero._startingRow = 'reserve'; } catch (e) {}
          try { if (!quiet) console.log && console.log('[initTileRuntime] applied missing reserve bonus', { boardName: tile.boardName, index: tile.index, heroId: tile.hero && tile.hero.id, after: tile.currentEnergy }); } catch (e) {}
        }
      }
    } catch (e) {}
    return tile;
  };

  // Assign `boardName` and `index` to each tile clone and initialize runtime fields
  try {
    (cP1 || []).forEach((t, i) => { if (t) { t.boardName = 'p1Board'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cP2 || []).forEach((t, i) => { if (t) { t.boardName = 'p2Board'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cR1 || []).forEach((t, i) => { if (t) { t.boardName = 'p1Reserve'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
    (cR2 || []).forEach((t, i) => { if (t) { t.boardName = 'p2Reserve'; t.index = i; try { initTileRuntime(t); } catch (e) {} } });
  } catch (e) {}

  // Clear any leftover queued casts from previous rounds and reset per-tile casts-remaining
  // so each round's auto-cast logic starts from the hero's configured casts.
  [cP1, cP2, cR1, cR2].forEach(arr => (arr || []).forEach(tile => {
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
  }));

  // Ensure auto-cast energy snapshot does not persist across rounds so heroes
  // will auto-enqueue based on the fresh start-of-round energy value.
  [cP1, cP2].forEach(arr => (arr || []).forEach(tile => { if (!tile || !tile.hero) return; tile._lastAutoCastEnergy = Number.NEGATIVE_INFINITY; }));

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
            addLog && addLog(`  > ${effect.name || 'Effect'} pulse will deal ${v} to ${boardName}[${idx}]`);
            
            // Emit UI step BEFORE applying damage (so animation shows pre-damage state)
            try {
              if (typeof onStep === 'function') {
                const lastAction = { type: 'effectPulse', target: { boardName, index: idx }, effectName: effect.name, action: 'damage', amount: v, effectIndex: ei };
                onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction });
              }
            } catch (e) {}
            
            // Apply damage immediately (so next pulse sees updated state)
            applyHealthDelta(tile, -v);
            
            // Frenzy passive: add +1 energy when this tile takes damage
            // Only trigger if actual damage dealt is greater than 0
            try {
              if (v > 0 && tile._passives && Array.isArray(tile._passives)) {
                const frenzy = tile._passives.find(e => e && e.name === 'Frenzy');
                if (frenzy) {
                  // Emit energyIncrement step BEFORE applying energy (so UI can show emote)
                  if (typeof onStep === 'function') {
                    onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'energyIncrement', target: { boardName, index: idx }, amount: 1, effectName: 'Frenzy' } });
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
              if (tile.effects && Array.isArray(tile.effects)) {
                (tile.effects || []).forEach((eff, effectIdx) => {
                  if (!eff || !eff.onDamaged) return;
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
            } catch (e) {}
          } else if (pulse.type === 'heal') {
            const v = Number(pulse.value || 0);
            addLog && addLog(`  > ${effect.name || 'Effect'} pulse will heal ${v} to ${boardName}[${idx}]`);
            
            // Emit UI step BEFORE applying heal
            try {
              if (typeof onStep === 'function') {
                const lastAction = { type: 'effectPulse', target: { boardName, index: idx }, effectName: effect.name, action: 'heal', amount: v, effectIndex: ei };
                onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction });
              }
            } catch (e) {}
            
            // Apply heal immediately
            applyHealthDelta(tile, v);
        }
    }
    
    try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'pulsesApplied' } }); } catch (e) {}

    // If any reactions were collected (e.g., Prayer onDamaged), emit precast + pulse events (client handles timing)
    if (reactions.length > 0) {
      // Deduplicate identical reactions within this pulse batch
      const dedupedReactions = [];
      const seenReactionKeys = new Set();
      reactions.forEach(rx => {
        if (!rx) return;
        const key = `${rx.type || ''}:${rx.effectName || ''}:${rx.attackerBoard || ''}:${rx.attackerIndex || ''}:${rx.ownerBoardName || ''}:${rx.ownerIndex || ''}:${rx.value || ''}`;
        if (seenReactionKeys.has(key)) return;
        seenReactionKeys.add(key);
        dedupedReactions.push(rx);
      });

      // Emit reaction precast + pulses (visual only)
      dedupedReactions.forEach((rx, rxIdx) => {
        if (rx.type === 'healAlliesExceptSelf') {
          const ownerIsP1 = (rx.ownerBoardName || '').startsWith('p1');
          const ownerArr = ownerIsP1 ? cP1 : cP2;
          (ownerArr || []).forEach((allyTile, ai) => {
            if (!allyTile) return;
            if (ai === rx.ownerIndex) return;
            try {
              if (typeof onStep === 'function') {
                const pre = { type: 'effectPreCast', target: { boardName: ownerIsP1 ? 'p1Board' : 'p2Board', index: ai }, effectName: rx.effectName, amount: rx.value, scale: getEffectPrecastScale(rx.value), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: pre }); } catch (e) {}
                const lastAction = { type: 'effectPulse', target: { boardName: ownerIsP1 ? 'p1Board' : 'p2Board', index: ai }, effectName: rx.effectName, action: 'heal', amount: rx.value, reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction }); } catch (e) {}
              }
            } catch (e) {}
          });
        }
        if (rx.type === 'damageAttacker') {
          try {
            // best-effort: if attacker info present, show damage pulse; otherwise skip
            if (rx.attackerBoard && typeof rx.attackerIndex === 'number') {
              const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : cP2;
              const atk = (aBoard || [])[rx.attackerIndex];
              if (atk) {
                if (typeof onStep === 'function') {
                  // effectPreCast should flash the OWNER's effect icon (hero with the effect), not the attacker
                  const ownerTarget = (rx.ownerBoardName && typeof rx.ownerIndex === 'number')
                    ? { boardName: rx.ownerBoardName, index: rx.ownerIndex }
                    : { boardName: rx.attackerBoard, index: rx.attackerIndex };
                  const pre = { type: 'effectPreCast', target: ownerTarget, effectName: rx.effectName, amount: rx.value, scale: getEffectPrecastScale(rx.value), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: pre }); } catch (e) {}
                  // effectPulse shows damage on the ATTACKER
                  const lastAction = { type: 'effectPulse', target: { boardName: rx.attackerBoard, index: rx.attackerIndex }, effectName: rx.effectName, action: 'damage', amount: rx.value };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction }); } catch (e) {}
                }
              }
            }
          } catch (e) {}
        }
      });

      // Apply reactions' effects to the board state now
      dedupedReactions.forEach(rx => {
        if (rx.type === 'healAlliesExceptSelf') {
          const ownerIsP1 = (rx.ownerBoardName || '').startsWith('p1');
          const ownerArr = ownerIsP1 ? cP1 : cP2;
          (ownerArr || []).forEach((allyTile, ai) => {
            if (!allyTile) return;
            if (ai === rx.ownerIndex) return;
            applyHealthDelta(allyTile, Number(rx.value || 0));
            addLog && addLog(`  > ${rx.effectName} applied heal ${rx.value} to ${(ownerIsP1 ? 'p1Board' : 'p2Board')}[${ai}]`);
          });
        }
        if (rx.type === 'damageAttacker') {
          if (typeof rx.attackerBoard !== 'undefined' && typeof rx.attackerIndex === 'number') {
            const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : cP2;
            const atk = (aBoard || [])[rx.attackerIndex];
            if (atk) {
              applyHealthDelta(atk, -Number(rx.value || 0));
              addLog && addLog(`  > ${rx.effectName} applied ${rx.value} damage to ${rx.attackerBoard}[${rx.attackerIndex}]`);
            }
          }
        }
      });

      try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'reactionsApplied' } }); } catch (e) {}
    }

    // Mark newly-dead tiles after pulses and reactions so reaction emotes render first
    try {
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
              }
            } catch (e) {}
            if (shouldDie) {
              deadNow.push({ boardName: b.name, index: i, tile: t });
            }
          }
        });
      });
      if (deadNow.length > 0 && typeof onStep === 'function') {
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'preDeath' } }); } catch (e) {}
      }
      deadNow.forEach(dead => {
        try {
          const { boardName, index, tile } = dead;
          if (!tile) return;
          tile._dead = true;
          tile.effects = [];
          tile.spellCasts = [];
          tile.currentEnergy = 0;
          addLog && addLog(`  > Marked ${boardName}[${index}] as dead and cleared effects (start-of-round)`);
        } catch (e) {}
      });
      if (deadNow.length > 0 && typeof onStep === 'function') {
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'deathApplied' } }); } catch (e) {}
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
          // Build payload using applierRef for ally/enemy side resolution, but pass ownerRef for adjacentToSelf
          const runtime = buildPayloadFromSpec(effect.spellSpec, applierRef, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 }, ownerRef);
          runtime.source = `${boardName}[${idx}]`;
          const tdescs = runtime && runtime.targets ? runtime.targets : (runtime && runtime.rawTargets ? runtime.rawTargets : []);
          const targetTokens = Array.isArray(tdescs) ? tdescs : [tdescs];
          
          const pendingRoundStartChanges = [];

          // Emit effectPulse for each target before applying (so UI shows damage floats)
          for (let ti = 0; ti < targetTokens.length; ti++) {
            const tdesc = targetTokens[ti];
            const tref = findTileInBoards(tdesc, cP1, cP2, cR1, cR2);
            if (!tref || !tref.tile) continue;

            const perPayload = (runtime.perTargetPayloads && runtime.perTargetPayloads[ti]) ? runtime.perTargetPayloads[ti] : runtime;
            const applied = (perPayload && perPayload.action)
              ? applyPayloadToTarget({ ...perPayload, source: runtime.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 }, onStep, false)
              : null;

            if (applied && applied.type === 'damage') pendingRoundStartChanges.push({ boardName: tref.boardName, index: tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0) });
            if (applied && applied.type === 'heal') pendingRoundStartChanges.push({ boardName: tref.boardName, index: tref.index, deltaHealth: Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0) });

            let pulseAction = null;
            let pulseAmount = 0;
            if (applied && applied.type === 'damage') { pulseAction = 'damage'; pulseAmount = Number(applied.amount || 0); }
            if (applied && applied.type === 'heal') { pulseAction = 'heal'; pulseAmount = Number(applied.amount || 0); }

            if (pulseAction && typeof onStep === 'function') {
              const lastAction = { type: 'effectPulse', target: { boardName: tref.boardName, index: tref.index }, effectName: effect.name, action: pulseAction, amount: pulseAmount, effectIndex: ei };
              try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction }); } catch (e) {}
            }
          }

          // Apply the actual damage/heal and effects after pulses
          pendingRoundStartChanges.forEach(ch => {
            try {
              const arr = (ch.boardName || '').startsWith('p1') ? cP1 : cP2;
              const tile = (arr || [])[ch.index];
              if (!tile) return;
              if (typeof ch.deltaHealth === 'number') applyHealthDelta(tile, Number(ch.deltaHealth || 0));
              if (typeof ch.deltaEnergy === 'number') tile.currentEnergy = (typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && tile.hero.energy) || 0) + Number(ch.deltaEnergy || 0);
            } catch (e) {}
          });
          for (let ti = 0; ti < targetTokens.length; ti++) {
            const tdesc = targetTokens[ti];
            const tref = findTileInBoards(tdesc, cP1, cP2, cR1, cR2);
            if (runtime.effects && runtime.effects.length > 0) applyEffectsToTile(tref && tref.tile, runtime.effects, addLog, ownerRef);
          }
          
          // Emit a state update after all targets processed
          try {
            if (typeof onStep === 'function') {
              const lastAction = { type: 'onRoundStartTriggered', effectName: effect.name, source: { boardName, index: idx } };
              try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction }); } catch (e) {}
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

  processOnRoundStart(cP1, 'p1Board');
  processOnRoundStart(cP2, 'p2Board');

  // Optional short pause after effect pulses/onRoundStart triggers so UI can show damage animations
  if (typeof postEffectDelayMs === 'number' && postEffectDelayMs > 0) {
    addLog && addLog(`Pausing ${postEffectDelayMs}ms after onRoundStart effects before casting`);
    try {
      if (typeof onStep === 'function') {
        const pauseAction = { type: 'postEffectDelay', duration: Number(postEffectDelayMs) };
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: pauseAction }); } catch (e) {}
      }
    } catch (e) {}
    await new Promise(res => setTimeout(res, Number(postEffectDelayMs)));
  }

  // Apply energy increments sequentially (emit event BEFORE applying each increment)
  // Only main boards gain energy after effect pulses/onRoundStart; reserve heroes do not gain energy.
  try {
    for (const arr of [cP1, cP2]) {
      for (let i = 0; i < arr.length; i++) {
        const tile = arr[i];
        if (tile && tile.hero) {
          // Calculate energy gain amount (based on speed)
          const speed = Number(tile.currentSpeed != null ? tile.currentSpeed : (tile.hero && tile.hero.speed) || 0);
          const energyGain = speed;
          
          // Emit energyIncrement event with PRE-INCREMENT state
          if (typeof onStep === 'function') {
            onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'energyIncrement', target: { boardName: tile.boardName, index: tile.index }, amount: energyGain } });
          }
          // Now apply the energy increment for this specific hero
          incEnergy(tile);
        }
      }
    }
    // Emit gameState after all energy increments applied
    if (typeof onStep === 'function') {
      onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'energyApplied' } });
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
    applyAcceptContract(cP2, cP1, 'p2Board');
  } catch (e) {}

// Helper: map tile index to slot ('front','middle','back') for either player's board
function slotForIndex(boardName, idx) {
  const mod = (idx % 3 + 3) % 3;
  if (String(boardName || '').startsWith('p1')) {
    return mod === 0 ? 'back' : (mod === 1 ? 'middle' : 'front');
  }
  return mod === 0 ? 'front' : (mod === 1 ? 'middle' : 'back');
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

  // Collect casts initially
  let pendingCasts = collectSpellCasts(cP1, cP2, cR1, cR2);
  if (pendingCasts.length > 0) addLog && addLog(`Found ${pendingCasts.length} pending cast(s)`);

  // We will process casts in a dynamic loop. After each cast is resolved we
  // re-run auto-cast collection to allow tiles that gained energy mid-round
  // (e.g. from Frenzy) to enqueue casts and act during the same round.
  const processedQueuedIds = new Set();
  while (pendingCasts.length > 0) {
    // Order pending casts and pick the next one to resolve
    const go = getCastOrder(pendingCasts, cP1, cP2, priorityPlayer, addLog);
    const ordered = go.ordered;
    priorityPlayer = go.priorityPlayer;
    if (!ordered || ordered.length === 0) break;
    const cast = ordered[0];
    // recentDamageEvents collects deferred damage applied during this cast
    // so we can attribute kills to their sources (used for passives like Bounty)
    let recentDamageEvents = [];
    const src = cast.caster;
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
          runtimePayload = buildPayloadFromSpec(modifiedSpec, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
        } else if (spell.id === 'copyCat') {
          // Special-case: perform the last spell cast by an enemy Hero, as though `src` is the caster.
          // We only do this if there is a previous cast and it was performed by the opposing side.
          try {
            if (lastCastAction && lastCastAction.type === 'cast' && lastCastAction.spellId) {
              const lastCasterBoard = (lastCastAction.caster && String(lastCastAction.caster.boardName || '').startsWith('p1')) ? 'p1' : 'p2';
              const casterBoard = src && src.boardName && String(src.boardName).startsWith('p1') ? 'p1' : 'p2';
              if (lastCasterBoard !== casterBoard) {
                const copied = getSpellById(lastCastAction.spellId);
                if (copied && copied.spec) {
                  runtimePayload = buildPayloadFromSpec(copied.spec, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
                  runtimePayload._copiedFrom = lastCastAction.caster || null;
                  addLog && addLog(`  > CopyCat: ${src.boardName}[${src.index}] will attempt to perform ${String(lastCastAction.spellId || '')}`);
                } else {
                  // Nothing to copy — fallback to a no-op payload
                  runtimePayload = buildPayloadFromSpec({ targets: [] }, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
                }
              } else {
                // last cast was by an ally — no-op
                runtimePayload = buildPayloadFromSpec({ targets: [] }, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
              }
            } else {
              runtimePayload = buildPayloadFromSpec({ targets: [] }, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
            }
          } catch (e) {
            runtimePayload = buildPayloadFromSpec({ targets: [] }, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
          }
        } else {
          runtimePayload = buildPayloadFromSpec(spell.spec, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
        }
        runtimePayload.source = `${src.boardName}[${src.index}]`;
      }
    } else if (cast.payload && (cast.payload.spec || cast.payload.rawTargets || cast.payload.targets == null)) {
      // allow either payload.spec or payload (if it's already a spec object)
      const spec = cast.payload.spec || cast.payload;
      runtimePayload = buildPayloadFromSpec(spec, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
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
        console.debug && console.debug('[CastDebug]', { casterId, spellId, rawTargets: rawTargets, runtimeTargets: runtimePayload.targets || [], perTargetPayloads: runtimePayload.perTargetPayloads || [], enemyOccupiedIndices: occupiedIndices });
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

    // Emit a pre-cast visual step so UI can show a glow/charging animation.
    try {
      if (typeof onStep === 'function') {
        const pre = {
          type: 'preCast',
          caster: { boardName: src.boardName, index: src.index },
          spellId: cast.payload && cast.payload.spellId ? cast.payload.spellId : null
        };
        try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: pre }); } catch (e) {}
      }
    } catch (e) {}

    // If runtimePayload has rawTargets or targets descriptors, resolve to concrete tokens
    const tdescs = runtimePayload && runtimePayload.targets ? runtimePayload.targets : (runtimePayload && runtimePayload.rawTargets ? runtimePayload.rawTargets : []);
    // Check if targets are already concrete tokens (have 'board' field) or descriptors (have 'type' field)
    const tdescsArray = Array.isArray(tdescs) ? tdescs : [tdescs];
    const needsResolution = tdescsArray.length > 0 && tdescsArray.some(t => t && t.type && !t.board);
    const targetTokens = needsResolution 
      ? resolveTargets(tdescs, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 })
      : tdescsArray;
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
    targetTokens.forEach((tdesc, tidx) => {
      const tref = findTileInBoards(tdesc, cP1, cP2, cR1, cR2);
      let applied = null;
      const isSecondaryTarget = !!(spellDef && spellDef.animationSecondary) && typeof tidx === 'number' && tidx > 0;
      const phaseTag = isSecondaryTarget ? 'secondary' : 'primary';
      // select per-target payload if provided
      const per = (runtimePayload && Array.isArray(runtimePayload.perTargetPayloads) && runtimePayload.perTargetPayloads[tidx]) ? { ...runtimePayload, ...runtimePayload.perTargetPayloads[tidx] } : runtimePayload;

      // Debug: per-target details for Ice Mage
      try {
        const casterId = src && src.tile && src.tile.hero && src.tile.hero.id;
        if (casterId === 'iceMageID') {
          addLog && addLog(`[CastDebug] targetIndex=${tidx} token=${JSON.stringify(tdesc)} resolved=${JSON.stringify(tref)} per=${JSON.stringify(per)}`);
          if (!(per && per.action)) addLog && addLog(`[CastDebug] Skipping apply for ${casterId} -> target ${tidx} because per.action is missing or null`);
          console.debug && console.debug('[CastDebug] per-target', { tidx, tdesc, tref, per });
        }
      } catch (e) {}

      if (per && per.action) {
        // honor optional post-condition: onlyApplyToWithEffect or onlyApplyIfHasDebuff
        const onlyIf = per.post && per.post.onlyApplyToWithEffect;
        const onlyIfHasDebuff = per.post && per.post.onlyApplyIfHasDebuff;
        if (onlyIf) {
          const has = tref && tref.tile && (tref.tile.effects || []).some(e => e && e.name === onlyIf);
          if (!has) {
            addLog && addLog(`  > Skipping target ${tref && tref.boardName}[${tref && tref.index}] — lacks effect ${onlyIf}`);
          } else {
            applied = applyPayloadToTarget({ ...per, source: per.source || runtimePayload.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 }, onStep, false);
            try {
              if (applied && applied.type === 'damage') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), source: (per && per.source) || (runtimePayload && runtimePayload.source), spellId: runtimePayload && runtimePayload.spellId, phase: phaseTag });
              if (applied && applied.type === 'heal') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), phase: phaseTag });
            } catch (e) {}
          }
        } else if (onlyIfHasDebuff) {
          const hasDebuff = tref && tref.tile && (tref.tile.effects || []).some(e => e && e.kind === 'debuff');
          if (!hasDebuff) {
            addLog && addLog(`  > Skipping target ${tref && tref.boardName}[${tref && tref.index}] — lacks any debuff`);
          } else {
            applied = applyPayloadToTarget({ ...per, source: per.source || runtimePayload.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 }, onStep, false);
            try {
              if (applied && applied.type === 'damage') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), source: (per && per.source) || (runtimePayload && runtimePayload.source), spellId: runtimePayload && runtimePayload.spellId, phase: phaseTag });
              if (applied && applied.type === 'heal') pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), phase: phaseTag });
            } catch (e) {}
          }
          } else {
            applied = applyPayloadToTarget({ ...per, source: per.source || runtimePayload.source }, tref, addLog, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 }, onStep, false);
            try {
              if (applied && applied.type === 'damage') {
                pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaHealth: -Number(applied.amount || 0), amount: Number(applied.amount || 0), deltaEnergy: Number(applied.deltaEnergy || 0), source: (per && per.source) || (runtimePayload && runtimePayload.source), spellId: runtimePayload && runtimePayload.spellId, phase: phaseTag });
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
      
      if (runtimePayload.effects && runtimePayload.effects.length > 0) {
        pendingEffects.push({ target: tref, effects: runtimePayload.effects, applier: src });
        effectsApplied = (runtimePayload.effects || []).map(e => e && e.name).filter(Boolean);
      }

      // Apply caster on-cast effects to targeted enemies (e.g., Heating Up -> Burn)
      try {
        const casterEffects = (src && src.tile && Array.isArray(src.tile.effects)) ? src.tile.effects : [];
        const casterSide = (src && src.boardName && String(src.boardName).startsWith('p1')) ? 'p1' : 'p2';
        for (const ce of casterEffects) {
          if (!ce || !ce.onCastApplyEffectToTargets) continue;
          const cfg = ce.onCastApplyEffectToTargets;
          const effectName = cfg.effect || cfg.effectName || cfg.name;
          if (!effectName) continue;
          const side = cfg.side || 'enemy';
          const targetSide = (tref && tref.boardName && String(tref.boardName).startsWith('p1')) ? 'p1' : 'p2';
          const isEnemy = targetSide !== casterSide;
          if ((side === 'enemy' && !isEnemy) || (side === 'ally' && isEnemy)) continue;
          const eff = EFFECTS[effectName] || null;
          if (eff) {
            pendingEffects.push({ target: tref, effects: [eff], applier: src });
            effectsApplied.push(eff.name);
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

      actionResults.push({ target: tref, applied, effectsApplied, phase: phaseTag });

      // If spec declares a deltaEnergy for this target (post.deltaEnergy),
      // queue it as a pendingCastChange so the UI shows the energy pulse and
      // the engine applies the energy at the same time as other pending changes.
      try {
        const postDelta = (per && per.post && typeof per.post.deltaEnergy === 'number') ? Number(per.post.deltaEnergy) : (runtimePayload && runtimePayload.post && typeof runtimePayload.post.deltaEnergy === 'number' ? Number(runtimePayload.post.deltaEnergy) : null);
        if (postDelta && postDelta !== 0) {
          const already = pendingCastChanges.some(ch => ch && ch.boardName === (tref && tref.boardName) && Number(ch.index) === Number(tref && tref.index) && Number(ch.deltaEnergy || 0) === Number(postDelta));
          if (!already) {
            pendingCastChanges.push({ boardName: tref && tref.boardName, index: tref && tref.index, deltaEnergy: Number(postDelta), phase: phaseTag });
            addLog && addLog(`  > post.deltaEnergy queued ${postDelta} to ${tref.boardName}[${tref.index}]`);
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
                const secRuntime = buildPayloadFromSpec(cond.secondarySpec, src, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 });
                secRuntime.source = `${src.boardName}[${src.index}]`;
                // Apply per-target resolution for the secondary spec (deferred)
                for (let si = 0; si < (secRuntime.targets || []).length; si++) {
                  const st = secRuntime.targets[si];
                  const stRef = findTileInBoards(st, cP1, cP2, cR1, cR2);
                  const sper = (secRuntime && Array.isArray(secRuntime.perTargetPayloads) && secRuntime.perTargetPayloads[si]) ? { ...secRuntime, ...secRuntime.perTargetPayloads[si] } : secRuntime;
                  if (sper && sper.action) {
                    const applied2 = applyPayloadToTarget({ ...sper, source: sper.source || secRuntime.source }, stRef, addLog, { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2 }, onStep, false);
                    if (applied2 && applied2.type === 'damage') pendingCastChanges.push({ boardName: stRef && stRef.boardName, index: stRef && stRef.index, deltaHealth: -Number(applied2.amount || 0), amount: Number(applied2.amount || 0), deltaEnergy: Number(applied2.deltaEnergy || 0), source: sper && sper.source || secRuntime.source, phase: 'secondary' });
                    if (applied2 && applied2.type === 'heal') pendingCastChanges.push({ boardName: stRef && stRef.boardName, index: stRef && stRef.index, deltaHealth: Number(applied2.amount || 0), amount: Number(applied2.amount || 0), deltaEnergy: Number(applied2.deltaEnergy || 0), phase: 'secondary' });
                    actionResults.push({ target: stRef, applied: applied2, effectsApplied: [], phase: 'secondary' });
                  }
                }
              }
            }
          } catch (e) {}
        }
      } catch (e) {}

      // Optional post-processing: move the target hero back by one row if requested
      try {
        const moveBack = (per && per.post && per.post.moveRowBack) || (runtimePayload && runtimePayload.post && runtimePayload.post.moveRowBack);
        if (moveBack && tref && tref.boardName) {
          const boardName = (tref.boardName === 'p1Board') ? 'p1' : 'p2';
          const boardArr = (boardName === 'p1') ? cP1 : cP2;
          const row = indexToRow(tref.index, boardName);
          addLog && addLog(`  > post.moveRowBack triggered on ${tref.boardName}[${tref.index}] (row ${row})`);
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
                        const newSlot = slotForIndex((boardName === 'p1' ? 'p1Board' : 'p2Board'), blockingToIdx);
                        for (const mc of movedCasts) {
                          if (!mc || !mc.slot || mc.slot === 'basic') continue;
                          mc.slot = newSlot;
                          try { if (blockingToSlot && blockingToSlot.hero && blockingToSlot.hero.spells && blockingToSlot.hero.spells[newSlot] && blockingToSlot.hero.spells[newSlot].id) mc.spellId = blockingToSlot.hero.spells[newSlot].id; } catch (e) {}
                        }
                        blockingToSlot.spellCasts = (Array.isArray(blockingToSlot.spellCasts) ? blockingToSlot.spellCasts : []).concat(movedCasts);
                        if (movedCasts.length > 0) addLog && addLog(`  > Moved ${movedCasts.length} queued cast(s) from ${boardName}[${toIdx}] to ${boardName}[${blockingToIdx}]`);
                        if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                          const expectedBoard = (boardName === 'p1') ? 'p1Board' : 'p2Board';
                          for (const pc of pendingCasts) {
                            if (!pc || !pc.caster || typeof pc.caster.index !== 'number' || pc.caster.boardName !== expectedBoard || Number(pc.caster.index) !== toIdx) continue;
                            pc.caster.index = blockingToIdx;
                            pc.caster.tile = blockingToSlot;
                            try { const match = movedCasts.find(mc => mc && mc.queuedId === (pc.payload && pc.payload.queuedId)); if (match && match.slot && match.slot !== 'basic') { pc.payload.slot = match.slot; pc.payload.spellId = match.spellId; } } catch (e) {}
                          }
                        }
                        if (typeof pendingCastChanges !== 'undefined' && Array.isArray(pendingCastChanges)) {
                          const expectedBoardName = (boardName === 'p1') ? 'p1Board' : 'p2Board';
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
                addLog && addLog(`  > Moving hero from ${boardName}[${fromIdx}] to ${boardName}[${toIdx}] due to moveRowBack`);
                // move hero and runtime fields
                finalToSlot.hero = fromSlot.hero;
                finalToSlot.effects = fromSlot.effects || [];
                finalToSlot._castsRemaining = fromSlot._castsRemaining ? { ...fromSlot._castsRemaining } : undefined;
                // Reset _lastAutoCastEnergy so auto-cast will re-evaluate the moved hero
                // at their new position (new row = new spell slot with potentially different cost)
                finalToSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY;
                finalToSlot.currentEnergy = fromSlot.currentEnergy;
                finalToSlot.currentHealth = fromSlot.currentHealth;
                finalToSlot.currentArmor = fromSlot.currentArmor;
                finalToSlot.currentSpeed = fromSlot.currentSpeed;
                finalToSlot.currentSpellPower = fromSlot.currentSpellPower;
                // Move any queued casts with the hero so the cast order reflects the new position
                try {
                  const movedCasts = (Array.isArray(fromSlot.spellCasts) ? fromSlot.spellCasts.map(c => ({ ...c })) : []);
                  // Update moved casts to match the hero's new slot mapping (e.g., front->middle when moved back one row)
                  try {
                    const newSlot = slotForIndex((boardName === 'p1' ? 'p1Board' : 'p2Board'), toIdx);
                    for (const mc of movedCasts) {
                      if (!mc) continue;
                      // Only remap non-basic entries
                      if (mc.slot && mc.slot !== 'basic') {
                        mc.slot = newSlot;
                        // Update spellId to the hero's spell at the new slot, if possible
                        try {
                          if (finalToSlot && finalToSlot.hero && finalToSlot.hero.spells && finalToSlot.hero.spells[newSlot] && finalToSlot.hero.spells[newSlot].id) {
                            mc.spellId = finalToSlot.hero.spells[newSlot].id;
                          }
                        } catch (e) {}
                      }
                    }
                  } catch (e) {}

                  finalToSlot.spellCasts = (Array.isArray(finalToSlot.spellCasts) ? finalToSlot.spellCasts : []).concat(movedCasts);
                  if (movedCasts.length > 0) addLog && addLog(`  > Moved ${movedCasts.length} queued cast(s) from ${boardName}[${fromIdx}] to ${boardName}[${toIdx}] due to moveRowBack`);

                  // Update in-memory pending cast references so already-collected casts point to the new index
                  try {
                    if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                      for (const pc of pendingCasts) {
                        if (!pc || !pc.caster || typeof pc.caster.index !== 'number' || !pc.caster.boardName) continue;
                        const pcBoard = pc.caster.boardName;
                        const expectedBoard = (boardName === 'p1') ? 'p1Board' : 'p2Board';
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
                          pc.caster.tile = finalToSlot;
                          addLog && addLog(`  > Updated pending cast caster ref from ${boardName}[${fromIdx}] to ${boardName}[${toIdx}]`);
                        }
                      }
                    }
                  } catch (e) {}
                  // Update pendingCastChanges so health/energy deltas target the moved hero's new index
                  try {
                    if (typeof pendingCastChanges !== 'undefined' && Array.isArray(pendingCastChanges)) {
                      const expectedBoardName = (boardName === 'p1') ? 'p1Board' : 'p2Board';
                      for (const ch of pendingCastChanges) {
                        if (!ch || ch.boardName !== expectedBoardName || Number(ch.index) !== fromIdx) continue;
                        ch.index = toIdx;
                        addLog && addLog(`  > Updated pendingCastChange index from ${expectedBoardName}[${fromIdx}] to ${expectedBoardName}[${toIdx}]`);
                      }
                    }
                  } catch (e) {}
                } catch (e) {}
                // clear source slot
                fromSlot.hero = null;
                fromSlot.effects = [];
                fromSlot._castsRemaining = undefined;
                fromSlot._lastAutoCastEnergy = undefined;
                fromSlot.currentEnergy = undefined;
                fromSlot.currentHealth = undefined;
                fromSlot.currentArmor = undefined;
                fromSlot.currentSpeed = undefined;
                fromSlot.currentSpellPower = undefined;
                // Clear any queued casts left on the source slot since the hero moved
                try { fromSlot.spellCasts = []; } catch (e) {}
                try { recomputeModifiers(finalToSlot); } catch (e) {}
                try { recomputeModifiers(fromSlot); } catch (e) {}
                // Reset _lastAutoCastEnergy so auto-cast will re-evaluate the moved hero
                // at their new position (new row = new spell slot with potentially different cost)
                try { finalToSlot._lastAutoCastEnergy = Number.NEGATIVE_INFINITY; } catch (e) {}
                // Emit an onStep movement event so UI can animate reposition
                try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'moveRowBack', source: runtimePayload.source || null, from: { board: boardName, index: fromIdx }, to: { board: boardName, index: toIdx } } }); } catch (e) {}
                // Update targetTokens for all remaining unprocessed targets that reference the moved hero
                try {
                  const expectedBoardName = (boardName === 'p1') ? 'p1Board' : 'p2Board';
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
            }
          }
        }
      } catch (e) {}

      // Optional post-processing: move all heroes in each column back as far as possible
      try {
        const moveAll = (per && per.post && per.post.moveAllBack) || (runtimePayload && runtimePayload.post && runtimePayload.post.moveAllBack);
        if (moveAll && tref && tref.boardName) {
          const boardName = (tref.boardName === 'p1Board') ? 'p1' : 'p2';
          const boardArr = (boardName === 'p1') ? cP1 : cP2;
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
                const newSlot = slotForIndex((boardName === 'p1' ? 'p1Board' : 'p2Board'), toIdx);
                for (const mc of movedCasts) {
                  if (mc && mc.slot && mc.slot !== 'basic') mc.slot = newSlot;
                  try { if (toSlot && toSlot.hero && toSlot.hero.spells && toSlot.hero.spells[newSlot] && toSlot.hero.spells[newSlot].id) mc.spellId = toSlot.hero.spells[newSlot].id; } catch (e) {}
                }
                toSlot.spellCasts = (Array.isArray(toSlot.spellCasts) ? toSlot.spellCasts : []).concat(movedCasts);
                if (movedCasts.length > 0) addLog && addLog(`  > Moved ${movedCasts.length} queued cast(s) into ${boardName}[${toIdx}] due to moveAllBack`);
                try {
                  if (typeof pendingCasts !== 'undefined' && Array.isArray(pendingCasts)) {
                    for (const pc of pendingCasts) {
                      if (!pc || !pc.caster || typeof pc.caster.index !== 'number' || !pc.caster.boardName) continue;
                      const expectedBoard = (boardName === 'p1') ? 'p1Board' : 'p2Board';
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
            try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'moveAllBack', source: runtimePayload.source || null, column: col } }); } catch (e) {}
          }
        }
      } catch (e) {}

      // Optional post-processing: reduce the number of casts for the row containing the target
      try {
        const reduceBy = (per && per.post && typeof per.post.reduceRowCastsBy === 'number') ? Number(per.post.reduceRowCastsBy) : (runtimePayload && runtimePayload.post && typeof runtimePayload.post.reduceRowCastsBy === 'number' ? Number(runtimePayload.post.reduceRowCastsBy) : 0);
        if (reduceBy && tref && tref.boardName) {
          const boardName = (tref.boardName === 'p1Board') ? 'p1' : 'p2';
          const boardArr = (boardName === 'p1') ? cP1 : cP2;
          const row = indexToRow(tref.index, boardName);
          const slotKey = row === 0 ? 'front' : (row === 1 ? 'middle' : 'back');
          addLog && addLog(`  > post.reduceRowCastsBy ${reduceBy} on ${tref.boardName}[${tref.index}] (row ${row}, slot ${slotKey})`);
          // For each slot in the row, decrement its tile._castsRemaining for the corresponding slotKey
          const map = (boardName === 'p1') ? [2,5,8,1,4,7,0,3,6] : [6,3,0,7,4,1,8,5,2];
          for (const idx of map) {
            const r = indexToRow(idx, boardName);
            if (r !== row) continue;
            const slot = boardArr[idx];
            if (!slot || !slot.hero) continue;
            if (!slot._castsRemaining) slot._castsRemaining = { front: 0, middle: 0, back: 0 };
            const before = Number(slot._castsRemaining[slotKey] || 0);
            slot._castsRemaining[slotKey] = Math.max(0, before - reduceBy);
            addLog && addLog(`  > Reduced ${boardName}[${idx}]._castsRemaining.${slotKey} ${before} -> ${slot._castsRemaining[slotKey]}`);
            // Emit a small onStep to update visuals
            try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'reduceRowCasts', board: boardName, index: idx, slot: slotKey, before, after: slot._castsRemaining[slotKey] } }); } catch (e) {}
          }
        }
      } catch (e) {}
    });

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

    // After processing this cast, mark it processed and remove it from the caster's queued list
    try {
      if (cast && cast.payload && typeof cast.payload.queuedId !== 'undefined' && src && src.tile && Array.isArray(src.tile.spellCasts)) {
        // remove the matching queued entry so it won't be re-collected
        src.tile.spellCasts = src.tile.spellCasts.filter(sc => !(sc && sc.queuedId === cast.payload.queuedId));
        processedQueuedIds.add(cast.payload.queuedId);
      }
    } catch (e) {}

    // Immediate death processing after each cast: handle onDeath triggers and mark dead tiles
    (function immediateDeathProcessing() {
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
              }
            } catch (e) {}
            if (shouldDie) {
              deadNow.push({ boardName: b.name, index: i, tile: t });
            }
          }
        });
      });

      if (deadNow.length === 0) return;

      // process onDeath effects immediately
      deadNow.forEach(dead => {
        addLog && addLog(`Processing death of ${dead.boardName}[${dead.index}]`);
        allBoardsLocal.forEach(ownerBoard => {
          (ownerBoard.arr || []).forEach((ownerTile, ownerIdx) => {
            if (!ownerTile || !ownerTile.effects) return;
            (ownerTile.effects || []).forEach(effect => {
              if (!effect || !effect.onDeath) return;
              const ownerIsP1 = ownerBoard.name.startsWith('p1');
              const deadIsP1 = dead.boardName.startsWith('p1');
              if (ownerIsP1 !== deadIsP1) return;
              const od = effect.onDeath;
              if (od.type === 'healAlliesExceptSelf') {
                const healVal = Number(od.value || 0);
                const targetArr = ownerIsP1 ? cP1 : cP2;
                (targetArr || []).forEach((allyTile, ai) => {
                  if (!allyTile) return;
                  if (ai === ownerIdx) return;
                  applyHealthDelta(allyTile, Number(healVal || 0));
                  addLog && addLog(`  > ${effect.name} healed ${healVal} to ${ownerBoard.name}[${ai}] due to death`);
                });
              }
            });
          });
        });
      });

      // mark dead tiles immediately
      deadNow.forEach(dead => {
        try {
          const { boardName, index, tile } = dead;
          if (!tile) return;
          tile._dead = true;
          tile.effects = [];
          tile.spellCasts = [];
          tile.currentEnergy = 0;
          addLog && addLog(`  > Marked ${boardName}[${index}] as dead and cleared effects`);
        } catch (e) {}
      });

      // After marking deaths, check main boards (reserves excluded) for a game end
      try {
        const aliveP1 = (cP1 || []).some(t => t && t.hero && !t._dead);
        const aliveP2 = (cP2 || []).some(t => t && t.hero && !t._dead);
        if (!aliveP1 && aliveP2) { gameWinner = 'player2'; addLog && addLog('Game end detected: player2 wins (no alive heroes on player1 main board)'); }
        else if (!aliveP2 && aliveP1) { gameWinner = 'player1'; addLog && addLog('Game end detected: player1 wins (no alive heroes on player2 main board)'); }
        else if (!aliveP1 && !aliveP2) { gameWinner = 'draw'; addLog && addLog('Game end detected: draw (no alive heroes on either main board)'); }
      } catch (e) {}
    })();

    // build a concise lastAction payload for UI to animate (caster, spell, per-target results)
    const lastAction = {
      type: 'cast',
      caster: { boardName: src.boardName, index: src.index },
      spellId: cast.payload && cast.payload.spellId ? cast.payload.spellId : (runtimePayload && runtimePayload.spellId ? runtimePayload.spellId : null),
      results: actionResults.map(r => ({ target: r.target, applied: (r.applied && r.applied.deferred) ? null : r.applied, effectsApplied: r.effectsApplied, phase: r.phase }))
    };
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
      const spellDef = getSpellById(lastAction.spellId) || {};
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
        onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction });
      }
    } catch (e) {}
    try { if (lastAction && lastAction.type === 'cast') lastCastAction = lastAction; } catch (e) {}

    

    // If a game-winning condition was detected during death processing, notify UI and stop resolving further casts
    if (gameWinner) {
      try {
        if (typeof onStep === 'function') {
          try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'gameEnd', winner: gameWinner } }); } catch (e) {}
        }
      } catch (e) {}
      return { p1Board: cP1, p2Board: cP2, p1Reserve: cR1, p2Reserve: cR2, priorityPlayer, winner: gameWinner };
    }

    // Emit post-cast wait so client can pause before impact pulses
    try {
      if (typeof onStep === 'function') {
        onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'postCastWait', duration: postCastDelayMs } });
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
        // Emit one `effectPulse` per change
        pendingCastChanges.forEach(ch => {
          try {
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
              onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction });
            }
            // If there's ALSO a deltaEnergy (e.g., from Frenzy passive triggering on damage), emit a separate energyIncrement step
            if (typeof ch.deltaHealth === 'number' && Number(ch.deltaHealth) < 0 && typeof ch.deltaEnergy === 'number' && Number(ch.deltaEnergy) > 0 && typeof onStep === 'function') {
              const energyAction = { type: 'energyIncrement', target: { boardName: aBoardName, index: idx }, amount: Number(ch.deltaEnergy), effectName: 'Frenzy' };
              onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: energyAction });
            }
          } catch (e) {}
        });

        // Apply the pending stat changes
        pendingCastChanges.forEach(ch => {
          try {
            const arr = (ch.boardName || '').startsWith('p1') ? cP1 : cP2;
            const tile = (arr || [])[ch.index];
            if (!tile) return;
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
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction }); } catch (e) {}
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
        touched.forEach(key => {
          try {
            const [bn, idxStr] = String(key).split(':');
            const idx = Number(idxStr);
            const arr = (bn || '').startsWith('p1') ? cP1 : cP2;
            const tile = (arr || [])[idx];
            if (tile) recomputeModifiers(tile);
          } catch (e) {}
        });
      }

      // Emit gameState update even for effect-only casts
      if (typeof onStep === 'function') {
        onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'castApplied' } });
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
          const key = `${rx.type || ''}:${rx.effectName || ''}:${rx.attackerBoard || ''}:${rx.attackerIndex || ''}:${rx.ownerBoardName || ''}:${rx.ownerIndex || ''}:${rx.value || ''}`;
          if (seenReactionKeys.has(key)) return;
          seenReactionKeys.add(key);
          dedupedReactions.push(rx);
        });

        // Emit precast + pulses for reactions (client handles timing)
        dedupedReactions.forEach((rx, rxIdx) => {
          if (rx.type === 'healAlliesExceptSelf') {
            const ownerIsP1 = (rx.ownerBoardName || '').startsWith('p1');
            const ownerArr = ownerIsP1 ? cP1 : cP2;
            (ownerArr || []).forEach((allyTile, ai) => {
              if (!allyTile) return;
              if (ai === rx.ownerIndex) return;
              try {
                if (typeof onStep === 'function') {
                  const pre = { type: 'effectPreCast', target: { boardName: ownerIsP1 ? 'p1Board' : 'p2Board', index: ai }, effectName: rx.effectName, amount: rx.value, scale: getEffectPrecastScale(rx.value), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: pre }); } catch (e) {}
                  const lastAction = { type: 'effectPulse', target: { boardName: ownerIsP1 ? 'p1Board' : 'p2Board', index: ai }, effectName: rx.effectName, action: 'heal', amount: rx.value, reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction }); } catch (e) {}
                }
              } catch (e) {}
            });
          }
          if (rx.type === 'damageAttacker') {
            try {
              const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : cP2;
              const atk = (aBoard || [])[rx.attackerIndex];
              if (atk) {
                if (typeof onStep === 'function') {
                  const ownerTarget = (rx.ownerBoardName && typeof rx.ownerIndex === 'number')
                    ? { boardName: rx.ownerBoardName, index: rx.ownerIndex }
                    : { boardName: rx.attackerBoard, index: rx.attackerIndex };
                  const pre = { type: 'effectPreCast', target: ownerTarget, effectName: rx.effectName, amount: rx.value, scale: getEffectPrecastScale(rx.value), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: pre }); } catch (e) {}
                  const lastAction = { type: 'effectPulse', target: { boardName: rx.attackerBoard, index: rx.attackerIndex }, effectName: rx.effectName, action: 'damage', amount: rx.value };
                  try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction }); } catch (e) {}
                }
              }
            } catch (e) {}
          }
          if (rx.type === 'applyEffectToAttacker') {
            try {
              const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : cP2;
              const atk = (aBoard || [])[rx.attackerIndex];
              if (atk && typeof onStep === 'function') {
                const ownerTarget = (rx.ownerBoardName && typeof rx.ownerIndex === 'number')
                  ? { boardName: rx.ownerBoardName, index: rx.ownerIndex }
                  : { boardName: rx.attackerBoard, index: rx.attackerIndex };
                const pre = { type: 'effectPreCast', target: ownerTarget, effectName: rx.effectName, amount: 0, scale: getEffectPrecastScale(1), reactionIndex: rxIdx, ownerBoardName: rx.ownerBoardName, ownerIndex: rx.ownerIndex, effectIndex: rx.effectIndex };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: pre }); } catch (e) {}
                const appliedAction = { type: 'effectApplied', target: { boardName: rx.attackerBoard, index: rx.attackerIndex }, effectName: rx.effectName };
                try { onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: appliedAction }); } catch (e) {}
              }
            } catch (e) {}
          }
        });

        // Then apply reactions' effects to the board state and emit update steps
        dedupedReactions.forEach(rx => {
          if (rx.type === 'healAlliesExceptSelf') {
            const ownerIsP1 = (rx.ownerBoardName || '').startsWith('p1');
            const ownerArr = ownerIsP1 ? cP1 : cP2;
            (ownerArr || []).forEach((allyTile, ai) => {
              if (!allyTile) return;
              if (ai === rx.ownerIndex) return;
              applyHealthDelta(allyTile, Number(rx.value || 0));
              addLog && addLog(`  > ${rx.effectName} applied heal ${rx.value} to ${(ownerIsP1 ? 'p1Board' : 'p2Board')}[${ai}]`);
            });
          }
          if (rx.type === 'damageAttacker') {
            const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : cP2;
            const atk = (aBoard || [])[rx.attackerIndex];
            if (atk) {
              applyHealthDelta(atk, -Number(rx.value || 0));
              addLog && addLog(`  > ${rx.effectName} applied ${rx.value} damage to ${rx.attackerBoard}[${rx.attackerIndex}]`);
            }
          }
          if (rx.type === 'applyEffectToAttacker') {
            const aBoard = rx.attackerBoard === 'p1Board' ? cP1 : cP2;
            const atk = (aBoard || [])[rx.attackerIndex];
            const eff = rx.effectName ? (EFFECTS[rx.effectName] || null) : null;
            if (atk && eff) {
              applyEffectsToTile(atk, [eff], addLog, { boardName: rx.ownerBoardName, index: rx.ownerIndex, tile: atk });
              addLog && addLog(`  > ${rx.effectName} applied to ${rx.attackerBoard}[${rx.attackerIndex}]`);
            }
          }
        });
        try { if (typeof onStep === 'function') onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'reactionsApplied' } }); } catch (e) {}
      }
    } catch (e) {}

    // Process deaths that resulted from this cast and its reactions (deferred damage)
    try {
      const recent = typeof recentDamageEvents !== 'undefined' ? recentDamageEvents : [];
      const allBoardsLocal = [ { arr: cP1, name: 'p1Board' }, { arr: cP2, name: 'p2Board' }, { arr: cR1, name: 'p1Reserve' }, { arr: cR2, name: 'p2Reserve' } ];
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
              }
            } catch (e) {}
            if (shouldDie) {
              deadNow.push({ boardName: b.name, index: i, tile: t });
            }
          }
        });
      });

      if (deadNow.length > 0) {
        // process onDeath effects immediately (similar to earlier immediateDeathProcessing)
        deadNow.forEach(dead => {
          addLog && addLog(`Processing death of ${dead.boardName}[${dead.index}] (post-cast)`);
          allBoardsLocal.forEach(ownerBoard => {
            (ownerBoard.arr || []).forEach((ownerTile, ownerIdx) => {
              if (!ownerTile || !ownerTile.effects) return;
              (ownerTile.effects || []).forEach(effect => {
                if (!effect || !effect.onDeath) return;
                const ownerIsP1 = ownerBoard.name.startsWith('p1');
                const deadIsP1 = dead.boardName.startsWith('p1');
                if (ownerIsP1 !== deadIsP1) return;
                const od = effect.onDeath;
                if (od.type === 'healAlliesExceptSelf') {
                  const healVal = Number(od.value || 0);
                  const targetArr = ownerIsP1 ? cP1 : cP2;
                  (targetArr || []).forEach((allyTile, ai) => {
                    if (!allyTile) return;
                    if (ai === ownerIdx) return;
                    applyHealthDelta(allyTile, Number(healVal || 0));
                    addLog && addLog(`  > ${effect.name} healed ${healVal} to ${ownerBoard.name}[${ai}] due to death`);
                  });
                }
              });
            });
          });
        });

        // Emit pre-death state so reaction emotes render before removal
        try {
          if (deadNow.length > 0 && typeof onStep === 'function') {
            onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'preDeath' } });
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
                const m = ev.source.match(/^(p[12]Board)\[(\d+)\]$/);
                if (m) {
                  const srcBoardName = m[1];
                  const srcIndex = Number(m[2]);
                  const srcArr = srcBoardName === 'p1Board' ? cP1 : cP2;
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
                  }
                }
              }
            } catch (e) {}
          } catch (e) {}
        });

        try {
          if (deadNow.length > 0 && typeof onStep === 'function') {
            onStep({ p1Board: cloneArr(cP1), p2Board: cloneArr(cP2), p1Reserve: cloneArr(cR1), p2Reserve: cloneArr(cR2), priorityPlayer, lastAction: { type: 'deathApplied' } });
          }
        } catch (e) {}

        // After marking deaths, check main boards (reserves excluded) for a game end
        try {
          const aliveP1 = (cP1 || []).some(t => t && t.hero && !t._dead);
          const aliveP2 = (cP2 || []).some(t => t && t.hero && !t._dead);
          if (!aliveP1 && aliveP2) { gameWinner = 'player2'; addLog && addLog('Game end detected: player2 wins (no alive heroes on player1 main board)'); }
          else if (!aliveP2 && aliveP1) { gameWinner = 'player1'; addLog && addLog('Game end detected: player1 wins (no alive heroes on player2 main board)'); }
          else if (!aliveP1 && !aliveP2) { gameWinner = 'draw'; addLog && addLog('Game end detected: draw (no alive heroes on either main board)'); }
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
      pendingCasts = collectSpellCasts(cP1, cP2, cR1, cR2).filter(pc => !(pc.payload && typeof pc.payload.queuedId !== 'undefined' && processedQueuedIds.has(pc.payload.queuedId)));
      if (pendingCasts.length > 0) addLog && addLog(`Found ${pendingCasts.length} pending cast(s) after re-collect`);
    } catch (e) {}
  }

  // (Death processing handled immediately after each cast now.)

  // Tick down effect durations and remove expired only on main boards; reserves remain inert
  [cP1, cP2].forEach(arr => {
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
      const aliveP1 = (cP1 || []).some(t => t && t.hero && !t._dead);
      const aliveP2 = (cP2 || []).some(t => t && t.hero && !t._dead);
      if (!aliveP1 && aliveP2) gameWinner = 'player2';
      else if (!aliveP2 && aliveP1) gameWinner = 'player1';
      else if (!aliveP1 && !aliveP2) gameWinner = 'draw';
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
    winner: gameWinner
  };
}

export default {
  executeRound
};
