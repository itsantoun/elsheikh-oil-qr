// Read-only: finds saved Client Reports (Report History) for a client and
// prints their Water Distribution rows — a fallback copy of entries that
// were deleted. Writes nothing.
//
// Run from the project root (asks for your app login):
//   node scripts/findClientInReports.mjs "rock hill"

import { ref, get } from 'firebase/database';
import { login } from './firebaseLogin.mjs';

const term = (process.argv[2] || '').trim().toLowerCase();
if (!term) {
  console.error('Usage: node scripts/findClientInReports.mjs "<client name>"');
  process.exit(1);
}

const db = await login();
const reports = (await get(ref(db, 'reports'))).val() || {};
const text = (v) => JSON.stringify(v || '').toLowerCase();

const matches = Object.entries(reports).filter(([, r]) => text(r).includes(term));
console.log(`\nSaved reports: ${Object.keys(reports).length}; mentioning "${term}": ${matches.length}`);

const seen = new Map();
matches.forEach(([id, r]) => {
  const top = Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v !== 'object'));
  console.log(`\nReport ${id}  ${JSON.stringify(top)}`);
  (r.sections || []).filter((g) => g.section === 'Water Distribution').forEach((g) => {
    (g.rows || []).forEach((row) => {
      seen.set(row.key, row);
      console.log(`  ${row.key}  ${String(row.date || '').slice(0, 10)}  ${row.item}  qty=${row.quantity}  $${row.total}  ${row.status}`);
    });
  });
});

console.log(`\nDistinct Water Distribution rows across those reports: ${seen.size}`);
process.exit(0);
