// import React, { useState, useEffect, useRef } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase'; // Adjust the import path as needed
// import { ref, get, child } from 'firebase/database'; // Import child here

// const RemainingProducts = () => {
//   const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const scannerRef = useRef(null);

//   useEffect(() => {
//     const codeReader = new BrowserMultiFormatReader();
//     const videoElement = scannerRef.current;

//     // Initialize the scanner
//     codeReader
//       .decodeFromVideoDevice(null, videoElement, (result, error) => {
//         if (result) {
//           setScanStatus('Barcode detected! Processing...');
//           fetchProductDetails(result.text); // Fetch product details from Firebase
//         } else if (error) {
//           setScanStatus('Align the barcode and hold steady.');
//           console.warn('Barcode detection error:', error);
//         }
//       }, {
//         tryHarder: true,
//         constraints: {
//           video: {
//             facingMode: 'environment', // Use the rear camera
//             width: { ideal: 1280 }, // Request higher resolution
//             height: { ideal: 720 },
//           },
//         },
//       })
//       .then(() => {
//         applyZoom();
//       })
//       .catch((err) => console.error('Camera initialization failed:', err));

//     // Cleanup on unmount
//     return () => {
//       codeReader.reset();
//     };
//   }, [zoomLevel]);

//   const applyZoom = async () => {
//     try {
//       const videoElement = scannerRef.current;
//       const stream = videoElement.srcObject;
//       const [track] = stream.getVideoTracks();

//       const capabilities = track.getCapabilities();
//       if ('zoom' in capabilities) {
//         const constraints = {
//           advanced: [{ zoom: zoomLevel }],
//         };
//         await track.applyConstraints(constraints);
//       } else {
//         console.warn('Zoom capability is not supported by this device.');
//       }
//     } catch (error) {
//       console.error('Failed to apply zoom:', error);
//     }
//   };

//   const changeZoom = async (level) => {
//     const videoElement = scannerRef.current;
//     const stream = videoElement.srcObject;
//     const [track] = stream.getVideoTracks();

//     const capabilities = track.getCapabilities();
//     if ('zoom' in capabilities) {
//       const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max || 10);
//       setZoomLevel(newZoomLevel);
//       try {
//         await track.applyConstraints({
//           advanced: [{ zoom: newZoomLevel }],
//         });
//       } catch (error) {
//         console.error('Failed to apply zoom:', error);
//       }
//     } else {
//       console.warn('Zoom capability is not supported by this device.');
//     }
//   };

//   const fetchProductDetails = async (barcode) => {
//     const dbRef = ref(database);
//     try {
//       const snapshot = await get(child(dbRef, `products/${barcode}`)); // Fetch product details from Firebase
//       if (snapshot.exists()) {
//         const product = snapshot.val();
//         setScannedProduct({
//           barcode,
//           name: product.name,
//           itemCost: product.itemCost,
//           productType: product.productType,
//           quantity: product.quantity,
//         });
//         setIsPopupOpen(true); // Open the popup to display product details
//       } else {
//         setScanStatus('Product not found in the database.');
//       }
//     } catch (error) {
//       console.error('Error fetching product details:', error);
//       setScanStatus('Error retrieving product information.');
//     }
//   };

//   return (
//     <div className="container">
//       <div className="scanner-container">
//         <video ref={scannerRef} className="scanner"></video>
//         <p className="status">{scanStatus}</p>

//         {/* Zoom Controls */}
//         <div className="zoom-controls">
//           <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
//           <input
//             type="range"
//             min="0.5"
//             max="10"
//             step="0.1"
//             value={zoomLevel}
//             onChange={(e) => changeZoom(parseFloat(e.target.value))}
//           />
//           <button onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
//         </div>

//         {/* Popup for Scanned Product */}
//         {isPopupOpen && scannedProduct && (
//           <div className="popup-overlay">
//             <div className="popup">
//               <button
//                 className="close-popup-btn"
//                 onClick={() => setIsPopupOpen(false)}
//                 aria-label="Close"
//               >
//                 ×
//               </button>
//               <h3>Product Details</h3>
//               <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
//               <p><strong>Name:</strong> {scannedProduct.name}</p>
//               <p><strong>Item Cost:</strong> ${scannedProduct.itemCost}</p>
//               <p><strong>Product Type:</strong> {scannedProduct.productType}</p>
//               <p><strong>Quantity:</strong> {scannedProduct.quantity}</p>

//               <button className="popup-btn-close" onClick={() => setIsPopupOpen(false)}>
//                 Close
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RemainingProducts;

import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, child } from 'firebase/database';

const RemainingProducts = () => {
  const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [remainingQuantity, setRemainingQuantity] = useState(0); // State for remaining quantity
  const scannerRef = useRef(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    const videoElement = scannerRef.current;

    // Initialize the scanner
    codeReader
      .decodeFromVideoDevice(null, videoElement, (result, error) => {
        if (result) {
          setScanStatus('Barcode detected! Processing...');
          fetchProductDetails(result.text); // Fetch product details from Firebase
        } else if (error) {
          setScanStatus('Align the barcode and hold steady.');
          console.warn('Barcode detection error:', error);
        }
      }, {
        tryHarder: true,
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

  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      // Fetch product details from Firebase
      const productSnapshot = await get(child(dbRef, `products/${barcode}`));
      if (productSnapshot.exists()) {
        const product = productSnapshot.val();

        // Fetch sold items for this product
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

        // Calculate remaining quantity
        const remaining = product.quantity - totalSoldQuantity;

        setScannedProduct({
          barcode,
          name: product.name,
          itemCost: product.itemCost,
          productType: product.productType,
          quantity: product.quantity,
          remainingQuantity: remaining, // Add remaining quantity to the state
        });
        setRemainingQuantity(remaining); // Set remaining quantity
        setIsPopupOpen(true); // Open the popup to display product details
      } else {
        setScanStatus('Product not found in the database.');
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      setScanStatus('Error retrieving product information.');
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

        {/* Popup for Scanned Product */}
        {isPopupOpen && scannedProduct && (
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
              <p><strong>Remaining Quantity:</strong> {remainingQuantity}</p> {/* Display remaining quantity */}
              <button className="popup-btn-close" onClick={() => setIsPopupOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemainingProducts;