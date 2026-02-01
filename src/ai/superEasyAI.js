/**
 * Super Easy AI - Makes completely random decisions
 * Used for beginners to learn the game mechanics
 */

/**
 * Makes a random ban decision during draft phase
 * @param {Array} availableHeroes - List of heroes that can be banned
 * @returns {Object} The hero to ban, or null if no heroes available
 */
export const makeBanDecision = (availableHeroes) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * availableHeroes.length);
  return availableHeroes[randomIndex];
};

/**
 * Makes a random pick decision during draft phase
 * @param {Array} availableHeroes - List of heroes that can be picked
 * @param {Array} playerBoard - The AI's current board state
 * @returns {Object} { hero, slotIndex } or null if no valid pick
 */
export const makePickDecision = (availableHeroes, playerBoard) => {
  if (!availableHeroes || availableHeroes.length === 0) return null;
  if (!playerBoard || playerBoard.length === 0) return null;
  
  // Find empty slots
  const emptySlots = playerBoard
    .map((slot, idx) => ({ slot, idx }))
    .filter(s => !s.slot.hero);
  
  if (emptySlots.length === 0) return null;
  
  // Pick random hero
  const randomHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
  
  // Pick random empty slot
  const randomSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
  
  return {
    hero: randomHero,
    slotIndex: randomSlot.idx
  };
};

/**
 * Makes a random movement decision during battle phase
 * Returns a noop (same source/dest) if no valid move is found.
 * @param {Array} p2Board - P2's main board (3x3 = 9 tiles)
 * @param {Array} p2ReserveBoard - P2's reserve board (2 tiles)
 * @param {Object} movement - Movement hook with phase info and methods
 * @param {Array} p1Board - P1's main board (unused by super easy, but kept for signature consistency)
 * @param {Array} p1ReserveBoard - P1's reserve board (unused by super easy, but kept for signature consistency)
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
    // Ultimate fallback
    return { sourceId: 'p2:0', destinationId: 'p2:0' };
  };

  if (!movement || !movement.movementPhase) {
    console.log('[SuperEasyAI] No movement phase, returning noop');
    return getNoopMove();
  }
  
  const phase = movement.movementPhase;
  const currentMover = phase.sequence[phase.index];
  
  // Only make decisions for P2
  if (currentMover !== 'p2') {
    console.log('[SuperEasyAI] Not P2 turn, returning noop');
    return getNoopMove();
  }
  
  // Validate boards
  if (!p2Board || !Array.isArray(p2Board)) return getNoopMove();
  if (!p2ReserveBoard || !Array.isArray(p2ReserveBoard)) return getNoopMove();
  
  // Get all P2 tiles with heroes (main board: indices 0-8, reserve: indices 0-1)
  const tilesWithHeroes = [];
  
  // Main board tiles
  p2Board.forEach((tile, idx) => {
    if (tile && tile.hero && !tile._dead) {
      tilesWithHeroes.push({
        tile,
        idx,
        boardName: 'p2Board',
        sourceId: `p2:${idx}`
      });
    }
  });
  
  // Reserve board tiles
  p2ReserveBoard.forEach((tile, idx) => {
    if (tile && tile.hero && !tile._dead) {
      tilesWithHeroes.push({
        tile,
        idx,
        boardName: 'p2Reserve',
        sourceId: `p2Reserve:${idx}`
      });
    }
  });

  if (tilesWithHeroes.length === 0) {
    console.log('[SuperEasyAI] No movable heroes, returning noop');
    return getNoopMove();
  }

  // Pick a random hero to move
  const randomHero = tilesWithHeroes[Math.floor(Math.random() * tilesWithHeroes.length)];
  
  // Get all possible destination tiles (all tiles on P2's side)
  const allP2TileIds = [
    ...p2Board.map((_, i) => `p2:${i}`),
    ...p2ReserveBoard.map((_, i) => `p2Reserve:${i}`)
  ];
  
  // Pick a random destination
  const randomDest = allP2TileIds[Math.floor(Math.random() * allP2TileIds.length)];
  
  console.log('[SuperEasyAI] Returning move:', randomHero.sourceId, '->', randomDest);
  return {
    sourceId: randomHero.sourceId,
    destinationId: randomDest
  };
};

/**
 * Gets the thinking delay for this AI difficulty (in milliseconds)
 * This makes the AI feel more natural by adding a slight pause
 */
export const getThinkingDelay = () => {
  return 1000; // 1 second for super easy
};
