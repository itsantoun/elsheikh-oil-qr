import React, { useState, useEffect, useContext } from 'react';
import { database } from '../Auth/firebase';
import { ref, set, get, update, remove, onValue } from 'firebase/database';
import { UserContext } from '../Auth/userContext';
import '../CSS/soldItems.css';
import Barcode from 'react-barcode';

const SoldItems = () => {
  const { user } = useContext(UserContext);
  const [soldItems, setSoldItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  
  // Filter states
  const [customerFilter, setCustomerFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [checkFilter, setCheckFilter] = useState('all');
  
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const [editingItem, setEditingItem] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [newTotalCost, setNewTotalCost] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newProductType, setNewProductType] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [itemIdToDelete, setItemIdToDelete] = useState(null);
  
  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem('checkedSoldItems');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [showMissingItemsModal, setShowMissingItemsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [filteredTotals, setFilteredTotals] = useState({
    totalQuantity: 0,
    totalCost: 0,
    totalItems: 0
  });

  // Format date to DD-MM-YYYY
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Format date to YYYY-MM-DD for input fields
  const formatDateForInput = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date for input:', error);
      return '';
    }
  };

  // Parse DD-MM-YYYY to Date object
  const parseDateFromDDMMYYYY = (dateString) => {
    try {
      const [day, month, year] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  // Format date and time for display (in one line)
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting date and time:', error);
      return 'Invalid Date';
    }
  };

  // Format date and time for CSV export
  const formatDateTimeForCSV = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting date for CSV:', error);
      return 'Invalid Date';
    }
  };

  // Sort items by date
  const sortItemsByDate = (items, order = 'asc') => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.dateScanned);
      const dateB = new Date(b.dateScanned);
      return order === 'asc' ? dateA - dateB : dateB - dateA;
    });
  };

  // Fetch data
  useEffect(() => {
    const customersRef = ref(database, 'customers');
    const soldItemsRef = ref(database, 'SoldItems');
    const productsRef = ref(database, 'products');

    const unsubscribeCustomers = onValue(customersRef, (customersSnapshot) => {
      get(soldItemsRef).then((soldItemsSnapshot) => {
        let customerList = [];
        if (customersSnapshot.exists()) {
          const customersData = customersSnapshot.val();
          customerList = Object.keys(customersData).map((key) => ({
            id: key,
            name: customersData[key].name,
            nameArabic: customersData[key].nameArabic,
          }));
        }
        setCustomers(customerList);

        if (soldItemsSnapshot.exists()) {
          const soldData = soldItemsSnapshot.val();
          const soldItemList = Object.keys(soldData).map((key) => ({
            id: key,
            ...soldData[key],
            customerName: customerList.find(c => c.nameArabic === soldData[key].customerName)?.name ||
                        soldData[key].customerName,
          }));
          const sortedItems = sortItemsByDate(soldItemList);
          setSoldItems(sortedItems);
          setFilteredItems(sortedItems);
        } else {
          setSoldItems([]);
          setFilteredItems([]);
        }
      });
    });

    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsData = snapshot.val();
        const productList = Object.keys(productsData).map((key) => ({
          id: key,
          barcode: key,
          ...productsData[key],
        }));
        productList.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(productList);
      }
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeProducts();
    };
  }, []);

  // Calculate totals
  useEffect(() => {
    if (filteredItems.length > 0) {
      const totals = filteredItems.reduce(
        (acc, item) => {
          const quantity = parseFloat(item.quantity) || 0;
          const cost = parseFloat(item.totalCost) || 0;
          return {
            totalQuantity: acc.totalQuantity + quantity,
            totalCost: acc.totalCost + cost,
            totalItems: acc.totalItems + 1
          };
        },
        { totalQuantity: 0, totalCost: 0, totalItems: 0 }
      );
      setFilteredTotals(totals);
    } else {
      setFilteredTotals({ totalQuantity: 0, totalCost: 0, totalItems: 0 });
    }
  }, [filteredItems]);

  // Apply filters
  useEffect(() => {
    let filtered = [...soldItems];

    if (customerFilter) {
      filtered = filtered.filter((item) =>
        item.customerName?.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }

    if (productFilter) {
      filtered = filtered.filter((item) =>
        item.name?.toLowerCase().includes(productFilter.toLowerCase())
      );
    }

    if (dateFilter) {
      const filterDate = formatDate(dateFilter); // Convert YYYY-MM-DD to DD-MM-YYYY
      filtered = filtered.filter(
        (item) => formatDate(item.dateScanned) === filterDate
      );
    }

    if (monthFilter) {
      filtered = filtered.filter(
        (item) =>
          new Date(item.dateScanned).getMonth() + 1 === parseInt(monthFilter, 10)
      );
    }

    if (paymentStatusFilter !== 'All') {
      if (paymentStatusFilter === 'Unpaid') {
        filtered = filtered.filter((item) => item.paymentStatus === 'Unpaid');
      } else if (paymentStatusFilter === 'Paid') {
        filtered = filtered.filter((item) => item.paymentStatus === 'Paid');
      } else if (paymentStatusFilter === 'Stock') {
        filtered = filtered.filter((item) => item.paymentStatus === 'Stock');
      }
    }

    if (checkFilter === 'checked') {
      filtered = filtered.filter((item) => checkedItems.includes(item.id));
    } else if (checkFilter === 'unchecked') {
      filtered = filtered.filter((item) => !checkedItems.includes(item.id));
    }

    const sortedFiltered = sortItemsByDate(filtered);
    setFilteredItems(sortedFiltered);
  }, [
    customerFilter,
    productFilter,
    dateFilter,
    monthFilter,
    paymentStatusFilter,
    checkFilter,
    checkedItems,
    soldItems
  ]);

  // Clear all filters
  const clearAllFilters = () => {
    setCustomerFilter('');
    setProductFilter('');
    setDateFilter('');
    setMonthFilter('');
    setPaymentStatusFilter('All');
    setCheckFilter('all');
  };

  // Format month filter display
  const formatMonthDisplay = (monthNumber) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[monthNumber - 1] || '';
  };

  // Handle date input change (converts from YYYY-MM-DD to DD-MM-YYYY for display)
  const handleDateFilterChange = (e) => {
    setDateFilter(e.target.value);
  };

  // Checkbox functions - THESE ARE STILL HERE
  const handleCheckboxChange = (itemId) => {
    setCheckedItems(prev => {
      const newCheckedItems = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      localStorage.setItem('checkedSoldItems', JSON.stringify(newCheckedItems));
      return newCheckedItems;
    });
  };

  const clearAllChecks = () => {
    localStorage.removeItem('checkedSoldItems');
    setCheckedItems([]);
  };

  // Edit functions
  const handleEdit = (item) => {
    if (!item || !item.id) return;
    setEditingItem(item);
    setNewRemark(item.remark || '');
    setNewTotalCost(item.totalCost || '');
    setNewPaymentStatus(item.paymentStatus || 'Paid');
    setNewCustomer(item.customerName || '');
    setNewProductType(item.name || '');
    setNewQuantity(item.quantity || 0);
    // Convert date to YYYY-MM-DDTHH:mm format for datetime-local input
    const dateObj = new Date(item.dateScanned);
    const formattedDate = dateObj.toISOString().slice(0, 16);
    setNewDate(formattedDate);
  };

  const saveEditedItem = async () => {
    if (!editingItem) return;
    
    // Convert date from local format to ISO string
    const dateToSave = newDate ? new Date(newDate).toISOString() : new Date().toISOString();
    
    const itemRef = ref(database, `SoldItems/${editingItem.id}`);
    try {
      await update(itemRef, {
        remark: newRemark,
        totalCost: newTotalCost,
        paymentStatus: newPaymentStatus,
        customerName: newCustomer,
        name: newProductType,
        quantity: newQuantity,
        dateScanned: dateToSave,
      });
      
      const updatedItems = soldItems.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              remark: newRemark,
              totalCost: newTotalCost,
              paymentStatus: newPaymentStatus,
              customerName: newCustomer,
              name: newProductType,
              quantity: newQuantity,
              dateScanned: dateToSave,
            }
          : item
      );
      
      const sortedItems = sortItemsByDate(updatedItems);
      setSoldItems(sortedItems);
      setFilteredItems(sortedItems);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      setErrorMessage('Failed to update item.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Delete functions
  const handleDelete = async (itemId) => {
    try {
      const itemRef = ref(database, `SoldItems/${itemId}`);
      await remove(itemRef);
      setSoldItems(soldItems.filter((item) => item.id !== itemId));
      setFilteredItems(filteredItems.filter((item) => item.id !== itemId));
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error deleting item:', error);
      setErrorMessage('Failed to delete item.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleDeleteConfirmation = (itemId) => {
    setItemIdToDelete(itemId);
    setShowConfirmation(true);
  };

  const confirmDelete = () => {
    if (itemIdToDelete) {
      handleDelete(itemIdToDelete);
    }
  };

  const cancelDelete = () => {
    setShowConfirmation(false);
    setItemIdToDelete(null);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      alert("No data to export.");
      return;
    }

    const headers = [
      "Date", "Customer", "Product Type", "Quantity Sold", "Price",
      "Item Cost", "Employee", "Remarks", "Total Cost", "Payment Status"
    ];

    const rows = filteredItems.map((item) => [
      formatDateTimeForCSV(item.dateScanned),
      item.customerName || "N/A",
      item.name || "N/A",
      item.quantity || 0,
      item.price || "N/A",
      item.itemCost || "N/A",
      item.scannedBy || "N/A",
      item.remark || "N/A",
      item.totalCost || "N/A",
      item.paymentStatus || "Paid",
    ]);

    const csvContent =
      "\ufeff" +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sold_items_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format date filter value for display in active filters
  const getDateFilterDisplay = () => {
    if (!dateFilter) return '';
    // Convert YYYY-MM-DD to DD-MM-YYYY for display
    const [year, month, day] = dateFilter.split('-');
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="sold-items-container">
      {/* Header */}
      <div className="header-section">
        <h1 className="page-title">Sold Items</h1>
        {errorMessage && <div className="error-message">{errorMessage}</div>}
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.name}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Product</label>
            <input
              type="text"
              placeholder="Search product"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Date (DD-MM-YYYY)</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="date-input"
            />
            {dateFilter && (
              <div className="date-display-hint">
                Filtering for: {getDateFilterDisplay()}
              </div>
            )}
          </div>

          <div className="filter-group">
            <label>Month</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            >
              <option value="">All Months</option>
              {[...Array(12).keys()].map((month) => (
                <option key={month} value={month + 1}>
                  {formatMonthDisplay(month + 1)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Stock">Stock</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Check Status</label>
            <select
              value={checkFilter}
              onChange={(e) => setCheckFilter(e.target.value)}
            >
              <option value="all">All Items</option>
              <option value="checked">Checked</option>
              <option value="unchecked">Unchecked</option>
            </select>
            <button 
              className="clear-checks-btn"
              onClick={clearAllChecks}
              disabled={checkedItems.length === 0}
            >
              Clear Checks ({checkedItems.length})
            </button>
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn-secondary" onClick={clearAllFilters}>
            Clear Filters
          </button>
          <button className="btn-primary" onClick={exportToCSV}>
            Export CSV
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setShowMissingItemsModal(true)}
          >
            Add Missing Items
          </button>
        </div>
      </div>

      {/* Active Filters */}
      {(customerFilter || productFilter || dateFilter || monthFilter || paymentStatusFilter !== 'All' || checkFilter !== 'all') && (
        <div className="active-filters">
          <div className="active-filters-header">
            <span className="active-filters-title">Active Filters:</span>
            <button className="clear-all-filters" onClick={clearAllFilters}>
              Clear All
            </button>
          </div>
          <div className="filter-tags">
            {customerFilter && (
              <span className="filter-tag">
                Customer: {customerFilter}
                <button onClick={() => setCustomerFilter('')}>×</button>
              </span>
            )}
            {productFilter && (
              <span className="filter-tag">
                Product: {productFilter}
                <button onClick={() => setProductFilter('')}>×</button>
              </span>
            )}
            {dateFilter && (
              <span className="filter-tag">
                Date: {getDateFilterDisplay()}
                <button onClick={() => setDateFilter('')}>×</button>
              </span>
            )}
            {monthFilter && (
              <span className="filter-tag">
                Month: {formatMonthDisplay(parseInt(monthFilter))}
                <button onClick={() => setMonthFilter('')}>×</button>
              </span>
            )}
            {paymentStatusFilter !== 'All' && (
              <span className="filter-tag">
                Status: {paymentStatusFilter}
                <button onClick={() => setPaymentStatusFilter('All')}>×</button>
              </span>
            )}
            {checkFilter !== 'all' && (
              <span className="filter-tag">
                Check: {checkFilter === 'checked' ? 'Checked' : 'Unchecked'}
                <button onClick={() => setCheckFilter('all')}>×</button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {filteredItems.length > 0 && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-card-content">
              <span className="summary-card-label">Total Items</span>
              <span className="summary-card-value">{filteredTotals.totalItems}</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-content">
              <span className="summary-card-label">Total Quantity</span>
              <span className="summary-card-value">{filteredTotals.totalQuantity.toFixed(2)}</span>
            </div>
          </div>
          <div className="summary-card highlight">
            <div className="summary-card-content">
              <span className="summary-card-label">Total Revenue</span>
              <span className="summary-card-value">${filteredTotals.totalCost.toFixed(2)}</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-content">
              <span className="summary-card-label">Checked Items</span>
              <span className="summary-card-value">{checkedItems.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Results Info */}
      {filteredItems.length > 0 && (
        <div className="results-info">
          Showing {filteredItems.length} sold item(s) • 
          Data range: {formatDate(filteredItems[0]?.dateScanned)} to {formatDate(filteredItems[filteredItems.length - 1]?.dateScanned)} •
          {checkedItems.length > 0 && ` ${checkedItems.length} items checked`}
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <p>No items match the current filters.</p>
            <button className="btn-secondary" onClick={clearAllFilters}>
              Clear Filters
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Product Type</th>
                <th>Quantity</th>
                <th>Item Cost</th>
                <th>Employee</th>
                <th>Remarks</th>
                <th>Total Cost</th>
                <th>Payment Status</th>
                <th>Actions</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={checkedItems.includes(item.id) ? 'checked-row' : ''}>
                  <td className="date-cell">
                    {editingItem && editingItem.id === item.id ? (
                      <input
                        type="datetime-local"
                        value={newDate || ''}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      <span className="date-display">{formatDateTime(item.dateScanned)}</span>
                    )}
                  </td>
                  <td>
                    {editingItem && editingItem.id === item.id ? (
                      <select 
                        value={newCustomer} 
                        onChange={(e) => setNewCustomer(e.target.value)}
                        className="edit-select"
                      >
                        <option value="">Select Customer</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.name}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      item.customerName || 'N/A'
                    )}
                  </td>
                  <td>
                    {editingItem && editingItem.id === item.id ? (
                      <input
                        type="text"
                        value={newProductType}
                        onChange={(e) => setNewProductType(e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      item.name || 'N/A'
                    )}
                  </td>
                  <td>
                    {editingItem && editingItem.id === item.id ? (
                      <input
                        type="number"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      item.quantity || 0
                    )}
                  </td>
                  <td>{item.itemCost ? `$${Number(item.itemCost).toFixed(2)}` : 'N/A'}</td>
                  <td>{item.scannedBy || 'N/A'}</td>
                  <td>
                    {editingItem && editingItem.id === item.id ? (
                      <input
                        type="text"
                        value={newRemark}
                        onChange={(e) => setNewRemark(e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      item.remark || 'N/A'
                    )}
                  </td>
                  <td>
                    {editingItem && editingItem.id === item.id ? (
                      <input
                        type="number"
                        value={newTotalCost}
                        onChange={(e) => setNewTotalCost(e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      item.totalCost ? `$${Number(item.totalCost).toFixed(2)}` : 'N/A'
                    )}
                  </td>
                  <td>
                    {editingItem && editingItem.id === item.id ? (
                      <select
                        value={newPaymentStatus}
                        onChange={(e) => setNewPaymentStatus(e.target.value)}
                        className="edit-select"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Stock">Stock</option>
                      </select>
                    ) : (
                      <div className="payment-status">
                        <span className={`status-badge status-${item.paymentStatus?.toLowerCase().replace(' ', '-')}`}>
                          {item.paymentStatus}
                        </span>
                        {item.paymentStatus === 'Stock' && (
                          <button
                            className="btn-small"
                            onClick={async () => {
                              const itemRef = ref(database, `SoldItems/${item.id}`);
                              try {
                                await update(itemRef, { paymentStatus: 'Stock Confirmed' });
                                const updatedItems = soldItems.map((i) => 
                                  i.id === item.id ? { ...i, paymentStatus: 'Stock Confirmed' } : i
                                );
                                setSoldItems(updatedItems);
                                setFilteredItems(updatedItems);
                              } catch (error) {
                                console.error('Error confirming item:', error);
                              }
                            }}
                            disabled={item.paymentStatus === 'Stock Confirmed'}
                          >
                            Confirm
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {editingItem && editingItem.id === item.id ? (
                      <div className="action-buttons">
                        <button className="btn-small btn-success" onClick={saveEditedItem}>
                          Save
                        </button>
                        <button className="btn-small btn-secondary" onClick={() => setEditingItem(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="action-buttons">
                        <button className="btn-small btn-primary" onClick={() => handleEdit(item)}>
                          Edit
                        </button>
                        <button className="btn-small btn-danger" onClick={() => handleDeleteConfirmation(item.id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                  {/* CHECKBOX COLUMN - IT'S STILL HERE! */}
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={checkedItems.includes(item.id)}
                      onChange={() => handleCheckboxChange(item.id)}
                      className="checkbox"
                      id={`checkbox-${item.id}`}
                    />
                    <label htmlFor={`checkbox-${item.id}`} className="checkbox-label">
                      {checkedItems.includes(item.id) ? 'Checked' : 'Check'}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Missing Items Modal */}
      {showMissingItemsModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Missing Item</h3>
              <button className="modal-close" onClick={() => setShowMissingItemsModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="product-selection">
                <select
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const productId = e.target.value;
                    const product = products.find(p => p.id === productId);
                    setSelectedProduct(product);
                  }}
                  className="product-select"
                >
                  <option value="">Select a Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.barcode}
                    </option>
                  ))}
                </select>

                {selectedProduct && (
                  <div className="barcode-section">
                    <h4>{selectedProduct.name}</h4>
                    <div className="barcode-container">
                      <Barcode 
                        value={selectedProduct.barcode} 
                        format="CODE128"
                        width={2}
                        height={100}
                        displayValue={false}
                      />
                    </div>
                    <p className="barcode-number">{selectedProduct.barcode}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowMissingItemsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirmation && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Confirm Deletion</h3>
              <div className="confirmation-date">
                Item date: {itemIdToDelete && soldItems.find(item => item.id === itemIdToDelete) 
                  ? formatDateTime(soldItems.find(item => item.id === itemIdToDelete).dateScanned) 
                  : 'N/A'}
              </div>
            </div>
            <div className="modal-content">
              <p>Are you sure you want to delete this item? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-danger" onClick={confirmDelete}>
                Yes, Delete
              </button>
              <button className="btn-secondary" onClick={cancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoldItems;