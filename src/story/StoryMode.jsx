// src/story/StoryMode.jsx
// Main Relic Hunt mode orchestrator.

import React, { useEffect, useMemo, useState } from 'react';
import StoryMenu from './StoryMenu.jsx';
import StoryTeamSelect from './StoryTeamSelect.jsx';
import StoryMap from './StoryMap.jsx';
import StoryBattle from './StoryBattle.jsx';
import StoryRelicChoice from './StoryRelicChoice.jsx';
import {
  createNewStoryRun,
  loadStoryRun,
  saveStoryRun,
  clearStoryRun,
  getStorySummary,
  setStoryTeam,
  getCurrentNode,
  advanceToNextNode,
  resolveChoice
} from './storyState.js';
import { getStoryArc } from './storyData.js';

const SCREEN = {
  MENU: 'menu',
  TEAM: 'team',
  MAP: 'map',
  BATTLE: 'battle',
  RELIC: 'relic',
  VICTORY: 'victory',
  DEFEAT: 'defeat'
};

export default function StoryMode({ onExit }) {
  const [screen, setScreen] = useState(SCREEN.MENU);
  const [runState, setRunState] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [pendingAdvance, setPendingAdvance] = useState(null);

  useEffect(() => {
    const existing = loadStoryRun();
    if (existing) setRunState(existing);
  }, []);

  const arc = useMemo(() => getStoryArc(runState?.kingdomId), [runState?.kingdomId]);
  const summary = useMemo(() => getStorySummary(runState), [runState]);

  const handleNewRun = (kingdomId) => {
    const created = createNewStoryRun(kingdomId);
    if (!created) return;
    saveStoryRun(created);
    setRunState(created);
    setScreen(SCREEN.TEAM);
  };

  const handleContinue = () => {
    if (!runState) return;
    if (runState.completed) {
      setScreen(SCREEN.VICTORY);
      return;
    }
    if (!Array.isArray(runState.selectedHeroes) || runState.selectedHeroes.length === 0) {
      setScreen(SCREEN.TEAM);
    } else {
      setScreen(SCREEN.MAP);
    }
  };

  const handleAbandon = () => {
    clearStoryRun();
    setRunState(null);
    setScreen(SCREEN.MENU);
  };

  const handleTeamConfirm = (heroSelections) => {
    const updated = setStoryTeam(runState, heroSelections);
    setRunState({ ...updated });
    setScreen(SCREEN.MAP);
  };

  const handleStartBattle = (node) => {
    setActiveNode(node);
    setScreen(SCREEN.BATTLE);
  };

  const handleChoosePath = (nextId) => {
    const updated = resolveChoice(runState, nextId);
    setRunState({ ...updated });
    setScreen(SCREEN.MAP);
  };

  const handleBattleEnd = (winner) => {
    if (!activeNode) return;
    if (winner !== 'player1') {
      setScreen(SCREEN.DEFEAT);
      return;
    }
    const nextIds = Array.isArray(activeNode.next) ? activeNode.next : [];
    const nextId = nextIds.length > 0 ? nextIds[0] : null;
    const isCombatNode = ['battle', 'miniboss', 'boss'].includes(activeNode.type);
    const shouldOfferRelic = isCombatNode || activeNode.reward === 'relic';

    if (shouldOfferRelic) {
      setPendingAdvance({ nodeId: activeNode.id, nextId });
      setScreen(SCREEN.RELIC);
      return;
    }

    const updated = advanceToNextNode(runState, activeNode.id, nextId);
    setRunState({ ...updated });
    if (!nextId) {
      setScreen(SCREEN.VICTORY);
    } else {
      setScreen(SCREEN.MAP);
    }
  };

  const handleRelicConfirm = (updatedRun) => {
    if (!pendingAdvance) {
      setRunState({ ...updatedRun });
      setScreen(SCREEN.MAP);
      return;
    }
    const { nodeId, nextId } = pendingAdvance;
    const updated = advanceToNextNode(updatedRun, nodeId, nextId);
    setPendingAdvance(null);
    setRunState({ ...updated });
    if (!nextId) {
      setScreen(SCREEN.VICTORY);
    } else {
      setScreen(SCREEN.MAP);
    }
  };

  const handleRelicExit = () => {
    saveStoryRun(runState);
    setScreen(SCREEN.MENU);
  };

  const handleRetry = () => {
    setScreen(SCREEN.MAP);
  };

  if (screen === SCREEN.MENU) {
    return (
      <StoryMenu
        runState={runState}
        summary={summary}
        onContinue={handleContinue}
        onNewRun={handleNewRun}
        onClear={handleAbandon}
        onExit={onExit}
      />
    );
  }

  if (screen === SCREEN.TEAM) {
    return (
      <StoryTeamSelect
        arc={arc}
        onConfirm={handleTeamConfirm}
        onBack={() => setScreen(SCREEN.MENU)}
      />
    );
  }

  if (screen === SCREEN.MAP) {
    return (
      <StoryMap
        arc={arc}
        runState={runState}
        onStartBattle={handleStartBattle}
        onChoosePath={handleChoosePath}
        onExit={() => setScreen(SCREEN.MENU)}
      />
    );
  }

  if (screen === SCREEN.BATTLE) {
    return (
      <StoryBattle
        runState={runState}
        node={activeNode || getCurrentNode(runState)}
        onBattleEnd={handleBattleEnd}
      />
    );
  }

  if (screen === SCREEN.RELIC) {
    return (
      <StoryRelicChoice
        runState={runState}
        onConfirm={handleRelicConfirm}
        onExit={handleRelicExit}
      />
    );
  }

  if (screen === SCREEN.DEFEAT) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(180deg, #140b22 0%, #0b0713 100%)' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 10 }}>Defeat</h1>
        <p style={{ color: '#d9c4a6', marginBottom: 20 }}>Your expedition has fallen. Regroup and try again.</p>
        <button style={{ padding: '12px 22px', borderRadius: 10, border: 'none', fontWeight: 'bold', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', color: '#1b0f07' }} onClick={handleRetry}>
          Return to Map
        </button>
      </div>
    );
  }

  if (screen === SCREEN.VICTORY) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(180deg, #140b22 0%, #0b0713 100%)', padding: '20px' }}>
        <h1 style={{ fontSize: '2.4rem', marginBottom: 10 }}>Relic Claimed</h1>
        {(arc?.outro || []).map((line, idx) => (
          <div key={idx} style={{ color: '#d9c4a6', maxWidth: 800, textAlign: 'center', marginBottom: 8 }}>{line}</div>
        ))}
        <button style={{ marginTop: 18, padding: '12px 22px', borderRadius: 10, border: 'none', fontWeight: 'bold', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', color: '#1b0f07' }} onClick={onExit}>
          Return to Menu
        </button>
      </div>
    );
  }

  return null;
}
