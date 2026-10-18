// Drawing kit for the Banana product illustrations.
// Every shape takes real-world sizes in centimetres and a scale (px per cm), and draws with
// its base centred at (cx, groundY). Soft gradients give depth; a ground shadow is added per item.

let uid = 0;
const id = (p) => `${p}${++uid}`;
export const resetIds = () => { uid = 0; };

export const C = {
  white: '#f7f7f4', cream: '#efe6d2', shadow: 'rgba(30,34,30,0.16)',
  blue: '#2f6fd6', red: '#d8432f', green: '#3f9b4c', darkGreen: '#2f6d36', yellow: '#f2c230',
  orange: '#f08a24', brown: '#8a5a33', tan: '#d8b07a', purple: '#6b3f8f', grey: '#c9ccc8',
  ink: '#2b2f2b', clearBlue: 'rgba(190,220,240,0.35)',
};

/** A vertical light-to-dark gradient definition. */
export function grad(defs, light, dark, dir = 'h') {
  const g = id('g');
  const [x2, y2] = dir === 'h' ? ['1', '0'] : ['0', '1'];
  defs.push(`<linearGradient id="${g}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`);
  return `url(#${g})`;
}
export function radial(defs, light, dark) {
  const g = id('r');
  defs.push(`<radialGradient id="${g}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`);
  return `url(#${g})`;
}

/** Darken or lighten a hex colour by a factor. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

export function groundShadow(cx, gy, wPx) {
  return `<ellipse cx="${cx}" cy="${gy + 2}" rx="${(wPx / 2) * 1.02}" ry="${Math.max(5, wPx * 0.06)}" fill="${C.shadow}"/>`;
}

const highlight = (x, y, w, h, o = 0.35) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#fff" opacity="${o}"/>`;

/** Plastic milk jug with a handle on the right and a coloured cap. */
export function jug(defs, cx, gy, s, { w, h, cap = C.blue, body = C.white }) {
  const W = w * s, H = h * s, x = cx - W / 2, top = gy - H;
  const neckW = W * 0.34, shoulder = H * 0.3;
  const fill = grad(defs, body, shade(body, 0.82));
  const handleX = x + W * 0.62;
  return `<g>
    ${groundShadow(cx, gy, W)}
    <path d="M${x + W * 0.06},${gy} L${x + W * 0.94},${gy} Q${x + W},${gy} ${x + W},${gy - H * 0.06} L${x + W},${top + shoulder}
      Q${x + W},${top + shoulder * 0.55} ${x + W * 0.82},${top + shoulder * 0.35} L${cx + neckW / 2},${top + H * 0.09}
      L${cx - neckW / 2},${top + H * 0.09} L${x + W * 0.1},${top + shoulder * 0.6} Q${x},${top + shoulder * 0.85} ${x},${top + shoulder + H * 0.05}
      L${x},${gy - H * 0.06} Q${x},${gy} ${x + W * 0.06},${gy} Z" fill="${fill}"/>
    <path d="M${handleX},${top + shoulder * 0.7} Q${x + W * 0.98},${top + shoulder * 0.7} ${x + W * 0.95},${top + shoulder * 1.9} L${handleX},${top + shoulder * 1.9} Z" fill="${shade(body, 0.7)}" opacity="0.45"/>
    <rect x="${x + W * 0.1}" y="${top + shoulder * 1.15}" width="${W * 0.46}" height="${H * 0.5}" rx="${W * 0.06}" fill="#fff" opacity="0.35"/>
    <rect x="${cx - neckW / 2 - 2}" y="${top}" width="${neckW + 4}" height="${H * 0.1}" rx="3" fill="${cap}"/>
    <rect x="${cx - neckW / 2 - 2}" y="${top}" width="${neckW + 4}" height="${H * 0.035}" rx="3" fill="${shade(cap, 1.25)}"/>
  </g>`;
}

/** Gable-top carton (juice, oat drink, milk carton). */
export function carton(defs, cx, gy, s, { w, h, color, band = C.white, cap = C.white }) {
  const W = w * s, H = h * s, x = cx - W / 2, top = gy - H, gable = W * 0.42;
  const front = grad(defs, color, shade(color, 0.8));
  return `<g>
    ${groundShadow(cx, gy, W)}
    <rect x="${x}" y="${top + gable}" width="${W}" height="${H - gable}" rx="3" fill="${front}"/>
    <path d="M${x},${top + gable} L${cx},${top + gable * 0.25} L${x + W},${top + gable} Z" fill="${shade(color, 1.18)}"/>
    <rect x="${cx - W * 0.06}" y="${top}" width="${W * 0.12}" height="${gable * 0.32}" fill="${shade(color, 0.85)}"/>
    <rect x="${x}" y="${top + gable + (H - gable) * 0.32}" width="${W}" height="${(H - gable) * 0.34}" fill="${band}" opacity="0.9"/>
    <circle cx="${x + W * 0.7}" cy="${top + gable * 0.82}" r="${W * 0.1}" fill="${cap}"/>
    ${highlight(x + W * 0.08, top + gable + 6, W * 0.08, (H - gable) * 0.8, 0.25)}
  </g>`;
}

/** Bottle: kind 'oil' (tall, handle), 'sauce' (slim), 'squeeze' (dish soap), 'detergent' (wide with spout cap). */
export function bottle(defs, cx, gy, s, { w, h, color, cap = C.ink, kind = 'oil', label = C.white, clear = false }) {
  const W = w * s, H = h * s, x = cx - W / 2, top = gy - H;
  const body = grad(defs, color, shade(color, 0.78));
  const op = clear ? 0.85 : 1;
  if (kind === 'detergent') {
    return `<g>${groundShadow(cx, gy, W)}
      <rect x="${x}" y="${top + H * 0.12}" width="${W}" height="${H * 0.88}" rx="${W * 0.14}" fill="${body}"/>
      <path d="M${x + W * 0.58},${top + H * 0.2} q${W * 0.36},0 ${W * 0.36},${H * 0.22} l0,${H * 0.12} q-${W * 0.1},0 -${W * 0.16},-${H * 0.08} z" fill="${shade(color, 0.7)}" opacity="0.5"/>
      <rect x="${x + W * 0.12}" y="${top}" width="${W * 0.34}" height="${H * 0.15}" rx="4" fill="${cap}"/>
      <rect x="${x + W * 0.1}" y="${top + H * 0.42}" width="${W * 0.62}" height="${H * 0.36}" rx="8" fill="${label}" opacity="0.92"/>
      ${highlight(x + W * 0.06, top + H * 0.2, W * 0.06, H * 0.6)}</g>`;
  }
  const neckW = kind === 'squeeze' ? W * 0.32 : W * 0.3;
  const neckH = kind === 'oil' ? H * 0.2 : kind === 'sauce' ? H * 0.28 : H * 0.12;
  const capH = H * 0.08;
  return `<g opacity="${op}">${groundShadow(cx, gy, W)}
    <path d="M${x},${gy - W * 0.12} L${x},${top + neckH + H * 0.1} Q${x},${top + neckH} ${cx - neckW / 2},${top + neckH - H * 0.02}
      L${cx - neckW / 2},${top + capH} L${cx + neckW / 2},${top + capH} L${cx + neckW / 2},${top + neckH - H * 0.02}
      Q${x + W},${top + neckH} ${x + W},${top + neckH + H * 0.1} L${x + W},${gy - W * 0.12} Q${x + W},${gy} ${x + W - W * 0.12},${gy}
      L${x + W * 0.12},${gy} Q${x},${gy} ${x},${gy - W * 0.12} Z" fill="${body}"/>
    <rect x="${cx - neckW / 2 - 1}" y="${top}" width="${neckW + 2}" height="${capH + 2}" rx="3" fill="${cap}"/>
    <rect x="${x + W * 0.1}" y="${top + H * 0.45}" width="${W * 0.8}" height="${H * 0.3}" rx="6" fill="${label}" opacity="0.92"/>
    ${highlight(x + W * 0.12, top + neckH + H * 0.06, W * 0.08, H * 0.5)}</g>`;
}

/** Cylindrical can, seen slightly from above. */
export function can(defs, cx, gy, s, { d, h, color, band = C.white, lid = C.grey }) {
  const W = d * s, H = h * s, x = cx - W / 2, top = gy - H, ry = W * 0.12;
  const body = grad(defs, color, shade(color, 0.72));
  return `<g>${groundShadow(cx, gy, W)}
    <path d="M${x},${top + ry} L${x},${gy - ry} A${W / 2},${ry} 0 0 0 ${x + W},${gy - ry} L${x + W},${top + ry} Z" fill="${body}"/>
    <rect x="${x}" y="${top + ry + H * 0.25}" width="${W}" height="${H * 0.35}" fill="${band}" opacity="0.9"/>
    <ellipse cx="${cx}" cy="${top + ry}" rx="${W / 2}" ry="${ry}" fill="${lid}"/>
    <ellipse cx="${cx}" cy="${top + ry}" rx="${W / 2 - 3}" ry="${ry - 2}" fill="${shade(lid, 1.15)}"/>
    ${highlight(x + W * 0.12, top + ry * 2, W * 0.07, H * 0.6, 0.3)}</g>`;
}

/** Soft package: kind 'pouch' (frozen/stand-up), 'chips' (crimped, puffy), 'sack' (rice/flour), 'mesh' (potatoes/onions), 'clear' (see-through with contents). */
export function bag(defs, cx, gy, s, { w, h, color, kind = 'pouch', window: win = null, label = null, contents = '' }) {
  const W = w * s, H = h * s, x = cx - W / 2, top = gy - H;
  const body = grad(defs, color, shade(color, 0.78));
  let out = groundShadow(cx, gy, W);
  if (kind === 'chips') {
    out += `<path d="M${x + W * 0.04},${top + H * 0.08} Q${cx},${top} ${x + W * 0.96},${top + H * 0.08} Q${x + W * 1.03},${cx === 0 ? 0 : top + H * 0.5} ${x + W * 0.96},${gy - H * 0.06} Q${cx},${gy + 4} ${x + W * 0.04},${gy - H * 0.06} Q${x - W * 0.03},${top + H * 0.5} ${x + W * 0.04},${top + H * 0.08} Z" fill="${body}"/>
      <path d="M${x + W * 0.04},${top + H * 0.08} ${Array.from({ length: 12 }, (_, i) => `L${x + W * 0.04 + (W * 0.92 * (i + 0.5)) / 12},${top + H * (i % 2 ? 0.06 : 0.1)}`).join(' ')} L${x + W * 0.96},${top + H * 0.08}" stroke="${shade(color, 0.7)}" stroke-width="2" fill="none"/>`;
  } else if (kind === 'mesh') {
    out += `<path d="M${x + W * 0.1},${top + H * 0.08} L${x + W * 0.9},${top + H * 0.08} Q${x + W * 1.04},${top + H * 0.6} ${x + W * 0.92},${gy} L${x + W * 0.08},${gy} Q${x - W * 0.04},${top + H * 0.6} ${x + W * 0.1},${top + H * 0.08} Z" fill="${body}"/>
      ${contents}
      <path d="M${x + W * 0.1},${top + H * 0.08} L${x + W * 0.9},${top + H * 0.08}" stroke="${shade(color, 0.6)}" stroke-width="${Math.max(3, W * 0.04)}"/>
      <rect x="${cx - W * 0.16}" y="${top + H * 0.02}" width="${W * 0.32}" height="${H * 0.1}" rx="4" fill="${label ?? C.red}"/>`;
    return `<g>${out}</g>`;
  } else {
    const r = kind === 'sack' ? W * 0.08 : W * 0.06;
    out += `<rect x="${x}" y="${top + H * 0.05}" width="${W}" height="${H * 0.95}" rx="${r}" fill="${body}"/>
      <rect x="${x + W * 0.02}" y="${top}" width="${W * 0.96}" height="${H * 0.1}" rx="${r / 2}" fill="${shade(color, kind === 'sack' ? 0.85 : 0.9)}"/>`;
  }
  if (win) out += `<rect x="${x + W * 0.16}" y="${top + H * 0.3}" width="${W * 0.68}" height="${H * 0.45}" rx="${W * 0.08}" fill="${win}"/>`;
  out += contents;
  if (label) out += `<rect x="${x + W * 0.12}" y="${top + H * 0.14}" width="${W * 0.76}" height="${H * 0.1}" rx="5" fill="${label}" opacity="0.95"/>`;
  out += highlight(x + W * 0.07, top + H * 0.16, W * 0.06, H * 0.6, 0.22);
  return `<g>${out}</g>`;
}

/** Rectangular box with a visible top face. */
export function box(defs, cx, gy, s, { w, h, d = 4, color, band = null, window: win = null, contents = '' }) {
  const W = w * s, H = h * s, D = d * s * 0.45, x = cx - W / 2 - D / 2, top = gy - H;
  const front = grad(defs, color, shade(color, 0.8));
  return `<g>${groundShadow(cx, gy, W + D)}
    <path d="M${x},${top} L${x + D},${top - D} L${x + W + D},${top - D} L${x + W},${top} Z" fill="${shade(color, 1.2)}"/>
    <path d="M${x + W},${top} L${x + W + D},${top - D} L${x + W + D},${gy - D} L${x + W},${gy} Z" fill="${shade(color, 0.7)}"/>
    <rect x="${x}" y="${top}" width="${W}" height="${H}" fill="${front}"/>
    ${band ? `<rect x="${x}" y="${top + H * 0.62}" width="${W}" height="${H * 0.2}" fill="${band}"/>` : ''}
    ${win ? `<rect x="${x + W * 0.15}" y="${top + H * 0.2}" width="${W * 0.7}" height="${H * 0.36}" rx="${W * 0.06}" fill="${win}"/>` : ''}
    ${contents}</g>`;
}

/** Foam tray with plastic wrap; `contents` is drawn inside the tray area (x, y, w, h passed back). */
export function tray(defs, cx, gy, s, { w, d, contents, color = C.white }) {
  const W = w * s, H = d * s * 0.5, x = cx - W / 2, top = gy - H;
  return `<g>${groundShadow(cx, gy, W)}
    <path d="M${x},${top} L${x + W},${top} L${x + W - W * 0.04},${gy} L${x + W * 0.04},${gy} Z" fill="${grad(defs, color, shade(color, 0.85), 'v')}"/>
    ${contents(x + W * 0.05, top - H * 0.55, W * 0.9, H * 1.2)}
    <path d="M${x},${top} Q${cx},${top - H * 0.9} ${x + W},${top}" fill="${C.clearBlue}" stroke="#fff" stroke-opacity="0.6"/>
  </g>`;
}

/** Clear clamshell or punnet showing round contents. */
export function clamshell(defs, cx, gy, s, { w, h, fruit, n = 14, r = 1.6, color = C.clearBlue, rim = '#9fc6df' }) {
  const W = w * s, H = h * s, x = cx - W / 2, top = gy - H;
  const R = r * s;
  let dots = '';
  const cols = Math.max(2, Math.round(W / (R * 1.9)));
  const rows = Math.max(1, Math.round(n / cols));
  let k = 0;
  for (let j = 0; j < rows + 1 && k < n; j++) {
    for (let i = 0; i < cols && k < n; i++, k++) {
      const fx = x + R * 1.1 + i * ((W - R * 2.2) / Math.max(1, cols - 1)) + (j % 2 ? R * 0.4 : 0);
      const fy = gy - R * 1.05 - j * R * 1.35;
      if (fy - R < top - R * 0.6) continue;
      dots += fruit(fx, fy, R);
    }
  }
  return `<g>${groundShadow(cx, gy, W)}${dots}
    <rect x="${x}" y="${top}" width="${W}" height="${H}" rx="${W * 0.06}" fill="${color}" stroke="${rim}" stroke-width="2"/>
    ${highlight(x + W * 0.06, top + H * 0.12, W * 0.05, H * 0.7, 0.4)}</g>`;
}

/** Glass/plastic jar with a lid. */
export function jar(defs, cx, gy, s, { d, h, color, lid = C.red, label = C.white }) {
  const W = d * s, H = h * s, x = cx - W / 2, top = gy - H;
  return `<g>${groundShadow(cx, gy, W)}
    <rect x="${x}" y="${top + H * 0.14}" width="${W}" height="${H * 0.86}" rx="${W * 0.12}" fill="${grad(defs, color, shade(color, 0.75))}"/>
    <rect x="${x + W * 0.04}" y="${top}" width="${W * 0.92}" height="${H * 0.16}" rx="5" fill="${lid}"/>
    <rect x="${x}" y="${top + H * 0.4}" width="${W}" height="${H * 0.34}" fill="${label}" opacity="0.92"/>
    ${highlight(x + W * 0.1, top + H * 0.2, W * 0.07, H * 0.6, 0.3)}</g>`;
}

/** Round tub (yogurt, ice cream) slightly wider at the top. */
export function tub(defs, cx, gy, s, { d, h, color, lid, band = null }) {
  const W = d * s, H = h * s, top = gy - H, ry = W * 0.1;
  return `<g>${groundShadow(cx, gy, W * 0.9)}
    <path d="M${cx - W / 2},${top + ry} L${cx - W * 0.43},${gy - ry} A${W * 0.43},${ry} 0 0 0 ${cx + W * 0.43},${gy - ry} L${cx + W / 2},${top + ry} Z" fill="${grad(defs, color, shade(color, 0.8))}"/>
    ${band ? `<rect x="${cx - W * 0.46}" y="${top + H * 0.38}" width="${W * 0.92}" height="${H * 0.3}" fill="${band}" opacity="0.9"/>` : ''}
    <ellipse cx="${cx}" cy="${top + ry}" rx="${W / 2 + 2}" ry="${ry + 2}" fill="${lid}"/>
    <ellipse cx="${cx}" cy="${top + ry - 2}" rx="${W / 2 - 4}" ry="${ry - 2}" fill="${shade(lid, 1.15)}"/></g>`;
}

// ---------- produce ----------

export function apple(defs, x, y, R, color = C.red) {
  return `<g><path d="M${x},${y - R * 0.7} C${x + R * 1.25},${y - R * 1.25} ${x + R * 1.3},${y + R * 0.9} ${x},${y + R * 0.95} C${x - R * 1.3},${y + R * 0.9} ${x - R * 1.25},${y - R * 1.25} ${x},${y - R * 0.7} Z" fill="${radial(defs, shade(color, 1.25), shade(color, 0.7))}"/>
    <path d="M${x},${y - R * 0.7} q${R * 0.08},-${R * 0.35} ${R * 0.22},-${R * 0.45}" stroke="${C.brown}" stroke-width="${R * 0.1}" fill="none" stroke-linecap="round"/>
    <path d="M${x + R * 0.15},${y - R * 0.9} q${R * 0.45},-${R * 0.25} ${R * 0.6},${R * 0.05} q-${R * 0.35},${R * 0.22} -${R * 0.6},-${R * 0.05}" fill="${C.green}"/></g>`;
}
export function citrus(defs, x, y, R, color = C.orange) {
  return `<g><circle cx="${x}" cy="${y}" r="${R}" fill="${radial(defs, shade(color, 1.25), shade(color, 0.75))}"/>
    <circle cx="${x + R * 0.1}" cy="${y - R * 0.85}" r="${R * 0.09}" fill="${C.darkGreen}"/></g>`;
}
export function lemon(defs, x, y, R) {
  return `<g><ellipse cx="${x}" cy="${y}" rx="${R * 1.25}" ry="${R}" fill="${radial(defs, '#fff27a', '#e5b712')}"/>
    <ellipse cx="${x + R * 1.25}" cy="${y}" rx="${R * 0.16}" ry="${R * 0.12}" fill="#e5b712"/><ellipse cx="${x - R * 1.25}" cy="${y}" rx="${R * 0.12}" ry="${R * 0.1}" fill="#cfa20e"/></g>`;
}
export function bananaBunch(defs, cx, gy, s, { n = 5, len = 19, color = C.yellow, organic = false }) {
  let out = groundShadow(cx, gy, len * s * 0.9);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 2.2 * s;
    const L = len * s, top = gy - L * 0.62 + Math.abs(i - (n - 1) / 2) * 1.2 * s;
    out += `<path d="M${cx - L * 0.45 + off * 0.3},${top + L * 0.05} Q${cx + off},${gy + L * 0.08} ${cx + L * 0.5 + off * 0.3},${top - L * 0.02}
      Q${cx + off * 0.6},${gy - L * 0.18} ${cx - L * 0.45 + off * 0.3},${top + L * 0.05} Z" fill="${grad(defs, shade(color, 1.1), shade(color, 0.82), 'v')}" stroke="${shade(color, 0.75)}" stroke-width="1"/>`;
  }
  out += `<path d="M${cx - len * s * 0.47},${gy - len * s * 0.58} l-${s * 1.8},-${s * 1.6}" stroke="#5b4426" stroke-width="${s * 1.1}" stroke-linecap="round"/>`;
  if (organic) out += `<circle cx="${cx + len * s * 0.15}" cy="${gy - len * s * 0.2}" r="${s * 1.6}" fill="${C.green}"/><path d="M${cx + len * s * 0.15 - s * 0.8},${gy - len * s * 0.2} l${s * 0.6},${s * 0.6} l${s * 1},-${s * 1.1}" stroke="#fff" stroke-width="${s * 0.35}" fill="none"/>`;
  return `<g>${out}</g>`;
}
export function grapeBunch(defs, cx, gy, s, { w = 13, h = 17, color }) {
  const W = w * s, H = h * s, R = 1.15 * s;
  let out = groundShadow(cx, gy, W * 0.8);
  const rows = Math.floor(H / (R * 1.7));
  for (let j = 0; j < rows; j++) {
    const rowW = W * (1 - j / rows) ** 0.8 * 0.95 + R;
    const count = Math.max(1, Math.round(rowW / (R * 1.8)));
    for (let i = 0; i < count; i++) {
      const x = cx - rowW / 2 + R + (i * (rowW - 2 * R)) / Math.max(1, count - 1) + (j % 2 ? R * 0.4 : 0);
      const y = gy - H + R * 3 + j * R * 1.6;
      out += `<circle cx="${x}" cy="${y}" r="${R}" fill="${radial(defs, shade(color, 1.3), shade(color, 0.7))}"/>`;
    }
  }
  out += `<path d="M${cx},${gy - H + R * 2} l${s},-${s * 2}" stroke="${C.brown}" stroke-width="${s * 0.6}" stroke-linecap="round"/>`;
  return `<g>${out}</g>`;
}
export function avocado(defs, x, y, R, cut = false) {
  const skin = `<ellipse cx="${x}" cy="${y}" rx="${R * 0.78}" ry="${R}" fill="${radial(defs, '#5a7a2c', '#2e3d17')}"/>`;
  if (!cut) return skin;
  return `<g><ellipse cx="${x}" cy="${y}" rx="${R * 0.78}" ry="${R}" fill="#3a4a1c"/><ellipse cx="${x}" cy="${y}" rx="${R * 0.68}" ry="${R * 0.9}" fill="${radial(defs, '#e9f0a0', '#b9cf55')}"/><circle cx="${x}" cy="${y + R * 0.15}" r="${R * 0.36}" fill="${radial(defs, '#b07a46', '#6e4422')}"/></g>`;
}
export function cucumber(defs, cx, gy, s, { len, d, wrap = false }) {
  const L = len * s, D = d * s;
  return `<g>${groundShadow(cx, gy, L)}
    <rect x="${cx - L / 2}" y="${gy - D}" width="${L}" height="${D}" rx="${D / 2}" fill="${grad(defs, '#4f8f3a', '#244d1d', 'v')}"/>
    ${wrap ? `<rect x="${cx - L / 2 - 2}" y="${gy - D - 2}" width="${L + 4}" height="${D + 4}" rx="${D / 2 + 2}" fill="${C.clearBlue}" stroke="#fff" stroke-opacity="0.6"/>` : ''}
    <rect x="${cx - L * 0.4}" y="${gy - D * 0.8}" width="${L * 0.7}" height="${D * 0.14}" rx="${D * 0.07}" fill="#fff" opacity="0.25"/></g>`;
}
export function tomato(defs, x, y, R, roma = false) {
  const body = roma
    ? `<ellipse cx="${x}" cy="${y}" rx="${R * 0.8}" ry="${R * 1.05}" fill="${radial(defs, '#ff6a4d', '#b8261a')}"/>`
    : `<circle cx="${x}" cy="${y}" r="${R}" fill="${radial(defs, '#ff6a4d', '#b8261a')}"/>`;
  const top = roma ? y - R * 1.02 : y - R * 0.95;
  return `<g>${body}<path d="M${x - R * 0.35},${top + R * 0.08} L${x},${top - R * 0.1} L${x + R * 0.35},${top + R * 0.08} L${x},${top + R * 0.2} Z" fill="${C.darkGreen}"/></g>`;
}
export function pepper(defs, x, y, R) {
  return `<g><path d="M${x - R},${y - R * 0.5} Q${x - R * 1.1},${y + R} ${x - R * 0.3},${y + R * 0.95} Q${x},${y + R * 0.75} ${x + R * 0.3},${y + R * 0.95} Q${x + R * 1.1},${y + R} ${x + R},${y - R * 0.5} Q${x},${y - R * 1.05} ${x - R},${y - R * 0.5} Z" fill="${radial(defs, '#ff5b3f', '#a51b10')}"/>
    <path d="M${x},${y - R * 0.8} q-${R * 0.1},-${R * 0.4} ${R * 0.25},-${R * 0.55}" stroke="${C.darkGreen}" stroke-width="${R * 0.18}" fill="none" stroke-linecap="round"/></g>`;
}
export function broccoli(defs, cx, gy, s, { w = 13, h = 17 }) {
  const W = w * s, H = h * s;
  let out = groundShadow(cx, gy, W * 0.7);
  out += `<path d="M${cx - W * 0.1},${gy} L${cx - W * 0.14},${gy - H * 0.45} L${cx + W * 0.14},${gy - H * 0.45} L${cx + W * 0.1},${gy} Z" fill="#8fbf5f"/>`;
  const R = W * 0.2;
  for (const [dx, dy] of [[-0.28, 0.62], [0.28, 0.62], [0, 0.74], [-0.15, 0.85], [0.17, 0.86], [-0.34, 0.75], [0.34, 0.76]]) {
    out += `<circle cx="${cx + dx * W}" cy="${gy - dy * H}" r="${R}" fill="${radial(defs, '#5ea33f', '#245a1f')}"/>`;
  }
  return `<g>${out}</g>`;
}
export function carrot(defs, x1, y1, x2, y2, w) {
  return `<g><path d="M${x1},${y1 - w / 2} L${x2},${y2} L${x1},${y1 + w / 2} Z" fill="${grad(defs, '#ff9a3c', '#d9601a', 'v')}"/>
    <path d="M${x1},${y1} l-${w * 0.9},-${w * 0.5} M${x1},${y1} l-${w},${w * 0.1} M${x1},${y1} l-${w * 0.7},${w * 0.6}" stroke="${C.green}" stroke-width="${w * 0.25}" stroke-linecap="round"/></g>`;
}
export function potato(defs, x, y, R) {
  return `<ellipse cx="${x}" cy="${y}" rx="${R * 1.3}" ry="${R}" fill="${radial(defs, '#d9b07a', '#8f6436')}"/>`;
}
export function onion(defs, x, y, R) {
  return `<g><path d="M${x},${y - R * 1.25} Q${x + R * 1.2},${y - R * 0.4} ${x + R},${y + R * 0.5} Q${x},${y + R * 1.2} ${x - R},${y + R * 0.5} Q${x - R * 1.2},${y - R * 0.4} ${x},${y - R * 1.25} Z" fill="${radial(defs, '#f0c27a', '#b26f24')}"/></g>`;
}
export function leafyHead(defs, cx, gy, s, { w, h, light, dark, stalk = '#e8f0d0' }) {
  const W = w * s, H = h * s;
  let out = groundShadow(cx, gy, W);
  for (let i = -2; i <= 2; i++) {
    const lw = W * 0.3, lx = cx + i * W * 0.14;
    out += `<path d="M${lx},${gy} Q${lx - lw},${gy - H * 0.55} ${lx + i * W * 0.05},${gy - H * (0.85 + (2 - Math.abs(i)) * 0.06)} Q${lx + lw},${gy - H * 0.55} ${lx},${gy} Z" fill="${grad(defs, light, dark)}"/>`;
    out += `<path d="M${lx},${gy} L${lx + i * W * 0.03},${gy - H * 0.6}" stroke="${stalk}" stroke-width="${Math.max(2, W * 0.025)}"/>`;
  }
  return `<g>${out}</g>`;
}
export function mushroom(defs, x, y, R) {
  return `<g><rect x="${x - R * 0.35}" y="${y - R * 0.2}" width="${R * 0.7}" height="${R * 0.9}" rx="${R * 0.2}" fill="#efe6d6"/><path d="M${x - R},${y} Q${x - R},${y - R * 1.1} ${x},${y - R * 1.1} Q${x + R},${y - R * 1.1} ${x + R},${y} Z" fill="${radial(defs, '#fbf6ee', '#cdbfa8')}"/></g>`;
}

// ---------- meat, fish ----------
export const meatPieces = (defs, kind) => (x, y, w, h) => {
  const col = { chicken: ['#f5c9b6', '#d99a85'], thigh: ['#f0b6a0', '#c87d68'], beef: ['#c9443e', '#8a2420'], steak: ['#b8383a', '#7a1f22'], pork: ['#f3b7a6', '#c98472'], salmon: ['#ff8a5c', '#d9572f'], sockeye: ['#e8432c', '#a92418'] }[kind];
  const f = radial(defs, col[0], col[1]);
  if (kind === 'beef') return `<path d="M${x},${y + h} Q${x + w * 0.1},${y + h * 0.2} ${x + w * 0.5},${y + h * 0.25} Q${x + w * 0.9},${y + h * 0.2} ${x + w},${y + h} Z" fill="${f}"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${x + w * 0.08 + ((i * 37) % 100) / 100 * w * 0.84}" cy="${y + h * 0.45 + ((i * 53) % 100) / 100 * h * 0.5}" r="${w * 0.012}" fill="#f2a6a0" opacity="0.7"/>`).join('')}`;
  if (kind === 'salmon' || kind === 'sockeye') return `<path d="M${x},${y + h * 0.9} Q${x + w * 0.05},${y + h * 0.3} ${x + w * 0.45},${y + h * 0.25} L${x + w},${y + h * 0.45} Q${x + w * 0.95},${y + h} ${x + w * 0.5},${y + h} Z" fill="${f}"/>${[0.2, 0.4, 0.6, 0.8].map((t) => `<path d="M${x + w * t},${y + h * 0.35} q${w * 0.06},${h * 0.3} -${w * 0.02},${h * 0.6}" stroke="#ffd0b5" stroke-width="${w * 0.015}" fill="none" opacity="0.8"/>`).join('')}`;
  const n = kind === 'steak' ? 2 : kind === 'pork' ? 3 : 3;
  let out = '';
  for (let i = 0; i < n; i++) {
    const px = x + (w / n) * i + w * 0.02, pw = w / n - w * 0.04;
    out += `<path d="M${px},${y + h} Q${px - pw * 0.05},${y + h * 0.3} ${px + pw * 0.5},${y + h * 0.28} Q${px + pw * 1.05},${y + h * 0.3} ${px + pw},${y + h} Z" fill="${f}"/>`;
    if (kind === 'steak' || kind === 'pork') out += `<path d="M${px + pw * 0.05},${y + h * 0.45} Q${px + pw * 0.5},${y + h * 0.25} ${px + pw * 0.95},${y + h * 0.45}" stroke="#f7e7d7" stroke-width="${pw * 0.07}" fill="none"/>`;
  }
  return out;
};
export function baconPack(defs, cx, gy, s, { w = 25, h = 18 }) {
  const W = w * s, H = h * s, x = cx - W / 2, top = gy - H;
  let strips = '';
  for (let i = 0; i < 5; i++) {
    const sy = top + H * 0.2 + i * H * 0.14;
    strips += `<path d="M${x + W * 0.1},${sy} q${W * 0.2},-${H * 0.04} ${W * 0.4},0 t${W * 0.4},0 l0,${H * 0.1} q-${W * 0.2},${H * 0.04} -${W * 0.4},0 t-${W * 0.4},0 Z" fill="#c8483f"/><path d="M${x + W * 0.1},${sy + H * 0.045} q${W * 0.2},-${H * 0.04} ${W * 0.4},0 t${W * 0.4},0" stroke="#f6d6c6" stroke-width="${H * 0.025}" fill="none"/>`;
  }
  return `<g>${groundShadow(cx, gy, W)}<rect x="${x}" y="${top}" width="${W}" height="${H}" rx="6" fill="#fdf7ee"/>${strips}<rect x="${x}" y="${top}" width="${W}" height="${H * 0.14}" rx="6" fill="${C.red}"/></g>`;
}
export function wholeChicken(defs, cx, gy, s) {
  const W = 22 * s, H = 14 * s;
  return `<g>${groundShadow(cx, gy, W)}<ellipse cx="${cx}" cy="${gy - H * 0.48}" rx="${W / 2}" ry="${H / 2}" fill="${radial(defs, '#f7d8c0', '#d4a27f')}"/>
    <ellipse cx="${cx - W * 0.42}" cy="${gy - H * 0.25}" rx="${W * 0.14}" ry="${H * 0.18}" fill="${radial(defs, '#f7d8c0', '#cf9a76')}"/><ellipse cx="${cx + W * 0.42}" cy="${gy - H * 0.25}" rx="${W * 0.14}" ry="${H * 0.18}" fill="${radial(defs, '#f7d8c0', '#cf9a76')}"/>
    <rect x="${cx - W * 0.55}" y="${gy - H * 1.02}" width="${W * 1.1}" height="${H * 1.02}" rx="${H * 0.45}" fill="${C.clearBlue}" stroke="#fff" stroke-opacity="0.6"/></g>`;
}
export function shrimp(defs, x, y, R) {
  return `<path d="M${x - R},${y} A${R},${R} 0 1 1 ${x + R * 0.6},${y + R * 0.6} L${x + R * 0.25},${y + R * 0.25} A${R * 0.55},${R * 0.55} 0 1 0 ${x - R * 0.45},${y} Z" fill="${radial(defs, '#c9c6c0', '#8e8a84')}"/>`;
}

// ---------- dairy, bakery ----------
export function eggCarton(defs, cx, gy, s, { cols, rows, open = true, flat = false }) {
  const cell = 5 * s, W = cols * cell + s * 2, D = rows * cell * 0.55, H = flat ? 3.5 * s : 7 * s;
  const x = cx - W / 2, top = gy - H;
  let eggs = '';
  for (let j = rows - 1; j >= 0; j--) {
    for (let i = 0; i < cols; i++) {
      const ex = x + s + cell * (i + 0.5) + j * cell * 0.12, ey = top - j * cell * 0.5 + cell * 0.1;
      eggs += `<ellipse cx="${ex}" cy="${ey}" rx="${cell * 0.4}" ry="${cell * 0.5}" fill="${radial(defs, '#fff8ee', '#e6d2b5')}"/>`;
    }
  }
  return `<g>${groundShadow(cx, gy, W + D * 0.3)}
    ${flat ? '' : `<path d="M${x},${top - D * 0.6} L${x + W},${top - D * 0.6} L${x + W},${top - D * 1.7} L${x},${top - D * 1.7} Z" fill="${grad(defs, '#e9e1d1', '#c9bda6', 'v')}" opacity="${open ? 0.95 : 1}"/>`}
    ${eggs}
    <path d="M${x},${top} L${x + W},${top} L${x + W - s},${gy} L${x + s},${gy} Z" fill="${grad(defs, flat ? '#d9cdb8' : '#e9e1d1', flat ? '#b8a88e' : '#c9bda6', 'v')}"/>
    ${Array.from({ length: cols }, (_, i) => `<path d="M${x + s + cell * i + cell * 0.1},${top + 2} q${cell * 0.4},${H * 0.8} ${cell * 0.8},0" stroke="#b8a88e" stroke-width="1.5" fill="none"/>`).join('')}</g>`;
}
export function cheeseBlock(defs, cx, gy, s, { w, h, d, color = '#f2a23a', wrap = true }) {
  return box(defs, cx, gy, s, { w, h, d, color, contents: wrap ? '' : '' }) + `<g opacity="0.25"><rect x="${cx - (w * s) / 2 - (d * s * 0.45) / 2}" y="${gy - h * s}" width="${w * s}" height="${h * s * 0.2}" fill="#fff"/></g>`;
}
export function breadLoaf(defs, cx, gy, s, { w = 24, h = 12, crumb = '#f3dfb5', crust = '#c98a45', bag = true }) {
  const W = w * s, H = h * s, x = cx - W / 2, top = gy - H;
  return `<g>${groundShadow(cx, gy, W)}
    <path d="M${x},${gy} L${x},${top + H * 0.35} Q${x},${top} ${x + W * 0.2},${top} L${x + W * 0.8},${top} Q${x + W},${top} ${x + W},${top + H * 0.35} L${x + W},${gy} Z" fill="${grad(defs, crust, shade(crust, 0.75), 'v')}"/>
    <path d="M${x + W * 0.06},${gy - H * 0.05} L${x + W * 0.06},${top + H * 0.4} Q${x + W * 0.06},${top + H * 0.1} ${x + W * 0.22},${top + H * 0.1}" stroke="${crumb}" stroke-width="${W * 0.04}" fill="none" opacity="0.7"/>
    ${bag ? `<rect x="${x - 4}" y="${top - 4}" width="${W + 18}" height="${H + 4}" rx="${H * 0.3}" fill="${C.clearBlue}" stroke="#fff" stroke-opacity="0.6"/><rect x="${x + W + 8}" y="${top + H * 0.15}" width="${s * 0.9}" height="${H * 0.45}" rx="${s * 0.3}" fill="${C.blue}"/>` : ''}</g>`;
}
export function bagel(defs, x, y, R) {
  return `<g><ellipse cx="${x}" cy="${y}" rx="${R}" ry="${R * 0.62}" fill="${radial(defs, '#e7b46c', '#9f6a2e')}"/><ellipse cx="${x}" cy="${y - R * 0.05}" rx="${R * 0.28}" ry="${R * 0.16}" fill="#7a4e22" opacity="0.85"/></g>`;
}
export function croissant(defs, x, y, R) {
  let out = '';
  for (let i = -2; i <= 2; i++) {
    const sw = R * (1 - Math.abs(i) * 0.18);
    out += `<ellipse cx="${x + i * R * 0.42}" cy="${y + Math.abs(i) * R * 0.12}" rx="${sw * 0.32}" ry="${sw * 0.45}" fill="${radial(defs, '#f2bf6a', '#b7772a')}" transform="rotate(${i * 18} ${x + i * R * 0.42} ${y})"/>`;
  }
  return `<g>${out}</g>`;
}

// ---------- household ----------
export function rollPack(defs, cx, gy, s, { cols, rows, layers = 1, d = 11, h = 11, wrap = '#d9eaf7', roll = '#fbfbf8' }) {
  const R = (d * s) / 2, H = h * s;
  const W = cols * d * s, x = cx - W / 2;
  let out = groundShadow(cx, gy, W + rows * R * 0.6);
  for (let L = 0; L < layers; L++) {
    for (let j = rows - 1; j >= 0; j--) {
      for (let i = 0; i < cols; i++) {
        const rx = x + R + i * d * s + j * R * 0.55, base = gy - L * H - j * R * 0.5;
        out += `<rect x="${rx - R}" y="${base - H}" width="${R * 2}" height="${H}" fill="${grad(defs, roll, shade(roll, 0.84))}"/>`;
        out += `<ellipse cx="${rx}" cy="${base - H}" rx="${R}" ry="${R * 0.32}" fill="#ffffff"/><ellipse cx="${rx}" cy="${base - H}" rx="${R * 0.3}" ry="${R * 0.1}" fill="#c9b79a"/>`;
      }
    }
  }
  const totalH = layers * H + rows * R * 0.5 + R * 0.4;
  out += `<rect x="${x - 3}" y="${gy - totalH}" width="${W + rows * R * 0.55 + 6}" height="${totalH}" rx="8" fill="${wrap}" opacity="0.35"/>`;
  out += `<rect x="${x + W * 0.15}" y="${gy - totalH * 0.55}" width="${W * 0.7}" height="${totalH * 0.18}" rx="6" fill="${C.blue}" opacity="0.85"/>`;
  return `<g>${out}</g>`;
}
export function bottleCase(defs, cx, gy, s, { cols, rows, d = 6.5, h = 21, color = '#9fd0f0', cap = C.blue, cardboard = '#b07b45' }) {
  let out = groundShadow(cx, gy, cols * d * s + rows * d * s * 0.5);
  for (let j = rows - 1; j >= 0; j--) {
    for (let i = 0; i < cols; i++) {
      const bx = cx - (cols * d * s) / 2 + d * s * (i + 0.5) + j * d * s * 0.45;
      const by = gy - j * d * s * 0.42;
      out += `<rect x="${bx - (d * s) / 2 + 1}" y="${by - h * s}" width="${d * s - 2}" height="${h * s}" rx="${d * s * 0.3}" fill="${color}" opacity="0.95"/><rect x="${bx - d * s * 0.18}" y="${by - h * s - s * 1.2}" width="${d * s * 0.36}" height="${s * 1.4}" rx="2" fill="${cap}"/>`;
    }
  }
  out += `<rect x="${cx - (cols * d * s) / 2 - 2}" y="${gy - h * s * 0.22}" width="${cols * d * s + rows * d * s * 0.45 + 4}" height="${h * s * 0.22}" fill="${cardboard}"/>`;
  return `<g>${out}</g>`;
}
