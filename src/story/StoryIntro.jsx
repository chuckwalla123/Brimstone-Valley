// src/story/StoryIntro.jsx
// Intro exposition screen for a story arc.

import React from 'react';

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #140b22 0%, #0b0713 100%)',
    color: '#fff'
  },
  card: {
    maxWidth: '900px',
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '16px',
    padding: '28px'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '16px'
  },
  paragraph: {
    fontSize: '1rem',
    color: '#e6d7c2',
    lineHeight: '1.7',
    marginBottom: '12px'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '18px'
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

export default function StoryIntro({ arc, onBegin, onBack }) {
  if (!arc) return null;
  const introLines = [
    ...(Array.isArray(arc.prologue) ? arc.prologue : []),
    ...(Array.isArray(arc.intro) ? arc.intro : [])
  ];
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>{arc.name}: Relic Hunt</div>
        {introLines.map((line, idx) => (
          <div key={idx} style={styles.paragraph}>{line}</div>
        ))}
        <div style={styles.buttonRow}>
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onBack}>
            Back
          </button>
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={onBegin}>
            Begin Expedition
          </button>
        </div>
      </div>
    </div>
  );
}
