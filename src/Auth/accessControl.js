import { ref, get } from 'firebase/database';
import { database } from './firebase';

// Optional extra allowlist, off by default — set REACT_APP_ADMIN_EMAILS in
// .env (comma-separated) if you ever need to grant admin by email alone
// (e.g. before that account has a DB profile at all). The normal path is
// the `role: 'admin'` field on the user's DB profile (see resolveUserAccess
// below) or a Firebase custom claim; this is not required for either.
const DEFAULT_BOOTSTRAP_ADMINS = '';

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
 * Source of truth for admin role, in order:
 *   1. Firebase custom claim `admin === true` (set server-side via Admin SDK) — WINS.
 *   2. Bootstrap allowlist in REACT_APP_ADMIN_EMAILS — opt-in, empty by default.
 *   3. The `role: 'admin'` field on the user's DB profile (users/$uid/role).
 *
 * Trusting the DB `role` field here is safe *because* Database Rules
 * independently restrict who can write users/$uid/role to admins only (see
 * database.rules.json) — a regular user cannot self-promote by writing it
 * directly, since that write itself needs one of these same three checks
 * to already pass. An account is bootstrapped into admin either via a
 * custom claim, the allowlist, or by an existing DB-role admin promoting
 * them from the Users page.
 *
 * The DB profile also contributes `status` (active / inactive) so admins
 * can deactivate accounts without revoking the Firebase user.
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

  // 2. Bootstrap allowlist — opt-in via REACT_APP_ADMIN_EMAILS, empty by default.
  if (role !== 'admin' && isAllowlistedAdminEmail(firebaseUser.email)) {
    if (!REQUIRE_VERIFIED_EMAIL_FOR_ALLOWLIST || firebaseUser.emailVerified) {
      role = 'admin';
    }
  }

  // 3. DB profile — role AND status.
  const profile = await getUserProfile(firebaseUser.uid);
  if (profile) {
    status = normalizeStatus(profile.status);
    if (role !== 'admin' && normalizeRole(profile.role) === 'admin' && status === 'active') {
      role = 'admin';
    }
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
