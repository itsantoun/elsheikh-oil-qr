import React, { useState, useEffect, useContext, useMemo } from 'react';
import { database } from '../Auth/firebase';
import { ref, update, onValue, push } from 'firebase/database';
import { UserContext } from '../Auth/userContext';
import '../CSS/soldItems.css';
import { IconRefresh, IconX, IconPlus, IconEdit, IconTrash } from '../utils/icons';
import PageHeader from '../Components/PageHeader';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { formatUSD, formatNumberInput, stripCommas } from '../utils/exchangeRate';

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

const WaterDistribution = () => {
  const { user } = useContext(UserContext);
  const [entries, setEntries] = useState([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [truckTypes, setTruckTypes] = useState([]);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [truckTypeFilter, setTruckTypeFilter] = useState('All');
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
  // silently drop what was checked (same pattern as Water Filling).
  const [selectedIds, setSelectedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('waterDistributionSelectedIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('waterDistributionSelectedIds', JSON.stringify(selectedIds));
    } catch { /* ignore storage errors (private mode, quota, etc.) */ }
  }, [selectedIds]);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formTruckType, setFormTruckType] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnitPrice, setFormUnitPrice] = useState('');
  const [formTotalPrice, setFormTotalPrice] = useState('');
  // True once the user has hand-edited Total Price — while true, changing
  // quantity/unit price no longer overwrites their override.
  const [totalPriceTouched, setTotalPriceTouched] = useState(false);
  const [formPaymentStatus, setFormPaymentStatus] = useState('Unpaid');
  const [formRemark, setFormRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    const employeesRef = ref(database, 'employees');
    const truckTypesRef = ref(database, 'settings/waterDistributionTruckTypes');
    const entriesRef = ref(database, 'waterDistributionEntries');

    const unsubEmployees = onValue(employeesRef, (snap) => {
      let list = [];
      if (snap.exists()) {
        const data = snap.val();
        list = Object.keys(data).map((k) => ({ id: k, name: data[k].name || '', assignedTruckType: data[k].assignedTruckType || '' }));
        list.sort(sortByName);
      }
      setEmployees(list);
    });

    const unsubTruckTypes = onValue(truckTypesRef, (snap) => {
      if (!snap.exists()) { setTruckTypes([]); return; }
      const val = snap.val();
      if (Array.isArray(val)) { setTruckTypes(val.filter((v) => typeof v === 'string' && v.trim())); return; }
      if (val && typeof val === 'object') {
        setTruckTypes(Object.values(val).filter((v) => typeof v === 'string' && v.trim()));
        return;
      }
      setTruckTypes([]);
    });

    const unsubEntries = onValue(entriesRef, (snap) => {
      if (!snap.exists()) { setEntries([]); setEntriesLoaded(true); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
      setEntries(sortByDate(list, 'desc'));
      setEntriesLoaded(true);
    });

    return () => { unsubEmployees(); unsubTruckTypes(); unsubEntries(); };
  }, []);

  // Total Price = Unit Price * Quantity, recalculated whenever unit price or
  // quantity changes — unless the user has typed a manual override.
  const recalcTotalPrice = (unitPrice, quantity) => {
    const price = toNumber(unitPrice);
    return price ? String(price * toNumber(quantity)) : '';
  };

  // ── Filters ──────────────────────────────────────
  const filtered = useMemo(() => {
    let result = entries;

    if (employeeFilter) {
      const ef = employeeFilter.toLowerCase();
      result = result.filter((e) => (e.employeeName || '').toLowerCase().includes(ef));
    }

    if (truckTypeFilter !== 'All') {
      result = result.filter((e) => (e.truckType || '') === truckTypeFilter);
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
  }, [entries, employeeFilter, truckTypeFilter, paymentStatusFilters, dateFromFilter, dateToFilter]);

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

  const handleBulkPaymentStatus = async (status) => {
    if (selectedIds.length === 0 || isBulkUpdating) return;
    setIsBulkUpdating(true);
    try {
      const updates = {};
      selectedIds.forEach((id) => {
        updates[`waterDistributionEntries/${id}/paymentStatus`] = status;
      });
      await update(ref(database), updates);
      flash(`Marked ${selectedIds.length} ${selectedIds.length === 1 ? 'entry' : 'entries'} as ${status}.`);
      setSelectedIds([]);
    } catch (err) {
      console.error('Bulk payment status update failed:', err);
      flash(`Failed to update entries: ${err?.message || err}`, 'error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const totals = useMemo(() => {
    const t = { count: 0, quantity: 0, paidCount: 0, unpaidCount: 0, holdCount: 0, freeCount: 0, totalPriceUSD: 0 };
    for (const e of filtered) {
      t.count += 1;
      t.quantity += toNumber(e.quantity);
      if (e.paymentStatus === 'Paid') t.paidCount += 1;
      else if (e.paymentStatus === 'Hold') t.holdCount += 1;
      else if (e.paymentStatus === 'Free') t.freeCount += 1;
      else t.unpaidCount += 1;

      t.totalPriceUSD += toNumber(e.totalPrice);
    }
    return t;
  }, [filtered]);

  const clearAllFilters = () => {
    setEmployeeFilter('');
    setTruckTypeFilter('All');
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
    setFormEmployeeId('');
    setFormTruckType('');
    setFormDate(formatDateForInput(new Date().toISOString()));
    setFormQuantity('1');
    setFormUnitPrice('');
    setFormTotalPrice('');
    setTotalPriceTouched(false);
    setFormPaymentStatus('Unpaid');
    setFormRemark('');
    setShowModal(true);
  };

  const openEditModal = (entry) => {
    setEditingEntryId(entry.id);
    setFormEmployeeId(entry.employeeId || employees.find((e) => e.name === entry.employeeName)?.id || '');
    setFormTruckType(entry.truckType || '');
    setFormDate(formatDateForInput(entry.date));
    setFormQuantity(String(toNumber(entry.quantity)));
    setFormUnitPrice(entry.unitPrice != null ? String(toNumber(entry.unitPrice)) : '');
    // Preserve the saved Total Price as-is (treated as a manual value) so
    // reopening for edit doesn't silently recompute it.
    setFormTotalPrice(entry.totalPrice != null ? String(toNumber(entry.totalPrice)) : '');
    setTotalPriceTouched(true);
    setFormPaymentStatus(entry.paymentStatus || 'Unpaid');
    setFormRemark(entry.remark || '');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingEntryId(null); };

  // Selecting an employee auto-fills their assigned truck type (if any) as a
  // starting default — the user can still change it manually afterward.
  const handleEmployeeChange = (employeeId) => {
    setFormEmployeeId(employeeId);
    const employee = employees.find((e) => e.id === employeeId);
    if (employee?.assignedTruckType) {
      setFormTruckType(employee.assignedTruckType);
    }
  };

  const handleUnitPriceChange = (value) => {
    setFormUnitPrice(value);
    if (!totalPriceTouched) {
      setFormTotalPrice(recalcTotalPrice(value, formQuantity));
    }
  };

  const handleQuantityChange = (value) => {
    setFormQuantity(value);
    if (!totalPriceTouched) {
      setFormTotalPrice(recalcTotalPrice(formUnitPrice, value));
    }
  };

  const handleTotalPriceChange = (value) => {
    setFormTotalPrice(value);
    setTotalPriceTouched(true);
  };

  const canSave = Boolean(
    formEmployeeId &&
    formTruckType &&
    formDate &&
    toNumber(formQuantity) > 0 &&
    !isSaving
  );

  const handleSave = async () => {
    if (!canSave) return;
    const selectedEmployee = employees.find((e) => e.id === formEmployeeId);
    if (!selectedEmployee) {
      flash('Selected employee is no longer available.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const quantity = toNumber(formQuantity);
      const unitPrice = toNumber(formUnitPrice);
      // Total Price is user-editable — save what's in the field (defaulting
      // to Unit Price × Quantity if it was left blank) rather than forcing
      // the calculated value.
      const totalPrice = formTotalPrice !== '' ? toNumber(formTotalPrice) : unitPrice * quantity;

      const payload = {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name || '',
        truckType: formTruckType,
        date: convertDateInputToISO(formDate),
        quantity,
        unitPrice,
        totalPrice,
        paymentStatus: formPaymentStatus,
        remark: formRemark.trim(),
      };

      if (editingEntryId) {
        await update(ref(database, `waterDistributionEntries/${editingEntryId}`), payload);
        flash('Entry updated.');
      } else {
        await update(push(ref(database, 'waterDistributionEntries')), {
          ...payload,
          loggedBy: user?.name || user?.displayName || user?.email || 'Unknown',
          loggedByUid: user?.uid || '',
          createdAt: new Date().toISOString(),
        });
        flash('Entry saved.');
      }
      closeModal();
    } catch (err) {
      console.error('Water Distribution save failed:', err);
      flash(`Failed to save entry: ${err?.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ───────────────────────
  const requestDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Entry?',
      message: 'Deleting this entry removes it from Water Distribution records. This action cannot be undone.',
    });
    if (!confirmed) return;
    try {
      await update(ref(database), { [`waterDistributionEntries/${id}`]: null });
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
        title="Water Distribution"
        subtitle="Track water distribution entries per employee."
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
            <div className="kpi-card-value">{formatUSD(totals.totalPriceUSD)}</div>
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
            <label>Employee</label>
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
              <option value="">All Employees</option>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Truck Type</label>
            <select value={truckTypeFilter} onChange={(e) => setTruckTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              {truckTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Payment Status</label>
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

        <div className="filter-actions">
          <button className="btn-secondary" onClick={clearAllFilters}>Clear Filters</button>
        </div>
      </div>

      {/* Active filter tags */}
      {(employeeFilter || truckTypeFilter !== 'All' || paymentStatusFilters.length > 0 || dateFromFilter || dateToFilter) && (
        <div className="active-filters">
          <span className="active-filters-title">Active Filters:</span>
          <div className="filter-tags">
            {employeeFilter && <span className="filter-tag">Employee: {employeeFilter}<button onClick={() => setEmployeeFilter('')}><IconX /></button></span>}
            {truckTypeFilter !== 'All' && <span className="filter-tag">Truck: {truckTypeFilter}<button onClick={() => setTruckTypeFilter('All')}><IconX /></button></span>}
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
        <div className="filters-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong>{selectedIds.length} selected</strong>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set payment status:</span>
            {['Paid', 'Unpaid', 'Hold', 'Free'].map((s) => (
              <button
                key={s}
                type="button"
                className="btn-secondary"
                disabled={isBulkUpdating}
                onClick={() => handleBulkPaymentStatus(s)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {s}
              </button>
            ))}
          </div>
          <button className="btn-secondary" onClick={clearSelection} disabled={isBulkUpdating}>Clear Selection</button>
        </div>
      )}

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        {filtered.length === 0 ? (
          <div className="empty-table">
            <p>No Water Distribution entries match the current filters.</p>
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
                <th>Employee</th>
                <th>Truck Type</th>
                <th className="text-right">Quantity</th>
                <th>Unit Price</th>
                <th>Total Price</th>
                <th>Status</th>
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
                  <td>{e.employeeName || 'N/A'}</td>
                  <td>{e.truckType || 'N/A'}</td>
                  <td className="text-right">{toNumber(e.quantity)}</td>
                  <td>{formatUSD(toNumber(e.unitPrice))}</td>
                  <td>{formatUSD(toNumber(e.totalPrice))}</td>
                  <td>
                    <span className={`status-badge status-${(e.paymentStatus || '').toLowerCase()}`}>{e.paymentStatus || 'N/A'}</span>
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
              <h3 className="modal-title">{editingEntryId ? 'Edit Entry' : 'Add Water Distribution Entry'}</h3>
              <button className="modal-close" onClick={closeModal}><IconX /></button>
            </div>
            <div className="modal-content">
              <div className="missing-item-form-grid">
                <div className="form-group">
                  <label className="form-label">Employee</label>
                  <select value={formEmployeeId} onChange={(e) => handleEmployeeChange(e.target.value)} className="form-select" disabled={isSaving}>
                    <option value="">Select Employee</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  {employees.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      No employees found. Add one from <strong>Employees</strong>.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Truck Type</label>
                  <select value={formTruckType} onChange={(e) => setFormTruckType(e.target.value)} className="form-select" disabled={isSaving}>
                    <option value="">Select Type</option>
                    {truckTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {truckTypes.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      No truck types configured yet. Add them from <strong>Settings</strong>.
                    </p>
                  )}
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
                  <label className="form-label">Unit Price (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumberInput(formUnitPrice)}
                    onChange={(e) => handleUnitPriceChange(stripCommas(e.target.value))}
                    className="form-input"
                    disabled={isSaving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Price (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumberInput(formTotalPrice)}
                    onChange={(e) => handleTotalPriceChange(stripCommas(e.target.value))}
                    className="form-input"
                    disabled={isSaving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select value={formPaymentStatus} onChange={(e) => setFormPaymentStatus(e.target.value)} className="form-select" disabled={isSaving}>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Hold">Hold</option>
                    <option value="Paid">Paid</option>
                    <option value="Free">Free</option>
                  </select>
                </div>
              </div>

              {totalPriceTouched && formTotalPrice !== '' && (
                <div className="missing-item-summary" style={{ marginTop: 'var(--s-3)' }}>
                  <span style={{ color: 'var(--brand)' }}>
                    Total Price: {formatUSD(toNumber(formTotalPrice))} (manually overridden)
                  </span>
                </div>
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

export default WaterDistribution;
