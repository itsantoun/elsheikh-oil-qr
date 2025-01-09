import React, { useState, useEffect } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, set, update, remove, push } from 'firebase/database';
import '../CSS/addCustomer.css';

const AddCustomer = () => {
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch customers from the database
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const customersRef = ref(database, 'customers');
        const snapshot = await get(customersRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const customerList = Object.keys(data).map((key) => ({
            id: key,
            name: data[key].name,
          }));
          setCustomers(customerList);
        } else {
          setCustomers([]);
        }
      } catch (error) {
        console.error('Error fetching customers:', error);
        setErrorMessage('Failed to fetch customers.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    fetchCustomers();
  }, []);

  // Add new customer
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    try {
      const newCustomerRef = push(ref(database, 'customers'));
      await set(newCustomerRef, { name: newCustomerName });
      setCustomers((prev) => [...prev, { id: newCustomerRef.key, name: newCustomerName }]);
      setNewCustomerName('');
      setSuccessMessage('Customer added successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding customer:', error);
      setErrorMessage('Failed to add customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Edit customer
  const handleEditCustomer = async (id, updatedName) => {
    try {
      await update(ref(database, `customers/${id}`), { name: updatedName });
      setCustomers((prev) =>
        prev.map((customer) => (customer.id === id ? { ...customer, name: updatedName } : customer))
      );
      setEditingCustomer(null);
      setSuccessMessage('Customer edited successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error editing customer:', error);
      setErrorMessage('Failed to edit customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Delete customer
  const handleDeleteCustomer = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this customer?');
    if (!confirmDelete) return;

    try {
      await remove(ref(database, `customers/${id}`));
      setCustomers((prev) => prev.filter((customer) => customer.id !== id));
      setSuccessMessage('Customer deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting customer:', error);
      setErrorMessage('Failed to delete customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  return (
    <div className="add-customer-container">
      <h1 className="add-customer-title">Manage Customers</h1>

      {/* Success Message */}
      {successMessage && <div className="add-customer-success">{successMessage}</div>}

      {/* Error Message */}
      {errorMessage && <div className="add-customer-error">{errorMessage}</div>}

      {/* Add Customer Form */}
      <form className="add-customer-form" onSubmit={handleAddCustomer}>
        <input
          type="text"
          value={newCustomerName}
          onChange={(e) => setNewCustomerName(e.target.value)}
          placeholder="Enter customer name"
          className="add-customer-input"
        />
        <button type="submit" className="add-customer-button">
          Add Customer
        </button>
      </form>

      {/* Customers List */}
      <div className="customer-list">
        {customers.length === 0 ? (
          <p>No customers found.</p>
        ) : (
          <table className="customer-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    {editingCustomer === customer.id ? (
                      <input
                        type="text"
                        defaultValue={customer.name}
                        onBlur={(e) => handleEditCustomer(customer.id, e.target.value)}
                        autoFocus
                        className="edit-customer-input"
                      />
                    ) : (
                      customer.name
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => setEditingCustomer(customer.id)}
                      className="edit-button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id)}
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

export default AddCustomer;