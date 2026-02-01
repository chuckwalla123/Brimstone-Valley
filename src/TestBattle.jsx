import React, { useMemo, useState, useEffect } from "react";
import io from 'socket.io-client';
import BattlePhase from "./BattlePhase";
import { HEROES } from "./heroes.js";
import { SPELLS } from "./spells.js";
import { makeEmptyMain, makeReserve } from "../shared/gameLogic.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';

export default function TestBattle() {
  // Build boards for testing: Two Fire Golems on each board
  const { p1Main, p1Reserve, p2Main, p2Reserve } = useMemo(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const p1Main = makeEmptyMain('p1');
    const p2Main = makeEmptyMain('p2');
    const p1Reserve = makeReserve('p1');
    const p2Reserve = makeReserve('p2');

    // Debug: list available hero ids to ensure our new hero is present at runtime
    try {
      console.log('Available HEROES ids:', (HEROES || []).map(h => h.id));
    } catch (e) {
      console.error('Error listing HEROES ids', e);
    }
    const fireGolem = HEROES.find(h => h.id === 'fireGolemID');

    if (fireGolem) {
      // Clone and set stats for p1 Fire Golems
      const p1FireGolem1 = clone(fireGolem);
      p1FireGolem1.currentHealth = fireGolem.health;
      p1FireGolem1.currentEnergy = fireGolem.energy;
      p1FireGolem1.currentSpeed = fireGolem.speed;
      p1FireGolem1.currentArmor = fireGolem.armor;
      p1FireGolem1.currentSpellPower = fireGolem.spellPower || 0;

      const p1FireGolem2 = clone(fireGolem);
      p1FireGolem2.currentHealth = fireGolem.health;
      p1FireGolem2.currentEnergy = fireGolem.energy;
      p1FireGolem2.currentSpeed = fireGolem.speed;
      p1FireGolem2.currentArmor = fireGolem.armor;
      p1FireGolem2.currentSpellPower = fireGolem.spellPower || 0;

      // Clone and set stats for p2 Fire Golems
      const p2FireGolem1 = clone(fireGolem);
      p2FireGolem1.currentHealth = fireGolem.health;
      p2FireGolem1.currentEnergy = fireGolem.energy;
      p2FireGolem1.currentSpeed = fireGolem.speed;
      p2FireGolem1.currentArmor = fireGolem.armor;
      p2FireGolem1.currentSpellPower = fireGolem.spellPower || 0;

      const p2FireGolem2 = clone(fireGolem);
      p2FireGolem2.currentHealth = fireGolem.health;
      p2FireGolem2.currentEnergy = fireGolem.energy;
      p2FireGolem2.currentSpeed = fireGolem.speed;
      p2FireGolem2.currentArmor = fireGolem.armor;
      p2FireGolem2.currentSpellPower = fireGolem.spellPower || 0;

      // Place Fire Golems on p1 board (positions 0 and 1)
      p1Main[0].hero = p1FireGolem1;
      p1Main[1].hero = p1FireGolem2;

      // Place Fire Golems on p2 board (positions 0 and 1)
      p2Main[0].hero = p2FireGolem1;
      p2Main[1].hero = p2FireGolem2;
    }

    return { p1Main, p1Reserve, p2Main, p2Reserve };
  }, []);

  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Connect to server
    const newSocket = io(SERVER_URL);

    // Create initial gameState with the lancer boards
    const initialGameState = {
      p1Main,
      p1Reserve,
      p2Main,
      p2Reserve,
      availableHeroes: HEROES,
      bans: [],
      step: 0,
      roundNumber: 0,
      phase: 'battle',
      priorityPlayer: 'player1'
    };

    // Seed local state immediately so refresh doesn't stall rendering
    setGameState(initialGameState);
    setSocket(newSocket);

    // Wait for connection, then send test state
    newSocket.on('connect', () => {
      console.log('Connected');
      console.log('Emitting setTestState');
      // Debug: print which hero ids are being placed on each board before emitting
      try {
        console.log('Initial p1Main hero ids:', (initialGameState.p1Main || []).map(t => t?.hero?.id || null));
        console.log('Initial p2Main hero ids:', (initialGameState.p2Main || []).map(t => t?.hero?.id || null));
        console.log('Initial p1Main hero names:', (initialGameState.p1Main || []).map(t => t?.hero?.name || null));
        console.log('Initial p2Main hero names:', (initialGameState.p2Main || []).map(t => t?.hero?.name || null));
      } catch (e) {
        console.error('Error logging initialGameState before emit', e);
      }
      newSocket.emit('setTestState', initialGameState);
    });

    // Then listen to gameState
    newSocket.on('gameState', (state) => {
      console.log('Received game state:', state);      
      // Log hero health
      if (state.p1Main) {
        state.p1Main.forEach((tile, idx) => {
          if (tile?.hero?.name === 'Lancer' || tile?.hero?.name === 'Fallen Angel' || tile?.hero?.name === 'Fire Golem') {
            console.log(`[P1 ${tile.hero.name} at ${idx}] HP: ${tile.currentHealth}/${tile.hero.health}, Dead: ${tile._dead}`);
            console.log('  _passives:', tile._passives);
            console.log('  hero.passives:', tile.hero?.passives);
            if (tile._passives && tile._passives.length > 0) {
              tile._passives.forEach((p, i) => {
                console.log(`  Passive ${i}:`, p?.name, 'used:', p?._used, 'full:', p);
              });
            }
          }
        });
      }
      if (state.p2Main) {
        state.p2Main.forEach((tile, idx) => {
          if (tile?.hero?.name === 'Lancer' || tile?.hero?.name === 'Fallen Angel' || tile?.hero?.name === 'Fire Golem') {
            console.log(`[P2 ${tile.hero.name} at ${idx}] HP: ${tile.currentHealth}/${tile.hero.health}, Dead: ${tile._dead}`);
            console.log('  _passives:', tile._passives);
            console.log('  hero.passives:', tile.hero?.passives);
            if (tile._passives && tile._passives.length > 0) {
              tile._passives.forEach((p, i) => {
                console.log(`  Passive ${i}:`, p?.name, 'used:', p?._used, 'full:', p);
              });
            }
          }
        });
      }
            setGameState(state);
    });

    newSocket.on('error', (msg) => {
      console.error('Server error:', msg);
    });

    return () => newSocket.close();
  }, [p1Main, p1Reserve, p2Main, p2Reserve]);

  const handleGameEnd = (result) => {
    if (result === "player1") alert("Test game: Player 1 wins");
    else if (result === "player2") alert("Test game: Player 2 wins");
    else alert("Test game: draw");
  };

  const handleResetTestBattle = () => {
    if (!socket) return;
    console.log('Resetting test battle');
    const initialGameState = {
      p1Main,
      p1Reserve,
      p2Main,
      p2Reserve,
      availableHeroes: HEROES,
      bans: [],
      step: 0,
      roundNumber: 0,
      phase: 'battle',
      priorityPlayer: 'player1'
    };
    console.log('[TestBattle] Sending test state with priorityPlayer:', initialGameState.priorityPlayer);
    socket.emit('setTestState', initialGameState);
  };

  if (!gameState || !socket) {
    return <div>Loading test battle...</div>;
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8, fontWeight: 700 }}>Test: Two Fire Golems on each side</div>
      <button onClick={handleResetTestBattle} style={{ marginBottom: 8 }}>Reset Test Battle</button>
      {console.debug && console.debug('TestBattle boards', { p1Main, p1Reserve, p2Main, p2Reserve })}
      <BattlePhase
        gameState={gameState}
        socket={socket}
        onGameEnd={handleGameEnd}
        aiDifficulty={null}
        autoPlay={true}
      />
    </div>
  );
}

function getSpellDef(spellId) {
  return (spellId && SPELLS && SPELLS[spellId]) ? SPELLS[spellId] : null;
}

function heroHasAnimatedSpell(hero) {
  if (!hero || !hero.spells) return false;
  const slots = [hero.spells.front, hero.spells.middle, hero.spells.back].filter(Boolean);
  return slots.some(slot => {
    const def = getSpellDef(slot.id);
    return !!(def && (def.animation || def.animationSecondary));
  });
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandomHeroes(pool, count) {
  if (!pool.length) return [];
  const result = [];
  let available = shuffle(pool);
  while (result.length < count) {
    if (!available.length) available = shuffle(pool);
    result.push(available.shift());
  }
  return result;
}

function pickRandomIndices(count, max = 9) {
  const indices = shuffle(Array.from({ length: max }).map((_, i) => i));
  return indices.slice(0, count);
}

export function makeRandomAnimatedBoards() {
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const p1Main = makeEmptyMain('p1');
  const p2Main = makeEmptyMain('p2');
  const p1Reserve = makeEmptyReserve('p1');
  const p2Reserve = makeEmptyReserve('p2');

  const animatedPool = (HEROES || []).filter(h => heroHasAnimatedSpell(h));
  if (!animatedPool.length) return { p1Main, p1Reserve, p2Main, p2Reserve, p1Ids: [], p2Ids: [] };

  const p1Heroes = pickRandomHeroes(animatedPool, 5);
  const p2Heroes = pickRandomHeroes(animatedPool, 5);

  const p1Slots = pickRandomIndices(5, 9);
  const p2Slots = pickRandomIndices(5, 9);

  p1Heroes.forEach((hero, i) => {
    const slot = p1Slots[i];
    const h = clone(hero);
    h.currentHealth = hero.health;
    p1Main[slot].hero = h;
  });

  p2Heroes.forEach((hero, i) => {
    const slot = p2Slots[i];
    const h = clone(hero);
    h.currentHealth = hero.health;
    p2Main[slot].hero = h;
  });

  return {
    p1Main,
    p1Reserve,
    p2Main,
    p2Reserve,
    p1Ids: p1Heroes.map(h => h.id),
    p2Ids: p2Heroes.map(h => h.id),
  };
}