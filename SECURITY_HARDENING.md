# Security Hardening Checklist

This project now removes plaintext password handling in the UI and uses a safer invite flow.
For production-grade security, complete the server-side items below.

## 1) Enforce admin via custom claims

- Set admin users with Firebase Admin SDK:
  - `auth.setCustomUserClaims(uid, { admin: true })`
- In app data, keep role values strict: `admin` or `user` only.
- Configure `REACT_APP_ADMIN_EMAILS` only as fallback during migration.
- Prefer claims over email checks.

## 2) Lock down Realtime Database Rules

Use strict rules in Firebase Console and adapt them to your exact business permissions.

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "false",

    "users": {
      "$uid": {
        ".read": "auth.token.admin === true || auth.uid === $uid",
        ".write": "auth.token.admin === true"
      }
    },

    "products": {
      ".read": "auth != null",
      ".write": "auth.token.admin === true"
    },

    "heldProducts": {
      ".read": "auth != null",
      ".write": "auth.token.admin === true"
    },

    "customers": {
      ".read": "auth != null",
      ".write": "auth.token.admin === true"
    },

    "productArchives": {
      ".read": "auth.token.admin === true",
      ".write": "auth.token.admin === true"
    },

    "stockArchives": {
      ".read": "auth.token.admin === true",
      ".write": "auth.token.admin === true"
    },

    "stockChecks": {
      ".read": "auth != null",
      ".write": "auth.token.admin === true"
    },

    "stockCheckHistory": {
      ".read": "auth != null",
      ".write": "auth.token.admin === true"
    },

    "SoldItems": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "transactions": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

## 3) Move privileged actions to backend

Do not delete Auth users from client-side code.
Use HTTPS Callable Cloud Functions with Admin SDK for:

- deleting users
- assigning roles
- critical archive/reset operations

## 4) Security operations

- Rotate Firebase API keys and audit exposed credentials.
- Enable Firebase App Check for abuse resistance.
- Enable Firebase Auth protections:
  - email verification
  - MFA for admins
  - password policy
- Add CI checks:
  - `npm audit --production`
  - secret scanning
  - dependency update automation
