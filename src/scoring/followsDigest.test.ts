import { describe, expect, it } from 'vitest';
import { keyToNumber, type ItemKey } from '../bandcamp';
import {
  buildDigest,
  crateMateInterest,
  type DigestEntry,
  type DigestInput,
  type FollowRelease,
  isNewSince,
  LATE_UPLOAD_MS,
  MAX_DETAILS_PER_READ,
  newsAt,
  notificationPicks,
  releasesNeedingDetails,
} from './followsDigest';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;

function release(itemKey: ItemKey, patch: Partial<FollowRelease> = {}): FollowRelease {
  return {
    bandId: 1,
    itemKey,
    sellerId: 1,
    title: itemKey,
    artist: 'Artist',
    artId: null,
    releasedAt: NOW - DAY,
    firstSeenAt: NOW,
    baseline: false,
    url: `https://a.bandcamp.com/album/${itemKey}`,
    albumKey: null,
    preorder: false,
    ...patch,
  };
}

function digest(releases: FollowRelease[], patch: Partial<DigestInput> = {}): DigestEntry[] {
  return buildDigest({
    releases,
    followed: new Set([1, 2, 3]),
    muted: new Set(),
    excluded: new Set(),
    interest: new Map(),
    since: NOW - 60 * DAY,
    ...patch,
  });
}

describe('newsAt', () => {
  it('is the release date for a new release, a pre-order or back catalogue', () => {
    expect(newsAt(release('a1'))).toBe(NOW - DAY);
    expect(newsAt(release('a1', { releasedAt: NOW + 9 * DAY }))).toBe(NOW + 9 * DAY);
    expect(newsAt(release('a1', { baseline: true, releasedAt: NOW - 400 * DAY }))).toBe(
      NOW - 400 * DAY,
    );
  });

  it('is when we saw it for an old release newly put on Bandcamp, or one without a date', () => {
    const late = release('a1', { releasedAt: NOW - LATE_UPLOAD_MS - DAY });
    expect(newsAt(late)).toBe(NOW);
    expect(newsAt(release('a1', { releasedAt: null }))).toBe(NOW);
    expect(newsAt(release('a1', { releasedAt: null, baseline: true }))).toBeNull();
  });
});

describe('releasesNeedingDetails', () => {
  it('picks news without a URL, newest first, and caps a read', () => {
    const releases = [
      release('a1', { url: null, releasedAt: NOW - 5 * DAY }),
      release('a2', { url: null, releasedAt: NOW - DAY }),
      release('a3', { releasedAt: NOW - DAY }),
      release('a4', { url: null, baseline: true, releasedAt: NOW - 100 * DAY }),
    ];
    expect(releasesNeedingDetails(releases, NOW - 60 * DAY)).toEqual(['a2', 'a1']);
    const many = Array.from({ length: 30 }, (_, i) => release(`a${i + 1}`, { url: null }));
    expect(releasesNeedingDetails(many, 0)).toHaveLength(MAX_DETAILS_PER_READ);
  });
});

describe('crateMateInterest', () => {
  it('counts each crate mate once per band they own anything from', () => {
    const catalogues = new Map<number, ItemKey[]>([
      [1, ['a10', 'a11']],
      [2, ['a20']],
      [3, ['a11']],
    ]);
    const lists = [
      [keyToNumber('a10'), keyToNumber('a11')],
      [keyToNumber('a11'), keyToNumber('a99')],
      [keyToNumber('a99')],
    ];
    expect(crateMateInterest(catalogues, lists)).toEqual(
      new Map([
        [1, 2],
        [3, 2],
      ]),
    );
  });
});

describe('buildDigest', () => {
  it('keeps news from followed accounts, newest day first, crate-mate interest within a day', () => {
    const entries = digest(
      [
        release('a1', { bandId: 1, sellerId: 1, releasedAt: NOW - 2 * DAY }),
        release('a2', { bandId: 2, sellerId: 2, releasedAt: NOW - DAY + 1 }),
        release('a3', { bandId: 3, sellerId: 3, releasedAt: NOW - DAY }),
        release('a4', { bandId: 9, sellerId: 9 }),
        release('a5', { baseline: true, releasedAt: NOW - 90 * DAY }),
      ],
      { interest: new Map([[3, 4]]) },
    );
    expect(entries.map((entry) => entry.itemKey)).toEqual(['a3', 'a2', 'a1']);
    expect(entries[0]?.interest).toBe(4);
  });

  it('leaves out excluded releases, by album for an album track', () => {
    const entries = digest([release('a1'), release('t2', { albumKey: 'a3' })], {
      excluded: new Set([keyToNumber('a1'), keyToNumber('a3')]),
    });
    expect(entries).toEqual([]);
  });

  it('waits for a URL', () => {
    expect(digest([release('a1', { url: null })])).toEqual([]);
  });

  it('merges a release listed by an artist and their label, seller first', () => {
    const [entry] = digest(
      [
        release('a1', { bandId: 2, sellerId: 1 }),
        release('a1', { bandId: 1, sellerId: 1, firstSeenAt: NOW - DAY }),
      ],
      { muted: new Set([2]), interest: new Map([[2, 3]]) },
    );
    expect(entry).toMatchObject({
      bandIds: [1, 2],
      interest: 3,
      muted: false,
      firstSeenAt: NOW - DAY,
    });
  });

  it('marks a release muted only when every account listing it is', () => {
    const [entry] = digest([release('a1')], { muted: new Set([1]) });
    expect(entry?.muted).toBe(true);
  });
});

describe('isNewSince', () => {
  const entry = { firstSeenAt: NOW, newsAt: NOW - DAY, baseline: false };

  it('is found after the last visit, and never on a first visit', () => {
    expect(isNewSince(entry, NOW - 1)).toBe(true);
    expect(isNewSince(entry, NOW)).toBe(false);
    expect(isNewSince(entry, null)).toBe(false);
  });

  it("counts a new follow's back catalogue only when it came out since the visit", () => {
    expect(isNewSince({ ...entry, baseline: true }, NOW - 2 * DAY)).toBe(true);
    expect(isNewSince({ ...entry, baseline: true }, NOW - DAY / 2)).toBe(false);
  });
});

describe('notificationPicks', () => {
  it('announces unmuted news found since then, not back catalogue', () => {
    const entries = digest([
      release('a1'),
      release('a2', { bandId: 2, sellerId: 2 }),
      release('a3', { bandId: 3, sellerId: 3, baseline: true }),
      release('a4', { firstSeenAt: NOW - 10 * DAY }),
    ]).map((entry) => (entry.itemKey === 'a2' ? { ...entry, muted: true } : entry));
    expect(notificationPicks(entries, NOW - DAY, 3)).toEqual({
      picks: [expect.objectContaining({ itemKey: 'a1' })],
      total: 1,
    });
  });
});
