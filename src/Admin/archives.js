import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../Auth/firebase';
import '../CSS/admin.css';

const Archives = () => {
  const [archives, setArchives] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 3500);
  };

  const formatDateTime = (iso) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return 'N/A';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours() % 12 || 12).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
      return `${dd}-${mm}-${yyyy} ${hh}:${min} ${ampm}`;
    } catch (error) {
      return 'N/A';
    }
  };

  const objCount = (obj) => (obj && typeof obj === 'object' ? Object.keys(obj).length : 0);

  const historyEntriesCount = (historyObj) => {
    if (!historyObj || typeof historyObj !== 'object') return 0;
    return Object.values(historyObj).reduce((sum, monthData) => sum + objCount(monthData), 0);
  };

  const fetchArchives = useCallback(async () => {
    setIsLoading(true);
    try {
      const formatArchiveRow = (key, value, type) => {
        const summary = value?.summary || {};
        const productsArchived = summary.productsArchived ?? objCount(value?.products);
        const soldItemsArchived = type === 'stock'
          ? (summary.soldItemsArchived ?? objCount(value?.soldItems))
          : null;
        const totalQuantityBeforeReset = type === 'product'
          ? (summary.totalQuantityBeforeReset ?? Object.values(value?.products || {}).reduce((sum, p) => sum + (parseFloat(p?.quantity) || 0), 0))
          : null;

        return {
          id: `${type}:${key}`,
          key,
          type,
          archivedAt: value?.archivedAt || key,
          productsArchived,
          soldItemsArchived,
          totalQuantityBeforeReset,
        };
      };

      const [stockSnap, productSnap] = await Promise.all([
        get(ref(database, 'stockArchives')),
        get(ref(database, 'productArchives')),
      ]);

      const stockArchives = stockSnap.exists()
        ? Object.entries(stockSnap.val()).map(([key, value]) => formatArchiveRow(key, value, 'stock'))
        : [];
      const productArchives = productSnap.exists()
        ? Object.entries(productSnap.val()).map(([key, value]) => formatArchiveRow(key, value, 'product'))
        : [];

      const combined = [...stockArchives, ...productArchives]
        .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

      setArchives(combined);
      setSelectedArchiveId((prev) => (
        prev && combined.some((archive) => archive.id === prev) ? prev : (combined[0]?.id || '')
      ));
      if (combined.length === 0) setSelectedArchive(null);
    } catch (error) {
      console.error('Failed to fetch archives:', error);
      showError('Failed to load archives. Check permissions for stockArchives and productArchives.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchArchiveDetails = useCallback(async (archiveId) => {
    if (!archiveId) { setSelectedArchive(null); return; }

    const [type, key] = archiveId.split(':');
    if (!type || !key) { setSelectedArchive(null); return; }

    setDetailLoading(true);
    try {
      const node = type === 'stock' ? 'stockArchives' : 'productArchives';
      const snap = await get(ref(database, `${node}/${key}`));
      if (snap.exists()) {
        setSelectedArchive({ type, key, ...snap.val() });
      } else {
        setSelectedArchive(null);
      }
    } catch (error) {
      console.error('Failed to load archive details:', error);
      showError('Failed to load archive details.');
      setSelectedArchive(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const filteredArchives = useMemo(() => {
    if (activeFilter === 'all') return archives;
    return archives.filter((archive) => archive.type === activeFilter);
  }, [archives, activeFilter]);

  useEffect(() => {
    if (!filteredArchives.length) {
      setSelectedArchiveId('');
      setSelectedArchive(null);
      return;
    }
    if (!filteredArchives.some((archive) => archive.id === selectedArchiveId)) {
      setSelectedArchiveId(filteredArchives[0].id);
    }
  }, [filteredArchives, selectedArchiveId]);

  useEffect(() => {
    fetchArchiveDetails(selectedArchiveId);
  }, [selectedArchiveId, fetchArchiveDetails]);

  const stockCount = archives.filter((archive) => archive.type === 'stock').length;
  const productCount = archives.filter((archive) => archive.type === 'product').length;

  const renderDetails = () => {
    if (detailLoading) {
      return <div style={{ padding: 28, textAlign: 'center', color: '#888' }}>🔄 Loading details...</div>;
    }
    if (!selectedArchive) {
      return (
        <div className="empty-table">
          <div className="empty-icon">📂</div>
          <p>Select an archive to view details.</p>
        </div>
      );
    }

    const products = Object.entries(selectedArchive.products || {})
      .map(([id, value]) => ({ id, ...value }))
      .slice(0, 10);

    if (selectedArchive.type === 'stock') {
      const summary = selectedArchive.summary || {};
      const soldItemsCount = summary.soldItemsArchived ?? objCount(selectedArchive.soldItems);
      const checksCount = objCount(selectedArchive.stockChecks);
      const pendingChecks = Object.values(selectedArchive.stockChecks || {})
        .filter((check) => check?.status === 'pending').length;
      const historyMonths = summary.historyMonthsArchived ?? objCount(selectedArchive.stockCheckHistory);
      const historyEntries = historyEntriesCount(selectedArchive.stockCheckHistory);

      return (
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Stock Archive Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: '#666' }}>Archived At</div>
              <div style={{ fontWeight: 700 }}>{formatDateTime(selectedArchive.archivedAt)}</div>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: '#666' }}>Products</div>
              <div style={{ fontWeight: 700 }}>{summary.productsArchived ?? objCount(selectedArchive.products)}</div>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: '#666' }}>Sold Items</div>
              <div style={{ fontWeight: 700 }}>{soldItemsCount}</div>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: '#666' }}>Checks</div>
              <div style={{ fontWeight: 700 }}>{checksCount} total / {pendingChecks} pending</div>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: '#666' }}>History Months</div>
              <div style={{ fontWeight: 700 }}>{historyMonths}</div>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, color: '#666' }}>History Entries</div>
              <div style={{ fontWeight: 700 }}>{historyEntries}</div>
            </div>
          </div>

          {products.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px' }}>Sample Products</h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Name</th>
                      <th className="text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td><span className="barcode-cell">{product.id}</span></td>
                        <td><span className="product-name-cell">{product.name || 'Unnamed'}</span></td>
                        <td className="text-right"><span className="quantity-cell">{product.quantity ?? 0}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    const summary = selectedArchive.summary || {};
    const productsCount = summary.productsArchived ?? objCount(selectedArchive.products);
    const qtyBeforeReset = summary.totalQuantityBeforeReset
      ?? products.reduce((sum, product) => sum + (parseFloat(product.quantity) || 0), 0);

    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Product Archive Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: '#666' }}>Archived At</div>
            <div style={{ fontWeight: 700 }}>{formatDateTime(selectedArchive.archivedAt)}</div>
          </div>
          <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: '#666' }}>Products</div>
            <div style={{ fontWeight: 700 }}>{productsCount}</div>
          </div>
          <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: '#666' }}>Total Qty Before Reset</div>
            <div style={{ fontWeight: 700 }}>{qtyBeforeReset}</div>
          </div>
        </div>

        {products.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Sample Products</h4>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th className="text-right">Qty Before Reset</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td><span className="barcode-cell">{product.id}</span></td>
                      <td><span className="product-name-cell">{product.name || 'Unnamed'}</span></td>
                      <td><span className="type-cell">{product.productType || 'General'}</span></td>
                      <td className="text-right"><span className="quantity-cell">{product.quantity ?? 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-container">
      <div className="page-header">
        <h1 className="page-title">Archives Center</h1>
        <p className="page-subtitle">View all archived stock and product snapshots in one place</p>
      </div>

      {errorMessage && (
        <div className="error-message">
          <span className="message-icon">⚠️</span>
          {errorMessage}
        </div>
      )}

      <div className="header-section">
        <div className="header-left">
          <h2 className="section-title">All Archives</h2>
          <div className="stats-badge">{archives.length} Total</div>
          <div className="stats-badge" style={{ marginLeft: 8, backgroundColor: '#e7f1ff', color: '#0a58ca' }}>
            {stockCount} Stock
          </div>
          <div className="stats-badge" style={{ marginLeft: 8, backgroundColor: '#fff3cd', color: '#856404' }}>
            {productCount} Product
          </div>
        </div>
        <div className="header-right">
          <button onClick={fetchArchives} className={`btn-secondary ${isLoading ? 'refreshing' : ''}`} disabled={isLoading}>
            {isLoading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      <div className="tab-navigation" style={{ marginBottom: 12 }}>
        <button onClick={() => setActiveFilter('all')} className={`tab-button ${activeFilter === 'all' ? 'active' : ''}`}>
          <span className="tab-icon">🧾</span><span className="tab-label">All</span>
        </button>
        <button onClick={() => setActiveFilter('stock')} className={`tab-button ${activeFilter === 'stock' ? 'active' : ''}`}>
          <span className="tab-icon">📦</span><span className="tab-label">Stock</span>
        </button>
        <button onClick={() => setActiveFilter('product')} className={`tab-button ${activeFilter === 'product' ? 'active' : ''}`}>
          <span className="tab-icon">🛒</span><span className="tab-label">Products</span>
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <div className="table-section" style={{ marginTop: 0 }}>
          <div className="table-card">
            <div className="table-container">
              {isLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>🔄 Loading archives...</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Archived At</th>
                      <th className="text-right">Products</th>
                      <th className="text-right">Sold Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchives.map((archive) => (
                      <tr
                        key={archive.id}
                        onClick={() => setSelectedArchiveId(archive.id)}
                        style={{ cursor: 'pointer', backgroundColor: selectedArchiveId === archive.id ? '#e7f1ff' : undefined }}
                      >
                        <td>
                          <span
                            style={{
                              backgroundColor: archive.type === 'stock' ? '#e7f1ff' : '#fff3cd',
                              color: archive.type === 'stock' ? '#0a58ca' : '#856404',
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {archive.type === 'stock' ? 'Stock' : 'Product'}
                          </span>
                        </td>
                        <td><span className="date-cell">{formatDateTime(archive.archivedAt)}</span></td>
                        <td className="text-right"><span className="quantity-cell">{archive.productsArchived ?? 0}</span></td>
                        <td className="text-right"><span className="quantity-cell">{archive.soldItemsArchived ?? '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!isLoading && filteredArchives.length === 0 && (
              <div className="empty-table">
                <div className="empty-icon">🗄️</div>
                <p>No archives found for this filter.</p>
              </div>
            )}
          </div>
        </div>

        <div className="table-section" style={{ marginTop: 0 }}>
          <div className="table-card">
            {renderDetails()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Archives;
