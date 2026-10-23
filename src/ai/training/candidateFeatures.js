import { EFFECTS } from '../../effects.js';
import { HEROES } from '../../heroes.js';
import {
  applyMovementAction,
  isLegalMovementAction,
  parseMovementToken,
} from './environment.js';

const MAIN_SIZE = 9;
const RESERVE_SIZE = 2;
const SLOT_COUNT = MAIN_SIZE + RESERVE_SIZE;
const HERO_IDS = [...new Set(HEROES.map((hero) => hero.id))];
const EFFECT_NAMES = [...new Set(Object.values(EFFECTS).map((effect) => effect?.name).filter(Boolean))].sort();
const HERO_INDEX = new Map(HERO_IDS.map((id, index) => [id, index]));
const EFFECT_INDEX = new Map(EFFECT_NAMES.map((name, index) => [name, index]));

export const CANDIDATE_FEATURE_VERSION = 2;

const normalize = (value, maximum) => Math.max(0, Math.min(1, Number(value || 0) / maximum));

const getTileEffects = (tile) => (
  Array.isArray(tile?.effects)
    ? tile.effects
    : (Array.isArray(tile?.hero?.effects) ? tile.hero.effects : [])
);

const getRemainingCasts = (tile, row) => {
  const tracked = tile?._castsRemaining?.[row];
  if (typeof tracked === 'number') return tracked;
  return tile?.hero?.spells?.[row]?.casts ?? 0;
};

const createSlotFeatures = (tile) => {
  const features = new Array(HERO_IDS.length + 15 + EFFECT_NAMES.length).fill(0);
  if (!tile?.hero) return features;

  const hero = tile.hero;
  const heroIndex = HERO_INDEX.get(hero.id);
  if (heroIndex !== undefined) features[heroIndex] = 1;

  const offset = HERO_IDS.length;
  const maxHealth = Math.max(1, Number(hero.health ?? hero.maxHealth ?? 1));
  const effects = getTileEffects(tile);
  const currentHealth = Number(tile.currentHealth ?? hero.currentHealth ?? hero.health ?? 0);
  const currentArmor = Number(tile.currentArmor ?? hero.currentArmor ?? hero.armor ?? 0);
  const currentEnergy = Number(tile.currentEnergy ?? hero.currentEnergy ?? hero.energy ?? 0);
  const currentSpellPower = Number(tile.currentSpellPower ?? hero.currentSpellPower ?? hero.spellPower ?? 0);
  const currentSpeed = Number(tile.currentSpeed ?? hero.currentSpeed ?? hero.speed ?? 0);

  features[offset] = 1;
  features[offset + 1] = tile._dead ? 0 : 1;
  features[offset + 2] = tile._dead ? 1 : 0;
  features[offset + 3] = normalize(currentHealth, maxHealth);
  features[offset + 4] = normalize(currentArmor, 20);
  features[offset + 5] = normalize(currentEnergy, 20);
  features[offset + 6] = normalize(currentSpellPower, 20);
  features[offset + 7] = normalize(currentSpeed, 10);
  features[offset + 8] = normalize(getRemainingCasts(tile, 'front'), 10);
  features[offset + 9] = normalize(getRemainingCasts(tile, 'middle'), 10);
  features[offset + 10] = normalize(getRemainingCasts(tile, 'back'), 10);
  features[offset + 11] = normalize(effects.filter((effect) => effect?.kind === 'buff').length, 5);
  features[offset + 12] = normalize(effects.filter((effect) => effect?.kind === 'debuff').length, 5);
  features[offset + 13] = effects.some((effect) => effect?.preventMovement) ? 1 : 0;
  features[offset + 14] = tile._revivedExtra ? 1 : 0;

  effects.forEach((effect) => {
    const effectIndex = EFFECT_INDEX.get(effect?.name);
    if (effectIndex !== undefined) {
      features[offset + 15 + effectIndex] = Math.min(1, features[offset + 15 + effectIndex] + (1 / 3));
    }
  });

  return features;
};

const createBoardFeatures = (state, side) => {
  const main = state[`${side}Main`] || [];
  const reserve = state[`${side}Reserve`] || [];
  return [
    ...Array.from({ length: MAIN_SIZE }, (_, index) => createSlotFeatures(main[index])),
    ...Array.from({ length: RESERVE_SIZE }, (_, index) => createSlotFeatures(reserve[index])),
  ].flat();
};

const createActionSlots = (action) => {
  const features = new Array(SLOT_COUNT * 2).fill(0);
  const source = parseMovementToken(action.sourceId);
  const destination = parseMovementToken(action.destinationId);
  if (source) features[source.index + (source.isReserve ? MAIN_SIZE : 0)] = 1;
  if (destination) features[SLOT_COUNT + destination.index + (destination.isReserve ? MAIN_SIZE : 0)] = 1;
  return features;
};

export const SLOT_FEATURE_SIZE = HERO_IDS.length + 15 + EFFECT_NAMES.length;
export const CANDIDATE_FEATURE_SIZE = (SLOT_COUNT * SLOT_FEATURE_SIZE * 4) + (SLOT_COUNT * 2) + 2;

export const encodeMovementCandidate = (state, action, perspectiveSide) => {
  if (!isLegalMovementAction(state, action)) {
    throw new Error('Cannot encode an illegal movement action');
  }

  const transition = applyMovementAction(state, action);
  if (!transition.accepted) throw new Error('Unable to apply legal movement action');
  const nextState = transition.state;
  const perspective = perspectiveSide === 'p1' ? 'p1' : 'p2';
  const opponent = perspective === 'p1' ? 'p2' : 'p1';

  return new Float32Array([
    ...createBoardFeatures(state, perspective),
    ...createBoardFeatures(state, opponent),
    ...createBoardFeatures(nextState, perspective),
    ...createBoardFeatures(nextState, opponent),
    ...createActionSlots(action),
    perspective === 'p2' ? 1 : 0,
    Number(state.movementIndex || 0) / 3,
  ]);
};

export const getCandidateFeatureMetadata = () => ({
  featureVersion: CANDIDATE_FEATURE_VERSION,
  featureSize: CANDIDATE_FEATURE_SIZE,
  slotFeatureSize: SLOT_FEATURE_SIZE,
  heroIds: [...HERO_IDS],
  effectNames: [...EFFECT_NAMES],
});
