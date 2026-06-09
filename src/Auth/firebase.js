import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// App Check — only initialized when a reCAPTCHA v3 site key is configured.
// Once you register the app at Firebase Console → App Check, paste the site key
// into .env as REACT_APP_RECAPTCHA_SITE_KEY and redeploy. Until that's set,
// the app runs without App Check (so the bootstrap deploy doesn't break).
const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  // Debug token for localhost development. Without this, App Check rejects
  // requests from `npm start` because reCAPTCHA v3 only honors registered
  // production domains. Generate a debug token in Firebase Console → App Check
  // → Apps → ⋮ → Manage debug tokens.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-restricted-globals
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    console.log('App Check initialized.');
  } catch (error) {
    console.error('App Check init failed:', error);
  }
} else {
  console.warn(
    'App Check is NOT initialized — set REACT_APP_RECAPTCHA_SITE_KEY in .env to enable abuse protection.'
  );
}

const auth = getAuth(app);
const persistenceMode = (process.env.REACT_APP_AUTH_PERSISTENCE || 'session').toLowerCase();
const selectedPersistence = persistenceMode === 'local'
  ? browserLocalPersistence
  : browserSessionPersistence;

export const setAuthPersistenceForRememberMe = (rememberMe) =>
  setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

// Default to session persistence for safer shared-device behavior.
setPersistence(auth, selectedPersistence)
  .then(() => {
    console.log(`Persistence set to ${persistenceMode === 'local' ? 'local' : 'session'}`);
  })
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

export const database = getDatabase(app);
export { app, auth };
