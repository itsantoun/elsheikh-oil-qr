import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import '../CSS/notifications.css';

const noop = () => {};

const NotificationContext = createContext({
  notifySuccess: noop,
  notifyError: noop,
  notifyInfo: noop,
  removeNotification: noop,
});

let idCounter = 0;

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef(new Map());

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pushNotification = useCallback((type, message, duration = 3000) => {
    if (!message) return;
    const id = `notif_${Date.now()}_${idCounter += 1}`;
    setNotifications((prev) => [...prev, { id, type, message }]);
    const timer = setTimeout(() => {
      removeNotification(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, [removeNotification]);

  const notifySuccess = useCallback((message, duration = 3000) => {
    pushNotification('success', message, duration);
  }, [pushNotification]);

  const notifyError = useCallback((message, duration = 3500) => {
    pushNotification('error', message, duration);
  }, [pushNotification]);

  const notifyInfo = useCallback((message, duration = 2500) => {
    pushNotification('info', message, duration);
  }, [pushNotification]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({
    notifySuccess,
    notifyError,
    notifyInfo,
    removeNotification,
  }), [notifySuccess, notifyError, notifyInfo, removeNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="toast-root">
        {notifications.map((item) => (
          <div key={item.id} className={`toast-item toast-${item.type}`}>
            <span className="toast-message">{item.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeNotification(item.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
