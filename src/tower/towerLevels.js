// src/tower/towerLevels.js
// Level definitions and boss configurations for Tower of Shattered Champions

import { EFFECTS } from '../effects.js';
import { SPELLS } from '../spells.js';

/**
 * Hero pools for different level ranges
 * Pool expands as player progresses
 */

// Levels 1-5: Starting pool of 15 balanced heroes
export const HERO_POOL_TIER_1 = [
  'knightID',        // Tanky, moderate damage
  'archerID',        // Low health, good damage spread
  'clericID',        // Healer support
  'fireMageID',      // AoE damage dealer
  'axemanID',        // Row damage
  'druidID',         // Flexible healer/damage
  'blacksmithID',    // Buffer/armor support
  'lancerID',        // Single target damage
  'iceMageID',       // Control/AoE
  'assassinID',      // Execute style
  'enchantressID',   // Buffer
  'bountyHunterID',  // Single target
  'dragonlingID',    // Scaling damage
  'alchemistID',     // Utility
  'elderID'          // Debuff remover
];

// Levels 6-10: Add 5 more heroes
export const HERO_POOL_TIER_2 = [
  ...HERO_POOL_TIER_1,
  'battleMageID',    // High damage
  'lightningMageID', // Multi-target
  'huntressID',      // Stealth/damage
  'geishaID',        // Control
  'bloodmageID'      // Life steal theme
];

// Levels 11-15: Add 5 more
export const HERO_POOL_TIER_3 = [
  ...HERO_POOL_TIER_2,
  'arcaneMageID',    // Buff removal
  'demonID',         // Risk/reward
  'drunkardID',      // Random damage
  'executionerID',   // Execute
  'darkMageID'       // Armor ignore
];

// Levels 16-20: Add 5 more
export const HERO_POOL_TIER_4 = [
  ...HERO_POOL_TIER_3,
  'angelID',         // Column damage
  'nephilimID',      // Duality/column hybrid
  'jesterID',        // Copy abilities
  'fallenAngelID',   // Curse/counter
  'darkKnightID',    // Armor scaling
  'greenDragonID'    // Poison/control
];

// Levels 21-30: Add remaining
export const HERO_POOL_TIER_5 = [
  ...HERO_POOL_TIER_4,
  'behemothID',      // Monster tank
  'bloodGolemID',    // Monster drain
  'bileCreatureID',  // Monster DoT
  'fireGolemID',     // Monster burn
  'berserkerID'      // Monster damage
];

/**
 * Get hero pool for a given level
 */
export function getHeroPoolForLevel(level) {
  if (level <= 5) return HERO_POOL_TIER_1;
  if (level <= 10) return HERO_POOL_TIER_2;
  if (level <= 15) return HERO_POOL_TIER_3;
  if (level <= 20) return HERO_POOL_TIER_4;
  return HERO_POOL_TIER_5;
}

/**
 * Calculate number of augments enemy should have based on level
 * Player gets 1 augment per level won (3 choices, pick 1)
 * Enemy starts matching and eventually exceeds player
 */
export function getEnemyAugmentCount(level) {
  if (level <= 2) return 0;
  if (level <= 5) return Math.floor(level * 0.5);
  if (level <= 10) return Math.floor(level * 0.7);
  if (level <= 15) return Math.floor(level * 0.85);
  if (level <= 20) return Math.floor(level * 1.0);
  if (level <= 25) return Math.floor(level * 1.1);
  return Math.floor(level * 1.2); // At level 30, enemies have ~36 augments vs player's 29
}

/**
 * Get AI difficulty for a given level
 */
export function getAIDifficultyForLevel(level) {
  return 'easy';
}

// ============================================
// BOSS DEFINITIONS
// ============================================

/**
 * Boss-specific enhanced effects
 * These are stronger versions of normal effects for boss fights
 */
export const BOSS_EFFECTS = {
  // Level 5 Boss Effects
  MightyBurn: {
    ...EFFECTS.Burn,
    name: 'Mighty Burn',
    description: 'Deals 2 damage at the start of each Round.',
    pulse: { type: 'damage', value: 2 }
  },
  
  DeepPoison: {
    ...EFFECTS.Poison,
    name: 'Deep Poison',
    description: 'Deals 4 damage at the start of each Round.',
    pulse: { type: 'damage', value: 4 }
  },

  // Level 10 Boss Effects
  GreaterCurse: {
    ...EFFECTS.Curse,
    name: 'Greater Curse',
    description: 'Reduces Spell Power by 2.',
    statMod: { spellPower: -2 }
  },

  CripplingBleed: {
    ...EFFECTS.Bleed,
    name: 'Crippling Bleed',
    description: 'Deals 2 damage at the start of each Round.',
    pulse: { type: 'damage', value: 2 }
  },

  // Level 15 Boss Effects
  DevastatingBurn: {
    ...EFFECTS.Burn,
    name: 'Devastating Burn',
    description: 'Deals 3 damage at the start of each Round.',
    pulse: { type: 'damage', value: 3 }
  },

  MassiveAcid: {
    ...EFFECTS.Acid,
    name: 'Massive Acid',
    description: 'Deals damage equal to 2× the Round Number at the start of each Round.',
    // Engine would need to check for this multiplier
  },

  // Level 20 Boss Effects
  SupremeCurse: {
    ...EFFECTS.Curse,
    name: 'Supreme Curse',
    description: 'Reduces Spell Power by 3.',
    statMod: { spellPower: -3 }
  },

  DeepSpores: {
    ...EFFECTS.Spores,
    name: 'Deep Spores',
    description: 'Deals 4 damage at the start of each Round and heals the applier for 4.',
    pulse: { type: 'damage', value: 4 },
    healApplierOnPulse: { amount: 4 }
  },

  // Level 25 Boss Effects
  AnnihilatingBurn: {
    ...EFFECTS.Burn,
    name: 'Annihilating Burn',
    description: 'Deals 4 damage at the start of each Round.',
    pulse: { type: 'damage', value: 4 }
  },

  // Level 30 Boss Effects
  DoomCurse: {
    ...EFFECTS.Curse,
    name: 'Doom Curse',
    description: 'Reduces Spell Power by 4.',
    statMod: { spellPower: -4 }
  }
};

/**
 * Boss-specific enhanced spells
 */
export const BOSS_SPELLS = {
  // Level 5 Demon Boss
  level5Curse: {
    ...SPELLS.curse,
    id: 'level5Curse',
    name: 'Greater Curse',
    description: 'Targets the enemy with the least effects, dealing 5 Attack Power ignoring Armor and applying Greater Curse (-2 Spell Power).',
    spec: { 
      ...SPELLS.curse.spec, 
      formula: { type: 'attackPower', value: 5, ignoreArmor: true },
      effects: [BOSS_EFFECTS.GreaterCurse]
    }
  },

  // Level 5 Fire Mage Boss  
  level5FireBolt: {
    ...SPELLS.fireBolt,
    id: 'level5FireBolt',
    name: 'Searing Bolt',
    description: 'Targets the enemy with the highest Health, dealing 6 Attack Power and applying Burn.',
    spec: {
      ...SPELLS.fireBolt.spec,
      formula: { type: 'attackPower', value: 6 },
      effects: [EFFECTS.Burn]
    }
  },

  level5ConsumedByFlames: {
    ...SPELLS.consumedByFlames,
    id: 'level5ConsumedByFlames',
    name: 'Inferno Feast',
    description: 'Targets the enemy with the most Burns and deals Attack Power equal to 6 + the number of Burns.',
    spec: {
      ...SPELLS.consumedByFlames.spec,
      formula: { type: 'attackPower', value: 6, addTargetEffectNameCount: 'Burn', addTargetEffectCountMultiplier: 1 }
    }
  },

  // Level 5 Assassin Boss
  level5PoisonDagger: {
    ...SPELLS.poisonDagger,
    id: 'level5PoisonDagger', 
    name: 'Lethal Dagger',
    description: 'Targets the enemy with the highest Health dealing 6 Attack Power and applying Deep Poison.',
    spec: {
      ...SPELLS.poisonDagger.spec,
      formula: { type: 'attackPower', value: 5 },
      effects: [BOSS_EFFECTS.DeepPoison]
    }
  },

  // Level 10 Lightning Boss
  level10LightningBolt: {
    ...SPELLS.lightningBolt,
    id: 'level10LightningBolt',
    name: 'Thunder Strike',
    description: 'Targets the enemy with the highest Health dealing 12 Attack Power and applies Static Shock.',
    spec: {
      ...SPELLS.lightningBolt.spec,
      formula: { type: 'attackPower', value: 12 }
    }
  },

  // Level 10 Blood Mage Boss
  level10Cut: {
    ...SPELLS.cut,
    id: 'level10Cut',
    name: 'Savage Cut',
    description: 'Targets the enemy with the highest Health, dealing 8 Attack Power and applying Crippling Bleed.',
    spec: {
      ...SPELLS.cut.spec,
      formula: { type: 'attackPower', value: 8 },
      effects: [BOSS_EFFECTS.CripplingBleed]
    }
  },

  // Level 15 Behemoth Boss
  level15BrutalSmash: {
    ...SPELLS.brutalSmash,
    id: 'level15BrutalSmash',
    name: 'Devastating Smash',
    description: 'Targets the enemy with the highest Armor for 12 Attack Power.',
    spec: {
      ...SPELLS.brutalSmash.spec,
      formula: { type: 'attackPower', value: 12 }
    }
  },

  // Level 20 Arcane Mage Boss
  level20ArcaneBlast: {
    ...SPELLS.arcaneBlast,
    id: 'level20ArcaneBlast',
    name: 'Arcane Annihilation',
    description: 'Targets the enemy with the highest Health, dealing 25 Attack Power.',
    spec: {
      ...SPELLS.arcaneBlast.spec,
      formula: { type: 'attackPower', value: 25 }
    }
  },

  level20EntanglingRoots: {
    ...SPELLS.entanglingRoots,
    id: 'level20EntanglingRoots',
    name: 'Entangling Roots',
    description: 'Targets the enemy with the highest Health and deals 8 Attack Power. If the target has 2 or more Armor, applies Deep Spores.',
    spec: {
      ...SPELLS.entanglingRoots.spec,
      formula: { type: 'attackPower', value: 8 },
      post: { applyEffectIfTargetArmorAtLeast: { minArmor: 2, effects: [BOSS_EFFECTS.DeepSpores] } }
    }
  },

  // Level 25 Dark Mage Boss
  level25Gravity: {
    ...SPELLS.gravity,
    id: 'level25Gravity',
    name: 'Crushing Gravity',
    description: "Targets the entire enemy board, dealing 8 + target's Armor (ignores Armor).",
    spec: {
      ...SPELLS.gravity.spec,
      formula: { type: 'attackPower', value: 8, ignoreArmor: true, addTargetArmor: true }
    }
  },

  // Level 30 Elder Boss
  level30Truth: {
    ...SPELLS.truth,
    id: 'level30Truth',
    name: 'Absolute Truth',
    description: 'Targets all enemies with negative effects, dealing 15 Attack Power.',
    spec: {
      ...SPELLS.truth.spec,
      formula: { type: 'attackPower', value: 15 }
    }
  },

  // Level 30 Cleric Boss
  level30SanctifiedPurify: {
    ...SPELLS.purify,
    id: 'level30SanctifiedPurify',
    name: 'Sanctified Purify',
    description: 'Targets the enemy with the most positive effects, dealing 5 Attack Power plus 1 per augment on the target, then removes the top positive effect.',
    spec: {
      ...SPELLS.purify.spec,
      formula: { type: 'attackPower', value: 5, addTargetAugmentCount: true, addTargetAugmentMultiplier: 1 },
      post: { removeTopPositiveEffect: true }
    }
  },

  level30CenserStorm: {
    ...SPELLS.holyFervor,
    id: 'level30CenserStorm',
    name: 'Censer Storm',
    description: 'Targets the enemy row with the most heroes, dealing 6 Attack Power and applying Curse (-1 Spell Power).',
    spec: {
      targets: [{ type: 'rowWithMostHeroes', side: 'enemy' }],
      formula: { type: 'attackPower', value: 6 },
      effects: [EFFECTS.Curse],
      animationMs: 1200
    }
  },

  level30FinalAbsolution: {
    ...SPELLS.holyFervor,
    id: 'level30FinalAbsolution',
    name: 'Null Rite',
    description: 'Targets the enemy with the highest Energy, dealing 8 Attack Power and draining 3 Energy.',
    spec: {
      targets: [{ type: 'highestEnergy', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 8 },
      post: { deltaEnergy: { amount: -3, side: 'enemy', target: 'target' } },
      animationMs: 1200
    }
  },

  // Level 30 Necromancer Boss
  level30GraveCurse: {
    ...SPELLS.curse,
    id: 'level30GraveCurse',
    name: 'Grave Curse',
    description: 'Targets the enemy with the highest Health, dealing 8 Attack Power ignoring Armor and applying Doom Curse (-4 Spell Power).',
    spec: {
      ...SPELLS.curse.spec,
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 8, ignoreArmor: true },
      effects: [BOSS_EFFECTS.DoomCurse]
    }
  },

  level30SoulHarvest: {
    ...SPELLS.truth,
    id: 'level30SoulHarvest',
    name: 'Soul Harvest',
    description: 'Targets all enemies with negative effects, dealing 9 Attack Power. Also heals the caster for 6.',
    spec: {
      ...SPELLS.truth.spec,
      targets: [{ type: 'board', side: 'enemy' }, { type: 'self' }],
      formula: { type: 'attackPower', value: 9 },
      post: { onlyApplyIfHasDebuff: true, secondaryHeal: { amount: 6, side: 'ally', target: 'self' } }
    }
  },

  // Level 30 Dragon Boss
  level30DragonFangs: {
    ...SPELLS.dragonFangs,
    id: 'level30DragonFangs',
    name: 'Rending Fangs',
    description: 'Targets the enemy with the highest Health, dealing 10 Attack Power. Deals +2 per Burn on the target and applies Annihilating Burn.',
    spec: {
      ...SPELLS.dragonFangs.spec,
      formula: { type: 'attackPower', value: 10, addTargetEffectNameCount: 'Burn', addTargetEffectCountMultiplier: 2 },
      effects: [BOSS_EFFECTS.AnnihilatingBurn]
    }
  },

  level30SkyRend: {
    ...SPELLS.dragonsClaw,
    id: 'level30SkyRend',
    name: 'Sky Rend',
    description: 'Targets the enemy with the lowest Armor, dealing 7 Attack Power and applying Annihilating Burn.',
    spec: {
      ...SPELLS.dragonsClaw.spec,
      formula: { type: 'attackPower', value: 7 },
      effects: [BOSS_EFFECTS.AnnihilatingBurn]
    }
  },

  level30Worldfire: {
    ...SPELLS.fireBreath,
    id: 'level30Worldfire',
    name: 'Worldfire Breath',
    description: 'Column attack dealing 8 Attack Power and applying Annihilating Burn. Heals the caster for 4 and grants Dragon Year.',
    spec: {
      ...SPELLS.fireBreath.spec,
      formula: { type: 'attackPower', value: 8 },
      effects: [BOSS_EFFECTS.AnnihilatingBurn],
      post: {
        secondaryHeal: { amount: 4, side: 'ally', target: 'self', ignoreSpellPower: true },
        applyEffectToSelf: { effects: ['DragonYear'] }
      }
    }
  },

  // Level 35 Nephilim Boss
  level35AstralLance: {
    ...SPELLS.dualityStrike,
    id: 'level35AstralLance',
    name: 'Astral Lance',
    description: 'Targets the enemy with the highest Health, dealing 10 Attack Power and healing the caster equal to damage dealt.',
    spec: {
      ...SPELLS.dualityStrike.spec,
      formula: { type: 'attackPower', value: 10 },
      post: { healCasterEqualToDamage: true },
      animationMs: 1100
    }
  },

  level35BloodEdict: {
    ...SPELLS.lifeForALife,
    id: 'level35BloodEdict',
    name: 'Blood Edict',
    description: 'Targets the enemy with the lowest Health, dealing 7 Attack Power. If this kills, heal the lowest ally for 8 and gain 1 Energy.',
    spec: {
      ...SPELLS.lifeForALife.spec,
      formula: { type: 'attackPower', value: 7 },
      post: {
        conditionalSecondaryOnWouldKill: {
          secondarySpec: {
            targets: [{ type: 'lowestHealth', side: 'ally', max: 1 }],
            formula: { type: 'healPower', value: 8 }
          }
        },
        deltaEnergy: { amount: 1, side: 'ally', target: 'self' }
      },
      animationMs: 1200
    }
  },

  level35JudgmentOfTwilight: {
    ...SPELLS.lightAndDark,
    id: 'level35JudgmentOfTwilight',
    name: 'Judgment of Twilight',
    description: 'Deals 7 Attack Power to all enemies and heals all allies for 4.',
    spec: {
      targets: [{ type: 'board', side: 'enemy' }, { type: 'board', side: 'ally' }],
      formula: { type: 'attackPower', value: 7 },
      post: { secondaryHeal: { amount: 4, side: 'ally', target: 'board' } },
      animationMs: 1300
    },
    animation: 'Dark Pillar_2x2_4frames',
    animationSecondary: 'Healing_2x2_4frames',
    animationPlacement: 'inplace'
  },

  // Level 40 The Boss (Phase 1)
  level40Overrule: {
    ...SPELLS.duel,
    id: 'level40Overrule',
    name: 'Double Strike',
    description: 'Targets the enemy with the highest Health, dealing 10 Attack Power + one quarter of the target\'s current Health.',
    spec: {
      targets: [{ type: 'highestHealth', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 13, addTargetCurrentHealthDivisor: 4 },
      animationMs: 1100
    },
    animation: 'Boss Double Strike_2x2_4frames',
    animationPlacement: 'travel',
    hideCasterDuringCast: true,
    animationScaleToCaster: true,
    animationScaleMultiplier: 1.3,
    alignToCasterSpriteCenter: true,
    animationAnchorNudgeX: -10,
    animationAnchorNudgeY: -20
  },

  level40WarMandate: {
    ...SPELLS.avalanche,
    id: 'level40WarMandate',
    name: 'Tremor',
    description: 'Targets each enemy for a random amount of Attack Power between 5 and 20.',
    spec: {
      targets: [{ type: 'board', side: 'enemy' }],
      formula: { type: 'roll', base: 4, die: 16, rollPerTarget: true, suppressRollInfo: true },
      animationMs: 1200
    },
    animation: 'Boss Tremor_2x2_4frames',
    animationSecondary: null,
    animationPlacement: 'travel',
    animationBoardTravel: true,
    animationBoardCenterSingle: true,
    hideCasterDuringCast: true,
    animationScaleToCaster: true,
    animationScaleMultiplier: 1.3,
    showRollAnimation: false,
    alignToCasterSpriteCenter: true,
    animationAnchorNudgeX: -10,
    animationAnchorNudgeY: -20
  },

  level40Kingslaw: {
    ...SPELLS.darkBolt,
    id: 'level40Kingslaw',
    name: 'Dark Energy',
    description: 'Targets the enemy with the most Energy, dealing 6 + target\'s current row casts remaining and ignoring Armor.',
    spec: {
      targets: [{ type: 'highestEnergy', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 9, ignoreArmor: true, addTargetCurrentRowCasts: true },
      animationMs: 1200
    },
    animation: 'Dark Energy_2x2_4frames',
    animationPlacement: 'travel',
    preCastAnimation: 'Boss Dark Energy_2x2_4frames',
    preCastAnimationPlacement: 'inplace',
    preCastAnimationMs: 700,
    preCastAnimationScaleMultiplier: 1.3,
    hideCasterDuringPreCast: true,
    hideCasterDuringCast: false,
    animationScaleToCaster: true,
    animationScaleMultiplier: 1.45,
    alignToCasterSpriteCenter: true,
    animationAnchorNudgeX: 0,
    animationAnchorNudgeY: 0,
    preCastAnimationAnchorNudgeX: -10,
    preCastAnimationAnchorNudgeY: -20
  },

  // Level 40 The Boss (Ghost Phase)
  level40PhantomOverrule: {
    ...SPELLS.slash,
    id: 'level40PhantomOverrule',
    name: 'Ghostly Attack',
    description: 'Targets the enemy with the highest Speed, dealing 12 Attack Power.',
    spec: {
      targets: [{ type: 'highestSpeed', side: 'enemy', max: 1 }],
      formula: { type: 'attackPower', value: 12 },
      animationMs: 1100
    },
    animation: 'Ghost Ghostly Attack_2x2_4frames',
    animationPlacement: 'travel',
    hideCasterDuringCast: true,
    animationScaleToCaster: true,
    animationScaleMultiplier: 1.3,
    alignToCasterSpriteCenter: true,
    animationAnchorNudgeX: -10,
    animationAnchorNudgeY: -20
  },

  level40HauntingMandate: {
    ...SPELLS.meteor,
    id: 'level40HauntingMandate',
    name: 'Ultimate Devastation',
    description: 'Targets the enemy board and the caster for 10 Attack Power.',
    spec: {
      targets: [{ type: 'board', side: 'enemy' }],
      formula: { type: 'attackPower', value: 10 },
      post: { damageCaster: { amount: 10, asAttackPower: true } },
      animationMs: 1200
    },
    animation: 'Ghost Ultimate Devistation_2x2_4frames',
    animationSecondary: null,
    animationPlacement: 'travel',
    animationBoardTravel: true,
    animationBoardCenterSingle: true,
    hideCasterDuringCast: true,
    animationScaleToCaster: true,
    animationScaleMultiplier: 1.3,
    showRollAnimation: false,
    alignToCasterSpriteCenter: true,
    animationAnchorNudgeX: -10,
    animationAnchorNudgeY: -20
  },

  level40NetherKingslaw: {
    ...SPELLS.avalanche,
    id: 'level40NetherKingslaw',
    name: 'Whirlwind',
    description: 'Targets the enemy board for 4 Attack Power and reduces Energy by 3.',
    spec: {
      targets: [{ type: 'board', side: 'enemy' }],
      formula: { type: 'attackPower', value: 4 },
      post: { deltaEnergy: { amount: -3, side: 'enemy', target: 'target' } },
      animationMs: 1300
    },
    animation: 'Ghost Whirlwind Secondary_2x2_4frames',
    animationSecondary: null,
    animationPlacement: 'inplace',
    preCastAnimation: 'Ghost Whirlwind Primary_2x2_4frames',
    preCastAnimationPlacement: 'inplace',
    preCastAnimationMs: 700,
    preCastAnimationScaleMultiplier: 1.3,
    hideCasterDuringPreCast: true,
    hideCasterDuringCast: true,
    animationScaleToCaster: true,
    animationScaleMultiplier: 1.3,
    alignToCasterSpriteCenter: true,
    animationAnchorNudgeX: -10,
    animationAnchorNudgeY: -20,
    preCastAnimationAnchorNudgeX: -10,
    preCastAnimationAnchorNudgeY: -20
  }
};

/**
 * Boss configurations
 * Most boss levels have 3 possible bosses; endgame levels can use single bespoke bosses.
 */
export const BOSSES = {
  // ============================================
  // LEVEL 5 BOSSES
  // ============================================
  level5: [
    {
      id: 'boss_infernal_demon',
      name: 'Infernal Demon',
      baseHeroId: 'demonID',
      imageOverride: '/images/heroes/Infernal Demon Cropped.png',
      spriteChromaKey: true,
      spriteFit: 'contain',
      spriteOffsetY: -10,
      spriteOffsetYPx: -20,
      spriteScale: 1.2,
      title: 'The Corruptor',
      description: 'A demon empowered by dark rituals. His curses are twice as potent.',
      stats: {
        health: 45,
        armor: 2,
        speed: 3,
        energy: 2,
        spellPower: 2
      },
      spells: {
        front: { id: 'siphon', cost: 2, casts: 4 },
        middle: { id: 'level5Curse', cost: 1, casts: 4 },
        back: { id: 'acidPool', cost: 3, casts: 5 }
      },
      passives: [],
      augments: ['keenStrike', 'thornsStrong', 'randomAugment']
    },
    {
      id: 'boss_flame_lord',
      name: 'Flame Lord',
      baseHeroId: 'fireMageID',
      imageOverride: '/images/heroes/Flame Lord Cropped.png',
      spriteChromaKey: true,
      spriteFit: 'contain',
      spriteOffsetY: -10,
      spriteOffsetYPx: -20,
      spriteScale: 1.2,
      title: 'Master of Infernos',
      description: 'A fire mage whose flames burn hotter than any forge.',
      stats: {
        health: 60,
        armor: 1,
        speed: 6,
        energy: 0,
        spellPower: 1
      },
      spells: {
        front: { id: 'fireBomb', cost: 6, casts: 1 },
        middle: { id: 'level5FireBolt', cost: 2, casts: 6 },
        back: { id: 'level5ConsumedByFlames', cost: 2, casts: 12 }
      },
      passives: [],
      augments: ['keenStrike', 'burningSpellsAll', 'randomAugment']
    },
    {
      id: 'boss_shadow_blade',
      name: 'Shadow Blade',
      baseHeroId: 'assassinID',
      imageOverride: '/images/heroes/Shadow Blade Cropped.png',
      spriteChromaKey: true,
      spriteFit: 'contain',
      spriteOffsetY: -10,
      spriteOffsetYPx: -20,
      spriteScale: 1.2,
      title: 'The Silent Death',
      description: 'An assassin whose poisons are legendarily lethal.',
      stats: {
        health: 32,
        armor: 2,
        speed: 5,
        energy: 2,
        spellPower: 2
      },
      spells: {
        front: { id: 'level5PoisonDagger', cost: 2, casts: 5 },
        middle: { id: 'assassinate', cost: 4, casts: 3 },
        back: { id: 'priorityTarget', cost: 3, casts: 2 }
      },
      passives: [],
      augments: ['keenStrike', 'lieInWaitLevel5Augment', 'poisonSpellsAll', 'firstStrike', 'randomAugment']
    }
  ],

  // ============================================
  // LEVEL 10 BOSSES
  // ============================================
  level10: [
    {
      id: 'boss_storm_queen',
      name: 'Storm Queen',
      baseHeroId: 'lightningMageID',
      imageOverride: '/images/heroes/Storm Queen Cropped.png',
      title: 'Herald of Thunder',
      description: 'Commands lightning that strikes with devastating force.',
      stats: {
        health: 73,
        armor: 2,
        speed: 4,
        energy: 2,
        spellPower: 2
      },
      spells: {
        front: { id: 'forkedLightning', cost: 5, casts: 5 },
        middle: { id: 'lightningBolt', cost: 3, casts: 2 },
        back: { id: 'zeusWrath', cost: 12, casts: 1 }
      },
      passives: [],
      augments: ['keenStrike', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_blood_lord',
      name: 'Blood Lord',
      baseHeroId: 'bloodmageID',
      imageOverride: '/images/heroes/Blood Lord Cropped.png',
      title: 'The Sanguine',
      description: 'Drains life from enemies to fuel his dark power.',
      stats: {
        health: 64,
        armor: 4,
        speed: 3,
        energy: 1,
        spellPower: 2
      },
      spells: {
        front: { id: 'cut', cost: 2, casts: 5 },
        middle: { id: 'transfusion', cost: 2, casts: 5 },
        back: { id: 'leech', cost: 2, casts: 6 }
      },
      passives: [EFFECTS.Frenzy],
      augments: ['keenStrike', 'vampiric', 'bleedSpellsAll', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_ice_king',
      name: 'Ice King',
      baseHeroId: 'iceMageID',
      imageOverride: '/images/heroes/Ice King Cropped.png',
      title: 'The Frozen Heart',
      description: 'Her cold magic slows all who oppose her to a crawl.',
      stats: {
        health: 56,
        armor: 4,
        speed: 3,
        energy: 2,
        spellPower: 3
      },
      spells: {
        front: { id: 'coneOfCold', cost: 2, casts: 3 },
        middle: { id: 'iceBolt', cost: 2, casts: 4 },
        back: { id: 'blizzard', cost: 5, casts: 3 }
      },
      passives: [],
      augments: ['keenStrike', 'slowSpellsAll', 'randomAugment', 'randomAugment']
    }
  ],

  // ============================================
  // LEVEL 15 BOSSES
  // ============================================
  level15: [
    {
      id: 'boss_behemoth_prime',
      name: 'Behemoth Prime',
      baseHeroId: 'behemothID',
      imageOverride: '/images/heroes/Behemoth Prime Cropped.png',
      title: 'The Unstoppable',
      description: 'A colossal beast that crushes all in its path.',
      stats: {
        health: 82,
        armor: 6,
        speed: 3,
        energy: 1,
        spellPower: 3
      },
      spells: {
        front: { id: 'brutalSmash', cost: 2, casts: 5 },
        middle: { id: 'monstrousClaws', cost: 2, casts: 5 },
        back: { id: 'roar', cost: 2, casts: 3 }
      },
      passives: [EFFECTS.Regen],
      augments: ['keenStrikeII', 'thornsStrong', 'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_dragon_elder',
      name: 'Dragon Elder',
      baseHeroId: 'greenDragonID',
      imageOverride: '/images/heroes/Dragon Elder Cropped.png',
      title: 'Ancient Wyrm',
      description: 'An ancient dragon whose breath brings death.',
      stats: {
        health: 92,
        armor: 3,
        speed: 3,
        energy: 2,
        spellPower: 3
      },
      spells: {
        front: { id: 'viciousBite', cost: 2, casts: 5 },
        middle: { id: 'poisonBreath', cost: 2, casts: 4 },
        back: { id: 'gale', cost: 3, casts: 3 }
      },
      passives: [EFFECTS.Poison],
      augments: ['keenStrikeII', 'poisonSpellsAll', 'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_fallen_champion',
      name: 'Fallen Champion',
      baseHeroId: 'fallenAngelID',
      imageOverride: '/images/heroes/Fallen Champion Cropped.png',
      title: 'The Betrayer',
      description: 'Once a hero, now corrupted by darkness.',
      stats: {
        health: 40,
        armor: 4,
        speed: 5,
        energy: 1,
        spellPower: 2
      },
      spells: {
        front: { id: 'slash', cost: 2, casts: 8 },
        middle: { id: 'darkPillar', cost: 2, casts: 5 },
        back: { id: 'retribution', cost: 2, casts: 3 }
      },
      passives: [EFFECTS.Retribution],
      augments: ['keenStrikeII', 'curseSpellsAll', 'deathPactAugment',  'randomAugment', 'randomAugment', 'randomAugment']
    }
  ],

  // ============================================
  // LEVEL 20 BOSSES
  // ============================================
  level20: [
    {
      id: 'boss_arcane_overlord',
      name: 'Arcane Overlord',
      baseHeroId: 'arcaneMageID',
      imageOverride: '/images/heroes/Arcane Overlord Cropped.png',
      title: 'Master of Magic',
      description: 'Commands arcane forces beyond mortal comprehension.',
      stats: {
        health: 62,
        armor: 3,
        speed: 6,
        energy: 0,
        spellPower: 3
      },
      spells: {
        front: { id: 'arcaneExplosion', cost: 2, casts: 5 },
        middle: { id: 'arcaneBolt', cost: 2, casts: 6 },
        back: { id: 'level20ArcaneBlast', cost: 4, casts: 3 }
      },
      passives: [],
      augments: ['keenStrikeII', 'doubleStrike', 'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_death_knight',
      name: 'Death Knight',
      baseHeroId: 'darkKnightID',
      imageOverride: '/images/heroes/Death Knight Cropped.png',
      title: 'The Deathless',
      description: 'An undead warrior whose blade drains life.',
      stats: {
        health: 109,
        armor: 5,
        speed: 3,
        energy: 1,
        spellPower: 3
      },
      spells: {
        front: { id: 'darkSlash', cost: 1, casts: 10 }, 
        middle: { id: 'soulCrush', cost: 2, casts: 5 },
        back: { id: 'treachery', cost: 2, casts: 3 }
      },
      passives: [EFFECTS.Frenzy],
      augments: ['keenStrikeII', 'phoenixRebirth', 'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_elemental_fury',
      name: 'Elemental Fury',
      baseHeroId: 'fireMageID',
      title: 'Incarnation of Chaos',
      description: 'A being of pure elemental destruction.',
      imageOverride: '/images/heroes/Elemental Fury Cropped.png',
      stats: {
        health: 71,
        armor: 2,
        speed: 6,
        energy: 0,
        spellPower: 3
      },
      spells: {
        front: { id: 'level20EntanglingRoots', cost: 2, casts: 4 },
        middle: { id: 'blizzard', cost: 4, casts: 4 },
        back: { id: 'meteor', cost: 4, casts: 3 }
      },
      passives: [],
      augments: ['keenStrikeII', 'burningSpellsAll', 'randomAugment', 'randomAugment', 'randomAugment']
    }
  ],

  // ============================================
  // LEVEL 25 BOSSES
  // ============================================
  level25: [
    {
      id: 'boss_void_mage',
      name: 'Void Mage',
      baseHeroId: 'darkMageID',
      imageOverride: '/images/heroes/Void Mage Cropped.png',
      title: 'The Annihilator',
      description: 'Wields the power of the void itself.',
      stats: {
        health: 81,
        armor: 4,
        speed: 5,
        energy: 1,
        spellPower: 2
      },
      spells: {
        front: { id: 'drain', cost: 2, casts: 4 },
        middle: { id: 'darkBolt', cost: 2, casts: 4 },
        back: { id: 'gravity', cost: 4, casts: 4 }
      },
      passives: [],
      augments: ['keenStrikeIII', 'vampiric', 'curseSpellsAll', 'executioner', 'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_blood_golem_alpha',
      name: 'Blood Golem Alpha',
      baseHeroId: 'bloodGolemID',
      imageOverride: '/images/heroes/Blood Golem Alpha Cropped.png',
      title: 'The Immortal',
      description: 'An ancient golem that cannot be destroyed.',
      stats: {
        health: 130,
        armor: 4,
        speed: 4,
        energy: 1,
        spellPower: 4
      },
      spells: {
        front: { id: 'bloodDrain', cost: 2, casts: 7 },
        middle: { id: 'curse', cost: 2, casts: 4 },
        back: { id: 'soulDrain', cost: 2, casts: 5 }
      },
      passives: [],
      augments: ['keenStrikeIII', 'vampiric', 'thornsStrong', 'regenAugment',  'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_celestial_judge',
      name: 'Celestial Judge',
      baseHeroId: 'elderID',
      imageOverride: '/images/heroes/Celestial Judge Cropped.png',
      title: 'The Arbiter',
      description: 'Passes divine judgment on all who oppose.',
      stats: {
        health: 70,
        armor: 4,
        speed: 5,
        energy: 1,
        spellPower: 4
      },
      spells: {
        front: { id: 'malign', cost: 2, casts: 8 },
        middle: { id: 'humility', cost: 2, casts: 5 },
        back: { id: 'truth', cost: 3, casts: 4 }
      },
      passives: [],
      augments: ['keenStrikeIII', 'curseSpellsAll', 'bleedSpellsAll', 'randomAugment', 'randomAugment', 'randomAugment']
    }
  ],

  // ============================================
  // LEVEL 30 BOSSES
  // ============================================
  level30: [
    {
      id: 'boss_sanctified_hierophant',
      name: 'Sanctified Hierophant',
      baseHeroId: 'clericID',
      imageOverride: '/images/heroes/Sanctified Hierophant Cropped.png',
      title: 'The Unyielding Light',
      description: 'A high cleric whose rites purge corruption and punish augmented champions.',
      stats: {
        health: 100,
        armor: 4,
        speed: 4,
        energy: 2,
        spellPower: 2
      },
      spells: {
        front: { id: 'level30SanctifiedPurify', cost: 2, casts: 7 },
        middle: { id: 'level30CenserStorm', cost: 3, casts: 5 },
        back: { id: 'level30FinalAbsolution', cost: 3, casts: 4 }
      },
      passives: [],
      augments: ['keenStrikeIII', 'absolvingGrace', 'randomAugment', 'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_necromancer_king',
      name: 'Necromancer King',
      baseHeroId: 'necromancerID',
      imageOverride: '/images/heroes/Necromancer King Cropped.png',
      title: 'Lord of Bones',
      description: 'A deathlord who commands corpses and drains the living.',
      stats: {
        health: 95,
        armor: 3,
        speed: 5,
        energy: 1,
        spellPower: 0
      },
      spells: {
        front: { id: 'level30GraveCurse', cost: 3, casts: 5 },
        middle: { id: 'level30SoulHarvest', cost: 4, casts: 3 },
        back: { id: 'soulDrain', cost: 3, casts: 3 }
      },
      passives: [EFFECTS.Regen],
      augments: ['keenStrikeIII', 'spellPowerBoostMassive', 'poisonSpellsMiddle', 'randomAugment', 'randomAugment', 'randomAugment', 'randomAugment']
    },
    {
      id: 'boss_primordial_dragon',
      name: 'Prime Wyrm',
      baseHeroId: 'dragonID',
      imageOverride: '/images/heroes/Prime Wyrm Cropped.png',
      title: 'The Worldflame',
      description: 'An ancient dragon whose breath ignites the world itself.',
      stats: {
        health: 145,
        armor: 5,
        speed: 4,
        energy: 3,
        spellPower: 3
      },
      spells: {
        front: { id: 'level30DragonFangs', cost: 2, casts: 6 },
        middle: { id: 'level30SkyRend', cost: 2, casts: 5 },
        back: { id: 'level30Worldfire', cost: 4, casts: 3 }
      },
      passives: [],
      augments: [ 'keenStrikeIII', 'doubleStrike', 'randomAugment', 'randomAugment', 'randomAugment', 'randomAugment']
    }
  ],

  // ============================================
  // LEVEL 35 BOSS (BESPOKE)
  // ============================================
  level35: [
    {
      id: 'boss_astral_nephilim',
      name: 'Astral Nephilim',
      baseHeroId: 'nephilimID',
      imageOverride: '/images/heroes/Astral Nephalim Cropped.png',
      title: 'Scion of Twilight',
      description: 'The Nephilim\'s final doctrine: life and death are merely tools.',
      preFightDialogue: [
        { speaker: 'Astral Nephilim', side: 'right', text: 'As a Nephilim, I\'ve walked the borders of Heaven and Hell… yet neither realm stirs my blood the way battle on this mortal soil does. These humans—fragile, desperate, burning with that last spark of defiance—they remind me what it means to feel alive.' },
        { speaker: 'Astral Nephilim', side: 'right', text: 'When the master brought me here, he promised challengers worthy of legend. Heroes who would carve their names into these sacred halls. But none came. Not one.' },
        { speaker: 'Astral Nephilim', side: 'right', text: 'And now… this is what finally stands before me. You. The so‑called ‘heroes.’ How utterly disappointing.' },
        { speaker: 'Astral Nephilim', side: 'right', text: 'Still… enough of my rambling. My blade aches for glory, and my heart for the clash that follows. Tell me—will you satisfy my hunger for battle?' }
      ],
      stats: {
        health: 170,
        armor: 5,
        speed: 5,
        energy: 2,
        spellPower: 2
      },
      spells: {
        front: { id: 'level35AstralLance', cost: 2, casts: 8 },
        middle: { id: 'level35BloodEdict', cost: 3, casts: 8 },
        back: { id: 'level35JudgmentOfTwilight', cost: 5, casts: 2 }
      },
      passives: [],
      augments: ['keenStrikeIV','absolvingGrace', 'astralDominion', 'curseSpellsAll', 'randomAugment', 'randomAugment', 'randomAugment', 'randomAugment']
    }
  ],

  // ============================================
  // LEVEL 40 BOSS (BESPOKE)
  // ============================================
  level40: [
    {
      id: 'boss_the_boss',
      name: 'The Boss',
      baseHeroId: 'warriorID',
      imageOverride: '/images/heroes/Boss Cropped.png',
      title: 'Lord of the Tower',
      description: 'The final ruler of the Shattered Champions, forged by every floor below.',
      stats: {
        health: 220,
        armor: 6,
        speed: 6,
        energy: 2,
        spellPower: 4
      },
      spells: {
        front: { id: 'level40Overrule', cost: 2, casts: 7 },
        middle: { id: 'level40WarMandate', cost: 4, casts: 2 },
        back: { id: 'level40Kingslaw', cost: 3, casts: 4 }
      },
      passives: [],
      augments: ['keenStrikeIV', 'healthBoostMassive', 'healthBoostMassive', 'doubleStrike'],
      phaseRevive: {
        name: 'The Boss (Ghost)',
        title: 'The Undying Will',
        description: 'His body falls, but his will refuses the grave.',
        imageOverride: '/images/heroes/Boss Ghost Cropped.png',
        stats: {
          health: 180,
          armor: 0,
          speed: 6,
          energy: 0,
          spellPower: 4
        },
        spells: {
          front: { id: 'level40PhantomOverrule', cost: 2, casts: 4 },
          middle: { id: 'level40NetherKingslaw', cost: 3, casts: 2 },
          back: { id: 'level40HauntingMandate', cost: 4, casts: 4 }
        },
        passives: [EFFECTS.Ghost],
        reviveHealthPercent: 0.65
      }
    }
  ]
};

/**
 * Get boss configuration for a level
 * @param {number} level - Boss level (5, 10, 15, 20, 25, 30)
 * @returns {Object|null} Random boss config or null if not a boss level
 */
export function getBossForLevel(level) {
  const bossKey = `level${level}`;
  const bossList = BOSSES[bossKey];
  
  if (!bossList || bossList.length === 0) return null;
  
  // Pick random boss from the pool
  const randomIndex = Math.floor(Math.random() * bossList.length);
  return bossList[randomIndex];
}

/**
 * Check if a level is a boss level
 */
export function isBossLevel(level) {
  const normalizedLevel = Number(level || 0);
  if (normalizedLevel % 5 !== 0 || normalizedLevel > 40) return false;
  const bossKey = `level${normalizedLevel}`;
  return Array.isArray(BOSSES[bossKey]) && BOSSES[bossKey].length > 0;
}

export default {
  HERO_POOL_TIER_1,
  HERO_POOL_TIER_2,
  HERO_POOL_TIER_3,
  HERO_POOL_TIER_4,
  HERO_POOL_TIER_5,
  getHeroPoolForLevel,
  getEnemyAugmentCount,
  getAIDifficultyForLevel,
  BOSSES,
  BOSS_EFFECTS,
  BOSS_SPELLS,
  getBossForLevel,
  isBossLevel
};
