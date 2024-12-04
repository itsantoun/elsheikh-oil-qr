import React from 'react';
import '../CSS/navbar.css'; // Import CSS for styling

const Navbar = ({ onNavigate }) => {
  return (
    <nav className="navbar">
      <h1 className="navbar-title">Admin Dashboard</h1>
      <div className="navbar-buttons">
        <button onClick={() => onNavigate('addUsers')} className="navbar-button">Add Users</button>
        <button onClick={() => onNavigate('addProducts')} className="navbar-button">Add Products</button>
        <button onClick={() => onNavigate('itemsSold')} className="navbar-button">Items Sold</button>
      </div>
    </nav>
  );
};

export default Navbar;