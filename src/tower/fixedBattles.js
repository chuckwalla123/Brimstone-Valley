// src/tower/fixedBattles.js
// Fixed tower encounters (enemy composition, slots, extra fixed augments, and pre-battle dialogue)

export const TOWER_FIXED_BATTLES = {
  3: {
    title: 'Ember Gate Watch',
    heroes: [
      { heroId: 'battleMageID', slot: 6 },
      { heroId: 'demonID', slot: 0 },
      { heroId: 'dragonlingID', slot: 5, fixedAugments: [{ augmentId: 'armorBoostSmall' }] },
      { heroId: 'fireMageID', slot: 4 },
      { heroId: 'shieldMaidenID', slot: 7 }
    ],
    dialogue: [
      { speaker: 'Demon', side: 'right', text: 'Boss says no one climbs past this landing. I say we make an example of the next team.' },
      { speaker: 'Battle Mage', side: 'right', text: 'Keep the theatrics down. Let them spend their energy in panic, then I end it cleanly.' },
      { speaker: 'Fire Mage', side: 'right', text: 'I lit the braziers myself. Their armor will be hot before they even cast.' },
      { speaker: 'Shield Maiden', side: 'right', text: 'Hold your line and stop gloating. The boss hates sloppy victories.' },
      { speaker: 'Dragonling', side: 'right', text: 'I have scales, fire, and orders. They have a staircase. We will see who keeps it.' }
    ]
  },
  8: {
    title: 'Cinder Procession',
    heroes: [
      {
        heroId: 'pyroID',
        slot: 6,
        fixedAugments: [
          { augmentId: 'healthBoostHuge' },
          { augmentId: 'energyBoostMedium' },
          { augmentId: 'allCastsLarge' },
          { augmentId: 'periodicPulseI' }
        ]
      },
      { heroId: 'greenDragonID', slot: 3, fixedAugments: [{ augmentId: 'speedBoostSmall' }] },
      { heroId: 'priestID', slot: 2 },
      { heroId: 'giantID', slot: 4 },
      { heroId: 'rockGolemID', slot: 8 },
      { heroId: 'samuraiID', slot: 9 },
      { heroId: 'jesterID', slot: 10 }
    ],
    dialogue: [
      { speaker: 'Pyro', side: 'right', text: 'Look alive, everyone. Climbers incoming. Honestly, Green Dragon and I could clear this whole wave without help.' },
      { speaker: 'Pyro', side: 'right', text: 'I melt their front line, my dragon poisons whoever survives, and then we do it again. Efficient. Elegant. Embarrassing for them.' },
      { speaker: 'Green Dragon', side: 'right', text: 'I accept this arrangement. Keep them standing long enough for the venom to bloom.' },
      { speaker: 'Pyro', side: 'right', text: 'See? Teamwork. The rest of you can clap when we are done.' },
      { speaker: 'Jester', side: 'right', text: 'Can we clap before? I love applauding confidence right before disaster.' },
      { speaker: 'Pyro', side: 'right', text: 'Disaster is what happens to heroes who climb into my lane. I have not even used my mean spells yet.' },
      { speaker: 'Samurai', side: 'right', text: 'Boasting is wind. Finish the battle cleanly and the boss will be satisfied.' },
      { speaker: 'Pyro', side: 'right', text: 'Fine. Cleanly. Green Dragon, on my mark. Everyone else, try to keep up.' }
    ]
  },
  13: {
    title: 'Velvet Ambush',
    heroes: [
      { heroId: 'fireMageID', slot: 2 },
      { heroId: 'drunkardID', slot: 5 },
      { heroId: 'darkMageID', slot: 8 },
      { heroId: 'shieldMaidenID', slot: 0, fixedAugments: [{ augmentId: 'healthBoostHuge' }] },
      { heroId: 'werewolfID', slot: 3, fixedAugments: [{ augmentId: 'spellPowerBoostSmall' }] },
      { heroId: 'ninjaID', slot: 9 },
      { heroId: 'sorceressID', slot: 10 }
    ],
    dialogue: [
      { speaker: 'Sorceress', side: 'right', text: 'Another hero squad. Another speech about destiny. Spare me.' },
      { speaker: 'Ninja', side: 'right', text: 'I prefer quiet work. Their healer disappears first.' },
      { speaker: 'Dark Mage', side: 'right', text: 'If they reach me, they have already made a tactical error. I laid a special trap that blooms on turn two.' },
      { speaker: 'Shield Maiden', side: 'right', text: 'No one reaches you. I hold the choke. You do your part.' },
      { speaker: 'Drunkard', side: 'right', text: 'My part is chaos, and I am very qualified.' },
      { speaker: 'Werewolf', side: 'right', text: 'Enough talking. I can smell fear from the stairs.' }
    ]
  },
  18: {
    title: 'Choir of Ash',
    heroes: [
      { heroId: 'angelID', slot: 0, fixedAugments: [{ augmentId: 'prayerAugmentII' }, { augmentId: 'healthBoostMassive' }] },
      { heroId: 'fallenAngelID', slot: 4 },
      { heroId: 'demonID', slot: 3, fixedAugments: [{ augmentId: 'spellPowerBoostHuge' }] },
      { heroId: 'specterID', slot: 8, fixedAugments: [{ augmentId: 'ironForgeAugmentII' }] },
      { heroId: 'necromancerID', slot: 5, fixedAugments: [{ augmentId: 'speedBoostHuge' }] },
      { heroId: 'nephilimID', slot: 9 },
      { heroId: 'reaperID', slot: 10 }
    ],
    dialogue: [
      { speaker: 'Angel', side: 'right', text: 'Stand behind me and hold your nerve. We are all sworn of the Faith Kingdom—let every blow come to me, and I will keep this choir standing.' },
      { speaker: 'Angel', side: 'right', text: 'Discipline is devotion. Stay in line, trust the shield I give you, and no ally falls while I still breathe.' },
      { speaker: 'Fallen Angel', side: 'right', text: 'There it is—the sermon. Fine. We let you take the damage, and we clean up what survives.' },
      { speaker: 'Necromancer', side: 'right', text: 'A reliable wall and fresh corpses? Efficient theology. I approve.' },
      { speaker: 'Reaper', side: 'right', text: 'Then we proceed in order: Angel endures, and I harvest the rest.' },
      { speaker: 'Demon', side: 'right', text: 'Enough vows. The stair is full of targets—show them why your faith is hard to kill.' }
    ]
  },
  23: {
    title: 'Wyrm Kennels',
    heroes: [
      {
        heroId: 'werewolfID',
        slot: 2,
        fixedAugments: [
          { augmentId: 'ironForgeAugmentII' },
          { augmentId: 'speedBoostMedium' },
          { augmentId: 'dexterityAugmentII' }
        ]
      },
      {
        heroId: 'vampireID',
        slot: 7,
        fixedAugments: [
          { augmentId: 'healthBoostHuge' },
          { augmentId: 'periodicPulseII' }
        ]
      },
      { heroId: 'titanID', slot: 3, fixedAugments: [{ augmentId: 'armorBoostHuge' }] },
      { heroId: 'dragonlingID', slot: 8, fixedAugments: [{ augmentId: 'healthBoostHuge' }] },
      { heroId: 'giantID', slot: 4, fixedAugments: [{ augmentId: 'healthBoostHuge' }] },
      {
        heroId: 'dragonID',
        slot: 9,
        fixedAugments: [
          { augmentId: 'retributionAugment' },
        ]
      },
      {
        heroId: 'greenDragonID',
        slot: 10,
        fixedAugments: [
          { augmentId: 'periodicPulseII' },
        ]
      }
    ],
    dialogue: [
      { speaker: 'Titan', side: 'right', text: 'No one has cleared this floor. No one. This is the pinnacle of the animal kingdom, and the wall still stands.' },
      { speaker: 'Vampire', side: 'right', text: 'And if they are exceptional, we drain exceptional blood.' },
      { speaker: 'Dragon', side: 'right', text: 'The boss promised me challengers, not tourists. Do not disappoint me.' },
      { speaker: 'Werewolf', side: 'right', text: 'They climb this high, they are prey worth the sprint.' },
      { speaker: 'Green Dragon', side: 'right', text: 'I will soften them. You can fight over the leftovers.' },
      { speaker: 'Giant', side: 'right', text: 'Leftovers are still crunchy.' }
    ]
  },
  28: {
    title: 'Council of Mages',
    heroes: [
      {
        heroId: 'fireMageID',
        slot: 7,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'armorBoostMedium' }
        ]
      },
      {
        heroId: 'darkMageID',
        slot: 0,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'armorBoostMedium' }
        ]
      },
      {
        heroId: 'poisonMageID',
        slot: 6,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'armorBoostMedium' },
          { augmentId: 'periodicPulseII' }
        ]
      },
      {
        heroId: 'timeMageID',
        slot: 4,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'armorBoostMedium' }
        ]
      },
      {
        heroId: 'lightningMageID',
        slot: 8,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'armorBoostMedium' }
        ]
      },
      {
        heroId: 'iceMageID',
        slot: 9,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'armorBoostMedium' }
        ]
      },
      {
        heroId: 'arcaneMageID',
        slot: 10,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'armorBoostMedium' }
        ]
      }
    ],
    dialogue: [
      { speaker: 'Arcane Mage', side: 'right', text: 'Final exam, climbers. We are the council of the legendary Magi Counsel—never beaten, hand-selected by the boss as a bulwark against failure.' },
      { speaker: 'Time Mage', side: 'right', text: 'I have watched a dozen timelines. They fail in all of them.' },
      { speaker: 'Lightning Mage', side: 'right', text: 'Good. I hate waiting.' },
      { speaker: 'Ice Mage', side: 'right', text: 'Then stand still and let them shatter on contact.' },
      { speaker: 'Poison Mage', side: 'right', text: 'No rush. Defeat tastes better after it spreads.' },
      { speaker: 'Dark Mage', side: 'right', text: 'Remember the boss\'s command: leave one conscious witness.' }
    ]
  },
  33: {
    title: 'Braveheart Procession',
    heroes: [
      {
        heroId: 'warriorID',
        slot: 6,
        fixedAugments: [
          { augmentId: 'healthBoostHuge' },
          { augmentId: 'vampiricIV' },
          { augmentId: 'ironForgeAugmentII' }
        ]
      },
      {
        heroId: 'lancerID',
        slot: 0,
        fixedAugments: [
          { augmentId: 'firstStrikeIV' },
          { augmentId: 'healthBoostHuge' },
          { augmentId: 'dexterityAugmentII' }
        ]
      },
      {
        heroId: 'tinkererID',
        slot: 4,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'dexterityAugmentII' },
          { augmentId: 'allCastsMedium' },
          { augmentId: 'keenStrikeII' }
        ]
      },
      {
        heroId: 'princeID',
        slot: 2,
        fixedAugments: [
          { augmentId: 'ironForgeAugmentII' },
          { augmentId: 'healthBoostHuge' },
          { augmentId: 'earlySparkIII' }
        ]
      },
      {
        heroId: 'palaceGuardID',
        slot: 8,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'spellPowerBoostLarge' },
          { augmentId: 'keenStrikeII' }
        ]
      },
      {
        heroId: 'queenID',
        slot: 9,
        fixedAugments: [
          { augmentId: 'healthBoostHuge' },
          { augmentId: 'speedBoostHuge' },
          { augmentId: 'armorBreaker' }
        ]
      },
      {
        heroId: 'kingID',
        slot: 10,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'healthBoostMassive' }
        ]
      }
    ],
    dialogue: [
      { speaker: 'King', side: 'right', text: 'By decree of the Kingdom of the Brave, this staircase ends here. Kneel with dignity and we might call it mercy.' },
      { speaker: 'Queen', side: 'right', text: 'Mercy? Please. I came for spectacle. Let them learn how royal steel answers trespassers.' },
      { speaker: 'Prince', side: 'right', text: 'Form ranks! I want perfect posture when we crush them.' },
      { speaker: 'Warrior', side: 'right', text: 'Their front line breaks on my first swing. If anyone survives, I will swing again.' },
      { speaker: 'Lancer', side: 'right', text: 'Bold words for people standing still. I will be through their guard before your second sentence.' },
      { speaker: 'Tinkerer', side: 'right', text: 'Try not to die too quickly. I tuned these gadgets for a longer demonstration.' },
      { speaker: 'Palace Guard', side: 'right', text: 'Enough ribbing. Brave blood, hold the line and make the kingdom proud.' }
    ]
  },
  38: {
    title: 'Outcast Gauntlet',
    heroes: [
      {
        heroId: 'bountyHunterID',
        slot: 3,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'earlySparkII' }
        ]
      },
      {
        heroId: 'thiefID',
        slot: 2,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'earlySparkII' }
        ]
      },
      {
        heroId: 'rogueID',
        slot: 8,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'earlySparkIV' }
        ]
      },
      {
        heroId: 'prisonerID',
        slot: 9,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'quicknessAugmentII' },
          { augmentId: 'ironForgeAugmentII' }
        ]
      },
      {
        heroId: 'witchDoctorID',
        slot: 7,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'quicknessAugmentII' }
        ]
      },
      {
        heroId: 'assassinID',
        slot: 10,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'vampiricIV' },
          { augmentId: 'spellPowerBoostHuge' },
          { augmentId: 'spellPowerBoostMedium' }
        ]
      },
      {
        heroId: 'berserkerID',
        slot: 4,
        fixedAugments: [
          { augmentId: 'healthBoostMassive' },
          { augmentId: 'allCastsLarge' },
          { augmentId: 'spellPowerBoostLarge' },
          { augmentId: 'arcaneExchange' }
        ]
      }
    ],
    dialogue: [
      { speaker: 'Bounty Hunter', side: 'right', text: 'Welcome to The Outcasts. No crowns, no crests—just contracts and consequences.' },
      { speaker: 'Thief', side: 'right', text: 'I already took their luck. Their coin is next.' },
      { speaker: 'Rogue', side: 'right', text: 'Leave a little pride on them. I enjoy watching it crack when the knives land.' },
      { speaker: 'Prisoner', side: 'right', text: 'They locked me up once. Never again. I break cages and climbers alike.' },
      { speaker: 'Witch Doctor', side: 'right', text: 'Let the brave preach honor. Outcasts survive, adapt, and bury loud heroes.' },
      { speaker: 'Assassin', side: 'right', text: 'Rib them while you can. I only need a heartbeat and one clean angle.' },
      { speaker: 'Berserker', side: 'right', text: 'Enough chatter. Outcasts hit first, hit harder, and laugh last.' }
    ]
  }
};

export function getFixedBattleForLevel(level) {
  return TOWER_FIXED_BATTLES[Number(level)] || null;
}
