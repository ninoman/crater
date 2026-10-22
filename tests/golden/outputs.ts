// Everything the recommenders and the item and ownership reads answer for the golden scenario,
// as plain JSON. Storage changes must leave all of it exactly as it was (decisions §19).

import type { ItemKey } from '../../src/bandcamp';
import { computeAlsoBought } from '../../src/background/recommend/alsoBought';
import { computeDeepCuts } from '../../src/background/recommend/deepCuts';
import { computeForYou } from '../../src/background/recommend/forYou';
import { computeReleaseCrateMates } from '../../src/background/recommend/releaseCrateMates';
import { readCrateMatesResult } from '../../src/background/recommend/crateMateRows';
import { computeCrateMatesLatest } from '../../src/background/recommend/crateMatesLatest';
import { rankSupporters } from '../../src/background/scanner/passZero';
import {
  collectionRows,
  collectorsOf,
  countOwnership,
  type DigheadDb,
  getCompilations,
  getDisplayItems,
  getItems,
  getMe,
  getSellerItems,
  knownItemKeys,
  listWishlist,
  ownedItemKeys,
  pageBadges,
  purchasedAt,
} from '../../src/db';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { ME, NOW } from './scenario';

const RELEASES: ItemKey[] = ['a1000', 'a1005', 't20001', 'a1090', 'a1085', 'a1050'];

/** Sets and maps as sorted arrays, and `fetchedAt` dropped: it says when, not what. */
function plain(value: unknown): unknown {
  if (value instanceof Set) return [...value].map(plain).sort();
  if (value instanceof Map) {
    return [...value]
      .map(([k, v]) => [k, plain(v)])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }
  if (ArrayBuffer.isView(value)) return [...(value as Float64Array)];
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'fetchedAt')
        .map(([key, v]) => [key, plain(v)]),
    );
  }
  return value;
}

export async function collectOutputs(db: DigheadDb): Promise<unknown> {
  const me = await getMe(db);
  const out: Record<string, unknown> = {};

  out.crateMates = await readCrateMatesResult(db, DEFAULT_SETTINGS.latelyHalfLifeMonths);
  for (const key of RELEASES) {
    out[`alsoBought ${key}`] = await computeAlsoBought(db, key, ME);
    out[`releaseCrateMates ${key}`] = await computeReleaseCrateMates(db, key);
  }
  for (const mode of ['all', 'fresh'] as const) {
    out[`forYou ${mode}`] = await computeForYou(db, me, {
      mode,
      topCrateMatesK: DEFAULT_SETTINGS.topCrateMatesK,
      latelyHalfLifeMonths: DEFAULT_SETTINGS.latelyHalfLifeMonths,
      followingBoost: true,
      ignoreCompilations: true,
      now: NOW,
    });
  }
  out.deepCuts = await computeDeepCuts(db, me, {
    maxSupporters: DEFAULT_SETTINGS.deepCutMaxSupporters,
    ignoreCompilations: true,
  });
  out.crateMatesLatest = await computeCrateMatesLatest(
    db,
    me,
    DEFAULT_SETTINGS.topCrateMatesK,
    NOW,
  );
  out.pageBadges = await pageBadges(
    db,
    [
      { url: 'https://band11.bandcamp.com/album/release-1', itemKey: null },
      { url: 'https://music.label15.com/album/release-5', itemKey: null },
      { url: 'https://music.label15.com/album/page-only', itemKey: null },
      { url: 'https://oldname16.bandcamp.com/album/release-18', itemKey: null },
      { url: 'https://band16.bandcamp.com/album/release-18', itemKey: null },
      { url: 'https://band10.bandcamp.com/track/song-20001', itemKey: null },
      { url: 'https://band20.bandcamp.com/track/song-29000', itemKey: null },
      { url: 'https://band21.bandcamp.com/track/song-30001', itemKey: null },
      { url: 'https://band12.bandcamp.com/album/release-404', itemKey: null },
      { url: 'https://band12.bandcamp.com/album/whatever', itemKey: 'a1002' },
      { url: 'https://band12.bandcamp.com/album/whatever', itemKey: 'a1090' },
      { url: 'https://band12.bandcamp.com/album/whatever', itemKey: 'a1999' },
    ],
    DEFAULT_SETTINGS.topCrateMatesK,
  );
  out.wishlist = await listWishlist(db, ME);

  const allKeys = (await db.items.toCollection().primaryKeys()).sort();
  out.items = await getItems(db, allKeys);
  out.displayItems = await getDisplayItems(db, ['a1090', 'a1091', 'a1000', 't30000', 'a1999']);
  out.sellerItems = (await getSellerItems(db, 15, 50)).map((item) => item.itemKey).sort();
  out.compilations = await getCompilations(db, [1000, 1003, 1090, -30000]);

  out.collectors = await collectorsOf(db, 'a1000');
  out.collectorsTrack = await collectorsOf(db, 't20001');
  out.myCollection = await ownedItemKeys(db, ME, 'collection');
  out.myWishlist = await ownedItemKeys(db, ME, 'wishlist');
  out.myRows = (await collectionRows(db, ME)).sort((a, b) => a.itemKey.localeCompare(b.itemKey));
  out.counts = [
    await countOwnership(db, ME, 'collection'),
    await countOwnership(db, ME, 'wishlist'),
  ];
  out.known = await knownItemKeys(db, 110, [
    'a1000',
    'a1001',
    'a1002',
    't20001',
    't30000',
    'a1079',
  ]);
  out.purchasedAt = await Promise.all(
    [100, 110, 121, 125, 128].map((fanId) => purchasedAt(db, fanId, 'a1000')),
  );

  await rankSupporters(db, 'a1000');
  out.queue = (await db.queue.toArray()).map(({ kind, target, priority, rank, nextAttemptAt }) => ({
    kind,
    target,
    priority,
    rank,
    nextAttemptAt,
  }));
  return plain(out);
}
