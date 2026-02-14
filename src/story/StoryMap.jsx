// src/story/StoryMap.jsx
// Map screen for Relic Hunt story mode.

import React from 'react';
import { HEROES } from '../heroes.js';
import getAssetPath from '../utils/assetPath.js';

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #140b22 0%, #0b0713 100%)',
    color: '#fff',
    padding: '24px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold'
  },
  button: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  backButton: {
    background: 'rgba(255,255,255,0.08)',
    color: '#fff'
  },
  mapGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '20px',
    alignItems: 'start'
  },
  nodeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  nodeCard: {
    padding: '14px',
    borderRadius: '12px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.12)'
  },
  nodeTitle: {
    fontSize: '1.1rem',
    fontWeight: 'bold'
  },
  nodeDesc: {
    fontSize: '0.9rem',
    color: '#d9c4a6',
    marginTop: '6px'
  },
  nodeStatus: {
    fontSize: '0.75rem',
    color: '#f59e0b',
    marginTop: '8px',
    textTransform: 'uppercase'
  },
  actionButton: {
    marginTop: '10px',
    padding: '8px 12px',
    background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  partyCard: {
    padding: '14px',
    borderRadius: '12px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.12)'
  },
  partyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '10px',
    marginTop: '10px'
  },
  heroCard: {
    textAlign: 'center'
  },
  heroImage: {
    width: '60px',
    height: '60px',
    borderRadius: '8px',
    objectFit: 'cover',
    marginBottom: '4px'
  },
  heroName: {
    fontSize: '0.65rem'
  },
  choiceRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    flexWrap: 'wrap'
  },
  choiceButton: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    cursor: 'pointer'
  }
};

export default function StoryMap({ arc, runState, onStartBattle, onChoosePath, onExit }) {
  if (!arc || !runState) return null;
  const completed = runState.completedNodeIds || [];
  const currentId = runState.currentNodeId;

  const getHero = (id) => HEROES.find(h => h.id === id);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>{arc.name} Expedition</div>
        <button style={{ ...styles.button, ...styles.backButton }} onClick={onExit}>
          Back to Menu
        </button>
      </div>

      <div style={styles.mapGrid}>
        <div style={styles.nodeList}>
          {(arc.map?.nodes || []).map(node => {
            const isCurrent = node.id === currentId;
            const isComplete = completed.includes(node.id);
            return (
              <div key={node.id} style={styles.nodeCard}>
                <div style={styles.nodeTitle}>{node.title}</div>
                <div style={styles.nodeDesc}>{node.description}</div>
                {isComplete && <div style={styles.nodeStatus}>Cleared</div>}
                {isCurrent && !isComplete && <div style={styles.nodeStatus}>Current</div>}

                {isCurrent && node.type === 'choice' && (
                  <div style={styles.choiceRow}>
                    {(node.choices || []).map(choice => (
                      <button
                        key={choice.id}
                        style={styles.choiceButton}
                        onClick={() => onChoosePath(choice.next)}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}

                {isCurrent && node.type !== 'choice' && (
                  <button style={styles.actionButton} onClick={() => onStartBattle(node)}>
                    Start Battle
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={styles.partyCard}>
          <div style={{ fontWeight: 700 }}>Current Party</div>
          <div style={styles.partyGrid}>
            {(runState.selectedHeroes || []).map(entry => {
              const hero = getHero(entry.heroId);
              return (
                <div key={entry.heroId} style={styles.heroCard}>
                  {hero ? (
                    <img src={getAssetPath(hero.image)} alt={hero.name} style={styles.heroImage} />
                  ) : null}
                  <div style={styles.heroName}>{hero?.name || entry.heroId}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
