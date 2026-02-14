// src/tower/towerState.js
// State management for Tower of Shattered Champions runs

import { HEROES } from '../heroes.js';
import { getSpellById } from '../spells.js';
import { AUGMENTS, getRandomAugments, applyAugmentsToHero } from './augments.js';
import { 
  getHeroPoolForLevel, 
  getEnemyAugmentCount, 
  getAIDifficultyForLevel,
  getBossForLevel,
  isBossLevel,
  BOSS_SPELLS
} from './towerLevels.js';

// Re-export isBossLevel for convenience
export { isBossLevel } from './towerLevels.js';

const TOWER_STORAGE_KEY = 'brimstone_tower_run';
const BASE_AUGMENT_CAP = 2;
const AUGMENT_ID_MIGRATIONS = {
  counter: 'thornsStrong',
  deletedCounter: 'thornsStrong',
  earlySpark: 'earlySparkI'
};

function migrateRunAugments(runState) {
  if (!runState || !Array.isArray(runState.selectedHeroes)) return runState;
  let changed = false;

  runState.selectedHeroes.forEach(hero => {
    if (!hero || !Array.isArray(hero.augments)) return;
    const updated = hero.augments
      .map(entry => {
        if (!entry || !entry.augmentId) return null;
        const migratedId = AUGMENT_ID_MIGRATIONS[entry.augmentId];
        if (migratedId && entry.augmentId !== migratedId) {
          changed = true;
          return { ...entry, augmentId: migratedId };
        }
        if (!AUGMENTS[entry.augmentId]) {
          changed = true;
          return null;
        }
        return entry;
      })
      .filter(Boolean);

    if (updated.length !== hero.augments.length) {
      hero.augments = updated;
      changed = true;
    }
  });

  if (changed) {
    runState.lastPlayedAt = Date.now();
    saveTowerRun(runState);
  }

  return runState;
}

/**
 * Tower run state structure:
 * {
 *   currentLevel: number (1-100),
 *   selectedHeroes: [{ heroId, augments: [{ augmentId, rolledValue }], position: number|null }],
 *   pendingAugmentChoice: [augment, augment, augment] | null,
 *   pendingRecruitOptions: [heroId, heroId, heroId] | null,
 *   pendingBossId: string | null,
 *   pendingRecruitChoice: boolean,
 *   completedLevels: number[],
 *   bossesDefeated: string[],
 *   startedAt: timestamp,
 *   lastPlayedAt: timestamp
 * }
 * 
 * Board positions (3x3 grid):
 *   0 | 1 | 2   (front row)
 *   3 | 4 | 5   (middle row)
 *   6 | 7 | 8   (back row)
 * 
 * Position can be 0-8 (on board) or null (in reserve)
 */

/**
 * Initialize a new tower run
 */
export function createNewRun() {
  return {
    currentLevel: 1,
    selectedHeroes: [], // Will be populated during team selection
    pendingAugmentChoice: null,
    pendingRecruitOptions: null,
    pendingBossId: null,
    pendingRecruitChoice: false,
    completedLevels: [],
    bossesDefeated: [],
    startedAt: Date.now(),
    lastPlayedAt: Date.now()
  };
}

/**
 * Save tower run to localStorage
 */
export function saveTowerRun(runState) {
  try {
    localStorage.setItem(TOWER_STORAGE_KEY, JSON.stringify(runState));
    return true;
  } catch (e) {
    console.error('Failed to save tower run:', e);
    return false;
  }
}

/**
 * Load tower run from localStorage
 */
export function loadTowerRun() {
  try {
    const saved = localStorage.getItem(TOWER_STORAGE_KEY);
    if (saved) {
      const run = JSON.parse(saved);
      if (run && typeof run.pendingRecruitChoice !== 'boolean') {
        run.pendingRecruitChoice = false;
      }
      if (run && !Array.isArray(run.pendingRecruitOptions)) {
        run.pendingRecruitOptions = null;
      }
      if (run && typeof run.pendingBossId === 'undefined') {
        run.pendingBossId = null;
      }
      return migrateRunAugments(run);
    }
  } catch (e) {
    console.error('Failed to load tower run:', e);
  }
  return null;
}

/**
 * Clear tower run data
 */
export function clearTowerRun() {
  try {
    localStorage.removeItem(TOWER_STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('Failed to clear tower run:', e);
    return false;
  }
}

/**
 * Check if a run exists
 */
export function hasActiveRun() {
  return loadTowerRun() !== null;
}

/**
 * Set selected heroes for the run with their board positions
 * @param {Object} runState - Current run state
 * @param {Array} heroSelections - Array of { heroId, position } where position is 0-8 or null for reserve
 */
export function setSelectedHeroes(runState, heroSelections) {
  if (heroSelections.length < 1 || heroSelections.length > 7) {
    throw new Error('Must select between 1 and 7 heroes');
  }
  
  // Validate that at least one hero is on the board
  const onBoard = heroSelections.filter(h => h.position !== null);
  if (onBoard.length === 0) {
    throw new Error('At least one hero must be placed on the board');
  }
  
  runState.selectedHeroes = heroSelections.map(selection => ({
    heroId: selection.heroId,
    position: selection.position,
    augments: []
  }));
  
  runState.lastPlayedAt = Date.now();
  saveTowerRun(runState);
  return runState;
}

/**
 * Add a hero to the run or swap with an existing hero
 * @param {Object} runState - Current run state
 * @param {string} heroId - ID of the hero to add
 * @param {number|null} swapHeroIndex - Index to replace if team is full
 */
export function addHeroToRun(runState, heroId, swapHeroIndex = null) {
  if (!runState || !heroId) return runState;
  runState.selectedHeroes = runState.selectedHeroes || [];

  const existingIds = runState.selectedHeroes.map(h => h.heroId);
  if (existingIds.includes(heroId)) {
    throw new Error('Hero is already in the run');
  }

  if (runState.selectedHeroes.length >= 7) {
    if (swapHeroIndex == null || swapHeroIndex < 0 || swapHeroIndex >= runState.selectedHeroes.length) {
      throw new Error('Must select a hero to swap');
    }
    const existing = runState.selectedHeroes[swapHeroIndex];
    runState.selectedHeroes[swapHeroIndex] = {
      heroId,
      position: existing?.position ?? null,
      augments: existing?.augments ? [...existing.augments] : []
    };
  } else {
    runState.selectedHeroes.push({
      heroId,
      position: null,
      augments: []
    });
  }

  runState.lastPlayedAt = Date.now();
  saveTowerRun(runState);
  return runState;
}

/**
 * Get recruit hero choices, excluding already selected heroes
 */
export function getRecruitChoices(runState, count = 3) {
  if (runState && Array.isArray(runState.pendingRecruitOptions) && runState.pendingRecruitOptions.length > 0) {
    return runState.pendingRecruitOptions
      .map(id => HEROES.find(h => h.id === id))
      .filter(Boolean);
  }
  const selectedIds = new Set((runState.selectedHeroes || []).map(h => h.heroId));
  const pool = HEROES.filter(h => h.draftable !== false && !selectedIds.has(h.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, Math.min(count, shuffled.length));
  if (runState) {
    runState.pendingRecruitOptions = choices.map(h => h.id);
    runState.lastPlayedAt = Date.now();
    saveTowerRun(runState);
  }
  return choices;
}

/**
 * Update hero positions (for rearranging during augment view)
 * @param {Object} runState - Current run state
 * @param {Array} positions - Array of { heroIndex, position } updates
 */
export function updateHeroPositions(runState, positions) {
  positions.forEach(({ heroIndex, position }) => {
    if (heroIndex >= 0 && heroIndex < runState.selectedHeroes.length) {
      runState.selectedHeroes[heroIndex].position = position;
    }
  });
  
  runState.lastPlayedAt = Date.now();
  saveTowerRun(runState);
  return runState;
}

/**
 * Get augment cap for the current run
 * Starts at 2 and increases by 1 per boss defeated
 */
export function getAugmentCap(runState) {
  const bossCount = Array.isArray(runState?.bossesDefeated) ? runState.bossesDefeated.length : 0;
  return BASE_AUGMENT_CAP + bossCount;
}

/**
 * Add an augment to a hero by index
 * @param {Object} runState - Current run state
 * @param {number} heroIndex - Index of the hero in selectedHeroes (0-6)
 * @param {string} augmentId - ID of the augment to add
 */
export function addAugmentToHero(runState, heroIndex, augmentId, rolledValue = null) {
  if (heroIndex < 0 || heroIndex >= runState.selectedHeroes.length) {
    throw new Error(`Invalid hero index ${heroIndex}`);
  }
  
  const heroEntry = runState.selectedHeroes[heroIndex];
  if (!heroEntry) {
    throw new Error(`Hero at index ${heroIndex} not found in run`);
  }
  
  const augmentCap = getAugmentCap(runState);
  if (heroEntry.augments.length >= augmentCap) {
    throw new Error(`Hero has reached max augments (${augmentCap})`);
  }
  
  // Get the augment definition
  const augment = AUGMENTS[augmentId];
  let finalValue = rolledValue ?? augment?.rolledValue ?? null;
  if (finalValue == null && augment?.valueRange) {
    const [min, max] = augment.valueRange;
    finalValue = min + Math.floor(Math.random() * (max - min + 1));
  }
  
  heroEntry.augments.push({
    augmentId: augmentId,
    rolledValue: finalValue
  });
  
  runState.pendingAugmentChoice = null;
  runState.pendingRecruitChoice = true;
  runState.lastPlayedAt = Date.now();
  saveTowerRun(runState);
  return runState;
}

/**
 * Generate augment choices after winning a level
 */
export function generateAugmentChoices(runState) {
  const level = runState.currentLevel;
  
  // Collect all augment IDs already owned by all heroes
  const ownedAugmentIds = [];
  runState.selectedHeroes.forEach(hero => {
    hero.augments.forEach(aug => {
      ownedAugmentIds.push(aug.augmentId);
    });
  });
  
  // Get 3 random augments, excluding already owned ones
  const forceUncommon = Array.isArray(runState.bossesDefeated) && runState.bossesDefeated.length > 0;
  const choices = getRandomAugments(level, 3, ownedAugmentIds, { forceUncommonIfAllCommon: forceUncommon });
  
  runState.pendingAugmentChoice = choices;
  runState.pendingRecruitChoice = false;
  runState.lastPlayedAt = Date.now();
  saveTowerRun(runState);
  
  return choices;
}

/**
 * Mark level as complete and advance
 */
export function completeLevel(runState, bossId = null) {
  runState.completedLevels.push(runState.currentLevel);
  
  if (bossId) {
    runState.bossesDefeated.push(bossId);
  }
  
  runState.currentLevel += 1;
  runState.pendingAugmentChoice = null;
  runState.pendingRecruitOptions = null;
  runState.pendingBossId = null;
  runState.pendingRecruitChoice = false;
  runState.lastPlayedAt = Date.now();
  saveTowerRun(runState);
  
  return runState;
}

/**
 * Advance to the next level after augment selection
 */
export function advanceLevel(runState) {
  runState.completedLevels.push(runState.currentLevel);
  runState.currentLevel += 1;
  runState.pendingAugmentChoice = null;
  runState.pendingRecruitOptions = null;
  runState.pendingBossId = null;
  runState.pendingRecruitChoice = false;
  runState.lastPlayedAt = Date.now();
  saveTowerRun(runState);
  return runState;
}

/**
 * Get full hero objects with augments applied for battle
 * @param {Object} runState - Current run state
 * @returns {Array} Array of hero objects ready for battle
 */
export function getPlayerHeroesForBattle(runState) {
  const heroes = [];
  
  runState.selectedHeroes.forEach(heroEntry => {
    const baseHero = HEROES.find(h => h.id === heroEntry.heroId);
    if (!baseHero) {
      console.error(`Hero ${heroEntry.heroId} not found in HEROES`);
      return;
    }
    
    // Deep clone the hero
    const hero = JSON.parse(JSON.stringify(baseHero));
    hero.towerNoHealthCap = true;
    
    // Initialize current stats
    hero.currentHealth = hero.health;
    hero.currentEnergy = hero.energy;
    hero.currentSpeed = hero.speed;
    hero.currentArmor = hero.armor;
    hero.currentSpellPower = hero.spellPower || 0;
    
    // Apply all augments (migrate missing rolledValue if needed)
    let updatedAugments = false;
    heroEntry.augments.forEach(augEntry => {
      const augment = AUGMENTS[augEntry.augmentId];
      if (!augment) return;
      let value = augEntry.rolledValue;
      if (value == null && augment.valueRange) {
        const [min, max] = augment.valueRange;
        value = min + Math.floor(Math.random() * (max - min + 1));
        augEntry.rolledValue = value;
        updatedAugments = true;
      }
      if (augment.apply) {
        augment.apply(hero, value);
      }
    });
    if (updatedAugments) {
      runState.lastPlayedAt = Date.now();
      saveTowerRun(runState);
    }
    
    // Store augment info for display
    hero._towerAugments = heroEntry.augments
      .map(a => {
        const aug = AUGMENTS[a.augmentId];
        if (!aug) return null;
        const value = a.rolledValue;
        return {
          ...aug,
          rolledValue: value,
          description: aug?.description?.replace('{value}', value ?? '') || ''
        };
      })
      .filter(Boolean);
    
    heroes.push(hero);
  });
  
  return heroes;
}

/**
 * Generate enemy team for a regular (non-boss) level
 * @param {number} level - Current tower level
 * @returns {Object} Enemy team configuration
 */
export function generateEnemyTeam(level) {
  const heroPool = getHeroPoolForLevel(level);
  const augmentCount = getEnemyAugmentCount(level);
  const difficulty = getAIDifficultyForLevel(level);
  const enemyCount = Math.min(7, Math.max(3, level + 2));
  
  // Shuffle and pick 7 heroes
  const shuffled = [...heroPool].sort(() => Math.random() - 0.5);
  const selectedIds = shuffled.slice(0, Math.min(enemyCount, shuffled.length));
  
  // Pre-distribute augment counts across enemies to avoid all-zero rolls
  const perHeroAugments = Array(Math.min(enemyCount, selectedIds.length)).fill(0);
  for (let i = 0; i < augmentCount; i++) {
    perHeroAugments[i % perHeroAugments.length] += 1;
  }
  // Shuffle distribution to randomize which enemies receive augments
  for (let i = perHeroAugments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perHeroAugments[i], perHeroAugments[j]] = [perHeroAugments[j], perHeroAugments[i]];
  }

  // Generate heroes with augments
  const enemies = selectedIds.map((heroId, idx) => {
    const baseHero = HEROES.find(h => h.id === heroId);
    if (!baseHero) {
      console.error(`Enemy hero ${heroId} not found`);
      return null;
    }
    
    const hero = JSON.parse(JSON.stringify(baseHero));
    hero.towerNoHealthCap = true;
    
    // Initialize current stats
    hero.currentHealth = hero.health;
    hero.currentEnergy = hero.energy;
    hero.currentSpeed = hero.speed;
    hero.currentArmor = hero.armor;
    hero.currentSpellPower = hero.spellPower || 0;
    
    // Apply random augments based on level
    const heroAugmentCount = perHeroAugments[idx] || 0;
    const augments = getRandomAugments(level, heroAugmentCount);
    
    augments.forEach(aug => {
      if (aug.apply) {
        aug.apply(hero, aug.rolledValue);
      }
    });

    // Store augment info for hover/debug display
    hero._towerAugments = augments.map(a => ({
      ...a,
      rolledValue: a.rolledValue,
      description: a.description || ''
    }));
    
    return hero;
  }).filter(Boolean);
  
  // Randomly place 5 on main board, 2 in reserve
  const shuffledEnemies = [...enemies].sort(() => Math.random() - 0.5);
  const mainCount = Math.min(5, shuffledEnemies.length);
  const mainBoardHeroes = shuffledEnemies.slice(0, mainCount);
  const reserveHeroes = shuffledEnemies.slice(mainCount, Math.min(shuffledEnemies.length, mainCount + 2));
  
  // Random positions for main board (0-8)
  const mainPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, mainCount);
  
  return {
    mainBoard: mainBoardHeroes.map((hero, idx) => ({
      hero,
      position: mainPositions[idx]
    })),
    reserve: reserveHeroes,
    difficulty
  };
}

/**
 * Generate boss for a boss level
 * @param {number} level - Boss level (5, 10, 15, etc.)
 * @returns {Object} Boss configuration
 */
export function generateBossLevel(level) {
  const bossConfig = getBossForLevel(level);
  if (!bossConfig) {
    console.error(`No boss found for level ${level}`);
    return null;
  }
  
  // Create boss hero from config
  const bossPassives = bossConfig.passives
    ? bossConfig.passives.map(p => (p ? { ...p } : p))
    : [];

  const boss = {
    id: bossConfig.id,
    name: bossConfig.name,
    title: bossConfig.title,
    description: bossConfig.description,
    image: bossConfig.imageOverride
      || HEROES.find(h => h.id === bossConfig.baseHeroId)?.image
      || '/images/heroes/default.jpg',
    health: bossConfig.stats.health,
    armor: bossConfig.stats.armor,
    speed: bossConfig.stats.speed,
    energy: bossConfig.stats.energy,
    spellPower: bossConfig.stats.spellPower,
    currentHealth: bossConfig.stats.health,
    currentArmor: bossConfig.stats.armor,
    currentSpeed: bossConfig.stats.speed,
    currentEnergy: bossConfig.stats.energy,
    currentSpellPower: bossConfig.stats.spellPower,
    spells: JSON.parse(JSON.stringify(bossConfig.spells)),
    passives: bossPassives,
    monster: true,
    isBoss: true,
    towerNoHealthCap: true
  };

  // Apply boss augments (fixed + weighted random by level)
  const bossAugments = [];
  const configuredAugments = Array.isArray(bossConfig.augments) ? bossConfig.augments : [];
  const randomAugmentCount = configuredAugments.filter(id => id === 'randomAugment').length;
  const fixedAugmentIds = configuredAugments.filter(id => id !== 'randomAugment');
  const randomAugments = randomAugmentCount > 0
    ? getRandomAugments(level, randomAugmentCount, [...new Set(fixedAugmentIds)])
    : [];

  const applyBossAugment = (augment, valueOverride = null, augmentIdFallback = null) => {
    if (!augment || !augment.apply) return;
    let value = valueOverride;
    if (value == null && augment.valueRange) {
      const [min, max] = augment.valueRange;
      value = min + Math.floor(Math.random() * (max - min + 1));
    }
    augment.apply(boss, value);
    const description = augment.description ? augment.description.replace('{value}', value ?? '') : '';
    bossAugments.push({
      id: augment.id || augmentIdFallback,
      name: augment.name || augmentIdFallback || augment.id,
      rolledValue: value,
      description
    });
  };

  fixedAugmentIds.forEach(augId => {
    applyBossAugment(AUGMENTS[augId], null, augId);
  });

  randomAugments.forEach(aug => {
    applyBossAugment(aug, aug.rolledValue, aug.id);
  });
  if (bossAugments.length > 0) {
    boss._towerAugments = bossAugments;
  }

  // Build boss spell overrides so hover text matches actual behavior
  try {
    const formatBossSpellDescription = (spellDef, slotKey) => {
      if (!spellDef) return '';
      let desc = spellDef.description || '';

      const debuffs = boss._towerDebuffAugments && slotKey ? (boss._towerDebuffAugments[slotKey] || []) : [];
      if (Array.isArray(debuffs) && debuffs.length > 0) {
        const unique = Array.from(new Set(debuffs)).filter(Boolean);
        if (unique.length > 0) {
          const debuffText = unique.join(', ');
          if (!new RegExp(`\\b(${unique.map(d => d.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})\\b`, 'i').test(desc)) {
            desc = desc ? `${desc} Also applies ${debuffText}.` : `Applies ${debuffText}.`;
          }
        }
      }

      return desc;
    };

    const applySpellOverride = (slotKey) => {
      const slot = boss.spells && boss.spells[slotKey] ? boss.spells[slotKey] : null;
      if (!slot || !slot.id) return;
      const spellDef = getSpellById(slot.id);
      if (!spellDef) return;
      slot.name = spellDef.name || slot.name || slot.id;
      slot.description = formatBossSpellDescription(spellDef, slotKey);
    };

    ['front', 'middle', 'back'].forEach(applySpellOverride);
  } catch (e) {}
  
  return {
    boss,
    bossConfig,
    difficulty: 'hard' // Bosses always use hard AI
  };
}

/**
 * Get current level info
 */
export function getLevelInfo(level) {
  const isBoss = isBossLevel(level);
  
  return {
    level,
    isBoss,
    difficulty: getAIDifficultyForLevel(level),
    heroPoolSize: getHeroPoolForLevel(level).length,
    expectedEnemyAugments: getEnemyAugmentCount(level)
  };
}

/**
 * Get summary of run for display
 */
export function getRunSummary(runState) {
  if (!runState) return null;
  
  const totalAugments = runState.selectedHeroes.reduce(
    (sum, hero) => sum + hero.augments.length, 
    0
  );
  
  return {
    currentLevel: runState.currentLevel,
    levelsCompleted: runState.completedLevels.length,
    bossesDefeated: runState.bossesDefeated.length,
    totalAugments,
    heroCount: runState.selectedHeroes.length,
    hasTeam: runState.selectedHeroes.length >= 1,
    hasPendingChoice: runState.pendingAugmentChoice !== null,
    startedAt: runState.startedAt,
    lastPlayedAt: runState.lastPlayedAt
  };
}

/**
 * Register boss spells with the spell registry
 * Call this on game init
 */
export function registerBossSpells(spellRegistry) {
  Object.entries(BOSS_SPELLS).forEach(([id, spell]) => {
    spellRegistry[id] = spell;
  });
}

export default {
  createNewRun,
  saveTowerRun,
  loadTowerRun,
  clearTowerRun,
  hasActiveRun,
  setSelectedHeroes,
  addHeroToRun,
  getRecruitChoices,
  addAugmentToHero,
  generateAugmentChoices,
  completeLevel,
  advanceLevel,
  getPlayerHeroesForBattle,
  generateEnemyTeam,
  generateBossLevel,
  getLevelInfo,
  getRunSummary,
  registerBossSpells,
  isBossLevel,
  getAugmentCap,
  updateHeroPositions
};

