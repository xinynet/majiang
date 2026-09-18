const sharp = require('./node_modules/sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'majiang-mp', 'src', 'static');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

(async () => {
  const rows = [];
  for (const f of walk(ROOT)) {
    if (!/\.(png|jpe?g)$/i.test(f)) continue;
    try {
      const m = await sharp(f).metadata();
      rows.push({
        rel: path.relative(ROOT, f).replace(/\\/g, '/'),
        w: m.width, h: m.height, ch: m.channels, fmt: m.format,
        sz: fs.statSync(f).size,
      });
    } catch (e) { console.log('  !! unreadable', f, e.message); }
  }
  rows.sort((a, b) => b.sz - a.sz);
  for (const r of rows) {
    console.log(
      String(Math.round(r.sz / 1024)).padStart(6) + 'K  ' +
      String(r.w + 'x' + r.h).padStart(11) + '  ' + r.fmt.padEnd(4) + ' ch' + r.ch + '  ' + r.rel
    );
  }
  console.log('\ntotal ' + (rows.reduce((a, b) => a + b.sz, 0) / 1048576).toFixed(2) + ' MB in ' + rows.length + ' images');
})();
