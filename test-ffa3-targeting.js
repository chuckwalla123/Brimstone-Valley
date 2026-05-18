import assert from 'node:assert/strict';
import { resolveTargets } from './src/targeting.js';

const mk = (id) => ({ hero: { id }, currentHealth: 10 });

function buildBoards() {
  return {
    p1Board: Array(9).fill(null),
    p2Board: Array(9).fill(null),
    p3Board: Array(9).fill(null)
  };
}

function runCase(name, { casterSide, casterIndex, targetType, enemyIndices, expectedIndex }) {
  const boards = buildBoards();
  boards[`${casterSide}Board`][casterIndex] = mk(`${casterSide}-caster`);
  enemyIndices.forEach((index) => {
    boards.p3Board[index] = mk(`p3-${index}`);
  });

  const out = resolveTargets(
    [{ type: targetType, side: 'enemy', max: 1 }],
    { boardName: `${casterSide}Board`, index: casterIndex },
    boards,
    null,
    { forceEnemySide: 'p3' }
  );

  assert.equal(out.length, 1, `${name}: expected exactly one target`);
  assert.equal(out[0].board, 'p3', `${name}: expected to target p3`);
  assert.equal(out[0].index, expectedIndex, `${name}: wrong target selected`);
  console.log(`✓ ${name} -> p3[${out[0].index}]`);
}

runCase('P2 nearest to P3 prefers right-front lane', {
  casterSide: 'p2',
  casterIndex: 0,
  targetType: 'nearest',
  enemyIndices: [0, 1, 2],
  expectedIndex: 2
});

runCase('P2 furthest from P3 prefers left-front lane', {
  casterSide: 'p2',
  casterIndex: 0,
  targetType: 'furthest',
  enemyIndices: [0, 1, 2],
  expectedIndex: 0
});

runCase('P1 nearest to P3 prefers left-front lane', {
  casterSide: 'p1',
  casterIndex: 0,
  targetType: 'nearest',
  enemyIndices: [0, 1, 2],
  expectedIndex: 0
});

runCase('P1 furthest from P3 prefers right-front lane', {
  casterSide: 'p1',
  casterIndex: 0,
  targetType: 'furthest',
  enemyIndices: [0, 1, 2],
  expectedIndex: 2
});

console.log('\nFFA3 targeting checks passed.');