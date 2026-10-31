import { useEffect, useMemo } from 'react';
import type { ItemKey, ReleaseInfo } from '../../bandcamp';
import type { QueryView } from '../../hooks/useFollowingQuery';
import { useItemTags } from '../../hooks/useItemTags';
import { type FollowedAccount, useRecordFollow } from '../../hooks/useRecordFollow';
import { type FanCardPromptView, useFanCardTagPrompt } from '../../hooks/useFanCardTagPrompt';
import { useTagPrompt } from '../../hooks/useTagPrompt';
import { useTags } from '../../hooks/useTags';
import { AnchoredTagPicker } from '../../ui';
import { itemTagHandlers, type TagHandlers, type TagMutations } from './tagActions';

/**
 * Saves a follow made with Bandcamp's button on this page; renders nothing. Following gets no
 * picker, since Bandcamp's mailing-list dialog closes it (decisions §21).
 */
export function FollowRecorder({ account }: { account: FollowedAccount }) {
  useRecordFollow(document, account);
  return null;
}

export interface WishlistTagPromptProps {
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>;
  /** "Artist – Title". */
  name: string;
}

/** Opens the tag picker by Bandcamp's heart when you wishlist this release (decisions §21). */
export function WishlistTagPrompt({ release, name }: WishlistTagPromptProps) {
  const prompt = useTagPrompt(document, release);
  return <ItemPromptPicker {...prompt} itemKey={release.itemKey} name={name} />;
}

/** Opens the tag picker by an item card when you wishlist it on someone's profile (§21). */
export function FanCardTagPrompt() {
  const { view, close } = useFanCardTagPrompt(document);
  if (!view.open) return null;
  // Keyed so a heart on another card never shows this one's tags.
  return <FanCardPicker key={view.itemKey} view={view} close={close} />;
}

function FanCardPicker({
  view,
  close,
}: {
  view: Extract<FanCardPromptView, { open: true }>;
  close: () => void;
}) {
  return <ItemPromptPicker view={view} close={close} itemKey={view.itemKey} name={view.name} />;
}

interface ItemPromptPickerProps extends ReturnType<typeof useTagPrompt> {
  itemKey: ItemKey;
  name: string;
}

function ItemPromptPicker({ view, close, itemKey, name }: ItemPromptPickerProps) {
  const own = useItemTags(itemKey);
  const itemKeys: ItemKey[] = [itemKey];
  return (
    <PromptPicker
      view={view}
      close={close}
      own={own}
      title={`Tag ${name}`}
      handlers={(mutations, assigned, onError) =>
        itemTagHandlers(mutations, itemKeys, assigned, onError)
      }
    />
  );
}

interface PromptPickerProps extends ReturnType<typeof useTagPrompt> {
  /** The tags already on it; null until the save lands. */
  own: QueryView<number[] | null>;
  title: string;
  handlers: (
    mutations: TagMutations,
    assigned: readonly number[],
    onError: (message: string) => void,
  ) => TagHandlers;
}

/**
 * Shows nothing until the picker has your tags and the new follow or heart is saved. The page's
 * own tag editor shows the result, and the error states, after the picker closes.
 */
function PromptPicker({ view, close, own, title, handlers }: PromptPickerProps) {
  const all = useTags();
  const { create, assign, assignItems } = all;
  const mutations = useMemo(() => ({ create, assign, assignItems }), [create, assign, assignItems]);

  useEffect(() => {
    if (view.open && all.view.state === 'unreachable') {
      console.warn('crater: tag list failed', all.view.error);
    }
  }, [view.open, all.view]);

  if (!view.open || own.state !== 'ready' || own.data === null || all.view.state !== 'ready') {
    return null;
  }
  return (
    <AnchoredTagPicker
      anchor={view.anchor}
      title={title}
      open
      onOpenChange={(open) => !open && close()}
      tags={all.view.data}
      assignedIds={own.data}
      {...handlers(mutations, own.data, (message) =>
        console.warn('crater: tagging failed', message),
      )}
    />
  );
}
