import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const spellConfigPath = path.join(root, 'src', 'spellConfigs.js');

const issues = [];

const spellConfigText = await readFile(spellConfigPath, 'utf8');

// 1) Ensure no 8-column spell configs remain
if (/cols:\s*8/.test(spellConfigText)) {
  issues.push('Found cols: 8 in src/spellConfigs.js');
}

// 2) Ensure Arcane Blast sprite config exists
if (!/Arcane Blast_2x2_4frames/.test(spellConfigText)) {
  issues.push('Missing Arcane Blast config in src/spellConfigs.js');
}

if (issues.length) {
  console.error('Smoke test failed:');
  issues.forEach(i => console.error(`- ${i}`));
  process.exit(1);
}

console.log('Smoke test passed.');
