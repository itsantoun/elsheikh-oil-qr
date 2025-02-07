// import React, { useState, useEffect, useContext } from 'react';
// import { database } from '../Auth/firebase';
// import { ref, get, update, remove } from 'firebase/database';
// import { UserContext } from '../Auth/userContext'; // Import the context
// import '../CSS/soldItems.css';
// import RemainingProducts from './remainingProducts';

// const SoldItems = () => {
//   const { user } = useContext(UserContext); // Access the logged-in user
//   const [soldItems, setSoldItems] = useState([]);
//   const [filteredItems, setFilteredItems] = useState([]);
//   const [filterType, setFilterType] = useState('All');
//   const [searchTerm, setSearchTerm] = useState('');
//   const [dateFilter, setDateFilter] = useState('');
//   const [monthFilter, setMonthFilter] = useState('');
//   const [customers, setCustomers] = useState([]);
//   const [errorMessage, setErrorMessage] = useState(null);
  
//   const [editingItem, setEditingItem] = useState(null); // State to track the item being edited
//   const [newRemark, setNewRemark] = useState('');
//   const [newTotalCost, setNewTotalCost] = useState('');
//   const [newPaymentStatus, setNewPaymentStatus] = useState('');

//   const [showConfirmation, setShowConfirmation] = useState(false); // Track confirmation modal visibility
//   const [itemIdToDelete, setItemIdToDelete] = useState(null);


//   // // Fetch Sold Items
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
//           setFilteredItems(soldItemList); // Initialize filteredItems
//           setCustomers([...new Set(soldItemList.map((item) => item.customerName || 'N/A'))]);
//         } else {
//           setSoldItems([]);
//           setFilteredItems([]);
//           setCustomers([]);
//         }
//       } catch (error) {
//         console.error('Error fetching sold items:', error);
//         setErrorMessage('Failed to fetch sold items.');
//         setTimeout(() => setErrorMessage(null), 3000);
//       }
//     };

//     fetchSoldItems();
//   }, []);



//   // Handle Filtering
//   useEffect(() => {
//     let filtered = [...soldItems];

//     if (filterType === 'Customer' && searchTerm) {
//       filtered = filtered.filter((item) =>
//         item.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
//       );
//     } else if (filterType === 'Date' && dateFilter) {
//       filtered = filtered.filter(
//         (item) =>
//           new Date(item.dateScanned).toLocaleDateString() ===
//           new Date(dateFilter).toLocaleDateString()
//       );
//     } else if (filterType === 'Month' && monthFilter) {
//       filtered = filtered.filter(
//         (item) =>
//           new Date(item.dateScanned).getMonth() + 1 === parseInt(monthFilter, 10)
//       );
//     }

//     setFilteredItems(filtered);
//   }, [filterType, searchTerm, dateFilter, monthFilter, soldItems]);

//   // Handle Edit Action
//   const handleEdit = (itemId) => {
//     const item = soldItems.find((item) => item.id === itemId);
//     setEditingItem(item);
//     setNewRemark(item.remark || '');
//     setNewTotalCost(item.totalCost || '');
//     setNewPaymentStatus(item.paymentStatus || 'Paid');
//   };

//   // Save Edited Data to Firebase
// const saveEditedItem = async () => {
//   if (editingItem) {
//     // Get the reference to the item in Firebase
//     const itemRef = ref(database, `SoldItems/${editingItem.id}`);
    
//     try {
//       // Update only the required fields in Firebase
//       await update(itemRef, {
//         remark: newRemark,
//         totalCost: newTotalCost,
//         paymentStatus: newPaymentStatus,
//       });
      
//       // After updating Firebase, update the local state
//       const updatedItems = soldItems.map((item) =>
//         item.id === editingItem.id
//           ? { ...item, remark: newRemark, totalCost: newTotalCost, paymentStatus: newPaymentStatus }
//           : item
//       );
      
//       // Set the updated items back to the state
//       setSoldItems(updatedItems);
//       setFilteredItems(updatedItems);

//       // Reset the editing state
//       setEditingItem(null);
//     } catch (error) {
//       console.error('Error updating the item:', error);
//     }
//   }
// };

//   // Handle Delete Action
//   const handleDelete = async (itemId) => {
//     const itemRef = ref(database, `SoldItems/${itemId}`);
//     await remove(itemRef);
//     setSoldItems(soldItems.filter((item) => item.id !== itemId)); // Update the local state
//     setFilteredItems(filteredItems.filter((item) => item.id !== itemId)); // Update the filtered items
//   };

//   // Export to CSV
//   const exportToCSV = () => {
//     const csvContent =
//       'data:text/csv;charset=utf-8,' +
//       [
//         ['Date', 'Customer', 'Product Type', 'Quantity Sold', 'Price', 'Item Cost', 'Employee', 'Remarks', 'Total Cost', 'Payment Status'],
//         ...filteredItems.map((item) => [
//           new Date(item.dateScanned).toLocaleString(),
//           item.customerName || 'N/A',
//           item.name || 'N/A',
//           item.quantity || 0,
//           item.price || 'N/A',
//           item.cost || 'N/A',
//           item.scannedBy || 'N/A',
//           item.remark || 'N/A',
//           item.totalCost || 'N/A',
//           item.paymentStatus || 'Paid',
//         ]),
//       ]
//         .map((row) => row.join(','))
//         .join('\n');

//     const encodedUri = encodeURI(csvContent);
//     const link = document.createElement('a');
//     link.setAttribute('href', encodedUri);
//     link.setAttribute('download', 'filtered_sold_items.csv');
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const handleDeleteConfirmation = (itemId) => {
//     setShowConfirmation(true); // Show the confirmation modal
//     setItemIdToDelete(itemId); // Store the item ID to delete
//   };


//   return (
//     <div className="sold-items-container">
//       <h1 className="sold-items-title">Sold Items</h1>

//       {/* Error Message */}
//       {errorMessage && <div className="sold-items-error">{errorMessage}</div>}
//       {/* <RemainingProducts soldItems={soldItems} totalQuantities={totalQuantities} /> */}
//       {/* Filters */}
//       <div className="sold-items-filters">
//         <select
//           value={filterType}
//           onChange={(e) => {
//             setFilterType(e.target.value);
//             setSearchTerm('');
//             setDateFilter('');
//             setMonthFilter('');
//           }}
//         >
//           <option value="All">All</option>
//           <option value="Customer">By Customer</option>
//           <option value="Date">By Date</option>
//           <option value="Month">By Month</option>
//         </select>

//         {filterType === 'Customer' && (
//           <div>
//             <input
//               type="text"
//               placeholder="Search customer"
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             />
//             <select
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             >
//               <option value="">Select Customer</option>
//               {customers.map((customer, index) => (
//                 <option key={index} value={customer}>
//                   {customer}
//                 </option>
//               ))}
//             </select>
//           </div>
//         )}

//         {filterType === 'Date' && (
//           <input
//             type="date"
//             value={dateFilter}
//             onChange={(e) => setDateFilter(e.target.value)}
//           />
//         )}

//         {filterType === 'Month' && (
//           <select
//             value={monthFilter}
//             onChange={(e) => setMonthFilter(e.target.value)}
//           >
//             <option value="">Select Month</option>
//             {[...Array(12).keys()].map((month) => (
//               <option key={month} value={month + 1}>
//                 {new Date(0, month).toLocaleString('default', { month: 'long' })}
//               </option>
//             ))}
//           </select>
//         )}

//         <button onClick={exportToCSV}>Export to CSV</button>
//       </div>

//       {/* Sold Items Table */}
//       <div className="sold-items-list">
//         {filteredItems.length === 0 ? (
//           <p>No items match the filters.</p>
//         ) : (
//           <table className="sold-items-table">
//             <thead>
//               <tr>
//                 <th>Date</th>
//                 <th>Customer</th>
//                 <th>Product Type</th>
//                 <th>Quantity Sold</th>
//                 {/* <th>Price</th> */}
//                 <th>Item Cost</th>
//                 <th>Employee</th>
//                 <th>Remarks</th>
//                 <th>Total Cost</th>
//                 <th>Payment Status</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredItems.map((item) => (
//                 <tr key={item.id}>
//                   <td>{new Date(item.dateScanned).toLocaleString()}</td>
//                   <td>{item.customerName || 'N/A'}</td>
//                   <td>{item.name || 'N/A'}</td>
//                   <td>{item.quantity || 0}</td>
//                   {/* <td>{item.price ? `$${item.price.toFixed(2)}` : 'N/A'}</td> */}
//                   <td>{item.cost ? `$${item.cost.toFixed(2)}` : 'N/A'}</td>
//                   <td>{item.scannedBy || 'N/A'}</td>
//                   <td>{item.remark || 'N/A'}</td>
//                   <td>{item.totalCost ? `$${item.totalCost}` : 'N/A'}</td>
//                   <td>{item.paymentStatus || 'Paid'}</td>
//                   <td>
//                     <button onClick={() => handleEdit(item.id)}>Edit</button>
//                     <button onClick={() => handleDelete(item.id)}>Delete</button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>

//       {/* Edit Modal */}
//       {editingItem && (
//         <div className="edit-modal">
//           <h3>Edit Item</h3>
//           <label>Remarks:</label>
//           <input
//             type="text"
//             value={newRemark}
//             onChange={(e) => setNewRemark(e.target.value)}
//           />
//           <label>Total Cost:</label>
//           <input
//             type="number"
//             value={newTotalCost}
//             onChange={(e) => setNewTotalCost(e.target.value)}
//           />
//           <label>Payment Status:</label>
//           <select
//             value={newPaymentStatus}
//             onChange={(e) => setNewPaymentStatus(e.target.value)}
//           >
//             <option value="Paid">Paid</option>
//             <option value="Unpaid">Unpaid</option>
//           </select>
//           <button onClick={saveEditedItem}>Save</button>
//           <button onClick={() => setEditingItem(null)}>Cancel</button>
//         </div>
//       )}
//     </div>
    
//   );
// };

// export default SoldItems;

import React, { useState, useEffect, useContext } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, update, remove } from 'firebase/database';
import { UserContext } from '../Auth/userContext'; // Import the context
import '../CSS/soldItems.css';
import RemainingProducts from './remainingProducts';

const SoldItems = () => {
  const { user } = useContext(UserContext); // Access the logged-in user
  const [soldItems, setSoldItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [customers, setCustomers] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  
  const [editingItem, setEditingItem] = useState(null); // State to track the item being edited
  const [newRemark, setNewRemark] = useState('');
  const [newTotalCost, setNewTotalCost] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');

  const [showConfirmation, setShowConfirmation] = useState(false); // Track confirmation modal visibility
  const [itemIdToDelete, setItemIdToDelete] = useState(null);

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
          setCustomers([...new Set(soldItemList.map((item) => item.customerName || 'N/A'))]);
        } else {
          setSoldItems([]);
          setFilteredItems([]);
          setCustomers([]);
        }
      } catch (error) {
        console.error('Error fetching sold items:', error);
        setErrorMessage('Failed to fetch sold items.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    fetchSoldItems();
  }, []);

  // Handle Filtering
  useEffect(() => {
    let filtered = [...soldItems];

    if (filterType === 'Customer' && searchTerm) {
      filtered = filtered.filter((item) =>
        item.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (filterType === 'Date' && dateFilter) {
      filtered = filtered.filter(
        (item) =>
          new Date(item.dateScanned).toLocaleDateString() ===
          new Date(dateFilter).toLocaleDateString()
      );
    } else if (filterType === 'Month' && monthFilter) {
      filtered = filtered.filter(
        (item) =>
          new Date(item.dateScanned).getMonth() + 1 === parseInt(monthFilter, 10)
      );
    }

    setFilteredItems(filtered);
  }, [filterType, searchTerm, dateFilter, monthFilter, soldItems]);

  // Handle Edit Action
  const handleEdit = (itemId) => {
    const item = soldItems.find((item) => item.id === itemId);
    setEditingItem(item);
    setNewRemark(item.remark || '');
    setNewTotalCost(item.totalCost || '');
    setNewPaymentStatus(item.paymentStatus || 'Paid');
  };

  // Save Edited Data to Firebase
  const saveEditedItem = async () => {
    if (editingItem) {
      const itemRef = ref(database, `SoldItems/${editingItem.id}`);
      try {
        await update(itemRef, {
          remark: newRemark,
          totalCost: newTotalCost,
          paymentStatus: newPaymentStatus,
        });
        const updatedItems = soldItems.map((item) =>
          item.id === editingItem.id
            ? { ...item, remark: newRemark, totalCost: newTotalCost, paymentStatus: newPaymentStatus }
            : item
        );
        setSoldItems(updatedItems);
        setFilteredItems(updatedItems);
        setEditingItem(null);
      } catch (error) {
        console.error('Error updating the item:', error);
      }
    }
  };

  // Handle Delete Action
  const handleDelete = async (itemId) => {
    const itemRef = ref(database, `SoldItems/${itemId}`);
    await remove(itemRef);
    setSoldItems(soldItems.filter((item) => item.id !== itemId)); // Update the local state
    setFilteredItems(filteredItems.filter((item) => item.id !== itemId)); // Update the filtered items
    setShowConfirmation(false); // Hide the confirmation modal after deletion
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        ['Date', 'Customer', 'Product Type', 'Quantity Sold', 'Price', 'Item Cost', 'Employee', 'Remarks', 'Total Cost', 'Payment Status'],
        ...filteredItems.map((item) => [
          new Date(item.dateScanned).toLocaleString(),
          item.customerName || 'N/A',
          item.name || 'N/A',
          item.quantity || 0,
          item.price || 'N/A',
          item.cost || 'N/A',
          item.scannedBy || 'N/A',
          item.remark || 'N/A',
          item.totalCost || 'N/A',
          item.paymentStatus || 'Paid',
        ]),
      ]
        .map((row) => row.join(','))
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'filtered_sold_items.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Show Confirmation Pop-Up
  const handleDeleteConfirmation = (itemId) => {
    setItemIdToDelete(itemId); // Store the item ID to delete
    setShowConfirmation(true); // Show the confirmation pop-up
  };

  // Confirm Delete
  const confirmDelete = () => {
    if (itemIdToDelete) {
      handleDelete(itemIdToDelete);
    }
  };

  // Cancel Delete
  const cancelDelete = () => {
    setShowConfirmation(false); // Hide the confirmation pop-up
    setItemIdToDelete(null); // Clear the item ID to delete
  };

  return (
    <div className="sold-items-container">
      <h1 className="sold-items-title">Sold Items</h1>

      {/* Error Message */}
      {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

      {/* Filters */}
      <div className="sold-items-filters">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setSearchTerm('');
            setDateFilter('');
            setMonthFilter('');
          }}
        >
          <option value="All">All</option>
          <option value="Customer">By Customer</option>
          <option value="Date">By Date</option>
          <option value="Month">By Month</option>
        </select>

        {filterType === 'Customer' && (
          <div>
            <input
              type="text"
              placeholder="Search customer"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            >
              <option value="">Select Customer</option>
              {customers.map((customer, index) => (
                <option key={index} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterType === 'Date' && (
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        )}

        {filterType === 'Month' && (
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">Select Month</option>
            {[...Array(12).keys()].map((month) => (
              <option key={month} value={month + 1}>
                {new Date(0, month).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        )}

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
                <th>Item Cost</th>
                <th>Employee</th>
                <th>Remarks</th>
                <th>Total Cost</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.dateScanned).toLocaleString()}</td>
                  <td>{item.customerName || 'N/A'}</td>
                  <td>{item.name || 'N/A'}</td>
                  <td>{item.quantity || 0}</td>
                  <td>{item.itemCost ? `$${item.itemCost.toFixed(2)}` : 'N/A'}</td>
                  <td>{item.scannedBy || 'N/A'}</td>
                  <td>{item.remark || 'N/A'}</td>
                  <td>{item.totalCost ? `$${item.totalCost}` : 'N/A'}</td>
                  <td>{item.paymentStatus || 'Paid'}</td>
                  <td>
                    <button onClick={() => handleEdit(item.id)}>Edit</button>
                    <button onClick={() => handleDeleteConfirmation(item.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="edit-modal">
          <h3>Edit Item</h3>
          <label>Remarks:</label>
          <input
            type="text"
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
          />
          <label>Total Cost:</label>
          <input
            type="number"
            value={newTotalCost}
            onChange={(e) => setNewTotalCost(e.target.value)}
          />
          <label>Payment Status:</label>
          <select
            value={newPaymentStatus}
            onChange={(e) => setNewPaymentStatus(e.target.value)}
          >
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
          <button onClick={saveEditedItem}>Save</button>
          <button onClick={() => setEditingItem(null)}>Cancel</button>
        </div>
      )}

      {/* Confirmation Pop-Up */}
      {showConfirmation && (
        <div className="confirmation-popup-overlay">
          <div className="confirmation-popup">
            <h3>Are you sure you want to delete this item?</h3>
            <div className="confirmation-buttons">
              <button onClick={confirmDelete}>Yes, Delete</button>
              <button onClick={cancelDelete}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoldItems;

// I am still fixoing the pop up delete not working well