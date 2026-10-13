// Links a record (sale / Maghsal / Water Filling / Water Distribution entry)
// to its customer. The customerId saved on the record is what counts — a
// rename never changes it — and the name shown is always the customer's
// current one. Only older records saved without an id fall back to their
// saved name, and only when exactly one customer has that name.

const norm = (s) => String(s || '').trim().toLowerCase();

// `customers`: a list of { id, name, nameArabic, … }, or the raw
// `customers` node ({ id: data }).
export const buildCustomerIndex = (customers) => {
  const list = Array.isArray(customers)
    ? customers
    : Object.keys(customers || {}).map((id) => ({ id, ...customers[id] }));
  const byId = new Map();
  const byName = new Map();
  const shared = new Set();
  list.forEach((c) => {
    byId.set(c.id, c);
    new Set([norm(c.name), norm(c.nameArabic)].filter(Boolean)).forEach((n) => {
      if (byName.has(n) && byName.get(n).id !== c.id) shared.add(n);
      else byName.set(n, c);
    });
  });
  shared.forEach((n) => byName.delete(n));
  return { byId, byName };
};

// The record's customer, or null (deleted customer / no unique match).
export const recordCustomer = (rec, index) => {
  if (!rec) return null;
  if (rec.customerId) return index.byId.get(rec.customerId) || null;
  return index.byName.get(norm(rec.customerName))
    || index.byName.get(norm(rec.customerNameArabic))
    || null;
};

export const recordCustomerId = (rec, index) => recordCustomer(rec, index)?.id || '';

// The customer's current name, falling back to the name saved on the record.
export const recordCustomerName = (rec, index) => {
  const c = recordCustomer(rec, index);
  return (c && (c.name || c.nameArabic)) || String(rec?.customerName || '').trim();
};
