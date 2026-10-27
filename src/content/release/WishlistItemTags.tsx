import { useEffect, useMemo } from 'react';
import type { ItemKey } from '../../bandcamp';
import { useItemTags } from '../../hooks/useItemTags';
import { useTags } from '../../hooks/useTags';
import { itemTagHandlers } from '../shared/tagActions';
import { TagEditor } from '../shared/TagEditor';

export interface WishlistItemTagsProps {
  itemKey: ItemKey;
  /** "Artist – Title", for the remove buttons. */
  name: string;
}

/**
 * Your tags on this release, when it's in your wishlist. Renders nothing while loading, on
 * error and when it isn't wishlisted, like `FollowedAccountTags` (decisions §14).
 */
export function WishlistItemTags({ itemKey, name }: WishlistItemTagsProps) {
  const own = useItemTags(itemKey);
  const all = useTags();
  const { create, assign, assignItems } = all;
  const mutations = useMemo(() => ({ create, assign, assignItems }), [create, assign, assignItems]);

  useEffect(() => {
    if (own.state === 'unreachable') console.warn('crater: item tag lookup failed', own.error);
  }, [own]);

  if (own.state !== 'ready' || own.data === null || all.view.state !== 'ready') return null;

  const handlers = itemTagHandlers(mutations, [itemKey], own.data, (message) =>
    console.warn('crater: tagging failed', message),
  );
  return (
    <div className="dh-page-tags">
      <span className="dh-page-tags__label">In your wishlist</span>
      <TagEditor tags={all.view.data} assignedIds={own.data} name={name} {...handlers} />
    </div>
  );
}
