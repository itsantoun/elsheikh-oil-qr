// import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase';
// import { ref, get, update, child, push, onValue, off, query, orderByChild, startAt, equalTo } from "firebase/database";
// import { UserContext } from '../Auth/userContext';  
// import '../CSS/BarcodeScanner.css';
// import { signOut } from 'firebase/auth';
// import { auth } from '../Auth/firebase';
// import { getAuth, onAuthStateChanged } from "firebase/auth";

// const BarcodeScanner = () => {
//   const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [dialogMessage, setDialogMessage] = useState(null);
//   const [successMessage, setSuccessMessage] = useState(null);
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [name, setName] = useState(null);
//   const [customers, setCustomers] = useState([]);
//   const [selectedCustomer, setSelectedCustomer] = useState('');
//   const [quantity, setQuantity] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const [paymentStatus, setPaymentStatus] = useState('Unpaid');
//   const [remark, setRemark] = useState('');
//   const [scannedItems, setScannedItems] = useState([]);
//   const [editingItem, setEditingItem] = useState(null);
//   const [showScannedItems, setShowScannedItems] = useState(true);
//   const [isScanning, setIsScanning] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [customersLoaded, setCustomersLoaded] = useState(false);
//   const [cameraActive, setCameraActive] = useState(true); // NEW: Control camera state
//   const [scannerPaused, setScannerPaused] = useState(false); // NEW: Pause scanning

//   const scannerRef = React.useRef(null);
//   const codeReaderRef = React.useRef(null);
//   const scanTimeoutRef = React.useRef(null); // NEW: For scan throttling
//   const authInstance = getAuth();
//   const [user, setUser] = useState(null);

//   // Memoized custom date calculation
//   const customDate = useMemo(() => {
//     const now = new Date();
//     const customDate = new Date();
    
//     if (now.getHours() < 22) {
//       customDate.setDate(customDate.getDate() - 1);
//     }
    
//     customDate.setHours(22, 0, 0, 0);
//     return customDate;
//   }, []);

//   // Authentication effect
//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
//       if (currentUser) {
//         console.log("User authenticated:", currentUser.uid);
//         setUser(currentUser);
//       } else {
//         console.log("No user found");
//         setUser(null);
//       }
//     });

//     return () => unsubscribe();
//   }, []);

//   // Fetch user name effect
//   useEffect(() => {
//     const fetchUserName = async () => {
//       if (!user?.uid) return;

//       const userRef = ref(database, `users/${user.uid}`);
//       try {
//         const snapshot = await get(userRef);
//         if (snapshot.exists()) {
//           const userData = snapshot.val();
//           const fetchedName = userData?.name || 'Unknown';
//           setName(fetchedName);
//         } else {
//           console.error("User data not found in the database.");
//           setName('Unknown');
//         }
//       } catch (error) {
//         console.error("Error fetching user's name:", error);
//         setName('Unknown');
//       }
//     };

//     fetchUserName();
//   }, [user]);

//   // Fetch customers effect
//   useEffect(() => {
//     const fetchCustomers = async () => {
//       if (customersLoaded) return;
      
//       setLoading(true);
//       const customersRef = ref(database, 'customers');

//       try {
//         const snapshot = await get(customersRef);
//         if (snapshot.exists()) {
//           const customersData = snapshot.val();
//           setCustomers(
//             Object.entries(customersData).map(([key, value]) => ({
//               id: key,
//               name: value.nameArabic || value.name || 'عميل غير معروف',
//             }))
//           );
//         } else {
//           setCustomers([]);
//         }
//         setCustomersLoaded(true);
//       } catch (error) {
//         console.error("Error fetching customers:", error);
//       }

//       setLoading(false);
//     };

//     if (user?.uid) {
//       fetchCustomers();
//     }
//   }, [user, customersLoaded]);

//   // OPTIMIZED: Camera setup effect with better resource management
//   useEffect(() => {
//     if (!user?.uid || !name || !customersLoaded || !cameraActive) return;

//     const setupCamera = async () => {
//       try {
//         const codeReader = new BrowserMultiFormatReader();
//         codeReaderRef.current = codeReader;
//         const videoElement = scannerRef.current;

//         // OPTIMIZED: Reduced resolution and less aggressive settings
//         await codeReader.decodeFromVideoDevice(
//           null, 
//           videoElement, 
//           (result, error) => {
//             if (result && !isScanning && !scannerPaused) {
//               // OPTIMIZED: Throttle scanning to prevent rapid successive scans
//               if (scanTimeoutRef.current) return;
              
//               scanTimeoutRef.current = setTimeout(() => {
//                 scanTimeoutRef.current = null;
//               }, 2000); // 2 second cooldown between scans
              
//               setScanStatus('Barcode detected! Processing...');
//               fetchProductDetails(result.text);
//             } else if (error && !isScanning && !scannerPaused) {
//               // OPTIMIZED: Reduce status updates to minimize re-renders
//               if (scanStatus !== 'Align the barcode and hold steady.') {
//                 setScanStatus('Align the barcode and hold steady.');
//               }
//             }
//           }, 
//           {
//             tryHarder: false, // OPTIMIZED: Less CPU intensive
//             constraints: {
//               video: {
//                 facingMode: 'environment',
//                 width: { ideal: 640 }, // OPTIMIZED: Reduced resolution
//                 height: { ideal: 480 }, // OPTIMIZED: Reduced resolution
//                 frameRate: { ideal: 15 }, // OPTIMIZED: Lower frame rate
//               },
//             },
//           }
//         );

//         applyZoom();
//       } catch (err) {
//         console.error('Camera initialization failed:', err);
//         setScanStatus('Camera initialization failed. Please check permissions.');
//       }
//     };

//     setupCamera();

//     return () => {
//       // IMPROVED: Better cleanup
//       if (scanTimeoutRef.current) {
//         clearTimeout(scanTimeoutRef.current);
//         scanTimeoutRef.current = null;
//       }
//       if (codeReaderRef.current) {
//         codeReaderRef.current.reset();
//         codeReaderRef.current = null;
//       }
//     };
//   }, [user, name, customersLoaded, isScanning, cameraActive, scannerPaused]);

//   // OPTIMIZED: Debounced scanned items listener - only update when actually needed
//   useEffect(() => {
//     if (!user?.uid || !name || !showScannedItems) return;

//     const startTimestamp = customDate.getTime();
    
//     // OPTIMIZED: Only listen when items are visible and use debouncing
//     const soldItemsQuery = query(
//       ref(database, "SoldItems"),
//       orderByChild('dateScanned'),
//       startAt(new Date(startTimestamp).toISOString())
//     );

//     let debounceTimeout;
//     const listener = onValue(soldItemsQuery, (snapshot) => {
//       // OPTIMIZED: Debounce updates to reduce re-renders
//       clearTimeout(debounceTimeout);
//       debounceTimeout = setTimeout(() => {
//         if (snapshot.exists()) {
//           const items = Object.values(snapshot.val())
//             .filter(item => {
//               const itemDate = new Date(item.dateScanned);
//               return item.scannedBy === name && itemDate >= customDate;
//             })
//             .slice(-50) // OPTIMIZED: Reduced to 50 items for better performance
//             .reverse(); // Show newest first

//           setScannedItems(items);
//         } else {
//           setScannedItems([]);
//         }
//       }, 500); // 500ms debounce
//     });

//     return () => {
//       clearTimeout(debounceTimeout);
//       off(soldItemsQuery, "value", listener);
//     };
//   }, [user, name, customDate, showScannedItems]);

//   // Zoom application effect - OPTIMIZED: Only when actually needed
//   useEffect(() => {
//     if (scannerRef.current?.srcObject && cameraActive) {
//       applyZoom();
//     }
//   }, [zoomLevel, cameraActive]);

//   // NEW: Page Visibility API to pause camera when tab is not active
//   useEffect(() => {
//     const handleVisibilityChange = () => {
//       if (document.hidden) {
//         setCameraActive(false);
//         setScannerPaused(true);
//       } else {
//         setCameraActive(true);
//         setScannerPaused(false);
//       }
//     };

//     document.addEventListener('visibilitychange', handleVisibilityChange);
    
//     return () => {
//       document.removeEventListener('visibilitychange', handleVisibilityChange);
//     };
//   }, []);

//   const applyZoom = useCallback(async () => {
//     try {
//       const videoElement = scannerRef.current;
//       if (!videoElement?.srcObject) return;

//       const stream = videoElement.srcObject;
//       const [track] = stream.getVideoTracks();

//       const capabilities = track.getCapabilities();
//       if ('zoom' in capabilities) {
//         const constraints = {
//           advanced: [
//             { zoom: zoomLevel }, 
//             { focusMode: 'continuous' }
//           ],
//         };
//         await track.applyConstraints(constraints);
//       }
//     } catch (error) {
//       console.error('Failed to apply zoom or focus:', error);
//     }
//   }, [zoomLevel]);

//   const changeZoom = useCallback(async (level) => {
//     const videoElement = scannerRef.current;
//     if (!videoElement?.srcObject) return;

//     const stream = videoElement.srcObject;
//     const [track] = stream.getVideoTracks();
    
//     const capabilities = track.getCapabilities();
//     if ('zoom' in capabilities) {
//       const newZoomLevel = Math.min(
//         Math.max(level, capabilities.zoom.min), 
//         capabilities.zoom.max || 5 // OPTIMIZED: Reduced max zoom
//       ); 
//       setZoomLevel(newZoomLevel);
      
//       try {
//         await track.applyConstraints({
//           advanced: [{ zoom: newZoomLevel }],
//         });
//       } catch (error) {
//         console.error('Failed to apply zoom:', error);
//       }
//     }
//   }, []);

//   const fetchProductDetails = useCallback(async (barcode) => {
//     if (isScanning || isProcessing || scannerPaused) return;
    
//     setIsScanning(true);
//     setIsProcessing(true);
//     setScanStatus('Processing barcode...');

//     const dbRef = ref(database);
//     try {
//       const snapshot = await get(child(dbRef, `products/${barcode}`));
//       if (snapshot.exists()) {
//         const product = snapshot.val();
//         setScannedProduct({ barcode, ...product });
//         setDialogMessage(`${product.name}`);
//         setIsPopupOpen(true);
//         setScanStatus('Product found! Fill in the details.');
//         // OPTIMIZED: Pause scanner while popup is open
//         setScannerPaused(true);
//       } else {
//         setDialogMessage("Product not found.");
//         setScanStatus('Product not found. Try again.');
//         setTimeout(() => setScanStatus('Align the barcode within the frame.'), 2000);
//       }
//     } catch (error) {
//       console.error('Error fetching product:', error);
//       setDialogMessage("Error retrieving product information.");
//       setScanStatus('Error occurred. Try again.');
//       setTimeout(() => setScanStatus('Align the barcode within the frame.'), 2000);
//     } finally {
//       setIsProcessing(false);
//       // OPTIMIZED: Longer cooldown period
//       setTimeout(() => setIsScanning(false), 3000);
//     }
//   }, [isScanning, isProcessing, scannerPaused]);

//   // NEW: Toggle camera function for manual control
//   const toggleCamera = useCallback(() => {
//     setCameraActive(prev => !prev);
//     setScannerPaused(prev => !prev);
//   }, []);

//   const saveScannedItem = useCallback(async () => {
//     if (!scannedProduct?.barcode || !selectedCustomer || quantity <= 0) {
//       setDialogMessage("!يجب تعبئت كل الخانات");
//       return;
//     }

//     setIsProcessing(true);
//     const totalCost = paymentStatus === 'Stock' ? 0 : scannedProduct.itemCost * quantity;
//     const scannedBy = name || 'Unknown';
//     const customer = customers.find(c => c.id === selectedCustomer);

//     if (!customer) {
//       setDialogMessage("Error: Customer not found.");
//       setIsProcessing(false);
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
//       scannedBy: scannedBy,
//       customerName: customer.name,
//       quantity: quantity,
//       paymentStatus: paymentStatus,
//       itemCost: scannedProduct.itemCost,
//       totalCost: totalCost,
//       remark: remark,
//     };

//     try {
//       await push(soldItemsRef, newItem);
//       setSuccessMessage(`بنجاح "${scannedProduct.name}" تم اضافة`);
//       setTimeout(() => setSuccessMessage(null), 3000);
      
//       // Reset form
//       setIsPopupOpen(false);
//       setDialogMessage(null);
//       setScannedProduct(null);
//       setSelectedCustomer('');
//       setQuantity(1);
//       setPaymentStatus('Unpaid');
//       setRemark('');
//       setScanStatus('Item saved! Ready for next scan.');
//       // OPTIMIZED: Resume scanner after saving
//       setScannerPaused(false);
//       setTimeout(() => setScanStatus('Align the barcode within the frame.'), 2000);
//     } catch (error) {
//       console.error("Error saving scanned item:", error);
//       setDialogMessage("Error saving item to the database.");
//     } finally {
//       setIsProcessing(false);
//     }
//   }, [scannedProduct, selectedCustomer, quantity, name, customers, paymentStatus, remark]);

//   const handlePaymentStatusChange = useCallback((e) => {
//     setPaymentStatus(e.target.value);
//   }, []);

//   const handleLogout = useCallback(async () => {
//     try {
//       // OPTIMIZED: Clean up camera before logout
//       setCameraActive(false);
//       await signOut(authInstance);
//       setUser(null);
//     } catch (error) {
//       console.error('Error signing out:', error);
//     }
//   }, []);

//   const saveEditedItem = useCallback(async (item) => {
//     if (!item) return;

//     try {
//       const soldItemsRef = ref(database, `SoldItems`);
//       const snapshot = await get(soldItemsRef);

//       if (snapshot.exists()) {
//         const items = snapshot.val();
//         const itemKey = Object.keys(items).find(
//           (key) => items[key].barcode === item.barcode && items[key].dateScanned === item.dateScanned
//         );

//         if (itemKey) {
//           const updatedItemRef = ref(database, `SoldItems/${itemKey}`);
//           await update(updatedItemRef, {
//             quantity: item.quantity,
//             totalCost: item.totalCost,
//             paymentStatus: item.paymentStatus,
//             remark: item.remark,
//           });

//           setEditingItem(null);
//           setSuccessMessage("تم التعديل بنجاح");
//           setTimeout(() => setSuccessMessage(null), 3000);
//         }
//       }
//     } catch (error) {
//       console.error("Error updating item:", error);
//       setDialogMessage("Error updating item in the database.");
//     }
//   }, []);

//   const handleClosePopup = useCallback(() => {
//     setIsPopupOpen(false);
//     setDialogMessage(null);
//     setScannedProduct(null);
//     setSelectedCustomer('');
//     setQuantity(1);
//     setPaymentStatus('Unpaid');
//     setRemark('');
//     setScanStatus('Align the barcode within the frame.');
//     // OPTIMIZED: Resume scanner when popup closes
//     setScannerPaused(false);
//   }, []);

//   const toggleScannedItems = useCallback(() => {
//     setShowScannedItems(prev => !prev);
//   }, []);

//   if (!user) {
//     return <div className="loading-message">Please log in to continue...</div>;
//   }

//   return (
//     <div className="container">
//       <div className="header">
//         <button className="logout-button" onClick={handleLogout}>
//           تسجيل خروج
//         </button>
//         {/* NEW: Camera toggle button */}
//         <button className="camera-toggle-button" onClick={toggleCamera}>
//           {cameraActive ? 'Pause Camera' : 'Resume Camera'}
//         </button>
//       </div>
      
//       <div className="scanner-container">
//         {cameraActive ? (
//           <video ref={scannerRef} className="scanner"></video>
//         ) : (
//           <div className="camera-paused">
//             <p>Camera Paused - Click Resume to continue scanning</p>
//           </div>
//         )}
//         <p className="status">{scanStatus}</p>
        
//         {isProcessing && <div className="loading-message">Processing...</div>}
//         {successMessage && <div className="success-message">{successMessage}</div>}
//         {loading && <div className="loading-message">Loading customers...</div>}
        
//         {cameraActive && (
//           <div className="zoom-controls">
//             <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>
//               Zoom Out
//             </button>
//             <input 
//               type="range" 
//               min="0.5" 
//               max="5"
//               step="0.1"
//               value={zoomLevel}
//               onChange={(e) => changeZoom(parseFloat(e.target.value))}
//             />
//             <button onClick={() => changeZoom(Math.min(5, zoomLevel + 0.5))}>
//               Zoom In
//             </button>
//           </div>
//         )}
        
//         {isPopupOpen && (
//           <div className="popup-overlay">
//             <div className="popup">
//               <button 
//                 className="close-popup-btn" 
//                 onClick={handleClosePopup}
//                 aria-label="Close"
//                 disabled={isProcessing}
//               >
//                 ×
//               </button>
//               <h3 className="popup-text">{dialogMessage}</h3>
              
//               <div className="customer-select">
//                 <label htmlFor="customer">اختر اسم المشتري</label>
//                 <select
//                   id="customer"
//                   value={selectedCustomer}
//                   onChange={(e) => setSelectedCustomer(e.target.value)}
//                   disabled={isProcessing}
//                 >
//                   <option value="">-- اختر اسم المشتري --</option>
//                   {customers.map((customer) => (
//                     <option key={customer.id} value={customer.id}>
//                       {customer.name}
//                     </option>
//                   ))}
//                 </select>
//               </div>
              
//               <div className="quantity-input">
//                 <label htmlFor="quantity">الكمية:</label>
//                 <input
//                   type="number"
//                   id="quantity"
//                   value={quantity}
//                   onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
//                   min="1"
//                   disabled={isProcessing}
//                 />
//               </div>

//               {scannedProduct?.itemCost && quantity > 0 && paymentStatus !== 'Stock' && (
//                 <div className="total-cost">
//                   <p>{scannedProduct.itemCost * quantity} {scannedProduct.currency || '$  :المجموع'}</p>
//                 </div>
//               )}

//               <div className="radio-group">
//                 <input
//                   type="radio"
//                   id="paid"
//                   name="paymentStatus"
//                   value="Paid"
//                   className="radio-input"
//                   checked={paymentStatus === 'Paid'}
//                   onChange={handlePaymentStatusChange}
//                   disabled={isProcessing}
//                 />
//                 <label htmlFor="paid" className="radio-label">مدفوع</label>

//                 <input
//                   type="radio"
//                   id="unpaid"
//                   name="paymentStatus"
//                   value="Unpaid"
//                   className="radio-input"
//                   checked={paymentStatus === 'Unpaid'}
//                   onChange={handlePaymentStatusChange}
//                   disabled={isProcessing}
//                 />
//                 <label htmlFor="unpaid" className="radio-label">غير مدفوع</label>

//                 <input
//                   type="radio"
//                   id="stock"
//                   name="paymentStatus"
//                   value="Stock"
//                   className="radio-input"
//                   checked={paymentStatus === 'Stock'}
//                   onChange={handlePaymentStatusChange}
//                   disabled={isProcessing}
//                 />
//                 <label htmlFor="stock" className="radio-label">استلام</label>
//               </div>

//               <div className="remark-input">
//                 <textarea
//                   id="remark"
//                   value={remark}
//                   onChange={(e) => setRemark(e.target.value)}
//                   placeholder="Enter any remarks here"
//                   disabled={isProcessing}
//                 />
//                 <label htmlFor="remark"> :ملاحظة </label>
//               </div>

//               <div>
//                 <button 
//                   className="popup-btn-yes" 
//                   onClick={saveScannedItem}
//                   disabled={isProcessing}
//                 >
//                   {isProcessing ? 'Processing...' : 'نعم'}
//                 </button>
//                 <button 
//                   className="popup-btn-no" 
//                   onClick={handleClosePopup}
//                   disabled={isProcessing}
//                 >
//                   لا
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="scanned-items-container">
//         <div className="scanned-items-header">
//           <h2>Scanned Items ({new Date().toLocaleDateString()})</h2>
//           <button onClick={toggleScannedItems}>
//             {showScannedItems ? 'Hide' : 'Show'} Items
//           </button>
//         </div>
        
//         {showScannedItems && (
//           scannedItems.length > 0 ? (
//             <table className="scanned-items-table">
//               <thead>
//                 <tr>
//                   <th>الباركود</th>
//                   <th>اسم المنتج</th>
//                   <th>اسم الزبون</th>
//                   <th>الكمية</th>
//                   <th>المجموع Cost</th>
//                   <th>الدفع؟</th>
//                   <th>التاريخ</th>
//                   <th>ملاحظات</th>
//                   <th>إجراءات</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {scannedItems.map((item, index) => (
//                   <tr key={`${item.barcode}-${item.dateScanned}-${index}`}>
//                     <td>{item.barcode}</td>
//                     <td>{item.name}</td>
//                     <td>{item.customerName}</td>
//                     <td>{item.quantity}</td>  
//                     <td>{item.totalCost}</td>
//                     <td>{item.paymentStatus === "Paid" ? "مدفوع" : item.paymentStatus === "Stock" ? "استلام" : "غير مدفوع"}</td>
//                     <td>{new Date(item.dateScanned).toLocaleString("ar-EG")}</td>
//                     <td>{item.remark}</td>
//                     <td>
//                       <button onClick={() => setEditingItem(item)}>تعديل</button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           ) : (
//             <p>No items scanned today.</p>
//           )
//         )}

//         {editingItem && (
//           <div className="edit-popup">
//             <div className="edit-form-container">
//               <h3>تعديل المنتج</h3>
//               <p><strong>الباركود:</strong> {editingItem.barcode}</p>
//               <p><strong>اسم المنتج:</strong> {editingItem.name}</p>
//               <p><strong>التاريخ:</strong> {new Date(editingItem.dateScanned).toLocaleString()}</p>

//               <div>
//                 <label htmlFor="editQuantity">الكمية</label>
//                 <input
//                   type="number"
//                   id="editQuantity"
//                   value={editingItem.quantity}
//                   onChange={(e) =>
//                     setEditingItem({
//                       ...editingItem,
//                       quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
//                       totalCost: editingItem.itemCost * Math.max(1, parseInt(e.target.value, 10) || 1),
//                     })
//                   }
//                   min="1"
//                 />
//               </div>

//               <div>
//                 <label htmlFor="editPaymentStatus">الدفع؟</label>
//                 <select
//                   id="editPaymentStatus"
//                   value={editingItem.paymentStatus}
//                   onChange={(e) =>
//                     setEditingItem({
//                       ...editingItem,
//                       paymentStatus: e.target.value,
//                     })
//                   }
//                 >
//                   <option value="Paid">مدفوع</option>
//                   <option value="Unpaid">غير مدفوع</option>
//                   <option value="Stock">استلام</option>
//                 </select>
//               </div>

//               <div>
//                 <label htmlFor="editRemark">ملاحظات</label>
//                 <textarea
//                   id="editRemark"
//                   value={editingItem.remark}
//                   onChange={(e) =>
//                     setEditingItem({
//                       ...editingItem,
//                       remark: e.target.value,
//                     })
//                   }
//                 />
//               </div>

//               <div className="form-buttons">
//                 <button
//                   className="save-button"
//                   onClick={() => saveEditedItem(editingItem)}
//                 >
//                   تعديل
//                 </button>
//                 <button 
//                   className="cancel-button" 
//                   onClick={() => setEditingItem(null)}
//                 >
//                   الغاء
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default BarcodeScanner;

import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, update, child, push, onValue, off, query, orderByChild, startAt, equalTo } from "firebase/database";
import { UserContext } from '../Auth/userContext';  
import '../CSS/BarcodeScanner.css';
import { signOut } from 'firebase/auth';
import { auth } from '../Auth/firebase';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  IconRefresh, IconCheck, IconX, IconXCircle, IconPause, IconCamera, IconPackage,
  IconTag, IconBarChart, IconDollarSign, IconUser, IconHash, IconTrendingUp,
  IconCreditCard, IconFileText, IconSettings, IconEdit, IconSave, IconEye, IconEyeOff,
  IconLightbulb, IconClipboard, IconCalendar, IconInbox, IconLogOut, IconAlertTriangle,
} from '../utils/icons';

const BarcodeScanner = () => {
  const [scanStatus, setScanStatus] = useState('Align the barcode within the frame.');
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [name, setName] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState('Unpaid');
  const [remark, setRemark] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showScannedItems, setShowScannedItems] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [scannerPaused, setScannerPaused] = useState(false);

  const scannerRef = React.useRef(null);
  const codeReaderRef = React.useRef(null);
  const scanTimeoutRef = React.useRef(null);
  const lastScannedRef = React.useRef(null);
  const isScanningRef = React.useRef(false);
  const isProcessingRef = React.useRef(false);
  const scannerPausedRef = React.useRef(false);
  const authInstance = getAuth();
  const [user, setUser] = useState(null);

  // Memoized custom date calculation
  const customDate = useMemo(() => {
    const now = new Date();
    const customDate = new Date();
    
    if (now.getHours() < 22) {
      customDate.setDate(customDate.getDate() - 1);
    }
    
    customDate.setHours(22, 0, 0, 0);
    return customDate;
  }, []);

  // Authentication effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
      if (currentUser) {
        console.log("User authenticated:", currentUser.uid);
        setUser(currentUser);
      } else {
        console.log("No user found");
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch user name effect
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.uid) return;

      const userRef = ref(database, `users/${user.uid}`);
      try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const userData = snapshot.val();
          const fetchedName = userData?.name || 'Unknown';
          setName(fetchedName);
        } else {
          console.error("User data not found in the database.");
          setName('Unknown');
        }
      } catch (error) {
        console.error("Error fetching user's name:", error);
        setName('Unknown');
      }
    };

    fetchUserName();
  }, [user]);

  // Fetch customers effect
  useEffect(() => {
    const fetchCustomers = async () => {
      if (customersLoaded) return;
      
      setLoading(true);
      const customersRef = ref(database, 'customers');

      try {
        const snapshot = await get(customersRef);
        if (snapshot.exists()) {
          const customersData = snapshot.val();
          setCustomers(
            Object.entries(customersData).map(([key, value]) => ({
              id: key,
              name: value.nameArabic || value.name || 'عميل غير معروف',
            }))
          );
        } else {
          setCustomers([]);
        }
        setCustomersLoaded(true);
      } catch (error) {
        console.error("Error fetching customers:", error);
      }

      setLoading(false);
    };

    if (user?.uid) {
      fetchCustomers();
    }
  }, [user, customersLoaded]);

  // Camera setup effect
  useEffect(() => {
    if (!user?.uid || !name || !customersLoaded || !cameraActive) return;

    const setupCamera = async () => {
      try {
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;
        const videoElement = scannerRef.current;

        await codeReader.decodeFromVideoDevice(
          null, 
          videoElement, 
          (result, error) => {
            if (result) {
              const barcode = String(result.text || '').trim();
              if (!barcode) return;
              if (isScanningRef.current || isProcessingRef.current || scannerPausedRef.current) return;

              const now = Date.now();
              if (lastScannedRef.current === barcode && now - (lastScannedRef.lastTime || 0) < 1200) {
                return;
              }
              
              lastScannedRef.current = barcode;
              lastScannedRef.lastTime = now;
              isScanningRef.current = true;
              isProcessingRef.current = true;
              setIsScanning(true);
              setIsProcessing(true);
              setScanStatus('Barcode detected! Processing...');
              fetchProductDetails(barcode);
            }
          }, 
          {
            tryHarder: false,
            constraints: {
              video: {
                facingMode: 'environment',
                width: { ideal: 960 },
                height: { ideal: 720 },
                frameRate: { ideal: 24 },
              },
            },
          }
        );

        applyZoom();
      } catch (err) {
        console.error('Camera initialization failed:', err);
        setScanStatus('Camera initialization failed. Please check permissions.');
      }
    };

    setupCamera();

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    };
  }, [user, name, customersLoaded, cameraActive]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    scannerPausedRef.current = scannerPaused;
  }, [scannerPaused]);

  // Scanned items listener
  useEffect(() => {
    if (!user?.uid || !name || !showScannedItems) return;

    const startTimestamp = customDate.getTime();
    
    const soldItemsQuery = query(
      ref(database, "SoldItems"),
      orderByChild('dateScanned'),
      startAt(new Date(startTimestamp).toISOString())
    );

    let debounceTimeout;
    const listener = onValue(soldItemsQuery, (snapshot) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        if (snapshot.exists()) {
          const items = Object.values(snapshot.val())
            .filter(item => {
              const itemDate = new Date(item.dateScanned);
              return item.scannedBy === name && itemDate >= customDate;
            })
            .slice(-50)
            .reverse();

          setScannedItems(items);
        } else {
          setScannedItems([]);
        }
      }, 500);
    });

    return () => {
      clearTimeout(debounceTimeout);
      off(soldItemsQuery, "value", listener);
    };
  }, [user, name, customDate, showScannedItems]);

  // Zoom application effect
  useEffect(() => {
    if (scannerRef.current?.srcObject && cameraActive) {
      applyZoom();
    }
  }, [zoomLevel, cameraActive]);

  // Page Visibility API
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setCameraActive(false);
        setScannerPaused(true);
      } else {
        setCameraActive(true);
        setScannerPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const applyZoom = useCallback(async () => {
    try {
      const videoElement = scannerRef.current;
      if (!videoElement?.srcObject) return;

      const stream = videoElement.srcObject;
      const [track] = stream.getVideoTracks();

      const capabilities = track.getCapabilities();
      if ('zoom' in capabilities) {
        const constraints = {
          advanced: [
            { zoom: zoomLevel }, 
            { focusMode: 'continuous' }
          ],
        };
        await track.applyConstraints(constraints);
      }
    } catch (error) {
      console.error('Failed to apply zoom or focus:', error);
    }
  }, [zoomLevel]);

  const changeZoom = useCallback(async (level) => {
    const videoElement = scannerRef.current;
    if (!videoElement?.srcObject) return;

    const stream = videoElement.srcObject;
    const [track] = stream.getVideoTracks();
    
    const capabilities = track.getCapabilities();
    if ('zoom' in capabilities) {
      const newZoomLevel = Math.min(
        Math.max(level, capabilities.zoom.min), 
        capabilities.zoom.max || 5
      ); 
      setZoomLevel(newZoomLevel);
      
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoomLevel }],
        });
      } catch (error) {
        console.error('Failed to apply zoom:', error);
      }
    }
  }, []);

  const fetchProductDetails = useCallback(async (barcode) => {
    setIsScanning(true);
    setIsProcessing(true);
    setScanStatus('Processing barcode...');

    const dbRef = ref(database);
    try {
      const snapshot = await get(child(dbRef, `products/${barcode}`));
      if (snapshot.exists()) {
        const product = snapshot.val();
        setScannedProduct({ barcode, ...product });
        setDialogMessage(`${product.name}`);
        setIsPopupOpen(true);
        setScanStatus('Product found! Fill in the details.');
        setScannerPaused(true);
        setIsScanning(false);
        setIsProcessing(false);
      } else {
        setDialogMessage("Product not found.");
        setScanStatus('Product not found. Try again.');
        setTimeout(() => setScanStatus('Align the barcode within the frame.'), 800);
        setIsScanning(false);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setDialogMessage("Error retrieving product information.");
      setScanStatus('Error occurred. Try again.');
      setTimeout(() => setScanStatus('Align the barcode within the frame.'), 800);
      setIsScanning(false);
      setIsProcessing(false);
    }
  }, []);

  // Fix for quantity input issue
  const handleQuantityChange = useCallback((e) => {
    const value = e.target.value;
    // Allow empty string, 0, or positive numbers
    if (value === '' || value === '0') {
      setQuantity(0);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        setQuantity(numValue);
      }
    }
  }, []);

  const calculateSaleProfit = useCallback((item, overrides = {}) => {
    const merged = { ...item, ...overrides };
    const parsedQuantity = parseFloat(merged.quantity);
    const quantityValue = Number.isFinite(parsedQuantity) ? parsedQuantity : 0;
    const isStockStatus = String(merged.paymentStatus || '').toLowerCase().startsWith('stock');

    const parsedSellPrice = parseFloat(merged.itemCost);
    const hasSellPrice = Number.isFinite(parsedSellPrice);
    const parsedBuyPrice = parseFloat(merged.purchasingPrice);
    const hasBuyPrice = Number.isFinite(parsedBuyPrice);
    const parsedTotalCost = parseFloat(merged.totalCost);
    const hasTotalCost = Number.isFinite(parsedTotalCost);

    const unitSellPrice = hasSellPrice ? parsedSellPrice : 0;
    const unitBuyPrice = hasBuyPrice ? parsedBuyPrice : 0;
    const revenue = isStockStatus
      ? 0
      : (hasTotalCost ? parsedTotalCost : unitSellPrice * quantityValue);
    const purchaseCost = isStockStatus ? 0 : unitBuyPrice * quantityValue;
    const profit = revenue - purchaseCost;

    return {
      quantity: quantityValue,
      isStockStatus,
      unitSellPrice,
      unitBuyPrice,
      revenue,
      purchaseCost,
      profit,
    };
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraActive(prev => !prev);
    setScannerPaused(prev => !prev);
  }, []);

  const saveScannedItem = useCallback(async () => {
    const isStock = String(paymentStatus || '').toLowerCase().startsWith('stock');
    if (!scannedProduct?.barcode || (!isStock && !selectedCustomer) || quantity <= 0) {
      setDialogMessage("!يجب تعبئت كل الخانات");
      return;
    }

    setIsProcessing(true);
    const saleUnitPrice = parseFloat(scannedProduct.itemCost) || 0;
    const purchaseUnitPrice = parseFloat(scannedProduct.purchasingPrice) || 0;
    const totalCost = isStock ? 0 : saleUnitPrice * quantity;
    const profitMetrics = calculateSaleProfit({
      quantity,
      paymentStatus,
      itemCost: saleUnitPrice,
      purchasingPrice: purchaseUnitPrice,
      totalCost,
    });
    const scannedBy = name || 'Unknown';
    const currentDate = new Date().toISOString();

    try {
      if (isStock) {
        const transaction = {
          barcode: scannedProduct.barcode,
          productId: scannedProduct.barcode,
          name: scannedProduct.name,
          quantity: quantity,
          dateScanned: currentDate,
          paymentStatus: 'Pending',
          itemCost: saleUnitPrice,
          purchasingPrice: purchaseUnitPrice,
          totalCost: purchaseUnitPrice * quantity,
          scannedBy: scannedBy,
          remark: remark,
        };
        await push(ref(database, 'transactions'), transaction);
      } else {
        const customer = customers.find(c => c.id === selectedCustomer);
        if (!customer) {
          setDialogMessage("Error: Customer not found.");
          setIsProcessing(false);
          return;
        }
        const newItem = {
          barcode: scannedProduct.barcode,
          name: scannedProduct.name,
          category: scannedProduct.category || 'Unknown',
          price: scannedProduct.price || 0,
          dateScanned: currentDate,
          scannedBy: scannedBy,
          customerName: customer.name,
          quantity: quantity,
          paymentStatus: paymentStatus,
          itemCost: saleUnitPrice,
          purchasingPrice: purchaseUnitPrice,
          totalCost: totalCost,
          unitProfit: profitMetrics.unitSellPrice - profitMetrics.unitBuyPrice,
          totalProfit: profitMetrics.profit,
          remark: remark,
        };
        await push(ref(database, 'SoldItems'), newItem);
      }

      setSuccessMessage(`بنجاح "${scannedProduct.name}" تم اضافة`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      setIsPopupOpen(false);
      setDialogMessage(null);
      setScannedProduct(null);
      setSelectedCustomer('');
      setQuantity(1);
      setPaymentStatus('Unpaid');
      setRemark('');
      setScanStatus('Item saved! Ready for next scan.');
      setScannerPaused(false);
      setIsScanning(false);
      setIsProcessing(false);
      setTimeout(() => setScanStatus('Align the barcode within the frame.'), 500);
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to the database.");
      setIsProcessing(false);
      setIsScanning(false);
    }
  }, [scannedProduct, selectedCustomer, quantity, name, customers, paymentStatus, remark, calculateSaleProfit]);

  const handlePaymentStatusChange = useCallback((e) => {
    setPaymentStatus(e.target.value);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      setCameraActive(false);
      await signOut(authInstance);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const saveEditedItem = useCallback(async (item) => {
    if (!item) return;

    try {
      const soldItemsRef = ref(database, `SoldItems`);
      const snapshot = await get(soldItemsRef);

      if (snapshot.exists()) {
        const items = snapshot.val();
        const itemKey = Object.keys(items).find(
          (key) => items[key].barcode === item.barcode && items[key].dateScanned === item.dateScanned
        );

        if (itemKey) {
          const profitMetrics = calculateSaleProfit(item);
          const updatedItemRef = ref(database, `SoldItems/${itemKey}`);
          await update(updatedItemRef, {
            quantity: profitMetrics.quantity,
            totalCost: profitMetrics.revenue,
            paymentStatus: item.paymentStatus,
            remark: item.remark,
            purchasingPrice: profitMetrics.unitBuyPrice,
            unitProfit: profitMetrics.unitSellPrice - profitMetrics.unitBuyPrice,
            totalProfit: profitMetrics.profit,
          });

          setEditingItem(null);
          setSuccessMessage("تم التعديل بنجاح");
          setTimeout(() => setSuccessMessage(null), 3000);
        }
      }
    } catch (error) {
      console.error("Error updating item:", error);
      setDialogMessage("Error updating item in the database.");
    }
  }, [calculateSaleProfit]);

  const handleClosePopup = useCallback(() => {
    setIsPopupOpen(false);
    setDialogMessage(null);
    setScannedProduct(null);
    setSelectedCustomer('');
    setQuantity(1);
    setPaymentStatus('Unpaid');
    setRemark('');
    setScanStatus('Align the barcode within the frame.');
    setScannerPaused(false);
    setIsScanning(false);
    setIsProcessing(false);
  }, []);

  const toggleScannedItems = useCallback(() => {
    setShowScannedItems(prev => !prev);
  }, []);

  const popupProfitMetrics = scannedProduct
    ? calculateSaleProfit({
      quantity,
      paymentStatus,
      itemCost: scannedProduct.itemCost,
      purchasingPrice: scannedProduct.purchasingPrice,
      totalCost: paymentStatus === 'Stock' ? 0 : (parseFloat(scannedProduct.itemCost) || 0) * quantity,
    })
    : null;

  if (!user) {
    return <div className="loading-message">Please log in to continue...</div>;
  }

  return (
    <div className="admin-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Barcode Scanner</h1>
        <p className="page-subtitle">Scan products and manage sales</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="success-message">
          <span className="message-icon"><IconCheck /></span>
          <span className="message-text">{successMessage}</span>
        </div>
      )}

      {/* Control Header */}
      <div className="control-header">
        <div className="control-header-left">
          <div className="user-info">
            <div className="user-avatar">
              {name ? name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-details">
              <div className="user-name">{name || 'User'}</div>
              <div className="user-role">Scanner Operator</div>
            </div>
          </div>
        </div>
        
        <div className="control-header-right">
          <button 
            onClick={toggleCamera} 
            className={`btn-secondary ${!cameraActive ? 'camera-paused' : ''}`}
          >
            <span className="button-icon">
              {cameraActive ? <IconCamera /> : <IconPause />}
            </span>
            {cameraActive ? 'Pause Camera' : 'Resume Camera'}
          </button>
          
          <button className="btn-danger" onClick={handleLogout}>
            <span className="button-icon"><IconLogOut /></span>
            تسجيل خروج
          </button>
        </div>
      </div>

      {/* Scanner Section */}
      <div className="scanner-section">
        <div className="scanner-card">
          <div className="scanner-header">
            <h2 className="scanner-title">
              <span className="scanner-icon"><IconCamera /></span>
              Live Scanner
            </h2>
            <div className="scanner-status">
              <span className={`status-indicator ${isProcessing ? 'processing' : 'ready'}`}>
                {isProcessing ? <IconRefresh /> : <IconCheck />}
              </span>
              <span className="status-text">
                {isProcessing ? 'Processing...' : 'Ready to Scan'}
              </span>
            </div>
          </div>

          <div className="scanner-viewport">
            {cameraActive ? (
              <video ref={scannerRef} className="scanner-video"></video>
            ) : (
              <div className="camera-paused-state">
                <div className="paused-icon"><IconPause /></div>
                <p className="paused-text">Camera Paused</p>
                <p className="paused-subtext">Click "Resume Camera" to continue scanning</p>
              </div>
            )}
            
            {cameraActive && (
              <div className="scan-frame">
                <div className="scan-frame-corner top-left"></div>
                <div className="scan-frame-corner top-right"></div>
                <div className="scan-frame-corner bottom-left"></div>
                <div className="scan-frame-corner bottom-right"></div>
              </div>
            )}
          </div>

          <div className="scanner-info">
            <div className="scanner-message">
              <span className="message-icon"><IconLightbulb /></span>
              <p className="message-text">{scanStatus}</p>
            </div>
            
            {cameraActive && (
              <div className="zoom-controls">
                <div className="zoom-header">
                  <span className="zoom-icon"><IconSettings /></span>
                  <span className="zoom-label">Zoom Control</span>
                </div>
                <div className="zoom-slider-container">
                  <button 
                    onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}
                    className="zoom-button"
                    disabled={zoomLevel <= 0.5}
                  >
                    −
                  </button>
                  <div className="zoom-slider">
                    <input 
                      type="range" 
                      min="0.5" 
                      max="5"
                      step="0.1"
                      value={zoomLevel}
                      onChange={(e) => changeZoom(parseFloat(e.target.value))}
                      className="zoom-slider-input"
                    />
                    <div className="zoom-value">
                      {zoomLevel.toFixed(1)}x
                    </div>
                  </div>
                  <button 
                    onClick={() => changeZoom(Math.min(5, zoomLevel + 0.5))}
                    className="zoom-button"
                    disabled={zoomLevel >= 5}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Popup */}
      {isPopupOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                <span className="modal-icon"><IconPackage /></span>
                Product Scanned
              </h3>
              <button 
                className="modal-close"
                onClick={handleClosePopup}
                disabled={isProcessing}
              >
                <IconX />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="product-info">
                <div className="product-name">
                  <span className="info-icon"><IconTag /></span>
                  <div className="info-content">
                    <div className="info-label">Product Name</div>
                    <div className="info-value">{dialogMessage}</div>
                  </div>
                </div>
                
                {scannedProduct?.barcode && (
                  <div className="product-barcode">
                    <span className="info-icon"><IconBarChart /></span>
                    <div className="info-content">
                      <div className="info-label">Barcode</div>
                      <div className="info-value code">{scannedProduct.barcode}</div>
                    </div>
                  </div>
                )}

                {scannedProduct?.itemCost && (
                  <div className="product-price">
                    <span className="info-icon"><IconDollarSign /></span>
                    <div className="info-content">
                      <div className="info-label">Unit Price</div>
                      <div className="info-value">${scannedProduct.itemCost.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-section">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon"><IconUser /></span>
                      Select Customer
                      <span className="required-star">*</span>
                    </label>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => setSelectedCustomer(e.target.value)}
                      className="form-select"
                      disabled={isProcessing}
                    >
                      <option value="">-- اختر اسم المشتري --</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon"><IconHash /></span>
                      Quantity
                      <span className="required-star">*</span>
                    </label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={handleQuantityChange}
                      className="form-input"
                      min="1"
                      disabled={isProcessing}
                    />
                  </div>

                  {scannedProduct?.itemCost && quantity > 0 && paymentStatus !== 'Stock' && (
                    <div className="form-group">
                      <label className="form-label">
                        <span className="label-icon"><IconHash /></span>
                        Total Cost
                      </label>
                      <div className="total-cost-display">
                        ${(scannedProduct.itemCost * quantity).toFixed(2)}
                      </div>
                    </div>
                  )}

                  {popupProfitMetrics && quantity > 0 && (
                    <div className="form-group">
                      <label className="form-label">
                        <span className="label-icon"><IconTrendingUp /></span>
                        Estimated Profit
                      </label>
                      <div
                        className="total-cost-display"
                        style={{ color: popupProfitMetrics.profit >= 0 ? '#198754' : '#dc3545' }}
                      >
                        ${popupProfitMetrics.profit.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="payment-section">
                  <div className="form-label">
                    <span className="label-icon"><IconCreditCard /></span>
                    Payment Status
                    <span className="required-star">*</span>
                  </div>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="Paid"
                        checked={paymentStatus === 'Paid'}
                        onChange={handlePaymentStatusChange}
                        className="radio-input"
                        disabled={isProcessing}
                      />
                      <span className="radio-custom"></span>
                      <span className="radio-label">
                        <span className="radio-icon"><IconCheck /></span>
                        Paid
                      </span>
                    </label>

                    <label className="radio-option">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="Unpaid"
                        checked={paymentStatus === 'Unpaid'}
                        onChange={handlePaymentStatusChange}
                        className="radio-input"
                        disabled={isProcessing}
                      />
                      <span className="radio-custom"></span>
                      <span className="radio-label">
                        <span className="radio-icon"><IconXCircle /></span>
                        Unpaid
                      </span>
                    </label>

                    <label className="radio-option">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="Stock"
                        checked={paymentStatus === 'Stock'}
                        onChange={handlePaymentStatusChange}
                        className="radio-input"
                        disabled={isProcessing}
                      />
                      <span className="radio-custom"></span>
                      <span className="radio-label">
                        <span className="radio-icon"><IconPackage /></span>
                        Stock
                      </span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><IconFileText /></span>
                    Remarks
                  </label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Enter any remarks here..."
                    className="form-textarea"
                    disabled={isProcessing}
                    rows="3"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-primary"
                onClick={saveScannedItem}
                disabled={isProcessing || (!String(paymentStatus).toLowerCase().startsWith('stock') && !selectedCustomer) || quantity <= 0}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner"></span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="button-icon"><IconSave /></span>
                    Save Item
                  </>
                )}
              </button>
              <button 
                className="btn-secondary"
                onClick={handleClosePopup}
                disabled={isProcessing}
              >
                <span className="button-icon"><IconX /></span>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanned Items Section */}
      <div className="table-section">
        <div className="table-card">
          <div className="table-header">
            <div className="table-header-left">
              <h2 className="table-title">
                <span className="table-icon"><IconClipboard /></span>
                Today's Scanned Items
              </h2>
              <div className="table-stats">
                <span className="stats-badge">{scannedItems.length} Items</span>
                <span className="stats-date">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
            <div className="table-header-right">
              <button 
                onClick={toggleScannedItems}
                className={`btn-secondary ${!showScannedItems ? 'collapsed' : ''}`}
              >
                <span className="button-icon">
                  {showScannedItems ? <IconEye /> : <IconEyeOff />}
                </span>
                {showScannedItems ? 'Hide Items' : 'Show Items'}
              </button>
            </div>
          </div>

          {showScannedItems && (
            <div className="table-container">
              {scannedItems.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconBarChart /></span>
                          Barcode
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconTag /></span>
                          Product
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconUser /></span>
                          Customer
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconHash /></span>
                          Qty
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconDollarSign /></span>
                          Total
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconTrendingUp /></span>
                          Profit
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconCreditCard /></span>
                          Status
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconCalendar /></span>
                          Time
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconFileText /></span>
                          Remarks
                        </div>
                      </th>
                      <th>
                        <div className="table-header-cell">
                          <span className="header-icon"><IconSettings /></span>
                          Actions
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scannedItems.map((item, index) => {
                      const metrics = calculateSaleProfit(item);
                      return (
                      <tr key={`${item.barcode}-${item.dateScanned}-${index}`}>
                        <td>
                          <div className="barcode-cell code">{item.barcode}</div>
                        </td>
                        <td>
                          <div className="product-cell">{item.name}</div>
                        </td>
                        <td>
                          <div className="customer-cell">{item.customerName}</div>
                        </td>
                        <td>
                          <div className="quantity-cell">{item.quantity}</div>
                        </td>
                        <td>
                          <div className="cost-cell">${item.totalCost}</div>
                        </td>
                        <td>
                          <div
                            className="cost-cell"
                            style={{ color: metrics.profit >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}
                          >
                            ${metrics.profit.toFixed(2)}
                          </div>
                        </td>
                        <td>
                          <div className={`status-cell status-${item.paymentStatus?.toLowerCase()}`}>
                            {item.paymentStatus === "Paid" ? "Paid" : 
                             item.paymentStatus === "Stock" ? "Stock" : "Unpaid"}
                          </div>
                        </td>
                        <td>
                          <div className="date-cell">
                            {new Date(item.dateScanned).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        </td>
                        <td>
                          <div className="remarks-cell">
                            {item.remark || '—'}
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="btn-small btn-primary"
                            title="Edit item"
                          >
                            <span className="button-icon"><IconEdit /></span>
                            Edit
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              ) : (
                <div className="empty-table">
                  <div className="empty-icon"><IconInbox /></div>
                  <p className="empty-text">No items scanned today</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                <span className="modal-icon"><IconEdit /></span>
                Edit Item
              </h3>
              <button 
                className="modal-close"
                onClick={() => setEditingItem(null)}
              >
                <IconX />
              </button>
            </div>

            <div className="modal-content">
              <div className="edit-info">
                <div className="info-item">
                  <span className="info-label">Product:</span>
                  <span className="info-value">{editingItem.name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Barcode:</span>
                  <span className="info-value code">{editingItem.barcode}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Time:</span>
                  <span className="info-value">
                    {new Date(editingItem.dateScanned).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="form-section">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon"><IconHash /></span>
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={editingItem.quantity}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                          totalCost: editingItem.itemCost * Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="form-input"
                      min="1"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon"><IconCreditCard /></span>
                      Payment Status
                    </label>
                    <select
                      value={editingItem.paymentStatus}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          paymentStatus: e.target.value,
                        })
                      }
                      className="form-select"
                    >
                      <option value="Paid">مدفوع</option>
                      <option value="Unpaid">غير مدفوع</option>
                      <option value="Stock">استلام</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><IconFileText /></span>
                    ملاحظة 
                  </label>
                  <textarea
                    value={editingItem.remark}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        remark: e.target.value,
                      })
                    }
                    className="form-textarea"
                    rows="3"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-success"
                onClick={() => saveEditedItem(editingItem)}
              >
                <span className="button-icon"><IconSave /></span>
              حفظ تعديل 
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setEditingItem(null)}
              >
                <span className="button-icon"><IconX /></span>
                الغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
