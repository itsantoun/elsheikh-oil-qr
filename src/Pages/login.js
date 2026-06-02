import React, { useState, useContext } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../Auth/firebase';
import { UserContext } from '../Auth/userContext';
import { resolveUserAccess } from '../Auth/accessControl';
import { isValidEmail, MAX_EMAIL_LEN, MAX_PASSWORD_LEN } from '../Auth/validators';
import '../CSS/login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <div className="login-container">
      <h2 className="title">Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input"
        maxLength={MAX_EMAIL_LEN}
        autoComplete="username"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="input"
        maxLength={MAX_PASSWORD_LEN}
        autoComplete="current-password"
      />
      <button onClick={handleLogin} className="button" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Login'}
      </button>
      {loginError && <p className="error">{loginError}</p>}
    </div>
  );
}

export default Login;