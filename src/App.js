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

import React, { useEffect, useState } from 'react';
import { UserProvider } from './Auth/userContext';
import Admin from './Admin/admin';
import BarcodeScanner from './Pages/BarcodeScanner';
import Login from './Pages/login';
import { auth } from './Auth/firebase';

const App = () => {
  const [currentPage, setCurrentPage] = useState('login');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in, redirect to the appropriate page
        if (user.email === 'doris@elsheikh.lb') {
          setCurrentPage('admin');
        } else {
          setCurrentPage('scanner');
        }
      } else {
        // User is signed out, stay on the login page
        setCurrentPage('login');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'admin':
        return <Admin />;
      case 'scanner':
        return <BarcodeScanner />;
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