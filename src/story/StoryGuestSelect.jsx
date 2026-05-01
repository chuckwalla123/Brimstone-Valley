// Pre-battle guest hero replacement screen for story mode.

import React, { useEffect, useMemo, useState } from 'react';
import { HEROES } from '../heroes.js';
import { indexToColumn, indexToRow, towerPositionToIndex } from '../targeting.js';
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
  heroStage: {
    width: '100%',
    maxWidth: '1120px',
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
    gap: '22px',
    alignItems: 'start'
  },
  heroCard: {
    background: 'rgba(0,0,0,0.34)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '18px',
    padding: '22px'
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: '999px',
    padding: '6px 12px',
    background: 'rgba(245, 158, 11, 0.18)',
    color: '#f7d6a0',
    fontSize: '0.76rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '14px'
  },
  heroImage: {
    width: '100%',
    maxWidth: '220px',
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    borderRadius: '16px',
    border: '2px solid rgba(245, 158, 11, 0.55)',
    display: 'block',
    marginBottom: '16px'
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
    maxWidth: '760px'
  },
  helper: {
    color: '#c6b89b',
    textAlign: 'center',
    maxWidth: '760px',
    marginBottom: '22px'
  },
  guestName: {
    fontSize: '1.7rem',
    fontWeight: 'bold',
    marginBottom: '8px'
  },
  guestDesc: {
    color: '#d9c4a6',
    lineHeight: '1.7'
  },
  rosterPanel: {
    background: 'rgba(0,0,0,0.34)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '18px',
    padding: '22px'
  },
  rosterTitle: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginBottom: '6px'
  },
  rosterSubtitle: {
    color: '#c6b89b',
    marginBottom: '16px'
  },
  rosterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px'
  },
  rosterCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '14px',
    padding: '14px',
    cursor: 'pointer',
    transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease'
  },
  rosterCardSelected: {
    border: '2px solid #f59e0b',
    boxShadow: '0 0 18px rgba(245, 158, 11, 0.28)',
    transform: 'translateY(-2px)'
  },
  rosterImage: {
    width: '72px',
    height: '72px',
    objectFit: 'cover',
    borderRadius: '12px',
    marginBottom: '10px'
  },
  rosterName: {
    fontWeight: 'bold',
    marginBottom: '4px'
  },
  rosterMeta: {
    color: '#d9c4a6',
    fontSize: '0.82rem'
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

function getPositionLabel(position) {
  if (!Number.isInteger(position)) return 'Reserve';
  const battleIndex = towerPositionToIndex(position, 'p1');
  if (battleIndex == null) return 'Reserve';

  const rowNames = ['Front Row', 'Middle Row', 'Back Row'];
  const columnNames = ['Left Column', 'Middle Column', 'Right Column'];
  const rowLabel = rowNames[indexToRow(battleIndex, 'p1')] || 'Battle Line';
  const columnLabel = columnNames[indexToColumn(battleIndex, 'p1')] || 'Open Column';

  return `${rowLabel} • ${columnLabel}`;
}

export default function StoryGuestSelect({ runState, node, onConfirm, onBack }) {
  const guestConfig = node?.guestHero || null;
  const guestHero = useMemo(() => getHeroById(guestConfig?.heroId), [guestConfig?.heroId]);
  const blockedHeroIds = useMemo(
    () => new Set(guestConfig?.excludedOutgoingHeroIds || []),
    [guestConfig?.excludedOutgoingHeroIds]
  );
  const selectableHeroes = useMemo(
    () => (runState?.selectedHeroes || []).filter(
      entry => Number.isInteger(entry?.position) && !blockedHeroIds.has(entry?.heroId)
    ),
    [runState, blockedHeroIds]
  );
  const [selectedHeroId, setSelectedHeroId] = useState(selectableHeroes[0]?.heroId || null);

  useEffect(() => {
    setSelectedHeroId(selectableHeroes[0]?.heroId || null);
  }, [node?.id, selectableHeroes]);

  if (!guestConfig || !guestHero) return null;

  const canConfirm = !!selectedHeroId;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Guest Hero Available</div>
      <div style={styles.subtitle}>
        {guestConfig.title || `${guestHero.name} will fight with your party in this battle.`}
      </div>
      <div style={styles.helper}>
        {guestConfig.prompt || 'Choose which active hero will step aside for this battle. The guest takes that hero\'s exact slot for this encounter only.'}
      </div>

      <div style={styles.heroStage}>
        <div style={styles.heroCard}>
          <div style={styles.heroBadge}>Guest Hero</div>
          <img src={getAssetPath(guestHero.image)} alt={guestHero.name} style={styles.heroImage} />
          <div style={styles.guestName}>{guestHero.name}</div>
          <div style={styles.guestDesc}>{guestConfig.description || guestHero.description}</div>
        </div>

        <div style={styles.rosterPanel}>
          <div style={styles.rosterTitle}>Choose A Hero To Bench</div>
          <div style={styles.rosterSubtitle}>
            Only heroes currently starting on the board can be replaced, so your guest enters the fight immediately.
          </div>
          <div style={styles.rosterGrid}>
            {selectableHeroes.map(entry => {
              const hero = getHeroById(entry.heroId);
              if (!hero) return null;
              const selected = selectedHeroId === entry.heroId;
              return (
                <div
                  key={entry.heroId}
                  style={{
                    ...styles.rosterCard,
                    ...(selected ? styles.rosterCardSelected : {})
                  }}
                  onClick={() => setSelectedHeroId(entry.heroId)}
                >
                  <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.rosterImage} />
                  <div style={styles.rosterName}>{hero.name}</div>
                  <div style={styles.rosterMeta}>{getPositionLabel(entry.position)}</div>
                </div>
              );
            })}
          </div>

          <div style={styles.buttonRow}>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onBack}>
              Back
            </button>
            <button
              style={{ ...styles.button, ...styles.primaryButton, opacity: canConfirm ? 1 : 0.5 }}
              disabled={!canConfirm}
              onClick={() => onConfirm && onConfirm({ guestHeroId: guestHero.id, replacedHeroId: selectedHeroId })}
            >
              Bring {guestHero.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}