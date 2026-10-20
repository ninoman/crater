// Keeps Also-bought and twins-who-own-this lists fresh for releases open in a tab, answers the
// sidebar's requests, and keeps the taste-twins leaderboard up to date.

import { RELEASE_PAGE_PATTERNS, type ItemKey } from '../../bandcamp';
import { db, getMe, type JobKind } from '../../db';
import type { AlsoBoughtResult } from '../../shared/alsoBought';
import type { ReleaseTwinsResult } from '../../shared/releaseTwins';
import { broadcastToTabs } from '../../shared/messages';
import type { ScanProgress } from '../../shared/scan';
import { loadSettings } from '../../shared/settings';
import { computeAlsoBought } from './alsoBought';
import { computeReleaseTwins } from './releaseTwins';
import { rescoreDue } from './rescore';
import { computeTwins } from './twins';

/** Twins are recomputed after this many fans finish scanning. */
export const TWINS_EVERY_FANS = 25;

/** Supporters scanned since each release was last scored. Lost with the worker, which is fine. */
const fansSinceScore = new Map<ItemKey, number>();
let fansSinceTwins = 0;
let twinsRun: Promise<void> | null = null;
let twinsAgain = false;

export async function getAlsoBought(releaseKey: ItemKey): Promise<AlsoBoughtResult> {
  fansSinceScore.set(releaseKey, 0);
  const me = await getMe(db);
  return computeAlsoBought(db, releaseKey, me?.fanId ?? null);
}

export function getReleaseTwins(releaseKey: ItemKey): Promise<ReleaseTwinsResult> {
  return computeReleaseTwins(db, releaseKey);
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
  await broadcastToTabs(RELEASE_PAGE_PATTERNS, 'releaseTwins', await getReleaseTwins(releaseKey));
}

/** Recomputes twins now, or once more after the running pass if one is under way. */
export function refreshTwins(): void {
  fansSinceTwins = 0;
  if (twinsRun) {
    twinsAgain = true;
    return;
  }
  twinsRun = (async () => {
    do {
      twinsAgain = false;
      const me = await getMe(db);
      if (!me) return;
      await computeTwins(
        { db, settings: await loadSettings(), now: Date.now(), yieldNow: yieldToEvents },
        me.fanId,
      );
    } while (twinsAgain);
  })()
    .catch((error: unknown) => console.error('dighead: twins recompute failed', error))
    .finally(() => {
      twinsRun = null;
    });
}

/** A fan's collection scan ended. Every few fans, the leaderboard catches up. */
export function onFanScanned(): void {
  fansSinceTwins++;
  if (fansSinceTwins >= TWINS_EVERY_FANS) refreshTwins();
}

function yieldToEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
