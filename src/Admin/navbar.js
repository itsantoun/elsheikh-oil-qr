// import React from 'react';
// import '../CSS/navbar.css';

// const Navbar = ({ onNavigate }) => {
//   return (
//     <nav className="navbar">
//       <h1 className="navbar-title">Admin Dashboard</h1>
//       <div className="navbar-buttons">
//         <button onClick={() => onNavigate('addUsers')} className="navbar-button">Add Users</button>
//         <button onClick={() => onNavigate('addProducts')} className="navbar-button">Add Products</button>
//         <button onClick={() => onNavigate('transactions')} className="navbar-button">Transactions</button>
//         <button onClick={() => onNavigate('itemsSold')} className="navbar-button">Items Sold</button>
//         <button onClick={() => onNavigate('addCustomer')} className="navbar-button">Add Customer</button>
//         <button onClick={() => onNavigate('stock')} className="navbar-button">Stock</button>
        
//       </div>
//     </nav>
//   );
// };

// export default Navbar;

import React, { useState } from 'react';
import '../CSS/navbar.css';

const Navbar = ({ onNavigate, activePage }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'addUsers', icon: '👥', label: 'Add Users', color: '#5C9CC3' },
    { id: 'addProducts', icon: '🛢️', label: 'Add Products', color: '#5C9CC3' },
    { id: 'transactions', icon: '💳', label: 'Transactions', color: '#5C9CC3' },
    { id: 'itemsSold', icon: '📊', label: 'Items Sold', color: '#5C9CC3' },
    { id: 'addCustomer', icon: '👤', label: 'Customers', color: '#5C9CC3' },
    { id: 'stock', icon: '📦', label: 'Stock', color: '#5C9CC3' },
  ];

  const handleNavClick = (page) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo/Brand Section */}
        <div className="navbar-brand">
          <div className="brand-logo">
            <div className="logo-icon">📊</div>
            <div className="brand-text">
              <h1 className="brand-title">Elsheikh</h1>
              <p className="brand-subtitle">Business Dashboard</p>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-desktop">
          <div className="nav-items">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`nav-button ${activePage === item.id ? 'active' : ''}`}
                title={item.label}
              >
                <span className="nav-button-content">
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </span>
                {activePage === item.id && <span className="nav-indicator"></span>}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="menu-icon">
            {isMobileMenuOpen ? '✕' : '☰'}
          </span>
        </button>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="navbar-mobile">
            <div className="mobile-nav-overlay" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="mobile-nav-content">
              <div className="mobile-nav-header">
                <h3>Navigation Menu</h3>
                <button 
                  className="mobile-close-button"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="mobile-nav-items">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`mobile-nav-button ${activePage === item.id ? 'active' : ''}`}
                  >
                    <span className="mobile-nav-icon" style={{ color: item.color }}>
                      {item.icon}
                    </span>
                    <span className="mobile-nav-label">{item.label}</span>
                    {activePage === item.id && (
                      <span className="mobile-nav-active-indicator"></span>
                    )}
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