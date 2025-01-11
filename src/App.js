import React from 'react';
import { UserProvider } from './Auth/userContext'; // Import UserContext
import Admin from './Admin/admin';
import BarcodeScanner from './Pages/BarcodeScanner';
import Login from './Pages/login';

const App = () => {
  const [currentPage, setCurrentPage] = React.useState('login');

  const renderPage = () => {
    switch (currentPage) {
      case 'admin':
        return <Admin />;
      case 'scanner':
        return <BarcodeScanner />;
      default:
        return <Login onLogin={(page) => setCurrentPage(page)} />;
    }
  };

  return (
    <UserProvider>
      <div>{renderPage()}</div>
    </UserProvider>
  );
};

export default App;