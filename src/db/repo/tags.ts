// Your own tags, on followings (decisions §8) and on wishlist and collection items (§14, §22).
// Tag ids live on the following rows and in `itemTags`.

import type { ItemKey } from '../../bandcamp';
import type {
  DigheadDb,
  FollowingKey,
  FollowingRecord,
  ItemTagsRecord,
  TagRecord,
} from '../schema';
import type { TagBackup } from '../tagBackup';
import { followingKey } from './following';
import { listedKeys } from './itemLists';
import { allNotes, importNotes } from './itemNotes';

export type TagResult =
  | { ok: true; tag: TagRecord }
  | { ok: false; reason: 'empty' | 'taken' | 'missing' };

export interface TagImportSummary {
  tagsCreated: number;
  assigned: number;
  /** Assignments to accounts you no longer follow, or notes and tags for items you no longer have. */
  skipped: number;
}

/** What makes two names one tag: case and surrounding spaces don't count. */
export function tagNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function listTags(db: DigheadDb): Promise<TagRecord[]> {
  return db.tags.orderBy('nameKey').toArray();
}

/** Creates a tag. A name that already exists returns that tag, so Enter in the picker just works. */
export async function createTag(db: DigheadDb, name: string): Promise<TagResult> {
  const nameKey = tagNameKey(name);
  if (!nameKey) return { ok: false, reason: 'empty' };
  return db.transaction('rw', db.tags, async () => ({
    ok: true,
    tag: (await findOrAdd(db, name)).tag,
  }));
}

export async function renameTag(db: DigheadDb, id: number, name: string): Promise<TagResult> {
  const nameKey = tagNameKey(name);
  if (!nameKey) return { ok: false, reason: 'empty' };
  return db.transaction('rw', db.tags, async (): Promise<TagResult> => {
    if (!(await db.tags.get(id))) return { ok: false, reason: 'missing' };
    const clash = await db.tags.where('nameKey').equals(nameKey).first();
    if (clash && clash.id !== id) return { ok: false, reason: 'taken' };
    const tag: TagRecord = { id, name: name.trim(), nameKey };
    await db.tags.put(tag);
    return { ok: true, tag };
  });
}

/** Deletes a tag and takes it off every following and item, in one transaction. */
export async function deleteTag(db: DigheadDb, id: number): Promise<void> {
  await db.transaction('rw', [db.tags, db.following, db.itemTags], async () => {
    const untag = (row: { tagIds: number[] }) => {
      row.tagIds = row.tagIds.filter((tagId) => tagId !== id);
    };
    await db.following.where('tagIds').equals(id).modify(untag);
    await db.itemTags.where('tagIds').equals(id).modify(untag);
    await db.tags.delete(id);
  });
}

/**
 * Adds a tag to, or removes it from, many followings in one transaction. Keys we don't have
 * are skipped. Returns how many rows changed.
 */
export async function assignTag(
  db: DigheadDb,
  tagId: number,
  keys: FollowingKey[],
  action: 'add' | 'remove',
): Promise<number> {
  return db.transaction('rw', [db.tags, db.following], async () => {
    if (action === 'add' && !(await db.tags.get(tagId))) return 0;
    const rows = await db.following.bulkGet(keys);
    const changed = rows.flatMap((row) => {
      if (!row || row.tagIds.includes(tagId) === (action === 'add')) return [];
      const tagIds =
        action === 'add' ? [...row.tagIds, tagId] : row.tagIds.filter((id) => id !== tagId);
      return [{ ...row, tagIds }];
    });
    await db.following.bulkPut(changed);
    return changed.length;
  });
}

/** Every tag with the followings and items it's on, and your notes, in the backup file's shape. */
export async function exportTags(db: DigheadDb): Promise<TagBackup> {
  return db.transaction('r', [db.tags, db.following, db.itemTags, db.itemNotes], async () => {
    const tags = await listTags(db);
    const assignments = new Map<number, FollowingKey[]>(tags.map((tag) => [tag.id, []]));
    const items = new Map<number, ItemKey[]>(tags.map((tag) => [tag.id, []]));
    for (const row of await db.following.toArray()) {
      for (const tagId of row.tagIds) assignments.get(tagId)?.push(followingKey(row));
    }
    for (const row of await db.itemTags.toArray()) {
      for (const tagId of row.tagIds) items.get(tagId)?.push(row.itemKey);
    }
    return {
      version: 3,
      tags: tags.map((tag) => ({
        name: tag.name,
        assignments: assignments.get(tag.id) ?? [],
        items: items.get(tag.id) ?? [],
      })),
      notes: (await allNotes(db)).map(({ itemKey, text, rating }) => ({ itemKey, text, rating })),
    };
  });
}

/**
 * Merges a backup in: tags match by name key. Assignments to accounts you no longer follow
 * (gone, or unfollowed on the tab) and to items in neither of `fanId`'s lists are skipped. Notes
 * are added only for items that have none yet.
 */
export async function importTags(
  db: DigheadDb,
  backup: TagBackup,
  fanId: number | null,
): Promise<TagImportSummary> {
  const tables = [db.tags, db.following, db.itemTags, db.itemNotes, db.ownership];
  return db.transaction('rw', tables, async () => {
    const summary: TagImportSummary = { tagsCreated: 0, assigned: 0, skipped: 0 };
    for (const entry of backup.tags) {
      if (!tagNameKey(entry.name)) continue;
      const { tag, created } = await findOrAdd(db, entry.name);
      if (created) summary.tagsCreated++;

      const rows = await db.following.bulkGet(entry.assignments);
      const changed: FollowingRecord[] = [];
      for (const row of rows) {
        if (!row || row.unfollowed) summary.skipped++;
        else if (!row.tagIds.includes(tag.id))
          changed.push({ ...row, tagIds: [...row.tagIds, tag.id] });
      }
      await db.following.bulkPut(changed);
      summary.assigned += changed.length;

      const wished = fanId === null ? new Set<ItemKey>() : await listedKeys(db, fanId, entry.items);
      const present = await db.itemTags.bulkGet(entry.items);
      const tagged: ItemTagsRecord[] = [];
      entry.items.forEach((itemKey, i) => {
        const tagIds = present[i]?.tagIds ?? [];
        if (!wished.has(itemKey)) summary.skipped++;
        else if (!tagIds.includes(tag.id)) tagged.push({ itemKey, tagIds: [...tagIds, tag.id] });
      });
      await db.itemTags.bulkPut(tagged);
      summary.assigned += tagged.length;
    }
    const noteKeys = backup.notes.map((note) => note.itemKey);
    const listed = fanId === null ? new Set<ItemKey>() : await listedKeys(db, fanId, noteKeys);
    const notes = await importNotes(db, backup.notes, listed, Date.now());
    summary.assigned += notes.added;
    summary.skipped += notes.skipped;
    return summary;
  });
}

/** The tag with `name`'s key, added if new. Call inside a transaction on `tags`. */
async function findOrAdd(
  db: DigheadDb,
  name: string,
): Promise<{ tag: TagRecord; created: boolean }> {
  const nameKey = tagNameKey(name);
  const existing = await db.tags.where('nameKey').equals(nameKey).first();
  if (existing) return { tag: existing, created: false };
  const record = { name: name.trim(), nameKey };
  return { tag: { ...record, id: await db.tags.add(record) }, created: true };
}
