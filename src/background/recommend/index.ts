// Keeps Also-bought lists fresh for releases open in a tab, and answers the sidebar's requests.

import { RELEASE_PAGE_PATTERNS, type ItemKey } from '../../bandcamp';
import { db, getMe, type JobKind } from '../../db';
import type { AlsoBoughtResult } from '../../shared/alsoBought';
import { broadcastToTabs } from '../../shared/messages';
import type { ScanProgress } from '../../shared/scan';
import { computeAlsoBought } from './alsoBought';
import { rescoreDue } from './rescore';

/** Supporters scanned since each release was last scored. Lost with the worker, which is fine. */
const fansSinceScore = new Map<ItemKey, number>();

export async function getAlsoBought(releaseKey: ItemKey): Promise<AlsoBoughtResult> {
  fansSinceScore.set(releaseKey, 0);
  const me = await getMe(db);
  return computeAlsoBought(db, releaseKey, me?.fanId ?? null);
}

/** A job finished for a watched release. Re-scores and pushes the list to tabs when due. */
export async function onScanStep(
  releaseKey: ItemKey,
  kind: JobKind,
  progress: ScanProgress,
): Promise<void> {
  const since = (fansSinceScore.get(releaseKey) ?? 0) + (kind === 'fan' ? 1 : 0);
  if (!rescoreDue(kind, since, progress)) {
    fansSinceScore.set(releaseKey, since);
    return;
  }
  await broadcastToTabs(RELEASE_PAGE_PATTERNS, 'alsoBought', await getAlsoBought(releaseKey));
}
