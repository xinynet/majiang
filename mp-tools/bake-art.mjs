/* Original artwork for the tool buttons and the meadow header.
 * Generated matching the reference screenshot:
 * - Meadow: bright green grassy hills with scattered flowers + blue-and-white gingham ribbon at the bottom
 * - Tool Icons:
 *   1. Clear (消除): Yellow glowing lightbulb with cyan screw base
 *   2. Shuffle (洗牌): Two overlapping red cards with circular gold recycle arrows
 *   3. Undo (翻牌): Red book/card with curved gold jumping arrow
 *   4. Magnet (磁铁): 3D red horseshoe magnet with gold pole tips
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/mydev/majiang/mp-tools/static-out';
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'bg'), { recursive: true });

const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${body}</svg>`;

const TOOLS = {
  // 1. 消除 (Lightbulb): glowing golden-yellow bulb with cyan/blue base
  'tool-clear': wrap(`
    <defs>
      <linearGradient id="bulbGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff59d"/>
        <stop offset="40%" stop-color="#ffeb3b"/>
        <stop offset="100%" stop-color="#f57f17"/>
      </linearGradient>
      <linearGradient id="baseGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#29b6f6"/>
        <stop offset="50%" stop-color="#4fc3f7"/>
        <stop offset="100%" stop-color="#0288d1"/>
      </linearGradient>
    </defs>
    <!-- Bulb Glass Body -->
    <path d="M32 7 C21.5 7 13.5 15 13.5 25.5 C13.5 32 17 36.5 20.5 40.5 C22.5 42.8 24 45.5 24.5 48.5 L39.5 48.5 C40 45.5 41.5 42.8 43.5 40.5 C47 36.5 50.5 32 50.5 25.5 C50.5 15 42.5 7 32 7 Z"
          fill="url(#bulbGrad)" stroke="#c67d0a" stroke-width="2.8" stroke-linejoin="round"/>
    <!-- Specular highlight -->
    <path d="M22 15 C17 19 17 26 19 31" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>
    <circle cx="27" cy="13" r="2" fill="#ffffff" opacity="0.85"/>
    <!-- Blue Screw Base -->
    <rect x="23.5" y="48.5" width="17" height="4" rx="2" fill="url(#baseGrad)" stroke="#0277bd" stroke-width="1.8"/>
    <rect x="25" y="52.5" width="14" height="4" rx="2" fill="url(#baseGrad)" stroke="#0277bd" stroke-width="1.8"/>
    <rect x="27.5" y="56.5" width="9" height="3" rx="1.5" fill="#78909c" stroke="#455a64" stroke-width="1.5"/>
  `),

  // 2. 洗牌 (Shuffle): Two reddish cards with circular gold recycle arrows
  'tool-shuffle': wrap(`
    <defs>
      <linearGradient id="cardGrad1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#d32f2f"/>
        <stop offset="100%" stop-color="#9a0007"/>
      </linearGradient>
      <linearGradient id="cardGrad2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#e53935"/>
        <stop offset="100%" stop-color="#b71c1c"/>
      </linearGradient>
      <linearGradient id="arrowGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff176"/>
        <stop offset="50%" stop-color="#ffb300"/>
        <stop offset="100%" stop-color="#fb8c00"/>
      </linearGradient>
    </defs>
    <!-- Back card -->
    <rect x="8" y="12" width="28" height="38" rx="4.5" transform="rotate(-15 22 31)"
          fill="url(#cardGrad1)" stroke="#5f0907" stroke-width="2.4"/>
    <rect x="10.5" y="14.5" width="23" height="33" rx="3" transform="rotate(-15 22 31)"
          fill="none" stroke="#ff867c" stroke-width="1.2" opacity="0.6"/>
    <!-- Front card -->
    <rect x="26" y="12" width="28" height="38" rx="4.5" transform="rotate(10 40 31)"
          fill="url(#cardGrad2)" stroke="#5f0907" stroke-width="2.4"/>
    <rect x="28.5" y="14.5" width="23" height="33" rx="3" transform="rotate(10 40 31)"
          fill="none" stroke="#ff867c" stroke-width="1.2" opacity="0.6"/>
    <!-- Recycle Arrows in Center -->
    <g transform="translate(31, 31) scale(0.92)">
      <!-- Top curved arrow -->
      <path d="M -13 0 A 13 13 0 0 1 10 -8" fill="none" stroke="url(#arrowGrad)" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M 5 -15 L 15 -7 L 7 -1 Z" fill="#ffb300" stroke="#b26a00" stroke-width="1.5" stroke-linejoin="round"/>
      <!-- Bottom curved arrow -->
      <path d="M 13 0 A 13 13 0 0 1 -10 8" fill="none" stroke="url(#arrowGrad)" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M -5 15 L -15 7 L -7 1 Z" fill="#ffb300" stroke="#b26a00" stroke-width="1.5" stroke-linejoin="round"/>
    </g>
  `),

  // 3. 翻牌 (Undo / Flip): Red card with curved golden jumping arrow
  'tool-undo': wrap(`
    <defs>
      <linearGradient id="bookGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#e53935"/>
        <stop offset="100%" stop-color="#b71c1c"/>
      </linearGradient>
      <linearGradient id="flipArrow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#fff59d"/>
        <stop offset="40%" stop-color="#ffca28"/>
        <stop offset="100%" stop-color="#f57c00"/>
      </linearGradient>
    </defs>
    <!-- Standing Card/Tile -->
    <rect x="18" y="11" width="34" height="42" rx="5" fill="url(#bookGrad)" stroke="#5f0907" stroke-width="2.6"/>
    <rect x="21" y="14" width="28" height="36" rx="3.5" fill="none" stroke="#ff8a80" stroke-width="1.2" opacity="0.7"/>
    <!-- Tile spine line on left -->
    <line x1="24" y1="12" x2="24" y2="52" stroke="#49120e" stroke-width="2.2"/>
    <line x1="25" y1="12" x2="25" y2="52" stroke="#ffcdd2" stroke-width="1" opacity="0.6"/>
    <!-- Curved Jumping Arrow looping out -->
    <path d="M 10 39 C 9 24, 20 18, 38 19" fill="none" stroke="url(#flipArrow)" stroke-width="8" stroke-linecap="round"/>
    <path d="M 10 39 C 9 24, 20 18, 38 19" fill="none" stroke="#8c4700" stroke-width="8" stroke-linecap="round" stroke-opacity="0.25"/>
    <path d="M 33 11 L 49 20 L 33 30 Z" fill="#ffca28" stroke="#b26a00" stroke-width="2" stroke-linejoin="round"/>
  `),

  // 4. 磁铁 (Magnet): 3D red horseshoe with golden yellow pole tips
  'tool-magnet': wrap(`
    <defs>
      <linearGradient id="magnetRed" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ff4d4d"/>
        <stop offset="60%" stop-color="#d32f2f"/>
        <stop offset="100%" stop-color="#8a0000"/>
      </linearGradient>
      <linearGradient id="goldTip" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff59d"/>
        <stop offset="50%" stop-color="#ffca28"/>
        <stop offset="100%" stop-color="#f57c00"/>
      </linearGradient>
    </defs>
    <!-- Horseshoe body matching reference screenshot -->
    <g transform="translate(32, 33) rotate(250)">
      <!-- Main red curved horseshoe (thick horseshoe arc) -->
      <path d="M -16 10 C -26 -2, -18 -18, -4 -22 C 10 -26, 22 -16, 20 -4"
            fill="none" stroke="url(#magnetRed)" stroke-width="13" stroke-linecap="butt"/>
      <!-- Outer shine highlight -->
      <path d="M -15 8 C -23 -3, -16 -16, -3 -19 C 8 -22, 18 -14, 18 -4"
            fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>
      <!-- Inner rim shadow -->
      <path d="M -11 12 C -17 3, -12 -9, -3 -12 C 5 -15, 12 -9, 13 -3"
            fill="none" stroke="#600000" stroke-width="1.8" opacity="0.45"/>
      <!-- Bottom-left Pole Tip (Yellow block) -->
      <path d="M -19 4 L -9 9 L -13 21 L -23 16 Z"
            fill="url(#goldTip)" stroke="#8f4f00" stroke-width="1.8" stroke-linejoin="round"/>
      <!-- Top-right Pole Tip (Yellow block) -->
      <path d="M 14 -7 L 23 -1 L 18 10 L 9 4 Z"
            fill="url(#goldTip)" stroke="#8f4f00" stroke-width="1.8" stroke-linejoin="round"/>
    </g>
  `),
};

for (const [name, svg] of Object.entries(TOOLS)) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(128, 128)
    .png({ compressionLevel: 9 }).toFile(path.join(OUT, 'icons', name + '.png'));
}

/* Meadow Header Graphic:
 * Exact match to user reference screenshot:
 * 1. Grassy hill skyline with flowers and dark green tree mounds
 * 2. Blue & white checkered gingham ribbon across bottom
 */
const W = 750, H = 240;

// Blue Checkered Ribbon Gingham Pattern
const checkSize = 25;
let ginghamSquares = '';
const cols = Math.ceil(W / checkSize) + 1;
const rows = 3; // 75px height / 25
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const isDark = (r + c) % 2 === 0;
    const fill = isDark ? '#7ab2ea' : '#c3defa';
    ginghamSquares += `<rect x="${c * checkSize}" y="${r * checkSize}" width="${checkSize}" height="${checkSize}" fill="${fill}"/>`;
  }
}

// Scattered 4-petal flowers
const flowerCoords = [
  [45, 38], [115, 72], [185, 28], [260, 78], [325, 42],
  [405, 68], [480, 32], [545, 72], [625, 38], [695, 68],
  [80, 105], [235, 115], [375, 108], [515, 118], [660, 105]
];
let flowers = '';
for (const [fx, fy] of flowerCoords) {
  flowers += `
    <g transform="translate(${fx}, ${fy}) scale(0.95)">
      <circle cx="-5" cy="0" r="4.8" fill="#eaf7d6" opacity="0.95"/>
      <circle cx="5" cy="0" r="4.8" fill="#eaf7d6" opacity="0.95"/>
      <circle cx="0" cy="-5" r="4.8" fill="#eaf7d6" opacity="0.95"/>
      <circle cx="0" cy="5" r="4.8" fill="#eaf7d6" opacity="0.95"/>
      <circle cx="0" cy="0" r="3.2" fill="#ffd54f"/>
    </g>
  `;
}

const meadow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#80cb3a"/>
      <stop offset="50%" stop-color="#8fd746"/>
      <stop offset="100%" stop-color="#9ada4f"/>
    </linearGradient>
  </defs>

  <!-- Grassy Field Background -->
  <rect width="${W}" height="165" fill="url(#grassGrad)"/>

  <!-- Rolling Bush Mound Silhouettes (matching screenshot) -->
  <circle cx="20" cy="155" r="62" fill="#4b992b"/>
  <circle cx="85" cy="165" r="54" fill="#58a834"/>
  <circle cx="660" cy="155" r="68" fill="#469327"/>
  <circle cx="730" cy="145" r="60" fill="#52a130"/>
  <path d="M 120 165 Q 240 100 380 155 Q 520 100 640 165 Z" fill="#62b53b" opacity="0.85"/>

  <!-- Small Flowers -->
  ${flowers}

  <!-- Blue & White Checkered Tablecloth Awning (Ribbon) -->
  <g transform="translate(0, 165)">
    <!-- Checkered grid -->
    <g>${ginghamSquares}</g>
    <!-- Gingham overlay shading for fabric depth -->
    <rect width="${W}" height="75" fill="#4a90e2" opacity="0.16"/>
    <!-- Top crisp white highlight edge -->
    <line x1="0" y1="0" x2="${W}" y2="0" stroke="#ffffff" stroke-width="3" opacity="0.9"/>
    <!-- Bottom cyan/blue border line -->
    <line x1="0" y1="75" x2="${W}" y2="75" stroke="#4887cb" stroke-width="3"/>
  </g>
</svg>`;

await sharp(Buffer.from(meadow), { density: 144 })
  .png({ compressionLevel: 9 }).toFile(path.join(OUT, 'bg', 'meadow.png'));

console.log(`Successfully baked ${Object.keys(TOOLS).length} tool icons + meadow header into ${OUT}`);

