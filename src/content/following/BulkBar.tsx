import { Button, type TagOption, TagPicker } from '../../ui';
import type { FollowTagHandlers } from '../shared/followTagActions';

export interface BulkBarProps extends FollowTagHandlers {
  count: number;
  tags: readonly TagOption[];
  /** Tags every selected follow has. */
  commonIds: readonly number[];
  onClear: () => void;
}

/** "N selected · Tag… · Clear", floating while any card is checked. */
export function BulkBar({ count, tags, commonIds, onToggle, onCreate, onClear }: BulkBarProps) {
  return (
    <section className="dh-following-bulk" aria-label="Selected follows">
      <span className="dh-following-bulk__count" aria-live="polite">
        {count} selected
      </span>
      <span className="dh-following-bulk__dot" aria-hidden="true">
        ·
      </span>
      <TagPicker
        tags={tags}
        assignedIds={commonIds}
        onToggle={onToggle}
        onCreate={onCreate}
        triggerLabel="Tag…"
      />
      <span className="dh-following-bulk__dot" aria-hidden="true">
        ·
      </span>
      <Button variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </section>
  );
}
