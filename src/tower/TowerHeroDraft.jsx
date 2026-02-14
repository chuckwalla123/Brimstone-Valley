// src/tower/TowerHeroDraft.jsx
// Initial draft: pick 3 heroes from 10 random options

import React, { useMemo, useState } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';
import { setSelectedHeroes, saveTowerRun } from './towerState.js';
import { indexToTowerPosition } from '../targeting.js';

const ROW_LABELS = ['Back Row', 'Middle Row', 'Front Row'];

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #1a0a2e 0%, #0d0015 100%)',
    color: '#fff',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    textShadow: '0 0 20px #8b5cf6'
  },
  subtitle: {
    color: '#a78bfa',
    marginTop: '6px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    width: '100%',
    maxWidth: '1000px'
  },
  placementSection: {
    marginTop: '24px',
    width: '100%',
    maxWidth: '1000px',
    background: 'rgba(30, 20, 50, 0.6)',
    border: '1px solid #6d28d9',
    borderRadius: '12px',
    padding: '16px'
  },
  boardTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#a78bfa',
    textAlign: 'center'
  },
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 100px)',
    gridTemplateRows: 'repeat(3, 100px)',
    gap: '8px',
    justifyContent: 'center'
  },
  boardSlot: {
    background: 'rgba(0, 0, 0, 0.4)',
    border: '2px dashed #4c1d95',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative'
  },
  boardSlotFilled: {
    border: '2px solid #6d28d9',
    background: 'rgba(139, 92, 246, 0.15)'
  },
  boardSlotHighlight: {
    border: '2px solid #10b981',
    background: 'rgba(16, 185, 129, 0.2)',
    boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
  },
  boardSlotLabel: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    fontSize: '0.55rem',
    color: '#6b7280',
    opacity: 0.7
  },
  reserveSection: {
    marginTop: '16px'
  },
  reserveTitle: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#a78bfa',
    textAlign: 'center'
  },
  reserveSlots: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center'
  },
  reserveSlot: {
    width: '80px',
    height: '80px',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '2px dashed #4c1d95',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  reserveSlotFilled: {
    border: '2px solid #6d28d9',
    background: 'rgba(139, 92, 246, 0.15)'
  },
  instructions: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: '12px',
    padding: '8px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '6px'
  },
  selectedRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '16px'
  },
  selectedCard: {
    width: '110px',
    padding: '8px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,0.35)',
    border: '2px solid transparent',
    textAlign: 'center',
    cursor: 'pointer'
  },
  selectedCardActive: {
    border: '2px solid #10b981',
    boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
  },
  card: {
    background: 'rgba(0,0,0,0.35)',
    border: '2px solid transparent',
    borderRadius: '10px',
    padding: '10px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease'
  },
  cardSelected: {
    border: '2px solid #8b5cf6',
    boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
  },
  cardDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed'
  },
  heroImage: {
    width: '70px',
    height: '70px',
    borderRadius: '8px',
    objectFit: 'cover',
    marginBottom: '6px'
  },
  heroName: {
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  slotHeroImage: {
    width: '65px',
    height: '65px',
    objectFit: 'cover',
    borderRadius: '6px'
  },
  slotHeroName: {
    fontSize: '0.6rem',
    fontWeight: 'bold',
    color: '#fff',
    marginTop: '2px',
    textAlign: 'center',
    maxWidth: '90px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  buttonBar: {
    marginTop: '20px',
    display: 'flex',
    gap: '12px'
  },
  button: {
    padding: '12px 24px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textTransform: 'uppercase'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    color: '#fff'
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed'
  }
};

export default function TowerHeroDraft({ runState, onConfirm, onBack }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [boardPositions, setBoardPositions] = useState(Array(9).fill(null));
  const [reserveHeroes, setReserveHeroes] = useState([]);
  const [selectedHeroId, setSelectedHeroId] = useState(null);

  const heroOptions = useMemo(() => {
    const pool = HEROES.filter(h => h.draftable !== false);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(10, shuffled.length));
  }, [runState?.startedAt]);

  const toggleSelect = (heroId) => {
    setSelectedIds(prev => {
      if (prev.includes(heroId)) {
        // Remove hero from selection and any placement
        setBoardPositions(current => current.map(id => (id === heroId ? null : id)));
        setReserveHeroes(current => current.filter(id => id !== heroId));
        if (selectedHeroId === heroId) setSelectedHeroId(null);
        return prev.filter(id => id !== heroId);
      }
      if (prev.length >= 3) return prev;
      setReserveHeroes(current => {
        if (current.length >= 2 && !current.includes(heroId)) {
          setBoardPositions(board => {
            const next = [...board];
            if (next.indexOf(heroId) === -1) {
              const openIdx = next.findIndex(id => id === null);
              if (openIdx >= 0) next[openIdx] = heroId;
            }
            return next;
          });
          return current;
        }
        return current.includes(heroId) ? current : [...current, heroId];
      });
      return [...prev, heroId];
    });
  };

  const getHeroById = (id) => HEROES.find(h => h.id === id);

  const handleBoardSlotClick = (position) => {
    if (selectedHeroId === null) {
      const heroId = boardPositions[position];
      if (heroId) setSelectedHeroId(heroId);
      return;
    }

    const currentHeroId = boardPositions[position];
    setBoardPositions(prev => {
      const next = [...prev];
      const oldPos = next.indexOf(selectedHeroId);
      if (oldPos >= 0) next[oldPos] = null;
      if (currentHeroId && currentHeroId !== selectedHeroId) {
        if (oldPos >= 0) {
          next[oldPos] = currentHeroId;
        } else {
          setReserveHeroes(current => [...current.filter(id => id !== selectedHeroId), currentHeroId]);
        }
      }
      next[position] = selectedHeroId;
      return next;
    });

    setReserveHeroes(prev => prev.filter(id => id !== selectedHeroId));
    setSelectedHeroId(null);
  };

  const handleReserveClick = (slotIndex) => {
    if (selectedHeroId === null) {
      const heroId = reserveHeroes[slotIndex];
      if (heroId) setSelectedHeroId(heroId);
      return;
    }
    if (!reserveHeroes.includes(selectedHeroId) && reserveHeroes.length >= 2) {
      return;
    }

    setBoardPositions(prev => {
      const next = [...prev];
      const oldPos = next.indexOf(selectedHeroId);
      if (oldPos >= 0) next[oldPos] = null;
      return next;
    });

    setReserveHeroes(prev => {
      const next = prev.filter(id => id !== selectedHeroId);
      next.push(selectedHeroId);
      return next.slice(0, 2);
    });

    setSelectedHeroId(null);
  };

  const handleConfirm = () => {
    if (selectedIds.length !== 3) return;
    const heroSelections = selectedIds.map(heroId => ({
      heroId,
      position: boardPositions.indexOf(heroId) >= 0 ? boardPositions.indexOf(heroId) : null
    }));
    const updatedRun = setSelectedHeroes(runState, heroSelections);
    saveTowerRun(updatedRun);
    onConfirm && onConfirm(updatedRun);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Choose Your First 3 Champions</div>
        <div style={styles.subtitle}>Pick 3 out of 10 random heroes</div>
        <div style={{ marginTop: 8, color: selectedIds.length === 3 ? '#10b981' : '#f59e0b' }}>
          {selectedIds.length} / 3 selected
        </div>
      </div>

      <div style={styles.grid}>
        {heroOptions.map(hero => {
          const isSelected = selectedIds.includes(hero.id);
          const isDisabled = !isSelected && selectedIds.length >= 3;
          return (
            <div
              key={hero.id}
              style={{
                ...styles.card,
                ...(isSelected ? styles.cardSelected : {}),
                ...(isDisabled ? styles.cardDisabled : {})
              }}
              onClick={() => !isDisabled && toggleSelect(hero.id)}
            >
              <img
                src={getAssetPath(hero.image)}
                alt={hero.name}
                style={styles.heroImage}
                onError={(e) => { e.target.src = getAssetPath('/images/heroes/default.jpg'); }}
              />
              <div style={styles.heroName}>{hero.name}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.placementSection}>
        <div style={styles.boardTitle}>Starting Positions</div>

        <div style={styles.selectedRow}>
          {selectedIds.map(heroId => {
            const hero = getHeroById(heroId);
            if (!hero) return null;
            const isActive = selectedHeroId === heroId;
            return (
              <div
                key={heroId}
                style={{
                  ...styles.selectedCard,
                  ...(isActive ? styles.selectedCardActive : {})
                }}
                onClick={() => setSelectedHeroId(isActive ? null : heroId)}
              >
                <img
                  src={getAssetPath(hero.image)}
                  alt={hero.name}
                  style={styles.heroImage}
                  onError={(e) => { e.target.src = getAssetPath('/images/heroes/default.jpg'); }}
                />
                <div style={styles.heroName}>{hero.name}</div>
              </div>
            );
          })}
        </div>

        <div style={styles.board}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(displayIndex => {
            const towerPos = indexToTowerPosition(displayIndex, 'p1');
            const heroId = towerPos != null ? boardPositions[towerPos] : null;
            const hero = heroId ? getHeroById(heroId) : null;
            const rowIdx = towerPos != null ? Math.floor(towerPos / 3) : 0;
            const isHighlight = selectedHeroId !== null && !hero;

            return (
              <div
                key={displayIndex}
                style={{
                  ...styles.boardSlot,
                  ...(hero ? styles.boardSlotFilled : {}),
                  ...(isHighlight ? styles.boardSlotHighlight : {})
                }}
                onClick={() => towerPos != null && handleBoardSlotClick(towerPos)}
              >
                <div style={styles.boardSlotLabel}>{ROW_LABELS[rowIdx]}</div>
                {hero ? (
                  <>
                    <img
                      src={getAssetPath(hero.image)}
                      alt={hero.name}
                      style={styles.slotHeroImage}
                      onError={(e) => { e.target.src = getAssetPath('/images/heroes/default.jpg'); }}
                    />
                    <div style={styles.slotHeroName}>{hero.name}</div>
                  </>
                ) : (
                  <span style={{ color: '#4c1d95', fontSize: '0.65rem' }}>Empty</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.reserveSection}>
          <div style={styles.reserveTitle}>Reserve</div>
          <div style={styles.reserveSlots}>
            {[0, 1].map(idx => {
              const heroId = reserveHeroes[idx];
              const hero = heroId ? getHeroById(heroId) : null;
              const isHighlight = selectedHeroId !== null && !hero;

              return (
                <div
                  key={idx}
                  style={{
                    ...styles.reserveSlot,
                    ...(hero ? styles.reserveSlotFilled : {}),
                    ...(isHighlight ? styles.boardSlotHighlight : {})
                  }}
                  onClick={() => handleReserveClick(idx)}
                >
                  {hero ? (
                    <>
                      <img
                        src={getAssetPath(hero.image)}
                        alt={hero.name}
                        style={{ ...styles.slotHeroImage, width: '50px', height: '50px' }}
                        onError={(e) => { e.target.src = getAssetPath('/images/heroes/default.jpg'); }}
                      />
                      <div style={{ ...styles.slotHeroName, fontSize: '0.55rem' }}>{hero.name}</div>
                    </>
                  ) : (
                    <span style={{ color: '#4c1d95', fontSize: '0.6rem' }}>Reserve</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.instructions}>
          {selectedHeroId !== null
            ? '📍 Click a slot to place your selected hero'
            : '👆 Click a selected hero to place them'}
        </div>
      </div>

      <div style={styles.buttonBar}>
        {onBack && (
          <button style={{ ...styles.button, background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid #6d28d9' }} onClick={onBack}>
            Back
          </button>
        )}
        <button
          style={{
            ...styles.button,
            ...styles.primaryButton,
            ...((selectedIds.length !== 3 || boardPositions.every(p => p === null)) ? styles.disabledButton : {})
          }}
          onClick={handleConfirm}
          disabled={selectedIds.length !== 3 || boardPositions.every(p => p === null)}
        >
          Begin Ascent
        </button>
      </div>
    </div>
  );
}
