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
    justifyContent: 'center'
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
  }
};

const ROW_LABELS = ['Back Row', 'Middle Row', 'Front Row'];
const DISPLAY_TO_BOARD = [0, 3, 6, 1, 4, 7, 2, 5, 8];

const displayIndexToBoardIndex = (displayIndex) => (
  typeof DISPLAY_TO_BOARD[displayIndex] === 'number' ? DISPLAY_TO_BOARD[displayIndex] : displayIndex
);

export default function StoryTeamSelect({ arc, onConfirm, onBack }) {
  const bannerHeroes = arc?.bannerHeroes || [];
  const bannerPositions = arc?.bannerPositions || [];
  const maxMercs = 3;
  const [selectedIds, setSelectedIds] = useState([...bannerHeroes]);
  const [boardPositions, setBoardPositions] = useState(Array(9).fill(null));
  const [reserveHeroes, setReserveHeroes] = useState([]);
  const [selectedHeroId, setSelectedHeroId] = useState(null);

  useEffect(() => {
    setSelectedIds([...bannerHeroes]);
    setBoardPositions(Array(9).fill(null));
    setReserveHeroes([]);
    setSelectedHeroId(null);
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
    setBoardPositions(current => {
      const next = [...current];
      const existing = next[slotIndex];
      if (existing && existing === selectedHeroId) return next;
      // Remove hero from other slots or reserve
      for (let i = 0; i < next.length; i++) {
        if (next[i] === selectedHeroId) next[i] = null;
      }
      setReserveHeroes(res => res.filter(id => id !== selectedHeroId));
      next[slotIndex] = selectedHeroId;
      return next;
    });
  };

  const handleReserveClick = (slotIndex) => {
    if (!selectedHeroId) return;
    setReserveHeroes(current => {
      const next = [...current];
      if (next[slotIndex] === selectedHeroId) return next;
      // Remove hero from board
      setBoardPositions(currentBoard => currentBoard.map(id => (id === selectedHeroId ? null : id)));
      // Remove hero from other reserve slots
      const filtered = next.filter(id => id !== selectedHeroId);
      if (slotIndex < filtered.length) {
        filtered[slotIndex] = selectedHeroId;
      } else if (filtered.length < 2) {
        filtered.push(selectedHeroId);
      }
      return filtered.slice(0, 2);
    });
  };

  const totalRequired = bannerHeroes.length + maxMercs;
  const selectedComplete = selectedIds.length === totalRequired;
  const boardCount = boardPositions.filter(Boolean).length;
  const canConfirm = selectedComplete && boardCount >= 3;

  const confirmSelection = () => {
    if (!canConfirm) return;
    const heroSelections = selectedIds.map(heroId => {
      const boardPos = boardPositions.findIndex(id => id === heroId);
      const position = boardPos >= 0 ? boardPos : null;
      return { heroId, position, augments: [] };
    });
    onConfirm && onConfirm(heroSelections);
  };

  const getHero = (id) => HEROES.find(h => h.id === id);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Assemble Your Expedition</div>
        <div style={styles.subtitle}>Choose {maxMercs} mercenaries to join your banner heroes</div>
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
                  style={{ ...styles.slot, ...(heroId ? styles.slotFilled : {}) }}
                  onClick={() => handleReserveClick(i)}
                >
                  {hero ? (
                    <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.slotHeroImage} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.helper}>
          Select a hero, then click a slot to place them. You need at least 3 heroes on the board.
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
    </div>
  );
}
