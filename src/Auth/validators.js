// Centralized input validation. Keep limits tight — these are the only client-
// side guards before DB writes; Database Rules also re-validate length/shape.

export const MAX_EMAIL_LEN = 254;
export const MAX_NAME_LEN = 120;
export const MAX_PASSWORD_LEN = 128;
export const MIN_PASSWORD_LEN = 8;

// Conservative RFC-5322-ish email shape. Not perfect, but blocks obvious junk.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (raw) => {
  if (typeof raw !== 'string') return false;
  const v = raw.trim();
  return v.length > 0 && v.length <= MAX_EMAIL_LEN && EMAIL_RE.test(v);
};

export const isValidName = (raw) => {
  if (typeof raw !== 'string') return false;
  const v = raw.trim();
  return v.length > 0 && v.length <= MAX_NAME_LEN;
};

/**
 * Strong-enough password: 8-128 chars, at least one letter and one digit.
 * Firebase Auth enforces uniqueness/strength on its side too; this is the
 * client-side gate.
 */
export const validatePassword = (raw) => {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Password is required.' };
  }
  if (raw.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  }
  if (raw.length > MAX_PASSWORD_LEN) {
    return { ok: false, error: 'Password is too long.' };
  }
  if (!/[A-Za-z]/.test(raw) || !/[0-9]/.test(raw)) {
    return { ok: false, error: 'Password must contain at least one letter and one number.' };
  }
  return { ok: true };
};
