import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DigheadDb, replaceTwins, type TwinRecord } from '../../db';
import { getTwinStanding, getTwinStandings, twinStanding, twinStandings } from './twinStanding';

function twin(fanId: number, score: number, overlap = 3, jaccard = 0.1): TwinRecord {
  return {
    fanId,
    overlap,
    jaccard,
    score,
    labelCluster: false,
    lately: null,
    yearAgo: null,
    latelyOverlap: 0,
    computedAt: 7,
  };
}

describe('twinStanding', () => {
  const board = [twin(10, 0.9), twin(11, 0.5, 37, 0.125), twin(12, 0.2)];

  it('gives the 1-based rank with overlap and match percentage', () => {
    expect(twinStanding(board, 11)).toEqual({ rank: 2, overlap: 37, matchPct: 12.5 });
  });

  it('is null for a fan who is not on the board', () => {
    expect(twinStanding(board, 99)).toBeNull();
    expect(twinStanding([], 10)).toBeNull();
  });
});

describe('twinStandings', () => {
  const board = [twin(10, 0.9), twin(11, 0.5, 37, 0.125), twin(12, 0.2)];

  it('answers each fan as twinStanding does, leaving out fans off the board', () => {
    const standings = twinStandings(board, [12, 11, 99]);
    expect(standings).toEqual({ 12: twinStanding(board, 12), 11: twinStanding(board, 11) });
    expect(standings[11]).toEqual({ rank: 2, overlap: 37, matchPct: 12.5 });
  });

  it('is empty for no fans or no board', () => {
    expect(twinStandings(board, [])).toEqual({});
    expect(twinStandings([], [10])).toEqual({});
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

  it('ranks by stored score, not insertion order', async () => {
    await replaceTwins(db, [twin(11, 0.2), twin(10, 0.5, 5, 0.25)], []);

    expect(await getTwinStanding(db, 10)).toEqual({ rank: 1, overlap: 5, matchPct: 25 });
    expect(await getTwinStanding(db, 11)).toMatchObject({ rank: 2 });
    expect(await getTwinStanding(db, 12)).toBeNull();
  });

  it('batches the same answers in one read', async () => {
    await replaceTwins(db, [twin(11, 0.2), twin(10, 0.5, 5, 0.25)], []);

    expect(await getTwinStandings(db, [10, 11, 12])).toEqual({
      10: await getTwinStanding(db, 10),
      11: await getTwinStanding(db, 11),
    });
  });
});
