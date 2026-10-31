// What the Crate mates tab gets when it opens. A recompute reads every scanned fan, so the stored
// board answers at once and catches up behind it (decisions §7).

import type { CrateMatesResult } from '../../shared/crateMates';

export interface CrateMatesOnOpenDeps {
  /** True when fans were read since the last recompute. */
  stale: () => Promise<boolean>;
  read: () => Promise<CrateMatesResult>;
  /** Resolves when the recompute is over. Never rejects. */
  refresh: () => Promise<void>;
}

/** The stored board, recomputing behind it when stale. With nothing stored, waits for the first. */
export async function crateMatesOnOpen({
  stale,
  read,
  refresh,
}: CrateMatesOnOpenDeps): Promise<CrateMatesResult> {
  const [isStale, stored] = await Promise.all([stale(), read()]);
  if (!isStale) return stored;
  if (stored.rows.length > 0) {
    void refresh();
    return stored;
  }
  await refresh();
  return read();
}
