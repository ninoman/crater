// A tag filter and selection over a list of tagged rows (decisions §8, §13), as pure functions.
// Lists hide rows that don't pass rather than re-rendering, so these answer with keys.

import { foldText } from '../../shared/fold';
import { matchesTags, type TagMode } from '../../shared/following';

export interface TagFilter {
  tagIds: readonly number[];
  mode: TagMode;
  /** Text search; blank matches everything. */
  query: string;
}

export const NO_FILTER: TagFilter = { tagIds: [], mode: 'all', query: '' };

/** How a list reads its rows: a row's key, its tags and the text the search looks in. */
export interface TaggedRows<T, K> {
  keyOf: (row: T) => K;
  tagIdsOf: (row: T) => readonly number[];
  textOf: (row: T) => string;
}

/** Whether the filter can hide anything. The mode alone can't. */
export function isFiltering({ tagIds, query }: TagFilter): boolean {
  return tagIds.length > 0 || query.trim() !== '';
}

/** Keys of the rows passing the tag filter and the search. */
export function visibleKeys<T, K>(
  rows: readonly T[],
  filter: TagFilter,
  read: TaggedRows<T, K>,
): Set<K> {
  const needle = foldText(filter.query.trim());
  return new Set(
    rows
      .filter(
        (row) =>
          matchesTags(read.tagIdsOf(row), filter.tagIds, filter.mode) &&
          foldText(read.textOf(row)).includes(needle),
      )
      .map(read.keyOf),
  );
}

/** The selected tags that still exist, so a deleted tag stops filtering. */
export function liveTagIds(selected: readonly number[], tags: readonly { id: number }[]): number[] {
  return selected.filter((id) => tags.some((tag) => tag.id === id));
}

/** `keys` with `key` added or taken out. */
export function toggled<K>(keys: ReadonlySet<K>, key: K, on: boolean): Set<K> {
  const next = new Set(keys);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}

/** What bulk actions act on: the selected rows still shown. Hidden ones stay selected. */
export function actionable<K>(selected: ReadonlySet<K>, visible: ReadonlySet<K>): K[] {
  return [...selected].filter((key) => visible.has(key));
}

/** Tags every one of `keys` has, so the bulk picker can show them as assigned. */
export function commonTagIds<T, K>(
  rows: readonly T[],
  keys: readonly K[],
  read: Pick<TaggedRows<T, K>, 'keyOf' | 'tagIdsOf'>,
): number[] {
  const picked = rows.filter((row) => keys.includes(read.keyOf(row)));
  const [first, ...rest] = picked;
  if (!first) return [];
  return read
    .tagIdsOf(first)
    .filter((tagId) => rest.every((row) => read.tagIdsOf(row).includes(tagId)));
}
