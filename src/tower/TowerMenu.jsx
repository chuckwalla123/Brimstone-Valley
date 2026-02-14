// src/tower/TowerMenu.jsx
// Main menu component for Tower of Shattered Champions

import React, { useState, useEffect } from 'react';
import { 
  loadTowerRun, 
  clearTowerRun, 
  hasActiveRun, 
  getRunSummary,
  createNewRun,
  saveTowerRun
} from './towerState.js';

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
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
    textShadow: '0 0 20px #8b5cf6, 0 0 40px #6d28d9',
    letterSpacing: '2px'
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#a78bfa',
    marginBottom: '40px',
    fontStyle: 'italic'
  },
  menuBox: {
    background: 'rgba(30, 20, 50, 0.8)',
    border: '2px solid #6d28d9',
    borderRadius: '16px',
    padding: '30px 40px',
    width: '100%',
    maxWidth: '1400px',
    boxSizing: 'border-box',
    boxShadow: '0 0 30px rgba(109, 40, 217, 0.3)'
  },
  button: {
    width: '100%',
    padding: '16px 24px',
    margin: '8px 0',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '1px'
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
  dangerButton: {
    background: 'rgba(220, 38, 38, 0.2)',
    color: '#f87171',
    border: '1px solid #dc2626'
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  runInfo: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid #6d28d9',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px'
  },
  runInfoTitle: {
    fontSize: '1rem',
    color: '#a78bfa',
    marginBottom: '8px'
  },
  runInfoLevel: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#fff'
  },
  runInfoStats: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '12px',
    fontSize: '0.9rem',
    color: '#9ca3af'
  },
  backButton: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  towerIcon: {
    fontSize: '4rem',
    marginBottom: '20px',
    filter: 'drop-shadow(0 0 10px #8b5cf6)'
  },
  confirmModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: '#1a0a2e',
    border: '2px solid #dc2626',
    borderRadius: '16px',
    padding: '30px',
    maxWidth: '400px',
    textAlign: 'center'
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#f87171'
  },
  modalText: {
    color: '#9ca3af',
    marginBottom: '24px',
    lineHeight: '1.6'
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  }
};

export default function TowerMenu({ runState, onContinue, onNewRun, onAbandon, onViewTeam, onExit }) {
  const [summary, setSummary] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (runState) {
      setSummary(getRunSummary(runState));
    } else {
      setSummary(null);
    }
  }, [runState]);

  const handleContinue = () => {
    if (onContinue) onContinue();
  };

  const handleNewRun = () => {
    if (onNewRun) onNewRun();
  };

  const handleClearRun = () => {
    if (onAbandon) onAbandon();
    setShowClearConfirm(false);
  };

  const handleViewTeam = () => {
    if (onViewTeam) onViewTeam();
  };

  const handleBack = () => {
    if (onExit) onExit();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={handleBack}>
        ← Back to Menu
      </button>

      <div style={styles.towerIcon}>🏰</div>
      <h1 style={styles.title}>Tower of Shattered Champions</h1>
      <p style={styles.subtitle}>Ascend 100 levels of increasing challenge</p>

      <div style={styles.menuBox}>
        {summary && summary.hasTeam && (
          <div style={styles.runInfo}>
            <div style={styles.runInfoTitle}>Current Run</div>
            <div style={styles.runInfoLevel}>Level {summary.currentLevel}</div>
            <div style={styles.runInfoStats}>
              <span>Bosses: {summary.bossesDefeated}/6</span>
              <span>Augments: {summary.totalAugments}</span>
            </div>
            <div style={{ ...styles.runInfoStats, marginTop: '8px' }}>
              <span>Last played: {formatDate(summary.lastPlayedAt)}</span>
            </div>
          </div>
        )}

        {runState ? (
          <>
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleContinue}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              {summary?.hasTeam ? `Continue - Level ${summary.currentLevel}` : 'Start Draft'}
            </button>

            {summary?.hasTeam && (
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={handleViewTeam}
                onMouseOver={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(139, 92, 246, 0.2)'}
              >
                View Team & Augments
              </button>
            )}

            <button
              style={{ ...styles.button, ...styles.dangerButton }}
              onClick={() => setShowClearConfirm(true)}
              onMouseOver={(e) => e.target.style.background = 'rgba(220, 38, 38, 0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(220, 38, 38, 0.2)'}
            >
              Abandon Run
            </button>
          </>
        ) : (
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={handleNewRun}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            Start New Run
          </button>
        )}

        <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#a78bfa', fontSize: '1rem' }}>How to Play</h3>
          <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#9ca3af', fontSize: '0.85rem', lineHeight: '1.8' }}>
            <li>Draft 3 heroes to begin your run</li>
            <li>Win battles to earn powerful augments</li>
            <li>After each battle, recruit or swap a hero</li>
            <li>Face epic bosses every 5 levels</li>
            <li>Reach level 100 to claim victory!</li>
          </ul>
        </div>
      </div>

      {showClearConfirm && (
        <div style={styles.confirmModal}>
          <div style={styles.modalContent}>
            <div style={styles.modalTitle}>⚠️ Abandon Run?</div>
            <p style={styles.modalText}>
              This will permanently delete your current progress. 
              You are on Level {summary?.currentLevel} with {summary?.totalAugments} augments collected.
            </p>
            <div style={styles.modalButtons}>
              <button
                style={{ ...styles.button, ...styles.secondaryButton, width: 'auto', padding: '12px 24px' }}
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.button, ...styles.dangerButton, width: 'auto', padding: '12px 24px' }}
                onClick={handleClearRun}
              >
                Abandon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
