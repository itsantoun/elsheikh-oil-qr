import React, { useContext, useEffect, useState } from 'react';
import Navbar from './navbar';
import AddUsers from './adduser';
import FetchProducts from './fetchProducts';
import ItemsSold from './soldItems';
import AddCustomer from './addCustomer';
import RemainingProducts from './remainingProducts';
import Transactions from './transactions';
import Archives from './archives';
import Settings from './settings';
import { UserContext } from '../Auth/userContext';
import '../CSS/admin.css';
import { auth } from '../Auth/firebase';
import { signOut } from 'firebase/auth';
import { resolveUserAccess } from '../Auth/accessControl';

const Admin = () => {
  const { user, setUser } = useContext(UserContext);
  const [activeSection, setActiveSection] = useState('addUsers');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);

  useEffect(() => {
    let isActive = true;
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!isActive) return;
      if (!firebaseUser) {
        setIsAuthorized(false);
        setIsAuthCheckComplete(true);
        window.location.href = '/';
        return;
      }

      const access = await resolveUserAccess(firebaseUser);
      if (!isActive) return;
      const allowed = access.status === 'active' && access.role === 'admin';
      setIsAuthorized(allowed);
      setIsAuthCheckComplete(true);
      if (!allowed) {
        window.location.href = '/';
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser({ email: '', name: '' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!isAuthCheckComplete) {
    return null;
  }

  if (!user || !isAuthorized) {
    return null;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'addUsers':     return <AddUsers />;
      case 'addProducts':  return <FetchProducts />;
      case 'holdProducts': return <FetchProducts />;
      case 'itemsSold':    return <ItemsSold />;
      case 'addCustomer':  return <AddCustomer />;
      case 'stock':        return <RemainingProducts />;
      case 'transactions': return <Transactions />;
      case 'archives':     return <Archives />;
      case 'settings':     return <Settings />;
      default:             return <AddUsers />;
    }
  };

  return (
    <div className="admin-container">
      <Navbar
        onNavigate={setActiveSection}
        activePage={activeSection}
        onLogout={handleLogout}
      />
      <div className="admin-content">
        {renderSection()}
      </div>
    </div>
  );
};

export default Admin;
