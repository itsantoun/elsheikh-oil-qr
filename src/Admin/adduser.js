import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { database, app as primaryApp, auth } from '../Auth/firebase';
import { ref, get, set, update } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import '../CSS/addUser.css';
import { IconCheck, IconAlertTriangle, IconUser, IconUsers, IconPlus, IconRefresh, IconMail, IconSettings, IconTrash } from '../utils/icons';
import { useExpiryNotifications } from '../utils/useExpiryNotifications';
import PageHeader from '../Components/PageHeader';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import {
  isValidEmail,
  isValidName,
  validatePassword,
  MAX_EMAIL_LEN,
  MAX_NAME_LEN,
  MAX_PASSWORD_LEN,
} from '../Auth/validators';

const AddUser = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [users, setUsers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [confirm, confirmDialog] = useConfirmDialog();

  useExpiryNotifications({ successMessage, errorMessage });

  const normalizeRole = (value) => (String(value || '').toLowerCase() === 'admin' ? 'admin' : 'user');
  const normalizeStatus = (value) => (String(value || '').toLowerCase() === 'inactive' ? 'inactive' : 'active');

  const fetchUsers = useCallback(async () => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const userList = Object.keys(data).map((key) => ({
          id: key,
          name: data[key]?.name || '',
          email: data[key]?.email || '',
          createdAt: data[key]?.createdAt || '',
          role: normalizeRole(data[key]?.role),
          status: normalizeStatus(data[key]?.status),
        }));
        setUsers(userList);
        const drafts = userList.reduce((acc, user) => {
          acc[user.id] = user.role;
          return acc;
        }, {});
        setRoleDrafts(drafts);
      } else {
        setUsers([]);
        setRoleDrafts({});
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setErrorMessage('Failed to fetch users.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createAuthUserWithoutSwitchingSession = async (targetEmail, userPassword) => {
    const secondaryAppName = `admin-create-user-${Date.now()}`;
    const secondaryApp = initializeApp(primaryApp.options, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        targetEmail,
        userPassword
      );
      await signOut(secondaryAuth);
      return userCredential.user.uid;
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const handleAddUser = async () => {
    const cleanedName = name.trim();
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedPassword = password;
    const cleanedRole = normalizeRole(role);

    if (!isValidName(cleanedName)) {
      setErrorMessage('Please enter a valid name (1–120 characters).');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (!isValidEmail(cleanedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const pw = validatePassword(cleanedPassword);
    if (!pw.ok) {
      setErrorMessage(pw.error);
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    try {
      const uid = await createAuthUserWithoutSwitchingSession(cleanedEmail, cleanedPassword);

      const userRef = ref(database, `users/${uid}`);
      await set(userRef, {
        name: cleanedName,
        email: cleanedEmail,
        role: cleanedRole,
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      setSuccessMessage('User created successfully. Password is not stored in database.');
      setUsers((prev) => [...prev, { id: uid, name: cleanedName, email: cleanedEmail, role: cleanedRole, status: 'active' }]);
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding user:', error);
      setErrorMessage('Failed to add user: ' + error.message);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleToggleUserStatus = async (id) => {
    const targetUser = users.find((user) => user.id === id) || null;
    if (!targetUser) return;

    if (id === auth.currentUser?.uid) {
      setErrorMessage('You cannot deactivate your own active session.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const nextStatus = normalizeStatus(targetUser.status) === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'inactive' ? 'deactivate' : 'reactivate';
    const confirmed = await confirm({
      title: nextStatus === 'inactive' ? 'Deactivate User?' : 'Reactivate User?',
      message: `Are you sure you want to ${actionLabel} this user profile?`,
      confirmLabel: nextStatus === 'inactive' ? 'Yes, Deactivate' : 'Yes, Reactivate',
      danger: nextStatus === 'inactive',
    });
    if (!confirmed) {
      return;
    }

    try {
      await update(ref(database, `users/${id}`), {
        status: nextStatus,
        deactivatedAt: nextStatus === 'inactive' ? new Date().toISOString() : null,
      });
      setUsers((prev) => prev.map((user) => (
        user.id === id ? { ...user, status: nextStatus } : user
      )));
      setSuccessMessage(
        nextStatus === 'inactive'
          ? 'User profile deactivated. Records were not changed.'
          : 'User profile reactivated.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error toggling user status:', error);
      setErrorMessage('Failed to update user status: ' + error.message);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleRoleDraftChange = (userId, nextRole) => {
    setRoleDrafts((prev) => ({
      ...prev,
      [userId]: normalizeRole(nextRole),
    }));
  };

  const handleRoleUpdate = async (userId) => {
    const nextRole = normalizeRole(roleDrafts[userId]);
    const currentUser = users.find((user) => user.id === userId);
    if (!currentUser) return;

    if (nextRole === normalizeRole(currentUser.role)) {
      setSuccessMessage('Role already set.');
      setTimeout(() => setSuccessMessage(null), 2000);
      return;
    }

    try {
      await update(ref(database, `users/${userId}`), { role: nextRole });
      setUsers((prev) => prev.map((user) => (
        user.id === userId ? { ...user, role: nextRole } : user
      )));
      setSuccessMessage('User role updated successfully.');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (error) {
      console.error('Error updating user role:', error);
      setErrorMessage('Failed to update user role.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  return (
    <div className="admin-container">
      <PageHeader title="User Management" subtitle="Add and manage system users" />

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

      {/* Add User Form */}
      <div className="form-card">
        <div className="form-header">
          <h2 className="form-title">
            <span className="form-icon"><IconUser /></span>
            Add New User
          </h2>
          <div className="form-stats">
            <span className="stats-badge">{users.length} Users</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Full Name</span>
              <span className="required-star">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              maxLength={MAX_NAME_LEN}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Email Address</span>
              <span className="required-star">*</span>
            </label>
            <input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              maxLength={MAX_EMAIL_LEN}
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Password</span>
              <span className="required-star">*</span>
            </label>
            <input
              type="password"
              placeholder="Enter password (min 8 chars, letters + numbers)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              autoComplete="new-password"
              maxLength={MAX_PASSWORD_LEN}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Role</span>
              <span className="required-star">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-input"
            >
              <option value="user">User (Barcode Scanner)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
          </div>

        </div>
       
        <div className="form-actions">
          <button onClick={handleAddUser} className="btn-primary">
            <span className="button-icon"><IconPlus /></span>
            Add User
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="table-card">
        <div className="table-header">
          <h2 className="table-title">
            <span className="table-icon"><IconUsers /></span>
            User List
          </h2>
          <div className="table-actions">
            <button onClick={fetchUsers} className="btn-secondary">
              <span className="button-icon"><IconRefresh /></span>
              Refresh
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon"><IconUser /></span>
                    Name
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon"><IconMail /></span>
                    Email
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon"><IconSettings /></span>
                    Role
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon"><IconSettings /></span>
                    Status
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
              {users.map((user) => (
                <tr key={user.id} className="table-row">
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="user-info">
                        <div className="user-name">{user.name || 'N/A'}</div>
                        <div className="user-id">ID: {user.id.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="email-cell">
                      <span className="email-icon"><IconMail /></span>
                      <span className="email-text">{user.email || 'N/A'}</span>
                    </div>
                  </td>
                  <td>
                    <span className="stats-badge">
                      {normalizeRole(user.role) === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span className="stats-badge">
                      {normalizeStatus(user.status) === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <select
                        value={roleDrafts[user.id] || normalizeRole(user.role)}
                        onChange={(e) => handleRoleDraftChange(user.id, e.target.value)}
                        className="form-input"
                        style={{ minWidth: 120 }}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleRoleUpdate(user.id)}
                        className="btn-small btn-primary"
                      >
                        Save Role
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(user.id)}
                        className="btn-danger btn-small"
                      >
                        <span className="button-icon"><IconTrash /></span>
                        {normalizeStatus(user.status) === 'inactive' ? 'Reactivate' : 'Deactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><IconUsers /></div>
              <p className="empty-text">No users found. Add your first user above.</p>
            </div>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
};

export default AddUser;
