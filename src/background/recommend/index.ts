// Keeps Also-bought and crate-mates-who-own-this lists fresh for releases open in a tab, answers the
// sidebar's requests, and keeps the crate-mates leaderboard up to date.

import { FAN_PAGE_PATTERNS, RELEASE_PAGE_PATTERNS, type ItemKey } from '../../bandcamp';
import { countReadFans, db, getMe, type JobKind } from '../../db';
import type { AlsoBoughtResult } from '../../shared/alsoBought';
import type { ForYouMode, ForYouResult } from '../../shared/forYou';
import type { ReleaseCrateMatesResult } from '../../shared/releaseCrateMates';
import type { CrateMatesResult } from '../../shared/crateMates';
import type { CrateMatesLatestResult } from '../../shared/crateMatesLatest';
import { broadcastToTabs } from '../../shared/messages';
import type { ScanProgress } from '../../shared/scan';
import { loadSettings } from '../../shared/settings';
import { keepAliveWhile } from '../keepAlive';
import { computeAlsoBought } from './alsoBought';
import { computeDeepCuts } from './deepCuts';
import { computeForYou } from './forYou';
import { computeReleaseCrateMates } from './releaseCrateMates';
import { rescoreDue } from './rescore';
import { readCrateMatesResult } from './crateMateRows';
import { computeCrateMates } from './crateMates';
import { computeCrateMatesLatest } from './crateMatesLatest';
import { chromeCrateMatesBasisStore, recomputeDue } from './crateMatesBasis';
import { crateMatesOnOpen } from './crateMatesOnOpen';

export { getCrateMateStanding, getCrateMateStandings } from './crateMateStanding';

/** Crate mates are recomputed after this many more fans are read. */
export const CRATE_MATES_EVERY_FANS = 15;

/** Supporters scanned since each release was last scored. Lost with the worker, which is fine. */
const fansSinceScore = new Map<ItemKey, number>();
let crateMatesRun: Promise<void> | null = null;
let crateMatesAgain = false;

/**
 * `hideHeard` leaves out releases you've heard (decisions §22). Re-scores pushed to tabs keep
 * them in; a sidebar hiding them asks again.
 */
export async function getAlsoBought(
  releaseKey: ItemKey,
  hideHeard = false,
): Promise<AlsoBoughtResult> {
  fansSinceScore.set(releaseKey, 0);
  const [me, settings] = await Promise.all([getMe(db), loadSettings()]);
  return computeAlsoBought(db, releaseKey, me?.fanId ?? null, {
    followingBoost: settings.followingBoost,
    ignoreCompilations: settings.ignoreCompilations,
    hideHeard,
  });
}

/** For you on your profile, from the stored crate mates leaderboard, or the lately one for Fresh. */
export async function getForYou(mode: ForYouMode, hideHeard: boolean): Promise<ForYouResult> {
  const [me, settings] = await Promise.all([getMe(db), loadSettings()]);
  if (mode === 'deep') {
    return computeDeepCuts(db, me, {
      maxSupporters: settings.deepCutMaxSupporters,
      ignoreCompilations: settings.ignoreCompilations,
      hideHeard,
    });
  }
  return computeForYou(db, me, {
    mode,
    topCrateMatesK: settings.topCrateMatesK,
    latelyHalfLifeMonths: settings.latelyHalfLifeMonths,
    followingBoost: settings.followingBoost,
    ignoreCompilations: settings.ignoreCompilations,
    hideHeard,
    now: Date.now(),
  });
}

/** Crate mates' latest on your profile: what your top crate mates bought lately. */
export async function getCrateMatesLatest(hideHeard: boolean): Promise<CrateMatesLatestResult> {
  const [me, settings] = await Promise.all([getMe(db), loadSettings()]);
  return computeCrateMatesLatest(db, me, {
    topCrateMatesK: settings.topCrateMatesK,
    hideHeard,
    now: Date.now(),
  });
}

/**
 * Both crate mates leaderboards for the Crate mates tab on your profile. Fans read since the last
 * recompute are folded in behind the stored board, and `crateMatesRecomputed` tells the tab.
 */
export function getCrateMatesResult(): Promise<CrateMatesResult> {
  return crateMatesOnOpen({
    stale: async () => {
      const [fansRead, atLastRecompute] = await Promise.all([
        countReadFans(db),
        chromeCrateMatesBasisStore.load(),
      ]);
      return fansRead !== atLastRecompute;
    },
    read: async () => readCrateMatesResult(db, (await loadSettings()).latelyHalfLifeMonths),
    refresh: refreshCrateMates,
  });
}

export function getReleaseCrateMates(releaseKey: ItemKey): Promise<ReleaseCrateMatesResult> {
  return computeReleaseCrateMates(db, releaseKey);
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
  await broadcastToTabs(
    RELEASE_PAGE_PATTERNS,
    'alsoBought',
    // Pushes keep heard releases in; a sidebar hiding them asks again (useAlsoBought).
    await getAlsoBought(releaseKey),
  );
  await broadcastToTabs(
    RELEASE_PAGE_PATTERNS,
    'releaseCrateMates',
    await getReleaseCrateMates(releaseKey),
  );
}

/**
 * Recomputes crate mates now, or once more after the running pass if one is under way. Resolves
 * when no pass is left; failures are logged, not thrown.
 */
export function refreshCrateMates(): Promise<void> {
  if (crateMatesRun) {
    crateMatesAgain = true;
    return crateMatesRun;
  }
  let recomputed = false;
  // Nothing else may hold the worker awake: the tab no longer waits on this.
  crateMatesRun = keepAliveWhile(
    (async () => {
      do {
        crateMatesAgain = false;
        const me = await getMe(db);
        if (!me) return;
        const fansRead = await countReadFans(db);
        await computeCrateMates(
          { db, settings: await loadSettings(), now: Date.now(), yieldNow: yieldToEvents },
          me.fanId,
        );
        await chromeCrateMatesBasisStore.save(fansRead);
        recomputed = true;
      } while (crateMatesAgain);
    })(),
  )
    .catch((error: unknown) => console.error('crater: crate mates recompute failed', error))
    .finally(() => {
      crateMatesRun = null;
      if (recomputed) announceCrateMates();
    });
  return crateMatesRun;
}

/** Only after a pass that stored a board, so a failing recompute can't make tabs ask in a loop. */
function announceCrateMates(): void {
  broadcastToTabs(FAN_PAGE_PATTERNS, 'crateMatesRecomputed', {}).catch((error: unknown) =>
    console.warn('crater: could not announce crate mates', error),
  );
}

/** A fan's collection scan ended. Every few fans read, the leaderboard catches up. */
export async function onFanScanned(): Promise<void> {
  if (crateMatesRun) return;
  const [fansRead, atLastRecompute] = await Promise.all([
    countReadFans(db),
    chromeCrateMatesBasisStore.load(),
  ]);
  if (recomputeDue(fansRead, atLastRecompute, CRATE_MATES_EVERY_FANS)) void refreshCrateMates();
}

function yieldToEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
