// @vitest-environment jsdom
// The Crate mates tab against a fake worker: while none are found, the scan that finds them.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrateMateRow, CrateMatesResult } from '../../../shared/crateMates';
import type { ScannerStatus } from '../../../shared/scan';
import { CrateMatesTab } from './CrateMatesTab';

const empty: CrateMatesResult = {
  basis: 'ready',
  rows: [],
  latelyRows: [],
  limit: 200,
  latelyHalfLifeMonths: 12,
  computedAt: null,
  fansRead: 0,
};

function scanner(patch: Partial<ScannerStatus> = {}): ScannerStatus {
  return {
    queued: { release: 891, fan: 30 },
    fansScanned: 40,
    ownReleases: { scanned: 12, total: 903 },
    requestsToday: 217,
    dailyBudget: 10_000,
    paceFactor: 1,
    pause: null,
    online: true,
    lastError: null,
    parserError: null,
    ...patch,
  };
}

const mate: CrateMateRow = {
  fanId: 10,
  rank: 1,
  username: 'fan10',
  name: 'Ten',
  avatarUrl: null,
  url: 'https://bandcamp.com/fan10',
  overlap: 3,
  jaccard: 0.1,
  score: 0.5,
  labelCluster: false,
  followed: false,
  lately: null,
  latelyOverlap: 0,
  trend: 'quiet',
  recentBuys: [],
};

let board: CrateMatesResult;
let status: ScannerStatus;
let crateMateFetches: number;

function stubWorker() {
  crateMateFetches = 0;
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string }) => {
        if (message.type === 'getCrateMates') {
          crateMateFetches++;
          return { ok: true, data: board };
        }
        if (message.type === 'getScannerStatus') return { ok: true, data: status };
        return { ok: false, error: `not faked: ${message.type}` };
      },
      onMessage: {
        addListener: (listener: (message: unknown) => void) => workerListeners.add(listener),
        removeListener: (listener: (message: unknown) => void) => workerListeners.delete(listener),
      },
    },
  });
}

const workerListeners = new Set<(message: unknown) => void>();

let container: HTMLDivElement;
let root: Root;

async function render() {
  await act(async () => root.render(<CrateMatesTab />));
  await act(async () => {});
}

async function poll() {
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  await act(async () => {});
}

const text = () => container.textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  status = scanner();
  board = empty;
  stubWorker();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CrateMatesTab', () => {
  it('waits on the scan without a bar, and asks again as more fans are read', async () => {
    await render();
    expect(text()).toContain('Finding your crate mates');
    // A bar out of 903 would read as "nothing until all 903 are scanned".
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(crateMateFetches).toBe(1);

    await poll();
    expect(crateMateFetches).toBe(1);

    status = scanner({ fansScanned: 41 });
    await poll();
    expect(crateMateFetches).toBe(2);
  });

  it('shows the scan next to the board once there are crate mates, and keeps fetching', async () => {
    board = { ...empty, rows: [mate], fansRead: 40 };
    await render();
    expect(text()).toContain('Ten');
    expect(text()).toContain('Scanned 12 of 903 releases');
    expect(container.querySelectorAll('.dh-table__placeholder')).toHaveLength(3);

    status = scanner({ fansScanned: 41 });
    await poll();
    expect(crateMateFetches).toBe(2);
  });

  it('swaps in the new board after a recompute, without going back to loading', async () => {
    board = { ...empty, rows: [mate], fansRead: 40 };
    await render();

    board = { ...board, rows: [{ ...mate, name: 'Newcomer' }] };
    const pending = act(async () => {
      for (const listener of workerListeners) {
        listener({ event: 'crateMatesRecomputed', payload: {} });
      }
    });
    expect(text()).not.toContain('Loading your crate mates');
    await pending;
    await act(async () => {});

    expect(text()).toContain('Newcomer');
    expect(text()).not.toContain('Ten');
  });

  it('leaves placeholders off a full board', async () => {
    board = { ...empty, rows: [mate], limit: 1 };
    await render();
    expect(container.querySelector('.dh-table__placeholder')).toBeNull();
  });

  it('leaves placeholders off while the scanner is paused', async () => {
    board = { ...empty, rows: [mate] };
    status = scanner({ pause: { reason: 'manual' } });
    await render();
    expect(text()).toContain('Scanning paused at 12 of 903 releases');
    expect(container.querySelector('.dh-table__placeholder')).toBeNull();
  });

  it('holds still while the scanner is paused', async () => {
    status = scanner({ pause: { reason: 'manual' } });
    await render();
    expect(text()).toContain('Scanning is paused');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-busy')).toBe('false');
  });

  it('says there are none once nothing is left to scan', async () => {
    status = scanner({ queued: { release: 0, fan: 0 } });
    await render();
    expect(text()).toContain('No crate mates yet');
  });
});
