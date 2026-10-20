import { Chip, type TagOption, TagPicker } from '../../ui';
import type { FollowTagHandlers } from './followTagActions';

export interface FollowTagEditorProps extends FollowTagHandlers {
  /** All your tags, in display order. */
  tags: readonly TagOption[];
  /** The account's tags. */
  assignedIds: readonly number[];
  /** Names the account for the remove buttons and the picker. */
  accountName: string;
}

/**
 * An account's tags as removable chips, then "+ tag". Used on following cards and, for accounts
 * you follow, on their own pages. Overlays portal to the nearest PortalContainerProvider.
 */
export function FollowTagEditor({
  tags,
  assignedIds,
  accountName,
  onToggle,
  onCreate,
}: FollowTagEditorProps) {
  const assigned = tags.filter((tag) => assignedIds.includes(tag.id));
  return (
    <ul className="dh-follow-tags" aria-label={`Tags on ${accountName}`}>
      {assigned.map((tag) => (
        <li key={tag.id}>
          <Chip tag={tag} onRemove={() => onToggle(tag.id)} />
        </li>
      ))}
      <li>
        <TagPicker tags={tags} assignedIds={assignedIds} onToggle={onToggle} onCreate={onCreate} />
      </li>
    </ul>
  );
}
