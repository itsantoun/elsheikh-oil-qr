import React, { useState, useEffect, useRef } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../Auth/firebase'; // Ensure correct path
import { BrowserMultiFormatReader } from '@zxing/library'; // Import the ZXing library
import '../CSS/remainingProducts.css'; // Ensure correct path

function RemainingProducts() {
  const [products, setProducts] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanning, setScanning] = useState(true); // Define scanning state
  const videoRef = useRef(null); // Ref for video element

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

  // Initialize the ZXing scanner
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();

    if (videoRef.current) {
      codeReader
        .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
          if (result) {
            setScannedBarcode(result.getText());
            setScanning(false); // Stop scanning after a successful scan
            handleScan(result.getText());
          } else if (err) {
            console.error('Barcode scan error:', err);
          }
        })
        .catch((err) => {
          console.error('Error initializing scanner:', err);
        });
    }

    // Cleanup when component unmounts
    return () => {
      codeReader.reset();
    };
  }, []);

  // Handle barcode scan and update state
  const handleScan = (barcode) => {
    setScannedBarcode(barcode);

    // Find product by ID (barcode)
    const foundProduct = products.find((product) => product.id === barcode);
    if (foundProduct) {
      const quantitySold = calculateQuantitySold(foundProduct.name);
      const remainingQuantity = (foundProduct.quantity || 0) - quantitySold;
      setScannedProduct({ ...foundProduct, quantitySold, remainingQuantity });
    } else {
      setScannedProduct(null);
    }
  };

  return (
    <div className="remaining-products-container">
      <h2 className="remaining-products-heading">Remaining Products</h2>

      
      <div className="scanner-container">
        <video ref={videoRef} width="300" height="200" style={{ border: '1px solid black' }} />
      </div>

      {/* Display Scanned Product Info */}
      {scannedProduct && (
        <div className="scanned-product-info">
          <h3>Scanned Product</h3>
          <p>Name: {scannedProduct.name}</p>
          <p>Quantity Sold: {scannedProduct.quantitySold}</p>
          <p>Remaining Quantity: {scannedProduct.remainingQuantity}</p>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RemainingProducts;