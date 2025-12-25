#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const swPath = path.join(root, 'public', 'sw.js');
const mainPath = path.join(root, 'src', 'main.jsx');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function readText(p) { return fs.readFileSync(p, 'utf8'); }
function writeText(p, s) { fs.writeFileSync(p, s, 'utf8'); }

function stamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const MM = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${HH}${MM}`;
}

function gitShaShort() {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore','pipe','ignore'] }).toString().trim(); } catch { return ''; }
}

const pkg = readJSON(pkgPath);
const tag = `${pkg.version}-${stamp()}${gitShaShort() ? '-' + gitShaShort() : ''}`;
const version = `qj-${tag}`;

// Update public/sw.js -> const VERSION = '...'
try {
  let sw = readText(swPath);
  const before = sw;
  sw = sw.replace(/const\s+VERSION\s*=\s*['"][^'"]+['"];?/g, `const VERSION = '${version}';`);
  if (sw !== before) writeText(swPath, sw);
  else console.warn('[inject-version] WARN: Could not find VERSION in public/sw.js');
} catch (e) {
  console.error('[inject-version] Failed to update public/sw.js:', e.message);
}

// Update src/main.jsx -> const SW_VERSION = '...'
try {
  let main = readText(mainPath);
  const before = main;
  main = main.replace(/const\s+SW_VERSION\s*=\s*['"][^'"]+['"];?/g, `const SW_VERSION = '${version}';`);
  if (main !== before) writeText(mainPath, main);
  else console.warn('[inject-version] WARN: Could not find SW_VERSION in src/main.jsx');
} catch (e) {
  console.error('[inject-version] Failed to update src/main.jsx:', e.message);
}

console.log('[inject-version] Set SW version to', version);

