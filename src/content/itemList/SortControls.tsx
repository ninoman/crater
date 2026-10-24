import type { ListSource } from '../../shared/itemList';
import {
  defaultDirection,
  SORT_KEYS,
  type SortKey,
  type SortSpec,
  sortLabel,
} from '../../shared/itemSort';
import { Button, Select } from '../../ui';

export interface SortControlsProps {
  source: ListSource;
  sort: SortSpec;
  onChange: (sort: SortSpec) => void;
}

/** "Sort by" menu and a button that flips the direction. A new key starts in its natural direction. */
export function SortControls({ source, sort, onChange }: SortControlsProps) {
  const options = SORT_KEYS[source].map((key) => ({ value: key, label: sortLabel(key, source) }));
  const ascending = sort.direction === 'asc';
  return (
    <span className="dh-sort">
      <Select<SortKey>
        label="Sort by"
        options={options}
        value={sort.key}
        onChange={(key) => onChange({ key, direction: defaultDirection(key) })}
      />
      <Button
        variant="ghost"
        icon
        aria-label={
          ascending
            ? 'Sorted ascending; switch to descending'
            : 'Sorted descending; switch to ascending'
        }
        onClick={() => onChange({ ...sort, direction: ascending ? 'desc' : 'asc' })}
      >
        {ascending ? '↑' : '↓'}
      </Button>
    </span>
  );
}
