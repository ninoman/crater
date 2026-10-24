import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BandFacts, CollectionItem, ItemKey, ReleaseFacts } from '../../bandcamp';
import {
  DigheadDb,
  finishFanScan,
  getMe,
  markSynced,
  putOwnership,
  replaceCrateMates,
  saveViewer,
  upsertCollectionItems,
  upsertSupporterFans,
} from '../../db';
import { FILTER_SEARCH_LIMIT, NO_FILTERS, type ListFilters } from '../../shared/listFilters';
import { computeAlsoBought } from './alsoBought';
import { computeCrateMatesLatest } from './crateMatesLatest';
import { computeDeepCuts } from './deepCuts';
import { computeForYou, type ForYouInput } from './forYou';

const ME = 1;
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const only = (patch: Partial<ListFilters>): ListFilters => ({ ...NO_FILTERS, ...patch });

interface Spec {
  /** Bandcamp's owner count minus one. */
  otherOwners?: number;
  bandId?: number;
  genre?: number | null;
  location?: string | null;
  facts?: Partial<ReleaseFacts>;
  daysAgo?: number;
}

function release(itemKey: ItemKey, spec: Spec = {}): CollectionItem {
  const band: BandFacts = { genre: spec.genre ?? null, location: spec.location ?? null };
  return {
    itemKey,
    albumKey: null,
    title: `Title ${itemKey}`,
    artist: `Artist ${itemKey}`,
    bandId: spec.bandId ?? Number(itemKey.slice(1)),
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: 7,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: spec.otherOwners ?? 3,
    addedAt: spec.daysAgo === undefined ? null : NOW - spec.daysAgo * DAY,
    compilation: false,
    facts: { year: null, nameYourPrice: null, physical: null, ...spec.facts },
    band,
  };
}

async function own(
  fanId: number,
  items: CollectionItem[],
  source: 'collection' | 'wishlist' = 'collection',
) {
  await upsertCollectionItems(db, items);
  await putOwnership(db, fanId, items, source);
}

async function crateMates(fanIds: number[]) {
  await replaceCrateMates(
    db,
    fanIds.map((fanId, i) => ({
      fanId,
      overlap: 3,
      jaccard: 0.1,
      score: fanIds.length - i,
      labelCluster: false,
      lately: fanIds.length - i,
      yearAgo: null,
      latelyOverlap: 1,
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

const forYou = (filters?: ListFilters, homePlace = ''): ForYouInput => ({
  mode: 'all',
  topCrateMatesK: 5,
  latelyHalfLifeMonths: 6,
  followingBoost: false,
  ignoreCompilations: true,
  now: 0,
  filters,
  homePlace,
});

describe('For you with filters', () => {
  async function seed() {
    await own(10, [
      release('a1', { genre: 10, location: 'Leipzig, Germany' }),
      release('a2', { genre: 3, location: 'Berlin, Germany' }),
      release('a3', { genre: 10, location: 'Lyon, France', facts: { physical: true } }),
      release('a4'),
    ]);
    await crateMates([10]);
  }

  it('leaves a list alone when no filter is on', async () => {
    await seed();

    const result = await computeForYou(db, await me(), forYou(NO_FILTERS));

    expect(result.rows.map((row) => row.matchKey).sort()).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(result.filtered).toBeUndefined();
  });

  it('keeps releases in the chosen genre, and counts what it hid, including what it could not judge', async () => {
    await seed();

    const result = await computeForYou(db, await me(), forYou(only({ genres: [10] })));

    expect(result.rows.map((row) => row.matchKey).sort()).toEqual(['a1', 'a3']);
    // a2 is another genre; a4 has no genre known.
    expect(result.filtered).toEqual({
      filters: only({ genres: [10] }),
      summary: { hidden: 2, unjudged: 1, limited: false },
    });
  });

  it('matches near me against the place in settings, only when one is set', async () => {
    await seed();

    const near = await computeForYou(db, await me(), forYou(only({ nearMe: true }), 'Germany'));
    expect(near.rows.map((row) => row.matchKey).sort()).toEqual(['a1', 'a2']);

    const noPlace = await computeForYou(db, await me(), forYou(only({ nearMe: true }), ''));
    expect(noPlace.rows).toHaveLength(4);
    expect(noPlace.filtered).toBeUndefined();
  });

  it('combines filters', async () => {
    await seed();

    const result = await computeForYou(
      db,
      await me(),
      forYou(only({ genres: [10], physical: true })),
    );

    expect(result.rows.map((row) => row.matchKey)).toEqual(['a3']);
  });

  it('filters before cutting the list, so matches ranked below the cut still show', async () => {
    // 70 releases, more than the 60 ranked before the list is cut to 30; only the last 5 are genre 10.
    const items = Array.from({ length: 70 }, (_, i) =>
      release(`a${100 + i}`, { genre: i >= 65 ? 10 : 3, otherOwners: 500 - i }),
    );
    await own(10, items);
    await crateMates([10]);

    const unfiltered = await computeForYou(db, await me(), forYou());
    const filtered = await computeForYou(db, await me(), forYou(only({ genres: [10] })));

    expect(unfiltered.rows).toHaveLength(30);
    expect(filtered.rows.map((row) => row.matchKey).sort()).toEqual([
      'a165',
      'a166',
      'a167',
      'a168',
      'a169',
    ]);
    expect(filtered.filtered?.summary).toEqual({ hidden: 65, unjudged: 0, limited: false });
  });

  it('tells Fresh and All time apart no more than before', async () => {
    await seed();
    await crateMates([10]);

    const fresh = await computeForYou(db, await me(), {
      ...forYou(only({ genres: [3] })),
      mode: 'fresh',
      now: NOW,
    });

    // Purchases with no date score nothing in Fresh, so the filter has nothing to keep.
    expect(fresh.rows).toEqual([]);
  });
});

describe('Deep cuts with filters', () => {
  it('keeps the deep cuts in the chosen genre', async () => {
    const rare = [
      release('a1', { genre: 10, otherOwners: 2 }),
      release('a2', { genre: 3, otherOwners: 2 }),
    ];
    await own(10, rare);
    await own(11, rare);
    await crateMates([10, 11]);
    const input = { maxSupporters: 50, ignoreCompilations: true };

    const all = await computeDeepCuts(db, await me(), input);
    const filtered = await computeDeepCuts(db, await me(), {
      ...input,
      filters: only({ genres: [3] }),
    });

    expect(all.rows.map((row) => row.matchKey).sort()).toEqual(['a1', 'a2']);
    expect(filtered.rows.map((row) => row.matchKey)).toEqual(['a2']);
    expect(filtered.filtered?.summary).toEqual({ hidden: 1, unjudged: 0, limited: false });
  });
});

describe("Crate mates' latest with filters", () => {
  it('keeps the purchases that pass, and still fills the list from deeper in the feed', async () => {
    const items = Array.from({ length: 130 }, (_, i) =>
      release(`a${100 + i}`, { daysAgo: 1 + i / 10, genre: i >= 120 ? 10 : 3 }),
    );
    await own(10, items);
    await upsertSupporterFans(
      db,
      [
        {
          fanId: 10,
          username: 'fan10',
          name: 'Fan 10',
          imageId: null,
          token: '',
          purchasedAt: null,
          isReviewer: false,
        },
      ],
      0,
    );
    await crateMates([10]);

    const result = await computeCrateMatesLatest(db, await me(), 5, NOW, {
      filters: only({ genres: [10] }),
    });

    // The newest 120 are another genre, past the 100 spare the unfiltered feed looks at.
    expect(result.rows).toHaveLength(10);
    expect(result.filtered?.summary).toEqual({ hidden: 120, unjudged: 0, limited: false });
  });
});

describe('Also bought with filters', () => {
  /** Release a100 with 10 scanned supporters who also own a200 (genre 10) and a300 (genre 3). */
  async function seed() {
    const mine = [release('a100'), release('a200', { genre: 10 }), release('a300', { genre: 3 })];
    for (let fanId = 10; fanId < 20; fanId++) {
      await upsertCollectionItems(db, mine);
      await upsertSupporterFans(
        db,
        [
          {
            fanId,
            username: `fan${fanId}`,
            name: `Fan ${fanId}`,
            imageId: null,
            token: `1:1:${fanId}:0:1:0`,
            purchasedAt: null,
            isReviewer: false,
          },
        ],
        0,
      );
      await putOwnership(db, fanId, mine, 'collection');
      await finishFanScan(db, fanId, 'done', 3, 0);
    }
  }

  it('drops releases outside the filter from the co-owned rows', async () => {
    await seed();

    const result = await computeAlsoBought(db, 'a100', ME, { filters: only({ genres: [10] }) });

    expect(result.rows.map((row) => row.matchKey)).toEqual(['a200']);
    expect(result.filtered?.summary.hidden).toBe(1);
    expect(result.filtered?.filters).toEqual(only({ genres: [10] }));
  });

  it('is unchanged without filters', async () => {
    await seed();

    const result = await computeAlsoBought(db, 'a100', ME);

    expect(result.rows.map((row) => row.matchKey).sort()).toEqual(['a200', 'a300']);
    expect(result.filtered).toBeUndefined();
  });
});

describe('the search limit', () => {
  it('stops after FILTER_SEARCH_LIMIT candidates and says so', async () => {
    const items = Array.from({ length: FILTER_SEARCH_LIMIT + 300 }, (_, i) =>
      release(`a${1000 + i}`, { genre: 3, otherOwners: 100_000 - i }),
    );
    await own(10, items);
    await crateMates([10]);

    const result = await computeForYou(db, await me(), forYou(only({ genres: [10] })));

    expect(result.rows).toEqual([]);
    expect(result.filtered?.summary).toEqual({
      hidden: FILTER_SEARCH_LIMIT,
      unjudged: 0,
      limited: true,
    });
  }, 30_000);
});
