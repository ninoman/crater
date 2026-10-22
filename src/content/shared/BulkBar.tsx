import { Button, type TagOption, TagPicker } from '../../ui';
import type { TagHandlers } from './tagActions';

export interface BulkBarProps extends TagHandlers {
  /** Names the bar for screen readers, e.g. "Selected follows". */
  label: string;
  count: number;
  tags: readonly TagOption[];
  /** Tags every selected row has. */
  commonIds: readonly number[];
  onClear: () => void;
}

/** "N selected · Tag… · Clear", floating while any row is checked. */
export function BulkBar({
  label,
  count,
  tags,
  commonIds,
  onToggle,
  onCreate,
  onClear,
}: BulkBarProps) {
  return (
    <section className="dh-bulk-bar" aria-label={label}>
      <span className="dh-bulk-bar__count" aria-live="polite">
        {count} selected
      </span>
      <span className="dh-bulk-bar__dot" aria-hidden="true">
        ·
      </span>
      <TagPicker
        tags={tags}
        assignedIds={commonIds}
        onToggle={onToggle}
        onCreate={onCreate}
        triggerLabel="Tag…"
      />
      <span className="dh-bulk-bar__dot" aria-hidden="true">
        ·
      </span>
      <Button variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </section>
  );
}
