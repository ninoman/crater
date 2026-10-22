// A release job: fetch the page, then page its supporters up to the cap, one request per run.
// Supporters are saved and queued as fan jobs page by page, so progress shows up early.

import {
  ParserError,
  fetchReleasePage,
  fetchSupportersPage,
  type ReleaseInfo,
  type Supporter,
} from '../../bandcamp';
import {
  addSupporterOwnership,
  appendReleaseSupporters,
  enqueueAt,
  fanJob,
  getItem,
  saveReleaseSupporters,
  upsertReleasePageItem,
  upsertSupporterFans,
  type ReleaseCursor,
  type ReleaseJob,
} from '../../db';
import type { StepContext } from './context';
import { needsFanScan } from './freshness';
import { rankSupporters } from './passZero';

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
  const page = await fetchReleasePage(ctx.fetchText, job.url);
  if (page.item.itemKey !== job.target) {
    throw new ParserError('release page', `expected ${job.target}, got ${page.item.itemKey}`);
  }
  await upsertReleasePageItem(ctx.db, page.item);
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

/** Carries on paging, or, with the whole list in, ranks its supporters' scans (pass 0). */
async function carryOn(
  ctx: StepContext,
  job: ReleaseJob,
  cursor: ReleaseCursor,
): Promise<ReleaseCursor | null> {
  const exhausted = cursor.thumbsToken === null && cursor.reviewsToken === null;
  if (!exhausted && cursor.collected < ctx.settings.supportersPerReleaseCap) return cursor;
  await rankSupporters(ctx.db, job.target);
  return null;
}

/**
 * Saves the fans and what they own, and queues the ones not scanned recently. They take the
 * release job's priority and place in line, so a release's fans run before the next release at
 * that priority: your newest seed releases fill in fully before older ones start. Within it they
 * keep page order (`offset` is where this page starts) until pass 0 ranks them.
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
  const stale = fans.flatMap((fan, i) =>
    needsFanScan(fan, ctx.now)
      ? [{ spec: fanJob(fan.fanId, job.target), at: job.nextAttemptAt, rank: offset + i + 1 }]
      : [],
  );
  await enqueueAt(ctx.db, stale, job.priority);
}
