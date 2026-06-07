// import React, { useState, useEffect } from 'react';
// import { database } from '../Auth/firebase';
// import { ref, get, set, update, remove, push } from 'firebase/database';
// import '../CSS/addCustomer.css';

// const AddCustomer = () => {
//   const [customers, setCustomers] = useState([]);
//   const [newCustomerName, setNewCustomerName] = useState('');
//   const [newCustomerNameArabic, setNewCustomerNameArabic] = useState('');
//   const [editingCustomer, setEditingCustomer] = useState(null);
//   const [editName, setEditName] = useState('');
//   const [editNameArabic, setEditNameArabic] = useState('');
//   const [errorMessage, setErrorMessage] = useState(null);
//   const [successMessage, setSuccessMessage] = useState(null);

//   useEffect(() => {
//     const fetchCustomers = async () => {
//       try {
//         const customersRef = ref(database, 'customers');
//         const snapshot = await get(customersRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const customerList = Object.keys(data).map((key) => ({
//             id: key,
//             name: data[key].name,
//             nameArabic: data[key].nameArabic || '',
//           }));
//           setCustomers(customerList);
//         } else {
//           setCustomers([]); 
//         }
//       } catch (error) {
//         console.error('Error fetching customers:', error);
//         setErrorMessage('Failed to fetch customers.');
//         setTimeout(() => setErrorMessage(null), 3000);
//       }
//     };

//     fetchCustomers();
//   }, []);

//   const handleAddCustomer = async (e) => {
//     e.preventDefault();
//     if (!newCustomerName.trim() || !newCustomerNameArabic.trim()) return;

//     try {
//       const newCustomerRef = push(ref(database, 'customers'));
//       await set(newCustomerRef, { 
//         name: newCustomerName, 
//         nameArabic: newCustomerNameArabic 
//       });

//       setCustomers((prev) => [
//         ...prev,
//         { id: newCustomerRef.key, name: newCustomerName, nameArabic: newCustomerNameArabic },
//       ]);
//       setNewCustomerName('');
//       setNewCustomerNameArabic('');
//       setSuccessMessage('Customer added successfully.');
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (error) {
//       console.error('Error adding customer:', error);
//       setErrorMessage('Failed to add customer.');
//       setTimeout(() => setErrorMessage(null), 3000);
//     }
//   };

//   const handleStartEditing = (customer) => {
//     setEditingCustomer(customer.id);
//     setEditName(customer.name);
//     setEditNameArabic(customer.nameArabic);
//   };

//   const handleEditCustomer = async (id) => {
//     try {
//       await update(ref(database, `customers/${id}`), { name: editName, nameArabic: editNameArabic });

//       setCustomers((prev) =>
//         prev.map((customer) =>
//           customer.id === id ? { ...customer, name: editName, nameArabic: editNameArabic } : customer
//         )
//       );

//       setEditingCustomer(null);
//       setSuccessMessage('Customer updated successfully.');
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (error) {
//       console.error('Error editing customer:', error);
//       setErrorMessage('Failed to update customer.');
//       setTimeout(() => setErrorMessage(null), 3000);
//     }
//   };

//   const handleDeleteCustomer = async (id) => {
//     const confirmDelete = window.confirm('Are you sure you want to delete this customer?');
//     if (!confirmDelete) return;

//     try {
//       await remove(ref(database, `customers/${id}`));
//       setCustomers((prev) => prev.filter((customer) => customer.id !== id));
//       setSuccessMessage('Customer deleted successfully.');
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (error) {
//       console.error('Error deleting customer:', error);
//       setErrorMessage('Failed to delete customer.');
//       setTimeout(() => setErrorMessage(null), 3000);
//     }
//   };

//   return (
//     <div className="add-customer-container">
//       <h1 className="add-customer-title">Manage Customers</h1>

//       {successMessage && <div className="add-customer-success">{successMessage}</div>}
//       {errorMessage && <div className="add-customer-error">{errorMessage}</div>}

//       <form className="add-customer-form" onSubmit={handleAddCustomer}>
//         <input
//           type="text"
//           value={newCustomerName}
//           onChange={(e) => setNewCustomerName(e.target.value)}
//           placeholder="Enter customer name in English"
//           className="add-customer-input"
//         />
//         <input
//           type="text"
//           value={newCustomerNameArabic}
//           onChange={(e) => setNewCustomerNameArabic(e.target.value)}
//           placeholder="أدخل اسم العميل بالعربية"
//           className="add-customer-input"
//           dir="rtl"
//         />
//         <button type="submit" className="add-customer-button">Add Customer</button>
//       </form>

//       <div className="customer-list">
//         {customers.length === 0 ? (
//           <p>No customers found.</p>
//         ) : (
//           <table className="customer-table">
//             <thead>
//               <tr>
//                 <th>Name (English)</th>
//                 <th>Name (Arabic)</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {customers.map((customer) => (
//                 <tr key={customer.id}>
//                   <td>
//                     {editingCustomer === customer.id ? (
//                       <input
//                         type="text"
//                         value={editName}
//                         onChange={(e) => setEditName(e.target.value)}
//                         className="edit-customer-input"
//                       />
//                     ) : (
//                       customer.name
//                     )}
//                   </td>
//                   <td dir="rtl">
//                     {editingCustomer === customer.id ? (
//                       <input
//                         type="text"
//                         value={editNameArabic}
//                         onChange={(e) => setEditNameArabic(e.target.value)}
//                         className="edit-customer-input"
//                       />
//                     ) : (
//                       customer.nameArabic
//                     )}
//                   </td>
//                   <td>
//                     <div className="admin-buttons-container">
//                       {editingCustomer === customer.id ? (
//                         <>
//                           <button onClick={() => handleEditCustomer(customer.id)} className="save-button">Save</button>
//                           <button onClick={() => setEditingCustomer(null)} className="cancel-button">Cancel</button>
//                         </>
//                       ) : (
//                         <>
//                           <button className="admin-edit-button" onClick={() => handleStartEditing(customer)}>
//                             <i className="fas fa-edit"></i>
//                           </button>
//                           <button className="admin-delete-button" onClick={() => handleDeleteCustomer(customer.id)}>
//                             <i className="fas fa-trash"></i>
//                           </button>
//                         </>
//                       )}
//                     </div>
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

// export default AddCustomer;

import React, { useState, useEffect } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, set, update, remove, push } from 'firebase/database';
import '../CSS/addCustomer.css';
import { IconCheck, IconAlertTriangle, IconUsers, IconPlus, IconClipboard, IconX, IconRefresh, IconSettings, IconSave, IconEdit, IconTrash } from '../utils/icons';
import { useExpiryNotifications } from '../utils/useExpiryNotifications';

const sortByName = (a, b) => {
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return 0;
};

const AddCustomer = () => {
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerNameArabic, setNewCustomerNameArabic] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNameArabic, setEditNameArabic] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useExpiryNotifications({ successMessage, errorMessage });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const customersRef = ref(database, 'customers');
      const snapshot = await get(customersRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const customerList = Object.keys(data).map((key) => ({
          id: key,
          name: data[key].name,
          nameArabic: data[key].nameArabic || '',
        }));
        customerList.sort((a, b) => sortByName(a, b));
        setCustomers(customerList);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setErrorMessage('Failed to fetch customers.');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim() || !newCustomerNameArabic.trim()) {
      setErrorMessage('Both English and Arabic names are required.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    try {
      setIsLoading(true);
      const newCustomerRef = push(ref(database, 'customers'));
      await set(newCustomerRef, { 
        name: newCustomerName.trim(), 
        nameArabic: newCustomerNameArabic.trim() 
      });

      setCustomers((prev) => {
        const updated = [...prev, { id: newCustomerRef.key, name: newCustomerName.trim(), nameArabic: newCustomerNameArabic.trim() }];
        return updated.sort((a, b) => sortByName(a, b));
      });
      setNewCustomerName('');
      setNewCustomerNameArabic('');
      setSuccessMessage('Customer added successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding customer:', error);
      setErrorMessage('Failed to add customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditing = (customer) => {
    setEditingCustomer(customer.id);
    setEditName(customer.name);
    setEditNameArabic(customer.nameArabic);
  };

  const handleEditCustomer = async (id) => {
    if (!editName.trim() || !editNameArabic.trim()) {
      setErrorMessage('Both English and Arabic names are required.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    try {
      setIsLoading(true);
      await update(ref(database, `customers/${id}`), { 
        name: editName.trim(), 
        nameArabic: editNameArabic.trim() 
      });

      setCustomers((prev) => {
        const updated = prev.map((customer) =>
          customer.id === id ? { ...customer, name: editName.trim(), nameArabic: editNameArabic.trim() } : customer
        );
        return updated.sort((a, b) => sortByName(a, b));
      });

      setEditingCustomer(null);
      setSuccessMessage('Customer updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error editing customer:', error);
      setErrorMessage('Failed to update customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    const confirmDelete = window.confirm(`Are you sure you want to delete customer "${customer.name}"?`);
    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      await remove(ref(database, `customers/${id}`));
      setCustomers((prev) => prev.filter((customer) => customer.id !== id));
      setSuccessMessage(`Customer "${customer.name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting customer:', error);
      setErrorMessage('Failed to delete customer.');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCustomer(null);
    setEditName('');
    setEditNameArabic('');
  };

  const handleRefresh = () => {
    fetchCustomers();
    setSuccessMessage('Customer list refreshed!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleClearForm = () => {
    setNewCustomerName('');
    setNewCustomerNameArabic('');
  };

  // Filter customers based on search term
  const filteredCustomers = customers
    .filter(customer => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        customer.name?.toLowerCase().includes(term) ||
        customer.nameArabic?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => sortByName(a, b));

  return (
    <div className="page-shell customers-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Customer Management</h1>
        <p className="page-subtitle">Add and manage customer information</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="success-message">
          <span className="message-icon"><IconCheck /></span>
          <span className="message-text">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="error-message">
          <span className="message-icon"><IconAlertTriangle /></span>
          <span className="message-text">{errorMessage}</span>
        </div>
      )}

      {/* Add Customer Form */}
      <div className="form-card">
        <div className="form-header">
          <h2 className="form-title">
            <span className="form-icon"><IconUsers /></span>
            Add New Customer
          </h2>
          <div className="form-stats">
            <span className="stats-badge">{customers.length} Customers</span>
          </div>
        </div>

        <form onSubmit={handleAddCustomer} className="customer-form">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Customer Name (English)</span>
                <span className="required-star">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter customer name in English"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="form-input"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Customer Name (Arabic)</span>
                <span className="required-star">*</span>
              </label>
              <input
                type="text"
                placeholder="أدخل اسم العميل بالعربية"
                value={newCustomerNameArabic}
                onChange={(e) => setNewCustomerNameArabic(e.target.value)}
                className="form-input arabic-input"
                dir="rtl"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn-primary"
              disabled={isLoading || !newCustomerName.trim() || !newCustomerNameArabic.trim()}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Adding...
                </>
              ) : (
                <>
                  <span className="button-icon"><IconPlus /></span>
                  Add Customer
                </>
              )}
            </button>
            <button 
              type="button" 
              onClick={handleClearForm}
              className="btn-secondary"
              disabled={isLoading || (!newCustomerName && !newCustomerNameArabic)}
            >
              Clear Form
            </button>
          </div>
        </form>
      </div>

      {/* Customer List */}
      <div className="table-card">
        <div className="table-header">
          <div className="table-header-left">
            <h2 className="table-title">
              <span className="table-icon"><IconClipboard /></span>
              Customer List
            </h2>
            <div className="table-stats">
              {filteredCustomers.length} of {customers.length} customers
            </div>
          </div>
          <div className="table-header-right">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                disabled={isLoading}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="search-clear"
                  disabled={isLoading}
                >
                  <IconX />
                </button>
              )}
            </div>
            <button 
              onClick={handleRefresh}
              className={`btn-secondary ${isLoading ? 'refreshing' : ''}`}
              disabled={isLoading}
            >
              <IconRefresh /> {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <div className="table-header-cell">
                    English Name
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    Arabic Name
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon"><IconSettings /></span>
                    Actions
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && customers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="loading-cell">
                    <div className="loading-spinner"></div>
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty-cell">
                    <div className="empty-icon"><IconUsers /></div>
                    {searchTerm ? 'No customers found' : 'No customers added yet'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className={editingCustomer === customer.id ? 'editing-row' : ''}>
                    <td>
                      {editingCustomer === customer.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="edit-input"
                          disabled={isLoading}
                        />
                      ) : (
                        <div className="customer-name-cell english">
                          <div className="name-text">{customer.name || 'N/A'}</div>
                          <div className="customer-id">ID: {customer.id.substring(0, 8)}...</div>
                        </div>
                      )}
                    </td>
                    <td>
                      {editingCustomer === customer.id ? (
                        <input
                          type="text"
                          value={editNameArabic}
                          onChange={(e) => setEditNameArabic(e.target.value)}
                          className="edit-input arabic-edit-input"
                          dir="rtl"
                          disabled={isLoading}
                        />
                      ) : (
                        <div className="customer-name-cell arabic" dir="rtl">
                          <div className="name-text">{customer.nameArabic || 'N/A'}</div>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {editingCustomer === customer.id ? (
                          <>
                            <button 
                              onClick={() => handleEditCustomer(customer.id)}
                              className="btn-small btn-success"
                              disabled={isLoading || !editName.trim() || !editNameArabic.trim()}
                            >
                              <IconSave /> Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="btn-small btn-secondary"
                              disabled={isLoading}
                            >
                              <IconX /> Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEditing(customer)}
                              className="btn-small btn-primary"
                              disabled={isLoading}
                              title="Edit customer"
                            >
                              <IconEdit /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(customer.id)}
                              className="btn-small btn-danger"
                              disabled={isLoading}
                              title="Delete customer"
                            >
                              <IconTrash /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {searchTerm && filteredCustomers.length > 0 && (
          <div className="search-info">
            Showing {filteredCustomers.length} of {customers.length} customers
            {searchTerm && ` for "${searchTerm}"`}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddCustomer;
