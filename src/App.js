// import React from 'react';
// import BarcodeScanner from './Pages/BarcodeScanner';

// const App = () => {
//   const handleScanSuccess = (decodedText, decodedResult) => {
//     console.log(`Scanned code: ${decodedText}`);
//     // You can implement additional logic or display the scanned product here
//   };

//   return (
//     <div>
//       <h1>Barcode Scanner</h1>
//       <p>Scan a barcode to fetch product details from the database.</p>
//       <BarcodeScanner onScanSuccess={handleScanSuccess} />
//     </div>
//   );
// };

// export default App;


import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import BarcodeScanner from './Pages/BarcodeScanner';
import Admin from './Admin/admin';
import Login from './Pages/login'

const App = () => {
  return (
    <>
    <p>hello</p>
    </>
    // <Router>
    //   <Routes>
    //     <Route path="/" element={<Login />} />
    //     <Route path="/scanner" element={<BarcodeScanner />} />
    //     <Route path="/admin" element={<Admin />} />
    //   </Routes>
    // </Router>
  );
};

export default App;