import { describe, expect, it } from 'vitest';
import {
  addMatchDeltas,
  applyMatchDelta,
  buildPackedOwnership,
  type MatchDelta,
  packFan,
  sameRows,
  sortRows,
  unpackFan,
  unpackMatch,
} from './packedOwnership';
import type { OwnershipRecord } from './schema';

const row = (
  fanId: number,
  itemKey: `${'a' | 't'}${number}`,
  matchKey: `${'a' | 't'}${number}` = itemKey,
  extra: Partial<OwnershipRecord> = {},
): OwnershipRecord => ({
  fanId,
  itemKey,
  matchKey,
  source: 'collection',
  addedAt: 1_000,
  ...extra,
});

describe('packFan', () => {
  it('round-trips rows, wishlist and unknown dates included', () => {
    const rows = sortRows([
      row(7, 't40', 'a3', { addedAt: null }),
      row(7, 'a3'),
      row(7, 'a10', 'a10', { source: 'wishlist', addedAt: 1_700_000_000_123 }),
      row(7, 't4294967295'),
    ]);
    const record = packFan(7, rows);
    expect(record?.wishlistIds).toEqual(Float64Array.from([10]));
    expect(unpackFan(record as NonNullable<typeof record>)).toEqual(rows);
  });

  it('keeps rows in itemKey order, as IndexedDB returned them', () => {
    const rows = sortRows([row(1, 'a9'), row(1, 't1'), row(1, 'a10')]);
    expect(rows.map((r) => r.itemKey)).toEqual(['a10', 'a9', 't1']);
  });

  it('leaves out the wishlist list when there is none, and returns null with no rows', () => {
    expect(packFan(1, [row(1, 'a1')])).not.toHaveProperty('wishlistIds');
    expect(packFan(1, [])).toBeNull();
  });
});

describe('match deltas', () => {
  it('lists collection rows only, by matchKey', () => {
    const deltas = new Map<number, MatchDelta>();
    addMatchDeltas(5, [], [row(5, 't2', 'a1'), row(5, 'a9', 'a9', { source: 'wishlist' })], deltas);
    expect([...deltas]).toEqual([[1, { remove: [], add: [{ fanId: 5, itemKey: 't2' }] }]]);
  });

  it('moves an entry when its matchKey changes, and ignores unchanged rows', () => {
    const deltas = new Map<number, MatchDelta>();
    addMatchDeltas(5, [row(5, 't2'), row(5, 'a8')], [row(5, 't2', 'a1'), row(5, 'a8')], deltas);
    expect(deltas.get(-2)).toEqual({ remove: [{ fanId: 5, itemKey: 't2' }], add: [] });
    expect(deltas.get(1)).toEqual({ remove: [], add: [{ fanId: 5, itemKey: 't2' }] });
    expect(deltas.has(8)).toBe(false);
  });

  it('applies in [fanId+itemKey] order and drops an emptied list', () => {
    const first = applyMatchDelta(1, undefined, {
      remove: [],
      add: [
        { fanId: 9, itemKey: 'a1' },
        { fanId: 2, itemKey: 't5' },
        { fanId: 2, itemKey: 'a1' },
      ],
    });
    expect(unpackMatch(first as NonNullable<typeof first>)).toEqual([
      { fanId: 2, itemKey: 'a1' },
      { fanId: 2, itemKey: 't5' },
      { fanId: 9, itemKey: 'a1' },
    ]);
    const again = applyMatchDelta(1, first ?? undefined, {
      remove: [{ fanId: 2, itemKey: 'a1' }],
      add: [{ fanId: 9, itemKey: 'a1' }],
    });
    expect(unpackMatch(again as NonNullable<typeof again>)).toEqual([
      { fanId: 2, itemKey: 't5' },
      { fanId: 9, itemKey: 'a1' },
    ]);
    const gone = applyMatchDelta(1, again ?? undefined, {
      remove: [
        { fanId: 2, itemKey: 't5' },
        { fanId: 9, itemKey: 'a1' },
      ],
      add: [],
    });
    expect(gone).toBeNull();
  });
});

describe('buildPackedOwnership', () => {
  it('packs every fan and lists each matchKey owners', () => {
    const { fanOwnership, matchOwnership } = buildPackedOwnership([
      row(2, 'a1'),
      row(1, 't3', 'a1'),
      row(1, 'a1'),
    ]);
    expect(fanOwnership.map(unpackFan)).toEqual([
      [row(2, 'a1')],
      [row(1, 'a1'), row(1, 't3', 'a1')],
    ]);
    expect(matchOwnership.map(unpackMatch)).toEqual([
      [
        { fanId: 1, itemKey: 'a1' },
        { fanId: 1, itemKey: 't3' },
        { fanId: 2, itemKey: 'a1' },
      ],
    ]);
  });
});

describe('sameRows', () => {
  it('compares every field', () => {
    expect(sameRows([row(1, 'a1')], [row(1, 'a1')])).toBe(true);
    expect(sameRows([row(1, 'a1')], [row(1, 'a1', 'a1', { addedAt: 2 })])).toBe(false);
    expect(sameRows([row(1, 'a1')], [])).toBe(false);
  });
});
