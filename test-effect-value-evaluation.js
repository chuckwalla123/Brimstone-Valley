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
assert.equal(
  evaluateEffectValue(EFFECTS.Poison, { useOverrides: false }),
  12,
  'Expected formula-only evaluation to bypass the Poison override',
);
assert.equal(
  evaluateEffectValue(EFFECTS.Treachery, { useOverrides: false, targetArmor: 3 }),
  18,
  'Expected formula-only Treachery to use the target armor',
);

console.log('shared effect value evaluation test passed');
