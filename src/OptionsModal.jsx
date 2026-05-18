import React, { useMemo, useState, useEffect } from 'react';
import musicManager from './MusicManager';
import sfxManager from './SfxManager';
import { HEROES } from './heroes';
import { getSpellById } from './spells';
import { getEffectByName } from './effects';
import getAssetPath from './utils/assetPath';

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

function StatChip({ label, value, color }) {
  return (
    <div style={{
      minWidth: '46px',
      padding: '4px 6px',
      borderRadius: '8px',
      background: color,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    }}>
      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{value ?? 0}</span>
    </div>
  );
}

function HeroCompendiumTile({ hero, isHovered, onHover, onLeave }) {
  const casts = hero.spells || {};

  return (
    <button
      type="button"
      onMouseEnter={() => onHover(hero)}
      onFocus={() => onHover(hero)}
      onMouseLeave={onLeave}
      style={{
        border: isHovered ? '2px solid rgba(255, 213, 74, 0.9)' : '1px solid rgba(132, 147, 205, 0.28)',
        background: isHovered
          ? 'linear-gradient(180deg, rgba(58, 44, 92, 0.98) 0%, rgba(27, 26, 46, 0.98) 100%)'
          : 'linear-gradient(180deg, rgba(42, 36, 68, 0.96) 0%, rgba(21, 23, 38, 0.96) 100%)',
        borderRadius: '14px',
        padding: '10px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: isHovered ? '0 12px 30px rgba(0, 0, 0, 0.35)' : '0 8px 20px rgba(0, 0, 0, 0.22)',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        minHeight: '236px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
        <StatChip label="HP" value={hero.health} color="rgba(52, 148, 88, 0.9)" />
        <StatChip label="ARM" value={hero.armor} color="rgba(98, 120, 157, 0.88)" />
        <StatChip label="SPD" value={hero.speed} color="rgba(59, 126, 197, 0.88)" />
        <StatChip label="ENG" value={hero.energy} color="rgba(113, 83, 191, 0.88)" />
      </div>

      <div style={{
        position: 'relative',
        flex: 1,
        minHeight: '126px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(7, 10, 20, 0.92)',
      }}>
        <img
          src={getAssetPath(hero.image)}
          alt={hero.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.92 }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(6,10,19,0.08) 0%, rgba(6,10,19,0.18) 50%, rgba(6,10,19,0.82) 100%)'
        }} />
        <div style={{
          position: 'absolute',
          left: '8px',
          top: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {[
            { key: 'front', label: 'F', value: casts.front?.casts || 0 },
            { key: 'middle', label: 'M', value: casts.middle?.casts || 0 },
            { key: 'back', label: 'B', value: casts.back?.casts || 0 },
          ].map(row => (
            <div key={row.key} style={{
              minWidth: '28px',
              padding: '4px 5px',
              borderRadius: '8px',
              background: 'rgba(13, 18, 31, 0.86)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1,
            }}>
              <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#9bb0ff' }}>{row.label}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{row.value}</span>
            </div>
          ))}
        </div>
        <div style={{
          position: 'absolute',
          left: '10px',
          right: '10px',
          bottom: '10px',
          fontSize: '0.95rem',
          fontWeight: 800,
          color: '#fff',
          textShadow: '0 2px 10px rgba(0,0,0,0.8)',
        }}>
          {hero.name}
        </div>
      </div>
    </button>
  );
}

function HeroCompendiumOverlay({ heroes, onClose }) {
  const [hoveredHero, setHoveredHero] = useState(heroes[0] || null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!hoveredHero && heroes[0]) {
      setHoveredHero(heroes[0]);
      return;
    }
    if (hoveredHero && !heroes.some(hero => hero.id === hoveredHero.id)) {
      setHoveredHero(heroes[0] || null);
    }
  }, [heroes, hoveredHero]);

  const renderSpellLine = (hero, rowKey, rowLabel) => {
    const spellRef = hero?.spells?.[rowKey];
    const spell = spellRef ? getSpellById(spellRef.id) : null;
    const description = spell?.description || spell?.spec?.description || '—';

    return (
      <div key={rowKey} style={{
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f2f4ff', marginBottom: '4px' }}>
          {rowLabel} - {spell?.name || spellRef?.id || 'Unknown'} [{spellRef?.cost ?? '?'}]
        </div>
        <div style={{ fontSize: '0.84rem', color: '#c9cde8', lineHeight: 1.45 }}>{description}</div>
      </div>
    );
  };

  const renderPassive = (hero) => {
    const passives = hero?.passives || [];
    const positionalModifiers = hero?.positionalModifiers;
    if ((!passives || !passives.length) && !positionalModifiers) return null;

    const positionalEntries = [];
    if (positionalModifiers) {
      Object.entries(positionalModifiers).forEach(([row, stats]) => {
        Object.entries(stats || {}).forEach(([stat, value]) => {
          const label = stat === 'armor'
            ? 'Armor'
            : stat === 'speed'
              ? 'Speed'
              : stat === 'spellPower'
                ? 'Spell Power'
                : stat.charAt(0).toUpperCase() + stat.slice(1);
          positionalEntries.push(`${row} ${value >= 0 ? `+${value}` : value} ${label}`);
        });
      });
    }

    return (
      <div style={{
        marginTop: '14px',
        padding: '12px',
        borderRadius: '12px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', fontWeight: 800, color: '#ffd179', marginBottom: '8px' }}>PASSIVES</div>
        {positionalEntries.length > 0 && (
          <div style={{ fontSize: '0.84rem', color: '#d7dbf6', lineHeight: 1.4, marginBottom: passives.length ? '8px' : 0 }}>
            <span style={{ fontWeight: 700, color: '#fff' }}>Shapeshift:</span> {positionalEntries.join(', ')}
          </div>
        )}
        {passives.map((passive, index) => {
          let effect = null;
          if (typeof passive === 'string') effect = getEffectByName(passive);
          else if (passive?.name) effect = passive;
          else if (passive?.effect) effect = getEffectByName(passive.effect);
          const name = effect?.name || passive?.name || String(passive);
          const description = effect?.description || passive?.description || '';

          return (
            <div key={`${hero.id}-passive-${index}`} style={{ fontSize: '0.84rem', color: '#d7dbf6', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700, color: '#fff' }}>{name}:</span> {description || '—'}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 14, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1280px, 100%)',
          maxHeight: 'min(900px, calc(100vh - 48px))',
          background: 'linear-gradient(180deg, rgba(29, 26, 48, 0.98) 0%, rgba(14, 17, 29, 0.98) 100%)',
          borderRadius: '22px',
          border: '1px solid rgba(137, 151, 223, 0.26)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{
          padding: '22px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>Hero Compendium</div>
            <div style={{ fontSize: '0.92rem', color: '#aeb7de', marginTop: '4px' }}>
              Hover or focus a hero to inspect their starting board stats and spell kit.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Close
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 420px)',
          gap: '0',
          minHeight: 0,
          flex: 1,
        }}>
          <div style={{ padding: '20px 24px 24px', overflowY: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}>
              {heroes.map(hero => (
                <HeroCompendiumTile
                  key={hero.id}
                  hero={hero}
                  isHovered={hoveredHero?.id === hero.id}
                  onHover={setHoveredHero}
                  onLeave={() => {}}
                />
              ))}
            </div>
          </div>

          <div style={{
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(10, 13, 24, 0.98) 0%, rgba(14, 19, 33, 0.98) 100%)',
            padding: '22px',
            overflowY: 'auto',
          }}>
            {hoveredHero ? (
              <>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}>
                  <div style={{
                    position: 'relative',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                    minHeight: '200px',
                    background: '#121827',
                  }}>
                    <img
                      src={getAssetPath(hoveredHero.image)}
                      alt={hoveredHero.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(8,12,22,0.08) 0%, rgba(8,12,22,0.2) 45%, rgba(8,12,22,0.9) 100%)',
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: '14px',
                      right: '14px',
                      bottom: '14px',
                    }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{hoveredHero.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#bac4ef', marginTop: '4px' }}>
                        Starting stats as shown on the hero board tile.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                    <StatChip label="HP" value={hoveredHero.health} color="rgba(52, 148, 88, 0.9)" />
                    <StatChip label="ARM" value={hoveredHero.armor} color="rgba(98, 120, 157, 0.88)" />
                    <StatChip label="SPD" value={hoveredHero.speed} color="rgba(59, 126, 197, 0.88)" />
                    <StatChip label="ENG" value={hoveredHero.energy} color="rgba(113, 83, 191, 0.88)" />
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', letterSpacing: '0.08em', fontWeight: 800, color: '#8fb3ff', marginBottom: '10px' }}>SPELLS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {renderSpellLine(hoveredHero, 'front', 'Front')}
                      {renderSpellLine(hoveredHero, 'middle', 'Middle')}
                      {renderSpellLine(hoveredHero, 'back', 'Back')}
                    </div>
                  </div>

                  {renderPassive(hoveredHero)}

                  {hoveredHero.description && (
                    <div style={{
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      fontSize: '0.84rem',
                      color: '#d7dbf6',
                      lineHeight: 1.45,
                    }}>
                      {hoveredHero.description}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: '#9aa5d4' }}>Hover over a hero to inspect their spells.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OptionsModal({ onClose }) {
  const [musicType, setMusicType] = useState(musicManager.getMusicType());
  const [volume, setVolume] = useState(musicManager.getVolume());
  const [sfxVolume, setSfxVolume] = useState(sfxManager.getVolume());
  const [uiScale, setUiScale] = useState(getInitialScale());
  const [showHeroCompendium, setShowHeroCompendium] = useState(false);
  const [showCombatLog, setShowCombatLog] = useState(() => {
    const saved = localStorage.getItem('showBattleCombatLog');
    return saved == null ? true : saved === 'true';
  });
  const allHeroes = useMemo(() => [...HEROES].sort((left, right) => left.name.localeCompare(right.name)), []);

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

  const utilityButtonStyle = {
    width: '100%',
    padding: '14px',
    fontSize: '1rem',
    fontWeight: '700',
    borderRadius: '10px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
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

        <div style={sectionStyle}>
          <label style={labelStyle}>📖 Compendium</label>
          <button type="button" style={utilityButtonStyle} onClick={() => setShowHeroCompendium(true)}>
            View Hero Compendium
          </button>
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

      {showHeroCompendium && <HeroCompendiumOverlay heroes={allHeroes} onClose={() => setShowHeroCompendium(false)} />}

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
