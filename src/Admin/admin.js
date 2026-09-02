import React, { useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './navbar';
import AddUsers from './adduser';
import FetchProducts from './fetchProducts';
import ItemsSold from './oilSoldItems';
import AddCustomer from './addCustomer';
import Employees from './employees';
import RemainingProducts from './remainingProducts';
import Transactions from './transactions';
import Archives from './archives';
import Settings from './settings';
import Maghsal from './maghsal';
import WaterFilling from './waterFilling';
import WaterDistribution from './waterDistribution';
import Dashboard from './dashboard';
import ClientReports from './clientReports';
import { UserContext } from '../Auth/userContext';
import '../CSS/admin.css';
import { auth } from '../Auth/firebase';
import { signOut } from 'firebase/auth';
import { resolveUserAccess } from '../Auth/accessControl';

const Admin = () => {
  const { user, setUser } = useContext(UserContext);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isActive = true;
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!isActive) return;
      if (!firebaseUser) {
        setIsAuthorized(false);
        setIsAuthCheckComplete(true);
        navigate('/', { replace: true });
        return;
      }

      const access = await resolveUserAccess(firebaseUser);
      if (!isActive) return;
      const allowed = access.status === 'active' && access.role === 'admin';
      setIsAuthorized(allowed);
      setIsAuthCheckComplete(true);
      if (!allowed) {
        navigate('/', { replace: true });
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [navigate]);

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

  // Active nav id, derived from the URL — e.g. /admin/waterFilling -> 'waterFilling'.
  const activeSection = location.pathname.replace(/^\/admin\/?/, '') || 'dashboard';

  const handleNavigate = (page) => navigate(`/admin/${page}`);

  return (
    <div className="admin-container">
      <Navbar
        onNavigate={handleNavigate}
        activePage={activeSection}
        onLogout={handleLogout}
      />
      <div className="admin-main">
        <div className="admin-content">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard onNavigate={handleNavigate} />} />
            <Route path="reports" element={<ClientReports />} />
            <Route path="addUsers" element={<AddUsers />} />
            <Route path="addProducts" element={<FetchProducts />} />
            <Route path="holdProducts" element={<FetchProducts />} />
            <Route path="itemsSold" element={<ItemsSold />} />
            <Route path="addCustomer" element={<AddCustomer />} />
            <Route path="employees" element={<Employees />} />
            <Route path="stock" element={<RemainingProducts />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="archives" element={<Archives />} />
            <Route path="settings" element={<Settings />} />
            <Route path="maghsal" element={<Maghsal />} />
            <Route path="waterFilling" element={<WaterFilling />} />
            <Route path="waterDistribution" element={<WaterDistribution />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Admin;
