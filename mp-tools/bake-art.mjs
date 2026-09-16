/* Original artwork for the tool buttons and the meadow header.
 *
 * These are drawn here rather than copied from the reference game, in the same
 * flat-cartoon style: saturated fills, a darker outline of the same hue, and one
 * soft highlight. Authoring them as SVG keeps them editable; they ship as PNG
 * because WXML cannot render SVG.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/mydev/majiang/mp-tools/static-out';
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'bg'), { recursive: true });

const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

/* Full-colour tool icons: they sit straight on the button, with no coloured
 * plate behind them, so each needs its own silhouette to read at 26px. */
const TOOLS = {
  // Light bulb: the "clear a triple for me" hint.
  'tool-clear': wrap(`
    <path d="M32 6c10 0 17.5 7.4 17.5 17 0 6.3-3.3 10.4-6.2 13.6-1.9 2.1-3.3 3.7-3.6 6.4H24.3c-.3-2.7-1.7-4.3-3.6-6.4-2.9-3.2-6.2-7.3-6.2-13.6C14.5 13.4 22 6 32 6Z"
          fill="#ffd34e" stroke="#c98a10" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M25 14.5c-3.4 2.2-5.4 5.6-5.6 9.6" fill="none" stroke="#fff3bf" stroke-width="3.6" stroke-linecap="round"/>
    <rect x="23.5" y="45" width="17" height="6" rx="3" fill="#cfd4d8" stroke="#8d969d" stroke-width="2.6"/>
    <rect x="25.5" y="52" width="13" height="6" rx="3" fill="#b9c0c6" stroke="#8d969d" stroke-width="2.6"/>
  `),
  // A card flicking over, for the reshuffle.
  'tool-shuffle': wrap(`
    <rect x="12" y="10" width="30" height="42" rx="6" transform="rotate(-13 27 31)"
          fill="#ffe0d2" stroke="#c0442a" stroke-width="3"/>
    <rect x="22" y="12" width="30" height="42" rx="6" transform="rotate(11 37 33)"
          fill="#f25d3d" stroke="#a8341d" stroke-width="3"/>
    <path d="M40 20.5 30.5 35h7L34 47l11-15h-7Z" fill="#ffd34e" stroke="#c98a10" stroke-width="2.4" stroke-linejoin="round"/>
  `),
  // A tile coming back out of the tray.
  'tool-undo': wrap(`
    <path d="M14 46c0-14.4 11-25 25.5-25H50" fill="none" stroke="#ef8c1c" stroke-width="7.5" stroke-linecap="round"/>
    <path d="m40 9 12 12-12 12" fill="none" stroke="#ef8c1c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17 44c.6-9.4 6.2-16.6 14.4-20" fill="none" stroke="#ffc978" stroke-width="3.2" stroke-linecap="round"/>
  `),
  // Horseshoe magnet pulling the matching tiles in.
  'tool-magnet': wrap(`
    <path d="M15 47V29a17 17 0 0 1 34 0v18" fill="none" stroke="#e23b4d" stroke-width="12" stroke-linecap="butt"/>
    <path d="M20 30a12 12 0 0 1 24 0" fill="none" stroke="#ff8f9b" stroke-width="3.4" stroke-linecap="round"/>
    <rect x="9" y="45" width="12" height="11" rx="2" fill="#dfe4e8" stroke="#95a0a8" stroke-width="2.6"/>
    <rect x="43" y="45" width="12" height="11" rx="2" fill="#dfe4e8" stroke="#95a0a8" stroke-width="2.6"/>
  `),
};

for (const [name, svg] of Object.entries(TOOLS)) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(96, 96)
    .png({ compressionLevel: 9 }).toFile(path.join(OUT, 'icons', name + '.png'));
}

/* The meadow strip behind the HUD: hedge along the very top, then sky with
 * clouds, closed off by the picket band that separates it from the table. */
const W = 750, H = 220;
const cloud = (x, y, s, o) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#ffffff" opacity="${o}">
  <ellipse cx="0" cy="0" rx="46" ry="21"/><ellipse cx="-30" cy="6" rx="30" ry="15"/>
  <ellipse cx="28" cy="7" rx="26" ry="14"/><ellipse cx="-6" cy="-14" rx="26" ry="16"/></g>`;
const bush = (x, r) => `<circle cx="${x}" cy="${34 + (x % 37) / 4}" r="${r}" fill="#3f8f4e"/>`;
const flower = (x, y) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#ffffff" opacity=".92"/>`;

let bushes = '', flowers = '';
for (let x = -20; x < W + 40; x += 34) bushes += bush(x, 30 + (x % 53) / 3);
for (let i = 0; i < 26; i++) flowers += flower((i * 71) % W, 16 + ((i * 37) % 34));

const meadow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c3e79c"/><stop offset=".62" stop-color="#a8db8b"/>
    <stop offset="1" stop-color="#8ccb8c"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${cloud(160, 138, .95, .5)}${cloud(530, 112, .8, .42)}${cloud(350, 178, .62, .3)}
  <g>${bushes}</g>
  <g>${flowers}</g>
  <rect y="0" width="${W}" height="10" fill="#347c42"/>
</svg>`;

await sharp(Buffer.from(meadow), { density: 144 })
  .png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, 'bg', 'meadow.png'));

console.log(`baked ${Object.keys(TOOLS).length} tool icons + meadow header -> ${OUT}`);
