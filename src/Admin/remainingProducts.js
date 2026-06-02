import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, update, push, set, remove } from 'firebase/database';
import { database } from '../Auth/firebase';
import { BrowserMultiFormatReader } from '@zxing/library';
import '../CSS/admin.css';
import {
  IconRefresh, IconSearch, IconPackage, IconAlertTriangle, IconCheck, IconX,
  IconXCircle, IconPause, IconCamera, IconArchive, IconCalendar, IconFolderOpen,
  IconClipboard, IconArrowUp, IconArrowDown, IconCheckCircle, IconCornerUpLeft,
} from '../utils/icons';
import { useExpiryNotifications } from '../utils/useExpiryNotifications';

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
  const [allCheckedProductIds, setAllCheckedProductIds] = useState(new Set());
  const [searchTerm, setSearchTerm]             = useState('');
  const [activeTab, setActiveTab]               = useState('check');
  const [isLoading, setIsLoading]               = useState(false);
  const [isArchiving, setIsArchiving]           = useState(false);
  const [isRestoring, setIsRestoring]           = useState(false);

  const [countedQty, setCountedQty] = useState({});
  const [checkDate, setCheckDate]   = useState({});
  const [soldTotals, setSoldTotals] = useState({});

  // Scanner
  const [scannerOpen, setScannerOpen]     = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [scanStatus, setScanStatus]       = useState('Align barcode within the frame.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanQty, setScanQty]             = useState('');
  const [scanDate, setScanDate]           = useState('');
  const scannerRef    = useRef(null);
  const codeReaderRef = useRef(null);
  const scanCoolRef   = useRef(null);

  // History
  const [historySearch, setHistorySearch]               = useState('');
  const [historySelectedProduct, setHistorySelectedProduct] = useState(null);
  const [productHistoryEntries, setProductHistoryEntries]   = useState([]);
  const [monthlySummary, setMonthlySummary]                 = useState([]);
  const [productHistoryLoading, setProductHistoryLoading]   = useState(false);
  const [historyDateFrom, setHistoryDateFrom]               = useState('');
  const [historyDateTo, setHistoryDateTo]                   = useState('');
  const [archivesData, setArchivesData]     = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveDetailLoading, setArchiveDetailLoading] = useState(false);
  const [archiveDetailView, setArchiveDetailView] = useState('products');
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');

  const [showZeroStock, setShowZeroStock] = useState(false);
  const [maghsalSearchTerm, setMaghsalSearchTerm] = useState('');

  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage]     = useState(null);

  useExpiryNotifications({ successMessage, errorMessage });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showSuccess = useCallback((msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  const showError = useCallback((msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 3000);
  }, []);

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const dateStrToISO = (dateStr) => {
    // Parse as local date at noon to avoid timezone shifting the day
    const d = new Date(`${dateStr}T12:00:00`);
    return isNaN(d) ? new Date().toISOString() : d.toISOString();
  };

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

  const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isStockLikeStatus = useCallback(
    (status) => String(status || '').toLowerCase().startsWith('stock'),
    []
  );

  const isMaghsal = useCallback(
    (product) => String(product?.productType || '').toLowerCase() === 'maghsal',
    []
  );

  const getProductKey = useCallback(
    (item = {}) => String(item.barcode || item.productId || '').trim(),
    []
  );

  const decodePushKeyTimestampMs = useCallback((pushKey) => {
    if (!pushKey || typeof pushKey !== 'string' || pushKey.length < 8) return null;
    const chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    let timestamp = 0;

    for (let i = 0; i < 8; i += 1) {
      const idx = chars.indexOf(pushKey[i]);
      if (idx < 0) return null;
      timestamp = (timestamp * 64) + idx;
    }

    return Number.isFinite(timestamp) ? timestamp : null;
  }, []);

  const getExpectedRemaining = useCallback((product, quantityOverride = null) => {
    const productId = typeof product === 'string' ? product : product?.id;
    const systemQty = quantityOverride == null
      ? toNumber(typeof product === 'string' ? 0 : product?.quantity)
      : toNumber(quantityOverride);
    return systemQty - toNumber(soldTotals[productId]);
  }, [soldTotals]);

  const hasPositiveExpectedStock = useCallback(
    (product) => getExpectedRemaining(product) > 0,
    [getExpectedRemaining]
  );

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

  const pushHistory = async (productId, productName, systemQty, counted, status, checkedAt) => {
    try {
      const iso = checkedAt || new Date().toISOString();
      const d   = new Date(iso);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      await push(ref(database, `stockCheckHistory/${monthKey}`), {
        productId, productName,
        systemQuantity: systemQty, countedQuantity: counted,
        status, checkedAt: iso,
      });
    } catch (err) { console.error('History write failed:', err); }
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
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
        setFilteredProducts(list);
      } else {
        setProducts([]); setFilteredProducts([]);
      }

      // Cutoff per product = date of last accurate stock check only.
      // No productCreatedAt or lastStockInAt — those caused silent exclusions of real sales.
      const lastCheckedAt = {};
      if (checkSnap.exists()) {
        const allChecks = Object.entries(checkSnap.val()).map(([id, v]) => ({ id, ...v }));
        allChecks.forEach(c => {
          const ts = c.reconfirmedAt || c.checkedAt;
          if (ts) lastCheckedAt[c.id] = new Date(ts);
        });
        setPendingChecks(allChecks.filter(c => c.status === 'pending'));
        setAllCheckedProductIds(new Set(allChecks.map(c => c.id)));
      } else {
        setPendingChecks([]);
        setAllCheckedProductIds(new Set());
      }

      // Build { [productKey]: qtySoldSinceLastCheck }.
      // "Since last check" uses the sale's actual dateScanned (not push-key write time).
      // If no stock check exists for a product, count ALL its sales.
      // If dateScanned is missing/invalid, count the item rather than silently skip it.
      if (soldSnap.exists()) {
        const totals = {};
        Object.entries(soldSnap.val()).forEach(([recordKey, item]) => {
          const productKey = getProductKey(item);
          if (!productKey || isStockLikeStatus(item.paymentStatus)) return;

          const qty = toNumber(item.quantity);
          if (qty <= 0) return;

          const cutoff = lastCheckedAt[productKey] || null;

          if (!cutoff) {
            // No stock check recorded — count every sale
            totals[productKey] = (totals[productKey] || 0) + qty;
            return;
          }

          // Use dateScanned (actual sale date) first; push-key write time as fallback
          const saleDateMs = new Date(item.dateScanned || '').getTime();
          if (!isNaN(saleDateMs)) {
            if (saleDateMs > cutoff.getTime()) {
              totals[productKey] = (totals[productKey] || 0) + qty;
            }
            return;
          }

          // dateScanned missing — fall back to push-key write time
          const pushKeyMs = decodePushKeyTimestampMs(recordKey);
          if (pushKeyMs != null) {
            if (pushKeyMs > cutoff.getTime()) {
              totals[productKey] = (totals[productKey] || 0) + qty;
            }
          } else {
            // Can't determine date at all — count the item to avoid silent exclusion
            totals[productKey] = (totals[productKey] || 0) + qty;
          }
        });
        setSoldTotals(totals);
      } else {
        setSoldTotals({});
      }

    } catch (err) { console.error(err); showError('Error loading data.'); }
    finally { setIsLoading(false); }
  }, [showError, getProductKey, isStockLikeStatus, decodePushKeyTimestampMs]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    // Maghsal products are shown in their own dedicated tab, not in Check Stock / Pending.
    const baseProducts = showZeroStock
      ? products.filter(p => !isMaghsal(p) && getExpectedRemaining(p) <= 0)
      : products.filter(p => !isMaghsal(p) && hasPositiveExpectedStock(p));
    if (!searchTerm.trim()) { setFilteredProducts(baseProducts); return; }
    const t = searchTerm.toLowerCase();
    setFilteredProducts(baseProducts.filter(p =>
      p.name?.toLowerCase().includes(t) || p.id?.toLowerCase().includes(t) || p.productType?.toLowerCase().includes(t)
    ));
  }, [searchTerm, products, showZeroStock, getExpectedRemaining, hasPositiveExpectedStock, isMaghsal]);

  // ── History fetch ──────────────────────────────────────────────────────────

  const fetchProductHistory = useCallback(async (product) => {
    setProductHistoryLoading(true);
    setProductHistoryEntries([]);
    setMonthlySummary([]);
    try {
      const [soldSnap, txSnap, historySnap] = await Promise.all([
        get(ref(database, 'SoldItems')),
        get(ref(database, 'transactions')),
        get(ref(database, 'stockCheckHistory')),
      ]);

      const events = [];

      // All sales for this product
      if (soldSnap.exists()) {
        Object.values(soldSnap.val()).forEach(item => {
          if (isStockLikeStatus(item.paymentStatus)) return;
          if (item.barcode !== product.id && item.productId !== product.id) return;
          events.push({
            date: item.dateScanned || item.createdAt || null,
            type: 'Sale',
            qty: -(toNumber(item.quantity)),
            paymentStatus: item.paymentStatus,
            isCheckEvent: false,
          });
        });
      }

      // All restocks (transactions) for this product — all statuses
      if (txSnap.exists()) {
        Object.values(txSnap.val()).forEach(tx => {
          if (tx.barcode !== product.id && tx.productId !== product.id) return;
          events.push({
            date: tx.dateScanned || null,
            type: 'Restock',
            qty: toNumber(tx.quantity),
            paymentStatus: tx.paymentStatus,
            isCheckEvent: false,
          });
        });
      }

      // History events: stock checks, inaccurate checks, held, restored, deleted
      if (historySnap.exists()) {
        Object.values(historySnap.val()).forEach(monthData => {
          if (!monthData || typeof monthData !== 'object') return;
          Object.values(monthData).forEach(entry => {
            if (entry.productId !== product.id) return;
            if (entry.status === 'accurate') {
              events.push({
                date: entry.checkedAt,
                type: 'Stock Check',
                qty: null,
                setTo: toNumber(entry.countedQuantity),
                paymentStatus: null,
                isCheckEvent: true,
                isInfoEvent: false,
              });
            } else if (entry.status === 'inaccurate') {
              events.push({
                date: entry.checkedAt,
                type: 'Inaccurate Check',
                qty: 0,
                note: `System: ${entry.systemQuantity ?? '?'}, Counted: ${entry.countedQuantity ?? '?'}`,
                paymentStatus: null,
                isCheckEvent: false,
                isInfoEvent: true,
              });
            } else if (entry.status === 'held') {
              events.push({
                date: entry.checkedAt,
                type: 'Held',
                qty: 0,
                paymentStatus: null,
                isCheckEvent: false,
                isInfoEvent: true,
              });
            } else if (entry.status === 'restored') {
              events.push({
                date: entry.checkedAt,
                type: 'Restored',
                qty: 0,
                paymentStatus: null,
                isCheckEvent: false,
                isInfoEvent: true,
              });
            } else if (entry.status === 'deleted') {
              events.push({
                date: entry.checkedAt,
                type: 'Deleted',
                qty: 0,
                paymentStatus: null,
                isCheckEvent: false,
                isInfoEvent: true,
              });
            }
          });
        });
      }

      // Sort all events ascending by date
      events.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

      // Determine starting balance.
      // If we have stock check anchors, start from 0 and let the first check reset it.
      // If no checks, use product.quantity as the known current baseline and walk backwards
      // to find the initial balance: initialQty = product.quantity + allSales - allRestocks.
      const hasChecks = events.some(e => e.isCheckEvent);
      let balance = 0;
      let balanceKnown = false;
      if (!hasChecks) {
        const totalSales    = events.filter(e => e.type === 'Sale').reduce((s, e) => s + Math.abs(e.qty), 0);
        const totalRestocks = events.filter(e => e.type === 'Restock').reduce((s, e) => s + e.qty, 0);
        balance = toNumber(product.quantity) + totalSales - totalRestocks;
        balanceKnown = true;
      }

      // Forward walk — compute stockAfter and balanceBefore for every event
      const walked = events.map(event => {
        const balanceBefore = balance;
        if (event.isCheckEvent) {
          balance = event.setTo;
          balanceKnown = true;
        } else if (!event.isInfoEvent) {
          balance += (event.qty || 0);
        }
        return { ...event, balanceBefore, stockAfter: balance, balanceKnown };
      });

      // Build monthly summary
      const monthMap = {};
      walked.forEach(event => {
        if (!event.date) return;
        const d = new Date(event.date);
        if (isNaN(d.getTime())) return;
        const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!monthMap[key]) {
          monthMap[key] = { key, label, openingStock: event.balanceBefore, openingKnown: !event.isCheckEvent && event.balanceKnown, sold: 0, restocked: 0, closingStock: event.stockAfter, closingKnown: event.balanceKnown };
        } else {
          monthMap[key].closingStock = event.stockAfter;
          monthMap[key].closingKnown = event.balanceKnown;
        }
        if (event.type === 'Sale')    monthMap[key].sold      += Math.abs(event.qty || 0);
        if (event.type === 'Restock') monthMap[key].restocked += (event.qty || 0);
      });

      setMonthlySummary(Object.values(monthMap).sort((a, b) => b.key.localeCompare(a.key)));

      // Reverse for newest-first display
      walked.reverse();
      setProductHistoryEntries(walked);
    } catch (err) { console.error(err); showError('Failed to load product history.'); }
    finally { setProductHistoryLoading(false); }
  }, [showError, isStockLikeStatus]);

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
  }, [showError]);

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
  }, [showError]);

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
  
  
  useEffect(() => {
    if (!scannerOpen || scannerPaused) return;

    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    codeReader.decodeFromVideoDevice(null, scannerRef.current, (result) => {
      if (!result) return;
      if (scanCoolRef.current) return;
      scanCoolRef.current = setTimeout(() => { scanCoolRef.current = null; }, 2500);

      const barcode = result.getText();
      const found = products.find(p => p.id === barcode);
      if (found) {
        setScannerPaused(true);
        setScannedProduct(found);
        setScanQty('');
        setScanStatus(`Found: ${found.name}`);
      } else {
        setScanStatus(`Barcode "${barcode}" not found in products.`);
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
      setScannerPaused(false); setScannedProduct(null); setScanQty(''); setScanDate('');
      setScanStatus('Align barcode within the frame.');
    }
  }, [scannerOpen]);

  // ── Actions: scan modal ────────────────────────────────────────────────────

  const handleScanAccurate = async () => {
    const counted = parseFloat(scanQty);
    if (isNaN(counted) || scanQty === '') { showError('Enter a counted quantity first.'); return; }
    try {
      const expectedQty = getExpectedRemaining(scannedProduct);
      await update(ref(database, `products/${scannedProduct.id}`), { quantity: counted });
      const checkedAt = dateStrToISO(scanDate || todayStr());
      await update(ref(database, `stockChecks/${scannedProduct.id}`), {
        productName: scannedProduct.name, systemQuantity: expectedQty,
        countedQuantity: counted, status: 'accurate', checkedAt,
      });
      await pushHistory(scannedProduct.id, scannedProduct.name, expectedQty, counted, 'accurate', checkedAt);
      setProducts(prev => prev.map(p => p.id === scannedProduct.id ? { ...p, quantity: counted } : p));
      setSoldTotals(prev => { const n = { ...prev }; delete n[scannedProduct.id]; return n; });
      setAllCheckedProductIds(prev => new Set([...prev, scannedProduct.id]));
      showSuccess(`✓ "${scannedProduct.name}" updated to ${counted}.`);
      setScannedProduct(null); setScanQty(''); setScanDate(''); setScannerPaused(false);
      setScanStatus('Align barcode within the frame.');
    } catch (err) { console.error(err); showError('Failed to update.'); }
  };

  const handleScanInaccurate = async () => {
    const counted = parseFloat(scanQty);
    if (isNaN(counted) || scanQty === '') { showError('Enter a counted quantity first.'); return; }
    try {
      const expectedQty = getExpectedRemaining(scannedProduct);
      const checkedAt = dateStrToISO(scanDate || todayStr());
      const checkData = {
        productName: scannedProduct.name, systemQuantity: expectedQty,
        countedQuantity: counted, status: 'pending', checkedAt,
      };
      await update(ref(database, `stockChecks/${scannedProduct.id}`), checkData);
      await pushHistory(scannedProduct.id, scannedProduct.name, expectedQty, counted, 'inaccurate', checkedAt);
      setPendingChecks(prev => {
        const exists = prev.find(c => c.id === scannedProduct.id);
        if (exists) return prev.map(c => c.id === scannedProduct.id ? { id: scannedProduct.id, ...checkData } : c);
        return [...prev, { id: scannedProduct.id, ...checkData }];
      });
      setAllCheckedProductIds(prev => new Set([...prev, scannedProduct.id]));
      showSuccess(`"${scannedProduct.name}" flagged for reconfirmation.`);
      setScannedProduct(null); setScanQty(''); setScanDate(''); setScannerPaused(false);
      setScanStatus('Align barcode within the frame.');
    } catch (err) { console.error(err); showError('Failed to save.'); }
  };

  // ── Actions: delete ───────────────────────────────────────────────────────

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}" permanently? This will remove the product plus all its transactions, sold records, and stock history.`)) return;
    try {
      // Write deletion event first so the audit trail survives the history cleanup below.
      await pushHistory(product.id, product.name, toNumber(product.quantity), toNumber(product.quantity), 'deleted', new Date().toISOString());

      const [soldSnap, txSnap, historySnap] = await Promise.all([
        get(ref(database, 'SoldItems')),
        get(ref(database, 'transactions')),
        get(ref(database, 'stockCheckHistory')),
      ]);

      const updates = {};
      updates[`products/${product.id}`] = null;
      updates[`stockChecks/${product.id}`] = null;

      if (soldSnap.exists()) {
        Object.entries(soldSnap.val()).forEach(([key, item]) => {
          if (item.barcode === product.id || item.productId === product.id) {
            updates[`SoldItems/${key}`] = null;
          }
        });
      }

      if (txSnap.exists()) {
        Object.entries(txSnap.val()).forEach(([key, tx]) => {
          if (tx.barcode === product.id || tx.productId === product.id) {
            updates[`transactions/${key}`] = null;
          }
        });
      }

      if (historySnap.exists()) {
        Object.entries(historySnap.val()).forEach(([month, monthData]) => {
          if (!monthData || typeof monthData !== 'object') return;
          Object.entries(monthData).forEach(([key, entry]) => {
            // Keep 'deleted' events so the audit trail is preserved even after deletion.
            if (entry.productId === product.id && entry.status !== 'deleted') {
              updates[`stockCheckHistory/${month}/${key}`] = null;
            }
          });
        });
      }

      await update(ref(database), updates);

      setProducts(prev => prev.filter(p => p.id !== product.id));
      setPendingChecks(prev => prev.filter(c => c.id !== product.id));
      showSuccess(`"${product.name}" and all its data deleted.`);
    } catch (err) { console.error(err); showError('Failed to delete product.'); }
  };

  // ── Actions: hold ─────────────────────────────────────────────────────────

  const handleHoldProduct = async (product) => {
    if (!window.confirm(`Hold "${product.name}"? It will move to the Held section in Product Management.`)) return;
    try {
      const heldAt = new Date().toISOString();
      await pushHistory(product.id, product.name, toNumber(product.quantity), toNumber(product.quantity), 'held', heldAt);
      await set(ref(database, `heldProducts/${product.id}`), {
        name: product.name || '',
        productType: product.productType || '',
        itemCost: product.itemCost || 0,
        purchasingPrice: product.purchasingPrice || 0,
        quantity: product.quantity || 0,
        heldDate: heldAt,
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
      const expectedQty = getExpectedRemaining(product);
      await update(ref(database, `products/${product.id}`), { quantity: counted });
      const checkedAt = dateStrToISO(checkDate[product.id] || todayStr());
      await update(ref(database, `stockChecks/${product.id}`), {
        productName: product.name, systemQuantity: expectedQty,
        countedQuantity: counted, status: 'accurate', checkedAt,
      });
      await pushHistory(product.id, product.name, expectedQty, counted, 'accurate', checkedAt);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: counted } : p));
      setSoldTotals(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      setCountedQty(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      setCheckDate(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      setAllCheckedProductIds(prev => new Set([...prev, product.id]));
      showSuccess(`✓ "${product.name}" updated to ${counted}.`);
    } catch (err) { console.error(err); showError('Failed to update stock.'); }
  };

  const handleInaccurate = async (product) => {
    const counted = parseFloat(countedQty[product.id]);
    if (!countedQty[product.id] || isNaN(counted)) { showError(`Enter a counted qty for "${product.name}" first.`); return; }
    try {
      const expectedQty = getExpectedRemaining(product);
      const checkedAt = dateStrToISO(checkDate[product.id] || todayStr());
      const checkData = {
        productName: product.name, systemQuantity: expectedQty,
        countedQuantity: counted, status: 'pending', checkedAt,
      };
      await update(ref(database, `stockChecks/${product.id}`), checkData);
      await pushHistory(product.id, product.name, expectedQty, counted, 'inaccurate', checkedAt);
      setPendingChecks(prev => {
        const exists = prev.find(c => c.id === product.id);
        if (exists) return prev.map(c => c.id === product.id ? { id: product.id, ...checkData } : c);
        return [...prev, { id: product.id, ...checkData }];
      });
      setAllCheckedProductIds(prev => new Set([...prev, product.id]));
      setCountedQty(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      setCheckDate(prev => { const n = { ...prev }; delete n[product.id]; return n; });
      showSuccess(`"${product.name}" flagged for reconfirmation.`);
    } catch (err) { console.error(err); showError('Failed to save check.'); }
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
      setAllCheckedProductIds(new Set());
      setCountedQty({});
      setCheckDate({});
      setSoldTotals({});
      setProductHistoryEntries([]);
      setHistorySelectedProduct(null);
      setHistorySearch('');
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
            <IconArchive /> {isArchiving ? 'Archiving...' : 'Archive & Reset Qty'}
          </button>
          <button onClick={() => setScannerOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCamera /> Scan Barcode
          </button>
          <button onClick={fetchData} className={`btn-secondary ${isLoading ? 'refreshing' : ''}`} disabled={isLoading}>
            <IconRefresh /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ margin: '12px 0' }}>
        <input
          type="text"
          placeholder="Search by name, barcode or type..."
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
                  const totalSold        = toNumber(soldTotals[product.id]);
                  const currentStock     = toNumber(product.quantity);
                  const expectedRemaining = getExpectedRemaining(product, currentStock);
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
                        <input
                          type="date" value={checkDate[product.id] ?? ''}
                          max={todayStr()}
                          onChange={e => setCheckDate(prev => ({ ...prev, [product.id]: e.target.value }))}
                          style={{ marginTop: 4, width: 90, padding: '2px 4px', borderRadius: 4, border: `1px solid ${checkDate[product.id] ? '#ccc' : '#dc3545'}`, fontSize: 11 }}
                          title="Select the date you physically checked this product"
                        />
                      </td>
                      <td>
                        {isPending
                          ? <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}><IconAlertTriangle /> Pending</span>
                          : <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}><IconCheck /> OK</span>}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-small btn-success" onClick={() => handleAccurate(product)} disabled={!checkDate[product.id]}><IconCheck /> Accurate</button>
                          <button className="btn-small btn-danger" onClick={() => handleInaccurate(product)} disabled={!checkDate[product.id]}><IconXCircle /> Inaccurate</button>
                          <button className="btn-small btn-warning" onClick={() => handleHoldProduct(product)}><IconPause /> Hold</button>
                          <button className="btn-small btn-danger" onClick={() => handleDeleteProduct(product)}><IconX /> Delete</button>
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
              <div className="empty-icon"><IconPackage /></div>
              <p>No products found{searchTerm ? ` for "${searchTerm}"` : ''}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Render: Pending tab ────────────────────────────────────────────────────

  const renderPendingTab = () => {
    const pendingProductIds = new Set(pendingChecks.map(c => c.id));
    const pendingProducts = products.filter(
      p => pendingProductIds.has(p.id) || !allCheckedProductIds.has(p.id)
    );
    const inaccurateCount = pendingChecks.length;
    const uncheckedCount  = products.filter(p => !allCheckedProductIds.has(p.id)).length;

    return (
      <div>
        <div className="header-section">
          <div className="header-left">
            <h2 className="section-title">Pending Review</h2>
            <div className="stats-badge" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>{pendingProducts.length} Items</div>
            {inaccurateCount > 0 && (
              <div className="stats-badge" style={{ backgroundColor: '#fde8e8', color: '#c0392b', marginLeft: 8 }}>{inaccurateCount} Inaccurate</div>
            )}
            {uncheckedCount > 0 && (
              <div className="stats-badge" style={{ backgroundColor: '#e8f0fe', color: '#1a56db', marginLeft: 8 }}>{uncheckedCount} Not Checked</div>
            )}
          </div>
          <div className="header-right">
            <button onClick={fetchData} className="btn-secondary" disabled={isLoading}><IconRefresh /> {isLoading ? 'Loading...' : 'Refresh'}</button>
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
                  {pendingProducts.map(product => {
                    const isPending         = pendingProductIds.has(product.id);
                    const inputVal          = countedQty[product.id] ?? '';
                    const totalSold         = toNumber(soldTotals[product.id]);
                    const currentStock      = toNumber(product.quantity);
                    const expectedRemaining = getExpectedRemaining(product, currentStock);
                    const hasDiff           = inputVal !== '' && parseFloat(inputVal) !== expectedRemaining;
                    return (
                      <tr key={product.id} style={{ backgroundColor: isPending ? '#fffbeb' : '#f0f4ff' }}>
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
                          <input
                            type="date" value={checkDate[product.id] ?? ''}
                            max={todayStr()}
                            onChange={e => setCheckDate(prev => ({ ...prev, [product.id]: e.target.value }))}
                            style={{ marginTop: 4, width: 90, padding: '2px 4px', borderRadius: 4, border: `1px solid ${checkDate[product.id] ? '#ccc' : '#dc3545'}`, fontSize: 11 }}
                            title="Select the date you physically checked this product"
                          />
                        </td>
                        <td>
                          {isPending
                            ? <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}><IconAlertTriangle /> Inaccurate</span>
                            : <span style={{ backgroundColor: '#e8f0fe', color: '#1a56db', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}><IconPackage /> Not Checked</span>}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-small btn-success" onClick={() => handleAccurate(product)} disabled={!checkDate[product.id]}><IconCheck /> Accurate</button>
                            <button className="btn-small btn-danger" onClick={() => handleInaccurate(product)} disabled={!checkDate[product.id]}><IconXCircle /> Inaccurate</button>
                            <button className="btn-small btn-warning" onClick={() => handleHoldProduct(product)}><IconPause /> Hold</button>
                            <button className="btn-small btn-danger" onClick={() => handleDeleteProduct(product)}><IconX /> Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pendingProducts.length === 0 && !isLoading && (
              <div className="empty-table">
                <div className="empty-icon"><IconCheckCircle /></div>
                <p>All products checked and confirmed!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: History tab ────────────────────────────────────────────────────

  const renderHistoryTab = () => {
    const searchText = historySearch.trim().toLowerCase();
    const suggestions = searchText
      ? products.filter(p =>
          p.name?.toLowerCase().includes(searchText) ||
          p.id?.toLowerCase().includes(searchText)
        )
      : [];

    const fromMs = historyDateFrom ? new Date(historyDateFrom).setHours(0, 0, 0, 0) : null;
    const toMs   = historyDateTo   ? new Date(historyDateTo).setHours(23, 59, 59, 999) : null;
    const displayedEntries = productHistoryEntries.filter(entry => {
      const t = new Date(entry.date || 0).getTime();
      if (fromMs && t < fromMs) return false;
      if (toMs   && t > toMs)   return false;
      return true;
    });

    const totalSoldAllTime     = monthlySummary.reduce((s, m) => s + m.sold, 0);
    const totalRestockedAllTime = monthlySummary.reduce((s, m) => s + m.restocked, 0);
    const expectedNow          = historySelectedProduct ? getExpectedRemaining(historySelectedProduct) : 0;

    const qtyBadge = (val, color) => (
      <span style={{ fontWeight: 700, fontSize: 18, color }}>{val}</span>
    );

    return (
      <div>
        {/* Search */}
        <div style={{ margin: '12px 0', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search product by name or barcode..."
            value={historySearch}
            onChange={e => {
              setHistorySearch(e.target.value);
              setHistorySelectedProduct(null);
              setProductHistoryEntries([]);
              setMonthlySummary([]);
            }}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' }}
          />
          {suggestions.length > 0 && !historySelectedProduct && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 6, zIndex: 100, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {suggestions.map(p => (
                <div
                  key={p.id}
                  onClick={() => { setHistorySelectedProduct(p); setHistorySearch(p.name); fetchProductHistory(p); }}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: 14 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <strong>{p.name}</strong>
                  <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>— {p.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!historySelectedProduct && (
          <div className="empty-table">
            <div className="empty-icon"><IconSearch /></div>
            <p>Search for a product above to view its full history.</p>
          </div>
        )}

        {historySelectedProduct && productHistoryLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: '#888' }}><IconRefresh /> Loading history...</div>
        )}

        {historySelectedProduct && !productHistoryLoading && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 140, background: '#f8f9fa', borderRadius: 10, padding: '12px 16px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Product</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{historySelectedProduct.name}</div>
                <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{historySelectedProduct.id}</div>
              </div>
              <div style={{ minWidth: 120, background: '#fff', borderRadius: 10, padding: '12px 16px', border: '2px solid #198754' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Current Stock</div>
                {qtyBadge(expectedNow, expectedNow > 0 ? '#198754' : '#dc3545')}
              </div>
              <div style={{ minWidth: 120, background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Total Sold (all time)</div>
                {qtyBadge(totalSoldAllTime, '#dc3545')}
              </div>
              <div style={{ minWidth: 120, background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Total Restocked (all time)</div>
                {qtyBadge(totalRestockedAllTime, '#0d6efd')}
              </div>
            </div>

            {/* Monthly summary table */}
            {monthlySummary.length > 0 && (
              <div className="table-section" style={{ marginBottom: 16 }}>
                <div className="table-card">
                  <div style={{ padding: '10px 16px 4px', fontWeight: 700, fontSize: 14 }}>Monthly Breakdown</div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th className="text-right">Opening Stock</th>
                          <th className="text-right">Restocked</th>
                          <th className="text-right">Sold</th>
                          <th className="text-right">Closing Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySummary.map(m => (
                          <tr key={m.key}>
                            <td><span style={{ fontWeight: 600 }}>{m.label}</span></td>
                            <td className="text-right">
                              <span style={{ color: '#555' }}>{m.openingKnown ? m.openingStock : '—'}</span>
                            </td>
                            <td className="text-right">
                              <span style={{ color: m.restocked > 0 ? '#0d6efd' : '#aaa', fontWeight: m.restocked > 0 ? 700 : 400 }}>
                                {m.restocked > 0 ? `+${m.restocked}` : '—'}
                              </span>
                            </td>
                            <td className="text-right">
                              <span style={{ color: m.sold > 0 ? '#dc3545' : '#aaa', fontWeight: m.sold > 0 ? 700 : 400 }}>
                                {m.sold > 0 ? m.sold : '—'}
                              </span>
                            </td>
                            <td className="text-right">
                              <span style={{ fontWeight: 700, color: m.closingKnown ? (m.closingStock > 0 ? '#198754' : '#dc3545') : '#aaa' }}>
                                {m.closingKnown ? m.closingStock : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Date filter for event timeline */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Filter Events:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>From</label>
                <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>To</label>
                <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }} />
              </div>
              {(historyDateFrom || historyDateTo) && (
                <button className="btn-secondary" onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }} style={{ fontSize: 13 }}>
                  <IconX /> Clear
                </button>
              )}
              <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>{displayedEntries.length} of {productHistoryEntries.length} events</span>
            </div>

            {/* Full event timeline */}
            <div className="table-section">
              <div className="table-card">
                <div className="table-container">
                  {displayedEntries.length === 0 ? (
                    <div className="empty-table">
                      <div className="empty-icon"><IconClipboard /></div>
                      <p>No events found{(historyDateFrom || historyDateTo) ? ' for this date range' : ' for this product'}.</p>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th className="text-right">Qty Change</th>
                          <th className="text-right">Stock After</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedEntries.map((entry, i) => {
                          const rowBg = entry.isCheckEvent
                            ? '#e8f5e9'
                            : entry.type === 'Held' ? '#fff8e1'
                            : entry.type === 'Deleted' ? '#fdecea'
                            : entry.type === 'Restored' ? '#e8f0fe'
                            : entry.type === 'Inaccurate Check' ? '#fff3cd'
                            : undefined;

                          const typeBadge = () => {
                            if (entry.isCheckEvent)
                              return <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#d4edda', color: '#155724' }}><IconCheck /> Stock Check</span>;
                            if (entry.type === 'Sale')
                              return <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#fde8e8', color: '#c0392b' }}><IconArrowUp /> Sale</span>;
                            if (entry.type === 'Restock')
                              return <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#e8f0fe', color: '#1a56db' }}><IconArrowDown /> Restock</span>;
                            if (entry.type === 'Held')
                              return <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#fff8e1', color: '#b45309' }}><IconPause /> Held</span>;
                            if (entry.type === 'Restored')
                              return <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#e8f0fe', color: '#1a56db' }}><IconCornerUpLeft /> Restored</span>;
                            if (entry.type === 'Deleted')
                              return <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#fdecea', color: '#c0392b' }}><IconX /> Deleted</span>;
                            if (entry.type === 'Inaccurate Check')
                              return <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: '#fff3cd', color: '#856404' }}><IconAlertTriangle /> Inaccurate Check</span>;
                            return null;
                          };

                          return (
                          <tr key={i} style={{ backgroundColor: rowBg }}>
                            <td><span className="date-cell">{formatDate(entry.date)}</span></td>
                            <td>{typeBadge()}</td>
                            <td className="text-right">
                              {entry.isCheckEvent ? (
                                <span style={{ color: '#155724', fontWeight: 700 }}>Set to {entry.setTo}</span>
                              ) : entry.isInfoEvent ? (
                                <span style={{ color: '#888', fontSize: 12 }}>{entry.note || '—'}</span>
                              ) : (
                                <span style={{ color: entry.qty < 0 ? '#dc3545' : '#0d6efd', fontWeight: 700 }}>
                                  {entry.qty > 0 ? '+' : ''}{entry.qty}
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              {entry.isInfoEvent ? (
                                <span style={{ color: '#aaa' }}>—</span>
                              ) : entry.balanceKnown ? (
                                <span style={{ fontWeight: 600, color: entry.stockAfter <= 0 ? '#dc3545' : '#198754' }}>
                                  {entry.stockAfter}
                                </span>
                              ) : (
                                <span style={{ color: '#aaa' }}>—</span>
                              )}
                            </td>
                            <td>
                              {entry.paymentStatus && (
                                <span className={`status-badge status-${entry.paymentStatus?.toLowerCase()}`}>
                                  {entry.paymentStatus}
                                </span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
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
              <div className="empty-icon"><IconSearch /></div>
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
              <div className="empty-icon"><IconSearch /></div>
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
              <div className="empty-icon"><IconSearch /></div>
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
            <div className="empty-icon"><IconSearch /></div>
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
              {archivesLoading ? <><IconRefresh /> Loading...</> : <><IconRefresh /> Refresh</>}
            </button>
          </div>
        </div>

        <div className="archive-layout">
          <div className="table-section" style={{ marginTop: 0 }}>
            <div className="table-card">
              <div className="table-container archive-table-container">
                {archivesLoading ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#888' }}><IconRefresh /> Loading archives...</div>
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
                  <div className="empty-icon"><IconArchive /></div>
                  <p>No archives found yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="table-section" style={{ marginTop: 0 }}>
            <div className="table-card">
              {archiveDetailLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#888' }}><IconRefresh /> Loading archive details...</div>
              ) : !selectedArchive ? (
                <div className="empty-table">
                  <div className="empty-icon"><IconFolderOpen /></div>
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
                      <IconRefresh /> {isRestoring ? 'Restoring...' : 'Restore This Archive'}
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
                            <IconX />
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

  // ── Render: Maghsal tab ───────────────────────────────────────────────────

  const renderMaghsalTab = () => {
    const allMaghsal = products.filter(isMaghsal);
    const t = maghsalSearchTerm.trim().toLowerCase();
    const displayed = t
      ? allMaghsal.filter(p =>
          p.name?.toLowerCase().includes(t) ||
          p.id?.toLowerCase().includes(t)
        )
      : allMaghsal;

    const maghsalPendingIds = new Set(pendingChecks.filter(c => allMaghsal.some(p => p.id === c.id)).map(c => c.id));

    return (
      <div>
        <div className="header-section">
          <div className="header-left">
            <h2 className="section-title">Maghsal Stock</h2>
            <div className="stats-badge">{allMaghsal.length} Products</div>
            {maghsalPendingIds.size > 0 && (
              <div className="stats-badge" style={{ backgroundColor: '#fff3cd', color: '#856404', marginLeft: 8 }}>
                {maghsalPendingIds.size} Pending
              </div>
            )}
          </div>
          <div className="header-right">
            <button onClick={fetchData} className={`btn-secondary ${isLoading ? 'refreshing' : ''}`} disabled={isLoading}>
              <IconRefresh /> {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={{ margin: '12px 0' }}>
          <input
            type="text"
            placeholder="Search Maghsal products..."
            value={maghsalSearchTerm}
            onChange={e => setMaghsalSearchTerm(e.target.value)}
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
                    <th className="text-right">Current Stock</th>
                    <th className="text-right" title="Sold since last stock check">Sold Since Check</th>
                    <th className="text-right">Expected Remaining</th>
                    <th className="text-right">Counted Qty</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(product => {
                    const isPending         = maghsalPendingIds.has(product.id);
                    const inputVal          = countedQty[product.id] ?? '';
                    const totalSold         = toNumber(soldTotals[product.id]);
                    const currentStock      = toNumber(product.quantity);
                    const expectedRemaining = getExpectedRemaining(product, currentStock);
                    const hasDiff           = inputVal !== '' && parseFloat(inputVal) !== expectedRemaining;
                    return (
                      <tr key={product.id} style={isPending ? { backgroundColor: '#fffbeb' } : {}}>
                        <td><span className="barcode-cell">{product.id}</span></td>
                        <td><span className="product-name-cell">{product.name}</span></td>
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
                          <input
                            type="date" value={checkDate[product.id] ?? ''}
                            max={todayStr()}
                            onChange={e => setCheckDate(prev => ({ ...prev, [product.id]: e.target.value }))}
                            style={{ marginTop: 4, width: 90, padding: '2px 4px', borderRadius: 4, border: `1px solid ${checkDate[product.id] ? '#ccc' : '#dc3545'}`, fontSize: 11 }}
                          />
                        </td>
                        <td>
                          {isPending
                            ? <span style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}><IconAlertTriangle /> Pending</span>
                            : <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}><IconCheck /> OK</span>}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-small btn-success" onClick={() => handleAccurate(product)} disabled={!checkDate[product.id]}><IconCheck /> Accurate</button>
                            <button className="btn-small btn-danger" onClick={() => handleInaccurate(product)} disabled={!checkDate[product.id]}><IconXCircle /> Inaccurate</button>
                            <button className="btn-small btn-warning" onClick={() => handleHoldProduct(product)}><IconPause /> Hold</button>
                            <button className="btn-small btn-danger" onClick={() => handleDeleteProduct(product)}><IconX /> Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {displayed.length === 0 && !isLoading && (
              <div className="empty-table">
                <div className="empty-icon"><IconPackage /></div>
                <p>{allMaghsal.length === 0 ? 'No Maghsal products found.' : `No products match "${maghsalSearchTerm}".`}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Scanner modal ──────────────────────────────────────────────────

  const renderScannerModal = () => {
    const systemQty = scannedProduct ? toNumber(scannedProduct.quantity) : 0;
    const soldSinceCheck = scannedProduct ? toNumber(soldTotals[scannedProduct.id]) : 0;
    const expectedQty = scannedProduct ? getExpectedRemaining(scannedProduct, systemQty) : 0;
    const enteredQty = toNumber(scanQty);
    const hasEnteredQty = scanQty !== '' && !Number.isNaN(parseFloat(scanQty));
    const qtyDiff = enteredQty - expectedQty;

    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: 460 }}>
          <div className="modal-header">
            <h3 className="modal-title"><IconCamera /> Scan Product Barcode</h3>
            <button className="modal-close" onClick={() => setScannerOpen(false)}><IconX /></button>
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
                    <div style={{ fontSize: 12, color: '#888' }}>Expected Qty</div>
                    <div style={{ fontWeight: 700, fontSize: 22, color: expectedQty < 0 ? '#dc3545' : '#198754' }}>{expectedQty}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      System {systemQty} • Sold {soldSinceCheck}
                    </div>
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
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, marginTop: 12 }}>
                  Check Date <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}>(optional — defaults to today)</span>
                </label>
                <input
                  type="date"
                  value={scanDate}
                  max={todayStr()}
                  onChange={e => setScanDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box' }}
                />

                {hasEnteredQty && (
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: qtyDiff === 0 ? '#198754' : '#dc3545' }}>
                    {qtyDiff === 0
                      ? 'Matches expected quantity'
                      : `Δ ${qtyDiff > 0 ? '+' : ''}${qtyDiff} vs expected`}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn-small btn-success" style={{ flex: 1, padding: '8px 0' }} onClick={handleScanAccurate} disabled={!scanDate}><IconCheck /> Accurate</button>
                  <button className="btn-small btn-danger" style={{ flex: 1, padding: '8px 0' }} onClick={handleScanInaccurate} disabled={!scanDate}><IconXCircle /> Inaccurate</button>
                </div>

                <button
                  onClick={() => { setScannedProduct(null); setScanQty(''); setScannerPaused(false); setScanStatus('Align barcode within the frame.'); }}
                  style={{ marginTop: 8, width: '100%', padding: '6px 0', background: 'none', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#666' }}
                >
                  <IconCornerUpLeft /> Scan a different product
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
  };

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <div className="admin-container">
      <div className="page-header">
        <h1 className="page-title">Stock Checker</h1>
        <p className="page-subtitle">Scan barcodes, count stock, archive old data, and review history</p>
      </div>

      {successMessage && <div className="success-message"><span className="message-icon"><IconCheck /></span>{successMessage}</div>}
      {errorMessage   && <div className="error-message"><span className="message-icon"><IconAlertTriangle /></span>{errorMessage}</div>}

      <div className="tab-navigation">
        <button onClick={() => setActiveTab('check')}   className={`tab-button ${activeTab === 'check'   ? 'active' : ''}`}>
          <span className="tab-icon"><IconSearch /></span><span className="tab-label">Check Stock</span>
        </button>
        <button onClick={() => setActiveTab('pending')} className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}>
          <span className="tab-icon"><IconAlertTriangle /></span><span className="tab-label">Pending</span>
        </button>
        <button onClick={() => setActiveTab('maghsal')} className={`tab-button ${activeTab === 'maghsal' ? 'active' : ''}`}
          style={{ borderColor: activeTab === 'maghsal' ? '#0d6efd' : undefined }}>
          <span className="tab-icon"><IconPackage /></span>
          <span className="tab-label">Maghsal ({products.filter(isMaghsal).length})</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}>
          <span className="tab-icon"><IconCalendar /></span><span className="tab-label">History</span>
        </button>
        <button onClick={() => setActiveTab('archives')} className={`tab-button ${activeTab === 'archives' ? 'active' : ''}`}>
          <span className="tab-icon"><IconArchive /></span><span className="tab-label">Archives</span>
        </button>
        <button onClick={() => setShowZeroStock(prev => !prev)} className={`tab-button ${showZeroStock ? 'active' : ''}`}>
          <span className="tab-icon"><IconPackage /></span><span className="tab-label">Zero Stock</span>
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'check'    && renderCheckTab()}
        {activeTab === 'pending'  && renderPendingTab()}
        {activeTab === 'maghsal'  && renderMaghsalTab()}
        {activeTab === 'history'  && renderHistoryTab()}
        {activeTab === 'archives' && renderArchivesTab()}
      </div>

      {scannerOpen && renderScannerModal()}
    </div>
  );
};

export default RemainingProducts;
