import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey, Supporter } from '../../bandcamp';
import {
  DigheadDb,
  finishFanScan,
  markQuickRead,
  hide,
  markHeard,
  putFollowing,
  putOwnership,
  replaceCrateMates,
  saveReleaseSupporters,
  upsertCollectionItems,
  upsertSupporterFans,
  type FanStatus,
} from '../../db';
import type { AlsoBoughtRow } from '../../shared/alsoBought';
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
    compilation: false,
    ...patch,
  };
}

const track = (key: ItemKey, album: ItemKey) => item(key, {}, album);

/** Fans who own `items` and whose collection scan ended with `status`. */
async function fans(ids: number[], items: CollectionItem[], status: FanStatus = 'done') {
  await upsertCollectionItems(db, items);
  for (const fanId of ids) {
    await upsertSupporterFans(db, [supporter(fanId)], 0);
    await putOwnership(db, fanId, items, 'collection');
    if (status === 'quick') await markQuickRead(db, fanId, items.length, 0);
    else if (status !== 'queued') await finishFanScan(db, fanId, status, items.length, 0);
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

const isCoOwned = (row: AlsoBoughtRow) => row.reason.kind === 'co-owned';

/** Co-owned rows only: every test item shares a band, so same-artist picks fill in behind. */
async function coOwned(releaseKey: ItemKey) {
  return (await computeAlsoBought(db, releaseKey, ME)).rows
    .filter(isCoOwned)
    .map((row) => row.matchKey);
}

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
  // a900 stays in. You own a track of a950, so it's left out like an album you own.
  await fans(range(17, 19), [item('a900'), item('a950')]);

  await putOwnership(db, ME, [item('a500'), track('t951', 'a950')], 'collection');
  await putOwnership(db, ME, [item('a600')], 'wishlist');
  await hide(db, { kind: 'release', matchKey: 'a700' }, 0);

  // A private fan and a queued one own the release but tell us nothing more. Fan 41 turned
  // up elsewhere, so the listed supporters are all scanned and the warm-up is over.
  await fans([40], [item('a100'), item('a300')], 'private');
  await fans([41], [item('a100'), item('a300')], 'queued');
  await listSupporters('a100', [...range(10, 19), 40]);
}

/** The release's supporter list, as its release job saves it. */
async function listSupporters(releaseKey: ItemKey, ids: number[]) {
  await saveReleaseSupporters(db, releaseKey, ids, 0);
}

describe('computeAlsoBought', () => {
  it('counts supporters whose collection was only quick-read so far', async () => {
    await fans([50, 51], [item('a100'), item('a300')], 'quick');

    expect(await ranking('a100')).toEqual(['a300']);
  });

  it('ranks by co-ownership and lift, folding tracks into albums', async () => {
    await seedBigRelease();

    // Population: fans 10–41 = 32, you left out. N = 10, so shares are Wilson lower bounds:
    // a300 5 of 10 → 0.27, lift 1.23 (fans 40 and 41 own it too), score 5·ln(2.23) ≈ 4.0;
    // a200 8 of 10 → 0.54, lift 0.62, ≈ 3.85; a400 4 of 10 → 0.19, lift 1.55, ≈ 3.75;
    // a900 3 of 10 → 0.13, lift 1.35, ≈ 2.6. The staple's 8 owners now count for more than
    // a400's 4: more evidence, so less shrinkage.
    expect(await ranking('a100')).toEqual(['a300', 'a200', 'a400', 'a900']);
  });

  it('down-weights a compilation among the picks, unless told not to', async () => {
    await seedBigRelease();
    await upsertCollectionItems(db, [
      item('a300', { artist: 'Various Artists', compilation: true }),
    ]);

    // a300's ≈ 4.0 halves to ≈ 2.0, below a900's ≈ 2.6.
    expect(await ranking('a100')).toEqual(['a200', 'a400', 'a900', 'a300']);
    const unchanged = await computeAlsoBought(db, 'a100', ME, { ignoreCompilations: false });
    expect(unchanged.rows.map((row) => row.matchKey)).toEqual(['a300', 'a200', 'a400', 'a900']);
  });

  it("scores a track page on the album's buyers and its own, not other tracks'", async () => {
    // Fans 10–12 bought t101, fans 13–15 t102, fans 16–17 the whole album.
    await fans(range(10, 12), [track('t101', 'a100'), item('a300')]);
    await fans(range(13, 15), [track('t102', 'a100'), item('a400')]);
    await fans(range(16, 17), [item('a100'), item('a300')]);

    // Both tracks see the album buyers' a300; neither sees the other track's buyers.
    expect(await coOwned('t101')).toEqual(['a300']);
    expect(await coOwned('t102')).toEqual(['a400', 'a300']);
    expect(await coOwned('a100')).toEqual(['a300', 'a400']);
  });

  it("weighs a compilation's buyers at half on its track pages, and only them on its page", async () => {
    const comp = (key: ItemKey) => item(key, {}, 'a100');
    await upsertCollectionItems(db, [item('a100', { compilation: true })]);
    // Fans 10–12 bought t101, fans 13–15 t102, fans 16–17 the whole comp.
    await fans(range(10, 12), [comp('t101'), item('a300')]);
    await fans(range(13, 15), [comp('t102'), item('a400')]);
    await fans(range(16, 17), [item('a100'), item('a500')]);
    // Fan 18 is listed on t101's page; their scan holds the whole comp.
    await fans([18], [item('a100'), item('a300')]);
    await listSupporters('t101', [10, 11, 12, 18]);

    const t101 = await computeAlsoBought(db, 't101', ME);
    expect(t101.rows.filter(isCoOwned).map((row) => row.matchKey)).toEqual(['a300', 'a500']);
    expect(await coOwned('t102')).toEqual(['a400', 'a500']);
    // The comp's page leaves track buyers out: a300 has one comp buyer, a400 none.
    expect(await coOwned('a100')).toEqual(['a500']);
  });

  it('explains each row and leaves out albums you own a track of', async () => {
    await seedBigRelease();

    const { rows } = await computeAlsoBought(db, 'a100', ME);

    expect(rows[0]).toEqual({
      matchKey: 'a300',
      title: 'Title a300',
      artist: 'Artist',
      label: null,
      url: 'https://artist.bandcamp.com/album/a300',
      coverUrl: 'https://f4.bcbits.com/img/a7_7.jpg',
      reason: { kind: 'co-owned', owners: 5, crateMates: 0 },
      followed: null,
      heard: false,
      hide: { band: { kind: 'band', bandId: 1, name: 'Artist' }, label: null },
    });
    expect(rows.map((row) => row.matchKey)).not.toContain('a950');
  });

  it('leaves out co-owned picks from a hidden artist or label', async () => {
    await seedBigRelease();
    const before = await ranking('a100');
    await upsertCollectionItems(db, [item('a300', { bandId: 5 }), item('a900', { labelId: 6 })]);
    await hide(db, { kind: 'band', bandId: 5, name: 'Artist' }, 0);
    await hide(db, { kind: 'label', labelId: 6, name: 'Label' }, 0);

    expect(before).toEqual(expect.arrayContaining(['a300', 'a900']));
    expect(await ranking('a100')).toEqual(before.filter((key) => key !== 'a300' && key !== 'a900'));
  });

  it('flags heard picks, and leaves them out when asked', async () => {
    await seedBigRelease();
    const before = await ranking('a100');
    await markHeard(db, 'a300', 'preview', 0);

    const shown = await computeAlsoBought(db, 'a100', ME);
    const left = await computeAlsoBought(db, 'a100', ME, { hideHeard: true });

    expect(shown.rows.find((row) => row.matchKey === 'a300')?.heard).toBe(true);
    expect(left.rows.map((row) => row.matchKey)).toEqual(before.filter((key) => key !== 'a300'));
  });

  it('shows a track when only tracks of the album are known', async () => {
    await fans(range(10, 12), [item('a100'), track('t401', 'a400')]);
    await listSupporters('a100', range(10, 12));

    const [row] = (await computeAlsoBought(db, 'a100', ME)).rows;

    expect(row).toMatchObject({ matchKey: 'a400', title: 'Title t401' });
  });

  it('scores a track page against its album', async () => {
    await seedBigRelease();
    await upsertCollectionItems(db, [track('t101', 'a100')]);
    await listSupporters('t101', [...range(10, 19), 40]);

    expect(await ranking('t101')).toEqual(await ranking('a100'));
  });

  it('only filters what it can when nobody is logged in', async () => {
    await seedBigRelease();

    // Hidden still applies. a500 and a950 rank below their peers a600 and a900: your copy makes
    // each one owner more common.
    expect(await ranking('a100', null)).toEqual([
      'a300',
      'a200',
      'a400',
      'a600',
      'a900',
      'a500',
      'a950',
    ]);
  });

  it('boosts releases your crate mates among the supporters own', async () => {
    await seedBigRelease();
    // Fan 30 is your best crate mate but doesn't own a100, so their a200 copy doesn't count.
    await replaceCrateMates(
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

    // a200 (fan 17, share 0.5): 3.85 × 1.25 ≈ 4.8 passes a300's 4.0.
    // a900 (fans 17 and 18, share 1): 2.57 × 1.5 ≈ 3.85 passes a400's 3.75.
    const { rows } = await computeAlsoBought(db, 'a100', ME);
    expect(rows.map((row) => [row.matchKey, row.reason])).toEqual([
      ['a200', { kind: 'co-owned', owners: 8, crateMates: 1 }],
      ['a300', { kind: 'co-owned', owners: 5, crateMates: 0 }],
      ['a900', { kind: 'co-owned', owners: 3, crateMates: 2 }],
      ['a400', { kind: 'co-owned', owners: 4, crateMates: 0 }],
    ]);
  });

  it('nudges releases from an account you follow past a close call, and says so', async () => {
    await seedBigRelease();
    // a200 (≈ 3.85) sits just behind a300 (≈ 4.0); ×1.25 lifts it to ≈ 4.8.
    await upsertCollectionItems(db, [item('a200', { bandId: 2 })]);
    await putFollowing(db, [
      {
        kind: 'band',
        id: 2,
        name: 'Followed Artist',
        url: '',
        imageId: null,
        location: null,
        followedAt: 0,
      },
    ]);

    const { rows } = await computeAlsoBought(db, 'a100', ME);
    expect(rows.map((row) => row.matchKey)).toEqual(['a200', 'a300', 'a400', 'a900']);
    expect(rows.map((row) => row.followed)).toEqual(['Followed Artist', null, null, null]);

    const off = await computeAlsoBought(db, 'a100', ME, { followingBoost: false });
    expect(off.rows.map((row) => row.matchKey)).toEqual(['a300', 'a200', 'a400', 'a900']);
    expect(off.rows.every((row) => row.followed === null)).toBe(true);
  });

  it('has no co-owned rows before any supporter is scanned', async () => {
    await fans(range(10, 19), [item('a100'), item('a200')], 'queued');
    await listSupporters('a100', range(10, 19));

    const { rows, warmup } = await computeAlsoBought(db, 'a100', ME);
    expect(rows.filter((row) => row.reason.kind === 'co-owned')).toEqual([]);
    expect(warmup).toEqual({ read: 0, readTarget: 10, confident: 0, confidentTarget: 5 });
  });

  it('weighs omnivores down by collection size', async () => {
    await fans(range(10, 15), [item('a100')]);
    await fans(range(10, 12), [item('a200')]);
    await fans(range(13, 15), [item('a300')]);
    await listSupporters('a100', range(10, 15));
    // Fans 13–15 have 2,000 items each: their shared a300 is likelier chance.
    await db.fans.where('fanId').between(13, 15, true, true).modify({ collectionSize: 2000 });

    expect(await ranking('a100')).toEqual(['a200', 'a300']);
  });
});

describe('warm-up', () => {
  const other = { artist: 'Other', bandId: 2 };
  const release = item('a100', { artist: 'Solo', bandId: 5 });

  /** 30 listed supporters; `read` of them scanned, all owning a200 and 6 rare releases. */
  async function seed(read: number) {
    await upsertCollectionItems(db, [release, item('a101', { artist: 'Solo', bandId: 5 })]);
    const rare = range(300, 305).map((n) => item(`a${n}`, other));
    await fans(range(10, 9 + read), [release, item('a200', other), ...rare]);
    await fans(range(10 + read, 39), [release], 'queued');
    await listSupporters('a100', range(10, 39));
    // A big population makes the rare releases stand out.
    await fans(range(100, 299), [item('a999', other)]);
  }

  it('gives early picks until 20 supporters are read, the same artist behind them', async () => {
    await seed(12);

    const { rows, warmup } = await computeAlsoBought(db, 'a100', ME);
    expect(warmup).toEqual({ read: 12, readTarget: 20, confident: 5, confidentTarget: 5 });
    expect(rows.slice(0, -1).every((row) => row.reason.kind === 'co-owned')).toBe(true);
    expect(rows.map((row) => row.matchKey)).toContain('a300');
    expect(rows.at(-1)?.reason).toEqual({ kind: 'same-artist' });
  });

  it('shows co-owned rows once enough supporters are read and enough rows stand out', async () => {
    await seed(20);

    const { rows, warmup } = await computeAlsoBought(db, 'a100', ME);
    expect(warmup).toBeNull();
    expect(rows.every((row) => row.reason.kind === 'co-owned')).toBe(true);
    expect(rows.map((row) => row.matchKey)).toContain('a300');
  });
});

describe('small-release fallback', () => {
  const solo = { artist: 'Solo', bandId: 5 };
  const release = item('a1000', { ...solo, label: 'Tiny Label', labelId: 77 });

  async function seedSmallRelease() {
    await upsertCollectionItems(db, [
      release,
      item('a1001', { ...solo, otherOwners: 2 }),
      item('a1002', { ...solo, artist: 'Labelmate', otherOwners: 40 }),
      item('a1003', { artist: 'Far', bandId: 9, label: 'Tiny Label', labelId: 77 }),
      item('t1004', solo, 'a1001'),
      item('a1005', { ...solo, otherOwners: 99 }),
      item('a1006', { ...solo, otherOwners: 5 }),
    ]);
    await fans([10, 11], [release, item('a2000')]);
    await listSupporters('a1000', [10, 11]);
    await putOwnership(db, ME, [item('a1005', solo)], 'collection');
    await hide(db, { kind: 'release', matchKey: 'a1006' }, 0);
  }

  it('blends in the same artist and label, labelled as such', async () => {
    await seedSmallRelease();

    const { rows } = await computeAlsoBought(db, 'a1000', ME);

    expect(rows.map((row) => [row.matchKey, row.reason])).toEqual([
      ['a2000', { kind: 'co-owned', owners: 2, crateMates: 0 }],
      ['a1001', { kind: 'same-artist' }],
      ['a1002', { kind: 'same-label', label: 'Tiny Label' }],
      ['a1003', { kind: 'same-label', label: 'Tiny Label' }],
    ]);
  });

  it('leaves out picks from a hidden artist or label', async () => {
    await seedSmallRelease();
    await hide(db, { kind: 'band', bandId: 5, name: 'Solo' }, 0);
    await hide(db, { kind: 'label', labelId: 77, name: 'Tiny Label' }, 0);

    expect(await ranking('a1000')).toEqual(['a2000']);
  });

  it('leaves big releases alone', async () => {
    await seedSmallRelease();
    await fans(range(12, 17), [release]);
    await listSupporters('a1000', range(10, 17));

    expect(await ranking('a1000')).toEqual(['a2000']);
  });
});
