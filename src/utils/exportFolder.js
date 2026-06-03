// Manages the user-chosen default export folder using the File System Access API.
// The directory handle is persisted in IndexedDB (it is not JSON-serializable, so
// localStorage cannot be used).

const DB_NAME = 'elsheikh-export-settings';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'exportFolderHandle';

export const isFileSystemAccessSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.showDirectoryPicker === 'function';

const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async (mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const getStoredHandle = () =>
  withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }).then((p) => p);

const setStoredHandle = (handle) =>
  withStore('readwrite', (store) => store.put(handle, HANDLE_KEY));

const deleteStoredHandle = () =>
  withStore('readwrite', (store) => store.delete(HANDLE_KEY));

// Verify we still have (or can re-request) write permission on the saved handle.
const ensureWritePermission = async (handle) => {
  if (!handle || typeof handle.queryPermission !== 'function') return false;
  const opts = { mode: 'readwrite' };
  let status = await handle.queryPermission(opts);
  if (status === 'granted') return true;
  status = await handle.requestPermission(opts);
  return status === 'granted';
};

export const getSavedExportFolder = async () => {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const handle = await getStoredHandle();
    if (!handle) return null;
    return handle;
  } catch {
    return null;
  }
};

export const getSavedExportFolderName = async () => {
  const handle = await getSavedExportFolder();
  return handle ? handle.name : null;
};

export const pickExportFolder = async () => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('FILE_SYSTEM_ACCESS_UNSUPPORTED');
  }
  const handle = await window.showDirectoryPicker({
    id: 'elsheikh-export-folder',
    mode: 'readwrite',
    startIn: 'documents',
  });
  const granted = await ensureWritePermission(handle);
  if (!granted) {
    throw new Error('PERMISSION_DENIED');
  }
  await setStoredHandle(handle);
  return handle.name;
};

export const clearExportFolder = async () => {
  try {
    await deleteStoredHandle();
  } catch {
    /* ignore */
  }
};

// Fallback: traditional anchor-download.
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Save a Blob to the chosen folder if one is configured & permission still valid.
// Falls back to a normal browser download otherwise. Returns the strategy used.
export const saveBlobToExportFolder = async (blob, filename) => {
  if (isFileSystemAccessSupported()) {
    try {
      const handle = await getSavedExportFolder();
      if (handle && (await ensureWritePermission(handle))) {
        const fileHandle = await handle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { strategy: 'folder', folderName: handle.name, filename };
      }
    } catch (err) {
      console.warn('Saving to chosen export folder failed, falling back to download:', err);
    }
  }
  downloadBlob(blob, filename);
  return { strategy: 'download', filename };
};
