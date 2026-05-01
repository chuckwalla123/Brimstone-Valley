// src/story/StoryRecruitChoice.jsx
// Post-battle recruit reward screen for Relic Hunt.

import React, { useEffect, useMemo, useState } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';
import {
  generateRecruitChoices,
  normalizeStoryPartySelections,
  setStoryPartySelections,
  STORY_MAIN_MAX,
  STORY_PARTY_MAX,
  STORY_RESERVE_MAX
} from './storyState.js';

const styles = {
  container: {
    minHeight: '100vh',
    padding: '32px 20px',
    background: 'linear-gradient(180deg, #140b22 0%, #0b0713 100%)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '12px'
  },
  subtitle: {
    color: '#d9c4a6',
    marginBottom: '8px',
    textAlign: 'center'
  },
  helper: {
    color: '#c6b89b',
    marginBottom: '20px',
    textAlign: 'center',
    maxWidth: '700px'
  },
  cardRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  card: {
    width: '220px',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(0,0,0,0.35)',
    cursor: 'pointer',
    textAlign: 'center'
  },
  cardSelected: {
    border: '2px solid #f59e0b',
    boxShadow: '0 0 14px rgba(245, 158, 11, 0.4)'
  },
  heroImage: {
    width: '88px',
    height: '88px',
    objectFit: 'cover',
    borderRadius: '10px',
    marginBottom: '10px'
  },
  heroName: {
    fontSize: '1rem',
    fontWeight: 'bold'
  },
  heroDesc: {
    fontSize: '0.85rem',
    color: '#d9c4a6',
    marginTop: '8px'
  },
  section: {
    marginTop: '20px',
    width: '100%',
    maxWidth: '1100px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '14px'
  },
  rosterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '12px',
    width: '100%'
  },
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 100px)',
    gridTemplateRows: 'repeat(3, 100px)',
    gap: '8px',
    justifyContent: 'center'
  },
  slot: {
    background: 'rgba(0,0,0,0.4)',
    border: '2px dashed #7c4a12',
    borderRadius: '8px',
    width: '100px',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  slotFilled: {
    border: '2px solid #f59e0b'
  },
  slotLabel: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    fontSize: '0.55rem',
    color: '#8b7d6b'
  },
  slotHeroImage: {
    width: '65px',
    height: '65px',
    borderRadius: '6px',
    objectFit: 'cover'
  },
  reserveRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '22px'
  },
  button: {
    padding: '12px 20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
    color: '#1b0f07'
  },
  secondaryButton: {
    background: 'rgba(255,255,255,0.08)',
    color: '#fff'
  }
};

const ROW_LABELS = ['Back Row', 'Middle Row', 'Front Row'];
const DISPLAY_TO_BOARD = [0, 3, 6, 1, 4, 7, 2, 5, 8];

const displayIndexToBoardIndex = (displayIndex) => (
  typeof DISPLAY_TO_BOARD[displayIndex] === 'number' ? DISPLAY_TO_BOARD[displayIndex] : displayIndex
);

function buildInitialLayout(heroSelections) {
  const boardPositions = Array(9).fill(null);
  const reserveHeroes = Array(STORY_RESERVE_MAX).fill(null);
  const normalizedSelections = normalizeStoryPartySelections(heroSelections);

  normalizedSelections.forEach(entry => {
    if (Number.isInteger(entry?.position) && entry.position >= 0 && entry.position <= 8) {
      boardPositions[entry.position] = entry.heroId;
      return;
    }

    const openReserveIndex = reserveHeroes.findIndex(id => !id);
    if (openReserveIndex >= 0) reserveHeroes[openReserveIndex] = entry.heroId;
  });

  return {
    boardPositions,
    reserveHeroes
  };
}

export default function StoryRecruitChoice({ runState, onConfirm, onSkip, onExit }) {
  const [choices, setChoices] = useState([]);
  const [selectedRecruitId, setSelectedRecruitId] = useState(null);
  const [selectedHeroId, setSelectedHeroId] = useState(null);
  const [boardPositions, setBoardPositions] = useState(Array(9).fill(null));
  const [reserveHeroes, setReserveHeroes] = useState([null, null]);
  const [draggedHeroId, setDraggedHeroId] = useState(null);

  useEffect(() => {
    if (!runState) return;
    const pendingIds = Array.isArray(runState.pendingRecruitChoice) ? runState.pendingRecruitChoice : [];
    if (pendingIds.length > 0) {
      setChoices(
        pendingIds
          .map(heroId => HEROES.find(hero => hero.id === heroId))
          .filter(Boolean)
      );
      return;
    }

    const generated = generateRecruitChoices(runState, 3);
    setChoices(generated || []);
  }, [runState]);

  useEffect(() => {
    const { boardPositions: nextBoard, reserveHeroes: nextReserve } = buildInitialLayout(runState?.selectedHeroes || []);
    setBoardPositions(nextBoard);
    setReserveHeroes(nextReserve);
    setSelectedHeroId(null);
  }, [runState]);

  const currentHeroes = useMemo(
    () => (runState?.selectedHeroes || []).map(entry => ({ ...entry })),
    [runState]
  );
  const currentHeroIds = useMemo(() => currentHeroes.map(entry => entry.heroId), [currentHeroes]);
  const teamFull = currentHeroes.length >= STORY_PARTY_MAX;

  const selectedRoster = useMemo(() => {
    const entries = [...currentHeroes];
    if (selectedRecruitId && !entries.some(entry => entry.heroId === selectedRecruitId)) {
      entries.push({ heroId: selectedRecruitId, position: null, augments: [] });
    }
    return entries;
  }, [currentHeroes, selectedRecruitId]);

  const rosterIds = selectedRoster.map(entry => entry.heroId);

  const sanitizeLayoutForCurrentHeroes = (board, reserve) => {
    const nextBoard = board.map(heroId => (heroId && currentHeroIds.includes(heroId) ? heroId : null));
    const nextReserve = Array.from({ length: STORY_RESERVE_MAX }, (_, index) => {
      const heroId = reserve[index] || null;
      return heroId && currentHeroIds.includes(heroId) ? heroId : null;
    });
    const placedHeroIds = new Set([...nextBoard.filter(Boolean), ...nextReserve.filter(Boolean)]);
    let boardCount = nextBoard.filter(Boolean).length;

    currentHeroIds.forEach(heroId => {
      if (placedHeroIds.has(heroId)) return;
      const emptyReserveIndex = nextReserve.findIndex(id => !id);
      if (emptyReserveIndex >= 0) {
        nextReserve[emptyReserveIndex] = heroId;
        placedHeroIds.add(heroId);
        return;
      }

      if (boardCount >= STORY_MAIN_MAX) return;
      const emptyBoardIndex = nextBoard.findIndex(id => !id);
      if (emptyBoardIndex >= 0) {
        nextBoard[emptyBoardIndex] = heroId;
        placedHeroIds.add(heroId);
        boardCount += 1;
      }
    });

    return { nextBoard, nextReserve };
  };

  const handleRecruitPick = (heroId) => {
    const { nextBoard, nextReserve } = sanitizeLayoutForCurrentHeroes(boardPositions, reserveHeroes);
    setBoardPositions(nextBoard);
    setReserveHeroes(nextReserve);
    setSelectedRecruitId(heroId);
    setSelectedHeroId(heroId);
  };

  const getHero = (id) => HEROES.find(hero => hero.id === id);

  const moveHeroToBoard = (heroId, slotIndex) => {
    if (!heroId || slotIndex == null) return;

    const nextBoard = [...boardPositions];
    const nextReserve = Array.from({ length: STORY_RESERVE_MAX }, (_, index) => reserveHeroes[index] || null);
    const sourceBoardIndex = nextBoard.findIndex(id => id === heroId);
    const sourceReserveIndex = nextReserve.findIndex(id => id === heroId);
    const targetHeroId = nextBoard[slotIndex];
    const heroIsPlaced = sourceBoardIndex >= 0 || sourceReserveIndex >= 0;
    const boardCount = nextBoard.filter(Boolean).length;
    const boardCountExcludingHero = boardCount - (sourceBoardIndex >= 0 ? 1 : 0);

    if (targetHeroId === heroId) return;
    if (!heroIsPlaced && teamFull && !targetHeroId) return;
    if (!targetHeroId && boardCountExcludingHero >= STORY_MAIN_MAX) return;

    if (sourceBoardIndex >= 0) nextBoard[sourceBoardIndex] = null;
    if (sourceReserveIndex >= 0) nextReserve[sourceReserveIndex] = null;

    if (targetHeroId && targetHeroId !== heroId) {
      if (!heroIsPlaced && teamFull) {
        // Full parties can only place an unplaced hero by replacing an existing one.
      } else if (sourceBoardIndex >= 0) {
        nextBoard[sourceBoardIndex] = targetHeroId;
      } else if (sourceReserveIndex >= 0) {
        nextReserve[sourceReserveIndex] = targetHeroId;
      } else {
        const emptyReserveIndex = nextReserve.findIndex(id => !id);
        if (emptyReserveIndex >= 0) {
          nextReserve[emptyReserveIndex] = targetHeroId;
        } else {
          const emptyBoardIndex = nextBoard.findIndex((id, index) => !id && index !== slotIndex);
          if (emptyBoardIndex >= 0) {
            nextBoard[emptyBoardIndex] = targetHeroId;
          } else {
            return;
          }
        }
      }
    }

    nextBoard[slotIndex] = heroId;
    setBoardPositions(nextBoard);
    setReserveHeroes(nextReserve);
    setSelectedHeroId(null);
  };

  const moveHeroToReserve = (heroId, reserveIndex) => {
    if (!heroId || reserveIndex == null) return;

    const nextBoard = [...boardPositions];
    const nextReserve = Array.from({ length: STORY_RESERVE_MAX }, (_, index) => reserveHeroes[index] || null);
    const sourceBoardIndex = nextBoard.findIndex(id => id === heroId);
    const sourceReserveIndex = nextReserve.findIndex(id => id === heroId);
    const targetHeroId = nextReserve[reserveIndex] || null;
    const heroIsPlaced = sourceBoardIndex >= 0 || sourceReserveIndex >= 0;

    if (targetHeroId === heroId) return;
    if (!heroIsPlaced && teamFull && !targetHeroId) return;

    if (sourceBoardIndex >= 0) nextBoard[sourceBoardIndex] = null;
    if (sourceReserveIndex >= 0) nextReserve[sourceReserveIndex] = null;

    if (targetHeroId && targetHeroId !== heroId) {
      if (!heroIsPlaced && teamFull) {
        // Full parties can only place an unplaced hero by replacing an existing one.
      } else if (sourceBoardIndex >= 0) {
        nextBoard[sourceBoardIndex] = targetHeroId;
      } else if (sourceReserveIndex >= 0) {
        nextReserve[sourceReserveIndex] = targetHeroId;
      } else {
        const emptyBoardIndex = nextBoard.findIndex(id => !id);
        if (emptyBoardIndex >= 0) {
          nextBoard[emptyBoardIndex] = targetHeroId;
        } else {
          return;
        }
      }
    }

    nextReserve[reserveIndex] = heroId;
    setBoardPositions(nextBoard);
    setReserveHeroes(nextReserve);
    setSelectedHeroId(null);
  };

  const handleDragStart = (heroId, event) => {
    if (!heroId) return;
    setDraggedHeroId(heroId);
    if (event?.dataTransfer) {
      event.dataTransfer.setData('text/plain', heroId);
      event.dataTransfer.effectAllowed = 'move';
    }
  };

  const getDraggedHeroId = (event) => draggedHeroId || event?.dataTransfer?.getData('text/plain') || null;

  const handleBoardDrop = (slotIndex, event) => {
    const heroId = getDraggedHeroId(event);
    if (!heroId) return;
    moveHeroToBoard(heroId, slotIndex);
    setDraggedHeroId(null);
  };

  const handleReserveDrop = (reserveIndex, event) => {
    const heroId = getDraggedHeroId(event);
    if (!heroId) return;
    moveHeroToReserve(heroId, reserveIndex);
    setDraggedHeroId(null);
  };

  const handleSlotClick = (slotIndex) => {
    if (!selectedHeroId) return;
    moveHeroToBoard(selectedHeroId, slotIndex);
  };

  const handleReserveClick = (slotIndex) => {
    if (!selectedHeroId) return;
    moveHeroToReserve(selectedHeroId, slotIndex);
  };

  const handleConfirm = () => {
    if (!selectedRecruitId) return;

    const finalHeroIds = [...boardPositions.filter(Boolean), ...reserveHeroes.filter(Boolean)];
    const uniqueHeroIds = Array.from(new Set(finalHeroIds));
    const currentAugments = new Map(currentHeroes.map(entry => [entry.heroId, entry.augments || []]));
    const updatedSelections = uniqueHeroIds.map(heroId => {
      const boardIndex = boardPositions.findIndex(id => id === heroId);
      return {
        heroId,
        position: boardIndex >= 0 ? boardIndex : null,
        augments: currentAugments.get(heroId) || []
      };
    });

    const updated = setStoryPartySelections(runState, updatedSelections);
    onConfirm && onConfirm(updated);
  };

  const handleSkip = () => {
    const finalHeroIds = [...boardPositions.filter(Boolean), ...reserveHeroes.filter(Boolean)];
    const uniqueHeroIds = Array.from(new Set(finalHeroIds));
    const currentAugments = new Map(currentHeroes.map(entry => [entry.heroId, entry.augments || []]));
    const updatedSelections = uniqueHeroIds.map(heroId => {
      const boardIndex = boardPositions.findIndex(id => id === heroId);
      return {
        heroId,
        position: boardIndex >= 0 ? boardIndex : null,
        augments: currentAugments.get(heroId) || []
      };
    });

    const updated = setStoryPartySelections(runState, updatedSelections);
    onSkip && onSkip(updated);
  };

  const currentCount = Array.isArray(runState?.selectedHeroes) ? runState.selectedHeroes.length : 0;
  const boardCount = boardPositions.filter(Boolean).length;
  const reserveCount = reserveHeroes.filter(Boolean).length;
  const placedCount = boardPositions.filter(Boolean).length + reserveHeroes.filter(Boolean).length;
  const placedIds = new Set([...boardPositions.filter(Boolean), ...reserveHeroes.filter(Boolean)]);
  const recruitPlaced = Boolean(selectedRecruitId) && placedIds.has(selectedRecruitId);
  const expectedPlacedCount = teamFull ? STORY_PARTY_MAX : Math.min(currentCount + 1, STORY_PARTY_MAX);
  const canConfirm = Boolean(selectedRecruitId)
    && recruitPlaced
    && boardCount <= STORY_MAIN_MAX
    && reserveCount <= STORY_RESERVE_MAX
    && placedCount === expectedPlacedCount;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Reinforcements Arrive</div>
      <div style={styles.subtitle}>Choose one hero to join your expedition</div>
      <div style={styles.helper}>
        {teamFull
          ? `Your party is full. Choose a recruit, then drag or place them onto an occupied slot to swap someone out. Story parties are capped at ${STORY_MAIN_MAX} on the main board and ${STORY_RESERVE_MAX} in reserve.`
          : `Your party will grow from ${currentCount} to ${Math.min(currentCount + 1, STORY_PARTY_MAX)} heroes. Story parties are capped at ${STORY_MAIN_MAX} on the main board and ${STORY_RESERVE_MAX} in reserve.`}
      </div>

      <div style={styles.cardRow}>
        {choices.map(hero => (
          <div
            key={hero.id}
            style={{ ...styles.card, ...(selectedRecruitId === hero.id ? styles.cardSelected : {}) }}
            onClick={() => handleRecruitPick(hero.id)}
            draggable
            onDragStart={(event) => {
              handleRecruitPick(hero.id);
              handleDragStart(hero.id, event);
            }}
            onDragEnd={() => setDraggedHeroId(null)}
          >
            <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.heroImage} />
            <div style={styles.heroName}>{hero.name}</div>
            <div style={styles.heroDesc}>{hero.description || 'A capable mercenary answers your call.'}</div>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Expedition Roster (click to place)</div>
        <div style={styles.rosterGrid}>
          {selectedRoster.map(entry => {
            const hero = getHero(entry.heroId);
            const isSelected = selectedHeroId === entry.heroId;
            const isRecruit = entry.heroId === selectedRecruitId;
            const isPlaced = placedIds.has(entry.heroId);
            return (
              <div
                key={entry.heroId}
                style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}), opacity: isPlaced || isRecruit ? 1 : 0.55 }}
                onClick={() => setSelectedHeroId(entry.heroId)}
                draggable
                onDragStart={(event) => handleDragStart(entry.heroId, event)}
                onDragEnd={() => setDraggedHeroId(null)}
              >
                {hero ? (
                  <>
                    <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.heroImage} />
                    <div style={styles.heroName}>{hero.name}{isRecruit ? ' (Recruit)' : ''}</div>
                    <div style={styles.heroDesc}>{isRecruit ? 'New ally awaiting orders.' : (isPlaced ? 'Current party member.' : 'Not currently in the active lineup.')}</div>
                  </>
                ) : (
                  <div style={styles.heroName}>{entry.heroId}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Main Board</div>
          <div style={styles.board}>
            {Array.from({ length: 9 }).map((_, displayIndex) => {
              const boardIndex = displayIndexToBoardIndex(displayIndex);
              const heroId = boardPositions[boardIndex];
              const hero = heroId ? getHero(heroId) : null;
              const rowLabel = ROW_LABELS[displayIndex % 3];
              return (
                <div
                  key={displayIndex}
                  style={{ ...styles.slot, ...(heroId ? styles.slotFilled : {}), position: 'relative' }}
                  onClick={() => handleSlotClick(boardIndex)}
                  draggable={Boolean(heroId)}
                  onDragStart={(event) => heroId && handleDragStart(heroId, event)}
                  onDragEnd={() => setDraggedHeroId(null)}
                  onDragOver={(event) => {
                    if (draggedHeroId || event.dataTransfer?.types?.includes('text/plain')) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleBoardDrop(boardIndex, event);
                  }}
                  title={rowLabel}
                >
                  <div style={styles.slotLabel}>{rowLabel}</div>
                  {hero ? (
                    <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.slotHeroImage} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Reserve</div>
          <div style={styles.reserveRow}>
            {Array.from({ length: 2 }).map((_, i) => {
              const heroId = reserveHeroes[i] || null;
              const hero = heroId ? getHero(heroId) : null;
              return (
                <div
                  key={i}
                  style={{ ...styles.slot, ...(heroId ? styles.slotFilled : {}), position: 'relative' }}
                  onClick={() => handleReserveClick(i)}
                  draggable={Boolean(heroId)}
                  onDragStart={(event) => heroId && handleDragStart(heroId, event)}
                  onDragEnd={() => setDraggedHeroId(null)}
                  onDragOver={(event) => {
                    if (draggedHeroId || event.dataTransfer?.types?.includes('text/plain')) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleReserveDrop(i, event);
                  }}
                >
                  <div style={styles.slotLabel}>Reserve</div>
                  {hero ? (
                    <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.slotHeroImage} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...styles.helper, marginBottom: 0, marginTop: 14 }}>
          Drag heroes between the roster, main board, and reserve. You can still click a hero and then click a destination if you prefer. The recruit screen enforces a maximum of {STORY_MAIN_MAX} heroes on the main board and {STORY_RESERVE_MAX} in reserve.
        </div>
      </div>

      <div style={styles.buttonRow}>
        <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onExit}>
          Save & Exit
        </button>
        {teamFull && onSkip && (
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={handleSkip}>
            Keep Current Team
          </button>
        )}
        <button style={{ ...styles.button, ...styles.primaryButton, opacity: canConfirm ? 1 : 0.5 }} onClick={handleConfirm} disabled={!canConfirm}>
          Recruit Hero
        </button>
      </div>
    </div>
  );
}