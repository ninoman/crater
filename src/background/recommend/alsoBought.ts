// Runs the Also-bought scorer for one release: gather, score with pruning, blend, then dress
// the picks for display.

import { artUrl, keyFromNumber, keyToNumber, type ItemKey } from '../../bandcamp';
import {
  gatherAlsoBought,
  getCompilations,
  getDisplayItems,
  getOwnerCounts,
  getSellerItems,
  getShownFields,
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
  maxCrateMateShare,
  rankScored,
  scoreCoOwned,
  crateMateBoosts,
  warmup,
  type AlsoBoughtPick,
  type Basis,
  type CoOwned,
  type FallbackPick,
  type Scored,
  type SupporterList,
  type CrateMateBoost,
} from '../../scoring/alsoBought';
import { discountCompilations } from '../../scoring/compilations';
import { type Exclusions, exclusions } from '../../scoring/exclusions';
import { boostFollowed, maxFollowFactor } from '../../scoring/following';
import { supporters } from '../../scoring/weights';
import type { AlsoBoughtReason, AlsoBoughtResult, AlsoBoughtRow } from '../../shared/alsoBought';
import type { HideScopes } from '../../shared/hide';
import { loadFollowedReleases } from './followSignal';
import { loadHideScopes } from './hideScopes';

/** Owner counts are looked up this many candidates at a time. */
const CHUNK = 200;

export interface AlsoBoughtOptions {
  /** Releases from accounts you follow score a little higher (decisions §16). */
  followingBoost?: boolean;
  /** Down-weight compilations among the picks (decisions §17). */
  ignoreCompilations?: boolean;
  /** Leave out releases you've heard, before the list is cut to length (decisions §22). */
  hideHeard?: boolean;
}

export async function computeAlsoBought(
  db: DigheadDb,
  releaseKey: ItemKey,
  meFanId: number | null,
  { followingBoost = true, ignoreCompilations = true, hideHeard = false }: AlsoBoughtOptions = {},
): Promise<AlsoBoughtResult> {
  const [data, followed] = await Promise.all([
    gatherAlsoBought(db, releaseKey, meFanId),
    loadFollowedReleases(db, followingBoost),
  ]);
  const excluded = exclusions(data.mine, data.hidden, {
    release: data.matchKey,
    heard: hideHeard ? data.heard : undefined,
  });
  const basis = { supporters: data.supporters.length, population: data.population };

  const boosts = crateMateBoosts(data.crateMateSupporters, data.bestCrateMateScore);
  const candidates = coOwnership(
    data.supporters.map((s) => s.matchIds),
    excluded.ids,
  );
  const scored = await scoreTop(db, candidates, data.supporters, basis, boosts, {
    followed,
    ignoreCompilations,
    excluded,
  });
  const wait = warmup(
    { read: data.supporters.length, allScanned: data.allScanned, listed: data.listed },
    scored.filter(isConfident).length,
  );
  // While warming up the co-owned rows are early picks, and same-artist and same-label picks
  // fill in behind them for any release.
  const fallback =
    wait !== null || isSmallRelease(data.knownOwners) ? await fallbackFor(db, data, excluded) : [];
  const picks = blendPicks(scored, fallback, ALSO_BOUGHT_LIMIT);

  const items = await getDisplayItems(
    db,
    picks.map((pick) => pick.matchKey),
  );
  const scopes = await loadHideScopes(db, items);
  const label = data.album?.label ?? data.release?.label ?? null;
  const rows = picks.flatMap((pick) => {
    const item = items.get(pick.matchKey);
    const hide = scopes.get(pick.matchKey);
    if (!item || !hide) return [];
    // Only co-owned rows were boosted; fallback picks are about the release's own seller.
    const follow = pick.kind === 'co-owned' ? followed.get(keyToNumber(pick.matchKey)) : undefined;
    const facts = { followed: follow ?? null, heard: data.heard.has(pick.matchKey), hide };
    return [toRow(pick, item, reasonFor(pick, item.label ?? label), facts)];
  });
  return { releaseKey, rows, warmup: wait };
}

/**
 * Scores candidates in falling co order, fetching owner counts and weighing votes a chunk at a
 * time, and stops once no remaining candidate can reach the top list (decisions §6). Within a chunk, only
 * candidates whose own crate mate share still lets them in are looked up. Ceilings are linear in co, so
 * scaling co by the follow boost keeps them exact (§16). Compilations are down-weighted (§17),
 * which only lowers scores, so the ceilings still hold. Candidates from a hidden artist or label
 * are dropped (§22); their records are read only when something like that is hidden.
 */
async function scoreTop(
  db: DigheadDb,
  candidates: CoOwned[],
  supporters: readonly SupporterList[],
  basis: Basis,
  boosts: ReadonlyMap<number, CrateMateBoost>,
  {
    followed,
    ignoreCompilations,
    excluded,
  }: { followed: ReadonlyMap<number, string>; ignoreCompilations: boolean; excluded: Exclusions },
): Promise<Scored[]> {
  const maxShare = maxCrateMateShare(boosts);
  const factor = maxFollowFactor(followed);
  const boostOf = (id: number) => boosts.get(id) ?? { share: 0, crateMates: 0 };
  let top: Scored[] = [];
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const first = candidates[start];
    if (!first || !couldEnter(top, ALSO_BOUGHT_LIMIT, first.co * factor, maxShare)) break;
    const chunk = await allowedSellers(
      db,
      candidates
        .slice(start, start + CHUNK)
        .filter((c) => couldEnter(top, ALSO_BOUGHT_LIMIT, c.co * factor, boostOf(c.id).share)),
      excluded,
    );
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

/** Candidates whose shown record isn't from a hidden artist or label. */
async function allowedSellers(
  db: DigheadDb,
  chunk: CoOwned[],
  excluded: Exclusions,
): Promise<CoOwned[]> {
  if (!excluded.checksSellers || chunk.length === 0) return chunk;
  const fields = await getShownFields(
    db,
    chunk.map((c) => keyFromNumber(c.id)),
  );
  return chunk.filter((c) => {
    const item = fields.get(keyFromNumber(c.id));
    return item === undefined || excluded.allows(item);
  });
}

async function fallbackFor(
  db: DigheadDb,
  data: AlsoBoughtData,
  excluded: Exclusions,
): Promise<FallbackPick[]> {
  const release = data.album ?? data.release;
  if (!release) return [];
  const seller = { ...release, labelId: data.album?.labelId ?? data.release?.labelId ?? null };
  const items = (await getSellerItems(db, seller.bandId, seller.labelId)).filter(excluded.allows);
  const ids = items.map((item) => keyToNumber(item.itemKey));
  const owners = await getOwnerCounts(db, ids);
  return fallbackPicks(
    seller,
    items.map((item, i) => ({
      ...item,
      supporters: supporters([item.supporterCount], owners.get(ids[i] ?? 0) ?? 0),
    })),
    excluded.ids,
    ALSO_BOUGHT_LIMIT,
  );
}

function reasonFor(pick: AlsoBoughtPick, label: string | null): AlsoBoughtReason {
  switch (pick.kind) {
    case 'co-owned':
      return { kind: 'co-owned', owners: pick.co, crateMates: pick.crateMates };
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
  facts: { followed: string | null; heard: boolean; hide: HideScopes },
): AlsoBoughtRow {
  return {
    matchKey: pick.matchKey,
    title: item.title,
    artist: item.artist,
    label: item.label,
    url: item.url,
    coverUrl: item.artId === null ? null : artUrl(item.artId),
    reason,
    ...facts,
  };
}
