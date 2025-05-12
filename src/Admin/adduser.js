import React, { useState, useEffect } from 'react';
import { database, auth } from '../Auth/firebase';
import { ref, get, set, remove } from 'firebase/database';
import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from 'firebase/auth';
import '../CSS/addUser.css';

const AddUser = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // State for user name
  const [users, setUsers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

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

  return (
    <div className="add-user-container">
      <h1 className="add-user-title">Add User</h1>

      {successMessage && <div className="add-user-success">{successMessage}</div>}
      {errorMessage && <div className="add-user-error">{errorMessage}</div>}

      <div className="add-user-form">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="add-user-input"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="add-user-input"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="add-user-input"
        />
        <button onClick={handleAddUser} className="add-user-button">
          Add User
        </button>
      </div>

      <div className="add-user-list">
        <h2>Users</h2>
        <table className="add-user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name || 'N/A'}</td>
                <td>{user.email || 'N/A'}</td>
                <td>{user.password || 'N/A'}</td>
                <td>
                  <button
                    className="add-user-delete-button"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AddUser;