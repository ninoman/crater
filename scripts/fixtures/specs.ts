// What each public fixture is, how to re-capture it, and which parser must still accept it.
// Requests come from src/bandcamp/requests.ts so the script can't drift from the scanner.

import {
  collectionListRequest,
  fanPageUrl,
  firstPageToken,
  parseCollectionPage,
  parseFanPage,
  parseReleasePage,
  parseSupportersPage,
  releasePageRequest,
  supportersRequest,
  type BandcampRequest,
} from '../../src/bandcamp';

export interface Spec {
  file: string;
  /** Builds the request, or returns why it can't run (e.g. the capture it depends on failed). */
  request: (fresh: ReadonlyMap<string, string>) => BandcampRequest | { skip: string };
  /** Throws if the real parser rejects the body. */
  parse: (body: string) => void;
  /** The fixture documents an error response; the parser should keep rejecting it that way. */
  expectApiError?: boolean;
}

const ALBUM = 'https://floatingpoints.bandcamp.com/album/promises';
const ALBUM_ID = 3149089081;
const FAN_ID = 1138719;
const PAGE_SIZE = 40;

const html = (parse: (html: string) => unknown) => (body: string) => void parse(body);
const json = (parse: (json: unknown) => unknown) => (body: string) =>
  void parse(JSON.parse(body) as unknown);

function collection(list: 'collection' | 'wishlist', fanId: number, token: string) {
  return collectionListRequest(list, fanId, token, PAGE_SIZE);
}

/** Pages 2 continue from a token that only the fresh first capture knows. */
function after<T>(
  dependsOn: string,
  fresh: ReadonlyMap<string, string>,
  build: (body: string) => T,
): T | { skip: string } {
  const body = fresh.get(dependsOn);
  if (body === undefined) return { skip: `needs a fresh ${dependsOn}` };
  try {
    return build(body);
  } catch (error) {
    return { skip: `could not read ${dependsOn}: ${String(error)}` };
  }
}

function lastSupporterToken(albumHtml: string, reviewer: boolean): string {
  const token = parseReleasePage(albumHtml)
    .supporters.filter((s) => s.isReviewer === reviewer)
    .at(-1)?.token;
  if (!token) throw new Error('no supporter of that kind');
  return token;
}

export const SPECS: Spec[] = [
  {
    file: 'album-page.html',
    request: () => releasePageRequest(ALBUM),
    parse: html(parseReleasePage),
  },
  {
    file: 'track-page.html',
    request: () => releasePageRequest('https://floatingpoints.bandcamp.com/track/movement-1'),
    parse: html(parseReleasePage),
  },
  {
    file: 'album-page-small.html',
    request: () =>
      releasePageRequest('https://doorsdarkmancollective.bandcamp.com/album/summers-fault'),
    parse: html(parseReleasePage),
  },
  {
    file: 'tralbumcollectors-thumbs-p2.json',
    request: (fresh) =>
      after('album-page.html', fresh, (page) =>
        supportersRequest('thumbs', 'a', ALBUM_ID, lastSupporterToken(page, false), 100),
      ),
    parse: json((data) => parseSupportersPage(data, 'thumbs')),
  },
  {
    file: 'tralbumcollectors-reviews-p2.json',
    request: (fresh) =>
      after('album-page.html', fresh, (page) =>
        supportersRequest('reviews', 'a', ALBUM_ID, lastSupporterToken(page, true), 100),
      ),
    parse: json((data) => parseSupportersPage(data, 'reviews')),
  },
  {
    file: 'fan-page.html',
    request: () => ({ url: fanPageUrl('jiggypol'), init: { credentials: 'omit' } }),
    parse: html(parseFanPage),
  },
  {
    file: 'fan-page-medium.html',
    request: () => ({ url: fanPageUrl('icantthinkofaname'), init: { credentials: 'omit' } }),
    parse: html(parseFanPage),
  },
  {
    file: 'collection_items-p1.json',
    request: () => collection('collection', FAN_ID, firstPageToken()),
    parse: json((data) => parseCollectionPage(data)),
  },
  {
    file: 'collection_items-p2.json',
    request: (fresh) =>
      after('collection_items-p1.json', fresh, (body) => {
        const { nextToken } = parseCollectionPage(JSON.parse(body));
        if (!nextToken) throw new Error('no next token');
        return collection('collection', FAN_ID, nextToken);
      }),
    parse: json((data) => parseCollectionPage(data)),
  },
  {
    file: 'wishlist_items.json',
    request: () => collection('wishlist', FAN_ID, firstPageToken()),
    parse: json((data) => parseCollectionPage(data, 'wishlist_items')),
  },
  {
    file: 'wishlist_items-hidden.json',
    request: () => collection('wishlist', 11705655, firstPageToken()),
    parse: json((data) => parseCollectionPage(data, 'wishlist_items')),
    expectApiError: true,
  },
  {
    file: 'collection_items-unknown-fan.json',
    request: () => collection('collection', 1, firstPageToken()),
    parse: json((data) => parseCollectionPage(data)),
  },
  {
    file: 'collection_items-bad-token.json',
    request: () => collection('collection', FAN_ID, 'garbage'),
    parse: json((data) => parseCollectionPage(data)),
    expectApiError: true,
  },
];

/** Logged-in captures can't be refreshed by a script. */
export const SKIPPED_LOGGED_IN = ['me-fan-page.html', 'purchase-confirmation.html (not captured yet)'];
