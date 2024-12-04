import React, { useState, useContext } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../Auth/firebase';
import { UserContext } from '../Auth/userContext'; // Import the context
import '../CSS/login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const { setUser } = useContext(UserContext); // Access the context

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      setLoginError('');
      setUser({ email }); // Update the user context

      if (email === 'doris@elsheikh.lb') {
        onLogin('admin'); // Navigate to Admin page
      } else {
        onLogin('scanner'); // Navigate to BarcodeScanner page
      }
    } catch (error) {
      setLoginError('Invalid email or password. Please try again.');
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