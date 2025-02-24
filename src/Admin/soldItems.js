import React, { useState, useEffect, useContext } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, update, remove } from 'firebase/database';
import { UserContext } from '../Auth/userContext'; // Import the context
import '../CSS/soldItems.css';

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

  const [newCustomer, setNewCustomer] = useState('');
const [newProductType, setNewProductType] = useState('');
const [newQuantity, setNewQuantity] = useState('');

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0'); 
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // Convert to 12-hour format

  return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
};

  useEffect(() => {
    const fetchCustomersAndSoldItems = async () => {
      try {
        // Fetch customers data
        const customersRef = ref(database, 'customers');
        const customersSnapshot = await get(customersRef);
        let customerList = [];
  
        if (customersSnapshot.exists()) {
          const customersData = customersSnapshot.val();
          customerList = Object.keys(customersData).map((key) => ({
            id: key,
            name: customersData[key].name, // English name
            nameArabic: customersData[key].nameArabic, // Arabic name
          }));
        }
  
        console.log("Fetched Customers:", customerList); // Debugging
        setCustomers(customerList);
  
        // Fetch Sold Items
        const soldItemsRef = ref(database, 'SoldItems');
        const soldItemsSnapshot = await get(soldItemsRef);
        if (soldItemsSnapshot.exists()) {
          const soldData = soldItemsSnapshot.val();
          const soldItemList = Object.keys(soldData).map((key) => ({
            id: key,
            ...soldData[key],
            customerName:
              customerList.find(c => c.nameArabic === soldData[key].customerName)?.name ||
              soldData[key].customerName, // Convert Arabic to English if found
          }));
  
          setSoldItems(soldItemList);
          setFilteredItems(soldItemList);
        } else {
          setSoldItems([]);
          setFilteredItems([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setErrorMessage('Failed to fetch sold items.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };
  
    fetchCustomersAndSoldItems();
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
  } else if (filterType === 'By Unpaid') {
    filtered = filtered.filter((item) => item.paymentStatus === 'Unpaid');
  }

  setFilteredItems(filtered);
}, [filterType, searchTerm, dateFilter, monthFilter, soldItems]);

  const handleEdit = (item) => {
    setEditingItem(item);
    setNewRemark(item.remark || '');
    setNewTotalCost(item.totalCost || '');
    setNewPaymentStatus(item.paymentStatus || 'Paid');
    setNewCustomer(item.customerName || '');
    setNewProductType(item.name || '');
    setNewQuantity(item.quantity || 0);
  };

  const saveEditedItem = async () => {
    if (editingItem) {
      const itemRef = ref(database, `SoldItems/${editingItem.id}`);
      try {
        await update(itemRef, {
          remark: newRemark,
          totalCost: newTotalCost,
          paymentStatus: newPaymentStatus,
          customerName: newCustomer,
          name: newProductType,
          quantity: newQuantity,
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
              }
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
    setSoldItems(soldItems.filter((item) => item.id !== itemId)); 
    setFilteredItems(filteredItems.filter((item) => item.id !== itemId)); 
    setShowConfirmation(false);
  };

  // const exportToCSV = () => {
  //   const csvContent =
  //     'data:text/csv;charset=utf-8,' +
  //     [
  //       ['Date', 'Customer', 'Product Type (English)', 'Quantity Sold', 'Price', 'Item Cost', 'Employee', 'Remarks', 'Total Cost', 'Payment Status'],
  //       ...filteredItems.map((item) => [
  //         new Date(item.dateScanned).toLocaleString(),
  //         item.customerName || 'N/A',
  //         item.name_en || item.name || 'N/A',
  //         item.quantity || 0,
  //         item.price || 'N/A',
  //         item.cost || 'N/A',
  //         item.scannedBy || 'N/A',
  //         item.remark || 'N/A',
  //         item.totalCost || 'N/A',
  //         item.paymentStatus || 'Paid',
  //       ]),
  //     ]
  //       .map((row) => row.join(','))
  //       .join('\n');
  
  //   const encodedUri = encodeURI(csvContent);
  //   const link = document.createElement('a');
  //   link.setAttribute('href', encodedUri);
  //   link.setAttribute('download', 'filtered_sold_items.csv');
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // };
  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      alert("No data to export.");
      return;
    }
  
    const headers = [
      "Date",
      "Customer",
      "Product Type",
      "Quantity Sold",
      "Price",
      "Item Cost",
      "Employee",
      "Remarks",
      "Total Cost",
      "Payment Status",
    ];
  
    const rows = filteredItems.map((item) => [
      formatDateTime(item.dateScanned), // Ensure proper date formatting
      item.customerName || "N/A",
      item.name || "N/A",
      item.quantity || 0,
      item.price || "N/A",
      item.cost || "N/A",
      item.scannedBy || "N/A",
      item.remark || "N/A",
      item.totalCost || "N/A",
      item.paymentStatus || "Paid",
    ]);
  
    const csvContent =
      "\ufeff" + // Add BOM to support special characters
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(",")) // Wrap each cell in quotes to handle commas
        .join("\n");
  
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "filtered_sold_items.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Show Confirmation Pop-Up
  const handleDeleteConfirmation = (itemId) => {
    setItemIdToDelete(itemId); 
    setShowConfirmation(true);
  };

  // Confirm Delete
  const confirmDelete = () => {
    if (itemIdToDelete) {
      handleDelete(itemIdToDelete);
    }
  };

  // Cancel Delete
  const cancelDelete = () => {
    setShowConfirmation(false);
    setItemIdToDelete(null);
  };

  return (
    <div className="sold-items-container">
      <h1 className="sold-items-title">Sold Items</h1>

      {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

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
          <option value="By Unpaid">unPaid</option>
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
      {/* <td>{new Date(item.dateScanned).toLocaleString()}</td> */}
      <td>{formatDateTime(item.dateScanned)}</td>
      {/* <td>
        {editingItem && editingItem.id === item.id ? (
          <input
            type="text"
            value={newCustomer}
            onChange={(e) => setNewCustomer(e.target.value)}
          />
        ) : (
          item.customerName || 'N/A'
        )}
      </td> */}
      <td>
  {editingItem && editingItem.id === item.id ? (
    <select value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)}>
      <option value="">Select Customer</option>
      {customers.length > 0 ? (
        customers.map((customer) => (
          <option key={customer.id} value={customer.name}>
            {customer.name}
          </option>
        ))
      ) : (
        <option disabled>No Customers Found</option>
      )}
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
          />
        ) : (
          item.quantity || 0
        )}
      </td>
      <td>{item.itemCost ? `$${item.itemCost.toFixed(2)}` : 'N/A'}</td>
      <td>{item.scannedBy || 'N/A'}</td>
      <td>
        {editingItem && editingItem.id === item.id ? (
          <input
            type="text"
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
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
          />
        ) : (
          item.totalCost ? `$${item.totalCost}` : 'N/A'
        )}
      </td>
      <td>
        {editingItem && editingItem.id === item.id ? (
          <select
            value={newPaymentStatus}
            onChange={(e) => setNewPaymentStatus(e.target.value)}
          >
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Stock">Stock</option>
          </select>
        ) : (
          item.paymentStatus || 'Paid'
        )}
      </td>
      <td>
        {editingItem && editingItem.id === item.id ? (
          <>
            <button onClick={saveEditedItem}>Save</button>
            <button onClick={() => setEditingItem(null)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => handleEdit(item)}>Edit</button>
            <button onClick={() => handleDeleteConfirmation(item.id)}>Delete</button>
          </>
        )}
      </td>
    </tr>
  ))}
</tbody>
          </table>
        )}
      </div>

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