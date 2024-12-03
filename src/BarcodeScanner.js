import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { database, auth } from './firebase';
import { ref, get, child, push } from "firebase/database";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

const BarcodeScanner = () => {
  const [scanStatus, setScanStatus] = useState('Scanning...');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Handle Login
  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      setLoginError('');
    } catch (error) {
      setLoginError("Invalid email or password. Please try again.");
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // Fetch Product Details
  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const snapshot = await get(child(dbRef, `products/${barcode}`));
      if (snapshot.exists()) {
        const product = snapshot.val();
        setScannedProduct({ barcode, ...product });
        setDialogMessage(`Product found: ${product.name}. Do you want to add it?`);
        setIsPopupOpen(true);
      } else {
        setDialogMessage("Product not found.");
        setIsPopupOpen(false);
      }
    } catch (error) {
      setDialogMessage("Error retrieving product information.");
      setIsPopupOpen(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const scanner = new Html5QrcodeScanner(
      'barcode-scanner',
      { fps: 10, qrbox: { width: 300, height: 300 } },
      false
    );

    scanner.render(
      (decodedText) => fetchProductDetails(decodedText),
      (error) => setScanStatus('No code detected. Please try again.')
    );

    return () => scanner.clear().catch(console.error);
  }, [user]);

  return (
    <div style={styles.container}>
      {!user ? (
        <div style={styles.loginContainer}>
          <h2 style={styles.title}>Login</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button onClick={handleLogin} style={styles.button}>Login</button>
          {loginError && <p style={styles.error}>{loginError}</p>}
        </div>
      ) : (
        <div>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
          <div id="barcode-scanner" style={styles.scanner}></div>
          <p style={styles.status}>{scanStatus}</p>
          {successMessage && <div style={styles.successMessage}>{successMessage}</div>}
          {isPopupOpen && (
            <div style={styles.popupOverlay}>
              <div style={styles.popup}>
                <h3 style={styles.popupTitle}>Product Found</h3>
                <p style={styles.popupText}>{dialogMessage}</p>
                <button
                  style={styles.popupButton}
                  onClick={() => {
                    setIsPopupOpen(false);
                  }}
                >
                  Yes, Add
                </button>
                <button style={styles.popupButton} onClick={() => setIsPopupOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#f9f9f9',
    padding: '10px',
    boxSizing: 'border-box',
  },
  loginContainer: {
    width: '100%',
    maxWidth: '350px',
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '15px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  },
  title: {
    fontSize: '26px',
    marginBottom: '20px',
    color: '#333',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: '14px',
    marginBottom: '15px',
    borderRadius: '10px',
    border: '1px solid #ddd',
    fontSize: '16px',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border 0.2s',
  },
  inputFocus: {
    border: '1px solid #007bff',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#007bff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '10px',
    transition: 'background-color 0.3s',
  },
  buttonHover: {
    backgroundColor: '#0056b3',
  },
  error: {
    color: '#f44336',
    marginTop: '10px',
    fontSize: '14px',
  },
};
export default BarcodeScanner;