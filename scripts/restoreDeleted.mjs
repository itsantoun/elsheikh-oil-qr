// Restores records that are in a Firebase backup but were deleted from the
// live database since — Water Distribution, Water Filling, Maghsal and Oil
// sales. Each comes back at its original id with its original data; a record
// that still exists is never touched. Runs as a dry run (lists what it would
// restore) unless --apply is passed.
//
// Some of these may have been deleted on purpose, so check the list first.
// Narrow it with --section and/or --customer, or name exact ids with --ids.
//
// Run from the project root (asks for your app login):
//   node scripts/restoreDeleted.mjs <backup.json>
//   node scripts/restoreDeleted.mjs <backup.json> --section waterDistributionEntries --customer "jad"
//   node scripts/restoreDeleted.mjs <backup.json> --ids -P1KtUlskpBr3xCdi6Gc,-P27LllILP6Qf2M5PXAp --apply

import fs from 'node:fs';
import zlib from 'node:zlib';
import { ref, get, update } from 'firebase/database';
import { login, ask } from './firebaseLogin.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? String(args[i + 1] || '') : '';
};
const backupPath = args[0];
const apply = args.includes('--apply');
const section = opt('--section');
const customerTerm = opt('--customer').trim().toLowerCase();
const onlyIds = new Set(opt('--ids').split(',').map((s) => s.trim()).filter(Boolean));
if (!backupPath || backupPath.startsWith('--')) {
  console.error('Usage: node scripts/restoreDeleted.mjs <backup.json[.gz]> [--section <name>] [--customer "<name>"] [--ids a,b] [--apply]');
  process.exit(1);
}

const raw = fs.readFileSync(backupPath);
const backup = JSON.parse((backupPath.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'));
const COLLECTIONS = ['waterDistributionEntries', 'waterFillingEntries', 'maghsalEntries', 'SoldItems']
  .filter((c) => !section || c === section);

const db = await login();
const live = await Promise.all(COLLECTIONS.map(async (c) => (await get(ref(db, c))).val() || {}));
const trash = (await get(ref(db, 'trash')).catch(() => null))?.val() || {};
const custName = (r) => backup.customers?.[r.customerId]?.name || r.customerName || '';
const day = (r) => String(r.date || r.dateScanned || '').slice(0, 10);

const updates = {};
let count = 0;
COLLECTIONS.forEach((col, i) => {
  const missing = Object.entries(backup[col] || {})
    .filter(([id, r]) => r && typeof r === 'object' && !(id in live[i]))
    .filter(([id]) => onlyIds.size === 0 || onlyIds.has(id))
    .filter(([, r]) => !customerTerm || custName(r).toLowerCase().includes(customerTerm)
      || String(r.customerName || '').toLowerCase().includes(customerTerm))
    .sort(([, a], [, b]) => day(a).localeCompare(day(b)));
  if (missing.length === 0) return;
  console.log(`\n== ${col}: ${missing.length} deleted since the backup`);
  missing.forEach(([id, r]) => {
    const inTrash = trash[col]?.[id] ? '  (in Trash — restore it there instead)' : '';
    console.log(`  ${id}  ${day(r)}  "${custName(r)}"  qty=${r.quantity ?? ''}  ${r.totalPrice ?? r.totalPremium ?? r.totalCost ?? ''}  ${r.paymentStatus || ''}  ${r.remark ? `"${r.remark}"` : ''}${inTrash}`);
    if (inTrash) return;
    updates[`${col}/${id}`] = r;
    count++;
  });
});

console.log(`\nTo restore: ${count}`);
if (count === 0) process.exit(0);
if (!apply) {
  console.log('\nDry run — nothing written. Re-run with --apply (and any filters) to restore these.');
  process.exit(0);
}
if ((await ask(`\nRestore these ${count} records? Type "yes": `)).toLowerCase() !== 'yes') {
  console.log('Cancelled — nothing written.');
  process.exit(0);
}
await update(ref(db), updates);
console.log(`Restored ${count} records.`);
process.exit(0);
