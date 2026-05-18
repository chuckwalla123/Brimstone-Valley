import fs from 'node:fs/promises';
import path from 'node:path';

import { EFFECTS } from '../src/effects.js';
import { SPELLS } from '../src/spells.js';

const OUTPUT_EFFECTS = path.resolve('scripts', 'ai-effect-evaluation-template.csv');
const OUTPUT_EFFECTS_DETAILED = path.resolve('scripts', 'ai-effect-evaluation-detailed.csv');
const OUTPUT_INPUTS = path.resolve('scripts', 'ai-evaluation-inputs.csv');

const DRAFT_EFFECT_HORIZON = 6;

const csvEscape = (value) => {
  const normalized = value == null ? '' : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const toCsv = (rows) => rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n';

const getEffectTurns = (duration) => {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(1, Math.min(DRAFT_EFFECT_HORIZON, Number(duration)));
  }
  return DRAFT_EFFECT_HORIZON;
};

const estimateEffectValue = (effect) => {
  const turns = getEffectTurns(effect.duration);
  let score = 0;

  if (effect.pulse?.type === 'damage') {
    if (effect.pulse.derivedFrom === 'roundNumber') score += (turns * (turns + 1)) / 2;
    else if (effect.pulse.derivedFrom === 'armor') score += 4 * turns;
    else score += Number(effect.pulse.value || 0) * turns;
  }
  if (effect.pulse?.type === 'heal') {
    score += Number(effect.pulse.value || 0) * turns * 0.85;
  }
  if (effect.modifiers && typeof effect.modifiers === 'object') {
    const magnitude = Object.values(effect.modifiers)
      .reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0);
    score += magnitude * turns * (effect.kind === 'debuff' ? 1.15 : 0.8);
  }
  if (effect.onTargeted?.value && typeof effect.onTargeted.value === 'number') score += Math.abs(Number(effect.onTargeted.value)) * 1.15;
  if (effect.onDamaged?.value && typeof effect.onDamaged.value === 'number') score += Math.abs(Number(effect.onDamaged.value)) * 1.15;
  if (effect.onDeath?.value && typeof effect.onDeath.value === 'number') score += Math.abs(Number(effect.onDeath.value)) * 0.75;
  if (effect.healApplierOnPulse?.amount) score += Number(effect.healApplierOnPulse.amount || 0) * turns * 0.65;
  if (effect.spreadEffectToAdjacentOnPulse?.effect) score += turns * 1.6;
  if (effect.preventSingleTarget) score += 5;
  if (effect.taunt) score += 4;
  if (effect.blocksProjectileAndColumn) score += 4;
  if (effect.redirectSingleTargetToEffectApplier) score += 4;
  if (effect.forceMultiTargetToSelf) score += 4;
  if (effect.forceSingleTargetLowestArmor) score += 2.5;

  if (score === 0) {
    if (effect.kind === 'debuff') score = 1.5;
    else if (effect.kind === 'buff') score = 1;
  }

  return Math.max(0, score);
};

const getModifierTotal = (effect) => (effect.modifiers && typeof effect.modifiers === 'object'
  ? Object.values(effect.modifiers).reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0)
  : 0);

const getPulsePerTurn = (effect) => {
  if (effect.pulse?.type === 'damage') {
    if (effect.pulse.derivedFrom === 'roundNumber') return 'roundNumber';
    if (effect.pulse.derivedFrom === 'armor') return 'targetArmor';
    return Number(effect.pulse.value || 0);
  }
  if (effect.pulse?.type === 'heal') {
    return Number(effect.pulse.value || 0);
  }
  return '';
};

const getReactiveValue = (effect) => {
  let score = 0;
  if (effect.onTargeted?.value && typeof effect.onTargeted.value === 'number') score += Math.abs(Number(effect.onTargeted.value)) * 1.15;
  if (effect.onDamaged?.value && typeof effect.onDamaged.value === 'number') score += Math.abs(Number(effect.onDamaged.value)) * 1.15;
  if (effect.onDeath?.value && typeof effect.onDeath.value === 'number') score += Math.abs(Number(effect.onDeath.value)) * 0.75;
  return score;
};

const getProtectionValue = (effect) => {
  let score = 0;
  if (effect.preventSingleTarget) score += 5;
  if (effect.taunt) score += 4;
  if (effect.blocksProjectileAndColumn) score += 4;
  if (effect.redirectSingleTargetToEffectApplier) score += 4;
  if (effect.forceMultiTargetToSelf) score += 4;
  if (effect.forceSingleTargetLowestArmor) score += 2.5;
  if (effect.preventMovement) score += 2;
  return score;
};

const getSpreadBonus = (effect) => {
  let score = 0;
  if (effect.healApplierOnPulse?.amount) score += Number(effect.healApplierOnPulse.amount || 0) * 0.65;
  if (effect.spreadEffectToAdjacentOnPulse?.effect) score += 1.6;
  return score;
};

const getAllTargetTypes = () => {
  const types = new Set();
  Object.values(SPELLS || {}).forEach((spell) => {
    const targets = spell?.spec?.targets || [];
    targets.forEach((target) => {
      if (target?.type) types.add(target.type);
    });
    const triggerTargets = spell?.spec?.trigger?.spellSpec?.targets || [];
    triggerTargets.forEach((target) => {
      if (target?.type) types.add(target.type);
    });
  });
  Object.values(EFFECTS || {}).forEach((effect) => {
    const targets = effect?.spellSpec?.targets || [];
    targets.forEach((target) => {
      if (target?.type) types.add(target.type);
    });
  });
  return [...types].sort();
};

const detailedEffectRows = [
  [
    'effect_key',
    'name',
    'kind',
    'duration',
    'estimated_value',
    'manual_override',
    'pulse_type',
    'pulse_value',
    'pulse_derived_from',
    'modifier_total_abs',
    'modifiers_json',
    'onTargeted_type',
    'onTargeted_value',
    'onDamaged_type',
    'onDamaged_value',
    'onDeath_type',
    'onDeath_value',
    'healApplierOnPulse',
    'spreadEffectToAdjacentOnPulse',
    'preventSingleTarget',
    'taunt',
    'blocksProjectileAndColumn',
    'redirectSingleTargetToEffectApplier',
    'forceMultiTargetToSelf',
    'forceSingleTargetLowestArmor',
    'preventMovement',
    'trigger',
    'spellSpec_targets',
    'spellSpec_formula',
    'notes',
    'description',
  ],
];

Object.entries(EFFECTS).forEach(([effectKey, effect]) => {
  const modifierTotal = getModifierTotal(effect);
  detailedEffectRows.push([
    effectKey,
    effect.name || '',
    effect.kind || '',
    effect.duration ?? '',
    estimateEffectValue(effect),
    '',
    effect.pulse?.type || '',
    effect.pulse?.value ?? '',
    effect.pulse?.derivedFrom || '',
    modifierTotal,
    effect.modifiers ? JSON.stringify(effect.modifiers) : '',
    effect.onTargeted?.type || '',
    effect.onTargeted?.value ?? '',
    effect.onDamaged?.type || '',
    effect.onDamaged?.value ?? '',
    effect.onDeath?.type || '',
    effect.onDeath?.value ?? '',
    effect.healApplierOnPulse?.amount ?? '',
    effect.spreadEffectToAdjacentOnPulse?.effect || '',
    effect.preventSingleTarget ? 'true' : '',
    effect.taunt ? 'true' : '',
    effect.blocksProjectileAndColumn ? 'true' : '',
    effect.redirectSingleTargetToEffectApplier ? 'true' : '',
    effect.forceMultiTargetToSelf ? 'true' : '',
    effect.forceSingleTargetLowestArmor ? 'true' : '',
    effect.preventMovement ? 'true' : '',
    effect.trigger || '',
    effect.spellSpec?.targets ? JSON.stringify(effect.spellSpec.targets) : '',
    effect.spellSpec?.formula ? JSON.stringify(effect.spellSpec.formula) : '',
    '',
    effect.description || '',
  ]);
});

const editableEffectRows = [
  [
    'effect_key',
    'name',
    'kind',
    'duration',
    'turn_basis',
    'default_turns_used',
    'pulse_type',
    'per_turn_value',
    'modifier_total_abs',
    'reactive_value',
    'protection_value',
    'spread_or_bonus_value',
    'current_estimated_total',
    'manual_value',
    'notes',
    'description',
  ],
];

Object.entries(EFFECTS).forEach(([effectKey, effect]) => {
  const turns = getEffectTurns(effect.duration);
  const hasTurnBasedValue = !!effect.pulse || !!effect.modifiers;
  editableEffectRows.push([
    effectKey,
    effect.name || '',
    effect.kind || '',
    effect.duration ?? '',
    hasTurnBasedValue ? 'expected_turns_alive' : 'static_or_triggered',
    turns,
    effect.pulse?.type || '',
    getPulsePerTurn(effect),
    getModifierTotal(effect),
    getReactiveValue(effect),
    getProtectionValue(effect),
    getSpreadBonus(effect),
    estimateEffectValue(effect),
    '',
    '',
    effect.description || '',
  ]);
});

const targetTypes = getAllTargetTypes();
const inputRows = [
  ['scope', 'field', 'description', 'formula_or_source', 'example_or_values'],
  ['hero', 'currentHealth', 'Runtime current health for healing, missing health, ECV, and hero-point calculations.', 'tile.currentHealth ?? hero.currentHealth ?? hero.health', 'number'],
  ['hero', 'health', 'Base or max health used as fallback and for missing-health math.', 'hero.health ?? hero.maxHealth', 'number'],
  ['hero', 'currentArmor', 'Runtime armor used for incoming damage and ECV.', 'tile.currentArmor ?? hero.currentArmor ?? hero.armor', 'number'],
  ['hero', 'armor', 'Base armor fallback and part of ECV/base-stat scoring.', 'hero.armor', 'number'],
  ['hero', 'currentSpeed', 'Runtime speed used by some formula/targeting logic.', 'tile.currentSpeed ?? hero.currentSpeed ?? hero.speed', 'number'],
  ['hero', 'speed', 'Base speed and spell cadence term in tile value.', 'hero.speed', 'number'],
  ['hero', 'currentEnergy', 'Runtime energy used to estimate casts available this turn.', 'tile.currentEnergy ?? hero.currentEnergy ?? hero.energy', 'number'],
  ['hero', 'energy', 'Base energy fallback.', 'hero.energy', 'number'],
  ['hero', 'currentSpellPower', 'Runtime spell power used in formula evaluation.', 'tile.currentSpellPower ?? hero.currentSpellPower ?? hero.spellPower', 'number'],
  ['hero', 'spellPower', 'Base spell power fallback.', 'hero.spellPower', 'number'],
  ['hero', 'effects', 'Active tile or hero effects used for buff/debuff counts and named-effect checks.', 'tile.effects || hero.effects', 'array'],
  ['target', 'buff_count', 'Count of effects where kind === buff.', 'countEffectsByKind(tile, buff)', 'integer'],
  ['target', 'debuff_count', 'Count of effects where kind === debuff.', 'countEffectsByKind(tile, debuff)', 'integer'],
  ['target', 'named_effect_count', 'Count of effects matching a specific name.', 'countEffectsByName(tile, effectName)', 'integer'],
  ['target', 'missing_health', 'Missing health for heal valuation and some spell formulas.', 'max(0, maxHealth - currentHealth)', 'integer'],
  ['target', 'target_speed', 'Used by divideByTargetSpeed formulas; unknown target defaults to 3.', 'max(1, currentSpeed || speed || 3)', 'default 3'],
  ['board', 'row', 'Visual row index used to determine active spell and row-targeting.', 'indexToRow(index, side)', '0 front, 1 middle, 2 back'],
  ['board', 'column', 'Visual column index used by column/projectile targeting.', 'indexToColumn(index, side)', '0 left, 1 center, 2 right'],
  ['calc', 'ECV', 'Effective combat value used as the survival/base body term.', 'sqrt(HP * (HP + Armor * 6))', 'easyAI calculateEffectiveCombatValue'],
  ['calc', 'expected_turns_alive', 'Survival horizon used in hero points.', 'ECV / 4', 'easyAI calculateHeroPoints'],
  ['calc', 'tile_value', 'Per-position spell throughput estimate.', 'sum(spellImpact * min(speed/cost, castsThisTurn)) + basicAttackFallback', 'easyAI calculateTileValue'],
  ['calc', 'incoming_damage_per_turn', 'Projected enemy spell damage and effect threat on this tile.', 'estimateIncomingDamagePerTurn(...)', 'easyAI'],
  ['calc', 'incoming_ally_energy_per_turn', 'Projected ally energy support hitting this tile.', 'estimateIncomingAllyEnergyPerTurn(...)', 'easyAI'],
  ['calc', 'hero_points', 'Main draft placement score in EasyAI.', 'ECV + tileValue * expectedTurnsAlive - incomingDamage * expectedTurnsAlive - reservePenalty', 'easyAI calculateHeroPoints'],
  ['calc', 'effect_estimated_value', 'Current Medium effect heuristic before any manual override.', 'pulse + modifiers + trigger utility + protection utility', 'mediumAI estimateEffectValue'],
  ['calc', 'target_coverage', 'Medium draft heuristic for how many units a spell/effect can influence.', 'derived from target type and max', `target types: ${targetTypes.join(' | ')}`],
  ['draft', 'effect_pressure', 'Sum of debuff-producing effect value across a hero kit.', 'sum(effect_estimated_value * target_coverage for debuffs)', 'mediumAI hero profile'],
  ['draft', 'buff_value', 'Sum of buff-producing effect value across a hero kit.', 'sum(effect_estimated_value * target_coverage for buffs)', 'mediumAI hero profile'],
  ['draft', 'cleanse_coverage', 'How much enemy debuff value a hero can answer.', 'removeTopDebuff/removeDebuffs target coverage + healIfRemoved bonus', 'mediumAI hero profile'],
  ['draft', 'buff_strip_coverage', 'How much enemy buff value a hero can answer.', 'removeTopPositiveEffect target coverage', 'mediumAI hero profile'],
  ['draft', 'ban_context', 'Medium bans can now receive the current board state for draft-aware denial.', 'makeBanDecision(availableHeroes, {p2Main,p2Reserve,p1Main,p1Reserve})', 'DraftBoard passes this during AI bans'],
];

await fs.writeFile(OUTPUT_EFFECTS, toCsv(editableEffectRows), 'utf8');
await fs.writeFile(OUTPUT_EFFECTS_DETAILED, toCsv(detailedEffectRows), 'utf8');
await fs.writeFile(OUTPUT_INPUTS, toCsv(inputRows), 'utf8');

console.log(`Wrote ${OUTPUT_EFFECTS}`);
console.log(`Wrote ${OUTPUT_EFFECTS_DETAILED}`);
console.log(`Wrote ${OUTPUT_INPUTS}`);