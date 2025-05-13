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

  // const exportToExcel = async () => {
  //   if (tableData.length === 0) {
  //     alert('No data available to export.');
  //     return;
  //   }

  //   try {
  //     const worksheet = XLSX.utils.json_to_sheet(tableData);
  //     const workbook = XLSX.utils.book_new();
  //     XLSX.utils.book_append_sheet(workbook, worksheet, 'Remaining Stock');

  //     // Format the filename with date range
  //     const fileName = `Remaining_Stock_${formatDateForDB(startDate)}_to_${formatDateForDB(endDate)}.xlsx`;
  //     XLSX.writeFile(workbook, fileName);
  //   } catch (error) {
  //     console.error('Error exporting data:', error);
  //   }
  // };


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

  const handleConfirmQuantity = (useExisting = false) => {
    let finalQuantity = useExisting ? remainingQuantity : parseInt(inputQuantity, 10);

    // if (finalQuantity <= 0 || isNaN(finalQuantity)) {
    //   alert('Please enter a valid quantity.');
    //   return;
    // }

    const dateKey = getCurrentDateKey();
    const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
    
    // Still save to month-based structure for backward compatibility
    const productRef = ref(database, `remainingStock/${monthKey}/${scannedProduct.barcode}`);

    const status = useExisting ? "Confirmed" : "Not Confirmed";

    set(productRef, {
      barcode: scannedProduct.barcode,
      name: scannedProduct.name,
      recordedQuantity: finalQuantity,
      status: status,
      recordedDate: dateKey // Add this to track when the quantity was recorded
    })
      .then(() => {
        console.log('Data saved successfully');
        setRemainingQuantity(finalQuantity);
        setIsPopupOpen(false);
        setInputQuantity('');
        fetchTableData(); // Refresh table data after saving
      })
      .catch((error) => console.error('Error saving data:', error));
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

  const handleSave = async (index) => {
    const row = tableData[index];
    const monthKey = `${endDate.year}-${endDate.month}`;
    
    try {
      // Prepare only the data we want to save
      const updateData = {
        barcode: row.Barcode,
        name: row.Name,
        recordedQuantity: Number(row.Recorded_Quantity) || 0,
        status: row.Status || 'Not Confirmed',
        recordedDate: getCurrentDateKey() // Add a timestamp of when the record was updated
      };
  
      // Only update the specific fields we want
      await set(ref(database, `remainingStock/${monthKey}/${row.Barcode}`), updateData);
      
      setEditingRow(null);
      fetchTableData(); // Refresh to get any server-side calculations
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Failed to save changes. Please try again.');
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

  const handleChange = (index, field, value) => {
    setTableData(prevData => {
      const newData = [...prevData];
      // Create a new object for the row we're editing
      newData[index] = { ...newData[index], [field]: value };
      
      // Only auto-update Remaining_Quantity if Sold_Quantity changes
      if (field === 'Sold_Quantity') {
        newData[index].Remaining_Quantity = newData[index].Initial_Quantity - value;
      }
      
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
    <div className="container">
      <div className="date-range-container">
        <div className="date-selector">
          <h3>FROM:</h3>
          <div className="date-inputs">
            <select 
              value={startDate.day} 
              onChange={(e) => handleStartDateChange('day', e.target.value)}
            >
              {generateDayOptions(startDate.month, startDate.year).map(day => (
                <option key={`start-day-${day}`} value={day}>{day}</option>
              ))}
            </select>
            
            <select 
              value={startDate.month} 
              onChange={(e) => handleStartDateChange('month', e.target.value)}
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
          <h3>TO:</h3>
          <div className="date-inputs">
            <select 
              value={endDate.day} 
              onChange={(e) => handleEndDateChange('day', e.target.value)}
            >
              {generateDayOptions(endDate.month, endDate.year).map(day => (
                <option key={`end-day-${day}`} value={day}>{day}</option>
              ))}
            </select>
            
            <select 
              value={endDate.month} 
              onChange={(e) => handleEndDateChange('month', e.target.value)}
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
        

        <button className="action-button" onClick={exportToExcel}>
          Export as Excel
        </button>
      </div>

      <div className="button-container">
        <button
          className="action-button"
          onClick={() => {
            setShowScanner(true);
            setShowDropdown(false);
            setScanStatus('Align the barcode within the frame.');
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
        >
          Search for Product
        </button>
      </div>

    <div className="date-range-container">
  {/* Existing date range controls */}
  
  <div className="status-filter">
    <label htmlFor="status-filter">Filter by Status:</label>
    <select 
      id="status-filter"
      value={statusFilter} 
      onChange={(e) => setStatusFilter(e.target.value)}
    >
      <option value="All">All Status</option>
      <option value="Confirmed">Confirmed</option>
      <option value="Not Confirmed">Not Confirmed</option>
    </select>
  </div>

  {/* <button className="action-button" onClick={exportToExcel}>
    Export as Excel
  </button> */}

<div className="dropdown-filter">
    <label>
      <input 
        type="checkbox" 
        checked={showOnlyDropdownItems}
        onChange={() => setShowOnlyDropdownItems(!showOnlyDropdownItems)}
      />
      Show only pending products
    </label>
  </div>

  <button className="action-button" onClick={exportToExcel}>
    Export as Excel
  </button>

  {showOnlyDropdownItems && (
    <button className="action-button" onClick={exportDropdownItemsToExcel}>
      Export Pending Products
    </button>
  )}
</div>

      {showScanner && (
        <div className="scanner-container">
          <video ref={scannerRef} className="scanner"></video>
          <p className="status">{scanStatus}</p>

          <div className="zoom-controls">
            <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => changeZoom(parseFloat(e.target.value))}
            />
            <button onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
          </div>
        </div>
      )}

      {showDropdown && (
        <div className="dropdown-container">
          <select value={selectedProduct} onChange={handleProductSelect}>
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.barcode} value={product.barcode}>
                {product.name} ({product.barcode})
              </option>
            ))}
          </select>
        </div>
      )}

      {isPopupOpen && scannedProduct && (
        <div className="modal-overlay">
          <div className="modal-container">
            <button
              className="modal-close-btn"
              onClick={() => {
                setIsPopupOpen(false);
                setInputQuantity('');
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="modal-title">Product Details</h3>
            <div className="modal-content">
              <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
              <p><strong>Name:</strong> {scannedProduct.name}</p>
              <p><strong>Item Cost:</strong> ${scannedProduct.itemCost}</p>
              <p><strong>Product Type:</strong> {scannedProduct.productType}</p>
              <p><strong>Initial Quantity:</strong> {scannedProduct.quantity}</p>
              <p><strong>Remaining Quantity:</strong> {remainingQuantity}</p>
              <button className="modal-btn-confirm" onClick={() => handleConfirmQuantity(true)}>
                Confirm Existing Quantity
              </button>

              <input
                type="number"
                value={inputQuantity}
                onChange={(e) => setInputQuantity(e.target.value)}
                placeholder="Enter new quantity"
              />

              <button className="modal-btn-save" onClick={() => handleConfirmQuantity(false)}>
                Save Quantity
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
      <h2>
  Remaining Stock for {String(startDate.day).padStart(2, '0')}/{String(startDate.month).padStart(2, '0')}/{startDate.year} to {String(endDate.day).padStart(2, '0')}/{String(endDate.month).padStart(2, '0')}/{endDate.year}
</h2>
        <table>
          <thead>
            <tr>
              {['Barcode', 'Name', 'Initial_Quantity', 'Sold_Quantity', 'Remaining_Quantity', 'Recorded_Quantity', 'Status'].map((key) => (
                <th key={key} onClick={() => handleSort(key)} style={{ cursor: 'pointer' }}>
                  {key} {sortConfig.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
           
          <tbody>
            {/* {sortedTableData().map((row, index) => ( */}
              {getFilteredData().map((row, index) => (
              <tr key={`${row.Barcode}-${index}`} className={editingRow === index ? 'editing-row' : ''}>
                <td>{row.Barcode}</td>
                <td>{row.Name}</td>
                <td>{row.Initial_Quantity}</td>
                <td>
                  {editingRow === index ? (
                    <input
                      type="number"
                      min="0"
                      value={row.Sold_Quantity}
                      onChange={(e) => handleChange(index, 'Sold_Quantity', parseInt(e.target.value) || 0)}
                    />
                  ) : (
                    row.Sold_Quantity
                  )}
                </td>
                <td>{row.Remaining_Quantity}</td>
                <td>
                  {editingRow === index ? (
                    <input
                      type="number"
                      min="0"
                      value={row.Recorded_Quantity}
                      onChange={(e) => handleChange(index, 'Recorded_Quantity', parseInt(e.target.value) || 0)}
                    />
                  ) : (
                    row.Recorded_Quantity
                  )}
                </td>
                <td>
                  {editingRow === index ? (
                    <select
                      value={row.Status}
                      onChange={(e) => handleChange(index, 'Status', e.target.value)}
                    >
                      <option value="Not Confirmed">Not Confirmed</option>
                      <option value="Confirmed">Confirmed</option>
                    </select>
                  ) : (
                    row.Status
                  )}
                </td>
                <td>
                  {editingRow === index ? (
                    <>
                      <button onClick={() => handleSave(index)}>Save</button>
                      <button onClick={() => setEditingRow(null)}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => handleEdit(index)}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RemainingProducts;