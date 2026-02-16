import { readFile } from 'node:fs/promises';
import { executeRound } from '../src/battleEngine.js';
import { buildPayloadFromSpec } from '../src/spell.js';
import { getSpellById } from '../src/spells.js';
import { HEROES } from '../src/heroes.js';
import { EFFECTS } from '../src/effects.js';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const heroById = (id) => {
  const hero = HEROES.find(h => h && h.id === id);
  if (!hero) throw new Error(`Hero not found: ${id}`);
  return clone(hero);
};

const makeBoard = () => Array(9).fill(null);
const tile = (hero, overrides = {}) => ({ hero, id: `${hero.id}-${Math.random().toString(36).slice(2, 8)}`, ...overrides });

async function runRound({ p1Board, p2Board, p1Reserve = [], p2Reserve = [], roundNumber = 1 }, onStep = null) {
  const logs = [];
  const addLog = (msg) => logs.push(msg);
  const result = await executeRound(
    { p1Board, p2Board, p1Reserve, p2Reserve, addLog, priorityPlayer: 'player1', roundNumber },
    { castDelayMs: 0, postEffectDelayMs: 0, reactionDelayMs: 0, postCastDelayMs: 0, quiet: true, onStep }
  );
  return { result, logs };
}

async function testKingsBenevolence() {
  const p1 = makeBoard();
  const p2 = makeBoard();

  const king = heroById('kingID');
  king.energy = 3;
  king.speed = 0;
  const allyA = heroById('paladinID');
  allyA.energy = 0; allyA.speed = 0;
  const allyB = heroById('reaperID');
  allyB.energy = 0; allyB.speed = 0;

  p1[4] = tile(king, {
    currentEnergy: 3,
    _castsRemaining: { front: 0, middle: 1, back: 0 },
    spellCasts: [{ spellId: 'benevolence', slot: 'middle' }]
  });
  p1[1] = tile(allyA, { currentEnergy: 0 });
  p1[7] = tile(allyB, { currentEnergy: 0 });

  const beforeA = allyA.spells?.middle?.casts ?? 0;
  const beforeB = allyB.spells?.middle?.casts ?? 0;

  const { result } = await runRound({ p1Board: p1, p2Board: p2 });

  const afterA = result.p1Board[1]?._castsRemaining?.middle;
  const afterB = result.p1Board[7]?._castsRemaining?.middle;
  return {
    pass: afterA === beforeA + 1 && afterB === beforeB + 1,
    details: { beforeA, afterA, beforeB, afterB }
  };
}

async function testSpellEchoBackrow() {
  const p1 = makeBoard();
  const p2 = makeBoard();

  const king = heroById('kingID');
  king.energy = 8;
  king.speed = 0;
  king._towerSpellEcho = 'back';

  const enemy = heroById('paladinID');
  enemy.energy = 0; enemy.speed = 0;

  p1[0] = tile(king, {
    currentEnergy: 8,
    _castsRemaining: { front: 0, middle: 0, back: 1 },
    spellCasts: [{ spellId: 'superiority', slot: 'back' }]
  });
  p2[4] = tile(enemy, { currentEnergy: 0 });

  let castCount = 0;
  await runRound(
    { p1Board: p1, p2Board: p2 },
    (state) => {
      if (state?.lastAction?.type === 'cast' && state.lastAction?.caster?.boardName === 'p1Board' && state.lastAction?.caster?.index === 0) {
        castCount += 1;
      }
    }
  );

  return { pass: castCount >= 2, details: { castCount } };
}

function testMonstrousClawsVsFade() {
  const p1 = makeBoard();
  const p2 = makeBoard();

  const caster = heroById('behemothID');
  const rogue = heroById('rogueID');
  const e1 = heroById('paladinID');
  const e2 = heroById('reaperID');

  p1[4] = tile(caster, { currentEnergy: 0 });

  p2[1] = tile(e1, { currentArmor: 2, currentHealth: 10, effects: [] });
  p2[4] = tile(rogue, { currentArmor: 0, currentHealth: 10, effects: [clone(EFFECTS.Fade)] });
  p2[7] = tile(e2, { currentArmor: 2, currentHealth: 10, effects: [] });

  const spell = getSpellById('monstrousClaws');
  const payload = buildPayloadFromSpec(
    spell.spec,
    { boardName: 'p1Board', index: 4, tile: p1[4] },
    { p1Board: p1, p2Board: p2 }
  );

  const hits = (payload.targets || []).filter(t => t && t.board === 'p2').map(t => t.index).sort((a, b) => a - b);
  return { pass: hits.includes(4) && hits.length === 3, details: { hits } };
}

async function testNymphFruitRules() {
  const p1 = makeBoard();
  const p2 = makeBoard();

  const nymph = heroById('nymphID');
  nymph.energy = 2;
  nymph.speed = 0;

  const ally = heroById('paladinID');
  ally.energy = 0;
  ally.speed = 0;

  p1[0] = tile(nymph, {
    currentEnergy: 2,
    currentHealth: 2,
    _castsRemaining: { front: 0, middle: 0, back: 1 },
    spellCasts: [{ spellId: 'fruitOfTheVine', slot: 'back' }]
  });
  p1[1] = tile(ally, { currentHealth: 5, currentEnergy: 0 });

  const spell = getSpellById('fruitOfTheVine');
  const payload = buildPayloadFromSpec(
    spell.spec,
    { boardName: 'p1Board', index: 0, tile: p1[0] },
    { p1Board: p1, p2Board: p2 }
  );
  const targetOk = payload.targets?.[0]?.board === 'p1' && payload.targets?.[0]?.index === 1;

  const beforeCasterHp = p1[0].currentHealth;
  const { result } = await runRound({ p1Board: p1, p2Board: p2 });
  const afterCasterHp = result.p1Board[0]?.currentHealth;
  const selfDamageOk = afterCasterHp === beforeCasterHp - 1;

  return {
    pass: targetOk && selfDamageOk,
    details: {
      payloadTarget: payload.targets?.[0] || null,
      beforeCasterHp,
      afterCasterHp,
      expectedAfter: beforeCasterHp - 1,
      targetOk,
      selfDamageOk
    }
  };
}

async function testLifeForALifeVsUndyingRage() {
  const p1 = makeBoard();
  const p2 = makeBoard();

  const nephilim = heroById('nephilimID');
  nephilim.energy = 1;
  nephilim.speed = 0;

  const allyLow = heroById('paladinID');
  allyLow.speed = 0;
  allyLow.energy = 0;

  const berserker = heroById('berserkerID');
  berserker.speed = 0;
  berserker.energy = 0;

  p1[4] = tile(nephilim, {
    currentEnergy: 1,
    currentHealth: 10,
    _castsRemaining: { front: 0, middle: 1, back: 0 },
    spellCasts: [{ spellId: 'lifeForALife', slot: 'middle' }]
  });
  p1[1] = tile(allyLow, { currentHealth: 2, currentEnergy: 0 });

  p2[4] = tile(berserker, { currentHealth: 3, currentArmor: 0, currentEnergy: 0 });

  const allyBefore = p1[1].currentHealth;
  const { result } = await runRound({ p1Board: p1, p2Board: p2 });

  const berserkerAfter = result.p2Board[4]?.currentHealth;
  const allyAfter = result.p1Board[1]?.currentHealth;

  return {
    pass: berserkerAfter === 1 && allyAfter === allyBefore,
    details: { allyBefore, allyAfter, berserkerAfter }
  };
}

async function testAnimationStaticGuard() {
  const text = await readFile(new URL('../src/BattlePhase.jsx', import.meta.url), 'utf8');
  const removedP2Flip = !text.includes("flipY: casterSide === 'p2'") && !text.includes("flipY: pendingCasterSide === 'p2'");
  const hasBottomToTopColumn = text.includes('cur.center.y > best.center.y') && text.includes('cur.center.y < best.center.y');
  return { pass: removedP2Flip && hasBottomToTopColumn, details: { removedP2Flip, hasBottomToTopColumn } };
}

async function main() {
  const checks = [
    ['King middle row spell', await testKingsBenevolence()],
    ['Backrow Spell Echo', await testSpellEchoBackrow()],
    ['Monstrous Claws vs Fade row hit', testMonstrousClawsVsFade()],
    ['Nymph fruit target/self-damage rules', await testNymphFruitRules()],
    ['Life for a Life vs Undying Rage', await testLifeForALifeVsUndyingRage()],
    ['Row/column animation static guards', await testAnimationStaticGuard()]
  ];

  console.log('\n=== Quick Tower Regression Check ===');
  let failures = 0;
  for (const [name, result] of checks) {
    if (result?.pass) {
      console.log(`✅ ${name}`);
    } else {
      failures += 1;
      console.log(`❌ ${name}`);
      console.log(`   details: ${JSON.stringify(result?.details || {}, null, 2)}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log('\nAll quick checks passed.');
}

main().catch((err) => {
  console.error('Quick regression script failed:', err);
  process.exit(1);
});
