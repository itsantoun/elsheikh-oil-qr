import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, child, push, set, update, remove, query, orderByChild, startAt, endAt } from 'firebase/database';
import '../CSS/remainingProducts.css';
import * as XLSX from 'xlsx';

const RemainingProducts = () => {
  // UI State
  const [scanStatus, setScanStatus] = useState('Ready to scan');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculation State
  const [soldCount, setSoldCount] = useState(0);
  const [uncertainQuantity, setUncertainQuantity] = useState('');
  
  // CORRECT: Date Range for Sold Items
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Stock Records State
  const [scannedProductsForCurrentRange, setScannedProductsForCurrentRange] = useState(new Set());
  const [availableDateRanges, setAvailableDateRanges] = useState([]);
  const [mostRecentDateRange, setMostRecentDateRange] = useState(null);
  const [selectedHistoryRange, setSelectedHistoryRange] = useState('');
  const [stockRecords, setStockRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    status: '',
    uncertainQuantity: '',
    soldCount: '',
    calculatedRemaining: ''
  });

  const scannerRef = useRef(null);

  // ===============================
  // DATE HANDLING FUNCTIONS - IMPROVED
  // ===============================
  
  const normalizeDate = (dateString, isEndOfDay = false) => {
    if (!dateString) return null;
    try {
      // Parse date string (expecting YYYY-MM-DD)
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      if (isNaN(date.getTime())) return null;
      
      if (isEndOfDay) {
        date.setHours(23, 59, 59, 999);
      } else {
        date.setHours(0, 0, 0, 0);
      }
      return date;
    } catch (error) {
      console.error('Error normalizing date:', error);
      return null;
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // ===============================
  // REFRESH & CLEAR FUNCTIONS
  // ===============================
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      setFromDate('');
      setToDate('');
      setSelectedHistoryRange('');
      setStatusFilter('All');
      setSelectedProduct('');
      setScannedProductsForCurrentRange(new Set());
      setUncertainQuantity('');
      await fetchProducts();
      await fetchAvailableDateRanges();
      await fetchStockRecords();
      setScannedProduct(null);
      setShowScanner(false);
      setShowDropdown(false);
      setScanStatus('Data refreshed successfully!');
      setTimeout(() => setScanStatus('Ready to scan'), 2000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setScanStatus('Error refreshing data');
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearDateFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedHistoryRange('');
  };

  // ===============================
  // DATA FETCHING FUNCTIONS
  // ===============================
  
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
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

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
      setAvailableDateRanges([]);
      setMostRecentDateRange(null);
    }
  };

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

  // ===============================
  // CORE CALCULATION FUNCTIONS - FIXED AND IMPROVED
  // ===============================
  
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

  // FIXED: Fetch sold items within date range - IMPROVED VERSION
  const fetchSoldCount = async (productName, productBarcode) => {
    console.log('🔍 Fetching sold count for:', productName, productBarcode);
    console.log('📅 Date range:', fromDate, 'to', toDate);
    
    if (!fromDate && !toDate) {
      alert('Please select a date range first to count sold items.');
      return;
    }

    const dbRef = ref(database, 'SoldItems');
    try {
      // Create date range objects
      const fromDateObj = normalizeDate(fromDate, false);
      const toDateObj = normalizeDate(toDate, true);
      
      if (!fromDateObj || !toDateObj) {
        alert('Invalid date range selected.');
        return;
      }

      console.log('📊 Date range timestamps:', fromDateObj.getTime(), 'to', toDateObj.getTime());
      
      let totalSold = 0;
      let matchedItems = [];
      
      // Get ALL sold items and filter manually for better accuracy
      const soldItemsSnapshot = await get(dbRef);
      
      if (soldItemsSnapshot.exists()) {
        const soldData = soldItemsSnapshot.val();
        
        Object.entries(soldData).forEach(([itemId, item]) => {
          if (!item || !item.dateScanned) return;
          
          // Parse item date
          const itemDate = new Date(item.dateScanned);
          if (isNaN(itemDate.getTime())) return;
          
          // Check if item is within date range
          if (itemDate < fromDateObj || itemDate > toDateObj) {
            return; // Skip items outside date range
          }
          
          // Product matching - STRICT matching
          let matchesProduct = false;
          
          // 1. Check if item has barcode property and it matches
          if (item.barcode && String(item.barcode).trim() === String(productBarcode).trim()) {
            matchesProduct = true;
          }
          // 2. If no barcode, check product name (case-insensitive, trimmed)
          else if (item.name && productName) {
            const itemName = String(item.name).toLowerCase().trim();
            const prodName = String(productName).toLowerCase().trim();
            // Use includes instead of exact match to handle variations
            matchesProduct = itemName.includes(prodName) || prodName.includes(itemName);
          }
          
          if (matchesProduct) {
            // Parse quantity - handle different formats
            let quantity = 0;
            
            // Try to extract quantity from various possible fields
            if (item.quantity !== undefined && item.quantity !== null) {
              const parsed = parseFloat(item.quantity);
              if (!isNaN(parsed) && parsed >= 0) {
                quantity = parsed;
              }
            } else if (item.totalCost && item.itemCost) {
              // Try to calculate from cost if quantity not available
              const totalCost = parseFloat(item.totalCost);
              const itemCost = parseFloat(item.itemCost);
              if (!isNaN(totalCost) && !isNaN(itemCost) && itemCost > 0) {
                quantity = totalCost / itemCost;
              }
            }
            
            matchedItems.push({
              id: itemId,
              date: item.dateScanned,
              quantity: quantity,
              name: item.name,
              barcode: item.barcode,
              itemCost: item.itemCost,
              totalCost: item.totalCost
            });
            
            totalSold += quantity;
          }
        });

        console.log(`📊 Found ${matchedItems.length} matching sold items`);
        console.log(`📊 Total quantity sold in period: ${totalSold}`);
        
        // Log for debugging
        if (matchedItems.length > 0) {
          console.log('📋 Matched items summary:');
          matchedItems.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.name} - Qty: ${item.quantity} - Date: ${item.date}`);
          });
        }
        
        setSoldCount(totalSold);
      } else {
        console.log('📊 No sold items found in database');
        setSoldCount(0);
      }
    } catch (error) {
      console.error('❌ Error fetching sold count:', error);
      alert('Error fetching sold items: ' + error.message);
      setSoldCount(0);
    }
  };

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

  const fetchProductDetails = async (barcode) => {
    // Validate date range is selected
    if (!fromDate && !toDate) {
      alert('Please select a date range first to count sold items.');
      return;
    }

    // First check if product is already scanned for current date range
    const isAlreadyScanned = await checkIfProductAlreadyScanned(barcode);
    
    if (isAlreadyScanned) {
      setScanStatus('Item already scanned for this date range!');
      setTimeout(() => setScanStatus('Align barcode within frame'), 3000);
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
          quantity: parseFloat(product.quantity) || 0,
        };
        setScannedProduct(productData);
        
        // Show loading message
        setScanStatus('Calculating sold items...');
        
        await fetchSoldCount(product.name, barcode);
        
        // After fetching sold count, update status
        setTimeout(() => {
          setScanStatus(`Found ${soldCount} sold items in selected period`);
        }, 500);
        
        setIsPopupOpen(true);
      } else {
        setScanStatus('Product not found in database');
        setTimeout(() => setScanStatus('Ready to scan'), 3000);
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      setScanStatus('Error retrieving product information');
      setTimeout(() => setScanStatus('Ready to scan'), 3000);
    }
  };

  // ===============================
  // SAVE & UPDATE FUNCTIONS - IMPROVED
  // ===============================
  
  const saveRemainingStock = async (status, uncertainQuantity = null) => {
    try {
      // Validate date range
      if (!fromDate && !toDate) {
        alert('Cannot save stock check without date range.');
        return false;
      }

      // Validate sold count was actually fetched
      if (soldCount === null || soldCount === undefined) {
        alert('Sold count not calculated. Please try scanning again.');
        return false;
      }

      const dateKey = getCurrentDateKey();
      
      // Calculate remaining quantity with validation
      let remainingQuantity;
      if (status === 'CONFIRMED') {
        remainingQuantity = Math.max(0, scannedProduct.quantity - soldCount);
        
        // Check if calculation makes sense
        if (soldCount > scannedProduct.quantity * 2) {
          const confirm = window.confirm(
            `Warning: Sold count (${soldCount}) is more than double current stock (${scannedProduct.quantity}).\n` +
            `This might indicate incorrect data. Proceed anyway?`
          );
          if (!confirm) return false;
        }
      } else {
        const uncertainQty = parseFloat(uncertainQuantity);
        if (isNaN(uncertainQty) || uncertainQty < 0) {
          alert('Please enter a valid positive quantity for uncertain count.');
          return false;
        }
        remainingQuantity = uncertainQty;
      }

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
          fromDate: fromDate,
          toDate: toDate,
          dateKey: dateKey
        },
        ...(status === 'NOT_CONFIRMED' && { 
          uncertainQuantity: parseFloat(uncertainQuantity) || 0 
        }),
      };

      await set(newStockRef, stockData);
      
      // Update product quantity if confirmed
      if (status === 'CONFIRMED') {
        const productRef = ref(database, `products/${scannedProduct.barcode}`);
        await update(productRef, { 
          quantity: remainingQuantity
        });
      }
      
      // Update local state
      setScannedProductsForCurrentRange(prev => new Set([...prev, scannedProduct.barcode]));
      await fetchStockRecords(); // Refresh records
      
      alert(`Stock check saved successfully!\n\n` +
            `Product: ${scannedProduct.name}\n` +
            `Current Stock: ${scannedProduct.quantity}\n` +
            `Sold in period: ${soldCount}\n` +
            `Calculated Remaining: ${remainingQuantity}\n` +
            `Date Range: ${formatDateForDisplay(fromDate)} to ${formatDateForDisplay(toDate)}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving remaining stock:', error);
      alert(`Error saving: ${error.message}`);
      return false;
    }
  };

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

  // ===============================
  // EDIT FUNCTIONS
  // ===============================
  
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

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: value
    });
  };

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
      await fetchStockRecords(); // Refresh after update
      alert('Record updated successfully!');
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Failed to update record: ' + error.message);
    }
  };

  const handleDeleteClick = async (recordId) => {
    if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      try {
        const recordRef = ref(database, `remainingStocks/${recordId}`);
        await remove(recordRef);
        await fetchStockRecords(); // Refresh after delete
        alert('Record deleted successfully!');
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Failed to delete record: ' + error.message);
      }
    }
  };

  // ===============================
  // EXPORT FUNCTIONS
  // ===============================
  
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

    if (recordsToExport.length === 0) {
      alert('No records to export for the selected filters.');
      return;
    }

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
      'Date Scanned': record.timestamp || 'N/A',
      'Stock Check Date Range': record.dateRangeInfo?.fromDate && record.dateRangeInfo?.toDate 
        ? `${record.dateRangeInfo.fromDate} to ${record.dateRangeInfo.toDate}`
        : 'N/A'
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

  // ===============================
  // FORMATTING FUNCTIONS
  // ===============================
  
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

  // ===============================
  // USE EFFECTS
  // ===============================
  
  useEffect(() => {
    fetchProducts();
    fetchAvailableDateRanges();
    fetchStockRecords();
  }, []);

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
          } else if (error && !error.message.includes('NotFoundException')) {
            setScanStatus('Align barcode within frame');
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
        .catch((err) => console.error('Camera initialization failed:', err));

      return () => {
        codeReader.reset();
      };
    }
  }, [showScanner]);

  // ===============================
  // FILTERS & CALCULATIONS
  // ===============================
  
  const filteredRecords = stockRecords.filter(record => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Confirmed') return record.status === 'CONFIRMED';
    if (statusFilter === 'Not Confirmed') return record.status === 'NOT_CONFIRMED';
    return true;
  });

  const availableProducts = products.filter(product => 
    !scannedProductsForCurrentRange.has(product.barcode)
  );

  // ===============================
  // RENDER
  // ===============================
  
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
              {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
            <button onClick={exportToExcel} className="btn-primary">
              <span className="button-icon">📊</span>
              Export Excel
            </button>
          </div>
        </div>

        {/* CORRECTED: Date Range Selection for Sold Items */}
        <div className="date-selection-section">
          <h3 className="section-title">Select Date Range for Sold Items</h3>
          <p className="section-subtitle">
            Choose the period to count sold items from SoldItems collection
          </p>
          
          <div className="date-inputs">
            <div className="date-input-group">
              <label className="date-label">From Date</label>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="date-input"
                max={toDate || new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="date-input-group">
              <label className="date-label">To Date</label>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="date-input"
                min={fromDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {(fromDate || toDate) && (
            <div className="current-range-display">
              <span className="range-label">Counting sold items from:</span>
              <span className="range-value">
                {fromDate ? formatDateForDisplay(fromDate) : 'Beginning'} to {toDate ? formatDateForDisplay(toDate) : 'Today'}
              </span>
              <button onClick={clearDateFilters} className="clear-range-btn">
                ✕ Clear
              </button>
            </div>
          )}

          {(!fromDate && !toDate) && (
            <div className="date-range-warning">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">Please select a date range to start stock check</span>
            </div>
          )}
        </div>

        <div className="action-buttons-grid">
          <button
            className="action-card"
            onClick={() => {
              if (!fromDate && !toDate) {
                alert('Please select a date range first to count sold items.');
                return;
              }
              setShowScanner(true);
              setShowDropdown(false);
              setScanStatus('Align barcode within frame');
            }}
            disabled={!fromDate && !toDate}
          >
            <div className="action-card-icon">📷</div>
            <div className="action-card-content">
              <h3 className="action-card-title">Scan Barcode</h3>
              <p className="action-card-description">Count sold items from {fromDate || '?'} to {toDate || '?'}</p>
            </div>
          </button>

          <button
            className="action-card"
            onClick={() => {
              if (!fromDate && !toDate) {
                alert('Please select a date range first to count sold items.');
                return;
              }
              setShowDropdown(true);
              setShowScanner(false);
              setScanStatus('Select a product from dropdown');
            }}
            disabled={!fromDate && !toDate}
          >
            <div className="action-card-icon">🔍</div>
            <div className="action-card-content">
              <h3 className="action-card-title">Search Product</h3>
              <p className="action-card-description">Count sold items from {fromDate || '?'} to {toDate || '?'}</p>
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
            <button 
              onClick={() => setShowScanner(false)}
              className="btn-secondary btn-small"
            >
              ✕ Close Scanner
            </button>
          </div>
        )}

        {/* Product Selection Dropdown */}
        {showDropdown && (
          <div className="product-selector-card">
            <div className="selector-header">
              <h3 className="selector-title">Select Product</h3>
              <span className="selector-count">
                {availableProducts.length} products available for this date range
              </span>
            </div>
            <select 
              value={selectedProduct} 
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                if (e.target.value) fetchProductDetails(e.target.value);
              }}
              className="product-select"
            >
              <option value="">Choose a product...</option>
              {availableProducts.map((product) => (
                <option key={product.barcode} value={product.barcode}>
                  {product.name} ({product.barcode}) - Stock: {product.quantity}
                </option>
              ))}
            </select>
            {availableProducts.length === 0 && (
              <div className="selector-empty">
                <span className="empty-icon">📦</span>
                <p>All products already checked for {fromDate} to {toDate}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters Card */}
      <div className="filters-card">
        <div className="filters-grid">
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
              <option value="Confirmed">Confirmed Only</option>
              <option value="Not Confirmed">Uncertain Only</option>
            </select>
          </div>

          {/* History Selector */}
          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">📋</span>
              Stock Check History
            </label>
            <select
              value={selectedHistoryRange}
              onChange={(e) => handleHistoryRangeSelect(e.target.value)}
              className="history-select"
            >
              <option value="">Select a date range...</option>
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
                {formatDateRangeKey(mostRecentDateRange.key)} • {new Date(mostRecentDateRange.timestamp).toLocaleDateString()}
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
                  setUncertainQuantity('');
                }}
                className="modal-close"
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              {/* Date Range Info */}
              <div className="date-range-info">
                <span className="info-label">Counting sold items from:</span>
                <span className="info-value">
                  {formatDateForDisplay(fromDate)} to {formatDateForDisplay(toDate)}
                </span>
              </div>

              <div className="product-details-grid">
                <div className="product-detail">
                  <span className="detail-label">Barcode</span>
                  <span className="detail-value barcode">{scannedProduct.barcode}</span>
                </div>
                <div className="product-detail">
                  <span className="detail-label">Current Stock</span>
                  <span className="detail-value quantity">{scannedProduct.quantity}</span>
                </div>
                <div className="product-detail">
                  <span className="detail-label">Sold in Period</span>
                  <span className="detail-value sold">{soldCount}</span>
                </div>
                <div className="product-detail">
                  <span className="detail-label">Calculated Remaining</span>
                  <span className="detail-value remaining">
                    {Math.max(0, scannedProduct.quantity - soldCount)}
                  </span>
                </div>
              </div>

              <div className="calculation-explanation">
                <p className="explanation-text">
                  <strong>Calculation:</strong> {scannedProduct.quantity} (Current Stock) - {soldCount} (Sold from {formatDateForDisplay(fromDate)} to {formatDateForDisplay(toDate)}) = {Math.max(0, scannedProduct.quantity - soldCount)} (Remaining)
                </p>
              </div>

              <div className="product-actions">
                <button
                  onClick={async () => {
                    const confirmed = window.confirm(
                      `Confirm remaining quantity: ${Math.max(0, scannedProduct.quantity - soldCount)}\n\nThis will:\n1. Update product stock to ${Math.max(0, scannedProduct.quantity - soldCount)}\n2. Save stock check for ${formatDateForDisplay(fromDate)} to ${formatDateForDisplay(toDate)}`
                    );
                    if (confirmed) {
                      const saved = await saveRemainingStock('CONFIRMED');
                      if (saved) {
                        setIsPopupOpen(false);
                        setSoldCount(0);
                        setSelectedProduct('');
                        setUncertainQuantity('');
                      }
                    }
                  }}
                  className="btn-success"
                >
                  <span className="button-icon">✅</span>
                  Confirm & Update Stock
                </button>

                <div className="uncertain-section">
                  <div className="uncertain-input-group">
                    <input
                      type="number"
                      value={uncertainQuantity}
                      onChange={(e) => setUncertainQuantity(e.target.value)}
                      placeholder="If uncertain, enter actual count..."
                      className="uncertain-input"
                      min="0"
                      step="0.01"
                    />
                    <button
                      onClick={async () => {
                        if (!uncertainQuantity || isNaN(uncertainQuantity) || uncertainQuantity < 0) {
                          alert('Please enter a valid positive quantity');
                          return;
                        }
                        const confirmed = window.confirm(
                          `Save as uncertain quantity: ${uncertainQuantity}\n\nThis will save the stock check without updating product stock.\nDate Range: ${formatDateForDisplay(fromDate)} to ${formatDateForDisplay(toDate)}`
                        );
                        if (confirmed) {
                          const saved = await saveRemainingStock('NOT_CONFIRMED', uncertainQuantity);
                          if (saved) {
                            setIsPopupOpen(false);
                            setSoldCount(0);
                            setUncertainQuantity('');
                            setSelectedProduct('');
                          }
                        }
                      }}
                      className="btn-warning"
                    >
                      <span className="button-icon">❓</span>
                      Save Uncertain Count
                    </button>
                  </div>
                  <p className="uncertain-note">
                    <small>Use this if physical count differs from calculated value</small>
                  </p>
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
            <button onClick={clearDateFilters} className="btn-secondary btn-small">
              ✕ Clear Date Filters
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
                  : 'Select a date range and scan products to create stock records'}
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
                  <th>Date Range</th>
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
                              min="0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              name="calculatedRemaining"
                              value={editFormData.calculatedRemaining}
                              onChange={handleEditFormChange}
                              className="edit-input"
                              min="0"
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
                                min="0"
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
                        <span className="date-range-cell">
                          {record.dateRangeInfo?.fromDate && record.dateRangeInfo?.toDate 
                            ? `${formatDateForDisplay(record.dateRangeInfo.fromDate)} to ${formatDateForDisplay(record.dateRangeInfo.toDate)}`
                            : 'N/A'}
                        </span>
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