/**
 * One-shot cleanup: remove the responsive.css <link> tag from any HTML files
 * inside node_modules that the earlier inject script accidentally touched.
 */
const fs   = require('fs');
const path = require('path');

const NM_ROOT   = path.resolve(__dirname, '..', '..', 'frontend', 'node_modules');
const TAG_REGEX = /\s*<link rel="stylesheet" href="\/Public\/js\/responsive\.css">\n?/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

const files = walk(NM_ROOT);
let cleaned = 0;
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('responsive.css')) continue;
  fs.writeFileSync(file, html.replace(TAG_REGEX, ''));
  cleaned++;
  console.log('  - ', path.relative(NM_ROOT, file));
}
console.log(`\nDone. cleaned=${cleaned}`);
