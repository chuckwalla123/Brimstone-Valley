import { resolveTargets } from './src/targeting.js';

function emptySlot() {
  return { hero: null, effects: [] };
}

async function run() {
  const p1Board = Array.from({ length: 9 }, emptySlot);
  p1Board[4] = { hero: { id: 'enchantressID', name: 'Enchantress' }, effects: [] };
  p1Board[1] = { hero: { id: 'ally-a', name: 'Ally A' }, effects: [{ name: 'Burn', kind: 'debuff' }] };
  p1Board[7] = { hero: { id: 'ally-b', name: 'Ally B' }, effects: [] };

  const targets = resolveTargets(
    [{ type: 'leastEffects', side: 'ally', max: 1, excludeSelf: true }],
    { boardName: 'p1Board', index: 4 },
    { p1Board, p2Board: [], p3Board: [] }
  );

  if (!targets[0] || targets[0].board !== 'p1' || Number(targets[0].index) !== 7) {
    console.error('Enchant Strength self-target regression FAILED:', targets);
    process.exit(1);
  }

  console.log('Enchant Strength self-target regression PASSED');
}

run().catch((error) => {
  console.error('Enchant Strength self-target regression crashed:', error);
  process.exit(1);
});