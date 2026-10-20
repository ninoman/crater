import type { TagOption } from './tag';

export type TagPickerOption = { kind: 'tag'; tag: TagOption } | { kind: 'create'; name: string };

// Same normalisation as the tags table's nameKey, so "Create" never offers a duplicate.
function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** The picker's rows for a query: matching tags in the given order, then "Create" for a new name. */
export function tagPickerOptions(tags: readonly TagOption[], query: string): TagPickerOption[] {
  const key = nameKey(query);
  const options: TagPickerOption[] = tags
    .filter((tag) => nameKey(tag.name).includes(key))
    .map((tag) => ({ kind: 'tag', tag }));
  if (key !== '' && !tags.some((tag) => nameKey(tag.name) === key)) {
    options.push({ kind: 'create', name: query.trim() });
  }
  return options;
}
