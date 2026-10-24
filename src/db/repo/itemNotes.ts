// Your private notes and ratings on releases you wishlisted or own (decisions §24). Keyed by
// item, apart from `items` and `ownership`, so syncs and scans leave them alone.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, ItemNoteRecord } from '../schema';

export const MAX_RATING = 5;
/** A note longer than this is cut, so one paste can't bloat a backup. */
export const MAX_NOTE_LENGTH = 2000;

/** What you edit: the text and the rating, without the bookkeeping. */
export interface ItemNote {
  text: string;
  /** 1 to 5, or null for unrated. */
  rating: number | null;
}

/** Trims and clamps a note. Null when nothing is left, so an emptied note disappears. */
export function normaliseNote({ text, rating }: ItemNote): ItemNote | null {
  const cleaned = text.trim().slice(0, MAX_NOTE_LENGTH);
  const valid =
    rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= MAX_RATING
      ? rating
      : null;
  return cleaned === '' && valid === null ? null : { text: cleaned, rating: valid };
}

export function noteOf(record: ItemNoteRecord | undefined): ItemNote | null {
  return record ? { text: record.text, rating: record.rating } : null;
}

/** Saves the note on an item, or deletes it when it's empty. Answers what was stored. */
export async function saveItemNote(
  db: DigheadDb,
  itemKey: ItemKey,
  note: ItemNote,
  now: number,
): Promise<ItemNote | null> {
  const cleaned = normaliseNote(note);
  if (cleaned) await db.itemNotes.put({ itemKey, ...cleaned, updatedAt: now });
  else await db.itemNotes.delete(itemKey);
  return cleaned;
}

/** Every note, for the tags backup file. */
export function allNotes(db: DigheadDb): Promise<ItemNoteRecord[]> {
  return db.itemNotes.toArray();
}

/**
 * Adds backed-up notes for the items in `owned`. A note you already have on an item stays: the
 * file never overwrites what you wrote since. Returns how many were added and how many were
 * for items you no longer have. Call inside a transaction on `itemNotes`.
 */
export async function importNotes(
  db: DigheadDb,
  notes: readonly (ItemNote & { itemKey: ItemKey })[],
  owned: ReadonlySet<ItemKey>,
  now: number,
): Promise<{ added: number; skipped: number }> {
  const present = await db.itemNotes.bulkGet(notes.map((note) => note.itemKey));
  const fresh: ItemNoteRecord[] = [];
  let skipped = 0;
  notes.forEach((note, i) => {
    if (!owned.has(note.itemKey)) skipped++;
    else if (!present[i]) {
      const cleaned = normaliseNote(note);
      if (cleaned) fresh.push({ itemKey: note.itemKey, ...cleaned, updatedAt: now });
    }
  });
  await db.itemNotes.bulkPut(fresh);
  return { added: fresh.length, skipped };
}
