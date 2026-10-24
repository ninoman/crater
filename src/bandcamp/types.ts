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
  /** From the artist, title and track artists (decisions §17). */
  compilation: boolean;
}

/** What a release costs, as Bandcamp's collection and wishlist rows say (decisions §24). */
export interface ItemPrice {
  amount: number;
  /** ISO code, e.g. "USD". Prices in different currencies are never added together. */
  currency: string;
  /** Bandcamp will sell it: not private, subscriber-only or withdrawn. */
  purchasable: boolean;
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
  /** From the artist and title only: collection pages don't list track artists (§17). */
  compilation: boolean;
  /** Null when the row has no price or currency. */
  price?: ItemPrice | null;
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

/** A fan's profile page as pass 1 reads it (decisions §12). */
export interface FanProfile {
  fanId: number;
  username: string;
  /** Collection size, `collection_data.item_count`. */
  itemCount: number;
  /**
   * Bandcamp's "N items in common" with the viewer. 0 when signed in and the line is missing;
   * null logged out or on your own page, where there's nothing to compare.
   */
  inCommon: number | null;
  favouriteGenre: string | null;
  location: string | null;
  signedIn: boolean;
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

/** An artist's page colours, as `#rrggbb`. */
export interface PageDesign {
  /** The content column the release sits on. */
  background: string;
  text: string;
  secondaryText: string;
  link: string;
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

/** One streamable track, for the preview player. */
export interface PreviewTrack {
  title: string;
  /** Seconds. */
  duration: number;
  /** A signed mp3 URL that expires, so fetch it shortly before playing. */
  streamUrl: string;
}

export interface ReleasePreview {
  /** What a play of it marks heard: the album for an album's track (decisions §3.8, §22). */
  matchKey: ItemKey | null;
  tracks: PreviewTrack[];
  /** The track Bandcamp features on the page, where playback starts. */
  startIndex: number;
}

/** One release in a band account's discography (decisions §23). */
export interface DiscographyRelease {
  itemKey: ItemKey;
  /** The account selling it: the band itself, or one of a label's artists. */
  sellerId: number;
  title: string;
  artist: string;
  artId: number | null;
  /** Bandcamp's release date, in ms. In the future for a pre-order. */
  releasedAt: number | null;
}

export interface Discography {
  bandId: number;
  name: string;
  releases: DiscographyRelease[];
}

/** What a release's details add to its discography entry. */
export interface ReleaseDetails {
  itemKey: ItemKey;
  /** For a track that belongs to an album, the album's key. */
  albumKey: ItemKey | null;
  url: string;
  releasedAt: number | null;
  preorder: boolean;
}
