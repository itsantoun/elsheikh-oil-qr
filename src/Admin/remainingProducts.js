// // import React, { useState, useEffect, useRef } from 'react';
// // import { BrowserMultiFormatReader } from '@zxing/library';
// // import { database } from '../Auth/firebase';
// // // import { ref, get, child, push, set } from 'firebase/database';
// // import { ref, get, child, push, set, update, remove } from 'firebase/database';
// // import '../CSS/remainingProducts.css';
// // import * as XLSX from 'xlsx';

// // const RemainingProducts = () => {
// //   const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
// //   const [scannedProduct, setScannedProduct] = useState(null);
// //   const [zoomLevel, setZoomLevel] = useState(1);
// //   const [isPopupOpen, setIsPopupOpen] = useState(false);
// //   const [products, setProducts] = useState([]);
// //   const [selectedProduct, setSelectedProduct] = useState('');
// //   const [showScanner, setShowScanner] = useState(false);
// //   const [showDropdown, setShowDropdown] = useState(false);
// //   const [statusFilter, setStatusFilter] = useState('All');
// //   const [soldCount, setSoldCount] = useState(0);

// //   // Date range filters - now using date strings (YYYY-MM-DD format)
// //   const [fromDate, setFromDate] = useState('');
// //   const [toDate, setToDate] = useState('');

// //   const [uncertainQuantity, setUncertainQuantity] = useState('');
  
// //   // New state to track scanned products for current date range
// //   const [scannedProductsForCurrentRange, setScannedProductsForCurrentRange] = useState(new Set());

// //   const scannerRef = useRef(null);

// //   // Function to get current date key for tracking scanned items
// //   const getCurrentDateKey = () => {
// //     if (fromDate && toDate) {
// //       return `${fromDate}_to_${toDate}`;
// //     } else if (fromDate) {
// //       return `from_${fromDate}`;
// //     } else if (toDate) {
// //       return `to_${toDate}`;
// //     } else {
// //       return 'all_time';
// //     }
// //   };


// //   const exportToExcel = () => {
// //   // Filter records based on date range and status filter
// //   const recordsToExport = filteredRecords.filter(record => {
// //     if (!fromDate && !toDate) return true;
    
// //     const recordDate = new Date(record.timestamp || record.dateScanned);
// //     const from = fromDate ? new Date(fromDate) : null;
// //     const to = toDate ? new Date(toDate) : null;
    
// //     if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
// //     if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
// //     return true;
// //   });

// //   // Prepare data for Excel
// //   const excelData = recordsToExport.map(record => ({
// //     'Product Name': record.name,
// //     'Barcode': record.barcode,
// //     'Product Type': record.productType,
// //     'Item Cost': record.itemCost,
// //     'Initial Quantity': record.initialQuantity,
// //     'Sold Count': record.soldCount,
// //     'Calculated Remaining': record.calculatedRemaining,
// //     'Status': record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed',
// //     'Uncertain Quantity': record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A',
// //     'Date Scanned': record.timestamp || 'N/A'
// //   }));

// //   // Create workbook and worksheet
// //   const wb = XLSX.utils.book_new();
// //   const ws = XLSX.utils.json_to_sheet(excelData);

// //   // Add worksheet to workbook
// //   XLSX.utils.book_append_sheet(wb, ws, 'Stock Records');

// //   // Generate filename with date range
// //   let filename = 'stock_records';
// //   if (fromDate && toDate) {
// //     filename += `_${fromDate}_to_${toDate}`;
// //   } else if (fromDate) {
// //     filename += `_from_${fromDate}`;
// //   } else if (toDate) {
// //     filename += `_to_${toDate}`;
// //   }
  
// //   if (statusFilter !== 'All') {
// //     filename += `_${statusFilter.toLowerCase().replace(' ', '_')}`;
// //   }
  
// //   filename += '.xlsx';

// //   // Save file
// //   XLSX.writeFile(wb, filename);
// // };


// //   // Function to check if product is already scanned for current date range
// //   const checkIfProductAlreadyScanned = async (barcode) => {
// //     const dateKey = getCurrentDateKey();
// //     const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
// //     try {
// //       const snapshot = await get(dbRef);
// //       if (snapshot.exists()) {
// //         const stockData = snapshot.val();
// //         const isAlreadyScanned = Object.values(stockData).some(item => item.barcode === barcode);
// //         return isAlreadyScanned;
// //       }
// //       return false;
// //     } catch (error) {
// //       console.error('Error checking if product already scanned:', error);
// //       return false;
// //     }
// //   };

// //   // Function to load scanned products for current date range
// //   const loadScannedProductsForCurrentRange = async () => {
// //     const dateKey = getCurrentDateKey();
// //     const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
// //     try {
// //       const snapshot = await get(dbRef);
// //       if (snapshot.exists()) {
// //         const stockData = snapshot.val();
// //         const scannedBarcodes = Object.values(stockData).map(item => item.barcode);
// //         setScannedProductsForCurrentRange(new Set(scannedBarcodes));
// //       } else {
// //         setScannedProductsForCurrentRange(new Set());
// //       }
// //     } catch (error) {
// //       console.error('Error loading scanned products:', error);
// //       setScannedProductsForCurrentRange(new Set());
// //     }
// //   };

// //   // Load scanned products whenever date range changes
// //   useEffect(() => {
// //     loadScannedProductsForCurrentRange();
// //   }, [fromDate, toDate]);

// //   useEffect(() => {
// //     if (showScanner) {
// //       const codeReader = new BrowserMultiFormatReader();
// //       const videoElement = scannerRef.current;

// //       codeReader
// //         .decodeFromVideoDevice(null, videoElement, (result, error) => {
// //           if (result) {
// //             setScanStatus('Barcode detected! Processing...');
// //             fetchProductDetails(result.text);
// //           } else if (error) {
// //             setScanStatus('Align the barcode and hold steady.');
// //           }
// //         }, {
// //           tryHarder: true,
// //           constraints: {
// //             video: {
// //               facingMode: 'environment',
// //               width: { ideal: 1280 },
// //               height: { ideal: 720 },
// //             },
// //           },
// //         })
// //         .then(() => {
// //           applyZoom();
// //         })
// //         .catch((err) => console.error('Camera initialization failed:', err));

// //       return () => {
// //         codeReader.reset();
// //       };
// //     }
// //   }, [zoomLevel, showScanner]);

// //   useEffect(() => {
// //     const fetchProducts = async () => {
// //       const dbRef = ref(database);
// //       try {
// //         const productsSnapshot = await get(child(dbRef, 'products'));
// //         if (productsSnapshot.exists()) {
// //           const productsData = productsSnapshot.val();
// //           const productsList = Object.keys(productsData).map((barcode) => ({
// //             barcode,
// //             ...productsData[barcode],
// //           }));
// //           const sortedProducts = productsList.sort((a, b) => a.name.localeCompare(b.name));
// //           setProducts(sortedProducts);
// //         }
// //       } catch (error) {
// //       }
// //     };
  
// //     fetchProducts();
// //   }, []);

// //   const applyZoom = async () => {
// //     try {
// //       const videoElement = scannerRef.current;
// //       const stream = videoElement.srcObject;
// //       const [track] = stream.getVideoTracks();

// //       const capabilities = track.getCapabilities();
// //       if ('zoom' in capabilities) {
// //         const constraints = {
// //           advanced: [{ zoom: zoomLevel }],
// //         };
// //         await track.applyConstraints(constraints);
// //       } else {
// //         // console.warn('Zoom capability is not supported by this device.');
// //       }
// //     } catch (error) {
// //       // console.error('Failed to apply zoom:', error);
// //     }
// //   };

// //   const changeZoom = async (level) => {
// //     const videoElement = scannerRef.current;
// //     const stream = videoElement.srcObject;
// //     const [track] = stream.getVideoTracks();

// //     const capabilities = track.getCapabilities();
// //     if ('zoom' in capabilities) {
// //       const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max || 10);
// //       setZoomLevel(newZoomLevel);
// //       try {
// //         await track.applyConstraints({
// //           advanced: [{ zoom: newZoomLevel }],
// //         });
// //       } catch (error) {
// //         console.error('Failed to apply zoom:', error);
// //       }
// //     } else {
// //       console.warn('Zoom capability is not supported by this device.');
// //     }
// //   };

// //   const [stockRecords, setStockRecords] = useState([]);
// //   const [editingId, setEditingId] = useState(null);
// //   const [editFormData, setEditFormData] = useState({
// //     status: '',
// //     uncertainQuantity: '',
// //     soldCount: '',
// //     calculatedRemaining: ''
// //   });

// //   // Function to fetch all stock records
// //   const fetchStockRecords = async () => {
// //     const dbRef = ref(database, 'remainingStocks');
// //     try {
// //       const snapshot = await get(dbRef);
// //       if (snapshot.exists()) {
// //         const records = [];
        
// //         // Iterate through each date range
// //         snapshot.forEach((dateRangeSnapshot) => {
// //           const dateRangeKey = dateRangeSnapshot.key;
// //           const dateRangeData = dateRangeSnapshot.val();
          
// //           // Iterate through each record in the date range
// //           Object.keys(dateRangeData).forEach((recordId) => {
// //             const record = dateRangeData[recordId];
// //             records.push({
// //               id: `${dateRangeKey}/${recordId}`,
// //               ...record,
// //               dateRange: dateRangeKey,
// //               timestamp: record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'
// //             });
// //           });
// //         });
        
// //         // Sort by timestamp (newest first)
// //         const sortedRecords = records.sort((a, b) => 
// //           new Date(b.timestamp) - new Date(a.timestamp)
// //         );
        
// //         setStockRecords(sortedRecords);
// //       } else {
// //         setStockRecords([]);
// //       }
// //     } catch (error) {
// //       console.error('Error fetching stock records:', error);
// //       setStockRecords([]);
// //     }
// //   };

// //   // Load stock records on component mount and when saved
// //   useEffect(() => {
// //     fetchStockRecords();
// //   }, [isPopupOpen]); // Refresh when popup closes (after saving)

// //   // Filter records based on status filter
// //   const filteredRecords = stockRecords.filter(record => {
// //     if (statusFilter === 'All') return true;
// //     if (statusFilter === 'Confirmed') return record.status === 'CONFIRMED';
// //     if (statusFilter === 'Not Confirmed') return record.status === 'NOT_CONFIRMED';
// //     return true;
// //   });

// //   // Handle edit button click
// //   // const handleEditClick = (record) => {
// //   //   setEditingId(record.id);
// //   //   setEditFormData({
// //   //     status: record.status,
// //   //     uncertainQuantity: record.uncertainQuantity || '',
// //   //     soldCount: record.soldCount,
// //   //     calculatedRemaining: record.calculatedRemaining
// //   //   });
// //   // };

// //   const handleEditClick = (record) => {
// //   setEditingId(record.id);
// //   setEditFormData({
// //     status: record.status,
// //     uncertainQuantity: record.uncertainQuantity || '',
// //     soldCount: record.soldCount,
// //     calculatedRemaining: record.calculatedRemaining,
// //     originalQuantity: record.initialQuantity // Store the original quantity
// //   });
// // };

// //   // Handle form input changes
// //   const handleEditFormChange = (e) => {
// //     const { name, value } = e.target;
// //     setEditFormData({
// //       ...editFormData,
// //       [name]: value
// //     });
// //   };

// //   // Handle cancel edit
// //   const handleCancelClick = () => {
// //     setEditingId(null);
// //   };

// //   // Handle save edit
// //   // const handleSaveClick = async () => {
// //   //   try {
// //   //     const recordRef = ref(database, `remainingStocks/${editingId}`);
      
// //   //     // Prepare the update data
// //   //     const updateData = {
// //   //       status: editFormData.status,
// //   //       soldCount: parseInt(editFormData.soldCount) || 0,
// //   //       calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
// //   //     };
      
// //   //     // Only include uncertainQuantity if status is NOT_CONFIRMED
// //   //     if (editFormData.status === 'NOT_CONFIRMED') {
// //   //       updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
// //   //     } else {
// //   //       updateData.uncertainQuantity = null;
// //   //     }
      
// //   //     await update(recordRef, updateData);
// //   //     setEditingId(null);
// //   //     fetchStockRecords(); // Refresh the data
// //   //   } catch (error) {
// //   //     console.error('Error updating record:', error);
// //   //     alert('Failed to update record');
// //   //   }
// //   // };


// // //   const handleSaveClick = async () => {
// // //   try {
// // //     const recordRef = ref(database, `remainingStocks/${editingId}`);
    
// // //     // Prepare the update data
// // //     const updateData = {
// // //       status: editFormData.status,
// // //       soldCount: parseInt(editFormData.soldCount) || 0,
// // //       calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
// // //     };
    
// // //     // Only include uncertainQuantity if status is NOT_CONFIRMED
// // //     if (editFormData.status === 'NOT_CONFIRMED') {
// // //       updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
// // //     } else {
// // //       updateData.uncertainQuantity = null;
      
// // //       // If status is CONFIRMED, update the product quantity
// // //       const record = stockRecords.find(r => r.id === editingId);
// // //       if (record) {
// // //         const productRef = ref(database, `products/${record.barcode}`);
// // //         await update(productRef, {
// // //           quantity: updateData.calculatedRemaining
// // //         });
// // //       }
// // //     }
    
// // //     await update(recordRef, updateData);
// // //     setEditingId(null);
// // //     fetchStockRecords(); // Refresh the data
// // //   } catch (error) {
// // //     console.error('Error updating record:', error);
// // //     alert('Failed to update record');
// // //   }
// // // };

// // // const handleSaveClick = async () => {
// // //   try {
// // //     const recordRef = ref(database, `remainingStocks/${editingId}`);
// // //     const record = stockRecords.find(r => r.id === editingId);
    
// // //     if (!record) {
// // //       throw new Error('Record not found');
// // //     }

// // //     // Prepare the update data
// // //     const updateData = {
// // //       status: editFormData.status,
// // //       soldCount: parseInt(editFormData.soldCount) || 0,
// // //       calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
// // //     };

// // //     // Handle product quantity updates
// // //     const productRef = ref(database, `products/${record.barcode}`);
    
// // //     if (editFormData.status === 'CONFIRMED') {
// // //       // If changing to CONFIRMED, update product quantity
// // //       await update(productRef, {
// // //         quantity: updateData.calculatedRemaining
// // //       });
      
// // //       // Clear uncertain quantity if it exists
// // //       updateData.uncertainQuantity = null;
// // //     } else if (editFormData.status === 'NOT_CONFIRMED') {
// // //       // If changing from CONFIRMED to NOT_CONFIRMED, restore original quantity
// // //       if (record.status === 'CONFIRMED') {
// // //         await update(productRef, {
// // //           quantity: editFormData.originalQuantity
// // //         });
// // //       }
      
// // //       // Set uncertain quantity if provided
// // //       updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
// // //     }

// // //     await update(recordRef, updateData);
// // //     setEditingId(null);
// // //     fetchStockRecords(); // Refresh the data
// // //   } catch (error) {
// // //     console.error('Error updating record:', error);
// // //     alert('Failed to update record');
// // //   }
// // // };

// // const handleSaveClick = async () => {
// //   try {
// //     const recordRef = ref(database, `remainingStocks/${editingId}`);
// //     const record = stockRecords.find(r => r.id === editingId);
    
// //     if (!record) {
// //       throw new Error('Record not found');
// //     }

// //     // Prepare the update data
// //     const updateData = {
// //       status: editFormData.status,
// //       soldCount: parseInt(editFormData.soldCount) || 0,
// //       calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
// //     };

// //     // Handle product quantity updates
// //     const productRef = ref(database, `products/${record.barcode}`);

// //     if (editFormData.status === 'CONFIRMED') {
// //       // If changing to CONFIRMED, update product quantity
// //       let newQuantity;

// //       if (record.status === 'NOT_CONFIRMED') {
// //         // If changing from NOT_CONFIRMED → CONFIRMED, use uncertainQuantity
// //         newQuantity = parseInt(editFormData.uncertainQuantity) || 0;
// //       } else {
// //         // If already CONFIRMED or new, use calculatedRemaining
// //         newQuantity = updateData.calculatedRemaining;
// //       }

// //       await update(productRef, {
// //         quantity: newQuantity
// //       });

// //       // Ensure calculatedRemaining matches the new quantity
// //       updateData.calculatedRemaining = newQuantity;
// //       updateData.uncertainQuantity = null; // Clear uncertain quantity

// //     } else if (editFormData.status === 'NOT_CONFIRMED') {
// //       // If changing from CONFIRMED → NOT_CONFIRMED, restore original quantity
// //       if (record.status === 'CONFIRMED') {
// //         await update(productRef, {
// //           quantity: editFormData.originalQuantity
// //         });
// //       }
      
// //       // Set uncertain quantity if provided
// //       updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
// //     }

// //     await update(recordRef, updateData);
// //     setEditingId(null);
// //     fetchStockRecords(); // Refresh the data
// //   } catch (error) {
// //     console.error('Error updating record:', error);
// //     alert('Failed to update record');
// //   }
// // };

// //   // Handle delete record
// //   const handleDeleteClick = async (recordId) => {
// //     if (window.confirm('Are you sure you want to delete this record?')) {
// //       try {
// //         const recordRef = ref(database, `remainingStocks/${recordId}`);
// //         await remove(recordRef);
// //         fetchStockRecords(); // Refresh the data
// //       } catch (error) {
// //         console.error('Error deleting record:', error);
// //         alert('Failed to delete record');
// //       }
// //     }
// //   };

// // //   const saveRemainingStock = async (status, uncertainQuantity = null) => {
// // //   try {
// // //     // Create a date key based on the selected date range
// // //     let dateKey;
// // //     if (fromDate && toDate) {
// // //       dateKey = `${fromDate}_to_${toDate}`;
// // //     } else if (fromDate) {
// // //       dateKey = `from_${fromDate}`;
// // //     } else if (toDate) {
// // //       dateKey = `to_${toDate}`;
// // //     } else {
// // //       dateKey = 'all_time';
// // //     }
    
// // //     // Structure: remainingStocks -> dateKey -> individual items
// // //     const dbRef = ref(database, `remainingStocks/${dateKey}`);
// // //     const newStockRef = push(dbRef);
    
// // //     // Get current timestamp
// // //     const currentTimestamp = new Date().toISOString();
    
// // //     const stockData = {
// // //       barcode: scannedProduct.barcode,
// // //       name: scannedProduct.name,
// // //       productType: scannedProduct.productType,
// // //       itemCost: scannedProduct.itemCost,
// // //       initialQuantity: scannedProduct.quantity,
// // //       soldCount: soldCount,
// // //       calculatedRemaining: scannedProduct.quantity - soldCount,
// // //       status: status,
// // //       timestamp: currentTimestamp,
// // //       dateScanned: currentTimestamp, // When this stock check was performed
      
// // //       // Store the date range info for reference
// // //       dateRangeInfo: {
// // //         fromDate: fromDate || null,
// // //         toDate: toDate || null,
// // //         dateKey: dateKey
// // //       },
      
// // //       // If uncertain quantity is provided
// // //       ...(status === 'NOT_CONFIRMED' && { uncertainQuantity: parseInt(uncertainQuantity) }),
// // //     };

// // //     await set(newStockRef, stockData);
    
// // //     // Update the scanned products set for current range
// // //     setScannedProductsForCurrentRange(prev => new Set([...prev, scannedProduct.barcode]));
    
// // //     // Optional: Log what was saved for debugging
// // //     console.log('Saved remaining stock under date key:', {
// // //       dateKey: dateKey,
// // //       productName: scannedProduct.name,
// // //       soldInRange: soldCount
// // //     });
    
// // //     return true;
// // //   } catch (error) {
// // //     console.error('Error saving remaining stock:', error);
// // //     return false;
// // //   }
// // // };


// // const saveRemainingStock = async (status, uncertainQuantity = null) => {
// //   try {
// //     // Create a date key based on the selected date range
// //     let dateKey;
// //     if (fromDate && toDate) {
// //       dateKey = `${fromDate}_to_${toDate}`;
// //     } else if (fromDate) {
// //       dateKey = `from_${fromDate}`;
// //     } else if (toDate) {
// //       dateKey = `to_${toDate}`;
// //     } else {
// //       dateKey = 'all_time';
// //     }
    
// //     // Calculate remaining quantity
// //     const remainingQuantity = status === 'CONFIRMED' 
// //       ? scannedProduct.quantity - soldCount 
// //       : uncertainQuantity;

// //     // Structure: remainingStocks -> dateKey -> individual items
// //     const dbRef = ref(database, `remainingStocks/${dateKey}`);
// //     const newStockRef = push(dbRef);
    
// //     // Get current timestamp
// //     const currentTimestamp = new Date().toISOString();
    
// //     const stockData = {
// //       barcode: scannedProduct.barcode,
// //       name: scannedProduct.name,
// //       productType: scannedProduct.productType,
// //       itemCost: scannedProduct.itemCost,
// //       initialQuantity: scannedProduct.quantity,
// //       soldCount: soldCount,
// //       calculatedRemaining: remainingQuantity,
// //       status: status,
// //       timestamp: currentTimestamp,
// //       dateScanned: currentTimestamp,
// //       dateRangeInfo: {
// //         fromDate: fromDate || null,
// //         toDate: toDate || null,
// //         dateKey: dateKey
// //       },
// //       ...(status === 'NOT_CONFIRMED' && { uncertainQuantity: parseInt(uncertainQuantity) }),
// //     };

// //     await set(newStockRef, stockData);
    
// //     // Update the product quantity in the products table if status is CONFIRMED
// //     if (status === 'CONFIRMED') {
// //       const productRef = ref(database, `products/${scannedProduct.barcode}`);
// //       await update(productRef, {
// //         quantity: remainingQuantity
// //       });
// //     }
    
// //     // Update the scanned products set for current range
// //     setScannedProductsForCurrentRange(prev => new Set([...prev, scannedProduct.barcode]));
    
// //     return true;
// //   } catch (error) {
// //     console.error('Error saving remaining stock:', error);
// //     return false;
// //   }
// // };

// //   const fetchSoldCount = async (productName, productBarcode) => {
// //     const dbRef = ref(database);
// //     try {
// //       const soldItemsSnapshot = await get(child(dbRef, 'SoldItems'));
// //       if (soldItemsSnapshot.exists()) {
// //         const soldData = soldItemsSnapshot.val();
// //         let count = 0;

// //         // Create date range if filters are set
// //         let fromDateObj = null;
// //         let toDateObj = null;

// //         if (fromDate) {
// //           fromDateObj = new Date(fromDate);
// //           fromDateObj.setHours(0, 0, 0, 0); // Start of day
// //         }

// //         if (toDate) {
// //           toDateObj = new Date(toDate);
// //           toDateObj.setHours(23, 59, 59, 999); // End of day
// //         }

// //         Object.values(soldData).forEach((item) => {
// //           // Match by product name or barcode
// //           const matchesProduct = 
// //             (item.name && item.name.toLowerCase() === productName.toLowerCase()) ||
// //             (item.barcode && item.barcode === productBarcode);

// //           if (matchesProduct) {
// //             // Check date range if filters are applied
// //             if (fromDateObj || toDateObj) {
// //               const itemDate = new Date(item.dateScanned);
              
// //               if (fromDateObj && itemDate < fromDateObj) return;
// //               if (toDateObj && itemDate > toDateObj) return;
// //             }
            
// //             count += parseInt(item.quantity) || 1;
// //           }
// //         });

// //         setSoldCount(count);
// //       } else {
// //         setSoldCount(0);
// //       }
// //     } catch (error) {
// //       console.error('Error fetching sold count:', error);
// //       setSoldCount(0);
// //     }
// //   };

// //   const fetchProductDetails = async (barcode) => {
// //     // First check if product is already scanned for current date range
// //     const isAlreadyScanned = await checkIfProductAlreadyScanned(barcode);
    
// //     if (isAlreadyScanned) {
// //       setScanStatus('Item already scanned for this date range!');
// //       setTimeout(() => {
// //         setScanStatus('Align the barcode within the frame.');
// //       }, 3000);
// //       return;
// //     }

// //     const dbRef = ref(database);
// //     try {
// //       const productSnapshot = await get(child(dbRef, `products/${barcode}`));
// //       if (productSnapshot.exists()) {
// //         const product = productSnapshot.val();
// //         const productData = {
// //           barcode,
// //           name: product.name,
// //           itemCost: product.itemCost,
// //           productType: product.productType,
// //           quantity: product.quantity,
// //         };
// //         setScannedProduct(productData);
        
// //         // Fetch sold count for this product
// //         await fetchSoldCount(product.name, barcode);
        
// //         setIsPopupOpen(true);
// //       } else {
// //         setScanStatus('Product not found in the database.');
// //       }
// //     } catch (error) {
// //       console.error('Error fetching product details:', error);
// //       setScanStatus('Error retrieving product information.');
// //     }
// //   };

// //   const handleProductSelect = async (event) => {
// //     const selectedBarcode = event.target.value;
// //     setSelectedProduct(selectedBarcode);
// //     if (selectedBarcode) {
// //       await fetchProductDetails(selectedBarcode);
// //     }
// //   };

// //   const clearDateFilters = () => {
// //     setFromDate('');
// //     setToDate('');
// //   };

// //   // Helper function to format date for display
// //   const formatDateForDisplay = (dateString) => {
// //     if (!dateString) return '';
// //     const date = new Date(dateString);
// //     return date.toLocaleDateString('en-US', { 
// //       year: 'numeric', 
// //       month: 'long', 
// //       day: 'numeric' 
// //     });
// //   };

// //   // Filter products to exclude already scanned ones for current date range
// //   const availableProducts = products.filter(product => 
// //     !scannedProductsForCurrentRange.has(product.barcode)
// //   );

// //   return (
// //     <div className="container" style={{ 
// //       padding: '20px', 
// //       maxWidth: '95%', 
// //       margin: '0 auto',
// //       display: 'flex',
// //       flexDirection: 'column',
// //       gap: '20px'
// //     }}>
// //       {/* Date Range Filters */}
// //       <div style={{ 
// //         display: 'flex', 
// //         flexWrap: 'wrap',
// //         gap: '20px',
// //         alignItems: 'center',
// //         padding: '15px',
// //         backgroundColor: '#f5f5f5',
// //         borderRadius: '8px'
// //       }}>
// //         <h3 style={{ margin: 0, width: '100%' }}>Date Range for Sold Items Count</h3>
        
// //         <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
// //           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
// //             <label style={{ fontSize: '1rem', fontWeight: 'bold', minWidth: '50px' }}>From:</label>
// //             <input 
// //               type="date" 
// //               value={fromDate}
// //               onChange={(e) => setFromDate(e.target.value)}
// //               style={{ 
// //                 fontSize: '1rem', 
// //                 padding: '8px 12px',
// //                 borderRadius: '4px',
// //                 border: '1px solid #ddd',
// //                 backgroundColor: 'white'
// //               }}
// //             />
// //           </div>

// //           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
// //             <label style={{ fontSize: '1rem', fontWeight: 'bold', minWidth: '30px' }}>To:</label>
// //             <input 
// //               type="date" 
// //               value={toDate}
// //               onChange={(e) => setToDate(e.target.value)}
// //               style={{ 
// //                 fontSize: '1rem', 
// //                 padding: '8px 12px',
// //                 borderRadius: '4px',
// //                 border: '1px solid #ddd',
// //                 backgroundColor: 'white'
// //               }}
// //             />
// //           </div>

// //           <button
// //             onClick={clearDateFilters}
// //             style={{ 
// //               fontSize: '0.9rem', 
// //               padding: '8px 15px', 
// //               backgroundColor: '#ff9800',
// //               color: 'white',
// //               border: 'none',
// //               borderRadius: '4px',
// //               cursor: 'pointer'
// //             }}
// //           >
// //             Clear Dates
// //           </button>
// //         </div>


// //         {/* Display selected date range */}
// //         {(fromDate || toDate) && (
// //           <div style={{ 
// //             width: '100%', 
// //             fontSize: '0.9rem', 
// //             color: '#666',
// //             fontStyle: 'italic'
// //           }}>
// //             Selected range: {fromDate ? formatDateForDisplay(fromDate) : 'Beginning'} to {toDate ? formatDateForDisplay(toDate) : 'Today'}
// //           </div>
// //         )}
// //       </div>

 

// //       {/* Action Buttons */}
// //       <div style={{ 
// //         display: 'flex', 
// //         gap: '15px',
// //         justifyContent: 'center',
// //         flexWrap: 'wrap'
// //       }}>
// //         <button
// //           className="action-button"
// //           onClick={() => {
// //             setShowScanner(true);
// //             setShowDropdown(false);
// //             setScanStatus('Align the barcode within the frame.');
// //           }}
// //           style={{ 
// //             fontSize: '1rem', 
// //             padding: '12px 20px', 
// //             backgroundColor: '#2196F3',
// //             color: 'white',
// //             border: 'none',
// //             borderRadius: '4px',
// //             cursor: 'pointer'
// //           }}
// //         >
// //           Scan Barcode
// //         </button>
// //         <button
// //           className="action-button"
// //           onClick={() => {
// //             setShowDropdown(true);
// //             setShowScanner(false);
// //             setScanStatus('Select a product from the dropdown.');
// //           }}
// //           style={{ 
// //             fontSize: '1rem', 
// //             padding: '12px 20px', 
// //             backgroundColor: '#2196F3',
// //             color: 'white',
// //             border: 'none',
// //             borderRadius: '4px',
// //             cursor: 'pointer'
// //           }}
// //         >
// //           Search for Product
// //         </button>
// //       </div>

// //       {/* Filters Section */}
// //       <div style={{ 
// //         display: 'flex', 
// //         flexWrap: 'wrap',
// //         gap: '20px',
// //         alignItems: 'center',
// //         padding: '15px',
// //         backgroundColor: '#f5f5f5',
// //         borderRadius: '8px'
// //       }}>
// //         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
// //           <label htmlFor="status-filter" style={{ fontSize: '1rem' }}>Filter by Status:</label>
// //           <select 
// //             id="status-filter"
// //             value={statusFilter} 
// //             onChange={(e) => setStatusFilter(e.target.value)}
// //             style={{ fontSize: '1rem', padding: '8px', minWidth: '150px' }}
// //           >
// //             <option value="All">All Status</option>
// //             <option value="Confirmed">Confirmed</option>
// //             <option value="Not Confirmed">Not Confirmed</option>
// //           </select>
// //         </div>
// //       </div>

// //       {/* Scanner Section */}
// //       {showScanner && (
// //         <div style={{ 
// //           display: 'flex', 
// //           flexDirection: 'column',
// //           alignItems: 'center',
// //           padding: '20px',
// //           backgroundColor: '#f5f5f5',
// //           borderRadius: '8px'
// //         }}>
// //           <video 
// //             ref={scannerRef} 
// //             style={{ 
// //               width: '100%', 
// //               maxWidth: '800px', 
// //               height: 'auto',
// //               borderRadius: '8px',
// //               border: '2px solid #ddd'
// //             }}
// //           ></video>
// //           <p style={{ 
// //             fontSize: '1.1rem', 
// //             fontWeight: 'bold', 
// //             margin: '15px 0',
// //             textAlign: 'center',
// //             color: scanStatus.includes('already scanned') ? '#f44336' : 'inherit'
// //           }}>
// //             {scanStatus}
// //           </p>

// //           <div style={{ 
// //             display: 'flex', 
// //             alignItems: 'center',
// //             gap: '15px',
// //             width: '100%',
// //             maxWidth: '500px'
// //           }}>
// //             <button 
// //               onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}
// //               style={{ 
// //                 fontSize: '1rem', 
// //                 padding: '8px 15px',
// //                 backgroundColor: '#f44336',
// //                 color: 'white',
// //                 border: 'none',
// //                 borderRadius: '4px',
// //                 cursor: 'pointer'
// //               }}
// //             >
// //               Zoom Out
// //             </button>
// //             <input
// //               type="range"
// //               min="0.5"
// //               max="10"
// //               step="0.1"
// //               value={zoomLevel}
// //               onChange={(e) => changeZoom(parseFloat(e.target.value))}
// //               style={{ flex: 1 }}
// //             />
// //             <button 
// //               onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}
// //               style={{ 
// //                 fontSize: '1rem', 
// //                 padding: '8px 15px',
// //                 backgroundColor: '#f44336',
// //                 color: 'white',
// //                 border: 'none',
// //                 borderRadius: '4px',
// //                 cursor: 'pointer'
// //               }}
// //             >
// //               Zoom In
// //             </button>
// //           </div>
// //         </div>
// //       )}

// //       {/* Dropdown Section */}
// //       {showDropdown && (
// //         <div style={{ 
// //           padding: '15px',
// //           backgroundColor: '#f5f5f5',
// //           borderRadius: '8px'
// //         }}>
// //           <select 
// //             value={selectedProduct} 
// //             onChange={handleProductSelect}
// //             style={{ 
// //               fontSize: '1rem', 
// //               padding: '10px', 
// //               width: '100%',
// //               maxWidth: '600px',
// //               borderRadius: '4px',
// //               border: '1px solid #ddd'
// //             }}
// //           >
// //             <option value="">Select a product</option>
// //             {availableProducts.map((product) => (
// //               <option key={product.barcode} value={product.barcode}>
// //                 {product.name} ({product.barcode})
// //               </option>
// //             ))}
// //           </select>
// //           {availableProducts.length === 0 && (
// //             <p style={{ 
// //               marginTop: '10px', 
// //               color: '#666', 
// //               fontStyle: 'italic' 
// //             }}>
// //               All products have been scanned for this date range.
// //             </p>
// //           )}
// //         </div>
// //       )}
// //            <button
// //   onClick={exportToExcel}
// //   style={{
// //     fontSize: '1rem',
// //     padding: '8px 15px',
// //     backgroundColor: '#4CAF50',
// //     color: 'white',
// //     border: 'none',
// //     borderRadius: '4px',
// //     cursor: 'pointer',
// //     display: 'flex',
// //     alignItems: 'center',
// //     gap: '5px'
// //   }}
// // >
// //   📊 Export to Excel
// // </button>

// //       {/* Popup Modal */}
// //      {isPopupOpen && scannedProduct && (
// //   <div style={{ 
// //     position: 'fixed',
// //     top: 0,
// //     left: 0,
// //     right: 0,
// //     bottom: 0,
// //     backgroundColor: 'rgba(0,0,0,0.5)',
// //     display: 'flex',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     zIndex: 1000
// //   }}>
// //     <div style={{ 
// //       backgroundColor: 'white',
// //       padding: '25px',
// //       borderRadius: '8px',
// //       width: '90%',
// //       maxWidth: '500px',
// //       position: 'relative'
// //     }}>
// //       <button
// //         onClick={() => {
// //           setIsPopupOpen(false);
// //           setSoldCount(0);
// //         }}
// //         style={{
// //           position: 'absolute',
// //           top: '10px',
// //           right: '15px',
// //           fontSize: '1.5rem',
// //           background: 'none',
// //           border: 'none',
// //           cursor: 'pointer'
// //         }}
// //       >
// //         ×
// //       </button>
// //       <h3 style={{ fontSize: '1.5rem', margin: '0 0 10px 0' }}>
// //         {scannedProduct.name}
// //       </h3>
      
// //       <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
// //         <div style={{ display: 'flex', alignItems: 'center' }}>
// //           <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Product Type:</p>
// //           <p>{scannedProduct.productType}</p>
// //         </div>
        
// //         <div style={{ display: 'flex', alignItems: 'center' }}>
// //           <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Item Cost:</p>
// //           <p>${scannedProduct.itemCost}</p>
// //         </div>

// //         <div style={{ display: 'flex', alignItems: 'center' }}>
// //           <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Initial Quantity:</p>
// //           <p>{scannedProduct.quantity}</p>
// //         </div>

// //         <div style={{ 
// //           display: 'flex', 
// //           alignItems: 'center',
// //           marginTop: '15px',
// //           padding: '10px',
// //           backgroundColor: '#e3f2fd',
// //           borderRadius: '4px'
// //         }}>
// //           <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Total Sold:</p>
// //           <p style={{ 
// //             fontSize: '1.5rem', 
// //             fontWeight: 'bold', 
// //             color: '#1976d2',
// //             margin: 0 
// //           }}>
// //             {soldCount}
// //           </p>
// //         </div>

// //         <div style={{ 
// //           display: 'flex', 
// //           alignItems: 'center',
// //           marginTop: '10px',
// //           padding: '10px',
// //           backgroundColor: '#e8f5e8',
// //           borderRadius: '4px'
// //         }}>
// //           <p style={{ fontWeight: 'bold', marginRight: '5px', minWidth: '100px' }}>Remaining Quantity:</p>
// //           <p style={{ 
// //             fontSize: '1.5rem', 
// //             fontWeight: 'bold', 
// //             color: '#2e7d32',
// //             margin: 0 
// //           }}>
// //             {scannedProduct.quantity - soldCount}
// //           </p>
// //         </div>

// //         {/* New buttons section */}
// //         <div style={{ 
// //           marginTop: '20px',
// //           display: 'flex',
// //           flexDirection: 'column',
// //           gap: '10px'
// //         }}>
// //         <button
// //   onClick={async () => {
// //     const saved = await saveRemainingStock('CONFIRMED');
// //     if (saved) {
// //       setIsPopupOpen(false);
// //       setSoldCount(0);
// //     } else {
// //     }
// //   }}
// //   style={{
// //     padding: '10px',
// //     backgroundColor: '#4CAF50',
// //     color: 'white',
// //     border: 'none',
// //     borderRadius: '4px',
// //     cursor: 'pointer',
// //     fontWeight: 'bold',
// //     fontSize: '1rem'
// //   }}
// // >
// //   Confirm Existing Quantity
// // </button>

// //          <div style={{ 
// //   display: 'flex',
// //   gap: '10px',
// //   alignItems: 'center'
// // }}>
// //   <input
// //     type="number"
// //     value={uncertainQuantity}
// //     onChange={(e) => setUncertainQuantity(e.target.value)}
// //     placeholder="Enter uncertain quantity"
// //     style={{
// //       flex: 1,
// //       padding: '10px',
// //       borderRadius: '4px',
// //       border: '1px solid #ddd'
// //     }}
// //   />
// //   <button
// //     onClick={async () => {
// //       if (!uncertainQuantity || isNaN(uncertainQuantity)) {
// //         alert('Please enter a valid quantity');
// //         return;
// //       }
      
// //       const saved = await saveRemainingStock('NOT_CONFIRMED', uncertainQuantity);
// //       if (saved) {
// //         setIsPopupOpen(false);
// //         setSoldCount(0);
// //         setUncertainQuantity('');
// //       } else {
// //         alert('Failed to save uncertain quantity.');
// //       }
// //     }}
// //     style={{
// //       padding: '10px 15px',
// //       backgroundColor: '#f44336',
// //       color: 'white',
// //       border: 'none',
// //       borderRadius: '4px',
// //       cursor: 'pointer',
// //       fontWeight: 'bold',
// //       fontSize: '1rem'
// //     }}
// //   >
// //     Save Uncertain Quantity
// //   </button>
// // </div>
// // </div>


// //         {/* Show date range info in popup if filters are active */}
// //         {(fromDate || toDate) && (
// //           <div style={{ 
// //             marginTop: '10px',
// //             padding: '8px',
// //             backgroundColor: '#fff3e0',
// //             borderRadius: '4px',
// //             fontSize: '0.9rem',
// //             color: '#e65100'
// //           }}>
          
// //           </div>
          
// //         )}
// //       </div>
// //     </div>
// //   </div>
  
// // )}

// //   <div style={{ 
// //   marginTop: '30px',
// //   overflowX: 'auto'
// // }}>
// //   <h3 style={{ 
// //     marginBottom: '15px',
// //     paddingBottom: '10px',
// //     borderBottom: '1px solid #ddd'
// //   }}>
// //     Stock Records
// //     {(fromDate || toDate) && (
// //       <span style={{ 
// //         fontSize: '0.8rem',
// //         marginLeft: '10px',
// //         color: '#666',
// //         fontWeight: 'normal'
// //       }}>
// //         {fromDate && toDate ? `(From ${formatDateForDisplay(fromDate)} to ${formatDateForDisplay(toDate)})` : 
// //          fromDate ? `(From ${formatDateForDisplay(fromDate)})` : 
// //          `(Up to ${formatDateForDisplay(toDate)})`}
// //       </span>
// //     )}
// //   </h3>
  
// //   {!fromDate && !toDate ? (
// //     <div style={{ 
// //       padding: '15px',
// //       backgroundColor: '#fff3e0',
// //       borderRadius: '4px',
// //       borderLeft: '4px solid #ff9800',
// //       marginBottom: '20px'
// //     }}>
// //       <p style={{ margin: 0 }}>
// //         <strong>Note:</strong> Please select a date range to view filtered stock records.
// //         Currently showing all records.
// //       </p>
// //     </div>
// //   ) : null}

// //   {filteredRecords.length === 0 ? (
// //     <div style={{ 
// //       padding: '15px',
// //       backgroundColor: '#f5f5f5',
// //       borderRadius: '4px',
// //       textAlign: 'center'
// //     }}>
// //       {fromDate || toDate ? (
// //         <p style={{ margin: 0 }}>
// //           No stock records found for the selected date range: 
// //           {fromDate ? ` from ${formatDateForDisplay(fromDate)}` : ''}
// //           {toDate ? ` to ${formatDateForDisplay(toDate)}` : ''}
// //         </p>
// //       ) : (
// //         <p style={{ margin: 0 }}>
// //           No stock records found. Scan some products to see records.
// //         </p>
// //       )}
// //     </div>
// //   ) : (
// //     <table style={{ 
// //       width: '100%',
// //       borderCollapse: 'collapse',
// //       marginTop: '10px'
// //     }}>
// //       <thead>
// //         <tr style={{ 
// //           backgroundColor: '#f5f5f5',
// //           borderBottom: '1px solid #ddd'
// //         }}>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Product</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Barcode</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Initial Qty</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Sold</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Remaining</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Uncertain Qty</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Date Scanned</th>
// //           <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
// //         </tr>
// //       </thead>
// //       <tbody>
// //         {filteredRecords
// //           .filter(record => {
// //             if (!fromDate && !toDate) return true;
            
// //             const recordDate = new Date(record.timestamp || record.dateScanned);
// //             const from = fromDate ? new Date(fromDate) : null;
// //             const to = toDate ? new Date(toDate) : null;
            
// //             if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
// //             if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
// //             return true;
// //           })
// //           .map((record) => (
// //             <tr key={record.id} style={{ 
// //               borderBottom: '1px solid #eee',
// //               backgroundColor: editingId === record.id ? '#fffde7' : 'white'
// //             }}>
// //               <td style={{ padding: '12px' }}>{record.name}</td>
// //               <td style={{ padding: '12px' }}>{record.barcode}</td>
// //               <td style={{ padding: '12px' }}>{record.initialQuantity}</td>
              
// //               {editingId === record.id ? (
// //                 <>
// //                   <td style={{ padding: '12px' }}>
// //                     <input
// //                       type="number"
// //                       name="soldCount"
// //                       value={editFormData.soldCount}
// //                       onChange={handleEditFormChange}
// //                       style={{ width: '60px', padding: '5px' }}
// //                     />
// //                   </td>
// //                   <td style={{ padding: '12px' }}>
// //                     <input
// //                       type="number"
// //                       name="calculatedRemaining"
// //                       value={editFormData.calculatedRemaining}
// //                       onChange={handleEditFormChange}
// //                       style={{ width: '60px', padding: '5px' }}
// //                     />
// //                   </td>
// //                   <td style={{ padding: '12px' }}>
// //                     <select
// //                       name="status"
// //                       value={editFormData.status}
// //                       onChange={handleEditFormChange}
// //                       style={{ padding: '5px' }}
// //                     >
// //                       <option value="CONFIRMED">Confirmed</option>
// //                       <option value="NOT_CONFIRMED">Not Confirmed</option>
// //                     </select>
// //                   </td>
// //                   <td style={{ padding: '12px' }}>
// //                     {editFormData.status === 'NOT_CONFIRMED' ? (
// //                       <input
// //                         type="number"
// //                         name="uncertainQuantity"
// //                         value={editFormData.uncertainQuantity}
// //                         onChange={handleEditFormChange}
// //                         style={{ width: '60px', padding: '5px' }}
// //                       />
// //                     ) : (
// //                       'N/A'
// //                     )}
// //                   </td>
// //                 </>
// //               ) : (
// //                 <>
// //                   <td style={{ padding: '12px' }}>{record.soldCount}</td>
// //                   <td style={{ padding: '12px' }}>{record.calculatedRemaining}</td>
// //                   <td style={{ padding: '12px' }}>
// //                     <span style={{
// //                       color: record.status === 'CONFIRMED' ? 'green' : 'red',
// //                       fontWeight: 'bold'
// //                     }}>
// //                       {record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed'}
// //                     </span>
// //                   </td>
// //                   <td style={{ padding: '12px' }}>
// //                     {record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A'}
// //                   </td>
// //                 </>
// //               )}
              
// //               <td style={{ padding: '12px' }}>
// //                 {record.timestamp || 'N/A'}
// //               </td>
              
// //               <td style={{ padding: '12px' }}>
// //                 {editingId === record.id ? (
// //                   <>
// //                     <button
// //                       onClick={handleSaveClick}
// //                       style={{
// //                         marginRight: '5px',
// //                         padding: '5px 10px',
// //                         backgroundColor: '#4CAF50',
// //                         color: 'white',
// //                         border: 'none',
// //                         borderRadius: '3px',
// //                         cursor: 'pointer'
// //                       }}
// //                     >
// //                       Save
// //                     </button>
// //                     <button
// //                       onClick={handleCancelClick}
// //                       style={{
// //                         padding: '5px 10px',
// //                         backgroundColor: '#f44336',
// //                         color: 'white',
// //                         border: 'none',
// //                         borderRadius: '3px',
// //                         cursor: 'pointer'
// //                       }}
// //                     >
// //                       Cancel
// //                     </button>
// //                   </>
// //                 ) : (
// //                   <>
// //                     <button
// //                       onClick={() => handleEditClick(record)}
// //                       style={{
// //                         marginRight: '5px',
// //                         padding: '5px 10px',
// //                         backgroundColor: '#2196F3',
// //                         color: 'white',
// //                         border: 'none',
// //                         borderRadius: '3px',
// //                         cursor: 'pointer'
// //                       }}
// //                     >
// //                       Edit
// //                     </button>
// //                     <button
// //                       onClick={() => handleDeleteClick(record.id)}
// //                       style={{
// //                         padding: '5px 10px',
// //                         backgroundColor: '#f44336',
// //                         color: 'white',
// //                         border: 'none',
// //                         borderRadius: '3px',
// //                         cursor: 'pointer'
// //                       }}
// //                     >
// //                       Delete
// //                     </button>
// //                   </>
// //                 )}
// //               </td>
// //             </tr>
// //           ))}
// //       </tbody>
// //     </table>
// //   )}
// // </div>
// //   </div>

  
// //   );
// // };

// // export default RemainingProducts;

// import React, { useState, useEffect, useRef } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase';
// import { ref, get, child, push, set, update, remove } from 'firebase/database';
// import '../CSS/remainingProducts.css';
// import * as XLSX from 'xlsx';

// const RemainingProducts = () => {
//   const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [products, setProducts] = useState([]);
//   const [selectedProduct, setSelectedProduct] = useState('');
//   const [showScanner, setShowScanner] = useState(false);
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [statusFilter, setStatusFilter] = useState('All');
//   const [soldCount, setSoldCount] = useState(0);
//   const [fromDate, setFromDate] = useState('');
//   const [toDate, setToDate] = useState('');
//   const [uncertainQuantity, setUncertainQuantity] = useState('');
//   const [scannedProductsForCurrentRange, setScannedProductsForCurrentRange] = useState(new Set());
//   const [availableDateRanges, setAvailableDateRanges] = useState([]);
//   const [mostRecentDateRange, setMostRecentDateRange] = useState(null);
//   const [selectedHistoryRange, setSelectedHistoryRange] = useState('');
//   const [stockRecords, setStockRecords] = useState([]);
//   const [editingId, setEditingId] = useState(null);
//   const [editFormData, setEditFormData] = useState({
//     status: '',
//     uncertainQuantity: '',
//     soldCount: '',
//     calculatedRemaining: ''
//   });

//   const scannerRef = useRef(null);

//   // Function to fetch all available date ranges and find the most recent
//   const fetchAvailableDateRanges = async () => {
//     const dbRef = ref(database, 'remainingStocks');
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const dateRanges = [];
//         let mostRecent = null;
//         let mostRecentTimestamp = 0;

//         snapshot.forEach((dateRangeSnapshot) => {
//           const dateRangeKey = dateRangeSnapshot.key;
//           const dateRangeData = dateRangeSnapshot.val();
          
//           let latestTimestamp = 0;
//           Object.values(dateRangeData).forEach(record => {
//             const timestamp = new Date(record.timestamp || record.dateScanned).getTime();
//             if (timestamp > latestTimestamp) {
//               latestTimestamp = timestamp;
//             }
//           });

//           dateRanges.push({
//             key: dateRangeKey,
//             latestTimestamp: latestTimestamp
//           });

//           if (latestTimestamp > mostRecentTimestamp) {
//             mostRecentTimestamp = latestTimestamp;
//             mostRecent = {
//               key: dateRangeKey,
//               timestamp: latestTimestamp
//             };
//           }
//         });

//         dateRanges.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
        
//         setAvailableDateRanges(dateRanges);
//         setMostRecentDateRange(mostRecent);
//       } else {
//         setAvailableDateRanges([]);
//         setMostRecentDateRange(null);
//       }
//     } catch (error) {
//       console.error('Error fetching available date ranges:', error);
//     }
//   };

//   // Function to parse date range key and return formatted string
//   const formatDateRangeKey = (key) => {
//     if (key === 'all_time') return 'All Time';
    
//     if (key.startsWith('from_')) {
//       const fromDate = key.replace('from_', '');
//       return `From ${formatDateForDisplay(fromDate)}`;
//     }
    
//     if (key.startsWith('to_')) {
//       const toDate = key.replace('to_', '');
//       return `Up to ${formatDateForDisplay(toDate)}`;
//     }
    
//     if (key.includes('_to_')) {
//       const [from, to] = key.split('_to_');
//       return `${formatDateForDisplay(from)} to ${formatDateForDisplay(to)}`;
//     }
    
//     return key;
//   };

//   // Load available date ranges on component mount
//   useEffect(() => {
//     fetchAvailableDateRanges();
//   }, [isPopupOpen]);

//   // Handle history range selection
//   const handleHistoryRangeSelect = (rangeKey) => {
//     setSelectedHistoryRange(rangeKey);
    
//     if (rangeKey === 'all_time') {
//       setFromDate('');
//       setToDate('');
//     } else if (rangeKey.startsWith('from_')) {
//       const fromDateVal = rangeKey.replace('from_', '');
//       setFromDate(fromDateVal);
//       setToDate('');
//     } else if (rangeKey.startsWith('to_')) {
//       const toDateVal = rangeKey.replace('to_', '');
//       setFromDate('');
//       setToDate(toDateVal);
//     } else if (rangeKey.includes('_to_')) {
//       const [from, to] = rangeKey.split('_to_');
//       setFromDate(from);
//       setToDate(to);
//     }
//   };

//   // Function to get current date key for tracking scanned items
//   const getCurrentDateKey = () => {
//     if (fromDate && toDate) {
//       return `${fromDate}_to_${toDate}`;
//     } else if (fromDate) {
//       return `from_${fromDate}`;
//     } else if (toDate) {
//       return `to_${toDate}`;
//     } else {
//       return 'all_time';
//     }
//   };

//   const exportToExcel = () => {
//     const recordsToExport = filteredRecords.filter(record => {
//       if (!fromDate && !toDate) return true;
      
//       const recordDate = new Date(record.timestamp || record.dateScanned);
//       const from = fromDate ? new Date(fromDate) : null;
//       const to = toDate ? new Date(toDate) : null;
      
//       if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
//       if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
//       return true;
//     });

//     const excelData = recordsToExport.map(record => ({
//       'Product Name': record.name,
//       'Barcode': record.barcode,
//       'Product Type': record.productType,
//       'Item Cost': record.itemCost,
//       'Initial Quantity': record.initialQuantity,
//       'Sold Count': record.soldCount,
//       'Calculated Remaining': record.calculatedRemaining,
//       'Status': record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed',
//       'Uncertain Quantity': record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A',
//       'Date Scanned': record.timestamp || 'N/A'
//     }));

//     const wb = XLSX.utils.book_new();
//     const ws = XLSX.utils.json_to_sheet(excelData);

//     XLSX.utils.book_append_sheet(wb, ws, 'Stock Records');

//     let filename = 'stock_records';
//     if (fromDate && toDate) {
//       filename += `_${fromDate}_to_${toDate}`;
//     } else if (fromDate) {
//       filename += `_from_${fromDate}`;
//     } else if (toDate) {
//       filename += `_to_${toDate}`;
//     }
    
//     if (statusFilter !== 'All') {
//       filename += `_${statusFilter.toLowerCase().replace(' ', '_')}`;
//     }
    
//     filename += '.xlsx';

//     XLSX.writeFile(wb, filename);
//   };

//   // Function to check if product is already scanned for current date range
//   const checkIfProductAlreadyScanned = async (barcode) => {
//     const dateKey = getCurrentDateKey();
//     const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const stockData = snapshot.val();
//         const isAlreadyScanned = Object.values(stockData).some(item => item.barcode === barcode);
//         return isAlreadyScanned;
//       }
//       return false;
//     } catch (error) {
//       console.error('Error checking if product already scanned:', error);
//       return false;
//     }
//   };

//   // Function to load scanned products for current date range
//   const loadScannedProductsForCurrentRange = async () => {
//     const dateKey = getCurrentDateKey();
//     const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const stockData = snapshot.val();
//         const scannedBarcodes = Object.values(stockData).map(item => item.barcode);
//         setScannedProductsForCurrentRange(new Set(scannedBarcodes));
//       } else {
//         setScannedProductsForCurrentRange(new Set());
//       }
//     } catch (error) {
//       console.error('Error loading scanned products:', error);
//       setScannedProductsForCurrentRange(new Set());
//     }
//   };

//   // Load scanned products whenever date range changes
//   useEffect(() => {
//     loadScannedProductsForCurrentRange();
//   }, [fromDate, toDate]);

//   useEffect(() => {
//     if (showScanner) {
//       const codeReader = new BrowserMultiFormatReader();
//       const videoElement = scannerRef.current;

//       codeReader
//         .decodeFromVideoDevice(null, videoElement, (result, error) => {
//           if (result) {
//             setScanStatus('Barcode detected! Processing...');
//             fetchProductDetails(result.text);
//           } else if (error) {
//             setScanStatus('Align the barcode and hold steady.');
//           }
//         }, {
//           tryHarder: true,
//           constraints: {
//             video: {
//               facingMode: 'environment',
//               width: { ideal: 1280 },
//               height: { ideal: 720 },
//             },
//           },
//         })
//         .then(() => {
//           applyZoom();
//         })
//         .catch((err) => console.error('Camera initialization failed:', err));

//       return () => {
//         codeReader.reset();
//       };
//     }
//   }, [zoomLevel, showScanner]);

//   useEffect(() => {
//     const fetchProducts = async () => {
//       const dbRef = ref(database);
//       try {
//         const productsSnapshot = await get(child(dbRef, 'products'));
//         if (productsSnapshot.exists()) {
//           const productsData = productsSnapshot.val();
//           const productsList = Object.keys(productsData).map((barcode) => ({
//             barcode,
//             ...productsData[barcode],
//           }));
//           const sortedProducts = productsList.sort((a, b) => a.name.localeCompare(b.name));
//           setProducts(sortedProducts);
//         }
//       } catch (error) {
//         console.error('Error fetching products:', error);
//       }
//     };
  
//     fetchProducts();
//   }, []);

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
//       }
//     } catch (error) {
//       console.error('Error applying zoom:', error);
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

//   // Function to fetch all stock records
//   const fetchStockRecords = async () => {
//     const dbRef = ref(database, 'remainingStocks');
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const records = [];
        
//         snapshot.forEach((dateRangeSnapshot) => {
//           const dateRangeKey = dateRangeSnapshot.key;
//           const dateRangeData = dateRangeSnapshot.val();
          
//           Object.keys(dateRangeData).forEach((recordId) => {
//             const record = dateRangeData[recordId];
//             records.push({
//               id: `${dateRangeKey}/${recordId}`,
//               ...record,
//               dateRange: dateRangeKey,
//               timestamp: record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'
//             });
//           });
//         });
        
//         const sortedRecords = records.sort((a, b) => 
//           new Date(b.timestamp) - new Date(a.timestamp)
//         );
        
//         setStockRecords(sortedRecords);
//       } else {
//         setStockRecords([]);
//       }
//     } catch (error) {
//       console.error('Error fetching stock records:', error);
//       setStockRecords([]);
//     }
//   };

//   // Load stock records on component mount and when saved
//   useEffect(() => {
//     fetchStockRecords();
//   }, [isPopupOpen]);

//   // Filter records based on status filter
//   const filteredRecords = stockRecords.filter(record => {
//     if (statusFilter === 'All') return true;
//     if (statusFilter === 'Confirmed') return record.status === 'CONFIRMED';
//     if (statusFilter === 'Not Confirmed') return record.status === 'NOT_CONFIRMED';
//     return true;
//   });

//   const handleEditClick = (record) => {
//     setEditingId(record.id);
//     setEditFormData({
//       status: record.status,
//       uncertainQuantity: record.uncertainQuantity || '',
//       soldCount: record.soldCount,
//       calculatedRemaining: record.calculatedRemaining,
//       originalQuantity: record.initialQuantity
//     });
//   };

//   // Handle form input changes
//   const handleEditFormChange = (e) => {
//     const { name, value } = e.target;
//     setEditFormData({
//       ...editFormData,
//       [name]: value
//     });
//   };

//   // Handle cancel edit
//   const handleCancelClick = () => {
//     setEditingId(null);
//   };

//   const handleSaveClick = async () => {
//     try {
//       const recordRef = ref(database, `remainingStocks/${editingId}`);
//       const record = stockRecords.find(r => r.id === editingId);
      
//       if (!record) {
//         throw new Error('Record not found');
//       }

//       // Prepare the update data
//       const updateData = {
//         status: editFormData.status,
//         soldCount: parseInt(editFormData.soldCount) || 0,
//         calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
//       };

//       // Handle product quantity updates
//       const productRef = ref(database, `products/${record.barcode}`);

//       if (editFormData.status === 'CONFIRMED') {
//         // If changing to CONFIRMED, update product quantity
//         let newQuantity;

//         if (record.status === 'NOT_CONFIRMED') {
//           // If changing from NOT_CONFIRMED → CONFIRMED, use uncertainQuantity
//           newQuantity = parseInt(editFormData.uncertainQuantity) || 0;
//         } else {
//           // If already CONFIRMED or new, use calculatedRemaining
//           newQuantity = updateData.calculatedRemaining;
//         }

//         await update(productRef, {
//           quantity: newQuantity
//         });

//         // Ensure calculatedRemaining matches the new quantity
//         updateData.calculatedRemaining = newQuantity;
//         updateData.uncertainQuantity = null;

//       } else if (editFormData.status === 'NOT_CONFIRMED') {
//         // If changing from CONFIRMED → NOT_CONFIRMED, restore original quantity
//         if (record.status === 'CONFIRMED') {
//           await update(productRef, {
//             quantity: editFormData.originalQuantity
//           });
//         }
        
//         // Set uncertain quantity if provided
//         updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
//       }

//       await update(recordRef, updateData);
//       setEditingId(null);
//       fetchStockRecords();
//     } catch (error) {
//       console.error('Error updating record:', error);
//       alert('Failed to update record');
//     }
//   };

//   // Handle delete record
//   const handleDeleteClick = async (recordId) => {
//     if (window.confirm('Are you sure you want to delete this record?')) {
//       try {
//         const recordRef = ref(database, `remainingStocks/${recordId}`);
//         await remove(recordRef);
//         fetchStockRecords();
//       } catch (error) {
//         console.error('Error deleting record:', error);
//         alert('Failed to delete record');
//       }
//     }
//   };

//   const saveRemainingStock = async (status, uncertainQuantity = null) => {
//     try {
//       // Create a date key based on the selected date range
//       let dateKey;
//       if (fromDate && toDate) {
//         dateKey = `${fromDate}_to_${toDate}`;
//       } else if (fromDate) {
//         dateKey = `from_${fromDate}`;
//       } else if (toDate) {
//         dateKey = `to_${toDate}`;
//       } else {
//         dateKey = 'all_time';
//       }
      
//       // Calculate remaining quantity
//       const remainingQuantity = status === 'CONFIRMED' 
//         ? scannedProduct.quantity - soldCount 
//         : uncertainQuantity;

//       // Structure: remainingStocks -> dateKey -> individual items
//       const dbRef = ref(database, `remainingStocks/${dateKey}`);
//       const newStockRef = push(dbRef);
      
//       // Get current timestamp
//       const currentTimestamp = new Date().toISOString();
      
//       const stockData = {
//         barcode: scannedProduct.barcode,
//         name: scannedProduct.name,
//         productType: scannedProduct.productType,
//         itemCost: scannedProduct.itemCost,
//         initialQuantity: scannedProduct.quantity,
//         soldCount: soldCount,
//         calculatedRemaining: remainingQuantity,
//         status: status,
//         timestamp: currentTimestamp,
//         dateScanned: currentTimestamp,
//         dateRangeInfo: {
//           fromDate: fromDate || null,
//           toDate: toDate || null,
//           dateKey: dateKey
//         },
//         ...(status === 'NOT_CONFIRMED' && { uncertainQuantity: parseInt(uncertainQuantity) }),
//       };

//       await set(newStockRef, stockData);
      
//       // Update the product quantity in the products table if status is CONFIRMED
//       if (status === 'CONFIRMED') {
//         const productRef = ref(database, `products/${scannedProduct.barcode}`);
//         await update(productRef, {
//           quantity: remainingQuantity
//         });
//       }
      
//       // Update the scanned products set for current range
//       setScannedProductsForCurrentRange(prev => new Set([...prev, scannedProduct.barcode]));
      
//       return true;
//     } catch (error) {
//       console.error('Error saving remaining stock:', error);
//       return false;
//     }
//   };

//   const fetchSoldCount = async (productName, productBarcode) => {
//     const dbRef = ref(database);
//     try {
//       const soldItemsSnapshot = await get(child(dbRef, 'SoldItems'));
//       if (soldItemsSnapshot.exists()) {
//         const soldData = soldItemsSnapshot.val();
//         let count = 0;

//         // Create date range if filters are set
//         let fromDateObj = null;
//         let toDateObj = null;

//         if (fromDate) {
//           fromDateObj = new Date(fromDate);
//           fromDateObj.setHours(0, 0, 0, 0);
//         }

//         if (toDate) {
//           toDateObj = new Date(toDate);
//           toDateObj.setHours(23, 59, 59, 999);
//         }

//         Object.values(soldData).forEach((item) => {
//           // Match by product name or barcode
//           const matchesProduct = 
//             (item.name && item.name.toLowerCase() === productName.toLowerCase()) ||
//             (item.barcode && item.barcode === productBarcode);

//           if (matchesProduct) {
//             // Check date range if filters are applied
//             if (fromDateObj || toDateObj) {
//               const itemDate = new Date(item.dateScanned);
              
//               if (fromDateObj && itemDate < fromDateObj) return;
//               if (toDateObj && itemDate > toDateObj) return;
//             }
            
//             count += parseInt(item.quantity) || 1;
//           }
//         });

//         setSoldCount(count);
//       } else {
//         setSoldCount(0);
//       }
//     } catch (error) {
//       console.error('Error fetching sold count:', error);
//       setSoldCount(0);
//     }
//   };

//   const fetchProductDetails = async (barcode) => {
//     // First check if product is already scanned for current date range
//     const isAlreadyScanned = await checkIfProductAlreadyScanned(barcode);
    
//     if (isAlreadyScanned) {
//       setScanStatus('Item already scanned for this date range!');
//       setTimeout(() => {
//         setScanStatus('Align the barcode within the frame.');
//       }, 3000);
//       return;
//     }

//     const dbRef = ref(database);
//     try {
//       const productSnapshot = await get(child(dbRef, `products/${barcode}`));
//       if (productSnapshot.exists()) {
//         const product = productSnapshot.val();
//         const productData = {
//           barcode,
//           name: product.name,
//           itemCost: product.itemCost,
//           productType: product.productType,
//           quantity: product.quantity,
//         };
//         setScannedProduct(productData);
        
//         // Fetch sold count for this product
//         await fetchSoldCount(product.name, barcode);
        
//         setIsPopupOpen(true);
//       } else {
//         setScanStatus('Product not found in the database.');
//       }
//     } catch (error) {
//       console.error('Error fetching product details:', error);
//       setScanStatus('Error retrieving product information.');
//     }
//   };

//   const handleProductSelect = async (event) => {
//     const selectedBarcode = event.target.value;
//     setSelectedProduct(selectedBarcode);
//     if (selectedBarcode) {
//       await fetchProductDetails(selectedBarcode);
//     }
//   };

//   const clearDateFilters = () => {
//     setFromDate('');
//     setToDate('');
//     setSelectedHistoryRange('');
//   };

//   // Helper function to format date for display
//   const formatDateForDisplay = (dateString) => {
//     if (!dateString) return '';
//     const date = new Date(dateString);
//     return date.toLocaleDateString('en-US', { 
//       year: 'numeric', 
//       month: 'long', 
//       day: 'numeric' 
//     });
//   };

//   // Filter products to exclude already scanned ones for current date range
//   const availableProducts = products.filter(product => 
//     !scannedProductsForCurrentRange.has(product.barcode)
//   );

//   return (
//     <div className="stock-management">
//       {/* Most Recent Date Range Display */}
//       {mostRecentDateRange && (
//         <div className="recent-stock-alert">
//           <h3 className="recent-stock-alert__title">Most Recent Stock Check</h3>
//           <p className="recent-stock-alert__info">
//             <strong>{formatDateRangeKey(mostRecentDateRange.key)}</strong>
//             {' - '}
//             {new Date(mostRecentDateRange.timestamp).toLocaleString()}
//           </p>
//         </div>
//       )}

//       {/* History/Archive Section */}
//       <div className="history-section">
//         <h3 className="history-section__title">Stock Check History</h3>
//         {availableDateRanges.length === 0 ? (
//           <p className="history-section__empty">No stock check history available yet.</p>
//         ) : (
//           <div className="history-selector">
//             <label className="history-selector__label">View Historical Data:</label>
//             <select
//               value={selectedHistoryRange}
//               onChange={(e) => handleHistoryRangeSelect(e.target.value)}
//               className="history-selector__dropdown"
//             >
//               <option value="">Select a date range...</option>
//               {availableDateRanges.map((range) => (
//                 <option key={range.key} value={range.key}>
//                   {formatDateRangeKey(range.key)} - {new Date(range.latestTimestamp).toLocaleDateString()}
//                 </option>
//               ))}
//             </select>
//             {selectedHistoryRange && (
//               <button
//                 onClick={() => {
//                   setSelectedHistoryRange('');
//                   setFromDate('');
//                   setToDate('');
//                 }}
//                 className="history-selector__clear"
//               >
//                 Clear History Selection
//               </button>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Date Range Filters */}
//       <div className="date-filter-section">
//         <h3 className="date-filter-section__title">Date Range for Sold Items Count</h3>
        
//         <div className="date-filter-controls">
//           <div className="date-filter-group">
//             <label className="date-filter-label">From:</label>
//             <input 
//               type="date" 
//               value={fromDate}
//               onChange={(e) => setFromDate(e.target.value)}
//               className="date-filter-input"
//             />
//           </div>

//           <div className="date-filter-group">
//             <label className="date-filter-label">To:</label>
//             <input 
//               type="date" 
//               value={toDate}
//               onChange={(e) => setToDate(e.target.value)}
//               className="date-filter-input"
//             />
//           </div>

//           <button
//             onClick={clearDateFilters}
//             className="date-filter-clear"
//           >
//             Clear Dates
//           </button>
//         </div>

//         {/* Display selected date range */}
//         {(fromDate || toDate) && (
//           <div className="date-filter-display">
//             Selected range: {fromDate ? formatDateForDisplay(fromDate) : 'Beginning'} to {toDate ? formatDateForDisplay(toDate) : 'Today'}
//           </div>
//         )}
//       </div>

//       {/* Action Buttons */}
//       <div className="action-buttons">
//         <button
//           className="action-button action-button--primary"
//           onClick={() => {
//             setShowScanner(true);
//             setShowDropdown(false);
//             setScanStatus('Align the barcode within the frame.');
//           }}
//         >
//           Scan Barcode
//         </button>
//         <button
//           className="action-button action-button--primary"
//           onClick={() => {
//             setShowDropdown(true);
//             setShowScanner(false);
//             setScanStatus('Select a product from the dropdown.');
//           }}
//         >
//           Search for Product
//         </button>
//       </div>

//       {/* Filters Section */}
//       <div className="filter-section">
//         <div className="status-filter">
//           <label htmlFor="status-filter" className="status-filter__label">Filter by Status:</label>
//           <select 
//             id="status-filter"
//             value={statusFilter} 
//             onChange={(e) => setStatusFilter(e.target.value)}
//             className="status-filter__dropdown"
//           >
//             <option value="All">All Status</option>
//             <option value="Confirmed">Confirmed</option>
//             <option value="Not Confirmed">Not Confirmed</option>
//           </select>
//         </div>
//       </div>

//       {/* Scanner Section */}
//       {showScanner && (
//         <div className="scanner-section">
//           <video 
//             ref={scannerRef} 
//             className="scanner-video"
//           ></video>
//           <p className={`scanner-status ${scanStatus.includes('already scanned') ? 'scanner-status--error' : ''}`}>
//             {scanStatus}
//           </p>

//           <div className="zoom-controls">
//             <button 
//               onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}
//               className="zoom-button zoom-button--out"
//             >
//               Zoom Out
//             </button>
//             <input
//               type="range"
//               min="0.5"
//               max="10"
//               step="0.1"
//               value={zoomLevel}
//               onChange={(e) => changeZoom(parseFloat(e.target.value))}
//               className="zoom-slider"
//             />
//             <button 
//               onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}
//               className="zoom-button zoom-button--in"
//             >
//               Zoom In
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Dropdown Section */}
//       {showDropdown && (
//         <div className="product-selector">
//           <select 
//             value={selectedProduct} 
//             onChange={handleProductSelect}
//             className="product-selector__dropdown"
//           >
//             <option value="">Select a product</option>
//             {availableProducts.map((product) => (
//               <option key={product.barcode} value={product.barcode}>
//                 {product.name} ({product.barcode})
//               </option>
//             ))}
//           </select>
//           {availableProducts.length === 0 && (
//             <p className="product-selector__empty">
//               All products have been scanned for this date range.
//             </p>
//           )}
//         </div>
//       )}

//       <button
//         onClick={exportToExcel}
//         className="export-button"
//       >
//         📊 Export to Excel
//       </button>

//       {/* Popup Modal */}
//       {isPopupOpen && scannedProduct && (
//         <div className="product-modal">
//           <div className="product-modal__content">
//             <button
//               onClick={() => {
//                 setIsPopupOpen(false);
//                 setSoldCount(0);
//               }}
//               className="product-modal__close"
//             >
//               ×
//             </button>
//             <h3 className="product-modal__title">
//               {scannedProduct.name}
//             </h3>
            
//             <div className="product-details">
//               <div className="product-detail">
//                 <p className="product-detail__label">Product Type:</p>
//                 <p className="product-detail__value">{scannedProduct.productType}</p>
//               </div>
              
//               <div className="product-detail">
//                 <p className="product-detail__label">Item Cost:</p>
//                 <p className="product-detail__value">${scannedProduct.itemCost}</p>
//               </div>

//               <div className="product-detail">
//                 <p className="product-detail__label">Initial Quantity:</p>
//                 <p className="product-detail__value">{scannedProduct.quantity}</p>
//               </div>

//               <div className="product-stat product-stat--sold">
//                 <p className="product-stat__label">Total Sold:</p>
//                 <p className="product-stat__value">{soldCount}</p>
//               </div>

//               <div className="product-stat product-stat--remaining">
//                 <p className="product-stat__label">Remaining Quantity:</p>
//                 <p className="product-stat__value">{scannedProduct.quantity - soldCount}</p>
//               </div>

//               {/* Action buttons section */}
//               <div className="product-actions">
//                 <button
//                   onClick={async () => {
//                     const saved = await saveRemainingStock('CONFIRMED');
//                     if (saved) {
//                       setIsPopupOpen(false);
//                       setSoldCount(0);
//                     }
//                   }}
//                   className="action-button action-button--confirm"
//                 >
//                   Confirm Existing Quantity
//                 </button>

//                 <div className="uncertain-quantity">
//                   <input
//                     type="number"
//                     value={uncertainQuantity}
//                     onChange={(e) => setUncertainQuantity(e.target.value)}
//                     placeholder="Enter uncertain quantity"
//                     className="uncertain-quantity__input"
//                   />
//                   <button
//                     onClick={async () => {
//                       if (!uncertainQuantity || isNaN(uncertainQuantity)) {
//                         alert('Please enter a valid quantity');
//                         return;
//                       }
                      
//                       const saved = await saveRemainingStock('NOT_CONFIRMED', uncertainQuantity);
//                       if (saved) {
//                         setIsPopupOpen(false);
//                         setSoldCount(0);
//                         setUncertainQuantity('');
//                       } else {
//                         alert('Failed to save uncertain quantity.');
//                       }
//                     }}
//                     className="action-button action-button--uncertain"
//                   >
//                     Save Uncertain Quantity
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       <div className="records-section">
//         <h3 className="records-section__title">
//           Stock Records
//           {(fromDate || toDate) && (
//             <span className="records-section__subtitle">
//               {fromDate && toDate ? `(From ${formatDateForDisplay(fromDate)} to ${formatDateForDisplay(toDate)})` : 
//                fromDate ? `(From ${formatDateForDisplay(fromDate)})` : 
//                `(Up to ${formatDateForDisplay(toDate)})`}
//             </span>
//           )}
//         </h3>
        
//         {!fromDate && !toDate ? (
//           <div className="records-note">
//             <p>
//               <strong>Note:</strong> Please select a date range to view filtered stock records.
//               Currently showing all records.
//             </p>
//           </div>
//         ) : null}

//         {filteredRecords.length === 0 ? (
//           <div className="records-empty">
//             {fromDate || toDate ? (
//               <p>
//                 No stock records found for the selected date range: 
//                 {fromDate ? ` from ${formatDateForDisplay(fromDate)}` : ''}
//                 {toDate ? ` to ${formatDateForDisplay(toDate)}` : ''}
//               </p>
//             ) : (
//               <p>
//                 No stock records found. Scan some products to see records.
//               </p>
//             )}
//           </div>
//         ) : (
//           <table className="records-table">
//             <thead>
//               <tr className="records-table__header">
//                 <th className="records-table__cell">Product</th>
//                 <th className="records-table__cell">Barcode</th>
//                 <th className="records-table__cell">Initial Qty</th>
//                 <th className="records-table__cell">Sold</th>
//                 <th className="records-table__cell">Remaining</th>
//                 <th className="records-table__cell">Status</th>
//                 <th className="records-table__cell">Uncertain Qty</th>
//                 <th className="records-table__cell">Date Scanned</th>
//                 <th className="records-table__cell">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredRecords
//                 .filter(record => {
//                   if (!fromDate && !toDate) return true;
                  
//                   const recordDate = new Date(record.timestamp || record.dateScanned);
//                   const from = fromDate ? new Date(fromDate) : null;
//                   const to = toDate ? new Date(toDate) : null;
                  
//                   if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
//                   if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
//                   return true;
//                 })
//                 .map((record) => (
//                   <tr key={record.id} className={`records-table__row ${editingId === record.id ? 'records-table__row--editing' : ''}`}>
//                     <td className="records-table__cell">{record.name}</td>
//                     <td className="records-table__cell">{record.barcode}</td>
//                     <td className="records-table__cell">{record.initialQuantity}</td>
                    
//                     {editingId === record.id ? (
//                       <>
//                         <td className="records-table__cell">
//                           <input
//                             type="number"
//                             name="soldCount"
//                             value={editFormData.soldCount}
//                             onChange={handleEditFormChange}
//                             className="edit-input"
//                           />
//                         </td>
//                         <td className="records-table__cell">
//                           <input
//                             type="number"
//                             name="calculatedRemaining"
//                             value={editFormData.calculatedRemaining}
//                             onChange={handleEditFormChange}
//                             className="edit-input"
//                           />
//                         </td>
//                         <td className="records-table__cell">
//                           <select
//                             name="status"
//                             value={editFormData.status}
//                             onChange={handleEditFormChange}
//                             className="edit-select"
//                           >
//                             <option value="CONFIRMED">Confirmed</option>
//                             <option value="NOT_CONFIRMED">Not Confirmed</option>
//                           </select>
//                         </td>
//                         <td className="records-table__cell">
//                           {editFormData.status === 'NOT_CONFIRMED' ? (
//                             <input
//                               type="number"
//                               name="uncertainQuantity"
//                               value={editFormData.uncertainQuantity}
//                               onChange={handleEditFormChange}
//                               className="edit-input"
//                             />
//                           ) : (
//                             'N/A'
//                           )}
//                         </td>
//                       </>
//                     ) : (
//                       <>
//                         <td className="records-table__cell">{record.soldCount}</td>
//                         <td className="records-table__cell">{record.calculatedRemaining}</td>
//                         <td className="records-table__cell">
//                           <span className={`status-indicator status-indicator--${record.status === 'CONFIRMED' ? 'confirmed' : 'not-confirmed'}`}>
//                             {record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed'}
//                           </span>
//                         </td>
//                         <td className="records-table__cell">
//                           {record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A'}
//                         </td>
//                       </>
//                     )}
                    
//                     <td className="records-table__cell">
//                       {record.timestamp || 'N/A'}
//                     </td>
                    
//                     <td className="records-table__cell">
//                       {editingId === record.id ? (
//                         <div className="edit-actions">
//                           <button
//                             onClick={handleSaveClick}
//                             className="action-button action-button--save"
//                           >
//                             Save
//                           </button>
//                           <button
//                             onClick={handleCancelClick}
//                             className="action-button action-button--cancel"
//                           >
//                             Cancel
//                           </button>
//                         </div>
//                       ) : (
//                         <div className="record-actions">
//                           <button
//                             onClick={() => handleEditClick(record)}
//                             className="action-button action-button--edit"
//                           >
//                             Edit
//                           </button>
//                           <button
//                             onClick={() => handleDeleteClick(record.id)}
//                             className="action-button action-button--delete"
//                           >
//                             Delete
//                           </button>
//                         </div>
//                       )}
//                     </td>
//                   </tr>
//                 ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RemainingProducts;

// import React, { useState, useEffect, useRef } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase';
// import { ref, get, child, push, set, update, remove } from 'firebase/database';
// import '../CSS/remainingProducts.css';
// import * as XLSX from 'xlsx';

// const RemainingProducts = () => {
//   const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [products, setProducts] = useState([]);
//   const [selectedProduct, setSelectedProduct] = useState('');
//   const [showScanner, setShowScanner] = useState(false);
//   const [showDropdown, setShowDropdown] = useState(false);
//   const [statusFilter, setStatusFilter] = useState('All');
//   const [soldCount, setSoldCount] = useState(0);
//   const [fromDate, setFromDate] = useState('');
//   const [toDate, setToDate] = useState('');
//   const [uncertainQuantity, setUncertainQuantity] = useState('');
//   const [scannedProductsForCurrentRange, setScannedProductsForCurrentRange] = useState(new Set());
//   const [availableDateRanges, setAvailableDateRanges] = useState([]);
//   const [mostRecentDateRange, setMostRecentDateRange] = useState(null);
//   const [selectedHistoryRange, setSelectedHistoryRange] = useState('');
//   const [stockRecords, setStockRecords] = useState([]);
//   const [editingId, setEditingId] = useState(null);
//   const [editFormData, setEditFormData] = useState({
//     status: '',
//     uncertainQuantity: '',
//     soldCount: '',
//     calculatedRemaining: ''
//   });
//   const [isRefreshing, setIsRefreshing] = useState(false);

//   const scannerRef = useRef(null);

//   // Function to refresh all data
//   const handleRefresh = async () => {
//     setIsRefreshing(true);
//     try {
//       // Clear all filters and selections
//       clearAllFilters();
      
//       // Refresh data from database
//       await fetchProducts();
//       await fetchAvailableDateRanges();
//       await fetchStockRecords();
      
//       // Reset UI states
//       setScannedProduct(null);
//       setShowScanner(false);
//       setShowDropdown(false);
//       setSelectedProduct('');
//       setUncertainQuantity('');
//       setScanStatus('Press "Scan Barcode" to start scanning.');
      
//       // Show success message
//       setScanStatus('Data refreshed successfully!');
//       setTimeout(() => {
//         setScanStatus('Press "Scan Barcode" to start scanning.');
//       }, 2000);
      
//     } catch (error) {
//       console.error('Error refreshing data:', error);
//       setScanStatus('Error refreshing data. Please try again.');
//     } finally {
//       setIsRefreshing(false);
//     }
//   };

//   // Function to clear all filters
//   const clearAllFilters = () => {
//     setFromDate('');
//     setToDate('');
//     setSelectedHistoryRange('');
//     setStatusFilter('All');
//     setSelectedProduct('');
//     setScannedProductsForCurrentRange(new Set());
//     setUncertainQuantity('');
//   };

//   // Function to fetch all available date ranges and find the most recent
//   const fetchAvailableDateRanges = async () => {
//     const dbRef = ref(database, 'remainingStocks');
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const dateRanges = [];
//         let mostRecent = null;
//         let mostRecentTimestamp = 0;

//         snapshot.forEach((dateRangeSnapshot) => {
//           const dateRangeKey = dateRangeSnapshot.key;
//           const dateRangeData = dateRangeSnapshot.val();
          
//           let latestTimestamp = 0;
//           Object.values(dateRangeData).forEach(record => {
//             const timestamp = new Date(record.timestamp || record.dateScanned).getTime();
//             if (timestamp > latestTimestamp) {
//               latestTimestamp = timestamp;
//             }
//           });

//           dateRanges.push({
//             key: dateRangeKey,
//             latestTimestamp: latestTimestamp
//           });

//           if (latestTimestamp > mostRecentTimestamp) {
//             mostRecentTimestamp = latestTimestamp;
//             mostRecent = {
//               key: dateRangeKey,
//               timestamp: latestTimestamp
//             };
//           }
//         });

//         dateRanges.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
        
//         setAvailableDateRanges(dateRanges);
//         setMostRecentDateRange(mostRecent);
//       } else {
//         setAvailableDateRanges([]);
//         setMostRecentDateRange(null);
//       }
//     } catch (error) {
//       console.error('Error fetching available date ranges:', error);
//     }
//   };

//   // Function to parse date range key and return formatted string
//   const formatDateRangeKey = (key) => {
//     if (key === 'all_time') return 'All Time';
    
//     if (key.startsWith('from_')) {
//       const fromDate = key.replace('from_', '');
//       return `From ${formatDateForDisplay(fromDate)}`;
//     }
    
//     if (key.startsWith('to_')) {
//       const toDate = key.replace('to_', '');
//       return `Up to ${formatDateForDisplay(toDate)}`;
//     }
    
//     if (key.includes('_to_')) {
//       const [from, to] = key.split('_to_');
//       return `${formatDateForDisplay(from)} to ${formatDateForDisplay(to)}`;
//     }
    
//     return key;
//   };

//   // Function to fetch products
//   const fetchProducts = async () => {
//     const dbRef = ref(database);
//     try {
//       const productsSnapshot = await get(child(dbRef, 'products'));
//       if (productsSnapshot.exists()) {
//         const productsData = productsSnapshot.val();
//         const productsList = Object.keys(productsData).map((barcode) => ({
//           barcode,
//           ...productsData[barcode],
//         }));
//         const sortedProducts = productsList.sort((a, b) => a.name.localeCompare(b.name));
//         setProducts(sortedProducts);
//       }
//     } catch (error) {
//       console.error('Error fetching products:', error);
//     }
//   };

//   // Load available date ranges on component mount
//   useEffect(() => {
//     fetchAvailableDateRanges();
//     fetchProducts();
//   }, [isPopupOpen]);

//   // Handle history range selection
//   const handleHistoryRangeSelect = (rangeKey) => {
//     setSelectedHistoryRange(rangeKey);
    
//     if (rangeKey === 'all_time') {
//       setFromDate('');
//       setToDate('');
//     } else if (rangeKey.startsWith('from_')) {
//       const fromDateVal = rangeKey.replace('from_', '');
//       setFromDate(fromDateVal);
//       setToDate('');
//     } else if (rangeKey.startsWith('to_')) {
//       const toDateVal = rangeKey.replace('to_', '');
//       setFromDate('');
//       setToDate(toDateVal);
//     } else if (rangeKey.includes('_to_')) {
//       const [from, to] = rangeKey.split('_to_');
//       setFromDate(from);
//       setToDate(to);
//     }
//   };

//   // Function to get current date key for tracking scanned items
//   const getCurrentDateKey = () => {
//     if (fromDate && toDate) {
//       return `${fromDate}_to_${toDate}`;
//     } else if (fromDate) {
//       return `from_${fromDate}`;
//     } else if (toDate) {
//       return `to_${toDate}`;
//     } else {
//       return 'all_time';
//     }
//   };

//   const exportToExcel = () => {
//     const recordsToExport = filteredRecords.filter(record => {
//       if (!fromDate && !toDate) return true;
      
//       const recordDate = new Date(record.timestamp || record.dateScanned);
//       const from = fromDate ? new Date(fromDate) : null;
//       const to = toDate ? new Date(toDate) : null;
      
//       if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
//       if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
//       return true;
//     });

//     const excelData = recordsToExport.map(record => ({
//       'Product Name': record.name,
//       'Barcode': record.barcode,
//       'Product Type': record.productType,
//       'Item Cost': record.itemCost,
//       'Initial Quantity': record.initialQuantity,
//       'Sold Count': record.soldCount,
//       'Calculated Remaining': record.calculatedRemaining,
//       'Status': record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed',
//       'Uncertain Quantity': record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A',
//       'Date Scanned': record.timestamp || 'N/A'
//     }));

//     const wb = XLSX.utils.book_new();
//     const ws = XLSX.utils.json_to_sheet(excelData);

//     XLSX.utils.book_append_sheet(wb, ws, 'Stock Records');

//     let filename = 'stock_records';
//     if (fromDate && toDate) {
//       filename += `_${fromDate}_to_${toDate}`;
//     } else if (fromDate) {
//       filename += `_from_${fromDate}`;
//     } else if (toDate) {
//       filename += `_to_${toDate}`;
//     }
    
//     if (statusFilter !== 'All') {
//       filename += `_${statusFilter.toLowerCase().replace(' ', '_')}`;
//     }
    
//     filename += '.xlsx';

//     XLSX.writeFile(wb, filename);
//   };

//   // Function to check if product is already scanned for current date range
//   const checkIfProductAlreadyScanned = async (barcode) => {
//     const dateKey = getCurrentDateKey();
//     const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const stockData = snapshot.val();
//         const isAlreadyScanned = Object.values(stockData).some(item => item.barcode === barcode);
//         return isAlreadyScanned;
//       }
//       return false;
//     } catch (error) {
//       console.error('Error checking if product already scanned:', error);
//       return false;
//     }
//   };

//   // Function to load scanned products for current date range
//   const loadScannedProductsForCurrentRange = async () => {
//     const dateKey = getCurrentDateKey();
//     const dbRef = ref(database, `remainingStocks/${dateKey}`);
    
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const stockData = snapshot.val();
//         const scannedBarcodes = Object.values(stockData).map(item => item.barcode);
//         setScannedProductsForCurrentRange(new Set(scannedBarcodes));
//       } else {
//         setScannedProductsForCurrentRange(new Set());
//       }
//     } catch (error) {
//       console.error('Error loading scanned products:', error);
//       setScannedProductsForCurrentRange(new Set());
//     }
//   };

//   // Load scanned products whenever date range changes
//   useEffect(() => {
//     loadScannedProductsForCurrentRange();
//   }, [fromDate, toDate]);

//   useEffect(() => {
//     if (showScanner) {
//       const codeReader = new BrowserMultiFormatReader();
//       const videoElement = scannerRef.current;

//       codeReader
//         .decodeFromVideoDevice(null, videoElement, (result, error) => {
//           if (result) {
//             setScanStatus('Barcode detected! Processing...');
//             fetchProductDetails(result.text);
//           } else if (error) {
//             setScanStatus('Align the barcode and hold steady.');
//           }
//         }, {
//           tryHarder: true,
//           constraints: {
//             video: {
//               facingMode: 'environment',
//               width: { ideal: 1280 },
//               height: { ideal: 720 },
//             },
//           },
//         })
//         .then(() => {
//           applyZoom();
//         })
//         .catch((err) => console.error('Camera initialization failed:', err));

//       return () => {
//         codeReader.reset();
//       };
//     }
//   }, [zoomLevel, showScanner]);

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
//       }
//     } catch (error) {
//       console.error('Error applying zoom:', error);
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

//   // Function to fetch all stock records
//   const fetchStockRecords = async () => {
//     const dbRef = ref(database, 'remainingStocks');
//     try {
//       const snapshot = await get(dbRef);
//       if (snapshot.exists()) {
//         const records = [];
        
//         snapshot.forEach((dateRangeSnapshot) => {
//           const dateRangeKey = dateRangeSnapshot.key;
//           const dateRangeData = dateRangeSnapshot.val();
          
//           Object.keys(dateRangeData).forEach((recordId) => {
//             const record = dateRangeData[recordId];
//             records.push({
//               id: `${dateRangeKey}/${recordId}`,
//               ...record,
//               dateRange: dateRangeKey,
//               timestamp: record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'
//             });
//           });
//         });
        
//         const sortedRecords = records.sort((a, b) => 
//           new Date(b.timestamp) - new Date(a.timestamp)
//         );
        
//         setStockRecords(sortedRecords);
//       } else {
//         setStockRecords([]);
//       }
//     } catch (error) {
//       console.error('Error fetching stock records:', error);
//       setStockRecords([]);
//     }
//   };

//   // Load stock records on component mount and when saved
//   useEffect(() => {
//     fetchStockRecords();
//   }, [isPopupOpen]);

//   // Filter records based on status filter
//   const filteredRecords = stockRecords.filter(record => {
//     if (statusFilter === 'All') return true;
//     if (statusFilter === 'Confirmed') return record.status === 'CONFIRMED';
//     if (statusFilter === 'Not Confirmed') return record.status === 'NOT_CONFIRMED';
//     return true;
//   });

//   const handleEditClick = (record) => {
//     setEditingId(record.id);
//     setEditFormData({
//       status: record.status,
//       uncertainQuantity: record.uncertainQuantity || '',
//       soldCount: record.soldCount,
//       calculatedRemaining: record.calculatedRemaining,
//       originalQuantity: record.initialQuantity
//     });
//   };

//   // Handle form input changes
//   const handleEditFormChange = (e) => {
//     const { name, value } = e.target;
//     setEditFormData({
//       ...editFormData,
//       [name]: value
//     });
//   };

//   // Handle cancel edit
//   const handleCancelClick = () => {
//     setEditingId(null);
//   };

//   const handleSaveClick = async () => {
//     try {
//       const recordRef = ref(database, `remainingStocks/${editingId}`);
//       const record = stockRecords.find(r => r.id === editingId);
      
//       if (!record) {
//         throw new Error('Record not found');
//       }

//       // Prepare the update data
//       const updateData = {
//         status: editFormData.status,
//         soldCount: parseInt(editFormData.soldCount) || 0,
//         calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
//       };

//       // Handle product quantity updates
//       const productRef = ref(database, `products/${record.barcode}`);

//       if (editFormData.status === 'CONFIRMED') {
//         // If changing to CONFIRMED, update product quantity
//         let newQuantity;

//         if (record.status === 'NOT_CONFIRMED') {
//           // If changing from NOT_CONFIRMED → CONFIRMED, use uncertainQuantity
//           newQuantity = parseInt(editFormData.uncertainQuantity) || 0;
//         } else {
//           // If already CONFIRMED or new, use calculatedRemaining
//           newQuantity = updateData.calculatedRemaining;
//         }

//         await update(productRef, {
//           quantity: newQuantity
//         });

//         // Ensure calculatedRemaining matches the new quantity
//         updateData.calculatedRemaining = newQuantity;
//         updateData.uncertainQuantity = null;

//       } else if (editFormData.status === 'NOT_CONFIRMED') {
//         // If changing from CONFIRMED → NOT_CONFIRMED, restore original quantity
//         if (record.status === 'CONFIRMED') {
//           await update(productRef, {
//             quantity: editFormData.originalQuantity
//           });
//         }
        
//         // Set uncertain quantity if provided
//         updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
//       }

//       await update(recordRef, updateData);
//       setEditingId(null);
//       fetchStockRecords();
//     } catch (error) {
//       console.error('Error updating record:', error);
//       alert('Failed to update record');
//     }
//   };

//   // Handle delete record
//   const handleDeleteClick = async (recordId) => {
//     if (window.confirm('Are you sure you want to delete this record?')) {
//       try {
//         const recordRef = ref(database, `remainingStocks/${recordId}`);
//         await remove(recordRef);
//         fetchStockRecords();
//       } catch (error) {
//         console.error('Error deleting record:', error);
//         alert('Failed to delete record');
//       }
//     }
//   };

//   const saveRemainingStock = async (status, uncertainQuantity = null) => {
//     try {
//       // Create a date key based on the selected date range
//       let dateKey;
//       if (fromDate && toDate) {
//         dateKey = `${fromDate}_to_${toDate}`;
//       } else if (fromDate) {
//         dateKey = `from_${fromDate}`;
//       } else if (toDate) {
//         dateKey = `to_${toDate}`;
//       } else {
//         dateKey = 'all_time';
//       }
      
//       // Calculate remaining quantity
//       const remainingQuantity = status === 'CONFIRMED' 
//         ? scannedProduct.quantity - soldCount 
//         : uncertainQuantity;

//       // Structure: remainingStocks -> dateKey -> individual items
//       const dbRef = ref(database, `remainingStocks/${dateKey}`);
//       const newStockRef = push(dbRef);
      
//       // Get current timestamp
//       const currentTimestamp = new Date().toISOString();
      
//       const stockData = {
//         barcode: scannedProduct.barcode,
//         name: scannedProduct.name,
//         productType: scannedProduct.productType,
//         itemCost: scannedProduct.itemCost,
//         initialQuantity: scannedProduct.quantity,
//         soldCount: soldCount,
//         calculatedRemaining: remainingQuantity,
//         status: status,
//         timestamp: currentTimestamp,
//         dateScanned: currentTimestamp,
//         dateRangeInfo: {
//           fromDate: fromDate || null,
//           toDate: toDate || null,
//           dateKey: dateKey
//         },
//         ...(status === 'NOT_CONFIRMED' && { uncertainQuantity: parseInt(uncertainQuantity) }),
//       };

//       await set(newStockRef, stockData);
      
//       // Update the product quantity in the products table if status is CONFIRMED
//       if (status === 'CONFIRMED') {
//         const productRef = ref(database, `products/${scannedProduct.barcode}`);
//         await update(productRef, {
//           quantity: remainingQuantity
//         });
//       }
      
//       // Update the scanned products set for current range
//       setScannedProductsForCurrentRange(prev => new Set([...prev, scannedProduct.barcode]));
      
//       return true;
//     } catch (error) {
//       console.error('Error saving remaining stock:', error);
//       return false;
//     }
//   };

//   const fetchSoldCount = async (productName, productBarcode) => {
//     const dbRef = ref(database);
//     try {
//       const soldItemsSnapshot = await get(child(dbRef, 'SoldItems'));
//       if (soldItemsSnapshot.exists()) {
//         const soldData = soldItemsSnapshot.val();
//         let count = 0;

//         // Create date range if filters are set
//         let fromDateObj = null;
//         let toDateObj = null;

//         if (fromDate) {
//           fromDateObj = new Date(fromDate);
//           fromDateObj.setHours(0, 0, 0, 0);
//         }

//         if (toDate) {
//           toDateObj = new Date(toDate);
//           toDateObj.setHours(23, 59, 59, 999);
//         }

//         Object.values(soldData).forEach((item) => {
//           // Match by product name or barcode
//           const matchesProduct = 
//             (item.name && item.name.toLowerCase() === productName.toLowerCase()) ||
//             (item.barcode && item.barcode === productBarcode);

//           if (matchesProduct) {
//             // Check date range if filters are applied
//             if (fromDateObj || toDateObj) {
//               const itemDate = new Date(item.dateScanned);
              
//               if (fromDateObj && itemDate < fromDateObj) return;
//               if (toDateObj && itemDate > toDateObj) return;
//             }
            
//             count += parseInt(item.quantity) || 1;
//           }
//         });

//         setSoldCount(count);
//       } else {
//         setSoldCount(0);
//       }
//     } catch (error) {
//       console.error('Error fetching sold count:', error);
//       setSoldCount(0);
//     }
//   };

//   const fetchProductDetails = async (barcode) => {
//     // First check if product is already scanned for current date range
//     const isAlreadyScanned = await checkIfProductAlreadyScanned(barcode);
    
//     if (isAlreadyScanned) {
//       setScanStatus('Item already scanned for this date range!');
//       setTimeout(() => {
//         setScanStatus('Align the barcode within the frame.');
//       }, 3000);
//       return;
//     }

//     const dbRef = ref(database);
//     try {
//       const productSnapshot = await get(child(dbRef, `products/${barcode}`));
//       if (productSnapshot.exists()) {
//         const product = productSnapshot.val();
//         const productData = {
//           barcode,
//           name: product.name,
//           itemCost: product.itemCost,
//           productType: product.productType,
//           quantity: product.quantity,
//         };
//         setScannedProduct(productData);
        
//         // Fetch sold count for this product
//         await fetchSoldCount(product.name, barcode);
        
//         setIsPopupOpen(true);
//       } else {
//         setScanStatus('Product not found in the database.');
//       }
//     } catch (error) {
//       console.error('Error fetching product details:', error);
//       setScanStatus('Error retrieving product information.');
//     }
//   };

//   const handleProductSelect = async (event) => {
//     const selectedBarcode = event.target.value;
//     setSelectedProduct(selectedBarcode);
//     if (selectedBarcode) {
//       await fetchProductDetails(selectedBarcode);
//     }
//   };

//   const clearDateFilters = () => {
//     setFromDate('');
//     setToDate('');
//     setSelectedHistoryRange('');
//   };

//   // Helper function to format date for display
//   const formatDateForDisplay = (dateString) => {
//     if (!dateString) return '';
//     const date = new Date(dateString);
//     return date.toLocaleDateString('en-US', { 
//       year: 'numeric', 
//       month: 'long', 
//       day: 'numeric' 
//     });
//   };

//   // Filter products to exclude already scanned ones for current date range
//   const availableProducts = products.filter(product => 
//     !scannedProductsForCurrentRange.has(product.barcode)
//   );

//   return (
//     <div className="stock-management">
//       {/* Header with Refresh Button */}
//       <div className="stock-header">
//         <h1 className="stock-header__title">Stock Management</h1>
//         <button
//           onClick={handleRefresh}
//           className="refresh-button"
//           disabled={isRefreshing}
//         >
//           {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
//         </button>
//       </div>

//       {/* Most Recent Date Range Display */}
//       {mostRecentDateRange && (
//         <div className="recent-stock-alert">
//           <h3 className="recent-stock-alert__title">Most Recent Stock Check</h3>
//           <p className="recent-stock-alert__info">
//             <strong>{formatDateRangeKey(mostRecentDateRange.key)}</strong>
//             {' - '}
//             {new Date(mostRecentDateRange.timestamp).toLocaleString()}
//           </p>
//         </div>
//       )}

//       {/* History/Archive Section */}
//       <div className="history-section">
//         <h3 className="history-section__title">Stock Check History</h3>
//         {availableDateRanges.length === 0 ? (
//           <p className="history-section__empty">No stock check history available yet.</p>
//         ) : (
//           <div className="history-selector">
//             <label className="history-selector__label">View Historical Data:</label>
//             <select
//               value={selectedHistoryRange}
//               onChange={(e) => handleHistoryRangeSelect(e.target.value)}
//               className="history-selector__dropdown"
//             >
//               <option value="">Select a date range...</option>
//               {availableDateRanges.map((range) => (
//                 <option key={range.key} value={range.key}>
//                   {formatDateRangeKey(range.key)} - {new Date(range.latestTimestamp).toLocaleDateString()}
//                 </option>
//               ))}
//             </select>
//             {selectedHistoryRange && (
//               <button
//                 onClick={() => {
//                   setSelectedHistoryRange('');
//                   setFromDate('');
//                   setToDate('');
//                 }}
//                 className="history-selector__clear"
//               >
//                 Clear History Selection
//               </button>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Date Range Filters */}
//       <div className="date-filter-section">
//         <h3 className="date-filter-section__title">Date Range for Sold Items Count</h3>
        
//         <div className="date-filter-controls">
//           <div className="date-filter-group">
//             <label className="date-filter-label">From:</label>
//             <input 
//               type="date" 
//               value={fromDate}
//               onChange={(e) => setFromDate(e.target.value)}
//               className="date-filter-input"
//             />
//           </div>

//           <div className="date-filter-group">
//             <label className="date-filter-label">To:</label>
//             <input 
//               type="date" 
//               value={toDate}
//               onChange={(e) => setToDate(e.target.value)}
//               className="date-filter-input"
//             />
//           </div>

//           <button
//             onClick={clearDateFilters}
//             className="date-filter-clear"
//           >
//             Clear Dates
//           </button>
//         </div>

//         {/* Display selected date range */}
//         {(fromDate || toDate) && (
//           <div className="date-filter-display">
//             Selected range: {fromDate ? formatDateForDisplay(fromDate) : 'Beginning'} to {toDate ? formatDateForDisplay(toDate) : 'Today'}
//           </div>
//         )}
//       </div>

//       {/* Action Buttons */}
//       <div className="action-buttons">
//         <button
//           className="action-button action-button--primary"
//           onClick={() => {
//             setShowScanner(true);
//             setShowDropdown(false);
//             setScanStatus('Align the barcode within the frame.');
//           }}
//         >
//           Scan Barcode
//         </button>
//         <button
//           className="action-button action-button--primary"
//           onClick={() => {
//             setShowDropdown(true);
//             setShowScanner(false);
//             setScanStatus('Select a product from the dropdown.');
//           }}
//         >
//           Search for Product
//         </button>
//       </div>

//       {/* Filters Section */}
//       <div className="filter-section">
//         <div className="status-filter">
//           <label htmlFor="status-filter" className="status-filter__label">Filter by Status:</label>
//           <select 
//             id="status-filter"
//             value={statusFilter} 
//             onChange={(e) => setStatusFilter(e.target.value)}
//             className="status-filter__dropdown"
//           >
//             <option value="All">All Status</option>
//             <option value="Confirmed">Confirmed</option>
//             <option value="Not Confirmed">Not Confirmed</option>
//           </select>
//         </div>
//       </div>

//       {/* Scanner Section */}
//       {showScanner && (
//         <div className="scanner-section">
//           <video 
//             ref={scannerRef} 
//             className="scanner-video"
//           ></video>
//           <p className={`scanner-status ${scanStatus.includes('already scanned') ? 'scanner-status--error' : ''}`}>
//             {scanStatus}
//           </p>

//           <div className="zoom-controls">
//             <button 
//               onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}
//               className="zoom-button zoom-button--out"
//             >
//               Zoom Out
//             </button>
//             <input
//               type="range"
//               min="0.5"
//               max="10"
//               step="0.1"
//               value={zoomLevel}
//               onChange={(e) => changeZoom(parseFloat(e.target.value))}
//               className="zoom-slider"
//             />
//             <button 
//               onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}
//               className="zoom-button zoom-button--in"
//             >
//               Zoom In
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Dropdown Section */}
//       {showDropdown && (
//         <div className="product-selector">
//           <select 
//             value={selectedProduct} 
//             onChange={handleProductSelect}
//             className="product-selector__dropdown"
//           >
//             <option value="">Select a product</option>
//             {availableProducts.map((product) => (
//               <option key={product.barcode} value={product.barcode}>
//                 {product.name} ({product.barcode})
//               </option>
//             ))}
//           </select>
//           {availableProducts.length === 0 && (
//             <p className="product-selector__empty">
//               All products have been scanned for this date range.
//             </p>
//           )}
//         </div>
//       )}

//       <button
//         onClick={exportToExcel}
//         className="export-button"
//       >
//         📊 Export to Excel
//       </button>

//       {/* Popup Modal */}
//       {isPopupOpen && scannedProduct && (
//         <div className="product-modal">
//           <div className="product-modal__content">
//             <button
//               onClick={() => {
//                 setIsPopupOpen(false);
//                 setSoldCount(0);
//               }}
//               className="product-modal__close"
//             >
//               ×
//             </button>
//             <h3 className="product-modal__title">
//               {scannedProduct.name}
//             </h3>
            
//             <div className="product-details">
//               <div className="product-detail">
//                 <p className="product-detail__label">Product Type:</p>
//                 <p className="product-detail__value">{scannedProduct.productType}</p>
//               </div>
              
//               <div className="product-detail">
//                 <p className="product-detail__label">Item Cost:</p>
//                 <p className="product-detail__value">${scannedProduct.itemCost}</p>
//               </div>

//               <div className="product-detail">
//                 <p className="product-detail__label">Initial Quantity:</p>
//                 <p className="product-detail__value">{scannedProduct.quantity}</p>
//               </div>

//               <div className="product-stat product-stat--sold">
//                 <p className="product-stat__label">Total Sold:</p>
//                 <p className="product-stat__value">{soldCount}</p>
//               </div>

//               <div className="product-stat product-stat--remaining">
//                 <p className="product-stat__label">Remaining Quantity:</p>
//                 <p className="product-stat__value">{scannedProduct.quantity - soldCount}</p>
//               </div>

//               {/* Action buttons section */}
//               <div className="product-actions">
//                 <button
//                   onClick={async () => {
//                     const saved = await saveRemainingStock('CONFIRMED');
//                     if (saved) {
//                       setIsPopupOpen(false);
//                       setSoldCount(0);
//                     }
//                   }}
//                   className="action-button action-button--confirm"
//                 >
//                   Confirm Existing Quantity
//                 </button>

//                 <div className="uncertain-quantity">
//                   <input
//                     type="number"
//                     value={uncertainQuantity}
//                     onChange={(e) => setUncertainQuantity(e.target.value)}
//                     placeholder="Enter uncertain quantity"
//                     className="uncertain-quantity__input"
//                   />
//                   <button
//                     onClick={async () => {
//                       if (!uncertainQuantity || isNaN(uncertainQuantity)) {
//                         alert('Please enter a valid quantity');
//                         return;
//                       }
                      
//                       const saved = await saveRemainingStock('NOT_CONFIRMED', uncertainQuantity);
//                       if (saved) {
//                         setIsPopupOpen(false);
//                         setSoldCount(0);
//                         setUncertainQuantity('');
//                       } else {
//                         alert('Failed to save uncertain quantity.');
//                       }
//                     }}
//                     className="action-button action-button--uncertain"
//                   >
//                     Save Uncertain Quantity
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       <div className="records-section">
//         <h3 className="records-section__title">
//           Stock Records
//           {(fromDate || toDate) && (
//             <span className="records-section__subtitle">
//               {fromDate && toDate ? `(From ${formatDateForDisplay(fromDate)} to ${formatDateForDisplay(toDate)})` : 
//                fromDate ? `(From ${formatDateForDisplay(fromDate)})` : 
//                `(Up to ${formatDateForDisplay(toDate)})`}
//             </span>
//           )}
//         </h3>
        
//         {!fromDate && !toDate ? (
//           <div className="records-note">
//             <p>
//               <strong>Note:</strong> Please select a date range to view filtered stock records.
//               Currently showing all records.
//             </p>
//           </div>
//         ) : null}

//         {filteredRecords.length === 0 ? (
//           <div className="records-empty">
//             {fromDate || toDate ? (
//               <p>
//                 No stock records found for the selected date range: 
//                 {fromDate ? ` from ${formatDateForDisplay(fromDate)}` : ''}
//                 {toDate ? ` to ${formatDateForDisplay(toDate)}` : ''}
//               </p>
//             ) : (
//               <p>
//                 No stock records found. Scan some products to see records.
//               </p>
//             )}
//           </div>
//         ) : (
//           <table className="records-table">
//             <thead>
//               <tr className="records-table__header">
//                 <th className="records-table__cell">Product</th>
//                 <th className="records-table__cell">Barcode</th>
//                 <th className="records-table__cell">Initial Qty</th>
//                 <th className="records-table__cell">Sold</th>
//                 <th className="records-table__cell">Remaining</th>
//                 <th className="records-table__cell">Status</th>
//                 <th className="records-table__cell">Uncertain Qty</th>
//                 <th className="records-table__cell">Date Scanned</th>
//                 <th className="records-table__cell">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredRecords
//                 .filter(record => {
//                   if (!fromDate && !toDate) return true;
                  
//                   const recordDate = new Date(record.timestamp || record.dateScanned);
//                   const from = fromDate ? new Date(fromDate) : null;
//                   const to = toDate ? new Date(toDate) : null;
                  
//                   if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
//                   if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
//                   return true;
//                 })
//                 .map((record) => (
//                   <tr key={record.id} className={`records-table__row ${editingId === record.id ? 'records-table__row--editing' : ''}`}>
//                     <td className="records-table__cell">{record.name}</td>
//                     <td className="records-table__cell">{record.barcode}</td>
//                     <td className="records-table__cell">{record.initialQuantity}</td>
                    
//                     {editingId === record.id ? (
//                       <>
//                         <td className="records-table__cell">
//                           <input
//                             type="number"
//                             name="soldCount"
//                             value={editFormData.soldCount}
//                             onChange={handleEditFormChange}
//                             className="edit-input"
//                           />
//                         </td>
//                         <td className="records-table__cell">
//                           <input
//                             type="number"
//                             name="calculatedRemaining"
//                             value={editFormData.calculatedRemaining}
//                             onChange={handleEditFormChange}
//                             className="edit-input"
//                           />
//                         </td>
//                         <td className="records-table__cell">
//                           <select
//                             name="status"
//                             value={editFormData.status}
//                             onChange={handleEditFormChange}
//                             className="edit-select"
//                           >
//                             <option value="CONFIRMED">Confirmed</option>
//                             <option value="NOT_CONFIRMED">Not Confirmed</option>
//                           </select>
//                         </td>
//                         <td className="records-table__cell">
//                           {editFormData.status === 'NOT_CONFIRMED' ? (
//                             <input
//                               type="number"
//                               name="uncertainQuantity"
//                               value={editFormData.uncertainQuantity}
//                               onChange={handleEditFormChange}
//                               className="edit-input"
//                             />
//                           ) : (
//                             'N/A'
//                           )}
//                         </td>
//                       </>
//                     ) : (
//                       <>
//                         <td className="records-table__cell">{record.soldCount}</td>
//                         <td className="records-table__cell">{record.calculatedRemaining}</td>
//                         <td className="records-table__cell">
//                           <span className={`status-indicator status-indicator--${record.status === 'CONFIRMED' ? 'confirmed' : 'not-confirmed'}`}>
//                             {record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed'}
//                           </span>
//                         </td>
//                         <td className="records-table__cell">
//                           {record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A'}
//                         </td>
//                       </>
//                     )}
                    
//                     <td className="records-table__cell">
//                       {record.timestamp || 'N/A'}
//                     </td>
                    
//                     <td className="records-table__cell">
//                       {editingId === record.id ? (
//                         <div className="edit-actions">
//                           <button
//                             onClick={handleSaveClick}
//                             className="action-button action-button--save"
//                           >
//                             Save
//                           </button>
//                           <button
//                             onClick={handleCancelClick}
//                             className="action-button action-button--cancel"
//                           >
//                             Cancel
//                           </button>
//                         </div>
//                       ) : (
//                         <div className="record-actions">
//                           <button
//                             onClick={() => handleEditClick(record)}
//                             className="action-button action-button--edit"
//                           >
//                             Edit
//                           </button>
//                           <button
//                             onClick={() => handleDeleteClick(record.id)}
//                             className="action-button action-button--delete"
//                           >
//                             Delete
//                           </button>
//                         </div>
//                       )}
//                     </td>
//                   </tr>
//                 ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RemainingProducts;


import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, child, push, set, update, remove } from 'firebase/database';
import '../CSS/remainingProducts.css';
import * as XLSX from 'xlsx';

const RemainingProducts = () => {
  const [scanStatus, setScanStatus] = useState('Ready to scan');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [soldCount, setSoldCount] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [uncertainQuantity, setUncertainQuantity] = useState('');
  const [scannedProductsForCurrentRange, setScannedProductsForCurrentRange] = useState(new Set());
  const [availableDateRanges, setAvailableDateRanges] = useState([]);
  const [mostRecentDateRange, setMostRecentDateRange] = useState(null);
  const [selectedHistoryRange, setSelectedHistoryRange] = useState('');
  const [stockRecords, setStockRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: '',
    uncertainQuantity: '',
    soldCount: '',
    calculatedRemaining: ''
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scannerRef = useRef(null);

  // Function to refresh all data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      clearAllFilters();
      await fetchProducts();
      await fetchAvailableDateRanges();
      await fetchStockRecords();
      setScannedProduct(null);
      setShowScanner(false);
      setShowDropdown(false);
      setSelectedProduct('');
      setUncertainQuantity('');
      setScanStatus('Data refreshed successfully!');
      setTimeout(() => {
        setScanStatus('Ready to scan');
      }, 2000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setScanStatus('Error refreshing data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedHistoryRange('');
    setStatusFilter('All');
    setSelectedProduct('');
    setScannedProductsForCurrentRange(new Set());
    setUncertainQuantity('');
  };

  // Function to fetch all available date ranges and find the most recent
  const fetchAvailableDateRanges = async () => {
    const dbRef = ref(database, 'remainingStocks');
    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const dateRanges = [];
        let mostRecent = null;
        let mostRecentTimestamp = 0;

        snapshot.forEach((dateRangeSnapshot) => {
          const dateRangeKey = dateRangeSnapshot.key;
          const dateRangeData = dateRangeSnapshot.val();
          
          let latestTimestamp = 0;
          Object.values(dateRangeData).forEach(record => {
            const timestamp = new Date(record.timestamp || record.dateScanned).getTime();
            if (timestamp > latestTimestamp) {
              latestTimestamp = timestamp;
            }
          });

          dateRanges.push({
            key: dateRangeKey,
            latestTimestamp: latestTimestamp
          });

          if (latestTimestamp > mostRecentTimestamp) {
            mostRecentTimestamp = latestTimestamp;
            mostRecent = {
              key: dateRangeKey,
              timestamp: latestTimestamp
            };
          }
        });

        dateRanges.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
        setAvailableDateRanges(dateRanges);
        setMostRecentDateRange(mostRecent);
      } else {
        setAvailableDateRanges([]);
        setMostRecentDateRange(null);
      }
    } catch (error) {
      console.error('Error fetching available date ranges:', error);
    }
  };

  // Function to parse date range key and return formatted string
  const formatDateRangeKey = (key) => {
    if (key === 'all_time') return 'All Time';
    if (key.startsWith('from_')) {
      const fromDate = key.replace('from_', '');
      return `From ${formatDateForDisplay(fromDate)}`;
    }
    if (key.startsWith('to_')) {
      const toDate = key.replace('to_', '');
      return `Up to ${formatDateForDisplay(toDate)}`;
    }
    if (key.includes('_to_')) {
      const [from, to] = key.split('_to_');
      return `${formatDateForDisplay(from)} to ${formatDateForDisplay(to)}`;
    }
    return key;
  };

  // Function to fetch products
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
      console.error('Error fetching products:', error);
    }
  };

  // Load available date ranges on component mount
  useEffect(() => {
    fetchAvailableDateRanges();
    fetchProducts();
  }, [isPopupOpen]);

  // Handle history range selection
  const handleHistoryRangeSelect = (rangeKey) => {
    setSelectedHistoryRange(rangeKey);
    if (rangeKey === 'all_time') {
      setFromDate('');
      setToDate('');
    } else if (rangeKey.startsWith('from_')) {
      const fromDateVal = rangeKey.replace('from_', '');
      setFromDate(fromDateVal);
      setToDate('');
    } else if (rangeKey.startsWith('to_')) {
      const toDateVal = rangeKey.replace('to_', '');
      setFromDate('');
      setToDate(toDateVal);
    } else if (rangeKey.includes('_to_')) {
      const [from, to] = rangeKey.split('_to_');
      setFromDate(from);
      setToDate(to);
    }
  };

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

  const exportToExcel = () => {
    const recordsToExport = filteredRecords.filter(record => {
      if (!fromDate && !toDate) return true;
      const recordDate = new Date(record.timestamp || record.dateScanned);
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      if (from && recordDate < from.setHours(0, 0, 0, 0)) return false;
      if (to && recordDate > new Date(to.setHours(23, 59, 59, 999))) return false;
      return true;
    });

    const excelData = recordsToExport.map(record => ({
      'Product Name': record.name,
      'Barcode': record.barcode,
      'Product Type': record.productType,
      'Item Cost': record.itemCost,
      'Initial Quantity': record.initialQuantity,
      'Sold Count': record.soldCount,
      'Calculated Remaining': record.calculatedRemaining,
      'Status': record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed',
      'Uncertain Quantity': record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A',
      'Date Scanned': record.timestamp || 'N/A'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Records');

    let filename = 'stock_records';
    if (fromDate && toDate) filename += `_${fromDate}_to_${toDate}`;
    else if (fromDate) filename += `_from_${fromDate}`;
    else if (toDate) filename += `_to_${toDate}`;
    if (statusFilter !== 'All') filename += `_${statusFilter.toLowerCase().replace(' ', '_')}`;
    filename += '.xlsx';

    XLSX.writeFile(wb, filename);
  };

  // Function to check if product is already scanned for current date range
  const checkIfProductAlreadyScanned = async (barcode) => {
    const dateKey = getCurrentDateKey();
    const dbRef = ref(database, `remainingStocks/${dateKey}`);
    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const stockData = snapshot.val();
        return Object.values(stockData).some(item => item.barcode === barcode);
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
        .then(() => applyZoom())
        .catch((err) => console.error('Camera initialization failed:', err));

      return () => {
        codeReader.reset();
      };
    }
  }, [zoomLevel, showScanner]);

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
      }
    } catch (error) {
      console.error('Error applying zoom:', error);
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
    }
  };

  // Function to fetch all stock records
  const fetchStockRecords = async () => {
    const dbRef = ref(database, 'remainingStocks');
    try {
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const records = [];
        snapshot.forEach((dateRangeSnapshot) => {
          const dateRangeKey = dateRangeSnapshot.key;
          const dateRangeData = dateRangeSnapshot.val();
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
  }, [isPopupOpen]);

  // Filter records based on status filter
  const filteredRecords = stockRecords.filter(record => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Confirmed') return record.status === 'CONFIRMED';
    if (statusFilter === 'Not Confirmed') return record.status === 'NOT_CONFIRMED';
    return true;
  });

  const handleEditClick = (record) => {
    setEditingId(record.id);
    setEditFormData({
      status: record.status,
      uncertainQuantity: record.uncertainQuantity || '',
      soldCount: record.soldCount,
      calculatedRemaining: record.calculatedRemaining,
      originalQuantity: record.initialQuantity
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

  const handleSaveClick = async () => {
    try {
      const recordRef = ref(database, `remainingStocks/${editingId}`);
      const record = stockRecords.find(r => r.id === editingId);
      if (!record) throw new Error('Record not found');

      const updateData = {
        status: editFormData.status,
        soldCount: parseInt(editFormData.soldCount) || 0,
        calculatedRemaining: parseInt(editFormData.calculatedRemaining) || 0
      };

      const productRef = ref(database, `products/${record.barcode}`);

      if (editFormData.status === 'CONFIRMED') {
        let newQuantity = record.status === 'NOT_CONFIRMED' 
          ? parseInt(editFormData.uncertainQuantity) || 0 
          : updateData.calculatedRemaining;

        await update(productRef, { quantity: newQuantity });
        updateData.calculatedRemaining = newQuantity;
        updateData.uncertainQuantity = null;
      } else if (editFormData.status === 'NOT_CONFIRMED') {
        if (record.status === 'CONFIRMED') {
          await update(productRef, { quantity: editFormData.originalQuantity });
        }
        updateData.uncertainQuantity = parseInt(editFormData.uncertainQuantity) || 0;
      }

      await update(recordRef, updateData);
      setEditingId(null);
      fetchStockRecords();
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
        fetchStockRecords();
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Failed to delete record');
      }
    }
  };

  const saveRemainingStock = async (status, uncertainQuantity = null) => {
    try {
      let dateKey;
      if (fromDate && toDate) dateKey = `${fromDate}_to_${toDate}`;
      else if (fromDate) dateKey = `from_${fromDate}`;
      else if (toDate) dateKey = `to_${toDate}`;
      else dateKey = 'all_time';
      
      const remainingQuantity = status === 'CONFIRMED' 
        ? scannedProduct.quantity - soldCount 
        : uncertainQuantity;

      const dbRef = ref(database, `remainingStocks/${dateKey}`);
      const newStockRef = push(dbRef);
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
      
      if (status === 'CONFIRMED') {
        const productRef = ref(database, `products/${scannedProduct.barcode}`);
        await update(productRef, { quantity: remainingQuantity });
      }
      
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

        let fromDateObj = null;
        let toDateObj = null;

        if (fromDate) {
          fromDateObj = new Date(fromDate);
          fromDateObj.setHours(0, 0, 0, 0);
        }

        if (toDate) {
          toDateObj = new Date(toDate);
          toDateObj.setHours(23, 59, 59, 999);
        }

        Object.values(soldData).forEach((item) => {
          const matchesProduct = 
            (item.name && item.name.toLowerCase() === productName.toLowerCase()) ||
            (item.barcode && item.barcode === productBarcode);

          if (matchesProduct) {
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
    setSelectedHistoryRange('');
  };

  // Helper function to format date for display
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Filter products to exclude already scanned ones for current date range
  const availableProducts = products.filter(product => 
    !scannedProductsForCurrentRange.has(product.barcode)
  );

  return (
    <div className="admin-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Stock Management</h1>
        <p className="page-subtitle">Track and manage product inventory</p>
      </div>

      {/* Main Actions Card */}
      <div className="actions-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📊</span>
            Stock Management Tools
          </h2>
          <div className="card-actions">
            <button 
              onClick={handleRefresh}
              className={`btn-secondary ${isRefreshing ? 'refreshing' : ''}`}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <span className="spinner"></span>
                  Refreshing...
                </>
              ) : (
                <>
                  <span className="button-icon">🔄</span>
                  Refresh
                </>
              )}
            </button>
            <button onClick={exportToExcel} className="btn-primary">
              <span className="button-icon">📊</span>
              Export Excel
            </button>
          </div>
        </div>

        <div className="action-buttons-grid">
          <button
            className="action-card"
            onClick={() => {
              setShowScanner(true);
              setShowDropdown(false);
              setScanStatus('Align barcode within frame');
            }}
          >
            <div className="action-card-icon">📷</div>
            <div className="action-card-content">
              <h3 className="action-card-title">Scan Barcode</h3>
              <p className="action-card-description">Use camera to scan product barcodes</p>
            </div>
          </button>

          <button
            className="action-card"
            onClick={() => {
              setShowDropdown(true);
              setShowScanner(false);
              setScanStatus('Select a product from dropdown');
            }}
          >
            <div className="action-card-icon">🔍</div>
            <div className="action-card-content">
              <h3 className="action-card-title">Search Product</h3>
              <p className="action-card-description">Find and select product manually</p>
            </div>
          </button>
        </div>

        {/* Scanner Section */}
        {showScanner && (
          <div className="scanner-section">
            <div className="scanner-container">
              <video ref={scannerRef} className="scanner-video"></video>
              <div className="scanner-overlay">
                <div className="scanner-frame"></div>
                <p className={`scanner-status ${scanStatus.includes('already scanned') ? 'error' : ''}`}>
                  {scanStatus}
                </p>
              </div>
            </div>

            <div className="scanner-controls">
              <button 
                onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}
                className="btn-secondary btn-small"
              >
                🔍 Zoom Out
              </button>
              <div className="zoom-slider-container">
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={zoomLevel}
                  onChange={(e) => changeZoom(parseFloat(e.target.value))}
                  className="zoom-slider"
                />
                <span className="zoom-value">{zoomLevel.toFixed(1)}x</span>
              </div>
              <button 
                onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}
                className="btn-secondary btn-small"
              >
                🔍 Zoom In
              </button>
            </div>
          </div>
        )}

        {/* Dropdown Section */}
        {showDropdown && (
          <div className="product-selector-card">
            <div className="selector-header">
              <h3 className="selector-title">Select Product</h3>
              <span className="selector-count">
                {availableProducts.length} products available
              </span>
            </div>
            <select 
              value={selectedProduct} 
              onChange={handleProductSelect}
              className="product-select"
            >
              <option value="">Choose a product...</option>
              {availableProducts.map((product) => (
                <option key={product.barcode} value={product.barcode}>
                  {product.name} ({product.barcode})
                </option>
              ))}
            </select>
            {availableProducts.length === 0 && (
              <div className="selector-empty">
                <span className="empty-icon">📦</span>
                <p>All products scanned for current date range</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters Card */}
      <div className="filters-card">
        <div className="filters-grid">
          {/* Date Range Filters */}
          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">📅</span>
              Date Range
            </label>
            <div className="date-inputs">
              <div className="date-input-group">
                <label className="date-label">From</label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="date-input-group">
                <label className="date-label">To</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="date-input"
                />
              </div>
            </div>
            {(fromDate || toDate) && (
              <div className="date-range-display">
                <span className="range-label">Selected:</span>
                <span className="range-value">
                  {fromDate ? formatDateForDisplay(fromDate) : 'Beginning'} to {toDate ? formatDateForDisplay(toDate) : 'Today'}
                </span>
                <button onClick={clearDateFilters} className="clear-range-btn">
                  ✕ Clear
                </button>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">📊</span>
              Filter by Status
            </label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="status-select"
            >
              <option value="All">All Status</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Not Confirmed">Not Confirmed</option>
            </select>
          </div>

          {/* History Selector */}
          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">📋</span>
              Stock History
            </label>
            <select
              value={selectedHistoryRange}
              onChange={(e) => handleHistoryRangeSelect(e.target.value)}
              className="history-select"
            >
              <option value="">Select date range...</option>
              {availableDateRanges.map((range) => (
                <option key={range.key} value={range.key}>
                  {formatDateRangeKey(range.key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Most Recent Stock Check */}
        {mostRecentDateRange && (
          <div className="recent-stock-info">
            <div className="recent-icon">⏱️</div>
            <div className="recent-content">
              <div className="recent-title">Most Recent Stock Check</div>
              <div className="recent-details">
                {formatDateRangeKey(mostRecentDateRange.key)} • {new Date(mostRecentDateRange.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {isPopupOpen && scannedProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                <span className="modal-product-icon">📦</span>
                {scannedProduct.name}
              </h3>
              <button
                onClick={() => {
                  setIsPopupOpen(false);
                  setSoldCount(0);
                }}
                className="modal-close"
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="product-details-grid">
                <div className="product-detail">
                  <span className="detail-label">Barcode</span>
                  <span className="detail-value barcode">{scannedProduct.barcode}</span>
                </div>
                <div className="product-detail">
                  <span className="detail-label">Product Type</span>
                  <span className="detail-value">{scannedProduct.productType}</span>
                </div>
                <div className="product-detail">
                  <span className="detail-label">Item Cost</span>
                  <span className="detail-value price">${scannedProduct.itemCost}</span>
                </div>
                <div className="product-detail">
                  <span className="detail-label">Initial Quantity</span>
                  <span className="detail-value quantity">{scannedProduct.quantity}</span>
                </div>
              </div>

              <div className="product-stats">
                <div className="product-stat sold-stat">
                  <div className="stat-label">Total Sold</div>
                  <div className="stat-value">{soldCount}</div>
                </div>
                <div className="product-stat remaining-stat">
                  <div className="stat-label">Remaining Quantity</div>
                  <div className="stat-value">{scannedProduct.quantity - soldCount}</div>
                </div>
              </div>

              <div className="product-actions">
                <button
                  onClick={async () => {
                    const saved = await saveRemainingStock('CONFIRMED');
                    if (saved) {
                      setIsPopupOpen(false);
                      setSoldCount(0);
                    }
                  }}
                  className="btn-success"
                >
                  <span className="button-icon">✅</span>
                  Confirm Quantity
                </button>

                <div className="uncertain-section">
                  <div className="uncertain-input-group">
                    <input
                      type="number"
                      value={uncertainQuantity}
                      onChange={(e) => setUncertainQuantity(e.target.value)}
                      placeholder="Enter uncertain quantity"
                      className="uncertain-input"
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
                        }
                      }}
                      className="btn-warning"
                    >
                      <span className="button-icon">❓</span>
                      Save Uncertain
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Records Table */}
      <div className="table-card">
        <div className="table-header">
          <div className="table-header-left">
            <h2 className="table-title">
              <span className="table-icon">📋</span>
              Stock Records
            </h2>
            <div className="table-stats">
              {filteredRecords.length} records • 
              {statusFilter === 'All' ? ' All status' : ` ${statusFilter}`}
            </div>
          </div>
          <div className="table-header-right">
            <button onClick={clearAllFilters} className="btn-secondary btn-small">
              ✕ Clear Filters
            </button>
          </div>
        </div>

        <div className="table-container">
          {filteredRecords.length === 0 ? (
            <div className="empty-table">
              <div className="empty-icon">📊</div>
              <p className="empty-title">No stock records found</p>
              <p className="empty-description">
                {fromDate || toDate 
                  ? `No records for selected date range${fromDate ? ` from ${formatDateForDisplay(fromDate)}` : ''}${toDate ? ` to ${formatDateForDisplay(toDate)}` : ''}`
                  : 'Scan or search products to create stock records'}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Initial Qty</th>
                  <th>Sold</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Uncertain Qty</th>
                  <th>Date Scanned</th>
                  <th>Actions</th>
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
                    <tr key={record.id} className={editingId === record.id ? 'editing-row' : ''}>
                      <td>
                        <div className="product-cell">
                          <span className="product-name">{record.name}</span>
                          <span className="product-type">{record.productType}</span>
                        </div>
                      </td>
                      <td>
                        <span className="barcode-cell">{record.barcode}</span>
                      </td>
                      <td>
                        <span className="quantity-cell">{record.initialQuantity}</span>
                      </td>
                      
                      {editingId === record.id ? (
                        <>
                          <td>
                            <input
                              type="number"
                              name="soldCount"
                              value={editFormData.soldCount}
                              onChange={handleEditFormChange}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              name="calculatedRemaining"
                              value={editFormData.calculatedRemaining}
                              onChange={handleEditFormChange}
                              className="edit-input"
                            />
                          </td>
                          <td>
                            <select
                              name="status"
                              value={editFormData.status}
                              onChange={handleEditFormChange}
                              className="edit-select"
                            >
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="NOT_CONFIRMED">Not Confirmed</option>
                            </select>
                          </td>
                          <td>
                            {editFormData.status === 'NOT_CONFIRMED' ? (
                              <input
                                type="number"
                                name="uncertainQuantity"
                                value={editFormData.uncertainQuantity}
                                onChange={handleEditFormChange}
                                className="edit-input"
                              />
                            ) : (
                              'N/A'
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <span className="sold-cell">{record.soldCount}</span>
                          </td>
                          <td>
                            <span className="remaining-cell">{record.calculatedRemaining}</span>
                          </td>
                          <td>
                            <span className={`status-badge ${record.status === 'CONFIRMED' ? 'confirmed' : 'not-confirmed'}`}>
                              {record.status === 'CONFIRMED' ? 'Confirmed' : 'Not Confirmed'}
                            </span>
                          </td>
                          <td>
                            <span className="uncertain-cell">
                              {record.status === 'NOT_CONFIRMED' ? record.uncertainQuantity : 'N/A'}
                            </span>
                          </td>
                        </>
                      )}
                      
                      <td>
                        <span className="date-cell">{record.timestamp || 'N/A'}</span>
                      </td>
                      
                      <td>
                        <div className="action-buttons">
                          {editingId === record.id ? (
                            <>
                              <button onClick={handleSaveClick} className="btn-small btn-success">
                                💾 Save
                              </button>
                              <button onClick={handleCancelClick} className="btn-small btn-secondary">
                                ✕ Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleEditClick(record)} className="btn-small btn-primary">
                                ✏️ Edit
                              </button>
                              <button onClick={() => handleDeleteClick(record.id)} className="btn-small btn-danger">
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RemainingProducts;