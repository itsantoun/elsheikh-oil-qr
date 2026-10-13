// Restores one client's Water Distribution entries from a Firebase backup.
//
// Only entries that are missing from the live database are written back,
// each at its original id and with its original data — an entry that still
// exists is never overwritten, and nothing outside those missing entries is
// touched. Runs as a dry run (shows what it would restore) unless --apply
// is passed.
//
// The backup can be a full-database backup (.json or .json.gz, from Firebase
// console > Realtime Database > Backups, or an Export JSON of the root) or an
// Export JSON of just the waterDistributionEntries node.
//
// Run from the project root (asks for your app login):
//   node scripts/restoreClientEntries.mjs ~/Downloads/backup.json.gz "rock hill"
//   node scripts/restoreClientEntries.mjs ~/Downloads/backup.json.gz "rock hill" --apply

import fs from 'node:fs';
import zlib from 'node:zlib';
import { ref, get, update } from 'firebase/database';
import { login, ask } from './firebaseLogin.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const [backupPath, rawTerm] = args.filter((a) => a !== '--apply');
const term = String(rawTerm || '').trim().toLowerCase();
if (!backupPath || !term) {
  console.error('Usage: node scripts/restoreClientEntries.mjs <backup.json[.gz]> "<client name>" [--apply]');
  process.exit(1);
}

const raw = fs.readFileSync(backupPath);
const backup = JSON.parse((backupPath.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'));
// A full backup has the node at the top level; a node export is the entries map itself.
const backupEntries = backup.waterDistributionEntries || (backup.customers ? {} : backup);
const backupCustomers = backup.customers || {};
const has = (s) => String(s || '').toLowerCase().includes(term);

const db = await login();
const [custSnap, entSnap] = await Promise.all([get(ref(db, 'customers')), get(ref(db, 'waterDistributionEntries'))]);
const liveCustomers = custSnap.val() || {};
const liveEntries = entSnap.val() || {};

// The client's id(s), from the live customers and from the backup.
const clientIds = new Set([liveCustomers, backupCustomers].flatMap((cs) => Object.keys(cs)
  .filter((id) => has(cs[id].name) || has(cs[id].nameArabic))));

const toRestore = Object.entries(backupEntries)
  .filter(([, e]) => e && typeof e === 'object')
  .filter(([, e]) => clientIds.has(e.customerId) || has(e.customerName) || has(e.customerNameArabic))
  .filter(([id]) => !(id in liveEntries));
const stillThere = Object.entries(backupEntries)
  .filter(([id, e]) => e && (clientIds.has(e.customerId) || has(e.customerName)) && id in liveEntries).length;

console.log(`\nClient ids matching "${term}": ${[...clientIds].join(', ') || '(none)'}`);
console.log(`Backup has ${Object.keys(backupEntries).length} Water Distribution entries.`);
console.log(`Of this client's entries in the backup, ${stillThere} still exist live (left alone).`);
console.log(`Missing from live, to restore: ${toRestore.length}\n`);
toRestore
  .sort(([, a], [, b]) => String(a.date).localeCompare(String(b.date)))
  .forEach(([id, e]) => console.log(`  ${id}  ${String(e.date || '').slice(0, 10)}  "${e.customerName}"  qty=${e.quantity}  ${e.totalPrice} ${e.priceCurrency || ''}  ${e.paymentStatus || ''}`));

if (toRestore.length === 0) process.exit(0);
if (!apply) {
  console.log('\nDry run — nothing written. Re-run with --apply to restore these entries.');
  process.exit(0);
}
if ((await ask(`\nRestore these ${toRestore.length} entries? Type "yes": `)).toLowerCase() !== 'yes') {
  console.log('Cancelled — nothing written.');
  process.exit(0);
}

// One atomic multi-path update — only the missing entry paths are written.
const updates = {};
toRestore.forEach(([id, e]) => { updates[`waterDistributionEntries/${id}`] = e; });
await update(ref(db), updates);

const check = (await get(ref(db, 'waterDistributionEntries'))).val() || {};
const missing = toRestore.filter(([id]) => !(id in check)).length;
console.log(missing === 0
  ? `Restored ${toRestore.length} entries.`
  : `Restored ${toRestore.length - missing} of ${toRestore.length} — ${missing} did not write.`);
process.exit(0);
