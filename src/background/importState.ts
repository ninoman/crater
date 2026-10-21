// How far a database import got, kept in chrome.storage.local so a worker that dies mid-import
// can be put right on its next start (importRecovery.ts).

import type { ImportNotice, ImportPhase } from '../shared/backupFile';

export interface ImportState {
  phase: ImportPhase | null;
  /** What recovery found, shown in the popup until dismissed. */
  notice: ImportNotice | null;
}

export interface ImportStateStore {
  load(): Promise<ImportState>;
  /** Merges `patch` into the stored state. */
  save(patch: Partial<ImportState>): Promise<void>;
}

const STORAGE_KEY = 'import';

export const chromeImportStateStore: ImportStateStore = {
  async load() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return {
      phase: null,
      notice: null,
      ...(stored[STORAGE_KEY] as Partial<ImportState> | undefined),
    };
  },
  async save(patch) {
    await chrome.storage.local.set({ [STORAGE_KEY]: { ...(await this.load()), ...patch } });
  },
};
