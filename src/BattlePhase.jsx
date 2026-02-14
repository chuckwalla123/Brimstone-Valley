/*
 * ==================== BOARD LAYOUT REFERENCE ====================
 * Each board is a 3x3 grid stored as a flat array [0..8]:
 *
 *   P1 Board        P2 Board
 *   [0, 1, 2]       [0, 1, 2]
 *   [3, 4, 5]       [3, 4, 5]
 *   [6, 7, 8]       [6, 7, 8]
 *
 * ROW DEFINITIONS (front/middle/back are relative to each player):
 *   P1: Front = [2,5,8], Middle = [1,4,7], Back = [0,3,6]
 *   P2: Front = [0,3,6], Middle = [1,4,7], Back = [2,5,8]
 *
 * COLUMN DEFINITIONS (vertical slices):
 *   Column 0 = [0,1,2], Column 1 = [3,4,5], Column 2 = [6,7,8]
 *
 * PROJECTILE/COLUMN TARGETING:
 *   - Columns mirror across boards (P1 col 0 targets P2 col 0, etc.)
 *   - Example: P1 casting from column [0,1,2] targets P2's [0,1,2]
 *   - Column attacks hit all 3 tiles in the target column
 *   - Projectiles hit front-most occupied tile first (P2: 0, then 1, then 2)
 *
 * VISUAL NOTE: The boards face each other, so P1's front (2,5,8) is
 * closest to P2's front (0,3,6).
 * ================================================================
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
// Track last pulse/emote seen for deduplication
const lastPulseSeenRef = { current: {} };
import { stripBackgroundFromImageData, BG_TRANSPARENCY_TOLERANCE } from './animations/utils';
import { SPELL_CONFIG } from './spellConfigs';
import { getSpellById } from './spells.js';
import { useMovement } from './movement';
import { getEffectByName } from './effects.js';
import useAnimations from './animations/useAnimations';
import { getAI } from './ai';
import getAssetPath from './utils/assetPath';
import sfxManager from './SfxManager';

// Helper to get current UI scale from CSS variable
function getUiScale() {
  if (typeof document === 'undefined') return 1;
  const value = getComputedStyle(document.documentElement).getPropertyValue('--ui-scale');
  return parseFloat(value) || 1;
}

function boardNameToSide(boardName) {
  const name = String(boardName || '').toLowerCase();
  if (name.startsWith('p1')) return 'p1';
  if (name.startsWith('p2')) return 'p2';
  return 'p3';
}

/* --- Icons (copied from DraftBoard.jsx for visual parity) --- */
function HeartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 1 }}>
      <path d="M7 12L1 7C-1 5 -1 2 1 0C3 -2 5 0 7 2C9 0 11 -2 13 0C15 2 15 5 13 7L7 12Z" fill="#ff69b4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 1 }}>
      <path d="M7 1L2 3V8C2 11 7 13 7 13C7 13 12 11 12 8V3L7 1Z" fill="#999999" />
    </svg>
  );
}

function ShoeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 1 }}>
      <ellipse cx="7" cy="8" rx="5" ry="3" fill="#4a90e2" />
      <path d="M3 8L2 12H12L11 8" fill="#4a90e2" opacity="0.7" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 1 }}>
      <path d="M7 1L10 7H8L12 13L5 8H7L7 1Z" fill="#ffd54f" />
    </svg>
  );
}

function SwordIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 2 }}>
      <rect x="6" y="0" width="2" height="10" fill="#e8a87c" />
      <polygon points="4,10 10,10 7,13" fill="#c0a080" />
      <rect x="5" y="10" width="4" height="1" fill="#8b7355" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 2 }}>
      <rect x="6" y="0" width="2" height="12" fill="#a78bfa" />
      <circle cx="7" cy="2" r="2.5" fill="#ddd6fe" />
      <circle cx="7" cy="13" r="1" fill="#8b5cf6" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 2 }}>
      <path d="M2 1H7V12H2Z" fill="#f59e0b" />
      <path d="M7 1H12V12H7Z" fill="#f97316" />
      <line x1="7" y1="1" x2="7" y2="12" stroke="#d97706" strokeWidth="0.5" />
    </svg>
  );
}

/* Priority Arrow - points toward the player with priority */
function PriorityArrow({ direction = 'left' }) {
  // direction: 'left' points to P1, 'right' points to P2
  const isLeft = direction === 'left';
  const transform = direction === 'left' ? 'scaleX(-1)' : (direction === 'down' ? 'rotate(90deg)' : 'none');
  return (
    <svg
      width="40"
      height="24"
      viewBox="0 0 40 24"
      style={{
        transform,
        transition: 'transform 0.3s ease',
      }}
    >
      {/* Arrow pointing right by default, flip for left */}
      <path
        d="M4 12 L28 12 L28 6 L38 12 L28 18 L28 12"
        fill="white"
        stroke="black"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EffectsColumn({ tileId, effects = [], effectPrecast = null, onEffectHover = null, onEffectOut = null }) {
  const visibleEffects = Array.isArray(effects) ? effects.filter(e => e && !e._hidden) : [];
  return (
    <div className="db-effects-column">
      {Array.from({ length: 4 }).map((_, i) => {
        const ef = visibleEffects[i];
        const highlight = effectPrecast && (effectPrecast.effectIndex === i || (ef && effectPrecast.effectName && ef.name === effectPrecast.effectName));
        // Prefer explicit image path on the effect object; otherwise try a .png
        // derived from the effect name (keep casing as provided).
        const derivedName = ef && ef.name ? ef.name.replace(/\s+/g, '') : null;
        const src = ef && ef.image ? getAssetPath(ef.image) : (derivedName ? getAssetPath(`/images/effects/${derivedName}.png`) : null);
        return (
          <div
            key={`${tileId}-effect-${i}`}
            className={`db-effect-slot${highlight ? ' db-effect-precast' : ''}`}
            style={{ background: ef ? '#1a1a1a' : '#f5f5f5', color: ef ? '#fff' : '#bbb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {ef ? (
              src ? (
                <img
                  src={src}
                  alt={ef.name}
                  style={{ width: 20, height: 20 }}
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                  onMouseEnter={() => onEffectHover && onEffectHover(ef)}
                  onMouseLeave={() => onEffectOut && onEffectOut(ef)}
                />
              ) : (ef.name || 'E')
            ) : '—'}
            {/* If image fails to load it will be hidden by onError; show name fallback */}
            {ef && (!src) ? (ef.name || 'E') : null}
          </div>
        );
      })}
    </div>
  );
}

// JS-driven sprite animator for grid or strip sprite sheets.
function SpellSprite({ spellId, cfg, frameMs = 600 }) {
  const { file, frames = 1, frameWidth = 96, frameHeight = 96, cols = 1, rows = 1, maxDisplaySize = 96 } = cfg || {};
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const frameCanvasesRef = useRef([]);
  const [framesLoaded, setFramesLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    imgRef.current = img;
    img.crossOrigin = 'anonymous';
    img.src = getAssetPath(file || `/images/spells/${spellId}.png`);
    setFramesLoaded(false);
    img.onload = () => {
      const sw = img.width;
      const sh = img.height;
      const c = Math.max(1, cols);
      const r = Math.max(1, rows);
      const inferredFrameW = frameWidth && frameWidth > 0 ? frameWidth : Math.round(sw / c);
      const inferredFrameH = frameHeight && frameHeight > 0 ? frameHeight : Math.round(sh / r);
      const total = Math.min(frames, c * r);

      const tempCanv = document.createElement('canvas');
      const tctx = tempCanv.getContext('2d');
      frameCanvasesRef.current = [];

      for (let fi = 0; fi < total; fi++) {
        const sx = (fi % c) * inferredFrameW;
        const sy = Math.floor(fi / c) * inferredFrameH;
        tempCanv.width = inferredFrameW;
        tempCanv.height = inferredFrameH;
        tctx.clearRect(0,0,tempCanv.width,tempCanv.height);
        tctx.drawImage(img, sx, sy, inferredFrameW, inferredFrameH, 0, 0, inferredFrameW, inferredFrameH);
          try {
          const id = tctx.getImageData(0,0,inferredFrameW,inferredFrameH);
          stripBackgroundFromImageData(id, BG_TRANSPARENCY_TOLERANCE);
          tctx.putImageData(id, 0, 0);
        } catch (e) {
          // ignore if security prevents pixel access
        }

        const displayScale = Math.min(1, (maxDisplaySize || 128) / inferredFrameW);
        const dw = Math.max(24, Math.round(inferredFrameW * displayScale));
        const dh = Math.max(24, Math.round(inferredFrameH * displayScale));
        const fcan = document.createElement('canvas');
        fcan.width = dw; fcan.height = dh;
        const fctx = fcan.getContext('2d');
        fctx.imageSmoothingEnabled = false;
        fctx.clearRect(0,0,dw,dh);
        fctx.drawImage(tempCanv, 0, 0, inferredFrameW, inferredFrameH, 0, 0, dw, dh);
        frameCanvasesRef.current.push(fcan);
      }

      const visible = canvasRef.current;
      if (visible && frameCanvasesRef.current.length) {
        const f0 = frameCanvasesRef.current[0];
        visible.width = f0.width; visible.height = f0.height;
        const vctx = visible.getContext('2d');
        vctx.clearRect(0,0,visible.width,visible.height);
        vctx.drawImage(f0, 0, 0);
        setFramesLoaded(true);
      }
    };
  }, [file, frameWidth, frameHeight, cols, rows, frames, maxDisplaySize, spellId]);

  useEffect(() => {
    if (!framesLoaded) return;
    if (!frameCanvasesRef.current || !frameCanvasesRef.current.length) return;
    const total = frameCanvasesRef.current.length;
    let idx = 0;
    const visible = canvasRef.current;
    const iv = setInterval(() => {
      idx += 1;
      if (idx >= total) { clearInterval(iv); return; }
      const f = frameCanvasesRef.current[idx];
      if (visible && f) {
        const vctx = visible.getContext('2d');
        if (visible.width !== f.width || visible.height !== f.height) { visible.width = f.width; visible.height = f.height; }
        vctx.clearRect(0,0,visible.width,visible.height);
        vctx.drawImage(f, 0, 0);
      }
    }, frameMs);
    return () => clearInterval(iv);
  }, [frameMs, framesLoaded]);

  return <canvas ref={canvasRef} className="bp-spell-sprite" style={{ background: 'transparent' }} />;
}

function SmallTile({ tile, movement, player, index, isReserve = false, events = [], effectPrecastMap = null, onHoverTile = null, onUnhoverTile = null, onEffectHover = null, onEffectOut = null }) {
  const isEmpty = !tile || !tile.hero;
  const token = tile && tile.id ? tile.id : (isReserve ? `${player}:reserve:${index}` : `${player}:${index}`);
  const boardToken = isReserve ? `${player}:reserve:${index}` : `${player}:${index}`;
  const draggable = movement?.canDrag ? movement.canDrag({ ...tile, player }) : false;
  const canDragHero = !!(draggable && tile && tile.hero && !tile._dead);
  const [hover, setHover] = useState(false);
  const effectPrecast = effectPrecastMap ? effectPrecastMap[boardToken] : null;

  if (isEmpty) {
    return (
      <div className="bp-tile-row">
        <div
          className={`db-tile db-tile-empty ${hover ? 'db-tile-can-drop' : ''}`}
          data-token={token}
          data-board-token={boardToken}
          draggable={draggable}
          onDragStart={e => movement?.onDragStart && movement.onDragStart(e, token)}
          onDragOver={e => { movement?.onDragOver && movement.onDragOver(e); e.preventDefault(); }}
          onDragEnter={e => { setHover(true); e.preventDefault(); onHoverTile && onHoverTile(tile, player, index); }}
          onDragLeave={e => { setHover(false); onUnhoverTile && onUnhoverTile(); }}
          onDrop={e => { setHover(false); movement?.onDrop && movement.onDrop(e, token); }}
          title={isReserve ? 'Reserve' : 'Empty'}
          onMouseEnter={() => { setHover(true); onHoverTile && onHoverTile(tile, player, index); }}
          onMouseLeave={() => { setHover(false); onUnhoverTile && onUnhoverTile(); }}
        >
          <div className="db-tile-empty-text" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isReserve ? 12 : 14 }}>{isReserve ? 'Reserve' : 'Empty'}</div>
            {isReserve ? <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Drop here to reserve</div> : null}
          </div>
        </div>
        <EffectsColumn tileId={token} effects={[]} effectPrecast={null} />
      </div>
    );
  }

  const isDead = tile && tile._dead;
  if (isDead) {
    const name = tile.hero?.name || 'Unknown';
    const token = tile && tile.id ? tile.id : `${player}:${index}`;
    return (
      <div className="bp-tile-row">
        <div
          className={`db-tile db-tile-dead ${hover ? 'db-tile-can-drop' : ''}`}
          data-token={token}
          data-board-token={boardToken}
          draggable={draggable}
          onDragStart={e => movement?.onDragStart && movement.onDragStart(e, token)}
          onDragOver={e => { movement?.onDragOver && movement.onDragOver(e); e.preventDefault(); }}
          onDragEnter={e => { setHover(true); e.preventDefault(); onHoverTile && onHoverTile(tile, player, index); }}
          onDragLeave={e => { setHover(false); onUnhoverTile && onUnhoverTile(); }}
          onDrop={e => { setHover(false); movement?.onDrop && movement.onDrop(e, token); }}
          title={`Dead: ${name}`}
          onMouseEnter={() => { setHover(true); onHoverTile && onHoverTile(tile, player, index); }}
          onMouseLeave={() => { setHover(false); onUnhoverTile && onUnhoverTile(); }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f44336' }}>Dead</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>{name}</div>
          </div>
        </div>
        <EffectsColumn tileId={token} effects={[]} />
      </div>
    );
  }

  const name = tile.hero?.name || (tile && tile.name) || 'Unknown';
  // derive runtime stats: prefer runtime fields, fall back to hero base stats
  const base = tile.hero || {};
  const hp = tile.currentHealth != null ? tile.currentHealth : (base.health != null ? base.health : null);
  const armor = tile.currentArmor != null ? tile.currentArmor : (base.armor != null ? base.armor : null);
  const energy = tile.currentEnergy != null ? tile.currentEnergy : (base.energy != null ? base.energy : 0);
  const speed = tile.currentSpeed != null ? tile.currentSpeed : (base.speed != null ? base.speed : 0);
  // Display runtime remaining casts if available (tile._castsRemaining).
  // Fall back to the hero's configured base casts from `heroes.js` if not present.
  const spellCasts = {
    front: (tile && tile._castsRemaining && typeof tile._castsRemaining.front === 'number') ? tile._castsRemaining.front : (base?.spells?.front?.casts ?? 0),
    middle: (tile && tile._castsRemaining && typeof tile._castsRemaining.middle === 'number') ? tile._castsRemaining.middle : (base?.spells?.middle?.casts ?? 0),
    back: (tile && tile._castsRemaining && typeof tile._castsRemaining.back === 'number') ? tile._castsRemaining.back : (base?.spells?.back?.casts ?? 0),
  };
  const effects = tile.effects || [];
  const precastScale = (() => {
    const ev = (events || []).find(e => e && e.kind === 'precast' && typeof e.scale === 'number');
    return ev && typeof ev.scale === 'number' ? ev.scale : 1;
  })();

    return (
    <div className="bp-tile-row">
      <div
        className={`db-tile db-tile-occupied ${canDragHero ? 'db-tile-can-drag' : ''} ${hover ? 'db-tile-highlight-over' : ''} ${((events||[]).some(ev=>ev.kind==='cast' || ev.kind==='precast')) ? 'bp-cast-glow' : ''} ${((events||[]).some(ev=>ev.kind==='damage')) ? 'bp-damage-shake' : ''} ${((events||[]).some(ev=>ev.kind==='heal')) ? 'bp-heal-glow' : ''} ${((events||[]).some(ev=>ev.kind==='effect-glow')) ? 'bp-effect-glow' : ''} ${((events||[]).some(ev=>ev.kind==='augment-glow')) ? 'bp-augment-glow' : ''}`}
        data-token={token}
        data-board-token={boardToken}
        draggable={draggable}
        onDragStart={e => movement?.onDragStart && movement.onDragStart(e, token)}
        onDragOver={e => { movement?.onDragOver && movement.onDragOver(e); e.preventDefault(); }}
        onDragEnter={e => { setHover(true); onHoverTile && onHoverTile(tile, player, index); }}
        onDragLeave={e => { setHover(false); onUnhoverTile && onUnhoverTile(); }}
        onDrop={e => { setHover(false); movement?.onDrop && movement.onDrop(e, token); }}
        onMouseEnter={() => { setHover(true); onHoverTile && onHoverTile(tile, player, index); }}
        onMouseLeave={() => { setHover(false); onUnhoverTile && onUnhoverTile(); }}
        title={name}
        style={{ position: 'relative', '--bp-cast-scale': precastScale }}
      >
        <>
          <div className="db-tile-stats" style={{ zIndex: 2 }}>
            <div className="db-stat"><HeartIcon />{hp}</div>
            <div className="db-stat"><ShieldIcon />{armor}</div>
            <div className="db-stat"><ShoeIcon />{speed}</div>
            <div className="db-stat"><LightningIcon />{energy}</div>
          </div>

          <div className="db-spell-counters" style={{ zIndex: 2 }}>
            <div className="db-spell-item" title={base?.spells?.front?.name || 'Front spell'}>
              <SwordIcon />{spellCasts.front}
            </div>

            <div className="db-spell-item" title={base?.spells?.middle?.name || 'Middle spell'}>
              <StaffIcon />{spellCasts.middle}
            </div>

            <div className="db-spell-item" title={base?.spells?.back?.name || 'Back spell'}>
              <BookIcon />{spellCasts.back}
            </div>
          </div>

          {/* hero background image (full tile, behind overlays) */}
          {tile.hero && tile.hero.image ? (
            <img
              src={getAssetPath(tile.hero.image)}
              alt={name}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: '#fff',
                borderRadius: 6,
                zIndex: 0,
                opacity: 1,
              }}
            />
          ) : null}

          {/* Monster badge: green 'M' in bottom-right when hero.monster === true */}
          {tile.hero && tile.hero.monster ? (
            <div style={{ position: 'absolute', right: 6, bottom: 6, width: 28, height: 28, borderRadius: 4, background: '#2ecc40', color: '#ffffff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>M</div>
          ) : null}

          <div className="db-tile-name" style={{ zIndex: 2 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <div className="db-tile-hero" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ color: '#111', textShadow: 'none', fontWeight: 700 }}>{name}</div>
              </div>
            </div>
          </div>

          {/* animation overlays (transient) */}
            {(events || []).map((ev, ei) => {
            const key = ev && ev.id ? `ev-${ev.id}` : `ev-${player}-${index}-${ei}`;
            const computePos = (effectIndex) => {
              // Map effect slot 0..3 to top-left, top-right, bottom-left, bottom-right
              switch (effectIndex) {
                case 0: return { left: '30%', top: '30%' };
                case 1: return { left: '70%', top: '30%' };
                case 2: return { left: '30%', top: '70%' };
                case 3: return { left: '70%', top: '70%' };
                default: return { left: '50%', top: '46%' };
              }
            };
            if (ev.kind === 'spell') {
              const spellId = (ev.spellId || 'unknown');
              // try direct match; otherwise find a config key that contains the spellId
              let cfg = SPELL_CONFIG[spellId] || null;
              if (!cfg) {
                const foundKey = Object.keys(SPELL_CONFIG).find(k => k.toLowerCase().includes((spellId || '').toLowerCase()));
                if (foundKey) cfg = SPELL_CONFIG[foundKey];
              }
              if (!cfg) cfg = { file: getAssetPath(`/images/spells/${spellId}.png`), frames: 1, frameWidth: 96, frameHeight: 96, cols: 1, rows: 1, maxDisplaySize: 96 };
              return <SpellSprite key={key} spellId={spellId} cfg={cfg} frameMs={600} />;
            }
            if (ev.kind === 'damage') {
              const pos = (typeof ev.effectIndex === 'number') ? computePos(ev.effectIndex) : computePos(ei % 4);
              return <div key={key} className="bp-float" style={{ color: '#e53935', left: pos.left, top: pos.top }}>{`-${ev.amount}`}</div>;
            }
            if (ev.kind === 'heal') {
            
              const pos = (typeof ev.effectIndex === 'number') ? computePos(ev.effectIndex) : computePos(ei % 4);
              return <div key={key} className="bp-float" style={{ color: '#43a047', left: pos.left, top: pos.top }}>{`+${ev.amount}`}</div>;
            }
            if (ev.kind === 'effect') {
              return <div key={key} className="bp-effect-badge">{ev.name}</div>;
            }
            if (ev.kind === 'cast') {
              return <div key={key} className="bp-cast-badge">{ev.spellId || 'Cast'}</div>;
            }
            if (ev.kind === 'energy') {
              const pos = (typeof ev.effectIndex === 'number') ? computePos(ev.effectIndex) : computePos(ei % 4);
              const amt = Number(ev.amount || 0);
              if (amt < 0) {
                return <div key={key} className="bp-float" style={{ color: '#ffd54f', left: pos.left, top: pos.top }}>{`-${Math.abs(amt)}`}</div>;
              }
              return <div key={key} className="bp-float" style={{ color: '#ffd54f', left: pos.left, top: pos.top }}>{`+${amt}`}</div>;
            }
              return null;
          })}

        </>
      </div>

      <EffectsColumn tileId={token} effects={effects} effectPrecast={effectPrecast} onEffectHover={onEffectHover} onEffectOut={onEffectOut} />
    </div>
  );
}

function BoardGrid({ label, tiles = [], movement, player, isReserve = false, isEliminated = false, eventsMap = {}, effectPrecastMap = {}, onHoverTile = null, onUnhoverTile = null, onEffectHover = null, onEffectOut = null }){
  const playerClass = player === 'p2' ? 'db-player2' : 'db-player1';
  const order = null;
  return (
    <div className={isEliminated ? 'db-board-eliminated' : ''} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div className={`db-player-label ${playerClass}`}>{label}{isReserve ? ' (Reserve)' : ''}</div>
      {isReserve ? (
        <div className="db-reserve-column">
          {(tiles || []).slice(0,2).map((t, i) => {
            const reserveKey = `${player}:reserve:${i}`;
            const ev = eventsMap && eventsMap[reserveKey];
            const vkey = `${player}:reserve:${i}`;
            return <SmallTile key={t && t.id ? t.id : `${player}:${i}`} tile={t} movement={movement} player={player} index={i} isReserve={isReserve} events={ev} effectPrecastMap={effectPrecastMap} onHoverTile={onHoverTile} onUnhoverTile={onUnhoverTile} onEffectHover={onEffectHover} onEffectOut={onEffectOut} />
          })}
        </div>
      ) : (
        <div className="db-main-grid">
          {(order || tiles.map((_, i) => i)).map((i) => {
            const t = tiles[i];
            const key = `${player}:${i}`;
            const ev = eventsMap && eventsMap[key];
            return <SmallTile key={t && t.id ? t.id : key} tile={t} movement={movement} player={player} index={i} isReserve={isReserve} events={ev} effectPrecastMap={effectPrecastMap} onHoverTile={onHoverTile} onUnhoverTile={onUnhoverTile} onEffectHover={onEffectHover} onEffectOut={onEffectOut} />
          })}
        </div>
      )}
    </div>
  );
}

import { executeRound } from './battleEngine';
import { indexToColumn, indexToRow, columnIndicesForBoard } from './targeting';

export default function BattlePhase({ gameState, socket, onGameEnd, aiDifficulty = null, autoPlay: autoPlayProp, localSide = null, matchPlayers = null, showReturnToMenu = true }){
  const autoPlay = (typeof autoPlayProp === 'boolean') ? autoPlayProp : !!aiDifficulty;
  const gameMode = gameState?.gameMode || 'classic';
  const p1Main = gameState?.p1Main || [];
  const p2Main = gameState?.p2Main || [];
  const p3Main = gameState?.p3Main || [];
  const p1Reserve = gameState?.p1Reserve || [];
  const p2Reserve = gameState?.p2Reserve || [];
  const p3Reserve = gameState?.p3Reserve || [];
  const [p1Board, setP1Board] = useState(p1Main);
  const [p2Board, setP2Board] = useState(p2Main);
  const [p3Board, setP3Board] = useState(p3Main);
  const [p1ReserveBoard, setP1ReserveBoard] = useState(p1Reserve);
  const [p2ReserveBoard, setP2ReserveBoard] = useState(p2Reserve);
  const [p3ReserveBoard, setP3ReserveBoard] = useState(p3Reserve);
  const emoteDelayRef = useRef(0);
  const lastEmoteTimeRef = useRef(0);
  const lastAnimationDelayRef = useRef(0);
  const lastAnimMsRef = useRef(1200);
  const animationEndTimeRef = useRef(0);
  const [log, setLog] = useState([]);
  const [phase, setPhase] = useState('ready');
  const [priorityPlayer, setPriorityPlayer] = useState('player1');
  const [eventsMap, setEventsMap] = useState({});
  const eventsClearTimeoutsRef = useRef({});
  const pendingSecondaryRef = useRef(null);
  const lastProcessedSeqRef = useRef(0);
  const recentEmoteRef = useRef({});
  const [effectPrecastMap, setEffectPrecastMap] = useState({});
  const prayerEmoteRef = useRef({});
  const [gameOver, setGameOver] = useState(null);
  const [victoryOverlayVisible, setVictoryOverlayVisible] = useState(false);
  // Dice roll animation state
  const [diceRoll, setDiceRoll] = useState(null); // { die, base, roll, total }

  // Sync state with gameState. Apply immediately for actions that represent
  // applied changes so client rendering reflects server-applied state at the
  // correct moments (onRoundStartTriggered, postEffectDelay, energyApplied, castApplied).
  useEffect(() => {
    if (!gameState) return;
    const lastAction = gameState.lastAction || null;
    const winner = lastAction && (lastAction.winner || (lastAction.type === 'gameEnd' ? lastAction.winner : null));
    if (winner && !gameOver) {
      setGameOver(winner);
    }
    const applyState = () => {
      setP1Board(gameState.p1Main || []);
      setP2Board(gameState.p2Main || []);
      if (Object.prototype.hasOwnProperty.call(gameState, 'p3Main')) setP3Board(gameState.p3Main || []);
      setP1ReserveBoard(gameState.p1Reserve || []);
      setP2ReserveBoard(gameState.p2Reserve || []);
      if (Object.prototype.hasOwnProperty.call(gameState, 'p3Reserve')) setP3ReserveBoard(gameState.p3Reserve || []);
      setPriorityPlayer(gameState.priorityPlayer || 'player1');
      if (gameState.phase) {
        
        setPhase(gameState.phase);
      } else if (gameState.lastAction && (gameState.lastAction.type === 'roundComplete' || gameState.lastAction.type === 'gameEnd')) {
        setPhase('ready');
      }
    };

    const lastType = lastAction && lastAction.type;
    const animStepTypes = [
      'onRoundStartTriggered',
      'postEffectDelay',
      'energyApplied',
      'castApplied',
      'pulsesApplied',
      'reactionsApplied',
      'effectApplied'
    ];
    // Don't defer roundComplete - it needs to apply immediately to show final state
    const shouldDeferToAnimation = !!(lastAction && lastAction.state && animStepTypes.includes(lastType));

    // CRITICAL: Phase changes (especially to movement/ready) and roundComplete must apply immediately
    // If the phase is 'movement' or 'ready', or if this is roundComplete, apply state immediately
    const isPhaseTransition = gameState.phase && (gameState.phase === 'movement' || gameState.phase === 'ready');
    const isRoundComplete = lastType === 'roundComplete';
    
    if (isPhaseTransition || isRoundComplete) {
      // Apply phase transitions and round completion immediately - no delay
      
      applyState();
      return;
    }

    if (shouldDeferToAnimation) {
      const expectedSeq = typeof lastAction.seq === 'number' ? lastAction.seq : null;
      const t = setTimeout(() => {
        if (expectedSeq != null && lastProcessedSeqRef.current >= expectedSeq) return;
        applyState();
      }, 1200);
      return () => clearTimeout(t);
    }

    // Default: apply quickly for non-animation steps
    const t = setTimeout(() => {
      applyState();
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  useEffect(() => {
    if (!gameOver) {
      setVictoryOverlayVisible(false);
      return;
    }
    const t = setTimeout(() => {
      setVictoryOverlayVisible(true);
    }, 60);
    return () => clearTimeout(t);
  }, [gameOver]);

  // Listen for step events from server (ACK-based sequencing)
  useEffect(() => {
    if (socket) {
      socket.on('step', (action) => {
        enqueueAnimation(action);
      });
    }
    return () => {
      if (socket) {
        socket.off('step');
      }
    };
  }, [socket]);

  // Ensure fixed-positional reserve heroes receive their starting reserve energy
  useEffect(() => {
    const applyReserveBonusesTo = (boardArr, setBoard) => {
      if (!boardArr || !setBoard) return;
      const copy = (boardArr || []).map(t => t ? { ...t } : t);
      let changed = false;
      copy.forEach(t => {
        try {
          if (!t || !t.hero) return;
          const h = t.hero;
          if (h.fixedPositional && h.positionalModifiers && h.positionalModifiers.reserve && typeof h.positionalModifiers.reserve.energy === 'number') {
            if (!t._reserveBonusApplied) {
              const bonus = Number(h.positionalModifiers.reserve.energy || 0);
              t.currentEnergy = (typeof t.currentEnergy === 'number' ? t.currentEnergy : (h && h.energy) || 0) + bonus;
              t._reserveBonusApplied = true;
              // Cache starting row on the hero so it remains 'reserve' even after movement
              try { if (!t.hero._startingRow) t.hero._startingRow = 'reserve'; } catch (e) {}
              changed = true;
            }
          }
        } catch (e) {}
      });
      if (changed) setBoard(copy);
    };
    applyReserveBonusesTo(p1ReserveBoard, setP1ReserveBoard);
    applyReserveBonusesTo(p2ReserveBoard, setP2ReserveBoard);
    if (gameMode === 'ffa3') applyReserveBonusesTo(p3ReserveBoard, setP3ReserveBoard);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const addLog = useCallback(msg => setLog(l => [...l, msg]), []);

  const [hoverInfo, setHoverInfo] = useState(null);
  const handleHoverTile = useCallback((tile, player, index) => {
    if (!tile || !tile.hero) { setHoverInfo(null); return; }
    setHoverInfo({ type: 'tile', tile, player, index });
  }, []);
  const handleUnhoverTile = useCallback(() => setHoverInfo(null), []);
  const handleEffectHover = useCallback((effect) => { setHoverInfo({ type: 'effect', effect }); }, []);
  const handleEffectOut = useCallback(() => setHoverInfo(null), []);

  const movement = useMovement({
    p1Board, p2Board, p3Board, p1Reserve: p1ReserveBoard, p2Reserve: p2ReserveBoard, p3Reserve: p3ReserveBoard,
    setP1Board, setP2Board, setP3Board, setP1ReserveBoard, setP2ReserveBoard, setP3ReserveBoard,
    priorityPlayer, setPriorityPlayer, addLog, setGameState: setPhase,
    aiDifficulty,
    localSide,
    serverMovementPhase: gameState?.movementPhase || null,
    onServerMove: socket ? ((sourceId, targetId) => {
      socket.emit('movementMove', { sourceId, targetId });
    }) : null
  });

  // Notify server when movement completes so it can persist the new boards.
  const prevMovementRef = useRef(null);
  useEffect(() => {
    if (gameState?.movementPhase) return;
    const prev = prevMovementRef.current;
    const current = movement?.movementPhase || null;
    prevMovementRef.current = current;
    if (prev && !current && phase === 'ready' && socket) {
      socket.emit('movementComplete', {
        p1Main: p1Board,
        p2Main: p2Board,
        ...(gameMode === 'ffa3' ? { p3Main: p3Board } : {}),
        p1Reserve: p1ReserveBoard,
        p2Reserve: p2ReserveBoard,
        ...(gameMode === 'ffa3' ? { p3Reserve: p3ReserveBoard } : {}),
        priorityPlayer
      });
    }
  }, [gameState?.movementPhase, movement?.movementPhase, phase, socket, p1Board, p2Board, p3Board, p1ReserveBoard, p2ReserveBoard, p3ReserveBoard, priorityPlayer, gameMode]);

  // Fallback: if we receive a full gameState update with roundComplete,
  // ensure movement starts even if animation events were missed.
  useEffect(() => {
    if (!autoPlay) return;
    if (!gameState || !gameState.lastAction) return;
    if (gameState.lastAction.type !== 'roundComplete') return;
    if (gameState.lastAction.winner) return;
    if (gameOver) return;
    if (!movement || movement.movementPhase) return;

    const t = setTimeout(() => {
      if (movement && movement.startMovementPhase && !movement.movementPhase) {
        movement.startMovementPhase();
      }
    }, 200);
    return () => clearTimeout(t);
  }, [autoPlay, gameState?.lastAction?.type, movement, movement?.movementPhase]);

  // animation API (provided when app is wrapped with <AnimationLayer>)
  const { play } = useAnimations();

  // Event queue to serialise animation events and avoid progressive timing drift
  const eventQueueRef = useRef([]);
  const processingQueueRef = useRef(false);

  const sleep = ms => new Promise(res => setTimeout(res, ms));

  const applyStateSnapshot = (snapshot) => {
    if (!snapshot) return;
    
    setP1Board(snapshot.p1Main || []);
    setP2Board(snapshot.p2Main || []);
    if (Object.prototype.hasOwnProperty.call(snapshot, 'p3Main')) setP3Board(snapshot.p3Main || []);
    setP1ReserveBoard(snapshot.p1Reserve || []);
    setP2ReserveBoard(snapshot.p2Reserve || []);
    if (Object.prototype.hasOwnProperty.call(snapshot, 'p3Reserve')) setP3ReserveBoard(snapshot.p3Reserve || []);
    setPriorityPlayer(snapshot.priorityPlayer || 'player1');
    // Use server's phase if available, otherwise default to 'ready'
    if (snapshot.phase) {
      setPhase(snapshot.phase);
    } else {
      setPhase('ready');
    }
  };

  const handleAnimationAction = async (lastAction) => {
    

    if (!lastAction || !lastAction.type) return;

    if (typeof lastAction.seq === 'number') {
      lastProcessedSeqRef.current = lastAction.seq;
    }

    if (lastAction.type === 'onRoundStartTriggered' || lastAction.type === 'roundComplete') {
      lastPulseSeenRef.current = {};
    }

    if (lastAction.state) {
      applyStateSnapshot(lastAction.state);
    }

    // Helper for deduplication: returns a unique key for each emote/pulse
    const getPulseKey = (action) => {
      if (!action) return '';
      if (action.type === 'effectPulse' || action.type === 'energyIncrement') {
        const t = action.target || {};
        if (typeof action.seq === 'number') return `${action.type}:${action.seq}`;
        // Include reactionIndex and owner info for Prayer-type reactions to distinguish sources
        const reactionId = action.reactionIndex != null ? `:rx${action.reactionIndex}` : '';
        const ownerId = action.ownerBoardName && typeof action.ownerIndex === 'number'
          ? `:owner${action.ownerBoardName}:${action.ownerIndex}`
          : '';
        // Include both effectName and source for passives like Frenzy
        const sourceName = action.effectName || action.source || '';
        return `${action.type}:${t.boardName}:${t.index}:${action.action || ''}:${action.amount || ''}:${sourceName}${reactionId}${ownerId}`;
      }
      return `${action.type}:${JSON.stringify(action)}`;
    };

    // Deduplicate emotes/pulses
    if (['effectPulse', 'energyIncrement'].includes(lastAction.type)) {
      const pulseKey = getPulseKey(lastAction);
      if (lastPulseSeenRef.current[pulseKey]) {
        
        return;
      }
      
      lastPulseSeenRef.current[pulseKey] = Date.now();
    }

    if (lastAction.type === 'roundComplete' || lastAction.type === 'gameEnd') {
      // Handle winner detection from step events (important for local games where
      // gameState isn't emitted until after animations complete)
      const winner = lastAction.winner;
      if (winner && !gameOver) {
        setGameOver(winner);
      }
      
      if (lastAction.type === 'roundComplete' && autoPlay && !lastAction.winner && movement && movement.startMovementPhase) {
        await sleep(300);
        movement.startMovementPhase();
      }
    } else if (lastAction.type === 'postCastWait') {
      // Wait after each cast (duration provided by server)
      const dur = Number(lastAction.duration || 500) || 500;
      await sleep(dur);
    } else if (lastAction.type === 'effectApplied') {
      // Effects are now rendered directly from gameState - no local visibility management
      // Just wait briefly for visual continuity
      await sleep(300);
    } else if (lastAction.type === 'effectPreCast') {
      if (lastAction.target && lastAction.target.boardName) {
        const tside = boardNameToSide(lastAction.target.boardName);
        const tkey = `${tside}:${lastAction.target.index}`;
        const isReactionPrecast = lastAction.reactionIndex != null || lastAction.effectName === 'Prayer'
          || (lastAction.ownerBoardName && typeof lastAction.ownerIndex === 'number');
        const isAugmentProc = lastAction.effectName === 'Thorns';
        if (isReactionPrecast && lastAction.ownerBoardName && typeof lastAction.ownerIndex === 'number' && !isAugmentProc) {
          const oSide = boardNameToSide(lastAction.ownerBoardName);
          const ownerKey = `${oSide}:${lastAction.ownerIndex}`;
          setEffectPrecastMap(prev => ({
            ...prev,
            [ownerKey]: { effectName: lastAction.effectName, effectIndex: lastAction.effectIndex }
          }));
          setTimeout(() => {
            setEffectPrecastMap(prev => {
              const next = { ...prev };
              delete next[ownerKey];
              return next;
            });
          }, 250);
        } else if (!isAugmentProc) {
          setEventsMap(prev => {
            const next = { ...prev };
            next[tkey] = next[tkey] || [];
            next[tkey].push({ kind: 'precast', spellId: lastAction.effectName || 'Effect', scale: typeof lastAction.scale === 'number' ? lastAction.scale : 1 });
            return next;
          });
        }
        setTimeout(() => {
          setEventsMap(prev => {
            const n = { ...prev };
            if (n[tkey]) {
              n[tkey] = n[tkey].filter(ev => ev.kind !== 'precast');
              if (n[tkey].length === 0) delete n[tkey];
            }
            return n;
          });
        }, isReactionPrecast ? 300 : 2000);
        await sleep(isReactionPrecast ? 0 : 500);
      }
    } else if (lastAction.type === 'preCast' || lastAction.type === 'precast') {
      if (lastAction.caster && lastAction.caster.boardName) {
        const casterSide = boardNameToSide(lastAction.caster.boardName);
        const casterKey = `${casterSide}:${lastAction.caster.index}`;
        setEventsMap(prev => {
          const next = { ...prev };
          next[casterKey] = next[casterKey] || [];
          next[casterKey].push({ kind: 'precast', spellId: lastAction.spellId });
          return next;
        });
        // clear visual after 2s (non-blocking)
        setTimeout(() => {
          setEventsMap(prev => {
            const n = { ...prev };
            if (n[casterKey]) {
              n[casterKey] = n[casterKey].filter(ev => ev.kind !== 'precast' || ev.spellId !== lastAction.spellId);
              if (n[casterKey].length === 0) delete n[casterKey];
            }
            return n;
          });
        }, 2000);
        // Wait 500ms for precast glow
        await sleep(500);
      }
    } else if (lastAction.type === 'cast') {
      const casterSide = boardNameToSide(lastAction.caster && lastAction.caster.boardName || '');
      const spellId = lastAction.spellId;
      const animationSpellId = lastAction.copiedSpellId || spellId;
      const spellDef = getSpellById(animationSpellId) || {};
      pendingSecondaryRef.current = null;

      // Show dice roll animation if this spell has roll info
      if (lastAction.rollInfo && lastAction.rollInfo.die && lastAction.rollInfo.roll) {
        setDiceRoll(lastAction.rollInfo);
        // Keep dice visible for 1.5 seconds before spell animation plays
        await sleep(1500);
        setDiceRoll(null);
      }

      if (play && spellDef.animation) {
        // Build token center map from DOM
        const tokenCenterMap = {};
        try {
          Array.from(document.querySelectorAll('[data-board-token],[data-token]')).forEach(el => {
            const v = el.getAttribute('data-board-token') || el.getAttribute('data-token');
            if (!v) return;
            try {
              const r = el.getBoundingClientRect();
              tokenCenterMap[v] = {
                x: Math.round(r.left + r.width / 2 + window.scrollX),
                y: Math.round(r.top + r.height / 2 + window.scrollY)
              };
            } catch (e) {}
          });
        } catch (e) {}

        const casterKey = `${casterSide}:${lastAction.caster.index}`;
        const casterCenter = tokenCenterMap[casterKey];

        const targetDescriptors = (spellDef && spellDef.spec && Array.isArray(spellDef.spec.targets)) ? spellDef.spec.targets : [];
        const results = Array.isArray(lastAction.results) ? lastAction.results : [];
        const allTargetTokens = results.map(r => r && r.target).filter(Boolean);
        // Prefer a primary-phase target for the primary animation. If none, don't infer primary from secondary.
        const primaryResults = results.filter(r => r && r.phase === 'primary' && r.target);
        const firstTarget = (primaryResults.length > 0 ? primaryResults[0].target : null);
        const descSide = (targetDescriptors[0] && targetDescriptors[0].side) ? targetDescriptors[0].side : 'enemy';
        const inferredSide = descSide === 'ally' ? casterSide : (gameMode === 'ffa3' ? null : (casterSide === 'p1' ? 'p2' : 'p1'));
        const targetSide = firstTarget ? boardNameToSide(firstTarget.boardName) : inferredSide;
        const animName = spellDef.animation;
        const config = SPELL_CONFIG[animName];
        const uiScale = getUiScale();
        const props = config ? {
          sprite: getAssetPath(config.file),
          frames: config.frames,
          cols: config.cols,
          rows: config.rows,
          size: Math.round((config.maxDisplaySize || 96) * uiScale)
        } : {};

        const targetTypes = targetDescriptors.map(t => t && t.type).filter(Boolean);
        const isBoardSpell = targetTypes.includes('board');
        const isColumnSpell = targetTypes.includes('column');
        const secondaryAnimationMode = spellDef && spellDef.secondaryAnimationMode ? spellDef.secondaryAnimationMode : null;
        // Include rowContainingLowestArmor so spells targeting the lowest-armor row behave like other row spells
        const isRowSpell = targetTypes.some(t => t === 'rowContainingHighestArmor' || t === 'rowContainingLowestArmor' || t === 'frontmostRowWithHero' || t === 'backmostRowWithHero' || t === 'frontTwoRows' || t === 'backRow' || t === 'rowWithHighestSumArmor');
        const isHealSpell = (spellDef && spellDef.spec && spellDef.spec.formula && spellDef.spec.formula.type === 'heal') || results.some(r => r && r.applied && r.applied.type === 'heal');
        const placement = isHealSpell ? 'inplace' : (spellDef.animationPlacement || 'travel');

        // Play sound effect if spell has one
        if (spellDef && spellDef.sound) {
          try {
            const audio = new Audio(getAssetPath(spellDef.sound));
            const baseVolume = spellDef.soundVolume != null ? spellDef.soundVolume : 0.5;
            const sfxVolume = sfxManager.getVolume();
            audio.volume = Math.max(0, Math.min(1, baseVolume * sfxVolume));
            audio.play().catch(() => {});
          } catch (e) {
          }
        }

        if (animName && firstTarget) {
          if (isBoardSpell && targetSide) {
            // For board-wide spells, cover each targeted board with a single scaled animation
            const tokenSides = Array.from(
              new Set(allTargetTokens.map(t => boardNameToSide(t.boardName)).filter(Boolean))
            );
            const sidesToAnimate = tokenSides.length > 0 ? tokenSides : [targetSide];
            for (const side of sidesToAnimate) {
              const topLeftKey = `${side}:0`;
              const bottomRightKey = `${side}:8`;
              const topLeft = tokenCenterMap[topLeftKey];
              const bottomRight = tokenCenterMap[bottomRightKey];
              if (!topLeft || !bottomRight) continue;
              const boardCenterX = (topLeft.x + bottomRight.x) / 2;
              const boardCenterY = (topLeft.y + bottomRight.y) / 2;
              const boardCenter = { x: boardCenterX, y: boardCenterY };
              const boardWidth = Math.abs(bottomRight.x - topLeft.x) + 100;
              const boardHeight = Math.abs(bottomRight.y - topLeft.y) + 100;
              const boardSize = Math.max(boardWidth, boardHeight);
              const boardProps = { ...props, size: boardSize };
              play({ name: animName, from: boardCenter, to: boardCenter, duration: lastAction.animationMs || 1200, props: boardProps });
              await sleep(Number(lastAction.animationMs || 1200));
            }
          } else if (spellId === 'multishot' && casterCenter && allTargetTokens.length > 0) {
            for (const tgt of allTargetTokens) {
              const tside = boardNameToSide(tgt.boardName);
              const tkey = `${tside}:${tgt.index}`;
              const tcenter = tokenCenterMap[tkey];
              if (!tcenter) continue;
              play({ name: animName, from: casterCenter, to: tcenter, duration: lastAction.animationMs || 1200, props });
              await sleep(Number(lastAction.animationMs || 1200));
            }
          } else if (placement === 'inplace' && !isRowSpell && !isColumnSpell && !isBoardSpell) {
            // Play in-place animation at each target (heal spells use this)
            for (const tgt of allTargetTokens) {
              const tside = boardNameToSide(tgt.boardName);
              const tkey = `${tside}:${tgt.index}`;
              const tcenter = tokenCenterMap[tkey];
              if (!tcenter) continue;
              play({ name: animName, from: tcenter, to: tcenter, duration: lastAction.animationMs || 1200, props });
              await sleep(Number(lastAction.animationMs || 1200));
            }
          } else if (isRowSpell && targetSide && firstTarget) {
            const sortByX = (indices, side) => {
              indices.sort((a, b) => {
                const aPos = tokenCenterMap[`${side}:${a}`];
                const bPos = tokenCenterMap[`${side}:${b}`];
                const ax = aPos ? aPos.x : 0;
                const bx = bPos ? bPos.x : 0;
                if (ax !== bx) return ax - bx;
                return indexToColumn(a, side) - indexToColumn(b, side);
              });
            };
            const secondaryTargets = new Set(
              results
                .filter(r => r && r.phase === 'secondary' && r.target)
                .map(r => `${boardNameToSide(r.target.boardName)}:${r.target.index}`)
            );
            const hasSelfTarget = targetDescriptors.some(t => t && t.type === 'self');
            const excludeCasterFromPrimary = !!(spellDef.animationSecondary && hasSelfTarget && casterSide && lastAction.caster && typeof lastAction.caster.index === 'number');
            const primaryTargets = (spellDef.animationSecondary
              ? allTargetTokens.filter(tgt => !secondaryTargets.has(`${boardNameToSide(tgt.boardName)}:${tgt.index}`))
              : allTargetTokens
            ).filter(tgt => !(excludeCasterFromPrimary && boardNameToSide(tgt.boardName) === casterSide && tgt.index === lastAction.caster.index));
            const tokenSides = Array.from(
              new Set(primaryTargets.map(t => boardNameToSide(t.boardName)).filter(Boolean))
            );
            const sidesToAnimate = tokenSides.length > 0 ? tokenSides : [targetSide];
            for (const side of sidesToAnimate) {
              const sideTargets = primaryTargets.filter(t => boardNameToSide(t.boardName) === side);
              if (spellId === 'coneOfCold') {
                const frontRowIndices = [];
                const middleRowIndices = [];
                for (let i = 0; i < 9; i++) {
                  const r = indexToRow(i, side);
                  if (r === 0) frontRowIndices.push(i);
                  if (r === 1) middleRowIndices.push(i);
                }
                sortByX(frontRowIndices, side);
                sortByX(middleRowIndices, side);
                const startIdx = frontRowIndices[0];
                const endIdx = frontRowIndices[frontRowIndices.length - 1];
                const startKey = `${side}:${startIdx}`;
                const endKey = `${side}:${endIdx}`;
                const startCenter = tokenCenterMap[startKey];
                const endCenter = tokenCenterMap[endKey];
                const findIndexByRowCol = (row, col) => {
                  for (let i = 0; i < 9; i++) {
                    if (indexToRow(i, side) === row && indexToColumn(i, side) === col) return i;
                  }
                  return null;
                };
                const frontMidIdx = findIndexByRowCol(0, 1);
                const middleMidIdx = findIndexByRowCol(1, 1);
                const frontMidCenter = frontMidIdx != null ? tokenCenterMap[`${side}:${frontMidIdx}`] : null;
                const middleMidCenter = middleMidIdx != null ? tokenCenterMap[`${side}:${middleMidIdx}`] : null;
                if (startCenter && endCenter) {
                  const rowSpacing = (frontMidCenter && middleMidCenter)
                    ? Math.abs(middleMidCenter.y - frontMidCenter.y)
                    : 0;
                  const yOffset = (frontMidCenter && middleMidCenter)
                    ? (middleMidCenter.y - frontMidCenter.y) / 2
                    : 0;
                  const rowWidth = Math.abs(endCenter.x - startCenter.x) + 100;
                  const rowHeight = Math.abs(endCenter.y - startCenter.y) + rowSpacing + 100;
                  const coneProps = { ...props, size: Math.max(rowWidth, rowHeight, Number(props?.size || 0)) };
                  play({
                    name: animName,
                    from: { x: startCenter.x, y: startCenter.y + yOffset },
                    to: { x: endCenter.x, y: endCenter.y + yOffset },
                    duration: lastAction.animationMs || 1200,
                    props: coneProps
                  });
                  await sleep(Number(lastAction.animationMs || 1200));
                }
              } else {
                const sideFirst = sideTargets[0];
                if (!sideFirst) continue;
                const row = indexToRow(sideFirst.index, side);
                const rowIndices = [];
                for (let i = 0; i < 9; i++) {
                  if (indexToRow(i, side) === row) rowIndices.push(i);
                }
                sortByX(rowIndices, side);
                const startIdx = rowIndices[0];
                const endIdx = rowIndices[rowIndices.length - 1];
                const startKey = `${side}:${startIdx}`;
                const endKey = `${side}:${endIdx}`;
                const startCenter = tokenCenterMap[startKey];
                const endCenter = tokenCenterMap[endKey];
                if (startCenter && endCenter) {
                  play({ name: animName, from: startCenter, to: endCenter, duration: lastAction.animationMs || 1200, props });
                  await sleep(Number(lastAction.animationMs || 1200));
                }
              }
            }
          } else if (isColumnSpell && targetSide) {
            const casterCol = indexToColumn(lastAction.caster.index, casterSide);
            const secondaryTargets = new Set(
              results
                .filter(r => r && r.phase === 'secondary' && r.target)
                .map(r => `${boardNameToSide(r.target.boardName)}:${r.target.index}`)
            );
            const hasSelfTarget = targetDescriptors.some(t => t && t.type === 'self');
            const excludeCasterFromPrimary = !!(spellDef.animationSecondary && hasSelfTarget && casterSide && lastAction.caster && typeof lastAction.caster.index === 'number');
            const primaryTargets = (spellDef.animationSecondary
              ? allTargetTokens.filter(tgt => !secondaryTargets.has(`${boardNameToSide(tgt.boardName)}:${tgt.index}`))
              : allTargetTokens
            ).filter(tgt => !(excludeCasterFromPrimary && boardNameToSide(tgt.boardName) === casterSide && tgt.index === lastAction.caster.index));
            const tokenSides = Array.from(
              new Set(primaryTargets.map(t => boardNameToSide(t.boardName)).filter(Boolean))
            );
            const sidesToAnimate = tokenSides.length > 0 ? tokenSides : [targetSide];
            const findIndexByRowCol = (row, col, side) => {
              for (let i = 0; i < 9; i++) {
                if (indexToRow(i, side) === row && indexToColumn(i, side) === col) return i;
              }
              return null;
            };
            const getRowSpacing = (side) => {
              const frontMidIdx = findIndexByRowCol(0, 1, side);
              const middleMidIdx = findIndexByRowCol(1, 1, side);
              const frontMidCenter = frontMidIdx != null ? tokenCenterMap[`${side}:${frontMidIdx}`] : null;
              const middleMidCenter = middleMidIdx != null ? tokenCenterMap[`${side}:${middleMidIdx}`] : null;
              if (!frontMidCenter || !middleMidCenter) return null;
              return Math.abs(middleMidCenter.y - frontMidCenter.y);
            };
            for (const side of sidesToAnimate) {
              const sideTargets = primaryTargets.filter(t => boardNameToSide(t.boardName) === side);
              const sideFirst = sideTargets[0];
              const sideCol = (sideFirst && typeof sideFirst.index === 'number')
                ? indexToColumn(sideFirst.index, side)
                : ((side !== casterSide) ? (2 - casterCol) : casterCol);
              const colIndices = columnIndicesForBoard(sideCol, side);
              const frontIdx = colIndices[0];
              const backIdx = colIndices[colIndices.length - 1];
              const p3CastingToOther = casterSide === 'p3' && side !== 'p3';
              const startIdx = frontIdx;
              const endIdx = backIdx;
              const startKey = `${side}:${startIdx}`;
              const endKey = `${side}:${endIdx}`;
              const startBase = tokenCenterMap[startKey];
              const endBase = tokenCenterMap[endKey];
              if (!startBase || !endBase) continue;
              let startCenter = { ...startBase };
              const baseOffset = 120;
              const forceAboveTarget = side === 'p3' && casterSide !== 'p3';
              const rotateForP3Target = side === 'p3' && (casterSide === 'p1' || casterSide === 'p2') && side !== casterSide;
              const travelProps = rotateForP3Target ? { ...props, rotateDeg: 270 } : props;
              const rowSpacing = (forceAboveTarget && getRowSpacing(side)) ? getRowSpacing(side) : null;
              const offset = (forceAboveTarget && rowSpacing)
                ? Math.max(40, Math.min(baseOffset, rowSpacing * 0.6))
                : baseOffset;
              if (forceAboveTarget) {
                startCenter = { x: startBase.x, y: startBase.y - offset };
              } else if (p3CastingToOther) {
                const dx = startBase.x - endBase.x;
                const dy = startBase.y - endBase.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                  startCenter = {
                    x: startBase.x + (dx / dist) * offset,
                    y: startBase.y + (dy / dist) * offset
                  };
                } else {
                  startCenter = { x: startBase.x, y: startBase.y - offset };
                }
              } else if (casterCenter) {
                const dx = casterCenter.x - startBase.x;
                const dy = casterCenter.y - startBase.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                  startCenter = {
                    x: startBase.x + (dx / dist) * offset,
                    y: startBase.y + (dy / dist) * offset
                  };
                } else {
                  startCenter = { x: startBase.x, y: startBase.y - offset };
                }
              } else {
                startCenter = { x: startBase.x, y: startBase.y - offset };
              }
              play({ name: animName, from: startCenter, to: endBase, duration: lastAction.animationMs || 1200, props: travelProps });
              await sleep(Number(lastAction.animationMs || 1200));
            }
          } else {
            if (allTargetTokens.length > 1) {
              const secondaryTargets = new Set(
                results
                  .filter(r => r && r.phase === 'secondary' && r.target)
                  .map(r => `${boardNameToSide(r.target.boardName)}:${r.target.index}`)
              );
              const primaryTargets = spellDef.animationSecondary
                ? allTargetTokens.filter(tgt => !secondaryTargets.has(`${boardNameToSide(tgt.boardName)}:${tgt.index}`))
                : allTargetTokens;

              for (const tgt of primaryTargets) {
                const tside = boardNameToSide(tgt.boardName);
                const tkey = `${tside}:${tgt.index}`;
                const tcenter = tokenCenterMap[tkey];
                if (casterCenter && tcenter) {
                  play({ name: animName, from: casterCenter, to: tcenter, duration: lastAction.animationMs || 1200, props });
                  await sleep(Number(lastAction.animationMs || 1200));
                }
              }
            } else {
              const targetKey = `${targetSide}:${firstTarget.index}`;
              const targetCenter = tokenCenterMap[targetKey];
              if (casterCenter && targetCenter) {
                play({ name: animName, from: casterCenter, to: targetCenter, duration: lastAction.animationMs || 1200, props });
                await sleep(Number(lastAction.animationMs || 1200));
              }
            }
          }

          // Defer optional secondary animation (e.g., Arcane Explosion adjacent hits)
          if (lastAction.secondaryAnimation) {
            const secName = lastAction.secondaryAnimation;
            const secCfg = SPELL_CONFIG[secName];
            const secUiScale = getUiScale();
            const secProps = secCfg ? {
              sprite: getAssetPath(secCfg.file),
              frames: secCfg.frames,
              cols: secCfg.cols,
              rows: secCfg.rows,
              size: Math.round((secCfg.maxDisplaySize || 96) * secUiScale)
            } : {};
            pendingSecondaryRef.current = {
              name: secName,
              duration: Number(lastAction.secondaryAnimationMs || lastAction.animationMs || 1200),
              props: secProps,
              casterKey,
              casterCenter,
              targets: Array.isArray(lastAction.secondaryTargets) ? lastAction.secondaryTargets : [],
              mode: secondaryAnimationMode,
              expectedPlays: (secondaryAnimationMode === 'rowSweep' && Array.isArray(lastAction.secondaryTargets))
                ? Array.from(new Set((lastAction.secondaryTargets || []).map(t => {
                    const side = boardNameToSide(t && t.boardName);
                    const idx = Number(t && t.index);
                    if (!side || Number.isNaN(idx)) return null;
                    return `${side}:${indexToRow(idx, side)}`;
                  }).filter(Boolean)))
                : null,
              played: new Set()
            };
          }
        }

        // Set up secondary animation even if primary target was null (e.g., projectile missed)
        // This allows spells like "battle" to still play the secondary slash when projectile misses
        if (!firstTarget && lastAction.secondaryAnimation) {
          const secName = lastAction.secondaryAnimation;
          const secCfg = SPELL_CONFIG[secName];
          const secUiScale = getUiScale();
          const secProps = secCfg ? {
            sprite: getAssetPath(secCfg.file),
            frames: secCfg.frames,
            cols: secCfg.cols,
            rows: secCfg.rows,
            size: Math.round((secCfg.maxDisplaySize || 96) * secUiScale)
          } : {};
          pendingSecondaryRef.current = {
            name: secName,
            duration: Number(lastAction.secondaryAnimationMs || lastAction.animationMs || 1200),
            props: secProps,
            casterKey,
            casterCenter,
            targets: Array.isArray(lastAction.secondaryTargets) ? lastAction.secondaryTargets : [],
            mode: secondaryAnimationMode,
            expectedPlays: (secondaryAnimationMode === 'rowSweep' && Array.isArray(lastAction.secondaryTargets))
              ? Array.from(new Set((lastAction.secondaryTargets || []).map(t => {
                  const side = boardNameToSide(t && t.boardName);
                  const idx = Number(t && t.index);
                  if (!side || Number.isNaN(idx)) return null;
                  return `${side}:${indexToRow(idx, side)}`;
                }).filter(Boolean)))
              : null,
            played: new Set()
          };
        }
      } else {
        // No animation; tiny pause to keep ordering consistent
        await sleep(50);
      }
      emoteDelayRef.current = 0;
    } else if (lastAction.type === 'postEffectDelay') {
      const dur = Number(lastAction.duration || 0) || 0;
      // block subsequent events for the duration
      await sleep(dur);
    } else if (lastAction.type === 'effectPulse') {
      if (lastAction.target && lastAction.target.boardName) {
        const tside = boardNameToSide(lastAction.target.boardName);
        const mainKey = `${tside}:${lastAction.target.index}`;

        let evPayload = null;
        if (lastAction.action === 'heal') evPayload = { kind: 'heal', amount: lastAction.amount };
        else if (lastAction.action === 'damage') evPayload = { kind: 'damage', amount: lastAction.amount };
        else if (lastAction.action === 'energy') evPayload = { kind: 'energy', amount: lastAction.amount };

        if (lastAction.phase === 'secondary' && pendingSecondaryRef.current) {
          const pending = pendingSecondaryRef.current;
          const targetKey = `${tside}:${lastAction.target.index}`;
          const targetRowKey = `${tside}:${indexToRow(lastAction.target.index, tside)}`;
          const matches = Array.isArray(pending.targets) && pending.targets.length > 0
            ? pending.targets.some(t => t && String(t.boardName).startsWith(tside) && Number(t.index) === Number(lastAction.target.index))
            : true;
          if (matches && (pending.mode === 'rowSweep' ? !pending.played.has(targetRowKey) : !pending.played.has(targetKey))) {
            if (pending.mode === 'rowSweep') {
              const row = indexToRow(lastAction.target.index, tside);
              const rowIndices = [];
              for (let i = 0; i < 9; i++) {
                if (indexToRow(i, tside) === row) rowIndices.push(i);
              }
              rowIndices.sort((a, b) => indexToColumn(a, tside) - indexToColumn(b, tside));
              const startIdx = rowIndices[0];
              const endIdx = rowIndices[rowIndices.length - 1];
              const startCenter = getTileCenter(`${tside}:${startIdx}`);
              const endCenter = getTileCenter(`${tside}:${endIdx}`);
              if (play && startCenter && endCenter) {
                play({ name: pending.name, from: startCenter, to: endCenter, duration: pending.duration, props: pending.props || {} });
                await sleep(Number(pending.duration || 1200));
              }
              pending.played.add(targetRowKey);
            } else {
              const targetCenter = getTileCenter(targetKey);
              if (play && targetCenter) {
                play({ name: pending.name, from: targetCenter, to: targetCenter, duration: pending.duration, props: pending.props || {} });
                await sleep(Number(pending.duration || 1200));
              }
              pending.played.add(targetKey);
            }
            if (Array.isArray(pending.expectedPlays) && pending.expectedPlays.length > 0) {
              if (pending.played.size >= pending.expectedPlays.length) pendingSecondaryRef.current = null;
            } else if (pending.targets && pending.played.size >= pending.targets.length) {
              pendingSecondaryRef.current = null;
            }
          }
        }

        if (evPayload) {
          if (evPayload.kind === 'energy' && shouldSkipEnergyEmote(tside, lastAction.target.index, evPayload.amount)) {
            return;
          }
          const eventId = typeof lastAction.seq === 'number' ? `seq:${lastAction.seq}` : `ts:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          evPayload.id = eventId;
          const emoteKey = `${mainKey}:${evPayload.kind}:${evPayload.amount}`;
          if (lastAction.effectName === 'Prayer' && evPayload.kind === 'heal') {
            const prayerKey = `${mainKey}:${evPayload.amount}`;
            const lastPrayer = prayerEmoteRef.current[prayerKey];
            if (lastPrayer && (Date.now() - lastPrayer) < 800) {
              
              return;
            }
            prayerEmoteRef.current[prayerKey] = Date.now();
          }
          const lastSeen = recentEmoteRef.current[emoteKey];
          if (lastSeen && (Date.now() - lastSeen) < 300) {
            
          } else {
            recentEmoteRef.current[emoteKey] = Date.now();
          // Add the emote to eventsMap
          setEventsMap(prev => {
            const next = { ...prev };
            next[mainKey] = next[mainKey] || [];
            // Only add if not already present (deduplication at render level)
            if (!next[mainKey].some(ev => ev.id === evPayload.id)) {
              
              next[mainKey].push(evPayload);
            } else {
              
            }
            return next;
          });
          }
          
          const isAugmentProc = lastAction.effectName === 'Thorns';
          // Add effect glow animation (blue glow for 800ms) or augment proc glow
          setEventsMap(prev => {
            const next = { ...prev };
            next[mainKey] = next[mainKey] || [];
            const glowKind = isAugmentProc ? 'augment-glow' : 'effect-glow';
            if (!next[mainKey].some(ev => ev.kind === glowKind)) {
              next[mainKey].push({ kind: glowKind, effectName: lastAction.effectName });
            }
            return next;
          });
          
          // Remove glow after 800ms
          setTimeout(() => {
            setEventsMap(prev => {
              const n = { ...prev };
              if (n[mainKey]) {
                n[mainKey] = n[mainKey].filter(ev => ev.kind !== (isAugmentProc ? 'augment-glow' : 'effect-glow'));
                if (n[mainKey].length === 0) delete n[mainKey];
              }
              return n;
            });
          }, 800);
          // keep emote on-screen for a bit; non-blocking clear
          setTimeout(() => {
            setEventsMap(prev => {
              const n = { ...prev };
              if (n[mainKey]) {
                n[mainKey] = n[mainKey].filter(ev => ev.id !== evPayload.id);
                if (n[mainKey].length === 0) delete n[mainKey];
              }
              return n;
            });
          }, 2400);
          // small spacing so subsequent emotes/animations don't overlap
          await sleep(500);
        }
      }
    } else if (lastAction.type === 'energyIncrement') {
      if (lastAction.target && lastAction.target.boardName) {
        const tside = boardNameToSide(lastAction.target.boardName);
        const mainKey = `${tside}:${lastAction.target.index}`;
        if (shouldSkipEnergyEmote(tside, lastAction.target.index, lastAction.amount)) {
          return;
        }
        setEventsMap(prev => {
          const next = { ...prev };
          // Only add if not already present (deduplication)
          next[mainKey] = next[mainKey] || [];
          if (!next[mainKey].some(ev => ev.kind === 'energy' && ev.amount === lastAction.amount)) {
            next[mainKey].push({ kind: 'energy', amount: lastAction.amount });
          }
          return next;
        });
        setTimeout(() => {
          setEventsMap(prev => {
            const n = { ...prev };
            if (n[mainKey]) {
              n[mainKey] = n[mainKey].filter(ev => ev.kind !== 'energy' || ev.amount !== lastAction.amount);
              if (n[mainKey].length === 0) delete n[mainKey];
            }
            return n;
          });
        }, 2000);
        await sleep(500);
      }
    } else if (lastAction.type === 'onRoundStartTriggered') {
      // no-op or log for now
      
    }
    // other types are intentionally non-blocking
  };

  const processQueue = async () => {
    if (processingQueueRef.current) return;
    processingQueueRef.current = true;
    while (eventQueueRef.current.length > 0) {
      const action = eventQueueRef.current.shift();
      try { await handleAnimationAction(action); } catch (e) { console.error('Error handling animation action', e); }
      if (socket && action && typeof action.seq === 'number') {
        socket.emit('stepAck', { seq: action.seq });
      }
    }
    processingQueueRef.current = false;
  };

  const enqueueAnimation = useCallback((action) => {
    eventQueueRef.current.push(action);
    processQueue();
  }, [socket]);

  // track last-seen energy per tile to avoid duplicate energy floats
  const lastSeenEnergyRef = useRef({});
  // track recent energy pulses emitted by the engine to avoid duplicate floats
  const lastEnergyPulseRef = useRef({});
  // track if the last spell had secondary animation for delaying heal pulses
  const lastSpellWithSecondaryRef = useRef(false);
  // track the last spell animation duration
  const spellAnimMsRef = useRef(500);
  // track primary frames and per-frame ms so secondary durations scale to primary
  const primaryFramesRef = useRef(0);
  const primaryFrameMsRef = useRef(600);
  // track the secondary animation duration (if any) for two-part spells
  const spellSecondAnimMsRef = useRef(0);
  // track whether the secondary animation was played immediately and when it started
  const lastSecondaryPlayedImmediatelyRef = useRef(false);
  const lastSecondaryStartRef = useRef(0);
  // track the primary dest key for the last-cast so we can identify secondary pulses
  const lastPrimaryDestRef = useRef(null);

  const getTileCenter = (token) => {
    try {
      if (!token) return null;
      // Prefer canonical board token attribute when available
      let el = document.querySelector(`[data-board-token="${token}"]`);
      // Try exact match on legacy `data-token` as fallback
      if (!el) el = document.querySelector(`[data-token="${token}"]`);
      // If not found, try common alternate encodings: replace ':' with '-' (e.g. p1:2 -> p1-2 or p1-main-2)
      if (!el && typeof token === 'string') {
        const parts = token.split(':');
        // try joining with '-'
        const dash = parts.join('-');
        el = document.querySelector(`[data-board-token="${dash}"]`) || document.querySelector(`[data-token="${dash}"]`);
        // try patterns that include the index at the end like '-main-<index>' or '-reserve-<index>'
        if (!el && parts.length >= 2) {
          const requestedSide = parts[0];
          const requestedIdx = parts[parts.length - 1];
          // Prefer candidates that match the same side and index exactly to avoid
          // matching reserve or other tokens that merely end with the same index.
          const candidates = Array.from(document.querySelectorAll('[data-board-token],[data-token]')).filter(n => {
            const v = (n.getAttribute('data-board-token') || n.getAttribute('data-token') || '');
            if (!v) return false;
            const pv = v.split(':');
            if (pv.length < 2) return false;
            if (pv[0] !== requestedSide) return false;
            return pv[pv.length - 1] === requestedIdx;
          });
          if (candidates.length) el = candidates[0];
          else {
            // Fallback to the broader heuristic if no exact-side match is found
            const idx = parts[parts.length - 1];
            const loose = Array.from(document.querySelectorAll('[data-board-token],[data-token]')).filter(n => {
              const v = (n.getAttribute('data-board-token') || n.getAttribute('data-token') || '');
              return v.endsWith(`-${idx}`) || v.endsWith(`:${idx}`) || v === token || v === dash;
            });
            if (loose.length) el = loose[0];
          }
        }
      }
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width / 2 + window.scrollX),
        y: Math.round(r.top + r.height / 2 + window.scrollY)
      };
    } catch (e) { console.warn('getTileCenter error', e); return null; }
  };

  const shouldSkipEnergyEmote = (side, index, amount) => {
    const key = `${side}:${index}:${amount}`;
    const now = Date.now();
    const last = lastEnergyPulseRef.current[key];
    if (last && (now - last) < 300) return true;
    lastEnergyPulseRef.current[key] = now;
    return false;
  };

  const runRound = async () => {
    const prioritySide = (priorityPlayer === 'player1' || priorityPlayer === 'p1') ? 'p1' : (priorityPlayer === 'player2' || priorityPlayer === 'p2') ? 'p2' : 'p3';
    if (localSide && !aiDifficulty && localSide !== prioritySide) {
      return;
    }
    setPhase('running');
    addLog && addLog('Starting round...');
    if (socket) {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const waitForSync = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          socket.off('syncBattleAck', onAck);
          resolve(false);
        }, 1500);

        const onAck = (payload) => {
          if (!payload || payload.requestId !== requestId) return;
          clearTimeout(timeout);
          socket.off('syncBattleAck', onAck);
          resolve(true);
        };

        socket.on('syncBattleAck', onAck);
      });

      socket.emit('makeMove', {
        type: 'syncBattleState',
        p1Main: p1Board,
        p2Main: p2Board,
        ...(gameMode === 'ffa3' ? { p3Main: p3Board } : {}),
        p1Reserve: p1ReserveBoard,
        p2Reserve: p2ReserveBoard,
        ...(gameMode === 'ffa3' ? { p3Reserve: p3ReserveBoard } : {}),
        priorityPlayer,
        phase: 'battle',
        requestId
      });

      await waitForSync;
      socket.emit('makeMove', { type: 'startRound', priorityPlayer });
    }
  };


  // Auto-play logic for production mode
  const prevGameStateRef = useRef(null);
  const hasStartedRef = useRef(false);
  const firstRoundTimerRef = useRef(null);
  
  // Reset hasStartedRef when a new game/battle starts (detect by checking if step is 0 and phase is battle)
  useEffect(() => {
    if (gameState?.step === 0 && gameState?.phase === 'battle' && hasStartedRef.current) {
      
      hasStartedRef.current = false;
    }
  }, [gameState?.step, gameState?.phase]);
  
  // Trigger first round on mount
  useEffect(() => {
    if (!autoPlay || hasStartedRef.current) return;
    
    hasStartedRef.current = true;
    const timer = setTimeout(() => {
      runRound();
    }, 1500);
    
    return () => {
      // Don't cancel if we've committed to starting
      if (firstRoundTimerRef.current && !hasStartedRef.current) {
        clearTimeout(firstRoundTimerRef.current);
        firstRoundTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);
  
  // Handle state transitions after first round
  const prevPhaseRef = useRef(null);
  const movementCompleteRef = useRef(false);
  const aiMoveInProgressRef = useRef(null); // Track which index the AI is currently processing
  const movementRef = useRef(null); // Ref to access movement without triggering effect re-runs
  movementRef.current = movement;
  
  useEffect(() => {
    if (!autoPlay) return;
    const prev = prevPhaseRef.current;
    const current = phase;
    prevPhaseRef.current = current;
    if (prev == null) return;

    // When entering movement phase, mark as incomplete
    if (current === 'movement') {
      movementCompleteRef.current = false;
    }

    // When leaving movement phase for ready, mark as complete
    if (prev === 'movement' && current === 'ready') {
      movementCompleteRef.current = true;
    }

    // Only start next round if we've been in ready phase AND movement was completed
    if (current === 'ready' && movementCompleteRef.current) {
      // Extra delay to ensure all movement visuals are done
      const timer = setTimeout(() => {
        runRound();
      }, 2500); // Longer delay to ensure movement animations complete
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, phase]);

  // AI Movement automation using AI module
  useEffect(() => {
    const phaseState = movement?.movementPhase;
    const phaseIndex = phaseState?.index;
    
    // Only log when we have a real phase to avoid console spam
    if (phaseState) {
      
    }
    
    if (!aiDifficulty) return;
    if (phase !== 'movement') return;
    if (!phaseState) return;

    const currentMover = phaseState.sequence[phaseIndex];
    
    
    // Only automate P2's moves
    if (currentMover !== 'p2') return;
    
    // Guard: prevent multiple AI moves for the same turn index
    // Use a unique key combining phase index and sequence length
    const moveKey = `${phaseIndex}-${phaseState.sequence.length}`;
    if (aiMoveInProgressRef.current === moveKey) {
      
      return;
    }
    aiMoveInProgressRef.current = moveKey;
    
    const ai = getAI(aiDifficulty);
    const delay = ai.getThinkingDelay();
    
    
    
    // Wait a bit then make a move using AI
    const timer = setTimeout(async () => {
      // Double-check we're still on P2's turn and same index
      const currentMovement = movementRef.current;
      const currentPhase = currentMovement?.movementPhase;
      if (!currentPhase || currentPhase.index !== phaseIndex) {
        
        aiMoveInProgressRef.current = null;
        return;
      }
      
      
      // Pass p1 boards for Easy AI and above to evaluate positioning
      const decision = await ai.makeMovementDecision(p2Board, p2ReserveBoard, currentMovement, p1Board, p1ReserveBoard);
      
      if (!decision) {
      
        // AI chose not to move - advance to next turn by making a no-op swap (swap tile with itself)
        // Find any P2 hero and swap with itself to advance the phase
        let anyP2TileId = null;
        for (let i = 0; i < p2Board.length; i++) {
          if (p2Board[i]?.hero) {
            anyP2TileId = `p2:${i}`;
            break;
          }
        }
        if (!anyP2TileId) {
          for (let i = 0; i < p2ReserveBoard.length; i++) {
            if (p2ReserveBoard[i]?.hero) {
              anyP2TileId = `p2Reserve:${i}`;
              break;
            }
          }
        }
        if (anyP2TileId && currentMovement?.handleSwapById) {
          currentMovement.handleSwapById(anyP2TileId, anyP2TileId);
        }
        return;
      }
      
      
      if (currentMovement?.handleSwapById) {
        currentMovement.handleSwapById(decision.sourceId, decision.destinationId);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      // Only clear the ref if we're cleaning up for this specific move
      if (aiMoveInProgressRef.current === moveKey) {
        aiMoveInProgressRef.current = null;
      }
    };
  }, [aiDifficulty, phase, movement?.movementPhase?.index, movement?.movementPhase?.sequence, p2Board, p2ReserveBoard, p1Board, p1ReserveBoard]);

  // spell queuing removed (auto-cast handled by engine)

  const startMovement = () => {
    const prioritySide = (priorityPlayer === 'player1' || priorityPlayer === 'p1') ? 'p1' : (priorityPlayer === 'player2' || priorityPlayer === 'p2') ? 'p2' : 'p3';
    if (localSide && localSide !== prioritySide) return;
    if (movement && movement.startMovementPhase) movement.startMovementPhase();
  };

  const hasAliveOnMain = (boardArr) => (boardArr || []).some(t => t && t.hero && !t._dead);
  const p1Eliminated = gameMode === 'ffa3' && !hasAliveOnMain(p1Board);
  const p2Eliminated = gameMode === 'ffa3' && !hasAliveOnMain(p2Board);
  const p3Eliminated = gameMode === 'ffa3' && !hasAliveOnMain(p3Board);
  const prioritySide = (priorityPlayer === 'player1' || priorityPlayer === 'p1') ? 'p1' : (priorityPlayer === 'player2' || priorityPlayer === 'p2') ? 'p2' : 'p3';
  const movementSide = movement?.movementPhase?.sequence?.[movement?.movementPhase?.index];
  const arrowSide = (phase === 'movement' && movementSide) ? movementSide : prioritySide;
  const canControlRound = !localSide || localSide === prioritySide;
  const hideBattleControls = !!localSide && !aiDifficulty;

  return (
    <div className="battle-phase">
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <BoardGrid label="P1 Reserve" tiles={p1ReserveBoard} movement={movement} player="p1" isReserve={true} isEliminated={p1Eliminated} eventsMap={eventsMap} effectPrecastMap={effectPrecastMap} onHoverTile={handleHoverTile} onUnhoverTile={handleUnhoverTile} onEffectHover={handleEffectHover} onEffectOut={handleEffectOut} />
            {!autoPlay && !hideBattleControls && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: 8 }}>
                <button onClick={() => runRound()} disabled={!canControlRound || gameState === 'running'}>Run Round</button>
              </div>
            )}
          </div>

          <BoardGrid label={matchPlayers?.p1 || 'Player 1'} tiles={p1Board} movement={movement} player="p1" isEliminated={p1Eliminated} eventsMap={eventsMap} effectPrecastMap={effectPrecastMap} onHoverTile={handleHoverTile} onUnhoverTile={handleUnhoverTile} onEffectHover={handleEffectHover} onEffectOut={handleEffectOut} />
        </div>

        <div style={{ width: 48, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <PriorityArrow direction={arrowSide === 'p1' ? 'left' : (arrowSide === 'p2' ? 'right' : 'down')} />
          {/* Dice Roll Animation Overlay */}
          {diceRoll && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              background: 'linear-gradient(135deg, #2d1b4e 0%, #1a0f2e 100%)',
              border: '3px solid #9b59b6',
              borderRadius: 12,
              padding: '16px 24px',
              boxShadow: '0 8px 32px rgba(155, 89, 182, 0.5), inset 0 2px 4px rgba(255,255,255,0.1)',
              minWidth: 120,
              textAlign: 'center',
              animation: 'diceRollIn 0.3s ease-out'
            }}>
              <style>{`
                @keyframes diceRollIn {
                  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                  50% { transform: translate(-50%, -50%) scale(1.1); }
                  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
                @keyframes diceRoll {
                  0%, 100% { transform: rotate(0deg); }
                  25% { transform: rotate(15deg); }
                  75% { transform: rotate(-15deg); }
                }
                @keyframes diceGlow {
                  0%, 100% { box-shadow: 0 0 10px #f39c12; }
                  50% { box-shadow: 0 0 25px #f39c12, 0 0 40px #f1c40f; }
                }
              `}</style>
              <div style={{ fontSize: 11, color: '#b39ddb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Rolling d{diceRoll.die}
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                background: 'linear-gradient(145deg, #fff, #f0f0f0)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5)',
                fontSize: 28,
                fontWeight: 700,
                color: '#2c3e50',
                animation: 'diceRoll 0.5s ease-in-out, diceGlow 0.8s ease-in-out infinite',
                marginBottom: 8
              }}>
                {diceRoll.roll}
              </div>
              <div style={{ fontSize: 14, color: '#e8e8e8', marginTop: 4 }}>
                <span style={{ color: '#aaa' }}>{diceRoll.base} + </span>
                <span style={{ color: '#f39c12', fontWeight: 700 }}>{diceRoll.roll}</span>
                <span style={{ color: '#aaa' }}> = </span>
                <span style={{ color: '#2ecc71', fontWeight: 700, fontSize: 18 }}>{diceRoll.total}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <BoardGrid label={matchPlayers?.p2 || 'Player 2'} tiles={p2Board} movement={movement} player="p2" isEliminated={p2Eliminated} eventsMap={eventsMap} effectPrecastMap={effectPrecastMap} onHoverTile={handleHoverTile} onUnhoverTile={handleUnhoverTile} onEffectHover={handleEffectHover} onEffectOut={handleEffectOut} />
          <BoardGrid label="P2 Reserve" tiles={p2ReserveBoard} movement={movement} player="p2" isReserve={true} isEliminated={p2Eliminated} eventsMap={eventsMap} effectPrecastMap={effectPrecastMap} onHoverTile={handleHoverTile} onUnhoverTile={handleUnhoverTile} onEffectHover={handleEffectHover} onEffectOut={handleEffectOut} />
        </div>
      </div>

      {/* Movement Phase UI */}
      {phase === 'movement' && movement && movement.UI && !gameOver && <movement.UI />}

      <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
        <div style={{
          width: 760,
          minHeight: 'calc(100px * var(--ui-scale, 1))',
          background: '#1a1a2e',
          border: '1px solid #3a3a5a',
          padding: 'calc(6px * var(--ui-scale, 1))',
          borderRadius: 'var(--tile-border-radius, 6px)',
          fontSize: 'calc(11px * var(--ui-scale, 1))',
          lineHeight: 1.2,
          color: '#e0e0e0'
        }}>
          {hoverInfo ? (
            hoverInfo.type === 'tile' && hoverInfo.tile && hoverInfo.tile.hero ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 'calc(12px * var(--ui-scale, 1))', marginBottom: 2 }}>{hoverInfo.tile.hero.name}</div>
                {hoverInfo.tile.hero?.isBoss && (
                  <div style={{ marginTop: 2, fontSize: 'calc(10px * var(--ui-scale, 1))', color: '#b0b0c8' }}>
                    {(() => {
                      const h = hoverInfo.tile.hero;
                      const sp = (h && typeof h.currentSpellPower === 'number') ? h.currentSpellPower : (typeof h?.spellPower === 'number' ? h.spellPower : 0);
                      return `Spell Power: ${sp}`;
                    })()}
                  </div>
                )}
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 600 }}>{(() => { const s = hoverInfo.tile.hero?.spells?.front; const sd = s ? getSpellById(s.id) : null; return s ? `Front - ${sd?.name || s.id} [${s.cost || '?'}]: ` : 'Front: '; })()}</span>
                  <span>{(() => { const s = hoverInfo.tile.hero?.spells?.front; const sd = s ? getSpellById(s.id) : null; return sd && (sd.description || (sd.spec && sd.spec.description)) ? (sd.description || (sd.spec && sd.spec.description)) : '—'; })()}</span>
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 600 }}>{(() => { const s = hoverInfo.tile.hero?.spells?.middle; const sd = s ? getSpellById(s.id) : null; return s ? `Middle - ${sd?.name || s.id} [${s.cost || '?'}]: ` : 'Middle: '; })()}</span>
                  <span>{(() => { const s = hoverInfo.tile.hero?.spells?.middle; const sd = s ? getSpellById(s.id) : null; return sd && (sd.description || (sd.spec && sd.spec.description)) ? (sd.description || (sd.spec && sd.spec.description)) : '—'; })()}</span>
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: 600 }}>{(() => { const s = hoverInfo.tile.hero?.spells?.back; const sd = s ? getSpellById(s.id) : null; return s ? `Back - ${sd?.name || s.id} [${s.cost || '?'}]: ` : 'Back: '; })()}</span>
                  <span>{(() => { const s = hoverInfo.tile.hero?.spells?.back; const sd = s ? getSpellById(s.id) : null; return sd && (sd.description || (sd.spec && sd.spec.description)) ? (sd.description || (sd.spec && sd.spec.description)) : '—'; })()}</span>
                </div>
                {/* Tower Augments (if present) */}
                {(() => {
                  const towerAugments = hoverInfo.tile.hero?._towerAugments || [];
                  if (!Array.isArray(towerAugments) || towerAugments.length === 0) return null;
                  return (
                    <div style={{ marginTop: 2 }}>
                      <div style={{ fontWeight: 600 }}>Augments:</div>
                      <div style={{ marginLeft: 6 }}>
                        {towerAugments.map((aug, ai) => (
                          <div key={`aug-${ai}`}>
                            <span style={{ fontWeight: 700 }}>{aug?.name || 'Augment'}:</span> {aug?.description || '—'}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Passive (if present) */}
                {(() => {
                  const passives = hoverInfo.tile.hero?.passives || [];
                  const posMods = hoverInfo.tile.hero?.positionalModifiers;
                  if ((!passives || !passives.length) && !posMods) return null;
                  const renderPositional = () => {
                    if (!posMods) return null;
                    const rows = Object.keys(posMods || {});
                    const parts = [];
                    rows.forEach((r) => {
                      const mods = posMods[r];
                      if (!mods) return;
                      Object.keys(mods).forEach((stat) => {
                        const val = mods[stat];
                        const statLabel = stat === 'armor' ? 'Armor' : (stat === 'speed' ? 'Speed' : stat.charAt(0).toUpperCase() + stat.slice(1));
                        parts.push(`${r} ${val >= 0 ? '+' + val : val} ${statLabel}`);
                      });
                    });
                    if (!parts.length) return null;
                    return <div key="positional"><span style={{ fontWeight: 700 }}>Shapeshift:</span> {parts.join(', ')}</div>;
                  };

                  return (
                    <div style={{ marginTop: 2 }}>
                      <div style={{ fontWeight: 600 }}>Passive:</div>
                      <div style={{ marginLeft: 6 }}>
                        {renderPositional()}
                        {passives.map((p, pi) => {
                          let eff = null;
                          if (!p) return null;
                          if (typeof p === 'string') eff = getEffectByName(p);
                          else if (p && p.name) eff = p;
                          else if (p && p.effect) eff = getEffectByName(p.effect);
                          const pname = (eff && eff.name) || (p && p.name) || String(p);
                          const pdesc = (eff && eff.description) || (p && p.description) || '';
                          return <div key={`pass-${pi}`}><span style={{ fontWeight: 700 }}>{pname}:</span> {pdesc}</div>;
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : hoverInfo.type === 'effect' && hoverInfo.effect ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 'calc(12px * var(--ui-scale, 1))', marginBottom: 2 }}>{hoverInfo.effect.name || 'Effect'}</div>
                <div style={{ marginTop: 2 }}>{hoverInfo.effect && hoverInfo.effect.description ? hoverInfo.effect.description : (hoverInfo.effect && hoverInfo.effect.name) || '—'}</div>
              </div>
            ) : (<div style={{ fontSize: 13 }}>No data</div>)
          ) : (
            <div style={{ color: '#888' }}>Hover over a hero or an effect to see details.</div>
          )}

          {/* log moved outside the hover panel to render below the box */}
        </div>
      </div>

      {gameMode === 'ffa3' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <BoardGrid label={matchPlayers?.p3 || 'Player 3'} tiles={p3Board} movement={movement} player="p3" isEliminated={p3Eliminated} eventsMap={eventsMap} effectPrecastMap={effectPrecastMap} onHoverTile={handleHoverTile} onUnhoverTile={handleUnhoverTile} onEffectHover={handleEffectHover} onEffectOut={handleEffectOut} />
            <BoardGrid label="P3 Reserve" tiles={p3ReserveBoard} movement={movement} player="p3" isReserve={true} isEliminated={p3Eliminated} eventsMap={eventsMap} effectPrecastMap={effectPrecastMap} onHoverTile={handleHoverTile} onUnhoverTile={handleUnhoverTile} onEffectHover={handleEffectHover} onEffectOut={handleEffectOut} />
          </div>
        </div>
      )}
      {gameOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 7, 10, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5000,
            opacity: victoryOverlayVisible ? 1 : 0,
            transition: 'opacity 1400ms ease',
            pointerEvents: victoryOverlayVisible ? 'auto' : 'none'
          }}
        >
          <div
            style={{
              textAlign: 'center',
              color: '#f8fafc',
              padding: '24px 32px',
              borderRadius: 16,
              background: 'linear-gradient(145deg, rgba(30, 18, 48, 0.9), rgba(10, 8, 20, 0.9))',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              minWidth: 320
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }}>
              {gameOver === 'draw'
                ? 'Battle ends in a draw.'
                : `${gameOver === 'player1' ? (matchPlayers?.p1 || 'Player 1') : (gameOver === 'player2' ? (matchPlayers?.p2 || 'Player 2') : (matchPlayers?.p3 || 'Player 3'))} is Victorious.`}
            </div>
            <div style={{ fontSize: 14, color: '#cbd5f5', marginBottom: showReturnToMenu && onGameEnd ? 18 : 0 }}>
              {gameOver === 'draw' ? 'No champion stands above the rest.' : 'The clash is settled.'}
            </div>
            {showReturnToMenu && onGameEnd && (
              <button
                onClick={() => onGameEnd(gameOver)}
                style={{
                  padding: '10px 18px',
                  fontSize: 14,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6
                }}
              >
                Back to Menu
              </button>
            )}
          </div>
        </div>
      )}
      {!autoPlay && !hideBattleControls && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
          <div style={{ width: 760 }}>
            {phase === 'ready' && (
              <div style={{ marginBottom: 12 }}>
                <button onClick={runRound} disabled={!canControlRound} style={{ padding: '8px 16px', fontSize: 14, marginRight: 8 }}>Start Round</button>
                <button onClick={startMovement} disabled={!canControlRound} style={{ padding: '8px 16px', fontSize: 14 }}>Start Movement</button>
              </div>
            )}
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Log</div>
            <div style={{ maxHeight: 160, overflow: 'auto', background: '#111', color: '#fff', padding: 8, borderRadius: 6, fontSize: 13 }}>
              {log.map((l, i) => <div key={`log-${i}`}>{l}</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

