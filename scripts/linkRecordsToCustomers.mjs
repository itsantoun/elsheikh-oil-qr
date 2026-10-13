// One-time repair: links every record to its customer by id and brings its
// saved name up to date.
//
// - A record without a customerId gets one when its saved name (English or
//   Arabic, ignoring case/extra spaces) belongs to exactly one customer.
//   Names shared by two customers, or matching no one, are listed and left
//   alone for a manual fix.
// - A record whose saved name differs from its customer's current name
//   (left over from a rename) gets the current name.
// Only customerId / customerName / customerNameArabic are written. Runs as a
// dry run (shows every change) unless --apply is passed.
//
// Run from the project root (asks for your app login):
//   node scripts/linkRecordsToCustomers.mjs
//   node scripts/linkRecordsToCustomers.mjs --apply

import { ref, get, update } from 'firebase/database';
import { login, ask } from './firebaseLogin.mjs';

const apply = process.argv.includes('--apply');
const COLLECTIONS = ['SoldItems', 'maghsalEntries', 'waterFillingEntries', 'waterDistributionEntries'];
const norm = (s) => String(s || '').trim().toLowerCase();

const db = await login();
const [customers, ...data] = await Promise.all(['customers', ...COLLECTIONS]
  .map(async (c) => (await get(ref(db, c))).val() || {}));

// Same rules as src/utils/customerLink.js.
const byName = new Map();
const shared = new Set();
Object.entries(customers).forEach(([id, c]) => {
  new Set([norm(c.name), norm(c.nameArabic)].filter(Boolean)).forEach((n) => {
    if (byName.has(n) && byName.get(n) !== id) shared.add(n);
    else byName.set(n, id);
  });
});
shared.forEach((n) => byName.delete(n));

const updates = {};
const unmatched = {};
let linked = 0;
let renamed = 0;
COLLECTIONS.forEach((col, i) => {
  Object.entries(data[i]).forEach(([key, rec]) => {
    if (!rec || typeof rec !== 'object') return;
    const path = `${col}/${key}`;
    let id = rec.customerId;
    if (!id) {
      id = byName.get(norm(rec.customerName)) || byName.get(norm(rec.customerNameArabic));
      if (!id) {
        if (rec.customerName) {
          const why = shared.has(norm(rec.customerName)) ? 'name shared by 2+ customers' : 'no customer with this name';
          const k = `${col}: "${rec.customerName}" (${why})`;
          unmatched[k] = (unmatched[k] || 0) + 1;
        }
        return;
      }
      updates[`${path}/customerId`] = id;
      linked++;
      console.log(`  LINK    ${path}  "${rec.customerName}" → ${id} "${customers[id].name}"`);
    }
    const c = customers[id];
    if (!c) return; // customer deleted — keep the saved name
    const name = c.name || c.nameArabic || '';
    if (name && rec.customerName !== name) {
      updates[`${path}/customerName`] = name;
      if ('customerNameArabic' in rec) updates[`${path}/customerNameArabic`] = c.nameArabic || '';
      renamed++;
      if (rec.customerId) console.log(`  NAME    ${path}  "${rec.customerName}" → "${name}"`);
    }
  });
});

console.log(`\nRecords to link to a customer id: ${linked}`);
console.log(`Records whose name will be updated: ${renamed}`);
console.log('\nLeft alone (fix by hand if needed):');
Object.entries(unmatched).forEach(([k, n]) => console.log(`  ${n}x ${k}`));
if (Object.keys(unmatched).length === 0) console.log('  (none)');

if (Object.keys(updates).length === 0) process.exit(0);
if (!apply) {
  console.log('\nDry run — nothing written. Re-run with --apply to make these changes.');
  process.exit(0);
}
if ((await ask(`\nWrite ${Object.keys(updates).length} field updates? Type "yes": `)).toLowerCase() !== 'yes') {
  console.log('Cancelled — nothing written.');
  process.exit(0);
}
await update(ref(db), updates);
console.log('Done.');
process.exit(0);
