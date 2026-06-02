import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/**
 * Signs the current user out after a period of inactivity. Mounted once at the
 * app root. Uses a throttled timer reset so high-frequency events (scroll) do
 * not thrash setTimeout.
 */
export const useIdleLogout = (timeoutMs = DEFAULT_TIMEOUT_MS) => {
  useEffect(() => {
    let timer = null;
    let lastActivity = Date.now();

    const handleLogout = async () => {
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (error) {
          console.error('Idle logout failed:', error);
        }
      }
    };

    const resetTimer = () => {
      const now = Date.now();
      // Throttle: only reset if 1s+ since last activity.
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(handleLogout, timeoutMs);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, resetTimer, { passive: true });
    });

    return () => {
      if (timer) clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, resetTimer);
      });
    };
  }, [timeoutMs]);
};
