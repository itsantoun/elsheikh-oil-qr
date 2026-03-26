import React, { useContext, useEffect, useState } from 'react';
import Navbar from './navbar';
import AddUsers from './adduser';
import FetchProducts from './fetchProducts';
import ItemsSold from './soldItems';
import AddCustomer from './addCustomer';
import RemainingProducts from './remainingProducts';
import Transactions from './transactions';
import Archives from './archives';
import { UserContext } from '../Auth/userContext';
import '../CSS/admin.css';
import { auth } from '../Auth/firebase';
import { signOut } from 'firebase/auth';

const Admin = () => {
  const { user, setUser } = useContext(UserContext);
  const [activeSection, setActiveSection] = useState('addUsers');

  useEffect(() => {
    if (!user || user.email !== 'doris@elsheikh.lb') {
      window.location.href = '/';
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser({ email: '', name: '' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user || user.email !== 'doris@elsheikh.lb') {
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
