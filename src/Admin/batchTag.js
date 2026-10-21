import React from 'react';

// Marks a price batch (a product created when stock came in at a new price)
// so it can be told apart from the original, which shares its barcode.
const BatchTag = ({ product }) => {
  if (!product?.baseProductId) return null;
  const created = new Date(product.createdAt || '');
  const date = isNaN(created.getTime())
    ? ''
    : created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <span
      title="Same product as the original, added at a different price"
      style={{ fontSize: 11, marginLeft: 6, padding: '1px 6px', borderRadius: 999, background: 'var(--surface-2, #e9f0fa)', color: 'var(--brand)', whiteSpace: 'nowrap' }}
    >
      new price{date ? ` · added ${date}` : ''}
    </span>
  );
};

export default BatchTag;
