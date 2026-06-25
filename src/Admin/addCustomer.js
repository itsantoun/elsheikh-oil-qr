import React, { useState, useEffect } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, set, update, remove, push } from 'firebase/database';
import '../CSS/addCustomer.css';
import { IconCheck, IconAlertTriangle, IconUsers, IconPlus, IconClipboard, IconX, IconRefresh, IconSettings, IconSave, IconEdit, IconTrash, IconUser } from '../utils/icons';
import { useExpiryNotifications } from '../utils/useExpiryNotifications';

const CLIENT_TYPES = [
  { value: 'oil-filter', label: 'Oil & Filter', labelAr: 'زيت وفلتر' },
  { value: 'maghsal', label: 'Maghsal', labelAr: 'مغسل' },
  { value: 'water-filling', label: 'Water Filling', labelAr: 'تعبئة مياه' },
  { value: 'water-distribution', label: 'Water Distribution', labelAr: 'توزيع مياه' },
  { value: 'pickup-water-distribution', label: 'Pickup Water Distribution', labelAr: 'توزيع مياه بيك أب' },
  { value: 'diesel-distribution', label: 'Diesel Distribution', labelAr: 'توزيع ديزل' },
];

const sortByName = (a, b) => {
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return 0;
};

const emptyForm = {
  name: '',
  nameArabic: '',
  phone: '',
  address: '',
  clientTypes: [],
};

const AddCustomer = () => {
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editData, setEditData] = useState({ ...emptyForm });
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [filterType, setFilterType] = useState('');

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
          name: data[key].name || '',
          nameArabic: data[key].nameArabic || '',
          phone: data[key].phone || '',
          address: data[key].address || '',
          clientTypes: data[key].clientTypes || [],
        }));
        customerList.sort(sortByName);
        setCustomers(customerList);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setErrorMessage('Failed to fetch customers.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const toggleClientType = (value, isEdit = false) => {
    const setter = isEdit ? setEditData : setFormData;
    setter(prev => {
      const types = prev.clientTypes.includes(value)
        ? prev.clientTypes.filter(t => t !== value)
        : [...prev.clientTypes, value];
      return { ...prev, clientTypes: types };
    });
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.nameArabic.trim()) {
      setErrorMessage('Both English and Arabic names are required.');
      return;
    }

    try {
      setIsLoading(true);
      const customerData = {
        name: formData.name.trim(),
        nameArabic: formData.nameArabic.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        clientTypes: formData.clientTypes,
      };
      const newCustomerRef = push(ref(database, 'customers'));
      await set(newCustomerRef, customerData);

      setCustomers(prev => {
        const updated = [...prev, { id: newCustomerRef.key, ...customerData }];
        return updated.sort(sortByName);
      });
      setFormData({ ...emptyForm });
      setSuccessMessage('Customer added successfully!');
    } catch (error) {
      console.error('Error adding customer:', error);
      setErrorMessage('Failed to add customer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditing = (customer) => {
    setEditingCustomer(customer.id);
    setEditData({
      name: customer.name,
      nameArabic: customer.nameArabic,
      phone: customer.phone,
      address: customer.address,
      clientTypes: customer.clientTypes || [],
    });
    setExpandedCustomer(customer.id);
  };

  const handleEditCustomer = async (id) => {
    if (!editData.name.trim() || !editData.nameArabic.trim()) {
      setErrorMessage('Both English and Arabic names are required.');
      return;
    }

    try {
      setIsLoading(true);
      const customerData = {
        name: editData.name.trim(),
        nameArabic: editData.nameArabic.trim(),
        phone: editData.phone.trim(),
        address: editData.address.trim(),
        clientTypes: editData.clientTypes,
      };
      await update(ref(database, `customers/${id}`), customerData);

      setCustomers(prev => {
        const updated = prev.map(c =>
          c.id === id ? { ...c, ...customerData } : c
        );
        return updated.sort(sortByName);
      });

      setEditingCustomer(null);
      setSuccessMessage('Customer updated successfully!');
    } catch (error) {
      console.error('Error editing customer:', error);
      setErrorMessage('Failed to update customer.');
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
      setCustomers(prev => prev.filter(c => c.id !== id));
      if (expandedCustomer === id) setExpandedCustomer(null);
      setSuccessMessage(`Customer "${customer.name}" deleted successfully.`);
    } catch (error) {
      console.error('Error deleting customer:', error);
      setErrorMessage('Failed to delete customer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCustomer(null);
    setEditData({ ...emptyForm });
  };

  const handleRefresh = () => {
    fetchCustomers();
    setSuccessMessage('Customer list refreshed!');
  };

  const handleClearForm = () => {
    setFormData({ ...emptyForm });
  };

  const getClientTypeLabel = (value) => {
    const type = CLIENT_TYPES.find(t => t.value === value);
    return type ? type.label : value;
  };

  const filteredCustomers = customers
    .filter(customer => {
      if (filterType && !(customer.clientTypes || []).includes(filterType)) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        customer.name?.toLowerCase().includes(term) ||
        customer.nameArabic?.toLowerCase().includes(term) ||
        customer.phone?.toLowerCase().includes(term) ||
        customer.address?.toLowerCase().includes(term)
      );
    })
    .sort(sortByName);

  const renderClientTypeBadges = (types) => {
    if (!types || types.length === 0) return <span className="no-type">No type assigned</span>;
    return (
      <div className="client-type-badges">
        {types.map(type => (
          <span key={type} className={`client-type-badge badge-${type}`}>
            {getClientTypeLabel(type)}
          </span>
        ))}
      </div>
    );
  };

  const renderClientTypeSelector = (selectedTypes, onToggle) => (
    <div className="client-type-selector">
      {CLIENT_TYPES.map(type => (
        <button
          key={type.value}
          type="button"
          className={`type-chip ${selectedTypes.includes(type.value) ? 'selected' : ''}`}
          onClick={() => onToggle(type.value)}
          disabled={isLoading}
        >
          <span className="type-chip-check">{selectedTypes.includes(type.value) ? '✓' : ''}</span>
          <span className="type-chip-label">{type.label}</span>
          <span className="type-chip-label-ar">{type.labelAr}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="page-shell customers-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Customer Management</h1>
        <p className="page-subtitle">Manage customer profiles and information</p>
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
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
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
                value={formData.nameArabic}
                onChange={(e) => handleFormChange('nameArabic', e.target.value)}
                className="form-input arabic-input"
                dir="rtl"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Phone Number</span>
              </label>
              <input
                type="tel"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
                className="form-input"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Address</span>
              </label>
              <input
                type="text"
                placeholder="Enter address"
                value={formData.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
                className="form-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group form-group-full">
            <label className="form-label">
              <span className="label-text">Client Type</span>
              <span className="label-hint">(select all that apply)</span>
            </label>
            {renderClientTypeSelector(formData.clientTypes, (val) => toggleClientType(val, false))}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || !formData.name.trim() || !formData.nameArabic.trim()}
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
              disabled={isLoading || (
                !formData.name && !formData.nameArabic && !formData.phone && !formData.address && formData.clientTypes.length === 0
              )}
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
            <select
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              disabled={isLoading}
            >
              <option value="">All Types</option>
              {CLIENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
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

        <div className="customer-cards-list">
          {isLoading && customers.length === 0 ? (
            <div className="loading-cell">
              <div className="loading-spinner"></div>
              Loading customers...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="empty-cell">
              <div className="empty-icon"><IconUsers /></div>
              {searchTerm || filterType ? 'No customers found' : 'No customers added yet'}
            </div>
          ) : (
            filteredCustomers.map((customer) => {
              const isExpanded = expandedCustomer === customer.id;
              const isEditing = editingCustomer === customer.id;

              return (
                <div
                  key={customer.id}
                  className={`customer-card ${isExpanded ? 'expanded' : ''} ${isEditing ? 'editing' : ''}`}
                >
                  {/* Card Header - always visible */}
                  <div
                    className="customer-card-header"
                    onClick={() => !isEditing && setExpandedCustomer(isExpanded ? null : customer.id)}
                  >
                    <div className="customer-card-avatar">
                      <IconUser />
                    </div>
                    <div className="customer-card-summary">
                      <div className="customer-card-name">
                        <span className="name-en">{customer.name || 'N/A'}</span>
                        <span className="name-ar" dir="rtl">{customer.nameArabic || ''}</span>
                      </div>
                      <div className="customer-card-meta">
                        {customer.phone && <span className="meta-item phone-meta">{customer.phone}</span>}
                        {renderClientTypeBadges(customer.clientTypes)}
                      </div>
                    </div>
                    <div className="customer-card-actions">
                      {!isEditing && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEditing(customer); }}
                            className="btn-small btn-primary"
                            disabled={isLoading}
                            title="Edit customer"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                            className="btn-small btn-danger"
                            disabled={isLoading}
                            title="Delete customer"
                          >
                            <IconTrash />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details or Edit Form */}
                  {isExpanded && (
                    <div className="customer-card-body">
                      {isEditing ? (
                        <div className="edit-form">
                          <div className="form-grid">
                            <div className="form-group">
                              <label className="form-label">
                                <span className="label-text">Name (English)</span>
                                <span className="required-star">*</span>
                              </label>
                              <input
                                type="text"
                                value={editData.name}
                                onChange={(e) => handleEditChange('name', e.target.value)}
                                className="form-input"
                                disabled={isLoading}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">
                                <span className="label-text">Name (Arabic)</span>
                                <span className="required-star">*</span>
                              </label>
                              <input
                                type="text"
                                value={editData.nameArabic}
                                onChange={(e) => handleEditChange('nameArabic', e.target.value)}
                                className="form-input arabic-input"
                                dir="rtl"
                                disabled={isLoading}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">
                                <span className="label-text">Phone Number</span>
                              </label>
                              <input
                                type="tel"
                                value={editData.phone}
                                onChange={(e) => handleEditChange('phone', e.target.value)}
                                className="form-input"
                                disabled={isLoading}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">
                                <span className="label-text">Address</span>
                              </label>
                              <input
                                type="text"
                                value={editData.address}
                                onChange={(e) => handleEditChange('address', e.target.value)}
                                className="form-input"
                                disabled={isLoading}
                              />
                            </div>
                          </div>
                          <div className="form-group form-group-full">
                            <label className="form-label">
                              <span className="label-text">Client Type</span>
                              <span className="label-hint">(select all that apply)</span>
                            </label>
                            {renderClientTypeSelector(editData.clientTypes, (val) => toggleClientType(val, true))}
                          </div>
                          <div className="edit-actions">
                            <button
                              onClick={() => handleEditCustomer(customer.id)}
                              className="btn-primary"
                              disabled={isLoading || !editData.name.trim() || !editData.nameArabic.trim()}
                            >
                              <IconSave /> Save Changes
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="btn-secondary"
                              disabled={isLoading}
                            >
                              <IconX /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="customer-details">
                          <div className="detail-grid">
                            <div className="detail-item">
                              <span className="detail-label">Phone</span>
                              <span className="detail-value">{customer.phone || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Address</span>
                              <span className="detail-value">{customer.address || '—'}</span>
                            </div>
                            <div className="detail-item detail-item-full">
                              <span className="detail-label">Client Types</span>
                              <div className="detail-value">{renderClientTypeBadges(customer.clientTypes)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {(searchTerm || filterType) && filteredCustomers.length > 0 && (
          <div className="search-info">
            Showing {filteredCustomers.length} of {customers.length} customers
            {searchTerm && ` for "${searchTerm}"`}
            {filterType && ` (${getClientTypeLabel(filterType)})`}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddCustomer;
