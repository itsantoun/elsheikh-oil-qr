import { ref, get, update } from 'firebase/database';
import { database } from '../Auth/firebase';

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
  await update(ref(database), {
    [`${collection}/${id}`]: null,
    [`trash/${collection}/${id}`]: {
      record: snap.val(),
      deletedAt: new Date().toISOString(),
      deletedBy: userLabel(user),
      deletedByUid: user?.uid || '',
    },
  });
};

// Puts a trashed record back at its original id, exactly as it was.
export const restoreFromTrash = async (collection, id) => {
  const [trashSnap, liveSnap] = await Promise.all([
    get(ref(database, `trash/${collection}/${id}`)),
    get(ref(database, `${collection}/${id}`)),
  ]);
  if (!trashSnap.exists()) throw new Error('This item is no longer in Trash.');
  if (liveSnap.exists()) throw new Error('A record with this id already exists — it was restored already.');
  await update(ref(database), {
    [`${collection}/${id}`]: trashSnap.val().record,
    [`trash/${collection}/${id}`]: null,
  });
};

export const deleteForever = (collection, id) => update(ref(database), { [`trash/${collection}/${id}`]: null });
