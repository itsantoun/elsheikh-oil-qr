// import React, { useState, useEffect, useContext, useMemo } from 'react';
// import { database } from '../Auth/firebase';
// import { ref, get, remove } from 'firebase/database';
// import { writeFile, utils } from 'xlsx'; // Import xlsx functions
// import { UserContext } from '../Auth/userContext'; // Import the context
// import '../CSS/soldItems.css';

// const SoldItems = () => {
//   const { user } = useContext(UserContext); // Access the logged-in user
//   const [soldItems, setSoldItems] = useState([]);
//   const [filteredItems, setFilteredItems] = useState([]);
//   const [filterType, setFilterType] = useState('all'); // all, day, month
//   const [filterValue, setFilterValue] = useState('');
//   const [availableMonths, setAvailableMonths] = useState([]); // For dynamic month selection
//   const [customerData, setCustomerData] = useState({}); // Store customer data by ID
//   const [errorMessage, setErrorMessage] = useState(null);

//   // Fetch Sold Items
//   useEffect(() => {
//     const fetchSoldItems = async () => {
//       try {
//         const soldItemsRef = ref(database, 'SoldItems');
//         const snapshot = await get(soldItemsRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const soldItemList = Object.keys(data).map((key) => ({
//             id: key,
//             ...data[key],
//           }));
//           setSoldItems(soldItemList);
//         } else {
//           setSoldItems([]);
//         }
//       } catch (error) {
//         console.error('Error fetching sold items:', error);
//         setErrorMessage('Failed to fetch sold items.');
//         setTimeout(() => setErrorMessage(null), 3000);
//       }
//     };

//     fetchSoldItems();
//   }, []);

//   // Fetch Customer Data (Assumed to be stored in 'Customers' reference)
//   useEffect(() => {
//     const fetchCustomerData = async () => {
//       try {
//         const customersRef = ref(database, 'customers');
//         const snapshot = await get(customersRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           setCustomerData(data);
//         } else {
//           setCustomerData({});
//         }
//       } catch (error) {
//         console.error('Error fetching customer data:', error);
//       }
//     };

//     fetchCustomerData();
//   }, []);

//   // Memoized filteredItems to prevent recalculating on every render
//   const filteredItemsMemo = useMemo(() => {
//     if (filterType === 'all') {
//       return soldItems;
//     } else if (filterType === 'day') {
//       return soldItems.filter((item) =>
//         new Date(item.dateScanned).toISOString().split('T')[0] === filterValue
//       );
//     } else if (filterType === 'month') {
//       return soldItems.filter(
//         (item) =>
//           new Date(item.dateScanned).getFullYear() === parseInt(filterValue.split('-')[0]) &&
//           new Date(item.dateScanned).getMonth() + 1 === parseInt(filterValue.split('-')[1])
//       );
//     }
//     return [];
//   }, [soldItems, filterType, filterValue]);

//   // Set filteredItems when filter is applied
//   const handleFilter = () => {
//     setFilteredItems(filteredItemsMemo);
//   };

//   // Handle Delete Item
//   const handleDeleteItem = async (id) => {
//     const confirmDelete = window.confirm('Are you sure you want to delete this item?');
//     if (!confirmDelete) return;

//     const itemRef = ref(database, `SoldItems/${id}`);
//     try {
//       await remove(itemRef);
//       setSoldItems(soldItems.filter((item) => item.id !== id));
//       setFilteredItems(filteredItems.filter((item) => item.id !== id));
//       setErrorMessage('Item deleted successfully!');
//       setTimeout(() => setErrorMessage(null), 3000);
//     } catch (error) {
//       console.error('Error deleting item:', error);
//       setErrorMessage('Failed to delete item.');
//       setTimeout(() => setErrorMessage(null), 3000);
//     }
//   };

//   // Export to Excel
//   const handleExportToExcel = () => {
//     if (filteredItems.length === 0) {
//       setErrorMessage('No data to export!');
//       setTimeout(() => setErrorMessage(null), 3000);
//       return;
//     }

//     // Prepare data for export in the correct order
//     const exportData = filteredItems.map((item) => ({
//       Date: new Date(item.dateScanned).toLocaleString(),
//       Customer: customerData[item.customerId]?.customerName || 'N/A', // Use customerName instead of name
//       ProductType: item.category || 'N/A',
//       QuantitySold: item.quantity || 0,
//       Price: `$${item.price?.toFixed(2) || '0.00'}`,
//       ItemCost: `$${item.cost?.toFixed(2) || '0.00'}`,
//       Employee: item.scannedBy || 'N/A',
//     }));

//     const worksheet = utils.json_to_sheet(exportData);
//     const workbook = utils.book_new();
//     utils.book_append_sheet(workbook, worksheet, 'Sold Items');

//     // Generate and download Excel file
//     writeFile(workbook, 'SoldItems.xlsx');
//   };

//   return (
//     <div className="sold-items-container">
//       <h1 className="sold-items-title">Sold Items</h1>

//       {/* Error Message */}
//       {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

//       {/* Filters */}
//       <div className="filter-container">
//         <select onChange={(e) => setFilterType(e.target.value)} value={filterType} className="filter-select">
//           <option value="all">All</option>
//           <option value="day">By Day</option>
//           <option value="month">By Month</option>
//         </select>
//         {filterType === 'day' && (
//           <input
//             type="date"
//             value={filterValue}
//             onChange={(e) => setFilterValue(e.target.value)}
//             className="filter-input"
//           />
//         )}
//         {filterType === 'month' && (
//           <select
//             value={filterValue}
//             onChange={(e) => setFilterValue(e.target.value)}
//             className="filter-input"
//           >
//             <option value="">Select Month</option>
//             {soldItems
//               .map((item) => new Date(item.dateScanned).toISOString().split('T')[0].slice(0, 7)) // Get year-month
//               .filter((value, index, self) => self.indexOf(value) === index) // Unique months
//               .map((month) => (
//                 <option key={month} value={month}>
//                   {month}
//                 </option>
//               ))}
//           </select>
//         )}
//         <button onClick={handleFilter} className="filter-button">Apply Filter</button>
//       </div>

//       {/* Export Button */}
//       <div className="export-button-container">
//         <button onClick={handleExportToExcel} className="export-button">
//           Export to Excel
//         </button>
//       </div>

//       {/* Sold Items List */}
//       <div className="sold-items-list">
//         {filteredItems.length === 0 ? (
//           <p>No items sold yet.</p>
//         ) : (
//           <table className="sold-items-table">
//             <thead>
//               <tr>
//                 <th>Date</th>
//                 <th>Customer</th>
//                 <th>Product Type</th>
//                 <th>Quantity Sold</th>
//                 <th>Price</th>
//                 <th>Item Cost</th>
//                 <th>Employee</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredItems.map((item) => (
//                 <tr key={item.id}>
//                   <td>{new Date(item.dateScanned).toLocaleString()}</td>
//                   <td>{customerData[item.customerId]?.customerName || 'N/A'}</td>
//                   <td>{item.category || 'N/A'}</td>
//                   <td>{item.quantity || 0}</td>
//                   <td>
//                     {typeof item.price === 'number'
//                       ? `$${item.price.toFixed(2)}`
//                       : 'N/A'}
//                   </td>
//                   <td>
//                     {typeof item.cost === 'number'
//                       ? `$${item.cost.toFixed(2)}`
//                       : 'N/A'}
//                   </td>
//                   <td>{item.scannedBy || 'N/A'}</td>
//                   <td>
//                     <button
//                       onClick={() => handleDeleteItem(item.id)}
//                       className="delete-button"
//                     >
//                       Delete
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SoldItems;

// import React, { useState, useEffect, useContext } from 'react';
// import { database } from '../Auth/firebase';
// import { ref, get } from 'firebase/database';
// import { UserContext } from '../Auth/userContext'; // Import the context
// import '../CSS/soldItems.css';

// const SoldItems = () => {
//   const { user } = useContext(UserContext); // Access the logged-in user
//   const [soldItems, setSoldItems] = useState([]);
//   const [errorMessage, setErrorMessage] = useState(null);

//   // Fetch Sold Items
//   useEffect(() => {
//     const fetchSoldItems = async () => {
//       try {
//         const soldItemsRef = ref(database, 'SoldItems');
//         const snapshot = await get(soldItemsRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const soldItemList = Object.keys(data).map((key) => ({
//             id: key,
//             ...data[key],
//           }));
//           setSoldItems(soldItemList);
//         } else {
//           setSoldItems([]);
//         }
//       } catch (error) {
//         console.error('Error fetching sold items:', error);
//         setErrorMessage('Failed to fetch sold items.');
//         setTimeout(() => setErrorMessage(null), 3000);
//       }
//     };

//     fetchSoldItems();
//   }, []);

//   return (
//     <div className="sold-items-container">
//       <h1 className="sold-items-title">Sold Items</h1>

//       {/* Error Message */}
//       {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

//       {/* Sold Items Table */}
//       <div className="sold-items-list">
//         {soldItems.length === 0 ? (
//           <p>No items sold yet.</p>
//         ) : (
//           <table className="sold-items-table">
//             <thead>
//               <tr>
//                 <th>Date</th>
//                 <th>Customer</th>
//                 <th>Product Type</th>
//                 <th>Quantity Sold</th>
//                 <th>Price</th>
//                 <th>Item Cost</th>
//                 <th>Employee</th>
//               </tr>
//             </thead>
//             <tbody>
//               {soldItems.map((item) => (
//                 <tr key={item.id}>
//                   <td>{new Date(item.dateScanned).toLocaleString()}</td>
//                   <td>{item.customerName || 'N/A'}</td>
//                   <td>{item.category || 'N/A'}</td>
//                   <td>{item.quantity || 0}</td>
//                   <td>{item.price ? `$${item.price.toFixed(2)}` : 'N/A'}</td>
//                   <td>{item.cost ? `$${item.cost.toFixed(2)}` : 'N/A'}</td>
//                   <td>{item.scannedBy || 'N/A'}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SoldItems;

import React, { useState, useEffect, useContext } from 'react';
import { database } from '../Auth/firebase';
import { ref, get } from 'firebase/database';
import { UserContext } from '../Auth/userContext'; // Import the context
import '../CSS/soldItems.css';

const SoldItems = () => {
  const { user } = useContext(UserContext); // Access the logged-in user
  const [soldItems, setSoldItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [filters, setFilters] = useState({
    customer: '',
    category: '',
    dateRange: { start: '', end: '' },
  });
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
          setFilteredItems(soldItemList); // Initialize filteredItems
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

  // Handle Filters
  const applyFilters = () => {
    const { customer, category, dateRange } = filters;
    const startDate = dateRange.start ? new Date(dateRange.start) : null;
    const endDate = dateRange.end ? new Date(dateRange.end) : null;

    const filtered = soldItems.filter((item) => {
      const matchesCustomer = customer
        ? item.customerName?.toLowerCase().includes(customer.toLowerCase())
        : true;
      const matchesCategory = category
        ? item.category?.toLowerCase().includes(category.toLowerCase())
        : true;
      const matchesDate =
        startDate && endDate
          ? new Date(item.dateScanned) >= startDate &&
            new Date(item.dateScanned) <= endDate
          : true;
      return matchesCustomer && matchesCategory && matchesDate;
    });

    setFilteredItems(filtered);
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        ['Date', 'Customer', 'Product Type', 'Quantity Sold', 'Price', 'Item Cost', 'Employee'],
        ...filteredItems.map((item) => [
          new Date(item.dateScanned).toLocaleString(),
          item.customerName || 'N/A',
          item.category || 'N/A',
          item.quantity || 0,
          item.price || 'N/A',
          item.cost || 'N/A',
          item.scannedBy || 'N/A',
        ]),
      ]
        .map((row) => row.join(','))
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sold_items.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="sold-items-container">
      <h1 className="sold-items-title">Sold Items</h1>

      {/* Error Message */}
      {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

      {/* Filters */}
      <div className="sold-items-filters">
        <input
          type="text"
          placeholder="Filter by customer"
          value={filters.customer}
          onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filter by category"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        />
        <input
          type="date"
          placeholder="Start date"
          onChange={(e) =>
            setFilters({
              ...filters,
              dateRange: { ...filters.dateRange, start: e.target.value },
            })
          }
        />
        <input
          type="date"
          placeholder="End date"
          onChange={(e) =>
            setFilters({
              ...filters,
              dateRange: { ...filters.dateRange, end: e.target.value },
            })
          }
        />
        <button onClick={applyFilters}>Apply Filters</button>
        <button onClick={exportToCSV}>Export to CSV</button>
      </div>

      {/* Sold Items Table */}
      <div className="sold-items-list">
        {filteredItems.length === 0 ? (
          <p>No items match the filters.</p>
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
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.dateScanned).toLocaleString()}</td>
                  <td>{item.customerName || 'N/A'}</td>
                  <td>{item.category || 'N/A'}</td>
                  <td>{item.quantity || 0}</td>
                  <td>{item.price ? `$${item.price.toFixed(2)}` : 'N/A'}</td>
                  <td>{item.cost ? `$${item.cost.toFixed(2)}` : 'N/A'}</td>
                  <td>{item.scannedBy || 'N/A'}</td>
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