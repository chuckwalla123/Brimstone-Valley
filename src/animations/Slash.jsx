import React, { useState, useEffect, useRef } from 'react';
import { stripBackgroundFromImageData, BG_TRANSPARENCY_TOLERANCE } from './utils';
import getAssetPath from '../utils/assetPath';

// Slash animation: sprite-sheet driven, small melee swipe animation.
export default function Slash({ from = { x: 0, y: 0 }, to = { x: 0, y: 0 }, duration = 400, onDone, size = 64, sprite = '/images/spells/Slash_2x2_4frames.png', frames = 4, cols: propCols = 2, rows: propRows = 2, mirror }) {
  const resolvedSprite = getAssetPath(sprite);
  const [currentPos, setCurrentPos] = useState(from);
  const [visible, setVisible] = useState(true);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const animRef = useRef(null);
  const posAnimRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    // hide canvas until processed
    if (canvasRef.current) canvasRef.current.style.display = 'none';

    let imgLoaded = false;
    let done = null;
    if (resolvedSprite) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const s0 = resolvedSprite && resolvedSprite.replace(/\\\\/g, '/');
      const base = s0 ? (s0.startsWith('/') ? s0 : (s0.startsWith('./') ? s0 : '/' + s0)) : null;
      const candidates = base ? [base] : [];
      let ci = 0;
      const tryNext = () => {
        if (ci >= candidates.length) { imgRef.current = null; return; }
        img.src = candidates[ci++];
      };
      img.onload = () => {
        imgLoaded = true;
        // compute frame geometry
        let cols = propCols || Math.max(1, frames);
        let rows = propRows || 1;
        let fw = Math.round(img.width / cols);
        let fh = Math.round(img.height / rows);
        if ((!propCols || !propRows) && img.width && img.height) {
          const minDim = Math.min(img.width, img.height);
          const trySize = Math.floor(minDim);
          if (trySize > 0 && img.width % trySize === 0 && img.height % trySize === 0) {
            cols = img.width / trySize;
            rows = img.height / trySize;
            fw = trySize;
            fh = trySize;
          }
        }
        const total = Math.min(frames, cols * rows);
        const off = document.createElement('canvas'); off.width = fw; off.height = fh;
        const offCtx = off.getContext('2d');
        const frameCanvases = [];
        const colorMatch = (r1,g1,b1,r2,g2,b2, tol=12) => Math.abs(r1-r2) <= tol && Math.abs(g1-g2) <= tol && Math.abs(b1-b2) <= tol;
        for (let i = 0; i < total; i++) {
          const cx = i % cols, cy = Math.floor(i / cols);
          const sx = cx * fw, sy = cy * fh;
          offCtx.clearRect(0,0,fw,fh);
          offCtx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
          try {
            const imd = offCtx.getImageData(0,0,fw,fh);
            stripBackgroundFromImageData(imd, BG_TRANSPARENCY_TOLERANCE);
            const pcan = document.createElement('canvas'); pcan.width = fw; pcan.height = fh; pcan.getContext('2d').putImageData(imd, 0, 0);
            frameCanvases.push(pcan);
          } catch (e) {
            const pcan = document.createElement('canvas'); pcan.width = fw; pcan.height = fh; pcan.getContext('2d').drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
            frameCanvases.push(pcan);
          }
        }
        imgRef.current = { img, frameCanvases, fw, fh, cols, rows, total };
        if (canvasRef.current) canvasRef.current.style.display = 'block';
        // start both animations together so position interpolation waits for frames to be ready
        startRef.current = performance.now();
        posAnimRef.current = requestAnimationFrame(animatePosition);
        animRef.current = requestAnimationFrame(tick);

        // hide after animation finishes (small buffer)
        done = setTimeout(() => { setVisible(false); }, duration + 60);
      };
      img.onerror = () => { tryNext(); };
      tryNext();
    } else {
      // no sprite: start position animation immediately and schedule hide
      posAnimRef.current = requestAnimationFrame(animatePosition);
      done = setTimeout(() => { setVisible(false); }, duration + 60);
    }

    // Interpolate position from 'from' to 'to' over duration using an ease-out curve
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const animatePosition = () => {
      const startTime = startRef.current || performance.now();
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const x = from.x + (to.x - from.x) * eased;
      const y = from.y + (to.y - from.y) * eased;
      setCurrentPos({ x, y });
      if (progress < 1) {
        posAnimRef.current = requestAnimationFrame(animatePosition);
      } else {
        onDone && onDone();
      }
    };

    function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const frameIndex = Math.floor((elapsed % duration) / (duration / Math.max(1, frames)));
      drawFrame(frameIndex);
      animRef.current = requestAnimationFrame(tick);
    }

    function drawFrame(fi) {
      const ref = imgRef.current;
      const c = canvasRef.current;
      if (!c || !ref) return;
      const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
      try {
        if (ref.frameCanvases && ref.frameCanvases.length) {
          const idx = fi % Math.max(1, ref.total || ref.frameCanvases.length);
          const fcan = ref.frameCanvases[idx]; if (fcan) ctx.drawImage(fcan, 0, 0, fcan.width, fcan.height, 0, 0, c.width, c.height);
          return;
        }
      } catch (e) {}
    }

    return () => { clearTimeout(done); if (animRef.current) cancelAnimationFrame(animRef.current); if (posAnimRef.current) cancelAnimationFrame(posAnimRef.current); };
  }, [from.x, from.y, to.x, to.y, duration, onDone]);

  const dx = (to.x || 0) - (from.x || 0);
  // horizontal flip decision: prefer explicit `mirror` prop, otherwise infer from travel direction
  const flipX = (typeof mirror !== 'undefined') ? Boolean(mirror) : (dx < 0);

  const orbStyle = {
    position: 'absolute',
    left: `${currentPos.x}px`,
    top: `${currentPos.y}px`,
    transform: `translate(-50%,-50%) ${flipX ? 'scaleX(-1)' : ''}`,
    // Position is driven by RAF interpolation with easing; only animate opacity via CSS transition
    transition: `opacity ${Math.round(duration/3)}ms ease-out`,
    background: 'transparent',
  };

  return (
    <canvas ref={canvasRef} width={size} height={size} style={orbStyle} />
  );
}
