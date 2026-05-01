import React, { useEffect, useMemo, useState } from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';

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
    marginBottom: '10px',
    textAlign: 'center'
  },
  subtitle: {
    color: '#d9c4a6',
    marginBottom: '10px',
    textAlign: 'center',
    maxWidth: '820px'
  },
  helper: {
    color: '#c6b89b',
    textAlign: 'center',
    maxWidth: '820px',
    marginBottom: '22px'
  },
  layout: {
    width: '100%',
    maxWidth: '1120px',
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)',
    gap: '22px',
    alignItems: 'start'
  },
  focusCard: {
    background: 'rgba(0,0,0,0.34)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '18px',
    padding: '22px'
  },
  focusLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '6px 12px',
    background: 'rgba(245, 158, 11, 0.18)',
    color: '#f7d6a0',
    fontSize: '0.76rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '14px'
  },
  focusImage: {
    width: '100%',
    maxWidth: '220px',
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    borderRadius: '16px',
    border: '2px solid rgba(245, 158, 11, 0.55)',
    display: 'block',
    marginBottom: '16px'
  },
  focusName: {
    fontSize: '1.7rem',
    fontWeight: 'bold',
    marginBottom: '8px'
  },
  focusDesc: {
    color: '#d9c4a6',
    lineHeight: '1.7'
  },
  panel: {
    background: 'rgba(0,0,0,0.34)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '18px',
    padding: '22px'
  },
  panelTitle: {
    fontSize: '1.08rem',
    fontWeight: 'bold',
    marginBottom: '6px'
  },
  panelSubtitle: {
    color: '#c6b89b',
    marginBottom: '16px'
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px'
  },
  optionCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '14px',
    padding: '14px',
    cursor: 'pointer',
    transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease'
  },
  optionCardSelected: {
    border: '2px solid #f59e0b',
    boxShadow: '0 0 18px rgba(245, 158, 11, 0.28)',
    transform: 'translateY(-2px)'
  },
  optionImage: {
    width: '72px',
    height: '72px',
    objectFit: 'cover',
    borderRadius: '12px',
    marginBottom: '10px'
  },
  optionName: {
    fontWeight: 'bold',
    marginBottom: '4px'
  },
  optionMeta: {
    color: '#d9c4a6',
    fontSize: '0.82rem',
    lineHeight: '1.5'
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

function getHeroById(heroId) {
  return HEROES.find(hero => hero.id === heroId) || null;
}

function describeAugments(entry) {
  const count = Array.isArray(entry?.augments) ? entry.augments.length : 0;
  if (count <= 0) return 'No relics attached';
  if (count === 1) return '1 relic will transfer';
  return `${count} relics will transfer`;
}

export default function StoryRosterTransition({ runState, event, onConfirm, onBack }) {
  const options = useMemo(() => {
    if (!event) return [];

    if (event.mode === 'choose_incoming') {
      return (event.incomingChoices || [])
        .map(heroId => getHeroById(heroId))
        .filter(Boolean)
        .map(hero => ({ heroId: hero.id, hero }));
    }

    if (event.mode === 'choose_outgoing') {
      const blocked = new Set(event.excludedOutgoingHeroIds || []);
      return (runState?.selectedHeroes || [])
        .filter(entry => entry?.heroId && entry.heroId !== event.incomingHeroId && !blocked.has(entry.heroId))
        .map(entry => ({ heroId: entry.heroId, hero: getHeroById(entry.heroId), entry }))
        .filter(option => option.hero);
    }

    return [];
  }, [event, runState]);

  const [selectedHeroId, setSelectedHeroId] = useState(options[0]?.heroId || null);

  useEffect(() => {
    setSelectedHeroId(options[0]?.heroId || null);
  }, [event?.id, options]);

  if (!event) return null;

  const focusHeroId = event.mode === 'choose_incoming' ? event.outgoingHeroId : event.incomingHeroId;
  const focusHero = getHeroById(focusHeroId);
  const focusEntry = (runState?.selectedHeroes || []).find(entry => entry?.heroId === focusHeroId) || null;
  const canConfirm = !!selectedHeroId;

  return (
    <div style={styles.container}>
      <div style={styles.title}>{event.title}</div>
      <div style={styles.subtitle}>{event.subtitle}</div>
      <div style={styles.helper}>{event.helper}</div>

      <div style={styles.layout}>
        <div style={styles.focusCard}>
          <div style={styles.focusLabel}>{event.mode === 'choose_incoming' ? 'Departing Hero' : 'Returning Hero'}</div>
          {focusHero ? <img src={getAssetPath(focusHero.image)} alt={focusHero.name} style={styles.focusImage} /> : null}
          <div style={styles.focusName}>{focusHero?.name || focusHeroId}</div>
          <div style={styles.focusDesc}>
            {event.mode === 'choose_incoming'
              ? `${focusHero?.name || 'This hero'} is leaving the expedition. The replacement will inherit ${describeAugments(focusEntry)} and take over the same roster slot.`
              : `${focusHero?.name || 'This hero'} is asking to return to the expedition. Choose who steps aside, and ${focusHero?.name || 'the returning hero'} will inherit that hero's relics and position.`}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>{event.mode === 'choose_incoming' ? 'Choose A Replacement Mercenary' : 'Choose Who Leaves The Team'}</div>
          <div style={styles.panelSubtitle}>
            {event.mode === 'choose_incoming'
              ? 'The chosen mercenary joins immediately and keeps the departing hero\'s relic investment intact.'
              : 'Lancer is protected from replacement in this scene. Your choice is permanent until another story event changes the roster.'}
          </div>
          <div style={styles.optionGrid}>
            {options.map(option => (
              <div
                key={option.heroId}
                style={{
                  ...styles.optionCard,
                  ...(selectedHeroId === option.heroId ? styles.optionCardSelected : {})
                }}
                onClick={() => setSelectedHeroId(option.heroId)}
              >
                <img src={getAssetPath(option.hero.image)} alt={option.hero.name} style={styles.optionImage} />
                <div style={styles.optionName}>{option.hero.name}</div>
                <div style={styles.optionMeta}>
                  {event.mode === 'choose_incoming'
                    ? (option.hero.description || 'A capable mercenary steps into the vacancy.')
                    : describeAugments(option.entry)}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.buttonRow}>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onBack}>
              Back
            </button>
            <button
              style={{ ...styles.button, ...styles.primaryButton, opacity: canConfirm ? 1 : 0.5 }}
              disabled={!canConfirm}
              onClick={() => onConfirm && onConfirm(selectedHeroId)}
            >
              Confirm Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}