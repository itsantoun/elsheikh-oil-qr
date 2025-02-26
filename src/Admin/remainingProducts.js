import React, { useState, useEffect, useRef } from 'react';
import { ref, get, update } from 'firebase/database';
import { database } from '../Auth/firebase'; // Ensure correct path
import { BrowserMultiFormatReader } from '@zxing/library'; // Import the ZXing library
import '../CSS/remainingProducts.css'; // Ensure correct path

function RemainingProducts() {
  const [products, setProducts] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [editingItem, setEditingItem] = useState(null); // Track the item being edited
  const videoRef = useRef(null); // Ref for video element
  const scannerRef = useRef(null); // Ref for the barcode scanner instance

  // Fetch products from Firebase
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = ref(database, 'products');
        const snapshot = await get(productsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const productList = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setProducts(productList);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  // Fetch sold items from Firebase
  useEffect(() => {
    const fetchSoldItems = async () => {
      try {
        const soldItemsRef = ref(database, 'SoldItems');
        const snapshot = await get(soldItemsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const soldItemList = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setSoldItems(soldItemList);
        }
      } catch (error) {
        console.error('Error fetching sold items:', error);
      }
    };

    fetchSoldItems();
  }, []);

  // Calculate the total quantity sold per product
  const calculateQuantitySold = (productName) => {
    return soldItems.reduce((total, item) => {
      if (item.name === productName) {
        return total + (item.quantity || 0);
      }
      return total;
    }, 0);
  };

  // Initialize the ZXing scanner with zoom effect
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    scannerRef.current = codeReader;

    if (videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          applyZoom(stream); // Apply zoom after stream starts
        })
        .catch((err) => console.error("Error accessing camera:", err));

      codeReader
        .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
          if (result) {
            const barcode = result.getText();
            if (barcode !== scannedBarcode) {
              setScannedBarcode(barcode);
              handleScan(barcode);
            }
          }
        })
        .catch((err) => console.error("Scanner initialization error:", err));
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.reset();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop()); // Stop the video stream
      }
    };
  }, [scannedBarcode, zoomLevel]);

  // Apply zoom to the camera stream
  const applyZoom = async (stream) => {
    const [track] = stream.getVideoTracks();
    if (track && 'zoom' in track.getCapabilities()) {
      try {
        await track.applyConstraints({
          advanced: [{ zoom: zoomLevel }],
        });
      } catch (error) {
        console.error('Failed to apply zoom:', error);
      }
    }
  };

  // Handle barcode scan and update state
  const handleScan = (barcode) => {
    const foundProduct = products.find((product) => product.barcode === barcode);
    if (foundProduct) {
      const quantitySold = calculateQuantitySold(foundProduct.name);
      const remainingQuantity = (foundProduct.quantity || 0) - quantitySold;
      setScannedProduct({ ...foundProduct, quantitySold, remainingQuantity });
      setShowPopup(true);
    }
  };

  // Save edited product details
  const saveEditedItem = async (item) => {
    try {
      const productRef = ref(database, `products/${item.id}`);
      await update(productRef, {
        quantity: item.quantity,
      });
      setEditingItem(null); // Close the edit form
      // Refresh product list
      const updatedProducts = products.map((p) =>
        p.id === item.id ? { ...p, quantity: item.quantity } : p
      );
      setProducts(updatedProducts);
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  return (
    <div className="remaining-products-container">
      <h2 className="remaining-products-heading">Remaining Products</h2>

      <div className="scanner-container">
        <video ref={videoRef} width="300" height="200" style={{ border: '1px solid black' }} />
        <div className="zoom-controls">
          <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
          />
          <button onClick={() => setZoomLevel(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
        </div>
      </div>

      {/* Popup for Scanned Product */}
      {showPopup && scannedProduct && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h3>Scanned Product</h3>
            <p><strong>Name:</strong> {scannedProduct.name}</p>
            <p><strong>Quantity Sold:</strong> {scannedProduct.quantitySold}</p>
            <p><strong>Remaining Quantity:</strong> {scannedProduct.remainingQuantity}</p>
            <button onClick={() => setShowPopup(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Product List */}
      <ul className="remaining-products-list">
        {products.map((product) => {
          const quantitySold = calculateQuantitySold(product.name);
          const remainingQuantity = (product.quantity || 0) - quantitySold;

          return (
            <li key={product.id} className="remaining-products-list-item">
              <span className="remaining-products-item-name">{product.name}</span>
              <span className="remaining-products-quantity-sold">Quantity Sold: {quantitySold}</span>
              <span className="remaining-products-remaining-quantity">Remaining Quantity: {remainingQuantity}</span>
              <button onClick={() => setEditingItem(product)}>Edit</button>
            </li>
          );
        })}
      </ul>

      {/* Edit Modal */}
      {editingItem && (
        <div className="edit-popup">
          <div className="edit-form-container">
            <h3>Edit Product</h3>
            <p><strong>Name:</strong> {editingItem.name}</p>
            <div>
              <label htmlFor="editQuantity">Quantity</label>
              <input
                type="number"
                id="editQuantity"
                value={editingItem.quantity}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    quantity: Math.max(0, parseInt(e.target.value, 10)),
                  })
                }
                min="0"
              />
            </div>
            <div className="form-buttons">
              <button
                className="save-button"
                onClick={() => saveEditedItem(editingItem)}
              >
                Save
              </button>
              <button className="cancel-button" onClick={() => setEditingItem(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RemainingProducts;