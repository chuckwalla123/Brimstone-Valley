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
    name: 'Poison', image: '/images/effects/Poison.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 2 }
  },
  CloudedPoison: {
    name: 'Clouded Poison', kind: 'debuff', duration: 2, pulse: { type: 'damage', value: 2 }
  },
  Marked: {
    name: 'Marked', image: '/images/effects/Mark.png', kind: 'debuff', duration: 'permanent',
    description: 'A debuff that makes this hero vulnerable to Assassin abilities.'
  },
  WildfireTurret: {
    name: 'Wildfire Turret', kind: 'neutral', duration: 3, trigger: 'onRoundStart', spellSpec: { targets: [{ type: 'projectile', side: 'enemy' }], formula: { type: 'attackPower', value: 3 } }
  },
  Burn: { name: 'Burn', image: '/images/effects/Burn.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 1 } },
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
  Slowed: { name: 'Slowed', image: '/images/effects/Slowed.png', kind: 'debuff', duration: 'permanent', modifiers: { speed: -1 } },
  Shielded: { name: 'Shielded', kind: 'buff', duration: 2, modifiers: { armor: 3 } },
  // Dragon Scales: passive forcing Armor to 0 and Speed to 1 while active.
  DragonScales: {
    name: 'Dragon Scales', kind: 'passive', duration: 'permanent',
    // `force` is interpreted by `recomputeModifiers` to override computed stats.
    force: { armor: 0, speed: 1 },
    description: "Passive: Dragon's Armor is always 0 and Speed is always 1."
  },
  // Dragon Year: applied to caster on spell cast by Dragonling via spell post hook.
  // Increases Spell Power by 2 and Armor by 1 for a short duration.
  DragonYear: {
    name: 'Dragon Year', image: '/images/effects/Dragon Year.png', kind: 'buff', duration: 'permanent',
    modifiers: { spellPower: 2, armor: 1 },
    description: 'Permanent: grants +2 Spell Power and +1 Armor.'
  },
  BulwarkAura: { name: 'Bulwark Aura', kind: 'buff', duration: 2, modifiers: { armor: 1, speed: 1 } },
  Haste: { name: 'Haste', kind: 'buff', duration: 2, modifiers: { speed: 2 } },
  BlessedRegen: { name: 'Blessed Regen', kind: 'buff', duration: 2, pulse: { type: 'heal', value: 1 } },
  Regen: { name: 'Regen', image: '/images/effects/Regen.png', kind: 'buff', duration: 10, pulse: { type: 'heal', value: 1 } },
  Dexterity: { name: 'Dexterity', image: '/images/effects/Dexterity.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 1, speed: 1 } },
  WatcherPrayer: { name: 'Watcher Prayer', kind: 'buff', duration: 'permanent', onDeath: { type: 'healAlliesExceptSelf', value: 3 } },
  VengefulWards: { name: 'Vengeful Wards', kind: 'neutral', duration: 3, onTargeted: { type: 'damage', value: 2 } },
  Bleed: { name: 'Bleed', image: '/images/effects/bleed.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 1 }, description: 'Deals 1 Damage at the beginning of each round.' },
  Leech: { name: 'Leech', image: '/images/effects/Leech.png', kind: 'debuff', duration: 'permanent', pulse: { type: 'damage', value: 3 } },
  Elixir: { name: 'Elixir', image: '/images/effects/Elixir.png', kind: 'buff', duration: 'permanent', modifiers: { speed: 1, armor: 1, spellPower: 1 } },
  // Lie In Wait: grants +2 Spell Power and prevents single-target spells from targeting the affected hero for 5 rounds
  LieInWait: { name: 'Lie In Wait', image: '/images/effects/Lie in Wait.png', kind: 'buff', duration: 5, modifiers: { spellPower: 2 }, preventSingleTarget: true, description: 'Grants +2 Spell Power and makes the affected hero untargetable by single-target spells for 5 rounds.' },
  IronForge: { name: 'Iron Forge', image: '/images/effects/Iron Forge.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 1, spellPower: 1 } },
  SentryPyre: { name: 'Sentry Pyre', kind: 'neutral', duration: 4, trigger: 'onRoundStart', spellSpec: { targets: [{ type: 'projectile', side: 'enemy' }], formula: { type: 'attackPower', value: 2 } } },
  ScavengedInsight: { name: 'Scavenged Insight', kind: 'buff', duration: 2, modifiers: { spellPower: 1 } },
  ExplosiveTrap: { name: 'Explosive Trap', kind: 'neutral', duration: 3, trigger: 'onRoundStart', spellSpec: { targets: [{ type: 'projectile', side: 'enemy' }], formula: { type: 'attackPower', value: 3 } } },
  LesserWard: { name: 'Lesser Ward', kind: 'buff', duration: 1, modifiers: { armor: 2 } }
  ,
  ArmorUp: { name: 'Armor Up', image: '/images/effects/Armor Up.png', kind: 'buff', duration: 'permanent', modifiers: { armor: 2 }, description: 'Increases Armor by 2.' }
  ,
  Strength: { name: 'Strength',image: '/images/effects/Strength.png', kind: 'buff', duration: 'permanent', modifiers: { spellPower: 1 } },
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
    description: 'Passive: Each time this hero takes damage, they gain +1 Energy (engine hook not implemented).' },
  UndyingRage: {
    name: 'Undying Rage', kind: 'passive', duration: 'permanent',
    description: 'Passive: The first instance of damage that would have killed this hero instead reduces them to 1 Health. One-time use.'
  }
};

// Rejuvenate: heals its host each round for 1 HP for 10 rounds
EFFECTS.Rejuvenate = {
  name: 'Rejuvenate', image: '/images/effects/Rejuvenate.png', kind: 'buff', duration: 10,
  pulse: { type: 'heal', value: 2 },
  description: 'Heals host for 2 at the start of each round for 10 rounds.'
};

// Dark Knight: Treachery effect — deals damage equal to the target's Armor at round start.
EFFECTS.Treachery = {
  name: 'Treachery', image: '/images/effects/Treachery.png', kind: 'debuff', duration: 'permanent',
  description: "At the start of each round this debuff deals damage equal to the affected Hero's current Armor.",
  // `pulse` is set as a marker; engine support for dynamic 'armor'-based pulses will be implemented separately.
  pulse: { type: 'damage', value: 0, derivedFrom: 'armor' }
};

// Prayer effect: when the effected hero is damaged, heal all allies except the effected hero.
EFFECTS.Prayer = { name: 'Prayer', image: '/images/effects/Prayer.png', kind: 'buff', duration: 'permanent', onDamaged: { type: 'healAlliesExceptSelf', value: 1 } };

// Death Pact: when the effected hero is damaged by an enemy spell, return
// equal damage to the attacking enemy (reflect). `onDamaged.value` uses
// the special marker string 'equal' to indicate the reaction should mirror
// the actual damage taken rather than a fixed numeric value.
EFFECTS.DeathPact = { name: 'Death Pact', image: '/images/effects/Death Pact.png', kind: 'buff', duration: 'permanent', onDamaged: { type: 'damage', value: 'equal' } };
  
// Curse: decreases Spell Power by 1 on the affected target
EFFECTS.Curse = { name: 'Curse', image: '/images/effects/Curse.png', kind: 'debuff', duration: 'permanent', modifiers: { spellPower: -1 } };
// Counter: retaliate when damaged by an enemy spell. Deals fixed damage to the attacker.
EFFECTS.Counter = {
  name: 'Counter', image: '/images/effects/Counter.png', kind: 'buff', duration: 'permanent',
  onDamaged: { type: 'damage', value: 2 },
  description: 'When the effected Hero is damaged by an enemy spell, deal 2 damage to that attacker.'
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
