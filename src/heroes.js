// src/heroes.js
import { EFFECTS } from './effects.js';

/**
 * =============================================================================
 * HERO CARD IMAGE READING GUIDE
 * =============================================================================
 * 
 * When reading a hero card image, the stats are positioned as follows:
 * 
 * TOP EDGE (left to right):
 *   1. Health  - top-left corner
 *   2. Armor   - second from left
 *   3. Speed   - third from left  
 *   4. Energy  - fourth from left (rightmost on top)
 * 
 * LEFT EDGE (below health, top to bottom):
 *   5. Front Row Casts  - first number below health
 *   6. Middle Row Casts - second number (spell casts for middle spell)
 *   7. Back Row Casts   - third number (spell casts for back spell)
 * 
 * CENTER OF CARD (Spells):
 *   Each spell section contains (in order):
 *     - Spell Name
 *     - Spell Cost (energy cost to cast)
 *     - Spell Description
 * 
 *   Spells are organized by row:
 *     - front: spell cast when hero is in front row
 *     - middle: spell cast when hero is in middle row
 *     - back: spell cast when hero is in back row
 * 
 * IF there is a green 'M' at the bottom right of the card, this indicates it is a monster type hero.
 * 
 * =============================================================================
 * HERO IMAGE FILE NAMING
 * =============================================================================
 * 
 * Hero images are stored in: /images/heroes/
 * (source files in: src/public/images/heroes/)
 * 
 * Common naming patterns:
 *   - "Hero Name Cropped.jpg"  (most common)
 *   - "Hero Name cropped.jpg"  (lowercase 'cropped')
 *   - "Hero Name Cropped.png"  (PNG format for some)
 *   - "hero name.png"          (lowercase, no 'Cropped')
 *   - "Hero Name.jpg"        (no 'Cropped')
 *   - Occasional misspellings or variations
 * 
 * ALWAYS check the src/public/images/heroes/ folder for the actual filename
 * before creating a new hero entry!
 * 
 * =============================================================================
 * HERO OBJECT STRUCTURE
 * =============================================================================
 * 
 * {
 *   id: 'uniqueHeroID',           // Unique identifier (camelCase + 'ID')
 *   name: 'Hero Name',            // Display name
 *   image: '/images/heroes/Hero Name Cropped.jpg',  // Path to hero image
 *   health: 10,                   // From top-left of card
 *   armor: 2,                     // From top edge, second number
 *   speed: 3,                     // From top edge, third number
 *   energy: 0,                    // From top edge, fourth number (usually 0)
 *   spells: {
 *     front:  { id: 'spellId', cost: X, casts: Y },  // Y = front row casts number
 *     middle: { id: 'spellId', cost: X, casts: Y },  // Y = middle row casts number
 *     back:   { id: 'spellId', cost: X, casts: Y },  // Y = back row casts number
 *   },
 *   description: 'Optional description of the hero'  // Optional
 * }
 * 
 * Optional properties:
 *   - fixedPositional: true      // Bonuses locked at draft time
 *   - positionalModifiers: {}    // Row-specific stat bonuses
 *   - leavesCorpse: false        // Minions can opt out of leaving a corpse on death
 * 
 * =============================================================================
 */

// Active hero set: keep only the core playable heroes used in normal runs.
export const HEROES = [
  /* {
    id: 'testFireballID',
    name: 'Test Fireball',
    image: '/images/heroes/Blacksmith cropped.jpg',
    health: 8,
    armor: 0,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'fireball', cost: 1, casts: 99 },
      middle: { id: 'basicAttack', cost: 1, casts: 99 },
      back: { id: 'basicAttack', cost: 1, casts: 99 },
    },
  }, */
  {
    id: 'lancerID',
    name: 'Lancer',
    image: '/images/heroes/Lancer Cropped.jpg',
    health: 11,
    armor: 2,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'slash', cost: 2, casts: 5 },
      middle: { id: 'pierce', cost: 3, casts: 3 },
      back: { id: 'javelin', cost: 3, casts: 3 },
    },
  },
  {
    id: 'warriorID',
    name: 'Warrior',
    image: '/images/heroes/Warrior Cropped.jpg',
    health: 10,
    armor: 2,
    speed: 3,
    energy: 0,
    passives: [EFFECTS.MonsterSlayer],
    spells: {
      front: { id: 'slash', cost: 2, casts: 6 },
      middle: { id: 'cleave', cost: 3, casts: 3 },
      back: { id: 'armorBreakStrike', cost: 3, casts: 4 },
    },
    description: 'Warrior: Slash [2] targets highest Health for 5; Cleave [3] hits the frontmost enemy row for 5; Armor Break [3] targets highest Armor for 4 and applies Armor Break (-2 Armor). Passive Monster Slayer: +1 Spell Power against monster targets.'
  },
  {
    id: 'samuraiID',
    name: 'Samurai',
    image: '/images/heroes/Samurai cropped.jpg',
    health: 10,
    armor: 2,
    speed: 3,
    energy: 1,
    spells: {
      front: { id: 'masamune', cost: 2, casts: 5 },
      middle: { id: 'harakiri', cost: 3, casts: 1 },
      back: { id: 'honor', cost: 5, casts: 3 },
    },
    description: 'Samurai: Masamune [2] targets nearest enemy for 4 Attack Power; Harakiri [3] deals 14 damage to the caster and applies Speed up (+1 Speed) to all allies; Honor [5] hits the highest-health enemy for 4 Attack Power 3 times.'
  },
  {
    id: 'riderID',
    name: 'Rider',
    image: '/images/heroes/Rider Cropped.jpg',
    health: 8,
    armor: 2,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'blackArrows', cost: 3, casts: 3 },
      middle: { id: 'engage', cost: 3, casts: 4 },
      back: { id: 'flank', cost: 6, casts: 3 },
    },
    description: 'Rider: Black Arrows [3] projectile for 5 Attack Power; Engage [3] column attack for 4 Attack Power; Flank [6] targets enemy row with the most Heroes for 5 Attack Power.'
  },
  {
    id: 'elementalistID',
    name: 'Elementalist',
    image: '/images/heroes/Elementalist Cropped.jpg',
    health: 9,
    armor: 0,
    speed: 2,
    energy: 0,
    // fixedPositional: bonuses are determined by the row she is drafted into and do not change
    fixedPositional: true,
    positionalModifiers: {
      front: { armor: 3 },
      middle: { speed: 2 },
      back: { spellPower: 2 },
      reserve: { energy: 4 }
    },
    spells: {
      front: { id: 'boulder', cost: 3, casts: 3 },
      middle: { id: 'vortex', cost: 4, casts: 3 },
      back: { id: 'blaze', cost: 6, casts: 2 },
    },
    description: 'Elementalist: positional elemental bonuses based on drafting row (fixed at draft time).'
  },
  {
    id: 'blacksmithID',
    name: 'Blacksmith',
    image: '/images/heroes/Blacksmith cropped.jpg',
    health: 7,
    armor: 2,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'hammer', cost: 2, casts: 5 },
      middle: { id: 'ironForge', cost: 2, casts: 4 },
      back: { id: 'moltenPour', cost: 3, casts: 4 },
    },
  },
  {
    id: 'arcaneMageID',
    name: 'Arcane Mage',
    image: '/images/heroes/Arcane Mage Cropped.jpg',
    health: 8,
    armor: 1,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'arcaneExplosion', cost: 3, casts: 2 },
      middle: { id: 'arcaneBolt', cost: 2, casts: 4 },
      back: { id: 'arcaneBlast', cost: 6, casts: 2 },
    },
    description: 'A master of unstable magic; can strip enemy enchantments and blast nearby foes.'
  },

  {
    id: 'angelID',
    name: 'Angel',
    image: '/images/heroes/Angel Cropped.jpg',
    health: 9,
    armor: 2,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'slash', cost: 2, casts: 5 },
      middle: { id: 'lightPillar', cost: 4, casts: 3 },
      back: { id: 'prayer', cost: 3, casts: 2 },
    },
    description: 'Angel: Slash [2] (front), Light Pillar [4] (middle), Prayer [3] (back).'
  },

  {
    id: 'specterID',
    name: 'Specter',
    image: '/images/heroes/Specter cropped.jpg',
    health: 10,
    armor: 0,
    speed: 2,
    energy: 2,
    passives: [EFFECTS.Ghost],
    spells: {
      front: { id: 'spook', cost: 3, casts: 3 },
      middle: { id: 'hex', cost: 2, casts: 5 },
      back: { id: 'soulDrain', cost: 4, casts: 2 },
    },
    description: 'Specter: Spook [3] projectile for 3 that moves the target to the furthest available tile from Specter; Hex [2] hits least-effects enemy for 2 and applies Curse; Soul Drain [4] targets highest Energy enemy for 3, drains 1 Energy, then heals caster for 3 and grants 1 Energy. Passive Ghost: spells ignore Armor; when targeted by enemy spells, roll d6 and on 5-6 the spell misses.'
  },

  {
    id: 'sorceressID',
    name: 'Sorceress',
    image: '/images/heroes/Sorceress Cropped.jpg',
    health: 8,
    armor: 1,
    speed: 3,
    energy: 1,
    spells: {
      front: { id: 'searingLight', cost: 5, casts: 3 },
      middle: { id: 'enrage', cost: 3, casts: 3 },
      back: { id: 'energyWave', cost: 5, casts: 3 },
    },
    description: 'Sorceress: Searing Light [5] hits enemy with most positive effects for 8 and removes top positive effect; Enrage [3] buffs nearest ally with +2 Spell Power but they take +1 post-calculation damage; Energy Wave [5] is a projectile for 8 and reduces Energy by 1.'
  },

  // New hero: Nephilim (from provided card)
  {
    id: 'nephilimID',
    name: 'Nephilim',
    image: '/images/heroes/Nephilim Cropped.jpg',
    health: 11,
    armor: 1,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'dualityStrike', cost: 3, casts: 3 },
      middle: { id: 'lifeForALife', cost: 2, casts: 4 },
      back: { id: 'lightAndDark', cost: 4, casts: 2 },
    },
    description: 'Nephilim: Duality Strike [3] hits highest Health for 6 and heals equal damage; Life for a Life [2] hits lowest Health for 4, healing lowest ally for 4 if it kills; Light and Dark [4] heals ally column for 3 and hits enemy column for 5.'
  },

  // New hero: Paladin (from provided card)
  {
    id: 'paladinID',
    name: 'Paladin',
    image: '/images/heroes/Paladin Cropped.jpg',
    health: 8,
    armor: 4,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'justice', cost: 3, casts: 4 },
      middle: { id: 'armorUp', cost: 2, casts: 4 },
      back: { id: 'humble', cost: 3, casts: 2 },
    },
    description: 'Paladin: Justice [3] targets highest-energy enemy for 6 Attack Power; Armor Up [2] gives +2 Armor; Humble [3] deals 4 + 2×positive effects.'
  },

  // New hero: King (from provided card)
  {
    id: 'kingID',
    name: 'King',
    image: '/images/heroes/King Cropped.jpg',
    health: 11,
    armor: 3,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'subjugation', cost: 3, casts: 2 },
      middle: { id: 'benevolence', cost: 3, casts: 3 },
      back: { id: 'superiority', cost: 4, casts: 3 },
    },
    description: 'King: Subjugation [3] applies a targeting override; Benevolence [3] grants +1 casts to the target’s row; Superiority [4] hits lowest Armor for 3 (or 6 if target has more Health).'
  },

  // New hero: Queen (from provided card)
  {
    id: 'queenID',
    name: 'Queen',
    image: '/images/heroes/Queen Cropped.jpg',
    health: 9,
    armor: 0,
    speed: 4,
    energy: 0,
    spells: {
      front: { id: 'corruptingTongue', cost: 4, casts: 3 },
      middle: { id: 'tyranny', cost: 4, casts: 3 },
      back: { id: 'queensWrath', cost: 4, casts: 3 },
    },
    description: 'Queen: Corrupting Tongue [4] hits the frontmost enemy row with heroes for 4 and applies Curse; Tyranny [4] hits enemy corner tiles for (2 + enemies hit); Queen’s Wrath [4] hits highest Health for 6 and applies Curse.'
  },

  {
    id: 'reaperID',
    name: 'Reaper',
    image: '/images/heroes/Reaper Cropped.jpg',
    health: 5,
    armor: 2,
    speed: 2,
    energy: 0,
    passives: [EFFECTS.Lifesteal],
    spells: {
      front: { id: 'reapersHarvest', cost: 2, casts: 2 },
      middle: { id: 'reap', cost: 2, casts: 2 },
      back: { id: 'cleave', cost: 2, casts: 2 },
    },
    description: 'Reaper: Reaper\'s Harvest [2] hits the backmost enemy row with heroes for 5; Reap [2] applies Reap (executes enemies at 2 or less Health); Cleave [2] hits the frontmost enemy row with heroes for 5. Passive: Lifesteal heals 1 per enemy damaged by Reaper.'
  },

  // New hero: Prince (from provided card)
  {
    id: 'princeID',
    name: 'Prince',
    image: '/images/heroes/Prince Cropped.jpg',
    health: 11,
    armor: 0,
    speed: 3,
    energy: 0,
    passives: [EFFECTS.Overencumbered],
    spells: {
      front: { id: 'duel', cost: 3, casts: 5 },
      middle: { id: 'armorBearer', cost: 2, casts: 2 },
      back: { id: 'battleFormation', cost: 4, casts: 3 },
    },
    description: 'Prince: Duel [3] deals 7 to highest Health (fast targets retaliate for 2); Armor Bearer [2] grants +3 Armor; Battle Formation [4] hits enemy middle column then middle row for 5. Passive: Overencumbered (Armor cannot exceed 4).'
  },

  // New hero: Monk (from provided card)
  {
    id: 'monkID',
    name: 'Monk',
    image: '/images/heroes/Monk Cropped.jpg',
    health: 10,
    armor: 1,
    speed: 2,
    energy: 1,
    spells: {
      front: { id: 'deadlyFist', cost: 2, casts: 4 },
      middle: { id: 'exorcism', cost: 2, casts: 4 },
      back: { id: 'revive', cost: 5, casts: 1 },
    },
    description: 'Monk: Deadly Fist [2] hits the highest-health enemy for 8 with double Armor effectiveness; Exorcism [2] cleanses a debuff and damages its applier; Revive [5] restores a nearby corpse with 8 Heal Power.'
  },

  // New hero: Fire Mage (from provided card image)
  {
    id: 'fireMageID',
    name: 'Fire Mage',
    image: '/images/heroes/Fire Mage Cropped.jpg',
    health: 7,
    armor: 1,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'fireBomb', cost: 3, casts: 3 },
      middle: { id: 'fireBolt', cost: 2, casts: 5 },
      back: { id: 'meteor', cost: 6, casts: 2 },
    },
  },

  // New hero: Jester (from provided card art)
  {
    id: 'jesterID',
    name: 'Jester',
    image: '/images/heroes/Jester Cropped.jpg',
    // Default stats inferred from the card: health 10 (adjust if you prefer different values)
    health: 10,
    armor: 1,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'copyCat', cost: 3, casts: 3 },
      middle: { id: 'slash', cost: 2, casts: 3 },
      back: { id: 'oops', cost: 4, casts: 2 },
    },
    description: 'Jester: copies the last enemy spell (front), slashes (middle) and has a chaotic "OOPS!!" back-row effect.'
  },

  // New hero: Iron Golem (from provided card image)
  {
    id: 'ironGolemID',
    name: 'Iron Golem',
    image: '/images/heroes/Iron Golem Cropped.jpg',
    health: 5,
    armor: 5,
    speed: 2,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'ironHand', cost: 2, casts: 4 },
      middle: { id: 'magnetize', cost: 2, casts: 2 },
      back: { id: 'bodySlam', cost: 4, casts: 2 },
    },
    description: 'Iron Golem: armor-scaling attacks with a two-effect magnetize spell.'
  },

  // New hero: Ice Mage (from provided card)
  {
    id: 'iceMageID',
    name: 'Ice Mage',
    image: '/images/heroes/Ice Mage Cropped.jpg',
    health: 7,
    armor: 1,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'coneOfCold', cost: 4, casts: 3 },
      middle: { id: 'iceBolt', cost: 2, casts: 5 },
      back: { id: 'blizzard', cost: 6, casts: 2 },
    },
    description: 'Ice Mage: frost-based spells that slow enemies; each spell has a 50% chance to apply Slowed.'
  },

  // New hero: Battle Mage
  {
    id: 'battleMageID',
    name: 'Battle Mage',
    image: '/images/heroes/Battle Mage Cropped.jpg',
    health: 10,
    armor: 3,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'forceBlast', cost: 6, casts: 5 },
      middle: { id: 'staffFinisher', cost: 2, casts: 5 },
      back: { id: 'battle', cost: 3, casts: 3 },
    },
    description: 'Battle Mage: back-row "Battle" fires a projectile then follows up with a strike (uses two animations).'
  },

  // New hero: Berserker (from provided card image)
  {
    id: 'berserkerID',
    name: 'Berserker',
    image: '/images/heroes/Berserker Cropped.jpg',
    health: 11,
    armor: 0,
    speed: 3,
    energy: 0,
    passives: [EFFECTS.UndyingRage],
    spells: {
      front: { id: 'berserk', cost: 2, casts: 5 },
      middle: { id: 'slash', cost: 2, casts: 3 },
      back: { id: 'rage', cost: 3, casts: 1 },
    },
    description: 'Berserker: aggressive frontliner. Spells: Berserk [2] (front), Slash [2] (middle), Rage [3] (back). Passive: Undying Rage — the first instance of damage that would have killed Berserker instead takes Berserker to 1 health.'
  },

  // New hero: Mud Golem
  {
    id: 'mudGolemID',
    name: 'Mud Golem',
    image: '/images/heroes/Mud Golem Cropped.jpg',
    health: 4,
    armor: 0,
    speed: 2,
    energy: 0,
    monster: true,
    passives: [EFFECTS.Regeloop],
    spells: {
      front: { id: 'mudSling', cost: 2, casts: 2 },
      middle: { id: 'mudArmor', cost: 2, casts: 1 },
      back: { id: 'quicksand', cost: 3, casts: 3 },
    },
    description: 'Mud Golem: Mud Sling [2] hits highest Energy and applies Slowed; Mud Armor [2] grants +3 Armor to the lowest-Armor ally (not self); Quicksand [3] deals 4 + target Speed. Passive: Regeloop triggers up to 3 times to restore to 4 HP and cleanse buffs/debuffs.'
  },

  // New hero: Nature Golem
  {
    id: 'natureGolemID',
    name: 'Nature Golem',
    image: '/images/heroes/Nature Golem Cropped.jpg',
    health: 10,
    armor: 2,
    speed: 2,
    energy: 0,
    monster: true,
    startingEffects: [EFFECTS.Regen],
    spells: {
      front: { id: 'entanglingRoots', cost: 2, casts: 4 },
      middle: { id: 'naturesBlessing', cost: 2, casts: 3 },
      back: { id: 'protectiveGrowth', cost: 2, casts: 2 },
    },
    description: 'Nature Golem: Entangling Roots [2] deals 4 and applies Spores if the target has 2+ Armor; Nature\'s Blessing [2] removes a debuff and, if removed, applies Regen; Protective Growth [2] redirects enemy multi-target spells. Passive: starts with Regen.'
  },

  {
    id: 'bileCreatureID',
    name: 'Bile Creature',
    image: '/images/heroes/Bile Creature Cropped.jpg',
    health: 15,
    armor: 0,
    speed: 2,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'acid', cost: 2, casts: 3 },
      middle: { id: 'armorMelt', cost: 2, casts: 2 },
      back: { id: 'acidPool', cost: 4, casts: 2 },
    },
    description: 'Bile Creature: toxic monster that applies persistent damage-over-time effects. Acid [2] applies growing damage, Armor Melt [2] targets armored rows, Acid Pool [4] spreads Burn to all enemies.'
  },

  // New hero: Necromancer (from provided card)
  {
    id: 'necromancerID',
    name: 'Necromancer',
    image: '/images/heroes/Necromancer Cropped.jpg',
    health: 7,
    armor: 2,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'corpseExplosion', cost: 3, casts: 3 },
      middle: { id: 'raiseDead', cost: 2, casts: 5 },
      back: { id: 'soulDrain', cost: 5, casts: 2 },
    },
    description: 'Necromancer: Corpse Explosion [3], Raise Dead [2], Soul Drain [5].'
  },

  // Special hero: Skeleton (non-draftable; used for summoning/necromancy content)
  {
    id: 'skeletonID',
    name: 'Skeleton',
    image: '/images/heroes/Skeleton Cropped.jpg',
    health: 6,
    armor: 0,
    speed: 2,
    energy: 0,
    isMinion: true,
    leavesCorpse: false,
    draftable: false,
    spells: {
      front: { id: 'slash', cost: 2, casts: 5 },
      middle: { id: 'slash', cost: 2, casts: 5 },
      back: { id: 'slash', cost: 2, casts: 5 }
    },
    description: 'Skeleton: basic fighter with Slash in every row.'
  },

  {
    id: 'executionerID',
    name: 'Executioner',
    image: '/images/heroes/Executioner Cropped.jpg',
    health: 11,
    armor: 3,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'execute', cost: 3, casts: 3 },
      middle: { id: 'guillotine', cost: 2, casts: 4 },
      back: { id: 'shackle', cost: 2, casts: 2 },
    },
    description: 'Executioner: Execute targets lowest health enemy for 2 + missing health damage; Guillotine deals 3 damage and applies Bleed; Shackle prevents movement.'
  },

  {
    id: 'clericID',
    name: 'Cleric',
    image: '/images/heroes/Cleric Cropped.jpg',
    health: 8,
    armor: 0,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'purify', cost: 3, casts: 4 },
      middle: { id: 'cleanse', cost: 2, casts: 6 },
      back: { id: 'clericHeal', cost: 6, casts: 2 },
    },
  },

  // New hero: Priest (from provided card)
  {
    id: 'priestID',
    name: 'Priest',
    image: '/images/heroes/Priest Cropped.jpg',
    health: 8,
    armor: 1,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'holyFervor', cost: 3, casts: 2 },
      middle: { id: 'cleanse', cost: 2, casts: 6 },
      back: { id: 'massHeal', cost: 6, casts: 3 },
    },
    description: 'Priest: Holy Fervor [3] heals highest-energy ally for 2 and applies Quickness (+1 Speed, +1 Spell Power); Cleanse [2] removes top debuff and heals 2 if removed; Mass Heal [6] heals all allies for 2.'
  },

  // New hero: Enchantress (from provided card image)
  {
    id: 'enchantressID',
    name: 'Enchantress',
    image: '/images/heroes/enchantress.png',
    health: 10,
    armor: 0,
    speed: 5,
    energy: 0,
    spells: {
      front: { id: 'enchantDexterity', cost: 4, casts: 2 },
      middle: { id: 'enchantStamina', cost: 2, casts: 5 },
      back: { id: 'enchantStrength', cost: 2, casts: 5 },
    },
  },

  // New hero: Geisha (from provided card image)
  {
    id: 'geishaID',
    name: 'Geisha',
    image: '/images/heroes/Geisha Cropped.jpg',
    health: 7,
    armor: 0,
    speed: 4,
    energy: 0,
    spells: {
      front: { id: 'fan', cost: 4, casts: 2 },
      middle: { id: 'slap', cost: 3, casts: 4 },
      back: { id: 'poisonedHairpin', cost: 5, casts: 4 },
    },
  },
  // New hero: Ninja (from provided card image)
  {
    id: 'ninjaID',
    name: 'Ninja',
    image: '/images/heroes/Ninja Cropped.jpg',
    health: 6,
    armor: 1,
    speed: 4,
    energy: 0,
    spells: {
      front: { id: 'shuriken', cost: 2, casts: 6 },
      middle: { id: 'smokeBomb', cost: 4, casts: 2 },
      back: { id: 'swiftness', cost: 5, casts: 2 },
    },
  },
  {
    id: 'thiefID',
    name: 'Thief',
    image: '/images/heroes/Thief Cropped.jpg',
    health: 7,
    armor: 2,
    speed: 5,
    energy: 2,
    spells: {
      front: { id: 'stab', cost: 2, casts: 7 },
      middle: { id: 'pilfer', cost: 5, casts: 3 },
      back: { id: 'coup', cost: 7, casts: 2 },
    },
    description: 'Thief: Stab [2] targets lowest Speed for 3 Attack Power; Pilfer [5] steals the top positive effect from the enemy with the most buffs and places it on the ally with the most Health (casts at -1 priority); Coup [7] targets least Armor for 7 Attack Power.'
  },
  {
    id: 'summonerID',
    name: 'Summoner',
    image: '/images/heroes/Summoner Cropped.jpg',
    health: 9,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'summonerSummonAlly', cost: 2, casts: 1 },
      middle: { id: 'summonerSummonMinion', cost: 1, casts: 4 },
      back: { id: 'summonerSupportMinion', cost: 2, casts: 3 },
    },
    description: 'Summoner: Summon Ally [2] moves the first living reserve ally onto the nearest available board tile and grants Energy equal to its current Speed; Summon Minion [1] applies Minion to the ally with the least effects; Support Minion [2] heals the two nearest allies that have Minion for 2.'
  },
  {
    id: 'tetheredSpiritID',
    name: 'Tethered Spirit',
    image: '/images/heroes/Tethered Spirit Cropped.jpg',
    health: 9,
    armor: 1,
    speed: 1,
    energy: 0,
    passives: [EFFECTS.Link],
    spells: {
      front: { id: 'etherium', cost: 4, casts: 1 },
      middle: { id: 'helpingHand', cost: 3, casts: 4 },
      back: { id: 'voidShield', cost: 2, casts: 3 },
    },
    description: 'Tethered Spirit: Etherium [2] applies Fade to the ally with the highest Energy; Helping Hand [3] heals nearest ally for 4 and repositions them to the first open tile in reverse book order; Void Shield [2] applies Void Shield to the ally with the least stacks. Passive Link: whenever another ally (not this hero) casts a spell, gain 1 Energy.'
  },
  // New hero: Nymph (from provided card image)
  {
    id: 'nymphID',
    name: 'Nymph',
    image: '/images/heroes/Dryad.jpeg',
    health: 10,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'spores', cost: 1, casts: 4 },
      middle: { id: 'naturesWrath', cost: 2, casts: 4 },
      back: { id: 'fruitOfTheVine', cost: 2, casts: 4 },
    },
  },
  // New hero: Lightning Mage (from provided card image)
  {
    id: 'lightningMageID',
    name: 'Lightning Mage',
    image: '/images/heroes/Lightning Mage Cropped.jpg',
    health: 5,
    armor: 0,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'forkedLightning', cost: 4, casts: 3 },
      middle: { id: 'lightningBolt', cost: 3, casts: 4 },
      back: { id: 'zeusWrath', cost: 12, casts: 1 },
    },
    description: "Lightning Mage: front targets the nearest 3 enemies; middle hits highest-health and applies Static Shock; back is a heavy board nuke."
  },
  

  {
    id: 'archerID',
    name: 'Archer',
    image: '/images/heroes/Archer Cropped.jpg',
    health: 6,
    armor: 1,
    speed: 5,
    energy: 0,
    spells: {
      front: { id: 'multishot', cost: 6, casts: 2 },
      middle: { id: 'arrow', cost: 3, casts: 6 },
      back: { id: 'deadEye', cost: 9, casts: 2 },
    },
  },

  {
    id: 'alchemistID',
    name: 'Alchemist',
    image: '/images/heroes/Alchemist Cropped.jpg',
    health: 8,
    armor: 0,
    speed: 2,
    energy: 2,
    spells: {
      front: { id: 'experimentalToxin', cost: 2, casts: 4 },
      middle: { id: 'elixir', cost: 4, casts: 1 },
      back: { id: 'bombToss', cost: 4, casts: 2 },
    },
  },

  // New hero: Drunkard (from provided artwork)
  {
    id: 'drunkardID',
    name: 'Drunkard',
    image: '/images/heroes/Drunkard Cropped.jpg',
    health: 10,
    armor: 0,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'barrelSmash', cost: 3, casts: 3 },
      middle: { id: 'wildPunch', cost: 2, casts: 5 },
      back: { id: 'specialBrew', cost: 6, casts: 2 },
    },
  },

  // New hero: Apothecary (added from provided image)
  {
    id: 'apothecaryID',
    name: 'Apothecary',
    image: '/images/heroes/Apothecary Cropped.jpg',
    health: 9,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'poisonDagger', cost: 2, casts: 4 },
      middle: { id: 'vitalityPotion', cost: 3, casts: 3 },
      back: { id: 'brimberryLeaves', cost: 2, casts: 5 },
    },
  },
  // New hero: Poison Mage (from provided card)
  {
    id: 'poisonMageID',
    name: 'Poison Mage',
    image: '/images/heroes/Poison Mage Cropped.jpg',
    health: 6,
    armor: 1,
    speed: 4,
    energy: 1,
    spells: {
      front: { id: 'poison', cost: 2, casts: 6 },
      middle: { id: 'venomStrike', cost: 4, casts: 3 },
      back: { id: 'poisonExplosion', cost: 4, casts: 2 },
    },
    description: 'Poison Mage: Poison [2], Venom Strike [4], Poison Explosion [4].'
  },
  // New hero: Inn Keeper (from provided card)
  {
    id: 'innKeeperID',
    name: 'Inn Keeper',
    image: '/images/heroes/Inn Keeper Cropped.jpg',
    health: 8,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'giveAQuest', cost: 2, casts: 3 },
      middle: { id: 'offerARoom', cost: 2, casts: 4 },
      back: { id: 'herbs', cost: 2, casts: 3 },
    },
    description: 'Inn Keeper: Give a Quest [2], Offer a Room [2], Herbs [2].'
  },
  // New hero: Huntress (from provided card)
  {
    id: 'huntressID',
    name: 'Huntress',
    image: '/images/heroes/Huntress Cropped.jpg',
    health: 10,
    armor: 0,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'lieInWait', cost: 3, casts: 1 },
      middle: { id: 'spear', cost: 4, casts: 3 },
      back: { id: 'blowDart', cost: 2, casts: 4 },
    },
  },

  {
    id: 'rogueID',
    name: 'Rogue',
    image: '/images/heroes/Rogue Cropped.jpg',
    health: 8,
    armor: 0,
    speed: 4,
    energy: 3,
    spells: {
      front: { id: 'shadowStrike', cost: 4, casts: 5 },
      middle: { id: 'fade', cost: 4, casts: 1 },
      back: { id: 'combo', cost: 4, casts: 3 },
    },
    description: 'Rogue: Shadow Strike [4] reverse-book single target for 7; Fade [4] grants +1 Spell Power and single-target immunity for 5 rounds; Combo [4] hits lowest Health twice for 3 and, on kill, hits highest Health for 5.'
  },

  {
    id: 'elderID',
    name: 'Elder',
    image: '/images/heroes/Elder Cropped.jpg',
    health: 9,
    armor: 0,
    speed: 1,
    energy: 0,
    spells: {
      front: { id: 'malign', cost: 1, casts: 4 },
      middle: { id: 'humility', cost: 1, casts: 2 },
      back: { id: 'truth', cost: 2, casts: 2 },
    },
  },

  {
    id: 'bloodmageID',
    name: 'Blood Mage',
    image: '/images/heroes/Blood Mage Cropped.jpg',
    health: 7,
    armor: 2,
    speed: 2,
    energy: 0,
    passives: [EFFECTS.Frenzy],
    spells: {
      front: { id: 'leech', cost: 2, casts: 3 },
      middle: { id: 'cut', cost: 2, casts: 4 },
      back: { id: 'transfusion', cost: 3, casts: 3 },
    },
  },

  {
    id: 'assassinID',
    name: 'Assassin',
    image: '/images/heroes/Assassin cropped.jpg',
    health: 9,
    armor: 0,
    speed: 3,
    energy: 0,
    passives: [EFFECTS.AcceptContract],
    spells: {
      front: { id: 'poisonDagger', cost: 3, casts: 4 },
      middle: { id: 'assassinate', cost: 4, casts: 3 },
      back: { id: 'priorityTarget', cost: 4, casts: 3 },
    },
  },
  {
    id: 'bountyHunterID',
    name: 'Bounty Hunter',
    image: '/images/heroes/Bounty Hunter Cropped.jpg',
    health: 10,
    armor: 1,
    speed: 2,
    energy: 0,
    passives: [EFFECTS.Bounty],
    spells: {
      front: { id: 'arrest', cost: 3, casts: 2 },
      middle: { id: 'sneakAttack', cost: 2, casts: 3 },
      back: { id: 'trackDown', cost: 3, casts: 2 },
    },
  },
  {
    id: 'darkKnightID',
    name: 'Dark Knight',
    image: '/images/heroes/Dark Knight 2 Cropped.jpg',
    health: 9,
    armor: 3,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'darkSlash', cost: 2, casts: 5 },
      middle: { id: 'soulCrush', cost: 6, casts: 2 },
      back: { id: 'treachery', cost: 3, casts: 3 },
    },
  },
  {
    id: 'darkMageID',
    name: 'Dark Mage',
    image: '/images/heroes/Dark Mage Cropped.jpg',
    health: 6,
    armor: 1,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'drain', cost: 3, casts: 3 },
      middle: { id: 'darkBolt', cost: 2, casts: 4 },
      back: { id: 'gravity', cost: 6, casts: 2 },
    },
  },
  {
    id: 'dragonID',
    name: 'Dragon',
    image: '/images/heroes/Dragon.jpg',
    health: 26,
    armor: 0,
    speed: 1,
    energy: 0,
    monster: true,
    passives: [EFFECTS.DragonScales],
    spells: {
      front: { id: 'dragonFangs', cost: 1, casts: 4 },
      middle: { id: 'dragonsClaw', cost: 1, casts: 4 },
      back: { id: 'fireBreath', cost: 2, casts: 3 },
    },
  },

  // New monster hero: Green Dragon
  {
    id: 'greenDragonID',
    name: 'Green Dragon',
    image: '/images/heroes/Green Dragon Cropped.jpg',
    health: 24,
    armor: 0,
    speed: 1,
    energy: 0,
    monster: true,
    passives: [EFFECTS.DragonScales],
    spells: {
      front: { id: 'gale', cost: 2, casts: 3 },
      middle: { id: 'viciousBite', cost: 3, casts: 3 },
      back: { id: 'poisonBreath', cost: 2, casts: 3 },
    },
  },
  {
    id: 'werewolfID',
    name: 'Werewolf',
    image: '/images/heroes/Werewolf Cropped.jpg',
    health: 20,
    armor: 0,
    speed: 3,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'bite', cost: 3, casts: 4 },
      middle: { id: 'howl', cost: 3, casts: 2 },
      back: { id: 'maul', cost: 6, casts: 2 },
    },
    description: 'Werewolf: Bite [3] targets highest Health for 4, applies Bleed, and heals self for 1; Howl [3] targets the enemy front row and reduces Energy by 2; Maul [6] targets lowest Health for 6, applies Bleed, and heals self for 2.'
  },
  {
    id: 'dragonlingID',
    name: 'Dragonling',
    image: '/images/heroes/Dragonling Cropped.jpg',
    health: 9,
    armor: 0,
    speed: 2,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'tailWhip', cost: 2, casts: 3 },
      middle: { id: 'dragonsBreath', cost: 2, casts: 4 },
      back: { id: 'claw', cost: 2, casts: 5 },
    },
  },
  // New hero: Knight
  {
    id: 'knightID',
    name: 'Knight',
    image: '/images/heroes/Knight Cropped.jpg',
    health: 11,
    armor: 3,
    speed: 2,
    energy: 3,
    spells: {
      front: { id: 'charge', cost: 3, casts: 3 },
      middle: { id: 'counter', cost: 3, casts: 2 },
      back: { id: 'hamstring', cost: 3, casts: 3 },
    },
    description: 'Knight: Charge pushes enemies back, Counter retaliates when targeted, Hamstring slows fast enemies.'
  },
  {
    id: 'druidID',
    name: 'Druid',
    image: '/images/heroes/Druid Cropped.png',
    health: 11,
    armor: 0,
    speed: 2,
    energy: 0,
    // Passive Shapeshift: front +3 Armor, middle +1 Speed
    positionalModifiers: {
      front: { armor: 3 },
      middle: { speed: 1 }
    },
    spells: {
      front: { id: 'bearSwipe', cost: 2, casts: 4 },
      middle: { id: 'wolfClaw', cost: 2, casts: 5 },
      back: { id: 'rejuvenate', cost: 2, casts: 3 },
    },
  },
  {
    id: 'bloodGolemID',
    name: 'Blood Golem',
    image: '/images/heroes/Blood Golem.jpg',
    health: 13,
    armor: 0,
    speed: 2,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'bloodDrain', cost: 2, casts: 4 },
      middle: { id: 'soulLink', cost: 2, casts: 2 },
      back: { id: 'consumeCorpse', cost: 2, casts: 3 }
    },
    description: 'Blood Golem: A necromantic tank that drains life, protects allies by absorbing damage, and consumes corpses to heal.'
  },
  {
    id: 'vampireID',
    name: 'Vampire',
    image: '/images/heroes/Vampire Cropped.jpg',
    health: 12,
    armor: 1,
    speed: 3,
    energy: 1,
    monster: true,
    passives: [EFFECTS.BloodSuck],
    spells: {
      front: { id: 'batSwarm', cost: 3, casts: 2 },
      middle: { id: 'bloodyFangs', cost: 2, casts: 5 },
      back: { id: 'bloodLust', cost: 3, casts: 4 },
    },
    description: 'Vampire: Bat Swarm [3] targets all enemies with Bleed for 4 Attack Power; Bloody Fangs [2] targets the enemy with the least effects for 3 Attack Power and applies Bleed; Blood Lust [3] targets the enemy with the most Bleed effects for 5 Attack Power. Passive: Blood Suck (heals 2 Health for each enemy target that already has Bleed).'
  },
  {
    id: 'titanID',
    name: 'Titan',
    image: '/images/heroes/Titan Cropped.jpg',
    health: 22,
    armor: 0,
    speed: 3,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'flex', cost: 2, casts: 5 },
      middle: { id: 'tableTilt', cost: 3, casts: 2 },
      back: { id: 'avalanche', cost: 7, casts: 2 },
    },
    description: 'Titan: Flex [2] targets highest Health for 3 Attack Power (5 if target has less Health than Titan); Table Tilt [3] shifts the enemy board to the caster\'s right and deals damage equal to tiles moved; Avalanche [7] targets each enemy separately for a d6 roll of Attack Power.'
  },
  {
    id: 'fireGolemID',
    name: 'Fire Golem',
    image: '/images/heroes/Fire Golem Cropped.jpg',
    health: 16,
    armor: 0,
    speed: 2,
    energy: 0,
    monster: true,
    passives: [EFFECTS.Smolder],
    spells: {
      front: { id: 'consumedByFlames', cost: 2, casts: 5 },
      middle: { id: 'heatingUp', cost: 2, casts: 1 },
      back: { id: 'consumeBurn', cost: 2, casts: 3 }
    },
    description: 'Fire Golem: Consumed By Flames [2] scales with Burn stacks, Heating Up [2] grants a Burn-on-cast buff, Consume Burn [2] removes a Burn for burst damage and self-heal. Passive: Smolder (targeting the golem applies Burn to the attacker).'
  },
  {
    id: 'waterGolemID',
    name: 'Water Golem',
    image: '/images/heroes/Water Golem Cropped.png',
    health: 24,
    armor: 0,
    speed: 2,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'tidalWave', cost: 3, casts: 3 },
      middle: { id: 'cleansingWater', cost: 2, casts: 3 },
      back: { id: 'healingWater', cost: 2, casts: 2 },
    },
    description: 'Water Golem: Tidal Wave [3] targets the frontmost enemy row with at least one Hero for 4 Attack Power; Cleansing Water [2] targets adjacent allies and removes the topmost negative effect; Healing Water [2] buffs the caster to heal adjacent allies for 1 at the beginning of each round.'
  },
  {
    id: 'rockGolemID',
    name: 'Rock Golem',
    image: '/images/heroes/Rock Golem Cropped.jpg',
    health: 10,
    armor: 4,
    speed: 2,
    energy: 0,
    monster: true,
    passives: [EFFECTS.Crumble],
    spells: {
      front: { id: 'stomp', cost: 3, casts: 3 },
      middle: { id: 'throwBoulder', cost: 4, casts: 2 },
      back: { id: 'rockSmash', cost: 2, casts: 4 },
    },
    description: 'Rock Golem: Stomp [3] targets the enemy with the lowest Speed for 6 Attack Power; Throw Boulder [4] projectile for 5 and applies Taunt to self; Rock Smash [2] targets highest Health for 5. Passive: Crumble (first time Health drops below 7, loses 1 base Armor).'
  },
  {
    id: 'giantID',
    name: 'Giant',
    image: '/images/heroes/Giant Cropped.jpg',
    health: 19,
    armor: 0,
    speed: 3,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'trample', cost: 4, casts: 3 },
      middle: { id: 'throwRock', cost: 2, casts: 3 },
      back: { id: 'hardFall', cost: 3, casts: 2 },
    },
    description: 'Giant: Trample [4] column attack for 2 (ignores Armor) and applies Slowed; Throw Rock [2] deals 2 and applies Taunt to self; Hard Fall [3] applies a death trigger that hits slow enemies.'
  },
  {
    id: 'palaceGuardID',
    name: 'Palace Guard',
    image: '/images/heroes/Palace Guard Cropped.jpg',
    health: 10,
    armor: 2,
    speed: 2,
    energy: 3,
    spells: {
      front: { id: 'defend', cost: 3, casts: 2 },
      middle: { id: 'throwRock', cost: 3, casts: 2 },
      back: { id: 'demoralizingBlow', cost: 3, casts: 4 },
    },
    description: 'Palace Guard: Defend [3] grants +1 Armor and nullifies projectile/column targeting that would hit him; Throw Rock [3] deals 2 and applies Taunt to self; Demoralizing Blow [3] deals 4 to the enemy with the most buffs, removes top buff, and casts at -1 priority.'
  },
  {
    id: 'behemothID',
    name: 'Behemoth',
    image: '/images/heroes/Behemoth.jpg',
    health: 16,
    armor: 3,
    speed: 2,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'brutalSmash', cost: 2, casts: 1 },
      middle: { id: 'monstrousClaws', cost: 2, casts: 1 },
      back: { id: 'roar', cost: 4, casts: 1 }
    },
    description: 'Behemoth: A massive monster that smashes armored foes and bolsters its own power.'
  },
  {
    id: 'demonID',
    name: 'Demon',
    image: '/images/heroes/Demon Cropped.jpg',
    health: 7,
    armor: 1,
    speed: 3,
    energy: 1,
    spells: {
      front: { id: 'siphon', cost: 2, casts: 4 },
      middle: { id: 'deathPact', cost: 3, casts: 1 },
      back: { id: 'curse', cost: 2, casts: 4 },
    },
  },
  {
    id: 'witchDoctorID',
    name: 'Witch Doctor',
    image: '/images/heroes/Witch Doctor Cropped.jpg',
    health: 9,
    armor: 1,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'affliction', cost: 2, casts: 3 },
      middle: { id: 'ritual', cost: 3, casts: 3 },
      back: { id: 'toads', cost: 3, casts: 2 },
    },
    description: 'Witch Doctor: Affliction [2] hits the enemy with the least effects for 4 (ignores Armor) and applies Curse; Ritual [3] heals the allied middle row for 2 and grants +1 Energy; Toads [3] deals 5 to the projectile target and applies Poison to that target and all adjacent enemies.'
  },
  {
    id: 'axemanID',
    name: 'Axeman',
    image: '/images/heroes/Axeman Cropped.jpg',
    health: 11,
    armor: 3,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'chop', cost: 2, casts: 5 },
      middle: { id: 'axeThrow', cost: 4, casts: 4 },
      back: { id: 'sharpenAxe', cost: 3, casts: 2 },
    },
    description: 'Axeman: Chop [2] targets frontmost row for 3 Attack Power; Axe Throw [4] projectile for 5 Attack Power; Sharpen Axe [3] grants +2 Spell Power.'
  },
  {
    id: 'prisonerID',
    name: 'Prisoner',
    image: '/images/heroes/Prisoner Cropped.jpg',
    health: 10,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'releaseInmates', cost: 2, casts: 3 },
      middle: { id: 'usurp', cost: 3, casts: 3 },
      back: { id: 'chainWhip', cost: 3, casts: 3 },
    },
    description: 'Prisoner: Release Inmates [2] targets the backmost enemy row for 4 Attack Power (ignores Armor); Usurp [3] targets highest Armor for 6 Attack Power (ignores Armor); Chain Whip [3] is a projectile for 6 Attack Power (ignores Armor) and moves the target to the frontmost available row.'
  },
  {
    id: 'fallenAngelID',
    name: 'Fallen Angel',
    image: '/images/heroes/Fallen  Angle cropped.jpg',
    health: 9,
    armor: 2,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'slash', cost: 2, casts: 4 },
      middle: { id: 'darkPillar', cost: 4, casts: 3 },
      back: { id: 'retribution', cost: 3, casts: 2 },
    },
    description: 'Fallen Angel: slash deals 5 Attack Power to highest Health; darkPillar is a column attack applying Curse (-1 Spell Power); retribution grants retaliation buff (3 damage when targeted).'
  },
  {
    id: 'stonecasedKingID',
    name: 'Stonecased King',
    image: '/images/heroes/Stone cased king cropped.jpg',
    health: 14,
    armor: 3,
    speed: 0,
    allowZeroSpeed: true,
    energy: 0,
    passives: [EFFECTS.Awaken],
    spells: {
      front: { id: 'vengefulSlash', cost: 2, casts: 4 },
      middle: { id: 'decreeOfHatred', cost: 3, casts: 3 },
      back: { id: 'reclaimThrone', cost: 2, casts: 3 },
    },
    description: 'Stonecased King: Vengeful Slash [2] targets highest Health for 8 Attack Power; Decree of Hatred [3] fires a projectile in each enemy column for 5 Attack Power; Reclaim Throne [2] targets highest Armor for 6 Attack Power ignoring Armor. Passive Awaken: when targeted by an enemy spell, gain +1 Speed (max 3), and effects cannot alter his Speed.'
  },
  {
    id: 'shieldMaidenID',
    name: 'Shield Maiden',
    image: '/images/heroes/Shield Maiden Cropped.jpg',
    health: 13,
    armor: 3,
    speed: 3,
    energy: 0,
    spells: {
      front: { id: 'shieldMaidenSkirmish', cost: 2, casts: 6 },
      middle: { id: 'shieldMaidenShieldBash', cost: 6, casts: 3 },
      back: { id: 'shieldMaidenLoyalty', cost: 3, casts: 2 },
    },
    description: 'Shield Maiden: Skirmish [2] targets highest Health for 4 Attack Power; Shield Bash [6] targets highest Energy for 5 Attack Power and reduces Energy by 2; Loyalty [3] applies a redirect effect to the lowest-Energy ally so enemy single-target spells hit Shield Maiden instead (if able).'
  },
  {
    id: 'pyroID',
    name: 'Pyro',
    image: '/images/heroes/Pyro Cropped.jpg',
    health: 8,
    armor: 0,
    speed: 3,
    energy: 1,
    spells: {
      front: { id: 'wildFire', cost: 2, casts: 2 },
      middle: { id: 'conflagration', cost: 3, casts: 3 },
      back: { id: 'flameThrower', cost: 3, casts: 4 },
    },
    description: 'Pyro: Wildfire [2] targets the enemy with the least effects and applies Wildfire (at the beginning of each round, it deals 1 damage, then spreads to adjacent heroes); Conflagration [3] deals 2 to the entire enemy board; Flame Thrower [3] is a column attack for 4 and applies Burn.'
  },
  {
    id: 'timeMageID',
    name: 'Time Mage',
    image: '/images/heroes/Time Mage Cropped.jpg',
    health: 6,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'timeWarp', cost: 2, casts: 3 },
      middle: { id: 'haste', cost: 2, casts: 3 },
      back: { id: 'energyBlast', cost: 2, casts: 4 },
    },
    description: 'Time Mage: Time Warp [2] targets highest Speed enemy and applies Time Warp (-2 Speed); Haste [2] targets lowest Speed ally and applies Haste (+2 Speed); Energy Blast [2] targets highest Energy enemy and reduces Energy by 2.'
  },
  {
    id: 'tinkererID',
    name: 'Tinkerer',
    image: '/images/heroes/Tinkerer Cropped.jpg',
    health: 9,
    armor: 1,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'landMine', cost: 2, casts: 5 },
      middle: { id: 'buildTurret', cost: 2, casts: 2 },
      back: { id: 'fieldUpgrade', cost: 2, casts: 2 },
    },
    description: 'Tinkerer: Land Mine [2] places a mine on the first empty tile in the mirrored enemy column; enemy movement onto that mine triggers an explosion for 7 Attack Power. Build Turret [2] heals self for 1 and applies Turret, which hits highest Health enemy for 5 at round start. Field Upgrade [2] targets the ally with the highest Speed and least effects and makes their spells ignore Armor.'
  },
  {
    id: 'trollID',
    name: 'Troll',
    image: '/images/heroes/troll Cropped.jpg',
    health: 18,
    armor: 0,
    speed: 2,
    energy: 0,
    monster: true,
    spells: {
      front: { id: 'clubSmash', cost: 3, casts: 3 },
      middle: { id: 'trollRegeneration', cost: 2, casts: 3 },
      back: { id: 'payTheToll', cost: 2, casts: 1 },
    },
    description: 'Troll: Club Smash [3] targets highest Health enemy for 6 Attack Power and applies Armor Break (-2 Armor). Troll Regeneration [2] heals self for 5. Pay The Toll [2] applies an effect that deals 2 damage to moved or swapped enemies that end on the main board.'
  },
];

/*
  The original (commented-out) hero definitions are preserved below for debugging.
  Uncomment any entries you need for future tests.

  // ORIGINAL HEROES (commented out)
  {
    id: 'flamewrightID',
    name: 'Flamewright',
    health: 10,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'flameJab', cost: 2, casts: 3 },
      middle: { id: 'wildfireTrap', cost: 2, casts: 1 },
      back: { id: 'pyreBlast', cost: 3, casts: 1 },
    },
  },

  {
    id: 'shieldbearerID',
    name: 'Shieldbearer',
    health: 16,
    armor: 2,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'shieldBash', cost: 2, casts: 2 },
      middle: { id: 'guardUp', cost: 2, casts: 2 },
      back: { id: 'bulwarkField', cost: 3, casts: 1 },
    },
  },

  {
    id: 'swiftID',
    name: 'Swift',
    health: 9,
    armor: 0,
    speed: 4,
    energy: 0,
    spells: {
      front: { id: 'quickSlash', cost: 2, casts: 3 },
      middle: { id: 'hasteWind', cost: 2, casts: 2 },
      back: { id: 'leapStrike', cost: 3, casts: 1 },
    },
  },

  {
    id: 'clericID',
    name: 'Cleric',
    health: 11,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'minorPrayer', cost: 2, casts: 3 },
      middle: { id: 'blessingOfLife', cost: 2, casts: 2 },
      back: { id: 'prayerOfReturn', cost: 3, casts: 1 },
    },
  },

  {
    id: 'revenantID',
    name: 'Revenant',
    health: 13,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'reapingSwipe', cost: 2, casts: 2 },
      middle: { id: 'vengefulAura', cost: 2, casts: 2 },
      back: { id: 'mortify', cost: 3, casts: 1 },
    },
  },

  {
    id: 'pyreturretID',
    name: 'Pyreturret',
    health: 8,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'spark', cost: 2, casts: 3 },
      middle: { id: 'sentryPyre', cost: 2, casts: 2 },
      back: { id: 'wildBlast', cost: 3, casts: 1 },
    },
  },

  {
    id: 'scavengerID',
    name: 'Scavenger',
    health: 10,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'scrapStrike', cost: 2, casts: 3 },
      middle: { id: 'scavengeBoost', cost: 2, casts: 2 },
      back: { id: 'explosiveTrap', cost: 2, casts: 1 },
    },
  },

  // A generic test hero with descriptive spells left in description (for fallback testing)
  {
    id: 'apprenticeID',
    name: 'Apprentice',
    health: 9,
    armor: 0,
    speed: 2,
    energy: 0,
    spells: {
      front: { id: 'fumbleBolt', cost: 2, casts: 3 },
      middle: { id: 'lesserWard', cost: 2, casts: 2 },
      back: { id: 'sparkle', cost: 2, casts: 1 },
    },
  },

*/