import React, { useState, useEffect, useContext } from 'react';
import { database } from '../Auth/firebase';
import { ref, set, get, update, remove, onValue, push, child } from 'firebase/database';
import { UserContext } from '../Auth/userContext'; // Import the context
import '../CSS/soldItems.css';
import Barcode from 'react-barcode';

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

  const [newDate, setNewDate] = useState('');

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

  const [showMissingItemsModal, setShowMissingItemsModal] = useState(false);
const [products, setProducts] = useState([]);
const [selectedProduct, setSelectedProduct] = useState(null);
const [scannedBarcode, setScannedBarcode] = useState('');

const fetchProducts = async () => {
  try {
    const productsRef = ref(database, 'products');
    const snapshot = await get(productsRef);
    if (snapshot.exists()) {
      const productsData = snapshot.val();
      const productList = Object.keys(productsData).map((key) => ({
        id: key,
        barcode: key,
        ...productsData[key],
      }));
      setProducts(productList);
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    setErrorMessage('Failed to fetch products.');
    setTimeout(() => setErrorMessage(null), 3000);
  }
};

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

  const sortItemsByDate = (items, order = 'asc') => {  // Changed default to 'asc'
    return [...items].sort((a, b) => {
      const dateA = new Date(a.dateScanned);
      const dateB = new Date(b.dateScanned);
      return order === 'asc' ? dateA - dateB : dateB - dateA;  // Changed comparison
    });
  };

  // useEffect(() => {
  //   const soldItemsRef = ref(database, 'SoldItems');

  //   const unsubscribe = onValue(soldItemsRef, async (snapshot) => {
  //     if (snapshot.exists()) {
  //       const data = snapshot.val();
  //       const updates = [];

  //       for (const key in data) {
  //         if (data[key].paymentStatus === 'Stock') {
  //           const stockItem = data[key];
  //           const transactionsRef = ref(database, `transactions/${key}`);

  //           updates.push(
  //             set(transactionsRef, {
  //               ...stockItem,
  //               movedToTransactionsAt: new Date().toISOString(),
  //             }).then(() => remove(ref(database, `SoldItems/${key}`)))
  //           );
  //         }
  //       }

  //       await Promise.all(updates);
  //     }
  //   });

  //   return () => unsubscribe(); // Cleanup on unmount
  // }, []);

  useEffect(() => {
  // Reference to customers data
  const customersRef = ref(database, 'customers');
  
  // Reference to sold items data
  const soldItemsRef = ref(database, 'SoldItems');
  
  // Function to process and combine data
  const processData = (customersSnapshot, soldItemsSnapshot) => {
    let customerList = [];
    
    // Process customers data
    if (customersSnapshot.exists()) {
      const customersData = customersSnapshot.val();
      customerList = Object.keys(customersData).map((key) => ({
        id: key,
        name: customersData[key].name,
        nameArabic: customersData[key].nameArabic,
      }));
    }
    
    setCustomers(customerList);
    
    // Process sold items data
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
  };
  
  // Set up real-time listeners
  const unsubscribeCustomers = onValue(customersRef, (customersSnapshot) => {
    get(soldItemsRef).then((soldItemsSnapshot) => {
      processData(customersSnapshot, soldItemsSnapshot);
    });
  });
  
  const unsubscribeSoldItems = onValue(soldItemsRef, (soldItemsSnapshot) => {
    get(customersRef).then((customersSnapshot) => {
      processData(customersSnapshot, soldItemsSnapshot);
    });
  });
  
  // Cleanup function
  return () => {
    unsubscribeCustomers();
    unsubscribeSoldItems();
  };
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
  
          // Sort items by date in descending order (newest first)
          const sortedItems = sortItemsByDate(soldItemList);
          setSoldItems(sortedItems);
          setFilteredItems(sortedItems);
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
  
    // Apply check filter
    if (checkFilter === 'checked') {
      filtered = filtered.filter((item) => checkedItems.includes(item.id));
    } else if (checkFilter === 'unchecked') {
      filtered = filtered.filter((item) => !checkedItems.includes(item.id));
    }
  
    // Maintain sorting by date
    const sortedFiltered = sortItemsByDate(filtered);
    setFilteredItems(sortedFiltered);
  }, [filterType, searchTerm, dateFilter, monthFilter, soldItems, checkedItems, checkFilter]);

  const handleEdit = (item) => {
    // setEditingItem(item);
    // setNewRemark(item.remark || '');
    // setNewTotalCost(item.totalCost || '');
    // setNewPaymentStatus(item.paymentStatus || 'Paid');
    // setNewCustomer(item.customerName || '');
    // setNewProductType(item.name || '');
    // setNewQuantity(item.quantity || 0);

    setEditingItem(item);
    setNewRemark(item.remark || '');
    setNewTotalCost(item.totalCost || '');
    setNewPaymentStatus(item.paymentStatus || 'Paid');
    setNewCustomer(item.customerName || '');
    setNewProductType(item.name || '');
    setNewQuantity(item.quantity || 0);
    setNewDate(item.dateScanned || new Date().toISOString()); // Add this line
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
          dateScanned: newDate,
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
                dateScanned: newDate,
              }
            : item
        );
        // Sort items after update
        const sortedItems = sortItemsByDate(updatedItems);
        setSoldItems(sortedItems);
        setFilteredItems(sortedItems);
        setEditingItem(null);
      } catch (error) {
        console.error('Error updating the item:', error);
      }
    }
  };
  const handleDelete = async (itemId) => {
    try {
      // Find the item being deleted
      const itemToDelete = soldItems.find(item => item.id === itemId);
      
      if (!itemToDelete) {
        console.error('Item not found');
        return;
      }
  
      // 1. Update the stock in the products database
      if (itemToDelete.barcode) {
        const productRef = ref(database, `products/${itemToDelete.barcode}`);
        const snapshot = await get(productRef);
        
        if (snapshot.exists()) {
          const productData = snapshot.val();
          const currentQuantity = productData.quantity || 0;
          const newQuantity = currentQuantity + Number(itemToDelete.quantity);
          
          await update(productRef, {
            quantity: newQuantity
          });
        }
      }
  
      // 2. Update remaining stock (if applicable)
      if (itemToDelete.name) {
        await updateRemainingStock(itemToDelete.name, -Number(itemToDelete.quantity)); // Negative quantity to increase stock
      }
  
      // 3. Delete the sold item
      const itemRef = ref(database, `SoldItems/${itemId}`);
      await remove(itemRef);
      
      // Update local state
      setSoldItems(soldItems.filter((item) => item.id !== itemId)); 
      setFilteredItems(filteredItems.filter((item) => item.id !== itemId)); 
      setShowConfirmation(false);
      
    } catch (error) {
      console.error('Error deleting item:', error);
      setErrorMessage('Failed to delete item. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
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
      item.itemCost || "N/A",
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

  const updateRemainingStock = async (productName, quantitySold) => {
    try {
      // Find the product by name to get its barcode
      const productsRef = ref(database, 'products');
      const snapshot = await get(productsRef);
      
      if (snapshot.exists()) {
        const productsData = snapshot.val();
        const productEntry = Object.entries(productsData).find(
          ([key, product]) => product.name.toLowerCase() === productName.toLowerCase()
        );
        
        if (productEntry) {
          const [productId, productData] = productEntry;
          const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
          const remainingStockRef = ref(database, `remainingStock/${currentMonthKey}/${productId}`);
          
          // Get current remaining stock data
          const remainingSnapshot = await get(remainingStockRef);
          let currentRecordedQuantity = 0;
          
          if (remainingSnapshot.exists()) {
            currentRecordedQuantity = remainingSnapshot.val().recordedQuantity || 0;
          }
          
          // Update the remaining quantity
          await set(remainingStockRef, {
            barcode: productId,
            name: productData.name,
            recordedQuantity: currentRecordedQuantity - quantitySold,
            status: 'Not Confirmed',
            lastUpdated: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error updating remaining stock:', error);
    }
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

      <div className="sold-items-actions">
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

      {showMissingItemsModal && (
  <div className="confirmation-popup-overlay">
    <div className="confirmation-popup" style={{ width: '80%', maxWidth: '800px' }}>
      <h3>Add Missing Item</h3>
      
      <div className="product-selection">
        <select
          value={selectedProduct?.id || ''}
          onChange={(e) => {
            const productId = e.target.value;
            const product = products.find(p => p.id === productId);
            setSelectedProduct(product);
          }}
          autoFocus
        >
          <option value="">Select a Product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} - {product.barcode}
            </option>
          ))}
        </select>
        
        {selectedProduct && (
          <div className="barcode-display">
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
            
            <div className="modal-actions">
              <button onClick={() => {
                setShowMissingItemsModal(false);
                setSelectedProduct(null);
              }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}

<button onClick={() => {
  fetchProducts();
  setShowMissingItemsModal(true);
  setSelectedProduct(null); // Reset selection when opening modal
}}>
  Add Missing Items
</button>

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
                <td>
    {editingItem && editingItem.id === item.id ? (
      <input
        type="datetime-local"
        value={newDate ? newDate.slice(0, 16) : ''}
        onChange={(e) => setNewDate(new Date(e.target.value).toISOString())}
      />
    ) : (
      formatDateTime(item.dateScanned)
    )}
  </td>
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
                  <td>{item.itemCost ? `$${Number(item.itemCost).toFixed(2)}` : 'N/A'}</td>
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