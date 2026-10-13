// Shows payment-status changes since a backup — Oil sales and Maghsal by
// default — grouped by the Date Paid they were given (a bulk "Mark as Paid"
// gives every selected record the same date), and can put them back.
//
// --revert sets every changed record back to its status, Date Paid and
// remark from the backup. Narrow it with --section, --paid-on (the Date
// Paid day of the bulk action to undo) and --since (only records dated on or
// after that day). Runs as a dry run unless --apply is
// also passed. Records created after the backup aren't in it, so they're only
// listed, never changed.
//
// Run from the project root (asks for your app login):
//   node scripts/paymentStatusChanges.mjs <backup.json>
//   node scripts/paymentStatusChanges.mjs <backup.json> --revert --section SoldItems --paid-on 2026-10-08
//   node scripts/paymentStatusChanges.mjs <backup.json> --revert --section SoldItems --paid-on 2026-10-08 --apply
//   node scripts/paymentStatusChanges.mjs <backup.json> --revert --section maghsalEntries --since 2026-08-01

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
const revert = args.includes('--revert');
const apply = args.includes('--apply');
const section = opt('--section');
const paidOn = opt('--paid-on');
const since = opt('--since');
if (!backupPath || backupPath.startsWith('--')) {
  console.error('Usage: node scripts/paymentStatusChanges.mjs <backup.json[.gz]> [--revert [--section <name>] [--paid-on YYYY-MM-DD] [--apply]]');
  process.exit(1);
}

const raw = fs.readFileSync(backupPath);
const backup = JSON.parse((backupPath.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'));
const COLLECTIONS = ['SoldItems', 'maghsalEntries', 'waterFillingEntries', 'waterDistributionEntries']
  .filter((c) => (section ? c === section : ['SoldItems', 'maghsalEntries'].includes(c)));

const db = await login();
const live = await Promise.all(COLLECTIONS.map(async (c) => (await get(ref(db, c))).val() || {}));
const day = (v) => String(v || '').slice(0, 10) || '(none)';
const recDay = (r) => day(r.date || r.dateScanned);
const label = (r) => `${recDay(r)}  "${r.customerName || ''}"  ${r.name || r.serviceCategory || r.category || ''}`;

const updates = {};
let toRevert = 0;
COLLECTIONS.forEach((col, i) => {
  const before = backup[col] || {};
  const now = live[i];
  console.log(`\n==== ${col}`);
  const count = (o) => {
    const c = {};
    Object.values(o).forEach((r) => { c[r?.paymentStatus || '(none)'] = (c[r?.paymentStatus || '(none)'] || 0) + 1; });
    return JSON.stringify(c);
  };
  console.log(`  Backup statuses: ${count(before)}`);
  console.log(`  Live statuses:   ${count(now)}`);

  // Changed since the backup, grouped by change + Date Paid day.
  const groups = {};
  Object.entries(before).forEach(([id, b]) => {
    const n = now[id];
    if (!n || (n.paymentStatus || '') === (b.paymentStatus || '')) return;
    const key = `${b.paymentStatus || '(none)'} → ${n.paymentStatus || '(none)'}, Date Paid ${day(n.datePaid)}`;
    (groups[key] = groups[key] || []).push([id, b, n]);
  });
  console.log('\n  Changed since the backup:');
  if (Object.keys(groups).length === 0) console.log('    (none)');
  Object.entries(groups).sort(([, a], [, b]) => b.length - a.length).forEach(([key, list]) => {
    console.log(`    ${list.length}x  ${key}`);
    list.slice(0, 8).forEach(([, , n]) => console.log(`        ${label(n)}`));
    if (list.length > 8) console.log(`        … and ${list.length - 8} more`);
    list.forEach(([id, b, n]) => {
      if (!revert || (paidOn && day(n.datePaid) !== paidOn) || (since && recDay(b) < since)) return;
      console.log(`        REVERT  ${label(n)}  → ${b.paymentStatus || '(none)'}`);
      const path = `${col}/${id}`;
      updates[`${path}/paymentStatus`] = b.paymentStatus ?? null;
      updates[`${path}/datePaid`] = b.datePaid ?? null;
      if ((n.remark || '') !== (b.remark || '')) updates[`${path}/remark`] = b.remark ?? '';
      toRevert++;
    });
  });

  // Created after the backup — can't be compared, so show Paid ones by Date Paid.
  const newer = Object.values(now).filter((r, k) => r && !(Object.keys(now)[k] in before));
  const paidNew = {};
  newer.filter((r) => r.paymentStatus === 'Paid').forEach((r) => { paidNew[day(r.datePaid)] = (paidNew[day(r.datePaid)] || 0) + 1; });
  console.log(`\n  Created after the backup: ${newer.length} (${count(Object.fromEntries(newer.map((r, k) => [k, r])))})`);
  console.log(`  Of those, Paid by Date Paid: ${JSON.stringify(paidNew)}`);
});

if (!revert) process.exit(0);
console.log(`\nRecords to set back to their backup status: ${toRevert}`);
if (toRevert === 0) process.exit(0);
if (!apply) {
  console.log('Dry run — nothing written. Add --apply to make these changes.');
  process.exit(0);
}
if ((await ask(`\nSet ${toRevert} records back? Type "yes": `)).toLowerCase() !== 'yes') {
  console.log('Cancelled — nothing written.');
  process.exit(0);
}
await update(ref(db), updates);
console.log(`Set ${toRevert} records back.`);
process.exit(0);
