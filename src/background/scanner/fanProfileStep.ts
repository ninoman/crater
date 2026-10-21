// Pass 1 (decisions §12): a fan's profile page, read signed in, gives Bandcamp's in-common count,
// which moves their collection read up or back.

import { ParserError, fetchFanProfile, type FanProfile } from '../../bandcamp';
import {
  collectionMatchCount,
  getFan,
  getMe,
  profiledSupporters,
  saveFanProfile,
  type FanJob,
} from '../../db';
import { inCommonSimilarity, readsAhead } from '../../scoring/supporterRank';
import { HttpError } from '../http';
import type { StepContext, StepResult } from './context';
import { fanIdOf } from './fanId';
import { profiledRank } from './priority';

const QUICK = { cursor: { stage: 'quick' as const } };

export async function profileStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  const fanId = fanIdOf(job);
  const fan = await getFan(ctx.db, fanId);
  if (!fan) return { next: QUICK, event: 'continued', parsed: null };

  let profile: FanProfile;
  try {
    profile = await fetchFanProfile(ctx.fetchText, fan.username);
  } catch (error) {
    // The profile only ranks; a renamed fan or a changed header shouldn't cost their scan.
    if (error instanceof HttpError && error.status === 404) {
      return { next: QUICK, event: 'continued', parsed: null };
    }
    if (error instanceof ParserError) {
      return { next: QUICK, event: 'continued', parsed: null, skippedParserError: error };
    }
    throw error;
  }
  await saveFanProfile(ctx.db, fanId, profile);
  return {
    next: { ...QUICK, rank: await rankAfterProfile(ctx, job, profile) },
    event: 'continued',
    parsed: 'profile',
  };
}

/**
 * Ahead of the profiles still waiting when it's at least half as close as the best of this
 * release's supporters so far. Logged out there's no count, so the fan keeps their pass-0 place.
 */
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
