import React, { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { HEROES } from './heroes.js';
import { indexToRow } from './targeting';
import { getAI } from './ai';
import { initializeNeuralAI } from './ai/neuralAI.js';
import getAssetPath from './utils/assetPath';
import { getSpellById } from './spells.js';
import { getEffectByName } from './effects.js';

/* --- SVG Icons --- */
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

/* Front row icon (sword) */
function SwordIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 2 }}>
      <rect x="6" y="0" width="2" height="10" fill="#e8a87c" />
      <polygon points="4,10 10,10 7,13" fill="#c0a080" />
      <rect x="5" y="10" width="4" height="1" fill="#8b7355" />
    </svg>
  );
}

/* Middle row icon (staff) */
function StaffIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 2 }}>
      <rect x="6" y="0" width="2" height="12" fill="#a78bfa" />
      <circle cx="7" cy="2" r="2.5" fill="#ddd6fe" />
      <circle cx="7" cy="13" r="1" fill="#8b5cf6" />
    </svg>
  );
}

/* Back row icon (book) */
function BookIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 14 14" style={{ display: 'inline', marginRight: 2 }}>
      <path d="M2 1H7V12H2Z" fill="#f59e0b" />
      <path d="M7 1H12V12H7Z" fill="#f97316" />
      <line x1="7" y1="1" x2="7" y2="12" stroke="#d97706" strokeWidth="0.5" />
    </svg>
  );
}

/* --- Mini Tile for Draft Pool --- */
function MiniTile({ tile }) {
  const occupied = !!tile.hero;

  const miniScale = 0.65; // Further reduced to ensure hero tiles fit in exactly 2 rows
  const miniTileSize = `calc(120px * var(--ui-scale) * ${miniScale})`; // Now 66px at default scale

  return (
    <div
      className="db-mini-tile"
      style={{
        width: miniTileSize,
        height: miniTileSize,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        borderRadius: `calc(6px * var(--ui-scale) * ${miniScale})`,
        padding: `calc(2px * var(--ui-scale) * ${miniScale})`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        background: occupied ? 'transparent' : '#2b2b2b',
        border: occupied ? '1px solid #90a4ae' : '1px dashed #616161',
        color: occupied ? '#111111' : '#9e9e9e',
      }}
    >
      {tile.hero ? (
        <>
          {/* hero background image */}
          {tile.hero.image ? (
            <img
              src={getAssetPath(tile.hero.image)}
              alt={tile.hero.name}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: `calc(6px * var(--ui-scale) * ${miniScale})`,
                zIndex: 0,
                opacity: 1,
              }}
            />
          ) : null}

          {/* Mini stats - compact 2x2 grid */}
          <div style={{
            zIndex: 2,
            position: 'absolute',
            top: `calc(2px * var(--ui-scale) * ${miniScale})`,
            left: `calc(3px * var(--ui-scale) * ${miniScale})`,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: `calc(1px * var(--ui-scale) * ${miniScale})`,
            fontSize: `calc(1.0rem * var(--ui-scale) * ${miniScale})`,
            lineHeight: 1,
            color: '#ffffff',
            textShadow: '0 1px 0 rgba(0,0,0,0.95), 0 3px 6px rgba(0,0,0,0.65)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: `calc(1px * var(--ui-scale) * ${miniScale})` }}>
              <div style={{ transform: `scale(${miniScale})`, transformOrigin: 'left center' }}><HeartIcon /></div>
              <span>{tile.hero.currentHealth || tile.hero.health}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: `calc(1px * var(--ui-scale) * ${miniScale})` }}>
              <div style={{ transform: `scale(${miniScale})`, transformOrigin: 'left center' }}><ShieldIcon /></div>
              <span>{tile.hero.currentArmor != null ? tile.hero.currentArmor : tile.hero.armor}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: `calc(1px * var(--ui-scale) * ${miniScale})` }}>
              <div style={{ transform: `scale(${miniScale})`, transformOrigin: 'left center' }}><ShoeIcon /></div>
              <span>{tile.hero.currentSpeed != null ? tile.hero.currentSpeed : tile.hero.speed}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: `calc(1px * var(--ui-scale) * ${miniScale})` }}>
              <div style={{ transform: `scale(${miniScale})`, transformOrigin: 'left center' }}><LightningIcon /></div>
              <span>{tile.hero.currentEnergy != null ? tile.hero.currentEnergy : tile.hero.energy}</span>
            </div>
          </div>

          {/* Mini spell counters - compact column on right */}
          <div style={{
            zIndex: 2,
            position: 'absolute',
            top: `calc(2px * var(--ui-scale) * ${miniScale})`,
            right: `calc(2px * var(--ui-scale) * ${miniScale})`,
            display: 'flex',
            flexDirection: 'column',
            gap: `calc(1px * var(--ui-scale) * ${miniScale})`,
            fontSize: `calc(1.0rem * var(--ui-scale) * ${miniScale})`,
            lineHeight: 1,
            color: '#ffffff',
            textShadow: '0 1px 0 rgba(0,0,0,0.95), 0 3px 6px rgba(0,0,0,0.65)',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: `calc(1px * var(--ui-scale) * ${miniScale})` }}>
              <div style={{ transform: `scale(${miniScale})`, transformOrigin: 'center' }}><SwordIcon /></div>
              <span>{tile.hero.spells?.front?.casts || 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: `calc(1px * var(--ui-scale) * ${miniScale})` }}>
              <div style={{ transform: `scale(${miniScale})`, transformOrigin: 'center' }}><StaffIcon /></div>
              <span>{tile.hero.spells?.middle?.casts || 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: `calc(1px * var(--ui-scale) * ${miniScale})` }}>
              <div style={{ transform: `scale(${miniScale})`, transformOrigin: 'center' }}><BookIcon /></div>
              <span>{tile.hero.spells?.back?.casts || 0}</span>
            </div>
          </div>

          {/* Mini hero name - styled like full tiles */}
          <div style={{
            zIndex: 2,
            position: 'absolute',
            bottom: `calc(2px * var(--ui-scale) * ${miniScale})`,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: `calc(0.8rem * var(--ui-scale) * ${miniScale})`,
            fontWeight: 700,
            color: '#ffffff',
            textShadow: '0 1px 0 rgba(0,0,0,0.95), 0 3px 6px rgba(0,0,0,0.65)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '85%',
            textAlign: 'center',
          }}>
            {tile.hero.name}
          </div>
        </>
      ) : (
        <div style={{
          fontSize: `calc(0.7rem * var(--ui-scale) * ${miniScale})`,
          color: '#9e9e9e'
        }}>
          Empty
        </div>
      )}
    </div>
  );
}

/* --- Draggable Hero --- */
function HeroCard({ hero, onHover, onUnhover }) {
  const [{ isDragging }, drag] = useDrag({
    type: 'HERO',
    item: { hero },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  });

  // Create a mock tile object for rendering
  const mockTile = {
    hero: {
      ...hero,
      currentHealth: hero.health,
      currentEnergy: hero.energy,
      currentSpeed: hero.speed,
      currentArmor: hero.armor,
      currentSpellPower: hero.spellPower || 0,
    },
    id: `draft-${hero.id}`,
    player: 'draft',
    index: 0,
    type: 'draft'
  };

  return (
    <div
      ref={drag}
      style={{ opacity: isDragging ? 0.6 : 1, cursor: 'pointer' }}
      onMouseEnter={() => onHover && onHover(hero)}
      onMouseLeave={() => onUnhover && onUnhover()}
    >
      <MiniTile tile={mockTile} />
    </div>
  );
}

/* --- Effects Column (4 effect slots) --- */
function EffectsColumn({ tileId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`${tileId}-effect-${i}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            background: '#1a1a1a',
            border: '1px solid #3a3a3a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem',
            color: '#666',
          }}
        >
          —
        </div>
      ))}
    </div>
  );
}

/* --- Droppable Tile --- */
function Tile({ tile, onHeroDrop, disabled, highlightFor, onHover, onUnhover }) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'HERO',
    drop: (item) => onHeroDrop(item.hero, tile.player, tile.index, tile.type),
    canDrop: () => !disabled,
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  });

  const occupied = !!tile.hero;

  // highlight color per active player
  const highlightColor =
    highlightFor === 'player1' ? '#4fc3f7' : highlightFor === 'player2' ? '#ffb74d' : null;

  // base tile sizing (responsive via CSS variables)
  const baseStyle = {
    width: 'var(--tile-size, 120px)',
    height: 'var(--tile-size, 120px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 'var(--tile-border-radius, 8px)',
    padding: 'calc(2px * var(--ui-scale, 1))',
    boxSizing: 'border-box',
    overflow: 'hidden',
    position: 'relative',
  };

  // visual states for can-drop / over
  const highlightStyle = (() => {
    if (!highlightColor) return {};
    if (isOver && canDrop) {
      return {
        boxShadow: `0 0 6px 3px ${highlightColor}33, 0 0 12px ${highlightColor}`,
        border: `2px solid ${highlightColor}`,
      };
    }
    if (!isOver && canDrop) {
      return {
        border: `2px dashed ${highlightColor}`,
      };
    }
    return {};
  })();

  const stateClass =
    isOver && canDrop ? 'db-tile-highlight-over' : '';

  const disabledClass = disabled ? 'db-tile-disabled' : '';

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
      {/* Main tile */}
      <div
        ref={drop}
        className={`db-tile ${occupied ? 'db-tile-occupied' : 'db-tile-empty'} ${stateClass} ${disabledClass}`}
        title={occupied ? tile.hero.name : 'Empty'}
        style={{ ...baseStyle, ...highlightStyle, cursor: occupied ? 'pointer' : 'default' }}
        onMouseEnter={() => occupied && onHover && onHover(tile)}
        onMouseLeave={() => onUnhover && onUnhover()}
      >
        {tile.hero ? (
          <>
            {/* hero background image (full tile, behind overlays) */}
            {tile.hero && tile.hero.image ? (
              <img
                src={getAssetPath(tile.hero.image)}
                alt={tile.hero.name}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 8,
                  zIndex: 0,
                  opacity: 1,
                }}
              />
            ) : null}
            <div className="db-tile-stats" style={{ zIndex: 2 }}>
              <div className="db-stat">
                <HeartIcon /> {tile.currentHealth != null ? tile.currentHealth : (tile.hero && tile.hero.health != null ? tile.hero.health : '')}
              </div>
              <div className="db-stat">
                <ShieldIcon /> {typeof tile.currentArmor === 'number' ? tile.currentArmor : (tile.hero && typeof tile.hero.armor === 'number' ? tile.hero.armor : '')}
              </div>
              <div className="db-stat">
                <ShoeIcon /> {typeof tile.currentSpeed === 'number' ? tile.currentSpeed : (tile.hero && typeof tile.hero.speed === 'number' ? tile.hero.speed : '')}
              </div>
              <div className="db-stat">
                <LightningIcon /> {typeof tile.currentEnergy === 'number' ? tile.currentEnergy : (tile.hero && typeof tile.hero.energy === 'number' ? tile.hero.energy : 0)}
              </div>
            </div>

            {/* Left side: Spell counters spaced evenly vertically */}
            <div className="db-spell-counters" style={{ zIndex: 2 }}>
              <div className="db-spell-item">
                <SwordIcon /> {tile.hero.spells.front.casts}
              </div>
              <div className="db-spell-item">
                <StaffIcon /> {tile.hero.spells.middle.casts}
              </div>
              <div className="db-spell-item">
                <BookIcon /> {tile.hero.spells.back.casts}
              </div>
            </div>

            {/* Bottom center: Hero name */}
            <div className="db-tile-name" style={{ zIndex: 2 }}>
              {tile.hero.name}
            </div>
          </>
        ) : (
          <div className="db-tile-empty-text">Empty</div>
        )}
      </div>

      {/* Effects column */}
      <EffectsColumn tileId={tile.id} />
    </div>
  );
}

/* --- Ban pile drop area --- */
function BanPile({ bans, onBanDrop, active, player }) {
  const [, drop] = useDrop({
    accept: 'HERO',
    drop: (item) => onBanDrop(item.hero),
    canDrop: () => active,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      <div style={{ 
        marginBottom: 'var(--gap-medium, 6px)', 
        fontWeight: 700, 
        color: '#ffd54f', 
        fontSize: 'var(--font-lg, 0.95rem)' 
      }}>
        Ban Pile
      </div>

      <div
        ref={drop}
        className="db-ban-pile"
        style={{
          flex: 1,
          minWidth: 'calc(160px * var(--ui-scale, 1))',
          borderRadius: 'var(--tile-border-radius, 8px)',
          padding: 'var(--padding-medium, 8px)',
          background: active ? 'linear-gradient(180deg,#3e2723,#5d4037)' : '#2b2b2b',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--gap-small, 4px)',
        }}
        title={active ? `Drag a hero here to BAN (player: ${player})` : 'Ban pile (disabled)'}
      >
        {bans.length === 0 ? (
          <div style={{ color: '#bdbdbd', textAlign: 'center', fontSize: 'var(--font-md, 0.85rem)' }}>No bans</div>
        ) : (
          bans.map((h, i) => (
            <div
              key={`${h.name}-${i}`}
              style={{
                color: '#fff',
                padding: 'var(--padding-small, 4px)',
                fontWeight: 600,
                fontSize: 'var(--font-md, 0.9rem)',
                background: '#3e3e3e',
                borderRadius: 'var(--gap-small, 4px)',
              }}
            >
              {h.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* --- Helpers & data --- */
function makeEmptyMain(playerId) {
  return Array.from({ length: 9 }).map((_, i) => ({
    id: `${playerId}-main-${i}`,
    player: playerId,
    index: i,
    hero: null,
    type: 'main',
  }));
}
function makeReserve(playerId) {
  return Array.from({ length: 2 }).map((_, i) => ({
    id: `${playerId}-reserve-${i}`,
    player: playerId,
    index: i,
    hero: null,
    type: 'reserve',
  }));
}

/* Draft action builder: extended to 14 picks (7 per player), each preceded by opponent ban */
function buildActionQueue() {
  const picks = [
    'player1','player2','player2','player1','player1','player2','player2',
    'player1','player1','player2','player2','player1','player1','player2'
  ];
  const actions = [];
  for (const p of picks) {
    const opponent = p === 'player1' ? 'player2' : 'player1';
    actions.push({ type: 'ban', player: opponent });
    actions.push({ type: 'pick', player: p });
  }
  return actions;
}

/* Simple sampler for initial pool */
function sampleHeroes(source, n) {
  const arr = Array.isArray(source) ? [...source] : [];
  const k = Math.max(0, Math.min(n, arr.length));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}

/* --- Main component --- */
export default function DraftBoard({ aiDifficulty = null, socket, gameState, localSide = null, matchPlayers = null }) {
  // Use gameState from server, with defaults if not set
  const p1Main = gameState?.p1Main || makeEmptyMain('player1');
  const p1Reserve = gameState?.p1Reserve || makeReserve('player1');
  const p2Main = gameState?.p2Main || makeEmptyMain('player2');
  const p2Reserve = gameState?.p2Reserve || makeReserve('player2');
  const availableHeroes = gameState?.availableHeroes || sampleHeroes(HEROES, 30);
  const bans = gameState?.bans || [];
  const step = gameState?.step || 0;
  const inBattle = gameState?.inBattle || false;
  const localPlayerId = localSide === 'p1' ? 'player1' : (localSide === 'p2' ? 'player2' : (aiDifficulty ? 'player1' : null));

  // Track the step that AI has already acted on to prevent double actions
  const aiActedStepRef = useRef(-1);
  
  // Hover info state for showing spell details
  const [hoverInfo, setHoverInfo] = useState(null);
  const handleTileHover = useCallback((tile) => {
    if (tile && tile.hero) setHoverInfo({ tile, hero: tile.hero });
  }, []);
  const handleHeroHover = useCallback((hero) => {
    if (hero) setHoverInfo({ hero });
  }, []);
  const handleTileUnhover = useCallback(() => setHoverInfo(null), []);
  
  // Ref to measure the boards container width for hero pool anchoring
  const boardsContainerRef = useRef(null);
  const [boardsWidth, setBoardsWidth] = useState(0);
  
  // Measure boards container width on mount and resize
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (boardsContainerRef.current) {
        setBoardsWidth(boardsContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const actions = useMemo(buildActionQueue, []);
  const currentAction = actions[step] || null;
  const countPicks = (main, reserve) => main.filter(t => t.hero).length + reserve.filter(t => t.hero).length;
  const finished = countPicks(p1Main, p1Reserve) >= 7 && countPicks(p2Main, p2Reserve) >= 7;

  const advance = () => {
    if (socket) {
      socket.emit('makeMove', { type: 'advanceDraft' });
    }
  };

  // AI auto-play using AI module
  useEffect(() => {
    if (!aiDifficulty || !currentAction) return;
    if (currentAction.player !== 'player2') return; // Only automate P2
    // Prevent double actions on the same step
    if (aiActedStepRef.current >= step) return;

    const ai = getAI(aiDifficulty);
    const delay = ai.getThinkingDelay();

    const timer = setTimeout(async () => {
      // Double-check we haven't already acted on this step (in case of race condition)
      if (aiActedStepRef.current >= step) return;
      aiActedStepRef.current = step;

      // Ensure neural AI is initialized if using medium difficulty
      if (aiDifficulty === 'medium') {
        await initializeNeuralAI();
      }
      
      if (currentAction.type === 'ban') {
        // AI makes ban decision
        const decision = await ai.makeBanDecision(availableHeroes);
        if (decision) {
          handleBanDrop(decision);
        }
      } else if (currentAction.type === 'pick') {
        // AI makes pick decision
        if (availableHeroes.length === 0) return;
        
        // For Easy AI and above, use strategic pick; for Super Easy, use random
        let decision;
        
        if (aiDifficulty === 'super-easy') {
          // Super easy: random pick
          const mainCount = p2Main.filter(t => t.hero).length;
          const reserveCount = p2Reserve.filter(t => t.hero).length;
          
          const validMainSlots = mainCount < 5 
            ? p2Main.map((t, i) => ({ index: i, type: 'main', hero: t.hero })).filter(s => !s.hero)
            : [];
          const validReserveSlots = reserveCount < 2
            ? p2Reserve.map((t, i) => ({ index: i, type: 'reserve', hero: t.hero })).filter(s => !s.hero)
            : [];
          
          const allValidSlots = [...validMainSlots, ...validReserveSlots];
          
          if (allValidSlots.length === 0) return;
          
          const randomHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];
          const randomSlot = allValidSlots[Math.floor(Math.random() * allValidSlots.length)];
          
          decision = {
            hero: randomHero,
            slotIndex: randomSlot.index,
            slotType: randomSlot.type
          };
        } else {
          // Easy and above: use AI module's strategic decision
          const boardState = {
            p2Main,
            p2Reserve,
            p1Main,
            p1Reserve
          };
          decision = await ai.makePickDecision(availableHeroes, boardState);
        }
        
        if (decision) {
          console.log(`[AI Draft] Picking ${decision.hero.name} to ${decision.slotType}[${decision.slotIndex}]`);
          handleHeroDropToTile(decision.hero, 'player2', decision.slotIndex, decision.slotType);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [aiDifficulty, currentAction, step]);

  const handleBanDrop = (hero) => {
    console.log('handleBanDrop called', { hero, currentAction });
    if (!currentAction || currentAction.type !== 'ban') return;
    // Block human player from making opponent's moves, but allow AI moves
    if (localPlayerId && currentAction.player !== localPlayerId && currentAction.player !== 'player2') return;
    if (socket) {
      socket.emit('makeMove', { type: 'banHero', hero });
    }
  };

  const handleHeroDropToTile = (hero, tilePlayer, tileIndex, tileType) => {
    console.log('handleHeroDropToTile called', { hero, tilePlayer, tileIndex, tileType, currentAction });
    if (!currentAction || currentAction.type !== 'pick') return;
    if (currentAction.player !== tilePlayer) return;
    // Block human player from making opponent's moves, but allow AI moves
    if (localPlayerId && currentAction.player !== localPlayerId && currentAction.player !== 'player2') return;

    const heroCopy = JSON.parse(JSON.stringify(hero));
    try { if (heroCopy && heroCopy._startingRow) delete heroCopy._startingRow; } catch (e) {}
    let startingRow = null;
    if (heroCopy && heroCopy.fixedPositional) {
      if (tileType === 'reserve') {
        startingRow = 'reserve';
      } else {
        const boardSide = tilePlayer === 'player1' ? 'p1' : 'p2';
        const rowIdx = indexToRow(tileIndex, boardSide);
        startingRow = rowIdx === 0 ? 'front' : (rowIdx === 1 ? 'middle' : 'back');
      }
      heroCopy._startingRow = startingRow;
    }

    // Emit action to server instead of updating local state
    if (socket) {
      socket.emit('makeMove', {
        type: 'draftHero',
        hero: heroCopy,
        player: tilePlayer,
        tileIndex,
        tileType,
        startingRow
      });
    }
  };

  /* Render helpers */
  const renderMainGrid = (mainTiles, playerLabel, playerId, isPickForPlayer, mainCount) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 'var(--font-lg, 0.95rem)', fontWeight: 700, color: '#bdbdbd', marginBottom: 'var(--gap-small, 4px)' }}>{playerLabel}</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--gap-small, 4px)',
        background: isPickForPlayer ? 'rgba(76, 200, 80, 0.25)' : 'transparent',
        padding: 'var(--padding-small, 4px)',
        borderRadius: 'var(--tile-border-radius, 6px)',
        transition: 'background 0.3s ease'
      }}>
        {mainTiles.map((tile) => {
          const disabled = !isPickForPlayer || !!tile.hero || mainCount >= 5;
          const highlightFor = isPickForPlayer ? playerId : null;
          return <Tile key={tile.id} tile={tile} onHeroDrop={handleHeroDropToTile} disabled={disabled} highlightFor={highlightFor} onHover={handleTileHover} onUnhover={handleTileUnhover} />;
        })}
      </div>
    </div>
  );

  const renderReserveColumn = (reserveTiles, playerLabel, playerId, isPickForPlayer, reserveCount) => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap-small, 4px)',
      alignItems: 'center',
      background: isPickForPlayer ? 'rgba(76, 200, 80, 0.25)' : 'transparent',
      padding: 'var(--padding-small, 4px)',
      borderRadius: 'var(--tile-border-radius, 6px)',
      transition: 'background 0.3s ease'
    }}>
      <div style={{ fontSize: 'var(--font-md, 0.9rem)', fontWeight: 700, color: playerId === 'player1' ? '#4fc3f7' : '#ffb74d' }}>Reserve</div>
      {reserveTiles.map((tile) => {
        const disabled = !isPickForPlayer || !!tile.hero || reserveCount >= 2;
        const highlightFor = isPickForPlayer ? playerId : null;
        return <Tile key={tile.id} tile={tile} onHeroDrop={handleHeroDropToTile} disabled={disabled} highlightFor={highlightFor} onHover={handleTileHover} onUnhover={handleTileUnhover} />;
      })}
    </div>
  );

  /* Player sections arranged so players face each other horizontally.
     Reserves are on the outer sides (player1 reserve on left, player2 reserve on right). */
  const renderPlayerSection = (mainTiles, reserveTiles, playerLabel, playerId) => {
    const isPickForPlayer = currentAction && currentAction.type === 'pick' && currentAction.player === playerId && (!localPlayerId || localPlayerId === playerId);
    const mainCount = mainTiles.filter(t => t.hero).length;
    const reserveCount = reserveTiles.filter(t => t.hero).length;

    if (playerId === 'player1') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-large, 12px)' }}>
          {/* reserve on outer left */}
          {renderReserveColumn(reserveTiles, playerLabel, playerId, isPickForPlayer, reserveCount)}

          {/* main board */}
          {renderMainGrid(mainTiles, playerLabel, playerId, isPickForPlayer, mainCount)}
        </div>
      );
    } else {
      // player2: main then reserve on outer right
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-large, 12px)' }}>
          {/* main board */}
          {renderMainGrid(mainTiles, playerLabel, playerId, isPickForPlayer, mainCount)}

          {/* reserve on outer right */}
          {renderReserveColumn(reserveTiles, playerLabel, playerId, isPickForPlayer, reserveCount)}
        </div>
      );
    }
  };

  // onGameEnd from battle
  const handleGameEnd = (winner) => {
    // simple behavior: exit battle and show result
    setInBattle(false);
    if (winner === 'player1' || winner === 'player2') {
      const winnerName = winner === 'player1' ? (matchPlayers?.p1 || 'Player 1') : (matchPlayers?.p2 || 'Player 2');
      alert(`${winnerName} wins!`);
    } else {
      alert('Game ended: ' + winner);
    }
  };

  if (inBattle) {
    // Lazy-load Battle (production version with auto-play) instead of BattlePhase
    return (
      <React.Suspense fallback={<div style={{ padding: 20, color: '#fff' }}>Loading battle...</div>}>
        <Battle
          p1Main={p1Main}
          p1Reserve={p1Reserve}
          p2Main={p2Main}
          p2Reserve={p2Reserve}
          onGameEnd={handleGameEnd}
          aiDifficulty={aiDifficulty}
        />
      </React.Suspense>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="draft-board-root" style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--gap-medium, 8px)', 
        padding: 'var(--gap-medium, 8px)', 
        color: '#fff', 
        minHeight: '100vh', 
        boxSizing: 'border-box', 
        overflow: 'auto' 
      }}>
        {/* Main content area: boards + ban pile in a row */}
        <div style={{ 
          display: 'flex', 
          gap: 'var(--gap-medium, 12px)', 
          alignItems: 'flex-start',
          justifyContent: 'center',
          width: '100%'
        }}>
          {/* Center column: players facing each other + hero pool below */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--gap-small, 4px)',
            alignItems: 'center'
          }}>
            {/* The two players facing each other */}
            <div 
              ref={boardsContainerRef}
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 'calc(32px * var(--ui-scale, 1))', 
                alignItems: 'flex-start' 
              }}
            >
              {renderPlayerSection(p1Main, p1Reserve, matchPlayers?.p1 || 'Player 1', 'player1')}
              {renderPlayerSection(p2Main, p2Reserve, matchPlayers?.p2 || 'Player 2', 'player2')}
            </div>

            {/* Hero pool below the two boards - anchored to boards width */}
            <div style={{ 
              width: boardsWidth > 0 ? boardsWidth : '100%',
              maxWidth: boardsWidth > 0 ? boardsWidth : '100%',
              marginTop: 'var(--gap-small, 4px)'
            }}>
              <div 
                className="db-hero-pool" 
                style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 'var(--gap-small, 4px)', 
                  padding: 'var(--padding-small, 6px)', 
                  background: '#111', 
                  borderRadius: 'var(--tile-border-radius, 6px)', 
                  maxHeight: 'calc(380px * var(--ui-scale, 1))', 
                  overflowY: 'auto',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {availableHeroes.map(hero => <HeroCard key={hero.name} hero={hero} onHover={handleHeroHover} onUnhover={handleTileUnhover} />)}
                {availableHeroes.length === 0 && <div style={{ color: '#9e9e9e', padding: 'var(--padding-small, 6px)' }}>No heroes left</div>}
              </div>
            </div>

            {/* Hero info box - shows spell details on hover */}
            <div style={{ 
              width: boardsWidth > 0 ? boardsWidth : '100%',
              maxWidth: boardsWidth > 0 ? boardsWidth : '100%',
              marginTop: 'var(--gap-small, 4px)'
            }}>
              <div style={{ 
                minHeight: 'calc(100px * var(--ui-scale, 1))', 
                background: '#1a1a2e', 
                border: '1px solid #3a3a5a', 
                padding: 'calc(6px * var(--ui-scale, 1))', 
                borderRadius: 'var(--tile-border-radius, 6px)', 
                fontSize: 'calc(11px * var(--ui-scale, 1))', 
                lineHeight: 1.2, 
                color: '#e0e0e0'
              }}>
                {hoverInfo && hoverInfo.hero ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'calc(12px * var(--ui-scale, 1))', marginBottom: 2 }}>{hoverInfo.hero.name}</div>
                    <div style={{ marginTop: 2 }}>
                      <span style={{ fontWeight: 600 }}>{(() => { const s = hoverInfo.hero?.spells?.front; const sd = s ? getSpellById(s.id) : null; return s ? `Front - ${sd?.name || s.id} [${s.cost || '?'}]: ` : 'Front: '; })()}</span>
                      <span>{(() => { const s = hoverInfo.hero?.spells?.front; const sd = s ? getSpellById(s.id) : null; return sd && (sd.description || (sd.spec && sd.spec.description)) ? (sd.description || (sd.spec && sd.spec.description)) : '—'; })()}</span>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <span style={{ fontWeight: 600 }}>{(() => { const s = hoverInfo.hero?.spells?.middle; const sd = s ? getSpellById(s.id) : null; return s ? `Middle - ${sd?.name || s.id} [${s.cost || '?'}]: ` : 'Middle: '; })()}</span>
                      <span>{(() => { const s = hoverInfo.hero?.spells?.middle; const sd = s ? getSpellById(s.id) : null; return sd && (sd.description || (sd.spec && sd.spec.description)) ? (sd.description || (sd.spec && sd.spec.description)) : '—'; })()}</span>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <span style={{ fontWeight: 600 }}>{(() => { const s = hoverInfo.hero?.spells?.back; const sd = s ? getSpellById(s.id) : null; return s ? `Back - ${sd?.name || s.id} [${s.cost || '?'}]: ` : 'Back: '; })()}</span>
                      <span>{(() => { const s = hoverInfo.hero?.spells?.back; const sd = s ? getSpellById(s.id) : null; return sd && (sd.description || (sd.spec && sd.spec.description)) ? (sd.description || (sd.spec && sd.spec.description)) : '—'; })()}</span>
                    </div>
                    {/* Passive (if present) */}
                    {(() => {
                      const passives = hoverInfo.hero?.passives || [];
                      const posMods = hoverInfo.hero?.positionalModifiers;
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
                        return <span><span style={{ fontWeight: 700 }}>Shapeshift:</span> {parts.join(', ')}</span>;
                      };
                      return (
                        <div style={{ marginTop: 2 }}>
                          <span style={{ fontWeight: 600 }}>Passive: </span>
                          {renderPositional()}
                          {passives.map((p, pi) => {
                            let eff = null;
                            if (!p) return null;
                            if (typeof p === 'string') eff = getEffectByName(p);
                            else if (p && p.name) eff = p;
                            else if (p && p.effect) eff = getEffectByName(p.effect);
                            const pname = (eff && eff.name) || (p && p.name) || String(p);
                            const pdesc = (eff && eff.description) || (p && p.description) || '';
                            return <span key={`pass-${pi}`}><span style={{ fontWeight: 700 }}>{pname}:</span> {pdesc} </span>;
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ color: '#888' }}>Hover over a hero to see spell details.</div>
                )}
              </div>
            </div>

            {/* Start Battle Button when draft finished */}
            {finished && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--gap-small, 4px)', marginTop: 'var(--gap-small, 4px)' }}>
                <button 
                  onClick={() => socket && socket.emit('makeMove', { type: 'startBattle' })} 
                  style={{ 
                    padding: 'var(--padding-small, 6px) var(--padding-medium, 10px)', 
                    background: '#4caf50', 
                    border: 'none', 
                    borderRadius: 'var(--tile-border-radius, 6px)', 
                    color: '#fff', 
                    fontWeight: 700,
                    fontSize: 'var(--font-lg, 0.95rem)',
                    cursor: 'pointer'
                  }}
                >
                  Start Battle
                </button>
              </div>
            )}
          </div>

          {/* Right: Ban pile */}
          <div style={{ 
            width: 'calc(200px * var(--ui-scale, 1))', 
            minWidth: 'calc(160px * var(--ui-scale, 1))',
            maxWidth: 'calc(220px * var(--ui-scale, 1))',
            minHeight: 'calc(300px * var(--ui-scale, 1))',
            flexShrink: 1
          }}>
            <BanPile
              bans={bans}
              onBanDrop={(hero) => {
                if (currentAction && currentAction.type === 'ban') {
                  handleBanDrop(hero);
                }
              }}
              active={currentAction && currentAction.type === 'ban' && (!localPlayerId || localPlayerId === currentAction.player)}
              player={currentAction && currentAction.type === 'ban' ? currentAction.player : '—'}
            />
          </div>
        </div>
      </div>
    </DndProvider>
  );
}

// Load Battle (production version) lazily
const Battle = React.lazy(() => import('./Battle'));