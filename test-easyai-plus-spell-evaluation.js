import assert from 'node:assert/strict';

import { EFFECTS } from './src/effects.js';
import { HEROES } from './src/heroes.js';
import { evaluateTileValue } from './src/ai/easyAI.js';
import {
  buildEasyAIPlusMovementCandidates,
  EASY_AI_PLUS_EVALUATION_OPTIONS,
} from './src/ai/training/easyAIPlusTeacher.js';
import { deepClone } from './shared/gameLogic.js';

const heroById = (id) => {
  const hero = deepClone(HEROES.find(candidate => candidate.id === id));
  assert(hero, `Missing hero ${id}`);
  return hero;
};

const emptyMain = (side) => Array.from({ length: 9 }, (_, index) => ({
  hero: null,
  effects: [],
  boardName: `${side}Board`,
  index,
}));

const emptyReserve = (side) => Array.from({ length: 2 }, (_, index) => ({
  hero: null,
  effects: [],
  boardName: `${side}Reserve`,
  index,
}));

const placeHero = (board, index, hero, overrides = {}) => {
  const tile = {
    ...board[index],
    hero,
    currentHealth: Number(overrides.currentHealth ?? hero.health),
    currentArmor: Number(overrides.currentArmor ?? hero.armor),
    currentEnergy: Number(overrides.currentEnergy ?? hero.energy ?? 0),
    currentSpeed: Number(overrides.currentSpeed ?? hero.speed),
    currentSpellPower: Number(overrides.currentSpellPower ?? hero.spellPower ?? 0),
    effects: overrides.effects || [],
    _dead: overrides._dead === true,
  };
  board[index] = tile;
  return tile;
};

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const berserker = heroById('berserkerID');
  const enemy = heroById('warriorID');
  placeHero(p1Board, 4, enemy, { currentHealth: enemy.health });

  const frontTile = placeHero(p2Board, 0, berserker, { currentHealth: 1 });
  const berserkValue = evaluateTileValue(berserker, 0, true, p1Board, emptyReserve('p1'), p2Board, emptyReserve('p2'), frontTile);

  const middleTile = placeHero(p2Board, 1, berserker, { currentHealth: 1 });
  const slashValue = evaluateTileValue(berserker, 1, true, p1Board, emptyReserve('p1'), p2Board, emptyReserve('p2'), middleTile);

  assert.ok(
    berserkValue > slashValue,
    `Expected 1-health Berserk (${berserkValue}) to outrank Slash (${slashValue}); Berserk should deal 8 before armor.`,
  );
}

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const p1Reserve = emptyReserve('p1');
  const p2Reserve = emptyReserve('p2');
  const necromancer = heroById('necromancerID');
  const casterTile = placeHero(p2Board, 4, necromancer);

  const noCorpseValue = evaluateTileValue(necromancer, 4, true, p1Board, p1Reserve, p2Board, p2Reserve, casterTile, EASY_AI_PLUS_EVALUATION_OPTIONS);

  const fallenAlly = heroById('warriorID');
  placeHero(p2Board, 0, fallenAlly, {
    currentHealth: 0,
    effects: [EFFECTS.Bleed],
    _dead: true,
  });
  const raiseDeadValue = evaluateTileValue(necromancer, 4, true, p1Board, p1Reserve, p2Board, p2Reserve, casterTile, EASY_AI_PLUS_EVALUATION_OPTIONS);

  assert.ok(
    raiseDeadValue > noCorpseValue,
    `Expected Raise Dead with an ally corpse (${raiseDeadValue}) to outrank the no-corpse case (${noCorpseValue}).`,
  );
}

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const p1Reserve = emptyReserve('p1');
  const p2Reserve = emptyReserve('p2');
  const oopsCaster = {
    id: 'evaluation-oops-caster',
    name: 'Evaluation OOPS Caster',
    health: 10,
    armor: 0,
    speed: 1,
    energy: 0,
    spells: { front: { id: 'oops', cost: 1, casts: 1 } },
  };
  const ally = heroById('warriorID');
  const enemy = heroById('warriorID');
  const casterTile = placeHero(p2Board, 0, oopsCaster);
  placeHero(p1Board, 4, enemy, { currentHealth: enemy.health });
  placeHero(p2Board, 3, ally, { currentHealth: 4 });
  const noKillValue = evaluateTileValue(oopsCaster, 0, true, p1Board, p1Reserve, p2Board, p2Reserve, casterTile, EASY_AI_PLUS_EVALUATION_OPTIONS);

  placeHero(p2Board, 3, ally, { currentHealth: 3 });
  const killValue = evaluateTileValue(oopsCaster, 0, true, p1Board, p1Reserve, p2Board, p2Reserve, casterTile, EASY_AI_PLUS_EVALUATION_OPTIONS);

  assert.ok(
    killValue > noKillValue + 20,
    `Expected OOPS!! (${killValue}) to include its 25-damage secondary after a lethal primary, not-kill value was ${noKillValue}.`,
  );
}

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const fanCaster = {
    id: 'evaluation-fan-caster',
    name: 'Evaluation Fan Caster',
    health: 10,
    armor: 0,
    speed: 1,
    energy: 0,
    spells: { front: { id: 'fan', cost: 1, casts: 1 } },
  };
  const enemy = heroById('warriorID');
  const casterTile = placeHero(p2Board, 0, fanCaster);
  placeHero(p1Board, 0, enemy);

  const fanValue = evaluateTileValue(fanCaster, 0, true, p1Board, emptyReserve('p1'), p2Board, emptyReserve('p2'), casterTile, EASY_AI_PLUS_EVALUATION_OPTIONS);

  assert.ok(fanValue > 1, `Expected Fan (${fanValue}) to receive positional value for moving a valid enemy row.`);
}

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const elder = heroById('elderID');
  const bileCreature = heroById('bileCreatureID');
  const enemy = heroById('warriorID');
  placeHero(p2Board, 4, elder);
  placeHero(p2Board, 0, bileCreature);
  placeHero(p1Board, 4, enemy);

  const truthWithoutDebuff = buildEasyAIPlusMovementCandidates(p2Board, [], p1Board, [])
    .find(candidate => candidate.sourceId === 'p2:4' && candidate.destinationId === 'p2:2');
  assert(truthWithoutDebuff, 'Expected an Elder-to-Truth-row movement candidate.');
  assert.ok(
    truthWithoutDebuff.delta < 0,
    `Expected Truth to lose value with no debuffed enemies despite a debuff-capable ally, got ${truthWithoutDebuff.delta}.`,
  );

  p1Board[4].effects = [EFFECTS.Poison];
  const truthWithDebuff = buildEasyAIPlusMovementCandidates(p2Board, [], p1Board, [])
    .find(candidate => candidate.sourceId === 'p2:4' && candidate.destinationId === 'p2:2');
  assert(truthWithDebuff, 'Expected an Elder-to-Truth-row movement candidate with a debuffed enemy.');
  assert.ok(
    truthWithDebuff.delta > truthWithoutDebuff.delta,
    `Expected an actual enemy debuff to increase Truth's value, got ${truthWithoutDebuff.delta} without and ${truthWithDebuff.delta} with one.`,
  );
}

console.log('EasyAI spell evaluation regression test passed');
