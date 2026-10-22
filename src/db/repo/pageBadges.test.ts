import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import type { ReleaseRef } from '../../shared/pageBadges';
import { DigheadDb, type CrateMateRecord } from '../schema';
import { upsertCollectionItems } from './items';
import { saveViewer } from './me';
import { putOwnership } from './ownership';
import { pageBadges } from './pageBadges';
import { replaceCrateMates } from './crateMates';

const ME = 1;

function item(itemKey: ItemKey, albumKey: ItemKey | null = null): CollectionItem {
  return {
    itemKey,
    albumKey,
    title: itemKey,
    artist: 'A',
    bandId: 1,
    url: `https://a.bandcamp.com/${itemKey[0] === 'a' ? 'album' : 'track'}/${itemKey}`,
    artId: null,
    purchaseKind: itemKey[0] === 'a' ? 'album' : 'track',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: null,
    compilation: false,
  };
}

function crateMate(fanId: number, score: number): CrateMateRecord {
  return {
    fanId,
    overlap: 1,
    jaccard: 0.1,
    score,
    labelCluster: false,
    lately: null,
    yearAgo: null,
    latelyOverlap: 0,
    computedAt: 0,
  };
}

function byUrl(key: ItemKey): ReleaseRef {
  return { url: item(key).url, itemKey: null };
}

let db: DigheadDb;

// a1 has tracks t11 and t12. You own a1 and t21 (a track of a2), and wishlisted a3 and t41.
// Crate mates by score: 10 owns a2 and t11, 11 owns a3, 12 owns a3 but ranks past the top 2.
beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
  const all = [
    item('a1'),
    item('t11', 'a1'),
    item('t12', 'a1'),
    item('a2'),
    item('t21', 'a2'),
    item('a3'),
    item('a4'),
    item('t41', 'a4'),
    item('a5'),
  ];
  await upsertCollectionItems(db, all);
  await saveViewer(db, { fanId: ME, username: 'me' });
  await putOwnership(db, ME, [item('a1'), item('t21', 'a2')], 'collection');
  await putOwnership(db, ME, [item('a3'), item('t41', 'a4')], 'wishlist');
  await putOwnership(db, 10, [item('a2'), item('t11', 'a1')], 'collection');
  await putOwnership(db, 11, [item('a3')], 'collection');
  await putOwnership(db, 12, [item('a3'), item('a5')], 'collection');
  await replaceCrateMates(db, [crateMate(10, 3), crateMate(11, 2), crateMate(12, 1)], []);
});

afterEach(async () => {
  await db.delete();
});

describe('pageBadges', () => {
  it('answers one badge per link, in order, from one batch', async () => {
    const refs = [byUrl('a1'), byUrl('t12'), byUrl('a2'), byUrl('a3'), byUrl('t41'), byUrl('a4')];
    const badges = await pageBadges(db, refs, 2);
    expect(badges.map((b) => b && [b.owned, b.wishlisted, b.crateMates])).toEqual([
      [true, false, 1], // a1: yours; crate mate 10 owns a track of it
      [true, false, 1], // t12: its album is yours
      [true, false, 1], // a2: you own a track of it
      [false, true, 1], // a3: wishlisted; crate mate 12 is past the top 2
      [false, true, 0], // t41: wishlisted itself
      [false, false, 0], // a4: only a track of it is wishlisted
    ]);
    expect(badges[0]?.topCrateMates).toBe(2);
  });

  it("doesn't count a track you own for its sibling tracks", async () => {
    await db.ownership.delete([ME, 'a1']);
    await putOwnership(db, ME, [item('t12', 'a1')], 'collection');
    const [sibling, album] = await pageBadges(db, [byUrl('t11'), byUrl('a1')], 30);
    expect(sibling?.owned).toBe(false);
    expect(album?.owned).toBe(true);
  });

  it('counts top crate mates and takes ids from the page over urls', async () => {
    const [a3, a5] = await pageBadges(
      db,
      [
        { url: 'https://elsewhere.example/album/x', itemKey: 'a3' },
        { url: 'https://unknown.example/album/y', itemKey: 'a5' },
      ],
      30,
    );
    expect(a3).toMatchObject({ crateMates: 2, topCrateMates: 3 });
    expect(a5).toMatchObject({ owned: false, wishlisted: false, crateMates: 1 });
  });

  it('is null for a url it has never seen, and empty for no links', async () => {
    expect(
      await pageBadges(db, [{ url: 'https://a.bandcamp.com/album/zzz', itemKey: null }], 30),
    ).toEqual([null]);
    expect(await pageBadges(db, [], 30)).toEqual([]);
  });

  it('knows nothing of your own items before you are detected', async () => {
    await db.me.clear();
    const [a1] = await pageBadges(db, [byUrl('a1')], 30);
    expect(a1).toMatchObject({ owned: false, wishlisted: false, crateMates: 1 });
  });
});
