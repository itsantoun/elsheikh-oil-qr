// Read-only: lists every name the Water Distribution entries are saved
// under, with the customer each group is linked to, and flags groups whose
// name doesn't match that customer (or any customer) — the sign of entries
// carried over by a rename. Writes nothing.
//
// Run from the project root (asks for your app login):
//   node scripts/listEntryNames.mjs

import { ref, get } from 'firebase/database';
import { login } from './firebaseLogin.mjs';

const db = await login();
const [custSnap, entSnap] = await Promise.all([get(ref(db, 'customers')), get(ref(db, 'waterDistributionEntries'))]);
const customers = custSnap.val() || {};
const entries = Object.values(entSnap.val() || {});
const norm = (s) => String(s || '').trim().toLowerCase();
const known = new Set(Object.values(customers).flatMap((c) => [norm(c.name), norm(c.nameArabic)]).filter(Boolean));

const groups = {};
entries.forEach((e) => {
  const k = `${e.customerName || ''}|${e.customerId || ''}`;
  (groups[k] = groups[k] || []).push(e);
});

console.log('\nCount  Name  →  linked customer  (date range)  [flag]');
Object.entries(groups)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([k, list]) => {
    const [name, id] = k.split('|');
    const c = id ? customers[id] : null;
    let flag = '';
    if (id && !c) flag = 'CUSTOMER MISSING';
    else if (c && norm(c.name) !== norm(name) && norm(c.nameArabic) !== norm(name)) flag = `NAME ≠ CUSTOMER "${c.name}"`;
    else if (!id && !known.has(norm(name))) flag = 'NO SUCH CUSTOMER';
    const dates = list.map((e) => String(e.date || '').slice(0, 10)).sort();
    console.log(`${String(list.length).padStart(5)}  "${name}"  →  ${c ? c.name : id ? id : '(no id)'}  (${dates[0]} → ${dates[dates.length - 1]})  ${flag}`);
  });

process.exit(0);
