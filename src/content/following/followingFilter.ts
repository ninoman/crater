// The following tab's filter and selection, as pure functions over the rows (decisions §8).
// The tab hides cards that don't pass rather than re-rendering, so these answer with ids.

import { foldText } from '../../shared/fold';
import { type Following, matchesTags, type TagMode } from '../../shared/following';

export interface FollowingFilter {
  tagIds: readonly number[];
  mode: TagMode;
  /** Name search; blank matches everyone. */
  query: string;
}

export const NO_FILTER: FollowingFilter = { tagIds: [], mode: 'all', query: '' };

/** Whether the filter can hide anything. The mode alone can't. */
export function isFiltering({ tagIds, query }: FollowingFilter): boolean {
  return tagIds.length > 0 || query.trim() !== '';
}

/** Ids of the rows passing the tag filter and the name search. */
export function visibleIds(rows: readonly Following[], filter: FollowingFilter): Set<number> {
  const needle = foldText(filter.query.trim());
  return new Set(
    rows
      .filter(
        (row) =>
          matchesTags(row.tagIds, filter.tagIds, filter.mode) &&
          foldText(row.name).includes(needle),
      )
      .map((row) => row.id),
  );
}

/** The selected tags that still exist, so a deleted tag stops filtering. */
export function liveTagIds(selected: readonly number[], tags: readonly { id: number }[]): number[] {
  return selected.filter((id) => tags.some((tag) => tag.id === id));
}

/** `ids` with `id` added or taken out. */
export function toggled(ids: ReadonlySet<number>, id: number, on: boolean): Set<number> {
  const next = new Set(ids);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/** What bulk actions act on: the selected rows still shown. Hidden ones stay selected. */
export function actionable(selected: ReadonlySet<number>, visible: ReadonlySet<number>): number[] {
  return [...selected].filter((id) => visible.has(id));
}

/** Tags every one of `ids` has, so the bulk picker can show them as assigned. */
export function commonTagIds(rows: readonly Following[], ids: readonly number[]): number[] {
  const picked = rows.filter((row) => ids.includes(row.id));
  const [first, ...rest] = picked;
  if (!first) return [];
  return first.tagIds.filter((tagId) => rest.every((row) => row.tagIds.includes(tagId)));
}
