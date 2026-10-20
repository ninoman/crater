// The tags backup file (decisions §8 "Backup"). Tags are hand-made, so a re-sync can't rebuild them.

import { z } from 'zod';

const followingKeySchema = z.tuple([z.enum(['fan', 'band']), z.number().int()]);

const tagBackupSchema = z.object({
  version: z.literal(1),
  tags: z.array(
    z.object({
      name: z.string(),
      /** [kind, id] of each following the tag is on. */
      assignments: z.array(followingKeySchema),
    }),
  ),
});

export type TagBackup = z.infer<typeof tagBackupSchema>;

/** Reads a backup file's parsed JSON. Null when it isn't one of ours. */
export function parseTagBackup(json: unknown): TagBackup | null {
  const result = tagBackupSchema.safeParse(json);
  return result.success ? result.data : null;
}
