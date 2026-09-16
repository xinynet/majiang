/* Rasterise the game screen's inline SVG icons.
 *
 * WXML has no <svg>, so each glyph becomes a transparent PNG. Only the glyph is
 * baked; the coloured pills behind the tool icons stay CSS gradients, which WXSS
 * renders fine and which keeps the PNGs small and recolourable.
 *
 * Stroke and fill are not in the markup - they live in the stylesheet - so they
 * are restated here, matching the .g-* rules in styles-v59.css.
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const H5 = 'C:/mydev/majiang/majiangxiaoxiaole';
const OUT = 'C:/mydev/majiang/mp-tools/static-out/icons';
fs.mkdirSync(OUT, { recursive: true });

// Document order of the <svg> elements inside <section id="game">.
const ICONS = [
  { name: 'pause', fill: '#fff', stroke: 'none' },
  { name: 'star', fill: '#ffd33f', stroke: '#e0a013', width: 1.4 },
  { name: 'rules', fill: 'none', stroke: '#fff', width: 2 },
  { name: 'more', fill: 'none', stroke: '#fff', width: 2 },
  { name: 'quit', fill: 'none', stroke: '#fff', width: 2 },
  { name: 'timer', fill: 'none', stroke: '#fff', width: 2 },
  { name: 'clear', fill: 'none', stroke: '#fff', width: 2.4 },
  { name: 'shuffle', fill: 'none', stroke: '#fff', width: 2.4 },
  { name: 'undo', fill: 'none', stroke: '#fff', width: 2.4 },
  { name: 'magnet', fill: 'none', stroke: '#fff', width: 2.4 },
];

const html = fs.readFileSync(path.join(H5, 'index.html'), 'utf8');
const game = html.slice(html.indexOf('<section id="game"'), html.indexOf('</section>', html.indexOf('<section id="game"')));
const svgs = [...game.matchAll(/<svg viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/g)];

if (svgs.length !== ICONS.length) {
  throw new Error(`expected ${ICONS.length} icons in the game screen, found ${svgs.length}; update ICONS`);
}

const SIZE = 96; // 3x the largest on-screen use, so it stays crisp on any dpr
for (let i = 0; i < ICONS.length; i++) {
  const spec = ICONS[i];
  const [viewBox, body] = [svgs[i][1], svgs[i][2]];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${SIZE}" height="${SIZE}">`
    + `<g fill="${spec.fill}" stroke="${spec.stroke}" stroke-width="${spec.width ?? 0}"`
    + ` stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  await sharp(Buffer.from(svg), { density: 384 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, spec.name + '.png'));
}
console.log(`baked ${ICONS.length} icons -> ${OUT}`);
