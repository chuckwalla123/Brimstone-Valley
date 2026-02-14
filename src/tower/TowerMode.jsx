// src/tower/TowerMode.jsx
// Main Tower mode orchestrator component

import React, { useState, useEffect } from 'react';
import TowerMenu from './TowerMenu.jsx';
import TowerHeroDraft from './TowerHeroDraft.jsx';
import TowerTeamView from './TowerTeamView.jsx';
import TowerBattle from './TowerBattle.jsx';
import musicManager from '../MusicManager.js';
import { 
  loadTowerRun, 
  saveTowerRun, 
  createNewRun, 
  clearTowerRun,
  hasActiveRun,
  isBossLevel
} from './towerState.js';

// Tower mode screens
const SCREEN = {
  MENU: 'menu',
  DRAFT: 'draft',
  TEAM_VIEW: 'team_view',
  BATTLE: 'battle'
};

export default function TowerMode({ onExit }) {
  const [screen, setScreen] = useState(SCREEN.MENU);
  const [runState, setRunState] = useState(null);

  // Load existing run on mount
  useEffect(() => {
    const existingRun = loadTowerRun();
    if (existingRun) {
      setRunState(existingRun);
    }
  }, []);

  // Tower-specific music control
  useEffect(() => {
    let musicPhase = 'menu';

    if (screen === SCREEN.DRAFT) {
      musicPhase = 'draft';
    } else if (screen === SCREEN.BATTLE) {
      const level = runState?.currentLevel || 0;
      musicPhase = isBossLevel(level) ? 'bossBattle' : 'battle';
    }

    musicManager.playPhase(musicPhase);
  }, [screen, runState]);

  // Menu handlers
  const handleContinueRun = () => {
    // selectedHeroes is array of { heroId, augments: [...] }
    if (runState && Array.isArray(runState.selectedHeroes) && runState.selectedHeroes.length >= 1) {
      setScreen(SCREEN.BATTLE);
    } else if (runState) {
      // Has run but no team selected yet, go to draft
      setScreen(SCREEN.DRAFT);
    }
  };

  const handleNewRun = () => {
    const newRun = createNewRun();
    saveTowerRun(newRun);
    setRunState(newRun);
    setScreen(SCREEN.DRAFT);
  };

  const handleAbandonRun = () => {
    clearTowerRun();
    setRunState(null);
    // Stay on menu, will now show "Start New Run" option
  };

  const handleViewTeam = () => {
    if (runState) {
      setScreen(SCREEN.TEAM_VIEW);
    }
  };

  // Draft handlers
  const handleDraftBack = () => {
    clearTowerRun();
    setRunState(null);
    setScreen(SCREEN.MENU);
  };

  const handleDraftConfirm = (updatedRun) => {
    saveTowerRun(updatedRun);
    setRunState(updatedRun);
    setScreen(SCREEN.BATTLE);
  };

  // Team view handler
  const handleTeamViewBack = () => {
    setScreen(SCREEN.MENU);
  };

  // Battle handlers
  const handleBattleExit = () => {
    // Reload run state in case it changed
    const currentRun = loadTowerRun();
    setRunState(currentRun);
    setScreen(SCREEN.MENU);
  };

  const handleRunStateChange = (nextRunState) => {
    setRunState(nextRunState);
  };

  // Render appropriate screen
  switch (screen) {
    case SCREEN.DRAFT:
      return (
        <TowerHeroDraft
          runState={runState}
          onBack={handleDraftBack}
          onConfirm={handleDraftConfirm}
        />
      );

    case SCREEN.TEAM_VIEW:
      return (
        <TowerTeamView
          runState={runState}
          onBack={handleTeamViewBack}
        />
      );

    case SCREEN.BATTLE:
      return (
        <TowerBattle
          runState={runState}
          onExit={handleBattleExit}
          onRunStateChange={handleRunStateChange}
        />
      );

    case SCREEN.MENU:
    default:
      return (
        <TowerMenu
          runState={runState}
          onContinue={handleContinueRun}
          onNewRun={handleNewRun}
          onAbandon={handleAbandonRun}
          onViewTeam={handleViewTeam}
          onExit={onExit}
        />
      );
  }
}
