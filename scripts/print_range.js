// Simple helper: print lines [start..end] (inclusive) from a file
// Usage: node scripts/print_range.js <path> <start> <end>
const fs = require('fs');
const [,, p, sStr, eStr] = process.argv;
if (!p) { console.error('path required'); process.exit(1); }
const start = Math.max(0, parseInt(sStr || '0', 10));
const end = Math.max(start, parseInt(eStr || String(start+200), 10));
const data = fs.readFileSync(p, 'utf8').split(/\r?\n/);
for (let i = start; i <= Math.min(end, data.length - 1); i++) {
  console.log(data[i]);
}
