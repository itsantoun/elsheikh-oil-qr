import { ref, push, update, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { database, auth } from '../Auth/firebase';

// Activity log: one entry per change, at activityLog/{pushId}. The database
// rules make it append-only — entries can be added but never edited or
// deleted — and only admins can read it (Dashboard card + Activity Log page).
//
// Entry: { at, by, byUid, section, action, summary, details? }
//   section  — 'Customers', 'Water Distribution', 'Oil / Filter', …
//   action   — 'Added', 'Edited', 'Renamed', 'Deleted', 'Restored',
//              'Deleted forever', 'Bulk status', 'Bulk comment', …
//   summary  — one readable line ("Renamed customer Jad Bayada → Jad Bittar")
//   details  — anything worth showing in the popup: { changes: { field:
//              { from, to } }, records: [ … ], … }

// The signed-in person's profile name (users/{uid}/name), looked up once per
// sign-in — some pages only have the Firebase account, which has no name.
const profileNames = {};
onAuthStateChanged(auth, async (u) => {
  if (!u || profileNames[u.uid] !== undefined) return;
  try {
    profileNames[u.uid] = (await get(ref(database, `users/${u.uid}/name`))).val() || '';
  } catch {
    profileNames[u.uid] = '';
  }
});

export const userLabel = (user) => user?.name
  || profileNames[auth.currentUser?.uid]
  || user?.displayName || user?.email || auth.currentUser?.email || 'Unknown';

// Firebase rejects undefined values and these characters in keys.
const clean = (value) => {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clean);
  const out = {};
  Object.entries(value).forEach(([k, v]) => {
    if (v === undefined) return;
    out[String(k).replace(/[.#$/[\]]/g, '_')] = clean(v);
  });
  return out;
};

const buildEntry = (user, { section, action, summary, details }) => clean({
  at: new Date().toISOString(),
  by: userLabel(user),
  // Must be the signed-in account — the rules reject anything else.
  byUid: auth.currentUser?.uid || user?.uid || '',
  section,
  action,
  summary: String(summary || '').slice(0, 480),
  ...(details ? { details } : {}),
});

// { path: entry } to merge into an update(ref(database), …) — the change and
// its log entry are then written together, or not at all.
export const activityUpdate = (user, entry) => {
  const key = push(ref(database, 'activityLog')).key;
  return { [`activityLog/${key}`]: buildEntry(user, entry) };
};

// For writes that can't take part in a multi-path update. A failure to log
// never breaks the action itself.
export const logActivity = async (user, entry) => {
  try {
    await update(ref(database), activityUpdate(user, entry));
  } catch (err) {
    console.error('Activity log write failed:', err);
  }
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// { field: { from, to } } for the fields of `after` whose value differs from
// `before`. Bookkeeping fields are left out.
const IGNORED = new Set(['id', 'updatedAt', 'createdAt', 'loggedBy', 'loggedByUid', 'stockAdjusted']);
export const fieldChanges = (before = {}, after = {}) => {
  const changes = {};
  Object.keys(after || {}).forEach((k) => {
    if (IGNORED.has(k)) return;
    if (!same(before?.[k], after[k])) changes[k] = { from: before?.[k] ?? null, to: after[k] ?? null };
  });
  return changes;
};

// "2 fields: Status Unpaid → Paid, Quantity 1 → 2" — short form for summaries.
export const describeChanges = (changes, limit = 3) => {
  const keys = Object.keys(changes || {});
  if (keys.length === 0) return 'no changes';
  const fmt = (v) => (v === null || v === '' ? '—' : typeof v === 'object' ? '…' : String(v));
  const parts = keys.slice(0, limit).map((k) => `${k} ${fmt(changes[k].from)} → ${fmt(changes[k].to)}`);
  return parts.join(', ') + (keys.length > limit ? ` (+${keys.length - limit} more)` : '');
};

// "Maroun Khoury, Sigma 20/50, 12-09-2026" — which record, for summaries.
export const recordLabel = (r) => {
  const d = new Date(r?.date || r?.dateScanned);
  const day = isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  return [String(r?.customerName || '').trim() || 'No customer', r?.name, day].filter(Boolean).join(', ');
};

// Saves a new entry (no `id`) or the changed fields of an existing one, in
// the same write as its log entry. `before` is the entry as it was, for the
// before → after detail. Returns the entry's id.
export const saveEntryWithLog = async (user, { collection, section, id, before, data }) => {
  if (!id) {
    const key = push(ref(database, collection)).key;
    await update(ref(database), {
      [`${collection}/${key}`]: data,
      ...activityUpdate(user, {
        section,
        action: 'Added',
        summary: `Added ${section} entry — ${recordLabel(data)}`,
        details: { collection, id: key, record: data },
      }),
    });
    return key;
  }
  const updates = {};
  Object.entries(data).forEach(([k, v]) => { updates[`${collection}/${id}/${k}`] = v === undefined ? null : v; });
  const changes = fieldChanges(before, data);
  if (Object.keys(changes).length > 0) {
    Object.assign(updates, activityUpdate(user, {
      section,
      action: 'Edited',
      summary: `Edited ${section} entry — ${recordLabel({ ...before, ...data })}: ${describeChanges(changes)}`,
      details: { collection, id, changes },
    }));
  }
  await update(ref(database), updates);
  return id;
};

// ── Sessions & navigation ─────────────────────────────────────────────

// The signed-in person as the log shows them: their profile name, or email.
const signedInUser = async () => {
  const u = auth.currentUser;
  if (!u) return null;
  if (profileNames[u.uid] === undefined) {
    try {
      profileNames[u.uid] = (await get(ref(database, `users/${u.uid}/name`))).val() || '';
    } catch {
      profileNames[u.uid] = '';
    }
  }
  return { name: profileNames[u.uid] || u.email || 'Unknown', uid: u.uid };
};

// "Logged in" / "Logged out" (await it before signing out — after that the
// write is no longer allowed).
export const logSession = async (action, note = '') => {
  const u = await signedInUser();
  if (!u) return;
  await logActivity(u, { section: 'Logins', action, summary: `${u.name} ${action.toLowerCase()}${note ? ` (${note})` : ''}` });
};

// "Opened <page>". A repeat of the same page within a few minutes (refresh,
// back and forth) isn't logged again.
const REPEAT_MS = 5 * 60 * 1000;
export const logPageVisit = async (user, pageLabel) => {
  const key = `lastVisit:${auth.currentUser?.uid || ''}`;
  try {
    const last = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (last && last.page === pageLabel && Date.now() - last.at < REPEAT_MS) return;
    sessionStorage.setItem(key, JSON.stringify({ page: pageLabel, at: Date.now() }));
  } catch { /* storage unavailable — log anyway */ }
  const who = user?.name ? user : (await signedInUser()) || user;
  await logActivity(who, { section: 'Navigation', action: 'Visited', summary: `${userLabel(who)} opened ${pageLabel}` });
};

// Looking at or taking data out (logins, page visits, viewing a report,
// exporting, printing) — kept off the Dashboard's Recent Activity card,
// which shows changes only; all of it is on the Activity Log page.
const PRIVATE_SECTIONS = new Set(['Logins', 'Navigation']);
const PRIVATE_ACTIONS = new Set(['Viewed', 'Exported', 'Printed']);
export const isPrivateActivity = (e) => PRIVATE_SECTIONS.has(e?.section) || PRIVATE_ACTIONS.has(e?.action);

// "Exported PDF of …" / "Printed …".
export const logExport = (user, section, what, format, print = false) => logActivity(user, {
  section,
  action: print ? 'Printed' : 'Exported',
  summary: print ? `Printed ${what}` : `Exported ${what} as ${format}`,
});
