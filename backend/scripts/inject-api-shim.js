/**
 * Inject api-base-shim.js into every HTML page in frontend/.
 * The shim handles localhost URL rewriting AND auto-logout on stale JWTs.
 * Idempotent — safe to re-run.
 *
 *   node backend/scripts/inject-api-shim.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', 'frontend');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'uploads']);
const TAG = `<script src="/Public/js/api-base-shim.js"></script>`;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

let touched = 0, skipped = 0;
for (const file of walk(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('api-base-shim.js')) { skipped++; continue; }
  // Inject as the FIRST <script> in <head> so it patches fetch before any
  // other script runs. If no </head>, fall back to appending before </body>.
  let updated;
  if (/<head[^>]*>/i.test(html)) {
    updated = html.replace(/<head[^>]*>/i, m => `${m}\n  ${TAG}`);
  } else if (html.includes('</body>')) {
    updated = html.replace('</body>', `  ${TAG}\n</body>`);
  } else {
    updated = TAG + '\n' + html;
  }
  fs.writeFileSync(file, updated);
  touched++;
  console.log('  + ', path.relative(ROOT, file));
}
console.log(`\nDone. injected=${touched}  already-had-it=${skipped}`);
