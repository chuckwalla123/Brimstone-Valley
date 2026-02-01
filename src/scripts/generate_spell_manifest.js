import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const spellsDir = path.join(__dirname, '..', 'public', 'images', 'spells');
const outManifest = path.join(spellsDir, 'manifest.json');
const outConfigJs = path.join(__dirname, '..', 'spellConfigs.js');

if (!fs.existsSync(spellsDir)) {
  console.error('Spells folder not found:', spellsDir);
  process.exit(1);
}

function readChunk(file, start, length) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(length);
  fs.readSync(fd, buf, 0, length, start);
  fs.closeSync(fd);
  return buf;
}

function getPngSize(file) {
  // PNG: width/height are 4-byte big-endian at offset 16
  const buf = readChunk(file, 0, 24);
  // check PNG signature
  if (buf.slice(0,8).toString('hex') !== '89504e470d0a1a0a') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function getJpegSize(file) {
  const fd = fs.openSync(file, 'r');
  const stat = fs.fstatSync(fd);
  const buf = Buffer.alloc(Math.min(1024, stat.size));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  // JPEG scanning for SOF markers
  let offset = 2; // skip 0xFFD8
  while (offset < buf.length - 9) {
    if (buf[offset] === 0xFF) {
      const marker = buf[offset+1];
      const len = buf.readUInt16BE(offset+2);
      // SOF0(0xC0), SOF2(0xC2) contain frame size
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
        const height = buf.readUInt16BE(offset+5);
        const width = buf.readUInt16BE(offset+7);
        return { width, height };
      }
      offset += 2 + len;
    } else {
      offset++;
    }
  }
  return null;
}

function getImageSize(file) {
  const ext = path.extname(file).toLowerCase();
  try {
    if (ext === '.png') return getPngSize(file);
    if (ext === '.jpg' || ext === '.jpeg') return getJpegSize(file);
  } catch (e) {
    console.error('Error reading image size for', file, e.message);
  }
  return null;
}

function guessFramesByName(name) {
  // look for patterns like _4frames, -4f, 4x, x4, _4, -4
  const m = name.match(/(\d+)\s*(?:f|frames|x)?$/i);
  if (m) return Number(m[1]);
  const m2 = name.match(/(?:frames|f)\D*(\d+)/i);
  if (m2) return Number(m2[1]);
  return null;
}

function parseGridFromName(name) {
  // detect patterns like 2x2, 3x4, 2×2, with optional separators or underscores
  const m = name.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (m) return { cols: Number(m[1]), rows: Number(m[2]) };
  return null;
}

const files = fs.readdirSync(spellsDir).filter(f => !f.startsWith('.') && /\.(png|jpe?g)$/i.test(f));
const manifest = { generatedAt: new Date().toISOString(), spells: {} };

files.forEach(f => {
  const filePath = path.join(spellsDir, f);
  const base = path.basename(f, path.extname(f));
  const size = getImageSize(filePath);
  let frames = null;
  let frameWidth = null;
  let frameHeight = null;

  if (size) {
    const { width, height } = size;
    // first, check filename for explicit grid like 2x2
    const grid = parseGridFromName(base);
    if (grid) {
      const { cols, rows } = grid;
      frames = cols * rows;
      // if image dimensions match a grid, compute frame size accordingly
      if (width % cols === 0 && height % rows === 0) {
        frameWidth = Math.round(width / cols);
        frameHeight = Math.round(height / rows);
      } else if (width % rows === 0 && height % cols === 0) {
        // in case user transposed dimensions, try swapped
        frameWidth = Math.round(width / rows);
        frameHeight = Math.round(height / cols);
      } else {
        // fallback: assume square frames sized by dividing by max(cols,rows)
        const approx = Math.round(Math.min(width / cols, height / rows));
        frameWidth = approx;
        frameHeight = approx;
      }
    } else {
      // if width is multiple of height, assume horizontal strip
      if (height > 0 && width % height === 0 && width / height > 1) {
        frames = width / height;
        frameWidth = height;
        frameHeight = height;
      } else if (width > 0 && height % width === 0 && height / width > 1) {
        // vertical strip
        frames = height / width;
        frameWidth = width;
        frameHeight = width;
      } else {
        // can't infer frames from dims, assume single-frame equal to full size
        frames = 1;
        frameWidth = width;
        frameHeight = height;
      }
    }
  }

  // try name-based override
  const guess = guessFramesByName(base);
  if (guess && guess > 1) {
    frames = guess;
    if (frameHeight) {
      frameWidth = Math.round((frameWidth * (1/frames)) || frameWidth);
    }
  }

  // final safety defaults
  if (!frames) frames = 1;
  if (!frameWidth || !frameHeight) {
    // attempt to approximate using image size or fallback
    if (size) {
      frameWidth = size.width;
      frameHeight = size.height;
    } else {
      frameWidth = 96; frameHeight = 96;
    }
  }

  const maxDisplaySize = 120;
  // Special handling for _2x2_4frames
  let cols, rows;
  if (base.includes('_2x2_4frames')) {
    frameWidth = 256;
    frameHeight = 256;
    cols = 2;
    rows = 2;
  } else {
    cols = Math.max(1, Math.round((size && size.width) ? (size.width / frameWidth) : frames));
    rows = Math.max(1, Math.round((size && size.height) ? (size.height / frameHeight) : 1));
  }
  manifest.spells[base] = {
    file: '/images/spells/' + f,
    frames,
    frameWidth,
    frameHeight,
    maxDisplaySize,
    cols,
    rows,
    totalWidth: size ? size.width : (frameWidth * frames),
    totalHeight: size ? size.height : frameHeight
  };
});

fs.writeFileSync(outManifest, JSON.stringify(manifest, null, 2));
console.log('Wrote manifest to', outManifest);

// Also update src/spellConfigs.js with the detected entries to keep things in sync
const configEntries = Object.keys(manifest.spells).map(k => {
  const v = manifest.spells[k];
  return `  ${JSON.stringify(k)}: { file: ${JSON.stringify(v.file)}, frames: ${v.frames}, frameWidth: ${v.frameWidth}, frameHeight: ${v.frameHeight}, cols: ${v.cols}, rows: ${v.rows}, maxDisplaySize: ${v.maxDisplaySize} }`;
}).join(',\n');

const jsOut = `// Generated by src/scripts/generate_spell_manifest.js on ${new Date().toISOString()}\n// Do not hand-edit this file unless you intend to overwrite the auto-generated config.\n\nexport const SPELL_CONFIG = {\n${configEntries}\n};\n\nexport default SPELL_CONFIG;\n`;

fs.writeFileSync(outConfigJs, jsOut);
console.log('Updated', outConfigJs);
