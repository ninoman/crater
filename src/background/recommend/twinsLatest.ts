// Twins' latest: what your top twins bought in the last weeks that you don't own, newest first,
// dressed for display (decisions §11).

import { artUrl, fanPageUrl, keyFromNumber } from '../../bandcamp';
import {
  gatherTwinsLatest,
  getDisplayItems,
  getFans,
  getLatelyTwins,
  getTwins,
  type DigheadDb,
  type MeRecord,
} from '../../db';
import { exclusions } from '../../scoring/exclusions';
import { feedTwins, latestPurchases } from '../../scoring/twinsLatest';
import type { LatestBuyer, TwinsLatestResult } from '../../shared/twinsLatest';
import { twinsBasis } from './twinRows';

/** Purchases this recent count: about two rounds of the 30-day re-scan. */
export const LATEST_WINDOW_DAYS = 60;
export const LATEST_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeTwinsLatest(
  db: DigheadDb,
  me: MeRecord | undefined,
  topTwinsK: number,
  now: number,
): Promise<TwinsLatestResult> {
  const empty = { rows: [], twinsUsed: 0, windowDays: LATEST_WINDOW_DAYS, checking: 0 };
  if (!me) return { basis: twinsBasis(me), ...empty };

  const [lately, allTime] = await Promise.all([getLatelyTwins(db), getTwins(db)]);
  const twinIds = feedTwins(
    [lately.map((twin) => twin.fanId), allTime.map((twin) => twin.fanId)],
    topTwinsK,
  );
  const data = await gatherTwinsLatest(db, twinIds, me.fanId);
  const excluded = exclusions(data.mine, data.hidden);
  const picks = latestPurchases(data.twinLists, excluded, now - LATEST_WINDOW_DAYS * DAY_MS);

  // Picks with no item record can't be shown; look up a few spare in case.
  const shortlist = picks.slice(0, LATEST_LIMIT * 2);
  const [items, fans] = await Promise.all([
    getDisplayItems(
      db,
      shortlist.map((pick) => keyFromNumber(pick.id)),
    ),
    getFans(db, twinIds),
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
    basis: twinsBasis(me),
    rows: rows.slice(0, LATEST_LIMIT),
    twinsUsed: data.twinLists.length,
    windowDays: LATEST_WINDOW_DAYS,
    checking: data.queued.size,
  };
}
