import React, { useEffect, useState } from 'react';
import { database } from '../Auth/firebase';
import { ref, get, set, update, push } from 'firebase/database';
import {
  isFileSystemAccessSupported,
  getSavedExportFolderName,
  pickExportFolder,
  clearExportFolder,
} from '../utils/exportFolder';
import '../CSS/settings.css';
import { DEFAULT_USD_TO_LBP_RATE, formatNumberInput, stripCommas } from '../utils/exchangeRate';

const DEFAULT_CATEGORIES = ['Lubrication', 'Washing', 'Washing & Lubrication'];

const IconFolder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2a2 2 0 0 0-1.66-.9H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const IconSpray = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3h6v6H3z" />
    <path d="M9 6h6" />
    <path d="M15 3v18" />
    <path d="M18 9h3v12h-6V12" />
  </svg>
);

const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconMapPin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconFlag = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const IconBriefcase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const IconDatabase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </svg>
);

const IconTruck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 3h15v13H1z" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const isMaghsalRow = (row) => {
  if (!row || typeof row !== 'object') return false;
  if (String(row.productType || '').toLowerCase() === 'maghsal') return true;
  if (String(row.paymentStatus || '').toLowerCase() === 'maghsal') return true;
  return false;
};

const Settings = () => {
  // Export folder
  const [folderName, setFolderName] = useState(null);
  const [supported, setSupported] = useState(true);
  const [folderBusy, setFolderBusy] = useState(false);

  // Categories
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newCategory, setNewCategory] = useState('');
  const [categoriesBusy, setCategoriesBusy] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  // Customer cities
  const [cities, setCities] = useState([]);
  const [newCity, setNewCity] = useState('');
  const [citiesBusy, setCitiesBusy] = useState(false);
  const [editingCityIdx, setEditingCityIdx] = useState(null);
  const [editingCityValue, setEditingCityValue] = useState('');

  // Employee nationalities
  const [nationalities, setNationalities] = useState([]);
  const [newNationality, setNewNationality] = useState('');
  const [nationalitiesBusy, setNationalitiesBusy] = useState(false);
  const [editingNationalityIdx, setEditingNationalityIdx] = useState(null);
  const [editingNationalityValue, setEditingNationalityValue] = useState('');

  // Employee roles
  const [roles, setRoles] = useState([]);
  const [newRole, setNewRole] = useState('');
  const [rolesBusy, setRolesBusy] = useState(false);
  const [editingRoleIdx, setEditingRoleIdx] = useState(null);
  const [editingRoleValue, setEditingRoleValue] = useState('');

  // Water Distribution truck types
  const [truckTypes, setTruckTypes] = useState([]);
  const [newTruckType, setNewTruckType] = useState('');
  const [truckTypesBusy, setTruckTypesBusy] = useState(false);
  const [editingTruckTypeIdx, setEditingTruckTypeIdx] = useState(null);
  const [editingTruckTypeValue, setEditingTruckTypeValue] = useState('');

  // Currency exchange rate (LBP per 1 USD)
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_USD_TO_LBP_RATE);
  const [exchangeRateInput, setExchangeRateInput] = useState(String(DEFAULT_USD_TO_LBP_RATE));
  const [exchangeRateBusy, setExchangeRateBusy] = useState(false);

  // Migration
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationCounts, setMigrationCounts] = useState(null);
  const [lastMigration, setLastMigration] = useState(null);

  // Customer name fix (Arabic -> English in SoldItems.customerName)
  const [nameFixBusy, setNameFixBusy] = useState(false);
  const [nameFixStatus, setNameFixStatus] = useState(null);
  const [productArchiveBusy, setProductArchiveBusy] = useState(false);
  const [stockArchiveBusy, setStockArchiveBusy] = useState(false);

  // Flash
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const supportedNow = isFileSystemAccessSupported();
    setSupported(supportedNow);
    if (supportedNow) {
      getSavedExportFolderName().then(setFolderName).catch((err) => {
        console.error('Failed to load saved export folder:', err);
      });
    }
    // Load categories
    get(ref(database, 'settings/maghsalCategories'))
      .then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val) && val.length > 0) {
            setCategories(val);
          } else if (val && typeof val === 'object') {
            const arr = Object.values(val).filter((v) => typeof v === 'string' && v.trim().length > 0);
            if (arr.length > 0) setCategories(arr);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load Maghsal categories:', err);
        if (err?.code === 'PERMISSION_DENIED') {
          setError('Permission denied while loading Settings. Some admin-only settings may be unavailable.');
        }
      });
    // Load customer cities
    get(ref(database, 'settings/customerCities'))
      .then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val) && val.length > 0) {
            setCities(val);
          } else if (val && typeof val === 'object') {
            const arr = Object.values(val).filter((v) => typeof v === 'string' && v.trim().length > 0);
            if (arr.length > 0) setCities(arr);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load customer cities:', err);
        if (err?.code === 'PERMISSION_DENIED') {
          setError('Permission denied while loading Settings. Some admin-only settings may be unavailable.');
        }
      });
    // Load employee nationalities
    get(ref(database, 'settings/nationalities'))
      .then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val) && val.length > 0) {
            setNationalities(val);
          } else if (val && typeof val === 'object') {
            const arr = Object.values(val).filter((v) => typeof v === 'string' && v.trim().length > 0);
            if (arr.length > 0) setNationalities(arr);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load nationalities:', err);
        if (err?.code === 'PERMISSION_DENIED') {
          setError('Permission denied while loading Settings. Some admin-only settings may be unavailable.');
        }
      });
    // Load employee roles
    get(ref(database, 'settings/employeeRoles'))
      .then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val) && val.length > 0) {
            setRoles(val);
          } else if (val && typeof val === 'object') {
            const arr = Object.values(val).filter((v) => typeof v === 'string' && v.trim().length > 0);
            if (arr.length > 0) setRoles(arr);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load employee roles:', err);
        if (err?.code === 'PERMISSION_DENIED') {
          setError('Permission denied while loading Settings. Some admin-only settings may be unavailable.');
        }
      });
    // Load Water Distribution truck types
    get(ref(database, 'settings/waterDistributionTruckTypes'))
      .then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val) && val.length > 0) {
            setTruckTypes(val);
          } else if (val && typeof val === 'object') {
            const arr = Object.values(val).filter((v) => typeof v === 'string' && v.trim().length > 0);
            if (arr.length > 0) setTruckTypes(arr);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load truck types:', err);
        if (err?.code === 'PERMISSION_DENIED') {
          setError('Permission denied while loading Settings. Some admin-only settings may be unavailable.');
        }
      });
    // Load currency exchange rate
    get(ref(database, 'settings/usdToLbpRate'))
      .then((snap) => {
        if (snap.exists()) {
          const val = Number(snap.val());
          if (Number.isFinite(val) && val > 0) {
            setExchangeRate(val);
            setExchangeRateInput(String(val));
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load exchange rate:', err);
        if (err?.code === 'PERMISSION_DENIED') {
          setError('Permission denied while loading Settings. Some admin-only settings may be unavailable.');
        }
      });
    // Load last migration record
    get(ref(database, 'maghsalMigrations'))
      .then((snap) => {
        if (!snap.exists()) return;
        const records = snap.val();
        const list = Object.keys(records).map((k) => ({ id: k, ...records[k] }));
        list.sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
        if (list[0]) setLastMigration(list[0]);
      })
      .catch((err) => {
        console.error('Failed to load Maghsal migration records:', err);
        if (err?.code === 'PERMISSION_DENIED') {
          setMigrationStatus('Migration history is admin-claim restricted. Settings can still load, but history is unavailable.');
        }
      });
    // Preview count
    previewMigrationCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flashMessage = (msg) => {
    setMessage(msg);
    setError(null);
    setTimeout(() => setMessage(null), 4000);
  };
  const flashError = (msg) => {
    setError(msg);
    setMessage(null);
    setTimeout(() => setError(null), 5000);
  };

  const archiveProductsAndResetQuantities = async () => {
    const confirmed = window.confirm(
      'Archive all current products and reset all quantities to 0?\n\n' +
      'Products will stay in the list. Only quantity will reset.'
    );
    if (!confirmed) return;

    setProductArchiveBusy(true);
    const archivedAt = new Date().toISOString();
    const archiveId = archivedAt.replace(/[.:]/g, '-');

    try {
      const productsSnap = await get(ref(database, 'products'));
      if (!productsSnap.exists()) {
        flashError('No products available to archive.');
        return;
      }

      const productsData = productsSnap.val();
      const productsList = Object.entries(productsData).map(([id, value]) => ({ id, ...value }));
      const archiveProducts = productsList.reduce((acc, product) => {
        const qty = parseFloat(product.quantity) || 0;
        acc[product.id] = { ...product, quantity: qty };
        return acc;
      }, {});
      const resetProducts = productsList.reduce((acc, product) => {
        const { id, ...rest } = product;
        acc[id] = { ...rest, quantity: 0 };
        return acc;
      }, {});
      const totalQtyBeforeReset = productsList.reduce(
        (sum, product) => sum + (parseFloat(product.quantity) || 0),
        0
      );

      await set(ref(database, `productArchives/${archiveId}`), {
        archivedAt,
        summary: {
          productsArchived: productsList.length,
          totalQuantityBeforeReset: totalQtyBeforeReset,
        },
        products: archiveProducts,
      });
      await set(ref(database, 'products'), resetProducts);

      flashMessage(`Archived ${productsList.length} products and reset all quantities to 0.`);
    } catch (err) {
      console.error(err);
      if (err?.code === 'PERMISSION_DENIED') {
        flashError('Permission denied. Add read/write rules for "productArchives".');
      } else {
        flashError('Failed to archive and reset products. Please try again.');
      }
    } finally {
      setProductArchiveBusy(false);
    }
  };

  const archiveStockAndResetAll = async () => {
    const confirmed = window.confirm(
      'Archive ALL products + Sold Items and start from scratch?\n\n' +
      'This creates an archive copy, keeps products, resets product quantities to 0, and clears live SoldItems + stock checks/history.'
    );
    if (!confirmed) return;

    setStockArchiveBusy(true);
    const archivedAt = new Date().toISOString();
    const archiveId = archivedAt.replace(/[.:]/g, '-');

    try {
      const [productsSnap, checksSnap, historySnap, soldSnap] = await Promise.all([
        get(ref(database, 'products')),
        get(ref(database, 'stockChecks')),
        get(ref(database, 'stockCheckHistory')),
        get(ref(database, 'SoldItems')),
      ]);

      if (!productsSnap.exists()) {
        flashError('No products available to archive.');
        return;
      }

      const allProducts = Object.entries(productsSnap.val()).map(([id, value]) => ({ id, ...value }));
      const productSnapshot = allProducts.reduce((acc, product) => {
        acc[product.id] = { ...product };
        return acc;
      }, {});
      const allChecks = checksSnap.exists() ? checksSnap.val() : {};
      const pendingFromDb = Object.values(allChecks).filter((check) => check?.status === 'pending').length;

      await set(ref(database, `stockArchives/${archiveId}`), {
        archivedAt,
        summary: {
          productsArchived: allProducts.length,
          soldItemsArchived: soldSnap.exists() ? Object.keys(soldSnap.val()).length : 0,
          pendingChecksArchived: pendingFromDb,
          historyMonthsArchived: historySnap.exists() ? Object.keys(historySnap.val()).length : 0,
        },
        products: productSnapshot,
        soldItems: soldSnap.exists() ? soldSnap.val() : {},
        stockChecks: allChecks,
        stockCheckHistory: historySnap.exists() ? historySnap.val() : {},
      });

      const resetProducts = allProducts.reduce((acc, product) => {
        const { id, ...rest } = product;
        acc[id] = { ...rest, quantity: 0 };
        return acc;
      }, {});

      await Promise.all([
        set(ref(database, 'products'), resetProducts),
        set(ref(database, 'stockCheckHistory'), null),
        set(ref(database, 'SoldItems'), null),
        set(ref(database, 'stockChecks'), null),
      ]);

      flashMessage(`Archived stock data and reset quantities to 0 for ${allProducts.length} products.`);
    } catch (err) {
      console.error(err);
      if (err?.code === 'PERMISSION_DENIED') {
        flashError('Permission denied. Add read/write rules for "stockArchives".');
      } else {
        flashError('Failed to archive stock. Please try again.');
      }
    } finally {
      setStockArchiveBusy(false);
    }
  };

  // ── Folder handlers ──────────────────────────────────
  const handlePick = async () => {
    setFolderBusy(true);
    try {
      const name = await pickExportFolder();
      setFolderName(name);
      flashMessage(`Export folder set to "${name}". Future PDF and CSV exports will save there.`);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // user cancelled
      } else if (err && err.message === 'FILE_SYSTEM_ACCESS_UNSUPPORTED') {
        flashError('Your browser does not support choosing an export folder. Try Chrome, Edge, or Brave.');
      } else if (err && err.message === 'PERMISSION_DENIED') {
        flashError('Permission to write to the folder was denied.');
      } else {
        flashError('Could not set the export folder.');
        console.error(err);
      }
    } finally {
      setFolderBusy(false);
    }
  };

  const handleClear = async () => {
    setFolderBusy(true);
    try {
      await clearExportFolder();
      setFolderName(null);
      flashMessage('Export folder cleared. Future exports will use the browser download.');
    } finally {
      setFolderBusy(false);
    }
  };

  // ── Categories handlers ──────────────────────────────
  const saveCategories = async (next) => {
    setCategoriesBusy(true);
    try {
      await set(ref(database, 'settings/maghsalCategories'), next);
      setCategories(next);
      flashMessage('Maghsal categories saved.');
    } catch (err) {
      console.error(err);
      flashError('Failed to save categories. You may not have permission.');
    } finally {
      setCategoriesBusy(false);
    }
  };

  const addCategory = async () => {
    const v = newCategory.trim();
    if (!v) return;
    if (categories.some((c) => c.toLowerCase() === v.toLowerCase())) {
      flashError('That category already exists.');
      return;
    }
    await saveCategories([...categories, v]);
    setNewCategory('');
  };

  const removeCategory = async (idx) => {
    const target = categories[idx];
    if (!window.confirm(`Remove category "${target}"? Existing entries will keep this category text but it won't be selectable for new entries.`)) {
      return;
    }
    const next = categories.filter((_, i) => i !== idx);
    await saveCategories(next);
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditingValue(categories[idx]);
  };

  const cancelEditCategory = () => {
    setEditingIdx(null);
    setEditingValue('');
  };

  const saveEditCategory = async () => {
    const v = editingValue.trim();
    if (!v) return;
    if (categories.some((c, i) => i !== editingIdx && c.toLowerCase() === v.toLowerCase())) {
      flashError('Another category with that name already exists.');
      return;
    }
    const next = categories.map((c, i) => (i === editingIdx ? v : c));
    await saveCategories(next);
    setEditingIdx(null);
    setEditingValue('');
  };

  const resetCategoriesToDefaults = async () => {
    if (!window.confirm('Reset Maghsal categories to defaults? Custom entries will be removed.')) return;
    await saveCategories(DEFAULT_CATEGORIES);
  };

  // ── Cities handlers ───────────────────────────────────
  const saveCities = async (next) => {
    setCitiesBusy(true);
    try {
      await set(ref(database, 'settings/customerCities'), next);
      setCities(next);
      flashMessage('Cities saved.');
    } catch (err) {
      console.error(err);
      flashError('Failed to save cities. You may not have permission.');
    } finally {
      setCitiesBusy(false);
    }
  };

  const addCity = async () => {
    const v = newCity.trim();
    if (!v) return;
    if (cities.some((c) => c.toLowerCase() === v.toLowerCase())) {
      flashError('That city already exists.');
      return;
    }
    await saveCities([...cities, v].sort((a, b) => a.localeCompare(b)));
    setNewCity('');
  };

  const removeCity = async (idx) => {
    const target = cities[idx];
    if (!window.confirm(`Remove city "${target}"? Existing customers keep this city text but it won't be selectable for new/edited entries.`)) {
      return;
    }
    const next = cities.filter((_, i) => i !== idx);
    await saveCities(next);
  };

  const startEditCity = (idx) => {
    setEditingCityIdx(idx);
    setEditingCityValue(cities[idx]);
  };

  const cancelEditCity = () => {
    setEditingCityIdx(null);
    setEditingCityValue('');
  };

  const saveEditCity = async () => {
    const v = editingCityValue.trim();
    if (!v) return;
    if (cities.some((c, i) => i !== editingCityIdx && c.toLowerCase() === v.toLowerCase())) {
      flashError('Another city with that name already exists.');
      return;
    }
    const next = cities.map((c, i) => (i === editingCityIdx ? v : c)).sort((a, b) => a.localeCompare(b));
    await saveCities(next);
    setEditingCityIdx(null);
    setEditingCityValue('');
  };

  // ── Nationalities handlers ────────────────────────────
  const saveNationalities = async (next) => {
    setNationalitiesBusy(true);
    try {
      await set(ref(database, 'settings/nationalities'), next);
      setNationalities(next);
      flashMessage('Nationalities saved.');
    } catch (err) {
      console.error(err);
      flashError('Failed to save nationalities. You may not have permission.');
    } finally {
      setNationalitiesBusy(false);
    }
  };

  const addNationality = async () => {
    const v = newNationality.trim();
    if (!v) return;
    if (nationalities.some((n) => n.toLowerCase() === v.toLowerCase())) {
      flashError('That nationality already exists.');
      return;
    }
    await saveNationalities([...nationalities, v].sort((a, b) => a.localeCompare(b)));
    setNewNationality('');
  };

  const removeNationality = async (idx) => {
    const target = nationalities[idx];
    if (!window.confirm(`Remove nationality "${target}"? Existing employees keep this nationality text but it won't be selectable for new/edited entries.`)) {
      return;
    }
    const next = nationalities.filter((_, i) => i !== idx);
    await saveNationalities(next);
  };

  const startEditNationality = (idx) => {
    setEditingNationalityIdx(idx);
    setEditingNationalityValue(nationalities[idx]);
  };

  const cancelEditNationality = () => {
    setEditingNationalityIdx(null);
    setEditingNationalityValue('');
  };

  const saveEditNationality = async () => {
    const v = editingNationalityValue.trim();
    if (!v) return;
    if (nationalities.some((n, i) => i !== editingNationalityIdx && n.toLowerCase() === v.toLowerCase())) {
      flashError('Another nationality with that name already exists.');
      return;
    }
    const next = nationalities.map((n, i) => (i === editingNationalityIdx ? v : n)).sort((a, b) => a.localeCompare(b));
    await saveNationalities(next);
    setEditingNationalityIdx(null);
    setEditingNationalityValue('');
  };

  // ── Employee roles handlers ────────────────────────────
  const saveRoles = async (next) => {
    setRolesBusy(true);
    try {
      await set(ref(database, 'settings/employeeRoles'), next);
      setRoles(next);
      flashMessage('Employee roles saved.');
    } catch (err) {
      console.error(err);
      flashError('Failed to save roles. You may not have permission.');
    } finally {
      setRolesBusy(false);
    }
  };

  const addRole = async () => {
    const v = newRole.trim();
    if (!v) return;
    if (roles.some((r) => r.toLowerCase() === v.toLowerCase())) {
      flashError('That role already exists.');
      return;
    }
    await saveRoles([...roles, v].sort((a, b) => a.localeCompare(b)));
    setNewRole('');
  };

  const removeRole = async (idx) => {
    const target = roles[idx];
    if (!window.confirm(`Remove role "${target}"? Existing employees keep this role text but it won't be selectable for new/edited entries.`)) {
      return;
    }
    const next = roles.filter((_, i) => i !== idx);
    await saveRoles(next);
  };

  const startEditRole = (idx) => {
    setEditingRoleIdx(idx);
    setEditingRoleValue(roles[idx]);
  };

  const cancelEditRole = () => {
    setEditingRoleIdx(null);
    setEditingRoleValue('');
  };

  const saveEditRole = async () => {
    const v = editingRoleValue.trim();
    if (!v) return;
    if (roles.some((r, i) => i !== editingRoleIdx && r.toLowerCase() === v.toLowerCase())) {
      flashError('Another role with that name already exists.');
      return;
    }
    const next = roles.map((r, i) => (i === editingRoleIdx ? v : r)).sort((a, b) => a.localeCompare(b));
    await saveRoles(next);
    setEditingRoleIdx(null);
    setEditingRoleValue('');
  };

  // ── Water Distribution truck types handlers ────────────
  const saveTruckTypes = async (next) => {
    setTruckTypesBusy(true);
    try {
      await set(ref(database, 'settings/waterDistributionTruckTypes'), next);
      setTruckTypes(next);
      flashMessage('Truck types saved.');
    } catch (err) {
      console.error(err);
      flashError('Failed to save truck types. You may not have permission.');
    } finally {
      setTruckTypesBusy(false);
    }
  };

  const addTruckType = async () => {
    const v = newTruckType.trim();
    if (!v) return;
    if (truckTypes.some((t) => t.toLowerCase() === v.toLowerCase())) {
      flashError('That truck type already exists.');
      return;
    }
    await saveTruckTypes([...truckTypes, v].sort((a, b) => a.localeCompare(b)));
    setNewTruckType('');
  };

  const removeTruckType = async (idx) => {
    const target = truckTypes[idx];
    if (!window.confirm(`Remove truck type "${target}"? Existing entries keep this text but it won't be selectable for new/edited entries.`)) {
      return;
    }
    const next = truckTypes.filter((_, i) => i !== idx);
    await saveTruckTypes(next);
  };

  const startEditTruckType = (idx) => {
    setEditingTruckTypeIdx(idx);
    setEditingTruckTypeValue(truckTypes[idx]);
  };

  const cancelEditTruckType = () => {
    setEditingTruckTypeIdx(null);
    setEditingTruckTypeValue('');
  };

  const saveEditTruckType = async () => {
    const v = editingTruckTypeValue.trim();
    if (!v) return;
    if (truckTypes.some((t, i) => i !== editingTruckTypeIdx && t.toLowerCase() === v.toLowerCase())) {
      flashError('Another truck type with that name already exists.');
      return;
    }
    const next = truckTypes.map((t, i) => (i === editingTruckTypeIdx ? v : t)).sort((a, b) => a.localeCompare(b));
    await saveTruckTypes(next);
    setEditingTruckTypeIdx(null);
    setEditingTruckTypeValue('');
  };

  // ── Exchange rate handler ─────────────────────────────
  const saveExchangeRate = async () => {
    const v = parseFloat(exchangeRateInput);
    if (!Number.isFinite(v) || v <= 0) {
      flashError('Enter a valid exchange rate greater than 0.');
      return;
    }
    setExchangeRateBusy(true);
    try {
      await set(ref(database, 'settings/usdToLbpRate'), v);
      setExchangeRate(v);
      flashMessage('Exchange rate saved.');
    } catch (err) {
      console.error(err);
      flashError('Failed to save exchange rate. You may not have permission.');
    } finally {
      setExchangeRateBusy(false);
    }
  };

  // ── Migration ────────────────────────────────────────
  const previewMigrationCounts = async () => {
    try {
      const [soldSnap, productsSnap] = await Promise.all([
        get(ref(database, 'SoldItems')),
        get(ref(database, 'products')),
      ]);
      const counts = { soldItems: 0, products: 0 };
      if (soldSnap.exists()) {
        const data = soldSnap.val();
        for (const k of Object.keys(data)) {
          if (isMaghsalRow(data[k])) counts.soldItems += 1;
        }
      }
      if (productsSnap.exists()) {
        const data = productsSnap.val();
        for (const k of Object.keys(data)) {
          if (String(data[k]?.productType || '').toLowerCase() === 'maghsal') counts.products += 1;
        }
      }
      setMigrationCounts(counts);
    } catch (err) {
      console.error('Preview migration counts failed:', err);
      setMigrationCounts({ soldItems: 0, products: 0 });
      if (err?.code === 'PERMISSION_DENIED') {
        setMigrationStatus('Permission denied while checking migration counts. Admin custom claim may be required for this action.');
      } else {
        setMigrationStatus('Could not check migration counts.');
      }
    }
  };

  const runMigration = async () => {
    if (!window.confirm('This will move existing Maghsal rows from SoldItems into the new maghsalEntries table, and remove Maghsal-typed products from the products list. A backup snapshot is saved first. Continue?')) {
      return;
    }
    setMigrationBusy(true);
    setMigrationStatus('Reading data...');
    try {
      const [soldSnap, productsSnap] = await Promise.all([
        get(ref(database, 'SoldItems')),
        get(ref(database, 'products')),
      ]);

      const soldData = soldSnap.exists() ? soldSnap.val() : {};
      const productsData = productsSnap.exists() ? productsSnap.val() : {};

      const maghsalSoldKeys = Object.keys(soldData).filter((k) => isMaghsalRow(soldData[k]));
      const maghsalProductKeys = Object.keys(productsData).filter(
        (k) => String(productsData[k]?.productType || '').toLowerCase() === 'maghsal'
      );

      if (maghsalSoldKeys.length === 0 && maghsalProductKeys.length === 0) {
        setMigrationStatus('No Maghsal data found in SoldItems or products. Nothing to migrate.');
        setMigrationBusy(false);
        return;
      }

      // Backup
      setMigrationStatus(`Backing up ${maghsalSoldKeys.length} sold row(s) + ${maghsalProductKeys.length} product(s)...`);
      const backupSold = {};
      for (const k of maghsalSoldKeys) backupSold[k] = soldData[k];
      const backupProducts = {};
      for (const k of maghsalProductKeys) backupProducts[k] = productsData[k];

      const backupRef = await push(ref(database, 'maghsalMigrations'), {
        runAt: new Date().toISOString(),
        countSoldItems: maghsalSoldKeys.length,
        countProducts: maghsalProductKeys.length,
        backupSold,
        backupProducts,
        status: 'in_progress',
      });

      // Build atomic update
      setMigrationStatus('Creating new maghsalEntries rows...');
      const updates = {};
      let created = 0;
      for (const k of maghsalSoldKeys) {
        const old = soldData[k];
        const customerName =
          (typeof old.customerName === 'string' && old.customerName) ||
          old.customer || '';
        const dateValue = old.dateScanned || old.date || new Date().toISOString();
        const price = (() => {
          const itemCost = parseFloat(old.itemCost);
          const totalCost = parseFloat(old.totalCost);
          const qty = parseFloat(old.quantity);
          if (Number.isFinite(itemCost) && Number.isFinite(qty) && qty > 0) return itemCost * qty;
          if (Number.isFinite(totalCost)) return totalCost;
          if (Number.isFinite(itemCost)) return itemCost;
          return 0;
        })();
        const statusRaw = String(old.paymentStatus || '').toLowerCase();
        const paymentStatus = statusRaw === 'paid' ? 'Paid' : 'Unpaid';

        const newEntry = {
          customerId: old.customerId || '',
          customerName: customerName || '',
          customerNameArabic: old.customerNameArabic || '',
          date: dateValue,
          category: 'Unspecified',
          price,
          paymentStatus,
          employee: old.scannedBy || old.employee || 'migrated',
          remark: old.remark || '',
          createdAt: new Date().toISOString(),
        };
        const newRef = push(ref(database, 'maghsalEntries'));
        updates[`maghsalEntries/${newRef.key}`] = newEntry;
        created += 1;
      }

      // Delete migrated SoldItems + products rows
      for (const k of maghsalSoldKeys) updates[`SoldItems/${k}`] = null;
      for (const k of maghsalProductKeys) updates[`products/${k}`] = null;

      setMigrationStatus(`Writing ${created} entry(s), cleaning SoldItems and products...`);
      await update(ref(database), updates);

      await update(ref(database, `maghsalMigrations/${backupRef.key}`), {
        status: 'completed',
        completedAt: new Date().toISOString(),
        countMigrated: created,
      });

      setMigrationStatus(
        `Migration complete: ${created} entry(s) moved to maghsalEntries. ` +
        `${maghsalSoldKeys.length} SoldItems row(s) and ${maghsalProductKeys.length} product(s) removed.`
      );
      setLastMigration({
        id: backupRef.key,
        runAt: new Date().toISOString(),
        countMigrated: created,
        countSoldItems: maghsalSoldKeys.length,
        countProducts: maghsalProductKeys.length,
        status: 'completed',
      });
      previewMigrationCounts();
    } catch (err) {
      console.error('Migration failed:', err);
      setMigrationStatus(`Migration failed: ${err.message || err}`);
      flashError('Migration failed. Check console for details.');
    } finally {
      setMigrationBusy(false);
    }
  };

  // ── Customer name fix ─────────────────────────────────
  // Older records (from a legacy Barcode Scanner convention) stored the
  // customer's Arabic name in SoldItems.customerName instead of English.
  // One-time sweep: for every SoldItems row whose customerName matches a
  // customer's nameArabic, overwrite it with that customer's English name.
  const runCustomerNameFix = async () => {
    setNameFixBusy(true);
    setNameFixStatus('Reading data...');
    try {
      const [customersSnap, soldSnap] = await Promise.all([
        get(ref(database, 'customers')),
        get(ref(database, 'SoldItems')),
      ]);

      if (!customersSnap.exists() || !soldSnap.exists()) {
        setNameFixStatus('No customers or sold items found. Nothing to fix.');
        return;
      }

      const customersData = customersSnap.val();
      const arabicToEnglish = new Map();
      Object.values(customersData).forEach((c) => {
        const ar = (c.nameArabic || '').trim().toLowerCase();
        if (ar && c.name) arabicToEnglish.set(ar, c.name);
      });

      const soldData = soldSnap.val();
      const updates = {};
      let count = 0;
      Object.entries(soldData).forEach(([id, item]) => {
        const raw = (item.customerName || '').trim();
        if (!raw) return;
        const englishName = arabicToEnglish.get(raw.toLowerCase());
        if (englishName && englishName !== item.customerName) {
          updates[`SoldItems/${id}/customerName`] = englishName;
          count += 1;
        }
      });

      if (count === 0) {
        setNameFixStatus('No Arabic customer names found in SoldItems. Nothing to fix.');
        return;
      }

      setNameFixStatus(`Fixing ${count} row(s)...`);
      await update(ref(database), updates);
      setNameFixStatus(`Done — ${count} SoldItems row(s) updated to the English customer name.`);
      flashMessage(`Fixed ${count} customer name(s) in Sold Items.`);
    } catch (err) {
      console.error('Customer name fix failed:', err);
      setNameFixStatus(`Failed: ${err.message || err}`);
      flashError('Customer name fix failed. Check console for details.');
    } finally {
      setNameFixBusy(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p className="settings-subtitle">Manage exports, Maghsal categories, and data migrations.</p>
      </div>

      {/* Export Folder */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconFolder /></span>
          <div>
            <h3>Default Export Folder</h3>
            <p>Pick a folder once and future PDF / CSV exports will save directly into it.</p>
          </div>
        </div>

        {!supported && (
          <div className="settings-warning">
            Your browser does not support choosing an export folder. Files will use the
            standard browser download. For folder support, use Chrome, Edge, or Brave on desktop.
          </div>
        )}

        <div className="settings-current">
          <span className="settings-label">Current folder:</span>
          <span className="settings-value">
            {folderName ? folderName : <em>None — exports go to your browser's Downloads folder</em>}
          </span>
        </div>

        <div className="settings-actions">
          <button
            className="settings-btn settings-btn-primary"
            onClick={handlePick}
            disabled={!supported || folderBusy}
          >
            {folderName ? 'Change Folder' : 'Choose Folder'}
          </button>
          {folderName && (
            <button
              className="settings-btn settings-btn-secondary"
              onClick={handleClear}
              disabled={folderBusy}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Currency Exchange Rate */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconDollar /></span>
          <div>
            <h3>Currency Exchange Rate</h3>
            <p>1 USD = this many LBP. Used everywhere a price is shown in both currencies (Customers, Water Filling, ...).</p>
          </div>
        </div>

        <div className="settings-current">
          <span className="settings-label">Current rate:</span>
          <span className="settings-value">1 USD = {exchangeRate.toLocaleString('en-US')} LBP</span>
        </div>

        <div className="settings-add-row">
          <input
            type="text"
            inputMode="decimal"
            placeholder="LBP per 1 USD"
            value={formatNumberInput(exchangeRateInput)}
            onChange={(e) => setExchangeRateInput(stripCommas(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') saveExchangeRate(); }}
            className="settings-input"
            disabled={exchangeRateBusy}
          />
          <button
            className="settings-btn settings-btn-primary"
            onClick={saveExchangeRate}
            disabled={exchangeRateBusy || !exchangeRateInput.trim()}
          >
            Save Rate
          </button>
        </div>
      </div>

      {/* Maghsal Categories */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconSpray /></span>
          <div>
            <h3>Maghsal Categories</h3>
            <p>Categories shown in the Maghsal entry form. Existing entries are not affected when you remove or rename a category.</p>
          </div>
        </div>

        <ul className="settings-list">
          {categories.length === 0 && (
            <li className="settings-list-empty">No categories yet. Add one below or reset to defaults.</li>
          )}
          {categories.map((cat, idx) => (
            <li key={`${cat}-${idx}`} className="settings-list-item">
              {editingIdx === idx ? (
                <>
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="settings-input"
                    disabled={categoriesBusy}
                  />
                  <button
                    className="settings-btn settings-btn-primary settings-btn-sm"
                    onClick={saveEditCategory}
                    disabled={categoriesBusy || !editingValue.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={cancelEditCategory}
                    disabled={categoriesBusy}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="settings-list-text">{cat}</span>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={() => startEdit(idx)}
                    disabled={categoriesBusy}
                  >
                    Rename
                  </button>
                  <button
                    className="settings-btn settings-btn-danger settings-btn-sm"
                    onClick={() => removeCategory(idx)}
                    disabled={categoriesBusy}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="settings-add-row">
          <input
            type="text"
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
            className="settings-input"
            disabled={categoriesBusy}
          />
          <button
            className="settings-btn settings-btn-primary"
            onClick={addCategory}
            disabled={categoriesBusy || !newCategory.trim()}
          >
            Add
          </button>
          <button
            className="settings-btn settings-btn-secondary"
            onClick={resetCategoriesToDefaults}
            disabled={categoriesBusy}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Customer Cities */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconMapPin /></span>
          <div>
            <h3>Cities</h3>
            <p>Cities shown in the customer City dropdown, and used to filter the customer list. Existing customers are not affected when you remove or rename a city.</p>
          </div>
        </div>

        <ul className="settings-list">
          {cities.length === 0 && (
            <li className="settings-list-empty">No cities yet. Add one below.</li>
          )}
          {cities.map((city, idx) => (
            <li key={`${city}-${idx}`} className="settings-list-item">
              {editingCityIdx === idx ? (
                <>
                  <input
                    type="text"
                    value={editingCityValue}
                    onChange={(e) => setEditingCityValue(e.target.value)}
                    className="settings-input"
                    disabled={citiesBusy}
                  />
                  <button
                    className="settings-btn settings-btn-primary settings-btn-sm"
                    onClick={saveEditCity}
                    disabled={citiesBusy || !editingCityValue.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={cancelEditCity}
                    disabled={citiesBusy}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="settings-list-text">{city}</span>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={() => startEditCity(idx)}
                    disabled={citiesBusy}
                  >
                    Rename
                  </button>
                  <button
                    className="settings-btn settings-btn-danger settings-btn-sm"
                    onClick={() => removeCity(idx)}
                    disabled={citiesBusy}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="settings-add-row">
          <input
            type="text"
            placeholder="New city name"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCity(); }}
            className="settings-input"
            disabled={citiesBusy}
          />
          <button
            className="settings-btn settings-btn-primary"
            onClick={addCity}
            disabled={citiesBusy || !newCity.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Employee Nationalities */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconFlag /></span>
          <div>
            <h3>Nationalities</h3>
            <p>Nationalities shown in the employee Nationality dropdown, and used to filter the employee list. Existing employees are not affected when you remove or rename one.</p>
          </div>
        </div>

        <ul className="settings-list">
          {nationalities.length === 0 && (
            <li className="settings-list-empty">No nationalities yet. Add one below.</li>
          )}
          {nationalities.map((nationality, idx) => (
            <li key={`${nationality}-${idx}`} className="settings-list-item">
              {editingNationalityIdx === idx ? (
                <>
                  <input
                    type="text"
                    value={editingNationalityValue}
                    onChange={(e) => setEditingNationalityValue(e.target.value)}
                    className="settings-input"
                    disabled={nationalitiesBusy}
                  />
                  <button
                    className="settings-btn settings-btn-primary settings-btn-sm"
                    onClick={saveEditNationality}
                    disabled={nationalitiesBusy || !editingNationalityValue.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={cancelEditNationality}
                    disabled={nationalitiesBusy}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="settings-list-text">{nationality}</span>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={() => startEditNationality(idx)}
                    disabled={nationalitiesBusy}
                  >
                    Rename
                  </button>
                  <button
                    className="settings-btn settings-btn-danger settings-btn-sm"
                    onClick={() => removeNationality(idx)}
                    disabled={nationalitiesBusy}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="settings-add-row">
          <input
            type="text"
            placeholder="New nationality"
            value={newNationality}
            onChange={(e) => setNewNationality(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNationality(); }}
            className="settings-input"
            disabled={nationalitiesBusy}
          />
          <button
            className="settings-btn settings-btn-primary"
            onClick={addNationality}
            disabled={nationalitiesBusy || !newNationality.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Employee Roles */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconBriefcase /></span>
          <div>
            <h3>Employee Roles</h3>
            <p>Roles shown in the employee Role dropdown, and used to filter the employee list. Existing employees are not affected when you remove or rename a role.</p>
          </div>
        </div>

        <ul className="settings-list">
          {roles.length === 0 && (
            <li className="settings-list-empty">No roles yet. Add one below.</li>
          )}
          {roles.map((role, idx) => (
            <li key={`${role}-${idx}`} className="settings-list-item">
              {editingRoleIdx === idx ? (
                <>
                  <input
                    type="text"
                    value={editingRoleValue}
                    onChange={(e) => setEditingRoleValue(e.target.value)}
                    className="settings-input"
                    disabled={rolesBusy}
                  />
                  <button
                    className="settings-btn settings-btn-primary settings-btn-sm"
                    onClick={saveEditRole}
                    disabled={rolesBusy || !editingRoleValue.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={cancelEditRole}
                    disabled={rolesBusy}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="settings-list-text">{role}</span>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={() => startEditRole(idx)}
                    disabled={rolesBusy}
                  >
                    Rename
                  </button>
                  <button
                    className="settings-btn settings-btn-danger settings-btn-sm"
                    onClick={() => removeRole(idx)}
                    disabled={rolesBusy}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="settings-add-row">
          <input
            type="text"
            placeholder="New role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addRole(); }}
            className="settings-input"
            disabled={rolesBusy}
          />
          <button
            className="settings-btn settings-btn-primary"
            onClick={addRole}
            disabled={rolesBusy || !newRole.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Water Distribution Truck Types */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconTruck /></span>
          <div>
            <h3>Water Distribution Truck Types</h3>
            <p>Truck types shown in the Water Distribution Truck Type dropdown. Existing entries are not affected when you remove or rename a type.</p>
          </div>
        </div>

        <ul className="settings-list">
          {truckTypes.length === 0 && (
            <li className="settings-list-empty">No truck types yet. Add one below.</li>
          )}
          {truckTypes.map((truckType, idx) => (
            <li key={`${truckType}-${idx}`} className="settings-list-item">
              {editingTruckTypeIdx === idx ? (
                <>
                  <input
                    type="text"
                    value={editingTruckTypeValue}
                    onChange={(e) => setEditingTruckTypeValue(e.target.value)}
                    className="settings-input"
                    disabled={truckTypesBusy}
                  />
                  <button
                    className="settings-btn settings-btn-primary settings-btn-sm"
                    onClick={saveEditTruckType}
                    disabled={truckTypesBusy || !editingTruckTypeValue.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={cancelEditTruckType}
                    disabled={truckTypesBusy}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="settings-list-text">{truckType}</span>
                  <button
                    className="settings-btn settings-btn-secondary settings-btn-sm"
                    onClick={() => startEditTruckType(idx)}
                    disabled={truckTypesBusy}
                  >
                    Rename
                  </button>
                  <button
                    className="settings-btn settings-btn-danger settings-btn-sm"
                    onClick={() => removeTruckType(idx)}
                    disabled={truckTypesBusy}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="settings-add-row">
          <input
            type="text"
            placeholder="New truck type"
            value={newTruckType}
            onChange={(e) => setNewTruckType(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTruckType(); }}
            className="settings-input"
            disabled={truckTypesBusy}
          />
          <button
            className="settings-btn settings-btn-primary"
            onClick={addTruckType}
            disabled={truckTypesBusy || !newTruckType.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {/* Migration */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconDatabase /></span>
          <div>
            <h3>Maghsal Data Migration</h3>
            <p>One-time move of existing Maghsal rows out of <code>SoldItems</code> into the new <code>maghsalEntries</code> table. A backup snapshot is saved before anything is deleted.</p>
          </div>
        </div>

        <div className="settings-current">
          <span className="settings-label">Pending:</span>
          <span className="settings-value">
            {migrationCounts
              ? `${migrationCounts.soldItems} SoldItems row(s), ${migrationCounts.products} Maghsal product(s)`
              : 'Calculating...'}
          </span>
        </div>

        {lastMigration && (
          <div className="settings-note">
            <strong>Last migration:</strong> {new Date(lastMigration.runAt).toLocaleString()} —
            {' '}{lastMigration.countMigrated ?? 0} entry(s) moved, status: {lastMigration.status}.
          </div>
        )}

        <div className="settings-actions">
          <button
            className="settings-btn settings-btn-primary"
            onClick={runMigration}
            disabled={
              migrationBusy ||
              (migrationCounts && migrationCounts.soldItems === 0 && migrationCounts.products === 0)
            }
          >
            {migrationBusy ? 'Migrating...' : 'Run Migration'}
          </button>
          <button
            className="settings-btn settings-btn-secondary"
            onClick={previewMigrationCounts}
            disabled={migrationBusy}
          >
            Recheck
          </button>
        </div>

        {migrationStatus && (
          <div className="settings-note" style={{ marginTop: 10 }}>
            {migrationStatus}
          </div>
        )}
      </div>

      {/* Customer Name Fix */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconDatabase /></span>
          <div>
            <h3>Fix Customer Names in Sold Items</h3>
            <p>Some older Sold Items rows stored the customer's Arabic name instead of English (a legacy Barcode Scanner behavior, now fixed going forward). Run this to rewrite those rows to the customer's English name.</p>
          </div>
        </div>

        <div className="settings-actions">
          <button
            className="settings-btn settings-btn-primary"
            onClick={runCustomerNameFix}
            disabled={nameFixBusy}
          >
            {nameFixBusy ? 'Fixing...' : 'Fix Customer Names'}
          </button>
        </div>

        {nameFixStatus && (
          <div className="settings-note" style={{ marginTop: 10 }}>
            {nameFixStatus}
          </div>
        )}
      </div>

      {/* Archive & Reset */}
      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-card-header">
          <span className="settings-card-icon"><IconDatabase /></span>
          <div>
            <h3>Archive & Reset</h3>
            <p>Administrative reset actions are kept here so they are not exposed in daily Products or Stock workflows.</p>
          </div>
        </div>

        <div className="settings-note">
          These actions create archive snapshots before resetting. Use them only when closing a stock cycle.
        </div>

        <div className="settings-actions">
          <button
            className="settings-btn settings-btn-danger"
            onClick={archiveProductsAndResetQuantities}
            disabled={productArchiveBusy || stockArchiveBusy}
          >
            {productArchiveBusy ? 'Archiving Products...' : 'Archive Products & Reset Qty'}
          </button>
          <button
            className="settings-btn settings-btn-danger"
            onClick={archiveStockAndResetAll}
            disabled={productArchiveBusy || stockArchiveBusy}
          >
            {stockArchiveBusy ? 'Archiving Stock...' : 'Archive Stock Data & Reset All'}
          </button>
        </div>
      </div>

      {message && <div className="settings-success">{message}</div>}
      {error && <div className="settings-error">{error}</div>}
    </div>
  );
};

export default Settings;
