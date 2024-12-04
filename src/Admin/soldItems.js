// import React, { useState, useEffect } from 'react';
// import { database } from '../Auth/firebase';
// import { ref, get } from 'firebase/database';
// import { writeFile, utils } from 'xlsx'; // Import xlsx functions
// import '../CSS/soldItems.css';

// const SoldItems = () => {
//   const [soldItems, setSoldItems] = useState([]);
//   const [errorMessage, setErrorMessage] = useState(null);

//   // Fetch Sold Items
//   useEffect(() => {
//     const fetchSoldItems = async () => {
//       try {
//         const soldItemsRef = ref(database, 'SoldItems');
//         const snapshot = await get(soldItemsRef);
//         if (snapshot.exists()) {
//           const data = snapshot.val();
//           const soldItemList = Object.keys(data).map((key) => ({
//             id: key,
//             ...data[key],
//           }));
//           setSoldItems(soldItemList);
//         } else {
//           setSoldItems([]);
//         }
//       } catch (error) {
//         console.error('Error fetching sold items:', error);
//         setErrorMessage('Failed to fetch sold items.');
//         setTimeout(() => setErrorMessage(null), 3000);
//       }
//     };

//     fetchSoldItems();
//   }, []);

//   // Export to Excel
//   const handleExportToExcel = () => {
//     if (soldItems.length === 0) {
//       setErrorMessage('No data to export!');
//       setTimeout(() => setErrorMessage(null), 3000);
//       return;
//     }

//     // Prepare data for export
//     const worksheet = utils.json_to_sheet(soldItems);
//     const workbook = utils.book_new();
//     utils.book_append_sheet(workbook, worksheet, 'Sold Items');

//     // Generate and download Excel file
//     writeFile(workbook, 'SoldItems.xlsx');
//   };

//   return (
//     <div className="sold-items-container">
//       <h1 className="sold-items-title">Sold Items</h1>

//       {/* Error Message */}
//       {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

//       {/* Export Button */}
//       <div className="export-button-container">
//         <button onClick={handleExportToExcel} className="export-button">
//           Export to Excel
//         </button>
//       </div>

//       {/* Sold Items List */}
//       <div className="sold-items-list">
//         {soldItems.length === 0 ? (
//           <p>No items sold yet.</p>
//         ) : (
//           <table className="sold-items-table">
//             <thead>
//               <tr>
//                 <th>ID</th>
//                 <th>Name</th>
//                 <th>Category</th>
//                 <th>Price</th>
//                 <th>Date Scanned</th>
//               </tr>
//             </thead>
//             <tbody>
//               {soldItems.map((item) => (
//                 <tr key={item.id}>
//                   <td>{item.id}</td>
//                   <td>{item.name || 'N/A'}</td>
//                   <td>{item.category || 'N/A'}</td>
//                   <td>
//                     {typeof item.price === 'number'
//                       ? `$${item.price.toFixed(2)}`
//                       : 'N/A'}
//                   </td>
//                   <td>{new Date(item.dateScanned).toLocaleString()}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SoldItems;

import React, { useState, useEffect, useContext } from 'react';
import { database } from '../Auth/firebase';
import { ref, get } from 'firebase/database';
import { writeFile, utils } from 'xlsx'; // Import xlsx functions
import { UserContext } from '../Auth/userContext'; // Context to get logged-in user
import '../CSS/soldItems.css';

const SoldItems = () => {
  const [soldItems, setSoldItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const { user } = useContext(UserContext); // Access logged-in user's email

  // Fetch Sold Items
  useEffect(() => {
    const fetchSoldItems = async () => {
      try {
        const soldItemsRef = ref(database, 'SoldItems');
        const snapshot = await get(soldItemsRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const soldItemList = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setSoldItems(soldItemList);
        } else {
          setSoldItems([]);
        }
      } catch (error) {
        console.error('Error fetching sold items:', error);
        setErrorMessage('Failed to fetch sold items.');
        setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    fetchSoldItems();
  }, []);

  // Export to Excel
  const handleExportToExcel = () => {
    if (soldItems.length === 0) {
      setErrorMessage('No data to export!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    // Prepare data for export
    const worksheet = utils.json_to_sheet(soldItems);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Sold Items');

    // Generate and download Excel file
    writeFile(workbook, 'SoldItems.xlsx');
  };

  return (
    <div className="sold-items-container">
      <h1 className="sold-items-title">Sold Items</h1>

      {/* Error Message */}
      {errorMessage && <div className="sold-items-error">{errorMessage}</div>}

      {/* Export Button */}
      <div className="export-button-container">
        <button onClick={handleExportToExcel} className="export-button">
          Export to Excel
        </button>
      </div>

      {/* Sold Items List */}
      <div className="sold-items-list">
        {soldItems.length === 0 ? (
          <p>No items sold yet.</p>
        ) : (
          <table className="sold-items-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Date Scanned</th>
                <th>Scanned By</th>
              </tr>
            </thead>
            <tbody>
              {soldItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name || 'N/A'}</td>
                  <td>{item.category || 'N/A'}</td>
                  <td>
                    {typeof item.price === 'number'
                      ? `$${item.price.toFixed(2)}`
                      : 'N/A'}
                  </td>
                  <td>{new Date(item.dateScanned).toLocaleString()}</td>
                  <td>{item.scannedBy || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SoldItems;