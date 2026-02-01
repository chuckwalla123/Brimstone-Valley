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
    id: 'arcaneMage',
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
      front: { id: 'lieInWait', cost: 3, casts: 3 },
      middle: { id: 'spear', cost: 4, casts: 3 },
      back: { id: 'blowDart', cost: 2, casts: 4 },
    },
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