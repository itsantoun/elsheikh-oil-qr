// import React, { useState, useEffect, useContext } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase';
// import { ref, get, child, push } from "firebase/database";
// import { UserContext } from '../Auth/userContext'; // Import UserContext
// import '../CSS/BarcodeScanner.css'; // Import the CSS file

// const BarcodeScanner = () => {
//   const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [dialogMessage, setDialogMessage] = useState(null);
//   const [successMessage, setSuccessMessage] = useState(null);
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const scannerRef = React.useRef(null);

//   const { user } = useContext(UserContext); // Access the logged-in user's email

//   useEffect(() => {
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
//       .catch((err) => console.error('Camera initialization failed: refresh/try again later', err));

//     return () => {
//       codeReader.reset();
//     };
//   }, []);

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

//   const saveScannedItem = async (product) => {
//     if (!product || !product.barcode) {
//       console.error("Invalid product data:", product);
//       setDialogMessage("Error: Invalid product data.");
//       return;
//     }

//     const soldItemsRef = ref(database, 'SoldItems');

//     try {
//       const currentDate = new Date().toISOString(); // Get current timestamp
//       const newItem = {
//         barcode: product.barcode,
//         name: product.name,
//         category: product.category || 'Unknown',
//         price: product.price || 0,
//         dateScanned: currentDate,
//         scannedBy: user?.email || 'Unknown', // Save the logged-in user's email
//       };

//       await push(soldItemsRef, newItem); // Push new item to SoldItems
//       setSuccessMessage(`Item "${product.name}" added successfully!`);
//       setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
//       setIsPopupOpen(false); // Close popup
//       setDialogMessage(null);
//       setScannedProduct(null); // Clear scanned product
//     } catch (error) {
//       console.error("Error saving scanned item:", error);
//       setDialogMessage("Error saving item to the database.");
//     }
//   };

//   const handleLogout = () => {
//     window.location.href = 'https://itsantoun.github.io/elsheikh-oil-qr/'; // Redirect to login page
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
//         {isPopupOpen && (
//           <div className="popup-overlay">
//             <div className="popup">
//               <h3 className="popup-title">Product Found</h3>
//               <p className="popup-text">{dialogMessage}</p>
//               <button
//                 className="popup-button"
//                 onClick={() => saveScannedItem(scannedProduct)}
//               >
//                 Yes, Add
//               </button>
//               <button
//                 className="popup-button cancel"
//                 onClick={() => setIsPopupOpen(false)}
//               >
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

// import React, { useState, useEffect, useContext } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase';
// import { ref, get, child, push } from "firebase/database";
// import { UserContext } from '../Auth/userContext'; // Import UserContext
// import '../CSS/BarcodeScanner.css'; // Import the CSS file

// const BarcodeScanner = () => {
//   const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [dialogMessage, setDialogMessage] = useState(null);
//   const [successMessage, setSuccessMessage] = useState(null);
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [userName, setUserName] = useState(null); // State for storing user's name
//   const [customers, setCustomers] = useState([]); // State for storing customers
//   const [selectedCustomer, setSelectedCustomer] = useState(''); // State for selected customer
//   const [quantity, setQuantity] = useState(1); // State for quantity input
//   const scannerRef = React.useRef(null);

//   const { user } = useContext(UserContext); // Access the logged-in user's info

//   useEffect(() => {
//     const fetchUserName = async () => {
//       if (user?.uid) {
//         const userRef = ref(database, `users/${user.uid}`);
//         try {
//           const snapshot = await get(userRef);
//           if (snapshot.exists()) {
//             const userData = snapshot.val();
//             setUserName(userData.name); // Fetch and store the user's name
//           } else {
//             console.error("User not found in the database.");
//           }
//         } catch (error) {
//           console.error("Error fetching user's name:", error);
//         }
//       }
//     };

//     const fetchCustomers = async () => {
//       const customersRef = ref(database, 'customers');
//       try {
//         const snapshot = await get(customersRef);
//         if (snapshot.exists()) {
//           const customersData = snapshot.val();
//           setCustomers(Object.entries(customersData).map(([key, value]) => ({ id: key, name: value.name })));
//         }
//       } catch (error) {
//         console.error("Error fetching customers:", error);
//       }
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
//       .catch((err) => console.error('Camera initialization failed: refresh/try again later', err));

//     return () => {
//       codeReader.reset();
//     };
//   }, [user]);

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
//     const currentDate = new Date().toISOString(); // Get current timestamp

//     const newItem = {
//       barcode: scannedProduct.barcode,
//       name: scannedProduct.name,
//       category: scannedProduct.category || 'Unknown',
//       price: scannedProduct.price || 0,
//       dateScanned: currentDate,
//       scannedBy: userName || 'Unknown', // Save the logged-in user's name
//       customerId: selectedCustomer,
//       quantity: quantity,
//     };

//     try {
//       await push(soldItemsRef, newItem); // Push new item to SoldItems
//       setSuccessMessage(`Item "${scannedProduct.name}" added successfully!`);
//       setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
//       setIsPopupOpen(false); // Close popup
//       setDialogMessage(null);
//       setScannedProduct(null); // Clear scanned product
//       setSelectedCustomer(''); // Reset customer selection
//       setQuantity(0); // Reset quantity
//     } catch (error) {
//       console.error("Error saving scanned item:", error);
//       setDialogMessage("Error saving item to the database.");
//     }
//   };

//   const handleLogout = () => {
//     window.location.href = 'https://itsantoun.github.io/elsheikh-oil-qr/'; // Redirect to login page
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
//         {isPopupOpen && (
//           <div className="popup-overlay">
//             <div className="popup">
//               <h3 className="popup-title">Product Found</h3>
//               <p className="popup-text">{dialogMessage}</p>

//               {/* Dropdown for selecting customer */}
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

//               {/* Quantity input */}
//               <div className="quantity-input">
//                 <label htmlFor="quantity">Quantity:</label>
//                 <input
//   type="number"
//   id="quantity"
//   value={quantity}
//   onChange={(e) => setQuantity(e.target.value)} // Allow the user to type freely
//   onBlur={(e) => setQuantity(Math.max(1, e.target.value))} // Ensure the minimum value is enforced when the input loses focus
//   min="1"
// />
//               </div>

//               <button
//                 className="popup-button"
//                 onClick={saveScannedItem}
//               >
//                 Yes, Add
//               </button>
//               <button
//                 className="popup-button cancel"
//                 onClick={() => setIsPopupOpen(false)}
//               >
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
import { UserContext } from '../Auth/userContext'; // Import UserContext
import '../CSS/BarcodeScanner.css'; // Import the CSS file

const BarcodeScanner = () => {
  const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [userName, setUserName] = useState(null); // State for storing user's name
  const [customers, setCustomers] = useState([]); // State for storing customers
  const [selectedCustomer, setSelectedCustomer] = useState(''); // State for selected customer
  const [quantity, setQuantity] = useState(1); // State for quantity input
  const [loading, setLoading] = useState(false); // Loading state
  const scannerRef = React.useRef(null);

  const { user } = useContext(UserContext); // Access the logged-in user's info

  useEffect(() => {
    const fetchUserName = async () => {
      if (user?.uid) {
        const userRef = ref(database, `users/${user.uid}`);
        try {
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.val();
            setUserName(userData.name); // Fetch and store the user's name
          } else {
            console.error("User not found in the database.");
          }
        } catch (error) {
          console.error("Error fetching user's name:", error);
        }
      }
    };

    const fetchCustomers = async () => {
      setLoading(true);
      const customersRef = ref(database, 'customers');
      try {
        const snapshot = await get(customersRef);
        if (snapshot.exists()) {
          const customersData = snapshot.val();
          console.log("Fetched customers data:", customersData); // Log the fetched data
          setCustomers(Object.entries(customersData).map(([key, value]) => ({
            id: key,
            name: value.name || 'Unknown Customer' // Ensure a name field exists, or fallback to 'Unknown'
          })));
        } else {
          console.log("No customers data found.");
          setCustomers([]); // Ensure the customers state is set to an empty array if no data exists
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
      setLoading(false);
    };

    fetchUserName();
    fetchCustomers();

    const codeReader = new BrowserMultiFormatReader();
    const videoElement = scannerRef.current;

    codeReader
      .decodeFromVideoDevice(null, videoElement, (result, error) => {
        if (result) {
          console.log(`Scanned Code: ${result.text}`);
          setScanStatus('Barcode detected! Processing...');
          fetchProductDetails(result.text);
        } else if (error) {
          setScanStatus('Align the barcode and hold steady.');
        }
      })
      .catch((err) => console.error('Camera initialization failed: refresh/try again later', err));

    return () => {
      codeReader.reset();
    };
  }, [user]);

  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const snapshot = await get(child(dbRef, `products/${barcode}`));
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
      setDialogMessage("Error retrieving product information.");
      setIsPopupOpen(false);
    }
  };

  const saveScannedItem = async () => {
    if (!scannedProduct || !scannedProduct.barcode || !selectedCustomer || quantity <= 0) {
      setDialogMessage("Error: Missing information.");
      return;
    }

    const soldItemsRef = ref(database, 'SoldItems');
    const currentDate = new Date().toISOString(); // Get current timestamp

    const newItem = {
      barcode: scannedProduct.barcode,
      name: scannedProduct.name,
      category: scannedProduct.category || 'Unknown',
      price: scannedProduct.price || 0,
      dateScanned: currentDate,
      scannedBy: userName || 'Unknown', // Save the logged-in user's name
      customerId: selectedCustomer,
      quantity: quantity,
    };

    try {
      await push(soldItemsRef, newItem); // Push new item to SoldItems
      setSuccessMessage(`Item "${scannedProduct.name}" added successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000); // Clear success message
      setIsPopupOpen(false); // Close popup
      setDialogMessage(null);
      setScannedProduct(null); // Clear scanned product
      setSelectedCustomer(''); // Reset customer selection
      setQuantity(0); // Reset quantity
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to the database.");
    }
  };

  const handleLogout = () => {
    window.location.href = 'https://itsantoun.github.io/elsheikh-oil-qr/'; // Redirect to login page
  };

  return (
    <div className="container">
      <div className="header">
        <button className="logout-button" onClick={handleLogout}>Logout</button>
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

              {/* Dropdown for selecting customer */}
              <div className="customer-select">
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
              </div>

              {/* Quantity input */}
              <div className="quantity-input">
                <label htmlFor="quantity">Quantity:</label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)} // Allow the user to type freely
                  onBlur={(e) => setQuantity(Math.max(1, e.target.value))} // Ensure the minimum value is enforced when the input loses focus
                  min="1"
                />
              </div>

              <button
                className="popup-button"
                onClick={saveScannedItem}
              >
                Yes, Add
              </button>
              <button
                className="popup-button cancel"
                onClick={() => setIsPopupOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;