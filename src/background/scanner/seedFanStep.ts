// A seed fan's first run (decisions §5): read in full only when they share enough with you,
// checked against their profile page when the supporter lists don't already show it.

import { ParserError, fetchFanProfile, firstPageToken } from '../../bandcamp';
import { getFan, getMe, isFollowedFan, saveFanProfile, seedFanBasis, type FanJob } from '../../db';
import { seedInCommonCutoff } from '../../scoring/supporterRank';
import { HttpError } from '../http';
import type { StepContext, StepResult } from './context';
import { fullStep } from './fanCollectionStep';
import { fanIdOf } from './fanId';
import { screenSeedFan } from './seedScreen';

/** Not worth a full read. The fan stays unscanned, so a page you open can still queue them. */
const SKIPPED: StepResult = { next: null, event: 'continued', parsed: null };

/** The full read, on the next run: this one already spent its request. */
function readNext(ctx: StepContext, parsed: StepResult['parsed']): StepResult {
  const cursor = { stage: 'full' as const, token: firstPageToken(ctx.now), scanned: 0 };
  return { next: { cursor }, event: 'continued', parsed };
}

export async function seedFirstStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  const me = await getMe(ctx.db);
  // Logged out, a profile has no in-common count to screen by.
  if (!me) return fullStep(ctx, job, null);
  const fanId = fanIdOf(job);
  const [{ yours, shared }, followed, fan] = await Promise.all([
    seedFanBasis(ctx.db, me.fanId, fanId),
    isFollowedFan(ctx.db, fanId),
    getFan(ctx.db, fanId),
  ]);
  const cutoff = seedInCommonCutoff(yours);
  const screen = screenSeedFan({ followed, shared, fan, cutoff, now: ctx.now });
  if (screen === 'read' || !fan) return fullStep(ctx, job, null);
  if (screen === 'skip') return SKIPPED;

  try {
    const profile = await fetchFanProfile(ctx.fetchText, fan.username);
    await saveFanProfile(ctx.db, fanId, profile, ctx.now);
    // A page read logged out has no count, so it can't rule them out.
    if (profile.inCommon !== null && profile.inCommon < cutoff) {
      return { ...SKIPPED, parsed: 'profile' };
    }
    return readNext(ctx, 'profile');
  } catch (error) {
    // The profile only screens; a renamed fan or a changed header shouldn't cost their scan.
    if (error instanceof HttpError && error.status === 404) return readNext(ctx, null);
    if (error instanceof ParserError) return { ...readNext(ctx, null), skippedParserError: error };
    throw error;
  }
}
