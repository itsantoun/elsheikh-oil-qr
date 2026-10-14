import { ref, get, update } from 'firebase/database';
import { database } from '../Auth/firebase';
import { activityUpdate, recordLabel } from './activityLog';

// Deleting a record moves it to trash/{collection}/{id} (with who deleted it
// and when) instead of destroying it, so an admin can restore it from the
// Trash page. The database rules only accept a delete of these records when
// the same write puts the copy in trash.
export const TRASH_SECTIONS = {
  waterDistributionEntries: 'Water Distribution',
  waterFillingEntries: 'Water Filling',
  maghsalEntries: 'Maghsal',
  SoldItems: 'Oil / Filter',
};

const userLabel = (user) => user?.name || user?.displayName || user?.email || 'Unknown';

// Moves one record to trash in a single atomic write. The record is read
// fresh from the database, so the copy is exactly what was stored (not the
// page's display version of it).
export const moveToTrash = async (collection, id, user) => {
  const snap = await get(ref(database, `${collection}/${id}`));
  if (!snap.exists()) throw new Error('This record no longer exists.');
  const record = snap.val();
  const section = TRASH_SECTIONS[collection] || collection;
  await update(ref(database), {
    [`${collection}/${id}`]: null,
    [`trash/${collection}/${id}`]: {
      record,
      deletedAt: new Date().toISOString(),
      deletedBy: userLabel(user),
      deletedByUid: user?.uid || '',
    },
    ...activityUpdate(user, {
      section,
      action: 'Deleted',
      summary: `Deleted ${section} entry — ${recordLabel(record)} (moved to Trash)`,
      details: { collection, id, record },
    }),
  });
};

// Puts a trashed record back at its original id, exactly as it was.
export const restoreFromTrash = async (collection, id, user) => {
  const [trashSnap, liveSnap] = await Promise.all([
    get(ref(database, `trash/${collection}/${id}`)),
    get(ref(database, `${collection}/${id}`)),
  ]);
  if (!trashSnap.exists()) throw new Error('This item is no longer in Trash.');
  if (liveSnap.exists()) throw new Error('A record with this id already exists — it was restored already.');
  const { record, deletedBy, deletedAt } = trashSnap.val();
  const section = TRASH_SECTIONS[collection] || collection;
  await update(ref(database), {
    [`${collection}/${id}`]: record,
    [`trash/${collection}/${id}`]: null,
    ...activityUpdate(user, {
      section,
      action: 'Restored',
      summary: `Restored ${section} entry from Trash — ${recordLabel(record)}`,
      details: { collection, id, record, deletedBy, deletedAt },
    }),
  });
};

export const deleteForever = async (collection, id, user) => {
  const snap = await get(ref(database, `trash/${collection}/${id}`));
  const { record, deletedBy, deletedAt } = snap.exists() ? snap.val() : {};
  const section = TRASH_SECTIONS[collection] || collection;
  await update(ref(database), {
    [`trash/${collection}/${id}`]: null,
    ...activityUpdate(user, {
      section,
      action: 'Deleted forever',
      summary: `Permanently deleted ${section} entry from Trash — ${recordLabel(record)}`,
      details: { collection, id, record, deletedBy, deletedAt },
    }),
  });
};
