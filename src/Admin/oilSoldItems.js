import React, { useState, useEffect, useContext, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { database } from '../Auth/firebase';
import { ref, get, update, onValue, push } from 'firebase/database';
import { UserContext } from '../Auth/userContext';
import '../CSS/soldItems.css';
import Barcode from 'react-barcode';
import { IconRefresh, IconX, IconPlus, IconEdit, IconTrash } from '../utils/icons';
import { useConfirmDialog } from '../Components/ConfirmDialog';
import { useExpiryNotifications } from '../utils/useExpiryNotifications';
import { saveBlobToExportFolder } from '../utils/exportFolder';
import { findSiblingBatches, pickFifoBatch, getBatchGroupKey, computeBatchRemaining } from '../utils/productBatches';
import {
  addReceiptHeader,
  createReceiptDoc,
  drawTotalsBlock,
  getReceiptDensity,
  money,
  receiptTableOptions,
} from '../utils/pdfReceipt';

// Legacy safety filter: hides any leftover Maghsal-typed rows from Oil/Filter view
// until the Settings → Maghsal Migration is run.
const isLegacyMaghsalItem = (item, productsList) => {
  if (String(item?.paymentStatus || '').toLowerCase() === 'maghsal') return true;
  const product = productsList.find(p => p.id === item.barcode || p.id === item.productId);
  return String(product?.productType || '').toLowerCase() === 'maghsal';
};

const sortByName = (a, b) => {
  const nameA = (a.name || '').trim().toLowerCase();
  const nameB = (b.name || '').trim().toLowerCase();
  if (nameA < nameB) return -1;
  if (nameA > nameB) return 1;
  return 0;
};

// Older records stored the customer's Arabic name in `customerName` (a
// legacy Barcode Scanner convention). Resolve it back to the English name
// for display — trimmed/case-insensitive so stray whitespace doesn't break
// the match — without touching the stored value.
const resolveCustomerName = (rawName, customerList) => {
  const raw = (rawName || '').trim();
  if (!raw) return rawName;
  const match = customerList.find((c) => (c.nameArabic || '').trim().toLowerCase() === raw.toLowerCase());
  return match?.name || rawName;
};

const OilSoldItems = () => {
  const { user } = useContext(UserContext);
  const [soldItems, setSoldItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  
  // Filter states
  const [customerFilter, setCustomerFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [checkFilter, setCheckFilter] = useState('all');
  
  const [customers, setCustomers] = useState([]);
  const customersListRef = React.useRef([]);
  const [products, setProducts] = useState([]);
  // { [productId]: lastReconciledISODate } — from the Stock Checker's "Mark
  // Accurate" action. Movement before this date is already baked into
  // products/{id}.quantity, so batch-remaining math must not subtract it
  // again (same rule remainingProducts.js itself follows).
  const [stockCheckedAtByProductId, setStockCheckedAtByProductId] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);

  const [editingItem, setEditingItem] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [newSellPrice, setNewSellPrice] = useState('');
  const [newPurchasingPrice, setNewPurchasingPrice] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newProductType, setNewProductType] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  const [confirm, confirmDialog] = useConfirmDialog();

  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem('checkedSoldItems');
    return saved ? JSON.parse(saved) : [];
  });

  // Bulk payment-status selection — distinct from the reconciliation
  // "Check" column above. Persisted so a page refresh doesn't silently drop
  // what was checked (same pattern as Water Filling/Maghsal).
  const [selectedIds, setSelectedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('soldItemsSelectedIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [soldItemsLoaded, setSoldItemsLoaded] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('soldItemsSelectedIds', JSON.stringify(selectedIds));
    } catch { /* ignore storage errors (private mode, quota, etc.) */ }
  }, [selectedIds]);

  // Drop any selected ids that were actually deleted from Firebase. Skipped
  // until items have loaded at least once, so a page refresh doesn't wipe a
  // restored (localStorage) selection against a still-empty list.
  useEffect(() => {
    if (!soldItemsLoaded) return;
    setSelectedIds((prev) => prev.filter((id) => soldItems.some((i) => i.id === id)));
  }, [soldItems, soldItemsLoaded]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedIds.includes(i.id));
  const toggleSelectAll = () => {
    setSelectedIds(allFilteredSelected ? [] : filteredItems.map((i) => i.id));
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkPaymentStatus = async (status) => {
    if (selectedIds.length === 0 || isBulkUpdating) return;
    setIsBulkUpdating(true);
    try {
      const updates = {};
      selectedIds.forEach((id) => {
        updates[`SoldItems/${id}/paymentStatus`] = status;
      });
      await update(ref(database), updates);
      setSelectedIds([]);
    } catch (err) {
      console.error('Bulk payment status update failed:', err);
      setErrorMessage(`Failed to update items: ${err?.message || err}`);
    } finally {
      setIsBulkUpdating(false);
    }
  };


  const [showMissingItemsModal, setShowMissingItemsModal] = useState(false);
  // The product dropdown picks a logical product (group); when that product
  // has more than one price-batch, missingItemBatchId lets the user override
  // which one to use — '' means "use the default (oldest-priced) batch".
  const [missingItemGroupId, setMissingItemGroupId] = useState('');
  const [missingItemBatchId, setMissingItemBatchId] = useState('');
  const [missingItemCustomerId, setMissingItemCustomerId] = useState('');
  const [missingItemDate, setMissingItemDate] = useState('');
  const [missingItemQuantity, setMissingItemQuantity] = useState('1');
  const [missingItemPaymentStatus, setMissingItemPaymentStatus] = useState('Unpaid');
  // Editable restock prices — only used/shown when Payment Status is 'Stock',
  // seeded from the selected product but overridable so a restock at a new
  // price can be logged accurately (mirrors maghsal.js's stock-in form).
  const [missingItemPurchasingPrice, setMissingItemPurchasingPrice] = useState('');
  const [missingItemSellPrice, setMissingItemSellPrice] = useState('');
  const [missingItemRemark, setMissingItemRemark] = useState('');
  const [isSavingMissingItem, setIsSavingMissingItem] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  useExpiryNotifications({ errorMessage });
  
  // Format date to DD-MM-YYYY
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Format date to YYYY-MM-DD for input fields
  const formatDateForInput = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date for input:', error);
      return '';
    }
  };

  // Format date and time for display (in one line)
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting date and time:', error);
      return 'Invalid Date';
    }
  };

  // Format date and time for CSV export
  const formatDateTimeForCSV = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting date for CSV:', error);
      return 'Invalid Date';
    }
  };

  // Sort items by date
  const sortItemsByDate = (items, order = 'asc') => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.dateScanned);
      const dateB = new Date(b.dateScanned);
      return order === 'asc' ? dateA - dateB : dateB - dateA;
    });
  };

  const formatCurrency = (value) =>
    value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const sanitizeCSVCell = (value) => {
    const raw = value == null ? '' : String(value);
    const flattened = raw.replace(/\r?\n/g, ' ');
    return /^[=+\-@]/.test(flattened) ? `'${flattened}` : flattened;
  };

  const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isStockLikeStatus = (status) => String(status || '').toLowerCase().startsWith('stock');

  // Sold items don't carry their own Oil/Filter type — look it up from the
  // linked product so the table can show it.
  const getItemProductType = (item) => {
    const linkedProduct = products.find((product) => (
      product.id === item.barcode || product.id === item.productId || product.id === item.id
    ));
    return linkedProduct?.productType || item.category || '—';
  };

  const getItemProfitMetrics = (item, overrides = {}) => {
    const merged = { ...item, ...overrides };
    const quantity = toNumber(merged.quantity);

    const linkedProduct = products.find((product) => (
      product.id === merged.barcode || product.id === merged.productId || product.id === merged.id
    ));

    const parsedItemCost = parseFloat(merged.itemCost);
    const hasItemCost = Number.isFinite(parsedItemCost);
    const parsedTotalCost = parseFloat(merged.totalCost);
    const hasTotalCost = Number.isFinite(parsedTotalCost);
    const parsedPurchase = parseFloat(merged.purchasingPrice);
    const hasPurchase = Number.isFinite(parsedPurchase);

    const unitSellPrice = hasItemCost
      ? parsedItemCost
      : (quantity > 0 ? (hasTotalCost ? parsedTotalCost / quantity : 0) : 0);
    const unitPurchasePrice = hasPurchase ? parsedPurchase : toNumber(linkedProduct?.purchasingPrice);

    const revenue = hasTotalCost ? parsedTotalCost : unitSellPrice * quantity;
    const purchaseCost = unitPurchasePrice * quantity;
    const profit = unitSellPrice - unitPurchasePrice;
    const totalProfitAmount = profit * quantity;

    return {
      quantity,
      revenue,
      purchaseCost,
      profit,
      totalProfitAmount,
      unitSellPrice,
      unitPurchasePrice,
    };
  };

  const calculateTotals = (items) => {
    if (!items.length) {
      return {
        totalQuantity: 0,
        totalCost: 0,
        totalItems: 0,
        totalPurchaseCost: 0,
        totalProfit: 0,
      };
    }

    return items.reduce(
      (acc, item) => {
        const metrics = getItemProfitMetrics(item);
        return {
          totalQuantity: acc.totalQuantity + metrics.quantity,
          totalCost: acc.totalCost + metrics.revenue,
          totalItems: acc.totalItems + 1,
          totalPurchaseCost: acc.totalPurchaseCost + metrics.purchaseCost,
          totalProfit: acc.totalProfit + metrics.totalProfitAmount,
        };
      },
      { totalQuantity: 0, totalCost: 0, totalItems: 0, totalPurchaseCost: 0, totalProfit: 0 }
    );
  };

  // Fetch data
  useEffect(() => {
    const customersRef = ref(database, 'customers');
    const soldItemsRef = ref(database, 'SoldItems');
    const productsRef = ref(database, 'products');

    const unsubscribeCustomers = onValue(customersRef, (customersSnapshot) => {
      let customerList = [];
      if (customersSnapshot.exists()) {
        const customersData = customersSnapshot.val();
        customerList = Object.keys(customersData).map((key) => ({
          id: key,
          name: customersData[key].name,
          nameArabic: customersData[key].nameArabic,
        }));
        customerList.sort((a, b) => sortByName(a, b));
      }
      customersListRef.current = customerList;
      setCustomers(customerList);
    });

    // Live listener (not a one-time get()) so items scanned via Barcode
    // Scanner appear immediately instead of only after a manual refresh.
    const unsubscribeSoldItems = onValue(soldItemsRef, (soldItemsSnapshot) => {
      if (soldItemsSnapshot.exists()) {
        const soldData = soldItemsSnapshot.val();
        const soldItemList = Object.keys(soldData)
          .map((key) => ({
            id: key,
            ...soldData[key],
            customerName: resolveCustomerName(soldData[key].customerName, customersListRef.current),
          }))
          .filter(item => !isStockLikeStatus(item.paymentStatus));
        const sortedItems = sortItemsByDate(soldItemList);
        setSoldItems(sortedItems);
        setFilteredItems(sortedItems);
      } else {
        setSoldItems([]);
        setFilteredItems([]);
      }
      setSoldItemsLoaded(true);
    });

    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsData = snapshot.val();
        const productList = Object.keys(productsData).map((key) => ({
          id: key,
          barcode: key,
          ...productsData[key],
        }));
        productList.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(productList);
      }
    });

    const stockChecksRef = ref(database, 'stockChecks');
    const unsubscribeStockChecks = onValue(stockChecksRef, (snapshot) => {
      if (!snapshot.exists()) { setStockCheckedAtByProductId({}); return; }
      const data = snapshot.val();
      const map = {};
      Object.keys(data).forEach((id) => {
        const ts = data[id]?.reconfirmedAt || data[id]?.checkedAt;
        if (ts) map[id] = ts;
      });
      setStockCheckedAtByProductId(map);
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeSoldItems();
      unsubscribeProducts();
      unsubscribeStockChecks();
    };
  }, []);

  // Apply filters
  useEffect(() => {
    // Oil/Filter only — hide any legacy Maghsal rows until migration is run.
    let filtered = soldItems.filter(item => !isLegacyMaghsalItem(item, products));

    if (customerFilter) {
      filtered = filtered.filter((item) =>
        item.customerName?.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }

    if (productFilter) {
      filtered = filtered.filter((item) => item.name === productFilter);
    }

    if (dateFromFilter || dateToFilter) {
      const fromMs = dateFromFilter
        ? new Date(`${dateFromFilter}T00:00:00`).getTime()
        : null;
      const toMs = dateToFilter
        ? new Date(`${dateToFilter}T23:59:59.999`).getTime()
        : null;

      filtered = filtered.filter((item) => {
        const itemMs = new Date(item.dateScanned).getTime();
        if (isNaN(itemMs)) return false;
        if (fromMs !== null && itemMs < fromMs) return false;
        if (toMs !== null && itemMs > toMs) return false;
        return true;
      });
    }

    if (monthFilter) {
      filtered = filtered.filter(
        (item) =>
          new Date(item.dateScanned).getMonth() + 1 === parseInt(monthFilter, 10)
      );
    }

    if (paymentStatusFilter !== 'All') {
      filtered = filtered.filter((item) => item.paymentStatus === paymentStatusFilter);
    }

    if (checkFilter === 'checked') {
      filtered = filtered.filter((item) => checkedItems.includes(item.id));
    } else if (checkFilter === 'unchecked') {
      filtered = filtered.filter((item) => !checkedItems.includes(item.id));
    }

    const sortedFiltered = sortItemsByDate(filtered);
    setFilteredItems(sortedFiltered);
  }, [
    customerFilter,
    productFilter,
    dateFromFilter,
    dateToFilter,
    monthFilter,
    paymentStatusFilter,
    checkFilter,
    checkedItems,
    soldItems,
    products,
  ]);

  // Clear all filters
  const clearAllFilters = () => {
    setCustomerFilter('');
    setProductFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setMonthFilter('');
    setPaymentStatusFilter('All');
    setCheckFilter('all');
  };

  // Format month filter display
  const formatMonthDisplay = (monthNumber) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[monthNumber - 1] || '';
  };

  // Checkbox functions - THESE ARE STILL HERE
  const handleCheckboxChange = (itemId) => {
    setCheckedItems(prev => {
      const newCheckedItems = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      localStorage.setItem('checkedSoldItems', JSON.stringify(newCheckedItems));
      return newCheckedItems;
    });
  };

  const clearAllChecks = () => {
    localStorage.removeItem('checkedSoldItems');
    setCheckedItems([]);
  };

  // Edit functions
  const handleEdit = (item) => {
    if (!item || !item.id) return;
    const metrics = getItemProfitMetrics(item);
    setEditingItem(item);
    setNewRemark(item.remark || '');
    setNewSellPrice(metrics.unitSellPrice);
    setNewPurchasingPrice(metrics.unitPurchasePrice);
    setNewPaymentStatus(item.paymentStatus || 'Paid');
    setNewCustomer(item.customerName || '');
    setNewProductType(item.name || '');
    setNewQuantity(item.quantity || 0);
    // Convert date to YYYY-MM-DDTHH:mm format for datetime-local input
    const dateObj = new Date(item.dateScanned);
    const formattedDate = dateObj.toISOString().slice(0, 16);
    setNewDate(formattedDate);
  };

  const saveEditedItem = async () => {
    if (!editingItem) return;
    
    // Convert date from local format to ISO string
    const dateToSave = newDate ? new Date(newDate).toISOString() : new Date().toISOString();
    const parsedQuantity = toNumber(newQuantity);
    const unitSellPrice = toNumber(newSellPrice);
    const unitPurchasingPrice = toNumber(newPurchasingPrice);
    const stockLike = isStockLikeStatus(newPaymentStatus);
    const computedTotalCost = stockLike
      ? 0
      : unitSellPrice * parsedQuantity;
    const profitMetrics = getItemProfitMetrics(editingItem, {
      quantity: parsedQuantity,
      totalCost: computedTotalCost,
      paymentStatus: newPaymentStatus,
      itemCost: unitSellPrice,
      purchasingPrice: unitPurchasingPrice,
    });
    
    const itemRef = ref(database, `SoldItems/${editingItem.id}`);
    try {
      await update(itemRef, {
        remark: newRemark,
        totalCost: computedTotalCost,
        itemCost: unitSellPrice,
        paymentStatus: newPaymentStatus,
        customerName: newCustomer,
        name: newProductType,
        quantity: parsedQuantity,
        dateScanned: dateToSave,
        purchasingPrice: unitPurchasingPrice,
        unitProfit: profitMetrics.profit,
        totalProfit: profitMetrics.totalProfitAmount,
      });
      
      const updatedItems = soldItems.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              remark: newRemark,
              totalCost: computedTotalCost,
              itemCost: unitSellPrice,
              paymentStatus: newPaymentStatus,
              customerName: newCustomer,
              name: newProductType,
              quantity: parsedQuantity,
              dateScanned: dateToSave,
              purchasingPrice: unitPurchasingPrice,
              unitProfit: profitMetrics.profit,
              totalProfit: profitMetrics.totalProfitAmount,
            }
          : item
      );
      
      const sortedItems = sortItemsByDate(updatedItems);
      setSoldItems(sortedItems);
      setFilteredItems(sortedItems);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      setErrorMessage('Failed to update item.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Delete functions
  const handleDelete = async (itemId) => {
    try {
      const updates = {
        [`SoldItems/${itemId}`]: null,
      };

      await update(ref(database), updates);
      setSoldItems(prev => prev.filter((item) => item.id !== itemId));
      setFilteredItems(prev => prev.filter((item) => item.id !== itemId));
      setCheckedItems((prev) => {
        const nextCheckedItems = prev.filter((id) => id !== itemId);
        localStorage.setItem('checkedSoldItems', JSON.stringify(nextCheckedItems));
        return nextCheckedItems;
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      setErrorMessage('Failed to delete item.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleDeleteConfirmation = async (itemId) => {
    const item = soldItems.find((i) => i.id === itemId);
    const dateLabel = item ? formatDateTime(item.dateScanned) : 'N/A';
    const confirmed = await confirm({
      title: 'Delete Sold Item?',
      message: `Are you sure you want to delete this item (date: ${dateLabel})? This action cannot be undone.`,
    });
    if (!confirmed) return;
    handleDelete(itemId);
  };

  // Refresh data from database
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const customersRef = ref(database, 'customers');
      const soldItemsRef = ref(database, 'SoldItems');
      const productsRef = ref(database, 'products');

      // Fetch all data in parallel
      const [customersSnapshot, soldItemsSnapshot, productsSnapshot] = await Promise.all([
        get(customersRef),
        get(soldItemsRef),
        get(productsRef)
      ]);

      // Update customers
      let customerList = [];
      if (customersSnapshot.exists()) {
        const customersData = customersSnapshot.val();
        customerList = Object.keys(customersData).map((key) => ({
          id: key,
          name: customersData[key].name,
          nameArabic: customersData[key].nameArabic,
        }));
        customerList.sort((a, b) => sortByName(a, b));
      }
      setCustomers(customerList);

      // Update sold items
      if (soldItemsSnapshot.exists()) {
        const soldData = soldItemsSnapshot.val();
        const soldItemList = Object.keys(soldData)
          .map((key) => ({
            id: key,
            ...soldData[key],
            customerName: resolveCustomerName(soldData[key].customerName, customerList),
          }))
          .filter(item => !isStockLikeStatus(item.paymentStatus));
        const sortedItems = sortItemsByDate(soldItemList);
        setSoldItems(sortedItems);
        setFilteredItems(sortedItems);
      } else {
        setSoldItems([]);
        setFilteredItems([]);
      }

      // Update products
      if (productsSnapshot.exists()) {
        const productsData = productsSnapshot.val();
        const productList = Object.keys(productsData).map((key) => ({
          id: key,
          barcode: key,
          ...productsData[key],
        }));
        productList.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(productList);
      }

      setErrorMessage(null);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setErrorMessage('Failed to refresh data.');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Build "<client>_<dateOrRange>" filename slug from active filters.
  const buildExportFilename = (extension) => {
    const sanitize = (s) =>
      String(s || '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 80);

    const clientPart = sanitize(customerFilter) || 'all_clients';

    let datePart;
    if (dateFromFilter && dateToFilter) {
      datePart = dateFromFilter === dateToFilter
        ? getDateDisplay(dateFromFilter)
        : `${getDateDisplay(dateFromFilter)}_to_${getDateDisplay(dateToFilter)}`;
    } else if (dateFromFilter) {
      datePart = `from_${getDateDisplay(dateFromFilter)}`;
    } else if (dateToFilter) {
      datePart = `to_${getDateDisplay(dateToFilter)}`;
    } else {
      datePart = formatDate(new Date());
    }

    return `${clientPart}_${datePart}.${extension}`;
  };

  // Export to PDF (client view)
  const exportToCSVClient = async () => {
    if (filteredItems.length === 0) {
      setErrorMessage("No data to export.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    let paidTotal = 0;
    let unpaidTotal = 0;
    const rows = filteredItems.map((item) => {
      const metrics = getItemProfitMetrics(item);
      const lineTotal = metrics.revenue;
      if (item.paymentStatus === 'Paid') paidTotal += lineTotal;
      else if (item.paymentStatus === 'Unpaid') unpaidTotal += lineTotal;
      return [
        formatDate(item.dateScanned),
        item.name || "N/A",
        metrics.quantity,
        money(metrics.unitSellPrice),
        money(lineTotal),
        item.paymentStatus || "N/A",
      ];
    });

    const doc = createReceiptDoc(jsPDF);
    const density = getReceiptDensity(rows.length);
    const fromLabel = dateFromFilter ? getDateDisplay(dateFromFilter) : formatDate(filteredItems[0]?.dateScanned);
    const toLabel = dateToFilter ? getDateDisplay(dateToFilter) : formatDate(filteredItems[filteredItems.length - 1]?.dateScanned);
    const startY = await addReceiptHeader(doc, {
      title: 'CLIENT RECEIPT',
      subtitle: 'Oil / Filter Statement',
      receiptNo: `OF-${Date.now().toString().slice(-8)}`,
      client: customerFilter || 'All Clients',
      dateRange: `From ${fromLabel} to ${toLabel}`,
    });

    autoTable(doc, {
      ...receiptTableOptions({
        head: ["Date", "Item", "Qty", "Unit Price", "Total", "Status"],
        body: rows,
        startY,
        rightAlignedColumns: [2, 3, 4],
        density,
      }),
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 72 },
        2: { halign: 'right', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 24 },
        5: { cellWidth: 26 },
      },
    });

    drawTotalsBlock(doc, {
      paid: paidTotal,
      unpaid: unpaidTotal,
      grandTotal: paidTotal + unpaidTotal,
      startY: doc.lastAutoTable.finalY + 4,
      compact: density.totalsCompact,
    });

    const filename = buildExportFilename('pdf');
    const pdfBlob = doc.output('blob');
    const result = await saveBlobToExportFolder(pdfBlob, filename);
    if (result.strategy === 'folder') {
      setErrorMessage(`Saved to "${result.folderName}/${filename}"`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Export to CSV
  const exportToCSV = async () => {
    if (filteredItems.length === 0) {
      setErrorMessage("No data to export.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const headers = [
      "Date", "Customer", "Product Type", "Quantity Sold", "Price",
      "Item Cost", "Purchase Price", "Unit Profit", "Total Profit", "Employee", "Remarks", "Total Cost", "Payment Status"
    ];

    const rows = filteredItems.map((item) => {
      const metrics = getItemProfitMetrics(item);
      return [
        formatDateTimeForCSV(item.dateScanned),
        item.customerName || "N/A",
        item.name || "N/A",
        metrics.quantity,
        item.price || "N/A",
        metrics.unitSellPrice.toFixed(2),
        metrics.unitPurchasePrice.toFixed(2),
        metrics.profit.toFixed(2),
        metrics.totalProfitAmount.toFixed(2),
        item.scannedBy || "N/A",
        item.remark || "N/A",
        metrics.revenue.toFixed(2),
        item.paymentStatus || "Paid",
      ];
    });

    const csvContent =
      "\ufeff" +
      [headers, ...rows]
        .map((row) => row.map((cell) => {
          const safeCell = sanitizeCSVCell(cell).replace(/"/g, '""');
          return `"${safeCell}"`;
        }).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const filename = buildExportFilename('csv');
    const result = await saveBlobToExportFolder(blob, filename);
    if (result.strategy === 'folder') {
      setErrorMessage(`Saved to "${result.folderName}/${filename}"`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Format date input value for display in active filters
  const getDateDisplay = (dateValue) => {
    if (!dateValue) return '';
    // Convert YYYY-MM-DD to DD-MM-YYYY for display
    const [year, month, day] = dateValue.split('-');
    return `${day}-${month}-${year}`;
  };

  const getTodayDateForInput = () => formatDateForInput(new Date().toISOString());

  // Unique product names sold so far, for the Product filter dropdown.
  const productFilterOptions = useMemo(() => {
    const names = new Set();
    soldItems.forEach((item) => {
      if (item.name && !isLegacyMaghsalItem(item, products)) names.add(item.name);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [soldItems, products]);

  // Oil/Filter products only (Maghsal items are sold from the Maghsal page).
  const missingItemEligibleProducts = products.filter((p) => {
    const scope = String(p.scope || '').toLowerCase();
    const type = String(p.productType || '').toLowerCase();
    return !scope.includes('maghsal') && !type.includes('maghsal');
  });

  // One entry per logical product (root + its price-duplicate batches
  // collapsed together) for the Product dropdown, quantity summed across
  // siblings so duplicates don't show up as separate-looking rows.
  const missingItemGroups = useMemo(() => {
    const groups = new Map();
    missingItemEligibleProducts.forEach((p) => {
      const key = getBatchGroupKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return [...groups.entries()]
      .map(([groupKey, batches]) => {
        const representative = batches.find((b) => b.id === groupKey) || batches[0];
        const quantity = batches.reduce((sum, b) => sum + computeBatchRemaining(b, { soldItems, checkedAtByProductId: stockCheckedAtByProductId }), 0);
        return { id: groupKey, name: representative.name, barcode: representative.barcode || representative.id, quantity };
      })
      .sort(sortByName);
  }, [missingItemEligibleProducts, soldItems, stockCheckedAtByProductId]);

  // All price-batches of the currently selected product, oldest first.
  const missingItemBatches = useMemo(
    () => (missingItemGroupId ? findSiblingBatches(products, missingItemGroupId) : []),
    [products, missingItemGroupId],
  );

  // Default batch when the user hasn't explicitly picked one: the oldest
  // batch that still has stock.
  const missingItemDefaultBatch = useMemo(
    () => pickFifoBatch(missingItemBatches, { soldItems, checkedAtByProductId: stockCheckedAtByProductId }),
    [missingItemBatches, soldItems, stockCheckedAtByProductId],
  );

  const selectedProduct = (missingItemBatches.find((b) => b.id === missingItemBatchId))
    || missingItemDefaultBatch
    || null;
  const selectedProductRemaining = selectedProduct
    ? computeBatchRemaining(selectedProduct, { soldItems, checkedAtByProductId: stockCheckedAtByProductId })
    : null;

  const resetMissingItemForm = () => {
    setMissingItemGroupId('');
    setMissingItemBatchId('');
    setMissingItemCustomerId('');
    setMissingItemDate(getTodayDateForInput());
    setMissingItemQuantity('1');
    setMissingItemPaymentStatus('Unpaid');
    setMissingItemPurchasingPrice('');
    setMissingItemSellPrice('');
    setMissingItemRemark('');
  };

  const openMissingItemsModal = () => {
    resetMissingItemForm();
    setShowMissingItemsModal(true);
  };

  const closeMissingItemsModal = () => {
    setShowMissingItemsModal(false);
    resetMissingItemForm();
  };

  const convertDateInputToISO = (value) => {
    if (!value) return new Date().toISOString();
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return new Date().toISOString();
    const localDateAtNoon = new Date(year, month - 1, day, 12, 0, 0, 0);
    return localDateAtNoon.toISOString();
  };

  const handleMissingProductChange = (groupId) => {
    setMissingItemGroupId(groupId);
    setMissingItemBatchId('');
    const batches = findSiblingBatches(products, groupId);
    const defaultBatch = pickFifoBatch(batches, { soldItems, checkedAtByProductId: stockCheckedAtByProductId });
    setMissingItemPurchasingPrice(defaultBatch ? String(toNumber(defaultBatch.purchasingPrice)) : '');
    setMissingItemSellPrice(defaultBatch ? String(toNumber(defaultBatch.itemCost)) : '');
  };

  const handleMissingBatchChange = (batchId) => {
    setMissingItemBatchId(batchId);
    const batch = missingItemBatches.find((b) => b.id === batchId);
    setMissingItemPurchasingPrice(batch ? String(toNumber(batch.purchasingPrice)) : '');
    setMissingItemSellPrice(batch ? String(toNumber(batch.itemCost)) : '');
  };

  const saveMissingItem = async () => {
    if (!selectedProduct) {
      setErrorMessage('Please select a product.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const quantityValue = toNumber(missingItemQuantity);
    if (quantityValue <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const paymentStatusValue = missingItemPaymentStatus || 'Unpaid';
    const isStock = isStockLikeStatus(paymentStatusValue);

    // Customer only required for Paid / Unpaid sales — not for stock
    if (!isStock && !missingItemCustomerId) {
      setErrorMessage('Please select a customer.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    const selectedCustomer = !isStock
      ? customers.find((customer) => customer.id === missingItemCustomerId)
      : null;

    if (!isStock && !selectedCustomer) {
      setErrorMessage('Selected customer is no longer available.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsSavingMissingItem(true);

    // Use whatever the admin edited in the price fields — it may differ from
    // the product's currently stored price.
    const sellPriceValue = toNumber(missingItemSellPrice);
    const purchasingPriceValue = isStock ? toNumber(missingItemPurchasingPrice) : toNumber(selectedProduct.purchasingPrice);
    const dateScannedValue = convertDateInputToISO(missingItemDate);
    const scannedByValue = user?.name || user?.displayName || user?.email || 'Unknown';

    try {
      if (isStock) {
        // Stock = new purchase → save to Transactions only
        const transaction = {
          barcode: selectedProduct.barcode || selectedProduct.id,
          productId: selectedProduct.id,
          name: selectedProduct.name || 'Unknown Product',
          quantity: quantityValue,
          dateScanned: dateScannedValue,
          paymentStatus: 'Pending',
          itemCost: sellPriceValue,
          purchasingPrice: purchasingPriceValue,
          totalCost: purchasingPriceValue * quantityValue,
          scannedBy: scannedByValue,
          remark: missingItemRemark,
        };
        await push(ref(database, 'transactions'), transaction);
      } else {
        // Paid / Unpaid → save to SoldItems as usual
        const totalCostValue = sellPriceValue * quantityValue;
        const profitMetrics = getItemProfitMetrics(
          { barcode: selectedProduct.barcode, productId: selectedProduct.id },
          {
            quantity: quantityValue,
            paymentStatus: paymentStatusValue,
            itemCost: sellPriceValue,
            purchasingPrice: purchasingPriceValue,
            totalCost: totalCostValue,
          }
        );
        // Always store the English name — pages across the app display this
        // value directly, and should never show Arabic.
        const customerNameForStorage = selectedCustomer.name || selectedCustomer.nameArabic || 'Unknown';

        const newItem = {
          barcode: selectedProduct.barcode || selectedProduct.id,
          productId: selectedProduct.id,
          name: selectedProduct.name || 'Unknown Product',
          category: selectedProduct.category || 'Unknown',
          price: toNumber(selectedProduct.price),
          dateScanned: dateScannedValue,
          scannedBy: scannedByValue,
          customerName: customerNameForStorage,
          quantity: quantityValue,
          paymentStatus: paymentStatusValue,
          itemCost: sellPriceValue,
          purchasingPrice: purchasingPriceValue,
          totalCost: totalCostValue,
          unitProfit: profitMetrics.profit,
          totalProfit: profitMetrics.totalProfitAmount,
          remark: missingItemRemark,
        };

        const createdRef = await push(ref(database, 'SoldItems'), newItem);
        const newItemForList = { id: createdRef.key, ...newItem };
        const updatedItems = sortItemsByDate([...soldItems, newItemForList]);
        setSoldItems(updatedItems);
      }

      closeMissingItemsModal();
      setErrorMessage(null);
    } catch (error) {
      console.error('Error adding missing item:', error);
      setErrorMessage('Failed to add missing item.');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsSavingMissingItem(false);
    }
  };

  const missingItemQuantityValue = toNumber(missingItemQuantity);
  const missingItemIsStock = isStockLikeStatus(missingItemPaymentStatus);
  const missingItemSellPriceValue = !selectedProduct ? 0 : toNumber(missingItemSellPrice);
  const missingItemPurchasingPriceValue = !selectedProduct
    ? 0
    : (missingItemIsStock ? toNumber(missingItemPurchasingPrice) : toNumber(selectedProduct.purchasingPrice));
  const missingItemTotalCost = missingItemIsStock
    ? 0
    : missingItemSellPriceValue * missingItemQuantityValue;
  const missingItemTotalProfit = (missingItemSellPriceValue - missingItemPurchasingPriceValue) * missingItemQuantityValue;
  const canSaveMissingItem = Boolean(
    selectedProduct &&
    (isStockLikeStatus(missingItemPaymentStatus) || missingItemCustomerId) &&
    missingItemDate &&
    missingItemQuantityValue > 0 &&
    !isSavingMissingItem
  );

  const filteredTotals = calculateTotals(filteredItems);
  const profitSummaryLabel = monthFilter
    ? `${formatMonthDisplay(parseInt(monthFilter, 10))} Profit`
    : 'Filtered Profit';

  return (
    <div className="page-shell sold-items-container">
      {/* Header */}
      <div className="page-shell-header">
        <div className="page-shell-header-left">
          <h1 className="page-shell-header-title">Items Sold</h1>
          <p className="page-shell-header-subtitle">Oil / Filter</p>
        </div>
        <div className="page-shell-header-actions">
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <IconRefresh /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <div style={{ position: 'relative' }}>
            <button className="btn-secondary" onClick={() => setShowExportDropdown(v => !v)}>
              Export ▾
            </button>
            {showExportDropdown && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 100,
                background: '#fff', border: '1px solid var(--border-light)', borderRadius: 'var(--r-md)',
                boxShadow: 'var(--shadow-md)', minWidth: 180, marginTop: 4,
              }}>
                <button
                  style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => { exportToCSV(); setShowExportDropdown(false); }}
                >
                  Full Export (CSV)
                </button>
                <button
                  style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => { exportToCSVClient(); setShowExportDropdown(false); }}
                >
                  Client Export (PDF)
                </button>
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={openMissingItemsModal}>
            <IconPlus /> Add Sold Item
          </button>
        </div>
      </div>
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.name}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Product</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="">All Products</option>
              {productFilterOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>From Date</label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="date-input"
            />
            {dateFromFilter && (
              <div className="date-display-hint">
                From: {getDateDisplay(dateFromFilter)}
              </div>
            )}
          </div>

          <div className="filter-group">
            <label>To Date</label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="date-input"
            />
            {dateToFilter && (
              <div className="date-display-hint">
                To: {getDateDisplay(dateToFilter)}
              </div>
            )}
          </div>

          <div className="filter-group">
            <label>Month</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            >
              <option value="">All Months</option>
              {[...Array(12).keys()].map((month) => (
                <option key={month} value={month + 1}>
                  {formatMonthDisplay(month + 1)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Hold">Hold</option>
              <option value="Free">Free</option>
              <option value="Stock">Stock</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Check Status</label>
            <select
              value={checkFilter}
              onChange={(e) => setCheckFilter(e.target.value)}
            >
              <option value="all">All Items</option>
              <option value="checked">Checked</option>
              <option value="unchecked">Unchecked</option>
            </select>
            <button 
              className="clear-checks-btn"
              onClick={clearAllChecks}
              disabled={checkedItems.length === 0}
            >
              Clear Checks ({checkedItems.length})
            </button>
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn-secondary" onClick={clearAllFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Active Filters */}
      {(customerFilter || productFilter || dateFromFilter || dateToFilter || monthFilter || paymentStatusFilter !== 'All' || checkFilter !== 'all') && (
        <div className="active-filters">
          <div className="active-filters-header">
            <span className="active-filters-title">Active Filters:</span>
            <button className="clear-all-filters" onClick={clearAllFilters}>
              Clear All
            </button>
          </div>
          <div className="filter-tags">
            {customerFilter && (
              <span className="filter-tag">
                Customer: {customerFilter}
                <button onClick={() => setCustomerFilter('')}><IconX /></button>
              </span>
            )}
            {productFilter && (
              <span className="filter-tag">
                Product: {productFilter}
                <button onClick={() => setProductFilter('')}><IconX /></button>
              </span>
            )}
            {dateFromFilter && (
              <span className="filter-tag">
                From: {getDateDisplay(dateFromFilter)}
                <button onClick={() => setDateFromFilter('')}><IconX /></button>
              </span>
            )}
            {dateToFilter && (
              <span className="filter-tag">
                To: {getDateDisplay(dateToFilter)}
                <button onClick={() => setDateToFilter('')}><IconX /></button>
              </span>
            )}
            {monthFilter && (
              <span className="filter-tag">
                Month: {formatMonthDisplay(parseInt(monthFilter, 10))}
                <button onClick={() => setMonthFilter('')}><IconX /></button>
              </span>
            )}
            {paymentStatusFilter !== 'All' && (
              <span className="filter-tag">
                Status: {paymentStatusFilter}
                <button onClick={() => setPaymentStatusFilter('All')}><IconX /></button>
              </span>
            )}
            {checkFilter !== 'all' && (
              <span className="filter-tag">
                Check: {checkFilter === 'checked' ? 'Checked' : 'Unchecked'}
                <button onClick={() => setCheckFilter('all')}><IconX /></button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {filteredItems.length > 0 && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-card-label">Total Items</div>
            <div className="kpi-card-value">{filteredTotals.totalItems}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-label">Total Quantity</div>
            <div className="kpi-card-value">{formatCurrency(filteredTotals.totalQuantity)}</div>
          </div>
          <div className="kpi-card tone-green">
            <div className="kpi-card-label">Total Revenue</div>
            <div className="kpi-card-value">${formatCurrency(filteredTotals.totalCost)}</div>
          </div>
          <div className="kpi-card tone-purple">
            <div className="kpi-card-label">Total Purchase Cost</div>
            <div className="kpi-card-value">${formatCurrency(filteredTotals.totalPurchaseCost)}</div>
          </div>
          <div className={`kpi-card ${filteredTotals.totalProfit >= 0 ? 'tone-green' : 'tone-red'}`}>
            <div className="kpi-card-label">{profitSummaryLabel}</div>
            <div className="kpi-card-value">${formatCurrency(filteredTotals.totalProfit)}</div>
          </div>
        </div>
      )}

      {/* Results Info */}
      {filteredItems.length > 0 && (
        <div className="results-info">
          Showing {filteredItems.length} sold item(s) • 
          Data range: {formatDate(filteredItems[0]?.dateScanned)} to {formatDate(filteredItems[filteredItems.length - 1]?.dateScanned)} •
          Filtered profit: ${formatCurrency(filteredTotals.totalProfit)} •
          {checkedItems.length > 0 && ` ${checkedItems.length} items checked`}
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="filters-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong>{selectedIds.length} selected</strong>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set payment status:</span>
            {['Paid', 'Unpaid', 'Hold', 'Free'].map((s) => (
              <button
                key={s}
                type="button"
                className="btn-secondary"
                disabled={isBulkUpdating}
                onClick={() => handleBulkPaymentStatus(s)}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {s}
              </button>
            ))}
          </div>
          <button className="btn-secondary" onClick={clearSelection} disabled={isBulkUpdating}>Clear Selection</button>
        </div>
      )}

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <p>No items match the current filters.</p>
            <button className="btn-secondary" onClick={clearAllFilters}>
              Clear Filters
            </button>
          </div>
        ) : (
          <table className="data-table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} title="Select all" />
                </th>
                <th>Date</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Sell Price</th>
                <th>Purchasing Price</th>
                <th>Employee</th>
                <th>Remarks</th>
                <th>Total Cost</th>
                <th>Profit</th>
                <th>Payment Status</th>
                <th>Actions</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const rowMetrics = getItemProfitMetrics(item);
                return (
                <tr key={item.id} className={checkedItems.includes(item.id) ? 'checked-row' : ''}>
                  <td>
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} />
                  </td>
                  <td className="date-cell">
                    <span className="date-display">{formatDate(item.dateScanned)}</span>
                  </td>
                  <td>{item.customerName || 'N/A'}</td>
                  <td>{item.name || 'N/A'}</td>
                  <td><span className="type-cell">{getItemProductType(item)}</span></td>
                  <td>{item.quantity || 0}</td>
                  <td>{`$${rowMetrics.unitSellPrice.toFixed(2)}`}</td>
                  <td>{`$${rowMetrics.unitPurchasePrice.toFixed(2)}`}</td>
                  <td>{item.scannedBy || 'N/A'}</td>
                  <td>{item.remark || 'N/A'}</td>
                  <td>{`$${rowMetrics.revenue.toFixed(2)}`}</td>
                  <td>
                    <span style={{ color: rowMetrics.totalProfitAmount >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}>
                      ${rowMetrics.totalProfitAmount.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <div className="payment-status">
                      <span className={`status-badge status-${item.paymentStatus?.toLowerCase().replace(' ', '-')}`}>
                        {item.paymentStatus}
                      </span>
                      {item.paymentStatus === 'Stock' && (
                        <button
                          className="btn-small"
                          onClick={async () => {
                            const itemRef = ref(database, `SoldItems/${item.id}`);
                            try {
                              await update(itemRef, { paymentStatus: 'Stock Confirmed' });
                              const updatedItems = soldItems.map((i) =>
                                i.id === item.id ? { ...i, paymentStatus: 'Stock Confirmed' } : i
                              );
                              setSoldItems(updatedItems);
                              setFilteredItems(updatedItems);
                            } catch (error) {
                              console.error('Error confirming item:', error);
                            }
                          }}
                          disabled={item.paymentStatus === 'Stock Confirmed'}
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-small btn-primary" onClick={() => handleEdit(item)} title="Edit">
                        <IconEdit />
                      </button>
                      <button className="btn-small btn-danger" onClick={() => handleDeleteConfirmation(item.id)} title="Delete / Refund">
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={checkedItems.includes(item.id)}
                      onChange={() => handleCheckboxChange(item.id)}
                      className="checkbox"
                      id={`checkbox-${item.id}`}
                    />
                    <label htmlFor={`checkbox-${item.id}`} className="checkbox-label">
                      {checkedItems.includes(item.id) ? 'Checked' : 'Check'}
                    </label>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Sold Item</h3>
              <button className="modal-close" onClick={() => setEditingItem(null)}><IconX /></button>
            </div>
            <div className="modal-content">
              <div className="missing-item-form-grid">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="datetime-local" value={newDate || ''} onChange={(e) => setNewDate(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer</label>
                  <select value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} className="form-select">
                    <option value="">Select Customer</option>
                    {customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Product</label>
                  <input type="text" value={newProductType} onChange={(e) => setNewProductType(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input type="number" min="0" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sell Price</label>
                  <input type="number" min="0" step="0.01" value={newSellPrice} onChange={(e) => setNewSellPrice(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchasing Price</label>
                  <input type="number" min="0" step="0.01" value={newPurchasingPrice} onChange={(e) => setNewPurchasingPrice(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select value={newPaymentStatus} onChange={(e) => setNewPaymentStatus(e.target.value)} className="form-select">
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Hold">Hold</option>
                    <option value="Free">Free</option>
                    <option value="Stock">Stock</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 'var(--s-3)' }}>
                <label className="form-label">Remark</label>
                <input type="text" value={newRemark} onChange={(e) => setNewRemark(e.target.value)} className="form-input" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveEditedItem}>Update Item</button>
              <button className="btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Items Modal */}
      {showMissingItemsModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3>Add Missing Item</h3>
              <button className="modal-close" onClick={closeMissingItemsModal}>
                <IconX />
              </button>
            </div>
            <div className="modal-content">
              <div className="product-selection">
                <div className="form-group">
                  <label className="form-label">Product</label>
                  <select
                    value={missingItemGroupId}
                    onChange={(e) => handleMissingProductChange(e.target.value)}
                    className="product-select"
                    disabled={isSavingMissingItem}
                  >
                    <option value="">Select a Product</option>
                    {missingItemGroups.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {p.barcode} · stock {p.quantity}
                      </option>
                    ))}
                  </select>
                </div>

                {missingItemGroupId && missingItemBatches.length > 1 && (
                  <div className="form-group">
                    <label className="form-label">Price</label>
                    <select
                      value={selectedProduct?.id || ''}
                      onChange={(e) => handleMissingBatchChange(e.target.value)}
                      className="form-select"
                      disabled={isSavingMissingItem}
                    >
                      {missingItemBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          ${toNumber(b.itemCost).toFixed(2)} — {computeBatchRemaining(b, { soldItems, checkedAtByProductId: stockCheckedAtByProductId })} left
                          {b.id === missingItemDefaultBatch?.id ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedProduct && (
                  <>
                    <div className="barcode-section">
                      <h4>{selectedProduct.name}</h4>
                      <div className="barcode-container">
                        <Barcode 
                          value={selectedProduct.barcode} 
                          format="CODE128"
                          width={2}
                          height={100}
                          displayValue={false}
                        />
                      </div>
                      <p className="barcode-number">{selectedProduct.barcode}</p>
                      <p style={{ fontSize: 13, color: selectedProductRemaining <= 0 ? 'var(--red, #dc3545)' : 'var(--text-muted)' }}>
                        {selectedProductRemaining} left at ${toNumber(selectedProduct.itemCost).toFixed(2)}
                      </p>
                    </div>

                    <div className="missing-item-form-grid">
                      <div className="form-group">
                        <label className="form-label">Customer</label>
                        <select
                          value={missingItemCustomerId}
                          onChange={(e) => setMissingItemCustomerId(e.target.value)}
                          className="form-select"
                          disabled={isSavingMissingItem}
                        >
                          <option value="">Select Customer</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Date</label>
                        <input
                          type="date"
                          value={missingItemDate}
                          onChange={(e) => setMissingItemDate(e.target.value)}
                          className="form-input"
                          disabled={isSavingMissingItem}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Quantity</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={missingItemQuantity}
                          onChange={(e) => setMissingItemQuantity(e.target.value)}
                          className="form-input"
                          disabled={isSavingMissingItem}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Payment Status</label>
                        <select
                          value={missingItemPaymentStatus}
                          onChange={(e) => setMissingItemPaymentStatus(e.target.value)}
                          className="form-select"
                          disabled={isSavingMissingItem}
                        >
                          <option value="Paid">Paid</option>
                          <option value="Unpaid">Unpaid</option>
                          <option value="Hold">Hold</option>
                          <option value="Free">Free</option>
                          <option value="Stock">Stock</option>
                        </select>
                      </div>

                      {missingItemIsStock && (
                        <div className="form-group">
                          <label className="form-label">Purchasing Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={missingItemPurchasingPrice}
                            onChange={(e) => setMissingItemPurchasingPrice(e.target.value)}
                            className="form-input"
                            disabled={isSavingMissingItem}
                          />
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">Selling Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={missingItemSellPrice}
                          onChange={(e) => setMissingItemSellPrice(e.target.value)}
                          className="form-input"
                          disabled={isSavingMissingItem}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Remark</label>
                      <textarea
                        value={missingItemRemark}
                        onChange={(e) => setMissingItemRemark(e.target.value)}
                        className="form-textarea"
                        rows="3"
                        disabled={isSavingMissingItem}
                      />
                    </div>

                    <div className="missing-item-summary">
                      <span>Unit Purchase: ${missingItemPurchasingPriceValue.toFixed(2)}</span>
                      <span>Total Cost: ${missingItemTotalCost.toFixed(2)}</span>
                      <span style={{ color: missingItemTotalProfit >= 0 ? '#198754' : '#dc3545' }}>
                        Total Profit: ${missingItemTotalProfit.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveMissingItem} disabled={!canSaveMissingItem}>
                {isSavingMissingItem ? 'Saving...' : 'Save Missing Item'}
              </button>
              <button className="btn-secondary" onClick={closeMissingItemsModal} disabled={isSavingMissingItem}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
};

export default OilSoldItems;
