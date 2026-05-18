import { recomputeModifiers } from './shared/gameLogic.js';
import { EFFECTS } from './src/effects.js';

function expect(condition, message, details = null) {
  if (condition) return;
  if (details) {
    console.error(message, details);
  } else {
    console.error(message);
  }
  process.exit(1);
}

function makeTile(hero, effects = [], passives = []) {
  return {
    hero: { ...hero },
    effects: effects.map((effect) => ({ ...effect })),
    _passives: passives.map((passive) => ({ ...passive }))
  };
}

async function run() {
  const dragon = makeTile(
    { id: 'dragonID', name: 'Dragon', armor: 0, speed: 1, spellPower: 0 },
    [EFFECTS.Armor, EFFECTS.SpeedUp, EFFECTS.Strength],
    [EFFECTS.DragonScales]
  );
  recomputeModifiers(dragon);
  expect(Number(dragon.currentArmor || 0) === 0, 'Dragon Scales regression FAILED: dragon incorrectly gained armor from effects.', {
    currentArmor: dragon.currentArmor,
    effects: dragon.effects.map((effect) => effect?.name)
  });
  expect(Number(dragon.currentSpeed || 0) === 1, 'Dragon Scales regression FAILED: dragon incorrectly gained speed from effects.', {
    currentSpeed: dragon.currentSpeed,
    effects: dragon.effects.map((effect) => effect?.name)
  });
  expect(Number(dragon.currentSpellPower || 0) === 1, 'Dragon Scales regression FAILED: dragon should still gain spell power from other effects.', {
    currentSpellPower: dragon.currentSpellPower
  });

  const knight = makeTile(
    { id: 'knightID', name: 'Knight', armor: 3, speed: 2, spellPower: 0 },
    [EFFECTS.ArmorDown]
  );
  recomputeModifiers(knight);
  expect(Number(knight.currentArmor || 0) === 2, 'Cleanse regression setup FAILED: knight armor should drop while Armor Down is active.', {
    currentArmor: knight.currentArmor
  });

  knight.effects = [];
  recomputeModifiers(knight);
  expect(Number(knight.currentArmor || 0) === 3, 'Cleanse regression FAILED: knight armor did not restore after debuff removal.', {
    currentArmor: knight.currentArmor
  });

  console.log('Effect clamp and cleanse regressions PASSED');
}

run().catch((error) => {
  console.error('Effect clamp and cleanse regressions crashed:', error);
  process.exit(1);
});