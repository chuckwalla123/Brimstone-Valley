import util from 'node:util';

// tfjs-node 4.x calls util.isNullOrUndefined, which was removed in Node 23+.
if (typeof util.isNullOrUndefined !== 'function') {
  util.isNullOrUndefined = (value) => value === null || value === undefined;
}
if (typeof util.isArray !== 'function') util.isArray = Array.isArray;

try {
  await import('@tensorflow/tfjs-node');
} catch (error) {
  console.warn(`[HardAI] tfjs-node unavailable, using the slower JS backend: ${error.message}`);
}
