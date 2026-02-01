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

import React, { useState, useCallback, useRef, createContext } from 'react';
import { createPortal } from 'react-dom';
import registry from './index';

export const AnimationsContext = createContext(null);

export default function AnimationLayer({ children }) {
  const [entries, setEntries] = useState([]);
  const idRef = useRef(1);

  const play = useCallback(({ name, from, to, props = {}, duration = 600 }) => {
    const key = idRef.current++;
    let Component = registry[name];
    if (!Component) {
      console.warn(`Unknown animation: ${name} - falling back to 'slash'`);
      Component = registry['slash'] || Object.values(registry)[0];
      if (!Component) return null;
    }
    const entry = { key, Component, from, to, props, duration };
    setEntries(e => [...e, entry]);
    return key;
  }, []);

  const remove = useCallback((key) => {
    setEntries(e => e.filter(x => x.key !== key));
  }, []);

  return (
    <AnimationsContext.Provider value={{ play, remove }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}>
          {entries.map(entry => {
            const { Component, key, from, to, props, duration } = entry;
            // Store the callback on the entry object to maintain reference stability
            if (!entry.onDone) {
              entry.onDone = () => remove(key);
            }
            return (
              <Component
                key={key}
                from={from}
                to={to}
                duration={duration}
                {...props}
                onDone={entry.onDone}
              />
            );
          })}
        </div>,
        document.body
      )}
    </AnimationsContext.Provider>
  );
}
