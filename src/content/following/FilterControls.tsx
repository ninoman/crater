import type { TagMode } from '../../shared/following';
import { Chip, SearchField, Segmented, type TagOption } from '../../ui';
import type { FollowingFilter } from './followingFilter';

const MODES = [
  { value: 'all', label: 'all' },
  { value: 'any', label: 'any' },
] as const satisfies readonly { value: TagMode; label: string }[];

export interface FilterControlsProps {
  tags: readonly TagOption[];
  filter: FollowingFilter;
  onChange: (filter: FollowingFilter) => void;
}

/** Tag chips to filter by, all/any, and a name search. Tag filters show once you have tags. */
export function FilterControls({ tags, filter, onChange }: FilterControlsProps) {
  function toggleTag(id: number, pressed: boolean) {
    const tagIds = pressed ? [...filter.tagIds, id] : filter.tagIds.filter((t) => t !== id);
    onChange({ ...filter, tagIds });
  }

  return (
    <div className="dh-following-bar__filters">
      {tags.length > 0 && (
        <>
          <ul className="dh-following-bar__tags" aria-label="Filter by tag">
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
            label="Show follows with"
            options={MODES}
            value={filter.mode}
            onChange={(mode) => onChange({ ...filter, mode })}
          />
        </>
      )}
      <SearchField
        label="Search names"
        placeholder="Search names"
        value={filter.query}
        onChange={(query) => onChange({ ...filter, query })}
      />
    </div>
  );
}
