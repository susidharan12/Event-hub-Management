/**
 * Inject the AI chat widget script into EVERY HTML page in frontend/.
 * Idempotent — safe to re-run; pages that already include the widget are skipped.
 *
 *   node backend/scripts/inject-ai-widget-all.js
 *
 * Notes
 *  • The widget itself decides not to render on auth pages and verify.html
 *    via its own path check, so just dropping the script tag everywhere is safe.
 *  • node_modules/.git/dist/build are skipped at the directory level.
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', 'frontend');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'uploads']);
const TAG = `<script src="/Public/js/ai-chat-widget.js"></script>`;

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
  if (html.includes('ai-chat-widget.js')) { skipped++; continue; }

  // Insert right before </body> if it exists, else append at the end of file.
  const updated = html.includes('</body>')
    ? html.replace(/<\/body>/i, `  ${TAG}\n</body>`)
    : html + '\n' + TAG;

  fs.writeFileSync(file, updated);
  touched++;
  console.log('  + ', path.relative(ROOT, file));
}
console.log(`\nDone. injected=${touched}  already-had-it=${skipped}`);
