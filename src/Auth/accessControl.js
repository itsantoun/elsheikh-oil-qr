import { ref, get } from 'firebase/database';
import { database } from './firebase';

// Bootstrap allowlist. Used until Firebase custom claims (auth.token.admin === true)
// are set on real admins. Once claims are configured, set REACT_APP_ADMIN_EMAILS=""
// in .env to disable this path entirely.
const DEFAULT_BOOTSTRAP_ADMINS = 'doris@elsheikh.lb';

// Optional: require firebaseUser.emailVerified before honoring the allowlist.
// Defaults to false because email verification is not yet enforced project-wide.
// Flip to "true" in .env once verification is enabled.
const REQUIRE_VERIFIED_EMAIL_FOR_ALLOWLIST =
  String(process.env.REACT_APP_REQUIRE_VERIFIED_ADMIN || 'false').toLowerCase() === 'true';

const parseAdminEmails = () => {
  const configured = process.env.REACT_APP_ADMIN_EMAILS;
  // Empty string = explicitly disabled. Unset = use default.
  const source = configured === undefined ? DEFAULT_BOOTSTRAP_ADMINS : configured;
  return source
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

export const isAllowlistedAdminEmail = (email) => {
  if (!email) return false;
  return parseAdminEmails().includes(String(email).trim().toLowerCase());
};

export const normalizeRole = (role) => {
  return String(role || '').toLowerCase() === 'admin' ? 'admin' : 'user';
};

export const normalizeStatus = (status) => {
  return String(status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
};

const getUserProfile = async (uid) => {
  if (!uid) return null;
  try {
    const snapshot = await get(ref(database, `users/${uid}`));
    if (!snapshot.exists()) return null;
    return snapshot.val();
  } catch (error) {
    console.error('Failed to read user profile from database:', error);
    return null;
  }
};

/**
 * Source of truth for admin role:
 *   1. Firebase custom claim `admin === true` (set server-side via Admin SDK) — WINS.
 *   2. Bootstrap allowlist in REACT_APP_ADMIN_EMAILS — until claims are set.
 *
 * The `role` field stored in the DB is DISPLAY ONLY. It is NEVER used to grant
 * privileges, because a malicious user could try to write it directly.
 * Database Rules must additionally restrict `users/$uid/role` writes to admins.
 *
 * The DB profile is consulted for `status` (active / inactive) so admins can
 * deactivate accounts without revoking the Firebase user.
 */
export const resolveUserAccess = async (firebaseUser) => {
  if (!firebaseUser) {
    return { role: 'user', status: 'inactive' };
  }

  let role = 'user';
  let status = 'active';

  // 1. Custom claim — authoritative when present.
  try {
    const token = await firebaseUser.getIdTokenResult();
    if (token?.claims?.admin === true) {
      role = 'admin';
    }
  } catch (error) {
    console.error('Failed to read auth token claims:', error);
  }

  // 2. Bootstrap allowlist — applies whether or not a DB profile exists, so
  //    the original admin can still sign in before custom claims are wired up.
  if (role !== 'admin' && isAllowlistedAdminEmail(firebaseUser.email)) {
    if (!REQUIRE_VERIFIED_EMAIL_FOR_ALLOWLIST || firebaseUser.emailVerified) {
      role = 'admin';
    }
  }

  // 3. DB profile contributes STATUS only. Role from DB is ignored for auth.
  const profile = await getUserProfile(firebaseUser.uid);
  if (profile) {
    status = normalizeStatus(profile.status);
  }

  return { role, status };
};

export const resolveUserRole = async (firebaseUser) => {
  const access = await resolveUserAccess(firebaseUser);
  return access.role;
};

export const resolveAdminAccess = async (firebaseUser) => {
  const access = await resolveUserAccess(firebaseUser);
  return access.role === 'admin' && access.status === 'active';
};
