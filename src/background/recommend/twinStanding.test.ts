import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DigheadDb, replaceTwins, type TwinRecord } from '../../db';
import { getTwinStanding, getTwinStandings, twinStanding, twinStandings } from './twinStanding';

function twin(
  fanId: number,
  score: number,
  overlap = 3,
  jaccard = 0.1,
  lately: number | null = null,
): TwinRecord {
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

describe('twinStandings', () => {
  const allTime = [twin(10, 0.9), twin(11, 0.5, 37, 0.125), twin(12, 0.2)];
  // 13 is only on the lately board; 11 is on both, at a different place.
  const lately = [twin(13, 0.3, 4, 0.2, 0.9), twin(11, 0.5, 37, 0.125, 0.6)];

  it('ranks a fan on the all-time board only', () => {
    expect(twinStanding(allTime, lately, 10)).toEqual({
      rank: 1,
      latelyRank: null,
      overlap: 3,
      matchPct: 10,
    });
  });

  it('ranks a fan on the lately board only', () => {
    expect(twinStanding(allTime, lately, 13)).toEqual({
      rank: null,
      latelyRank: 1,
      overlap: 4,
      matchPct: 20,
    });
  });

  it('ranks a fan on both boards separately', () => {
    expect(twinStanding(allTime, lately, 11)).toEqual({
      rank: 2,
      latelyRank: 2,
      overlap: 37,
      matchPct: 12.5,
    });
  });

  it('is null for a fan on neither board', () => {
    expect(twinStanding(allTime, lately, 99)).toBeNull();
    expect(twinStanding([], [], 10)).toBeNull();
  });

  it('answers each fan as twinStanding does, leaving out fans on neither', () => {
    expect(twinStandings(allTime, lately, [13, 11, 99])).toEqual({
      13: twinStanding(allTime, lately, 13),
      11: twinStanding(allTime, lately, 11),
    });
    expect(twinStandings(allTime, lately, [])).toEqual({});
  });
});

describe('getTwinStanding', () => {
  let db: DigheadDb;

  beforeEach(async () => {
    db = new DigheadDb(`test-${crypto.randomUUID()}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('ranks by stored score and lately score, not insertion order', async () => {
    await replaceTwins(
      db,
      [twin(11, 0.2, 3, 0.1, 0.8), twin(10, 0.5, 5, 0.25, 0.1)],
      [twin(11, 0.2, 3, 0.1, 0.8), twin(10, 0.5, 5, 0.25, 0.1)],
    );

    expect(await getTwinStanding(db, 10)).toEqual({
      rank: 1,
      latelyRank: 2,
      overlap: 5,
      matchPct: 25,
    });
    expect(await getTwinStanding(db, 11)).toMatchObject({ rank: 2, latelyRank: 1 });
    expect(await getTwinStanding(db, 12)).toBeNull();
  });

  it('batches the same answers in one read', async () => {
    await replaceTwins(db, [twin(11, 0.2), twin(10, 0.5, 5, 0.25)], [twin(12, 0.1, 2, 0.1, 0.5)]);

    expect(await getTwinStandings(db, [10, 11, 12, 13])).toEqual({
      10: await getTwinStanding(db, 10),
      11: await getTwinStanding(db, 11),
      12: await getTwinStanding(db, 12),
    });
  });
});
