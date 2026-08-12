import React, { useContext, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { database } from '../Auth/firebase';
import { ref, onValue, get, push, remove } from 'firebase/database';
import { UserContext } from '../Auth/userContext';
import '../CSS/soldItems.css';
import { saveBlobToExportFolder } from '../utils/exportFolder';
import {
  createReceiptDoc,
  addReceiptHeader,
  getReceiptDensity,
  receiptTableOptions,
  drawTotalsBlock,
  money,
} from '../utils/pdfReceipt';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { useExchangeRate, convertPrice } from '../utils/exchangeRate';

// ── Helpers ──────────────────────────────────────────────────────────────────
const toNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d) => {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
  } catch { return '—'; }
};

// YYYY-MM-DD -> DD-MM-YYYY for labels/filenames
const isoToDisplay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

const isStockLikeStatus = (status) => String(status || '').toLowerCase().startsWith('stock');

// Mirrors fetchProducts.js: derive the broad type (oil / filter / maghsal / other).
const normalizeScope = (scope, productType = '') => {
  const value = String(scope || '').toLowerCase();
  const type = String(productType || '').toLowerCase();
  if (value.startsWith('maghsal') || type === 'maghsal') return 'maghsal';
  if (value === 'filter' || type.includes('filter')) return 'filter';
  if (value === 'oil' || type.includes('oil')) return 'oil';
  return type ? 'other' : 'oil';
};

const SCOPE_TITLES = { oil: 'Oil', filter: 'Filter', maghsal: 'Maghsal' };
// Section display order — Oil first, then Filter, then Maghsal, then Water Filling, then anything else.
const SECTION_RANK = { Oil: 0, Filter: 1, Maghsal: 2, 'Water Filling': 3 };
const sectionRank = (title) => (title in SECTION_RANK ? SECTION_RANK[title] : 99);

const WATER_FILLING_LABELS = { normal: 'Water Filling', small: 'Water Filling (Small)' };
const waterFillingItemLabel = (type) => WATER_FILLING_LABELS[type] || type || 'Water Filling';

// Oil/Filter per-item revenue (mirrors soldItems.js).
const getItemRevenue = (item) => {
  const quantity = toNumber(item.quantity);
  const parsedItemCost = parseFloat(item.itemCost);
  const hasItemCost = Number.isFinite(parsedItemCost);
  const parsedTotalCost = parseFloat(item.totalCost);
  const hasTotalCost = Number.isFinite(parsedTotalCost);
  const unitSellPrice = hasItemCost
    ? parsedItemCost
    : (quantity > 0 ? (hasTotalCost ? parsedTotalCost / quantity : 0) : 0);
  return { quantity, revenue: hasTotalCost ? parsedTotalCost : unitSellPrice * quantity };
};

// Maghsal per-entry total (mirrors maghsal.js).
const entryServicePrice = (e) => toNumber(e.servicePrice ?? e.price);
const entryGoodsTotal = (e) => {
  if (typeof e.goodsTotal !== 'undefined') return toNumber(e.goodsTotal);
  if (Array.isArray(e.goodsSold)) {
    return e.goodsSold.reduce((acc, g) => acc + toNumber(g.quantity) * toNumber(g.unitPrice), 0);
  }
  return 0;
};
const entryTotal = (e) => {
  if (typeof e.totalPrice !== 'undefined') return toNumber(e.totalPrice);
  return entryServicePrice(e) + entryGoodsTotal(e);
};

const sanitizeCSVCell = (value) => {
  const raw = value == null ? '' : String(value);
  const flattened = raw.replace(/\r?\n/g, ' ');
  return /^[=+\-@]/.test(flattened) ? `'${flattened}` : flattened;
};

const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);

// Locale-aware, case-insensitive name compare (handles Arabic + Latin).
const compareNames = (a, b) =>
  String(a || '').trim().localeCompare(String(b || '').trim(), 'ar-EG', { numeric: true, sensitivity: 'base' });

const GROUP_FILL = [233, 240, 250];

// ── Component ──────────────────────────────────────────────────────────────────
const ClientReports = () => {
  const { user } = useContext(UserContext);
  const exchangeRate = useExchangeRate();

  const [maghsalEntries, setMaghsalEntries] = useState([]);
  const [waterFillingEntries, setWaterFillingEntries] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  // Empty array = no filter (show all statuses). Multi-select: any status in
  // this list is included.
  const [paymentStatusFilters, setPaymentStatusFilters] = useState([]);
  const togglePaymentStatusFilter = (status) => {
    setPaymentStatusFilters((prev) => (
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    ));
  };
  const [message, setMessage] = useState(null);

  const [pendingSnapshot, setPendingSnapshot] = useState(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState(null);
  const [confirm, confirmDialog] = useConfirmDialog();

  // ── Data load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const customersRef = ref(database, 'customers');
    const maghsalRef = ref(database, 'maghsalEntries');
    const waterFillingRef = ref(database, 'waterFillingEntries');
    const soldRef = ref(database, 'SoldItems');
    const productsRef = ref(database, 'products');

    const unsubC = onValue(customersRef, (snap) => {
      const data = snap.exists() ? snap.val() : {};
      const list = Object.keys(data).map((k) => ({
        id: k, name: data[k].name, nameArabic: data[k].nameArabic || '',
      }));
      // Alphabetical by display name (English, falling back to Arabic).
      list.sort((a, b) => compareNames(a.name || a.nameArabic, b.name || b.nameArabic));
      setCustomers(list);
    });

    const unsubM = onValue(maghsalRef, (snap) => {
      const data = snap.exists() ? snap.val() : {};
      setMaghsalEntries(Object.keys(data).map((k) => ({ id: k, ...data[k] })));
    });

    const unsubW = onValue(waterFillingRef, (snap) => {
      const data = snap.exists() ? snap.val() : {};
      setWaterFillingEntries(Object.keys(data).map((k) => ({ id: k, ...data[k] })));
    });

    const unsubP = onValue(productsRef, (snap) => {
      const data = snap.exists() ? snap.val() : {};
      setProducts(Object.keys(data).map((k) => ({ id: k, ...data[k] })));
    });

    // SoldItems' customerName is stored in Arabic; resolve to English when possible.
    const unsubS = onValue(soldRef, (snap) => {
      get(customersRef).then((cSnap) => {
        const cData = cSnap.exists() ? cSnap.val() : {};
        const cList = Object.keys(cData).map((k) => ({
          id: k, name: cData[k].name, nameArabic: cData[k].nameArabic || '',
        }));
        const data = snap.exists() ? snap.val() : {};
        const list = Object.keys(data)
          .map((k) => ({
            id: k,
            ...data[k],
            customerName: cList.find((c) => c.nameArabic === data[k].customerName)?.name || data[k].customerName,
          }))
          .filter((item) => !isStockLikeStatus(item.paymentStatus));
        setSoldItems(list);
      });
    });

    return () => { unsubC(); unsubM(); unsubW(); unsubP(); unsubS(); };
  }, []);

  const applyHistorySnapshot = (snap) => {
    const data = snap.exists() ? snap.val() : {};
    const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
    list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    setReportHistory(list);
  };

  // Manual refetch — used right after saving a new report and by the Refresh
  // button, so history is current even if the live listener ever drops
  // (e.g. after a permission error, Firebase does not auto-resubscribe it).
  const fetchReportHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const snap = await get(ref(database, 'reports'));
      applyHistorySnapshot(snap);
    } catch (err) {
      console.error('Failed to refresh report history:', err);
      flash(`Failed to refresh report history: ${err?.message || err}`);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Saved report history — frozen snapshots created via the Generate flow.
  useEffect(() => {
    const historyRef = ref(database, 'reports');
    const unsub = onValue(historyRef, applyHistorySnapshot, (err) => {
      console.error('Failed to load report history:', err);
      flash(`Failed to load report history: ${err?.message || err}`);
    });
    return () => unsub();
  }, []);

  const flash = (msg) => { setMessage(msg); setTimeout(() => setMessage(null), 3000); };

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) || null,
    [customers, customerId]
  );

  // ── Date range bounds (blank => unbounded) ────────────────────────────────────
  const bounds = useMemo(() => ({
    fromMs: dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity,
    toMs: dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Infinity,
  }), [dateFrom, dateTo]);

  const inRange = (dateValue) => {
    const ms = new Date(dateValue).getTime();
    if (isNaN(ms)) return false;
    return ms >= bounds.fromMs && ms <= bounds.toMs;
  };

  const matchesSelectedCustomer = (engName, arName) => {
    if (!selectedCustomer) return false;
    return (engName && engName === selectedCustomer.name)
      || (arName && arName === selectedCustomer.nameArabic)
      || (engName && engName === selectedCustomer.nameArabic);
  };

  // Available type options for the filter. Miscellaneous ("other" scope)
  // products are grouped under a single "Other" entry here instead of one
  // dropdown option per individual product name/type (e.g. "Spartan",
  // "Spartan 650ml") — the statement below still shows their real names as
  // section headers, this is only about keeping the filter list clean.
  const availableTypes = useMemo(() => {
    const set = new Set(['Oil', 'Filter', 'Maghsal', 'Water Filling']);
    const hasOther = products.some((p) => normalizeScope(p.scope, p.productType) === 'other');
    if (hasOther) set.add('Other');
    return [...set].sort((a, b) => sectionRank(a) - sectionRank(b) || a.localeCompare(b));
  }, [products]);

  // Determine the section title (Oil / Filter / Maghsal / custom) for a sold item.
  const sectionForSoldItem = (item) => {
    const product = products.find((p) => (
      p.id === item.barcode || p.id === item.productId || p.id === item.id
    ));
    const scopeVal = normalizeScope(product?.scope, product?.productType);
    if (scopeVal === 'other') return (product?.productType || item.category || 'Other');
    return SCOPE_TITLES[scopeVal] || 'Other';
  };

  // "Other" in the Type filter should match any of those individually-named
  // sections, not the literal string "Other".
  const KNOWN_SECTIONS = ['Oil', 'Filter', 'Maghsal', 'Water Filling'];
  const matchesTypeFilter = (section) => {
    if (typeFilter === 'All') return true;
    if (typeFilter === 'Other') return !KNOWN_SECTIONS.includes(section);
    return typeFilter === section;
  };

  // Payment Status options — Paid/Unpaid/Hold always offered regardless of
  // whether any record currently uses them, plus anything else found live.
  // "Used" is intentionally excluded — not a status worth filtering by here.
  const availablePaymentStatuses = useMemo(() => {
    const set = new Set(['Paid', 'Unpaid', 'Hold']);
    maghsalEntries.forEach((e) => set.add(e.paymentStatus || 'N/A'));
    waterFillingEntries.forEach((e) => set.add(e.paymentStatus || 'N/A'));
    soldItems.forEach((it) => set.add(it.paymentStatus || 'N/A'));
    set.delete('Used');
    return [...set].sort();
  }, [maghsalEntries, waterFillingEntries, soldItems]);

  // ── Client statement, grouped into sections (Oil, Filter, Maghsal, …) ─────────
  const statement = useMemo(() => {
    if (!selectedCustomer) return { sections: [], paid: 0, unpaid: 0, grandTotal: 0 };

    const records = [];

    const matchesStatusFilter = (status) => paymentStatusFilters.length === 0 || paymentStatusFilters.includes(status || 'N/A');

    maghsalEntries.forEach((e) => {
      if (typeFilter !== 'All' && typeFilter !== 'Maghsal') return;
      if (!matchesSelectedCustomer(e.customerName, e.customerNameArabic)) return;
      if (!inRange(e.date)) return;
      if (!matchesStatusFilter(e.paymentStatus)) return;
      records.push({
        key: `m-${e.id}`,
        date: e.date,
        section: 'Maghsal',
        item: e.category || 'Service',
        quantity: toNumber(e.quantity ?? e.consumablesUsed?.[0]?.quantity),
        total: entryTotal(e),
        status: e.paymentStatus || 'N/A',
      });
    });

    waterFillingEntries.forEach((e) => {
      if (typeFilter !== 'All' && typeFilter !== 'Water Filling') return;
      if (!matchesSelectedCustomer(e.customerName, e.customerNameArabic)) return;
      if (!inRange(e.date)) return;
      if (!matchesStatusFilter(e.paymentStatus)) return;
      // Statement totals are USD-denominated — convert LBP premiums so they
      // aggregate correctly alongside Oil/Filter/Maghsal totals.
      const totalUSD = e.premiumCurrency === 'LBP'
        ? convertPrice(toNumber(e.totalPremium), 'LBP', exchangeRate)
        : toNumber(e.totalPremium);
      records.push({
        key: `w-${e.id}`,
        date: e.date,
        section: 'Water Filling',
        item: waterFillingItemLabel(e.transactionType),
        quantity: toNumber(e.quantity),
        total: totalUSD,
        status: e.paymentStatus || 'N/A',
      });
    });

    soldItems.forEach((it) => {
      if (!matchesSelectedCustomer(it.customerName, it.customerName)) return;
      if (!inRange(it.dateScanned)) return;
      const section = sectionForSoldItem(it);
      if (!matchesTypeFilter(section)) return;
      if (!matchesStatusFilter(it.paymentStatus)) return;
      const { quantity, revenue } = getItemRevenue(it);
      records.push({
        key: `o-${it.id}`,
        date: it.dateScanned,
        section,
        item: it.name || 'Item',
        quantity,
        total: revenue,
        status: it.paymentStatus || 'N/A',
      });
    });

    const map = new Map();
    records.forEach((r) => {
      const g = map.get(r.section) || { section: r.section, rows: [], subtotal: 0 };
      g.rows.push(r);
      g.subtotal += r.total;
      map.set(r.section, g);
    });

    const sections = [...map.values()];
    // Rows within a section: chronological by date.
    sections.forEach((g) => g.rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    // Sections: Oil, Filter, Maghsal, then the rest alphabetically.
    sections.sort((a, b) => sectionRank(a.section) - sectionRank(b.section) || a.section.localeCompare(b.section));

    let paid = 0, unpaid = 0, grandTotal = 0;
    records.forEach((r) => {
      grandTotal += r.total;
      if (r.status === 'Paid') paid += r.total;
      else if (r.status === 'Unpaid') unpaid += r.total;
    });

    return { sections, paid, unpaid, grandTotal };
  }, [selectedCustomer, maghsalEntries, waterFillingEntries, soldItems, products, typeFilter, paymentStatusFilters, bounds, exchangeRate]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordCount = useMemo(
    () => statement.sections.reduce((acc, g) => acc + g.rows.length, 0),
    [statement]
  );

  // ── Range label for headers / filenames ───────────────────────────────────────
  const rangeLabel = () => {
    if (dateFrom && dateTo) return `From ${isoToDisplay(dateFrom)} to ${isoToDisplay(dateTo)}`;
    if (dateFrom) return `From ${isoToDisplay(dateFrom)}`;
    if (dateTo) return `Up to ${isoToDisplay(dateTo)}`;
    return 'All time';
  };

  const fileLabel = () => {
    const parts = ['Client_Report'];
    if (selectedCustomer) parts.push(safeName(selectedCustomer.name));
    parts.push(dateFrom || dateTo ? `${dateFrom || 'start'}_to_${dateTo || 'now'}` : 'all_time');
    return parts.join('_');
  };

  // ── Report History (frozen snapshots) ─────────────────────────────────────────
  const viewedEntry = useMemo(
    () => reportHistory.find((h) => h.id === viewingHistoryId) || null,
    [reportHistory, viewingHistoryId]
  );

  const generateReport = () => {
    if (!selectedCustomer) { flash('Select a client first.'); return; }
    if (recordCount === 0) { flash('No activity for this client in range.'); return; }
    setViewingHistoryId(null);
    setPendingSnapshot({
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerNameArabic: selectedCustomer.nameArabic || '',
      typeFilter,
      dateFrom,
      dateTo,
      rangeLabel: rangeLabel(),
      recordCount,
      sections: statement.sections,
      paid: statement.paid,
      unpaid: statement.unpaid,
      grandTotal: statement.grandTotal,
    });
  };

  const cancelGenerate = () => setPendingSnapshot(null);

  const confirmGenerate = async () => {
    if (!pendingSnapshot) return;
    const snapshot = pendingSnapshot;
    // Close the popup immediately — saving continues in the background.
    setPendingSnapshot(null);
    setIsSavingReport(true);
    try {
      await push(ref(database, 'reports'), {
        ...snapshot,
        generatedAt: new Date().toISOString(),
        generatedBy: user?.name || user?.displayName || user?.email || 'Unknown',
      });
      await fetchReportHistory();
      flash('Report saved to history.');
    } catch (err) {
      console.error('Failed to save report to history:', err);
      flash(`Failed to save report: ${err?.message || err}`);
    } finally {
      setIsSavingReport(false);
    }
  };

  const viewHistoryEntry = (id) => setViewingHistoryId(id);
  const backToLiveView = () => setViewingHistoryId(null);

  const requestDeleteHistory = async (id) => {
    const confirmed = await confirm({
      title: 'Delete this saved report?',
      message: 'This removes it from Report History. This action cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await remove(ref(database, `reports/${id}`));
      if (viewingHistoryId === id) setViewingHistoryId(null);
      flash('Report removed from history.');
    } catch (err) {
      console.error('Failed to delete report:', err);
      flash(`Failed to delete report: ${err?.message || err}`);
    }
  };

  // ── PDF export (A5 landscape — shared receipt theme), grouped into sections ────
  // Shared builder — used for both the live statement and a saved history snapshot.
  const buildAndSaveStatementPDF = async ({ sections, paid, unpaid, grandTotal, recordCount: count, customerName, rangeLabel: range, filename }) => {
    const doc = createReceiptDoc(jsPDF);
    const density = getReceiptDensity(count + sections.length);
    const startY = await addReceiptHeader(doc, {
      title: 'CLIENT REPORT',
      // subtitle: 'Statement by Type',
      client: customerName,
      dateRange: range,
      showLogo: false,
      showCompanyInfo: false,
      showReceiptNo: false,
      showDateRangeLabel: false,
    });

    const body = [];
    const groupHeaderIndexes = new Set();
    const groupTotalIndexes = new Set();
    sections.forEach((g) => {
      groupHeaderIndexes.add(body.length);
      body.push([{ content: g.section, colSpan: 6 }]);

      g.rows.forEach((r) => {
        const qty = toNumber(r.quantity);
        const priceCell = qty > 0 ? money(r.total / qty) : '—';
        body.push([formatDate(r.date), r.item, r.quantity || '—', priceCell, r.status, money(r.total)]);
      });

      groupTotalIndexes.add(body.length);
      body.push([
        { content: `${g.section} Total`, colSpan: 5, styles: { halign: 'right' } },
        { content: money(g.subtotal) },
      ]);
    });

    autoTable(doc, {
      ...receiptTableOptions({
        head: ['Date', 'Item', 'Quantity', 'Price per unit', 'Status', 'Total'],
        body,
        startY,
        rightAlignedColumns: [2, 3, 5],
        density,
      }),
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 48 },
        2: { halign: 'right', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 24 },
        4: { cellWidth: 28 },
        5: { halign: 'right', cellWidth: 34 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && (groupHeaderIndexes.has(data.row.index) || groupTotalIndexes.has(data.row.index))) {
          data.cell.styles.fillColor = GROUP_FILL;
          data.cell.styles.fontStyle = 'bold';
          if (data.column.index === 5) data.cell.styles.halign = 'right';
        } else if (data.section === 'body' && data.column.index === 5) {
          // Line-item totals stay small so the Grand Total banner below
          // reads as the headline figure on the receipt.
          data.cell.styles.fontSize = Math.max(density.fontSize - 1.5, 5.5);
        }
      },
    });

    drawTotalsBlock(doc, {
      paid,
      unpaid,
      grandTotal,
      startY: doc.lastAutoTable.finalY + 4,
      compact: density.totalsCompact,
      showBreakdown: false,
    });

    const blob = doc.output('blob');
    const result = await saveBlobToExportFolder(blob, filename);
    if (result.strategy === 'folder') flash(`Saved to "${result.folderName}/${filename}"`);
  };

  const exportPDF = async () => {
    if (!selectedCustomer) { flash('Select a client first.'); return; }
    if (recordCount === 0) { flash('No activity for this client in range.'); return; }
    await buildAndSaveStatementPDF({
      sections: statement.sections,
      paid: statement.paid,
      unpaid: statement.unpaid,
      grandTotal: statement.grandTotal,
      recordCount,
      customerName: selectedCustomer.name,
      rangeLabel: rangeLabel(),
      filename: `${fileLabel()}.pdf`,
    });
  };

  const exportHistoryPDF = async (entry) => {
    if (!entry) return;
    const parts = ['Client_Report', safeName(entry.customerName), entry.dateFrom || entry.dateTo ? `${entry.dateFrom || 'start'}_to_${entry.dateTo || 'now'}` : 'all_time'];
    await buildAndSaveStatementPDF({
      sections: entry.sections,
      paid: entry.paid,
      unpaid: entry.unpaid,
      grandTotal: entry.grandTotal,
      recordCount: entry.recordCount,
      customerName: entry.customerName,
      rangeLabel: entry.rangeLabel,
      filename: `${parts.join('_')}.pdf`,
    });
  };

  // ── CSV export ────────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    if (!selectedCustomer) { flash('Select a client first.'); return; }
    if (recordCount === 0) { flash('No activity for this client in range.'); return; }

    const headers = ['Date', 'Type', 'Item', 'Quantity', 'Status', 'Total'];
    const rows = [];
    statement.sections.forEach((g) => {
      g.rows.forEach((r) => rows.push([formatDate(r.date), g.section, r.item, r.quantity || '', r.status, r.total.toFixed(2)]));
      rows.push(['', `${g.section} Subtotal`, '', '', '', g.subtotal.toFixed(2)]);
      rows.push([]);
    });
    rows.push(['Total Paid', '', '', '', '', statement.paid.toFixed(2)]);
    rows.push(['Total Unpaid', '', '', '', '', statement.unpaid.toFixed(2)]);
    rows.push(['Grand Total', '', '', '', '', statement.grandTotal.toFixed(2)]);

    const csv = '﻿' +
      [headers, ...rows]
        .map((r) => (Array.isArray(r) ? r : []).map((c) => `"${sanitizeCSVCell(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `${fileLabel()}.csv`;
    const result = await saveBlobToExportFolder(blob, filename);
    if (result.strategy === 'folder') flash(`Saved to "${result.folderName}/${filename}"`);
  };

  // ── Quick range presets ───────────────────────────────────────────────────────
  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const setRangeAll = () => { setDateFrom(''); setDateTo(''); };
  const setRangeToday = () => { const t = isoOf(new Date()); setDateFrom(t); setDateTo(t); };
  const setRangeWeek = () => { const d = new Date(); d.setDate(d.getDate() - 6); setDateFrom(isoOf(d)); setDateTo(isoOf(new Date())); };
  const setRangeThisMonth = () => { const d = new Date(); setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); setDateTo(isoOf(new Date())); };
  const setRangeMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); setDateFrom(isoOf(d)); setDateTo(isoOf(new Date())); };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <div className="page-shell-header">
        <div className="page-shell-header-left">
          <h1 className="page-shell-header-title">Reports</h1>
          <p className="page-shell-header-subtitle">
            Per-client statement grouped by type — Oil, Filter, Maghsal, Water Filling and more.
          </p>
        </div>
        <div className="page-shell-header-actions">
          <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="btn-secondary" onClick={exportPDF}>Export PDF</button>
          <button className="btn-primary" onClick={generateReport}>Generate Report</button>
        </div>
      </div>

      {message && <div className="success-message">{message}</div>}

      {/* Controls */}
      <div className="ui-card">
        <div className="ui-card-header">
          <h2 className="ui-card-title">Report Settings</h2>
        </div>

        <div className="filters-grid">
          <div className="filter-group">
            <label>Client</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select client…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.nameArabic ? ` — ${c.nameArabic}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="All">All</option>
              {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Payment Status <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}></span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {availablePaymentStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={paymentStatusFilters.includes(s) ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => togglePaymentStatusFilter(s)}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  {s}
                </button>
              ))}
              {paymentStatusFilters.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPaymentStatusFilters([])}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="filter-group">
            <label>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="filter-actions" style={{ marginTop: 'var(--s-3)' }}>
          <button className="btn-secondary" onClick={setRangeAll}>All time</button>
          <button className="btn-secondary" onClick={setRangeToday}>Today</button>
          <button className="btn-secondary" onClick={setRangeWeek}>Last 7 days</button>
          <button className="btn-secondary" onClick={setRangeThisMonth}>This month</button>
          <button className="btn-secondary" onClick={setRangeMonth}>Last 30 days</button>
        </div>
      </div>

      {/* Client statement, grouped by type */}
      <div className="ui-card">
        <div className="ui-card-header">
          <h2 className="ui-card-title">
            Statement {selectedCustomer ? `— ${selectedCustomer.name}` : ''}
          </h2>
          <span className="ui-card-subtle">{recordCount} record(s) · {rangeLabel()}</span>
        </div>

        {!selectedCustomer ? (
          <div className="empty-state-card">Select a client to view their statement.</div>
        ) : recordCount === 0 ? (
          <div className="empty-state-card">No activity for this client in the selected range.</div>
        ) : (
          <>
            <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Price per unit</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.sections.map((g) => (
                    <React.Fragment key={g.section}>
                      <tr style={{ background: 'var(--surface-2, #e9f0fa)' }}>
                        <td colSpan={6} style={{ fontWeight: 700 }}>{g.section}</td>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.key}>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.item}</td>
                          <td className="text-right">{r.quantity || '—'}</td>
                          <td className="text-right">
                            {toNumber(r.quantity) > 0 ? `$${formatCurrency(r.total / toNumber(r.quantity))}` : '—'}
                          </td>
                          <td><span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                          <td className="text-right" style={{ fontWeight: 600 }}>${formatCurrency(r.total)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--surface-2, #e9f0fa)' }}>
                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>{g.section} Total</td>
                        <td className="text-right" style={{ fontWeight: 700 }}>${formatCurrency(g.subtotal)}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="missing-item-summary" style={{ marginTop: 'var(--s-3)', padding: '16px 18px' }}>
              <span style={{ color: 'var(--brand)', fontWeight: 800, fontSize: 26 }}>Grand Total: ${formatCurrency(statement.grandTotal)}</span>
            </div>
          </>
        )}
      </div>

      {/* Report History — frozen snapshots saved via Generate Report */}
      <div className="ui-card">
        <div className="ui-card-header">
          <h2 className="ui-card-title">Report History</h2>
          <span className="ui-card-subtle">{reportHistory.length} saved report(s)</span>
          <button className="btn-secondary" onClick={fetchReportHistory} disabled={isLoadingHistory}>
            {isLoadingHistory ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {reportHistory.length === 0 ? (
          <div className="empty-state-card">No reports generated yet. Use "Generate Report" above to save one.</div>
        ) : (
          <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Generated</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Range</th>
                  <th className="text-right">Total</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reportHistory.map((h) => (
                  <tr key={h.id} style={h.id === viewingHistoryId ? { background: 'var(--surface-2, #e9f0fa)' } : undefined}>
                    <td>{formatDate(h.generatedAt)}</td>
                    <td>{h.customerName}</td>
                    <td>{h.typeFilter}</td>
                    <td>{h.rangeLabel}</td>
                    <td className="text-right">${formatCurrency(h.grandTotal)}</td>
                    <td>{h.generatedBy}</td>
                    <td>
                      <button className="btn-secondary" onClick={() => viewHistoryEntry(h.id)}>View</button>{' '}
                      <button className="btn-danger" onClick={() => requestDeleteHistory(h.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View saved report popup */}
      {viewedEntry && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Saved Report — {viewedEntry.customerName}</h3>
              <button className="modal-close" onClick={backToLiveView}>×</button>
            </div>
            <div className="modal-content">
              <span className="ui-card-subtle">
                Type: {viewedEntry.typeFilter} · Range: {viewedEntry.rangeLabel} · {viewedEntry.recordCount} record(s)
                · Generated {formatDate(viewedEntry.generatedAt)} by {viewedEntry.generatedBy}
              </span>

              <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Price per unit</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewedEntry.sections.map((g) => (
                      <React.Fragment key={g.section}>
                        <tr style={{ background: 'var(--surface-2, #e9f0fa)' }}>
                          <td colSpan={6} style={{ fontWeight: 700 }}>{g.section}</td>
                        </tr>
                        {g.rows.map((r) => (
                          <tr key={r.key}>
                            <td>{formatDate(r.date)}</td>
                            <td>{r.item}</td>
                            <td className="text-right">{r.quantity || '—'}</td>
                            <td className="text-right">
                              {toNumber(r.quantity) > 0 ? `$${formatCurrency(r.total / toNumber(r.quantity))}` : '—'}
                            </td>
                            <td><span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                            <td className="text-right" style={{ fontWeight: 600 }}>${formatCurrency(r.total)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--surface-2, #e9f0fa)' }}>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>{g.section} Total</td>
                          <td className="text-right" style={{ fontWeight: 700 }}>${formatCurrency(g.subtotal)}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="missing-item-summary" style={{ padding: '16px 18px' }}>
                <span style={{ color: 'var(--brand)', fontWeight: 800, fontSize: 26 }}>Grand Total: ${formatCurrency(viewedEntry.grandTotal)}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => exportHistoryPDF(viewedEntry)}>Export PDF</button>
              <button className="btn-secondary" onClick={backToLiveView}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Report confirmation */}
      {pendingSnapshot && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Save this report to history?</h3>
            </div>
            <div className="modal-content">
              <p>
                Client: <strong>{pendingSnapshot.customerName}</strong><br />
                Type: {pendingSnapshot.typeFilter} · Range: {pendingSnapshot.rangeLabel}<br />
                {pendingSnapshot.recordCount} record(s) · Grand Total: ${formatCurrency(pendingSnapshot.grandTotal)}
              </p>
              <p>Confirming will save a snapshot to Report History so you can find it again later without regenerating it.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={confirmGenerate} disabled={isSavingReport}>
                {isSavingReport ? 'Saving…' : 'OK'}
              </button>
              <button className="btn-secondary" onClick={cancelGenerate} disabled={isSavingReport}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
};

export default ClientReports;
