import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import {
  DigheadDb,
  getMe,
  hideRelease,
  markSynced,
  putOwnership,
  replaceTwins,
  saveViewer,
  upsertCollectionItems,
} from '../../db';
import { computeForYou } from './forYou';

const ME = 1;

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

/** An album, or a track of `album`. `otherOwners` sets supporterCount to one more. */
function item(
  itemKey: ItemKey,
  patch: Partial<CollectionItem> = {},
  album: ItemKey | null = null,
): CollectionItem {
  return {
    itemKey,
    albumKey: album,
    title: `Title ${itemKey}`,
    artist: `Artist ${itemKey}`,
    bandId: 1,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: 7,
    purchaseKind: album ? 'track' : 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: null,
    ...patch,
  };
}

async function own(fanId: number, items: CollectionItem[], source: 'collection' | 'wishlist') {
  await upsertCollectionItems(db, items, 0);
  await putOwnership(db, fanId, items, source);
}

async function twins(scores: [fanId: number, score: number][]) {
  await replaceTwins(
    db,
    scores.map(([fanId, score]) => ({
      fanId,
      overlap: 3,
      jaccard: 0.1,
      score,
      labelCluster: false,
      lately: null,
      yearAgo: null,
      latelyOverlap: 0,
      computedAt: 0,
    })),
    [],
  );
}

async function me() {
  await saveViewer(db, { fanId: ME, username: 'me' });
  await markSynced(db, 0);
  return getMe(db);
}

/**
 * Twins 10, 11 and 12 (scores 3, 2, 1) and twin 13 (0.5), who falls outside a top 3. Everything
 * in a10, a11 and a20 is something you own, wishlisted or hid.
 */
async function seed() {
  const a1 = item('a1', { otherOwners: 1021 });
  const a2 = item('a2', { otherOwners: 1 });
  const a3 = item('a3', { otherOwners: 5 });
  const a4 = item('a4');
  const a10 = item('a10');
  const a11 = item('a11');
  const a20 = item('a20');
  // Only a track of a5 has turned up, so the row shows the track.
  const t51 = item('t51', { otherOwners: 3 }, 'a5');
  await own(10, [a1, a2, a10, a20], 'collection');
  await own(11, [a1, a3, a10, a11, t51], 'collection');
  await own(12, [a1, a2, a3, a4], 'collection');
  await own(13, [item('a30')], 'collection');
  await own(ME, [a10, item('t42', {}, 'a4')], 'collection');
  await own(ME, [a11], 'wishlist');
  await hideRelease(db, 'a20', 0);
  await twins([
    [10, 3],
    [11, 2],
    [12, 1],
    [13, 0.5],
  ]);
}

describe('computeForYou', () => {
  it('ranks what your top twins own by twin score and rarity', async () => {
    await seed();

    const result = await computeForYou(db, await me(), 3);

    // a2: 4 × 1/log2(4) = 2; a3: 3 × 1/3; a5: 2 × 1/log2(6) ≈ 0.77; a1: 6 × 1/10; a4: you and
    // twin 12 own it, so 1 × 1/log2(4) = 0.5.
    expect(result.rows.map((row) => [row.matchKey, row.twins])).toEqual([
      ['a2', 2],
      ['a3', 2],
      ['a5', 1],
      ['a1', 3],
      ['a4', 1],
    ]);
    expect(result).toMatchObject({ basis: 'ready', twinsUsed: 3 });
  });

  it('dresses rows for display and tags albums you own tracks of', async () => {
    await seed();

    const { rows } = await computeForYou(db, await me(), 3);

    expect(rows[0]).toEqual({
      matchKey: 'a2',
      title: 'Title a2',
      artist: 'Artist a2',
      label: null,
      url: 'https://artist.bandcamp.com/album/a2',
      coverUrl: 'https://f4.bcbits.com/img/a7_7.jpg',
      twins: 2,
      ownedTracks: 0,
    });
    expect(rows.find((row) => row.matchKey === 'a5')?.title).toBe('Title t51');
    expect(rows.find((row) => row.matchKey === 'a4')?.ownedTracks).toBe(1);
  });

  it('reads only the top K twins', async () => {
    await seed();

    const result = await computeForYou(db, await me(), 4);

    expect(result.twinsUsed).toBe(4);
    expect(result.rows.map((row) => row.matchKey)).toContain('a30');
  });

  it('holds back a third release by the same artist', async () => {
    const releases = [1, 2, 3, 4].map((n) => item(`a${n}`, { artist: n === 4 ? 'Other' : 'Same' }));
    // Without the rule: a1, a2, a3 (two twins each), then a4.
    await own(10, releases, 'collection');
    await own(11, releases.slice(0, 3), 'collection');
    await twins([
      [10, 1],
      [11, 1],
    ]);

    const { rows } = await computeForYou(db, await me(), 30);

    expect(rows.map((row) => row.matchKey)).toEqual(['a1', 'a2', 'a4', 'a3']);
  });

  it('says why there is nothing to show', async () => {
    expect(await computeForYou(db, undefined, 30)).toEqual({
      basis: 'no-viewer',
      rows: [],
      twinsUsed: 0,
    });
    expect(await computeForYou(db, await me(), 30)).toEqual({
      basis: 'ready',
      rows: [],
      twinsUsed: 0,
    });
  });
});
