import { describe, expect, it } from 'vitest';
import { fixtureJson, fixtureText } from '../../tests/fixtures';
import { BandcampApiError, ParserError } from './errors';
import { fetchFollowingPage, parseFollowingPage } from './following';
import { parseFanPage } from './fanPage';
import { FOLLOWING_FIRST_TOKEN, followingRequest } from './requests';

describe('parseFollowingPage', () => {
  it('parses band rows and takes the next token from the last row', () => {
    const page = parseFollowingPage(fixtureJson('following_bands-p1.json'), 'band');

    expect(page.rows).toHaveLength(5);
    expect(page.rows[0]).toEqual({
      kind: 'band',
      id: 3648395603,
      name: 'Peacefrog Records',
      url: 'https://peacefrog.bandcamp.com',
      imageId: 13000818,
      location: 'London, UK',
      followedAt: Date.UTC(2026, 9, 20, 18, 55, 15),
    });
    expect(page.moreAvailable).toBe(true);
    expect(page.nextToken).toBe('1791547846:4165709441');
  });

  it('continues from the first page: the second starts with the next-newest follow', () => {
    const p1 = parseFollowingPage(fixtureJson('following_bands-p1.json'), 'band');
    const p2 = parseFollowingPage(fixtureJson('following_bands-p2.json'), 'band');

    expect(p2.rows[0]?.followedAt).toBeLessThanOrEqual(p1.rows.at(-1)?.followedAt ?? 0);
    expect(p2.rows.map((r) => r.id)).not.toContain(p1.rows[0]?.id);
    expect(p2.nextToken).toBe('1790954378:110579793');
  });

  it('parses fan rows with the profile URL and an empty location as null', () => {
    const page = parseFollowingPage(fixtureJson('following_fans.json'), 'fan');

    expect(page.rows).toHaveLength(7);
    expect(page.rows[0]).toMatchObject({
      kind: 'fan',
      id: 3780697,
      url: 'https://bandcamp.com/martingilleshoej',
      location: null,
    });
    expect(page.moreAvailable).toBe(false);
  });

  it('treats an unknown fan as an empty list', () => {
    const page = parseFollowingPage(fixtureJson('following_fans-unknown-fan.json'), 'fan');

    expect(page).toEqual({ rows: [], moreAvailable: false, nextToken: null });
  });

  it('links the subdomain like Bandcamp’s cards, and the custom domain only without one', () => {
    const url = (hints: object) =>
      parseFollowingPage(
        {
          followeers: [{ band_id: 1, name: 'A', url_hints: hints }],
          more_available: false,
          last_token: null,
        },
        'band',
      ).rows[0]?.url;

    expect(url({ subdomain: 'a', custom_domain: 'a.example.com' })).toBe('https://a.bandcamp.com');
    expect(url({ subdomain: null, custom_domain: 'a.example.com' })).toBe('https://a.example.com');
    expect(url({})).toBeUndefined();
  });

  it('skips rows without the id or link of their kind', () => {
    const page = parseFollowingPage(fixtureJson('following_fans.json'), 'band');

    expect(page.rows).toEqual([]);
  });

  it('rejects an API error and a wrong shape', () => {
    expect(() => parseFollowingPage({ error: true }, 'band')).toThrow(BandcampApiError);
    expect(() => parseFollowingPage({ followeers: 'x' }, 'band')).toThrow(ParserError);
  });
});

describe('followingRequest', () => {
  it('posts the fan, token and count to the kind’s endpoint', () => {
    const request = followingRequest('band', 7027105, FOLLOWING_FIRST_TOKEN, 500);

    expect(request.url).toBe('https://bandcamp.com/api/fancollection/1/following_bands');
    expect(JSON.parse(request.init.body as string)).toEqual({
      fan_id: 7027105,
      older_than_token: '9999999999:',
      count: 500,
    });
    expect(followingRequest('fan', 1, 'x', 20).url).toMatch(/following_fans$/);
  });

  it('fetches and parses through the supplied fetcher', async () => {
    const page = await fetchFollowingPage(
      async () => fixtureJson('following_fans.json'),
      'fan',
      7027105,
      FOLLOWING_FIRST_TOKEN,
      500,
    );

    expect(page.rows).toHaveLength(7);
  });
});

describe('parseFanPage followings', () => {
  it('reads the first rows of a logged-in fan page, newest first', () => {
    const { following } = parseFanPage(fixtureText('me-fan-page.html'));

    expect(following.bands.itemCount).toBe(591);
    expect(following.bands.lastToken).toBe('1782763577:2499798127');
    expect(following.bands.firstRows).toHaveLength(45);
    expect(following.bands.firstRows[0]?.id).toBe(4024044661);
    expect(following.fans.itemCount).toBe(7);
    expect(following.fans.firstRows.map((r) => r.id)).toEqual([
      3780697, 5125895, 5820639, 3223825, 1020617, 3437386, 1590719,
    ]);
  });

  it('reads the same rows as the endpoint', () => {
    const { following } = parseFanPage(fixtureText('me-fan-page.html'));
    const page = parseFollowingPage(fixtureJson('following_fans.json'), 'fan');

    expect(following.fans.firstRows).toEqual(page.rows);
  });
});
