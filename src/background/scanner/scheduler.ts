// The scan loop: one request at a time, paced, within the daily budget, and paused as a whole
// when Bandcamp pushes back. Every run is one request, so a killed worker loses at most one.

import { ParserError, type FetchJson, type FetchText } from '../../bandcamp';
import {
  completeJob,
  failJob,
  nextJob,
  saveProgress,
  type CraterDb,
  type QueueJob,
} from '../../db';
import type { Settings } from '../../shared/settings';
import { jobRetryAt, nextBackoff } from './backoff';
import { spend } from './budget';
import type { StepContext, StepEvent, StepResult } from './context';
import { abandonFan, runFanStep } from './fanJob';
import { runFollowReleasesStep } from './followReleasesJob';
import { canTakeLock } from './lock';
import { classifyFailure } from './outcome';
import { paceAfterRequest, paceAfterThrottle, paceWaitMs } from './pace';
import { runReleaseStep } from './releaseJob';
import { pauseFor, type ScannerState, type ScannerStore } from './state';

export interface SchedulerDeps {
  db: CraterDb;
  fetchJson: FetchJson;
  fetchText: FetchText;
  store: ScannerStore;
  loadSettings: () => Promise<Settings>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  /** This worker instance, as named in the lock. */
  owner: string;
  /** Your own collection sync uses the network too; waiting keeps one request in flight. */
  waitForOwnSync: () => Promise<void>;
  /** After each run that changed something. */
  onStep: (job: QueueJob, event: StepEvent) => Promise<void>;
}

/** idle: queue empty. paused: back-off or budget. locked: another loop holds the lock. */
export type StopReason = 'idle' | 'paused' | 'locked';

/** Runs jobs until the queue is empty or the scanner has to pause. */
export async function drainQueue(deps: SchedulerDeps): Promise<StopReason> {
  const { db, store, owner } = deps;
  let state = await store.load();
  if (!canTakeLock(state.lock, owner, deps.now())) return 'locked';
  state = await store.save({ lock: { owner, heartbeatAt: deps.now() } });

  try {
    for (;;) {
      await deps.waitForOwnSync();
      const settings = await deps.loadSettings();
      if (pauseFor(state, settings.dailyRequestBudget, deps.now())) return 'paused';

      if (!(await nextJob(db, deps.now()))) return 'idle';
      const wait = paceWaitMs(
        state.lastRequestAt,
        settings,
        state.pace.factor,
        deps.random,
        deps.now(),
      );
      if (wait > 0) {
        await deps.sleep(wait);
        // An import may have paused the scanner while it waited.
        state = await store.load();
        if (pauseFor(state, settings.dailyRequestBudget, deps.now())) return 'paused';
      }
      // Picked again after the pause, so a release page opened meanwhile goes first.
      const job = await nextJob(db, deps.now());
      if (!job) return 'idle';

      const now = deps.now();
      // Counted before sending, so a request cut off by a killed worker still counts.
      state = await store.save({
        lock: { owner, heartbeatAt: now },
        budget: spend(state.budget, now),
        lastRequestAt: now,
        pace: paceAfterRequest(state.pace),
      });
      const ctx = { db, fetchJson: deps.fetchJson, fetchText: deps.fetchText, settings, now };
      state = await runJob(deps, job, ctx, state);
    }
  } finally {
    await store.save({ lock: null });
  }
}

async function runStep(job: QueueJob, ctx: StepContext): Promise<StepResult> {
  if (job.kind === 'fan') return runFanStep(ctx, job);
  if (job.kind === 'followReleases') return runFollowReleasesStep(ctx, job);
  const cursor = await runReleaseStep(ctx, job);
  return cursor
    ? { next: { cursor }, event: 'continued', parsed: 'release' }
    : { next: null, event: 'finished', parsed: 'release' };
}

async function runJob(
  deps: SchedulerDeps,
  job: QueueJob,
  ctx: StepContext,
  state: ScannerState,
): Promise<ScannerState> {
  let result: StepResult;
  try {
    result = await runStep(job, ctx);
  } catch (error) {
    return handleFailure(deps, job, ctx, state, error);
  }

  if (result.next) await saveProgress(ctx.db, job, result.next);
  else await completeJob(ctx.db, job);
  await deps.onStep(job, result.event);

  const skipped = result.skippedParserError;
  if (skipped) {
    const message = `${job.kind} ${job.target}: ${skipped.message}`;
    console.warn(`crater: ${message}. Carried on without it.`);
    return deps.store.save({
      backoff: null,
      offline: false,
      parserError: { kind: 'profile', message },
    });
  }
  const parserFixed = state.parserError !== null && state.parserError.kind === result.parsed;
  return state.backoff || state.offline || state.lastError || parserFixed
    ? deps.store.save({
        backoff: null,
        offline: false,
        lastError: null,
        ...(parserFixed ? { parserError: null } : {}),
      })
    : state;
}

async function handleFailure(
  deps: SchedulerDeps,
  job: QueueJob,
  ctx: StepContext,
  state: ScannerState,
  error: unknown,
): Promise<ScannerState> {
  const failure = classifyFailure(error, ctx.now);
  const message = `${job.kind} ${job.target}: ${error instanceof Error ? error.message : String(error)}`;

  if (failure.kind === 'throttled') {
    const backoff = nextBackoff(state.backoff, failure.retryAfterMs, ctx.now);
    console.warn(`crater: ${message}. Scanner paused until ${new Date(backoff.until).toString()}`);
    // Being offline says nothing about how fast Bandcamp lets us go.
    const pace = failure.offline ? state.pace : paceAfterThrottle(state.pace);
    return deps.store.save({ backoff, offline: failure.offline, lastError: message, pace });
  }

  const retryAt = failure.kind === 'transient' ? jobRetryAt(job.attempts, ctx.now) : null;
  console.warn(`crater: ${message}. ${retryAt === null ? 'Dropped' : 'Will retry'}.`, error);
  await failJob(ctx.db, job, retryAt);
  if (retryAt === null) {
    if (job.kind === 'fan') await abandonFan(ctx, job);
    await deps.onStep(job, 'finished');
  }
  return deps.store.save({
    lastError: message,
    ...(error instanceof ParserError ? { parserError: { kind: job.kind, message } } : {}),
  });
}
