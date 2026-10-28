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
      onMessage: { addListener: () => {}, removeListener: () => {} },
    },
  });
}

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
  it('shows the scan in progress, and asks again as more fans are read', async () => {
    await render();
    expect(text()).toContain('Finding your crate mates');
    expect(text()).toContain('12 of 903 releases scanned · 40 fans read');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '12',
    );
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

    status = scanner({ fansScanned: 41 });
    await poll();
    expect(crateMateFetches).toBe(2);
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
