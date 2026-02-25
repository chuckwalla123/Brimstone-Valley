import React, { useState, useEffect } from 'react';
import musicManager from './MusicManager';
import sfxManager from './SfxManager';

// UI Scale options
const UI_SCALE_OPTIONS = [
  { value: '100', label: '100%', class: 'ui-scale-100' },
  { value: '125', label: '125%', class: 'ui-scale-125' },
  { value: '150', label: '150%', class: 'ui-scale-150' },
  { value: '175', label: '175%', class: 'ui-scale-175' },
  { value: '200', label: '200%', class: 'ui-scale-200' },
];

// Get saved UI scale or detect best default
function getInitialScale() {
  const saved = localStorage.getItem('uiScale');
  if (saved) return saved;
  
  // Auto-detect based on screen width
  const width = window.screen.width;
  if (width >= 3840) return '175';
  if (width >= 3000) return '150';
  if (width >= 2560) return '125';
  return '100';
}

// Apply scale class to document
function applyScale(scale) {
  const html = document.documentElement;
  // Remove all scale classes
  UI_SCALE_OPTIONS.forEach(opt => html.classList.remove(opt.class));
  // Add the selected one
  const option = UI_SCALE_OPTIONS.find(o => o.value === scale);
  if (option) {
    html.classList.add(option.class);
  }
  localStorage.setItem('uiScale', scale);
}

// Initialize scale on module load
if (typeof window !== 'undefined') {
  const initialScale = getInitialScale();
  applyScale(initialScale);
}

export default function OptionsModal({ onClose }) {
  const [musicType, setMusicType] = useState(musicManager.getMusicType());
  const [volume, setVolume] = useState(musicManager.getVolume());
  const [sfxVolume, setSfxVolume] = useState(sfxManager.getVolume());
  const [uiScale, setUiScale] = useState(getInitialScale());
  const [showCombatLog, setShowCombatLog] = useState(() => {
    const saved = localStorage.getItem('showBattleCombatLog');
    return saved == null ? true : saved === 'true';
  });

  // Update music manager when settings change
  const handleMusicTypeChange = (type) => {
    setMusicType(type);
    musicManager.setMusicType(type);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    musicManager.setVolume(newVolume);
  };

  const handleSfxVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setSfxVolume(newVolume);
    sfxManager.setVolume(newVolume);
  };

  const handleScaleChange = (scale) => {
    setUiScale(scale);
    applyScale(scale);
  };

  const handleCombatLogToggle = () => {
    setShowCombatLog(prev => {
      const next = !prev;
      localStorage.setItem('showBattleCombatLog', String(next));
      return next;
    });
  };

  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle = {
    background: 'linear-gradient(135deg, #2d1b3d 0%, #1e1e2e 100%)',
    borderRadius: '16px',
    padding: '30px',
    minWidth: '400px',
    maxWidth: '500px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
    border: '2px solid rgba(102, 126, 234, 0.3)',
  };

  const titleStyle = {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '25px',
    textAlign: 'center',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  };

  const sectionStyle = {
    marginBottom: '25px',
  };

  const labelStyle = {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '12px',
    display: 'block',
  };

  const toggleContainerStyle = {
    display: 'flex',
    gap: '10px',
  };

  const toggleButtonStyle = (isActive) => ({
    flex: 1,
    padding: '12px 20px',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: isActive
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'rgba(255, 255, 255, 0.1)',
    color: isActive ? '#fff' : '#aaa',
    boxShadow: isActive ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none',
  });

  const sliderContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  };

  const getSliderStyle = (value) => ({
    flex: 1,
    height: '8px',
    WebkitAppearance: 'none',
    appearance: 'none',
    background: `linear-gradient(to right, #667eea 0%, #667eea ${value * 100}%, rgba(255,255,255,0.2) ${value * 100}%, rgba(255,255,255,0.2) 100%)`,
    borderRadius: '4px',
    outline: 'none',
    cursor: 'pointer',
  });

  const volumeValueStyle = {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#fff',
    minWidth: '45px',
    textAlign: 'right',
  };

  const closeButtonStyle = {
    width: '100%',
    padding: '14px',
    fontSize: '1.1rem',
    fontWeight: '700',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    marginTop: '10px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
  };

  const speakerIconStyle = {
    fontSize: '1.2rem',
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>Options</h2>

        {/* Music Type Toggle */}
        <div style={sectionStyle}>
          <label style={labelStyle}>🎵 Music Style</label>
          <div style={toggleContainerStyle}>
            <button
              style={toggleButtonStyle(musicType === 'modern')}
              onClick={() => handleMusicTypeChange('modern')}
              onMouseEnter={(e) => {
                if (musicType !== 'modern') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (musicType !== 'modern') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              🎸 Modern
            </button>
            <button
              style={toggleButtonStyle(musicType === 'retro')}
              onClick={() => handleMusicTypeChange('retro')}
              onMouseEnter={(e) => {
                if (musicType !== 'retro') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (musicType !== 'retro') {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              🕹️ Retro (8-bit)
            </button>
          </div>
        </div>

        {/* Volume Slider */}
        <div style={sectionStyle}>
          <label style={labelStyle}>🔊 Music Volume</label>
          <div style={sliderContainerStyle}>
            <span style={speakerIconStyle}>{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              style={getSliderStyle(volume)}
            />
            <span style={volumeValueStyle}>{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* Sound Effects Slider */}
        <div style={sectionStyle}>
          <label style={labelStyle}>💥 Sound Effects Volume</label>
          <div style={sliderContainerStyle}>
            <span style={speakerIconStyle}>{sfxVolume === 0 ? '🔇' : sfxVolume < 0.5 ? '🔉' : '🔊'}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={sfxVolume}
              onChange={handleSfxVolumeChange}
              style={getSliderStyle(sfxVolume)}
            />
            <span style={volumeValueStyle}>{Math.round(sfxVolume * 100)}%</span>
          </div>
        </div>

        {/* UI Scale */}
        <div style={sectionStyle}>
          <label style={labelStyle}>🖥️ UI Scale</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {UI_SCALE_OPTIONS.map(option => (
              <button
                key={option.value}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: uiScale === option.value
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'rgba(255, 255, 255, 0.1)',
                  color: uiScale === option.value ? '#fff' : '#aaa',
                  boxShadow: uiScale === option.value ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none',
                  minWidth: '60px',
                }}
                onClick={() => handleScaleChange(option.value)}
                onMouseEnter={(e) => {
                  if (uiScale !== option.value) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (uiScale !== option.value) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>
            Increase scale for high-resolution (4K) displays
          </div>
        </div>

        {/* Battle Combat Log */}
        <div style={sectionStyle}>
          <label style={labelStyle}>📜 Battle Combat Log</label>
          <button
            style={toggleButtonStyle(showCombatLog)}
            onClick={handleCombatLogToggle}
          >
            {showCombatLog ? 'Enabled' : 'Disabled'}
          </button>
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>
            Show or hide the status-impact combat log under the hero readout.
          </div>
        </div>

        {/* Close Button */}
        <button
          style={closeButtonStyle}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
          }}
        >
          Close
        </button>
      </div>

      {/* Custom styles for range input thumb */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          border: 2px solid #fff;
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          border: 2px solid #fff;
        }
      `}</style>
    </div>
  );
}
