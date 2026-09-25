const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

/**
 * Builds a real multi-size .ico (16/32/48) from the already-rendered PNGs.
 * PNG-compressed ICO entries are supported by every browser since IE11 and
 * are far simpler than hand-encoding BMP DIBs.
 */
const SIZES = [
  [16, "assets/favicon-16x16.png"],
  [32, "assets/favicon-32x32.png"],
  [48, "extension/icons/icon48.png"],
];

const images = SIZES.map(([size, rel]) => ({
  size,
  data: fs.readFileSync(path.join(ROOT, rel)),
}));

// ICONDIR: reserved(2)=0, type(2)=1, count(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

// ICONDIRENTRY (16 bytes each), then the image payloads.
const entries = [];
let offset = header.length + images.length * 16;
for (const img of images) {
  const e = Buffer.alloc(16);
  e.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width  (0 = 256)
  e.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
  e.writeUInt8(0, 2);                              // palette size
  e.writeUInt8(0, 3);                              // reserved
  e.writeUInt16LE(1, 4);                           // color planes
  e.writeUInt16LE(32, 6);                          // bits per pixel
  e.writeUInt32LE(img.data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.data.length;
  entries.push(e);
}

const ico = Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
const out = path.join(ROOT, "assets/favicon.ico");
fs.writeFileSync(out, ico);
console.log(`wrote assets/favicon.ico  ${ico.length} bytes  sizes=${SIZES.map((s) => s[0]).join(",")}`);

// Sanity check: the header must round-trip.
const c = fs.statSync(out).size;
if (c !== offset) { console.error("ICO size mismatch", c, offset); process.exit(1); }
