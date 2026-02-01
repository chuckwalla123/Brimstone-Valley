// Node image processing helper for the project
// Usage:
//  npm install sharp
//  node src/scripts/process_images.js input.jpg assassin.png --mode pixel --size 512

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function pixelate(buffer, size, pixelSize = 32) {
  // downscale to pixelSize then upscale with nearest-neighbor
  const small = await sharp(buffer)
    .resize(pixelSize, pixelSize, { fit: 'cover' })
    .png()
    .toBuffer();
  const up = await sharp(small)
    .resize(size, size, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  return up;
}

function makeNoiseBuffer(width, height, intensity = 0.06) {
  // RGBA buffer filled with grayscale noise, alpha tuned by intensity
  const channels = 4;
  const buf = Buffer.alloc(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    const v = Math.floor(Math.random() * 256);
    const idx = i * channels;
    buf[idx] = v;      // R
    buf[idx + 1] = v;  // G
    buf[idx + 2] = v;  // B
    buf[idx + 3] = Math.floor(255 * intensity); // A
  }
  return buf;
}

async function ps1Effect(buffer, size) {
  // soft blur + subtle grain overlay
  const base = await sharp(buffer)
    .resize(size, size, { fit: 'cover' })
    .modulate({ brightness: 1.02, saturation: 0.9 })
    .blur(0.7)
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

async function process(inputPath, outputPath, options = {}) {
  const { mode = 'pixel', size = 512, pixelSize = 48 } = options;
  if (!fs.existsSync(inputPath)) throw new Error('input does not exist: ' + inputPath);
  const buf = await sharp(inputPath).rotate().toBuffer();
  let out;
  if (mode === 'pixel') {
    out = await pixelate(buf, size, pixelSize);
  } else if (mode === 'ps1') {
    out = await ps1Effect(buf, size);
  } else {
    // default: just resize + white background
    out = await sharp(buf).resize(size, size, { fit: 'cover' }).png().toBuffer();
  }
  await sharp(out).flatten({ background: '#ffffff' }).toFile(outputPath);
  console.log('Wrote', outputPath);
}

// CLI
(async function main(){
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.log('Usage: node src/scripts/process_images.js <input> <output> [--mode pixel|ps1] [--size N] [--pixelSize N]');
    process.exit(1);
  }
  const input = argv[0];
  const output = argv[1];
  const opts = { mode: 'pixel', size: 512, pixelSize: 48 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--mode') opts.mode = argv[++i];
    if (argv[i] === '--size') opts.size = Number(argv[++i]);
    if (argv[i] === '--pixelSize') opts.pixelSize = Number(argv[++i]);
  }
  try {
    await process(input, output, opts);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
