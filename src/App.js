import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import BarcodeScanner from './Pages/BarcodeScanner';
import Admin from './Admin/admin';
import Login from './Pages/login'

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/scanner" element={<BarcodeScanner />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
};

export default App;