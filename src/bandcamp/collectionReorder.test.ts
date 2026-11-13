import { describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import type { FetchJson } from './collection';
import { MAX_REORDER_ITEMS, parseReorderCrumb, saveCollectionOrder } from './collectionReorder';
import { BandcampApiError } from './errors';
import type { FetchText } from './release';
import type { BandcampRequest } from './requests';

const ME_PAGE = fixtureText('me-fan-page.html');
const LOGGED_OUT = fixtureText('fan-page.html');
const CRUMB = '|collection_reorder_cb|1792483607|REDACTED';

function fetchers(page: string, ...answers: unknown[]) {
  const fetchJson = vi.fn<FetchJson>();
  for (const answer of answers) fetchJson.mockResolvedValueOnce(answer);
  return { fetchText: vi.fn<FetchText>(async () => page), fetchJson };
}

function body(fetchJson: ReturnType<typeof fetchers>['fetchJson'], call = 0) {
  const request = fetchJson.mock.calls[call]?.[0];
  if (!request) throw new Error(`no request ${call}`);
  return new URLSearchParams(request.init.body as string);
}

const ORDER = { username: 'randoom_taker', fanId: 7, itemIds: [30, 10, 20] };

describe('parseReorderCrumb', () => {
  it('reads the reorder crumb from your own fan page', () => {
    expect(parseReorderCrumb(ME_PAGE)).toBe(CRUMB);
  });

  it('has none on a page fetched logged out', () => {
    expect(parseReorderCrumb(LOGGED_OUT)).toBeNull();
  });
});

describe('saveCollectionOrder', () => {
  it('posts every id in the new order, as Bandcamp’s grid does', async () => {
    const f = fetchers(ME_PAGE, { ok: true });

    expect(await saveCollectionOrder(f, ORDER)).toEqual({ status: 'done' });

    expect(f.fetchText.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://bandcamp.com/randoom_taker',
      init: { credentials: 'include' },
    });
    const request = f.fetchJson.mock.calls[0]?.[0] as BandcampRequest;
    expect(request.url).toBe('https://bandcamp.com/collection_reorder_cb');
    expect(request.init.method).toBe('POST');
    expect(body(f.fetchJson).get('fan_id')).toBe('7');
    expect(body(f.fetchJson).getAll('ids[]')).toEqual(['30', '10', '20']);
    expect(body(f.fetchJson).get('crumb')).toBe(CRUMB);
  });

  it('retries with the crumb an expired one hands back', async () => {
    const f = fetchers(ME_PAGE, { error: 'invalid_crumb', crumb: 'fresh' }, { ok: true });

    expect(await saveCollectionOrder(f, ORDER)).toEqual({ status: 'done' });
    expect(body(f.fetchJson, 1).get('crumb')).toBe('fresh');
  });

  it('gives up after two fresh crumbs', async () => {
    const expired = { error: 'invalid_crumb', crumb: 'again' };
    const f = fetchers(ME_PAGE, expired, expired, expired);

    await expect(saveCollectionOrder(f, ORDER)).rejects.toThrow(BandcampApiError);
    expect(f.fetchJson).toHaveBeenCalledTimes(3);
  });

  it('throws on any other error', async () => {
    const f = fetchers(ME_PAGE, { error: true });

    await expect(saveCollectionOrder(f, ORDER)).rejects.toThrow(BandcampApiError);
  });

  it('is signed-out when the page has no crumb', async () => {
    const f = fetchers(LOGGED_OUT);

    expect(await saveCollectionOrder(f, ORDER)).toEqual({ status: 'signed-out' });
    expect(f.fetchJson).not.toHaveBeenCalled();
  });

  it('sends nothing for a collection too big for Bandcamp to sort', async () => {
    const f = fetchers(ME_PAGE);
    const itemIds = Array.from({ length: MAX_REORDER_ITEMS + 1 }, (_, i) => i);

    expect(await saveCollectionOrder(f, { ...ORDER, itemIds })).toEqual({
      status: 'too-many',
      limit: MAX_REORDER_ITEMS,
    });
    expect(f.fetchText).not.toHaveBeenCalled();
  });
});
