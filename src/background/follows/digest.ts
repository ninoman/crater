// New from your follows, dressed for display (decisions §22).

import { artUrl } from '../../bandcamp';
import { gatherFollowsDigest, getCrateMates, type DigheadDb, type MeRecord } from '../../db';
import { exclusions } from '../../scoring/exclusions';
import {
  buildDigest,
  crateMateInterest,
  DIGEST_WINDOW_DAYS,
  type DigestEntry,
  isNewSince,
  windowStart,
} from '../../scoring/followsDigest';
import type { FollowedAccount, FollowsDigestResult } from '../../shared/followsDigest';
import { crateMatesBasis } from '../recommend/crateMateRows';

/** The digest's entries and accounts, before they're dressed as rows. */
export async function followsDigestEntries(
  db: DigheadDb,
  me: MeRecord,
  topCrateMatesK: number,
  now: number,
) {
  const crateMateIds = (await getCrateMates(db))
    .slice(0, topCrateMatesK)
    .map((crateMate) => crateMate.fanId);
  const data = await gatherFollowsDigest(db, windowStart(now), me.fanId, crateMateIds);
  const entries = buildDigest({
    releases: data.releases,
    followed: new Set(data.accounts.map((row) => row.id)),
    muted: data.muted,
    excluded: exclusions(data.mine, data.hidden),
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

function toRow(entry: DigestEntry, lastVisitAt: number | null) {
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
  };
}

export async function computeFollowsDigest(
  db: DigheadDb,
  me: MeRecord | undefined,
  topCrateMatesK: number,
  lastVisitAt: number | null,
  now: number,
): Promise<FollowsDigestResult> {
  const empty = { rows: [], accounts: [], readAccounts: 0, checking: 0 };
  if (!me) return { basis: crateMatesBasis(me), windowDays: DIGEST_WINDOW_DAYS, ...empty };
  const { entries, accounts, data } = await followsDigestEntries(db, me, topCrateMatesK, now);
  return {
    basis: crateMatesBasis(me),
    rows: entries.map((entry) => toRow(entry, lastVisitAt)),
    accounts,
    readAccounts: data.readAccounts,
    checking: data.checking,
    windowDays: DIGEST_WINDOW_DAYS,
  };
}
