// New from your follows, dressed for display (decisions §23).

import { artUrl, type ItemKey } from '../../bandcamp';
import { gatherFollowsDigest, getCrateMates, type DigheadDb, type MeRecord } from '../../db';
import { exclusions } from '../../scoring/exclusions';
import {
  buildDigest,
  crateMateInterest,
  DIGEST_WINDOW_DAYS,
  type DigestEntry,
  isNewSince,
  sellerOf,
  windowStart,
} from '../../scoring/followsDigest';
import type { HideScopes } from '../../shared/hide';
import type { FollowedAccount, FollowsDigestResult } from '../../shared/followsDigest';
import { crateMatesBasis } from '../recommend/crateMateRows';
import { loadHideScopes } from '../recommend/hideScopes';

/** The digest's entries and accounts, before they're dressed as rows. */
export async function followsDigestEntries(
  db: DigheadDb,
  me: MeRecord,
  topCrateMatesK: number,
  now: number,
  hideHeard = false,
) {
  const crateMateIds = (await getCrateMates(db))
    .slice(0, topCrateMatesK)
    .map((crateMate) => crateMate.fanId);
  const data = await gatherFollowsDigest(db, windowStart(now), me.fanId, crateMateIds);
  const entries = buildDigest({
    releases: data.releases,
    followed: new Set(data.accounts.map((row) => row.id)),
    muted: data.muted,
    excluded: exclusions(data.mine, data.hidden, { heard: hideHeard ? data.heard : undefined }),
    interest: crateMateInterest(data.catalogues, data.crateMateLists),
    since: windowStart(now),
  });
  const accounts = data.accounts
    .map(
      (row): FollowedAccount => ({
        bandId: row.id,
        name: row.name,
        url: row.url,
        tagIds: row.tagIds,
        muted: data.muted.has(row.id),
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return { entries, accounts, data };
}

/**
 * The hide menu's artist and label for each entry, from its seller and the followed account
 * listing it (`sellerOf`), named by the account's name where we follow it.
 */
async function entryHideScopes(
  db: DigheadDb,
  entries: readonly DigestEntry[],
  names: ReadonlyMap<number, string>,
): Promise<Map<ItemKey, HideScopes>> {
  const facts = new Map(
    entries.map((entry) => {
      const [listing = entry.sellerId] = entry.bandIds;
      const seller = sellerOf({ bandId: listing, sellerId: entry.sellerId });
      const label = seller.labelId === null ? null : (names.get(seller.labelId) ?? null);
      return [entry.itemKey, { ...seller, label, artist: entry.artist, url: entry.url }] as const;
    }),
  );
  return loadHideScopes(db, facts);
}

function toRow(
  entry: DigestEntry,
  lastVisitAt: number | null,
  heard: ReadonlySet<ItemKey>,
  hide: HideScopes,
) {
  return {
    itemKey: entry.itemKey,
    matchKey: entry.matchKey,
    title: entry.title,
    artist: entry.artist,
    url: entry.url,
    coverUrl: entry.artId === null ? null : artUrl(entry.artId),
    newsAt: entry.newsAt,
    preorder: entry.preorder,
    isNew: isNewSince(entry, lastVisitAt),
    bandIds: entry.bandIds,
    crateMates: entry.interest,
    muted: entry.muted,
    heard: heard.has(entry.matchKey),
    hide,
  };
}

export async function computeFollowsDigest(
  db: DigheadDb,
  me: MeRecord | undefined,
  topCrateMatesK: number,
  lastVisitAt: number | null,
  now: number,
  hideHeard: boolean,
): Promise<FollowsDigestResult> {
  const empty = { rows: [], accounts: [], readAccounts: 0, checking: 0 };
  if (!me) return { basis: crateMatesBasis(me), windowDays: DIGEST_WINDOW_DAYS, ...empty };
  const { entries, accounts, data } = await followsDigestEntries(
    db,
    me,
    topCrateMatesK,
    now,
    hideHeard,
  );
  const names = new Map(accounts.map((account) => [account.bandId, account.name]));
  const scopes = await entryHideScopes(db, entries, names);
  const noScopes: HideScopes = { band: null, label: null };
  return {
    basis: crateMatesBasis(me),
    rows: entries.map((entry) =>
      toRow(entry, lastVisitAt, data.heard, scopes.get(entry.itemKey) ?? noScopes),
    ),
    accounts,
    readAccounts: data.readAccounts,
    checking: data.checking,
    windowDays: DIGEST_WINDOW_DAYS,
  };
}
