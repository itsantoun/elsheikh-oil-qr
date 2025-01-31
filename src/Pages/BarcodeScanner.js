import React, { useState, useEffect, useContext } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, update, child, push, onValue ,off} from "firebase/database";
import { UserContext } from '../Auth/userContext';  
import '../CSS/BarcodeScanner.css';

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
  const [paymentStatus, setPaymentStatus] = useState('Unpaid'); // Default to 'Unpaid'
  const [remark, setRemark] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null); // Track the item being edited
  const today = new Date().toDateString();


  const scannerRef = React.useRef(null);

  const { user } = useContext(UserContext);

  function getCustomDate() {
    const now = new Date();
    const customDate = new Date();
    
    if (now.getHours() < 22) {
      customDate.setDate(customDate.getDate() - 1);
    }
  
    customDate.setHours(22, 0, 0, 0); 
    return customDate;
  }
  
  const customDate = getCustomDate();
  const startOfDay = customDate.toISOString(); // Use this in your query

  useEffect(() => {
    const fetchUserName = async () => {
      if (user && user.uid) { // Ensure the user is authenticated and has a uid
        const userRef = ref(database, `users/${user.uid}`);
        try {
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.val();
            const fetchedName = userData?.name || 'Unknown';  // Retrieve 'name' from the database
            setName(fetchedName);  // Set the fetched name
          } else {
            console.error("User data not found in the database.");
            setName('Unknown');
          }
        } catch (error) {
          console.error("Error fetching user's name:", error);
          setName('Unknown');
        }
      } else {
        console.error("User is not authenticated or uid is missing.");
        setName('Unknown');
      }
    };

    const fetchCustomers = async () => {
      setLoading(true);
      const customersRef = ref(database, 'customers');
      try {
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
            setScanStatus('Barcode detected! Processing...');
            fetchProductDetails(result.text);
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
    
      return () => {
        codeReader.reset();
      };
    }, [user, zoomLevel]);

  //   const codeReader = new BrowserMultiFormatReader();
  //   const videoElement = scannerRef.current;

  //   codeReader
  //     .decodeFromVideoDevice(null, videoElement, (result, error) => {
  //       if (result) {
  //         setScanStatus('Barcode detected! Processing...');
  //         fetchProductDetails(result.text);
  //       } else if (error) {
  //         setScanStatus('Align the barcode and hold steady.');
  //       }
  //     })
  //     .then(() => {
  //       // Apply zoom after camera is initialized
  //       applyZoom();
  //     })
  //     .catch((err) => console.error('Camera initialization failed: refresh/try again later', err));

  //   return () => {
  //     codeReader.reset();
  //   };
  // }, [user, zoomLevel]);

  // const applyZoom = async () => {
  //   try {
  //     const videoElement = scannerRef.current;
  //     const stream = videoElement.srcObject;
  //     const [track] = stream.getVideoTracks();
  
  //     const capabilities = track.getCapabilities();
  //     if ('zoom' in capabilities) {
  //       const constraints = {
  //         advanced: [{ zoom: zoomLevel }],
  //       };
  //       await track.applyConstraints(constraints);
  //     } else {
  //     }
  //   } catch (error) {
  //     // console.error('Failed to apply zoom:', error);
  //   }
  // };

  const applyZoom = async () => {
    try {
      const videoElement = scannerRef.current;
      const stream = videoElement.srcObject;
      const [track] = stream.getVideoTracks();
  
      const capabilities = track.getCapabilities();
      if ('zoom' in capabilities) {
        const constraints = {
          advanced: [{ zoom: zoomLevel }, { focusMode: 'continuous' }], // Add focus mode
        };
        await track.applyConstraints(constraints);
      } else {
        console.warn('Zoom or focus capabilities are not supported by this device.');
      }
    } catch (error) {
      console.error('Failed to apply zoom or focus:', error);
    }
  };

  useEffect(() => {
  if (!user || !user.uid || !name) return;

  const soldItemsRef = ref(database, "SoldItems");

  const listener = onValue(soldItemsRef, (snapshot) => {
    if (snapshot.exists()) {
      const items = Object.values(snapshot.val());
      const today = new Date().toDateString();

      // const filteredItems = items.filter((item) => {
      //   const itemDate = new Date(item.dateScanned).toDateString();
      //   return (
      //     item.scannedBy === name &&
      //     itemDate === today
      //   );
      // });

      const filteredItems = items.filter((item) => {
        const itemDate = new Date(item.dateScanned);
        return (
          item.scannedBy === name &&
          itemDate >= customDate
        );
      });

      setScannedItems(filteredItems);
    } else {
      setScannedItems([]);
    }
  });

  // Cleanup listener on component unmount
  return () => {
    off(soldItemsRef, "value", listener);
  };
// }, [user, name]);
}, [user, name, customDate]);

  useEffect(() => {
    applyZoom();
  }, [zoomLevel]);

  const changeZoom = async (level) => {
    const videoElement = scannerRef.current;
    const stream = videoElement.srcObject;
    const [track] = stream.getVideoTracks();
    
    const capabilities = track.getCapabilities();
    if ('zoom' in capabilities) {
      // Allow a higher zoom range, e.g., up to 10x
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
  
    // Ensure name is set correctly from the context
    const scannedBy = name || 'Unknown'; // Ensure fallback if name is not available
    
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
      scannedBy: scannedBy,  // Use the name from the context
      customerName: customer.name,  // Store the customer name instead of the ID
      quantity: quantity,
      paymentStatus: paymentStatus, // Store the correct payment status
      itemCost: scannedProduct.itemCost, // Include item cost for reference
      totalCost: totalCost,  // Save the calculated total cost
      remark: remark, 
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
      setRemark('');
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

  const saveEditedItem = async (item) => {
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
  
          setEditingItem(null); // Close the edit form
          setSuccessMessage("Item updated successfully!");
          setTimeout(() => setSuccessMessage(null), 3000);
  
          // Reload items after update
          const updatedItems = scannedItems.map((i) =>
            i.barcode === item.barcode && i.dateScanned === item.dateScanned ? { ...i, ...item } : i
          );
          setScannedItems(updatedItems);
        }
      }
    } catch (error) {
      console.error("Error updating item:", error);
      setDialogMessage("Error updating item in the database.");
    }
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
  <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
  <input 
    type="range" 
    min="0.5" 
    max="10" // Increased maximum zoom level to 10x
    step="0.1"
    value={zoomLevel}
    onChange={(e) => changeZoom(parseFloat(e.target.value))}
  />
  <button onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
</div>
        
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
          <p>Total Cost: {scannedProduct.itemCost * quantity} {scannedProduct.currency || '$'}</p>
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
        <label htmlFor="paid" className="radio-label"> مدفوع</label>

        <input
          type="radio"
          id="unpaid"
          name="paymentStatus"
          value="Unpaid"
          className="radio-input"
          checked={paymentStatus === 'Unpaid'}
          onChange={handlePaymentStatusChange}
        />
        <label htmlFor="unpaid" className="radio-label">غير مدفوع</label>
      </div>
      <div className="remark-input">
                <label htmlFor="remark">Remark:</label>
                <textarea
                  id="remark"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter any remarks here"
                />
              </div>

      <div>
  <button className="popup-btn-yes" onClick={saveScannedItem}>نعم</button>
  <button className="popup-btn-no" onClick={() => setIsPopupOpen(false)}>لا</button>
</div>
    </div>
  </div>
)}
      </div>


<div className="scanned-items-container">
<h2>Scanned Items ({new Date().toLocaleDateString()})</h2>
  {scannedItems.length > 0 ? (
    <table className="scanned-items-table">
      <thead>
        <tr>
          <th>Barcode</th>
          <th>Name</th>
          <th>Customer</th>
          <th>Quantity</th>
          <th>Total Cost</th>
          <th>Payment Status</th>
          <th>Date</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        {scannedItems.map((item, index) => (
          // <tr key={index}>
          <tr key={item.id}>
            <td>{item.barcode}</td>
            <td>{item.name}</td>
            <td>{item.customerName}</td>
            <td>{item.quantity}</td>
            <td>{item.totalCost}</td>
            <td>{item.paymentStatus}</td>
            <td>{new Date(item.dateScanned).toLocaleString()}</td>
            <td>{item.remark}</td>
            <td>
        <button onClick={() => setEditingItem(item)}>Edit</button>
      </td>
          </tr>
        ))}
        {editingItem && (
  <div className="edit-form">
    <h3>Edit Item</h3>
    <p><strong>Barcode:</strong> {editingItem.barcode}</p>
    <p><strong>Name:</strong> {editingItem.name}</p>
    <p><strong>Date:</strong> {new Date(editingItem.dateScanned).toLocaleString()}</p>

    <div>
      <label htmlFor="editQuantity">Quantity:</label>
      <input
        type="number"
        id="editQuantity"
        value={editingItem.quantity}
        onChange={(e) =>
          setEditingItem({
            ...editingItem,
            quantity: Math.max(1, parseInt(e.target.value, 10)),
            totalCost: editingItem.itemCost * Math.max(1, parseInt(e.target.value, 10)),
          })
        }
        min="1"
      />
    </div>

    <div>
      <label htmlFor="editPaymentStatus">Payment Status:</label>
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
      </select>
    </div>

    <div>
      <label htmlFor="editRemark">Remark:</label>
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

    <button onClick={() => saveEditedItem(editingItem)}>Save</button>
    <button onClick={() => setEditingItem(null)}>Cancel</button>
  </div>
)}
      </tbody>
    </table>
  ) : (
    <p>No items scanned today.</p>
  )}
   {/* Edit Modal */}
   {editingItem && (
        <div className="edit-popup">
          <div className="edit-form-container">
            <h3>Edit Item</h3>
            <p><strong>Barcode:</strong> {editingItem.barcode}</p>
            <p><strong>Name:</strong> {editingItem.name}</p>
            <p><strong>Date:</strong> {new Date(editingItem.dateScanned).toLocaleString()}</p>

            <div>
              <label htmlFor="editQuantity">Quantity:</label>
              <input
                type="number"
                id="editQuantity"
                value={editingItem.quantity}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    quantity: Math.max(1, parseInt(e.target.value, 10)),
                    totalCost: editingItem.itemCost * Math.max(1, parseInt(e.target.value, 10)),
                  })
                }
                min="1"
              />
            </div>

            <div>
              <label htmlFor="editPaymentStatus">Payment Status:</label>
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
              </select>
            </div>

            <div>
              <label htmlFor="editRemark">Remark:</label>
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
                onClick={() => {
                  saveEditedItem(editingItem);
                  setEditingItem(null);
                }}
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
    </div>
  );
};

export default BarcodeScanner;