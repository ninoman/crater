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
import type { LatestBuyer, CrateMatesLatestResult } from '../../shared/crateMatesLatest';
import type { ListFilters } from '../../shared/listFilters';
import { crateMatesBasis } from './crateMateRows';
import { createFilterGate } from './filterGate';

/** Purchases this recent count: about two rounds of the 30-day re-scan. */
export const LATEST_WINDOW_DAYS = 60;
export const LATEST_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeCrateMatesLatest(
  db: DigheadDb,
  me: MeRecord | undefined,
  topCrateMatesK: number,
  now: number,
  /** Narrow the feed (decisions §22), with the place "Near me" matches against. */
  { filters, homePlace = '' }: { filters?: ListFilters; homePlace?: string } = {},
): Promise<CrateMatesLatestResult> {
  const empty = { rows: [], crateMatesUsed: 0, windowDays: LATEST_WINDOW_DAYS, checking: 0 };
  if (!me) return { basis: crateMatesBasis(me), ...empty };

  const [lately, allTime] = await Promise.all([getLatelyCrateMates(db), getCrateMates(db)]);
  const crateMateIds = feedCrateMates(
    [lately.map((crateMate) => crateMate.fanId), allTime.map((crateMate) => crateMate.fanId)],
    topCrateMatesK,
  );
  const data = await gatherCrateMatesLatest(db, crateMateIds, me.fanId);
  const excluded = exclusions(data.mine, data.hidden);
  const picks = latestPurchases(data.crateMateLists, excluded, now - LATEST_WINDOW_DAYS * DAY_MS);

  // Picks with no item record can't be shown; look up a few spare in case. The filter picks
  // from the whole feed, so a narrow one still fills the list.
  const gate = createFilterGate(db, filters, homePlace);
  const shortlist = gate
    ? await gate.firstPassing(picks, (pick) => keyFromNumber(pick.id), LATEST_LIMIT * 2)
    : picks.slice(0, LATEST_LIMIT * 2);
  const [items, fans] = await Promise.all([
    getDisplayItems(
      db,
      shortlist.map((pick) => keyFromNumber(pick.id)),
    ),
    getFans(db, crateMateIds),
  ]);
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

  const rows = shortlist.flatMap((pick) => {
    const matchKey = keyFromNumber(pick.id);
    const item = items.get(matchKey);
    if (!item) return [];
    return [
      {
        matchKey,
        title: item.title,
        artist: item.artist,
        label: item.label,
        url: item.url,
        coverUrl: item.artId === null ? null : artUrl(item.artId),
        boughtAt: pick.boughtAt,
        buyers: pick.fanIds.flatMap((fanId) => buyers.get(fanId) ?? []),
      },
    ];
  });
  return {
    basis: crateMatesBasis(me),
    rows: rows.slice(0, LATEST_LIMIT),
    crateMatesUsed: data.crateMateLists.length,
    windowDays: LATEST_WINDOW_DAYS,
    checking: data.queued.size,
    ...(gate && { filtered: gate.applied() }),
  };
}
