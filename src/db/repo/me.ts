import type { Viewer } from '../../bandcamp';
import type { DigheadDb, MeRecord } from '../schema';

export function getMe(db: DigheadDb): Promise<MeRecord | undefined> {
  return db.me.get('self');
}

/** Records the logged-in fan. A different fan than before starts unsynced. */
export async function saveViewer(db: DigheadDb, viewer: Viewer): Promise<MeRecord> {
  const current = await getMe(db);
  const me: MeRecord = {
    id: 'self',
    fanId: viewer.fanId,
    username: viewer.username,
    syncedAt: current?.fanId === viewer.fanId ? current.syncedAt : null,
  };
  await db.me.put(me);
  return me;
}

export async function markSynced(db: DigheadDb, at: number): Promise<void> {
  await db.me.update('self', { syncedAt: at });
}
