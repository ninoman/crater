import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEEP_ALIVE_MS, keepAliveWhile } from './keepAlive';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Work that finishes when told to. */
function pending<T>() {
  let settle!: { resolve: (value: T) => void; reject: (error: unknown) => void };
  const work = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { work, ...settle };
}

describe('keepAliveWhile', () => {
  it('pings while the work runs, then stops', async () => {
    const ping = vi.fn(async () => undefined);
    const { work, resolve } = pending<string>();
    const kept = keepAliveWhile(work, { ping });

    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS * 3);
    expect(ping).toHaveBeenCalledTimes(3);

    resolve('opened');
    expect(await kept).toBe('opened');
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS * 3);
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it('stops pinging when the work fails, and passes the error on', async () => {
    const ping = vi.fn(async () => undefined);
    const { work, reject } = pending<void>();
    const kept = keepAliveWhile(work, { ping });
    reject(new Error('upgrade failed'));

    await expect(kept).rejects.toThrow('upgrade failed');
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS * 2);
    expect(ping).not.toHaveBeenCalled();
  });

  it('keeps going when a ping fails', async () => {
    const ping = vi.fn(async () => {
      throw new Error('no');
    });
    const { work, resolve } = pending<void>();
    const kept = keepAliveWhile(work, { ping });
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS * 2);
    resolve();
    await kept;
    expect(ping).toHaveBeenCalledTimes(2);
  });
});
