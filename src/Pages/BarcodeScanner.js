// import React, { useState, useEffect, useContext } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase';
// import { ref, get, child, push } from "firebase/database";
// import { UserContext } from '../Auth/userContext';
// import '../CSS/BarcodeScanner.css';

// const BarcodeScanner = () => {
//   const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [dialogMessage, setDialogMessage] = useState(null);
//   const [successMessage, setSuccessMessage] = useState(null);
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [userName, setUserName] = useState(null);
//   const [customers, setCustomers] = useState([]);
//   const [selectedCustomer, setSelectedCustomer] = useState('');
//   const [quantity, setQuantity] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [zoomLevel, setZoomLevel] = useState(1); // New state for zoom level
//   const scannerRef = React.useRef(null);

//   const { user } = useContext(UserContext);

//   useEffect(() => {
//     const fetchUserName = async () => {
//       if (user?.uid) {
//         const userRef = ref(database, `users/${user.uid}`);
//         try {
//           const snapshot = await get(userRef);
//           if (snapshot.exists()) {
//             const userData = snapshot.val();
//             setUserName(userData.name);
//           } else {
//             console.error("User not found in the database.");
//           }
//         } catch (error) {
//           console.error("Error fetching user's name:", error);
//         }
//       }
//     };

//     const fetchCustomers = async () => {
//       setLoading(true);
//       const customersRef = ref(database, 'customers');
//       try {
//         const snapshot = await get(customersRef);
//         if (snapshot.exists()) {
//           const customersData = snapshot.val();
//           console.log("Fetched customers data:", customersData);
//           setCustomers(
//             Object.entries(customersData).map(([key, value]) => ({
//               id: key,
//               name: value.name || 'Unknown Customer',
//             }))
//           );
//         } else {
//           console.log("No customers data found.");
//           setCustomers([]);
//         }
//       } catch (error) {
//         console.error("Error fetching customers:", error);
//       }
//       setLoading(false);
//     };

//     fetchUserName();
//     fetchCustomers();

//     const codeReader = new BrowserMultiFormatReader();
//     const videoElement = scannerRef.current;

//     codeReader
//       .decodeFromVideoDevice(null, videoElement, (result, error) => {
//         if (result) {
//           console.log(`Scanned Code: ${result.text}`);
//           setScanStatus('Barcode detected! Processing...');
//           fetchProductDetails(result.text);
//         } else if (error) {
//           setScanStatus('Align the barcode and hold steady.');
//         }
//       })
//       .then(() => {
//         // Apply zoom after camera is initialized
//         applyZoom();
//       })
//       .catch((err) => console.error('Camera initialization failed: refresh/try again later', err));

//     return () => {
//       codeReader.reset();
//     };
//   }, [user, zoomLevel]);

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

//   useEffect(() => {
//     applyZoom();
//   }, [zoomLevel]);

//  const changeZoom = async (level) => {
//   const videoElement = scannerRef.current;
//   const stream = videoElement.srcObject;
//   const [track] = stream.getVideoTracks();
  
//   const capabilities = track.getCapabilities();
//   if ('zoom' in capabilities) {
//     const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max);
//     setZoomLevel(newZoomLevel);
//   } else {
//     console.warn('Zoom capability is not supported by this device.');
//   }
// };

//   const fetchProductDetails = async (barcode) => {
//     const dbRef = ref(database);
//     try {
//       const snapshot = await get(child(dbRef, `products/${barcode}`));
//       if (snapshot.exists()) {
//         const product = snapshot.val();
//         setScannedProduct({ barcode, ...product });
//         setDialogMessage(`Product found: ${product.name}. Do you want to add it?`);
//         setIsPopupOpen(true);
//       } else {
//         setDialogMessage("Product not found.");
//         setIsPopupOpen(false);
//       }
//     } catch (error) {
//       setDialogMessage("Error retrieving product information.");
//       setIsPopupOpen(false);
//     }
//   };

//   const saveScannedItem = async () => {
//     if (!scannedProduct || !scannedProduct.barcode || !selectedCustomer || quantity <= 0) {
//       setDialogMessage("Error: Missing information.");
//       return;
//     }

//     const soldItemsRef = ref(database, 'SoldItems');
//     const currentDate = new Date().toISOString();

//     const newItem = {
//       barcode: scannedProduct.barcode,
//       name: scannedProduct.name,
//       category: scannedProduct.category || 'Unknown',
//       price: scannedProduct.price || 0,
//       dateScanned: currentDate,
//       scannedBy: userName || 'Unknown',
//       customerId: selectedCustomer,
//       quantity: quantity,
//     };

//     try {
//       await push(soldItemsRef, newItem);
//       setSuccessMessage(`Item "${scannedProduct.name}" added successfully!`);
//       setTimeout(() => setSuccessMessage(null), 3000);
//       setIsPopupOpen(false);
//       setDialogMessage(null);
//       setScannedProduct(null);
//       setSelectedCustomer('');
//       setQuantity(1);
//     } catch (error) {
//       console.error("Error saving scanned item:", error);
//       setDialogMessage("Error saving item to the database.");
//     }
//   };

//   const handleLogout = () => {
//     window.location.href = 'https://itsantoun.github.io/elsheikh-oil-qr/';
//   };

//   return (
//     <div className="container">
//       <div className="header">
//         <button className="logout-button" onClick={handleLogout}>Logout</button>
//       </div>
//       <div className="scanner-container">
//         <video ref={scannerRef} className="scanner"></video>
//         <p className="status">{scanStatus}</p>
//         {successMessage && <div className="success-message">{successMessage}</div>}
//         {loading && <div className="loading-message">Loading customers...</div>}
        
//         <div className="zoom-controls">
//           <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.1))}>Zoom Out</button>
//           <input 
//             type="range" 
//             min="0.5" 
//             max="3" 
//             step="0.1"
//             value={zoomLevel}
//             onChange={(e) => changeZoom(parseFloat(e.target.value))}
//           />
//           <button onClick={() => changeZoom(Math.min(3, zoomLevel + 0.1))}>Zoom In</button>
//         </div>

//         {isPopupOpen && (
//           <div className="popup-overlay">
//             <div className="popup">
//               <h3 className="popup-title">Product Found</h3>
//               <p className="popup-text">{dialogMessage}</p>
//               <div className="customer-select">
//                 <label htmlFor="customer">Select Customer:</label>
//                 <select
//                   id="customer"
//                   value={selectedCustomer}
//                   onChange={(e) => setSelectedCustomer(e.target.value)}
//                 >
//                   <option value="">--Select Customer--</option>
//                   {customers.map((customer) => (
//                     <option key={customer.id} value={customer.id}>
//                       {customer.name}
//                     </option>
//                   ))}
//                 </select>
//               </div>
//               <div className="quantity-input">
//                 <label htmlFor="quantity">Quantity:</label>
//                 <input
//                   type="number"
//                   id="quantity"
//                   value={quantity}
//                   onChange={(e) => setQuantity(e.target.value)}
//                   onBlur={(e) => setQuantity(Math.max(1, e.target.value))}
//                   min="1"
//                 />
//               </div>
//               <button className="popup-button" onClick={saveScannedItem}>Yes, Add</button>
//               <button className="popup-button cancel" onClick={() => setIsPopupOpen(false)}>Cancel</button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default BarcodeScanner;

import React, { useState, useEffect, useContext } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, push } from "firebase/database";
import { UserContext } from '../Auth/userContext';
import '../CSS/BarcodeScanner.css';

const BarcodeScanner = () => {
  const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [userName, setUserName] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const scannerRef = React.useRef(null);
  const { user } = useContext(UserContext);

  useEffect(() => {
    const fetchUserName = async () => {
      if (user?.uid) {
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            setUserName(snapshot.val().name);
          } else {
            console.error("User not found in the database.");
          }
        } catch (error) {
          console.error("Error fetching user's name:", error.message);
        }
      }
    };

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const customersRef = ref(database, 'customers');
        const snapshot = await get(customersRef);
        if (snapshot.exists()) {
          const customersData = snapshot.val();
          setCustomers(
            Object.entries(customersData).map(([key, value]) => ({
              id: key,
              name: value.name || 'Unknown Customer',
            }))
          );
        } else {
          console.warn("No customers data found.");
          setCustomers([]);
        }
      } catch (error) {
        console.error("Error fetching customers:", error.message);
      } finally {
        setLoading(false);
      }
    };

    const initScanner = () => {
      const codeReader = new BrowserMultiFormatReader();
      const videoElement = scannerRef.current;

      codeReader
        .decodeFromVideoDevice(null, videoElement, (result, error) => {
          if (result) {
            setScanStatus('Barcode detected! Processing...');
            fetchProductDetails(result.text);
          } else if (error) {
            setScanStatus('Align the barcode and hold steady.');
          }
        })
        .catch((err) => console.error('Camera initialization failed:', err));

      return () => {
        codeReader.reset();
      };
    };

    fetchUserName();
    fetchCustomers();
    const cleanUpScanner = initScanner();

    return () => {
      cleanUpScanner();
    };
  }, [user]);

  const fetchProductDetails = async (barcode) => {
    try {
      const productRef = ref(database, `products/${barcode}`);
      const snapshot = await get(productRef);
      if (snapshot.exists()) {
        setScannedProduct({ barcode, ...snapshot.val() });
        setDialogMessage("Product found. Do you want to add it?");
        setIsPopupOpen(true);
      } else {
        setDialogMessage("Product not found.");
        setIsPopupOpen(false);
      }
    } catch (error) {
      console.error("Error fetching product details:", error.message);
      setDialogMessage("Error retrieving product information.");
      setIsPopupOpen(false);
    }
  };

  const saveScannedItem = async () => {
    if (!scannedProduct || !selectedCustomer || quantity <= 0) {
      setDialogMessage("Error: Missing or invalid information.");
      return;
    }

    const newItem = {
      barcode: scannedProduct.barcode,
      name: scannedProduct.name,
      category: scannedProduct.category || 'Unknown',
      price: scannedProduct.price || 0,
      dateScanned: new Date().toISOString(),
      scannedBy: userName || 'Unknown',
      customerId: selectedCustomer,
      quantity: Math.max(1, quantity),
    };

    try {
      const soldItemsRef = ref(database, 'SoldItems');
      await push(soldItemsRef, newItem);
      setSuccessMessage(`Item "${scannedProduct.name}" added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsPopupOpen(false);
      resetState();
    } catch (error) {
      console.error("Error saving scanned item:", error.message);
      setDialogMessage("Error saving item to the database.");
    }
  };

  const resetState = () => {
    setScannedProduct(null);
    setSelectedCustomer('');
    setQuantity(1);
  };

  const changeZoom = async (level) => {
    const videoElement = scannerRef.current;
    const stream = videoElement?.srcObject;
    const track = stream?.getVideoTracks()?.[0];
    const capabilities = track?.getCapabilities();

    if (capabilities?.zoom) {
      const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max);
      setZoomLevel(newZoomLevel);
      try {
        await track.applyConstraints({ advanced: [{ zoom: newZoomLevel }] });
      } catch (error) {
        console.error("Error applying zoom:", error.message);
      }
    }
  };

  return (
    <div className="barcode-scanner">
      <h1>Barcode Scanner</h1>
      <div className="scanner-container">
        <video ref={scannerRef} style={{ width: '100%', height: 'auto' }} />
        <p>{scanStatus}</p>
      </div>

      <div className="controls">
        <button onClick={() => changeZoom(zoomLevel + 0.1)}>Zoom In</button>
        <button onClick={() => changeZoom(zoomLevel - 0.1)}>Zoom Out</button>
      </div>

      <div className="popup" style={{ display: isPopupOpen ? 'block' : 'none' }}>
        <p>{dialogMessage}</p>
        {dialogMessage && (
          <div>
            {scannedProduct && (
              <div>
                <h3>{scannedProduct.name}</h3>
                <p>{`Category: ${scannedProduct.category}`}</p>
                <p>{`Price: ${scannedProduct.price}`}</p>
              </div>
            )}
            <label>
              Quantity:
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min="1"
              />
            </label>
            <div>
              <label>
                Select Customer:
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <button onClick={saveScannedItem}>Add to Inventory</button>
              <button onClick={() => setIsPopupOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {successMessage && <p>{successMessage}</p>}
    </div>
  );
};

export default BarcodeScanner;