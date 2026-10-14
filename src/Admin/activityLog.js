import React, { useMemo, useState } from 'react';
import '../CSS/soldItems.css';
import PageHeader from '../Components/PageHeader';
import { useActivityLog, ActivityDetailsModal, formatDateTime, formatValue } from '../Components/ActivityLog';

// Every recorded change, newest first. The log itself is append-only (see
// database.rules.json), so this page only reads it.
const PAGE = 500;

const ActivityLogPage = () => {
  const [limit, setLimit] = useState(PAGE);
  const { entries, loaded, error } = useActivityLog(limit);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('All');
  const [action, setAction] = useState('All');
  const [person, setPerson] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const options = (key) => ['All', ...[...new Set(entries.map((e) => e[key]).filter(Boolean))].sort()];
  const sections = useMemo(() => options('section'), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const actions = useMemo(() => options('action'), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const people = useMemo(() => options('by'), [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Infinity;
    return entries.filter((e) => {
      if (section !== 'All' && e.section !== section) return false;
      if (action !== 'All' && e.action !== action) return false;
      if (person !== 'All' && e.by !== person) return false;
      const ms = new Date(e.at).getTime();
      if (ms < fromMs || ms > toMs) return false;
      // Search the summary and everything in the details (names, comments…).
      return !term || `${e.summary} ${e.by} ${JSON.stringify(e.details || {})}`.toLowerCase().includes(term);
    });
  }, [entries, search, section, action, person, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch(''); setSection('All'); setAction('All'); setPerson('All'); setDateFrom(''); setDateTo('');
  };
  const anyFilter = search || section !== 'All' || action !== 'All' || person !== 'All' || dateFrom || dateTo;

  return (
    <div className="page-shell">
      <PageHeader
        title="Activity Log"
        subtitle="Every change made in the app — who, what and when. Entries can't be edited or deleted."
      />

      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer, comment, product…"
            />
          </div>
          <div className="filter-group">
            <label>Section</label>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              {sections.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Sections' : s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Change</label>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              {actions.map((a) => <option key={a} value={a}>{a === 'All' ? 'All Changes' : a}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>By</label>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              {people.map((p) => <option key={p} value={p}>{p === 'All' ? 'Everyone' : p}</option>)}
            </select>
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
        {anyFilter && (
          <div className="filter-actions" style={{ marginTop: 'var(--s-3)' }}>
            <button className="btn-secondary" onClick={clearFilters}>Clear Filters</button>
          </div>
        )}
      </div>

      {error && <div className="error-message">Couldn't load the activity log: {error.message || String(error)}</div>}

      <div className="table-container">
        {filtered.length === 0 ? (
          <div className="empty-table">
            <p>{!loaded ? 'Loading…' : entries.length === 0 ? 'No activity recorded yet.' : 'No activity matches these filters.'}</p>
          </div>
        ) : (
          <table className="data-table dense">
            <thead>
              <tr>
                <th>When</th>
                <th>By</th>
                <th>Section</th>
                <th>Change</th>
                <th>What happened</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }} title="Show details">
                  <td className="date-cell"><span className="date-display">{formatDateTime(e.at)}</span></td>
                  <td>{formatValue(e.by)}</td>
                  <td>{e.section}</td>
                  <td>{e.action}</td>
                  <td><span className="cell-clip-sm" style={{ maxWidth: 520 }} title={e.summary}>{e.summary}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {loaded && entries.length >= limit && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>Load older activity</button>
        </div>
      )}

      <ActivityDetailsModal entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default ActivityLogPage;
