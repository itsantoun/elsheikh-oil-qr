import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, update, child, push, onValue, off, query, orderByChild, startAt, equalTo } from "firebase/database";
import { UserContext } from '../Auth/userContext';  
import '../CSS/BarcodeScanner.css';
import { signOut } from 'firebase/auth';
import { auth } from '../Auth/firebase';
import { getAuth, onAuthStateChanged } from "firebase/auth";

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
  const [cameraActive, setCameraActive] = useState(true); // NEW: Control camera state
  const [scannerPaused, setScannerPaused] = useState(false); // NEW: Pause scanning

  const scannerRef = React.useRef(null);
  const codeReaderRef = React.useRef(null);
  const scanTimeoutRef = React.useRef(null); // NEW: For scan throttling
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

  // OPTIMIZED: Camera setup effect with better resource management
  useEffect(() => {
    if (!user?.uid || !name || !customersLoaded || !cameraActive) return;

    const setupCamera = async () => {
      try {
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;
        const videoElement = scannerRef.current;

        // OPTIMIZED: Reduced resolution and less aggressive settings
        await codeReader.decodeFromVideoDevice(
          null, 
          videoElement, 
          (result, error) => {
            if (result && !isScanning && !scannerPaused) {
              // OPTIMIZED: Throttle scanning to prevent rapid successive scans
              if (scanTimeoutRef.current) return;
              
              scanTimeoutRef.current = setTimeout(() => {
                scanTimeoutRef.current = null;
              }, 2000); // 2 second cooldown between scans
              
              setScanStatus('Barcode detected! Processing...');
              fetchProductDetails(result.text);
            } else if (error && !isScanning && !scannerPaused) {
              // OPTIMIZED: Reduce status updates to minimize re-renders
              if (scanStatus !== 'Align the barcode and hold steady.') {
                setScanStatus('Align the barcode and hold steady.');
              }
            }
          }, 
          {
            tryHarder: false, // OPTIMIZED: Less CPU intensive
            constraints: {
              video: {
                facingMode: 'environment',
                width: { ideal: 640 }, // OPTIMIZED: Reduced resolution
                height: { ideal: 480 }, // OPTIMIZED: Reduced resolution
                frameRate: { ideal: 15 }, // OPTIMIZED: Lower frame rate
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
      // IMPROVED: Better cleanup
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    };
  }, [user, name, customersLoaded, isScanning, cameraActive, scannerPaused]);

  // OPTIMIZED: Debounced scanned items listener - only update when actually needed
  useEffect(() => {
    if (!user?.uid || !name || !showScannedItems) return;

    const startTimestamp = customDate.getTime();
    
    // OPTIMIZED: Only listen when items are visible and use debouncing
    const soldItemsQuery = query(
      ref(database, "SoldItems"),
      orderByChild('dateScanned'),
      startAt(new Date(startTimestamp).toISOString())
    );

    let debounceTimeout;
    const listener = onValue(soldItemsQuery, (snapshot) => {
      // OPTIMIZED: Debounce updates to reduce re-renders
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        if (snapshot.exists()) {
          const items = Object.values(snapshot.val())
            .filter(item => {
              const itemDate = new Date(item.dateScanned);
              return item.scannedBy === name && itemDate >= customDate;
            })
            .slice(-50) // OPTIMIZED: Reduced to 50 items for better performance
            .reverse(); // Show newest first

          setScannedItems(items);
        } else {
          setScannedItems([]);
        }
      }, 500); // 500ms debounce
    });

    return () => {
      clearTimeout(debounceTimeout);
      off(soldItemsQuery, "value", listener);
    };
  }, [user, name, customDate, showScannedItems]);

  // Zoom application effect - OPTIMIZED: Only when actually needed
  useEffect(() => {
    if (scannerRef.current?.srcObject && cameraActive) {
      applyZoom();
    }
  }, [zoomLevel, cameraActive]);

  // NEW: Page Visibility API to pause camera when tab is not active
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
        capabilities.zoom.max || 5 // OPTIMIZED: Reduced max zoom
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
    if (isScanning || isProcessing || scannerPaused) return;
    
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
        // OPTIMIZED: Pause scanner while popup is open
        setScannerPaused(true);
      } else {
        setDialogMessage("Product not found.");
        setScanStatus('Product not found. Try again.');
        setTimeout(() => setScanStatus('Align the barcode within the frame.'), 2000);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setDialogMessage("Error retrieving product information.");
      setScanStatus('Error occurred. Try again.');
      setTimeout(() => setScanStatus('Align the barcode within the frame.'), 2000);
    } finally {
      setIsProcessing(false);
      // OPTIMIZED: Longer cooldown period
      setTimeout(() => setIsScanning(false), 3000);
    }
  }, [isScanning, isProcessing, scannerPaused]);

  // NEW: Toggle camera function for manual control
  const toggleCamera = useCallback(() => {
    setCameraActive(prev => !prev);
    setScannerPaused(prev => !prev);
  }, []);

  const saveScannedItem = useCallback(async () => {
    if (!scannedProduct?.barcode || !selectedCustomer || quantity <= 0) {
      setDialogMessage("!يجب تعبئت كل الخانات");
      return;
    }

    setIsProcessing(true);
    const totalCost = paymentStatus === 'Stock' ? 0 : scannedProduct.itemCost * quantity;
    const scannedBy = name || 'Unknown';
    const customer = customers.find(c => c.id === selectedCustomer);

    if (!customer) {
      setDialogMessage("Error: Customer not found.");
      setIsProcessing(false);
      return;
    }

    const soldItemsRef = ref(database, 'SoldItems');
    const currentDate = new Date().toISOString();

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
      itemCost: scannedProduct.itemCost,
      totalCost: totalCost,
      remark: remark,
    };

    try {
      await push(soldItemsRef, newItem);
      setSuccessMessage(`بنجاح "${scannedProduct.name}" تم اضافة`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Reset form
      setIsPopupOpen(false);
      setDialogMessage(null);
      setScannedProduct(null);
      setSelectedCustomer('');
      setQuantity(1);
      setPaymentStatus('Unpaid');
      setRemark('');
      setScanStatus('Item saved! Ready for next scan.');
      // OPTIMIZED: Resume scanner after saving
      setScannerPaused(false);
      setTimeout(() => setScanStatus('Align the barcode within the frame.'), 2000);
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to the database.");
    } finally {
      setIsProcessing(false);
    }
  }, [scannedProduct, selectedCustomer, quantity, name, customers, paymentStatus, remark]);

  const handlePaymentStatusChange = useCallback((e) => {
    setPaymentStatus(e.target.value);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // OPTIMIZED: Clean up camera before logout
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
          const updatedItemRef = ref(database, `SoldItems/${itemKey}`);
          await update(updatedItemRef, {
            quantity: item.quantity,
            totalCost: item.totalCost,
            paymentStatus: item.paymentStatus,
            remark: item.remark,
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
  }, []);

  const handleClosePopup = useCallback(() => {
    setIsPopupOpen(false);
    setDialogMessage(null);
    setScannedProduct(null);
    setSelectedCustomer('');
    setQuantity(1);
    setPaymentStatus('Unpaid');
    setRemark('');
    setScanStatus('Align the barcode within the frame.');
    // OPTIMIZED: Resume scanner when popup closes
    setScannerPaused(false);
  }, []);

  const toggleScannedItems = useCallback(() => {
    setShowScannedItems(prev => !prev);
  }, []);

  if (!user) {
    return <div className="loading-message">Please log in to continue...</div>;
  }

  return (
    <div className="container">
      <div className="header">
        <button className="logout-button" onClick={handleLogout}>
          تسجيل خروج
        </button>
        {/* NEW: Camera toggle button */}
        <button className="camera-toggle-button" onClick={toggleCamera}>
          {cameraActive ? 'Pause Camera' : 'Resume Camera'}
        </button>
      </div>
      
      <div className="scanner-container">
        {cameraActive ? (
          <video ref={scannerRef} className="scanner"></video>
        ) : (
          <div className="camera-paused">
            <p>Camera Paused - Click Resume to continue scanning</p>
          </div>
        )}
        <p className="status">{scanStatus}</p>
        
        {isProcessing && <div className="loading-message">Processing...</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}
        {loading && <div className="loading-message">Loading customers...</div>}
        
        {cameraActive && (
          <div className="zoom-controls">
            <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>
              Zoom Out
            </button>
            <input 
              type="range" 
              min="0.5" 
              max="5"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => changeZoom(parseFloat(e.target.value))}
            />
            <button onClick={() => changeZoom(Math.min(5, zoomLevel + 0.5))}>
              Zoom In
            </button>
          </div>
        )}
        
        {isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup">
              <button 
                className="close-popup-btn" 
                onClick={handleClosePopup}
                aria-label="Close"
                disabled={isProcessing}
              >
                ×
              </button>
              <h3 className="popup-text">{dialogMessage}</h3>
              
              <div className="customer-select">
                <label htmlFor="customer">اختر اسم المشتري</label>
                <select
                  id="customer"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
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
              
              <div className="quantity-input">
                <label htmlFor="quantity">الكمية:</label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  disabled={isProcessing}
                />
              </div>

              {scannedProduct?.itemCost && quantity > 0 && paymentStatus !== 'Stock' && (
                <div className="total-cost">
                  <p>{scannedProduct.itemCost * quantity} {scannedProduct.currency || '$  :المجموع'}</p>
                </div>
              )}

              <div className="radio-group">
                <input
                  type="radio"
                  id="paid"
                  name="paymentStatus"
                  value="Paid"
                  className="radio-input"
                  checked={paymentStatus === 'Paid'}
                  onChange={handlePaymentStatusChange}
                  disabled={isProcessing}
                />
                <label htmlFor="paid" className="radio-label">مدفوع</label>

                <input
                  type="radio"
                  id="unpaid"
                  name="paymentStatus"
                  value="Unpaid"
                  className="radio-input"
                  checked={paymentStatus === 'Unpaid'}
                  onChange={handlePaymentStatusChange}
                  disabled={isProcessing}
                />
                <label htmlFor="unpaid" className="radio-label">غير مدفوع</label>

                <input
                  type="radio"
                  id="stock"
                  name="paymentStatus"
                  value="Stock"
                  className="radio-input"
                  checked={paymentStatus === 'Stock'}
                  onChange={handlePaymentStatusChange}
                  disabled={isProcessing}
                />
                <label htmlFor="stock" className="radio-label">استلام</label>
              </div>

              <div className="remark-input">
                <textarea
                  id="remark"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter any remarks here"
                  disabled={isProcessing}
                />
                <label htmlFor="remark"> :ملاحظة </label>
              </div>

              <div>
                <button 
                  className="popup-btn-yes" 
                  onClick={saveScannedItem}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'نعم'}
                </button>
                <button 
                  className="popup-btn-no" 
                  onClick={handleClosePopup}
                  disabled={isProcessing}
                >
                  لا
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="scanned-items-container">
        <div className="scanned-items-header">
          <h2>Scanned Items ({new Date().toLocaleDateString()})</h2>
          <button onClick={toggleScannedItems}>
            {showScannedItems ? 'Hide' : 'Show'} Items
          </button>
        </div>
        
        {showScannedItems && (
          scannedItems.length > 0 ? (
            <table className="scanned-items-table">
              <thead>
                <tr>
                  <th>الباركود</th>
                  <th>اسم المنتج</th>
                  <th>اسم الزبون</th>
                  <th>الكمية</th>
                  <th>المجموع Cost</th>
                  <th>الدفع؟</th>
                  <th>التاريخ</th>
                  <th>ملاحظات</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {scannedItems.map((item, index) => (
                  <tr key={`${item.barcode}-${item.dateScanned}-${index}`}>
                    <td>{item.barcode}</td>
                    <td>{item.name}</td>
                    <td>{item.customerName}</td>
                    <td>{item.quantity}</td>  
                    <td>{item.totalCost}</td>
                    <td>{item.paymentStatus === "Paid" ? "مدفوع" : item.paymentStatus === "Stock" ? "استلام" : "غير مدفوع"}</td>
                    <td>{new Date(item.dateScanned).toLocaleString("ar-EG")}</td>
                    <td>{item.remark}</td>
                    <td>
                      <button onClick={() => setEditingItem(item)}>تعديل</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No items scanned today.</p>
          )
        )}

        {editingItem && (
          <div className="edit-popup">
            <div className="edit-form-container">
              <h3>تعديل المنتج</h3>
              <p><strong>الباركود:</strong> {editingItem.barcode}</p>
              <p><strong>اسم المنتج:</strong> {editingItem.name}</p>
              <p><strong>التاريخ:</strong> {new Date(editingItem.dateScanned).toLocaleString()}</p>

              <div>
                <label htmlFor="editQuantity">الكمية</label>
                <input
                  type="number"
                  id="editQuantity"
                  value={editingItem.quantity}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                      totalCost: editingItem.itemCost * Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  min="1"
                />
              </div>

              <div>
                <label htmlFor="editPaymentStatus">الدفع؟</label>
                <select
                  id="editPaymentStatus"
                  value={editingItem.paymentStatus}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      paymentStatus: e.target.value,
                    })
                  }
                >
                  <option value="Paid">مدفوع</option>
                  <option value="Unpaid">غير مدفوع</option>
                  <option value="Stock">استلام</option>
                </select>
              </div>

              <div>
                <label htmlFor="editRemark">ملاحظات</label>
                <textarea
                  id="editRemark"
                  value={editingItem.remark}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      remark: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-buttons">
                <button
                  className="save-button"
                  onClick={() => saveEditedItem(editingItem)}
                >
                  تعديل
                </button>
                <button 
                  className="cancel-button" 
                  onClick={() => setEditingItem(null)}
                >
                  الغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;