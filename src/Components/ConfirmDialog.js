import React, { useCallback, useRef, useState } from 'react';

/**
 * Shared delete/action confirmation modal, reusing the .modal-overlay/.modal
 * markup already styled across the admin pages.
 *
 * const [confirm, confirmDialog] = useConfirmDialog();
 * ...
 * if (!(await confirm({ title: 'Delete User?', message: '...' }))) return;
 * ...
 * return <div>...{confirmDialog}</div>;
 */
export function useConfirmDialog() {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options || {};
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest(opts);
    });
  }, []);

  const settle = (result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  };

  const confirmDialog = request && (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{request.title || 'Confirm Deletion'}</h3>
        </div>
        <div className="modal-content">
          {typeof request.message === 'string' ? <p>{request.message}</p> : request.message}
        </div>
        <div className="modal-footer">
          <button
            className={request.danger === false ? 'btn-primary' : 'btn-danger'}
            onClick={() => settle(true)}
          >
            {request.confirmLabel || 'Yes, Delete'}
          </button>
          <button className="btn-secondary" onClick={() => settle(false)}>
            {request.cancelLabel || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );

  return [confirm, confirmDialog];
}
