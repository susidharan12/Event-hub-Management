/**
 * One-shot: add <script src="/Public/js/ai-chat-widget.js"></script>
 * right after the existing chat-widget script tag in any HTML page that
 * already includes the human chat widget. Idempotent — safe to re-run.
 *
 *  node backend/scripts/inject-ai-widget.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', 'frontend');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'uploads']);
const NEEDLE   = /(<script\s+src="\/Public\/js\/chat-widget\.js"><\/script>)/;
const AI_TAG   = `<script src="/Public/js/ai-chat-widget.js"></script>`;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

let touched = 0, skipped = 0, untouched = 0;
for (const file of walk(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  if (!NEEDLE.test(html)) { untouched++; continue; }
  if (html.includes('ai-chat-widget.js')) { skipped++; continue; }

  const updated = html.replace(NEEDLE, `$1\n  ${AI_TAG}`);
  fs.writeFileSync(file, updated);
  touched++;
  console.log('  + ', path.relative(ROOT, file));
}
console.log(`\nDone. injected=${touched}  already-had-it=${skipped}  no-chat-widget=${untouched}`);
