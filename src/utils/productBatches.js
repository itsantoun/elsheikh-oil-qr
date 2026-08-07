// utils/productBatches.js
// Shared helpers for price-batch duplication + FIFO consumption.
//
// When a product's price changes, instead of overwriting the existing
// products/{id} record, a new "batch" record is created at the new price and
// linked back to the original ("root") record via `baseProductId`. Every
// batch that shares the same root is treated as one logical product.
import { ref, push, update } from 'firebase/database';

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PRICE_EPSILON = 0.001;
const samePrice = (a, b) => Math.abs(toNumber(a) - toNumber(b)) < PRICE_EPSILON;

const isMaghsalProduct = (product) => {
  const scope = String(product?.scope || '').toLowerCase();
  const type = String(product?.productType || '').toLowerCase();
  return scope.includes('maghsal') || type.includes('maghsal');
};

// The group key that ties a root product and all its price-duplicates
// together. The root itself has no baseProductId, so it is its own key.
export const getBatchGroupKey = (product) => product?.baseProductId || product?.id;

// The physical scan code for an Oil/Filter product. Legacy records (created
// before this feature existed) have no explicit `barcode` field — their
// Firebase key doubled as the barcode, so fall back to `id`.
export const getBatchCode = (product) => product?.barcode || product?.id;

// All batches (root + duplicates) that represent the same logical product as
// `codeOrIdOrProduct`, oldest first. Accepts a scanned barcode string, a
// Firebase id string, or a product object.
export const findSiblingBatches = (productsArray, codeOrIdOrProduct) => {
  if (!Array.isArray(productsArray) || !codeOrIdOrProduct) return [];

  const anchor = typeof codeOrIdOrProduct === 'string'
    ? productsArray.find((p) => p.id === codeOrIdOrProduct || getBatchCode(p) === codeOrIdOrProduct)
    : codeOrIdOrProduct;
  if (!anchor) return [];

  const groupKey = getBatchGroupKey(anchor);
  return productsArray
    .filter((p) => getBatchGroupKey(p) === groupKey)
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
};

// Live remaining quantity for a single batch (not the whole logical product).
// Mirrors the subtraction formula used in remainingProducts.js's Stock
// Checker — including its reconciliation cutoff: once a product has been
// "Marked Accurate" there, products/{id}.quantity is reset to the physically
// counted number, so only movement AFTER that check should be subtracted
// again. Without this, remaining would be double-subtracted for any batch
// that has ever been reconciled. `checkedAtByProductId` should be built from
// the same stockChecks/{id}.reconfirmedAt||checkedAt data remainingProducts.js
// uses, keyed by product id — pass {} to count all-time movement (matches
// remainingProducts.js's own behavior for a never-checked product).
export const computeBatchRemaining = (product, { soldItems = [], maghsalEntries = [], checkedAtByProductId = {} } = {}) => {
  if (!product) return 0;
  const baseline = toNumber(product.quantity);
  const cutoffMs = checkedAtByProductId[product.id] ? new Date(checkedAtByProductId[product.id]).getTime() : null;
  const isAfterCutoff = (dateValue) => {
    if (!cutoffMs) return true;
    const ms = new Date(dateValue || '').getTime();
    return isNaN(ms) ? true : ms > cutoffMs;
  };

  if (isMaghsalProduct(product)) {
    let used = 0;
    maghsalEntries.forEach((entry) => {
      if (!isAfterCutoff(entry.date || entry.createdAt)) return;
      const lines = [
        ...(Array.isArray(entry?.consumablesUsed) ? entry.consumablesUsed : []),
        ...(Array.isArray(entry?.goodsSold) ? entry.goodsSold : []),
      ];
      lines.forEach((line) => {
        if (line.productId === product.id) used += toNumber(line.quantity);
      });
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

// Oldest batch (by createdAt) that still has remaining stock; falls back to
// the newest batch if every sibling is exhausted, so a sale/use can still be
// recorded (matches existing behavior elsewhere that tolerates negative stock).
export const pickFifoBatch = (siblingBatches, movementSource = {}) => {
  if (!Array.isArray(siblingBatches) || siblingBatches.length === 0) return null;
  const sorted = [...siblingBatches].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
  return sorted.find((batch) => computeBatchRemaining(batch, movementSource) > 0) || sorted[sorted.length - 1];
};

// Finds the sibling batch already priced at {itemCost, purchasingPrice}, or
// creates a new one linked to rootId. New batches start at quantity 0 — no
// physical stock has arrived yet, it only gains quantity via a confirmed
// stock-in/restock transaction at that price.
export const resolveOrCreateBatchForPrice = async (
  database,
  productsArray,
  rootId,
  { itemCost, purchasingPrice },
  extraFields = {},
) => {
  const siblings = findSiblingBatches(productsArray, rootId);
  const existing = siblings.find(
    (p) => samePrice(p.itemCost, itemCost) && samePrice(p.purchasingPrice, purchasingPrice),
  );
  if (existing) return { id: existing.id, created: false };

  const root = siblings.find((p) => p.id === rootId) || siblings[0];
  const newId = push(ref(database, 'products')).key;

  await update(ref(database), {
    [`products/${newId}`]: {
      name: root?.name || '',
      productType: root?.productType || '',
      scope: root?.scope || '',
      unit: root?.unit || '',
      ...(root && !isMaghsalProduct(root) ? { barcode: root.barcode || root.id } : {}),
      baseProductId: rootId,
      itemCost: toNumber(itemCost),
      purchasingPrice: toNumber(purchasingPrice),
      quantity: 0,
      createdAt: new Date().toISOString(),
      ...extraFields,
    },
  });

  return { id: newId, created: true };
};

export const isSamePrice = samePrice;
