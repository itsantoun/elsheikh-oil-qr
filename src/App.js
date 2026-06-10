import React, { useEffect, useState } from 'react';
import { UserProvider } from './Auth/userContext';
import Admin from './Admin/admin';
import BarcodeScanner from './Pages/BarcodeScanner';
import Login from './Pages/login';
import { auth } from './Auth/firebase';
import { resolveUserAccess } from './Auth/accessControl';
import { NotificationProvider } from './Auth/notificationContext';
import { useIdleLogout } from './Auth/useIdleLogout';
import './App.css';

const App = () => {
  const [currentPage, setCurrentPage] = useState('login');
  useIdleLogout();

  useEffect(() => {
    let isActive = true;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!isActive) return;

      if (!user) {
        setCurrentPage('login');
        return;
      }

      const access = await resolveUserAccess(user);
      if (!isActive) return;
      if (access.status !== 'active') {
        await auth.signOut();
        setCurrentPage('login');
        return;
      }
      setCurrentPage(access.role === 'admin' ? 'admin' : 'scanner');
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

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
    <NotificationProvider>
      <UserProvider>
        <div>{renderPage()}</div>
      </UserProvider>
    </NotificationProvider>
  );
};

export default App;
