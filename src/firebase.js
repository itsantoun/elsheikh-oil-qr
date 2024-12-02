import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBQjqqL0ybmRagirvA1IvMlPizcEHPBFwA",
  authDomain: "elsheikh-qr-codes-db.firebaseapp.com",
  databaseURL: "https://elsheikh-qr-codes-db-default-rtdb.firebaseio.com",
  projectId: "elsheikh-qr-codes-db",
  storageBucket: "elsheikh-qr-codes-db.appspot.com",
  messagingSenderId: "1097767368146",
  appId: "1:1097767368146:web:e72b54d37f02f758a2840b"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);