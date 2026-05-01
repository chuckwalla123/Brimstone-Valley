// src/story/StoryMode.jsx
// Main Relic Hunt mode orchestrator.

import React, { useEffect, useMemo, useState } from 'react';
import StoryMenu from './StoryMenu.jsx';
import StoryTeamSelect from './StoryTeamSelect.jsx';
import StoryMap from './StoryMap.jsx';
import StoryBattle from './StoryBattle.jsx';
import StoryRelicChoice from './StoryRelicChoice.jsx';
import StoryRecruitChoice from './StoryRecruitChoice.jsx';
import StoryGuestSelect from './StoryGuestSelect.jsx';
import StoryRosterTransition from './StoryRosterTransition.jsx';
import {
  createNewStoryRun,
  loadStoryRun,
  saveStoryRun,
  clearStoryRun,
  getStorySummary,
  setStoryPartySelections,
  setStoryTeam,
  getStoryMercenaryChoices,
  replaceStoryPartyHero,
  getCurrentNode,
  advanceToNextNode,
  resolveChoice
} from './storyState.js';
import { getStoryArc } from './storyData.js';

const SCREEN = {
  MENU: 'menu',
  TEAM: 'team',
  MAP: 'map',
  GUEST: 'guest',
  ROSTER: 'roster',
  BATTLE: 'battle',
  RELIC: 'relic',
  RECRUIT: 'recruit',
  VICTORY: 'victory',
  DEFEAT: 'defeat'
};

export default function StoryMode({ onExit }) {
  const [screen, setScreen] = useState(SCREEN.MENU);
  const [runState, setRunState] = useState(null);
  const [draftRunState, setDraftRunState] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [pendingAdvance, setPendingAdvance] = useState(null);
  const [guestAssignment, setGuestAssignment] = useState(null);
  const [pendingRosterEvent, setPendingRosterEvent] = useState(null);

  useEffect(() => {
    const existing = loadStoryRun();
    if (existing) setRunState(existing);
  }, []);

  const arc = useMemo(() => getStoryArc(runState?.kingdomId), [runState?.kingdomId]);
  const teamArc = useMemo(() => getStoryArc((draftRunState || runState)?.kingdomId), [draftRunState, runState]);
  const summary = useMemo(() => getStorySummary(runState), [runState]);

  const handleNewRun = (kingdomId) => {
    const created = createNewStoryRun(kingdomId);
    if (!created) return;
    setDraftRunState(created);
    setPendingRosterEvent(null);
    setGuestAssignment(null);
    setScreen(SCREEN.TEAM);
  };

  const handleContinue = () => {
    if (!runState) return;
    if (pendingAdvance && !pendingAdvance.nextId && Array.isArray(runState.pendingRecruitChoice) && runState.pendingRecruitChoice.length > 0) {
      const updated = setStoryPartySelections(runState, runState.selectedHeroes || []);
      finalizePendingAdvance(updated);
      return;
    }
    if (pendingAdvance && Array.isArray(runState.pendingRecruitChoice) && runState.pendingRecruitChoice.length > 0) {
      setScreen(SCREEN.RECRUIT);
      return;
    }
    if (pendingAdvance && Array.isArray(runState.pendingRelicChoice) && runState.pendingRelicChoice.length > 0) {
      setScreen(SCREEN.RELIC);
      return;
    }
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
    setDraftRunState(null);
    setPendingRosterEvent(null);
    setGuestAssignment(null);
    setScreen(SCREEN.MENU);
  };

  const handleTeamConfirm = (heroSelections) => {
    const baseRunState = draftRunState || runState;
    if (!baseRunState) return;
    const updated = setStoryTeam(baseRunState, heroSelections);
    saveStoryRun(updated);
    setRunState({ ...updated });
    setDraftRunState(null);
    setScreen(SCREEN.MAP);
  };

  const routeToBattleStart = (node) => {
    if (node?.guestHero?.heroId) {
      setScreen(SCREEN.GUEST);
      return;
    }
    setScreen(SCREEN.BATTLE);
  };

  const buildRosterEvent = (node, phase, sourceRunState = runState) => {
    const config = phase === 'pre_battle' ? node?.preBattleRosterEvent : node?.postRelicRosterEvent;
    if (!config || !sourceRunState) return null;

    if (config.mode === 'choose_incoming') {
      const outgoingExists = (sourceRunState.selectedHeroes || []).some(entry => entry?.heroId === config.outgoingHeroId);
      if (!outgoingExists) return null;
      const mercChoices = getStoryMercenaryChoices(
        sourceRunState,
        config.choiceCount || 3,
        config.excludeHeroIds || []
      );
      if (!mercChoices.length) return null;
      return {
        ...config,
        id: `${node.id}-${phase}-${config.outgoingHeroId}`,
        phase,
        nodeId: node.id,
        incomingChoices: mercChoices.map(hero => hero.id)
      };
    }

    if (config.mode === 'choose_outgoing') {
      const incomingAlreadyPresent = (sourceRunState.selectedHeroes || []).some(entry => entry?.heroId === config.incomingHeroId);
      if (incomingAlreadyPresent) return null;
      const blockedIds = new Set(config.excludedOutgoingHeroIds || []);
      const eligibleOutgoing = (sourceRunState.selectedHeroes || []).filter(
        entry => entry?.heroId && entry.heroId !== config.incomingHeroId && !blockedIds.has(entry.heroId)
      );
      if (!eligibleOutgoing.length) return null;
      return {
        ...config,
        id: `${node.id}-${phase}-${config.incomingHeroId}`,
        phase,
        nodeId: node.id
      };
    }

    return null;
  };

  const handleStartBattle = (node) => {
    setActiveNode(node);
    setGuestAssignment(null);
    const rosterEvent = buildRosterEvent(node, 'pre_battle');
    if (rosterEvent) {
      setPendingRosterEvent(rosterEvent);
      setScreen(SCREEN.ROSTER);
      return;
    }
    routeToBattleStart(node);
  };

  const handleGuestConfirm = (selection) => {
    setGuestAssignment(selection);
    setScreen(SCREEN.BATTLE);
  };

  const handleRosterEventConfirm = (selectedHeroId) => {
    if (!pendingRosterEvent || !selectedHeroId) return;

    const updated = pendingRosterEvent.mode === 'choose_incoming'
      ? replaceStoryPartyHero(runState, pendingRosterEvent.outgoingHeroId, selectedHeroId)
      : replaceStoryPartyHero(runState, selectedHeroId, pendingRosterEvent.incomingHeroId);

    setRunState({ ...updated });
    const completedEvent = pendingRosterEvent;
    setPendingRosterEvent(null);

    if (completedEvent.phase === 'pre_battle') {
      routeToBattleStart(activeNode || getCurrentNode(updated));
      return;
    }

    finalizePendingAdvance(updated);
  };

  const handleChoosePath = (nextId) => {
    const updated = resolveChoice(runState, nextId);
    setRunState({ ...updated });
    setScreen(SCREEN.MAP);
  };

  const handleBattleEnd = (winner) => {
    if (!activeNode) return;
    setGuestAssignment(null);
    setPendingRosterEvent(null);
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

  const finalizePendingAdvance = (updatedRun) => {
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

  const handleRelicConfirm = (updatedRun) => {
    setRunState({ ...updatedRun });
    if (pendingAdvance && !pendingAdvance.nextId) {
      finalizePendingAdvance(updatedRun);
      return;
    }
    const rosterEvent = buildRosterEvent(activeNode, 'post_relic', updatedRun);
    if (rosterEvent) {
      setPendingRosterEvent(rosterEvent);
      setScreen(SCREEN.ROSTER);
      return;
    }
    setScreen(SCREEN.RECRUIT);
  };

  const handleRecruitConfirm = (updatedRun) => {
    finalizePendingAdvance(updatedRun);
  };

  const handleRecruitSkip = (updatedRun) => {
    const nextRun = updatedRun || setStoryPartySelections(runState, runState?.selectedHeroes || []);
    finalizePendingAdvance(nextRun);
  };

  const handleRelicExit = () => {
    setGuestAssignment(null);
    setPendingRosterEvent(null);
    saveStoryRun(runState);
    setScreen(SCREEN.MENU);
  };

  const handleRetry = () => {
    setGuestAssignment(null);
    setPendingRosterEvent(null);
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
        arc={teamArc}
        showOverwriteWarning={Boolean(draftRunState && runState)}
        onConfirm={handleTeamConfirm}
        onBack={() => {
          setDraftRunState(null);
          setScreen(SCREEN.MENU);
        }}
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

  if (screen === SCREEN.GUEST) {
    return (
      <StoryGuestSelect
        runState={runState}
        node={activeNode || getCurrentNode(runState)}
        onConfirm={handleGuestConfirm}
        onBack={() => setScreen(SCREEN.MAP)}
      />
    );
  }

  if (screen === SCREEN.ROSTER) {
    return (
      <StoryRosterTransition
        runState={runState}
        event={pendingRosterEvent}
        onConfirm={handleRosterEventConfirm}
        onBack={() => setScreen(pendingRosterEvent?.phase === 'pre_battle' ? SCREEN.MAP : SCREEN.MENU)}
      />
    );
  }

  if (screen === SCREEN.BATTLE) {
    return (
      <StoryBattle
        runState={runState}
        node={activeNode || getCurrentNode(runState)}
        guestAssignment={guestAssignment}
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

  if (screen === SCREEN.RECRUIT) {
    return (
      <StoryRecruitChoice
        runState={runState}
        onConfirm={handleRecruitConfirm}
        onSkip={handleRecruitSkip}
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
