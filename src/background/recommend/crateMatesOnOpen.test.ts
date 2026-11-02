import { describe, expect, it, vi } from 'vitest';
import type { CrateMateRow, CrateMatesResult } from '../../shared/crateMates';
import { crateMatesOnOpen } from './crateMatesOnOpen';

function board(rows: number): CrateMatesResult {
  return {
    basis: 'ready',
    rows: Array.from({ length: rows }, () => ({}) as CrateMateRow),
    latelyRows: [],
    limit: 200,
    latelyHalfLifeMonths: 6,
    computedAt: null,
    fansRead: 0,
  };
}

describe('crateMatesOnOpen', () => {
  it('leaves a current board alone', async () => {
    const refresh = vi.fn(async () => {});
    const stored = board(1);

    const result = await crateMatesOnOpen({
      stale: async () => false,
      read: async () => stored,
      refresh,
    });

    expect(result).toBe(stored);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('answers with a stale board without waiting for the recompute', async () => {
    const stored = board(1);
    const refresh = vi.fn(() => new Promise<void>(() => {}));

    const result = await crateMatesOnOpen({
      stale: async () => true,
      read: async () => stored,
      refresh,
    });

    expect(result).toBe(stored);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('waits for the recompute when nothing is stored', async () => {
    let stored = board(0);
    const refresh = vi.fn(async () => {
      stored = board(2);
    });

    const result = await crateMatesOnOpen({
      stale: async () => true,
      read: async () => stored,
      refresh,
    });

    expect(result.rows).toHaveLength(2);
  });
});
