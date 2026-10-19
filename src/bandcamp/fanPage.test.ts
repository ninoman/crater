import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { ParserError } from './errors';
import { parseFanPage } from './fanPage';

describe('parseFanPage', () => {
  it('parses a small public fan page', () => {
    const page = parseFanPage(fixtureText('fan-page.html'));

    expect(page).toMatchObject({
      fanId: 5325531,
      username: 'jiggypol',
      name: 'jiggypol',
      isOwnPage: false,
      collection: { itemCount: 10, hiddenCount: 0, lastToken: '1395364877:4269293903:a::' },
      wishlist: { itemCount: 0, hidden: false, lastToken: null },
      viewer: null,
    });
    expect(page.firstItems).toHaveLength(10);
  });

  it('keeps the page order and folds packages into their album', () => {
    const [first] = parseFanPage(fixtureText('fan-page.html')).firstItems;

    expect(first).toMatchObject({
      itemKey: 'a3149089081',
      albumKey: null,
      purchaseKind: 'package',
      title: 'Promises',
      bandId: 2009518365,
      otherOwners: 18411,
    });
  });

  it('exposes pagination tokens for a larger collection', () => {
    const page = parseFanPage(fixtureText('fan-page-medium.html'));

    expect(page.fanId).toBe(1138719);
    expect(page.collection.itemCount).toBe(122);
    expect(page.collection.lastToken).toBe('1785993460:820091705:a::');
    expect(page.wishlist.itemCount).toBe(9);
    expect(page.firstItems).toHaveLength(20);
  });

  it('throws ParserError on a page without fan data', () => {
    expect(() => parseFanPage(fixtureText('album-page.html'))).toThrow(ParserError);
  });
});
