// The tags backup file (decisions §8 "Backup", §14, §24). Tags and notes are hand-made, so a
// re-sync can't rebuild them. Version 1 files (followings only) and version 2 (no notes) still import.

import { z } from 'zod';
import type { ItemKey } from '../bandcamp';

const followingKeySchema = z.tuple([z.enum(['fan', 'band']), z.number().int()]);
const itemKeySchema = z.custom<ItemKey>(
  (value) => typeof value === 'string' && /^[at]\d+$/.test(value),
);

const tagBackupSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(
    z.object({
      name: z.string(),
      /** [kind, id] of each following the tag is on. */
      assignments: z.array(followingKeySchema),
      /** Wishlist and collection items the tag is on. Missing in version 1. */
      items: z.array(itemKeySchema).default([]),
    }),
  ),
  /** Your notes and ratings. Missing before version 3. */
  notes: z
    .array(
      z.object({
        itemKey: itemKeySchema,
        text: z.string(),
        rating: z.number().int().min(1).max(5).nullable(),
      }),
    )
    .default([]),
});

export type TagBackup = z.output<typeof tagBackupSchema>;

/** Reads a backup file's parsed JSON. Null when it isn't one of ours. */
export function parseTagBackup(json: unknown): TagBackup | null {
  const result = tagBackupSchema.safeParse(json);
  return result.success ? result.data : null;
}
