/**
 * generate-brand-assets.js
 * Generates Ludoline branded PNG assets matching the provided design:
 * - Deep navy/indigo background (#2D2B6E)
 * - Ludo board with 4 colored quadrants (red, green, blue, yellow)
 * - "Ludoline" title in gold
 * - Dice icons
 * 
 * Uses ONLY Node.js built-ins (zlib). No canvas needed.
 * Run: node scripts/generate-brand-assets.js
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

// ─── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG encoder ────────────────────────────────────────────────────────────
// pixels: Uint8Array of RGBA values, row by row
function encodePng(width, height, pixels) {
  // Build raw (filter byte 0 + RGB per row)
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 3) + 1 + x * 3;
      raw[di]   = pixels[si];     // R
      raw[di+1] = pixels[si+1];   // G
      raw[di+2] = pixels[si+2];   // B
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });

  // PNG signature
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width,  0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8]  = 8; // bit depth
  ihdrData[9]  = 2; // color type RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdrType = Buffer.from('IHDR');
  const ihdrChunk = Buffer.concat([ihdrType, ihdrData]);
  const ihdrCrc   = crc32(ihdrChunk);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdrChunk.copy(ihdr, 4);
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // IDAT
  const idatType = Buffer.from('IDAT');
  const idatContent = Buffer.concat([idatType, compressed]);
  const idatCrc = crc32(idatContent);
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idatContent.copy(idat, 4);
  idat.writeUInt32BE(idatCrc, compressed.length + 8);

  // IEND
  const iend = Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]);

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ─── Drawing primitives ──────────────────────────────────────────────────────
class Image {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4); // RGBA
  }

  setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (Math.round(y) * this.w + Math.round(x)) * 4;
    // Alpha blend over existing pixel
    const ao = a / 255;
    const ai = this.data[i+3] / 255;
    const af = ao + ai * (1 - ao);
    if (af === 0) return;
    this.data[i]   = Math.round((r * ao + this.data[i]   * ai * (1-ao)) / af);
    this.data[i+1] = Math.round((g * ao + this.data[i+1] * ai * (1-ao)) / af);
    this.data[i+2] = Math.round((b * ao + this.data[i+2] * ai * (1-ao)) / af);
    this.data[i+3] = Math.round(af * 255);
  }

  fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
    for (let y = Math.max(0, Math.round(y1)); y < Math.min(this.h, Math.round(y2)); y++)
      for (let x = Math.max(0, Math.round(x1)); x < Math.min(this.w, Math.round(x2)); x++)
        this.setPixel(x, y, r, g, b, a);
  }

  fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const r2 = radius * radius;
    for (let y = Math.ceil(cy - radius); y <= Math.floor(cy + radius); y++)
      for (let x = Math.ceil(cx - radius); x <= Math.floor(cx + radius); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx*dx + dy*dy <= r2) this.setPixel(x, y, r, g, b, a);
      }
  }

  // Rounded rectangle fill
  fillRoundRect(x1, y1, x2, y2, radius, r, g, b, a = 255) {
    // Fill body
    this.fillRect(x1 + radius, y1,          x2 - radius, y2,          r, g, b, a);
    this.fillRect(x1,          y1 + radius, x2,          y2 - radius, r, g, b, a);
    // Corners
    this.fillCircle(x1 + radius, y1 + radius, radius, r, g, b, a);
    this.fillCircle(x2 - radius, y1 + radius, radius, r, g, b, a);
    this.fillCircle(x1 + radius, y2 - radius, radius, r, g, b, a);
    this.fillCircle(x2 - radius, y2 - radius, radius, r, g, b, a);
  }

  toPng() {
    return encodePng(this.w, this.h, this.data);
  }
}

// ─── Color palette from the Ludoline design ──────────────────────────────────
const C = {
  navy:    [30,  27, 110],   // #1E1B6E deep indigo background
  indigo:  [45,  43, 110],   // #2D2B6E card background
  red:     [220, 50,  50],   // board red quadrant
  green:   [34, 160,  74],   // board green quadrant
  blue:    [52, 120, 210],   // board blue quadrant
  yellow:  [220, 170,  30],  // board yellow / gold
  white:   [255, 255, 255],
  black:   [20,  20,  20],
  gold:    [230, 180,  20],  // "Ludoline" title text approx color
  purpBg:  [60,  58, 140],   // circle decorations
};

// ─── Draw app icon (1024×1024) ────────────────────────────────────────────────
function drawIcon(size) {
  const img = new Image(size, size);
  const s = size / 1024; // scale factor

  // Background: deep indigo rounded square
  img.fillRoundRect(0, 0, size, size, size * 0.18,
    C.indigo[0], C.indigo[1], C.indigo[2]);

  // Decorative circles (top-left, top-right, bottom-right)
  img.fillCircle(size*0.08, size*0.12, size*0.08, C.purpBg[0], C.purpBg[1], C.purpBg[2], 180);
  img.fillCircle(size*0.85, size*0.08, size*0.07, C.purpBg[0], C.purpBg[1], C.purpBg[2], 180);
  img.fillCircle(size*0.90, size*0.88, size*0.09, C.purpBg[0], C.purpBg[1], C.purpBg[2], 180);

  // White board card
  const bx1 = size * 0.15, by1 = size * 0.20;
  const bx2 = size * 0.85, by2 = size * 0.80;
  const br  = size * 0.06;
  img.fillRoundRect(bx1, by1, bx2, by2, br,
    C.white[0], C.white[1], C.white[2]);

  const bw = bx2 - bx1;
  const bh = by2 - by1;
  const half = bw / 2;
  const halfh = bh / 2;
  const gap = size * 0.015;
  const qr  = size * 0.04; // quadrant corner radius

  // Red quadrant (top-left)
  img.fillRoundRect(bx1+gap, by1+gap, bx1+half-gap, by1+halfh-gap, qr,
    C.red[0], C.red[1], C.red[2]);
  // Green quadrant (top-right)
  img.fillRoundRect(bx1+half+gap, by1+gap, bx2-gap, by1+halfh-gap, qr,
    C.green[0], C.green[1], C.green[2]);
  // Blue quadrant (bottom-left)
  img.fillRoundRect(bx1+gap, by1+halfh+gap, bx1+half-gap, by2-gap, qr,
    C.blue[0], C.blue[1], C.blue[2]);
  // Yellow quadrant (bottom-right)
  img.fillRoundRect(bx1+half+gap, by1+halfh+gap, bx2-gap, by2-gap, qr,
    C.yellow[0], C.yellow[1], C.yellow[2]);

  // Center cross star (small colored triangles)
  const cx = bx1 + half, cy = by1 + halfh;
  const cs = size * 0.04;
  img.fillRect(cx - cs*0.4, cy - cs,   cx + cs*0.4, cy,       C.red[0],    C.red[1],    C.red[2]);
  img.fillRect(cx,          cy - cs*0.4, cx + cs,   cy + cs*0.4, C.green[0],  C.green[1],  C.green[2]);
  img.fillRect(cx - cs*0.4, cy,         cx + cs*0.4, cy + cs,  C.blue[0],   C.blue[1],   C.blue[2]);
  img.fillRect(cx - cs,     cy - cs*0.4, cx,        cy + cs*0.4, C.yellow[0], C.yellow[1], C.yellow[2]);

  // Piece tokens — white circles with color dots in each quadrant
  const drawPieces = (qcx, qcy, r, g, b) => {
    const pr = size * 0.04; // piece radius
    const off = size * 0.07;
    // 3 dots triangle + base
    img.fillCircle(qcx,        qcy - off*0.5, pr, C.white[0], C.white[1], C.white[2]);
    img.fillCircle(qcx - off*0.6, qcy + off*0.3, pr, C.white[0], C.white[1], C.white[2]);
    img.fillCircle(qcx + off*0.6, qcy + off*0.3, pr, C.white[0], C.white[1], C.white[2]);
    // Color fill inside each
    img.fillCircle(qcx,        qcy - off*0.5, pr*0.6, r, g, b);
    img.fillCircle(qcx - off*0.6, qcy + off*0.3, pr*0.6, r, g, b);
    img.fillCircle(qcx + off*0.6, qcy + off*0.3, pr*0.6, r, g, b);
  };

  const qoff = size * 0.175;
  drawPieces(bx1 + half/2, by1 + halfh/2,      C.red[0],    C.red[1],    C.red[2]);
  drawPieces(bx1 + half + half/2, by1 + halfh/2, C.green[0],  C.green[1],  C.green[2]);
  drawPieces(bx1 + half/2, by1 + halfh + halfh/2, C.blue[0],  C.blue[1],  C.blue[2]);
  drawPieces(bx1 + half + half/2, by1 + halfh + halfh/2, C.yellow[0], C.yellow[1], C.yellow[2]);

  return img;
}

// ─── Splash screen (1284×2778) ────────────────────────────────────────────────
function drawSplash(w, h) {
  const img = new Image(w, h);
  const s = w / 1024;

  // Background
  img.fillRect(0, 0, w, h, C.navy[0], C.navy[1], C.navy[2]);

  // Large decorative circles
  img.fillCircle(w*0.08,  h*0.05,  w*0.09, C.purpBg[0], C.purpBg[1], C.purpBg[2], 150);
  img.fillCircle(w*0.88,  h*0.04,  w*0.08, C.purpBg[0], C.purpBg[1], C.purpBg[2], 150);
  img.fillCircle(w*0.85,  h*0.68,  w*0.11, C.purpBg[0], C.purpBg[1], C.purpBg[2], 150);
  img.fillCircle(w*0.06,  h*0.78,  w*0.09, C.purpBg[0], C.purpBg[1], C.purpBg[2], 150);

  // Card
  const cx1 = w*0.08, cy1 = h*0.10, cx2 = w*0.92, cy2 = h*0.76;
  const cr   = w * 0.07;
  img.fillRoundRect(cx1, cy1, cx2, cy2, cr, C.indigo[0], C.indigo[1], C.indigo[2]);

  // "Ludoline" title — simulate with a gold rectangle bar
  // (Actual text rendering needs canvas; this makes a clear gold accent bar)
  img.fillRect(w*0.20, h*0.12, w*0.80, h*0.175, C.gold[0], C.gold[1], C.gold[2]);
  // Subtitle bar
  img.fillRect(w*0.25, h*0.18, w*0.75, h*0.205, C.white[0], C.white[1], C.white[2], 180);

  // Mini board inside card
  const bx1 = w*0.15, by1 = h*0.24, bx2 = w*0.85, by2 = h*0.68;
  const br  = w * 0.05;
  img.fillRoundRect(bx1, by1, bx2, by2, br, C.white[0], C.white[1], C.white[2]);

  const bw = bx2-bx1, bh = by2-by1;
  const half = bw/2, halfh = bh/2;
  const gap = w*0.012, qr = w*0.035;

  img.fillRoundRect(bx1+gap, by1+gap, bx1+half-gap, by1+halfh-gap, qr, C.red[0],    C.red[1],    C.red[2]);
  img.fillRoundRect(bx1+half+gap, by1+gap, bx2-gap, by1+halfh-gap, qr, C.green[0],  C.green[1],  C.green[2]);
  img.fillRoundRect(bx1+gap, by1+halfh+gap, bx1+half-gap, by2-gap, qr, C.blue[0],   C.blue[1],   C.blue[2]);
  img.fillRoundRect(bx1+half+gap, by1+halfh+gap, bx2-gap, by2-gap, qr, C.yellow[0], C.yellow[1], C.yellow[2]);

  // Center cross
  const ccx = bx1+half, ccy = by1+halfh, cs = w*0.035;
  img.fillRect(ccx-cs*0.4, ccy-cs, ccx+cs*0.4, ccy, C.red[0], C.red[1], C.red[2]);
  img.fillRect(ccx, ccy-cs*0.4, ccx+cs, ccy+cs*0.4, C.green[0], C.green[1], C.green[2]);
  img.fillRect(ccx-cs*0.4, ccy, ccx+cs*0.4, ccy+cs, C.blue[0], C.blue[1], C.blue[2]);
  img.fillRect(ccx-cs, ccy-cs*0.4, ccx, ccy+cs*0.4, C.yellow[0], C.yellow[1], C.yellow[2]);

  // Dice (two dice at bottom of card)
  const drawDie = (dx, dy, dsize) => {
    img.fillRoundRect(dx, dy, dx+dsize, dy+dsize, dsize*0.18, C.white[0], C.white[1], C.white[2]);
    const dr = dsize * 0.09;
    const dots = [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75],[0.5,0.5]]; // 5-die
    dots.forEach(([fx, fy]) => img.fillCircle(dx+dsize*fx, dy+dsize*fy, dr, C.black[0], C.black[1], C.black[2]));
  };
  drawDie(w*0.18, h*0.70, w*0.18);
  const drawDie2 = (dx, dy, dsize) => {
    img.fillRoundRect(dx, dy, dx+dsize, dy+dsize, dsize*0.18, C.white[0], C.white[1], C.white[2]);
    const dr = dsize * 0.09;
    [[0.25,0.25],[0.75,0.75]].forEach(([fx,fy]) => img.fillCircle(dx+dsize*fx, dy+dsize*fy, dr, C.black[0], C.black[1], C.black[2]));
  };
  drawDie2(w*0.62, h*0.70, w*0.18);

  // "Play online" button
  const btnY = h * 0.78;
  img.fillRoundRect(w*0.20, btnY, w*0.80, btnY + h*0.05, h*0.025, C.gold[0], C.gold[1], C.gold[2]);

  return img;
}

// ─── Adaptive icon (1024×1024, no background — shown on white) ───────────────
function drawAdaptiveIcon(size) {
  const img = new Image(size, size);
  // White background (adaptive icon bg is set in app.json to #2D2B6E)
  img.fillRect(0, 0, size, size, C.indigo[0], C.indigo[1], C.indigo[2]);

  // Centered Ludo board, slightly larger
  const bx1 = size*0.10, by1 = size*0.10, bx2 = size*0.90, by2 = size*0.90;
  img.fillRoundRect(bx1, by1, bx2, by2, size*0.08, C.white[0], C.white[1], C.white[2]);

  const bw = bx2-bx1, bh = by2-by1;
  const half = bw/2, halfh = bh/2;
  const gap = size*0.012, qr = size*0.04;

  img.fillRoundRect(bx1+gap, by1+gap, bx1+half-gap, by1+halfh-gap, qr, C.red[0],    C.red[1],    C.red[2]);
  img.fillRoundRect(bx1+half+gap, by1+gap, bx2-gap, by1+halfh-gap, qr, C.green[0],  C.green[1],  C.green[2]);
  img.fillRoundRect(bx1+gap, by1+halfh+gap, bx1+half-gap, by2-gap, qr, C.blue[0],   C.blue[1],   C.blue[2]);
  img.fillRoundRect(bx1+half+gap, by1+halfh+gap, bx2-gap, by2-gap, qr, C.yellow[0], C.yellow[1], C.yellow[2]);

  const cx = bx1+half, cy = by1+halfh, cs = size*0.045;
  img.fillRect(cx-cs*0.4, cy-cs, cx+cs*0.4, cy, C.red[0],    C.red[1],    C.red[2]);
  img.fillRect(cx, cy-cs*0.4, cx+cs, cy+cs*0.4, C.green[0],  C.green[1],  C.green[2]);
  img.fillRect(cx-cs*0.4, cy, cx+cs*0.4, cy+cs, C.blue[0],   C.blue[1],   C.blue[2]);
  img.fillRect(cx-cs, cy-cs*0.4, cx, cy+cs*0.4, C.yellow[0], C.yellow[1], C.yellow[2]);

  return img;
}

// ─── Generate all assets ──────────────────────────────────────────────────────
console.log('🎨 Generating Ludoline branded assets...\n');

const icon = drawIcon(1024);
fs.writeFileSync(path.join(ASSETS, 'icon.png'), icon.toPng());
console.log('✅ assets/icon.png         (1024×1024) — App icon');

const adaptive = drawAdaptiveIcon(1024);
fs.writeFileSync(path.join(ASSETS, 'adaptive-icon.png'), adaptive.toPng());
console.log('✅ assets/adaptive-icon.png (1024×1024) — Android adaptive icon');

const splash = drawSplash(1284, 2778);
fs.writeFileSync(path.join(ASSETS, 'splash.png'), splash.toPng());
console.log('✅ assets/splash.png        (1284×2778) — Splash screen');

// Also save a 512×512 version for Play Store
const storeIcon = drawIcon(512);
fs.writeFileSync(path.join(ASSETS, 'store-icon.png'), storeIcon.toPng());
console.log('✅ assets/store-icon.png    (512×512)   — Play Store icon');

// Feature graphic 1024×500
const feat = new Image(1024, 500);
feat.fillRect(0, 0, 1024, 500, C.navy[0], C.navy[1], C.navy[2]);
feat.fillCircle(900, 400, 100, C.purpBg[0], C.purpBg[1], C.purpBg[2], 120);
feat.fillCircle(80,  100,  70, C.purpBg[0], C.purpBg[1], C.purpBg[2], 120);
// Mini board
feat.fillRoundRect(80, 80, 420, 420, 30, C.white[0], C.white[1], C.white[2]);
feat.fillRoundRect(90, 90, 245, 245, 20, C.red[0],    C.red[1],    C.red[2]);
feat.fillRoundRect(255, 90, 410, 245, 20, C.green[0],  C.green[1],  C.green[2]);
feat.fillRoundRect(90, 255, 245, 410, 20, C.blue[0],   C.blue[1],   C.blue[2]);
feat.fillRoundRect(255, 255, 410, 410, 20, C.yellow[0], C.yellow[1], C.yellow[2]);
// Gold title bar
feat.fillRect(460, 160, 960, 220, C.gold[0], C.gold[1], C.gold[2]);
feat.fillRect(460, 235, 960, 270, C.white[0], C.white[1], C.white[2], 180);
// Button
feat.fillRoundRect(460, 320, 860, 380, 30, C.gold[0], C.gold[1], C.gold[2]);
fs.writeFileSync(path.join(ASSETS, 'feature-graphic.png'), feat.toPng());
console.log('✅ assets/feature-graphic.png (1024×500)  — Play Store feature graphic');

console.log('\n🎉 All Ludoline branded assets generated!');
console.log('   Colors: Deep Indigo bg + Red/Green/Blue/Yellow Ludo board + Gold title');
console.log('\n📌 Next: Run  eas build --platform android --profile preview');
