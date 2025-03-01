// import React, { useState, useEffect, useRef } from 'react';
// import { BrowserMultiFormatReader } from '@zxing/library';
// import { database } from '../Auth/firebase';
// import { ref, get, set, child } from 'firebase/database';
// import '../CSS/remainingProducts.css';
// import * as XLSX from 'xlsx';

// const RemainingProducts = () => {
//   const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
//   const [scannedProduct, setScannedProduct] = useState(null);
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [remainingQuantity, setRemainingQuantity] = useState(0);
//   const [products, setProducts] = useState([]);
//   const [selectedProduct, setSelectedProduct] = useState('');
//   const [showScanner, setShowScanner] = useState(false); // State to control scanner visibility
//   const [showDropdown, setShowDropdown] = useState(false); // State to control dropdown visibility
//   const [inputQuantity, setInputQuantity] = useState('');
//   const scannerRef = useRef(null);

//   const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
//   const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

//   // const exportToExcel = async () => {
//   //   const monthKey = `${selectedYear}-${selectedMonth}`;
//   //   const dbRef = ref(database, `remainingStock/${monthKey}`);
  
//   //   try {
//   //     const snapshot = await get(dbRef);
//   //     if (!snapshot.exists()) {
//   //       alert('No data available for the selected month.');
//   //       return;
//   //     }
  
//   //     const data = snapshot.val();
//   //     const formattedData = Object.values(data).map((product) => ({
//   //       Barcode: product.barcode,
//   //       Name: product.name,
//   //       Recorded_Quantity: product.recordedQuantity,
//   //       Status: product.status || 'Not Confirmed', // Include the status in the exported data
//   //     }));
  
//   //     const worksheet = XLSX.utils.json_to_sheet(formattedData);
//   //     const workbook = XLSX.utils.book_new();
//   //     XLSX.utils.book_append_sheet(workbook, worksheet, 'Remaining Stock');
  
//   //     XLSX.writeFile(workbook, `Remaining_Stock_${monthKey}.xlsx`);
//   //   } catch (error) {
//   //     console.error('Error exporting data:', error);
//   //   }
//   // };

//   const exportToExcel = async () => {
//     const monthKey = `${selectedYear}-${selectedMonth}`;
//     const dbRef = ref(database, `remainingStock/${monthKey}`);
  
//     try {
//       const snapshot = await get(dbRef);
//       if (!snapshot.exists()) {
//         alert('No data available for the selected month.');
//         return;
//       }
  
//       const data = snapshot.val();
//       const formattedData = Object.values(data).map((product) => ({
//         Barcode: product.barcode,
//         Name: product.name,
//         Recorded_Quantity: product.recordedQuantity,
//         Status: product.status || 'Not Confirmed', // Include the status in the exported data
//       }));
  
//       const worksheet = XLSX.utils.json_to_sheet(formattedData);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, 'Remaining Stock');
  
//       XLSX.writeFile(workbook, `Remaining_Stock_${monthKey}.xlsx`);
//     } catch (error) {
//       console.error('Error exporting data:', error);
//     }
//   };


//   const getCurrentMonthKey = () => {
//     const now = new Date();
//     return `${now.getFullYear()}-${now.getMonth() + 1}`;
//   };
  
//   const handleConfirmQuantity = (useExisting = false) => {
//     let finalQuantity = useExisting ? remainingQuantity : parseInt(inputQuantity, 10);
  
//     if (finalQuantity <= 0 || isNaN(finalQuantity)) {
//       alert('Please enter a valid quantity.');
//       return;
//     }
  
//     const monthKey = getCurrentMonthKey();
//     const productRef = ref(database, `remainingStock/${monthKey}/${scannedProduct.barcode}`);
  
//     // Only set status to "Confirmed" if user confirms the existing quantity
//     const status = useExisting ? "Confirmed" : "Not Confirmed"; // If not confirming, leave status as "Not Confirmed"
  
//     set(productRef, {
//       barcode: scannedProduct.barcode,
//       name: scannedProduct.name,
//       recordedQuantity: finalQuantity,
//       status: status,  // Conditionally set status
//     })
//       .then(() => {
//         console.log('Data saved successfully');
//         setRemainingQuantity(finalQuantity); // Update UI
//         setIsPopupOpen(false);
//         setInputQuantity(''); // Reset input field
//       })
//       .catch((error) => console.error('Error saving data:', error));
//   };

//   useEffect(() => {
//     if (showScanner) {
//       const codeReader = new BrowserMultiFormatReader();
//       const videoElement = scannerRef.current;

//       codeReader
//         .decodeFromVideoDevice(null, videoElement, (result, error) => {
//           if (result) {
//             setScanStatus('Barcode detected! Processing...');
//             fetchProductDetails(result.text);
//           } else if (error) {
//             setScanStatus('Align the barcode and hold steady.');
//             console.warn('Barcode detection error:', error);
//           }
//         }, {
//           tryHarder: true,
//           constraints: {
//             video: {
//               facingMode: 'environment',
//               width: { ideal: 1280 },
//               height: { ideal: 720 },
//             },
//           },
//         })
//         .then(() => {
//           applyZoom();
//         })
//         .catch((err) => console.error('Camera initialization failed:', err));

//       return () => {
//         codeReader.reset();
//       };
//     }
//   }, [zoomLevel, showScanner]);

//   useEffect(() => {
//     const fetchProducts = async () => {
//       const dbRef = ref(database);
//       try {
//         const productsSnapshot = await get(child(dbRef, 'products'));
//         if (productsSnapshot.exists()) {
//           const productsData = productsSnapshot.val();
//           const productsList = Object.keys(productsData).map((barcode) => ({
//             barcode,
//             ...productsData[barcode],
//           }));
//           setProducts(productsList);
//         }
//       } catch (error) {
//         console.error('Error fetching products:', error);
//       }
//     };

//     fetchProducts();
//   }, []);

//   const applyZoom = async () => {
//     try {
//       const videoElement = scannerRef.current;
//       const stream = videoElement.srcObject;
//       const [track] = stream.getVideoTracks();

//       const capabilities = track.getCapabilities();
//       if ('zoom' in capabilities) {
//         const constraints = {
//           advanced: [{ zoom: zoomLevel }],
//         };
//         await track.applyConstraints(constraints);
//       } else {
//         console.warn('Zoom capability is not supported by this device.');
//       }
//     } catch (error) {
//       console.error('Failed to apply zoom:', error);
//     }
//   };

//   const changeZoom = async (level) => {
//     const videoElement = scannerRef.current;
//     const stream = videoElement.srcObject;
//     const [track] = stream.getVideoTracks();

//     const capabilities = track.getCapabilities();
//     if ('zoom' in capabilities) {
//       const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max || 10);
//       setZoomLevel(newZoomLevel);
//       try {
//         await track.applyConstraints({
//           advanced: [{ zoom: newZoomLevel }],
//         });
//       } catch (error) {
//         console.error('Failed to apply zoom:', error);
//       }
//     } else {
//       console.warn('Zoom capability is not supported by this device.');
//     }
//   };

//   const fetchProductDetails = async (barcode) => {
//     const dbRef = ref(database);
//     try {
//       const productSnapshot = await get(child(dbRef, `products/${barcode}`));
//       if (productSnapshot.exists()) {
//         const product = productSnapshot.val();

//         const soldItemsSnapshot = await get(child(dbRef, 'SoldItems'));
//         let totalSoldQuantity = 0;

//         if (soldItemsSnapshot.exists()) {
//           const soldItemsData = soldItemsSnapshot.val();
//           Object.values(soldItemsData).forEach((item) => {
//             if (item.barcode === barcode) {
//               totalSoldQuantity += item.quantity || 0;
//             }
//           });
//         }

//         const remaining = product.quantity - totalSoldQuantity;

//         setScannedProduct({
//           barcode,
//           name: product.name,
//           itemCost: product.itemCost,
//           productType: product.productType,
//           quantity: product.quantity,
//           remainingQuantity: remaining,
//         });
//         setRemainingQuantity(remaining);
//         setIsPopupOpen(true);
//       } else {
//         setScanStatus('Product not found in the database.');
//       }
//     } catch (error) {
//       console.error('Error fetching product details:', error);
//       setScanStatus('Error retrieving product information.');
//     }
//   };

//   const handleProductSelect = async (event) => {
//     const selectedBarcode = event.target.value;
//     setSelectedProduct(selectedBarcode);
//     if (selectedBarcode) {
//       await fetchProductDetails(selectedBarcode);
//     }
//   };

//   return (
//     <div className="container">
//       <div className="export-container">
//         <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
//           {Array.from({ length: 12 }, (_, i) => (
//             <option key={i + 1} value={i + 1}>
//               {new Date(0, i).toLocaleString('default', { month: 'long' })}
//             </option>
//           ))}
//         </select>

//         <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
//           {Array.from({ length: 10 }, (_, i) => {
//             const year = new Date().getFullYear() - i;
//             return (
//               <option key={year} value={year}>
//                 {year}
//               </option>
//             );
//           })}
//         </select>

//         <button className="action-button" onClick={exportToExcel}>
//           Export as Excel
//         </button>
//       </div>

//       <div className="button-container">
//         <button
//           className="action-button"
//           onClick={() => {
//             setShowScanner(true);
//             setShowDropdown(false);
//             setScanStatus('Align the barcode within the frame.');
//           }}
//         >
//           Scan Barcode
//         </button>
//         <button
//           className="action-button"
//           onClick={() => {
//             setShowDropdown(true);
//             setShowScanner(false);
//             setScanStatus('Select a product from the dropdown.');
//           }}
//         >
//           Search for Product
//         </button>
//       </div>

//       {showScanner && (
//         <div className="scanner-container">
//           <video ref={scannerRef} className="scanner"></video>
//           <p className="status">{scanStatus}</p>

//           <div className="zoom-controls">
//             <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
//             <input
//               type="range"
//               min="0.5"
//               max="10"
//               step="0.1"
//               value={zoomLevel}
//               onChange={(e) => changeZoom(parseFloat(e.target.value))}
//             />
//             <button onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
//           </div>
//         </div>
//       )}

//       {showDropdown && (
//         <div className="dropdown-container">
//           <select value={selectedProduct} onChange={handleProductSelect}>
//             <option value="">Select a product</option>
//             {products.map((product) => (
//               <option key={product.barcode} value={product.barcode}>
//                 {product.name} ({product.barcode})
//               </option>
//             ))}
//           </select>
//         </div>
//       )}

//       {isPopupOpen && scannedProduct && (
//         <div className="modal-overlay">
//           <div className="modal-container">
//             <button
//               className="modal-close-btn"
//               onClick={() => {
//                 setIsPopupOpen(false);
//                 setInputQuantity(''); // Reset input field
//               }}
//               aria-label="Close"
//             >
//               ×
//             </button>
//             <h3 className="modal-title">Product Details</h3>
//             <div className="modal-content">
//               <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
//               <p><strong>Name:</strong> {scannedProduct.name}</p>
//               <p><strong>Item Cost:</strong> ${scannedProduct.itemCost}</p>
//               <p><strong>Product Type:</strong> {scannedProduct.productType}</p>
//               <p><strong>Initial Quantity:</strong> {scannedProduct.quantity}</p>
//               <p><strong>Remaining Quantity:</strong> {remainingQuantity}</p>
//               <button className="modal-btn-confirm" onClick={() => handleConfirmQuantity(true)}>
//                 Confirm Existing Quantity
//               </button>

//               <input
//                 type="number"
//                 value={inputQuantity}
//                 onChange={(e) => setInputQuantity(e.target.value)}
//                 placeholder="Enter new quantity"
//               />

//               <button className="modal-btn-save" onClick={() => handleConfirmQuantity(false)}>
//                 Save Quantity
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default RemainingProducts; 

import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { database } from '../Auth/firebase';
import { ref, get, set, child } from 'firebase/database';
import '../CSS/remainingProducts.css';
import * as XLSX from 'xlsx';

const RemainingProducts = () => {
  const [scanStatus, setScanStatus] = useState('Press "Scan Barcode" to start scanning.');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [remainingQuantity, setRemainingQuantity] = useState(0);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showScanner, setShowScanner] = useState(false); // State to control scanner visibility
  const [showDropdown, setShowDropdown] = useState(false); // State to control dropdown visibility
  const [inputQuantity, setInputQuantity] = useState('');
  const scannerRef = useRef(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const exportToExcel = async () => {
    const monthKey = `${selectedYear}-${selectedMonth}`;
    const dbRef = ref(database, `remainingStock/${monthKey}`);

    try {
      const snapshot = await get(dbRef);
      if (!snapshot.exists()) {
        alert('No data available for the selected month.');
        return;
      }

      const data = snapshot.val();
      const formattedData = Object.values(data).map((product) => ({
        Barcode: product.barcode,
        Name: product.name,
        Recorded_Quantity: product.recordedQuantity,
        Status: product.status || 'Not Confirmed', // Include the status in the exported data
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Remaining Stock');

      XLSX.writeFile(workbook, `Remaining_Stock_${monthKey}.xlsx`);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}`;
  };

  const handleConfirmQuantity = (useExisting = false) => {
    let finalQuantity = useExisting ? remainingQuantity : parseInt(inputQuantity, 10);

    if (finalQuantity <= 0 || isNaN(finalQuantity)) {
      alert('Please enter a valid quantity.');
      return;
    }

    const monthKey = getCurrentMonthKey();
    const productRef = ref(database, `remainingStock/${monthKey}/${scannedProduct.barcode}`);

    // Only set status to "Confirmed" if user confirms the existing quantity
    const status = useExisting ? "Confirmed" : "Not Confirmed"; // If not confirming, leave status as "Not Confirmed"

    set(productRef, {
      barcode: scannedProduct.barcode,
      name: scannedProduct.name,
      recordedQuantity: finalQuantity,
      status: status,  // Conditionally set status
    })
      .then(() => {
        console.log('Data saved successfully');
        setRemainingQuantity(finalQuantity); // Update UI
        setIsPopupOpen(false);
        setInputQuantity(''); // Reset input field
      })
      .catch((error) => console.error('Error saving data:', error));
  };

  useEffect(() => {
    if (showScanner) {
      const codeReader = new BrowserMultiFormatReader();
      const videoElement = scannerRef.current;

      codeReader
        .decodeFromVideoDevice(null, videoElement, (result, error) => {
          if (result) {
            setScanStatus('Barcode detected! Processing...');
            fetchProductDetails(result.text);
          } else if (error) {
            setScanStatus('Align the barcode and hold steady.');
            console.warn('Barcode detection error:', error);
          }
        }, {
          tryHarder: true,
          constraints: {
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
        })
        .then(() => {
          applyZoom();
        })
        .catch((err) => console.error('Camera initialization failed:', err));

      return () => {
        codeReader.reset();
      };
    }
  }, [zoomLevel, showScanner]);

  useEffect(() => {
    const fetchProducts = async () => {
      const dbRef = ref(database);
      try {
        const productsSnapshot = await get(child(dbRef, 'products'));
        if (productsSnapshot.exists()) {
          const productsData = productsSnapshot.val();
          const productsList = Object.keys(productsData).map((barcode) => ({
            barcode,
            ...productsData[barcode],
          }));

          // Sort products alphabetically by name
          const sortedProducts = productsList.sort((a, b) => a.name.localeCompare(b.name));
          setProducts(sortedProducts);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  const applyZoom = async () => {
    try {
      const videoElement = scannerRef.current;
      const stream = videoElement.srcObject;
      const [track] = stream.getVideoTracks();

      const capabilities = track.getCapabilities();
      if ('zoom' in capabilities) {
        const constraints = {
          advanced: [{ zoom: zoomLevel }],
        };
        await track.applyConstraints(constraints);
      } else {
        console.warn('Zoom capability is not supported by this device.');
      }
    } catch (error) {
      console.error('Failed to apply zoom:', error);
    }
  };

  const changeZoom = async (level) => {
    const videoElement = scannerRef.current;
    const stream = videoElement.srcObject;
    const [track] = stream.getVideoTracks();

    const capabilities = track.getCapabilities();
    if ('zoom' in capabilities) {
      const newZoomLevel = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max || 10);
      setZoomLevel(newZoomLevel);
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoomLevel }],
        });
      } catch (error) {
        console.error('Failed to apply zoom:', error);
      }
    } else {
      console.warn('Zoom capability is not supported by this device.');
    }
  };

  const fetchProductDetails = async (barcode) => {
    const dbRef = ref(database);
    try {
      const productSnapshot = await get(child(dbRef, `products/${barcode}`));
      if (productSnapshot.exists()) {
        const product = productSnapshot.val();

        const soldItemsSnapshot = await get(child(dbRef, 'SoldItems'));
        let totalSoldQuantity = 0;

        if (soldItemsSnapshot.exists()) {
          const soldItemsData = soldItemsSnapshot.val();
          Object.values(soldItemsData).forEach((item) => {
            if (item.barcode === barcode) {
              totalSoldQuantity += item.quantity || 0;
            }
          });
        }

        const remaining = product.quantity - totalSoldQuantity;

        setScannedProduct({
          barcode,
          name: product.name,
          itemCost: product.itemCost,
          productType: product.productType,
          quantity: product.quantity,
          remainingQuantity: remaining,
        });
        setRemainingQuantity(remaining);
        setIsPopupOpen(true);
      } else {
        setScanStatus('Product not found in the database.');
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      setScanStatus('Error retrieving product information.');
    }
  };

  const handleProductSelect = async (event) => {
    const selectedBarcode = event.target.value;
    setSelectedProduct(selectedBarcode);
    if (selectedBarcode) {
      await fetchProductDetails(selectedBarcode);
    }
  };

  return (
    <div className="container">
      <div className="export-container">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(0, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>

        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
          {Array.from({ length: 10 }, (_, i) => {
            const year = new Date().getFullYear() - i;
            return (
              <option key={year} value={year}>
                {year}
              </option>
            );
          })}
        </select>

        <button className="action-button" onClick={exportToExcel}>
          Export as Excel
        </button>
      </div>

      <div className="button-container">
        <button
          className="action-button"
          onClick={() => {
            setShowScanner(true);
            setShowDropdown(false);
            setScanStatus('Align the barcode within the frame.');
          }}
        >
          Scan Barcode
        </button>
        <button
          className="action-button"
          onClick={() => {
            setShowDropdown(true);
            setShowScanner(false);
            setScanStatus('Select a product from the dropdown.');
          }}
        >
          Search for Product
        </button>
      </div>

      {showScanner && (
        <div className="scanner-container">
          <video ref={scannerRef} className="scanner"></video>
          <p className="status">{scanStatus}</p>

          <div className="zoom-controls">
            <button onClick={() => changeZoom(Math.max(0.5, zoomLevel - 0.5))}>Zoom Out</button>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => changeZoom(parseFloat(e.target.value))}
            />
            <button onClick={() => changeZoom(Math.min(10, zoomLevel + 0.5))}>Zoom In</button>
          </div>
        </div>
      )}

      {showDropdown && (
        <div className="dropdown-container">
          <select value={selectedProduct} onChange={handleProductSelect}>
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.barcode} value={product.barcode}>
                {product.name} ({product.barcode})
              </option>
            ))}
          </select>
        </div>
      )}

      {isPopupOpen && scannedProduct && (
        <div className="modal-overlay">
          <div className="modal-container">
            <button
              className="modal-close-btn"
              onClick={() => {
                setIsPopupOpen(false);
                setInputQuantity(''); // Reset input field
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="modal-title">Product Details</h3>
            <div className="modal-content">
              <p><strong>Barcode:</strong> {scannedProduct.barcode}</p>
              <p><strong>Name:</strong> {scannedProduct.name}</p>
              <p><strong>Item Cost:</strong> ${scannedProduct.itemCost}</p>
              <p><strong>Product Type:</strong> {scannedProduct.productType}</p>
              <p><strong>Initial Quantity:</strong> {scannedProduct.quantity}</p>
              <p><strong>Remaining Quantity:</strong> {remainingQuantity}</p>
              <button className="modal-btn-confirm" onClick={() => handleConfirmQuantity(true)}>
                Confirm Existing Quantity
              </button>

              <input
                type="number"
                value={inputQuantity}
                onChange={(e) => setInputQuantity(e.target.value)}
                placeholder="Enter new quantity"
              />

              <button className="modal-btn-save" onClick={() => handleConfirmQuantity(false)}>
                Save Quantity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemainingProducts;