// src/tower/augments.js
// Augment definitions for Tower of Shattered Champions mode

import { EFFECTS } from '../effects.js';

/**
 * Augment Tiers determine rarity and when they can appear
 * - common: Levels 1+, most frequent
 * - uncommon: Levels 3+, moderate frequency
 * - rare: Levels 8+, less frequent
 * - epic: Levels 15+, rare
 * - legendary: Levels 22+, very rare
 *
 * Each tier also has a late-game target weight so rolls keep trending upward
 * as tower level increases instead of staying mostly static after unlock.
 */

export const AUGMENT_TIERS = {
  common: { minLevel: 1, weight: 100, targetWeight: 10 },
  uncommon: { minLevel: 3, weight: 60, targetWeight: 24 },
  rare: { minLevel: 8, weight: 30, targetWeight: 55 },
  epic: { minLevel: 15, weight: 15, targetWeight: 48 },
  legendary: { minLevel: 22, weight: 5, targetWeight: 34 }
};

const AUGMENT_WEIGHT_TARGET_LEVEL = 40;

function clampProgress(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const progress = clampProgress(value);
  return progress * progress * (3 - (2 * progress));
}

export function getAugmentTierWeight(tier, level) {
  const tierInfo = AUGMENT_TIERS[tier];

  if (!tierInfo) return 0;
  if (level <= tierInfo.minLevel) return tierInfo.weight;

  const span = Math.max(1, AUGMENT_WEIGHT_TARGET_LEVEL - tierInfo.minLevel);
  const progress = smoothstep((level - tierInfo.minLevel) / span);
  const scaledWeight = tierInfo.weight + ((tierInfo.targetWeight - tierInfo.weight) * progress);

  return Math.max(1, Math.round(scaledWeight));
}

/**
 * Augments are hidden effects applied to heroes during tower runs.
 * They don't show in the battle UI but their effects are active.
 * 
 * Structure:
 * - id: Unique identifier
 * - name: Display name
 * - description: What it does (with {value} placeholder)
 * - tier: common|uncommon|rare|epic|legendary
 * - type: stat|spell|effect|debuff
 * - apply: Function that modifies the hero or returns effect to apply
 * - valueRange: [min, max] for random value selection
 */

export const AUGMENTS = {
  // ============================================
  // STAT AUGMENTS - Direct stat modifications
  // ============================================
  
  // Health augments (common to legendary)
  healthBoostSmall: {
    id: 'healthBoostSmall',
    name: 'Vitality I',
    description: '+{value} Health',
    tier: 'common',
    type: 'stat',
    valueRange: [3, 3],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostMedium: {
    id: 'healthBoostMedium',
    name: 'Vitality II',
    description: '+{value} Health',
    tier: 'uncommon',
    type: 'stat',
    valueRange: [6, 6],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostLarge: {
    id: 'healthBoostLarge',
    name: 'Vitality III',
    description: '+{value} Health',
    tier: 'rare',
    type: 'stat',
    valueRange: [9, 9],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostHuge: {
    id: 'healthBoostHuge',
    name: 'Vitality IV',
    description: '+{value} Health',
    tier: 'epic',
    type: 'stat',
    valueRange: [12, 12],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostMassive: {
    id: 'healthBoostMassive',
    name: 'Vitality V',
    description: '+{value} Health',
    tier: 'legendary',
    type: 'stat',
    valueRange: [15, 15],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },

  // Armor augments
  armorBoostSmall: {
    id: 'armorBoostSmall',
    name: 'Fortitude I',
    description: '+{value} Armor',
    tier: 'common',
    type: 'stat',
    valueRange: [1, 1],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },
  armorBoostMedium: {
    id: 'armorBoostMedium',
    name: 'Fortitude II',
    description: '+{value} Armor',
    tier: 'uncommon',
    type: 'stat',
    valueRange: [2, 2],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },
  armorBoostLarge: {
    id: 'armorBoostLarge',
    name: 'Fortitude III',
    description: '+{value} Armor',
    tier: 'rare',
    type: 'stat',
    valueRange: [3, 3],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },
  armorBoostHuge: {
    id: 'armorBoostHuge',
    name: 'Fortitude IV',
    description: '+{value} Armor',
    tier: 'epic',
    type: 'stat',
    valueRange: [4, 4],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },
  armorBoostMassive: {
    id: 'armorBoostMassive',
    name: 'Fortitude V',
    description: '+{value} Armor',
    tier: 'legendary',
    type: 'stat',
    valueRange: [5, 5],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },

  // Speed augments
  speedBoostSmall: {
    id: 'speedBoostSmall',
    name: 'Swiftness I',
    description: '+{value} Speed',
    tier: 'common',
    type: 'stat',
    valueRange: [1, 1],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },
  speedBoostMedium: {
    id: 'speedBoostMedium',
    name: 'Swiftness II',
    description: '+{value} Speed',
    tier: 'uncommon',
    type: 'stat',
    valueRange: [2, 2],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },
  speedBoostLarge: {
    id: 'speedBoostLarge',
    name: 'Swiftness III',
    description: '+{value} Speed',
    tier: 'rare',
    type: 'stat',
    valueRange: [3, 3],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },
  speedBoostHuge: {
    id: 'speedBoostHuge',
    name: 'Swiftness IV',
    description: '+{value} Speed',
    tier: 'epic',
    type: 'stat',
    valueRange: [4, 4],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },
  speedBoostMassive: {
    id: 'speedBoostMassive',
    name: 'Swiftness V',
    description: '+{value} Speed',
    tier: 'legendary',
    type: 'stat',
    valueRange: [5, 5],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },

  // Spell Power augments
  spellPowerBoostSmall: {
    id: 'spellPowerBoostSmall',
    name: 'Arcane Power I',
    description: '+{value} Spell Power',
    tier: 'common',
    type: 'stat',
    valueRange: [1, 1],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },
  spellPowerBoostMedium: {
    id: 'spellPowerBoostMedium',
    name: 'Arcane Power II',
    description: '+{value} Spell Power',
    tier: 'uncommon',
    type: 'stat',
    valueRange: [2, 2],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },
  spellPowerBoostLarge: {
    id: 'spellPowerBoostLarge',
    name: 'Arcane Power III',
    description: '+{value} Spell Power',
    tier: 'rare',
    type: 'stat',
    valueRange: [3, 3],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },
  spellPowerBoostHuge: {
    id: 'spellPowerBoostHuge',
    name: 'Arcane Power IV',
    description: '+{value} Spell Power',
    tier: 'epic',
    type: 'stat',
    valueRange: [4, 4],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },
  spellPowerBoostMassive: {
    id: 'spellPowerBoostMassive',
    name: 'Arcane Power V',
    description: '+{value} Spell Power',
    tier: 'legendary',
    type: 'stat',
    valueRange: [5, 5],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },

  attackPowerBoostSmall: {
    id: 'attackPowerBoostSmall',
    name: 'Might I',
    description: '+{value} Attack Power',
    tier: 'common',
    type: 'special',
    valueRange: [2, 2],
    apply: (hero, value) => { hero._towerAttackPowerBonus = Math.max(Number(hero._towerAttackPowerBonus || 0), Number(value || 0)); }
  },
  attackPowerBoostLarge: {
    id: 'attackPowerBoostLarge',
    name: 'Might II',
    description: '+{value} Attack Power',
    tier: 'rare',
    type: 'special',
    valueRange: [5, 5],
    apply: (hero, value) => { hero._towerAttackPowerBonus = Math.max(Number(hero._towerAttackPowerBonus || 0), Number(value || 0)); }
  },

  // Starting Energy augments
  energyBoostSmall: {
    id: 'energyBoostSmall',
    name: 'Quickstart I',
    description: '+{value} Starting Energy',
    tier: 'uncommon',
    type: 'stat',
    valueRange: [2, 2],
    apply: (hero, value) => { hero.energy += value; hero.currentEnergy = (hero.currentEnergy || hero.energy) + value; }
  },
  energyBoostMedium: {
    id: 'energyBoostMedium',
    name: 'Quickstart II',
    description: '+{value} Starting Energy',
    tier: 'rare',
    type: 'stat',
    valueRange: [4, 4],
    apply: (hero, value) => { hero.energy += value; hero.currentEnergy = (hero.currentEnergy || hero.energy) + value; }
  },
  energyBoostLarge: {
    id: 'energyBoostLarge',
    name: 'Quickstart III',
    description: '+{value} Starting Energy',
    tier: 'epic',
    type: 'stat',
    valueRange: [6, 6],
    apply: (hero, value) => { hero.energy += value; hero.currentEnergy = (hero.currentEnergy || hero.energy) + value; }
  },

  // ============================================
  // EARLY-TIER SPECIAL AUGMENTS
  // ============================================

  earlySparkI: {
    id: 'earlySparkI',
    name: 'Early Spark I',
    description: 'In round 1, spells gain +{value} Spell Power.',
    tier: 'rare',
    type: 'special',
    valueRange: [4, 4],
    apply: (hero, value) => { hero._towerEarlySpark = (hero._towerEarlySpark || 0) + Number(value || 0); }
  },
  earlySparkII: {
    id: 'earlySparkII',
    name: 'Early Spark II',
    description: 'In round 1, spells gain +{value} Spell Power.',
    tier: 'legendary',
    type: 'special',
    valueRange: [8, 8],
    apply: (hero, value) => { hero._towerEarlySpark = (hero._towerEarlySpark || 0) + Number(value || 0); }
  },
  frontlineVanguard: {
    id: 'frontlineVanguard',
    name: 'Frontline Vanguard',
    description: 'If started in the front row: +1 starting Energy and +1 front-row casts.',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerFrontlineVanguard = Math.max(Number(hero._towerFrontlineVanguard || 0), 1); }
  },
  frontlineVanguardII: {
    id: 'frontlineVanguardII',
    name: 'Frontline Vanguard II',
    description: 'If started in the front row: +2 starting Energy and +2 front-row casts.',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => { hero._towerFrontlineVanguard = Math.max(Number(hero._towerFrontlineVanguard || 0), 2); }
  },
  rearguard: {
    id: 'rearguard',
    name: 'Rearguard',
    description: 'If started in the back row: +1 starting Energy and +1 back-row casts.',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerRearguard = Math.max(Number(hero._towerRearguard || 0), 1); }
  },
  rearguardII: {
    id: 'rearguardII',
    name: 'Rearguard II',
    description: 'If started in the back row: +2 starting Energy and +2 back-row casts.',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => { hero._towerRearguard = Math.max(Number(hero._towerRearguard || 0), 2); }
  },
  shieldedStart: {
    id: 'shieldedStart',
    name: 'Shielded Start',
    description: 'Gain +3 Armor for 2 rounds at battle start.',
    tier: 'common',
    type: 'effect',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({
        name: 'Shielded Start',
        kind: 'buff',
        duration: 2,
        modifiers: { armor: 3 },
        _hidden: true
      });
    }
  },
  keenStrike: {
    id: 'keenStrike',
    name: 'Keen Strike I',
    description: 'Basic Attack deals +2 damage.',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerKeenStrike = Math.max(Number(hero._towerKeenStrike || 0), 2); }
  },
  keenStrikeII: {
    id: 'keenStrikeII',
    name: 'Keen Strike II',
    description: 'Basic Attack deals +4 damage.',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => { hero._towerKeenStrike = Math.max(Number(hero._towerKeenStrike || 0), 4); }
  },
  keenStrikeIII: {
    id: 'keenStrikeIII',
    name: 'Keen Strike III',
    description: 'Basic Attack deals +6 damage.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerKeenStrike = Math.max(Number(hero._towerKeenStrike || 0), 6); }
  },
  keenStrikeIV: {
    id: 'keenStrikeIV',
    name: 'Keen Strike IV',
    description: 'Basic Attack deals +8 damage.',
    tier: 'epic',
    type: 'special',
    apply: (hero) => { hero._towerKeenStrike = Math.max(Number(hero._towerKeenStrike || 0), 8); }
  },
  keenStrikeV: {
    id: 'keenStrikeV',
    name: 'Keen Strike V',
    description: 'Basic Attack deals +10 damage.',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => { hero._towerKeenStrike = Math.max(Number(hero._towerKeenStrike || 0), 10); }
  },

  momentum: {
    id: 'momentum',
    name: 'Momentum',
    description: 'Each time you cast, gain +1 Speed (max +2 per battle).',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerMomentum = true; }
  },
  attunement: {
    id: 'attunement',
    name: 'Attunement I',
    description: 'When you change rows, gain +1 Energy and +2 Spell Power for that round.',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => {
      const current = (hero && hero._towerAttunement && typeof hero._towerAttunement === 'object')
        ? hero._towerAttunement
        : {};
      hero._towerAttunement = {
        energy: Math.max(Number(current.energy || 0), 1),
        spellPower: Math.max(Number(current.spellPower || 0), 2)
      };
    }
  },
  attunementII: {
    id: 'attunementII',
    name: 'Attunement II',
    description: 'When you change rows, gain +2 Energy and +3 Spell Power for that round.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      const current = (hero && hero._towerAttunement && typeof hero._towerAttunement === 'object')
        ? hero._towerAttunement
        : {};
      hero._towerAttunement = {
        energy: Math.max(Number(current.energy || 0), 2),
        spellPower: Math.max(Number(current.spellPower || 0), 3)
      };
    }
  },
  focusedColumn: {
    id: 'focusedColumn',
    name: 'Focused Column',
    description: 'Your column spells cost 1 less Energy (min 1) and gain +2 Spell Power.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerFocusedColumn = true; }
  },
  echoCaster: {
    id: 'echoCaster',
    name: 'Echo Caster',
    description: 'First cast each round grants +1 casts to that row next round.',
    tier: 'epic',
    type: 'special',
    apply: (hero) => { hero._towerEchoCaster = true; }
  },
  tacticalSwap: {
    id: 'tacticalSwap',
    name: 'Tactical Swap',
    description: 'When you change rows, heal 5 and gain +2 Armor for that round.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerTacticalSwap = true; }
  },
  arcaneExchange: {
    id: 'arcaneExchange',
    name: 'Arcane Exchange',
    description: 'When you heal an ally, gain +1 Energy and your next damage spell next round gets +2 damage.',
    tier: 'epic',
    type: 'special',
    apply: (hero) => { hero._towerArcaneExchange = true; }
  },
  predatorsPace: {
    id: 'predatorsPace',
    name: 'Predator\'s Pace',
    description: 'If you kill an enemy, gain +2 Energy and heal 4.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerPredatorPace = true; }
  },
  agonyTollI: {
    id: 'agonyTollI',
    name: 'Agony Toll I',
    description: 'First time each round you apply Burn or Bleed, reduce that target\'s Energy by 1 and deal +1 damage (ignores armor).',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => {
      hero._towerAfflictionToll = hero._towerAfflictionToll || { energyDrain: 0, bonusDamage: 0 };
      hero._towerAfflictionToll.energyDrain = Math.max(Number(hero._towerAfflictionToll.energyDrain || 0), 1);
      hero._towerAfflictionToll.bonusDamage = Math.max(Number(hero._towerAfflictionToll.bonusDamage || 0), 1);
    }
  },
  agonyTollII: {
    id: 'agonyTollII',
    name: 'Agony Toll II',
    description: 'First time each round you apply Burn or Bleed, reduce that target\'s Energy by 1 and deal +3 damage (ignores armor).',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerAfflictionToll = hero._towerAfflictionToll || { energyDrain: 0, bonusDamage: 0 };
      hero._towerAfflictionToll.energyDrain = Math.max(Number(hero._towerAfflictionToll.energyDrain || 0), 1);
      hero._towerAfflictionToll.bonusDamage = Math.max(Number(hero._towerAfflictionToll.bonusDamage || 0), 3);
    }
  },
  severanceI: {
    id: 'severanceI',
    name: 'Severance I',
    description: 'When your spell removes a debuff, heal that target for 3.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerSeverance = hero._towerSeverance || { healAmount: 0 };
      hero._towerSeverance.healAmount = Math.max(Number(hero._towerSeverance.healAmount || 0), 3);
    }
  },
  severanceII: {
    id: 'severanceII',
    name: 'Severance II',
    description: 'When your spell removes a debuff, heal that target for 5.',
    tier: 'epic',
    type: 'special',
    apply: (hero) => {
      hero._towerSeverance = hero._towerSeverance || { healAmount: 0 };
      hero._towerSeverance.healAmount = Math.max(Number(hero._towerSeverance.healAmount || 0), 5);
    }
  },

  // ============================================
  // SPELL CAST AUGMENTS - Extra spell uses
  // ============================================
  
  allCastsSmall: {
    id: 'allCastsSmall',
    name: 'Spell Mastery I',
    description: '+{value} to All Spell Casts',
    tier: 'rare',
    type: 'spell',
    valueRange: [1, 1],
    apply: (hero, value) => {
      if (hero.spells?.front) hero.spells.front.casts += value;
      if (hero.spells?.middle) hero.spells.middle.casts += value;
      if (hero.spells?.back) hero.spells.back.casts += value;
    }
  },
  allCastsMedium: {
    id: 'allCastsMedium',
    name: 'Spell Mastery II',
    description: '+{value} to All Spell Casts',
    tier: 'epic',
    type: 'spell',
    valueRange: [2, 2],
    apply: (hero, value) => {
      if (hero.spells?.front) hero.spells.front.casts += value;
      if (hero.spells?.middle) hero.spells.middle.casts += value;
      if (hero.spells?.back) hero.spells.back.casts += value;
    }
  },
  allCastsLarge: {
    id: 'allCastsLarge',
    name: 'Spell Mastery III',
    description: '+{value} to All Spell Casts',
    tier: 'legendary',
    type: 'spell',
    valueRange: [3, 3],
    apply: (hero, value) => {
      if (hero.spells?.front) hero.spells.front.casts += value;
      if (hero.spells?.middle) hero.spells.middle.casts += value;
      if (hero.spells?.back) hero.spells.back.casts += value;
    }
  },

  // ============================================
  // EFFECT AUGMENTS - Apply passive-like effects
  // ============================================
  
  // These add hidden effects that behave like the named effect
  frenzyAugment: {
    id: 'frenzyAugment',
    name: 'Bloodlust',
    description: 'Gains Frenzy (when damaged, gain +1 Energy)',
    tier: 'rare',
    type: 'effect',
    effectName: 'Frenzy',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Frenzy, _hidden: true });
    }
  },
  regenAugment: {
    id: 'regenAugment',
    name: 'Regeneration I',
    description: 'Starts with Regen I (heal 1 each round)',
    tier: 'uncommon',
    type: 'effect',
    effectName: 'RegenI',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Regen, name: 'Regen I', pulse: { type: 'heal', value: 1 }, _hidden: true });
    }
  },
  regenAugmentII: {
    id: 'regenAugmentII',
    name: 'Regeneration II',
    description: 'Starts with Regen II (heal 2 each round)',
    tier: 'rare',
    type: 'effect',
    effectName: 'RegenII',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Regen, name: 'Regen II', pulse: { type: 'heal', value: 2 }, _hidden: true });
    }
  },
  regenAugmentIII: {
    id: 'regenAugmentIII',
    name: 'Regeneration III',
    description: 'Starts with Regen III (heal 3 each round)',
    tier: 'epic',
    type: 'effect',
    effectName: 'RegenIII',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Regen, name: 'Regen III', pulse: { type: 'heal', value: 3 }, _hidden: true });
    }
  },
  regenAugmentIV: {
    id: 'regenAugmentIV',
    name: 'Regeneration IV',
    description: 'Starts with Regen IV (heal 4 each round)',
    tier: 'legendary',
    type: 'effect',
    effectName: 'RegenIV',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Regen, name: 'Regen IV', pulse: { type: 'heal', value: 4 }, _hidden: true });
    }
  },
  regenAugmentV: {
    id: 'regenAugmentV',
    name: 'Regeneration V',
    description: 'Starts with Regen V (heal 5 each round)',
    tier: 'legendary',
    type: 'effect',
    effectName: 'RegenV',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Regen, name: 'Regen V', pulse: { type: 'heal', value: 5 }, _hidden: true });
    }
  },
  quicknessAugment: {
    id: 'quicknessAugment',
    name: 'Quickness I',
    description: 'Starts with Quickness I (+1 Speed, +1 Spell Power)',
    tier: 'uncommon',
    type: 'effect',
    effectName: 'QuicknessI',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Quickness, name: 'Quickness I', modifiers: { speed: 1, spellPower: 1 }, _hidden: true });
    }
  },
  quicknessAugmentII: {
    id: 'quicknessAugmentII',
    name: 'Quickness II',
    description: 'Starts with Quickness II (+2 Speed, +2 Spell Power)',
    tier: 'epic',
    type: 'effect',
    effectName: 'QuicknessII',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Quickness, name: 'Quickness II', modifiers: { speed: 2, spellPower: 2 }, _hidden: true });
    }
  },
  dexterityAugment: {
    id: 'dexterityAugment',
    name: 'Natural Agility',
    description: 'Starts with Dexterity (+1 Armor, +1 Speed)',
    tier: 'uncommon',
    type: 'effect',
    effectName: 'Dexterity',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Dexterity, _hidden: true });
    }
  },
  dexterityAugmentII: {
    id: 'dexterityAugmentII',
    name: 'Natural Agility II',
    description: 'Starts with Dexterity II (+2 Armor, +2 Speed)',
    tier: 'rare',
    type: 'effect',
    effectName: 'DexterityII',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.DexterityII, _hidden: true });
    }
  },
  deathPactAugment: {
    id: 'deathPactAugment',
    name: 'Soul Mirror I',
    description: 'When damaged by an enemy spell, reflect 50% of that damage to the attacker.',
    tier: 'rare',
    type: 'special',
    effectName: 'DeathPact50',
    apply: (hero) => {
      hero._towerDeathPactPercent = Math.max(Number(hero._towerDeathPactPercent || 0), 0.5);
    }
  },
  deathPactAugmentII: {
    id: 'deathPactAugmentII',
    name: 'Soul Mirror II',
    description: 'When damaged by an enemy spell, reflect 75% of that damage to the attacker.',
    tier: 'epic',
    type: 'special',
    effectName: 'DeathPact75',
    apply: (hero) => {
      hero._towerDeathPactPercent = Math.max(Number(hero._towerDeathPactPercent || 0), 0.75);
    }
  },
  deathPactAugmentIII: {
    id: 'deathPactAugmentIII',
    name: 'Soul Mirror III',
    description: 'When damaged by an enemy spell, reflect 100% of that damage to the attacker.',
    tier: 'legendary',
    type: 'special',
    effectName: 'DeathPact100',
    apply: (hero) => {
      hero._towerDeathPactPercent = Math.max(Number(hero._towerDeathPactPercent || 0), 1);
    }
  },
  soulLinkAugment: {
    id: 'soulLinkAugment',
    name: 'Guardian Spirit',
    description: 'Starts with Soul Link (absorbs half damage from adjacent allies)',
    tier: 'uncommon',
    type: 'effect',
    effectName: 'SoulLink',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.SoulLink, _hidden: true });
    }
  },
  tetheredLinkAugment: {
    id: 'tetheredLinkAugment',
    name: 'Tethered Link',
    description: 'Starts with Link (gain 1 Energy whenever another ally, not this hero, casts a spell).',
    tier: 'legendary',
    type: 'effect',
    effectName: 'Link',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Link, _hidden: true });
    }
  },
  lieInWaitAugment: {
    id: 'lieInWaitAugment',
    name: 'Predator Instinct',
    description: 'Starts with Lie In Wait (+2 Spell Power, untargetable by single-target)',
    tier: 'legendary',
    type: 'effect',
    effectName: 'LieInWait',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.LieInWait, _hidden: true });
    }
  },
  lieInWaitLevel5Augment: {
    id: 'lieInWaitLevel5Augment',
    name: 'Predator Instinct (Level 5)',
    description: 'Starts with Lie In Wait for 1 round (+2 Spell Power, untargetable by single-target)',
    tier: 'legendary',
    type: 'effect',
    bossExclusive: true,
    effectName: 'LieInWaitLevel5',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.LieInWaitLevel5, _hidden: true });
    }
  },
  retributionAugment: {
    id: 'retributionAugment',
    name: 'Vengeful Spirit',
    description: 'Starts with Retribution (deals 3 damage when targeted)',
    tier: 'epic',
    type: 'effect',
    effectName: 'Retribution',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Retribution, _hidden: true });
    }
  },
  prayerAugment: {
    id: 'prayerAugment',
    name: 'Divine Connection',
    description: 'Starts with Prayer (heals allies when damaged)',
    tier: 'rare',
    type: 'effect',
    effectName: 'Prayer',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Prayer, _hidden: true });
    }
  },
  prayerAugmentII: {
    id: 'prayerAugmentII',
    name: 'Divine Connection II',
    description: 'Starts with Prayer II (heals allies for 2 when damaged)',
    tier: 'epic',
    type: 'effect',
    effectName: 'PrayerII',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.PrayerII, _hidden: true });
    }
  },
  ironForgeAugment: {
    id: 'ironForgeAugment',
    name: 'Forged Soul',
    description: 'Starts with Iron Forge (+1 Armor, +1 Spell Power)',
    tier: 'rare',
    type: 'effect',
    effectName: 'IronForge',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.IronForge, _hidden: true });
    }
  },
  ironForgeAugmentII: {
    id: 'ironForgeAugmentII',
    name: 'Forged Soul II',
    description: 'Starts with Iron Forge II (+2 Armor, +2 Spell Power)',
    tier: 'epic',
    type: 'effect',
    effectName: 'IronForgeII',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.IronForgeII, _hidden: true });
    }
  },

  // ============================================
  // DEBUFF AUGMENTS - Spells apply debuffs
  // ============================================
  
  burningSpellsFront: {
    id: 'burningSpellsFront',
    name: 'Scorching Front',
    description: 'Front spell applies Burn to enemies',
    tier: 'common',
    type: 'debuff',
    slot: 'front',
    debuffName: 'Burn',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.front = hero._towerDebuffAugments.front || [];
      hero._towerDebuffAugments.front.push('Burn');
    }
  },
  burningSpellsAll: {
    id: 'burningSpellsAll',
    name: 'Infernal Touch',
    description: 'All spells apply Burn to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'all',
    debuffName: 'Burn',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      ['front', 'middle', 'back'].forEach(slot => {
        hero._towerDebuffAugments[slot] = hero._towerDebuffAugments[slot] || [];
        hero._towerDebuffAugments[slot].push('Burn');
      });
    }
  },
  poisonSpellsMiddle: {
    id: 'poisonSpellsMiddle',
    name: 'Venomous Middle',
    description: 'Middle spell applies Poison to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'middle',
    debuffName: 'Poison',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.middle = hero._towerDebuffAugments.middle || [];
      hero._towerDebuffAugments.middle.push('Poison');
    }
  },
  poisonSpellsAll: {
    id: 'poisonSpellsAll',
    name: 'Toxic Mastery',
    description: 'All spells apply Poison to enemies',
    tier: 'rare',
    type: 'debuff',
    slot: 'all',
    debuffName: 'Poison',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      ['front', 'middle', 'back'].forEach(slot => {
        hero._towerDebuffAugments[slot] = hero._towerDebuffAugments[slot] || [];
        hero._towerDebuffAugments[slot].push('Poison');
      });
    }
  },

  bleedSpellsBack: {
    id: 'bleedSpellsBack',
    name: 'Serrated Back',
    description: 'Back spell applies Bleed to enemies',
    tier: 'common',
    type: 'debuff',
    slot: 'back',
    debuffName: 'Bleed',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.back = hero._towerDebuffAugments.back || [];
      hero._towerDebuffAugments.back.push('Bleed');
    }
  },
  bleedSpellsAll: {
    id: 'bleedSpellsAll',
    name: 'Hemorrhage',
    description: 'All spells apply Bleed to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'all',
    debuffName: 'Bleed',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      ['front', 'middle', 'back'].forEach(slot => {
        hero._towerDebuffAugments[slot] = hero._towerDebuffAugments[slot] || [];
        hero._towerDebuffAugments[slot].push('Bleed');
      });
    }
  },

  curseSpellsFront: {
    id: 'curseSpellsFront',
    name: 'Cursed Front',
    description: 'Front spell applies Curse (-1 Spell Power) to enemies',
    tier: 'common',
    type: 'debuff',
    slot: 'front',
    debuffName: 'Curse',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.front = hero._towerDebuffAugments.front || [];
      hero._towerDebuffAugments.front.push('Curse');
    }
  },
  curseSpellsAll: {
    id: 'curseSpellsAll',
    name: 'Hex Master',
    description: 'All spells apply Curse (-1 Spell Power) to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'all',
    debuffName: 'Curse',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      ['front', 'middle', 'back'].forEach(slot => {
        hero._towerDebuffAugments[slot] = hero._towerDebuffAugments[slot] || [];
        hero._towerDebuffAugments[slot].push('Curse');
      });
    }
  },

  slowSpellsFront: {
    id: 'slowSpellsFront',
    name: 'Chilling Front',
    description: 'Front spell applies Slowed (-1 Speed) to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'front',
    debuffName: 'Slowed',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.front = hero._towerDebuffAugments.front || [];
      hero._towerDebuffAugments.front.push('Slowed');
    }
  },
  slowSpellsAll: {
    id: 'slowSpellsAll',
    name: 'Frozen Touch',
    description: 'All spells apply Slowed (-1 Speed) to enemies',
    tier: 'rare',
    type: 'debuff',
    slot: 'all',
    debuffName: 'Slowed',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      ['front', 'middle', 'back'].forEach(slot => {
        hero._towerDebuffAugments[slot] = hero._towerDebuffAugments[slot] || [];
        hero._towerDebuffAugments[slot].push('Slowed');
      });
    }
  },

  // ============================================
  // SPECIAL AUGMENTS - Unique powerful effects
  // ============================================
  
  vampiric: {
    id: 'vampiric',
    name: 'Vampiric I',
    description: 'Heal for 50% of damage dealt (rounded down)',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerVampiricPercent = Math.max(Number(hero._towerVampiricPercent || 0), 0.5);
    }
  },
  vampiricII: {
    id: 'vampiricII',
    name: 'Vampiric II',
    description: 'Heal for 75% of damage dealt (rounded down)',
    tier: 'epic',
    type: 'special',
    apply: (hero) => {
      hero._towerVampiricPercent = Math.max(Number(hero._towerVampiricPercent || 0), 0.75);
    }
  },
  vampiricIII: {
    id: 'vampiricIII',
    name: 'Vampiric III',
    description: 'Heal for 100% of damage dealt (rounded down)',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerVampiricPercent = Math.max(Number(hero._towerVampiricPercent || 0), 1);
    }
  },
  
  executioner: {
    id: 'executioner',
    name: 'Executioner I',
    description: '+25% damage to targets below 70% health',
    tier: 'common',
    type: 'special',
    apply: (hero) => {
      hero._towerExecutionerPercent = Math.max(Number(hero._towerExecutionerPercent || 0), 0.25);
    }
  },
  executionerII: {
    id: 'executionerII',
    name: 'Executioner II',
    description: '+50% damage to targets below 70% health',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => {
      hero._towerExecutionerPercent = Math.max(Number(hero._towerExecutionerPercent || 0), 0.5);
    }
  },
  executionerIII: {
    id: 'executionerIII',
    name: 'Executioner III',
    description: '+75% damage to targets below 70% health',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerExecutionerPercent = Math.max(Number(hero._towerExecutionerPercent || 0), 0.75);
    }
  },
  executionerIV: {
    id: 'executionerIV',
    name: 'Executioner IV',
    description: '+100% damage to targets below 70% health',
    tier: 'epic',
    type: 'special',
    apply: (hero) => {
      hero._towerExecutionerPercent = Math.max(Number(hero._towerExecutionerPercent || 0), 1);
    }
  },

  armorBreaker: {
    id: 'armorBreaker',
    name: 'Armor Breaker',
    description: 'Your damage ignores Armor',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerIgnoreArmor = true;
    }
  },

  lastStand: {
    id: 'lastStand',
    name: 'Last Stand',
    description: '+8 Spell Power when below 40% health',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerLastStand = true;
    }
  },

  firstStrike: {
    id: 'firstStrike',
    name: 'First Strike I',
    description: '+25% Attack Power on first spell cast each battle',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => {
      hero._towerFirstStrikePercent = Math.max(Number(hero._towerFirstStrikePercent || 0), 0.25);
    }
  },
  firstStrikeII: {
    id: 'firstStrikeII',
    name: 'First Strike II',
    description: '+50% Attack Power on first spell cast each battle',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerFirstStrikePercent = Math.max(Number(hero._towerFirstStrikePercent || 0), 0.5);
    }
  },
  firstStrikeIII: {
    id: 'firstStrikeIII',
    name: 'First Strike III',
    description: '+75% Attack Power on first spell cast each battle',
    tier: 'epic',
    type: 'special',
    apply: (hero) => {
      hero._towerFirstStrikePercent = Math.max(Number(hero._towerFirstStrikePercent || 0), 0.75);
    }
  },
  firstStrikeIV: {
    id: 'firstStrikeIV',
    name: 'First Strike IV',
    description: '+100% Attack Power on first spell cast each battle',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerFirstStrikePercent = Math.max(Number(hero._towerFirstStrikePercent || 0), 1);
    }
  },

  energySurgeStrike: {
    id: 'energySurgeStrike',
    name: 'Energy Surge Strike',
    description: 'Basic Attack deals +{value} damage per Energy spent.',
    tier: 'rare',
    type: 'special',
    valueRange: [1, 1],
    apply: (hero, value) => {
      hero._towerBasicAttackPerEnergy = Math.max(Number(hero._towerBasicAttackPerEnergy || 0), Number(value || 0));
    }
  },

  thorns: {
    id: 'thorns',
    name: 'Thorns',
    description: 'Deal 1 damage to attackers when hit',
    tier: 'uncommon',
    type: 'special',
    apply: (hero) => {
      hero._towerThorns = (hero._towerThorns || 0) + 1;
    }
  },

  thornsStrong: {
    id: 'thornsStrong',
    name: 'Spiny Defense',
    description: 'Deal 2 damage to attackers when hit',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerThorns = (hero._towerThorns || 0) + 2;
    }
  },

  shatteredChampionsCrown: {
    id: 'shatteredChampionsCrown',
    name: 'Crown of Shattered Champions',
    description: 'Reduce all incoming damage by 25%',
    tier: 'legendary',
    type: 'special',
    bossExclusive: true,
    valueRange: [0.25, 0.25],
    apply: (hero, value) => {
      const reduction = Math.max(0, Math.min(0.95, Number(value || 0)));
      const currentMultiplier = Number.isFinite(Number(hero._towerIncomingDamageMultiplier))
        ? Number(hero._towerIncomingDamageMultiplier)
        : 1;
      hero._towerIncomingDamageMultiplier = Math.max(0, currentMultiplier * (1 - reduction));
    }
  },

  voidShieldI: {
    id: 'voidShieldI',
    name: 'Void Shield I',
    description: 'Reduce incoming damage by {value} (after armor)',
    tier: 'rare',
    type: 'special',
    valueRange: [1, 1],
    apply: (hero, value) => {
      hero._towerVoidShield = (hero._towerVoidShield || 0) + Number(value || 0);
    }
  },

  voidShieldII: {
    id: 'voidShieldII',
    name: 'Void Shield II',
    description: 'Reduce incoming damage by {value} (after armor)',
    tier: 'epic',
    type: 'special',
    valueRange: [2, 2],
    apply: (hero, value) => {
      hero._towerVoidShield = (hero._towerVoidShield || 0) + Number(value || 0);
    }
  },

  periodicPulseI: {
    id: 'periodicPulseI',
    name: 'Sustained Pulse I',
    description: '+{value} to periodic damage and healing effects',
    tier: 'uncommon',
    type: 'special',
    valueRange: [1, 1],
    apply: (hero, value) => {
      hero._towerPeriodicPulseBonus = (hero._towerPeriodicPulseBonus || 0) + Number(value || 0);
    }
  },

  periodicPulseII: {
    id: 'periodicPulseII',
    name: 'Sustained Pulse II',
    description: '+{value} to periodic damage and healing effects',
    tier: 'epic',
    type: 'special',
    valueRange: [2, 2],
    apply: (hero, value) => {
      hero._towerPeriodicPulseBonus = (hero._towerPeriodicPulseBonus || 0) + Number(value || 0);
    }
  },

  periodicPulseIII: {
    id: 'periodicPulseIII',
    name: 'Sustained Pulse III',
    description: '+{value} to periodic damage and healing effects',
    tier: 'legendary',
    type: 'special',
    valueRange: [3, 3],
    apply: (hero, value) => {
      hero._towerPeriodicPulseBonus = (hero._towerPeriodicPulseBonus || 0) + Number(value || 0);
    }
  },

  doubleStrike: {
    id: 'doubleStrike',
    name: 'Double Strike',
    description: '50% chance to cast spell twice',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerDoubleStrike = 0.5;
    }
  },

  phoenixRebirth: {
    id: 'phoenixRebirth',
    name: 'Phoenix Rebirth',
    description: 'Revive once per battle with 25% health',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerPhoenix = true;
    }
  },

  spellEcho: {
    id: 'spellEcho',
    name: 'Spell Echo',
    description: 'Back spell casts twice',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerSpellEcho = 'back';
    }
  },

  absolvingGrace: {
    id: 'absolvingGrace',
    name: 'Absolving Grace',
    description: 'At end of round: cleanse 1 debuff and heal {value}.',
    tier: 'legendary',
    type: 'special',
    bossExclusive: true,
    valueRange: [5, 5],
    apply: (hero, value) => {
      hero._towerRoundCleanseHeal = Number(value || 0);
    }
  },

  astralDominion: {
    id: 'astralDominion',
    name: 'Astral Dominion',
    description: 'At end of round: each debuffed enemy loses 1 Energy and takes {value} true damage; gain 1 Energy per enemy affected.',
    tier: 'legendary',
    type: 'special',
    bossExclusive: true,
    valueRange: [3, 3],
    apply: (hero, value) => {
      hero._towerAstralDominionDamage = Number(value || 0);
    }
  }
};

/**
 * Get random augments for a given tower level
 * @param {number} level - Current tower level
 * @param {number} count - Number of augments to return
 * @param {string[]} excludeIds - Augment IDs to exclude (already owned)
 * @returns {Array} Array of augment objects with rolled values
 */
export function getRandomAugments(level, count = 3, excludeIds = [], options = {}) {
  const availableAugments = Object.values(AUGMENTS).filter(aug => {
    const tierInfo = AUGMENT_TIERS[aug.tier];
    const includeBossExclusive = !!options.includeBossExclusive;
    const isBossExclusive = !!aug.bossExclusive;
    return level >= tierInfo.minLevel
      && !excludeIds.includes(aug.id)
      && (!isBossExclusive || includeBossExclusive);
  });

  if (availableAugments.length === 0) return [];

  const weighted = [];
  availableAugments.forEach(aug => {
    const weight = getAugmentTierWeight(aug.tier, level);
    
    for (let i = 0; i < weight; i++) {
      weighted.push(aug);
    }
  });

  const selected = [];
  const usedIds = new Set();
  
  while (selected.length < count && weighted.length > 0) {
    const idx = Math.floor(Math.random() * weighted.length);
    const aug = weighted[idx];
    
    if (!usedIds.has(aug.id)) {
      usedIds.add(aug.id);
      
      // Roll value if applicable
      let value = null;
      if (aug.valueRange) {
        const [min, max] = aug.valueRange;
        value = min + Math.floor(Math.random() * (max - min + 1));
      }
      
      selected.push({
        ...aug,
        rolledValue: value,
        description: aug.description.replace('{value}', value || '')
      });
    }
    
    // Remove all instances of this augment from weighted pool
    for (let i = weighted.length - 1; i >= 0; i--) {
      if (weighted[i].id === aug.id) weighted.splice(i, 1);
    }
  }

  if (options && options.forceUncommonIfAllCommon && selected.length > 0) {
    const allCommon = selected.every(aug => aug && aug.tier === 'common');
    if (allCommon) {
      const uncommonPool = Object.values(AUGMENTS).filter(aug => {
        if (!aug || aug.tier !== 'uncommon') return false;
        if (excludeIds.includes(aug.id)) return false;
        return !selected.some(sel => sel && sel.id === aug.id);
      });
      if (uncommonPool.length > 0) {
        const swapIndex = Math.floor(selected.length / 2);
        const pick = uncommonPool[Math.floor(Math.random() * uncommonPool.length)];
        let value = null;
        if (pick.valueRange) {
          const [min, max] = pick.valueRange;
          value = min + Math.floor(Math.random() * (max - min + 1));
        }
        selected[swapIndex] = {
          ...pick,
          rolledValue: value,
          description: pick.description.replace('{value}', value || '')
        };
      }
    }
  }

  return selected;
}

/**
 * Apply augments to a hero
 * @param {Object} hero - Hero object to modify
 * @param {Array} augments - Array of augment objects with rolledValue
 */
export function applyAugmentsToHero(hero, augments) {
  if (!augments || !Array.isArray(augments)) return;
  
  augments.forEach(aug => {
    if (aug.apply) {
      aug.apply(hero, aug.rolledValue);
    }
  });
}

export default { AUGMENTS, AUGMENT_TIERS, getAugmentTierWeight, getRandomAugments, applyAugmentsToHero };
