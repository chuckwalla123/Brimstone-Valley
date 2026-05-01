// src/story/StoryTeamSelect.jsx
// Party selection for Relic Hunt story mode.

import React, { useMemo, useState, useEffect } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #140b22 0%, #0b0713 100%)',
    color: '#fff',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  header: {
    textAlign: 'center',
    marginBottom: '16px'
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 'bold'
  },
  subtitle: {
    color: '#d9c4a6',
    marginTop: '6px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: '12px',
    width: '100%',
    maxWidth: '1100px'
  },
  card: {
    background: 'rgba(0,0,0,0.35)',
    border: '2px solid transparent',
    borderRadius: '10px',
    padding: '8px',
    cursor: 'pointer',
    textAlign: 'center'
  },
  cardSelected: {
    border: '2px solid #f59e0b',
    boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)'
  },
  cardLocked: {
    border: '2px solid #6b7280',
    opacity: 0.8,
    cursor: 'default'
  },
  heroImage: {
    width: '70px',
    height: '70px',
    borderRadius: '8px',
    objectFit: 'cover',
    marginBottom: '6px'
  },
  heroName: {
    fontSize: '0.75rem',
    fontWeight: 'bold'
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
    marginTop: '18px',
    justifyContent: 'center'
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
  },
  helper: {
    fontSize: '0.75rem',
    color: '#c6b89b',
    textAlign: 'center',
    marginTop: '10px'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalCard: {
    width: '100%',
    maxWidth: '520px',
    background: 'linear-gradient(180deg, #1a1028 0%, #0f0a18 100%)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    borderRadius: '14px',
    boxShadow: '0 0 28px rgba(0,0,0,0.45)',
    padding: '22px'
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  modalText: {
    color: '#d9c4a6',
    lineHeight: '1.6'
  }
};

const ROW_LABELS = ['Back Row', 'Middle Row', 'Front Row'];
const DISPLAY_TO_BOARD = [0, 3, 6, 1, 4, 7, 2, 5, 8];

const displayIndexToBoardIndex = (displayIndex) => (
  typeof DISPLAY_TO_BOARD[displayIndex] === 'number' ? DISPLAY_TO_BOARD[displayIndex] : displayIndex
);

export default function StoryTeamSelect({ arc, showOverwriteWarning = false, onConfirm, onBack }) {
  const bannerHeroes = arc?.bannerHeroes || [];
  const bannerPositions = arc?.bannerPositions || [];
  const maxMercs = 1;
  const [selectedIds, setSelectedIds] = useState([...bannerHeroes]);
  const [boardPositions, setBoardPositions] = useState(Array(9).fill(null));
  const [reserveHeroes, setReserveHeroes] = useState([]);
  const [selectedHeroId, setSelectedHeroId] = useState(null);
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);

  useEffect(() => {
    setSelectedIds([...bannerHeroes]);
    setBoardPositions(Array(9).fill(null));
    setReserveHeroes([]);
    setSelectedHeroId(null);
    setConfirmOverwriteOpen(false);
  }, [arc?.id]);

  useEffect(() => {
    if (!bannerHeroes.length) return;
    setBoardPositions(prev => {
      const next = [...prev];
      bannerHeroes.forEach((heroId, idx) => {
        const pos = typeof bannerPositions[idx] === 'number' ? bannerPositions[idx] : null;
        if (pos != null && next[pos] == null) next[pos] = heroId;
      });
      return next;
    });
  }, [bannerHeroes, bannerPositions]);

  const heroOptions = useMemo(() => {
    const pool = HEROES.filter(h => h.draftable !== false && !bannerHeroes.includes(h.id));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(10, shuffled.length));
  }, [arc?.id, bannerHeroes]);

  const toggleSelect = (heroId) => {
    if (bannerHeroes.includes(heroId)) return;
    setSelectedIds(prev => {
      if (prev.includes(heroId)) {
        setBoardPositions(current => current.map(id => (id === heroId ? null : id)));
        setReserveHeroes(current => current.filter(id => id !== heroId));
        if (selectedHeroId === heroId) setSelectedHeroId(null);
        return prev.filter(id => id !== heroId);
      }
      if (prev.length - bannerHeroes.length >= maxMercs) return prev;
      return [...prev, heroId];
    });
  };

  const handleSlotClick = (slotIndex) => {
    if (!selectedHeroId) return;
    const nextBoard = [...boardPositions];
    const nextReserve = [reserveHeroes[0] || null, reserveHeroes[1] || null];
    const sourceBoardIndex = nextBoard.findIndex(id => id === selectedHeroId);
    const sourceReserveIndex = nextReserve.findIndex(id => id === selectedHeroId);
    const destinationHeroId = nextBoard[slotIndex];

    if (destinationHeroId === selectedHeroId) return;

    if (sourceBoardIndex >= 0) nextBoard[sourceBoardIndex] = null;
    if (sourceReserveIndex >= 0) nextReserve[sourceReserveIndex] = null;

    nextBoard[slotIndex] = selectedHeroId;

    if (destinationHeroId) {
      if (sourceBoardIndex >= 0) {
        nextBoard[sourceBoardIndex] = destinationHeroId;
      } else if (sourceReserveIndex >= 0) {
        nextReserve[sourceReserveIndex] = destinationHeroId;
      } else {
        const emptyReserve = nextReserve.findIndex(id => !id);
        if (emptyReserve >= 0) {
          nextReserve[emptyReserve] = destinationHeroId;
        } else {
          // No legal swap destination available; keep board unchanged.
          nextBoard[slotIndex] = destinationHeroId;
          return;
        }
      }
    }

    setBoardPositions(nextBoard);
    setReserveHeroes(nextReserve);
  };

  const handleReserveClick = (slotIndex) => {
    if (!selectedHeroId) return;
    const nextBoard = [...boardPositions];
    const nextReserve = [reserveHeroes[0] || null, reserveHeroes[1] || null];
    const sourceBoardIndex = nextBoard.findIndex(id => id === selectedHeroId);
    const sourceReserveIndex = nextReserve.findIndex(id => id === selectedHeroId);
    const destinationHeroId = nextReserve[slotIndex] || null;

    if (destinationHeroId === selectedHeroId) return;

    if (sourceBoardIndex >= 0) nextBoard[sourceBoardIndex] = null;
    if (sourceReserveIndex >= 0) nextReserve[sourceReserveIndex] = null;

    nextReserve[slotIndex] = selectedHeroId;

    if (destinationHeroId) {
      if (sourceBoardIndex >= 0) {
        nextBoard[sourceBoardIndex] = destinationHeroId;
      } else if (sourceReserveIndex >= 0) {
        nextReserve[sourceReserveIndex] = destinationHeroId;
      } else {
        const emptyBoard = nextBoard.findIndex(id => !id);
        if (emptyBoard >= 0) {
          nextBoard[emptyBoard] = destinationHeroId;
        } else {
          nextReserve[slotIndex] = destinationHeroId;
          return;
        }
      }
    }

    setBoardPositions(nextBoard);
    setReserveHeroes(nextReserve);
  };

  const totalRequired = bannerHeroes.length + maxMercs;
  const selectedComplete = selectedIds.length === totalRequired;
  const boardCount = boardPositions.filter(Boolean).length;
  const canConfirm = selectedComplete && boardCount >= bannerHeroes.length;

  const confirmSelection = () => {
    if (!canConfirm) return;
    if (showOverwriteWarning) {
      setConfirmOverwriteOpen(true);
      return;
    }

    const heroSelections = selectedIds.map(heroId => {
      const boardPos = boardPositions.findIndex(id => id === heroId);
      const position = boardPos >= 0 ? boardPos : null;
      return { heroId, position, augments: [] };
    });
    onConfirm && onConfirm(heroSelections);
  };

  const finalizeSelection = () => {
    const heroSelections = selectedIds.map(heroId => {
      const boardPos = boardPositions.findIndex(id => id === heroId);
      const position = boardPos >= 0 ? boardPos : null;
      return { heroId, position, augments: [] };
    });
    setConfirmOverwriteOpen(false);
    onConfirm && onConfirm(heroSelections);
  };

  const getHero = (id) => HEROES.find(h => h.id === id);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Assemble Your Expedition</div>
        <div style={styles.subtitle}>Choose {maxMercs} mercenary to join your banner heroes</div>
      </div>

      <div style={styles.section}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Mercenary Options</div>
        <div style={styles.grid}>
          {heroOptions.map(hero => {
            const selected = selectedIds.includes(hero.id);
            return (
              <div
                key={hero.id}
                style={{
                  ...styles.card,
                  ...(selected ? styles.cardSelected : {})
                }}
                onClick={() => toggleSelect(hero.id)}
              >
                <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.heroImage} />
                <div style={styles.heroName}>{hero.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.section}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Selected Heroes (click to place)</div>
        <div style={styles.grid}>
          {selectedIds.map(heroId => {
            const hero = getHero(heroId);
            const locked = bannerHeroes.includes(heroId);
            const selected = selectedHeroId === heroId;
            return (
              <div
                key={heroId}
                style={{
                  ...styles.card,
                  ...(selected ? styles.cardSelected : {}),
                  ...(locked ? styles.cardLocked : {})
                }}
                onClick={() => setSelectedHeroId(heroId)}
              >
                {hero ? (
                  <>
                    <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.heroImage} />
                    <div style={styles.heroName}>{hero.name}{locked ? ' (Banner)' : ''}</div>
                  </>
                ) : (
                  <div style={styles.heroName}>{heroId}</div>
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

        <div style={styles.helper}>
          Select a hero, then click Main Board or Reserve to place them. You need your two banner heroes on the board.
        </div>
      </div>

      <div style={styles.buttonRow}>
        <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onBack}>
          Back
        </button>
        <button
          style={{ ...styles.button, ...styles.primaryButton, opacity: canConfirm ? 1 : 0.5 }}
          onClick={confirmSelection}
          disabled={!canConfirm}
        >
          Begin Hunt
        </button>
      </div>

      {confirmOverwriteOpen ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalTitle}>Overwrite Current Relic Hunt?</div>
            <div style={styles.modalText}>
              Starting this hunt will erase your current Relic Hunt progress and replace it with this new expedition.
            </div>
            <div style={{ ...styles.buttonRow, justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setConfirmOverwriteOpen(false)}
              >
                Go Back
              </button>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={finalizeSelection}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
