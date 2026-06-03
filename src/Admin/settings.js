import React, { useEffect, useState } from 'react';
import {
  isFileSystemAccessSupported,
  getSavedExportFolderName,
  pickExportFolder,
  clearExportFolder,
} from '../utils/exportFolder';
import '../CSS/settings.css';

const IconFolder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2a2 2 0 0 0-1.66-.9H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const Settings = () => {
  const [folderName, setFolderName] = useState(null);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const supportedNow = isFileSystemAccessSupported();
    setSupported(supportedNow);
    if (supportedNow) {
      getSavedExportFolderName().then(setFolderName);
    }
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

  const handlePick = async () => {
    setBusy(true);
    try {
      const name = await pickExportFolder();
      setFolderName(name);
      flashMessage(`Export folder set to "${name}". Future PDF and CSV exports will save there.`);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // user cancelled the picker
      } else if (err && err.message === 'FILE_SYSTEM_ACCESS_UNSUPPORTED') {
        flashError('Your browser does not support choosing an export folder. Try Chrome, Edge, or Brave.');
      } else if (err && err.message === 'PERMISSION_DENIED') {
        flashError('Permission to write to the folder was denied.');
      } else {
        flashError('Could not set the export folder.');
        console.error(err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await clearExportFolder();
      setFolderName(null);
      flashMessage('Export folder cleared. Future exports will use the browser download.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p className="settings-subtitle">Configure where exports (PDF & CSV) are saved.</p>
      </div>

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
            disabled={!supported || busy}
          >
            {folderName ? 'Change Folder' : 'Choose Folder'}
          </button>
          {folderName && (
            <button
              className="settings-btn settings-btn-secondary"
              onClick={handleClear}
              disabled={busy}
            >
              Clear
            </button>
          )}
        </div>

        {message && <div className="settings-success">{message}</div>}
        {error && <div className="settings-error">{error}</div>}

      </div>
    </div>
  );
};

export default Settings;
