import React, { useMemo, useState } from 'react';
import BattlePhase from './BattlePhase';
import { HEROES } from './heroes.js';
import { makeEmptyMain, makeReserve, applyHealthDelta } from '../shared/gameLogic.js';

export default function TestBerserker() {
  // Build a simple board to test Undying Rage
  const { p1Main, p1Reserve, p2Main, p2Reserve } = useMemo(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const p1Main = makeEmptyMain('p1');
    const p2Main = makeEmptyMain('p2');
    const p1Reserve = makeReserve('p1');
    const p2Reserve = makeReserve('p2');

    const berserker = HEROES.find(h => h.id === 'berserkerID');
    const archer = HEROES.find(h => h.id === 'archerID');

    if (berserker) {
      const b = clone(berserker);
      // Create tile with hero
      const tile = {
        ...p1Main[4],
        hero: b,
        currentHealth: berserker.health,
        currentEnergy: berserker.energy,
        currentSpeed: berserker.speed,
        currentArmor: berserker.armor,
        currentSpellPower: berserker.spellPower || 0,
        boardName: 'p1Board',
        index: 4
      };
      p1Main[4] = tile;
      console.log('[TestBerserker] Created Berserker tile:', tile);
      console.log('[TestBerserker] Hero passives:', b.passives);
    }

    if (archer) {
      const a = clone(archer);
      const tile = {
        ...p2Main[4],
        hero: a,
        currentHealth: archer.health,
        currentEnergy: 10, // give lots of energy so it will cast
        currentSpeed: archer.speed,
        currentArmor: archer.armor,
        currentSpellPower: archer.spellPower || 0,
        boardName: 'p2Board',
        index: 4
      };
      p2Main[4] = tile;
    }

    return { p1Main, p1Reserve, p2Main, p2Reserve };
  }, []);

  const [gameState, setGameState] = useState({ p1Main, p2Main, p1Reserve, p2Reserve, phase: 'battle', priorityPlayer: 'player1' });

  const simulateLethal = () => {
    // Find the berserker tile and apply a big lethal delta
    const tile = (gameState.p1Main || [])[4];
    if (tile && tile.hero) {
      applyHealthDelta(tile, -999); // should trigger Undying Rage and leave Berserker at 1 HP
      // force re-render by updating state clone
      setGameState(prev => ({ ...prev, p1Main: [...prev.p1Main] }));
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', background: '#1a1a1a', color: '#fff' }}>
        <h2>Berserker Test Battle</h2>
        <p>Testing <strong>Undying Rage</strong> (one-time "survive lethal" passive).</p>
        <ol>
          <li>Click <strong>Simulate Lethal Hit</strong> to attempt to kill Berserker directly.</li>
          <li>Verify Berserker is reduced to 1 HP (passive consumed) rather than dying.</li>
        </ol>
        <button onClick={simulateLethal} style={{ padding: '8px 12px', fontSize: 16 }}>Simulate Lethal Hit</button>
      </div>

      <BattlePhase
        gameState={gameState}
        setGameState={setGameState}
        socket={null}
        playerNames={{ p1: 'Player 1 (Berserker)', p2: 'Player 2 (Test Dummy)' }}
        localSide="p1"
        aiDifficulty={null}
        allowLocalControl={true}
      />
    </div>
  );
}
