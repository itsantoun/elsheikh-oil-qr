// import { initializeApp } from "firebase/app";
// import { getDatabase } from "firebase/database";
// import { getAuth } from "firebase/auth";

// const firebaseConfig = {
//   apiKey: "AIzaSyBQjqqL0ybmRagirvA1IvMlPizcEHPBFwA",
//   authDomain: "elsheikh-qr-codes-db.firebaseapp.com",
//   databaseURL: "https://elsheikh-qr-codes-db-default-rtdb.firebaseio.com",
//   projectId: "elsheikh-qr-codes-db",
//   storageBucket: "elsheikh-qr-codes-db.appspot.com",
//   messagingSenderId: "1097767368146",
//   appId: "1:1097767368146:web:e72b54d37f02f758a2840b"
// };

// const app = initializeApp(firebaseConfig);
// export const database = getDatabase(app);
// export const auth = getAuth(app);

import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Make sure you're using the correct environment variables
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
export const database = getDatabase(app);
export const auth = getAuth(app);