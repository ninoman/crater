/** A tag as the UI shows it. The data layer owns the full record. */
export interface TagOption {
  id: number;
  name: string;
}

const TAG_COLOR_COUNT = 8;

/** The CSS colour for a tag. Keyed on id, not name, so a rename keeps the colour. */
export function tagColor(id: number): string {
  const index = (((Math.trunc(id) - 1) % TAG_COLOR_COUNT) + TAG_COLOR_COUNT) % TAG_COLOR_COUNT;
  return `var(--dh-tag-${index + 1})`;
}
