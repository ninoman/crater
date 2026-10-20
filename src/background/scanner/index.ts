// Wires the scan loop to Chrome: storage, alarms, tabs and the message handlers.

import { isBandcampUrl, RELEASE_PAGE_PATTERNS, type ItemKey } from '../../bandcamp';
import {
  countJobs,
  db,
  enqueue,
  focusRelease,
  getReleaseSupporters,
  releasesSupportedBy,
  type QueueJob,
} from '../../db';
import { broadcastToTabs } from '../../shared/messages';
import type { ScannerStatus, ScanProgress } from '../../shared/scan';
import { loadSettings } from '../../shared/settings';
import { fetchJson, fetchText } from '../http';
import { ownSyncSettled } from '../meSync';
import { usedToday } from './budget';
import { fanIdOf } from './fanJob';
import { supportersAreFresh } from './freshness';
import { releaseProgress } from './progress';
import { drainQueue, type SchedulerDeps } from './scheduler';
import { chromeScannerStore, pauseFor } from './state';
import { watchedReleases, watchRelease } from './watched';

/** The release open in the most recent tab, and its supporters. */
const FOREGROUND = 1;
/** Everything else, including releases opened earlier. */
const BACKGROUND = 2;

export const SCANNER_ALARM = 'scanner';

async function reportProgress(job: QueueJob, finished: boolean): Promise<void> {
  try {
    const releases: ItemKey[] =
      job.kind === 'release'
        ? [job.target]
        : finished
          ? await releasesSupportedBy(db, fanIdOf(job))
          : [];
    const watched = new Set(await watchedReleases());
    for (const key of releases.filter((release) => watched.has(release))) {
      await broadcastToTabs(RELEASE_PAGE_PATTERNS, 'scanProgress', await releaseProgress(db, key));
    }
  } catch (error) {
    console.warn('dighead: could not report scan progress', error);
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
  onStep: reportProgress,
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
    .catch((error: unknown) => console.error('dighead: scanner stopped', error))
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

export async function openRelease(itemKey: ItemKey, url: string): Promise<ScanProgress> {
  if (!isBandcampUrl(url)) throw new Error(`Not a bandcamp.com release: ${url}`);
  const now = Date.now();
  await watchRelease(itemKey);
  const supporters = await getReleaseSupporters(db, itemKey);
  if (!supportersAreFresh(supporters, now)) {
    await enqueue(db, [{ kind: 'release', target: itemKey, url }], FOREGROUND, now);
  }
  await focusRelease(db, itemKey, supporters?.fanIds ?? [], FOREGROUND, BACKGROUND);
  kickScanner();
  return releaseProgress(db, itemKey);
}

export async function getScannerStatus(): Promise<ScannerStatus> {
  const [state, settings, queued] = await Promise.all([
    chromeScannerStore.load(),
    loadSettings(),
    countJobs(db),
  ]);
  const now = Date.now();
  return {
    queued,
    requestsToday: usedToday(state.budget, now),
    dailyBudget: settings.dailyRequestBudget,
    pause: pauseFor(state, settings.dailyRequestBudget, now),
    lastError: state.lastError,
  };
}
