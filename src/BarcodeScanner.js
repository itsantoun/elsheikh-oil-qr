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
  const [errorMessage, setErrorMessage] = useState(null);
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

  // Save Product to SoldItems
  const saveToSoldItems = async (product) => {
    try {
      const soldItemsRef = ref(database, 'SoldItems');
      await push(soldItemsRef, {
        barcode: product.barcode,
        name: product.name,
        price: product.price,
        timestamp: new Date().toISOString(),
      });

      setSuccessMessage(`Item "${product.name}" added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setScannedProduct(null);
      setDialogMessage(null);
      setIsPopupOpen(false);
    } catch (error) {
      console.error("Failed to add item to SoldItems:", error);
      setErrorMessage("Failed to add item. Please try again.");
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

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
        <div style={styles.scannerContainer}>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
          <div id="barcode-scanner" style={styles.scanner}>
            <p style={styles.scannerText}>QR Code Scanner</p>
          </div>
          <p style={styles.status}>{scanStatus}</p>
          {successMessage && <div style={styles.successMessage}>{successMessage}</div>}
          {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}
          {isPopupOpen && (
            <div style={styles.popupOverlay}>
              <div style={styles.popup}>
                <h3 style={styles.popupTitle}>Product Found</h3>
                <p style={styles.popupText}>{dialogMessage}</p>
                <button
                  style={styles.popupButton}
                  onClick={() => saveToSoldItems(scannedProduct)}
                >
                  Yes, Add
                </button>
                <button
                  style={{ ...styles.popupButton, backgroundColor: '#f44336' }}
                  onClick={() => setIsPopupOpen(false)}
                >
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
    backgroundColor: '#f4f4f4',
    padding: '20px',
    boxSizing: 'border-box',
  },
  loginContainer: {
    width: '100%',
    maxWidth: '350px',
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  },
  scannerContainer: {
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '15px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginTop: '10px',
  },
  logoutButton: {
    padding: '10px',
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    marginBottom: '10px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  scanner: {
    width: '100%',
    height: '300px',
    border: '1px solid #ccc',
    borderRadius: '10px',
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerText: {
    color: '#888',
    fontSize: '16px',
  },
  status: {
    fontSize: '16px',
    color: '#555',
    marginTop: '10px',
  },
  successMessage: {
    backgroundColor: '#4caf50',
    color: '#fff',
    padding: '10px',
    borderRadius: '5px',
    marginTop: '10px',
    textAlign: 'center',
  },
  popupOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  popup: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '10px',
    textAlign: 'center',
    width: '90%',
    maxWidth: '300px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  },
  popupTitle: {
    marginBottom: '10px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
  },
  popupText: {
    fontSize: '16px',
    marginBottom: '20px',
    color: '#555',
  },
  popupButton: {
    padding: '10px 20px',
    margin: '5px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#fff',
    backgroundColor: '#007bff',
  },
  error: {
    color: '#f44336',
    marginTop: '10px',
    fontSize: '14px',
  },
};

export default BarcodeScanner;