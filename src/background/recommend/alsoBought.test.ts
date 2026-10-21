import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey, Supporter } from '../../bandcamp';
import {
  DigheadDb,
  finishFanScan,
  hideRelease,
  putOwnership,
  replaceTwins,
  upsertCollectionItems,
  upsertSupporterFans,
  type FanStatus,
} from '../../db';
import { computeAlsoBought } from './alsoBought';

const ME = 1;

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

/** An album, or a track of `album`. */
function item(
  itemKey: ItemKey,
  patch: Partial<CollectionItem> = {},
  album: ItemKey | null = null,
): CollectionItem {
  return {
    itemKey,
    albumKey: album,
    title: `Title ${itemKey}`,
    artist: 'Artist',
    bandId: 1,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: 7,
    purchaseKind: album ? 'track' : 'album',
    label: null,
    labelId: null,
    otherOwners: 3,
    addedAt: null,
    ...patch,
  };
}

const track = (key: ItemKey, album: ItemKey) => item(key, {}, album);

/** Fans who own `items` and whose collection scan ended with `status`. */
async function fans(ids: number[], items: CollectionItem[], status: FanStatus = 'done') {
  await upsertCollectionItems(db, items, 0);
  for (const fanId of ids) {
    await upsertSupporterFans(db, [supporter(fanId)], 0);
    await putOwnership(db, fanId, items, 'collection');
    if (status !== 'queued') await finishFanScan(db, fanId, status, items.length, 0);
  }
}

function supporter(fanId: number): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: null,
    token: `1:1:${fanId}:0:1:0`,
    purchasedAt: null,
    isReviewer: false,
  };
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

async function ranking(releaseKey: ItemKey, me: number | null = ME) {
  return (await computeAlsoBought(db, releaseKey, me)).rows.map((row) => row.matchKey);
}

/**
 * Release a100 has 10 scanned supporters (fans 10–19), some through its track t101. Fans 20–39
 * don't own it. Everyone else is noise the filters must remove.
 */
async function seedBigRelease() {
  await fans([10], [track('t101', 'a100')]);
  await fans(range(11, 19), [item('a100')]);

  // A staple: 8 of 10 supporters, but also all 20 other fans.
  await fans(range(10, 17), [item('a200')]);
  await fans(range(20, 39), [item('a200')]);
  // Niche: 5 supporters, nobody else.
  await fans(range(10, 14), [item('a300')]);
  // Owned through tracks: fans 10–11 own t401, 12 the album, 13 two tracks. 4 owners in all.
  await fans([10, 11], [track('t401', 'a400')]);
  await fans([12], [item('a400')]);
  await fans([13], [track('t401', 'a400'), track('t402', 'a400')]);
  // Filtered: you own it, you wishlisted it, you hid it, only one co-owner.
  await fans(range(15, 17), [item('a500'), item('a600'), item('a700')]);
  await fans([18], [item('a800')]);
  // You own one track of it: stays in.
  await fans(range(17, 19), [item('a900')]);

  await putOwnership(db, ME, [item('a500'), track('t901', 'a900')], 'collection');
  await putOwnership(db, ME, [item('a600')], 'wishlist');
  await hideRelease(db, 'a700', 0);

  // A private fan and a queued one own the release but tell us nothing more.
  await fans([40], [item('a100'), item('a300')], 'private');
  await fans([41], [item('a100'), item('a300')], 'queued');
}

describe('computeAlsoBought', () => {
  it('ranks by co-ownership and lift, folding tracks into albums', async () => {
    await seedBigRelease();

    // Population: fans 10–41 = 32, you left out. Scores: a300 5·ln(1+2.3) ≈ 5.9 (fans 40 and
    // 41 own it too), a400 4·ln(1+3.2) ≈ 5.7, a200 8·ln(1+0.91) ≈ 5.2, a900 3·ln(1+2.4) ≈ 3.7.
    expect(await ranking('a100')).toEqual(['a300', 'a400', 'a200', 'a900']);
  });

  it('explains each row and tags albums you own tracks of', async () => {
    await seedBigRelease();

    const { rows } = await computeAlsoBought(db, 'a100', ME);

    expect(rows[0]).toEqual({
      matchKey: 'a300',
      title: 'Title a300',
      artist: 'Artist',
      label: null,
      url: 'https://artist.bandcamp.com/album/a300',
      coverUrl: 'https://f4.bcbits.com/img/a7_7.jpg',
      reason: { kind: 'co-owned', owners: 5, of: 10, twins: 0 },
      ownedTracks: 0,
    });
    expect(rows.find((row) => row.matchKey === 'a900')?.ownedTracks).toBe(1);
  });

  it('shows a track when only tracks of the album are known', async () => {
    await fans(range(10, 12), [item('a100'), track('t401', 'a400')]);

    const [row] = (await computeAlsoBought(db, 'a100', ME)).rows;

    expect(row).toMatchObject({ matchKey: 'a400', title: 'Title t401' });
  });

  it('scores a track page against its album', async () => {
    await seedBigRelease();
    await upsertCollectionItems(db, [track('t101', 'a100')], 0);

    expect(await ranking('t101')).toEqual(await ranking('a100'));
  });

  it('only filters what it can when nobody is logged in', async () => {
    await seedBigRelease();

    // Hidden still applies. a500 ranks below a600: your copy makes it one owner more common.
    expect(await ranking('a100', null)).toEqual(['a300', 'a400', 'a200', 'a600', 'a500', 'a900']);
  });

  it('boosts releases your twins among the supporters own', async () => {
    await seedBigRelease();
    // Fan 30 is your best twin but doesn't own a100, so their a200 copy doesn't count.
    await replaceTwins(
      db,
      [
        {
          fanId: 30,
          overlap: 9,
          jaccard: 0.1,
          score: 0.8,
          labelCluster: false,
          lately: null,
          yearAgo: null,
          latelyOverlap: 0,
          computedAt: 0,
        },
        {
          fanId: 17,
          overlap: 5,
          jaccard: 0.1,
          score: 0.4,
          labelCluster: false,
          lately: null,
          yearAgo: null,
          latelyOverlap: 0,
          computedAt: 0,
        },
        {
          fanId: 18,
          overlap: 5,
          jaccard: 0.1,
          score: 0.4,
          labelCluster: false,
          lately: null,
          yearAgo: null,
          latelyOverlap: 0,
          computedAt: 0,
        },
      ],
      [],
    );

    // a200 (fan 17, share 0.5): 5.2 × 1.25 ≈ 6.5 jumps from third to first, past a300's 5.9.
    // a900 (fans 17 and 18, share 1): 3.7 × 1.5 ≈ 5.5, just short of a400's 5.7.
    const { rows } = await computeAlsoBought(db, 'a100', ME);
    expect(rows.map((row) => [row.matchKey, row.reason])).toEqual([
      ['a200', { kind: 'co-owned', owners: 8, of: 10, twins: 1 }],
      ['a300', { kind: 'co-owned', owners: 5, of: 10, twins: 0 }],
      ['a400', { kind: 'co-owned', owners: 4, of: 10, twins: 0 }],
      ['a900', { kind: 'co-owned', owners: 3, of: 10, twins: 2 }],
    ]);
  });

  it('returns nothing before any supporter is scanned', async () => {
    await fans(range(10, 19), [item('a100'), item('a200')], 'queued');

    expect(await ranking('a100')).toEqual([]);
  });
});

describe('small-release fallback', () => {
  const solo = { artist: 'Solo', bandId: 5 };
  const release = item('a1000', { ...solo, label: 'Tiny Label', labelId: 77 });

  async function seedSmallRelease() {
    await upsertCollectionItems(
      db,
      [
        release,
        item('a1001', { ...solo, otherOwners: 2 }),
        item('a1002', { ...solo, artist: 'Labelmate', otherOwners: 40 }),
        item('a1003', { artist: 'Far', bandId: 9, label: 'Tiny Label', labelId: 77 }),
        item('t1004', solo, 'a1001'),
        item('a1005', { ...solo, otherOwners: 99 }),
        item('a1006', { ...solo, otherOwners: 5 }),
      ],
      0,
    );
    await fans([10, 11], [release, item('a2000')]);
    await putOwnership(db, ME, [item('a1005', solo)], 'collection');
    await hideRelease(db, 'a1006', 0);
  }

  it('blends in the same artist and label, labelled as such', async () => {
    await seedSmallRelease();

    const { rows } = await computeAlsoBought(db, 'a1000', ME);

    expect(rows.map((row) => [row.matchKey, row.reason])).toEqual([
      ['a2000', { kind: 'co-owned', owners: 2, of: 2, twins: 0 }],
      ['a1001', { kind: 'same-artist' }],
      ['a1002', { kind: 'same-label', label: 'Tiny Label' }],
      ['a1003', { kind: 'same-label', label: 'Tiny Label' }],
    ]);
  });

  it('leaves big releases alone', async () => {
    await seedSmallRelease();
    await fans(range(12, 17), [release]);

    expect(await ranking('a1000')).toEqual(['a2000']);
  });
});
