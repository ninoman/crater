import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastToTabs, TAB_MESSAGE_TIMEOUT_MS } from './messages';
import type { ScanProgress } from './scan';

const PATTERNS = ['*://*.bandcamp.com/*'];
const progress: ScanProgress = { releaseKey: 'a123', scanned: 0, total: 0, listed: false };

function stubTabs(
  tabs: { id?: number; frozen?: boolean }[],
  sendMessage: (id: number) => Promise<unknown>,
) {
  const query = vi.fn(async () => tabs);
  const send = vi.fn(sendMessage);
  vi.stubGlobal('chrome', { tabs: { query, sendMessage: send } });
  return { query, send };
}

describe('broadcastToTabs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks only for tabs that can run our listener, in a query Firefox accepts', async () => {
    const { query } = stubTabs([], async () => undefined);
    await broadcastToTabs(PATTERNS, 'scanProgress', progress);
    expect(query).toHaveBeenCalledWith({ url: PATTERNS, discarded: false });
  });

  it('skips frozen tabs, and tabs that say nothing about it (Firefox)', async () => {
    const { send } = stubTabs([{ id: 1, frozen: true }, { id: 2, frozen: false }, { id: 3 }], () =>
      Promise.resolve(),
    );
    await broadcastToTabs(PATTERNS, 'scanProgress', progress);
    expect(send.mock.calls.map(([id]) => id)).toEqual([2, 3]);
  });

  it('gives up on a tab that never answers', async () => {
    stubTabs([{ id: 1 }, { id: 2 }], (id) =>
      id === 1 ? new Promise(() => undefined) : Promise.resolve(),
    );
    let done = false;
    const sent = broadcastToTabs(PATTERNS, 'scanProgress', progress).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(TAB_MESSAGE_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await sent;
    expect(done).toBe(true);
  });

  it('carries on past a tab without a listener', async () => {
    stubTabs([{ id: 1 }], () => Promise.reject(new Error('Receiving end does not exist.')));
    await expect(broadcastToTabs(PATTERNS, 'scanProgress', progress)).resolves.toBeUndefined();
  });
});
