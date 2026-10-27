/**
 * create-placeholder-assets.js
 * Creates minimal placeholder PNG files for Expo build.
 * These are solid-color PNGs — replace with real designs before publishing.
 *
 * No external dependencies needed.
 * Run: node scripts/create-placeholder-assets.js
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

/**
 * Creates a minimal valid PNG file with a solid color.
 * Hand-crafted PNG bytes — no canvas or image library needed.
 */
function createSolidPng(width, height, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);                   // length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;   // bit depth
  ihdr[17] = 2;   // color type: RGB
  ihdr[18] = 0;   // compression
  ihdr[19] = 0;   // filter
  ihdr[20] = 0;   // interlace
  // CRC (we'll write a pre-computed one for a simple placeholder)
  // For a proper PNG, CRC must be correct, so we use zlib
  const { crc32 } = require('zlib');

  // Build raw image data: each row has a filter byte (0) + RGB pixels
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 1 + x * 3 + 1] = g;
      raw[y * rowSize + 1 + x * 3 + 2] = b;
    }
  }

  const { deflateSync } = require('zlib');
  const compressed = deflateSync(raw);

  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);

  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

  // Compute CRCs using Node's built-in zlib createDeflate
  function crc32buf(buf) {
    // Simple CRC32 implementation
    let crc = 0xFFFFFFFF;
    const table = makeCrcTable();
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeCrcTable() {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c;
    }
    return t;
  }

  // Write IHDR CRC
  const ihdrCrc = crc32buf(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // Write IDAT CRC
  const idatCrc = crc32buf(idat.slice(4, 8 + compressed.length));
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// icon.png — 1024x1024, Ludoline blue
const icon = createSolidPng(1024, 1024, 49, 130, 206); // #3182ce
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), icon);
console.log('✅ assets/icon.png created (1024×1024, blue placeholder)');

// adaptive-icon.png — 1024x1024, white
const adaptive = createSolidPng(1024, 1024, 255, 255, 255);
fs.writeFileSync(path.join(ASSETS_DIR, 'adaptive-icon.png'), adaptive);
console.log('✅ assets/adaptive-icon.png created (1024×1024, white placeholder)');

// splash.png — 1284x2778, Ludoline blue
const splash = createSolidPng(1284, 2778, 49, 130, 206);
fs.writeFileSync(path.join(ASSETS_DIR, 'splash.png'), splash);
console.log('✅ assets/splash.png created (1284×2778, blue placeholder)');

// favicon.png — 48x48 (for web)
const favicon = createSolidPng(48, 48, 49, 130, 206);
fs.writeFileSync(path.join(ASSETS_DIR, 'favicon.png'), favicon);
console.log('✅ assets/favicon.png created');

console.log('\n🎨 Placeholder assets ready!');
console.log('Replace these with your real Ludoline brand design before publishing.');
