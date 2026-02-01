// Batch image processor
// Usage:
//  npm install sharp glob
//  node src/scripts/batch_process_images.js --input "path/to/jpegs" --output "src/public/images/heroes" --mode ps1

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

const args = require('minimist')(process.argv.slice(2));
const inputDir = args.input || args.i || './uploads';
const outputDir = args.output || args.o || 'src/public/images/heroes';
const mode = args.mode || 'ps1'; // ps1 | pixel | none
const size = Number(args.size || 512);
const pixelSize = Number(args.pixelSize || 48);

if (!fs.existsSync(inputDir)) {
  console.error('Input directory does not exist:', inputDir);
  process.exit(1);
}
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

function makeNoiseBuffer(width, height, intensity = 0.06) {
  const channels = 4;
  const buf = Buffer.alloc(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    const v = Math.floor(Math.random() * 256);
    const idx = i * channels;
    buf[idx] = v;
    buf[idx + 1] = v;
    buf[idx + 2] = v;
    buf[idx + 3] = Math.floor(255 * intensity);
  }
  return buf;
}

async function pixelate(buffer, size, pixelSize = 48) {
  const small = await sharp(buffer)
    .resize(pixelSize, pixelSize, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  const up = await sharp(small)
    .resize(size, size, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  return up;
}

async function ps1Effect(buffer, size) {
  const base = await sharp(buffer)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 1.02, saturation: 0.95 })
    .blur(0.6)
    .png()
    .toBuffer();

  const noise = makeNoiseBuffer(size, size, 0.06);
  const noiseImg = await sharp(noise, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();

  const composed = await sharp(base)
    .composite([
      { input: noiseImg, blend: 'overlay', opacity: 0.6 }
    ])
    .png()
    .toBuffer();

  return composed;
}

async function simpleResize(buffer, size) {
  return await sharp(buffer).resize(size, size, { fit: 'cover', position: 'centre' }).png().toBuffer();
}

async function processFile(file) {
  try {
    const data = await sharp(file).rotate().toBuffer();
    let outBuf = null;
    if (mode === 'pixel') outBuf = await pixelate(data, size, pixelSize);
    else if (mode === 'ps1') outBuf = await ps1Effect(data, size);
    else outBuf = await simpleResize(data, size);

    const baseName = path.basename(file, path.extname(file));
    const outPath = path.join(outputDir, baseName + '.png');
    await sharp(outBuf).flatten({ background: '#ffffff' }).toFile(outPath);
    console.log('Wrote', outPath);
  } catch (e) {
    console.error('Error processing', file, e.message);
  }
}

(async function main(){
  const pattern = path.join(inputDir, '**/*.{jpg,jpeg,png}');
  const files = glob.sync(pattern, { nocase: true });
  if (!files.length) {
    console.log('No images found in', inputDir);
    return;
  }
  console.log('Found', files.length, 'images. Mode=', mode, 'size=', size);
  for (const f of files) {
    await processFile(f);
  }
})();
