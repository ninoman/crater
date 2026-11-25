import { afterEach, describe, expect, it, vi } from 'vitest';
import { chromeScannerStore } from './state';

afterEach(() => vi.unstubAllGlobals());

describe('chromeScannerStore.save', () => {
  it('keeps both fields when two saves overlap', async () => {
    let stored: Record<string, unknown> = {};
    const tick = () => new Promise((r) => setTimeout(r, 0));
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => {
            const snapshot = { [key]: stored[key] };
            await tick();
            return snapshot;
          },
          set: async (items: Record<string, unknown>) => {
            await tick();
            stored = { ...stored, ...items };
          },
        },
      },
    });

    await Promise.all([
      chromeScannerStore.save({ paused: true }),
      chromeScannerStore.save({ importing: true }),
    ]);

    expect(await chromeScannerStore.load()).toMatchObject({ paused: true, importing: true });
  });

  it('keeps saving after one fails', async () => {
    let fail = true;
    let stored: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: stored[key] }),
          set: async (items: Record<string, unknown>) => {
            if (fail) throw new Error('quota');
            stored = items;
          },
        },
      },
    });

    await expect(chromeScannerStore.save({ paused: true })).rejects.toThrow('quota');
    fail = false;
    expect(await chromeScannerStore.save({ importing: true })).toMatchObject({ importing: true });
  });
});
