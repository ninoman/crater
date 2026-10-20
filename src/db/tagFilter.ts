// The following tab's tag filter, as a pure check (decisions §8).

/** `all` keeps rows with every selected tag (the default), `any` rows with at least one. */
export type TagMode = 'all' | 'any';

/** Whether a row's tags pass the filter. Selecting no tags keeps everything. */
export function matchesTags(
  assigned: readonly number[],
  selected: readonly number[],
  mode: TagMode,
): boolean {
  if (selected.length === 0) return true;
  return mode === 'all'
    ? selected.every((tagId) => assigned.includes(tagId))
    : selected.some((tagId) => assigned.includes(tagId));
}
