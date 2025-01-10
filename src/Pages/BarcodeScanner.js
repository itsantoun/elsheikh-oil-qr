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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState('Unpaid'); // Default to 'Unpaid'
  const scannerRef = React.useRef(null);

  const { user } = useContext(UserContext);

  useEffect(() => {
    const fetchUserName = async () => {
      if (user?.uid) {
        const userRef = ref(database, `users/${user.uid}`);
        try {
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.val();
            setUserName(userData.name);
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
          console.log("Fetched customers data:", customersData);
          setCustomers(
            Object.entries(customersData).map(([key, value]) => ({
              id: key,
              name: value.name || 'Unknown Customer',
            }))
          );
        } else {
          console.log("No customers data found.");
          setCustomers([]);
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
      .then(() => {
        // Apply zoom after camera is initialized
        applyZoom();
      })
      .catch((err) => console.error('Camera initialization failed: refresh/try again later', err));

    return () => {
      codeReader.reset();
    };
  }, [user, zoomLevel]);

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

  useEffect(() => {
    applyZoom();
  }, [zoomLevel]);

  const changeZoom = async (level) => {
    const videoElement = scannerRef.current;
    const stream = videoElement.srcObject;
    const [track] = stream.getVideoTracks();
    
    const capabilities = track.getCapabilities();
    if ('zoom' in capabilities) {
      const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max);
      setZoomLevel(newZoomLevel);
    } else {
      console.warn('Zoom capability is not supported by this device.');
    }
  };

  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const snapshot = await get(child(dbRef, `products/${barcode}`));
      if (snapshot.exists()) {
        const product = snapshot.val();
        setScannedProduct({ barcode, ...product });
        setDialogMessage(`هل تريد إضافته؟ ${product.name} :تم إيجاد`);
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
      setDialogMessage("!يجب تعبئت كل الخانات");
      return;
    }

    const totalCost = scannedProduct.itemCost * quantity;
    // Find the customer by ID to get the name
    const customer = customers.find(c => c.id === selectedCustomer);

    if (!customer) {
      setDialogMessage("Error: Customer not found.");
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
      scannedBy: userName || 'Unknown',
      customerName: customer.name,  // Store the customer name instead of the ID
      quantity: quantity,
      paymentStatus: paymentStatus, // Store the correct payment status
      itemCost: scannedProduct.itemCost, // Include item cost for reference
      totalCost: totalCost,  // Save the calculated total cost
    };

    try {
      await push(soldItemsRef, newItem);
      setSuccessMessage(`بنجاح "${scannedProduct.name}" تم اضافة`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsPopupOpen(false);
      setDialogMessage(null);
      setScannedProduct(null);
      setSelectedCustomer('');
      setQuantity(1);
      setPaymentStatus('Unpaid'); // Reset to default 'Unpaid' after saving
    } catch (error) {
      console.error("Error saving scanned item:", error);
      setDialogMessage("Error saving item to the database.");
    }
  };

  const handlePaymentStatusChange = (e) => {
    setPaymentStatus(e.target.value);
  };

  const handleLogout = () => {
    window.location.href = 'https://itsantoun.github.io/elsheikh-oil-qr/';
  };

  return (
    <div className="container">
      <div className="header">
        <button className="logout-button" onClick={handleLogout}>تسجيل خروج</button>
      </div>
      <div className="scanner-container">
        <video ref={scannerRef} className="scanner"></video>
        <p className="status">{scanStatus}</p>
        {successMessage && <div className="success-message">{successMessage}</div>}
        {loading && <div className="loading-message">Loading customers...</div>}
        
        <div className="zoom-controls">
          <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.1))}>Zoom Out</button>
          <input 
            type="range" 
            min="0.5" 
            max="3" 
            step="0.1"
            value={zoomLevel}
            onChange={(e) => changeZoom(parseFloat(e.target.value))}
          />
          <button onClick={() => changeZoom(Math.min(3, zoomLevel + 0.1))}>Zoom In</button>
        </div>

        {/* {isPopupOpen && (
          <div className="popup-overlay">
            <div className="popup">
              <h3 className="popup-title">Product Found</h3>
              <p className="popup-text">{dialogMessage}</p>
              <div className="customer-select">
                <label htmlFor="customer">اختر اسم المشتري</label>
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
              <div className="quantity-input">
                <label htmlFor="quantity">الكمية:</label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onBlur={(e) => setQuantity(Math.max(1, e.target.value))}
                  min="1"
                />
              </div>

              {scannedProduct && scannedProduct.itemCost && quantity > 0 && (
        <div className="total-cost">
          <p>Total Cost: {scannedProduct.itemCost * quantity} {scannedProduct.currency || 'LL'}</p>
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
                />
                <label htmlFor="paid" className="radio-label">Paid</label>

                <input
                  type="radio"
                  id="unpaid"
                  name="paymentStatus"
                  value="Unpaid"
                  className="radio-input"
                  checked={paymentStatus === 'Unpaid'}
                  onChange={handlePaymentStatusChange}
                />
                <label htmlFor="unpaid" className="radio-label">Unpaid</label>
              </div>
              <div className="popup-buttons">
                <button className="popup-btn" onClick={saveScannedItem}>نعم</button>
                <button className="popup-btn" onClick={() => setIsPopupOpen(false)}>لا</button>
              </div>
            </div>
          </div>
        )} */}

{isPopupOpen && (
  <div className="popup-overlay">
    <div className="popup">
      <button 
        className="close-popup-btn" 
        onClick={() => setIsPopupOpen(false)}
        aria-label="Close"
      >
        ×
      </button>
      <h3 className="popup-title">Product Found</h3>
      <p className="popup-text">{dialogMessage}</p>
      <div className="customer-select">
        <label htmlFor="customer">اختر اسم المشتري</label>
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
      <div className="quantity-input">
        <label htmlFor="quantity">الكمية:</label>
        <input
          type="number"
          id="quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={(e) => setQuantity(Math.max(1, e.target.value))}
          min="1"
        />
      </div>

      {scannedProduct && scannedProduct.itemCost && quantity > 0 && (
        <div className="total-cost">
          <p>Total Cost: {scannedProduct.itemCost * quantity} {scannedProduct.currency || 'LL'}</p>
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
        />
        <label htmlFor="paid" className="radio-label">Paid</label>

        <input
          type="radio"
          id="unpaid"
          name="paymentStatus"
          value="Unpaid"
          className="radio-input"
          checked={paymentStatus === 'Unpaid'}
          onChange={handlePaymentStatusChange}
        />
        <label htmlFor="unpaid" className="radio-label">Unpaid</label>
      </div>
      <div >
  <button className="popup-btn-yes" onClick={saveScannedItem}>نعم</button>
  <button className="popup-btn-no" onClick={() => setIsPopupOpen(false)}>لا</button>
</div>
    </div>
  </div>
)}
      </div>
    </div>
  );
};

export default BarcodeScanner;