// Crate mates' latest: what your top crate mates bought in the last weeks that you don't own, newest first,
// dressed for display (decisions §11).

import { artUrl, fanPageUrl, keyFromNumber } from '../../bandcamp';
import {
  gatherCrateMatesLatest,
  getDisplayItems,
  getFans,
  getLatelyCrateMates,
  getCrateMates,
  type DigheadDb,
  type MeRecord,
} from '../../db';
import { exclusions } from '../../scoring/exclusions';
import { feedCrateMates, latestPurchases } from '../../scoring/crateMatesLatest';
import type {
  CrateMatesLatestResult,
  CrateMatesLatestRow,
  LatestBuyer,
} from '../../shared/crateMatesLatest';
import { crateMatesBasis } from './crateMateRows';
import { loadHideScopes } from './hideScopes';

/** Purchases this recent count: about two rounds of the 30-day re-scan. */
export const LATEST_WINDOW_DAYS = 60;
export const LATEST_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CrateMatesLatestInput {
  topCrateMatesK: number;
  /** Leave out releases you've heard, before the list is cut to length (decisions §22). */
  hideHeard: boolean;
  now: number;
}

export async function computeCrateMatesLatest(
  db: DigheadDb,
  me: MeRecord | undefined,
  { topCrateMatesK, hideHeard, now }: CrateMatesLatestInput,
): Promise<CrateMatesLatestResult> {
  const empty = { rows: [], crateMatesUsed: 0, windowDays: LATEST_WINDOW_DAYS, checking: 0 };
  if (!me) return { basis: crateMatesBasis(me), ...empty };

  const [lately, allTime] = await Promise.all([getLatelyCrateMates(db), getCrateMates(db)]);
  const crateMateIds = feedCrateMates(
    [lately.map((crateMate) => crateMate.fanId), allTime.map((crateMate) => crateMate.fanId)],
    topCrateMatesK,
  );
  const data = await gatherCrateMatesLatest(db, crateMateIds, me.fanId);
  const excluded = exclusions(data.mine, data.hidden, {
    heard: hideHeard ? data.heard : undefined,
  });
  const picks = latestPurchases(
    data.crateMateLists,
    excluded.ids,
    now - LATEST_WINDOW_DAYS * DAY_MS,
  );

  const fans = await getFans(db, crateMateIds);
  const buyers = new Map<number, LatestBuyer>();
  for (const fan of fans) {
    if (fan) {
      buyers.set(fan.fanId, {
        fanId: fan.fanId,
        name: fan.name || fan.username,
        url: fanPageUrl(fan.username),
      });
    }
  }

  // Picks with no item record or from a hidden artist or label can't be shown, so records are
  // looked up a few spare at a time until the list is full.
  const rows: CrateMatesLatestRow[] = [];
  for (
    let start = 0;
    start < picks.length && rows.length < LATEST_LIMIT;
    start += LATEST_LIMIT * 2
  ) {
    const shortlist = picks.slice(start, start + LATEST_LIMIT * 2);
    const items = await getDisplayItems(
      db,
      shortlist.map((pick) => keyFromNumber(pick.id)),
    );
    const scopes = await loadHideScopes(db, items);
    for (const pick of shortlist) {
      const matchKey = keyFromNumber(pick.id);
      const item = items.get(matchKey);
      const hide = scopes.get(matchKey);
      if (!item || !hide || !excluded.allows(item)) continue;
      rows.push({
        matchKey,
        title: item.title,
        artist: item.artist,
        label: item.label,
        url: item.url,
        coverUrl: item.artId === null ? null : artUrl(item.artId),
        boughtAt: pick.boughtAt,
        buyers: pick.fanIds.flatMap((fanId) => buyers.get(fanId) ?? []),
        heard: data.heard.has(matchKey),
        hide,
      });
    }
  }
  return {
    basis: crateMatesBasis(me),
    rows: rows.slice(0, LATEST_LIMIT),
    crateMatesUsed: data.crateMateLists.length,
    windowDays: LATEST_WINDOW_DAYS,
    checking: data.queued.size,
  };
}
