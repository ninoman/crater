// A small made-up history written through the real repo functions: your sync, supporter lists,
// fan scans, release pages, follows, a hidden release and a forgotten fan. Deterministic, so
// every recommender's output can be compared before and after a storage change (decisions §19).

import type { CollectionItem, ItemKey, ReleasePageItem, Supporter } from '../../src/bandcamp';
import { computeCrateMates } from '../../src/background/recommend/crateMates';
import {
  addSupporterOwnership,
  type DigheadDb,
  enqueueAt,
  fanJob,
  finishFanScan,
  forgetFansNotSeenSince,
  hideRelease,
  markQuickRead,
  markSynced,
  putFollowing,
  putOwnership,
  saveReleaseSupporters,
  saveViewer,
  upsertCollectionItems,
  upsertReleasePageItem,
  upsertSupporterFans,
} from '../../src/db';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { seededRandom } from '../eval/splits';

export const ME = 1;
export const NOW = Date.UTC(2026, 9, 22);
const DAY = 86_400_000;
const ALBUMS = 80;
/** Albums 0..29 have three tracks each. */
const WITH_TRACKS = 30;
const FANS = Array.from({ length: 40 }, (_, i) => 100 + i);
const FORGOTTEN = 139;

const albumKey = (n: number): ItemKey => `a${1000 + n}`;
const trackKey = (n: number, k: number): ItemKey => `t${20000 + n * 10 + k}`;
/** Two albums known only through their tracks, and standalone tracks. */
const ORPHAN_TRACKS: ItemKey[] = ['t29000', 't29001', 't29002', 't29003'];
const orphanAlbum = (i: number): ItemKey => (i < 2 ? 'a1090' : 'a1091');
const STANDALONE: ItemKey[] = ['t30000', 't30001', 't30002', 't30003', 't30004', 't30005'];

/** Band 15 sells from a custom domain; band 16 has one release under an old subdomain. */
function host(bandId: number, n: number): string {
  if (bandId === 15) return 'music.label15.com';
  if (bandId === 16 && n === 18) return 'oldname16.bandcamp.com';
  return `band${bandId}.bandcamp.com`;
}

function album(n: number, rand: () => number): CollectionItem {
  const bandId = 10 + (n % 12);
  const artist = n === 3 ? 'Various Artists' : `Artist ${bandId}`;
  const labelId = n % 5 === 0 ? 50 : n % 7 === 0 ? 51 : null;
  return {
    itemKey: albumKey(n),
    albumKey: null,
    title: `Release ${n}`,
    artist,
    bandId,
    url: `https://${host(bandId, n)}/album/release-${n}`,
    artId: n % 11 === 0 ? null : 5000 + n,
    purchaseKind: 'album',
    label: labelId === 50 ? 'Label Fifty' : labelId === 51 ? 'Label Fifty-One' : null,
    labelId,
    otherOwners: n % 9 === 0 ? null : Math.floor(rand() ** 2 * 120),
    addedAt: null,
    compilation: artist === 'Various Artists',
  };
}

function track(itemKey: ItemKey, parent: ItemKey | null, bandId: number, rand: () => number) {
  const item: CollectionItem = {
    itemKey,
    albumKey: parent,
    title: `Song ${itemKey}`,
    artist: `Artist ${bandId}`,
    bandId,
    url: `https://${host(bandId, -1)}/track/song-${itemKey.slice(1)}`,
    artId: 7000 + Number(itemKey.slice(1)),
    purchaseKind: 'track',
    label: null,
    labelId: null,
    otherOwners: rand() < 0.2 ? null : Math.floor(rand() * 40),
    addedAt: null,
    compilation: false,
  };
  return item;
}

function catalog(rand: () => number): CollectionItem[] {
  const items: CollectionItem[] = [];
  for (let n = 0; n < ALBUMS; n++) {
    const a = album(n, rand);
    items.push(a);
    if (n < WITH_TRACKS) {
      for (let k = 0; k < 3; k++) items.push(track(trackKey(n, k), a.itemKey, a.bandId, rand));
    }
  }
  ORPHAN_TRACKS.forEach((key, i) => {
    items.push(track(key, orphanAlbum(i), 20, rand));
  });
  for (const key of STANDALONE) items.push(track(key, null, 21, rand));
  return items;
}

const dated = (item: CollectionItem, addedAt: number | null): CollectionItem => ({
  ...item,
  addedAt,
});

/** What a release page says about an item seen in collections. */
function pageItem(item: CollectionItem, tags: string[]): ReleasePageItem {
  const { itemKey, albumKey, title, artist, bandId, url, artId } = item;
  return { itemKey, albumKey, title, artist, bandId, url, artId, tags, compilation: false };
}

function supporter(fanId: number, purchasedAt: number | null): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: fanId % 3 === 0 ? null : fanId * 10,
    token: `1:${purchasedAt ?? 0}:${fanId}:0:1:0`,
    purchasedAt,
    isReviewer: false,
  };
}

export async function buildScenario(db: DigheadDb): Promise<void> {
  const rand = seededRandom(11);
  const items = catalog(rand);
  const byKey = new Map(items.map((item) => [item.itemKey, item]));
  const get = (key: ItemKey) => byKey.get(key) as CollectionItem;

  await saveViewer(db, { fanId: ME, username: 'me' });

  // Supporter lists first, so later collection reads meet existing rows.
  const a0Fans = FANS.slice(0, 26);
  const a0Supporters = a0Fans.map((fanId) => supporter(fanId, NOW - (fanId - 90) * 9 * DAY));
  await upsertSupporterFans(db, a0Supporters, NOW);
  await addSupporterOwnership(db, get(albumKey(0)), a0Supporters);
  await saveReleaseSupporters(db, albumKey(0), a0Fans, NOW);
  const t1Fans = FANS.slice(26, 31);
  const t1Supporters = t1Fans.map((fanId) => supporter(fanId, NOW - fanId * DAY));
  await upsertSupporterFans(db, t1Supporters, NOW);
  await addSupporterOwnership(db, get(trackKey(0, 1)), t1Supporters);
  await saveReleaseSupporters(db, trackKey(0, 1), t1Fans, NOW);

  // Your collection and wishlist.
  const mine: CollectionItem[] = [];
  for (let n = 0; n < 25; n++) mine.push(dated(get(albumKey(n)), NOW - n * 20 * DAY));
  mine.push(dated(get(trackKey(25, 1)), NOW - 3 * DAY));
  mine.push(dated(get('t29000'), NOW - 400 * DAY));
  mine.push(dated(get('t30000'), null));
  const wish = [albumKey(40), albumKey(41), trackKey(26, 2), 't30001' as ItemKey].map((key, i) =>
    dated(get(key), NOW - i * DAY),
  );
  await upsertCollectionItems(db, [...mine, ...wish]);
  await putOwnership(db, ME, wish, 'wishlist');
  await putOwnership(db, ME, mine, 'collection');
  await markSynced(db, NOW);

  // Scanned fans: albums owned less often the higher their number, a few tracks and singles.
  for (const fanId of FANS) {
    const owned: CollectionItem[] = [];
    const when = () => (rand() < 0.1 ? null : NOW - Math.floor(rand() * 700) * DAY);
    for (let n = 0; n < ALBUMS; n++) {
      if (rand() < 0.6 * (1 - n / 100)) owned.push(dated(get(albumKey(n)), when()));
      if (n < WITH_TRACKS) {
        for (let k = 0; k < 3; k++) {
          if (rand() < 0.08) owned.push(dated(get(trackKey(n, k)), when()));
        }
      }
    }
    for (const key of [...ORPHAN_TRACKS, ...STANDALONE]) {
      if (rand() < 0.25) owned.push(dated(get(key), when()));
    }
    const seenAt = fanId === FORGOTTEN ? NOW - 400 * DAY : NOW;
    await upsertSupporterFans(db, [supporter(fanId, null)], seenAt);
    await upsertCollectionItems(db, owned);
    await putOwnership(db, fanId, owned, 'collection');
    if (fanId === 137) continue; // still queued
    if (fanId === 138) await markQuickRead(db, fanId, owned.length, NOW);
    else
      await finishFanScan(db, fanId, fanId % 10 === 7 ? 'partial' : 'done', owned.length, seenAt);
  }
  await forgetFansNotSeenSince(db, NOW - 180 * DAY, ME);

  // Release pages you opened: tags, a track page, and a release no collection has shown.
  await upsertReleasePageItem(db, pageItem(get(albumKey(0)), ['dub', 'techno']));
  await upsertReleasePageItem(db, pageItem(get(trackKey(0, 1)), []));
  await upsertReleasePageItem(db, {
    itemKey: 'a1085',
    albumKey: null,
    title: 'Page Only',
    artist: 'Artist 15',
    bandId: 15,
    url: 'https://music.label15.com/album/page-only',
    artId: 9999,
    tags: ['ambient'],
    compilation: false,
  });

  await putFollowing(db, [
    {
      kind: 'band',
      id: 12,
      name: 'Artist 12',
      url: 'https://band12.bandcamp.com',
      imageId: null,
      location: null,
      followedAt: NOW,
    },
    {
      kind: 'fan',
      id: 101,
      name: 'Fan 101',
      url: 'https://bandcamp.com/fan101',
      imageId: null,
      location: null,
      followedAt: NOW,
    },
  ]);
  await hideRelease(db, albumKey(30), NOW);
  await enqueueAt(
    db,
    a0Fans
      .slice(18)
      .map((fanId, i) => ({ spec: fanJob(fanId, albumKey(0)), at: NOW, rank: i + 1 })),
    2,
  );
  await computeCrateMates(
    { db, settings: DEFAULT_SETTINGS, now: NOW, yieldNow: async () => undefined },
    ME,
  );
}
