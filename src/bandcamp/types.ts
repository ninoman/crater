// Domain shapes produced by the parsers. Nothing outside src/bandcamp sees raw Bandcamp JSON.

export type TralbumType = 'a' | 't';

/** "a123" (album) or "t456" (track). The key for every release in the DB. */
export type ItemKey = `${TralbumType}${number}`;

export interface ReleaseInfo {
  itemKey: ItemKey;
  /** For a track that belongs to an album, the album's key. Drives matchKey (decisions §3.8). */
  albumKey: ItemKey | null;
  title: string;
  artist: string;
  /** Selling account; used as the label proxy (decisions §3.3). */
  bandId: number;
  url: string;
  artId: number | null;
}

export interface ReleasePageItem extends ReleaseInfo {
  tags: string[];
}

export interface CollectionItem extends ReleaseInfo {
  purchaseKind: 'album' | 'track' | 'package';
  /** Bandcamp's also_collected_count: how many other fans own this release. */
  otherOwners: number | null;
  /** ms since epoch; purchase date for collections, added date for wishlists. */
  addedAt: number | null;
}

export interface Supporter {
  fanId: number;
  username: string;
  name: string;
  imageId: number | null;
  /** Pagination token; also encodes the purchase time. */
  token: string;
  purchasedAt: number | null;
  isReviewer: boolean;
}

export interface SupportersPage {
  supporters: Supporter[];
  moreAvailable: boolean;
}

export interface ReleasePage {
  item: ReleasePageItem;
  /** First page of supporters embedded in the HTML: reviewers, then thumbs. */
  supporters: Supporter[];
  moreThumbsAvailable: boolean;
  moreReviewsAvailable: boolean;
}

export interface CollectionPage {
  items: CollectionItem[];
  moreAvailable: boolean;
  lastToken: string | null;
}

export interface FanPage {
  fanId: number;
  username: string;
  name: string;
  isOwnPage: boolean;
  collection: { itemCount: number; hiddenCount: number; lastToken: string | null };
  wishlist: { itemCount: number; hidden: boolean; lastToken: string | null };
  /** First items of the collection, newest first, as embedded in the page. */
  firstItems: CollectionItem[];
  /** The fan who is logged in while viewing, or null when logged out. */
  viewer: { fanId: number; username: string } | null;
}
