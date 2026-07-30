import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../Auth/firebase';
import '../CSS/admin.css';
import { useExpiryNotifications } from '../utils/useExpiryNotifications';
import { IconRefresh } from '../utils/icons';
import PageHeader from '../Components/PageHeader';

const Archives = () => {
  const [archives, setArchives] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailView, setDetailView] = useState('products');
  const [detailSearchTerm, setDetailSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  useExpiryNotifications({ errorMessage });

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

  const matchesSearch = (values, searchText) => {
    if (!searchText) return true;
    return values.some((value) => String(value ?? '').toLowerCase().includes(searchText));
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

  useEffect(() => {
    setDetailView('products');
    setDetailSearchTerm('');
  }, [selectedArchiveId]);

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

    const summary = selectedArchive.summary || {};
    const isStockArchive = selectedArchive.type === 'stock';
    const searchText = detailSearchTerm.trim().toLowerCase();

    const products = Object.entries(selectedArchive.products || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const soldItems = isStockArchive
      ? Object.entries(selectedArchive.soldItems || {})
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => new Date(b.dateScanned || 0) - new Date(a.dateScanned || 0))
      : [];

    const stockChecks = isStockArchive
      ? Object.entries(selectedArchive.stockChecks || {})
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => new Date(b.reconfirmedAt || b.checkedAt || 0) - new Date(a.reconfirmedAt || a.checkedAt || 0))
      : [];

    const historyEntries = isStockArchive
      ? Object.entries(selectedArchive.stockCheckHistory || {})
        .flatMap(([month, monthData]) =>
          Object.entries(monthData || {}).map(([entryId, entry]) => ({
            id: `${month}:${entryId}`,
            month,
            ...entry,
          }))
        )
        .sort((a, b) => new Date(b.checkedAt || 0) - new Date(a.checkedAt || 0))
      : [];

    const filteredProducts = products.filter((product) => (
      matchesSearch(
        [product.id, product.name, product.productType, product.quantity, product.purchasePrice, product.salePrice],
        searchText
      )
    ));

    const filteredSoldItems = soldItems.filter((item) => (
      matchesSearch(
        [item.id, item.barcode, item.productId, item.name, item.productName, item.customerName, item.customer, item.quantity, item.dateScanned],
        searchText
      )
    ));

    const filteredChecks = stockChecks.filter((check) => (
      matchesSearch(
        [check.id, check.productName, check.status, check.systemQuantity, check.countedQuantity, check.checkedAt, check.reconfirmedAt],
        searchText
      )
    ));

    const filteredHistoryEntries = historyEntries.filter((entry) => (
      matchesSearch(
        [entry.id, entry.month, entry.productId, entry.productName, entry.status, entry.systemQuantity, entry.countedQuantity, entry.checkedAt],
        searchText
      )
    ));

    const viewOptions = isStockArchive
      ? [
        { key: 'products', label: `Products (${products.length})` },
        { key: 'soldItems', label: `Sold Items (${soldItems.length})` },
        { key: 'stockChecks', label: `Checks (${stockChecks.length})` },
        { key: 'history', label: `History (${historyEntries.length})` },
      ]
      : [{ key: 'products', label: `Products (${products.length})` }];

    const activeView = viewOptions.some((option) => option.key === detailView) ? detailView : 'products';
    const activeViewLabel = activeView === 'products'
      ? 'products'
      : activeView === 'soldItems'
        ? 'sold items'
        : activeView === 'stockChecks'
          ? 'stock checks'
          : 'history entries';

    const totalRows = activeView === 'products'
      ? products.length
      : activeView === 'soldItems'
        ? soldItems.length
        : activeView === 'stockChecks'
          ? stockChecks.length
          : historyEntries.length;

    const visibleRows = activeView === 'products'
      ? filteredProducts.length
      : activeView === 'soldItems'
        ? filteredSoldItems.length
        : activeView === 'stockChecks'
          ? filteredChecks.length
          : filteredHistoryEntries.length;

    const renderActiveTable = () => {
      if (activeView === 'products') {
        if (filteredProducts.length === 0) {
          return (
            <div className="empty-table" style={{ padding: 26 }}>
              <div className="empty-icon">🔎</div>
              <p>No archived products match this search.</p>
            </div>
          );
        }

        const qtyLabel = isStockArchive ? 'Qty' : 'Qty Before Reset';
        return (
          <div className="table-container archive-table-container">
            <table className="data-table archive-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th className="text-right">{qtyLabel}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
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
        );
      }

      if (activeView === 'soldItems') {
        if (filteredSoldItems.length === 0) {
          return (
            <div className="empty-table" style={{ padding: 26 }}>
              <div className="empty-icon">🔎</div>
              <p>No archived sold items match this search.</p>
            </div>
          );
        }

        return (
          <div className="table-container archive-table-container">
            <table className="data-table archive-table">
              <thead>
                <tr>
                  <th>Sold At</th>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Customer</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredSoldItems.map((item) => (
                  <tr key={item.id}>
                    <td><span className="date-cell">{formatDateTime(item.dateScanned)}</span></td>
                    <td><span className="barcode-cell">{item.barcode || item.productId || 'N/A'}</span></td>
                    <td><span className="product-name-cell">{item.name || item.productName || 'Unknown Product'}</span></td>
                    <td><span className="type-cell">{item.customerName || item.customer || '—'}</span></td>
                    <td className="text-right"><span className="quantity-cell">{parseFloat(item.quantity) || 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (activeView === 'stockChecks') {
        if (filteredChecks.length === 0) {
          return (
            <div className="empty-table" style={{ padding: 26 }}>
              <div className="empty-icon">🔎</div>
              <p>No archived stock checks match this search.</p>
            </div>
          );
        }

        return (
          <div className="table-container archive-table-container">
            <table className="data-table archive-table">
              <thead>
                <tr>
                  <th>Checked At</th>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th className="text-right">System Qty</th>
                  <th className="text-right">Counted Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredChecks.map((check) => (
                  <tr key={check.id}>
                    <td><span className="date-cell">{formatDateTime(check.reconfirmedAt || check.checkedAt)}</span></td>
                    <td><span className="barcode-cell">{check.id}</span></td>
                    <td><span className="product-name-cell">{check.productName || 'Unnamed'}</span></td>
                    <td>
                      {check.status === 'pending' ? (
                        <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>
                          Pending
                        </span>
                      ) : (
                        <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>
                          Accurate
                        </span>
                      )}
                    </td>
                    <td className="text-right"><span className="quantity-cell">{check.systemQuantity ?? 0}</span></td>
                    <td className="text-right"><span className="quantity-cell">{check.countedQuantity ?? '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (filteredHistoryEntries.length === 0) {
        return (
          <div className="empty-table" style={{ padding: 26 }}>
            <div className="empty-icon">🔎</div>
            <p>No archived history entries match this search.</p>
          </div>
        );
      }

      return (
        <div className="table-container archive-table-container">
          <table className="data-table archive-table">
            <thead>
              <tr>
                <th>Checked At</th>
                <th>Month</th>
                <th>Barcode</th>
                <th>Product</th>
                <th>Status</th>
                <th className="text-right">System Qty</th>
                <th className="text-right">Counted Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistoryEntries.map((entry) => (
                <tr key={entry.id}>
                  <td><span className="date-cell">{formatDateTime(entry.checkedAt)}</span></td>
                  <td><span className="type-cell">{entry.month}</span></td>
                  <td><span className="barcode-cell">{entry.productId || 'N/A'}</span></td>
                  <td><span className="product-name-cell">{entry.productName || 'Unnamed'}</span></td>
                  <td>
                    {entry.status === 'accurate' ? (
                      <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>
                        Accurate
                      </span>
                    ) : (
                      <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>
                        Inaccurate
                      </span>
                    )}
                  </td>
                  <td className="text-right"><span className="quantity-cell">{entry.systemQuantity ?? 0}</span></td>
                  <td className="text-right"><span className="quantity-cell">{entry.countedQuantity ?? '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    if (isStockArchive) {
      const soldItemsCount = summary.soldItemsArchived ?? objCount(selectedArchive.soldItems);
      const checksCount = objCount(selectedArchive.stockChecks);
      const pendingChecks = Object.values(selectedArchive.stockChecks || {})
        .filter((check) => check?.status === 'pending').length;
      const historyMonths = summary.historyMonthsArchived ?? objCount(selectedArchive.stockCheckHistory);
      const historyCount = historyEntriesCount(selectedArchive.stockCheckHistory);

      return (
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Stock Archive Details</h3>
          <div className="archive-summary-grid">
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
              <div style={{ fontWeight: 700 }}>{historyCount}</div>
            </div>
          </div>

          <div className="archive-detail-controls">
            <div className="tab-navigation archive-view-nav">
              {viewOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setDetailView(option.key)}
                  className={`tab-button ${activeView === option.key ? 'active' : ''}`}
                >
                  <span className="tab-label">{option.label}</span>
                </button>
              ))}
            </div>
            <div className="archive-search-box">
              <div className="search-input-group">
                <input
                  type="text"
                  value={detailSearchTerm}
                  onChange={(event) => setDetailSearchTerm(event.target.value)}
                  className="search-input"
                  placeholder={`Search ${activeViewLabel}...`}
                />
                {detailSearchTerm && (
                  <button className="search-clear" onClick={() => setDetailSearchTerm('')} title="Clear search">
                    ✕
                  </button>
                )}
              </div>
              <div className="archive-search-meta">{visibleRows} of {totalRows} shown</div>
            </div>
          </div>

          {renderActiveTable()}
        </div>
      );
    }

    const productsCount = summary.productsArchived ?? objCount(selectedArchive.products);
    const qtyBeforeReset = summary.totalQuantityBeforeReset
      ?? products.reduce((sum, product) => sum + (parseFloat(product.quantity) || 0), 0);

    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Product Archive Details</h3>
        <div className="archive-summary-grid">
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

        <div className="archive-detail-controls">
          <div className="tab-navigation archive-view-nav">
            {viewOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setDetailView(option.key)}
                className={`tab-button ${activeView === option.key ? 'active' : ''}`}
              >
                <span className="tab-label">{option.label}</span>
              </button>
            ))}
          </div>
          <div className="archive-search-box">
            <div className="search-input-group">
              <input
                type="text"
                value={detailSearchTerm}
                onChange={(event) => setDetailSearchTerm(event.target.value)}
                className="search-input"
                placeholder="Search products..."
              />
              {detailSearchTerm && (
                <button className="search-clear" onClick={() => setDetailSearchTerm('')} title="Clear search">
                  ✕
                </button>
              )}
            </div>
            <div className="archive-search-meta">{filteredProducts.length} of {products.length} shown</div>
          </div>
        </div>

        {renderActiveTable()}
      </div>
    );
  };

  return (
    <div className="admin-container">
      <PageHeader title="Archives Center" subtitle="View all archived stock and product snapshots in one place" />

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
            <IconRefresh /> {isLoading ? 'Refreshing...' : 'Refresh'}
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

      <div className="archive-layout">
        <div className="table-section" style={{ marginTop: 0 }}>
          <div className="table-card">
            <div className="table-container archive-table-container">
              {isLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>🔄 Loading archives...</div>
              ) : (
                <table className="data-table archive-table">
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
