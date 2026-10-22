// A small made-up database as a backup file, for testing the eval end to end.

import { buildMatchIndex, DigheadDb, exportDatabase } from '../../src/db';
import type { FanRecord, ItemRecord, OwnershipRecord } from '../../src/db';
import { seededRandom } from './splits';

const ME = 1;
const MINE = 40;
const FANS = 30;
const EXTRAS = 60;
const DAY_MS = 86_400_000;

const key = (n: number) => `a${n}` as const;

function item(n: number, supporterCount: number): ItemRecord {
  return {
    itemKey: key(n),
    albumKey: null,
    title: `Release ${n}`,
    artist: `Artist ${n}`,
    bandId: n,
    label: null,
    labelId: null,
    url: `https://artist${n}.bandcamp.com/album/r${n}`,
    artId: null,
    tags: [],
    supporterCount,
    compilation: false,
  };
}

function row(fanId: number, n: number, addedAt: number | null): OwnershipRecord {
  return { fanId, itemKey: key(n), matchKey: key(n), source: 'collection', addedAt };
}

function fan(fanId: number, scanned: number): FanRecord {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: null,
    collectionSize: scanned,
    scannedItems: scanned,
    collectionFetchedAt: 0,
    status: 'done',
    lastSeenAt: 0,
  };
}

/**
 * You own releases 1..40 (dated, one a day). Each of 30 fans owns about half of yours plus
 * some of 60 extra releases, skewed so low-numbered extras are widely owned and high ones rare.
 */
export async function syntheticBackup(): Promise<Blob> {
  const db = new DigheadDb(`synthetic-${crypto.randomUUID()}`);
  await db.open();
  const next = seededRandom(7);
  const rows: OwnershipRecord[] = [];
  const fans: FanRecord[] = [fan(ME, MINE)];
  for (let n = 1; n <= MINE; n++) rows.push(row(ME, n, n * DAY_MS));
  for (let fanId = 100; fanId < 100 + FANS; fanId++) {
    const owned = new Set<number>();
    for (let n = 1; n <= MINE; n++) if (next() < 0.5) owned.add(n);
    for (let n = MINE + 1; n <= MINE + EXTRAS; n++) {
      if (next() < 0.5 * (1 - (n - MINE) / EXTRAS)) owned.add(n);
    }
    for (const n of owned) rows.push(row(fanId, n, null));
    fans.push(fan(fanId, owned.size));
  }
  const items = Array.from({ length: MINE + EXTRAS }, (_, i) =>
    item(i + 1, 1 + Math.floor(next() ** 3 * 500)),
  );
  const index = buildMatchIndex(rows);
  await db.me.put({ id: 'self', fanId: ME, username: 'me', syncedAt: 0 });
  await db.fans.bulkPut(fans);
  await db.items.bulkPut(items);
  await db.ownership.bulkPut(rows);
  await db.fanMatches.bulkPut(index.fanMatches);
  await db.matchOwners.bulkPut(index.matchOwners);
  const { file } = await exportDatabase(db);
  await db.delete();
  return file;
}
