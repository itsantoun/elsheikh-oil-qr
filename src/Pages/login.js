import React, { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';
import '../CSS/login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      setLoginError('');

      // Redirect based on email address
      if (email === 'doris@elsheikh.lb') {
        window.location.href = '/admin'; 
      } else {
        window.location.href = '/scanner';
      }
    } catch (error) {
      setLoginError("Invalid email or password. Please try again.");
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
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="input"
      />
      <button onClick={handleLogin} className="button">Login</button>
      {loginError && <p className="error">{loginError}</p>}
    </div>
  );
}

export default Login;