/**
 * One-shot script: inject <link rel="stylesheet" href="/Public/js/responsive.css">
 * into the <head> of every HTML page in frontend/. Idempotent — safe to re-run.
 *
 * IMPORTANT: skips node_modules and .git so we don't pollute deps.
 *
 * Run from project root:  node backend/scripts/inject-responsive.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..', '..', 'frontend');
const SHEET_TAG = `<link rel="stylesheet" href="/Public/js/responsive.css">`;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let touched = 0, skipped = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('responsive.css')) { skipped++; continue; }

  let updated;
  if (/<\/head>/i.test(html)) {
    updated = html.replace(/<\/head>/i, `  ${SHEET_TAG}\n</head>`);
  } else if (/<head[^>]*>/i.test(html)) {
    updated = html.replace(/<head[^>]*>/i, m => `${m}\n  ${SHEET_TAG}`);
  } else {
    updated = `${SHEET_TAG}\n${html}`;
  }

  fs.writeFileSync(file, updated);
  touched++;
  console.log('  + ', path.relative(ROOT, file));
}

console.log(`\nDone. injected=${touched}  skipped(already had it)=${skipped}  total=${files.length}`);
