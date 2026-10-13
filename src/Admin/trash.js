import React, { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../Auth/firebase';
import '../CSS/soldItems.css';
import PageHeader from '../Components/PageHeader';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { IconCornerUpLeft, IconTrash } from '../utils/icons';
import { TRASH_SECTIONS, restoreFromTrash, deleteForever } from '../utils/trash';
import { buildCustomerIndex, recordCustomerName } from '../utils/customerLink';

const toNumber = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const formatDate = (iso, withTime = false) => {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return '—';
  const date = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  if (!withTime) return date;
  return `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatAmount = (amount, currency) => (currency === 'LBP'
  ? `${Math.round(amount).toLocaleString()} LL`
  : `$${amount.toFixed(2)}`);

// What the record was, in one line, and its amount — per section.
const describe = (collection, r) => {
  switch (collection) {
    case 'waterDistributionEntries':
      return { item: r.truckType || r.distributionType || 'Water Distribution', amount: formatAmount(toNumber(r.totalPrice), r.priceCurrency) };
    case 'waterFillingEntries':
      return { item: r.transactionType || 'Water Filling', amount: formatAmount(toNumber(r.totalPremium), r.premiumCurrency) };
    case 'maghsalEntries':
      return { item: r.serviceCategory || r.category || 'Service', amount: formatAmount(toNumber(r.totalPrice ?? r.servicePrice), 'USD') };
    default:
      return { item: r.name || 'Item', amount: formatAmount(toNumber(r.totalCost), 'USD') };
  }
};

const Trash = () => {
  const [trash, setTrash] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [customerIndex, setCustomerIndex] = useState(() => buildCustomerIndex([]));
  const [sectionFilter, setSectionFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState(null);
  const [messageKind, setMessageKind] = useState('success');
  const [confirm, confirmDialog] = useConfirmDialog();

  useEffect(() => {
    const unsubT = onValue(ref(database, 'trash'), (snap) => {
      setTrash(snap.exists() ? snap.val() : {});
      setLoaded(true);
    }, (err) => {
      console.error('Failed to load Trash:', err);
      setLoaded(true);
    });
    const unsubC = onValue(ref(database, 'customers'), (snap) => {
      setCustomerIndex(buildCustomerIndex(snap.exists() ? snap.val() : {}));
    });
    return () => { unsubT(); unsubC(); };
  }, []);

  const flash = (msg, kind = 'success') => {
    setMessage(msg);
    setMessageKind(kind);
    setTimeout(() => setMessage(null), 3500);
  };

  // Newest deletions first.
  const rows = useMemo(() => {
    const list = [];
    Object.entries(trash).forEach(([collection, items]) => {
      Object.entries(items || {}).forEach(([id, t]) => {
        const r = t?.record || {};
        list.push({
          key: `${collection}/${id}`,
          collection,
          id,
          section: TRASH_SECTIONS[collection] || collection,
          customer: recordCustomerName(r, customerIndex) || '—',
          date: r.date || r.dateScanned,
          quantity: r.quantity,
          status: r.paymentStatus || '',
          remark: r.remark || '',
          ...describe(collection, r),
          deletedAt: t?.deletedAt,
          deletedBy: t?.deletedBy || 'Unknown',
        });
      });
    });
    const term = search.trim().toLowerCase();
    return list
      .filter((x) => sectionFilter === 'All' || x.collection === sectionFilter)
      .filter((x) => !term || [x.customer, x.item, x.deletedBy, x.remark].some((v) => String(v).toLowerCase().includes(term)))
      .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  }, [trash, customerIndex, sectionFilter, search]);

  const handleRestore = async (row) => {
    const ok = await confirm({
      title: 'Restore this record?',
      message: `${row.section} — ${row.customer}, ${formatDate(row.date)}. It goes back exactly as it was and shows up again everywhere.`,
      confirmLabel: 'Restore',
      danger: false,
    });
    if (!ok) return;
    setBusyKey(row.key);
    try {
      await restoreFromTrash(row.collection, row.id);
      flash(`Restored to ${row.section}.`);
    } catch (err) {
      console.error('Restore failed:', err);
      flash(`Failed to restore: ${err?.message || err}`, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteForever = async (row) => {
    const ok = await confirm({
      title: 'Delete forever?',
      message: `${row.section} — ${row.customer}, ${formatDate(row.date)}. This permanently deletes it and cannot be undone.`,
      confirmLabel: 'Delete forever',
    });
    if (!ok) return;
    setBusyKey(row.key);
    try {
      await deleteForever(row.collection, row.id);
      flash('Deleted forever.');
    } catch (err) {
      console.error('Delete forever failed:', err);
      flash(`Failed to delete: ${err?.message || err}`, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Trash"
        subtitle="Deleted records, with who deleted them and when. Restore puts a record back exactly as it was."
      />

      {message && <div className={messageKind === 'success' ? 'success-message' : 'error-message'}>{message}</div>}

      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Section</label>
            <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
              <option value="All">All Sections</option>
              {Object.entries(TRASH_SECTIONS).map(([col, label]) => <option key={col} value={col}>{label}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, item, comment, deleted by…"
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        {rows.length === 0 ? (
          <div className="empty-table">
            <p>{loaded ? 'Trash is empty.' : 'Loading…'}</p>
          </div>
        ) : (
          <table className="data-table dense">
            <thead>
              <tr>
                <th>Section</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Item</th>
                <th className="text-right">Quantity</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Remark</th>
                <th>Deleted By</th>
                <th>Deleted At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.section}</td>
                  <td className="date-cell"><span className="date-display">{formatDate(row.date)}</span></td>
                  <td><span className="cell-clip-sm" title={row.customer}>{row.customer}</span></td>
                  <td><span className="cell-clip-sm" title={row.item}>{row.item}</span></td>
                  <td className="text-right">{row.quantity ?? '—'}</td>
                  <td>{row.amount}</td>
                  <td>
                    {row.status
                      ? <span className={`status-badge status-${row.status.toLowerCase()}`}>{row.status}</span>
                      : '—'}
                  </td>
                  <td><span className="cell-clip-sm" title={row.remark || '—'}>{row.remark || '—'}</span></td>
                  <td>{row.deletedBy}</td>
                  <td className="date-cell"><span className="date-display">{formatDate(row.deletedAt, true)}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-small btn-secondary" onClick={() => handleRestore(row)} disabled={busyKey === row.key} title="Restore">
                        <IconCornerUpLeft /> Restore
                      </button>
                      <button className="btn-small btn-danger" onClick={() => handleDeleteForever(row)} disabled={busyKey === row.key} title="Delete forever">
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

      {confirmDialog}
    </div>
  );
};

export default Trash;
