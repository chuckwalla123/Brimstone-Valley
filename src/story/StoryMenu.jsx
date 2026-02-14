// src/story/StoryMenu.jsx
// Menu for Relic Hunt story mode.

import React from 'react';
import { STORY_ARCS } from './storyData.js';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #120a1e 0%, #0b0713 100%)',
    color: '#fff'
  },
  title: {
    fontSize: '2.6rem',
    fontWeight: 'bold',
    marginBottom: '10px',
    textShadow: '0 0 22px rgba(255, 188, 99, 0.6)',
    letterSpacing: '2px'
  },
  subtitle: {
    fontSize: '1rem',
    color: '#d9c4a6',
    marginBottom: '30px'
  },
  menuBox: {
    background: 'rgba(20, 12, 28, 0.85)',
    border: '2px solid #5b3b1f',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '1200px',
    boxShadow: '0 0 26px rgba(91, 59, 31, 0.35)'
  },
  kingdomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px'
  },
  kingdomCard: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(0,0,0,0.35)'
  },
  kingdomName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginBottom: '6px'
  },
  kingdomSubtitle: {
    fontSize: '0.85rem',
    color: '#c6b89b',
    marginBottom: '12px'
  },
  button: {
    width: '100%',
    padding: '12px 18px',
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
  disabledButton: {
    background: 'rgba(255,255,255,0.08)',
    color: '#8f8f8f',
    cursor: 'not-allowed'
  },
  runInfo: {
    marginBottom: '20px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  secondaryButton: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)'
  },
  backButton: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    padding: '10px 18px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer'
  }
};

export default function StoryMenu({ runState, summary, onContinue, onNewRun, onClear, onExit }) {
  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={onExit}>
        ← Back to Menu
      </button>
      <h1 style={styles.title}>Relic Hunt</h1>
      <p style={styles.subtitle}>A story campaign set in Brimstone Valley</p>

      <div style={styles.menuBox}>
        {runState && summary && (
          <div style={styles.runInfo}>
            <div style={{ fontWeight: 700 }}>Current Run</div>
            <div style={{ fontSize: '0.9rem', color: '#c6b89b', marginTop: 6 }}>
              Kingdom: {STORY_ARCS[summary.kingdomId]?.name || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#c6b89b', marginTop: 6 }}>
              Relics claimed: {summary.relics} • Nodes cleared: {summary.completedNodes}
            </div>
          </div>
        )}

        <div style={styles.actionRow}>
          {runState && (
            <button style={{ ...styles.button, ...styles.primaryButton, flex: '1 1 240px' }} onClick={onContinue}>
              Continue Relic Hunt
            </button>
          )}
          {runState && (
            <button style={{ ...styles.button, ...styles.secondaryButton, flex: '1 1 200px' }} onClick={onClear}>
              Abandon Run
            </button>
          )}
        </div>

        <div style={styles.kingdomGrid}>
          {Object.values(STORY_ARCS).map(arc => {
            const playable = arc.map && arc.map.start && arc.map.nodes && arc.map.nodes.length > 0;
            return (
              <div key={arc.id} style={styles.kingdomCard}>
                <div style={styles.kingdomName}>{arc.name}</div>
                <div style={styles.kingdomSubtitle}>
                  Banner: {arc.bannerHeroes.map(h => h.replace('ID', '')).join(', ')}
                </div>
                <button
                  style={{
                    ...styles.button,
                    ...(playable ? styles.primaryButton : styles.disabledButton)
                  }}
                  onClick={() => playable && onNewRun(arc.id)}
                  disabled={!playable}
                >
                  {playable ? 'Start Story' : 'Coming Soon'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
