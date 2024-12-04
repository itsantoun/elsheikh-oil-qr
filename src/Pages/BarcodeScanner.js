import React, { useState, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, child, push } from "firebase/database";
import '../CSS/BarcodeScanner.css'; // Import the CSS file

const BarcodeScanner = () => {
  const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const scannerRef = React.useRef(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    const videoElement = scannerRef.current;
 
    codeReader
      .decodeFromVideoDevice(null, videoElement, (result, error) => {
        if (result) {
          console.log(`Scanned Code: ${result.text}`);
          setScanStatus('Barcode detected! Processing...');
          fetchProductDetails(result.text);
        } else if (error) {
          setScanStatus('Align the barcode and hold steady.');
        }
      })
      .catch((err) => console.error('Camera initialization failed:', err));

    return () => {
      codeReader.reset();
    };
  }, []);

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

  const saveScannedItem = async (product) => {
    if (!product || !product.barcode) {
      console.error("Invalid product data:", product);
      setDialogMessage("Error: Invalid product data.");
      return;
    }

    const soldItemsRef = ref(database, 'SoldItems');

    try {
      const currentDate = new Date().toISOString(); // Get current timestamp
      const newItem = {
        barcode: product.barcode,
        name: product.name,
        category: product.category || 'Unknown',
        price: product.price || 0,
        dateScanned: currentDate,
      };

      await push(soldItemsRef, newItem); // Push new item to SoldItems
      setSuccessMessage(`Item "${product.name}" added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
      setIsPopupOpen(false); // Close popup
      setDialogMessage(null);
      setScannedProduct(null); // Clear scanned product
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to the database.");
    }
  };

  const handleLogout = () => {
    window.location.href = '/'; // Redirect to login page
  };

  return (
    <div className="container">
      <div className="header">
        <button className="logout-button" onClick={handleLogout}>Logout</button>
      </div>
      <div className="scanner-container">
        <video ref={scannerRef} className="scanner"></video>
        <p className="status">{scanStatus}</p>
        {successMessage && <div className="success-message">{successMessage}</div>}
        {isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup">
              <h3 className="popup-title">Product Found</h3>
              <p className="popup-text">{dialogMessage}</p>
              <button
                className="popup-button"
                onClick={() => saveScannedItem(scannedProduct)}
              >
                Yes, Add
              </button>
              <button
                className="popup-button cancel"
                onClick={() => setIsPopupOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;