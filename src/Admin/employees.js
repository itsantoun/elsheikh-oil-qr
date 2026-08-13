import React, { useState, useEffect } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, set, update, remove, push, onValue } from 'firebase/database';
import '../CSS/addCustomer.css';
import { IconCheck, IconAlertTriangle, IconUsers, IconPlus, IconClipboard, IconX, IconRefresh, IconSave, IconEdit, IconTrash, IconUser } from '../utils/icons';
import PageHeader from '../Components/PageHeader';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { useExchangeRate, formatNumberInput, stripCommas } from '../utils/exchangeRate';

const sortByName = (a, b) => {
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return 0;
};

const toNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const emptyForm = {
  name: '',
  nationality: '',
  role: '',
  phone: '',
  salaryUSD: '',
  salaryLBP: '',
  remark: '',
};

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editData, setEditData] = useState({ ...emptyForm });
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [nationalityFilter, setNationalityFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [nationalities, setNationalities] = useState([]);
  const [roles, setRoles] = useState([]);
  const [confirm, confirmDialog] = useConfirmDialog();
  const exchangeRate = useExchangeRate();

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(database, 'settings/nationalities'), (snap) => {
      if (!snap.exists()) { setNationalities([]); return; }
      const val = snap.val();
      const arr = Array.isArray(val) ? val : Object.values(val || {});
      setNationalities(arr.filter((v) => typeof v === 'string' && v.trim().length > 0));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(database, 'settings/employeeRoles'), (snap) => {
      if (!snap.exists()) { setRoles([]); return; }
      const val = snap.val();
      const arr = Array.isArray(val) ? val : Object.values(val || {});
      setRoles(arr.filter((v) => typeof v === 'string' && v.trim().length > 0));
    });
    return () => unsub();
  }, []);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const employeesRef = ref(database, 'employees');
      const snapshot = await get(employeesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map((key) => ({
          id: key,
          name: data[key].name || '',
          nationality: data[key].nationality || '',
          role: data[key].role || '',
          phone: data[key].phone || '',
          salaryUSD: data[key].salaryUSD ?? '',
          salaryLBP: data[key].salaryLBP ?? '',
          exchangeRateAtEntry: data[key].exchangeRateAtEntry || null,
          remark: data[key].remark || '',
        }));
        list.sort(sortByName);
        setEmployees(list);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage('Failed to fetch employees.');
    } finally {
      setIsLoading(false);
    }
  };

  const flash = (kind, msg) => {
    if (kind === 'success') { setSuccessMessage(msg); setErrorMessage(null); }
    else { setErrorMessage(msg); setSuccessMessage(null); }
    setTimeout(() => { setSuccessMessage(null); setErrorMessage(null); }, 3500);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  // Editing USD recalculates LBP, and vice versa, using the current
  // Settings-managed exchange rate — same rate shown everywhere else
  // (Customers, Water Filling, ...).
  const handleSalaryUSDChange = (value, isEdit = false) => {
    const setter = isEdit ? setEditData : setFormData;
    const usd = toNumber(value);
    setter((prev) => ({ ...prev, salaryUSD: value, salaryLBP: value === '' ? '' : String(Math.round(usd * exchangeRate)) }));
  };

  const handleSalaryLBPChange = (value, isEdit = false) => {
    const setter = isEdit ? setEditData : setFormData;
    const lbp = toNumber(value);
    setter((prev) => ({ ...prev, salaryLBP: value, salaryUSD: value === '' ? '' : String((lbp / exchangeRate).toFixed(2)) }));
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('Employee name is required.');
      return;
    }

    try {
      setIsLoading(true);
      const employeeData = {
        name: formData.name.trim(),
        nationality: formData.nationality,
        role: formData.role,
        phone: formData.phone.trim(),
        salaryUSD: toNumber(formData.salaryUSD),
        salaryLBP: toNumber(formData.salaryLBP),
        exchangeRateAtEntry: exchangeRate,
        remark: formData.remark.trim(),
        createdAt: new Date().toISOString(),
      };
      const newEmployeeRef = push(ref(database, 'employees'));
      await set(newEmployeeRef, employeeData);

      setEmployees((prev) => {
        const updated = [...prev, { id: newEmployeeRef.key, ...employeeData }];
        return updated.sort(sortByName);
      });
      setFormData({ ...emptyForm });
      flash('success', 'Employee added successfully!');
    } catch (error) {
      console.error('Error adding employee:', error);
      flash('error', 'Failed to add employee.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditing = (employee) => {
    setEditingEmployee(employee.id);
    setEditData({
      name: employee.name,
      nationality: employee.nationality,
      role: employee.role,
      phone: employee.phone,
      salaryUSD: String(employee.salaryUSD ?? ''),
      salaryLBP: String(employee.salaryLBP ?? ''),
      remark: employee.remark,
    });
    setExpandedEmployee(employee.id);
  };

  const handleEditEmployee = async (id) => {
    if (!editData.name.trim()) {
      setErrorMessage('Employee name is required.');
      return;
    }

    try {
      setIsLoading(true);
      const employeeData = {
        name: editData.name.trim(),
        nationality: editData.nationality,
        role: editData.role,
        phone: editData.phone.trim(),
        salaryUSD: toNumber(editData.salaryUSD),
        salaryLBP: toNumber(editData.salaryLBP),
        exchangeRateAtEntry: exchangeRate,
        remark: editData.remark.trim(),
      };
      await update(ref(database, `employees/${id}`), employeeData);

      setEmployees((prev) => {
        const updated = prev.map((emp) => (emp.id === id ? { ...emp, ...employeeData } : emp));
        return updated.sort(sortByName);
      });

      setEditingEmployee(null);
      flash('success', 'Employee updated successfully!');
    } catch (error) {
      console.error('Error editing employee:', error);
      flash('error', 'Failed to update employee.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEmployee = async (id) => {
    const employee = employees.find((emp) => emp.id === id);
    if (!employee) return;

    const confirmed = await confirm({
      title: 'Delete Employee?',
      message: `Are you sure you want to delete "${employee.name}"?`,
    });
    if (!confirmed) return;

    try {
      setIsLoading(true);
      await remove(ref(database, `employees/${id}`));
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      if (expandedEmployee === id) setExpandedEmployee(null);
      flash('success', `"${employee.name}" deleted successfully.`);
    } catch (error) {
      console.error('Error deleting employee:', error);
      flash('error', 'Failed to delete employee.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setEditData({ ...emptyForm });
  };

  const handleRefresh = () => {
    fetchEmployees();
    flash('success', 'Employee list refreshed!');
  };

  const handleClearForm = () => setFormData({ ...emptyForm });

  const filteredEmployees = employees
    .filter((employee) => {
      if (nationalityFilter && employee.nationality !== nationalityFilter) return false;
      if (roleFilter && employee.role !== roleFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        employee.name?.toLowerCase().includes(term) ||
        employee.phone?.toLowerCase().includes(term) ||
        employee.nationality?.toLowerCase().includes(term) ||
        employee.role?.toLowerCase().includes(term)
      );
    })
    .sort(sortByName);

  return (
    <div className="page-shell customers-page">
      <PageHeader title="Employees" subtitle="Manage employee profiles and salaries" />

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

      {/* Add Employee Form */}
      <div className="form-card">
        <div className="form-header">
          <h2 className="form-title">
            <span className="form-icon"><IconUsers /></span>
            Add New Employee
          </h2>
          <div className="form-stats">
            <span className="stats-badge">{employees.length} Employees</span>
          </div>
        </div>

        <form onSubmit={handleAddEmployee} className="customer-form">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Employee Name</span>
                <span className="required-star">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter employee name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                className="form-input"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Nationality</span>
              </label>
              <select
                value={formData.nationality}
                onChange={(e) => handleFormChange('nationality', e.target.value)}
                className="form-select"
                disabled={isLoading}
              >
                <option value="">Select nationality…</option>
                {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {nationalities.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  No nationalities set up yet. Add them from <strong>Settings</strong>.
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Role</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleFormChange('role', e.target.value)}
                className="form-select"
                disabled={isLoading}
              >
                <option value="">Select role…</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {roles.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  No roles set up yet. Add them from <strong>Settings</strong>.
                </p>
              )}
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
                <span className="label-text">Salary (USD)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Enter salary in USD"
                value={formatNumberInput(formData.salaryUSD)}
                onChange={(e) => handleSalaryUSDChange(stripCommas(e.target.value), false)}
                className="form-input"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-text">Salary (LBP)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Enter salary in LBP"
                value={formatNumberInput(formData.salaryLBP)}
                onChange={(e) => handleSalaryLBPChange(stripCommas(e.target.value), false)}
                className="form-input"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group form-group-full">
            <label className="form-label">
              <span className="label-text">Remarks</span>
            </label>
            <textarea
              placeholder="Any notes about this employee..."
              value={formData.remark}
              onChange={(e) => handleFormChange('remark', e.target.value)}
              className="form-textarea"
              rows="2"
              disabled={isLoading}
            />
          </div>

          <div className="form-actions">
            <div className="form-actions-buttons">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !formData.name.trim()}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Adding...
                  </>
                ) : (
                  <>
                    <span className="button-icon"><IconPlus /></span>
                    Add Employee
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="btn-secondary"
                disabled={isLoading || (
                  !formData.name && !formData.nationality && !formData.role && !formData.phone &&
                  !formData.salaryUSD && !formData.salaryLBP && !formData.remark
                )}
              >
                Clear Form
              </button>
            </div>
            <div className="exchange-rate-banner">
              <span className="exchange-rate-banner-label">Rate Today</span>
              <span className="exchange-rate-banner-value">1 USD = {exchangeRate.toLocaleString('en-US')} LBP</span>
            </div>
          </div>
        </form>
      </div>

      {/* Employee List */}
      <div className="table-card">
        <div className="table-header">
          <div className="table-header-left">
            <h2 className="table-title">
              <span className="table-icon"><IconClipboard /></span>
              Employee List
            </h2>
            <div className="table-stats">
              {filteredEmployees.length} of {employees.length} employees
            </div>
          </div>
          <div className="table-header-right">
            <select
              className="filter-select"
              value={nationalityFilter}
              onChange={(e) => setNationalityFilter(e.target.value)}
              disabled={isLoading}
            >
              <option value="">All Nationalities</option>
              {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              className="filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              disabled={isLoading}
            >
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search employees..."
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
          {isLoading && employees.length === 0 ? (
            <div className="loading-cell">
              <div className="loading-spinner"></div>
              Loading employees...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="empty-cell">
              <div className="empty-icon"><IconUsers /></div>
              {searchTerm || nationalityFilter || roleFilter ? 'No employees found' : 'No employees added yet'}
            </div>
          ) : (
            filteredEmployees.map((employee) => {
              const isExpanded = expandedEmployee === employee.id;
              const isEditing = editingEmployee === employee.id;

              return (
                <div
                  key={employee.id}
                  className={`customer-card ${isExpanded ? 'expanded' : ''} ${isEditing ? 'editing' : ''}`}
                >
                  <div
                    className="customer-card-header"
                    onClick={() => !isEditing && setExpandedEmployee(isExpanded ? null : employee.id)}
                  >
                    <div className="customer-card-avatar">
                      <IconUser />
                    </div>
                    <div className="customer-card-summary">
                      <div className="customer-card-name">
                        <span className="name-en">{employee.name || 'N/A'}</span>
                        {employee.nationality && <span className="name-ar">{employee.nationality}</span>}
                      </div>
                      <div className="customer-card-meta">
                        {employee.role && <span className="meta-item">{employee.role}</span>}
                        {employee.phone && <span className="meta-item phone-meta">{employee.phone}</span>}
                        <span className="meta-item">${Number(employee.salaryUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="meta-item">LBP {Number(employee.salaryLBP || 0).toLocaleString('en-US')}</span>
                      </div>
                    </div>
                    <div className="customer-card-actions">
                      {!isEditing && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartEditing(employee); }}
                            className="btn-small btn-primary"
                            disabled={isLoading}
                            title="Edit employee"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(employee.id); }}
                            className="btn-small btn-danger"
                            disabled={isLoading}
                            title="Delete employee"
                          >
                            <IconTrash />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="customer-card-body">
                      {isEditing ? (
                        <div className="edit-form">
                          <div className="form-grid">
                            <div className="form-group">
                              <label className="form-label">
                                <span className="label-text">Employee Name</span>
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
                                <span className="label-text">Nationality</span>
                              </label>
                              <select
                                value={editData.nationality}
                                onChange={(e) => handleEditChange('nationality', e.target.value)}
                                className="form-select"
                                disabled={isLoading}
                              >
                                <option value="">Select nationality…</option>
                                {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">
                                <span className="label-text">Role</span>
                              </label>
                              <select
                                value={editData.role}
                                onChange={(e) => handleEditChange('role', e.target.value)}
                                className="form-select"
                                disabled={isLoading}
                              >
                                <option value="">Select role…</option>
                                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
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
                                <span className="label-text">Salary (USD)</span>
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberInput(editData.salaryUSD)}
                                onChange={(e) => handleSalaryUSDChange(stripCommas(e.target.value), true)}
                                className="form-input"
                                disabled={isLoading}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">
                                <span className="label-text">Salary (LBP)</span>
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberInput(editData.salaryLBP)}
                                onChange={(e) => handleSalaryLBPChange(stripCommas(e.target.value), true)}
                                className="form-input"
                                disabled={isLoading}
                              />
                            </div>
                          </div>
                          <div className="form-group form-group-full">
                            <label className="form-label">
                              <span className="label-text">Remarks</span>
                            </label>
                            <textarea
                              value={editData.remark}
                              onChange={(e) => handleEditChange('remark', e.target.value)}
                              className="form-textarea"
                              rows="2"
                              disabled={isLoading}
                            />
                          </div>
                          <div className="edit-actions">
                            <button
                              onClick={() => handleEditEmployee(employee.id)}
                              className="btn-primary"
                              disabled={isLoading || !editData.name.trim()}
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
                              <span className="detail-label">Nationality</span>
                              <span className="detail-value">{employee.nationality || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Role</span>
                              <span className="detail-value">{employee.role || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Phone</span>
                              <span className="detail-value">{employee.phone || '—'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Salary (USD)</span>
                              <span className="detail-value">${Number(employee.salaryUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Salary (LBP)</span>
                              <span className="detail-value">LBP {Number(employee.salaryLBP || 0).toLocaleString('en-US')}</span>
                            </div>
                            {employee.exchangeRateAtEntry && (
                              <div className="detail-item">
                                <span className="detail-label">Rate Used</span>
                                <span className="detail-value">1 USD = {Number(employee.exchangeRateAtEntry).toLocaleString('en-US')} LBP</span>
                              </div>
                            )}
                            {employee.remark && (
                              <div className="detail-item detail-item-full">
                                <span className="detail-label">Remarks</span>
                                <span className="detail-value">{employee.remark}</span>
                              </div>
                            )}
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

        {(searchTerm || nationalityFilter || roleFilter) && filteredEmployees.length > 0 && (
          <div className="search-info">
            Showing {filteredEmployees.length} of {employees.length} employees
            {searchTerm && ` for "${searchTerm}"`}
            {nationalityFilter && ` (${nationalityFilter})`}
            {roleFilter && ` (${roleFilter})`}
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
};

export default Employees;
