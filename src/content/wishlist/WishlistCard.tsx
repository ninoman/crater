import { memo } from 'react';
import type { ItemKey } from '../../bandcamp';
import type { WishlistItem } from '../../shared/wishlist';
import {
  Card,
  Checkbox,
  ExternalIcon,
  LinkButton,
  PlayableCover,
  type TagOption,
  Tooltip,
} from '../../ui';
import { ReleasePreview } from '../shared/ReleasePreview';
import { itemTagHandlers, type TagMutations } from '../shared/tagActions';
import { TagEditor } from '../shared/TagEditor';
import { addedText } from './wishlistFilter';

export interface WishlistCardProps {
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
 * One wishlisted release as a grid card: playable cover with a select box, title and artist,
 * your tags and "+ tag". Memoised, since a wishlist can hold hundreds and re-renders as a whole.
 */
export const WishlistCard = memo(function WishlistCard({
  item,
  tags,
  mutations,
  selected,
  previewing,
  onSelect,
  onPreview,
  onError,
}: WishlistCardProps) {
  const name = `${item.artist} – ${item.title}`;
  const added = addedText(item.addedAt);
  const handlers = itemTagHandlers(mutations, [item.itemKey], item.tagIds, onError);
  return (
    <Card
      media={
        <PlayableCover
          src={item.coverUrl}
          size="fill"
          playing={previewing}
          label={name}
          onToggle={() => onPreview(item.itemKey, !previewing)}
        />
      }
      select={
        <Checkbox
          label={`Select ${name}`}
          hideLabel
          checked={selected}
          onChange={(checked) => onSelect(item.itemKey, checked)}
        />
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
      title={
        <a href={item.url} title={name}>
          {item.title}
        </a>
      }
      meta={added ? [item.artist, added] : [item.artist]}
      badges={<TagEditor tags={tags} assignedIds={item.tagIds} name={name} {...handlers} />}
    >
      {previewing && <ReleasePreview url={item.url} name={name} />}
    </Card>
  );
});
