import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, update, push, set, remove } from 'firebase/database';
import { database } from '../Auth/firebase';
import { BrowserMultiFormatReader } from '@zxing/library';
import '../CSS/admin.css';

// ─── Firebase nodes used ──────────────────────────────────────────────────────
// products/{id}                          — live product data
// SoldItems/{saleId}                     — live sold items
// stockChecks/{id}                       — current pending/accurate checks
// stockCheckHistory/{YYYY-MM}/{pushKey}  — monthly audit history
// stockArchives/{archiveId}              — archived snapshots before reset
// ─────────────────────────────────────────────────────────────────────────────

const RemainingProducts = () => {
  const [products, setProducts]                 = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [pendingChecks, setPendingChecks]       = useState([]);
  const [searchTerm, setSearchTerm]             = useState('');
  const [activeTab, setActiveTab]               = useState('check');
  const [isLoading, setIsLoading]               = useState(false);
  const [isArchiving, setIsArchiving]           = useState(false);
  const [isRestoring, setIsRestoring]           = useState(false);

  const [countedQty, setCountedQty]     = useState({});
  const [reconfirmQty, setReconfirmQty] = useState({});
  const [soldTotals, setSoldTotals]     = useState({});

  // Scanner
  const [scannerOpen, setScannerOpen]     = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [scanStatus, setScanStatus]       = useState('Align barcode within the frame.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanQty, setScanQty]             = useState('');
  const scannerRef    = useRef(null);
  const codeReaderRef = useRef(null);
  const scanCoolRef   = useRef(null);

  // History
  const [historyMonth, setHistoryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [historyData, setHistoryData]       = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [archivesData, setArchivesData]     = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveDetailLoading, setArchiveDetailLoading] = useState(false);
  const [archiveDetailView, setArchiveDetailView] = useState('products');
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');

  const [showZeroStock, setShowZeroStock] = useState(false);

  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage]     = useState(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showSuccess = (msg) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(null), 3000); };
  const showError   = (msg) => { setErrorMessage(msg);   setTimeout(() => setErrorMessage(null),   3000); };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      if (isNaN(d)) return 'N/A';
      const dd   = String(d.getDate()).padStart(2, '0');
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const hh   = String(d.getHours() % 12 || 12).padStart(2, '0');
      const min  = String(d.getMinutes()).padStart(2, '0');
      const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
      return `${dd}-${mm}-${d.getFullYear()} ${hh}:${min} ${ampm}`;
    } catch { return 'N/A'; }
  };

  const currentMonthKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const hasStock = (product) => (parseFloat(product?.quantity) || 0) > 0;

  const objCount = (obj) => (obj && typeof obj === 'object' ? Object.keys(obj).length : 0);

  const historyEntriesCount = (historyObj) => {
    if (!historyObj || typeof historyObj !== 'object') return 0;
    return Object.values(historyObj).reduce((sum, monthData) => sum + objCount(monthData), 0);
  };

  const matchesSearch = (values, searchText) => {
    if (!searchText) return true;
    return values.some((value) => String(value ?? '').toLowerCase().includes(searchText));
  };

  // ── History writer ─────────────────────────────────────────────────────────

  const pushHistory = async (productId, productName, systemQty, counted, status) => {
    try {
      await push(ref(database, `stockCheckHistory/${currentMonthKey()}`), {
        productId, productName,
        systemQuantity: systemQty, countedQuantity: counted,
        status, checkedAt: new Date().toISOString(),
      });
    } catch (err) { console.error('History write failed:', err); }
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [prodSnap, checkSnap, soldSnap] = await Promise.all([
        get(ref(database, 'products')),
        get(ref(database, 'stockChecks')),
        get(ref(database, 'SoldItems')),
      ]);

      if (prodSnap.exists()) {
        const list = Object.entries(prodSnap.val()).map(([id, v]) => ({ id, ...v }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setProducts(list);
        setFilteredProducts(list.filter(hasStock));
      } else {
        setProducts([]); setFilteredProducts([]);
      }

      // Build lastCheckedAt map { [productId]: Date } from ALL stockChecks (any status)
      // This is the cutoff — we only count sales AFTER the last check date
      const lastCheckedAt = {};
      if (checkSnap.exists()) {
        const allChecks = Object.entries(checkSnap.val()).map(([id, v]) => ({ id, ...v }));
        allChecks.forEach(c => {
          const ts = c.reconfirmedAt || c.checkedAt;
          if (ts) lastCheckedAt[c.id] = new Date(ts);
        });
        setPendingChecks(allChecks.filter(c => c.status === 'pending'));
      } else {
        setPendingChecks([]);
      }

      // Build { [barcode]: qtySoldSinceLastCheck }
      // For products never checked, count ALL sold items (no cutoff)
      if (soldSnap.exists()) {
        const totals = {};
        Object.values(soldSnap.val()).forEach(item => {
          const barcode  = item.barcode;
          const qty      = parseFloat(item.quantity) || 0;
          if (!barcode) return;
          const cutoff   = lastCheckedAt[barcode];
          const saleDate = new Date(item.dateScanned);
          // Only count this sale if it happened AFTER the last stock check
          if (!cutoff || saleDate > cutoff) {
            totals[barcode] = (totals[barcode] || 0) + qty;
          }
        });
        setSoldTotals(totals);
      } else {
        setSoldTotals({});
      }

} catch (err) { console.error(err); showError('Error loading data.'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const baseProducts = showZeroStock
      ? products.filter(p => (parseFloat(p.quantity) || 0) - (soldTotals[p.id] || 0) <= 0)
      : products.filter(hasStock);
    if (!searchTerm.trim()) { setFilteredProducts(baseProducts); return; }
    const t = searchTerm.toLowerCase();
    setFilteredProducts(baseProducts.filter(p =>
      p.name?.toLowerCase().includes(t) || p.id?.toLowerCase().includes(t) || p.productType?.toLowerCase().includes(t)
    ));
  }, [searchTerm, products, showZeroStock, soldTotals]);

  // ── History fetch ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async (month) => {
    setHistoryLoading(true);
    try {
      const snap = await get(ref(database, `stockCheckHistory/${month}`));
      if (snap.exists()) {
        setHistoryData(
          Object.entries(snap.val())
            .map(([key, v]) => ({ key, ...v }))
            .sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt))
        );
      } else { setHistoryData([]); }
    } catch (err) { console.error(err); showError('Failed to load history.'); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory(historyMonth);
  }, [activeTab, historyMonth, fetchHistory]);

  const fetchArchives = useCallback(async () => {
    setArchivesLoading(true);
    try {
      const snap = await get(ref(database, 'stockArchives'));
      if (!snap.exists()) {
        setArchivesData([]);
        setSelectedArchive(null);
        setSelectedArchiveId('');
        return;
      }

      const list = Object.entries(snap.val())
        .map(([key, value]) => ({
          key,
          archivedAt: value.archivedAt || key,
          summary: value.summary || {},
        }))
        .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

      setArchivesData(list);
      if (list.length > 0) {
        setSelectedArchiveId((prev) => (
          prev && list.some((archive) => archive.key === prev) ? prev : list[0].key
        ));
      }
    } catch (err) {
      console.error(err);
      showError('Failed to load archives.');
    } finally {
      setArchivesLoading(false);
    }
  }, []);

  const fetchArchiveDetails = useCallback(async (archiveId) => {
    if (!archiveId) { setSelectedArchive(null); return; }
    setArchiveDetailLoading(true);
    try {
      const snap = await get(ref(database, `stockArchives/${archiveId}`));
      if (snap.exists()) {
        setSelectedArchive({ key: archiveId, ...snap.val() });
      } else {
        setSelectedArchive(null);
      }
    } catch (err) {
      console.error(err);
      showError('Failed to load archive details.');
    } finally {
      setArchiveDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'archives') fetchArchives();
  }, [activeTab, fetchArchives]);

  useEffect(() => {
    if (activeTab === 'archives') fetchArchiveDetails(selectedArchiveId);
  }, [activeTab, selectedArchiveId, fetchArchiveDetails]);

  useEffect(() => {
    if (activeTab !== 'archives') return;
    setArchiveDetailView('products');
    setArchiveSearchTerm('');
  }, [activeTab, selectedArchiveId]);

  // ── Scanner camera lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    if (!scannerOpen || scannerPaused) return;

    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    codeReader.decodeFromVideoDevice(null, scannerRef.current, (result) => {
      if (!result) return;
      if (scanCoolRef.current) return;
      scanCoolRef.current = setTimeout(() => { scanCoolRef.current = null; }, 2500);

      const barcode = result.getText();
      const found = products.find(p => p.id === barcode && hasStock(p));
      if (found) {
        setScannerPaused(true);
        setScannedProduct(found);
        setScanQty('');
        setScanStatus(`Found: ${found.name}`);
      } else {
        setScanStatus(`Barcode "${barcode}" not found in active stock.`);
        setTimeout(() => setScanStatus('Align barcode within the frame.'), 2500);
      }
    }, { tryHarder: false, constraints: { video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } } } })
    .catch(err => { console.error('Camera init failed:', err); setScanStatus('Camera failed. Check permissions.'); });

    return () => {
      if (scanCoolRef.current) { clearTimeout(scanCoolRef.current); scanCoolRef.current = null; }
      if (codeReaderRef.current) { codeReaderRef.current.reset(); codeReaderRef.current = null; }
    };
  }, [scannerOpen, scannerPaused, products]);

  useEffect(() => {
    if (!scannerOpen) {
      if (scanCoolRef.current) { clearTimeout(scanCoolRef.current); scanCoolRef.current = null; }
      if (codeReaderRef.current) { codeReaderRef.current.reset(); codeReaderRef.current = null; }
      setScannerPaused(false); setScannedProduct(null); setScanQty('');
      setScanStatus('Align barcode within the frame.');
    }
  }, [scannerOpen]);

  // ── Actions: scan modal ────────────────────────────────────────────────────

  const handleScanAccurate = async () => {
    const counted = parseFloat(scanQty);
    if (isNaN(counted) || scanQty === '') { showError('Enter a counted quantity first.'); return; }
    try {
      await update(ref(database, `products/${scannedProduct.id}`), { quantity: counted });
      await update(ref(database, `stockChecks/${scannedProduct.id}`), {
        productName: scannedProduct.name, systemQuantity: scannedProduct.quantity,
        countedQuantity: counted, status: 'accurate', checkedAt: new Date().toISOString(),
      });
      await pushHistory(scannedProduct.id, scannedProduct.name, scannedProduct.quantity, counted, 'accurate');
      setProducts(prev => prev.map(p => p.id === scannedProduct.id ? { ...p, quantity: counted } : p));
      showSuccess(`✓ "${scannedProduct.name}" updated to ${counted}.`);
      setScannedProduct(null); setScanQty(''); setScannerPaused(false);
      setScanStatus('Align barcode within the frame.');
    } catch (err) { console.error(err); showError('Failed to update.'); }
  };

  const handleScanInaccurate = async () => {
    const counted = parseFloat(scanQty);
    if (isNaN(counted) || scanQty === '') { showError('Enter a counted quantity first.'); return; }
    try {
      const checkData = {
        productName: scannedProduct.name, systemQuantity: scannedProduct.quantity,
        countedQuantity: counted, status: 'pending', checkedAt: new Date().toISOString(),
      };
      await update(ref(database, `stockChecks/${scannedProduct.id}`), checkData);
      await pushHistory(scannedProduct.id, scannedProduct.name, scannedProduct.quantity, counted, 'inaccurate');
      setPendingChecks(prev => {
        const exists = prev.find(c => c.id === scannedProduct.id);
        if (exists) return prev.map(c => c.id === scannedProduct.id ? { id: scannedProduct.id, ...checkData } : c);
        return [...prev, { id: scannedProduct.id, ...checkData }];
      });
      showSuccess(`"${scannedProduct.name}" flagged for reconfirmation.`);
      setScannedProduct(null); setScanQty(''); setScannerPaused(false);
      setScanStatus('Align barcode within the frame.');
    } catch (err) { console.error(err); showError('Failed to save.'); }
  };

  // ── Actions: hold ─────────────────────────────────────────────────────────

  const handleHoldProduct = async (product) => {
    if (!window.confirm(`Hold "${product.name}"? It will move to the Held section in Product Management.`)) return;
    try {
      await set(ref(database, `heldProducts/${product.id}`), {
        name: product.name || '',
        productType: product.productType || '',
        itemCost: product.itemCost || 0,
        purchasingPrice: product.purchasingPrice || 0,
        quantity: product.quantity || 0,
        heldDate: new Date().toISOString(),
      });
      await remove(ref(database, `products/${product.id}`));
      setProducts(prev => prev.filter(p => p.id !== product.id));
      showSuccess(`"${product.name}" moved to Held.`);
    } catch (err) { console.error(err); showError('Failed to hold product.'); }
  };

  // ── Actions: table ─────────────────────────────────────────────────────────

  const handleAccurate = async (product) => {
    const counted = parseFloat(countedQty[product.id]);
    if (!countedQty[product.id] || isNaN(counted)) { showError(`Enter a counted qty for "${product.name}" first.`); return; }
    try {
      await update(ref(database, `products/${product.id}`), { quantity: counted });
      await update(ref(database, `stockChecks/${product.id}`), {
        productName: product.name, systemQuantity: product.quantity,
        countedQuantity: counted, status: 'accurate', checkedAt: new Date().toISOString(),
      });
      await pushHistory(product.id, product.name, product.quantity, counted, 'accurate');
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: counted } : p));
      setCountedQty(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      showSuccess(`✓ "${product.name}" updated to ${counted}.`);
    } catch (err) { console.error(err); showError('Failed to update stock.'); }
  };

  const handleInaccurate = async (product) => {
    const counted = parseFloat(countedQty[product.id]);
    if (!countedQty[product.id] || isNaN(counted)) { showError(`Enter a counted qty for "${product.name}" first.`); return; }
    try {
      const checkData = {
        productName: product.name, systemQuantity: product.quantity,
        countedQuantity: counted, status: 'pending', checkedAt: new Date().toISOString(),
      };
      await update(ref(database, `stockChecks/${product.id}`), checkData);
      await pushHistory(product.id, product.name, product.quantity, counted, 'inaccurate');
      setPendingChecks(prev => {
        const exists = prev.find(c => c.id === product.id);
        if (exists) return prev.map(c => c.id === product.id ? { id: product.id, ...checkData } : c);
        return [...prev, { id: product.id, ...checkData }];
      });
      setCountedQty(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      showSuccess(`"${product.name}" flagged for reconfirmation.`);
    } catch (err) { console.error(err); showError('Failed to save check.'); }
  };

  // ── Actions: pending ───────────────────────────────────────────────────────

  const handleReconfirmAccurate = async (check) => {
    const newQty = parseFloat(reconfirmQty[check.id]);
    const qty = isNaN(newQty) ? check.countedQuantity : newQty;
    try {
      await update(ref(database, `products/${check.id}`), { quantity: qty });
      await update(ref(database, `stockChecks/${check.id}`), { countedQuantity: qty, status: 'accurate', reconfirmedAt: new Date().toISOString() });
      await pushHistory(check.id, check.productName, check.systemQuantity, qty, 'accurate');
      setProducts(prev => prev.map(p => p.id === check.id ? { ...p, quantity: qty } : p));
      setPendingChecks(prev => prev.filter(c => c.id !== check.id));
      setReconfirmQty(prev => { const n = { ...prev }; delete n[check.id]; return n; });
      showSuccess(`✓ "${check.productName}" confirmed — updated to ${qty}.`);
    } catch (err) { console.error(err); showError('Failed to reconfirm.'); }
  };

  const handleReconfirmInaccurate = async (check) => {
    const newQty = parseFloat(reconfirmQty[check.id]);
    const qty = isNaN(newQty) ? check.countedQuantity : newQty;
    try {
      await update(ref(database, `stockChecks/${check.id}`), { countedQuantity: qty, status: 'pending', checkedAt: new Date().toISOString() });
      await pushHistory(check.id, check.productName, check.systemQuantity, qty, 'inaccurate');
      setPendingChecks(prev => prev.map(c => c.id === check.id ? { ...c, countedQuantity: qty, checkedAt: new Date().toISOString() } : c));
      setReconfirmQty(prev => { const n = { ...prev }; delete n[check.id]; return n; });
      showSuccess(`"${check.productName}" remains flagged for review.`);
    } catch (err) { console.error(err); showError('Failed to update.'); }
  };

  // ── Actions: archive all stock and reset ──────────────────────────────────

  const handleArchiveAllStock = async () => {
    const confirmed = window.confirm(
      'Archive ALL products + Sold Items and start from scratch?\n\n' +
      'This creates an archive copy, keeps products (barcode/name/prices/etc.), resets product quantities to 0, and clears live SoldItems + stock checks/history.'
    );
    if (!confirmed) return;

    setIsArchiving(true);
    const archivedAt = new Date().toISOString();
    const archiveId = archivedAt.replace(/[.:]/g, '-');

    try {
      const [productsSnap, checksSnap, historySnap, soldSnap] = await Promise.all([
        get(ref(database, 'products')),
        get(ref(database, 'stockChecks')),
        get(ref(database, 'stockCheckHistory')),
        get(ref(database, 'SoldItems')),
      ]);

      if (!productsSnap.exists()) {
        showError('No products available to archive.');
        return;
      }

      const allProducts = Object.entries(productsSnap.val()).map(([id, value]) => ({ id, ...value }));

      const productSnapshot = allProducts.reduce((acc, product) => {
        acc[product.id] = { ...product };
        return acc;
      }, {});

      const allChecks = checksSnap.exists() ? checksSnap.val() : {};
      const pendingFromDb = Object.values(allChecks).filter((check) => check?.status === 'pending').length;

      await set(ref(database, `stockArchives/${archiveId}`), {
        archivedAt,
        summary: {
          productsArchived: allProducts.length,
          soldItemsArchived: soldSnap.exists() ? Object.keys(soldSnap.val()).length : 0,
          pendingChecksArchived: pendingFromDb,
          historyMonthsArchived: historySnap.exists() ? Object.keys(historySnap.val()).length : 0,
        },
        products: productSnapshot,
        soldItems: soldSnap.exists() ? soldSnap.val() : {},
        stockChecks: allChecks,
        stockCheckHistory: historySnap.exists() ? historySnap.val() : {},
      });

      const resetProducts = allProducts.reduce((acc, product) => {
        const { id, ...rest } = product;
        acc[id] = { ...rest, quantity: 0 };
        return acc;
      }, {});

      await Promise.all([
        set(ref(database, 'products'), resetProducts),
        set(ref(database, 'stockCheckHistory'), null),
        set(ref(database, 'SoldItems'), null),
        set(ref(database, 'stockChecks'), null),
      ]);

      // In RemainingProducts, start fresh by clearing the visible stock list immediately.
      setProducts([]);
      setFilteredProducts([]);
      setPendingChecks([]);
      setCountedQty({});
      setReconfirmQty({});
      setSoldTotals({});
      setHistoryData([]);
      if (activeTab === 'archives') fetchArchives();

      showSuccess(`Archived stock data and reset quantities to 0 for ${allProducts.length} products. Remaining stock list is now cleared.`);
    } catch (err) {
      console.error(err);
      if (err?.code === 'PERMISSION_DENIED') {
        showError('Permission denied. Add read/write rules for "stockArchives".');
      } else {
        showError('Failed to archive stock. Please try again.');
      }
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestoreArchive = async () => {
    if (!selectedArchive) {
      showError('Select an archive first.');
      return;
    }

    const confirmed = window.confirm(
      `Restore archive from ${formatDate(selectedArchive.archivedAt)}?\n\n` +
      'This will overwrite current live products, SoldItems, stockChecks, and stockCheckHistory.'
    );
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const productsPayload = objCount(selectedArchive.products) ? selectedArchive.products : null;
      const soldItemsPayload = objCount(selectedArchive.soldItems) ? selectedArchive.soldItems : null;
      const checksPayload = objCount(selectedArchive.stockChecks) ? selectedArchive.stockChecks : null;
      const historyPayload = objCount(selectedArchive.stockCheckHistory) ? selectedArchive.stockCheckHistory : null;

      await Promise.all([
        set(ref(database, 'products'), productsPayload),
        set(ref(database, 'SoldItems'), soldItemsPayload),
        set(ref(database, 'stockChecks'), checksPayload),
        set(ref(database, 'stockCheckHistory'), historyPayload),
      ]);

      await fetchData();
      setCountedQty({});
      setReconfirmQty({});
      if (activeTab === 'history') fetchHistory(historyMonth);
      if (activeTab === 'archives') fetchArchives();

      showSuccess(`Archive restored successfully (${objCount(selectedArchive.products)} products).`);
    } catch (err) {
      console.error(err);
      if (err?.code === 'PERMISSION_DENIED') {
        showError('Permission denied. Check read/write rules for products, SoldItems, stockChecks, and stockCheckHistory.');
      } else {
        showError('Failed to restore archive. Please try again.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // ── Render: Check tab ──────────────────────────────────────────────────────

  const renderCheckTab = () => (
    <div>
      <div className="header-section">
        <div className="header-left">
          <h2 className="section-title">Stock Checker</h2>
          <div className="stats-badge">{filteredProducts.length} Products</div>
          {pendingChecks.length > 0 && (
            <div className="stats-badge" style={{ backgroundColor: '#fff3cd', color: '#856404', marginLeft: 8 }}>
              {pendingChecks.length} Pending
            </div>
          )}
        </div>
        <div className="header-right" style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleArchiveAllStock}
            className="btn-danger"
            disabled={isArchiving || isRestoring || isLoading || products.length === 0}
            title="Archive data, keep products, reset product quantities to 0, and clear sold/check history data"
          >
            {isArchiving ? '🗄️ Archiving...' : '🗄️ Archive & Reset Qty'}
          </button>
          <button onClick={() => setScannerOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            📷 Scan Barcode
          </button>
          <button onClick={fetchData} className={`btn-secondary ${isLoading ? 'refreshing' : ''}`} disabled={isLoading}>
            {isLoading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      <div style={{ margin: '12px 0' }}>
        <input
          type="text"
          placeholder="🔍 Search by name, barcode or type..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      <div className="table-section">
        <div className="table-card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product Name</th>
                  <th>Type</th>
                  <th className="text-right">Current Stock</th>
                  <th className="text-right" title="Sold since last stock check">Sold Since Check</th>
                  <th className="text-right">Expected Remaining</th>
                  <th className="text-right">Counted Qty</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => {
                  const isPending        = pendingChecks.some(c => c.id === product.id);
                  const inputVal         = countedQty[product.id] ?? '';
                  const totalSold        = soldTotals[product.id] || 0;
                  const currentStock     = product.quantity;
                  const expectedRemaining = currentStock - totalSold;
                  const hasDiff          = inputVal !== '' && parseFloat(inputVal) !== expectedRemaining;
                  return (
                    <tr key={product.id} style={isPending ? { backgroundColor: '#fffbeb' } : {}}>
                      <td><span className="barcode-cell">{product.id}</span></td>
                      <td><span className="product-name-cell">{product.name}</span></td>
                      <td><span className="type-cell">{product.productType}</span></td>
                      <td className="text-right"><span className="quantity-cell">{currentStock}</span></td>
                      <td className="text-right">
                        <span className="quantity-cell" style={{ color: totalSold > 0 ? '#dc3545' : '#6c757d' }}>{totalSold}</span>
                      </td>
                      <td className="text-right">
                        <span className="quantity-cell" style={{ fontWeight: 700, color: expectedRemaining < 0 ? '#dc3545' : '#198754' }}>
                          {expectedRemaining}
                        </span>
                      </td>
                      <td className="text-right">
                        <input
                          type="number" min="0" placeholder="Enter count" value={inputVal}
                          onChange={e => setCountedQty(prev => ({ ...prev, [product.id]: e.target.value }))}
                          className="edit-input"
                          style={{ width: 90, borderColor: hasDiff ? '#dc3545' : inputVal !== '' ? '#28a745' : undefined }}
                        />
                        {hasDiff && <div style={{ fontSize: 11, color: '#dc3545', marginTop: 2 }}>Δ {(parseFloat(inputVal) - expectedRemaining).toFixed(0)} vs expected</div>}
                      </td>
                      <td>
                        {isPending
                          ? <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>⚠️ Pending</span>
                          : <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>✓ OK</span>}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-small btn-success" onClick={() => handleAccurate(product)}>✅ Accurate</button>
                          <button className="btn-small btn-danger" onClick={() => handleInaccurate(product)}>❌ Inaccurate</button>
                          <button className="btn-small btn-warning" onClick={() => handleHoldProduct(product)}>⏸️ Hold</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && !isLoading && (
            <div className="empty-table">
              <div className="empty-icon">📦</div>
              <p>No products found{searchTerm ? ` for "${searchTerm}"` : ''}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Render: Pending tab ────────────────────────────────────────────────────

  const renderPendingTab = () => (
    <div>
      <div className="header-section">
        <div className="header-left">
          <h2 className="section-title">Pending Reconfirmations</h2>
          <div className="stats-badge" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>{pendingChecks.length} Flagged</div>
        </div>
        <div className="header-right">
          <button onClick={fetchData} className="btn-secondary" disabled={isLoading}>{isLoading ? '🔄 Loading...' : '🔄 Refresh'}</button>
        </div>
      </div>
      <div className="table-section">
        <div className="table-card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product Name</th>
                  <th className="text-right">System Qty</th>
                  <th className="text-right">Last Count</th>
                  <th className="text-right">Difference</th>
                  <th>Flagged At</th>
                  <th className="text-right">Re-count Qty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingChecks.map(check => {
                  const diff       = check.countedQuantity - check.systemQuantity;
                  const reInputVal = reconfirmQty[check.id] ?? '';
                  return (
                    <tr key={check.id} style={{ backgroundColor: '#fffbeb' }}>
                      <td><span className="barcode-cell">{check.id}</span></td>
                      <td><span className="product-name-cell">{check.productName}</span></td>
                      <td className="text-right"><span className="quantity-cell">{check.systemQuantity}</span></td>
                      <td className="text-right"><span className="quantity-cell">{check.countedQuantity}</span></td>
                      <td className="text-right">
                        <span style={{ color: diff < 0 ? '#dc3545' : diff > 0 ? '#198754' : '#6c757d', fontWeight: 600 }}>{diff > 0 ? '+' : ''}{diff}</span>
                      </td>
                      <td><span className="date-cell">{formatDate(check.checkedAt)}</span></td>
                      <td className="text-right">
                        <input
                          type="number" min="0" placeholder={String(check.countedQuantity)} value={reInputVal}
                          onChange={e => setReconfirmQty(prev => ({ ...prev, [check.id]: e.target.value }))}
                          className="edit-input" style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-small btn-success" onClick={() => handleReconfirmAccurate(check)}>✅ Confirm</button>
                          <button className="btn-small btn-warning" onClick={() => handleReconfirmInaccurate(check)}>🔄 Still Unsure</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pendingChecks.length === 0 && (
            <div className="empty-table">
              <div className="empty-icon">✅</div>
              <p>No pending reconfirmations — all checks cleared!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Render: History tab ────────────────────────────────────────────────────

  const renderHistoryTab = () => {
    const accurate   = historyData.filter(h => h.status === 'accurate').length;
    const inaccurate = historyData.filter(h => h.status === 'inaccurate').length;
    return (
      <div>
        <div className="header-section">
          <div className="header-left">
            <h2 className="section-title">Stock Check History</h2>
            <div className="stats-badge">{historyData.length} Records</div>
          </div>
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 14 }}>Month:</label>
            <input
              type="month" value={historyMonth}
              onChange={e => setHistoryMonth(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 }}
            />
            <button onClick={() => fetchHistory(historyMonth)} className="btn-secondary" disabled={historyLoading}>
              {historyLoading ? '🔄' : '🔄 Load'}
            </button>
          </div>
        </div>

        {historyData.length > 0 && (
          <div style={{ display: 'flex', gap: 12, margin: '12px 0' }}>
            <div style={{ flex: 1, background: '#e8f5e9', borderRadius: 10, padding: '14px 18px', borderLeft: '4px solid #28a745' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a7a2e' }}>{accurate}</div>
              <div style={{ fontSize: 13, color: '#555' }}>✅ Accurate checks</div>
            </div>
            <div style={{ flex: 1, background: '#fff3cd', borderRadius: 10, padding: '14px 18px', borderLeft: '4px solid #ffc107' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#856404' }}>{inaccurate}</div>
              <div style={{ fontSize: 13, color: '#555' }}>⚠️ Flagged as inaccurate</div>
            </div>
            <div style={{ flex: 1, background: '#e7f1ff', borderRadius: 10, padding: '14px 18px', borderLeft: '4px solid #0d6efd' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0a58ca' }}>{historyData.length}</div>
              <div style={{ fontSize: 13, color: '#555' }}>📋 Total checks</div>
            </div>
          </div>
        )}

        <div className="table-section">
          <div className="table-card">
            <div className="table-container">
              {historyLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>🔄 Loading history...</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Barcode</th>
                      <th className="text-right">System Qty</th>
                      <th className="text-right">Counted Qty</th>
                      <th className="text-right">Difference</th>
                      <th>Result</th>
                      <th>Checked At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map(entry => {
                      const diff = entry.countedQuantity - entry.systemQuantity;
                      return (
                        <tr key={entry.key}>
                          <td><span className="product-name-cell">{entry.productName}</span></td>
                          <td><span className="barcode-cell">{entry.productId}</span></td>
                          <td className="text-right"><span className="quantity-cell">{entry.systemQuantity}</span></td>
                          <td className="text-right"><span className="quantity-cell">{entry.countedQuantity}</span></td>
                          <td className="text-right">
                            <span style={{ color: diff < 0 ? '#dc3545' : diff > 0 ? '#198754' : '#6c757d', fontWeight: 600 }}>{diff > 0 ? '+' : ''}{diff}</span>
                          </td>
                          <td>
                            {entry.status === 'accurate'
                              ? <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>✅ Accurate</span>
                              : <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>⚠️ Inaccurate</span>}
                          </td>
                          <td><span className="date-cell">{formatDate(entry.checkedAt)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {!historyLoading && historyData.length === 0 && (
              <div className="empty-table">
                <div className="empty-icon">📅</div>
                <p>No stock checks recorded for {historyMonth}.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Archives tab ───────────────────────────────────────────────────

  const renderArchivesTab = () => {
    const selectedSummary = selectedArchive?.summary || {};
    const selectedProductsCount = selectedArchive
      ? (selectedSummary.productsArchived ?? objCount(selectedArchive.products))
      : 0;
    const selectedSoldItemsCount = selectedArchive
      ? (selectedSummary.soldItemsArchived ?? objCount(selectedArchive.soldItems))
      : 0;
    const selectedChecksCount = selectedArchive ? objCount(selectedArchive.stockChecks) : 0;
    const selectedPendingChecks = selectedArchive
      ? (selectedSummary.pendingChecksArchived
        ?? Object.values(selectedArchive.stockChecks || {}).filter(c => c?.status === 'pending').length)
      : 0;
    const selectedHistoryMonths = selectedArchive
      ? (selectedSummary.historyMonthsArchived ?? objCount(selectedArchive.stockCheckHistory))
      : 0;
    const selectedHistoryEntries = selectedArchive
      ? historyEntriesCount(selectedArchive.stockCheckHistory)
      : 0;

    const archivedProducts = selectedArchive
      ? Object.entries(selectedArchive.products || {})
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      : [];

    const archivedSoldItems = selectedArchive
      ? Object.entries(selectedArchive.soldItems || {})
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => new Date(b.dateScanned || 0) - new Date(a.dateScanned || 0))
      : [];

    const archivedStockChecks = selectedArchive
      ? Object.entries(selectedArchive.stockChecks || {})
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => new Date(b.reconfirmedAt || b.checkedAt || 0) - new Date(a.reconfirmedAt || a.checkedAt || 0))
      : [];

    const archivedHistoryEntries = selectedArchive
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

    const searchText = archiveSearchTerm.trim().toLowerCase();

    const filteredArchivedProducts = archivedProducts.filter((product) => (
      matchesSearch(
        [product.id, product.name, product.productType, product.quantity, product.purchasePrice, product.salePrice],
        searchText
      )
    ));

    const filteredArchivedSoldItems = archivedSoldItems.filter((item) => (
      matchesSearch(
        [item.id, item.barcode, item.productId, item.name, item.productName, item.customerName, item.customer, item.quantity, item.dateScanned],
        searchText
      )
    ));

    const filteredArchivedChecks = archivedStockChecks.filter((check) => (
      matchesSearch(
        [check.id, check.productName, check.status, check.systemQuantity, check.countedQuantity, check.checkedAt, check.reconfirmedAt],
        searchText
      )
    ));

    const filteredArchivedHistory = archivedHistoryEntries.filter((entry) => (
      matchesSearch(
        [entry.id, entry.month, entry.productId, entry.productName, entry.status, entry.systemQuantity, entry.countedQuantity, entry.checkedAt],
        searchText
      )
    ));

    const archiveViewOptions = [
      { key: 'products', label: `Products (${archivedProducts.length})` },
      { key: 'soldItems', label: `Sold Items (${archivedSoldItems.length})` },
      { key: 'stockChecks', label: `Checks (${archivedStockChecks.length})` },
      { key: 'history', label: `History (${archivedHistoryEntries.length})` },
    ];

    const activeArchiveView = archiveViewOptions.some((option) => option.key === archiveDetailView)
      ? archiveDetailView
      : 'products';

    const activeViewLabel = activeArchiveView === 'products'
      ? 'products'
      : activeArchiveView === 'soldItems'
        ? 'sold items'
        : activeArchiveView === 'stockChecks'
          ? 'stock checks'
          : 'history entries';

    const totalRows = activeArchiveView === 'products'
      ? archivedProducts.length
      : activeArchiveView === 'soldItems'
        ? archivedSoldItems.length
        : activeArchiveView === 'stockChecks'
          ? archivedStockChecks.length
          : archivedHistoryEntries.length;

    const visibleRows = activeArchiveView === 'products'
      ? filteredArchivedProducts.length
      : activeArchiveView === 'soldItems'
        ? filteredArchivedSoldItems.length
        : activeArchiveView === 'stockChecks'
          ? filteredArchivedChecks.length
          : filteredArchivedHistory.length;

    const renderArchiveDetailsTable = () => {
      if (activeArchiveView === 'products') {
        if (filteredArchivedProducts.length === 0) {
          return (
            <div className="empty-table" style={{ padding: 26 }}>
              <div className="empty-icon">🔎</div>
              <p>No archived products match this search.</p>
            </div>
          );
        }

        return (
          <div className="table-container archive-table-container">
            <table className="data-table archive-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchivedProducts.map((product) => (
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

      if (activeArchiveView === 'soldItems') {
        if (filteredArchivedSoldItems.length === 0) {
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
                {filteredArchivedSoldItems.map((item) => (
                  <tr key={item.id}>
                    <td><span className="date-cell">{formatDate(item.dateScanned)}</span></td>
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

      if (activeArchiveView === 'stockChecks') {
        if (filteredArchivedChecks.length === 0) {
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
                {filteredArchivedChecks.map((check) => (
                  <tr key={check.id}>
                    <td><span className="date-cell">{formatDate(check.reconfirmedAt || check.checkedAt)}</span></td>
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

      if (filteredArchivedHistory.length === 0) {
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
              {filteredArchivedHistory.map((entry) => (
                <tr key={entry.id}>
                  <td><span className="date-cell">{formatDate(entry.checkedAt)}</span></td>
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

    return (
      <div>
        <div className="header-section">
          <div className="header-left">
            <h2 className="section-title">Archived Snapshots</h2>
            <div className="stats-badge">{archivesData.length} Archives</div>
          </div>
          <div className="header-right">
            <button onClick={fetchArchives} className="btn-secondary" disabled={archivesLoading}>
              {archivesLoading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        <div className="archive-layout">
          <div className="table-section" style={{ marginTop: 0 }}>
            <div className="table-card">
              <div className="table-container archive-table-container">
                {archivesLoading ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>🔄 Loading archives...</div>
                ) : (
                  <table className="data-table archive-table">
                    <thead>
                      <tr>
                        <th>Archived At</th>
                        <th className="text-right">Products</th>
                        <th className="text-right">Sold Items</th>
                        <th className="text-right">Pending Checks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivesData.map((archive) => (
                        <tr
                          key={archive.key}
                          onClick={() => setSelectedArchiveId(archive.key)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: selectedArchiveId === archive.key ? '#e7f1ff' : undefined,
                          }}
                        >
                          <td><span className="date-cell">{formatDate(archive.archivedAt)}</span></td>
                          <td className="text-right"><span className="quantity-cell">{archive.summary?.productsArchived ?? '—'}</span></td>
                          <td className="text-right"><span className="quantity-cell">{archive.summary?.soldItemsArchived ?? '—'}</span></td>
                          <td className="text-right"><span className="quantity-cell">{archive.summary?.pendingChecksArchived ?? '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {!archivesLoading && archivesData.length === 0 && (
                <div className="empty-table">
                  <div className="empty-icon">🗄️</div>
                  <p>No archives found yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="table-section" style={{ marginTop: 0 }}>
            <div className="table-card">
              {archiveDetailLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>🔄 Loading archive details...</div>
              ) : !selectedArchive ? (
                <div className="empty-table">
                  <div className="empty-icon">📂</div>
                  <p>Select an archive to view details.</p>
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Archive Details</h3>
                    <button
                      className="btn-warning"
                      onClick={handleRestoreArchive}
                      disabled={isRestoring || archiveDetailLoading}
                      title="Restore this archive to live products, sold items, checks, and history"
                    >
                      {isRestoring ? '🔄 Restoring...' : '♻️ Restore This Archive'}
                    </button>
                  </div>
                  <div className="archive-summary-grid">
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>Archived At</div>
                      <div style={{ fontWeight: 700 }}>{formatDate(selectedArchive.archivedAt)}</div>
                    </div>
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>Products</div>
                      <div style={{ fontWeight: 700 }}>{selectedProductsCount}</div>
                    </div>
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>Sold Items</div>
                      <div style={{ fontWeight: 700 }}>{selectedSoldItemsCount}</div>
                    </div>
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>Stock Checks</div>
                      <div style={{ fontWeight: 700 }}>{selectedChecksCount} total / {selectedPendingChecks} pending</div>
                    </div>
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>History Months</div>
                      <div style={{ fontWeight: 700 }}>{selectedHistoryMonths}</div>
                    </div>
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>History Entries</div>
                      <div style={{ fontWeight: 700 }}>{selectedHistoryEntries}</div>
                    </div>
                  </div>
                  <div className="archive-detail-controls">
                    <div className="tab-navigation archive-view-nav">
                      {archiveViewOptions.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => setArchiveDetailView(option.key)}
                          className={`tab-button ${activeArchiveView === option.key ? 'active' : ''}`}
                        >
                          <span className="tab-label">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="archive-search-box">
                      <div className="search-input-group">
                        <input
                          type="text"
                          value={archiveSearchTerm}
                          onChange={(event) => setArchiveSearchTerm(event.target.value)}
                          className="search-input"
                          placeholder={`Search ${activeViewLabel}...`}
                        />
                        {archiveSearchTerm && (
                          <button className="search-clear" onClick={() => setArchiveSearchTerm('')} title="Clear search">
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="archive-search-meta">{visibleRows} of {totalRows} shown</div>
                    </div>
                  </div>

                  {renderArchiveDetailsTable()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Scanner modal ──────────────────────────────────────────────────

  const renderScannerModal = () => (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3 className="modal-title">📷 Scan Product Barcode</h3>
          <button className="modal-close" onClick={() => setScannerOpen(false)}>✕</button>
        </div>

        <div className="modal-content">
          {!scannedProduct && (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
              <video ref={scannerRef} style={{ width: '100%', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '25%', left: '15%', width: 28, height: 28, borderTop: '3px solid #28a745', borderLeft: '3px solid #28a745' }} />
                <div style={{ position: 'absolute', top: '25%', right: '15%', width: 28, height: 28, borderTop: '3px solid #28a745', borderRight: '3px solid #28a745' }} />
                <div style={{ position: 'absolute', bottom: '25%', left: '15%', width: 28, height: 28, borderBottom: '3px solid #28a745', borderLeft: '3px solid #28a745' }} />
                <div style={{ position: 'absolute', bottom: '25%', right: '15%', width: 28, height: 28, borderBottom: '3px solid #28a745', borderRight: '3px solid #28a745' }} />
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 13, color: '#666', margin: '0 0 12px' }}>{scanStatus}</p>

          {scannedProduct && (
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 16, border: '1px solid #dee2e6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{scannedProduct.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{scannedProduct.id}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{scannedProduct.productType}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#888' }}>System Qty</div>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{scannedProduct.quantity}</div>
                </div>
              </div>

              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Counted Quantity <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <input
                type="number" min="0" autoFocus
                value={scanQty}
                onChange={e => setScanQty(e.target.value)}
                placeholder="Enter physical count..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 15, boxSizing: 'border-box' }}
              />

              {scanQty !== '' && !isNaN(parseFloat(scanQty)) && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: parseFloat(scanQty) === scannedProduct.quantity ? '#198754' : '#dc3545' }}>
                  {parseFloat(scanQty) === scannedProduct.quantity
                    ? '✓ Matches system quantity'
                    : `Δ ${(parseFloat(scanQty) - scannedProduct.quantity).toFixed(0)} from system quantity`}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn-small btn-success" style={{ flex: 1, padding: '8px 0' }} onClick={handleScanAccurate}>✅ Accurate</button>
                <button className="btn-small btn-danger" style={{ flex: 1, padding: '8px 0' }} onClick={handleScanInaccurate}>❌ Inaccurate</button>
              </div>

              <button
                onClick={() => { setScannedProduct(null); setScanQty(''); setScannerPaused(false); setScanStatus('Align barcode within the frame.'); }}
                style={{ marginTop: 8, width: '100%', padding: '6px 0', background: 'none', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#666' }}
              >
                ↩ Scan a different product
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setScannerOpen(false)}>Close Scanner</button>
        </div>
      </div>
    </div>
  );

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <div className="admin-container">
      <div className="page-header">
        <h1 className="page-title">Stock Checker</h1>
        <p className="page-subtitle">Scan barcodes, count stock, archive old data, and review history</p>
      </div>

      {successMessage && <div className="success-message"><span className="message-icon">✓</span>{successMessage}</div>}
      {errorMessage   && <div className="error-message"><span className="message-icon">⚠️</span>{errorMessage}</div>}

      <div className="tab-navigation">
        <button onClick={() => setActiveTab('check')}   className={`tab-button ${activeTab === 'check'   ? 'active' : ''}`}>
          <span className="tab-icon">🔍</span><span className="tab-label">Check Stock</span>
        </button>
        <button onClick={() => setActiveTab('pending')} className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}>
          <span className="tab-icon">⚠️</span><span className="tab-label">Pending</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}>
          <span className="tab-icon">📅</span><span className="tab-label">History</span>
        </button>
        <button onClick={() => setActiveTab('archives')} className={`tab-button ${activeTab === 'archives' ? 'active' : ''}`}>
          <span className="tab-icon">🗄️</span><span className="tab-label">Archives</span>
        </button>
        <button onClick={() => setShowZeroStock(prev => !prev)} className={`tab-button ${showZeroStock ? 'active' : ''}`}>
          <span className="tab-icon">📦</span><span className="tab-label">Zero Stock</span>
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'check'   && renderCheckTab()}
        {activeTab === 'pending' && renderPendingTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'archives' && renderArchivesTab()}
      </div>

      {scannerOpen && renderScannerModal()}
    </div>
  );
};

export default RemainingProducts;
