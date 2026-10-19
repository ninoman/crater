import { describe, expect, it } from 'vitest';
import { decodeEntities, readBlobById } from './html';
import { matchKey, parseBandcampDate, parseItemKey, purchasedAtFromToken } from './keys';
import { collectionItemsRequest, firstPageToken } from './requests';

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('&quot;a&quot; &amp; &#39;b&#39; &#x2013; &lt;c&gt;')).toBe(
      `"a" & 'b' – <c>`,
    );
  });

  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&bogus; &')).toBe('&bogus; &');
  });
});

describe('readBlobById', () => {
  it('returns null when the element is missing', () => {
    expect(readBlobById('<div></div>', 'pagedata')).toBeNull();
  });

  it('parses an entity-encoded blob', () => {
    expect(readBlobById('<div id="x" data-blob="{&quot;a&quot;:1}">', 'x')).toEqual({ a: 1 });
  });
});

describe('keys', () => {
  it('uses the album as match key for album tracks', () => {
    expect(matchKey({ itemKey: 't1', albumKey: 'a2' })).toBe('a2');
    expect(matchKey({ itemKey: 't1', albumKey: null })).toBe('t1');
  });

  it('round-trips item keys', () => {
    expect(parseItemKey('t456')).toEqual({ type: 't', tralbumId: 456 });
  });

  it('reads the purchase time from a supporter token', () => {
    expect(purchasedAtFromToken('1:1792430325:5325531:0:1:0')).toBe(1792430325000);
    expect(purchasedAtFromToken('garbage')).toBeNull();
  });

  it('parses Bandcamp dates', () => {
    expect(parseBandcampDate('19 Oct 2026 17:18:45 GMT')).toBe(Date.UTC(2026, 9, 19, 17, 18, 45));
    expect(parseBandcampDate(null)).toBeNull();
  });
});

describe('requests', () => {
  it('builds a synthetic first-page token', () => {
    expect(firstPageToken(1_792_000_000_123)).toBe('1792000000::a::');
  });

  it('builds a collection request', () => {
    const request = collectionItemsRequest(42, 'tok', 100);
    expect(request.url).toBe('https://bandcamp.com/api/fancollection/1/collection_items');
    expect(JSON.parse(request.init.body as string)).toEqual({
      fan_id: 42,
      older_than_token: 'tok',
      count: 100,
    });
  });
});
