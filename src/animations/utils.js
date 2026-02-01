export const BG_TRANSPARENCY_TOLERANCE = 32;

export function stripBackgroundFromImageData(imd, tolerance = BG_TRANSPARENCY_TOLERANCE) {
  const { data, width: w, height: h } = imd;
  // collect border pixels (top,bottom,left,right)
  const samples = [];
  const pushPixel = (x,y) => {
    const idx = (y * w + x) * 4;
    samples.push([data[idx], data[idx+1], data[idx+2]]);
  };
  for (let x = 0; x < w; x++) { pushPixel(x, 0); pushPixel(x, h-1); }
  for (let y = 1; y < h-1; y++) { pushPixel(0, y); pushPixel(w-1, y); }
  if (!samples.length) return imd;
  // find most frequent RGB among samples
  const map = {};
  samples.forEach(s => { const k = s.join(','); map[k] = (map[k] || 0) + 1; });
  const bestKey = Object.keys(map).reduce((a,b) => (map[a] > map[b] ? a : b));
  const best = bestKey.split(',').map(n => Number(n));
  const [br, bg, bb] = best;
  // apply tolerance-based alpha clearing
  const tol = Math.max(0, Number(tolerance || 0));
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    if (a === 0) continue;
    const dr = r - br, dg = g - bg, db = b - bb;
    const dist2 = dr*dr + dg*dg + db*db;
    if (dist2 <= tol*tol) data[i+3] = 0;
  }
  return imd;
}
