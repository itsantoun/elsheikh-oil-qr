// Read-only: shows where a client's Water Distribution entries are — under
// which name, which customerId, and any entries pointing at a customer that
// no longer exists. Writes nothing.
//
// Run from the project root (asks for your app login):
//   node scripts/findClientEntries.mjs "rock hill"

import { ref, get } from 'firebase/database';
import { login } from './firebaseLogin.mjs';

const term = (process.argv[2] || '').trim().toLowerCase();
if (!term) {
  console.error('Usage: node scripts/findClientEntries.mjs "<client name>"');
  process.exit(1);
}

const db = await login();
const [custSnap, entSnap] = await Promise.all([get(ref(db, 'customers')), get(ref(db, 'waterDistributionEntries'))]);
const customers = custSnap.val() || {};
const entries = Object.entries(entSnap.val() || {}).map(([id, e]) => ({ id, ...e }));
const has = (s) => String(s || '').toLowerCase().includes(term);

const matchIds = Object.keys(customers).filter((id) => has(customers[id].name) || has(customers[id].nameArabic));
console.log(`\nCustomers matching "${term}":`);
matchIds.forEach((id) => {
  const c = customers[id];
  console.log(`  ${id}  name="${c.name}"  arabic="${c.nameArabic || ''}"  types=${(c.clientTypes || []).join(',')}`);
});
if (matchIds.length === 0) console.log('  (none — the customer record itself may have been deleted or renamed)');

console.log(`\nTotal Water Distribution entries: ${entries.length}`);

const group = (list) => {
  const g = {};
  list.forEach((e) => {
    const k = `customerId=${e.customerId || '(none)'}  name="${e.customerName || ''}"`;
    (g[k] = g[k] || []).push(e);
  });
  Object.entries(g).forEach(([k, l]) => {
    const dates = l.map((e) => String(e.date || '').slice(0, 10)).sort();
    console.log(`  ${l.length} entries  ${k}  (${dates[0]} → ${dates[dates.length - 1]})`);
  });
  if (list.length === 0) console.log('  (none)');
};

console.log(`\nEntries linked to those customers by id, or with "${term}" in the name:`);
group(entries.filter((e) => matchIds.includes(e.customerId) || has(e.customerName) || has(e.customerNameArabic)));

console.log('\nEntries whose customerId no longer exists in Customers:');
group(entries.filter((e) => e.customerId && !customers[e.customerId]));

process.exit(0);
