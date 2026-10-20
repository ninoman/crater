import type { FetchJson, FetchText } from '../../bandcamp';
import type { DigheadDb } from '../../db';
import type { Settings } from '../../shared/settings';

/** Everything one job run needs. Each run sends exactly one request. */
export interface StepContext {
  db: DigheadDb;
  fetchJson: FetchJson;
  fetchText: FetchText;
  settings: Settings;
  now: number;
}
