// Test script to verify Static Shock effect behavior
// Run with: node test-static-shock.js

import { executeRound } from './src/battleEngine.js';
import { EFFECTS } from './src/effects.js';

// Create a simple test setup: P1 casts Static Shock on P2 enemy
// Then check that on next round, Static Shock damages P2's adjacent tiles

const testHero1 = {
  id: 'testCaster',
  name: 'Test Caster',
  health: 10,
  armor: 0,
  speed: 0,  // no energy gain
  energy: 0,
  spellPower: 2,
  spells: { front: { id: 'testSpell', cost: 0, casts: 0 } }
};

const testHero2 = {
  id: 'testTarget',
  name: 'Test Target',
  health: 10,
  armor: 0,
  speed: 0,  // no energy gain
  energy: 0,
  spellPower: 0,
  spells: { front: { id: 'basicAttack', cost: 1, casts: 0 } }
};

const testHero3 = {
  id: 'testAdjacent1',
  name: 'Adjacent 1',
  health: 10,
  armor: 0,
  speed: 0,  // no energy gain
  energy: 0,
  spellPower: 0,
  spells: { front: { id: 'basicAttack', cost: 1, casts: 0 } }
};

const testHero4 = {
  id: 'testAdjacent2',
  name: 'Adjacent 2',
  health: 10,
  armor: 0,
  speed: 0,  // no energy gain
  energy: 0,
  spellPower: 0,
  spells: { front: { id: 'basicAttack', cost: 1, casts: 0 } }
};

async function runTest() {
  console.log('\n=== Static Shock Test ===\n');

  // Setup: P1 has a caster at index 4 (middle center)
  // P2 has target at index 4 (middle center) with two adjacent at 3 and 5
  const p1Board = Array(9).fill(null);
  p1Board[4] = { hero: { ...testHero1 }, id: 'p1-4' };

  const p2Board = Array(9).fill(null);
  p2Board[3] = { hero: { ...testHero3 }, id: 'p2-3' };
  p2Board[4] = { hero: { ...testHero2 }, id: 'p2-4' };
  p2Board[5] = { hero: { ...testHero4 }, id: 'p2-5' };

  const logs = [];
  const addLog = (msg) => {
    logs.push(msg);
    console.log(msg);
  };

  console.log('Initial setup:');
  console.log('P1[4]: Caster');
  console.log('P2[3]: Adjacent1, P2[4]: Target (will get Static Shock), P2[5]: Adjacent2\n');

  // Manually apply Static Shock to P2[4] as if the caster applied it
  const staticShockEffect = { ...EFFECTS.StaticShock };
  p2Board[4].effects = [staticShockEffect];
  // Annotate with applier info
  staticShockEffect.appliedBy = { boardName: 'p1Board', index: 4, tile: p1Board[4] };
  
  console.log('Applied Static Shock to P2[4] with appliedBy = P1[4]\n');
  console.log('Effect definition:', JSON.stringify(staticShockEffect, null, 2));
  console.log('\n--- Running Round ---\n');

  const result = await executeRound({
    p1Board,
    p2Board,
    p1Reserve: [],
    p2Reserve: [],
    addLog,
    priorityPlayer: 'player1'
  }, {
    castDelayMs: 0,
    postEffectDelayMs: 0,
    onStep: (state) => {
      if (state.lastAction && state.lastAction.type === 'effectPulse') {
        console.log(`\n>>> UI Event: effectPulse`);
        console.log(`    Effect: ${state.lastAction.effectName}`);
        console.log(`    Action: ${state.lastAction.action}`);
        console.log(`    Amount: ${state.lastAction.amount}`);
        console.log(`    Target: ${state.lastAction.target.boardName}[${state.lastAction.target.index}]`);
        console.log(`    EffectIndex: ${state.lastAction.effectIndex}`);
      }
    }
  });

  console.log('\n--- Round Complete ---\n');
  console.log('Final state:');
  console.log(`P2[3] HP: ${result.p2Board[3]?.currentHealth || 'N/A'} (should be 8 if Static Shock hit)`);
  console.log(`P2[4] HP: ${result.p2Board[4]?.currentHealth || 'N/A'}`);
  console.log(`P2[5] HP: ${result.p2Board[5]?.currentHealth || 'N/A'} (should be 8 if Static Shock hit)`);

  // Verify Static Shock targeted P1's enemies (P2's heroes), not P2's allies
  const p2_3_damaged = result.p2Board[3]?.currentHealth < 10;
  const p2_5_damaged = result.p2Board[5]?.currentHealth < 10;
  
  if (p2_3_damaged && p2_5_damaged) {
    console.log('\n✓ SUCCESS: Static Shock correctly targeted the caster\'s enemies (P2 heroes adjacent to the effect owner)');
  } else {
    console.log('\n✗ FAILURE: Static Shock did not damage the adjacent enemies as expected');
  }

  console.log('\n=== Test Complete ===\n');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
