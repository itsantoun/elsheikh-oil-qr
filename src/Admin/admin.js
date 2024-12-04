import React, { useContext, useEffect, useState } from 'react';
import Navbar from './navbar';
import AddUsers from './adduser';
import FetchProducts from './fetchProducts';
import ItemsSold from './soldItems';
import { UserContext } from '../Auth/userContext'; // Import UserContext
import '../CSS/admin.css';

const Admin = () => {
  const { user,setUser } = useContext(UserContext); // Access the context
  const [activeSection, setActiveSection] = useState('addUsers'); // Moved useState to the top
  useEffect(() => {
    if (!user || user.email !== 'doris@elsheikh.lb') {

      window.location.href = '/';
    }
  }, [user]);


  const handleLogout = () => {
    setUser(null); // Clear the user context
    window.location.href = '/elsheikh-oil-qr/'; // Redirect to the login page
  };

  if (!user || user.email !== 'doris@elsheikh.lb') {
    return null; // Prevent rendering until redirection
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'addUsers':
        return <AddUsers />;
      case 'addProducts':
        return <FetchProducts />;
      case 'itemsSold':
        return <ItemsSold />;
      default:
        return <AddUsers />;
    }
  };

  return (
    <div className="admin-container">
      
      <Navbar onNavigate={setActiveSection} />
      <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      <div className="admin-content">{renderSection()}</div>
    </div>
  );
};

export default Admin;