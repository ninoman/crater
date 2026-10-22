// Reading a fan's collection: the quick read (pass 2, decisions §12), then the full scan from a
// synthetic first token (decisions §3.4) up to the collection cap.

import {
  BandcampApiError,
  fetchCollectionPage,
  firstPageToken,
  type CollectionPage,
} from '../../bandcamp';
import {
  finishFanScan,
  getFan,
  markQuickRead,
  purchasedAt,
  putOwnership,
  upsertCollectionItems,
  type FanCursor,
  type FanJob,
} from '../../db';
import type { StepContext, StepResult } from './context';
import { fanIdOf } from './fanId';
import { BACKGROUND, FULL_SCAN_RANK } from './priority';

/** One request's worth of a collection, around the purchase that made them a supporter. */
export const QUICK_READ_ITEMS = 100;
/** The quick read starts this long after their purchase, so it holds what they bought around it. */
export const QUICK_READ_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

type FullCursor = Extract<FanCursor, { stage: 'full' }>;

/**
 * Fetches and saves one page. A `{"error": true}` on a fan's first page is a collection we
 * can't read (decisions §2); later on, keep what we already have. Null when the scan ended.
 */
async function readPage(
  ctx: StepContext,
  fanId: number,
  token: string,
  count: number,
  scanned: number,
): Promise<CollectionPage | null> {
  let page: CollectionPage;
  try {
    page = await fetchCollectionPage(ctx.fetchJson, 'collection', fanId, token, count);
  } catch (error) {
    if (!(error instanceof BandcampApiError)) throw error;
    await finishFanScan(ctx.db, fanId, scanned > 0 ? 'partial' : 'private', scanned, ctx.now);
    return null;
  }
  await upsertCollectionItems(ctx.db, page.items);
  await putOwnership(ctx.db, fanId, page.items, 'collection');
  return page;
}

/** A repeated token would loop forever, so treat it as the end. */
function nextToken(page: CollectionPage, token: string): string | null {
  return page.moreAvailable && page.nextToken !== token ? page.nextToken : null;
}

const FINISHED: StepResult = { next: null, event: 'finished', parsed: 'fan' };

/**
 * Pass 2: 100 items from a few months after they bought the release, so what they bought
 * around it, rather than their newest. A collection that fits in one read is read from the top,
 * in full. Then the full scan waits at background priority, behind every quick read.
 */
export async function quickStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  const fanId = fanIdOf(job);
  const fan = await getFan(ctx.db, fanId);
  const bought = job.via ? await purchasedAt(ctx.db, fanId, job.via) : null;
  const fits = fan?.itemCount !== undefined && fan.itemCount <= QUICK_READ_ITEMS;
  // A recent purchase anchors at now anyway, which is the top of the collection.
  const anchor = bought === null ? ctx.now : Math.min(ctx.now, bought + QUICK_READ_AFTER_MS);
  const fromTop = fits || anchor === ctx.now;
  const token = firstPageToken(fromTop ? ctx.now : anchor);

  const page = await readPage(ctx, fanId, token, QUICK_READ_ITEMS, 0);
  if (!page) return FINISHED;
  const after = nextToken(page, token);
  if (fromTop && after === null) {
    await finishFanScan(ctx.db, fanId, 'done', page.items.length, ctx.now);
    return FINISHED;
  }
  await markQuickRead(ctx.db, fanId, page.items.length, ctx.now);
  // Read from the top already, the full scan carries on from here instead of starting over.
  const cursor: FullCursor =
    fromTop && after !== null
      ? { stage: 'full', token: after, scanned: page.items.length }
      : { stage: 'full', token: firstPageToken(ctx.now), scanned: 0 };
  return {
    next: { cursor, priority: Math.max(job.priority, BACKGROUND), rank: FULL_SCAN_RANK + job.rank },
    event: 'read',
    parsed: 'fan',
  };
}

/** Pages the whole collection from the newest item, up to the cap. */
export async function fullStep(
  ctx: StepContext,
  job: FanJob,
  cursor: FullCursor | null,
): Promise<StepResult> {
  const { db, now, settings } = ctx;
  const fanId = fanIdOf(job);
  const token = cursor?.token ?? firstPageToken(now);
  const scanned = cursor?.scanned ?? 0;
  const count = Math.max(
    1,
    Math.min(settings.collectionBatchSize, settings.collectionCap - scanned),
  );

  const page = await readPage(ctx, fanId, token, count, scanned);
  if (!page) return FINISHED;
  const total = scanned + page.items.length;
  const next = nextToken(page, token);

  if (next === null) {
    await finishFanScan(db, fanId, 'done', total, now);
    return FINISHED;
  }
  if (total >= settings.collectionCap) {
    await finishFanScan(db, fanId, 'partial', total, now);
    return FINISHED;
  }
  return {
    next: { cursor: { stage: 'full', token: next, scanned: total } },
    event: 'continued',
    parsed: 'fan',
  };
}
