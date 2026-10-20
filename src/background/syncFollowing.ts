// Pulls the logged-in fan's followings into the DB. Always a full sync (decisions §8).

import { fetchFollowingPage, FOLLOWING_FIRST_TOKEN, type FollowingKind } from '../bandcamp';
import { followingFromRow, replaceFollowing, type SyncedFollowing } from '../db';
import type { SyncDeps } from './syncMe';

/** One request covers most accounts' whole list, so there's no incremental mode. */
const BATCH_SIZE = 500;

const KINDS: FollowingKind[] = ['band', 'fan'];

/**
 * Fetches both lists, then replaces the stored rows. A list that fails part-way throws before
 * anything is written, so a partial list can never delete followings.
 */
export async function syncFollowing(deps: SyncDeps, fanId: number): Promise<void> {
  const lists = new Map<FollowingKind, SyncedFollowing[]>();
  let fetched = 0;
  for (const kind of KINDS) {
    const rows = await fetchList(deps, kind, fanId, (count) =>
      deps.onFollowingProgress(fetched + count),
    );
    lists.set(kind, rows);
    fetched += rows.length;
  }
  for (const [kind, rows] of lists) await replaceFollowing(deps.db, kind, rows);
}

async function fetchList(
  deps: SyncDeps,
  kind: FollowingKind,
  fanId: number,
  onCount: (count: number) => void,
): Promise<SyncedFollowing[]> {
  const rows: SyncedFollowing[] = [];
  let token = FOLLOWING_FIRST_TOKEN;
  for (;;) {
    const page = await fetchFollowingPage(deps.fetchJson, kind, fanId, token, BATCH_SIZE);
    rows.push(...page.rows.map(followingFromRow));
    onCount(rows.length);
    // A repeated token would loop forever, so treat it as the end.
    if (!page.moreAvailable || page.nextToken === null || page.nextToken === token) return rows;
    token = page.nextToken;
    await deps.pause();
  }
}
