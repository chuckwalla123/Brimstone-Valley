import assert from 'node:assert/strict';

import { EFFECTS } from './src/effects.js';
import { evaluateEffectValue } from './src/ai/effectValue.js';

assert.equal(evaluateEffectValue(EFFECTS.Turret), 18, 'Expected Turret calibrated value');
assert.equal(evaluateEffectValue(EFFECTS.Poison), 12, 'Expected Poison calibrated value');
assert(
  Math.abs(evaluateEffectValue(EFFECTS.Shielded) - 4.8) < 1e-10,
  'Expected uncalibrated Shielded to use the shared duration and modifier equation',
);
assert.equal(
  evaluateEffectValue(EFFECTS.CloudedPoison),
  4,
  'Expected uncalibrated Clouded Poison to use the shared pulse-duration equation',
);

console.log('shared effect value evaluation test passed');
