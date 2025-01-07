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
//   const scannerRef = React.useRef(null);

//   const { user } = useContext(UserContext);

//   useEffect(() => {
//     const fetchUserName = async () => {
//       if (user?.uid) {
//         try {
//           const userRef = ref(database, `users/${user.uid}`);
//           const snapshot = await get(userRef);
//           if (snapshot.exists()) {
//             setUserName(snapshot.val().name);
//           } else {
//             console.warn("User not found.");
//           }
//         } catch (error) {
//           console.error("Error fetching user:", error);
//         }
//       }
//     };

//     const fetchCustomers = async () => {
//       setLoading(true);
//       try {
//         const customersRef = ref(database, 'customers');
//         const snapshot = await get(customersRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           setCustomers(
//             Object.entries(data).map(([key, value]) => ({
//               id: key,
//               name: value.name || 'Unknown Customer',
//             }))
//           );
//         } else {
//           setCustomers([]);
//         }
//       } catch (error) {
//         console.error("Error fetching customers:", error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchUserName();
//     fetchCustomers();

//     const codeReader = new BrowserMultiFormatReader();
//     const videoElement = scannerRef.current;

//     codeReader
//       .decodeFromVideoDevice(null, videoElement, (result, error) => {
//         if (result) {
//           setScanStatus('Barcode detected! Processing...');
//           fetchProductDetails(result.text);
//         } else if (error) {
//           setScanStatus('Align the barcode and hold steady.');
//         }
//       })
//       .catch((err) => console.error("Camera initialization failed:", err));

//     return () => codeReader.reset();
//   }, [user]);

//   const fetchProductDetails = async (barcode) => {
//     try {
//       const snapshot = await get(child(ref(database), `products/${barcode}`));
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
//       console.error("Error fetching product details:", error);
//       setDialogMessage("Error retrieving product information.");
//       setIsPopupOpen(false);
//     }
//   };

//   const saveScannedItem = async () => {
//     if (!scannedProduct || !selectedCustomer || quantity <= 0) {
//       setDialogMessage("Error: Missing required information.");
//       return;
//     }

//     try {
//       const soldItemsRef = ref(database, 'SoldItems');
//       await push(soldItemsRef, {
//         barcode: scannedProduct.barcode,
//         name: scannedProduct.name,
//         category: scannedProduct.category || 'Unknown',
//         price: scannedProduct.price || 0,
//         dateScanned: new Date().toISOString(),
//         scannedBy: userName || 'Unknown',
//         customerId: selectedCustomer,
//         quantity,
//       });
//       setSuccessMessage(`Item "${scannedProduct.name}" added successfully!`);
//       setTimeout(() => setSuccessMessage(null), 3000);
//       resetPopup();
//     } catch (error) {
//       console.error("Error saving item:", error);
//       setDialogMessage("Failed to save the item.");
//     }
//   };

//   const resetPopup = () => {
//     setIsPopupOpen(false);
//     setDialogMessage(null);
//     setScannedProduct(null);
//     setSelectedCustomer('');
//     setQuantity(1);
//   };

//   const handleLogout = () => {
//     window.location.href = 'https://itsantoun.github.io/elsheikh-oil-qr/';
//   };

//   return (
//     <div className="container">
//       <div className="header">
//         <button className="logout-button" onClick={handleLogout}>
//           Logout
//         </button>
//       </div>
//       <div className="scanner-container">
//         <video ref={scannerRef} className="scanner"></video>
//         <p className="status">{scanStatus}</p>
//         {successMessage && <div className="success-message">{successMessage}</div>}
//         {loading && <div className="loading-message">Loading customers...</div>}
//         {isPopupOpen && (
//           <div className="popup-overlay">
//             <div className="popup">
//               <h3 className="popup-title">Product Found</h3>
//               <p className="popup-text">{dialogMessage}</p>
//               <label htmlFor="customer">Select Customer:</label>
//               <select
//                 id="customer"
//                 value={selectedCustomer}
//                 onChange={(e) => setSelectedCustomer(e.target.value)}
//               >
//                 <option value="">--Select Customer--</option>
//                 {customers.map((customer) => (
//                   <option key={customer.id} value={customer.id}>
//                     {customer.name}
//                   </option>
//                 ))}
//               </select>
//               <label htmlFor="quantity">Quantity:</label>
//               <input
//                 type="number"
//                 id="quantity"
//                 value={quantity}
//                 onChange={(e) => setQuantity(Math.max(1, e.target.value))}
//                 min="1"
//               />
//               <button className="popup-button" onClick={saveScannedItem}>
//                 Yes, Add
//               </button>
//               <button className="popup-button cancel" onClick={resetPopup}>
//                 Cancel
//               </button>
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
import { ref, get, child, push } from "firebase/database";
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
  const scannerRef = React.useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1); // State to hold zoom level

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
            console.warn("User not found.");
          }
        } catch (error) {
          console.error("Error fetching user:", error);
        }
      }
    };

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const customersRef = ref(database, 'customers');
        const snapshot = await get(customersRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setCustomers(
            Object.entries(data).map(([key, value]) => ({
              id: key,
              name: value.name || 'Unknown Customer',
            }))
          );
        } else {
          setCustomers([]);
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserName();
    fetchCustomers();

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
      .catch((err) => console.error("Camera initialization failed:", err));

    // Get user media and apply zoom setting
    const setCameraZoom = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();
      if (capabilities.zoom) {
        videoTrack.applyConstraints({
          advanced: [{ zoom: zoomLevel }],
        });
      }
    };

    setCameraZoom();

    return () => {
      codeReader.reset();
      // Stop the video stream when the component is unmounted
      const stream = scannerRef.current?.srcObject;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [user, zoomLevel]); // Dependency array includes zoomLevel to apply changes

  const fetchProductDetails = async (barcode) => {
    try {
      const snapshot = await get(child(ref(database), `products/${barcode}`));
      if (snapshot.exists()) {
        const product = snapshot.val();
        setScannedProduct({ barcode, ...product });
        setDialogMessage(`Product found: ${product.name}. Do you want to add it?`);
        setIsPopupOpen(true);
      } else {
        setDialogMessage("Product not found.");
        setIsPopupOpen(false);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
      setDialogMessage("Error retrieving product information.");
      setIsPopupOpen(false);
    }
  };

  const saveScannedItem = async () => {
    if (!scannedProduct || !selectedCustomer || quantity <= 0) {
      setDialogMessage("Error: Missing required information.");
      return;
    }

    try {
      const soldItemsRef = ref(database, 'SoldItems');
      await push(soldItemsRef, {
        barcode: scannedProduct.barcode,
        name: scannedProduct.name,
        category: scannedProduct.category || 'Unknown',
        price: scannedProduct.price || 0,
        dateScanned: new Date().toISOString(),
        scannedBy: userName || 'Unknown',
        customerId: selectedCustomer,
        quantity,
      });
      setSuccessMessage(`Item "${scannedProduct.name}" added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      resetPopup();
    } catch (error) {
      console.error("Error saving item:", error);
      setDialogMessage("Failed to save the item.");
    }
  };

  const resetPopup = () => {
    setIsPopupOpen(false);
    setDialogMessage(null);
    setScannedProduct(null);
    setSelectedCustomer('');
    setQuantity(1);
  };

  const handleLogout = () => {
    window.location.href = 'https://itsantoun.github.io/elsheikh-oil-qr/';
  };

  return (
    <div className="container">
      <div className="header">
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
      <div className="scanner-container">
        <video ref={scannerRef} className="scanner"></video>
        <p className="status">{scanStatus}</p>
        {successMessage && <div className="success-message">{successMessage}</div>}
        {loading && <div className="loading-message">Loading customers...</div>}
        {isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup">
              <h3 className="popup-title">Product Found</h3>
              <p className="popup-text">{dialogMessage}</p>
              <label htmlFor="customer">Select Customer:</label>
              <select
                id="customer"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                <option value="">--Select Customer--</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <label htmlFor="quantity">Quantity:</label>
              <input
                type="number"
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, e.target.value))}
                min="1"
              />
              <button className="popup-button" onClick={saveScannedItem}>
                Yes, Add
              </button>
              <button className="popup-button cancel" onClick={resetPopup}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="zoom-controls">
          <button onClick={() => setZoomLevel(prev => Math.min(prev + 1, 3))}>Zoom In</button>
          <button onClick={() => setZoomLevel(prev => Math.max(prev - 1, 1))}>Zoom Out</button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;