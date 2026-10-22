import type { TagMode } from '../../shared/following';
import { Chip, SearchField, Segmented, type TagOption } from '../../ui';
import type { TagFilter } from './tagFilter';

const MODES = [
  { value: 'all', label: 'all' },
  { value: 'any', label: 'any' },
] as const satisfies readonly { value: TagMode; label: string }[];

export interface FilterControlsProps {
  tags: readonly TagOption[];
  filter: TagFilter;
  onChange: (filter: TagFilter) => void;
  /** Names the all/any switch, e.g. "Show follows with". */
  modeLabel: string;
  /** What the search box searches, e.g. "Search names". */
  searchLabel: string;
}

/** Tag chips to filter by, all/any, and a search. Tag filters show once you have tags. */
export function FilterControls({
  tags,
  filter,
  onChange,
  modeLabel,
  searchLabel,
}: FilterControlsProps) {
  function toggleTag(id: number, pressed: boolean) {
    const tagIds = pressed ? [...filter.tagIds, id] : filter.tagIds.filter((t) => t !== id);
    onChange({ ...filter, tagIds });
  }

  return (
    <div className="dh-tag-bar__filters">
      {tags.length > 0 && (
        <>
          <ul className="dh-tag-bar__tags" aria-label="Filter by tag">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Chip
                  tag={tag}
                  pressed={filter.tagIds.includes(tag.id)}
                  onPressedChange={(pressed) => toggleTag(tag.id, pressed)}
                />
              </li>
            ))}
          </ul>
          <Segmented
            label={modeLabel}
            options={MODES}
            value={filter.mode}
            onChange={(mode) => onChange({ ...filter, mode })}
          />
        </>
      )}
      <SearchField
        label={searchLabel}
        placeholder={searchLabel}
        value={filter.query}
        onChange={(query) => onChange({ ...filter, query })}
      />
    </div>
  );
}
