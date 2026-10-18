// Renders every item to AVIF and WebP at 240 and 480 px, transparent, and writes a manifest
// and a preview sheet. Usage: node build.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { ITEMS } from './items.mjs';
import { resetIds } from './shapes.mjs';

const OUT = process.argv[2] ?? new URL('./out/', import.meta.url).pathname;
const SIZE = 480, GROUND = 440, FIT_W = 420, FIT_H = 380;
mkdirSync(`${OUT}products`, { recursive: true });

const slug = (size) => size.toLowerCase().replace(/ x /g, 'x').replace(/[^a-z0-9.]+/g, '-').replace(/\./g, '_').replace(/^-|-$/g, '');
const fileOf = (item) => (item.base ? item.key : `${item.key}--${slug(item.size)}`);

// One scale per group: the largest that fits every picture in the group.
const scale = new Map();
for (const item of ITEMS) {
  const s = Math.min(FIT_W / item.w, FIT_H / item.h);
  scale.set(item.group, Math.min(scale.get(item.group) ?? Infinity, s));
}

/** The group's shared scale, capped so lone small items don't fill the frame, and raised so
 * every picture fills at least MIN_FILL of it (smaller items still stay smaller). */
const MAX_SCALE = 20, MIN_FILL = 0.55;
function scaleOf(item) {
  let s = Math.min(scale.get(item.group), MAX_SCALE);
  const fill = Math.max((item.w * s) / FIT_W, (item.h * s) / FIT_H);
  if (fill < MIN_FILL) s *= MIN_FILL / fill;
  return s;
}

function svgOf(item) {
  resetIds();
  const defs = [];
  const body = item.draw(defs, SIZE / 2, GROUND, scaleOf(item));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><defs>${defs.join('')}</defs>${body}</svg>`;
}

const manifest = [];
let total = { avif: 0, webp: 0 };
const seen = new Set();
for (const item of ITEMS) {
  const name = fileOf(item);
  if (seen.has(name)) throw new Error(`duplicate picture name ${name}`);
  seen.add(name);
  const png = await sharp(Buffer.from(svgOf(item)), { density: 144 }).resize(SIZE, SIZE).png().toBuffer();
  const sizes = {};
  for (const width of [240, 480]) {
    const resized = sharp(png).resize(width, width, { kernel: 'lanczos3' });
    const avif = await resized.clone().avif({ quality: 52, effort: 9, chromaSubsampling: '4:2:0' }).toBuffer();
    const webp = await resized.clone().webp({ quality: 78, alphaQuality: 85, effort: 6, smartSubsample: true }).toBuffer();
    writeFileSync(`${OUT}products/${name}-${width}.avif`, avif);
    writeFileSync(`${OUT}products/${name}-${width}.webp`, webp);
    total.avif += avif.length; total.webp += webp.length;
    sizes[width] = { avif: avif.length, webp: webp.length };
  }
  manifest.push({ key: item.key, size: item.size, file: name, sizes });
}
writeFileSync(`${OUT}manifest.json`, `${JSON.stringify(manifest.map(({ key, size, file }) => ({ key, size, file })), null, 1)}\n`);

// Preview sheet: every picture at 240 px on a light card, with its name and size underneath.
const cols = 8, cell = 260, label = 34;
const rows = Math.ceil(ITEMS.length / cols);
const composites = [];
for (const [i, item] of ITEMS.entries()) {
  const png = await sharp(Buffer.from(svgOf(item)), { density: 144 }).resize(240, 240).png().toBuffer();
  const x = (i % cols) * cell + 10, y = Math.floor(i / cols) * (cell + label) + 10;
  composites.push({ input: png, left: x, top: y });
  const text = `${item.key} · ${item.size}`.replace(/&/g, '&amp;');
  composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${label}"><text x="2" y="20" font-family="Helvetica" font-size="15" fill="#333">${text}</text></svg>`), left: x, top: y + 242 });
}
await sharp({ create: { width: cols * cell + 20, height: rows * (cell + label) + 20, channels: 3, background: '#f4f1ea' } })
  .composite(composites).png().toFile(`${OUT}preview.png`);

console.log(`${manifest.length} pictures, ${ITEMS.filter((i) => i.base).length} base + ${ITEMS.filter((i) => !i.base).length} size versions`);
console.log(`AVIF total ${(total.avif / 1024).toFixed(0)} KB, WebP total ${(total.webp / 1024).toFixed(0)} KB`);
const per = manifest.map((m) => m.sizes[480].avif).sort((a, b) => a - b);
console.log(`AVIF 480 px: median ${(per[Math.floor(per.length / 2)] / 1024).toFixed(1)} KB, largest ${(per.at(-1) / 1024).toFixed(1)} KB`);
const per240 = manifest.map((m) => m.sizes[240].avif).sort((a, b) => a - b);
console.log(`AVIF 240 px: median ${(per240[Math.floor(per240.length / 2)] / 1024).toFixed(1)} KB`);
