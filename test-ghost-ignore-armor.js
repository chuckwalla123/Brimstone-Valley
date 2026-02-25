import { buildPayloadFromSpec } from './src/spell.js';
import { getSpellById } from './src/spells.js';
import { EFFECTS } from './src/effects.js';

function makeTile(hero, id) {
  return {
    id,
    hero: { ...hero },
    currentHealth: Number(hero.health || 0),
    currentArmor: Number(hero.armor || 0),
    currentSpeed: Number(hero.speed || 0),
    currentEnergy: Number(hero.energy || 0),
    currentSpellPower: Number(hero.spellPower || 0),
    effects: [],
    spellCasts: []
  };
}

async function run() {
  const meteor = getSpellById('meteor');
  if (!meteor || !meteor.spec) {
    throw new Error('Meteor spell not found; cannot run Ghost armor-ignore test.');
  }

  const armor = 5;
  const baseValue = Number(meteor.spec?.formula?.value || 0);
  const dummyBoardsA = {
    p1Board: Array(9).fill(null),
    p2Board: Array(9).fill(null)
  };
  dummyBoardsA.p1Board[2] = makeTile(
    {
      id: 'normalCasterPayload',
      name: 'Normal Payload Caster',
      health: 30,
      armor: 0,
      speed: 0,
      energy: 0,
      spellPower: 0,
      passives: [],
      spells: { front: { id: 'meteor', cost: 1, casts: 1 }, middle: { id: 'basicAttack', cost: 1, casts: 1 }, back: { id: 'basicAttack', cost: 1, casts: 1 } }
    },
    'payload-caster-normal'
  );
  dummyBoardsA.p2Board[0] = makeTile(
    { id: 'payload-target', name: 'Payload Target', health: 30, armor, speed: 0, energy: 0, spellPower: 0, spells: { front: { id: 'basicAttack', cost: 1, casts: 1 }, middle: { id: 'basicAttack', cost: 1, casts: 1 }, back: { id: 'basicAttack', cost: 1, casts: 1 } } },
    'payload-target'
  );

  const dummyBoardsB = {
    p1Board: Array(9).fill(null),
    p2Board: Array(9).fill(null)
  };
  dummyBoardsB.p1Board[2] = makeTile(
    {
      id: 'ghostCasterPayload',
      name: 'Ghost Payload Caster',
      health: 30,
      armor: 0,
      speed: 0,
      energy: 0,
      spellPower: 0,
      passives: [EFFECTS.Ghost],
      spells: { front: { id: 'meteor', cost: 1, casts: 1 }, middle: { id: 'basicAttack', cost: 1, casts: 1 }, back: { id: 'basicAttack', cost: 1, casts: 1 } }
    },
    'payload-caster-ghost'
  );
  dummyBoardsB.p2Board[0] = makeTile(
    { id: 'payload-target', name: 'Payload Target', health: 30, armor, speed: 0, energy: 0, spellPower: 0, spells: { front: { id: 'basicAttack', cost: 1, casts: 1 }, middle: { id: 'basicAttack', cost: 1, casts: 1 }, back: { id: 'basicAttack', cost: 1, casts: 1 } } },
    'payload-target'
  );

  const payloadWithoutGhost = buildPayloadFromSpec(
    meteor.spec,
    { boardName: 'p1', index: 2, tile: dummyBoardsA.p1Board[2] },
    dummyBoardsA
  );
  const payloadWithGhost = buildPayloadFromSpec(
    meteor.spec,
    { boardName: 'p1', index: 2, tile: dummyBoardsB.p1Board[2] },
    dummyBoardsB
  );

  const noGhostFrag = payloadWithoutGhost?.perTargetPayloads?.[0];
  const ghostFrag = payloadWithGhost?.perTargetPayloads?.[0];
  const noGhostIgnoreArmor = !!(noGhostFrag?.ignoreArmor);
  const ghostIgnoreArmor = !!(ghostFrag?.ignoreArmor);
  const noGhostValue = Number(noGhostFrag?.value || 0);
  const ghostValue = Number(ghostFrag?.value || 0);

  const effectiveWithoutGhost = Math.max(0, noGhostValue - armor);
  const effectiveWithGhost = Math.max(0, ghostValue);

  const expectedWithoutGhost = Math.max(0, baseValue - armor);
  const expectedWithGhost = Math.max(0, baseValue);

  console.log('\n=== Ghost Ignore Armor Regression Test ===');
  console.log(`Meteor base value: ${baseValue}`);
  console.log(`Payload ignoreArmor without Ghost (expected false): ${noGhostIgnoreArmor}`);
  console.log(`Payload ignoreArmor with Ghost (expected true): ${ghostIgnoreArmor}`);
  console.log(`Effective damage without Ghost (expected ${expectedWithoutGhost}): ${effectiveWithoutGhost}`);
  console.log(`Effective damage with Ghost (expected ${expectedWithGhost}): ${effectiveWithGhost}`);

  const pass =
    noGhostIgnoreArmor === false
    && ghostIgnoreArmor === true
    && effectiveWithoutGhost === expectedWithoutGhost
    && effectiveWithGhost === expectedWithGhost;

  console.log(`\nResult: ${pass ? 'PASS' : 'FAIL'}`);

  if (!pass) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('Ghost ignore-armor test failed with exception:', err);
  process.exit(1);
});
