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
  /**
   * The record label, when the release is on one but sold from the artist's account. Null when
   * the selling account is itself the label (then bandId is the label) or there's no label.
   */
  label: string | null;
  labelId: number | null;
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
  /** older_than_token for the page after this one. */
  nextToken: string | null;
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
  /** The artists-and-labels and fans lists the fan follows, first rows from the page. */
  following: { bands: FollowingList; fans: FollowingList };
  /** The fan who is logged in while viewing, or null when logged out. */
  viewer: Viewer | null;
}

/** The logged-in fan, as seen in any page's `#pagedata`. */
export interface Viewer {
  fanId: number;
  username: string;
}

export type CollectionList = 'collection' | 'wishlist';

/** Artists and labels are both band accounts; nothing marks a label (decisions §8). */
export type FollowingKind = 'fan' | 'band';

export interface FollowingRow {
  kind: FollowingKind;
  /** `band_id` or `fan_id`. */
  id: number;
  name: string;
  /** A fan's profile, or a band's subdomain or custom domain. */
  url: string;
  imageId: number | null;
  location: string | null;
  /** ms since epoch. */
  followedAt: number | null;
}

export interface FollowingPage {
  rows: FollowingRow[];
  moreAvailable: boolean;
  /** older_than_token for the page after this one. */
  nextToken: string | null;
}

/** One following list as embedded in a fan page. */
export interface FollowingList {
  itemCount: number;
  lastToken: string | null;
  /** Newest first. */
  firstRows: FollowingRow[];
}
