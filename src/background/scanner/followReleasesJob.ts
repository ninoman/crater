// A followReleases job (decisions §22): read a followed band's discography, then the details of
// its news that has no URL yet, one request per run.

import {
  BandcampApiError,
  fetchDiscography,
  fetchReleaseDetails,
  ParserError,
  type ItemKey,
} from '../../bandcamp';
import {
  getBandRelease,
  saveDiscography,
  saveReleaseDetails,
  type FollowReleasesJob,
} from '../../db';
import { releasesNeedingDetails, windowStart } from '../../scoring/followsDigest';
import type { StepContext, StepResult } from './context';

function carryOn(pending: ItemKey[]): StepResult {
  return pending.length > 0
    ? {
        next: { cursor: { stage: 'details', pending } },
        event: 'continued',
        parsed: 'followReleases',
      }
    : { next: null, event: 'finished', parsed: 'followReleases' };
}

export async function runFollowReleasesStep(
  ctx: StepContext,
  job: FollowReleasesJob,
): Promise<StepResult> {
  const bandId = Number(job.target);
  if (!job.cursor) {
    const discography = await fetchDiscography(ctx.fetchJson, bandId);
    if (discography.bandId !== bandId) {
      throw new ParserError('band_details', `expected band ${bandId}, got ${discography.bandId}`);
    }
    const rows = await saveDiscography(ctx.db, discography, ctx.now);
    return carryOn(releasesNeedingDetails(rows, windowStart(ctx.now)));
  }

  const [key, ...rest] = job.cursor.pending;
  const release = key && (await getBandRelease(ctx.db, bandId, key));
  if (release) {
    try {
      const details = await fetchReleaseDetails(ctx.fetchJson, release.sellerId, release.itemKey);
      await saveReleaseDetails(ctx.db, bandId, details);
    } catch (error) {
      // Taken down since the read: the band's next read drops it. The rest still need reading.
      if (!(error instanceof BandcampApiError)) throw error;
    }
  }
  return carryOn(rest);
}
