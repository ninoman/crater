import { memo } from 'react';
import type { ItemKey } from '../../bandcamp';
import type { ListedItem, ListSource } from '../../shared/itemList';
import { Card, Checkbox, PlayableCover, type SortableSlot, type TagOption } from '../../ui';
import { itemTagHandlers, type TagMutations } from '../shared/tagActions';
import { TagEditor } from '../shared/TagEditor';
import { cardMeta } from './itemCardText';

export interface ItemCardProps {
  item: ListedItem;
  source: ListSource;
  tags: readonly TagOption[];
  mutations: TagMutations;
  selected: boolean;
  previewing: boolean;
  /** Its drag handle and state in a sortable grid; null when the list can't be reordered. */
  sortable?: SortableSlot | null;
  onSelect: (itemKey: ItemKey, selected: boolean) => void;
  onPreview: (itemKey: ItemKey, open: boolean) => void;
  onError: (message: string) => void;
}

/**
 * One release as a grid card: playable cover with a select box, title, artist, date, and your
 * tags. Memoised, since a list can hold hundreds and re-renders as a whole.
 */
export const ItemCard = memo(function ItemCard({
  item,
  source,
  tags,
  mutations,
  selected,
  previewing,
  sortable = null,
  onSelect,
  onPreview,
  onError,
}: ItemCardProps) {
  const name = `${item.artist} – ${item.title}`;
  const handlers = itemTagHandlers(mutations, [item.itemKey], item.tagIds, onError);
  return (
    <Card
      ref={sortable?.ref}
      handle={sortable?.handle}
      dragState={sortable?.dragState}
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
      title={
        <a href={item.url} title={name}>
          {item.title}
        </a>
      }
      meta={cardMeta(item, source)}
      badges={<TagEditor tags={tags} assignedIds={item.tagIds} name={name} {...handlers} />}
    />
  );
});
