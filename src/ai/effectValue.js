import { getEffectByName } from '../effects.js';
import { EFFECT_EVALUATION_OVERRIDES } from './effectEvaluationOverrides.js';

const EFFECT_VALUE_HORIZON = 6;

const getEffectTurns = (duration) => {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(1, Math.min(EFFECT_VALUE_HORIZON, Number(duration)));
  }
  return EFFECT_VALUE_HORIZON;
};

export const evaluateEffectValue = (effect) => {
  const resolved = typeof effect === 'string' ? getEffectByName(effect) : effect;
  if (!resolved) return 0;

  const override = EFFECT_EVALUATION_OVERRIDES[resolved.name];
  if (typeof override === 'number' && Number.isFinite(override)) {
    return override;
  }

  const turns = getEffectTurns(resolved.duration);
  let score = 0;

  if (resolved.pulse?.type === 'damage') {
    if (resolved.pulse.derivedFrom === 'roundNumber') {
      score += (turns * (turns + 1)) / 2;
    } else if (resolved.pulse.derivedFrom === 'armor') {
      score += 4 * turns;
    } else {
      score += Number(resolved.pulse.value || 0) * turns;
    }
  }
  if (resolved.pulse?.type === 'heal') {
    score += Number(resolved.pulse.value || 0) * turns * 0.85;
  }
  if (resolved.modifiers && typeof resolved.modifiers === 'object') {
    const modifierMagnitude = Object.values(resolved.modifiers)
      .reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0);
    score += modifierMagnitude * turns * (resolved.kind === 'debuff' ? 1.15 : 0.8);
  }
  if (resolved.onTargeted?.value) score += Math.abs(Number(resolved.onTargeted.value || 0)) * 1.15;
  if (resolved.onDamaged?.value) score += Math.abs(Number(resolved.onDamaged.value || 0)) * 1.15;
  if (resolved.onDeath?.value) score += Math.abs(Number(resolved.onDeath.value || 0)) * 0.75;
  if (resolved.healApplierOnPulse?.amount) score += Number(resolved.healApplierOnPulse.amount || 0) * turns * 0.65;
  if (resolved.spreadEffectToAdjacentOnPulse?.effect) score += turns * 1.6;
  if (resolved.preventSingleTarget) score += 5;
  if (resolved.taunt) score += 4;
  if (resolved.blocksProjectileAndColumn) score += 4;
  if (resolved.redirectSingleTargetToEffectApplier) score += 4;
  if (resolved.forceMultiTargetToSelf) score += 4;
  if (resolved.forceSingleTargetLowestArmor) score += 2.5;

  if (score === 0) {
    if (resolved.kind === 'debuff') score = 1.5;
    else if (resolved.kind === 'buff') score = 1;
  }

  return Math.max(0, score);
};
