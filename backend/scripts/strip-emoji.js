/**
 * Strip emojis (and the trailing space they leave behind) from JS/HTML/CSS
 * source files. Skips node_modules.
 *
 * Run from project root:  node backend/scripts/strip-emoji.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'uploads']);
const EXTS = new Set(['.js', '.html', '.css', '.mjs', '.cjs']);

// Cover: emoticons, misc symbols, dingbats, transport/map, supplemental symbols,
// pictographs, regional indicator (flags), variation selectors, ZWJ, keycap.
const EMOJI_RX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && EXTS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let touched = 0, totalRemoved = 0;

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  // Conservative: strip emoji + the single trailing space immediately after,
  // so "Done" → "Done" instead of " Done", but standalone emojis don't
  // collapse adjacent text.
  const after = before.replace(new RegExp(EMOJI_RX.source + '\\s?', 'gu'), '');

  if (after === before) continue;

  const removed = (before.match(EMOJI_RX) || []).length;
  fs.writeFileSync(file, after);
  totalRemoved += removed;
  touched++;
  console.log(`  - ${path.relative(ROOT, file)}  (removed ${removed})`);
}

console.log(`\nDone. files=${touched}  total emojis removed=${totalRemoved}`);
