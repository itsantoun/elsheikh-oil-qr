import React from 'react';
import BarcodeScanner from './BarcodeScanner';

const App = () => {
  const handleScanSuccess = (decodedText, decodedResult) => {
    console.log(`Scanned code: ${decodedText}`);
    // You can implement additional logic or display the scanned product here
  };

  return (
    <div>
      <h1>Barcode Scanner</h1>
      <p>Scan a barcode to fetch product details from the database.</p>
      <BarcodeScanner onScanSuccess={handleScanSuccess} />
    </div>
  );
};

export default App;