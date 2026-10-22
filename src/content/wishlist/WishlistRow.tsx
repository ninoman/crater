import { memo } from 'react';
import type { ItemKey } from '../../bandcamp';
import type { WishlistItem } from '../../shared/wishlist';
import {
  Checkbox,
  ExternalIcon,
  LinkButton,
  PlayableCover,
  Row,
  type TagOption,
  Tooltip,
} from '../../ui';
import { ReleasePreview } from '../shared/ReleasePreview';
import { itemTagHandlers, type TagMutations } from '../shared/tagActions';
import { TagEditor } from '../shared/TagEditor';
import { addedText } from './wishlistFilter';

export interface WishlistRowProps {
  item: WishlistItem;
  tags: readonly TagOption[];
  mutations: TagMutations;
  selected: boolean;
  previewing: boolean;
  onSelect: (itemKey: ItemKey, selected: boolean) => void;
  onPreview: (itemKey: ItemKey, open: boolean) => void;
  onError: (message: string) => void;
}

/**
 * One wishlisted release: select box, playable cover, title and artist, your tags and
 * "+ tag". Memoised, since a wishlist can hold hundreds and re-renders as a whole.
 */
export const WishlistRow = memo(function WishlistRow({
  item,
  tags,
  mutations,
  selected,
  previewing,
  onSelect,
  onPreview,
  onError,
}: WishlistRowProps) {
  const name = `${item.artist} – ${item.title}`;
  const added = addedText(item.addedAt);
  const handlers = itemTagHandlers(mutations, [item.itemKey], item.tagIds, onError);
  return (
    <Row
      media={
        <div className="dh-wishlist-row__media">
          <Checkbox
            label={`Select ${name}`}
            hideLabel
            checked={selected}
            onChange={(checked) => onSelect(item.itemKey, checked)}
          />
          <PlayableCover
            src={item.coverUrl}
            playing={previewing}
            label={name}
            onToggle={() => onPreview(item.itemKey, !previewing)}
          />
        </div>
      }
      title={
        <a href={item.url} title={name}>
          {item.title}
        </a>
      }
      meta={added ? [item.artist, added] : [item.artist]}
      badges={
        <span className="dh-wishlist-row__tags">
          <TagEditor tags={tags} assignedIds={item.tagIds} name={name} {...handlers} />
        </span>
      }
      actions={
        <Tooltip content="Open in a new tab">
          <LinkButton
            variant="ghost"
            icon
            href={item.url}
            target="_blank"
            rel="noopener"
            aria-label={`Open ${name} in a new tab`}
          >
            <ExternalIcon />
          </LinkButton>
        </Tooltip>
      }
    >
      {previewing && <ReleasePreview url={item.url} name={name} />}
    </Row>
  );
});
