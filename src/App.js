import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { UserProvider } from './Auth/userContext';
import Admin from './Admin/admin';
import BarcodeScanner from './Pages/BarcodeScanner';
import Login from './Pages/login';
import { auth } from './Auth/firebase';
import { resolveUserAccess } from './Auth/accessControl';
import { NotificationProvider } from './Auth/notificationContext';
import { useIdleLogout } from './Auth/useIdleLogout';
import './App.css';

const AppRoutes = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // onAuthStateChanged doesn't only fire on login/logout — it also re-fires
  // on silent token refresh, tab focus, network reconnects, etc. Track the
  // current path in a ref (rather than depending on `location` directly) so
  // this effect subscribes once instead of resubscribing on every
  // navigation, while still reading a fresh path each time it fires.
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    let isActive = true;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!isActive) return;

      if (!user) {
        if (locationRef.current.pathname !== '/') navigate('/', { replace: true });
        return;
      }

      const access = await resolveUserAccess(user);
      if (!isActive) return;
      if (access.status !== 'active') {
        await auth.signOut();
        if (locationRef.current.pathname !== '/') navigate('/', { replace: true });
        return;
      }
      // Only redirect if we're not already in the right section — otherwise
      // this would bounce the user back to /admin (losing their current
      // sub-page) every time the listener re-fires, not just on login.
      const target = access.role === 'admin' ? '/admin' : '/scanner';
      if (!locationRef.current.pathname.startsWith(target)) {
        navigate(target, { replace: true });
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [navigate]);

  return (
    <Routes>
      <Route
        path="/"
        element={<Login onLogin={(page) => navigate(page === 'admin' ? '/admin' : '/scanner', { replace: true })} />}
      />
      <Route path="/scanner" element={<BarcodeScanner />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => {
  useIdleLogout();

  return (
    <NotificationProvider>
      <UserProvider>
        <BrowserRouter basename={process.env.PUBLIC_URL}>
          <AppRoutes />
        </BrowserRouter>
      </UserProvider>
    </NotificationProvider>
  );
};

export default App;
