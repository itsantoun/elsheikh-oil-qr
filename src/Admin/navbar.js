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

import React from 'react';
import '../CSS/navbar.css';

const Navbar = ({ onNavigate }) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1 className="navbar-title">elsheikh Dashboard</h1>
      </div>
      <div className="navbar-buttons">
        <button onClick={() => onNavigate('addUsers')} className="navbar-button">
          <span className="button-icon">👥</span>
          <span className="button-text">Add Users</span>
        </button>
        <button onClick={() => onNavigate('addProducts')} className="navbar-button">
          <span className="button-icon">🛢️</span>
          <span className="button-text">Add Products</span>
        </button>
        <button onClick={() => onNavigate('transactions')} className="navbar-button">
          <span className="button-icon">💳</span>
          <span className="button-text">Transactions</span>
        </button>
        <button onClick={() => onNavigate('itemsSold')} className="navbar-button">
          <span className="button-icon">📊</span>
          <span className="button-text">Items Sold</span>
        </button>
        <button onClick={() => onNavigate('addCustomer')} className="navbar-button">
          <span className="button-icon">🏠</span>
          <span className="button-text">Customers</span>
        </button>
        <button onClick={() => onNavigate('stock')} className="navbar-button">
          <span className="button-icon">📦</span>
          <span className="button-text">Stock</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;