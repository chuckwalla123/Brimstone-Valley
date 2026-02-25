// src/tower/TowerIntro.jsx
// Intro exposition screen for Tower of Shattered Champions

import React from 'react';

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #1a0a2e 0%, #0d0015 100%)',
    color: '#fff'
  },
  card: {
    maxWidth: '960px',
    background: 'rgba(20, 8, 32, 0.65)',
    border: '1px solid rgba(167, 139, 250, 0.35)',
    borderRadius: '16px',
    padding: '28px',
    boxShadow: '0 0 30px rgba(109, 40, 217, 0.25)'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#e9d5ff'
  },
  paragraph: {
    fontSize: '1rem',
    color: '#e9d5ff',
    lineHeight: '1.75',
    marginBottom: '14px'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px'
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
    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    color: '#fff'
  },
  secondaryButton: {
    background: 'rgba(255,255,255,0.08)',
    color: '#fff'
  }
};

const introLines = [
  'Welcome, adventurer, to Brimstone Valley. This world has been a long-standing passion project of mine—an idea I carried for years but could never fully bring to life until the rise of AI tools made it possible to code, illustrate, and finally shape the game into something I’m proud to share. It means a great deal to welcome you, and anyone who loves classic strategy RPGs and competitive gaming, into this universe.',
  'The Tower of Shattered Champions stands as the ultimate challenge—the true end-game of Brimstone Valley. To experience it in the spirit it was designed, I encourage you to dive in without guides, walkthroughs, or outside help until you feel you’ve exhausted every strategy you can muster. The Tower is meant to test your creativity, your adaptability, and your ability to forge a team capable of overcoming brutal bosses, unforgiving set-piece battles, and the occasional chaos of pure randomness.',
  'My hope is that, by the time you reach the summit, you’ll feel the same sense of triumph I used to chase in the strategy RPGs I grew up with—the ones that hid some outrageously difficult dungeon or boss that demanded hours of experimentation, grinding, and stubborn determination before victory finally came. I want this end-game to challenge you, but also to empower you, giving you the freedom to craft clever, unexpected solutions within the system I’ve built.',
  'Above all, I hope you enjoy the journey—and the hard-won satisfaction that comes with conquering a truly formidable challenge.'
];

export default function TowerIntro({ onBegin, onBack }) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>Tower of Shattered Champions</div>
        {introLines.map((line, idx) => (
          <div key={idx} style={styles.paragraph}>{line}</div>
        ))}
        <div style={styles.buttonRow}>
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onBack}>
            Back
          </button>
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={onBegin}>
            Begin Ascent
          </button>
        </div>
      </div>
    </div>
  );
}
