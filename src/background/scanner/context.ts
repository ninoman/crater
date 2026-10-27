import type { FetchJson, FetchText, ParserError } from '../../bandcamp';
import type { CraterDb, JobProgress } from '../../db';
import type { Settings } from '../../shared/settings';
import type { ParserKind } from './state';

/** Everything one job run needs. Each run sends exactly one request. */
export interface StepContext {
  db: CraterDb;
  fetchJson: FetchJson;
  fetchText: FetchText;
  settings: Settings;
  now: number;
}

/**
 * What a run changed for watched releases. `continued`: nothing to show yet. `read`: a fan's
 * collection is now usable for Also bought, though their scan goes on. `finished`: the job has
 * left the queue.
 */
export type StepEvent = 'continued' | 'read' | 'finished';

export interface StepResult {
  /** Where the job carries on, or null once it's done. */
  next: JobProgress | null;
  event: StepEvent;
  /** The parser this run used successfully, so its earlier error can be cleared. */
  parsed: ParserKind | null;
  /** A page that's only a hint couldn't be read; the job carried on without it. */
  skippedParserError?: ParserError;
}
