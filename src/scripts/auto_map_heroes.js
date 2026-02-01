// Auto-map hero images to entries in src/heroes.js by matching filenames.
// Usage:
//   node src/scripts/auto_map_heroes.js
// Output:
//   - src/public/images/heroes/image-mapping.json
//   - prints suggested edits for `src/heroes.js` (image fields)

const fs = require('fs');
const path = require('path');

const heroesFile = path.join(__dirname, '..', 'heroes.js');
const imagesDir = path.join(__dirname, '..', 'public', 'images', 'heroes');
const outMapping = path.join(imagesDir, 'image-mapping.json');

if (!fs.existsSync(heroesFile)) {
  console.error('heroes.js not found at', heroesFile);
  process.exit(1);
}
if (!fs.existsSync(imagesDir)) {
  console.error('images folder not found at', imagesDir);
  process.exit(1);
}

const heroesText = fs.readFileSync(heroesFile, 'utf8');
// crude regex to extract hero objects with id and name
const heroRegex = /\{[\s\S]*?id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?\}/g;
let match;
const heroes = [];
while ((match = heroRegex.exec(heroesText)) !== null) {
  const id = match[1];
  const name = match[2];
  heroes.push({ id, name });
}

const files = fs.readdirSync(imagesDir).filter(f => !f.startsWith('.') && !f.endsWith('.json'));

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const fileNorm = files.map(f => ({ f, n: normalize(f) }));

const mapping = {};
const suggestions = [];

heroes.forEach(h => {
  const nName = normalize(h.name);
  const nId = normalize(h.id.replace(/id$/i, ''));
  // try exact contains match by name or id
  let found = fileNorm.find(x => x.n.includes(nName) || x.n.includes(nId));
  if (!found) {
    // try prefix match
    found = fileNorm.find(x => x.n.startsWith(nName) || x.n.startsWith(nId));
  }
  if (found) {
    const rel = '/images/heroes/' + found.f;
    mapping[h.name] = rel;
    suggestions.push({ id: h.id, name: h.name, image: rel });
  }
});

fs.writeFileSync(outMapping, JSON.stringify({ generatedAt: new Date().toISOString(), mapping, suggestions }, null, 2));
console.log('Wrote mapping to', outMapping);
console.log('Suggestions:');
console.log(JSON.stringify(suggestions, null, 2));
console.log('\nTo apply these suggestions, run the script and then either update src/heroes.js manually or ask me to patch it for you.');
