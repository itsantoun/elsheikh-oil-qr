import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { database } from './firebase'; // Import Firebase database instance
import { ref, get, child, push } from "firebase/database";

const BarcodeScanner = ({ onScanSuccess }) => {
  const [scanStatus, setScanStatus] = useState('Scanning...');
  const [isPopupOpen, setIsPopupOpen] = useState(false); // State to manage popup visibility
  const [dialogMessage, setDialogMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null); // State for success message
  const [scannedProduct, setScannedProduct] = useState(null); // Store scanned product details

  // Save scanned item to /SoldItems table
  const saveScannedItem = async (barcode, product) => {
    const soldItemsRef = ref(database, 'SoldItems');
    const currentDate = new Date().toISOString(); // Get current date and time

    try {
      console.log("Saving item to SoldItems:", {
        barcode,
        category: product.category,
        name: product.name,
        price: product.price,
        dateScanned: currentDate,
      });
      await push(soldItemsRef, {
        barcode,
        category: product.category,
        name: product.name,
        price: product.price,
        dateScanned: currentDate, // Add timestamp
      });

      // Set success message
      setSuccessMessage(`Item "${product.name}" added successfully on ${currentDate}`);
      setTimeout(() => {
        setSuccessMessage(null); // Clear success message after 3 seconds
      }, 3000);

      setDialogMessage(null); // Clear dialog message
      setIsPopupOpen(false); // Close popup after action
      setScannedProduct(null); // Clear the scanned product data
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to SoldItems.");
    }
  };

  // Fetch product details from /products database
  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database); // Firebase database reference
    try {
      console.log(`Fetching product for barcode: ${barcode}`);
      const snapshot = await get(child(dbRef, `products/${barcode}`)); // Query for /products/<barcode>
  
      if (snapshot.exists()) {
        const product = snapshot.val();
        console.log("Product found:", product);
        setScannedProduct({ barcode, ...product }); // Store product details
        setDialogMessage(`Product found: ${product.name}. Do you want to add it?`);
        setIsPopupOpen(true); // Open popup
      } else {
        console.log("Product not found for barcode:", barcode);
        setDialogMessage("Product not found in the database.");
        setIsPopupOpen(false);
      }
    } catch (error) {
      console.error("Error retrieving product information:", error); // Log detailed error
      setDialogMessage("Error retrieving product information.");
      setIsPopupOpen(false);
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'barcode-scanner',
      {
        fps: 10,
        qrbox: { width: 400, height: 200 }, // Wider box for barcodes
        formatsToSupport: [
            'QR_CODE',    // QR Code
            'CODE_128',   // Common barcode format
            'CODE_39',    // Another common barcode format
            'EAN_13',     // European Article Number (13-digit)
            'EAN_8',      // European Article Number (8-digit)
            'UPC_A',      // Universal Product Code (12-digit)
            'UPC_E',      // Compressed UPC
        ],
      },
      false
    );

    const handleScanSuccess = (decodedText, decodedResult) => {
      setScanStatus(`Scanned code: ${decodedText}`);
      fetchProductDetails(decodedText); // Fetch product information from /products
      if (onScanSuccess) onScanSuccess(decodedText, decodedResult); // Optional callback
    };

    const handleScanFailure = (error) => {
      setScanStatus('No code found. Please try again.');
      console.warn(`Scan error: ${error}`);
    };

    scanner.render(handleScanSuccess, handleScanFailure);

    return () => {
      scanner.clear().catch((error) => {
        console.error('Failed to clear scanner:', error);
      });
    };
  }, [onScanSuccess]);

  return (
    <div>
      <div id="barcode-scanner" />
      <p>{scanStatus}</p>

      {/* Success Message */}
      {successMessage && (
        <div style={popupStyles.success}>
          <p>{successMessage}</p>
        </div>
      )}

      {/* Popup Modal */}
      {isPopupOpen && (
        <div style={popupStyles.overlay}>
          <div style={popupStyles.popup}>
            <h3>Product Found</h3>
            <p>{dialogMessage}</p>
            <button
              style={popupStyles.button}
              onClick={() => {
                saveScannedItem(scannedProduct.barcode, scannedProduct); // Save to /SoldItems
              }}
            >
              Yes, Add
            </button>
            <button
              style={popupStyles.button}
              onClick={() => setIsPopupOpen(false)} // Close popup
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline styles for the popup and success message
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