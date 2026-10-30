// Wires the scan loop to Chrome: storage, alarms, tabs and the message handlers.

import {
  isBandcampUrl,
  RELEASE_PAGE_PATTERNS,
  type ItemKey,
  type ReleasePageItem,
} from '../../bandcamp';
import {
  clearAllData,
  countJobs,
  countScannedFans,
  db,
  enqueue,
  focusRelease,
  getMe,
  getReleaseSupporters,
  releasesSupportedBy,
  upsertReleasePageItem,
  type QueueJob,
} from '../../db';
import { broadcastToTabs } from '../../shared/messages';
import type { QueueReleaseStatus, ScannerStatus, ScanProgress } from '../../shared/scan';
import { loadSettings } from '../../shared/settings';
import { notifyWhenRoundEnds } from '../follows/notify';
import { fetchJson, fetchText } from '../http';
import { ownSyncSettled, type SyncResult } from '../meSync';
import { onFanScanned, onScanStep } from '../recommend';
import { usedToday } from './budget';
import type { StepEvent } from './context';
import { fanIdOf } from './fanJob';
import { queueFollowReads } from './followReleases';
import { supportersAreFresh } from './freshness';
import { queueLatelyRescans } from './latelyRescan';
import { rankSupporters } from './passZero';
import { queueRelease } from './queueRelease';
import { releaseProgress } from './progress';
import { BACKGROUND, FOLLOW_RELEASES, FOREGROUND } from './priority';
import { drainQueue, type SchedulerDeps } from './scheduler';
import { ownReleaseProgress, seedOwnReleases } from './seed';
import { withImportPause } from './importPause';
import { chromeScannerStore, pauseFor, resumePatch } from './state';
import { clearWatchedReleases, watchedReleases, watchRelease } from './watched';

export const SCANNER_ALARM = 'scanner';

/**
 * Sends progress for watched releases after each step, and re-scores them when a job ends or a
 * fan's collection becomes usable.
 */
async function reportProgress(job: QueueJob, event: StepEvent): Promise<void> {
  const changed = event !== 'continued';
  if (job.kind === 'followReleases') return;
  try {
    const releases: ItemKey[] =
      job.kind === 'release'
        ? [job.target]
        : changed
          ? await releasesSupportedBy(db, fanIdOf(job))
          : [];
    const watched = new Set(await watchedReleases());
    for (const key of releases.filter((release) => watched.has(release))) {
      const progress = await releaseProgress(db, key);
      await broadcastToTabs(RELEASE_PAGE_PATTERNS, 'scanProgress', progress);
      if (changed) await onScanStep(key, job.kind, progress);
    }
  } catch (error) {
    console.warn('crater: could not report scan progress', error);
  }
}

const deps: SchedulerDeps = {
  db,
  fetchJson,
  fetchText,
  store: chromeScannerStore,
  loadSettings,
  now: Date.now,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: Math.random,
  owner: crypto.randomUUID(),
  waitForOwnSync: ownSyncSettled,
  onStep: async (job, event) => {
    if (event === 'finished' && job.kind === 'fan') {
      onFanScanned().catch((error: unknown) =>
        console.warn('crater: could not check crate mates', error),
      );
    }
    if (event === 'finished' && job.kind === 'followReleases') {
      notifyWhenRoundEnds().catch((error: unknown) =>
        console.warn('crater: could not notify about follows', error),
      );
    }
    await reportProgress(job, event);
  },
};

let running: Promise<void> | null = null;
let again = false;

/** Starts the loop, or makes the running one go round again once it would stop. */
export function kickScanner(): void {
  if (running) {
    again = true;
    return;
  }
  running = (async () => {
    do {
      again = false;
      await drainQueue(deps);
    } while (again);
  })()
    .catch((error: unknown) => console.error('crater: scanner stopped', error))
    .finally(() => {
      running = null;
    });
}

/** The once-a-minute wake-up that resumes the loop after a pause or a killed worker. */
export async function ensureScannerAlarm(): Promise<void> {
  // Re-creating it on every wake-up would keep pushing the first tick back.
  if (!(await chrome.alarms.get(SCANNER_ALARM))) {
    await chrome.alarms.create(SCANNER_ALARM, { periodInMinutes: 1 });
  }
}

export async function openRelease(item: ReleasePageItem): Promise<ScanProgress> {
  const { itemKey, url } = item;
  if (!isBandcampUrl(url)) throw new Error(`Not a bandcamp.com release: ${url}`);
  const now = Date.now();
  // The open page already tells us about the release, so scoring needn't wait for its job.
  await upsertReleasePageItem(db, item);
  await watchRelease(itemKey);
  const supporters = await getReleaseSupporters(db, itemKey);
  if (!supportersAreFresh(supporters, now)) {
    await enqueue(db, [{ kind: 'release', target: itemKey, url }], FOREGROUND, now);
  } else {
    // What we know has grown since the list came in, so rank its waiting fans again.
    await rankSupporters(db, itemKey);
  }
  await focusRelease(db, itemKey, supporters?.fanIds ?? [], FOREGROUND, BACKGROUND);
  kickScanner();
  return releaseProgress(db, itemKey);
}

export async function requestRelease(
  itemKey: ItemKey,
  url: string,
): Promise<{ status: QueueReleaseStatus }> {
  if (!isBandcampUrl(url)) throw new Error(`Not a bandcamp.com release: ${url}`);
  const status = await queueRelease(db, itemKey, url, Date.now());
  if (status !== 'fresh') kickScanner();
  return { status };
}

/**
 * After a sync of your own collection, queues your releases' supporters (decisions §5). A full
 * sync seeds every release you own, an incremental one only what it added.
 */
export async function seedFromSync({ me, mode, added }: SyncResult): Promise<void> {
  if (!(await loadSettings()).seedFromCollection) return;
  const only = mode === 'incremental' ? new Set(added) : undefined;
  if (only?.size === 0) return;
  if ((await seedOwnReleases(db, me.fanId, Date.now(), only)) > 0) kickScanner();
}

/** Queues latest reads of the top lately crate mates that are due (decisions §11). */
export async function rescanLatelyCrateMates(): Promise<void> {
  if ((await queueLatelyRescans(db, await loadSettings(), Date.now())) > 0) kickScanner();
}

/** Queues the weekly reads of your follows that are due (decisions §23). */
export async function queueFollowReleases(): Promise<void> {
  if ((await queueFollowReads(db, FOLLOW_RELEASES, Date.now())) > 0) kickScanner();
}

/** The follows tab opened: its reads, due or waiting, go ahead of the seed backlog. */
export async function openFollowsDigest(now: number): Promise<void> {
  await queueFollowReads(db, BACKGROUND, now);
  kickScanner();
}

export async function getScannerStatus(): Promise<ScannerStatus> {
  const [state, settings, queued, fansScanned, me] = await Promise.all([
    chromeScannerStore.load(),
    loadSettings(),
    countJobs(db),
    countScannedFans(db),
    getMe(db),
  ]);
  const ownReleases = me ? await ownReleaseProgress(db, me.fanId) : { scanned: 0, total: 0 };
  const now = Date.now();
  return {
    queued,
    fansScanned,
    ownReleases,
    requestsToday: usedToday(state.budget, now),
    dailyBudget: settings.dailyRequestBudget,
    paceFactor: state.pace.factor,
    pause: pauseFor(state, settings.dailyRequestBudget, now),
    online: navigator.onLine,
    lastError: state.lastError,
    parserError: state.parserError?.message ?? null,
  };
}

/** Stops the scanner after the request in flight, until resumed. Survives a restart. */
export async function pauseScanner(): Promise<void> {
  await chromeScannerStore.save({ paused: true });
}

export async function resumeScanner(): Promise<void> {
  await chromeScannerStore.save(resumePatch(await chromeScannerStore.load()));
  kickScanner();
}

/**
 * Wipes the database and the scanner's errors. Settings, your pause and today's budget stay:
 * they're about how politely to scan, not what was scanned.
 */
export async function clearScanData(): Promise<void> {
  await clearAllData(db);
  await clearWatchedReleases();
  await chromeScannerStore.save({ lastError: null, parserError: null });
}

/** After an import: queue-side leftovers from the old data no longer apply. Pause and budget stay. */
export async function resetScanDataAfterImport(): Promise<void> {
  await clearWatchedReleases();
  await chromeScannerStore.save({ lastError: null, parserError: null });
}

/** Runs a database import with the scanner stopped, under its own flag. */
export function whileScannerPausedForImport<T>(work: () => Promise<T>): Promise<T> {
  return withImportPause(
    {
      store: chromeScannerStore,
      now: Date.now,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      ownSyncSettled,
      resume: kickScanner,
    },
    work,
  );
}
