  import React, { useState, useEffect, useContext } from 'react';
  import { database } from '../Auth/firebase';
  import { ref, set, get, update, remove, onValue, push } from 'firebase/database';
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
    
    const [checkedItems, setCheckedItems] = useState(() => {
      const saved = localStorage.getItem('checkedSoldItems');
      return saved ? JSON.parse(saved) : [];
    });
    const [checkFilter, setCheckFilter] = useState('all'); // 'all', 'checked', 'unchecked'

    // State for manual add form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState({
      customerName: '',
      name: '',
      quantity: 1,
      price: '',
      cost: '',
      totalCost: '',
      remark: '',
      paymentStatus: 'Paid',
      dateScanned: new Date().toISOString()
    });
    const [products, setProducts] = useState([]);
    const [successMessage, setSuccessMessage] = useState(null);

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
      const soldItemsRef = ref(database, 'SoldItems');

      const unsubscribe = onValue(soldItemsRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const updates = [];

          for (const key in data) {
            if (data[key].paymentStatus === 'Stock') {
              const stockItem = data[key];
              const transactionsRef = ref(database, `transactions/${key}`);

              updates.push(
                set(transactionsRef, {
                  ...stockItem,
                  movedToTransactionsAt: new Date().toISOString(),
                }).then(() => remove(ref(database, `SoldItems/${key}`)))
              );
            }
          }

          await Promise.all(updates);
        }
      });

      return () => unsubscribe(); // Cleanup on unmount
    }, []);

    // Move stock items to transactions immediately
    useEffect(() => {
      const moveStockItems = async () => {
        try {
          const soldItemsRef = ref(database, 'SoldItems');
          const snapshot = await get(soldItemsRef);
          
          if (snapshot.exists()) {
            const data = snapshot.val();
            
            for (const key in data) {
              if (data[key].paymentStatus === 'Stock') {
                const stockItem = data[key];
                const transactionsRef = ref(database, `transactions/${key}`);

                // Move item to transactions
                await set(transactionsRef, {
                  ...stockItem,
                  movedToTransactionsAt: new Date().toISOString(), // Timestamp when moved
                });

                // Remove from SoldItems
                await remove(ref(database, `SoldItems/${key}`));
              }
            }
          }
        } catch (error) {
          console.error('Error moving stock items:', error);
        }
      };

      moveStockItems();
    }, []);

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
    
          setCustomers(customerList);
    
          // Fetch products for dropdown in add form
          const productsRef = ref(database, 'products');
          const productsSnapshot = await get(productsRef);
          if (productsSnapshot.exists()) {
            const productsData = productsSnapshot.val();
            const productsList = Object.keys(productsData).map((key) => ({
              id: key,
              name: productsData[key].name,
              cost: productsData[key].cost,
              price: productsData[key].price,
            }));
            setProducts(productsList);
          }
    
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
    
//     // Handle Filtering
//     useEffect(() => {
//       let filtered = [...soldItems];
    
//       if (filterType === 'Customer' && searchTerm) {
//         filtered = filtered.filter((item) =>
//           item.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
//         );
//       } else if (filterType === 'Date' && dateFilter) {
//         filtered = filtered.filter(
//           (item) =>
//             new Date(item.dateScanned).toLocaleDateString() ===
//             new Date(dateFilter).toLocaleDateString()
//         );
//       } else if (filterType === 'Month' && monthFilter) {
//         filtered = filtered.filter(
//           (item) =>
//             new Date(item.dateScanned).getMonth() + 1 === parseInt(monthFilter, 10)
//         );
//       } else if (filterType === 'By Unpaid') {
//         filtered = filtered.filter((item) => item.paymentStatus === 'Unpaid');
//       } else if (filterType === 'By Stock') {
//         filtered = filtered.filter((item) => item.paymentStatus === 'Stock');
//       } else if (filterType === 'By Paid') { // New filter logic for Paid status
//         filtered = filtered.filter((item) => item.paymentStatus === 'Paid');
//       } else if (filterType === 'By Product' && searchTerm) { // New filter logic for Products
//         filtered = filtered.filter((item) =>
//           item.name?.toLowerCase().includes(searchTerm.toLowerCase())
//         );
        
//     // Apply check filter
//   if (checkFilter === 'checked') {
//     filtered = filtered.filter((item) => checkedItems.includes(item.id));
//   } else if (checkFilter === 'unchecked') {
//     filtered = filtered.filter((item) => !checkedItems.includes(item.id));
//   }
// }
    
// setFilteredItems(filtered);
// }, [filterType, searchTerm, dateFilter, monthFilter, soldItems, checkedItems, checkFilter]);

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
  } else if (filterType === 'By Stock') {
    filtered = filtered.filter((item) => item.paymentStatus === 'Stock');
  } else if (filterType === 'By Paid') {
    filtered = filtered.filter((item) => item.paymentStatus === 'Paid');
  } else if (filterType === 'By Product' && searchTerm) {
    filtered = filtered.filter((item) =>
      item.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Apply check filter (this was incorrectly nested inside the By Product condition)
  if (checkFilter === 'checked') {
    filtered = filtered.filter((item) => checkedItems.includes(item.id));
  } else if (checkFilter === 'unchecked') {
    filtered = filtered.filter((item) => !checkedItems.includes(item.id));
  }

  setFilteredItems(filtered);
}, [filterType, searchTerm, dateFilter, monthFilter, soldItems, checkedItems, checkFilter]);

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

    // Handle Add Form Input Changes
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setNewItem({
        ...newItem,
        [name]: value,
      });

      // Auto-fill price and cost if a product is selected
      if (name === 'name') {
        const selectedProduct = products.find(p => p.name === value);
        if (selectedProduct) {
          setNewItem(prev => ({
            ...prev,
            name: value,
            price: selectedProduct.price || '',
            cost: selectedProduct.cost || '',
            totalCost: prev.quantity * (selectedProduct.price || 0)
          }));
        }
      }

      // Update total cost when quantity or price changes
      if (name === 'quantity' || name === 'price') {
        const quantity = name === 'quantity' ? Number(value) : Number(newItem.quantity);
        const price = name === 'price' ? Number(value) : Number(newItem.price);
        setNewItem(prev => ({
          ...prev,
          [name]: value,
          totalCost: (quantity * price).toString()
        }));
      }
    };

    // Handle Date Change for manual add
    const handleDateChange = (e) => {
      const selectedDate = e.target.value;
      // Create a date object at noon to avoid timezone issues
      const date = new Date(selectedDate + 'T12:00:00');
      setNewItem({
        ...newItem,
        dateScanned: date.toISOString()
      });
    };

    // Submit New Item
    const handleSubmitNewItem = async (e) => {
      e.preventDefault();
      
      try {
        // Validation
        if (!newItem.customerName || !newItem.name || !newItem.quantity || !newItem.price) {
          setErrorMessage('Please fill in all required fields.');
          setTimeout(() => setErrorMessage(null), 3000);
          return;
        }

        // Add the current user as the one who added this item
        const itemToAdd = {
          ...newItem,
          scannedBy: user?.email || 'Manual Entry',
          quantity: Number(newItem.quantity),
          price: Number(newItem.price),
          cost: Number(newItem.cost),
          totalCost: Number(newItem.totalCost),
          manuallyAdded: true,
          addedAt: new Date().toISOString()
        };

        // Push to database with a new unique key
        const newItemRef = push(ref(database, 'SoldItems'));
        await set(newItemRef, itemToAdd);

        // Add to the local state with the new ID
        const newItemWithId = {
          id: newItemRef.key,
          ...itemToAdd
        };
        
        setSoldItems([...soldItems, newItemWithId]);
        setFilteredItems([...filteredItems, newItemWithId]);
        
        // Reset form
        setNewItem({
          customerName: '',
          name: '',
          quantity: 1,
          price: '',
          cost: '',
          totalCost: '',
          remark: '',
          paymentStatus: 'Paid',
          dateScanned: new Date().toISOString()
        });
        
        setSuccessMessage('Item added successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        
        // Hide form after successful addition
        setShowAddForm(false);
      } catch (error) {
        console.error('Error adding new item:', error);
        setErrorMessage('Failed to add item. Please try again.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    // Get Today's Date in YYYY-MM-DD format for the date input
    const getTodayFormatted = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

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

    return (
      <div className="sold-items-container">
        <h1 className="sold-items-title">Sold Items</h1>

        {errorMessage && <div className="sold-items-error">{errorMessage}</div>}
        {successMessage && <div className="sold-items-success">{successMessage}</div>}

        <div className="sold-items-actions">
          <button 
            className="add-item-button"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Hide Add Form' : 'Add Item Manually'}
          </button>
          
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
              <option value="By Paid">Paid</option>
              <option value="By Stock">Stock</option>
              <option value="By Product">By Product</option>
            </select>

            <div className="check-controls">
  <select
    value={checkFilter}
    onChange={(e) => setCheckFilter(e.target.value)}
    className="check-filter"
  >
    <option value="all">All Items</option>
    <option value="checked">Checked Items</option>
    <option value="unchecked">Unchecked Items</option>
  </select>
  
  <button 
    onClick={clearAllChecks}
    className="clear-checks-button"
  >
    Clear All Checks
  </button>
</div>

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
                    <option key={index} value={customer.name}>
                      {customer.name}
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

            {filterType === 'By Product' && (
              <input
                type="text"
                placeholder="Search product"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}

            <button onClick={exportToCSV}>Export to CSV</button>
          </div>
        </div>

        {/* Manual Add Form */}
        {showAddForm && (
          <div className="manual-add-form">
            <h3>Add New Sold Item</h3>
            <form onSubmit={handleSubmitNewItem}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customerName">Customer*</label>
                  <select
                    id="customerName"
                    name="customerName"
                    value={newItem.customerName}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.name}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="name">Product*</label>
                  <select
                    id="name"
                    name="name"
                    value={newItem.name}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="quantity">Quantity*</label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    min="1"
                    value={newItem.quantity}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="price">Price*</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    step="0.01"
                    value={newItem.price}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="cost">Cost</label>
                  <input
                    type="number"
                    id="cost"
                    name="cost"
                    step="0.01"
                    value={newItem.cost}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="totalCost">Total Cost*</label>
                  <input
                    type="number"
                    id="totalCost"
                    name="totalCost"
                    step="0.01"
                    value={newItem.totalCost}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dateScanned">Date*</label>
                  <input
                    type="date"
                    id="dateScanned"
                    name="dateScanned"
                    defaultValue={getTodayFormatted()}
                    onChange={handleDateChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="paymentStatus">Payment Status*</label>
                  <select
                    id="paymentStatus"
                    name="paymentStatus"
                    value={newItem.paymentStatus}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Stock">Stock</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group full-width">
                  <label htmlFor="remark">Remarks</label>
                  <textarea
                    id="remark"
                    name="remark"
                    value={newItem.remark}
                    onChange={handleInputChange}
                    rows="2"
                  />
                </div>
              </div>
              
              <div className="form-buttons">
                <button type="submit" className="submit-button">Add Item</button>
                <button type="button" className="cancel-button" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

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
                  <th>Check</th>
                </tr>
              </thead>
              <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={item.manuallyAdded ? "manually-added" : ""}>
                  <td>{formatDateTime(item.dateScanned)}</td>
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
                  <td>{item.cost ? `$${Number(item.cost).toFixed(2)}` : 'N/A'}</td>
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
                      item.totalCost ? `$${Number(item.totalCost).toFixed(2)}` : 'N/A'
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
                      <>
                        {item.paymentStatus}
                        {item.paymentStatus === 'Stock' && (
                          <button
                            onClick={async () => {
                              const itemRef = ref(database, `SoldItems/${item.id}`);
                              try {
                                await update(itemRef, { paymentStatus: 'Stock Confirmed' });
                                setSoldItems(soldItems.map((i) => 
                                  i.id === item.id ? { ...i, paymentStatus: 'Stock Confirmed' } : i
                                ));
                                setFilteredItems(filteredItems.map((i) => 
                                  i.id === item.id ? { ...i, paymentStatus: 'Stock Confirmed' } : i
                                ));
                              } catch (error) {
                                console.error('Error confirming item:', error);
                              }
                            }}
                            disabled={item.paymentStatus === 'Stock Confirmed'}
                            style={{ marginLeft: '10px' }}
                          >
                            Confirm
                          </button>
                        )}
                      </>
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

                  <td>
  <input 
    type="checkbox"
    checked={checkedItems.includes(item.id)}
    onChange={() => handleCheckboxChange(item.id)}
  />
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