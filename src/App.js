// import React from 'react';
// import { UserProvider } from './Auth/userContext'; // Import UserContext
// import Admin from './Admin/admin';
// import BarcodeScanner from './Pages/BarcodeScanner';
// import Login from './Pages/login';

// const App = () => {
//   const [currentPage, setCurrentPage] = React.useState('login');

//   const renderPage = () => {
//     switch (currentPage) {
//       case 'admin':
//         return <Admin />;
//       case 'scanner':
//         return <BarcodeScanner />;
//       default:
//         return <Login onLogin={(page) => setCurrentPage(page)} />;
//     }
//   };

//   return (
//     <UserProvider>
//       <div>{renderPage()}</div>
//     </UserProvider>
//   );
// };

// export default App;

import React, { useContext, useEffect } from 'react';
import { UserProvider, UserContext } from './Auth/userContext'; // Import UserContext
import Admin from './Admin/admin';
import BarcodeScanner from './Pages/BarcodeScanner';
import Login from './Pages/login';

const App = () => {
  const [currentPage, setCurrentPage] = React.useState('login');
  const { user } = useContext(UserContext);  // Access user context

  useEffect(() => {
    if (user) {
      // If user is authenticated, redirect to the admin page or any other page
      setCurrentPage('admin');
    } else {
      // If no user is authenticated, show the login page
      setCurrentPage('login');
    }
  }, [user]);

  const renderPage = () => {
    switch (currentPage) {
      case 'admin':
        return user ? <Admin /> : <Login onLogin={(page) => setCurrentPage(page)} />;
      case 'scanner':
        return user ? <BarcodeScanner /> : <Login onLogin={(page) => setCurrentPage(page)} />;
      default:
        return <Login onLogin={(page) => setCurrentPage(page)} />;
    }
  };

  return (
    <UserProvider>
      <div>{renderPage()}</div>
    </UserProvider>
  );
};

export default App;