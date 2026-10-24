import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import {
  DigheadDb,
  getMe,
  hide,
  markHeard,
  markSynced,
  putOwnership,
  replaceCrateMates,
  saveViewer,
  upsertCollectionItems,
} from '../../db';
import { computeDeepCuts, type DeepCutsInput } from './deepCuts';

const ME = 1;
const INPUT: DeepCutsInput = { maxSupporters: 50, ignoreCompilations: true, hideHeard: false };

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

/** `owners` is Bandcamp's count (otherOwners + 1); null when Bandcamp gave none. */
function item(itemKey: ItemKey, owners: number | null): CollectionItem {
  return {
    itemKey,
    albumKey: null,
    title: `Title ${itemKey}`,
    artist: `Artist ${itemKey}`,
    bandId: 1,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: 7,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: owners === null ? null : owners - 1,
    addedAt: null,
    compilation: false,
  };
}

async function own(fanId: number, items: CollectionItem[]) {
  await upsertCollectionItems(db, items);
  await putOwnership(db, fanId, items, 'collection');
}

async function me() {
  await saveViewer(db, { fanId: ME, username: 'me' });
  await markSynced(db, 0);
  return getMe(db);
}

/** The research doc's set: crate mates A–E (10–14) scoring 0.6 down to 0.2. You own a7. */
async function seed() {
  const staple = item('a1', 40);
  const niche = item('a2', 3);
  const mid = item('a3', 25);
  const hit = item('a4', 2000);
  const lone = item('a5', 1);
  const noCount = item('a6', null);
  const mine = item('a7', 2);
  await own(10, [staple, mid, hit, mine]);
  await own(11, [staple, mid, hit]);
  await own(12, [staple, niche, hit]);
  await own(13, [staple, niche, hit, noCount]);
  await own(14, [staple, hit, lone]);
  await own(ME, [mine]);
  await replaceCrateMates(
    db,
    [0.6, 0.5, 0.4, 0.3, 0.2].map((score, i) => ({
      fanId: 10 + i,
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

describe('computeDeepCuts', () => {
  it('ranks rare releases your crate mates own, leaving out hits, uncounted and owned ones', async () => {
    await seed();

    const result = await computeDeepCuts(db, await me(), INPUT);

    expect(result.rows.map((row) => row.matchKey)).toEqual(['a2', 'a1', 'a3', 'a5']);
    expect(result).toMatchObject({ basis: 'ready', crateMatesUsed: 5 });
  });

  it('gives the reason-line facts', async () => {
    await seed();

    const { rows } = await computeDeepCuts(db, await me(), INPUT);

    expect(rows[0]).toMatchObject({
      matchKey: 'a2',
      supporters: 3,
      crateMates: 2,
      bestCrateMateRank: 3,
      lastBoughtAt: null,
      followed: null,
    });
  });

  it('leaves out heard releases when asked, and hidden artists always', async () => {
    await seed();
    await markHeard(db, 'a2', 'preview', 0);
    await upsertCollectionItems(db, [{ ...item('a3', 25), bandId: 5 }]);
    await hide(db, { kind: 'band', bandId: 5, name: 'Artist a3' }, 0);

    const shown = await computeDeepCuts(db, await me(), INPUT);
    const left = await computeDeepCuts(db, await me(), { ...INPUT, hideHeard: true });

    expect(shown.rows.map((row) => [row.matchKey, row.heard])).toEqual([
      ['a2', true],
      ['a1', false],
      ['a5', false],
    ]);
    expect(left.rows.map((row) => row.matchKey)).toEqual(['a1', 'a5']);
  });

  it('follows the cap setting', async () => {
    await seed();

    const { rows } = await computeDeepCuts(db, await me(), { ...INPUT, maxSupporters: 30 });

    expect(rows.map((row) => row.matchKey)).toEqual(['a2', 'a3', 'a5']);
  });

  it('is empty when no one is signed in', async () => {
    expect(await computeDeepCuts(db, undefined, INPUT)).toEqual({
      basis: 'no-viewer',
      rows: [],
      crateMatesUsed: 0,
    });
  });
});
