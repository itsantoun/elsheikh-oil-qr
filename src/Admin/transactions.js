import React, { useEffect, useState } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, update, remove } from 'firebase/database';
import '../CSS/transactions.css';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [selectedMonth, setSelectedMonth] = useState('');

  // Fetch all transactions on component mount
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const transactionsRef = ref(database, 'transactions');
        const snapshot = await get(transactionsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const transactionsArray = await Promise.all(
            Object.keys(data).map(async (key) => {
              const transaction = { id: key, ...data[key] };

              // Fetch the corresponding product barcode
              if (transaction.productId) {
                const productRef = ref(database, `products/${transaction.productId}`);
                const productSnapshot = await get(productRef);
                if (productSnapshot.exists()) {
                  transaction.barcode = productSnapshot.val().barcode; // Assuming barcode exists in products
                }
              }

              return transaction;
            })
          );

          setTransactions(transactionsArray);
        } else {
          setTransactions([]);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      }
    };

    fetchTransactions();
  }, []);

  // Handle month selection change
  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  // Filter transactions by selected month
  const filterTransactionsByMonth = () => {
    if (!selectedMonth) return transactions; // If no month is selected, return all transactions

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.dateScanned);
      const transactionMonth = transactionDate.getMonth() + 1; // Months are 0-indexed in JavaScript
      return transactionMonth === parseInt(selectedMonth);
    });
  };

  // Get filtered transactions based on the selected month
  const filteredTransactions = filterTransactionsByMonth();

  console.log('Filtered Transactions:', filteredTransactions); // Debugging

  // Handle confirming a transaction
  const handleConfirm = async (id, barcode, transactionQuantity) => {
    try {
      const productRef = ref(database, `products/${barcode}`);
      const productSnapshot = await get(productRef);

      if (productSnapshot.exists()) {
        const productData = productSnapshot.val();
        const currentQuantity = parseFloat(productData.quantity);
        const confirmedQuantity = parseFloat(transactionQuantity);

        if (isNaN(currentQuantity) || isNaN(confirmedQuantity)) {
          console.error('Invalid quantity values');
          return;
        }

        const newQuantity = currentQuantity + confirmedQuantity;
        await update(productRef, { quantity: newQuantity });

        const transactionRef = ref(database, `transactions/${id}`);
        await update(transactionRef, { paymentStatus: 'Confirmed' });

        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, paymentStatus: 'Confirmed' } : t))
        );
      } else {
        console.error('Product not found in database');
      }
    } catch (error) {
      console.error('Error confirming transaction:', error);
    }
  };

  // Handle unconfirming a transaction
  const handleUnconfirm = async (id, barcode, transactionQuantity) => {
    try {
      const productRef = ref(database, `products/${barcode}`);
      const productSnapshot = await get(productRef);

      if (productSnapshot.exists()) {
        const productData = productSnapshot.val();
        const newQuantity = productData.quantity - transactionQuantity;

        if (newQuantity < 0) {
          console.error('Quantity cannot be negative');
          return;
        }

        await update(productRef, { quantity: newQuantity });

        const transactionRef = ref(database, `transactions/${id}`);
        await update(transactionRef, { paymentStatus: 'Pending' });

        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, paymentStatus: 'Pending' } : t))
        );
      } else {
        console.error('Product not found in database');
      }
    } catch (error) {
      console.error('Error unconfirming transaction:', error);
    }
  };

  // Handle editing a transaction
  const handleEdit = (id, field, value) => {
    setEditing(id);
    setEditedValues({ ...editedValues, [field]: value });
  };

  // Handle saving edited transaction
  const handleSave = async (id) => {
    try {
      const transactionRef = ref(database, `transactions/${id}`);
      await update(transactionRef, { ...editedValues });

      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...editedValues } : t))
      );

      setEditing(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  // Handle canceling edit
  const handleCancel = () => {
    setEditing(null);
  };

  // Handle deleting a transaction
  const handleDelete = async (id) => {
    try {
      const transactionRef = ref(database, `transactions/${id}`);
      await remove(transactionRef);

      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  return (
    <div className="transactions-container">
      <h1>Transactions</h1>
      <div>
        <label htmlFor="month">Select Month: </label>
        <select id="month" value={selectedMonth} onChange={handleMonthChange}>
          <option value="">All</option>
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
      {filteredTransactions.length === 0 ? (
        <p>No transactions for the selected month.</p>
      ) : (
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
                <td>{new Date(item.dateScanned).toLocaleString()}</td>
                <td>{item.barcode ?? 'N/A'}</td>
                <td>{item.name}</td>
                <td>
                  {editing === item.id ? (
                    <input
                      type="number"
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
                      value={editedValues.totalCost ?? item.totalCost}
                      onChange={(e) =>
                        setEditedValues({ ...editedValues, totalCost: e.target.value })
                      }
                    />
                  ) : (
                    `$${item.totalCost}`
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
                        onClick={() => handleEdit(item.id, 'quantity', item.quantity)}
                        className="action-button edit-button"
                      >
                        Edit
                      </button>
                    )
                  )}

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="action-button delete-button"
                    style={{ marginLeft: '10px', backgroundColor: '#ff4d4d', color: '#fff' }}
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
  );
};

export default Transactions;