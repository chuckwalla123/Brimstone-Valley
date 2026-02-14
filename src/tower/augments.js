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
 */

export const AUGMENT_TIERS = {
  common: { minLevel: 1, weight: 100 },
  uncommon: { minLevel: 3, weight: 60 },
  rare: { minLevel: 8, weight: 30 },
  epic: { minLevel: 15, weight: 15 },
  legendary: { minLevel: 22, weight: 5 }
};

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
    valueRange: [1, 3],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostMedium: {
    id: 'healthBoostMedium',
    name: 'Vitality II',
    description: '+{value} Health',
    tier: 'uncommon',
    type: 'stat',
    valueRange: [3, 6],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostLarge: {
    id: 'healthBoostLarge',
    name: 'Vitality III',
    description: '+{value} Health',
    tier: 'rare',
    type: 'stat',
    valueRange: [5, 10],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostHuge: {
    id: 'healthBoostHuge',
    name: 'Vitality IV',
    description: '+{value} Health',
    tier: 'epic',
    type: 'stat',
    valueRange: [8, 15],
    apply: (hero, value) => { hero.health += value; hero.currentHealth += value; }
  },
  healthBoostMassive: {
    id: 'healthBoostMassive',
    name: 'Vitality V',
    description: '+{value} Health',
    tier: 'legendary',
    type: 'stat',
    valueRange: [12, 20],
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
    valueRange: [1, 2],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },
  armorBoostLarge: {
    id: 'armorBoostLarge',
    name: 'Fortitude III',
    description: '+{value} Armor',
    tier: 'rare',
    type: 'stat',
    valueRange: [2, 3],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },
  armorBoostHuge: {
    id: 'armorBoostHuge',
    name: 'Fortitude IV',
    description: '+{value} Armor',
    tier: 'epic',
    type: 'stat',
    valueRange: [3, 4],
    apply: (hero, value) => { hero.armor += value; hero.currentArmor = (hero.currentArmor || hero.armor) + value; }
  },
  armorBoostMassive: {
    id: 'armorBoostMassive',
    name: 'Fortitude V',
    description: '+{value} Armor',
    tier: 'legendary',
    type: 'stat',
    valueRange: [4, 5],
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
    valueRange: [1, 2],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },
  speedBoostLarge: {
    id: 'speedBoostLarge',
    name: 'Swiftness III',
    description: '+{value} Speed',
    tier: 'rare',
    type: 'stat',
    valueRange: [2, 3],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },
  speedBoostHuge: {
    id: 'speedBoostHuge',
    name: 'Swiftness IV',
    description: '+{value} Speed',
    tier: 'epic',
    type: 'stat',
    valueRange: [3, 4],
    apply: (hero, value) => { hero.speed += value; hero.currentSpeed = (hero.currentSpeed || hero.speed) + value; }
  },
  speedBoostMassive: {
    id: 'speedBoostMassive',
    name: 'Swiftness V',
    description: '+{value} Speed',
    tier: 'legendary',
    type: 'stat',
    valueRange: [4, 5],
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
    valueRange: [1, 2],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },
  spellPowerBoostLarge: {
    id: 'spellPowerBoostLarge',
    name: 'Arcane Power III',
    description: '+{value} Spell Power',
    tier: 'rare',
    type: 'stat',
    valueRange: [2, 3],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },
  spellPowerBoostHuge: {
    id: 'spellPowerBoostHuge',
    name: 'Arcane Power IV',
    description: '+{value} Spell Power',
    tier: 'epic',
    type: 'stat',
    valueRange: [3, 4],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },
  spellPowerBoostMassive: {
    id: 'spellPowerBoostMassive',
    name: 'Arcane Power V',
    description: '+{value} Spell Power',
    tier: 'legendary',
    type: 'stat',
    valueRange: [4, 5],
    apply: (hero, value) => { hero.spellPower = (hero.spellPower || 0) + value; hero.currentSpellPower = (hero.currentSpellPower || hero.spellPower || 0) + value; }
  },

  // Starting Energy augments
  energyBoostSmall: {
    id: 'energyBoostSmall',
    name: 'Quickstart I',
    description: '+{value} Starting Energy',
    tier: 'uncommon',
    type: 'stat',
    valueRange: [1, 2],
    apply: (hero, value) => { hero.energy += value; hero.currentEnergy = (hero.currentEnergy || hero.energy) + value; }
  },
  energyBoostMedium: {
    id: 'energyBoostMedium',
    name: 'Quickstart II',
    description: '+{value} Starting Energy',
    tier: 'rare',
    type: 'stat',
    valueRange: [2, 4],
    apply: (hero, value) => { hero.energy += value; hero.currentEnergy = (hero.currentEnergy || hero.energy) + value; }
  },
  energyBoostLarge: {
    id: 'energyBoostLarge',
    name: 'Quickstart III',
    description: '+{value} Starting Energy',
    tier: 'epic',
    type: 'stat',
    valueRange: [4, 6],
    apply: (hero, value) => { hero.energy += value; hero.currentEnergy = (hero.currentEnergy || hero.energy) + value; }
  },

  // ============================================
  // EARLY-TIER SPECIAL AUGMENTS
  // ============================================

  earlySparkI: {
    id: 'earlySparkI',
    name: 'Early Spark I',
    description: 'In round 1, spells gain +{value} Spell Power.',
    tier: 'common',
    type: 'special',
    valueRange: [2, 2],
    apply: (hero, value) => { hero._towerEarlySpark = value; }
  },
  earlySparkII: {
    id: 'earlySparkII',
    name: 'Early Spark II',
    description: 'In round 1, spells gain +{value} Spell Power.',
    tier: 'uncommon',
    type: 'special',
    valueRange: [4, 4],
    apply: (hero, value) => { hero._towerEarlySpark = value; }
  },
  earlySparkIII: {
    id: 'earlySparkIII',
    name: 'Early Spark III',
    description: 'In round 1, spells gain +{value} Spell Power.',
    tier: 'rare',
    type: 'special',
    valueRange: [6, 6],
    apply: (hero, value) => { hero._towerEarlySpark = value; }
  },
  earlySparkIV: {
    id: 'earlySparkIV',
    name: 'Early Spark IV',
    description: 'In round 1, spells gain +{value} Spell Power.',
    tier: 'epic',
    type: 'special',
    valueRange: [8, 8],
    apply: (hero, value) => { hero._towerEarlySpark = value; }
  },
  frontlineVanguard: {
    id: 'frontlineVanguard',
    name: 'Frontline Vanguard',
    description: 'If placed in the front row: +1 starting Energy and +1 front-row casts.',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerFrontlineVanguard = true; }
  },
  rearguard: {
    id: 'rearguard',
    name: 'Rearguard',
    description: 'If placed in the back row: +1 starting Energy and +1 back-row casts.',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerRearguard = true; }
  },
  shieldedStart: {
    id: 'shieldedStart',
    name: 'Shielded Start',
    description: 'Gain +2 Armor for 2 rounds at battle start.',
    tier: 'common',
    type: 'effect',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({
        name: 'Shielded Start',
        kind: 'buff',
        duration: 2,
        modifiers: { armor: 2 },
        _hidden: true
      });
    }
  },
  warmUp: {
    id: 'warmUp',
    name: 'Warm-Up',
    description: 'After your first cast each round, gain +1 Energy.',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerWarmUp = true; }
  },
  keenStrike: {
    id: 'keenStrike',
    name: 'Keen Strike',
    description: 'Basic Attack deals +1 damage.',
    tier: 'common',
    type: 'special',
    apply: (hero) => { hero._towerKeenStrike = 1; }
  },

  momentum: {
    id: 'momentum',
    name: 'Momentum',
    description: 'Each time you cast, gain +1 Speed (max +2 per battle).',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerMomentum = true; }
  },
  attunement: {
    id: 'attunement',
    name: 'Attunement',
    description: 'When you change rows, gain +1 Energy and +1 Spell Power for that round.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerAttunement = true; }
  },
  focusedColumn: {
    id: 'focusedColumn',
    name: 'Focused Column',
    description: 'Your column spells cost 1 less Energy (min 1).',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerFocusedColumn = true; }
  },
  echoCaster: {
    id: 'echoCaster',
    name: 'Echo Caster',
    description: 'First cast each round grants +1 casts to that row next round.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerEchoCaster = true; }
  },
  tacticalSwap: {
    id: 'tacticalSwap',
    name: 'Tactical Swap',
    description: 'When you change rows, gain +2 Armor for that round.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerTacticalSwap = true; }
  },
  arcaneExchange: {
    id: 'arcaneExchange',
    name: 'Arcane Exchange',
    description: 'When you heal an ally, gain +1 Energy and your next damage spell next round gets +2 damage.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerArcaneExchange = true; }
  },
  predatorsPace: {
    id: 'predatorsPace',
    name: 'Predator\'s Pace',
    description: 'If you kill an enemy, gain +2 Speed next round.',
    tier: 'rare',
    type: 'special',
    apply: (hero) => { hero._towerPredatorPace = true; }
  },

  // ============================================
  // SPELL CAST AUGMENTS - Extra spell uses
  // ============================================
  
  frontCastsSmall: {
    id: 'frontCastsSmall',
    name: 'Front Line Expertise I',
    description: '+{value} Front Spell Casts',
    tier: 'uncommon',
    type: 'spell',
    valueRange: [1, 1],
    apply: (hero, value) => { if (hero.spells?.front) hero.spells.front.casts += value; }
  },
  frontCastsMedium: {
    id: 'frontCastsMedium',
    name: 'Front Line Expertise II',
    description: '+{value} Front Spell Casts',
    tier: 'rare',
    type: 'spell',
    valueRange: [1, 2],
    apply: (hero, value) => { if (hero.spells?.front) hero.spells.front.casts += value; }
  },
  frontCastsLarge: {
    id: 'frontCastsLarge',
    name: 'Front Line Expertise III',
    description: '+{value} Front Spell Casts',
    tier: 'epic',
    type: 'spell',
    valueRange: [2, 3],
    apply: (hero, value) => { if (hero.spells?.front) hero.spells.front.casts += value; }
  },

  middleCastsSmall: {
    id: 'middleCastsSmall',
    name: 'Mid Line Expertise I',
    description: '+{value} Middle Spell Casts',
    tier: 'uncommon',
    type: 'spell',
    valueRange: [1, 1],
    apply: (hero, value) => { if (hero.spells?.middle) hero.spells.middle.casts += value; }
  },
  middleCastsMedium: {
    id: 'middleCastsMedium',
    name: 'Mid Line Expertise II',
    description: '+{value} Middle Spell Casts',
    tier: 'rare',
    type: 'spell',
    valueRange: [1, 2],
    apply: (hero, value) => { if (hero.spells?.middle) hero.spells.middle.casts += value; }
  },
  middleCastsLarge: {
    id: 'middleCastsLarge',
    name: 'Mid Line Expertise III',
    description: '+{value} Middle Spell Casts',
    tier: 'epic',
    type: 'spell',
    valueRange: [2, 3],
    apply: (hero, value) => { if (hero.spells?.middle) hero.spells.middle.casts += value; }
  },

  backCastsSmall: {
    id: 'backCastsSmall',
    name: 'Back Line Expertise I',
    description: '+{value} Back Spell Casts',
    tier: 'uncommon',
    type: 'spell',
    valueRange: [1, 1],
    apply: (hero, value) => { if (hero.spells?.back) hero.spells.back.casts += value; }
  },
  backCastsMedium: {
    id: 'backCastsMedium',
    name: 'Back Line Expertise II',
    description: '+{value} Back Spell Casts',
    tier: 'rare',
    type: 'spell',
    valueRange: [1, 2],
    apply: (hero, value) => { if (hero.spells?.back) hero.spells.back.casts += value; }
  },
  backCastsLarge: {
    id: 'backCastsLarge',
    name: 'Back Line Expertise III',
    description: '+{value} Back Spell Casts',
    tier: 'epic',
    type: 'spell',
    valueRange: [2, 3],
    apply: (hero, value) => { if (hero.spells?.back) hero.spells.back.casts += value; }
  },

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
    valueRange: [1, 2],
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
    valueRange: [2, 3],
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
    name: 'Regeneration',
    description: 'Starts with Regen (heal 1 each round)',
    tier: 'uncommon',
    type: 'effect',
    effectName: 'Regen',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Regen, _hidden: true });
    }
  },
  dexterityAugment: {
    id: 'dexterityAugment',
    name: 'Natural Agility',
    description: 'Starts with Dexterity (+1 Armor, +1 Speed)',
    tier: 'rare',
    type: 'effect',
    effectName: 'Dexterity',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.Dexterity, _hidden: true });
    }
  },
  deathPactAugment: {
    id: 'deathPactAugment',
    name: 'Soul Mirror',
    description: 'Starts with Death Pact (reflects damage taken)',
    tier: 'epic',
    type: 'effect',
    effectName: 'DeathPact',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.DeathPact, _hidden: true });
    }
  },
  soulLinkAugment: {
    id: 'soulLinkAugment',
    name: 'Guardian Spirit',
    description: 'Starts with Soul Link (absorbs half damage from adjacent allies)',
    tier: 'epic',
    type: 'effect',
    effectName: 'SoulLink',
    apply: (hero) => {
      hero._towerEffects = hero._towerEffects || [];
      hero._towerEffects.push({ ...EFFECTS.SoulLink, _hidden: true });
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

  // ============================================
  // DEBUFF AUGMENTS - Spells apply debuffs
  // ============================================
  
  burningSpellsFront: {
    id: 'burningSpellsFront',
    name: 'Scorching Front',
    description: 'Front spell applies Burn to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'front',
    debuffName: 'Burn',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.front = hero._towerDebuffAugments.front || [];
      hero._towerDebuffAugments.front.push('Burn');
    }
  },
  burningSpellsMiddle: {
    id: 'burningSpellsMiddle',
    name: 'Scorching Middle',
    description: 'Middle spell applies Burn to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'middle',
    debuffName: 'Burn',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.middle = hero._towerDebuffAugments.middle || [];
      hero._towerDebuffAugments.middle.push('Burn');
    }
  },
  burningSpellsBack: {
    id: 'burningSpellsBack',
    name: 'Scorching Back',
    description: 'Back spell applies Burn to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'back',
    debuffName: 'Burn',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.back = hero._towerDebuffAugments.back || [];
      hero._towerDebuffAugments.back.push('Burn');
    }
  },
  burningSpellsAll: {
    id: 'burningSpellsAll',
    name: 'Infernal Touch',
    description: 'All spells apply Burn to enemies',
    tier: 'rare',
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

  poisonSpellsFront: {
    id: 'poisonSpellsFront',
    name: 'Venomous Front',
    description: 'Front spell applies Poison to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'front',
    debuffName: 'Poison',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.front = hero._towerDebuffAugments.front || [];
      hero._towerDebuffAugments.front.push('Poison');
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

  bleedSpellsFront: {
    id: 'bleedSpellsFront',
    name: 'Serrated Front',
    description: 'Front spell applies Bleed to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'front',
    debuffName: 'Bleed',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.front = hero._towerDebuffAugments.front || [];
      hero._towerDebuffAugments.front.push('Bleed');
    }
  },
  bleedSpellsMiddle: {
    id: 'bleedSpellsMiddle',
    name: 'Serrated Middle',
    description: 'Middle spell applies Bleed to enemies',
    tier: 'uncommon',
    type: 'debuff',
    slot: 'middle',
    debuffName: 'Bleed',
    apply: (hero) => {
      hero._towerDebuffAugments = hero._towerDebuffAugments || {};
      hero._towerDebuffAugments.middle = hero._towerDebuffAugments.middle || [];
      hero._towerDebuffAugments.middle.push('Bleed');
    }
  },
  bleedSpellsAll: {
    id: 'bleedSpellsAll',
    name: 'Hemorrhage',
    description: 'All spells apply Bleed to enemies',
    tier: 'rare',
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
    tier: 'rare',
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
    tier: 'epic',
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
    name: 'Vampiric',
    description: 'Heal for 25% of damage dealt (rounded down)',
    tier: 'epic',
    type: 'special',
    apply: (hero) => {
      hero._towerVampiric = true;
    }
  },
  
  executioner: {
    id: 'executioner',
    name: 'Executioner',
    description: '+50% damage to targets below 50% health',
    tier: 'epic',
    type: 'special',
    apply: (hero) => {
      hero._towerExecutioner = true;
    }
  },

  lastStand: {
    id: 'lastStand',
    name: 'Last Stand',
    description: '+3 Spell Power when below 25% health',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerLastStand = true;
    }
  },

  firstStrike: {
    id: 'firstStrike',
    name: 'First Strike',
    description: '+50% damage on first spell cast each battle',
    tier: 'rare',
    type: 'special',
    apply: (hero) => {
      hero._towerFirstStrike = true;
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

  voidShieldIII: {
    id: 'voidShieldIII',
    name: 'Void Shield III',
    description: 'Reduce incoming damage by {value} (after armor)',
    tier: 'legendary',
    type: 'special',
    valueRange: [3, 3],
    apply: (hero, value) => {
      hero._towerVoidShield = (hero._towerVoidShield || 0) + Number(value || 0);
    }
  },

  doubleStrike: {
    id: 'doubleStrike',
    name: 'Double Strike',
    description: '20% chance to cast spell twice',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerDoubleStrike = 0.2;
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
    description: 'Back spell casts twice (uses 2 casts)',
    tier: 'legendary',
    type: 'special',
    apply: (hero) => {
      hero._towerSpellEcho = 'back';
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
    return level >= tierInfo.minLevel && !excludeIds.includes(aug.id);
  });

  if (availableAugments.length === 0) return [];

  // Weight by tier - higher levels have better chances for rare augments
  const levelBonus = Math.floor(level / 5); // Every 5 levels, better augments more likely
  
  const weighted = [];
  availableAugments.forEach(aug => {
    const tierInfo = AUGMENT_TIERS[aug.tier];
    // Base weight + bonus for higher levels making rare augments more common
    let weight = tierInfo.weight;
    if (aug.tier === 'rare') weight += levelBonus * 5;
    if (aug.tier === 'epic') weight += levelBonus * 10;
    if (aug.tier === 'legendary') weight += levelBonus * 15;
    
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

export default { AUGMENTS, AUGMENT_TIERS, getRandomAugments, applyAugmentsToHero };
