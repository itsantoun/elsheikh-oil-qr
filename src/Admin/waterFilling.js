import React, { useState, useEffect, useContext, useMemo } from 'react';
import { database } from '../Auth/firebase';
import { ref, update, onValue, push } from 'firebase/database';
import { UserContext } from '../Auth/userContext';
import '../CSS/soldItems.css';
import { IconRefresh, IconX, IconPlus, IconEdit, IconTrash } from '../utils/icons';
import PageHeader from '../Components/PageHeader';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { useExchangeRate, formatUSD, formatLBP, formatNumberInput, stripCommas } from '../utils/exchangeRate';

const TRANSACTION_TYPES = [
  { value: 'normal', label: 'Water Filling' },
  { value: 'small', label: 'Water Filling (Small)' },
];

const getTransactionTypeLabel = (value) => TRANSACTION_TYPES.find((t) => t.value === value)?.label || value;

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

const WaterFilling = () => {
  const { user } = useContext(UserContext);
  const [entries, setEntries] = useState([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [customers, setCustomers] = useState([]);

  // Filters
  const [customerFilter, setCustomerFilter] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('All');
  // Empty array = no filter (show all statuses). Multi-select: any status in
  // this list is included.
  const [paymentStatusFilters, setPaymentStatusFilters] = useState([]);
  const togglePaymentStatusFilter = (status) => {
    setPaymentStatusFilters((prev) => (
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    ));
  };
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bulk payment-status selection — persisted so a page refresh doesn't
  // silently drop what was checked (same pattern as Oil Sold Items).
  const [selectedIds, setSelectedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('waterFillingSelectedIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('waterFillingSelectedIds', JSON.stringify(selectedIds));
    } catch { /* ignore storage errors (private mode, quota, etc.) */ }
  }, [selectedIds]);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formTransactionType, setFormTransactionType] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formTotalPremium, setFormTotalPremium] = useState('');
  // True once the user has hand-edited Total Premium — while true, changing
  // quantity no longer overwrites their override. Reset whenever customer or
  // transaction type changes, since that implies a genuinely different premium.
  const [totalPremiumTouched, setTotalPremiumTouched] = useState(false);
  const [formPaymentStatus, setFormPaymentStatus] = useState('Unpaid');
  const [formDatePaid, setFormDatePaid] = useState('');
  const [formRemark, setFormRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [confirm, confirmDialog] = useConfirmDialog();
  const exchangeRate = useExchangeRate();

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

  const formatDateForInput = (d) => {
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    } catch { return ''; }
  };

  const getDateDisplay = (v) => {
    if (!v) return '';
    const [y, m, d] = v.split('-');
    return `${d}-${m}-${y}`;
  };

  const sortByDate = (items, order = 'asc') => {
    return [...items].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return order === 'asc' ? da - db : db - da;
    });
  };

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
    const entriesRef = ref(database, 'waterFillingEntries');

    const unsubCustomers = onValue(customersRef, (snap) => {
      let list = [];
      if (snap.exists()) {
        const data = snap.val();
        list = Object.keys(data)
          .map((k) => ({
            id: k,
            name: data[k].name,
            nameArabic: data[k].nameArabic,
            waterFillingSizes: data[k].waterFillingSizes || [],
            waterFillingPricing: data[k].waterFillingPricing || {},
          }))
          .filter((c) => (c.waterFillingSizes || []).length > 0);
        list.sort(sortByName);
      }
      setCustomers(list);
    });

    const unsubEntries = onValue(entriesRef, (snap) => {
      if (!snap.exists()) { setEntries([]); setEntriesLoaded(true); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
      setEntries(sortByDate(list, 'desc'));
      setEntriesLoaded(true);
    });

    return () => { unsubCustomers(); unsubEntries(); };
  }, []);

  const selectedFormCustomer = customers.find((c) => c.id === formCustomerId) || null;

  // Premium for the currently selected customer + transaction type.
  const selectedPremium = (formTransactionType && selectedFormCustomer?.waterFillingPricing?.[formTransactionType]) || null;
  const totalPremiumCurrency = selectedPremium?.currency || 'USD';

  // Total Premium = Premium * Quantity, recalculated below whenever the
  // customer, type, or quantity changes — unless the user has typed a
  // manual override into the Total Premium field.
  const recalcTotalPremium = (customerId, type, quantity) => {
    const customer = customers.find((c) => c.id === customerId);
    const premium = customer?.waterFillingPricing?.[type] || null;
    return premium ? String(toNumber(premium.price) * toNumber(quantity)) : '';
  };

  // Shows the amount only in the currency it was actually entered in — no
  // USD/LBP conversion, since a customer's Water Filling premium is fixed in
  // whichever currency their pricing was set up in.
  const formatPremium = (amount, currency) => (currency === 'USD' ? formatUSD(amount) : formatLBP(amount));

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

    if (transactionTypeFilter !== 'All') {
      result = result.filter((e) => (e.transactionType || '') === transactionTypeFilter);
    }

    if (paymentStatusFilters.length > 0) {
      result = result.filter((e) => paymentStatusFilters.includes(e.paymentStatus || ''));
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

    return sortByDate(result, 'desc');
  }, [entries, customerFilter, transactionTypeFilter, paymentStatusFilters, dateFromFilter, dateToFilter]);

  // Drop any selected ids that were actually deleted from Firebase — pruning
  // against `entries` (not `filtered`), so a filter that merely hides a
  // selected row doesn't permanently drop it from the selection. Skipped
  // until entries have loaded at least once, so a page refresh doesn't wipe
  // a restored (localStorage) selection against a still-empty list.
  useEffect(() => {
    if (!entriesLoaded) return;
    setSelectedIds((prev) => prev.filter((id) => entries.some((e) => e.id === id)));
  }, [entries, entriesLoaded]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.includes(e.id));
  const toggleSelectAll = () => {
    setSelectedIds(allFilteredSelected ? [] : filtered.map((e) => e.id));
  };

  const clearSelection = () => setSelectedIds([]);

  // Clicking "Paid" opens this inline picker instead of applying immediately,
  // so one Date Paid can be applied to every selected entry at once.
  const [showBulkDatePaid, setShowBulkDatePaid] = useState(false);
  const [bulkDatePaid, setBulkDatePaid] = useState(() => formatDateForInput(new Date().toISOString()));

  const handleBulkPaymentStatus = async (status, datePaid = null) => {
    if (selectedIds.length === 0 || isBulkUpdating) return;
    setIsBulkUpdating(true);
    try {
      const updates = {};
      selectedIds.forEach((id) => {
        updates[`waterFillingEntries/${id}/paymentStatus`] = status;
        if (status === 'Paid') {
          updates[`waterFillingEntries/${id}/datePaid`] = convertDateInputToISO(datePaid || formatDateForInput(new Date().toISOString()));
        }
      });
      await update(ref(database), updates);
      flash(`Marked ${selectedIds.length} ${selectedIds.length === 1 ? 'entry' : 'entries'} as ${status}.`);
      setSelectedIds([]);
      setShowBulkDatePaid(false);
    } catch (err) {
      console.error('Bulk payment status update failed:', err);
      flash(`Failed to update entries: ${err?.message || err}`, 'error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkStatusClick = (status) => {
    if (status === 'Paid') {
      setBulkDatePaid(formatDateForInput(new Date().toISOString()));
      setShowBulkDatePaid(true);
      return;
    }
    handleBulkPaymentStatus(status);
  };

  const totals = useMemo(() => {
    const t = {
      count: 0, quantity: 0, paidCount: 0, unpaidCount: 0, holdCount: 0, freeCount: 0,
      totalPremiumUSD: 0, totalPremiumLBP: 0,
    };
    for (const e of filtered) {
      t.count += 1;
      t.quantity += toNumber(e.quantity);
      if (e.paymentStatus === 'Paid') t.paidCount += 1;
      else if (e.paymentStatus === 'Hold') t.holdCount += 1;
      else if (e.paymentStatus === 'Free') t.freeCount += 1;
      else t.unpaidCount += 1;

      if (e.premiumCurrency === 'LBP') t.totalPremiumLBP += toNumber(e.totalPremium);
      else t.totalPremiumUSD += toNumber(e.totalPremium);
    }
    return t;
  }, [filtered]);

  const clearAllFilters = () => {
    setCustomerFilter('');
    setTransactionTypeFilter('All');
    setPaymentStatusFilters([]);
    setDateFromFilter('');
    setDateToFilter('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Add / Edit modal ──────────────────────────────
  const openAddModal = () => {
    setEditingEntryId(null);
    setFormCustomerId('');
    setFormTransactionType('');
    setFormDate(formatDateForInput(new Date().toISOString()));
    setFormQuantity('1');
    setFormTotalPremium('');
    setTotalPremiumTouched(false);
    setFormPaymentStatus('Unpaid');
    setFormDatePaid('');
    setFormRemark('');
    setShowModal(true);
  };

  const openEditModal = (entry) => {
    setEditingEntryId(entry.id);
    setFormCustomerId(entry.customerId || customers.find((c) => c.name === entry.customerName)?.id || '');
    setFormTransactionType(entry.transactionType || '');
    setFormDate(formatDateForInput(entry.date));
    setFormQuantity(String(toNumber(entry.quantity)));
    // Preserve the saved Total Premium as-is (treated as a manual value) so
    // reopening for edit doesn't silently recompute it from current pricing.
    setFormTotalPremium(entry.totalPremium != null ? String(toNumber(entry.totalPremium)) : '');
    setTotalPremiumTouched(true);
    setFormPaymentStatus(entry.paymentStatus || 'Unpaid');
    setFormDatePaid(entry.datePaid ? formatDateForInput(entry.datePaid) : '');
    setFormRemark(entry.remark || '');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingEntryId(null); };

  // Switching to Paid defaults Date Paid to today (only if it's not already
  // set) so the field isn't left blank; switching away leaves it untouched.
  const handlePaymentStatusChange = (status) => {
    setFormPaymentStatus(status);
    if (status === 'Paid' && !formDatePaid) {
      setFormDatePaid(formatDateForInput(new Date().toISOString()));
    }
  };

  // Customer picker changes: default the transaction type — auto-pick when
  // the customer only has one Water Filling size checked, otherwise let the
  // user choose between the two. A new customer means a genuinely different
  // premium, so Total Premium recalculates fresh.
  const handleCustomerChange = (customerId) => {
    setFormCustomerId(customerId);
    const customer = customers.find((c) => c.id === customerId);
    const sizes = customer?.waterFillingSizes || [];
    const newType = sizes.length === 1 ? sizes[0] : '';
    setFormTransactionType(newType);
    setTotalPremiumTouched(false);
    setFormTotalPremium(recalcTotalPremium(customerId, newType, formQuantity));
  };

  const handleTransactionTypeChange = (type) => {
    setFormTransactionType(type);
    setTotalPremiumTouched(false);
    setFormTotalPremium(recalcTotalPremium(formCustomerId, type, formQuantity));
  };

  const handleQuantityChange = (value) => {
    setFormQuantity(value);
    if (!totalPremiumTouched) {
      setFormTotalPremium(recalcTotalPremium(formCustomerId, formTransactionType, value));
    }
  };

  const handleTotalPremiumChange = (value) => {
    setFormTotalPremium(value);
    setTotalPremiumTouched(true);
  };

  const canSave = Boolean(
    formCustomerId &&
    formTransactionType &&
    formDate &&
    toNumber(formQuantity) > 0 &&
    !isSaving
  );

  const handleSave = async () => {
    if (!canSave) return;
    const selectedCustomer = customers.find((c) => c.id === formCustomerId);
    if (!selectedCustomer) {
      flash('Selected customer is no longer available.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const premium = selectedCustomer.waterFillingPricing?.[formTransactionType] || null;
      const unitPremium = premium ? toNumber(premium.price) : 0;
      const premiumCurrency = premium ? premium.currency : 'USD';
      const quantity = toNumber(formQuantity);
      // Total Premium is user-editable — save what's in the field (defaulting
      // to Premium × Quantity if it was left blank) rather than forcing the
      // calculated value.
      const totalPremium = formTotalPremium !== '' ? toNumber(formTotalPremium) : unitPremium * quantity;

      const payload = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name || '',
        customerNameArabic: selectedCustomer.nameArabic || '',
        transactionType: formTransactionType,
        date: convertDateInputToISO(formDate),
        quantity,
        unitPremium,
        premiumCurrency,
        totalPremium,
        paymentStatus: formPaymentStatus,
        datePaid: formPaymentStatus === 'Paid'
          ? convertDateInputToISO(formDatePaid || formatDateForInput(new Date().toISOString()))
          : null,
        remark: formRemark.trim(),
      };

      if (editingEntryId) {
        await update(ref(database, `waterFillingEntries/${editingEntryId}`), payload);
        flash('Entry updated.');
      } else {
        await update(push(ref(database, 'waterFillingEntries')), {
          ...payload,
          employee: user?.name || user?.displayName || user?.email || 'Unknown',
          employeeId: user?.uid || '',
          createdAt: new Date().toISOString(),
        });
        flash('Entry saved.');
      }
      closeModal();
    } catch (err) {
      console.error('Water Filling save failed:', err);
      flash(`Failed to save entry: ${err?.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ───────────────────────
  const requestDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Entry?',
      message: 'Deleting this entry removes it from Water Filling records. This action cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await update(ref(database), { [`waterFillingEntries/${id}`]: null });
      flash('Entry deleted.');
    } catch (err) {
      console.error(err);
      flash('Failed to delete entry.', 'error');
    }
  };

  // ── Render ───────────────────────────────────────
  return (
    <div className="page-shell">
      <PageHeader
        title="Water Filling"
        subtitle="Track water filling entries per customer."
        actions={(
          <>
            <button className="btn-secondary" onClick={handleRefresh} disabled={isRefreshing}>
              <IconRefresh /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="btn-primary" onClick={openAddModal}>
              <IconPlus /> Add Entry
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
          <div className="kpi-card">
            <div className="kpi-card-label">Total Quantity</div>
            <div className="kpi-card-value">{totals.quantity}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">Total Account (USD)</div>
            <div className="kpi-card-value">{formatUSD(totals.totalPremiumUSD)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">Total Account (LL)</div>
            <div className="kpi-card-value">{formatLBP(totals.totalPremiumLBP)}</div>
          </div>
          <div className="kpi-card tone-green">
            <div className="kpi-card-label">Paid</div>
            <div className="kpi-card-value">{totals.paidCount}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">Unpaid</div>
            <div className="kpi-card-value">{totals.unpaidCount}</div>
          </div>
          <div className="kpi-card tone-cyan">
            <div className="kpi-card-label">Hold</div>
            <div className="kpi-card-value">{totals.holdCount}</div>
          </div>
          <div className="kpi-card tone-purple">
            <div className="kpi-card-label">Free</div>
            <div className="kpi-card-value">{totals.freeCount}</div>
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
            <label>Transaction Type</label>
            <select value={transactionTypeFilter} onChange={(e) => setTransactionTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              {TRANSACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Payment Status <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}></span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Paid', 'Unpaid', 'Hold', 'Free'].map((s) => (
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
            </div>
          </div>

          <div className="filter-group">
            <label>From Date</label>
            <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
          </div>

          <div className="filter-group">
            <label>To Date</label>
            <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div className="filter-actions">
            <button className="btn-secondary" onClick={clearAllFilters}>Clear Filters</button>
          </div>
          <div className="exchange-rate-banner">
            <span className="exchange-rate-banner-label">Exchange Rate</span>
            <span className="exchange-rate-banner-value">1 USD = {exchangeRate.toLocaleString('en-US')} L.L</span>
          </div>
        </div>
      </div>

      {/* Active filter tags */}
      {(customerFilter || transactionTypeFilter !== 'All' || paymentStatusFilters.length > 0 || dateFromFilter || dateToFilter) && (
        <div className="active-filters">
          <span className="active-filters-title">Active Filters:</span>
          <div className="filter-tags">
            {customerFilter && <span className="filter-tag">Customer: {customerFilter}<button onClick={() => setCustomerFilter('')}><IconX /></button></span>}
            {transactionTypeFilter !== 'All' && <span className="filter-tag">Type: {getTransactionTypeLabel(transactionTypeFilter)}<button onClick={() => setTransactionTypeFilter('All')}><IconX /></button></span>}
            {paymentStatusFilters.map((s) => (
              <span key={s} className="filter-tag">Status: {s}<button onClick={() => togglePaymentStatusFilter(s)}><IconX /></button></span>
            ))}
            {dateFromFilter && <span className="filter-tag">From: {getDateDisplay(dateFromFilter)}<button onClick={() => setDateFromFilter('')}><IconX /></button></span>}
            {dateToFilter && <span className="filter-tag">To: {getDateDisplay(dateToFilter)}<button onClick={() => setDateToFilter('')}><IconX /></button></span>}
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="filters-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>{selectedIds.length} selected</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set payment status:</span>
              {['Paid', 'Unpaid', 'Hold', 'Free'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn-secondary"
                  disabled={isBulkUpdating}
                  onClick={() => handleBulkStatusClick(s)}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={clearSelection} disabled={isBulkUpdating}>Clear Selection</button>
          </div>

          {showBulkDatePaid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date Paid for all {selectedIds.length} selected:</span>
              <input
                type="date"
                value={bulkDatePaid}
                onChange={(e) => setBulkDatePaid(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 12 }}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={isBulkUpdating}
                onClick={() => handleBulkPaymentStatus('Paid', bulkDatePaid)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                Apply
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isBulkUpdating}
                onClick={() => setShowBulkDatePaid(false)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        {filtered.length === 0 ? (
          <div className="empty-table">
            <p>No Water Filling entries match the current filters.</p>
            <button className="btn-secondary" onClick={clearAllFilters} style={{ marginTop: 10 }}>Clear Filters</button>
          </div>
        ) : (
          <table className="data-table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} title="Select all" />
                </th>
                <th>Date</th>
                <th>Customer</th>
                <th>Transaction Type</th>
                <th className="text-right">Quantity</th>
                <th>Premium</th>
                <th>Total Premium</th>
                <th>Status</th>
                <th>Date Paid</th>
                <th>Remark</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className={selectedIds.includes(e.id) ? 'checked-row' : ''}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggleSelected(e.id)} />
                  </td>
                  <td className="date-cell">
                    <span className="date-display">{formatDate(e.date)}</span>
                  </td>
                  <td>{e.customerName || 'N/A'}</td>
                  <td>{getTransactionTypeLabel(e.transactionType)}</td>
                  <td className="text-right">{toNumber(e.quantity)}</td>
                  <td>
                    {e.premiumCurrency ? formatPremium(toNumber(e.unitPremium), e.premiumCurrency) : '—'}
                  </td>
                  <td>
                    {e.premiumCurrency ? formatPremium(toNumber(e.totalPremium), e.premiumCurrency) : '—'}
                  </td>
                  <td>
                    <span className={`status-badge status-${(e.paymentStatus || '').toLowerCase()}`}>{e.paymentStatus || 'N/A'}</span>
                  </td>
                  <td className="date-cell">
                    {e.paymentStatus === 'Paid' && e.datePaid ? <span className="date-display">{formatDate(e.datePaid)}</span> : '—'}
                  </td>
                  <td>{e.remark || '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-small btn-primary" onClick={() => openEditModal(e)} title="Edit Entry">
                        <IconEdit />
                      </button>
                      <button className="btn-small btn-danger" onClick={() => requestDelete(e.id)} title="Delete Entry">
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingEntryId ? 'Edit Entry' : 'Add Water Filling Entry'}</h3>
              <button className="modal-close" onClick={closeModal}><IconX /></button>
            </div>
            <div className="modal-content">
              <div className="exchange-rate-banner" style={{ marginBottom: 'var(--s-3)' }}>
                <span className="exchange-rate-banner-label">Exchange Rate</span>
                <span className="exchange-rate-banner-value">1 USD = {exchangeRate.toLocaleString('en-US')} L.L</span>
              </div>
              <div className="missing-item-form-grid">
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <select value={formCustomerId} onChange={(e) => handleCustomerChange(e.target.value)} className="form-select" disabled={isSaving}>
                    <option value="">Select Customer</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {customers.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      No customers have Water Filling checked yet. Add it from <strong>Customers</strong>.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Type</label>
                  <select
                    value={formTransactionType}
                    onChange={(e) => handleTransactionTypeChange(e.target.value)}
                    className="form-select"
                    disabled={isSaving || !selectedFormCustomer}
                  >
                    <option value="">Select Type</option>
                    {(selectedFormCustomer?.waterFillingSizes || []).map((size) => (
                      <option key={size} value={size}>{getTransactionTypeLabel(size)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="form-input" disabled={isSaving} />
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input type="number" min="1" step="1" value={formQuantity} onChange={(e) => handleQuantityChange(e.target.value)} className="form-input" disabled={isSaving} />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Premium ({totalPremiumCurrency})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumberInput(formTotalPremium)}
                    onChange={(e) => handleTotalPremiumChange(stripCommas(e.target.value))}
                    className="form-input"
                    disabled={isSaving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select value={formPaymentStatus} onChange={(e) => handlePaymentStatusChange(e.target.value)} className="form-select" disabled={isSaving}>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Hold">Hold</option>
                    <option value="Paid">Paid</option>
                    <option value="Free">Free</option>
                  </select>
                </div>

                {formPaymentStatus === 'Paid' && (
                  <div className="form-group">
                    <label className="form-label">Date Paid</label>
                    <input type="date" value={formDatePaid} onChange={(e) => setFormDatePaid(e.target.value)} className="form-input" disabled={isSaving} />
                  </div>
                )}
              </div>

              {selectedPremium && (
                <div className="missing-item-summary" style={{ marginTop: 'var(--s-3)' }}>
                  <span>Premium: {formatPremium(toNumber(selectedPremium.price), selectedPremium.currency)}</span>
                  {formTotalPremium !== '' && (
                    <span style={{ color: 'var(--brand)' }}>
                      Total Premium: {formatPremium(toNumber(formTotalPremium), selectedPremium.currency)}
                      {totalPremiumTouched && ' (manually overridden)'}
                    </span>
                  )}
                </div>
              )}
              {formTransactionType && !selectedPremium && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--s-3)' }}>
                  No pricing set for this customer/type. Set it from <strong>Customers</strong>, or enter Total Premium manually below.
                </p>
              )}

              <div className="form-group" style={{ marginTop: 'var(--s-3)' }}>
                <label className="form-label">Notes / Remark</label>
                <textarea value={formRemark} onChange={(e) => setFormRemark(e.target.value)} className="form-textarea" rows="2" disabled={isSaving} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
                {isSaving ? 'Saving...' : (editingEntryId ? 'Update Entry' : 'Save Entry')}
              </button>
              <button className="btn-secondary" onClick={closeModal} disabled={isSaving}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
};

export default WaterFilling;
