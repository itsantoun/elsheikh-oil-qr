// import React, { useEffect, useState } from 'react';
// import { database } from '../Auth/firebase';
// import { ref, get, update, remove } from 'firebase/database';
// import '../CSS/transactions.css';

// const Transactions = () => {
//   const [transactions, setTransactions] = useState([]);
//   const [editing, setEditing] = useState(null);
//   const [editedValues, setEditedValues] = useState({});
//   const [selectedMonth, setSelectedMonth] = useState('');
//   const [selectedProduct, setSelectedProduct] = useState('');
//   const [products, setProducts] = useState({});
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [filteredTotals, setFilteredTotals] = useState({ totalQuantity: 0, totalCost: 0 });

//   // Format date to DD-MM-YYYY
//   const formatDate = (dateString) => {
//     const date = new Date(dateString);
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = date.getFullYear();
//     return `${day}-${month}-${year}`;
//   };

//   // Format date and time to DD-MM-YYYY HH:MM AM/PM
//   const formatDateTime = (dateString) => {
//     const date = new Date(dateString);
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = date.getFullYear();
    
//     let hours = date.getHours();
//     const minutes = String(date.getMinutes()).padStart(2, '0');
//     const ampm = hours >= 12 ? 'PM' : 'AM';
//     hours = hours % 12 || 12; // Convert to 12-hour format

//     return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
//   };

//   // Reusable data fetching function
//   const fetchData = async () => {
//     setIsRefreshing(true);
//     try {
//       // Fetch products first to cache them
//       const productsRef = ref(database, 'products');
//       const productsSnapshot = await get(productsRef);
//       if (productsSnapshot.exists()) {
//         const productsData = productsSnapshot.val();
//         setProducts(productsData);
//       }

//       // Then fetch transactions
//       const transactionsRef = ref(database, 'transactions');
//       const transactionsSnapshot = await get(transactionsRef);
//       if (transactionsSnapshot.exists()) {
//         const data = transactionsSnapshot.val();
//         const transactionsArray = Object.keys(data).map((key) => {
//           const transaction = { id: key, ...data[key] };
          
//           // Get barcode and product name from cached products
//           if (transaction.productId && productsSnapshot.exists()) {
//             const product = productsSnapshot.val()[transaction.productId];
//             if (product) {
//               transaction.barcode = product.barcode;
//               transaction.productName = product.name || 'Unknown Product';
//             }
//           } else {
//             transaction.productName = transaction.name || 'Unknown Product';
//           }

//           return transaction;
//         });

//         setTransactions(transactionsArray);
//       } else {
//         setTransactions([]);
//       }
//     } catch (error) {
//       console.error('Error fetching data:', error);
//     } finally {
//       setIsRefreshing(false);
//     }
//   };

//   // Fetch data on component mount
//   useEffect(() => {
//     fetchData();
//   }, []);

//   // Calculate totals whenever filtered transactions change
//   useEffect(() => {
//     if (filteredTransactions.length > 0) {
//       const totals = filteredTransactions.reduce(
//         (acc, transaction) => {
//           const quantity = parseFloat(transaction.quantity) || 0;
//           const cost = parseFloat(transaction.totalCost) || 0;
          
//           return {
//             totalQuantity: acc.totalQuantity + quantity,
//             totalCost: acc.totalCost + cost
//           };
//         },
//         { totalQuantity: 0, totalCost: 0 }
//       );
      
//       setFilteredTotals(totals);
//     } else {
//       setFilteredTotals({ totalQuantity: 0, totalCost: 0 });
//     }
//   }, [selectedMonth, selectedProduct, transactions]);

//   // Handle refresh button click
//   const handleRefresh = () => {
//     fetchData();
//   };

//   // Handle month selection change
//   const handleMonthChange = (e) => {
//     setSelectedMonth(e.target.value);
//   };

//   // Handle product selection change
//   const handleProductChange = (e) => {
//     setSelectedProduct(e.target.value);
//   };

//   // Get unique product names from transactions for the filter dropdown
//   const getUniqueProductNames = () => {
//     const productNames = transactions
//       .map(transaction => transaction.productName)
//       .filter(name => name && name.trim() !== '');
    
//     return ['', ...new Set(productNames)].sort();
//   };

//   // Filter transactions by selected month and product
//   const filterTransactions = () => {
//     let filtered = transactions;

//     // Filter by month if selected
//     if (selectedMonth) {
//       filtered = filtered.filter((transaction) => {
//         const transactionDate = new Date(transaction.dateScanned);
//         const transactionMonth = transactionDate.getMonth() + 1;
//         return transactionMonth === parseInt(selectedMonth);
//       });
//     }

//     // Filter by product if selected
//     if (selectedProduct) {
//       filtered = filtered.filter((transaction) => {
//         return transaction.productName === selectedProduct;
//       });
//     }

//     return filtered;
//   };

//   const filteredTransactions = filterTransactions();

//   // Optimized confirm function
//   const handleConfirm = async (id, barcode, transactionQuantity) => {
//     try {
//       // Update transaction status first for immediate UI feedback
//       setTransactions(prev =>
//         prev.map(t => t.id === id ? { ...t, paymentStatus: 'Confirmed' } : t)
//       );

//       // Then perform database updates
//       const updates = {};
//       updates[`transactions/${id}/paymentStatus`] = 'Confirmed';
      
//       if (barcode) {
//         const productRef = ref(database, `products/${barcode}`);
//         const productSnapshot = await get(productRef);
        
//         if (productSnapshot.exists()) {
//           const productData = productSnapshot.val();
//           const currentQuantity = parseFloat(productData.quantity) || 0;
//           const confirmedQuantity = parseFloat(transactionQuantity) || 0;
//           const newQuantity = currentQuantity + confirmedQuantity;
          
//           updates[`products/${barcode}/quantity`] = newQuantity;
//         }
//       }

//       await update(ref(database), updates);
//     } catch (error) {
//       console.error('Error confirming transaction:', error);
//       // Revert UI if error occurs
//       setTransactions(prev =>
//         prev.map(t => t.id === id ? { ...t, paymentStatus: 'Pending' } : t)
//       );
//     }
//   };

//   // Optimized unconfirm function
//   const handleUnconfirm = async (id, barcode, transactionQuantity) => {
//     try {
//       // Update transaction status first for immediate UI feedback
//       setTransactions(prev =>
//         prev.map(t => t.id === id ? { ...t, paymentStatus: 'Pending' } : t)
//       );

//       // Then perform database updates
//       const updates = {};
//       updates[`transactions/${id}/paymentStatus`] = 'Pending';
      
//       if (barcode) {
//         const productRef = ref(database, `products/${barcode}`);
//         const productSnapshot = await get(productRef);
        
//         if (productSnapshot.exists()) {
//           const productData = productSnapshot.val();
//           const currentQuantity = parseFloat(productData.quantity) || 0;
//           const unconfirmedQuantity = parseFloat(transactionQuantity) || 0;
//           const newQuantity = currentQuantity - unconfirmedQuantity;
          
//           if (newQuantity >= 0) {
//             updates[`products/${barcode}/quantity`] = newQuantity;
//           } else {
//             throw new Error('Quantity cannot be negative');
//           }
//         }
//       }

//       await update(ref(database), updates);
//     } catch (error) {
//       console.error('Error unconfirming transaction:', error);
//       // Revert UI if error occurs
//       setTransactions(prev =>
//         prev.map(t => t.id === id ? { ...t, paymentStatus: 'Confirmed' } : t)
//       );
//     }
//   };

//   // Handle editing a transaction
//   const handleEdit = (transaction) => {
//     setEditing(transaction.id);
//     setEditedValues({
//       quantity: transaction.quantity,
//       totalCost: transaction.totalCost,
//       dateScanned: transaction.dateScanned
//     });
//   };

//   // Handle saving edited transaction
//   const handleSave = async (id) => {
//     try {
//       const updates = {
//         quantity: parseFloat(editedValues.quantity) || 0,
//         totalCost: parseFloat(editedValues.totalCost) || 0,
//         dateScanned: editedValues.dateScanned
//       };

//       await update(ref(database, `transactions/${id}`), updates);

//       setTransactions(prev =>
//         prev.map(t => t.id === id ? { ...t, ...updates } : t)
//       );

//       setEditing(null);
//       setEditedValues({});
//     } catch (error) {
//       console.error('Error updating transaction:', error);
//     }
//   };

//   // Handle canceling edit
//   const handleCancel = () => {
//     setEditing(null);
//     setEditedValues({});
//   };

//   // Handle deleting a transaction
//   const handleDelete = async (id) => {
//     if (window.confirm('Are you sure you want to delete this transaction?')) {
//       try {
//         await remove(ref(database, `transactions/${id}`));
//         setTransactions(prev => prev.filter(t => t.id !== id));
//       } catch (error) {
//         console.error('Error deleting transaction:', error);
//       }
//     }
//   };

//   return (
//     <div className="transactions-container">
//       <div className="transactions-header">
//         <h1>Transactions</h1>
//         <button 
//           onClick={handleRefresh} 
//           className="refresh-button"
//           disabled={isRefreshing}
//         >
//           {isRefreshing ? 'Refreshing...' : 'Refresh'}
//         </button>
//       </div>
      
//       <div className="filters-container">
//         <div className="filter-group">
//           <label htmlFor="month">Filter by Month: </label>
//           <select id="month" value={selectedMonth} onChange={handleMonthChange}>
//             <option value="">All Months</option>
//             <option value="1">January</option>
//             <option value="2">February</option>
//             <option value="3">March</option>
//             <option value="4">April</option>
//             <option value="5">May</option>
//             <option value="6">June</option>
//             <option value="7">July</option>
//             <option value="8">August</option>
//             <option value="9">September</option>
//             <option value="10">October</option>
//             <option value="11">November</option>
//             <option value="12">December</option>
//           </select>
//         </div>
        
//         <div className="filter-group">
//           <label htmlFor="product">Filter by Product: </label>
//           <select id="product" value={selectedProduct} onChange={handleProductChange}>
//             <option value="">All Products</option>
//             {getUniqueProductNames().map((productName, index) => (
//               productName && (
//                 <option key={index} value={productName}>
//                   {productName}
//                 </option>
//               )
//             ))}
//           </select>
//         </div>
//       </div>
      
//       {/* Totals Display */}
//       {filteredTransactions.length > 0 && (
//         <div className="totals-container">
//           <div className="total-card">
//             <h3>Filtered Totals</h3>
//             <div className="total-details">
//               <div className="total-item">
//                 <span className="total-label">Total Quantity:</span>
//                 <span className="total-value">{filteredTotals.totalQuantity.toFixed(2)}</span>
//               </div>
//               <div className="total-item">
//                 <span className="total-label">Total Cost:</span>
//                 <span className="total-value">${filteredTotals.totalCost.toFixed(2)}</span>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
      
//       {filteredTransactions.length === 0 ? (
//         <p>No transactions found for the selected filters.</p>
//       ) : (
//         <div>
//           <table className="transactions-table">
//             <thead>
//               <tr>
//                 <th>Date</th>
//                 <th>Barcode</th>
//                 <th>Product</th>
//                 <th>Quantity</th>
//                 <th>Total Cost</th>
//                 <th>Status</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredTransactions.map((item) => (
//                 <tr key={item.id}>
//                   <td>
//                     {editing === item.id ? (
//                       <input
//                         type="datetime-local"
//                         value={editedValues.dateScanned ? new Date(editedValues.dateScanned).toISOString().slice(0, 16) : ''}
//                         onChange={(e) =>
//                           setEditedValues({ ...editedValues, dateScanned: e.target.value })
//                         }
//                       />
//                     ) : (
//                       formatDateTime(item.dateScanned)
//                     )}
//                   </td>
//                   <td>{item.barcode ?? 'N/A'}</td>
//                   <td>{item.productName}</td>
//                   <td>
//                     {editing === item.id ? (
//                       <input
//                         type="number"
//                         step="0.01"
//                         value={editedValues.quantity ?? item.quantity}
//                         onChange={(e) =>
//                           setEditedValues({ ...editedValues, quantity: e.target.value })
//                         }
//                       />
//                     ) : (
//                       item.quantity
//                     )}
//                   </td>
//                   <td>
//                     {editing === item.id ? (
//                       <input
//                         type="number"
//                         step="0.01"
//                         value={editedValues.totalCost ?? item.totalCost}
//                         onChange={(e) =>
//                           setEditedValues({ ...editedValues, totalCost: e.target.value })
//                         }
//                       />
//                     ) : (
//                       `$${parseFloat(item.totalCost).toFixed(2)}`
//                     )}
//                   </td>
//                   <td>{item.paymentStatus}</td>
//                   <td>
//                     {(item.paymentStatus === 'Pending' || item.paymentStatus === 'Stock') && (
//                       <button
//                         onClick={() => handleConfirm(item.id, item.barcode, item.quantity)}
//                         className="action-button confirm-button"
//                       >
//                         Confirm
//                       </button>
//                     )}

//                     {item.paymentStatus === 'Confirmed' && (
//                       <button
//                         onClick={() => handleUnconfirm(item.id, item.barcode, item.quantity)}
//                         className="action-button unconfirm-button"
//                       >
//                         Unconfirm
//                       </button>
//                     )}

//                     {editing === item.id ? (
//                       <>
//                         <button onClick={() => handleSave(item.id)} className="action-button save-button">
//                           Save
//                         </button>
//                         <button onClick={handleCancel} className="action-button cancel-button">
//                           Cancel
//                         </button>
//                       </>
//                     ) : (
//                       item.paymentStatus !== 'Confirmed' && (
//                         <button
//                           onClick={() => handleEdit(item)}
//                           className="action-button edit-button"
//                         >
//                           Edit
//                         </button>
//                       )
//                     )}

//                     <button
//                       onClick={() => handleDelete(item.id)}
//                       className="action-button delete-button"
//                     >
//                       Delete
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Transactions;


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
  const [filteredTotals, setFilteredTotals] = useState({
    totalQuantity: 0,
    totalCost: 0,
    totalPurchaseCost: 0,
    totalProfit: 0,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Format date to DD-MM-YYYY
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Format date and time to DD-MM-YYYY HH:MM AM/PM
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;

      return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting date time:', error);
      return 'Invalid Date';
    }
  };

  const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isStockLikeStatus = (status) => String(status || '').toLowerCase().startsWith('stock');

  const getTransactionMetrics = (transaction, overrides = {}) => {
    const merged = { ...transaction, ...overrides };
    const quantity = toNumber(merged.quantity);
    const isStockTransaction = isStockLikeStatus(merged.paymentStatus);

    const productRef = products[merged.barcode] || products[merged.productId] || null;
    const parsedSell = parseFloat(merged.itemCost);
    const hasSell = Number.isFinite(parsedSell);
    const parsedTotal = parseFloat(merged.totalCost);
    const hasTotal = Number.isFinite(parsedTotal);
    const parsedBuy = parseFloat(merged.purchasingPrice);
    const hasBuy = Number.isFinite(parsedBuy);

    const unitSellPrice = hasSell
      ? parsedSell
      : (quantity > 0 ? (hasTotal ? parsedTotal / quantity : toNumber(productRef?.itemCost)) : 0);
    const unitPurchasePrice = hasBuy ? parsedBuy : toNumber(productRef?.purchasingPrice);
    const revenue = isStockTransaction ? 0 : (hasTotal ? parsedTotal : unitSellPrice * quantity);
    const purchaseCost = isStockTransaction ? 0 : unitPurchasePrice * quantity;
    const profit = revenue - purchaseCost;

    return {
      quantity,
      isStockTransaction,
      unitSellPrice,
      unitPurchasePrice,
      revenue,
      purchaseCost,
      profit,
    };
  };

  // Reusable data fetching function
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const productsRef = ref(database, 'products');
      const transactionsRef = ref(database, 'transactions');
      
      const [productsSnapshot, transactionsSnapshot] = await Promise.all([
        get(productsRef),
        get(transactionsRef)
      ]);

      if (productsSnapshot.exists()) {
        setProducts(productsSnapshot.val());
      }

      if (transactionsSnapshot.exists()) {
        const data = transactionsSnapshot.val();
        const transactionsArray = Object.keys(data).map((key) => {
          const transaction = { id: key, ...data[key] };
          const productKey = transaction.productId || transaction.barcode;
          
          if (productKey && productsSnapshot.exists()) {
            const product = productsSnapshot.val()[productKey];
            if (product) {
              transaction.barcode = productKey;
              transaction.productName = product.name || 'Unknown Product';
              transaction.itemCost = Number.isFinite(parseFloat(transaction.itemCost))
                ? parseFloat(transaction.itemCost)
                : toNumber(product.itemCost);
              transaction.purchasingPrice = Number.isFinite(parseFloat(transaction.purchasingPrice))
                ? parseFloat(transaction.purchasingPrice)
                : toNumber(product.purchasingPrice);
            }
          } else {
            transaction.productName = transaction.name || 'Unknown Product';
          }

          if (!transaction.barcode) {
            transaction.barcode = transaction.productId || transaction.barcode || 'N/A';
          }
          if (!Number.isFinite(parseFloat(transaction.itemCost))) {
            transaction.itemCost = toNumber(transaction.itemCost);
          }
          if (!Number.isFinite(parseFloat(transaction.purchasingPrice))) {
            transaction.purchasingPrice = toNumber(transaction.purchasingPrice);
          }

          return transaction;
        });

        // Sort by date descending (newest first)
        transactionsArray.sort((a, b) => new Date(b.dateScanned) - new Date(a.dateScanned));
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
          const metrics = getTransactionMetrics(transaction);
          
          return {
            totalQuantity: acc.totalQuantity + metrics.quantity,
            totalCost: acc.totalCost + metrics.revenue,
            totalPurchaseCost: acc.totalPurchaseCost + metrics.purchaseCost,
            totalProfit: acc.totalProfit + metrics.profit,
          };
        },
        { totalQuantity: 0, totalCost: 0, totalPurchaseCost: 0, totalProfit: 0 }
      );
      
      setFilteredTotals(totals);
    } else {
      setFilteredTotals({ totalQuantity: 0, totalCost: 0, totalPurchaseCost: 0, totalProfit: 0 });
    }
  }, [selectedMonth, selectedProduct, transactions, products]);

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

    if (selectedMonth) {
      filtered = filtered.filter((transaction) => {
        const transactionDate = new Date(transaction.dateScanned);
        const transactionMonth = transactionDate.getMonth() + 1;
        return transactionMonth === parseInt(selectedMonth);
      });
    }

    if (selectedProduct) {
      filtered = filtered.filter((transaction) => {
        return transaction.productName === selectedProduct;
      });
    }

    return filtered;
  };

  const filteredTransactions = filterTransactions();

  // Handle confirm transaction
  const handleConfirm = async (id, barcode, transactionQuantity) => {
    try {
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, paymentStatus: 'Confirmed' } : t)
      );

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
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, paymentStatus: 'Pending' } : t)
      );
    }
  };

  // Handle unconfirm transaction
  const handleUnconfirm = async (id, barcode, transactionQuantity) => {
    try {
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, paymentStatus: 'Pending' } : t)
      );

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
      dateScanned: transaction.dateScanned.slice(0, 16) // For datetime-local input
    });
  };

  // Handle saving edited transaction
  const handleSave = async (id) => {
    try {
      const original = transactions.find((transaction) => transaction.id === id) || {};
      const parsedQuantity = toNumber(editedValues.quantity);
      const parsedInputCost = parseFloat(editedValues.totalCost);
      const hasInputCost = Number.isFinite(parsedInputCost);
      const unitSellPrice = toNumber(original.itemCost);
      const stockLike = isStockLikeStatus(original.paymentStatus);
      const computedTotalCost = stockLike
        ? 0
        : (hasInputCost ? parsedInputCost : unitSellPrice * parsedQuantity);
      const metrics = getTransactionMetrics(original, {
        quantity: parsedQuantity,
        totalCost: computedTotalCost,
        itemCost: unitSellPrice,
      });

      const updates = {
        quantity: parsedQuantity,
        totalCost: computedTotalCost,
        dateScanned: new Date(editedValues.dateScanned).toISOString(),
        purchasingPrice: metrics.unitPurchasePrice,
        unitProfit: metrics.unitSellPrice - metrics.unitPurchasePrice,
        totalProfit: metrics.profit,
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

  // Handle delete confirmation
  const handleDeleteClick = (id) => {
    setItemToDelete(id);
    setShowDeleteConfirm(true);
  };

  // Handle deleting a transaction
  const handleDelete = async () => {
    if (itemToDelete) {
      try {
        await remove(ref(database, `transactions/${itemToDelete}`));
        setTransactions(prev => prev.filter(t => t.id !== itemToDelete));
        setShowDeleteConfirm(false);
        setItemToDelete(null);
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedMonth('');
    setSelectedProduct('');
  };

  // Get month name from number
  const getMonthName = (monthNumber) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1] || '';
  };

  return (
    <div className="transactions-container">
      {/* Header */}
      <div className="header-section">
        <h1 className="page-title">Transactions</h1>
        <div className="header-actions">
          <button 
            onClick={fetchData} 
            className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <span className="spinner"></span>
                Refreshing...
              </>
            ) : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Filter by Month</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="">All Months</option>
              {[...Array(12).keys()].map((month) => (
                <option key={month + 1} value={month + 1}>
                  {getMonthName(month + 1)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Product</label>
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
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

        <div className="filter-actions">
          <button className="btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>

        {/* Active Filters */}
        {(selectedMonth || selectedProduct) && (
          <div className="active-filters">
            <span className="active-filters-title">Active Filters:</span>
            <div className="filter-tags">
              {selectedMonth && (
                <span className="filter-tag">
                  Month: {getMonthName(parseInt(selectedMonth))}
                  <button onClick={() => setSelectedMonth('')}>×</button>
                </span>
              )}
              {selectedProduct && (
                <span className="filter-tag">
                  Product: {selectedProduct}
                  <button onClick={() => setSelectedProduct('')}>×</button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {filteredTransactions.length > 0 && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-card-content">
              <span className="summary-card-label">Total Transactions</span>
              <span className="summary-card-value">{filteredTransactions.length}</span>
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
              <span className="summary-card-label">Total Value</span>
              <span className="summary-card-value">${filteredTotals.totalCost.toFixed(2)}</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-content">
              <span className="summary-card-label">Total Purchase Cost</span>
              <span className="summary-card-value">${filteredTotals.totalPurchaseCost.toFixed(2)}</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-content">
              <span className="summary-card-label">Total Profit</span>
              <span
                className="summary-card-value"
                style={{ color: filteredTotals.totalProfit >= 0 ? '#198754' : '#dc3545' }}
              >
                ${filteredTotals.totalProfit.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-content">
              <span className="summary-card-label">Pending</span>
              <span className="summary-card-value">
                {filteredTransactions.filter(t => t.paymentStatus === 'Pending' || t.paymentStatus === 'Stock').length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Results Info */}
      {filteredTransactions.length > 0 && (
        <div className="results-info">
          Showing {filteredTransactions.length} transaction(s) • Profit: ${filteredTotals.totalProfit.toFixed(2)}
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p>No transactions found for the selected filters.</p>
            <button className="btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Barcode</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Sell Price</th>
                <th>Buy Price</th>
                <th>Total Cost</th>
                <th>Profit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
  {filteredTransactions.map((item) => {
    const editingMetrics = editing === item.id
      ? getTransactionMetrics(item, {
        quantity: toNumber(editedValues.quantity ?? item.quantity),
        totalCost: toNumber(editedValues.totalCost ?? item.totalCost),
      })
      : null;
    const rowMetrics = editingMetrics || getTransactionMetrics(item);

    return (
    <tr key={item.id} className="table-row"> {/* Remove status class */}
      <td className="date-cell">
        {editing === item.id ? (
          <input
            type="datetime-local"
            value={editedValues.dateScanned || ''}
            onChange={(e) =>
              setEditedValues({ ...editedValues, dateScanned: e.target.value })
            }
            className="edit-input"
          />
        ) : (
          <span className="date-display">{formatDateTime(item.dateScanned)}</span>
        )}
      </td>
      <td>
        <span className="barcode-display">{item.barcode || 'N/A'}</span>
      </td>
      <td>
        <span className="product-name">{item.productName}</span>
      </td>
      <td>
        {editing === item.id ? (
          <input
            type="number"
            step="0.01"
            value={editedValues.quantity ?? item.quantity}
            onChange={(e) =>
              setEditedValues({ ...editedValues, quantity: e.target.value })
            }
            className="edit-input"
          />
        ) : (
          <span className="quantity-display">{item.quantity}</span>
        )}
      </td>
      <td>
        <span className="cost-display">${rowMetrics.unitSellPrice.toFixed(2)}</span>
      </td>
      <td>
        <span className="cost-display">${rowMetrics.unitPurchasePrice.toFixed(2)}</span>
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
            className="edit-input"
          />
        ) : (
          <span className="cost-display">${rowMetrics.revenue.toFixed(2)}</span>
        )}
      </td>
      <td>
        <span
          className="cost-display"
          style={{ color: rowMetrics.profit >= 0 ? '#198754' : '#dc3545' }}
        >
          ${rowMetrics.profit.toFixed(2)}
        </span>
      </td>
      <td>
        <span className={`status-badge status-${item.paymentStatus?.toLowerCase()}`}>
          {item.paymentStatus}
        </span>
      </td>
                  <td>
                    <div className="action-buttons">
                      {(item.paymentStatus === 'Pending' || item.paymentStatus === 'Stock') && (
                        <button
                          onClick={() => handleConfirm(item.id, item.barcode, item.quantity)}
                          className="btn-small btn-success"
                          title="Confirm Transaction"
                        >
                          ✓
                        </button>
                      )}

                      {item.paymentStatus === 'Confirmed' && (
                        <button
                          onClick={() => handleUnconfirm(item.id, item.barcode, item.quantity)}
                          className="btn-small btn-warning"
                          title="Unconfirm Transaction"
                        >
                          ↩
                        </button>
                      )}

                      {editing === item.id ? (
                        <>
                          <button 
                            onClick={() => handleSave(item.id)} 
                            className="btn-small btn-success"
                            title="Save Changes"
                          >
                            💾
                          </button>
                          <button 
                            onClick={handleCancel} 
                            className="btn-small btn-secondary"
                            title="Cancel Edit"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        item.paymentStatus !== 'Confirmed' && (
                          <button
                            onClick={() => handleEdit(item)}
                            className="btn-small btn-primary"
                            title="Edit Transaction"
                          >
                            ✏️
                          </button>
                        )
                      )}

                      <button
                        onClick={() => handleDeleteClick(item.id)}
                        className="btn-small btn-danger"
                        title="Delete Transaction"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Confirm Deletion</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <p>Are you sure you want to delete this transaction? This action cannot be undone.</p>
              {itemToDelete && transactions.find(t => t.id === itemToDelete) && (
                <div className="delete-preview">
                  <p><strong>Product:</strong> {transactions.find(t => t.id === itemToDelete).productName}</p>
                  <p><strong>Date:</strong> {formatDateTime(transactions.find(t => t.id === itemToDelete).dateScanned)}</p>
                  <p><strong>Amount:</strong> ${parseFloat(transactions.find(t => t.id === itemToDelete).totalCost).toFixed(2)}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-danger" onClick={handleDelete}>
                Yes, Delete
              </button>
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
