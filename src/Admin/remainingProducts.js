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
  const [tableData, setTableData] = useState([]); // State to store table data
  const [editingRow, setEditingRow] = useState(null); // State to track which row is being edited

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const fetchTableData = async () => {
    const monthKey = `${selectedYear}-${selectedMonth}`;
    const dbRef = ref(database, `remainingStock/${monthKey}`);

    try {
      const snapshot = await get(dbRef);
      if (!snapshot.exists()) {
        alert('No data available for the selected month.');
        setTableData([]);
        return;
      }

      const data = snapshot.val();
      const formattedData = await Promise.all(Object.values(data).map(async (product) => {
        const productRef = ref(database, `products/${product.barcode}`);
        const productSnapshot = await get(productRef);
        const initialQuantity = productSnapshot.exists() ? productSnapshot.val().quantity : 0;

        const soldItemsSnapshot = await get(ref(database, 'SoldItems'));
        let totalSoldQuantity = 0;

        if (soldItemsSnapshot.exists()) {
          const soldItemsData = soldItemsSnapshot.val();
          Object.values(soldItemsData).forEach((item) => {
            if (item.barcode === product.barcode) {
              totalSoldQuantity += item.quantity || 0;
            }
          });
        }

      
        const remainingQuantity = initialQuantity - totalSoldQuantity;

        return {
          Barcode: product.barcode,
          Name: product.name,
          Initial_Quantity: initialQuantity,
          Sold_Quantity: totalSoldQuantity,
          Remaining_Quantity: remainingQuantity,
          Recorded_Quantity: product.recordedQuantity,
          Status: product.status || 'Not Confirmed',
        };
      }));

      const sortedData = formattedData.sort((a, b) => a.Name.localeCompare(b.Name));
      setTableData(sortedData);
    } catch (error) {
      console.error('Error fetching table data:', error);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [selectedMonth, selectedYear]);

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
      const formattedData = await Promise.all(Object.values(data).map(async (product) => {
        const productRef = ref(database, `products/${product.barcode}`);
        const productSnapshot = await get(productRef);
        const initialQuantity = productSnapshot.exists() ? productSnapshot.val().quantity : 0;

        const soldItemsSnapshot = await get(ref(database, 'SoldItems'));
        let totalSoldQuantity = 0;

        if (soldItemsSnapshot.exists()) {
          const soldItemsData = soldItemsSnapshot.val();
          Object.values(soldItemsData).forEach((item) => {
            if (item.barcode === product.barcode) {
              totalSoldQuantity += item.quantity || 0;
            }
          });
        }

        const remainingQuantity = initialQuantity - totalSoldQuantity;

        return {
          Barcode: product.barcode,
          Name: product.name,
          Initial_Quantity: initialQuantity,
          Sold_Quantity: totalSoldQuantity,
          Remaining_Quantity: remainingQuantity,
          Recorded_Quantity: product.recordedQuantity,
          Status: product.status || 'Not Confirmed',
        };
      }));

      const sortedData = formattedData.sort((a, b) => a.Name.localeCompare(b.Name));
      const worksheet = XLSX.utils.json_to_sheet(sortedData);
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

    const status = useExisting ? "Confirmed" : "Not Confirmed";

    set(productRef, {
      barcode: scannedProduct.barcode,
      name: scannedProduct.name,
      recordedQuantity: finalQuantity,
      status: status,
    })
      .then(() => {
        console.log('Data saved successfully');
        setRemainingQuantity(finalQuantity);
        setIsPopupOpen(false);
        setInputQuantity('');
        fetchTableData(); // Refresh table data after saving
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

  const handleEdit = (index) => {
    setEditingRow(index);
  };

  const handleSave = async (index) => {
    const row = tableData[index];
    const monthKey = `${selectedYear}-${selectedMonth}`;

    // Reference to the remainingStock table
    const remainingStockRef = ref(database, `remainingStock/${monthKey}/${row.Barcode}`);

    // Reference to the products table
    const productRef = ref(database, `products/${row.Barcode}`);

    try {
      // Save to remainingStock table
      await set(remainingStockRef, {
        barcode: row.Barcode,
        name: row.Name,
        recordedQuantity: row.Recorded_Quantity,
        soldQuantity: row.Sold_Quantity,
        remainingQuantity: row.Remaining_Quantity,
        status: row.Status,
      });

      // Update the products table
      const productSnapshot = await get(productRef);
      if (productSnapshot.exists()) {
        const productData = productSnapshot.val();
        const updatedQuantity = productData.quantity - row.Sold_Quantity; // Adjust quantity based on sold items

        await set(productRef, {
          ...productData,
          quantity: updatedQuantity, // Update the quantity in the products table
        });
      }

      setEditingRow(null);
      fetchTableData(); // Refresh table data after saving
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const handleChange = (index, field, value) => {
    const updatedData = [...tableData];
    updatedData[index][field] = value;

    // Automatically update Remaining Quantity if Sold Quantity is changed
    if (field === 'Sold_Quantity') {
      updatedData[index].Remaining_Quantity = updatedData[index].Initial_Quantity - value;
    }

    setTableData(updatedData);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedTableData = () => {
    if (!sortConfig.key) return tableData;
  
    return [...tableData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
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
                setInputQuantity('');
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

      <div className="table-container">
        <h2>Remaining Stock for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
        <table>
      <thead>
        <tr>
          {['Barcode', 'Name', 'Initial_Quantity', 'Sold_Quantity', 'Remaining_Quantity', 'Recorded_Quantity', 'Status'].map((key) => (
            <th key={key} onClick={() => handleSort(key)} style={{ cursor: 'pointer' }}>
              {key} {sortConfig.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
            </th>
          ))}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sortedTableData().map((row, index) => (
          <tr key={index}>
            <td>{row.Barcode}</td>
            <td>{row.Name}</td>
            <td>{row.Initial_Quantity}</td>
            <td>
              {editingRow === index ? (
                <input
                  type="number"
                  value={row.Sold_Quantity}
                  onChange={(e) => handleChange(index, 'Sold_Quantity', e.target.value)}
                />
              ) : (
                row.Sold_Quantity
              )}
            </td>
            <td>
              {editingRow === index ? (
                <input
                  type="number"
                  value={row.Remaining_Quantity}
                  onChange={(e) => handleChange(index, 'Remaining_Quantity', e.target.value)}
                />
              ) : (
                row.Remaining_Quantity
              )}
            </td>
            <td>
              {editingRow === index ? (
                <input
                  type="number"
                  value={row.Recorded_Quantity}
                  onChange={(e) => handleChange(index, 'Recorded_Quantity', e.target.value)}
                />
              ) : (
                row.Recorded_Quantity
              )}
            </td>
            <td>
              {editingRow === index ? (
                <select
                  value={row.Status}
                  onChange={(e) => handleChange(index, 'Status', e.target.value)}
                >
                  <option value="Not Confirmed">Not Confirmed</option>
                  <option value="Confirmed">Confirmed</option>
                </select>
              ) : (
                row.Status
              )}
            </td>
            <td>
              {editingRow === index ? (
                <button onClick={() => handleSave(index)}>Save</button>
              ) : (
                <button onClick={() => handleEdit(index)}>Edit</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
      </div>
    </div>
  );
};

export default RemainingProducts;