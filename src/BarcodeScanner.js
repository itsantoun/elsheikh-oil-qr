import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { database } from './firebase'; // Import Firebase database instance
import { ref, get, child, push } from "firebase/database";

const BarcodeScanner = ({ onScanSuccess }) => {
  const [scanStatus, setScanStatus] = useState('Scanning...');
  const [dialogMessage, setDialogMessage] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null); // Store scanned product details

  // Save scanned item to /SoldItems table
  const saveScannedItem = async (barcode, product) => {
    const soldItemsRef = ref(database, 'SoldItems');
    const currentDate = new Date().toISOString(); // Get current date and time

    try {
      console.log("Saving item to SoldItems:", {
        barcode,
        name: product.name,
        category: product.category,
        price: product.price,
        dateScanned: currentDate,
      });
      await push(soldItemsRef, {
        barcode,
        name: product.name,
        category: product.category,
        price: product.price,
        dateScanned: currentDate, // Add timestamp
      });
      setDialogMessage(`Item added successfully on ${currentDate}`);
      setScannedProduct(null); // Clear the scanned product data
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to SoldItems.");
    }
  };

  // Fetch product details from /Products database
  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const snapshot = await get(child(dbRef, `Products/${barcode}`)); // Check in /Products
      if (snapshot.exists()) {
        const product = snapshot.val();
        console.log("Product found:", product);
        setScannedProduct({ barcode, ...product }); // Store product details
        setDialogMessage(`Product found: ${product.name}. Do you want to add it?`);
      } else {
        console.log("Product not found for barcode:", barcode);
        setDialogMessage("Product not found in the database.");
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      setDialogMessage("Error retrieving product information.");
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'barcode-scanner',
      {
        fps: 10,
        qrbox: { width: 400, height: 200 }, // Wider aspect ratio for barcodes
        formatsToSupport: [
          'CODE_128',
          'CODE_39',
          'EAN_13',
          'EAN_8',
          'UPC_A',
          'UPC_E',
        ],
      },
      false
    );

    const handleScanSuccess = (decodedText, decodedResult) => {
      setScanStatus(`Scanned code: ${decodedText}`);
      fetchProductDetails(decodedText); // Fetch product information from /Products
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
      {dialogMessage && (
        <div style={{ border: '1px solid #ccc', padding: '10px', marginTop: '10px' }}>
          <p>{dialogMessage}</p>
          {/* Show Add Item button only if the product is valid */}
          {scannedProduct && dialogMessage.includes("Do you want to add it?") && (
            <button
              onClick={() => {
                saveScannedItem(scannedProduct.barcode, scannedProduct); // Save to /SoldItems
                setDialogMessage(null); // Close dialog after action
              }}
            >
              Yes, Add
            </button>
          )}
          <button onClick={() => setDialogMessage(null)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;