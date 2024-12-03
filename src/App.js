import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BarcodeScanner from './Pages/BarcodeScanner';
import Admin from './Admin/admin';
import Login from './Pages/login';

const App = () => {
  return (
    <Router basename="/elsheikh-oil-qr">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/scanner" element={<BarcodeScanner />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
};

export default App;