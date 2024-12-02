import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { database, auth } from './firebase'; // Import Firebase instances
import { ref, get, child, push } from "firebase/database";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

const BarcodeScanner = () => {
  const [scanStatus, setScanStatus] = useState('Scanning...');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [user, setUser] = useState(null); // State to track user login status
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Handle Login
  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user); // Set logged-in user
      setLoginError('');
    } catch (error) {
      setLoginError("Failed to log in. Please check your credentials.");
      console.error("Login error:", error);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null); // Clear user state on logout
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Observe Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // Set user state on authentication state change
    });
    return () => unsubscribe();
  }, []);

  // Save scanned item to Firebase
  const saveScannedItem = async (barcode, product) => {
    const soldItemsRef = ref(database, 'SoldItems');
    const currentDate = new Date().toISOString();

    try {
      await push(soldItemsRef, {
        barcode,
        category: product.category,
        name: product.name,
        price: product.price,
        dateScanned: currentDate,
      });

      setSuccessMessage(`Item "${product.name}" added successfully on ${currentDate}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setDialogMessage(null);
      setIsPopupOpen(false);
      setScannedProduct(null);
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to SoldItems.");
    }
  };

  // Fetch product details
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
        setDialogMessage("Product not found in the database.");
        setIsPopupOpen(false);
      }
    } catch (error) {
      console.error("Error retrieving product information:", error);
      setDialogMessage("Error retrieving product information.");
      setIsPopupOpen(false);
    }
  };

  useEffect(() => {
    if (!user) return; // Don't initialize scanner if user is not logged in

    const scanner = new Html5QrcodeScanner(
      'barcode-scanner',
      {
        fps: 10,
        qrbox: { width: 700, height: 400 },
        formatsToSupport: ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'],
      },
      false
    );

    const handleScanSuccess = (decodedText) => {
      setScanStatus(`Scanned code: ${decodedText}`);
      fetchProductDetails(decodedText);
    };

    const handleScanFailure = (error) => {
      setScanStatus('No code found. Please try again.');
      console.warn(`Scan error: ${error}`);
    };

    scanner.render(handleScanSuccess, handleScanFailure);

    return () => {
      scanner.clear().catch((error) => console.error('Failed to clear scanner:', error));
    };
  }, [user]);

  return (
    <div>
      {!user ? (
        <div>
          <h2>Login</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleLogin}>Login</button>
          {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
        </div>
      ) : (
        <div>
          <button onClick={handleLogout}>Logout</button>
          <div id="barcode-scanner" />
          <p>{scanStatus}</p>
          {successMessage && <div style={popupStyles.success}><p>{successMessage}</p></div>}
          {isPopupOpen && (
            <div style={popupStyles.overlay}>
              <div style={popupStyles.popup}>
                <h3>Product Found</h3>
                <p>{dialogMessage}</p>
                <button
                  style={popupStyles.button}
                  onClick={() => saveScannedItem(scannedProduct.barcode, scannedProduct)}
                >
                  Yes, Add
                </button>
                <button
                  style={popupStyles.button}
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

const popupStyles = {
  overlay: {
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
    borderRadius: '5px',
    boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.25)',
    textAlign: 'center',
  },
  button: {
    margin: '10px',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  success: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#4caf50',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '5px',
    zIndex: 1000,
    boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.25)',
  },
};

export default BarcodeScanner;