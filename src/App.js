import React from 'react';
import BarcodeScanner from './BarcodeScanner'; // Import the BarcodeScanner component

const App = () => {
  const handleScanSuccess = (decodedText, decodedResult) => {
    console.log(`Scanned code: ${decodedText}`);
    // Implement additional logic here, like updating the UI or saving data
    alert(`Scanned: ${decodedText}`);
  };

  return (
    <div>
      <h1>Barcode Scanner</h1>
      <p>Scan a barcode to fetch product details from the database.</p>
      {/* BarcodeScanner component with an optional callback */}
      <BarcodeScanner onScanSuccess={handleScanSuccess} />
    </div>
  );
};

export default App;