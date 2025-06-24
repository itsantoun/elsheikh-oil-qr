import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
// import { ref, get, child, push, set } from 'firebase/database';
import { ref, get, child, push, set, update, remove } from 'firebase/database';
import '../CSS/remainingProducts.css';

const RemainingProducts = () => {
  const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [soldCount, setSoldCount] = useState(0);

  // Date range filters - now using date strings (YYYY-MM-DD format)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [uncertainQuantity, setUncertainQuantity] = useState('');
  
  // New state to track scanned products for current date range
  const [scannedProductsForCurrentRange, setScannedProductsForCurrentRange] = useState(new Set());

  const scannerRef = useRef(null);

  // Function to get current date key for tracking scanned items
  const getCurrentDateKey = () => {
    if (fromDate && toDate) {
      return `${fromDate}_to_${toDate}`;
    } else if (fromDate) {
      return `from_${fromDate}`;
    } else if (toDate) {
      return `to_${toDate}`;
    } else {
      return 'all_time';
    }
  };

  // Function to check if product is already scanned for current date range
  const checkIfProductAlreadyScanned = async (barcode) => {
    const dateKey = getCurrentDateKey();
    const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const stockData = snapshot.val();
        const isAlreadyScanned = Object.values(stockData).some(item => item.barcode === barcode);
        return isAlreadyScanned;
      }
      return false;
    } catch (error) {
      console.error('Error checking if product already scanned:', error);
      return false;
    }
  };

  // Function to load scanned products for current date range
  const loadScannedProductsForCurrentRange = async () => {
    const dateKey = getCurrentDateKey();
    const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const stockData = snapshot.val();
        const scannedBarcodes = Object.values(stockData).map(item => item.barcode);
        setScannedProductsForCurrentRange(new Set(scannedBarcodes));
      } else {
        setScannedProductsForCurrentRange(new Set());
      }
    } catch (error) {
      console.error('Error loading scanned products:', error);
      setScannedProductsForCurrentRange(new Set());
    }
  };

  // Load scanned products whenever date range changes
  useEffect(() => {
    loadScannedProductsForCurrentRange();
  }, [fromDate, toDate]);

  useEffect(() => {
    if (showScanner) {
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
        }, {
          tryHarder: true,
          constraints: {
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
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
    }
  }, [zoomLevel, showScanner]);

  useEffect(() => {
    const fetchProducts = async () => {
      const dbRef = ref(database);
      try {
        const productsSnapshot = await get(child(dbRef, 'products'));
        if (productsSnapshot.exists()) {
          const productsData = productsSnapshot.val();
          const productsList = Object.keys(productsData).map((barcode) => ({
            barcode,
            ...productsData[barcode],
          }));
          const sortedProducts = productsList.sort((a, b) => a.name.localeCompare(b.name));
          setProducts(sortedProducts);
        }
      } catch (error) {
      }
    };
  
    fetchProducts();
  }, []);

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
        // console.warn('Zoom capability is not supported by this device.');
      }
    } catch (error) {
      // console.error('Failed to apply zoom:', error);
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

  const [stockRecords, setStockRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: '',
    uncertainQuantity: '',
    soldCount: '',
    calculatedRemaining: ''
  });

  // Function to fetch all stock records
  const fetchStockRecords = async () => {
    const dbRef = ref(database, 'remainingStocks');
    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const records = [];
        
        // Iterate through each date range
        snapshot.forEach((dateRangeSnapshot) => {
          const dateRangeKey = dateRangeSnapshot.key;
          const dateRangeData = dateRangeSnapshot.val();
          
          // Iterate through each record in the date range
          Object.keys(dateRangeData).forEach((recordId) => {
            const record = dateRangeData[recordId];
            records.push({
              id: `${dateRangeKey}/${recordId}`,
              ...record,
              dateRange: dateRangeKey,
              timestamp: record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'
            });
          });
        });
        
        // Sort by timestamp (newest first)
        const sortedRecords = records.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        setStockRecords(sortedRecords);
      } else {
        setStockRecords([]);
      }
    } catch (error) {
      console.error('Error fetching stock records:', error);
      setStockRecords([]);
    }
  };

  // Load stock records on component mount and when saved
  useEffect(() => {
    fetchStockRecords();
  }, [isPopupOpen]); // Refresh when popup closes (after saving)

  // Filter records based on status filter
  const filteredRecords = stockRecords.filter(record => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Confirmed') return record.status === 'CONFIRMED';
    if (statusFilter === 'Not Confirmed') return record.status === 'NOT_CONFIRMED';
    return true;
  });

  // Handle edit button click
  // const handleEditClick = (record) => {
  //   setEditingId(record.id);
  //   setEditFormData({
  //     status: record.status,
  //     uncertainQuantity: record.uncertainQuantity || '',
  //     soldCount: record.soldCount,
  //     calculatedRemaining: record.calculatedRemaining
  //   });
  // };

  const handleEditClick = (record) => {
  setEditingId(record.id);
  setEditFormData({
    status: record.status,
    uncertainQuantity: record.uncertainQuantity || '',
    soldCount: record.soldCount,
    calculatedRemaining: record.calculatedRemaining,
    originalQuantity: record.initialQuantity // Store the original quantity
  });
};

  // Handle form input changes
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: value
    });
  };

  // Handle cancel edit
  const handleCancelClick = () => {
    setEditingId(null);
  };

  // Handle save edit
  // const handleSaveClick = async () => {
  //   try {
  //     const recordRef = ref(database, `remainingStocks/${editingId}`);
      
  //     // Prepare the update data
  //     const updateData = {
  //       status: editFormData.status,
  //       soldCount: parseInt(editFormData.soldCount) || 0,
  //       calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
  //     };
      
  //     // Only include uncertainQuantity if status is NOT_CONFIRMED
  //     if (editFormData.status === 'NOT_CONFIRMED') {
  //       updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
  //     } else {
  //       updateData.uncertainQuantity = null;
  //     }
      
  //     await update(recordRef, updateData);
  //     setEditingId(null);
  //     fetchStockRecords(); // Refresh the data
  //   } catch (error) {
  //     console.error('Error updating record:', error);
  //     alert('Failed to update record');
  //   }
  // };


//   const handleSaveClick = async () => {
//   try {
//     const recordRef = ref(database, `remainingStocks/${editingId}`);
    
//     // Prepare the update data
//     const updateData = {
//       status: editFormData.status,
//       soldCount: parseInt(editFormData.soldCount) || 0,
//       calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
//     };
    
//     // Only include uncertainQuantity if status is NOT_CONFIRMED
//     if (editFormData.status === 'NOT_CONFIRMED') {
//       updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
//     } else {
//       updateData.uncertainQuantity = null;
      
//       // If status is CONFIRMED, update the product quantity
//       const record = stockRecords.find(r => r.id === editingId);
//       if (record) {
//         const productRef = ref(database, `products/${record.barcode}`);
//         await update(productRef, {
//           quantity: updateData.calculatedRemaining
//         });
//       }
//     }
    
//     await update(recordRef, updateData);
//     setEditingId(null);
//     fetchStockRecords(); // Refresh the data
//   } catch (error) {
//     console.error('Error updating record:', error);
//     alert('Failed to update record');
//   }
// };

// const handleSaveClick = async () => {
//   try {
//     const recordRef = ref(database, `remainingStocks/${editingId}`);
//     const record = stockRecords.find(r => r.id === editingId);
    
//     if (!record) {
//       throw new Error('Record not found');
//     }

//     // Prepare the update data
//     const updateData = {
//       status: editFormData.status,
//       soldCount: parseInt(editFormData.soldCount) || 0,
//       calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
//     };

//     // Handle product quantity updates
//     const productRef = ref(database, `products/${record.barcode}`);
    
//     if (editFormData.status === 'CONFIRMED') {
//       // If changing to CONFIRMED, update product quantity
//       await update(productRef, {
//         quantity: updateData.calculatedRemaining
//       });
      
//       // Clear uncertain quantity if it exists
//       updateData.uncertainQuantity = null;
//     } else if (editFormData.status === 'NOT_CONFIRMED') {
//       // If changing from CONFIRMED to NOT_CONFIRMED, restore original quantity
//       if (record.status === 'CONFIRMED') {
//         await update(productRef, {
//           quantity: editFormData.originalQuantity
//         });
//       }
      
//       // Set uncertain quantity if provided
//       updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
//     }

//     await update(recordRef, updateData);
//     setEditingId(null);
//     fetchStockRecords(); // Refresh the data
//   } catch (error) {
//     console.error('Error updating record:', error);
//     alert('Failed to update record');
//   }
// };

const handleSaveClick = async () => {
  try {
    const recordRef = ref(database, `remainingStocks/${editingId}`);
    const record = stockRecords.find(r => r.id === editingId);
    
    if (!record) {
      throw new Error('Record not found');
    }

    // Prepare the update data
    const updateData = {
      status: editFormData.status,
      soldCount: parseInt(editFormData.soldCount) || 0,
      calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
    };

    // Handle product quantity updates
    const productRef = ref(database, `products/${record.barcode}`);

    if (editFormData.status === 'CONFIRMED') {
      // If changing to CONFIRMED, update product quantity
      let newQuantity;

      if (record.status === 'NOT_CONFIRMED') {
        // If changing from NOT_CONFIRMED → CONFIRMED, use uncertainQuantity
        newQuantity = parseInt(editFormData.uncertainQuantity) || 0;
      } else {
        // If already CONFIRMED or new, use calculatedRemaining
        newQuantity = updateData.calculatedRemaining;
      }

      await update(productRef, {
        quantity: newQuantity
      });

      // Ensure calculatedRemaining matches the new quantity
      updateData.calculatedRemaining = newQuantity;
      updateData.uncertainQuantity = null; // Clear uncertain quantity

    } else if (editFormData.status === 'NOT_CONFIRMED') {
      // If changing from CONFIRMED → NOT_CONFIRMED, restore original quantity
      if (record.status === 'CONFIRMED') {
        await update(productRef, {
          quantity: editFormData.originalQuantity
        });
      }
      
      // Set uncertain quantity if provided
      updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
    }

    await update(recordRef, updateData);
    setEditingId(null);
    fetchStockRecords(); // Refresh the data
  } catch (error) {
    console.error('Error updating record:', error);
    alert('Failed to update record');
  }
};

  // Handle delete record
  const handleDeleteClick = async (recordId) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const recordRef = ref(database, `remainingStocks/${recordId}`);
        await remove(recordRef);
        fetchStockRecords(); // Refresh the data
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Failed to delete record');
      }
    }
  };

//   const saveRemainingStock = async (status, uncertainQuantity = null) => {
//   try {
//     // Create a date key based on the selected date range
//     let dateKey;
//     if (fromDate && toDate) {
//       dateKey = `${fromDate}_to_${toDate}`;
//     } else if (fromDate) {
//       dateKey = `from_${fromDate}`;
//     } else if (toDate) {
//       dateKey = `to_${toDate}`;
//     } else {
//       dateKey = 'all_time';
//     }
    
//     // Structure: remainingStocks -> dateKey -> individual items
//     const dbRef = ref(database, `remainingStocks/${dateKey}`);
//     const newStockRef = push(dbRef);
    
//     // Get current timestamp
//     const currentTimestamp = new Date().toISOString();
    
//     const stockData = {
//       barcode: scannedProduct.barcode,
//       name: scannedProduct.name,
//       productType: scannedProduct.productType,
//       itemCost: scannedProduct.itemCost,
//       initialQuantity: scannedProduct.quantity,
//       soldCount: soldCount,
//       calculatedRemaining: scannedProduct.quantity - soldCount,
//       status: status,
//       timestamp: currentTimestamp,
//       dateScanned: currentTimestamp, // When this stock check was performed
      
//       // Store the date range info for reference
//       dateRangeInfo: {
//         fromDate: fromDate || null,
//         toDate: toDate || null,
//         dateKey: dateKey
//       },
      
//       // If uncertain quantity is provided
//       ...(status === 'NOT_CONFIRMED' && { uncertainQuantity: parseInt(uncertainQuantity) }),
//     };

//     await set(newStockRef, stockData);
    
//     // Update the scanned products set for current range
//     setScannedProductsForCurrentRange(prev => new Set([...prev, scannedProduct.barcode]));
    
//     // Optional: Log what was saved for debugging
//     console.log('Saved remaining stock under date key:', {
//       dateKey: dateKey,
//       productName: scannedProduct.name,
//       soldInRange: soldCount
//     });
    
//     return true;
//   } catch (error) {
//     console.error('Error saving remaining stock:', error);
//     return false;
//   }
// };


const saveRemainingStock = async (status, uncertainQuantity = null) => {
  try {
    // Create a date key based on the selected date range
    let dateKey;
    if (fromDate && toDate) {
      dateKey = `${fromDate}_to_${toDate}`;
    } else if (fromDate) {
      dateKey = `from_${fromDate}`;
    } else if (toDate) {
      dateKey = `to_${toDate}`;
    } else {
      dateKey = 'all_time';
    }
    
    // Calculate remaining quantity
    const remainingQuantity = status === 'CONFIRMED' 
      ? scannedProduct.quantity - soldCount 
      : uncertainQuantity;

    // Structure: remainingStocks -> dateKey -> individual items
    const dbRef = ref(database, `remainingStocks/${dateKey}`);
    const newStockRef = push(dbRef);
    
    // Get current timestamp
    const currentTimestamp = new Date().toISOString();
    
    const stockData = {
      barcode: scannedProduct.barcode,
      name: scannedProduct.name,
      productType: scannedProduct.productType,
      itemCost: scannedProduct.itemCost,
      initialQuantity: scannedProduct.quantity,
      soldCount: soldCount,
      calculatedRemaining: remainingQuantity,
      status: status,
      timestamp: currentTimestamp,
      dateScanned: currentTimestamp,
      dateRangeInfo: {
        fromDate: fromDate || null,
        toDate: toDate || null,
        dateKey: dateKey
      },
      ...(status === 'NOT_CONFIRMED' && { uncertainQuantity: parseInt(uncertainQuantity) }),
    };

    await set(newStockRef, stockData);
    
    // Update the product quantity in the products table if status is CONFIRMED
    if (status === 'CONFIRMED') {
      const productRef = ref(database, `products/${scannedProduct.barcode}`);
      await update(productRef, {
        quantity: remainingQuantity
      });
    }
    
    // Update the scanned products set for current range
    setScannedProductsForCurrentRange(prev => new Set([...prev, scannedProduct.barcode]));
    
    return true;
  } catch (error) {
    console.error('Error saving remaining stock:', error);
    return false;
  }
};

  const fetchSoldCount = async (productName, productBarcode) => {
    const dbRef = ref(database);
    try {
      const soldItemsSnapshot = await get(child(dbRef, 'SoldItems'));
      if (soldItemsSnapshot.exists()) {
        const soldData = soldItemsSnapshot.val();
        let count = 0;

        // Create date range if filters are set
        let fromDateObj = null;
        let toDateObj = null;

        if (fromDate) {
          fromDateObj = new Date(fromDate);
          fromDateObj.setHours(0, 0, 0, 0); // Start of day
        }

        if (toDate) {
          toDateObj = new Date(toDate);
          toDateObj.setHours(23, 59, 59, 999); // End of day
        }

        Object.values(soldData).forEach((item) => {
          // Match by product name or barcode
          const matchesProduct = 
            (item.name && item.name.toLowerCase() === productName.toLowerCase()) ||
            (item.barcode && item.barcode === productBarcode);

          if (matchesProduct) {
            // Check date range if filters are applied
            if (fromDateObj || toDateObj) {
              const itemDate = new Date(item.dateScanned);
              
              if (fromDateObj && itemDate < fromDateObj) return;
              if (toDateObj && itemDate > toDateObj) return;
            }
            
            count += parseInt(item.quantity) || 1;
          }
        });

        setSoldCount(count);
      } else {
        setSoldCount(0);
      }
    } catch (error) {
      console.error('Error fetching sold count:', error);
      setSoldCount(0);
    }
  };

  const fetchProductDetails = async (barcode) => {
    // First check if product is already scanned for current date range
    const isAlreadyScanned = await checkIfProductAlreadyScanned(barcode);
    
    if (isAlreadyScanned) {
      setScanStatus('Item already scanned for this date range!');
      setTimeout(() => {
        setScanStatus('Align the barcode within the frame.');
      }, 3000);
      return;
    }

    const dbRef = ref(database);
    try {
      const productSnapshot = await get(child(dbRef, `products/${barcode}`));
      if (productSnapshot.exists()) {
        const product = productSnapshot.val();
        const productData = {
          barcode,
          name: product.name,
          itemCost: product.itemCost,
          productType: product.productType,
          quantity: product.quantity,
        };
        setScannedProduct(productData);
        
        // Fetch sold count for this product
        await fetchSoldCount(product.name, barcode);
        
        setIsPopupOpen(true);
      } else {
        setScanStatus('Product not found in the database.');
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      setScanStatus('Error retrieving product information.');
    }
  };

  const handleProductSelect = async (event) => {
    const selectedBarcode = event.target.value;
    setSelectedProduct(selectedBarcode);
    if (selectedBarcode) {
      await fetchProductDetails(selectedBarcode);
    }
  };

  const clearDateFilters = () => {
    setFromDate('');
    setToDate('');
  };

  // Helper function to format date for display
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Filter products to exclude already scanned ones for current date range
  const availableProducts = products.filter(product => 
    !scannedProductsForCurrentRange.has(product.barcode)
  );

  return (
    <div className="container" style={{ 
      padding: '20px', 
      maxWidth: '95%', 
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Date Range Filters */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        gap: '20px',
        alignItems: 'center',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: 0, width: '100%' }}>Date Range for Sold Items Count</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '1rem', fontWeight: 'bold', minWidth: '50px' }}>From:</label>
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ 
                fontSize: '1rem', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                backgroundColor: 'white'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '1rem', fontWeight: 'bold', minWidth: '30px' }}>To:</label>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ 
                fontSize: '1rem', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                backgroundColor: 'white'
              }}
            />
          </div>

          <button
            onClick={clearDateFilters}
            style={{ 
              fontSize: '0.9rem', 
              padding: '8px 15px', 
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear Dates
          </button>
        </div>

        {/* Display selected date range */}
        {(fromDate || toDate) && (
          <div style={{ 
            width: '100%', 
            fontSize: '0.9rem', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            Selected range: {fromDate ? formatDateForDisplay(fromDate) : 'Beginning'} to {toDate ? formatDateForDisplay(toDate) : 'Today'}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '15px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          className="action-button"
          onClick={() => {
            setShowScanner(true);
            setShowDropdown(false);
            setScanStatus('Align the barcode within the frame.');
          }}
          style={{ 
            fontSize: '1rem', 
            padding: '12px 20px', 
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Scan Barcode
        </button>
        <button
          className="action-button"
          onClick={() => {
            setShowDropdown(true);
            setShowScanner(false);
            setScanStatus('Select a product from the dropdown.');
          }}
          style={{ 
            fontSize: '1rem', 
            padding: '12px 20px', 
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Search for Product
        </button>
      </div>

      {/* Filters Section */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        gap: '20px',
        alignItems: 'center',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="status-filter" style={{ fontSize: '1rem' }}>Filter by Status:</label>
          <select 
            id="status-filter"
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '1rem', padding: '8px', minWidth: '150px' }}
          >
            <option value="All">All Status</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Not Confirmed">Not Confirmed</option>
          </select>
        </div>
      </div>

      {/* Scanner Section */}
      {showScanner && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <video 
            ref={scannerRef} 
            style={{ 
              width: '100%', 
              maxWidth: '800px', 
              height: 'auto',
              borderRadius: '8px',
              border: '2px solid #ddd'
            }}
          ></video>
          <p style={{ 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            margin: '15px 0',
            textAlign: 'center',
            color: scanStatus.includes('already scanned') ? '#f44336' : 'inherit'
          }}>
            {scanStatus}
          </p>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '15px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <button 
              onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}
              style={{ 
                fontSize: '1rem', 
                padding: '8px 15px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Zoom Out
            </button>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => changeZoom(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <button 
              onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}
              style={{ 
                fontSize: '1rem', 
                padding: '8px 15px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Zoom In
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Section */}
      {showDropdown && (
        <div style={{ 
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <select 
            value={selectedProduct} 
            onChange={handleProductSelect}
            style={{ 
              fontSize: '1rem', 
              padding: '10px', 
              width: '100%',
              maxWidth: '600px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            <option value="">Select a product</option>
            {availableProducts.map((product) => (
              <option key={product.barcode} value={product.barcode}>
                {product.name} ({product.barcode})
              </option>
            ))}
          </select>
          {availableProducts.length === 0 && (
            <p style={{ 
              marginTop: '10px', 
              color: '#666', 
              fontStyle: 'italic' 
            }}>
              All products have been scanned for this date range.
            </p>
          )}
        </div>
      )}

      {/* Popup Modal */}
     {isPopupOpen && scannedProduct && (
  <div style={{ 
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  }}>
    <div style={{ 
      backgroundColor: 'white',
      padding: '25px',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '500px',
      position: 'relative'
    }}>
      <button
        onClick={() => {
          setIsPopupOpen(false);
          setSoldCount(0);
        }}
        style={{
          position: 'absolute',
          top: '10px',
          right: '15px',
          fontSize: '1.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        ×
      </button>
      <h3 style={{ fontSize: '1.5rem', margin: '0 0 10px 0' }}>
        {scannedProduct.name}
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Product Type:</p>
          <p>{scannedProduct.productType}</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Item Cost:</p>
          <p>${scannedProduct.itemCost}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Initial Quantity:</p>
          <p>{scannedProduct.quantity}</p>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#e3f2fd',
          borderRadius: '4px'
        }}>
          <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Total Sold:</p>
          <p style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#1976d2',
            margin: 0 
          }}>
            {soldCount}
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          marginTop: '10px',
          padding: '10px',
          backgroundColor: '#e8f5e8',
          borderRadius: '4px'
        }}>
          <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Remaining Quantity:</p>
          <p style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#2e7d32',
            margin: 0 
          }}>
            {scannedProduct.quantity - soldCount}
          </p>
        </div>

        {/* New buttons section */}
        <div style={{ 
          marginTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
        <button
  onClick={async () => {
    const saved = await saveRemainingStock('CONFIRMED');
    if (saved) {
      setIsPopupOpen(false);
      setSoldCount(0);
    } else {
    }
  }}
  style={{
    padding: '10px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '1rem'
  }}
>
  Confirm Existing Quantity
</button>

         <div style={{ 
  display: 'flex',
  gap: '10px',
  alignItems: 'center'
}}>
  <input
    type="number"
    value={uncertainQuantity}
    onChange={(e) => setUncertainQuantity(e.target.value)}
    placeholder="Enter uncertain quantity"
    style={{
      flex: 1,
      padding: '10px',
      borderRadius: '4px',
      border: '1px solid #ddd'
    }}
  />
  <button
    onClick={async () => {
      if (!uncertainQuantity || isNaN(uncertainQuantity)) {
        alert('Please enter a valid quantity');
        return;
      }
      
      const saved = await saveRemainingStock('NOT_CONFIRMED', uncertainQuantity);
      if (saved) {
        setIsPopupOpen(false);
        setSoldCount(0);
        setUncertainQuantity('');
      } else {
        alert('Failed to save uncertain quantity.');
      }
    }}
    style={{
      padding: '10px 15px',
      backgroundColor: '#f44336',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '1rem'
    }}
  >
    Save Uncertain Quantity
  </button>
</div>
</div>


        {/* Show date range info in popup if filters are active */}
        {(fromDate || toDate) && (
          <div style={{ 
            marginTop: '10px',
            padding: '8px',
            backgroundColor: '#fff3e0',
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#e65100'
          }}>
          
          </div>
          
        )}
      </div>
    </div>
  </div>
  
)}

  <div style={{ 
  marginTop: '30px',
  overflowX: 'auto'
}}>
  <h3 style={{ 
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '1px solid #ddd'
  }}>
    Stock Records
    {(fromDate || toDate) && (
      <span style={{ 
        fontSize: '0.8rem',
        marginLeft: '10px',
        color: '#666',
        fontWeight: 'normal'
      }}>
        {fromDate && toDate ? `(From ${formatDateForDisplay(fromDate)} to ${formatDateForDisplay(toDate)})` : 
         fromDate ? `(From ${formatDateForDisplay(fromDate)})` : 
         `(Up to ${formatDateForDisplay(toDate)})`}
      </span>
    )}
  </h3>
  
  {!fromDate && !toDate ? (
    <div style={{ 
      padding: '15px',
      backgroundColor: '#fff3e0',
      borderRadius: '4px',
      borderLeft: '4px solid #ff9800',
      marginBottom: '20px'
    }}>
      <p style={{ margin: 0 }}>
        <strong>Note:</strong> Please select a date range to view filtered stock records.
        Currently showing all records.
      </p>
    </div>
  ) : null}

  {filteredRecords.length === 0 ? (
    <div style={{ 
      padding: '15px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      textAlign: 'center'
    }}>
      {fromDate || toDate ? (
        <p style={{ margin: 0 }}>
          No stock records found for the selected date range: 
          {fromDate ? ` from ${formatDateForDisplay(fromDate)}` : ''}
          {toDate ? ` to ${formatDateForDisplay(toDate)}` : ''}
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          No stock records found. Scan some products to see records.
        </p>
      )}
    </div>
  ) : (
    <table style={{ 
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '10px'
    }}>
      <thead>
        <tr style={{ 
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #ddd'
        }}>
          <th style={{ padding: '12px', textAlign: 'left' }}>Product</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Barcode</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Initial Qty</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Sold</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Remaining</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Uncertain Qty</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Date Scanned</th>
          <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredRecords
          .filter(record => {
            if (!fromDate && !toDate) return true;
            
            const recordDate = new Date(record.timestamp || record.dateScanned);
            const from = fromDate ? new Date(fromDate) : null;
            const to = toDate ? new Date(toDate) : null;
            
            if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
            if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
            return true;
          })
          .map((record) => (
            <tr key={record.id} style={{ 
              borderBottom: '1px solid #eee',
              backgroundColor: editingId === record.id ? '#fffde7' : 'white'
            }}>
              <td style={{ padding: '12px' }}>{record.name}</td>
              <td style={{ padding: '12px' }}>{record.barcode}</td>
              <td style={{ padding: '12px' }}>{record.initialQuantity}</td>
              
              {editingId === record.id ? (
                <>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="number"
                      name="soldCount"
                      value={editFormData.soldCount}
                      onChange={handleEditFormChange}
                      style={{ width: '60px', padding: '5px' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="number"
                      name="calculatedRemaining"
                      value={editFormData.calculatedRemaining}
                      onChange={handleEditFormChange}
                      style={{ width: '60px', padding: '5px' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <select
                      name="status"
                      value={editFormData.status}
                      onChange={handleEditFormChange}
                      style={{ padding: '5px' }}
                    >
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="NOT_CONFIRMED">Not Confirmed</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {editFormData.status === 'NOT_CONFIRMED' ? (
                      <input
                        type="number"
                        name="uncertainQuantity"
                        value={editFormData.uncertainQuantity}
                        onChange={handleEditFormChange}
                        style={{ width: '60px', padding: '5px' }}
                      />
                    ) : (
                      'N/A'
                    )}
                  </td>
                </>
              ) : (
                <>
                  <td style={{ padding: '12px' }}>{record.soldCount}</td>
                  <td style={{ padding: '12px' }}>{record.calculatedRemaining}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      color: record.status === 'CONFIRMED' ? 'green' : 'red',
                      fontWeight: 'bold'
                    }}>
                      {record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A'}
                  </td>
                </>
              )}
              
              <td style={{ padding: '12px' }}>
                {record.timestamp || 'N/A'}
              </td>
              
              <td style={{ padding: '12px' }}>
                {editingId === record.id ? (
                  <>
                    <button
                      onClick={handleSaveClick}
                      style={{
                        marginRight: '5px',
                        padding: '5px 10px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelClick}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEditClick(record)}
                      style={{
                        marginRight: '5px',
                        padding: '5px 10px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(record.id)}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  )}
</div>
  </div>

  
  );
};

export default RemainingProducts;