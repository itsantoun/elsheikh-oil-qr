import React, { useEffect, useState } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, update, remove } from 'firebase/database';
import '../CSS/transactions.css';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [products, setProducts] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filteredTotals, setFilteredTotals] = useState({ totalQuantity: 0, totalCost: 0 });

  // Reusable data fetching function
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      // Fetch products first to cache them
      const productsRef = ref(database, 'products');
      const productsSnapshot = await get(productsRef);
      if (productsSnapshot.exists()) {
        const productsData = productsSnapshot.val();
        setProducts(productsData);
      }

      // Then fetch transactions
      const transactionsRef = ref(database, 'transactions');
      const transactionsSnapshot = await get(transactionsRef);
      if (transactionsSnapshot.exists()) {
        const data = transactionsSnapshot.val();
        const transactionsArray = Object.keys(data).map((key) => {
          const transaction = { id: key, ...data[key] };
          
          // Get barcode and product name from cached products
          if (transaction.productId && productsSnapshot.exists()) {
            const product = productsSnapshot.val()[transaction.productId];
            if (product) {
              transaction.barcode = product.barcode;
              transaction.productName = product.name || 'Unknown Product';
            }
          } else {
            transaction.productName = transaction.name || 'Unknown Product';
          }

          return transaction;
        });

        setTransactions(transactionsArray);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Calculate totals whenever filtered transactions change
  useEffect(() => {
    if (filteredTransactions.length > 0) {
      const totals = filteredTransactions.reduce(
        (acc, transaction) => {
          const quantity = parseFloat(transaction.quantity) || 0;
          const cost = parseFloat(transaction.totalCost) || 0;
          
          return {
            totalQuantity: acc.totalQuantity + quantity,
            totalCost: acc.totalCost + cost
          };
        },
        { totalQuantity: 0, totalCost: 0 }
      );
      
      setFilteredTotals(totals);
    } else {
      setFilteredTotals({ totalQuantity: 0, totalCost: 0 });
    }
  }, [selectedMonth, selectedProduct, transactions]);

  // Handle refresh button click
  const handleRefresh = () => {
    fetchData();
  };

  // Handle month selection change
  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  // Handle product selection change
  const handleProductChange = (e) => {
    setSelectedProduct(e.target.value);
  };

  // Get unique product names from transactions for the filter dropdown
  const getUniqueProductNames = () => {
    const productNames = transactions
      .map(transaction => transaction.productName)
      .filter(name => name && name.trim() !== '');
    
    return ['', ...new Set(productNames)].sort();
  };

  // Filter transactions by selected month and product
  const filterTransactions = () => {
    let filtered = transactions;

    // Filter by month if selected
    if (selectedMonth) {
      filtered = filtered.filter((transaction) => {
        const transactionDate = new Date(transaction.dateScanned);
        const transactionMonth = transactionDate.getMonth() + 1;
        return transactionMonth === parseInt(selectedMonth);
      });
    }

    // Filter by product if selected
    if (selectedProduct) {
      filtered = filtered.filter((transaction) => {
        return transaction.productName === selectedProduct;
      });
    }

    return filtered;
  };

  const filteredTransactions = filterTransactions();

  // Optimized confirm function
  const handleConfirm = async (id, barcode, transactionQuantity) => {
    try {
      // Update transaction status first for immediate UI feedback
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, paymentStatus: 'Confirmed' } : t)
      );

      // Then perform database updates
      const updates = {};
      updates[`transactions/${id}/paymentStatus`] = 'Confirmed';
      
      if (barcode) {
        const productRef = ref(database, `products/${barcode}`);
        const productSnapshot = await get(productRef);
        
        if (productSnapshot.exists()) {
          const productData = productSnapshot.val();
          const currentQuantity = parseFloat(productData.quantity) || 0;
          const confirmedQuantity = parseFloat(transactionQuantity) || 0;
          const newQuantity = currentQuantity + confirmedQuantity;
          
          updates[`products/${barcode}/quantity`] = newQuantity;
        }
      }

      await update(ref(database), updates);
    } catch (error) {
      console.error('Error confirming transaction:', error);
      // Revert UI if error occurs
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, paymentStatus: 'Pending' } : t)
      );
    }
  };

  // Optimized unconfirm function
  const handleUnconfirm = async (id, barcode, transactionQuantity) => {
    try {
      // Update transaction status first for immediate UI feedback
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, paymentStatus: 'Pending' } : t)
      );

      // Then perform database updates
      const updates = {};
      updates[`transactions/${id}/paymentStatus`] = 'Pending';
      
      if (barcode) {
        const productRef = ref(database, `products/${barcode}`);
        const productSnapshot = await get(productRef);
        
        if (productSnapshot.exists()) {
          const productData = productSnapshot.val();
          const currentQuantity = parseFloat(productData.quantity) || 0;
          const unconfirmedQuantity = parseFloat(transactionQuantity) || 0;
          const newQuantity = currentQuantity - unconfirmedQuantity;
          
          if (newQuantity >= 0) {
            updates[`products/${barcode}/quantity`] = newQuantity;
          } else {
            throw new Error('Quantity cannot be negative');
          }
        }
      }

      await update(ref(database), updates);
    } catch (error) {
      console.error('Error unconfirming transaction:', error);
      // Revert UI if error occurs
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, paymentStatus: 'Confirmed' } : t)
      );
    }
  };

  // Handle editing a transaction
  const handleEdit = (transaction) => {
    setEditing(transaction.id);
    setEditedValues({
      quantity: transaction.quantity,
      totalCost: transaction.totalCost,
      dateScanned: transaction.dateScanned
    });
  };

  // Handle saving edited transaction
  const handleSave = async (id) => {
    try {
      const updates = {
        quantity: parseFloat(editedValues.quantity) || 0,
        totalCost: parseFloat(editedValues.totalCost) || 0,
        dateScanned: editedValues.dateScanned
      };

      await update(ref(database, `transactions/${id}`), updates);

      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, ...updates } : t)
      );

      setEditing(null);
      setEditedValues({});
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  // Handle canceling edit
  const handleCancel = () => {
    setEditing(null);
    setEditedValues({});
  };

  // Handle deleting a transaction
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await remove(ref(database, `transactions/${id}`));
        setTransactions(prev => prev.filter(t => t.id !== id));
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  return (
    <div className="transactions-container">
      <div className="transactions-header">
        <h1>Transactions</h1>
        <button 
          onClick={handleRefresh} 
          className="refresh-button"
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      <div className="filters-container">
        <div className="filter-group">
          <label htmlFor="month">Filter by Month: </label>
          <select id="month" value={selectedMonth} onChange={handleMonthChange}>
            <option value="">All Months</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="product">Filter by Product: </label>
          <select id="product" value={selectedProduct} onChange={handleProductChange}>
            <option value="">All Products</option>
            {getUniqueProductNames().map((productName, index) => (
              productName && (
                <option key={index} value={productName}>
                  {productName}
                </option>
              )
            ))}
          </select>
        </div>
      </div>
      
      {/* Totals Display */}
      {filteredTransactions.length > 0 && (
        <div className="totals-container">
          <div className="total-card">
            <h3>Filtered Totals</h3>
            <div className="total-details">
              <div className="total-item">
                <span className="total-label">Total Quantity:</span>
                <span className="total-value">{filteredTotals.totalQuantity.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <span className="total-label">Total Cost:</span>
                <span className="total-value">${filteredTotals.totalCost.toFixed(2)}</span>
              </div>
              <div className="total-item">
                <span className="total-label">Transactions:</span>
                <span className="total-value">{filteredTransactions.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {filteredTransactions.length === 0 ? (
        <p>No transactions found for the selected filters.</p>
      ) : (
        <div>
          <p className="transactions-count">
            Showing {filteredTransactions.length} transaction(s)
          </p>
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Barcode</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Total Cost</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((item) => (
                <tr key={item.id}>
                  <td>
                    {editing === item.id ? (
                      <input
                        type="datetime-local"
                        value={editedValues.dateScanned ? new Date(editedValues.dateScanned).toISOString().slice(0, 16) : ''}
                        onChange={(e) =>
                          setEditedValues({ ...editedValues, dateScanned: e.target.value })
                        }
                      />
                    ) : (
                      new Date(item.dateScanned).toLocaleString()
                    )}
                  </td>
                  <td>{item.barcode ?? 'N/A'}</td>
                  <td>{item.productName}</td>
                  <td>
                    {editing === item.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editedValues.quantity ?? item.quantity}
                        onChange={(e) =>
                          setEditedValues({ ...editedValues, quantity: e.target.value })
                        }
                      />
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td>
                    {editing === item.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editedValues.totalCost ?? item.totalCost}
                        onChange={(e) =>
                          setEditedValues({ ...editedValues, totalCost: e.target.value })
                        }
                      />
                    ) : (
                      `$${parseFloat(item.totalCost).toFixed(2)}`
                    )}
                  </td>
                  <td>{item.paymentStatus}</td>
                  <td>
                    {(item.paymentStatus === 'Pending' || item.paymentStatus === 'Stock') && (
                      <button
                        onClick={() => handleConfirm(item.id, item.barcode, item.quantity)}
                        className="action-button confirm-button"
                      >
                        Confirm
                      </button>
                    )}

                    {item.paymentStatus === 'Confirmed' && (
                      <button
                        onClick={() => handleUnconfirm(item.id, item.barcode, item.quantity)}
                        className="action-button unconfirm-button"
                      >
                        Unconfirm
                      </button>
                    )}

                    {editing === item.id ? (
                      <>
                        <button onClick={() => handleSave(item.id)} className="action-button save-button">
                          Save
                        </button>
                        <button onClick={handleCancel} className="action-button cancel-button">
                          Cancel
                        </button>
                      </>
                    ) : (
                      item.paymentStatus !== 'Confirmed' && (
                        <button
                          onClick={() => handleEdit(item)}
                          className="action-button edit-button"
                        >
                          Edit
                        </button>
                      )
                    )}

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="action-button delete-button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Transactions;