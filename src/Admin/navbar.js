import React, { useState } from 'react';
import '../CSS/navbar.css';

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

const IconDashboard = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1"/>
    <rect width="7" height="5" x="14" y="3" rx="1"/>
    <rect width="7" height="9" x="14" y="12" rx="1"/>
    <rect width="7" height="5" x="3" y="16" rx="1"/>
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

// ── Nav Items Config ─────────────────────────────────────────────────────────

const navItems = [
  { id: 'addUsers',     Icon: IconUsers,      label: 'Users'        },
  { id: 'addProducts',  Icon: IconPackage,    label: 'Products'     },
  { id: 'transactions', Icon: IconCreditCard, label: 'Transactions' },
  { id: 'itemsSold',    Icon: IconBarChart,   label: 'Items Sold'   },
  { id: 'addCustomer',  Icon: IconUser,       label: 'Customers'    },
  { id: 'stock',        Icon: IconArchive,    label: 'Stock'        },
  // { id: 'archives',     Icon: IconDashboard,  label: 'Archives'     },
];

// ── Component ────────────────────────────────────────────────────────────────

const Navbar = ({ onNavigate, activePage, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (page) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* Brand */}
        <div className="navbar-brand">
          <div className="brand-logo">
            <div className="logo-icon" />
            <div className="brand-text">
              <h1 className="brand-title">Elsheikh</h1>
              <p className="brand-subtitle">Business Dashboard</p>
            </div>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className="navbar-desktop">
          <div className="nav-items">
            {navItems.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`nav-button ${activePage === id ? 'active' : ''}`}
                title={label}
              >
                <span className="nav-button-content">
                  <span className="nav-icon"><Icon /></span>
                  <span className="nav-label">{label}</span>
                </span>
                {activePage === id && <span className="nav-indicator" />}
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        {onLogout && (
          <button onClick={onLogout} className="logout-button">
            <IconLogOut />
            Logout
          </button>
        )}

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="menu-icon">
            {isMobileMenuOpen ? <IconX /> : <IconMenu />}
          </span>
        </button>

        {/* Mobile Navigation */}
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
                {navItems.map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => handleNavClick(id)}
                    className={`mobile-nav-button ${activePage === id ? 'active' : ''}`}
                  >
                    <span className="mobile-nav-icon"><Icon /></span>
                    <span className="mobile-nav-label">{label}</span>
                    {activePage === id && <span className="mobile-nav-active-indicator" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
