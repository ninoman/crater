import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastToTabs, TAB_MESSAGE_TIMEOUT_MS } from './messages';
import type { ScanProgress } from './scan';

const PATTERNS = ['*://*.bandcamp.com/*'];
const progress: ScanProgress = { releaseKey: 'a123', scanned: 0, total: 0, listed: false };

function stubTabs(tabs: { id?: number }[], sendMessage: (id: number) => Promise<unknown>) {
  const query = vi.fn(async () => tabs);
  vi.stubGlobal('chrome', { tabs: { query, sendMessage: vi.fn(sendMessage) } });
  return query;
}

describe('broadcastToTabs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks only for tabs that can run our listener', async () => {
    const query = stubTabs([], async () => undefined);
    await broadcastToTabs(PATTERNS, 'scanProgress', progress);
    expect(query).toHaveBeenCalledWith({ url: PATTERNS, frozen: false, discarded: false });
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
