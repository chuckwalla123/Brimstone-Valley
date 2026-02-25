// src/story/StoryBattle.jsx
// Battle wrapper for Relic Hunt story mode.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import BattlePhase from '../BattlePhase.jsx';
import { createOfflineSocket } from '../offline/LocalGameEngine.js';
import { makeEmptyMain, makeReserve } from '../../shared/gameLogic.js';
import { HEROES } from '../heroes.js';
import { towerPositionToIndex } from '../targeting.js';
import { AUGMENTS } from '../tower/augments.js';
import { getStoryEnemyTeam } from './storyEnemies.js';
import { getStoryArc } from './storyData.js';
import getAssetPath from '../utils/assetPath.js';

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0b0713'
  },
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: 'linear-gradient(180deg, rgba(11, 7, 19, 0.95) 0%, transparent 100%)',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bannerTitle: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#f59e0b'
  },
  bannerSubtitle: {
    fontSize: '0.85rem',
    color: '#d9c4a6'
  }
};

export default function StoryBattle({ runState, node, onBattleEnd }) {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [battleSpeedMultiplier] = useState(() => {
    const savedStory = Number(localStorage.getItem('storyBattleSpeedMultiplier') || NaN);
    if (Number.isFinite(savedStory)) return Math.min(4, Math.max(1, savedStory));
    return 1;
  });
  const battleEndHandledRef = useRef(false);
  const autoStartRef = useRef(false);
  const battleStateRef = useRef(null);
  const battleLaunchedRef = useRef(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [sceneActive, setSceneActive] = useState(false);
  const [battleDialogueIndex, setBattleDialogueIndex] = useState(0);
  const [battleDialogueActive, setBattleDialogueActive] = useState(false);
  const [typedText, setTypedText] = useState('');

  const arc = useMemo(() => getStoryArc(runState?.kingdomId), [runState?.kingdomId]);
  const sceneSteps = useMemo(() => {
    if (!arc || !node) return [];
    const steps = [];
    const completedNodes = Array.isArray(runState?.completedNodeIds) ? runState.completedNodeIds : [];
    const isFirstNode = completedNodes.length === 0;
    const narrationLines = [];
    if (isFirstNode && Array.isArray(arc.prologue)) {
      arc.prologue.forEach(line => {
        if (line) narrationLines.push(line);
      });
    }
    if (Array.isArray(node.preBattle)) {
      node.preBattle.forEach(line => {
        if (line) narrationLines.push(line);
      });
    }
    if (narrationLines.length > 0) {
      steps.push({ type: 'narration', lines: narrationLines });
    }
    if (Array.isArray(node.dialogue)) {
      node.dialogue.forEach(entry => {
        if (!entry || !entry.text) return;
        steps.push({
          type: 'dialogue',
          speaker: entry.speaker || 'Unknown',
          side: entry.side || 'left',
          text: entry.text,
          leftPortraits: entry.leftPortraits,
          rightPortraits: entry.rightPortraits
        });
      });
    }
    return steps;
  }, [arc, node, runState?.completedNodeIds]);

  const battleDialogueSteps = useMemo(() => {
    if (!node || !Array.isArray(node.battleDialogue)) return [];
    return node.battleDialogue
      .filter(entry => entry && entry.text)
      .map(entry => ({
        type: 'dialogue',
        speaker: entry.speaker || 'Unknown',
        side: entry.side || 'left',
        text: entry.text,
        leftPortraits: entry.leftPortraits,
        rightPortraits: entry.rightPortraits
      }));
  }, [node]);

  useEffect(() => {
    const localSocket = createOfflineSocket();
    setSocket(localSocket);
    localSocket.on('gameState', (state) => {
      setGameState(state);
    });
    return () => {
      localSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket || !runState || !node) return;
    const enemyTeam = getStoryEnemyTeam(node.enemyTeam);
    if (!enemyTeam) return;

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

    const buildHero = (entry) => {
      const baseHero = HEROES.find(h => h.id === entry.heroId);
      if (!baseHero) return null;
      const hero = JSON.parse(JSON.stringify(baseHero));
      hero.towerNoHealthCap = true;
      hero.currentHealth = hero.health;
      hero.currentEnergy = hero.energy;
      hero.currentSpeed = hero.speed;
      hero.currentArmor = hero.armor;
      hero.currentSpellPower = hero.spellPower || 0;

      hero._towerAugments = Array.isArray(entry.augments)
        ? entry.augments
            .map(augEntry => {
              const augment = AUGMENTS[augEntry?.augmentId];
              if (!augment) return null;
              const value = augEntry?.rolledValue;
              return {
                id: augment.id,
                name: augment.name,
                description: augment.description
                  ? augment.description.replace('{value}', value != null ? value : '')
                  : ''
              };
            })
            .filter(Boolean)
        : [];

      (entry.augments || []).forEach(augEntry => {
        const aug = AUGMENTS[augEntry.augmentId];
        if (!aug || !aug.apply) return;
        const value = augEntry.rolledValue;
        aug.apply(hero, value);
      });
      return hero;
    };

    const p1Main = makeEmptyMain('player1');
    const p1Reserve = makeReserve('player1');
    const p2Main = makeEmptyMain('player2');
    const p2Reserve = makeReserve('player2');

    const playerEntries = runState.selectedHeroes || [];
    const reserveEntries = [];

    playerEntries.forEach(entry => {
      const hero = buildHero(entry);
      if (!hero) return;
      if (entry.position == null) {
        reserveEntries.push(hero);
        return;
      }
      const idx = towerPositionToIndex(entry.position, 'p1');
      if (idx == null || !p1Main[idx]) return;
      p1Main[idx].hero = hero;
      applyTowerEffectsToTile(p1Main[idx]);
    });

    reserveEntries.slice(0, 2).forEach((hero, i) => {
      if (!p1Reserve[i]) return;
      p1Reserve[i].hero = hero;
      applyTowerEffectsToTile(p1Reserve[i]);
    });

    (enemyTeam.main || []).forEach(entry => {
      const hero = buildHero(entry);
      if (!hero) return;
      const idx = towerPositionToIndex(entry.position, 'p2');
      if (idx == null || !p2Main[idx]) return;
      p2Main[idx].hero = hero;
      applyTowerEffectsToTile(p2Main[idx]);
    });

    (enemyTeam.reserve || []).slice(0, 2).forEach((entry, i) => {
      const hero = buildHero(entry);
      if (!hero) return;
      if (!p2Reserve[i]) return;
      p2Reserve[i].hero = hero;
      applyTowerEffectsToTile(p2Reserve[i]);
    });

    const battleState = {
      p1Main,
      p1Reserve,
      p2Main,
      p2Reserve,
      phase: 'battle',
      priorityPlayer: 'player1',
      round: 1
    };
    battleStateRef.current = battleState;
    battleLaunchedRef.current = false;
    setSceneIndex(0);
    setSceneActive(sceneSteps.length > 0);
    setBattleDialogueIndex(0);
    setBattleDialogueActive(false);
    if (sceneSteps.length === 0) {
      autoStartRef.current = false;
      socket.emit('setTestState', battleState);
      battleLaunchedRef.current = true;
    }
  }, [socket, runState, node, sceneSteps.length]);

  useEffect(() => {
    if (!socket || !gameState || autoStartRef.current) return;
    if (gameState.phase !== 'battle') return;
    if (gameState.lastAction) return;
    if (!battleLaunchedRef.current) return;
    if (battleDialogueActive) return;
    autoStartRef.current = true;
    socket.emit('makeMove', {
      type: 'startRound',
      priorityPlayer: gameState.priorityPlayer || 'player1',
      speedMultiplier: battleSpeedMultiplier
    });
  }, [socket, gameState, battleDialogueActive, battleSpeedMultiplier]);

  const startBattle = () => {
    if (!socket || !battleStateRef.current || battleLaunchedRef.current) return;
    autoStartRef.current = false;
    if (battleDialogueSteps.length > 0) {
      setBattleDialogueIndex(0);
      setBattleDialogueActive(true);
    }
    battleLaunchedRef.current = true;
    socket.emit('setTestState', battleStateRef.current);
  };

  const handleSceneAdvance = () => {
    if (!sceneSteps.length) return;
    if (sceneIndex >= sceneSteps.length - 1) {
      setSceneActive(false);
      startBattle();
      return;
    }
    setSceneIndex(prev => prev + 1);
  };

  const handleSceneSkip = () => {
    setSceneActive(false);
    startBattle();
  };

  const handleBattleDialogueAdvance = () => {
    if (!battleDialogueSteps.length) return;
    if (battleDialogueIndex >= battleDialogueSteps.length - 1) {
      setBattleDialogueActive(false);
      return;
    }
    setBattleDialogueIndex(prev => prev + 1);
  };

  const handleBattleDialogueSkip = () => {
    setBattleDialogueActive(false);
  };

  useEffect(() => {
    const step = sceneActive
      ? sceneSteps[sceneIndex]
      : (battleDialogueActive ? battleDialogueSteps[battleDialogueIndex] : null);
    if (!step || step.type !== 'dialogue' || !step.text) {
      setTypedText(step?.text || '');
      return;
    }

    const fullText = step.text;
    const baseMsPerChar = 40;
    const durationMs = Math.min(3200, Math.max(1400, fullText.length * baseMsPerChar));
    const intervalMs = Math.max(16, Math.floor(durationMs / Math.max(1, fullText.length)));
    let index = 0;
    setTypedText('');

    const timer = setInterval(() => {
      index += 1;
      setTypedText(fullText.slice(0, index));
      if (index >= fullText.length) {
        clearInterval(timer);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [sceneActive, sceneIndex, sceneSteps, battleDialogueActive, battleDialogueIndex, battleDialogueSteps]);

  useEffect(() => {
    if (!gameState || battleEndHandledRef.current) return;
    if (!gameState.lastAction) return;
    const winner = gameState.lastAction.winner || (gameState.lastAction.type === 'gameEnd' ? gameState.lastAction.winner : null);
    if (winner) {
      battleEndHandledRef.current = true;
      setTimeout(() => {
        onBattleEnd && onBattleEnd(winner);
      }, 1200);
    }
  }, [gameState, onBattleEnd]);

  if (!node) return null;

  const activeSteps = sceneActive
    ? sceneSteps
    : (battleDialogueActive ? battleDialogueSteps : []);
  const activeIndex = sceneActive ? sceneIndex : battleDialogueIndex;
  const handleAdvance = sceneActive ? handleSceneAdvance : handleBattleDialogueAdvance;
  const handleSkip = sceneActive ? handleSceneSkip : handleBattleDialogueSkip;
  const primaryLabel = activeIndex >= activeSteps.length - 1
    ? (sceneActive ? 'Begin Battle' : 'Engage')
    : 'Continue';

  if (activeSteps.length > 0 && (sceneActive || battleDialogueActive)) {
    const step = activeSteps[activeIndex];
    const isDialogue = step && step.type === 'dialogue';
    const isNarration = step && step.type === 'narration';
    const speakerImages = {
      Knight: '/images/heroes/Knight Cropped.jpg',
      Warrior: '/images/heroes/Knight Cropped.jpg',
      Lancer: '/images/heroes/Lancer Cropped.jpg',
      'Ice Mage': '/images/heroes/Ice Mage Cropped.jpg',
      'Fire Mage': '/images/heroes/Fire Mage Cropped.jpg',
      Paladin: '/images/heroes/Paladin Cropped.jpg',
      'Arcane Mage': '/images/heroes/Arcane Mage Cropped.jpg',
      King: '/images/heroes/King Cropped.jpg',
      Berserker: '/images/heroes/Berserker Cropped.jpg',
      'Battle Mage': '/images/heroes/Battle Mage Cropped.jpg'
    };
    const leftDefaults = [
      { name: 'Knight', image: speakerImages.Knight },
      { name: 'Lancer', image: speakerImages.Lancer }
    ];
    const leftPortraits = Array.isArray(step.leftPortraits) && step.leftPortraits.length > 0
      ? step.leftPortraits
      : leftDefaults;
    const rightPortraits = Array.isArray(step.rightPortraits) && step.rightPortraits.length > 0
      ? step.rightPortraits
      : [];
    const portraitSize = 120;
    const portraitGap = 12;
    const portraitGroupGap = 300;
    
    const resolveName = (portrait) => {
      if (!portrait) return null;
      if (typeof portrait === 'string') return portrait;
      return portrait.name || null;
    };
    
    const allPortraits = [...leftPortraits, ...rightPortraits];
    const normalizedSpeaker = step.speaker?.toLowerCase?.() || '';
    const speakerIndex = allPortraits.findIndex(p => (resolveName(p) || '').toLowerCase() === normalizedSpeaker);
    const safeSpeakerIndex = speakerIndex >= 0 ? speakerIndex : 0;
    
    const leftGroupWidth = leftPortraits.length > 0 
      ? leftPortraits.length * portraitSize + Math.max(0, leftPortraits.length - 1) * portraitGap
      : 0;
    const rightGroupWidth = rightPortraits.length > 0
      ? rightPortraits.length * portraitSize + Math.max(0, rightPortraits.length - 1) * portraitGap
      : 0;
    
    let speakerPortraitLeft = 0;
    if (safeSpeakerIndex < leftPortraits.length) {
      speakerPortraitLeft = safeSpeakerIndex * (portraitSize + portraitGap);
    } else {
      const rightIndex = safeSpeakerIndex - leftPortraits.length;
      speakerPortraitLeft = leftGroupWidth + portraitGroupGap + rightIndex * (portraitSize + portraitGap);
    }
    const speakerPortraitCenter = speakerPortraitLeft + portraitSize / 2;
    
    const bubbleElement = (
      <div
        className="story-dialogue__bubble story-dialogue__bubble--above"
        style={{ '--bubble-center': `${speakerPortraitCenter}px` }}
      >
        <div className="story-dialogue__speaker">{step.speaker}</div>
        <div className="story-dialogue__text-wrap">
          <div className="story-dialogue__text story-dialogue__text--ghost">{step.text}</div>
          <div className="story-dialogue__text story-dialogue__text--typed">{typedText}</div>
        </div>
      </div>
    );
    const resolvePortrait = (portrait) => {
      if (!portrait) return null;
      const imagePath = portrait.image || speakerImages[portrait.name] || speakerImages[portrait];
      const label = portrait.name || portrait;
      return imagePath ? { src: getAssetPath(encodeURI(imagePath)), label } : { src: null, label };
    };
    const narrationLines = isNarration && Array.isArray(step.lines) ? step.lines : [];
    const narrationCharCount = narrationLines.reduce((total, line) => total + (line?.length || 0), 0);
    const charsPerSecond = 4.4;
    const secondsByChars = narrationCharCount / charsPerSecond;
    const secondsByLines = narrationLines.length * 7;
    const scrollDurationSeconds = isNarration
      ? Math.max(34, secondsByChars, secondsByLines)
      : 28;
    const estimatedDialogueLines = isDialogue
      ? Math.ceil((step.text?.length || 0) / 38)
      : 0;
    const dialogueContainerMinHeight = isDialogue
      ? Math.max(140, 62 + estimatedDialogueLines * 30)
      : 120;
    return (
      <div
        className="story-scene"
        style={{
          ...styles.container,
          backgroundImage: `url(${getAssetPath('/images/background/BSVBackground.png')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="story-scene__overlay" />
        <div className="story-scene__content">
          <div className="story-scene__panel">
            {isNarration ? (
              <div className="story-scroll">
                <div className="story-scroll__inner" style={{ animationDuration: `${scrollDurationSeconds}s` }}>
                  {(step.lines || []).map((line, index) => (
                    <p key={`${index}-${line.slice(0, 12)}`} className="story-scroll__line">{line}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {isDialogue ? (
              <div className="story-dialogue__row">
                <div className="story-dialogue__stack">
                  <div className="story-dialogue__bubble-container" style={{ minHeight: `${dialogueContainerMinHeight}px` }}>
                    {bubbleElement}
                  </div>
                  <div className="story-dialogue__portraits">
                    <div className="story-dialogue__portrait-group left">
                      {leftPortraits.map((portrait, index) => {
                        const resolved = resolvePortrait(portrait);
                        return (
                          <div className="story-dialogue__media" key={`left-${index}-${resolved?.label || 'unknown'}`}>
                            {resolved?.src ? (
                              <img className="story-dialogue__avatar" src={resolved.src} alt={resolved.label || 'Hero'} />
                            ) : (
                              <div className="story-dialogue__avatar story-dialogue__avatar--fallback">{(resolved?.label || '?').charAt(0)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="story-dialogue__portrait-group right">
                      {rightPortraits.map((portrait, index) => {
                        const resolved = resolvePortrait(portrait);
                        return (
                          <div className="story-dialogue__media" key={`right-${index}-${resolved?.label || 'unknown'}`}>
                            {resolved?.src ? (
                              <img className="story-dialogue__avatar" src={resolved.src} alt={resolved.label || 'Hero'} />
                            ) : (
                              <div className="story-dialogue__avatar story-dialogue__avatar--fallback">{(resolved?.label || '?').charAt(0)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="story-scene__actions">
              <button className="story-scene__button" onClick={handleSkip}>Skip</button>
              <button className="story-scene__button story-scene__button--primary" onClick={handleAdvance}>
                {primaryLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.banner}>
        <div>
          <div style={styles.bannerTitle}>{node.title}</div>
          <div style={styles.bannerSubtitle}>{node.description}</div>
        </div>
        <div style={styles.bannerSubtitle}>Relic Hunt</div>
      </div>

      <BattlePhase
        gameState={gameState}
        socket={socket}
        onGameEnd={onBattleEnd}
        aiDifficulty={getStoryEnemyTeam(node.enemyTeam)?.aiDifficulty}
        autoPlay={true}
        showReturnToMenu={false}
        battleSpeedMultiplier={battleSpeedMultiplier}
      />
    </div>
  );
}
