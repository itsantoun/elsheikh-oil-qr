import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './login'; // Import the Login component
import Admin from './admin'; // Import the Admin component
import BarcodeScanner from './BarcodeScanner'; // Import the BarcodeScanner component

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