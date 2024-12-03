import React, { useState } from 'react';
import BarcodeScanner from './Pages/BarcodeScanner';
import Admin from './Admin/admin';
import Login from './Pages/login';

const App = () => {
  const [currentPage, setCurrentPage] = useState('login');

  const renderPage = () => {
    switch (currentPage) {
      case 'scanner':
        return <BarcodeScanner />;
      case 'admin':
        return <Admin />;
      default:
        return <Login onLogin={(page) => setCurrentPage(page)} />;
    }
  };

  return (
    <div>
      {renderPage()}
    </div>
  );
};

export default App;