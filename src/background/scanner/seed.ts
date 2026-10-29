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
import { rankSeedFansOnceListed } from './seedFans';

/** One release you own: the items whose supporters to list, and when you last bought into it. */
export interface OwnRelease {
  matchKey: ItemKey;
  addedAt: number | null;
  /**
   * The album alone when you own it, since its supporters are the release's main buyers. With
   * only tracks, each of your tracks and the album: track buyers aren't on the album's list.
   */
  targets: ItemKey[];
  /** Every item you own under this matchKey, e.g. an album and some of its tracks. */
  itemKeys: ItemKey[];
}

/** One release per matchKey, newest purchase first. */
export function ownReleases(rows: OwnershipRecord[]): OwnRelease[] {
  const groups = new Map<ItemKey, OwnershipRecord[]>();
  for (const row of rows) groups.set(row.matchKey, [...(groups.get(row.matchKey) ?? []), row]);
  const releases = [...groups.entries()].map(([matchKey, group]): OwnRelease => {
    const newest = [...group].sort((a, b) => (b.addedAt ?? -1) - (a.addedAt ?? -1));
    const itemKeys = newest.map((row) => row.itemKey);
    return {
      matchKey,
      addedAt: newest[0]?.addedAt ?? null,
      targets: itemKeys.includes(matchKey) ? [matchKey] : [...itemKeys, matchKey],
      itemKeys: group.map((row) => row.itemKey),
    };
  });
  return releases.sort((a, b) => (b.addedAt ?? -1) - (a.addedAt ?? -1));
}

/**
 * Queues a release job at SEED priority for each of your releases' supporter lists that isn't
 * fresh. With `only`, just the releases holding one of those items (what an incremental sync
 * added). Each job's place in line is its purchase time negated, so newer purchases go first,
 * across syncs too; any negative time is already due. With no list to read, the fans already
 * waiting are ranked now (after the v20 upgrade, say). Returns how many were queued.
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
  const keys = releases.flatMap((release) => release.targets);
  const [items, fetchedAt] = await Promise.all([getItems(db, keys), supportersFetchedAt(db, keys)]);
  // An album you only own tracks of has no item until one of its tracks is read; that track's
  // job queues it (releaseJob).
  const entries = releases.flatMap((release) =>
    release.targets.flatMap((target) => {
      const item = items.get(target);
      const listedAt = fetchedAt.get(target);
      const fresh = listedAt !== undefined && supportersAreFresh({ fetchedAt: listedAt }, now);
      if (!item || fresh) return [];
      const spec = { kind: 'release' as const, target, url: item.url };
      return [{ spec, at: -(release.addedAt ?? 0) }];
    }),
  );
  await enqueueAt(db, entries, SEED);
  await rankSeedFansOnceListed(db, now);
  return entries.length;
}

/** How many of your releases have had every supporter list they need, out of all you own. */
export async function ownReleaseProgress(
  db: CraterDb,
  fanId: number,
): Promise<{ scanned: number; total: number }> {
  const releases = ownReleases(await collectionRows(db, fanId));
  const listed = await listedReleases(
    db,
    releases.flatMap((release) => release.targets),
  );
  const scanned = releases.filter((release) => release.targets.every((key) => listed.has(key)));
  return { scanned: scanned.length, total: releases.length };
}
