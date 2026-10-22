// Runs the Also-bought scorer for one release: gather, score with pruning, blend, then dress
// the picks for display.

import { artUrl, keyToNumber, type ItemKey } from '../../bandcamp';
import {
  gatherAlsoBought,
  getCompilations,
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
  coOwnerVotes,
  coOwnership,
  couldEnter,
  fallbackPicks,
  isConfident,
  isSmallRelease,
  maxTwinShare,
  rankScored,
  scoreCoOwned,
  twinBoosts,
  warmup,
  type AlsoBoughtPick,
  type Basis,
  type CoOwned,
  type FallbackPick,
  type Scored,
  type SupporterList,
  type TwinBoost,
} from '../../scoring/alsoBought';
import { discountCompilations } from '../../scoring/compilations';
import { exclusions } from '../../scoring/exclusions';
import { boostFollowed, maxFollowFactor } from '../../scoring/following';
import { supporters } from '../../scoring/weights';
import type { AlsoBoughtReason, AlsoBoughtResult, AlsoBoughtRow } from '../../shared/alsoBought';
import { loadFollowedReleases } from './followSignal';

/** Owner counts are looked up this many candidates at a time. */
const CHUNK = 200;

export interface AlsoBoughtOptions {
  /** Releases from accounts you follow score a little higher (decisions §16). */
  followingBoost?: boolean;
  /** Down-weight compilations among the picks (decisions §17). */
  ignoreCompilations?: boolean;
}

export async function computeAlsoBought(
  db: DigheadDb,
  releaseKey: ItemKey,
  meFanId: number | null,
  { followingBoost = true, ignoreCompilations = true }: AlsoBoughtOptions = {},
): Promise<AlsoBoughtResult> {
  const [data, followed] = await Promise.all([
    gatherAlsoBought(db, releaseKey, meFanId),
    loadFollowedReleases(db, followingBoost),
  ]);
  const excluded = exclusions(data.mine, data.hidden, data.matchKey);
  const basis = { supporters: data.supporters.length, population: data.population };

  const boosts = twinBoosts(data.twinSupporters, data.bestTwinScore);
  const candidates = coOwnership(
    data.supporters.map((s) => s.matchIds),
    excluded,
  );
  const scored = await scoreTop(db, candidates, data.supporters, basis, boosts, {
    followed,
    ignoreCompilations,
  });
  const wait = warmup(
    { read: data.supporters.length, allScanned: data.allScanned, listed: data.listed },
    scored.filter(isConfident).length,
  );
  // While warming up, same-artist and same-label picks fill the panel for any release.
  const fallback =
    wait !== null || isSmallRelease(data.knownOwners) ? await fallbackFor(db, data, excluded) : [];
  const picks = blendPicks(wait === null ? scored : [], fallback, ALSO_BOUGHT_LIMIT);

  const items = await getDisplayItems(
    db,
    picks.map((pick) => pick.matchKey),
  );
  const label = data.album?.label ?? data.release?.label ?? null;
  const rows = picks.flatMap((pick) => {
    const item = items.get(pick.matchKey);
    // Only co-owned rows were boosted; fallback picks are about the release's own seller.
    const follow = pick.kind === 'co-owned' ? followed.get(keyToNumber(pick.matchKey)) : undefined;
    return item ? [toRow(pick, item, reasonFor(pick, item.label ?? label), follow ?? null)] : [];
  });
  return { releaseKey, rows, warmup: wait };
}

/**
 * Scores candidates in falling co order, fetching owner counts and weighing votes a chunk at a
 * time, and stops once no remaining candidate can reach the top list (decisions §6). Within a chunk, only
 * candidates whose own twin share still lets them in are looked up. Ceilings are linear in co, so
 * scaling co by the follow boost keeps them exact (§16). Compilations are down-weighted (§17),
 * which only lowers scores, so the ceilings still hold.
 */
async function scoreTop(
  db: DigheadDb,
  candidates: CoOwned[],
  supporters: readonly SupporterList[],
  basis: Basis,
  boosts: ReadonlyMap<number, TwinBoost>,
  {
    followed,
    ignoreCompilations,
  }: { followed: ReadonlyMap<number, string>; ignoreCompilations: boolean },
): Promise<Scored[]> {
  const maxShare = maxTwinShare(boosts);
  const factor = maxFollowFactor(followed);
  const boostOf = (id: number) => boosts.get(id) ?? { share: 0, twins: 0 };
  let top: Scored[] = [];
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const first = candidates[start];
    if (!first || !couldEnter(top, ALSO_BOUGHT_LIMIT, first.co * factor, maxShare)) break;
    const chunk = candidates
      .slice(start, start + CHUNK)
      .filter((c) => couldEnter(top, ALSO_BOUGHT_LIMIT, c.co * factor, boostOf(c.id).share));
    const ids = chunk.map((c) => c.id);
    const [owners, compilations] = await Promise.all([
      getOwnerCounts(db, ids),
      ignoreCompilations ? getCompilations(db, ids) : new Set<number>(),
    ]);
    const votes = coOwnerVotes(ids, supporters);
    const scored = chunk.map((c) =>
      scoreCoOwned(
        { ...c, votes: votes.get(c.id) ?? c.co },
        owners.get(c.id) ?? c.co,
        basis,
        boostOf(c.id),
      ),
    );
    const adjusted = boostFollowed(discountCompilations(scored, compilations), followed);
    top = rankScored([...top, ...adjusted], ALSO_BOUGHT_LIMIT);
  }
  return top;
}

async function fallbackFor(
  db: DigheadDb,
  data: AlsoBoughtData,
  excluded: ReadonlySet<number>,
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
    excluded,
    ALSO_BOUGHT_LIMIT,
  );
}

function reasonFor(pick: AlsoBoughtPick, label: string | null): AlsoBoughtReason {
  switch (pick.kind) {
    case 'co-owned':
      return { kind: 'co-owned', owners: pick.co, twins: pick.twins };
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
  followed: string | null,
): AlsoBoughtRow {
  return {
    matchKey: pick.matchKey,
    title: item.title,
    artist: item.artist,
    label: item.label,
    url: item.url,
    coverUrl: item.artId === null ? null : artUrl(item.artId),
    reason,
    followed,
  };
}
