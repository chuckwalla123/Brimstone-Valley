// src/tower/TowerRecruitChoice.jsx
// Post-battle recruit: add 1 hero or swap if team is full

import React, { useMemo, useState, useEffect } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';
import { addHeroToRun, getRecruitChoices, saveTowerRun, updateHeroPositions } from './towerState.js';
import { indexToTowerPosition } from '../targeting.js';

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
  row: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  card: {
    background: 'rgba(0,0,0,0.35)',
    border: '2px solid transparent',
    borderRadius: '10px',
    padding: '10px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s ease',
    width: '120px'
  },
  cardSelected: {
    border: '2px solid #8b5cf6',
    boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
  },
  placementSection: {
    marginTop: '20px',
    background: 'rgba(30, 20, 50, 0.6)',
    border: '1px solid #6d28d9',
    borderRadius: '12px',
    padding: '16px',
    width: '100%',
    maxWidth: '900px'
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
  boardSlotSelected: {
    border: '2px solid #fbbf24',
    boxShadow: '0 0 10px rgba(251, 191, 36, 0.4)'
  },
  boardSlotLabel: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    fontSize: '0.55rem',
    color: '#6b7280',
    opacity: 0.7
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
  section: {
    marginTop: '20px',
    background: 'rgba(30, 20, 50, 0.6)',
    border: '1px solid #6d28d9',
    borderRadius: '12px',
    padding: '16px',
    width: '100%',
    maxWidth: '900px'
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#a78bfa',
    marginBottom: '12px',
    textAlign: 'center'
  },
  button: {
    padding: '12px 24px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textTransform: 'uppercase',
    marginTop: '18px'
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

const ROW_LABELS = ['Back Row', 'Middle Row', 'Front Row'];

export default function TowerRecruitChoice({ runState, onConfirm, onSkip, onExit }) {
  const [selectedRecruitId, setSelectedRecruitId] = useState(null);
  const [selectedSwapIndex, setSelectedSwapIndex] = useState(null);
  const [selectedPlacement, setSelectedPlacement] = useState(null);
  const [boardPositions, setBoardPositions] = useState(Array(9).fill(null));
  const [reserveHeroes, setReserveHeroes] = useState([]);
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(null);

  const heroEntries = runState.selectedHeroes || [];
  const teamFull = heroEntries.length >= 7;
  const mainCount = boardPositions.filter(idx => idx !== null).length;
  const canPlaceOnBoard = !teamFull && mainCount < 5;

  const recruitOptions = useMemo(() => getRecruitChoices(runState, 3), [runState]);

  const getHeroById = (id) => HEROES.find(h => h.id === id);

  useEffect(() => {
    const board = Array(9).fill(null);
    const reserve = [];
    heroEntries.forEach((entry, idx) => {
      if (entry.position !== null && entry.position >= 0 && entry.position < 9) {
        board[entry.position] = idx;
      } else {
        reserve.push(idx);
      }
    });
    setBoardPositions(board);
    setReserveHeroes(reserve);
  }, [runState]);

  useEffect(() => {
    setSelectedPlacement(null);
  }, [selectedRecruitId, runState]);

  const handlePlacementSelect = (placement) => {
    if (teamFull) return;
    if (!selectedRecruitId) return;
    if (placement?.type === 'board' && !canPlaceOnBoard) return;
    setSelectedHeroIndex(null);
    setSelectedPlacement(placement);
  };

  const clearPlacementIfInvalid = (nextBoard, nextReserve) => {
    if (!selectedPlacement) return;
    if (selectedPlacement.type === 'board') {
      if (nextBoard[selectedPlacement.index] !== null) {
        setSelectedPlacement(null);
      }
    } else if (selectedPlacement.type === 'reserve') {
      const heroIdx = nextReserve[selectedPlacement.index];
      if (heroIdx !== undefined) {
        setSelectedPlacement(null);
      }
    }
  };

  const handleBoardSlotClick = (position, isEmpty) => {
    if (selectedHeroIndex === null) {
      const heroIdx = boardPositions[position];
      if (heroIdx !== null) {
        setSelectedHeroIndex(heroIdx);
        setSelectedPlacement(null);
        return;
      }
      if (isEmpty) {
        handlePlacementSelect({ type: 'board', index: position });
      }
      return;
    }

    const selectedIsOnBoard = boardPositions.includes(selectedHeroIndex);
    if (!selectedIsOnBoard && !canPlaceOnBoard) {
      const targetHasHero = boardPositions[position] !== null;
      if (!targetHasHero) return;
    }

    const currentHeroIdx = boardPositions[position];
    setBoardPositions(prev => {
      const next = [...prev];
      const oldPos = next.indexOf(selectedHeroIndex);
      if (oldPos >= 0) next[oldPos] = null;
      if (currentHeroIdx !== null) {
        if (oldPos >= 0) {
          next[oldPos] = currentHeroIdx;
        } else {
          setReserveHeroes(current => [...current.filter(i => i !== selectedHeroIndex), currentHeroIdx]);
        }
      }
      next[position] = selectedHeroIndex;
      clearPlacementIfInvalid(next, reserveHeroes);
      return next;
    });

    setReserveHeroes(prev => {
      const next = prev.filter(i => i !== selectedHeroIndex);
      clearPlacementIfInvalid(boardPositions, next);
      return next;
    });
    setSelectedHeroIndex(null);
  };

  const handleReserveSlotClick = (reserveIdx, isEmpty) => {
    if (selectedHeroIndex === null) {
      const heroIdx = reserveHeroes[reserveIdx];
      if (heroIdx !== undefined) {
        setSelectedHeroIndex(heroIdx);
        setSelectedPlacement(null);
        return;
      }
      if (isEmpty) {
        handlePlacementSelect({ type: 'reserve', index: reserveIdx });
      }
      return;
    }

    const reserveHeroIdx = reserveHeroes[reserveIdx];
    const selectedWasOnBoard = boardPositions.includes(selectedHeroIndex);

    if (reserveHeroIdx !== undefined && selectedWasOnBoard) {
      setBoardPositions(prev => {
        const next = [...prev];
        const oldPos = next.indexOf(selectedHeroIndex);
        if (oldPos >= 0) next[oldPos] = reserveHeroIdx;
        clearPlacementIfInvalid(next, reserveHeroes);
        return next;
      });

      setReserveHeroes(prev => {
        const next = [...prev];
        const selectedIdx = next.indexOf(selectedHeroIndex);
        if (selectedIdx >= 0) next[selectedIdx] = reserveHeroIdx;
        next[reserveIdx] = selectedHeroIndex;
        clearPlacementIfInvalid(boardPositions, next);
        return next;
      });
    } else {
      setBoardPositions(prev => {
        const next = [...prev];
        const oldPos = next.indexOf(selectedHeroIndex);
        if (oldPos >= 0) next[oldPos] = null;
        clearPlacementIfInvalid(next, reserveHeroes);
        return next;
      });

      setReserveHeroes(prev => {
        const next = prev.filter(i => i !== selectedHeroIndex);
        next.push(selectedHeroIndex);
        clearPlacementIfInvalid(boardPositions, next);
        return next;
      });
    }

    setSelectedHeroIndex(null);
  };

  const handleConfirm = () => {
    if (!selectedRecruitId) return;
    if (teamFull && (selectedSwapIndex == null)) return;
    const positionUpdates = heroEntries.map((entry, idx) => {
      const boardPos = boardPositions.indexOf(idx);
      return {
        heroIndex: idx,
        position: boardPos >= 0 ? boardPos : null
      };
    });
    const withPositions = updateHeroPositions(runState, positionUpdates);
    const updatedRun = addHeroToRun(withPositions, selectedRecruitId, teamFull ? selectedSwapIndex : null);
    let finalRun = updatedRun;
    if (!teamFull) {
      const newHeroIndex = (finalRun.selectedHeroes || []).length - 1;
      if (selectedPlacement?.type === 'board' && typeof selectedPlacement.index === 'number') {
        const positionUpdates = [{ heroIndex: newHeroIndex, position: selectedPlacement.index }];
        finalRun = updateHeroPositions(finalRun, positionUpdates);
      } else if (selectedPlacement?.type === 'reserve') {
        const positionUpdates = [{ heroIndex: newHeroIndex, position: null }];
        finalRun = updateHeroPositions(finalRun, positionUpdates);
      }
    }
    saveTowerRun(finalRun);
    onConfirm && onConfirm(finalRun);
  };

  const handleExit = () => {
    const positionUpdates = heroEntries.map((entry, idx) => {
      const boardPos = boardPositions.indexOf(idx);
      return {
        heroIndex: idx,
        position: boardPos >= 0 ? boardPos : null
      };
    });
    const updatedRun = updateHeroPositions(runState, positionUpdates);
    saveTowerRun(updatedRun);
    onExit && onExit(updatedRun);
  };

  const handleSkip = () => {
    const positionUpdates = heroEntries.map((entry, idx) => {
      const boardPos = boardPositions.indexOf(idx);
      return {
        heroIndex: idx,
        position: boardPos >= 0 ? boardPos : null
      };
    });
    const updatedRun = updateHeroPositions(runState, positionUpdates);
    saveTowerRun(updatedRun);
    onSkip && onSkip(updatedRun);
  };

  const canConfirm = selectedRecruitId && (!teamFull || selectedSwapIndex != null) && (teamFull || selectedPlacement);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Recruit a New Champion</div>
        <div style={styles.subtitle}>
          {teamFull ? 'Choose a recruit and swap with an existing hero' : 'Choose 1 hero to add to your squad'}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Recruit Options</div>
        <div style={styles.row}>
          {recruitOptions.map(hero => {
            const isSelected = selectedRecruitId === hero.id;
            return (
              <div
                key={hero.id}
                style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}) }}
                onClick={() => setSelectedRecruitId(hero.id)}
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
      </div>

      <div style={styles.placementSection}>
        <div style={styles.boardTitle}>Place Recruited Hero</div>

        <div style={styles.board}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(displayIndex => {
            const towerPos = indexToTowerPosition(displayIndex, 'p1');
            const heroIdx = towerPos != null ? boardPositions[towerPos] : null;
            const entry = heroIdx !== null ? heroEntries[heroIdx] : null;
            const hero = entry ? getHeroById(entry.heroId) : null;
            const rowIdx = towerPos != null ? Math.floor(towerPos / 3) : 0;
            const isEmpty = !hero;
            const isSelected = selectedPlacement?.type === 'board' && selectedPlacement.index === towerPos;
            const selectedIsOnBoard = selectedHeroIndex !== null && boardPositions.includes(selectedHeroIndex);
            const isValidSwapTarget = selectedHeroIndex !== null && hero && !selectedIsOnBoard;
            const isValidEmptyTarget = selectedHeroIndex !== null && !hero && (canPlaceOnBoard || selectedIsOnBoard);
            const isHighlight = (canPlaceOnBoard && selectedRecruitId && isEmpty) || isValidSwapTarget || isValidEmptyTarget;

            return (
              <div
                key={displayIndex}
                style={{
                  ...styles.boardSlot,
                  ...(hero ? styles.boardSlotFilled : {}),
                  ...(isHighlight ? styles.boardSlotHighlight : {}),
                  ...(isSelected ? styles.boardSlotSelected : {})
                }}
                onClick={() => towerPos != null && handleBoardSlotClick(towerPos, isEmpty)}
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
              const heroIdx = reserveHeroes[idx];
              const entry = heroIdx !== undefined ? heroEntries[heroIdx] : null;
              const hero = entry ? getHeroById(entry.heroId) : null;
              const isEmpty = !hero;
              const isSelected = selectedPlacement?.type === 'reserve' && selectedPlacement.index === idx;
              const isHighlight = (!teamFull && selectedRecruitId && isEmpty) || (selectedHeroIndex !== null && isEmpty);

              return (
                <div
                  key={idx}
                  style={{
                    ...styles.reserveSlot,
                    ...(hero ? styles.reserveSlotFilled : {}),
                    ...(isHighlight ? styles.boardSlotHighlight : {}),
                    ...(isSelected ? styles.boardSlotSelected : {})
                  }}
                  onClick={() => handleReserveSlotClick(idx, isEmpty)}
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
          {teamFull
            ? 'Team is full. Swap a hero to recruit. You can also rearrange your team by selecting a hero and clicking a legal slot.'
            : (selectedRecruitId
              ? (canPlaceOnBoard ? 'Click an empty slot to place your recruit. You can also rearrange your team.' : 'Main board is full. Place your recruit in reserve or swap a hero on the board.')
              : 'Select a recruit, then choose a slot. You can also rearrange your team by selecting a hero.')}
        </div>
      </div>

      {teamFull && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Swap Out</div>
          <div style={styles.row}>
            {heroEntries.map((entry, idx) => {
              const hero = getHeroById(entry.heroId);
              if (!hero) return null;
              const isSelected = selectedSwapIndex === idx;
              return (
                <div
                  key={`${entry.heroId}-${idx}`}
                  style={{ ...styles.card, ...(isSelected ? styles.cardSelected : {}) }}
                  onClick={() => setSelectedSwapIndex(idx)}
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
        </div>
      )}

      <button
        style={{
          ...styles.button,
          ...styles.primaryButton,
          ...(canConfirm ? {} : styles.disabledButton)
        }}
        onClick={handleConfirm}
        disabled={!canConfirm}
      >
        Confirm Recruit
      </button>

      {onSkip && (
        <button
          style={{ ...styles.button, background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid #6d28d9' }}
          onClick={handleSkip}
        >
          Skip Recruit
        </button>
      )}
      {onExit && (
        <button
          style={{ ...styles.button, background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', border: '1px solid #6d28d9' }}
          onClick={handleExit}
        >
          Save & Exit
        </button>
      )}
    </div>
  );
}
