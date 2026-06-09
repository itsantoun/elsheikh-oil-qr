import React, { useState, useContext } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, setAuthPersistenceForRememberMe } from '../Auth/firebase';
import { UserContext } from '../Auth/userContext';
import { resolveUserAccess } from '../Auth/accessControl';
import { isValidEmail, MAX_EMAIL_LEN, MAX_PASSWORD_LEN } from '../Auth/validators';
import elsheikhLogo from '../assets/elsheikh-logo.png';
import '../CSS/login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useContext(UserContext); // Access the context

  const handleLogin = async () => {
    if (submitting) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail) || !password) {
      setLoginError('Please enter a valid email and password.');
      return;
    }
    if (password.length > MAX_PASSWORD_LEN) {
      setLoginError('Invalid email or password. Please try again.');
      return;
    }
    setSubmitting(true);
    try {
      await setAuthPersistenceForRememberMe(rememberMe);
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;
  
      setLoginError('');
      setUser(user); // Update the user context with the full user object
  
      const access = await resolveUserAccess(user);
      if (access.status !== 'active') {
        await signOut(auth);
        setLoginError('This profile is deactivated. Contact admin.');
        return;
      }
      onLogin(access.role === 'admin' ? 'admin' : 'scanner');
    } catch (error) {
      // Generic message — do not leak whether the email exists.
      setLoginError('Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <img src={elsheikhLogo} alt="El Sheikh" className="login-logo-image" />
        </div>

        <div className="login-heading">
          {/* <h2 className="title">Login</h2> */}
          {/* <p className="login-subtitle">Elsheikh Business Dashboard</p> */}
        </div>

        <div className="login-form">
          <div className="login-field">
            <label className="login-field-label">Email Address</label>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              maxLength={MAX_EMAIL_LEN}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-field-label">Password</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              maxLength={MAX_PASSWORD_LEN}
              autoComplete="current-password"
            />
          </div>

          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>

          <button onClick={handleLogin} className="button" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Login'}
          </button>
          {loginError && <p className="error">{loginError}</p>}
        </div>
      </div>
    </div>
  );
}

export default Login;
