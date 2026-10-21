// A fan job, one request per run (decisions §12): first the fan's profile page, whose in-common
// count decides how soon their collection is read (pass 1), then the collection itself, paged
// from a synthetic first token (decisions §3.4) up to the collection cap.

import {
  BandcampApiError,
  ParserError,
  fetchCollectionPage,
  fetchFanProfile,
  firstPageToken,
  type FanProfile,
} from '../../bandcamp';
import {
  collectionMatchCount,
  finishFanScan,
  getFan,
  getMe,
  profiledSupporters,
  putOwnership,
  saveFanProfile,
  upsertCollectionItems,
  type FanJob,
} from '../../db';
import { inCommonSimilarity, readsAhead } from '../../scoring/supporterRank';
import { HttpError } from '../http';
import type { StepContext, StepResult } from './context';
import { SEED, profiledRank } from './priority';

export function fanIdOf(job: FanJob): number {
  return Number(job.target);
}

/** Runs one step: the next request this fan's scan needs. */
export async function runFanStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  if (job.cursor === null && (await wantsProfile(ctx, job))) return profileStep(ctx, job);
  return collectionStep(ctx, job);
}

/**
 * Seed scans fill twins, not a page you're looking at, so they skip straight to the collection.
 * So does everything while logged out, where the profile has no count.
 */
async function wantsProfile(ctx: StepContext, job: FanJob): Promise<boolean> {
  return job.priority < SEED && (await getMe(ctx.db)) !== undefined;
}

/** Pass 1: reads the profile and moves the collection read up or back by its overlap. */
async function profileStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  const fanId = fanIdOf(job);
  const fan = await getFan(ctx.db, fanId);
  const next = { cursor: { stage: 'full' as const, token: firstPageToken(ctx.now), scanned: 0 } };
  if (!fan) return { next, event: 'continued', parsed: null };

  let profile: FanProfile;
  try {
    profile = await fetchFanProfile(ctx.fetchText, fan.username);
  } catch (error) {
    // The profile only ranks; a renamed fan or a changed header shouldn't cost their scan.
    if (error instanceof HttpError && error.status === 404) {
      return { next, event: 'continued', parsed: null };
    }
    if (error instanceof ParserError) {
      return { next, event: 'continued', parsed: null, skippedParserError: error };
    }
    throw error;
  }
  await saveFanProfile(ctx.db, fanId, profile);
  return {
    next: { ...next, rank: await rankAfterProfile(ctx, job, profile) },
    event: 'continued',
    parsed: 'profile',
  };
}

/** Logged out there's no count, so the fan keeps their pass-0 place. */
async function rankAfterProfile(
  ctx: StepContext,
  job: FanJob,
  profile: FanProfile,
): Promise<number> {
  if (profile.inCommon === null) return job.rank;
  const me = await getMe(ctx.db);
  const yours = me ? await collectionMatchCount(ctx.db, me.fanId) : 0;
  const similarity = inCommonSimilarity(profile.inCommon, yours, profile.itemCount);
  const others = job.via ? await profiledSupporters(ctx.db, job.via) : [];
  const best = Math.max(
    similarity,
    ...others.map((fan) => inCommonSimilarity(fan.inCommon, yours, fan.itemCount)),
  );
  return profiledRank(similarity, readsAhead(similarity, best));
}

/** Pages the collection from the newest item. */
async function collectionStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  const { db, now, settings } = ctx;
  const fanId = fanIdOf(job);
  const cursor = job.cursor?.stage === 'full' ? job.cursor : null;
  const token = cursor?.token ?? firstPageToken(now);
  const scanned = cursor?.scanned ?? 0;
  const count = Math.max(
    1,
    Math.min(settings.collectionBatchSize, settings.collectionCap - scanned),
  );
  const finished: StepResult = { next: null, event: 'finished', parsed: 'fan' };

  let page: Awaited<ReturnType<typeof fetchCollectionPage>>;
  try {
    page = await fetchCollectionPage(ctx.fetchJson, 'collection', fanId, token, count);
  } catch (error) {
    if (!(error instanceof BandcampApiError)) throw error;
    // On the first page this is a collection we can't read (decisions §2). Later on, keep
    // what we already have.
    await finishFanScan(db, fanId, scanned > 0 ? 'partial' : 'private', scanned, now);
    return finished;
  }

  await upsertCollectionItems(db, page.items, now);
  await putOwnership(db, fanId, page.items, 'collection');
  const total = scanned + page.items.length;
  // A repeated token would loop forever, so treat it as the end.
  const next = page.moreAvailable && page.nextToken !== token ? page.nextToken : null;

  if (next === null) {
    await finishFanScan(db, fanId, 'done', total, now);
    return finished;
  }
  if (total >= settings.collectionCap) {
    await finishFanScan(db, fanId, 'partial', total, now);
    return finished;
  }
  return {
    next: { cursor: { stage: 'full', token: next, scanned: total } },
    event: 'continued',
    parsed: 'fan',
  };
}

/** A fan whose job was dropped after failing. */
export async function abandonFan(ctx: StepContext, job: FanJob): Promise<void> {
  const scanned = job.cursor?.stage === 'full' ? job.cursor.scanned : 0;
  await finishFanScan(ctx.db, fanIdOf(job), 'error', scanned, ctx.now);
}
