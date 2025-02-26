// import React, { useState, useEffect, useRef } from 'react';
// import { ref, get } from 'firebase/database';
// import { database } from '../Auth/firebase'; // Ensure correct path
// import { BrowserMultiFormatReader } from '@zxing/library'; // Import the ZXing library
// import '../CSS/remainingProducts.css'; // Ensure correct path

// function RemainingProducts() {
//   const [products, setProducts] = useState([]);
//   const [soldItems, setSoldItems] = useState([]);
//   const [scannedBarcode, setScannedBarcode] = useState('');
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [showPopup, setShowPopup] = useState(false);
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const videoRef = useRef(null); // Ref for video element
//   const scannerRef = useRef(null); // Ref for the barcode scanner instance

//   // Fetch products from Firebase
//   useEffect(() => {
//     const fetchProducts = async () => {
//       try {
//         const productsRef = ref(database, 'products');
//         const snapshot = await get(productsRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const productList = Object.keys(data).map((key) => ({
//             id: key,
//             ...data[key],
//           }));
//           setProducts(productList);
//         }
//       } catch (error) {
//         console.error('Error fetching products:', error);
//       }
//     };

//     fetchProducts();
//   }, []);

//   // Fetch sold items from Firebase
//   useEffect(() => {
//     const fetchSoldItems = async () => {
//       try {
//         const soldItemsRef = ref(database, 'SoldItems');
//         const snapshot = await get(soldItemsRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const soldItemList = Object.keys(data).map((key) => ({
//             id: key,
//             ...data[key],
//           }));
//           setSoldItems(soldItemList);
//         }
//       } catch (error) {
//         console.error('Error fetching sold items:', error);
//       }
//     };

//     fetchSoldItems();
//   }, []);

//   // Calculate the total quantity sold per product
//   const calculateQuantitySold = (productId) => {
//     return soldItems.reduce((total, item) => {
//       if (item.barcode === productId) {
//         return total + (item.quantity || 0);
//       }
//       return total;
//     }, 0);
//   };

//   // Initialize the ZXing scanner with zoom effect
//   useEffect(() => {
//     const codeReader = new BrowserMultiFormatReader();
//     scannerRef.current = codeReader;

//     if (videoRef.current) {
//       navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
//         .then((stream) => {
//           videoRef.current.srcObject = stream;
//           videoRef.current.play();
//           applyZoom(stream); // Apply zoom after stream starts
//         })
//         .catch((err) => console.error("Error accessing camera:", err));

//       codeReader
//         .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
//           if (result) {
//             const barcode = result.getText();
//             if (barcode !== scannedBarcode) {
//               setScannedBarcode(barcode);
//               handleScan(barcode);
//             }
//           }
//         })
//         .catch((err) => console.error("Scanner initialization error:", err));
//     }

//     return () => {
//       if (scannerRef.current) {
//         scannerRef.current.reset();
//       }
//       if (videoRef.current && videoRef.current.srcObject) {
//         const tracks = videoRef.current.srcObject.getTracks();
//         tracks.forEach(track => track.stop()); // Stop the video stream
//       }
//     };
//   }, [scannedBarcode, zoomLevel]);

//   // Apply zoom to the camera stream
//   const applyZoom = async (stream) => {
//     const [track] = stream.getVideoTracks();
//     if (track && 'zoom' in track.getCapabilities()) {
//       try {
//         await track.applyConstraints({
//           advanced: [{ zoom: zoomLevel }],
//         });
//       } catch (error) {
//         console.error('Failed to apply zoom:', error);
//       }
//     }
//   };

//   // Handle barcode scan and update state
//   const handleScan = (barcode) => {
//     const foundProduct = products.find((product) => product.id === barcode);
//     if (foundProduct) {
//       const quantitySold = calculateQuantitySold(foundProduct.id);
//       const remainingQuantity = (foundProduct.quantity || 0) - quantitySold;
//       setScannedProduct({ ...foundProduct, quantitySold, remainingQuantity });
//       setShowPopup(true);
//     } else {
//       console.warn('Product not found for barcode:', barcode);
//     }
//   };

//   return (
//     <div className="remaining-products-container">
//       <h2 className="remaining-products-heading">Remaining Products</h2>

//       <div className="scanner-container">
//         <video ref={videoRef} width="300" height="200" style={{ border: '1px solid black' }} />
//         <div className="zoom-controls">
//           <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
//           <input
//             type="range"
//             min="0.5"
//             max="10"
//             step="0.1"
//             value={zoomLevel}
//             onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
//           />
//           <button onClick={() => setZoomLevel(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
//         </div>
//       </div>

//       {/* Popup for Scanned Product */}
//       {showPopup && scannedProduct && (
//         <div className="popup-overlay">
//           <div className="popup-content">
//             <h3>Scanned Product</h3>
//             <p><strong>Name:</strong> {scannedProduct.name}</p>
//             <p><strong>Quantity Sold:</strong> {scannedProduct.quantitySold}</p>
//             <p><strong>Remaining Quantity:</strong> {scannedProduct.remainingQuantity}</p>
//             <button onClick={() => setShowPopup(false)}>Close</button>
//           </div>
//         </div>
//       )}

//       {/* Product List */}
//       <ul className="remaining-products-list">
//         {products.map((product) => {
//           const quantitySold = calculateQuantitySold(product.id);
//           const remainingQuantity = (product.quantity || 0) - quantitySold;

//           return (
//             <li key={product.id} className="remaining-products-list-item">
//               <span className="remaining-products-item-name">{product.name}</span>
//               <span className="remaining-products-quantity-sold">Quantity Sold: {quantitySold}</span>
//               <span className="remaining-products-remaining-quantity">Remaining Quantity: {remainingQuantity}</span>
//             </li>
//           );
//         })}
//       </ul>
//     </div>
//   );
// }

// export default RemainingProducts;


import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

const RemainingProducts = () => {
  const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const scannerRef = useRef(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    const videoElement = scannerRef.current;

    // Initialize the scanner
    codeReader
      .decodeFromVideoDevice(null, videoElement, (result, error) => {
        if (result) {
          setScanStatus('Barcode detected! Processing...');
          // Simulate fetching product details (replace with your logic)
          setScannedProduct({
            barcode: result.text,
            name: 'Sample Product',
            price: 10.99,
            category: 'Sample Category',
          });
        } else if (error) {
          setScanStatus('Align the barcode and hold steady.');
          console.warn('Barcode detection error:', error);
        }
      }, {
        tryHarder: true, // Enable more intensive scanning
        constraints: {
          video: {
            facingMode: 'environment', // Use the rear camera
            width: { ideal: 1280 }, // Request higher resolution
            height: { ideal: 720 },
          },
        },
      })
      .then(() => {
        applyZoom();
      })
      .catch((err) => console.error('Camera initialization failed:', err));

    // Cleanup on unmount
    return () => {
      codeReader.reset();
    };
  }, [zoomLevel]);

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

  return (
    <div className="container">
      <div className="scanner-container">
        <video ref={scannerRef} className="scanner"></video>
        <p className="status">{scanStatus}</p>

        {/* Zoom Controls */}
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

        {/* Display Scanned Product Information */}
        {scannedProduct && (
          <div className="product-info">
            <h3>Product Details</h3>
            <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
            <p><strong>Name:</strong> {scannedProduct.name}</p>
            <p><strong>Price:</strong> ${scannedProduct.price}</p>
            <p><strong>Category:</strong> {scannedProduct.category}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemainingProducts;