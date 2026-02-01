import React from 'react';

export default function DifficultySelect({ onSelectDifficulty, onBack }) {
  const difficulties = [
    { id: 'super-easy', name: 'Super Easy', color: '#4caf50' },
    { id: 'easy', name: 'Easy', color: '#2196f3' },
    { id: 'medium', name: 'Medium', color: '#ff9800' },
    { id: 'hard', name: 'Hard', color: '#888', disabled: true },
  ];

  const buttonStyle = (difficulty) => ({
    width: '400px',
    height: '80px',
    fontSize: '1.4rem',
    fontWeight: '700',
    border: 'none',
    borderRadius: '12px',
    cursor: difficulty.disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    background: difficulty.disabled 
      ? 'linear-gradient(135deg, #434343 0%, #2a2a2a 100%)'
      : `linear-gradient(135deg, ${difficulty.color} 0%, ${difficulty.color}dd 100%)`,
    color: '#fff',
    opacity: difficulty.disabled ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        gap: '20px',
        padding: '20px',
        zIndex: 1000,
      }}
    >
      <h1
        style={{
          fontSize: '2.5rem',
          fontWeight: '900',
          color: '#fff',
          marginBottom: '10px',
          textShadow: '0 4px 8px rgba(0,0,0,0.5)',
        }}
      >
        SELECT DIFFICULTY
      </h1>

      {difficulties.map((diff) => (
        <button
          key={diff.id}
          style={buttonStyle(diff)}
          disabled={diff.disabled}
          onClick={() => !diff.disabled && onSelectDifficulty(diff.id)}
          onMouseEnter={(e) => {
            if (!diff.disabled) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = `0 8px 25px ${diff.color}99`;
            }
          }}
          onMouseLeave={(e) => {
            if (!diff.disabled) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            }
          }}
        >
          {diff.name}
        </button>
      ))}

      <button
        onClick={onBack}
        style={{
          marginTop: '30px',
          padding: '12px 30px',
          fontSize: '1rem',
          fontWeight: '600',
          border: '2px solid #fff',
          borderRadius: '8px',
          background: 'transparent',
          color: '#fff',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#fff';
          e.currentTarget.style.color = '#1e1e2e';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#fff';
        }}
      >
        ← Back to Main Menu
      </button>
    </div>
  );
}
