import React, { useState, useEffect, useContext, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { database } from '../Auth/firebase';
import { ref, update, onValue, push } from 'firebase/database';
import { UserContext } from '../Auth/userContext';
import '../CSS/soldItems.css';
import { IconRefresh, IconX, IconPlus, IconTrash } from '../utils/icons';
import { saveBlobToExportFolder } from '../utils/exportFolder';
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
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // Filters
  const [customerFilter, setCustomerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
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
  const [formServicePrice, setFormServicePrice] = useState('');
  const [formPaymentStatus, setFormPaymentStatus] = useState('Unpaid');
  const [formRemark, setFormRemark] = useState('');
  const [formConsumables, setFormConsumables] = useState([]); // [{productId, quantity}]
  const [formGoods, setFormGoods] = useState([]);             // [{productId, quantity, unitPrice}]
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

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

    return () => {
      unsubCustomers(); unsubEntries(); unsubCategories(); unsubProducts();
    };
  }, []);

  // Used (consumed) / Sold pickers draw from the WHOLE catalogue so any product
  // — oil, filter, maghsal, etc. — used or sold during a service is recorded for
  // the Stock checker. (Previously limited to maghsal-scoped products only,
  // which left the dropdowns empty and nothing got tracked or deducted.)
  const catalogue = useMemo(
    () => [...products].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [products],
  );
  const consumables = catalogue;
  const goods       = catalogue;

  const getProduct = (id) => products.find((p) => p.id === id);

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
  const filtered = useMemo(() => {
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
  }, [entries, customerFilter, categoryFilter, paymentStatusFilter, dateFromFilter, dateToFilter, monthFilter, checkFilter, checkedItems]);

  const totals = useMemo(() => {
    const t = {
      count: 0,
      service: 0,
      goods: 0,
      total: 0,
      paid: 0,
      unpaid: 0,
      consumablesCost: 0,
      goodsCost: 0,
      netProfit: 0,
    };
    for (const e of filtered) {
      const m = entryTotals(e);
      t.count += 1;
      t.service += m.servicePrice;
      t.goods += m.goodsTotal;
      t.total += m.totalPrice;
      t.consumablesCost += m.consumablesCost;
      t.goodsCost += m.goodsCost;
      t.netProfit += m.netProfit;
      if (e.paymentStatus === 'Paid') t.paid += m.totalPrice;
      else if (e.paymentStatus === 'Unpaid') t.unpaid += m.totalPrice;
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, products]);



  // ── Clear / Refresh ──────────────────────────────
  const clearAllFilters = () => {
    setCustomerFilter('');
    setCategoryFilter('All');
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
    setFormCategory(categories[0] || '');
    setFormServicePrice('');
    setFormPaymentStatus('Unpaid');
    setFormRemark('');
    setFormConsumables([]);
    setFormGoods([]);
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

  const closeAddModal = () => { setShowAddModal(false); setEditingEntryId(null); };

  // Line-item operations
  const addConsumableLine = () => setFormConsumables((prev) => [...prev, { productId: '', quantity: 1 }]);
  const updateConsumableLine = (idx, patch) =>
    setFormConsumables((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeConsumableLine = (idx) =>
    setFormConsumables((prev) => prev.filter((_, i) => i !== idx));

  const addGoodLine = () => setFormGoods((prev) => [...prev, { productId: '', quantity: 1, unitPrice: 0 }]);
  const updateGoodLine = (idx, patch) =>
    setFormGoods((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeGoodLine = (idx) =>
    setFormGoods((prev) => prev.filter((_, i) => i !== idx));

  // When a goods product is picked, default unit price from product
  const handleGoodProductChange = (idx, productId) => {
    const p = getProduct(productId);
    updateGoodLine(idx, {
      productId,
      unitPrice: p ? toNumber(p.itemCost) : 0,
    });
  };

  const formGoodsTotal = useMemo(() =>
    formGoods.reduce((acc, g) => acc + toNumber(g.quantity) * toNumber(g.unitPrice), 0)
  , [formGoods]);

  const formTotal = useMemo(() =>
    toNumber(formServicePrice) + formGoodsTotal
  , [formServicePrice, formGoodsTotal]);

  // Stock validation: aggregate per product across both lists
  const validateStock = () => {
    const required = new Map(); // productId → qty needed
    for (const l of formConsumables) {
      if (!l.productId) continue;
      required.set(l.productId, (required.get(l.productId) || 0) + toNumber(l.quantity));
    }
    for (const l of formGoods) {
      if (!l.productId) continue;
      required.set(l.productId, (required.get(l.productId) || 0) + toNumber(l.quantity));
    }
    const insufficient = [];
    for (const [pid, needed] of required.entries()) {
      const p = getProduct(pid);
      if (!p) continue;
      const have = toNumber(p.quantity);
      if (needed > have) insufficient.push({ name: p.name, needed, have });
    }
    return insufficient;
  };

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
        : (formCustomerId && formCategory && (toNumber(formServicePrice) > 0 || formGoods.length > 0))
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

    // Validate line items have valid product selections
    const badConsumable = formConsumables.find((l) => !l.productId || toNumber(l.quantity) <= 0);
    if (badConsumable) {
      flash('Each Used line needs an item and quantity > 0.', 'error');
      return;
    }
    const badGood = formGoods.find((l) => !l.productId || toNumber(l.quantity) <= 0);
    if (badGood) {
      flash('Each Sold line needs an item and quantity > 0.', 'error');
      return;
    }

    // Stock check
    const issues = validateStock();
    if (issues.length > 0) {
      const summary = issues.map((i) => `${i.name}: need ${i.needed}, have ${i.have}`).join('; ');
      flash(`Insufficient stock — ${summary}`, 'error');
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === formCustomerId);
    if (!selectedCustomer) {
      flash('Selected customer is no longer available.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const servicePrice = toNumber(formServicePrice);
      const goodsTotal = formGoodsTotal;
      const totalPrice = servicePrice + goodsTotal;

      // Snapshot consumables/goods with names for historical reporting.
      // purchasingPrice is captured so net profit stays correct even if the
      // product's price is edited later.
      const consumablesSnapshot = formConsumables.map((l) => {
        const p = getProduct(l.productId);
        return {
          productId: l.productId,
          name: p?.name || 'Unknown',
          quantity: toNumber(l.quantity),
          unitCost: toNumber(p?.itemCost),               // legacy field — sell price
          purchasingPrice: toNumber(p?.purchasingPrice), // used to compute profit
        };
      });
      const goodsSnapshot = formGoods.map((l) => {
        const p = getProduct(l.productId);
        return {
          productId: l.productId,
          name: p?.name || 'Unknown',
          quantity: toNumber(l.quantity),
          unitPrice: toNumber(l.unitPrice),
          purchasingPrice: toNumber(p?.purchasingPrice),
        };
      });

      const newEntry = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name || '',
        customerNameArabic: selectedCustomer.nameArabic || '',
        date: convertDateInputToISO(formDate),
        category: formCategory,
        price: servicePrice,         // legacy/back-compat
        servicePrice,
        goodsTotal,
        totalPrice,
        ...(consumablesSnapshot.length > 0 ? { consumablesUsed: consumablesSnapshot } : {}),
        ...(goodsSnapshot.length > 0 ? { goodsSold: goodsSnapshot } : {}),
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
    setFormCategory(entry.category || categories[0] || '');
    setFormServicePrice(String(toNumber(entry.servicePrice ?? entry.price)));
    setFormPaymentStatus(entry.paymentStatus || 'Unpaid');
    setFormRemark(entry.remark || '');
    setFormConsumables(
      Array.isArray(entry.consumablesUsed)
        ? entry.consumablesUsed.map((c) => ({ productId: c.productId, quantity: toNumber(c.quantity) }))
        : []
    );
    setFormGoods(
      Array.isArray(entry.goodsSold)
        ? entry.goodsSold.map((g) => ({ productId: g.productId, quantity: toNumber(g.quantity), unitPrice: toNumber(g.unitPrice) }))
        : []
    );
    setShowAddModal(true);
  };

  // Update an existing entry from the modal form. Stock movement is reflected in
  // the Stock checker as "Used Since Check"; product.quantity is not changed here.
  const handleUpdateEntry = async () => {
    const originalEntry = entries.find((e) => e.id === editingEntryId);

    const badConsumable = formConsumables.find((l) => !l.productId || toNumber(l.quantity) <= 0);
    if (badConsumable) {
      flash('Each Used line needs an item and quantity > 0.', 'error');
      return;
    }
    const badGood = formGoods.find((l) => !l.productId || toNumber(l.quantity) <= 0);
    if (badGood) {
      flash('Each Sold line needs an item and quantity > 0.', 'error');
      return;
    }

    const issues = validateStock();
    if (issues.length > 0) {
      const summary = issues.map((i) => `${i.name}: need ${i.needed}, have ${i.have}`).join('; ');
      flash(`Insufficient stock — ${summary}`, 'error');
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === formCustomerId);
    if (!selectedCustomer) { flash('Selected customer is no longer available.', 'error'); return; }

    setIsSaving(true);
    try {
      const consumablesSnapshot = formConsumables.map((l) => {
        const p = getProduct(l.productId);
        return { productId: l.productId, name: p?.name || 'Unknown', quantity: toNumber(l.quantity), unitCost: toNumber(p?.itemCost), purchasingPrice: toNumber(p?.purchasingPrice) };
      });
      const goodsSnapshot = formGoods.map((l) => {
        const p = getProduct(l.productId);
        return { productId: l.productId, name: p?.name || 'Unknown', quantity: toNumber(l.quantity), unitPrice: toNumber(l.unitPrice), purchasingPrice: toNumber(p?.purchasingPrice) };
      });

      const servicePrice = toNumber(formServicePrice);
      const goodsTotal = goodsSnapshot.reduce((acc, g) => acc + g.quantity * toNumber(g.unitPrice), 0);
      // Preserve the original time-of-day when the calendar day is unchanged.
      const dateISO = (originalEntry && formatDateForInput(originalEntry.date) === formDate)
        ? originalEntry.date
        : convertDateInputToISO(formDate);

      await update(ref(database, `maghsalEntries/${editingEntryId}`), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name || '',
        customerNameArabic: selectedCustomer.nameArabic || '',
        date: dateISO,
        category: formCategory,
        price: servicePrice,
        servicePrice,
        goodsTotal,
        totalPrice: servicePrice + goodsTotal,
        consumablesUsed: consumablesSnapshot,
        goodsSold: goodsSnapshot,
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
  const requestDelete = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await update(ref(database), { [`maghsalEntries/${deleteId}`]: null });
      setShowConfirm(false);
      setDeleteId(null);
      flash('Entry deleted.');
    } catch (err) {
      console.error(err);
      flash('Failed to delete entry.', 'error');
    }
  };

  const cancelDeleteAction = () => { setShowConfirm(false); setDeleteId(null); };

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
      return [
        formatDate(e.date),
        e.category || 'N/A',
        e.paymentStatus || 'N/A',
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
        head: ['Date', 'Service', 'Status', 'Service Price', 'Sold', 'Total'],
        body: rows,
        startY,
        rightAlignedColumns: [3, 4, 5],
        density,
      }),
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 62 },
        2: { cellWidth: 25 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 25 },
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
    const headers = ['Date','Customer','Category','Payment Status','Service Price','Sold Total','Total','Employee','Remark','Used','Sold'];
    const rows = filtered.map((e) => {
      const m = entryTotals(e);
      const cons = (e.consumablesUsed || []).map((c) => `${c.name} x${c.quantity}`).join('; ');
      const gd = (e.goodsSold || []).map((g) => `${g.name} x${g.quantity}@$${toNumber(g.unitPrice).toFixed(2)}`).join('; ');
      return [
        formatDateTime(e.date),
        e.customerName || 'N/A',
        e.category || 'N/A',
        e.paymentStatus || 'N/A',
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
      {/* Header */}
      <div className="page-shell-header">
        <div className="page-shell-header-left">
          <h1 className="page-shell-header-title">Items Sold</h1>
          <p className="page-shell-header-subtitle">Maghsal.</p>
        </div>
        <div className="page-shell-header-actions">
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
            <IconPlus /> Add Sold Item
          </button>
        </div>
      </div>

      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-card-label">Entries</div>
            <div className="kpi-card-value">{totals.count}</div>
          </div>
          <div className="kpi-card tone-cyan">
            <div className="kpi-card-label">Sold Revenue</div>
            <div className="kpi-card-value">${formatCurrency(totals.goods)}</div>
          </div>
          <div className="kpi-card tone-green">
            <div className="kpi-card-label">Total Revenue</div>
            <div className="kpi-card-value">${formatCurrency(totals.total)}</div>
            <div className="kpi-card-hint">Paid ${formatCurrency(totals.paid)} · Unpaid ${formatCurrency(totals.unpaid)}</div>
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
              {totals.count} entry(s) · Sales ${formatCurrency(totals.total)} − Used ${formatCurrency(totals.consumablesCost)}
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
            <label>Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="All">All Categories</option>
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
          <button className="btn-secondary" onClick={clearAllFilters}>Clear Filters</button>
        </div>
      </div>

      {/* Active filter tags */}
      {(customerFilter || categoryFilter !== 'All' || dateFromFilter || dateToFilter || monthFilter || paymentStatusFilter !== 'All' || checkFilter !== 'all') && (
        <div className="active-filters">
          <span className="active-filters-title">Active Filters:</span>
          <div className="filter-tags">
            {customerFilter && <span className="filter-tag">Customer: {customerFilter}<button onClick={() => setCustomerFilter('')}><IconX /></button></span>}
            {categoryFilter !== 'All' && <span className="filter-tag">Category: {categoryFilter}<button onClick={() => setCategoryFilter('All')}><IconX /></button></span>}
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
                <th>Category</th>
                <th>Used</th>
                <th>Sold</th>
                <th className="text-right">Service</th>
                <th className="text-right">Total</th>
                <th className="text-right">Profit</th>
                <th>Status</th>
                <th>Actions</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const m = entryTotals(e);
                const goodsCount = Array.isArray(e.goodsSold) ? e.goodsSold.length : 0;
                const consCount = Array.isArray(e.consumablesUsed) ? e.consumablesUsed.length : 0;
                return (
                  <tr key={e.id} className={checkedItems.includes(e.id) ? 'checked-row' : ''}>
                    <td className="date-cell">
                      <span className="date-display">{formatDateTime(e.date)}</span>
                    </td>
                    <td>{e.customerName || 'N/A'}</td>
                    <td>{e.category || 'Unspecified'}</td>
                    <td>
                      {consCount > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {e.consumablesUsed.map((c, i) => (
                            <span key={i} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {c.name} <span style={{ color: 'var(--text-muted)' }}>×{toNumber(c.quantity)}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {goodsCount > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {e.goodsSold.map((g, i) => (
                            <span key={i} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {g.name} <span style={{ color: 'var(--text-muted)' }}>×{toNumber(g.quantity)}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="price-cell">${m.servicePrice.toFixed(2)}</span>
                    </td>
                    <td className="text-right">
                      <span className="price-cell" style={{ fontWeight: 700 }}>${m.totalPrice.toFixed(2)}</span>
                    </td>
                    <td className="text-right">
                      <span
                        className="price-cell"
                        style={{ fontWeight: 600, color: m.netProfit >= 0 ? '#198754' : '#dc3545' }}
                        title={`Sales $${m.totalPrice.toFixed(2)} − Used cost $${m.consumablesCost.toFixed(2)}`}
                      >
                        ${m.netProfit.toFixed(2)}
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
              <h3 className="modal-title">{editingEntryId ? 'Edit Sold Item' : (formPaymentStatus === 'Stock' ? 'Add Stock In' : 'Add Sold Item')}</h3>
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
                    <label className="form-label">Category</label>
                    <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="form-select" disabled={isSaving}>
                      <option value="">Select Category</option>
                      {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
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
                      disabled={isSaving || consumables.length === 0}
                    >
                      <option value="">Select a Product</option>
                      {consumables.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.unit ? `(${p.unit})` : ''} · stock {toNumber(p.quantity)}
                        </option>
                      ))}
                    </select>
                    {consumables.length === 0 && (
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

              {/* Used items — only for sales (Paid / Unpaid) */}
              {formPaymentStatus !== 'Stock' && (
              <div style={{ marginTop: 'var(--s-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-2)' }}>
                  <label className="form-label" style={{ margin: 0 }}>Used</label>
                  <button className="btn-small btn-secondary" onClick={addConsumableLine} disabled={isSaving || consumables.length === 0} type="button">
                    <IconPlus /> Add Line
                  </button>
                </div>
                {consumables.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    No products in inventory. Add them from <strong>Inventory → Products</strong>.
                  </p>
                ) : formConsumables.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>None — click "Add Line" to log a used item.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                    {formConsumables.map((line, idx) => {
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 'var(--s-2)', alignItems: 'center' }}>
                          <select
                            value={line.productId}
                            onChange={(e) => updateConsumableLine(idx, { productId: e.target.value })}
                            className="form-select"
                            disabled={isSaving}
                          >
                            <option value="">Select item…</option>
                            {consumables.map((c) => (
                              <option key={c.id} value={c.id}>{c.name} {c.unit ? `(${c.unit})` : ''} · stock {toNumber(c.quantity)}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => updateConsumableLine(idx, { quantity: e.target.value })}
                            className="form-input"
                            placeholder="Qty"
                            disabled={isSaving}
                          />
                          <button
                            className="btn-small btn-danger"
                            onClick={() => removeConsumableLine(idx)}
                            disabled={isSaving}
                            type="button"
                            title="Remove"
                          ><IconTrash /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Good Sold — hidden when stocking in (use the section above instead) */}
              {formPaymentStatus !== 'Stock' && (
              <div style={{ marginTop: 'var(--s-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-2)' }}>
                  <label className="form-label" style={{ margin: 0 }}>Sold</label>
                  <button className="btn-small btn-secondary" onClick={addGoodLine} disabled={isSaving || goods.length === 0} type="button">
                    <IconPlus /> Add Line
                  </button>
                </div>
                {goods.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    No products in inventory. Add them from <strong>Inventory → Products</strong>.
                  </p>
                ) : formGoods.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>None — click "Add Line" to sell an item.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                    {formGoods.map((line, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 100px 32px', gap: 'var(--s-2)', alignItems: 'center' }}>
                        <select
                          value={line.productId}
                          onChange={(e) => handleGoodProductChange(idx, e.target.value)}
                          className="form-select"
                          disabled={isSaving}
                        >
                          <option value="">Select item…</option>
                          {goods.map((g) => (
                            <option key={g.id} value={g.id}>{g.name} · stock {toNumber(g.quantity)}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => updateGoodLine(idx, { quantity: e.target.value })}
                          className="form-input"
                          placeholder="Qty"
                          disabled={isSaving}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateGoodLine(idx, { unitPrice: e.target.value })}
                          className="form-input"
                          placeholder="Unit price"
                          disabled={isSaving}
                        />
                        <button
                          className="btn-small btn-danger"
                          onClick={() => removeGoodLine(idx)}
                          disabled={isSaving}
                          type="button"
                          title="Remove"
                        ><IconTrash /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* Remark */}
              <div className="form-group" style={{ marginTop: 'var(--s-3)' }}>
                <label className="form-label">Remark</label>
                <textarea value={formRemark} onChange={(e) => setFormRemark(e.target.value)} className="form-textarea" rows="2" disabled={isSaving} />
              </div>

              {/* Totals — only meaningful for sales, not stock-in */}
              {formPaymentStatus !== 'Stock' && (
                <div className="missing-item-summary" style={{ marginTop: 'var(--s-3)' }}>
                  <span>Service: ${toNumber(formServicePrice).toFixed(2)}</span>
                  <span>Sold: ${formGoodsTotal.toFixed(2)}</span>
                  <span style={{ color: 'var(--brand)' }}>Total: ${formTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
                {isSaving
                  ? 'Saving...'
                  : (editingEntryId ? 'Update Item' : (formPaymentStatus === 'Stock' ? 'Submit Stock In' : 'Save Sold Item'))}
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
              <h3 className="modal-title">Sold Item Details</h3>
              <button className="modal-close" onClick={() => setDetailsEntry(null)}><IconX /></button>
            </div>
            <div className="modal-content">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' }}>
                <div><strong>Customer:</strong> {detailsEntry.customerName || '—'}</div>
                <div><strong>Date:</strong> {formatDateTime(detailsEntry.date)}</div>
                <div><strong>Category:</strong> {detailsEntry.category || '—'}</div>
                <div><strong>Status:</strong> {detailsEntry.paymentStatus || '—'}</div>
                <div><strong>Employee:</strong> {detailsEntry.employee || '—'}</div>
              </div>

              <div style={{ marginTop: 'var(--s-4)' }}>
                <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Used</h4>
                {Array.isArray(detailsEntry.consumablesUsed) && detailsEntry.consumablesUsed.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {detailsEntry.consumablesUsed.map((c, i) => (
                      <li key={i} style={{ padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>x{toNumber(c.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</p>}
              </div>

              <div>
                <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Sold</h4>
                {Array.isArray(detailsEntry.goodsSold) && detailsEntry.goodsSold.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {detailsEntry.goodsSold.map((g, i) => (
                      <li key={i} style={{ padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{g.name} x{toNumber(g.quantity)}</span>
                        <span>${(toNumber(g.quantity) * toNumber(g.unitPrice)).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</p>}
              </div>

              <div className="missing-item-summary">
                <span>Service: ${entryTotals(detailsEntry).servicePrice.toFixed(2)}</span>
                <span>Sold: ${entryTotals(detailsEntry).goodsTotal.toFixed(2)}</span>
                <span style={{ color: 'var(--brand)' }}>Total: ${entryTotals(detailsEntry).totalPrice.toFixed(2)}</span>
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

      {/* Delete Confirm */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Confirm Deletion</h3>
            </div>
            <div className="modal-content">
              <p>Deleting this entry removes it from Maghsal records. Product stock quantity will not be changed automatically. This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-danger" onClick={confirmDelete}>Yes, Delete</button>
              <button className="btn-secondary" onClick={cancelDeleteAction}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maghsal;
