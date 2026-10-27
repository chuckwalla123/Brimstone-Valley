import fs from 'node:fs';
import path from 'node:path';
import { createMovementScenarioCorpus } from '../src/ai/training/scenarioCorpus.js';
import { playMovementControllerMatch } from '../src/ai/training/championEvaluation.js';
import { MatchMonitor } from '../src/ai/training/matchMonitor.js';

// Usage: node scripts/monitor-match.mjs [--games 4] [--seed 1] [--p1 easyplus] [--p2 easy] [--max-rounds 12] [--out monitor-output]
// Controller types: easy | easyplus. Add --explain=false to hide EasyAI+ candidate score breakdowns.
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const argv = process.argv.slice(2);
const read = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) return argv[index + 1];
  return args[name] ?? fallback;
};

const games = Number(read('games', 4));
const seed = Number(read('seed', 1));
const maxRounds = Number(read('max-rounds', 12));
const p1Type = read('p1', 'easyplus');
const p2Type = read('p2', 'easy');
const explain = read('explain', 'true') !== 'false';
const outRoot = read('out', 'monitor-output');

const makeController = (type) => {
  if (type === 'easy') return { type: 'easy' };
  if (type === 'easyplus') return { type: 'easyplus', explain };
  throw new Error(`Unsupported controller "${type}" (use easy or easyplus)`);
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(outRoot, stamp);
fs.mkdirSync(outDir, { recursive: true });

const scenarios = createMovementScenarioCorpus({ randomCount: Math.max(0, games - 5), seed }).slice(0, games);
const summaries = [];

for (let index = 0; index < scenarios.length; index += 1) {
  const scenario = scenarios[index];
  const label = `match-${String(index + 1).padStart(2, '0')} (${scenario.id})`;
  const monitor = new MatchMonitor({ label, p1Label: p1Type, p2Label: p2Type });
  const result = await playMovementControllerMatch(scenario.state, {
    p1Controller: makeController(p1Type),
    p2Controller: makeController(p2Type),
    maxRounds,
    seed: seed + index,
    observer: monitor.observer(),
  });
  monitor.finish(result);
  const file = path.join(outDir, `match-${String(index + 1).padStart(2, '0')}.txt`);
  fs.writeFileSync(file, monitor.renderReport());
  summaries.push(monitor.summary());
  console.log(`${label}: ${result.outcome} in ${result.resolvedRounds} round(s), ${monitor.issues.length} issue(s) -> ${file}`);
}

const total = (key) => summaries.reduce((sum, entry) => sum + entry[key], 0);
const lines = [
  `Match monitor summary  (p1=${p1Type}, p2=${p2Type}, games=${summaries.length}, seed=${seed})`,
  `p1 wins: ${summaries.filter((s) => s.outcome === 'p1').length}  p2 wins: ${summaries.filter((s) => s.outcome === 'p2').length}`
    + `  draws: ${summaries.filter((s) => s.outcome === 'draw').length}  unfinished: ${summaries.filter((s) => !s.completed).length}`,
  `moves: ${total('moves')}  no-ops: ${total('noops')}  fallbacks: ${total('fallbacks')}  stall rounds: ${total('zeroDamageRounds')}`,
  `full-column exposures: ${total('columnStackExposures')} (${total('columnStackExposuresWhenOpponentLast')} with opponent having last move)`,
  '',
  'Issues:',
  ...summaries.flatMap((s) => s.issues.map((issue) => `  ${s.label} [round ${issue.round ?? '-'}] ${issue.kind}: ${issue.message}`)),
];
fs.writeFileSync(path.join(outDir, 'summary.txt'), lines.join('\n'));
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summaries, null, 2));
console.log(`\nSummary written to ${path.join(outDir, 'summary.txt')}`);
