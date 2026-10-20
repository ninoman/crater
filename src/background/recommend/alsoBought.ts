// Runs the Also-bought scorer for one release: gather, score with pruning, blend, then dress
// the picks for display.

import { artUrl, embeddedPlayerUrl, keyToNumber, type ItemKey } from '../../bandcamp';
import {
  gatherAlsoBought,
  getDisplayItems,
  getOwnerCounts,
  getSellerItems,
  type AlsoBoughtData,
  type DigheadDb,
  type ItemRecord,
} from '../../db';
import {
  ALSO_BOUGHT_LIMIT,
  blendPicks,
  coOwnership,
  couldEnter,
  fallbackPicks,
  isSmallRelease,
  rankScored,
  scoreCoOwned,
  type AlsoBoughtPick,
  type Basis,
  type CoOwned,
  type FallbackPick,
  type Scored,
} from '../../scoring/alsoBought';
import { exclusions, type Exclusions } from '../../scoring/exclusions';
import { supporters } from '../../scoring/weights';
import type { AlsoBoughtReason, AlsoBoughtResult, AlsoBoughtRow } from '../../shared/alsoBought';

/** Owner counts are looked up this many candidates at a time. */
const CHUNK = 200;

export async function computeAlsoBought(
  db: DigheadDb,
  releaseKey: ItemKey,
  meFanId: number | null,
): Promise<AlsoBoughtResult> {
  const data = await gatherAlsoBought(db, releaseKey, meFanId);
  const mine = exclusions(data.mine, data.hidden, data.matchKey);
  const basis = { supporters: data.ownerLists.length, population: data.population };

  const scored = await scoreTop(db, coOwnership(data.ownerLists, mine.excluded), basis);
  const fallback = isSmallRelease(data.knownOwners) ? await fallbackFor(db, data, mine) : [];
  const picks = blendPicks(scored, fallback, ALSO_BOUGHT_LIMIT);

  const items = await getDisplayItems(
    db,
    picks.map((pick) => pick.matchKey),
  );
  const label = data.album?.label ?? data.release?.label ?? null;
  const rows = picks.flatMap((pick) => {
    const item = items.get(pick.matchKey);
    return item
      ? [toRow(pick, item, reasonFor(pick, basis.supporters, item.label ?? label), mine)]
      : [];
  });
  return { releaseKey, rows };
}

/**
 * Scores candidates in falling co order, fetching owner counts a chunk at a time, and stops
 * once no remaining candidate can reach the top list (decisions §6).
 */
async function scoreTop(db: DigheadDb, candidates: CoOwned[], basis: Basis): Promise<Scored[]> {
  let top: Scored[] = [];
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const first = candidates[start];
    if (!first || !couldEnter(top, ALSO_BOUGHT_LIMIT, first.co)) break;
    const chunk = candidates.slice(start, start + CHUNK);
    const owners = await getOwnerCounts(
      db,
      chunk.map((c) => c.id),
    );
    const scored = chunk.map((c) => scoreCoOwned(c, owners.get(c.id) ?? c.co, basis));
    top = rankScored([...top, ...scored], ALSO_BOUGHT_LIMIT);
  }
  return top;
}

async function fallbackFor(
  db: DigheadDb,
  data: AlsoBoughtData,
  mine: Exclusions,
): Promise<FallbackPick[]> {
  const release = data.album ?? data.release;
  if (!release) return [];
  const seller = { ...release, labelId: data.album?.labelId ?? data.release?.labelId ?? null };
  const items = await getSellerItems(db, seller.bandId, seller.labelId);
  const ids = items.map((item) => keyToNumber(item.itemKey));
  const owners = await getOwnerCounts(db, ids);
  return fallbackPicks(
    seller,
    items.map((item, i) => ({
      ...item,
      supporters: supporters([item.supporterCount], owners.get(ids[i] ?? 0) ?? 0),
    })),
    mine.excluded,
    ALSO_BOUGHT_LIMIT,
  );
}

function reasonFor(
  pick: AlsoBoughtPick,
  scannedSupporters: number,
  label: string | null,
): AlsoBoughtReason {
  switch (pick.kind) {
    case 'co-owned':
      return { kind: 'co-owned', owners: pick.co, of: scannedSupporters };
    case 'same-artist':
      return { kind: 'same-artist' };
    case 'same-label':
      return { kind: 'same-label', label };
  }
}

function toRow(
  pick: AlsoBoughtPick,
  item: ItemRecord,
  reason: AlsoBoughtReason,
  mine: Exclusions,
): AlsoBoughtRow {
  return {
    matchKey: pick.matchKey,
    title: item.title,
    artist: item.artist,
    label: item.label,
    url: item.url,
    coverUrl: item.artId === null ? null : artUrl(item.artId),
    previewUrl: embeddedPlayerUrl(pick.matchKey),
    reason,
    ownedTracks: mine.ownedTracks.get(keyToNumber(pick.matchKey)) ?? 0,
  };
}
