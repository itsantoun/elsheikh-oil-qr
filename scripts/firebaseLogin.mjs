// Shared by the scripts in this folder: reads the Firebase config from .env,
// asks for an app login and returns the database.

import fs from 'node:fs';
import readline from 'node:readline';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n')
  .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]));

export const ask = (q, hidden = false) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
  rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
});

export const login = async () => {
  const app = initializeApp({
    apiKey: env.REACT_APP_FIREBASE_API_KEY,
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID,
    appId: env.REACT_APP_FIREBASE_APP_ID,
  });
  await signInWithEmailAndPassword(getAuth(app), await ask('Email: '), await ask('Password: ', true));
  return getDatabase(app);
};
