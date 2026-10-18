import * as K from './shapes.mjs';

const { C } = K;

/**
 * One entry per picture. `key` is the product key (sku without "sim-"); `size` is the pack size
 * the picture shows (as in the catalogue), so a lookup can pick the right one for an offer.
 * `group`: pictures in the same group share one scale (px per cm), so their sizes compare
 * honestly; `w`/`h` are the drawing's real overall width/height in cm, used to fit the group.
 */
export const ITEMS = [];
const add = (key, size, group, w, h, draw, base = false) => ITEMS.push({ key, size, group, w, h, draw, base });

/** Draw n copies side by side, overlapping a little, the middle one in front. */
const row = (n, stepCm, one) => (defs, cx, gy, s) => {
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));
  return order.map((i) => one(defs, cx + (i - (n - 1) / 2) * stepCm * s, gy - Math.abs(i - (n - 1) / 2) * 0.01, s)).join('');
};
const scatter = (pts, R, one) => (defs, cx, gy, s) => {
  return K.groundShadow(cx, gy, (Math.max(...pts.map((p) => Math.abs(p[0]))) * 2 + R * 2) * s) +
    [...pts].sort((a, b) => a[1] - b[1]).map(([dx, dy]) => one(defs, cx + dx * s, gy - (R + dy) * s, R * s)).join('');
};
const fruitsIn = (pts, R, one) => (x0, gy, s, defs) => pts.map(([dx, dy]) => one(defs, x0 + dx * s, gy - dy * s, R * s)).join('');

// ---------------- Fruits ----------------
add('bananas', 'per lb', 'bananas', 24, 15, (d, cx, gy, s) => K.bananaBunch(d, cx, gy, s, { n: 5 }), true);
add('bananas', '3 lb', 'bananas', 30, 18, (d, cx, gy, s) => K.bananaBunch(d, cx - 2 * s, gy, s, { n: 5 }) + K.bananaBunch(d, cx + 4 * s, gy, s, { n: 4 }));
add('organic-bananas', 'per lb', 'bananas', 24, 15, (d, cx, gy, s) => K.bananaBunch(d, cx, gy, s, { n: 5, organic: true }), true);

const appleTrio = [[-5, 0], [5, 0], [0, 6]];
add('gala-apples', 'per lb', 'apples', 18, 16, scatter(appleTrio, 4, (d, x, y, R) => K.apple(d, x, y, R, '#d23b2c')), true);
add('honeycrisp-apples', 'per lb', 'apples', 18, 16, scatter(appleTrio, 4.4, (d, x, y, R) => K.apple(d, x, y, R, '#e0583a')), true);
add('gala-apples', '2.27 kg', 'apples', 30, 34, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 26, h: 34, color: '#f3f0e8', kind: 'mesh', label: C.red,
  contents: fruitsIn([[-8, 4.5], [0, 4.5], [8, 4.5], [-4, 12], [4, 12], [-8, 19], [0, 19], [8, 19], [-4, 26], [4, 26]], 4, (dd, x, y, R) => K.apple(dd, x, y, R, '#d23b2c'))(cx, gy, s, d) }));

add('navel-oranges', 'per lb', 'citrus', 20, 16, scatter([[-5, 0], [5, 0], [0, 7]], 4.3, (d, x, y, R) => K.citrus(d, x, y, R, C.orange)), true);
add('mandarins', '2 lb', 'citrus', 22, 26, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 20, h: 26, color: '#f6e4cc', kind: 'mesh', label: C.red,
  contents: fruitsIn([[-6, 3], [0, 3], [6, 3], [-3, 9], [3, 9], [-6, 15], [0, 15], [6, 15], [-3, 20.5], [3, 20.5]], 3, (dd, x, y, R) => K.citrus(dd, x, y, R, '#f7941d'))(cx, gy, s, d) }), true);
add('mandarins', '5 lb', 'citrus', 34, 22, (d, cx, gy, s) => K.box(d, cx, gy, s, { w: 30, h: 12, d: 20, color: '#c99a5c', band: '#f08a24',
  contents: fruitsIn([[-11, 15], [-5, 15.6], [1, 15], [7, 15.5], [-8, 18.5], [-2, 19], [4, 18.6], [10, 18.2]], 3, (dd, x, y, R) => K.citrus(dd, x, y, R, '#f7941d'))(cx, gy, s, d) }));
add('lemons', '1 each', 'lemon', 12, 9, (d, cx, gy, s) => K.groundShadow(cx, gy, 10 * s) + K.lemon(d, cx, gy - 4 * s, 4 * s), true);

add('strawberries', '454 g', 'berries', 17, 9, (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w: 16, h: 8, n: 14, r: 2, fruit: (x, y, R) => `<path d="M${x - R},${y - R * 0.5} Q${x},${y - R * 1.3} ${x + R},${y - R * 0.5} Q${x + R * 0.6},${y + R} ${x},${y + R * 1.1} Q${x - R * 0.6},${y + R} ${x - R},${y - R * 0.5} Z" fill="#e0332b"/><path d="M${x - R * 0.6},${y - R * 0.75} l${R * 0.6},-${R * 0.3} l${R * 0.6},${R * 0.3}" stroke="${C.green}" stroke-width="${R * 0.3}" fill="none"/>` }), true);
add('strawberries', '907 g', 'berries', 23, 11, (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w: 22, h: 10, n: 24, r: 2, fruit: (x, y, R) => `<path d="M${x - R},${y - R * 0.5} Q${x},${y - R * 1.3} ${x + R},${y - R * 0.5} Q${x + R * 0.6},${y + R} ${x},${y + R * 1.1} Q${x - R * 0.6},${y + R} ${x - R},${y - R * 0.5} Z" fill="#e0332b"/><path d="M${x - R * 0.6},${y - R * 0.75} l${R * 0.6},-${R * 0.3} l${R * 0.6},${R * 0.3}" stroke="${C.green}" stroke-width="${R * 0.3}" fill="none"/>` }));
const blueberry = (_d) => (x, y, R) => `<circle cx="${x}" cy="${y}" r="${R}" fill="#3b4f8f"/><circle cx="${x - R * 0.3}" cy="${y - R * 0.35}" r="${R * 0.25}" fill="#8fa3d6" opacity="0.6"/>`;
add('blueberries', '510 g', 'berries', 13, 8, (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w: 12, h: 7, n: 40, r: 0.9, fruit: blueberry(d) }), true);
add('blueberries', '1 kg', 'berries', 18, 10, (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w: 17, h: 9, n: 70, r: 0.9, fruit: blueberry(d) }));

add('red-grapes', 'per lb', 'grapes', 15, 20, (d, cx, gy, s) => K.grapeBunch(d, cx, gy, s, { w: 13, h: 18, color: '#7c2f57' }), true);
add('green-grapes', 'per lb', 'grapes', 15, 20, (d, cx, gy, s) => K.grapeBunch(d, cx, gy, s, { w: 13, h: 18, color: '#9fc04a' }), true);
add('green-grapes', '1.36 kg', 'grapes', 28, 30, (d, cx, gy, s) => K.grapeBunch(d, cx - 6 * s, gy, s, { w: 14, h: 20, color: '#9fc04a' }) + K.grapeBunch(d, cx + 6 * s, gy, s, { w: 14, h: 20, color: '#a9c955' }) +
  `<rect x="${cx - 14 * s}" y="${gy - 27 * s}" width="${28 * s}" height="${27 * s}" rx="${3 * s}" fill="${C.clearBlue}" stroke="#fff" stroke-opacity="0.6"/>`);

add('avocados', '4 ct', 'avocado', 22, 14, scatter([[-7, 0], [-2, 1], [4, 0], [9, 1]], 3.6, (d, x, y, R) => K.avocado(d, x, y, R, false)) , true);
add('avocados', '6 ct', 'avocado', 28, 26, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 24, h: 26, color: '#e8efe0', kind: 'mesh', label: C.green,
  contents: fruitsIn([[-6, 4], [0, 4], [6, 4], [-3, 12], [3, 12], [0, 19]], 3.6, (dd, x, y, R) => K.avocado(dd, x, y, R))(cx, gy, s, d) }));

// ---------------- Vegetables ----------------
add('english-cucumber', '1 each', 'cucumber', 34, 6, (d, cx, gy, s) => K.cucumber(d, cx, gy, s, { len: 33, d: 5, wrap: true }), true);
add('mini-cucumbers', '397 g', 'cucumber', 18, 7, (d, cx, gy, s) => K.tray(d, cx, gy, s, { w: 17, d: 11, contents: (x, y, w, h) => [0, 1, 2, 3, 4].map((i) => K.cucumber(d, x + w / 2, y + h * 0.95, s, { len: 14, d: 3.2 }).replace('<g>', `<g transform="translate(0 ${-i * 2.3 * s})">`)).join('') }), true);
add('mini-cucumbers', '907 g', 'cucumber', 26, 9, (d, cx, gy, s) => K.tray(d, cx, gy, s, { w: 25, d: 14, contents: (x, y, w, h) => [0, 1, 2, 3, 4, 5, 6].map((i) => K.cucumber(d, x + w / 2 + (i % 2 ? 3 * s : -3 * s), y + h * 0.95, s, { len: 14, d: 3.2 }).replace('<g>', `<g transform="translate(0 ${-i * 1.9 * s})">`)).join('') }));
add('roma-tomatoes', 'per lb', 'tomato', 20, 14, scatter([[-6, 0], [0, 0.5], [6, 0], [-3, 6], [3, 6]], 3.3, (d, x, y, R) => K.tomato(d, x, y, R, true)), true);
const cherry = (d) => (x, y, R) => K.tomato(d, x, y, R);
add('cherry-tomatoes', '283 g', 'tomato', 12, 7, (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w: 11, h: 7, n: 18, r: 1.3, fruit: cherry(d) }), true);
add('cherry-tomatoes', '907 g', 'tomato', 21, 10, (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w: 20, h: 9, n: 50, r: 1.3, fruit: cherry(d) }));
add('red-peppers', 'per lb', 'pepper', 20, 12, scatter([[-4.5, 0], [4.5, 0.5]], 4.5, (d, x, y, R) => K.pepper(d, x, y, R)), true);
add('red-peppers', '6 ct', 'pepper', 32, 20, scatter([[-10, 0], [0, 0.5], [10, 0], [-5, 7], [5, 7.5], [0, 13]], 4.5, (d, x, y, R) => K.pepper(d, x, y, R)));
add('broccoli', 'per lb', 'broccoli', 15, 18, (d, cx, gy, s) => K.broccoli(d, cx, gy, s, { w: 14, h: 18 }), true);
const carrotsBag = (w, h, n) => (d, cx, gy, s) => K.bag(d, cx, gy, s, { w, h, color: '#f7f2e9', kind: 'pouch', label: C.green, window: 'rgba(255,255,255,0.4)',
  contents: Array.from({ length: n }, (_, i) => { const y = gy - h * s * (0.78 - i * (0.5 / n)); return K.carrot(d, cx - w * s * 0.32, y, cx + w * s * 0.36, y + s, 3 * s); }).join('') });
add('carrots', '907 g', 'carrots', 17, 30, carrotsBag(16, 30, 5), true);
add('carrots', '2.27 kg', 'carrots', 24, 42, carrotsBag(23, 42, 8));
const potatoSack = (w, h, n) => (d, cx, gy, s) => K.bag(d, cx, gy, s, { w, h, color: '#d6c3a1', kind: 'mesh', label: '#7a4e22',
  contents: Array.from({ length: n }, (_, i) => K.potato(d, cx + ((i % 3) - 1) * w * 0.27 * s, gy - (5 + Math.floor(i / 3) * 7.5) * s, 4 * s)).join('') });
add('russet-potatoes', '4.54 kg', 'potatoes', 28, 40, potatoSack(26, 40, 12), true);
add('russet-potatoes', '9.07 kg', 'potatoes', 36, 52, potatoSack(34, 52, 18));
add('yellow-onions', '1.36 kg', 'potatoes', 20, 26, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 19, h: 26, color: '#f0d9a8', kind: 'mesh', label: C.red,
  contents: fruitsIn([[-5, 4], [0, 4], [5, 4], [-2.5, 11], [2.5, 11], [-5, 17], [0, 17], [5, 17]], 3.5, (dd, x, y, R) => K.onion(dd, x, y, R))(cx, gy, s, d) }), true);
const romaine = (n) => (d, cx, gy, s) => row(n, 7, (dd, x, g, sc) => K.leafyHead(dd, x, g, sc, { w: 9, h: 24, light: '#7fbf4d', dark: '#3c7a2a' }))(d, cx, gy, s) +
  `<rect x="${cx - (n * 7 + 4) / 2 * s}" y="${gy - 26 * s}" width="${(n * 7 + 4) * s}" height="${26 * s}" rx="${3 * s}" fill="${C.clearBlue}" stroke="#fff" stroke-opacity="0.6"/>`;
add('romaine-hearts', '3 ct', 'romaine', 25, 26, romaine(3), true);
add('romaine-hearts', '6 ct', 'romaine', 46, 26, romaine(6));
add('baby-spinach', '312 g', 'leafy', 19, 10, (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w: 18, h: 9, n: 30, r: 1.8, fruit: (x, y, R) => `<ellipse cx="${x}" cy="${y}" rx="${R}" ry="${R * 0.7}" fill="#3f8a34" transform="rotate(${(x * 7) % 60 - 30} ${x} ${y})"/>` }), true);
const mush = (w, h, n) => (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w, h, n, r: 2.2, color: 'rgba(60,120,200,0.25)', rim: '#4d7fc0', fruit: (x, y, R) => K.mushroom(d, x, y, R) });
add('white-mushrooms', '227 g', 'mushrooms', 14, 8, mush(13, 7, 8), true);
add('white-mushrooms', '907 g', 'mushrooms', 23, 11, mush(22, 10, 20));
add('baby-bok-choy', 'per lb', 'leafy', 20, 20, (d, cx, gy, s) => row(3, 6, (dd, x, g, sc) => K.leafyHead(dd, x, g, sc, { w: 8, h: 18, light: '#5aa846', dark: '#2f6d36', stalk: '#f1f6e4' }))(d, cx, gy, s), true);
add('gai-lan', 'per lb', 'leafy', 20, 24, (d, cx, gy, s) => K.leafyHead(d, cx, gy, s, { w: 16, h: 24, light: '#3f7d3a', dark: '#1f4a22', stalk: '#9cc27a' }), true);
add('firm-tofu', '454 g', 'tofu', 13, 6, (d, cx, gy, s) => K.box(d, cx, gy, s, { w: 12, h: 5, d: 9, color: '#f7f5ec', band: C.blue, window: '#fffdf6' }), true);

// ---------------- Meat & seafood ----------------
const meatTray = (w, dpth, kind) => (d, cx, gy, s) => K.tray(d, cx, gy, s, { w, d: dpth, contents: K.meatPieces(d, kind) });
add('chicken-breast', 'per lb', 'meat', 24, 9, meatTray(24, 16, 'chicken'), true);
add('chicken-breast', 'per kg', 'meat', 34, 12, meatTray(34, 22, 'chicken'));
add('chicken-thighs', 'per lb', 'meat', 24, 9, meatTray(24, 16, 'thigh'), true);
add('chicken-thighs', 'per kg', 'meat', 34, 12, meatTray(34, 22, 'thigh'));
add('whole-chicken', 'per lb', 'meat', 24, 15, (d, cx, gy, s) => K.wholeChicken(d, cx, gy, s), true);
add('lean-ground-beef', '454 g', 'meat', 18, 8, meatTray(18, 13, 'beef'), true);
add('extra-lean-ground-beef', '454 g', 'meat', 18, 8, meatTray(18, 13, 'beef'), true);
add('lean-ground-beef', '1.8 kg', 'meat', 30, 11, meatTray(30, 20, 'beef'));
add('striploin-steak', 'per lb', 'meat', 24, 9, meatTray(24, 16, 'steak'), true);
add('striploin-steak', 'per kg', 'meat', 34, 12, meatTray(34, 22, 'steak'));
add('pork-chops', 'per lb', 'meat', 26, 9, meatTray(26, 16, 'pork'), true);
add('bacon', '375 g', 'meat', 25, 18, (d, cx, gy, s) => K.baconPack(d, cx, gy, s, { w: 25, h: 17 }), true);
add('bacon', '3 x 500 g', 'meat', 34, 30, (d, cx, gy, s) => [2, 1, 0].map((i) => K.baconPack(d, cx + (i - 1) * 4 * s, gy - i * 5 * s, s, { w: 27, h: 19 })).join(''));
add('atlantic-salmon', 'per lb', 'meat', 26, 9, meatTray(26, 15, 'salmon'), true);
add('atlantic-salmon', 'per kg', 'meat', 38, 12, meatTray(38, 20, 'salmon'));
add('sockeye-salmon', 'per lb', 'meat', 26, 9, meatTray(26, 15, 'sockeye'), true);
const shrimpBag = (w, h, n) => (d, cx, gy, s) => K.bag(d, cx, gy, s, { w, h, color: '#1f5fa8', kind: 'pouch', label: '#ffffff', window: '#dbe9f5',
  contents: Array.from({ length: n }, (_, i) => K.shrimp(d, cx + ((i % 3) - 1) * w * 0.2 * s, gy - h * s * (0.32 + Math.floor(i / 3) * 0.12), 1.8 * s)).join('') });
add('raw-shrimp', '680 g', 'shrimp', 22, 30, shrimpBag(21, 30, 9), true);
add('raw-shrimp', '907 g', 'shrimp', 25, 34, shrimpBag(24, 34, 12));
const tuna = (d, cx, gy, s) => K.can(d, cx, gy, s, { d: 8.5, h: 4, color: '#2f6fd6', band: '#f4f1e6' });
add('canned-tuna', '170 g', 'tuna', 9, 5, tuna, true);
add('canned-tuna', '8 x 170 g', 'tuna', 38, 9, (d, cx, gy, s) => row(4, 8.6, tuna)(d, cx - 1.5 * s, gy - 4.2 * s, s) + row(4, 8.6, tuna)(d, cx + 1.5 * s, gy, s));

// ---------------- Dairy & eggs ----------------
const jug4 = (d, cx, gy, s) => K.jug(d, cx, gy, s, { w: 16, h: 27, cap: C.blue });
add('milk-2-4l', '4 L', 'dairy', 16, 27, jug4, true);
add('milk-2-4l', '2 x 4 L', 'dairy', 33, 27, row(2, 16.5, jug4));
add('milk-1-2l', '2 L', 'dairy', 11, 23, (d, cx, gy, s) => K.jug(d, cx, gy, s, { w: 11, h: 23, cap: '#5aa2e8' }), true);
add('oat-milk', '1.89 L', 'dairy', 9.5, 25, (d, cx, gy, s) => K.carton(d, cx, gy, s, { w: 9.5, h: 25, color: '#d8c29b', band: '#f7f1e3', cap: '#6b5634' }), true);
const oj = (d, cx, gy, s) => K.carton(d, cx, gy, s, { w: 9.5, h: 24, color: '#f39a1e', band: '#fff4dc', cap: '#2f8a3a' });
add('orange-juice', '1.75 L', 'dairy', 9.5, 24, oj, true);
add('orange-juice', '3 x 1.75 L', 'dairy', 30, 24, row(3, 10, oj));
add('large-eggs-12', '12 ct', 'eggs', 33, 16, (d, cx, gy, s) => K.eggCarton(d, cx, gy, s, { cols: 6, rows: 2 }), true);
add('large-eggs-30', '30 ct', 'eggs', 33, 22, (d, cx, gy, s) => K.eggCarton(d, cx, gy, s, { cols: 6, rows: 5, flat: true }), true);
const cheddar = (w, h, dp) => (d, cx, gy, s) => K.box(d, cx, gy, s, { w, h, d: dp, color: '#f2a23a', band: '#1d4e8f' });
add('cheddar', '400 g', 'cheese', 16, 6, cheddar(14, 4.5, 8), true);
add('cheddar', '1.2 kg', 'cheese', 26, 8, cheddar(24, 6, 10));
add('mozzarella', '320 g', 'cheese', 17, 23, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 17, h: 23, color: '#2a5fa8', kind: 'pouch', label: '#ffffff', window: '#fbf7e8',
  contents: Array.from({ length: 30 }, (_, i) => `<rect x="${cx - 5 * s + ((i * 37) % 100) / 100 * 10 * s}" y="${gy - 15 * s + ((i * 61) % 100) / 100 * 8 * s}" width="${2.4 * s}" height="${0.5 * s}" rx="${0.2 * s}" fill="#f2e6c2" transform="rotate(${(i * 47) % 90 - 45} ${cx - 5 * s + ((i * 37) % 100) / 100 * 10 * s + 1.2 * s} ${gy - 15 * s + ((i * 61) % 100) / 100 * 8 * s})"/>`).join('') }), true);
const yogurt = (d, cx, gy, s) => K.tub(d, cx, gy, s, { d: 12, h: 10, color: '#f7f7f2', lid: '#2f6fd6', band: '#2f6fd6' });
add('greek-yogurt', '750 g', 'cheese', 12, 10, yogurt, true);
add('greek-yogurt', '2 x 750 g', 'cheese', 25, 10, row(2, 12.5, yogurt));
const butter = (d, cx, gy, s) => K.box(d, cx, gy, s, { w: 12, h: 5, d: 6.5, color: '#f6d96a', band: '#c43a2f' });
add('butter', '454 g', 'cheese', 13, 6, butter, true);
add('butter', '4 x 454 g', 'cheese', 27, 11, (d, cx, gy, s) => row(2, 12.5, butter)(d, cx - 1 * s, gy - 5 * s, s) + row(2, 12.5, butter)(d, cx + 1 * s, gy, s));

// ---------------- Bakery ----------------
add('white-bread', '675 g', 'bread', 27, 13, (d, cx, gy, s) => K.breadLoaf(d, cx, gy, s, { crust: '#e2b26b' }), true);
add('whole-wheat-bread', '675 g', 'bread', 27, 13, (d, cx, gy, s) => K.breadLoaf(d, cx, gy, s, { crust: '#a86b38', crumb: '#d9b98a' }), true);
add('whole-wheat-bread', '2 x 675 g', 'bread', 30, 26, (d, cx, gy, s) => K.breadLoaf(d, cx - 1.5 * s, gy - 12.5 * s, s, { crust: '#a86b38', crumb: '#d9b98a' }) + K.breadLoaf(d, cx + 1.5 * s, gy, s, { crust: '#a86b38', crumb: '#d9b98a' }));
const bagelBag = (w, h, n) => (d, cx, gy, s) => K.bag(d, cx, gy, s, { w, h, color: '#f3ecdf', kind: 'pouch', label: '#a86b38', window: 'rgba(255,255,255,0.5)',
  contents: Array.from({ length: n }, (_, i) => K.bagel(d, cx + ((i % 2) ? 2.5 * s : -2.5 * s) * (w > 20 ? 1.6 : 1), gy - (4 + i * (h - 9) / n) * s, 4.3 * s)).join('') });
add('bagels', '6 ct', 'bread', 13, 26, bagelBag(12, 26, 6), true);
add('bagels', '12 ct', 'bread', 24, 28, (d, cx, gy, s) => bagelBag(11, 27, 6)(d, cx - 6 * s, gy, s) + bagelBag(11, 27, 6)(d, cx + 6 * s, gy, s));
const croissantBox = (w, n) => (d, cx, gy, s) => K.clamshell(d, cx, gy, s, { w, h: 9, n, r: 4.2, color: 'rgba(255,255,255,0.35)', rim: '#d9c7a6', fruit: (x, y, R) => K.croissant(d, x, y - R * 0.2, R) });
add('croissants', '6 ct', 'bread', 25, 10, croissantBox(24, 6), true);
add('croissants', '12 ct', 'bread', 34, 13, (d, cx, gy, s) => croissantBox(33, 8)(d, cx, gy, s) + croissantBox(33, 8)(d, cx, gy - 9 * s, s));

// ---------------- Frozen ----------------
const dots = (cx, gy, s, w, h, colors, n, r) => Array.from({ length: n }, (_, i) => `<circle cx="${cx - w * 0.3 * s + ((i * 37) % 100) / 100 * w * 0.6 * s}" cy="${gy - h * 0.72 * s + ((i * 53) % 100) / 100 * h * 0.4 * s}" r="${r * s}" fill="${colors[i % colors.length]}"/>`).join('');
const frozenBag = (w, h, color, colors, r = 0.8) => (d, cx, gy, s) => K.bag(d, cx, gy, s, { w, h, color, kind: 'pouch', label: '#ffffff', window: '#eef6ea', contents: dots(cx, gy, s, w, h, colors, Math.round(w * h / 6), r) });
add('frozen-peas', '750 g', 'frozen', 20, 28, frozenBag(20, 28, '#2f8a3a', ['#7cc04a', '#5fae3c']), true);
add('frozen-mixed-veg', '1 kg', 'frozen', 22, 30, frozenBag(22, 30, '#2f6fd6', ['#7cc04a', '#f08a24', '#f2c230', '#5fae3c']), true);
add('frozen-mixed-veg', '2.5 kg', 'frozen', 30, 40, frozenBag(30, 40, '#2f6fd6', ['#7cc04a', '#f08a24', '#f2c230', '#5fae3c']));
add('frozen-berries', '600 g', 'frozen', 18, 26, frozenBag(18, 26, '#6b3f8f', ['#3b4f8f', '#c0283a', '#7a1f4f'], 1), true);
add('frozen-berries', '2 kg', 'frozen', 28, 38, frozenBag(28, 38, '#6b3f8f', ['#3b4f8f', '#c0283a', '#7a1f4f'], 1));
add('frozen-pizza', '850 g', 'frozen', 32, 12, (d, cx, gy, s) => K.box(d, cx, gy, s, { w: 30, h: 4.5, d: 30, color: '#c43a2f' }) +
  `<ellipse cx="${cx}" cy="${gy - 9.2 * s}" rx="${12 * s}" ry="${4.8 * s}" fill="#e9b35b"/><ellipse cx="${cx}" cy="${gy - 9.2 * s}" rx="${10.5 * s}" ry="${4 * s}" fill="#d8572f"/>` +
  [[-5, -1], [3, -2], [6, 1], [-1, 1.5], [-6, 2]].map(([x, y]) => `<ellipse cx="${cx + x * s}" cy="${gy - 9.2 * s + y * s}" rx="${1.6 * s}" ry="${0.8 * s}" fill="#9e2a20"/>`).join(''), true);
add('ice-cream', '1.5 L', 'icecream', 16, 12, (d, cx, gy, s) => K.tub(d, cx, gy, s, { d: 16, h: 11, color: '#f6efd9', lid: '#8a5a33', band: '#f3d27a' }), true);
add('frozen-dumplings', '1 kg', 'frozen', 24, 32, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 24, h: 32, color: '#d8432f', kind: 'pouch', label: '#f2c230', window: '#fbf4e6',
  contents: Array.from({ length: 6 }, (_, i) => `<path d="M${cx - 6 * s + (i % 3) * 6 * s - 2.5 * s},${gy - (9 + Math.floor(i / 3) * 6) * s} q${2.5 * s},-${4 * s} ${5 * s},0 z" fill="#f6ecd7" stroke="#d9c7a6"/>`).join('') }), true);

// ---------------- Beverages ----------------
const coffee = (dd, hh) => (d, cx, gy, s) => K.jar(d, cx, gy, s, { d: dd, h: hh, color: '#c0392b', lid: '#3a2a1f', label: '#3a2a1f' });
add('ground-coffee', '920 g', 'coffee', 15, 18, coffee(15, 18), true);
add('ground-coffee', '1.36 kg', 'coffee', 17, 22, coffee(17, 22));
add('spring-water', '24 x 500 ml', 'water', 46, 26, (d, cx, gy, s) => K.bottleCase(d, cx, gy, s, { cols: 6, rows: 4 }), true);
add('spring-water', '40 x 500 ml', 'water', 70, 27, (d, cx, gy, s) => K.bottleCase(d, cx, gy, s, { cols: 8, rows: 5 }));
add('sparkling-water', '12 x 355 ml', 'water', 30, 14, (d, cx, gy, s) => K.box(d, cx, gy, s, { w: 27, h: 12.5, d: 16, color: '#8fd16a', band: '#ffffff' }) +
  K.can(d, cx - 4 * s, gy - 2.5 * s, s, { d: 5, h: 8, color: '#5fbf4a', band: '#eaf7e2' }), true);

// ---------------- Snacks ----------------
add('potato-chips', '200 g', 'snacks', 21, 30, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 20, h: 30, color: '#f2c230', kind: 'chips', label: '#c43a2f' }), true);
add('tortilla-chips', '300 g', 'snacks', 25, 34, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 24, h: 34, color: '#e1622b', kind: 'chips', label: '#2f8a3a' }), true);
add('tortilla-chips', '907 g', 'snacks', 33, 44, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 32, h: 44, color: '#e1622b', kind: 'chips', label: '#2f8a3a' }));
const nuts = (dd, hh) => (d, cx, gy, s) => K.jar(d, cx, gy, s, { d: dd, h: hh, color: '#d9b07a', lid: '#2f6d36', label: '#f7f1e3' });
add('mixed-nuts', '600 g', 'nuts', 11, 14, nuts(11, 14), true);
add('mixed-nuts', '1.13 kg', 'nuts', 13, 18, nuts(13, 18));

// ---------------- Pantry ----------------
add('spaghetti', '900 g', 'pasta', 10, 30, (d, cx, gy, s) => K.box(d, cx, gy, s, { w: 8, h: 29, d: 4, color: '#1d4e8f', window: '#f1d79a' }), true);
add('penne', '900 g', 'pasta', 19, 28, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 18, h: 28, color: '#1d4e8f', kind: 'pouch', label: '#ffffff', window: '#f6e4b3',
  contents: Array.from({ length: 10 }, (_, i) => `<rect x="${cx - 5 * s + (i % 4) * 3 * s}" y="${gy - (16 - Math.floor(i / 4) * 3) * s}" width="${2.8 * s}" height="${0.9 * s}" rx="${0.3 * s}" fill="#e2b35c" transform="rotate(-30 ${cx} ${gy - 13 * s})"/>`).join('') }), true);
add('jasmine-rice', '8 kg', 'rice', 36, 52, (d, cx, gy, s) => K.bag(d, cx, gy, s, { w: 35, h: 52, color: '#f6f3ea', kind: 'sack', label: '#c43a2f', window: '#e7f1dc' }), true);
add('diced-tomatoes', '796 ml', 'cans', 10, 12, (d, cx, gy, s) => K.can(d, cx, gy, s, { d: 10, h: 11.5, color: '#c43a2f', band: '#f4f1e6' }), true);
const oil = (d, cx, gy, s) => K.bottle(d, cx, gy, s, { w: 13, h: 32, color: '#f2c94c', cap: '#2f8a3a', kind: 'oil', label: '#ffffff', clear: true });
add('canola-oil', '3 L', 'bottles', 13, 32, oil, true);
add('canola-oil', '2 x 3 L', 'bottles', 27, 32, row(2, 13.5, oil));
const pb = (dd, hh) => (d, cx, gy, s) => K.jar(d, cx, gy, s, { d: dd, h: hh, color: '#b5793b', lid: '#c43a2f', label: '#f7f1e3' });
add('peanut-butter', '1 kg', 'cans', 11, 14, pb(11, 14), true);
add('peanut-butter', '2 kg', 'cans', 14, 18, pb(14, 18));
add('soy-sauce', '500 ml', 'bottles', 7, 22, (d, cx, gy, s) => K.bottle(d, cx, gy, s, { w: 7, h: 22, color: '#3a1d12', cap: '#c43a2f', kind: 'sauce', label: '#f7f1e3' }), true);
add('instant-ramen', '5 x 85 g', 'pasta', 30, 13, (d, cx, gy, s) => K.box(d, cx, gy, s, { w: 28, h: 11, d: 12, color: '#e1622b', band: '#f2c230', window: '#f6e4b3' }), true);

// ---------------- Household ----------------
add('paper-towels', '6 rolls', 'household', 36, 34, (d, cx, gy, s) => K.rollPack(d, cx, gy, s, { cols: 3, rows: 2, layers: 1, d: 12, h: 28 }), true);
add('paper-towels', '12 rolls', 'household', 50, 64, (d, cx, gy, s) => K.rollPack(d, cx, gy, s, { cols: 3, rows: 2, layers: 2, d: 12, h: 28 }));
add('toilet-paper', '12 rolls', 'household', 34, 25, (d, cx, gy, s) => K.rollPack(d, cx, gy, s, { cols: 3, rows: 2, layers: 2, d: 11, h: 10.5 }), true);
add('toilet-paper', '40 rolls', 'household', 64, 50, (d, cx, gy, s) => K.rollPack(d, cx, gy, s, { cols: 5, rows: 2, layers: 4, d: 11, h: 10.5 }));
const det = (w, h) => (d, cx, gy, s) => K.bottle(d, cx, gy, s, { w, h, color: '#2f6fd6', cap: '#f7f7f2', kind: 'detergent', label: '#f2c230' });
add('laundry-detergent', '2.95 L', 'bottles', 17, 26, det(17, 26), true);
add('laundry-detergent', '4.43 L', 'bottles', 20, 30, det(20, 30));
add('dish-soap', '709 ml', 'bottles', 8, 25, (d, cx, gy, s) => K.bottle(d, cx, gy, s, { w: 8, h: 25, color: '#4caf50', cap: '#f7f7f2', kind: 'squeeze', label: '#ffffff', clear: true }), true);
