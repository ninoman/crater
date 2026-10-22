// A top lately twin's newest purchases, read from the top until the page reaches what the last
// read already saw (decisions §11). Usually one request, against up to 20 for a full re-scan.

import {
  BandcampApiError,
  fetchCollectionPage,
  firstPageToken,
  type CollectionPage,
} from '../../bandcamp';
import {
  finishLatestRead,
  knownItemKeys,
  putOwnership,
  upsertCollectionItems,
  type FanCursor,
  type FanJob,
} from '../../db';
import type { StepContext, StepResult } from './context';
import { fanIdOf } from './fanId';

type LatestCursor = Extract<FanCursor, { stage: 'latest' }>;

/** Reads one page of a latest read, and ends it once the page goes back past `since`. */
export async function latestStep(
  ctx: StepContext,
  job: FanJob,
  cursor: LatestCursor,
): Promise<StepResult> {
  const { db, now, settings } = ctx;
  const fanId = fanIdOf(job);
  const token = cursor.token ?? firstPageToken(now);
  const finish = async (added: number): Promise<StepResult> => {
    await finishLatestRead(db, fanId, added, now);
    return { next: null, event: 'finished', parsed: 'fan' };
  };

  let page: CollectionPage;
  try {
    page = await fetchCollectionPage(
      ctx.fetchJson,
      'collection',
      fanId,
      token,
      settings.collectionBatchSize,
    );
  } catch (error) {
    // Unlike a first scan, there's a collection on file already: keep it rather than call the
    // fan private over one refused page.
    if (error instanceof BandcampApiError) return finish(cursor.added);
    throw error;
  }

  const known = await knownItemKeys(
    db,
    fanId,
    page.items.map((item) => item.itemKey),
  );
  await upsertCollectionItems(db, page.items);
  await putOwnership(db, fanId, page.items, 'collection');
  const added = cursor.added + page.items.filter((item) => !known.has(item.itemKey)).length;

  const reachedOld = page.items.some(
    (item) => item.addedAt !== null && item.addedAt <= cursor.since,
  );
  const next = page.moreAvailable && page.nextToken !== token ? page.nextToken : null;
  if (reachedOld || next === null || added >= settings.collectionCap) return finish(added);
  return {
    next: { cursor: { ...cursor, token: next, added } },
    event: 'continued',
    parsed: 'fan',
  };
}
