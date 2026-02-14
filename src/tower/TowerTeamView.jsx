// src/tower/TowerTeamView.jsx
// View current team with augments and board positioning

import React, { useState, useEffect } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';
import { AUGMENTS } from './augments.js';
import { getAugmentCap, updateHeroPositions, saveTowerRun } from './towerState.js';
import { indexToTowerPosition } from '../targeting.js';

const TIER_COLORS = {
  common: { bg: '#374151', border: '#6b7280', text: '#9ca3af' },
  uncommon: { bg: '#065f46', border: '#10b981', text: '#34d399' },
  rare: { bg: '#1e40af', border: '#3b82f6', text: '#60a5fa' },
  epic: { bg: '#581c87', border: '#a855f7', text: '#c084fc' },
  legendary: { bg: '#78350f', border: '#f59e0b', text: '#fbbf24' }
};

const ROW_LABELS = ['Back Row', 'Middle Row', 'Front Row'];

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #1a0a2e 0%, #0d0015 100%)',
    color: '#fff'
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    marginBottom: '8px',
    textShadow: '0 0 20px #8b5cf6'
  },
  subtitle: {
    color: '#a78bfa',
    fontSize: '0.9rem'
  },
  stats: {
    display: 'flex',
    gap: '20px',
    marginTop: '10px'
  },
  statItem: {
    fontSize: '0.85rem',
    color: '#9ca3af'
  },
  statValue: {
    fontWeight: 'bold',
    color: '#fff'
  },
  mainLayout: {
    display: 'flex',
    gap: '24px',
    width: '95%',
    maxWidth: '1800px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  boardSection: {
    flex: '0 0 380px',
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
  heroListSection: {
    flex: '1 1 600px',
    maxHeight: '70vh',
    overflowY: 'auto'
  },
  heroList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  heroCard: {
    background: 'rgba(30, 20, 50, 0.6)',
    border: '1px solid #6d28d9',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    gap: '12px'
  },
  heroCardSelected: {
    border: '2px solid #10b981',
    boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
  },
  heroInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '90px',
    cursor: 'pointer'
  },
  heroImage: {
    width: '60px',
    height: '60px',
    borderRadius: '8px',
    objectFit: 'cover',
    marginBottom: '6px',
    border: '2px solid #6d28d9'
  },
  heroName: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    marginBottom: '4px',
    textAlign: 'center'
  },
  heroStats: {
    fontSize: '0.7rem',
    color: '#9ca3af',
    textAlign: 'center'
  },
  heroPosition: {
    fontSize: '0.7rem',
    color: '#a78bfa',
    marginTop: '2px'
  },
  augmentSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  augmentHeader: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#a78bfa',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  augmentCount: {
    fontSize: '0.7rem',
    color: '#6b7280',
    fontWeight: 'normal'
  },
  augmentGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  augmentTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '16px',
    fontSize: '0.7rem',
    fontWeight: 'bold'
  },
  noAugments: {
    color: '#6b7280',
    fontSize: '0.8rem',
    fontStyle: 'italic'
  },
  buttonBar: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px'
  },
  button: {
    padding: '12px 32px',
    fontSize: '1rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase'
  },
  tooltip: {
    position: 'relative',
    cursor: 'help'
  },
  tooltipText: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.95)',
    border: '1px solid #6d28d9',
    borderRadius: '8px',
    padding: '10px',
    minWidth: '180px',
    zIndex: 100,
    fontSize: '0.75rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
  },
  tooltipTitle: {
    fontWeight: 'bold',
    marginBottom: '4px'
  },
  tooltipDesc: {
    color: '#d1d5db',
    lineHeight: '1.4'
  }
};

function AugmentTag({ augmentId }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const augment = AUGMENTS[augmentId];
  
  if (!augment) return null;

  const tierStyle = TIER_COLORS[augment.tier] || TIER_COLORS.common;

  return (
    <div
      style={styles.tooltip}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        style={{
          ...styles.augmentTag,
          background: tierStyle.bg,
          border: `1px solid ${tierStyle.border}`,
          color: tierStyle.text
        }}
      >
        <span>{getAugmentIcon(augment.type)}</span>
        <span>{augment.name}</span>
      </div>
      
      {showTooltip && (
        <div style={styles.tooltipText}>
          <div style={{ ...styles.tooltipTitle, color: tierStyle.text }}>
            {augment.name} ({augment.tier})
          </div>
          <div style={styles.tooltipDesc}>{augment.description}</div>
        </div>
      )}
    </div>
  );
}

function getAugmentIcon(type) {
  switch (type) {
    case 'stat': return '📊';
    case 'spell': return '🔮';
    case 'effect': return '✨';
    case 'debuff': return '☠️';
    case 'special': return '⭐';
    default: return '❓';
  }
}

function getPositionLabel(position) {
  if (position === null || position === undefined) return 'Reserve';
  const row = Math.floor(position / 3);
  const col = position % 3;
  const colNames = ['Left', 'Center', 'Right'];
  return `${ROW_LABELS[row]} ${colNames[col]}`;
}

export default function TowerTeamView({ runState, onBack, onSave }) {
  const heroEntries = runState.selectedHeroes || [];
  
  // Build board state from hero positions
  const [boardPositions, setBoardPositions] = useState(Array(9).fill(null));
  const [reserveHeroes, setReserveHeroes] = useState([]);
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from runState
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

  const totalAugments = heroEntries.reduce(
    (sum, entry) => sum + (entry?.augments?.length || 0), 
    0
  );

  const mainCount = boardPositions.filter(idx => idx !== null).length;
  const canPlaceOnBoard = mainCount < 5;

  const getHeroById = (id) => HEROES.find(h => h.id === id);

  const handleHeroClick = (heroIndex) => {
    if (selectedHeroIndex === heroIndex) {
      setSelectedHeroIndex(null);
    } else {
      setSelectedHeroIndex(heroIndex);
    }
  };

  const handleBoardSlotClick = (position) => {
    if (selectedHeroIndex === null) {
      // Pick up hero from this slot
      const heroIdx = boardPositions[position];
      if (heroIdx !== null) {
        setSelectedHeroIndex(heroIdx);
      }
      return;
    }

    // Prevent placing a reserve hero onto a full main board unless swapping
    const selectedIsOnBoard = boardPositions.includes(selectedHeroIndex);
    if (!selectedIsOnBoard && !canPlaceOnBoard) {
      const targetHasHero = boardPositions[position] !== null;
      if (!targetHasHero) return;
    }
    
    // Place selected hero here
    const currentHeroIdx = boardPositions[position];
    
    setBoardPositions(prev => {
      const newBoard = [...prev];
      // Remove selected hero from old position
      const oldPos = newBoard.indexOf(selectedHeroIndex);
      if (oldPos >= 0) newBoard[oldPos] = null;
      // Swap if there's a hero in target slot
      if (currentHeroIdx !== null) {
        if (oldPos >= 0) {
          newBoard[oldPos] = currentHeroIdx;
        } else {
          // Was in reserve, put displaced hero in reserve
          setReserveHeroes(prev => [...prev.filter(i => i !== selectedHeroIndex), currentHeroIdx]);
        }
      }
      newBoard[position] = selectedHeroIndex;
      return newBoard;
    });
    
    // Remove from reserve if was there
    setReserveHeroes(prev => prev.filter(i => i !== selectedHeroIndex));
    setSelectedHeroIndex(null);
    setHasChanges(true);
  };

  const handleReserveClick = (reserveIdx) => {
    if (selectedHeroIndex === null) {
      // Pick up hero from reserve
      const heroIdx = reserveHeroes[reserveIdx];
      if (heroIdx !== undefined) {
        setSelectedHeroIndex(heroIdx);
      }
      return;
    }

    const reserveHeroIdx = reserveHeroes[reserveIdx];
    const selectedWasOnBoard = boardPositions.includes(selectedHeroIndex);

    // Swap with reserve hero if slot occupied
    if (reserveHeroIdx !== undefined && selectedWasOnBoard) {
      setBoardPositions(prev => {
        const newBoard = [...prev];
        const oldPos = newBoard.indexOf(selectedHeroIndex);
        if (oldPos >= 0) newBoard[oldPos] = reserveHeroIdx;
        return newBoard;
      });

      setReserveHeroes(prev => {
        const newReserve = [...prev];
        const selectedIdx = newReserve.indexOf(selectedHeroIndex);
        if (selectedIdx >= 0) newReserve[selectedIdx] = reserveHeroIdx;
        newReserve[reserveIdx] = selectedHeroIndex;
        return newReserve;
      });
    } else {
      // Put selected hero in reserve
      setBoardPositions(prev => {
        const newBoard = [...prev];
        const oldPos = newBoard.indexOf(selectedHeroIndex);
        if (oldPos >= 0) newBoard[oldPos] = null;
        return newBoard;
      });
      
      setReserveHeroes(prev => {
        const newReserve = prev.filter(i => i !== selectedHeroIndex);
        newReserve.push(selectedHeroIndex);
        return newReserve;
      });
    }
    
    setSelectedHeroIndex(null);
    setHasChanges(true);
  };

  const handleSavePositions = () => {
    // Build position updates
    const positionUpdates = heroEntries.map((entry, idx) => {
      const boardPos = boardPositions.indexOf(idx);
      return {
        heroIndex: idx,
        position: boardPos >= 0 ? boardPos : null
      };
    });
    
    const updatedRun = updateHeroPositions(runState, positionUpdates);
    saveTowerRun(updatedRun);
    setHasChanges(false);
    if (onSave) onSave(updatedRun);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Your Champions</h1>
        <p style={styles.subtitle}>Tower of Shattered Champions - Level {runState.currentLevel}</p>
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{heroEntries.length}</span> Heroes
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{totalAugments}</span> Total Augments
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{runState.currentLevel - 1}</span> Levels Cleared
          </div>
        </div>
      </div>

      <div style={styles.mainLayout}>
        {/* Board Section */}
        <div style={styles.boardSection}>
          <div style={styles.boardTitle}>Starting Positions</div>
          
          <div style={styles.board}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(displayIndex => {
              const towerPos = indexToTowerPosition(displayIndex, 'p1');
              const heroIdx = towerPos != null ? boardPositions[towerPos] : null;
              const entry = heroIdx !== null ? heroEntries[heroIdx] : null;
              const hero = entry ? getHeroById(entry.heroId) : null;
              const rowIdx = towerPos != null ? Math.floor(towerPos / 3) : 0;
              const selectedIsOnBoard = selectedHeroIndex !== null && boardPositions.includes(selectedHeroIndex);
              const isValidSwapTarget = selectedHeroIndex !== null && hero && !selectedIsOnBoard;
              const isValidEmptyTarget = selectedHeroIndex !== null && !hero && (canPlaceOnBoard || selectedIsOnBoard);
              const isHighlight = isValidSwapTarget || isValidEmptyTarget;

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
                const heroIdx = reserveHeroes[idx];
                const entry = heroIdx !== undefined ? heroEntries[heroIdx] : null;
                const hero = entry ? getHeroById(entry.heroId) : null;
                const isHighlight = selectedHeroIndex !== null && !hero;

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
            {selectedHeroIndex !== null 
              ? (canPlaceOnBoard || boardPositions.includes(selectedHeroIndex)
                ? `📍 Click slot to place ${getHeroById(heroEntries[selectedHeroIndex]?.heroId)?.name}`
                : 'Main board is full. Move a hero to reserve first.')
              : '👆 Click a hero to move them'
            }
          </div>

          {hasChanges && (
            <button
              style={{ ...styles.button, marginTop: '12px', width: '100%', padding: '10px' }}
              onClick={handleSavePositions}
            >
              Save Positions
            </button>
          )}
        </div>

        {/* Hero List with Augments */}
        <div style={styles.heroListSection}>
          <div style={styles.heroList}>
            {heroEntries.map((entry, idx) => {
              const hero = getHeroById(entry.heroId);
              if (!hero) return null;

              const augments = entry.augments || [];
              const isSelected = selectedHeroIndex === idx;
              const position = boardPositions.indexOf(idx);

              return (
                <div
                  key={idx}
                  style={{
                    ...styles.heroCard,
                    ...(isSelected ? styles.heroCardSelected : {})
                  }}
                >
                  <div style={styles.heroInfo} onClick={() => handleHeroClick(idx)}>
                    <img
                      src={getAssetPath(hero.image)}
                      alt={hero.name}
                      style={styles.heroImage}
                      onError={(e) => { e.target.src = getAssetPath('/images/heroes/default.jpg'); }}
                    />
                    <div style={styles.heroName}>{hero.name}</div>
                    <div style={styles.heroStats}>
                      ❤️{hero.health} 🛡️{hero.armor} ⚡{hero.speed}
                    </div>
                    <div style={styles.heroPosition}>
                      {getPositionLabel(position >= 0 ? position : null)}
                    </div>
                  </div>

                  <div style={styles.augmentSection}>
                    <div style={styles.augmentHeader}>
                      Augments
                      <span style={styles.augmentCount}>
                        {augments.length}/{getAugmentCap(runState)}
                      </span>
                    </div>
                    
                    {augments.length > 0 ? (
                      <div style={styles.augmentGrid}>
                        {augments.map((aug, augIdx) => (
                          <AugmentTag key={augIdx} augmentId={aug.augmentId} />
                        ))}
                      </div>
                    ) : (
                      <div style={styles.noAugments}>No augments yet</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={styles.buttonBar}>
        <button style={styles.button} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
