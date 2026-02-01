import React, { useState, useCallback, useEffect } from 'react';

// movement.jsx
// Exports a hook `useMovement` that encapsulates the movement phase logic,
// and a small MovementPanel component bound to the hook state.
//
// Usage (in BattlePhase.jsx):
// const movement = useMovement({ p1Board, p2Board, p1Reserve, p2Reserve, setP1Board, setP2Board, setP1ReserveBoard, setP2ReserveBoard, priorityPlayer, setPriorityPlayer, addLog, setGameState });
// Then inside TileView use movement.canDrag(tile) and movement.onDragStart/onDrop handlers.
// Render movement.UI where you prefer: {movement.UI && <movement.UI />}

export function useMovement({
  p1Board, p2Board, p1Reserve, p2Reserve,
  setP1Board, setP2Board, setP1ReserveBoard, setP2ReserveBoard,
  priorityPlayer, setPriorityPlayer, addLog, setGameState,
  aiDifficulty,
  localSide,
  serverMovementPhase,
  onServerMove
}) {
  // Client no longer maintains local movement state - server is fully authoritative
  // Use serverMovementPhase directly instead of mirroring it
  const movementPhase = serverMovementPhase;

  // helper to map 'player1'/'player2' -> 'p1'/'p2'
  const toShort = (p) => (p === 'player1' || p === 'player1' ? 'p1' : (p === 'player2' ? 'p2' : p));

  // find tile by id across all boards
  const findTileById = useCallback((tileId) => {
    // Support tokens like:
    //  - 'p1:2' -> main board index 2
    //  - 'p1:reserve:0' -> reserve index 0
    //  - explicit board keys: 'p1Reserve', 'p2Reserve', etc.
    if (typeof tileId === 'string' && tileId.includes(':')) {
      const parts = tileId.split(':');
      // p1:2  -> parts = ['p1','2']
      // p1:reserve:0 -> parts = ['p1','reserve','0']
      if (parts.length === 2) {
        const [p, i] = parts;
        const idx = parseInt(i, 10);
        if (!isNaN(idx)) {
          // Allow legacy-style reserve tokens like 'p2Reserve:0'
          const plow = String(p || '').toLowerCase();
          if (plow === 'p1') return { boardName: 'p1Board', index: idx, tile: (p1Board || [])[idx] };
          if (plow === 'p2') return { boardName: 'p2Board', index: idx, tile: (p2Board || [])[idx] };
          if (plow === 'p1reserve' || plow === 'p1_reserve') return { boardName: 'p1Reserve', index: idx, tile: (p1Reserve || [])[idx] };
          if (plow === 'p2reserve' || plow === 'p2_reserve') return { boardName: 'p2Reserve', index: idx, tile: (p2Reserve || [])[idx] };
        }
      } else if (parts.length === 3) {
        const [p, kind, i] = parts;
        const idx = parseInt(i, 10);
        if (!isNaN(idx) && kind === 'reserve') {
          if (p === 'p1') return { boardName: 'p1Reserve', index: idx, tile: (p1Reserve || [])[idx] };
          if (p === 'p2') return { boardName: 'p2Reserve', index: idx, tile: (p2Reserve || [])[idx] };
        }
      }
    }
    let idx = (p1Board || []).findIndex(t => t && t.id === tileId);
    if (idx !== -1) return { boardName: 'p1Board', index: idx, tile: p1Board[idx] };
    idx = (p2Board || []).findIndex(t => t && t.id === tileId);
    if (idx !== -1) return { boardName: 'p2Board', index: idx, tile: p2Board[idx] };
    idx = (p1Reserve || []).findIndex(t => t && t.id === tileId);
    if (idx !== -1) return { boardName: 'p1Reserve', index: idx, tile: p1Reserve[idx] };
    idx = (p2Reserve || []).findIndex(t => t && t.id === tileId);
    if (idx !== -1) return { boardName: 'p2Reserve', index: idx, tile: p2Reserve[idx] };
    return null;
  }, [p1Board, p2Board, p1Reserve, p2Reserve]);

  // swap "contents" of two tile positions (hero + dynamic fields)
  const swapTileContents = useCallback((boardA, idxA, boardB, idxB) => {
    // create copies
    const copyP1 = [...(p1Board || [])];
    const copyP2 = [...(p2Board || [])];
    const copyR1 = [...(p1Reserve || [])];
    const copyR2 = [...(p2Reserve || [])];

    const getBoardRef = (name) => {
      if (name === 'p1Board') return copyP1;
      if (name === 'p2Board') return copyP2;
      if (name === 'p1Reserve') return copyR1;
      return copyR2;
    };

    const Aboard = getBoardRef(boardA);
    const Bboard = getBoardRef(boardB);
    // Swap the entire tile objects so visual identity (dead/alive, id, effects) moves with the tile.
    const tmp = Aboard[idxA];
    Aboard[idxA] = Bboard[idxB];
    Bboard[idxB] = tmp;

    setP1Board(copyP1);
    setP2Board(copyP2);
    setP1ReserveBoard(copyR1);
    setP2ReserveBoard(copyR2);
  }, [p1Board, p2Board, p1Reserve, p2Reserve, setP1Board, setP2Board, setP1ReserveBoard, setP2ReserveBoard]);

  // high-level swap by tile ids - always send to server when in online mode
  const handleSwapById = useCallback((sourceId, targetId) => {
    if (!movementPhase) return;
    
    // Check if either tile is shackled (has preventMovement effect)
    const src = findTileById(sourceId);
    const dst = findTileById(targetId);
    
    if (src && src.tile && src.tile.effects && Array.isArray(src.tile.effects)) {
      const srcHasShackle = src.tile.effects.some(e => e && e.preventMovement);
      if (srcHasShackle) {
        addLog && addLog('[Movement] Cannot move shackled tile!');
        return;
      }
    }
    
    if (dst && dst.tile && dst.tile.effects && Array.isArray(dst.tile.effects)) {
      const dstHasShackle = dst.tile.effects.some(e => e && e.preventMovement);
      if (dstHasShackle) {
        addLog && addLog('[Movement] Cannot swap with shackled tile!');
        return;
      }
    }
    
    // In online mode, always send move to server
    if (onServerMove) {
      onServerMove(sourceId, targetId);
      return;
    }
    
    // Fallback: local swap for AI games (no server needed)
    if (!src || !dst) return;
    
    swapTileContents(src.boardName, src.index, dst.boardName, dst.index);
    
    // Update movement phase index
    const nextIndex = movementPhase.index + 1;
    if (nextIndex >= movementPhase.sequence.length) {
      // Movement complete
      const nextPrio = (priorityPlayer === 'player1' || priorityPlayer === 'p1') ? 'player2' : 'player1';
      setPriorityPlayer(nextPrio);
      setGameState('ready');
      addLog && addLog('[Movement] Movement phase complete, switching to ready');
    }
  }, [movementPhase, onServerMove, findTileById, swapTileContents, priorityPlayer, setPriorityPlayer, setGameState, addLog]);

  // drag/drop helpers exposed to BattlePhase/TileView:
  const canDrag = useCallback((tile) => {
    if (!movementPhase || !tile) return false;
    
    // Check if tile has preventMovement effect (Shackle)
    if (tile.effects && Array.isArray(tile.effects)) {
      const hasShackle = tile.effects.some(e => e && e.preventMovement);
      if (hasShackle) {
        return false; // Cannot drag shackled tiles
      }
    }
    
    const mover = movementPhase.sequence[movementPhase.index]; // 'p1' or 'p2'
    const p = tile.player;
    const ps = String(p).toLowerCase();
    let owner;
    if (ps === 'p1' || ps === 'player1' || ps === '1') owner = 'p1';
    else if (ps === 'p2' || ps === 'player2' || ps === '2') owner = 'p2';
    else owner = ps.includes('1') ? 'p1' : 'p2';
    
    // Block dragging P2 pieces when playing against AI
    if (aiDifficulty && owner === 'p2') {
      return false;
    }

    // Block dragging opponent pieces in online mode
    if (localSide && owner !== localSide) {
      return false;
    }
    
    return mover === owner;
  }, [movementPhase, aiDifficulty, localSide]);

  const onDragStart = useCallback((e, tileId) => {
    if (!movementPhase) { e.preventDefault(); return; }
    const dt = e.dataTransfer || (e.nativeEvent && e.nativeEvent.dataTransfer);
    if (!dt) return;
    try { dt.setData('text/plain', tileId); } catch (err) { /* ignore */ }
    dt.effectAllowed = 'move';
  }, [movementPhase]);

  const onDragOver = useCallback((e) => {
    if (!movementPhase) return;
    e.preventDefault();
  }, [movementPhase]);

  const onDrop = useCallback((e, targetId) => {
    if (!movementPhase) return;
    e.preventDefault();
    const dt = e.dataTransfer || (e.nativeEvent && e.nativeEvent.dataTransfer);
    if (!dt) return;
    const srcId = dt.getData && dt.getData('text/plain');
    if (srcId && targetId) {
      // prevent no-op (dropping onto same slot) for player moves
      if (srcId === targetId) {
        addLog && addLog('  > Move cancelled: source and target are the same slot');
        return;
      }
      handleSwapById(srcId, targetId);
    }
  }, [movementPhase, handleSwapById, addLog]);

  // Auto-skip movement (for auto-play mode) - send skip moves to server
  const skipMovement = useCallback(() => {
    if (!movementPhase) return;
    
    // Skip all remaining moves by sending same-tile swaps
    const remaining = movementPhase.sequence.length - movementPhase.index;
    for (let i = 0; i < remaining; i++) {
      const mover = movementPhase.sequence[movementPhase.index + i];
      // Send a dummy move (same source/target) to skip
      const dummyId = `${mover}:0`;
      if (onServerMove) {
        setTimeout(() => onServerMove(dummyId, dummyId), i * 100);
      }
    }
  }, [movementPhase, onServerMove]);

  // Small UI panel (bound to this hook's state)
  const UI = useCallback(() => {
    if (!movementPhase) return null;
    const moverLabel = movementPhase.sequence[movementPhase.index] === 'p1' ? 'Player 1' : 'Player 2';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <div style={{ width: 800, maxWidth: '100%', background: '#fff', borderRadius: 8, padding: 10, boxShadow: '0 1px 0 rgba(0,0,0,0.06)', color: '#111' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 6, color: '#111' }}>Movement Phase</div>
          <div style={{ marginBottom: 6, color: '#111' }}>
            {`Move ${movementPhase.index + 1} of ${movementPhase.sequence.length} — Next mover: ${moverLabel}`}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#444' }}>
            Drag a tile you control onto another tile (or reserve) to swap them. When all moves complete, priority will flip.
          </div>
        </div>
      </div>
    );
  }, [movementPhase]);

  return {
    movementPhase,
    skipMovement,
    canDrag,
    onDragStart,
    onDragOver,
    onDrop,
    handleSwapById,
    UI
  };
}