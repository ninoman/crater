import { memo } from 'react';
import type { ItemKey } from '../../bandcamp';
import type { ListedItem, ListSource } from '../../shared/itemList';
import {
  Card,
  Checkbox,
  ExternalIcon,
  HeardBadge,
  LinkButton,
  PlayableCover,
  type TagOption,
  Tooltip,
} from '../../ui';
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
  /** Heard, by the worker's last read or a preview since. */
  heard: boolean;
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
  heard,
  onSelect,
  onPreview,
  onError,
}: ItemCardProps) {
  const name = `${item.artist} – ${item.title}`;
  const handlers = itemTagHandlers(mutations, [item.itemKey], item.tagIds, onError);
  return (
    <Card
      media={
        <PlayableCover
          src={item.coverUrl}
          size="fill"
          playing={previewing}
          dimmed={heard}
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
      meta={cardMeta(item, source)}
      badges={
        <>
          {heard && <HeardBadge />}
          <TagEditor tags={tags} assignedIds={item.tagIds} name={name} {...handlers} />
        </>
      }
    />
  );
});
