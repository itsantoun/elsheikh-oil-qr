import React from 'react';
import BarcodeScanner from './BarcodeScanner';

const App = () => {
  const handleScanSuccess = (decodedText, decodedResult) => {
    console.log(`Scanned code: ${decodedText}`);
    // Implement additional logic as needed
  };

  return (
    <div>
      <h1>Barcode Scanner</h1>
      <BarcodeScanner onScanSuccess={handleScanSuccess} />
    </div>
  );
};

export default App;