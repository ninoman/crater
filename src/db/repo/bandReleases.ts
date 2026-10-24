// Releases of the band accounts you follow, when each was read, and your mutes (decisions §23).

import type { Discography, ItemKey, ReleaseDetails } from '../../bandcamp';
import type { BandReleaseRecord, DigheadDb } from '../schema';

/**
 * Saves one read of a band's discography and returns its rows now. Releases it no longer lists
 * go; new ones are first seen now, and count as back catalogue on the band's first read.
 */
export async function saveDiscography(
  db: DigheadDb,
  { bandId, releases }: Discography,
  now: number,
): Promise<BandReleaseRecord[]> {
  return db.transaction('rw', db.bandReleases, db.bandReads, async () => {
    const baseline = (await db.bandReads.get(bandId)) === undefined;
    const stored = new Map(
      (await db.bandReleases.where('bandId').equals(bandId).toArray()).map((row) => [
        row.itemKey,
        row,
      ]),
    );
    const rows = releases.map((release): BandReleaseRecord => {
      const known = stored.get(release.itemKey);
      return known
        ? { ...known, ...release, releasedAt: release.releasedAt ?? known.releasedAt, bandId }
        : {
            ...release,
            bandId,
            firstSeenAt: now,
            baseline,
            url: null,
            albumKey: null,
            preorder: false,
          };
    });
    const listed = new Set(rows.map((row) => row.itemKey));
    const gone = [...stored.keys()].filter((key) => !listed.has(key));
    await db.bandReleases.bulkDelete(gone.map((key): [number, ItemKey] => [bandId, key]));
    await db.bandReleases.bulkPut(rows);
    await db.bandReads.put({ bandId, readAt: now });
    return rows;
  });
}

export function getBandRelease(
  db: DigheadDb,
  bandId: number,
  itemKey: ItemKey,
): Promise<BandReleaseRecord | undefined> {
  return db.bandReleases.get([bandId, itemKey]);
}

/** Adds a release's URL and album from its details. A release read away meanwhile stays gone. */
export async function saveReleaseDetails(
  db: DigheadDb,
  bandId: number,
  { itemKey, albumKey, url, releasedAt, preorder }: ReleaseDetails,
): Promise<void> {
  await db.bandReleases
    .where('[bandId+itemKey]')
    .equals([bandId, itemKey])
    .modify((row) => {
      Object.assign(row, { url, albumKey, preorder, releasedAt: releasedAt ?? row.releasedAt });
    });
}

/** When each band was last read, by band_id. */
export async function bandReadTimes(db: DigheadDb): Promise<Map<number, number>> {
  return new Map((await db.bandReads.toArray()).map((read) => [read.bandId, read.readAt]));
}

/** Drops what was read for these bands, e.g. after you unfollowed them. Mutes stay. */
export async function forgetBandReleases(db: DigheadDb, bandIds: readonly number[]) {
  if (bandIds.length === 0) return;
  await db.transaction('rw', db.bandReleases, db.bandReads, async () => {
    await db.bandReleases.where('bandId').anyOf(bandIds).delete();
    await db.bandReads.bulkDelete([...bandIds]);
  });
}

/**
 * Releases that are recent by date, or newly listed, since `since`. A band's release can turn
 * up in both lists; it's returned once.
 */
export async function recentBandReleases(
  db: DigheadDb,
  since: number,
): Promise<BandReleaseRecord[]> {
  const [released, seen] = await Promise.all([
    db.bandReleases.where('releasedAt').aboveOrEqual(since).toArray(),
    db.bandReleases.where('firstSeenAt').aboveOrEqual(since).toArray(),
  ]);
  const byKey = new Map([...released, ...seen].map((row) => [`${row.bandId}:${row.itemKey}`, row]));
  return [...byKey.values()];
}

/** Every release listed under these bands, as item keys by band. */
export async function bandCatalogues(
  db: DigheadDb,
  bandIds: readonly number[],
): Promise<Map<number, ItemKey[]>> {
  const catalogues = new Map<number, ItemKey[]>();
  const keys = await db.bandReleases.where('bandId').anyOf(bandIds).primaryKeys();
  for (const [bandId, itemKey] of keys) {
    catalogues.set(bandId, [...(catalogues.get(bandId) ?? []), itemKey]);
  }
  return catalogues;
}

export async function setFollowMute(
  db: DigheadDb,
  bandId: number,
  muted: boolean,
  now: number,
): Promise<void> {
  if (muted) await db.followMutes.put({ bandId, mutedAt: now });
  else await db.followMutes.delete(bandId);
}

export async function mutedBandIds(db: DigheadDb): Promise<Set<number>> {
  return new Set(await db.followMutes.toCollection().primaryKeys());
}

/** The band accounts you follow, not counting ones unfollowed on the tab since the last sync. */
export async function followedBandIds(db: DigheadDb): Promise<number[]> {
  const rows = await db.following
    .where('kind')
    .equals('band')
    .filter((row) => !row.unfollowed)
    .toArray();
  return rows.map((row) => row.id);
}

/** Bands with a read on file that you no longer follow at all (a sync deleted the row). */
export async function readBandsNotFollowed(db: DigheadDb): Promise<number[]> {
  const read = await db.bandReads.toCollection().primaryKeys();
  const following = await db.following.bulkGet(
    read.map((bandId): ['band', number] => ['band', bandId]),
  );
  return read.filter((_, i) => following[i] === undefined);
}
