// import React, { useState, useEffect } from 'react';
// import { database, auth } from '../Auth/firebase';
// import { ref, get, set, remove } from 'firebase/database';
// import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from 'firebase/auth';
// import '../CSS/addUser.css';

// const AddUser = () => {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [name, setName] = useState(''); // State for user name
//   const [users, setUsers] = useState([]);
//   const [successMessage, setSuccessMessage] = useState(null);
//   const [errorMessage, setErrorMessage] = useState(null);

//   useEffect(() => {
//     const fetchUsers = async () => {
//       try {
//         const usersRef = ref(database, 'users');
//         const snapshot = await get(usersRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const userList = Object.keys(data).map((key) => ({
//             id: key,
//             ...data[key],
//           }));
//           setUsers(userList);
//         }
//       } catch (error) {
//         console.error('Error fetching users:', error);
//         setErrorMessage('Failed to fetch users.');
//         setTimeout(() => setErrorMessage(null), 3000);
//       }
//     };

//     fetchUsers();
//   }, []);

//   const handleAddUser = async () => {
//     if (!email || !password || !name) {
//       setErrorMessage('Name, email, and password are required!');
//       setTimeout(() => setErrorMessage(null), 3000);
//       return;
//     }

//     try {
//       const userCredential = await createUserWithEmailAndPassword(auth, email, password);
//       const uid = userCredential.user.uid;

//       const userRef = ref(database, `users/${uid}`);
//       await set(userRef, { name, email, password });

//       setSuccessMessage('User added successfully!');
//       setUsers([...users, { id: uid, name, email, password }]);
//       setName('');
//       setEmail('');
//       setPassword('');
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (error) {
//       console.error('Error adding user:', error);
//       setErrorMessage('Failed to add user: ' + error.message);
//       setTimeout(() => setErrorMessage(null), 3000);
//     }
//   };

//   const handleDeleteUser = async (id) => {
//     if (!window.confirm('Are you sure you want to delete this user?')) {
//       return;
//     }

//     const userRef = ref(database, `users/${id}`);

//     try {
//       const snapshot = await get(userRef);
//       if (snapshot.exists()) {
//         const userData = snapshot.val();

//         await signInWithEmailAndPassword(auth, userData.email, userData.password);
//         const currentUser = auth.currentUser;

//         if (currentUser) {
//           await deleteUser(currentUser);
//         }

//         await remove(userRef);
//         setUsers(users.filter((user) => user.id !== id));
//         setSuccessMessage('User deleted successfully!');
//         setTimeout(() => setSuccessMessage(null), 3000);
//       } else {
//         throw new Error('User not found in the database.');
//       }
//     } catch (error) {
//       console.error('Error deleting user:', error);
//       setErrorMessage('Failed to delete user: ' + error.message);
//       setTimeout(() => setErrorMessage(null), 3000);
//     }
//   };

//   return (
//     <div className="add-user-container">
//       <h1 className="add-user-title">Add User</h1>

//       {successMessage && <div className="add-user-success">{successMessage}</div>}
//       {errorMessage && <div className="add-user-error">{errorMessage}</div>}

//       <div className="add-user-form">
//         <input
//           type="text"
//           placeholder="Name"
//           value={name}
//           onChange={(e) => setName(e.target.value)}
//           className="add-user-input"
//         />
//         <input
//           type="email"
//           placeholder="Email"
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="add-user-input"
//         />
//         <input
//           type="password"
//           placeholder="Password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           className="add-user-input"
//         />
//         <button onClick={handleAddUser} className="add-user-button">
//           Add User
//         </button>
//       </div>

//       <div className="add-user-list">
//         <h2>Users</h2>
//         <table className="add-user-table">
//           <thead>
//             <tr>
//               <th>Name</th>
//               <th>Email</th>
//               <th>Password</th>
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {users.map((user) => (
//               <tr key={user.id}>
//                 <td>{user.name || 'N/A'}</td>
//                 <td>{user.email || 'N/A'}</td>
//                 <td>{user.password || 'N/A'}</td>
//                 <td>
//                   <button
//                     className="add-user-delete-button"
//                     onClick={() => handleDeleteUser(user.id)}
//                   >
//                     Delete
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// };

// export default AddUser;

import React, { useState, useEffect } from 'react';
import { database, auth } from '../Auth/firebase';
import { ref, get, set, remove } from 'firebase/database';
import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from 'firebase/auth';
import '../CSS/addUser.css';

const AddUser = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [users, setUsers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordsInTable, setShowPasswordsInTable] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const userList = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setUsers(userList);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setErrorMessage('Failed to fetch users.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    fetchUsers();
  }, []);

  const handleAddUser = async () => {
    if (!email || !password || !name) {
      setErrorMessage('Name, email, and password are required!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const userRef = ref(database, `users/${uid}`);
      await set(userRef, { name, email, password });

      setSuccessMessage('User added successfully!');
      setUsers([...users, { id: uid, name, email, password }]);
      setName('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding user:', error);
      setErrorMessage('Failed to add user: ' + error.message);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    const userRef = ref(database, `users/${id}`);

    try {
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();

        await signInWithEmailAndPassword(auth, userData.email, userData.password);
        const currentUser = auth.currentUser;

        if (currentUser) {
          await deleteUser(currentUser);
        }

        await remove(userRef);
        setUsers(users.filter((user) => user.id !== id));
        setSuccessMessage('User deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        throw new Error('User not found in the database.');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setErrorMessage('Failed to delete user: ' + error.message);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleTablePasswordsVisibility = () => {
    setShowPasswordsInTable(!showPasswordsInTable);
  };

  return (
    <div className="admin-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">Add and manage system users</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="success-message">
          <span className="message-icon">✓</span>
          <span className="message-text">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="error-message">
          <span className="message-icon">⚠️</span>
          <span className="message-text">{errorMessage}</span>
        </div>
      )}

      {/* Add User Form */}
      <div className="form-card">
        <div className="form-header">
          <h2 className="form-title">
            <span className="form-icon">👤</span>
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
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Password</span>
              <span className="required-star">*</span>
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input password-input"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="password-toggle-btn"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <div className="password-hint">Must be at least 6 characters</div>
          </div>
        </div>

        <div className="form-actions">
          <button onClick={handleAddUser} className="btn-primary">
            <span className="button-icon">➕</span>
            Add User
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="table-card">
        <div className="table-header">
          <h2 className="table-title">
            <span className="table-icon">👥</span>
            User List
          </h2>
          <div className="table-actions">
            <button 
              onClick={toggleTablePasswordsVisibility} 
              className="btn-secondary"
            >
              <span className="button-icon">
                {showPasswordsInTable ? "👁️" : "👁️‍🗨️"}
              </span>
              {showPasswordsInTable ? "Hide Passwords" : "Show Passwords"}
            </button>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              <span className="button-icon">🔄</span>
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
                    <span className="header-icon">👤</span>
                    Name
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon">📧</span>
                    Email
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon">🔐</span>
                    Password
                  </div>
                </th>
                <th>
                  <div className="table-header-cell">
                    <span className="header-icon">⚙️</span>
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
                      <span className="email-icon">✉️</span>
                      <span className="email-text">{user.email || 'N/A'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="password-cell">
                      <span className="password-text">
                        {showPasswordsInTable ? user.password || 'N/A' : '••••••••'}
                      </span>
                      {!showPasswordsInTable && (
                        <span className="password-hidden-text">(click Show Passwords to view)</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="btn-danger btn-small"
                    >
                      <span className="button-icon">🗑️</span>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p className="empty-text">No users found. Add your first user above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddUser;