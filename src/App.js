import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Pages/login'; // Import the Login component
import Admin from './Admin/admin'; // Import the Admin component
import BarcodeScanner from './Pages/BarcodeScanner'; // Import the BarcodeScanner component

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/scanner" element={<BarcodeScanner />} />
      </Routes>
    </Router>
  );
};

export default App;