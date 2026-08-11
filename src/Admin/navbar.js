import React, { useState } from 'react';
import '../CSS/navbar.css';
import elsheikhLogo from '../assets/elsheikh-logo.png';

// ── SVG Icon Components ──────────────────────────────────────────────────────

const IconUsers = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconPackage = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7.5 4.27 9 5.15"/>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5"/>
    <path d="M12 22V12"/>
  </svg>
);

const IconCreditCard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2"/>
    <line x1="2" x2="22" y1="10" y2="10"/>
  </svg>
);

const IconBarChart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="20" y2="10"/>
    <line x1="18" x2="18" y1="20" y2="4"/>
    <line x1="6" x2="6" y1="20" y2="16"/>
  </svg>
);

const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconArchive = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="5" x="2" y="3" rx="1"/>
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
    <path d="M10 12h4"/>
  </svg>
);

const IconMenu = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12"/>
    <line x1="4" x2="20" y1="6" y2="6"/>
    <line x1="4" x2="20" y1="18" y2="18"/>
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

const IconLogOut = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);

const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconDroplet = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
  </svg>
);

const IconTruck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13"/>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const IconHome = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9.5z"/>
  </svg>
);

const IconSpray = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h6v6H3z"/>
    <path d="M9 6h6"/>
    <path d="M15 3v18"/>
    <path d="M18 9h3v12h-6V12"/>
  </svg>
);

// ── Nav Groups Config ─────────────────────────────────────────────────────────
// Flat page ids (kept stable so admin.js routing doesn't need restructuring).
// Each group has a label; children are leaf pages.

const navGroups = [
  {
    id: 'overview',
    label: 'Overview',
    Icon: IconHome,
    children: [
      { id: 'dashboard', Icon: IconHome,     label: 'Dashboard' },
      { id: 'reports',   Icon: IconBarChart, label: 'Client Reports'   },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    Icon: IconPackage,
    children: [
      { id: 'addProducts',  Icon: IconPackage,    label: 'Products'     },
      { id: 'transactions', Icon: IconCreditCard, label: 'Transactions' },
      { id: 'stock',        Icon: IconArchive,    label: 'Stock'        },
    ],
  },
  {
    id: 'oilFilter',
    label: 'Oil / Filter',
    Icon: IconBarChart,
    children: [
      { id: 'itemsSold', Icon: IconBarChart, label: 'Items Sold' },
    ],
  },
  {
    id: 'maghsalGroup',
    label: 'Maghsal',
    Icon: IconSpray,
    children: [
      { id: 'maghsal', Icon: IconBarChart, label: 'Items Sold' },
    ],
  },
  {
    id: 'waterFillingGroup',
    label: 'Water Filling',
    Icon: IconDroplet,
    children: [
      { id: 'waterFilling', Icon: IconDroplet, label: 'Entries' },
    ],
  },
  {
    id: 'waterDistributionGroup',
    label: 'Water Distribution',
    Icon: IconTruck,
    children: [
      { id: 'waterDistribution', Icon: IconTruck, label: 'Entries', comingSoon: true },
    ],
  },
  {
    id: 'adminGroup',
    label: 'Admin',
    Icon: IconSettings,
    children: [
      { id: 'addUsers',    Icon: IconUsers,    label: 'Users'     },
      { id: 'addCustomer', Icon: IconUser,     label: 'Customers' },
      { id: 'settings',    Icon: IconSettings, label: 'Settings'  },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

const Navbar = ({ onNavigate, activePage, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const BrandLogo = () => (
    <div className="brand-logo" aria-label="El Sheikh">
      <img src={elsheikhLogo} alt="El Sheikh" className="brand-logo-image" />
    </div>
  );

  const handleNavClick = (page, opts = {}) => {
    if (opts.comingSoon) return;
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const renderGroup = (group, mobile = false) => {
    const isGroupActive = group.children.some((c) => c.id === activePage);
    return (
      <div key={group.id} className={`nav-group${isGroupActive ? ' nav-group-active' : ''}`}>
        <div className="nav-group-header">
          <span className="nav-group-icon"><group.Icon /></span>
          <span className="nav-group-label">{group.label}</span>
        </div>
        <div className="nav-group-items">
          {group.children.map(({ id, Icon, label, comingSoon }) => {
            const isActive = activePage === id;
            const cls = mobile ? 'mobile-nav-button' : 'nav-button';
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id, { comingSoon })}
                className={`${cls}${isActive ? ' active' : ''}${comingSoon ? ' coming-soon' : ''}`}
                title={comingSoon ? `${label} — Coming Soon` : label}
              >
                <span className="nav-icon"><Icon /></span>
                <span className="nav-label">{label}</span>
                {comingSoon && <span className="nav-badge">Soon</span>}
                {isActive && !comingSoon && (
                  mobile ? <span className="mobile-nav-active-indicator" /> : <span className="nav-indicator-dot" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile top bar — only visible on small screens */}
      <div className="navbar-mobile-topbar">
        <BrandLogo />
        <button
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="navbar navbar-sidebar">
        <div className="sidebar-brand">
          <BrandLogo />
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((g) => renderGroup(g, false))}
        </nav>

        {onLogout && (
          <div className="sidebar-footer">
            <button onClick={onLogout} className="logout-button">
              <IconLogOut />
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="navbar-mobile">
          <div className="mobile-nav-overlay" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="mobile-nav-content">
            <div className="mobile-nav-header">
              <h3>Navigation</h3>
              <button className="mobile-close-button" onClick={() => setIsMobileMenuOpen(false)}>
                <IconX />
              </button>
            </div>
            <div className="mobile-nav-items">
              {navGroups.map((g) => renderGroup(g, true))}
            </div>
            {onLogout && (
              <div className="mobile-nav-footer">
                <button onClick={onLogout} className="logout-button">
                  <IconLogOut />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
