import type { ItemKey } from '../../bandcamp';
import type { HeardSource } from '../../shared/heard';
import type { DigheadDb } from '../schema';

/**
 * Marks a release heard. A track of an album marks the album, when its record says so, since
 * rows are keyed by matchKey. Marking again keeps the first time and source.
 */
export async function markHeard(
  db: DigheadDb,
  itemKey: ItemKey,
  source: HeardSource,
  now: number,
): Promise<void> {
  await db.transaction('rw', [db.items, db.heard], async () => {
    const matchKey = (await db.items.get(itemKey))?.albumKey ?? itemKey;
    if (!(await db.heard.get(matchKey))) await db.heard.put({ matchKey, heardAt: now, source });
  });
}

export async function unmarkHeard(db: DigheadDb, matchKey: ItemKey): Promise<void> {
  await db.heard.delete(matchKey);
}

export async function heardKeys(db: DigheadDb): Promise<Set<ItemKey>> {
  return new Set(await db.heard.toCollection().primaryKeys());
}
