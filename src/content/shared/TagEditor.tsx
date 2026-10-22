import { Chip, type TagOption, TagPicker } from '../../ui';
import type { TagHandlers } from './tagActions';

export interface TagEditorProps extends TagHandlers {
  /** All your tags, in display order. */
  tags: readonly TagOption[];
  /** The tags on what's being tagged. */
  assignedIds: readonly number[];
  /** Names what's being tagged (an account or a release) for the remove buttons. */
  name: string;
}

/**
 * Tags as removable chips, then "+ tag". Used on following cards and wishlist rows, and on the
 * pages of accounts you follow and releases you wishlisted. Overlays portal to the nearest
 * PortalContainerProvider.
 */
export function TagEditor({ tags, assignedIds, name, onToggle, onCreate }: TagEditorProps) {
  const assigned = tags.filter((tag) => assignedIds.includes(tag.id));
  return (
    <ul className="dh-tag-editor" aria-label={`Tags on ${name}`}>
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
