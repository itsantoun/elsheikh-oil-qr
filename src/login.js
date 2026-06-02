import React, { useState, useContext } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../Auth/firebase';
import { UserContext } from '../Auth/userContext';
import { resolveUserAccess } from '../Auth/accessControl';
import '../CSS/login.css';

// ── Lock Icon ────────────────────────────────────────────────────────────────
const IconLock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4"/><path d="M12 17h.01"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const { setUser }                 = useContext(UserContext);

  const handleLogin = async () => {
    if (!email || !password) {
      setLoginError('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      setUser(user);

      const access = await resolveUserAccess(user);
      if (access.status !== 'active') {
        await signOut(auth);
        setLoginError('This profile is deactivated. Contact admin.');
        return;
      }
      onLogin(access.role === 'admin' ? 'admin' : 'scanner');
    } catch (error) {
      setLoginError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-mark">
            <IconLock />
          </div>
        </div>

        {/* Heading */}
        <div className="login-heading">
          <h2 className="title">Sign In</h2>
          <p className="login-subtitle">Elsheikh Business Dashboard</p>
        </div>

        {/* Form */}
        <div className="login-form">
          <div className="login-field">
            <label className="login-field-label">Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="login-field">
            <label className="login-field-label">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              autoComplete="current-password"
            />
          </div>

          {loginError && (
            <p className="error">
              <IconAlert />
              {loginError}
            </p>
          )}

          <button
            onClick={handleLogin}
            className="button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p className="login-footer-text">Elsheikh Enterprise &copy; {new Date().getFullYear()}</p>
        </div>

      </div>
    </div>
  );
}

export default Login;
