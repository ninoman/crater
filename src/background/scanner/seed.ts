// Seeds the queue with your own releases, so crate mates fill in without opening any page.

import type { ItemKey } from '../../bandcamp';
import {
  collectionRows,
  enqueueAt,
  getItems,
  listedReleases,
  supportersFetchedAt,
  type CraterDb,
  type OwnershipRecord,
} from '../../db';
import { supportersAreFresh } from './freshness';
import { SEED } from './priority';

/** One release you own: the item to scan for its matchKey, and when you last bought into it. */
export interface OwnRelease {
  itemKey: ItemKey;
  matchKey: ItemKey;
  addedAt: number | null;
  /** Every item you own under this matchKey, e.g. an album and some of its tracks. */
  itemKeys: ItemKey[];
}

/**
 * One release per matchKey, newest purchase first. The album itself is scanned when you own it,
 * since its supporters are the release's main buyers; otherwise your newest item under it.
 */
export function ownReleases(rows: OwnershipRecord[]): OwnRelease[] {
  const groups = new Map<ItemKey, OwnershipRecord[]>();
  for (const row of rows) groups.set(row.matchKey, [...(groups.get(row.matchKey) ?? []), row]);
  const releases = [...groups.entries()].map(([matchKey, group]): OwnRelease => {
    const newest = [...group].sort((a, b) => (b.addedAt ?? -1) - (a.addedAt ?? -1));
    const target = group.find((row) => row.itemKey === matchKey) ?? newest[0];
    return {
      itemKey: target?.itemKey ?? matchKey,
      matchKey,
      addedAt: newest[0]?.addedAt ?? null,
      itemKeys: group.map((row) => row.itemKey),
    };
  });
  return releases.sort((a, b) => (b.addedAt ?? -1) - (a.addedAt ?? -1));
}

/**
 * Queues a release job at SEED priority for each release you own whose supporter list isn't
 * fresh. With `only`, just the releases holding one of those items (what an incremental sync
 * added). Each job's place in line is its purchase time negated, so newer purchases go first,
 * across syncs too; any negative time is already due. Returns how many were queued.
 */
export async function seedOwnReleases(
  db: CraterDb,
  fanId: number,
  now: number,
  only?: ReadonlySet<ItemKey>,
): Promise<number> {
  const releases = ownReleases(await collectionRows(db, fanId)).filter(
    (release) => !only || release.itemKeys.some((key) => only.has(key)),
  );
  const keys = releases.map((release) => release.itemKey);
  const [items, fetchedAt] = await Promise.all([getItems(db, keys), supportersFetchedAt(db, keys)]);
  const entries = releases.flatMap((release) => {
    const item = items.get(release.itemKey);
    const listedAt = fetchedAt.get(release.itemKey);
    const fresh = listedAt !== undefined && supportersAreFresh({ fetchedAt: listedAt }, now);
    if (!item || fresh) return [];
    const spec = { kind: 'release' as const, target: release.itemKey, url: item.url };
    return [{ spec, at: -(release.addedAt ?? 0) }];
  });
  await enqueueAt(db, entries, SEED);
  return entries.length;
}

/** How many of your releases have had their supporters listed, out of all you own. */
export async function ownReleaseProgress(
  db: CraterDb,
  fanId: number,
): Promise<{ scanned: number; total: number }> {
  const releases = ownReleases(await collectionRows(db, fanId));
  const listed = await listedReleases(
    db,
    releases.map((release) => release.itemKey),
  );
  return { scanned: listed.size, total: releases.length };
}
