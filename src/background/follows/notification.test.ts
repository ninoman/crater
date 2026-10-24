import { describe, expect, it } from 'vitest';
import type { DigestEntry } from '../../scoring/followsDigest';
import { followsNotification } from './notification';

function entry(n: number, patch: Partial<DigestEntry> = {}): DigestEntry {
  return {
    itemKey: `a${n}`,
    matchKey: `a${n}`,
    title: `Album ${n}`,
    artist: `Artist ${n}`,
    artId: null,
    url: '',
    newsAt: 100,
    releasedAt: 100,
    firstSeenAt: 100,
    preorder: false,
    baseline: false,
    sellerId: n,
    bandIds: [n],
    interest: 0,
    muted: false,
    ...patch,
  };
}

describe('followsNotification', () => {
  it('names up to three releases found since the last visit or notification', () => {
    const entries = [1, 2, 3, 4, 5].map((n) => entry(n));
    expect(followsNotification(entries, { lastVisitAt: 50, lastNotifiedAt: 10 })).toEqual({
      title: '5 new releases from your follows',
      message: 'Artist 1 – Album 1\nArtist 2 – Album 2\nArtist 3 – Album 3\nand 2 more',
    });
    expect(followsNotification([entry(1)], { lastVisitAt: null, lastNotifiedAt: null })).toEqual({
      title: '1 new release from your follows',
      message: 'Artist 1 – Album 1',
    });
  });

  it('stays quiet when nothing new turned up', () => {
    const entries = [entry(1, { muted: true }), entry(2, { baseline: true }), entry(3)];
    expect(followsNotification(entries, { lastVisitAt: 100, lastNotifiedAt: null })).toBeNull();
    expect(
      followsNotification(entries.slice(0, 2), { lastVisitAt: null, lastNotifiedAt: null }),
    ).toBeNull();
  });
});
