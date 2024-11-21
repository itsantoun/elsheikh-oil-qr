import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const BarcodeScanner = ({ onScanSuccess }) => {
  const [scanStatus, setScanStatus] = useState('Scanning...');

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'barcode-scanner',
      {
        fps: 10,
        qrbox: { width: 300, height: 300 },
        formatsToSupport: ['CODE_128', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'],
      },
      false
    );

    const handleScanSuccess = (decodedText, decodedResult) => {
      setScanStatus(`Scanned code: ${decodedText}`);
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
    </div>
  );
};

export default BarcodeScanner;