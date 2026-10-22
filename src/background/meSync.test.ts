import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMe = vi.hoisted(() => vi.fn(async () => undefined));
const load = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({
  db: {},
  getMe,
  countFollowing: vi.fn(),
  countOwnership: vi.fn(),
  saveViewer: vi.fn(),
}));
vi.mock('./scanner/state', () => ({ chromeScannerStore: { load } }));
vi.mock('./recommend', () => ({ refreshCrateMates: vi.fn() }));

import { startSync } from './meSync';

beforeEach(() => {
  getMe.mockClear();
});

describe('startSync during an import', () => {
  it('is skipped while the import flag is set', async () => {
    load.mockResolvedValue({ importing: true });
    await startSync('full');
    expect(getMe).not.toHaveBeenCalled();
  });

  it('runs again once the flag is lifted', async () => {
    load.mockResolvedValue({ importing: false });
    await startSync('full');
    expect(getMe).toHaveBeenCalledOnce();
  });
});
