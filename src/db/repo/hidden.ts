import type { ItemKey } from '../../bandcamp';
import type { DigheadDb } from '../schema';

/** Hides a release from every recommender. Hiding again keeps the first time. */
export async function hideRelease(db: DigheadDb, matchKey: ItemKey, now: number): Promise<void> {
  await db.transaction('rw', db.hidden, async () => {
    if (!(await db.hidden.get(matchKey))) await db.hidden.put({ matchKey, hiddenAt: now });
  });
}

export async function hiddenMatchKeys(db: DigheadDb): Promise<Set<ItemKey>> {
  return new Set(await db.hidden.toCollection().primaryKeys());
}
