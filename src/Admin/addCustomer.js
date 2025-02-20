import React, { useState, useEffect } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, set, update, remove, push } from 'firebase/database';
import '../CSS/addCustomer.css';

const AddCustomer = () => {
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerNameArabic, setNewCustomerNameArabic] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNameArabic, setEditNameArabic] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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
            nameArabic: data[key].nameArabic || '',
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

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerNameArabic.trim()) return;

    try {
      const newCustomerRef = push(ref(database, 'customers'));
      await set(newCustomerRef, { 
        name: newCustomerName, 
        nameArabic: newCustomerNameArabic 
      });

      setCustomers((prev) => [
        ...prev,
        { id: newCustomerRef.key, name: newCustomerName, nameArabic: newCustomerNameArabic },
      ]);
      setNewCustomerName('');
      setNewCustomerNameArabic('');
      setSuccessMessage('Customer added successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding customer:', error);
      setErrorMessage('Failed to add customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleStartEditing = (customer) => {
    setEditingCustomer(customer.id);
    setEditName(customer.name);
    setEditNameArabic(customer.nameArabic);
  };

  const handleEditCustomer = async (id) => {
    try {
      await update(ref(database, `customers/${id}`), { name: editName, nameArabic: editNameArabic });

      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === id ? { ...customer, name: editName, nameArabic: editNameArabic } : customer
        )
      );

      setEditingCustomer(null);
      setSuccessMessage('Customer updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error editing customer:', error);
      setErrorMessage('Failed to update customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

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

      {successMessage && <div className="add-customer-success">{successMessage}</div>}
      {errorMessage && <div className="add-customer-error">{errorMessage}</div>}

      <form className="add-customer-form" onSubmit={handleAddCustomer}>
        <input
          type="text"
          value={newCustomerName}
          onChange={(e) => setNewCustomerName(e.target.value)}
          placeholder="Enter customer name in English"
          className="add-customer-input"
        />
        <input
          type="text"
          value={newCustomerNameArabic}
          onChange={(e) => setNewCustomerNameArabic(e.target.value)}
          placeholder="أدخل اسم العميل بالعربية"
          className="add-customer-input"
          dir="rtl"
        />
        <button type="submit" className="add-customer-button">Add Customer</button>
      </form>

      <div className="customer-list">
        {customers.length === 0 ? (
          <p>No customers found.</p>
        ) : (
          <table className="customer-table">
            <thead>
              <tr>
                <th>Name (English)</th>
                <th>Name (Arabic)</th>
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
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="edit-customer-input"
                      />
                    ) : (
                      customer.name
                    )}
                  </td>
                  <td dir="rtl">
                    {editingCustomer === customer.id ? (
                      <input
                        type="text"
                        value={editNameArabic}
                        onChange={(e) => setEditNameArabic(e.target.value)}
                        className="edit-customer-input"
                      />
                    ) : (
                      customer.nameArabic
                    )}
                  </td>
                  <td>
                    <div className="admin-buttons-container">
                      {editingCustomer === customer.id ? (
                        <>
                          <button onClick={() => handleEditCustomer(customer.id)} className="save-button">Save</button>
                          <button onClick={() => setEditingCustomer(null)} className="cancel-button">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="admin-edit-button" onClick={() => handleStartEditing(customer)}>
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="admin-delete-button" onClick={() => handleDeleteCustomer(customer.id)}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
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