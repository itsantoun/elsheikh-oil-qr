// Read-only: compares a Firebase backup with the live database and lists,
// per collection, the records that were deleted since the backup and the
// ones whose customer changed. Writes nothing.
//
// Run from the project root (asks for your app login):
//   node scripts/compareBackup.mjs ~/Desktop/elsheikh-qr-codes-db-default-rtdb_data.json

import fs from 'node:fs';
import zlib from 'node:zlib';
import { ref, get } from 'firebase/database';
import { login } from './firebaseLogin.mjs';

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: node scripts/compareBackup.mjs <backup.json[.gz]>');
  process.exit(1);
}
const raw = fs.readFileSync(backupPath);
const backup = JSON.parse((backupPath.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'));

const COLLECTIONS = ['waterDistributionEntries', 'waterFillingEntries', 'maghsalEntries', 'SoldItems'];
const db = await login();
const [liveCustomers, ...live] = await Promise.all(['customers', ...COLLECTIONS]
  .map(async (c) => (await get(ref(db, c))).val() || {}));
const custName = (id) => liveCustomers[id]?.name || backup.customers?.[id]?.name || '?';
const day = (r) => String(r.date || r.dateScanned || '').slice(0, 10);

COLLECTIONS.forEach((col, i) => {
  const before = backup[col] || {};
  const now = live[i];
  const deleted = Object.entries(before).filter(([id]) => !(id in now));
  // Same customer = same id; a record saved without an id is compared by name.
  const moved = Object.entries(before).filter(([id, r]) => id in now && (r.customerId
    ? (now[id].customerId || '') !== r.customerId
    : now[id].customerName !== r.customerName));

  console.log(`\n== ${col}: backup ${Object.keys(before).length}, live ${Object.keys(now).length}`);
  console.log(`  Deleted since backup: ${deleted.length}`);
  deleted.sort(([, a], [, b]) => day(a).localeCompare(day(b))).forEach(([id, r]) => {
    console.log(`    ${id}  ${day(r)}  "${r.customerName || ''}"  qty=${r.quantity ?? ''}  ${r.totalPrice ?? r.totalPremium ?? ''}  ${r.paymentStatus || ''}`);
  });
  console.log(`  Customer changed: ${moved.length}`);
  moved.forEach(([id, r]) => {
    console.log(`    ${id}  ${day(r)}  "${r.customerName || ''}" → "${now[id].customerName || ''}"  (${custName(r.customerId)} → ${custName(now[id].customerId)})`);
  });
  const renamed = Object.entries(before).filter(([id, r]) => id in now && !moved.some(([m]) => m === id)
    && now[id].customerName !== r.customerName);
  console.log(`  Same customer, name changed (rename): ${renamed.length}`);
  renamed.forEach(([id, r]) => {
    console.log(`    ${id}  ${day(r)}  "${r.customerName || ''}" → "${now[id].customerName || ''}"`);
  });
});

console.log('\n== Customers renamed or deleted since backup');
Object.entries(backup.customers || {}).forEach(([id, c]) => {
  const n = liveCustomers[id];
  if (!n) console.log(`  DELETED  ${id}  "${c.name}"`);
  else if (n.name !== c.name) console.log(`  RENAMED  ${id}  "${c.name}" → "${n.name}"`);
});

process.exit(0);
