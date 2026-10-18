// Builds every product picture from Fluent Emoji icons (svg/, MIT licence) to AVIF and WebP at
// 240 and 480 px with a transparent background, plus a preview sheet.
// Usage: node build.mjs <sizesFile productImages.ts> [outDir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { ICONS } from './icons.mjs';

const HERE = new URL('./', import.meta.url).pathname;
const OUT = process.argv[3] ?? `${HERE}out/`;
const SIZE = 480;
mkdirSync(`${OUT}products`, { recursive: true });

// Pack sizes with their own picture, read from the site's src/data/productImages.ts.
const SIZES = {};
for (const m of readFileSync(process.argv[2], 'utf8').matchAll(/'?([a-z0-9-]+)'?: \[([^\]]*)\]/g))
  SIZES[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);

const file = (name) => `${HERE}svg/${name.toLowerCase().replace(/ /g, '_')}.svg`;

// Moves every colour whose hue lies in [from, to] to the hue `hue` (degrees), lightening by
// `light` (0-1), so only the part that needs it changes: purple grapes turn green, the leaf stays.
function remapColours(svg, { from, to, hue, light = 0, sat = 1 }) {
  return svg.replace(/#([0-9a-f]{6})/gi, (m, hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (d === 0) return m;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (from <= to ? h < from || h > to : h < from && h > to) return m;
    const L = Math.min(1, l + light), S = Math.min(1, s * sat);
    const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), o = L - c / 2;
    const [R, G, B] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[R, G, B].map((v) => Math.round((v + o) * 255).toString(16).padStart(2, '0')).join('')}`;
  });
}

async function icon(name, px, { hue = 0, bright = 1, sat = 1, remap } = {}) {
  const svg = readFileSync(file(name), 'utf8');
  let img = sharp(Buffer.from(remap ? remapColours(svg, remap) : svg), { density: 600 }).resize(px, px, { fit: 'contain', background: '#0000' });
  if (hue || bright !== 1 || sat !== 1) img = sharp(await img.png().toBuffer()).modulate({ hue: (hue + 360) % 360, brightness: bright, saturation: sat });
  return img.png().toBuffer();
}

// Where copies sit: [x, y, size], drawn back to front.
const LAYOUT = {
  1: [[35, 35, 410]],
  2: [[160, 25, 300], [20, 155, 300]],
  3: [[110, 15, 260], [15, 200, 260], [205, 200, 260]],
};

async function render(spec) {
  const names = spec.mix ?? Array(spec.count ?? 1).fill(spec.icon);
  const layers = [];
  for (const [i, [x, y, s]] of LAYOUT[names.length].entries())
    layers.push({ input: await icon(names[i], s, spec), left: x, top: y });
  if (spec.badge) {
    const d = 176, x = SIZE - d - 6, y = SIZE - d - 6;
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${d + 12}" height="${d + 12}"><defs><filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity=".18"/></filter></defs><circle cx="${d / 2 + 6}" cy="${d / 2 + 6}" r="${d / 2}" fill="#fff" filter="url(#s)"/></svg>`), left: x - 6, top: y - 6 });
    layers.push({ input: await icon(spec.badge, 120), left: x + 28, top: y + 28 });
  }
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: '#0000' } }).composite(layers).png().toBuffer();
}

// Bulk and multipack sizes show more of the item: "2 x 4 L" two, "3 x 1.75 L" or "2.27 kg" three.
function sizeSpec(spec, size) {
  if (spec.mix || (spec.count ?? 1) > 1) return spec;
  const pack = /^(\d+)x/.exec(size);
  return { ...spec, count: pack ? Math.min(+pack[1], 3) : 3 };
}

const jobs = [];
for (const [key, spec] of Object.entries(ICONS)) {
  jobs.push([key, spec]);
  for (const size of SIZES[key] ?? []) jobs.push([`${key}--${size}`, sizeSpec(spec, size)]);
}

let total = 0;
const previews = [];
for (const [name, spec] of jobs) {
  const png = await render(spec);
  previews.push([name, png]);
  for (const width of [240, 480]) {
    const resized = sharp(png).resize(width, width, { kernel: 'lanczos3' });
    const avif = await resized.clone().avif({ quality: 52, effort: 9, chromaSubsampling: '4:2:0' }).toBuffer();
    const webp = await resized.clone().webp({ quality: 78, alphaQuality: 85, effort: 6, smartSubsample: true }).toBuffer();
    writeFileSync(`${OUT}products/${name}-${width}.avif`, avif);
    writeFileSync(`${OUT}products/${name}-${width}.webp`, webp);
    total += avif.length + webp.length;
  }
}

// Preview sheet: every picture at 200 px on a light card, with its name underneath.
const cols = 10, cell = 220, label = 30, comps = [];
for (const [i, [name, png]] of previews.entries()) {
  const x = (i % cols) * cell + 10, y = Math.floor(i / cols) * (cell + label) + 10;
  comps.push({ input: await sharp(png).resize(200, 200).toBuffer(), left: x, top: y });
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${label}"><text x="2" y="18" font-family="Helvetica" font-size="13" fill="#333">${name}</text></svg>`), left: x, top: y + 202 });
}
await sharp({ create: { width: cols * cell + 20, height: Math.ceil(previews.length / cols) * (cell + label) + 20, channels: 3, background: '#ffffff' } }).composite(comps).png().toFile(`${OUT}preview.png`);
console.log(`${jobs.length} pictures, ${(total / 1024).toFixed(0)} KB in all`);
