import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DigheadDb, replaceCrateMates, type CrateMateRecord } from '../../db';
import {
  getCrateMateStanding,
  getCrateMateStandings,
  crateMateStanding,
  crateMateStandings,
} from './crateMateStanding';

function crateMate(
  fanId: number,
  score: number,
  overlap = 3,
  jaccard = 0.1,
  lately: number | null = null,
): CrateMateRecord {
  return {
    fanId,
    overlap,
    jaccard,
    score,
    labelCluster: false,
    lately,
    yearAgo: null,
    latelyOverlap: 0,
    computedAt: 7,
  };
}

describe('crateMateStandings', () => {
  const allTime = [crateMate(10, 0.9), crateMate(11, 0.5, 37, 0.125), crateMate(12, 0.2)];
  // 13 is only on the lately board; 11 is on both, at a different place.
  const lately = [crateMate(13, 0.3, 4, 0.2, 0.9), crateMate(11, 0.5, 37, 0.125, 0.6)];

  it('ranks a fan on the all-time board only', () => {
    expect(crateMateStanding(allTime, lately, 10)).toEqual({
      rank: 1,
      latelyRank: null,
      overlap: 3,
      matchPct: 10,
    });
  });

  it('ranks a fan on the lately board only', () => {
    expect(crateMateStanding(allTime, lately, 13)).toEqual({
      rank: null,
      latelyRank: 1,
      overlap: 4,
      matchPct: 20,
    });
  });

  it('ranks a fan on both boards separately', () => {
    expect(crateMateStanding(allTime, lately, 11)).toEqual({
      rank: 2,
      latelyRank: 2,
      overlap: 37,
      matchPct: 12.5,
    });
  });

  it('is null for a fan on neither board', () => {
    expect(crateMateStanding(allTime, lately, 99)).toBeNull();
    expect(crateMateStanding([], [], 10)).toBeNull();
  });

  it('answers each fan as crateMateStanding does, leaving out fans on neither', () => {
    expect(crateMateStandings(allTime, lately, [13, 11, 99])).toEqual({
      13: crateMateStanding(allTime, lately, 13),
      11: crateMateStanding(allTime, lately, 11),
    });
    expect(crateMateStandings(allTime, lately, [])).toEqual({});
  });
});

describe('getCrateMateStanding', () => {
  let db: DigheadDb;

  beforeEach(async () => {
    db = new DigheadDb(`test-${crypto.randomUUID()}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('ranks by stored score and lately score, not insertion order', async () => {
    await replaceCrateMates(
      db,
      [crateMate(11, 0.2, 3, 0.1, 0.8), crateMate(10, 0.5, 5, 0.25, 0.1)],
      [crateMate(11, 0.2, 3, 0.1, 0.8), crateMate(10, 0.5, 5, 0.25, 0.1)],
    );

    expect(await getCrateMateStanding(db, 10)).toEqual({
      rank: 1,
      latelyRank: 2,
      overlap: 5,
      matchPct: 25,
    });
    expect(await getCrateMateStanding(db, 11)).toMatchObject({ rank: 2, latelyRank: 1 });
    expect(await getCrateMateStanding(db, 12)).toBeNull();
  });

  it('batches the same answers in one read', async () => {
    await replaceCrateMates(
      db,
      [crateMate(11, 0.2), crateMate(10, 0.5, 5, 0.25)],
      [crateMate(12, 0.1, 2, 0.1, 0.5)],
    );

    expect(await getCrateMateStandings(db, [10, 11, 12, 13])).toEqual({
      10: await getCrateMateStanding(db, 10),
      11: await getCrateMateStanding(db, 11),
      12: await getCrateMateStanding(db, 12),
    });
  });
});
