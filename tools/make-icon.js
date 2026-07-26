// Builds icon.ico from the knight sprite in chess.html, so the app icon can never
// drift from the in-game art. No dependencies -- Node's zlib does the PNG compression
// and the rest of the container format is written by hand.
//
// Run with: node tools/make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'chess.html');
const OUT = path.join(ROOT, 'icon.ico');

const SIZES = [16, 32, 48, 64, 128, 256];
const BACKGROUND = '#66805a'; // the board's dark square -- the app's own colour

// --- read the knight and the white palette out of chess.html -------------------------

const html = fs.readFileSync(HTML, 'utf8');

const spriteStart = html.indexOf('const SPRITES = {');
const spriteEnd = html.indexOf('\n};', spriteStart) + 3;
if (spriteStart === -1 || spriteEnd < spriteStart) throw new Error('SPRITES not found in chess.html');
const SPRITES = eval('(' + html.slice(spriteStart + 'const SPRITES = '.length, spriteEnd - 1) + ')');

const palMatch = html.match(/let pals = isBlack \?\s*\[[^\]]*\]\s*:\s*(\[[^\]]*\]);/);
if (!palMatch) throw new Error('white palette not found in chess.html');
const PALETTE = eval(palMatch[1]);

const knight = SPRITES.n;
if (!knight || knight.length !== 16) throw new Error('knight sprite is not 16 rows');

// --- colour helpers ------------------------------------------------------------------

function rgb(h) {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

const bg = rgb(BACKGROUND);
const tones = PALETTE.map(rgb);

// The sprite is drawn to stand on the board's baseline, which leaves it low and
// off-centre in a square icon. Recentre its bounding box before compositing.
let top = 16, bottom = -1, left = 16, right = -1;
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    if (knight[y][x] === '0') continue;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
    if (x < left) left = x;
    if (x > right) right = x;
  }
}
const dy = Math.round((16 - (bottom - top + 1)) / 2) - top;
const dx = Math.round((16 - (right - left + 1)) / 2) - left;

// Flatten the sprite onto the background once, at 16x16.
const base = [];
for (let y = 0; y < 16; y++) {
  const row = [];
  for (let x = 0; x < 16; x++) {
    const sy = y - dy;
    const sx = x - dx;
    const v = sy >= 0 && sy < 16 && sx >= 0 && sx < 16 ? knight[sy][sx] : '0';
    row.push(v === '0' ? bg : tones[+v - 1]);
  }
  base.push(row);
}

// --- PNG ------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Nearest-neighbour only: every size must stay hard-edged, never smoothed.
function pngAt(size) {
  const scale = size / 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const o = y * (size * 4 + 1);
    raw[o] = 0; // filter: none
    const src = base[Math.floor(y / scale)];
    for (let x = 0; x < size; x++) {
      const c = src[Math.floor(x / scale)];
      const i = o + 1 + x * 4;
      raw[i] = c[0];
      raw[i + 1] = c[1];
      raw[i + 2] = c[2];
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// --- ICO container ---------------------------------------------------------------------

const images = SIZES.map(pngAt);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(SIZES.length, 4);

let offset = 6 + SIZES.length * 16;
const entries = SIZES.map((size, i) => {
  const e = Buffer.alloc(16);
  e[0] = size === 256 ? 0 : size; // 0 encodes 256
  e[1] = size === 256 ? 0 : size;
  e[2] = 0; // palette size
  e[3] = 0; // reserved
  e.writeUInt16LE(1, 4);  // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(images[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += images[i].length;
  return e;
});

fs.writeFileSync(OUT, Buffer.concat([header, ...entries, ...images]));
console.log(`wrote ${path.relative(ROOT, OUT)} -- ${SIZES.join(', ')}px, ${fs.statSync(OUT).size} bytes`);
