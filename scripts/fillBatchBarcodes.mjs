// One-time repair: gives price batches the same barcode as their original
// product.
//
// A price batch (a product with baseProductId) created before batches copied
// the root's barcode — Maghsal ones in particular — has no `barcode` field,
// so the app shows its random Firebase id as the barcode. This copies the
// root's barcode (or the root's id, for legacy roots whose id is the
// barcode) onto every such batch.
//
// Only products/{id}/barcode is written — quantities, prices, ids and every
// other collection are left alone. Before writing, it recomputes each
// batch's remaining stock with and without the new barcode (same formula as
// src/utils/productBatches.js computeBatchRemaining) and skips any batch
// whose number would change. Those, and batches whose root no longer
// exists, are listed and left alone. Runs as a dry run unless --apply is passed.
//
// Run from the project root (asks for your app login):
//   node scripts/fillBatchBarcodes.mjs
//   node scripts/fillBatchBarcodes.mjs --apply

import { ref, get, update } from 'firebase/database';
import { login, ask } from './firebaseLogin.mjs';

const apply = process.argv.includes('--apply');
const toNumber = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// Same as src/utils/productBatches.js.
const isMaghsalProduct = (p) => {
  const scope = String(p?.scope || '').toLowerCase();
  const type = String(p?.productType || '').toLowerCase();
  return scope.includes('maghsal') || type.includes('maghsal');
};
const getBatchCode = (p) => p?.barcode || p?.id;

const computeBatchRemaining = (product, { soldItems, maghsalEntries, checkedAtByProductId }) => {
  const baseline = toNumber(product.quantity);
  const cutoff = checkedAtByProductId[product.id];
  const cutoffMs = cutoff ? new Date(cutoff).getTime() : null;
  const isAfterCutoff = (d) => {
    if (!cutoffMs) return true;
    const ms = new Date(d || '').getTime();
    return isNaN(ms) ? true : ms > cutoffMs;
  };

  if (isMaghsalProduct(product)) {
    let used = 0;
    maghsalEntries.forEach((entry) => {
      if (!isAfterCutoff(entry.date || entry.createdAt)) return;
      [
        ...(Array.isArray(entry?.consumablesUsed) ? entry.consumablesUsed : []),
        ...(Array.isArray(entry?.goodsSold) ? entry.goodsSold : []),
      ].forEach((line) => { if (line.productId === product.id) used += toNumber(line.quantity); });
    });
    return baseline - used;
  }

  let sold = 0;
  const code = getBatchCode(product);
  soldItems.forEach((item) => {
    if (String(item.paymentStatus || '').toLowerCase().startsWith('stock')) return;
    if (!isAfterCutoff(item.dateScanned)) return;
    const matches = item.productId
      ? item.productId === product.id
      : (item.barcode === code || item.barcode === product.id);
    if (matches) sold += toNumber(item.quantity);
  });
  return baseline - sold;
};

const db = await login();
const [products, soldData, maghsalData, stockChecks] = await Promise.all(
  ['products', 'SoldItems', 'maghsalEntries', 'stockChecks']
    .map(async (c) => (await get(ref(db, c))).val() || {}),
);

const movement = {
  soldItems: Object.values(soldData).filter((x) => x && typeof x === 'object'),
  maghsalEntries: Object.values(maghsalData).filter((x) => x && typeof x === 'object'),
  checkedAtByProductId: Object.fromEntries(Object.entries(stockChecks)
    .map(([id, c]) => [id, c?.reconfirmedAt || c?.checkedAt])
    .filter(([, d]) => d)),
};

const updates = {};
const skipped = [];
const stockChanged = [];
Object.entries(products).forEach(([id, p]) => {
  if (!p || typeof p !== 'object' || !p.baseProductId || p.barcode) return;
  const root = products[p.baseProductId];
  if (!root) {
    skipped.push(`  SKIP    ${id}  "${p.name}" — original product ${p.baseProductId} no longer exists`);
    return;
  }
  const barcode = root.barcode || p.baseProductId;
  const before = computeBatchRemaining({ id, ...p }, movement);
  const after = computeBatchRemaining({ id, ...p, barcode }, movement);
  if (before !== after) {
    stockChanged.push(`  SKIP    ${id}  "${p.name}" — remaining stock would change ${before} → ${after}`);
    return;
  }
  updates[`products/${id}/barcode`] = barcode;
  console.log(`  SET     ${id}  "${p.name}"${isMaghsalProduct(p) ? ' [Maghsal]' : ''}  shown as ${id} → ${barcode}  · remaining ${before} → ${after}`);
});

console.log(`\nBatches to give a barcode: ${Object.keys(updates).length}`);
console.log('\nSkipped (fix by hand if needed):');
console.log([...skipped, ...stockChanged].join('\n') || '  (none)');
console.log('\nRemaining stock check: every batch listed above as SET keeps the same remaining stock.');

if (Object.keys(updates).length === 0) process.exit(0);
if (!apply) {
  console.log('\nDry run — nothing written. Re-run with --apply to make these changes.');
  process.exit(0);
}
if ((await ask(`\nWrite ${Object.keys(updates).length} barcodes? Type "yes": `)).toLowerCase() !== 'yes') {
  console.log('Cancelled — nothing written.');
  process.exit(0);
}
await update(ref(db), updates);
console.log('Done.');
process.exit(0);
