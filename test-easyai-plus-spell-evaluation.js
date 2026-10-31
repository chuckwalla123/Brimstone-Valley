import assert from 'node:assert/strict';

import { EFFECTS } from './src/effects.js';
import { evaluateEffectValue } from './src/ai/effectValue.js';
import { HEROES } from './src/heroes.js';
import { evaluateTileValue } from './src/ai/easyAI.js';
import {
  buildEasyAIPlusMovementCandidates,
  evaluateEasyAIPlusSetupScore,
  EASY_AI_PLUS_EVALUATION_OPTIONS,
} from './src/ai/training/easyAIPlusTeacher.js';
import { deepClone } from './shared/gameLogic.js';

assert.equal(EASY_AI_PLUS_EVALUATION_OPTIONS.useEffectEvaluationOverrides, false);
assert.equal(evaluateEffectValue(EFFECTS.Treachery), 2);
assert.equal(evaluateEffectValue(EFFECTS.Treachery, { useOverrides: false, targetArmor: 3 }), 18);

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

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const jester = heroById('jesterID');
  placeHero(p1Board, 4, heroById('warriorID'));
  placeHero(p2Board, 3, heroById('warriorID'), { currentHealth: 8 });
  const casterTile = placeHero(p2Board, 2, jester);
  const oopsValue = evaluateTileValue(jester, 2, true, p1Board, emptyReserve('p1'), p2Board, emptyReserve('p2'), casterTile, EASY_AI_PLUS_EVALUATION_OPTIONS);
  assert.ok(oopsValue < 1, `Expected non-lethal OOPS!! (${oopsValue}) to count self-inflicted ally damage as a cost.`);
}

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const monk = heroById('monkID');
  placeHero(p1Board, 4, heroById('warriorID'));
  placeHero(p2Board, 4, heroById('warriorID'));
  const casterTile = placeHero(p2Board, 2, monk);
  const reviveValue = evaluateTileValue(monk, 2, true, p1Board, emptyReserve('p1'), p2Board, emptyReserve('p2'), casterTile, EASY_AI_PLUS_EVALUATION_OPTIONS);
  assert.ok(reviveValue > 1, `Expected Revive (${reviveValue}) to retain option value without a corpse.`);
}

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const assassin = heroById('assassinID');
  placeHero(p2Board, 1, assassin);
  placeHero(p2Board, 5, heroById('warriorID'));
  placeHero(p1Board, 4, heroById('warriorID'));
  const assassinTile = p2Board[1];
  const value = () => evaluateTileValue(assassin, 1, true, p1Board, emptyReserve('p1'), p2Board, emptyReserve('p2'), assassinTile, EASY_AI_PLUS_EVALUATION_OPTIONS);
  const noMark = value();
  assert.equal(noMark, 1, `Assassinate with no marks should add nothing beyond the basic attack, got ${noMark}.`);
  p1Board[4].effects = [EFFECTS.Marked];
  const oneMark = value() - 1;
  assert.equal(oneMark, (7 - p1Board[4].currentArmor) * (assassin.speed / assassin.spells.middle.cost),
    `Assassinate should value each marked target at (7 - armor) × speed/cost, got ${oneMark}.`);
  placeHero(p1Board, 3, heroById('warriorID'), { effects: [EFFECTS.Marked] });
  const twoMarks = value() - 1;
  assert.ok(oneMark > 0 && Math.abs(twoMarks - oneMark * 2) < 1e-9, `Expected value to scale with marks (${oneMark}, ${twoMarks}).`);
  assert.equal(evaluateEasyAIPlusSetupScore(p2Board, [], p1Board, []), 0, 'Setup score should not penalize Assassinate while an enemy is marked.');
  assert.ok(evaluateEasyAIPlusSetupScore(p2Board, [], emptyMain('p1'), []) < 0, 'Setup score should penalize Assassinate when nothing is marked.');
}

{
  const king = heroById('kingID');
  const p1Reserve = emptyReserve('p1');
  const p2Reserve = emptyReserve('p2');
  const getKingRowValues = (enemyHero) => {
    const p1Board = emptyMain('p1');
    placeHero(p1Board, 4, enemyHero);
    const values = {};
    for (const index of [3, 2]) {
      const p2Board = emptyMain('p2');
      const kingTile = placeHero(p2Board, index, king);
      values[index] = evaluateTileValue(
        king,
        index,
        true,
        p1Board,
        p1Reserve,
        p2Board,
        p2Reserve,
        kingTile,
        EASY_AI_PLUS_EVALUATION_OPTIONS,
      );
    }
    return values;
  };

  const againstWarrior = getKingRowValues(heroById('warriorID'));
  assert.ok(
    againstWarrior[3] > againstWarrior[2],
    `Expected Subjugation to beat Superiority against a 2-armor Warrior (${againstWarrior[3]} vs ${againstWarrior[2]}).`,
  );

  const againstAssassin = getKingRowValues(heroById('assassinID'));
  assert.ok(
    againstAssassin[3] > againstAssassin[2],
    `Expected Subjugation to beat Superiority against a 0-armor Assassin under formula-only evaluation (${againstAssassin[3]} vs ${againstAssassin[2]}).`,
  );
}

{
  const p1Board = emptyMain('p1');
  const p2Board = emptyMain('p2');
  const columnCaster = {
    id: 'column-caster',
    name: 'Column Caster',
    health: 10,
    armor: 0,
    speed: 1,
    energy: 0,
    spells: { front: { id: 'engage', cost: 1, casts: 3 }, middle: { id: 'engage', cost: 1, casts: 3 }, back: { id: 'engage', cost: 1, casts: 3 } },
  };
  placeHero(p1Board, 3, columnCaster);
  placeHero(p2Board, 0, heroById('warriorID'));
  placeHero(p2Board, 1, heroById('warriorID'));
  placeHero(p2Board, 3, heroById('warriorID'));
  const stackMove = (context) => buildEasyAIPlusMovementCandidates(p2Board, [], p1Board, [], context)
    .find(candidate => candidate.sourceId === 'p2:3' && candidate.destinationId === 'p2:2');
  const plain = stackMove({});
  const lastMove = stackMove({ opponentHasLastMove: true });
  assert.equal(plain.columnStackPenalty, 0);
  assert.ok(lastMove.columnStackPenalty >= 8, `Expected a third hero in one column to be penalized, got ${lastMove.columnStackPenalty}.`);
  assert.ok(lastMove.delta < plain.delta, 'Column stacking should score worse when the opponent has the last move.');
}

console.log('EasyAI spell evaluation regression test passed');
