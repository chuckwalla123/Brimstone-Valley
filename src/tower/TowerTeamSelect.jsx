// src/tower/TowerTeamSelect.jsx
// Team selection screen with board positioning for Tower of Shattered Champions

import React, { useState, useMemo } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';
import { setSelectedHeroes, saveTowerRun } from './towerState.js';
import { indexToTowerPosition } from '../targeting.js';

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
  selectionCount: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginTop: '8px',
    color: '#fff'
  },
  mainLayout: {
    display: 'flex',
    gap: '30px',
    width: '95%',
    maxWidth: '1800px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  heroPool: {
    flex: '1 1 500px',
    background: 'rgba(30, 20, 50, 0.6)',
    border: '1px solid #6d28d9',
    borderRadius: '12px',
    padding: '16px',
    maxHeight: '60vh',
    overflowY: 'auto'
  },
  poolTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#a78bfa'
  },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '8px'
  },
  heroCard: {
    position: 'relative',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '2px solid transparent',
    borderRadius: '8px',
    padding: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center'
  },
  heroCardSelected: {
    border: '2px solid #8b5cf6',
    background: 'rgba(139, 92, 246, 0.2)',
    boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
  },
  heroCardDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed'
  },
  heroImage: {
    width: '60px',
    height: '60px',
    objectFit: 'cover',
    borderRadius: '6px',
    marginBottom: '4px'
  },
  heroName: {
    fontSize: '0.65rem',
    fontWeight: 'bold',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  heroStats: {
    fontSize: '0.55rem',
    color: '#9ca3af',
    marginTop: '2px'
  },
  boardSection: {
    flex: '0 0 380px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  boardTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#a78bfa'
  },
  boardContainer: {
    background: 'rgba(30, 20, 50, 0.8)',
    border: '2px solid #6d28d9',
    borderRadius: '12px',
    padding: '16px'
  },
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 100px)',
    gridTemplateRows: 'repeat(3, 100px)',
    gap: '8px'
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
    fontSize: '0.6rem',
    color: '#6b7280',
    opacity: 0.7
  },
  slotHeroImage: {
    width: '70px',
    height: '70px',
    objectFit: 'cover',
    borderRadius: '6px'
  },
  slotHeroName: {
    fontSize: '0.65rem',
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
    marginTop: '16px',
    width: '100%'
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
    justifyContent: 'center',
    flexWrap: 'wrap'
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
  rowLabel: {
    fontSize: '0.7rem',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '4px'
  },
  instructions: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: '12px',
    padding: '8px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '6px'
  },
  buttonBar: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    width: '100%',
    maxWidth: '400px'
  },
  button: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    color: '#fff',
    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
  },
  secondaryButton: {
    background: 'rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    border: '1px solid #6d28d9'
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  selectionNumber: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '20px',
    height: '20px',
    background: '#8b5cf6',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  },
  removeButton: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '20px',
    height: '20px',
    background: '#dc2626',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: '#fff',
    cursor: 'pointer',
    border: 'none'
  }
};

const ROW_LABELS = ['Back Row', 'Middle Row', 'Front Row'];

export default function TowerTeamSelect({ runState, onBack, onConfirm }) {
  // Hero waiting to be placed (selected but not yet on board/reserve)
  const [heroToPlace, setHeroToPlace] = useState(null);
  // Board positions: array of 9 elements, each null or heroId
  const [boardPositions, setBoardPositions] = useState(Array(9).fill(null));
  // Reserve positions: array of heroIds in reserve
  const [reserveHeroes, setReserveHeroes] = useState([]);

  // Exclude non-draftable heroes from Tower mode selection
  const availableHeroes = useMemo(() => {
    return HEROES.filter(hero => hero && hero.draftable !== false);
  }, []);

  const getHeroById = (id) => HEROES.find(h => h.id === id);

  // Get all placed hero IDs (on board + in reserve)
  const placedHeroIds = useMemo(() => {
    const onBoard = boardPositions.filter(h => h !== null);
    return [...onBoard, ...reserveHeroes];
  }, [boardPositions, reserveHeroes]);

  // Total selected = placed + waiting to place
  const totalSelected = placedHeroIds.length + (heroToPlace ? 1 : 0);

  const handleHeroClick = (heroId) => {
    const isPlaced = placedHeroIds.includes(heroId);
    const isWaitingToPlace = heroToPlace === heroId;
    
    if (isWaitingToPlace) {
      // Cancel placing this hero
      setHeroToPlace(null);
    } else if (isPlaced) {
      // Remove hero from board/reserve 
      setBoardPositions(prev => prev.map(h => h === heroId ? null : h));
      setReserveHeroes(prev => prev.filter(id => id !== heroId));
    } else if (!heroToPlace && totalSelected < 7) {
      // Select new hero - must place before selecting another
      setHeroToPlace(heroId);
    }
    // If heroToPlace is set and clicking a different hero, ignore (must place first)
  };

  const handleBoardSlotClick = (position) => {
    const currentHero = boardPositions[position];
    const onBoardCount = boardPositions.filter(h => h !== null).length;
    const heroAlreadyOnBoard = heroToPlace ? boardPositions.includes(heroToPlace) : false;
    
    if (heroToPlace) {
      // Enforce max 5 heroes on the main board (allow swaps)
      if (!currentHero && onBoardCount >= 5 && !heroAlreadyOnBoard) {
        return;
      }
      // Place the selected hero
      setBoardPositions(prev => {
        const newPos = [...prev];
        // Remove heroToPlace from any current position
        const existingIdx = newPos.indexOf(heroToPlace);
        if (existingIdx >= 0) newPos[existingIdx] = null;
        // Place at new position (swap if occupied)
        newPos[position] = heroToPlace;
        return newPos;
      });
      setReserveHeroes(prev => prev.filter(id => id !== heroToPlace));
      
      // If there was a hero there, they now need to be placed
      if (currentHero && currentHero !== heroToPlace) {
        setHeroToPlace(currentHero);
      } else {
        setHeroToPlace(null);
      }
    } else if (currentHero) {
      // Pick up this hero to move them
      setHeroToPlace(currentHero);
      // Remove from current position
      setBoardPositions(prev => {
        const newPos = [...prev];
        newPos[position] = null;
        return newPos;
      });
    }
  };

  const handleReserveClick = (index) => {
    const existingReserve = reserveHeroes[index];
    
    if (heroToPlace) {
      // Check if reserve is full (max 2)
      if (reserveHeroes.length >= 2 && !reserveHeroes.includes(heroToPlace)) {
        // Can't add more to reserve, but can swap
        if (existingReserve) {
          setBoardPositions(prev => prev.map(h => h === heroToPlace ? null : h));
          setReserveHeroes(prev => {
            const newReserve = prev.filter(id => id !== heroToPlace);
            const swapIdx = prev.indexOf(existingReserve);
            newReserve[swapIdx] = heroToPlace;
            return newReserve;
          });
          setHeroToPlace(existingReserve);
        }
        return;
      }
      
      // Place hero in reserve
      setBoardPositions(prev => prev.map(h => h === heroToPlace ? null : h));
      setReserveHeroes(prev => {
        const newReserve = prev.filter(id => id !== heroToPlace);
        newReserve.push(heroToPlace);
        return newReserve;
      });
      setHeroToPlace(null);
    } else if (existingReserve) {
      // Pick up from reserve
      setHeroToPlace(existingReserve);
      setReserveHeroes(prev => prev.filter(id => id !== existingReserve));
    }
  };

  const handleRemoveFromBoard = (position, e) => {
    e.stopPropagation();
    const heroId = boardPositions[position];
    if (heroId) {
      // Remove completely (not to reserve - back to pool)
      setBoardPositions(prev => {
        const newPos = [...prev];
        newPos[position] = null;
        return newPos;
      });
    }
  };

  const handleRemoveFromReserve = (heroId, e) => {
    e.stopPropagation();
    setReserveHeroes(prev => prev.filter(id => id !== heroId));
  };

  const handleConfirm = () => {
    if (placedHeroIds.length !== 7) return;
    const onBoardCount = boardPositions.filter(h => h !== null).length;
    if (onBoardCount > 5) {
      alert('You can only place 5 heroes on the main board. Move 2 to reserve.');
      return;
    }
    
    // Build hero selections with positions
    const heroSelections = placedHeroIds.map(heroId => {
      const boardPos = boardPositions.indexOf(heroId);
      return {
        heroId,
        position: boardPos >= 0 ? boardPos : null
      };
    });
    
    // Validate at least one on board
    const onBoard = heroSelections.filter(h => h.position !== null);
    if (onBoard.length === 0) {
      alert('Please place at least one hero on the board!');
      return;
    }
    
    const updatedRun = setSelectedHeroes(runState, heroSelections);
    if (onConfirm) onConfirm(updatedRun);
  };

  const getSelectionNumber = (heroId) => {
    const index = placedHeroIds.indexOf(heroId);
    return index >= 0 ? index + 1 : null;
  };

  const onBoardCount = boardPositions.filter(h => h !== null).length;
  const canConfirm = placedHeroIds.length === 7 && onBoardCount > 0 && !heroToPlace;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Select Your Champions</h1>
        <p style={styles.subtitle}>Choose 7 heroes and position them on the board</p>
        <div style={styles.selectionCount}>
          <span style={{ color: totalSelected === 7 ? '#10b981' : '#f59e0b' }}>
            {totalSelected}
          </span>
          <span style={{ color: '#6b7280' }}> / 7 selected</span>
          {heroToPlace && (
            <span style={{ color: '#10b981', marginLeft: '16px' }}>
              📍 Click board/reserve to place: {getHeroById(heroToPlace)?.name}
            </span>
          )}
        </div>
      </div>

      <div style={styles.mainLayout}>
        {/* Hero Pool */}
        <div style={styles.heroPool}>
          <div style={styles.poolTitle}>Available Heroes ({availableHeroes.length})</div>
          <div style={styles.heroGrid}>
            {availableHeroes.map(hero => {
              const isPlaced = placedHeroIds.includes(hero.id);
              const isWaitingToPlace = heroToPlace === hero.id;
              const isSelected = isPlaced || isWaitingToPlace;
              const isDisabled = !isSelected && totalSelected >= 7;
              const selectionNum = getSelectionNumber(hero.id);

              return (
                <div
                  key={hero.id}
                  style={{
                    ...styles.heroCard,
                    ...(isPlaced ? styles.heroCardSelected : {}),
                    ...(isDisabled ? styles.heroCardDisabled : {}),
                    ...(isWaitingToPlace ? { boxShadow: '0 0 20px #10b981', border: '2px solid #10b981' } : {})
                  }}
                  onClick={() => !isDisabled && handleHeroClick(hero.id)}
                >
                  {selectionNum && (
                    <div style={styles.selectionNumber}>{selectionNum}</div>
                  )}
                  {isWaitingToPlace && (
                    <div style={{...styles.selectionNumber, background: '#10b981'}}>📍</div>
                  )}
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Board Section */}
        <div style={styles.boardSection}>
          <div style={styles.boardTitle}>Starting Positions</div>
          <div style={styles.boardContainer}>
            {/* 3x3 Board */}
            <div style={styles.board}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(displayIndex => {
                const towerPos = indexToTowerPosition(displayIndex, 'p1');
                const heroId = towerPos != null ? boardPositions[towerPos] : null;
                const hero = heroId ? getHeroById(heroId) : null;
                const rowIdx = towerPos != null ? Math.floor(towerPos / 3) : 0;
                const onBoardCount = boardPositions.filter(h => h !== null).length;
                const heroAlreadyOnBoard = heroToPlace ? boardPositions.includes(heroToPlace) : false;
                const boardFullForNewHero = !heroAlreadyOnBoard && onBoardCount >= 5;
                const isHighlight = heroToPlace && !hero && !boardFullForNewHero;
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
                    <div style={styles.boardSlotLabel}>
                      {ROW_LABELS[rowIdx]}
                    </div>
                    {hero ? (
                      <>
                        <button
                          style={styles.removeButton}
                          onClick={(e) => handleRemoveFromBoard(pos, e)}
                        >
                          ✕
                        </button>
                        <img
                          src={getAssetPath(hero.image)}
                          alt={hero.name}
                          style={styles.slotHeroImage}
                          onError={(e) => { e.target.src = getAssetPath('/images/heroes/default.jpg'); }}
                        />
                        <div style={styles.slotHeroName}>{hero.name}</div>
                      </>
                    ) : (
                      <span style={{ color: '#4c1d95', fontSize: '0.7rem' }}>Empty</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reserve Section */}
            <div style={styles.reserveSection}>
              <div style={styles.reserveTitle}>Reserve ({reserveHeroes.length}/2)</div>
              <div style={styles.reserveSlots}>
                {[0, 1].map(idx => {
                  const heroId = reserveHeroes[idx];
                  const hero = heroId ? getHeroById(heroId) : null;
                  const isHighlight = heroToPlace && !hero && reserveHeroes.length < 2;

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
                          <button
                            style={styles.removeButton}
                            onClick={(e) => handleRemoveFromReserve(heroId, e)}
                          >
                            ✕
                          </button>
                          <img
                            src={getAssetPath(hero.image)}
                            alt={hero.name}
                            style={{ ...styles.slotHeroImage, width: '50px', height: '50px' }}
                            onError={(e) => { e.target.src = getAssetPath('/images/heroes/default.jpg'); }}
                          />
                          <div style={{ ...styles.slotHeroName, fontSize: '0.6rem' }}>{hero.name}</div>
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
              {heroToPlace 
                ? '👆 Click a board slot or reserve to place your hero'
                : '👈 Click a hero from the pool to select them, then place on board'
              }
            </div>
          </div>

          <div style={styles.buttonBar}>
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={onBack}
            >
              Back
            </button>
            <button
              style={{
                ...styles.button,
                ...styles.primaryButton,
                ...(!canConfirm ? styles.disabledButton : {})
              }}
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              Begin Ascent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
