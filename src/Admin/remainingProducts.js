import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, set, child } from 'firebase/database';
import '../CSS/remainingProducts.css';
import * as XLSX from 'xlsx';

const RemainingProducts = () => {
  const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [remainingQuantity, setRemainingQuantity] = useState(0);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputQuantity, setInputQuantity] = useState('');

  const [statusFilter, setStatusFilter] = useState('All');

  const [excludedProducts, setExcludedProducts] = useState([]);

  const [showOnlyDropdownItems, setShowOnlyDropdownItems] = useState(false);
  
  const scannerRef = useRef(null);

  // Get current date
  const today = new Date();
  
  // New date range states
  const [startDate, setStartDate] = useState({
    day: 1,
    month: today.getMonth() + 1,
    year: today.getFullYear()
  });
  
  const [endDate, setEndDate] = useState({
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear()
  });

  const [tableData, setTableData] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Helper function to get day count in a month
  const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
  };

  // Generate days for select boxes
  const generateDayOptions = (month, year) => {
    const daysInMonth = getDaysInMonth(month, year);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const formatDateForDB = (dateObj) => {
    return `${dateObj.year}-${dateObj.month.toString().padStart(2, '0')}-${dateObj.day.toString().padStart(2, '0')}`;
  };

  const fetchTableData = async () => {
    // Format dates for database query
    const formattedStartDate = formatDateForDB(startDate);
    const formattedEndDate = formatDateForDB(endDate);
    
    // For compatibility with old data structure, also get month-based data
    const startMonthKey = `${startDate.year}-${startDate.month}`;
    const endMonthKey = `${endDate.year}-${endDate.month}`;
    
    try {
      // Get all potentially relevant data
      let allData = {};
      
      // Check for data in current format (will replace with date-based structure)
      const dbRef = ref(database, `remainingStock/${startMonthKey}`);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        allData = { ...allData, ...snapshot.val() };
      }
      
      // If end date is in a different month, also fetch that data
      if (startMonthKey !== endMonthKey) {
        const endMonthRef = ref(database, `remainingStock/${endMonthKey}`);
        const endMonthSnapshot = await get(endMonthRef);
        
        if (endMonthSnapshot.exists()) {
          allData = { ...allData, ...endMonthSnapshot.val() };
        }
      }
      
      if (Object.keys(allData).length === 0) {
        alert('No data available for the selected date range.');
        setTableData([]);
        return;
      }

      const formattedData = await Promise.all(Object.values(allData).map(async (product) => {
        const productRef = ref(database, `products/${product.barcode}`);
        const productSnapshot = await get(productRef);
        const initialQuantity = productSnapshot.exists() ? productSnapshot.val().quantity : 0;

        // Get sales data
        const soldItemsSnapshot = await get(ref(database, 'SoldItems'));
        let totalSoldQuantity = 0;

        if (soldItemsSnapshot.exists()) {
          const soldItemsData = soldItemsSnapshot.val();
          
          // Calculate sold quantity within date range
          Object.values(soldItemsData).forEach((item) => {
            // Check if the item has a date and it falls within our range
            if (item.barcode === product.barcode && item.date) {
              const itemDate = new Date(item.date);
              const startDateObj = new Date(startDate.year, startDate.month - 1, startDate.day);
              const endDateObj = new Date(endDate.year, endDate.month - 1, endDate.day);
              
              if (itemDate >= startDateObj && itemDate <= endDateObj) {
                totalSoldQuantity += item.quantity || 0;
              }
            } else if (item.barcode === product.barcode && !item.date) {
              // Handle legacy data without dates
              totalSoldQuantity += item.quantity || 0;
            }
          });
        }

        const remainingQuantity = initialQuantity - totalSoldQuantity;

        return {
          Barcode: product.barcode,
          Name: product.name,
          Initial_Quantity: initialQuantity,
          Sold_Quantity: totalSoldQuantity,
          Remaining_Quantity: remainingQuantity,
          Recorded_Quantity: product.recordedQuantity,
          Status: product.status || 'Not Confirmed',
        };
      }));

      const sortedData = formattedData.sort((a, b) => a.Name.localeCompare(b.Name));
      setTableData(sortedData);
    } catch (error) {
      console.error('Error fetching table data:', error);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [startDate, endDate]);

  const exportToExcel = async () => {
    const filteredData = getFilteredData();
    
    if (filteredData.length === 0) {
      alert('No data available to export.');
      return;
    }
  
    try {
      const worksheet = XLSX.utils.json_to_sheet(filteredData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Remaining Stock');
  
      // Format the filename with date range and status filter
      let fileName = `Remaining_Stock_${formatDateForDB(startDate)}_to_${formatDateForDB(endDate)}`;
      if (statusFilter !== 'All') {
        fileName += `_${statusFilter.replace(' ', '_')}`;
      }
      fileName += '.xlsx';
      
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const getCurrentDateKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  };

  // const handleConfirmQuantity = (useExisting = false) => {
  //   let finalQuantity = useExisting ? remainingQuantity : parseInt(inputQuantity, 10);

  //   // Validation check removed to allow zero quantity
  //   if (isNaN(finalQuantity)) {
  //     alert('Please enter a valid quantity.');
  //     return;
  //   }

  //   const dateKey = getCurrentDateKey();
  //   const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
    
  //   // Still save to month-based structure for backward compatibility
  //   const productRef = ref(database, `remainingStock/${monthKey}/${scannedProduct.barcode}`);

  //   const status = useExisting ? "Confirmed" : "Not Confirmed";

  //   set(productRef, {
  //     barcode: scannedProduct.barcode,
  //     name: scannedProduct.name,
  //     recordedQuantity: finalQuantity,
  //     status: status,
  //     recordedDate: dateKey // Add this to track when the quantity was recorded
  //   })
  //     .then(() => {
  //       console.log('Data saved successfully');
  //       setRemainingQuantity(finalQuantity);
  //       setIsPopupOpen(false);
  //       setInputQuantity('');
  //       fetchTableData(); // Refresh table data after saving
  //     })
  //     .catch((error) => console.error('Error saving data:', error));
  // };

  // const handleConfirmQuantity = async (useExisting = false) => {
  //   let finalQuantity = useExisting ? remainingQuantity : parseInt(inputQuantity, 10);
  
  //   if (isNaN(finalQuantity)) {
  //     alert('Please enter a valid quantity.');
  //     return;
  //   }
  
  //   const dateKey = getCurrentDateKey();
  //   const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
  //   const productRef = ref(database, `remainingStock/${monthKey}/${scannedProduct.barcode}`);
  //   const soldItemsRef = ref(database, `SoldItems/${dateKey}_${scannedProduct.barcode}`);
  //   const productMainRef = ref(database, `products/${scannedProduct.barcode}`);
  
  //   try {
  //     // Get product's initial quantity
  //     const productSnapshot = await get(productMainRef);
  //     if (!productSnapshot.exists()) {
  //       alert('Product not found.');
  //       return;
  //     }
  
  //     const product = productSnapshot.val();
  //     const initialQuantity = product.quantity;
  
  //     const newSoldQuantity = initialQuantity - finalQuantity;
  
  //     // Update sold item
  //     await set(soldItemsRef, {
  //       barcode: scannedProduct.barcode,
  //       name: scannedProduct.name,
  //       quantity: newSoldQuantity,
  //       date: dateKey
  //     });
  
  //     // Update remaining stock
  //     await set(productRef, {
  //       barcode: scannedProduct.barcode,
  //       name: scannedProduct.name,
  //       recordedQuantity: finalQuantity,
  //       status: useExisting ? 'Confirmed' : 'Not Confirmed',
  //       recordedDate: dateKey
  //     });
  
  //     console.log('Data saved successfully');
  //     setRemainingQuantity(finalQuantity);
  //     setIsPopupOpen(false);
  //     setInputQuantity('');
  //     fetchTableData(); // Refresh table data after saving
  //   } catch (error) {
  //     console.error('Error saving data:', error);
  //   }
  // };

  const handleConfirmQuantity = async (useExisting = false) => {
    let finalQuantity;
    
    if (useExisting) {
      // Use the calculated remaining quantity from the product
      finalQuantity = scannedProduct.remainingQuantity;
    } else {
      // Use the input quantity that was set before calling this function
      finalQuantity = remainingQuantity;
    }
  
    const dateKey = getCurrentDateKey();
    const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
    const productRef = ref(database, `remainingStock/${monthKey}/${scannedProduct.barcode}`);
    const soldItemsRef = ref(database, `SoldItems/${dateKey}_${scannedProduct.barcode}`);
    const productMainRef = ref(database, `products/${scannedProduct.barcode}`);
  
    try {
      // Get product's initial quantity
      const productSnapshot = await get(productMainRef);
      if (!productSnapshot.exists()) {
        alert('Product not found.');
        return;
      }
  
      const product = productSnapshot.val();
      const initialQuantity = product.quantity;
  
      const newSoldQuantity = initialQuantity - finalQuantity;
  
      // Update sold item
      await set(soldItemsRef, {
        barcode: scannedProduct.barcode,
        name: scannedProduct.name,
        quantity: newSoldQuantity,
        date: dateKey
      });
  
      // Update remaining stock
      await set(productRef, {
        barcode: scannedProduct.barcode,
        name: scannedProduct.name,
        recordedQuantity: finalQuantity,
        status: useExisting ? 'Confirmed' : 'Not Confirmed',
        recordedDate: dateKey
      });
  
      console.log('Data saved successfully');
      setIsPopupOpen(false);
      setInputQuantity('');
      fetchTableData(); // Refresh table data after saving
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

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
            console.warn('Barcode detection error:', error);
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
          let productsList = Object.keys(productsData).map((barcode) => ({
            barcode,
            ...productsData[barcode],
          }));
  
          // Filter out excluded products for the current month
          productsList = productsList.filter(product => 
            !excludedProducts.includes(product.barcode)
          );
  
          const sortedProducts = productsList.sort((a, b) => a.name.localeCompare(b.name));
          setProducts(sortedProducts);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
  
    fetchProducts();
  }, [excludedProducts]);

  useEffect(() => {
    if (tableData.length > 0) {
      const currentMonthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
      const startMonthKey = `${startDate.year}-${startDate.month}`;
      
      // Only update excluded products if we're looking at current month data
      if (startMonthKey === currentMonthKey) {
        const excluded = tableData
          .filter(row => row.Status === 'Confirmed' || row.Status === 'Not Confirmed')
          .map(row => row.Barcode);
        
        setExcludedProducts(excluded);
      }
    }
  }, [tableData, startDate.month, startDate.year]);

  useEffect(() => {
    const checkForNewMonth = () => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // If it's a new month, reset the excluded products
      if (currentMonth !== startDate.month || currentYear !== startDate.year) {
        setExcludedProducts([]);
      }
    };
  
    // Check every hour (you can adjust this interval)
    const interval = setInterval(checkForNewMonth, 60 * 60 * 1000);
    
    // Also check immediately when component mounts
    checkForNewMonth();
    
    return () => clearInterval(interval);
  }, [startDate.month, startDate.year]);

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
      const productSnapshot = await get(child(dbRef, `products/${barcode}`));
      if (productSnapshot.exists()) {
        const product = productSnapshot.val();

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

        const remaining = product.quantity - totalSoldQuantity;

        setScannedProduct({
          barcode,
          name: product.name,
          itemCost: product.itemCost,
          productType: product.productType,
          quantity: product.quantity,
          remainingQuantity: remaining,
        });
        setRemainingQuantity(remaining);
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

  const handleEdit = (index) => {
    setEditingRow(index);
  };

  // const handleSave = async (index) => {
  //   try {
  //     const row = tableData[index];
  //     const monthKey = `${endDate.year}-${endDate.month}`;
      
  //     // Reset editingRow before making database calls to prevent double-saving
  //     setEditingRow(null);
      
  //     // Prepare only the data we want to save
  //     const updateData = {
  //       barcode: row.Barcode,
  //       name: row.Name,
  //       recordedQuantity: Number(row.Recorded_Quantity) || 0,
  //       status: row.Status || 'Not Confirmed',
  //       recordedDate: getCurrentDateKey() // Add a timestamp of when the record was updated
  //     };
    
  //     // Only update the specific fields we want
  //     await set(ref(database, `remainingStock/${monthKey}/${row.Barcode}`), updateData);
      
  //     // Refresh to get any server-side calculations
  //     fetchTableData();
  //     // alert('Changes saved successfully!');
  //   } catch (error) {
  //     console.error('Error saving data:', error);
  //     alert('Failed to save changes. Please try again.');
  //     // Reset editing row if save fails
  //     setEditingRow(null);
  //   }
  // };

  const handleSave = async (index) => {
    try {
      const row = tableData[index];
      const monthKey = `${endDate.year}-${endDate.month}`;
      
      // Reset editingRow before making database calls to prevent double-saving
      setEditingRow(null);
      
      // Prepare the data to save - make sure Status is properly mapped
      const updateData = {
        barcode: row.Barcode,
        name: row.Name,
        recordedQuantity: Number(row.Recorded_Quantity) || 0,
        status: row.Status || 'Not Confirmed', // This should now work properly
        recordedDate: getCurrentDateKey()
      };
    
      console.log('Saving data:', updateData); // Add this for debugging
    
      // Update the database
      await set(ref(database, `remainingStock/${monthKey}/${row.Barcode}`), updateData);
      
      // Refresh the table data
      await fetchTableData();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save changes. Please try again.');
      // Reset editing row if save fails
      setEditingRow(null);
    }
  };

  const getFilteredData = () => {
    let filteredData = sortedTableData();
    
    if (statusFilter !== 'All') {
      filteredData = filteredData.filter(row => row.Status === statusFilter);
    }

    // Add filter for dropdown items
    if (showOnlyDropdownItems) {
      filteredData = filteredData.filter(row => !excludedProducts.includes(row.Barcode));
    }
    
    return filteredData;
  };

  // Add a new export function for dropdown items
  const exportDropdownItemsToExcel = async () => {
    // Get all products that are still in dropdown (not excluded)
    const dropdownItems = products.filter(product => 
      !excludedProducts.includes(product.barcode)
    ).map(product => ({
      Barcode: product.barcode,
      Name: product.name,
      Status: 'Pending' // These are by definition not confirmed/not confirmed
    }));

    if (dropdownItems.length === 0) {
      alert('No pending products available to export.');
      return;
    }

    try {
      const worksheet = XLSX.utils.json_to_sheet(dropdownItems);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Products');

      const fileName = `Pending_Products_${formatDateForDB(startDate)}_to_${formatDateForDB(endDate)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting pending products:', error);
    }
  };

  // const handleChange = (index, field, value) => {
  //   setTableData(prevData => {
  //     const newData = [...prevData];
  //     // Create a new object for the row we're editing
  //     newData[index] = { ...newData[index], [field]: value };
      
  //     // Only auto-update Remaining_Quantity if Sold_Quantity changes
  //     if (field === 'Sold_Quantity') {
  //       newData[index].Remaining_Quantity = newData[index].Initial_Quantity - value;
  //     }
      
  //     return newData;
  //   });
  // };

  // const handleChange = (index, field, value) => {
  //   setTableData(prevData => {
  //     const newData = [...prevData];
  //     newData[index] = { ...newData[index], [field]: value };
      
  //     // Auto-update logic for quantities
  //     if (field === 'Sold_Quantity') {
  //       newData[index].Remaining_Quantity = newData[index].Initial_Quantity - value;
  //     }
      
  //     return newData;
  //   });
  // };

  const handleChange = (index, field, value) => {
    setTableData(prevData => {
      const newData = [...prevData];
      const updatedRow = { ...newData[index] };
      
      // Update the specific field
      updatedRow[field] = value;
      
      // Auto-update logic for quantities only
      if (field === 'Sold_Quantity') {
        updatedRow.Remaining_Quantity = updatedRow.Initial_Quantity - parseInt(value);
      }
      
      newData[index] = updatedRow;
      return newData;
    });
  };


  const handleStartDateChange = (field, value) => {
    const newDate = { ...startDate, [field]: parseInt(value) };
    
    // Ensure day is valid for the month/year
    const maxDays = getDaysInMonth(newDate.month, newDate.year);
    if (newDate.day > maxDays) {
      newDate.day = maxDays;
    }
    
    setStartDate(newDate);
  };

  const handleEndDateChange = (field, value) => {
    const newDate = { ...endDate, [field]: parseInt(value) };
    
    // Ensure day is valid for the month/year
    const maxDays = getDaysInMonth(newDate.month, newDate.year);
    if (newDate.day > maxDays) {
      newDate.day = maxDays;
    }
    
    setEndDate(newDate);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedTableData = () => {
    if (!sortConfig.key) return tableData;
  
    return [...tableData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  return (
    <div className="container" style={{ 
      padding: '20px', 
      maxWidth: '95%', 
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Date Range Section */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '20px',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div className="date-selector">
            <h3 style={{ margin: '0 0 8px 0' }}>FROM:</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select 
                value={startDate.day} 
                onChange={(e) => handleStartDateChange('day', e.target.value)}
                style={{ fontSize: '1rem', padding: '8px', minWidth: '80px' }}
              >
                {generateDayOptions(startDate.month, startDate.year).map(day => (
                  <option key={`start-day-${day}`} value={day}>{day}</option>
                ))}
              </select>
              
              <select 
                value={startDate.month} 
                onChange={(e) => handleStartDateChange('month', e.target.value)}
                style={{ fontSize: '1rem', padding: '8px', minWidth: '120px' }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={`start-month-${i + 1}`} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              
              <select 
                value={startDate.year} 
                onChange={(e) => handleStartDateChange('year', e.target.value)}
                style={{ fontSize: '1rem', padding: '8px', minWidth: '100px' }}
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const year = today.getFullYear() - i;
                  return (
                    <option key={`start-year-${year}`} value={year}>{year}</option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="date-selector">
            <h3 style={{ margin: '0 0 8px 0' }}>TO:</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select 
                value={endDate.day} 
                onChange={(e) => handleEndDateChange('day', e.target.value)}
                style={{ fontSize: '1rem', padding: '8px', minWidth: '80px' }}
              >
                {generateDayOptions(endDate.month, endDate.year).map(day => (
                  <option key={`end-day-${day}`} value={day}>{day}</option>
                ))}
              </select>
              
              <select 
                value={endDate.month} 
                onChange={(e) => handleEndDateChange('month', e.target.value)}
                style={{ fontSize: '1rem', padding: '8px', minWidth: '120px' }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={`end-month-${i + 1}`} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              
              <select 
                value={endDate.year} 
                onChange={(e) => handleEndDateChange('year', e.target.value)}
                style={{ fontSize: '1rem', padding: '8px', minWidth: '100px' }}
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const year = today.getFullYear() - i;
                  return (
                    <option key={`end-year-${year}`} value={year}>{year}</option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        <button 
          className="action-button" 
          onClick={exportToExcel}
          style={{ 
            fontSize: '1rem', 
            padding: '10px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Export as Excel
        </button>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            checked={showOnlyDropdownItems}
            onChange={() => setShowOnlyDropdownItems(!showOnlyDropdownItems)}
            style={{ transform: 'scale(1.3)', marginRight: '8px' }}
          />
          <label style={{ fontSize: '1rem' }}>Show only pending products</label>
        </div>

        {showOnlyDropdownItems && (
          <button 
            className="action-button" 
            onClick={exportDropdownItemsToExcel}
            style={{ 
              fontSize: '1rem', 
              padding: '10px 15px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            Export Pending Products
          </button>
        )}
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
            textAlign: 'center'
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
            {products.map((product) => (
              <option key={product.barcode} value={product.barcode}>
                {product.name} ({product.barcode})
              </option>
            ))}
          </select>
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
          setInputQuantity('');
        }}
        style={{ 
          position: 'absolute',
          top: '10px',
          right: '10px',
          fontSize: '1.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        ×
      </button>
      <h3 style={{ fontSize: '1.5rem', margin: '0 0 20px 0' }}>Product Details</h3>
      <div style={{ fontSize: '1.1rem', marginBottom: '20px' }}>
        <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
        <p><strong>Name:</strong> {scannedProduct.name}</p>
        <p><strong>Item Cost:</strong> ${scannedProduct.itemCost}</p>
        <p><strong>Product Type:</strong> {scannedProduct.productType}</p>
        <p><strong>Initial Quantity:</strong> {scannedProduct.quantity}</p>
        <p><strong>Calculated Remaining Quantity:</strong> {scannedProduct.remainingQuantity}</p>
        {remainingQuantity !== scannedProduct.remainingQuantity && (
          <p><strong>Current Recorded Quantity:</strong> {remainingQuantity}</p>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button 
          onClick={() => {
            setRemainingQuantity(scannedProduct.remainingQuantity);
            handleConfirmQuantity(true);
          }}
          style={{ 
            fontSize: '1rem',
            padding: '12px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Confirm Calculated Quantity ({scannedProduct.remainingQuantity})
        </button>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            value={inputQuantity}
            onChange={(e) => setInputQuantity(e.target.value)}
            placeholder="Enter new quantity"
            style={{ 
              flex: 1,
              fontSize: '1rem',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          <button 
            onClick={() => {
              if (inputQuantity === '') {
                alert('Please enter a quantity');
                return;
              }
              const newQuantity = parseInt(inputQuantity, 10);
              if (isNaN(newQuantity)) {
                alert('Please enter a valid number');
                return;
              }
              setRemainingQuantity(newQuantity);
              handleConfirmQuantity(false);
            }}
            style={{ 
              fontSize: '1rem',
              padding: '12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Save New Quantity
          </button>
        </div>
      </div>
    </div>
  </div>
)}

     {/* Table Section */}
     <div style={{ 
  width: '100%',
  overflowX: 'auto',
  marginTop: '20px',
  height: '70vh', // Fixed height
  overflowY: 'auto' // Vertical scroll
}}>
  <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
    Remaining Stock for {String(startDate.day).padStart(2, '0')}/{String(startDate.month).padStart(2, '0')}/{startDate.year} to {String(endDate.day).padStart(2, '0')}/{String(endDate.month).padStart(2, '0')}/{endDate.year}
  </h2>
  
  <div style={{ 
    width: '100%',
    overflow: 'auto',
    border: '1px solid #ddd',
    borderRadius: '8px'
  }}>
    <table style={{ 
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.95rem'
    }}>
      <thead>
        <tr style={{ backgroundColor: '#f2f2f2', position: 'sticky', top: 0 }}>
          <th 
            onClick={() => handleSort('Barcode')}
            style={{ 
              padding: '12px 8px',
              textAlign: 'left',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Barcode {sortConfig.key === 'Barcode' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>
          <th 
            onClick={() => handleSort('Name')}
            style={{ 
              padding: '12px 8px',
              textAlign: 'left',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer'
            }}
          >
            Name {sortConfig.key === 'Name' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>
          <th 
            onClick={() => handleSort('Initial_Quantity')}
            style={{ 
              padding: '12px 8px',
              textAlign: 'right',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Initial Quantity {sortConfig.key === 'Initial_Quantity' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>
          <th 
            onClick={() => handleSort('Sold_Quantity')}
            style={{ 
              padding: '12px 8px',
              textAlign: 'right',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Sold Quantity {sortConfig.key === 'Sold_Quantity' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>
          <th 
            onClick={() => handleSort('Remaining_Quantity')}
            style={{ 
              padding: '12px 8px',
              textAlign: 'right',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Remaining Quantity {sortConfig.key === 'Remaining_Quantity' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>
          <th 
            onClick={() => handleSort('Recorded_Quantity')}
            style={{ 
              padding: '12px 8px',
              textAlign: 'right',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Recorded Quantity {sortConfig.key === 'Recorded_Quantity' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>
          <th 
            onClick={() => handleSort('Status')}
            style={{ 
              padding: '12px 8px',
              textAlign: 'left',
              borderBottom: '1px solid #ddd',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Status {sortConfig.key === 'Status' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>
          <th style={{ 
            padding: '12px 8px',
            textAlign: 'center',
            borderBottom: '1px solid #ddd',
            whiteSpace: 'nowrap'
          }}>
            Actions
          </th>
        </tr>
      </thead>
       
      <tbody>
        {getFilteredData().map((row, index) => (
          <tr 
            key={`${row.Barcode}-${index}`} 
            style={{ 
              borderBottom: '1px solid #ddd',
              backgroundColor: editingRow === index ? '#f0f7ff' : 'transparent',
              transition: 'background-color 0.2s'
            }}
          >
            <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', textAlign: 'left' }}>{row.Barcode}</td>
            <td style={{ padding: '10px 8px', textAlign: 'left' }}>{row.Name}</td>
            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{row.Initial_Quantity}</td>
            <td style={{ padding: '10px 8px', textAlign: 'right' }}>
              {editingRow === index ? (
                <input
                  type="number"
                  min="0"
                  value={row.Sold_Quantity}
                  onChange={(e) => handleChange(index, 'Sold_Quantity', parseInt(e.target.value) || 0)}
                  style={{ 
                    width: '80px',
                    padding: '5px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    textAlign: 'right'
                  }}
                />
              ) : (
                row.Sold_Quantity
              )}
            </td>
            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{row.Remaining_Quantity}</td>
            <td style={{ padding: '10px 8px', textAlign: 'right' }}>
              {editingRow === index ? (
                <input
                  type="number"
                  min="0"
                  value={row.Recorded_Quantity}
                  onChange={(e) => handleChange(index, 'Recorded_Quantity', parseInt(e.target.value) || 0)}
                  style={{ 
                    width: '80px',
                    padding: '5px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    textAlign: 'right'
                  }}
                />
              ) : (
                row.Recorded_Quantity
              )}
            </td>
            <td style={{ padding: '10px 8px', textAlign: 'left' }}>
              {editingRow === index ? (

<select
  value={row.Status}
  onChange={(e) => handleChange(index, 'Status', e.target.value)}
  style={{ 
    padding: '5px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    minWidth: '120px'
  }}
>
  <option value="Not Confirmed">Not Confirmed</option>
  <option value="Confirmed">Confirmed</option>
</select>
              ) : (
                row.Status
              )}
            </td>
            <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
              {editingRow === index ? (
                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                  <button 
                    onClick={() => handleSave(index)}
                    style={{ 
                      padding: '5px 10px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditingRow(null)}
                    style={{ 
                      padding: '5px 10px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleEdit(index)}
                  style={{ 
                    padding: '5px 10px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  </div>
  </div>
  );
};

export default RemainingProducts;