import React, { useContext, useEffect, useMemo, useState } from 'react';
import { database } from '../Auth/firebase';
import { ref, onValue } from 'firebase/database';
import { UserContext } from '../Auth/userContext';

const LOW_STOCK_THRESHOLD = 5;

const toNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const isStockLike = (status) => String(status || '').toLowerCase().startsWith('stock');

const isMaghsalSold = (item) => {
  if (!item) return false;
  if (String(item.paymentStatus || '').toLowerCase() === 'maghsal') return true;
  return false;
};

const formatCurrency = (v) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatTime = (d) => {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    let h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  } catch { return ''; }
};

const formatDay = (d) => {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const initials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
};

// ── Icons ────────────────────────────────────────────────────────────────
const IconDollar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconSpray = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h6v6H3z"/>
    <path d="M9 6h6"/>
    <path d="M15 3v18"/>
    <path d="M18 9h3v12h-6V12"/>
  </svg>
);
const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconPackage = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5"/>
    <path d="M12 22V12"/>
  </svg>
);
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
  </svg>
);
const IconArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const Dashboard = ({ onNavigate }) => {
  const { user } = useContext(UserContext);
  const [soldItems, setSoldItems] = useState([]);
  const [maghsalEntries, setMaghsalEntries] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const soldRef = ref(database, 'SoldItems');
    const maghsalRef = ref(database, 'maghsalEntries');
    const productsRef = ref(database, 'products');

    const unsubSold = onValue(soldRef, (snap) => {
      if (!snap.exists()) { setSoldItems([]); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
      setSoldItems(list);
    });
    const unsubMaghsal = onValue(maghsalRef, (snap) => {
      if (!snap.exists()) { setMaghsalEntries([]); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
      setMaghsalEntries(list);
    });
    const unsubProducts = onValue(productsRef, (snap) => {
      if (!snap.exists()) { setProducts([]); return; }
      const data = snap.val();
      const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
      setProducts(list);
    });

    return () => { unsubSold(); unsubMaghsal(); unsubProducts(); };
  }, []);

  // ── Compute KPIs ────────────────────────────────────
  const stats = useMemo(() => {
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const validSold = soldItems.filter(
      (i) => !isStockLike(i.paymentStatus) && !isMaghsalSold(i)
    );

    let todayRevenue = 0;
    let todayItems = 0;
    let outstandingUnpaid = 0;
    let outstandingCount = 0;

    for (const i of validSold) {
      const ts = new Date(i.dateScanned).getTime();
      const qty = toNumber(i.quantity);
      const unit = toNumber(i.itemCost);
      const total = Number.isFinite(parseFloat(i.totalCost)) ? toNumber(i.totalCost) : unit * qty;
      const dayTotal = total;

      if (ts >= todayStart && ts <= todayEnd) {
        todayRevenue += dayTotal;
        todayItems += 1;
      }
      if (i.paymentStatus === 'Unpaid') {
        outstandingUnpaid += dayTotal;
        outstandingCount += 1;
      }
    }

    let todayMaghsalRevenue = 0;
    let todayMaghsalCount = 0;
    for (const m of maghsalEntries) {
      const ts = new Date(m.date).getTime();
      const p = toNumber(m.price);
      if (ts >= todayStart && ts <= todayEnd) {
        todayMaghsalRevenue += p;
        todayMaghsalCount += 1;
      }
    }

    // Low stock (Oil/Filter products only — already legacy-filtered after migration)
    const lowStock = products
      .filter((p) => String(p.productType || '').toLowerCase() !== 'maghsal')
      .map((p) => ({ ...p, qty: toNumber(p.quantity) }))
      .filter((p) => p.qty <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.qty - b.qty);

    return {
      todayRevenue,
      todayItems,
      outstandingUnpaid,
      outstandingCount,
      todayMaghsalRevenue,
      todayMaghsalCount,
      lowStock,
      totalProducts: products.length,
      totalCustomers: 0, // unused but kept for future expansion
    };
  }, [soldItems, maghsalEntries, products]);

  // ── Recent activity ──────────────────────────────────
  const recentSold = useMemo(() => {
    const valid = soldItems.filter(
      (i) => !isStockLike(i.paymentStatus) && !isMaghsalSold(i)
    );
    return [...valid]
      .sort((a, b) => new Date(b.dateScanned).getTime() - new Date(a.dateScanned).getTime())
      .slice(0, 6);
  }, [soldItems]);

  const recentMaghsal = useMemo(() => {
    return [...maghsalEntries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [maghsalEntries]);

  const today = new Date();
  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const displayName = user?.name || user?.displayName || (user?.email || '').split('@')[0] || 'there';

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-shell-header">
        <div className="page-shell-header-left">
          <h1 className="page-shell-header-title">{greeting}, {displayName}</h1>
          <p className="page-shell-header-subtitle">{formatDay(today)}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card tone-green">
          <span className="kpi-card-icon"><IconDollar /></span>
          <div className="kpi-card-label">Today's Revenue</div>
          <div className="kpi-card-value">${formatCurrency(stats.todayRevenue)}</div>
          <div className="kpi-card-hint">{stats.todayItems} item(s) sold today</div>
        </div>

        <div className="kpi-card tone-red">
          <span className="kpi-card-icon"><IconClock /></span>
          <div className="kpi-card-label">Outstanding Unpaid</div>
          <div className="kpi-card-value">${formatCurrency(stats.outstandingUnpaid)}</div>
          <div className="kpi-card-hint">{stats.outstandingCount} unpaid record(s)</div>
        </div>

        <div className="kpi-card tone-purple">
          <span className="kpi-card-icon"><IconSpray /></span>
          <div className="kpi-card-label">Today's Maghsal</div>
          <div className="kpi-card-value">${formatCurrency(stats.todayMaghsalRevenue)}</div>
          <div className="kpi-card-hint">{stats.todayMaghsalCount} entry(s) today</div>
        </div>

        <div className="kpi-card tone-amber">
          <span className="kpi-card-icon"><IconAlert /></span>
          <div className="kpi-card-label">Low Stock</div>
          <div className="kpi-card-value">{stats.lowStock.length}</div>
          <div className="kpi-card-hint">Item(s) at or below {LOW_STOCK_THRESHOLD}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="ui-card">
        <div className="ui-card-header">
          <h2 className="ui-card-title">Quick Actions</h2>
        </div>
        <div className="quick-actions">
          <button className="quick-action" onClick={() => onNavigate && onNavigate('itemsSold')}>
            <span className="quick-action-icon"><IconPlus /></span>
            <span className="quick-action-label">Add Sale</span>
            <span className="quick-action-sub">Record a new sold item</span>
          </button>
          <button className="quick-action" onClick={() => onNavigate && onNavigate('maghsal')}>
            <span className="quick-action-icon"><IconSpray /></span>
            <span className="quick-action-label">Add Maghsal</span>
            <span className="quick-action-sub">Log a service entry</span>
          </button>
          <button className="quick-action" onClick={() => onNavigate && onNavigate('addProducts')}>
            <span className="quick-action-icon"><IconPackage /></span>
            <span className="quick-action-label">Add Product</span>
            <span className="quick-action-sub">Manage inventory</span>
          </button>
          <button className="quick-action" onClick={() => onNavigate && onNavigate('addCustomer')}>
            <span className="quick-action-icon"><IconUsers /></span>
            <span className="quick-action-label">Add Customer</span>
            <span className="quick-action-sub">Add to customer book</span>
          </button>
        </div>
      </div>

      {/* Activity row */}
      <div className="section-grid-2">
        {/* Recent Sold Items */}
        <div className="ui-card">
          <div className="ui-card-header">
            <h2 className="ui-card-title">Recent Sold Items</h2>
            <button
              className="pill tone-brand"
              style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: '4px 8px' }}
              onClick={() => onNavigate && onNavigate('itemsSold')}
            >
              View all <IconArrowRight />
            </button>
          </div>
          {recentSold.length === 0 ? (
            <div className="empty-state-card">No recent sold items.</div>
          ) : (
            <div className="activity-list">
              {recentSold.map((item) => {
                const qty = toNumber(item.quantity);
                const unit = toNumber(item.itemCost);
                const total = Number.isFinite(parseFloat(item.totalCost)) ? toNumber(item.totalCost) : unit * qty;
                return (
                  <div className="activity-item" key={item.id}>
                    <div className="activity-avatar">{initials(item.customerName)}</div>
                    <div className="activity-body">
                      <span className="activity-title">{item.customerName || 'Unknown customer'}</span>
                      <span className="activity-sub">
                        {item.name || 'Item'} · {qty} · {formatTime(item.dateScanned)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span className="activity-end">${formatCurrency(total)}</span>
                      <span className={`pill ${item.paymentStatus === 'Paid' ? 'tone-green' : item.paymentStatus === 'Unpaid' ? 'tone-amber' : ''}`}>
                        {item.paymentStatus || 'N/A'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock + Recent Maghsal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
          <div className="ui-card">
            <div className="ui-card-header">
              <h2 className="ui-card-title">Low Stock Alert</h2>
              <button
                className="pill tone-brand"
                style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: '4px 8px' }}
                onClick={() => onNavigate && onNavigate('stock')}
              >
                View stock <IconArrowRight />
              </button>
            </div>
            {stats.lowStock.length === 0 ? (
              <div className="empty-state-card">All products are above the {LOW_STOCK_THRESHOLD}-unit threshold. 🎉</div>
            ) : (
              <div className="activity-list">
                {stats.lowStock.slice(0, 5).map((p) => (
                  <div className="activity-item" key={p.id}>
                    <div className="activity-avatar" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
                      <IconPackage />
                    </div>
                    <div className="activity-body">
                      <span className="activity-title">{p.name || 'Unnamed product'}</span>
                      <span className="activity-sub">{p.productType || 'General'}</span>
                    </div>
                    <div className="activity-end">
                      <span className={`pill ${p.qty === 0 ? 'tone-red' : 'tone-amber'}`}>
                        {p.qty === 0 ? 'Out of stock' : `${p.qty} left`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ui-card">
            <div className="ui-card-header">
              <h2 className="ui-card-title">Recent Maghsal Entries</h2>
              <button
                className="pill tone-brand"
                style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: '4px 8px' }}
                onClick={() => onNavigate && onNavigate('maghsal')}
              >
                View all <IconArrowRight />
              </button>
            </div>
            {recentMaghsal.length === 0 ? (
              <div className="empty-state-card">No Maghsal entries yet.</div>
            ) : (
              <div className="activity-list">
                {recentMaghsal.map((m) => (
                  <div className="activity-item" key={m.id}>
                    <div className="activity-avatar" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
                      <IconSpray />
                    </div>
                    <div className="activity-body">
                      <span className="activity-title">{m.customerName || 'Unknown'}</span>
                      <span className="activity-sub">{m.category || 'Unspecified'} · {formatTime(m.date)}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span className="activity-end">${formatCurrency(toNumber(m.price))}</span>
                      <span className={`pill ${m.paymentStatus === 'Paid' ? 'tone-green' : 'tone-amber'}`}>
                        {m.paymentStatus || 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
