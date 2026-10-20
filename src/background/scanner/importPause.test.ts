import { describe, expect, it, vi } from 'vitest';
import { withImportPause } from './importPause';
import { INITIAL_SCANNER_STATE, pauseFor, type ScannerState, type ScannerStore } from './state';

function memoryStore(initial: Partial<ScannerState> = {}): ScannerStore {
  let state: ScannerState = { ...INITIAL_SCANNER_STATE, ...initial };
  return {
    load: async () => state,
    save: async (patch) => {
      state = { ...state, ...patch };
      return state;
    },
  };
}

function setup(initial: Partial<ScannerState> = {}) {
  let clock = 1_000;
  const store = memoryStore(initial);
  const resume = vi.fn();
  const deps = {
    store,
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
    ownSyncSettled: async () => {},
    resume,
  };
  return { store, resume, deps, advance: (ms: number) => (clock += ms) };
}

describe('withImportPause', () => {
  it('pauses under its own reason while the work runs, then lifts it', async () => {
    const { store, deps, resume } = setup();
    await withImportPause(deps, async () => {
      expect(pauseFor(await store.load(), 100, 1_000)).toEqual({ reason: 'import' });
    });
    expect(pauseFor(await store.load(), 100, 1_000)).toBeNull();
    expect(resume).toHaveBeenCalledOnce();
  });

  it('lifts the pause when the work fails', async () => {
    const { store, deps } = setup();
    await expect(
      withImportPause(deps, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await store.load()).importing).toBe(false);
  });

  it('leaves your own pause as it was', async () => {
    const { store, deps } = setup({ paused: true });
    await withImportPause(deps, async () => {
      expect(pauseFor(await store.load(), 100, 1_000)).toEqual({ reason: 'manual' });
    });
    expect((await store.load()).paused).toBe(true);
  });

  it('waits for the request in flight to release the lock', async () => {
    const { store, deps } = setup({ lock: { owner: 'scan', heartbeatAt: 1_000 } });
    let waited = 0;
    deps.sleep = async () => {
      waited += 1;
      if (waited === 3) await store.save({ lock: null });
    };
    let started = false;
    await withImportPause(deps, async () => {
      started = true;
      expect(waited).toBe(3);
    });
    expect(started).toBe(true);
  });
});
