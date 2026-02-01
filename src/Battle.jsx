import React from 'react';
import BattlePhase from './BattlePhase';

/**
 * Battle.jsx - Production battle component
 * Wraps BattlePhase with autoPlay enabled for the real game experience
 */
export default function Battle({ p1Main = [], p1Reserve = [], p2Main = [], p2Reserve = [], onGameEnd, aiDifficulty = null }) {
  return (
    <BattlePhase
      p1Main={p1Main}
      p1Reserve={p1Reserve}
      p2Main={p2Main}
      p2Reserve={p2Reserve}
      onGameEnd={onGameEnd}
      autoPlay={true}
      aiDifficulty={aiDifficulty}
    />
  );
}
