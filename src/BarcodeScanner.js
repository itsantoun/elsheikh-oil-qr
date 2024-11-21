import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { database } from './firebase'; // Import Firebase database instance
import { ref, get, child, push } from "firebase/database";

const BarcodeScanner = ({ onScanSuccess }) => {
  const [scanStatus, setScanStatus] = useState('Scanning...');
  const [dialogMessage, setDialogMessage] = useState(null);

  // Save scanned item to SoldItems table
  const saveScannedItem = async (barcode, product) => {
    const soldItemsRef = ref(database, 'SoldItems');
    const currentDate = new Date().toISOString(); // Get current date and time

    try {
      await push(soldItemsRef, {
        barcode,
        name: product.name,
        category: product.category,
        price: product.price,
        dateScanned: currentDate, // Add timestamp
      });
      setDialogMessage(`Item added successfully on ${currentDate}`);
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to SoldItems.");
    }
  };

  // Fetch product details and handle saving to SoldItems
  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const snapshot = await get(child(dbRef, `Products/${barcode}`)); // Check in Products
      if (snapshot.exists()) {
        const product = snapshot.val();
        setDialogMessage(`Product found: ${product.name}. Do you want to add it?`);
        // Save to SoldItems
        saveScannedItem(barcode, product);
      } else {
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
          'UPC_E'
        ],
      },
      false
    );

    const handleScanSuccess = (decodedText, decodedResult) => {
      setScanStatus(`Scanned code: ${decodedText}`);
      fetchProductDetails(decodedText); // Fetch product information
      onScanSuccess(decodedText, decodedResult);
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
        <div>
          <p>{dialogMessage}</p>
          <button onClick={() => setDialogMessage(null)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;