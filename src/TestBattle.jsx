import React, { useMemo, useState, useEffect } from "react";
import io from 'socket.io-client';
import BattlePhase from "./BattlePhase";
import { HEROES } from "./heroes.js";
import { SPELLS } from "./spells.js";
import { makeEmptyMain, makeReserve } from "../shared/gameLogic.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';
const draftableHeroes = HEROES.filter(hero => hero && hero.draftable !== false);

export default function TestBattle() {
  // Build boards for testing: 2 Witch Doctors + 1 Lancer on each side, no reserves
  const { p1Main, p1Reserve, p2Main, p2Reserve } = useMemo(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const p1Main = makeEmptyMain('p1');
    const p2Main = makeEmptyMain('p2');
    const p1Reserve = makeReserve('p1');
    const p2Reserve = makeReserve('p2');

    try {
      console.log('Available HEROES ids:', (HEROES || []).map(h => h.id));
    } catch (e) {
      console.error('Error listing HEROES ids', e);
    }

    const witchDoctor = HEROES.find(h => h.id === 'witchDoctorID');
    const lancer = HEROES.find(h => h.id === 'lancerID');
    

    if (witchDoctor && lancer) {
      const prepare = (hero) => {
        const h = clone(hero);
        h.currentHealth = hero.health;
        h.currentEnergy = hero.energy;
        h.currentSpeed = hero.speed;
        h.currentArmor = hero.armor;
        h.currentSpellPower = hero.spellPower || 0;
        return h;
      };

      p1Main[0].hero = prepare(witchDoctor);
      p1Main[1].hero = prepare(witchDoctor);
      p1Main[2].hero = prepare(lancer);

      p2Main[0].hero = prepare(witchDoctor);
      p2Main[1].hero = prepare(witchDoctor);
      p2Main[2].hero = prepare(lancer);
    } else {
      console.warn('Required heroes not found; test placement skipped.', { witchDoctor: !!witchDoctor, lancer: !!lancer });
    }

    return { p1Main, p1Reserve, p2Main, p2Reserve };
  }, []);

  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Connect to server
    const newSocket = io(SERVER_URL);

    // Create initial gameState with mirrored Witch Doctor + Lancer test boards
    const initialGameState = {
      p1Main,
      p1Reserve,
      p2Main,
      p2Reserve,
      availableHeroes: draftableHeroes,
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
      // Log hero health for Knight
      if (state.p1Main) {
        state.p1Main.forEach((tile, idx) => {
          const name = tile?.hero?.name;
          if (name === 'Knight') {
            console.log(`[P1 ${name} at ${idx}] HP: ${tile.currentHealth}/${tile.hero.health}, Dead: ${tile._dead}`);
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
          const name = tile?.hero?.name;
          if (name === 'Knight') {
            console.log(`[P2 ${name} at ${idx}] HP: ${tile.currentHealth}/${tile.hero.health}, Dead: ${tile._dead}`);
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
      availableHeroes: draftableHeroes,
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
      <div style={{ marginBottom: 8, fontWeight: 700 }}>Test: 2 Witch Doctors + 1 Lancer per side</div>
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
  const p1Reserve = makeReserve('p1');
  const p2Reserve = makeReserve('p2');

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