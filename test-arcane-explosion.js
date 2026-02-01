// Test script for Arcane Explosion bug fix
// Verifies that adjacent targeting works correctly with perTargetExtras

import { buildPayloadFromSpec } from './src/spell.js';
import { getSpellById } from './src/spells.js';

// Create a simple 3x3 board setup with enemies in adjacent positions
const p1Board = Array(9).fill(null);
const p2Board = Array(9).fill(null);

// Place caster at p1[4] (middle center)
p1Board[4] = {
  hero: { id: 'arcaneMageID', name: 'Arcane Mage', health: 30, armor: 2, speed: 5, spellPower: 8 },
  currentHealth: 30,
  currentArmor: 2,
  currentSpeed: 5,
  currentSpellPower: 8,
  effects: []
};

// Place enemy with 3 buffs at p2[4] (should be primary target)
p2Board[4] = {
  hero: { id: 'enemyID1', name: 'Buffed Enemy', health: 25, armor: 3, speed: 4 },
  currentHealth: 25,
  currentArmor: 3,
  currentSpeed: 4,
  currentSpellPower: 0,
  effects: [
    { name: 'Armor Up', kind: 'buff' },
    { name: 'Speed Up', kind: 'buff' },
    { name: 'Attack Up', kind: 'buff' }
  ]
};

// Place adjacent enemies at p2[1] (above) and p2[7] (below)
p2Board[1] = {
  hero: { id: 'enemyID2', name: 'Adjacent Enemy 1', health: 20, armor: 2, speed: 3 },
  currentHealth: 20,
  currentArmor: 2,
  currentSpeed: 3,
  currentSpellPower: 0,
  effects: []
};

p2Board[7] = {
  hero: { id: 'enemyID3', name: 'Adjacent Enemy 2', health: 20, armor: 2, speed: 3 },
  currentHealth: 20,
  currentArmor: 2,
  currentSpeed: 3,
  currentSpellPower: 0,
  effects: []
};

// Also place adjacent enemy at p2[3] (left) to test multiple adjacents
p2Board[3] = {
  hero: { id: 'enemyID4', name: 'Adjacent Enemy 3', health: 20, armor: 2, speed: 3 },
  currentHealth: 20,
  currentArmor: 2,
  currentSpeed: 3,
  currentSpellPower: 0,
  effects: []
};

const casterRef = {
  boardName: 'p1',
  index: 4,
  tile: p1Board[4]
};

// Get arcaneExplosion spell and build payload
const spell = getSpellById('arcaneExplosion');
console.log('\n=== Arcane Explosion Spell Definition ===');
console.log('Targets:', JSON.stringify(spell.spec.targets, null, 2));
console.log('perTargetExtras:', JSON.stringify(spell.spec.perTargetExtras, null, 2));

console.log('\n=== Building Payload ===');
const payload = buildPayloadFromSpec(spell.spec, casterRef, { p1Board, p2Board });

console.log('\nResolved Targets:');
payload.targets.forEach((target, i) => {
  if (target) {
    const board = target.board === 'p1' ? p1Board : p2Board;
    const tile = board[target.index];
    const heroName = tile?.hero?.name || 'Unknown';
    const buffCount = tile?.effects?.filter(e => e.kind === 'buff').length || 0;
    console.log(`  [${i}] ${target.board}[${target.index}] - ${heroName} (${buffCount} buffs)`);
  } else {
    console.log(`  [${i}] null`);
  }
});

console.log('\nPer-Target Payloads:');
payload.perTargetPayloads.forEach((p, i) => {
  console.log(`  [${i}]`, JSON.stringify(p, null, 2));
});

// Verify the fix
console.log('\n=== Verification ===');
let passed = true;

// Check that we have the right number of targets
const expectedTargetCount = 4; // 1 mostBuffs + 3 adjacent
if (payload.targets.length !== expectedTargetCount) {
  console.error(`❌ FAIL: Expected ${expectedTargetCount} targets, got ${payload.targets.length}`);
  passed = false;
} else {
  console.log(`✓ Correct number of targets: ${expectedTargetCount}`);
}

// Check that the first target (mostBuffs) has removeTopPositiveEffect
const firstPayload = payload.perTargetPayloads[0];
if (firstPayload?.post?.removeTopPositiveEffect !== true) {
  console.error('❌ FAIL: First target (mostBuffs) should have removeTopPositiveEffect');
  passed = false;
} else {
  console.log('✓ First target has removeTopPositiveEffect');
}

// Check that adjacent targets do NOT have removeTopPositiveEffect
for (let i = 1; i < payload.perTargetPayloads.length; i++) {
  const p = payload.perTargetPayloads[i];
  if (p?.post?.removeTopPositiveEffect === true) {
    console.error(`❌ FAIL: Adjacent target [${i}] should NOT have removeTopPositiveEffect`);
    passed = false;
  }
}
console.log('✓ Adjacent targets do not have removeTopPositiveEffect');

// Check that all targets have damage action
for (let i = 0; i < payload.perTargetPayloads.length; i++) {
  const p = payload.perTargetPayloads[i];
  if (p?.action !== 'damage') {
    console.error(`❌ FAIL: Target [${i}] should have damage action, got ${p?.action}`);
    passed = false;
  }
}
console.log('✓ All targets have damage action');

// Check that the primary target is the one with most buffs (p2[4])
const primaryTarget = payload.targets[0];
if (primaryTarget?.board !== 'p2' || primaryTarget?.index !== 4) {
  console.error(`❌ FAIL: Primary target should be p2[4], got ${primaryTarget?.board}[${primaryTarget?.index}]`);
  passed = false;
} else {
  console.log('✓ Primary target is the enemy with most buffs');
}

// Check that adjacent targets are correct (indices 1, 3, 7 on p2 board)
const adjacentIndices = payload.targets.slice(1).map(t => t?.index).sort((a, b) => a - b);
const expectedAdjacent = [1, 3, 7];
if (JSON.stringify(adjacentIndices) !== JSON.stringify(expectedAdjacent)) {
  console.error(`❌ FAIL: Adjacent indices should be ${expectedAdjacent}, got ${adjacentIndices}`);
  passed = false;
} else {
  console.log('✓ Adjacent targets are correct');
}

console.log('\n' + '='.repeat(50));
if (passed) {
  console.log('✅ ALL TESTS PASSED - Arcane Explosion fix verified!');
} else {
  console.log('❌ SOME TESTS FAILED - Review output above');
  process.exit(1);
}
