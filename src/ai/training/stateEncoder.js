/**
 * State Encoder for Neural Network
 * 
 * Converts game state into a fixed-size tensor suitable for neural network input.
 * 
 * State Representation:
 * - Board slots (5 main + 2 reserve per player) × 2 players = 14 slots
 * - Per slot: hero one-hot + stats + spells + position + effects
 * - Draft state:
 *   - Phase indicator (1 bit: 0=draft, 1=battle)
 *   - Available heroes pool (38 bits: binary present/absent)
 *   - P1 picked heroes (7 hero one-hots for main+reserve slots)
 *   - P2 picked heroes (7 hero one-hots for main+reserve slots)
 *   - Current draft turn (normalized 0-1, 0=start, 1=end)
 */

import { HEROES } from '../../heroes.js';
import { SPELLS } from '../../spells.js';

// Create hero ID mapping
const HERO_IDS = HEROES.map(h => h.id);
const HERO_ID_TO_INDEX = {};
HERO_IDS.forEach((id, idx) => {
  HERO_ID_TO_INDEX[id] = idx;
});

// Constants for normalization
const MAX_HP = 20;
const MAX_ARMOR = 10;
const MAX_SPEED = 8;
const MAX_ENERGY = 10;
const MAX_CASTS = 10;

// Feature dimensions
const HERO_ONE_HOT_SIZE = HERO_IDS.length;
const STATS_SIZE = 4; // HP, armor, speed, energy
const SPELL_SIZE = 3; // 3 spell cast counts
const POSITION_SIZE = 4; // front, middle, back, reserve (one-hot)
const EFFECTS_SIZE = 10; // Common effects (shield, regen, stun, etc.)

const FEATURES_PER_SLOT = HERO_ONE_HOT_SIZE + STATS_SIZE + SPELL_SIZE + POSITION_SIZE + EFFECTS_SIZE;
const SLOTS_PER_PLAYER = 11; // 9 main board + 2 reserve
const TOTAL_SLOTS = SLOTS_PER_PLAYER * 2; // 2 players

// Draft and ban state features
const PHASE_SIZE = 3; // One-hot: [ban, draft, battle]
const AVAILABLE_HEROES_SIZE = HERO_IDS.length; // Binary present/absent for each hero
const BANNED_HEROES_SIZE = HERO_IDS.length; // Binary banned/available for each hero
const TURN_COUNTER_SIZE = 1; // Normalized turn counter (works for both ban and draft)

export const STATE_SIZE = 
  TOTAL_SLOTS * FEATURES_PER_SLOT + // Board state
  PHASE_SIZE + // Phase indicator (ban/draft/battle)
  AVAILABLE_HEROES_SIZE + // Available heroes pool
  BANNED_HEROES_SIZE + // Banned heroes
  TURN_COUNTER_SIZE; // Turn counter

/**
 * Encode a single hero slot into a feature vector
 */
function encodeSlot(tile, position) {
  const features = new Array(FEATURES_PER_SLOT).fill(0);
  let offset = 0;
  
  // If no hero, return empty encoding
  if (!tile || !tile.hero || tile._dead) {
    return features;
  }
  
  const hero = tile.hero;
  
  // 1. Hero ID (one-hot)
  const heroIndex = HERO_ID_TO_INDEX[hero.id];
  if (heroIndex !== undefined) {
    features[offset + heroIndex] = 1;
  }
  offset += HERO_ONE_HOT_SIZE;
  
  // 2. Stats (normalized)
  features[offset++] = Math.min(hero.health || 0, MAX_HP) / MAX_HP;
  features[offset++] = Math.min(hero.armor || 0, MAX_ARMOR) / MAX_ARMOR;
  features[offset++] = Math.min(hero.speed || 0, MAX_SPEED) / MAX_SPEED;
  features[offset++] = Math.min(hero.energy || 0, MAX_ENERGY) / MAX_ENERGY;
  
  // 3. Spell casts (normalized)
  if (hero.spells) {
    const positions = ['front', 'middle', 'back'];
    for (const pos of positions) {
      const spell = hero.spells[pos];
      features[offset++] = spell ? Math.min(spell.casts || 0, MAX_CASTS) / MAX_CASTS : 0;
    }
  } else {
    offset += 3;
  }
  
  // 4. Position (one-hot)
  const posIndex = position === 'front' ? 0 : position === 'middle' ? 1 : position === 'back' ? 2 : 3;
  features[offset + posIndex] = 1;
  offset += POSITION_SIZE;
  
  // 5. Effects (binary flags)
  // Common effects: shield, regen, stun, burn, poison, etc.
  if (hero.effects) {
    if (hero.effects.some(e => e.type === 'shield')) features[offset] = 1;
    if (hero.effects.some(e => e.type === 'regeneration')) features[offset + 1] = 1;
    if (hero.effects.some(e => e.type === 'stun')) features[offset + 2] = 1;
    if (hero.effects.some(e => e.type === 'burn')) features[offset + 3] = 1;
    if (hero.effects.some(e => e.type === 'poison')) features[offset + 4] = 1;
    if (hero.effects.some(e => e.type === 'armor')) features[offset + 5] = 1;
    if (hero.effects.some(e => e.type === 'speed')) features[offset + 6] = 1;
    if (hero.effects.some(e => e.type === 'energy')) features[offset + 7] = 1;
    // Reserve slots for future effects
  }
  offset += EFFECTS_SIZE;
  
  return features;
}

/**
 * Get position label for a board index
 * Board layout: 3x3 grid (9 tiles) + 2 reserve
 * 0-2: Front row (L, C, R)
 * 3-5: Middle row (L, C, R)
 * 6-8: Back row (L, C, R)
 * 9-10: Reserve
 */
function getPosition(index) {
  if (index >= 9) return 'reserve';
  const row = Math.floor(index / 3);
  if (row === 0) return 'front';
  if (row === 1) return 'middle';
  return 'back';
}

/**
 * Encode the full game state into a tensor
 * 
 * @param {Object} state - Game state with p1Board, p1Reserve, p2Board, p2Reserve, plus optional draft info
 * @returns {Float32Array} Encoded state vector
 */
export function encodeState(state) {
  const { 
    p1Board = [], 
    p1Reserve = [], 
    p2Board = [], 
    p2Reserve = [],
    phase = 'battle', // 'ban', 'draft', or 'battle'
    availableHeroes = [], // Array of hero IDs still available
    bannedHeroes = [], // Array of hero IDs that have been banned
    banTurn = 0, // Current turn in ban phase
    maxBanTurns = 4, // Total ban turns
    draftTurn = 0, // Current turn in draft (0-13)
    maxDraftTurns = 14 // Total draft turns (14 picks: 7 per player)
  } = state;
  
  const features = [];
  
  // Encode P1's board (9 main + 2 reserve)
  for (let i = 0; i < 9; i++) {
    const tile = p1Board[i];
    const position = getPosition(i);
    features.push(...encodeSlot(tile, position));
  }
  for (let i = 0; i < 2; i++) {
    const tile = p1Reserve[i];
    features.push(...encodeSlot(tile, 'reserve'));
  }
  
  // Encode P2's board (9 main + 2 reserve)
  for (let i = 0; i < 9; i++) {
    const tile = p2Board[i];
    const position = getPosition(i);
    features.push(...encodeSlot(tile, position));
  }
  for (let i = 0; i < 2; i++) {
    const tile = p2Reserve[i];
    features.push(...encodeSlot(tile, 'reserve'));
  }
  
  // Phase indicator (one-hot: [draft, battle]) - removed separate ban phase
  features.push(phase === 'draft' ? 1 : 0);
  features.push(phase === 'battle' ? 1 : 0);
  features.push(0); // Placeholder for backwards compatibility
  
  // Available heroes pool (binary: 1 if available, 0 if picked/banned)
  for (const heroId of HERO_IDS) {
    features.push(availableHeroes.includes(heroId) ? 1 : 0);
  }
  
  // Banned heroes (binary: 1 if banned, 0 otherwise)
  for (const heroId of HERO_IDS) {
    features.push(bannedHeroes.includes(heroId) ? 1 : 0);
  }
  
  // Turn progress (normalized 0-1)
  let turnCount = draftTurn || 0;
  let maxTurns = state.maxDraftTurns || 28;
  features.push(maxTurns > 0 ? turnCount / maxTurns : 1);
  
  return new Float32Array(features);
}

/**
 * Encode a move into a single integer (action index)
 * 
 * Action space:
 * - 0-120: Movement actions (from_slot * 11 + to_slot, where slots are 0-10: 9 main + 2 reserve)
 * - 121: Noop action
 * - 122+: Draft pick to position (hero_index * 11 + slot_index, 30 heroes × 11 slots = 330 actions)
 * - End: Ban hero (30 ban actions)
 * 
 * Total action space: 121 movement + 1 noop + (heroes*11) draft+position + heroes ban
 */
export const ACTION_SPACE_SIZE = 121 + 1 + (HERO_IDS.length * SLOTS_PER_PLAYER) + HERO_IDS.length;
export const BAN_ACTION_OFFSET = 121 + 1 + (HERO_IDS.length * SLOTS_PER_PLAYER); // Ban actions start after movement and draft actions

export function encodeAction(move) {
  if (!move) {
    return 121; // noop action
  }
  
  // Ban action
  if (move.type === 'ban') {
    const heroIndex = HERO_ID_TO_INDEX[move.heroId];
    if (heroIndex === undefined) return 121; // Invalid hero
    return BAN_ACTION_OFFSET + heroIndex;
  }
  
  // Draft action (now includes position)
  if (move.type === 'draft') {
    const heroIndex = HERO_ID_TO_INDEX[move.heroId];
    if (heroIndex === undefined) return 121; // Invalid hero
    const slotIndex = move.slotIndex !== undefined ? move.slotIndex : 0;
    return 122 + (heroIndex * SLOTS_PER_PLAYER) + slotIndex; // Draft actions: hero * 11 + slot
  }
  
  // Noop action
  if (move.type === 'noop') {
    return 121;
  }
  
  // Movement action
  return move.from * SLOTS_PER_PLAYER + move.to;
}

/**
 * Decode an action index back into a move object
 */
export function decodeAction(actionIndex) {
  // Noop
  if (actionIndex === 121) {
    return { type: 'noop', from: -1, to: -1 };
  }
  
  // Ban action
  if (actionIndex >= BAN_ACTION_OFFSET && actionIndex < BAN_ACTION_OFFSET + HERO_IDS.length) {
    const heroIndex = actionIndex - BAN_ACTION_OFFSET;
    return {
      type: 'ban',
      heroId: HERO_IDS[heroIndex],
      heroIndex
    };
  }
  
  // Draft action with position (122+: 30 heroes × 11 slots)
  if (actionIndex >= 122 && actionIndex < 122 + (HERO_IDS.length * SLOTS_PER_PLAYER)) {
    const offsetIndex = actionIndex - 122;
    const heroIndex = Math.floor(offsetIndex / SLOTS_PER_PLAYER);
    const slotIndex = offsetIndex % SLOTS_PER_PLAYER;
    return {
      type: 'draft',
      heroId: HERO_IDS[heroIndex],
      heroIndex,
      slotIndex
    };
  }
  
  // Movement action (0-120)
  const from = Math.floor(actionIndex / SLOTS_PER_PLAYER);
  const to = actionIndex % SLOTS_PER_PLAYER;
  
  return {
    type: from < 9 && to < 9 ? (from === to ? 'noop' : 'swap') : 'move',
    from,
    to
  };
}

/**
 * Get action mask (which actions are legal in current state)
 * 
 * @param {Object} state - Game state
 * @param {boolean} isP2 - Whether this is P2's turn
 * @returns {Float32Array} Binary mask (1 = legal, 0 = illegal)
 */
export function getActionMask(state, isP2) {
  const mask = new Float32Array(ACTION_SPACE_SIZE).fill(0);
  
  // If in draft phase, check expected action type
  if (state.phase === 'draft') {
    const availableHeroes = state.availableHeroes || [];
    
    // If expected action is ban, return ban mask
    if (state.expectedActionType === 'ban') {
      let bannedCount = 0;
      for (const heroId of availableHeroes) {
        const heroIndex = HERO_ID_TO_INDEX[heroId];
        if (heroIndex !== undefined) {
          mask[BAN_ACTION_OFFSET + heroIndex] = 1;
          bannedCount++;
        }
      }
      return mask;
    }
    
    // Otherwise (pick), return pick+position mask for available heroes and empty slots
    const board = isP2 ? state.p2Board : state.p1Board;
    const reserve = isP2 ? state.p2Reserve : state.p1Reserve;
    
    // Count current heroes on main board
    const mainCount = board.filter(t => t && t.hero && !t._dead).length;
    
    // Find empty slots (9 main board tiles + 2 reserve)
    const emptySlots = [];
    for (let i = 0; i < 9; i++) {
      // Allow drafting to any empty main board slot as long as total won't exceed 5
      if (!board[i] || !board[i].hero) {
        // Only allow this slot if adding a hero here won't exceed 5 on main board
        if (mainCount < 5) {
          emptySlots.push(i);
        }
      }
    }
    for (let i = 0; i < 2; i++) {
      if (!reserve[i] || !reserve[i].hero) emptySlots.push(9 + i);
    }
    
    // Mark all combinations of available heroes + empty slots
    for (const heroId of availableHeroes) {
      const heroIndex = HERO_ID_TO_INDEX[heroId];
      if (heroIndex !== undefined) {
        for (const slotIndex of emptySlots) {
          mask[122 + (heroIndex * SLOTS_PER_PLAYER) + slotIndex] = 1; // Mark draft+position as legal
        }
      }
    }
    
    return mask;
  }
  
  // If in ban phase (old code path for compatibility), only ban actions are legal
  if (state.phase === 'ban') {
    const availableHeroes = state.availableHeroes || [];
    for (const heroId of availableHeroes) {
      const heroIndex = HERO_ID_TO_INDEX[heroId];
      if (heroIndex !== undefined) {
        mask[BAN_ACTION_OFFSET + heroIndex] = 1;
      }
    }
    return mask;
  }
  
  // Battle phase: movement actions only
  const board = isP2 ? state.p2Board : state.p1Board;
  const reserve = isP2 ? state.p2Reserve : state.p1Reserve;
  
  const mainCount = board.filter(t => t && t.hero && !t._dead).length;
  const reserveCount = reserve.filter(t => t && t.hero && !t._dead).length;

  // Generate legal moves (11 slots: 9 main board + 2 reserve)
  let legalCount = 0;
  for (let from = 0; from < SLOTS_PER_PLAYER; from++) {
    const fromTile = from < 9 ? board[from] : reserve[from - 9];
    const hasHeroAtFrom = fromTile && fromTile.hero && !fromTile._dead;
    
    if (!hasHeroAtFrom && from < 9) continue; // Can't move empty main slot
    
    for (let to = 0; to < SLOTS_PER_PLAYER; to++) {
      if (from === to) continue; // Can't move to same slot
      
      const toTile = to < 9 ? board[to] : reserve[to - 9];
      const hasHeroAtTo = toTile && toTile.hero && !toTile._dead;
      
      // Can always swap
      if (hasHeroAtFrom && hasHeroAtTo) {
        mask[from * SLOTS_PER_PLAYER + to] = 1;
        legalCount++;
        continue;
      }
      
      // Can move from reserve to empty main if main board isn't full (max 5 heroes)
      if (from >= 9 && to < 9 && !hasHeroAtTo && mainCount < 5 && hasHeroAtFrom) {
        mask[from * SLOTS_PER_PLAYER + to] = 1;
        legalCount++;
        continue;
      }
      
      // Can move on main board to empty slot
      if (from < 9 && to < 9 && hasHeroAtFrom && !hasHeroAtTo) {
        mask[from * SLOTS_PER_PLAYER + to] = 1;
        legalCount++;
      }
    }
  }
  
    // Noop is always legal
    mask[121] = 1;
    legalCount++;
    
    return mask;
  }
