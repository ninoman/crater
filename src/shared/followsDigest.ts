// Shapes of New from your follows (decisions §23), shared by the worker and the profile tab.

import type { ItemKey } from '../bandcamp';
import type { CrateMatesBasis } from './crateMates';
import type { HideScopes } from './hide';

/** An artist or label account you follow. */
export interface FollowedAccount {
  bandId: number;
  name: string;
  /** Its Bandcamp page. */
  url: string;
  tagIds: number[];
  muted: boolean;
}

export interface FollowsDigestRow {
  itemKey: ItemKey;
  /** The album for album tracks. Hide uses this. */
  matchKey: ItemKey;
  title: string;
  artist: string;
  url: string;
  coverUrl: string | null;
  /** When it became news: its release date, or when an old release was put up. */
  newsAt: number;
  preorder: boolean;
  /** Found since your previous visit to the tab. */
  isNew: boolean;
  /** Followed accounts listing it, the seller first. */
  bandIds: number[];
  /** Your top crate mates owning music from those accounts. */
  crateMates: number;
  /** Every account listing it is muted. */
  muted: boolean;
  /** You've heard it (decisions §22). */
  heard: boolean;
  /** What its "Hide from recommendations" menu offers beyond the release. */
  hide: HideScopes;
}

export interface FollowsDigestResult {
  basis: CrateMatesBasis;
  /** Newest first, with crate-mate interest within a day. Muted rows included, flagged. */
  rows: FollowsDigestRow[];
  /** Every artist and label account you follow, by name. */
  accounts: FollowedAccount[];
  /** Of those accounts, how many have been read at least once. */
  readAccounts: number;
  /** Reads waiting in the queue, so the list may still grow. */
  checking: number;
  windowDays: number;
}

/** What opening the tab answers: your previous visit, which marks what's new. */
export interface FollowsDigestVisit {
  previousVisitAt: number | null;
}
