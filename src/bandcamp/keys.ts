import type { ItemKey, TralbumType } from './types';

export function itemKey(type: TralbumType, tralbumId: number): ItemKey {
  return `${type}${tralbumId}`;
}

export function parseItemKey(key: ItemKey): { type: TralbumType; tralbumId: number } {
  return { type: key[0] as TralbumType, tralbumId: Number(key.slice(1)) };
}

/** Tracks that belong to an album match on the album (decisions §3.8). */
export function matchKey(item: { itemKey: ItemKey; albumKey: ItemKey | null }): ItemKey {
  return item.albumKey ?? item.itemKey;
}

/**
 * A key as one number, so lists of them store and count fast (decisions §6): albums are
 * positive, tracks negative. Tralbum ids are 32-bit, so every key round-trips exactly.
 */
export function keyToNumber(key: ItemKey): number {
  const id = Number(key.slice(1));
  return key[0] === 'a' ? id : -id;
}

export function keyFromNumber(value: number): ItemKey {
  return value < 0 ? `t${-value}` : `a${value}`;
}

/** Supporter tokens look like `1:<purchase unix ts>:<fan_id>:<is_review>:1:0`. */
export function purchasedAtFromToken(token: string): number | null {
  const seconds = Number(token.split(':')[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/** Bandcamp dates look like "19 Oct 2026 17:18:45 GMT". */
export function parseBandcampDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}
