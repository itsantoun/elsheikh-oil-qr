import React, { useState, useEffect, useRef } from 'react';
import { ref, get, set, update, remove, push } from "firebase/database";
import { database } from '../Auth/firebase';
import '../CSS/admin.css';
import { IconRefresh, IconBarChart, IconSave, IconPlus, IconX, IconCheck, IconAlertTriangle, IconPackage, IconPause, IconEdit, IconTrash, IconArrowUpDown } from '../utils/icons';
import { useExpiryNotifications } from '../utils/useExpiryNotifications';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { isSamePrice, resolveOrCreateBatchForPrice } from '../utils/productBatches';

const FetchProducts = () => {
  const [confirm, confirmDialog] = useConfirmDialog();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newProduct, setNewProduct] = useState({
    id: '',
    name: '',
    productType: 'Oil',
    itemCost: '',
    purchasingPrice: '',
    quantity: '',
    scope: 'oil',
    unit: '',
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [sortBy, setSortBy] = useState({ field: 'name', order: 'asc' });
  const [scopeFilter, setScopeFilter] = useState('all'); // all | oil | filter | maghsal | other
  const [stockGroup, setStockGroup] = useState('oil-filter'); // 'oil-filter' | 'maghsal'

  useExpiryNotifications({ successMessage, errorMessage });

  // Whether a product belongs to the currently selected stock group.
  const inStockGroup = (p) => {
    const s = normalizeScope(p.scope, p.productType);
    if (stockGroup === 'maghsal') return s === 'maghsal';
    return s !== 'maghsal'; // oil-filter stock contains everything that's not maghsal
  };

  // Switching stock groups: reset sub-filter and align the add-form defaults
  // so the user can immediately add a product to the chosen stock.
  useEffect(() => {
    setScopeFilter('all');
    setNewProduct((prev) => {
      if (stockGroup === 'maghsal') {
        return { ...prev, scope: 'maghsal', productType: 'Maghsal' };
      }
      if (prev.scope === 'maghsal') {
        return { ...prev, scope: 'oil', productType: 'Oil' };
      }
      return prev;
    });
    // editingProduct is left untouched on purpose — if the admin is mid-edit,
    // they finish that edit even if they flip the tab.
  }, [stockGroup]);

  const rowRef = useRef(null);

  const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeScope = (scope, productType = '') => {
    const value = String(scope || '').toLowerCase();
    const type = String(productType || '').toLowerCase();
    if (value === 'other') return 'other';
    if (value.startsWith('maghsal') || type === 'maghsal') return 'maghsal';
    if (value === 'filter' || type.includes('filter')) return 'filter';
    if (value === 'oil' || type.includes('oil')) return 'oil';
    return type ? 'other' : 'oil';
  };

  const scopeToProductType = (scope) => {
    if (scope === 'filter') return 'Filter';
    if (scope === 'maghsal') return 'Maghsal';
    if (scope === 'other') return '';
    return 'Oil';
  };

  const resolveProductType = (scope, productType) => {
    const scopeValue = normalizeScope(scope, productType);
    if (scopeValue === 'other') return String(productType || '').trim();
    return scopeToProductType(scopeValue);
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

  const sanitizeCSVCell = (value) => {
    const raw = value == null ? '' : String(value);
    const flattened = raw.replace(/\r?\n/g, ' ');
    return /^[=+\-@]/.test(flattened) ? `'${flattened}` : flattened;
  };

  // One-time migration: Hold used to delete a product from `products/` and
  // move it into a separate `heldProducts/` node. Anything still sitting
  // there from before this changed is otherwise permanently invisible now —
  // bring it back into `products/{id}` (flagged `held: true`) instead.
  const migrateLegacyHeldProducts = async () => {
    try {
      const legacyRef = ref(database, 'heldProducts');
      const snapshot = await get(legacyRef);
      if (!snapshot.exists()) return false;
      const data = snapshot.val();
      const ids = Object.keys(data);
      if (ids.length === 0) return false;
      await Promise.all(ids.map(async (id) => {
        const { heldDate, ...rest } = data[id] || {};
        await set(ref(database, `products/${id}`), { ...rest, held: true, heldDate: heldDate || new Date().toISOString() });
        await remove(ref(database, `heldProducts/${id}`));
      }));
      return true;
    } catch (error) {
      console.error('Error migrating legacy held products:', error);
      return false;
    }
  };

  const fetchProducts = async () => {
    try {
      setIsRefreshing(true);
      await migrateLegacyHeldProducts();
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

  // Held products are just products with `held: true` — not a separate
  // Firebase collection — so they're never actually deleted, only flagged
  // out of the active list. Only the Delete button removes a product.
  const heldProducts = products.filter((p) => p.held);
  const activeProducts = products.filter((p) => !p.held);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, products, scopeFilter, stockGroup]);

  useEffect(() => {
    if (products.length) {
      const sorted = sortProducts(products, sortBy.field, sortBy.order);
      setProducts(sorted);
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  const handleRefresh = () => {
    fetchProducts();
    setSuccessMessage("Products refreshed successfully!");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSearch = () => {
    const term = searchTerm.toLowerCase().trim();
    // Top-level: only active (non-held) items from the current stock group.
    let result = activeProducts.filter(inStockGroup);

    // Within oil-filter, the sub-tab can drill down to Oil / Filter / Other.
    if (scopeFilter !== 'all') {
      result = result.filter((p) => normalizeScope(p.scope, p.productType) === scopeFilter);
    }

    if (term) {
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(term) ||
        p.id?.toLowerCase().includes(term) ||
        p.productType?.toLowerCase().includes(term) ||
        p.unit?.toLowerCase().includes(term)
      );
    }

    setFilteredProducts(result);
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

      const scopeValue = normalizeScope(newProduct.scope, newProduct.productType);
      const productTypeValue = resolveProductType(newProduct.scope, newProduct.productType);
      if (scopeValue === 'other' && !productTypeValue) {
        setErrorMessage('Custom type is required when Type is Other.');
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }
      await set(productRef, {
        name: newProduct.name.trim() || 'Unnamed Product',
        productType: productTypeValue,
        itemCost: parsedItemCost,
        purchasingPrice: parsedPurchasingPrice,
        quantity: parsedQuantity,
        scope: scopeValue,
        unit: (newProduct.unit || '').trim(),
        createdAt: new Date().toISOString(),
      });

      const newProductObj = {
        id: sanitizedId,
        name: newProduct.name.trim() || 'Unnamed Product',
        productType: productTypeValue,
        itemCost: parsedItemCost,
        purchasingPrice: parsedPurchasingPrice,
        quantity: parsedQuantity,
        scope: scopeValue,
        unit: (newProduct.unit || '').trim(),
      };

      const updatedProducts = [...products, newProductObj];
      const sortedProducts = sortProducts(updatedProducts, sortBy.field, sortBy.order);
      setProducts(sortedProducts);
      setFilteredProducts(sortedProducts);

      setSuccessMessage('Product added successfully!');
      setNewProduct({ id: '', name: '', productType: productTypeValue, itemCost: '', purchasingPrice: '', quantity: '', scope: scopeValue, unit: '' });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding product:', error);
      setErrorMessage('Error adding product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleDeleteProduct = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Product?',
      message: `Are you sure you want to delete the product "${id}"?`,
    });
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
    const confirmed = await confirm({
      title: 'Hold Product?',
      message: `Hold product "${product.name}"?`,
      confirmLabel: 'Yes, Hold',
      danger: false,
    });
    if (!confirmed) return;

    try {
      const heldDate = new Date().toISOString();
      await writeProductEvent(product.id, product.name, toNumber(product.quantity), 'held');

      // Flag it as held rather than deleting it — the product record stays
      // in `products/` untouched; only the Delete button removes a product.
      const productRef = ref(database, `products/${product.id}`);
      await update(productRef, { held: true, heldDate });

      const updatedProducts = products.map((p) => (p.id === product.id ? { ...p, held: true, heldDate } : p));
      setProducts(updatedProducts);

      setSuccessMessage('Product held successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error holding product:', error);
      setErrorMessage('Error holding product. Please try again.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleRestoreProduct = async (product) => {
    const confirmed = await confirm({
      title: 'Restore Product?',
      message: `Restore product "${product.name}"?`,
      confirmLabel: 'Yes, Restore',
      danger: false,
    });
    if (!confirmed) return;

    try {
      await writeProductEvent(product.id, product.name, toNumber(product.quantity), 'restored');

      const productRef = ref(database, `products/${product.id}`);
      await update(productRef, { held: false, heldDate: null });

      const updatedProducts = products.map((p) => (p.id === product.id ? { ...p, held: false, heldDate: null } : p));
      setProducts(sortProducts(updatedProducts, sortBy.field, sortBy.order));

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
      const scopeValue = normalizeScope(editingProduct.scope, editingProduct.productType);
      const productTypeValue = resolveProductType(editingProduct.scope, editingProduct.productType);
      if (scopeValue === 'other' && !productTypeValue) {
        setErrorMessage('Custom type is required when Type is Other.');
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      // A price change never overwrites the existing batch in place — the
      // remaining old-priced stock stays where it is, and a new linked batch
      // is created (or reused) at the new price, starting at quantity 0.
      const priceChanged = oldId === newId && existingSnap.exists() && (
        !isSamePrice(existingData.itemCost, parsedItemCost) ||
        !isSamePrice(existingData.purchasingPrice, parsedPurchasingPrice)
      );

      if (priceChanged) {
        const rootId = existingData.baseProductId || oldId;
        await set(newProductRef, {
          ...existingData,
          name: editingProduct.name.trim() || 'Unnamed Product',
          productType: productTypeValue,
          scope: scopeValue,
          unit: (editingProduct.unit || '').trim(),
          ...(scopeValue !== 'maghsal' ? { barcode: existingData.barcode || oldId } : {}),
        });

        const { id: newBatchId } = await resolveOrCreateBatchForPrice(
          database,
          products,
          rootId,
          { itemCost: parsedItemCost, purchasingPrice: parsedPurchasingPrice },
        );

        const updatedProducts = products.map((product) =>
          product.id === oldId
            ? { ...product, name: editingProduct.name.trim() || 'Unnamed Product', productType: productTypeValue, scope: scopeValue, unit: (editingProduct.unit || '').trim() }
            : product
        );
        updatedProducts.push({
          id: newBatchId,
          name: editingProduct.name.trim() || 'Unnamed Product',
          productType: productTypeValue,
          scope: scopeValue,
          unit: (editingProduct.unit || '').trim(),
          baseProductId: rootId,
          itemCost: parsedItemCost,
          purchasingPrice: parsedPurchasingPrice,
          quantity: 0,
        });

        const sortedProducts = sortProducts(updatedProducts, sortBy.field, sortBy.order);
        setProducts(sortedProducts);
        setFilteredProducts(sortedProducts);
        setEditingProduct(null);
        setSuccessMessage('Price changed — a new batch was created at the new price; existing stock kept its original price.');
        setTimeout(() => setSuccessMessage(null), 4000);
        return;
      }

      await set(newProductRef, {
        name: editingProduct.name.trim() || 'Unnamed Product',
        productType: productTypeValue,
        itemCost: parsedItemCost,
        purchasingPrice: parsedPurchasingPrice,
        quantity: parsedQuantity,
        scope: scopeValue,
        unit: (editingProduct.unit || '').trim(),
        ...(editingProduct.baseProductId ? { baseProductId: editingProduct.baseProductId } : {}),
        ...(existingData.barcode ? { barcode: existingData.barcode } : {}),
        ...(editingProduct.createdAt ? { createdAt: editingProduct.createdAt } : existingData.createdAt ? { createdAt: existingData.createdAt } : {}),
      });

      const updatedProducts = products.map((product) =>
        product.id === oldId
          ? {
              ...editingProduct,
              id: newId,
              itemCost: parsedItemCost,
              purchasingPrice: parsedPurchasingPrice,
              quantity: parsedQuantity,
              productType: productTypeValue,
              scope: scopeValue,
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
      setErrorMessage("No products available to export.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const headers = [
      'Barcode',
      'Product Name',
      'Type',
      'Selling Price',
      'Purchasing Price',
      'Quantity',
      'Unit Profit',
      'Total Profit',
    ];

    const rows = products.map((product) => {
      const metrics = getProfitMetrics(product);
      return [
        product.id,
        product.name || '',
        product.productType || '',
        Number(metrics.unitSellPrice.toFixed(2)),
        Number(metrics.unitPurchasePrice.toFixed(2)),
        Number(metrics.quantity.toFixed(2)),
        Number(metrics.unitProfit.toFixed(2)),
        Number(metrics.totalProfit.toFixed(2)),
      ];
    });

    const csvContent =
      "\ufeff" +
      [headers, ...rows]
        .map((row) => row.map((cell) => {
          const safeCell = sanitizeCSVCell(cell).replace(/"/g, '""');
          return `"${safeCell}"`;
        }).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `products_${formatDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    const base = products.filter(inStockGroup);
    const scopedProducts = scopeFilter === 'all'
      ? base
      : base.filter((product) => normalizeScope(product.scope, product.productType) === scopeFilter);
    setFilteredProducts(scopedProducts);
  };

  const getSortIcon = (field) => {
    if (sortBy.field !== field) return <IconArrowUpDown />;
    return sortBy.order === 'asc' ? '↑' : '↓';
  };

  const filteredProductsProfitTotal = filteredProducts.reduce(
    (sum, product) => sum + getProfitMetrics(product).totalProfit,
    0
  );

  const filteredProductsStockTotal = filteredProducts.reduce(
    (sum, product) => sum + toNumber(product.quantity),
    0
  );

  const filteredProductsValueTotal = filteredProducts.reduce(
    (sum, product) => sum + getProfitMetrics(product).purchaseCost,
    0
  );

  const filteredProductsSellTotal = filteredProducts.reduce(
    (sum, product) => sum + getProfitMetrics(product).revenue,
    0
  );

  const heldProductsProfitTotal = heldProducts.reduce(
    (sum, product) => sum + getProfitMetrics(product).totalProfit,
    0
  );

  const renderProductsTab = () => (
    <div className="products-content inventory-page">
      {/* Header Section */}
      <div className="page-shell-header inventory-page-header">
        <div className="page-shell-header-left">
          <h2 className="page-shell-header-title">Products</h2>
          <p className="page-shell-header-subtitle">
            {stockGroup === 'maghsal'
              ? 'Manage Maghsal stock items used or sold during services.'
              : 'Manage Oil, Filter, and other inventory items.'}
          </p>
        </div>
        <div className="page-shell-header-actions">
          <button
            onClick={handleRefresh}
            className={`btn-secondary ${isRefreshing ? 'refreshing' : ''}`}
            disabled={isRefreshing}
          >
            <IconRefresh /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={handleExportToExcel} className="btn-primary">
            <IconBarChart /> Export CSV
          </button>
        </div>
      </div>

      {/* Stock Group Selector — top-level split between Oil/Filter stock and Maghsal stock */}
      <div className="stock-group-selector">
        <button
          type="button"
          className={`stock-group-button ${stockGroup === 'oil-filter' ? 'active' : ''}`}
          onClick={() => setStockGroup('oil-filter')}
        >
          <IconPackage />
          <span className="stock-group-label">
            <span className="stock-group-title">Oil &amp; Filter Stock</span>
            <span className="stock-group-sub">Oil, Filter, and other items</span>
          </span>
        </button>
        <button
          type="button"
          className={`stock-group-button ${stockGroup === 'maghsal' ? 'active' : ''}`}
          onClick={() => setStockGroup('maghsal')}
        >
          <IconPackage />
          <span className="stock-group-label">
            <span className="stock-group-title">Maghsal Stock</span>
            <span className="stock-group-sub">Items used or sold during services</span>
          </span>
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card highlight">
          <div className="summary-card-content">
            <span className="summary-card-label">Visible Products</span>
            <span className="summary-card-value">{filteredProducts.length}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-content">
            <span className="summary-card-label">Total Quantity</span>
            <span className="summary-card-value">{filteredProductsStockTotal}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-content">
            <span className="summary-card-label">Total Selling Price</span>
            <span className="summary-card-value">${filteredProductsSellTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-content">
            <span className="summary-card-label">Total Purchasing</span>
            <span className="summary-card-value">${filteredProductsValueTotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-content">
            <span className="summary-card-label">Total Profit</span>
            <span
              className="summary-card-value"
              style={{ color: filteredProductsProfitTotal >= 0 ? '#198754' : '#dc3545' }}
            >
              ${filteredProductsProfitTotal.toFixed(2)}
            </span>
          </div>
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
              <label>Type</label>
              <select
                value={editingProduct
                  ? normalizeScope(editingProduct.scope, editingProduct.productType)
                  : normalizeScope(newProduct.scope, newProduct.productType)}
                onChange={(e) => {
                  const scopeValue = e.target.value;
                  const productTypeValue = scopeToProductType(scopeValue);
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, scope: scopeValue, productType: productTypeValue })
                    : setNewProduct({ ...newProduct, scope: scopeValue, productType: productTypeValue });
                }}
                className="form-select"
              >
                <option value="oil">Oil</option>
                <option value="filter">Filter</option>
                <option value="maghsal">Maghsal</option>
                <option value="other">Other</option>
              </select>
            </div>

            {(editingProduct
              ? normalizeScope(editingProduct.scope, editingProduct.productType)
              : normalizeScope(newProduct.scope, newProduct.productType)) === 'other' && (
              <div className="form-group">
                <label>Custom Type</label>
                <input
                  type="text"
                  placeholder="Enter custom product type"
                  value={editingProduct ? editingProduct.productType : newProduct.productType}
                  onChange={(e) =>
                    editingProduct
                      ? setEditingProduct({ ...editingProduct, productType: e.target.value })
                      : setNewProduct({ ...newProduct, productType: e.target.value })
                  }
                  className="form-input"
                />
              </div>
            )}

            <div className="form-group">
              <label>Unit</label>
              <input
                type="text"
                placeholder="e.g., ml, kg, piece"
                value={editingProduct ? (editingProduct.unit || '') : newProduct.unit}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({ ...editingProduct, unit: e.target.value })
                    : setNewProduct({ ...newProduct, unit: e.target.value })
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

      {/* Scope sub-tabs — only shown for the Oil & Filter group; Maghsal has no sub-categories */}
      {stockGroup === 'oil-filter' && (
        <div className="inventory-filter-row">
          <div className="tab-navigation">
            <button
              className={`tab-button ${scopeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setScopeFilter('all')}
            >All</button>
            <button
              className={`tab-button ${scopeFilter === 'oil' ? 'active' : ''}`}
              onClick={() => setScopeFilter('oil')}
            >Oil</button>
            <button
              className={`tab-button ${scopeFilter === 'filter' ? 'active' : ''}`}
              onClick={() => setScopeFilter('filter')}
            >Filter</button>
            <button
              className={`tab-button ${scopeFilter === 'other' ? 'active' : ''}`}
              onClick={() => setScopeFilter('other')}
            >Other</button>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="search-section">
        <div className="search-card">
          <div className="search-header">
            <h3>Find Product</h3>
            {(searchTerm || scopeFilter !== 'all') && (
              <span className="search-results">
                Found {filteredProducts.length} product(s)
              </span>
            )}
          </div>
          <div className="search-controls">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search by name, barcode, type, or unit..."
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
            <h3 className="table-title"><IconPackage /> Product List</h3>
            <div className="table-stats">
              Showing {filteredProducts.length} of {activeProducts.length} products • Potential Profit: ${filteredProductsProfitTotal.toFixed(2)}
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
                        <>
                          <select
                            value={normalizeScope(editingProduct.scope, editingProduct.productType)}
                            onChange={(e) => {
                              const scopeValue = e.target.value;
                              setEditingProduct({
                                ...editingProduct,
                                scope: scopeValue,
                                productType: scopeToProductType(scopeValue),
                              });
                            }}
                            className="edit-input"
                          >
                            <option value="oil">Oil</option>
                            <option value="filter">Filter</option>
                            <option value="maghsal">Maghsal</option>
                            <option value="other">Other</option>
                          </select>
                          {normalizeScope(editingProduct.scope, editingProduct.productType) === 'other' && (
                            <input
                              type="text"
                              value={editingProduct.productType}
                              onChange={(e) => setEditingProduct({ ...editingProduct, productType: e.target.value })}
                              className="edit-input"
                              placeholder="Custom type"
                              style={{ marginTop: 6 }}
                            />
                          )}
                        </>
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
    <div className="holds-content inventory-page">
      <div className="page-shell-header inventory-page-header">
        <div className="page-shell-header-left">
          <h2 className="page-shell-header-title">Hold Products</h2>
          <p className="page-shell-header-subtitle">Review products removed from active inventory and restore them when needed.</p>
        </div>
        <div className="page-shell-header-actions">
          <span className="stats-badge">{heldProducts.length} Hold</span>
          <span className="stats-badge">Potential Profit: ${heldProductsProfitTotal.toFixed(2)}</span>
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
          <div className="table-header">
            <h3 className="table-title"><IconPause /> Hold Product List</h3>
            <div className="table-stats">
              Showing {heldProducts.length} hold products
            </div>
          </div>
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
              <p>No hold products found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-shell inventory-shell">
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
      <div className="inventory-primary-tabs tab-navigation">
        <button
          onClick={() => setActiveTab('products')}
          className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
        >
          <span className="tab-icon"><IconPackage /></span>
          <span className="tab-label">Products ({activeProducts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('holds')}
          className={`tab-button ${activeTab === 'holds' ? 'active' : ''}`}
        >
          <span className="tab-icon"><IconPause /></span>
          <span className="tab-label">Hold ({heldProducts.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'products' ? renderProductsTab() : renderHoldsTab()}
      </div>
      {confirmDialog}
    </div>
  );
};

export default FetchProducts;
