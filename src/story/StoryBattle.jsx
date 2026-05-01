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

const DEFAULT_STORY_BACKGROUND = '/images/background/BSVBackground.png';

const STORY_BACKGROUND_IMAGE_BY_KEY = {
  brave_wardens_pass: '/images/background/Caravan Ambush.png',
  brave_ashbridge_toll: '/images/background/Halbrecht Fortress.png',
  brave_unbroken_phalanx: '/images/background/Dawnfall Bridge.png',
  brave_warcamp: '/images/background/Illusion Fog.png',
  brave_watchtower: '/images/background/TowerBackground.png',
  brave_iron_regent_chamber: '/images/background/Ruined Vault.png',
  brave_dawnfall_bridge: '/images/background/Dawnfall Bridge.png',
  brave_halbrecht_fortress_courtyard: '/images/background/Halbrecht Fortress.png',
  brave_vault_of_echoes: '/images/background/Relic Vault.png',
  brave_lightning_road: '/images/background/Lightning Road Mountain Pass.png',
  brave_throne_room_fracture: '/images/background/Throne Room.png'
};

function buildPresentationConfig(node) {
  const presentation = node?.presentation || {};

  const backgroundCandidates = [];
  if (typeof presentation.backgroundImage === 'string' && presentation.backgroundImage) {
    backgroundCandidates.push(presentation.backgroundImage);
  }
  if (typeof presentation.backgroundKey === 'string' && presentation.backgroundKey) {
    const mappedBackground = STORY_BACKGROUND_IMAGE_BY_KEY[presentation.backgroundKey];
    if (mappedBackground) {
      backgroundCandidates.push(mappedBackground);
    }
    backgroundCandidates.push(`/images/background/story/${presentation.backgroundKey}.webp`);
    backgroundCandidates.push(`/images/background/story/${presentation.backgroundKey}.jpg`);
    backgroundCandidates.push(`/images/background/story/${presentation.backgroundKey}.png`);
  }
  backgroundCandidates.push(DEFAULT_STORY_BACKGROUND);

  const ambientCandidates = [];
  if (typeof presentation.ambientTrack === 'string' && presentation.ambientTrack) {
    ambientCandidates.push(presentation.ambientTrack);
  }
  if (typeof presentation.ambientKey === 'string' && presentation.ambientKey) {
    ambientCandidates.push(`/images/sounds/ambient/${presentation.ambientKey}.mp3`);
    ambientCandidates.push(`/images/sounds/ambient/${presentation.ambientKey}.ogg`);
    ambientCandidates.push(`/images/sounds/ambient/${presentation.ambientKey}.wav`);
  }

  const introStingerCandidates = [];
  const introStinger = presentation?.stingers?.intro;
  if (typeof introStinger === 'string' && introStinger) {
    introStingerCandidates.push(`/images/sounds/stingers/${introStinger}.mp3`);
    introStingerCandidates.push(`/images/sounds/stingers/${introStinger}.ogg`);
    introStingerCandidates.push(`/images/sounds/stingers/${introStinger}.wav`);
  }

  return {
    backgroundImage: backgroundCandidates
      .map(path => `url(${getAssetPath(encodeURI(path))})`)
      .join(', '),
    ambientCandidates,
    introStingerCandidates,
    ambientVolume: Number.isFinite(presentation.ambientVolume)
      ? Math.max(0, Math.min(1, presentation.ambientVolume))
      : 0.22,
    stingerVolume: Number.isFinite(presentation.stingerVolume)
      ? Math.max(0, Math.min(1, presentation.stingerVolume))
      : 0.35
  };
}

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

export default function StoryBattle({ runState, node, guestAssignment, onBattleEnd }) {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const ambientAudioRef = useRef(null);
  const introStingerPlayedForNodeRef = useRef(null);
  const [battleSpeedMultiplier] = useState(() => {
    const savedStory = Number(localStorage.getItem('storyBattleSpeedMultiplier') || NaN);
    if (Number.isFinite(savedStory)) return Math.min(4, Math.max(1, savedStory));
    return 1;
  });
  const battleEndHandledRef = useRef(false);
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

  const presentationConfig = useMemo(() => buildPresentationConfig(node), [node]);

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

    const playerEntries = Array.isArray(runState?.selectedHeroes)
      ? [...runState.selectedHeroes]
      : [];
    if (guestAssignment?.guestHeroId && guestAssignment?.replacedHeroId) {
      const replacedIndex = playerEntries.findIndex(entry => entry?.heroId === guestAssignment.replacedHeroId);
      if (replacedIndex >= 0) {
        const replacedEntry = playerEntries[replacedIndex];
        playerEntries[replacedIndex] = {
          heroId: guestAssignment.guestHeroId,
          position: replacedEntry?.position ?? null,
          augments: Array.isArray(node?.guestHero?.augments) ? node.guestHero.augments : []
        };
      }
    }
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
    setGameState(null);
    setSceneIndex(0);
    setSceneActive(sceneSteps.length > 0);
    setBattleDialogueIndex(0);
    setBattleDialogueActive(false);

    if (sceneSteps.length === 0) {
      if (battleDialogueSteps.length > 0) {
        setBattleDialogueIndex(0);
        setBattleDialogueActive(true);
      } else {
        battleLaunchedRef.current = true;
        socket.emit('setTestState', battleState);
      }
    }
  }, [socket, runState, node, guestAssignment, sceneSteps.length, battleDialogueSteps.length]);

  const launchBattle = () => {
    if (!socket || !battleStateRef.current) return;
    setGameState(null);
    socket.emit('setTestState', battleStateRef.current);
  };

  const startBattle = () => {
    if (!socket || !battleStateRef.current || battleLaunchedRef.current) return;
    if (battleDialogueSteps.length > 0) {
      setBattleDialogueIndex(0);
      setBattleDialogueActive(true);
    } else {
      launchBattle();
    }
    battleLaunchedRef.current = true;
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
      launchBattle();
      return;
    }
    setBattleDialogueIndex(prev => prev + 1);
  };

  const handleBattleDialogueSkip = () => {
    setBattleDialogueActive(false);
    launchBattle();
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

  useEffect(() => {
    if (!node) return;

    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.src = '';
      ambientAudioRef.current = null;
    }

    const candidates = presentationConfig.ambientCandidates || [];
    if (!candidates.length) return;

    const audio = new Audio();
    ambientAudioRef.current = audio;
    audio.loop = true;
    audio.volume = presentationConfig.ambientVolume;
    audio.preload = 'none';

    let index = 0;
    let disposed = false;

    const tryPlay = () => {
      if (disposed || index >= candidates.length) return;
      audio.src = getAssetPath(encodeURI(candidates[index]));
      const playPromise = audio.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {
          index += 1;
          tryPlay();
        });
      }
    };

    const onError = () => {
      if (disposed) return;
      index += 1;
      tryPlay();
    };

    audio.addEventListener('error', onError);
    tryPlay();

    return () => {
      disposed = true;
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
      if (ambientAudioRef.current === audio) {
        ambientAudioRef.current = null;
      }
    };
  }, [node?.id, presentationConfig.ambientCandidates, presentationConfig.ambientVolume]);

  useEffect(() => {
    if (!node) return;
    if (introStingerPlayedForNodeRef.current === node.id) return;

    const candidates = presentationConfig.introStingerCandidates || [];
    if (!candidates.length) return;

    introStingerPlayedForNodeRef.current = node.id;
    const stinger = new Audio();
    stinger.volume = presentationConfig.stingerVolume;
    stinger.preload = 'none';

    let index = 0;

    const tryPlay = () => {
      if (index >= candidates.length) return;
      stinger.src = getAssetPath(encodeURI(candidates[index]));
      const playPromise = stinger.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {
          index += 1;
          tryPlay();
        });
      }
    };

    const onError = () => {
      index += 1;
      tryPlay();
    };

    stinger.addEventListener('error', onError);
    tryPlay();

    return () => {
      stinger.removeEventListener('error', onError);
      stinger.pause();
      stinger.src = '';
    };
  }, [node?.id, presentationConfig.introStingerCandidates, presentationConfig.stingerVolume]);

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
    const speakerAliases = {
      'Palace Guard Captain': 'Palace Guard'
    };
    const speakerImages = {
      Warrior: '/images/heroes/Warrior Cropped.jpg',
      Lancer: '/images/heroes/Lancer Cropped.jpg',
      Halbrecht: '/images/heroes/Halbrecht Cropped.png',
      Varric: '/images/heroes/Varric Cropped.png',
      'Queen Aralyn': '/images/heroes/Queen Cropped.jpg',
      'Prince Rowan': '/images/heroes/Prince Cropped.jpg',
      'Rogue Mage': '/images/heroes/Dark Mage Cropped.jpg',
      'Palace Guard': '/images/heroes/Palace Guard Cropped.jpg',
      'Garruk the Red': '/images/heroes/Axeman Cropped.jpg',
      'Blood Golem': '/images/heroes/Blood Golem.jpg',
      'Stonecased King': '/images/heroes/Stone cased king cropped.jpg',
      'Ice Mage': '/images/heroes/Ice Mage Cropped.jpg',
      'Fire Mage': '/images/heroes/Fire Mage Cropped.jpg',
      Paladin: '/images/heroes/Paladin Cropped.jpg',
      'Arcane Mage': '/images/heroes/Arcane Mage Cropped.jpg',
      King: '/images/heroes/King Cropped.jpg',
      Berserker: '/images/heroes/Berserker Cropped.jpg',
      'Battle Mage': '/images/heroes/Battle Mage Cropped.jpg'
    };
    const resolveSpeakerName = (name) => {
      if (!name) return '';
      return speakerAliases[name] || name;
    };
    const leftDefaults = [
      { name: 'Warrior', image: speakerImages.Warrior },
      { name: 'Lancer', image: speakerImages.Lancer }
    ];
    const leftPortraits = Array.isArray(step.leftPortraits) && step.leftPortraits.length > 0
      ? step.leftPortraits
      : leftDefaults;
    const rightPortraits = Array.isArray(step.rightPortraits) && step.rightPortraits.length > 0
      ? step.rightPortraits
      : [];
    const resolvedSpeakerName = resolveSpeakerName(step.speaker);
    const normalizedSpeakerName = resolvedSpeakerName.toLowerCase();
    const speakerAlreadyShown = [...leftPortraits, ...rightPortraits].some((portrait) => {
      const portraitName = typeof portrait === 'string'
        ? portrait
        : (portrait?.name || '');
      return portraitName.toLowerCase() === normalizedSpeakerName;
    });
    const autoSpeakerPortrait = !speakerAlreadyShown && speakerImages[resolvedSpeakerName]
      ? { name: resolvedSpeakerName, image: speakerImages[resolvedSpeakerName] }
      : null;
    const finalLeftPortraits = autoSpeakerPortrait && step.side !== 'right'
      ? [...leftPortraits, autoSpeakerPortrait]
      : leftPortraits;
    const finalRightPortraits = autoSpeakerPortrait && step.side === 'right'
      ? [...rightPortraits, autoSpeakerPortrait]
      : rightPortraits;
    const portraitSize = 120;
    const portraitGap = 12;
    const portraitGroupGap = 300;
    
    const resolveName = (portrait) => {
      if (!portrait) return null;
      if (typeof portrait === 'string') return portrait;
      return portrait.name || null;
    };
    
    const allPortraits = [...finalLeftPortraits, ...finalRightPortraits];
    const normalizedSpeaker = normalizedSpeakerName;
    const speakerIndex = allPortraits.findIndex(p => (resolveName(p) || '').toLowerCase() === normalizedSpeaker);
    const safeSpeakerIndex = speakerIndex >= 0 ? speakerIndex : 0;
    
    const leftGroupWidth = finalLeftPortraits.length > 0 
      ? finalLeftPortraits.length * portraitSize + Math.max(0, finalLeftPortraits.length - 1) * portraitGap
      : 0;
    const rightGroupWidth = finalRightPortraits.length > 0
      ? finalRightPortraits.length * portraitSize + Math.max(0, finalRightPortraits.length - 1) * portraitGap
      : 0;
    
    let speakerPortraitLeft = 0;
    if (safeSpeakerIndex < finalLeftPortraits.length) {
      speakerPortraitLeft = safeSpeakerIndex * (portraitSize + portraitGap);
    } else {
      const rightIndex = safeSpeakerIndex - finalLeftPortraits.length;
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
    const scrollSpeedMultiplier = 1.69;
    const charsPerSecond = 4.4 * scrollSpeedMultiplier;
    const secondsByChars = narrationCharCount / charsPerSecond;
    const secondsByLines = (narrationLines.length * 7) / scrollSpeedMultiplier;
    const scrollDurationSeconds = isNarration
      ? Math.max(24, secondsByChars, secondsByLines)
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
          backgroundImage: presentationConfig.backgroundImage,
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
                      {finalLeftPortraits.map((portrait, index) => {
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
                      {finalRightPortraits.map((portrait, index) => {
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
    <div
      style={{
        ...styles.container,
        backgroundImage: presentationConfig.backgroundImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
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
