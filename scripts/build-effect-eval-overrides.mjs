import fs from 'node:fs/promises';
import path from 'node:path';

import { EFFECTS } from '../src/effects.js';

const INPUT_CSV = path.resolve('scripts', 'ai-effect-evaluation-template.csv');
const OUTPUT_MODULE = path.resolve('src', 'ai', 'effectEvaluationOverrides.js');
const DRAFT_EFFECT_HORIZON = 6;

const REFERENCE_TARGET = {
  health: 10,
  armor: 1,
  speed: 3,
  spellPower: 0,
};

const parseCsv = (text) => {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      current = '';
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some(cell => cell !== '')) rows.push(row);
  }

  return rows;
};

const toRecords = (rows) => {
  if (!rows.length) return [];
  const headers = rows[0].map(header => String(header || '').trim());
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = String(row[index] ?? '').trim();
    });
    return record;
  }).filter(record => record.effect_key);
};

const getEffectTurns = (duration) => {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(1, Math.min(DRAFT_EFFECT_HORIZON, Number(duration)));
  }
  return DRAFT_EFFECT_HORIZON;
};

const calculateEffectiveCombatValue = ({ health, armor }) => {
  const safeHealth = Math.max(0, Number(health || 0));
  const safeArmor = Math.max(0, Number(armor || 0));
  return Math.sqrt(safeHealth * (safeHealth + safeArmor * 6));
};

const calculateReferenceTileValue = ({ speed, spellPower, armor }) => (
  Number(speed || 0) * 1.25 + Number(spellPower || 0) * 2 + Number(armor || 0) * 0.5
);

const applyEffectModifiers = (baseStats, effect, mode) => {
  const modifiers = effect?.modifiers || {};
  const nextStats = { ...baseStats };
  Object.entries(modifiers).forEach(([key, rawValue]) => {
    const value = Number(rawValue || 0);
    if (!Number.isFinite(value)) return;
    if (mode === 'buff') nextStats[key] = Number(nextStats[key] || 0) + value;
    if (mode === 'debuff') nextStats[key] = Number(nextStats[key] || 0) + value;
  });
  return nextStats;
};

const normalizeExpression = (rawExpression) => String(rawExpression || '')
  .replace(/Target_exected_turns_alive/gi, 'Target_expected_turns_alive')
  .replace(/Target_exepcted_turns_alive/gi, 'Target_expected_turns_alive')
  .replace(/Targets_/g, 'Target_')
  .replace(/Total_Target_expected_turns_alive/gi, 'Target_expected_turns_alive');

const buildContext = (effect) => {
  const turns = getEffectTurns(typeof effect.duration === 'number' ? effect.duration : null);
  const buffStats = applyEffectModifiers(REFERENCE_TARGET, effect, 'buff');
  const debuffStats = applyEffectModifiers(REFERENCE_TARGET, effect, 'debuff');
  return {
    Target_expected_turns_alive: turns,
    Caster_expected_turns_alive: turns,
    Target_Current_ECV: calculateEffectiveCombatValue(REFERENCE_TARGET),
    Target_ECV_After_Buff: calculateEffectiveCombatValue(buffStats),
    Target_ECV_After_Debuff: calculateEffectiveCombatValue(debuffStats),
    Target_Health: Number(REFERENCE_TARGET.health || 0),
    Target_Armor: Number(REFERENCE_TARGET.armor || 0),
    Target_Tile_Value_Before: calculateReferenceTileValue(REFERENCE_TARGET),
    Target_Tile_Value_After: calculateReferenceTileValue(buffStats),
    Target_Tile_Value_After_Buff: calculateReferenceTileValue(buffStats),
    Target_Tile_Value_After_Debuff: calculateReferenceTileValue(debuffStats),
  };
};

const evaluateExpression = (expression, context) => {
  const normalized = normalizeExpression(expression);
  if (!normalized) return null;

  const allowed = normalized.match(/[A-Za-z_][A-Za-z0-9_]*|\d*\.?\d+|[()+\-*/.]/g);
  if (!allowed) return null;

  let unknownIdentifier = null;
  const replaced = allowed.map((token) => {
    if (/^[A-Za-z_]/.test(token)) {
      if (!(token in context)) {
        unknownIdentifier = token;
        return '0';
      }
      return String(context[token]);
    }
    return token;
  }).join(' ');

  if (/[^0-9+\-*/().\s]/.test(replaced)) return null;

  try {
    const value = Function(`"use strict"; return (${replaced});`)();
    if (!Number.isFinite(value)) return null;
    return { value, normalized, unknownIdentifier };
  } catch {
    return null;
  }
};

const buildOverrides = (records) => {
  const overrides = {};
  const diagnostics = [];

  records.forEach((record) => {
    const effect = EFFECTS[record.effect_key];
    if (!effect) {
      diagnostics.push({ effect_key: record.effect_key, status: 'missing_effect', source: '' });
      return;
    }

    const source = record.manual_value || record.current_estimated_total || '';
    if (!source) return;

    const numeric = Number(source);
    if (Number.isFinite(numeric)) {
      overrides[effect.name] = numeric;
      diagnostics.push({ effect_key: record.effect_key, status: 'numeric', source, resolved: numeric });
      return;
    }

    const evaluated = evaluateExpression(source, buildContext(effect));
    if (!evaluated) {
      diagnostics.push({ effect_key: record.effect_key, status: 'unparsed', source });
      return;
    }

    overrides[effect.name] = evaluated.value;
    diagnostics.push({
      effect_key: record.effect_key,
      status: evaluated.unknownIdentifier ? 'parsed_with_unknowns' : 'expression',
      source,
      normalized: evaluated.normalized,
      resolved: evaluated.value,
      unknown: evaluated.unknownIdentifier || '',
    });
  });

  return { overrides, diagnostics };
};

const records = toRecords(parseCsv(await fs.readFile(INPUT_CSV, 'utf8')));
const { overrides, diagnostics } = buildOverrides(records);

const moduleText = `export const EFFECT_EVALUATION_OVERRIDES = ${JSON.stringify(overrides, null, 2)};\n\nexport const EFFECT_EVALUATION_OVERRIDE_DIAGNOSTICS = ${JSON.stringify(diagnostics, null, 2)};\n`;

await fs.writeFile(OUTPUT_MODULE, moduleText, 'utf8');

console.log(`Wrote ${OUTPUT_MODULE}`);
const issueCount = diagnostics.filter(entry => entry.status === 'unparsed' || entry.status === 'parsed_with_unknowns' || entry.status === 'missing_effect').length;
console.log(`Resolved ${Object.keys(overrides).length} overrides with ${issueCount} diagnostic issue(s).`);
