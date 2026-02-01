import React, { useMemo, useState, useEffect } from "react";
import io from 'socket.io-client';
import BattlePhase from "./BattlePhase";
import { HEROES } from "./heroes.js";
import { SPELLS } from "./spells.js";
import { makeEmptyMain, makeReserve } from "../shared/gameLogic.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';

export default function TestBoardAxeman() {
  // Build boards for testing: Two Axemen vs Two Axemen
  const { p1Main, p1Reserve, p2Main, p2Reserve } = useMemo(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const p1Main = makeEmptyMain('p1');
    const p2Main = makeEmptyMain('p2');
    const p1Reserve = makeReserve('p1');
    const p2Reserve = makeReserve('p2');

    const axeman = HEROES.find(h => h.id === 'axemanID');

    if (axeman) {
      // Clone and set stats for p1 heroes
      const p1Axeman1 = clone(axeman);
      p1Axeman1.currentHealth = axeman.health;
      p1Axeman1.currentEnergy = axeman.energy;
      p1Axeman1.currentSpeed = axeman.speed;
      p1Axeman1.currentArmor = axeman.armor;
      p1Axeman1.currentSpellPower = axeman.spellPower || 0;

      const p1Axeman2 = clone(axeman);
      p1Axeman2.currentHealth = axeman.health;
      p1Axeman2.currentEnergy = axeman.energy;
      p1Axeman2.currentSpeed = axeman.speed;
      p1Axeman2.currentArmor = axeman.armor;
      p1Axeman2.currentSpellPower = axeman.spellPower || 0;

      // Clone and set stats for p2 heroes
      const p2Axeman1 = clone(axeman);
      p2Axeman1.currentHealth = axeman.health;
      p2Axeman1.currentEnergy = axeman.energy;
      p2Axeman1.currentSpeed = axeman.speed;
      p2Axeman1.currentArmor = axeman.armor;
      p2Axeman1.currentSpellPower = axeman.spellPower || 0;

      const p2Axeman2 = clone(axeman);
      p2Axeman2.currentHealth = axeman.health;
      p2Axeman2.currentEnergy = axeman.energy;
      p2Axeman2.currentSpeed = axeman.speed;
      p2Axeman2.currentArmor = axeman.armor;
      p2Axeman2.currentSpellPower = axeman.spellPower || 0;

      // Place heroes on p1 board (positions 0 and 1)
      p1Main[0].hero = p1Axeman1;
      p1Main[1].hero = p1Axeman2;

      // Place heroes on p2 board (positions 0 and 1)
      p2Main[0].hero = p2Axeman1;
      p2Main[1].hero = p2Axeman2;
    }

    return { p1Main, p1Reserve, p2Main, p2Reserve };
  }, []);

  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Connect to server
    const newSocket = io(SERVER_URL);

    // Create initial gameState with the axeman boards
    const initialGameState = {
      p1Main,
      p1Reserve,
      p2Main,
      p2Reserve,
      availableHeroes: HEROES,
      bans: [],
      step: 0,
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
      newSocket.emit('setTestState', initialGameState);
    });

    // Then listen to gameState
    newSocket.on('gameState', (state) => {
      console.log('Received game state:', state);
      setGameState(state);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [p1Main, p1Reserve, p2Main, p2Reserve]);

  if (!gameState) {
    return <div>Loading...</div>;
  }

  return (
    <BattlePhase
      socket={socket}
      gameState={gameState}
      localSide="player1"
    />
  );
}
