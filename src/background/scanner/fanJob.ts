// A fan job: page the fan's collection from a synthetic first token (decisions §3.4), one
// request per run, up to the collection cap.

import { BandcampApiError, fetchCollectionPage, firstPageToken } from '../../bandcamp';
import {
  finishFanScan,
  putOwnership,
  upsertCollectionItems,
  type FanCursor,
  type FanJob,
} from '../../db';
import type { StepContext } from './context';

export function fanIdOf(job: FanJob): number {
  return Number(job.target);
}

/** Runs one step. Returns where to carry on, or null once the fan's status is final. */
export async function runFanStep(ctx: StepContext, job: FanJob): Promise<FanCursor | null> {
  const { db, now, settings } = ctx;
  const fanId = fanIdOf(job);
  const token = job.cursor?.token ?? firstPageToken(now);
  const scanned = job.cursor?.scanned ?? 0;
  const count = Math.max(
    1,
    Math.min(settings.collectionBatchSize, settings.collectionCap - scanned),
  );

  let page: Awaited<ReturnType<typeof fetchCollectionPage>>;
  try {
    page = await fetchCollectionPage(ctx.fetchJson, 'collection', fanId, token, count);
  } catch (error) {
    if (!(error instanceof BandcampApiError)) throw error;
    // On the first page this is a collection we can't read (decisions §2). Later on, keep
    // what we already have.
    await finishFanScan(db, fanId, job.cursor ? 'partial' : 'private', scanned, now);
    return null;
  }

  await upsertCollectionItems(db, page.items, now);
  await putOwnership(db, fanId, page.items, 'collection');
  const total = scanned + page.items.length;
  // A repeated token would loop forever, so treat it as the end.
  const next = page.moreAvailable && page.nextToken !== token ? page.nextToken : null;

  if (next === null) {
    await finishFanScan(db, fanId, 'done', total, now);
    return null;
  }
  if (total >= settings.collectionCap) {
    await finishFanScan(db, fanId, 'partial', total, now);
    return null;
  }
  return { token: next, scanned: total };
}

/** A fan whose job was dropped after failing. */
export async function abandonFan(ctx: StepContext, job: FanJob): Promise<void> {
  await finishFanScan(ctx.db, fanIdOf(job), 'error', job.cursor?.scanned ?? 0, ctx.now);
}
