import React, { useState, useEffect, useContext } from 'react';
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
          setFilteredItems(soldItemList);

          // Generate a list of months from the data
          const months = [...new Set(
            soldItemList.map((item) => {
              const date = new Date(item.dateScanned);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            })
          )];
          setAvailableMonths(months);
        } else {
          setSoldItems([]);
          setFilteredItems([]);
        }
      } catch (error) {
        console.error('Error fetching sold items:', error);
        setErrorMessage('Failed to fetch sold items.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    fetchSoldItems();
  }, []);

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

  // Filter Items
  const handleFilter = () => {
    if (filterType === 'all') {
      setFilteredItems(soldItems);
    } else if (filterType === 'day') {
      setFilteredItems(
        soldItems.filter((item) =>
          new Date(item.dateScanned).toISOString().split('T')[0] === filterValue
        )
      );
    } else if (filterType === 'month') {
      setFilteredItems(
        soldItems.filter(
          (item) =>
            new Date(item.dateScanned).getFullYear() === parseInt(filterValue.split('-')[0]) &&
            new Date(item.dateScanned).getMonth() + 1 === parseInt(filterValue.split('-')[1])
        )
      );
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    if (filteredItems.length === 0) {
      setErrorMessage('No data to export!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // Prepare data for export
    const worksheet = utils.json_to_sheet(filteredItems);
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
            {availableMonths.map((month) => (
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
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Date Scanned</th>
                <th>Scanned By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name || 'N/A'}</td>
                  <td>{item.category || 'N/A'}</td>
                  <td>
                    {typeof item.price === 'number'
                      ? `$${item.price.toFixed(2)}`
                      : 'N/A'}
                  </td>
                  <td>{new Date(item.dateScanned).toLocaleString()}</td>
                  <td>{item.scannedBy || 'Not Available'}</td>
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