/**
 * generate-assets.js
 * Generates placeholder PNG assets for Ludoline (icon, splash, adaptive-icon).
 * Replace the output images with your real design before publishing.
 *
 * Run: node scripts/generate-assets.js
 * Requires: npm install canvas  (dev only)
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function drawLudoIcon(canvas, size, bg = '#3182ce') {
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  // White circle
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Dice emoji–style dots
  const dotR = size * 0.055;
  const offset = size * 0.13;
  const dots = [
    [size / 2 - offset, size / 2 - offset],
    [size / 2 + offset, size / 2 - offset],
    [size / 2, size / 2],
    [size / 2 - offset, size / 2 + offset],
    [size / 2 + offset, size / 2 + offset]
  ];
  ctx.fillStyle = '#3182ce';
  dots.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  });

  // App name
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.13}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Ludoline', size / 2, size * 0.95);
}

// icon.png — 1024x1024
const iconCanvas = createCanvas(1024, 1024);
drawLudoIcon(iconCanvas, 1024, '#1a365d');
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), iconCanvas.toBuffer('image/png'));
console.log('✅ assets/icon.png (1024x1024)');

// adaptive-icon.png — 1024x1024 (foreground, transparent bg)
const adaptiveCanvas = createCanvas(1024, 1024);
const actx = adaptiveCanvas.getContext('2d');
// transparent bg, just the icon
actx.fillStyle = 'transparent';
actx.fillRect(0, 0, 1024, 1024);
actx.fillStyle = 'white';
actx.beginPath();
actx.arc(512, 512, 380, 0, Math.PI * 2);
actx.fill();
actx.fillStyle = '#3182ce';
const dotR = 55;
const off = 130;
[[512 - off, 512 - off],[512 + off, 512 - off],[512, 512],[512 - off, 512 + off],[512 + off, 512 + off]].forEach(([x, y]) => {
  actx.beginPath();
  actx.arc(x, y, dotR, 0, Math.PI * 2);
  actx.fill();
});
fs.writeFileSync(path.join(ASSETS_DIR, 'adaptive-icon.png'), adaptiveCanvas.toBuffer('image/png'));
console.log('✅ assets/adaptive-icon.png (1024x1024)');

// splash.png — 1284x2778 (iPhone 14 Pro Max size)
const splashCanvas = createCanvas(1284, 2778);
const sctx = splashCanvas.getContext('2d');
sctx.fillStyle = '#3182ce';
sctx.fillRect(0, 0, 1284, 2778);

// Large icon in center
drawLudoIcon(createCanvas(400, 400), 400, '#2b6cb0');
const tmpIcon = createCanvas(400, 400);
drawLudoIcon(tmpIcon, 400, '#2b6cb0');
sctx.drawImage(tmpIcon, 442, 1000, 400, 400);

// Tagline
sctx.fillStyle = 'white';
sctx.font = 'bold 72px Arial';
sctx.textAlign = 'center';
sctx.fillText('Ludoline', 642, 1480);
sctx.font = '44px Arial';
sctx.fillStyle = 'rgba(255,255,255,0.8)';
sctx.fillText('Play Ludo. Win Real Money.', 642, 1550);

fs.writeFileSync(path.join(ASSETS_DIR, 'splash.png'), splashCanvas.toBuffer('image/png'));
console.log('✅ assets/splash.png (1284x2778)');

console.log('\n🎉 All assets generated in assets/');
console.log('Replace with your real brand assets before publishing.');
