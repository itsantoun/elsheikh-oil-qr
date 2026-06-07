import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { database } from '../Auth/firebase';
import { ref, onValue } from 'firebase/database';
import '../CSS/soldItems.css';
import { saveBlobToExportFolder } from '../utils/exportFolder';

const toNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (v) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (d) => {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
  } catch { return '—'; }
};

const todayISO = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const monthAgoISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const entryTotal = (e) => {
  if (typeof e.totalPrice !== 'undefined') return toNumber(e.totalPrice);
  const service = toNumber(e.servicePrice ?? e.price);
  const goods = (() => {
    if (typeof e.goodsTotal !== 'undefined') return toNumber(e.goodsTotal);
    if (Array.isArray(e.goodsSold)) {
      return e.goodsSold.reduce((acc, g) => acc + toNumber(g.quantity) * toNumber(g.unitPrice), 0);
    }
    return 0;
  })();
  return service + goods;
};

const entryServicePrice = (e) => toNumber(e.servicePrice ?? e.price);
const entryGoodsTotal = (e) => {
  if (typeof e.goodsTotal !== 'undefined') return toNumber(e.goodsTotal);
  if (Array.isArray(e.goodsSold)) {
    return e.goodsSold.reduce((acc, g) => acc + toNumber(g.quantity) * toNumber(g.unitPrice), 0);
  }
  return 0;
};

const REPORT_TYPES = [
  { value: 'period',   label: 'Period Summary',   description: 'Day / week / month totals' },
  { value: 'customer', label: 'Per-Customer',     description: 'Statement for a single customer' },
  { value: 'category', label: 'Per-Category',     description: 'Breakdown by service category' },
  { value: 'employee', label: 'Employee Performance', description: 'Entries grouped by employee' },
];

const sanitizeCSVCell = (value) => {
  const raw = value == null ? '' : String(value);
  const flattened = raw.replace(/\r?\n/g, ' ');
  return /^[=+\-@]/.test(flattened) ? `'${flattened}` : flattened;
};

const MaghsalReports = () => {
  const [entries, setEntries] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [reportType, setReportType] = useState('period');
  const [dateFrom, setDateFrom] = useState(monthAgoISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [customerFilter, setCustomerFilter] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const entriesRef = ref(database, 'maghsalEntries');
    const customersRef = ref(database, 'customers');

    const unsubE = onValue(entriesRef, (snap) => {
      if (!snap.exists()) { setEntries([]); return; }
      const data = snap.val();
      setEntries(Object.keys(data).map((k) => ({ id: k, ...data[k] })));
    });
    const unsubC = onValue(customersRef, (snap) => {
      if (!snap.exists()) { setCustomers([]); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, name: data[k].name, nameArabic: data[k].nameArabic }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCustomers(list);
    });

    return () => { unsubE(); unsubC(); };
  }, []);

  const flash = (msg) => { setMessage(msg); setTimeout(() => setMessage(null), 3000); };

  // ── Filter entries by date range and (when relevant) customer ─────────
  const inRange = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
    const toMs   = dateTo   ? new Date(`${dateTo}T23:59:59.999`).getTime() : Infinity;
    return entries.filter((e) => {
      const ms = new Date(e.date).getTime();
      if (isNaN(ms)) return false;
      if (ms < fromMs || ms > toMs) return false;
      if (reportType === 'customer' && customerFilter) {
        if ((e.customerName || '') !== customerFilter) return false;
      }
      return true;
    });
  }, [entries, dateFrom, dateTo, customerFilter, reportType]);

  // ── Aggregations ──────────────────────────────────────────────────────
  const periodSummary = useMemo(() => {
    let count = 0, service = 0, goods = 0, total = 0, paid = 0, unpaid = 0;
    const byCategory = new Map();
    for (const e of inRange) {
      const s = entryServicePrice(e), g = entryGoodsTotal(e), t = entryTotal(e);
      count++; service += s; goods += g; total += t;
      if (e.paymentStatus === 'Paid') paid += t;
      else if (e.paymentStatus === 'Unpaid') unpaid += t;
      const cat = e.category || 'Unspecified';
      const prev = byCategory.get(cat) || { count: 0, total: 0 };
      byCategory.set(cat, { count: prev.count + 1, total: prev.total + t });
    }
    return { count, service, goods, total, paid, unpaid, byCategory: [...byCategory.entries()].map(([k, v]) => ({ category: k, ...v })) };
  }, [inRange]);

  const customerStatement = useMemo(() => {
    const rows = [...inRange]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((e) => ({
        id: e.id,
        date: e.date,
        category: e.category || 'Unspecified',
        service: entryServicePrice(e),
        goods: entryGoodsTotal(e),
        total: entryTotal(e),
        status: e.paymentStatus,
      }));
    let running = 0;
    for (const r of rows) {
      running += r.total;
      r.running = running;
    }
    let totalPaid = 0, totalUnpaid = 0;
    for (const r of rows) {
      if (r.status === 'Paid') totalPaid += r.total;
      else if (r.status === 'Unpaid') totalUnpaid += r.total;
    }
    return { rows, totalPaid, totalUnpaid, grandTotal: totalPaid + totalUnpaid };
  }, [inRange]);

  const categoryBreakdown = useMemo(() => {
    const m = new Map();
    for (const e of inRange) {
      const cat = e.category || 'Unspecified';
      const t = entryTotal(e);
      const prev = m.get(cat) || { count: 0, service: 0, goods: 0, total: 0 };
      m.set(cat, {
        count: prev.count + 1,
        service: prev.service + entryServicePrice(e),
        goods: prev.goods + entryGoodsTotal(e),
        total: prev.total + t,
      });
    }
    return [...m.entries()].map(([k, v]) => ({ category: k, ...v })).sort((a, b) => b.total - a.total);
  }, [inRange]);

  const employeeStats = useMemo(() => {
    const m = new Map();
    for (const e of inRange) {
      const emp = e.employee || 'Unknown';
      const t = entryTotal(e);
      const prev = m.get(emp) || { count: 0, total: 0, paid: 0, unpaid: 0 };
      m.set(emp, {
        count: prev.count + 1,
        total: prev.total + t,
        paid: prev.paid + (e.paymentStatus === 'Paid' ? t : 0),
        unpaid: prev.unpaid + (e.paymentStatus === 'Unpaid' ? t : 0),
      });
    }
    return [...m.entries()].map(([k, v]) => ({ employee: k, ...v })).sort((a, b) => b.total - a.total);
  }, [inRange]);

  // ── Export builders ────────────────────────────────────────────────────
  const fileLabel = () => {
    const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);
    const parts = [`Maghsal_${reportType}`];
    if (reportType === 'customer' && customerFilter) parts.push(safe(customerFilter));
    parts.push(`${dateFrom}_to_${dateTo}`);
    return parts.join('_');
  };

  const exportCSV = async () => {
    let headers = [], rows = [];
    if (reportType === 'period') {
      headers = ['Metric', 'Value'];
      rows = [
        ['Entries', periodSummary.count],
        ['Service Revenue', `$${periodSummary.service.toFixed(2)}`],
        ['Goods Revenue', `$${periodSummary.goods.toFixed(2)}`],
        ['Total Revenue', `$${periodSummary.total.toFixed(2)}`],
        ['Total Paid', `$${periodSummary.paid.toFixed(2)}`],
        ['Total Unpaid', `$${periodSummary.unpaid.toFixed(2)}`],
        [],
        ['Category Breakdown'],
        ['Category', 'Count', 'Total'],
        ...periodSummary.byCategory.map((c) => [c.category, c.count, `$${c.total.toFixed(2)}`]),
      ];
    } else if (reportType === 'customer') {
      headers = ['Date', 'Category', 'Service', 'Goods', 'Total', 'Status', 'Running Total'];
      rows = customerStatement.rows.map((r) => [
        formatDate(r.date), r.category,
        `$${r.service.toFixed(2)}`, `$${r.goods.toFixed(2)}`,
        `$${r.total.toFixed(2)}`, r.status,
        `$${r.running.toFixed(2)}`,
      ]);
      rows.push([], ['Total Paid', `$${customerStatement.totalPaid.toFixed(2)}`]);
      rows.push(['Total Unpaid', `$${customerStatement.totalUnpaid.toFixed(2)}`]);
      rows.push(['Grand Total', `$${customerStatement.grandTotal.toFixed(2)}`]);
    } else if (reportType === 'category') {
      headers = ['Category', 'Entries', 'Service', 'Goods', 'Total'];
      rows = categoryBreakdown.map((c) => [c.category, c.count, `$${c.service.toFixed(2)}`, `$${c.goods.toFixed(2)}`, `$${c.total.toFixed(2)}`]);
    } else if (reportType === 'employee') {
      headers = ['Employee', 'Entries', 'Total', 'Paid', 'Unpaid'];
      rows = employeeStats.map((e) => [e.employee, e.count, `$${e.total.toFixed(2)}`, `$${e.paid.toFixed(2)}`, `$${e.unpaid.toFixed(2)}`]);
    }

    const csv = '﻿' +
      [headers, ...rows]
        .map((r) => (Array.isArray(r) ? r : []).map((c) => `"${sanitizeCSVCell(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `${fileLabel()}.csv`;
    const result = await saveBlobToExportFolder(blob, filename);
    if (result.strategy === 'folder') flash(`Saved to "${result.folderName}/${filename}"`);
  };

  const exportPDF = async () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    const titles = {
      period: 'Maghsal — Period Summary',
      customer: `Maghsal — Statement for ${customerFilter || 'All Customers'}`,
      category: 'Maghsal — Category Breakdown',
      employee: 'Maghsal — Employee Performance',
    };
    doc.text(titles[reportType] || 'Maghsal Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Date range: ${formatDate(dateFrom)} to ${formatDate(dateTo)}`, 14, 22);

    let head = [], body = [];
    if (reportType === 'period') {
      head = [['Metric', 'Value']];
      body = [
        ['Entries', String(periodSummary.count)],
        ['Service Revenue', `$${periodSummary.service.toFixed(2)}`],
        ['Goods Revenue', `$${periodSummary.goods.toFixed(2)}`],
        ['Total Revenue', `$${periodSummary.total.toFixed(2)}`],
        ['Total Paid', `$${periodSummary.paid.toFixed(2)}`],
        ['Total Unpaid', `$${periodSummary.unpaid.toFixed(2)}`],
      ];
      autoTable(doc, { head, body, startY: 28, styles: { fontSize: 10 }, headStyles: { fillColor: [41, 128, 185] } });

      if (periodSummary.byCategory.length > 0) {
        const y = doc.lastAutoTable.finalY + 6;
        doc.setFontSize(11);
        doc.text('Category Breakdown', 14, y);
        autoTable(doc, {
          head: [['Category', 'Count', 'Total']],
          body: periodSummary.byCategory.map((c) => [c.category, String(c.count), `$${c.total.toFixed(2)}`]),
          startY: y + 3, styles: { fontSize: 9 },
          headStyles: { fillColor: [41, 128, 185] },
          columnStyles: { 2: { halign: 'right' } },
        });
      }
    } else if (reportType === 'customer') {
      head = [['Date', 'Category', 'Service', 'Goods', 'Total', 'Status', 'Running']];
      body = customerStatement.rows.map((r) => [
        formatDate(r.date), r.category,
        `$${r.service.toFixed(2)}`, `$${r.goods.toFixed(2)}`,
        `$${r.total.toFixed(2)}`, r.status,
        `$${r.running.toFixed(2)}`,
      ]);
      autoTable(doc, {
        head, body, startY: 28, styles: { fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 6: { halign: 'right' } },
      });
      const y = doc.lastAutoTable.finalY + 8;
      const w = doc.internal.pageSize.getWidth();
      doc.setFontSize(10);
      doc.text(`Total Paid: $${customerStatement.totalPaid.toFixed(2)}`, w - 14, y, { align: 'right' });
      doc.text(`Total Unpaid: $${customerStatement.totalUnpaid.toFixed(2)}`, w - 14, y + 6, { align: 'right' });
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text(`Grand Total: $${customerStatement.grandTotal.toFixed(2)}`, w - 14, y + 14, { align: 'right' });
    } else if (reportType === 'category') {
      head = [['Category', 'Entries', 'Service', 'Goods', 'Total']];
      body = categoryBreakdown.map((c) => [c.category, String(c.count), `$${c.service.toFixed(2)}`, `$${c.goods.toFixed(2)}`, `$${c.total.toFixed(2)}`]);
      autoTable(doc, {
        head, body, startY: 28, styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      });
    } else if (reportType === 'employee') {
      head = [['Employee', 'Entries', 'Total', 'Paid', 'Unpaid']];
      body = employeeStats.map((e) => [e.employee, String(e.count), `$${e.total.toFixed(2)}`, `$${e.paid.toFixed(2)}`, `$${e.unpaid.toFixed(2)}`]);
      autoTable(doc, {
        head, body, startY: 28, styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      });
    }

    const filename = `${fileLabel()}.pdf`;
    const blob = doc.output('blob');
    const result = await saveBlobToExportFolder(blob, filename);
    if (result.strategy === 'folder') flash(`Saved to "${result.folderName}/${filename}"`);
  };

  // ── Quick range presets ────────────────────────────────────────────────
  const setRangeToday = () => { const t = todayISO(); setDateFrom(t); setDateTo(t); };
  const setRangeWeek = () => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    const isoFrom = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateFrom(isoFrom); setDateTo(todayISO());
  };
  const setRangeMonth = () => { setDateFrom(monthAgoISO()); setDateTo(todayISO()); };
  const setRangeThisMonth = () => {
    const d = new Date();
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    setDateFrom(first); setDateTo(todayISO());
  };

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-shell-header">
        <div className="page-shell-header-left">
          <h1 className="page-shell-header-title">Maghsal Reports</h1>
          <p className="page-shell-header-subtitle">Period, customer, category, and employee summaries with exports.</p>
        </div>
        <div className="page-shell-header-actions">
          <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
          <button className="btn-primary" onClick={exportPDF}>Export PDF</button>
        </div>
      </div>

      {message && <div className="success-message">{message}</div>}

      {/* Controls */}
      <div className="ui-card">
        <div className="ui-card-header">
          <h2 className="ui-card-title">Report Settings</h2>
          <span className="ui-card-subtle">{inRange.length} entry(s) in selected range</span>
        </div>

        <div className="filters-grid">
          <div className="filter-group">
            <label>Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
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

          {reportType === 'customer' && (
            <div className="filter-group">
              <label>Customer</label>
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="filter-actions" style={{ marginTop: 'var(--s-3)' }}>
          <button className="btn-secondary" onClick={setRangeToday}>Today</button>
          <button className="btn-secondary" onClick={setRangeWeek}>Last 7 days</button>
          <button className="btn-secondary" onClick={setRangeThisMonth}>This month</button>
          <button className="btn-secondary" onClick={setRangeMonth}>Last 30 days</button>
        </div>
      </div>

      {/* ── Report bodies ────────────────────────────────────────────── */}

      {reportType === 'period' && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-card-label">Entries</div>
              <div className="kpi-card-value">{periodSummary.count}</div>
            </div>
            <div className="kpi-card tone-purple">
              <div className="kpi-card-label">Service Revenue</div>
              <div className="kpi-card-value">${formatCurrency(periodSummary.service)}</div>
            </div>
            <div className="kpi-card tone-cyan">
              <div className="kpi-card-label">Goods Revenue</div>
              <div className="kpi-card-value">${formatCurrency(periodSummary.goods)}</div>
            </div>
            <div className="kpi-card tone-green">
              <div className="kpi-card-label">Total Revenue</div>
              <div className="kpi-card-value">${formatCurrency(periodSummary.total)}</div>
              <div className="kpi-card-hint">Paid ${formatCurrency(periodSummary.paid)} · Unpaid ${formatCurrency(periodSummary.unpaid)}</div>
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card-header">
              <h2 className="ui-card-title">By Category</h2>
            </div>
            {periodSummary.byCategory.length === 0 ? (
              <div className="empty-state-card">No entries in range.</div>
            ) : (
              <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="text-right">Entries</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodSummary.byCategory.map((c) => (
                      <tr key={c.category}>
                        <td>{c.category}</td>
                        <td className="text-right">{c.count}</td>
                        <td className="text-right">${formatCurrency(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {reportType === 'customer' && (
        <div className="ui-card">
          <div className="ui-card-header">
            <h2 className="ui-card-title">
              Statement {customerFilter ? `— ${customerFilter}` : ''}
            </h2>
            <span className="ui-card-subtle">{customerStatement.rows.length} entry(s)</span>
          </div>

          {!customerFilter ? (
            <div className="empty-state-card">Select a customer to view their statement.</div>
          ) : customerStatement.rows.length === 0 ? (
            <div className="empty-state-card">No entries for this customer in range.</div>
          ) : (
            <>
              <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th className="text-right">Service</th>
                      <th className="text-right">Goods</th>
                      <th className="text-right">Total</th>
                      <th>Status</th>
                      <th className="text-right">Running</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerStatement.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDate(r.date)}</td>
                        <td>{r.category}</td>
                        <td className="text-right">${formatCurrency(r.service)}</td>
                        <td className="text-right">${formatCurrency(r.goods)}</td>
                        <td className="text-right">${formatCurrency(r.total)}</td>
                        <td>
                          <span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{r.status}</span>
                        </td>
                        <td className="text-right">${formatCurrency(r.running)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="missing-item-summary" style={{ marginTop: 'var(--s-3)' }}>
                <span style={{ color: 'var(--green)' }}>Paid: ${formatCurrency(customerStatement.totalPaid)}</span>
                <span style={{ color: 'var(--red)' }}>Unpaid: ${formatCurrency(customerStatement.totalUnpaid)}</span>
                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Grand Total: ${formatCurrency(customerStatement.grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {reportType === 'category' && (
        <div className="ui-card">
          <div className="ui-card-header">
            <h2 className="ui-card-title">Per-Category Breakdown</h2>
            <span className="ui-card-subtle">{categoryBreakdown.length} category(s)</span>
          </div>
          {categoryBreakdown.length === 0 ? (
            <div className="empty-state-card">No entries in range.</div>
          ) : (
            <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-right">Entries</th>
                    <th className="text-right">Service</th>
                    <th className="text-right">Goods</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className="text-right">{c.count}</td>
                      <td className="text-right">${formatCurrency(c.service)}</td>
                      <td className="text-right">${formatCurrency(c.goods)}</td>
                      <td className="text-right" style={{ fontWeight: 700 }}>${formatCurrency(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {reportType === 'employee' && (
        <div className="ui-card">
          <div className="ui-card-header">
            <h2 className="ui-card-title">Employee Performance</h2>
            <span className="ui-card-subtle">{employeeStats.length} employee(s)</span>
          </div>
          {employeeStats.length === 0 ? (
            <div className="empty-state-card">No entries in range.</div>
          ) : (
            <div className="table-container" style={{ boxShadow: 'none', border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th className="text-right">Entries</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Unpaid</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeStats.map((e) => (
                    <tr key={e.employee}>
                      <td>{e.employee}</td>
                      <td className="text-right">{e.count}</td>
                      <td className="text-right" style={{ fontWeight: 700 }}>${formatCurrency(e.total)}</td>
                      <td className="text-right" style={{ color: 'var(--green)' }}>${formatCurrency(e.paid)}</td>
                      <td className="text-right" style={{ color: 'var(--red)' }}>${formatCurrency(e.unpaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaghsalReports;
