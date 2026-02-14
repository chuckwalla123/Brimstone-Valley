// src/tower/TowerAugmentChoice.jsx
// Post-battle augment selection screen

import React, { useState, useEffect } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';
import { getRandomAugments, AUGMENT_TIERS, AUGMENTS } from './augments.js';
import { addAugmentToHero, saveTowerRun, getAugmentCap } from './towerState.js';

const TIER_COLORS = {
  common: { bg: '#374151', border: '#6b7280', glow: 'rgba(107, 114, 128, 0.4)', text: '#9ca3af' },
  uncommon: { bg: '#065f46', border: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', text: '#34d399' },
  rare: { bg: '#1e40af', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa' },
  epic: { bg: '#581c87', border: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', text: '#c084fc' },
  legendary: { bg: '#78350f', border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)', text: '#fbbf24' }
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #1a0a2e 0%, #0d0015 100%)',
    color: '#fff'
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
    textShadow: '0 0 30px #a855f7'
  },
  subtitle: {
    color: '#a78bfa',
    fontSize: '1.2rem'
  },
  levelInfo: {
    fontSize: '1rem',
    color: '#6b7280',
    marginTop: '8px'
  },
  augmentCards: {
    display: 'flex',
    gap: '24px',
    marginBottom: '40px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  augmentCard: {
    width: '280px',
    borderRadius: '16px',
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  },
  augmentCardHover: {
    transform: 'translateY(-8px) scale(1.02)'
  },
  augmentCardSelected: {
    transform: 'translateY(-8px) scale(1.05)'
  },
  tierBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  augmentIcon: {
    fontSize: '3rem',
    marginBottom: '16px',
    textShadow: '0 0 20px currentColor'
  },
  augmentName: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    marginBottom: '12px'
  },
  augmentDescription: {
    fontSize: '0.95rem',
    color: '#d1d5db',
    lineHeight: '1.5',
    marginBottom: '16px',
    minHeight: '60px'
  },
  augmentEffect: {
    fontSize: '0.85rem',
    padding: '10px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    fontFamily: 'monospace'
  },
  heroSelection: {
    background: 'rgba(30, 20, 50, 0.6)',
    border: '1px solid #6d28d9',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '30px'
  },
  heroSelectionTitle: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    marginBottom: '20px',
    textAlign: 'center',
    color: '#a78bfa'
  },
  heroRow: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  heroOption: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '2px solid transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '110px'
  },
  heroOptionSelected: {
    border: '2px solid #8b5cf6',
    background: 'rgba(139, 92, 246, 0.2)',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
  },
  heroOptionDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed'
  },
  heroImage: {
    width: '60px',
    height: '60px',
    borderRadius: '8px',
    objectFit: 'cover',
    marginBottom: '8px'
  },
  heroName: {
    fontSize: '0.75rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '4px'
  },
  augmentCount: {
    fontSize: '0.7rem',
    color: '#a78bfa'
  },
  buttonBar: {
    display: 'flex',
    gap: '16px'
  },
  button: {
    padding: '16px 48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    color: '#fff',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.5)'
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
  checkmark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '4rem',
    color: '#fff',
    textShadow: '0 0 20px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    zIndex: 10
  }
};

const AUGMENT_ICONS = {
  stat: '📊',
  spell: '🔮',
  effect: '✨',
  debuff: '☠️',
  special: '⭐'
};

export default function TowerAugmentChoice({ runState, onConfirm, onSkip, onExit }) {
  const [selectedAugment, setSelectedAugment] = useState(null);
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [augmentApplied, setAugmentApplied] = useState(false);
  const [appliedRunState, setAppliedRunState] = useState(null);
  const [augmentChoices, setAugmentChoices] = useState(() => (
    Array.isArray(runState?.pendingAugmentChoice) ? runState.pendingAugmentChoice : []
  ));

  // Generate or restore 3 augment choices based on current level
  useEffect(() => {
    if (!runState) return;
    const pending = Array.isArray(runState.pendingAugmentChoice)
      ? runState.pendingAugmentChoice.filter(Boolean)
      : [];
    if (pending.length > 0) {
      setAugmentChoices(pending);
      return;
    }
    const forceUncommon = Array.isArray(runState.bossesDefeated) && runState.bossesDefeated.length > 0;
    const choices = getRandomAugments(runState.currentLevel, 3, [], { forceUncommonIfAllCommon: forceUncommon });
    runState.pendingAugmentChoice = choices;
    runState.lastPlayedAt = Date.now();
    saveTowerRun(runState);
    setAugmentChoices(choices);
  }, [runState]);

  // selectedHeroes is array of { heroId, augments: [...] }
  const heroEntries = runState.selectedHeroes || [];

  const getHeroById = (id) => HEROES.find(h => h.id === id);

  const getHeroAugmentCount = (heroIndex) => {
    const entry = heroEntries[heroIndex];
    return entry?.augments?.length || 0;
  };

  const canHeroReceiveAugment = (heroIndex) => {
    return getHeroAugmentCount(heroIndex) < getAugmentCap(runState);
  };

  const handleAugmentSelect = (augment) => {
    if (selectedAugment?.id === augment.id) {
      setSelectedAugment(null);
    } else {
      setSelectedAugment(augment);
    }
  };

  const handleHeroSelect = (heroIndex) => {
    if (!canHeroReceiveAugment(heroIndex)) return;
    
    if (selectedHeroIndex === heroIndex) {
      setSelectedHeroIndex(null);
    } else {
      setSelectedHeroIndex(heroIndex);
    }
  };

  const handleConfirm = () => {
    if (selectedAugment === null || selectedHeroIndex === null) return;
    
    const updatedRun = addAugmentToHero(runState, selectedHeroIndex, selectedAugment.id, selectedAugment.rolledValue ?? null);
    saveTowerRun(updatedRun);
    
    // Show continue/exit options
    setAppliedRunState(updatedRun);
    setAugmentApplied(true);
  };

  const handleSkip = () => {
    // Show continue/exit options without applying augment
    setAppliedRunState(runState);
    setAugmentApplied(true);
  };

  const handleContinue = () => {
    if (onConfirm) onConfirm(appliedRunState || runState);
  };

  const handleExitToMenu = () => {
    if (onExit) onExit(appliedRunState || runState);
  };

  const formatEffectText = (augment) => {
    const aug = AUGMENTS[augment.id];
    if (!aug) return '';

    if (augment.description) return augment.description;
    if (aug.description) return aug.description;

    return '';
  };

  // Show continue/exit screen after augment applied/skipped
  if (augmentApplied) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🏆 Level {runState.currentLevel} Complete!</h1>
          <p style={styles.subtitle}>
            {selectedAugment 
              ? `Applied "${selectedAugment.name}" to your team` 
              : 'Augment skipped'}
          </p>
          <p style={styles.levelInfo}>Next: Recruit 1 hero for Level {runState.currentLevel + 1}</p>
        </div>

        <div style={{ 
          background: 'rgba(30, 20, 50, 0.8)', 
          borderRadius: '16px', 
          padding: '40px',
          textAlign: 'center',
          border: '1px solid #6d28d9'
        }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '30px', color: '#a78bfa' }}>
            What would you like to do?
          </p>
          
          <div style={{ ...styles.buttonBar, flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <button
              style={{ 
                ...styles.button, 
                ...styles.primaryButton,
                width: '300px'
              }}
              onClick={handleContinue}
            >
              ⚔️ Continue to Recruitment
            </button>
            <button
              style={{ 
                ...styles.button, 
                ...styles.secondaryButton,
                width: '300px'
              }}
              onClick={handleExitToMenu}
            >
              🏠 Save & Exit to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🏆 Victory!</h1>
        <p style={styles.subtitle}>Choose an augment for one of your heroes</p>
        <p style={styles.levelInfo}>Level {runState.currentLevel} completed</p>
      </div>

      <div style={styles.augmentCards}>
        {augmentChoices.map((augment, idx) => {
          const tierStyle = TIER_COLORS[augment.tier] || TIER_COLORS.common;
          const isSelected = selectedAugment?.id === augment.id;
          const isHovered = hoveredCard === idx;

          return (
            <div
              key={augment.id}
              style={{
                ...styles.augmentCard,
                background: `linear-gradient(135deg, ${tierStyle.bg} 0%, rgba(0,0,0,0.6) 100%)`,
                border: `2px solid ${isSelected ? '#fff' : tierStyle.border}`,
                boxShadow: isSelected 
                  ? `0 0 30px ${tierStyle.glow}, 0 0 60px ${tierStyle.glow}`
                  : isHovered 
                    ? `0 8px 30px ${tierStyle.glow}`
                    : `0 4px 15px rgba(0,0,0,0.3)`,
                ...(isHovered && !isSelected ? styles.augmentCardHover : {}),
                ...(isSelected ? styles.augmentCardSelected : {})
              }}
              onClick={() => handleAugmentSelect(augment)}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {isSelected && <div style={styles.checkmark}>✓</div>}
              
              <div 
                style={{
                  ...styles.tierBadge,
                  background: tierStyle.bg,
                  border: `1px solid ${tierStyle.border}`,
                  color: tierStyle.text
                }}
              >
                {augment.tier}
              </div>
              
              <div style={{ ...styles.augmentIcon, color: tierStyle.text }}>
                {AUGMENT_ICONS[augment.type] || '❓'}
              </div>
              
              <div style={{ ...styles.augmentName, color: tierStyle.text }}>
                {augment.name}
              </div>
              
              <div style={styles.augmentDescription}>
                {augment.description}
              </div>
              
              <div style={{ ...styles.augmentEffect, borderLeft: `3px solid ${tierStyle.border}` }}>
                {formatEffectText(augment)}
              </div>
            </div>
          );
        })}
      </div>

      {selectedAugment && (
        <div style={styles.heroSelection}>
          <div style={styles.heroSelectionTitle}>
            Apply "{selectedAugment.name}" to which hero?
          </div>
          <div style={styles.heroRow}>
            {heroEntries.map((entry, idx) => {
              const hero = getHeroById(entry.heroId);
              if (!hero) return null;
              
              const augmentCount = getHeroAugmentCount(idx);
              const canReceive = canHeroReceiveAugment(idx);
              const isSelected = selectedHeroIndex === idx;

              return (
                <div
                  key={idx}
                  style={{
                    ...styles.heroOption,
                    ...(isSelected ? styles.heroOptionSelected : {}),
                    ...(!canReceive ? styles.heroOptionDisabled : {})
                  }}
                  onClick={() => handleHeroSelect(idx)}
                >
                  <img
                    src={getAssetPath(hero.image)}
                    alt={hero.name}
                    style={styles.heroImage}
                    onError={(e) => {
                      e.target.src = getAssetPath('/images/heroes/default.jpg');
                    }}
                  />
                  <div style={styles.heroName}>{hero.name}</div>
                  <div style={{
                    ...styles.augmentCount,
                    color: augmentCount >= getAugmentCap(runState) ? '#ef4444' : '#a78bfa'
                  }}>
                    {augmentCount}/{getAugmentCap(runState)} augments
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={styles.buttonBar}>
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={handleSkip}
        >
          Skip Augment
        </button>
        <button
          style={{
            ...styles.button,
            ...styles.primaryButton,
            ...(selectedAugment === null || selectedHeroIndex === null ? styles.disabledButton : {})
          }}
          onClick={handleConfirm}
          disabled={selectedAugment === null || selectedHeroIndex === null}
        >
          Apply Augment
        </button>
      </div>
    </div>
  );
}
