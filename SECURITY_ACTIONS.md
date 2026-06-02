# SECURITY_ACTIONS.md — what's done and what YOU must still do

This codebase is a static React + Firebase app deployed to GitHub Pages. The
client bundle is public by design — the API key in `.env` is meant to be
public. Everything that actually keeps the app safe lives in the
**Firebase Console** (rules, claims, App Check). The list below is the
remaining manual work.

---

## ✅ Done in this commit (code-level hardening)

| # | Change | File |
|---|---|---|
| 1 | Admin role is now **claim-only**. The DB `role` field is no longer trusted for authorization — only `auth.token.admin === true` grants admin. | `src/Auth/accessControl.js` |
| 2 | Bootstrap admin allowlist requires `emailVerified === true`. | `src/Auth/accessControl.js` |
| 3 | Strict production Database Rules written (admin-claim gated). | `database.rules.json` |
| 4 | Content-Security-Policy + X-Content-Type-Options + Referrer-Policy + Permissions-Policy added. | `public/index.html` |
| 5 | 30-minute idle auto-logout. | `src/Auth/useIdleLogout.js`, wired in `src/App.js` |
| 6 | Email format validation + length caps (254/120/128) on login & add-user. | `src/Auth/validators.js`, `src/Pages/login.js`, `src/Admin/adduser.js` |
| 7 | Stronger password rule: ≥8 chars, letters + digits. | `src/Auth/validators.js`, `src/Admin/adduser.js` |
| 8 | Login button disables during submit (no double-submit, slows credential spraying). | `src/Pages/login.js` |
| 9 | Generic login error message (no enumeration). | `src/Pages/login.js` |
| 10 | Audit confirmed: no `dangerouslySetInnerHTML`, no `eval`, no `innerHTML`, no committed `.env`. | repo |

---

## 🔴 YOU MUST DO THIS — without it, the app is still wide open

### 1. Paste the new Database Rules into Firebase Console

1. Open the [Firebase Console → Realtime Database → Rules](https://console.firebase.google.com/project/elsheikh-qr-codes-db/database/elsheikh-qr-codes-db-default-rtdb/rules).
2. Copy the entire contents of [`database.rules.json`](database.rules.json) into the editor.
3. Click **Publish**.

Until you do this, **anyone on the internet who reads the JS bundle can read/write your entire database.** This is the single most important step.

### 2. Set the admin custom claim on the real admin user(s)

The new code only grants admin if `auth.token.admin === true`. You set that
with the Admin SDK — there is no UI for it. Easiest path:

```bash
# Once-off Node script. Run from a trusted machine, never check the JSON in.
# Get the service account JSON from Firebase Console → Project Settings → Service Accounts.
npm install firebase-admin
```

```js
// grant-admin.js
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./service-account.json')) });

(async () => {
  const email = 'doris@elsheikh.lb';            // <-- the admin you want
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log('Admin claim set on', email);
})();
```

```bash
node grant-admin.js
```

After running, the admin must **sign out and sign back in** to pick up the
new claim in their token.

### 3. Enable Firebase App Check

Without App Check, anyone can hit your DB/Auth from outside the browser app
(curl, scripts, automation). With App Check, only requests from your real
app pass.

1. [Firebase Console → App Check](https://console.firebase.google.com/project/elsheikh-qr-codes-db/appcheck).
2. Register the web app with **reCAPTCHA v3** (free).
3. Enforce App Check on **Realtime Database** and **Authentication**.
4. Add the App Check init snippet to `src/Auth/firebase.js` (Firebase will
   give you the exact code). Tell me when you have the reCAPTCHA site key and
   I will wire it in.

### 4. Clear the bootstrap admin email after step 2

Once the custom claim is set on Doris, remove the fallback:

```bash
# In .env
REACT_APP_ADMIN_EMAILS=
```

Then rebuild and redeploy. This closes the bootstrap path entirely.

### 5. Rotate the Firebase API key (optional but recommended)

The current key has been visible in the public bundle for the lifetime of
the deploy. Rotating it limits damage from any cached/abused copies.
[Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=elsheikh-qr-codes-db).
After rotation, add HTTP referrer restrictions to the new key
(`https://itsantoun.github.io/elsheikh-oil-qr/*` and `http://localhost:3000/*`).

### 6. Enable email verification + (optionally) MFA

In [Firebase Console → Authentication → Settings → User actions](https://console.firebase.google.com/project/elsheikh-qr-codes-db/authentication/settings):
- Require email verification before sign-in for new users.
- Turn on MFA enrollment for admin accounts.

### 7. (Long-term) Move privileged ops to Cloud Functions

These currently run client-side. Moving them to HTTPS Callable Functions
that verify `context.auth.token.admin === true` makes them tamper-proof:

- Creating users with `createUserWithEmailAndPassword` ([src/Admin/adduser.js:78](src/Admin/adduser.js#L78))
- Toggling user `status` ([src/Admin/adduser.js:148](src/Admin/adduser.js#L148))
- Updating user `role` ([src/Admin/adduser.js:187](src/Admin/adduser.js#L187))
- Mass archive/reset operations in [src/Admin/remainingProducts.js](src/Admin/remainingProducts.js) and [src/Admin/fetchProducts.js](src/Admin/fetchProducts.js)

The DB rules in step 1 already block non-admins, but Functions add a second
layer and let you set claims atomically.

---

## ℹ️ Notes

- **`npm audit` reports 38 vulnerabilities.** All 38 are in the `react-scripts`
  build toolchain (`webpack-dev-server`, `sockjs`, `bfj`, `ws`, etc.). **None
  ship to users' browsers.** Do NOT run `npm audit fix --force` — it
  downgrades `react-scripts` to `0.0.0` and bricks the build. The proper fix
  is migrating from Create React App to Vite, which is a separate project.

- **GitHub Pages cannot set real HTTP headers.** The CSP added via `<meta
  http-equiv>` is honored by browsers but a couple of directives
  (`frame-ancestors`, `X-Frame-Options`, HSTS) can only be set as real
  response headers. If you ever move the site behind Cloudflare/Netlify,
  add those there too.

- **DDoS:** GitHub Pages absorbs static-asset DDoS itself. Your real DDoS
  surface is the Firebase free-tier quota — once App Check is enforced (step 3)
  it's much harder to burn through it from outside the browser.

- **Backups:** The strict rules in [database.rules.json](database.rules.json)
  block all reads/writes by default. Confirm the existing app still works
  after publishing (especially the barcode-scanner write paths to
  `transactions` and `SoldItems`) and adjust per-path rules if any breakage
  appears.
