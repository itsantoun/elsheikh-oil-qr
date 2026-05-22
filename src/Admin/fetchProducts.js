import React, { useState, useEffect, useRef } from 'react';
import { ref, get, set, remove, push } from "firebase/database";
import { database } from '../Auth/firebase';
import '../CSS/admin.css';
import * as XLSX from 'xlsx';
import { IconRefresh, IconArchive, IconBarChart, IconSave, IconPlus, IconX, IconCheck, IconAlertTriangle, IconPackage, IconPause, IconEdit, IconTrash, IconArrowUpDown } from '../utils/icons';

const FetchProducts = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newProduct, setNewProduct] = useState({
    id: '',
    name: '',
    productType: '',
    itemCost: '',
    purchasingPrice: '',
    quantity: '',
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isArchivingProducts, setIsArchivingProducts] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [heldProducts, setHeldProducts] = useState([]);
  const [sortBy, setSortBy] = useState({ field: 'name', order: 'asc' });

  const rowRef = useRef(null);

  const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isStockLikeStatus = (status) => String(status || '').toLowerCase().startsWith('stock');

  const writeProductEvent = async (productId, productName, quantity, status) => {
    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await push(ref(database, `stockCheckHistory/${monthKey}`), {
        productId, productName,
        systemQuantity: quantity,
        countedQuantity: quantity,
        status,
        checkedAt: now.toISOString(),
      });
    } catch (err) { console.error('History write failed:', err); }
  };

  const getProfitMetrics = (product, overrides = {}) => {
    const merged = { ...product, ...overrides };
    const quantity = toNumber(merged.quantity);
    const isStockProduct = isStockLikeStatus(merged.paymentStatus);

    const parsedSell = parseFloat(merged.itemCost);
    const hasSell = Number.isFinite(parsedSell);
    const parsedBuy = parseFloat(merged.purchasingPrice);
    const hasBuy = Number.isFinite(parsedBuy);

    const unitSellPrice = hasSell ? parsedSell : 0;
    const unitPurchasePrice = hasBuy ? parsedBuy : 0;
    const totalRevenue = isStockProduct ? 0 : unitSellPrice * quantity;
    const totalPurchaseCost = isStockProduct ? 0 : unitPurchasePrice * quantity;
    const unitProfit = unitSellPrice - unitPurchasePrice;
    const totalProfit = unitProfit * quantity;

    return {
      quantity,
      isStockProduct,
      unitSellPrice,
      unitPurchasePrice,
      revenue: totalRevenue,
      purchaseCost: totalPurchaseCost,
      unitProfit,
      totalProfit,
    };
  };

  // Format date to DD-MM-YYYY
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const fetchProducts = async () => {
    try {
      setIsRefreshing(true);
      const productsRef = ref(database, 'products');
      const snapshot = await get(productsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const productList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        const sortedProducts = sortProducts(productList, sortBy.field, sortBy.order);
        setProducts(sortedProducts);
        setFilteredProducts(sortedProducts);
      } else {
        setProducts([]);
        setFilteredProducts([]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setErrorMessage("Error fetching products. Please try again.");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchHeldProducts = async () => {
    try {
      const heldProductsRef = ref(database, 'heldProducts');
      const snapshot = await get(heldProductsRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const heldProductList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setHeldProducts(heldProductList);
      } else {
        setHeldProducts([]);
      }
    } catch (error) {
      console.error("Error fetching held products:", error);
      setHeldProducts([]);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchHeldProducts();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchTerm, products]);

  useEffect(() => {
    if (products.length) {
      const sorted = sortProducts(products, sortBy.field, sortBy.order);
      setProducts(sorted);
      handleSearch();
    }
  }, [sortBy]);

  const handleRefresh = () => {
    fetchProducts();
    fetchHeldProducts();
    setSuccessMessage("Products refreshed successfully!");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const filtered = products.filter(product => {
      return (
        product.name?.toLowerCase().includes(term) ||
        product.id?.toLowerCase().includes(term) ||
        product.productType?.toLowerCase().includes(term)
      );
    });

    setFilteredProducts(filtered);
  };

  const sanitizeId = (id) => {
    return id.replace(/[.#$/[\]]/g, '_');
  };

  const handleAddProduct = async () => {
    if (!newProduct.id) {
      setErrorMessage("Barcode Number is required!");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const sanitizedId = sanitizeId(newProduct.id);
    const productRef = ref(database, `products/${sanitizedId}`);

    try {
      const snapshot = await get(productRef);
      if (snapshot.exists()) {
        setErrorMessage("Barcode Number already exists. Please use a unique ID.");
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      const parsedItemCost = parseFloat(newProduct.itemCost) || 0;
      const parsedPurchasingPrice = parseFloat(newProduct.purchasingPrice) || 0;
      const parsedQuantity = parseFloat(newProduct.quantity) || 0;

      await set(productRef, {
        name: newProduct.name.trim() || 'Unnamed Product',
        productType: newProduct.productType.trim() || 'General',
        itemCost: parsedItemCost,
        purchasingPrice: parsedPurchasingPrice,
        quantity: parsedQuantity,
        createdAt: new Date().toISOString(),
      });

      const newProductObj = {
        id: sanitizedId,
        name: newProduct.name.trim() || 'Unnamed Product',
        productType: newProduct.productType.trim() || 'General',
        itemCost: parsedItemCost,
        purchasingPrice: parsedPurchasingPrice,
        quantity: parsedQuantity,
      };

      const updatedProducts = [...products, newProductObj];
      const sortedProducts = sortProducts(updatedProducts, sortBy.field, sortBy.order);
      setProducts(sortedProducts);
      setFilteredProducts(sortedProducts);

      setSuccessMessage('Product added successfully!');
      setNewProduct({ id: '', name: '', productType: '', itemCost: '', purchasingPrice: '', quantity: '' });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding product:', error);
      setErrorMessage('Error adding product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleDeleteProduct = async (id) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the product "${id}"?`
    );
    if (!confirmed) return;

    const productRef = ref(database, `products/${id}`);
    try {
      await remove(productRef);
      const updatedProducts = products.filter((product) => product.id !== id);
      setProducts(updatedProducts);
      setFilteredProducts(updatedProducts);
      setSuccessMessage('Product deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting product:', error);
      setErrorMessage('Error deleting product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleHoldProduct = async (product) => {
    const confirmed = window.confirm(
      `Hold product "${product.name}"?`
    );
    if (!confirmed) return;

    try {
      const heldDate = new Date().toISOString();
      await writeProductEvent(product.id, product.name, toNumber(product.quantity), 'held');

      const cleanedProduct = {
        name: product.name || '',
        productType: product.productType || '',
        itemCost: product.itemCost || 0,
        purchasingPrice: product.purchasingPrice || 0,
        quantity: product.quantity || 0,
        heldDate,
      };

      const heldProductRef = ref(database, `heldProducts/${product.id}`);
      await set(heldProductRef, cleanedProduct);

      const productRef = ref(database, `products/${product.id}`);
      await remove(productRef);

      const updatedProducts = products.filter((p) => p.id !== product.id);
      setProducts(updatedProducts);
      setFilteredProducts(updatedProducts);
      setHeldProducts([...heldProducts, { ...cleanedProduct, id: product.id }]);

      setSuccessMessage('Product held successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error holding product:', error);
      setErrorMessage('Error holding product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleRestoreProduct = async (product) => {
    const confirmed = window.confirm(
      `Restore product "${product.name}"?`
    );
    if (!confirmed) return;

    try {
      await writeProductEvent(product.id, product.name, toNumber(product.quantity), 'restored');

      const cleanedProduct = {
        name: product.name || '',
        productType: product.productType || '',
        itemCost: product.itemCost || 0,
        purchasingPrice: product.purchasingPrice || 0,
        quantity: product.quantity || 0,
        ...(product.createdAt ? { createdAt: product.createdAt } : { createdAt: new Date().toISOString() }),
      };

      const productRef = ref(database, `products/${product.id}`);
      await set(productRef, cleanedProduct);

      const heldProductRef = ref(database, `heldProducts/${product.id}`);
      await remove(heldProductRef);

      const updatedHeldProducts = heldProducts.filter((p) => p.id !== product.id);
      setHeldProducts(updatedHeldProducts);

      const updatedProducts = [...products, { ...cleanedProduct, id: product.id }];
      const sortedProducts = sortProducts(updatedProducts, sortBy.field, sortBy.order);
      setProducts(sortedProducts);
      setFilteredProducts(sortedProducts);

      setSuccessMessage('Product restored successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error restoring product:', error);
      setErrorMessage('Error restoring product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct({ ...product, originalId: product.id });
    setTimeout(() => {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleSaveChanges = async () => {
    if (!editingProduct.id) {
      setErrorMessage("Barcode (ID) cannot be empty.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const oldId = editingProduct.originalId || editingProduct.id;
    const newId = sanitizeId(editingProduct.id);

    const newProductRef = ref(database, `products/${newId}`);
    const oldProductRef = ref(database, `products/${oldId}`);

    try {
      const parsedItemCost = parseFloat(editingProduct.itemCost) || 0;
      const parsedPurchasingPrice = parseFloat(editingProduct.purchasingPrice) || 0;
      const parsedQuantity = parseFloat(editingProduct.quantity) || 0;

      if (oldId !== newId) {
        await remove(oldProductRef);
      }

      const existingSnap = await get(newProductRef);
      const existingData = existingSnap.exists() ? existingSnap.val() : {};

      await set(newProductRef, {
        name: editingProduct.name.trim() || 'Unnamed Product',
        productType: editingProduct.productType.trim() || 'General',
        itemCost: parsedItemCost,
        purchasingPrice: parsedPurchasingPrice,
        quantity: parsedQuantity,
        ...(editingProduct.createdAt ? { createdAt: editingProduct.createdAt } : existingData.createdAt ? { createdAt: existingData.createdAt } : {}),
      });

      const updatedProducts = products.map((product) =>
        product.id === oldId
          ? {
              ...editingProduct,
              id: newId,
              itemCost: parsedItemCost,
              purchasingPrice: parsedPurchasingPrice,
              quantity: parsedQuantity
            }
          : product
      );

      const sortedProducts = sortProducts(updatedProducts, sortBy.field, sortBy.order);
      setProducts(sortedProducts);
      setFilteredProducts(sortedProducts);
      setEditingProduct(null);
      setSuccessMessage('Product updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error updating product:', error);
      setErrorMessage('Error updating product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleExportToExcel = () => {
    if (products.length === 0) {
      alert("No products available to export.");
      return;
    }

    const exportRows = products.map((product) => {
      const metrics = getProfitMetrics(product);
      return {
        ...product,
        unitProfit: Number(metrics.unitProfit.toFixed(2)),
        totalProfit: Number(metrics.totalProfit.toFixed(2)),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, `products_${formatDate(new Date())}.xlsx`);
  };

  const handleArchiveAndResetQuantities = async () => {
    if (products.length === 0) {
      setErrorMessage('No products to archive.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const confirmed = window.confirm(
      'Archive all current products and reset all quantities to 0?\n\n' +
      'Products will stay in the list, only quantity will reset.'
    );
    if (!confirmed) return;

    setIsArchivingProducts(true);
    const archivedAt = new Date().toISOString();
    const archiveId = archivedAt.replace(/[.:]/g, '-');

    try {
      const archiveProducts = products.reduce((acc, product) => {
        const qty = parseFloat(product.quantity) || 0;
        acc[product.id] = { ...product, quantity: qty };
        return acc;
      }, {});

      const resetProducts = products.reduce((acc, product) => {
        const { id, ...rest } = product;
        acc[id] = { ...rest, quantity: 0 };
        return acc;
      }, {});

      const totalQtyBeforeReset = products.reduce(
        (sum, product) => sum + (parseFloat(product.quantity) || 0),
        0
      );

      await set(ref(database, `productArchives/${archiveId}`), {
        archivedAt,
        summary: {
          productsArchived: products.length,
          totalQuantityBeforeReset: totalQtyBeforeReset,
        },
        products: archiveProducts,
      });

      await set(ref(database, 'products'), resetProducts);

      const resetList = products.map((product) => ({ ...product, quantity: 0 }));
      const sortedResetList = sortProducts(resetList, sortBy.field, sortBy.order);
      setProducts(sortedResetList);
      setFilteredProducts(sortedResetList);

      setSuccessMessage(`Archived ${products.length} products and reset all quantities to 0.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error archiving products:', error);
      if (error?.code === 'PERMISSION_DENIED') {
        setErrorMessage('Permission denied. Add read/write rules for "productArchives".');
      } else {
        setErrorMessage('Failed to archive and reset products. Please try again.');
      }
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsArchivingProducts(false);
    }
  };

  const sortProducts = (products, field, order) => {
    return [...products].sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (field) => {
    setSortBy((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setFilteredProducts(products);
  };

  const getSortIcon = (field) => {
    if (sortBy.field !== field) return <IconArrowUpDown />;
    return sortBy.order === 'asc' ? '↑' : '↓';
  };

  const filteredProductsProfitTotal = filteredProducts.reduce(
    (sum, product) => sum + getProfitMetrics(product).totalProfit,
    0
  );

  const heldProductsProfitTotal = heldProducts.reduce(
    (sum, product) => sum + getProfitMetrics(product).totalProfit,
    0
  );

  const renderProductsTab = () => (
    <div className="products-content">
      {/* Header Section */}
      <div className="header-section">
        <div className="header-left">
          <h2 className="section-title">Product Management</h2>
          <div className="stats-badge">
            {filteredProducts.length} Products
          </div>
        </div>
        <div className="header-right">
          <button
            onClick={handleArchiveAndResetQuantities}
            className="btn-danger"
            disabled={isRefreshing || isArchivingProducts || products.length === 0}
            title="Archive all products and reset all quantities to 0 while keeping products"
          >
            <IconArchive /> {isArchivingProducts ? 'Archiving...' : 'Archive & Reset Qty'}
          </button>
          <button 
            onClick={handleRefresh} 
            className={`btn-secondary ${isRefreshing ? 'refreshing' : ''}`}
            disabled={isRefreshing}
          >
            <IconRefresh /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={handleExportToExcel} className="btn-primary">
            <IconBarChart /> Export Excel
          </button>
        </div>
      </div>

      {/* Add/Edit Product Form */}
      <div className="form-section">
        <div className="form-card">
          <div className="form-header">
            <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
            {editingProduct && (
              <button 
                onClick={() => setEditingProduct(null)}
                className="btn-secondary btn-small"
              >
                Cancel Edit
              </button>
            )}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Barcode Number *</label>
              <input
                type="text"
                placeholder="Enter barcode"
                value={editingProduct ? editingProduct.id : newProduct.id}
                disabled={!!editingProduct}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, id: e.target.value })
                    : setNewProduct({ ...newProduct, id: e.target.value })
                }
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Product Name</label>
              <input
                type="text"
                placeholder="Enter product name"
                value={editingProduct ? editingProduct.name : newProduct.name}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, name: e.target.value })
                    : setNewProduct({ ...newProduct, name: e.target.value })
                }
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Product Type</label>
              <input
                type="text"
                placeholder="e.g., Oil, Filter"
                value={editingProduct ? editingProduct.productType : newProduct.productType}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, productType: e.target.value })
                    : setNewProduct({ ...newProduct, productType: e.target.value })
                }
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                placeholder="Enter quantity"
                value={editingProduct ? editingProduct.quantity : newProduct.quantity}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, quantity: e.target.value })
                    : setNewProduct({ ...newProduct, quantity: e.target.value })
                }
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Selling price"
                value={editingProduct ? editingProduct.itemCost : newProduct.itemCost}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, itemCost: e.target.value })
                    : setNewProduct({ ...newProduct, itemCost: e.target.value })
                }
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Purchasing Price ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Purchasing price"
                value={editingProduct ? editingProduct.purchasingPrice : newProduct.purchasingPrice}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, purchasingPrice: e.target.value })
                    : setNewProduct({ ...newProduct, purchasingPrice: e.target.value })
                }
                className="form-input"
              />
            </div>
          </div>

          <div className="form-actions">
            {editingProduct ? (
              <button onClick={handleSaveChanges} className="btn-success">
                <IconSave /> Update Product
              </button>
            ) : (
              <button onClick={handleAddProduct} className="btn-primary">
                <IconPlus /> Add Product
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-card">
          <div className="search-header">
            <h3>Search Products</h3>
            {searchTerm && (
              <span className="search-results">
                Found {filteredProducts.length} product(s)
              </span>
            )}
          </div>
          <div className="search-controls">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search by name, barcode, or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button onClick={handleClearSearch} className="search-clear">
                  <IconX />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="table-section">
        <div className="table-card">
          <div className="table-header">
            <h3>Product List</h3>
            <div className="table-stats">
              Showing {filteredProducts.length} of {products.length} products • Potential Profit: ${filteredProductsProfitTotal.toFixed(2)}
            </div>
          </div>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('id')}
                    className="sortable-header"
                  >
                    <div className="header-content">
                      Barcode
                      <span className="sort-icon">{getSortIcon('id')}</span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    className="sortable-header"
                  >
                    <div className="header-content">
                      Product Name
                      <span className="sort-icon">{getSortIcon('name')}</span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('productType')}
                    className="sortable-header"
                  >
                    <div className="header-content">
                      Type
                      <span className="sort-icon">{getSortIcon('productType')}</span>
                    </div>
                  </th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Selling Price</th>
                  <th className="text-right">Purchasing Price</th>
                  <th className="text-right">Unit Profit</th>
                  <th className="text-right">Total Profit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const metrics = getProfitMetrics(product);
                  return (
                  <tr 
                    key={product.id} 
                    ref={editingProduct?.id === product.id ? rowRef : null}
                    className={editingProduct?.id === product.id ? 'editing-row' : ''}
                  >
                    <td>
                      {editingProduct && editingProduct.id === product.id ? (
                        <input
                          type="text"
                          value={editingProduct.id}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, id: e.target.value })
                          }
                          className="edit-input"
                        />
                      ) : (
                        <span className="barcode-cell">{product.id}</span>
                      )}
                    </td>
                    <td>
                      {editingProduct && editingProduct.id === product.id ? (
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, name: e.target.value })
                          }
                          className="edit-input"
                        />
                      ) : (
                        <span className="product-name-cell">{product.name}</span>
                      )}
                    </td>
                    <td>
                      {editingProduct && editingProduct.id === product.id ? (
                        <input
                          type="text"
                          value={editingProduct.productType}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, productType: e.target.value })
                          }
                          className="edit-input"
                        />
                      ) : (
                        <span className="type-cell">{product.productType}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {editingProduct && editingProduct.id === product.id ? (
                        <input
                          type="number"
                          value={editingProduct.quantity}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, quantity: e.target.value })
                          }
                          className="edit-input"
                        />
                      ) : (
                        <span className="quantity-cell">{product.quantity}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {editingProduct && editingProduct.id === product.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingProduct.itemCost}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, itemCost: e.target.value })
                          }
                          className="edit-input"
                        />
                      ) : (
                        <span className="price-cell">${parseFloat(product.itemCost || 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {editingProduct && editingProduct.id === product.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingProduct.purchasingPrice}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, purchasingPrice: e.target.value })
                          }
                          className="edit-input"
                        />
                      ) : (
                        <span className="price-cell cost">${parseFloat(product.purchasingPrice || 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      <span
                        className="price-cell"
                        style={{ color: metrics.unitProfit >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}
                      >
                        ${metrics.unitProfit.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className="price-cell"
                        style={{ color: metrics.totalProfit >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}
                      >
                        ${metrics.totalProfit.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {editingProduct && editingProduct.id === product.id ? (
                          <>
                            <button onClick={handleSaveChanges} className="btn-small btn-success">
                              Save
                            </button>
                            <button onClick={() => setEditingProduct(null)} className="btn-small btn-secondary">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEditProduct(product)} className="btn-small btn-primary">
                              <IconEdit /> Edit
                            </button>
                            <button onClick={() => handleHoldProduct(product)} className="btn-small btn-warning">
                              <IconPause /> Hold
                            </button>
                            <button onClick={() => handleDeleteProduct(product.id)} className="btn-small btn-danger">
                              <IconTrash /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="empty-table">
              <div className="empty-icon"><IconPackage /></div>
              <p>No products found{searchTerm ? ` for "${searchTerm}"` : ''}</p>
              {searchTerm && (
                <button onClick={handleClearSearch} className="btn-secondary">
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderHoldsTab = () => (
    <div className="holds-content">
      <div className="header-section">
        <div className="header-left">
          <h2 className="section-title">Hold Products</h2>
          <div className="stats-badge">
            {heldProducts.length} Hold
          </div>
          <div className="stats-badge">
            Potential Profit: ${heldProductsProfitTotal.toFixed(2)}
          </div>
        </div>
        <div className="header-right">
          <button 
            onClick={handleRefresh} 
            className={`btn-secondary ${isRefreshing ? 'refreshing' : ''}`}
            disabled={isRefreshing}
          >
            <IconRefresh /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="table-section">
        <div className="table-card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product Name</th>
                  <th>Type</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Selling Price</th>
                  <th className="text-right">Purchasing Price</th>
                  <th className="text-right">Unit Profit</th>
                  <th className="text-right">Total Profit</th>
                  <th>Hold Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {heldProducts.map((product) => {
                  const metrics = getProfitMetrics(product);
                  return (
                  <tr key={product.id}>
                    <td>
                      <span className="barcode-cell">{product.id}</span>
                    </td>
                    <td>
                      <span className="product-name-cell">{product.name}</span>
                    </td>
                    <td>
                      <span className="type-cell">{product.productType}</span>
                    </td>
                    <td className="text-right">
                      <span className="quantity-cell">{product.quantity}</span>
                    </td>
                    <td className="text-right">
                      <span className="price-cell">${parseFloat(product.itemCost || 0).toFixed(2)}</span>
                    </td>
                    <td className="text-right">
                      <span className="price-cell cost">${parseFloat(product.purchasingPrice || 0).toFixed(2)}</span>
                    </td>
                    <td className="text-right">
                      <span
                        className="price-cell"
                        style={{ color: metrics.unitProfit >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}
                      >
                        ${metrics.unitProfit.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className="price-cell"
                        style={{ color: metrics.totalProfit >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}
                      >
                        ${metrics.totalProfit.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className="date-cell">{formatDate(product.heldDate)}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleRestoreProduct(product)}
                        className="btn-small btn-success"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {heldProducts.length === 0 && (
            <div className="empty-table">
              <div className="empty-icon"><IconPause /></div>
              <p>No held products found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Product Management</h1>
        <p className="page-subtitle">Manage your products, inventory, and held items</p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="success-message">
          <span className="message-icon"><IconCheck /></span>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="error-message">
          <span className="message-icon"><IconAlertTriangle /></span>
          {errorMessage}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab('products')}
          className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
        >
          <span className="tab-icon"><IconPackage /></span>
          <span className="tab-label">Products ({products.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('holds')}
          className={`tab-button ${activeTab === 'holds' ? 'active' : ''}`}
        >
          <span className="tab-icon"><IconPause /></span>
          <span className="tab-label">Held ({heldProducts.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'products' ? renderProductsTab() : renderHoldsTab()}
      </div>
    </div>
  );
};

export default FetchProducts;
