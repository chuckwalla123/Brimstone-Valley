import assert from 'node:assert/strict';

import { EFFECT_EVALUATION_OVERRIDES, EFFECT_EVALUATION_OVERRIDE_DIAGNOSTICS } from './src/ai/effectEvaluationOverrides.js';

assert.equal(EFFECT_EVALUATION_OVERRIDES.Poison, 12, 'Expected Poison override to resolve from expected-turns formula');
assert.equal(EFFECT_EVALUATION_OVERRIDES.Burn, 6, 'Expected Burn override to resolve from expected-turns formula');
assert.equal(EFFECT_EVALUATION_OVERRIDES.Crumble, -2, 'Expected literal negative override to be preserved');

const poisonDiagnostic = EFFECT_EVALUATION_OVERRIDE_DIAGNOSTICS.find(entry => entry.effect_key === 'Poison');
assert.equal(poisonDiagnostic?.status, 'expression', 'Expected Poison diagnostic to show expression parsing');

console.log('effect evaluation override compilation test passed');