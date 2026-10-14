import React, { useEffect, useState } from 'react';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '../Auth/firebase';
import { IconEdit, IconPlus, IconTrash, IconCornerUpLeft, IconUser, IconCheck, IconSettings, IconEye, IconLock, IconLogOut, IconFileText } from '../utils/icons';

// Shared by the Dashboard's Recent Activity card and the Activity Log page.

// Newest `limit` log entries, live, newest first.
export const useActivityLog = (limit) => {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    const q = query(ref(database, 'activityLog'), orderByChild('at'), limitToLast(limit));
    return onValue(q, (snap) => {
      const data = snap.exists() ? snap.val() : {};
      const list = Object.keys(data).map((id) => ({ id, ...data[id] }));
      list.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setEntries(list);
      setLoaded(true);
      setError(null);
    }, (err) => {
      console.error('Failed to load activity log:', err);
      setError(err);
      setLoaded(true);
    });
  }, [limit]);
  return { entries, loaded, error };
};

const pad = (n) => String(n).padStart(2, '0');
export const formatDateTime = (iso) => {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const timeAgo = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDateTime(iso).slice(0, 10);
};

// "paymentStatus" → "Payment Status", with friendlier names for common fields.
const FIELD_LABELS = {
  paymentStatus: 'Status', remark: 'Comment', customerName: 'Customer', customerNameArabic: 'Customer (Arabic)',
  customerId: 'Customer ID', datePaid: 'Date Paid', totalPrice: 'Total Price', unitPrice: 'Unit Price',
  priceCurrency: 'Currency', totalCost: 'Total', itemCost: 'Selling Price', purchasingPrice: 'Purchasing Price',
  dateScanned: 'Date', employeeName: 'Employee', distributionType: 'Type', nameArabic: 'Arabic Name',
};
export const fieldLabel = (k) => FIELD_LABELS[k]
  || String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

export const formatValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const full = formatDateTime(v);
    return full.endsWith(' 09:00') || full.endsWith(' 12:00') ? full.slice(0, 10) : full;
  }
  if (typeof v === 'object') return Array.isArray(v) ? v.map(formatValue).join(', ') : JSON.stringify(v);
  return String(v);
};

const TONES = {
  Added: ['var(--green-bg)', 'var(--green)', IconPlus],
  Deleted: ['var(--red-bg)', 'var(--red)', IconTrash],
  'Deleted forever': ['var(--red-bg)', 'var(--red)', IconTrash],
  Restored: ['var(--cyan-bg)', 'var(--cyan)', IconCornerUpLeft],
  Renamed: ['var(--purple-bg)', 'var(--purple)', IconUser],
  Confirmed: ['var(--green-bg)', 'var(--green)', IconCheck],
  'Logged in': ['var(--green-bg)', 'var(--green)', IconLock],
  'Logged out': ['var(--surface-2, #f1f3f5)', 'var(--text-muted, #6b7280)', IconLogOut],
  Visited: ['var(--surface-2, #f1f3f5)', 'var(--text-muted, #6b7280)', IconEye],
  Viewed: ['var(--surface-2, #f1f3f5)', 'var(--text-muted, #6b7280)', IconEye],
  Exported: ['var(--cyan-bg)', 'var(--cyan)', IconFileText],
  Printed: ['var(--cyan-bg)', 'var(--cyan)', IconFileText],
};
const toneFor = (action) => {
  if (TONES[action]) return TONES[action];
  if (/^Bulk/.test(action)) return ['var(--amber-bg)', 'var(--amber)', IconEdit];
  if (/Archive|Migration|fix/i.test(action)) return ['var(--amber-bg)', 'var(--amber)', IconSettings];
  return ['var(--brand-bg, var(--cyan-bg))', 'var(--brand, var(--cyan))', IconEdit];
};

export const ActivityRow = ({ entry, onClick }) => {
  const [bg, fg, Icon] = toneFor(entry.action);
  return (
    <button
      type="button"
      className="activity-item"
      onClick={() => onClick(entry)}
      style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
      title="Show details"
    >
      <div className="activity-avatar" style={{ background: bg, color: fg }}><Icon /></div>
      <div className="activity-body">
        <span className="activity-title">{entry.summary}</span>
        <span className="activity-sub">{entry.by} · {entry.section}</span>
      </div>
      <div className="activity-end">
        <span className="activity-sub" title={formatDateTime(entry.at)}>{timeAgo(entry.at)}</span>
      </div>
    </button>
  );
};

const KV = ({ data }) => (
  <table className="data-table dense">
    <tbody>
      {Object.entries(data).map(([k, v]) => (
        <tr key={k}>
          <td style={{ fontWeight: 600, width: '35%' }}>{fieldLabel(k)}</td>
          <td style={{ wordBreak: 'break-word' }}>{formatValue(v)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const Section = ({ title, children }) => (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{title}</div>
    {children}
  </div>
);

// Full detail of one log entry.
export const ActivityDetailsModal = ({ entry, onClose }) => {
  if (!entry) return null;
  const { changes, records, record, ...rest } = entry.details || {};
  const extra = Object.fromEntries(Object.entries(rest).filter(([k, v]) => !['collection', 'id'].includes(k) && v !== null && v !== ''));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{entry.section} — {entry.action}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          <p style={{ marginTop: 0, fontSize: 15 }}><strong>{entry.summary}</strong></p>
          <span className="ui-card-subtle">By {entry.by} · {formatDateTime(entry.at)}</span>

          {changes && Object.keys(changes).length > 0 && (
            <Section title="What changed">
              <table className="data-table dense">
                <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                <tbody>
                  {Object.entries(changes).map(([k, c]) => (
                    <tr key={k}>
                      <td style={{ fontWeight: 600 }}>{fieldLabel(k)}</td>
                      <td style={{ wordBreak: 'break-word' }}>{formatValue(c?.from)}</td>
                      <td style={{ wordBreak: 'break-word' }}>{formatValue(c?.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {Array.isArray(records) && records.length > 0 && (
            <Section title={`Records (${records.length})`}>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table className="data-table dense">
                  <thead><tr><th>Record</th><th>Before</th></tr></thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.id || i}>
                        <td>{r.label || r.id}</td>
                        <td>{formatValue(r.from)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {Object.keys(extra).length > 0 && <Section title="Details"><KV data={extra} /></Section>}

          {record && typeof record === 'object' && (
            <Section title={entry.action === 'Added' ? 'Saved as' : 'Record'}>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}><KV data={record} /></div>
            </Section>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
