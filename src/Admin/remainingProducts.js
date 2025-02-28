import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, child } from 'firebase/database';
import '../CSS/remainingProducts.css';

const RemainingProducts = () => {
  const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [remainingQuantity, setRemainingQuantity] = useState(0);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showScanner, setShowScanner] = useState(false); // State to control scanner visibility
  const [showDropdown, setShowDropdown] = useState(false); // State to control dropdown visibility
  const scannerRef = useRef(null);

  useEffect(() => {
    if (showScanner) {
      const codeReader = new BrowserMultiFormatReader();
      const videoElement = scannerRef.current;

      codeReader
        .decodeFromVideoDevice(null, videoElement, (result, error) => {
          if (result) {
            setScanStatus('Barcode detected! Processing...');
            fetchProductDetails(result.text);
          } else if (error) {
            setScanStatus('Align the barcode and hold steady.');
            console.warn('Barcode detection error:', error);
          }
        }, {
          tryHarder: true,
          constraints: {
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
        })
        .then(() => {
          applyZoom();
        })
        .catch((err) => console.error('Camera initialization failed:', err));

      return () => {
        codeReader.reset();
      };
    }
  }, [zoomLevel, showScanner]);

  useEffect(() => {
    const fetchProducts = async () => {
      const dbRef = ref(database);
      try {
        const productsSnapshot = await get(child(dbRef, 'products'));
        if (productsSnapshot.exists()) {
          const productsData = productsSnapshot.val();
          const productsList = Object.keys(productsData).map((barcode) => ({
            barcode,
            ...productsData[barcode],
          }));
          setProducts(productsList);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  const applyZoom = async () => {
    try {
      const videoElement = scannerRef.current;
      const stream = videoElement.srcObject;
      const [track] = stream.getVideoTracks();

      const capabilities = track.getCapabilities();
      if ('zoom' in capabilities) {
        const constraints = {
          advanced: [{ zoom: zoomLevel }],
        };
        await track.applyConstraints(constraints);
      } else {
        console.warn('Zoom capability is not supported by this device.');
      }
    } catch (error) {
      console.error('Failed to apply zoom:', error);
    }
  };

  const changeZoom = async (level) => {
    const videoElement = scannerRef.current;
    const stream = videoElement.srcObject;
    const [track] = stream.getVideoTracks();

    const capabilities = track.getCapabilities();
    if ('zoom' in capabilities) {
      const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max || 10);
      setZoomLevel(newZoomLevel);
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoomLevel }],
        });
      } catch (error) {
        console.error('Failed to apply zoom:', error);
      }
    } else {
      console.warn('Zoom capability is not supported by this device.');
    }
  };

  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const productSnapshot = await get(child(dbRef, `products/${barcode}`));
      if (productSnapshot.exists()) {
        const product = productSnapshot.val();

        const soldItemsSnapshot = await get(child(dbRef, 'SoldItems'));
        let totalSoldQuantity = 0;

        if (soldItemsSnapshot.exists()) {
          const soldItemsData = soldItemsSnapshot.val();
          Object.values(soldItemsData).forEach((item) => {
            if (item.barcode === barcode) {
              totalSoldQuantity += item.quantity || 0;
            }
          });
        }

        const remaining = product.quantity - totalSoldQuantity;

        setScannedProduct({
          barcode,
          name: product.name,
          itemCost: product.itemCost,
          productType: product.productType,
          quantity: product.quantity,
          remainingQuantity: remaining,
        });
        setRemainingQuantity(remaining);
        setIsPopupOpen(true);
      } else {
        setScanStatus('Product not found in the database.');
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      setScanStatus('Error retrieving product information.');
    }
  };

  const handleProductSelect = async (event) => {
    const selectedBarcode = event.target.value;
    setSelectedProduct(selectedBarcode);
    if (selectedBarcode) {
      await fetchProductDetails(selectedBarcode);
    }
  };

  return (
    <div className="container">
      <div className="button-container">
        <button
          className="action-button"
          onClick={() => {
            setShowScanner(true);
            setShowDropdown(false);
            setScanStatus('Align the barcode within the frame.');
          }}
        >
          Scan Barcode
        </button>
        <button
          className="action-button"
          onClick={() => {
            setShowDropdown(true);
            setShowScanner(false);
            setScanStatus('Select a product from the dropdown.');
          }}
        >
          Search for Product
        </button>
      </div>

      {showScanner && (
        <div className="scanner-container">
          <video ref={scannerRef} className="scanner"></video>
          <p className="status">{scanStatus}</p>

          <div className="zoom-controls">
            <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => changeZoom(parseFloat(e.target.value))}
            />
            <button onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
          </div>
        </div>
      )}

      {showDropdown && (
        <div className="dropdown-container">
          <select value={selectedProduct} onChange={handleProductSelect}>
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.barcode} value={product.barcode}>
                {product.name} ({product.barcode})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* {isPopupOpen && scannedProduct && (
        <div className="popup-overlay">
          <div className="popup">
            <button
              className="close-popup-btn"
              onClick={() => setIsPopupOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h3>Product Details</h3>
            <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
            <p><strong>Name:</strong> {scannedProduct.name}</p>
            <p><strong>Item Cost:</strong> ${scannedProduct.itemCost}</p>
            <p><strong>Product Type:</strong> {scannedProduct.productType}</p>
            <p><strong>Initial Quantity:</strong> {scannedProduct.quantity}</p>
            <p><strong>Remaining Quantity:</strong> {remainingQuantity}</p>
            <button className="popup-btn-close" onClick={() => setIsPopupOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )} */}
{isPopupOpen && scannedProduct && (
  <div className="modal-overlay">
    <div className="modal-container">
      <button
        className="modal-close-btn"
        onClick={() => setIsPopupOpen(false)}
        aria-label="Close"
      >
        ×
      </button>
      <h3 className="modal-title">Product Details</h3>
      <div className="modal-content">
        <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
        <p><strong>Name:</strong> {scannedProduct.name}</p>
        <p><strong>Item Cost:</strong> ${scannedProduct.itemCost}</p>
        <p><strong>Product Type:</strong> {scannedProduct.productType}</p>
        <p><strong>Initial Quantity:</strong> {scannedProduct.quantity}</p>
        <p><strong>Remaining Quantity:</strong> {remainingQuantity}</p>
      </div>
      <button className="modal-btn-close" onClick={() => setIsPopupOpen(false)}>
        Close
      </button>
    </div>
  </div>
)}
    </div>
  );
};

export default RemainingProducts;