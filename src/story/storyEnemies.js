// src/story/storyEnemies.js
// Enemy teams for Relic Hunt story battles.

export const STORY_ENEMIES = {
  brave_warden_pass: {
    id: 'brave_warden_pass',
    name: "Warden's Pass",
    aiDifficulty: 'easy',
    main: [
      { heroId: 'blacksmithID', position: 6 },
      { heroId: 'berserkerID', position: 7 },
      { heroId: 'iceMageID', position: 2 }
    ],
    reserve: []
  },
  brave_ashbridge: {
    id: 'brave_ashbridge',
    name: 'Ashbridge Toll',
    aiDifficulty: 'easy',
    main: [
      { heroId: 'knightID', position: 6 },
      { heroId: 'jesterID', position: 4 },
      { heroId: 'fireMageID', position: 2 },
      { heroId: 'monkID', position: 1 }
    ],
    reserve: []
  },
  brave_phalanx: {
    id: 'brave_phalanx',
    name: 'The Unbroken Phalanx',
    aiDifficulty: 'medium',
    main: [
      { heroId: 'paladinID', position: 6, augments: [{ augmentId: 'armorBoostMedium', rolledValue: 2 }] },
      { heroId: 'knightID', position: 7, augments: [{ augmentId: 'armorBoostSmall', rolledValue: 1 }] },
      { heroId: 'kingID', position: 8, augments: [{ augmentId: 'healthBoostMedium', rolledValue: 4 }] },
      { heroId: 'blacksmithID', position: 4 }
    ],
    reserve: []
  },
  brave_warcamp: {
    id: 'brave_warcamp',
    name: 'Warcamp',
    aiDifficulty: 'medium',
    main: [
      { heroId: 'berserkerID', position: 6 },
      { heroId: 'lancerID', position: 7 },
      { heroId: 'battleMageID', position: 2 },
      { heroId: 'blacksmithID', position: 1 }
    ],
    reserve: []
  },
  brave_watchtower: {
    id: 'brave_watchtower',
    name: 'Watchtower',
    aiDifficulty: 'medium',
    main: [
      { heroId: 'arcaneMageID', position: 6 },
      { heroId: 'iceMageID', position: 4 },
      { heroId: 'monkID', position: 2 },
      { heroId: 'jesterID', position: 1 }
    ],
    reserve: []
  },
  brave_iron_regent: {
    id: 'brave_iron_regent',
    name: 'The Iron Regent',
    aiDifficulty: 'hard',
    main: [
      { heroId: 'kingID', position: 7, augments: [{ augmentId: 'armorBoostHuge', rolledValue: 3 }, { augmentId: 'thornsStrong', rolledValue: 2 }] },
      { heroId: 'paladinID', position: 6, augments: [{ augmentId: 'armorBoostLarge', rolledValue: 2 }] },
      { heroId: 'knightID', position: 8 },
      { heroId: 'blacksmithID', position: 4 },
      { heroId: 'lancerID', position: 2 }
    ],
    reserve: []
  }
};

export function getStoryEnemyTeam(teamId) {
  return STORY_ENEMIES[teamId] || null;
}
