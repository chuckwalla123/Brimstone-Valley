// Regression test for furthest targeting (used by Shuriken)
// Run with: node test-shuriken-targeting.js

import assert from 'node:assert/strict';
import { resolveTargets } from './src/targeting.js';

const mk = (id) => ({ hero: { id }, currentHealth: 10 });

function distFromCaster(casterIndex, casterSide, targetIndex, targetSide) {
  const cCol = casterIndex % 3;
  const cRow = Math.floor(casterIndex / 3);
  const tCol = targetIndex % 3;
  const tRow = Math.floor(targetIndex / 3);

  const cX = cCol + (casterSide === 'p2' ? 3 : (casterSide === 'p3' ? 6 : 0));
  const tX = tCol + (targetSide === 'p2' ? 3 : (targetSide === 'p3' ? 6 : 0));
  return Math.abs(tX - cX) + Math.abs(tRow - cRow);
}

function runCase(name, { casterIndex, casterSide = 'p1', targetSide = 'p2', enemyIndices, expectedOneOf, expectFrontRowAllowed = false }) {
  const p1Board = Array(9).fill(null);
  const p2Board = Array(9).fill(null);

  if (casterSide === 'p1') {
    p1Board[casterIndex] = mk('caster');
  } else {
    p2Board[casterIndex] = mk('caster');
  }
  const enemyBoard = targetSide === 'p1' ? p1Board : p2Board;
  for (const idx of enemyIndices) enemyBoard[idx] = mk(`enemy-${idx}`);

  const out = resolveTargets(
    [{ type: 'furthest', side: 'enemy', max: 1 }],
    { boardName: casterSide === 'p1' ? 'p1Board' : 'p2Board', index: casterIndex },
    { p1Board, p2Board }
  );

  assert.equal(out.length, 1, `${name}: expected exactly one target`);
  assert.equal(out[0].board, targetSide, `${name}: expected enemy board token`);

  const picked = out[0].index;
  const dPicked = distFromCaster(casterIndex, casterSide, picked, targetSide);
  const maxDist = Math.max(...enemyIndices.map(i => distFromCaster(casterIndex, casterSide, i, targetSide)));

  assert.equal(
    dPicked,
    maxDist,
    `${name}: picked index ${picked} at distance ${dPicked}, expected max distance ${maxDist}`
  );

  if (expectedOneOf && expectedOneOf.length > 0) {
    assert.ok(
      expectedOneOf.includes(picked),
      `${name}: picked index ${picked}, expected one of [${expectedOneOf.join(', ')}]`
    );
  }

  if (expectFrontRowAllowed) {
    const pickedRow = Math.floor(picked / 3);
    assert.equal(pickedRow, 0, `${name}: expected front-row furthest winner`);
  }

  console.log(`✓ ${name} -> picked p2[${picked}] (distance ${dPicked})`);
}

function run() {
  // Exhaustive sanity: with all enemy slots occupied, picked target must always be at max Manhattan distance.
  for (let casterIndex = 0; casterIndex < 9; casterIndex++) {
    runCase(`Exhaustive caster ${casterIndex}`, {
      casterIndex,
      enemyIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8]
    });
  }

  // Explicit case where front row is the furthest valid Manhattan target.
  // Caster at p2 index 8; enemies at p1 index 0 (front, farther) and p1 index 6 (back, closer).
  runCase('Front row can be correct furthest', {
    casterIndex: 8,
    casterSide: 'p2',
    targetSide: 'p1',
    enemyIndices: [0, 6],
    expectedOneOf: [0],
    expectFrontRowAllowed: true
  });

  console.log('\nAll furthest-targeting checks passed.');
}

run();
