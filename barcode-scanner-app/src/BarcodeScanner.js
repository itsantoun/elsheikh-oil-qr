// import React, { useEffect, useState } from 'react';
// import { Html5QrcodeScanner } from 'html5-qrcode';

// const BarcodeScanner = ({ onScanSuccess }) => {
//   const [scanStatus, setScanStatus] = useState('Scanning...');

//   useEffect(() => {
//     const scanner = new Html5QrcodeScanner(
//       'barcode-scanner',
//       {
//         fps: 10,
//         qrbox: { width: 300, height: 300 },
//         formatsToSupport: ['CODE_128', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'],
//       },
//       false
//     );

//     const handleScanSuccess = (decodedText, decodedResult) => {
//       setScanStatus(`Scanned code: ${decodedText}`);
//       onScanSuccess(decodedText, decodedResult);
//     };

//     const handleScanFailure = (error) => {
//       setScanStatus('No code found. Please try again.');
//       console.warn(`Scan error: ${error}`);
//     };

//     scanner.render(handleScanSuccess, handleScanFailure);

//     return () => {
//       scanner.clear().catch((error) => {
//         console.error('Failed to clear scanner:', error);
//       });
//     };
//   }, [onScanSuccess]);

//   return (
//     <div>
//       <div id="barcode-scanner" />
//       <p>{scanStatus}</p>
//     </div>
//   );
// };

// export default BarcodeScanner;



import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { database } from './firebase'; // Import Firebase database instance
import { ref, get, child } from "firebase/database";

const BarcodeScanner = ({ onScanSuccess }) => {
  const [scanStatus, setScanStatus] = useState('Scanning...');
  const [dialogMessage, setDialogMessage] = useState(null);

  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const snapshot = await get(child(dbRef, `products/${barcode}`)); // Fetch product based on the scanned barcode
      if (snapshot.exists()) {
        const product = snapshot.val();
        setDialogMessage(`Product found: ${product.name}. Do you want to add it?`);
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
            'CODE_128', // Most common barcode format
            'CODE_39',
            'EAN_13',   // European Article Number (13-digit)
            'EAN_8',    // European Article Number (8-digit)
            'UPC_A',    // Universal Product Code (12-digit)
            'UPC_E'     // Compressed UPC
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
          {/* Add custom buttons or actions for "Yes" or "No" */}
          {dialogMessage.includes("Do you want to add it?") && (
            <button onClick={() => alert("Item added successfully!")}>Yes, Add</button>
          )}
          <button onClick={() => setDialogMessage(null)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;