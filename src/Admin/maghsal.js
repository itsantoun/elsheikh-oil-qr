import React, { useState, useEffect, useContext, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { database } from '../Auth/firebase';
import { ref, update, onValue, push } from 'firebase/database';
import { UserContext } from '../Auth/userContext';
import '../CSS/soldItems.css';
import { IconRefresh, IconX, IconPlus } from '../utils/icons';
import PageHeader from '../Components/PageHeader';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { saveBlobToExportFolder } from '../utils/exportFolder';
import { findSiblingBatches, pickFifoBatch, getBatchGroupKey, computeBatchRemaining } from '../utils/productBatches';
import {
  addReceiptHeader,
  createReceiptDoc,
  drawTotalsBlock,
  getReceiptDensity,
  money,
  receiptTableOptions,
} from '../utils/pdfReceipt';

const DEFAULT_CATEGORIES = ['Lubrication', 'Washing', 'Washing & Lubrication'];

const sortByName = (a, b) => {
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return 0;
};

const toNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const Maghsal = () => {
  const { user } = useContext(UserContext);
  const [entries, setEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  // { [productId]: lastReconciledISODate } — from the Stock Checker's
  // "Mark Accurate" action. Movement recorded before this date is already
  // baked into products/{id}.quantity, so batch-remaining math must not
  // subtract it again (same rule remainingProducts.js itself follows).
  const [stockCheckedAtByProductId, setStockCheckedAtByProductId] = useState({});
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // View tab: 'all' keeps Used entries out of the main list entirely; 'used'
  // shows only Used entries. Keeps Used items from being mixed into the
  // regular Items Used list.
  const [viewMode, setViewMode] = useState('all');

  // Filters
  const [customerFilter, setCustomerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('All');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [checkFilter, setCheckFilter] = useState('all');
  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem('checkedMaghsalItems');
    return saved ? JSON.parse(saved) : [];
  });

  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formCategory, setFormCategory] = useState('');
  // Explicit price-batch override for the selected product — '' means
  // "use the default (oldest-priced) batch" until the user picks otherwise.
  const [formBatchId, setFormBatchId] = useState('');
  const [formServiceCategory, setFormServiceCategory] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formServicePrice, setFormServicePrice] = useState('');
  const [formPaymentStatus, setFormPaymentStatus] = useState('Unpaid');
  const [formRemark, setFormRemark] = useState('');
  // Stock-in form (only shown when paymentStatus === 'Stock'). Single product
  // per submission, matching the Oil/Filter "Add Missing Item" stock flow.
  const [formStockProductId, setFormStockProductId] = useState('');
  const [formStockQuantity, setFormStockQuantity] = useState('1');
  const [formStockPurchasingPrice, setFormStockPurchasingPrice] = useState('');
  const [formStockSellPrice, setFormStockSellPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Details modal
  const [detailsEntry, setDetailsEntry] = useState(null);

  // Inline edit (simple fields only)
  // Editing reuses the Add modal; this holds the id of the entry being edited
  // (null when adding a new one).
  const [editingEntryId, setEditingEntryId] = useState(null);

  // Delete
  const [confirm, confirmDialog] = useConfirmDialog();

  // ── Format helpers ──────────────────────────────
  const formatDate = (d) => {
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}-${month}-${date.getFullYear()}`;
    } catch { return 'Invalid Date'; }
  };

  const formatDateTime = (d) => {
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day}-${month}-${date.getFullYear()} ${hours}:${minutes} ${ampm}`;
    } catch { return 'Invalid Date'; }
  };

  const formatDateForInput = (d) => {
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    } catch { return ''; }
  };

  const formatCurrency = (v) =>
    Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const sanitizeCSVCell = (value) => {
    const raw = value == null ? '' : String(value);
    const flattened = raw.replace(/\r?\n/g, ' ');
    return /^[=+\-@]/.test(flattened) ? `'${flattened}` : flattened;
  };

  const sortByDate = (items, order = 'asc') => {
    return [...items].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return order === 'asc' ? da - db : db - da;
    });
  };

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const convertDateInputToISO = (value) => {
    if (!value) return new Date().toISOString();
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return new Date().toISOString();
    return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
  };

  const flash = (msg, kind = 'success') => {
    if (kind === 'success') { setSuccessMessage(msg); setErrorMessage(null); }
    else { setErrorMessage(msg); setSuccessMessage(null); }
    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 3500);
  };

  // ── Fetch ────────────────────────────────────────
  useEffect(() => {
    const customersRef = ref(database, 'customers');
    const entriesRef = ref(database, 'maghsalEntries');
    const categoriesRef = ref(database, 'settings/maghsalCategories');
    const productsRef = ref(database, 'products');

    const unsubCustomers = onValue(customersRef, (snap) => {
      let list = [];
      if (snap.exists()) {
        const data = snap.val();
        list = Object.keys(data).map((k) => ({
          id: k,
          name: data[k].name,
          nameArabic: data[k].nameArabic,
        }));
        list.sort(sortByName);
      }
      setCustomers(list);
    });

    const unsubEntries = onValue(entriesRef, (snap) => {
      if (!snap.exists()) { setEntries([]); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
      setEntries(sortByDate(list, 'desc'));
    });

    const unsubCategories = onValue(categoriesRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        if (Array.isArray(val) && val.length > 0) { setCategories(val); return; }
        if (val && typeof val === 'object') {
          const arr = Object.values(val).filter((v) => typeof v === 'string' && v.trim().length > 0);
          if (arr.length > 0) { setCategories(arr); return; }
        }
      }
      setCategories(DEFAULT_CATEGORIES);
    });

    const unsubProducts = onValue(productsRef, (snap) => {
      if (!snap.exists()) { setProducts([]); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setProducts(list);
    });

    const stockChecksRef = ref(database, 'stockChecks');
    const unsubStockChecks = onValue(stockChecksRef, (snap) => {
      if (!snap.exists()) { setStockCheckedAtByProductId({}); return; }
      const data = snap.val();
      const map = {};
      Object.keys(data).forEach((id) => {
        const ts = data[id]?.reconfirmedAt || data[id]?.checkedAt;
        if (ts) map[id] = ts;
      });
      setStockCheckedAtByProductId(map);
    });

    return () => {
      unsubCustomers(); unsubEntries(); unsubCategories(); unsubProducts(); unsubStockChecks();
    };
  }, []);

  const catalogue = useMemo(
    () => [...products].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [products],
  );

  // Product pickers on the Add/Edit Used Item form (including the Stock-in
  // sub-form) only offer Maghsal-typed products, not the whole catalogue.
  const maghsalProducts = useMemo(
    () => catalogue.filter((p) => {
      const scope = String(p.scope || '').toLowerCase();
      const type = String(p.productType || '').toLowerCase();
      return scope.includes('maghsal') || type.includes('maghsal');
    }),
    [catalogue],
  );

  const getProduct = (id) => products.find((p) => p.id === id);

  // One entry per logical product (root + its price-duplicate batches
  // collapsed together), with quantity summed across siblings — this feeds
  // the dropdowns so duplicates don't show up as separate-looking rows.
  const maghsalProductGroups = useMemo(() => {
    const groups = new Map();
    maghsalProducts.forEach((p) => {
      const key = getBatchGroupKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return [...groups.entries()]
      .map(([groupKey, batches]) => {
        const representative = batches.find((b) => b.id === groupKey) || batches[0];
        const quantity = batches.reduce(
          (sum, b) => sum + computeBatchRemaining(b, { maghsalEntries: entries, checkedAtByProductId: stockCheckedAtByProductId }),
          0,
        );
        return { id: groupKey, name: representative.name, quantity };
      })
      .sort(sortByName);
  }, [maghsalProducts, entries, stockCheckedAtByProductId]);

  // All price-batches of the currently selected product, oldest first.
  const formCategoryBatches = useMemo(
    () => (formCategory ? findSiblingBatches(products, formCategory) : []),
    [products, formCategory],
  );

  // Default batch when the user hasn't explicitly picked one: the oldest
  // batch that still has stock (same rule as automatic FIFO elsewhere).
  const formCategoryDefaultBatch = useMemo(
    () => pickFifoBatch(formCategoryBatches, { maghsalEntries: entries, checkedAtByProductId: stockCheckedAtByProductId }),
    [formCategoryBatches, entries, stockCheckedAtByProductId],
  );

  const selectedBatch = (formCategoryBatches.find((b) => b.id === formBatchId))
    || formCategoryDefaultBatch
    || null;
  const selectedBatchRemaining = selectedBatch
    ? computeBatchRemaining(selectedBatch, { maghsalEntries: entries, checkedAtByProductId: stockCheckedAtByProductId })
    : null;

  // ── Entry totals helper ─────────────────────────
  const entryTotals = (e) => {
    const servicePrice = toNumber(e.servicePrice ?? e.price);
    const goodsTotal = (() => {
      if (typeof e.goodsTotal !== 'undefined') return toNumber(e.goodsTotal);
      if (Array.isArray(e.goodsSold)) {
        return e.goodsSold.reduce((acc, g) => acc + toNumber(g.quantity) * toNumber(g.unitPrice), 0);
      }
      return 0;
    })();
    const totalPrice = (() => {
      if (typeof e.totalPrice !== 'undefined') return toNumber(e.totalPrice);
      return servicePrice + goodsTotal;
    })();

    // Cost of consumables used during the service. Falls back to the current
    // product's purchasingPrice if the entry was saved before we started
    // snapshotting it.
    const consumablesCost = Array.isArray(e.consumablesUsed)
      ? e.consumablesUsed.reduce((acc, c) => {
          const purchasing = toNumber(c.purchasingPrice) || toNumber(getProduct(c.productId)?.purchasingPrice);
          return acc + toNumber(c.quantity) * purchasing;
        }, 0)
      : 0;

    // Cost of goods sold — same fallback strategy.
    const goodsCost = Array.isArray(e.goodsSold)
      ? e.goodsSold.reduce((acc, g) => {
          const purchasing = toNumber(g.purchasingPrice) || toNumber(getProduct(g.productId)?.purchasingPrice);
          return acc + toNumber(g.quantity) * purchasing;
        }, 0)
      : 0;

    // Net profit (per the business owner's formula):
    //   Net Profit = Sales (service + sold revenue) − Cost of items USED
    // Items sold are tracked at full revenue here; their purchasing cost is
    // managed elsewhere. Only consumables actually used in services reduce
    // profit on this page.
    const netProfit = totalPrice - consumablesCost;

    return { servicePrice, goodsTotal, totalPrice, consumablesCost, goodsCost, netProfit };
  };

  // ── Filters ──────────────────────────────────────
  // Same filters as `filtered` below, minus the All/Used tab split — used for
  // the KPI totals so Net Profit (Revenue − Used expenses) stays correct no
  // matter which tab is active, instead of zeroing out one side.
  const sharedFiltered = useMemo(() => {
    let result = entries;

    if (customerFilter) {
      const cf = customerFilter.toLowerCase();
      result = result.filter((e) =>
        (e.customerName || '').toLowerCase().includes(cf) ||
        (e.customerNameArabic || '').toLowerCase().includes(cf)
      );
    }

    if (categoryFilter !== 'All') {
      result = result.filter((e) => (e.category || '') === categoryFilter);
    }

    if (serviceCategoryFilter !== 'All') {
      result = result.filter((e) => (e.serviceCategory || '') === serviceCategoryFilter);
    }

    if (paymentStatusFilter !== 'All') {
      result = result.filter((e) => (e.paymentStatus || '') === paymentStatusFilter);
    }

    if (dateFromFilter || dateToFilter) {
      const fromMs = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`).getTime() : null;
      const toMs = dateToFilter ? new Date(`${dateToFilter}T23:59:59.999`).getTime() : null;
      result = result.filter((e) => {
        const ms = new Date(e.date).getTime();
        if (isNaN(ms)) return false;
        if (fromMs !== null && ms < fromMs) return false;
        if (toMs !== null && ms > toMs) return false;
        return true;
      });
    }

    if (monthFilter) {
      result = result.filter((e) => new Date(e.date).getMonth() + 1 === parseInt(monthFilter, 10));
    }

    if (checkFilter === 'checked') {
      result = result.filter((e) => checkedItems.includes(e.id));
    } else if (checkFilter === 'unchecked') {
      result = result.filter((e) => !checkedItems.includes(e.id));
    }

    return sortByDate(result, 'desc');
  }, [entries, customerFilter, categoryFilter, serviceCategoryFilter, paymentStatusFilter, dateFromFilter, dateToFilter, monthFilter, checkFilter, checkedItems]);

  // Table view — sharedFiltered further split by the All/Used tab.
  const filtered = useMemo(() => (
    viewMode === 'used'
      ? sharedFiltered.filter((e) => e.paymentStatus === 'Used')
      : sharedFiltered.filter((e) => e.paymentStatus !== 'Used')
  ), [sharedFiltered, viewMode]);

  const totals = useMemo(() => {
    const t = {
      count: 0,
      service: 0,
      goods: 0,
      total: 0,
      paid: 0,
      unpaid: 0,
      expenses: 0,
      consumablesCost: 0,
      goodsCost: 0,
      netProfit: 0,
    };
    // Always computed from sharedFiltered (not the tab-split `filtered`) so
    // Net Profit = Total Revenue − Used expenses stays correct regardless of
    // which tab (All/Used) is currently active.
    for (const e of sharedFiltered) {
      const m = entryTotals(e);
      t.count += 1;
      t.service += m.servicePrice;
      t.goods += m.goodsTotal;
      t.consumablesCost += m.consumablesCost;
      t.goodsCost += m.goodsCost;
      if (e.paymentStatus === 'Paid') { t.paid += m.totalPrice; t.total += m.totalPrice; }
      else if (e.paymentStatus === 'Unpaid') { t.unpaid += m.totalPrice; t.total += m.totalPrice; }
      else if (e.paymentStatus === 'Used') t.expenses += m.totalPrice;
    }
    t.netProfit = t.total - t.expenses;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedFiltered, products]);



  // ── Clear / Refresh ──────────────────────────────
  const clearAllFilters = () => {
    setCustomerFilter('');
    setCategoryFilter('All');
    setServiceCategoryFilter('All');
    setDateFromFilter('');
    setDateToFilter('');
    setMonthFilter('');
    setPaymentStatusFilter('All');
    setCheckFilter('all');
  };

  const handleCheckboxChange = (entryId) => {
    setCheckedItems((prev) => {
      const next = prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId];
      localStorage.setItem('checkedMaghsalItems', JSON.stringify(next));
      return next;
    });
  };

  const clearAllChecks = () => {
    localStorage.removeItem('checkedMaghsalItems');
    setCheckedItems([]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // onValue is live, so just visual feedback. Refetch is no-op.
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Add form ─────────────────────────────────────
  const openAddModal = () => {
    setFormCustomerId('');
    setFormDate(formatDateForInput(new Date().toISOString()));
    setFormCategory('');
    setFormServiceCategory('');
    setFormQuantity('1');
    setFormServicePrice('');
    setFormPaymentStatus('Unpaid');
    setFormRemark('');
    setFormStockProductId('');
    setFormStockQuantity('1');
    setFormStockPurchasingPrice('');
    setFormStockSellPrice('');
    setShowAddModal(true);
  };

  // When the user picks a product in stock-in mode, pre-fill the prices from
  // the product (both still editable in case supplier or retail price changed).
  const handleStockProductChange = (productId) => {
    setFormStockProductId(productId);
    const p = getProduct(productId);
    setFormStockPurchasingPrice(p ? String(toNumber(p.purchasingPrice)) : '');
    setFormStockSellPrice(p ? String(toNumber(p.itemCost)) : '');
  };

  const closeAddModal = () => { setShowAddModal(false); setEditingEntryId(null); setFormBatchId(''); };



  const isStockMode = formPaymentStatus === 'Stock';

  // Computed values for the stock-in preview row
  const stockSelectedProduct = isStockMode ? getProduct(formStockProductId) : null;
  const stockQuantityValue = toNumber(formStockQuantity);
  const stockPurchasingPriceValue = toNumber(formStockPurchasingPrice);
  const stockSellPriceValue = toNumber(formStockSellPrice);
  const stockTotalCost = stockPurchasingPriceValue * stockQuantityValue;

  const canSave = Boolean(
    formDate &&
    !isSaving &&
    (
      isStockMode
        // Stock-in: product + positive quantity is enough.
        ? (formStockProductId && stockQuantityValue > 0)
        // Sale: same rules as before.
        : (formCustomerId && toNumber(formQuantity) > 0 && toNumber(formServicePrice) > 0)
    )
  );

  // Stock-in path — push a single pending transaction, mirroring the
  // BarcodeScanner / Oil-Filter Add Missing Item stock flow.
  const handleSaveStockIn = async () => {
    if (!formStockProductId || stockQuantityValue <= 0) {
      flash('Pick a product and enter a quantity greater than zero.', 'error');
      return;
    }
    const product = getProduct(formStockProductId);
    if (!product) {
      flash('Selected product is no longer available.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const scannedBy = user?.name || user?.displayName || user?.email || 'Unknown';
      const currentDate = convertDateInputToISO(formDate);

      const transaction = {
        barcode: formStockProductId,
        productId: formStockProductId,
        name: product.name || 'Unknown',
        quantity: stockQuantityValue,
        dateScanned: currentDate,
        paymentStatus: 'Pending',
        itemCost: stockSellPriceValue,
        purchasingPrice: stockPurchasingPriceValue,
        totalCost: stockPurchasingPriceValue * stockQuantityValue,
        scannedBy: scannedBy,
        remark: formRemark.trim(),
      };
      await push(ref(database, 'transactions'), transaction);

      closeAddModal();
      flash('Stock-in submitted — awaiting confirmation in Transactions.');
    } catch (err) {
      console.error('Maghsal stock-in save failed:', err);
      flash(`Failed to submit stock: ${err?.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;

    // Editing an existing entry (modal reused) — update instead of create.
    if (editingEntryId) {
      return handleUpdateEntry();
    }

    // Stock-in is a separate flow — push to /transactions, not /maghsalEntries.
    if (isStockMode) {
      return handleSaveStockIn();
    }

    const selectedCustomer = customers.find((c) => c.id === formCustomerId);
    if (!selectedCustomer) {
      flash('Selected customer is no longer available.', 'error');
      return;
    }

    const selectedProduct = formCategory ? selectedBatch : null;
    if (formCategory && !selectedProduct) {
      flash('Selected product is no longer available.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const servicePrice = toNumber(formServicePrice);
      const qty = toNumber(formQuantity);

      const consumablesUsed = selectedProduct ? [{
        productId: selectedProduct.id,
        name: selectedProduct.name || 'Unknown',
        quantity: qty,
        unitCost: toNumber(selectedProduct.itemCost),
        purchasingPrice: toNumber(selectedProduct.purchasingPrice),
      }] : [];

      const newEntry = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name || '',
        customerNameArabic: selectedCustomer.nameArabic || '',
        date: convertDateInputToISO(formDate),
        category: selectedProduct ? selectedProduct.name : '',
        serviceCategory: formServiceCategory,
        price: servicePrice,
        servicePrice,
        quantity: qty,
        goodsTotal: 0,
        totalPrice: servicePrice * qty,
        consumablesUsed,
        paymentStatus: formPaymentStatus,
        employee: user?.name || user?.displayName || user?.email || 'Unknown',
        employeeId: user?.uid || '',
        remark: formRemark.trim(),
        createdAt: new Date().toISOString(),
        stockAdjusted: false,
      };

      const entryRef = push(ref(database, 'maghsalEntries'));
      try {
        await update(entryRef, newEntry);
      } catch (entryErr) {
        console.error('Maghsal entry save failed:', entryErr, 'payload:', newEntry);
        flash(`Failed to save entry: ${entryErr?.message || entryErr}`, 'error');
        return;
      }

      closeAddModal();
      flash('Entry saved.');
    } catch (err) {
      console.error('Maghsal save failed:', err);
      flash(`Failed to save entry: ${err?.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit (reuses the Add modal) ──────────────────
  const openEditModal = (entry) => {
    setEditingEntryId(entry.id);
    setFormCustomerId(entry.customerId || customers.find((c) => c.name === entry.customerName)?.id || '');
    setFormDate(formatDateForInput(entry.date));
    const usedLine = Array.isArray(entry.consumablesUsed) && entry.consumablesUsed[0];
    const usedProduct = usedLine ? getProduct(usedLine.productId) : null;
    setFormCategory(usedProduct ? getBatchGroupKey(usedProduct) : (usedLine ? usedLine.productId : ''));
    setFormBatchId(usedLine ? usedLine.productId : '');
    setFormServiceCategory(entry.serviceCategory || '');
    setFormQuantity(usedLine ? String(toNumber(usedLine.quantity)) : '1');
    setFormServicePrice(String(toNumber(entry.servicePrice ?? entry.price)));
    setFormPaymentStatus(entry.paymentStatus || 'Unpaid');
    setFormRemark(entry.remark || '');
    setShowAddModal(true);
  };

  // Update an existing entry from the modal form. Stock movement is reflected in
  // the Stock checker as "Used Since Check"; product.quantity is not changed here.
  const handleUpdateEntry = async () => {
    const originalEntry = entries.find((e) => e.id === editingEntryId);

    const selectedCustomer = customers.find((c) => c.id === formCustomerId);
    if (!selectedCustomer) { flash('Selected customer is no longer available.', 'error'); return; }

    const selectedProduct = formCategory ? selectedBatch : null;
    if (formCategory && !selectedProduct) { flash('Selected product is no longer available.', 'error'); return; }

    setIsSaving(true);
    try {
      const servicePrice = toNumber(formServicePrice);
      const qty = toNumber(formQuantity);
      const dateISO = (originalEntry && formatDateForInput(originalEntry.date) === formDate)
        ? originalEntry.date
        : convertDateInputToISO(formDate);

      const consumablesUsed = selectedProduct ? [{
        productId: selectedProduct.id,
        name: selectedProduct.name || 'Unknown',
        quantity: qty,
        unitCost: toNumber(selectedProduct.itemCost),
        purchasingPrice: toNumber(selectedProduct.purchasingPrice),
      }] : [];

      await update(ref(database, `maghsalEntries/${editingEntryId}`), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name || '',
        customerNameArabic: selectedCustomer.nameArabic || '',
        date: dateISO,
        category: selectedProduct ? selectedProduct.name : '',
        serviceCategory: formServiceCategory,
        price: servicePrice,
        servicePrice,
        quantity: qty,
        goodsTotal: 0,
        totalPrice: servicePrice * qty,
        consumablesUsed,
        paymentStatus: formPaymentStatus,
        remark: formRemark.trim(),
      });

      closeAddModal();
      flash('Entry updated.');
    } catch (err) {
      console.error('Maghsal update failed:', err);
      flash(`Failed to update entry: ${err?.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ───────────────────────
  const requestDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Entry?',
      message: 'Deleting this entry removes it from Maghsal records. Product stock quantity will not be changed automatically. This action cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await update(ref(database), { [`maghsalEntries/${id}`]: null });
      flash('Entry deleted.');
    } catch (err) {
      console.error(err);
      flash('Failed to delete entry.', 'error');
    }
  };

  // ── Export ───────────────────────────────────────
  const getDateDisplay = (v) => {
    if (!v) return '';
    const [y, m, d] = v.split('-');
    return `${d}-${m}-${y}`;
  };

  const buildExportFilename = (extension) => {
    const sanitize = (s) =>
      String(s || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80);
    const clientPart = sanitize(customerFilter) || 'maghsal_all';
    let datePart;
    if (dateFromFilter && dateToFilter) {
      datePart = dateFromFilter === dateToFilter
        ? getDateDisplay(dateFromFilter)
        : `${getDateDisplay(dateFromFilter)}_to_${getDateDisplay(dateToFilter)}`;
    } else if (dateFromFilter) datePart = `from_${getDateDisplay(dateFromFilter)}`;
    else if (dateToFilter) datePart = `to_${getDateDisplay(dateToFilter)}`;
    else datePart = formatDate(new Date());
    return `Maghsal_${clientPart}_${datePart}.${extension}`;
  };

  const exportPDF = async () => {
    if (filtered.length === 0) { flash('No data to export.', 'error'); return; }
    let paid = 0, unpaid = 0;
    const rows = filtered.map((e) => {
      const m = entryTotals(e);
      if (e.paymentStatus === 'Paid') paid += m.totalPrice;
      else if (e.paymentStatus === 'Unpaid') unpaid += m.totalPrice;
      const qty = toNumber(e.quantity ?? e.consumablesUsed?.[0]?.quantity);
      return [
        formatDate(e.date),
        e.category || 'N/A',
        e.paymentStatus || 'N/A',
        qty || '—',
        money(m.servicePrice),
        money(m.goodsTotal),
        money(m.totalPrice),
      ];
    });

    const doc = createReceiptDoc(jsPDF);
    const density = getReceiptDensity(rows.length);
    const fromLabel = dateFromFilter ? getDateDisplay(dateFromFilter) : formatDate(filtered[filtered.length - 1]?.date);
    const toLabel = dateToFilter ? getDateDisplay(dateToFilter) : formatDate(filtered[0]?.date);
    const startY = await addReceiptHeader(doc, {
      title: 'CLIENT RECEIPT',
      subtitle: 'Maghsal Statement',
      receiptNo: `MG-${Date.now().toString().slice(-8)}`,
      client: customerFilter || 'All Clients',
      dateRange: `From ${fromLabel} to ${toLabel}`,
    });

    autoTable(doc, {
      ...receiptTableOptions({
        head: ['Date', 'Service', 'Status', 'Qty', 'Service Price', 'Sold', 'Total'],
        body: rows,
        startY,
        rightAlignedColumns: [3, 4, 5, 6],
        density,
      }),
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 52 },
        2: { cellWidth: 22 },
        3: { halign: 'right', cellWidth: 15 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 23 },
      },
    });

    drawTotalsBlock(doc, {
      paid,
      unpaid,
      grandTotal: paid + unpaid,
      startY: doc.lastAutoTable.finalY + 4,
      compact: density.totalsCompact,
    });

    const filename = buildExportFilename('pdf');
    const blob = doc.output('blob');
    const result = await saveBlobToExportFolder(blob, filename);
    if (result.strategy === 'folder') flash(`Saved to "${result.folderName}/${filename}"`);
  };

  const exportCSV = async () => {
    if (filtered.length === 0) { flash('No data to export.', 'error'); return; }
    const headers = ['Date','Customer','Service','Category','Payment Status','Quantity','Service Price','Sold Total','Total','Employee','Remark','Used','Sold'];
    const rows = filtered.map((e) => {
      const m = entryTotals(e);
      const qty = toNumber(e.quantity ?? e.consumablesUsed?.[0]?.quantity);
      const cons = (e.consumablesUsed || []).map((c) => `${c.name} x${c.quantity}`).join('; ');
      const gd = (e.goodsSold || []).map((g) => `${g.name} x${g.quantity}@$${toNumber(g.unitPrice).toFixed(2)}`).join('; ');
      return [
        formatDateTime(e.date),
        e.customerName || 'N/A',
        e.serviceCategory || 'N/A',
        e.category || 'N/A',
        e.paymentStatus || 'N/A',
        qty,
        m.servicePrice.toFixed(2),
        m.goodsTotal.toFixed(2),
        m.totalPrice.toFixed(2),
        e.employee || 'N/A',
        e.remark || '',
        cons,
        gd,
      ];
    });
    const csv = '﻿' +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${sanitizeCSVCell(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = buildExportFilename('csv');
    const result = await saveBlobToExportFolder(blob, filename);
    if (result.strategy === 'folder') flash(`Saved to "${result.folderName}/${filename}"`);
  };

  // ── Render ───────────────────────────────────────
  return (
    <div className="page-shell maghsal-container">
      <PageHeader
        title="Items Used"
        subtitle="Maghsal."
        actions={(
          <>
            <button className="btn-secondary" onClick={handleRefresh} disabled={isRefreshing}>
              <IconRefresh /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="btn-secondary" onClick={() => setShowExportDropdown((v) => !v)}>
                Export ▾
              </button>
              {showExportDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 100,
                  background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--r-md)',
                  boxShadow: 'var(--shadow-md)', minWidth: 180, marginTop: 4,
                }}>
                  <button
                    style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => { exportCSV(); setShowExportDropdown(false); }}
                  >Full Export (CSV)</button>
                  <button
                    style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => { exportPDF(); setShowExportDropdown(false); }}
                  >Client Export (PDF)</button>
                </div>
              )}
            </div>
            <button className="btn-primary" onClick={openAddModal}>
              <IconPlus /> Add Used Item
            </button>
          </>
        )}
      />

      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-card-label">Entries</div>
            <div className="kpi-card-value">{totals.count}</div>
          </div>
          <div className="kpi-card tone-green">
            <div className="kpi-card-label">Total Revenue</div>
            <div className="kpi-card-value">${formatCurrency(totals.total)}</div>
            <div className="kpi-card-hint">Paid ${formatCurrency(totals.paid)} · Unpaid ${formatCurrency(totals.unpaid)}</div>
          </div>
          <div className="kpi-card tone-cyan">
            <div className="kpi-card-label">Expenses</div>
            <div className="kpi-card-value">${formatCurrency(totals.expenses)}</div>
          </div>
          <div
            className="kpi-card"
            style={{
              borderLeft: `4px solid ${totals.netProfit >= 0 ? '#198754' : '#dc3545'}`,
            }}
          >
            <div className="kpi-card-label">
              Net Profit
            </div>
            <div
              className="kpi-card-value"
              style={{ color: totals.netProfit >= 0 ? '#198754' : '#dc3545' }}
            >
              ${formatCurrency(totals.netProfit)}
            </div>
            <div className="kpi-card-hint">
              Revenue ${formatCurrency(totals.total)} − Expenses ${formatCurrency(totals.expenses)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Customer</label>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
              <option value="">All Customers</option>
              {customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Product</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="All">All Products</option>
              {maghsalProductGroups.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Service</label>
            <select value={serviceCategoryFilter} onChange={(e) => setServiceCategoryFilter(e.target.value)}>
              <option value="All">All Services</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>From Date</label>
            <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
          </div>

          <div className="filter-group">
            <label>To Date</label>
            <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} />
          </div>

          <div className="filter-group">
            <label>Month</label>
            <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">All Months</option>
              {monthNames.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Payment Status</label>
            <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Check Status</label>
            <select value={checkFilter} onChange={(e) => setCheckFilter(e.target.value)}>
              <option value="all">All Items</option>
              <option value="checked">Checked</option>
              <option value="unchecked">Unchecked</option>
            </select>
            <button
              className="clear-checks-btn"
              onClick={clearAllChecks}
              disabled={checkedItems.length === 0}
            >
              Clear Checks ({checkedItems.length})
            </button>
          </div>
        </div>

        <div className="filter-actions">
          <button
            className={viewMode === 'all' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setViewMode('all')}
          >
            All Items
          </button>
          <button
            className={viewMode === 'used' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setViewMode('used')}
          >
            Used
          </button>
          <button className="btn-secondary" onClick={clearAllFilters}>Clear Filters</button>
        </div>
      </div>

      {/* Active filter tags */}
      {(customerFilter || categoryFilter !== 'All' || serviceCategoryFilter !== 'All' || dateFromFilter || dateToFilter || monthFilter || paymentStatusFilter !== 'All' || checkFilter !== 'all') && (
        <div className="active-filters">
          <span className="active-filters-title">Active Filters:</span>
          <div className="filter-tags">
            {customerFilter && <span className="filter-tag">Customer: {customerFilter}<button onClick={() => setCustomerFilter('')}><IconX /></button></span>}
            {categoryFilter !== 'All' && <span className="filter-tag">Product: {categoryFilter}<button onClick={() => setCategoryFilter('All')}><IconX /></button></span>}
            {serviceCategoryFilter !== 'All' && <span className="filter-tag">Service: {serviceCategoryFilter}<button onClick={() => setServiceCategoryFilter('All')}><IconX /></button></span>}
            {dateFromFilter && <span className="filter-tag">From: {getDateDisplay(dateFromFilter)}<button onClick={() => setDateFromFilter('')}><IconX /></button></span>}
            {dateToFilter && <span className="filter-tag">To: {getDateDisplay(dateToFilter)}<button onClick={() => setDateToFilter('')}><IconX /></button></span>}
            {monthFilter && <span className="filter-tag">Month: {monthNames[parseInt(monthFilter, 10) - 1]}<button onClick={() => setMonthFilter('')}><IconX /></button></span>}
            {paymentStatusFilter !== 'All' && <span className="filter-tag">Status: {paymentStatusFilter}<button onClick={() => setPaymentStatusFilter('All')}><IconX /></button></span>}
            {checkFilter !== 'all' && <span className="filter-tag">Check: {checkFilter === 'checked' ? 'Checked' : 'Unchecked'}<button onClick={() => setCheckFilter('all')}><IconX /></button></span>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        {filtered.length === 0 ? (
          <div className="empty-table">
            <p>No Maghsal entries match the current filters.</p>
            <button className="btn-secondary" onClick={clearAllFilters} style={{ marginTop: 10 }}>Clear Filters</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Product</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Charges</th>
                <th>Status</th>
                <th>Actions</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const m = entryTotals(e);
                return (
                  <tr key={e.id} className={checkedItems.includes(e.id) ? 'checked-row' : ''}>
                    <td className="date-cell">
                      <span className="date-display">{formatDateTime(e.date)}</span>
                    </td>
                    <td>{e.customerName || 'N/A'}</td>
                    <td>{e.serviceCategory || '—'}</td>
                    <td>{e.category || 'Unspecified'}</td>
                    <td className="text-right">
                      {Array.isArray(e.consumablesUsed) && e.consumablesUsed[0]
                        ? toNumber(e.consumablesUsed[0].quantity)
                        : '—'}
                    </td>
                    <td className="text-right">
                      <span className="price-cell" style={{ fontWeight: 600 }}>
                        ${m.servicePrice.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${(e.paymentStatus || '').toLowerCase()}`}>{e.paymentStatus || 'N/A'}</span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-small btn-secondary" onClick={() => setDetailsEntry(e)} title="View used / sold items, employee & remark">
                          Details
                        </button>
                        <button className="btn-small btn-primary" onClick={() => openEditModal(e)}>Edit</button>
                        <button className="btn-small btn-danger" onClick={() => requestDelete(e.id)}>Delete</button>
                      </div>
                    </td>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={checkedItems.includes(e.id)}
                        onChange={() => handleCheckboxChange(e.id)}
                        className="checkbox"
                        id={`maghsal-checkbox-${e.id}`}
                      />
                      <label htmlFor={`maghsal-checkbox-${e.id}`} className="checkbox-label">
                        {checkedItems.includes(e.id) ? 'Checked' : 'Check'}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingEntryId ? 'Edit Used Item' : (formPaymentStatus === 'Stock' ? 'Add Stock In' : 'Add Used Item')}</h3>
              <button className="modal-close" onClick={closeAddModal}><IconX /></button>
            </div>
            <div className="modal-content">
              {/* Core fields */}
              <div className="missing-item-form-grid">
                {formPaymentStatus !== 'Stock' && (
                  <div className="form-group">
                    <label className="form-label">Customer</label>
                    <select value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} className="form-select" disabled={isSaving}>
                      <option value="">Select Customer</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="form-input" disabled={isSaving} />
                </div>

                {formPaymentStatus !== 'Stock' && (
                  <div className="form-group">
                    <label className="form-label">Product (optional)</label>
                    <select
                      value={formCategory}
                      onChange={(e) => { setFormCategory(e.target.value); setFormBatchId(''); }}
                      className="form-select"
                      disabled={isSaving}
                    >
                      <option value="">No product</option>
                      {maghsalProductGroups.map((p) => <option key={p.id} value={p.id}>{p.name} · stock {toNumber(p.quantity)}</option>)}
                    </select>
                  </div>
                )}

                {formPaymentStatus !== 'Stock' && formCategory && formCategoryBatches.length > 1 && (
                  <div className="form-group">
                    <label className="form-label">Price</label>
                    <select
                      value={selectedBatch?.id || ''}
                      onChange={(e) => setFormBatchId(e.target.value)}
                      className="form-select"
                      disabled={isSaving}
                    >
                      {formCategoryBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          ${toNumber(b.itemCost).toFixed(2)} — {computeBatchRemaining(b, { maghsalEntries: entries, checkedAtByProductId: stockCheckedAtByProductId })} left
                          {b.id === formCategoryDefaultBatch?.id ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formPaymentStatus !== 'Stock' && formCategory && selectedBatch && (
                  <div className="form-group">
                    <label className="form-label">In Stock</label>
                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', color: selectedBatchRemaining <= 0 ? 'var(--red, #dc3545)' : undefined }}>
                      {selectedBatchRemaining} left at ${toNumber(selectedBatch.itemCost).toFixed(2)}
                    </div>
                  </div>
                )}

                {formPaymentStatus !== 'Stock' && (
                  <div className="form-group">
                    <label className="form-label">Service</label>
                    <select value={formServiceCategory} onChange={(e) => setFormServiceCategory(e.target.value)} className="form-select" disabled={isSaving}>
                      <option value="">Product</option>
                      {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                )}

                {formPaymentStatus !== 'Stock' && (
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input type="number" min="0.01" step="0.01" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} className="form-input" disabled={isSaving} />
                  </div>
                )}

                {formPaymentStatus !== 'Stock' && (
                  <div className="form-group">
                    <label className="form-label">Service Price</label>
                    <input type="number" min="0" step="0.01" value={formServicePrice} onChange={(e) => setFormServicePrice(e.target.value)} className="form-input" disabled={isSaving} />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select value={formPaymentStatus} onChange={(e) => setFormPaymentStatus(e.target.value)} className="form-select" disabled={isSaving}>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Used">Used</option>
                    {!editingEntryId && <option value="Stock">Stock</option>}
                  </select>
                </div>
              </div>

              {/* Stock-in form (single product, Oil/Filter style) */}
              {formPaymentStatus === 'Stock' && (
                <>
                  <div className="form-group" style={{ marginTop: 'var(--s-4)' }}>
                    <label className="form-label">Product</label>
                    <select
                      value={formStockProductId}
                      onChange={(e) => handleStockProductChange(e.target.value)}
                      className="form-select"
                      disabled={isSaving || maghsalProductGroups.length === 0}
                    >
                      <option value="">Select a Product</option>
                      {maghsalProductGroups.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · stock {toNumber(p.quantity)}
                        </option>
                      ))}
                    </select>
                    {maghsalProductGroups.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        No Maghsal items in inventory. Add them from <strong>Add Products → Maghsal Stock</strong>.
                      </p>
                    )}
                  </div>

                  <div className="missing-item-form-grid">
                    <div className="form-group">
                      <label className="form-label">Quantity</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formStockQuantity}
                        onChange={(e) => setFormStockQuantity(e.target.value)}
                        className="form-input"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Purchasing Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formStockPurchasingPrice}
                        onChange={(e) => setFormStockPurchasingPrice(e.target.value)}
                        className="form-input"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Selling Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formStockSellPrice}
                        onChange={(e) => setFormStockSellPrice(e.target.value)}
                        className="form-input"
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  {stockSelectedProduct && (
                    <div className="missing-item-summary" style={{ marginTop: 'var(--s-3)' }}>
                      <span>Unit Purchase: ${stockPurchasingPriceValue.toFixed(2)}</span>
                      <span>Unit Sell: ${stockSellPriceValue.toFixed(2)}</span>
                      <span style={{ color: 'var(--brand)' }}>Total Cost: ${stockTotalCost.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}


              {/* Remark */}
              <div className="form-group" style={{ marginTop: 'var(--s-3)' }}>
                <label className="form-label">Remark</label>
                <textarea value={formRemark} onChange={(e) => setFormRemark(e.target.value)} className="form-textarea" rows="2" disabled={isSaving} />
              </div>

              {formPaymentStatus !== 'Stock' && (
                <div className="missing-item-summary" style={{ marginTop: 'var(--s-3)' }}>
                  <span style={{ color: 'var(--brand)' }}>
                    Total: ${(toNumber(formServicePrice) * toNumber(formQuantity)).toFixed(2)}
                    {' '}({toNumber(formQuantity)} × ${toNumber(formServicePrice).toFixed(2)})
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
                {isSaving
                  ? 'Saving...'
                  : (editingEntryId ? 'Update Item' : (formPaymentStatus === 'Stock' ? 'Submit Stock In' : 'Save Used Item'))}
              </button>
              <button className="btn-secondary" onClick={closeAddModal} disabled={isSaving}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {detailsEntry && (
        <div className="modal-overlay" onClick={() => setDetailsEntry(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Used Item Details</h3>
              <button className="modal-close" onClick={() => setDetailsEntry(null)}><IconX /></button>
            </div>
            <div className="modal-content">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' }}>
                <div><strong>Customer:</strong> {detailsEntry.customerName || '—'}</div>
                <div><strong>Date:</strong> {formatDateTime(detailsEntry.date)}</div>
                <div><strong>Service:</strong> {detailsEntry.serviceCategory || '—'}</div>
                <div><strong>Product:</strong> {detailsEntry.category || '—'}</div>
                <div><strong>Quantity:</strong> {Array.isArray(detailsEntry.consumablesUsed) && detailsEntry.consumablesUsed[0] ? toNumber(detailsEntry.consumablesUsed[0].quantity) : '—'}</div>
                <div><strong>Status:</strong> {detailsEntry.paymentStatus || '—'}</div>
                <div><strong>Employee:</strong> {detailsEntry.employee || '—'}</div>
              </div>

              <div className="missing-item-summary" style={{ marginTop: 'var(--s-4)' }}>
                <span style={{ color: 'var(--brand)' }}>Charges: ${entryTotals(detailsEntry).servicePrice.toFixed(2)}</span>
              </div>

              {detailsEntry.remark && (
                <div>
                  <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Remark</h4>
                  <p style={{ fontSize: 13 }}>{detailsEntry.remark}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDetailsEntry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
};

export default Maghsal;
