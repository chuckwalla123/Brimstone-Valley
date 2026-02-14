// src/story/StoryRelicChoice.jsx
// Relic choice screen for Relic Hunt.

import React, { useEffect, useState } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';
import { AUGMENTS } from '../tower/augments.js';
import { applyRelicToHero, generateRelicChoices, describeAugment } from './storyState.js';

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
    marginBottom: '20px'
  },
  cardRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  card: {
    width: '260px',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(0,0,0,0.35)',
    cursor: 'pointer'
  },
  cardSelected: {
    border: '2px solid #f59e0b',
    boxShadow: '0 0 14px rgba(245, 158, 11, 0.4)'
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: 'bold'
  },
  cardDesc: {
    fontSize: '0.9rem',
    color: '#d9c4a6',
    marginTop: '8px'
  },
  heroRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '20px'
  },
  heroCard: {
    width: '110px',
    padding: '8px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,0.35)',
    border: '2px solid transparent',
    textAlign: 'center',
    cursor: 'pointer'
  },
  heroCardSelected: {
    border: '2px solid #f59e0b'
  },
  heroImage: {
    width: '60px',
    height: '60px',
    objectFit: 'cover',
    borderRadius: '8px',
    marginBottom: '6px'
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

export default function StoryRelicChoice({ runState, onConfirm, onExit }) {
  const [choices, setChoices] = useState(() => runState?.pendingRelicChoice || []);
  const [selectedAugmentId, setSelectedAugmentId] = useState(null);
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(null);

  useEffect(() => {
    if (!runState) return;
    const pending = Array.isArray(runState.pendingRelicChoice) ? runState.pendingRelicChoice : [];
    if (pending.length > 0) {
      setChoices(pending);
      return;
    }
    const generated = generateRelicChoices(runState, 3);
    setChoices(generated || []);
  }, [runState]);

  const heroEntries = runState?.selectedHeroes || [];
  const getHero = (id) => HEROES.find(h => h.id === id);

  const handleConfirm = () => {
    if (selectedAugmentId == null || selectedHeroIndex == null) return;
    const augment = choices.find(a => a.id === selectedAugmentId);
    if (!augment) return;
    const updated = applyRelicToHero(runState, selectedHeroIndex, augment.id, augment.rolledValue);
    onConfirm && onConfirm(updated);
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>Relic Unearthed</div>
      <div style={styles.subtitle}>Choose a relic and bind it to a champion</div>

      <div style={styles.cardRow}>
        {choices.map(choice => {
          const desc = describeAugment(choice.id, choice.rolledValue);
          return (
            <div
              key={choice.id}
              style={{ ...styles.card, ...(selectedAugmentId === choice.id ? styles.cardSelected : {}) }}
              onClick={() => setSelectedAugmentId(choice.id)}
            >
              <div style={styles.cardTitle}>{choice.name}</div>
              <div style={styles.cardDesc}>{desc}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.heroRow}>
        {heroEntries.map((entry, idx) => {
          const hero = getHero(entry.heroId);
          return (
            <div
              key={entry.heroId}
              style={{ ...styles.heroCard, ...(selectedHeroIndex === idx ? styles.heroCardSelected : {}) }}
              onClick={() => setSelectedHeroIndex(idx)}
            >
              {hero ? (
                <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.heroImage} />
              ) : null}
              <div style={{ fontSize: '0.75rem' }}>{hero?.name || entry.heroId}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.buttonRow}>
        <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onExit}>
          Save & Exit
        </button>
        <button style={{ ...styles.button, ...styles.primaryButton }} onClick={handleConfirm}>
          Bind Relic
        </button>
      </div>
    </div>
  );
}
