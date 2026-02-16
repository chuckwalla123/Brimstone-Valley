// src/effects.js
// Centralized effect and passive definitions referenced by spells and heroes.
// Duration semantics:
// - Numeric `duration` values are decremented at end-of-round and the effect
//   is removed when `duration <= 0`.
// - `duration: null` (or missing/non-numeric) means the effect is permanent
//   and stays until explicitly removed, the hero dies, or it is bumped off
//   by adding a 5th effect (oldest removed).
// - The engine also accepts explicit markers when applying effects: use
//   `duration: 'permanent'` or `'forever'` (or `Infinity` / `-1`) and the
//   effect will be normalized to permanent on application.

export const EFFECTS = {
  Poison: {
    name: 'Poison', image: '/images/effects/Poison.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 2 },
    description: 'Deals 2 damage at the beginning of each round.'
  },
  CloudedPoison: {
    name: 'Clouded Poison', kind: 'debuff', duration: 2, pulse: { type: 'damage', value: 2 },
    description: 'Deals 2 damage at the beginning of each round for 2 rounds.'
  },
  Marked: {
    name: 'Marked', image: '/images/effects/Mark.png', kind: 'debuff', duration: 'permanent',
    description: 'A debuff that makes this hero vulnerable to Assassin abilities.'
  },
  WildfireTurret: {
    name: 'Wildfire Turret', kind: 'neutral', duration: 3, trigger: 'onRoundStart', spellSpec: { targets: [{ type: 'projectile', side: 'enemy' }], formula: { type: 'attackPower', value: 3 } },
    description: 'At the start of each round, fires a projectile for 3 damage at a random enemy for 3 rounds.'
  },
  Burn: { name: 'Burn', image: '/images/effects/Burn.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 1 }, description: 'Deals 1 damage at the beginning of each round.' },
  Wildfire: {
    name: 'Wildfire', image: '/images/effects/Wild Fire.png', kind: 'debuff', duration: 'permanent',
    pulse: { type: 'damage', value: 1 },
    spreadEffectToAdjacentOnPulse: { effect: 'Wildfire' },
    description: 'At the beginning of each round, first deals 1 damage to this hero, then applies Wildfire to adjacent heroes.'
  },
  HeatingUp: {
    name: 'Heating Up',
    image: '/images/effects/Heating Up.png',
    kind: 'buff',
    duration: 'permanent',
    // When this hero casts a spell, apply Burn to all targeted enemies
    onCastApplyEffectToTargets: { effect: 'Burn', side: 'enemy' },
    description: 'Spells cast by this hero apply Burn to all targeted enemies.'
  },
  Acid: { 
    name: 'Acid', 
    image: '/images/effects/Acid.png', 
    kind: 'debuff', 
    duration: 'permanent', 
    pulse: { type: 'damage', value: 1, derivedFrom: 'roundNumber' },
    description: 'Deals damage equal to the current round number at the beginning of each round.'
  },
  ArmorMelt: {
    name: 'Armor Melt',
    image: '/images/effects/Armor Melt.png',
    kind: 'debuff',
    duration: 'permanent',
    modifiers: { armor: -1 },
    pulse: { type: 'damage', value: 1 },
    description: 'Reduces Armor by 1 and deals 1 damage at the beginning of each round.'
  },
  Slowed: { name: 'Slowed', image: '/images/effects/Slowed.png', kind: 'debuff', duration: 'permanent', modifiers: { speed: -1 }, description: 'Reduces Speed by 1.' },
  Shielded: { name: 'Shielded', kind: 'buff', duration: 2, modifiers: { armor: 3 }, description: 'Grants +3 Armor for 2 rounds.' },
  // Dragon Scales: passive that allows Armor/Speed to scale with augments.
  DragonScales: {
    name: 'Dragon Scales', kind: 'passive', duration: 'permanent',
    description: "Passive: Dragon's Armor and Speed can scale with augments."
  },
  // Dragon Year: applied to caster on spell cast by Dragonling via spell post hook.
  // Increases Spell Power by 2 and Armor by 1 for a short duration.
  DragonYear: {
    name: 'Dragon Year', image: '/images/effects/Dragon Year.png', kind: 'buff', duration: 'permanent',
    modifiers: { spellPower: 2, armor: 1 },
    description: 'Permanent: grants +2 Spell Power and +1 Armor.'
  },
  BulwarkAura: { name: 'Bulwark Aura', kind: 'buff', duration: 2, modifiers: { armor: 1, speed: 1 }, description: 'Grants +1 Armor and +1 Speed for 2 rounds.' },
  Haste: { name: 'Haste', kind: 'buff', duration: 2, modifiers: { speed: 2 }, description: 'Grants +2 Speed for 2 rounds.' },
  SpeedUp: { name: 'Speed up', image: '/images/effects/Speed.png', kind: 'buff', duration: 'permanent', modifiers: { speed: 1 }, description: 'Increases Speed by 1.' },
  Quickness: { name: 'Quickness', image: '/images/effects/Quickness.png', kind: 'buff', duration: 'permanent', modifiers: { speed: 1, spellPower: 1 }, description: 'Increases Speed and Spell Power by 1.' },
  BlessedRegen: { name: 'Blessed Regen', kind: 'buff', duration: 2, pulse: { type: 'heal', value: 1 }, description: 'Heals 1 at the beginning of each round for 2 rounds.' },
  Regen: { name: 'Regen', image: '/images/effects/Regen.png', kind: 'buff', duration: 10, pulse: { type: 'heal', value: 1 }, description: 'Heals 1 at the beginning of each round for 10 rounds.' },
  Spores: {
    name: 'Spores', image: '/images/effects/Spores.png', kind: 'debuff', duration: 'permanent',
    pulse: { type: 'damage', value: 1 },
    healApplierOnPulse: { amount: 1 },
    description: 'Deals 1 damage at the beginning of each round and heals the applier for 1.'
  },
  ProtectiveGrowth: {
    name: 'Protective Growth', image: '/images/effects/Protective Growth.png', kind: 'buff', duration: 'permanent',
    forceMultiTargetToSelf: true,
    description: 'Enemy multi-target spells are redirected to this hero.'
  },
  Dexterity: { name: 'Dexterity', image: '/images/effects/Dexterity.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 1, speed: 1 }, description: 'Permanently grants +1 Armor and +1 Speed.' },
  WatcherPrayer: { name: 'Watcher Prayer', kind: 'buff', duration: 'permanent', onDeath: { type: 'healAlliesExceptSelf', value: 3 }, description: 'On death, heals all allies except self for 3.' },
  VengefulWards: { name: 'Vengeful Wards', kind: 'neutral', duration: 3, onTargeted: { type: 'damage', value: 2 }, description: 'When targeted, deal 2 damage back for 3 rounds.' },
  Bleed: { name: 'Bleed', image: '/images/effects/bleed.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 1 }, description: 'Deals 1 Damage at the beginning of each round.' },
  Leech: { name: 'Leech', image: '/images/effects/Leech.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 3 }, description: 'Deals 3 damage at the beginning of each round.' },
  Elixir: { name: 'Elixir', image: '/images/effects/Elixir.png', kind: 'buff', duration: 'permanent', modifiers: { speed: 1, armor: 1, spellPower: 1 }, description: 'Permanently grants +1 Speed, +1 Armor, and +1 Spell Power.' },
  // Lie In Wait: grants +2 Spell Power and prevents single-target spells from targeting the affected hero for 5 rounds
  LieInWait: { name: 'Lie In Wait', image: '/images/effects/Lie in Wait.png', kind: 'buff', duration: 5, modifiers: { spellPower: 2 }, preventSingleTarget: true, description: 'Grants +2 Spell Power and makes the affected hero untargetable by single-target spells for 5 rounds.' },
  LieInWaitLevel5: { name: 'Lie In Wait', image: '/images/effects/Lie in Wait.png', kind: 'buff', duration: 1, modifiers: { spellPower: 2 }, preventSingleTarget: true, description: 'Grants +2 Spell Power and makes the affected hero untargetable by single-target spells for 1 round.' },
  Fade: { name: 'Fade', image: '/images/effects/Fade.png', kind: 'buff', duration: 5, modifiers: { spellPower: 1 }, preventSingleTarget: true, description: 'Grants +1 Spell Power and makes the affected hero untargetable by single-target spells for 5 rounds.' },
  // Taunt: forces single-target enemy spells to target this hero
  Taunt: { name: 'Taunt', image: '/images/effects/Taunt.png', kind: 'buff', duration: 'permanent', taunt: true, description: 'Forces single-target enemy spells to target this Hero.' },
  Loyalty: {
    name: 'Loyalty',
    image: '/images/effects/Loyalty.png',
    kind: 'buff',
    duration: 'permanent',
    redirectSingleTargetToEffectApplier: true,
    description: 'If an enemy single-target spell would target this hero, it targets the Shield Maiden who applied Loyalty instead (if able).'
  },
  Defend: {
    name: 'Defend',
    image: '/images/effects/Defend.png',
    kind: 'buff',
    duration: 'permanent',
    modifiers: { armor: 1 },
    blocksProjectileAndColumn: true,
    description: 'Increases Armor by 1 and nullifies projectile and column attacks that would hit this hero.'
  },
  // Subjugation: single-target spells cast by this hero always target lowest Armor
  Subjugation: { name: 'Subjugation', image: '/images/effects/Subjugation.png', kind: 'buff', duration: 'permanent', forceSingleTargetLowestArmor: true, description: 'Single-target spells cast by this hero always target the lowest Armor.' },
  IronForge: { name: 'Iron Forge', image: '/images/effects/Iron Forge.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 1, spellPower: 1 }, description: 'Permanently grants +1 Armor and +1 Spell Power.' },
  GiveAQuest: {
    name: 'Give A Quest',
    image: '/images/effects/Give A Quest.png',
    kind: 'buff',
    duration: 'permanent',
    onKill: { heal: 2, applyEffect: 'IronForge' },
    description: 'When this hero gets a killing blow, heal 2 and gain Iron Forge.'
  },
  SentryPyre: { name: 'Sentry Pyre', kind: 'neutral', duration: 4, trigger: 'onRoundStart', spellSpec: { targets: [{ type: 'projectile', side: 'enemy' }], formula: { type: 'attackPower', value: 2 } }, description: 'At the start of each round, fires a projectile for 2 damage at a random enemy for 4 rounds.' },
  ScavengedInsight: { name: 'Scavenged Insight', kind: 'buff', duration: 2, modifiers: { spellPower: 1 }, description: 'Grants +1 Spell Power for 2 rounds.' },
  ExplosiveTrap: { name: 'Explosive Trap', kind: 'neutral', duration: 3, trigger: 'onRoundStart', spellSpec: { targets: [{ type: 'projectile', side: 'enemy' }], formula: { type: 'attackPower', value: 3 } }, description: 'At the start of each round, fires a projectile for 3 damage at a random enemy for 3 rounds.' },
  LesserWard: { name: 'Lesser Ward', kind: 'buff', duration: 1, modifiers: { armor: 2 }, description: 'Grants +2 Armor for 1 round.' }
  ,
  ArmorUp: { name: 'Armor Up', image: '/images/effects/Armor Up.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 2 }, description: 'Increases Armor by 2.' }
  ,
  ArmorDown: { name: 'Armor Down', image: '/images/effects/Armor Down.png', kind: 'debuff', duration: 'permanent', modifiers: { armor: -1 }, description: 'Reduces Armor by 1.' }
  ,
  Armor: { name: 'Armor', image: '/images/effects/Armor.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 1 }, description: 'Increases Armor by 1.' }
  ,
  ArmorBearer: { name: 'Armor Bearer', image: '/images/effects/Armor Bearer.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 3 }, description: 'Increases Armor by 3.' }
  ,
  Overencumbered: {
    name: 'Overencumbered', kind: 'passive', duration: 'permanent',
    maxArmor: 4,
    description: "Passive: This hero's Armor cannot exceed 4."
  }
  ,
  HardFall: {
    name: 'Hard Fall',
    image: '/images/effects/Hard Fall.png',
    kind: 'buff',
    duration: 'permanent',
    onDeath: { type: 'damageEnemiesWithSpeedAtMost', value: 3, maxSpeed: 2, ignoreArmor: true, onlySelf: true },
    description: 'On death, deal 3 damage (ignores Armor) to all enemies with Speed 2 or less.'
  }
  ,
  Strength: { name: 'Strength',image: '/images/effects/Strength.png', kind: 'buff', duration: 'permanent', modifiers: { spellPower: 1 }, description: 'Permanently grants +1 Spell Power.' },
  Bounty: {
    name: 'Bounty', kind: 'passive', duration: 'permanent',
    description: 'Upon dealing a killing blow gain 2 Health and apply Strength (spellPower +1).'
  },
  AcceptContract: {
    name: 'Accept Contract', kind: 'passive', duration: 'permanent',
    // Passive description: if an enemy gains more than 4 energy they gain Mark.
    // Engine hook not implemented here; this serves as a marker for the hero.
    description: 'Passive: If an enemy gains more than 4 Energy they gain Mark.'
  }
  ,
  Smolder: {
    name: 'Smolder',
    kind: 'passive',
    duration: 'permanent',
    // When targeted by an enemy spell, apply Burn to the attacker
    onTargeted: { type: 'applyEffectToAttacker', effect: 'Burn' },
    description: 'Passive: When targeted by an enemy spell, apply Burn to the attacker.'
  },
  Frenzy: {
    name: 'Frenzy', kind: 'passive', duration: 'permanent',
    description: 'Passive: Each time this hero takes damage, they gain +1 Energy.' },
  Lifesteal: {
    name: 'Lifesteal', kind: 'passive', duration: 'permanent',
    healPerDamagedEnemy: 1,
    description: 'Passive: Each time this hero damages an enemy with a spell, heal 1 Health per enemy damaged.'
  },
  UndyingRage: {
    name: 'Undying Rage', kind: 'passive', duration: 'permanent',
    description: 'Passive: The first instance of damage that would have killed this hero instead reduces them to 1 Health. One-time use.'
  },
  Crumble: {
    name: 'Crumble', kind: 'passive', duration: 'permanent',
    description: 'Passive: The first time this hero\'s Health falls below 7, they permanently lose 1 base Armor.'
  },
  MudArmor: {
    name: 'Mud Armor', image: '/images/effects/Mud Armor.png', kind: 'buff', duration: 'permanent',
    modifiers: { armor: 3 },
    description: 'Increases Armor by 3.'
  },
  Regeloop: {
    name: 'Regeloop', kind: 'passive', duration: 'permanent',
    description: 'Passive: Up to 3 times per game, lethal damage instead restores this hero to 4 Health and removes all buffs and debuffs.'
  }
};

// Rejuvenate: heals its host each round for 1 HP for 10 rounds
EFFECTS.Rejuvenate = {
  name: 'Rejuvenate', image: '/images/effects/Rejuvenate.png', kind: 'buff', duration: 10,
  pulse: { type: 'heal', value: 2 },
  description: 'Heals host for 2 at the start of each round for 10 rounds.'
};

EFFECTS.Reap = {
  name: 'Reap', image: '/images/effects/Reap.png', kind: 'buff', duration: 'permanent',
  executeAtOrBelowHealth: 2,
  executeDamage: 999,
  description: 'When an enemy is at 2 or less Health, deal 999 damage to that enemy.'
};

// Dark Knight: Treachery effect — deals damage equal to the target's Armor at round start.
EFFECTS.Treachery = {
  name: 'Treachery', image: '/images/effects/Treachery.png', kind: 'debuff', duration: 'permanent',
  description: "At the start of each round this debuff deals damage equal to the affected Hero's current Armor.",
  // `pulse` is set as a marker; engine support for dynamic 'armor'-based pulses will be implemented separately.
  pulse: { type: 'damage', value: 0, derivedFrom: 'armor' }
};

// Prayer effect: when the effected hero is damaged, heal all allies except the effected hero.
EFFECTS.Prayer = { name: 'Prayer', image: '/images/effects/Prayer.png', kind: 'buff', duration: 'permanent', onDamaged: { type: 'healAlliesExceptSelf', value: 1 }, description: 'When damaged, heal all allies except self for 1.' };

// Death Pact: when the effected hero is damaged by an enemy spell, return
// equal damage to the attacking enemy (reflect). `onDamaged.value` uses
// the special marker string 'equal' to indicate the reaction should mirror
// the actual damage taken rather than a fixed numeric value.
EFFECTS.DeathPact = { name: 'Death Pact', image: '/images/effects/Death Pact.png', kind: 'buff', duration: 'permanent', onDamaged: { type: 'damage', value: 'equal' }, description: 'When damaged by an enemy spell, deal equal damage back to the attacker.' };
  
// Curse: decreases Spell Power by 1 on the affected target
EFFECTS.Curse = { name: 'Curse', image: '/images/effects/Curse.png', kind: 'debuff', duration: 'permanent', modifiers: { spellPower: -1 }, description: 'Reduces Spell Power by 1.' };
// Counter: retaliate when targeted by an enemy spell. Deals fixed damage to the attacker.
EFFECTS.Counter = {
  name: 'Counter', image: '/images/effects/Counter.png', kind: 'buff', duration: 'permanent',
  onTargeted: { type: 'damage', value: 2 },
  description: 'When the effected Hero is targeted by an enemy spell, deal 2 damage to that attacker.'
};

// New effect: damages adjacent enemy tiles at the start of each round.
EFFECTS.AdjacentBlast = {
  name: 'Adjacent Blast', image: '/images/effects/AdjacentBlast.png', kind: 'debuff', duration: 'permanent',
  trigger: 'onRoundStart',
  // Use spellSpec to let the engine resolve targets relative to the effected tile.
  spellSpec: {
    targets: [{ type: 'adjacent', side: 'enemy' }],
    formula: { type: 'attackPower', value: 2 }
  },
  description: 'At the start of each round, this effect damages adjacent enemies for 2.'
};

// Static Shock: similar to AdjacentBlast but named for Lightning Mage; deals 2 damage to adjacent heroes each round.
// Note: Uses 'adjacentToSelf' which resolves adjacent tiles relative to the effect owner (the tile carrying the effect).
// side: 'enemy' means from the applier's perspective, target enemies adjacent to the owner.
EFFECTS.StaticShock = {
  name: 'Static Shock', image: '/images/effects/Static Shock.png', kind: 'debuff', duration: 'permanent',
  trigger: 'onRoundStart',
  spellSpec: {
    targets: [{ type: 'adjacentToSelf', side: 'enemy' }],
    formula: { type: 'damage', value: 2 }
  },
  description: 'Deals 2 damage to adjacent heroes at the beginning of each round.'
};

// Power: increases Spell Power by 2 permanently (Axeman - Sharpen Axe)
EFFECTS.Power = {
  name: 'Power', image: '/images/effects/Power.png', kind: 'buff', duration: 'permanent',
  modifiers: { spellPower: 2 },
  description: 'Increases Spell Power by 2.'
};

// Soul Link: Blood Golem absorbs half damage from adjacent allies
EFFECTS.SoulLink = {
  name: 'Soul Link', image: '/images/effects/Soul Link.png', kind: 'buff', duration: 'permanent',
  description: 'Blood Golem absorbs half the damage that would be taken by adjacent allies rounding up. Soul Link does not stack.',
  // Special onAdjacentDamaged trigger handled in battleEngine
  // When an adjacent ally takes damage, redirect half to this hero
  onAdjacentDamaged: { type: 'redirectHalf' }
};

// Shackle: prevents the affected hero from being moved or swapped during the movement phase
EFFECTS.Shackle = {
  name: 'Shackle',
  image: '/images/effects/Shackle.png',
  kind: 'debuff',
  duration: 'permanent',
  preventMovement: true,
  description: 'Prevents the affected Hero from being moved between Rounds or by any spells.'
};

// Retribution: deals 3 damage to any enemy who targets the effected Hero with a spell
EFFECTS.Retribution = {
  name: 'Retribution',
  image: '/images/effects/Retribution.png',
  kind: 'buff',
  duration: 'permanent',
  onTargeted: { type: 'damage', value: 3 },
  description: 'Deals 3 damage to any enemy who targets the effected Hero with a spell.'
};

export function getEffectByName(name) {
  return EFFECTS[name] || null;
}

export default { EFFECTS, getEffectByName };
