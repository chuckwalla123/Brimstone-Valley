import { executeRound } from './src/battleEngine.js';
import { EFFECTS } from './src/effects.js';
import { HEROES } from './src/heroes.js';
import { makeEmptyMain, makeReserve } from './shared/gameLogic.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function heroById(id, { castsBySlot = null, passivesOverride = null } = {}) {
  const base = HEROES.find(h => h.id === id);
  if (!base) throw new Error(`Hero not found: ${id}`);
  const hero = clone(base);
  if (passivesOverride) {
    hero.passives = passivesOverride;
  }
  if (castsBySlot && hero.spells) {
    ['front', 'middle', 'back'].forEach((slot) => {
      if (!hero.spells[slot]) return;
      if (typeof castsBySlot[slot] === 'number') {
        hero.spells[slot].casts = castsBySlot[slot];
      }
    });
  }
  return hero;
}

function testState() {
  return {
    p1Board: makeEmptyMain('p1'),
    p2Board: makeEmptyMain('p2'),
    p1Reserve: makeReserve('p1'),
    p2Reserve: makeReserve('p2')
  };
}

async function runRound(state) {
  const logs = [];
  const out = await executeRound({
    p1Board: state.p1Board,
    p2Board: state.p2Board,
    p1Reserve: state.p1Reserve,
    p2Reserve: state.p2Reserve,
    priorityPlayer: 'player1',
    roundNumber: 1,
    addLog: (line) => logs.push(String(line || ''))
  }, {
    quiet: true,
    castDelayMs: 0,
    reactionDelayMs: 0,
    postCastDelayMs: 0,
    postEffectDelayMs: 0,
    speedMultiplier: 100
  });
  return { out, logs };
}

function hasLinkGainLog(logs, heroName) {
  const needle = `${heroName} Link: gained 1 Energy from ally cast.`;
  return (logs || []).some(line => line.includes(needle));
}

function details(logs, out, holderIndex = 2) {
  return {
    holderEnergyAfter: Number(out?.p1Board?.[holderIndex]?.currentEnergy || 0),
    linkLogs: (logs || []).filter(line => line.includes('Link: gained'))
  };
}

async function casePassiveSelfCastNoGain() {
  const s = testState();
  const holderName = 'Link Passive Self';
  const selfCaster = heroById('priestID', {
    castsBySlot: { front: 1, middle: 0, back: 0 },
    passivesOverride: [{ ...EFFECTS.Link }]
  });
  selfCaster.name = holderName;
  s.p1Board[2].hero = selfCaster;
  s.p1Board[2].currentEnergy = 3;

  s.p2Board[0].hero = heroById('executionerID', { castsBySlot: { front: 0, middle: 0, back: 0 } });
  s.p2Board[0].currentEnergy = 0;

  const { out, logs } = await runRound(s);
  const gained = hasLinkGainLog(logs, holderName);
  return {
    name: 'Link passive: self-cast does not grant energy',
    passed: gained === false,
    details: {
      expectedLinkGainLog: false,
      actualLinkGainLog: gained,
      ...details(logs, out)
    }
  };
}

async function caseAugmentSelfCastNoGain() {
  const s = testState();
  const holderName = 'Link Augment Self';
  const selfCaster = heroById('priestID', {
    castsBySlot: { front: 1, middle: 0, back: 0 },
    passivesOverride: []
  });
  selfCaster.name = holderName;
  s.p1Board[2].hero = selfCaster;
  s.p1Board[2].currentEnergy = 3;
  s.p1Board[2].effects = [{ ...EFFECTS.Link, _hidden: true }];

  s.p2Board[0].hero = heroById('executionerID', { castsBySlot: { front: 0, middle: 0, back: 0 } });
  s.p2Board[0].currentEnergy = 0;

  const { out, logs } = await runRound(s);
  const gained = hasLinkGainLog(logs, holderName);
  return {
    name: 'Link augment-effect: self-cast does not grant energy',
    passed: gained === false,
    details: {
      expectedLinkGainLog: false,
      actualLinkGainLog: gained,
      ...details(logs, out)
    }
  };
}

async function casePassiveAllyCastGivesGain() {
  const s = testState();
  const holderName = 'Link Passive Holder';
  const holder = heroById('executionerID', {
    castsBySlot: { front: 0, middle: 0, back: 0 },
    passivesOverride: [{ ...EFFECTS.Link }]
  });
  holder.name = holderName;
  s.p1Board[2].hero = holder;
  s.p1Board[2].currentEnergy = 0;

  const allyCaster = heroById('priestID', {
    castsBySlot: { front: 1, middle: 0, back: 0 },
    passivesOverride: []
  });
  allyCaster.name = 'Ally Caster A';
  s.p1Board[5].hero = allyCaster;
  s.p1Board[5].currentEnergy = 3;

  s.p2Board[0].hero = heroById('executionerID', { castsBySlot: { front: 0, middle: 0, back: 0 } });
  s.p2Board[0].currentEnergy = 0;

  const { out, logs } = await runRound(s);
  const gained = hasLinkGainLog(logs, holderName);
  return {
    name: 'Link passive: ally cast grants +1 energy',
    passed: gained === true,
    details: {
      expectedLinkGainLog: true,
      actualLinkGainLog: gained,
      ...details(logs, out)
    }
  };
}

async function caseAugmentAllyCastGivesGain() {
  const s = testState();
  const holderName = 'Link Augment Holder';
  const holder = heroById('executionerID', {
    castsBySlot: { front: 0, middle: 0, back: 0 },
    passivesOverride: []
  });
  holder.name = holderName;
  s.p1Board[2].hero = holder;
  s.p1Board[2].currentEnergy = 0;
  s.p1Board[2].effects = [{ ...EFFECTS.Link, _hidden: true }];

  const allyCaster = heroById('priestID', {
    castsBySlot: { front: 1, middle: 0, back: 0 },
    passivesOverride: []
  });
  allyCaster.name = 'Ally Caster B';
  s.p1Board[5].hero = allyCaster;
  s.p1Board[5].currentEnergy = 3;

  s.p2Board[0].hero = heroById('executionerID', { castsBySlot: { front: 0, middle: 0, back: 0 } });
  s.p2Board[0].currentEnergy = 0;

  const { out, logs } = await runRound(s);
  const gained = hasLinkGainLog(logs, holderName);
  return {
    name: 'Link augment-effect: ally cast grants +1 energy',
    passed: gained === true,
    details: {
      expectedLinkGainLog: true,
      actualLinkGainLog: gained,
      ...details(logs, out)
    }
  };
}

async function main() {
  const results = [];
  results.push(await casePassiveSelfCastNoGain());
  results.push(await caseAugmentSelfCastNoGain());
  results.push(await casePassiveAllyCastGivesGain());
  results.push(await caseAugmentAllyCastGivesGain());

  let allPassed = true;
  console.log('=== Link Ally-Cast Regression ===');
  for (const result of results) {
    console.log(`${result.passed ? 'PASS' : 'FAIL'} - ${result.name}`);
    console.log(`  Details: ${JSON.stringify(result.details)}`);
    if (!result.passed) allPassed = false;
  }

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error('Link regression test failed with exception:', err);
  process.exit(1);
});
