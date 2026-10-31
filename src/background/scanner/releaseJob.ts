// A release job: fetch the page, then page its supporters up to the cap, one request per run.
// Supporters are saved and queued as fan jobs page by page, so progress shows up early.

import {
  ParserError,
  SUPPORTERS_FIRST_TOKEN,
  fetchApiRelease,
  fetchReleasePage,
  isBandcampUrl,
  fetchSupportersPage,
  type ApiRelease,
  type ItemKey,
  type ReleaseInfo,
  type Supporter,
} from '../../bandcamp';
import {
  addSupporterOwnership,
  appendReleaseSupporters,
  enqueueAt,
  fanJob,
  getItem,
  releaseSeller,
  saveReleaseSupporters,
  supportersFetchedAt,
  upsertReleasePageItem,
  upsertSupporterFans,
  type ReleaseCursor,
  type ReleaseJob,
} from '../../db';
import { BlockedHostError } from '../http';
import type { StepContext } from './context';
import { needsFanScan, supportersAreFresh } from './freshness';
import { rankSupporters } from './passZero';
import { SEED, SEED_FANS } from './priority';
import { rankSeedFansOnceListed } from './seedFans';

/** The site pages supporters 100 at a time too. */
const SUPPORTERS_PAGE_SIZE = 100;

/** Runs one step. Returns where to carry on, or null when the release is done. */
export async function runReleaseStep(
  ctx: StepContext,
  job: ReleaseJob,
): Promise<ReleaseCursor | null> {
  return job.cursor ? nextSupportersPage(ctx, job, job.cursor) : firstPage(ctx, job);
}

async function firstPage(ctx: StepContext, job: ReleaseJob): Promise<ReleaseCursor | null> {
  if (!isBandcampUrl(job.url)) return firstPageFromApi(ctx, job);
  const page = await fetchReleasePage(ctx.fetchText, job.url);
  await saveRelease(ctx, job, page);
  const supporters = page.supporters.slice(0, ctx.settings.supportersPerReleaseCap);
  await saveReleaseSupporters(
    ctx.db,
    job.target,
    supporters.map((s) => s.fanId),
    ctx.now,
  );
  await recordSupporters(ctx, job, page.item, supporters, 0);

  const lastToken = (reviewer: boolean) =>
    supporters.filter((s) => s.isReviewer === reviewer).at(-1)?.token ?? null;
  return carryOn(ctx, job, {
    thumbsToken: page.moreThumbsAvailable ? lastToken(false) : null,
    reviewsToken: page.moreReviewsAvailable ? lastToken(true) : null,
    collected: supporters.length,
  });
}

/**
 * A custom domain's page can't be fetched (decisions §5), so this reads the release from the
 * mobile API, and the supporters the page would embed start from the first token instead.
 */
async function firstPageFromApi(ctx: StepContext, job: ReleaseJob): Promise<ReleaseCursor | null> {
  const seller = await releaseSeller(ctx.db, job.target);
  if (seller === null) throw new BlockedHostError(job.url, 'its seller is unknown');
  await saveRelease(ctx, job, await fetchApiRelease(ctx.fetchJson, seller, job.target));
  await saveReleaseSupporters(ctx.db, job.target, [], ctx.now);
  return carryOn(ctx, job, {
    thumbsToken: SUPPORTERS_FIRST_TOKEN,
    reviewsToken: SUPPORTERS_FIRST_TOKEN,
    collected: 0,
  });
}

async function saveRelease(
  ctx: StepContext,
  job: ReleaseJob,
  { item, album }: ApiRelease,
): Promise<void> {
  if (item.itemKey !== job.target) {
    throw new ParserError('release page', `expected ${job.target}, got ${item.itemKey}`);
  }
  await upsertReleasePageItem(ctx.db, item);
  if (job.priority === SEED && album) await queueOwnTrackAlbum(ctx, job, album);
}

/**
 * A seed job on a track means you own tracks of its album but not the album, and the album's
 * buyers are crate mate candidates too. Only a track page knows the album's URL.
 */
async function queueOwnTrackAlbum(
  ctx: StepContext,
  job: ReleaseJob,
  album: { itemKey: ItemKey; url: string },
): Promise<void> {
  const listedAt = (await supportersFetchedAt(ctx.db, [album.itemKey])).get(album.itemKey);
  if (listedAt !== undefined && supportersAreFresh({ fetchedAt: listedAt }, ctx.now)) return;
  const spec = { kind: 'release' as const, target: album.itemKey, url: album.url };
  await enqueueAt(ctx.db, [{ spec, at: job.nextAttemptAt }], SEED);
}

/** Thumbs first, since they're the most recent buyers; reviewers fill what's left of the cap. */
async function nextSupportersPage(
  ctx: StepContext,
  job: ReleaseJob,
  cursor: ReleaseCursor,
): Promise<ReleaseCursor | null> {
  const kind = cursor.thumbsToken !== null ? 'thumbs' : 'reviews';
  const token = cursor.thumbsToken ?? cursor.reviewsToken;
  const release = await getItem(ctx.db, job.target);
  // The first step saved the item; without it (or a token) there's nothing to carry on from.
  if (token === null || !release) return null;

  const room = ctx.settings.supportersPerReleaseCap - cursor.collected;
  const page = await fetchSupportersPage(
    ctx.fetchJson,
    kind,
    job.target,
    token,
    Math.max(1, Math.min(SUPPORTERS_PAGE_SIZE, room)),
  );
  const supporters = page.supporters.slice(0, Math.max(0, room));
  await appendReleaseSupporters(
    ctx.db,
    job.target,
    supporters.map((s) => s.fanId),
    ctx.now,
  );
  await recordSupporters(ctx, job, release, supporters, cursor.collected);

  const next = page.moreAvailable ? (supporters.at(-1)?.token ?? null) : null;
  return carryOn(ctx, job, {
    thumbsToken: kind === 'thumbs' ? next : null,
    reviewsToken: kind === 'reviews' ? next : cursor.reviewsToken,
    collected: cursor.collected + supporters.length,
  });
}

/**
 * Carries on paging, or, with the whole list in, ranks its supporters' scans: pass 0 for a
 * release you opened, the whole seed backlog once the last seed list is in.
 */
async function carryOn(
  ctx: StepContext,
  job: ReleaseJob,
  cursor: ReleaseCursor,
): Promise<ReleaseCursor | null> {
  const exhausted = cursor.thumbsToken === null && cursor.reviewsToken === null;
  if (!exhausted && cursor.collected < ctx.settings.supportersPerReleaseCap) return cursor;
  if (job.priority === SEED) await rankSeedFansOnceListed(ctx.db, ctx.now, job.id);
  else await rankSupporters(ctx.db, job.target);
  return null;
}

/**
 * Saves the fans and what they own, and queues the ones not scanned recently. For a release you
 * opened they take its priority and place in line, so its fans run before the next release at
 * that priority (vertical). A seed list's fans wait at SEED_FANS, behind every seed list
 * (horizontal, decisions §5). Either way they keep page order (`offset` is where this page
 * starts) until they're ranked.
 */
async function recordSupporters(
  ctx: StepContext,
  job: ReleaseJob,
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
  supporters: Supporter[],
  offset: number,
): Promise<void> {
  const fans = await upsertSupporterFans(ctx.db, supporters, ctx.now);
  await addSupporterOwnership(ctx.db, release, supporters);
  const seed = job.priority === SEED;
  const at = seed ? 0 : job.nextAttemptAt;
  const stale = fans.flatMap((fan, i) =>
    needsFanScan(fan, ctx.now)
      ? [{ spec: fanJob(fan.fanId, job.target), at, rank: offset + i + 1 }]
      : [],
  );
  await enqueueAt(ctx.db, stale, seed ? SEED_FANS : job.priority);
}
