import React, { useState, useEffect, useContext, useMemo } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, remove } from 'firebase/database';
import { writeFile, utils } from 'xlsx'; // Import xlsx functions
import { UserContext } from '../Auth/userContext'; // Import the context
import '../CSS/soldItems.css';

const SoldItems = () => {
  const { user } = useContext(UserContext); // Access the logged-in user
  const [soldItems, setSoldItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [filterType, setFilterType] = useState('all'); // all, day, month
  const [filterValue, setFilterValue] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]); // For dynamic month selection
  const [customerData, setCustomerData] = useState({}); // Store customer data by ID
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch Sold Items
  useEffect(() => {
    const fetchSoldItems = async () => {
      try {
        const soldItemsRef = ref(database, 'SoldItems');
        const snapshot = await get(soldItemsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const soldItemList = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setSoldItems(soldItemList);
        } else {
          setSoldItems([]);
        }
      } catch (error) {
        console.error('Error fetching sold items:', error);
        setErrorMessage('Failed to fetch sold items.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    fetchSoldItems();
  }, []);

  // Fetch Customer Data (Assumed to be stored in 'Customers' reference)
  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        const customersRef = ref(database, 'Customers');
        const snapshot = await get(customersRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setCustomerData(data);
        } else {
          setCustomerData({});
        }
      } catch (error) {
        console.error('Error fetching customer data:', error);
      }
    };

    fetchCustomerData();
  }, []);

  // Memoized filteredItems to prevent recalculating on every render
  const filteredItemsMemo = useMemo(() => {
    if (filterType === 'all') {
      return soldItems;
    } else if (filterType === 'day') {
      return soldItems.filter((item) =>
        new Date(item.dateScanned).toISOString().split('T')[0] === filterValue
      );
    } else if (filterType === 'month') {
      return soldItems.filter(
        (item) =>
          new Date(item.dateScanned).getFullYear() === parseInt(filterValue.split('-')[0]) &&
          new Date(item.dateScanned).getMonth() + 1 === parseInt(filterValue.split('-')[1])
      );
    }
    return [];
  }, [soldItems, filterType, filterValue]);

  // Set filteredItems when filter is applied
  const handleFilter = () => {
    setFilteredItems(filteredItemsMemo);
  };

  // Handle Delete Item
  const handleDeleteItem = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this item?');
    if (!confirmDelete) return;

    const itemRef = ref(database, `SoldItems/${id}`);
    try {
      await remove(itemRef);
      setSoldItems(soldItems.filter((item) => item.id !== id));
      setFilteredItems(filteredItems.filter((item) => item.id !== id));
      setErrorMessage('Item deleted successfully!');
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting item:', error);
      setErrorMessage('Failed to delete item.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    if (filteredItems.length === 0) {
      setErrorMessage('No data to export!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // Prepare data for export in the correct order
    const exportData = filteredItems.map((item) => ({
      Date: new Date(item.dateScanned).toLocaleString(),
      Customer: customerData[item.customerId]?.customerName || 'N/A', // Use customerName instead of name
      ProductType: item.category || 'N/A',
      QuantitySold: item.quantity || 0,
      Price: `$${item.price?.toFixed(2) || '0.00'}`,
      ItemCost: `$${item.cost?.toFixed(2) || '0.00'}`,
      Employee: item.scannedBy || 'N/A',
    }));

    const worksheet = utils.json_to_sheet(exportData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Sold Items');

    // Generate and download Excel file
    writeFile(workbook, 'SoldItems.xlsx');
  };

  return (
    <div className="sold-items-container">
      <h1 className="sold-items-title">Sold Items</h1>

      {/* Error Message */}
      {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

      {/* Filters */}
      <div className="filter-container">
        <select onChange={(e) => setFilterType(e.target.value)} value={filterType} className="filter-select">
          <option value="all">All</option>
          <option value="day">By Day</option>
          <option value="month">By Month</option>
        </select>
        {filterType === 'day' && (
          <input
            type="date"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="filter-input"
          />
        )}
        {filterType === 'month' && (
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="filter-input"
          >
            <option value="">Select Month</option>
            {soldItems
              .map((item) => new Date(item.dateScanned).toISOString().split('T')[0].slice(0, 7)) // Get year-month
              .filter((value, index, self) => self.indexOf(value) === index) // Unique months
              .map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
          </select>
        )}
        <button onClick={handleFilter} className="filter-button">Apply Filter</button>
      </div>

      {/* Export Button */}
      <div className="export-button-container">
        <button onClick={handleExportToExcel} className="export-button">
          Export to Excel
        </button>
      </div>

      {/* Sold Items List */}
      <div className="sold-items-list">
        {filteredItems.length === 0 ? (
          <p>No items sold yet.</p>
        ) : (
          <table className="sold-items-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Product Type</th>
                <th>Quantity Sold</th>
                <th>Price</th>
                <th>Item Cost</th>
                <th>Employee</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.dateScanned).toLocaleString()}</td>
                  <td>{customerData[item.customerId]?.customerName || 'N/A'}</td>
                  <td>{item.category || 'N/A'}</td>
                  <td>{item.quantity || 0}</td>
                  <td>
                    {typeof item.price === 'number'
                      ? `$${item.price.toFixed(2)}`
                      : 'N/A'}
                  </td>
                  <td>
                    {typeof item.cost === 'number'
                      ? `$${item.cost.toFixed(2)}`
                      : 'N/A'}
                  </td>
                  <td>{item.scannedBy || 'N/A'}</td>
                  <td>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="delete-button"
                    >
                      Delete
                    </button>
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

export default SoldItems;