// src/tower/TowerBattle.jsx
// Battle wrapper for Tower of Shattered Champions mode

import React, { useState, useCallback, useEffect, useRef } from 'react';
import BattlePhase from '../BattlePhase.jsx';
import { HEROES } from '../heroes.js';
import { createOfflineSocket } from '../offline/LocalGameEngine.js';
import { makeEmptyMain, makeReserve } from '../../shared/gameLogic.js';
import { towerPositionToIndex, indexToRow } from '../targeting.js';
import { 
  generateEnemyTeam, 
  generateBossLevel, 
  getPlayerHeroesForBattle,
  generateAugmentChoices,
  advanceLevel,
  completeLevel,
  saveTowerRun,
  isBossLevel,
  registerBossSpells
} from './towerState.js';
import { SPELLS } from '../spells.js';
import getAssetPath from '../utils/assetPath.js';
import TowerAugmentChoice from './TowerAugmentChoice.jsx';
import TowerRecruitChoice from './TowerRecruitChoice.jsx';

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0d0015',
    backgroundImage: `url(${getAssetPath('/images/background/TowerBackground.png')})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  },
  levelBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: 'linear-gradient(180deg, rgba(13, 0, 21, 0.95) 0%, transparent 100%)',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  levelInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  levelNumber: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#fff',
    textShadow: '0 0 10px #8b5cf6'
  },
  bossIndicator: {
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
    animation: 'pulse 2s infinite'
  },
  towerName: {
    fontSize: '0.9rem',
    color: '#a78bfa'
  },
  defeatScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #1a0a2e 0%, #0d0015 100%)',
    color: '#fff',
    padding: '20px'
  },
  defeatTitle: {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '16px',
    textShadow: '0 0 30px #dc2626',
    color: '#ef4444'
  },
  defeatSubtitle: {
    fontSize: '1.3rem',
    color: '#9ca3af',
    marginBottom: '30px'
  },
  defeatStats: {
    display: 'flex',
    gap: '30px',
    marginBottom: '40px'
  },
  defeatStat: {
    textAlign: 'center'
  },
  defeatStatValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#fff'
  },
  defeatStatLabel: {
    fontSize: '0.9rem',
    color: '#6b7280'
  },
  button: {
    padding: '16px 40px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.5)',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase'
  },
  victoryScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #1a0a2e 0%, #0d0015 100%)',
    color: '#fff',
    padding: '20px'
  },
  victoryTitle: {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '16px',
    textShadow: '0 0 30px #fbbf24',
    color: '#f59e0b'
  }
};

// Battle phases
const PHASE = {
  PRE_BATTLE: 'pre_battle',
  BATTLE: 'battle',
  AUGMENT_CHOICE: 'augment_choice',
  RECRUIT_CHOICE: 'recruit_choice',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  TOWER_COMPLETE: 'tower_complete'
};

export default function TowerBattle({ runState: initialRunState, onExit, onRunStateChange }) {
  const [phase, setPhase] = useState(() => (
    (Array.isArray(initialRunState?.pendingAugmentChoice) && initialRunState.pendingAugmentChoice.length > 0)
      ? PHASE.AUGMENT_CHOICE
      : (initialRunState?.pendingRecruitChoice ? PHASE.RECRUIT_CHOICE : PHASE.PRE_BATTLE)
  ));
  const [runState, setRunState] = useState(initialRunState);
  const [battleData, setBattleData] = useState(null);
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const socketRef = useRef(null);
  const battleEndHandledRef = useRef(false);

  // Ensure boss spells are registered in the global spell registry
  useEffect(() => {
    try { registerBossSpells(SPELLS); } catch (e) {}
  }, []);

  // Create local socket for battle
  useEffect(() => {
    const localSocket = createOfflineSocket();
    socketRef.current = localSocket;
    setSocket(localSocket);

    localSocket.on('gameState', (state) => {
      
      setGameState(state);
    });

    return () => {
      if (localSocket) {
        localSocket.close();
      }
    };
  }, []);

  // Detect game over from gameState and auto-advance
  useEffect(() => {
    if (phase !== PHASE.BATTLE || battleEndHandledRef.current) return;
    if (!gameState || !gameState.lastAction) return;
    
    const lastAction = gameState.lastAction;
    const winner = lastAction.winner || (lastAction.type === 'gameEnd' ? lastAction.winner : null);
    
    if (winner) {
      battleEndHandledRef.current = true;
      // Small delay to let player see the final state
      setTimeout(() => {
        handleBattleEnd(winner);
      }, 2000);
    }
  }, [gameState, phase]);

  // Reset battleEndHandled when starting a new battle
  useEffect(() => {
    if (phase === PHASE.PRE_BATTLE) {
      battleEndHandledRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (onRunStateChange) {
      onRunStateChange(runState);
    }
  }, [runState, onRunStateChange]);

  // Setup battle when entering pre-battle phase and socket is ready
  useEffect(() => {
    if (phase === PHASE.PRE_BATTLE && socket && runState) {
      prepareBattle();
    }
  }, [phase, socket, runState]);

  const prepareBattle = () => {
    if (!socket) return;
    
    const level = runState.currentLevel;
    const isBoss = isBossLevel(level);

    const applyTowerEffectsToTile = (tile) => {
      if (!tile || !tile.hero) return;
      const towerEffects = tile.hero._towerEffects;
      if (!Array.isArray(towerEffects) || towerEffects.length === 0) return;

      const basePassives = (tile.hero && Array.isArray(tile.hero.passives))
        ? tile.hero.passives.map(e => (e ? { ...e } : e))
        : [];

      if (!tile._passives) {
        tile._passives = basePassives.filter(Boolean);
      }

      towerEffects.forEach(effect => {
        if (!effect) return;
        const cloned = { ...effect };
        if (cloned.kind === 'passive') {
          tile._passives = tile._passives || [];
          tile._passives.push(cloned);
          return;
        }
        tile.effects = tile.effects || [];
        tile.effects.push(cloned);
      });
    };

    // Get player heroes with augments applied
    const playerHeroes = getPlayerHeroesForBattle(runState);

    const applyRowAugments = (tile, battleIndex) => {
      if (!tile || !tile.hero) return;
      const row = indexToRow(battleIndex, 'p1'); // 0=front,1=middle,2=back
      if (row === 0 && tile.hero._towerFrontlineVanguard) {
        if (tile.hero.spells?.front) tile.hero.spells.front.casts += 1;
        tile.hero.energy = (tile.hero.energy || 0) + 1;
        tile.hero.currentEnergy = (tile.hero.currentEnergy || tile.hero.energy || 0) + 1;
      }
      if (row === 2 && tile.hero._towerRearguard) {
        if (tile.hero.spells?.back) tile.hero.spells.back.casts += 1;
        tile.hero.energy = (tile.hero.energy || 0) + 1;
        tile.hero.currentEnergy = (tile.hero.currentEnergy || tile.hero.energy || 0) + 1;
      }
    };
    
    // Place player heroes according to their stored positions (auto-assign unpositioned heroes)
    // Format: { hero, boardName, index } for main board
    // Format: { id, player, index, hero, type } for reserve slots
    const p1Main = makeEmptyMain('p1');
    const p1Reserve = makeReserve('p1');
    
    let reserveIndex = 0;
    const usedPositions = new Set();
    const unassigned = [];
    runState.selectedHeroes.forEach((heroEntry, index) => {
      const hero = playerHeroes[index];
      if (!hero) return;

      const battleIndex = towerPositionToIndex(heroEntry.position, 'p1');
      if (battleIndex !== null && battleIndex >= 0 && battleIndex < 9 && !usedPositions.has(battleIndex)) {
        // Hero is on the board
        p1Main[battleIndex].hero = { ...hero };
        applyRowAugments(p1Main[battleIndex], battleIndex);
        applyTowerEffectsToTile(p1Main[battleIndex]);
        usedPositions.add(battleIndex);
      } else {
        unassigned.push(hero);
      }
    });

    // Auto-assign remaining heroes to open main slots then reserve
    unassigned.forEach((hero) => {
      if (!hero) return;
      const mainCount = p1Main.filter(t => t && t.hero).length;
      if (mainCount < 5) {
        const openIdx = p1Main.findIndex(t => t && !t.hero);
        if (openIdx >= 0) {
          p1Main[openIdx].hero = { ...hero };
          applyRowAugments(p1Main[openIdx], openIdx);
          applyTowerEffectsToTile(p1Main[openIdx]);
          return;
        }
      }
      if (reserveIndex < 2) {
        p1Reserve[reserveIndex].hero = { ...hero };
        applyTowerEffectsToTile(p1Reserve[reserveIndex]);
        reserveIndex++;
      }
    });
    
    // Generate enemy team
    let enemyData;
    
    if (isBoss) {
      const bossData = generateBossLevel(level);
      // Boss battle - boss in random main-board position
      const p2Main = makeEmptyMain('p2');
      const bossIndex = Math.floor(Math.random() * 9);
      p2Main[bossIndex].hero = bossData.boss;
      if (bossData.boss && Array.isArray(bossData.boss._startingEffects) && bossData.boss._startingEffects.length > 0) {
        p2Main[bossIndex].effects = bossData.boss._startingEffects.map(e => (e ? { ...e } : e)).filter(Boolean);
      }
      applyTowerEffectsToTile(p2Main[bossIndex]);
      // Empty reserve slots for boss
      const p2Reserve = makeReserve('p2');
      enemyData = {
        p2Main,
        p2Reserve,
        difficulty: bossData.difficulty
      };
      setBattleData({
        aiDifficulty: bossData.difficulty,
        level: level,
        isBoss: true,
        bossId: bossData?.bossConfig?.id || null
      });
    } else {
      const teamData = generateEnemyTeam(level);
      // Convert to board format: { hero, boardName, index }
      const p2Main = makeEmptyMain('p2');
      teamData.mainBoard.forEach(entry => {
        const battleIndex = towerPositionToIndex(entry.position, 'p2');
        if (battleIndex !== null && battleIndex >= 0 && battleIndex < 9) {
          p2Main[battleIndex].hero = entry.hero;
          applyTowerEffectsToTile(p2Main[battleIndex]);
        }
      });
      // Reserve slots for enemy team
      const p2Reserve = makeReserve('p2');
      if (p2Reserve[0]) {
        p2Reserve[0].hero = teamData.reserve?.[0] || null;
        applyTowerEffectsToTile(p2Reserve[0]);
      }
      if (p2Reserve[1]) {
        p2Reserve[1].hero = teamData.reserve?.[1] || null;
        applyTowerEffectsToTile(p2Reserve[1]);
      }
      enemyData = {
        p2Main,
        p2Reserve,
        difficulty: teamData.difficulty
      };
      setBattleData({
        aiDifficulty: teamData.difficulty,
        level: level,
        isBoss: false,
        bossId: null
      });
    }
    // Create game state for the battle
    const battleState = {
      p1Main,
      p1Reserve,
      p2Main: enemyData.p2Main,
      p2Reserve: enemyData.p2Reserve,
      phase: 'battle',
      priorityPlayer: 'player1',
      round: 1
    };

    // Initialize battle via socket
    socket.emit('setTestState', battleState);
    setPhase(PHASE.BATTLE);
  };

  const handleBattleEnd = (result) => {
    // result is 'player1', 'player2', or 'draw'
    // In tower mode, player is always player1
    if (result === 'player1') {
      // Player won
      if (runState.currentLevel >= 100) {
        // Tower complete!
        setPhase(PHASE.TOWER_COMPLETE);
        return;
      }
      if (runState) {
        const nextRun = runState;
        nextRun.pendingBossId = battleData?.isBoss ? (battleData.bossId || null) : null;
        if (!Array.isArray(nextRun.pendingAugmentChoice) || nextRun.pendingAugmentChoice.length === 0) {
          generateAugmentChoices(nextRun);
        } else {
          saveTowerRun(nextRun);
        }
        setRunState(nextRun);
        if (onRunStateChange) onRunStateChange(nextRun);
      }
      // Advance to augment choice
      setPhase(PHASE.AUGMENT_CHOICE);
    } else {
      // Player lost or draw (treat draw as loss for tower)
      setPhase(PHASE.DEFEAT);
    }
  };

  const handleAugmentConfirm = (updatedRun) => {
    // After augment, proceed to recruit
    const nextRun = { ...updatedRun, pendingRecruitChoice: true };
    saveTowerRun(nextRun);
    setRunState(nextRun);
    setPhase(PHASE.RECRUIT_CHOICE);
  };

  const handleAugmentSkip = (currentRun) => {
    // Proceed to recruit even if augment is skipped
    const nextRun = { ...currentRun, pendingRecruitChoice: true };
    saveTowerRun(nextRun);
    setRunState(nextRun);
    setPhase(PHASE.RECRUIT_CHOICE);
  };

  const handleAugmentExit = (currentRun) => {
    // Save progress and keep recruit pending for next session
    const nextRun = { ...currentRun, pendingRecruitChoice: true };
    saveTowerRun(nextRun);
    if (onExit) onExit();
  };

  const handleRecruitConfirm = (updatedRun) => {
    const bossId = battleData?.isBoss ? (battleData.bossId || null) : (updatedRun?.pendingBossId || null);
    const nextRun = bossId ? completeLevel(updatedRun, bossId) : advanceLevel(updatedRun);
    saveTowerRun(nextRun);
    const nextRunState = { ...nextRun };
    setRunState(nextRunState);
    setPhase(PHASE.PRE_BATTLE);
  };

  const handleRecruitSkip = (currentRun) => {
    const bossId = battleData?.isBoss ? (battleData.bossId || null) : (currentRun?.pendingBossId || null);
    const nextRun = bossId ? completeLevel(currentRun, bossId) : advanceLevel(currentRun);
    saveTowerRun(nextRun);
    const nextRunState = { ...nextRun };
    setRunState(nextRunState);
    setPhase(PHASE.PRE_BATTLE);
  };

  const handleRecruitExit = (currentRun = runState) => {
    const nextRun = { ...currentRun, pendingRecruitChoice: true };
    saveTowerRun(nextRun);
    if (onExit) onExit();
  };

  const handleExitToMenu = () => {
    if (onExit) onExit();
  };

  // Render based on phase
  if (phase === PHASE.BATTLE && battleData && socket && gameState) {
    return (
      <div style={styles.container}>
        {/* Level banner overlay */}
        <div style={styles.levelBanner}>
          <div style={styles.levelInfo}>
            <div style={styles.levelNumber}>Level {battleData.level}</div>
            {battleData.isBoss && (
              <div style={styles.bossIndicator}>⚔️ BOSS</div>
            )}
          </div>
          <div style={styles.towerName}>Tower of Shattered Champions</div>
        </div>

        {/* The actual battle component */}
        <BattlePhase
          gameState={gameState}
          socket={socket}
          onGameEnd={handleBattleEnd}
          aiDifficulty={battleData.aiDifficulty}
          autoPlay={true}
          showReturnToMenu={false}
        />
      </div>
    );
  }

  if (phase === PHASE.AUGMENT_CHOICE) {
    return (
      <TowerAugmentChoice
        runState={runState}
        onConfirm={handleAugmentConfirm}
        onSkip={handleAugmentSkip}
        onExit={handleAugmentExit}
      />
    );
  }

  if (phase === PHASE.RECRUIT_CHOICE) {
    return (
      <TowerRecruitChoice
        runState={runState}
        onConfirm={handleRecruitConfirm}
        onSkip={handleRecruitSkip}
        onExit={handleRecruitExit}
      />
    );
  }

  if (phase === PHASE.DEFEAT) {
    // Calculate total augments from selectedHeroes structure
    const totalAugments = (runState.selectedHeroes || []).reduce(
      (sum, entry) => sum + (entry?.augments?.length || 0), 
      0
    );

    return (
      <div style={styles.defeatScreen}>
        <h1 style={styles.defeatTitle}>💀 Defeat</h1>
        <p style={styles.defeatSubtitle}>Your champions have fallen at Level {runState.currentLevel}</p>
        
        <div style={styles.defeatStats}>
          <div style={styles.defeatStat}>
            <div style={styles.defeatStatValue}>{runState.currentLevel - 1}</div>
            <div style={styles.defeatStatLabel}>Levels Cleared</div>
          </div>
          <div style={styles.defeatStat}>
            <div style={styles.defeatStatValue}>{totalAugments}</div>
            <div style={styles.defeatStatLabel}>Augments Earned</div>
          </div>
          <div style={styles.defeatStat}>
            <div style={styles.defeatStatValue}>{Math.floor((runState.currentLevel - 1) / 5)}</div>
            <div style={styles.defeatStatLabel}>Bosses Defeated</div>
          </div>
        </div>

        <button style={styles.button} onClick={handleExitToMenu}>
          Return to Tower Menu
        </button>
      </div>
    );
  }

  if (phase === PHASE.TOWER_COMPLETE) {
    // Calculate total augments from selectedHeroes structure
    const totalAugments = (runState.selectedHeroes || []).reduce(
      (sum, entry) => sum + (entry?.augments?.length || 0), 
      0
    );

    return (
      <div style={styles.victoryScreen}>
        <h1 style={styles.victoryTitle}>🏆 Tower Conquered!</h1>
        <p style={{ fontSize: '1.3rem', color: '#a78bfa', marginBottom: '30px' }}>
          Your champions have conquered all 100 levels!
        </p>
        
        <div style={styles.defeatStats}>
          <div style={styles.defeatStat}>
            <div style={styles.defeatStatValue}>100</div>
            <div style={styles.defeatStatLabel}>Levels Cleared</div>
          </div>
          <div style={styles.defeatStat}>
            <div style={styles.defeatStatValue}>{totalAugments}</div>
            <div style={styles.defeatStatLabel}>Augments Earned</div>
          </div>
          <div style={styles.defeatStat}>
            <div style={styles.defeatStatValue}>20</div>
            <div style={styles.defeatStatLabel}>Bosses Defeated</div>
          </div>
        </div>

        <button style={styles.button} onClick={handleExitToMenu}>
          Return to Tower Menu
        </button>
      </div>
    );
  }

  // Loading/preparing battle
  return (
    <div style={styles.defeatScreen}>
      <div style={{ fontSize: '1.5rem', color: '#a78bfa' }}>
        Preparing Level {runState.currentLevel}...
      </div>
    </div>
  );
}
